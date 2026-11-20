import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { AgentDesktopRunner } from "../../../apps/harness/desktop/electron/computer/agent-desktop-runner";
import {
  AgentDesktopController,
  normalizeKeyCombo,
} from "../../../apps/harness/desktop/electron/computer/agent-desktop-controller";

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdinData = "";
  stdin = new Writable({
    write: (chunk, _enc, done) => {
      this.stdinData += String(chunk);
      done();
    },
  });
  kill = vi.fn(() => {
    queueMicrotask(() => this.emit("close", 1, "SIGKILL"));
    return true;
  });

  respondJson(payload: unknown, code = 0) {
    this.stdout.write(JSON.stringify(payload) + "\n");
    this.stdout.end();
    this.stderr.end();
    queueMicrotask(() => this.emit("close", code, null));
  }
}

interface SpawnCall {
  binary: string;
  args: string[];
  env: Record<string, string | undefined>;
  child: FakeChild;
}

const runners: AgentDesktopRunner[] = [];

function createMockRunner(options?: {
  autoReply?: (call: SpawnCall) => unknown;
  defaultTimeoutMs?: number;
  maxOutputBytes?: number;
}) {
  const calls: SpawnCall[] = [];
  const spawnMock = vi.fn((binary: string, args: string[], opts: any) => {
    const child = new FakeChild();
    const call: SpawnCall = { binary, args, env: opts?.env ?? {}, child };
    calls.push(call);
    if (options?.autoReply) {
      queueMicrotask(() => {
        const reply = options.autoReply!(call);
        if (reply !== undefined) child.respondJson(reply);
      });
    }
    return child as unknown as ChildProcess;
  });

  const runner = new AgentDesktopRunner({
    binaryPath: "/mock/agent-desktop",
    stateRoot: "/mock/state",
    defaultTimeoutMs: options?.defaultTimeoutMs ?? 5_000,
    maxOutputBytes: options?.maxOutputBytes ?? 1024 * 1024,
    spawnImpl: spawnMock as unknown as typeof spawn,
  });
  runners.push(runner);
  return { runner, calls, spawnMock };
}

afterEach(() => {
  for (const runner of runners.splice(0)) {
    runner.dispose();
  }
  vi.useRealTimers();
});

describe("AgentDesktopRunner lifecycle & safety", () => {
  it("serializes concurrent commands and places global flags before the subcommand", async () => {
    const { runner, calls } = createMockRunner();
    const first = runner.run(["snapshot", "--app", "Notepad"], { session: "h_one" });
    const second = runner.run(["click", "@s1:e2"], { session: "h_one", headed: true });

    await Promise.resolve();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toEqual(["--session", "h_one", "snapshot", "--app", "Notepad"]);
    expect(calls[0]!.env.AGENT_DESKTOP_HOME).toBe("/mock/state");

    calls[0]!.child.respondJson({ ok: true, command: "snapshot", data: { snapshot_id: "s1" } });
    expect((await first).ok).toBe(true);

    await Promise.resolve();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.args).toEqual(["--session", "h_one", "--headed", "click", "@s1:e2"]);
    calls[1]!.child.respondJson({ ok: true, command: "click", data: {} });
    expect((await second).ok).toBe(true);
  });

  it("pipes text via stdin without leaking values into process argv", async () => {
    const { runner, calls } = createMockRunner({
      autoReply: () => ({ ok: true, command: "set-value", data: {} }),
    });
    const secret = "super-secret-value-123";
    const res = await runner.run(["set-value", "@s1:e5", "--stdin"], { stdin: secret });
    expect(res.ok).toBe(true);
    expect(calls[0]!.args).not.toContain(secret);
    expect(calls[0]!.child.stdinData).toBe(secret);
  });

  it("kills a timed-out child process and rejects cleanly", async () => {
    vi.useFakeTimers();
    const { runner, calls } = createMockRunner({ defaultTimeoutMs: 1_000 });
    const pending = runner.run(["snapshot", "--app", "HungApp"], { timeoutMs: 1_000 });
    const rejected = expect(pending).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(1_050);
    await rejected;
    expect(calls[0]!.child.kill).toHaveBeenCalledTimes(1);
  });

  it("cancels an in-flight command when AbortSignal fires", async () => {
    const { runner, calls } = createMockRunner();
    const ac = new AbortController();
    const pending = runner.run(["wait", "5000"], { signal: ac.signal });
    await Promise.resolve();
    ac.abort();
    await expect(pending).rejects.toThrow("aborted");
    expect(calls[0]!.child.kill).toHaveBeenCalledTimes(1);
  });

  it("enforces stdout buffer limit and rejects oversized output", async () => {
    const { runner, calls } = createMockRunner({ maxOutputBytes: 128 });
    const pending = runner.run(["snapshot"]);
    await Promise.resolve();
    calls[0]!.child.stdout.write("x".repeat(256));
    await expect(pending).rejects.toThrow("buffer limit");
    expect(calls[0]!.child.kill).toHaveBeenCalledTimes(1);
  });

  it("rejects calls after dispose()", async () => {
    const { runner } = createMockRunner();
    runner.dispose();
    await expect(runner.run(["status"])).rejects.toThrow("disposed");
  });
});

