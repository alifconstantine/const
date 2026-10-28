import assert from "node:assert/strict";
import { test } from "node:test";
import { remoteDesktopTransport } from "./remote-desktop-transport";
import type { RemoteClient } from "@const/remote/client";

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const stream = (revision: number, token: string) => ({ type: "desktop:event", channel: "agent:stream-event", args: [{ type: "token", token, conversationId: "chat", runId: "run", remoteSequence: revision }] });

test("a snapshot replaces stale output and releases only newer buffered events once", async () => {
  let resolveSnapshot!: (value: any) => void;
  const bridge = remoteDesktopTransport({ request: () => new Promise(resolve => { resolveSnapshot = resolve; }) } as unknown as RemoteClient, () => assert.fail("unexpected resync"));
  try {
    const events: any[] = [];
    bridge.transport.on("agent:stream-event", (_event, value) => events.push(value));
    const pending = bridge.transport.invoke("conversations:get", "chat");
    bridge.event(stream(2, "obsolete") as any);
    bridge.event(stream(3, " newer") as any);
    resolveSnapshot({ ok: true, value: { id: "chat", messages: [{ role: "assistant", content: "A much longer obsolete draft" }], __remoteLive: { runId: "run", messages: [{ id: "live", role: "assistant", content: "OK", thinking: "thought", toolCalls: [{ id: "read", result: "full output" }] }] }, __remoteRevision: { runId: "run", revision: 2 } } });
    const conversation = await pending;
    assert.equal(conversation.messages[0].content, "OK");
    assert.equal(conversation.messages[0].toolCalls[0].result, "full output");
    await tick();
    assert.deepEqual(events.map(event => event.token), [" newer"]);
    bridge.event(stream(3, "duplicate") as any);
    assert.equal(events.length, 1);
  } finally { bridge.dispose(); }
});

test("joining recovers pending approval, questions and todos with the run guard", async () => {
  const calls: any[] = [];
  const bridge = remoteDesktopTransport({ async request(command: any) {
    calls.push(command);
    if (command.payload.channel === "agent:get-session-snapshot") return { ok: true, value: { __remoteLive: { runId: "run", messages: [], approval: { type: "approval_request", approvalId: "approval" }, questions: { toolCallId: "question", questions: [{ question: "Which?" }] }, todos: [{ content: "Verify", status: "pending" }] }, __remoteRevision: { runId: "run", revision: 5 } } };
    return { ok: true, value: true };
  } } as unknown as RemoteClient, () => assert.fail("unexpected resync"));
  try {
    const events: any[] = [];
    bridge.transport.on("agent:stream-event", (_event, value) => events.push(value));
    await bridge.transport.invoke("agent:get-session-snapshot", "chat", { hydrate: true });
    await tick();
    assert.deepEqual(events.map(event => event.type), ["approval_request", "ask_question", "todo_update"]);
    await bridge.transport.invoke("agent:answer-question", { toolCallId: "question", answer: "A" });
    assert.equal(calls.at(-1).payload.expectedRunId, "run");
    await bridge.transport.invoke("agent:abort", "chat");
    assert.equal(calls.at(-1).payload.expectedRunId, "run");
  } finally { bridge.dispose(); }
});

test("UI change hydration delivers the complete host conversation and metadata", async () => {
  const conversation = { id: "chat", messages: [{ role: "assistant", content: "answer" }], rightPaneState: { isOpen: true }, sideConversations: [{ id: "side_chat_a", messages: [{ content: "side answer" }] }] };
  const bridge = remoteDesktopTransport({ async request() { return { ok: true, value: conversation }; } } as unknown as RemoteClient, () => assert.fail("unexpected resync"));
  try {
    let notification: any;
    bridge.transport.on("conversations:changed", (_event, value) => { notification = value; });
    bridge.event({ type: "desktop:event", channel: "conversations:changed", args: [{ conversationId: "chat", uiOnly: true }] });
    await tick();
    assert.equal(notification.uiOnly, true);
    assert.deepEqual(notification.remoteConversation, conversation);
  } finally { bridge.dispose(); }
});

test("fragmented tool results arrive intact and own UI writes do not echo", async () => {
  let bridge: ReturnType<typeof remoteDesktopTransport>;
  bridge = remoteDesktopTransport({ async request(_command: any, requestId: string) {
    bridge.event({ type: "desktop:event", channel: "conversations:changed", args: [{ conversationId: "chat", originRequestId: requestId }] });
    return { ok: true, value: true };
  } } as unknown as RemoteClient, () => assert.fail("unexpected resync"));
  try {
    let changes = 0;
    let result: any;
    bridge.transport.on("conversations:changed", () => changes++);
    bridge.transport.on("agent:stream-event", (_event, value) => { result = value.result; });
    await bridge.transport.invoke("conversations:update-ui", "chat", { rightPaneState: { isOpen: false, activeTabId: null, tabs: [] } });
    assert.equal(changes, 0);
    const output = "漢字".repeat(30_000);
    const serialized = JSON.stringify({ type: "desktop:event", channel: "agent:stream-event", args: [{ type: "tool_result", conversationId: "chat", result: output }] });
    const count = Math.ceil(serialized.length / 8000);
    for (let index = count - 1; index >= 0; index--) bridge.event({ type: "desktop:event-part", id: "fragment", index, count, data: serialized.slice(index * 8000, (index + 1) * 8000) });
    assert.equal(result, output);
  } finally { bridge.dispose(); }
});

test("reading session metadata does not consume parent chat stream events", async () => {
  let resolveSnapshot!: (value: any) => void;
  const bridge = remoteDesktopTransport({ request: () => new Promise(resolve => { resolveSnapshot = resolve; }) } as unknown as RemoteClient, () => assert.fail("unexpected resync"));
  try {
    const tokens: string[] = [];
    bridge.transport.on("agent:stream-event", (_event, value) => { if (value.type === "token") tokens.push(value.token); });
    const pending = bridge.transport.invoke("agent:get-session-snapshot", "chat");
    bridge.event(stream(1, "before snapshot") as any);
    assert.deepEqual(tokens, ["before snapshot"]);
    resolveSnapshot({ ok: true, value: { runId: "run", __remoteRevision: { runId: "run", revision: 5 } } });
    await pending;
    bridge.event(stream(2, "during snapshot") as any);
    assert.deepEqual(tokens, ["before snapshot", "during snapshot"]);
  } finally { bridge.dispose(); }
});
