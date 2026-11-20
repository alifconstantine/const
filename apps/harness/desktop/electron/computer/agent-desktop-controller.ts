import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ComputerToolContext, ToolExecutionResult } from "@const/agent";
import {
  AgentDesktopRunner,
  type AgentDesktopEnvelope,
  type AgentDesktopError,
  type AgentDesktopRunOptions,
  type AgentDesktopRunnerOptions,
} from "./agent-desktop-runner.js";

const LOCK_TTL_MS = 20_000;
const MAX_SNAPSHOT_LINES = 260;
const MAX_TREE_CHARS = 18_000;
const MAX_TEXT_PREVIEW = 160;

export interface ComputerCapabilities {
  platform: NodeJS.Platform;
  engine: "agent-desktop";
  version: string;
  available: boolean;
  enabled: boolean;
  permissions: Record<string, unknown>;
  supportedSurfaces: string[];
  stateRoot: string;
}

function sanitizeSessionId(sessionId?: string): string | undefined {
  if (!sessionId || typeof sessionId !== "string") return undefined;
  const cleaned = sessionId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!cleaned) return undefined;
  return `h_${cleaned}`.slice(0, 60);
}

function sanitizeFilenameSegment(value?: string): string {
  const cleaned = String(value || "desktop")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (cleaned || "desktop").slice(0, 40);
}

function resolveScreenshotsDir(): string {
  const dir = path.join(os.homedir(), ".const", "harness", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function normalizeRef(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function normalizeAppArg(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function normalizeWindowIdArg(raw: unknown): string | undefined {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.trunc(raw));
  return undefined;
}

/**
 * Normalize key chords (e.g. `CmdOrCtrl+S`, `Ctrl+Shift+P`, `Enter`, `Esc`)
 * into `agent-desktop` syntax (`ctrl+s`, `cmd+s`, `return`, `escape`).
 */
export function normalizeKeyCombo(raw: string, platform: NodeJS.Platform = process.platform): string {
  const primaryMod = platform === "darwin" ? "cmd" : "ctrl";
  const parts = raw
    .trim()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "cmdorctrl" || lower === "commandorcontrol" || lower === "mod") {
        return primaryMod;
      }
      if (lower === "command" || lower === "super" || lower === "win" || lower === "windows") {
        return "cmd";
      }
      if (lower === "control") return "ctrl";
      if (lower === "option") return "alt";
      if (lower === "enter") return "return";
      if (lower === "esc") return "escape";
      if (lower === "del") return "delete";
      if (lower === "arrowup") return "up";
      if (lower === "arrowdown") return "down";
      if (lower === "arrowleft") return "left";
      if (lower === "arrowright") return "right";
      if (lower === "pageup") return "page_up";
      if (lower === "pagedown") return "page_down";
      return lower;
    });
  return parts.join("+");
}

function normalizeModifiers(raw: unknown, platform: NodeJS.Platform = process.platform): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw.map(String)
    : String(raw)
        .split(/[+,]/)
        .map((s) => s.trim());
  const primaryMod = platform === "darwin" ? "cmd" : "ctrl";
  const out: string[] = [];
  for (const item of list) {
    const lower = item.trim().toLowerCase();
    if (!lower) continue;
    if (lower === "cmdorctrl" || lower === "commandorcontrol" || lower === "mod") {
      out.push(primaryMod);
    } else if (lower === "control") {
      out.push("ctrl");
    } else if (lower === "command" || lower === "super" || lower === "win") {
      out.push("meta");
    } else if (lower === "option") {
      out.push("alt");
    } else {
      out.push(lower);
    }
  }
  return out;
}

function truncateInline(value: unknown, maxLen = MAX_TEXT_PREVIEW): string {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function formatErrorEnvelope(toolName: string, error?: AgentDesktopError): ToolExecutionResult {
  const code = error?.code || "ERROR";
  const message = error?.message || "Unknown desktop automation error";
  const lines = [`Computer Use (${toolName}) failed [${code}]: ${message}`];
  if (error?.suggestion) {
    lines.push(`Suggestion: ${error.suggestion}`);
  }
  if (error?.recovery) {
    const parts: string[] = [];
    if (error.recovery.strategy) parts.push(`strategy=${error.recovery.strategy}`);
    if (error.recovery.requires_fresh_snapshot) parts.push("fresh_snapshot_required=true");
    if (typeof error.recovery.retryable === "boolean") parts.push(`retryable=${error.recovery.retryable}`);
    if (parts.length > 0) lines.push(`Recovery: ${parts.join(", ")}`);
  }
  if (error?.disposition) {
    const parts: string[] = [];
    if (error.disposition.delivery) parts.push(`delivery=${error.disposition.delivery}`);
    if (error.disposition.retry) parts.push(`retry=${error.disposition.retry}`);
    if (parts.length > 0) lines.push(`Disposition: ${parts.join(", ")}`);
  }
  if (error?.platform_detail) {
    lines.push(`Platform detail: ${error.platform_detail}`);
  }
  return { result: lines.join("\n"), isError: true };
}

function renderTreeNodes(
  node: any,
  depth: number,
  lines: string[],
  budget: { chars: number; truncated: boolean },
): void {
  if (!node || typeof node !== "object" || budget.truncated) return;
  if (lines.length >= MAX_SNAPSHOT_LINES || budget.chars >= MAX_TREE_CHARS) {
    budget.truncated = true;
    return;
  }

  const indent = "  ".repeat(Math.min(depth, 10));
  const ref = node.ref_id ?? node.ref;
  const role = node.role || "node";
  const name = node.name ? ` "${truncateInline(node.name)}"` : "";
  const value =
    node.value !== undefined && node.value !== null && String(node.value).length > 0
      ? ` value="${truncateInline(node.value)}"`
      : "";
  const states =
    Array.isArray(node.states) && node.states.length > 0
      ? ` [${node.states.join(",")}]`
      : "";
  const bounds =
    node.bounds && typeof node.bounds === "object"
      ? ` @(${Math.round(node.bounds.x ?? 0)},${Math.round(node.bounds.y ?? 0)} ${Math.round(node.bounds.width ?? 0)}x${Math.round(node.bounds.height ?? 0)})`
      : "";
  const childHint =
    typeof node.children_count === "number" && (!Array.isArray(node.children) || node.children.length === 0)
      ? ` (${node.children_count} children)`
      : "";

  const prefix = ref ? `${ref} ` : "";
  const line = `${indent}${prefix}${role}${name}${value}${states}${bounds}${childHint}`;
  lines.push(line);
  budget.chars += line.length + 1;

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      renderTreeNodes(child, depth + 1, lines, budget);
      if (budget.truncated) break;
    }
  }
}

