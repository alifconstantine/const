import { test, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { BackgroundProcessManager, executeNativeTool } from "../src/const/tools.js";
import { recordMutation, getMutationHistory, executeRollbackMutation, clearMutationHistory, clearCheckpoints, createCheckpoint, restoreCheckpoint } from "../src/const/checkpoint.js";
import { rollbackFileMutation } from "../src/const/mutation-ledger.js";
import { executeRetain } from "../src/const/memory.js";
import { checkBashInterception } from "../src/const/bash-interceptor.js";
import { globalSubAgentManager } from "../src/const/subagent.js";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "const-isolation-test-"));
  vi.spyOn(os, "homedir").mockReturnValue(root);
  clearMutationHistory(); clearCheckpoints();
});
afterEach(async () => {
  vi.restoreAllMocks(); clearMutationHistory(); clearCheckpoints();
  globalSubAgentManager.clearSubAgents();
  expect(path.dirname(path.resolve(root))).toBe(path.resolve(os.tmpdir()));
  await fs.rm(root, { recursive: true, force: true });
});

test("rollback from A cannot select the latest mutation or checkpoint from B", async () => {
  const a = path.join(root, "a"), b = path.join(root, "b");
  await fs.mkdir(a); await fs.mkdir(b);
  const fileA = path.join(a, "x.txt"), fileB = path.join(b, "x.txt");
  await fs.writeFile(fileA, "A new"); await fs.writeFile(fileB, "B new");
  recordMutation({ id: "A", operation: "modify", absolutePath: fileA, previousContent: "A old", newContent: "A new", timestamp: 1 });
  recordMutation({ id: "B", operation: "modify", absolutePath: fileB, previousContent: "B old", newContent: "B new", timestamp: 2 });
  expect((await executeRollbackMutation({}, a)).details.map(d => d.id)).toEqual(["A"]);
  expect(await fs.readFile(fileB, "utf8")).toBe("B new");
  await createCheckpoint({ name: "A" }, a);
  const cpB = await createCheckpoint({ name: "B" }, b);
  expect((await restoreCheckpoint({}, a)).checkpointName).toBe("A");
  expect((await restoreCheckpoint({ checkpointId: cpB.id }, a)).success).toBe(false);
});

test("two conversations in a shared directory can only undo their own mutations", async () => {
  await executeNativeTool("write", { path: "a.txt", content: "A" }, root, { conversationId: "a" });
  await executeNativeTool("write", { path: "b.txt", content: "B" }, root, { conversationId: "b" });
  expect((await executeRollbackMutation({}, root, "a")).details.map(d => d.file)).toContain("a.txt");
  expect(await fs.readFile(path.join(root, "b.txt"), "utf8")).toBe("B");
  expect((await executeRollbackMutation({}, root)).success).toBe(false);
});

test("undo refuses to delete or replace another writer's newer contents", async () => {
  const file = path.join(root, "shared.txt");
  await fs.writeFile(file, "newer external edit");
  for (const operation of ["create", "modify"] as const) {
    const result = await rollbackFileMutation({ id: operation, operation, absolutePath: file, previousContent: "old", newContent: "A wrote this", timestamp: 1 });
    expect(result.success).toBe(false);
  }
  expect(await fs.readFile(file, "utf8")).toBe("newer external edit");
});

test("a stale read cannot authorize a full rewrite after another conversation edits", async () => {
  const file = path.join(root, "shared.txt");
  await fs.writeFile(file, "baseline");
  for (const conversationId of ["a", "b"]) await executeNativeTool("read", { path: file }, root, { conversationId });
  expect((await executeNativeTool("write", { path: file, content: "B" }, root, { conversationId: "b" })).isError).toBe(false);
  expect((await executeNativeTool("write", { path: file, content: "A stale" }, root, { conversationId: "a" })).isError).toBe(true);
  expect(await fs.readFile(file, "utf8")).toBe("B");
});

test("four conversations write their requested subfolders directly into one project and retain their own undo history", async () => {
  const owners = ["a", "b", "c", "d"];
  const results = await Promise.all(owners.map(conversationId => executeNativeTool("write", {
    path: `site-${conversationId}/index.html`, content: conversationId,
  }, root, { conversationId })));
  expect(results.every(result => !result.isError)).toBe(true);
  for (const owner of owners) {
    expect(await fs.readFile(path.join(root, `site-${owner}/index.html`), "utf8")).toBe(owner);
    const mutations = getMutationHistory({ conversationId: owner });
    expect(mutations).toHaveLength(1);
    expect(mutations[0]?.workspaceRoot).toBe(root);
    expect(mutations[0]?.absolutePath).toBe(path.join(root, `site-${owner}/index.html`));
  }
  expect((await executeRollbackMutation({}, root, "a")).success).toBe(true);
  await expect(fs.stat(path.join(root, "site-a/index.html"))).rejects.toMatchObject({ code: "ENOENT" });
  for (const owner of owners.slice(1)) expect(await fs.readFile(path.join(root, `site-${owner}/index.html`), "utf8")).toBe(owner);
});

