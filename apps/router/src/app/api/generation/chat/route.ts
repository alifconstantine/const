import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
import { hasFixedThinking, isBuiltinModel, normalizeConstModelName } from "@/lib/model-specs";
import {
  generateRequestId,
  estimateMessagesTokens,
  createTelemetryStream,
  recordDirectTelemetry,
  type TelemetryMetadata,
} from "@/lib/telemetry";
import { executeComboChat } from "@/lib/combo-executor";
import {
  convertGoogleSseToOpenAiSse,
  convertAnthropicSseToOpenAiSse,
} from "@/lib/sse-converters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

interface IncomingMessage {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: IncomingAttachment[];
}

interface ChatRequestBody {
  messages: IncomingMessage[];
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  thinkingLevel?: "low" | "medium" | "high";
  webSearch?: "off" | "auto";
  apiKey?: string;
  providerId?: string;
  providerDocId?: string;
}

function wrapWithTelemetry(
  response: Response,
  meta: TelemetryMetadata
): Response {
  if (!response.body) return response;
  const { stream } = createTelemetryStream(response.body, meta);
  return new Response(stream, {
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      "X-Const-Request-Id": meta.requestId,
    },
    status: response.status,
  });
}

export async function POST(req: NextRequest) {
  const reqStartTime = performance.now();
  const requestId = generateRequestId();
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    process.env.CONVEX_URL ||
    "https://earnest-hawk-132.convex.cloud";

  try {
    const body: ChatRequestBody = await req.json();
    const {
      messages = [],
      model,
      systemInstruction = "",
      temperature = 0.7,
      thinkingLevel = "medium",
      webSearch = "off",
      apiKey: customKey,
      providerId = "const",
      providerDocId,
    } = body;

    if (!model || typeof model !== "string" || !model.trim()) {
      return NextResponse.json(
        { error: { message: "The 'model' field is required." } },
        { status: 400 }
      );
    }

    // Extract authentication tokens safely
    const cookieToken = req.cookies.get("const_sso_token")?.value;
    const customHeaderToken = req.headers.get("x-const-sso-token")?.trim();
    const authHeader = req.headers.get("authorization")?.trim();
    const bearerValue = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

    // A JWT token typically starts with eyJ and contains dots
    const isJwt = (t?: string | null): t is string =>
      Boolean(t && t.startsWith("eyJ") && t.includes("."));

    let ssoToken: string | null = null;
    if (isJwt(customHeaderToken)) {
      ssoToken = customHeaderToken;
    } else if (isJwt(cookieToken)) {
      ssoToken = cookieToken;
    } else if (isJwt(bearerValue)) {
      ssoToken = bearerValue;
    }

    // Determine the raw API key provided (sk-const-live-..., AIzaSy..., or custom key)
    let providedKey = customKey?.trim() || "";
    if (!providedKey && bearerValue && !isJwt(bearerValue)) {
      providedKey = bearerValue;
    }

    const DEFAULT_PLAYGROUND_SYSTEM_INSTRUCTION =
      "You are Const Assistant, an intelligent and helpful AI assistant powered by Const.\n" +
      "- You communicate directly with the user in this conversational web interface.\n" +
      "- In this web environment, you operate purely in chat mode; you do not possess direct terminal execution, shell access, or local file reading/writing tools.\n" +
      "- When asked to provide code, commands, or file edits, provide complete explanations and instructions directly within clear markdown code blocks.";

    const effectiveSystemInstruction = systemInstruction.trim() || DEFAULT_PLAYGROUND_SYSTEM_INSTRUCTION;

    // Prepare OpenAI-format messages
    const formattedMessages: Array<{ role: string; content: unknown }> = [];
    if (effectiveSystemInstruction) {
      formattedMessages.push({ role: "system", content: effectiveSystemInstruction });
    }
    for (const msg of messages) {
      const hasMedia = Boolean(msg.attachments && msg.attachments.length > 0);
      if (!hasMedia) {
        formattedMessages.push({ role: msg.role, content: msg.content });
      } else {
        const parts: Array<Record<string, unknown>> = [];
        if (msg.content) {
          parts.push({ type: "text", text: msg.content });
        }
        for (const att of msg.attachments || []) {
          if (att.dataUrl && (att.type.startsWith("image/") || att.dataUrl.startsWith("data:image/"))) {
            parts.push({
              type: "image_url",
              image_url: { url: att.dataUrl },
            });
          } else if (att.dataUrl?.startsWith("data:text/") || att.dataUrl?.startsWith("data:application/json")) {
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

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;
    const estimatedPromptTokens = estimateMessagesTokens(formattedMessages);

    const telemetryMeta: TelemetryMetadata = {
      requestId,
      model,
      provider: "Google AI",
      rawApiKey: providedKey || undefined,
      keyName: "Playground",
      estimatedPromptTokens,
      ip,
      userAgent,
      convexUrl,
      ssoToken,
    };

    if (formattedMessages.length === 0) {
      return NextResponse.json(
        { error: { message: "No prompt messages provided." } },
        { status: 400 }
      );
    }

    // ========================================================
    // CASE 0: Virtual Combo Request (combo/* or auto/fast/coding)
    // ========================================================
    const isCombo =
      providerId === "combo" ||
      model.startsWith("combo/") ||
      ["auto", "fast", "coding"].includes(model);

    if (isCombo) {
      const comboSlug = model.replace(/^combo\//, "");
      telemetryMeta.model = model.startsWith("combo/") ? model : `combo/${model}`;
      telemetryMeta.provider = "Virtual Combo";

      const comboResponse = await executeComboChat({
        comboSlug,
        messages,
        systemInstruction: effectiveSystemInstruction,
        temperature,
        thinkingLevel: thinkingLevel === "low" || thinkingLevel === "high" ? thinkingLevel : "medium",
        apiKey: providedKey,
        ssoToken,
        convexUrl,
        requestId,
        ip,
        userAgent,
        signal: req.signal,
      });

      return wrapWithTelemetry(comboResponse, telemetryMeta);
    }

    // ========================================================
    // CASE A: Const (Built-in Managed Gemini 3.7 / 3.8 Flash)
    // ========================================================
    const isConstBuiltin =
      (providerId === "const" || isBuiltinModel(model)) && !providerDocId;

    if (isConstBuiltin) {
      // Enforce 7M Weekly Free Token Quota for Const-managed engine
      if (convexUrl && (providedKey || ssoToken)) {
        try {
          const client = new ConvexHttpClient(convexUrl);
          if (ssoToken) client.setAuth(ssoToken);
          const quotaCheck = await client.query(api.router.quotas.checkGatewayQuota, {
            rawApiKey: providedKey || undefined,
            ssoToken: ssoToken || undefined,
            provider: "const",
          });

          if (quotaCheck && !quotaCheck.allowed && quotaCheck.reason === "weekly_quota_exceeded") {
            return NextResponse.json(
              {
                error: {
                  message: `Const weekly free token quota exceeded (7,000,000 tokens/week). Resets in ${quotaCheck.resetsInText || "this week"}. Configure your own provider key (BYOK) in Providers for unlimited access.`,
                  type: "quota_exceeded",
                  code: "weekly_quota_exceeded",
                },
              },
              { status: 429 }
            );
          }
        } catch (quotaErr) {
          console.warn("Non-fatal quota check error in playground:", quotaErr);
        }
      }

      const constBaseUrl = (process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id").replace(/\/+$/, "");
      const constEngineKey = process.env.CONST_ENGINE_API_KEY?.trim() || "";

      let targetModel = normalizeConstModelName(model);
      if (targetModel === "Const Search" || model === "const-search") {
        targetModel = "Gemini 3.8 Flash";
      }

      // If webSearch === "auto" or model is const-search, perform search grounding via OmniRoute
      if (webSearch === "auto" || model === "const-search" || model === "Const Search") {
        const lastUser = [...formattedMessages].reverse().find((m: any) => m.role === "user");
        const queryText = typeof lastUser?.content === "string" ? lastUser.content : "";
        if (queryText.trim()) {
          try {
            const searchController = new AbortController();
            const searchTimeout = setTimeout(() => searchController.abort(), 8000);
            const searchHeaders: Record<string, string> = { "Content-Type": "application/json" };
            if (constEngineKey) searchHeaders["Authorization"] = `Bearer ${constEngineKey}`;

            const searchRes = await fetch(`${constBaseUrl}/v1/search`, {
              method: "POST",
              headers: searchHeaders,
              body: JSON.stringify({ query: queryText }),
              signal: searchController.signal,
            }).finally(() => clearTimeout(searchTimeout));

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (Array.isArray(searchData?.results) && searchData.results.length > 0) {
                const searchSnippet = searchData.results.slice(0, 5).map((r: any, idx: number) =>
                  `[Source ${idx + 1}]: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet || r.content || ""}`
                ).join("\n\n");

                formattedMessages.splice(formattedMessages.length - 1, 0, {
                  role: "system",
                  content: `[Real-Time Web Search Grounding Context from Const Search]\n${searchSnippet}\n\nPlease ground your response with facts from these live web search results whenever relevant, and cite source titles or URLs.`,
                });
              }
            }
          } catch (searchErr) {
            console.warn("Non-fatal web search grounding error:", searchErr);
          }
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (constEngineKey) {
        headers["Authorization"] = `Bearer ${constEngineKey}`;
      } else if (providedKey && !providedKey.includes("...")) {
        headers["Authorization"] = `Bearer ${providedKey}`;
      }

      const constPayload: Record<string, unknown> = {
        model: targetModel,
        messages: formattedMessages,
        temperature,
        stream: true,
      };
      if (thinkingLevel) {
        constPayload.reasoning = thinkingLevel;
        constPayload.reasoning_effort = thinkingLevel;
      }

      const response = await fetch(`${constBaseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(constPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Const error (HTTP ${response.status}): ${response.statusText}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) errMsg = parsed.error.message;
        } catch {}
        return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
      }

      if (!response.body) {
        return NextResponse.json(
          { error: { message: "No response body from Const." } },
          { status: 502 }
        );
      }

      return wrapWithTelemetry(
        new Response(response.body, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        }),
        telemetryMeta
      );
    }

    // ========================================================
    // CASE B: User BYOK Provider (OpenRouter, DeepSeek, Groq, Anthropic, etc.)
    // ========================================================
    if (providerDocId || (!isConstBuiltin && !providedKey.startsWith("AIzaSy"))) {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!convexUrl) {
        return NextResponse.json(
          { error: { message: "Convex backend not configured." } },
          { status: 500 }
        );
      }

      const client = new ConvexHttpClient(convexUrl);
      if (ssoToken) {
        client.setAuth(ssoToken);
      }

      try {
        const creds = await client.query(api.router.providers.getProviderCredentials, {
          providerDocId: providerDocId ? (providerDocId as Id<"userProviders">) : undefined,
          modelId: model,
          rawApiKey: providedKey || undefined,
        });

        if (creds) {
          const activeKey = creds.apiKey || "";
          const activeBaseUrl = (creds.baseUrl || "https://api.openai.com").replace(/\/+$/, "");

          // 1. Google AI Studio BYOK
          if (creds.protocol === "google-ai" || creds.providerId === "google") {
            const cleanModelId = model.replace(/^models\//, "");
            const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelId}:streamGenerateContent?alt=sse&key=${activeKey}`;

            const contents = messages
              .filter((m) => m.role !== "system")
              .map((m) => {
                const parts: Array<Record<string, unknown>> = [];
                if (m.content) {
                  parts.push({ text: m.content });
                }
                if (m.attachments && m.attachments.length > 0) {
                  for (const att of m.attachments) {
                    if (att.dataUrl?.startsWith("data:")) {
                      const match = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                      if (match && match[1] && match[2]) {
                        parts.push({
                          inlineData: {
                            mimeType: match[1],
                            data: match[2],
                          },
                        });
                      }
                    }
                  }
                }
                return {
                  role: m.role === "assistant" ? "model" : "user",
                  parts,
                };
              });

            const geminiPayload: Record<string, unknown> = {
              contents,
              generationConfig: { temperature },
            };
            if (systemInstruction.trim()) {
              geminiPayload.systemInstruction = { parts: [{ text: systemInstruction.trim() }] };
            }

            const response = await fetch(googleUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(geminiPayload),
            });

            if (!response.ok) {
              const errText = await response.text();
              let errMsg = `Google AI error (${response.status})`;
              try {
                const p = JSON.parse(errText);
                if (p?.error?.message) errMsg = p.error.message;
              } catch {}
              return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
            }

            if (!response.body) {
              return NextResponse.json({ error: { message: "No stream body from Google AI." } }, { status: 502 });
            }

            telemetryMeta.provider = "Google AI (BYOK)";
            return wrapWithTelemetry(convertGoogleSseToOpenAiSse(response.body), telemetryMeta);
          }

          // 2. Anthropic BYOK
          if (creds.protocol === "anthropic" || creds.providerId === "anthropic") {
            const anthropicMessages = messages
              .filter((m) => m.role !== "system")
              .map((m) => {
                const contentBlocks: Array<Record<string, unknown>> = [];
                if (m.attachments && m.attachments.length > 0) {
                  for (const att of m.attachments) {
                    if (att.dataUrl?.startsWith("data:")) {
                      const match = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                      if (match && match[1] && match[2]) {
                        const mimeType = match[1];
                        const base64Data = match[2];
                        if (mimeType.startsWith("image/")) {
                          contentBlocks.push({
                            type: "image",
                            source: {
                              type: "base64",
                              media_type: mimeType,
                              data: base64Data,
                            },
                          });
                        } else if (mimeType === "application/pdf") {
                          contentBlocks.push({
                            type: "document",
                            source: {
                              type: "base64",
                              media_type: "application/pdf",
                              data: base64Data,
                            },
                          });
                        }
                      }
                    }
                  }
                }
                if (m.content) {
                  contentBlocks.push({ type: "text", text: m.content });
                }
                return {
                  role: m.role,
                  content:
                    contentBlocks.length === 1 && contentBlocks[0]?.type === "text"
                      ? (contentBlocks[0].text as string)
                      : contentBlocks,
                };
              });

            const anthropicPayload: Record<string, unknown> = {
              model,
              messages: anthropicMessages,
              max_tokens: 4096,
              temperature: Math.min(1.0, Math.max(0.0, temperature)),
              stream: true,
            };
            if (effectiveSystemInstruction) {
              anthropicPayload.system = effectiveSystemInstruction;
            }

            if (thinkingLevel && !hasFixedThinking(model)) {
              const budgetTokens = thinkingLevel === "low" ? 1024 : thinkingLevel === "high" ? 4096 : 2048;
              anthropicPayload.thinking = { type: "enabled", budget_tokens: budgetTokens };
              anthropicPayload.max_tokens = Math.max(4096, budgetTokens + 2048);
              anthropicPayload.temperature = 1.0;
            }

            const response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": activeKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify(anthropicPayload),
            });

            if (!response.ok) {
              const errText = await response.text();
              let errMsg = `Anthropic error (${response.status})`;
              try {
                const p = JSON.parse(errText);
                if (p?.error?.message) errMsg = p.error.message;
              } catch {}
              return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
            }

            if (!response.body) {
              return NextResponse.json({ error: { message: "No stream body from Anthropic." } }, { status: 502 });
            }

            telemetryMeta.provider = "Anthropic (BYOK)";
            return wrapWithTelemetry(convertAnthropicSseToOpenAiSse(response.body), telemetryMeta);
          }

          // 3. OpenAI & OpenAI-Compatible (OpenRouter, DeepSeek, Groq, Custom)
          let endpoint = activeBaseUrl;
          if (endpoint.endsWith("/chat/completions")) {
            // Already complete
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

          const isO1PreviewOrMini =
            model.toLowerCase().includes("o1-preview") ||
            model.toLowerCase().includes("o1-mini");

          const requestPayload: Record<string, unknown> = {
            model,
            messages: formattedMessages,
            stream: true,
          };

          // Only send temperature if model supports it (o1-preview/mini reject temperature)
          if (!isO1PreviewOrMini) {
            requestPayload.temperature = temperature;
          }

          if (thinkingLevel && !hasFixedThinking(model)) {
            requestPayload.reasoning_effort = thinkingLevel;
            requestPayload.reasoning = { effort: thinkingLevel };
          }

          const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(requestPayload),
          });

          if (!response.ok) {
            const errText = await response.text();
            let errMsg = `Provider error (${response.status}): ${response.statusText}`;
            try {
              const p = JSON.parse(errText);
              if (p?.error?.message) errMsg = p.error.message;
              else if (typeof p?.error === "string") errMsg = p.error;
              else if (p?.message) errMsg = p.message;
            } catch {}
            return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
          }

          if (!response.body) {
            return NextResponse.json({ error: { message: "No response stream from provider." } }, { status: 502 });
          }

          telemetryMeta.provider = creds.name || creds.providerId;
          return wrapWithTelemetry(
            new Response(response.body, {
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
              },
            }),
            telemetryMeta
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load provider credentials.";
        return NextResponse.json({ error: { message: msg } }, { status: 403 });
      }
    }

    // ========================================================
    // CASE C: Direct Google AI Studio API Key (Starts with AIzaSy)
    // ========================================================
    if (providedKey.startsWith("AIzaSy")) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${providedKey}`;
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          const parts: Array<Record<string, unknown>> = [];
          if (m.content) {
            parts.push({ text: m.content });
          }
          if (m.attachments && m.attachments.length > 0) {
            for (const att of m.attachments) {
              if (att.dataUrl?.startsWith("data:")) {
                const match = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (match && match[1] && match[2]) {
                  parts.push({
                    inlineData: {
                      mimeType: match[1],
                      data: match[2],
                    },
                  });
                }
              }
            }
          }
          return {
            role: m.role === "assistant" ? "model" : "user",
            parts,
          };
        });

      const geminiPayload: Record<string, unknown> = {
        contents,
        generationConfig: { temperature },
      };
      if (effectiveSystemInstruction) {
        geminiPayload.systemInstruction = { parts: [{ text: effectiveSystemInstruction }] };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Google AI error (${response.status})`;
        try {
          const p = JSON.parse(errText);
          if (p?.error?.message) errMsg = p.error.message;
        } catch {}
        return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
      }

      if (!response.body) {
        return NextResponse.json({ error: { message: "No stream body from Google AI." } }, { status: 502 });
      }

      telemetryMeta.provider = "Google AI (Direct Key)";
      return wrapWithTelemetry(convertGoogleSseToOpenAiSse(response.body), telemetryMeta);
    }

    return NextResponse.json(
      { error: { message: "Unsupported configuration or invalid API Key." } },
      { status: 400 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: { message: errorMsg } }, { status: 500 });
  }
}