function formatSnapshotResult(data: any): string {
  if (!data || typeof data !== "object") {
    return "Snapshot returned empty data.";
  }

  const header: string[] = [];
  if (data.snapshot_id) header.push(`snapshot_id: ${data.snapshot_id}`);
  if (data.app) header.push(`app: ${data.app}`);
  if (data.window) {
    const w = data.window;
    const title = w.title ? ` "${truncateInline(w.title, 80)}"` : "";
    const wid = w.id ? ` (${w.id})` : "";
    header.push(`window:${wid}${title}`);
  }
  if (data.surface) header.push(`surface: ${data.surface}`);
  if (typeof data.ref_count === "number") header.push(`refs: ${data.ref_count}`);

  const lines: string[] = [];
  if (header.length > 0) {
    lines.push(header.join(" | "));
  }
  if (data.warning) {
    lines.push(`Warning: ${data.warning}`);
  }
  if (data.guidance) {
    lines.push(`Guidance: ${typeof data.guidance === "string" ? data.guidance : JSON.stringify(data.guidance)}`);
  }

  const budget = { chars: 0, truncated: false };
  const treeLines: string[] = [];
  if (data.tree) {
    if (Array.isArray(data.tree)) {
      for (const item of data.tree) renderTreeNodes(item, 0, treeLines, budget);
    } else {
      renderTreeNodes(data.tree, 0, treeLines, budget);
    }
  } else if (Array.isArray(data.elements)) {
    for (const item of data.elements) renderTreeNodes(item, 0, treeLines, budget);
  } else if (Array.isArray(data.nodes)) {
    for (const item of data.nodes) renderTreeNodes(item, 0, treeLines, budget);
  }

  if (treeLines.length > 0) {
    lines.push("", ...treeLines);
    if (budget.truncated) {
      lines.push(
        `... [truncated; use computer_snapshot with root: "@s...:eN" or computer_find to inspect a specific subtree]`,
      );
    }
  } else {
    lines.push("", JSON.stringify(data, null, 2).slice(0, MAX_TREE_CHARS));
  }

  return lines.join("\n");
}

function formatFindResult(data: any): string {
  if (!data || typeof data !== "object") return JSON.stringify(data ?? null);
  if (typeof data.count === "number" && !Array.isArray(data.matches)) {
    return `Matches: ${data.count}`;
  }
  const matches = Array.isArray(data.matches) ? data.matches : Array.isArray(data) ? data : null;
  if (!matches) return JSON.stringify(data, null, 2).slice(0, MAX_TREE_CHARS);
  if (matches.length === 0) return "No matching elements found.";

  const lines: string[] = [`Found ${matches.length} element(s):`];
  for (const m of matches.slice(0, 80)) {
    const ref = m.ref_id ?? m.ref ?? "";
    const role = m.role || "node";
    const name = m.name ? ` "${truncateInline(m.name)}"` : "";
    const value =
      m.value !== undefined && m.value !== null && String(m.value).length > 0
        ? ` value="${truncateInline(m.value)}"`
        : "";
    const states = Array.isArray(m.states) && m.states.length > 0 ? ` [${m.states.join(",")}]` : "";
    const bounds =
      m.bounds && typeof m.bounds === "object"
        ? ` @(${Math.round(m.bounds.x ?? 0)},${Math.round(m.bounds.y ?? 0)} ${Math.round(m.bounds.width ?? 0)}x${Math.round(m.bounds.height ?? 0)})`
        : "";
    lines.push(`- ${ref ? `${ref} ` : ""}${role}${name}${value}${states}${bounds}`);
  }
  if (matches.length > 80) {
    lines.push(`... and ${matches.length - 80} more`);
  }
  return lines.join("\n");
}

function formatAppsResult(data: any): string {
  const apps = Array.isArray(data) ? data : Array.isArray(data?.apps) ? data.apps : null;
  if (!apps) return JSON.stringify(data ?? [], null, 2);
  if (apps.length === 0) return "No visible running desktop applications found.";
  const lines = [`Running desktop applications (${apps.length}):`];
  for (const app of apps) {
    const name = app.name || app.app || app.process_name || "unknown";
    const pid = app.pid !== undefined ? ` pid=${app.pid}` : "";
    const bundle = app.bundle_id ? ` bundle=${app.bundle_id}` : "";
    const winCount =
      typeof app.window_count === "number"
        ? ` windows=${app.window_count}`
        : Array.isArray(app.windows)
          ? ` windows=${app.windows.length}`
          : "";
    lines.push(`- ${name}${pid}${bundle}${winCount}`);
  }
  return lines.join("\n");
}

