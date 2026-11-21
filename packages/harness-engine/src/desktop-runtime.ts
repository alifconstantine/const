import fs from "node:fs/promises";
import path from "node:path";
import {
  abortableDelay,
  AgentRequestError,
  appendToolObservations,
  buildConstSystemPrompt,
  buildGoalActivePrompt,
  buildGoalBudgetLimitPrompt,
  buildGoalContinuationPrompt,
  buildPlanApprovedGuidance,
  calculateContextBreakdown,
  calculateContextOccupancy,
  compactHistoryForContext,
  CONST_DEFAULT_TOOLS,
  consumeChatStream,
  createRequestPreparer,
  DEFAULT_MODELS,
  disableToolObservationImages,
  downgradeThinkingLevel,
  executeNativeTool,
  extractFallbackToolCalls,
  extractPathArg,
  fetchWithRetry,
  fitRequestHistory,
  formatTaskResultEnvelope,
  globalSubAgentManager,
  GOAL_TOOL,
  imageContentForModel,
  isContextWindowError,
  isNonRetryableModelError,
  isRouterBudgetLimitError,
  isTodoTool,
  isUnsupportedImageError,
  LANGUAGE_GUIDANCE,
  nativeCapabilityForTool,
  normalizeToolName,
  parseToolArguments,
  PAYLOAD_ERROR_MESSAGE,
  PLAN_EXIT_TOOL,
  pluginInvocationInstructions,
  PROGRESS_REVIEW_GUIDANCE,
  REASONING_RECOVERY_GUIDANCE,
  ReasoningOnlyTimeoutError,
  registerSubAgentRuntimeFactory,
  REPEATED_FAILURE_GUIDANCE,
  REPEATED_RESULT_GUIDANCE,
  requestBodyBudget,
  resolveSkillRegistry,
  RunProgress,
  ThinkingStreamFilter,
  TodoTracker,
  ToolAuthorization,
  trackLlmRequest,
  TRUNCATED_RESPONSE_GUIDANCE,
  UNAVAILABLE_TOOL_VISION,
  type AgentConfig,
  type AgentErrorCategory,
  type AgentEvent,
  type AgentMessage as HarnessMessage,
  type AgentOutcome,
  type ApprovalResponseData,
  type CodingAgentRuntime,
  type GoalState,
  type NativeCapability,
  type NativeToolDefinition,
  type RequestDiagnostics,
  type ToolCall,
  type ToolObservation,
} from "@const/agent/const";
import { Agent, type AgentMessage as PiAgentMessage, type AgentTool, type ThinkingLevel } from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Model,
  type ToolCall as PiToolCall,
} from "@earendil-works/pi-ai";
import { executeToolSearch, resolveHarnessToolDefinitions } from "./tool-registry.js";
import { buildDialectRequest, consumeDialectStream, resolveProviderDialect } from "./dialect-transport.js";

const EMPTY_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const VALID_PI_THINKING = new Set<ThinkingLevel>(["off", "minimal", "low", "medium", "high", "xhigh"]);

function toPiThinkingLevel(level?: string): ThinkingLevel {
  if (!level) return "off";
  const lower = level.toLowerCase();
  if (lower === "max") return "xhigh";
  return VALID_PI_THINKING.has(lower as ThinkingLevel) ? (lower as ThinkingLevel) : "off";
}

function isSubAgentToolName(name?: string): boolean {
  const norm = (name || "").toLowerCase().replace(/[-_]/g, "");
  return norm === "task" || norm === "spawnagent" || norm === "subagent" || norm === "delegatetask";
}

function normalizeSchema(parameters: Record<string, any> | undefined): Record<string, any> {
  if (parameters && typeof parameters === "object" && Object.keys(parameters).length > 0) {
    return parameters;
  }
  return { type: "object", properties: {} };
}

function harnessContentToPiUserContent(content: HarnessMessage["content"]): string | Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  const parts: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [];
  for (const part of content) {
    if (part?.type === "text" && typeof part.text === "string") {
      parts.push({ type: "text", text: part.text });
    } else if (part?.type === "image_url" && typeof part.image_url?.url === "string") {
      const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(part.image_url.url);
      if (match && match[1] && match[2]) {
        parts.push({ type: "image", mimeType: match[1], data: match[2] });
      }
    }
  }
  return parts.length > 0 ? parts : "";
}

function toPiMessages(messages: readonly HarnessMessage[], model: Model<"openai-completions">): PiAgentMessage[] {
  const out: PiAgentMessage[] = [];
  for (const m of messages) {
    const timestamp = m.timestamp ?? Date.now();
    if (m.role === "user") {
      out.push({
        role: "user",
        content: harnessContentToPiUserContent(m.content),
        timestamp,
      });
    } else if (m.role === "assistant") {
      const content: AssistantMessage["content"] = [];
      if (m.thinking) content.push({ type: "thinking", thinking: m.thinking });
      const text = typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content.filter((p: any) => p?.type === "text").map((p: any) => p.text).join("\n")
          : "";
      if (text) content.push({ type: "text", text });
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          content.push({
            type: "toolCall",
            id: tc.id,
            name: tc.function.name,
            arguments: parseToolArguments(tc.function.arguments),
          });
        }
      }
      out.push({
        role: "assistant",
        content,
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: { ...EMPTY_USAGE },
        stopReason: m.tool_calls?.length ? "toolUse" : "stop",
        timestamp,
      });
    } else if (m.role === "tool") {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
      out.push({
        role: "toolResult",
        toolCallId: m.tool_call_id || `tool_${out.length}`,
        toolName: m.name || "tool",
        content: [{ type: "text", text }],
        isError: Boolean(m.isError),
        timestamp,
      });
    }
  }
  return out;
}

interface QueuedSteer {
  content: string;
  attachments?: any[];
  timestamp: number;
  instructionId?: string;
  sourceSideChatId?: string;
}

function buildSteerMessage(steer: QueuedSteer): HarnessMessage {
  let steerContent = steer.content || "";
  const imageParts: any[] = [];
  const docSections: string[] = [];

  if (steer.attachments && steer.attachments.length > 0) {
    const attLines = steer.attachments.map((att: any) => {
      const pathInfo = att.path ? ` [Path: ${att.path}]` : "";
      const sizeStr = att.size ? ` (${Math.round(att.size / 1024)} KB)` : "";
      const pagesInfo = att.pages ? ` [${att.pages} Pages]` : "";
      return `- ${(att.type || "file").toUpperCase()}: "${att.name}"${sizeStr}${pagesInfo}${pathInfo}`;
    });
    const baseText = steerContent.trim() ? steerContent : "Please analyze the attached media/file(s).";
    steerContent = `${baseText}\n\n[Attached media / Lampiran media:\n${attLines.join("\n")}]`;

    for (const att of steer.attachments) {
      if (att.textContent && att.textContent.trim().length > 0) {
        docSections.push(
          `--- DOCUMENT ATTACHMENT: "${att.name}" (${(att.type || "file").toUpperCase()}) ---\n${att.textContent}\n--- END ATTACHMENT ---`,
        );
      }
      if (att.type === "image" && (att.base64 || att.url)) {
        const imgUrl = att.base64 || att.url;
        if (imgUrl && (imgUrl.startsWith("data:") || imgUrl.startsWith("http"))) {
          imageParts.push({
            type: "image_url",
            image_url: { url: imgUrl },
          });
        }
      }
    }
  }

  if (docSections.length > 0) {
    steerContent += `\n\n${docSections.join("\n\n")}`;
  }

  const content = imageParts.length > 0
    ? [{ type: "text", text: steerContent }, ...imageParts]
    : steerContent;

  return {
    role: "user",
    content,
    timestamp: steer.timestamp,
    instructionId: steer.instructionId,
    sourceSideChatId: steer.sourceSideChatId,
  };
}

/** Pi Core (`@earendil-works/pi-agent-core`) runtime adapter implementing Harness Desktop's full agent contract. */
export class PiHarnessAgent implements CodingAgentRuntime {
  private readonly config: AgentConfig;
  private readonly authorization: ToolAuthorization;
  private activePiAgent: Agent | null = null;
  private abortController: AbortController | null = null;
  private isRunning = false;
  private _isCancelled = false;
  private cancelSource: "user" | "shutdown" | "parent" | "unknown" = "unknown";
  private steeringQueue: QueuedSteer[] = [];

  constructor(config: AgentConfig) {
    this.config = {
      workspacePath: process.cwd(),
      ...config,
    };
    this.authorization = new ToolAuthorization(this.config);
  }

  public get sessionAllowedToolsSet(): Set<string> {
    return this.authorization.sessionAllowedToolsSet;
  }

  public get mode(): NonNullable<AgentConfig["mode"]> {
    return this.authorization.mode;
  }

  public updateMode(newMode: NonNullable<AgentConfig["mode"]>): void {
    this.authorization.updateMode(newMode);
  }

  public get isCancelled(): boolean {
    return this._isCancelled;
  }

  public resolveApproval(approvalId: string, response: ApprovalResponseData): boolean {
    return this.authorization.resolveApproval(approvalId, response);
  }

  public get maxTurns(): number {
    const configured = this.config.maxTurns;
    if (typeof configured === "number" && Number.isFinite(configured) && configured >= 1) return Math.floor(configured);
    if (this.config.sessionKind === "companion") return 4;
    return this.config.preset === "harness" ? Infinity : 200;
  }

