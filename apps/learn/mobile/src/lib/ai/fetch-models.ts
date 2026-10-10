import type { AiModel } from "./types";

/**
 * Live-fetches available models from an OpenAI-compatible or Const Router endpoint.
 */
export async function fetchRemoteModels(
  baseUrl: string,
  apiKey?: string
): Promise<{ success: boolean; models?: AiModel[]; error?: string }> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, "");
    const endpoint = cleanUrl.endsWith("/models") ? cleanUrl : `${cleanUrl}/models`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const cleanKey = (apiKey || "").trim();
    if (cleanKey) {
      headers["Authorization"] = cleanKey.startsWith("Bearer ") ? cleanKey : `Bearer ${cleanKey}`;
    }

    const res = await fetch(endpoint, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        success: false,
        error: `HTTP ${res.status}: ${errText || res.statusText}`,
      };
    }

    const data = await res.json();
    const rawList: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
      ? data.models
      : [];

    if (rawList.length === 0) {
      return {
        success: false,
        error: "No models returned by the provider endpoint.",
      };
    }

    const mapped: AiModel[] = rawList
      .filter((item) => {
        if (!item || (!item.id && !item.name)) return false;
        const id = String(item.id || item.name).toLowerCase().trim();
        const name = String(item.name || item.id).toLowerCase().trim();
        if (id === "const-search" || name === "const search" || id.includes("whisper") || id.includes("transcription")) {
          return false;
        }
        if (item.type === "search" || item.category === "search" || item.type === "audio" || item.category === "stt") {
          return false;
        }
        if (item.endpoint === "/v1/search" || item.endpoint === "/v1/audio/transcriptions") {
          return false;
        }
        return true;
      })
      .map((item) => {
        const id = String(item.id || item.name);
        const name = String(item.name || item.id);
        const contextWindow =
          item.context_window ||
          item.contextWindow ||
          item.max_context_tokens ||
          (id.includes("gemini") ? "1M" : id.includes("claude") ? "200K" : id.includes("gpt") ? "128K" : "64K");
        const maxOutputTokens =
          item.max_output_tokens ||
          item.maxTokens ||
          (id.includes("gemini") ? "128K" : "16K");
        const supportsThinking =
          Boolean(item.supports_thinking || item.supportsThinking) ||
          id.includes("reasoner") ||
          id.includes("o1") ||
          id.includes("o3") ||
          id.includes("thinking") ||
          (id.includes("gemini-3") && !id.includes("flash-lite"));

        return {
          id,
          name,
          contextWindow: String(contextWindow),
          maxOutputTokens: String(maxOutputTokens),
          description: item.description || undefined,
          supportsThinking,
        };
      });

    return {
      success: true,
      models: mapped,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to fetch models from endpoint.",
    };
  }
}

/**
 * Test connectivity and measure latency to a provider endpoint.
 */
export async function testProviderConnection(
  baseUrl: string,
  apiKey?: string
): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, "");
    const endpoint = cleanUrl.endsWith("/models") ? cleanUrl : `${cleanUrl}/models`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const cleanKey = (apiKey || "").trim();
    if (cleanKey) {
      headers["Authorization"] = cleanKey.startsWith("Bearer ") ? cleanKey : `Bearer ${cleanKey}`;
    }

    const start = performance.now();
    const res = await fetch(endpoint, {
      method: "GET",
      headers,
    });
    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      return { success: true, latencyMs };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        latencyMs,
        error: `HTTP ${res.status}: Invalid or missing API key`,
      };
    }

    const errText = await res.text().catch(() => "");
    return {
      success: false,
      latencyMs,
      error: `HTTP ${res.status}: ${errText || res.statusText}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to reach provider endpoint.",
    };
  }
}
