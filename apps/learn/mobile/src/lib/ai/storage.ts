import type { AiProvider, AiModel } from "./types";
import { CONST_ROUTER_PROVIDER } from "./providers/const-router";

const STORAGE_KEY_PROVIDERS = "const_learn_mobile_providers";
const STORAGE_KEY_ACTIVE_MODEL = "const_learn_active_model";
const STORAGE_KEY_ACTIVE_PROVIDER = "const_learn_active_provider";

export interface AiConfigState {
  providers: AiProvider[];
  activeProviderId: string;
  activeModelId: string;
}

export function getStoredAiConfig(): AiConfigState {
  if (typeof localStorage === "undefined") {
    return {
      providers: [CONST_ROUTER_PROVIDER],
      activeProviderId: "const-router",
      activeModelId: "gemini-3.8-flash",
    };
  }

  let providers: AiProvider[] = [CONST_ROUTER_PROVIDER];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROVIDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasConstRouter = parsed.some((p) => p.id === "const-router");
        providers = hasConstRouter ? parsed : [CONST_ROUTER_PROVIDER, ...parsed];
      }
    }
  } catch {}

  // Sanitize providers to remove const-search and audio models
  providers = providers.map((p) => ({
    ...p,
    models: (p.models || []).filter((m) => {
      const id = (m.id || "").toLowerCase();
      return id !== "const-search" && !id.includes("whisper") && !id.includes("transcription");
    }),
  }));

  const activeProviderId =
    localStorage.getItem(STORAGE_KEY_ACTIVE_PROVIDER) || "const-router";
  let activeModelId =
    localStorage.getItem(STORAGE_KEY_ACTIVE_MODEL) || "gemini-3.8-flash";
  if (activeModelId === "const-search" || activeModelId.includes("whisper")) {
    activeModelId = "gemini-3.8-flash";
  }

  return {
    providers,
    activeProviderId,
    activeModelId,
  };
}

export function saveStoredAiConfig(state: Partial<AiConfigState>): void {
  if (typeof localStorage === "undefined") return;

  if (state.providers) {
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(state.providers));
  }
  if (state.activeProviderId) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROVIDER, state.activeProviderId);
  }
  if (state.activeModelId) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_MODEL, state.activeModelId);
  }
}
