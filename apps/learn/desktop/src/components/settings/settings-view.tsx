import React, { useState, useEffect } from "react";
import {
  ConstLogoIcon,
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
  ChevronsUpDown,
  Info,
} from "lucide-react";
import { getUserInitials, type UserProfile } from "../navbar";
import { useI18n, LANGUAGE_OPTIONS } from "../../lib/i18n";
import {
  getStoredComposioUsage,
  getResetCountdown,
  type ComposioUsageRecord,
} from "../../lib/composio-usage";

interface SettingsViewProps {
  onBackToWorkspace: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  initialTab?: string;
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

export function SettingsView({
  onBackToWorkspace,
  user,
  onSignOut,
  onSwitchAccount,
  initialTab = "general",
}: SettingsViewProps) {
  const { t, language, setLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [theme, setTheme] = useTheme();
  const initials = getUserInitials(user?.name, user?.email);

  const [activeModel, setActiveModel] = useState<string>(() => {
    return localStorage.getItem("const_learn_active_model") || "gemini-3.6-flash";
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBackToWorkspace();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onBackToWorkspace]);

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    localStorage.setItem("const_learn_active_model", modelId);
    if ((window as any).electron?.config?.save) {
      (window as any).electron.config.save({ activeModel: modelId }).catch(() => {});
    }
    toast.success(t("activeModelChanged", { modelId }));
  };

  const navItems = [
    { id: "general", label: t("generalSettings"), icon: SlidersHorizontal },
    { id: "usage", label: t("usage"), icon: Activity },
    { id: "appearance", label: t("theme"), icon: Palette },
    { id: "models", label: "AI Models", icon: Bot },
  ];

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

  // Determine status color and label
  const isExceeded = usedCount >= limitCount;
  const isWarning = !isExceeded && usagePercent >= 75;

  const statusBadge = isExceeded ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
      <AlertCircle className="w-3.5 h-3.5" />
      {t("statusExceeded")}
    </span>
  ) : isWarning ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
      <Clock className="w-3.5 h-3.5" />
      {t("statusWarning")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="w-3.5 h-3.5" />
      {t("statusSafe")}
    </span>
  );

