import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
import { isBuiltinModel, normalizeConstModelName } from "@/lib/model-specs";

export async function POST(req: NextRequest) {
  try {
    // 1. Session verification
    const ssoToken =
      req.headers.get("x-const-sso-token") ||
      req.cookies.get("const_sso_token")?.value ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!ssoToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Active Const session required to test models.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { model, providerId, providerDocId, protocol, baseUrl, apiKey } = body;

    if (!model || typeof model !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid 'model' parameter.",
        },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    // ========================================================
    // CASE NARA: NaraRouter Image Models (gpt-image-2)
    // ========================================================
    if (
      model === "gpt-image-2" ||
      model.toLowerCase().includes("gpt-image") ||
      providerId === "nara" ||
      providerId === "nararouter"
    ) {
      const naraBaseUrl = (
        process.env.NARA_ROUTER_BASE_URL?.trim() || "https://api-images.bynara.id"
      ).replace(/\/+$/, "");
      const naraApiKey = apiKey?.trim() || process.env.NARA_ROUTER_API_KEY?.trim();

      if (!naraApiKey) {
        return NextResponse.json(
          {
            success: false,
            error:
              "NARA_ROUTER_API_KEY environment variable is not configured and no API key was provided.",
          },
          { status: 400 }
        );
      }

      const res = await fetch(`${naraBaseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${naraApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-image-2",
          prompt: "A minimalist ping test dot",
          n: 1,
          size: "1024x1024",
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const latency = Date.now() - startTime;
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          `NaraRouter error (HTTP ${res.status} ${res.statusText})`;
        return NextResponse.json(
          { success: false, error: errorMsg, status: res.status, latency },
          { status: res.status }
        );
      }

      const imgUrl = data?.data?.[0]?.url || "(image generated)";
      return NextResponse.json({
        success: true,
        latency,
        reply: `NaraRouter gpt-image-2 connected successfully (${imgUrl})`,
        model: "gpt-image-2",
      });
    }

    // ========================================================
    // CASE A: Const (Built-in Managed)
    // ========================================================
    if (providerId === "const" || isBuiltinModel(model) || (!providerDocId && !baseUrl && !apiKey && !providerId)) {
      const constBaseUrl = (
        process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id"
      ).replace(/\/+$/, "");
      const constApiKey = process.env.CONST_ENGINE_API_KEY?.trim();
      if (!constApiKey) {
        return NextResponse.json(
          {
            success: false,
            error: "Server configuration error: CONST_ENGINE_API_KEY environment variable is not configured.",
          },
          { status: 500 }
        );
      }
      const mappedModel = normalizeConstModelName(model);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-disabled-guardrails": "vision-bridge",
        Authorization: `Bearer ${constApiKey}`,
      };

      // Const Search tests against /v1/search
      if (model === "const-search" || model === "Const Search" || mappedModel === "Const Search") {
        const res = await fetch(`${constBaseUrl}/v1/search`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: "ping test",
            num_results: 3,
            max_results: 3,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const latency = Date.now() - startTime;
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const errorMsg =
            data?.error?.message ||
            data?.message ||
            `Search upstream error (HTTP ${res.status} ${res.statusText})`;
          return NextResponse.json(
            { success: false, error: errorMsg, status: res.status, latency },
            { status: res.status }
          );
        }

        const count = Array.isArray(data?.results) ? data.results.length : 0;
        const providerName = "const-search";
        return NextResponse.json({
          success: true,
          latency,
          reply: `Search engine connected successfully (${providerName}: ${count} results)`,
          model: "const-search",
        });
      }

      // Whisper Large V3 Turbo tests against /v1/audio/transcriptions
      if (model.toLowerCase().includes("whisper") || mappedModel === "Whisper Large v3 Turbo") {
        const sampleRate = 8000;
        const numSamples = sampleRate * 1;
        const dataSize = numSamples * 2;
        const buffer = Buffer.alloc(44 + dataSize);
        buffer.write("RIFF", 0);
        buffer.writeUInt32LE(36 + dataSize, 4);
        buffer.write("WAVE", 8);
        buffer.write("fmt ", 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20);
        buffer.writeUInt16LE(1, 22);
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(sampleRate * 2, 28);
        buffer.writeUInt16LE(2, 32);
        buffer.writeUInt16LE(16, 34);
        buffer.write("data", 36);
        buffer.writeUInt32LE(dataSize, 40);

        const form = new FormData();
        form.append("file", new Blob([buffer], { type: "audio/wav" }), "ping.wav");
        form.append("model", "Whisper Large v3 Turbo");

        const authHeaders: Record<string, string> = {};
        if (constApiKey) authHeaders["Authorization"] = `Bearer ${constApiKey}`;

        const res = await fetch(`${constBaseUrl}/v1/audio/transcriptions`, {
          method: "POST",
          headers: authHeaders,
          body: form,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const latency = Date.now() - startTime;
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const errorMsg =
            data?.error?.message ||
            data?.message ||
            `Audio STT upstream error (HTTP ${res.status} ${res.statusText})`;
          return NextResponse.json(
            { success: false, error: errorMsg, status: res.status, latency },
            { status: res.status }
          );
        }

        return NextResponse.json({
          success: true,
          latency,
          reply: `Whisper audio transcription model is active and operational`,
          model: "whisper-large-v3-turbo",
        });
      }

      const res = await fetch(`${constBaseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: mappedModel,
          messages: [{ role: "user", content: "Ping! Please respond with 'OK'." }],
          max_tokens: 15,
          reasoning: "low",
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const latency = Date.now() - startTime;
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          `Upstream error (HTTP ${res.status} ${res.statusText})`;
        return NextResponse.json(
          { success: false, error: errorMsg, status: res.status, latency },
          { status: res.status }
        );
      }

      const reply = data?.choices?.[0]?.message?.content || "OK";
      return NextResponse.json({
        success: true,
        latency,
        reply: reply.trim(),
        model: data?.model || model,
      });
    }

    // ========================================================
    // CASE B: User BYOK or Custom Provider
    // ========================================================
    let activeApiKey = apiKey?.trim() || "";
    let activeBaseUrl = baseUrl?.trim()?.replace(/\/+$/, "") || "";
    let activeProtocol = protocol || "openai-compatible";
    let activeProviderId = providerId || "";

    // If providerDocId is given, fetch encrypted credentials safely from Convex
    if (providerDocId) {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!convexUrl) {
        return NextResponse.json(
          { success: false, error: "NEXT_PUBLIC_CONVEX_URL is not configured." },
          { status: 500 }
        );
      }

      const client = new ConvexHttpClient(convexUrl);
      client.setAuth(ssoToken);

      try {
        const creds = await client.query(api.router.providers.getProviderCredentials, {
          providerDocId: providerDocId as Id<"userProviders">,
        });

        if (creds) {
          activeApiKey = creds.apiKey || "";
          activeBaseUrl = creds.baseUrl?.replace(/\/+$/, "") || "";
          activeProtocol = creds.protocol || activeProtocol;
          activeProviderId = creds.providerId || activeProviderId;
        }
      } catch (convexErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: convexErr?.message || "Failed to load provider configuration from Convex.",
          },
          { status: 403 }
        );
      }
    }

    // Determine target URL and headers based on provider protocol
    // --------------------------------------------------------
    // 1. Anthropic Protocol
    // --------------------------------------------------------
    if (activeProtocol === "anthropic" || activeProviderId === "anthropic") {
      if (!activeApiKey) {
        return NextResponse.json(
          { success: false, error: "Anthropic API Key is required for testing." },
          { status: 400 }
        );
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": activeApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Ping! Please respond with 'OK'." }],
          max_tokens: 15,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const latency = Date.now() - startTime;
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          data?.error?.message || `Anthropic returned HTTP ${res.status}`;
        return NextResponse.json(
          { success: false, error: errorMsg, status: res.status, latency },
          { status: res.status }
        );
      }

      const reply = data?.content?.[0]?.text || "OK";
      return NextResponse.json({
        success: true,
        latency,
        reply: reply.trim(),
        model: data?.model || model,
      });
    }

    // --------------------------------------------------------
    // 2. Google AI Studio Protocol
    // --------------------------------------------------------
    if (activeProtocol === "google-ai" || activeProviderId === "google") {
      if (!activeApiKey) {
        return NextResponse.json(
          { success: false, error: "Google AI API Key is required for testing." },
          { status: 400 }
        );
      }

      const cleanModelId = model.replace(/^models\//, "");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelId}:generateContent?key=${activeApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Ping! Please respond with 'OK'." }] }],
            generationConfig: { maxOutputTokens: 15 },
          }),
          signal: controller.signal,
        }
      ).finally(() => clearTimeout(timeoutId));

      const latency = Date.now() - startTime;
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          data?.error?.message || `Google AI returned HTTP ${res.status}`;
        return NextResponse.json(
          { success: false, error: errorMsg, status: res.status, latency },
          { status: res.status }
        );
      }

      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "OK";
      return NextResponse.json({
        success: true,
        latency,
        reply: reply.trim(),
        model: cleanModelId,
      });
    }

    // --------------------------------------------------------
    // 3. OpenAI & OpenAI-Compatible (DeepSeek, Groq, Custom)
    // --------------------------------------------------------
    let targetBaseUrl = activeBaseUrl;
    if (activeProviderId === "openai") {
      targetBaseUrl = "https://api.openai.com/v1";
    } else if (activeProviderId === "deepseek") {
      targetBaseUrl = "https://api.deepseek.com";
    } else if (activeProviderId === "groq") {
      targetBaseUrl = "https://api.groq.com/openai/v1";
    }

    if (!targetBaseUrl) {
      return NextResponse.json(
        { success: false, error: "Provider base URL is missing." },
        { status: 400 }
      );
    }

    // Normalize endpoint URL for chat completions
    let endpoint = targetBaseUrl;
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
    if (activeApiKey && activeApiKey !== "no-key-required") {
      headers["Authorization"] = `Bearer ${activeApiKey}`;
    }

    // Handle max_tokens vs max_completion_tokens for reasoning models (e.g. o1/o3)
    const isReasoning = model.startsWith("o1") || model.startsWith("o3");
    const payloadBody: Record<string, any> = {
      model,
      messages: [{ role: "user", content: "Ping! Please respond with 'OK'." }],
    };
    if (isReasoning) {
      payloadBody.max_completion_tokens = 50;
    } else {
      payloadBody.max_tokens = 15;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payloadBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const latency = Date.now() - startTime;
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        `Upstream returned HTTP ${res.status}`;
      return NextResponse.json(
        { success: false, error: errorMsg, status: res.status, latency },
        { status: res.status }
      );
    }

    const reply = data?.choices?.[0]?.message?.content || "OK";
    return NextResponse.json({
      success: true,
      latency,
      reply: reply.trim(),
      model: data?.model || model,
    });
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? "Request timed out after 12 seconds."
          : error?.message || "Failed to test model connectivity.",
      },
      { status: 500 }
    );
  }
}
