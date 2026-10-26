import assert from "node:assert/strict";
import test from "node:test";
import { ApprovalResponseGate, approvalResponseKey, removeMatchingApproval } from "./approval-state";
import { AgentSessionRegistry } from "../../electron/agent-sessions";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("late IPC acknowledgement A and stale resolved event A both preserve approval B", async () => {
  const ipc = deferred<void>();
  let pending = new Map([["chat", { approvalId: "A" }], ["other", { approvalId: "C" }]]);
  const acknowledgement = ipc.promise.then(() => { pending = removeMatchingApproval(pending, "chat", "A"); });
  pending = removeMatchingApproval(pending, "chat", "A");
  pending.set("chat", { approvalId: "B" });
  const before = pending;
  ipc.resolve();
  await acknowledgement;
  assert.equal(pending, before);
  assert.equal(removeMatchingApproval(pending, "chat", "A"), before);
  assert.equal(pending.get("chat")?.approvalId, "B");
  assert.equal(pending.get("other")?.approvalId, "C");
  assert.equal(removeMatchingApproval(pending, "chat", "B").has("chat"), false);
});

test("legacy id-only approval resolves without mutating the original map", () => {
  const pending = new Map([["chat", { id: "A" }]]);
  const next = removeMatchingApproval(pending, "chat", "A");
  assert.equal(pending.has("chat"), true);
  assert.equal(next.has("chat"), false);
});

test("same-frame double submit invokes IPC once and does not block the next approval or another chat", async () => {
  const gate = new ApprovalResponseGate();
  const ipc = deferred<boolean>();
  const key = approvalResponseKey("chat", "A");
  let submissions = 0;
  const first = gate.run(key, () => { submissions++; return ipc.promise; });
  const duplicate = gate.run(key, async () => { submissions++; return true; });
  assert.equal(await duplicate, undefined);
  assert.equal(submissions, 1);
  assert.equal(await gate.run(approvalResponseKey("chat", "B"), async () => true), true);
  assert.equal(await gate.run(approvalResponseKey("other", "A"), async () => true), true);
  ipc.resolve(true);
  assert.equal(await first, true);
});

test("a transport failure releases the response lock for retry", async () => {
  const gate = new ApprovalResponseGate();
  const key = approvalResponseKey("chat", "A");
  await assert.rejects(gate.run(key, async () => { throw new Error("IPC disconnected"); }), /disconnected/);
  assert.equal(await gate.run(key, async () => true), true);
});

test("an old request finishing does not unlock a pending response for the next request", async () => {
  const gate = new ApprovalResponseGate();
  const a = deferred<boolean>();
  const b = deferred<boolean>();
  const keyA = approvalResponseKey("chat", "A");
  const keyB = approvalResponseKey("chat", "B");
  const responseA = gate.run(keyA, () => a.promise);
  const responseB = gate.run(keyB, () => b.promise);
  a.resolve(true);
  await responseA;
  assert.equal(await gate.run(keyB, async () => false), undefined);
  b.resolve(true);
  await responseB;
});

test("a conversation can only have one live run while other chats run independently", () => {
  const sessions = new AgentSessionRegistry<{ runId: string }>();
  assert.equal(sessions.claim("chat", { runId: "A" }), true);
  assert.equal(sessions.claim("chat", { runId: "B" }), false);
  assert.equal(sessions.get("chat")?.runId, "A");
  assert.equal(sessions.claim("other", { runId: "B" }), true);
  assert.equal(sessions.size, 2);
});

test("old completion after abort and restart cannot release the replacement session", () => {
  const sessions = new AgentSessionRegistry<{ runId: string }>();
  sessions.claim("chat", { runId: "A" });
  assert.equal(sessions.release("chat", "A"), true);
  sessions.claim("chat", { runId: "B" });
  assert.equal(sessions.owns("chat", "A"), false);
  assert.equal(sessions.release("chat", "A"), false);
  assert.equal(sessions.owns("chat", "B"), true);
  assert.equal(sessions.release("chat", "B"), true);
  assert.equal(sessions.release("chat", "B"), false);
});
