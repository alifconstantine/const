import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { withFileLock } from "./file-lock.js";
import {
  rollbackFileMutation,
  rollbackMultipleMutations,
  type FileMutationRecord,
} from "./mutation-ledger.js";

const execFileAsync = promisify(execFile);

export function executeRollbackMutation(...args: Parameters<typeof rollbackUnlocked>): ReturnType<typeof rollbackUnlocked> {
  return withFileLock(args[1] || process.cwd(), () => rollbackUnlocked(...args));
}
export function createCheckpoint(...args: Parameters<typeof checkpointUnlocked>): ReturnType<typeof checkpointUnlocked> {
  return withFileLock(args[1] || process.cwd(), () => checkpointUnlocked(...args));
}
export function restoreCheckpoint(...args: Parameters<typeof restoreUnlocked>): ReturnType<typeof restoreUnlocked> {
  return withFileLock(args[1] || process.cwd(), () => restoreUnlocked(...args));
}

export interface FileSnapshot {
  filePath: string;
  relativePath: string;
  content: string | null; // null if file did not exist
  exists: boolean;
}

export interface CheckpointItem {
  id: string;
  name?: string;
  timestamp: number;
  workspaceRoot: string;
  conversationId?: string;
  mutationLedgerIndex: number;
  gitRef?: string;
  snapshots: FileSnapshot[];
}

export interface RollbackResult {
  success: boolean;
  revertedCount: number;
  details: Array<{
    id: string;
    file: string;
    operation: string;
    success: boolean;
    message: string;
  }>;
  message: string;
}

export interface RestoreCheckpointResult {
  success: boolean;
  checkpointId: string;
  checkpointName?: string;
  revertedMutationsCount: number;
  restoredFilesCount: number;
  restoredFiles: string[];
  message: string;
}

// ---------------------------------------------------------------------------
// In-Memory Ledger & Checkpoint Store
// ---------------------------------------------------------------------------

const mutationHistory: FileMutationRecord[] = [];
const checkpoints: CheckpointItem[] = [];

/**
 * Record a file mutation in the global agent ledger.
 */
export function recordMutation(record: FileMutationRecord): void {
  mutationHistory.push({
    ...record,
    rolledBack: Boolean(record.rolledBack),
  });
}

/**
 * Get all mutation records, optionally filtered.
 */
export function getMutationHistory(filter?: {
  filePath?: string;
  includeRolledBack?: boolean;
  conversationId?: string;
}): FileMutationRecord[] {
  let list = [...mutationHistory];
  if (filter && "conversationId" in filter) list = list.filter(m => m.conversationId === filter.conversationId);
  if (filter?.filePath) {
    const targetNorm = path.resolve(filter.filePath).toLowerCase();
    list = list.filter((m) => {
      const p = m.absolutePath || m.filePath || m.targetFile;
      return p && path.resolve(p).toLowerCase() === targetNorm;
    });
  }
  if (!filter?.includeRolledBack) {
    list = list.filter((m) => !m.rolledBack);
  }
  return list;
}

/**
 * Clear the in-memory mutation history (useful in tests or session reset).
 */
export function clearMutationHistory(): void {
  mutationHistory.length = 0;
}

/**
 * Clear checkpoints list.
 */
export function clearCheckpoints(): void {
  checkpoints.length = 0;
}

/**
 * List all active checkpoints.
 */
export function listCheckpoints(): CheckpointItem[] {
  return [...checkpoints];
}

// ---------------------------------------------------------------------------
// Rollback Mutation Logic
// ---------------------------------------------------------------------------

/**
 * Rolls back recent mutations.
 * If file_path is specified, reverts mutations affecting that file.
 * If mutation_id is specified, reverts that specific mutation.
 * Otherwise, reverts the latest `steps` (default 1) mutations.
 */
