import React, { useState, useEffect, useMemo } from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  ScrollArea,
  Skeleton,
  useTheme,
  toast,
  cn,
} from "@const/ui";
import {
  X,
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
  LogOut,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Settings,
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

export interface SettingsViewProps {
  open?: boolean;
  onClose?: () => void;
  onBackToWorkspace?: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  initialTab?: string;
}

export const BUILTIN_MODELS = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    isDefault: true,
    descEn: "Advanced reasoning model for complex subject synthesis and deep study research.",
    descId: "Model penalaran tingkat lanjut untuk sintesis materi kompleks dan riset belajar mendalam.",
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
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    descEn: "Fast multimodal reasoning model for exploration and study research.",
    descId: "Model reasoning multimodal cepat untuk eksplorasi dan riset materi belajar.",
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

export function SettingsView({
  open = true,
  onClose,
  onBackToWorkspace,
  user,
  onSignOut,
  onSwitchAccount,
  initialTab = "general",
}: SettingsViewProps) {
  const { t, language, setLanguage } = useI18n();

  // Normalize legacy tab names
  const normalizedInitialTab = useMemo(() => {
    if (initialTab === "model" || initialTab === "models" || initialTab === "model-settings") {
      return "models";
    }
    if (initialTab === "theme" || initialTab === "appearance") {
      return "appearance";
    }
    if (initialTab === "usage" || initialTab === "usage-stats") {
      return "usage";
    }
    if (initialTab === "skill" || initialTab === "skills") {
      return "skills";
    }
    return initialTab || "general";
  }, [initialTab]);

  const [activeTab, setActiveTab] = useState<string>(normalizedInitialTab);

  // Sync activeTab when initialTab changes
  useEffect(() => {
    setActiveTab(normalizedInitialTab);
  }, [normalizedInitialTab]);

  const handleClose = () => {
    if (onClose) onClose();
    else if (onBackToWorkspace) onBackToWorkspace();
  };

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onBackToWorkspace]);

  const [theme, setTheme] = useTheme();
  const initials = getUserInitials(user?.name, user?.email);

  const [activeModel, setActiveModel] = useState<string>(() => {
    return localStorage.getItem("const_learn_active_model") || "gemini-3.8-flash";
  });

  const userId = user?.email || user?.name || "learn_desktop_user";

  const [usage, setUsage] = useState<ComposioUsageRecord>(() => {
    return getStoredComposioUsage(userId);
  });

  useEffect(() => {
    // 1. Fetch live usage from Electron IPC if available
    if ((window as any).electron?.composio?.getUsage) {
      (window as any).electron.composio
        .getUsage(userId)
        .then((res: any) => {
          if (res) {
            setUsage(res);
          }
        })
        .catch(() => {});
    }

    // 2. Listen to storage or window events for live reactive updates
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

  useEffect(() => {
    // Load config from electron if available
    if ((window as any).electron?.config?.get) {
      (window as any).electron.config
        .get()
        .then((cfg: any) => {
          if (cfg?.activeModel) {
            setActiveModel(cfg.activeModel);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    localStorage.setItem("const_learn_active_model", modelId);
    if ((window as any).electron?.config?.save) {
      (window as any).electron.config.save({ activeModel: modelId }).catch(() => {});
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

  // Usage calculations
  const usedCount = usage.used || 0;
  const limitCount = usage.limit || 300;
  const remainingCount = Math.max(0, limitCount - usedCount);
  const usagePercent = Math.min(100, Math.round((usedCount / limitCount) * 100));
  const countdown = getResetCountdown(usage.resetAt);

  const resetDateFormatted = new Date(usage.resetAt).toLocaleString(
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

  // Determine status thresholds
  const isExceeded = usedCount >= limitCount;
  const isWarning = !isExceeded && usagePercent >= 75;

  const navCategories = [
    {
      label: "Basics",
      items: [
        { id: "general", label: t("generalSettings") || "General", icon: SlidersHorizontal },
        { id: "appearance", label: t("theme") || "Appearance", icon: Palette },
        { id: "models", label: t("models") || "Models", icon: Box },
      ],
    },
    {
      label: "Data & Usage",
      items: [
        { id: "usage", label: t("usageSettings") || "Usage & Limits", icon: Activity },
      ],
    },
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-xs select-none p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="w-[980px] max-w-[95vw] h-[670px] max-h-[88vh] bg-[#ffffff] dark:bg-[#161616] border border-[#dedee2] dark:border-[#383838] rounded-2xl flex overflow-hidden text-[#262626] dark:text-[#d4d4d4] font-sans outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 shadow-2xl dark:shadow-[0_24px_70px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-[0.985] duration-150"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* ----------------------------------------------------------- */}
        {/* Left Sidebar inside Modal (Antigravity Pop-up Style)       */}
        {/* ----------------------------------------------------------- */}
        <aside className="w-[220px] sm:w-[240px] h-full flex flex-col shrink-0 bg-[#f4f4f6] dark:bg-[#222222] border-r border-[#dedee2] dark:border-[#383838] p-3 select-none">
          {/* Top Heading */}
          <div className="px-2.5 pt-1 pb-2 shrink-0 mb-1">
            <h2 className="text-sm font-semibold text-[#262626] dark:text-white tracking-tight">
              {t("settings") || "Settings"}
            </h2>
          </div>

          {/* Navigation Categories using Radix ScrollArea */}
          <ScrollArea className="flex-1 min-h-0 w-full pr-1">
            <div className="flex flex-col gap-4 pt-1">
              {navCategories.map((cat) => (
                <div key={cat.label} className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] px-2.5 tracking-tight">
                    {cat.label}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {cat.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left outline-none focus:outline-none",
                            isActive
                              ? "bg-[#e2e2e5] dark:bg-[#383838] text-[#262626] dark:text-white"
                              : "text-[#555555] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b]"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={cn(
                                "w-4 h-4 shrink-0",
                                isActive ? "text-[#262626] dark:text-white" : "text-[#737373] dark:text-[#969696]"
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.id === "usage" && (
                            <span
                              className={cn(
                                "text-[10px] font-sans tabular-nums px-1.5 py-0.5 rounded-full shrink-0",
                                isActive
                                  ? "bg-black/10 dark:bg-white/10 text-[#262626] dark:text-white"
                                  : "text-[#737373] dark:text-[#969696]"
                              )}
                            >
                              {usedCount}/{limitCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* ----------------------------------------------------------- */}
        {/* Right Main Content Area                                    */}
        {/* ----------------------------------------------------------- */}
        <main className="flex-1 h-full flex flex-col min-w-0 bg-[#ffffff] dark:bg-[#161616] overflow-hidden">
          {/* Header Row: Title, Subtitle, and Top-Right Close Button 'X' */}
          <div className="flex-none px-6 sm:px-8 pt-5 pb-3 flex items-start justify-between gap-4 select-none">
                <div>
                  <h1 className="text-xl font-medium tracking-tight text-[#262626] dark:text-white capitalize">
                    {activeTab === "general" && t("generalSettings")}
                    {activeTab === "usage" && (t("usageSettings") || "Usage & Limits")}
                    {activeTab === "appearance" && (t("theme") || "Appearance")}
                    {activeTab === "models" && (t("models") || "Models")}
                  </h1>
              <p className="mt-1 text-xs text-[#737373] dark:text-[#969696]">
                {activeTab === "general" && t("generalSettingsSubtitle")}
                {activeTab === "usage" && t("usageSubtitle")}
                {activeTab === "appearance" && t("appearanceSubtitle")}
                {activeTab === "models" && (t("modelsSettingsSubtitle") || t("aiModelsSubtitle"))}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {activeTab === "usage" && (
                <div className="flex items-center gap-1 bg-[#ebebed] dark:bg-[#1f1f1f] p-1 rounded-full border border-[#dedee2] dark:border-[#333333] shrink-0">
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
                        "px-2.5 py-0.5 text-[11px] font-sans rounded-full transition-colors cursor-pointer",
                        timeRange === item.value
                          ? "bg-[#262626] text-white dark:bg-white dark:text-[#161616] font-medium shadow-xs"
                          : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer outline-none focus:outline-none shrink-0"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dynamic Section Content wrapped in Radix ScrollArea */}
          <ScrollArea className="flex-1 min-h-0 w-full px-6 sm:px-8 py-3">
            {activeTab === "general" ? (
              /* --------------------------------------------------------- */
              /* General Settings Tab                                      */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl pb-6">
                {/* Account Profile Card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    {t("connectedAccount") || "Account"}
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 rounded-full bg-[#eaeaea] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] shrink-0">
                          {user?.image ? (
                            <AvatarImage
                              src={user.image}
                              alt={user?.name || "User"}
                              className="object-cover"
                            />
                          ) : null}
                          <AvatarFallback className="text-xs font-semibold text-[#262626] dark:text-white bg-[#e2e2e5] dark:bg-[#383838]">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex flex-col">
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white truncate">
                            {user?.name || "Const User"}
                          </span>
                          <span className="text-xs text-[#737373] dark:text-[#969696] truncate">
                            {user?.email || "Workspace User"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {t("authenticatedSso")}
                        </span>
                      </div>
                    </div>

                    {(onSwitchAccount || onSignOut) && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#dedee2]/60 dark:border-[#383838]/60">
                        {onSwitchAccount && (
                          <button
                            type="button"
                            onClick={onSwitchAccount}
                            className="px-2.5 py-1 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>{t("switchAccount") || "Switch account"}</span>
                          </button>
                        )}
                        {onSignOut && (
                          <button
                            type="button"
                            onClick={onSignOut}
                            className="px-2.5 py-1 text-xs rounded-lg text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>{t("logout") || "Sign out"}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Language selection card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    {t("language")}
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {LANGUAGE_OPTIONS.map((opt) => {
                      const isSelected = language === opt.code;
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => setLanguage(opt.code)}
                          className={cn(
                            "flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                            isSelected
                              ? "border-[#262626] dark:border-white bg-[#ffffff] dark:bg-[#2b2b2b] shadow-xs font-semibold text-[#262626] dark:text-white"
                              : "border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] hover:bg-[#f0f0f2] dark:hover:bg-[#2a2a2a] text-[#555555] dark:text-[#d4d4d4]"
                          )}
                        >
                          <span className="text-xs font-medium">{opt.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-[#262626] dark:text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* System environment card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    {t("systemRuntime")}
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#f9f9fb] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838]">
                      <span className="text-[#737373] dark:text-[#969696] block text-[11px] mb-0.5">{t("application")}</span>
                      <span className="font-semibold text-[#262626] dark:text-white">Const Learn Desktop</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#f9f9fb] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838]">
                      <span className="text-[#737373] dark:text-[#969696] block text-[11px] mb-0.5">{t("localDatabase")}</span>
                      <span className="font-semibold text-[#262626] dark:text-white">Dexie.js (ACID IndexedDB)</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "appearance" ? (
              /* --------------------------------------------------------- */
              /* Appearance Settings Tab                                   */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl pb-6">
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    {t("interfaceTheme") || "Interface Theme"}
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                        {t("theme") || "Theme"}
                      </span>
                      <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                        {t("themeSelectDesc")}
                      </span>
                    </div>

                    {/* Segmented Control */}
                    <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5 shrink-0">
                      {[
                        { id: "system", label: t("themeSystem"), icon: Laptop },
                        { id: "light", label: t("themeLight"), icon: Sun },
                        { id: "dark", label: t("themeDark"), icon: Moon },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = theme === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setTheme(item.id as any)}
                            className={cn(
                              "px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none",
                              isSelected
                                ? "bg-[#ffffff] dark:bg-[#383838] text-[#262626] dark:text-white shadow-2xs font-medium"
                                : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Theme Cards Grid */}
                <div className="grid grid-cols-3 gap-3">
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
                          "flex flex-col items-start p-4 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-[#262626] dark:border-white bg-[#ffffff] dark:bg-[#2b2b2b] shadow-xs font-semibold"
                            : "border-[#dedee2] dark:border-[#383838] hover:border-[#b0b0b4] dark:hover:border-[#4a4a4a] bg-[#f9f9fb] dark:bg-[#222222]"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-2.5">
                          <Icon className={cn("w-4 h-4", isSelected ? "text-[#262626] dark:text-white" : "text-[#737373] dark:text-[#969696]")} />
                          {isSelected && <Check className="w-4 h-4 text-[#262626] dark:text-white" />}
                        </div>
                        <span className="text-xs font-semibold text-[#262626] dark:text-white">
                          {tTheme.label}
                        </span>
                        <span className="text-[10px] text-[#737373] dark:text-[#969696] mt-0.5 leading-relaxed">
                          {tTheme.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : activeTab === "models" ? (
              /* --------------------------------------------------------- */
              /* Models Settings Tab (Default AI for LLM, Voice, & Image)  */
              /* --------------------------------------------------------- */
              <DefaultModelsSettings
                onOpenModels={() => {
                  handleClose();
                  window.dispatchEvent(
                    new CustomEvent("const:navigate-tab", { detail: { tab: "models" } })
                  );
                }}
              />
            ) : activeTab === "usage" ? (
              /* --------------------------------------------------------- */
              /* Usage & Limits Tab (LLM Tokens & Composio MCP Unified)   */
              /* --------------------------------------------------------- */
              <div className="max-w-3xl space-y-6 pb-6 pt-1">
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
                        {t("recordsCount", { count: (usage.recentCalls || []).length })}
                      </span>
                    </div>

                    {(!usage.recentCalls || usage.recentCalls.length === 0) ? (
                      <div className="py-6 text-center text-xs text-[#737373] dark:text-[#969696]">
                        {t("noRecentActivity")}
                      </div>
                    ) : (
                      <ScrollArea className="max-h-56 pr-2">
                        <div className="divide-y divide-[#dedee2] dark:divide-[#383838]">
                          {usage.recentCalls.slice(0, 15).map((call) => (
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
                </div>
              </div>
            ) : null}
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
