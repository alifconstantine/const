import type { ModelRequest } from "./chat-telemetry";

export interface LocalRequestLog {
  id: string;
  requestId: string;
  model: string;
  provider?: string;
  conversationId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  status: number;
  toolNames?: string[];
  createdAt: number;
}

/** Same provider usage projection for native IndexedDB and the remote host API. */
export function modelRequestToLog(conversationId: string, request: ModelRequest): LocalRequestLog | undefined {
  if (request.totalTokens === undefined || !Number.isFinite(request.totalTokens)) return;
  const id = `llm_${conversationId}_${request.requestId}`;
  return {
    id, requestId: id, model: request.model, conversationId,
    promptTokens: request.promptTokens ?? 0, completionTokens: request.completionTokens ?? 0,
    totalTokens: request.totalTokens, durationMs: request.durationMs ?? 0,
    status: request.status === "failed" ? 500 : request.status === "cancelled" ? 499 : 200,
    createdAt: request.startedAt,
  };
}
