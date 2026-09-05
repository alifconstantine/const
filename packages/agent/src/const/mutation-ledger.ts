import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export interface FileMutationRecord {
  id: string;
  stepIndex?: number;
  operation: "create" | "modify" | "delete";
  absolutePath?: string;
  filePath?: string;
  targetFile?: string;
  previousContent: string | null; // null if the file was newly created
  newContent?: string | null;
  timestamp: number;
  rolledBack?: boolean;
}

/**
 * Reverts a file mutation record back to its previous state on disk.
 */
export async function rollbackFileMutation(
  record: FileMutationRecord
): Promise<{ success: boolean; message: string }> {
  try {
    const targetPath = record.absolutePath || record.filePath || record.targetFile;
    if (!targetPath) {
      return {
        success: false,
        message: "No file path provided in mutation record",
      };
    }

    if (record.operation === "create") {
      // If it was created, rolling back means removing the file
      if (fsSync.existsSync(targetPath)) {
        await fs.unlink(targetPath);
        return {
          success: true,
          message: `Reverted creation of ${path.basename(targetPath)} (file removed)`,
        };
      }
      return {
        success: true,
        message: `File ${path.basename(targetPath)} does not exist on disk`,
      };
    }

    if (record.operation === "modify" || record.operation === "delete") {
      // If it was modified or deleted, rolling back means restoring previous content
      if (record.previousContent !== null && record.previousContent !== undefined) {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, record.previousContent, "utf-8");
        return {
          success: true,
          message: `Restored ${path.basename(targetPath)} to original state`,
        };
      }
    }

    return {
      success: false,
      message: "No previous content available to perform rollback",
    };
  } catch (err: any) {
    const target = record.absolutePath || record.filePath || record.targetFile || "file";
    return {
      success: false,
      message: `Failed to rollback ${target}: ${err.message}`,
    };
  }
}

/**
 * Reverts an array of file mutation records in reverse chronological order.
 */
export async function rollbackMultipleMutations(
  records: FileMutationRecord[]
): Promise<Array<{ id: string; success: boolean; message: string }>> {
  const results: Array<{ id: string; success: boolean; message: string }> = [];
  // Reverse to undo latest changes first
  const reversed = [...records].reverse();
  for (const rec of reversed) {
    const res = await rollbackFileMutation(rec);
    results.push({ id: rec.id, ...res });
  }
  return results;
}
