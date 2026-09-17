/**
 * Stream client for Const Learn Desktop.
 * Connects directly to Const Router AI Gateway (router.const.web.id)
 * with support for thinking process (reasoning_content), markdown output stream,
 * dynamic model fetching, and cancellation via AbortController.
 */

export interface DesktopModel {
  id: string;
  name: string;
  description: string;
  supportsThinking?: boolean;
}

export const DEFAULT_DESKTOP_MODELS: DesktopModel[] = [
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

  // When running in development (localhost) or in Electron renderer,
  // use Vite's dev proxy at relative "/v1" to avoid browser CORS restrictions
  if (typeof window !== "undefined") {
    const isDev = Boolean((import.meta as any).env?.DEV);
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const isDevPort = window.location.port === "3004" || window.location.port === "5173";

    if (isDev && (isLocalhost || isDevPort)) {
      return "/v1";
    }
  }

  return "https://router.const.web.id/v1";
}

/**
 * Fetch available models dynamically from Const Router or Electron agent.
 */
export async function fetchRouterModels(): Promise<DesktopModel[]> {
  const electron = typeof window !== "undefined" ? (window as any).electron : null;
  if (electron?.agent?.getModels) {
    try {
      const models = await electron.agent.getModels();
      if (Array.isArray(models) && models.length > 0) {
        return mapRouterModels(models);
      }
    } catch (err) {
      console.warn("Failed to fetch models from Electron IPC, trying router HTTP:", err);
    }
  }

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
      return DEFAULT_DESKTOP_MODELS;
    }

    const json = await res.json();
    if (json && Array.isArray(json.data) && json.data.length > 0) {
      return mapRouterModels(json.data);
    }
  } catch (err) {
    console.warn("Failed to fetch models from Const Router, using defaults:", err);
  }

  return DEFAULT_DESKTOP_MODELS;
}

function mapRouterModels(rawModels: any[]): DesktopModel[] {
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
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | any[] }>;
  signal?: AbortSignal;
  systemPrompt?: string;
  temperature?: number;
  onToken?: (token: string) => void;
  onThinking?: (thinking: string) => void;
  onDone?: (finalContent: string, finalThinking: string) => void;
  onError?: (error: Error) => void;
}

export async function streamChatCompletion({
  model,
  messages,
  signal,
  systemPrompt,
  temperature,
  onToken,
  onThinking,
  onDone,
  onError,
}: StreamChatParams): Promise<void> {
  const authToken =
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem("const_learn_auth_token") ||
        localStorage.getItem("const_sso_token"))) ||
    "";

  // 1. In Electron Desktop environment, route through Electron IPC isolated agent completion
  // This completely bypasses browser CORS/CSP restrictions, has access to ~/.const/learn/config.json,
  // and uses Node.js native fetch in the main process.
  const electron = typeof window !== "undefined" ? (window as any).electron : null;
  if (electron?.agent?.generateCompletion) {
    try {
      const activeModel =
        model ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("const_learn_active_model")) ||
        "gemini-3.8-flash";

      const requestId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      let unsubscribe: (() => void) | undefined;
      let streamedTokensCount = 0;

      if (electron.agent.onStudioToken) {
        unsubscribe = electron.agent.onStudioToken((data: { requestId: string; token: string }) => {
          if (data.requestId === requestId && data.token) {
            streamedTokensCount++;
            onToken?.(data.token);
          }
        });
      }

      const res = await electron.agent.generateCompletion({
        messages: [
          {
            role: "system",
            content: systemPrompt || SOCRATIC_LEARNING_SYSTEM_PROMPT,
          },
          ...messages.map((m) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          })),
        ],
        model: activeModel,
        authToken: authToken || undefined,
        temperature: temperature ?? 0.3,
        timeoutMs: 180000,
        requestId,
      });

      unsubscribe?.();

      if (res?.success && res.content) {
        const fullContent = res.content;
        // If tokens were not streamed in real-time (e.g. older runtime), emit progressive chunks
        if (streamedTokensCount === 0) {
          const chunkSize = 24;
          for (let i = 0; i < fullContent.length; i += chunkSize) {
            if (signal?.aborted) break;
            const chunk = fullContent.slice(i, i + chunkSize);
            onToken?.(chunk);
            await new Promise((resolve) => setTimeout(resolve, 8));
          }
        }
        onDone?.(fullContent, "");
        return;
      } else {
        throw new Error(res?.error || "Gagal menghasilkan respon AI.");
      }
    } catch (ipcErr: any) {
      if (signal?.aborted || ipcErr.name === "AbortError") {
        onDone?.("", "");
        return;
      }
      console.warn("[ai-stream] Electron IPC completion failed, trying HTTP fallback:", ipcErr);
      // If we are in Electron and IPC failed, report error via onError without double-throw
      if (onError) {
        onError(ipcErr);
        return;
      }
      throw ipcErr;
    }
  }

  // 2. HTTP Gateway fallback (Web browser environment or external network)
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
        content: systemPrompt || SOCRATIC_LEARNING_SYSTEM_PROMPT,
      },
      ...messages,
    ],
    temperature: temperature ?? 0.7,
    stream: true,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };

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
    const res = await executeFetch(endpoint);

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

          if (delta.reasoning_content) {
            accumulatedThinking += delta.reasoning_content;
            onThinking?.(delta.reasoning_content);
          }

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
    if (onError) {
      onError(err);
      return;
    }
    throw err;
  }
}
