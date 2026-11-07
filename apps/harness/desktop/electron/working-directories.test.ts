import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WorkingDirectories } from "./working-directories";
import { requireConversationId, updateSessionMode } from "./session-ownership";

const run = promisify(execFile);
async function fixture(execute: (root: string, project: string, service: WorkingDirectories) => Promise<void>) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, "const-directory-test-"));
  const project = path.join(root, "source");
  await fs.mkdir(project);
  try { await execute(root, project, new WorkingDirectories(path.join(root, "home"))); }
  finally {
    assert.equal(path.dirname(path.resolve(root)), temp);
    assert.ok(path.basename(root).startsWith("const-directory-test-"));
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("four chats use the actual selected project without allocating task copies", async () => fixture(async (root, project, service) => {
  await fs.writeFile(path.join(project, "reference.txt"), "original");
  const directories = await Promise.all(["a", "b", "c", "d"].map(id => service.resolve(project, id)));
  assert.deepEqual(directories, [project, project, project, project]);
  await fs.writeFile(path.join(directories[0]!, "result.txt"), "actual output");
  assert.equal(await fs.readFile(path.join(project, "result.txt"), "utf8"), "actual output");
  await assert.rejects(fs.stat(path.join(root, "home")), { code: "ENOENT" });
  assert.equal(await new WorkingDirectories(path.join(root, "home")).resolve(project, "a"), project);
}));

test("Git projects keep their branch, dirty files and working directory", async () => fixture(async (_root, project, service) => {
  await run("git", ["init", "-b", "fixture", project]);
  await fs.writeFile(path.join(project, "tracked.txt"), "baseline");
  await run("git", ["add", "."], { cwd: project });
  await run("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"], { cwd: project });
  await fs.writeFile(path.join(project, "tracked.txt"), "manual edit");
  const before = (await run("git", ["status", "--porcelain"], { cwd: project })).stdout;
  for (const owner of ["a", "b"]) assert.equal(await service.resolve(project, owner), project);
  assert.equal((await run("git", ["branch", "--show-current"], { cwd: project })).stdout.trim(), "fixture");
  assert.equal((await run("git", ["status", "--porcelain"], { cwd: project })).stdout, before);
  assert.equal((await run("git", ["worktree", "list", "--porcelain"], { cwd: project })).stdout.match(/^worktree /gm)?.length, 1);
}));

test("project aliases resolve to the same directory and missing projects never become Outside Project", async () => fixture(async (root, project, service) => {
  const alias = path.join(root, "alias");
  await fs.symlink(project, alias, "junction");
  assert.equal(await service.resolve(alias, "a"), project);
  await assert.rejects(service.resolve(path.join(root, "removed"), "a"), { code: "ENOENT" });
  const file = path.join(project, "file.txt"); await fs.writeFile(file, "text");
  await assert.rejects(service.resolve(file, "a"), /must be a folder/);
}));

test("Outside Project gets an owner-specific directory with the same configured fallback", async () => fixture(async (root, _project, service) => {
  const fallback = path.join(root, "home", "brain", "a");
  assert.equal(await service.resolve(undefined, "a"), fallback);
  assert.notEqual(await service.resolve("Outside Project", "b"), fallback);
  const configured = path.join(root, "outside"); await fs.mkdir(configured);
  assert.equal(await service.resolve("Outside Project", "a", configured), path.join(configured, "a"));
  assert.equal(await service.resolve(undefined, "a", path.join(root, "missing-default")), fallback);
}));

test("legacy bindings are read-only and cannot redirect a chat into another copy", async () => fixture(async (root, project, service) => {
  assert.equal(await service.legacy(project, "a"), undefined);
  await assert.rejects(fs.stat(path.join(root, "home")), { code: "ENOENT" });
  const directories: string[] = [];
  for (const owner of ["a", "b"]) {
    const key = createHash("sha256").update(project).update("\0").update(owner).digest("hex").slice(0, 24);
    const directory = path.join(root, "home", "workspaces", key);
    const checkout = path.join(directory, "project"); directories.push(checkout);
    await fs.mkdir(checkout, { recursive: true });
    await fs.writeFile(path.join(directory, "workspace.json"), JSON.stringify({ source: project, checkout }));
    await fs.writeFile(path.join(checkout, "old-output.txt"), owner);
    assert.equal(await service.legacy(project, owner), checkout);
    assert.equal(await service.resolve(project, owner), project);
    assert.equal(await fs.readFile(path.join(checkout, "old-output.txt"), "utf8"), owner);
  }
  await fs.rm(directories[0]!, { recursive: true });
  await fs.symlink(directories[1]!, directories[0]!, "junction");
  await assert.rejects(service.legacy(project, "a"), /metadata does not match/);
}));

test("invalid owners fail closed and an idle chat never changes another chat's mode", () => {
  for (const id of [undefined, "", "../a", "a/b"]) assert.throws(() => requireConversationId(id));
  let calls = 0;
  const b = { mode: "ask_before_changes", agent: { updateMode: () => { calls++; } } };
  const sessions = new Map([["b", b]]);
  assert.equal(updateSessionMode(sessions, "a", "full_access"), false);
  assert.equal(calls, 0);
  assert.equal(updateSessionMode(sessions, "b", "full_access"), true);
  assert.equal(b.mode, "full_access");
});
