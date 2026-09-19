/**
 * Unified Voice & Speech Types for Const Learn.
 * Supports Inworld TTS (Official) and OpenAI Compatible /v1/audio/speech.
 */

export type VoiceProtocol = "inworld" | "openai-speech";

export interface VoiceModelOption {
  id: string;
  name: string;
  badge?: string;
  descEn?: string;
  descId?: string;
  latency?: string;
  languages?: string;
}

export interface VoiceCharacter {
  id: string;
  name: string;
  langCode?: string;
  gender?: string;
  description?: string;
  tags?: string[];
}

export interface VoiceProvider {
  id: string;
  name: string;
  baseUrl: string;
  protocol: VoiceProtocol;
  apiKey?: string;
  model: string;
  voice: string;
  voiceName?: string;
  deliveryMode?: "BALANCED" | "STABLE" | "EXPRESSIVE";
  speed?: number;
  isDefault?: boolean;
  isCustom?: boolean;
}

export interface VoiceConfigState {
  providers: VoiceProvider[];
  activeProviderId: string;
  testText?: string;
}
