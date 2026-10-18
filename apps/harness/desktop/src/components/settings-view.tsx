import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  ScrollArea,
  Switch,
  toast,
  cn,
} from "@const/ui";
import {
  Settings2,
  Cable,
  PencilSparkles,
  UserRound,
  UserRoundPen,
  Keyboard,
  Palette,
  Box,
  Brain,
  Bot,
  Puzzle,
  BarChart3,
  Settings,
  Plus,
  Minus,
  RotateCcw,
  Check,
  Info,
  X,
  Sun,
  Moon,
  LogOut,
  ArrowLeftRight,
  ChevronDown,
  Search,
  Copy,
  Monitor,
  Volume2,
  Image as ImageIcon,
  Video as VideoIcon,
  FolderOpen,
  Globe,
  ShieldCheck,
  Bell,
  RefreshCw,
  Play,
  ExternalLink,
  Laptop,
  Layers,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import type { UserProfile } from "./sidebar";
import { getUserInitials } from "./sidebar";
import type { UserConfig } from "../vite-env";
import {
  useTheme,
  useConversationWidth,
  useInterfaceZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  ZOOM_STEP,
} from "../lib/theme";
import { ModelSettings } from "./settings/model-settings";
import { MemorySettings } from "./settings/memory-settings";
import { SkillsSettings } from "./settings/skills-settings";
import { loadMultiModalConfig } from "../lib/models-config";
import { useTranslation, type SupportedLanguage } from "../lib/i18n";
import { playTaskCompletionSound } from "../lib/sound";

export interface SettingsViewProps {
  open?: boolean;
  onClose?: () => void;
  onBackToWorkspace?: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  initialTab?: string;
  currentProject?: string;
}

export const CONST_ROUTER_DEFAULT_URL = "https://router.const.web.id/v1";

export const BUILTIN_CONST_MODELS = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    isDefault: true,
    desc: "Advanced frontier thinking with extended reasoning depth (up to max). Included in your 7M weekly tokens quota.",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Hybrid frontier reasoning model with dynamic thinking effort. Included in your 7M weekly tokens quota.",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Frontier multimodal reasoning & code generation. Included in your 7M weekly tokens quota.",
  },
  {
    id: "qwen-3.8-27b",
    name: "Qwen 3.8 27B",
    contextWindow: "131K Context",
    maxOutput: "65K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Open-weight reasoning powerhouse with deep thinking capabilities. Included in your 7M weekly tokens quota.",
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Intelligent dynamic router balancing latency, reasoning, and multi-model failover.",
  },
  {
    id: "combo/fast",
    name: "combo/fast",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: false,
    desc: "Sub-second time-to-first-token and ultra-high throughput for instant conversational feedback.",
  },
  {
    id: "combo/coding",
    name: "combo/coding",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Specialized models tuned for software architecture, code generation, refactoring, and logical reasoning.",
  },
];

