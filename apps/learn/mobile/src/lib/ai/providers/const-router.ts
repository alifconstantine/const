import type { AiModel, AiProvider } from "../types";

export const CONST_ROUTER_DEFAULT_MODELS: AiModel[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: "1M",
    maxOutputTokens: "128K",
    description: "Advanced reasoning frontier model for complex synthesis",
    supportsThinking: true,
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    contextWindow: "1M",
    maxOutputTokens: "128K",
    description: "Hybrid reasoning model with dynamic thinking depth",
    supportsThinking: true,
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    contextWindow: "1M",
    maxOutputTokens: "128K",
    description: "Fast multimodal reasoning model for exploration and study",
    supportsThinking: true,
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    contextWindow: "1M",
    maxOutputTokens: "128K",
    description: "Dynamic router balancing latency, cost, and output quality",
    supportsThinking: true,
  },
  {
    id: "combo/fast",
    name: "combo/fast",
    contextWindow: "1M",
    maxOutputTokens: "128K",
    description: "Ultra-low latency sub-second responses for rapid dialogue",
    supportsThinking: false,
  },
  {
    id: "combo/coding",
    name: "combo/coding",
    contextWindow: "1M",
    maxOutputTokens: "128K",
    description: "Specialized model for code debugging, syntax, and logic",
    supportsThinking: true,
  },
];

export const CONST_ROUTER_PROVIDER: AiProvider = {
  id: "const-router",
  name: "ConstRouter",
  baseUrl: "https://router.const.web.id/v1",
  protocol: "openai-completions",
  isDefault: true,
  models: CONST_ROUTER_DEFAULT_MODELS,
};
