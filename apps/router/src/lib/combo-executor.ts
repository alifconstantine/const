import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import { hasFixedThinking } from "@/lib/model-specs";
import {
  convertGoogleSseToOpenAiSse,
  convertAnthropicSseToOpenAiSse,
} from "@/lib/sse-converters";
import { estimateMessagesTokens } from "@/lib/telemetry";

export interface ComboTargetModel {
  modelId: string;
  providerId: string;
  providerName: string;
  priority?: number;
}

export interface ExecuteComboChatOptions {
  comboSlug: string;
  messages: Array<{ role: string; content: unknown; attachments?: any[] }>;
  systemInstruction?: string;
  temperature?: number;
  thinkingLevel?: "off" | "low" | "medium" | "high";
  stream?: boolean;
  apiKey?: string;
  ssoToken?: string | null;
  convexUrl: string;
  requestId: string;
  ip?: string;
  userAgent?: string;
  signal?: AbortSignal;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) return parsed.error.message;
      if (typeof parsed?.error === "string") return parsed.error;
      if (parsed?.message) return parsed.message;
    } catch {
      if (text.trim()) return text.slice(0, 300);
    }
  } catch {}
  return `HTTP ${response.status} (${response.statusText || "Upstream Failure"})`;
}

/**
 * Executes a chat request through a Virtual Combo with sequential failover,
 * context length clamping, and system prompt injection matching OmniRoute.
 */
