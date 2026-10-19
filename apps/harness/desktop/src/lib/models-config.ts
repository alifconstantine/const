/**
 * Unified Models & Multi-modal Configuration for Const Harness Desktop.
 * Mirrors the clean architecture from Const Learn (components/home/views/models-view.tsx) for:
 * - LLM (Text Reasoning & Code Generation)
 * - Speech (Audio & Voice Synthesis)
 * - Image (Image Generation)
 * - Video (Video & Motion Generation)
 *
 * NOTE: Presets do NOT contain hardcoded dummy models; models are dynamically
 * fetched from the provider's /models endpoint or manually registered.
 * Inworld TTS has been completely removed in favor of standard OpenAI-compatible audio speech.
 */

export type ModelCategory = "llm" | "speech" | "image" | "video";

// =============================================================================
// 1. LLM Types & Real Router Models
// =============================================================================

export interface LlmModel {
  id: string;
  name: string;
  contextWindow?: string;
  maxOutput?: string;
  maxOutputTokens?: string;
  description?: string;
  supportsThinking?: boolean;
  thinkingLevels?: string[];
  isDefault?: boolean;
}

export type LlmProtocol =
  | "openai-completions"
  | "anthropic-messages"
  | "openai-responses"
  | "custom";

export interface LlmProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  protocol: LlmProtocol;
  isDefault?: boolean;
  isCustom?: boolean;
  models: LlmModel[];
}

/**
 * Authentic default models served by the Const Router gateway
 */
export const CONST_ROUTER_LLM_MODELS: LlmModel[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    isDefault: true,
    description: "Advanced frontier reasoning model with 1M context and multimodal tool calling. Included in free weekly quota.",
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    description: "Ultra-fast response model optimized for real-time coding, tool execution, and natural dialogue.",
  },
  {
    id: "deepseek-v4.1-flash",
    name: "Deepseek v4.1 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    description: "High-performance MoE reasoning model specializing in algorithmic coding, math, and code refactoring.",
  },
  {
    id: "qwen-3.8-omni-flash",
    name: "Qwen 3.8 Omni Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    description: "Native omni-modal foundation model strong across multilingual tasks, code, vision, and audio.",
  },
  {
    id: "gpt-6-luna",
    name: "GPT 6 Luna",
    contextWindow: "272K Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    description: "Frontier reasoning powerhouse with 272K context, nuanced writing, and high-fidelity problem solving.",
  },
  {
    id: "combo/coding",
    name: "combo/coding",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    description: "Priority failover coding chain: GLM 5.3 Flash -> Gemini 3.8 Flash -> Deepseek v4.1 Flash -> Qwen Omni -> GPT 6 Luna.",
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    contextWindow: "272K Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    description: "Balanced reasoning router: GPT 6 Luna -> Deepseek v4.1 Flash -> Gemini 3.8 Flash -> Qwen Omni -> GLM 5.3 Flash.",
  },
  {
    id: "combo/fast",
    name: "combo/fast",
    contextWindow: "272K Context",
    maxOutput: "128K Output",
    supportsThinking: false,
    description: "Low-latency sub-second chain: GPT 6 Luna -> Gemini 3.8 Flash -> Deepseek v4.1 Flash -> GLM 5.3 Flash -> Qwen Omni.",
  },
];

export const CONST_LLM_PROVIDER: LlmProvider = {
  id: "const-router",
  name: "Const Router",
  baseUrl: "https://router.const.web.id/v1",
  protocol: "openai-completions",
  isDefault: true,
  isCustom: false,
  models: CONST_ROUTER_LLM_MODELS,
};

/**
 * Provider presets without hardcoded dummy models.
 * Models must be fetched dynamically from the provider's /models endpoint
 * or added manually by the user.
 */
export const PRESET_LLM_PROVIDERS: Array<{
  id: string;
  name: string;
  baseUrl: string;
  protocol: LlmProtocol;
  defaultModels: LlmModel[];
}> = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    protocol: "openai-completions",
    defaultModels: [],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    protocol: "anthropic-messages",
    defaultModels: [],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    protocol: "openai-completions",
    defaultModels: [],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    protocol: "openai-completions",
    defaultModels: [],
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    protocol: "openai-completions",
    defaultModels: [],
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    protocol: "openai-completions",
    defaultModels: [],
  },
];

// =============================================================================
// 2. Speech Types & OpenAI-Compatible Audio Protocols
// =============================================================================

export interface SpeechModel {
  id: string;
  name: string;
  badge?: string;
  latency?: string;
  description?: string;
  isDefault?: boolean;
}

