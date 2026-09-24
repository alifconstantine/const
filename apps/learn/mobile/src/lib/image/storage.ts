import type { ImageConfigState, ImageProvider, ImageProtocol, ImageModel } from "./types";

const STORAGE_KEY_IMAGE_PROVIDERS = "const_learn_image_providers";
const STORAGE_KEY_ACTIVE_IMAGE_PROVIDER = "const_learn_active_image_provider";
const STORAGE_KEY_ACTIVE_IMAGE_MODEL = "const_learn_active_image_model";

function normalizeProtocol(p?: string, baseUrl?: string): ImageProtocol {
  if (p === "openrouter") return "openrouter";
  if (p === "custom") return "custom";
  if (p === "openai-generations") return "openai-generations";
  if (baseUrl && baseUrl.includes("openrouter.ai")) return "openrouter";
  return "openai-generations";
}

export function getStoredImageConfig(): ImageConfigState {
  if (typeof localStorage === "undefined") {
    return {
      providers: [],
      activeProviderId: "",
      activeModelId: "",
    };
  }

  let providers: ImageProvider[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_IMAGE_PROVIDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        providers = parsed.map((p: any) => ({
          ...p,
          protocol: normalizeProtocol(p.protocol, p.baseUrl),
          models: Array.isArray(p.models) ? p.models : [],
        }));
      }
    }
  } catch {}

  const activeProviderId = localStorage.getItem(STORAGE_KEY_ACTIVE_IMAGE_PROVIDER) || (providers[0]?.id ?? "");
  const activeModelId = localStorage.getItem(STORAGE_KEY_ACTIVE_IMAGE_MODEL) || (providers[0]?.models[0]?.id ?? "");

  return {
    providers,
    activeProviderId,
    activeModelId,
  };
}

export function saveStoredImageConfig(state: Partial<ImageConfigState>): void {
  if (typeof localStorage === "undefined") return;

  if (state.providers !== undefined) {
    localStorage.setItem(STORAGE_KEY_IMAGE_PROVIDERS, JSON.stringify(state.providers));
  }
  if (state.activeProviderId !== undefined) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_IMAGE_PROVIDER, state.activeProviderId);
  }
  if (state.activeModelId !== undefined) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_IMAGE_MODEL, state.activeModelId);
  }
}

/**
 * Returns the currently active image provider and model,
 * falling back to the first available if not explicitly set.
 */
export function getActiveImageModel(): {
  provider: ImageProvider | null;
  model: ImageModel | null;
} {
  const config = getStoredImageConfig();
  if (!config.providers || config.providers.length === 0) {
    return { provider: null, model: null };
  }

  const provider =
    config.providers.find((p) => p.id === config.activeProviderId) ||
    config.providers[0] ||
    null;

  if (!provider) {
    return { provider: null, model: null };
  }

  const model =
    provider.models.find((m) => m.id === config.activeModelId) ||
    provider.models[0] ||
    null;

  return { provider, model };
}
