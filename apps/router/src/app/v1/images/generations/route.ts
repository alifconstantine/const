import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import {
  generateRequestId,
  recordDirectTelemetry,
  type TelemetryMetadata,
} from "@/lib/telemetry";

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

  let requestedModel = "gpt-image-2";

  const telemetryMeta: TelemetryMetadata = {
    requestId,
    model: requestedModel,
    provider: "NaraRouter (Images)",
    convexUrl,
    estimatedPromptTokens: 25,
  };

  try {
    // 1. Auth resolution
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

    telemetryMeta.rawApiKey = providedKey || undefined;
    telemetryMeta.ssoToken = ssoToken;
    telemetryMeta.ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    telemetryMeta.userAgent = req.headers.get("user-agent") || "unknown";

    // 2. Parse JSON body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return corsJson(
        {
          error: {
            message: "Invalid JSON in request body.",
            type: "invalid_request_error",
            code: "bad_json",
          },
        },
        { status: 400 }
      );
    }

    const prompt = body?.prompt;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return corsJson(
        {
          error: {
            message: "The 'prompt' field is required and must be a non-empty string.",
            type: "invalid_request_error",
            code: "missing_prompt",
          },
        },
        { status: 400 }
      );
    }

    if (body.model && typeof body.model === "string" && body.model.trim()) {
      requestedModel = body.model.trim();
    }
    telemetryMeta.model = requestedModel;

    // 3. Quota check: Enforce shared weekly image limit (20 generations/edits per week)
    // Applies when authenticating via Const account / API key
    const isConstAuth = Boolean(ssoToken || (providedKey && providedKey.startsWith("sk-const-")));
    if (convexUrl && isConstAuth) {
      try {
        const client = new ConvexHttpClient(convexUrl);
        if (ssoToken) client.setAuth(ssoToken);
        const quotaCheck = await client.query(api.router.quotas.checkImageGatewayQuota, {
          rawApiKey: providedKey || undefined,
          ssoToken: ssoToken || undefined,
        });

        if (quotaCheck && !quotaCheck.allowed && quotaCheck.reason === "weekly_quota_exceeded") {
          return corsJson(
            {
              error: {
                message: `Const weekly image quota exceeded (${quotaCheck.weeklyLimitImages || 20} generations/edits per week). Resets in ${quotaCheck.resetsInText || "this week"}. To bypass this limit, configure your own NaraRouter API key in Providers.`,
                type: "quota_exceeded",
                code: "weekly_quota_exceeded",
              },
            },
            { status: 429 }
          );
        }
      } catch (quotaErr) {
        console.warn("Non-fatal quota check error in v1/images/generations:", quotaErr);
      }
    }

    // 4. Resolve Upstream NaraRouter API Key & Base URL
    let upstreamKey = process.env.NARA_ROUTER_API_KEY?.trim() || "";

    // If caller provided a direct NaraRouter key (e.g. sk-nry-...)
    if (providedKey && (providedKey.startsWith("sk-nry-") || !providedKey.startsWith("sk-const-"))) {
      if (!upstreamKey || providedKey.startsWith("sk-nry-")) {
        upstreamKey = providedKey;
      }
    }

    // Check user BYOK providers in Convex if key is still missing
    if (!upstreamKey && convexUrl && (ssoToken || providedKey)) {
      try {
        const client = new ConvexHttpClient(convexUrl);
        if (ssoToken) client.setAuth(ssoToken);
        const creds = await client.query(api.router.providers.getProviderCredentials, {
          modelId: requestedModel,
          rawApiKey: providedKey || undefined,
        });
        if (creds?.apiKey) {
          upstreamKey = creds.apiKey;
        }
      } catch (e) {
        console.warn("Could not load BYOK provider for NaraRouter:", e);
      }
    }

    if (!upstreamKey) {
      return corsJson(
        {
          error: {
            message:
              "NaraRouter API key is not configured. Please set NARA_ROUTER_API_KEY in environment variables or provide a valid NaraRouter API key (sk-nry-...) in the Authorization header.",
            type: "configuration_error",
            code: "missing_nara_api_key",
          },
        },
        { status: 500 }
      );
    }

    const rawBaseUrl = (
      process.env.NARA_ROUTER_BASE_URL?.trim() || "https://api-images.bynara.id"
    ).replace(/\/+$/, "");

    const upstreamUrl = rawBaseUrl.endsWith("/v1")
      ? `${rawBaseUrl}/images/generations`
      : `${rawBaseUrl}/v1/images/generations`;

    // 5. Construct upstream payload (OpenAI-compatible)
    const upstreamPayload: Record<string, unknown> = {
      model: requestedModel,
      prompt: prompt.trim(),
    };

    if (body.n !== undefined) upstreamPayload.n = body.n;
    if (body.size !== undefined) upstreamPayload.size = body.size;
    if (body.quality !== undefined) upstreamPayload.quality = body.quality;
    if (body.response_format !== undefined) upstreamPayload.response_format = body.response_format;
    if (body.style !== undefined) upstreamPayload.style = body.style;
    if (body.user !== undefined) upstreamPayload.user = body.user;

    // 6. Forward request to NaraRouter
    const upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${upstreamKey}`,
        "User-Agent": "Const-Router/1.0",
      },
      body: JSON.stringify(upstreamPayload),
      signal: req.signal,
    });

    const resBodyText = await upstreamRes.text();
    const durationMs = Math.round(performance.now() - reqStartTime);

    if (!upstreamRes.ok) {
      let errorObj: any;
      try {
        errorObj = JSON.parse(resBodyText);
      } catch {
        errorObj = {
          error: {
            message: resBodyText || `NaraRouter upstream error ${upstreamRes.status}`,
            type: "upstream_error",
            code: `http_${upstreamRes.status}`,
          },
        };
      }

      await recordDirectTelemetry(telemetryMeta, {
        status: upstreamRes.status,
        durationMs,
        errorMessage: errorObj?.error?.message || `Image generation failed with HTTP ${upstreamRes.status}`,
        prompt: prompt.trim(),
        requestType: "image_generation",
      });

      return corsJson(errorObj, { status: upstreamRes.status });
    }

    let resultJson: any;
    try {
      resultJson = JSON.parse(resBodyText);
    } catch {
      resultJson = { created: Math.floor(Date.now() / 1000), data: [] };
    }

    // Ensure image URLs are fully qualified absolute URLs
    if (Array.isArray(resultJson?.data)) {
      resultJson.data = resultJson.data.map((item: any) => {
        if (item?.url && typeof item.url === "string" && item.url.startsWith("/")) {
          return {
            ...item,
            url: `${rawBaseUrl}${item.url}`,
          };
        }
        return item;
      });
    }

    const imageUrls: string[] = Array.isArray(resultJson?.data)
      ? resultJson.data
          .map((item: any) => (typeof item?.url === "string" ? item.url : ""))
          .filter(Boolean)
      : [];

    // Deduct 1 from weekly image quota for Const-authenticated users
    if (convexUrl && isConstAuth) {
      try {
        const client = new ConvexHttpClient(convexUrl);
        if (ssoToken) client.setAuth(ssoToken);
        await client.mutation(api.router.quotas.deductImageQuota, {
          rawApiKey: providedKey || undefined,
          ssoToken: ssoToken || undefined,
          count: 1,
        });
      } catch (deductErr) {
        console.warn("Non-fatal image quota deduction error:", deductErr);
      }
    }

    await recordDirectTelemetry(telemetryMeta, {
      status: 200,
      durationMs,
      completionTokens: 100,
      prompt: prompt.trim(),
      requestType: "image_generation",
      imageCount: imageUrls.length,
      imageUrls,
    });

    return NextResponse.json(resultJson, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "X-Const-Request-Id": requestId,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal image generation error";
    await recordDirectTelemetry(telemetryMeta, {
      status: 500,
      durationMs: Math.round(performance.now() - reqStartTime),
      errorMessage: errorMsg,
    });

    return corsJson(
      {
        error: {
          message: errorMsg,
          type: "internal_error",
          code: "internal_server_error",
        },
      },
      { status: 500 }
    );
  }
}
