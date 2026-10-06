import type { SubAgentItem, AgentConfig, AgentMessage, NativeToolDefinition } from "./types.js";
import { ConstAgent } from "./const-agent.js";

export type SubAgentRole = "scout" | "reviewer" | "task";

export function normalizeAgentRole(role?: string): SubAgentRole {
  if (!role) return "task";
  const lower = role.toLowerCase().trim();
  if (lower === "scout" || lower === "research" || lower === "explorer" || lower === "investigate") {
    return "scout";
  }
  if (lower === "reviewer" || lower === "review" || lower === "audit" || lower === "security") {
    return "reviewer";
  }
  return "task";
}

export function buildSubAgentSystemPrompt(
  role: SubAgentRole,
  description: string,
  workspacePath: string
): string {
  const normalizedCwd = workspacePath.replace(/\\/g, "/");

  if (role === "scout") {
    return `§ Role: scout (READ-ONLY)
You are 'scout', a specialized exploratory codebase research and pattern analysis subagent operating in '${normalizedCwd}'.
Your assignment is to rapidly investigate the codebase, find relevant code, trace architectural connections, and return structured findings.

STRICT OPERATING CONSTRAINTS:
- You operate as STRICTLY READ-ONLY. You CANNOT write, edit, or delete files, and you CANNOT execute state-changing git or build commands.
- You have access only to read-only tools: read, grep, find, ls, web_search, web_fetch, lsp, ast_grep.
- Never output conversational greetings or chat filler ("Hello", "Certainly!").
- User cannot see your intermediate turns; your output will be returned directly to the parent agent.
- Return structured findings:
  1. Summary: Brief summary of findings and conclusions
  2. Files: Project-relative paths examined with relevant code references and line numbers (e.g. path/to/file.ts:12-34)
  3. Architecture: How the relevant pieces connect
  4. Details/Report: Concrete code excerpts or answers matching the assignment.`;
  }

  if (role === "reviewer") {
    return `§ Role: reviewer
You are 'reviewer', a specialized code review subagent for quality, logic correctness, and security analysis operating in '${normalizedCwd}'.
Your assignment is to inspect git diffs, file modifications, and syntax to detect provable bugs, security flaws, edge cases, and performance regressions.

STRICT OPERATING CONSTRAINTS:
- Report only provable issues with concrete file paths and line ranges.
- Do not make vague suggestions or question design choices unless they cause concrete bugs.
- Never output conversational greetings or chat filler.
- User cannot see your intermediate turns; your output will be returned directly to the parent agent.
- Return structured findings:
  1. Verdict: Overall assessment of code correctness
  2. Findings: Priority-ranked issues (file_path, line range, trigger condition, provable impact)
  3. Suggestions: Concrete replacement code or fixes where applicable.`;
  }

  return `§ Role: task (Worker)
You are 'task', a focused worker subagent operating in '${normalizedCwd}'.
Your assignment is to execute the assigned task thoroughly and directly.
- Hyperfocus on the assigned task and acceptance criteria.
- Edit files, create required code, run tests or commands as needed.
- Be concise; avoid conversational greetings or chat filler.
- When finished, return a direct summary of all modifications and results.`;
}

export function formatTaskResultEnvelope(options: {
  id: string;
  agent: string;
  status: "completed" | "cancelled" | "failed";
  durationSec: number;
  output: string;
  error?: string;
}): string {
  const durationStr = `${options.durationSec}s`;
  if (options.status === "failed") {
    return `<task-result id="${options.id}" agent="${options.agent}" status="failed" duration="${durationStr}">\n<error>\n${options.error || options.output || "Unknown failure"}\n</error>\n</task-result>`;
  }
  if (options.status === "cancelled") {
    return `<task-result id="${options.id}" agent="${options.agent}" status="cancelled" duration="${durationStr}">\n<abort-reason>Subagent was terminated/cancelled before completing.</abort-reason>\n</task-result>`;
  }
  return `<task-result id="${options.id}" agent="${options.agent}" status="completed" duration="${durationStr}">\n<output>\n${options.output || "(no output)"}\n</output>\n</task-result>`;
}

export interface SpawnSubAgentOptions {
  prompt: string;
  description?: string;
  role?: string;
  model?: string;
}

export interface SubAgentContext {
  workspacePath: string;
  parentConfig?: AgentConfig;
  availableTools?: NativeToolDefinition[];
  onStarted?: (agent: SubAgentItem) => void;
  onUpdated?: (agent: SubAgentItem) => void;
  onFinished?: (agentId: string, result?: string, error?: string) => void;
  onKilled?: (agentId: string) => void;
}

export class SubAgentManager {
  private subagents = new Map<string, SubAgentItem>();
  private abortControllers = new Map<string, AbortController>();
  private executionPromises = new Map<string, Promise<void>>();

  /**
   * Spawns a child subagent to perform an isolated background task.
   */
  public spawnSubAgent(
    options: SpawnSubAgentOptions,
    context: SubAgentContext
  ): SubAgentItem {
    const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const role = normalizeAgentRole(options.role);
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

    // Track execution promise
    const execPromise = this.runSubAgentExecution(item, options, context, abortController);
    this.executionPromises.set(id, execPromise);

    return item;
  }

  /**
   * Waits for a subagent to complete execution (for synchronous/foreground delegation).
   */
  public async waitForSubAgent(id: string): Promise<SubAgentItem | undefined> {
    const promise = this.executionPromises.get(id);
    if (promise) {
      try {
        await promise;
      } catch {}
    }
    return this.subagents.get(id);
  }

