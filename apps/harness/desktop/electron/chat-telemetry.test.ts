import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConversationDatabase } from "./database";
import { reduceTelemetry, summarizeTelemetry } from "../src/lib/chat-telemetry";
import { isModelRequestLog, type LocalRequestLog } from "../src/lib/db";

test("SQLite retains telemetry through late renderer saves, main autosave, and reopening", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "const-telemetry-"));
  let database: ConversationDatabase | undefined;
  try {
    database = new ConversationDatabase(dir);
    const conversation = { id: "chat-a", title: "Telemetry", project: dir, createdAt: 1, updatedAt: 1,
      model: "custom", messages: [{ id: "msg1", role: "user", content: "hello", createdAt: 1 }] };
    database.saveConversation(conversation);
    const started = { type: "llm_request", phase: "started", requestId: "a", model: "custom", startedAt: 1000 };
    database.recordTelemetry("chat-a", started);
    const stale = database.getConversation("chat-a")!;
    database.recordTelemetry("chat-a", { type: "usage", requestId: "a", promptTokens: 1000,
      completionTokens: 100, totalTokens: 1100, cacheReadTokens: 800 });
    database.recordTelemetry("chat-a", { type: "llm_request", requestId: "a", status: "completed", durationMs: 500, ttftMs: 100 });
    database.recordTelemetry("chat-a", { type: "context_update", usedTokens: 700, totalTokens: 32000,
      systemPromptTokens: 100, toolsTokens: 200, messagesTokens: 400, updatedAt: 2000 });
    database.saveConversation(stale);
    database.saveConversation(conversation); // Main autosave can omit both fields.
    (database as any).db.close();
    database = new ConversationDatabase(dir);
    const restored = database.getConversation("chat-a")!;
    assert.equal(restored.messages[0]?.content, "hello");
    assert.equal(restored.contextUsage?.usedTokens, 700);
    assert.equal(restored.contextUsage?.totalTokens, 32000);
    assert.equal(summarizeTelemetry(restored.telemetry).totalTokens, 1100);
    assert.equal(summarizeTelemetry(restored.telemetry).llmDurationMs, 500);
    assert.equal(restored.telemetry?.requests.a?.status, "completed");
    database.saveConversation({ ...conversation, id: "chat-b", messages: [] });
    database.recordTelemetry("chat-b", { type: "context_update", usedTokens: 200, totalTokens: 128000 });
    assert.equal(database.getConversation("chat-a")?.contextUsage?.usedTokens, 700);
    assert.equal(database.getConversation("chat-b")?.contextUsage?.usedTokens, 200);
    for (const invalid of ["{broken", JSON.stringify({ version: 1, requests: null })]) {
      (database as any).db.prepare("UPDATE conversations SET telemetry = ? WHERE id = ?").run(invalid, "chat-b");
      assert.doesNotThrow(() => database!.recordTelemetry("chat-b", { type: "usage", requestId: "recovered",
        model: "custom", startedAt: 3000, promptTokens: 50, completionTokens: 5, totalTokens: 55 }));
      assert.equal(summarizeTelemetry(database.getConversation("chat-b")?.telemetry).totalTokens, 55);
    }
  } finally {
    (database as any)?.db.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("old tool estimates and context-derived backfills are excluded from usage statistics", () => {
  const log: LocalRequestLog = { id: "legacy", requestId: "req_1", model: "model", promptTokens: 100,
    completionTokens: 10, totalTokens: 110, durationMs: 100, createdAt: 1000, status: 200 };
  assert.equal(isModelRequestLog(log), true);
  assert.equal(isModelRequestLog({ ...log, requestId: "tool_1" }), false);
  assert.equal(isModelRequestLog({ ...log, id: "req_convo_chat-a" }), false);
  assert.equal(isModelRequestLog({ ...log, toolNames: ["read"] }), false);
  assert.equal(reduceTelemetry(undefined, { type: "usage", promptTokens: 100 }).requests.constructor, Object);
});
