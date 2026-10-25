import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Settings,
  Sun,
  Moon,
  Laptop,
  Globe,
  Check,
  ShieldCheck,
  Brain,
  SlidersHorizontal,
  Palette,
  Bot,
  Box,
  ArrowLeftRight,
  LogOut,
  Activity,
  Database,
  Cpu,
  Clock,
  AlertCircle,
  CheckCircle2,
  Info,
  Coins,
  Layers,
  Zap,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useAppAuth } from "../../convex-provider";
import { DefaultModelsSettings } from "../../settings/default-models-settings";
import {
  getStoredComposioUsage,
  getResetCountdown,
  type ComposioUsageRecord,
  WEEKLY_TOOL_CALL_LIMIT,
} from "../../../lib/composio-usage";
import {
  calculateQuotaMetrics,
  formatTokens,
} from "../../../lib/quota";
import {
  useTheme,
  cn,
  Avatar,
  AvatarImage,
  AvatarFallback,
  ScrollArea,
  Skeleton,
  toast,
} from "@const/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../../lib/db";
import { useI18n, LANGUAGE_OPTIONS } from "../../../lib/i18n";
import type { UserProfile } from "../../navbar";
import { InteractiveBottomSheet } from "./interactive-bottom-sheet";

export type SettingsTab = "general" | "usage" | "appearance" | "models";

export interface MobileSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  initialTab?: SettingsTab | "usage-stats" | "all";
}

export const BUILTIN_MODELS = [
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    isDefault: true,
    descEn: "Fast multimodal reasoning model for exploration and study research.",
    descId: "Model reasoning multimodal cepat untuk eksplorasi dan riset materi belajar.",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Hybrid frontier model with dynamic reasoning depth.",
    descId: "Model frontier hybrid dengan kedalaman penalaran dinamis.",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Advanced reasoning model for complex subject synthesis.",
    descId: "Model penalaran tingkat lanjut untuk sintesis materi kompleks.",
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Intelligent dynamic router balancing latency and accuracy.",
    descId: "Dynamic router cerdas yang menyeimbangkan latensi dan keakuratan jawaban.",
  },
  {
    id: "combo/fast",
    name: "combo/fast",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: false,
    descEn: "Sub-second response speed for quick dialogues and rapid summaries.",
    descId: "Kecepatan respons sub-detik untuk dialog cepat dan ringkasan kilat.",
  },
  {
    id: "combo/coding",
    name: "combo/coding",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Specialized model for coding education, syntax, and debugging.",
    descId: "Model khusus untuk pembelajaran pemrograman, sintaks, dan debugging kode.",
  },
];

function getUserInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letterParts = parts.filter((p) => /[a-zA-Z]/.test(p));
    const candidateParts = letterParts.length > 0 ? letterParts : parts;
    const first = candidateParts[0];
    const last = candidateParts.length > 1 ? candidateParts[candidateParts.length - 1] : undefined;
    if (first) {
      const firstLetter = first.match(/[a-zA-Z]/)?.[0] || first[0] || "";
      if (last) {
        const lastLetter = last.match(/[a-zA-Z]/)?.[0] || last[0] || "";
        return (firstLetter + lastLetter).toUpperCase();
      }
      return first.substring(0, 2).toUpperCase();
    }
  }
  if (email && email.trim()) {
    const parts = email.trim().split("@");
    const username = parts[0];
    if (username && username.length > 0) {
      const letters = username.replace(/[^a-zA-Z]/g, "");
      if (letters.length >= 2) return letters.substring(0, 2).toUpperCase();
      return username.substring(0, 2).toUpperCase();
    }
  }
  return "U";
}

function normalizeTab(tab?: string): SettingsTab {
  if (tab === "usage" || tab === "usage-stats") return "usage";
  if (tab === "appearance") return "appearance";
  if (tab === "models") return "models";
  return "general";
}

