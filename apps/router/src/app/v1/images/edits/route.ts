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

function normalizeImageUrls(resultJson: any, baseUrl: string) {
  if (Array.isArray(resultJson?.data)) {
    resultJson.data = resultJson.data.map((item: any) => {
      if (item?.url && typeof item.url === "string" && item.url.startsWith("/")) {
        return {
          ...item,
          url: `${baseUrl}${item.url}`,
        };
      }
      return item;
    });
  }
  return resultJson;
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
    provider: "NaraRouter (Image Edits)",
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

    // 2. Shared weekly quota check (shared 20 generations/edits per week)
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
        console.warn("Non-fatal quota check error in v1/images/edits:", quotaErr);
      }
    }

    // 3. Resolve Upstream NaraRouter API Key & Base URL
    let upstreamKey = process.env.NARA_ROUTER_API_KEY?.trim() || "";

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
        console.warn("Could not load BYOK provider for NaraRouter edits:", e);
      }
    }

    if (!upstreamKey) {
      return corsJson(
        {
          error: {
            message:
              "NaraRouter API key is not configured. Please set NARA_ROUTER_API_KEY in environment variables or provide a valid NaraRouter API key in the Authorization header.",
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
      ? `${rawBaseUrl}/images/edits`
      : `${rawBaseUrl}/v1/images/edits`;

    const contentType = req.headers.get("content-type") || "";

    // Helper to deduct quota on successful image edit
    const recordSuccessAndDeduct = async () => {
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
    };

    // 4. Handle Multipart Form Data (standard OpenAI image edits format)
    if (contentType.includes("multipart/form-data")) {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return corsJson(
          {
            error: {
              message: "Invalid multipart form data. Expected image file and prompt.",
              type: "invalid_request_error",
              code: "bad_request",
            },
          },
          { status: 400 }
        );
      }

      const image = formData.get("image");
      if (!image) {
        return corsJson(
          {
            error: {
              message: "The 'image' parameter is required for image editing.",
              type: "invalid_request_error",
              code: "missing_image",
            },
          },
          { status: 400 }
        );
      }

      const prompt = formData.get("prompt");
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return corsJson(
          {
            error: {
              message: "The 'prompt' parameter is required and must be a non-empty string.",
              type: "invalid_request_error",
              code: "missing_prompt",
            },
          },
          { status: 400 }
        );
      }

      const formModel = formData.get("model");
      if (formModel && typeof formModel === "string" && formModel.trim()) {
        requestedModel = formModel.trim();
      }
      telemetryMeta.model = requestedModel;

      const buildUpstreamFormData = (modelName: string) => {
        const ufd = new FormData();
        ufd.append("image", image);
        ufd.append("prompt", prompt.trim());
        ufd.append("model", modelName);

        const mask = formData.get("mask");
        if (mask) ufd.append("mask", mask);

        for (const key of ["n", "size", "response_format", "user"]) {
          const val = formData.get(key);
          if (val !== null && typeof val === "string") {
            ufd.append(key, val);
          }
        }
        return ufd;
      };

      const upstreamRes = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstreamKey}`,
          "User-Agent": "Const-Router/1.0",
        },
        body: buildUpstreamFormData(requestedModel),
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
          errorMessage: errorObj?.error?.message || `Image edit failed with HTTP ${upstreamRes.status}`,
          prompt: prompt.trim(),
          requestType: "image_edit",
        });

        return corsJson(errorObj, { status: upstreamRes.status });
      }

      let resultJson: any;
      try {
        resultJson = JSON.parse(resBodyText);
      } catch {
        resultJson = { created: Math.floor(Date.now() / 1000), data: [] };
      }

      resultJson = normalizeImageUrls(resultJson, rawBaseUrl);
      const imageUrls: string[] = Array.isArray(resultJson?.data)
        ? resultJson.data
            .map((item: any) => (typeof item?.url === "string" ? item.url : ""))
            .filter(Boolean)
        : [];

      await recordSuccessAndDeduct();

      await recordDirectTelemetry(telemetryMeta, {
        status: 200,
        durationMs,
        completionTokens: 100,
        prompt: prompt.trim(),
        requestType: "image_edit",
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
    }

    // 5. Handle JSON body (URL or Base64 payload)
    let jsonBody: any;
    try {
      jsonBody = await req.json();
    } catch {
      return corsJson(
        {
          error: {
            message: "Invalid JSON or unsupported content type. Use multipart/form-data or application/json.",
            type: "invalid_request_error",
            code: "bad_content_type",
          },
        },
        { status: 400 }
      );
    }

    if (!jsonBody?.image) {
      return corsJson(
        {
          error: {
            message: "The 'image' field is required for image editing.",
            type: "invalid_request_error",
            code: "missing_image",
          },
        },
        { status: 400 }
      );
    }

    if (!jsonBody?.prompt || typeof jsonBody.prompt !== "string" || !jsonBody.prompt.trim()) {
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

    if (jsonBody.model && typeof jsonBody.model === "string" && jsonBody.model.trim()) {
      requestedModel = jsonBody.model.trim();
    }
    telemetryMeta.model = requestedModel;

    const upstreamPayload: Record<string, unknown> = {
      image: jsonBody.image,
      prompt: jsonBody.prompt.trim(),
      model: requestedModel,
    };
    if (jsonBody.mask !== undefined) upstreamPayload.mask = jsonBody.mask;
    if (jsonBody.n !== undefined) upstreamPayload.n = jsonBody.n;
    if (jsonBody.size !== undefined) upstreamPayload.size = jsonBody.size;
    if (jsonBody.response_format !== undefined) upstreamPayload.response_format = jsonBody.response_format;
    if (jsonBody.user !== undefined) upstreamPayload.user = jsonBody.user;

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
        errorMessage: errorObj?.error?.message || `Image edit failed with HTTP ${upstreamRes.status}`,
        prompt: jsonBody.prompt.trim(),
        requestType: "image_edit",
      });

      return corsJson(errorObj, { status: upstreamRes.status });
    }

    let resultJson: any;
    try {
      resultJson = JSON.parse(resBodyText);
    } catch {
      resultJson = { created: Math.floor(Date.now() / 1000), data: [] };
    }

    resultJson = normalizeImageUrls(resultJson, rawBaseUrl);
    const imageUrls: string[] = Array.isArray(resultJson?.data)
      ? resultJson.data
          .map((item: any) => (typeof item?.url === "string" ? item.url : ""))
          .filter(Boolean)
      : [];

    await recordSuccessAndDeduct();

    await recordDirectTelemetry(telemetryMeta, {
      status: 200,
      durationMs,
      completionTokens: 100,
      prompt: jsonBody.prompt.trim(),
      requestType: "image_edit",
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
    const errorMsg = err instanceof Error ? err.message : "Internal image editing error";
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
