import type { ModelConfig } from "./types.js";

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: "Const",
    displayName: "Gemini 3.6 Flash (Const Engine)",
    provider: "const-engine",
    baseUrl: "https://engine.const.web.id/v1",
    supportsThinking: true,
    supportsTools: true,
  },
  {
    id: "antigravity/gemini-3.6-flash-low",
    displayName: "Gemini 3.6 Flash (Fast)",
    provider: "const-engine",
    baseUrl: "https://engine.const.web.id/v1",
    supportsThinking: false,
    supportsTools: true,
  },
  {
    id: "antigravity/claude-sonnet-4-6-medium",
    displayName: "Claude Sonnet 4.6",
    provider: "const-engine",
    baseUrl: "https://engine.const.web.id/v1",
    supportsThinking: false,
    supportsTools: true,
  },
  {
    id: "antigravity/claude-opus-4-6-thinking-medium",
    displayName: "Claude Opus 4.6 (DeepThinking)",
    provider: "const-engine",
    baseUrl: "https://engine.const.web.id/v1",
    supportsThinking: true,
    supportsTools: true,
  },
];

export const DEFAULT_MODEL_ID = "Const";
export const DEFAULT_MODEL_DISPLAY_NAME = "Gemini 3.6 Flash";
