import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ToolAuthorization,
  globalTaskManager,
  type AgentConfig,
  type BackgroundTaskListener,
} from "@const/agent/const";
import { Agent, type AgentMessage, type AgentOptions, type ThinkingLevel } from "@earendil-works/pi-agent-core";
import { getCurrentTools, getToolStateChanges, toToolDeclaration, type Model } from "@earendil-works/pi-ai";
import { streamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import { HarnessProgress } from "./progress.js";
import { HarnessSession, type HarnessEngineEvent } from "./session.js";
import { createWorkspaceTools } from "./workspace-tools.js";

export type { HarnessStopReason } from "./progress.js";
export type { HarnessEngineEvent, HarnessPendingQuestion, HarnessPhase, HarnessRunEnd } from "./session.js";
export { createPiHarnessAgent, PiHarnessAgent } from "./desktop-runtime.js";
export {
  DEFERRED_SPECIALIST_TOOLS,
  RETIRED_REDUNDANT_TOOLS,
  createToolSearchDefinition,
  executeToolSearch,
  resolveHarnessToolDefinitions,
} from "./tool-registry.js";

export interface HarnessEngineOptions {
  model: Model<"openai-completions">;
  apiKey: string;
  workspacePath: string;
  sessionId?: string;
  systemPrompt?: string;
  messages?: AgentMessage[];
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  mode?: NonNullable<AgentConfig["mode"]>;
  onWorkspaceEvent: (event: HarnessEngineEvent) => void;
  prepareRequest?: AgentOptions["prepareRequest"];
  finishTurn?: AgentOptions["finishTurn"];
}

/** A headless Pi session with Const workspace tools and an OpenAI-compatible transport. */
export function createHarnessEngine(options: HarnessEngineOptions) {
  if (!path.isAbsolute(options.workspacePath)) throw new Error("An absolute workspace path is required.");
  if (!options.apiKey.trim()) throw new Error("An API key is required.");
  if (options.maxTurns !== undefined && (!Number.isSafeInteger(options.maxTurns) || options.maxTurns < 1)) {
    throw new Error("maxTurns must be a positive integer.");
  }

  const sessionId = options.sessionId ?? randomUUID();
  if (!sessionId.trim()) throw new Error("A session ID must be nonempty.");
  const workspacePath = path.resolve(options.workspacePath);
  const config: AgentConfig & { workspacePath: string; conversationId: string } = {
    workspacePath,
    conversationId: sessionId,
    model: options.model.id,
    baseUrl: options.model.baseUrl,
    apiKey: options.apiKey,
    mode: options.mode ?? "ask_before_changes",
  };
  const authorization = new ToolAuthorization(config);
  const session = new HarnessSession(options.messages ?? [], options.onWorkspaceEvent);
  const { baseTools, toolsWithJobs, beforeToolCall } = createWorkspaceTools(config, authorization, session);
  const progress = new HarnessProgress((event) => session.emit(event));
  const listJobs = () => globalTaskManager.listTasks(sessionId).map((job) => {
    const task = globalTaskManager.getTask(job.id, sessionId);
    return { ...job, exitCode: task?.exitCode ?? null, outputRevision: task?.outputRevision ?? 0 };
  });
  const initialTools = globalTaskManager.listTasks(sessionId).length ? toolsWithJobs : baseTools;
  let firstRequest = true;
  const agent: Agent = new Agent({
    initialState: {
      model: options.model,
      systemPrompt: options.systemPrompt,
      messages: options.messages,
      thinkingLevel: options.thinkingLevel,
      tools: initialTools,
    },
    toolExecution: "sequential",
    sessionId,
    // The host owns retry policy so provider-level retries cannot hide repeated requests.
    streamFn: (model, context, streamOptions) => {
      if (model.api !== "openai-completions") throw new Error(`Unsupported model API: ${model.api}`);
      const completionModel = model as Model<"openai-completions">;
      return streamSimple({
        ...completionModel,
        compat: { ...completionModel.compat, supportsFinishReason: true },
      }, progress.prepareTranscript(context), {
        ...streamOptions,
        apiKey: options.apiKey,
        maxRetries: 0,
      });
    },
    identity: { attribution: null },
    beforeToolCall,
    async prepareRequest(request, signal) {
      const update = await options.prepareRequest?.(request, signal) || undefined;
      if (!firstRequest) return update;
      firstRequest = false;
      // Pi's continue() begins at the saved transcript before it declares tool changes.
      const context = update?.context ?? request.context;
      const changes = getToolStateChanges(
        getCurrentTools(context.messages), (context.tools ?? []).map(toToolDeclaration),
      );
      if (!changes.toolsAdded.length && !changes.toolsRemoved.length) return update;
      return {
        ...update,
        context: {
          ...context,
          messages: [...context.messages, { role: "system", content: "", ...changes, timestamp: Date.now() }],
        },
      };
    },
    prepareNextTurnWithContext: ({ context }) => ({ context: { ...context, tools: agent.state.tools } }),
    async finishTurn(turn, signal) {
      if (signal?.aborted) return { action: "end" };
      if (turn.message.stopReason === "error" || turn.message.stopReason === "aborted") return;
      progress.record(turn);
      if (progress.stopReason) return { action: "end" };
      const decision = await options.finishTurn?.(turn, signal);
      if (signal?.aborted) return { action: "end" };
      if (decision?.action === "end") return decision;
      if (options.maxTurns !== undefined && (turn.toolResults.length || decision?.action === "continue" || agent.hasQueuedMessages())) {
        progress.applyTurnLimit(options.maxTurns);
        if (progress.stopReason) return { action: "end" };
      }
      return decision?.action === "continue" ? decision : undefined;
    },
  });
  agent.subscribe((event, signal) => {
    if (event.type === "agent_start") {
      firstRequest = true;
      progress.resetRun();
    }
    if (event.type === "message_end" && event.message.role === "user") progress.resetCycle();
    if (event.type === "tool_execution_end" && event.toolName === "bash" &&
        agent.state.tools.length < toolsWithJobs.length && globalTaskManager.listTasks(sessionId).length) {
      agent.state.tools = toolsWithJobs;
    }
    session.handle(event, signal, progress.stopReason);
  });
  return {
    agent,
    sessionId,
    resolveApproval: authorization.resolveApproval.bind(authorization),
    answerQuestion: session.answerQuestion.bind(session),
    snapshot: () => ({ ...session.snapshot(), sessionId, jobs: listJobs() }),
    subscribeJobs: (listener: BackgroundTaskListener) => globalTaskManager.subscribe((event) => {
      if (event.conversationId === sessionId) listener(event);
    }),
    stopJob: (taskId: string) => globalTaskManager.killTask(taskId, sessionId),
    get stopReason() { return progress.stopReason; },
  };
}
