import type { ImageProvider, ImageModel } from "./types";

export interface TestImageResult {
  success: boolean;
  latencyMs?: number;
  sampleUrl?: string;
  error?: string;
}

/**
 * Normalizes the image generation endpoint from a provider's base URL.
 */
export function resolveImageEndpoint(baseUrl: string): string {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, "");
  if (cleanUrl.endsWith("/images/generations")) {
    return cleanUrl;
  }
  if (cleanUrl.endsWith("/v1")) {
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

  const endpoint = resolveImageEndpoint(cleanBaseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const cleanKey = (provider.apiKey || "").trim();
  if (cleanKey) {
    headers["Authorization"] = cleanKey.startsWith("Bearer ") ? cleanKey : `Bearer ${cleanKey}`;
  }

  // Choose optimal size: 1024x1024 is the most universally accepted standard
  // across DALL-E 3, Flux, SDXL, and OpenRouter
  const testSize = "1024x1024";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for cold starts

  const start = performance.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: cleanModelId,
        prompt: "ping test minimalist dot",
        n: 1,
        size: testSize,
      }),
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

    const sampleItem = Array.isArray(data?.data) ? data.data[0] : null;
    const sampleUrl = sampleItem?.url || (sampleItem?.b64_json ? `data:image/png;base64,${sampleItem.b64_json}` : undefined);

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
  apiKey?: string
): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  try {
    const cleanUrl = baseUrl.trim().replace(/\/+$/, "");
    if (!cleanUrl) {
      return { success: false, error: "Base URL is required." };
    }

    // Try pinging /models or base endpoint
    const endpoint = cleanUrl.endsWith("/v1")
      ? `${cleanUrl}/models`
      : cleanUrl.includes("/v1/")
      ? cleanUrl
      : `${cleanUrl}/v1/models`;

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

