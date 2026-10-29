import assert from "node:assert/strict";
import { test } from "node:test";
import { createStreamBatcher } from "./stream-batcher";

test("delta batches preserve text, ordering and structural barriers", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const events: any[] = [];
  const batcher = createStreamBatcher(event => events.push(event));
  for (const token of ["one", " ", "two"]) batcher.forward({ type: "token", token, remoteSequence: events.length });
  assert.equal(events.length, 0);
  t.mock.timers.tick(16);
  assert.equal(events[0].token, "one two");
  batcher.forward({ type: "thinking", thinking: "reason" });
  batcher.forward({ type: "thinking", thinking: "ing" });
  batcher.forward({ type: "tool_call", toolCallId: "tool" });
  batcher.forward({ type: "token", token: "discarded by reset" });
  batcher.forward({ type: "token_reset" });
  batcher.forward({ type: "token", token: "final" });
  batcher.forward({ type: "error", error: "failure" });
  batcher.forward({ type: "done" });
  assert.deepEqual(events.map(event => event.type), ["token", "thinking", "tool_call", "token", "token_reset", "token", "error", "done"]);
  assert.equal(events[1].thinking, "reasoning");
  t.mock.timers.tick(100);
  assert.equal(events.length, 8);
});

test("run and conversation boundaries never merge and final flush delivers the last delta", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const events: any[] = [];
  const batcher = createStreamBatcher(event => events.push(event));
  batcher.forward({ type: "token", token: "a", conversationId: "a", runId: "old" });
  batcher.forward({ type: "token", token: "b", conversationId: "a", runId: "new" });
  batcher.forward({ type: "token", token: "c", conversationId: "b", runId: "new" });
  batcher.flush();
  batcher.flush();
  assert.deepEqual(events.map(event => event.token), ["a", "b", "c"]);
  t.mock.timers.tick(100);
  assert.equal(events.length, 3);
});

test("a synthetic 1000-delta burst becomes 63 deliveries without losing content", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const events: any[] = [];
  const batcher = createStreamBatcher(event => events.push(event));
  for (let index = 0; index < 1000; index++) {
    batcher.forward({ type: "token", token: `${index},` });
    t.mock.timers.tick(1);
  }
  batcher.flush();
  assert.equal(events.length, 63);
  assert.equal(events.map(event => event.token).join(""), Array.from({ length: 1000 }, (_, index) => `${index},`).join(""));
});