describe("AgentDesktopController tool routing & session isolation", () => {
  it("normalizes cross-platform keyboard chords accurately", () => {
    expect(normalizeKeyCombo("CmdOrCtrl+S", "win32")).toBe("ctrl+s");
    expect(normalizeKeyCombo("CmdOrCtrl+S", "linux")).toBe("ctrl+s");
    expect(normalizeKeyCombo("CmdOrCtrl+S", "darwin")).toBe("cmd+s");
    expect(normalizeKeyCombo("Ctrl+Shift+Enter", "win32")).toBe("ctrl+shift+return");
    expect(normalizeKeyCombo("Esc", "win32")).toBe("escape");
  });

  it("isolates sessions with an exclusive desktop lock until releaseSession", async () => {
    const { runner } = createMockRunner({
      autoReply: () => ({ ok: true, command: "list-apps", data: [{ name: "Notepad", pid: 42 }] }),
    });
    const controller = new AgentDesktopController(runner, "win32");

    const first = await controller.executeTool("computer_list_apps", {}, { sessionId: "conv-a" });
    expect(first.isError).toBe(false);
    expect(first.result).toContain("Notepad");

    const blocked = await controller.executeTool("computer_list_apps", {}, { sessionId: "conv-b" });
    expect(blocked.isError).toBe(true);
    expect(blocked.result).toContain("in use by another conversation");

    controller.releaseSession("conv-a");
    const allowed = await controller.executeTool("computer_list_apps", {}, { sessionId: "conv-b" });
    expect(allowed.isError).toBe(false);
  });

  it("formats compact accessibility snapshots without automatic screenshots", async () => {
    const { runner, calls } = createMockRunner({
      autoReply: () => ({
        ok: true,
        command: "snapshot",
        data: {
          snapshot_id: "s1234",
          app: "Notepad",
          ref_count: 2,
          window: { id: "win-1", title: "Untitled - Notepad" },
          tree: {
            role: "window",
            name: "Untitled - Notepad",
            children: [
              { ref_id: "@s1234:e1", role: "document", name: "Text Editor", value: "hello", states: ["focused"] },
              { ref_id: "@s1234:e2", role: "button", name: "Save", bounds: { x: 10, y: 20, width: 80, height: 30 } },
            ],
          },
        },
      }),
    });
    const controller = new AgentDesktopController(runner, "win32");

    const res = await controller.executeTool(
      "computer_snapshot",
      { app: "Notepad", includeBounds: true },
      { sessionId: "s1" },
    );
    expect(res.isError).toBe(false);
    expect(res.images).toBeUndefined();
    expect(calls[0]!.args).toEqual([
      "--session",
      "h_s1",
      "snapshot",
      "--app",
      "Notepad",
      "-i",
      "--compact",
      "--include-bounds",
    ]);
    expect(res.result).toContain("snapshot_id: s1234");
    expect(res.result).toContain('@s1234:e1 document "Text Editor" value="hello" [focused]');
    expect(res.result).toContain('@s1234:e2 button "Save" @(10,20 80x30)');
  });

  it("routes headless click, headed double-click, coordinate click, set_value, and paste_text", async () => {
    const { runner, calls } = createMockRunner({
      autoReply: () => ({ ok: true, data: { disposition: { delivery: "delivered" } } }),
    });
    const controller = new AgentDesktopController(runner, "win32");

    await controller.executeTool("computer_click", { ref: "@s1:e3" }, { sessionId: "c1" });
    expect(calls[0]!.args).toEqual(["--session", "h_c1", "click", "@s1:e3"]);

    await controller.executeTool("computer_click", { ref: "@s1:e3", clickCount: 2 }, { sessionId: "c1" });
    expect(calls[1]!.args).toEqual(["--session", "h_c1", "--headed", "double-click", "@s1:e3"]);

    await controller.executeTool("computer_click", { x: 420, y: 180, button: "right" }, { sessionId: "c1" });
    expect(calls[2]!.args).toEqual([
      "--session",
      "h_c1",
      "--headed",
      "mouse-click",
      "--xy=420,180",
      "--button",
      "right",
    ]);

    await controller.executeTool("computer_set_value", { ref: "@s1:e4", value: "abc" }, { sessionId: "c1" });
    expect(calls[3]!.args).toEqual(["--session", "h_c1", "set-value", "@s1:e4", "--stdin"]);
    expect(calls[3]!.child.stdinData).toBe("abc");

    await controller.executeTool("computer_paste_text", { text: "line1\nline2", app: "Notepad" }, { sessionId: "c1" });
    expect(calls[4]!.args).toEqual(["--session", "h_c1", "clipboard-set", "--stdin"]);
    expect(calls[4]!.child.stdinData).toBe("line1\nline2");
    expect(calls[5]!.args).toEqual(["--session", "h_c1", "--headed", "press", "ctrl+v", "--app", "Notepad"]);
  });

  it("surfaces structured recovery guidance on STALE_REF errors", async () => {
    const { runner } = createMockRunner({
      autoReply: () => ({
        ok: false,
        command: "click",
        error: {
          code: "STALE_REF",
          message: "Ref @s1:e9 is no longer present",
          suggestion: "Take a fresh snapshot and retry",
          recovery: { strategy: "resnapshot", requires_fresh_snapshot: true, retryable: true },
          disposition: { delivery: "not_delivered", retry: "safe" },
        },
      }),
    });
    const controller = new AgentDesktopController(runner, "win32");
    const res = await controller.executeTool("computer_click", { ref: "@s1:e9" });
    expect(res.isError).toBe(true);
    expect(res.result).toContain("STALE_REF");
    expect(res.result).toContain("Take a fresh snapshot");
    expect(res.result).toContain("fresh_snapshot_required=true");
  });
});
