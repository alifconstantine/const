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

export interface ModelPromo {
  /** Additional limited-time discount on top of Const's 40%-off-official standard rate */
  extraPercentOff: number;
  /** Combined total percentage discount vs official vendor rate */
  totalPercentOff: number;
  label: string;
  endsAt?: string;
  pricing: ModelPricing;
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
  standardPricing?: ModelPricing;
  promo?: ModelPromo;
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

export const LIMITED_PROMO_ENDS_AT = "2026-12-05T00:00:00.000Z";

function rateTokens(input: string, output: string, cache?: string): ModelPricing {
  return {
    input,
    cache: cache ?? input,
    output,
    unit: "/ 1M tokens",
  };
}

function buildPromo(
  extraPercentOff: number,
  totalPercentOff: number,
  input: string,
  output: string,
  cache: string,
  endsAt = LIMITED_PROMO_ENDS_AT,
): ModelPromo {
  return {
    extraPercentOff,
    totalPercentOff,
    label: `Limited -${extraPercentOff}%`,
    endsAt,
    pricing: rateTokens(input, output, cache),
  };
}

export function isPromoActive(model: ModelSpec, now = Date.now()): boolean {
  if (!model.promo) return false;
  if (!model.promo.endsAt) return true;
  const endsAtMs = Date.parse(model.promo.endsAt);
  return Number.isFinite(endsAtMs) && now < endsAtMs;
}

export function effectiveModelPricing(
  model: ModelSpec,
  now = Date.now(),
): ModelPricing | undefined {
  if (isPromoActive(model, now)) return model.promo!.pricing;
  return model.standardPricing ?? model.pricing;
}

// Built-in models matching exactly what is managed by Const Gateway (<= 3 months old, >= Aug 2026)
const CATALOG_MODELS: ModelSpec[] = [
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
    standardPricing: rateTokens("$0.090", "$0.360", "$0.0135"),
    promo: buildPromo(10, 46, "$0.081", "$0.324", "$0.012"),
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
    standardPricing: rateTokens("$0.090", "$0.300", "$0.0135"),
    promo: buildPromo(25, 55, "$0.0675", "$0.225", "$0.010"),
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
    standardPricing: rateTokens("$0.090", "$0.360", "$0.0135"),
    promo: buildPromo(20, 52, "$0.072", "$0.288", "$0.011"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "qwen-3.8-27b",
    name: "Qwen 3.8 27B",
    modelId: "qwen-3.8-27b",
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
    officialPricing: rateTokens("$0.500", "$3.000", "$0.050"),
    standardPricing: rateTokens("$0.300", "$1.800", "$0.045"),
    promo: buildPromo(50, 70, "$0.150", "$0.900", "$0.0225"),
    inputTypes: ["text", "image", "video"],
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
    standardPricing: rateTokens("$0.450", "$2.250", "$0.0675"),
    promo: buildPromo(40, 64, "$0.270", "$1.350", "$0.0405"),
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
    standardPricing: rateTokens("$0.060", "$0.300", "$0.009"),
    promo: buildPromo(25, 55, "$0.045", "$0.225", "$0.007"),
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
    standardPricing: rateTokens("$0.060", "$0.300", "$0.009"),
    promo: buildPromo(50, 70, "$0.030", "$0.150", "$0.0045"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },

  // --- FRONTIER & REASONING MODELS ---
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek v4 Pro",
    modelId: "deepseek-v4-pro",
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
    officialPricing: rateTokens("$0.660", "$1.980", "$0.066"),
    standardPricing: rateTokens("$0.396", "$1.188", "$0.060"),
    promo: buildPromo(50, 70, "$0.198", "$0.594", "$0.030"),
    inputTypes: ["text"],
    outputTypes: ["text"],
  },
  {
    id: "qwen-3.8-max",
    name: "Qwen 3.8 Max",
    modelId: "qwen-3.8-max",
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
    officialPricing: rateTokens("$2.000", "$6.000", "$0.200"),
    standardPricing: rateTokens("$1.200", "$3.600", "$0.180"),
    promo: buildPromo(50, 70, "$0.600", "$1.800", "$0.090"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "qwen-3.8-2.4t-a95b",
    name: "Qwen 3.8 2.4T A95B",
    modelId: "qwen-3.8-2.4t-a95b",
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
    officialPricing: rateTokens("$2.000", "$6.000", "$0.200"),
    standardPricing: rateTokens("$1.200", "$3.600", "$0.180"),
    promo: buildPromo(60, 76, "$0.480", "$1.440", "$0.072"),
    inputTypes: ["text"],
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
    maxOutputLength: 128000,
    maxOutputTokens: "128K",
    supportsThinking: true,
    thinkingDefault: "medium",
    officialPricing: rateTokens("$1.400", "$4.400", "$0.140"),
    standardPricing: rateTokens("$0.840", "$2.640", "$0.126"),
    promo: buildPromo(40, 64, "$0.504", "$1.584", "$0.076"),
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
    standardPricing: rateTokens("$1.200", "$6.000", "$0.180"),
    promo: buildPromo(25, 55, "$0.900", "$4.500", "$0.135"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "kimi-k3",
    name: "Kimi K3",
    modelId: "kimi-k3",
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
    officialPricing: rateTokens("$3.000", "$15.000", "$0.300"),
    standardPricing: rateTokens("$1.800", "$9.000", "$0.270"),
    promo: buildPromo(30, 58, "$1.260", "$6.300", "$0.189"),
    inputTypes: ["text", "image", "video"],
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
    officialPricing: rateTokens("$2.000", "$12.000", "$0.200"),
    standardPricing: rateTokens("$1.200", "$7.200", "$0.180"),
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
    standardPricing: rateTokens("$1.200", "$6.000", "$0.180"),
    promo: buildPromo(30, 58, "$0.840", "$4.200", "$0.126"),
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
    standardPricing: rateTokens("$2.400", "$12.000", "$0.360"),
    promo: buildPromo(35, 61, "$1.560", "$7.800", "$0.234"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "claude-fable-5.1",
    name: "Claude Fable 5.1",
    modelId: "claude-fable-5.1",
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
    officialPricing: rateTokens("$10.000", "$50.000", "$1.000"),
    standardPricing: rateTokens("$6.000", "$30.000", "$0.900"),
    promo: buildPromo(20, 52, "$4.800", "$24.000", "$0.720"),
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
    standardPricing: rateTokens("$0.600", "$3.000", "$0.090"),
    promo: buildPromo(50, 70, "$0.300", "$1.500", "$0.045"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-6.1-sol",
    name: "GPT 6.1 Sol",
    modelId: "gpt-6.1-sol",
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
    standardPricing: rateTokens("$1.200", "$6.000", "$0.180"),
    promo: buildPromo(50, 70, "$0.600", "$3.000", "$0.090"),
    inputTypes: ["text", "image"],
    outputTypes: ["text"],
  },
  {
    id: "gpt-6-astra",
    name: "GPT 6 Astra",
    modelId: "gpt-6-astra",
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
    officialPricing: rateTokens("$10.000", "$50.000", "$1.000"),
    standardPricing: rateTokens("$6.000", "$30.000", "$0.900"),
    promo: buildPromo(60, 76, "$2.400", "$12.000", "$0.360"),
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
    standardPricing: rateTokens("$1.200", "$3.600", "$0.180"),
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
export const BUILTIN_MODELS: ModelSpec[] = CATALOG_MODELS.map((m) => ({
  ...m,
  tier: "paid",
  pricing: effectiveModelPricing(m) ?? m.pricing,
}));

const UPSTREAM_MODELS: Record<string, string> = {
  "deepseek-v4.1-flash": "atmo/ali/deepseek-v4.1-flash",
  "deepseek-v4-pro": "atmo/ali/deepseek-v4-pro-0813",
  "glm-5.3-flash": "atmo/cbcn/glm-5.3-flash",
  "glm-5.3": "atmo/ali/glm-5.3",
  "minimax-m3.1-flash": "atmo/cbcn/minimax-m3.1-flash",
  "qwen-3.8-27b": "atmo/ali/qwen3.8-27b",
  "qwen-3.8-max": "atmo/ali/qwen3.8-max-0902",
  "qwen-3.8-2.4t-a95b": "atmo/ali/qwen3.8-2.4t-a95b",
  "kimi-k3.1-pro": "atmo/cbcn/kimi-k3.1-pro",
  "kimi-k3": "atmo/cbcn/kimi-k3",
  "gemini-3.8-flash": "atmo/ag/gemini-3.8-flash-high",
  "gemini-4-argon": "atmo/ag/gemini-4-argon",
  "claude-haiku-5.5": "atmo/cc/claude-haiku-5-5",
  "claude-sonnet-5.5": "atmo/cc/claude-sonnet-5-5",
  "claude-opus-5.5": "atmo/cc/claude-opus-5-5",
  "claude-fable-5.1": "atmo/cc/claude-fable-5-1",
  "gpt-6-luna": "atmo/cx/gpt-6-luna",
  "gpt-6.1-terra": "atmo/cx/gpt-6.1-terra",
  "gpt-6.1-sol": "atmo/cx/gpt-6.1-sol",
  "gpt-6-astra": "atmo/cx/gpt-6-astra",
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

export function modelRatesNanoPerToken(model: ModelSpec, now = Date.now()) {
  const pricing = effectiveModelPricing(model, now);
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
  now = Date.now(),
): number {
  const model = getManagedModel(modelId);
  if (!model) throw new Error("Unknown model");
  const rates = modelRatesNanoPerToken(model, now);
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
