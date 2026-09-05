import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { rollbackFileMutation, rollbackMultipleMutations, type FileMutationRecord } from "./mutation-ledger.js";

describe("Mutation Ledger Rollback", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "const-test-ledger-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should rollback a created file by deleting it", async () => {
    const testFile = path.join(tmpDir, "new-file.txt");
    fs.writeFileSync(testFile, "hello world", "utf-8");

    const record: FileMutationRecord = {
      id: "mut_1",
      filePath: testFile,
      targetFile: "new-file.txt",
      operation: "create",
      previousContent: null,
      newContent: "hello world",
      timestamp: Date.now(),
    };

    const res = await rollbackFileMutation(record);
    expect(res.success).toBe(true);
    expect(fs.existsSync(testFile)).toBe(false);
  });

  it("should rollback a modified file by restoring previousContent", async () => {
    const testFile = path.join(tmpDir, "existing-file.txt");
    fs.writeFileSync(testFile, "modified content", "utf-8");

    const record: FileMutationRecord = {
      id: "mut_2",
      filePath: testFile,
      targetFile: "existing-file.txt",
      operation: "modify",
      previousContent: "original content",
      newContent: "modified content",
      timestamp: Date.now(),
    };

    const res = await rollbackFileMutation(record);
    expect(res.success).toBe(true);
    expect(fs.existsSync(testFile)).toBe(true);
    expect(fs.readFileSync(testFile, "utf-8")).toBe("original content");
  });

  it("should rollback multiple mutations in reverse order", async () => {
    const fileA = path.join(tmpDir, "fileA.txt");
    const fileB = path.join(tmpDir, "fileB.txt");
    fs.writeFileSync(fileA, "created file a", "utf-8");
    fs.writeFileSync(fileB, "new content b", "utf-8");

    const mutations: FileMutationRecord[] = [
      {
        id: "mut_a",
        filePath: fileA,
        targetFile: "fileA.txt",
        operation: "create",
        previousContent: null,
        newContent: "created file a",
        timestamp: 100,
      },
      {
        id: "mut_b",
        filePath: fileB,
        targetFile: "fileB.txt",
        operation: "modify",
        previousContent: "original content b",
        newContent: "new content b",
        timestamp: 200,
      },
    ];

    const results = await rollbackMultipleMutations(mutations);
    expect(results).toHaveLength(2);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(true);
    expect(fs.existsSync(fileA)).toBe(false);
    expect(fs.readFileSync(fileB, "utf-8")).toBe("original content b");
  });
});