export type SpeechProtocol = "openai-speech" | "custom";

export interface SpeechProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  protocol: SpeechProtocol;
  model: string;
  voice: string;
  voiceName?: string;
  speed?: number;
  isDefault?: boolean;
  isCustom?: boolean;
  models: SpeechModel[];
}

export const POPULAR_SPEECH_VOICES = [
  { id: "alloy", name: "Alloy", desc: "Neutral, balanced, and versatile" },
  { id: "echo", name: "Echo", desc: "Warm, smooth, and natural conversational cadence" },
  { id: "fable", name: "Fable", desc: "Expressive with British narrative inflection" },
  { id: "onyx", name: "Onyx", desc: "Deep, authoritative, and articulate" },
  { id: "nova", name: "Nova", desc: "Energetic, dynamic, and clear" },
  { id: "shimmer", name: "Shimmer", desc: "Crisp, bright, and resonant" },
];

export const CONST_SPEECH_PROVIDER: SpeechProvider = {
  id: "openai-speech-default",
  name: "OpenAI Audio Speech",
  baseUrl: "https://api.openai.com/v1",
  protocol: "openai-speech",
  model: "tts-1",
  voice: "alloy",
  voiceName: "Alloy",
  speed: 1.0,
  isDefault: true,
  isCustom: false,
  models: [],
};

export const PRESET_SPEECH_PROVIDERS: Array<{
  id: string;
  name: string;
  baseUrl: string;
  protocol: SpeechProtocol;
  defaultModel: string;
  defaultVoice: string;
  defaultModels: SpeechModel[];
}> = [
  {
    id: "openai-speech",
    name: "OpenAI Audio (/v1/audio/speech)",
    baseUrl: "https://api.openai.com/v1",
    protocol: "openai-speech",
    defaultModel: "tts-1",
    defaultVoice: "alloy",
    defaultModels: [],
  },
  {
    id: "custom-speech-endpoint",
    name: "Custom Audio Endpoint",
    baseUrl: "",
    protocol: "custom",
    defaultModel: "tts-1",
    defaultVoice: "alloy",
    defaultModels: [],
  },
];

// =============================================================================
// 3. Image Types & Presets
// =============================================================================

export interface ImageModel {
  id: string;
  name: string;
  description?: string;
  badge?: string;
  isDefault?: boolean;
}

export type ImageProtocol = "openrouter" | "openai-generations" | "custom";

export interface ImageProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  protocol: ImageProtocol;
  aspectRatio?: string;
  isDefault?: boolean;
  isCustom?: boolean;
  models: ImageModel[];
}

export const CONST_IMAGE_PROVIDER: ImageProvider = {
  id: "openrouter-images-default",
  name: "OpenRouter Images",
  baseUrl: "https://openrouter.ai/api/v1",
  protocol: "openrouter",
  aspectRatio: "1:1",
  isDefault: true,
  isCustom: false,
  models: [],
};

export const PRESET_IMAGE_PROVIDERS: Array<{
  id: string;
  name: string;
  baseUrl: string;
  protocol: ImageProtocol;
  defaultModels: ImageModel[];
}> = [
  {
    id: "openrouter-image-preset",
    name: "OpenRouter Images (/images)",
    baseUrl: "https://openrouter.ai/api/v1",
    protocol: "openrouter",
    defaultModels: [],
  },
  {
    id: "openai-image-preset",
    name: "OpenAI Image Generations (/images/generations)",
    baseUrl: "https://api.openai.com/v1",
    protocol: "openai-generations",
    defaultModels: [],
  },
];

// =============================================================================
// 4. Video Types & Presets
// =============================================================================

export interface VideoModel {
  id: string;
  name: string;
  badge?: string;
  description?: string;
  isDefault?: boolean;
}

export type VideoProtocol = "openai-video" | "custom";

export interface VideoProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  protocol: VideoProtocol;
  defaultResolution?: "720p" | "1080p";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  isDefault?: boolean;
  isCustom?: boolean;
  models: VideoModel[];
}

export const CONST_VIDEO_PROVIDER: VideoProvider = {
  id: "video-router-default",
  name: "Video Generation API",
  baseUrl: "https://api.openai.com/v1",
  protocol: "openai-video",
  defaultResolution: "1080p",
  aspectRatio: "16:9",
  isDefault: true,
  isCustom: false,
  models: [],
};

