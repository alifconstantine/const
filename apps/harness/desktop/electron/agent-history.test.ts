import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConversationDatabase } from "./database";
import { mergeCanonicalTodoState, selectAgentAutosaveMessages } from "./agent-history";
import { AgentSessionRegistry } from "./agent-sessions";

test("host canonical Todo survives stale renderer saves, SQLite reopen and failure without losing rich traces", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "const-plan-history-"));
  let database = new ConversationDatabase(dir);
  const open = [{ content: "Verify", status: "pending" }];
  const rich = [{ id: "user", role: "user", content: "Build" }, { role: "assistant", content: "Failure", durationMs: 500,
    traceSteps: [{ id: "read", type: "tool", name: "read", result: "evidence" }], todos: open }];
  const host = [{ id: "user", role: "user", content: "Build" }, { role: "assistant", content: "", todos: [] }];
  try {
    const merged = selectAgentAutosaveMessages(rich, host);
    assert.deepEqual(merged[1]?.todos, []);
    assert.deepEqual(merged[1]?.traceSteps, rich[1]?.traceSteps);
    assert.deepEqual(rich[1]?.todos, open);
    assert.deepEqual(mergeCanonicalTodoState(rich, host)[1]?.todos, []);
    database.saveConversation({ id: "plan", title: "Plan", project: dir, createdAt: 1, updatedAt: 1, messages: merged });
    (database as any).db.close(); database = new ConversationDatabase(dir);
    assert.deepEqual(database.getConversation("plan")!.messages[1]?.todos, []);
    const different = [{ id: "other", role: "user", content: "Different task" }, { role: "assistant", content: "", todos: [] }];
    assert.equal(mergeCanonicalTodoState(rich, different), rich);
    const newer = [...rich, { id: "next", role: "user", content: "Next task" }];
    assert.equal(mergeCanonicalTodoState(newer, host), newer);
  } finally {
    (database as any).db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cancelled run autosave retains renderer traces and duration after reopening", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "const-history-"));
  let database: ConversationDatabase | undefined;
  try {
    database = new ConversationDatabase(dir);
    const messages = [
      { id: "user", role: "user", content: "Start the background server" },
      { id: "assistant", role: "assistant", content: "User cancelled agent execution.", durationMs: 3000,
        traceSteps: [{ id: "call", type: "tool", name: "bash", result: "server ready" }] },
    ];
    const conversation = { id: "session_test", title: "Background job", project: dir, createdAt: 1, updatedAt: 2, messages };
    database.saveConversation(conversation);
    database.appendTranscriptEvent(conversation.id, { type: "tool_result", result: "server ready" });
    await database.flushTranscriptEvents(conversation.id);
    database.saveConversation({ ...conversation, messages: selectAgentAutosaveMessages(
      database.getConversation(conversation.id)!.messages,
      [{ role: "user", content: messages[0]!.content }, { role: "assistant", content: "partial raw response" }],
    ) });
    (database as any).db.close();
    database = new ConversationDatabase(dir);
    assert.deepEqual(database.getConversation(conversation.id)!.messages, messages);
    const logs = path.join(dir, "brain", conversation.id, ".system_generated", "logs");
    assert.match(fs.readFileSync(path.join(logs, "transcript_full.jsonl"), "utf8"), /trace_steps/);
    assert.match(fs.readFileSync(path.join(logs, "events.jsonl"), "utf8"), /server ready/);
    // Editing/truncating a conversation updates snapshots, while diagnostic events survive.
    database.saveConversation({ ...conversation, messages: messages.slice(0, 1) });
    assert.equal(fs.readFileSync(path.join(logs, "transcript_full.jsonl"), "utf8").trim().split("\n").length, 1);
    assert.match(fs.readFileSync(path.join(logs, "events.jsonl"), "utf8"), /server ready/);
  } finally {
    (database as any)?.db.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("raw history is the fallback when renderer has not saved a response for the new turn", () => {
  const existing = [
    { role: "user", content: "old" }, { role: "assistant", content: "old answer", durationMs: 1000 },
    { role: "user", content: "new" }, { role: "assistant", content: "", traceSteps: [] },
  ];
  const updated = [...existing.slice(0, -1), { role: "assistant", content: "new answer" }];
  assert.equal(selectAgentAutosaveMessages(existing, updated), updated);
  assert.equal(selectAgentAutosaveMessages(existing, []), existing);
});

test("deleting a conversation drains buffered events before removing its logs", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "const-history-delete-"));
  const database = new ConversationDatabase(dir);
  try {
    const conversation = { id: "deleted", title: "Delete", project: dir, createdAt: 1, updatedAt: 1, messages: [] };
    database.saveConversation(conversation);
    database.appendTranscriptEvent("deleted", { type: "token", token: "Buffered" });
    const deletion = database.deleteConversation("deleted");
    database.appendTranscriptEvent("deleted", { type: "token", token: "During deletion" });
    database.saveConversation(conversation); // A stale renderer checkpoint during flush.
    await deletion;
    database.appendTranscriptEvent("deleted", { type: "done" });
    database.saveConversation(conversation); // An agent autosave after deletion.
    await database.flushTranscriptEvents();
    assert.equal(database.getConversation("deleted"), null);
    assert.equal(fs.existsSync(path.join(dir, "brain", "deleted")), false);
  } finally {
    await database.flushTranscriptEvents();
    (database as any).db.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("aborting keeps run ownership until cleanup and cannot release a replacement", () => {
  const sessions = new AgentSessionRegistry<{ runId: string }>();
  assert.equal(sessions.claim("a", { runId: "old" }), true);
  assert.equal(sessions.owns("a", "old"), true);
  assert.equal(sessions.claim("a", { runId: "premature" }), false);
  assert.equal(sessions.release("a", "old"), true);
  assert.equal(sessions.claim("a", { runId: "new" }), true);
  assert.equal(sessions.release("a", "old"), false);
  assert.equal(sessions.owns("a", "new"), true);
});
