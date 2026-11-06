import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createConstAgent } from "../src/const/const-agent.js";
import { RunProgress, toolArgumentSignature } from "../src/const/run-progress.js";

describe("run progress checkpoints", () => {
  it("recognizes interleaved repeated results despite argument key ordering", () => {
    const progress = new RunProgress();
    for (let index = 0; index < 3; index++) {
      progress.record("read", index % 2 ? { limit: 10, path: "a" } : { path: "a", limit: 10 }, "same", false);
      progress.record("ls", { path: `other-${index}` }, `other-${index}`, false);
    }
    expect(progress.checkpoint(7)).toEqual({ kind: "repeated_result", turn: 7, toolName: "read", count: 3 });
    expect(progress.checkpoint(8)).toBeUndefined();
  });

  it("does not mistake changing results, successful edits or explicit waits for a loop", () => {
    const progress = new RunProgress();
    for (let index = 0; index < 4; index++) progress.record("read", { path: "a" }, `version-${index}`, false);
    expect(progress.checkpoint(4)).toBeUndefined();
    progress.record("read", { path: "a" }, "version-3", false);
    progress.record("apply_patch", { patch: "changed" }, "saved", false);
    progress.record("read", { path: "a" }, "version-3", false);
    for (let index = 0; index < 5; index++) progress.record("agent_status", { id: "job" }, "running", false);
    expect(progress.checkpoint(10)).toBeUndefined();
  });

  it("clears stale loop warnings when the user steers the task", () => {
    const progress = new RunProgress();
    for (let index = 0; index < 3; index++) progress.record("bash", { command: "check" }, "failed", true);
    progress.reset();
    expect(progress.checkpoint(4)).toBeUndefined();
  });

  it("reviews long runs periodically without stopping later work", () => {
    const progress = new RunProgress(3);
    expect(progress.checkpoint(2)).toBeUndefined();
    expect(progress.checkpoint(3)).toEqual({ kind: "review", turn: 3 });
    expect(progress.checkpoint(4)).toBeUndefined();
    progress.record("read", { path: "remaining" }, "next work", false);
    expect(progress.checkpoint(6)?.kind).toBe("review");
  });

  it("preserves semantic argument differences while using bounded digests", () => {
    expect(toolArgumentSignature({ path: "a", options: { b: 1, a: 2 } })).toBe(toolArgumentSignature({ options: { a: 2, b: 1 }, path: "a" }));
    expect(toolArgumentSignature({ path: "a", _intent: "x" })).not.toBe(toolArgumentSignature({ path: "a", _intent: "y" }));
    expect(toolArgumentSignature({ content: "x".repeat(100_000) })).toHaveLength(64);
  });

  it("sends progress notices only as request context and still lets a long agent run finish", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "const-progress-"));
    const events: Array<{ type: string; [key: string]: unknown }> = [];
    const requests: Array<{ messages: Array<{ role: string; content: unknown }> }> = [];
    let calls = 0;
    try {
      await fs.writeFile(path.join(dir, "a.txt"), "a");
      await fs.writeFile(path.join(dir, "b.txt"), "b");
      vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)); requests.push(body);
        const index = calls++;
        const delta = index < 21 ? { tool_calls: [{ index: 0, id: `call-${index}`, type: "function", function: { name: "read", arguments: JSON.stringify({ path: index % 2 ? "a.txt" : "b.txt" }) } }] } : { content: "Both files inspected." };
        return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: index < 21 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });
      }));
      const agent = createConstAgent({ baseUrl: "http://fixture.invalid/v1", apiKey: "fixture", model: "fixture", workspacePath: dir, mode: "full_access", maxTurns: 30 });
      const history = await agent.run([{ role: "user", content: "Inspect both files and report.", timestamp: Date.now() }], event => events.push(event));
      expect(events.some(event => event.type === "progress_checkpoint" && event.kind === "repeated_result")).toBe(true);
      expect(events.some(event => event.type === "progress_checkpoint" && event.turn === 20)).toBe(true);
      expect(requests.some(request => request.messages.slice(1).some(message => message.role === "system"))).toBe(true);
      expect(history.filter(message => message.role === "system")).toHaveLength(0);
      expect(history.filter(message => message.role === "user")).toHaveLength(1);
      expect(history.at(-1)?.content).toBe("Both files inspected.");
      expect(events.find(event => event.type === "run_end")?.outcome).toBe("completed");
      expect(calls).toBe(22);
    } finally { vi.unstubAllGlobals(); await fs.rm(dir, { recursive: true, force: true }); }
  });
});
