import {
  BUILTIN_MODELS,
  DEFAULT_MODEL,
} from "@const/backend/router/modelCatalog";

export const DEFAULT_ROUTER_MODEL_ID = DEFAULT_MODEL;
export const ROUTER_DEFAULT_MODELS = BUILTIN_MODELS.filter(
  (model) => model.category === "llm",
).map((model) => ({
  id: model.modelId,
  displayName: model.name,
  provider: "const",
  providerName: "Const",
  baseUrl: "https://router.const.web.id/v1",
  supportsThinking: model.supportsThinking ?? false,
  supportsTools: true,
  thinkingLevels: model.supportsThinking
    ? ["low", "medium", "high", "xhigh", "max"]
    : undefined,
  defaultThinkingLevel: "medium",
  maxOutputTokens: 128000,
  contextWindow: model.contextLength || 1000000,
  inputTypes: model.inputTypes,
}));
