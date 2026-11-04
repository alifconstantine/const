import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const git = promisify(execFile);

/** Persistent task checkouts; allocating a second chat never returns the source project. */
export class TaskWorkspaces {
  private pending = new Map<string, Promise<string>>();

  constructor(private readonly home: string) {}

  async resolve(project: string, conversationId: string): Promise<string> {
    if (!conversationId?.trim()) throw new Error("A conversation is required to allocate a task workspace");
    const source = await fs.realpath(project);
    const key = createHash("sha256").update(source).update("\0").update(conversationId).digest("hex").slice(0, 24);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const operation = this.allocate(source, key);
    this.pending.set(key, operation);
    try { return await operation; }
    finally { this.pending.delete(key); }
  }

  private async allocate(source: string, key: string): Promise<string> {
    const directory = path.join(this.home, "workspaces", key);
    const storageRelative = path.relative(source, path.resolve(directory));
    if (!storageRelative.startsWith(".." + path.sep) && storageRelative !== ".." && !path.isAbsolute(storageRelative)) {
      throw new Error("Task workspace storage must be outside the source project");
    }
    const checkout = path.join(directory, "project");
    const manifest = path.join(directory, "workspace.json");
    try {
      const saved = JSON.parse(await fs.readFile(manifest, "utf8"));
      if (saved.source !== source || saved.checkout !== checkout || !(await fs.stat(checkout)).isDirectory()) {
        throw new Error("Task workspace metadata does not match its project");
      }
      return checkout;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await fs.mkdir(directory, { recursive: true });
    // A partial allocation is never silently reused after a failed copy or crash.
    try { await fs.lstat(checkout); throw new Error(`Incomplete task workspace requires recovery: ${checkout}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    let isGit = false;
    try { isGit = (await git("git", ["rev-parse", "--is-inside-work-tree"], { cwd: source })).stdout.trim() === "true"; }
    catch { /* A plain project is copied instead of creating a Git worktree. */ }
    if (isGit) {
      const { stdout } = await git("git", ["rev-parse", "--show-toplevel"], { cwd: source });
      // A project opened below a repository root is copied so its relative paths stay intact.
      isGit = await fs.realpath(stdout.trim()) === source;
      if (isGit) {
        try { await git("git", ["rev-parse", "--verify", "HEAD"], { cwd: source }); }
        catch { isGit = false; /* Empty repositories are copied without a shared index. */ }
      }
    }
    if (isGit) {
      await git("git", ["worktree", "add", "-b", `codex/task-${key}`, checkout, "HEAD"], { cwd: source });
      const [dirty, untracked, tracked] = await Promise.all([
        git("git", ["diff", "--name-only", "-z", "HEAD"], { cwd: source, maxBuffer: 16 * 1024 * 1024 }),
        git("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: source, maxBuffer: 16 * 1024 * 1024 }),
        git("git", ["ls-files", "--stage", "-z"], { cwd: source, maxBuffer: 16 * 1024 * 1024 }),
      ]);
      const symlinks = tracked.stdout.split("\0").filter(entry => entry.startsWith("120000 ")).map(entry => entry.slice(entry.indexOf("\t") + 1));
      for (const relative of new Set([...((dirty.stdout + untracked.stdout).split("\0").filter(Boolean)), ...symlinks])) {
        if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) throw new Error("Invalid project path");
        const from = path.join(source, relative), to = path.join(checkout, relative);
        try {
          await fs.lstat(from);
          await fs.mkdir(path.dirname(to), { recursive: true });
          try { if ((await fs.lstat(to)).isSymbolicLink()) await fs.unlink(to); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
          await fs.cp(from, to, { recursive: true, dereference: true, filter: entry => this.canCopy(source, entry, checkout) });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          // Only this freshly allocated checkout may have a tracked deletion applied.
          const resolved = path.resolve(to);
          if (!resolved.startsWith(path.resolve(checkout) + path.sep)) throw new Error("Invalid checkout deletion");
          await fs.rm(resolved, { force: true });
        }
      }
    } else {
      await fs.cp(source, checkout, {
        recursive: true, dereference: true,
        filter: entry => this.canCopy(source, entry, checkout),
      });
    }
    const temporary = `${manifest}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify({ source, checkout, kind: isGit ? "worktree" : "copy" }), "utf8");
    await fs.rename(temporary, manifest);
    return checkout;
  }

  private async canCopy(source: string, entry: string, checkout: string): Promise<boolean> {
    const parts = path.relative(source, entry).split(path.sep);
    if (parts.some(part => part === ".git" || part === "node_modules") ||
        parts.some((part, index) => part === ".const" && parts[index + 1] === "workspaces")) return false;
    if ((await fs.lstat(entry)).isSymbolicLink()) {
      const target = await fs.realpath(entry);
      if ((await fs.stat(target)).isDirectory()) {
        for (const candidate of [entry, checkout]) {
          const relative = path.relative(target, path.resolve(candidate));
          if (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)) {
            throw new Error(`Cannot isolate a recursive directory link: ${entry}`);
          }
        }
      }
    }
    return true;
  }
}
