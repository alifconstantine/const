import type { ModelConfig } from "./types.js";

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: "gemini-3.6-flash",
    displayName: "Gemini 3.6 Flash",
    provider: "const",
    baseUrl: "https://router.const.web.id/v1",
    supportsThinking: true,
    supportsTools: true,
  },
];

export const DEFAULT_MODEL_ID = "gemini-3.6-flash";
export const DEFAULT_MODEL_DISPLAY_NAME = "Gemini 3.6 Flash";