export async function executeComboChat(
  opts: ExecuteComboChatOptions
): Promise<Response> {
  const {
    comboSlug,
    messages,
    systemInstruction = "",
    temperature = 0.7,
    thinkingLevel = "medium",
    apiKey,
    ssoToken,
    convexUrl,
    requestId,
    signal,
  } = opts;

  const client = new ConvexHttpClient(convexUrl);
  if (ssoToken) {
    client.setAuth(ssoToken);
  }

  // 1. Fetch the Combo definition
  const combo = await client.query(api.router.combos.getCombo, {
    slug: comboSlug,
    rawApiKey: apiKey || undefined,
  });

  if (!combo) {
    return new Response(
      JSON.stringify({
        error: {
          message: `Combo '${comboSlug}' not found. Please verify the combo slug in /combos.`,
          code: "combo_not_found",
        },
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const configuredModels = (combo.models || []) as ComboTargetModel[];
  if (configuredModels.length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          message: `Combo '${combo.name}' has no available execution models configured.`,
          code: "combo_empty_models",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Resolve Strategy Order (Priority / Random / Round-Robin)
  let orderedTargets = [...configuredModels];
  if (combo.strategy === "random") {
    orderedTargets.sort(() => Math.random() - 0.5);
  } else {
    // Default "priority": priority 1 comes first, then 2, etc.
    orderedTargets.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  // 3. System Message Injection (OmniRoute Pattern)
  const combinedSystemPrompt = [
    combo.systemMessage?.trim(),
    systemInstruction.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  // 4. Context Window Clamping (OmniRoute Pattern)
  let processedMessages = [...messages];
  if (combo.contextLength && combo.contextLength > 0) {
    let currentTokens = estimateMessagesTokens(processedMessages);
    // If prompt exceeds combo context length, trim oldest middle turns while preserving context
    while (currentTokens > combo.contextLength && processedMessages.length > 2) {
      processedMessages.splice(1, 1);
      currentTokens = estimateMessagesTokens(processedMessages);
    }
  }

  // Format messages for OpenAI compatibility
  const formattedMessages: Array<{ role: string; content: unknown }> = [];
  if (combinedSystemPrompt) {
    formattedMessages.push({ role: "system", content: combinedSystemPrompt });
  }

  for (const msg of processedMessages) {
    const hasMedia = Boolean(msg.attachments && msg.attachments.length > 0);
    if (!hasMedia) {
      formattedMessages.push({ role: msg.role, content: msg.content });
    } else {
      const parts: Array<Record<string, unknown>> = [];
      if (msg.content) {
        parts.push({ type: "text", text: msg.content });
      }
      for (const att of msg.attachments || []) {
        if (
          att.dataUrl &&
          (att.type.startsWith("image/") || att.dataUrl.startsWith("data:image/"))
        ) {
          parts.push({
            type: "image_url",
            image_url: { url: att.dataUrl },
          });
        } else if (
          att.dataUrl?.startsWith("data:text/") ||
          att.dataUrl?.startsWith("data:application/json")
        ) {
          try {
            const match = att.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
            if (match && match[1]) {
              const decoded = Buffer.from(match[1], "base64").toString("utf-8");
              parts.push({
                type: "text",
                text: `\n[Attached File: ${att.name}]\n${decoded}\n`,
              });
            }
          } catch {
            parts.push({
              type: "text",
              text: `\n[Attached File: ${att.name}]\n`,
            });
          }
        } else {
          parts.push({
            type: "text",
            text: `\n[Attached File: ${att.name} (${att.type})]\n`,
          });
        }
      }
      formattedMessages.push({ role: msg.role, content: parts });
    }
  }

  // 5. Sequential Execution Loop with Failover
  let fallbackCount = 0;
  const targetErrors: Array<{
    model: string;
    provider: string;
    status: number;
    error: string;
  }> = [];

  for (let i = 0; i < orderedTargets.length; i++) {
    const target = orderedTargets[i]!;

    // Check if client aborted the connection
    if (signal?.aborted) {
      return new Response(
        JSON.stringify({ error: { message: "Client aborted request." } }),
        { status: 499, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const isConstEngine =
        target.providerId === "const" || target.modelId === "gemini-3.6-flash";

      if (isConstEngine) {
        // Dispatch to Const Managed Model
        const constBaseUrl = (
          process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id"
        ).replace(/\/+$/, "");
        const constEngineKey = process.env.CONST_ENGINE_API_KEY?.trim() || "";

        let targetModel = target.modelId;
        if (targetModel.startsWith("gemini-3.")) {
          if (hasFixedThinking(targetModel)) {
            targetModel = targetModel.startsWith("antigravity/")
              ? targetModel
              : `antigravity/${targetModel}`;
          } else {
            const tier =
              thinkingLevel === "low"
                ? "low"
                : thinkingLevel === "high"
                  ? "high"
                  : "medium";
            targetModel = `antigravity/${targetModel}-${tier}`;
          }
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (constEngineKey) {
          headers["Authorization"] = `Bearer ${constEngineKey}`;
        } else if (apiKey && !apiKey.includes("...")) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        const response = await fetch(`${constBaseUrl}/v1/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: targetModel,
            messages: formattedMessages,
            temperature,
            stream: true,
          }),
          signal,
        });

        if (response.ok && response.body) {
          // Success! Return stream with combo headers
          const responseHeaders = new Headers(response.headers);
          responseHeaders.set("Content-Type", "text/event-stream; charset=utf-8");
          responseHeaders.set("Cache-Control", "no-cache, no-transform");
          responseHeaders.set("Connection", "keep-alive");
          responseHeaders.set("X-Const-Combo-Name", combo.name);
          responseHeaders.set("X-Const-Combo-Slug", combo.slug);
          responseHeaders.set("X-Const-Combo-Selected-Model", target.modelId);
          responseHeaders.set("X-Const-Combo-Selected-Provider", "Const Gateway");
          responseHeaders.set("X-Const-Combo-Fallbacks", String(fallbackCount));
          responseHeaders.set("X-Const-Request-Id", requestId);

          return new Response(response.body, {
            status: 200,
            headers: responseHeaders,
          });
        }

        // Target failed
        const errMsg = await extractErrorMessage(response);
        if (response.status === 499) {
          return new Response(
            JSON.stringify({ error: { message: "Client disconnected." } }),
            { status: 499, headers: { "Content-Type": "application/json" } }
          );
        }

        fallbackCount++;
        targetErrors.push({
          model: target.modelId,
          provider: "Const Gateway",
          status: response.status,
          error: errMsg,
        });
        continue;
      }

      // Dispatch to BYOK Connected Provider
      let creds;
      try {
        creds = await client.query(api.router.providers.getProviderCredentials, {
          modelId: target.modelId,
          rawApiKey: apiKey || undefined,
        });
      } catch (err: any) {
        fallbackCount++;
        targetErrors.push({
          model: target.modelId,
          provider: target.providerName || target.providerId,
          status: 403,
          error: err?.message || "Failed to resolve provider credentials",
        });
        continue;
      }

      if (!creds || !creds.apiKey) {
        fallbackCount++;
        targetErrors.push({
          model: target.modelId,
          provider: target.providerName || target.providerId,
          status: 401,
          error: `Missing API credentials for provider '${target.providerName}'`,
        });
        continue;
      }

      const activeKey = creds.apiKey;
      const activeBaseUrl = (
        creds.baseUrl || "https://api.openai.com"
      ).replace(/\/+$/, "");

      // 5.1 Google AI Studio BYOK
      if (creds.protocol === "google-ai" || creds.providerId === "google") {
        const cleanModelId = target.modelId.replace(/^models\//, "");
        const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelId}:streamGenerateContent?alt=sse&key=${activeKey}`;

        const contents = processedMessages
          .filter((m) => m.role !== "system")
          .map((m) => {
            const parts: Array<Record<string, unknown>> = [];
            if (m.content) parts.push({ text: m.content });
            return {
              role: m.role === "assistant" ? "model" : "user",
              parts,
            };
          });

        const geminiPayload: Record<string, unknown> = {
          contents,
          generationConfig: { temperature },
        };
        if (combinedSystemPrompt) {
          geminiPayload.systemInstruction = {
            parts: [{ text: combinedSystemPrompt }],
          };
        }

        const response = await fetch(googleUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
          signal,
        });

        if (response.ok && response.body) {
          const sseResponse = convertGoogleSseToOpenAiSse(response.body);
          const responseHeaders = new Headers(sseResponse.headers);
          responseHeaders.set("X-Const-Combo-Name", combo.name);
          responseHeaders.set("X-Const-Combo-Slug", combo.slug);
          responseHeaders.set("X-Const-Combo-Selected-Model", target.modelId);
          responseHeaders.set("X-Const-Combo-Selected-Provider", creds.name || "Google AI");
          responseHeaders.set("X-Const-Combo-Fallbacks", String(fallbackCount));
          responseHeaders.set("X-Const-Request-Id", requestId);

          return new Response(sseResponse.body, {
            status: 200,
            headers: responseHeaders,
          });
        }

        const errMsg = await extractErrorMessage(response);
        fallbackCount++;
        targetErrors.push({
          model: target.modelId,
          provider: creds.name || "Google AI",
          status: response.status,
          error: errMsg,
        });
        continue;
      }

      // 5.2 Anthropic BYOK
      if (creds.protocol === "anthropic" || creds.providerId === "anthropic") {
        const anthropicMessages = processedMessages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          }));

        const anthropicPayload: Record<string, unknown> = {
          model: target.modelId,
          messages: anthropicMessages,
          max_tokens: 4096,
          temperature: Math.min(1.0, Math.max(0.0, temperature)),
          stream: true,
        };
        if (combinedSystemPrompt) {
          anthropicPayload.system = combinedSystemPrompt;
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": activeKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(anthropicPayload),
          signal,
        });

        if (response.ok && response.body) {
          const sseResponse = convertAnthropicSseToOpenAiSse(response.body);
          const responseHeaders = new Headers(sseResponse.headers);
          responseHeaders.set("X-Const-Combo-Name", combo.name);
          responseHeaders.set("X-Const-Combo-Slug", combo.slug);
          responseHeaders.set("X-Const-Combo-Selected-Model", target.modelId);
          responseHeaders.set("X-Const-Combo-Selected-Provider", creds.name || "Anthropic");
          responseHeaders.set("X-Const-Combo-Fallbacks", String(fallbackCount));
          responseHeaders.set("X-Const-Request-Id", requestId);

          return new Response(sseResponse.body, {
            status: 200,
            headers: responseHeaders,
          });
        }

        const errMsg = await extractErrorMessage(response);
        fallbackCount++;
        targetErrors.push({
          model: target.modelId,
          provider: creds.name || "Anthropic",
          status: response.status,
          error: errMsg,
        });
        continue;
      }

      // 5.3 OpenAI & OpenAI-Compatible (OpenRouter, DeepSeek, Groq, Custom)
      let endpoint = activeBaseUrl;
      if (endpoint.endsWith("/chat/completions")) {
        // Complete
      } else if (endpoint.endsWith("/v1")) {
        endpoint = `${endpoint}/chat/completions`;
      } else {
        endpoint = `${endpoint}/v1/chat/completions`;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (activeKey && activeKey !== "no-key-required") {
        headers["Authorization"] = `Bearer ${activeKey}`;
      }
      if (creds.providerId === "openrouter" || activeBaseUrl.includes("openrouter.ai")) {
        headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://router.const.web.id";
        headers["X-Title"] = "Const Router";
      }

      const requestPayload: Record<string, unknown> = {
        model: target.modelId,
        messages: formattedMessages,
        temperature,
        stream: true,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestPayload),
        signal,
      });

      if (response.ok && response.body) {
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Content-Type", "text/event-stream; charset=utf-8");
        responseHeaders.set("Cache-Control", "no-cache, no-transform");
        responseHeaders.set("Connection", "keep-alive");
        responseHeaders.set("X-Const-Combo-Name", combo.name);
        responseHeaders.set("X-Const-Combo-Slug", combo.slug);
        responseHeaders.set("X-Const-Combo-Selected-Model", target.modelId);
        responseHeaders.set("X-Const-Combo-Selected-Provider", creds.name || creds.providerId);
        responseHeaders.set("X-Const-Combo-Fallbacks", String(fallbackCount));
        responseHeaders.set("X-Const-Request-Id", requestId);

        return new Response(response.body, {
          status: 200,
          headers: responseHeaders,
        });
      }

      const errMsg = await extractErrorMessage(response);
      fallbackCount++;
      targetErrors.push({
        model: target.modelId,
        provider: creds.name || creds.providerId,
        status: response.status,
        error: errMsg,
      });
    } catch (err: any) {
      fallbackCount++;
      targetErrors.push({
        model: target.modelId,
        provider: target.providerName || target.providerId,
        status: 500,
        error: err?.message || "Execution exception",
      });
    }
  }

  // 6. Terminal Fallback Exhaustion (OmniRoute Diagnostic Aggregation)
  const lastError = targetErrors[targetErrors.length - 1]?.error || "Unknown error";
  return new Response(
    JSON.stringify({
      error: {
        message: `All ${orderedTargets.length} models in combo '${combo.name}' failed. Last failure: ${lastError}`,
        code: "combo_targets_exhausted",
        combo: combo.name,
        slug: combo.slug,
        attempts: targetErrors,
      },
    }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
}
