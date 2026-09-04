import { NextRequest, NextResponse } from "next/server";
import {
  formatContextWindow,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_OUTPUT,
  DEFAULT_INPUT_TYPES,
  DEFAULT_OUTPUT_TYPES,
} from "@/lib/model-specs";

export interface ModelDescriptor {
  modelId: string;
  name: string;
  contextWindow: string;
  maxOutputTokens?: string;
  inputTypes?: string[];
  outputTypes?: string[];
  enabled: boolean;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Session verification
    const ssoToken =
      req.cookies.get("const_sso_token")?.value ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!ssoToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active Const session required." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { providerId, apiKey, baseUrl } = body;

    if (!providerId) {
      return NextResponse.json(
        { success: false, error: "Missing providerId parameter." },
        { status: 400 }
      );
    }

    const cleanKey = typeof apiKey === "string" ? apiKey.trim() : "";
    const cleanUrl = typeof baseUrl === "string" ? baseUrl.trim().replace(/\/+$/, "") : "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let models: ModelDescriptor[] = [];

    // ==========================================
    // 1. OPENAI
    // ==========================================
    if (providerId === "openai") {
      if (!cleanKey) {
        return NextResponse.json({ success: false, error: "OpenAI API Key is required." }, { status: 400 });
      }

      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${cleanKey}` },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return NextResponse.json(
          { success: false, error: err?.error?.message || `OpenAI returned status ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const rawList: Array<{ id: string }> = Array.isArray(data?.data) ? data.data : [];

      // Filter relevant text / chat / reasoning models
      const relevant = rawList
        .filter(
          (m) =>
            m.id.startsWith("gpt-") ||
            m.id.startsWith("o1") ||
            m.id.startsWith("o3") ||
            m.id.startsWith("o4") ||
            m.id.startsWith("chatgpt-")
        )
        .sort((a, b) => {
          const aPriority = a.id.includes("4o") || a.id.startsWith("o1") || a.id.startsWith("o3") ? 1 : 0;
          const bPriority = b.id.includes("4o") || b.id.startsWith("o1") || b.id.startsWith("o3") ? 1 : 0;
          return bPriority - aPriority;
        });

      models = relevant.map((m) => ({
        modelId: m.id,
        name: m.id,
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: DEFAULT_MAX_OUTPUT,
        inputTypes: m.id.includes("4o") || m.id.includes("vision") ? ["text", "image"] : ["text"],
        outputTypes: ["text"],
        enabled: true,
      }));
    }

    // ==========================================
    // 2. GROQ
    // ==========================================
    else if (providerId === "groq") {
      if (!cleanKey) {
        return NextResponse.json({ success: false, error: "Groq API Key is required." }, { status: 400 });
      }

      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${cleanKey}` },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return NextResponse.json(
          { success: false, error: err?.error?.message || `Groq returned status ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const rawList: Array<{ id: string; context_window?: number }> = Array.isArray(data?.data) ? data.data : [];

      models = rawList.map((m) => ({
        modelId: m.id,
        name: m.id,
        contextWindow: m.context_window ? String(m.context_window) : DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: DEFAULT_MAX_OUTPUT,
        inputTypes: m.id.includes("vision") ? ["text", "image"] : ["text"],
        outputTypes: ["text"],
        enabled: true,
      }));
    }

