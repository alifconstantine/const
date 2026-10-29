import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TranscriptWriter } from "./transcript-writer";

test("transcript batches retain ordering across overlapping flushes and separate conversations", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "const-transcript-"));
  const writer = new TranscriptWriter();
  const file = path.join(root, "a", "events.jsonl");
  const other = path.join(root, "b", "events.jsonl");
  try {
    for (let index = 0; index < 100; index++) writer.append(file, { type: "token", token: `${index} 日本語` });
    await assert.rejects(fs.access(file)); // Appending does no synchronous disk work.
    writer.append(other, { type: "thinking", thinking: "other chat" });
    const first = writer.flush(file);
    for (let index = 100; index < 200; index++) writer.append(file, { type: "token", token: `${index} 日本語` });
    const second = writer.flush();
    await Promise.all([first, second]);
    const lines = (await fs.readFile(file, "utf8")).trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(lines.map(line => line.token), Array.from({ length: 200 }, (_, index) => `${index} 日本語`));
    assert.ok(lines.every(line => !Number.isNaN(Date.parse(line.timestamp))));
    assert.match(await fs.readFile(other, "utf8"), /other chat/);
    writer.append(file, { type: "done" });
    await writer.flush();
    assert.equal((await fs.readFile(file, "utf8")).trim().split("\n").length, 201);
  } finally {
    await writer.flush();
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("closing seals the logger and drains every previously accepted batch", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "const-transcript-close-"));
  const writer = new TranscriptWriter();
  const firstFile = path.join(root, "first.jsonl");
  const secondFile = path.join(root, "second.jsonl");
  try {
    writer.append(firstFile, { type: "token", token: "First" });
    const inFlight = writer.flush();
    writer.append(firstFile, { type: "done" });
    writer.append(secondFile, { type: "done" });
    const closing = writer.close();
    writer.append(firstFile, { type: "token", token: "After close" });
    await Promise.all([inFlight, closing]);
    await writer.close();
    const lines = (await fs.readFile(firstFile, "utf8")).trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(lines.map(line => line.type), ["token", "done"]);
    assert.equal(JSON.parse(await fs.readFile(secondFile, "utf8")).type, "done");
  } finally {
    await writer.close();
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(root, { recursive: true, force: true });
  }
});
