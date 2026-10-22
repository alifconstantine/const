import { StringDecoder } from "node:string_decoder";
import type { ChildProcess } from "node:child_process";

const MAX_STDERR_CHARS = 4096;

export interface ServeChannelHandlers {
  onLine: (line: string) => void;
  onGone: (detail: string) => void;
  onOverflow?: () => void;
}

export class DesktopScriptServeChannel {
  private readonly decoder = new StringDecoder("utf8");
  private buffer = "";
  private stderrTail = "";
  private closed = false;

  constructor(
    private readonly child: ChildProcess,
    private readonly handlers: ServeChannelHandlers
  ) {
    const onStdout = (chunk: Buffer | string): void => this.readStdout(chunk);
    const onStderr = (chunk: Buffer | string): void => {
      this.stderrTail = `${this.stderrTail}${chunk.toString()}`.slice(-MAX_STDERR_CHARS);
    };
    const onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
      this.reportGone(signal ? `signal ${signal}` : `code ${code ?? "unknown"}`);
    };
    const onError = (error: Error): void => {
      this.reportGone(error.message);
    };

    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    child.once("close", onClose);
    child.once("error", onError);
    child.stdin?.on("error", () => {});
  }

  write(payload: string, onError: (error: Error) => void): void {
    if (this.closed || !this.child.stdin || this.child.stdin.destroyed) {
      return;
    }
    this.child.stdin.write(payload, (error) => {
      if (error && !this.closed) {
        onError(error);
      }
    });
  }

  stop(): void {
    if (this.closed) return;
    this.closed = true;
    this.buffer = "";
    try {
      this.child.stdin?.end();
    } catch {}
    try {
      this.child.kill();
    } catch {}
  }

  private readStdout(chunk: Buffer | string): void {
    if (this.closed) return;
    this.buffer += typeof chunk === "string" ? chunk : this.decoder.write(chunk);
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trimEnd();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        this.handlers.onLine(line);
      }
      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  private reportGone(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    const detail = this.stderrTail ? `${reason} (stderr: ${this.stderrTail.trim()})` : reason;
    this.handlers.onGone(detail);
  }
}
