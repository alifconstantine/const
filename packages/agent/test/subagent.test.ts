import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  globalSubAgentManager,
  executeSpawnAgent,
  executeAgentStatus,
  executeKillAgent,
} from "../src/const/subagent.js";
import { executeNativeTool } from "../src/const/tools.js";

describe("Sub-Agent Engine & Tools", () => {
  beforeEach(() => {
    globalSubAgentManager.clearSubAgents();
  });

  afterEach(() => {
    globalSubAgentManager.clearSubAgents();
  });

  describe("SubAgentManager lifecycle", () => {
    it("should spawn a subagent and complete execution in background", async () => {
      let started = false;
      let finished = false;

      const agent = globalSubAgentManager.spawnSubAgent(
        {
          prompt: "Analyze the project database schemas",
          description: "Analyze DB schemas",
          role: "research",
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
      expect(agent.role).toBe("research");
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

  describe("executeSpawnAgent, executeAgentStatus, executeKillAgent tools", () => {
    it("should return error if prompt is missing", async () => {
      const res = await executeSpawnAgent({ prompt: "" }, process.cwd());
      expect(res.isError).toBe(true);
      expect(res.result).toContain("Missing 'prompt' parameter");
    });

    it("should spawn subagent via executeSpawnAgent and return agent ID", async () => {
      const res = await executeSpawnAgent(
        {
          prompt: "Audit security headers in express server",
          description: "Security audit",
          role: "reviewer",
        },
        process.cwd()
      );

      expect(res.isError).toBe(false);
      expect(res.result).toContain("Started subagent");
      expect(res.result).toContain("Role: reviewer");
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
  });

  describe("executeNativeTool subagent dispatch integration", () => {
    it("should route 'spawn_agent', 'agent_status', and 'kill_agent'", async () => {
      // 1. spawn_agent
      const spawnRes = await executeNativeTool(
        "spawn_agent",
        {
          prompt: "Draft unit tests for auth controller",
          role: "coder",
        },
        process.cwd()
      );
      expect(spawnRes.isError).toBe(false);
      expect(spawnRes.result).toContain("Started subagent");

      // Extract agent ID
      const match = spawnRes.result.match(/\[(agent_\d+_[a-z0-9]+)\]/);
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
    });
  });
});