function formatWindowsResult(data: any): string {
  const windows = Array.isArray(data) ? data : Array.isArray(data?.windows) ? data.windows : null;
  if (!windows) return JSON.stringify(data ?? [], null, 2);
  if (windows.length === 0) return "No matching desktop windows found.";
  const lines = [`Desktop windows (${windows.length}):`];
  for (const w of windows) {
    const id = w.id ?? w.window_id ?? "?";
    const app = w.app ?? w.app_name ?? "";
    const title = w.title ? ` "${truncateInline(w.title, 100)}"` : "";
    const focused = w.is_focused || w.focused ? " [focused]" : "";
    const minimized = w.is_minimized || w.minimized ? " [minimized]" : "";
    const bounds =
      w.bounds && typeof w.bounds === "object"
        ? ` @(${Math.round(w.bounds.x ?? 0)},${Math.round(w.bounds.y ?? 0)} ${Math.round(w.bounds.width ?? 0)}x${Math.round(w.bounds.height ?? 0)})`
        : "";
    lines.push(`- id=${id}${app ? ` app=${app}` : ""}${title}${focused}${minimized}${bounds}`);
  }
  return lines.join("\n");
}

function formatCompactActionResult(actionLabel: string, data: any): string {
  if (!data || typeof data !== "object") {
    return `${actionLabel} completed.`;
  }
  const summary: string[] = [`${actionLabel} completed.`];
  if (data.ref_id || data.ref) summary.push(`ref: ${data.ref_id ?? data.ref}`);
  if (data.app) summary.push(`app: ${data.app}`);
  if (data.window_id) summary.push(`window_id: ${data.window_id}`);
  if (data.pid) summary.push(`pid: ${data.pid}`);
  if (data.value !== undefined) summary.push(`value: "${truncateInline(data.value)}"`);
  if (data.text !== undefined) summary.push(`text: "${truncateInline(data.text)}"`);
  if (data.disposition?.delivery) summary.push(`delivery: ${data.disposition.delivery}`);
  if (summary.length === 1) {
    return `${actionLabel} completed: ${JSON.stringify(data).slice(0, 1500)}`;
  }
  return summary.join(" | ");
}

/**
 * Native desktop GUI automation controller powered by Vercel Labs' `agent-desktop`.
 * Replaces the legacy PowerShell/Python/Swift helpers with a single Rust binary,
 * snapshot-scoped refs (`@sXXXX:eN`), headless-by-default UIA/AX actions, and
 * per-conversation desktop session locking.
 */
export class AgentDesktopController {
  private readonly runner: AgentDesktopRunner;
  private enabled = true;
  private owner: { sessionId: string; touched: number } | null = null;
  private readonly platform: NodeJS.Platform;

  constructor(
    runnerOrOptions?: AgentDesktopRunner | AgentDesktopRunnerOptions,
    platform: NodeJS.Platform = process.platform,
  ) {
    this.runner =
      runnerOrOptions instanceof AgentDesktopRunner
        ? runnerOrOptions
        : new AgentDesktopRunner(runnerOrOptions);
    this.platform = platform;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.owner = null;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isAvailable(): boolean {
    return this.runner.isAvailable();
  }

  public releaseSession(sessionId: string): void {
    if (this.owner?.sessionId === sessionId) {
      this.owner = null;
    }
  }

  public shutdown(): void {
    this.owner = null;
    this.runner.dispose();
  }

  private ensureReady(): void {
    if (!this.enabled) {
      throw new Error("Computer Use is disabled in settings.");
    }
    if (!this.runner.isAvailable()) {
      throw new Error(
        `Native agent-desktop runtime not found for platform: ${this.platform}/${process.arch}`,
      );
    }
  }

  private acquireSessionLock(sessionId?: string): void {
    if (!sessionId) return;
    const now = Date.now();
    if (this.owner && this.owner.sessionId !== sessionId && now - this.owner.touched < LOCK_TTL_MS) {
      throw new Error(
        "Desktop automation is currently in use by another conversation. Wait for it to finish before retrying.",
      );
    }
    this.owner = { sessionId, touched: now };
  }

  private touchSessionLock(sessionId?: string): void {
    if (sessionId && this.owner?.sessionId === sessionId) {
      this.owner.touched = Date.now();
    }
  }

  public async getCapabilities(): Promise<ComputerCapabilities> {
    if (!this.runner.isAvailable()) {
      return {
        platform: this.platform,
        engine: "agent-desktop",
        version: "unavailable",
        available: false,
        enabled: this.enabled,
        permissions: {},
        supportedSurfaces: [],
        stateRoot: this.runner.getStateRoot(),
      };
    }

    const res = await this.runner.run(["status"]);
    if (!res.ok) {
      throw new Error(res.error?.message || "agent-desktop status check failed");
    }
    const data = res.data || {};
    return {
      platform: this.platform,
      engine: "agent-desktop",
      version: String(data.version || "1.3.1"),
      available: true,
      enabled: this.enabled,
      permissions: data.permissions || {},
      supportedSurfaces: Array.isArray(data.supported_surfaces) ? data.supported_surfaces : [],
      stateRoot: String(data.state_root || this.runner.getStateRoot()),
    };
  }

  public async listApps(appFilter?: string): Promise<any[]> {
    this.ensureReady();
    const cmd = ["list-apps"];
    if (appFilter) cmd.push("--app", appFilter);
    const res = await this.runner.run(cmd);
    if (!res.ok) {
      throw new Error(res.error?.message || "Failed to list running desktop apps");
    }
    return Array.isArray(res.data) ? res.data : Array.isArray(res.data?.apps) ? res.data.apps : [];
  }

  public async listWindows(appFilter?: string): Promise<any[]> {
    this.ensureReady();
    const cmd = ["list-windows"];
    if (appFilter) cmd.push("--app", appFilter);
    const res = await this.runner.run(cmd);
    if (!res.ok) {
      throw new Error(res.error?.message || "Failed to list desktop windows");
    }
    return Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.windows)
        ? res.data.windows
        : [];
  }

