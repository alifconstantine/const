import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
import { getManagedModel, normalizeConstModelName } from "./model-specs";
import {
  SseUsageParser,
  generateRequestId,
  estimateMessagesTokens,
  estimateTokens,
} from "./telemetry";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Const-SSO-Token, X-Const-Search-Mode, X-Title, HTTP-Referer, User-Agent",
  "Access-Control-Expose-Headers":
    "X-Const-Request-Id, X-Const-Combo-Selected-Model, X-Const-Combo-Fallbacks",
};
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(data, {
    status,
    headers: { ...CORS_HEADERS, ...headers },
  });
}
export class GatewayError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  const value = error as {
    data?: { message?: string; status?: number } | string;
    message?: string;
    status?: number;
    name?: string;
  };
  const data = typeof value?.data === "object" ? value.data : undefined;
  const status =
    value?.status ??
    data?.status ??
    (value?.name === "TimeoutError"
      ? 504
      : /Unauthorized|Invalid or revoked|auth|token/i.test(
            String(value?.message),
          )
        ? 401
        : 503);
  const message =
    data?.message ??
    (error instanceof GatewayError
      ? error.message
      : status === 401
        ? "Sign in or supply an active Const API key."
        : status === 504
          ? "The model timed out. Retry your request."
          : "The gateway is temporarily unavailable. Retry shortly.");
  return json(
    {
      error: {
        message,
        type: status === 401 ? "authentication_error" : "request_error",
        code: status,
      },
    },
    status,
  );
}
export async function authenticate(req: NextRequest, customKey?: string) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) throw new GatewayError("Gateway backend is not configured", 503);
  const bearer = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const rawApiKey =
    customKey || (bearer?.startsWith("sk-const-live-") ? bearer : undefined);
  const ssoToken =
    req.headers.get("x-const-sso-token") ||
    req.cookies.get("const_sso_token")?.value ||
    (!rawApiKey ? bearer : undefined);
  if (!rawApiKey && !ssoToken)
    throw new GatewayError("Sign in or supply an active Const API key.", 401);
  if (bearer && !rawApiKey && !bearer.includes("."))
    throw new GatewayError("Invalid API key", 401);
  const client = new ConvexHttpClient(url);
  if (!rawApiKey && ssoToken) client.setAuth(ssoToken);
  const identity = await client.query(api.router.gateway.authenticate, {
    rawApiKey,
  });
  return { client, rawApiKey, ...identity };
}
export type GatewayAuth = Awaited<ReturnType<typeof authenticate>>;
export function serverSecret() {
  const secret = process.env.ROUTER_GATEWAY_SECRET;
  if (!secret || secret.length < 32)
    throw new GatewayError("Gateway metering is not configured", 503);
  return secret;
}
export function engineConfig() {
  const key = process.env.CONST_ENGINE_API_KEY?.trim();
  if (!key) throw new GatewayError("Model engine is not configured", 503);
  return {
    base: (
      process.env.CONST_ENGINE_BASE_URL || "https://engine.const.web.id"
    ).replace(/\/+$/, ""),
    key,
  };
}
export type ChatMessage = {
  role: string;
  content?: unknown;
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
};
export type ChatBody = {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  stream?: boolean;
  max_tokens?: number;
  max_completion_tokens?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  reasoning_effort?: string;
  response_format?: unknown;
  web_search?: string | boolean;
  webSearch?: string | boolean;
  reasoning?: string | { effort?: string };
};
export function validateChat(body: ChatBody) {
  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray(body.messages) ||
    !body.messages.length ||
    body.messages.length > 500
  )
    throw new GatewayError("Supply between 1 and 500 messages.");
  for (const m of body.messages) {
    if (
      !m ||
      !["system", "developer", "user", "assistant", "tool"].includes(m.role) ||
      (m.content !== undefined &&
        m.content !== null &&
        typeof m.content !== "string" &&
        !Array.isArray(m.content))
    )
      throw new GatewayError("Invalid message format.");
  }
  if (
    body.model !== undefined &&
    (typeof body.model !== "string" || body.model.length > 160)
  )
    throw new GatewayError("Invalid model ID.");
  if (
    body.temperature !== undefined &&
    (!Number.isFinite(body.temperature) ||
      body.temperature < 0 ||
      body.temperature > 2)
  )
    throw new GatewayError("Temperature must be between 0 and 2.");
  for (const value of [body.max_tokens, body.max_completion_tokens])
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < 1 || value > 128000)
    )
      throw new GatewayError(
        "Output token limit must be between 1 and 128000.",
      );
  if (body.stream !== undefined && typeof body.stream !== "boolean")
    throw new GatewayError("stream must be a boolean.");
  if (new TextEncoder().encode(JSON.stringify(body)).length > 4_000_000)
    throw new GatewayError("Request too large", 413);
}
type Meter = {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  status: number;
  durationMs: number;
  ttftMs?: number;
  errorMessage?: string;
  usageEstimated: boolean;
  unitCount?: number;
};
export async function reserve(
  auth: GatewayAuth,
  requestId: string,
  model: string,
  requestedModel: string,
  promptTokens: number,
  maxOutputTokens: number,
  comboName?: string,
  units?: number,
) {
  return auth.client.mutation(api.router.gateway.begin, {
    secret: serverSecret(),
    rawApiKey: auth.rawApiKey,
    requestId,
    model,
    requestedModel,
    promptTokens,
    maxOutputTokens,
    comboName,
    units,
  });
}
export async function settle(
  auth: GatewayAuth,
  ticket: { id: Id<"routerRequests"> },
  meter: Meter,
  req: NextRequest,
  prompt?: string,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await auth.client.mutation(api.router.gateway.settle, {
        secret: serverSecret(),
        id: ticket.id,
        ...meter,
        prompt,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
export async function executeSingle(
  req: NextRequest,
  auth: GatewayAuth,
  body: ChatBody,
  modelId: string,
  requestedModel = modelId,
  comboName?: string,
): Promise<Response> {
  const spec = getManagedModel(modelId);
  if (!spec || spec.category !== "llm")
    throw new GatewayError(
      "Unknown chat model or unavailable :free variant. Select an ID from /v1/models.",
    );
  const engine = engineConfig(),
    started = performance.now(),
    requestId = generateRequestId();
  // Text byte length is a conservative reservation; images reserve their full context budget.
  const estimatedInput =
    new TextEncoder().encode(
      JSON.stringify({
        messages: body.messages,
        tools: body.tools,
        response_format: body.response_format,
      }),
    ).length +
    body.messages.length * 4;
  const hasMedia = body.messages.some(
    (m) =>
      Array.isArray(m.content) && m.content.some((p: any) => p.type !== "text"),
  );
  const promptBudget = hasMedia
    ? Math.max(
        estimatedInput,
        (spec.contextLength ?? 1000000) -
          (body.max_completion_tokens ?? body.max_tokens ?? 1024),
      )
    : estimatedInput;
  const ticket = await reserve(
    auth,
    requestId,
    modelId,
    requestedModel,
    promptBudget,
    body.max_completion_tokens ?? body.max_tokens ?? 1024,
    comboName,
  );
  const prompt = body.messages
    .filter((m) => m.role === "user")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n");
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(180000)]);
  const stream = body.stream ?? auth.settings.enableStreaming;
  const payload = {
    model: normalizeConstModelName(modelId),
    messages: body.messages,
    temperature: body.temperature ?? auth.settings.defaultTemperature,
    stream,
    max_tokens: ticket.maxOutputTokens,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...(body.tools ? { tools: body.tools } : {}),
    ...(body.tool_choice ? { tool_choice: body.tool_choice } : {}),
    ...(body.response_format ? { response_format: body.response_format } : {}),
    ...(body.reasoning_effort
      ? { reasoning_effort: body.reasoning_effort }
      : {}),
  };
  let response: Response;
  try {
    response = await fetch(engine.base + "/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + engine.key,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    await settle(
      auth,
      ticket,
      {
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        status: req.signal.aborted ? 499 : 504,
        durationMs: performance.now() - started,
        usageEstimated: false,
        errorMessage: "Upstream request interrupted",
      },
      req,
      prompt,
    );
    throw error;
  }
  const headers = { ...CORS_HEADERS, "X-Const-Request-Id": requestId };
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    await settle(
      auth,
      ticket,
      {
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        status: response.status >= 400 ? response.status : 502,
        durationMs: performance.now() - started,
        usageEstimated: false,
        errorMessage: "Upstream model failed",
      },
      req,
      prompt,
    );
    return json(
      {
        error: {
          message:
            "The selected model is unavailable. Retry or select another model.",
        },
      },
      response.status >= 400 ? response.status : 502,
      headers,
    );
  }
  if (!stream) {
    let data: any;
    try {
      data = await response.json();
    } catch {
      await settle(
        auth,
        ticket,
        {
          promptTokens: 0,
          completionTokens: 0,
          cachedTokens: 0,
          status: 502,
          durationMs: performance.now() - started,
          usageEstimated: true,
          errorMessage: "Invalid upstream JSON",
        },
        req,
      );
      throw new GatewayError("Invalid model response", 502);
    }
    const usage = data.usage,
      estimated = !usage;
    const input = usage?.prompt_tokens ?? estimateMessagesTokens(body.messages);
    const output =
      usage?.completion_tokens ??
      estimateTokens(JSON.stringify(data.choices?.[0]?.message ?? ""));
    await settle(
      auth,
      ticket,
      {
        promptTokens: input,
        completionTokens: output,
        cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
        status: 200,
        durationMs: performance.now() - started,
        usageEstimated: estimated,
      },
      req,
      prompt,
    );
    data.model = modelId;
    return json(data, 200, headers);
  }
  const parser = new SseUsageParser(),
    reader = response.body.getReader(),
    encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const finish = async (status: number, errorMessage?: string) => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    parser.finish();
    await settle(
      auth,
      ticket,
      {
        promptTokens: parser.hasUsage
          ? parser.promptTokens
          : parser.outputText
            ? estimateMessagesTokens(body.messages)
            : 0,
        completionTokens: parser.hasUsage
          ? parser.completionTokens
          : estimateTokens(parser.outputText),
        cachedTokens: parser.cachedTokens,
        status: parser.hasError ? 502 : status,
        durationMs: performance.now() - started,
        ttftMs:
          parser.firstTokenAt === undefined
            ? undefined
            : parser.firstTokenAt - started,
        usageEstimated: !parser.hasUsage,
        errorMessage,
      },
      req,
      prompt,
    );
  };
  const output = new ReadableStream<Uint8Array>({
    start(controller) {
      heartbeat = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {}
        }
      }, 10000);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          await finish(200);
          controller.close();
          return;
        }
        parser.push(value);
        controller.enqueue(value);
      } catch (error) {
        try {
          await finish(req.signal.aborted ? 499 : 502, "Stream interrupted");
        } finally {
          controller.error(error);
          await reader.cancel().catch(() => {});
        }
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => {});
      await finish(499, "Stream stopped by client");
    },
  });
  return new Response(output, {
    headers: {
      ...headers,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
