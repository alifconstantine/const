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
