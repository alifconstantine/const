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
import { executeComboChat } from "@/lib/combo-executor";
import { isBuiltinModel, normalizeConstModelName } from "@/lib/model-specs";
import { decomposeSearchQueries } from "@/lib/search-decomposer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OpenAIMessage {
  role: "user" | "assistant" | "system" | "tool" | "function" | string;
  content?: string | null | unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

interface OpenAIChatRequestBody {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  stream?: boolean;
  reasoning_effort?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | string;
  reasoning?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | string | { effort?: string };
  providerDocId?: string;
  max_tokens?: number;
  max_completion_tokens?: number;
  tools?: any[];
  tool_choice?: any;
  web_search?: "off" | "auto" | "research" | "deep-research" | boolean | string;
  webSearch?: "off" | "auto" | "research" | "deep-research" | boolean | string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Const-SSO-Token, X-Title, HTTP-Referer, User-Agent",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function corsJson(data: any, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      ...CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });
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
      ...CORS_HEADERS,
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
    const body: OpenAIChatRequestBody = await req.json();
    const {
      model,
      messages = [],
      temperature = 0.7,
      stream = false,
      providerDocId,
      max_tokens,
      max_completion_tokens,
      tools,
      tool_choice,
    } = body;

    const hasSystemMessage = messages.some((m) => m.role === "system");
    const hasTools = Boolean(tools && Array.isArray(tools) && tools.length > 0);

    const effectiveMessages = [...messages];
    // If client supplied neither a system prompt nor tools, provide a clean base Const identity
    // so upstream doesn't fall back to Antigravity's internal IDE prompt
    if (!hasSystemMessage && !hasTools) {
      effectiveMessages.unshift({
        role: "system",
        content:
          "You are Const AI, an intelligent AI assistant powered by the Const platform. Provide helpful, direct, and accurate responses.",
      });
    }

    const rawReasoning = body.reasoning;
    const rawReasoningEffort =
      body.reasoning_effort ||
      (typeof rawReasoning === "string" ? rawReasoning : rawReasoning?.effort);
    const reasoning_effort =
      rawReasoningEffort === "low" ||
      rawReasoningEffort === "medium" ||
      rawReasoningEffort === "high" ||
      rawReasoningEffort === "xhigh" ||
      rawReasoningEffort === "max" ||
      rawReasoningEffort === "minimal" ||
      rawReasoningEffort === "off"
        ? rawReasoningEffort
        : undefined;

    if (!model) {
      return NextResponse.json(
        { error: { message: "The 'model' field is required." } },
        { status: 400 }
      );
    }