  private async runCommand<T = any>(
    subcommandArgs: string[],
    options: AgentDesktopRunOptions,
  ): Promise<AgentDesktopEnvelope<T>> {
    return this.runner.run<T>(subcommandArgs, options);
  }

  public async executeTool(
    toolName: string,
    args: Record<string, any> = {},
    context?: ComputerToolContext,
  ): Promise<ToolExecutionResult> {
    try {
      this.ensureReady();
      this.acquireSessionLock(context?.sessionId);
    } catch (err: any) {
      return { result: err?.message || String(err), isError: true };
    }

    const session = sanitizeSessionId(context?.sessionId);
    const baseOpts: AgentDesktopRunOptions = {
      session,
      signal: context?.signal,
    };

    try {
      const outcome = await this.dispatchTool(toolName, args ?? {}, baseOpts);
      this.touchSessionLock(context?.sessionId);
      return outcome;
    } catch (err: any) {
      return {
        result: `Computer Use (${toolName}) error: ${err?.message || String(err)}`,
        isError: true,
      };
    }
  }

  private async dispatchTool(
    toolName: string,
    args: Record<string, any>,
    baseOpts: AgentDesktopRunOptions,
  ): Promise<ToolExecutionResult> {
    switch (toolName) {
      case "computer_status": {
        const res = await this.runCommand(["status"], baseOpts);
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: JSON.stringify(res.data, null, 2), isError: false };
      }

      case "computer_list_apps": {
        const cmd = ["list-apps"];
        const app = normalizeAppArg(args.app);
        if (app) cmd.push("--app", app);
        const res = await this.runCommand(cmd, baseOpts);
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatAppsResult(res.data), isError: false };
      }