  public steer(content: string, attachments?: any[], metadata?: { instructionId: string; sourceSideChatId: string }): boolean {
    if (!this.isRunning || this._isCancelled) return false;
    const item: QueuedSteer = {
      content,
      attachments,
      timestamp: Date.now(),
      ...metadata,
    };
    this.steeringQueue.push(item);
    if (metadata) {
      this.authorization.denyPending("A new instruction arrived; reconsider this action before proceeding.");
    }
    if (this.activePiAgent) {
      this.activePiAgent.steer({
        role: "user",
        content: harnessContentToPiUserContent(buildSteerMessage(item).content),
        timestamp: item.timestamp,
      });
    }
    return true;
  }

  public abort(source: "user" | "shutdown" | "parent" | "unknown" = "unknown"): void {
    if (!this._isCancelled) this.cancelSource = source;
    this._isCancelled = true;
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
    }
    if (this.activePiAgent) {
      try {
        this.activePiAgent.abort();
      } catch {}
    }
    try {
      if (!this.config.parentAgentId) {
        globalSubAgentManager.killAllRunningSubAgents(undefined, this.config.conversationId);
      }
    } catch {}
    this.authorization.denyPending("Agent execution was cancelled by user.");
  }

  public async run(
    messages: HarnessMessage[],
    onEvent: (event: AgentEvent) => void,
    options: { returnPartialOnFailure?: boolean } = {},
  ): Promise<HarnessMessage[]> {
    if (this.isRunning) {
      throw new Error("Agent is already running a session");
    }

    this.isRunning = true;
    this._isCancelled = false;
    this.cancelSource = "unknown";
    this.abortController = new AbortController();
    const runSignal = this.abortController.signal;

    let deadlineReached = false;
    const timeoutMs = this.config.sessionTimeoutMs ?? (this.config.sessionKind === "companion" ? 120_000 : 0);
    const deadline = timeoutMs > 0
      ? setTimeout(() => {
          deadlineReached = true;
          this.abortController?.abort();
          this.activePiAgent?.abort();
        }, timeoutMs)
      : undefined;

    const conversationHistory: HarnessMessage[] = [...messages];
    const todos = new TodoTracker(conversationHistory);
    const progress = new RunProgress();
    const isCompanion = this.config.sessionKind === "companion";
    const workspacePath = this.config.workspacePath || process.cwd();
    const runId = this.config.runId ?? `pi_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const publish = onEvent;
    const emitEvent = (event: AgentEvent) => publish({ ...event, runId });

    const modelInputTypes = this.config.inputTypes ?? DEFAULT_MODELS.find((m) => m.id === this.config.model)?.inputTypes;
    const modelSupportsImages = !modelInputTypes || modelInputTypes.includes("image");
    const loadedNativePlugins = new Set<NativeCapability>();
    const activatedDeferredTools = new Set<string>();
    let toolVisionUnavailable = false;
    let currentTurn = 0;
    let requestSequence = 0;
    let activeRequest: ReturnType<typeof trackLlmRequest> | undefined;
    let outcome: AgentOutcome = "failed";
    let terminalError: string | undefined;
    let errorCategory: AgentErrorCategory | undefined;
    let lastRecovery: "payload" | "context" | undefined;
    let terminalException: Error | undefined;
    let finalAssistantText = "";

    const prepareRequest = createRequestPreparer(this.config.normalizeImage);
    let payloadRecoveryAttempted = false;
    let payloadRecoveryLimit: number | undefined;
    let rejectedPayloadBytes: number | undefined;
    let contextRecoveryAttempted = false;
    let contextSystemPrompt = "";
    let contextTools: any[] = [];
    let consecutivePlanningTurns = 0;
    let consecutiveDraftCutoffs = 0;
    let consecutiveEmptyRetries = 0;
    let recoveryInstruction = "";
    let effectiveThinkingLevel = this.config.thinkingLevel;
    let reasoningDowngradedForTurn = false;

    const MAX_EMPTY_RETRIES = isCompanion ? 1 : 2;
    const maxTurns = this.maxTurns;
    const activeDialect = resolveProviderDialect(
      this.config.providerProtocol,
      this.config.baseUrl,
      this.config.providerAuthType,
    );
    const endpoint = this.config.baseUrl.endsWith("/chat/completions")
      ? this.config.baseUrl
      : `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    // Plan Mode & Goal Mode runtime state (OMP-aligned)
    const nowTs = Date.now();
    let activeGoal: GoalState | null = !isCompanion
      ? this.config.initialGoal
        ? {
            ...this.config.initialGoal,
            status: this.config.runIntent === "goal" && this.config.initialGoal.status === "paused"
              ? "active"
              : this.config.initialGoal.status,
            tokensUsed: this.config.initialGoal.tokensUsed ?? 0,
            timeUsedSeconds: this.config.initialGoal.timeUsedSeconds ?? 0,
            createdAt: this.config.initialGoal.createdAt ?? nowTs,
            updatedAt: nowTs,
          }
        : this.config.runIntent === "goal"
          ? {
              id: `goal_${nowTs}_${Math.random().toString(36).slice(2, 8)}`,
              objective: this.config.goalObjective?.trim() || "Complete the requested goal thoroughly",
              criteria: [],
              status: "active",
              tokenBudget: this.config.goalTokenBudget,
              tokensUsed: 0,
              timeUsedSeconds: 0,
              createdAt: nowTs,
              updatedAt: nowTs,
            }
          : null
      : null;
    let activeApprovedPlanPath: string | undefined = this.config.approvedPlanPath;
    let goalWallLastAccountedMs = nowTs;
    let goalBudgetSteerSent = false;
    let goalContinuationReminders = 0;
    let lastContinuationActivityDigest: string | null = null;
    let turnActivityTokens: string[] = [];
    if (activeGoal) {
      emitEvent({ type: "goal_update", goal: activeGoal });
    }
    if (!isCompanion && this.config.runIntent === "plan") {
      emitEvent({ type: "plan_mode_changed", active: true });
    }

    const activeModelInfo = DEFAULT_MODELS.find((m) => m.id === this.config.model);
    const resolvedContextWindow = this.config.contextWindow ?? activeModelInfo?.contextWindow ?? 1_000_000;
    const piModel: Model<"openai-completions"> = {
      id: this.config.model,
      name: activeModelInfo?.displayName || this.config.model,
      api: "openai-completions",
      provider: "const",
      baseUrl: this.config.baseUrl,
      reasoning: Boolean(activeModelInfo?.supportsThinking || this.config.thinkingLevel),
      input: modelSupportsImages ? ["text", "image"] : ["text"],
      contextWindow: resolvedContextWindow,
      maxTokens: this.config.maxOutputTokens ?? this.config.maxTokens ?? activeModelInfo?.maxOutputTokens ?? 65_536,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    };

    const emitContext = () => {
      const breakdown = calculateContextBreakdown({
        systemPrompt: contextSystemPrompt,
        tools: contextTools,
        messages: fitRequestHistory(compactHistoryForContext(conversationHistory, contextRecoveryAttempted ? 0 : 4, payloadRecoveryAttempted)),
      });
      emitEvent({
        type: "context_update",
        model: this.config.model,
        updatedAt: Date.now(),
        systemPromptTokens: breakdown.systemTokens,
        toolsTokens: breakdown.toolsTokens,
        messagesTokens: breakdown.messageTokens,
        usedTokens: breakdown.totalHeuristicTokens,
        totalTokens: resolvedContextWindow,
      });
    };

    const recoverPayload = (diagnostics: RequestDiagnostics): boolean => {
      if (payloadRecoveryAttempted || !diagnostics.requestBytes) return false;
      const canShrinkImages = (diagnostics.imageBytes ?? 0) > 0 && (
        Boolean(this.config.normalizeImage) ||
        conversationHistory.some((m) => Boolean(m.toolObservationId) && Array.isArray(m.content))
      );
      const canShrinkText = conversationHistory.some((message) =>
        (message.role === "tool" && typeof message.content === "string" && message.content.length > 1_024) ||
        (message.role === "assistant" && typeof message.thinking === "string" && message.thinking.length > 0),
      );
      if (!canShrinkImages && !canShrinkText) return false;
      payloadRecoveryAttempted = true;
      lastRecovery = "payload";
      rejectedPayloadBytes = diagnostics.requestBytes;
      payloadRecoveryLimit = canShrinkImages ? Math.floor(diagnostics.requestBytes * 0.65) : diagnostics.requestBytes - 1;
      if (canShrinkText) {
        emitEvent({ type: "status", status: "thinking", message: "Request too large. Retrying with shorter tool output excerpts." });
      }
      return true;
    };

    const recoverContext = (error: string): boolean => {
      if (contextRecoveryAttempted || !isContextWindowError(error)) return false;
      contextRecoveryAttempted = true;
      lastRecovery = "context";
      emitEvent({
        type: "status",
        status: "thinking",
        message: "Model context limit reached. Reducing older context and the output reservation before retrying...",
      });
      return true;
    };

    // Per-turn mutable state shared between Pi hooks & tool executors
    let activeToolDefinitions: NativeToolDefinition[] = [];
    let currentTurnToolObservations: ToolObservation[] = [];
    let currentTurnParallelAgents: Array<{ agentId: string; toolCallId: string; toolName: string }> = [];
    let currentTurnAssistantMsg: HarnessMessage | undefined;
    let currentTurnSubagentCount = 0;
    let turnStalledError: AgentRequestError | undefined;
    const toolMetaByCallId = new Map<string, { rawResult: any; durationMs: number; waitingMs: number; isError: boolean }>();
    const permissions = new WeakMap<Record<string, unknown>, { allowOutsideWorkspace: boolean; waitingMs: number }>();
    const deniedAssistantMessages = new WeakSet<object>();

    const drainSteeringQueue = () => {
      if (this.steeringQueue.length === 0) return;
      progress.reset();
      todos.resetCycle();
      while (this.steeringQueue.length > 0) {
        const steer = this.steeringQueue.shift()!;
        const steerMsg = buildSteerMessage(steer);
        conversationHistory.push(steerMsg);
        emitEvent({
          type: "steer_message",
          conversationId: this.config.conversationId,
          message: steerMsg,
        });
      }
    };

    const resolveActiveTools = async (signal: AbortSignal): Promise<{
      definitions: NativeToolDefinition[];
      enabledNativePlugins: NativeCapability[];
      hasBrowserOrComputerTools: boolean;
    }> => {
      if (isCompanion) return { definitions: [], enabledNativePlugins: [], hasBrowserOrComputerTools: false };
      const externalTools = await this.config.externalTools?.(signal) ?? [];
      const resolved = resolveHarnessToolDefinitions({
        isCompanion,
        explicitTools: this.config.tools,
        externalTools,
        deferNativeTools: this.config.deferNativeTools,
        nativeCapabilityEnabled: this.config.nativeCapabilityEnabled,
        loadedNativePlugins,
        activatedDeferredTools,
        conversationId: this.config.conversationId,
      });
      const extraIntentTools: NativeToolDefinition[] = [];
      if (this.authorization.runIntent === "plan" && !resolved.definitions.some((t) => t.function.name === "plan_exit")) {
        extraIntentTools.push(PLAN_EXIT_TOOL);
      }
      if ((this.authorization.runIntent === "goal" || activeGoal) && !resolved.definitions.some((t) => t.function.name === "goal")) {
        extraIntentTools.push(GOAL_TOOL);
      }
      if (extraIntentTools.length > 0) {
        return { ...resolved, definitions: [...resolved.definitions, ...extraIntentTools] };
      }
      return resolved;
    };

    const buildPiTools = (
      definitions: NativeToolDefinition[],
      enabledNativePlugins: NativeCapability[],
    ): AgentTool<Record<string, unknown>>[] => {
      const agentConfig = this.config;
      const nativeNameSet = new Set((agentConfig.tools ?? CONST_DEFAULT_TOOLS).map((t) => t.function.name));
      return definitions.map((definition) => {
        const { name, description, parameters } = definition.function;
        return {
          name,
          label: name,
          description,
          parameters: normalizeSchema(parameters),
          execute: async (toolCallId, rawArgs, toolSignal) => {
            const effectiveSignal = toolSignal ? AbortSignal.any([runSignal, toolSignal]) : runSignal;
            const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;
            const perm = permissions.get(args);
            permissions.delete(args);
            effectiveSignal.throwIfAborted();
            if (!perm) throw new Error("Tool execution requires authorization.");

            const toolStartedAt = Date.now();
            let questionWaitingMs = 0;

            // Handle Plan Mode exit (OMP-aligned 3-option review + plan artifact inlining)
            if (name === "plan_exit") {
              const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : "Implementation Plan";
              const summary = typeof args.summary === "string" ? args.summary.trim() : "";
              const planPath = typeof args.planPath === "string" && args.planPath.trim() ? args.planPath.trim() : undefined;
              let decision: "execute" | "compact" | "stay" = "execute";
              let feedback = "";
              if (agentConfig.onAskQuestion) {
                const askStart = Date.now();
                try {
                  const ans = await agentConfig.onAskQuestion(toolCallId, [
                    {
                      question: `${title}${planPath ? ` (${planPath})` : ""}\n\n${summary || "Plan is ready."}\n\nHow would you like to proceed?`,
                      options: [
                        { label: "Approve & Execute Plan", description: "Exit Plan Mode and execute with current context", recommended: true },
                        { label: "Approve & Compact Context", description: "Compact exploration history, preserve the plan, and execute" },
                        { label: "Stay in Plan Mode", description: "Keep refining the plan without editing files" },
                      ],
                    },
                  ]);
                  const raw = typeof ans === "string" ? ans : JSON.stringify(ans ?? "");
                  if (/stay in plan|no\b|reject|cancel|refine/i.test(raw)) {
                    decision = "stay";
                    feedback = raw;
                  } else if (/compact/i.test(raw)) {
                    decision = "compact";
                  } else {
                    decision = "execute";
                  }
                } finally {
                  questionWaitingMs += Date.now() - askStart;
                }
              }

              let planContent = summary;
              if (planPath) {
                try {
                  const absPlanPath = path.resolve(workspacePath, planPath);
                  const diskPlan = await fs.readFile(absPlanPath, "utf-8");
                  if (diskPlan.trim()) planContent = diskPlan.trim();
                } catch {}
              }

              let result: string;
              if (decision === "stay") {
                result = `User chose to stay in Plan Mode.${feedback ? ` Feedback: ${feedback}` : ""} Refine the plan without editing workspace files.`;
              } else {
                this.authorization.updateRunIntent("default");
                activeApprovedPlanPath = planPath;
                if (decision === "compact" && conversationHistory.length > 4) {
                  const firstUser = conversationHistory.find((m) => m.role === "user");
                  const tail = conversationHistory.slice(-2);
                  conversationHistory.length = 0;
                  if (firstUser && !tail.includes(firstUser)) conversationHistory.push(firstUser);
                  conversationHistory.push({
                    role: "assistant",
                    content: `[Exploration history compacted on plan approval${planPath ? ` — plan preserved at ${planPath}` : ""}]`,
                    timestamp: Date.now(),
                  });
                  conversationHistory.push(...tail);
                }
                emitEvent({
                  type: "plan_mode_changed",
                  active: false,
                  planPath,
                  approved: true,
                  compacted: decision === "compact",
                });
                const hasTodoTool = activeToolDefinitions.some((t) => isTodoTool(t.function.name));
                result = buildPlanApprovedGuidance({
                  planPath,
                  planContent,
                  contextPreserved: decision !== "compact",
                  hasTodoTool,
                });
              }
              toolMetaByCallId.set(toolCallId, {
                rawResult: result,
                durationMs: Math.max(0, Date.now() - toolStartedAt - questionWaitingMs),
                waitingMs: perm.waitingMs + questionWaitingMs,
                isError: false,
              });
              return { content: [{ type: "text", text: result }], details: result, isError: false };
            }

            // Handle autonomous Goal state management (`/goal` — OMP-aligned)
            if (name === "goal") {
              const op = String(args.op || "get").toLowerCase();
              let resultText = "";
              let isError = false;
              const now = Date.now();
              const parsedBudget =
                typeof args.token_budget === "number" && Number.isInteger(args.token_budget) && args.token_budget > 0
                  ? args.token_budget
                  : undefined;
              if (args.token_budget !== undefined && parsedBudget === undefined) {
                isError = true;
                resultText = "goal token_budget must be a positive integer when provided.";
              } else if (op === "create" || op === "update" || op === "replace") {
                const objective = typeof args.objective === "string" && args.objective.trim()
                  ? args.objective.trim()
                  : activeGoal?.objective || "Complete the user's goal";
                const criteria = Array.isArray(args.criteria)
                  ? args.criteria.map((c) => String(c).trim()).filter(Boolean)
                  : op === "replace"
                    ? []
                    : (activeGoal?.criteria ?? []);
                const tokenBudget = parsedBudget ?? (op === "replace" ? undefined : activeGoal?.tokenBudget);
                const tokensUsed = op === "replace" ? 0 : (activeGoal?.tokensUsed ?? 0);
                const timeUsedSeconds = op === "replace" ? 0 : (activeGoal?.timeUsedSeconds ?? 0);
                const nextStatus =
                  tokenBudget !== undefined && tokensUsed >= tokenBudget ? "budget-limited" : "active";
                activeGoal = {
                  id: op === "replace" || !activeGoal?.id
                    ? `goal_${now}_${Math.random().toString(36).slice(2, 8)}`
                    : activeGoal.id,
                  objective,
                  criteria,
                  status: nextStatus,
                  summary: typeof args.summary === "string" ? args.summary : activeGoal?.summary,
                  tokenBudget,
                  tokensUsed,
                  timeUsedSeconds,
                  createdAt: op === "replace" ? now : (activeGoal?.createdAt ?? now),
                  updatedAt: now,
                };
                if (op === "replace") {
                  goalWallLastAccountedMs = now;
                  goalBudgetSteerSent = false;
                }
                emitEvent({ type: "goal_update", goal: activeGoal });
                resultText = JSON.stringify({ ok: true, goal: activeGoal }, null, 2);
              } else if (op === "get") {
                resultText = JSON.stringify({ goal: activeGoal }, null, 2);
              } else if (op === "complete") {
                if (activeGoal) {
                  activeGoal = {
                    ...activeGoal,
                    status: "complete",
                    summary: typeof args.summary === "string" ? args.summary : activeGoal.summary,
                    updatedAt: now,
                  };
                  emitEvent({ type: "goal_update", goal: activeGoal });
                }
                const budgetParts: string[] = [];
                if (activeGoal?.tokenBudget !== undefined) {
                  budgetParts.push(`tokens used: ${activeGoal.tokensUsed ?? 0} of ${activeGoal.tokenBudget}`);
                }
                if ((activeGoal?.timeUsedSeconds ?? 0) > 0) {
                  budgetParts.push(`time used: ${activeGoal?.timeUsedSeconds} seconds`);
                }
                resultText = JSON.stringify(
                  {
                    ok: true,
                    goal: activeGoal,
                    ...(budgetParts.length > 0 ? { report: `Goal achieved (${budgetParts.join("; ")}).` } : {}),
                  },
                  null,
                  2,
                );
              } else if (op === "drop") {
                if (activeGoal) {
                  activeGoal = {
                    ...activeGoal,
                    status: "dropped",
                    summary: typeof args.summary === "string" ? args.summary : "Dropped",
                    updatedAt: now,
                  };
                  emitEvent({ type: "goal_update", goal: activeGoal });
                }
                resultText = JSON.stringify({ ok: true, goal: activeGoal }, null, 2);
              } else {
                isError = true;
                resultText = `Unknown goal op '${op}'. Use create, get, update, replace, complete, or drop.`;
              }
              toolMetaByCallId.set(toolCallId, {
                rawResult: resultText,
                durationMs: Date.now() - toolStartedAt,
                waitingMs: perm.waitingMs,
                isError,
              });
              return { content: [{ type: "text", text: resultText }], details: resultText, isError };
            }

            // Handle deferred specialist tool discovery/activation
            if (name === "tool_search") {
              const { result, isError } = executeToolSearch(args, activatedDeferredTools);
              toolMetaByCallId.set(toolCallId, { rawResult: result, durationMs: Date.now() - toolStartedAt, waitingMs: perm.waitingMs, isError });
              return { content: [{ type: "text", text: result }], details: result, isError };
            }

            // Handle deferred native plugin loader if enabled
            if (name === "load_plugin_tools" && agentConfig.deferNativeTools) {
              const pluginName = String(args.plugin || "");
              const enabled = enabledNativePlugins.includes(pluginName as NativeCapability) &&
                agentConfig.nativeCapabilityEnabled?.(pluginName as NativeCapability) !== false;
              const isError = !enabled;
              if (enabled) loadedNativePlugins.add(pluginName as NativeCapability);
              const result = enabled
                ? `Loaded ${pluginName} tools. They are now declared and available in your next turn.`
                : `Plugin '${pluginName}' is not enabled in this workspace.`;
              toolMetaByCallId.set(toolCallId, { rawResult: result, durationMs: Date.now() - toolStartedAt, waitingMs: perm.waitingMs, isError });
              return { content: [{ type: "text", text: result }], details: result, isError };
            }

            // External MCP tool
            if (!nativeNameSet.has(name) && agentConfig.externalToolHandler) {
              const { result, images, isError } = await agentConfig.externalToolHandler(name, args, effectiveSignal);
              if (!isError && images?.length) {
                currentTurnToolObservations.push({ id: toolCallId, name, images });
                if (currentTurnToolObservations.length > 2) currentTurnToolObservations.shift();
              }
              const durationMs = Math.max(0, Date.now() - toolStartedAt);
              toolMetaByCallId.set(toolCallId, { rawResult: result, durationMs, waitingMs: perm.waitingMs, isError: Boolean(isError) });
              return {
                content: [
                  { type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) },
                  ...(images ?? []).map(({ data, mimeType }: { data: string; mimeType: string }) => ({ type: "image" as const, data, mimeType })),
                ],
                details: result,
                isError: Boolean(isError),
              };
            }

            // Native Const tool
            const shouldRunParallel = currentTurnSubagentCount > 1 && isSubAgentToolName(name) && args.background !== false;
            const effectiveArgs = shouldRunParallel ? { ...args, background: true } : args;

            const { result, images, isError } = await executeNativeTool(name, effectiveArgs, workspacePath, {
              signal: effectiveSignal,
              allowOutsideWorkspace: perm.allowOutsideWorkspace,
              stepIndex: currentTurn,
              conversationId: agentConfig.conversationId,
              parentConfig: agentConfig,
              learnId: agentConfig.learnId,
              onFileMutation: (record) => emitEvent({ type: "file_mutation", record, toolCallId }),
              onTodoUpdate: (items) => {
                const committed = todos.commit(items);
                if (committed) {
                  if (currentTurnAssistantMsg) currentTurnAssistantMsg.todos = committed;
                  emitEvent({ type: "todo_update", todos: committed, toolCallId });
                }
              },
              currentTodos: () => todos.snapshot(),
              askUser: agentConfig.onAskQuestion
                ? async (questions) => {
                    const askStart = Date.now();
                    try {
                      return await agentConfig.onAskQuestion!(toolCallId, questions);
                    } finally {
                      questionWaitingMs += Date.now() - askStart;
                    }
                  }
                : undefined,
              onTaskStarted: (task) => emitEvent({
                type: "task_started",
                task: { ...task, output: task.output?.slice(-20) },
              }),
              onSubAgentStarted: (agent) => emitEvent({ type: "subagent_started", agent }),
              onSubAgentUpdated: (agent) => emitEvent({ type: "subagent_updated", agent }),
              onSubAgentFinished: (agentId, res, error, agent) => emitEvent({ type: "subagent_finished", agentId, result: res, error, agent }),
              onSubAgentKilled: (agentId, agent) => emitEvent({ type: "subagent_killed", agentId, agent }),
              onSourceCreated: (source) => emitEvent({ type: "source_created", source }),
              onArtifactCreated: (artifact) => emitEvent({ type: "artifact_created", artifact }),
              browserHandler: agentConfig.browserHandler,
              computerHandler: agentConfig.computerHandler,
              voiceConfig: agentConfig.voiceConfig,
              imageConfig: agentConfig.imageConfig,
              speechHandler: agentConfig.speechHandler,
              imageHandler: agentConfig.imageHandler,
            });

            if (agentConfig.deferNativeTools && !isError && ["read", "readfile"].includes(normalizeToolName(name))) {
              const readPath = extractPathArg(effectiveArgs);
              if (readPath) {
                const resolved = path.resolve(workspacePath, readPath);
                for (const plugin of resolveSkillRegistry(workspacePath).plugins) {
                  if (!plugin.isEffective || !plugin.isEnabled || !plugin.skills.some((skill) => skill.isEnabled && path.resolve(skill.filePath) === resolved)) continue;
                  for (const capability of plugin.nativeCapabilities ?? []) {
                    if (enabledNativePlugins.includes(capability) && agentConfig.nativeCapabilityEnabled?.(capability) !== false) {
                      loadedNativePlugins.add(capability);
                    }
                  }
                }
              }
            }

            if (!isError && images?.length) {
              currentTurnToolObservations.push({ id: toolCallId, name, images });
              if (currentTurnToolObservations.length > 2) currentTurnToolObservations.shift();
            }

            if (shouldRunParallel && !isError && typeof result === "string") {
              const match = result.match(/id="([^"]+)"/);
              if (match && match[1]) {
                currentTurnParallelAgents.push({ agentId: match[1], toolCallId, toolName: name });
              }
            }

            const durationMs = Math.max(0, Date.now() - toolStartedAt - questionWaitingMs);
            toolMetaByCallId.set(toolCallId, {
              rawResult: result,
              durationMs,
              waitingMs: perm.waitingMs + questionWaitingMs,
              isError: Boolean(isError),
            });

            return {
              content: [
                { type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) },
                ...(images ?? []).map(({ data, mimeType }) => ({ type: "image" as const, data, mimeType })),
              ],
              details: result,
              isError: Boolean(isError),
            };
          },
        };
      });
    };

    // Custom Pi streamFn wired to Harness's resilient OpenAI-compatible Router transport
    const streamFn = (_model: Model<any>, _context: any, streamOptions: any) => {
      const eventStream = createAssistantMessageEventStream();
      const callSignal: AbortSignal = streamOptions?.signal
        ? AbortSignal.any([runSignal, streamOptions.signal])
        : runSignal;

      void (async () => {
        try {
          while (true) {
            if (callSignal.aborted || this._isCancelled) {
              throw new DOMException("The operation was aborted.", "AbortError");
            }

            drainSteeringQueue();
            currentTurn++;
            emitEvent({ type: "status", status: "thinking" });

            const { definitions: activeTools, enabledNativePlugins, hasBrowserOrComputerTools } = await resolveActiveTools(callSignal);
            activeToolDefinitions = activeTools;
            if (this.activePiAgent) {
              this.activePiAgent.state.tools = buildPiTools(activeTools, enabledNativePlugins);
            }
            const requestTools = activeTools.map(({ requiresApproval: _approval, ...definition }) => definition);

            const systemPrompt = isCompanion
              ? `You are the user's side chat companion. Answer questions directly using the supplied parent task snapshot and side chat history. The parent task may still be running. State when information is unavailable or may have changed. Do not claim to have changed files, sent instructions, or updated the parent task. The user can explicitly send an instruction to the main task through the interface.\n\n${LANGUAGE_GUIDANCE}\n\n${this.config.systemPrompt || ""}`
              : buildConstSystemPrompt(
                  workspacePath,
                  this.config.systemPrompt,
                  activeTools,
                  this.config.isolateWorkspace && this.config.sourceProjectPath && this.config.sourceProjectPath !== "Outside Project"
                    ? this.config.sourceProjectPath
                    : workspacePath,
                );

            const turnInstructions: string[] = [];
            const todoEnabled = !isCompanion && activeTools.some((tool) => isTodoTool(tool.function.name));
            const repeatedFailure = progress.hasRepeatedVerificationFailure();
            const progressCheckpoint = isCompanion ? undefined : progress.checkpoint(currentTurn);
            if (progressCheckpoint) {
              emitEvent({ type: "progress_checkpoint", ...progressCheckpoint });
              turnInstructions.push(
                progressCheckpoint.kind === "repeated_result"
                  ? (repeatedFailure ? REPEATED_FAILURE_GUIDANCE : REPEATED_RESULT_GUIDANCE)
                  : PROGRESS_REVIEW_GUIDANCE,
              );
              if (todoEnabled && todos.summary()) turnInstructions.push(todos.summary());
            }
            const planReview = todoEnabled ? todos.midRunReminder() : undefined;
            if (planReview) {
              emitEvent({ type: "progress_checkpoint", kind: "todo_stale", turn: currentTurn });
              turnInstructions.push(planReview);
            }
            const latestUserMessage = [...conversationHistory].reverse().find((m) => m.role === "user" && !m.toolObservationId);
            const latestUserText = typeof latestUserMessage?.content === "string"
              ? latestUserMessage.content
              : Array.isArray(latestUserMessage?.content)
                ? latestUserMessage.content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n")
                : "";
            const pluginInstructions = isCompanion ? "" : pluginInvocationInstructions(latestUserText, resolveSkillRegistry(workspacePath).plugins);
            if (pluginInstructions) turnInstructions.push(pluginInstructions);
            if (!isCompanion && activeGoal?.status === "active") {
              turnInstructions.push(buildGoalActivePrompt(activeGoal));
            }
            if (!isCompanion && activeApprovedPlanPath && this.authorization.runIntent !== "plan" && contextRecoveryAttempted) {
              turnInstructions.push(
                `[PLAN REFERENCE]: An approved implementation plan is saved at \`${activeApprovedPlanPath}\`. If earlier plan details were compressed during context recovery, read \`${activeApprovedPlanPath}\` and continue executing it faithfully.`,
              );
            }
            if (recoveryInstruction) {
              turnInstructions.push(recoveryInstruction);
              recoveryInstruction = "";
            }
            if (this.config.softTurnBudget && currentTurn >= this.config.softTurnBudget) {
              const hardLimit = Number.isFinite(maxTurns) ? `, hard limit: ${maxTurns} turns` : "";
              turnInstructions.push(`[TURN BUDGET WARNING: You have reached turn ${currentTurn} (soft budget: ${this.config.softTurnBudget} turns${hardLimit}). Stop starting new lines of inquiry immediately. Synthesize your findings from the work already completed and return your final structured report now.]`);
            }

            contextSystemPrompt = systemPrompt;
            contextTools = requestTools;
            const historyForContext = fitRequestHistory(
              compactHistoryForContext(conversationHistory, contextRecoveryAttempted ? 0 : 4, payloadRecoveryAttempted),
            );
            const requestHistory: HarnessMessage[] = [
              ...historyForContext,
              ...(turnInstructions.length ? [{ role: "system" as const, content: turnInstructions.join("\n\n") }] : []),
            ];

            const nonSystemFormatted = requestHistory.map((m, mIdx) => {
              const item: { role: string; [key: string]: any } = {
                role: m.role,
                content: imageContentForModel(m.content ?? "", modelSupportsImages && !toolVisionUnavailable),
              };
              if (m.role === "assistant" && m.thinking) {
                item.reasoning_content = m.thinking;
              }
              if (m.name) item.name = m.name;
              if (m.role === "tool") {
                item.tool_call_id = m.tool_call_id || `call_tool_${mIdx}`;
              } else if (m.tool_call_id) {
                item.tool_call_id = m.tool_call_id;
              }
              if (m.tool_calls && m.tool_calls.length > 0) {
                item.tool_calls = m.tool_calls;
                if (!m.content) item.content = null;
              }
              return item;
            });

            const breakdown = calculateContextBreakdown({
              systemPrompt,
              tools: requestTools,
              messages: requestHistory,
            });
            const occupancy = calculateContextOccupancy(
              { projectedTokens: breakdown.totalHeuristicTokens, contextWindow: resolvedContextWindow },
              breakdown.totalHeuristicTokens,
              resolvedContextWindow,
            );
            emitEvent({
              type: "context_update",
              model: this.config.model,
              updatedAt: Date.now(),
              systemPromptTokens: breakdown.systemTokens,
              toolsTokens: breakdown.toolsTokens,
              messagesTokens: breakdown.messageTokens,
              usedTokens: occupancy.usedTokens,
              totalTokens: occupancy.contextWindow,
              percent: occupancy.percent,
            });

            const DEFAULT_MAX_OUTPUT_TOKENS = 65_536;
            const modelMaxOutputCap = activeModelInfo?.maxOutputTokens;
            const modelLower = (this.config.model || "").toLowerCase();
            const is128kModel = modelLower.startsWith("const") || modelLower.includes("combo/");
            const requestedMaxTokens =
              this.config.maxOutputTokens ??
              this.config.maxTokens ??
              modelMaxOutputCap ??
              (is128kModel ? 128_000 : DEFAULT_MAX_OUTPUT_TOKENS);
            const cappedMaxTokens = modelMaxOutputCap ? Math.min(requestedMaxTokens, modelMaxOutputCap) : requestedMaxTokens;
            const remainingOutputTokens = Math.max(1, resolvedContextWindow - Math.ceil(breakdown.totalHeuristicTokens * 1.2) - 1024);
            const resolvedMaxTokens = Math.min(cappedMaxTokens, remainingOutputTokens, contextRecoveryAttempted ? 8192 : Infinity);

            const dialectReq = buildDialectRequest({
              dialect: activeDialect,
              baseUrl: this.config.baseUrl,
              apiKey: this.config.apiKey,
              model: this.config.model,
              systemPrompt,
              messages: nonSystemFormatted,
              tools: requestTools,
              maxTokens: resolvedMaxTokens,
              thinkingLevel: effectiveThinkingLevel,
              hasBrowserOrComputerTools,
              providerHeaders: this.config.providerHeaders,
              providerAccountId: this.config.providerAccountId,
              providerProjectId: this.config.providerProjectId,
              providerAuthType: this.config.providerAuthType,
            });
            const activeEndpoint = dialectReq.url;
            const configuredBodyLimit = requestBodyBudget(activeEndpoint, this.config.requestBodyLimitBytes);

            let prepared: Awaited<ReturnType<typeof prepareRequest>>;
            try {
              const bodyLimit = Math.min(configuredBodyLimit ?? Infinity, payloadRecoveryLimit ?? Infinity);
              prepared = await prepareRequest(dialectReq.bodyObj as any, {
                endpoint: activeEndpoint,
                runId,
                signal: callSignal,
                limitBytes: Number.isFinite(bodyLimit) ? bodyLimit : undefined,
                recovery: payloadRecoveryAttempted ? "payload" : contextRecoveryAttempted ? "context" : undefined,
              });
            } catch (error) {
              if (error instanceof AgentRequestError && error.category === "payload" && error.diagnostics && recoverPayload(error.diagnostics)) {
                currentTurn--;
                continue;
              }
              throw error;
            }
            if (rejectedPayloadBytes !== undefined && prepared.diagnostics.requestBytes >= rejectedPayloadBytes) {
              throw new AgentRequestError(PAYLOAD_ERROR_MESSAGE, "payload", 413);
            }

            Object.assign(prepared.diagnostics, {
              thinkingLevel: (effectiveThinkingLevel as any) || "provider_default",
              maxOutputTokens: resolvedMaxTokens,
              toolNames: requestTools.map((tool) => tool.function.name),
              loadedNativePlugins: [...loadedNativePlugins],
              retryCount: 0,
            });
            emitEvent({ type: "request_prepared", ...prepared.diagnostics });
            const request = trackLlmRequest(`${runId}_${++requestSequence}`, this.config.model, emitEvent, Date.now, prepared.diagnostics);
            activeRequest = request;

            const response = await fetchWithRetry(
              activeEndpoint,
              {
                method: "POST",
                headers: dialectReq.headers,
                body: prepared.body,
              },
              {
                signal: callSignal,
                maxRetries: isCompanion ? 1 : 4,
                onRetry: (attempt, maxRetries, reason) => {
                  request.updateDiagnostics({ retryCount: attempt });
                  emitEvent({
                    type: "status",
                    status: "thinking",
                    message: `Connection interrupted (${reason}). Reconnecting (attempt ${attempt}/${maxRetries})...`,
                  });
                },
              },
            );
            request.updateDiagnostics({ httpStatus: response.status });

            if (!response.ok) {
              const rawErr = await response.text().catch(() => "Unknown error");
              let cleanMessage = rawErr;
              try {
                const parsed = JSON.parse(rawErr);
                if (parsed?.error?.message) cleanMessage = parsed.error.message;
                else if (parsed?.message) cleanMessage = parsed.message;
              } catch {}

              if (response.status === 413) {
                request.updateDiagnostics({ errorCategory: "payload" });
                request.finish("failed");
                if (recoverPayload(prepared.diagnostics)) {
                  currentTurn--;
                  continue;
                }
                throw new AgentRequestError(PAYLOAD_ERROR_MESSAGE, "payload", 413);
              }

              if (recoverContext(cleanMessage)) {
                request.updateDiagnostics({ errorCategory: "context" });
                request.finish("failed");
                currentTurn--;
                continue;
              }

              const isHtmlGatewayError = cleanMessage.includes("<!DOCTYPE") || cleanMessage.includes("<html");
              if (
                isHtmlGatewayError ||
                (!cleanMessage.trim() && (response.status === 502 || response.status === 503 || response.status === 504))
              ) {
                cleanMessage = `Const Engine server gateway error (${response.status}). Upstream connection timed out or is temporarily unreachable.`;
              }

              const explicitVisionRejection = !modelSupportsImages || isUnsupportedImageError(cleanMessage);
              const msgWithImages = [...conversationHistory].reverse().find(
                (m) => Array.isArray(m.content) && m.content.some((p: any) => p.type === "image_url"),
              );
              if (msgWithImages && Array.isArray(msgWithImages.content) && explicitVisionRejection) {
                const textParts = msgWithImages.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n");
                const imgCount = msgWithImages.content.filter((p: any) => p.type === "image_url").length;
                if (msgWithImages.toolObservationId) {
                  toolVisionUnavailable = true;
                  disableToolObservationImages(conversationHistory);
                }
                msgWithImages.content = msgWithImages.toolObservationId
                  ? UNAVAILABLE_TOOL_VISION
                  : `${textParts}\n\n[PEMBERITAHUAN MEDIA: Pengguna melampirkan ${imgCount} berkas visual. Model tidak mendukung input gambar langsung; lanjutkan berdasarkan konteks teks.]`;
                emitEvent({
                  type: "status",
                  status: "thinking",
                  message: "Input visual langsung tidak didukung provider. Mengalihkan ke mode referensi berkas dan melanjutkan respon...",
                });
                request.finish("failed");
                currentTurn--;
                consecutiveEmptyRetries = 0;
                continue;
              }

              const cat: AgentErrorCategory = isContextWindowError(cleanMessage)
                ? "context"
                : isRouterBudgetLimitError(cleanMessage) || isNonRetryableModelError(cleanMessage)
                  ? "model"
                  : response.status >= 500 || response.status === 429
                    ? "transport"
                    : "model";
              request.updateDiagnostics({ errorCategory: cat });
              request.finish("failed");
              throw new AgentRequestError(`Const error (${response.status}): ${cleanMessage}`, cat, response.status);
            }

            if (!response.body) {
              throw new Error("No response body from Const");
            }

            let turnContent = "";
            let turnThinking = "";
            let turnFinishReason: string | null = null;
            let turnUsageInput = 0;
            let turnUsageOutput = 0;
            let turnUsageCacheWrite = 0;
            const streamFilter = new ThinkingStreamFilter();
            const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();

            try {
              await consumeDialectStream(
                activeDialect,
                response.body,
                (json) => {
                  if (json?.usage) {
                    request.observeUsage(json.usage);
                    if (typeof json.usage.prompt_tokens === "number") turnUsageInput = Math.max(turnUsageInput, json.usage.prompt_tokens);
                    if (typeof json.usage.completion_tokens === "number") turnUsageOutput = Math.max(turnUsageOutput, json.usage.completion_tokens);
                    if (typeof json.usage.cache_creation_input_tokens === "number") {
                      turnUsageCacheWrite = Math.max(turnUsageCacheWrite, json.usage.cache_creation_input_tokens);
                    }
                  }
                  const choice = json.choices?.[0];
                  if (choice?.finish_reason) turnFinishReason = choice.finish_reason;
                  const delta = choice?.delta || choice?.message;
                  if (!delta) return;
                  request.observeDelta(delta);

                  const reasoningDelta =
                    delta.reasoning_content ||
                    delta.reasoning ||
                    delta.thought ||
                    (typeof delta.thinking === "string" ? delta.thinking : "");
                  if (reasoningDelta) {
                    turnThinking += reasoningDelta;
                    emitEvent({ type: "thinking", thinking: reasoningDelta });
                  }

                  if (delta.content) {
                    const filtered = streamFilter.push(delta.content);
                    if (filtered.thinking) {
                      turnThinking += filtered.thinking;
                      emitEvent({ type: "thinking", thinking: filtered.thinking });
                    }
                    if (filtered.content) {
                      turnContent += filtered.content;
                      emitEvent({ type: "token", token: filtered.content });
                    }
                  }

                  if (Array.isArray(delta.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      if (!toolCallsMap.has(idx)) {
                        toolCallsMap.set(idx, {
                          id: tc.id || `call_${Date.now()}_${idx}`,
                          name: tc.function?.name || "",
                          arguments: tc.function?.arguments || "",
                        });
                      } else {
                        const c = toolCallsMap.get(idx)!;
                        if (tc.id) c.id = tc.id;
                        if (tc.function?.name) c.name += tc.function.name;
                        if (tc.function?.arguments) c.arguments += tc.function.arguments;
                      }
                    }
                  }
                },
                callSignal,
              );
            } catch (streamErr: any) {
              if (turnContent) emitEvent({ type: "token_reset" });
              const errMsg = streamErr?.message || "";
              const nonRetryable = isNonRetryableModelError(errMsg);
              request.updateDiagnostics({
                errorCategory: callSignal.aborted
                  ? "cancelled"
                  : isContextWindowError(errMsg)
                    ? "context"
                    : nonRetryable
                      ? "model"
                      : "transport",
              });
              request.finish(callSignal.aborted || this._isCancelled ? "cancelled" : "failed");
              if (callSignal.aborted || streamErr?.name === "AbortError") throw streamErr;
              if (nonRetryable) throw new AgentRequestError(errMsg, "model");
              if (recoverContext(errMsg)) {
                currentTurn--;
                continue;
              }

              const isReasoningOnlyFailure =
                streamErr instanceof ReasoningOnlyTimeoutError ||
                Boolean(turnThinking && !turnContent && toolCallsMap.size === 0);
              if (isReasoningOnlyFailure) {
                if (consecutivePlanningTurns >= 1) {
                  throw new AgentRequestError(
                    errMsg || "Model spent too long reasoning without producing a response or tool call.",
                    "transport",
                  );
                }
                consecutivePlanningTurns++;
                const downgraded = downgradeThinkingLevel(effectiveThinkingLevel);
                if (downgraded && !reasoningDowngradedForTurn) {
                  effectiveThinkingLevel = downgraded;
                  reasoningDowngradedForTurn = true;
                }
                recoveryInstruction = REASONING_RECOVERY_GUIDANCE;
                currentTurn--;
                emitEvent({
                  type: "status",
                  status: "thinking",
                  message: downgraded
                    ? `Model spent too long reasoning without output. Retrying once with reduced reasoning effort (${downgraded})...`
                    : "Model stream ended during reasoning without output. Retrying once with a direct prompt...",
                });
                await abortableDelay(800, callSignal);
                continue;
              }

              const isVisionError = !modelSupportsImages || isUnsupportedImageError(errMsg);
              const msgWithImages = [...conversationHistory].reverse().find(
                (m) => Array.isArray(m.content) && m.content.some((p: any) => p.type === "image_url"),
              );
              if (isVisionError && msgWithImages && Array.isArray(msgWithImages.content)) {
                const textParts = msgWithImages.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n");
                const imgCount = msgWithImages.content.filter((p: any) => p.type === "image_url").length;
                if (msgWithImages.toolObservationId) {
                  toolVisionUnavailable = true;
                  disableToolObservationImages(conversationHistory);
                }
                msgWithImages.content = msgWithImages.toolObservationId
                  ? UNAVAILABLE_TOOL_VISION
                  : `${textParts}\n\n[PEMBERITAHUAN MEDIA: Pengguna melampirkan ${imgCount} berkas visual. Model tidak mendukung input gambar langsung; lanjutkan berdasarkan konteks teks.]`;
                emitEvent({
                  type: "status",
                  status: "thinking",
                  message: "Input visual langsung tidak didukung provider. Mengalihkan ke mode referensi berkas dan melanjutkan respon...",
                });
                currentTurn--;
                consecutiveEmptyRetries = 0;
                continue;
              }

              if (consecutiveEmptyRetries < MAX_EMPTY_RETRIES) {
                consecutiveEmptyRetries++;
                currentTurn--;
                const backoffMs = Math.min(1000 * Math.pow(2, consecutiveEmptyRetries - 1), 6000) + Math.floor(Math.random() * 400);
                emitEvent({
                  type: "status",
                  status: "thinking",
                  message: `Koneksi stream terputus (${errMsg || "stream drop"}). Mengulang otomatis (percobaan ${consecutiveEmptyRetries}/${MAX_EMPTY_RETRIES} dalam ${(backoffMs / 1000).toFixed(1)}s)...`,
                });
                await abortableDelay(backoffMs, callSignal);
                continue;
              }
              throw streamErr;
            }

            const flushed = streamFilter.flush();
            if (flushed.thinking) {
              turnThinking += flushed.thinking;
              emitEvent({ type: "thinking", thinking: flushed.thinking });
            }
            if (flushed.content) {
              turnContent += flushed.content;
              emitEvent({ type: "token", token: flushed.content });
            }

            request.finish("completed");
            contextRecoveryAttempted = false;
            payloadRecoveryAttempted = false;
            payloadRecoveryLimit = undefined;
            rejectedPayloadBytes = undefined;

            // OMP-aligned Goal token & wall-clock accounting + budget-limit enforcement
            if (!isCompanion && activeGoal && (activeGoal.status === "active" || activeGoal.status === "budget-limited")) {
              const nowAcc = Date.now();
              const wallDeltaSec = Math.max(0, Math.floor((nowAcc - goalWallLastAccountedMs) / 1000));
              const tokenDelta = turnUsageInput + turnUsageCacheWrite + turnUsageOutput;
              if (wallDeltaSec > 0) goalWallLastAccountedMs += wallDeltaSec * 1000;
              if (tokenDelta > 0 || wallDeltaSec > 0) {
                activeGoal = {
                  ...activeGoal,
                  tokensUsed: (activeGoal.tokensUsed ?? 0) + tokenDelta,
                  timeUsedSeconds: (activeGoal.timeUsedSeconds ?? 0) + wallDeltaSec,
                  updatedAt: nowAcc,
                };
                if (
                  activeGoal.tokenBudget !== undefined &&
                  (activeGoal.tokensUsed ?? 0) >= activeGoal.tokenBudget &&
                  activeGoal.status === "active"
                ) {
                  activeGoal = { ...activeGoal, status: "budget-limited", updatedAt: nowAcc };
                }
                emitEvent({ type: "goal_update", goal: activeGoal });
              }
              if (activeGoal.status === "budget-limited" && !goalBudgetSteerSent) {
                goalBudgetSteerSent = true;
                recoveryInstruction = buildGoalBudgetLimitPrompt(activeGoal);
              }
            }

            if (turnFinishReason === "length" && toolCallsMap.size > 0) {
              toolCallsMap.clear();
              turnContent = "";
              emitEvent({ type: "token_reset" });
              recoveryInstruction = TRUNCATED_RESPONSE_GUIDANCE;
              if (++consecutiveDraftCutoffs > 2) {
                throw new Error("Model repeatedly truncated tool arguments. Choose a model with a larger output limit.");
              }
              continue;
            }
            consecutiveDraftCutoffs = 0;

            let rawToolCalls: ToolCall[] = Array.from(toolCallsMap.values())
              .filter((tc) => tc.name && tc.name.trim().length > 0)
              .map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.arguments },
              }));

            if (rawToolCalls.length === 0 && !isCompanion && activeTools.length > 0 && turnContent.trim().length > 0) {
              const declared = new Set(activeTools.map((t) => t.function.name));
              const fallback = extractFallbackToolCalls(turnContent, declared);
              if (fallback.length > 0) rawToolCalls = fallback;
            }

            const hasActionableOutput = rawToolCalls.length > 0 || turnContent.trim().length > 0;
            const hasThinking = turnThinking.trim().length > 0;
            if (hasActionableOutput) {
              consecutivePlanningTurns = 0;
              consecutiveEmptyRetries = 0;
              if (reasoningDowngradedForTurn) {
                effectiveThinkingLevel = this.config.thinkingLevel;
                reasoningDowngradedForTurn = false;
              }
            } else if (!isCompanion && hasThinking) {
              if (consecutivePlanningTurns >= 1) {
                throw new AgentRequestError("Model returned only private reasoning without a response or tool call.", "model");
              }
              consecutivePlanningTurns++;
              const downgraded = downgradeThinkingLevel(effectiveThinkingLevel);
              if (downgraded && !reasoningDowngradedForTurn) {
                effectiveThinkingLevel = downgraded;
                reasoningDowngradedForTurn = true;
              }
              recoveryInstruction = REASONING_RECOVERY_GUIDANCE;
              continue;
            }

            // Build Pi AssistantMessage
            const contentBlocks: AssistantMessage["content"] = [];
            if (turnThinking) contentBlocks.push({ type: "thinking", thinking: turnThinking });
            if (turnContent) contentBlocks.push({ type: "text", text: turnContent });
            const piToolCalls: PiToolCall[] = rawToolCalls.map((tc) => ({
              type: "toolCall",
              id: tc.id,
              name: tc.function.name,
              arguments: parseToolArguments(tc.function.arguments),
            }));
            for (const ptc of piToolCalls) contentBlocks.push(ptc);

            // Sync Harness conversationHistory + emit commentary / tool status
            if (rawToolCalls.length > 0) {
              for (const tc of rawToolCalls) {
                turnActivityTokens.push(`call:${tc.function.name}:${tc.function.arguments.slice(0, 120)}`);
              }
              emitEvent({ type: "commentary", content: turnContent });
              emitEvent({ type: "status", status: "calling_tool", message: `Executing ${rawToolCalls.length} tool(s)...` });
              currentTurnToolObservations = [];
              currentTurnParallelAgents = [];
              currentTurnSubagentCount = rawToolCalls.filter((tc) => isSubAgentToolName(tc.function.name)).length;
              currentTurnAssistantMsg = {
                role: "assistant",
                content: turnContent,
                thinking: turnThinking || undefined,
                tool_calls: rawToolCalls,
                timestamp: Date.now(),
              };
              conversationHistory.push(currentTurnAssistantMsg);
            } else {
              // OMP-aligned Goal Mode continuation guard:
              // - Stops automatically if goal is budget-limited / paused / complete / dropped.
              // - Computes tool activity digest since the last continuation; if two consecutive
              //   continuation turns produce identical/empty tool activity (no progress), stops cleanly.
              // - Feeds remaining incomplete TodoTracker items into the continuation audit prompt.
              if (
                !isCompanion &&
                activeGoal &&
                activeGoal.status === "active" &&
                goalContinuationReminders < 3 &&
                currentTurn < maxTurns
              ) {
                const activityDigest = turnActivityTokens.join("|");
                turnActivityTokens = [];
                const stalledWithoutProgress =
                  lastContinuationActivityDigest !== null &&
                  (activityDigest === "" || activityDigest === lastContinuationActivityDigest);

                if (!stalledWithoutProgress) {
                  lastContinuationActivityDigest = activityDigest;
                  goalContinuationReminders++;
                  if (turnContent || turnThinking) {
                    conversationHistory.push({
                      role: "assistant",
                      content: turnContent,
                      thinking: turnThinking || undefined,
                      timestamp: Date.now(),
                    });
                  }
                  const incompleteTodos = (todos.snapshot() || [])
                    .filter((item) => item.status !== "completed")
                    .map((item) => item.content || item.title || item.task || "")
                    .filter(Boolean);
                  recoveryInstruction = buildGoalContinuationPrompt(activeGoal, incompleteTodos);
                  emitEvent({
                    type: "status",
                    status: "thinking",
                    message: `Continuing goal verification (${goalContinuationReminders}/3)...`,
                  });
                  continue;
                }
              }

              currentTurnAssistantMsg = undefined;
              finalAssistantText = turnContent;
              if (turnContent || turnThinking) {
                conversationHistory.push({
                  role: "assistant",
                  content: turnContent,
                  thinking: turnThinking || undefined,
                  timestamp: Date.now(),
                });
              }
            }

            const assistantMessage: AssistantMessage = {
              role: "assistant",
              content: contentBlocks,
              api: piModel.api,
              provider: piModel.provider,
              model: piModel.id,
              usage: { ...EMPTY_USAGE },
              stopReason: piToolCalls.length > 0 ? "toolUse" : "stop",
              timestamp: Date.now(),
            };

            eventStream.push({ type: "start", partial: assistantMessage });
            eventStream.push({
              type: "done",
              reason: piToolCalls.length > 0 ? "toolUse" : "stop",
              message: assistantMessage,
            });
            eventStream.end(assistantMessage);
            return;
          }
        } catch (err: any) {
          terminalException = err instanceof Error ? err : new Error(String(err));
          const aborted = callSignal.aborted || this._isCancelled || err?.name === "AbortError";
          const errorMessage: AssistantMessage = {
            role: "assistant",
            content: [],
            api: piModel.api,
            provider: piModel.provider,
            model: piModel.id,
            usage: { ...EMPTY_USAGE },
            stopReason: aborted ? "aborted" : "error",
            errorMessage: terminalException.message,
            timestamp: Date.now(),
          };
          eventStream.push({ type: "error", reason: aborted ? "aborted" : "error", error: errorMessage });
          eventStream.end(errorMessage);
        }
      })();

      return eventStream;
    };

    try {
      const restoredTodos = todos.snapshot();
      if (restoredTodos && !isCompanion) {
        emitEvent({ type: "todo_update", todos: restoredTodos });
      }

      const { definitions: initialDefs, enabledNativePlugins: initialPlugins } = await resolveActiveTools(runSignal);
      activeToolDefinitions = initialDefs;
      const piTools = buildPiTools(initialDefs, initialPlugins);
      const piHistory = toPiMessages(messages, piModel);

      const lastPi = piHistory.at(-1);
      const canContinue = lastPi && (lastPi.role === "user" || lastPi.role === "toolResult");
      const initialPiMessages = canContinue ? piHistory.slice(0, -1) : piHistory;

      const piAgent = new Agent({
        initialState: {
          model: piModel,
          systemPrompt: this.config.systemPrompt || "",
          messages: initialPiMessages,
          thinkingLevel: toPiThinkingLevel(this.config.thinkingLevel),
          tools: piTools,
        },
        toolExecution: "sequential",
        sessionId: this.config.conversationId,
        identity: { attribution: null },
        streamFn,
        prepareRequest: async (request, signal) => {
          const effectiveSignal = signal ? AbortSignal.any([runSignal, signal]) : runSignal;
          const { definitions, enabledNativePlugins } = await resolveActiveTools(effectiveSignal);
          activeToolDefinitions = definitions;
          const nextTools = buildPiTools(definitions, enabledNativePlugins);
          if (this.activePiAgent) this.activePiAgent.state.tools = nextTools;
          return { context: { ...request.context, tools: nextTools } };
        },
        prepareNextTurnWithContext: ({ context }) => ({
          context: { ...context, tools: this.activePiAgent?.state.tools ?? context.tools },
        }),
        beforeToolCall: async ({ assistantMessage, toolCall, args: validatedArgs }, signal) => {
          const effectiveSignal = signal ? AbortSignal.any([runSignal, signal]) : runSignal;
          if (effectiveSignal.aborted || this._isCancelled) {
            return { block: true, reason: "User cancelled agent execution.", terminate: true };
          }
          if (turnStalledError) {
            return { block: true, reason: turnStalledError.message, terminate: true };
          }
          if (this.steeringQueue.some((item) => item.sourceSideChatId)) {
            return {
              block: true,
              reason: "This action was skipped because a new user instruction is waiting. Reassess it after reading the instruction.",
            };
          }
          if (deniedAssistantMessages.has(assistantMessage)) {
            return {
              block: true,
              reason: "An earlier action in this turn was rejected. Replan using the user's feedback.",
            };
          }
          const definition = activeToolDefinitions.find((t) => t.function.name === toolCall.name);
          if (!definition) return;
          const args = (validatedArgs && typeof validatedArgs === "object" ? validatedArgs : {}) as Record<string, unknown>;
          const call: ToolCall = {
            id: toolCall.id,
            type: "function",
            function: { name: toolCall.name, arguments: JSON.stringify(args) },
          };
          const authStart = Date.now();
          const { allowOutsideWorkspace, rejection } = await this.authorization.authorize(
            call,
            args,
            workspacePath,
            definition,
            effectiveSignal,
            (ev) => emitEvent(ev),
          );
          const waitingMs = Date.now() - authStart;
          if (effectiveSignal.aborted || this._isCancelled) {
            return { block: true, reason: "User cancelled agent execution.", terminate: true };
          }
          if (rejection) {
            if (rejection.decision === "deny") deniedAssistantMessages.add(assistantMessage);
            return { block: true, reason: rejection.text };
          }
          effectiveSignal.throwIfAborted();
          permissions.set(args, { allowOutsideWorkspace, waitingMs });
          return undefined;
        },
        finishTurn: async (turn, signal) => {
          if (signal?.aborted || runSignal.aborted || this._isCancelled) {
            return { action: "end" };
          }
          if (turn.message.stopReason === "error" || turn.message.stopReason === "aborted") {
            return { action: "end" };
          }

          if (currentTurnToolObservations.length > 0) {
            appendToolObservations(conversationHistory, currentTurnToolObservations, !toolVisionUnavailable && modelSupportsImages);
            currentTurnToolObservations = [];
          }

          // Wait for parallel subagents spawned in this turn before next model turn
          if (currentTurnParallelAgents.length > 0) {
            const spawned = [...currentTurnParallelAgents];
            currentTurnParallelAgents = [];
            emitEvent({
              type: "status",
              status: "calling_tool",
              message: `Running ${spawned.length} subagents in parallel...`,
            });
            await Promise.all(
              spawned.map((item) => globalSubAgentManager.waitForSubAgent(item.agentId, runSignal, this.config.conversationId)),
            );
            if (runSignal.aborted || this._isCancelled) return { action: "end" };

            for (const item of spawned) {
              const sub = globalSubAgentManager.getSubAgent(item.agentId, this.config.conversationId);
              if (!sub) continue;
              const durationSec = Math.round(((sub.endTime || Date.now()) - sub.startTime) / 1000);
              const finalStatus = sub.status === "killed" ? "cancelled" : sub.status === "failed" ? "failed" : "completed";
              const finalEnvelope = formatTaskResultEnvelope({
                id: sub.id,
                name: sub.name,
                agent: sub.role || "task",
                status: finalStatus,
                durationSec,
                output: sub.result || "Completed with no output.",
                error: sub.error,
                artifactPath: sub.artifactPath,
                turnCount: sub.turnCount,
              });
              const finalIsError = finalStatus === "failed" || finalStatus === "cancelled";
              emitEvent({
                type: "tool_result",
                toolCallId: item.toolCallId,
                toolName: item.toolName,
                result: finalEnvelope,
                isError: finalIsError,
              });
              const histIdx = conversationHistory.findIndex(
                (m) =>
                  m.role === "tool" &&
                  (m.tool_call_id === item.toolCallId || (typeof m.content === "string" && m.content.includes(item.agentId))),
              );
              if (histIdx !== -1 && conversationHistory[histIdx]) {
                conversationHistory[histIdx]!.content = finalEnvelope;
              }
            }
          }

          if (turnStalledError) {
            terminalException = turnStalledError;
            return { action: "end" };
          }

          if (turn.toolResults.length > 0 && currentTurn >= maxTurns) {
            const limitMessage = `Task execution reached the maximum limit (${maxTurns} turns). You can send a follow-up message like "continue" or "lanjutkan" to keep going.`;
            conversationHistory.push({
              role: "assistant",
              content: limitMessage,
              timestamp: Date.now(),
            });
            terminalException = new AgentRequestError(limitMessage, "turn_limit");
            return { action: "end" };
          }

          // If user steered while the final non-tool answer was streaming, continue another turn
          if (turn.toolResults.length === 0 && this.steeringQueue.length > 0) {
            return { action: "continue" };
          }

          return undefined;
        },
      });

      this.activePiAgent = piAgent;

      // Bridge Pi tool lifecycle events to Harness events + conversationHistory + progress guard
      piAgent.subscribe((event) => {
        if (event.type === "tool_execution_start") {
          emitEvent({
            type: "tool_call",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
          });
        } else if (event.type === "tool_execution_end") {
          const meta = toolMetaByCallId.get(event.toolCallId);
          toolMetaByCallId.delete(event.toolCallId);
          const firstText = event.result?.content?.find((c: any) => c.type === "text")?.text ?? "";
          const rawResult = meta ? meta.rawResult : firstText;
          const isError = meta ? meta.isError : Boolean(event.isError);

          emitEvent({
            type: "tool_result",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            result: rawResult,
            isError,
            durationMs: meta?.durationMs,
            waitingMs: meta?.waitingMs,
          });

          const rawResultText = typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult, null, 2);
          const toolContent = isError
            ? `[TOOL ERROR - ACTION FAILED]:\n${rawResultText}\n\n(The action failed. Please inspect the error above and adapt your approach. Do NOT repeat the exact same call).`
            : rawResultText;

          conversationHistory.push({
            role: "tool",
            tool_call_id: event.toolCallId,
            name: event.toolName,
            content: toolContent,
            isError,
            timestamp: Date.now(),
          });

          todos.record(event.toolName, isError);

          // Check loop/verification failure stall immediately after recording result
          if (!runSignal.aborted && !this._isCancelled && !turnStalledError) {
            const args = currentTurnAssistantMsg?.tool_calls?.find((tc) => tc.id === event.toolCallId)
              ? parseToolArguments(currentTurnAssistantMsg.tool_calls.find((tc) => tc.id === event.toolCallId)!.function.arguments)
              : {};
            if (progress.record(event.toolName, args, rawResult, isError)) {
              if (currentTurnAssistantMsg?.tool_calls) {
                const idx = currentTurnAssistantMsg.tool_calls.findIndex((tc) => tc.id === event.toolCallId);
                if (idx >= 0) currentTurnAssistantMsg.tool_calls = currentTurnAssistantMsg.tool_calls.slice(0, idx + 1);
              }
              const cp = progress.checkpoint(currentTurn);
              if (cp) emitEvent({ type: "progress_checkpoint", ...cp });
              turnStalledError = new AgentRequestError("The agent stopped after repeating a tool cycle without progress.", "stalled");
            }
          }
        }
      });

      if (canContinue && lastPi.role === "user") {
        await piAgent.prompt(lastPi);
      } else if (canContinue && lastPi.role === "toolResult") {
        piAgent.state.messages = piHistory;
        await piAgent.continue();
      } else {
        await piAgent.prompt("Continue the task.");
      }

      if (deadlineReached) {
        throw new Error("The side chat request timed out. Please try again.");
      }
      if (this._isCancelled || runSignal.aborted) {
        throw new Error("User cancelled agent execution.");
      }
      if (terminalException) {
        throw terminalException;
      }

      emitContext();
      outcome = "completed";
      emitEvent({
        type: "done",
        fullContent: finalAssistantText,
        messages: conversationHistory,
      });
      emitEvent({ type: "status", status: "done" });
      return conversationHistory;
    } catch (err: any) {
      if (deadlineReached) {
        const error = new Error("The side chat request timed out. Please try again.");
        activeRequest?.finish("failed");
        terminalError = error.message;
        errorCategory = "transport";
        emitEvent({ type: "error", error: error.message, category: errorCategory });
        emitEvent({ type: "status", status: "error", message: error.message });
        if (!options.returnPartialOnFailure) throw error;
        return conversationHistory;
      }
      const isAborted = this._isCancelled || runSignal.aborted;
      errorCategory = isAborted
        ? "cancelled"
        : err instanceof AgentRequestError
          ? err.category
          : isContextWindowError(err?.message ?? "")
            ? "context"
            : "transport";
      terminalError = isAborted ? "User cancelled agent execution." : err?.message || String(err);
      if (err instanceof AgentRequestError && err.diagnostics) {
        emitEvent({ type: "request_prepared", ...err.diagnostics, errorCategory });
      }
      activeRequest?.updateDiagnostics({ errorCategory });
      activeRequest?.finish(isAborted ? "cancelled" : "failed");
      if (isAborted) {
        outcome = "cancelled";
        this._isCancelled = true;
        // OMP-aligned: interrupting an active goal pauses it so the user can `/goal resume`
        if (!isCompanion && activeGoal && (activeGoal.status === "active" || activeGoal.status === "budget-limited")) {
          activeGoal = { ...activeGoal, status: "paused", updatedAt: Date.now() };
          emitEvent({ type: "goal_update", goal: activeGoal });
        }
        emitEvent({ type: "error", error: "User cancelled agent execution.", category: errorCategory });
        emitEvent({ type: "status", status: "idle", message: "User cancelled agent execution." });
      } else {
        emitEvent({ type: "error", error: terminalError ?? "Agent execution failed.", category: errorCategory });
        emitEvent({ type: "status", status: "error", message: terminalError ?? "Agent execution failed." });
        if (!options.returnPartialOnFailure) throw err;
      }
      return conversationHistory;
    } finally {
      if (deadline) clearTimeout(deadline);
      this.isRunning = false;
      this.activePiAgent = null;
      this.abortController = null;
      this.authorization.denyPending("Agent execution ended.");
      this.steeringQueue = [];
      emitEvent({
        type: "run_end",
        runId,
        outcome,
        error: terminalError,
        errorCategory,
        recovery: lastRecovery,
        ...(outcome === "cancelled" ? { cancelSource: this.cancelSource } : {}),
      });
    }
  }
}

export function createPiHarnessAgent(config: AgentConfig): PiHarnessAgent {
  return new PiHarnessAgent(config);
}

// Route all spawned `task` subagents through Pi Core as well for a single unified engine.
registerSubAgentRuntimeFactory(createPiHarnessAgent);
