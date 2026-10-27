import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveConversationHistory } from "./conversation-routing";

test("a background queue reads its own history while another chat is visible", () => {
  const visible = ["B prompt", "B response"];
  const live = ["A prompt", "A partial response"];
  const stored = ["A prompt"];
  const sessions = new Map([["A", live]]);
  assert.deepEqual(resolveConversationHistory("A", "B", visible, sessions, stored), { isVisible: false, history: live });
  sessions.delete("A");
  assert.deepEqual(resolveConversationHistory("A", "B", visible, sessions, stored), { isVisible: false, history: stored });
  assert.deepEqual(resolveConversationHistory("B", "B", visible, sessions), { isVisible: true, history: visible });
});
