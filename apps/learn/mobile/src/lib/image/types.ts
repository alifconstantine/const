/**
 * Image Provider and Model Types for Const Learn Mobile.
 * Supports custom OpenAI-compatible /v1/images/generations providers (OpenRouter, Together AI, Fal, DALL-E, etc.)
 */

export interface ImageModel {
  id: string;
  name: string;
  description?: string;
}

export type ImageProtocol = "openrouter" | "openai-generations" | "openai-image" | "custom";

export interface ImageProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  protocol: ImageProtocol;
  isDefault?: boolean;
  models: ImageModel[];
}

export interface ImageConfigState {
  providers: ImageProvider[];
  activeProviderId: string;
  activeModelId: string;
}
