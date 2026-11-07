import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveTerminalDirectory } from "./terminal-directory";

async function fixture(run: (root: string, project: string) => Promise<void>) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, "const-terminal-directory-"));
  const project = path.join(root, "project"); await fs.mkdir(project);
  try { await run(root, project); }
  finally {
    assert.equal(path.dirname(path.resolve(root)), temp);
    assert.ok(path.basename(root).startsWith("const-terminal-directory-"));
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("terminal starts at the selected directory even when nested websites exist", async () => fixture(async (_root, project) => {
  await fs.mkdir(path.join(project, "site"));
  await fs.writeFile(path.join(project, "site", "index.html"), "website");
  assert.equal(await resolveTerminalDirectory({ workspaceRoot: project }), project);
  assert.equal(await resolveTerminalDirectory({ workspaceRoot: project, cwd: "site" }), path.join(project, "site"));
  assert.equal(await resolveTerminalDirectory({ workspaceRoot: project, cwd: project }), project);
}));

test("explicit cwd rejects traversal, other workspaces, missing paths and external symlinks", async () => fixture(async (root, project) => {
  const peer = path.join(root, "peer"); await fs.mkdir(peer);
  await fs.symlink(peer, path.join(project, "escape"), "junction");
  for (const cwd of ["..", peer, path.join(project, "escape")]) {
    await assert.rejects(resolveTerminalDirectory({ workspaceRoot: project, cwd }), /outside/);
  }
  await assert.rejects(resolveTerminalDirectory({ workspaceRoot: project, cwd: "removed" }), { code: "ENOENT" });
  await fs.writeFile(path.join(project, "file"), "text");
  await assert.rejects(resolveTerminalDirectory({ workspaceRoot: project, cwd: "file" }), /must be a folder/);
}));

test("a selected project symlink preserves explicit subdirectory hints", async () => fixture(async (root, project) => {
  const alias = path.join(root, "alias"); await fs.symlink(project, alias, "junction");
  await fs.mkdir(path.join(project, "site"));
  assert.equal(await resolveTerminalDirectory({ workspaceRoot: project, project: alias, cwd: path.join(alias, "site") }), path.join(project, "site"));
}));

test("old terminal tabs return to the actual project while another chat's copy is rejected", async () => fixture(async (root, project) => {
  const legacy = path.join(root, "old-a", "project");
  const peer = path.join(root, "old-b", "project");
  await fs.mkdir(path.join(legacy, "site"), { recursive: true });
  await fs.mkdir(peer, { recursive: true });
  assert.equal(await resolveTerminalDirectory({ workspaceRoot: project, cwd: path.join(legacy, "site"), legacyWorkspace: legacy }), project);
  await assert.rejects(resolveTerminalDirectory({ workspaceRoot: project, cwd: peer, legacyWorkspace: legacy }), /outside/);
}));
