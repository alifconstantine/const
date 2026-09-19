import type { PresetProviderDefinition } from "../types";

/**
 * Provider presets without hardcoded dummy models.
 * Models must be fetched dynamically from the provider's /models endpoint
 * or added manually by the user.
 */
export const PRESET_PROVIDERS: PresetProviderDefinition[] = [
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
];
