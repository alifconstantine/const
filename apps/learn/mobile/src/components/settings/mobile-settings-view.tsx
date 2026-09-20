import React, { useState, useEffect, useRef } from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  useTheme,
  toast,
  cn,
} from "@const/ui";
import {
  ArrowLeft,
  SlidersHorizontal,
  Palette,
  Bot,
  Activity,
  Sun,
  Moon,
  Laptop,
  Check,
  ShieldCheck,
  Globe,
  Sparkles,
  LogOut,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { getUserInitials, type UserProfile } from "../navbar";
import { useI18n, LANGUAGE_OPTIONS } from "../../lib/i18n";
import {
  getStoredComposioUsage,
  getResetCountdown,
  type ComposioUsageRecord,
} from "../../lib/composio-usage";

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
    { id: "models", label: "Models", icon: Bot },
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
              {activeTab === "models" && "AI Models"}
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

        {/* TAB: USAGE (300 TOOL CALLS / WEEK LIMIT) */}
        {activeTab === "usage" && (
          <div className="space-y-4">
            {/* Main Quota Hero Card */}
            <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Composio MCP Tool Calls
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-semibold font-mono tracking-tight text-foreground">
                      {usedCount}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
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
                      "text-lg font-semibold font-mono",
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
                <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden p-0.5 border border-border/40">
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
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
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
                <span className="text-[10px] font-mono text-muted-foreground">
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
                <span className="text-[10px] font-mono text-muted-foreground">
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
                        <span className="font-mono text-xs text-foreground truncate">
                          {call.toolSlug}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
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

        {/* TAB: AI MODELS */}
        {activeTab === "models" && (
          <div className="space-y-2.5">
            {MOBILE_BUILTIN_MODELS.map((model) => {
              const isSelected = activeModel === model.id;
              return (
                <div
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3",
                    isSelected
                      ? "border-primary bg-secondary/50 shadow-2xs"
                      : "border-border/60 bg-card hover:bg-secondary/30"
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-semibold text-foreground">
                        {model.name}
                      </h4>
                      {model.isDefault && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-foreground font-medium">
                          Default
                        </span>
                      )}
                      {model.supportsThinking && (
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          <Sparkles className="w-2.5 h-2.5" />
                          Thinking
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {language === "id" ? model.descId : model.descEn}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground pt-0.5">
                      <span>{model.contextWindow}</span>
                      <span>•</span>
                      <span>{model.maxOutput}</span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-background" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
