import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { requireConversationId } from "./session-ownership";

/** Project files belong to the selected directory. Session data is stored
 * separately by ConversationDatabase, never in an automatically copied project. */
export class WorkingDirectories {
  constructor(private readonly home: string) {}

  async resolve(project: string | undefined, conversationId: string, defaultLocation?: string): Promise<string> {
    const owner = requireConversationId(conversationId);
    if (project && project !== "Outside Project") {
      const root = await fs.realpath(project);
      if (!(await fs.stat(root)).isDirectory()) throw new Error("Project working directory must be a folder");
      return root;
    }
    let base = path.join(this.home, "brain");
    if (defaultLocation) {
      try { if ((await fs.stat(defaultLocation)).isDirectory()) base = defaultLocation; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    const directory = path.join(base, owner);
    await fs.mkdir(directory, { recursive: true });
    return fs.realpath(directory);
  }

  /** Compatibility for old saved terminal tabs only. Never allocate or move an
   * old copy, and never treat another chat's copy as an alias of this project. */
  async legacy(project: string, conversationId: string): Promise<string | undefined> {
    const source = await fs.realpath(project);
    const owner = requireConversationId(conversationId);
    const key = createHash("sha256").update(source).update("\0").update(owner).digest("hex").slice(0, 24);
    const directory = path.join(this.home, "workspaces", key);
    const checkout = path.join(directory, "project");
    let saved: { source?: string; checkout?: string };
    try { saved = JSON.parse(await fs.readFile(path.join(directory, "workspace.json"), "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    if (saved.source !== source || saved.checkout !== checkout || !(await fs.stat(checkout)).isDirectory() ||
        path.relative(await fs.realpath(directory), await fs.realpath(checkout)) !== "project") {
      throw new Error("Legacy task workspace metadata does not match its project");
    }
    return checkout;
  }
}

export function workingDirectoryInstructions(directory: string, sessionDirectory: string): string {
  return `Current working directory: ${directory}. Read and edit project files and run commands here. Session logs and metadata are stored separately at ${sessionDirectory}; that location is not the project output directory. Earlier messages may mention retired per-chat project copies: the current working directory above takes precedence. Other chats can work in this same project. Inspect the latest file contents before editing, preserve unrelated changes, and use distinct subfolders for independently requested deliverables. Manage background jobs through this conversation's own job tools.`;
}