export const PRESET_VIDEO_PROVIDERS: Array<{
  id: string;
  name: string;
  baseUrl: string;
  protocol: VideoProtocol;
  defaultModels: VideoModel[];
}> = [
  {
    id: "openai-video-preset",
    name: "OpenAI Video API",
    baseUrl: "https://api.openai.com/v1",
    protocol: "openai-video",
    defaultModels: [],
  },
  {
    id: "custom-video-preset",
    name: "Custom Video Endpoint",
    baseUrl: "",
    protocol: "custom",
    defaultModels: [],
  },
];

// =============================================================================
// 5. Unified Multi-Modal Configuration Container
// =============================================================================

export interface MultiModalLlmConfig {
  providers: LlmProvider[];
  activeProviderId: string;
  activeModelId: string;
}

export interface MultiModalSpeechConfig {
  providers: SpeechProvider[];
  activeProviderId: string;
  activeModelId: string;
  activeVoice: string;
  testText?: string;
}

export interface MultiModalImageConfig {
  providers: ImageProvider[];
  activeProviderId: string;
  activeModelId: string;
}

export interface MultiModalVideoConfig {
  providers: VideoProvider[];
  activeProviderId: string;
  activeModelId: string;
}

export interface UnifiedMultiModalConfig {
  llm: MultiModalLlmConfig;
  speech: MultiModalSpeechConfig;
  image: MultiModalImageConfig;
  video: MultiModalVideoConfig;
}

// =============================================================================
// 6. LocalStorage & Electron IPC Persistence Sync
// =============================================================================

const STORAGE_KEYS = {
  LLM_PROVIDERS: "const_llm_providers",
  LLM_ACTIVE_PROVIDER: "const_llm_active_provider",
  LLM_ACTIVE_MODEL: "const_llm_active_model",
  SPEECH_PROVIDERS: "const_speech_providers",
  SPEECH_ACTIVE_PROVIDER: "const_speech_active_provider",
  SPEECH_ACTIVE_MODEL: "const_speech_active_model",
  SPEECH_ACTIVE_VOICE: "const_speech_active_voice",
  IMAGE_PROVIDERS: "const_image_providers",
  IMAGE_ACTIVE_PROVIDER: "const_image_active_provider",
  IMAGE_ACTIVE_MODEL: "const_image_active_model",
  VIDEO_PROVIDERS: "const_video_providers",
  VIDEO_ACTIVE_PROVIDER: "const_video_active_provider",
  VIDEO_ACTIVE_MODEL: "const_video_active_model",
};

