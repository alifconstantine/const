import type { SubAgentItem, AgentConfig, AgentMessage } from "./types.js";
import { ConstAgent } from "./const-agent.js";

export interface SpawnSubAgentOptions {
  prompt: string;
  description?: string;
  role?: string;
  model?: string;
}

export interface SubAgentContext {
  workspacePath: string;
  parentConfig?: AgentConfig;
  onStarted?: (agent: SubAgentItem) => void;
  onUpdated?: (agent: SubAgentItem) => void;
  onFinished?: (agentId: string, result?: string, error?: string) => void;
  onKilled?: (agentId: string) => void;
}

export class SubAgentManager {
  private subagents = new Map<string, SubAgentItem>();
  private abortControllers = new Map<string, AbortController>();

  /**
   * Spawns a child subagent to perform an isolated background task.
   */
  public spawnSubAgent(
    options: SpawnSubAgentOptions,
    context: SubAgentContext
  ): SubAgentItem {
    const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const role = (options.role || "general").toLowerCase().trim();
    const description = (
      options.description ||
      options.prompt.slice(0, 80).replace(/[\r\n]+/g, " ")
    ).trim();

    const item: SubAgentItem = {
      id,
      description,
      prompt: options.prompt,
      role,
      status: "running",
      startTime: Date.now(),
      logs: [`Subagent initialized with role '${role}'`],
    };

    const abortController = new AbortController();
    this.subagents.set(id, item);
    this.abortControllers.set(id, abortController);

    context.onStarted?.(item);

    // Run execution in background promise
    this.runSubAgentExecution(item, options, context, abortController);

    return item;
  }

  private async runSubAgentExecution(
    item: SubAgentItem,
    options: SpawnSubAgentOptions,
    context: SubAgentContext,
    abortController: AbortController
  ): Promise<void> {
    try {
      if (context.parentConfig && context.parentConfig.baseUrl) {
        // Build subagent specialized system prompt
        const roleInstructions =
          options.role === "research"
            ? "You are a research subagent. Use web search, documentation queries, and file reading to investigate thoroughly. Provide concise, factual summaries without modifying codebase files."
            : options.role === "reviewer"
            ? "You are a code review subagent. Inspect git diffs, file modifications, and syntax to detect bugs, security flaws, and performance issues."
            : options.role === "coder"
            ? "You are a coding subagent. Perform precision code edits, create required files, and verify syntax carefully."
            : "You are a focused subagent assisting the parent agent with a delegated task.";

        const childConfig: AgentConfig = {
          baseUrl: context.parentConfig.baseUrl,
          apiKey: context.parentConfig.apiKey,
          model: options.model || context.parentConfig.model,
          workspacePath: context.workspacePath,
          systemPrompt: `[DELEGATED SUBAGENT: ${item.description}]\nRole: ${item.role || "general"}\n${roleInstructions}\n\nDeliver a direct, concise, and self-contained final answer to the parent agent.`,
          maxTurns: 25,
          mode: "full_access", // Delegated child runs without interactive confirmation prompts
        };

        const childAgent = new ConstAgent(childConfig);

        const initialMessages: AgentMessage[] = [
          {
            role: "user",
            content: options.prompt,
            timestamp: Date.now(),
          },
        ];

        const history = await childAgent.run(initialMessages, (event) => {
          if (abortController.signal.aborted) return;

          if (event.type === "tool_call") {
            const toolSummary = `Executed ${event.toolName}`;
            item.logs.push(toolSummary);
            if (item.logs.length > 50) item.logs.shift();
            context.onUpdated?.(item);
          } else if (event.type === "status" && event.message) {
            item.logs.push(event.message);
            if (item.logs.length > 50) item.logs.shift();
            context.onUpdated?.(item);
          }
        });

        if (abortController.signal.aborted) {
          item.status = "killed";
          item.endTime = Date.now();
          context.onKilled?.(item.id);
          return;
        }

        const lastAssistant = history
          .filter((m) => m.role === "assistant" && m.content)
          .pop();
        const finalAnswer =
          typeof lastAssistant?.content === "string"
            ? lastAssistant.content
            : JSON.stringify(lastAssistant?.content || "Completed successfully.");

        item.status = "completed";
        item.endTime = Date.now();
        item.result = finalAnswer;
        context.onFinished?.(item.id, finalAnswer);
      } else {
        // Fallback execution when parentConfig is not provided (standalone/test mode)
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (abortController.signal.aborted) {
          item.status = "killed";
          item.endTime = Date.now();
          context.onKilled?.(item.id);
          return;
        }
        item.status = "completed";
        item.endTime = Date.now();
        item.result = `Task '${item.description}' completed successfully.`;
        context.onFinished?.(item.id, item.result);
      }
    } catch (err: any) {
      if (abortController.signal.aborted || err.name === "AbortError") {
        item.status = "killed";
      } else {
        item.status = "failed";
        item.error = err.message || String(err);
      }
      item.endTime = Date.now();
      context.onFinished?.(item.id, undefined, item.error);
    } finally {
      this.abortControllers.delete(item.id);
    }
  }

