/**
 * Const Router Whisper Speech-to-Text Client
 * Routes audio transcription requests through Const Router AI Gateway (/v1/audio/transcriptions)
 * powered by Const Engine with weekly quota management and telemetry.
 */

export interface TranscribeAudioOptions {
  audioBlob: Blob;
  language?: string; // 'id' | 'en' | 'auto'
  prompt?: string;
  model?: "whisper-large-v3-turbo" | "whisper-large-v3" | string;
  apiKey?: string;
  routerBaseUrl?: string;
}

export interface TranscribeAudioResult {
  text: string;
}

/**
 * Resolves the active Const Router base URL.
 * In dev: uses Vite proxy '/v1'
 * In prod: uses 'https://router.const.web.id/v1' or custom env URL
 */
export function getRouterBaseUrl(): string {
  const envBaseUrl =
    (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.VITE_CONST_ENGINE_BASE_URL;

  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, "");
  }

  // When running locally in browser dev server, use Vite's dev proxy at /v1
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
 * Resolves user SSO token or API key from localStorage or env.
 */
export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("const_learn_auth_token") ||
    localStorage.getItem("const_sso_token") ||
    localStorage.getItem("const_auth_token") ||
    (import.meta as any).env?.VITE_CONST_ROUTER_API_KEY ||
    (import.meta as any).env?.VITE_CONST_ENGINE_API_KEY ||
    ""
  );
}

/**
 * Transcribes an audio blob using Const Router's OpenAI-compatible /v1/audio/transcriptions endpoint.
 * Gracefully falls back to direct URL or custom Groq key if configured.
 */
export async function transcribeAudio({
  audioBlob,
  language = "id",
  prompt,
  model = "whisper-large-v3-turbo",
  apiKey,
  routerBaseUrl,
}: TranscribeAudioOptions): Promise<TranscribeAudioResult> {
  // Determine appropriate filename & extension based on MIME type
  let filename = "recording.webm";
  const mimeType = audioBlob.type || "audio/webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    filename = "recording.m4a";
  } else if (mimeType.includes("wav")) {
    filename = "recording.wav";
  } else if (mimeType.includes("ogg")) {
    filename = "recording.ogg";
  } else if (mimeType.includes("mp3")) {
    filename = "recording.mp3";
  }

  const audioFile = new File([audioBlob], filename, { type: mimeType });

  const buildFormData = () => {
    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("model", model);
    formData.append("response_format", "json");
    formData.append("temperature", "0");

    if (language && language !== "auto") {
      const langCode = language.startsWith("en") ? "en" : "id";
      formData.append("language", langCode);
    }

    if (prompt) {
      formData.append("prompt", prompt);
    }
    return formData;
  };

  // If user explicitly provided a Groq API key (starts with 'gsk_'), route directly to Groq Cloud
  if (apiKey && apiKey.startsWith("gsk_")) {
    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: buildFormData(),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      throw new Error(err || `Groq Whisper API error (HTTP ${groqRes.status})`);
    }

    const groqData = await groqRes.json();
    return { text: (groqData.text || "").trim() };
  }

  // 1. Primary: Route via Const Router Gateway (/v1/audio/transcriptions)
  const baseUrl = (routerBaseUrl || getRouterBaseUrl()).replace(/\/+$/, "");
  const endpoint = `${baseUrl}/audio/transcriptions`;
  const token = apiKey || getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-Const-SSO-Token"] = token;
  }

  const doFetch = async (targetUrl: string) => {
    return await fetch(targetUrl, {
      method: "POST",
      headers,
      body: buildFormData(),
    });
  };

  let response: Response;
  try {
    response = await doFetch(endpoint);
  } catch (networkErr) {
    // If local proxy failed, try direct production Const Router endpoint
    if (baseUrl === "/v1") {
      try {
        response = await doFetch("https://router.const.web.id/v1/audio/transcriptions");
      } catch {
        throw networkErr;
      }
    } else {
      throw networkErr;
    }
  }

  if (!response.ok) {
    // Optional fallback to Groq if VITE_GROQ_API_KEY is configured in env
    const fallbackGroqKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
    if (fallbackGroqKey && typeof fallbackGroqKey === "string" && fallbackGroqKey.trim()) {
      try {
        const groqFallbackRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${fallbackGroqKey.trim()}` },
          body: buildFormData(),
        });
        if (groqFallbackRes.ok) {
          const fallbackData = await groqFallbackRes.json();
          return { text: (fallbackData.text || "").trim() };
        }
      } catch (fallbackErr) {
        console.warn("[Voice Transcription] Groq fallback failed:", fallbackErr);
      }
    }

    let errorDetails = "";
    try {
      const errJson = await response.json();
      errorDetails = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(errorDetails || `Const Router Whisper error (HTTP ${response.status})`);
  }

  const data = await response.json();
  return {
    text: (data.text || "").trim(),
  };
}

// Aliases for backwards compatibility
export const transcribeAudioWithConstRouter = transcribeAudio;
export const transcribeAudioWithGroq = transcribeAudio;
