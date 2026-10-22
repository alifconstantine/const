import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { BridgeRequest, BridgeResponse } from "./computer-types";
import { DesktopScriptServeChannel } from "./desktop-script-serve-channel";

const REQUEST_TIMEOUT_MS = 30_000;
const IDLE_SHUTDOWN_MS = 120_000;

interface PendingRequest {
  id: number;
  resolve: (response: BridgeResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class DesktopScriptRuntimeHost {
  private channel: DesktopScriptServeChannel | null = null;
  private child: ChildProcess | null = null;
  private childReady = false;
  private pending = new Map<number, PendingRequest>();
  private queue: Array<() => void> = [];
  private isProcessingQueue = false;
  private idleTimer: NodeJS.Timeout | null = null;
  private nextRequestId = 1;
  private disposed = false;

  constructor(private readonly scriptPath: string) {}

  public async request(request: BridgeRequest): Promise<BridgeResponse> {
    if (this.disposed) {
      throw new Error("Runtime host disposed");
    }
    this.clearIdleTimer();
    return new Promise<BridgeResponse>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await this.ensureReady();
          const id = this.nextRequestId++;
          const payload = JSON.stringify({ ...request, requestId: id }) + "\n";

          const timer = setTimeout(() => {
            this.pending.delete(id);
            reject(new Error(`Computer action timed out after ${REQUEST_TIMEOUT_MS}ms`));
            this.armIdleTimer();
          }, REQUEST_TIMEOUT_MS);

          this.pending.set(id, { id, resolve, reject, timer });

          this.channel?.write(payload, (err) => {
            clearTimeout(timer);
            this.pending.delete(id);
            reject(err);
            this.armIdleTimer();
          });
        } catch (err: any) {
          reject(err);
          this.armIdleTimer();
        }
      });
      this.drainQueue();
    });
  }

  public dispose(): void {
    this.disposed = true;
    this.clearIdleTimer();
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error("Desktop script runtime disposed"));
    }
    this.pending.clear();
    this.queue = [];
    this.channel?.stop();
    this.channel = null;
    this.child = null;
    this.childReady = false;
  }

  private drainQueue(): void {
    if (this.isProcessingQueue || this.queue.length === 0) return;
    this.isProcessingQueue = true;
    const task = this.queue.shift();
    if (task) {
      Promise.resolve(task()).finally(() => {
        this.isProcessingQueue = false;
        this.drainQueue();
      });
    } else {
      this.isProcessingQueue = false;
    }
  }

  private async ensureReady(): Promise<void> {
    if (this.channel && this.childReady) {
      return;
    }
    return new Promise<void>((resolve, reject) => {
      try {
        const platform = process.platform;
        let command = "";
        let args: string[] = [];

        if (platform === "win32") {
          const sysRoot = process.env.SystemRoot || process.env.windir || "C:\\Windows";
          command = path.join(sysRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
          args = [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            this.scriptPath,
            "-Serve",
          ];
        } else if (platform === "darwin") {
          command = this.scriptPath;
          args = ["-Serve"];
        } else {
          command = "python3";
          args = [this.scriptPath, "-Serve"];
        }

        const child = spawn(command, args, {
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: "1",
          },
        });

        this.child = child;

        const startTimer = setTimeout(() => {
          if (!this.childReady) {
            this.channel?.stop();
            reject(new Error("Timeout waiting for computer use native runtime handshake"));
          }
        }, 15_000);

        this.channel = new DesktopScriptServeChannel(child, {
          onLine: (line) => {
            try {
              const data = JSON.parse(line);
              if (data.ready) {
                this.childReady = true;
                clearTimeout(startTimer);
                resolve();
                return;
              }
              const id = typeof data.requestId === "number" ? data.requestId : null;
              if (id !== null && this.pending.has(id)) {
                const req = this.pending.get(id)!;
                clearTimeout(req.timer);
                this.pending.delete(id);
                req.resolve(data);
                this.armIdleTimer();
              }
            } catch (e) {
              console.error("[ComputerHost] Failed to parse output line:", line, e);
            }
          },
          onGone: (detail) => {
            clearTimeout(startTimer);
            this.childReady = false;
            this.channel = null;
            this.child = null;
            for (const [, req] of this.pending) {
              clearTimeout(req.timer);
              req.reject(new Error(`Computer runtime process exited: ${detail}`));
            }
            this.pending.clear();
          },
        });
      } catch (err: any) {
        reject(err);
      }
    });
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private armIdleTimer(): void {
    this.clearIdleTimer();
    if (this.pending.size === 0 && this.queue.length === 0) {
      this.idleTimer = setTimeout(() => {
        if (this.pending.size === 0 && this.queue.length === 0) {
          this.channel?.stop();
          this.channel = null;
          this.child = null;
          this.childReady = false;
        }
      }, IDLE_SHUTDOWN_MS);
    }
  }
}
