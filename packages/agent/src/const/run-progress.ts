import { createHash } from "node:crypto";
import { getToolActionKind, normalizeToolName } from "./tool-policy.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
}
function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value) ?? "undefined").digest("hex"); }
export function toolArgumentSignature(args: unknown): string { return hash(canonical(args)); }

export interface ProgressCheckpoint { kind: "review" | "repeated_result"; turn: number; toolName?: string; count?: number }
const POLLING = new Set(["wait", "managetask", "agentstatus"]);
const OBSERVATION = new Set([
  "read", "ls", "find", "grep", "jfind", "astgrep", "gitstatus", "gitdiff", "gitlog",
  "browsersnapshot", "browserfind", "browserverifytext", "computergetappstate", "computerlistwindows", "computerlistapps",
]);

function normalizeFailureObservation(value: unknown): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value) ?? "undefined";
  return raw
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, "<ts>")
    .replace(/\bPID[:=\s]+\d+\b/gi, "PID:<pid>")
    .replace(/\b(?:duration|elapsed|time)[:=\s]+\d+(?:\.\d+)?\s*(?:ms|s)\b/gi, "duration:<dur>")
    .replace(/\btask_[a-z0-9_]+\b/gi, "<task>")
    .replace(/\bcall_[a-z0-9_]+\b/gi, "<call>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

/** Retain only digests for loop detection and checkpoint guidance. */
export class RunProgress {
  private recent: Array<{ key: string; result: string }> = [];
  private warned = new Set<string>();
  private pending: Omit<ProgressCheckpoint, "turn"> | undefined;
  private lastReview = 0;
  private cyclePending = false;
  private redirectedCycle = false;
  private mutationsSinceLastCheck = 0;
  private failureStreaks = new Map<string, { toolName: string; count: number; redirected: boolean; sawMutation: boolean }>();
  private repeatedFailurePending = false;
  constructor(private readonly reviewEveryTurns = 20) {}

  reset() {
    this.resetObservationWindow();
    this.mutationsSinceLastCheck = 0;
    this.failureStreaks.clear();
    this.repeatedFailurePending = false;
  }

  private resetObservationWindow() {
    this.recent = [];
    this.warned.clear();
    this.pending = undefined;
    this.cyclePending = false;
    this.redirectedCycle = false;
  }

  repeatedCycle(): boolean {
    if (this.repeatedFailurePending) return true;
    for (let period = 1; period <= 3; period++) {
      const cycle = this.recent.slice(-period * 3);
      if (cycle.length === period * 3 && cycle.every((item, index) => {
        const first = cycle[index % period]!;
        return item.key === first.key && item.result === first.result;
      })) return true;
    }
    return false;
  }

  hasRepeatedVerificationFailure(): boolean {
    return this.repeatedFailurePending;
  }

  record(name: string, args: unknown, result: unknown, isError: boolean): boolean {
    const toolName = normalizeToolName(name);
    const idleWait = toolName === "wait" && typeof result === "string" && result.startsWith("Nothing to wait for:");
    if (POLLING.has(toolName) && !isError && !idleWait) return false;
    if (!isError && getToolActionKind(name) === "file_mutation") {
      // A file edit invalidates identical-read cycles, but does NOT erase repeated verification failure streaks.
      this.resetObservationWindow();
      this.mutationsSinceLastCheck++;
      for (const streak of this.failureStreaks.values()) streak.sawMutation = true;
      return false;
    }
    if (!isError) {
      // A successful run of a check/tool clears failure streaks for that tool.
      for (const [sig, streak] of this.failureStreaks.entries()) {
        if (streak.toolName === toolName) this.failureStreaks.delete(sig);
      }
      if (this.failureStreaks.size === 0) this.repeatedFailurePending = false;
    } else {
      // Track repeated identical failures across edits (e.g. edit -> failing check -> edit -> same failing check).
      const failureSig = `${toolName}:${hash(normalizeFailureObservation(result))}`;
      const existing = this.failureStreaks.get(failureSig);
      if (existing) {
        existing.count++;
        if (existing.sawMutation && existing.count >= 2) {
          if (existing.redirected) {
            this.repeatedFailurePending = true;
            this.pending = { kind: "repeated_result", toolName, count: existing.count };
            return true;
          }
          this.repeatedFailurePending = true;
          this.pending = { kind: "repeated_result", toolName, count: existing.count };
        }
      } else {
        if (this.failureStreaks.size >= 16) {
          const oldest = this.failureStreaks.keys().next().value;
          if (oldest) this.failureStreaks.delete(oldest);
        }
        this.failureStreaks.set(failureSig, {
          toolName,
          count: 1,
          redirected: false,
          sawMutation: this.mutationsSinceLastCheck > 0,
        });
      }
    }
    const key = `${toolName}:${toolArgumentSignature(args)}`;
    const digest = hash([isError, result]);
    const prior = this.recent.filter(item => item.key === key);
    if (prior.some(item => item.result !== digest)) {
      this.recent = this.recent.filter(item => item.key !== key);
      this.warned.delete(key);
      if (this.pending?.toolName === toolName && !this.repeatedFailurePending) this.pending = undefined;
    }
    this.recent.push({ key, result: digest });
    if (this.recent.length > 12) this.recent.shift();
    // Keep warning memory bounded as well as the observation window.
    for (const warned of this.warned) if (!this.recent.some(item => item.key === warned)) this.warned.delete(warned);
    const count = this.recent.filter(item => item.key === key && item.result === digest).length;
    if (count >= 3 && !this.warned.has(key)) {
      this.warned.add(key);
      this.pending = { kind: "repeated_result", toolName, count };
    }
    this.cyclePending = (isError || idleWait || OBSERVATION.has(toolName)) && this.repeatedCycle();
    if (!this.cyclePending) {
      this.redirectedCycle = false;
      return false;
    }
    if (!this.repeatedFailurePending) {
      this.pending = { kind: "repeated_result", toolName, count };
    }
    return this.redirectedCycle;
  }
  checkpoint(turn: number): ProgressCheckpoint | undefined {
    const repeated = this.pending;
    this.pending = undefined;
    if (this.cyclePending) this.redirectedCycle = true;
    if (this.repeatedFailurePending) {
      for (const streak of this.failureStreaks.values()) {
        if (streak.sawMutation && streak.count >= 2) streak.redirected = true;
      }
      this.repeatedFailurePending = false;
    }
    if (turn - this.lastReview >= this.reviewEveryTurns) {
      this.lastReview = turn;
      return { ...(repeated ?? { kind: "review" as const }), turn };
    }
    return repeated ? { ...repeated, turn } : undefined;
  }
}
