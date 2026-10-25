export const DEFAULT_CONTEXT_WINDOW = "1000000"; // 1M
export const DEFAULT_MAX_OUTPUT = "128000"; // 128K
export const DEFAULT_INPUT_TYPES = ["text"];
export const DEFAULT_OUTPUT_TYPES = ["text"];

export type ThinkingLevel = "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelPricing {
  input: string;
  cache?: string;
  output: string;
  unit?: string;
}

export interface ModelSpec {
  id: string;
  name: string;
  modelId: string;
  provider: "const" | "byok" | "combo";
  providerName: string;
  providerDocId?: string;
  supportsThinking: boolean;
  thinkingDefault?: ThinkingLevel;
  pricing?: ModelPricing;
  isCombo?: boolean;
  comboSlug?: string;
  modelsCount?: number;
  description?: string;
  contextLength?: number;
  contextWindow?: string;
  maxOutputTokens?: string;
  category?: "llm" | "stt" | "search" | "image";
  endpoint?: string;
  tier?: "free" | "paid";
  inputTypes?: string[];
  outputTypes?: string[];
}

// Built-in models matching exactly what is managed by Const Gateway
const CATALOG_MODELS: ModelSpec[] = [
  // --- FREE TIER MODELS (Accessible in Free & Paid) ---
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek v4.1 Flash",
    modelId: "deepseek-v4.1-flash",
    provider: "const",
    providerName: "Const",
    tier: "free",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.0125",
      cache: "$0.0125",
      output: "$0.060",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "qwen-3.8-omni-flash",
    name: "Qwen 3.8 Omni Flash",
    modelId: "qwen-3.8-omni-flash",
    provider: "const",
    providerName: "Const",
    tier: "free",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.0125",
      cache: "$0.0125",
      output: "$0.055",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image", "audio", "video"],
    outputTypes: ["text"],
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    modelId: "glm-5.3-flash",
    provider: "const",
    providerName: "Const",
    tier: "free",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.0125",
      cache: "$0.0125",
      output: "$0.055",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image", "video"],
    outputTypes: ["text"],
  },

  // --- PAID PLAN FRONTIER & REASONING MODELS ---
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    modelId: "gemini-3.8-flash",
    provider: "const",
    providerName: "Const",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.020",
      cache: "$0.020",
      output: "$0.080",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image", "audio", "video"],
    outputTypes: ["text"],
  },
  {
    id: "glm-5.3",
    name: "GLM 5.3",
    modelId: "glm-5.3",
    provider: "const",
    providerName: "Const",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.035",
      cache: "$0.035",
      output: "$0.110",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text"],
    outputTypes: ["text"],
  },
  {
    id: "minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash",
    modelId: "minimax-m3.1-flash",
    provider: "const",
    providerName: "Const",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.035",
      cache: "$0.035",
      output: "$0.135",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "qwen-3.8-max",
    name: "Qwen 3.8 Max",
    modelId: "qwen-3.8-max",
    provider: "const",
    providerName: "Const",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.050",
      cache: "$0.050",
      output: "$0.150",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-6.1-sol",
    name: "GPT 6.1 Sol",
    modelId: "gpt-6.1-sol",
    provider: "const",
    providerName: "Const",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 500000,
    contextWindow: "500K",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.240",
      cache: "$0.050",
      output: "$1.200",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-6-astra",
    name: "GPT 6 Astra",
    modelId: "gpt-6-astra",
    provider: "const",
    providerName: "Const",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 272000,
    contextWindow: "272K",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.450",
      cache: "$0.090",
      output: "$2.200",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "claude-haiku-5.5",
    name: "Claude Haiku 5.5",
    modelId: "claude-haiku-5.5",
    provider: "const",
    providerName: "Const",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.110",
      cache: "$0.025",
      output: "$0.550",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    modelId: "claude-sonnet-5.5",
    provider: "const",
    providerName: "Const",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.790",
      cache: "$0.150",
      output: "$3.900",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "grok-4.7",
    name: "Grok 4.7",
    modelId: "grok-4.7",
    provider: "const",
    providerName: "Const",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 500000,
    contextWindow: "500K",
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    pricing: {
      input: "$0.140",
      cache: "$0.035",
      output: "$0.450",
      unit: "/ 1M tokens",
    },
    inputTypes: ["text"],
    outputTypes: ["text"],
  },

  // --- UTILITY ENGINES ---
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
    pricing: {
      input: "$0.006",
      cache: "-",
      output: "-",
      unit: "/ minute",
    },
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
    pricing: {
      input: "$0.005",
      cache: "-",
      output: "-",
      unit: "/ search",
    },
    inputTypes: ["text", "search"],
    outputTypes: ["text"],
  },
];

