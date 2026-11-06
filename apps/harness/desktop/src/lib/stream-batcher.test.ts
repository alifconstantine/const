import assert from "node:assert/strict";
import { test } from "node:test";
import { createStreamBatcher } from "./stream-batcher";

test("commentary seals a model turn before subsequent tool and answer deltas", () => {
  const events: any[] = [];
  const batcher = createStreamBatcher(event => events.push(event));
  batcher.forward({ type: "token", token: "I'll inspect " });
  batcher.forward({ type: "token", token: "the sources." });
  batcher.forward({ type: "commentary", content: "I'll inspect the sources." });
  batcher.forward({ type: "tool_call", toolCallId: "read" });
  batcher.forward({ type: "token", token: "Final findings." });
  batcher.flush();
  assert.deepEqual(events.map(event => event.type), ["token", "commentary", "tool_call", "token"]);
  assert.equal(events[0].token, "I'll inspect the sources.");
  assert.equal(events[3].token, "Final findings.");
});

test("delta batches preserve text, ordering and structural barriers", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const events: any[] = [];
  const batcher = createStreamBatcher(event => events.push(event));
  for (const token of ["one", " ", "two"]) batcher.forward({ type: "token", token, remoteSequence: events.length });
  assert.equal(events.length, 0);
  t.mock.timers.tick(16);
  assert.equal(events.length, 0);
  t.mock.timers.tick(18);
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

test("a 1000-delta burst stays near 30 deliveries per second without losing content", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const events: any[] = [];
  const batcher = createStreamBatcher(event => events.push(event));
  for (let index = 0; index < 1000; index++) {
    batcher.forward({ type: "token", token: `${index},` });
    t.mock.timers.tick(1);
  }
  batcher.flush();
  assert.ok(events.length >= 29 && events.length <= 32, `Unexpected frame cadence: ${events.length}`);
  assert.equal(events.map(event => event.token).join(""), Array.from({ length: 1000 }, (_, index) => `${index},`).join(""));
});

test("renderer pressure delays deltas but never completion or error barriers", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const events: any[] = [];
  let delay = 150;
  const batcher = createStreamBatcher(event => events.push(event), () => delay);
  batcher.forward({ type: "thinking", thinking: "one" });
  t.mock.timers.tick(100);
  assert.equal(events.length, 0);
  batcher.forward({ type: "thinking", thinking: " two" });
  batcher.forward({ type: "error", error: "failure" });
  assert.deepEqual(events.map(event => event.type), ["thinking", "error"]);
  assert.equal(events[0].thinking, "one two");
  delay = 34;
  batcher.forward({ type: "token", token: "answer" });
  t.mock.timers.tick(34);
  assert.equal(events[2].token, "answer");
  batcher.forward({ type: "done" });
  assert.equal(events[3].type, "done");
});
