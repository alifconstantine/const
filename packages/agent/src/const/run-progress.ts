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

/** Advisory checkpoints, never a task completion detector or an execution cap.
 * Keep only digests; tool output and file contents never become instructions. */
export class RunProgress {
  private recent: Array<{ key: string; result: string }> = [];
  private warned = new Set<string>();
  private pending: Omit<ProgressCheckpoint, "turn"> | undefined;
  private lastReview = 0;
  constructor(private readonly reviewEveryTurns = 20) {}

  reset() { this.recent = []; this.warned.clear(); this.pending = undefined; }
  record(name: string, args: unknown, result: unknown, isError: boolean) {
    const toolName = normalizeToolName(name);
    if (POLLING.has(toolName)) return;
    if (!isError && getToolActionKind(name) === "file_mutation") { this.reset(); return; }
    const key = `${toolName}:${toolArgumentSignature(args)}`;
    const digest = hash([isError, result]);
    const prior = this.recent.filter(item => item.key === key);
    if (prior.some(item => item.result !== digest)) {
      this.recent = this.recent.filter(item => item.key !== key);
      this.warned.delete(key);
      if (this.pending?.toolName === toolName) this.pending = undefined;
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
  }
  checkpoint(turn: number): ProgressCheckpoint | undefined {
    const repeated = this.pending;
    this.pending = undefined;
    if (turn - this.lastReview >= this.reviewEveryTurns) {
      this.lastReview = turn;
      return { ...(repeated ?? { kind: "review" as const }), turn };
    }
    return repeated ? { ...repeated, turn } : undefined;
  }
}
