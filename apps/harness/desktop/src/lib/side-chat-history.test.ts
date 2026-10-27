import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUiMessages } from "./conversation-store";

test("side instructions remain available to the main agent while the transcript uses a compact marker", () => {
  const raw = [{ id: "steer-1", role: "user", sourceSideChatId: "side_conversation_1", content: "Use the existing architecture" }];
  const [message] = normalizeUiMessages(raw);
  assert.equal(message.sideInstruction, "Use the existing architecture");
  assert.notEqual(message.content, message.sideInstruction);
  const [restored] = normalizeUiMessages([message]);
  assert.equal(restored.sideInstruction, "Use the existing architecture");
});

test("normalizing a tool transcript retains the side instruction", () => {
  const messages = normalizeUiMessages([
    { role: "user", sourceSideChatId: "side_conversation_1", content: "Change the plan" },
    { role: "assistant", tool_calls: [{ id: "call", function: { name: "read", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "call", name: "read", content: "result" },
  ]);
  assert.equal(messages[0].sideInstruction, "Change the plan");
  assert.equal(messages[1].traceSteps[0].result, "result");
});
