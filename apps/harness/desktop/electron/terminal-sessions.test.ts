import assert from "node:assert/strict";
import test from "node:test";
import type { IPty } from "node-pty";
import { TerminalSessions, terminalCommand } from "./terminal-sessions";

function fixture() {
  const writes: string[] = [], resizes: number[][] = [], data: unknown[] = [], exits: unknown[] = [];
  let killed = 0, spawned = 0;
  let onData: (text: string) => void = () => {};
  let onExit: (event: { exitCode: number }) => void = () => {};
  const process = {
    write: (value: string) => writes.push(value),
    resize: (cols: number, rows: number) => resizes.push([cols, rows]),
    kill: () => { killed++; },
    onData: (callback: typeof onData) => { onData = callback; return { dispose() {} }; },
    onExit: (callback: typeof onExit) => { onExit = callback; return { dispose() {} }; },
  } as unknown as IPty;
  const spawner = () => { spawned++; return process; };
  const sessions = new TerminalSessions({ data: p => data.push(p), exit: p => exits.push(p) }, async () => spawner);
  return { sessions, spawner, writes, resizes, data, exits, killed: () => killed, spawned: () => spawned, output: (text: string) => onData(text), exit: (exitCode: number) => onExit({ exitCode }) };
}

const owner = { id: "terminal-a", conversationId: "chat-a" };
const options = { ...owner, cwd: process.cwd(), cols: 90, rows: 30 };

test("Windows shells use direct executable paths and a console, preserving spaces", () => {
  assert.deepEqual(terminalCommand(undefined, "win32", { ComSpec: "C:\\Windows\\System32\\cmd.exe" }), { file: "C:\\Windows\\System32\\cmd.exe", args: [] });
  assert.deepEqual(terminalCommand("C:\\Program Files\\PowerShell\\7\\pwsh.exe", "win32", {}), { file: "C:\\Program Files\\PowerShell\\7\\pwsh.exe", args: [] });
  assert.deepEqual(terminalCommand(undefined, "linux", { SHELL: "/bin/bash" }), { file: "/bin/bash", args: ["-i"] });
});

test("PTY input, output, resize, exit and ownership stay with their conversation", async () => {
  const f = fixture();
  await f.sessions.create(options);
  assert.equal(f.sessions.write({ ...owner, data: "echo hello\r" }), true);
  assert.equal(f.sessions.resize({ ...owner, cols: 120, rows: 45 }), true);
  assert.equal(f.sessions.write({ ...owner, conversationId: "chat-b", data: "wrong" }), false);
  assert.equal(f.sessions.resize({ ...owner, conversationId: "chat-b", cols: 1, rows: 1 }), false);
  assert.equal(f.sessions.resize({ ...owner, cols: NaN, rows: 0 }), false);
  assert.equal(f.sessions.destroy(owner.id, "chat-b"), false);
  await assert.rejects(f.sessions.create({ ...options, conversationId: "chat-b" }), /another conversation/);
  f.output("hello\r\n");
  assert.deepEqual(f.writes, ["echo hello\r"]);
  assert.deepEqual(f.resizes, [[120, 45]]);
  assert.deepEqual(f.data, [{ ...owner, data: "hello\r\n", sequence: 1 }]);
  f.exit(0);
  assert.deepEqual(f.exits, [{ ...owner, code: 0 }]);
  assert.equal(f.sessions.write({ ...owner, data: "x" }), false);
});

test("reattaching replays bounded output with a sequence boundary and does not spawn again", async () => {
  const f = fixture();
  await f.sessions.create(options);
  f.output("x".repeat(80_000));
  f.output("\r\nPROMPT> ");
  const attached = await f.sessions.create(options);
  assert.equal(attached.sequence, 2);
  assert.equal(attached.replay.length, 65_536);
  assert.equal(attached.replay.endsWith("\r\nPROMPT> "), true);
  assert.equal(f.spawned(), 1);
  f.sessions.destroyAll();
});

test("concurrent create requests start one shell and shutdown cancels pending creation", async () => {
  const f = fixture();
  await Promise.all([f.sessions.create(options), f.sessions.create(options)]);
  assert.equal(f.spawned(), 1);
  f.sessions.destroyAll();
  assert.equal(f.killed(), 1);
  const pending = f.sessions.create(options);
  f.sessions.destroyAll();
  await assert.rejects(pending, /cancelled/);
  assert.equal(f.spawned(), 1);
});

test("closing a tab while its directory resolves cancels the pending shell", async () => {
  const f = fixture();
  let resolveDirectory!: (cwd: string) => void;
  const opening = f.sessions.create({
    ...options,
    cwd: () => new Promise(resolve => { resolveDirectory = resolve; }),
  });
  assert.equal(f.sessions.destroy(owner.id, "chat-b"), false);
  assert.equal(f.sessions.destroy(owner.id, owner.conversationId), true);
  resolveDirectory(options.cwd);
  await assert.rejects(opening, /cancelled/);
  assert.equal(f.spawned(), 0);
  await f.sessions.create(options);
  assert.equal(f.spawned(), 1);
  f.sessions.destroyAll();
});

test("a missing native addon rejects creation and can be retried", async () => {
  const f = fixture();
  let first = true;
  const sessions = new TerminalSessions({ data() {}, exit() {} }, async () => {
    if (first) { first = false; throw new Error("Native addon unavailable"); }
    return f.spawner;
  });
  await assert.rejects(sessions.create(options), /Native addon unavailable/);
  assert.equal((await sessions.create(options)).success, true);
  sessions.destroyAll();
});

test("real PTY exposes an interactive console and receives resized dimensions", { timeout: 10_000 }, async () => {
  const { spawn } = await import("node-pty");
  let output = "";
  let notify: () => void = () => {};
  const sessions = new TerminalSessions({ data: p => { output += p.data; notify(); }, exit() {} }, async () => (_file, _args, spawnOptions) => spawn(process.execPath, ["-e", `
    process.stdin.setRawMode(true);
    process.stdout.write('READY');
    process.stdin.on('data', () => process.stdout.write(JSON.stringify({ tty: process.stdin.isTTY, cols: process.stdout.columns, rows: process.stdout.rows })));
  `], spawnOptions));
  async function waitFor(predicate: () => boolean) {
    if (predicate()) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("PTY output timeout: " + output)), 5000);
      notify = () => { if (predicate()) { clearTimeout(timer); resolve(); } };
    });
  }
  try {
    await sessions.create(options);
    await waitFor(() => output.includes("READY"));
    sessions.resize({ ...owner, cols: 111, rows: 33 });
    sessions.write({ ...owner, data: "z" });
    await waitFor(() => output.includes('"rows":33'));
    assert.match(output, /"tty":true,"cols":111,"rows":33/);
  } finally { sessions.destroyAll(); }
});