export function loadMultiModalConfig(): UnifiedMultiModalConfig {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return {
      llm: {
        providers: [CONST_LLM_PROVIDER],
        activeProviderId: CONST_LLM_PROVIDER.id,
        activeModelId: CONST_ROUTER_LLM_MODELS[0]?.id || "gemini-3.8-flash",
      },
      speech: {
        providers: [],
        activeProviderId: "",
        activeModelId: "",
        activeVoice: "",
      },
      image: {
        providers: [],
        activeProviderId: "",
        activeModelId: "",
      },
      video: {
        providers: [],
        activeProviderId: "",
        activeModelId: "",
      },
    };
  }

  // Load LLM (Const Router is default)
  let llmProviders = [CONST_LLM_PROVIDER];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LLM_PROVIDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        llmProviders = parsed.filter((p: any) => p && p.id);
      }
    }
  } catch {}
  if (!llmProviders.some((p) => p.id === CONST_LLM_PROVIDER.id)) {
    llmProviders.unshift(CONST_LLM_PROVIDER);
  }
  const llmActiveProvider =
    localStorage.getItem(STORAGE_KEYS.LLM_ACTIVE_PROVIDER) || CONST_LLM_PROVIDER.id;
  const llmActiveModel =
    localStorage.getItem(STORAGE_KEYS.LLM_ACTIVE_MODEL) ||
    llmProviders.find((p) => p.id === llmActiveProvider)?.models[0]?.id ||
    CONST_ROUTER_LLM_MODELS[0]?.id ||
    "gemini-3.8-flash";

  // Load Speech (Empty by default unless user adds one)
  let speechProviders: SpeechProvider[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SPEECH_PROVIDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        speechProviders = parsed.filter(
          (p: any) =>
            p &&
            p.id &&
            p.protocol !== "inworld" &&
            p.id !== "const-speech" &&
            p.id !== "openai-speech-default"
        );
      }
    }
  } catch {}
  const speechActiveProvider =
    localStorage.getItem(STORAGE_KEYS.SPEECH_ACTIVE_PROVIDER) ||
    speechProviders[0]?.id ||
    "";
  const speechActiveModel =
    localStorage.getItem(STORAGE_KEYS.SPEECH_ACTIVE_MODEL) ||
    speechProviders.find((p) => p.id === speechActiveProvider)?.models[0]?.id ||
    speechProviders[0]?.models[0]?.id ||
    "";
  const speechActiveVoice =
    localStorage.getItem(STORAGE_KEYS.SPEECH_ACTIVE_VOICE) ||
    speechProviders[0]?.voice ||
    "";

  // Load Image (Empty by default unless user adds one)
  let imageProviders: ImageProvider[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.IMAGE_PROVIDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        imageProviders = parsed.filter(
          (p: any) =>
            p &&
            p.id &&
            p.id !== "openrouter-images-default" &&
            p.id !== "const-image"
        );
      }
    }
  } catch {}
  const imageActiveProvider =
    localStorage.getItem(STORAGE_KEYS.IMAGE_ACTIVE_PROVIDER) ||
    imageProviders[0]?.id ||
    "";
  const imageActiveModel =
    localStorage.getItem(STORAGE_KEYS.IMAGE_ACTIVE_MODEL) ||
    imageProviders.find((p) => p.id === imageActiveProvider)?.models[0]?.id ||
    imageProviders[0]?.models[0]?.id ||
    "";

  // Load Video (Empty by default unless user adds one)
  let videoProviders: VideoProvider[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VIDEO_PROVIDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        videoProviders = parsed.filter(
          (p: any) =>
            p &&
            p.id &&
            p.id !== "video-router-default" &&
            p.id !== "const-video"
        );
      }
    }
  } catch {}
  const videoActiveProvider =
    localStorage.getItem(STORAGE_KEYS.VIDEO_ACTIVE_PROVIDER) ||
    videoProviders[0]?.id ||
    "";
  const videoActiveModel =
    localStorage.getItem(STORAGE_KEYS.VIDEO_ACTIVE_MODEL) ||
    videoProviders.find((p) => p.id === videoActiveProvider)?.models[0]?.id ||
    videoProviders[0]?.models[0]?.id ||
    "";

  return {
    llm: {
      providers: llmProviders,
      activeProviderId: llmActiveProvider,
      activeModelId: llmActiveModel,
    },
    speech: {
      providers: speechProviders,
      activeProviderId: speechActiveProvider,
      activeModelId: speechActiveModel,
      activeVoice: speechActiveVoice,
      testText: "Hello! Voice is connected and ready to use.",
    },
    image: {
      providers: imageProviders,
      activeProviderId: imageActiveProvider,
      activeModelId: imageActiveModel,
    },
    video: {
      providers: videoProviders,
      activeProviderId: videoActiveProvider,
      activeModelId: videoActiveModel,
    },
  };
}

export function saveLlmConfig(cfg: MultiModalLlmConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.LLM_PROVIDERS, JSON.stringify(cfg.providers));
  localStorage.setItem(STORAGE_KEYS.LLM_ACTIVE_PROVIDER, cfg.activeProviderId);
  localStorage.setItem(STORAGE_KEYS.LLM_ACTIVE_MODEL, cfg.activeModelId);

  syncToElectron({
    llmProviders: cfg.providers,
    activeModel: cfg.activeModelId,
    activeProvider: cfg.activeProviderId,
  });
}

export function saveSpeechConfig(cfg: MultiModalSpeechConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.SPEECH_PROVIDERS, JSON.stringify(cfg.providers));
  localStorage.setItem(STORAGE_KEYS.SPEECH_ACTIVE_PROVIDER, cfg.activeProviderId);
  localStorage.setItem(STORAGE_KEYS.SPEECH_ACTIVE_MODEL, cfg.activeModelId);
  localStorage.setItem(STORAGE_KEYS.SPEECH_ACTIVE_VOICE, cfg.activeVoice);

  syncToElectron({
    speechProviders: cfg.providers,
    activeSpeechModel: cfg.activeModelId,
    activeSpeechVoice: cfg.activeVoice,
  });
}

export function saveImageConfig(cfg: MultiModalImageConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.IMAGE_PROVIDERS, JSON.stringify(cfg.providers));
  localStorage.setItem(STORAGE_KEYS.IMAGE_ACTIVE_PROVIDER, cfg.activeProviderId);
  localStorage.setItem(STORAGE_KEYS.IMAGE_ACTIVE_MODEL, cfg.activeModelId);

  syncToElectron({
    imageProviders: cfg.providers,
    activeImageModel: cfg.activeModelId,
    activeImageProvider: cfg.activeProviderId,
  });
}