async function rollbackUnlocked(
  options: {
    filePath?: string;
    steps?: number;
    mutationId?: string;
  },
  workspaceRoot: string = process.cwd(),
  conversationId?: string
): Promise<RollbackResult> {
  const steps = Math.max(1, options.steps ?? 1);
  const owned = mutationHistory.filter(m => ownsMutation(m, workspaceRoot, conversationId));

  if (options.mutationId) {
    const target = owned.find((m) => m.id === options.mutationId);
    if (!target) {
      return {
        success: false,
        revertedCount: 0,
        details: [],
        message: `Mutation with ID '${options.mutationId}' was not found in the ledger.`,
      };
    }
    if (target.rolledBack) {
      return {
        success: false,
        revertedCount: 0,
        details: [],
        message: `Mutation '${options.mutationId}' has already been rolled back.`,
      };
    }

    const res = await rollbackFileMutation(target);
    if (res.success) target.rolledBack = true;
    const targetFile = target.targetFile || target.filePath || "file";

    return {
      success: res.success,
      revertedCount: res.success ? 1 : 0,
      details: [
        {
          id: target.id,
          file: targetFile,
          operation: target.operation,
          success: res.success,
          message: res.message,
        },
      ],
      message: res.success
        ? `Successfully rolled back mutation ${target.id} on '${targetFile}'.`
        : `Failed to rollback mutation ${target.id}: ${res.message}`,
    };
  }

  // Filter candidate mutations to revert (un-rolled-back only)
  let candidates: FileMutationRecord[] = [];

  if (options.filePath) {
    const resolvedTarget = path.isAbsolute(options.filePath)
      ? path.resolve(options.filePath)
      : path.resolve(workspaceRoot, options.filePath);
    const targetNorm = resolvedTarget.toLowerCase();

    candidates = owned.filter((m) => {
      if (m.rolledBack) return false;
      const p = m.absolutePath || m.filePath || m.targetFile;
      if (!p) return false;
      const resP = path.isAbsolute(p) ? path.resolve(p) : path.resolve(workspaceRoot, p);
      return resP.toLowerCase() === targetNorm;
    });

    if (candidates.length === 0) {
      return {
        success: false,
        revertedCount: 0,
        details: [],
        message: `No active un-reverted mutations found for file '${options.filePath}'.`,
      };
    }
  } else {
    candidates = owned.filter((m) => !m.rolledBack);
    if (candidates.length === 0) {
      return {
        success: false,
        revertedCount: 0,
        details: [],
        message: "No active un-reverted mutations in the session ledger to roll back.",
      };
    }
  }

  // Take the most recent `steps` mutations in reverse order
  const toRollback = candidates.slice(-steps).reverse();
  const details: RollbackResult["details"] = [];
  let successfulReverts = 0;

  for (const rec of toRollback) {
    const res = await rollbackFileMutation(rec);
    const fileLabel = rec.targetFile || rec.filePath || path.basename(rec.absolutePath || "file");
    if (res.success) {
      rec.rolledBack = true;
      successfulReverts++;
    }
    details.push({
      id: rec.id,
      file: fileLabel,
      operation: rec.operation,
      success: res.success,
      message: res.message,
    });
  }

  const fileSummary = details.map((d) => `${d.file} (${d.operation}: ${d.message})`).join(", ");

  return {
    success: successfulReverts > 0,
    revertedCount: successfulReverts,
    details,
    message:
      successfulReverts > 0
        ? `Rolled back ${successfulReverts} mutation(s) successfully: ${fileSummary}`
        : `Failed to roll back mutations: ${details.map((d) => d.message).join("; ")}`,
  };
}

// ---------------------------------------------------------------------------
// Checkpoint & Restore Logic
// ---------------------------------------------------------------------------

/**
 * Creates a checkpoint snapshot of the workspace.
 */
