/**
 * AI Provider and Model Types for Const Learn Mobile.
 * Minimalist, strictly typed, zero-OAuth, adhering to Const Design System.
 */

export interface AiModel {
  id: string;
  name: string;
  contextWindow?: string;
  maxOutputTokens?: string;
  description?: string;
  supportsThinking?: boolean;
}

export type ApiProtocol = "openai-completions" | "anthropic-messages" | "openai-responses" | "gemini";

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  protocol: ApiProtocol;
  isDefault?: boolean;
  isCustom?: boolean;
  models: AiModel[];
}

export interface PresetProviderDefinition {
  id: string;
  name: string;
  baseUrl: string;
  protocol: ApiProtocol;
  defaultModels: AiModel[];
}

export type ModelCategory = "llm" | "image" | "voice";
