import type { AgentEvent } from "./types.js";
import { parseProviderUsage, type NormalizedTokenUsage } from "./token-meter.js";

/** One request can contain several cumulative usage frames. Commit its last
 * snapshot once, including on failure/cancellation after partial generation. */
export function trackLlmRequest(
  requestId: string,
  model: string,
  emit: (event: AgentEvent) => void,
  now = Date.now,
) {
  const startedAt = now();
  let ttftMs: number | undefined;
  let usage: NormalizedTokenUsage | undefined;
  let finished = false;
  emit({ type: "llm_request", phase: "started", requestId, model, startedAt });
  return {
    observeUsage(raw: unknown) {
      usage = parseProviderUsage(raw) ?? usage;
    },
    observeDelta(delta: any) {
      if (ttftMs === undefined && (delta?.content || delta?.reasoning_content ||
          delta?.reasoning || delta?.thought || delta?.thinking || delta?.tool_calls?.length)) {
        ttftMs = Math.max(0, now() - startedAt);
      }
    },
    finish(status: "completed" | "failed" | "cancelled") {
      if (finished) return;
      finished = true;
      const durationMs = Math.max(0, now() - startedAt);
      if (usage) {
        const promptTokens = usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
        emit({
          type: "usage", requestId, model, startedAt, promptTokens,
          completionTokens: usage.outputTokens, totalTokens: usage.totalTokens,
          cacheReadTokens: usage.cacheReadTokens, cacheWriteTokens: usage.cacheWriteTokens,
          reasoningTokens: usage.reasoningTokens,
          cacheHitRate: promptTokens > 0 ? (usage.cacheReadTokens ?? 0) / promptTokens * 100 : 0,
          durationMs, ttftMs,
        });
      }
      emit({ type: "llm_request", phase: "finished", requestId, model, startedAt, durationMs, ttftMs, status });
    },
  };
}
