import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn, toast } from "@const/ui";

interface SubscriptionModel {
  id: string;
  name: string;
  contextWindow: string;
  maxOutput: string;
}

interface SubscriptionProviderItem {
  id: string;
  name: string;
  shortName: string;
  description: string;
  protocol: string;
  authFlow: "oauth-pkce" | "device-code";
  supportsManualCode?: boolean;
  warning?: string;
  models: SubscriptionModel[];
  status: {
    provider: string;
    connected: boolean;
    email?: string;
    accountId?: string;
    orgName?: string;
    planType?: string;
    projectId?: string;
  };
}

interface LoginProgressState {
  provider: string;
  status: "starting" | "awaiting_browser" | "awaiting_device_code" | "exchanging" | "connected" | "error" | "cancelled";
  authUrl?: string;
  userCode?: string;
  verificationUri?: string;
  message?: string;
  error?: string;
}

export interface SubscriptionProvidersPanelProps {
  activeModelId?: string;
  onSelectSubscriptionModel: (fullModelId: string, providerId: string) => void;
}

export function SubscriptionProvidersPanel({
  activeModelId,
  onSelectSubscriptionModel,
}: SubscriptionProvidersPanelProps) {
  const [providers, setProviders] = useState<SubscriptionProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeLogin, setActiveLogin] = useState<LoginProgressState | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const loadProviders = useCallback(async () => {
    const api = (window as any).electron?.oauth;
    if (!api?.listProviders) {
      setLoading(false);
      return;
    }
    try {
      const list = await api.listProviders();
      if (Array.isArray(list)) setProviders(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
    const api = (window as any).electron?.oauth;
    if (!api?.onLoginProgress) return;
    const unsub = api.onLoginProgress((progress: LoginProgressState) => {
      setActiveLogin(progress);
      if (progress.status === "connected" || progress.status === "error" || progress.status === "cancelled") {
        void loadProviders();
        if (progress.status === "connected") {
          window.dispatchEvent(new CustomEvent("const:models-updated"));
          setTimeout(() => setActiveLogin(null), 1500);
        }
      }
    });
    return () => {
      unsub?.();
    };
  }, [loadProviders]);

  const handleSignIn = async (provider: SubscriptionProviderItem) => {
    const api = (window as any).electron?.oauth;
    if (!api?.startLogin) {
      toast.error("OAuth sign-in is only available in the desktop app.");
      return;
    }
    setManualCodeInput("");
    setActiveLogin({
      provider: provider.id,
      status: "starting",
      message: `Starting ${provider.name} sign-in...`,
    });
    try {
      const res = await api.startLogin(provider.id);
      if (res?.success) {
        toast.success(`Connected to ${provider.shortName}`);
        setExpandedId(provider.id);
        await loadProviders();
        window.dispatchEvent(new CustomEvent("const:models-updated"));
      } else if (res?.error && !String(res.error).toLowerCase().includes("cancel")) {
        toast.error(res.error);
      }
    } catch (err: any) {
      if (!String(err?.message || "").toLowerCase().includes("cancel")) {
        toast.error(err?.message || "Sign-in failed");
      }
    }
  };

  const handleCancel = async (providerId: string) => {
    const api = (window as any).electron?.oauth;
    await api?.cancelLogin?.(providerId);
    setActiveLogin(null);
    setManualCodeInput("");
  };

  const handleSubmitManualCode = async (providerId: string) => {
    const api = (window as any).electron?.oauth;
    if (!manualCodeInput.trim() || !api?.submitCode) return;
    const res = await api.submitCode(providerId, manualCodeInput.trim());
    if (res?.success) {
      setManualCodeInput("");
      toast.info("Submitting authorization code...");
    } else {
      toast.error("No active sign-in session waiting for a code.");
    }
  };

  const handleDisconnect = async (provider: SubscriptionProviderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const api = (window as any).electron?.oauth;
    if (!api?.disconnect) return;
    await api.disconnect(provider.id);
    toast.success(`Disconnected ${provider.shortName}`);
    await loadProviders();
    window.dispatchEvent(new CustomEvent("const:models-updated"));
  };

  if (loading || providers.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Account Subscriptions (OAuth)
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Sign in with your ChatGPT Plus/Pro, Claude Pro/Max, Google Gemini, or GitHub Copilot account — no API key needed.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {providers.map((provider) => {
          const isConnected = provider.status.connected;
          const isLoggingIn =
            activeLogin?.provider === provider.id &&
            ["starting", "awaiting_browser", "awaiting_device_code", "exchanging"].includes(activeLogin.status);
          const isExpanded = expandedId === provider.id || isLoggingIn;
          const identityLabel = [
            provider.status.email,
            provider.status.planType ? provider.status.planType.toUpperCase() : undefined,
            provider.status.orgName,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div
              key={provider.id}
              className={cn(
                "settings-surface rounded-2xl bg-neutral-50 dark:bg-[#222222] transition-colors overflow-hidden border border-transparent",
                isConnected && "border-emerald-500/20",
              )}
            >
              {/* Header */}
              <div className="p-4 flex flex-wrap items-center justify-between gap-3 select-none">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === provider.id ? null : provider.id)}
                  className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      isConnected ? "bg-emerald-500" : "bg-neutral-400/50 dark:bg-neutral-600",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{provider.name}</span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10.5px] font-medium shrink-0",
                          isConnected
                            ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {isConnected ? "Connected" : "Subscription"}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                      {isConnected && identityLabel ? identityLabel : provider.description}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {isConnected ? (
                    <button
                      type="button"
                      onClick={(e) => void handleDisconnect(provider, e)}
                      className="h-8 px-3 rounded-xl border border-border/80 hover:border-rose-500/40 hover:text-rose-500 text-xs font-medium text-muted-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  ) : isLoggingIn ? (
                    <button
                      type="button"
                      onClick={() => void handleCancel(provider.id)}
                      className="h-8 px-3 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleSignIn(provider)}
                      className="h-8 px-3.5 rounded-xl bg-[#262626] dark:bg-white text-white dark:text-[#161616] text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Sign In</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === provider.id ? null : provider.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors cursor-pointer"
                    aria-label="Toggle models"
                  >
                    <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                  </button>
                </div>
              </div>

              {/* Expanded Body */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3">
                  {provider.warning && (
                    <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11.5px] text-amber-600 dark:text-amber-300 leading-relaxed">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{provider.warning}</span>
                    </div>
                  )}

                  {/* Active OAuth Progress UI */}
                  {isLoggingIn && activeLogin && (
                    <div className="rounded-xl bg-neutral-100 dark:bg-[#1a1a1a] border border-border/70 p-3 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs text-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
                        <span>{activeLogin.message || "Waiting for authentication..."}</span>
                      </div>

                      {activeLogin.userCode && (
                        <div className="flex items-center justify-between gap-2 rounded-lg bg-background/80 border border-border px-3 py-2">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              One-Time Device Code
                            </div>
                            <div className="font-mono text-base font-semibold tracking-widest text-foreground">
                              {activeLogin.userCode}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(activeLogin.userCode || "");
                                setCopiedCode(true);
                                setTimeout(() => setCopiedCode(false), 1800);
                              }}
                              className="h-7 px-2.5 rounded-lg border border-border text-xs text-foreground hover:bg-secondary flex items-center gap-1 cursor-pointer"
                            >
                              {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedCode ? "Copied" : "Copy"}</span>
                            </button>
                            {activeLogin.verificationUri && (
                              <button
                                type="button"
                                onClick={() => (window as any).electron?.openExternal?.(activeLogin.verificationUri)}
                                className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Open GitHub</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {provider.supportsManualCode && activeLogin.status === "awaiting_browser" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={manualCodeInput}
                            onChange={(e) => setManualCodeInput(e.target.value)}
                            placeholder="Optional: paste redirect URL or code if callback didn't return automatically"
                            className="flex-1 h-8 px-3 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-foreground/20"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSubmitManualCode(provider.id)}
                            disabled={!manualCodeInput.trim()}
                            className="h-8 px-3 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground disabled:opacity-40 cursor-pointer"
                          >
                            Submit
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Curated Subscription Models */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-muted-foreground px-1">
                      Available Subscription Models ({provider.models.length})
                    </div>
                    <div className="divide-y divide-border/40 rounded-xl bg-neutral-100/60 dark:bg-[#1b1b1b] overflow-hidden">
                      {provider.models.map((m) => {
                        const fullId = `sub:${provider.id}/${m.id}`;
                        const isActive = activeModelId === fullId;
                        return (
                          <div
                            key={fullId}
                            className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">{m.name}</div>
                              <div className="text-[10.5px] text-muted-foreground font-mono">
                                {m.id} · ctx {m.contextWindow} · out {m.maxOutput}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={!isConnected}
                              onClick={() => onSelectSubscriptionModel(fullId, provider.id)}
                              className={cn(
                                "h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors shrink-0",
                                isActive
                                  ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                                  : isConnected
                                    ? "bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                                    : "bg-secondary/40 text-muted-foreground opacity-50 cursor-not-allowed",
                              )}
                            >
                              {isActive ? "Active" : "Use Model"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
