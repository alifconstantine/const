import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea, cn, toast } from "@const/ui";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { BrandLogo } from "./brand-icons";
import {
  CONST_ROUTER_LLM_MODELS,
  fetchRemoteModels,
  testEndpointPing,
  type LlmModel,
  type LlmProtocol,
  type LlmProvider,
} from "../../lib/models-config";
import { modelDisplayName } from "../../lib/model-identity";

interface SubscriptionModelItem {
  id: string;
  name: string;
  contextWindow?: string;
  maxOutput?: string;
  supportsThinking?: boolean;
  thinkingLevels?: string[];
  inputTypes?: string[];
}

interface RateLimitWindowItem {
  label: string;
  usedPercent?: number;
  remainingPercent?: number;
  resetsAt?: number;
  detail?: string;
}

interface ProviderQuotaSnapshotItem {
  provider: string;
  windows: RateLimitWindowItem[];
  planType?: string;
  source: "api" | "headers";
  updatedAt: number;
}

interface SubscriptionProviderItem {
  id: string;
  name: string;
  shortName: string;
  description: string;
  protocol: string;
  baseUrl: string;
  authFlow: "oauth-pkce" | "device-code";
  supportsManualCode?: boolean;
  models: SubscriptionModelItem[];
  status: {
    provider: string;
    connected: boolean;
    email?: string;
    accountId?: string;
    orgName?: string;
    planType?: string;
    projectId?: string;
    expiresAt?: number;
    discoveredAt?: number;
    quota?: ProviderQuotaSnapshotItem;
    connectedAt?: number;
  };
}

interface LoginProgressState {
  provider: string;
  status:
    | "starting"
    | "awaiting_browser"
    | "awaiting_device_code"
    | "exchanging"
    | "connected"
    | "error"
    | "cancelled";
  authUrl?: string;
  userCode?: string;
  verificationUri?: string;
  message?: string;
  error?: string;
}

export interface SubscriptionProvidersPanelProps {
  constProvider?: LlmProvider;
  activeModelId?: string;
  constAvailableUsd?: number;
  onSelectModel?: (modelId: string, providerId: string) => void;
  onSaveConstProvider?: (updated: LlmProvider) => void;
}

function formatResetCountdown(resetsAt?: number): string | null {
  if (!resetsAt || !Number.isFinite(resetsAt)) return null;
  const diffMs = resetsAt - Date.now();
  if (diffMs <= 0) return "resetting soon";
  const totalMin = Math.floor(diffMs / 60_000);
  if (totalMin < 60) return `resets in ${Math.max(1, totalMin)}m`;
  const totalHours = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  if (totalHours < 24) return `resets in ${totalHours}h ${remMin}m`;
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return `resets in ${days}d ${remHours}h`;
}

