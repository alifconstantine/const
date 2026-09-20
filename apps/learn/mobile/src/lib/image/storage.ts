import type { ImageConfigState, ImageProvider } from "./types";

const STORAGE_KEY_IMAGE_PROVIDERS = "const_learn_image_providers";
const STORAGE_KEY_ACTIVE_IMAGE_PROVIDER = "const_learn_active_image_provider";
const STORAGE_KEY_ACTIVE_IMAGE_MODEL = "const_learn_active_image_model";

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
        providers = parsed;
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
