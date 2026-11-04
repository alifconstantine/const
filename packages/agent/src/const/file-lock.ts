import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import lockfile from "proper-lockfile";
import { AsyncLocalStorage } from "node:async_hooks";

const heldLocks = new AsyncLocalStorage<ReadonlySet<string>>();

/** Serialize cooperating writers across agents and application processes. */
export async function withFileLock<T>(target: string, operation: () => Promise<T>): Promise<T> {
  let canonical = await canonicalPath(target);
  if (process.platform === "win32") canonical = canonical.toLowerCase();
  const held = heldLocks.getStore();
  if (held?.has(canonical)) return operation();
  const directory = path.join(os.tmpdir(), "const-file-locks");
  await fs.mkdir(directory, { recursive: true });
  const key = path.join(directory, createHash("sha256").update(canonical).digest("hex"));
  const release = await lockfile.lock(key, {
    realpath: false,
    retries: { retries: 200, minTimeout: 10, maxTimeout: 100 },
  });
  try { return await heldLocks.run(new Set([...(held || []), canonical]), operation); }
  finally { await release(); }
}

/** Resolve existing ancestors too, so a new file cannot escape through a directory symlink. */
export async function canonicalPath(target: string): Promise<string> {
  const absolute = path.resolve(target);
  try { return await fs.realpath(absolute); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(await canonicalPath(parent), path.basename(absolute));
  }
}

export async function isRealWorkspacePath(target: string, workspace: string): Promise<boolean> {
  const relative = path.relative(await canonicalPath(workspace), await canonicalPath(target));
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