    if (model.toLowerCase().includes("whisper")) {
      return NextResponse.json(
        {
          error: {
            message: `Model '${model}' is a speech-to-text audio model. Please use POST /v1/audio/transcriptions with multipart/form-data instead.`,
            type: "invalid_request_error",
            code: "invalid_endpoint_for_model",
          },
        },
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
    const estimatedPromptTokens = estimateMessagesTokens(effectiveMessages);

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
    const lowerModel = model.toLowerCase().trim();
    let comboSlug: string | null = null;
    if (model.startsWith("combo/")) {
      comboSlug = model.replace(/^combo\//, "");
    } else if (
      lowerModel === "auto" ||
      lowerModel === "auto (best available)" ||
      lowerModel === "auto router"
    ) {
      comboSlug = "auto";
    } else if (
      lowerModel === "fast" ||
      lowerModel === "fast (low latency)" ||
      lowerModel === "low-latency fast chain"
    ) {
      comboSlug = "fast";
    } else if (
      lowerModel === "coding" ||
      lowerModel === "coding & reasoning" ||
      lowerModel === "coding agent chain"
    ) {
      comboSlug = "coding";
    }

    if (comboSlug && convexUrl) {
      telemetryMeta.model = `combo/${comboSlug}`;
      telemetryMeta.provider = "Virtual Combo";

      let comboThinkingLevel: string = "off";
      if (comboSlug === "auto") {
        comboThinkingLevel = reasoning_effort && reasoning_effort !== "off" ? reasoning_effort : "medium";
      } else if (comboSlug === "fast") {
        comboThinkingLevel = "off";
      } else if (comboSlug === "coding") {
        comboThinkingLevel = reasoning_effort && reasoning_effort !== "off" ? reasoning_effort : "high";
      } else {
        comboThinkingLevel = reasoning_effort && reasoning_effort !== "off" ? reasoning_effort : "medium";
      }

      const comboResponse = await executeComboChat({
        comboSlug,
        messages: effectiveMessages,
        temperature,
        thinkingLevel: comboThinkingLevel,
        apiKey: providedKey,
        ssoToken,
        convexUrl,
        requestId,
        ip,
        userAgent,
        signal: req.signal,
        tools,
        tool_choice,
      });

      return wrapWithTelemetry(comboResponse, telemetryMeta);
    }

    // Standard non-combo model execution
    return await dispatchSingleModel({
      targetModel: model,
      providerDocId,
      messages: effectiveMessages,
      temperature,
      stream,
      reasoning_effort,
      max_tokens,
      max_completion_tokens,
      tools,
      tool_choice,
      webSearch: body.web_search ?? body.webSearch,
      searchModeHeader: req.headers.get("x-const-search-mode"),
      providedKey,
      ssoToken,
      convexUrl,
      telemetryMeta,
      requestId,
      reqStartTime,
      signal: req.signal,
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
  max_tokens,
  max_completion_tokens,
  tools,
  tool_choice,
  webSearch,
  searchModeHeader,
  providedKey,
  ssoToken,
  convexUrl,
  telemetryMeta,
  requestId,
  reqStartTime,
  signal,
}: {
  targetModel: string;
  providerDocId?: string;
  messages: OpenAIMessage[];
  temperature: number;
  stream: boolean;
  reasoning_effort?: string;
  max_tokens?: number;
  max_completion_tokens?: number;
  tools?: any[];
  tool_choice?: any;
  webSearch?: "off" | "auto" | "research" | "deep-research" | boolean | string;
  searchModeHeader?: string | null;
  providedKey?: string;
  ssoToken?: string | null;
  convexUrl: string;
  telemetryMeta: TelemetryMetadata;
  requestId: string;
  reqStartTime: number;
  signal?: AbortSignal;
}): Promise<Response> {
  // CASE A: Const (Built-in Managed Models, e.g. Gemini 3.7 / 3.8 Flash)
  const isConstBuiltin = isBuiltinModel(targetModel) && !providerDocId;

  if (isConstBuiltin) {
    telemetryMeta.provider = "Google AI";

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
        console.warn("Non-fatal quota check error:", quotaErr);
      }
    }

    const constBaseUrl = (
      process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id"
    ).replace(/\/+$/, "");
    const constEngineKey =
      process.env.CONST_ENGINE_API_KEY?.trim() || "sk-f5ee326335f0dff1-c30518-93814e47";

    let resolvedModel = normalizeConstModelName(targetModel);
    if (resolvedModel === "Const Search" || targetModel === "const-search") {
      resolvedModel = "Gemini 3.8 Flash";
    }

    let searchAugmentedMessages = messages;

    const isDeepResearch =
      webSearch === "deep-research" ||
      (typeof webSearch === "string" && webSearch.includes("deep")) ||
      searchModeHeader === "deep-research";

    const isSearchRequested =
      webSearch === "auto" ||
      webSearch === true ||
      webSearch === "research" ||
      webSearch === "deep-research" ||
      targetModel === "const-search" ||
      targetModel === "Const Search";

    if (isSearchRequested) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const queryText = typeof lastUser?.content === "string" ? lastUser.content : "";
      if (queryText.trim()) {
        try {
          const subQueries = decomposeSearchQueries(queryText, isDeepResearch);
          const searchHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (constEngineKey) searchHeaders["Authorization"] = `Bearer ${constEngineKey}`;

          const fetchSubQuery = async (sq: string) => {
            try {
              const searchController = new AbortController();
              const searchTimeout = setTimeout(() => searchController.abort(), 12000);
              const numResults = isDeepResearch ? 8 : 5;
              const searchRes = await fetch(`${constBaseUrl}/v1/search`, {
                method: "POST",
                headers: searchHeaders,
                body: JSON.stringify({
                  query: sq,
                  num_results: numResults,
                  max_results: numResults,
                  search_depth: isDeepResearch ? "deep" : "basic",
                  mode: isDeepResearch ? "deep-research" : "research",
                }),
                signal: searchController.signal,
              }).finally(() => clearTimeout(searchTimeout));

              if (!searchRes.ok) return [];
              const searchData = await searchRes.json();
              return Array.isArray(searchData?.results) ? searchData.results : [];
            } catch (sqErr) {
              console.warn("Sub-query search error in v1/chat:", sq, sqErr);
              return [];
            }
          };

          const resultsByQuery = await Promise.all(subQueries.map(fetchSubQuery));
          const seenUrls = new Set<string>();
          const searchResults: Array<{ title: string; url: string; snippet?: string }> = [];

          for (const list of resultsByQuery) {
            for (const r of list) {
              if (r?.url && !seenUrls.has(r.url)) {
                seenUrls.add(r.url);
                const textSnippet =
                  typeof r.snippet === "string" && r.snippet.trim()
                    ? r.snippet.trim()
                    : typeof r.content === "string"
                      ? r.content.trim()
                      : r.content?.text?.trim() || "";
                const title = r.title?.trim() || r.display_url || r.url;
                searchResults.push({
                  title,
                  url: r.url,
                  snippet: textSnippet,
                });
              }
            }
          }

          if (searchResults.length > 0) {
            const maxSources = isDeepResearch ? 15 : 10;
            const searchSnippet = searchResults.slice(0, maxSources).map((r, idx) => {
              return `[Source ${idx + 1}]: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet?.slice(0, 1500) || "No snippet available."}`;
            }).join("\n\n");

            searchAugmentedMessages = [
              ...messages.slice(0, -1),
              {
                role: "system",
                content: `[Real-Time Web Search Grounding Context from Const Search (${isDeepResearch ? "DeepResearch" : "Research"})]\n${searchSnippet}\n\nPlease ground your response with facts from these live web search results whenever relevant, and cite source titles or URLs.`,
              },
              messages[messages.length - 1]!,
            ];
          }
        } catch (searchErr) {
          console.warn("Non-fatal web search grounding error in v1/chat:", searchErr);
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
      model: resolvedModel,
      messages: searchAugmentedMessages,
      temperature,
      stream,
    };
    if (reasoning_effort && reasoning_effort !== "off") {
      let effort = reasoning_effort;
      if (resolvedModel.toLowerCase().includes("gemini") && (effort === "xhigh" || effort === "max")) {
        effort = "high";
      }
      constPayload.reasoning = effort;
      constPayload.reasoning_effort = effort;
    }
    if (max_tokens !== undefined) {
      constPayload.max_tokens = max_tokens;
    }
    if (max_completion_tokens !== undefined) {
      constPayload.max_completion_tokens = max_completion_tokens;
    }
    if (tools && tools.length > 0) {
      constPayload.tools = tools;
    }
    if (tool_choice) {
      constPayload.tool_choice = tool_choice;
    }

    const response = await fetch(`${constBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(constPayload),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Const error (${response.status})`;
      try {
        const p = JSON.parse(errText);
        if (p?.error?.message) errMsg = p.error.message;
      } catch {
        if (errText.includes("<!DOCTYPE") || errText.includes("<html") || response.status === 502) {
          errMsg = "Const Engine server is offline or unreachable (502 Bad Gateway).";
        }
      }

      if (response.status === 502 && (errMsg.includes("<!DOCTYPE") || errMsg.includes("<html") || errMsg === "Const error (502)")) {
        errMsg = "Const Engine server is offline or unreachable (502 Bad Gateway).";
      }

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
          "X-Accel-Buffering": "no",
          "X-Const-Request-Id": requestId,
        },
      });
    } else {
      const data = await response.json();
      const durationMs = Math.round(performance.now() - reqStartTime);

      const rawPromptTokens = data.usage?.prompt_tokens ?? 0;
      const cachedTokens =
        data.usage?.prompt_tokens_details?.cached_tokens ??
        data.usage?.cached_tokens ??
        data.usage?.cache_read_input_tokens ??
        0;
      const purePromptTokens = Math.max(0, rawPromptTokens - cachedTokens);
      const completionTokens = data.usage?.completion_tokens ?? 0;

      await recordDirectTelemetry(telemetryMeta, {
        status: 200,
        durationMs,
        promptTokens: purePromptTokens,
        completionTokens,
        cachedTokens: 0,
      });

      if (data.usage) {
        data.usage.prompt_tokens = purePromptTokens;
        data.usage.completion_tokens = completionTokens;
        data.usage.total_tokens = purePromptTokens + completionTokens;
        delete data.usage.prompt_tokens_details;
        delete data.usage.cached_tokens;
        delete data.usage.cache_read_input_tokens;
      }

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

  let creds: any = null;
  try {
    const client = new ConvexHttpClient(convexUrl);
    if (ssoToken) {
      client.setAuth(ssoToken);
    }

    creds = await client.query(api.router.providers.getProviderCredentials, {
      providerDocId: providerDocId ? (providerDocId as Id<"userProviders">) : undefined,
      modelId: targetModel,
      rawApiKey: providedKey || undefined,
    });
  } catch (convexErr: any) {
    console.error("[completions] Convex auth/query error:", convexErr);
    const errText = convexErr?.message || String(convexErr);
    const isAuthErr =
      errText.includes("NoAuthProvider") ||
      errText.includes("Unauthorized") ||
      errText.includes("unauthorized");

    await recordDirectTelemetry(telemetryMeta, {
      status: isAuthErr ? 401 : 500,
      durationMs: Math.round(performance.now() - reqStartTime),
      errorMessage: errText,
    });

    return NextResponse.json(
      {
        error: {
          message: isAuthErr
            ? `Authentication failed: Session token is not recognized or has expired. Please sign in again or use a Const API Key.`
            : `Failed to resolve provider credentials: ${errText}`,
          code: isAuthErr ? "unauthorized" : "provider_query_error",
        },
      },
      { status: isAuthErr ? 401 : 500 }
    );
  }

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
    upstreamHeaders["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://router.const.web.id";
    upstreamHeaders["X-Title"] = "Const Router";
  }

  const payload: Record<string, unknown> = {
    model: targetModel,
    messages,
    temperature,
    stream,
  };
  if (reasoning_effort && reasoning_effort !== "off") {
    let effort = reasoning_effort;
    if (targetModel.toLowerCase().includes("gemini") && (effort === "xhigh" || effort === "max")) {
      effort = "high";
    }
    payload.reasoning_effort = effort;
    payload.reasoning = effort;
  }
  if (max_tokens !== undefined) {
    payload.max_tokens = max_tokens;
  }
  if (max_completion_tokens !== undefined) {
    payload.max_completion_tokens = max_completion_tokens;
  }
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  if (tool_choice) {
    payload.tool_choice = tool_choice;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: upstreamHeaders,
    body: JSON.stringify(payload),
    signal,
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

    return corsJson({ error: { message: errMsg } }, { status: response.status });
  }

  if (stream) {
    if (!response.body) {
      return corsJson(
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
        "X-Accel-Buffering": "no",
        "X-Const-Request-Id": requestId,
        ...CORS_HEADERS,
      },
    });
  } else {
    const data = await response.json();
    const durationMs = Math.round(performance.now() - reqStartTime);

    const rawPromptTokens = data.usage?.prompt_tokens ?? 0;
    const cachedTokens =
      data.usage?.prompt_tokens_details?.cached_tokens ??
      data.usage?.cached_tokens ??
      data.usage?.cache_read_input_tokens ??
      0;
    const purePromptTokens = Math.max(0, rawPromptTokens - cachedTokens);
    const completionTokens = data.usage?.completion_tokens ?? 0;

    await recordDirectTelemetry(telemetryMeta, {
      status: 200,
      durationMs,
      promptTokens: purePromptTokens,
      completionTokens,
      cachedTokens: 0,
    });

    if (data.usage) {
      data.usage.prompt_tokens = purePromptTokens;
      data.usage.completion_tokens = completionTokens;
      data.usage.total_tokens = purePromptTokens + completionTokens;
      delete data.usage.prompt_tokens_details;
      delete data.usage.cached_tokens;
      delete data.usage.cache_read_input_tokens;
    }

    return corsJson(data, {
      headers: {
        "X-Const-Request-Id": requestId,
      },
    });
  }
}
