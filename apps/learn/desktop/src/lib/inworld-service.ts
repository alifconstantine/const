/**
 * Inworld TTS Client Service & Utilities
 * Grounded on official documentation: https://docs.inworld.ai/llms.txt
 */

export const INWORLD_BASE_URL = "https://api.inworld.ai";

export interface InworldModelOption {
  id: string;
  name: string;
  badge: string;
  descEn: string;
  descId: string;
  latency: string;
  languages: string;
  recommended?: boolean;
}

export const INWORLD_TTS_MODELS: InworldModelOption[] = [
  {
    id: "inworld-tts-2",
    name: "Inworld TTS-2",
    badge: "Flagship",
    descEn: "Top-tier quality with natural language steering and strongest multilingual performance (200+ languages).",
    descId: "Model flagship dengan kendali ekspresi natural language steering dan kualitas audio tertinggi (200+ bahasa).",
    latency: "~100ms TTFB",
    languages: "200+ Languages",
    recommended: true,
  },
  {
    id: "inworld-tts-2-flash",
    name: "Inworld TTS-2 Flash",
    badge: "Ultra Fast",
    descEn: "Fastest, lowest latency (~20ms TTFB), 5x faster than TTS-2. Ideal for realtime interactive conversations.",
    descId: "Model tercepat dengan latensi sub-detik (~20ms TTFB), 5x lebih cepat untuk respons audio seketika.",
    latency: "20ms TTFB",
    languages: "200+ Languages",
  },
  {
    id: "inworld-tts-1.5-max",
    name: "Inworld TTS-1.5 Max",
    badge: "Legacy",
    descEn: "Previous generation model with maximum stability across 15 core languages.",
    descId: "Model generasi sebelumnya dengan stabilitas maksimal pada 15 bahasa utama.",
    latency: "<200ms TTFB",
    languages: "15 Languages",
  },
];

export interface InworldVoice {
  voiceId: string;
  displayName: string;
  langCode: string;
  gender: string;
  description?: string;
  tags?: string[];
}

export const POPULAR_FALLBACK_VOICES: InworldVoice[] = [
  {
    voiceId: "Ashley",
    displayName: "Ashley",
    langCode: "en-US",
    gender: "VOICE_GENDER_FEMALE",
    description: "Warm, empathetic and friendly assistant voice.",
    tags: ["warm", "conversational", "friendly"],
  },
  {
    voiceId: "Dennis",
    displayName: "Dennis",
    langCode: "en-US",
    gender: "VOICE_GENDER_MALE",
    description: "Clear, professional, and knowledgeable narrator.",
    tags: ["professional", "calm", "narrator"],
  },
  {
    voiceId: "Hektor",
    displayName: "Hektor",
    langCode: "en-US",
    gender: "VOICE_GENDER_MALE",
    description: "Deep, authoritative, and engaging educator.",
    tags: ["authoritative", "deep", "educational"],
  },
  {
    voiceId: "Olivia",
    displayName: "Olivia",
    langCode: "en-US",
    gender: "VOICE_GENDER_FEMALE",
    description: "Bright, energetic, and expressive presenter.",
    tags: ["energetic", "articulate", "study"],
  },
];

export interface InworldConfigState {
  baseUrl: string;
  apiKey: string;
  model: string;
  voiceId: string;
  voiceName?: string;
  deliveryMode: "BALANCED" | "STABLE" | "CREATIVE";
  speakingRate: number;
  language: string;
  testText?: string;
}

export const DEFAULT_INWORLD_CONFIG: InworldConfigState = {
  baseUrl: INWORLD_BASE_URL,
  apiKey: "",
  model: "inworld-tts-2",
  voiceId: "Ashley",
  voiceName: "Ashley",
  deliveryMode: "BALANCED",
  speakingRate: 1.0,
  language: "id-ID",
  testText: "Halo! Inworld TTS berhasil terhubung dengan Const Learn.",
};

const STORAGE_KEY = "const_learn_inworld_tts_config";
const VOICES_CACHE_KEY = "const_learn_inworld_voices_cache";

/**
 * Get stored Inworld TTS configuration from localStorage or defaults
 */
export function getStoredInworldConfig(): InworldConfigState {
  if (typeof localStorage === "undefined") {
    return DEFAULT_INWORLD_CONFIG;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INWORLD_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_INWORLD_CONFIG,
      ...parsed,
      baseUrl: INWORLD_BASE_URL, // Always immutable
    };
  } catch {
    return DEFAULT_INWORLD_CONFIG;
  }
}

/**
 * Save Inworld TTS configuration to localStorage and Electron config
 */
export function saveStoredInworldConfig(config: Partial<InworldConfigState>): InworldConfigState {
  const current = getStoredInworldConfig();
  const merged: InworldConfigState = {
    ...current,
    ...config,
    baseUrl: INWORLD_BASE_URL, // Enforce read-only
  };

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }

  // Sync to Electron main process if available
  if (window.electron?.config?.save) {
    window.electron.config
      .save({
        voice: {
          activeProvider: "inworld",
          inworld: {
            baseUrl: INWORLD_BASE_URL,
            apiKey: merged.apiKey,
            model: merged.model,
            voiceId: merged.voiceId,
            voiceName: merged.voiceName,
            deliveryMode: merged.deliveryMode,
            speakingRate: merged.speakingRate,
            language: merged.language,
          },
        },
      })
      .catch((err: any) => console.warn("[InworldService] Failed to sync config to Electron:", err));
  }

  return merged;
}

/**
 * Get cached voices from localStorage
 */
