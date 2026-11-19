export const DEFAULT_CONTEXT_WINDOW = "1000000"; // 1M
export const DEFAULT_MAX_OUTPUT = "128000"; // 128K
export const DEFAULT_INPUT_TYPES = ["text"];
export const DEFAULT_OUTPUT_TYPES = ["text"];

export type ThinkingLevel = "low" | "medium" | "high" | "xhigh" | "max";

export type ModelVendor =
  | "anthropic"
  | "openai"
  | "google"
  | "deepseek"
  | "qwen"
  | "zhipu"
  | "minimax"
  | "moonshot"
  | "xai"
  | "const";

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
  vendor?: ModelVendor;
  vendorName?: string;
  providerDocId?: string;
  supportsThinking: boolean;
  thinkingDefault?: ThinkingLevel;
  pricing?: ModelPricing;
  officialPricing?: ModelPricing;
  isCombo?: boolean;
  comboSlug?: string;
  modelsCount?: number;
  description?: string;
  contextLength?: number;
  contextWindow?: string;
  maxOutputLength?: number;
  maxOutputTokens?: string;
  category?: "llm" | "stt" | "search" | "image";
  endpoint?: string;
  tier?: "free" | "paid";
  inputTypes?: string[];
  outputTypes?: string[];
}

function rateTokens(input: string, output: string, cache?: string): ModelPricing {
  return {
    input,
    cache: cache ?? input,
    output,
    unit: "/ 1M tokens",
  };
}

