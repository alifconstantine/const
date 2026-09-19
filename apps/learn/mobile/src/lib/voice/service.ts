import type {
  VoiceConfigState,
  VoiceProvider,
  VoiceModelOption,
  VoiceCharacter,
} from "./types";

export const INWORLD_BASE_URL = "https://api.inworld.ai";

export const INWORLD_MODELS: VoiceModelOption[] = [
  {
    id: "inworld-tts-2",
    name: "Inworld TTS-2",
    badge: "Flagship",
    descEn: "Top-tier quality with natural language steering and strongest multilingual performance (200+ languages).",
    descId: "Model flagship dengan kendali ekspresi natural language steering dan kualitas audio tertinggi (200+ bahasa).",
    latency: "~120ms P50",
    languages: "200+ Languages",
  },
  {
    id: "inworld-tts-2-flash",
    name: "Inworld TTS-2 Flash",
    badge: "Ultra Fast",
    descEn: "Fastest, lowest latency (~20ms TTFB) for instantaneous real-time dialogue.",
    descId: "Model tercepat dengan latensi sub-detik (~20ms TTFB) untuk respons percakapan seketika.",
    latency: "~20ms TTFB",
    languages: "200+ Languages",
  },
  {
    id: "inworld-tts-1.5-max",
    name: "Inworld TTS-1.5 Max",
    badge: "Stable",
    descEn: "Maximum stability across 15 core languages.",
    descId: "Model dengan stabilitas maksimal pada 15 bahasa utama.",
    latency: "<200ms",
    languages: "15 Languages",
  },
  {
    id: "inworld-tts-1.5-mini",
    name: "Inworld TTS-1.5 Mini",
    badge: "Lightweight",
    descEn: "Fast and lightweight, optimized for English dialogue.",
    descId: "Model ringan dan hemat kuota, dioptimalkan untuk dialog bahasa Inggris.",
    latency: "<100ms",
    languages: "English",
  },
];

export const POPULAR_INWORLD_VOICES: VoiceCharacter[] = [
  {
    id: "Ashley",
    name: "Ashley",
    langCode: "en-US",
    gender: "Female",
    description: "Warm, empathetic and friendly assistant voice.",
  },
  {
    id: "Dennis",
    name: "Dennis",
    langCode: "en-US",
    gender: "Male",
    description: "Clear, professional, and knowledgeable tutor.",
  },
  {
    id: "Hektor",
    name: "Hektor",
    langCode: "en-US",
    gender: "Male",
    description: "Deep, authoritative, and engaging educator.",
  },
  {
    id: "Olivia",
    name: "Olivia",
    langCode: "en-US",
    gender: "Female",
    description: "Bright, energetic, and articulate presenter.",
  },
];

const STORAGE_KEY_VOICE = "const_learn_mobile_voice_config";
const STORAGE_KEY_VOICES_CACHE = "const_learn_mobile_cached_voices";

export const DEFAULT_INWORLD_PROVIDER: VoiceProvider = {
  id: "inworld",
  name: "Inworld TTS",
  baseUrl: INWORLD_BASE_URL,
  protocol: "inworld",
  apiKey: "",
  model: "inworld-tts-2",
  voice: "Ashley",
  voiceName: "Ashley",
  deliveryMode: "BALANCED",
  speed: 1.0,
  isDefault: true,
  isCustom: false,
};

export const DEFAULT_OPENAI_SPEECH_PROVIDER: VoiceProvider = {
  id: "custom-speech",
  name: "Custom Speech",
  baseUrl: "https://api.openai.com/v1",
  protocol: "openai-speech",
  apiKey: "",
  model: "tts-1",
  voice: "alloy",
  voiceName: "alloy",
  speed: 1.0,
  isDefault: false,
  isCustom: true,
};

export const DEFAULT_VOICE_CONFIG: VoiceConfigState = {
  providers: [DEFAULT_INWORLD_PROVIDER, DEFAULT_OPENAI_SPEECH_PROVIDER],
  activeProviderId: "inworld",
  testText: "Halo! Sintesis suara berhasil terhubung dengan Const Learn.",
};

