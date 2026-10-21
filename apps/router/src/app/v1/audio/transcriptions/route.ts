import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import {
  generateRequestId,
  recordDirectTelemetry,
  type TelemetryMetadata,
} from "@/lib/telemetry";
import { normalizeConstModelName } from "@/lib/model-specs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Const-SSO-Token, X-Title, HTTP-Referer, User-Agent",
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

export async function POST(req: NextRequest) {
  const reqStartTime = performance.now();
  const requestId = generateRequestId();
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    process.env.CONVEX_URL ||
    "";

  const telemetryMeta: TelemetryMetadata = {
    requestId,
    model: "Whisper Large v3 Turbo",
    provider: "Const Gateway (STT)",
    convexUrl,
    estimatedPromptTokens: 10,
  };

  try {
    // 1. Auth resolution
    const cookieToken = req.cookies.get("const_sso_token")?.value;
    const customHeaderToken = req.headers.get("x-const-sso-token")?.trim();
    const authHeader = req.headers.get("authorization")?.trim();

    let providedKey = "";
    let ssoToken = cookieToken || customHeaderToken || null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token.startsWith("sk-")) {
        providedKey = token;
      } else {
        ssoToken = token;
      }
    }

    telemetryMeta.rawApiKey = providedKey || undefined;
    telemetryMeta.ssoToken = ssoToken;
    telemetryMeta.ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    telemetryMeta.userAgent = req.headers.get("user-agent") || "unknown";

    // 2. Parse Multipart Form Data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return corsJson(
        {
          error: {
            message: "Invalid multipart form data. Expected audio file in 'file' parameter.",
            type: "invalid_request_error",
            code: "bad_request",
          },
        },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return corsJson(
        {
          error: {
            message: "The 'file' parameter is required and must be an audio file (e.g. mp3, wav, m4a, webm).",
            type: "invalid_request_error",
            code: "missing_file",
          },
        },
        { status: 400 }
      );
    }

    const requestedModel = (formData.get("model") as string) || "whisper-large-v3-turbo";
    const resolvedModel = normalizeConstModelName(requestedModel);
    telemetryMeta.model = resolvedModel;

    // 3. Quota check (enforce 7M weekly limit on Const Gateway if active)
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
          return corsJson(
            {
              error: {
                message: `Const Pay-As-You-Go quota limit reached. Resets in ${quotaCheck.resetsInText || "this billing cycle"}.`,
                type: "quota_exceeded",
                code: "weekly_quota_exceeded",
              },
            },
            { status: 429 }
          );
        }
      } catch (quotaErr) {
        console.warn("Non-fatal quota check error in v1/audio/transcriptions:", quotaErr);
      }
    }

    // 4. Construct Upstream Form Data
    const upstreamFormData = new FormData();
    upstreamFormData.append("file", file);
    upstreamFormData.append("model", resolvedModel);

    // Forward optional OpenAI transcription parameters if supplied
    for (const key of ["language", "prompt", "response_format", "temperature", "timestamp_granularities[]"]) {
      const val = formData.get(key);
      if (val !== null && typeof val === "string") {
        upstreamFormData.append(key, val);
      }
    }

    const constBaseUrl = (
      process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id"
    ).replace(/\/+$/, "");
    const constEngineKey = process.env.CONST_ENGINE_API_KEY?.trim();
    if (!constEngineKey) {
      return corsJson(
        {
          error: {
            message: "Server configuration error: CONST_ENGINE_API_KEY environment variable is not configured.",
            type: "configuration_error",
            code: "missing_engine_api_key",
          },
        },
        { status: 500 }
      );
    }

    const upstreamHeaders: Record<string, string> = {};
    if (constEngineKey) {
      upstreamHeaders["Authorization"] = `Bearer ${constEngineKey}`;
    } else if (providedKey && !providedKey.includes("...")) {
      upstreamHeaders["Authorization"] = `Bearer ${providedKey}`;
    }

    const upstreamRes = await fetch(`${constBaseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: upstreamHeaders,
      body: upstreamFormData,
      signal: req.signal,
    });

    const contentType = upstreamRes.headers.get("content-type") || "";
    const responseFormat = formData.get("response_format") as string | null;

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();
      let errorObj: any;
      try {
        errorObj = JSON.parse(errorText);
      } catch {
        errorObj = { error: { message: errorText || `Upstream error ${upstreamRes.status}` } };
      }

      await recordDirectTelemetry(telemetryMeta, {
        status: upstreamRes.status,
        durationMs: Math.round(performance.now() - reqStartTime),
        errorMessage: errorObj?.error?.message || "Transcription failed",
      });

      return corsJson(errorObj, { status: upstreamRes.status });
    }

    // Format handling: json vs text/srt/vtt
    if (responseFormat === "text" || responseFormat === "srt" || responseFormat === "vtt") {
      const textResult = await upstreamRes.text();
      await recordDirectTelemetry(telemetryMeta, {
        status: 200,
        durationMs: Math.round(performance.now() - reqStartTime),
        completionTokens: Math.max(1, Math.ceil(textResult.length / 4)),
      });

      return new Response(textResult, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": contentType || "text/plain; charset=utf-8",
          "X-Const-Request-Id": requestId,
        },
      });
    }

    const jsonResult = await upstreamRes.json();
    const resultText = jsonResult?.text || "";

    await recordDirectTelemetry(telemetryMeta, {
      status: 200,
      durationMs: Math.round(performance.now() - reqStartTime),
      completionTokens: Math.max(1, Math.ceil(resultText.length / 4)),
    });

    return NextResponse.json(jsonResult, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "X-Const-Request-Id": requestId,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal transcription error";
    await recordDirectTelemetry(telemetryMeta, {
      status: 500,
      durationMs: Math.round(performance.now() - reqStartTime),
      errorMessage: errorMsg,
    });

    return corsJson(
      { error: { message: errorMsg, type: "internal_error" } },
      { status: 500 }
    );
  }
}