  return (
    <div className="h-full w-full flex bg-secondary/60 dark:bg-[#121212] text-foreground overflow-hidden select-none">
      {/* 1. Left Sidebar (Identical design to learn-home.tsx Sidebar) */}
      <aside className="w-64 h-full flex flex-col justify-between shrink-0 select-none bg-transparent text-foreground p-3">
        {/* Top Section */}
        <div className="flex flex-col gap-3">
          {/* Brand Header & Back Button */}
          <div className="flex items-center justify-between h-9 px-1">
            {/* Logo & Const Learn text */}
            <div className="flex items-center gap-2">
              <ConstLogoIcon size="sm" className="w-5 h-5 text-foreground shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-base font-normal tracking-tight text-foreground">
                  Const
                </span>
                <span className="text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Learn
                </span>
              </div>
            </div>

            {/* Back Button */}
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={`${t("backToLearns")} (Esc)`}
              aria-label={t("backToLearns")}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Action: Back to Notebooks Button (Exact match with New Learn button in sidebar.tsx) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/80 hover:bg-secondary border border-border/60 hover:border-border text-foreground font-medium text-xs transition-all cursor-pointer shadow-2xs group active:scale-[0.99]"
              title={`${t("backToLearns")} (Esc)`}
            >
              <div className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors stroke-[1.8]" />
                <span className="font-medium text-foreground/90 group-hover:text-foreground">
                  {t("backToLearns")}
                </span>
              </div>
              <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground font-sans transition-colors select-none tracking-tight">
                Esc
              </span>
            </button>
          </div>

          {/* Navigation Items (General, Usage, Appearance, Models) */}
          <nav className="flex flex-col gap-0.5 pt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-background text-foreground font-medium shadow-xs"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.id === "usage" && (
                    <span
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {usedCount}/{limitCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: User Profile Menu (Identical to sidebar.tsx) */}
        <div className="pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2.5 p-1.5 rounded-xl hover:bg-muted transition-colors text-left outline-none cursor-pointer group"
                aria-label="Account menu"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-7 w-7 rounded-full border border-border shrink-0">
                    {user?.image ? (
                      <AvatarImage src={user.image} alt={user.name || "Avatar"} />
                    ) : null}
                    <AvatarFallback className="bg-muted text-foreground font-sans text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {user?.name || "Const User"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {user?.email || "Workspace"}
                    </p>
                  </div>
                </div>
                <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={8}
              className="w-52 p-1.5 mb-1 bg-popover border border-border text-popover-foreground rounded-2xl shadow-xl select-none text-xs"
            >
              {/* 1. App theme (Submenu) */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-popover-foreground hover:text-foreground">
                  <Sun className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{t("theme")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[140px] p-1.5 rounded-xl bg-popover border border-border text-popover-foreground shadow-xl text-xs">
                  {[
                    { value: "system", label: t("themeSystem"), icon: Laptop },
                    { value: "light", label: t("themeLight"), icon: Sun },
                    { value: "dark", label: t("themeDark"), icon: Moon },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.value}
                        onClick={() => setTheme(item.value as any)}
                        className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-secondary text-popover-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{item.label}</span>
                        </div>
                        {theme === item.value && (
                          <Check className="w-3.5 h-3.5 text-foreground ml-2 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* 2. Language (Submenu) */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-popover-foreground hover:text-foreground">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{t("language")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[160px] p-1.5 rounded-xl bg-popover border border-border text-popover-foreground shadow-xl text-xs">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-secondary text-popover-foreground"
                    >
                      <span>{lang.label}</span>
                      {language === lang.code && (
                        <Check className="w-3.5 h-3.5 text-foreground ml-2 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator className="my-1 bg-border" />

              {/* 3. Switch account */}
              {onSwitchAccount && (
                <DropdownMenuItem
                  onClick={onSwitchAccount}
                  className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-secondary focus:bg-secondary text-popover-foreground hover:text-foreground"
                >
                  <ArrowLeftRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{t("switchAccount")}</span>
                </DropdownMenuItem>
              )}

              {/* 4. Log out */}
              {onSignOut && (
                <DropdownMenuItem
                  onClick={onSignOut}
                  className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-red-500/10 dark:hover:bg-red-500/10 focus:bg-red-500/10 text-rose-600 dark:text-rose-400"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>{t("logout")}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* 2. Main Canvas (Floating card identical to learn-home.tsx) */}
      <main className="flex-1 min-w-0 bg-background text-foreground overflow-hidden flex flex-col relative rounded-2xl sm:rounded-3xl border border-border/50 shadow-sm m-2 sm:m-2.5">
        {/* Top Header inside canvas */}
        <div className="px-6 sm:px-8 py-5 border-b border-border/40 flex items-center justify-between shrink-0 select-none">
          <div>
            <h1 className="text-lg sm:text-xl font-medium tracking-tight text-foreground">
              {activeTab === "general" && t("generalSettings")}
              {activeTab === "usage" && t("usageSettings")}
              {activeTab === "appearance" && t("theme")}
              {activeTab === "models" && "AI Models"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeTab === "general" && t("generalSettingsSubtitle")}
              {activeTab === "usage" && t("usageSubtitle")}
              {activeTab === "appearance" && t("appearanceSubtitle")}
              {activeTab === "models" && t("aiModelsSubtitle")}
            </p>
          </div>

          {activeTab === "usage" && (
            <div className="flex items-center gap-2">
              {statusBadge}
            </div>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6">
          {/* TAB 1: GENERAL */}
          {activeTab === "general" && (
            <div className="max-w-2xl space-y-5">
              {/* Account details card */}
              <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("connectedAccount")}
                </span>

                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 rounded-full border border-border">
                    {user?.image ? (
                      <AvatarImage src={user.image} alt={user?.name || "User"} />
                    ) : null}
                    <AvatarFallback className="text-sm font-semibold bg-muted text-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {user?.name || "Const User"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {user?.email || "Workspace User"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {t("authenticatedSso")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Language selection card */}
              <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
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
                            ? "border-primary bg-secondary/70 shadow-xs font-semibold"
                            : "border-border/60 hover:border-foreground/20 bg-card hover:bg-secondary/30"
                        )}
                      >
                        <span className="text-xs font-medium text-foreground">
                          {opt.label}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System environment card */}
              <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("systemRuntime")}
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/40">
                    <span className="text-muted-foreground block text-[11px] mb-0.5">{t("application")}</span>
                    <span className="font-semibold text-foreground">Const Learn Desktop</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/40">
                    <span className="text-muted-foreground block text-[11px] mb-0.5">{t("localDatabase")}</span>
                    <span className="font-semibold text-foreground">Dexie.js (ACID IndexedDB)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USAGE & LIMITS (NEW) */}
          {activeTab === "usage" && (
            <div className="max-w-3xl space-y-6">
              {/* Main Quota Hero Card */}
              <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Composio MCP Tool Calls
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-semibold tracking-tight text-foreground font-mono">
                        {usedCount}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground font-mono">
                        / {limitCount} {t("toolCallsUsed").toLowerCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">
                        {t("toolCallsRemaining")}
                      </span>
                      <span
                        className={cn(
                          "text-xl font-semibold font-mono",
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
                </div>

                {/* Progress Bar Gauge */}
                <div className="space-y-2">
                  <div className="h-3 w-full bg-secondary rounded-full overflow-hidden p-0.5 border border-border/40">
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
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>0 call</span>
                    <span>{usagePercent}% kuota terpakai</span>
                    <span>{limitCount} calls</span>
                  </div>
                </div>

                {/* Reset Information Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-border/40 text-xs text-muted-foreground gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>
                      {t("resetsIn")}{" "}
                      <strong className="text-foreground font-semibold">
                        {countdown.formatted}
                      </strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Reset: {resetDateFormatted}
                  </span>
                </div>
              </div>


              {/* Recent Activity Log */}
              <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("recentActivity")}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {(usage.recentCalls || []).length} aktivitas
                  </span>
                </div>

                {(!usage.recentCalls || usage.recentCalls.length === 0) ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {t("noRecentActivity")}
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 max-h-56 overflow-y-auto pr-1">
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
                          <span className="font-mono text-xs text-foreground truncate">
                            {call.toolSlug}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                          {new Date(call.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quota Policy Note */}
              <div className="p-4 rounded-2xl bg-secondary/40 border border-border/50 flex items-start gap-3 text-xs text-muted-foreground">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-0.5">{t("resetSchedule")}</p>
                  <p className="leading-relaxed text-[11px]">{t("limitPolicyInfo")}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APPEARANCE */}
          {activeTab === "appearance" && (
            <div className="max-w-2xl space-y-5">
              <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-2xs space-y-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("interfaceTheme")}
                </span>

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
                            ? "border-primary bg-secondary/70 shadow-xs font-semibold"
                            : "border-border/60 hover:border-foreground/20 bg-card hover:bg-secondary/30"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-2.5">
                          <Icon className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                        <span className="text-xs font-semibold text-foreground">
                          {tTheme.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                          {tTheme.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI MODELS */}
          {activeTab === "models" && (
            <div className="max-w-2xl space-y-3">
              {BUILTIN_MODELS.map((model) => {
                const isSelected = activeModel === model.id;
                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectModel(model.id)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4",
                      isSelected
                        ? "border-primary bg-secondary/40 shadow-xs"
                        : "border-border/60 hover:border-foreground/20 bg-card hover:bg-secondary/30"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">
                          {model.name}
                        </h4>
                        {model.isDefault && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-foreground font-medium">
                            Default
                          </span>
                        )}
                        {model.supportsThinking && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                            <Sparkles className="w-2.5 h-2.5" />
                            Thinking
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {language === "id" ? model.descId : model.descEn}
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-muted-foreground">
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
      </main>
    </div>
  );
}