export function getStoredVoiceConfig(): VoiceConfigState {
  if (typeof localStorage === "undefined") return DEFAULT_VOICE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VOICE);
    if (!raw) return DEFAULT_VOICE_CONFIG;
    const parsed = JSON.parse(raw);

    // Support migration
    if (parsed.inworld || parsed.customSpeech) {
      const inworldP: VoiceProvider = {
        id: "inworld",
        name: "Inworld TTS",
        baseUrl: INWORLD_BASE_URL,
        protocol: "inworld",
        apiKey: parsed.inworld?.apiKey || "",
        model: parsed.inworld?.model || "inworld-tts-2",
        voice: parsed.inworld?.voiceId || "Ashley",
        voiceName: parsed.inworld?.voiceName || "Ashley",
        deliveryMode: parsed.inworld?.deliveryMode || "BALANCED",
        speed: parsed.inworld?.speakingRate || 1.0,
        isDefault: true,
        isCustom: false,
      };

      const customP: VoiceProvider = {
        id: "custom-speech",
        name: "Custom Speech",
        baseUrl: parsed.customSpeech?.baseUrl || "https://api.openai.com/v1",
        protocol: "openai-speech",
        apiKey: parsed.customSpeech?.apiKey || "",
        model: parsed.customSpeech?.model || "tts-1",
        voice: parsed.customSpeech?.voice || "alloy",
        voiceName: parsed.customSpeech?.voice || "alloy",
        speed: parsed.customSpeech?.speed || 1.0,
        isDefault: false,
        isCustom: true,
      };

      return {
        providers: [inworldP, customP],
        activeProviderId: parsed.activeProvider === "openai-speech" ? "custom-speech" : "inworld",
        testText: parsed.testText || DEFAULT_VOICE_CONFIG.testText,
      };
    }

    if (Array.isArray(parsed.providers) && parsed.providers.length > 0) {
      return {
        providers: parsed.providers,
        activeProviderId: parsed.activeProviderId || "inworld",
        testText: parsed.testText || DEFAULT_VOICE_CONFIG.testText,
      };
    }

    return DEFAULT_VOICE_CONFIG;
  } catch {
    return DEFAULT_VOICE_CONFIG;
  }
}

export function saveStoredVoiceConfig(config: VoiceConfigState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_VOICE, JSON.stringify(config));
  } catch {}
}

export function getCachedVoices(): VoiceCharacter[] {
  if (typeof localStorage === "undefined") return POPULAR_INWORLD_VOICES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VOICES_CACHE);
    if (!raw) return POPULAR_INWORLD_VOICES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : POPULAR_INWORLD_VOICES;
  } catch {
    return POPULAR_INWORLD_VOICES;
  }
}

export function cacheVoices(voices: VoiceCharacter[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_VOICES_CACHE, JSON.stringify(voices));
  } catch {}
}

/**
 * Fetch available models from Inworld AI if available
 */