    // ==========================================
    // 3. DEEPSEEK
    // ==========================================
    else if (providerId === "deepseek") {
      if (!cleanKey) {
        return NextResponse.json({ success: false, error: "DeepSeek API Key is required." }, { status: 400 });
      }

      const res = await fetch("https://api.deepseek.com/models", {
        headers: { Authorization: `Bearer ${cleanKey}` },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return NextResponse.json(
          { success: false, error: err?.error?.message || `DeepSeek returned status ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const rawList: Array<{ id: string }> = Array.isArray(data?.data) ? data.data : [];

      models = rawList.map((m) => ({
        modelId: m.id,
        name: m.id,
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: DEFAULT_MAX_OUTPUT,
        inputTypes: ["text"],
        outputTypes: ["text"],
        enabled: true,
      }));

      // Fallback if empty array returned from API
      if (models.length === 0) {
        models = [
          {
            modelId: "deepseek-chat",
            name: "deepseek-chat",
            contextWindow: DEFAULT_CONTEXT_WINDOW,
            maxOutputTokens: DEFAULT_MAX_OUTPUT,
            inputTypes: ["text"],
            outputTypes: ["text"],
            enabled: true,
          },
          {
            modelId: "deepseek-reasoner",
            name: "deepseek-reasoner",
            contextWindow: DEFAULT_CONTEXT_WINDOW,
            maxOutputTokens: DEFAULT_MAX_OUTPUT,
            inputTypes: ["text"],
            outputTypes: ["text"],
            enabled: true,
          },
        ];
      }
    }

    // ==========================================
    // 4. GOOGLE AI STUDIO
    // ==========================================
    else if (providerId === "google") {
      if (!cleanKey) {
        return NextResponse.json({ success: false, error: "Google AI API Key is required." }, { status: 400 });
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`,
        { signal: controller.signal }
      ).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return NextResponse.json(
          { success: false, error: err?.error?.message || `Google AI returned status ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const rawList: Array<{
        name: string;
        displayName?: string;
        inputTokenLimit?: number;
        outputTokenLimit?: number;
      }> = Array.isArray(data?.models) ? data.models : [];

      models = rawList
        .filter((m) => m.name.includes("gemini"))
        .map((m) => {
          const cleanId = m.name.replace(/^models\//, "");
          return {
            modelId: cleanId,
            name: m.displayName || cleanId,
            contextWindow: m.inputTokenLimit ? String(m.inputTokenLimit) : DEFAULT_CONTEXT_WINDOW,
            maxOutputTokens: m.outputTokenLimit ? String(m.outputTokenLimit) : DEFAULT_MAX_OUTPUT,
            inputTypes: ["text", "image", "video"],
            outputTypes: ["text"],
            enabled: true,
          };
        });
    }

    // ==========================================
    // 5. ANTHROPIC
    // ==========================================
    else if (providerId === "anthropic") {
      if (!cleanKey) {
        return NextResponse.json({ success: false, error: "Anthropic API Key is required." }, { status: 400 });
      }

      let verified = false;
      try {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": cleanKey,
            "anthropic-version": "2023-06-01",
          },
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (Array.isArray(data?.data) && data.data.length > 0) {
            verified = true;
            models = data.data.map((m: { id: string; display_name?: string }) => ({
              modelId: m.id,
              name: m.display_name || m.id,
              contextWindow: DEFAULT_CONTEXT_WINDOW,
              maxOutputTokens: DEFAULT_MAX_OUTPUT,
              inputTypes: ["text", "image"],
              outputTypes: ["text"],
              enabled: true,
            }));
          }
        }
      } catch {}

      if (!verified || models.length === 0) {
        // Direct list if endpoint not accessible
        const fallbacks = [
          "claude-3-7-sonnet-latest",
          "claude-3-5-sonnet-latest",
          "claude-3-5-haiku-latest",
          "claude-3-opus-latest",
        ];
        models = fallbacks.map((id) => ({
          modelId: id,
          name: id,
          contextWindow: DEFAULT_CONTEXT_WINDOW,
          maxOutputTokens: DEFAULT_MAX_OUTPUT,
          inputTypes: ["text", "image"],
          outputTypes: ["text"],
          enabled: true,
        }));
      }
    }

    // ==========================================
    // 6. CUSTOM / OPENAI-COMPATIBLE
    // ==========================================
    else {
      if (!cleanUrl) {
        return NextResponse.json({ success: false, error: "Base URL is required for custom providers." }, { status: 400 });
      }

      const headers: Record<string, string> = {};
      if (cleanKey) {
        headers["Authorization"] = `Bearer ${cleanKey}`;
      }

      const candidateUrls = [
        cleanUrl.endsWith("/v1") ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`,
        `${cleanUrl}/models`,
        `${cleanUrl}/api/tags`, // Ollama native
      ];

      let lastError = "Could not fetch models from the provided base URL.";
      let fetched = false;

      for (const targetUrl of candidateUrls) {
        try {
          const res = await fetch(targetUrl, {
            headers,
            signal: controller.signal,
          });

          if (res.ok) {
            const data = await res.json().catch(() => null);

            // Standard OpenAI format: { data: [{ id: "..." }] }
            if (Array.isArray(data?.data)) {
              models = data.data.map((m: any) => {
                const id = m.id || m.name;
                return {
                  modelId: id,
                  name: id,
                  contextWindow: m.context_window ? String(m.context_window) : DEFAULT_CONTEXT_WINDOW,
                  maxOutputTokens: DEFAULT_MAX_OUTPUT,
                  inputTypes: ["text"],
                  outputTypes: ["text"],
                  enabled: true,
                };
              });
              fetched = true;
              break;
            }

            // Ollama format: { models: [{ name: "..." }] }
            if (Array.isArray(data?.models)) {
              models = data.models.map((m: any) => {
                const id = m.name || m.model;
                return {
                  modelId: id,
                  name: id,
                  contextWindow: DEFAULT_CONTEXT_WINDOW,
                  maxOutputTokens: DEFAULT_MAX_OUTPUT,
                  inputTypes: ["text"],
                  outputTypes: ["text"],
                  enabled: true,
                };
              });
              fetched = true;
              break;
            }
          } else {
            lastError = `Upstream returned status ${res.status} from ${targetUrl}`;
          }
        } catch (e: any) {
          lastError = e?.message || lastError;
        }
      }

      if (!fetched || models.length === 0) {
        return NextResponse.json({
          success: true,
          models: [],
          warning: `Automatic model listing was not available (${lastError}). You can manually specify models to import.`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      providerId,
      totalFound: models.length,
      models,
    });
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? "Request timed out while connecting to the provider."
          : error?.message || "Failed to reach provider endpoint.",
      },
      { status: 500 }
    );
  }
}
