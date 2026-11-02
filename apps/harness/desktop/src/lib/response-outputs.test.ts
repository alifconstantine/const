import assert from "node:assert/strict";
import { test } from "node:test";
import { collectResponseOutputs } from "./response-outputs";
import type { FileMutationRecord } from "../vite-env";

const mutation = (path: string, changes: Partial<FileMutationRecord> = {}): FileMutationRecord => ({ id: path, filePath: path, targetFile: path, operation: "create", previousContent: null, newContent: "result", timestamp: 1, ...changes });

test("preview actions require a named, written deliverable and exclude deleted or reverted outputs", () => {
  const records = [mutation("/workspace/outputs/index.html"), mutation("/workspace/other.html"), mutation("/workspace/reverted.pdf", { rolledBack: true }), mutation("/workspace/deleted.png", { operation: "delete" })];
  assert.deepEqual(collectResponseOutputs('Created `outputs/index.html`. [Reverted](reverted.pdf) [Deleted](deleted.png)', records), ["/workspace/outputs/index.html"]);
  assert.deepEqual(collectResponseOutputs('```\nother.html\n```', records), []);
  assert.deepEqual(collectResponseOutputs('[Existing](existing.html)', records), []);
});
