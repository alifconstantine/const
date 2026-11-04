import type { ModelConfig } from "./types.js";

const CONST_ROUTER_BASE_URL = "https://router.const.web.id/v1";
const THINKING_LEVELS: Array<"low" | "medium" | "high" | "xhigh" | "max"> = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

function constModel(
  id: string,
  displayName: string,
  contextWindow: number,
  maxOutputTokens: number,
  inputTypes: Array<"text" | "image" | "audio" | "video"> = ["text", "image"],
): ModelConfig {
  return {
    id,
    displayName,
    provider: "const",
    baseUrl: CONST_ROUTER_BASE_URL,
    supportsThinking: true,
    supportsTools: true,
    thinkingLevels: THINKING_LEVELS,
    defaultThinkingLevel: "medium",
    maxOutputTokens,
    contextWindow,
    inputTypes,
  };
}

export const DEFAULT_MODELS: ModelConfig[] = [
  // Fast / Daily Coding Models
  constModel("deepseek-v4.1-flash", "DeepSeek v4.1 Flash", 1_000_000, 128_000, ["text", "image"]),
  constModel("glm-5.3-flash", "GLM 5.3 Flash", 1_000_000, 48_000, ["text", "image"]),
  constModel("minimax-m3.1-flash", "MiniMax M3.1 Flash", 1_000_000, 128_000, ["text", "image"]),
  constModel("qwen-3.8-27b", "Qwen 3.8 27B", 1_000_000, 128_000, ["text", "image", "video"]),
  constModel("gemini-3.8-flash", "Gemini 3.8 Flash", 1_000_000, 65_536, ["text", "image"]),
  constModel("claude-haiku-5.5", "Claude Haiku 5.5", 1_000_000, 128_000, ["text", "image"]),
  constModel("gpt-6-luna", "GPT 6 Luna", 272_000, 128_000, ["text", "image"]),

  // Frontier & Reasoning Models
  constModel("deepseek-v4-pro", "DeepSeek v4 Pro", 1_000_000, 128_000, ["text"]),
  constModel("qwen-3.8-max", "Qwen 3.8 Max", 1_000_000, 128_000, ["text", "image"]),
  constModel("qwen-3.8-2.4t-a95b", "Qwen 3.8 2.4T A95B", 1_000_000, 128_000, ["text"]),
  constModel("glm-5.3", "GLM 5.3", 1_000_000, 128_000, ["text"]),
  constModel("kimi-k3.1-pro", "Kimi K3.1 Pro", 1_000_000, 32_000, ["text", "image"]),
  constModel("kimi-k3", "Kimi K3", 1_000_000, 32_000, ["text", "image", "video"]),
  constModel("gemini-4-argon", "Gemini 4 Argon", 1_000_000, 65_536, ["text", "image"]),
  constModel("claude-sonnet-5.5", "Claude Sonnet 5.5", 1_000_000, 128_000, ["text", "image"]),
  constModel("claude-opus-5.5", "Claude Opus 5.5", 1_000_000, 128_000, ["text", "image"]),
  constModel("claude-fable-5.1", "Claude Fable 5.1", 1_000_000, 128_000, ["text", "image"]),
  constModel("gpt-6.1-terra", "GPT 6.1 Terra", 500_000, 128_000, ["text", "image"]),
  constModel("gpt-6.1-sol", "GPT 6.1 Sol", 500_000, 128_000, ["text", "image"]),
  constModel("gpt-6-astra", "GPT 6 Astra", 272_000, 128_000, ["text", "image"]),
  constModel("grok-4.7", "Grok 4.7", 500_000, 65_536, ["text"]),

  // Virtual Combos
  {
    id: "combo/auto",
    displayName: "combo/auto",
    provider: "const",
    baseUrl: CONST_ROUTER_BASE_URL,
    supportsThinking: true,
    supportsTools: true,
    thinkingLevels: THINKING_LEVELS,
    defaultThinkingLevel: "medium",
    maxOutputTokens: 128_000,
    contextWindow: 272_000,
  },
  {
    id: "combo/fast",
    displayName: "combo/fast",
    provider: "const",
    baseUrl: CONST_ROUTER_BASE_URL,
    supportsThinking: false,
    supportsTools: true,
    maxOutputTokens: 128_000,
    contextWindow: 272_000,
  },
  {
    id: "combo/coding",
    displayName: "combo/coding",
    provider: "const",
    baseUrl: CONST_ROUTER_BASE_URL,
    supportsThinking: true,
    supportsTools: true,
    thinkingLevels: THINKING_LEVELS,
    defaultThinkingLevel: "high",
    maxOutputTokens: 128_000,
    contextWindow: 1_000_000,
  },
];

export const DEFAULT_MODEL_ID = "gemini-3.8-flash";
export const DEFAULT_MODEL_DISPLAY_NAME = "Gemini 3.8 Flash";
