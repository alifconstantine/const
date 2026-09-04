import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
import {
  generateRequestId,
  estimateMessagesTokens,
  createTelemetryStream,
  recordDirectTelemetry,
  type TelemetryMetadata,
} from "@/lib/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OpenAIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenAIChatRequestBody {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  stream?: boolean;
  reasoning_effort?: "off" | "low" | "medium" | "high";
  providerDocId?: string;
}

export async function POST(req: NextRequest) {
  const reqStartTime = performance.now();
  const requestId = generateRequestId();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";

  try {
    const body: OpenAIChatRequestBody = await req.json();
    const {
      model,
      messages = [],
      temperature = 0.7,
      stream = false,
      reasoning_effort,
      providerDocId,
    } = body;

    if (!model) {
      return NextResponse.json(
        { error: { message: "The 'model' field is required." } },
        { status: 400 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: { message: "The 'messages' array must not be empty." } },
        { status: 400 }
      );
    }

    // Extract authentication tokens safely
    const cookieToken = req.cookies.get("const_sso_token")?.value;
    const customHeaderToken = req.headers.get("x-const-sso-token")?.trim();
    const authHeader = req.headers.get("authorization")?.trim();
    const bearerValue = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

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

    let providedKey = "";
    if (bearerValue && !isJwt(bearerValue)) {
      providedKey = bearerValue;
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;
    const estimatedPromptTokens = estimateMessagesTokens(messages);

    const telemetryMeta: TelemetryMetadata = {
      requestId,
      model,
      provider: "const",
      rawApiKey: providedKey || undefined,
      keyName: providedKey ? `Key (${providedKey.slice(0, 16)}...)` : (ssoToken ? "Session Auth" : undefined),
      estimatedPromptTokens,
      ip,
      userAgent,
      convexUrl,
      ssoToken,
    };

    // ========================================================
    // COMBO DETECTION & RESOLUTION
    // ========================================================
    const isCombo =
      model.startsWith("combo/") ||
      model === "auto" ||
      model === "fast" ||
      model === "coding";

    if (isCombo && convexUrl) {
      const comboSlug = model.replace(/^combo\//, "");
      const client = new ConvexHttpClient(convexUrl);
      if (ssoToken) {
        client.setAuth(ssoToken);
      }

      const combo = await client.query(api.router.combos.resolveComboForExecution, {
        slug: comboSlug,
      });

      if (combo && combo.models.length > 0) {
        telemetryMeta.comboId = combo.slug;
        telemetryMeta.comboName = `combo/${combo.slug}`;

        // Inject combo system message if provided and caller didn't supply one
        let effectiveMessages = [...messages];
        if (combo.systemMessage && !effectiveMessages.some((m) => m.role === "system")) {
          effectiveMessages.unshift({
            role: "system",
            content: combo.systemMessage,
          });
        }

        const sortedTargets = [...combo.models].sort((a, b) => a.priority - b.priority);

        let lastErrorResponse: Response | null = null;
        for (let i = 0; i < sortedTargets.length; i++) {
          const target = sortedTargets[i];
          if (!target) continue;

          // Clone telemetry metadata for this specific target attempt
          const targetTelemetryMeta: TelemetryMetadata = {
            ...telemetryMeta,
            model: target.modelId,
            provider: target.providerName,
          };

          try {
            const targetRes = await dispatchSingleModel({
              targetModel: target.modelId,
              providerDocId: target.providerId !== "const" && target.providerId.startsWith("k_") ? target.providerId : undefined,
              messages: effectiveMessages,
              temperature,
              stream,
              reasoning_effort,
              providedKey,
              ssoToken,
              convexUrl,
              telemetryMeta: targetTelemetryMeta,
              requestId,
              reqStartTime,
            });

            if (targetRes.ok) {
              return targetRes;
            }

            // Retry on Rate Limit (429) or Server Outage (5xx)
            if (targetRes.status === 429 || targetRes.status >= 500) {
              console.warn(
                `[Const Router Combo Fallback] Model '${target.modelId}' (${target.providerName}) returned HTTP ${targetRes.status}. Retrying next priority model...`
              );
              lastErrorResponse = targetRes;
              continue;
            }

            // If it's a client bad request (400), don't retry, return immediately
            return targetRes;
          } catch (targetErr) {
            console.error(`[Const Router Combo Error] Execution for ${target.modelId} threw:`, targetErr);
            continue;
          }
        }

        if (lastErrorResponse) {
          return lastErrorResponse;
        }

        return NextResponse.json(
          {
            error: {
              message: `All models in combo '${combo.name}' failed to respond.`,
              code: "combo_exhausted",
            },
          },
          { status: 502 }
        );
      }
    }

    // Standard non-combo model execution
    return await dispatchSingleModel({
      targetModel: model,
      providerDocId,
      messages,
      temperature,
      stream,
      reasoning_effort,
      providedKey,
      ssoToken,
      convexUrl,
      telemetryMeta,
      requestId,
      reqStartTime,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}

async function dispatchSingleModel({
  targetModel,
  providerDocId,
  messages,
  temperature,
  stream,
  reasoning_effort,
  providedKey,
  ssoToken,
  convexUrl,
  telemetryMeta,
  requestId,
  reqStartTime,
}: {
  targetModel: string;
  providerDocId?: string;
  messages: OpenAIMessage[];
  temperature: number;
  stream: boolean;
  reasoning_effort?: "off" | "low" | "medium" | "high";
  providedKey?: string;
  ssoToken?: string | null;
  convexUrl: string;
  telemetryMeta: TelemetryMetadata;
  requestId: string;
  reqStartTime: number;
}): Promise<Response> {
  // CASE A: Const Engine (Built-in Managed Gemini 3.6 Flash)
  const isConstBuiltin =
    (targetModel === "gemini-3.6-flash" || targetModel.startsWith("antigravity/")) &&
    !providerDocId;

  if (isConstBuiltin) {
    telemetryMeta.provider = "Google AI";

    const constBaseUrl = (
      process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id"
    ).replace(/\/+$/, "");
    const constEngineKey = process.env.CONST_ENGINE_API_KEY?.trim() || "";

    let resolvedModel = "antigravity/gemini-3.6-flash-medium";
    if (targetModel === "gemini-3.6-flash") {
      if (reasoning_effort === "low") {
        resolvedModel = "antigravity/gemini-3.6-flash-low";
      } else if (reasoning_effort === "high") {
        resolvedModel = "antigravity/gemini-3.6-flash-high";
      } else {
        resolvedModel = "antigravity/gemini-3.6-flash-medium";
      }
    } else {
      resolvedModel = targetModel;
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
        model: resolvedModel,
        messages,
        temperature,
        stream,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Const Engine error (${response.status})`;
      try {
        const p = JSON.parse(errText);
        if (p?.error?.message) errMsg = p.error.message;
      } catch {}

      await recordDirectTelemetry(telemetryMeta, {
        status: response.status,
        durationMs: Math.round(performance.now() - reqStartTime),
        errorMessage: errMsg,
      });

      return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
    }

    if (stream) {
      if (!response.body) {
        return NextResponse.json({ error: { message: "No response stream." } }, { status: 502 });
      }

      const { stream: teleStream } = createTelemetryStream(response.body, telemetryMeta);

      return new Response(teleStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Const-Request-Id": requestId,
        },
      });
    } else {
      const data = await response.json();
      const durationMs = Math.round(performance.now() - reqStartTime);

      await recordDirectTelemetry(telemetryMeta, {
        status: 200,
        durationMs,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        cachedTokens: data.usage?.prompt_tokens_details?.cached_tokens,
      });

      return NextResponse.json(data, {
        headers: {
          "X-Const-Request-Id": requestId,
        },
      });
    }
  }

  // CASE B: User BYOK Provider (OpenRouter, DeepSeek, Groq, Custom)
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

  const creds = await client.query(api.router.providers.getProviderCredentials, {
    providerDocId: providerDocId ? (providerDocId as Id<"userProviders">) : undefined,
    modelId: targetModel,
    rawApiKey: providedKey || undefined,
  });

  if (!creds) {
    await recordDirectTelemetry(telemetryMeta, {
      status: 404,
      durationMs: Math.round(performance.now() - reqStartTime),
      errorMessage: `No active provider found for model '${targetModel}'.`,
    });

    return NextResponse.json(
      { error: { message: `No active provider found for model '${targetModel}'.` } },
      { status: 404 }
    );
  }

  telemetryMeta.provider = creds.name || creds.providerId;

  const activeKey = creds.apiKey || "";
  const activeBaseUrl = (creds.baseUrl || "https://api.openai.com").replace(/\/+$/, "");

  let endpoint = activeBaseUrl;
  if (endpoint.endsWith("/chat/completions")) {
    // already full endpoint
  } else if (endpoint.endsWith("/v1")) {
    endpoint = `${endpoint}/chat/completions`;
  } else {
    endpoint = `${endpoint}/v1/chat/completions`;
  }

  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (activeKey && activeKey !== "no-key-required") {
    upstreamHeaders["Authorization"] = `Bearer ${activeKey}`;
  }
  if (creds.providerId === "openrouter" || activeBaseUrl.includes("openrouter.ai")) {
    upstreamHeaders["HTTP-Referer"] = "https://router.const.web.id";
    upstreamHeaders["X-Title"] = "Const Router";
  }

  const payload: Record<string, unknown> = {
    model: targetModel,
    messages,
    temperature,
    stream,
  };
  if (reasoning_effort && reasoning_effort !== "off") {
    payload.reasoning_effort = reasoning_effort;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: upstreamHeaders,
    body: JSON.stringify(payload),
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

    await recordDirectTelemetry(telemetryMeta, {
      status: response.status,
      durationMs: Math.round(performance.now() - reqStartTime),
      errorMessage: errMsg,
    });

    return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
  }

  if (stream) {
    if (!response.body) {
      return NextResponse.json(
        { error: { message: "No response stream from provider." } },
        { status: 502 }
      );
    }

    const { stream: teleStream } = createTelemetryStream(response.body, telemetryMeta);

    return new Response(teleStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Const-Request-Id": requestId,
      },
    });
  } else {
    const data = await response.json();
    const durationMs = Math.round(performance.now() - reqStartTime);

    await recordDirectTelemetry(telemetryMeta, {
      status: 200,
      durationMs,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      cachedTokens: data.usage?.prompt_tokens_details?.cached_tokens,
    });

    return NextResponse.json(data, {
      headers: {
        "X-Const-Request-Id": requestId,
      },
    });
  }
}
