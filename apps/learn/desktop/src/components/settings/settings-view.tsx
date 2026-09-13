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
    desc: "Model reasoning multimodal cepat untuk eksplorasi dan riset materi belajar.",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    desc: "Model frontier hybrid dengan kedalaman penalaran dinamis.",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    desc: "Model penalaran tingkat lanjut untuk sintesis materi kompleks.",
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    desc: "Dynamic router cerdas yang menyeimbangkan latensi dan keakuratan jawaban.",
  },
  {
    id: "combo/fast",
    name: "combo/fast",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: false,
    desc: "Kecepatan respons sub-detik untuk dialog cepat dan ringkasan kilat.",
  },
  {
    id: "combo/coding",
    name: "combo/coding",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    desc: "Model khusus untuk pembelajaran pemrograman, sintaks, dan debugging kode.",
  },
];

export function SettingsView({
  onBackToWorkspace,
  user,
  onSignOut,
  onSwitchAccount,
  initialTab = "general",
}: SettingsViewProps) {
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
    toast.success(`Model aktif diubah menjadi ${modelId}`);
  };

  const navItems = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "models", label: "AI Models", icon: Bot },
  ];

  return (
    <div className="h-screen w-full flex bg-[#ececee] dark:bg-[#2b2b2b] text-[#262626] dark:text-[#d4d4d4] overflow-hidden select-none">
      {/* Settings Left Sidebar */}
      <aside className="w-56 h-full flex flex-col justify-between p-3 shrink-0">
        <div className="flex flex-col gap-3">
          {/* Top Brand & Back to workspace */}
          <div className="flex items-center gap-2 px-1 py-1">
            <ConstLogoIcon size="sm" className="w-5 h-5 text-[#262626] dark:text-white" />
            <span className="font-serif text-base font-normal tracking-tight text-[#262626] dark:text-white">
              Const
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#dedee2] dark:bg-[#383838] text-[#5d5d5d] dark:text-[#969696]">
              Settings
            </span>
          </div>

          <button
            type="button"
            onClick={onBackToWorkspace}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-[#dedee2] dark:hover:bg-[#383838] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#8a8a8a] dark:text-[#969696]" />
            <span>Kembali ke Learns</span>
          </button>

          {/* Navigation Categories */}
          <div className="flex flex-col gap-0.5 pt-2">
            <span className="text-[11px] font-medium text-[#8a8a8a] dark:text-[#737373] px-2.5 mb-1 tracking-tight">
              Preferences
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
                      ? "bg-[#dedee2] dark:bg-[#383838] text-[#262626] dark:text-white font-medium"
                      : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-[#dedee2]/60 dark:hover:bg-[#383838]/60"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive ? "text-[#262626] dark:text-white" : "text-[#8a8a8a] dark:text-[#969696]"
                    )}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Account Info at bottom */}
        <div className="pt-2 border-t border-[#dedee2] dark:border-[#383838]/40 flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl">
            <Avatar className="h-7 w-7 rounded-full bg-white dark:bg-[#1e1e1e] border border-[#dedee2] dark:border-[#383838] shrink-0">
              {user?.image ? (
                <AvatarImage src={user.image} alt={user.name || "User"} />
              ) : null}
              <AvatarFallback className="text-[11px] font-medium text-[#262626] dark:text-white bg-[#dedee2] dark:bg-[#383838]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#262626] dark:text-white truncate">
                {user?.name || "Const User"}
              </p>
              <p className="text-[10px] text-[#8a8a8a] dark:text-[#888888] truncate">
                {user?.email || "Workspace"}
              </p>
            </div>
          </div>

          {onSwitchAccount && (
            <button
              type="button"
              onClick={onSwitchAccount}
              className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs text-[#8a8a8a] hover:text-[#262626] dark:hover:text-white hover:bg-[#dedee2]/50 dark:hover:bg-[#383838]/50 transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Ganti Akun</span>
            </button>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </aside>

      {/* Settings Main Content Area */}
      <main className="flex-1 h-full flex flex-col bg-[#f8f8f8] dark:bg-[#161616] rounded-l-2xl sm:rounded-l-3xl border-l border-[#dedee2] dark:border-[#333333]/40 overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto px-6 sm:px-8 py-8 space-y-8">
          {/* TAB 1: GENERAL */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-medium tracking-tight text-[#262626] dark:text-white">
                  General Settings
                </h1>
                <p className="mt-1 text-xs text-[#8a8a8a] dark:text-[#888888]">
                  Kelola profil pengguna, status sesi belajar, dan konfigurasi lingkungan sistem.
                </p>
              </div>

              {/* Account details card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] space-y-4">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#8a8a8a] dark:text-[#777777]">
                  Akun Terhubung
                </span>

                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 rounded-full border border-[#dedee2] dark:border-[#383838]">
                    {user?.image ? (
                      <AvatarImage src={user.image} alt={user?.name || "User"} />
                    ) : null}
                    <AvatarFallback className="text-sm font-medium bg-[#dedee2] dark:bg-[#383838] text-[#262626] dark:text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-[#262626] dark:text-white">
                      {user?.name || "Const User"}
                    </h3>
                    <p className="text-xs text-[#8a8a8a] dark:text-[#888888]">
                      {user?.email || "Workspace User"}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        <ShieldCheck className="w-3 h-3" />
                        Terautentikasi (Const Hub SSO)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* System environment card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] space-y-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#8a8a8a] dark:text-[#777777]">
                  Sistem & Runtime
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838]">
                    <span className="text-[#8a8a8a] dark:text-[#888888] block text-[11px]">Aplikasi</span>
                    <span className="font-medium text-[#262626] dark:text-white">Const Learn Desktop</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838]">
                    <span className="text-[#8a8a8a] dark:text-[#888888] block text-[11px]">Database Lokal</span>
                    <span className="font-medium text-[#262626] dark:text-white">Dexie.js (ACID-compliant)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-medium tracking-tight text-[#262626] dark:text-white">
                  Appearance
                </h1>
                <p className="mt-1 text-xs text-[#8a8a8a] dark:text-[#888888]">
                  Sesuaikan tema tampilan antarmuka sesuai dengan kenyamanan visual Anda.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] space-y-4">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#8a8a8a] dark:text-[#777777]">
                  Tema Antarmuka
                </span>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "system", label: "Sistem", icon: Laptop, desc: "Ikuti tema OS" },
                    { id: "light", label: "Terang", icon: Sun, desc: "Canvas #f8f8f8" },
                    { id: "dark", label: "Gelap", icon: Moon, desc: "Canvas #161616 (Studio)" },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSelected = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id as any)}
                        className={cn(
                          "flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-[#262626] dark:border-white bg-[#f4f4f6] dark:bg-[#2b2b2b]"
                            : "border-[#dedee2] dark:border-[#383838] hover:border-[#8a8a8a] dark:hover:border-[#555555] bg-transparent"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <Icon className={cn("w-4 h-4", isSelected ? "text-[#262626] dark:text-white" : "text-[#8a8a8a] dark:text-[#888888]")} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#262626] dark:text-white" />}
                        </div>
                        <span className="text-xs font-medium text-[#262626] dark:text-white">
                          {t.label}
                        </span>
                        <span className="text-[10px] text-[#8a8a8a] dark:text-[#888888] mt-0.5">
                          {t.desc}
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
                <h1 className="text-xl font-medium tracking-tight text-[#262626] dark:text-white">
                  AI Models
                </h1>
                <p className="mt-1 text-xs text-[#8a8a8a] dark:text-[#888888]">
                  Pilih model AI bawaan atau atur router penalaran yang digunakan selama proses belajar.
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
                          ? "border-[#262626] dark:border-white bg-white dark:bg-[#222222]"
                          : "border-[#dedee2] dark:border-[#383838] hover:border-[#8a8a8a] dark:hover:border-[#555555] bg-white/50 dark:bg-[#1e1e1e]"
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-[#262626] dark:text-white">
                            {model.name}
                          </h4>
                          {model.isDefault && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#dedee2] dark:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] font-medium">
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
                        <p className="text-xs text-[#8a8a8a] dark:text-[#888888] leading-relaxed">
                          {model.desc}
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-[#8a8a8a] dark:text-[#777777]">
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
                              ? "border-[#262626] dark:border-white bg-[#262626] dark:bg-white"
                              : "border-[#8a8a8a] dark:border-[#555555]"
                          )}
                        >
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#161616]" />
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
