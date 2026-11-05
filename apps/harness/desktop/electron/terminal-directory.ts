import fs from "node:fs/promises";
import path from "node:path";

function within(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

/** Agent and terminal share the selected working directory. A saved terminal
 * pointing into this chat's retired checkout reopens at the actual project. */
export async function resolveTerminalDirectory(options: {
  workspaceRoot: string;
  project?: string;
  cwd?: string;
  legacyWorkspace?: string;
}): Promise<string> {
  const root = await fs.realpath(options.workspaceRoot);
  if (!options.cwd) return root;
  const requested = path.resolve(options.cwd);
  if (options.legacyWorkspace && within(path.resolve(options.legacyWorkspace), requested)) return root;
  const alias = options.project ? path.resolve(options.project) : path.resolve(options.workspaceRoot);
  const mapped = path.isAbsolute(options.cwd)
    ? within(alias, requested) ? path.resolve(root, path.relative(alias, requested)) : requested
    : path.resolve(root, options.cwd);
  const actual = await fs.realpath(mapped);
  if (!within(root, actual)) throw new Error("Terminal directory is outside the selected working directory");
  if (!(await fs.stat(actual)).isDirectory()) throw new Error("Terminal working directory must be a folder");
  return actual;
}
