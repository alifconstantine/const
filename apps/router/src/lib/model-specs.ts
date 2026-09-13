export const DEFAULT_CONTEXT_WINDOW = "1000000"; // 1M
export const DEFAULT_MAX_OUTPUT = "128000"; // 128K
export const DEFAULT_INPUT_TYPES = ["text"];
export const DEFAULT_OUTPUT_TYPES = ["text"];

export type ThinkingLevel = "low" | "medium" | "high";

export interface ModelSpec {
  id: string;
  name: string;
  modelId: string;
  provider: "const" | "google" | "byok" | "combo";
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
  inputTypes?: string[];
  outputTypes?: string[];
}

// Built-in models matching exactly what is listed in /models
export const BUILTIN_MODELS: ModelSpec[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    modelId: "gemini-3.8-flash",
    provider: "const",
    providerName: "Const",
    supportsThinking: true,
    thinkingDefault: "medium",
    isDefault: true,
    inputTypes: ["text", "image", "video"],
    outputTypes: ["text"],
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    modelId: "gemini-3.7-flash",
    provider: "const",
    providerName: "Const",
    supportsThinking: true,
    thinkingDefault: "medium",
    inputTypes: ["text", "image", "video"],
    outputTypes: ["text"],
  },
  {
    id: "const-search",
    name: "Const Search",
    modelId: "const-search",
    provider: "const",
    providerName: "Const",
    supportsThinking: false,
    contextWindow: "1000000",
    maxOutputTokens: "32000",
    inputTypes: ["text", "search"],
    outputTypes: ["text"],
    description: "Real-time intelligent web search engine powered by OmniRoute & Tavily",
  },
];

/**
 * Find model specification by modelId, checking built-in models first, then any custom/BYOK models.
 */
export function findModelSpec(modelId: string, customModels: ModelSpec[] = []): ModelSpec {
  const clean = modelId.toLowerCase().trim();
  const matched =
    customModels.find((m) => m.modelId.toLowerCase() === clean || m.id.toLowerCase() === clean || m.name.toLowerCase() === clean) ||
    BUILTIN_MODELS.find((m) => m.modelId.toLowerCase() === clean || m.id.toLowerCase() === clean || m.name.toLowerCase() === clean);

  if (matched) return matched;
  return BUILTIN_MODELS[0]!;
}

/**
 * Normalizes any variation of Const managed model IDs to the exact OmniRoute combo model title.
 * - "gemini-3.7-flash", "gemini 3.7 flash", "Gemini 3.7 Flash" -> "Gemini 3.7 Flash"
 * - "gemini-3.8-flash", "gemini 3.8 flash", "Gemini 3.8 Flash" -> "Gemini 3.8 Flash"
 */
export function normalizeConstModelName(modelId: string): string {
  if (!modelId) return modelId;
  const clean = modelId.toLowerCase().trim();
  if (
    clean === "gemini-3.7-flash" ||
    clean === "gemini 3.7 flash" ||
    clean.startsWith("antigravity/gemini-3.7") ||
    clean.startsWith("gemini-3.7")
  ) {
    return "Gemini 3.7 Flash";
  }
  if (
    clean === "gemini-3.8-flash" ||
    clean === "gemini 3.8 flash" ||
    clean.startsWith("antigravity/gemini-3.8") ||
    clean.startsWith("gemini-3.8")
  ) {
    return "Gemini 3.8 Flash";
  }
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
  if (
    clean === "gemini-3.7-flash" || clean === "gemini 3.7 flash" ||
    clean === "gemini-3.8-flash" || clean === "gemini 3.8 flash" ||
    clean.startsWith("gemini-3.8") || clean.startsWith("gemini-3.7")
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