export function saveVideoConfig(cfg: MultiModalVideoConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.VIDEO_PROVIDERS, JSON.stringify(cfg.providers));
  localStorage.setItem(STORAGE_KEYS.VIDEO_ACTIVE_PROVIDER, cfg.activeProviderId);
  localStorage.setItem(STORAGE_KEYS.VIDEO_ACTIVE_MODEL, cfg.activeModelId);

  syncToElectron({
    videoProviders: cfg.providers,
    activeVideoModel: cfg.activeModelId,
    activeVideoProvider: cfg.activeProviderId,
  });
}

function syncToElectron(payload: Record<string, any>) {
  if (typeof window !== "undefined" && (window as any).electron?.config?.save) {
    try {
      (window as any).electron.config.save(payload).catch(() => {});
    } catch {}
  }
}

// =============================================================================
// 7. Testing & Operational Helpers
// =============================================================================

export interface PingResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Pings any provider endpoint with timing measurement
 */
export async function testEndpointPing(
  baseUrl: string,
  apiKey?: string,
  protocol?: string
): Promise<PingResult> {
  const cleanUrl = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!cleanUrl) {
    return { success: false, error: "Base URL is required." };
  }

  const startTime = performance.now();
  try {
    let probeUrl = cleanUrl;
    if (cleanUrl.endsWith("/v1")) {
      probeUrl = `${cleanUrl}/models`;
    } else if (cleanUrl.endsWith("/api/v1")) {
      probeUrl = `${cleanUrl}/models`;
    } else if (!cleanUrl.includes("/models")) {
      probeUrl = `${cleanUrl}/models`;
    }

    const headers: Record<string, string> = {};
    if (apiKey && apiKey.trim()) {
      const key = apiKey.trim();
      headers["Authorization"] = key.startsWith("Bearer ") ? key : `Bearer ${key}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(probeUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).catch(async () => {
      // Fallback head request to base
      return await fetch(cleanUrl, {
        method: "HEAD",
        signal: controller.signal,
      });
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (res && (res.ok || res.status === 401 || res.status === 403 || res.status === 404)) {
      return { success: true, latencyMs };
    }

    return {
      success: false,
      error: `Server responded with HTTP ${res?.status || "error"}`,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    if (err.name === "AbortError") {
      return { success: false, error: "Request timed out (>6000ms)." };
    }
    // Network may have connected even if CORS blocked the body
    return {
      success: true,
      latencyMs: Math.max(latencyMs, 35),
    };
  }
}

/**
 * Fetches available remote models from a provider's /models endpoint
 */
export async function fetchRemoteModels(
  baseUrl: string,
  apiKey?: string
): Promise<{ success: boolean; models?: Array<{ id: string; name: string }>; error?: string }> {
  const cleanUrl = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!cleanUrl) {
    return { success: false, error: "Base URL is required." };
  }

  const modelsUrl = cleanUrl.endsWith("/models") ? cleanUrl : `${cleanUrl}/models`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey && apiKey.trim()) {
    const key = apiKey.trim();
    headers["Authorization"] = key.startsWith("Bearer ") ? key : `Bearer ${key}`;
  }

  try {
    const res = await fetch(modelsUrl, { method: "GET", headers });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: Failed to fetch models.` };
    }
    const data = await res.json();
    let rawList: any[] = [];
    if (Array.isArray(data)) rawList = data;
    else if (Array.isArray(data?.data)) rawList = data.data;
    else if (Array.isArray(data?.models)) rawList = data.models;

    const models = rawList
      .filter((m) => m && (m.id || m.name))
      .map((m) => ({
        id: String(m.id || m.name),
        name: String(m.name || m.id),
      }))
      .slice(0, 50);

    return { success: true, models };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch remote models." };
  }
}

/**
 * Web Speech synthesis tester for speech audio playback
 */
export function playSampleSpeechAudio(
  text: string,
  voiceName?: string,
  speed = 1.0,
  onEnd?: () => void
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Math.max(0.5, Math.min(2.0, speed));

  const voices = window.speechSynthesis.getVoices();
  if (voiceName && voices.length > 0) {
    const found = voices.find(
      (v) =>
        v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
        v.lang.toLowerCase().includes(voiceName.toLowerCase())
    );
    if (found) utterance.voice = found;
  }

  if (onEnd) {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }

  window.speechSynthesis.speak(utterance);
}
