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
}

// Built-in models matching exactly what is listed in /models
export const BUILTIN_MODELS: ModelSpec[] = [
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    modelId: "gemini-3.6-flash",
    provider: "const",
    providerName: "Const",
    supportsThinking: true,
    thinkingDefault: "medium",
    isDefault: true,
  },
];

/**
 * Find model specification by modelId, checking built-in models first, then any custom/BYOK models.
 */
export function findModelSpec(modelId: string, customModels: ModelSpec[] = []): ModelSpec {
  const matched =
    customModels.find((m) => m.modelId === modelId || m.id === modelId) ||
    BUILTIN_MODELS.find((m) => m.modelId === modelId || m.id === modelId);

  if (matched) return matched;
  return BUILTIN_MODELS[0]!;
}

/**
 * Checks if a model identifier belongs to a built-in Const engine model.
 */
export function isBuiltinModel(modelId: string, customModels: ModelSpec[] = []): boolean {
  if (!modelId) return false;
  const clean = modelId.toLowerCase().trim();
  if (clean.startsWith("antigravity/")) return true;
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
    (m) => m.id.toLowerCase() === clean || m.modelId.toLowerCase() === clean
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
 * (e.g. gemini-3.8-flash-high, gemini-3.6-flash-low, ...-medium, etc.).
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