test("concurrent creates of the same project file have one winner and stale concurrent edits cannot overwrite it", async () => {
  const owners = ["a", "b", "c", "d"];
  const file = path.join(root, "shared.txt");
  const creates = await Promise.all(owners.map(conversationId => executeNativeTool("write", {
    path: "shared.txt", content: `created by ${conversationId}`,
  }, root, { conversationId })));
  expect(creates.filter(result => !result.isError)).toHaveLength(1);
  expect(creates.filter(result => result.isError).every(result => String(result.result).includes("File conflict"))).toBe(true);
  const original = await fs.readFile(file, "utf8");
  await Promise.all(owners.map(conversationId => executeNativeTool("read", { path: "shared.txt" }, root, { conversationId })));
  const edits = await Promise.all(owners.map(conversationId => executeNativeTool("edit", {
    path: "shared.txt", old_content: original, new_content: `edited by ${conversationId}`,
  }, root, { conversationId })));
  expect(edits.filter(result => !result.isError)).toHaveLength(1);
  expect(edits.filter(result => result.isError).every(result => String(result.result).includes("File conflict"))).toBe(true);
  expect(await fs.readFile(file, "utf8")).toMatch(/^edited by [abcd]$/);
});

test("checkpoint conflicts remain failures and never overwrite manual edits", async () => {
  await executeNativeTool("write", { path: "shared.txt", content: "baseline" }, root, { conversationId: "a" });
  const checkpoint = await createCheckpoint({ conversationId: "a" }, root);
  await executeNativeTool("write", { path: "shared.txt", content: "agent edit" }, root, { conversationId: "a" });
  await fs.writeFile(path.join(root, "shared.txt"), "manual edit");
  const result = await restoreCheckpoint({ checkpointId: checkpoint.id, conversationId: "a" }, root);
  expect(result.success).toBe(false);
  expect(result.message).toContain("conflict");
  expect(await fs.readFile(path.join(root, "shared.txt"), "utf8")).toBe("manual edit");
  expect((await executeRollbackMutation({}, root, "a")).success).toBe(false);
});

