import assert from "node:assert/strict";
import { test } from "node:test";
import { createRemoteSessionState, updateRemoteSessionState } from "./remote-session-state";

test("joining a running session preserves resets, long output, thinking and every tool result", () => {
  const history = [{ id: "user", role: "user", content: "Audit" }, { id: "placeholder", role: "assistant", content: "" }];
  const live = createRemoteSessionState(history, "run");
  updateRemoteSessionState(live, { type: "token", token: "An obsolete draft that is longer than the next response" });
  updateRemoteSessionState(live, { type: "token_reset" });
  updateRemoteSessionState(live, { type: "thinking", thinking: "Inspecting the host" });
  for (let i = 0; i < 25; i++) {
    updateRemoteSessionState(live, { type: "tool_call", toolCallId: `call-${i}`, toolName: "read_file", args: { file: `file-${i}` } });
    updateRemoteSessionState(live, { type: "tool_result", toolCallId: `call-${i}`, result: `output-${i}`, durationMs: 42 });
  }
  updateRemoteSessionState(live, { type: "token", token: "OK" });
  const response = live.messages.at(-1);
  assert.equal(response.id, "placeholder");
  assert.equal(response.content, "OK");
  assert.equal(response.thinking, "Inspecting the host");
  assert.equal(response.toolCalls.length, 25);
  assert.equal(response.traceSteps.find((step: any) => step.toolCallId === "call-0").result, "output-0");
  assert.equal(history.at(-1)?.content, "");
  updateRemoteSessionState(live, { type: "token", token: "x".repeat(90_000) });
  assert.equal(response.content.length, 90_002);
});

test("steering creates a new turn and snapshot captures todos, questions, approval and mutations", () => {
  const live = createRemoteSessionState([{ role: "user", content: "Start" }], "run");
  updateRemoteSessionState(live, { type: "token", token: "First turn" });
  updateRemoteSessionState(live, { type: "steer_message", message: { id: "steer", content: "Change direction", sourceSideChatId: "side_chat_one" } });
  updateRemoteSessionState(live, { type: "tool_call", toolCallId: "edit", toolName: "edit_file" });
  updateRemoteSessionState(live, { type: "file_mutation", record: { filePath: "/workspace/a.ts" } });
  updateRemoteSessionState(live, { type: "todo_update", todos: [{ content: "Verify", status: "in_progress" }] });
  updateRemoteSessionState(live, { type: "ask_question", toolCallId: "question", questions: [{ question: "Which?" }] });
  updateRemoteSessionState(live, { type: "approval_request", approvalId: "approval" });
  assert.equal(live.messages[1].content, "First turn");
  assert.equal(live.messages[2].sourceSideChatId, "side_chat_one");
  assert.equal(live.messages[3].content, "");
  assert.equal(live.messages[3].mutations.length, 1);
  assert.equal(live.messages[3].traceSteps[0].mutation.filePath, "/workspace/a.ts");
  assert.equal(live.questions.toolCallId, "question");
  assert.equal(live.approval.approvalId, "approval");
  assert.equal(live.todos?.length, 1);
  updateRemoteSessionState(live, { type: "tool_result", toolName: "ask_question", toolCallId: "question", result: "A" });
  updateRemoteSessionState(live, { type: "approval_resolved" });
  updateRemoteSessionState(live, { type: "done", fullContent: "Final answer" });
  assert.equal(live.questions, undefined);
  assert.equal(live.approval, undefined);
  assert.equal(live.messages[3].content, "Final answer");
});
