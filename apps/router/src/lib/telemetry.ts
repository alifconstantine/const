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
 * Creates a pass-through ReadableStream that calculates TTFT, duration,
 * completion tokens, and generation speed without introducing latency.
 * Emits periodic SSE keep-alive heartbeats (: keep-alive\n\n) every 10s
 * to ensure intermediate proxies (Cloudflare, Nginx) never timeout during deep model reasoning.
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
  const textEncoder = new TextEncoder();

  // SSE comment keep-alive heartbeat (every 10 seconds) to prevent Cloudflare/Nginx/proxy idle timeouts
  const HEARTBEAT_INTERVAL_MS = 10000;
  const HEARTBEAT_CHUNK = textEncoder.encode(": keep-alive\n\n");

  const recordAsync = async (status: number, errorMsg?: string) => {
    try {
      const endTime = performance.now();
      const durationMs = Math.max(1, Math.round(endTime - startTime));
      const ttftMs = firstChunkTime ? Math.max(1, Math.round(firstChunkTime - startTime)) : durationMs;
      
      const completionTokens = extractedCompletionTokens > 0
        ? extractedCompletionTokens
        : estimateTokens(accumulatedOutputText);
      const rawPromptTokens = extractedPromptTokens > 0
        ? extractedPromptTokens
        : (meta.estimatedPromptTokens || 1);
      const cachedTokens = extractedCachedTokens > 0 ? extractedCachedTokens : 0;

      // Independent prompt tokens: cache is no longer counted as input tokens
      const promptTokens = Math.max(0, rawPromptTokens - cachedTokens);
      // Total tokens excludes cached tokens
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
        cachedTokens: 0,
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

  const reader = upstreamBody.getReader();
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let isClosed = false;

  const clearHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Send an immediate keepalive byte to establish real-time SSE stream without proxy buffering
      try {
        controller.enqueue(HEARTBEAT_CHUNK);
      } catch {}

      // Heartbeat interval to maintain active TCP / HTTP connection while upstream model is deliberating
      heartbeatTimer = setInterval(() => {
        if (isClosed) {
          clearHeartbeat();
          return;
        }
        try {
          controller.enqueue(HEARTBEAT_CHUNK);
        } catch {
          clearHeartbeat();
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          isClosed = true;
          clearHeartbeat();
          await recordAsync(200);
          controller.close();
          return;
        }

        if (value) {
          if (firstChunkTime === null) {
            firstChunkTime = performance.now();
          }
          controller.enqueue(value);

          // Parse chunk for text accumulation & usage payloads
          try {
            const text = textDecoder.decode(value, { stream: true });
            accumulatedOutputText += text;

            // Try extracting OpenAI / OpenRouter / Anthropic usage if present in chunk
            if (text.includes('"usage"')) {
              const lines = text.split("\n");
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
                  try {
                    const parsed = JSON.parse(trimmed.slice(6));
                    if (parsed.usage) {
                      if (typeof parsed.usage.prompt_tokens === "number") {
                        extractedPromptTokens = parsed.usage.prompt_tokens;
                      }
                      if (typeof parsed.usage.completion_tokens === "number") {
                        extractedCompletionTokens = parsed.usage.completion_tokens;
                      }
                      const cached =
                        parsed.usage.prompt_tokens_details?.cached_tokens ??
                        parsed.usage.cache_read_input_tokens ??
                        parsed.usage.cached_tokens ??
                        0;
                      if (typeof cached === "number") {
                        extractedCachedTokens = cached;
                      }
                    }
                  } catch {}
                }
              }
            }
          } catch {}
        }
      } catch (err: any) {
        isClosed = true;
        clearHeartbeat();
        await recordAsync(500, err?.message || String(err));
        controller.error(err);
      }
    },
    async cancel(reason) {
      isClosed = true;
      clearHeartbeat();
      await recordAsync(499, "Client disconnected / stream cancelled");
      try {
        await reader.cancel(reason);
      } catch {}
    },
  });

  return {
    stream,
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
    const rawPromptTokens = params.promptTokens ?? meta.estimatedPromptTokens ?? 1;
    const cachedTokens = params.cachedTokens || 0;
    // Independent prompt tokens: cache is no longer counted as input tokens
    const promptTokens = Math.max(0, rawPromptTokens - cachedTokens);
    const completionTokens = params.completionTokens ?? 0;
    // Total tokens excludes cached tokens
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
      cachedTokens: 0,
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