// Built-in models matching exactly what is managed by Const Gateway (<= 3 months old, >= Aug 2026)
export const BUILTIN_MODELS: ModelSpec[] = [
  // --- FAST / DAILY CODING MODELS ---
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek v4.1 Flash",
    modelId: "deepseek-v4.1-flash",
    provider: "const",
    providerName: "Const",
    vendor: "deepseek",
    vendorName: "DeepSeek",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$0.150", "$0.600", "$0.015"),
    pricing: rateTokens("$0.0225", "$0.09", "$0.00225"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    modelId: "glm-5.3-flash",
    provider: "const",
    providerName: "Const",
    vendor: "zhipu",
    vendorName: "GLM (Z.ai)",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 48000,
    maxOutputTokens: "48K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$0.150", "$0.500", "$0.015"),
    pricing: rateTokens("$0.01875", "$0.0625", "$0.001875"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash",
    modelId: "minimax-m3.1-flash",
    provider: "const",
    providerName: "Const",
    vendor: "minimax",
    vendorName: "MiniMax",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$0.150", "$0.600", "$0.015"),
    pricing: rateTokens("$0.0225", "$0.09", "$0.00225"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    modelId: "gemini-3.8-flash",
    provider: "const",
    providerName: "Const",
    vendor: "google",
    vendorName: "Google",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 65536,
    maxOutputTokens: "64K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$0.750", "$3.750", "$0.075"),
    pricing: rateTokens("$0.1125", "$0.5625", "$0.01125"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "claude-haiku-5.5",
    name: "Claude Haiku 5.5",
    modelId: "claude-haiku-5.5",
    provider: "const",
    providerName: "Const",
    vendor: "anthropic",
    vendorName: "Claude",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$0.100", "$0.500", "$0.010"),
    pricing: rateTokens("$0.04", "$0.20", "$0.004"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-6-luna",
    name: "GPT 6 Luna",
    modelId: "gpt-6-luna",
    provider: "const",
    providerName: "Const",
    vendor: "openai",
    vendorName: "OpenAI",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 272000,
    contextWindow: "272K",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$0.100", "$0.500", "$0.010"),
    pricing: rateTokens("$0.015", "$0.075", "$0.0015"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },

  // --- FRONTIER & REASONING MODELS ---
  {
    id: "qwen4-max",
    name: "Qwen4 Max",
    modelId: "qwen4-max",
    provider: "const",
    providerName: "Const",
    vendor: "qwen",
    vendorName: "Qwen",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$1.500", "$4.500", "$0.150"),
    pricing: rateTokens("$0.225", "$0.675", "$0.0225"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "glm-5.3",
    name: "GLM 5.3",
    modelId: "glm-5.3",
    provider: "const",
    providerName: "Const",
    vendor: "zhipu",
    vendorName: "GLM (Z.ai)",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 48000,
    maxOutputTokens: "48K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$1.400", "$4.400", "$0.140"),
    pricing: rateTokens("$0.175", "$0.55", "$0.0175"),
    inputTypes: ["text"],
    outputTypes: ["text"],
  },
  {
    id: "kimi-k3.1-pro",
    name: "Kimi K3.1 Pro",
    modelId: "kimi-k3.1-pro",
    provider: "const",
    providerName: "Const",
    vendor: "moonshot",
    vendorName: "Kimi (Moonshot)",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 32000,
    maxOutputTokens: "32K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$2.000", "$10.000", "$0.200"),
    pricing: rateTokens("$0.40", "$2.00", "$0.04"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gemini-4-hydrogen",
    name: "Gemini 4 Hydrogen",
    modelId: "gemini-4-hydrogen",
    provider: "const",
    providerName: "Const",
    vendor: "google",
    vendorName: "Google",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 65536,
    maxOutputTokens: "64K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$1.500", "$7.500", "$0.150"),
    pricing: rateTokens("$0.225", "$1.125", "$0.0225"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    modelId: "gemini-4-argon",
    provider: "const",
    providerName: "Const",
    vendor: "google",
    vendorName: "Google",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 65536,
    maxOutputTokens: "64K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$2.000", "$10.000", "$0.200"),
    pricing: rateTokens("$0.30", "$1.50", "$0.03"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gemini-4-carbon",
    name: "Gemini 4 Carbon",
    modelId: "gemini-4-carbon",
    provider: "const",
    providerName: "Const",
    vendor: "google",
    vendorName: "Google",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 65536,
    maxOutputTokens: "64K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$2.000", "$10.000", "$0.200"),
    pricing: rateTokens("$0.30", "$1.50", "$0.03"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    modelId: "claude-sonnet-5.5",
    provider: "const",
    providerName: "Const",
    vendor: "anthropic",
    vendorName: "Claude",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$2.000", "$10.000", "$0.200"),
    pricing: rateTokens("$0.80", "$4.00", "$0.08"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "claude-opus-5.5",
    name: "Claude Opus 5.5",
    modelId: "claude-opus-5.5",
    provider: "const",
    providerName: "Const",
    vendor: "anthropic",
    vendorName: "Claude",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$4.000", "$20.000", "$0.400"),
    pricing: rateTokens("$1.60", "$8.00", "$0.16"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "claude-fable-5.2",
    name: "Claude Fable 5.2",
    modelId: "claude-fable-5.2",
    provider: "const",
    providerName: "Const",
    vendor: "anthropic",
    vendorName: "Claude",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 1000000,
    contextWindow: "1M",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$8.000", "$40.000", "$0.800"),
    pricing: rateTokens("$3.20", "$16.00", "$0.32"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-6.1-terra",
    name: "GPT 6.1 Terra",
    modelId: "gpt-6.1-terra",
    provider: "const",
    providerName: "Const",
    vendor: "openai",
    vendorName: "OpenAI",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 500000,
    contextWindow: "500K",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$1.000", "$5.000", "$0.100"),
    pricing: rateTokens("$0.15", "$0.75", "$0.015"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-6.2-sol",
    name: "GPT 6.2 Sol",
    modelId: "gpt-6.2-sol",
    provider: "const",
    providerName: "Const",
    vendor: "openai",
    vendorName: "OpenAI",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 500000,
    contextWindow: "500K",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$2.000", "$10.000", "$0.200"),
    pricing: rateTokens("$0.30", "$1.50", "$0.03"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-6.2-astra",
    name: "GPT 6.2 Astra",
    modelId: "gpt-6.2-astra",
    provider: "const",
    providerName: "Const",
    vendor: "openai",
    vendorName: "OpenAI",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 272000,
    contextWindow: "272K",
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$8.000", "$40.000", "$0.800"),
    pricing: rateTokens("$1.20", "$6.00", "$0.12"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "grok-4.7",
    name: "Grok 4.7",
    modelId: "grok-4.7",
    provider: "const",
    providerName: "Const",
    vendor: "xai",
    vendorName: "Grok (xAI)",
    tier: "paid",
    category: "llm",
    endpoint: "/v1/chat/completions",
    contextLength: 500000,
    contextWindow: "500K",
    maxOutputLength: 65536,
    maxOutputTokens: "64K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$2.000", "$6.000", "$0.200"),
    pricing: rateTokens("$0.80", "$2.40", "$0.08"),
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
    vendor: "const",
    vendorName: "Const",
    tier: "paid",
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
    vendor: "const",
    vendorName: "Const",
    tier: "paid",
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

export const DEFAULT_MODEL = "deepseek-v4.1-flash";

const UPSTREAM_MODELS: Record<string, string> = {
  "deepseek-v4.1-flash": "atmo/cb/deepseek-v4.1-flash",
  "glm-5.3-flash": "atmo/cb/glm-5.3-flash",
  "glm-5.3": "atmo/cb/glm-5.3",
  "minimax-m3.1-flash": "atmo/cb/minimax-m3.1-flash",
  "qwen4-max": "atmo/ali/qwen4-max",
  "kimi-k3.1-pro": "atmo/cbcn/kimi-k3.1-pro",
  "gemini-3.8-flash": "atmo/ag/gemini-3.8-flash-high",
  "gemini-4-hydrogen": "atmo/nebula/gemini-4-hydrogen",
  "gemini-4-argon": "atmo/nebula/gemini-4-argon",
  "gemini-4-carbon": "atmo/nebula/gemini-4-carbon",
  "claude-haiku-5.5": "atmo/cc/claude-haiku-5-5",
  "claude-sonnet-5.5": "atmo/cc/claude-sonnet-5-5",
  "claude-opus-5.5": "atmo/cc/claude-opus-5-5",
  "claude-fable-5.2": "atmo/cc/claude-fable-5-2",
  "gpt-6-luna": "atmo/cx/gpt-6-luna",
  "gpt-6.1-terra": "atmo/cx/gpt-6.1-terra",
  "gpt-6.2-sol": "atmo/cx/gpt-6.2-sol",
  "gpt-6.2-astra": "atmo/cx/gpt-6.2-astra",
  "grok-4.7": "atmo/grok/grok-4.7",
  "whisper-large-v3-turbo": "Whisper Large v3 Turbo",
  "const-search": "Const Search",
};

// Only canonical, explicitly listed IDs can execute. Never strip an arbitrary :free suffix.
export function getManagedModel(id: string): ModelSpec | undefined {
  return BUILTIN_MODELS.find((m) => m.modelId === id);
}

export function getModelMaxOutputTokens(id: string): number {
  const model = getManagedModel(id);
  return model?.maxOutputLength ?? 128000;
}

export function normalizeConstModelName(id: string): string {
  const model = getManagedModel(id);
  if (!model)
    throw new Error("Unknown model '" + id + "'. Use GET /v1/models.");
  return UPSTREAM_MODELS[model.modelId]!;
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

export function parseUsdRate(s?: string): number {
  return Number((s || "0").replace(/[^0-9.]/g, "")) || 0;
}

export function modelRatesNanoPerToken(model: ModelSpec) {
  const pricing = model.pricing;
  const inputUsdPerMillion = parseUsdRate(pricing?.input);
  const outputUsdPerMillion = parseUsdRate(pricing?.output);
  const cacheUsdPerMillion = pricing?.cache && pricing.cache !== "-"
    ? parseUsdRate(pricing.cache)
    : inputUsdPerMillion;
  return {
    input: inputUsdPerMillion * 1000,
    output: outputUsdPerMillion * 1000,
    cache: cacheUsdPerMillion * 1000,
    unit: inputUsdPerMillion * NANO_USD,
  };
}

export function tokenCostNano(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens = 0,
): number {
  const model = getManagedModel(modelId);
  if (!model) throw new Error("Unknown model");
  const rates = modelRatesNanoPerToken(model);
  return Math.ceil(
    Math.max(0, promptTokens - cachedTokens) * rates.input +
      cachedTokens * rates.cache +
      completionTokens * rates.output,
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
 * - Base generative models (gemini-3.8-flash, deepseek-v4.1-flash, etc.): true (dynamic thinking UI shown)
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
