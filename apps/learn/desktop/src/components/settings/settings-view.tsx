import React, { useState, useEffect } from "react";
import {
  ConstLogoIcon,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  useTheme,
  toast,
  cn,
} from "@const/ui";
import {
  ArrowLeft,
  SlidersHorizontal,
  Palette,
  Bot,
  Sun,
  Moon,
  Laptop,
  Check,
  ShieldCheck,
  Globe,
  Sparkles,
  LogOut,
  ArrowLeftRight,
} from "lucide-react";
import { getUserInitials, type UserProfile } from "../navbar";
import { useI18n, LANGUAGE_OPTIONS } from "../../lib/i18n";

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

  useEffect(() => {
    // Load config from electron if available
    if (window.electron?.config?.get) {
      window.electron.config.get().then((cfg) => {
        if (cfg?.activeModel) {
          setActiveModel(cfg.activeModel);
        }
      }).catch(() => {});
    }
  }, []);

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    localStorage.setItem("const_learn_active_model", modelId);
    if (window.electron?.config?.save) {
      window.electron.config.save({ activeModel: modelId }).catch(() => {});
    }
    toast.success(t("activeModelChanged", { modelId }));
  };

  const navItems = [
    { id: "general", label: t("generalSettings"), icon: SlidersHorizontal },
    { id: "appearance", label: t("theme"), icon: Palette },
    { id: "models", label: "AI Models", icon: Bot },
  ];

  return (
    <div className="h-screen w-full flex bg-secondary/50 text-foreground overflow-hidden select-none">
      {/* Settings Left Sidebar */}
      <aside className="w-56 h-full flex flex-col justify-between p-3 shrink-0">
        <div className="flex flex-col gap-3">
          {/* Top Brand & Back to workspace */}
          <div className="flex items-center gap-2 px-1 py-1">
            <ConstLogoIcon size="sm" className="w-5 h-5 text-foreground" />
            <span className="font-serif text-base font-normal tracking-tight text-foreground">
              Const
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Settings
            </span>
          </div>

          <button
            type="button"
            onClick={onBackToWorkspace}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <span>{t("backToLearns")}</span>
          </button>

          {/* Navigation Categories */}
          <div className="flex flex-col gap-0.5 pt-2">
            <span className="text-[11px] font-medium text-muted-foreground px-2.5 mb-1 tracking-tight">
              {t("preferences")}
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-background text-foreground font-medium shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Account Info at bottom */}
        <div className="pt-2 border-t border-border flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl">
            <Avatar className="h-7 w-7 rounded-full bg-card border border-border shrink-0">
              {user?.image ? (
                <AvatarImage src={user.image} alt={user.name || "User"} />
              ) : null}
              <AvatarFallback className="text-[11px] font-medium text-foreground bg-muted">
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

          {onSwitchAccount && (
            <button
              type="button"
              onClick={onSwitchAccount}
              className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{t("switchAccount")}</span>
            </button>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t("logout")}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Settings Main Content Area */}
      <main className="flex-1 h-full flex flex-col bg-background text-foreground rounded-l-2xl sm:rounded-l-3xl border-l border-border overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto px-6 sm:px-8 py-8 space-y-8">
          {/* TAB 1: GENERAL */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-medium tracking-tight text-foreground">
                  {t("generalSettings")}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("generalSettingsSubtitle")}
                </p>
              </div>

              {/* Account details card */}
              <div className="p-4 rounded-2xl bg-card border border-border space-y-4">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t("connectedAccount")}
                </span>

                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 rounded-full border border-border">
                    {user?.image ? (
                      <AvatarImage src={user.image} alt={user?.name || "User"} />
                    ) : null}
                    <AvatarFallback className="text-sm font-medium bg-muted text-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-foreground">
                      {user?.name || "Const User"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {user?.email || "Workspace User"}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        <ShieldCheck className="w-3 h-3" />
                        {t("authenticatedSso")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Language selection card */}
              <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
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
                            ? "border-primary bg-secondary"
                            : "border-border hover:border-foreground/20 bg-card hover:bg-secondary/50"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">
                            {opt.label}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System environment card */}
              <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {t("systemRuntime")}
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-secondary border border-border">
                    <span className="text-muted-foreground block text-[11px]">{t("application")}</span>
                    <span className="font-medium text-foreground">Const Learn Desktop</span>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary border border-border">
                    <span className="text-muted-foreground block text-[11px]">{t("localDatabase")}</span>
                    <span className="font-medium text-foreground">Dexie.js (ACID-compliant)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-medium tracking-tight text-foreground">
                  {t("theme")}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("appearanceSubtitle")}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border space-y-4">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
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
                          "flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-secondary"
                            : "border-border hover:border-foreground/20 bg-card hover:bg-secondary/50"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <Icon className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {tTheme.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {tTheme.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI MODELS */}
          {activeTab === "models" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-medium tracking-tight text-foreground">
                  AI Models
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("aiModelsSubtitle")}
                </p>
              </div>

              <div className="space-y-3">
                {BUILTIN_MODELS.map((model) => {
                  const isSelected = activeModel === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => handleSelectModel(model.id)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4",
                        isSelected
                          ? "border-primary bg-secondary/30"
                          : "border-border hover:border-foreground/20 bg-card hover:bg-secondary/40"
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-foreground">
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
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