  private async runSubAgentExecution(
    item: SubAgentItem,
    options: SpawnSubAgentOptions,
    context: SubAgentContext,
    abortController: AbortController
  ): Promise<void> {
    try {
      if (context.parentConfig && context.parentConfig.baseUrl) {
        const canonicalRole = normalizeAgentRole(options.role);
        const systemPrompt = buildSubAgentSystemPrompt(
          canonicalRole,
          item.description,
          context.workspacePath
        );

        // Filter tools for the subagent based on persona (matching oh-my-pi)
        const baseTools = context.availableTools || context.parentConfig.tools || [];
        let childTools: NativeToolDefinition[] | undefined;
        if (baseTools.length > 0) {
          if (canonicalRole === "scout") {
            // Read-only tools only
            const READ_ONLY_TOOLS = ["read", "grep", "find", "ls", "web_search", "web_fetch", "lsp", "ast_grep"];
            childTools = baseTools.filter((t) => READ_ONLY_TOOLS.includes(t.function.name));
          } else if (canonicalRole === "reviewer") {
            // Read-only + non-destructive git inspection tools
            const REVIEWER_TOOLS = ["read", "grep", "find", "ls", "bash", "powershell", "lsp", "ast_grep", "web_search", "web_fetch"];
            childTools = baseTools.filter((t) => REVIEWER_TOOLS.includes(t.function.name));
          } else {
            // Worker agent: all tools except subagent spawning (prevents infinite recursive spawns)
            const SUBAGENT_TOOLS = ["task", "spawn_agent", "kill_agent", "agent_status"];
            childTools = baseTools.filter((t) => !SUBAGENT_TOOLS.includes(t.function.name));
          }
        }

        const childConfig: AgentConfig = {
          baseUrl: context.parentConfig.baseUrl,
          apiKey: context.parentConfig.apiKey,
          model: options.model || context.parentConfig.model,
          workspacePath: context.workspacePath,
          systemPrompt,
          tools: childTools,
          maxTurns: 25,
          mode: "full_access", // Delegated child runs without interactive confirmation prompts
        };

        const childAgent = new ConstAgent(childConfig);

        const initialMessages: AgentMessage[] = [
          {
            role: "user",
            content: `Complete assignment thoroughly:\n\n${options.prompt}`,
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

export interface ExecuteTaskToolArgs {
  task?: string;
  prompt?: string;
  assignment?: string;
  agent?: string;
  role?: string;
  name?: string;
  description?: string;
  label?: string;
  model?: string;
  run_in_background?: boolean;
  async?: boolean;
  detached?: boolean;
}

export async function executeSpawnAgent(
  args: ExecuteTaskToolArgs,
  workspacePath: string,
  callbacks?: SubAgentContext
): Promise<{ result: string; isError: boolean; agentId?: string }> {
  const prompt = args.task || args.prompt || args.assignment;
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return {
      result: "Error: Missing 'task' (or 'prompt') parameter. Specify instructions for the subagent.",
      isError: true,
    };
  }

  const roleArg = args.agent || args.role;
  const canonicalRole = normalizeAgentRole(roleArg);
  const description = args.name || args.description || args.label;

  const runInBackground = args.run_in_background === true || args.async === true || args.detached === true;

  const agent = globalSubAgentManager.spawnSubAgent(
    {
      prompt: prompt.trim(),
      description,
      role: canonicalRole,
      model: args.model,
    },
    {
      workspacePath,
      parentConfig: callbacks?.parentConfig,
      availableTools: callbacks?.availableTools,
      onStarted: callbacks?.onStarted,
      onUpdated: callbacks?.onUpdated,
      onFinished: callbacks?.onFinished,
      onKilled: callbacks?.onKilled,
    }
  );

  if (runInBackground) {
    return {
      result: `<task-result id="${agent.id}" agent="${agent.role}" status="running" duration="0s">\n<notice>Subagent is running in the background. Use 'agent_status' or 'kill_agent' with id='${agent.id}' if needed. Do NOT run bash 'sleep' to wait.</notice>\n</task-result>`,
      isError: false,
      agentId: agent.id,
    };
  }

  // Foreground (default): wait for subagent to finish and return its findings directly
  const settled = (await globalSubAgentManager.waitForSubAgent(agent.id)) || agent;
  const durationSec = Math.round(
    ((settled.endTime || Date.now()) - settled.startTime) / 1000
  );

  const envelope = formatTaskResultEnvelope({
    id: settled.id,
    agent: settled.role || canonicalRole,
    status: settled.status === "killed" ? "cancelled" : settled.status === "failed" ? "failed" : "completed",
    durationSec,
    output: settled.result || "Completed with no output.",
    error: settled.error,
  });

  return {
    result: envelope,
    isError: settled.status === "failed" || settled.status === "killed",
    agentId: settled.id,
  };
}

export const executeTaskTool = executeSpawnAgent;

export function executeAgentStatus(args: {
  agent_id?: string;
  id?: string;
}): { result: string; isError: boolean } {
  const agentId = args.agent_id || args.id;

  if (agentId) {
    const agent = globalSubAgentManager.getSubAgent(agentId.trim());
    if (!agent) {
      return {
        result: `<task-result id="${agentId}" status="not_found">\n<error>Subagent '${agentId}' not found.</error>\n</task-result>`,
        isError: true,
      };
    }

    const durationSec = Math.round(
      ((agent.endTime || Date.now()) - agent.startTime) / 1000
    );

    const envelope = formatTaskResultEnvelope({
      id: agent.id,
      agent: agent.role || "task",
      status: agent.status === "killed" ? "cancelled" : agent.status === "failed" ? "failed" : "completed",
      durationSec,
      output: agent.result || (agent.logs.length > 0 ? `Recent activity:\n${agent.logs.slice(-5).map((l) => `- ${l}`).join("\n")}` : `Subagent status: ${agent.status}`),
      error: agent.error,
    });

    return {
      result: envelope,
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
