import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";

export interface TelemetryMetadata {
  requestId: string;
  model: string;
  provider: string;
  comboId?: string;
  comboName?: string;
  rawApiKey?: string;
  keyName?: string;
  keyPrefix?: string;
  promptText?: string;
  estimatedPromptTokens?: number;
  ip?: string;
  userAgent?: string;
  convexUrl: string;
  ssoToken?: string | null;
}

// Fast token estimator (approx 4 chars per token for typical multilingual/code text)
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

// Estimate tokens for messages array
export function estimateMessagesTokens(messages: Array<{ role?: string; content?: unknown }>): number {
  let totalChars = 0;
  for (const m of messages) {
    if (typeof m.content === "string") {
      totalChars += m.content.length;
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          totalChars += part.text.length;
        }
      }
    }
  }
  return Math.max(1, Math.ceil(totalChars / 4));
}

export function generateRequestId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `req_${hex}`;
}

/**
 * Creates a pass-through TransformStream that calculates TTFT, duration,
 * completion tokens, and generation speed without introducing latency.
 * When the stream completes, it records the telemetry to Convex.
 */
export function createTelemetryStream(
  upstreamBody: ReadableStream<Uint8Array>,
  meta: TelemetryMetadata
): { stream: ReadableStream<Uint8Array>; getMetrics: () => { ttftMs?: number; durationMs?: number } } {
  const startTime = performance.now();
  let firstChunkTime: number | null = null;
  let accumulatedOutputText = "";
  let extractedPromptTokens = meta.estimatedPromptTokens || 0;
  let extractedCompletionTokens = 0;
  let extractedCachedTokens = 0;
  const textDecoder = new TextDecoder();

  const recordAsync = async (status: number, errorMsg?: string) => {
    try {
      const endTime = performance.now();
      const durationMs = Math.max(1, Math.round(endTime - startTime));
      const ttftMs = firstChunkTime ? Math.max(1, Math.round(firstChunkTime - startTime)) : durationMs;
      
      const completionTokens = extractedCompletionTokens > 0
        ? extractedCompletionTokens
        : estimateTokens(accumulatedOutputText);
      const promptTokens = extractedPromptTokens > 0
        ? extractedPromptTokens
        : (meta.estimatedPromptTokens || 1);
      const totalTokens = promptTokens + completionTokens;

      const durationSec = durationMs / 1000;
      const speed = durationSec > 0 && completionTokens > 0
        ? parseFloat((completionTokens / durationSec).toFixed(1))
        : undefined;

      const resolvedConvexUrl =
        meta.convexUrl ||
        process.env.NEXT_PUBLIC_CONVEX_URL ||
        "https://earnest-hawk-132.convex.cloud";
      const client = new ConvexHttpClient(resolvedConvexUrl);
      if (meta.ssoToken) {
        client.setAuth(meta.ssoToken);
      }

      await client.mutation(api.router.logs.recordLog, {
        rawApiKey: meta.rawApiKey,
        ssoToken: meta.ssoToken || undefined,
        requestId: meta.requestId,
        keyName: meta.keyName,
        keyPrefix: meta.keyPrefix,
        model: meta.model,
        provider: meta.provider,
        comboId: meta.comboId,
        comboName: meta.comboName,
        status,
        errorMessage: errorMsg,
        promptTokens,
        cachedTokens: extractedCachedTokens,
        completionTokens,
        totalTokens,
        ttftMs,
        durationMs,
        tokensPerSecond: speed,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } catch (logErr) {
      console.warn("Failed to write telemetry log:", logErr);
    }
  };

  const transformStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (firstChunkTime === null) {
        firstChunkTime = performance.now();
      }

      // Pass chunk forward immediately to preserve high-speed streaming
      controller.enqueue(chunk);

      // Parse chunk for text accumulation & usage payloads
      try {
        const text = textDecoder.decode(chunk, { stream: true });
        accumulatedOutputText += text;

        // Try extracting OpenAI / OpenRouter usage if present in chunk
        if (text.includes('"usage"')) {
          const lines = text.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.usage) {
                  if (parsed.usage.prompt_tokens) extractedPromptTokens = parsed.usage.prompt_tokens;
                  if (parsed.usage.completion_tokens) extractedCompletionTokens = parsed.usage.completion_tokens;
                  if (parsed.usage.prompt_tokens_details?.cached_tokens) {
                    extractedCachedTokens = parsed.usage.prompt_tokens_details.cached_tokens;
                  }
                }
              } catch {}
            }
          }
        }
      } catch {}
    },
    async flush() {
      // Stream finished successfully - await telemetry before closing stream
      await recordAsync(200);
    },
  });

  const pipedStream = upstreamBody.pipeThrough(transformStream);

  return {
    stream: pipedStream,
    getMetrics: () => ({
      ttftMs: firstChunkTime ? Math.round(firstChunkTime - startTime) : undefined,
      durationMs: Math.round(performance.now() - startTime),
    }),
  };
}

/**
 * Direct log recorder for non-streaming calls or immediate error responses.
 */
export async function recordDirectTelemetry(
  meta: TelemetryMetadata,
  params: {
    status: number;
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
    cachedTokens?: number;
    ttftMs?: number;
    errorMessage?: string;
  }
) {
  try {
    const promptTokens = params.promptTokens ?? meta.estimatedPromptTokens ?? 1;
    const completionTokens = params.completionTokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const durationSec = params.durationMs / 1000;
    const speed = durationSec > 0 && completionTokens > 0
      ? parseFloat((completionTokens / durationSec).toFixed(1))
      : undefined;

    const resolvedConvexUrl =
      meta.convexUrl ||
      process.env.NEXT_PUBLIC_CONVEX_URL ||
      "https://earnest-hawk-132.convex.cloud";
    const client = new ConvexHttpClient(resolvedConvexUrl);
    if (meta.ssoToken) {
      client.setAuth(meta.ssoToken);
    }

    await client.mutation(api.router.logs.recordLog, {
      rawApiKey: meta.rawApiKey,
      ssoToken: meta.ssoToken || undefined,
      requestId: meta.requestId,
      keyName: meta.keyName,
      keyPrefix: meta.keyPrefix,
      model: meta.model,
      provider: meta.provider,
      comboId: meta.comboId,
      comboName: meta.comboName,
      status: params.status,
      errorMessage: params.errorMessage,
      promptTokens,
      cachedTokens: params.cachedTokens || 0,
      completionTokens,
      totalTokens,
      ttftMs: params.ttftMs,
      durationMs: Math.max(1, params.durationMs),
      tokensPerSecond: speed,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  } catch (err) {
    console.warn("Failed to write direct telemetry log:", err);
  }
}
