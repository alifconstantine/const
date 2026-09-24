import type { ImageProvider, ImageModel, ImageProtocol } from "./types";
import { getActiveImageModel } from "./storage";

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
    if (cleanUrl.includes("openrouter.ai")) {
      return "https://openrouter.ai/api/v1/images";
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

    const b64 = sampleItem?.b64_json || sampleItem?.base64;
    const rawUrl = sampleItem?.url || sampleItem?.image_url || sampleItem?.image;

    const sampleUrl =
      typeof sampleItem === "string"
        ? sampleItem
        : rawUrl ||
          (b64
            ? b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`
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

export interface GenerateImageOptions {
  prompt: string;
  provider?: ImageProvider;
  modelId?: string;
  size?: string; // e.g. "1024x1024", "1024x1792", "1792x1024"
  n?: number;
  timeoutMs?: number;
}

export interface GenerateImageResult {
  success: boolean;
  imageUrl?: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Generates an image using the specified or currently active image provider and model.
 * Readily pluggable for Infographics, illustrations, and visual study artifacts.
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  const prompt = (options.prompt || "").trim();
  if (!prompt) {
    return { success: false, error: "Prompt is required to generate image." };
  }

  // Resolve provider and model from options or active configuration
  const active = getActiveImageModel();
  const provider = options.provider || active.provider;
  if (!provider) {
    return {
      success: false,
      error: "No image provider configured. Please configure an Image Provider in Settings > Models > Image.",
    };
  }

  const cleanBaseUrl = (provider.baseUrl || "").trim();
  if (!cleanBaseUrl) {
    return {
      success: false,
      error: `Provider "${provider.name}" has no Base URL configured.`,
    };
  }

  const modelId = options.modelId || active.model?.id || provider.models[0]?.id;
  if (!modelId) {
    return {
      success: false,
      error: `No model configured for provider "${provider.name}". Please add a Model ID in Settings > Models > Image.`,
    };
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

  if (protocol === "openrouter" || cleanBaseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://const.education";
    headers["X-Title"] = "Const Learn";
  }

  // Build body based on protocol
  let requestBody: Record<string, any>;
  if (protocol === "openrouter") {
    // OpenRouter images specification: { model, prompt }
    requestBody = {
      model: modelId,
      prompt,
    };
    if (options.size) {
      requestBody.size = options.size;
    }
  } else if (protocol === "custom") {
    requestBody = {
      model: modelId,
      prompt,
      n: options.n || 1,
    };
    if (options.size) {
      requestBody.size = options.size;
    }
  } else {
    // openai-generations
    requestBody = {
      model: modelId,
      prompt,
      n: options.n || 1,
      size: options.size || "1024x1024",
    };
  }

  const timeoutMs = options.timeoutMs || 60000; // 60s timeout for full generation
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
        `HTTP ${res.status}: ${res.statusText || "Image provider returned an error."}`;

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

    const b64 = sampleItem?.b64_json || sampleItem?.base64;
    const rawUrl = sampleItem?.url || sampleItem?.image_url || sampleItem?.image;

    const imageUrl =
      typeof sampleItem === "string"
        ? sampleItem
        : rawUrl ||
          (b64
            ? b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`
            : undefined);

    if (!imageUrl) {
      return {
        success: false,
        latencyMs,
        error: "Provider responded successfully but no image data or URL was found in response.",
      };
    }

    // Persist remote URLs as data URLs if accessible to avoid expiration
    let persistentImageUrl = imageUrl;
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      try {
        persistentImageUrl = await cacheImageUrlAsDataUrl(imageUrl);
      } catch {}
    }

    return {
      success: true,
      imageUrl: persistentImageUrl,
      latencyMs,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return {
      success: false,
      error: isTimeout
        ? `Image generation timed out after ${Math.round(timeoutMs / 1000)} seconds.`
        : err?.message || "Failed to communicate with image generation endpoint.",
    };
  }
}


/**
 * Converts a remote HTTP image URL into a persistent Base64 Data URL,
 * preventing temporary signed URLs (e.g. OpenAI/Azure 1hr expiry) from expiring.
 */
export async function cacheImageUrlAsDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === "string" ? reader.result : url);
      };
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
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
