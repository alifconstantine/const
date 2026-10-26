import { estimateMessage } from "@const/agent/token-meter";
import type { ModelRequestUsage } from "@const/agent/types";

export interface ContextSnapshot {
  usedTokens: number;
  totalTokens: number;
  systemPromptTokens?: number;
  toolsTokens?: number;
  messagesTokens?: number;
  model?: string;
  updatedAt?: number;
}

export type ModelRequest = ModelRequestUsage;

export interface ChatTelemetry {
  version: 1;
  historyIncomplete?: boolean;
  requests: Record<string, ModelRequest>;
  tools?: Record<string, { durationMs?: number; waitingMs?: number }>;
  context?: ContextSnapshot;
}

export const emptyTelemetry = (): ChatTelemetry => ({ version: 1, requests: {} });
export const telemetryForHistory = (messages: readonly any[]): ChatTelemetry => ({
  ...emptyTelemetry(),
  historyIncomplete: messages.some(m => m.role === "assistant" &&
    ((typeof m.content === "string" && m.content.length > 0) || m.toolCalls?.length || m.tool_calls?.length)),
});
const count = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
export const isTelemetryEvent = (event: any): boolean =>
  ["context_update", "usage", "llm_request", "tool_call", "tool_result"].includes(event.type) || Boolean(event.agent?.requests);

/** Immutable, conversation-local reduction. Usage frames are snapshots, not deltas. */
export function reduceTelemetry(previous: ChatTelemetry | undefined, event: any): ChatTelemetry {
  const state = previous ?? emptyTelemetry();
  if (["tool_call", "tool_result"].includes(event.type) && event.toolCallId) {
    const tool = { ...state.tools?.[event.toolCallId] };
    if (event.durationMs !== undefined) tool.durationMs = count(event.durationMs);
    if (event.waitingMs !== undefined) tool.waitingMs = count(event.waitingMs);
    return { ...state, tools: { ...state.tools, [event.toolCallId]: tool } };
  }
  if (event.agent?.requests) {
    const requests = { ...state.requests };
    for (const request of Object.values(event.agent.requests) as ModelRequest[]) {
      requests[request.requestId] = { ...requests[request.requestId], ...request, scope: "subagent" };
    }
    return { ...state, requests };
  }
  if (event.type === "context_update") {
    return { ...state, context: {
      usedTokens: count(event.usedTokens), totalTokens: count(event.totalTokens),
      systemPromptTokens: count(event.systemPromptTokens), toolsTokens: count(event.toolsTokens),
      messagesTokens: count(event.messagesTokens), model: event.model,
      updatedAt: event.updatedAt,
    } };
  }
  if (!event.requestId || !["usage", "llm_request"].includes(event.type)) return state;
  const old = state.requests[event.requestId];
  const request: ModelRequest = {
    ...old, requestId: event.requestId,
    model: event.model ?? old?.model ?? "",
    startedAt: event.startedAt ?? old?.startedAt ?? 0,
  };
  for (const key of ["durationMs", "ttftMs"] as const) {
    if (event[key] !== undefined) request[key] = count(event[key]);
  }
  if (event.status) request.status = event.status;
  if (event.type === "usage") {
    for (const key of ["promptTokens", "completionTokens", "totalTokens", "cacheReadTokens", "cacheWriteTokens", "reasoningTokens"] as const) {
      request[key] = count(event[key]);
    }
  }
  return { ...state, requests: { ...state.requests, [request.requestId]: request } };
}

/** Late renderer saves must not erase requests already committed by main. */
export function mergeTelemetry(stored?: ChatTelemetry, incoming?: ChatTelemetry): ChatTelemetry | undefined {
  if (!stored) return incoming;
  if (!incoming) return stored;
  const requests = { ...stored.requests };
  for (const [id, request] of Object.entries(incoming.requests)) {
    const existing = requests[id];
    requests[id] = { ...existing, ...request,
      // A stale "started" record has no terminal status/usage/timing to replace.
      ...(existing?.status && !request.status ? { status: existing.status } : {}),
    };
  }
  const context = (stored.context?.updatedAt ?? 0) > (incoming.context?.updatedAt ?? 0)
    ? stored.context : incoming.context ?? stored.context;
  const tools = { ...stored.tools };
  for (const [id, tool] of Object.entries(incoming.tools ?? {})) tools[id] = { ...tools[id], ...tool };
  return { version: 1, requests, context, tools, historyIncomplete: stored.historyIncomplete || incoming.historyIncomplete };
}

export function summarizeTelemetry(telemetry?: ChatTelemetry) {
  const requests = Object.values(telemetry?.requests ?? {});
  const billed = requests.filter(r => r.totalTokens !== undefined);
  const main = requests.filter(r => !r.scope);
  const timed = main.filter(r => r.durationMs !== undefined);
  const firstTokens = main.filter(r => r.ttftMs !== undefined);
  const generated = main.filter(r => r.completionTokens !== undefined && r.durationMs !== undefined);
  const sum = (rows: ModelRequest[], key: keyof ModelRequest) => rows.reduce((n, r) => n + Number(r[key] ?? 0), 0);
  const inputTokens = sum(billed, "promptTokens");
  const cachedInputTokens = sum(billed, "cacheReadTokens");
  const cacheWriteTokens = sum(billed, "cacheWriteTokens");
  const generationMs = sum(generated, "durationMs");
  const tools = Object.values(telemetry?.tools ?? {});
  return {
    modelRequests: main.length,
    toolCalls: tools.length,
    toolDurationMs: tools.some(t => t.durationMs !== undefined) ? tools.reduce((n, t) => n + (t.durationMs ?? 0), 0) : undefined,
    waitingDurationMs: tools.some(t => t.waitingMs !== undefined) ? tools.reduce((n, t) => n + (t.waitingMs ?? 0), 0) : undefined,
    hasUsage: billed.length > 0,
    incompleteUsage: Boolean(telemetry?.historyIncomplete) || billed.length < requests.length,
    inputTokens, outputTokens: sum(billed, "completionTokens"), totalTokens: sum(billed, "totalTokens"),
    cachedInputTokens, cacheWriteTokens,
    uncachedInputTokens: Math.max(0, inputTokens - cachedInputTokens - cacheWriteTokens),
    reasoningTokens: sum(billed, "reasoningTokens"),
    cacheHitRate: billed.length ? (inputTokens > 0 ? cachedInputTokens / inputTokens * 100 : 0) : undefined,
    llmDurationMs: timed.length ? sum(timed, "durationMs") : undefined,
    ttftSeconds: firstTokens.length ? sum(firstTokens, "ttftMs") / firstTokens.length / 1000 : undefined,
    tokPerSec: generationMs > 0 ? sum(generated, "completionTokens") / (generationMs / 1000) : undefined,
  };
}

/** Offline/legacy projection only: serialize tool results exactly once. The
 * authoritative compacted snapshot replaces this as soon as the agent runs. */
export function estimateVisibleContext(messages: readonly any[]): number {
  let tokens = 0;
  for (const message of messages) {
    tokens += estimateMessage({ ...message, tool_calls: (message.toolCalls ?? []).map((tool: any) => ({
      function: { name: tool.name, arguments: tool.args },
    })) });
    const tools = message.toolCalls ?? message.traceSteps?.filter((step: any) => step.type === "tool") ?? [];
    for (const tool of tools) {
      if (tool.result !== undefined) tokens += estimateMessage({ role: "tool", content: tool.result });
    }
  }
  return tokens;
}
