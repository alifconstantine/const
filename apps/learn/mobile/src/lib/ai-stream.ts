/**
 * Stream client for Const Learn Mobile.
 * Connects directly to Const Router AI Gateway (router.const.web.id)
 * with support for thinking process (reasoning_content), markdown output stream,
 * dynamic model fetching, and cancellation via AbortController.
 */

export interface MobileModel {
  id: string;
  name: string;
  description: string;
  supportsThinking?: boolean;
}

export const DEFAULT_MOBILE_MODELS: MobileModel[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    description: "Fast reasoning & deep thinking tutor (Recommended)",
    supportsThinking: true,
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    description: "High capability multimodal flash model",
    supportsThinking: true,
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    description: "Smart dynamic routing for best quality",
    supportsThinking: true,
  },
  {
    id: "combo/fast",
    name: "combo/fast",
    description: "Ultra-low latency quick responses",
    supportsThinking: false,
  },
  {
    id: "combo/coding",
    name: "combo/coding",
    description: "Specialized code reasoning & analysis",
    supportsThinking: true,
  },
];

export const SOCRATIC_LEARNING_SYSTEM_PROMPT = `You are Const Learn AI Tutor — an exceptional Socratic educational companion and research mentor.
Your role is to help the user understand concepts deeply, explore hypotheses, break down complex topics, and learn effectively.

Guidelines:
- Explain concepts with clarity, vivid analogies, and structured breakdowns.
- When explaining complex ideas, foster active learning by guiding the student step-by-step.
- Format responses cleanly using GitHub-Flavored Markdown (headers, bullet points, numbered steps, code blocks with language identifiers).
- Keep text well-spaced and readable on mobile devices.
- Maintain a thoughtful, supportive, and intellectually stimulating tone.
- Respond in the language used by the user (Indonesian or English).`;

/**
 * Resolves the router base URL.
 * In browser development (localhost), uses relative "/v1" to route through Vite's dev proxy
 * and avoid browser CORS restrictions.
 */
export function getRouterBaseUrl(): string {
  const envBaseUrl =
    (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.VITE_CONST_ENGINE_BASE_URL;

  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, "");
  }

  // When running locally in browser, use Vite's dev proxy at /v1
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "/v1";
  }

  return "https://router.const.web.id/v1";
}

/**
 * Fetch available models dynamically from Const Router, matching apps/harness behavior.
 */
export async function fetchRouterModels(): Promise<MobileModel[]> {
  try {
    const baseUrl = getRouterBaseUrl();
    const endpoint = baseUrl.endsWith("/models") ? baseUrl : `${baseUrl}/models`;
    const authToken =
      localStorage.getItem("const_learn_auth_token") ||
      localStorage.getItem("const_sso_token") ||
      "";

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });

    if (!res.ok) {
      // Fallback: If relative /v1 failed, try direct router URL
      if (baseUrl === "/v1") {
        const directRes = await fetch("https://router.const.web.id/v1/models", {
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
        });
        if (directRes.ok) {
          const directJson = await directRes.json();
          if (directJson?.data && Array.isArray(directJson.data) && directJson.data.length > 0) {
            return mapRouterModels(directJson.data);
          }
        }
      }
      return DEFAULT_MOBILE_MODELS;
    }

    const json = await res.json();
    if (json && Array.isArray(json.data) && json.data.length > 0) {
      return mapRouterModels(json.data);
    }
  } catch (err) {
    console.warn("Failed to fetch models from Const Router, using defaults:", err);
  }

  return DEFAULT_MOBILE_MODELS;
}

function mapRouterModels(rawModels: any[]): MobileModel[] {
  return rawModels.map((m: any) => {
    const supportsThinking = Boolean(
      m.supports_thinking || m.supportsThinking || m.supports_reasoning
    );
    let desc = "Standard inference model";
    if (supportsThinking) {
      desc = "Fast reasoning & deep thinking tutor";
    } else if (m.id === "combo/fast") {
      desc = "Ultra-low latency quick responses";
    }

    return {
      id: m.id,
      name: m.display_name || m.name || m.id,
      description: desc,
      supportsThinking,
    };
  });
}

export interface StreamChatParams {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  onThinking?: (thinking: string) => void;
  onDone?: (finalContent: string, finalThinking: string) => void;
  onError?: (error: Error) => void;
}

export async function streamChatCompletion({
  model,
  messages,
  signal,
  onToken,
  onThinking,
  onDone,
  onError,
}: StreamChatParams): Promise<void> {
  const authToken =
    localStorage.getItem("const_learn_auth_token") ||
    localStorage.getItem("const_sso_token") ||
    "";

  const apiKey =
    authToken ||
    (import.meta as any).env?.VITE_CONST_ROUTER_API_KEY ||
    (import.meta as any).env?.VITE_CONST_ENGINE_API_KEY ||
    "";

  const payload = {
    model,
    messages: [
      {
        role: "system",
        content: SOCRATIC_LEARNING_SYSTEM_PROMPT,
      },
      ...messages,
    ],
    stream: true,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };

  // Determine endpoint: start with getRouterBaseUrl()
  const baseUrl = getRouterBaseUrl();
  let endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  let accumulatedContent = "";
  let accumulatedThinking = "";

  const executeFetch = async (targetEndpoint: string) => {
    return await fetch(targetEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  };

  try {
    let res: Response;
    try {
      res = await executeFetch(endpoint);
    } catch (fetchErr: any) {
      // If relative proxy failed or direct failed, attempt fallback between /v1 and direct URL
      if (baseUrl === "/v1") {
        endpoint = "https://router.const.web.id/v1/chat/completions";
        res = await executeFetch(endpoint);
      } else {
        endpoint = "/v1/chat/completions";
        res = await executeFetch(endpoint);
      }
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      let parsedMessage = errorBody;
      try {
        const errJson = JSON.parse(errorBody);
        if (errJson.error?.message) {
          parsedMessage = errJson.error.message;
        }
      } catch {}
      throw new Error(`HTTP ${res.status}: ${parsedMessage || res.statusText}`);
    }

    if (!res.body) {
      throw new Error("Response body is null");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;

          // Process thinking / reasoning tokens
          if (delta.reasoning_content) {
            accumulatedThinking += delta.reasoning_content;
            onThinking?.(delta.reasoning_content);
          }

          // Process final content tokens
          if (delta.content) {
            accumulatedContent += delta.content;
            onToken?.(delta.content);
          }
        } catch {
          // ignore partial JSON parse errors
        }
      }
    }

    onDone?.(accumulatedContent, accumulatedThinking);
  } catch (err: any) {
    if (err.name === "AbortError") {
      onDone?.(accumulatedContent, accumulatedThinking);
      return;
    }
    onError?.(err);
    throw err;
  }
}
