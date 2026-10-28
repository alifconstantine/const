import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConversationDatabase } from "./database";

test("remote sidebar summaries omit transcripts, preserve flags, and search message bodies literally", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "const-remote-db-"));
  const database = new ConversationDatabase(dir);
  try {
    const base = {
      project: "Outside Project",
      createdAt: 1,
      updatedAt: 1,
      messages: [
        {
          role: "assistant",
          content: "A private needle_100% in the transcript",
        },
      ],
    };
    database.saveConversation({
      ...base,
      id: "one",
      title: "A task",
      isPinned: true,
    });
    database.saveConversation({
      ...base,
      id: "archived",
      title: "Archived",
      isArchived: true,
    });
    database.saveConversation({
      ...base,
      id: "side_chat_child",
      title: "Companion",
    });
    const summaries = database.listRemoteSummaries();
    assert.deepEqual(
      summaries.map((row) => row.id),
      ["one"],
    );
    assert.equal(summaries[0]?.isPinned, true);
    assert.deepEqual(summaries[0]?.messages, []);
    assert.equal(database.listRemoteSummaries(true).length, 2);
    const found = database.searchRemoteConversations("needle_100%");
    assert.deepEqual(
      found.map((row) => row.id),
      ["one"],
    );
    assert.match(String(found[0]?.messages[0]?.content), /needle_100%/);
    assert.deepEqual(database.searchRemoteConversations("needleZ100Q"), []);

    // Verify rightPaneState and sideConversations persistence
    database.saveConversation({
      ...base,
      id: "pane_sync_test",
      title: "Sync Test",
      rightPaneState: { isOpen: true, activeTabId: "tab-1", tabs: [{ id: "tab-1", type: "side_conversation", title: "Side" }] },
      sideConversations: [{ id: "side_chat_1", parentConversationId: "pane_sync_test", title: "Side", project: base.project, createdAt: 1, updatedAt: 1, messages: [] }],
    });
    const loaded = database.getConversation("pane_sync_test");
    assert.equal(loaded?.rightPaneState?.isOpen, true);
    assert.equal(loaded?.rightPaneState?.activeTabId, "tab-1");
    assert.equal(loaded?.sideConversations?.length, 1);
    assert.equal(loaded?.sideConversations?.[0]?.title, "Side");
  } finally {
    (database as any).db.close();
    assert.ok(
      path
        .resolve(dir)
        .startsWith(path.resolve(os.tmpdir()) + path.sep + "const-remote-db-"),
    );
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("UI patches preserve transcript, activity time, and independently saved side chats", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "const-remote-db-"));
  const database = new ConversationDatabase(dir);
  try {
    database.saveConversation({ id: "parent", title: "Work", project: "/workspace", createdAt: 1, updatedAt: 2, messages: [{ id: "answer", role: "assistant", content: "Authoritative answer", intelligenceUiState: { chart: { value: 1 } } }] });
    const before = database.getConversation("parent")!;
    const pane = { isOpen: true, activeTabId: "review", tabs: [{ id: "review", type: "review" as const, title: "Review" }] };
    assert.equal(database.updateConversationUi("parent", { rightPaneState: pane }), true);
    const base = { parentConversationId: "parent", title: "Side", project: "/workspace", createdAt: 1, updatedAt: 2, messages: [] };
    database.updateConversationUi("parent", { sideConversation: { ...base, id: "side_chat_a" } });
    database.updateConversationUi("parent", { sideConversation: { ...base, id: "side_chat_b" } });
    database.updateConversationUi("parent", { deleteSideConversationId: "side_chat_a" });
    const after = database.getConversation("parent")!;
    assert.deepEqual(after.messages, before.messages);
    assert.equal(after.updatedAt, before.updatedAt);
    assert.deepEqual(after.rightPaneState, pane);
    assert.deepEqual(after.sideConversations?.map(side => side.id), ["side_chat_b"]);
    assert.equal(database.updateConversationUi("parent", { rightPaneState: pane }), false);
    assert.equal(database.updateConversationUi("missing", { rightPaneState: pane }), false);
    assert.throws(() => database.updateConversationUi("parent", { sideConversation: { ...base, id: "side_chat_c", parentConversationId: "other" } }));
  } finally {
    (database as any).db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