export function MobileSettingsSheet({
  open,
  onClose,
  user,
  onSignOut,
  onSwitchAccount,
  initialTab = "general",
}: MobileSettingsSheetProps) {
  const { t, language, setLanguage } = useI18n();
  const [theme, setTheme] = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => normalizeTab(initialTab));
  const initials = getUserInitials(user?.name, user?.email);

  const navTabs = [
    { id: "general", label: t("general") || "General", icon: SlidersHorizontal },
    { id: "usage", label: t("usage") || "Usage", icon: Activity },
    { id: "appearance", label: t("theme") || "Appearance", icon: Palette },
    { id: "models", label: t("models") || "Models", icon: Box },
  ] as const;

  // Tab Refs & Sliding Indicator (Matching ModelSelectionSheet and McpToolsSheet)
  const generalTabRef = useRef<HTMLButtonElement>(null);
  const usageTabRef = useRef<HTMLButtonElement>(null);
  const appearanceTabRef = useRef<HTMLButtonElement>(null);
  const modelsTabRef = useRef<HTMLButtonElement>(null);

  const tabRefs: Record<string, React.RefObject<HTMLButtonElement | null>> = {
    general: generalTabRef,
    usage: usageTabRef,
    appearance: appearanceTabRef,
    models: modelsTabRef,
  };

  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (!open) return;
    const updateIndicator = () => {
      const activeEl = tabRefs[activeTab]?.current;
      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    };

    updateIndicator();
    const timer = setTimeout(updateIndicator, 50);
    return () => clearTimeout(timer);
  }, [activeTab, open, language]);

  useEffect(() => {
    if (open) {
      setActiveTab(normalizeTab(initialTab));
    }
  }, [open, initialTab]);

  const [activeModel, setActiveModel] = useState<string>(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("const_learn_active_model") || "gemini-3.8-flash";
    }
    return "gemini-3.8-flash";
  });

  useEffect(() => {
    if (open && typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("const_learn_active_model");
      if (stored) setActiveModel(stored);
    }
  }, [open]);

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("const_learn_active_model", modelId);
    }
    toast.success(t("activeModelChanged", { modelId }));
  };

  const auth = useAppAuth?.() || { token: null };
  const isAuthenticated = !!auth?.token;

  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d" | "90d" | "all">("7d");

  const tzOffset = useMemo(() => {
    return typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0;
  }, []);

  // Live Convex Queries for LLM Gateway Telemetry & Free Weekly Quota
  const userQuota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip"
  );

  const analytics = useQuery(
    api.router.logs.getDashboardAnalytics,
    isAuthenticated ? { timeRange, tzOffset } : "skip"
  );

  const quotaMetrics = useMemo(() => {
    return calculateQuotaMetrics(userQuota);
  }, [userQuota]);

  // Dexie storage telemetry for Usage tab
  const dbStats = useLiveQuery(async () => {
    try {
      const [learnsCount, sourcesCount, sessionsCount, artifactsCount] = await Promise.all([
        db.learns.count(),
        db.sources.count(),
        db.chatSessions.count(),
        db.artifacts.count(),
      ]);
      return { learnsCount, sourcesCount, sessionsCount, artifactsCount };
    } catch {
      return { learnsCount: 0, sourcesCount: 0, sessionsCount: 0, artifactsCount: 0 };
    }
  }, []);

  // Composio Weekly MCP Rate Limiter & Tool Calls Telemetry (Matching Desktop settings-view.tsx)
  const [composioUsage, setComposioUsage] = useState<ComposioUsageRecord>(() =>
    getStoredComposioUsage(user?.email || user?.name || undefined)
  );

  useEffect(() => {
    const handleUsageChange = (e: Event) => {
      const customEvent = e as CustomEvent<ComposioUsageRecord>;
      if (customEvent.detail) {
        setComposioUsage(customEvent.detail);
      } else {
        setComposioUsage(getStoredComposioUsage(user?.email || user?.name || undefined));
      }
    };

    window.addEventListener("composio_usage_changed", handleUsageChange);
    return () => {
      window.removeEventListener("composio_usage_changed", handleUsageChange);
    };
  }, [user]);

  useEffect(() => {
    if (open) {
      setComposioUsage(getStoredComposioUsage(user?.email || user?.name || undefined));
    }
  }, [open, user]);

  const usedCount = composioUsage.used || 0;
  const limitCount = composioUsage.limit || WEEKLY_TOOL_CALL_LIMIT;
  const remainingCount = Math.max(0, limitCount - usedCount);
  const usagePercent = Math.min(100, Math.round((usedCount / limitCount) * 100));
  const countdown = getResetCountdown(composioUsage.resetAt);

  const resetDateFormatted = new Date(composioUsage.resetAt).toLocaleString(
    language === "id" ? "id-ID" : "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }
  );

  const isExceeded = usedCount >= limitCount;
  const isWarning = !isExceeded && usagePercent >= 75;

  const statusBadge = isExceeded ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
      <AlertCircle className="w-3 h-3" />
      {t("statusExceeded")}
    </span>
  ) : isWarning ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
      <Clock className="w-3 h-3" />
      {t("statusWarning")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
      <CheckCircle2 className="w-3 h-3" />
      {t("statusSafe")}
    </span>
  );

  return (
    <InteractiveBottomSheet
      open={open}
      onClose={onClose}
      defaultHeightVh={75}
      ariaLabel={t("settings") || "Settings"}
    >
      {/* Top Header */}
      <div className="px-4 sm:px-5 py-2.5 border-b border-border/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-secondary border border-border flex items-center justify-center">
            <Settings className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                {t("settings")}
              </h2>
              <span className="text-[10px] font-sans font-medium uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/50">
                Mobile
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {activeTab === "general" && (t("general") || "General")}
              {activeTab === "usage" && (t("usageSettings") || "Usage & Limits")}
              {activeTab === "appearance" && (t("theme") || "Appearance")}
              {activeTab === "models" && (t("models") || "Models")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Sliding Tabs Switcher - Matching ModelSelectionSheet & McpToolsSheet */}
      <div className="px-4 sm:px-5 pt-2.5 pb-2 flex items-center justify-between gap-3 shrink-0 border-b border-border/60 bg-muted/20">
        <div className="relative flex items-center h-9 p-0.5 rounded-xl bg-muted/70 border border-border w-full">
          <div
            className="absolute top-0.5 bottom-0.5 left-0 rounded-lg bg-background shadow-2xs pointer-events-none transition-all duration-300"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.width > 0 ? 1 : 0,
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />

          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={tabRefs[tab.id]}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative z-10 flex-1 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center gap-1.5",
                  isActive
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Content: Matching user-preferred rich card design */}
      <ScrollArea className="flex-1 min-h-0 w-full" viewportClassName="px-4 py-3 space-y-4 text-xs">
          {/* 1. GENERAL (UMUM) */}
          {activeTab === "general" && (
            <div className="space-y-3.5">
              {/* Connected Account Card */}
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("connectedAccount")}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{t("authenticatedSso")}</span>
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  <Avatar className="h-12 w-12 rounded-full border border-border shadow-xs shrink-0">
                    {user?.image ? (
                      <AvatarImage src={user.image} alt={user?.name || "User"} />
                    ) : null}
                    <AvatarFallback className="text-sm font-semibold bg-secondary text-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {user?.name || "Const User"}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email || "Workspace User"}
                    </p>
                  </div>
                </div>

                {/* Account Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                  {onSwitchAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSwitchAccount();
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border/60 text-xs font-medium text-foreground transition-all cursor-pointer active:scale-98"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{t("switchAccount")}</span>
                    </button>
                  )}

                  {onSignOut && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSignOut();
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-medium text-rose-500 transition-all cursor-pointer active:scale-98"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t("logout")}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Language Selection Card */}
              <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    {t("language")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t("selectUiLanguage")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const isSelected = language === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setLanguage(opt.code)}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-foreground/30 bg-secondary text-foreground font-semibold shadow-2xs"
                            : "border-border/70 hover:border-foreground/20 bg-secondary/30 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="text-xs">
                          {opt.label === "Bahasa Indonesia" ? "Indonesia" : opt.label}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-foreground" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System Environment Info Card */}
              <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2.5">
                <span className="text-[11px] font-medium text-foreground block">
                  {t("systemRuntime")}
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px]">{t("application")}</span>
                    <span className="font-medium text-foreground text-[11px]">Const Learn Mobile</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px]">{t("localDatabase")}</span>
                    <span className="font-medium text-foreground text-[11px]">Dexie.js (ACID)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. APPEARANCE (TAMPILAN) */}
          {activeTab === "appearance" && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-card border border-border space-y-3">
                <div>
                  <h3 className="text-xs font-semibold text-foreground">
                    {t("interfaceTheme")}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("appearanceSubtitle")}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "system", label: t("themeSystem"), icon: Laptop, desc: t("themeSystemDesc") },
                    { id: "light", label: t("themeLight"), icon: Sun, desc: t("themeLightDesc") },
                    { id: "dark", label: t("themeDark"), icon: Moon, desc: t("themeDarkDesc") },
                  ].map((tTheme) => {
                    const Icon = tTheme.icon;
                    const isSelected = theme === tTheme.id;
                    return (
                      <button
                        key={tTheme.id}
                        type="button"
                        onClick={() => setTheme(tTheme.id as any)}
                        className={cn(
                          "flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-foreground/30 bg-secondary text-foreground font-semibold shadow-2xs"
                            : "border-border/70 hover:border-foreground/20 bg-secondary/30 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <Icon className={cn("w-4 h-4", isSelected ? "text-foreground" : "text-muted-foreground")} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-foreground" />}
                        </div>
                        <span className="text-xs font-medium">
                          {tTheme.label}
                        </span>
                        <span className="text-[9.5px] text-muted-foreground mt-0.5 line-clamp-1">
                          {tTheme.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. MODELS */}
          {activeTab === "models" && (
            <DefaultModelsSettings
              onOpenModels={() => {
                onClose();
                window.dispatchEvent(new CustomEvent("const:open-models-sheet"));
              }}
            />
          )}

          {/* 4. USAGE & LIMITS (LLM TOKENS & COMPOSIO MCP UNIFIED) */}
          {activeTab === "usage" && (
            <div className="space-y-6 pb-6 pt-1">
              {/* Time Range Filter Pills */}
              <div className="flex items-center justify-between gap-1 bg-[#ebebed] dark:bg-[#1f1f1f] p-1 rounded-full border border-[#dedee2] dark:border-[#383838]">
                {[
                  { label: "Today", value: "today" },
                  { label: "7D", value: "7d" },
                  { label: "30D", value: "30d" },
                  { label: "90D", value: "90d" },
                  { label: "All", value: "all" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTimeRange(item.value as any)}
                    className={cn(
                      "flex-1 py-1 text-[11px] font-sans rounded-full transition-colors cursor-pointer text-center",
                      timeRange === item.value
                        ? "bg-[#262626] text-white dark:bg-white dark:text-[#161616] font-medium shadow-xs"
                        : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* ------------------------------------------------------- */}
              {/* SECTION 1: LLM Gateway & Token Usage                    */}
              {/* ------------------------------------------------------- */}
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#969696]">
                  <span>{t("llmSectionTitle")}</span>
                </div>

                {/* Free Weekly Quota Hero Card (Matching QuotaCard in router) */}
                <div className="p-5 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] shadow-xs space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-[#ebebed] dark:bg-[#2b2b2b] text-[#262626] dark:text-white flex items-center justify-center border border-[#dedee2] dark:border-[#383838] shrink-0">
                        <Zap className="h-4 w-4 stroke-[1.75]" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-[#262626] dark:text-white tracking-tight">
                          {t("freeWeeklyQuota")}
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] block">
                          Const Router AI Gateway
                        </span>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] text-[11px] font-sans text-[#737373] dark:text-[#969696] tabular-nums shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{t("resetsIn")} {quotaMetrics.resetsInText}</span>
                    </div>
                  </div>

                  {/* Main Numbers: Remaining Left, % Remaining Right */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <div className="text-3xl font-semibold tracking-tight text-[#262626] dark:text-white font-sans tabular-nums leading-none">
                          {quotaMetrics.formattedRemaining}
                        </div>
                        <div className="text-xs text-[#737373] dark:text-[#969696] font-sans pt-1">
                          {t("tokenLeft")}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-semibold tracking-tight text-[#262626] dark:text-white font-sans tabular-nums leading-none">
                          {quotaMetrics.percentRemaining.toFixed(0)}%
                        </div>
                        <div className="text-[11px] text-[#737373] dark:text-[#969696] font-sans pt-1">
                          {t("tokensRemaining")}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2.5 w-full bg-[#e5e5e8] dark:bg-[#2b2b2b] rounded-full overflow-hidden border border-[#dedee2]/60 dark:border-[#383838] p-[1.5px]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700 ease-out",
                          quotaMetrics.barColor
                        )}
                        style={{ width: `${quotaMetrics.percentRemaining}%` }}
                      />
                    </div>

                    {/* Used vs Limit Detail */}
                    <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#969696] font-sans tabular-nums pt-0.5">
                      <span>
                        <strong className="font-medium text-[#262626] dark:text-white">
                          {quotaMetrics.formattedUsed}
                        </strong>{" "}
                        {t("used")}
                      </span>
                      <span>
                        {t("of")}{" "}
                        <strong className="font-medium text-[#262626] dark:text-white">
                          {quotaMetrics.formattedLimit}
                        </strong>{" "}
                        {t("limitLabel")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3 KPI Token Cards in Grid (Total Tokens, Input Tokens, Output Tokens) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Card 1: Total Tokens */}
                  <div className="p-4 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-[11px] text-[#737373] dark:text-[#969696] font-medium uppercase tracking-wider">
                        {t("totalTokens")}
                      </span>
                      <div className="h-7 w-7 rounded-lg bg-[#ebebed] dark:bg-[#2b2b2b] text-[#262626] dark:text-white flex items-center justify-center border border-[#dedee2] dark:border-[#383838]">
                        <Coins className="h-3.5 w-3.5 stroke-[1.75]" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {analytics ? (
                        <div className="text-2xl font-semibold tracking-tight text-[#262626] dark:text-white font-sans tabular-nums">
                          {formatTokens(analytics.kpi.totalTokens)}
                        </div>
                      ) : (
                        <Skeleton className="h-7 w-20 rounded my-0.5" />
                      )}
                      <p className="text-[11px] text-[#737373] dark:text-[#969696] font-sans">
                        <span className="tabular-nums font-medium text-[#262626] dark:text-white">
                          {analytics?.kpi.totalRequests.toLocaleString() ?? 0}
                        </span>{" "}
                        {t("requestsLogged")}
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Input Tokens */}
                  <div className="p-4 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-[11px] text-[#737373] dark:text-[#969696] font-medium uppercase tracking-wider">
                        {t("inputTokens")}
                      </span>
                      <div className="h-7 w-7 rounded-lg bg-[#ebebed] dark:bg-[#2b2b2b] text-[#262626] dark:text-white flex items-center justify-center border border-[#dedee2] dark:border-[#383838]">
                        <Layers className="h-3.5 w-3.5 stroke-[1.75]" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {analytics ? (
                        <div className="text-2xl font-semibold tracking-tight text-[#262626] dark:text-white font-sans tabular-nums">
                          {formatTokens(analytics.kpi.promptTokens)}
                        </div>
                      ) : (
                        <Skeleton className="h-7 w-20 rounded my-0.5" />
                      )}
                      <p className="text-[11px] text-[#737373] dark:text-[#969696] font-sans">
                        {t("promptPayload")}
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Output Tokens */}
                  <div className="p-4 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-[11px] text-[#737373] dark:text-[#969696] font-medium uppercase tracking-wider">
                        {t("outputTokens")}
                      </span>
                      <div className="h-7 w-7 rounded-lg bg-[#ebebed] dark:bg-[#2b2b2b] text-[#262626] dark:text-white flex items-center justify-center border border-[#dedee2] dark:border-[#383838]">
                        <Zap className="h-3.5 w-3.5 stroke-[1.75]" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {analytics ? (
                        <div className="text-2xl font-semibold tracking-tight text-[#262626] dark:text-white font-sans tabular-nums">
                          {formatTokens(analytics.kpi.completionTokens)}
                        </div>
                      ) : (
                        <Skeleton className="h-7 w-20 rounded my-0.5" />
                      )}
                      <p className="text-[11px] text-[#737373] dark:text-[#969696] font-sans">
                        {t("generatedTokens")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Model Breakdown List (if available in logs) */}
                {analytics?.modelBreakdown && analytics.modelBreakdown.length > 0 && (
                  <div className="p-4 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-[#737373] dark:text-[#969696]">
                        {t("modelBreakdown")} ({analytics.modelBreakdown.length})
                      </span>
                      <span className="text-[11px] font-sans text-[#737373] dark:text-[#969696]">
                        {timeRange.toUpperCase()}
                      </span>
                    </div>
                    <div className="divide-y divide-[#dedee2] dark:divide-[#383838]">
                      {analytics.modelBreakdown.slice(0, 5).map((m) => (
                        <div key={m.model} className="py-2 flex items-center justify-between text-xs gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#737373] dark:bg-[#969696] shrink-0" />
                            <span className="font-medium text-[#262626] dark:text-white truncate">
                              {m.model}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-[11px] font-sans tabular-nums text-[#737373] dark:text-[#969696]">
                            <span>{m.requests} req</span>
                            <span className="font-medium text-[#262626] dark:text-white">
                              {formatTokens(m.tokens)} tok
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------- */}
              {/* SECTION 2: Composio MCP Tool Calls Quota                */}
              {/* ------------------------------------------------------- */}
              <div className="space-y-4 pt-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#969696]">
                  <span>{t("composioSectionTitle")}</span>
                </div>

                {/* Main Composio Quota Hero Card */}
                <div className="p-5 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-[#737373] dark:text-[#969696]">
                        {t("composioSectionTitle")}
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-semibold tracking-tight text-[#262626] dark:text-white font-sans tabular-nums">
                          {usedCount}
                        </span>
                        <span className="text-sm font-medium text-[#737373] dark:text-[#969696] font-sans tabular-nums">
                          / {limitCount} {t("toolCallsUsed").toLowerCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] block">
                          {t("toolCallsRemaining")}
                        </span>
                        <span
                          className={cn(
                            "text-xl font-semibold font-sans tabular-nums",
                            isExceeded
                              ? "text-rose-500"
                              : isWarning
                              ? "text-amber-500"
                              : "text-[#262626] dark:text-white"
                          )}
                        >
                          {remainingCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar Gauge */}
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-[#e5e5e8] dark:bg-[#2b2b2b] rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500 ease-out",
                          isExceeded
                            ? "bg-rose-500"
                            : isWarning
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        )}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-[#969696] font-sans tabular-nums">
                      <span>0 {t("calls")}</span>
                      <span>{t("quotaUsedPercent", { percent: usagePercent })}</span>
                      <span>{limitCount} {t("calls")}</span>
                    </div>
                  </div>

                  {/* Reset Information Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-[#dedee2] dark:border-[#383838] text-xs text-[#737373] dark:text-[#969696] gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0 text-[#737373] dark:text-[#969696]" />
                      <span>
                        {t("resetsIn")}{" "}
                        <strong className="text-[#262626] dark:text-white font-semibold">
                          {countdown.formatted}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[11px] font-sans tabular-nums">
                      {t("resetDateLabel", { date: resetDateFormatted })}
                    </span>
                  </div>
                </div>

                {/* Recent Activity Log with Radix ScrollArea (Design System compliance) */}
                <div className="p-5 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[#737373] dark:text-[#969696]">
                      {t("recentActivity")}
                    </span>
                    <span className="text-[11px] font-sans tabular-nums text-[#737373] dark:text-[#969696]">
                      {t("recordsCount", { count: (composioUsage.recentCalls || []).length })}
                    </span>
                  </div>

                  {(!composioUsage.recentCalls || composioUsage.recentCalls.length === 0) ? (
                    <div className="py-6 text-center text-xs text-[#737373] dark:text-[#969696]">
                      {t("noRecentActivity")}
                    </div>
                  ) : (
                    <ScrollArea className="max-h-56 pr-2">
                      <div className="divide-y divide-[#dedee2] dark:divide-[#383838]">
                        {composioUsage.recentCalls.slice(0, 15).map((call) => (
                          <div
                            key={call.id}
                            className="py-2.5 flex items-center justify-between text-xs gap-3"
                          >
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  call.success ? "bg-emerald-500" : "bg-rose-500"
                                )}
                              />
                              <span className="font-sans text-xs text-[#262626] dark:text-white truncate">
                                {call.toolSlug}
                              </span>
                            </div>
                            <span className="text-[11px] font-sans tabular-nums text-[#737373] dark:text-[#969696] shrink-0">
                              {new Date(call.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Quota Policy Note */}
                <div className="p-4 rounded-xl bg-[#ebebed]/60 dark:bg-[#1c1c1c] border border-[#dedee2] dark:border-[#383838] flex items-start gap-3 text-xs text-[#737373] dark:text-[#969696]">
                  <Info className="w-4 h-4 text-[#262626] dark:text-white shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[#262626] dark:text-white mb-0.5">{t("resetSchedule")}</p>
                    <p className="leading-relaxed text-[11px]">{t("limitPolicyInfo")}</p>
                  </div>
                </div>

                {/* Local Storage & IndexedDB Telemetry */}
                <div className="p-4 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                      <h3 className="text-xs font-semibold text-[#262626] dark:text-white">
                        {t("localDatabaseStorage")}
                      </h3>
                    </div>
                    <span className="text-[10px] font-sans text-[#737373] dark:text-[#969696]">
                      Dexie.js (ACID)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#ebebed]/50 dark:bg-[#1c1c1c] border border-[#dedee2] dark:border-[#383838] flex items-center justify-between">
                      <span className="text-[#737373] dark:text-[#969696] text-[11px]">
                        {t("notebooks")}
                      </span>
                      <span className="font-semibold text-[#262626] dark:text-white font-sans tabular-nums">
                        {dbStats?.learnsCount ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#ebebed]/50 dark:bg-[#1c1c1c] border border-[#dedee2] dark:border-[#383838] flex items-center justify-between">
                      <span className="text-[#737373] dark:text-[#969696] text-[11px]">
                        {t("sources")}
                      </span>
                      <span className="font-semibold text-[#262626] dark:text-white font-sans tabular-nums">
                        {dbStats?.sourcesCount ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#ebebed]/50 dark:bg-[#1c1c1c] border border-[#dedee2] dark:border-[#383838] flex items-center justify-between">
                      <span className="text-[#737373] dark:text-[#969696] text-[11px]">
                        {t("chatSessions")}
                      </span>
                      <span className="font-semibold text-[#262626] dark:text-white font-sans tabular-nums">
                        {dbStats?.sessionsCount ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#ebebed]/50 dark:bg-[#1c1c1c] border border-[#dedee2] dark:border-[#383838] flex items-center justify-between">
                      <span className="text-[#737373] dark:text-[#969696] text-[11px]">
                        {t("studioArtifacts")}
                      </span>
                      <span className="font-semibold text-[#262626] dark:text-white font-sans tabular-nums">
                        {dbStats?.artifactsCount ?? 0}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[11px] text-[#737373] dark:text-[#969696]">
                    <span>{t("syncStatus")}</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {t("localStoragePersistent")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3.5 border-t border-border bg-secondary/30 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <span className="font-sans text-[10px]">Const Learn Mobile v0.0.1</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-xs"
          >
            {t("done")}
          </button>
        </div>
    </InteractiveBottomSheet>
  );
}
