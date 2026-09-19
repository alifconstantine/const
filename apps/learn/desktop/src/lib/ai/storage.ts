import type { AiProvider, AiModel } from "./types";
import { CONST_ROUTER_PROVIDER } from "./providers/const-router";

const STORAGE_KEY_PROVIDERS = "const_learn_configured_providers";
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
        // Ensure Const Router always exists as the default first provider
        const hasConstRouter = parsed.some((p) => p.id === "const-router");
        providers = hasConstRouter ? parsed : [CONST_ROUTER_PROVIDER, ...parsed];
      }
    }
  } catch {}

  const activeProviderId =
    localStorage.getItem(STORAGE_KEY_ACTIVE_PROVIDER) || "const-router";
  const activeModelId =
    localStorage.getItem(STORAGE_KEY_ACTIVE_MODEL) || "gemini-3.8-flash";

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

  // Sync with Electron IPC if running in desktop Electron
  if (typeof window !== "undefined" && (window as any).electron?.config?.save) {
    const providersPayload: Record<string, any> = {};
    const customModelsPayload: any[] = [];

    (state.providers || []).forEach((p) => {
      providersPayload[p.id] = {
        name: p.name,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey || "",
        protocol: p.protocol,
      };

      p.models.forEach((m) => {
        customModelsPayload.push({
          id: p.id === "const-router" ? m.id : `${p.name.toLowerCase()}/${m.id}`,
          displayName: m.name,
          provider: p.id,
          baseUrl: p.baseUrl,
          supportsThinking: m.supportsThinking ?? true,
          supportsTools: true,
        });
      });
    });

    (window as any).electron.config
      .save({
        activeModel: state.activeModelId,
        providers: providersPayload,
        customModels: customModelsPayload,
      })
      .catch((err: any) => console.warn("[AiStorage] Failed to sync config to Electron:", err));
  }
}