export async function fetchInworldModels(
  apiKey: string
): Promise<{ success: boolean; models?: VoiceModelOption[]; error?: string }> {
  const cleanKey = (apiKey || "").trim();
  if (!cleanKey) {
    return { success: false, error: "Inworld API key is required." };
  }

  try {
    let authHeader = cleanKey;
    if (!authHeader.toLowerCase().startsWith("basic ") && !authHeader.toLowerCase().startsWith("bearer ")) {
      if (authHeader.includes(":") && !authHeader.includes(" ")) {
        authHeader = `Basic ${btoa(authHeader)}`;
      } else {
        authHeader = `Basic ${authHeader}`;
      }
    }

    const res = await fetch(`${INWORLD_BASE_URL}/tts/v1/models`, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    if (res.ok) {
      const data = await res.json();
      const list = data?.models || data?.data || [];
      if (Array.isArray(list) && list.length > 0) {
        const mapped: VoiceModelOption[] = list.map((m: any) => ({
          id: m.id || m.modelId || m.name,
          name: m.name || m.displayName || m.id,
          badge: m.badge || "Live",
          descEn: m.description || "",
          descId: m.description || "",
        }));
        return { success: true, models: mapped };
      }
    }
  } catch {}

  return { success: true, models: INWORLD_MODELS };
}

/**
 * Fetch available voices from Inworld AI
 */
export async function fetchInworldVoices(
  apiKey: string
): Promise<{ success: boolean; voices?: VoiceCharacter[]; error?: string }> {
  const cleanKey = (apiKey || "").trim();
  if (!cleanKey) {
    return { success: false, error: "Inworld API key is required." };
  }

  try {
    let authHeader = cleanKey;
    if (!authHeader.toLowerCase().startsWith("basic ") && !authHeader.toLowerCase().startsWith("bearer ")) {
      if (authHeader.includes(":") && !authHeader.includes(" ")) {
        authHeader = `Basic ${btoa(authHeader)}`;
      } else {
        authHeader = `Basic ${authHeader}`;
      }
    }

    const res = await fetch(`${INWORLD_BASE_URL}/voices/v1/voices`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Inworld API (${res.status}): ${errText || res.statusText}`,
      };
    }

    const data = await res.json();
    const rawList: any[] = data?.voices || [];
    const mapped: VoiceCharacter[] = rawList.map((v: any) => ({
      id: v.voiceId || v.voice_id || v.id,
      name: v.displayName || v.display_name || v.name || v.voiceId,
      langCode: v.langCode || v.lang_code || v.language || "en-US",
      gender: v.gender ? String(v.gender).replace("VOICE_GENDER_", "") : undefined,
      description: v.description || undefined,
    }));

    if (mapped.length > 0) {
      cacheVoices(mapped);
    }

    return { success: true, voices: mapped };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to connect to Inworld." };
  }
}

/**
 * Helper to convert Base64 string to Blob directly in memory (no network fetch needed)
 */
export function base64ToBlob(base64Data: string, mimeType = "audio/mp3"): Blob {
  const rawBase64 = base64Data.includes(",") ? base64Data.split(",")[1]! : base64Data;
  const byteCharacters = atob(rawBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

/**
 * Synthesize speech audio using either Inworld TTS or OpenAI /v1/audio/speech
 */
export async function synthesizeSpeech(params: {
  provider: VoiceProvider;
  text: string;
}): Promise<{
  success: boolean;
  audioUrl?: string;
  audioBase64?: string;
  blob?: Blob;
  error?: string;
}> {
  const { provider, text } = params;
  if (!text.trim()) {
    return { success: false, error: "Text is required for speech synthesis." };
  }

  // 1. INWORLD TTS SYNTHESIS
  if (provider.protocol === "inworld") {
    const cleanKey = (provider.apiKey || "").trim();
    if (!cleanKey) {
      return { success: false, error: "Inworld API key is required." };
    }

    try {
      let authHeader = cleanKey;
      if (authHeader.toLowerCase().startsWith("bearer ")) {
        authHeader = `Basic ${authHeader.slice(7).trim()}`;
      } else if (!authHeader.toLowerCase().startsWith("basic ")) {
        if (authHeader.includes(":") && !authHeader.includes(" ")) {
          authHeader = `Basic ${btoa(authHeader)}`;
        } else {
          authHeader = `Basic ${authHeader}`;
        }
      }

      // Try Inworld native REST endpoint (/tts/v1/voice)
      const response = await fetch(`${INWORLD_BASE_URL}/tts/v1/voice`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId: provider.voice || "Ashley",
          modelId: provider.model || "inworld-tts-2",
          audioConfig: {
            audioEncoding: "MP3",
          },
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await response.json();
          const b64 = json.audioContent || json.audio_content || json.audio;
          if (b64) {
            const cleanB64 = b64.includes(",") ? b64.split(",")[1]! : b64;
            const blob = base64ToBlob(cleanB64);
            const audioBase64 = `data:audio/mp3;base64,${cleanB64}`;
            return {
              success: true,
              audioUrl: URL.createObjectURL(blob),
              audioBase64,
              blob,
            };
          }
        } else {
          const blob = await response.blob();
          const audioBase64 = await blobToBase64(blob);
          return {
            success: true,
            audioUrl: URL.createObjectURL(blob),
            audioBase64,
            blob,
          };
        }
      }

      const errText = await response.text().catch(() => "");
      console.error("[VoiceService] Inworld TTS HTTP error:", response.status, errText);
      return {
        success: false,
        error: `Inworld TTS failed (${response.status}): ${errText || response.statusText}`,
      };
    } catch (err: any) {
      console.error("[VoiceService] Direct HTTP request threw:", err);
      return { success: false, error: err.message || "Failed to synthesize audio." };
    }
  }

  // 2. OPENAI-COMPATIBLE /v1/audio/speech
  if (provider.protocol === "openai-speech") {
    const cleanUrl = (provider.baseUrl || "").replace(/\/+$/, "");
    if (!cleanUrl) {
      return { success: false, error: "Base URL is required for OpenAI Speech provider." };
    }

    const endpoint = cleanUrl.endsWith("/audio/speech")
      ? cleanUrl
      : cleanUrl.endsWith("/v1")
      ? `${cleanUrl}/audio/speech`
      : `${cleanUrl}/v1/audio/speech`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const cleanKey = (provider.apiKey || "").trim();
    if (cleanKey) {
      headers["Authorization"] = cleanKey.startsWith("Bearer ") ? cleanKey : `Bearer ${cleanKey}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: provider.model || "tts-1",
          input: text,
          voice: provider.voice || "alloy",
          speed: provider.speed || 1.0,
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        return {
          success: false,
          error: `OpenAI Speech error (${response.status}): ${errBody || response.statusText}`,
        };
      }

      const blob = await response.blob();
      const audioBase64 = await blobToBase64(blob);
      return {
        success: true,
        audioUrl: URL.createObjectURL(blob),
        audioBase64,
        blob,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Network error while calling speech endpoint.",
      };
    }
  }

  return { success: false, error: "Unsupported voice provider." };
}

