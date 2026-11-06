import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TodoTracker } from "../src/const/todo-tracker.js";
import { latestTodoState, parseTodoItems } from "../src/const/todo-state.js";
import { executeNativeTool } from "../src/const/tools.js";
import { createConstAgent } from "../src/const/const-agent.js";

const plan = [{ content: "Build", status: "in_progress" as const }, { content: "Verify", status: "pending" as const }];
afterEach(() => vi.unstubAllGlobals());

describe("canonical todo lifecycle", () => {
  it("restores only committed, validated state, including an explicit clear", () => {
    const history = [{ role: "assistant", todos: plan }, { role: "assistant", traceSteps: [
      { name: "todo_write", args: { todos: { bad: true } }, isError: true },
      { name: "todo_write", args: { todos: [] } },
    ] }];
    expect(latestTodoState(history)).toEqual(plan);
    expect(latestTodoState([...history, { role: "assistant", todos: [] }])).toEqual([]);
    expect(latestTodoState([{ role: "assistant", traceSteps: [{ name: "todo_write", args: { todos: plan }, isError: false }] }])).toEqual(plan);
    expect(parseTodoItems([null])).toBeUndefined();
    expect(parseTodoItems([{ content: "Bad", status: "fictional" }])).toBeUndefined();
    expect(parseTodoItems([{ task: "Legacy alias" }])).toEqual([{ content: "Legacy alias", status: "pending" }]);
  });

  it("invalid writes preserve the previous plan; callers cannot mutate tracker state", async () => {
    const tracker = new TodoTracker();
    const updates: unknown[] = [];
    const options = { onTodoUpdate: (items: any) => { tracker.commit(items); updates.push(items); } };
    expect((await executeNativeTool("todo_write", { todos: plan }, process.cwd(), options)).isError).toBe(false);
    for (const todos of [undefined, { content: "not-array" }, [null], [{ content: "" }], [{ content: "Bad", status: "made-up" }]]) {
      expect((await executeNativeTool("todo_write", { todos }, process.cwd(), options)).isError).toBe(true);
      expect(tracker.snapshot()).toEqual(plan);
    }
    expect(updates).toHaveLength(1);
    const snapshot = tracker.snapshot()!; snapshot[0]!.content = "changed externally";
    expect(tracker.snapshot()).toEqual(plan);
    await executeNativeTool("todo_write", { todos: [] }, process.cwd(), options);
    expect(tracker.snapshot()).toEqual([]);
  });

  it("bounds reminders while retaining open work and respecting user handoffs", () => {
    const tracker = new TodoTracker([{ role: "assistant", todos: plan }]);
    for (let round = 0; round < 3; round++) {
      for (let index = 0; index < 12; index++) tracker.record("bash", index % 2 === 0);
      expect(Boolean(tracker.midRunReminder())).toBe(round < 2);
    }
    expect(tracker.completionReminder("Please provide the missing source.")).toBeUndefined();
    expect(tracker.completionReminder("Bisa kirim HTML-nya?")).toBeUndefined();
    expect(tracker.completionReminder("Waiting.", true)).toBeUndefined();
    expect(tracker.completionReminder("Done.")).toContain("keep unfinished items open");
    expect(tracker.completionReminder("Done again.")).toBeUndefined();
    expect(tracker.snapshot()).toEqual(plan);
    tracker.resetCycle();
    tracker.commit([]);
    expect(tracker.completionReminder("Done.")).toBeUndefined();
  });
});

function stream(delta: object, finishReason = "tool_calls") {
  return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: finishReason }] })}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });
}
function call(id: number, name: string, args: object) {
  return { tool_calls: [{ index: 0, id: `call-${id}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] };
}

it("real agent restores and persists Todo, reviews stale work twice and reconciles final once without fake completion", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "const-todo-runtime-"));
  const events: any[] = [], requests: any[] = [];
  let turn = 0;
  const completed = plan.map(item => ({ ...item, status: "completed" }));
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body))); turn++;
    if (turn <= 24) return stream(call(turn, "write", { path: "artifact.txt", content: `revision ${turn}` }));
    if (turn === 25) return stream({ content: "The work is ready." }, "stop");
    if (turn === 26) return stream(call(turn, "todo_write", { todos: completed }));
    return stream({ content: "Build and verification finished." }, "stop");
  }));
  try {
    const agent = createConstAgent({ model: "fixture", baseUrl: "http://fixture.invalid/v1", apiKey: "private-fixture-key", workspacePath: cwd, mode: "full_access", maxTurns: 35, thinkingLevel: "low" });
    const history = await agent.run([{ role: "assistant", content: "Prior work", todos: plan }, { role: "user", content: "Continue the authorized work." }], event => events.push(event));
    expect(turn).toBe(27);
    expect(events.filter(e => e.type === "progress_checkpoint" && e.kind === "todo_stale")).toHaveLength(2);
    expect(events.filter(e => e.type === "progress_checkpoint" && e.kind === "todo_reconcile")).toHaveLength(1);
    expect(events.filter(e => e.type === "todo_update").map(e => e.todos)).toEqual([plan, completed]);
    expect(latestTodoState(history)).toEqual(completed);
    expect(events.find(e => e.type === "file_mutation").toolCallId).toBe("call-1");
    expect(requests.some(r => r.messages.some((m: any) => m.content?.includes?.("RUNTIME PLAN REVIEW")))).toBe(true);
    expect(history.some(m => typeof m.content === "string" && m.content.includes("RUNTIME PLAN REVIEW"))).toBe(false);
    const diagnostics = events.find(e => e.type === "llm_request" && e.phase === "started").diagnostics;
    expect(diagnostics.thinkingLevel).toBe("low");
    expect(diagnostics.maxOutputTokens).toBeGreaterThan(0);
    expect(diagnostics.toolNames).toContain("todo_write");
    expect(JSON.stringify(diagnostics)).not.toContain("private-fixture-key");
    expect(requests.every(r => r.messages.every((m: any) => !("todos" in m) && !("isError" in m)))).toBe(true);
    expect(events.at(-1).outcome).toBe("completed");
  } finally { await fs.rm(cwd, { recursive: true, force: true }); }
});

it("does not add reconciliation requests when asking for a missing reference or after cancellation", async () => {
  let requests = 0;
  vi.stubGlobal("fetch", vi.fn(async () => { requests++; return stream({ content: "Mohon kirim sumber HTML yang belum tersedia." }, "stop"); }));
  const config = { model: "fixture", baseUrl: "http://fixture.invalid/v1", apiKey: "", workspacePath: os.tmpdir(), mode: "full_access" as const };
  await createConstAgent(config).run([{ role: "assistant", content: "Previous", todos: plan }, { role: "user", content: "Continue." }], () => {});
  expect(requests).toBe(1);
  const events: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async () => { requests++; return stream(call(1, "todo_write", { todos: plan })); }));
  const agent = createConstAgent(config);
  await agent.run([{ role: "user", content: "Build." }], event => { events.push(event); if (event.type === "todo_update") agent.abort("shutdown"); });
  expect(requests).toBe(2);
  expect(events.at(-1).outcome).toBe("cancelled");
  expect(events.at(-1).cancelSource).toBe("shutdown");
  expect(events.some(e => e.kind === "todo_reconcile")).toBe(false);
});