      case "computer_list_windows": {
        const cmd = ["list-windows"];
        const app = normalizeAppArg(args.app);
        if (app) cmd.push("--app", app);
        const res = await this.runCommand(cmd, baseOpts);
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatWindowsResult(res.data), isError: false };
      }

      case "computer_snapshot":
      case "computer_get_app_state": {
        const app = normalizeAppArg(args.app);
        const windowId = normalizeWindowIdArg(args.windowId ?? args.window_id);
        const root = normalizeRef(args.root);

        // Optional explicit restore when the caller knows the target window is minimized.
        if (args.restoreWindow === true && (app || windowId)) {
          const restoreCmd = ["restore"];
          if (app) restoreCmd.push("--app", app);
          if (windowId) restoreCmd.push("--window-id", windowId);
          await this.runCommand(restoreCmd, baseOpts);
        }

        const cmd = ["snapshot"];
        if (app) cmd.push("--app", app);
        if (windowId) cmd.push("--window-id", windowId);
        if (root) cmd.push("--root", root);
        if (typeof args.surface === "string" && args.surface.trim()) {
          cmd.push("--surface", args.surface.trim());
        }
        if (args.interactiveOnly !== false) {
          cmd.push("-i");
        }
        if (args.compact !== false) {
          cmd.push("--compact");
        }
        if (args.skeleton === true) {
          cmd.push("--skeleton");
        }
        if (args.includeBounds === true) {
          cmd.push("--include-bounds");
        }
        if (typeof args.maxDepth === "number" && Number.isFinite(args.maxDepth)) {
          cmd.push("--max-depth", String(Math.max(1, Math.min(30, Math.round(args.maxDepth)))));
        }
        const timeoutMs =
          typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)
            ? Math.max(1_000, Math.round(args.timeoutMs))
            : undefined;
        if (timeoutMs !== undefined) {
          cmd.push("--timeout-ms", String(timeoutMs));
        }

        const res = await this.runCommand(cmd, {
          ...baseOpts,
          timeoutMs: timeoutMs ? Math.max(35_000, timeoutMs + 10_000) : baseOpts.timeoutMs,
        });
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatSnapshotResult(res.data), isError: false };
      }

      case "computer_find": {
        const cmd = ["find"];
        const app = normalizeAppArg(args.app);
        const windowId = normalizeWindowIdArg(args.windowId ?? args.window_id);
        const root = normalizeRef(args.root);
        if (app) cmd.push("--app", app);
        if (windowId) cmd.push("--window-id", windowId);
        if (root) cmd.push("--root", root);
        if (typeof args.surface === "string" && args.surface.trim()) {
          cmd.push("--surface", args.surface.trim());
        }
        if (typeof args.role === "string" && args.role.trim()) cmd.push("--role", args.role.trim());
        if (typeof args.name === "string" && args.name.trim()) cmd.push("--name", args.name.trim());
        if (typeof args.value === "string" && args.value.length > 0) cmd.push("--value", args.value);
        if (typeof args.text === "string" && args.text.trim()) cmd.push("--text", args.text.trim());
        if (typeof args.description === "string" && args.description.trim()) {
          cmd.push("--description", args.description.trim());
        }
        if (typeof args.nativeId === "string" && args.nativeId.trim()) {
          cmd.push("--native-id", args.nativeId.trim());
        }
        if (args.exact === true) cmd.push("--exact");
        if (Array.isArray(args.state)) {
          for (const token of args.state) {
            if (typeof token === "string" && token.trim()) cmd.push("--state", token.trim());
          }
        } else if (typeof args.state === "string" && args.state.trim()) {
          cmd.push("--state", args.state.trim());
        }
        if (args.count === true) cmd.push("--count");
        else if (args.first === true) cmd.push("--first");
        else if (args.last === true) cmd.push("--last");
        else if (typeof args.nth === "number" && Number.isFinite(args.nth)) {
          cmd.push("--nth", String(Math.max(0, Math.trunc(args.nth))));
        } else if (typeof args.limit === "number" && Number.isFinite(args.limit)) {
          cmd.push("--limit", String(Math.max(0, Math.trunc(args.limit))));
        }
        if (typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)) {
          cmd.push("--timeout-ms", String(Math.max(1_000, Math.round(args.timeoutMs))));
        }

        const res = await this.runCommand(cmd, baseOpts);
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatFindResult(res.data), isError: false };
      }

      case "computer_screenshot": {
        const app = normalizeAppArg(args.app);
        const windowId = normalizeWindowIdArg(args.windowId ?? args.window_id);
        const screenshotsDir = resolveScreenshotsDir();
        const label = sanitizeFilenameSegment(args.filename || app || (args.screen !== undefined ? `screen-${args.screen}` : "desktop"));
        const fileName = `desktop-${label}-${Date.now()}.png`;
        const filePath = path.join(screenshotsDir, fileName);

        const cmd = ["screenshot"];
        if (app) cmd.push("--app", app);
        if (windowId) cmd.push("--window-id", windowId);
        if (typeof args.screen === "number" && Number.isFinite(args.screen)) {
          cmd.push("--screen", String(Math.max(0, Math.trunc(args.screen))));
        }
        cmd.push(filePath);

        const res = await this.runCommand(cmd, baseOpts);
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);

        const savedPath = typeof res.data?.path === "string" ? res.data.path : filePath;
        const sizeBytes = fs.existsSync(savedPath) ? fs.statSync(savedPath).size : undefined;
        const sizeLabel = sizeBytes ? ` (${Math.round(sizeBytes / 1024)} KB)` : "";
        return {
          result: `Saved desktop screenshot${sizeLabel}: ${savedPath}`,
          isError: false,
        };
      }

      case "computer_click": {
        const ref = normalizeRef(args.ref);
        const action = typeof args.action === "string" ? args.action.trim().toLowerCase() : undefined;
        const button = String(args.button ?? args.mouseButton ?? "left").toLowerCase();
        const clickCount =
          typeof args.clickCount === "number" && Number.isFinite(args.clickCount)
            ? Math.max(1, Math.min(3, Math.trunc(args.clickCount)))
            : 1;
        const hasCoords =
          typeof args.x === "number" &&
          Number.isFinite(args.x) &&
          typeof args.y === "number" &&
          Number.isFinite(args.y);

        // Coordinate fallback: physical click at absolute screen x,y
        if (!ref && hasCoords) {
          const x = Math.round(args.x);
          const y = Math.round(args.y);
          const cmd = ["mouse-click", `--xy=${x},${y}`];
          if (button === "right" || button === "middle" || button === "left") {
            cmd.push("--button", button);
          }
          if (clickCount > 1) cmd.push("--count", String(clickCount));
          for (const mod of normalizeModifiers(args.modifiers, this.platform)) {
            cmd.push("--modifiers", mod);
          }
          const res = await this.runCommand(cmd, { ...baseOpts, headed: true });
          if (!res.ok) return formatErrorEnvelope(toolName, res.error);
          return { result: formatCompactActionResult(`Mouse click (${x},${y})`, res.data), isError: false };
        }

        if (!ref) {
          return {
            result:
              "computer_click requires either a qualified snapshot `ref` (e.g. `@sXXXX:e5` from computer_snapshot/computer_find) or absolute screen coordinates (`x`, `y`).",
            isError: true,
          };
        }

        // Semantic ref actions
        if (action && action !== "click") {
          return this.executeSemanticRefAction(toolName, action, ref, args, baseOpts);
        }

        let cmd: string[];
        let headed = args.headed === true;
        if (clickCount === 3) {
          cmd = ["triple-click", ref];
          headed = true;
        } else if (clickCount === 2) {
          cmd = ["double-click", ref];
          headed = true;
        } else if (button === "right") {
          cmd = ["right-click", ref];
          headed = args.headed ?? false;
        } else {
          cmd = ["click", ref];
        }
        if (typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)) {
          cmd.push("--timeout-ms", String(Math.max(0, Math.round(args.timeoutMs))));
        }

        const res = await this.runCommand(cmd, { ...baseOpts, headed });
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatCompactActionResult(`Click ${ref}`, res.data), isError: false };
      }

      case "computer_set_value": {
        const ref = normalizeRef(args.ref);
        if (!ref) {
          return {
            result:
              "computer_set_value requires a qualified `ref` (e.g. `@sXXXX:e5` from computer_snapshot or computer_find).",
            isError: true,
          };
        }
        const value = args.value === undefined || args.value === null ? "" : String(args.value);
        const cmd = ["set-value", ref, "--stdin"];
        if (typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)) {
          cmd.push("--timeout-ms", String(Math.max(0, Math.round(args.timeoutMs))));
        }
        const res = await this.runCommand(cmd, {
          ...baseOpts,
          stdin: value,
          headed: args.headed === true,
        });
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatCompactActionResult(`Set value on ${ref}`, res.data), isError: false };
      }

      case "computer_type":
      case "computer_type_text": {
        const text = args.text === undefined || args.text === null ? "" : String(args.text);
        let ref = normalizeRef(args.ref);

        // Resilient fallback if a caller omits `ref` and passes `app`: try to locate the focused control.
        if (!ref) {
          const app = normalizeAppArg(args.app);
          if (app) {
            const findRes = await this.runCommand(
              ["find", "--app", app, "--state", "focused=true", "--first"],
              baseOpts,
            );
            const match = Array.isArray(findRes.data?.matches) ? findRes.data.matches[0] : undefined;
            ref = normalizeRef(match?.ref_id ?? match?.ref);
          }
        }

        if (!ref) {
          return {
            result:
              "computer_type requires a qualified `ref` (e.g. `@sXXXX:e5` from computer_snapshot). Alternatively use `computer_paste_text` to paste into the currently focused window.",
            isError: true,
          };
        }

        const cmd = ["type", ref, "--stdin"];
        if (typeof args.intervalMs === "number" && Number.isFinite(args.intervalMs)) {
          cmd.push("--interval-ms", String(Math.max(1, Math.min(2000, Math.round(args.intervalMs)))));
        }
        if (typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)) {
          cmd.push("--timeout-ms", String(Math.max(0, Math.round(args.timeoutMs))));
        }

        const res = await this.runCommand(cmd, {
          ...baseOpts,
          stdin: text,
          // Physical keystroke delivery requires --headed on Windows/macOS/Linux unless explicitly disabled.
          headed: args.headed !== false,
        });
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatCompactActionResult(`Typed into ${ref}`, res.data), isError: false };
      }

      case "computer_press_key":
      case "computer_hotkey": {
        const rawKey = typeof args.key === "string" ? args.key : typeof args.combo === "string" ? args.combo : "";
        if (!rawKey.trim()) {
          return { result: `${toolName} requires a non-empty 'key' string (e.g. 'return', 'ctrl+s', 'CmdOrCtrl+F').`, isError: true };
        }
        const combo = normalizeKeyCombo(rawKey, this.platform);
        const cmd = ["press", combo];
        const app = normalizeAppArg(args.app);
        const windowId = normalizeWindowIdArg(args.windowId ?? args.window_id);
        if (app) cmd.push("--app", app);
        if (windowId) cmd.push("--window-id", windowId);
        if (args.force === true) cmd.push("--force");

        const res = await this.runCommand(cmd, {
          ...baseOpts,
          headed: args.headed !== false,
        });
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatCompactActionResult(`Pressed '${combo}'`, res.data), isError: false };
      }

      case "computer_paste_text": {
        const text = args.text === undefined || args.text === null ? "" : String(args.text);
        const ref = normalizeRef(args.ref);
        const app = normalizeAppArg(args.app);
        const windowId = normalizeWindowIdArg(args.windowId ?? args.window_id);

        if (ref) {
          const focusRes = await this.runCommand(["focus", ref], { ...baseOpts, headed: true });
          if (!focusRes.ok) return formatErrorEnvelope(toolName, focusRes.error);
        }

        const clipRes = await this.runCommand(["clipboard-set", "--stdin"], {
          ...baseOpts,
          stdin: text,
        });
        if (!clipRes.ok) return formatErrorEnvelope(toolName, clipRes.error);

        const pasteCombo = this.platform === "darwin" ? "cmd+v" : "ctrl+v";
        const pressCmd = ["press", pasteCombo];
        if (app) pressCmd.push("--app", app);
        if (windowId) pressCmd.push("--window-id", windowId);

        const pressRes = await this.runCommand(pressCmd, { ...baseOpts, headed: true });
        if (!pressRes.ok) return formatErrorEnvelope(toolName, pressRes.error);
        return {
          result: `Pasted ${text.length} character(s) via clipboard (${pasteCombo}).`,
          isError: false,
        };
      }

      case "computer_scroll": {
        const ref = normalizeRef(args.ref);
        const direction = String(args.direction || "down").toLowerCase();
        const amount =
          typeof args.amount === "number" && Number.isFinite(args.amount)
            ? Math.max(1, Math.round(args.amount))
            : typeof args.pages === "number" && Number.isFinite(args.pages)
              ? Math.max(1, Math.round(args.pages * 3))
              : 3;

        if (ref) {
          const cmd = ["scroll", ref, "--direction", direction, "--amount", String(amount)];
          if (typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)) {
            cmd.push("--timeout-ms", String(Math.max(0, Math.round(args.timeoutMs))));
          }
          const res = await this.runCommand(cmd, { ...baseOpts, headed: args.headed === true });
          if (!res.ok) return formatErrorEnvelope(toolName, res.error);
          return { result: formatCompactActionResult(`Scrolled ${ref} ${direction}`, res.data), isError: false };
        }

        if (
          typeof args.x === "number" &&
          Number.isFinite(args.x) &&
          typeof args.y === "number" &&
          Number.isFinite(args.y)
        ) {
          const x = Math.round(args.x);
          const y = Math.round(args.y);
          let dx = 0;
          let dy = 0;
          if (direction === "up") dy = amount;
          else if (direction === "down") dy = -amount;
          else if (direction === "right") dx = amount;
          else if (direction === "left") dx = -amount;

          const cmd = ["mouse-wheel", `--x=${x}`, `--y=${y}`, `--dx=${dx}`, `--dy=${dy}`];
          const res = await this.runCommand(cmd, { ...baseOpts, headed: true });
          if (!res.ok) return formatErrorEnvelope(toolName, res.error);
          return {
            result: formatCompactActionResult(`Scrolled ${direction} at (${x},${y})`, res.data),
            isError: false,
          };
        }

        return {
          result: "computer_scroll requires either a snapshot `ref` or absolute coordinates (`x`, `y`).",
          isError: true,
        };
      }

      case "computer_drag": {
        const fromRef = normalizeRef(args.fromRef ?? args.from);
        const toRef = normalizeRef(args.toRef ?? args.to);
        const hasFromXY =
          typeof args.fromX === "number" &&
          Number.isFinite(args.fromX) &&
          typeof args.fromY === "number" &&
          Number.isFinite(args.fromY);
        const hasToXY =
          typeof args.toX === "number" &&
          Number.isFinite(args.toX) &&
          typeof args.toY === "number" &&
          Number.isFinite(args.toY);

        if ((!fromRef && !hasFromXY) || (!toRef && !hasToXY)) {
          return {
            result:
              "computer_drag requires a source (`fromRef` or `fromX`/`fromY`) and a destination (`toRef` or `toX`/`toY`).",
            isError: true,
          };
        }

        const cmd = ["drag"];
        if (fromRef) cmd.push("--from", fromRef);
        else cmd.push(`--from-xy=${Math.round(args.fromX)},${Math.round(args.fromY)}`);
        if (toRef) cmd.push("--to", toRef);
        else cmd.push(`--to-xy=${Math.round(args.toX)},${Math.round(args.toY)}`);

        if (typeof args.durationMs === "number" && Number.isFinite(args.durationMs)) {
          cmd.push("--duration", String(Math.max(50, Math.round(args.durationMs))));
        }
        if (typeof args.dropDelayMs === "number" && Number.isFinite(args.dropDelayMs)) {
          cmd.push("--drop-delay", String(Math.max(0, Math.round(args.dropDelayMs))));
        }
        if (typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)) {
          cmd.push("--timeout-ms", String(Math.max(1_000, Math.round(args.timeoutMs))));
        }

        const res = await this.runCommand(cmd, { ...baseOpts, headed: true });
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatCompactActionResult("Drag", res.data), isError: false };
      }

      case "computer_launch_app": {
        const app = normalizeAppArg(args.app);
        if (!app) {
          return { result: "computer_launch_app requires a non-empty `app` name, path, or bundle ID.", isError: true };
        }
        const cmd = ["launch", app];
        if (args.activate !== false) cmd.push("--activate");
        if (typeof args.cwd === "string" && args.cwd.trim()) cmd.push("--cwd", args.cwd.trim());
        if (Array.isArray(args.args)) {
          for (const a of args.args) {
            cmd.push(`--arg=${String(a)}`);
          }
        }
        const timeoutMs =
          typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)
            ? Math.max(1_000, Math.round(args.timeoutMs))
            : 30_000;
        cmd.push("--timeout", String(timeoutMs));

        const res = await this.runCommand(cmd, {
          ...baseOpts,
          timeoutMs: Math.max(35_000, timeoutMs + 10_000),
        });
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatCompactActionResult(`Launched '${app}'`, res.data), isError: false };
      }

      case "computer_window": {
        const action = String(args.action || "").trim().toLowerCase();
        const app = normalizeAppArg(args.app);
        const windowId = normalizeWindowIdArg(args.windowId ?? args.window_id);

        if (action === "close" || action === "close-app" || action === "quit") {
          if (!app) {
            return { result: "computer_window action 'close' requires `app`.", isError: true };
          }
          const cmd = ["close-app", app];
          if (args.force === true) cmd.push("--force");
          const res = await this.runCommand(cmd, baseOpts);
          if (!res.ok) return formatErrorEnvelope(toolName, res.error);
          return { result: formatCompactActionResult(`Closed '${app}'`, res.data), isError: false };
        }

        let subcommand: string;
        if (action === "focus" || action === "focus-window") subcommand = "focus-window";
        else if (action === "restore") subcommand = "restore";
        else if (action === "minimize") subcommand = "minimize";
        else if (action === "maximize") subcommand = "maximize";
        else if (action === "resize" || action === "resize-window") subcommand = "resize-window";
        else if (action === "move" || action === "move-window") subcommand = "move-window";
        else {
          return {
            result: `Unknown computer_window action '${action}'. Use: focus, restore, minimize, maximize, resize, move, or close.`,
            isError: true,
          };
        }

        const cmd = [subcommand];
        if (app) cmd.push("--app", app);
        if (windowId) cmd.push("--window-id", windowId);
        if (subcommand === "focus-window" && typeof args.title === "string" && args.title.trim()) {
          cmd.push("--title", args.title.trim());
        }
        if (subcommand === "resize-window") {
          if (typeof args.width !== "number" || typeof args.height !== "number") {
            return { result: "computer_window action 'resize' requires numeric `width` and `height`.", isError: true };
          }
          cmd.push("--width", String(Math.round(args.width)), "--height", String(Math.round(args.height)));
        }
        if (subcommand === "move-window") {
          if (typeof args.x !== "number" || typeof args.y !== "number") {
            return { result: "computer_window action 'move' requires numeric `x` and `y`.", isError: true };
          }
          cmd.push(`--x=${Math.round(args.x)}`, `--y=${Math.round(args.y)}`);
        }

        const res = await this.runCommand(cmd, {
          ...baseOpts,
          headed: subcommand === "focus-window" ? true : args.headed === true,
        });
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatCompactActionResult(`Window ${subcommand}`, res.data), isError: false };
      }

      case "computer_wait": {
        const cmd = ["wait"];
        const timeoutMs =
          typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs)
            ? Math.max(500, Math.round(args.timeoutMs))
            : 15_000;

        if (typeof args.ms === "number" && Number.isFinite(args.ms)) {
          cmd.push(String(Math.max(0, Math.min(30_000, Math.round(args.ms)))));
        } else {
          const element = normalizeRef(args.element ?? args.ref);
          if (element) cmd.push("--element", element);
          if (typeof args.predicate === "string" && args.predicate.trim()) {
            cmd.push("--predicate", args.predicate.trim());
          }
          if (typeof args.value === "string") cmd.push("--value", args.value);
          if (typeof args.window === "string" && args.window.trim()) {
            cmd.push("--window", args.window.trim());
          }
          if (typeof args.text === "string" && args.text.trim()) {
            cmd.push("--text", args.text.trim());
          }
          if (typeof args.event === "string" && args.event.trim()) {
            cmd.push("--event", args.event.trim());
          }
          const app = normalizeAppArg(args.app);
          const windowId = normalizeWindowIdArg(args.windowId ?? args.window_id);
          if (app) cmd.push("--app", app);
          if (windowId) cmd.push("--window-id", windowId);
          cmd.push("--timeout", String(timeoutMs));
        }

        const res = await this.runCommand(cmd, {
          ...baseOpts,
          timeoutMs: Math.max(35_000, timeoutMs + 10_000),
        });
        if (!res.ok) return formatErrorEnvelope(toolName, res.error);
        return { result: formatCompactActionResult("Wait", res.data), isError: false };
      }

      case "computer_clipboard": {
        const action = String(args.action || "get").trim().toLowerCase();
        if (action === "get") {
          const cmd = ["clipboard-get"];
          if (typeof args.format === "string" && args.format.trim()) {
            cmd.push("--format", args.format.trim());
          }
          const res = await this.runCommand(cmd, baseOpts);
          if (!res.ok) return formatErrorEnvelope(toolName, res.error);
          const content =
            typeof res.data === "string"
              ? res.data
              : typeof res.data?.text === "string"
                ? res.data.text
                : JSON.stringify(res.data, null, 2);
          return { result: content, isError: false };
        }
        if (action === "set") {
          const text = args.text === undefined || args.text === null ? "" : String(args.text);
          const res = await this.runCommand(["clipboard-set", "--stdin"], {
            ...baseOpts,
            stdin: text,
          });
          if (!res.ok) return formatErrorEnvelope(toolName, res.error);
          return { result: `Copied ${text.length} character(s) to system clipboard.`, isError: false };
        }
        if (action === "clear") {
          const res = await this.runCommand(["clipboard-clear"], baseOpts);
          if (!res.ok) return formatErrorEnvelope(toolName, res.error);
          return { result: "Cleared system clipboard.", isError: false };
        }
        return {
          result: `Unknown computer_clipboard action '${action}'. Use: get, set, or clear.`,
          isError: true,
        };
      }

      default:
        return { result: `Unknown Computer Use tool: ${toolName}`, isError: true };
    }
  }

  private async executeSemanticRefAction(
    toolName: string,
    action: string,
    ref: string,
    args: Record<string, any>,
    baseOpts: AgentDesktopRunOptions,
  ): Promise<ToolExecutionResult> {
    let cmd: string[];
    let headed = args.headed === true;

    switch (action) {
      case "double_click":
      case "double-click":
        cmd = ["double-click", ref];
        headed = true;
        break;
      case "triple_click":
      case "triple-click":
        cmd = ["triple-click", ref];
        headed = true;
        break;
      case "right_click":
      case "right-click":
        cmd = ["right-click", ref];
        break;
      case "hover":
        cmd = ["hover", ref];
        headed = true;
        break;
      case "focus":
        cmd = ["focus", ref];
        headed = true;
        break;
      case "toggle":
      case "check":
      case "uncheck":
      case "expand":
      case "collapse":
      case "clear":
        cmd = [action, ref];
        break;
      case "scroll_to":
      case "scroll-to":
        cmd = ["scroll-to", ref];
        break;
      case "select": {
        const option = typeof args.option === "string" ? args.option : typeof args.value === "string" ? args.value : "";
        if (!option) {
          return { result: "computer_click action 'select' requires `option` (or `value`).", isError: true };
        }
        cmd = ["select", ref, option];
        break;
      }
      default:
        return {
          result: `Unknown ref action '${action}'. Supported actions: click, double_click, triple_click, right_click, hover, focus, toggle, check, uncheck, expand, collapse, clear, scroll_to, select.`,
          isError: true,
        };
    }

    const res = await this.runCommand(cmd, { ...baseOpts, headed });
    if (!res.ok) return formatErrorEnvelope(toolName, res.error);
    return { result: formatCompactActionResult(`${action} ${ref}`, res.data), isError: false };
  }
}

export const agentDesktopController = new AgentDesktopController();