async function checkpointUnlocked(
  options: { name?: string; conversationId?: string },
  workspaceRoot: string = process.cwd(),
  signal?: AbortSignal
): Promise<CheckpointItem> {
  const timestamp = Date.now();
  const checkpointId = `cp_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
  let gitRef: string | undefined;

  // 1. Try to snapshot Git state if inside a Git work tree
  try {
    const { stdout: isGit } = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: workspaceRoot,
      signal,
    });
    if (isGit.trim() === "true") {
      // Create a git stash commit object without pushing to stash reflog or altering work tree
      try {
        const { stdout: stashSha } = await execFileAsync("git", ["stash", "create"], {
          cwd: workspaceRoot,
          signal,
        });
        const trimmedStash = stashSha.trim();
        if (trimmedStash) {
          gitRef = trimmedStash;
        } else {
          // If tree is clean, capture current HEAD
          const { stdout: headSha } = await execFileAsync("git", ["rev-parse", "HEAD"], {
            cwd: workspaceRoot,
            signal,
          });
          gitRef = headSha.trim();
        }
      } catch {
        // Fallback to HEAD
        try {
          const { stdout: headSha } = await execFileAsync("git", ["rev-parse", "HEAD"], {
            cwd: workspaceRoot,
            signal,
          });
          gitRef = headSha.trim();
        } catch {}
      }
    }
  } catch {
    // Not a git repository or git command unavailable
  }

  // 2. Snapshot dirty / recently touched files in the workspace
  const snapshots: FileSnapshot[] = [];
  const filesToSnapshot = new Set<string>();

  // Collect files touched in recent mutations
  for (const m of mutationHistory.filter(m => ownsMutation(m, workspaceRoot, options.conversationId))) {
    const p = m.absolutePath || m.filePath || m.targetFile;
    if (p) {
      const full = path.isAbsolute(p) ? p : path.resolve(workspaceRoot, p);
      filesToSnapshot.add(full);
    }
  }

  // Collect dirty files from git status if git is available
  try {
    const { stdout: statusOut } = await execFileAsync(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd: workspaceRoot, signal }
    );
    for (const line of statusOut.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const rawRel = line.slice(3).trim();
      if (rawRel) {
        filesToSnapshot.add(path.resolve(workspaceRoot, rawRel));
      }
    }
  } catch {}

  // Take snapshot of each file
  for (const filePath of filesToSnapshot) {
    try {
      if (fsSync.existsSync(filePath)) {
        const stat = await fs.stat(filePath);
        if (stat.isFile() && stat.size < 5 * 1024 * 1024) {
          // Only snapshot files < 5MB
          const content = await fs.readFile(filePath, "utf-8");
          snapshots.push({
            filePath,
            relativePath: path.relative(workspaceRoot, filePath),
            content,
            exists: true,
          });
        }
      } else {
        snapshots.push({
          filePath,
          relativePath: path.relative(workspaceRoot, filePath),
          content: null,
          exists: false,
        });
      }
    } catch {}
  }

  const checkpoint: CheckpointItem = {
    id: checkpointId,
    name: options.name?.trim() || undefined,
    timestamp,
    workspaceRoot: path.resolve(workspaceRoot),
    conversationId: options.conversationId,
    mutationLedgerIndex: mutationHistory.length,
    gitRef,
    snapshots,
  };

  checkpoints.push(checkpoint);
  return checkpoint;
}

/**
 * Restores the workspace back to a previously created checkpoint.
 */
async function restoreUnlocked(
  options: { checkpointId?: string; conversationId?: string },
  workspaceRoot: string = process.cwd(),
  signal?: AbortSignal
): Promise<RestoreCheckpointResult> {
  const ownedCheckpoints = checkpoints.filter(cp => cp.workspaceRoot === path.resolve(workspaceRoot) && cp.conversationId === options.conversationId);
  if (ownedCheckpoints.length === 0) {
    return {
      success: false,
      checkpointId: "",
      revertedMutationsCount: 0,
      restoredFilesCount: 0,
      restoredFiles: [],
      message: "No checkpoints available to restore.",
    };
  }

  let targetCp: CheckpointItem | undefined;
  if (options.checkpointId) {
    targetCp = ownedCheckpoints.find((cp) => cp.id === options.checkpointId);
    if (!targetCp) {
      const available = ownedCheckpoints.map((c) => `${c.id}${c.name ? ` (${c.name})` : ""}`).join(", ");
      return {
        success: false,
        checkpointId: options.checkpointId,
        revertedMutationsCount: 0,
        restoredFilesCount: 0,
        restoredFiles: [],
        message: `Checkpoint '${options.checkpointId}' not found. Available checkpoints: [${available}]`,
      };
    }
  } else {
    // Default to the latest checkpoint
    targetCp = ownedCheckpoints[ownedCheckpoints.length - 1];
  }

  if (!targetCp) {
    return {
      success: false,
      checkpointId: options.checkpointId || "",
      revertedMutationsCount: 0,
      restoredFilesCount: 0,
      restoredFiles: [],
      message: "No checkpoints available to restore.",
    };
  }

  const restoredFilesSet = new Set<string>();

  // 1. Rollback all mutations recorded AFTER this checkpoint was created
  const mutationsAfter = mutationHistory
    .slice(targetCp.mutationLedgerIndex)
    .filter((m) => !m.rolledBack && ownsMutation(m, workspaceRoot, options.conversationId));

  const rollbackResults = await rollbackMultipleMutations(mutationsAfter);
  for (const rec of mutationsAfter) {
    const result = rollbackResults.find(item => item.id === rec.id);
    if (!result?.success) continue;
    rec.rolledBack = true;
    restoredFilesSet.add(rec.targetFile || rec.filePath || rec.absolutePath || rec.id);
  }
  // Untracked changes have no owner: never overwrite them through a Git stash or snapshot.
  const conflicts = rollbackResults.filter(result => !result.success);
  for (const snapshot of targetCp.snapshots) {
    signal?.throwIfAborted();
    let current: string | null = null;
    try { current = await fs.readFile(snapshot.filePath, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (current !== snapshot.content) conflicts.push({
      id: snapshot.filePath, success: false,
      message: `Untracked changes in '${snapshot.filePath}' were preserved; they have no owned mutation to restore safely.`,
    });
  }

  const restoredFilesList = Array.from(restoredFilesSet);
  const cpLabel = targetCp.name ? `'${targetCp.name}' (${targetCp.id})` : targetCp.id;

  return {
    success: conflicts.length === 0,
    checkpointId: targetCp.id,
    checkpointName: targetCp.name,
    revertedMutationsCount: rollbackResults.filter((r) => r.success).length,
    restoredFilesCount: restoredFilesList.length,
    restoredFiles: restoredFilesList,
    message: conflicts.length ? `Checkpoint restore stopped on conflicts: ${conflicts.map(item => item.message).join("; ")}` : `Tracked workspace mutations restored successfully to checkpoint ${cpLabel}. Reverted ${mutationsAfter.length} mutation(s) across ${restoredFilesList.length} file(s).`,
  };
}

function ownsMutation(record: FileMutationRecord, workspaceRoot: string, conversationId?: string): boolean {
  if (record.conversationId !== conversationId) return false;
  const file = record.absolutePath || record.filePath || record.targetFile;
  if (!file) return false;
  const relative = path.relative(path.resolve(workspaceRoot), path.resolve(workspaceRoot, file));
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
