import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { globalSubAgentManager } from "../src/const/subagent.js";
import { ConstAgent } from "../src/const/const-agent.js";
import {
  globalTaskManager,
  executeWaitTool,
  executeNativeTool,
  checkPortOpen,
  isDevServerCommand,
} from "../src/const/tools.js";

describe("Background Jobs & Service Supervision", () => {
  let testHome: string;
  beforeEach(() => {
    testHome = fs.mkdtempSync(path.join(os.tmpdir(), "const-background-test-"));
    vi.spyOn(os, "homedir").mockReturnValue(testHome);
    // Terminate any running tasks before each test
    for (const t of globalTaskManager.listTasks()) {
      globalTaskManager.killTask(t.id);
    }
  });

  afterEach(async () => {
    const closed: Promise<unknown>[] = [];
    for (const t of globalTaskManager.listTasks()) {
      const task = globalTaskManager.getTask(t.id)!;
      if (task.child && task.child.exitCode === null && task.child.signalCode === null) {
        closed.push(once(task.child, "close"));
      }
      globalTaskManager.killTask(t.id);
    }
    await Promise.all(closed);
    vi.restoreAllMocks();
    expect(path.resolve(testHome).startsWith(path.resolve(os.tmpdir()) + path.sep)).toBe(true);
    fs.rmSync(testHome, { recursive: true, force: true });
  });

  describe("isDevServerCommand detection", () => {
    it("should accurately identify dev server commands", () => {
      expect(isDevServerCommand("npm run dev")).toBe(true);
      expect(isDevServerCommand("pnpm dev")).toBe(true);
      expect(isDevServerCommand("yarn start")).toBe(true);
      expect(isDevServerCommand("bun dev")).toBe(true);
      expect(isDevServerCommand("npx vite --port 5173")).toBe(true);
      expect(isDevServerCommand("next dev")).toBe(true);
      expect(isDevServerCommand("git status")).toBe(false);
      expect(isDevServerCommand("npm test")).toBe(false);
      expect(isDevServerCommand("npm run build")).toBe(false);
    });
  });

  describe("checkPortOpen helper", () => {
    it("should return false for unopened ports quickly", async () => {
      const isOpen = await checkPortOpen(49999, "127.0.0.1", 150);
      expect(isOpen).toBe(false);
    });
  });

  describe("BackgroundProcessManager lifecycle", () => {
    it("terminates descendants before their parent disappears", async () => {
      const task = globalTaskManager.startTask(
        'node -e "const child=require(\'node:child_process\').spawn(process.execPath,[\'-e\',\'setInterval(()=>{},1000)\'],{stdio:\'inherit\'}); console.log(\'DESCENDANT_PID=\'+child.pid); setInterval(()=>{},1000);"',
        process.cwd(), { conversationId: "process-tree" },
      );
      await expect.poll(() => task.logs.some((line) => line.startsWith("DESCENDANT_PID=")), { timeout: 5000 }).toBe(true);
      const pid = Number(task.logs.find((line) => line.startsWith("DESCENDANT_PID="))!.split("=")[1]);
      try {
        globalTaskManager.killTask(task.id, "process-tree");
        await expect.poll(() => {
          try { process.kill(pid, 0); return true; } catch { return false; }
        }, { timeout: 5000 }).toBe(false);
      } finally {
        try { process.kill(pid, "SIGKILL"); } catch {}
      }
    });

    it("does not expose unowned jobs to a scoped session and prefers the current named job", () => {
      const old = globalTaskManager.startTask('node -e "setInterval(() => {}, 1000)"', process.cwd(), { name: "restarted", conversationId: "restart" });
      globalTaskManager.killTask(old.id);
      const current = globalTaskManager.startTask('node -e "setInterval(() => {}, 1000)"', process.cwd(), { name: "restarted", conversationId: "restart" });
      const unowned = globalTaskManager.startTask('node -e "setInterval(() => {}, 1000)"', process.cwd());
      expect(globalTaskManager.getTask("restarted", "restart")?.id).toBe(current.id);
      expect(globalTaskManager.getTask(unowned.id, "restart")).toBeUndefined();
      expect(globalTaskManager.killTask(unowned.id, "restart")).toBe(false);
      expect(globalTaskManager.listTasks("restart").some((task) => task.id === unowned.id)).toBe(false);
    });

    it("aborts only jobs using the cancelled run's signal and readiness stops promptly", async () => {
      const controller = new AbortController();
      const task = globalTaskManager.startTask('node -e "setInterval(() => {}, 1000)"', process.cwd(), { conversationId: "same-chat", signal: controller.signal });
      const sibling = globalTaskManager.startTask('node -e "setInterval(() => {}, 1000)"', process.cwd(), { conversationId: "same-chat" });
      const ready = globalTaskManager.waitForReady(task.id, { log: "NEVER_READY", timeout: 5 });
      controller.abort();
      expect(task.status).toBe("killed");
      expect(sibling.status).toBe("running");
      expect(await ready).toMatchObject({ ready: false });
      expect(() => globalTaskManager.startTask("node --version", process.cwd(), { signal: controller.signal })).toThrow();
    });

    it("cancelling a child agent does not recursively kill its siblings", () => {
      const killAll = vi.spyOn(globalSubAgentManager, "killAllRunningSubAgents");
      const child = new ConstAgent({ baseUrl: "https://example.invalid/v1", apiKey: "test", model: "test", workspacePath: process.cwd(), conversationId: "siblings", parentAgentId: "worker" });
      child.abort();
      expect(child.isCancelled).toBe(true);
      expect(killAll).not.toHaveBeenCalled();
      const root = new ConstAgent({ baseUrl: "https://example.invalid/v1", apiKey: "test", model: "test", workspacePath: process.cwd(), conversationId: "siblings" });
      root.abort();
      expect(killAll).toHaveBeenCalledWith(undefined, "siblings");
    });

    it("should start a background task, persist logs, and mark status as killed when stopped", async () => {
      const task = globalTaskManager.startTask(
        'node -e "console.log(\'SERVER_READY_TEST\'); setTimeout(() => {}, 10000);"',
        process.cwd(),
        { name: "test-server", conversationId: "session_test_1" }
      );

      expect(task.id).toMatch(/^task_/);
      expect(task.name).toBe("test-server");
      expect(task.conversationId).toBe("session_test_1");
      expect(task.status).toBe("running");
      expect(task.pid).toBeDefined();
      expect(task.logFilePath).toBeDefined();

      // Wait a moment for stdout
      await expect.poll(() => task.logs.some((line) => line.includes("SERVER_READY_TEST")), { timeout: 5000 }).toBe(true);

      const updated = globalTaskManager.getTask("test-server", "session_test_1");
      expect(updated).toBeDefined();
      expect(updated?.id).toBe(task.id);
      expect(updated?.logs.some((l) => l.includes("SERVER_READY_TEST"))).toBe(true);

      // Verify file persistence on disk
      expect(fs.existsSync(task.logFilePath!)).toBe(true);
      const fileContent = fs.readFileSync(task.logFilePath!, "utf8");
      expect(fileContent).toContain("SERVER_READY_TEST");

      // Kill the task
      const killRes = globalTaskManager.killTask("test-server", "session_test_1");
      expect(killRes).toBe(true);
      expect(updated?.status).toBe("killed");
    });

    it("should strictly scope listTasks, getTask, and killTask per session", async () => {
      const taskA = globalTaskManager.startTask(
        'node -e "console.log(\'SESSION_A_ALIVE\'); setTimeout(() => {}, 10000);"',
        process.cwd(),
        { name: "worker-a", conversationId: "session_alpha" }
      );
      const taskB = globalTaskManager.startTask(
        'node -e "console.log(\'SESSION_B_ALIVE\'); setTimeout(() => {}, 10000);"',
        process.cwd(),
        { name: "worker-b", conversationId: "session_beta" }
      );

      await new Promise((r) => setTimeout(r, 200));

      // 1. Session alpha only sees taskA
      const listA = globalTaskManager.listTasks("session_alpha");
      expect(listA.some((t) => t.id === taskA.id)).toBe(true);
      expect(listA.some((t) => t.id === taskB.id)).toBe(false);

      // 2. Session beta only sees taskB
      const listB = globalTaskManager.listTasks("session_beta");
      expect(listB.some((t) => t.id === taskB.id)).toBe(true);
      expect(listB.some((t) => t.id === taskA.id)).toBe(false);

      // 3. Cross-session getTask returns undefined
      expect(globalTaskManager.getTask(taskA.id, "session_beta")).toBeUndefined();
      expect(globalTaskManager.getTask(taskB.id, "session_alpha")).toBeUndefined();

      // 4. Cross-session killTask is blocked
      const crossKill = globalTaskManager.killTask(taskB.id, "session_alpha");
      expect(crossKill).toBe(false);
      expect(taskB.status).toBe("running");

      // 5. Scoped killTask succeeds
      const scopedKill = globalTaskManager.killTask(taskA.id, "session_alpha");
      expect(scopedKill).toBe(true);
      expect(taskA.status).toBe("killed");

      globalTaskManager.killTask(taskB.id, "session_beta");
    });
  });

  describe("wait tool with > 20 log output lines", () => {
    it("observes new output after the 5000-line ring buffer fills, ignoring older settled jobs", async () => {
      const old = globalTaskManager.startTask('node -e "setInterval(() => {}, 1000)"', process.cwd(), { conversationId: "capped" });
      globalTaskManager.killTask(old.id);
      const task = globalTaskManager.startTask(
        'node -e "for(let i=0;i<5100;i++) console.log(\'LINE_\'+i); setInterval(() => console.log(\'NEXT_TICK\'), 500);"',
        process.cwd(), { name: "capped-worker", conversationId: "capped" },
      );
      await expect.poll(() => task.logs.length, { timeout: 5000 }).toBe(5000);
      const revision = task.outputRevision;
      for (const args of [{ timeout: 5 }, { task_id: task.id, timeout: 5 }]) {
        const started = Date.now();
        const result = await executeWaitTool(args, undefined, "capped");
        expect(result.result).toContain(task.id);
        expect(result.result).toContain('status="running"');
        expect(Date.now() - started).toBeLessThan(3500);
      }
      expect(task.outputRevision).toBeGreaterThan(revision);
      expect(task.logs.length).toBe(5000);
    });

    it("should not hang or burn full timeout when log output exceeds 20 lines and new output arrives", async () => {
      const task = globalTaskManager.startTask(
        'node -e "for(let i=1; i<=25; i++) console.log(\'LINE_\' + i); setInterval(() => console.log(\'TICK_\' + Date.now()), 200);"',
        process.cwd(),
        { name: "flooder", conversationId: "session_flooder" }
      );

      // Wait for 25 initial lines to buffer
      await expect.poll(() => task.logs.length, { timeout: 5000 }).toBeGreaterThan(20);
      expect(task.logs.length).toBeGreaterThan(20);

      const startTime = Date.now();
      // executeWaitTool across session without specific id: checks task log saturation fix
      const waitRes = await executeWaitTool(
        { timeout: 5 },
        undefined,
        "session_flooder"
      );
      const elapsed = Date.now() - startTime;

      expect(waitRes.isError).toBe(false);
      expect(waitRes.result).toContain("flooder");
      // Saturated log check must return promptly when new TICK arrives, far less than 5000ms
      expect(elapsed).toBeLessThan(3500);

      globalTaskManager.killTask(task.id, "session_flooder");
    });
  });

  describe("bash async and manage_task dispatch integration", () => {
    it("should start a background job via bash with async: true and manage it with conversationId scoping", async () => {
      const startRes = await executeNativeTool(
        "bash",
        {
          command: 'node -e "console.log(\'BG_WORKER_ALIVE\'); setInterval(() => {}, 1000);"',
          async: true,
          name: "worker-1",
        },
        process.cwd(),
        { conversationId: "session_main" }
      );

      expect(startRes.isError).toBe(false);
      expect(startRes.result).toContain('status="running"');
      expect(startRes.result).toContain("Started background task");

      // Extract task ID
      const match = startRes.result.match(/\[(task_\d+_[a-z0-9]+)\]/);
      expect(match).not.toBeNull();
      const taskId = match![1];

      // Wait for output
      await expect.poll(() => globalTaskManager.getTask(taskId)?.logs.some((line) => line.includes("BG_WORKER_ALIVE")), { timeout: 5000 }).toBe(true);

      // 1. manage_task list with other conversationId should be empty
      const listOther = await executeNativeTool(
        "manage_task",
        { action: "list" },
        process.cwd(),
        { conversationId: "session_other" }
      );
      expect(listOther.isError).toBe(false);
      expect(listOther.result).toContain("No active or recent background tasks");

      // 2. manage_task list with session_main contains task
      const listRes = await executeNativeTool(
        "manage_task",
        { action: "list" },
        process.cwd(),
        { conversationId: "session_main" }
      );
      expect(listRes.isError).toBe(false);
      expect(listRes.result).toContain(taskId);
      expect(listRes.result).toContain("worker-1");

      // 3. manage_task status (using name)
      const statusRes = await executeNativeTool(
        "manage_task",
        { action: "status", task_id: "worker-1" },
        process.cwd(),
        { conversationId: "session_main" }
      );
      expect(statusRes.isError).toBe(false);
      expect(statusRes.result).toContain('status="running"');
      expect(statusRes.result).toContain("BG_WORKER_ALIVE");

      // 4. wait tool
      const waitRes = await executeNativeTool(
        "wait",
        { task_id: "worker-1", timeout: 2 },
        process.cwd(),
        { conversationId: "session_main" }
      );
      expect(waitRes.isError).toBe(false);
      expect(waitRes.result).toContain('status="running"');

      // 5. manage_task kill with wrong conversation fails
      const killWrong = await executeNativeTool(
        "manage_task",
        { action: "kill", task_id: "worker-1" },
        process.cwd(),
        { conversationId: "session_other" }
      );
      expect(killWrong.isError).toBe(true);

      // 6. manage_task kill with correct conversation succeeds
      const killRes = await executeNativeTool(
        "manage_task",
        { action: "kill", task_id: "worker-1" },
        process.cwd(),
        { conversationId: "session_main" }
      );
      expect(killRes.isError).toBe(false);
      expect(killRes.result).toContain("Successfully stopped background task");
    });

    it("should return clean notice from wait tool when no tasks are running", async () => {
      const waitRes = await executeWaitTool({});
      expect(waitRes.isError).toBe(false);
      expect(waitRes.result).toContain("Nothing to wait for");
    });
  });
});
