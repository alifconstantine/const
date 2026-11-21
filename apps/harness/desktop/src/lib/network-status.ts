import { useCallback, useEffect, useState } from "react";
import { loadMultiModalConfig } from "./models-config";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

export function isLocalProviderBaseUrl(baseUrl?: string): boolean {
  if (!baseUrl || typeof baseUrl !== "string") return false;
  const trimmed = baseUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    return LOCAL_HOSTNAMES.has(host) || host.endsWith(".local");
  } catch {
    return /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(trimmed);
  }
}

export function isActiveLlmLocal(modelKey?: string | null): boolean {
  try {
    const { llm } = loadMultiModalConfig();
    let targetProvider = llm.providers.find((p) => p.id === llm.activeProviderId);
    if (modelKey) {
      const slashIdx = modelKey.indexOf("/");
      if (slashIdx > 0) {
        const prefix = modelKey.slice(0, slashIdx);
        const byPrefix = llm.providers.find((p) => p.id === prefix);
        if (byPrefix) targetProvider = byPrefix;
      } else {
        const byModel = llm.providers.find((p) =>
          p.models.some((m) => m.id === modelKey || m.name === modelKey),
        );
        if (byModel) targetProvider = byModel;
      }
    }
    return isLocalProviderBaseUrl(targetProvider?.baseUrl);
  } catch {
    return false;
  }
}

export function isActiveSttLocal(): boolean {
  try {
    const { stt } = loadMultiModalConfig();
    const active =
      stt.providers.find((p) => p.id === stt.activeProviderId) ||
      stt.providers[0];
    return isLocalProviderBaseUrl(active?.baseUrl);
  } catch {
    return false;
  }
}

const NETWORK_ERROR_PATTERNS = [
  "err_internet_disconnected",
  "err_name_not_resolved",
  "err_network_changed",
  "err_address_unreachable",
  "enotfound",
  "eai_again",
  "enetunreach",
  "ehostunreach",
  "econnrefused",
  "econnreset",
  "etimedout",
  "fetch failed",
  "failed to fetch",
  "networkerror",
  "network error",
  "network request failed",
  "internet disconnected",
  "no internet",
];

export function isNetworkErrorText(text?: string): boolean {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

export const NETWORK_HINT_EVENT = "const:network-hint";

export function emitNetworkHint(hint: "offline" | "recheck" = "recheck"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NETWORK_HINT_EVENT, { detail: hint }));
}

interface NetworkSnapshot {
  isOnline: boolean;
  isChecking: boolean;
}

const state: NetworkSnapshot = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isChecking: false,
};

const listeners = new Set<() => void>();
let initialized = false;
let inFlightCheck: Promise<boolean> | null = null;
let lastProbeAt = 0;
let checkGeneration = 0;

function notify() {
  for (const listener of listeners) listener();
}

function setSnapshot(patch: Partial<NetworkSnapshot>) {
  let changed = false;
  if (patch.isOnline !== undefined && patch.isOnline !== state.isOnline) {
    state.isOnline = patch.isOnline;
    changed = true;
  }
  if (patch.isChecking !== undefined && patch.isChecking !== state.isChecking) {
    state.isChecking = patch.isChecking;
    changed = true;
  }
  if (changed) notify();
}

export async function recheckNetworkStatus(options?: { probe?: boolean; force?: boolean }): Promise<boolean> {
  const probe = options?.probe ?? true;
  const force = options?.force ?? false;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    checkGeneration++;
    setSnapshot({ isOnline: false, isChecking: false });
    return false;
  }

  if (inFlightCheck) return inFlightCheck;
  const now = Date.now();
  if (!force && probe && now - lastProbeAt < 1500) {
    return state.isOnline;
  }

  const gen = ++checkGeneration;
  setSnapshot({ isChecking: true });
  inFlightCheck = (async () => {
    try {
      const checkOnline =
        typeof window !== "undefined" ? window.electron?.network?.checkOnline : undefined;
      if (checkOnline) {
        if (probe) lastProbeAt = Date.now();
        const res = await checkOnline({ probe });
        if (gen !== checkGeneration || (typeof navigator !== "undefined" && navigator.onLine === false)) {
          return state.isOnline;
        }
        const nextOnline = Boolean(res?.online);
        setSnapshot({ isOnline: nextOnline, isChecking: false });
        return nextOnline;
      }

      if (probe && typeof fetch === "function" && typeof window !== "undefined") {
        lastProbeAt = Date.now();
        try {
          await fetch(window.location.origin, {
            method: "HEAD",
            cache: "no-store",
            signal: AbortSignal.timeout(3500),
          });
          if (gen !== checkGeneration || (typeof navigator !== "undefined" && navigator.onLine === false)) {
            return state.isOnline;
          }
          setSnapshot({ isOnline: true, isChecking: false });
          return true;
        } catch {
          if (gen !== checkGeneration) return state.isOnline;
          setSnapshot({ isOnline: false, isChecking: false });
          return false;
        }
      }

      const fallbackOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (gen === checkGeneration) {
        setSnapshot({ isOnline: fallbackOnline, isChecking: false });
      }
      return fallbackOnline;
    } catch {
      const fallbackOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (gen === checkGeneration) {
        setSnapshot({ isOnline: fallbackOnline, isChecking: false });
      }
      return fallbackOnline;
    } finally {
      inFlightCheck = null;
    }
  })();

  return inFlightCheck;
}

function ensureGlobalListeners() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const handleOffline = () => {
    checkGeneration++;
    setSnapshot({ isOnline: false, isChecking: false });
  };

  const handleOnline = () => {
    void recheckNetworkStatus({ probe: true, force: true });
  };

  const handleHint = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail === "offline") {
      void recheckNetworkStatus({ probe: true, force: true });
    } else {
      void recheckNetworkStatus({ probe: true });
    }
  };

  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);
  window.addEventListener(NETWORK_HINT_EVENT, handleHint);

  void recheckNetworkStatus({ probe: false });
}

export function useNetworkStatus() {
  const [, setTick] = useState(0);

  useEffect(() => {
    ensureGlobalListeners();
    const update = () => setTick((t) => t + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const recheck = useCallback(() => recheckNetworkStatus({ probe: true, force: true }), []);

  return {
    isOnline: state.isOnline,
    isChecking: state.isChecking,
    recheck,
  };
}
