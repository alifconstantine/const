export const DEFAULT_CONTEXT_WINDOW = "1000000"; // 1M
export const DEFAULT_MAX_OUTPUT = "128000"; // 128K
export const DEFAULT_INPUT_TYPES = ["text"];
export const DEFAULT_OUTPUT_TYPES = ["text"];

export type ThinkingLevel = "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelSpec {
  id: string;
  name: string;
  modelId: string;
  provider: "const" | "google" | "byok" | "combo" | "nara";
  providerName: string;
  providerDocId?: string;
  supportsThinking: boolean;
  thinkingDefault?: ThinkingLevel;
  isDefault?: boolean;
  isCombo?: boolean;
  comboSlug?: string;
  modelsCount?: number;
  description?: string;
  contextLength?: number;
  contextWindow?: string;
  maxOutputTokens?: string;
  category?: "llm" | "stt" | "search" | "image";
  endpoint?: string;
  inputTypes?: string[];
  outputTypes?: string[];
}

// Built-in models matching exactly what is managed by Const Gateway / OmniRoute
export const BUILTIN_MODELS: ModelSpec[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    modelId: "gemini-3.8-flash",
    provider: "const",
    providerName: "Const",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    isDefault: true,
    inputTypes: ["text", "image", "audio", "video"],
    outputTypes: ["text"],
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    modelId: "glm-5.3-flash",
    provider: "const",
    providerName: "Const",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    inputTypes: ["text", "image", "video"],
    outputTypes: ["text"],
  },
  {
    id: "deepseek-v4.1-flash",
    name: "Deepseek v4.1 Flash",
    modelId: "deepseek-v4.1-flash",
    provider: "const",
    providerName: "Const",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "qwen-3.8-omni-flash",
    name: "Qwen 3.8 Omni Flash",
    modelId: "qwen-3.8-omni-flash",
    provider: "const",
    providerName: "Const",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    inputTypes: ["text", "image", "audio", "video"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-6-luna",
    name: "GPT 6 Luna",
    modelId: "gpt-6-luna",
    provider: "const",
    providerName: "Const",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 272000,
    contextWindow: "272K",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "whisper-large-v3-turbo",
    name: "Whisper Large V3 Turbo",
    modelId: "whisper-large-v3-turbo",
    provider: "const",
    providerName: "Const",
    category: "stt",
    endpoint: "/v1/audio/transcriptions",
    supportsThinking: false,
    contextWindow: "-",
    maxOutputTokens: "-",
    inputTypes: ["audio"],
    outputTypes: ["text"],
  },
  {
    id: "const-search",
    name: "Const Search",
    modelId: "const-search",
    provider: "const",
    providerName: "Const",
    category: "search",
    endpoint: "/v1/search",
    supportsThinking: false,
    contextWindow: "-",
    maxOutputTokens: "-",
    inputTypes: ["text", "search"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    modelId: "gpt-image-2",
    provider: "nara",
    providerName: "NaraRouter",
    category: "image",
    endpoint: "/v1/images/generations",
    supportsThinking: false,
    contextWindow: "-",
    maxOutputTokens: "-",
    inputTypes: ["text", "image"],
    outputTypes: ["image"],
  },
];

/**
 * Find model specification by modelId, checking built-in models first, then any custom/BYOK models.
 */
export function findModelSpec(modelId: string, customModels: ModelSpec[] = []): ModelSpec | undefined {
  const clean = modelId.toLowerCase().trim();
  return (
    customModels.find((m) => m.modelId.toLowerCase() === clean || m.id.toLowerCase() === clean || m.name.toLowerCase() === clean) ||
    BUILTIN_MODELS.find((m) => m.modelId.toLowerCase() === clean || m.id.toLowerCase() === clean || m.name.toLowerCase() === clean)
  );
}

/**
 * Normalizes any variation of Const managed model IDs to the exact upstream OmniRoute model identifier.
 */
export function normalizeConstModelName(modelId: string): string {
  if (!modelId) return modelId;
  const clean = modelId.toLowerCase().trim();

  // 1. GLM 5.3 Flash
  if (
    clean === "glm-5.3-flash" ||
    clean === "glm 5.3 flash" ||
    clean === "glm5.3-flash" ||
    clean.includes("glm-5.3") ||
    clean.includes("glm 5.3")
  ) {
    return "GLM 5.3 Flash";
  }

  // 2. Gemini 3.8 Flash
  if (
    clean === "gemini-3.8-flash" ||
    clean === "gemini 3.8 flash" ||
    clean.startsWith("gemini-3.8") ||
    clean.startsWith("antigravity/gemini-3.8")
  ) {
    return "Gemini 3.8 Flash";
  }

  // 3. Deepseek v4.1 Flash
  if (
    clean === "deepseek-v4.1-flash" ||
    clean === "deepseek v4.1 flash" ||
    clean.includes("deepseek-v4.1") ||
    clean.includes("deepseek v4.1") ||
    clean.includes("deepseek-v4")
  ) {
    return "Deepseek v4.1 Flash";
  }

  // 4. Qwen 3.8 Omni Flash
  if (
    clean === "qwen-3.8-omni-flash" ||
    clean === "qwen 3.8 omni flash" ||
    clean.includes("qwen")
  ) {
    return "Qwen 3.8 Omni Flash";
  }

  // 5. GPT 6 Luna
  if (
    clean === "gpt-6-luna" ||
    clean === "gpt 6 luna" ||
    clean === "gpt-luna-6" ||
    clean.includes("luna")
  ) {
    return "GPT 6 Luna";
  }

  // Audio: Whisper Large v3 Turbo
  if (
    clean === "whisper-large-v3-turbo" ||
    clean === "whisper large v3 turbo" ||
    clean === "whisper-large-v3" ||
    clean === "whisper-1" ||
    clean === "whisper"
  ) {
    return "Whisper Large v3 Turbo";
  }

  // Const Search
  if (
    clean === "const-search" ||
    clean === "const search" ||
    clean === "search"
  ) {
    return "Const Search";
  }

  return modelId;
}

/**
 * Checks if a model identifier belongs to a built-in Const engine model.
 */
export function isBuiltinModel(modelId: string, customModels: ModelSpec[] = []): boolean {
  if (!modelId) return false;
  const clean = modelId.toLowerCase().trim();
  if (clean.startsWith("antigravity/")) return true;
  if (clean === "const-search" || clean === "const search") return true;
  if (clean.startsWith("auto/")) return true;
  if (
    clean === "gemini-3.8-flash" || clean === "gemini 3.8 flash" || clean.startsWith("gemini-3.8") ||
    clean === "glm-5.3-flash" || clean === "glm 5.3 flash" || clean.includes("glm-5.3") ||
    clean === "deepseek-v4.1-flash" || clean === "deepseek v4.1 flash" || clean.includes("deepseek-v4") ||
    clean === "qwen-3.8-omni-flash" || clean === "qwen 3.8 omni flash" || clean.includes("qwen") ||
    clean === "gpt-6-luna" || clean === "gpt 6 luna" || clean.includes("luna") ||
    clean === "whisper-large-v3-turbo" || clean === "whisper large v3 turbo" ||
    clean === "whisper-1" || clean === "whisper"
  ) {
    return true;
  }
  if (
    customModels.some(
      (m) =>
        (m.modelId.toLowerCase() === clean || m.id.toLowerCase() === clean) &&
        m.provider !== "const"
    )
  ) {
    return false;
  }
  return BUILTIN_MODELS.some(
    (m) => m.id.toLowerCase() === clean || m.modelId.toLowerCase() === clean || m.name.toLowerCase() === clean
  );
}

/**
 * Checks if a model is non-generative (e.g. embedding, moderation, audio-only, image generation).
 */
export function isNonGenerativeModel(modelId: string): boolean {
  const clean = modelId.toLowerCase().trim();
  return (
    clean.includes("embed") ||
    clean.includes("moderation") ||
    clean.includes("rerank") ||
    clean.includes("whisper") ||
    clean.includes("tts") ||
    clean.includes("dall-e") ||
    clean.includes("flux") ||
    clean.includes("imagen") ||
    clean.includes("midjourney") ||
    clean.includes("stable-diffusion") ||
    clean.includes("gpt-image") ||
    clean.includes("image-2")
  );
}

/**
 * Checks if a model identifier belongs to an image generation or editing model.
 */
export function isImageModel(modelId: string): boolean {
  if (!modelId) return false;
  const clean = modelId.toLowerCase().trim();
  return (
    clean === "gpt-image-2" ||
    clean.includes("gpt-image") ||
    clean.includes("dall-e") ||
    clean.includes("imagen") ||
    clean.includes("flux") ||
    clean.includes("midjourney") ||
    clean.includes("stable-diffusion")
  );
}

/**
 * Checks if a model identifier/configuration already includes a preset fixed thinking tier
 * (e.g. gemini-3.8-flash-high, gemini-3.7-flash-low, ...-medium, etc.).
 * For these models, thinking is already preconfigured in the provider configuration,
 * so the dynamic thinking UI should NOT be shown.
 */
export function hasFixedThinking(modelId: string, name?: string): boolean {
  const cleanId = modelId.trim();
  const checkStr = `${cleanId} ${name || ""}`.toLowerCase().trim();
  return (
    /(?:^|[-_/ ])(low|medium|high|minimal|max|deep)$/i.test(cleanId) ||
    /(?:^|[-_/ ])(low|medium|high|minimal|max|deep)\b/i.test(cleanId.split("/").pop() || "") ||
    checkStr.includes("-high") ||
    checkStr.includes("-low") ||
    checkStr.includes("-medium") ||
    checkStr.includes(":high") ||
    checkStr.includes(":low") ||
    checkStr.includes(":medium")
  );
}

/**
 * Determines whether a model supports dynamic Thinking UI (Low / Medium / High).
 * In 2026: All frontier generative models support thinking natively.
 * - Non-generative models (embeddings, tts, flux): false
 * - Fixed-tier models (gemini-3.8-flash-high, etc.): false (thinking is already included in provider config)
 * - Base generative models (gemini-3.8-flash, gpt-6, claude-opus-5, etc.): true (dynamic thinking UI shown)
 */
export function checkSupportsThinking(
  modelId: string,
  customModels: ModelSpec[] = [],
  name?: string
): boolean {
  if (isNonGenerativeModel(modelId)) return false;
  if (hasFixedThinking(modelId, name)) return false;

  const spec = findModelSpec(modelId, customModels);
  if (spec && typeof spec.supportsThinking === "boolean") {
    return spec.supportsThinking;
  }

  return true;
}

/**
 * Checks whether a model has dynamic thinking mode.
 */
export function isReasoningModel(modelId: string, capabilities?: string[], name?: string): boolean {
  if (capabilities?.includes("no-thinking")) return false;
  if (capabilities?.includes("fixed-thinking")) return false;
  if (isNonGenerativeModel(modelId)) return false;
  if (hasFixedThinking(modelId, name)) return false;
  return true;
}

export function formatTokenDisplay(tokens?: number | string | null, fallback: string = "1M"): string {
  if (!tokens) return fallback;
  if (typeof tokens === "string") {
    const trimmed = tokens.trim();
    if (trimmed === "-") return "-";
    if (/^\d+[KMGTkmgt]?$/.test(trimmed)) return trimmed.toUpperCase();
    const parsed = parseInt(trimmed.replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) tokens = parsed;
    else return trimmed;
  }
  if (typeof tokens === "number" && tokens > 0) {
    if (tokens >= 1000000) return `${Math.round(tokens / 1000000)}M`;
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
    return `${tokens}`;
  }
  return fallback;
}

export function formatContextWindow(tokens?: number | string | null): string {
  return formatTokenDisplay(tokens, "1M");
}
