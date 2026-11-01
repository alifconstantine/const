import assert from "node:assert/strict";
import { test } from "node:test";
import { collectSessionChanges, collectSessionSources, localMediaUrl, mediaKind, safeMediaUrl } from "./workbench-activity";
import type { AttachedFile } from "../components/workbench/chat-card";
import type { FileMutationRecord } from "../vite-env";

test("sources retain distinct same-named files, deduplicate paths and exclude assistant attachments", () => {
  const file = (id: string, path: string): AttachedFile => ({ id, path, name: "reference.png", type: "image", size: 100 });
  const sources = collectSessionSources([
    { role: "user", attachments: [file("a", "C:\\one\\reference.png"), file("b", "C:/two/reference.png")] },
    { role: "user", attachments: [file("c", "C:/one/reference.png")] },
    { role: "assistant", attachments: [file("output", "C:/output.png")] },
  ]);
  assert.deepEqual(sources.map(source => source.id), ["a", "b"]);
});

test("legacy attachments without ids get stable distinct source tab identifiers", () => {
  const attachment = { name: "notes.txt", size: 5, type: "document" } as AttachedFile;
  const messages = [{ role: "user", attachments: [attachment, { ...attachment }] }];
  const sources = collectSessionSources(messages);
  assert.equal(sources.length, 2);
  assert.notEqual(sources[0]!.id, sources[1]!.id);
  assert.deepEqual(collectSessionSources(messages), sources);
  assert.equal(attachment.id, undefined);
});

test("changes show one net diff per file and omit reverted and net-zero changes without mutating rollback records", () => {
  const record = (id: string, path: string, before: string | null, after: string | null): FileMutationRecord => ({
    id, filePath: path, targetFile: path, previousContent: before, newContent: after,
    operation: before === null ? "create" : after === null ? "delete" : "modify", timestamp: 1,
  });
  const mutations = [record("1", "app.ts", "original", "intermediate"), record("2", "app.ts", "intermediate", "final"),
    record("3", "temp.txt", null, "temporary"), record("4", "temp.txt", "temporary", null),
    { ...record("5", "reverted.txt", null, "reverted"), rolledBack: true }];
  const before = JSON.stringify(mutations);
  const changes = collectSessionChanges(mutations);
  assert.equal(changes.length, 1);
  assert.equal(changes[0]!.previousContent, "original");
  assert.equal(changes[0]!.newContent, "final");
  assert.equal(JSON.stringify(mutations), before);
  assert.equal(mutations[1]!.previousContent, "intermediate");
});

test("media routing preserves textual documents and handles supported image/audio/video/office formats", () => {
  for (const extension of ["png", "avif", "svg"]) assert.equal(mediaKind(`reference.${extension}`), "image");
  assert.equal(mediaKind("clip.webm"), "video");
  assert.equal(mediaKind("voice.m4a"), "audio");
  assert.equal(mediaKind("brief.PDF"), "pdf");
  assert.equal(mediaKind("brief.docx"), "document");
  assert.equal(mediaKind("brief.txt", "document"), null);
  assert.equal(mediaKind("figures.csv", "spreadsheet"), null);
  assert.equal(mediaKind("code.ts"), null);
});

test("media URLs reject active content and encode local path delimiters", () => {
  assert.equal(safeMediaUrl("javascript:alert(1)", "image"), undefined);
  assert.equal(safeMediaUrl("data:text/html,<script>bad()</script>", "pdf"), undefined);
  assert.equal(safeMediaUrl("https://example.test/untrusted.html", "pdf"), undefined);
  assert.equal(safeMediaUrl("data:image/svg+xml,<svg/>", "image"), "data:image/svg+xml,<svg/>");
  assert.equal(safeMediaUrl("data:application/pdf;base64,JVBERg==", "pdf"), "data:application/pdf;base64,JVBERg==");
  assert.equal(localMediaUrl("C:\\Images\\my file#1?.png"), "const-file://C:/Images/my%20file%231%3F.png");
});
