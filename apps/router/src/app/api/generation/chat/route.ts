import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
import { hasFixedThinking } from "@/lib/model-specs";

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
  apiKey?: string;
  providerId?: string;
  providerDocId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequestBody = await req.json();
    const {
      messages = [],
      model = "gemini-3.6-flash",
      systemInstruction = "",
      temperature = 0.7,
      thinkingLevel = "medium",
      apiKey: customKey,
      providerId = "const",
      providerDocId,
    } = body;

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

    // Prepare OpenAI-format messages
    const formattedMessages: Array<{ role: string; content: unknown }> = [];
    if (systemInstruction.trim()) {
      formattedMessages.push({ role: "system", content: systemInstruction.trim() });
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

    if (formattedMessages.length === 0) {
      return NextResponse.json(
        { error: { message: "No prompt messages provided." } },
        { status: 400 }
      );
    }

    // ========================================================
    // CASE A: Const Engine (Built-in Managed Gemini 3.6 Flash)
    // ========================================================
    const isConstBuiltin =
      (providerId === "const" || model === "gemini-3.6-flash") && !providerDocId;

    if (isConstBuiltin) {
      const constBaseUrl = (process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id").replace(/\/+$/, "");
      const constEngineKey = process.env.CONST_ENGINE_API_KEY?.trim() || "";

      // Map thinking level for Gemini 3.6 / 3.8 Flash
      let targetModel = model;
      if (model.startsWith("gemini-3.")) {
        if (hasFixedThinking(model)) {
          targetModel = model.startsWith("antigravity/") ? model : `antigravity/${model}`;
        } else {
          const tier = thinkingLevel === "low" ? "low" : thinkingLevel === "high" ? "high" : "medium";
          targetModel = `antigravity/${model}-${tier}`;
        }
      } else {
        targetModel = model;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (constEngineKey) {
        headers["Authorization"] = `Bearer ${constEngineKey}`;
      } else if (providedKey && !providedKey.includes("...")) {
        headers["Authorization"] = `Bearer ${providedKey}`;
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
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Const Engine error (HTTP ${response.status}): ${response.statusText}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) errMsg = parsed.error.message;
        } catch {}
        return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
      }

      if (!response.body) {
        return NextResponse.json(
          { error: { message: "No response body from Const Engine." } },
          { status: 502 }
        );
      }

      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
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

            return convertGoogleSseToOpenAiSse(response.body);
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
            if (systemInstruction.trim()) {
              anthropicPayload.system = systemInstruction.trim();
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

            return convertAnthropicSseToOpenAiSse(response.body);
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
            headers["HTTP-Referer"] = "https://router.const.web.id";
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

          return new Response(response.body, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
            },
          });
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
      if (systemInstruction.trim()) {
        geminiPayload.systemInstruction = { parts: [{ text: systemInstruction.trim() }] };
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

      return convertGoogleSseToOpenAiSse(response.body);
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

/**
 * Transforms Google AI Studio SSE stream to standard OpenAI format
 */
function convertGoogleSseToOpenAiSse(body: ReadableStream<Uint8Array>): Response {
  const encoder = new TextEncoder();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.substring(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              const candidate = data.candidates?.[0];
              if (!candidate) continue;

              const parts = candidate.content?.parts || [];
              for (const part of parts) {
                if (part.text) {
                  const isThought = Boolean(part.thought);
                  const payload = JSON.stringify({
                    choices: [
                      {
                        delta: {
                          content: isThought ? undefined : part.text,
                          reasoning_content: isThought ? part.text : undefined,
                        },
                      },
                    ],
                  });
                  controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                }
              }
            } catch {}
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Transforms Anthropic Messages SSE stream to standard OpenAI format
 */
function convertAnthropicSseToOpenAiSse(body: ReadableStream<Uint8Array>): Response {
  const encoder = new TextEncoder();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.substring(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.type === "content_block_delta" && data.delta?.text) {
                const payload = JSON.stringify({
                  choices: [
                    {
                      delta: {
                        content: data.delta.text,
                      },
                    },
                  ],
                });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
              } else if (data.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {}
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
