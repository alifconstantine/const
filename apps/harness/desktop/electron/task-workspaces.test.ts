import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { TaskWorkspaces } from "./task-workspaces";
import { requireConversationId, updateSessionMode } from "./session-ownership";

const run = promisify(execFile);
async function fixture(execute: (root: string, project: string, service: TaskWorkspaces) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "const-workspace-test-"));
  const project = path.join(root, "source");
  await fs.mkdir(project);
  try { await execute(root, project, new TaskWorkspaces(path.join(root, "home"))); }
  finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("const-workspace-test-"));
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("four chats creating the same output cannot overwrite each other or the source", async () => fixture(async (root, project, service) => {
  await fs.writeFile(path.join(project, "reference.txt"), "original");
  const directories = await Promise.all(["a", "b", "c", "d"].map(id => service.resolve(project, id)));
  assert.equal(new Set(directories).size, 4);
  await Promise.all(directories.map(async (directory, index) => {
    assert.equal(await fs.readFile(path.join(directory, "reference.txt"), "utf8"), "original");
    await fs.mkdir(path.join(directory, "fernhollow"));
    await fs.writeFile(path.join(directory, "fernhollow/index.html"), String(index));
  }));
  for (const [index, directory] of directories.entries()) assert.equal(await fs.readFile(path.join(directory, "fernhollow/index.html"), "utf8"), String(index));
  await assert.rejects(fs.stat(path.join(project, "fernhollow")), { code: "ENOENT" });
  assert.equal(await new TaskWorkspaces(path.join(root, "home")).resolve(project, "a"), directories[0]);
  assert.deepEqual(await Promise.all([service.resolve(project, "a"), service.resolve(project, "a")]), [directories[0], directories[0]]);
}));

test("Git tasks get different branches and preserve tracked, staged, untracked and deleted input", async () => fixture(async (_root, project, service) => {
  await run("git", ["init", project]);
  await fs.writeFile(path.join(project, "tracked.txt"), "baseline");
  await fs.writeFile(path.join(project, "deleted.txt"), "baseline");
  await run("git", ["add", "."], { cwd: project });
  await run("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"], { cwd: project });
  await fs.writeFile(path.join(project, "tracked.txt"), "dirty staged input");
  await run("git", ["add", "tracked.txt"], { cwd: project });
  await fs.writeFile(path.join(project, "new.txt"), "untracked input");
  await fs.unlink(path.join(project, "deleted.txt"));
  const [a, b] = await Promise.all([service.resolve(project, "a"), service.resolve(project, "b")]);
  for (const directory of [a, b]) {
    assert.equal(await fs.readFile(path.join(directory, "tracked.txt"), "utf8"), "dirty staged input");
    assert.equal(await fs.readFile(path.join(directory, "new.txt"), "utf8"), "untracked input");
    await assert.rejects(fs.stat(path.join(directory, "deleted.txt")), { code: "ENOENT" });
  }
  assert.notEqual((await run("git", ["branch", "--show-current"], { cwd: a })).stdout, (await run("git", ["branch", "--show-current"], { cwd: b })).stdout);
  assert.equal(await fs.readFile(path.join(project, "tracked.txt"), "utf8"), "dirty staged input");
}));

test("invalid targets fail closed and an idle chat never changes the only running chat's mode", () => {
  for (const id of [undefined, "", "../a", "a/b"]) assert.throws(() => requireConversationId(id));
  let calls = 0;
  const b = { mode: "ask_before_changes", agent: { updateMode: () => { calls++; } } };
  const sessions = new Map([["b", b]]);
  assert.equal(updateSessionMode(sessions, "a", "full_access"), false);
  assert.equal(b.mode, "ask_before_changes");
  assert.equal(calls, 0);
  assert.equal(updateSessionMode(sessions, "b", "full_access"), true);
  assert.equal(b.mode, "full_access");
});

test("copied directory links cannot write through to the source or recursively copy task storage", async () => fixture(async (root, project, service) => {
  const peer = path.join(root, "peer"); await fs.mkdir(peer);
  await fs.writeFile(path.join(peer, "shared.txt"), "source");
  await fs.symlink(peer, path.join(project, "linked"), "junction");
  const checkout = await service.resolve(project, "a");
  assert.equal((await fs.lstat(path.join(checkout, "linked"))).isSymbolicLink(), false);
  await fs.writeFile(path.join(checkout, "linked/shared.txt"), "task");
  assert.equal(await fs.readFile(path.join(peer, "shared.txt"), "utf8"), "source");
  await fs.symlink(project, path.join(project, "loop"), "junction");
  await assert.rejects(service.resolve(project, "b"), /recursive directory link/);
}));