test("absolute source-project paths are redirected into the task, while other workspaces are refused", async () => {
  const source = path.join(root, "source"), task = path.join(root, "task");
  await fs.mkdir(source); await fs.mkdir(task);
  const options = { conversationId: "a", parentConfig: { baseUrl: "https://example.invalid", apiKey: "", model: "test", sourceProjectPath: source, workspacePath: task, isolateWorkspace: true } };
  expect((await executeNativeTool("write", { path: path.join(source, "new.txt"), content: "A" }, task, options)).isError).toBe(false);
  expect(await fs.readFile(path.join(task, "new.txt"), "utf8")).toBe("A");
  await expect(fs.stat(path.join(source, "new.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  expect((await executeNativeTool("write", { path: path.join(root, "source-other", "new.txt"), content: "wrong" }, task, options)).isError).toBe(true);
  expect((await executeNativeTool("bash", { command: "echo wrong", cwd: root }, task, options)).isError).toBe(true);
});

test("omitting a subagent owner cannot list or cancel agents belonging to other conversations", () => {
  const agent = globalSubAgentManager.spawnSubAgent({ prompt: "A", conversationId: "a" }, { workspacePath: root });
  expect(globalSubAgentManager.getSubAgent(agent.id)).toBeUndefined();
  expect(globalSubAgentManager.listSubAgents()).toEqual([]);
  expect(globalSubAgentManager.killSubAgent(agent.id)).toBe(false);
  expect(globalSubAgentManager.killAllRunningSubAgents()).toBe(0);
  expect(agent.status).toBe("running");
});

test("four same-named jobs keep separate output and stopping one owner's job leaves the other three running", async () => {
  const manager = new BackgroundProcessManager();
  const tasks = ["a", "b", "c", "d"].map(conversationId => manager.startTask(
    `node -e "console.log('JOB_${conversationId}');setInterval(()=>{},1000)"`, root,
    { conversationId, name: "website-server" },
  ));
  try {
    await expect.poll(() => tasks.every(task => task.logs.some(line => line.includes(`JOB_${task.conversationId}`))), { timeout: 5000 }).toBe(true);
    for (const task of tasks) {
      const owner = task.conversationId!;
      expect(manager.listTasks(owner).map(item => item.id)).toEqual([task.id]);
      expect(manager.getTask("website-server", owner)?.id).toBe(task.id);
      expect(task.logs.some(line => /JOB_/.test(line) && !line.includes(`JOB_${owner}`))).toBe(false);
    }
    expect(manager.killTask(tasks[1]!.id, "a")).toBe(false);
    expect(manager.killTask("website-server", "a")).toBe(true);
    expect(tasks[0]!.status).toBe("killed");
    expect(tasks.slice(1).every(task => task.status === "running")).toBe(true);
  } finally {
    const closed = tasks.filter(task => task.child && task.child.exitCode === null && task.child.signalCode === null).map(task => once(task.child!, "close"));
    for (const task of tasks) manager.killTask(task.id, task.conversationId);
    await Promise.all(closed);
  }
});

test("four concurrent retains preserve every entry in both shared memory files", async () => {
  await Promise.all(["A", "B", "C", "D"].map(content => executeRetain([{ content }], root)));
  const index = JSON.parse(await fs.readFile(path.join(root, ".const/memory/memories.json"), "utf8"));
  expect(index.map((item: { content: string }) => item.content).sort()).toEqual(["A", "B", "C", "D"]);
  const markdown = await fs.readFile(path.join(root, ".const/memory/MEMORY.md"), "utf8");
  for (const letter of ["A", "B", "C", "D"]) expect(markdown).toContain(`\n${letter}\n`);
});

test("an occupied foreign port never verifies a new job, and omitted owners cannot inspect or kill owned jobs", async () => {
  const server = createServer((_req, res) => res.end("A")); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const manager = new BackgroundProcessManager();
  const task = manager.startTask('node -e "setInterval(()=>{},1000)"', root, { conversationId: "b" });
  try {
    const ready = await manager.waitForReady(task.id, { port: (server.address() as { port: number }).port, timeout: 0.2 }, "b");
    expect(ready.ready).toBe(false);
    expect(manager.getTask(task.id)).toBeUndefined();
    expect(manager.listTasks()).toEqual([]);
    expect(manager.killTask(task.id)).toBe(false);
    expect(task.status).toBe("running");
    expect((await manager.waitForReady(task.id, { log: "NEVER", timeout: 0.02 }, "b")).ready).toBe(false);
  } finally {
    const closed = once(task.child!, "close"); manager.killTask(task.id, "b"); await closed;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}, 15_000);

test("cancelling immediately after registration never starts the shell command", async () => {
  const manager = new BackgroundProcessManager();
  const task = manager.startTask(`node -e "require('fs').writeFileSync('should-not-run.txt','ran');setInterval(()=>{},1000)"`, root, { conversationId: "a" });
  const closed = once(task.child!, "close");
  manager.killTask(task.id, "a");
  await closed;
  await expect(fs.stat(path.join(root, "should-not-run.txt"))).rejects.toMatchObject({ code: "ENOENT" });
});

test("a child-owned listening socket verifies successfully and emits only its owner's task events", async () => {
  const manager = new BackgroundProcessManager();
  const events: Array<{ conversationId?: string }> = [];
  manager.subscribe(event => events.push(event));
  const task = manager.startTask(`node -e "const s=require('http').createServer((q,r)=>r.end('B'));s.listen(0,'127.0.0.1',()=>console.log('listening on '+s.address().port));"`, root, { conversationId: "b" });
  try {
    await expect.poll(() => task.port, { timeout: 5000 }).toBeGreaterThan(0);
    expect((await manager.waitForReady(task.id, { port: task.port, timeout: 10 }, "b")).ready).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every(event => event.conversationId === "b")).toBe(true);
  } finally { const closed = once(task.child!, "close"); manager.killTask(task.id, "b"); await closed; }
}, 15_000);

test("shell detachment cannot bypass supervision while quoted ampersands and redirection still work", () => {
  for (const command of ["node server.js &", "cd project && node server.js &", "nohup node server.js", "Start-Process node"]) expect(checkBashInterception(command).intercepted).toBe(true);
  for (const command of ['node -e "console.log(\'a&b\')"', "node server.js 2>&1", "cd project && node server.js"]) expect(checkBashInterception(command).intercepted).toBe(false);
  expect(checkBashInterception("& 'C:/Program Files/nodejs/node.exe' server.js", "powershell").intercepted).toBe(false);
});
