import type { ImageProvider, ImageModel, ImageProtocol } from "./types";

export interface TestImageResult {
  success: boolean;
  latencyMs?: number;
  sampleUrl?: string;
  error?: string;
}

/**
 * Normalizes the image generation endpoint based on the provider's base URL and API protocol.
 * - openrouter: POST /api/v1/images
 * - openai-generations: POST /v1/images/generations
 * - custom: direct URL
 */
export function resolveImageEndpoint(baseUrl: string, protocol?: ImageProtocol): string {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, "");
  if (!cleanUrl) return "";

  if (protocol === "custom") {
    return cleanUrl;
  }

  if (protocol === "openrouter") {
    if (cleanUrl.endsWith("/images")) {
      return cleanUrl;
    }
    if (cleanUrl.endsWith("/api/v1") || cleanUrl.endsWith("/v1")) {
      return `${cleanUrl}/images`;
    }
    if (cleanUrl === "https://openrouter.ai" || cleanUrl === "http://openrouter.ai") {
      return `${cleanUrl}/api/v1/images`;
    }
    if (cleanUrl.endsWith("/images/generations")) {
      return cleanUrl.replace(/\/images\/generations$/, "/images");
    }
    return `${cleanUrl}/images`;
  }

  // Default: openai-generations
  if (cleanUrl.endsWith("/images/generations")) {
    return cleanUrl;
  }
  if (cleanUrl.endsWith("/v1")) {
    return `${cleanUrl}/images/generations`;
  }
  if (cleanUrl.includes("/v1/")) {
    return `${cleanUrl}/images/generations`;
  }
  return `${cleanUrl}/v1/images/generations`;
}

/**
 * Test a specific Image Model by sending a minimal generation ping,
 * measuring latency, and validating provider responsiveness.
 * Follows the same operational test UX as apps/router.
 */
export async function testImageModelConnectivity(
  provider: ImageProvider,
  modelId: string
): Promise<TestImageResult> {
  const cleanBaseUrl = (provider.baseUrl || "").trim();
  if (!cleanBaseUrl) {
    return { success: false, error: "Base URL is required to test model." };
  }

  const cleanModelId = modelId.trim();
  if (!cleanModelId) {
    return { success: false, error: "Model ID is required." };
  }

  const protocol: ImageProtocol = provider.protocol || "openrouter";
  const endpoint = resolveImageEndpoint(cleanBaseUrl, protocol);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const cleanKey = (provider.apiKey || "").trim();
  if (cleanKey) {
    headers["Authorization"] = cleanKey.startsWith("Bearer ") ? cleanKey : `Bearer ${cleanKey}`;
  }

  // OpenRouter recommended headers for analytics and routing
  if (protocol === "openrouter" || cleanBaseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://const.education";
    headers["X-Title"] = "Const Learn";
  }

  // Protocol-tailored body payload
  let requestBody: Record<string, any>;
  if (protocol === "openrouter") {
    // OpenRouter images specification uses { model, prompt }
    requestBody = {
      model: cleanModelId,
      prompt: "ping test minimalist dot",
    };
  } else if (protocol === "custom") {
    requestBody = {
      model: cleanModelId,
      prompt: "ping test minimalist dot",
      n: 1,
    };
  } else {
    // Standard OpenAI image generations
    requestBody = {
      model: cleanModelId,
      prompt: "ping test minimalist dot",
      n: 1,
      size: "1024x1024",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for cold starts

  const start = performance.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const latencyMs = Math.round(performance.now() - start);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        `HTTP ${res.status}: ${res.statusText || "Upstream image provider returned an error."}`;

      return {
        success: false,
        latencyMs,
        error: typeof errorMsg === "object" ? JSON.stringify(errorMsg) : String(errorMsg),
      };
    }

    const sampleItem = Array.isArray(data?.data)
      ? data.data[0]
      : Array.isArray(data?.images)
      ? data.images[0]
      : null;

    const sampleUrl =
      typeof sampleItem === "string"
        ? sampleItem
        : sampleItem?.url ||
          (sampleItem?.b64_json
            ? `data:image/png;base64,${sampleItem.b64_json}`
            : undefined);

    return {
      success: true,
      latencyMs,
      sampleUrl,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return {
      success: false,
      error: isTimeout
        ? "Request timed out after 25 seconds."
        : err?.message || "Failed to communicate with image generation endpoint.",
    };
  }
}

/**
 * Tests basic endpoint connectivity without generating an image.
 */
export async function testImageProviderConnection(
  baseUrl: string,
  apiKey?: string,
  protocol?: ImageProtocol
): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  try {
    const cleanUrl = baseUrl.trim().replace(/\/+$/, "");
    if (!cleanUrl) {
      return { success: false, error: "Base URL is required." };
    }

    // Ping endpoint determination based on protocol
    let endpoint: string;
    if (protocol === "openrouter" || cleanUrl.includes("openrouter.ai")) {
      endpoint = cleanUrl.endsWith("/api/v1") ? `${cleanUrl}/models` : "https://openrouter.ai/api/v1/models";
    } else if (cleanUrl.endsWith("/v1")) {
      endpoint = `${cleanUrl}/models`;
    } else if (cleanUrl.includes("/v1/")) {
      endpoint = cleanUrl;
    } else {
      endpoint = `${cleanUrl}/v1/models`;
    }

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

    if (res.ok || res.status === 405 || res.status === 400) {
      // 405 Method Not Allowed on GET to a POST endpoint still confirms server is alive
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

/**
 * Fetch remote image models if provider supports standard /models discovery.
 */
export async function fetchRemoteImageModels(
  baseUrl: string,
  apiKey?: string,
  protocol?: ImageProtocol
): Promise<{ success: boolean; models?: ImageModel[]; error?: string }> {
  try {
    const cleanUrl = baseUrl.trim().replace(/\/+$/, "");
    let endpoint: string;

    if (protocol === "openrouter" || cleanUrl.includes("openrouter.ai")) {
      endpoint = cleanUrl.endsWith("/api/v1") ? `${cleanUrl}/models` : "https://openrouter.ai/api/v1/models";
    } else if (cleanUrl.endsWith("/models")) {
      endpoint = cleanUrl;
    } else if (cleanUrl.endsWith("/v1")) {
      endpoint = `${cleanUrl}/models`;
    } else {
      endpoint = `${cleanUrl}/v1/models`;
    }

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

    // Filter models that relate to image generation
    const imageKeywords = [
      "image",
      "flux",
      "dall-e",
      "recraft",
      "sdxl",
      "diffusion",
      "stable",
      "imagen",
      "midjourney",
      "journey",
      "ideogram",
      "sunburst",
    ];

    const filtered = rawList.filter((item) => {
      const id = String(item.id || item.name || "").toLowerCase();
      const modality = String(item.architecture?.modality || "").toLowerCase();
      const outputModalities = Array.isArray(item.output_modalities)
        ? item.output_modalities.map(String)
        : [];

      return (
        modality.includes("image") ||
        outputModalities.includes("image") ||
        imageKeywords.some((kw) => id.includes(kw))
      );
    });

    const listToMap = filtered.length > 0 ? filtered : rawList;
    const mapped: ImageModel[] = listToMap
      .filter((item) => item && (item.id || item.name))
      .map((item) => ({
        id: String(item.id || item.name),
        name: String(item.name || item.id),
        description: item.description || undefined,
      }));

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
