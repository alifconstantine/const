import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  globalTaskManager,
  executeWaitTool,
  executeNativeTool,
  checkPortOpen,
  isDevServerCommand,
} from "../src/const/tools.js";

describe("Background Jobs & Service Supervision", () => {
  beforeEach(() => {
    // Terminate any running tasks before each test
    for (const t of globalTaskManager.listTasks()) {
      globalTaskManager.killTask(t.id);
    }
  });

  afterEach(() => {
    for (const t of globalTaskManager.listTasks()) {
      globalTaskManager.killTask(t.id);
    }
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
      // Pick high port unlikely to be open
      const isOpen = await checkPortOpen(49999, "127.0.0.1", 150);
      expect(isOpen).toBe(false);
    });
  });

  describe("BackgroundProcessManager lifecycle", () => {
    it("should start a background task and track output", async () => {
      const task = globalTaskManager.startTask(
        'node -e "console.log(\'SERVER_READY_TEST\'); setTimeout(() => {}, 10000);"',
        process.cwd(),
        { name: "test-server" }
      );

      expect(task.id).toMatch(/^task_/);
      expect(task.name).toBe("test-server");
      expect(task.status).toBe("running");
      expect(task.pid).toBeDefined();

      // Wait a moment for stdout
      await new Promise((r) => setTimeout(r, 200));

      const updated = globalTaskManager.getTask("test-server");
      expect(updated).toBeDefined();
      expect(updated?.id).toBe(task.id);
      expect(updated?.logs.some((l) => l.includes("SERVER_READY_TEST"))).toBe(true);

      // Kill the task
      const killRes = globalTaskManager.killTask("test-server");
      expect(killRes).toBe(true);
      expect(updated?.status).toBe("completed");
    });
  });

  describe("bash async and manage_task dispatch integration", () => {
    it("should start a background job via bash with async: true and manage it", async () => {
      const startRes = await executeNativeTool(
        "bash",
        {
          command: 'node -e "console.log(\'BG_WORKER_ALIVE\'); setInterval(() => {}, 1000);"',
          async: true,
          name: "worker-1",
        },
        process.cwd()
      );

      expect(startRes.isError).toBe(false);
      expect(startRes.result).toContain('status="running"');
      expect(startRes.result).toContain("Started background task");

      // Extract task ID
      const match = startRes.result.match(/\[(task_\d+_[a-z0-9]+)\]/);
      expect(match).not.toBeNull();
      const taskId = match![1];

      // Wait for output
      await new Promise((r) => setTimeout(r, 200));

      // 1. manage_task list
      const listRes = await executeNativeTool(
        "manage_task",
        { action: "list" },
        process.cwd()
      );
      expect(listRes.isError).toBe(false);
      expect(listRes.result).toContain(taskId);
      expect(listRes.result).toContain("worker-1");

      // 2. manage_task status (using name)
      const statusRes = await executeNativeTool(
        "manage_task",
        { action: "status", task_id: "worker-1" },
        process.cwd()
      );
      expect(statusRes.isError).toBe(false);
      expect(statusRes.result).toContain('status="running"');
      expect(statusRes.result).toContain("BG_WORKER_ALIVE");

      // 3. wait tool
      const waitRes = await executeNativeTool(
        "wait",
        { task_id: "worker-1", timeout: 2 },
        process.cwd()
      );
      expect(waitRes.isError).toBe(false);
      expect(waitRes.result).toContain('status="running"');

      // 4. manage_task kill
      const killRes = await executeNativeTool(
        "manage_task",
        { action: "kill", task_id: "worker-1" },
        process.cwd()
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
