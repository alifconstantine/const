import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  recordMutation,
  getMutationHistory,
  clearMutationHistory,
  executeRollbackMutation,
  createCheckpoint,
  restoreCheckpoint,
  clearCheckpoints,
  listCheckpoints,
} from "../src/const/checkpoint.js";
import { executeNativeTool } from "../src/const/tools.js";

describe("Checkpoint & Rollback Mutation Engine", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "const-test-checkpoint-"));
    clearMutationHistory();
    clearCheckpoints();
  });

  afterEach(() => {
    clearMutationHistory();
    clearCheckpoints();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe("executeRollbackMutation unit tests", () => {
    it("should rollback single latest mutation when no args provided", async () => {
      const fileA = path.join(tmpDir, "fileA.txt");
      fs.writeFileSync(fileA, "hello world", "utf-8");

      recordMutation({
        id: "mut_test_1",
        operation: "create",
        filePath: fileA,
        previousContent: null,
        newContent: "hello world",
        timestamp: Date.now(),
      });

      expect(fs.existsSync(fileA)).toBe(true);

      const res = await executeRollbackMutation({}, tmpDir);
      expect(res.success).toBe(true);
      expect(res.revertedCount).toBe(1);
      expect(fs.existsSync(fileA)).toBe(false);
    });

    it("should rollback mutations for a specific file", async () => {
      const fileA = path.join(tmpDir, "fileA.txt");
      const fileB = path.join(tmpDir, "fileB.txt");

      fs.writeFileSync(fileA, "content A new", "utf-8");
      fs.writeFileSync(fileB, "content B", "utf-8");

      recordMutation({
        id: "mut_a",
        operation: "modify",
        filePath: fileA,
        previousContent: "content A original",
        newContent: "content A new",
        timestamp: Date.now() - 1000,
      });

      recordMutation({
        id: "mut_b",
        operation: "create",
        filePath: fileB,
        previousContent: null,
        newContent: "content B",
        timestamp: Date.now(),
      });

      // Rollback specifically fileA
      const res = await executeRollbackMutation({ filePath: "fileA.txt" }, tmpDir);
      expect(res.success).toBe(true);
      expect(res.revertedCount).toBe(1);
      expect(fs.readFileSync(fileA, "utf-8")).toBe("content A original");
      // fileB should still exist
      expect(fs.existsSync(fileB)).toBe(true);
    });

    it("should rollback by specific mutationId", async () => {
      const targetFile = path.join(tmpDir, "test.txt");
      fs.writeFileSync(targetFile, "second update", "utf-8");

      recordMutation({
        id: "target_mutation_id",
        operation: "modify",
        filePath: targetFile,
        previousContent: "first update",
        newContent: "second update",
        timestamp: Date.now(),
      });

      const res = await executeRollbackMutation({ mutationId: "target_mutation_id" }, tmpDir);
      expect(res.success).toBe(true);
      expect(fs.readFileSync(targetFile, "utf-8")).toBe("first update");

      // Rolling back the same ID again should report already rolled back
      const res2 = await executeRollbackMutation({ mutationId: "target_mutation_id" }, tmpDir);
      expect(res2.success).toBe(false);
      expect(res2.message).toContain("already been rolled back");
    });
  });

  describe("createCheckpoint & restoreCheckpoint", () => {
    it("should create checkpoint and restore file modifications", async () => {
      const baselineFile = path.join(tmpDir, "config.json");
      fs.writeFileSync(baselineFile, JSON.stringify({ version: 1 }), "utf-8");

      const cp = await createCheckpoint({ name: "baseline config" }, tmpDir);
      expect(cp.id).toMatch(/^cp_/);
      expect(cp.name).toBe("baseline config");
      expect(listCheckpoints()).toHaveLength(1);

      // Modify the file
      fs.writeFileSync(baselineFile, JSON.stringify({ version: 2 }), "utf-8");
      recordMutation({
        id: "mut_conf_2",
        operation: "modify",
        filePath: baselineFile,
        previousContent: JSON.stringify({ version: 1 }),
        newContent: JSON.stringify({ version: 2 }),
        timestamp: Date.now(),
      });

      // Also create a new file
      const newFile = path.join(tmpDir, "temp.txt");
      fs.writeFileSync(newFile, "temporary", "utf-8");
      recordMutation({
        id: "mut_temp",
        operation: "create",
        filePath: newFile,
        previousContent: null,
        newContent: "temporary",
        timestamp: Date.now(),
      });

      expect(fs.existsSync(newFile)).toBe(true);

      // Restore to checkpoint
      const restoreRes = await restoreCheckpoint({ checkpointId: cp.id }, tmpDir);
      expect(restoreRes.success).toBe(true);
      expect(restoreRes.revertedMutationsCount).toBe(2);

      // Verify files returned to original state
      expect(JSON.parse(fs.readFileSync(baselineFile, "utf-8"))).toEqual({ version: 1 });
      expect(fs.existsSync(newFile)).toBe(false);
    });

    it("should restore to latest checkpoint when checkpointId is omitted", async () => {
      const target = path.join(tmpDir, "state.txt");
      fs.writeFileSync(target, "phase 1", "utf-8");

      await createCheckpoint({ name: "Phase 1" }, tmpDir);

      fs.writeFileSync(target, "phase 2", "utf-8");
      recordMutation({
        id: "mut_ph2",
        operation: "modify",
        filePath: target,
        previousContent: "phase 1",
        newContent: "phase 2",
        timestamp: Date.now(),
      });

      await createCheckpoint({ name: "Phase 2" }, tmpDir);

      fs.writeFileSync(target, "phase 3 (broken)", "utf-8");
      recordMutation({
        id: "mut_ph3",
        operation: "modify",
        filePath: target,
        previousContent: "phase 2",
        newContent: "phase 3 (broken)",
        timestamp: Date.now(),
      });

      // Restore without ID -> should restore to Phase 2
      const res = await restoreCheckpoint({}, tmpDir);
      expect(res.success).toBe(true);
      expect(res.checkpointName).toBe("Phase 2");
      expect(fs.readFileSync(target, "utf-8")).toBe("phase 2");
    });
  });

  describe("executeNativeTool Integration with Rollback & Checkpoint", () => {
    it("should record mutation on 'write' and revert with 'rollback_mutation'", async () => {
      const createdFile = path.join(tmpDir, "auto.ts");

      // 1. Tool write
      const writeRes = await executeNativeTool(
        "write",
        { path: "auto.ts", content: "export const x = 42;" },
        tmpDir
      );
      expect(writeRes.isError).toBe(false);
      expect(fs.existsSync(createdFile)).toBe(true);
      expect(getMutationHistory()).toHaveLength(1);

      // 2. Tool rollback_mutation
      const rollbackRes = await executeNativeTool(
        "rollback_mutation",
        { file_path: "auto.ts" },
        tmpDir
      );
      expect(rollbackRes.isError).toBe(false);
      expect(rollbackRes.result).toContain("Rolled back");
      expect(fs.existsSync(createdFile)).toBe(false);
    });

    it("should record mutation on 'edit' and revert with 'rollback_mutation'", async () => {
      const testFile = path.join(tmpDir, "service.ts");
      fs.writeFileSync(testFile, "const port = 3000;\nexport default port;\n", "utf-8");

      // 1. Tool edit
      const editRes = await executeNativeTool(
        "edit",
        { path: "service.ts", old_content: "3000", new_content: "8080" },
        tmpDir
      );
      expect(editRes.isError).toBe(false);
      expect(fs.readFileSync(testFile, "utf-8")).toContain("8080");

      // 2. Tool rollback_mutation
      const rollbackRes = await executeNativeTool(
        "rollback_mutation",
        {},
        tmpDir
      );
      expect(rollbackRes.isError).toBe(false);
      expect(fs.readFileSync(testFile, "utf-8")).toContain("3000");
    });

    it("should snapshot and restore through 'checkpoint' and 'restore_checkpoint' tools", async () => {
      const fileX = path.join(tmpDir, "x.txt");
      fs.writeFileSync(fileX, "initial value", "utf-8");

      // 1. Create checkpoint via tool
      const cpRes = await executeNativeTool(
        "checkpoint",
        { name: "before dangerous refactor" },
        tmpDir
      );
      expect(cpRes.isError).toBe(false);
      expect(cpRes.result).toContain("created successfully");

      // 2. Edit file via tool
      await executeNativeTool(
        "edit",
        { path: "x.txt", old_content: "initial value", new_content: "corrupted value" },
        tmpDir
      );
      expect(fs.readFileSync(fileX, "utf-8")).toBe("corrupted value");

      // 3. Restore checkpoint via tool
      const restoreRes = await executeNativeTool(
        "restore_checkpoint",
        {},
        tmpDir
      );
      expect(restoreRes.isError).toBe(false);
      expect(restoreRes.result).toContain("restored successfully");
      expect(fs.readFileSync(fileX, "utf-8")).toBe("initial value");
    });
  });
});