/**
 * Helper to convert Blob to Base64 data URL
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Split text into semantic chunks (< maxChars) by paragraph or sentence
 */
export function splitTextIntoAudioChunks(text: string, maxChars = 1500): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 <= maxChars) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length <= maxChars) {
        current = trimmed;
      } else {
        const sentences = trimmed.match(/[^.!?]+[.!?]+|\S+/g) || [trimmed];
        current = "";
        for (const sentence of sentences) {
          if (current.length + sentence.length + 1 <= maxChars) {
            current = current ? `${current} ${sentence}` : sentence;
          } else {
            if (current) chunks.push(current);
            current = sentence;
          }
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Synthesize speech with automatic chunking for long texts and returns merged audio Blob/URL/base64
 */
export async function synthesizeSpeechChunked(params: {
  provider: VoiceProvider;
  text: string;
}): Promise<{
  success: boolean;
  audioUrl?: string;
  audioBase64?: string;
  blob?: Blob;
  error?: string;
}> {
  const { provider, text } = params;
  if (!text.trim()) {
    return { success: false, error: "Text is required for speech synthesis." };
  }

  const chunks = splitTextIntoAudioChunks(text, 1500);
  const blobs: Blob[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const res = await synthesizeSpeech({ provider, text: chunk });
    if (!res.success) {
      console.error(`[VoiceService] Chunk ${i + 1}/${chunks.length} failed:`, res.error);
      return { success: false, error: res.error || `Failed to synthesize chunk ${i + 1}` };
    }

    if (res.blob) {
      blobs.push(res.blob);
    } else if (res.audioBase64) {
      blobs.push(base64ToBlob(res.audioBase64));
    } else if (res.audioUrl) {
      if (res.audioUrl.startsWith("data:")) {
        blobs.push(base64ToBlob(res.audioUrl));
      } else {
        try {
          const response = await fetch(res.audioUrl);
          const blob = await response.blob();
          blobs.push(blob);
        } catch (e: any) {
          return { success: false, error: "Failed to read synthesized audio chunk: " + e.message };
        }
      }
    }
  }

  if (blobs.length === 0) {
    return { success: false, error: "No audio data was generated." };
  }

  const mergedBlob = new Blob(blobs, { type: "audio/mp3" });
  const audioUrl = URL.createObjectURL(mergedBlob);
  let audioBase64: string | undefined;
  try {
    audioBase64 = await blobToBase64(mergedBlob);
  } catch (e) {
    console.warn("Failed to convert audio blob to base64:", e);
  }

  return {
    success: true,
    audioUrl,
    audioBase64,
    blob: mergedBlob,
  };
}