function RateLimitSummaryBar({
  windows,
  isRefreshing,
  onRefresh,
}: {
  windows: RateLimitWindowItem[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
}) {
  if (!windows || windows.length === 0) return null;
  return (
    <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.03] px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          Rate Limits &amp; Quota
        </span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh rate limits"
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {windows.map((w, idx) => {
          const used =
            typeof w.usedPercent === "number"
              ? Math.max(0, Math.min(100, w.usedPercent))
              : typeof w.remainingPercent === "number"
                ? Math.max(0, Math.min(100, 100 - w.remainingPercent))
                : undefined;
          const remaining =
            typeof w.remainingPercent === "number"
              ? w.remainingPercent
              : used !== undefined
                ? 100 - used
                : undefined;
          const resetLabel = formatResetCountdown(w.resetsAt);
          const barTone =
            used !== undefined && used >= 90
              ? "bg-red-500"
              : used !== undefined && used >= 75
                ? "bg-amber-500"
                : "bg-foreground/75";
          return (
            <div key={`${w.label}-${idx}`} className="space-y-1 min-w-0">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-foreground truncate">{w.label}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {remaining !== undefined ? `${remaining}% left` : w.detail || ""}
                </span>
              </div>
              {used !== undefined && (
                <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", barTone)}
                    style={{ width: `${used}%` }}
                  />
                </div>
              )}
              {(resetLabel || (remaining !== undefined && w.detail)) && (
                <div className="text-[10px] text-muted-foreground/80 truncate">
                  {[remaining !== undefined ? w.detail : undefined, resetLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatHostLabel(baseUrl?: string): string {
  const raw = (baseUrl || "https://router.const.web.id/v1").trim();
  try {
    return new URL(raw).host || raw;
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "") || "router.const.web.id";
  }
}

export function SubscriptionProvidersPanel({
  constProvider,
  activeModelId,
  constAvailableUsd,
  onSelectModel,
  onSaveConstProvider,
}: SubscriptionProvidersPanelProps) {
  const [providers, setProviders] = useState<SubscriptionProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLogin, setActiveLogin] = useState<LoginProgressState | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Expandable state for OAuth providers (only when connected)
  const [expandedOAuthId, setExpandedOAuthId] = useState<string | null>(null);
  const [fetchingOAuthIds, setFetchingOAuthIds] = useState<Record<string, boolean>>({});
  const [oauthErrors, setOAuthErrors] = useState<Record<string, string>>({});
  const [rateLimitsByProvider, setRateLimitsByProvider] = useState<Record<string, ProviderQuotaSnapshotItem>>({});
  const [fetchingQuotaIds, setFetchingQuotaIds] = useState<Record<string, boolean>>({});
  const autoFetchedOAuthRef = useRef<Set<string>>(new Set());

  // Expandable state + configuration for Const Router at top
  const [isConstExpanded, setIsConstExpanded] = useState(false);
  const [constDraft, setConstDraft] = useState<LlmProvider | null>(constProvider ?? null);
  const [constLiveModels, setConstLiveModels] = useState<LlmModel[]>(
    constProvider?.models ?? CONST_ROUTER_LLM_MODELS,
  );
  const [isFetchingConstModels, setIsFetchingConstModels] = useState(false);
  const [isTestingConstPing, setIsTestingConstPing] = useState(false);
  const [showConstApiKey, setShowConstApiKey] = useState(false);
  const [isAddingConstModel, setIsAddingConstModel] = useState(false);
  const [newConstModelId, setNewConstModelId] = useState("");
  const autoFetchedConstRef = useRef(false);

  useEffect(() => {
    if (constProvider) {
      setConstDraft(constProvider);
      if (constProvider.models && constProvider.models.length > 0 && !autoFetchedConstRef.current) {
        setConstLiveModels(constProvider.models);
      }
    }
  }, [constProvider]);

  const handleFetchConstModels = useCallback(
    async (opts?: { silent?: boolean; providerOverride?: LlmProvider }) => {
      const target = opts?.providerOverride || constDraft || constProvider;
      const baseUrl = (target?.baseUrl || "https://router.const.web.id/v1").trim();
      setIsFetchingConstModels(true);
      try {
        // Prefer direct live /models query from Const Router gateway (using encrypted secret if stored)
        const res = await fetchRemoteModels(baseUrl, target?.apiKey, target?.protocol, {
          providerId: target?.id || "const-router",
          category: "llm",
        });
        let nextModels: LlmModel[] = [];

        if (res.success && res.models && res.models.length > 0) {
          const existingMap = new Map(
            (target?.models || CONST_ROUTER_LLM_MODELS).map((m) => [m.id, m]),
          );
          nextModels = res.models.map((m) => {
            const known = existingMap.get(m.id);
            return {
              id: m.id,
              name: m.name || modelDisplayName(m.id, m.id),
              contextWindow: known?.contextWindow || "128K",
              maxOutput: known?.maxOutput || "32K",
              supportsThinking: known?.supportsThinking,
              thinkingLevels: known?.thinkingLevels,
              inputTypes: known?.inputTypes,
            };
          });
        } else {
          // Also check Electron desktop bridge model discovery for Const Router
          const getModelsApi = (window as any).electron?.getModels;
          if (typeof getModelsApi === "function") {
            const bridgeList = await getModelsApi();
            const routerItems = Array.isArray(bridgeList)
              ? bridgeList.filter(
                  (m: any) =>
                    m &&
                    (m.authType === "router" || m.provider === "const" || m.provider === "const-router"),
                )
              : [];
            if (routerItems.length > 0) {
              nextModels = routerItems.map((m: any) => ({
                id: m.id,
                name: m.displayName || m.name || modelDisplayName(m.id, m.id),
                contextWindow: m.contextWindow ? `${Math.round(m.contextWindow / 1000)}K` : "128K",
                maxOutput: m.maxOutputTokens ? `${Math.round(m.maxOutputTokens / 1000)}K` : "32K",
                supportsThinking: Boolean(m.supportsThinking),
                thinkingLevels: m.thinkingLevels,
                inputTypes: m.inputTypes,
              }));
            }
          }
        }

        if (nextModels.length > 0) {
          setConstLiveModels(nextModels);
          if (target) {
            const updated: LlmProvider = { ...target, models: nextModels };
            setConstDraft(updated);
            onSaveConstProvider?.(updated);
          }
          if (!opts?.silent) {
            toast.success(`Fetched ${nextModels.length} models from Const Router`);
          }
        } else if (!opts?.silent) {
          toast.error(res.error || "Could not fetch models from Const Router");
        }
      } catch (err: any) {
        if (!opts?.silent) {
          toast.error(err?.message || "Failed to fetch models from Const Router");
        }
      } finally {
        setIsFetchingConstModels(false);
      }
    },
    [constDraft, constProvider, onSaveConstProvider],
  );

  // Initial live fetch for Const Router models on mount
  useEffect(() => {
    if (autoFetchedConstRef.current) return;
    autoFetchedConstRef.current = true;
    void handleFetchConstModels({ silent: true });
  }, [handleFetchConstModels]);

  const loadRateLimits = useCallback(async (providerId?: string, forceRefresh = false) => {
    const api = (window as any).electron?.oauth;
    if (!api?.getRateLimits) return;
    if (providerId) {
      setFetchingQuotaIds((prev) => ({ ...prev, [providerId]: true }));
    }
    try {
      const res = await api.getRateLimits(providerId, forceRefresh);
      if (res?.success) {
        if (providerId && res.quota) {
          setRateLimitsByProvider((prev) => ({ ...prev, [providerId]: res.quota }));
        } else if (res.quotas && typeof res.quotas === "object") {
          setRateLimitsByProvider((prev) => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(res.quotas)) {
              if (v) next[k] = v as ProviderQuotaSnapshotItem;
            }
            return next;
          });
        }
      }
    } catch {
      // Ignore rate limit lookup failures gracefully
    } finally {
      if (providerId) {
        setFetchingQuotaIds((prev) => ({ ...prev, [providerId]: false }));
      }
    }
  }, []);

  const loadProviders = useCallback(async () => {
    const api = (window as any).electron?.oauth;
    if (!api?.listProviders) {
      setLoading(false);
      return;
    }
    try {
      const list = await api.listProviders();
      if (Array.isArray(list)) {
        setProviders(list);
        setRateLimitsByProvider((prev) => {
          const next = { ...prev };
          for (const p of list) {
            if (p?.status?.quota) next[p.id] = p.status.quota;
          }
          return next;
        });
      }
    } catch {
      // Ignore transient errors outside Electron
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFetchOAuthModels = useCallback(
    async (providerId: string, opts?: { silent?: boolean }) => {
      const api = (window as any).electron?.oauth;
      if (!api?.fetchModels) return;
      setFetchingOAuthIds((prev) => ({ ...prev, [providerId]: true }));
      setOAuthErrors((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      try {
        const res = await api.fetchModels(providerId);
        void loadRateLimits(providerId, true);
        if (res?.success) {
          await loadProviders();
          const count = Array.isArray(res.models) ? res.models.length : 0;
          if (!opts?.silent) {
            toast.success(
              count > 0 ? `Fetched ${count} models` : "Connected, no models returned",
            );
          }
        } else {
          const errMsg = res?.error || "Failed to fetch models";
          setOAuthErrors((prev) => ({ ...prev, [providerId]: errMsg }));
          if (!opts?.silent) {
            toast.error(errMsg);
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || "Failed to fetch models";
        setOAuthErrors((prev) => ({ ...prev, [providerId]: errMsg }));
        if (!opts?.silent) {
          toast.error(errMsg);
        }
      } finally {
        setFetchingOAuthIds((prev) => ({ ...prev, [providerId]: false }));
      }
    },
    [loadProviders, loadRateLimits],
  );

  useEffect(() => {
    void loadProviders();
    void loadRateLimits(undefined, false);
    const api = (window as any).electron?.oauth;
    const unsubQuota = api?.onRateLimitsUpdated?.((snapshot: ProviderQuotaSnapshotItem) => {
      if (snapshot?.provider) {
        setRateLimitsByProvider((prev) => ({ ...prev, [snapshot.provider]: snapshot }));
      }
    });
    if (!api?.onLoginProgress) {
      return () => {
        try {
          unsubQuota?.();
        } catch {}
      };
    }
    const unsub = api.onLoginProgress((progress: LoginProgressState) => {
      setActiveLogin(progress);
      if (
        progress.status === "connected" ||
        progress.status === "error" ||
        progress.status === "cancelled"
      ) {
        if (progress.status === "connected") {
          void loadProviders();
          setExpandedOAuthId(progress.provider);
          void handleFetchOAuthModels(progress.provider, { silent: true });
        }
        setTimeout(() => {
          setActiveLogin((curr) =>
            curr?.provider === progress.provider && curr.status === progress.status ? null : curr,
          );
        }, 2500);
      }
    });
    return () => {
      try {
        unsub?.();
        unsubQuota?.();
      } catch {}
    };
  }, [loadProviders, loadRateLimits, handleFetchOAuthModels]);

  // If a provider is already signed in on disk with no discoveredModels cached yet, fetch live once
  useEffect(() => {
    for (const p of providers) {
      if (
        p.status.connected &&
        p.models.length === 0 &&
        !autoFetchedOAuthRef.current.has(p.id)
      ) {
        autoFetchedOAuthRef.current.add(p.id);
        void handleFetchOAuthModels(p.id, { silent: true });
      }
    }
  }, [providers, handleFetchOAuthModels]);

  const handleSignIn = async (provider: SubscriptionProviderItem) => {
    const api = (window as any).electron?.oauth;
    if (!api?.startLogin) {
      toast.error("Sign-in requires the Const Harness desktop runtime.");
      return;
    }
    setManualCodeInput("");
    setActiveLogin({
      provider: provider.id,
      status: "starting",
      message: `Opening ${provider.shortName} sign-in...`,
    });
    try {
      const res = await api.startLogin(provider.id);
      if (res?.success) {
        toast.success(`Connected to ${provider.shortName}`);
        await loadProviders();
        setExpandedOAuthId(provider.id);
        setActiveLogin(null);
      } else if (res?.error && !/cancel/i.test(res.error)) {
        toast.error(res.error);
        setActiveLogin(null);
      }
    } catch (err: any) {
      if (!/cancel/i.test(String(err?.message || ""))) {
        toast.error(err?.message || `Failed to connect ${provider.shortName}`);
      }
      setActiveLogin(null);
    }
  };

  const handleCancel = async (providerId: string) => {
    const api = (window as any).electron?.oauth;
    await api?.cancelLogin?.(providerId);
    setActiveLogin(null);
  };

  const handleSubmitManualCode = async (providerId: string) => {
    const api = (window as any).electron?.oauth;
    if (!manualCodeInput.trim() || !api?.submitCode) return;
    const res = await api.submitCode(providerId, manualCodeInput.trim());
    if (!res?.success) {
      toast.error("No pending sign-in session matched this authorization code.");
    } else {
      setManualCodeInput("");
    }
  };

  const handleDisconnect = async (
    provider: SubscriptionProviderItem,
    e?: React.MouseEvent,
  ) => {
    e?.stopPropagation();
    const api = (window as any).electron?.oauth;
    if (!api?.disconnect) return;
    await api.disconnect(provider.id);
    if (expandedOAuthId === provider.id) {
      setExpandedOAuthId(null);
    }
    autoFetchedOAuthRef.current.delete(provider.id);
    toast.success(`Disconnected ${provider.shortName}`);
    await loadProviders();
  };

  const handleTestConstConnection = async () => {
    const target = constDraft || constProvider;
    if (!target?.baseUrl?.trim()) return;
    setIsTestingConstPing(true);
    const res = await testEndpointPing(target.baseUrl, target.apiKey, target.protocol, {
      providerId: target.id || "const-router",
      category: "llm",
    });
    setIsTestingConstPing(false);
    if (res.success) {
      toast.success(`Connected to Const Router (${res.latencyMs ?? 0}ms)`);
    } else {
      toast.error(res.error || "Failed to connect to Const Router");
    }
  };

  const handleSaveConstConfig = () => {
    if (!constDraft) return;
    if (!constDraft.baseUrl.trim()) {
      toast.error("Endpoint URL is required");
      return;
    }
    const updated: LlmProvider = {
      ...constDraft,
      models: constLiveModels,
    };
    onSaveConstProvider?.(updated);
    toast.success("Const Router configuration saved");
    void handleFetchConstModels({ silent: true, providerOverride: updated });
  };

  const handleAddConstModel = () => {
    const cleanId = newConstModelId.trim();
    if (!cleanId) return;
    if (constLiveModels.some((m) => m.id === cleanId)) {
      toast.error("Model ID already in list");
      return;
    }
    const added: LlmModel = {
      id: cleanId,
      name: modelDisplayName(cleanId, cleanId),
      contextWindow: "128K",
      maxOutput: "32K",
    };
    const nextModels = [...constLiveModels, added];
    setConstLiveModels(nextModels);
    if (constDraft) {
      const updated: LlmProvider = { ...constDraft, models: nextModels };
      setConstDraft(updated);
      onSaveConstProvider?.(updated);
    }
    setNewConstModelId("");
    setIsAddingConstModel(false);
    toast.success("Model added");
  };

  const constHost = useMemo(
    () => formatHostLabel(constDraft?.baseUrl || constProvider?.baseUrl),
    [constDraft?.baseUrl, constProvider?.baseUrl],
  );

  return (
    <div className="space-y-2">
      {/* 1. Native Const Router — Always First & Connected */}
      {constProvider && (
        <div className="settings-surface rounded-xl bg-neutral-50 dark:bg-[#222222] transition-colors overflow-hidden">
          <div
            role="button"
            tabIndex={0}
            aria-expanded={isConstExpanded}
            onClick={() => setIsConstExpanded((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsConstExpanded((v) => !v);
              }
            }}
            className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-neutral-100/70 dark:hover:bg-[#282828] transition-colors"
          >
            <div className="min-w-0 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1a1a1a] border border-black/8 dark:border-white/10 flex items-center justify-center shrink-0">
                <BrandLogo provider="const-router" className="w-4 h-4" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground truncate">
                    Const Router
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                </div>
                <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                  {constHost}
                  {constLiveModels.length > 0 ? ` · ${constLiveModels.length} models` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                title="Refresh models"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleFetchConstModels();
                }}
                disabled={isFetchingConstModels}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("w-3.5 h-3.5", isFetchingConstModels && "animate-spin")}
                />
              </button>
              <span className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground">
                {isConstExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            </div>
          </div>

          {isConstExpanded && constDraft && (
            <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4">
              {/* Rate Limits & Credits Bar above Models List */}
              {(() => {
                const windows: RateLimitWindowItem[] = [
                  ...(typeof constAvailableUsd === "number"
                    ? [{ label: "Credit Balance", detail: `$${constAvailableUsd.toFixed(4)} remaining` }]
                    : []),
                  ...(rateLimitsByProvider["const-router"]?.windows || []),
                ];
                return (
                  <RateLimitSummaryBar
                    windows={windows}
                    isRefreshing={Boolean(fetchingQuotaIds["const-router"])}
                    onRefresh={() => void loadRateLimits("const-router", true)}
                  />
                );
              })()}

              {/* Live-fetched Models List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    Available Models ({constLiveModels.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingConstModel((v) => !v)}
                      className="h-7 px-2.5 rounded-lg border border-border hover:bg-secondary/70 text-[11px] font-medium text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleFetchConstModels()}
                      disabled={isFetchingConstModels}
                      className="h-7 px-2.5 rounded-lg border border-border hover:bg-secondary/70 text-[11px] font-medium text-foreground transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={cn("w-3 h-3", isFetchingConstModels && "animate-spin")}
                      />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {isAddingConstModel && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newConstModelId}
                      onChange={(e) => setNewConstModelId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddConstModel();
                        }
                      }}
                      placeholder="Model ID (e.g. gpt-5.4)"
                      className="flex-1 h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-foreground/40"
                    />
                    <button
                      type="button"
                      onClick={handleAddConstModel}
                      className="h-8 px-3 rounded-lg bg-foreground text-background text-[11.5px] font-medium cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}

                {isFetchingConstModels && constLiveModels.length === 0 ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching models from Const Router...</span>
                  </div>
                ) : constLiveModels.length === 0 ? (
                  <div className="py-3 text-xs text-muted-foreground">
                    No models loaded yet. Click Refresh to fetch from Const Router.
                  </div>
                ) : (
                  <ScrollArea className="max-h-56 w-full" viewportClassName="max-h-56 pr-3">
                    <div className="space-y-1">
                      {constLiveModels.map((m) => {
                        const isActive = activeModelId === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onSelectModel?.(m.id, constProvider.id)}
                            className={cn(
                              "settings-model-option w-full px-3 py-2 rounded-lg text-left flex items-center justify-between gap-2 transition-colors cursor-pointer",
                              isActive
                                ? "bg-black/10 dark:bg-white/10 text-foreground"
                                : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-foreground/90",
                            )}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="text-[12.5px] font-medium truncate">
                                {m.name || m.id}
                              </span>
                              {m.name && m.name !== m.id && (
                                <span className="text-[11px] font-mono text-muted-foreground truncate">
                                  {m.id}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {m.contextWindow && (
                                <span className="text-[11px] text-muted-foreground">
                                  {m.contextWindow}
                                </span>
                              )}
                              {isActive && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Router Configuration */}
              <div className="pt-3 border-t border-border/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground block">
                      Gateway URL
                    </label>
                    <input
                      type="text"
                      value={constDraft.baseUrl}
                      onChange={(e) =>
                        setConstDraft({ ...constDraft, baseUrl: e.target.value })
                      }
                      placeholder="https://router.const.web.id/v1"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground outline-none focus:border-foreground/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground block">
                      API Key Override (Optional)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showConstApiKey ? "text" : "password"}
                        value={constDraft.apiKey || ""}
                        onChange={(e) =>
                          setConstDraft({ ...constDraft, apiKey: e.target.value })
                        }
                        placeholder={
                          constDraft.hasApiKey && constDraft.apiKeyHint
                            ? `Encrypted (${constDraft.apiKeyHint}) — enter to replace`
                            : constDraft.hasApiKey
                              ? "Encrypted key saved — enter to replace"
                              : "Uses Const session when empty"
                        }
                        className="w-full h-8 pl-2.5 pr-8 rounded-lg border border-border bg-background text-xs font-mono text-foreground outline-none focus:border-foreground/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConstApiKey((v) => !v)}
                        className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showConstApiKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleTestConstConnection()}
                      disabled={isTestingConstPing}
                      className="h-7 px-3 rounded-lg border border-border hover:bg-secondary/70 text-[11.5px] font-medium text-foreground transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isTestingConstPing && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Test Connection</span>
                    </button>
                    {constDraft.baseUrl !== "https://router.const.web.id/v1" && (
                      <button
                        type="button"
                        onClick={() =>
                          setConstDraft({
                            ...constDraft,
                            baseUrl: "https://router.const.web.id/v1",
                            protocol: "openai-completions" as LlmProtocol,
                          })
                        }
                        className="h-7 px-2.5 rounded-lg text-[11.5px] text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Reset URL
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveConstConfig}
                    className="h-7 px-3.5 rounded-lg bg-foreground text-background text-[11.5px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Connected & Sign-In Subscription Accounts (OAuth — OMP providers) */}
      {!loading &&
        providers.map((provider) => {
          const isConnected = provider.status.connected;
          const isLoggingIn =
            activeLogin?.provider === provider.id &&
            activeLogin.status !== "connected" &&
            activeLogin.status !== "cancelled";
          const isExpanded = isConnected && expandedOAuthId === provider.id;
          const isFetching = Boolean(fetchingOAuthIds[provider.id]);
          const fetchError = oauthErrors[provider.id];

          const identityLabel = [
            provider.status.email || provider.status.orgName,
            provider.status.planType,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div
              key={provider.id}
              className="settings-surface rounded-xl bg-neutral-50 dark:bg-[#222222] transition-colors overflow-hidden"
            >
              <div
                role={isConnected ? "button" : undefined}
                tabIndex={isConnected ? 0 : undefined}
                aria-expanded={isConnected ? isExpanded : undefined}
                onClick={() => {
                  if (!isConnected) return;
                  const nextExpanded = !isExpanded;
                  setExpandedOAuthId(nextExpanded ? provider.id : null);
                  if (nextExpanded) {
                    void loadRateLimits(provider.id, false);
                    if (provider.models.length === 0 && !isFetching) {
                      void handleFetchOAuthModels(provider.id, { silent: true });
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (!isConnected) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const nextExpanded = !isExpanded;
                    setExpandedOAuthId(nextExpanded ? provider.id : null);
                    if (nextExpanded) {
                      void loadRateLimits(provider.id, false);
                      if (provider.models.length === 0 && !isFetching) {
                        void handleFetchOAuthModels(provider.id, { silent: true });
                      }
                    }
                  }
                }}
                className={cn(
                  "px-4 py-3 flex items-center justify-between gap-3 select-none transition-colors",
                  isConnected &&
                    "cursor-pointer hover:bg-neutral-100/70 dark:hover:bg-[#282828]",
                )}
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1a1a1a] border border-black/8 dark:border-white/10 flex items-center justify-center shrink-0">
                    <BrandLogo provider={provider.id} className="w-4 h-4 text-foreground" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {provider.name}
                      </span>
                      {isConnected && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                      {isConnected
                        ? `${identityLabel || "Connected"}${
                            provider.models.length > 0 ? ` · ${provider.models.length} models` : ""
                          }`
                        : provider.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isConnected ? (
                    <>
                      <button
                        type="button"
                        title="Refresh models"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleFetchOAuthModels(provider.id);
                        }}
                        disabled={isFetching}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw
                          className={cn("w-3.5 h-3.5", isFetching && "animate-spin")}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void handleDisconnect(provider, e)}
                        className="h-8 px-3 rounded-lg border border-border hover:bg-secondary/70 text-xs font-medium text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Disconnect</span>
                      </button>
                      <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                    </>
                  ) : isLoggingIn ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleCancel(provider.id);
                      }}
                      className="h-8 px-3 rounded-lg border border-border hover:bg-secondary/70 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSignIn(provider);
                      }}
                      className="h-8 px-3.5 rounded-lg bg-[#262626] dark:bg-white text-white dark:text-[#161616] text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Active Sign-In Progress Banner */}
              {isLoggingIn && activeLogin && (
                <div className="px-4 pb-3 pt-1">
                  <div className="rounded-xl bg-white/80 dark:bg-[#191919] border border-border/70 p-3 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      <span>{activeLogin.message || "Waiting for authentication..."}</span>
                    </div>

                    {activeLogin.status === "awaiting_device_code" && activeLogin.userCode && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Verification code:</span>
                          <code className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-[#2a2a2a] font-mono text-sm font-semibold tracking-wider text-foreground">
                            {activeLogin.userCode}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(activeLogin.userCode || "");
                              setCopiedCode(true);
                              setTimeout(() => setCopiedCode(false), 1500);
                            }}
                            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Copy code"
                          >
                            {copiedCode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {activeLogin.verificationUri && (
                          <button
                            type="button"
                            onClick={() =>
                              (window as any).electron?.openExternal?.(
                                activeLogin.verificationUri!,
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-foreground underline underline-offset-2 cursor-pointer"
                          >
                            Open browser <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {activeLogin.status === "awaiting_browser" && provider.supportsManualCode && (
                      <div className="space-y-2 pt-0.5">
                        {activeLogin.authUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              (window as any).electron?.openExternal?.(activeLogin.authUrl!)
                            }
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
                          >
                            Open authorization page again <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={manualCodeInput}
                            onChange={(e) => setManualCodeInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleSubmitManualCode(provider.id);
                            }}
                            placeholder="Paste callback URL or authorization code if redirect didn't return automatically..."
                            className="flex-1 h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/40"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSubmitManualCode(provider.id)}
                            disabled={!manualCodeInput.trim()}
                            className="h-8 px-3 rounded-lg bg-[#262626] dark:bg-white text-white dark:text-[#161616] text-xs font-medium disabled:opacity-40 cursor-pointer"
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded Live-Fetched Models List for Connected Account */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-2.5">
                  <RateLimitSummaryBar
                    windows={rateLimitsByProvider[provider.id]?.windows || provider.status.quota?.windows || []}
                    isRefreshing={Boolean(fetchingQuotaIds[provider.id])}
                    onRefresh={() => void loadRateLimits(provider.id, true)}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-medium text-muted-foreground">
                      Available Models ({provider.models.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleFetchOAuthModels(provider.id)}
                      disabled={isFetching}
                      className="h-7 px-2.5 rounded-lg border border-border hover:bg-secondary/70 text-[11px] font-medium text-foreground transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
                      <span>Fetch Models</span>
                    </button>
                  </div>

                  {isFetching && provider.models.length === 0 ? (
                    <div className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching models from {provider.shortName}...</span>
                    </div>
                  ) : fetchError && provider.models.length === 0 ? (
                    <div className="py-3 px-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center justify-between gap-2">
                      <span className="truncate">{fetchError}</span>
                      <button
                        type="button"
                        onClick={() => void handleFetchOAuthModels(provider.id)}
                        className="shrink-0 underline font-medium cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  ) : provider.models.length === 0 ? (
                    <div className="py-3 text-xs text-muted-foreground">
                      No models returned yet. Click Fetch Models to load models from your account.
                    </div>
                  ) : (
                    <ScrollArea className="max-h-56 w-full" viewportClassName="max-h-56 pr-3">
                      <div className="space-y-1">
                        {provider.models.map((m) => {
                          const fullId = `sub:${provider.id}/${m.id}`;
                          const isActive = activeModelId === fullId;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => onSelectModel?.(fullId, provider.id)}
                              className={cn(
                                "settings-model-option w-full px-3 py-2 rounded-lg text-left flex items-center justify-between gap-2 transition-colors cursor-pointer",
                                isActive
                                  ? "bg-black/10 dark:bg-white/10 text-foreground"
                                  : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-foreground/90",
                              )}
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <span className="text-[12.5px] font-medium truncate">
                                  {m.name || m.id}
                                </span>
                                {m.name && m.name !== m.id && (
                                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                                    {m.id}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {m.contextWindow && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {m.contextWindow}
                                  </span>
                                )}
                                {isActive && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
