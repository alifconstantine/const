import type { BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { RendererHealthSample } from "../src/lib/renderer-health";

export interface RendererHealthOptions {
  logFile: string;
  metrics: () => unknown;
  recover: (reason: "crashed" | "unresponsive", signal: AbortSignal) => Promise<void>;
  sampleIntervalMs?: number;
  unresponsiveDelayMs?: number;
}

/** Main-process diagnostics survive renderer failure; recovery never restarts
 * an agent or automatically replays the same crashing transcript. */
export function monitorMainRenderer(window: BrowserWindow, options: RendererHealthOptions) {
  const contents = window.webContents;
  let stopped = false;
  let lastHeartbeatAt: number | undefined;
  let lastSample: RendererHealthSample | undefined;
  let writeQueue = Promise.resolve();
  let pendingWrites = 0;
  let recovery: { reason: string; controller: AbortController } | undefined;
  let unresponsiveNotified = false;
  let crashNotified = false;
  let unresponsiveTimer: ReturnType<typeof setTimeout> | undefined;
  const record = (event: string, details: Record<string, unknown> = {}) => {
    if (stopped || pendingWrites >= 8) return;
    let metrics: unknown;
    try { metrics = options.metrics(); } catch { metrics = undefined; }
    const row = { timestamp: new Date().toISOString(), event, contentsId: contents.id,
      pid: contents.isDestroyed() ? 0 : contents.getOSProcessId(), lastHeartbeatAt,
      renderer: lastSample, metrics, ...details };
    pendingWrites++;
    writeQueue = writeQueue.then(async () => {
      await fs.mkdir(path.dirname(options.logFile), { recursive: true });
      const size = await fs.stat(options.logFile).then(stat => stat.size).catch(() => 0);
      if (size > 1_048_576) {
        await fs.rm(`${options.logFile}.1`, { force: true });
        await fs.rename(options.logFile, `${options.logFile}.1`);
      }
      await fs.appendFile(options.logFile, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    }).catch(() => {}).finally(() => { pendingWrites--; });
  };
  const requestRecovery = (reason: "crashed" | "unresponsive") => {
    if (stopped) return;
    if (recovery) {
      if (reason !== "crashed" || recovery.reason === "crashed") return;
      recovery.controller.abort();
    }
    const current = { reason, controller: new AbortController() };
    recovery = current;
    void options.recover(reason, current.controller.signal).catch(() => {}).finally(() => {
      if (recovery === current) recovery = undefined;
    });
  };
  const gone = (_event: unknown, details: { reason: string; exitCode: number }) => {
    if (unresponsiveTimer) clearTimeout(unresponsiveTimer);
    record("render-process-gone", { reason: details.reason, exitCode: details.exitCode });
    if (details.reason !== "clean-exit" && !crashNotified) {
      crashNotified = true;
      requestRecovery("crashed");
    }
  };
  const unresponsive = () => {
    record("unresponsive");
    if (!unresponsiveTimer && !unresponsiveNotified) unresponsiveTimer = setTimeout(() => {
      unresponsiveTimer = undefined;
      unresponsiveNotified = true;
      requestRecovery("unresponsive");
    }, options.unresponsiveDelayMs ?? 10_000);
  };
  const responsive = () => {
    if (unresponsiveTimer) clearTimeout(unresponsiveTimer);
    unresponsiveTimer = undefined;
    unresponsiveNotified = false;
    if (recovery?.reason === "unresponsive") recovery.controller.abort();
    record("responsive");
  };
  const loaded = () => {
    unresponsiveNotified = false;
    crashNotified = false;
    recovery?.controller.abort();
    record("loaded");
  };
  contents.on("render-process-gone", gone);
  contents.on("did-finish-load", loaded);
  window.on("unresponsive", unresponsive);
  window.on("responsive", responsive);
  const timer = setInterval(() => record("sample"), options.sampleIntervalMs ?? 30_000);
  timer.unref();
  const stop = () => {
    stopped = true;
    clearInterval(timer);
    if (unresponsiveTimer) clearTimeout(unresponsiveTimer);
    recovery?.controller.abort();
    contents.removeListener("render-process-gone", gone);
    contents.removeListener("did-finish-load", loaded);
    window.removeListener("unresponsive", unresponsive);
    window.removeListener("responsive", responsive);
  };
  window.once("closed", stop);
  record("attached");
  return {
    heartbeat(value: unknown) {
      if (stopped || !value || typeof value !== "object") return;
      const input = value as Record<string, unknown>;
      const number = (key: string) => typeof input[key] === "number" && Number.isFinite(input[key])
        ? Math.max(0, Math.min(1e12, Math.round(input[key] as number))) : 0;
      lastHeartbeatAt = Date.now();
      lastSample = { heapBytes: number("heapBytes"), nodes: number("nodes"), longTasks: number("longTasks"), longestTaskMs: number("longestTaskMs") };
      return lastSample;
    },
    stop,
    flushed: () => writeQueue,
  };
}