export const FREE_MODEL_IDS = [
  "deepseek-v4.1-flash:free",
  "qwen-3.8-omni-flash:free",
  "glm-5.3-flash:free",
] as const;
export const DEFAULT_MODEL = FREE_MODEL_IDS[0];
export const BUILTIN_MODELS: ModelSpec[] = [
  ...CATALOG_MODELS.filter((m) => m.tier === "free").map((m) => ({
    ...m,
    id: m.id + ":free",
    name: m.name + ":free",
    modelId: m.modelId + ":free",
    pricing: { input: "$0", cache: "$0", output: "$0", unit: "/ 1M tokens" },
  })),
  ...CATALOG_MODELS.map((m) => ({ ...m, tier: "paid" as const })),
];
const UPSTREAM_MODELS: Record<string, string> = {
  "deepseek-v4.1-flash": "atmo/ali/deepseek-v4.1-flash-1017",
  "qwen-3.8-omni-flash": "atmo/ali/qwen3.8-omni-flash",
  "glm-5.3-flash": "atmo/zai/glm-5.3-flash",
  "gemini-3.8-flash": "Gemini 3.8 Flash",
  "glm-5.3": "atmo/ali/glm-5.3",
  "minimax-m3.1-flash": "atmo/cb/minimax-m3.1-flash",
  "qwen-3.8-max": "atmo/ali/qwen3.8-max-0902",
  "gpt-6.1-sol": "atmo/cx/gpt-6.1-sol",
  "gpt-6-astra": "atmo/cx/gpt-6-astra",
  "claude-haiku-5.5": "atmo/cc/claude-haiku-5-5",
  "claude-sonnet-5.5": "atmo/cc/claude-sonnet-5-5",
  "grok-4.7": "atmo/grok/grok-4.7",
  "whisper-large-v3-turbo": "Whisper Large v3 Turbo",
  "const-search": "Const Search",
};
// Only canonical, explicitly listed IDs can execute. Never strip an arbitrary :free suffix.
export function getManagedModel(id: string): ModelSpec | undefined {
  return BUILTIN_MODELS.find((m) => m.modelId === id);
}
export function normalizeConstModelName(id: string): string {
  const model = getManagedModel(id);
  if (!model)
    throw new Error("Unknown model '" + id + "'. Use GET /v1/models.");
  return UPSTREAM_MODELS[model.modelId.replace(/:free$/, "")]!;
}
export function findModelSpec(
  id: string,
  customModels: ModelSpec[] = [],
): ModelSpec | undefined {
  return [...customModels, ...BUILTIN_MODELS].find(
    (m) => m.modelId === id || m.id === id,
  );
}
export function isBuiltinModel(
  id: string,
  _customModels: ModelSpec[] = [],
): boolean {
  return Boolean(getManagedModel(id));
}
export const NANO_USD = 1_000_000_000;
export function tokenCostNano(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens = 0,
): number {
  const model = getManagedModel(modelId);
  if (!model) throw new Error("Unknown model");
  if (model.tier === "free") return 0;
  const rate = (s?: string) => Number((s || "0").replace(/[^0-9.]/g, "")) || 0;
  return Math.ceil(
    (Math.max(0, promptTokens - cachedTokens) * rate(model.pricing?.input) +
      cachedTokens * rate(model.pricing?.cache || model.pricing?.input) +
      completionTokens * rate(model.pricing?.output)) *
      1000,
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
 * Checks if a model identifier belongs to an image generation or editing model.
 */
export function isImageModel(modelId: string): boolean {
  if (!modelId) return false;
  const clean = modelId.toLowerCase().trim();
  return (
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
    /(?:^|[-_/ ])(low|medium|high|minimal|max|deep)\b/i.test(
      cleanId.split("/").pop() || "",
    ) ||
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
 * - Base generative models (gemini-3.8-flash, deepseek-v4.1-flash, claude-opus-5, etc.): true (dynamic thinking UI shown)
 */
export function checkSupportsThinking(
  modelId: string,
  customModels: ModelSpec[] = [],
  name?: string,
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
export function isReasoningModel(
  modelId: string,
  capabilities?: string[],
  name?: string,
): boolean {
  if (capabilities?.includes("no-thinking")) return false;
  if (capabilities?.includes("fixed-thinking")) return false;
  if (isNonGenerativeModel(modelId)) return false;
  if (hasFixedThinking(modelId, name)) return false;
  return true;
}

export function formatTokenDisplay(
  tokens?: number | string | null,
  fallback: string = "1M",
): string {
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
