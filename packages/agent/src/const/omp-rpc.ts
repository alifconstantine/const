import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { killProcessTree } from "./tools.js";

export type OmpFrame = Record<string, unknown> & { type: string };

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// OMP reserves these names in its registry even when its built-ins are inactive.
const reservedNames = new Set(["read", "write", "edit", "bash", "find", "grep", "task", "wait",
  "lsp", "ast_grep", "ast_edit", "web_search", "checkpoint", "think", "retain", "recall", "reflect", "eval"]);

export function ompToolName(name: string): string {
  return reservedNames.has(name) ? `harness_${name}` : name;
}

export function harnessToolName(name: string): string {
  const candidate = name.slice("harness_".length);
  return name.startsWith("harness_") && reservedNames.has(candidate) ? candidate : name;
}

const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_MESSAGE_BYTES = 64 * MAX_FRAME_BYTES;
const MAX_CHUNK_BYTES = 256 * 1024;
const COMMAND_TIMEOUT_MS = 30_000;

class ChunkDecoder {
  private pending?: { id: string; count: number; total: number; bytes: number; parts: Buffer[] };

  decode(value: unknown): OmpFrame | undefined {
    const frame = record(value);
    if (typeof frame.type !== "string") throw new Error("Invalid oh-my-pi RPC frame.");
    if (frame.type !== "rpc_chunk") {
      if (this.pending) throw new Error("Interrupted oh-my-pi RPC message.");
      return frame as OmpFrame;
    }

    const { chunkId, count, index, byteLength, data } = frame;
    if (typeof chunkId !== "string" || typeof count !== "number" || typeof index !== "number" ||
        typeof byteLength !== "number" || typeof data !== "string" || !Number.isSafeInteger(count) ||
        !Number.isSafeInteger(index) || !Number.isSafeInteger(byteLength) ||
        count < 2 || count > MAX_MESSAGE_BYTES / MAX_CHUNK_BYTES || index < 0 || index >= count ||
        byteLength <= MAX_FRAME_BYTES || byteLength > MAX_MESSAGE_BYTES) {
      throw new Error("Invalid oh-my-pi RPC chunk.");
    }
    this.pending ??= { id: chunkId, count, total: byteLength, bytes: 0, parts: [] };
    const pending = this.pending;
    if (pending.id !== chunkId || pending.count !== count || pending.total !== byteLength || pending.parts.length !== index) {
      throw new Error("Out-of-order oh-my-pi RPC chunk.");
    }
    const part = Buffer.from(data, "base64");
    if (!part.length || part.length > MAX_CHUNK_BYTES || part.toString("base64") !== data) {
      throw new Error("Invalid oh-my-pi RPC chunk data.");
    }
    pending.parts.push(part);
    pending.bytes += part.length;
    if (pending.bytes > pending.total) throw new Error("Oversized oh-my-pi RPC message.");
    if (pending.parts.length < pending.count) return;
    if (pending.bytes !== pending.total) throw new Error("Incomplete oh-my-pi RPC message.");
    this.pending = undefined;
    return this.decode(JSON.parse(Buffer.concat(pending.parts).toString("utf8")));
  }
}

export class OmpRpc {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly exited: Promise<void>;
  private readonly waiting = new Map<string, (error: Error | undefined, frame?: OmpFrame) => void>();
  private nextId = 0;
  private closed = false;
  private stopping = false;

  constructor(
    executable: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv },
    receive: (frame: OmpFrame) => void,
    onFailure: (error: Error) => void,
  ) {
    this.child = spawn(executable, args, {
      ...options, stdio: "pipe", windowsHide: true, detached: process.platform !== "win32",
    });
    const fail = (error: Error) => {
      if (this.closed || this.stopping) return;
      this.closed = true;
      for (const settle of this.waiting.values()) settle(error);
      onFailure(error);
    };
    this.child.on("error", error => fail(new Error(`Could not start oh-my-pi (${(error as NodeJS.ErrnoException).code ?? "spawn failed"}).`)));
    this.child.stdin.on("error", () => fail(new Error("oh-my-pi RPC input closed.")));
    // The worker's stderr can include provider response text. Consume it without copying it to app logs.
    this.child.stderr.resume();
    this.exited = new Promise(resolve => {
      this.child.once("close", (code, signal) => {
        fail(new Error(`oh-my-pi exited before completing the run (${signal ?? code ?? "unknown"}).`));
        resolve();
      });
    });
    const decoder = new ChunkDecoder();
    createInterface({ input: this.child.stdout, crlfDelay: Infinity }).on("line", line => {
      if (this.closed || !line.trim()) return;
      try {
        if (Buffer.byteLength(line) > MAX_FRAME_BYTES) throw new Error("Oversized oh-my-pi RPC frame.");
        const frame = decoder.decode(JSON.parse(line));
        if (!frame) return;
        if (frame.type === "response" && typeof frame.id === "string") {
          this.waiting.get(frame.id)?.(undefined, frame);
        }
        receive(frame);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  send(frame: OmpFrame): void {
    if (this.closed || this.stopping) return;
    this.child.stdin.write(JSON.stringify(frame) + "\n");
  }

  request(type: string, fields: Record<string, unknown> = {}, id = `request-${++this.nextId}`): Promise<Record<string, unknown>> {
    if (this.closed || this.stopping) return Promise.reject(new Error("oh-my-pi RPC is closed."));
    return new Promise((resolve, reject) => {
      const settle = (error: Error | undefined, frame?: OmpFrame) => {
        this.waiting.delete(id);
        clearTimeout(timer);
        if (error) reject(error);
        else if (frame?.success !== true) reject(new Error(typeof frame?.error === "string" ? frame.error : `oh-my-pi rejected ${type}.`));
        else resolve(record(frame.data));
      };
      const timer = setTimeout(() => settle(new Error(`oh-my-pi RPC timed out during ${type}.`)), COMMAND_TIMEOUT_MS);
      this.waiting.set(id, settle);
      this.send({ ...fields, type, id });
    });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    for (const settle of this.waiting.values()) settle(new Error("oh-my-pi RPC stopped."));
    this.child.stdin.end();
    const pid = this.child.pid;
    const timer = setTimeout(() => {
      if (pid && this.child.exitCode === null && this.child.signalCode === null) killProcessTree(pid);
    }, 1500);
    try {
      await this.exited;
    } finally {
      clearTimeout(timer);
    }
  }
}