export function getCachedVoices(): InworldVoice[] {
  if (typeof localStorage === "undefined") return POPULAR_FALLBACK_VOICES;
  try {
    const raw = localStorage.getItem(VOICES_CACHE_KEY);
    if (!raw) return POPULAR_FALLBACK_VOICES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : POPULAR_FALLBACK_VOICES;
  } catch {
    return POPULAR_FALLBACK_VOICES;
  }
}

/**
 * Save voices to cache
 */
export function cacheVoices(voices: InworldVoice[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(VOICES_CACHE_KEY, JSON.stringify(voices));
  } catch {}
}

/**
 * Fetch voices from Inworld AI
 */
export async function fetchInworldVoices(
  apiKey: string
): Promise<{ success: boolean; voices?: InworldVoice[]; error?: string }> {
  const cleanKey = (apiKey || "").trim();
  if (!cleanKey) {
    return { success: false, error: "API Key is required to fetch voices." };
  }

  // 1. Prefer Electron IPC handler to avoid CORS and browser restrictions
  if (window.electron?.inworld?.listVoices) {
    try {
      const res = await window.electron.inworld.listVoices({ apiKey: cleanKey });
      if (res.success && res.voices && res.voices.length > 0) {
        cacheVoices(res.voices);
        return { success: true, voices: res.voices };
      }
      if (res.error) {
        return { success: false, error: res.error };
      }
    } catch (err: any) {
      console.warn("[InworldService] Electron IPC fetch failed, trying direct HTTP:", err);
    }
  }

  // 2. Fallback to direct HTTP fetch
  try {
    const authHeader = cleanKey.startsWith("Basic ") ? cleanKey : `Basic ${cleanKey}`;
    const response = await fetch(`${INWORLD_BASE_URL}/voices/v1/voices`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Inworld API returned HTTP ${response.status}: ${text || response.statusText}`,
      };
    }

    const data = await response.json();
    const rawVoices = data?.voices || [];
    const voices: InworldVoice[] = rawVoices.map((v: any) => ({
      voiceId: v.voiceId || v.voice_id || v.id,
      displayName: v.displayName || v.display_name || v.name || v.voiceId || v.voice_id || v.id,
      langCode: v.langCode || v.lang_code || v.language || "en-US",
      gender: v.gender || "VOICE_GENDER_UNSPECIFIED",
      description: v.description || "",
      tags: v.tags || [],
    }));

    if (voices.length > 0) {
      cacheVoices(voices);
    }

    return { success: true, voices };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Network error while connecting to Inworld API.",
    };
  }
}

/**
 * Test voice audio synthesis or preview
 */
export async function testInworldVoice(params: {
  apiKey: string;
  voiceId: string;
  model?: string;
  text?: string;
  deliveryMode?: "BALANCED" | "STABLE" | "CREATIVE";
  speakingRate?: number;
}): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  const cleanKey = (params.apiKey || "").trim();
  if (!cleanKey) {
    return { success: false, error: "API Key is required to test voice." };
  }

  // 1. Prefer Electron IPC handler
  if (window.electron?.inworld?.testVoice) {
    try {
      const res = await window.electron.inworld.testVoice({
        apiKey: cleanKey,
        voiceId: params.voiceId,
        model: params.model,
        text: params.text,
        deliveryMode: params.deliveryMode,
        speakingRate: params.speakingRate,
      });
      return res;
    } catch (err: any) {
      console.warn("[InworldService] Electron IPC testVoice failed, trying direct HTTP:", err);
    }
  }

  // 2. Fallback to direct HTTP fetch
  try {
    let authHeader = cleanKey;
    if (!authHeader.toLowerCase().startsWith("basic ") && !authHeader.toLowerCase().startsWith("bearer ")) {
      if (authHeader.includes(":") && !authHeader.includes(" ")) {
        authHeader = `Basic ${btoa(authHeader)}`;
      } else {
        authHeader = `Basic ${authHeader}`;
      }
    }
    const voiceId = params.voiceId || "Ashley";
    const customText = (params.text || "").trim();

    // 2a. If text is provided, perform synthesis with MP3 encoding
    if (customText) {
      try {
        const synthRes = await fetch(`${INWORLD_BASE_URL}/tts/v1/voice`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: customText,
            voiceId: voiceId,
            modelId: params.model || "inworld-tts-2",
            audioConfig: {
              audioEncoding: "MP3",
            },
          }),
        });

        if (synthRes.ok) {
          const contentType = synthRes.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const json = await synthRes.json();
            const b64 = json.audioContent || json.audio_content || json.audio;
            if (b64) {
              return { success: true, audioUrl: `data:audio/mpeg;base64,${b64}` };
            }
          } else {
            const blob = await synthRes.blob();
            return { success: true, audioUrl: URL.createObjectURL(blob) };
          }
        }
      } catch (synthErr) {
        console.warn("[InworldService] Direct HTTP text synthesis failed, trying preview...", synthErr);
      }
    }

    // 2b. Unmetered preview endpoint fallback (when text is empty or synthesis fails)
    const previewUrl = new URL(`${INWORLD_BASE_URL}/tts/v1/voice:preview`);
    previewUrl.searchParams.set("voice_id", voiceId);
    if (params.model) {
      previewUrl.searchParams.set("model_id", params.model);
    }

    const previewRes = await fetch(previewUrl.toString(), {
      headers: { Authorization: authHeader },
    });

    if (!previewRes.ok) {
      const errText = await previewRes.text();
      return {
        success: false,
        error: `Inworld Preview Error (${previewRes.status}): ${errText || previewRes.statusText}`,
      };
    }

    const blob = await previewRes.blob();
    const objectUrl = URL.createObjectURL(blob);
    return { success: true, audioUrl: objectUrl };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to generate audio test sample.",
    };
  }
}
