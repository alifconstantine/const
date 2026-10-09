import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Skeleton,
  useTheme,
  toast,
  cn,
} from "@const/ui";
import {
  ArrowLeft,
  SlidersHorizontal,
  Palette,
  Bot,
  Box,
  Activity,
  Sun,
  Moon,
  Laptop,
  Check,
  ShieldCheck,
  Globe,
  Brain,
  LogOut,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  Coins,
  Layers,
  Zap,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useAppAuth } from "../convex-provider";
import { getUserInitials, type UserProfile } from "../navbar";
import { useI18n, LANGUAGE_OPTIONS } from "../../lib/i18n";
import {
  getStoredComposioUsage,
  getResetCountdown,
  type ComposioUsageRecord,
} from "../../lib/composio-usage";
import {
  calculateQuotaMetrics,
  formatTokens,
  formatTokenAmount,
} from "../../lib/quota";
import { DefaultModelsSettings } from "./default-models-settings";

interface MobileSettingsViewProps {
  onBack: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  initialTab?: "general" | "usage" | "appearance" | "models";
}

export const MOBILE_BUILTIN_MODELS = [
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

export function MobileSettingsView({
  onBack,
  user,
  onSignOut,
  onSwitchAccount,
  initialTab = "general",
}: MobileSettingsViewProps) {
  const { t, language, setLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<"general" | "usage" | "appearance" | "models">(initialTab);
  const [theme, setTheme] = useTheme();
  const initials = getUserInitials(user?.name, user?.email);

  const [activeModel, setActiveModel] = useState<string>(() => {
    return localStorage.getItem("const_learn_active_model") || "gemini-3.6-flash";
  });

  const userId = user?.email || user?.name || undefined;

  const [usage, setUsage] = useState<ComposioUsageRecord>(() => {
    return getStoredComposioUsage(userId);
  });

  useEffect(() => {
    const handleUsageChange = (e: Event) => {
      const customDetail = (e as CustomEvent).detail;
      if (customDetail) {
        setUsage(customDetail);
      } else {
        setUsage(getStoredComposioUsage(userId));
      }
    };

    window.addEventListener("composio_usage_changed", handleUsageChange);
    return () => {
      window.removeEventListener("composio_usage_changed", handleUsageChange);
    };
  }, [userId]);

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    localStorage.setItem("const_learn_active_model", modelId);
    toast.success(t("activeModelChanged", { modelId }));
  };

  const navTabs = [
    { id: "general", label: t("generalSettings"), icon: SlidersHorizontal },
    { id: "usage", label: t("usage"), icon: Activity },
    { id: "appearance", label: t("theme"), icon: Palette },
    { id: "models", label: t("models") || "Models", icon: Box },
  ] as const;

  // Sliding Tab Refs & Indicator (Matching ModelSelectionSheet & McpToolsSheet)
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
  }, [activeTab, language]);

  const auth = useAppAuth?.() || { token: null };
  const isAuthenticated = !!auth?.token;

  // Sub-tab selection: "llm" | "composio" | "all"
  const [usageSubTab, setUsageSubTab] = useState<"llm" | "composio" | "all">("llm");
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

  // Usage calculations
  const usedCount = usage.used || 0;
  const limitCount = usage.limit || 300;
  const remainingCount = Math.max(0, limitCount - usedCount);
  const usagePercent = Math.min(100, Math.round((usedCount / limitCount) * 100));
  const countdown = getResetCountdown(usage.resetAt);

  const resetDateFormatted = new Date(usage.resetAt).toLocaleString(
    language === "id" ? "id-ID" : "en-US",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  const isExceeded = usedCount >= limitCount;
  const isWarning = !isExceeded && usagePercent >= 75;

  const statusBadge = useMemo(() => {
    if (usageSubTab === "composio") {
      return isExceeded ? (
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
    }

    if (quotaMetrics.isCapped) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <AlertCircle className="w-3 h-3" />
          Limit Reached
        </span>
      );
    }
    if (quotaMetrics.isCritical || quotaMetrics.isLow) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <Clock className="w-3 h-3" />
          Low Quota
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" />
        {quotaMetrics.formattedRemaining} left
      </span>
    );
  }, [usageSubTab, isExceeded, isWarning, quotaMetrics, t]);

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground overflow-hidden select-none safe-area-top safe-area-bottom">
      {/* 1. Header with back button */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 py-3 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="h-9 w-9 rounded-full bg-secondary/80 text-foreground flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-foreground tracking-tight">
              {t("settings")}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {activeTab === "general" && t("generalSettings")}
              {activeTab === "usage" && t("usageSettings")}
              {activeTab === "appearance" && t("theme")}
              {activeTab === "models" && (t("models") || "Models")}
            </p>
          </div>
        </div>

        {/* Quick status badge if usage tab */}
        {activeTab === "usage" ? (
          <div>{statusBadge}</div>
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-primary px-2.5 py-1 rounded-lg hover:bg-secondary cursor-pointer"
          >
            {language === "id" ? "Selesai" : "Done"}
          </button>
        )}
      </header>

      {/* 2. Top Sliding Navigation Tabs - Matching ModelSelectionSheet & McpToolsSheet */}
      <div className="px-4 pt-3 pb-2 shrink-0 bg-background border-b border-border/50">
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

      {/* 3. Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* TAB: GENERAL */}
        {activeTab === "general" && (
          <div className="space-y-4">
            {/* User Account Card */}
            <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                {t("connectedAccount")}
              </span>

              <div className="flex items-center gap-3.5">
                <Avatar className="h-12 w-12 rounded-full border border-border shrink-0">
                  {user?.image ? (
                    <AvatarImage src={user.image} alt={user?.name || "User"} />
                  ) : null}
                  <AvatarFallback className="text-sm font-semibold bg-muted text-foreground">
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
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      {t("authenticatedSso")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Language Selector */}
            <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                {t("language")}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGE_OPTIONS.map((opt) => {
                  const isSelected = language === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setLanguage(opt.code)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-secondary/80 font-semibold shadow-2xs"
                          : "border-border/60 bg-card hover:bg-secondary/30"
                      )}
                    >
                      <span className="text-xs font-medium text-foreground">
                        {opt.label === "Bahasa Indonesia" ? "Indonesia" : opt.label}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* System Info */}
            <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                {t("systemRuntime")}
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40">
                  <span className="text-muted-foreground block text-[10px]">{t("application")}</span>
                  <span className="font-semibold text-foreground text-xs">Const Learn Mobile</span>
                </div>
                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/40">
                  <span className="text-muted-foreground block text-[10px]">{t("localDatabase")}</span>
                  <span className="font-semibold text-foreground text-xs">Dexie.js IndexedDB</span>
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="space-y-2 pt-2">
              {onSwitchAccount && (
                <button
                  type="button"
                  onClick={onSwitchAccount}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-border/60 text-xs font-medium text-foreground bg-card hover:bg-secondary/60 active:scale-98 transition-all cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>{t("switchAccount")}</span>
                </button>
              )}

              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-rose-500/20 text-xs font-medium text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 active:scale-98 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t("logout")}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB: USAGE & LIMITS (LLM TOKENS & COMPOSIO MCP) */}
        {activeTab === "usage" && (
          <div className="space-y-4">
            {/* Sub-Header Bar: Category Switcher & Time Range Filter */}
            <div className="space-y-2.5 pb-1 border-b border-border/40">
              {/* Category Pills: LLM & Tokens vs Composio MCP vs Overview */}
              <div className="flex p-1 rounded-xl bg-secondary/60 border border-border/50 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setUsageSubTab("llm")}
                  className={cn(
                    "flex-1 py-1 text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 outline-none font-medium",
                    usageSubTab === "llm"
                      ? "bg-card text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>{t("llmTokensUsage") || "LLM & Tokens"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUsageSubTab("composio")}
                  className={cn(
                    "flex-1 py-1 text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 outline-none font-medium",
                    usageSubTab === "composio"
                      ? "bg-card text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>{t("composioMcpUsage") || "Composio"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUsageSubTab("all")}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 outline-none font-medium",
                    usageSubTab === "all"
                      ? "bg-card text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t("overviewAll") || "Semua"}</span>
                </button>
              </div>

              {/* Time Range Filter Pills (active for LLM or Overview) */}
              {(usageSubTab === "llm" || usageSubTab === "all") && (
                <div className="flex items-center justify-between gap-1 bg-secondary/40 p-1 rounded-xl border border-border/40">
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
                        "flex-1 py-1 text-[10px] font-sans rounded-lg transition-colors cursor-pointer text-center",
                        timeRange === item.value
                          ? "bg-foreground text-background font-medium shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* --------------------------------------------------------- */}
            {/* SECTION 1: LLM & Token Consumption (from apps/router)    */}
            {/* --------------------------------------------------------- */}
            {(usageSubTab === "llm" || usageSubTab === "all") && (
              <div className="space-y-3.5">
                {usageSubTab === "all" && (
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Brain className="w-3.5 h-3.5 text-indigo-500" />
                    <span>LLM Gateway & Token Usage</span>
                  </div>
                )}

                {/* Free Weekly Quota Hero Card (Matching router QuotaCard) */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
                        <Zap className="h-3.5 w-3.5 stroke-[1.75]" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-foreground tracking-tight block">
                          {t("freeWeeklyQuota") || "Free Weekly Quota"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Const Router AI Gateway
                        </span>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/80 border border-border/40 text-[10px] font-sans text-muted-foreground tabular-nums shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{t("resetsIn") || "Resets in"} {quotaMetrics.resetsInText}</span>
                    </div>
                  </div>

                  {/* Main Numbers: Remaining Left, % Remaining Right */}
                  <div className="space-y-2.5 pt-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <div className="text-2xl font-semibold tracking-tight text-foreground font-sans tabular-nums leading-none">
                          {quotaMetrics.formattedRemaining}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-sans pt-1">
                          {t("tokenLeft") || "token left"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-semibold tracking-tight text-foreground font-sans tabular-nums leading-none">
                          {quotaMetrics.percentRemaining.toFixed(0)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground font-sans pt-1">
                          {t("tokensRemaining") || "remaining"}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-border/40 p-[1px]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700 ease-out",
                          quotaMetrics.barColor
                        )}
                        style={{ width: `${quotaMetrics.percentRemaining}%` }}
                      />
                    </div>

                    {/* Used vs Limit Detail */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-sans tabular-nums pt-0.5">
                      <span>
                        <strong className="font-medium text-foreground">
                          {quotaMetrics.formattedUsed}
                        </strong>{" "}
                        {language === "id" ? "digunakan" : "used"}
                      </span>
                      <span>
                        {language === "id" ? "dari" : "of"}{" "}
                        <strong className="font-medium text-foreground">
                          {quotaMetrics.formattedLimit}
                        </strong>{" "}
                        limit
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3 KPI Token Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Card 1: Total Tokens */}
                  <div className="p-3.5 rounded-2xl bg-card border border-border/60 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
                        {t("totalTokens") || "Total Tokens"}
                      </span>
                      <div className="text-lg font-semibold tracking-tight text-foreground font-sans tabular-nums mt-0.5">
                        {analytics ? formatTokens(analytics.kpi.totalTokens) : <Skeleton className="h-6 w-16 rounded" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-sans">
                        {analytics?.kpi.totalRequests ?? 0} {t("requestsLogged") || "requests"}
                      </span>
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                      <Coins className="h-4 w-4 stroke-[1.75]" />
                    </div>
                  </div>

                  {/* Card 2: Input Tokens */}
                  <div className="p-3.5 rounded-2xl bg-card border border-border/60 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
                        {t("inputTokens") || "Input Tokens"}
                      </span>
                      <div className="text-lg font-semibold tracking-tight text-foreground font-sans tabular-nums mt-0.5">
                        {analytics ? formatTokens(analytics.kpi.promptTokens) : <Skeleton className="h-6 w-16 rounded" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-sans">
                        Prompt context
                      </span>
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                      <Layers className="h-4 w-4 stroke-[1.75]" />
                    </div>
                  </div>

                  {/* Card 3: Output Tokens */}
                  <div className="p-3.5 rounded-2xl bg-card border border-border/60 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
                        {t("outputTokens") || "Output Tokens"}
                      </span>
                      <div className="text-lg font-semibold tracking-tight text-foreground font-sans tabular-nums mt-0.5">
                        {analytics ? formatTokens(analytics.kpi.completionTokens) : <Skeleton className="h-6 w-16 rounded" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-sans">
                        Generated output
                      </span>
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <Zap className="h-4 w-4 stroke-[1.75]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* SECTION 2: Composio MCP Tool Calls Quota                 */}
            {/* --------------------------------------------------------- */}
            {(usageSubTab === "composio" || usageSubTab === "all") && (
              <div className="space-y-3.5">
                {usageSubTab === "all" && (
                  <div className="flex items-center gap-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Box className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Composio MCP Tool Calls</span>
                  </div>
                )}

                {/* Main Quota Hero Card */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Composio MCP Tool Calls
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-2xl font-semibold font-sans tabular-nums tracking-tight text-foreground">
                          {usedCount}
                        </span>
                        <span className="text-xs text-muted-foreground font-sans tabular-nums">
                          / {limitCount} {t("toolCallsUsed").toLowerCase()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">
                        {t("toolCallsRemaining")}
                      </span>
                      <span
                        className={cn(
                          "text-lg font-semibold font-sans tabular-nums",
                          isExceeded
                            ? "text-rose-500"
                            : isWarning
                            ? "text-amber-500"
                            : "text-foreground"
                        )}
                      >
                        {remainingCount}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden p-[1px] border border-border/40">
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
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-sans tabular-nums">
                      <span>0</span>
                      <span>{usagePercent}% terpakai</span>
                      <span>{limitCount}</span>
                    </div>
                  </div>

                  {/* Reset Info */}
                  <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>
                        {t("resetsIn")}{" "}
                        <strong className="text-foreground font-semibold">
                          {countdown.formatted}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-sans tabular-nums text-muted-foreground">
                      {resetDateFormatted}
                    </span>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("recentActivity")}
                    </span>
                    <span className="text-[10px] font-sans tabular-nums text-muted-foreground">
                      {(usage.recentCalls || []).length} riwayat
                    </span>
                  </div>

                  {(!usage.recentCalls || usage.recentCalls.length === 0) ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      {t("noRecentActivity")}
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 max-h-48 overflow-y-auto">
                      {usage.recentCalls.slice(0, 10).map((call) => (
                        <div
                          key={call.id}
                          className="py-2 flex items-center justify-between text-xs gap-2"
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                call.success ? "bg-emerald-500" : "bg-rose-500"
                              )}
                            />
                            <span className="font-sans text-xs text-foreground truncate">
                              {call.toolSlug}
                            </span>
                          </div>
                          <span className="text-[10px] font-sans tabular-nums text-muted-foreground shrink-0">
                            {new Date(call.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Policy Banner */}
                <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/50 flex items-start gap-2.5 text-xs text-muted-foreground">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11px]">{t("limitPolicyInfo")}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: APPEARANCE */}
        {activeTab === "appearance" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                {t("interfaceTheme")}
              </span>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "system", label: t("themeSystem"), icon: Laptop },
                  { id: "light", label: t("themeLight"), icon: Sun },
                  { id: "dark", label: t("themeDark"), icon: Moon },
                ].map((tTheme) => {
                  const Icon = tTheme.icon;
                  const isSelected = theme === tTheme.id;
                  return (
                    <button
                      key={tTheme.id}
                      type="button"
                      onClick={() => setTheme(tTheme.id as any)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-secondary/80 font-semibold shadow-2xs text-foreground"
                          : "border-border/60 bg-card hover:bg-secondary/30 text-muted-foreground"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 mb-1.5", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs">{tTheme.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: MODELS */}
        {activeTab === "models" && (
          <DefaultModelsSettings
            onOpenModels={() => {
              onBack();
              window.dispatchEvent(new CustomEvent("const:open-models-sheet"));
            }}
          />
        )}
      </div>
    </div>
  );
}
