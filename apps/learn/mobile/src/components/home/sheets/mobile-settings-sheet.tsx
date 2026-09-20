import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Settings,
  Sun,
  Moon,
  Laptop,
  Globe,
  Check,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Palette,
  Bot,
  ArrowLeftRight,
  LogOut,
  BarChart2,
  Database,
  Layers,
  Cpu,
} from "lucide-react";
import {
  useTheme,
  cn,
  Avatar,
  AvatarImage,
  AvatarFallback,
  ScrollArea,
  toast,
} from "@const/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../../lib/db";
import { useI18n, LANGUAGE_OPTIONS } from "../../../lib/i18n";
import type { UserProfile } from "../../navbar";
import { InteractiveBottomSheet } from "./interactive-bottom-sheet";

export type SettingsTab = "general" | "appearance" | "models" | "usage";

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
    const first = parts[0];
    const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
    if (first) {
      if (last && last[0]) {
        return (first[0] + last[0]).toUpperCase();
      }
      return first.substring(0, 2).toUpperCase();
    }
  }
  if (email && email.trim()) {
    const parts = email.trim().split("@");
    const username = parts[0];
    if (username && username.length > 0) {
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
  const isIndo = language === "id";

  // Tab Refs & Sliding Indicator (Matching ModelSelectionSheet and McpToolsSheet)
  const generalTabRef = useRef<HTMLButtonElement>(null);
  const appearanceTabRef = useRef<HTMLButtonElement>(null);
  const modelsTabRef = useRef<HTMLButtonElement>(null);
  const usageTabRef = useRef<HTMLButtonElement>(null);

  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (!open) return;
    const updateIndicator = () => {
      let activeEl: HTMLButtonElement | null = null;
      if (activeTab === "general") activeEl = generalTabRef.current;
      else if (activeTab === "appearance") activeEl = appearanceTabRef.current;
      else if (activeTab === "models") activeEl = modelsTabRef.current;
      else if (activeTab === "usage") activeEl = usageTabRef.current;

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

  return (
    <InteractiveBottomSheet
      open={open}
      onClose={onClose}
      defaultHeightVh={85}
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
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/50">
                  Mobile
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isIndo
                  ? "Preferensi akun, tampilan, model AI, dan kuota"
                  : "Account, appearance, AI models, and usage telemetry"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Tutup"
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

            <button
              ref={generalTabRef}
              type="button"
              onClick={() => setActiveTab("general")}
              className={cn(
                "relative z-10 flex-1 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center gap-1.5",
                activeTab === "general"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isIndo ? "Umum" : "General"}</span>
            </button>

            <button
              ref={appearanceTabRef}
              type="button"
              onClick={() => setActiveTab("appearance")}
              className={cn(
                "relative z-10 flex-1 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center gap-1.5",
                activeTab === "appearance"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{isIndo ? "Tampilan" : "Theme"}</span>
            </button>

            <button
              ref={modelsTabRef}
              type="button"
              onClick={() => setActiveTab("models")}
              className={cn(
                "relative z-10 flex-1 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center gap-1.5",
                activeTab === "models"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isIndo ? "Model" : "Models"}</span>
            </button>

            <button
              ref={usageTabRef}
              type="button"
              onClick={() => setActiveTab("usage")}
              className={cn(
                "relative z-10 flex-1 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center gap-1.5",
                activeTab === "usage"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{isIndo ? "Usage" : "Usage"}</span>
            </button>
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
                    {isIndo ? "Pilih bahasa tampilan" : "Select UI language"}
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
                    {isIndo
                      ? "Pilih palet tampilan antarmuka yang nyaman untuk mata Anda"
                      : "Choose an interface theme suited to your viewing comfort"}
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

          {/* 3. AI MODELS */}
          {activeTab === "models" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-0.5">
                <div>
                  <h3 className="text-xs font-semibold text-foreground">
                    {isIndo ? "Model AI Terpasang" : "Available AI Models"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("aiModelsSubtitle")}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border shrink-0">
                  {BUILTIN_MODELS.length} {isIndo ? "Model" : "Models"}
                </span>
              </div>

              <div className="space-y-2">
                {BUILTIN_MODELS.map((model) => {
                  const isSelected = activeModel === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => handleSelectModel(model.id)}
                      className={cn(
                        "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3",
                        isSelected
                          ? "border-foreground/40 bg-secondary text-foreground shadow-2xs"
                          : "border-border hover:border-foreground/20 bg-card hover:bg-secondary/40 text-card-foreground"
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-semibold text-foreground">
                            {model.name}
                          </h4>
                          {model.isDefault && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary-foreground/10 text-foreground font-medium border border-border/50">
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

                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {isIndo ? model.descId : model.descEn}
                        </p>

                        <div className="flex items-center gap-2 pt-0.5 text-[10px] font-mono text-muted-foreground">
                          <span>{model.contextWindow}</span>
                          <span>•</span>
                          <span>{model.maxOutput}</span>
                        </div>
                      </div>

                      {/* Radio Selection Indicator */}
                      <div className="shrink-0 pt-0.5">
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                            isSelected
                              ? "border-foreground bg-foreground"
                              : "border-muted-foreground/40 bg-transparent"
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
            </div>
          )}

          {/* 4. USAGE & TELEMETRY */}
          {activeTab === "usage" && (
            <div className="space-y-3.5">
              {/* Context Window & Quota Overview */}
              <div className="p-3.5 rounded-2xl bg-card border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-foreground">
                      {isIndo ? "Kapasitas & Batas Model" : "Model Capacity & Limits"}
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{isIndo ? "Aktif" : "Active"}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
                    <span className="text-[10px] text-muted-foreground block">
                      {isIndo ? "Batas Context Window" : "Context Window Limit"}
                    </span>
                    <span className="text-xs font-semibold text-foreground font-mono">
                      1,048,576 Tokens
                    </span>
                    <span className="text-[9.5px] text-muted-foreground block">
                      ~1M {isIndo ? "token masukan" : "input tokens"}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
                    <span className="text-[10px] text-muted-foreground block">
                      {isIndo ? "Maksimal Output Jawaban" : "Max Output Tokens"}
                    </span>
                    <span className="text-xs font-semibold text-foreground font-mono">
                      131,072 Tokens
                    </span>
                    <span className="text-[9.5px] text-muted-foreground block">
                      ~128K {isIndo ? "token keluaran" : "output tokens"}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>
                    {isIndo
                      ? "Penghitungan token akurat dengan isolasi ground context dan telemetry pelacakan real-time."
                      : "Accurate token metering with grounded context isolation and real-time session tracking."}
                  </span>
                </div>
              </div>

              {/* Local Storage & IndexedDB Telemetry */}
              <div className="p-3.5 rounded-2xl bg-card border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-foreground">
                      {isIndo ? "Penyimpanan Database Lokal" : "Local Database Storage"}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Dexie.js (ACID)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">
                      {isIndo ? "Buku Catatan" : "Notebooks"}
                    </span>
                    <span className="font-semibold text-foreground font-mono">
                      {dbStats?.learnsCount ?? 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">
                      {isIndo ? "Sumber Belajar" : "Sources"}
                    </span>
                    <span className="font-semibold text-foreground font-mono">
                      {dbStats?.sourcesCount ?? 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">
                      {isIndo ? "Sesi Diskusi" : "Chat Sessions"}
                    </span>
                    <span className="font-semibold text-foreground font-mono">
                      {dbStats?.sessionsCount ?? 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">
                      {isIndo ? "Hasil Studio" : "Studio Artifacts"}
                    </span>
                    <span className="font-semibold text-foreground font-mono">
                      {dbStats?.artifactsCount ?? 0}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{isIndo ? "Status Sinkronisasi" : "Sync Status"}</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {isIndo ? "Tersimpan Lokal (Aman)" : "Local Storage (Persistent)"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3.5 border-t border-border bg-secondary/30 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <span className="font-mono text-[10px]">Const Learn Mobile v0.0.1</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-xs"
          >
            {isIndo ? "Selesai" : "Done"}
          </button>
        </div>
    </InteractiveBottomSheet>
  );
}
