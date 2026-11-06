import { test } from "node:test";
import assert from "node:assert/strict";
import { agentFailureText, sessionNotification } from "./agent-outcomes";
import { translations } from "../locales";
import { isAgentCancellation, shouldNotifyAgentFailure } from "./agent-errors";

test("only successful runs get a completion message and sound; failed, cancelled and legacy runs do not", () => {
  const t = (key: string) => key;
  const completed = sessionNotification({ conversationId: "one", outcome: "completed" }, t);
  assert.equal(completed?.playSound, true);
  assert.equal(completed?.title, "toast.taskCompleted");
  const failed = sessionNotification({ conversationId: "one", outcome: "failed", errorCategory: "payload" }, t);
  assert.equal(failed?.title, "toast.taskFailed");
  assert.equal(failed?.body, "toast.requestTooLarge");
  assert.equal(failed?.playSound, false);
  assert.equal(sessionNotification({ conversationId: "one", outcome: "cancelled" }, t), undefined);
  assert.equal(sessionNotification({ conversationId: "one" }, t), undefined);
});

test("payload failures use the selected language in notifications and chat, preserving unrelated provider errors", () => {
  for (const dictionary of Object.values(translations)) {
    const t = (key: string) => dictionary.toast[key.split(".")[1] as keyof typeof dictionary.toast];
    const result = { conversationId: "one", outcome: "failed" as const, errorCategory: "payload" as const, error: "FUNCTION_PAYLOAD_TOO_LARGE" };
    assert.equal(sessionNotification(result, t)?.body, dictionary.toast.requestTooLarge);
    assert.equal(agentFailureText(result, t), dictionary.toast.requestTooLarge);
    assert.equal(agentFailureText({ category: "image" }, t), dictionary.toast.imagePreparationFailed);
    assert.equal(agentFailureText({ error: "Bad tool schema", category: "model" }, t), "Bad tool schema");
  }
});

test("an internal transport abort remains a failure while caller cancellation stays quiet", () => {
  const internal = { error: "Internal request aborted", category: "transport" };
  assert.equal(isAgentCancellation(internal), false);
  assert.equal(shouldNotifyAgentFailure(internal), true);
  assert.equal(shouldNotifyAgentFailure({ ...internal, category: "cancelled" }), false);
});
