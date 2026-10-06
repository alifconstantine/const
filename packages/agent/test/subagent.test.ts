import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  globalSubAgentManager,
  executeSpawnAgent,
  executeTaskTool,
  executeAgentStatus,
  executeKillAgent,
  normalizeAgentRole,
  formatTaskResultEnvelope,
} from "../src/const/subagent.js";
import { executeNativeTool } from "../src/const/tools.js";

describe("Sub-Agent Engine & Tools (oh-my-pi architecture)", () => {
  beforeEach(() => {
    globalSubAgentManager.clearSubAgents();
  });

  afterEach(() => {
    globalSubAgentManager.clearSubAgents();
  });

  describe("Role Normalization & Result Envelope", () => {
    it("should normalize specialist roles accurately", () => {
      expect(normalizeAgentRole("scout")).toBe("scout");
      expect(normalizeAgentRole("research")).toBe("scout");
      expect(normalizeAgentRole("explorer")).toBe("scout");
      expect(normalizeAgentRole("reviewer")).toBe("reviewer");
      expect(normalizeAgentRole("audit")).toBe("reviewer");
      expect(normalizeAgentRole("security")).toBe("reviewer");
      expect(normalizeAgentRole("task")).toBe("task");
      expect(normalizeAgentRole("coder")).toBe("task");
      expect(normalizeAgentRole(undefined)).toBe("task");
    });

    it("should format task-result XML envelope matching oh-my-pi specification", () => {
      const completed = formatTaskResultEnvelope({
        id: "test_123",
        agent: "scout",
        status: "completed",
        durationSec: 3,
        output: "Found 4 matching files",
      });
      expect(completed).toContain('<task-result id="test_123" agent="scout" status="completed" duration="3s">');
      expect(completed).toContain("<output>\nFound 4 matching files\n</output>");
      expect(completed).toContain("</task-result>");

      const failed = formatTaskResultEnvelope({
        id: "test_456",
        agent: "task",
        status: "failed",
        durationSec: 1,
        output: "",
        error: "Compilation failed with syntax error",
      });
      expect(failed).toContain('<task-result id="test_456" agent="task" status="failed" duration="1s">');
      expect(failed).toContain("<error>\nCompilation failed with syntax error\n</error>");
    });
  });

  describe("SubAgentManager lifecycle", () => {
    it("should spawn a subagent and complete execution in background", async () => {
      let started = false;
      let finished = false;

      const agent = globalSubAgentManager.spawnSubAgent(
        {
          prompt: "Analyze the project database schemas",
          description: "Analyze DB schemas",
          role: "scout",
        },
        {
          workspacePath: process.cwd(),
          onStarted: (a) => {
            started = true;
            expect(a.id).toBeDefined();
          },
          onFinished: (id, result) => {
            finished = true;
            expect(result).toBeDefined();
          },
        }
      );

      expect(started).toBe(true);
      expect(agent.id).toMatch(/^agent_/);
      expect(agent.role).toBe("scout");
      expect(agent.description).toBe("Analyze DB schemas");

      // Wait a tick for async completion
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(finished).toBe(true);
      const updated = globalSubAgentManager.getSubAgent(agent.id);
      expect(updated?.status).toBe("completed");
      expect(updated?.result).toContain("completed successfully");
    });

    it("should kill a running subagent", async () => {
      let killedId = "";

      const agent = globalSubAgentManager.spawnSubAgent(
        {
          prompt: "Long running exploration",
          description: "Long running task",
        },
        {
          workspacePath: process.cwd(),
        }
      );

      const killSuccess = globalSubAgentManager.killSubAgent(agent.id, (id) => {
        killedId = id;
      });

      expect(killSuccess).toBe(true);
      expect(killedId).toBe(agent.id);

      const updated = globalSubAgentManager.getSubAgent(agent.id);
      expect(updated?.status).toBe("killed");
    });
  });

  describe("executeTaskTool and executeSpawnAgent tools", () => {
    it("should return error if task/prompt is missing", async () => {
      const res = await executeTaskTool({ task: "" }, process.cwd());
      expect(res.isError).toBe(true);
      expect(res.result).toContain("Missing 'task'");
    });

    it("should execute task synchronously in foreground returning <task-result>", async () => {
      const res = await executeTaskTool(
        {
          task: "Audit security headers in express server",
          name: "Security audit",
          agent: "reviewer",
        },
        process.cwd()
      );

      expect(res.isError).toBe(false);
      expect(res.result).toContain('<task-result id="');
      expect(res.result).toContain('agent="reviewer" status="completed"');
      expect(res.result).toContain("<output>");
      expect(res.result).toContain("Task 'Security audit' completed successfully.");
      expect(res.agentId).toBeDefined();

      // Check status of all subagents
      const listRes = executeAgentStatus({});
      expect(listRes.isError).toBe(false);
      expect(listRes.result).toContain("Security audit");

      // Check status of specific subagent
      const statusRes = executeAgentStatus({ agent_id: res.agentId! });
      expect(statusRes.isError).toBe(false);
      expect(statusRes.result).toContain(res.agentId!);

      // Kill the subagent
      const killRes = executeKillAgent({ agent_id: res.agentId! });
      expect(killRes.isError).toBe(false);
      expect(killRes.result).toContain("Successfully terminated subagent");
    });

    it("should support background mode via run_in_background", async () => {
      const res = await executeTaskTool(
        {
          task: "Async database migration check",
          name: "Async check",
          agent: "scout",
          run_in_background: true,
        },
        process.cwd()
      );

      expect(res.isError).toBe(false);
      expect(res.result).toContain('status="running"');
      expect(res.result).toContain("<notice>Subagent is running in the background");
      expect(res.agentId).toBeDefined();

      // Should be findable in agent_status
      const statusRes = executeAgentStatus({ agent_id: res.agentId! });
      expect(statusRes.isError).toBe(false);
      expect(statusRes.result).toContain(res.agentId!);
    });
  });

  describe("executeNativeTool dispatch integration", () => {
    it("should route 'task', 'spawn_agent', 'agent_status', and 'kill_agent'", async () => {
      // 1. task (canonical oh-my-pi tool)
      const taskRes = await executeNativeTool(
        "task",
        {
          task: "Draft unit tests for auth controller",
          agent: "task",
        },
        process.cwd()
      );
      expect(taskRes.isError).toBe(false);
      expect(taskRes.result).toContain('<task-result id="');
      expect(taskRes.result).toContain('agent="task" status="completed"');

      // Extract agent ID from XML envelope
      const match = taskRes.result.match(/id="([^"]+)"/);
      expect(match).not.toBeNull();
      const agentId = match![1];

      // 2. agent_status
      const statusRes = await executeNativeTool(
        "agent_status",
        { agent_id: agentId },
        process.cwd()
      );
      expect(statusRes.isError).toBe(false);
      expect(statusRes.result).toContain(agentId);

      // 3. kill_agent
      const killRes = await executeNativeTool(
        "kill_agent",
        { agent_id: agentId },
        process.cwd()
      );
      expect(killRes.isError).toBe(false);
      expect(killRes.result).toContain("Successfully terminated subagent");

      // 4. spawn_agent (alias compatibility)
      const spawnRes = await executeNativeTool(
        "spawn_agent",
        {
          prompt: "Verify types in models",
          role: "reviewer",
        },
        process.cwd()
      );
      expect(spawnRes.isError).toBe(false);
      expect(spawnRes.result).toContain('<task-result id="');
      expect(spawnRes.result).toContain('agent="reviewer" status="completed"');
    });
  });
});
