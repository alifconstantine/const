import assert from "node:assert/strict";
import { test } from "node:test";
import { attachFileMutation, latestTodoState } from "./activity-state";
import { serializeAssistantTranscript } from "./assistant-transcript";
import { normalizeUiMessages } from "./conversation-store";
import { createRemoteSessionState, updateRemoteSessionState } from "../../electron/remote-session-state";
import type { TraceStep, FileMutationRecord } from "../vite-env";

const plan = [{ content: "Implement", status: "in_progress" }, { content: "Verify", status: "pending" }];

test("saved, rejoined and continued plans keep committed state despite a later failed raw Todo call", () => {
  const live = createRemoteSessionState([{ role: "user", content: "Build" }], "run");
  updateRemoteSessionState(live, { type: "tool_call", toolCallId: "plan", toolName: "todo_write", args: { todos: plan } });
  updateRemoteSessionState(live, { type: "todo_update", toolCallId: "plan", todos: plan });
  updateRemoteSessionState(live, { type: "tool_result", toolCallId: "plan", result: "Updated", isError: false });
  updateRemoteSessionState(live, { type: "tool_call", toolCallId: "bad", toolName: "todo_write", args: { todos: { bad: true } } });
  updateRemoteSessionState(live, { type: "tool_result", toolCallId: "bad", result: "Rejected", isError: true });
  // Malformed events must also leave canonical state unchanged.
  updateRemoteSessionState(live, { type: "todo_update", todos: [null] });
  const saved = normalizeUiMessages(JSON.parse(JSON.stringify(live.messages)));
  assert.deepEqual(latestTodoState(saved), plan);
  assert.deepEqual(saved.at(-1).traceSteps.find((s: any) => s.id === "plan").args.todos, plan);
  assert.equal(saved.at(-1).traceSteps.find((s: any) => s.id === "bad").isError, true);
  const outgoing = saved.flatMap((m: any) => m.role === "assistant" ? serializeAssistantTranscript(m) : [m]);
  assert.deepEqual(latestTodoState(outgoing), plan);
  const restored = normalizeUiMessages(outgoing);
  assert.deepEqual(latestTodoState(restored), plan);
  const rejoined = createRemoteSessionState(restored, "next-run");
  assert.deepEqual(rejoined.todos, plan);
  assert.deepEqual(latestTodoState(rejoined.messages), plan);
});

test("clear survives reload/continue and conversation switching without reviving old trace arguments", () => {
  const first = createRemoteSessionState([{ role: "assistant", content: "Before", todos: plan }], "one");
  const other = createRemoteSessionState([{ role: "assistant", content: "Other", todos: [{ content: "Other task", status: "pending" }] }], "two");
  updateRemoteSessionState(first, { type: "todo_update", todos: [] });
  assert.deepEqual(latestTodoState(first.messages), []);
  assert.equal(latestTodoState(other.messages)?.[0]?.content, "Other task");
  const reload = createRemoteSessionState(JSON.parse(JSON.stringify(first.messages)), "three");
  assert.deepEqual(reload.todos, []);
  const outgoing = reload.messages.flatMap(m => m.role === "assistant" ? serializeAssistantTranscript(m) : [m]);
  assert.deepEqual(latestTodoState(outgoing), []);
});

test("a file mutation belongs to the emitting file call, never Todo or every unmatched write", () => {
  const steps: TraceStep[] = [
    { id: "todo", type: "tool", name: "todo_write" },
    { id: "write-one", type: "tool", name: "write" },
    { id: "write-two", type: "tool", name: "edit_file" },
  ];
  const record = { id: "change", filePath: "/workspace/a.txt" } as FileMutationRecord;
  const linked = attachFileMutation(steps, record, "write-one");
  assert.equal(steps[1]!.mutation, undefined);
  assert.deepEqual(linked.filter(s => s.mutation).map(s => s.id), ["write-one"]);
  assert.deepEqual(attachFileMutation(steps, record, "todo"), steps);
  assert.deepEqual(attachFileMutation(steps, record, "unknown"), steps);
  assert.deepEqual(attachFileMutation(steps, record).filter(s => s.mutation).map(s => s.id), ["write-two"]);
  const live = createRemoteSessionState([{ role: "user", content: "Build" }], "run");
  for (const step of steps) updateRemoteSessionState(live, { type: "tool_call", toolCallId: step.id, toolName: step.name });
  updateRemoteSessionState(live, { type: "file_mutation", toolCallId: "write-one", record });
  assert.deepEqual(live.messages.at(-1).traceSteps.filter((s: any) => s.mutation).map((s: any) => s.id), ["write-one"]);
});

test("legacy fallback ignores pending/failed/malformed calls and keeps clear as a valid successful update", () => {
  const history = [{ role: "assistant", traceSteps: [
    { name: "todo_write", args: { todos: plan }, isError: false },
    { name: "todo_write", args: { todos: [null] }, isError: true },
  ] }];
  assert.deepEqual(latestTodoState(history), plan);
  assert.equal(latestTodoState([{ role: "assistant", traceSteps: [{ name: "todo_write", args: { todos: plan } }] }]), undefined);
  assert.deepEqual(latestTodoState([...history, { role: "assistant", toolCalls: [{ name: "todo_write", args: { todos: [] }, isError: false }] }]), []);
});
