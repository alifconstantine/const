import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";

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

    // ========================================================
    // CASE A: Const Engine (Built-in Managed Gemini 3.6 Flash)
    // ========================================================
    const isConstBuiltin =
      (model === "gemini-3.6-flash" || model.startsWith("antigravity/")) && !providerDocId;

    if (isConstBuiltin) {
      const constBaseUrl = (process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id").replace(/\/+$/, "");
      const constEngineKey = process.env.CONST_ENGINE_API_KEY?.trim() || "";

      let targetModel = "antigravity/gemini-3.6-flash-medium";
      if (model === "gemini-3.6-flash") {
        if (reasoning_effort === "low") {
          targetModel = "antigravity/gemini-3.6-flash-low";
        } else if (reasoning_effort === "high") {
          targetModel = "antigravity/gemini-3.6-flash-high";
        } else {
          targetModel = "antigravity/gemini-3.6-flash-medium";
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
        return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
      }

      if (stream) {
        if (!response.body) {
          return NextResponse.json({ error: { message: "No response stream." } }, { status: 502 });
        }
        return new Response(response.body, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      } else {
        const data = await response.json();
        return NextResponse.json(data);
      }
    }

    // ========================================================
    // CASE B: User BYOK Provider (OpenRouter, DeepSeek, Groq, Custom)
    // ========================================================
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

    const creds = await client.query(api.router.providers.getProviderCredentials, {
      providerDocId: providerDocId ? (providerDocId as Id<"userProviders">) : undefined,
      modelId: model,
      rawApiKey: providedKey || undefined,
    });

    if (!creds) {
      return NextResponse.json(
        { error: { message: `No active provider found for model '${model}'.` } },
        { status: 404 }
      );
    }

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
      model,
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
      return NextResponse.json({ error: { message: errMsg } }, { status: response.status });
    }

    if (stream) {
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
    } else {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}