  /**
   * Retrieves a subagent by ID.
   */
  public getSubAgent(id: string): SubAgentItem | undefined {
    return this.subagents.get(id);
  }

  /**
   * Lists all active and recent subagents.
   */
  public listSubAgents(): SubAgentItem[] {
    return Array.from(this.subagents.values());
  }

  /**
   * Terminate a running subagent.
   */
  public killSubAgent(id: string, onKilled?: (agentId: string) => void): boolean {
    const item = this.subagents.get(id);
    if (!item) return false;

    const controller = this.abortControllers.get(id);
    if (controller) {
      try {
        controller.abort();
      } catch {}
      this.abortControllers.delete(id);
    }

    item.status = "killed";
    item.endTime = Date.now();
    item.logs.push("Terminated by user or parent agent");
    onKilled?.(id);
    return true;
  }

  /**
   * Clear all subagents from memory (testing/reset).
   */
  public clearSubAgents(): void {
    for (const controller of this.abortControllers.values()) {
      try {
        controller.abort();
      } catch {}
    }
    this.abortControllers.clear();
    this.subagents.clear();
  }
}

export const globalSubAgentManager = new SubAgentManager();

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

export async function executeSpawnAgent(
  args: { prompt?: string; task?: string; description?: string; role?: string; model?: string },
  workspacePath: string,
  callbacks?: SubAgentContext
): Promise<{ result: string; isError: boolean; agentId?: string }> {
  const prompt = args.prompt || args.task;
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return {
      result: "Error: Missing 'prompt' parameter for spawn_agent. Specify the task description for the subagent.",
      isError: true,
    };
  }

  const agent = globalSubAgentManager.spawnSubAgent(
    {
      prompt: prompt.trim(),
      description: args.description,
      role: args.role,
      model: args.model,
    },
    {
      workspacePath,
      parentConfig: callbacks?.parentConfig,
      onStarted: callbacks?.onStarted,
      onUpdated: callbacks?.onUpdated,
      onFinished: callbacks?.onFinished,
      onKilled: callbacks?.onKilled,
    }
  );

  return {
    result: `Started subagent [${agent.id}] (Role: ${agent.role}): "${agent.description}". Status: running. The subagent is working in the background. Use 'agent_status' with agent_id='${agent.id}' to inspect progress or output, or 'kill_agent' to cancel.`,
    isError: false,
    agentId: agent.id,
  };
}

export function executeAgentStatus(args: {
  agent_id?: string;
  id?: string;
}): { result: string; isError: boolean } {
  const agentId = args.agent_id || args.id;

  if (agentId) {
    const agent = globalSubAgentManager.getSubAgent(agentId.trim());
    if (!agent) {
      const all = globalSubAgentManager.listSubAgents();
      const available = all.map((a) => `${a.id} (${a.status})`).join(", ");
      return {
        result: `Subagent '${agentId}' not found. Available subagents: [${available || "none"}]`,
        isError: true,
      };
    }

    const durationSec = Math.round(
      ((agent.endTime || Date.now()) - agent.startTime) / 1000
    );
    let output = `Subagent [${agent.id}] (${agent.role || "general"})\nStatus: ${agent.status.toUpperCase()} (${durationSec}s elapsed)\nGoal: ${agent.description}`;

    if (agent.result) {
      output += `\n\nFinal Output:\n${agent.result}`;
    } else if (agent.error) {
      output += `\n\nError:\n${agent.error}`;
    }

    if (agent.logs.length > 0) {
      output += `\n\nRecent Activity:\n${agent.logs.slice(-10).map((l) => `- ${l}`).join("\n")}`;
    }

    return {
      result: output,
      isError: agent.status === "failed",
    };
  }

  // List all subagents
  const list = globalSubAgentManager.listSubAgents();
  if (list.length === 0) {
    return {
      result: "(No active or recent subagents)",
      isError: false,
    };
  }

  const formatted = list
    .map((a) => {
      const elapsed = Math.round(
        ((a.endTime || Date.now()) - a.startTime) / 1000
      );
      return `- [${a.id}] ${a.status.toUpperCase()} (${elapsed}s) | Role: ${a.role || "general"} | "${a.description}"`;
    })
    .join("\n");

  return {
    result: `Subagents (${list.length}):\n${formatted}`,
    isError: false,
  };
}

export function executeKillAgent(
  args: { agent_id?: string; id?: string },
  onKilled?: (agentId: string) => void
): { result: string; isError: boolean } {
  const agentId = args.agent_id || args.id;
  if (!agentId || typeof agentId !== "string") {
    return {
      result: "Error: Missing 'agent_id' parameter for kill_agent.",
      isError: true,
    };
  }

  const success = globalSubAgentManager.killSubAgent(agentId.trim(), onKilled);
  if (success) {
    return {
      result: `Successfully terminated subagent '${agentId}'.`,
      isError: false,
    };
  }

  return {
    result: `Failed to terminate subagent '${agentId}' or subagent was not found.`,
    isError: true,
  };
}