function formatTokenDisplay(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

export function SettingsView({
  open = true,
  onClose,
  onBackToWorkspace,
  user,
  onSignOut,
  onSwitchAccount,
  initialTab = "general",
  currentProject,
}: SettingsViewProps) {
  // Normalize legacy and alias tab names
  const normalizedInitialTab = useMemo(() => {
    if (initialTab === "model" || initialTab === "models") return "model-settings";
    if (initialTab === "shortcuts") return "keyboard-shortcuts";
    if (initialTab === "user" || initialTab === "account") return "profile";
    if (initialTab === "data-and-stats" || initialTab === "usage") return "usage-stats";
    return initialTab || "general";
  }, [initialTab]);

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>(normalizedInitialTab);

  // Sync activeTab when initialTab prop changes
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
  }, [open]);

  // Appearance & Theme settings
  const { t, language, setLanguage } = useTranslation();
  const [theme, setTheme] = useTheme();
  const [conversationWidth, setConversationWidth] = useConversationWidth();
  const [zoom, setZoom] = useInterfaceZoom();

  // Local configuration
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [activeModel, setActiveModel] = useState<string>(() => {
    const saved = localStorage.getItem("const_harness_active_model");
    if (!saved || saved === "Const" || saved === "gemini-3.6-flash") return "gemini-3.8-flash";
    if (saved === "Gemini 3.8 Flash") return "gemini-3.8-flash";
    if (saved === "Gemini 3.7 Flash") return "gemini-3.7-flash";
    if (saved === "Gemini 3.6 Flash") return "gemini-3.6-flash";
    return saved;
  });

  const multiModalConfig = useMemo(() => loadMultiModalConfig(), [activeTab]);

  // General Settings State
  const [defaultProjectLocation, setDefaultProjectLocation] = useState<string>(() => {
    return localStorage.getItem("const_harness_default_project_location") || "";
  });

  const [defaultConfirmationMode, setDefaultConfirmationMode] = useState<
    "ask_before_changes" | "full_access" | "request_review"
  >(() => {
    return (
      (localStorage.getItem("const_harness_default_mode") as
        | "ask_before_changes"
        | "full_access"
        | "request_review") || "ask_before_changes"
    );
  });

  const [queueMode, setQueueMode] = useState<"queue" | "steer">(() => {
    return (localStorage.getItem("const_harness_queue_mode") as "queue" | "steer") || "queue";
  });

  const [taskNotifications, setTaskNotifications] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_task_notifications") !== "false";
  });

  const [soundAlerts, setSoundAlerts] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_sound_alerts") !== "false";
  });

  const [autoUpdates, setAutoUpdates] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_auto_updates") !== "false";
  });

  const [launchOnStartup, setLaunchOnStartup] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_launch_on_startup") === "true";
  });

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const presetDropdownRef = useRef<HTMLDivElement>(null);

  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setIsPresetDropdownOpen(false);
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleBrowseDefaultLocation = async () => {
    if (window.electron?.openDirectoryDialog) {
      const selected = await window.electron.openDirectoryDialog();
      if (selected) {
        setDefaultProjectLocation(selected);
        localStorage.setItem("const_harness_default_project_location", selected);
        if (window.electron?.saveConfig) {
          window.electron.saveConfig({ defaultProjectLocation: selected }).catch(() => {});
        }
        toast.success("Default project location updated");
      }
    }
  };

  const handleResetDefaultLocation = () => {
    setDefaultProjectLocation("");
    localStorage.removeItem("const_harness_default_project_location");
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ defaultProjectLocation: "" }).catch(() => {});
    }
    toast.success("Reset to default project location");
  };

  const LANGUAGE_OPTIONS: { id: SupportedLanguage; label: string; native: string }[] = [
    { id: "en", label: "English", native: "English (US)" },
    { id: "id", label: "Indonesian", native: "Bahasa Indonesia" },
    { id: "ja", label: "Japanese", native: "日本語" },
    { id: "zh", label: "Chinese", native: "中文 (简体)" },
    { id: "es", label: "Spanish", native: "Español" },
  ];

  const handleSetLanguage = (lang: SupportedLanguage) => {
    setLanguage(lang);
    localStorage.setItem("const_app_language", lang);
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ language: lang }).catch(() => {});
    }
    setIsLanguageDropdownOpen(false);
    toast.success(`Language set to ${LANGUAGE_OPTIONS.find((l) => l.id === lang)?.native || lang}`);
  };

  const handleSetDefaultMode = (mode: "ask_before_changes" | "full_access" | "request_review") => {
    setDefaultConfirmationMode(mode);
    localStorage.setItem("const_harness_default_mode", mode);
    window.dispatchEvent(new CustomEvent("const:default-mode-changed", { detail: mode }));
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ defaultPermission: mode }).catch(() => {});
    }
    setIsPresetDropdownOpen(false);
    const modeLabel =
      mode === "full_access"
        ? "Full Machine"
        : mode === "request_review"
        ? "Request Review"
        : "Ask Before Changes";
    toast.success(`Default permission set to ${modeLabel}`);
  };

  const handleSetQueueMode = (mode: "queue" | "steer") => {
    setQueueMode(mode);
    localStorage.setItem("const_harness_queue_mode", mode);
    window.dispatchEvent(new CustomEvent("const:queue-mode-changed", { detail: mode }));
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ queueMode: mode }).catch(() => {});
    }
    toast.success(
      mode === "queue"
        ? "Messages will be queued while agent is executing"
        : "Messages will steer the active agent immediately"
    );
  };

  const handleToggleTaskNotifications = (enabled: boolean) => {
    setTaskNotifications(enabled);
    localStorage.setItem("const_harness_task_notifications", String(enabled));
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ taskNotifications: enabled }).catch(() => {});
    }
    if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    toast.success(enabled ? "Task notifications enabled" : "Task notifications disabled");
  };

  const handleToggleSoundAlerts = (enabled: boolean) => {
    setSoundAlerts(enabled);
    localStorage.setItem("const_harness_sound_alerts", String(enabled));
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ soundAlerts: enabled }).catch(() => {});
    }
    if (enabled) {
      playTaskCompletionSound();
    }
    toast.success(enabled ? "Sound alerts enabled" : "Sound alerts disabled");
  };

  const handleToggleAutoUpdates = (enabled: boolean) => {
    setAutoUpdates(enabled);
    localStorage.setItem("const_harness_auto_updates", String(enabled));
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ autoCheckUpdates: enabled }).catch(() => {});
    }
    toast.success(enabled ? "Automatic updates enabled" : "Automatic updates disabled");
  };

  const handleToggleLaunchOnStartup = (enabled: boolean) => {
    setLaunchOnStartup(enabled);
    localStorage.setItem("const_harness_launch_on_startup", String(enabled));
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ launchOnStartup: enabled }).catch(() => {});
    }
    toast.success(enabled ? "Launch on startup enabled" : "Launch on startup disabled");
  };

  const handleCheckUpdates = () => {
    setIsCheckingUpdate(true);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      toast.success("Const Harness v0.1.0-alpha is up to date");
    }, 700);
  };

  const handleOpenDataFolder = () => {
    if (window.electron?.openConstFolder) {
      window.electron.openConstFolder();
      toast.success("Opening local .const data directory");
    }
  };

  const [refreshKey, setRefreshKey] = useState(0);

  // Real-time reactive query for 7M Token Quota from Convex
  const quota = useQuery(api.router.quotas.getUserQuota, {});

  // Compute remaining token percentage
  const percentRemaining = useMemo(() => {
    if (!quota) return 100;
    const limit = quota.weeklyLimitTokens || 7_000_000;
    return Math.max(0, Math.min(100, (quota.remainingTokens / limit) * 100));
  }, [quota]);

  // Load config on mount or refresh
  useEffect(() => {
    if (window.electron?.getConfig) {
      window.electron.getConfig().then((cfg) => {
        setConfig(cfg);
        if (cfg?.activeModel) {
          setActiveModel(cfg.activeModel);
        }
        if (cfg?.defaultProjectLocation !== undefined) {
          setDefaultProjectLocation(cfg.defaultProjectLocation);
        }
        if (cfg?.defaultPermission) {
          setDefaultConfirmationMode(cfg.defaultPermission);
        }
        if (cfg?.queueMode) {
          setQueueMode(cfg.queueMode);
        }
        if (cfg?.taskNotifications !== undefined) {
          setTaskNotifications(cfg.taskNotifications);
        }
        if (cfg?.autoCheckUpdates !== undefined) {
          setAutoUpdates(cfg.autoCheckUpdates);
        }
        if (cfg?.launchOnStartup !== undefined) {
          setLaunchOnStartup(cfg.launchOnStartup);
        }
        if (cfg?.soundAlerts !== undefined) {
          setSoundAlerts(cfg.soundAlerts);
        }
      });
    }
  }, [refreshKey]);

  const handleSelectActiveModel = (modelId: string) => {
    setActiveModel(modelId);
    const found = BUILTIN_CONST_MODELS.find((m) => m.id === modelId);
    const displayName = found?.name || modelId;
    localStorage.setItem("const_harness_active_model", displayName);
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ activeModel: modelId }).catch(() => {});
    }
    toast.success(t("toast.activeModelSet", { model: displayName }));
  };

  // Keyboard Shortcuts state & definitions
  const [shortcutsSearch, setShortcutsSearch] = useState<string>("");

  const isMac = useMemo(() => {
    return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  }, []);

  const KEYBOARD_SHORTCUTS = useMemo(
    () => [
      {
        category: "General & Navigation",
        items: [
          { label: "Open Command Palette", keys: [isMac ? "⌘" : "Ctrl", "K"] },
          { label: "Open Settings", keys: [isMac ? "⌘" : "Ctrl", ","] },
          { label: "Toggle Left Sidebar", keys: [isMac ? "⌘" : "Ctrl", "B"] },
          { label: "Quick Switch Workspace", keys: [isMac ? "⌘" : "Ctrl", "O"] },
          { label: "Close Modal or Dismiss", keys: ["Esc"] },
        ],
      },
      {
        category: "Workbench & Prompts",
        items: [
          { label: "Send Message", keys: ["Enter"] },
          { label: "Insert New Line", keys: ["Shift", "Enter"] },
          { label: "Stop Agent Execution", keys: ["Esc"] },
          { label: "Attach Media & Files", keys: [isMac ? "⌘" : "Ctrl", "U"] },
          { label: "Mention Context or Files", keys: ["@"] },
          { label: "Slash Command Palette", keys: ["/"] },
        ],
      },
      {
        category: "Workspace & Panes",
        items: [
          { label: "Toggle Right Pane", keys: [isMac ? "⌘" : "Ctrl", "."] },
          { label: "Clear Terminal Logs", keys: [isMac ? "⌘" : "Ctrl", "L"] },
          { label: "Zoom In Interface", keys: [isMac ? "⌘" : "Ctrl", "+"] },
          { label: "Zoom Out Interface", keys: [isMac ? "⌘" : "Ctrl", "-"] },
          { label: "Reset Interface Zoom", keys: [isMac ? "⌘" : "Ctrl", "0"] },
        ],
      },
    ],
    [isMac]
  );

  const filteredShortcuts = useMemo(() => {
    if (!shortcutsSearch.trim()) return KEYBOARD_SHORTCUTS;
    const q = shortcutsSearch.toLowerCase();
    return KEYBOARD_SHORTCUTS.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.keys.some((k) => k.toLowerCase().includes(q))
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [KEYBOARD_SHORTCUTS, shortcutsSearch]);

  // Const Harness Nav Categories
  const navCategories = [
    {
      label: t("settings.personal"),
      items: [
        { id: "general", label: t("settings.general"), icon: Settings2 },
        { id: "profile", label: t("settings.profile"), icon: UserRound },
        { id: "appearance", label: t("settings.appearance"), icon: Palette },
        { id: "model-settings", label: t("settings.models"), icon: Box },
        { id: "personalization", label: t("settings.personalization"), icon: UserRoundPen },
        { id: "keyboard-shortcuts", label: t("settings.keyboardShortcuts"), icon: Keyboard },
      ],
    },
    {
      label: t("settings.agentCapabilities"),
      items: [
        { id: "memory", label: t("settings.memory"), icon: Brain },
        { id: "subagents", label: t("settings.subagents"), icon: Bot },
        { id: "plugins", label: t("settings.plugins"), icon: Puzzle },
        { id: "mcp-servers", label: t("settings.mcpServers"), icon: Cable },
        { id: "skills", label: t("settings.skills"), icon: PencilSparkles },
      ],
    },
    {
      label: t("settings.usageStatistic"),
      items: [
        { id: "usage-stats", label: t("settings.usageStats"), icon: BarChart3 },
      ],
    },
  ];

  const initials = getUserInitials(user?.name, user?.email);

  const tabHeader = useMemo(() => {
    switch (activeTab) {
      case "general":
        return {
          title: t("settings.general"),
          desc: "Manage default workbench preferences, agent execution modes, and system environment.",
        };
      case "profile":
        return {
          title: t("settings.profile"),
          desc: "Manage your personal account profile, authentication, and token quota.",
        };
      case "appearance":
        return {
          title: t("settings.appearance"),
          desc: "Configure theme mode and conversation workbench layout.",
        };
      case "model-settings":
        return {
          title: t("settings.models"),
          desc: "Configure multi-modal AI models for LLM reasoning, speech synthesis, image generation, and cinematic video.",
        };
      case "personalization":
        return {
          title: t("settings.personalization"),
          desc: "This capability is currently being configured and will be available in an upcoming update.",
        };
      case "keyboard-shortcuts":
        return {
          title: t("settings.keyboardShortcuts"),
          desc: "Keyboard shortcuts and hotkeys for fast navigation across the workbench.",
        };
      case "usage-stats":
        return {
          title: t("settings.usageStatistic"),
          desc: "Monitor your weekly token consumption and account usage limits.",
        };
      case "memory":
        return {
          title: t("settings.memory"),
          desc: "Save and reuse long-term context across your workspaces and global sessions.",
        };
      case "mcp-servers":
        return {
          title: t("settings.mcpServers"),
          desc: "Manage Model Context Protocol servers and tool integrations.",
        };
      case "skills":
        return {
          title: t("settings.skills"),
          desc: "Manage agent skills, workflow procedures, and custom tool suites.",
        };
      case "subagents":
        return {
          title: t("settings.subagents"),
          desc: "Configure autonomous subagent swarms and delegation capabilities.",
        };
      case "plugins":
        return {
          title: t("settings.plugins"),
          desc: "Extend desktop functionality with community and local plugins.",
        };
      default:
        return {
          title: activeTab.replace(/-/g, " "),
          desc: "This capability is currently being configured and will be available in an upcoming update.",
        };
    }
  }, [activeTab, t]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-xs select-none p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
    >
      <div
        className="w-[980px] max-w-[95vw] h-[670px] max-h-[88vh] bg-[#ffffff] dark:bg-[#161616] border border-[#dedee2] dark:border-[#383838] rounded-2xl flex overflow-hidden text-[#262626] dark:text-[#d4d4d4] font-sans outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 shadow-2xl dark:shadow-[0_24px_70px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-[0.985] duration-150"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* ----------------------------------------------------------- */}
        {/* Left Sidebar inside Modal                                   */}
        {/* ----------------------------------------------------------- */}
        <aside className="w-[220px] sm:w-[240px] h-full flex flex-col shrink-0 bg-[#f4f4f6] dark:bg-[#222222] border-r border-[#dedee2] dark:border-[#383838] p-3 select-none">
          {/* Top Heading */}
          <div className="px-2.5 pt-2 pb-2 shrink-0 mb-1">
            <h2 className="text-base font-semibold text-[#171717] dark:text-white tracking-tight">
              {t("settings.title")}
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
                            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left outline-none focus:outline-none",
                            isActive
                              ? "bg-[#e2e2e5] dark:bg-[#383838] text-[#262626] dark:text-white"
                              : "text-[#555555] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b]"
                          )}
                        >
                          <Icon
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isActive
                                ? "text-[#262626] dark:text-white"
                                : "text-[#737373] dark:text-[#969696]"
                            )}
                          />
                          <span className="truncate">{item.label}</span>
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
        {/* Right Main Content Area                                     */}
        {/* ----------------------------------------------------------- */}
        <main className="flex-1 h-full flex flex-col min-w-0 bg-[#ffffff] dark:bg-[#161616] overflow-hidden">
          {/* Header Row: Title, Subtitle, and Top-Right Close Button 'X' */}
          <div className="flex-none px-6 sm:px-8 pt-5 pb-2 flex items-start justify-between gap-4 select-none">
            <div>
              <h1 className="text-xl font-medium tracking-tight text-[#262626] dark:text-white capitalize">
                {tabHeader.title}
              </h1>
              <p className="mt-1 text-xs text-[#737373] dark:text-[#969696]">
                {tabHeader.desc}
              </p>
            </div>

            {/* Top-Right Close Button 'X' */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer outline-none focus:outline-none shrink-0"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dynamic Section Content wrapped in Radix ScrollArea */}
          <ScrollArea className="flex-1 min-h-0 w-full px-6 sm:px-8 py-3">
            {activeTab === "profile" ? (
              /* --------------------------------------------------------- */
              /* Profile Tab                                               */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl pb-6">
                {/* Account Profile Card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    User Profile
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar className="h-12 w-12 rounded-full bg-[#eaeaea] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] shrink-0">
                          {user?.image ? (
                            <AvatarImage
                              src={user.image}
                              alt={user?.name || "User"}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="text-sm font-semibold text-[#262626] dark:text-white bg-[#e2e2e5] dark:bg-[#383838]">
                              {initials}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="min-w-0 flex flex-col">
                          <span className="text-sm font-medium text-[#262626] dark:text-white truncate">
                            {user?.name || "Const User"}
                          </span>
                          <span className="text-xs text-[#737373] dark:text-[#969696] truncate">
                            {user?.email || "Local Workspace"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#ebebed] dark:bg-[#1b1b1b] text-[#555555] dark:text-[#d4d4d4] border border-[#dedee2] dark:border-[#383838]">
                          Local Studio
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#dedee2] dark:border-[#383838] text-xs">
                      <div className="flex flex-col">
                        <span className="text-[#737373] dark:text-[#969696]">Account Identifier</span>
                        <span className="font-mono text-[#262626] dark:text-[#d4d4d4] mt-0.5">
                          {user?.id || "local-user-session"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(user?.id || user?.email || "local-user-session");
                          toast.success("Account ID copied to clipboard");
                        }}
                        className="px-2.5 py-1 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span>Copy ID</span>
                      </button>
                    </div>

                    {(onSwitchAccount || onSignOut) && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#dedee2] dark:border-[#383838]">
                        {onSwitchAccount && (
                          <button
                            type="button"
                            onClick={onSwitchAccount}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>Switch account</span>
                          </button>
                        )}
                        {onSignOut && (
                          <button
                            type="button"
                            onClick={onSignOut}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign out</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Token Quota Card */}
                {quota && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                      Token Allocation
                    </span>
                    <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#262626] dark:text-white">Weekly Quota</span>
                        <span className="font-mono text-[#262626] dark:text-[#d4d4d4]">
                          {formatTokenDisplay(quota.remainingTokens)} / {formatTokenDisplay(quota.weeklyLimitTokens || 7_000_000)} tokens
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#e5e5e8] dark:bg-[#2b2b2b] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#22c55e] transition-all rounded-full"
                          style={{ width: `${Math.max(2, percentRemaining)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-[#969696]">
                        <span>{percentRemaining.toFixed(1)}% remaining</span>
                        <span>Resets in {quota.resetsInText || "7 days"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === "general" ? (
              /* --------------------------------------------------------- */
              /* General Settings Tab                                      */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl pb-6">
                {/* 1. Workspace & Default Project Location */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Workspace & Location
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-3">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                        Default Project Location
                      </span>
                      <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                        Fallback directory used for outside workspace sessions and new scratch tasks.
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2 rounded-lg bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#333333]">
                      <div className="flex items-center gap-2 min-w-0 flex-1 px-1">
                        <FolderOpen className="w-4 h-4 text-[#737373] dark:text-[#969696] shrink-0" />
                        <span className="font-mono text-xs text-[#262626] dark:text-[#d4d4d4] truncate">
                          {defaultProjectLocation || "Default (~/.const/harness/brain)"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 justify-end">
                        <button
                          type="button"
                          onClick={handleBrowseDefaultLocation}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#dedee2] dark:border-[#383838] bg-[#f4f4f6] dark:bg-[#2b2b2b] hover:bg-[#ebebed] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Browse...</span>
                        </button>
                        {defaultProjectLocation && (
                          <button
                            type="button"
                            onClick={handleResetDefaultLocation}
                            className="px-2 py-1 text-[11px] font-medium rounded-md border border-transparent hover:border-[#dedee2] dark:hover:border-[#383838] hover:bg-[#ebebed] dark:hover:bg-[#2e2e2e] text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1 outline-none focus:outline-none"
                            title="Reset to default session location"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Language & Localization */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Language & Region
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                        Interface Language
                      </span>
                      <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                        Select the display language for the application interface and controls.
                      </span>
                    </div>

                    <div className="relative" ref={languageDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsLanguageDropdownOpen((prev) => !prev)}
                        className="px-3 py-1.5 rounded-lg bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] border border-[#dedee2] dark:border-[#383838] text-[12px] font-medium text-[#262626] dark:text-white flex items-center gap-2 transition-colors cursor-pointer outline-none focus:outline-none"
                      >
                        <Globe className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span>
                          {LANGUAGE_OPTIONS.find((l) => l.id === language)?.native || "English (US)"}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                      </button>

                      {isLanguageDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl shadow-xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                          {LANGUAGE_OPTIONS.map((opt) => {
                            const isSelected = language === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleSetLanguage(opt.id)}
                                className={cn(
                                  "w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between gap-2 transition-colors cursor-pointer outline-none focus:outline-none text-xs",
                                  isSelected
                                    ? "bg-black/5 dark:bg-white/10 text-[#262626] dark:text-white font-medium"
                                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#555555] dark:text-[#d4d4d4]"
                                )}
                              >
                                <div className="flex flex-col">
                                  <span>{opt.native}</span>
                                  <span className="text-[10px] text-[#737373] dark:text-[#969696]">
                                    {opt.label}
                                  </span>
                                </div>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 shrink-0 text-[#262626] dark:text-white" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Default Permission (Security Preset) */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Agent Permissions
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          Default Permission
                        </span>
                      </div>
                      <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                        Controls default tool execution, terminal commands, and file mutation approvals.
                      </span>
                    </div>

                    <div className="relative" ref={presetDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsPresetDropdownOpen((prev) => !prev)}
                        className="px-3 py-1.5 rounded-lg bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] border border-[#dedee2] dark:border-[#383838] text-[12px] font-medium text-[#262626] dark:text-white flex items-center gap-2 transition-colors cursor-pointer outline-none focus:outline-none"
                      >
                        <span>
                          {defaultConfirmationMode === "full_access"
                            ? "Full Machine"
                            : defaultConfirmationMode === "request_review"
                            ? "Request Review"
                            : "Ask Before Changes"}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                      </button>

                      {isPresetDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl shadow-xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                          <button
                            type="button"
                            onClick={() => handleSetDefaultMode("ask_before_changes")}
                            className={cn(
                              "w-full px-2.5 py-2 rounded-lg text-left flex items-start justify-between gap-2 transition-colors cursor-pointer outline-none focus:outline-none",
                              defaultConfirmationMode === "ask_before_changes"
                                ? "bg-black/5 dark:bg-white/10 text-[#262626] dark:text-white font-medium"
                                : "hover:bg-black/5 dark:hover:bg-white/5 text-[#555555] dark:text-[#d4d4d4]"
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="text-[12px]">Ask Before Changes (Default)</span>
                              <span className="text-[10px] text-[#737373] dark:text-[#969696] font-normal">
                                Prompts for confirmation before command execution or file modifications.
                              </span>
                            </div>
                            {defaultConfirmationMode === "ask_before_changes" && (
                              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#262626] dark:text-white" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetDefaultMode("full_access")}
                            className={cn(
                              "w-full px-2.5 py-2 rounded-lg text-left flex items-start justify-between gap-2 transition-colors cursor-pointer outline-none focus:outline-none",
                              defaultConfirmationMode === "full_access"
                                ? "bg-black/5 dark:bg-white/10 text-[#262626] dark:text-white font-medium"
                                : "hover:bg-black/5 dark:hover:bg-white/5 text-[#555555] dark:text-[#d4d4d4]"
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="text-[12px]">Full Machine</span>
                              <span className="text-[10px] text-[#737373] dark:text-[#969696] font-normal">
                                Autonomous agent execution without prompt interruptions.
                              </span>
                            </div>
                            {defaultConfirmationMode === "full_access" && (
                              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#262626] dark:text-white" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetDefaultMode("request_review")}
                            className={cn(
                              "w-full px-2.5 py-2 rounded-lg text-left flex items-start justify-between gap-2 transition-colors cursor-pointer outline-none focus:outline-none",
                              defaultConfirmationMode === "request_review"
                                ? "bg-black/5 dark:bg-white/10 text-[#262626] dark:text-white font-medium"
                                : "hover:bg-black/5 dark:hover:bg-white/5 text-[#555555] dark:text-[#d4d4d4]"
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="text-[12px]">Request Review</span>
                              <span className="text-[10px] text-[#737373] dark:text-[#969696] font-normal">
                                Always stages changes for side-by-side visual diff inspection.
                              </span>
                            </div>
                            {defaultConfirmationMode === "request_review" && (
                              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#262626] dark:text-white" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Message Queuing Behavior */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Message Execution Behavior
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          Queue Message
                        </span>
                      </div>
                      <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                        Behavior when sending a message while the agent is actively executing a task.
                      </span>
                    </div>

                    <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSetQueueMode("queue")}
                        className={cn(
                          "px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none",
                          queueMode === "queue"
                            ? "bg-[#ffffff] dark:bg-[#383838] text-[#262626] dark:text-white shadow-2xs font-medium"
                            : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                        )}
                        title="Queue messages to run sequentially after current task"
                      >
                        <span>Queue Message</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetQueueMode("steer")}
                        className={cn(
                          "px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none",
                          queueMode === "steer"
                            ? "bg-[#ffffff] dark:bg-[#383838] text-[#262626] dark:text-white shadow-2xs font-medium"
                            : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                        )}
                        title="Send message immediately to steer the running agent"
                      >
                        <span>Send Directly</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. Notifications & Sound Alerts */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Notifications & Audio
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-4">
                    {/* Task Notification Row */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <Bell className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            Task Notifications
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Display desktop notifications when an agent finishes a task or requires confirmation.
                        </span>
                      </div>

                      <Switch
                        checked={taskNotifications}
                        onCheckedChange={handleToggleTaskNotifications}
                      />
                    </div>

                    {/* Sound Alerts Row */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            Completion Sound Effects
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Play a subtle audio chime when agent execution completes.
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => playTaskCompletionSound()}
                          className="px-2 py-1 text-[11px] rounded-md border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#737373] dark:text-[#d4d4d4] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1 outline-none focus:outline-none"
                          title="Preview completion chime"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Test</span>
                        </button>
                        <Switch
                          checked={soundAlerts}
                          onCheckedChange={handleToggleSoundAlerts}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Updates & Startup Preferences */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Updates & Startup
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-4">
                    {/* Automatic Updates Row */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            Automatically Download and Install Updates
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Keep Const Harness updated with the latest agent capabilities and improvements.
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isCheckingUpdate}
                          onClick={handleCheckUpdates}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none disabled:opacity-50"
                        >
                          <RefreshCw className={cn("w-3 h-3", isCheckingUpdate && "animate-spin")} />
                          <span>Check for Updates</span>
                        </button>
                        <Switch
                          checked={autoUpdates}
                          onCheckedChange={handleToggleAutoUpdates}
                        />
                      </div>
                    </div>

                    {/* Launch on Startup Row */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <Laptop className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            Launch on System Startup
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Automatically start Const Harness in background when logging in to your system.
                        </span>
                      </div>

                      <Switch
                        checked={launchOnStartup}
                        onCheckedChange={handleToggleLaunchOnStartup}
                      />
                    </div>
                  </div>
                </div>

                {/* 7. About & System Storage */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Application Info & Storage
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#737373] dark:text-[#969696]">App Version</span>
                      <span className="font-mono text-[#262626] dark:text-[#d4d4d4] font-medium">
                        v0.1.0-alpha
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#737373] dark:text-[#969696]">Operating System</span>
                      <span className="font-mono text-[#262626] dark:text-[#d4d4d4]">
                        {window.electron?.platform || "desktop"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#737373] dark:text-[#969696]">Runtime Environment</span>
                      <span className="font-mono text-[#262626] dark:text-[#d4d4d4]">
                        Electron {window.electron?.versions?.electron || "34"} • Node {window.electron?.versions?.node || "20"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#dedee2] dark:border-[#383838] text-xs">
                      <div className="flex flex-col">
                        <span className="text-[#262626] dark:text-white font-medium">Local App Storage</span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                          Config files, agent logs, and outside brain session storage (~/.const).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenDataFolder}
                        className="px-2.5 py-1 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span>Open Folder</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "keyboard-shortcuts" ? (
              /* --------------------------------------------------------- */
              /* Keyboard Shortcuts Tab                                    */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-4 max-w-2xl pb-6">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] dark:text-[#969696]" />
                  <input
                    type="text"
                    value={shortcutsSearch}
                    onChange={(e) => setShortcutsSearch(e.target.value)}
                    placeholder="Search shortcuts..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] text-[#262626] dark:text-white placeholder-[#888888] dark:placeholder-[#666666] outline-none focus:border-[#737373] dark:focus:border-[#969696] transition-colors"
                  />
                  {shortcutsSearch && (
                    <button
                      type="button"
                      onClick={() => setShortcutsSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Shortcuts List */}
                {filteredShortcuts.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {filteredShortcuts.map((cat) => (
                      <div key={cat.category} className="flex flex-col gap-2">
                        <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                          {cat.category}
                        </span>
                        <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] divide-y divide-[#dedee2] dark:divide-[#383838] overflow-hidden">
                          {cat.items.map((item) => (
                            <div
                              key={item.label}
                              className="px-4 py-2.5 flex items-center justify-between gap-4 text-xs hover:bg-black/2 dark:hover:bg-white/2 transition-colors"
                            >
                              <span className="text-[#262626] dark:text-[#d4d4d4] font-medium">
                                {item.label}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {item.keys.map((k, idx) => (
                                  <kbd
                                    key={idx}
                                    className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-[#ffffff] dark:bg-[#2c2c2c] border border-[#dedee2] dark:border-[#404040] text-[#262626] dark:text-white shadow-2xs"
                                  >
                                    {k}
                                  </kbd>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <Keyboard className="w-8 h-8 text-[#a3a3a3] dark:text-[#555555] mb-2" />
                    <p className="text-xs text-[#737373] dark:text-[#969696]">
                      No shortcuts matching "{shortcutsSearch}"
                    </p>
                  </div>
                )}
              </div>
            ) : activeTab === "appearance" ? (
              /* --------------------------------------------------------- */
              /* Appearance Settings Tab                                   */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl pb-6">
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Interface & Layout
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-4">
                    {/* Theme row */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          Theme
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Select light, dark, or follow system appearance.
                        </span>
                      </div>

                      {/* Segmented Control */}
                      <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setTheme("system")}
                          className={cn(
                            "px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none",
                            theme === "system"
                              ? "bg-[#ffffff] dark:bg-[#383838] text-[#262626] dark:text-white shadow-2xs font-medium"
                              : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                          )}
                          title="Follow system appearance"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          <span>System</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTheme("light")}
                          className={cn(
                            "px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none",
                            theme === "light"
                              ? "bg-[#ffffff] dark:bg-[#383838] text-[#262626] dark:text-white shadow-2xs font-medium"
                              : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                          )}
                          title="Light theme"
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>Light</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTheme("dark")}
                          className={cn(
                            "px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none",
                            theme === "dark"
                              ? "bg-[#ffffff] dark:bg-[#383838] text-[#262626] dark:text-white shadow-2xs font-medium"
                              : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                          )}
                          title="Dark theme"
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>Dark</span>
                        </button>
                      </div>
                    </div>

                    {/* Conversation Width row */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          Conversation Width
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Maximum width of the conversation container in workbench.
                        </span>
                      </div>

                      {/* Segmented Control */}
                      <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5 shrink-0">
                        {(["default", "narrow", "wide"] as const).map((w) => {
                          const isSelected = conversationWidth === w;
                          const label = w === "default" ? "Default" : w === "narrow" ? "Narrow" : "Wide";
                          const sizeHint = w === "default" ? "672px" : w === "narrow" ? "540px" : "896px";
                          return (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setConversationWidth(w)}
                              className={cn(
                                "px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer outline-none focus:outline-none",
                                isSelected
                                  ? "bg-[#ffffff] dark:bg-[#383838] text-[#262626] dark:text-white shadow-2xs font-medium"
                                  : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                              )}
                              title={`${label} width (${sizeHint})`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Font Size & Interface Scale row */}
                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          Font Size & Interface Scale
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Adjust font size and UI scale across the entire application (Min {MIN_ZOOM}%, Max {MAX_ZOOM}%).
                        </span>
                      </div>

                      {/* Stepper Control: [-] [100%] [+] and Reset button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={zoom <= MIN_ZOOM}
                            onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}
                            className={cn(
                              "p-1.5 rounded-md transition-all flex items-center justify-center outline-none focus:outline-none",
                              zoom <= MIN_ZOOM
                                ? "opacity-30 cursor-not-allowed text-[#a9a9a9] dark:text-[#666666]"
                                : "cursor-pointer text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ffffff] dark:hover:bg-[#383838] shadow-2xs"
                            )}
                            title={`Decrease font size (${Math.max(MIN_ZOOM, zoom - ZOOM_STEP)}%)`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <span className="min-w-[48px] text-center text-[12px] font-medium font-sans tabular-nums text-[#262626] dark:text-white select-none px-1">
                            {zoom}%
                          </span>

                          <button
                            type="button"
                            disabled={zoom >= MAX_ZOOM}
                            onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
                            className={cn(
                              "p-1.5 rounded-md transition-all flex items-center justify-center outline-none focus:outline-none",
                              zoom >= MAX_ZOOM
                                ? "opacity-30 cursor-not-allowed text-[#a9a9a9] dark:text-[#666666]"
                                : "cursor-pointer text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ffffff] dark:hover:bg-[#383838] shadow-2xs"
                            )}
                            title={`Increase font size (${Math.min(MAX_ZOOM, zoom + ZOOM_STEP)}%)`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {zoom !== DEFAULT_ZOOM && (
                          <button
                            type="button"
                            onClick={() => setZoom(DEFAULT_ZOOM)}
                            className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ebebed] dark:hover:bg-[#2e2e2e] transition-colors cursor-pointer flex items-center gap-1.5 border border-transparent hover:border-[#dedee2] dark:hover:border-[#383838]"
                            title="Reset font size to default (100%)"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "usage-stats" ? (
              /* --------------------------------------------------------- */
              /* Usage Stats Tab                                           */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl pb-6">
                {/* 3 Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                      Remaining
                    </span>
                    <span className="text-xl font-semibold font-sans tabular-nums text-[#262626] dark:text-white mt-1">
                      {formatTokenDisplay(quota?.remainingTokens ?? 7_000_000)}
                    </span>
                    <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                      {percentRemaining.toFixed(1)}% available
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                      Weekly Quota
                    </span>
                    <span className="text-xl font-semibold font-sans tabular-nums text-[#262626] dark:text-white mt-1">
                      {formatTokenDisplay(quota?.weeklyLimitTokens ?? 7_000_000)}
                    </span>
                    <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                      Included free weekly
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                      Resets In
                    </span>
                    <span className="text-xl font-semibold font-sans tabular-nums text-[#262626] dark:text-white mt-1">
                      {quota?.resetsInText || "7d 0h"}
                    </span>
                    <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                      Rolling weekly cycle
                    </span>
                  </div>
                </div>

                {/* Quota Progress Card */}
                <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 sm:p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                        Token Allocation
                      </span>
                      <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                        {formatTokenDisplay((quota?.weeklyLimitTokens ?? 7_000_000) - (quota?.remainingTokens ?? 7_000_000))} used of {formatTokenDisplay(quota?.weeklyLimitTokens ?? 7_000_000)} limit
                      </span>
                    </div>
                    <span className="font-sans tabular-nums text-xs font-medium px-2 py-0.5 rounded-md bg-[#ebebed] dark:bg-[#2b2b2b] text-[#262626] dark:text-[#d4d4d4]">
                      {percentRemaining.toFixed(0)}% Left
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2.5 rounded-full bg-[#e5e5e8] dark:bg-[#1b1b1b] overflow-hidden border border-[#dedee2] dark:border-[#383838]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        percentRemaining > 50
                          ? "bg-[#22c55e]"
                          : percentRemaining > 20
                          ? "bg-[#eab308]"
                          : "bg-[#ef4444]"
                      )}
                      style={{ width: `${percentRemaining}%` }}
                    />
                  </div>

                  <div className="font-sans tabular-nums text-[11px] text-[#737373] dark:text-[#969696] flex items-center justify-between">
                    <span>0 tokens</span>
                    <span>{formatTokenDisplay(quota?.weeklyLimitTokens ?? 7_000_000)} max</span>
                  </div>
                </div>

                {/* Informational note */}
                <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f4f4f6] dark:bg-[#1e1e1e] p-3.5 flex items-start gap-2.5 text-xs text-[#737373] dark:text-[#969696]">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#737373] dark:text-[#969696]" />
                  <div className="flex flex-col gap-1 leading-relaxed">
                    <span className="font-medium text-[#262626] dark:text-[#d4d4d4]">Router Native Gateway</span>
                    <span>
                      Your weekly quota of 7,000,000 tokens covers all queries routed through the Const native router. Custom external providers configured in Models use your own API keys directly.
                    </span>
                  </div>
                </div>
              </div>
            ) : activeTab === "model-settings" ? (
              /* --------------------------------------------------------- */
              /* Model Settings View (LLM, Speech, Image, Video)          */
              /* --------------------------------------------------------- */
              <ModelSettings
                quota={quota}
                onActiveModelChanged={(modelId) => handleSelectActiveModel(modelId)}
              />
            ) : activeTab === "memory" ? (
              /* --------------------------------------------------------- */
              /* Memory Settings View                                      */
              /* --------------------------------------------------------- */
              <MemorySettings currentProject={currentProject} />
            ) : activeTab === "skills" ? (
              /* --------------------------------------------------------- */
              /* Agent Skills Settings View                                */
              /* --------------------------------------------------------- */
              <SkillsSettings />
            ) : (
              /* --------------------------------------------------------- */
              /* Generic Placeholder for other capabilities                */
              /* (subagents, plugins, mcp-servers, skills)                 */
              /* --------------------------------------------------------- */
              (() => {
                const currentItem = navCategories
                  .flatMap((c) => c.items)
                  .find((i) => i.id === activeTab);
                const Icon = currentItem?.icon || Settings;
                return (
                  <div className="flex flex-col gap-3 pt-6 max-w-2xl pb-6">
                    <div className="p-8 rounded-2xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#262626] dark:text-white">
                        <Icon className="w-6 h-6 text-[#262626] dark:text-white" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <h3 className="text-sm font-medium text-[#262626] dark:text-white capitalize">
                          {currentItem?.label || activeTab.replace(/-/g, " ")}
                        </h3>
                        <p className="text-xs text-[#737373] dark:text-[#969696] max-w-md">
                          This capability is currently being configured and will be available in an upcoming update.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
