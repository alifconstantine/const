import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { BridgeRequest, BridgeResponse } from "./computer-types";
import { DesktopScriptServeChannel } from "./desktop-script-serve-channel";
import { DesktopRequestQueue } from "./desktop-request-queue";
import { encodeMacRequest, decodeMacResponse } from "./macos-runtime-protocol";

interface RuntimeHostOptions {
  platform?: NodeJS.Platform;
  spawn?: typeof spawn;
  requestTimeoutMs?: number;
  startupTimeoutMs?: number;
  idleTimeoutMs?: number;
}

export class DesktopScriptRuntimeHost {
  private channel: DesktopScriptServeChannel | null = null;
  private child: ChildProcess | null = null;
  private childReady = false;
  private pending: { id: number; request: BridgeRequest; resolve: (response: BridgeResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private startup: { reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private nextRequestId = 1;
  private disposed = false;
  private readonly queue: DesktopRequestQueue;

  constructor(private readonly scriptPath: string, private readonly options: RuntimeHostOptions = {}) {
    this.queue = new DesktopRequestQueue(options.requestTimeoutMs ?? 30_000, () => this.armIdleTimer());
  }

  request(request: BridgeRequest): Promise<BridgeResponse> {
    if (this.disposed) return Promise.reject(new Error("Computer runtime disposed"));
    this.clearIdleTimer();
    return this.queue.enqueue(async () => {
      if (this.disposed) throw new Error("Computer runtime disposed");
      await this.ensureReady();
      const channel = this.channel!;
      const id = this.nextRequestId++;
      const identifiedRequest = { ...request, requestId: id };
      const payload = (this.options.platform ?? process.platform) === "darwin" ? encodeMacRequest(identifiedRequest) : identifiedRequest;
      return new Promise<BridgeResponse>((resolve, reject) => {
        const timer = setTimeout(() => this.abort(new Error(
          "computer_action_timeout: input may already have been delivered; inspect fresh app state before deciding whether to retry"
        )), this.options.requestTimeoutMs ?? 30_000);
        this.pending = { id, request: identifiedRequest, resolve, reject, timer };
        channel.write(JSON.stringify(payload) + "\n", error => {
          if (this.channel === channel && this.pending?.id === id) this.abort(error);
        });
      });
    });
  }

  dispose(): void {
    this.disposed = true;
    this.clearIdleTimer();
    this.abort(new Error("Computer runtime disposed"));
  }

  private ensureReady(): Promise<void> {
    if (this.channel && this.childReady) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.abort(new Error("Computer runtime startup timed out")), this.options.startupTimeoutMs ?? 15_000);
      this.startup = { reject, timer };
      try {
        const systemRoot = process.env.SystemRoot || process.env.windir || "C:\\Windows";
        const platform = this.options.platform ?? process.platform;
        const command = platform === "win32"
          ? path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
          : platform === "darwin" ? this.scriptPath : "python3";
        const args = platform === "win32"
          ? ["-NoProfile", "-NonInteractive", "-STA", "-File", this.scriptPath, "-Serve"]
          : platform === "darwin" ? ["--stdio-agent", "--parent-pid", String(process.pid)] : [this.scriptPath, "-Serve"];
        const child = (this.options.spawn ?? spawn)(command, args, {
          stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
          env: { ...process.env, PYTHONUNBUFFERED: "1" },
        });
        this.child = child;
        this.channel = new DesktopScriptServeChannel(child, {
          onLine: line => {
            if (this.child !== child) return;
            let data: BridgeResponse & { ready?: boolean };
            try { data = JSON.parse(line); }
            catch { this.abort(new Error("Computer runtime returned invalid JSON")); return; }
            if (data.ready === true && data.requestId === undefined && this.startup) {
              clearTimeout(timer);
              this.startup = null;
              this.childReady = true;
              resolve();
              return;
            }
            if (this.startup && data.ok === false && typeof data.error === "string") {
              this.abort(new Error(`Computer runtime startup failed: ${data.error}`));
              return;
            }
            const pending = this.pending;
            if (platform === "darwin" && pending) {
              try { data = decodeMacResponse(data, pending.request); }
              catch (error) { this.abort(error instanceof Error ? error : new Error(String(error))); return; }
            }
            if (!pending || data.requestId !== pending.id || typeof data.ok !== "boolean") {
              this.abort(new Error("Computer runtime response did not match the pending request"));
              return;
            }
            this.pending = null;
            clearTimeout(pending.timer);
            pending.resolve(data);
          },
          onGone: detail => {
            if (this.child === child) this.abort(new Error(`Computer runtime process exited: ${detail}`));
          },
          onOverflow: () => {
            if (this.child === child) this.abort(new Error("Computer runtime response exceeded the buffer limit"));
          },
        });
      } catch (error) { this.abort(error instanceof Error ? error : new Error(String(error))); }
    });
  }

  private abort(error: Error): void {
    const channel = this.channel;
    this.channel = null;
    this.child = null;
    this.childReady = false;
    channel?.stop();
    if (this.startup) {
      clearTimeout(this.startup.timer);
      this.startup.reject(error);
      this.startup = null;
    }
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = null;
    }
    this.queue.cancelPending(error);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private armIdleTimer(): void {
    this.clearIdleTimer();
    if (this.disposed) return;
    this.idleTimer = setTimeout(() => this.abort(new Error("Computer runtime idle shutdown")), this.options.idleTimeoutMs ?? 120_000);
    this.idleTimer.unref?.();
  }
}
