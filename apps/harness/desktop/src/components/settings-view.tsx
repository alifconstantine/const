import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Store,
  UserRound,
  UserRoundPen,
  Keyboard,
  Palette,
  Box,
  Brain,
  Bot,
  Blocks,
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
  Camera,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
  Mail,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useKeyboardShortcuts, DEFAULT_KEYBOARD_SHORTCUTS, type ShortcutItem } from "../lib/shortcuts";
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
  useUiFontSize,
  DEFAULT_UI_FONT_SIZE,
  MIN_UI_FONT_SIZE,
  MAX_UI_FONT_SIZE,
  useCodeFontSize,
  DEFAULT_CODE_FONT_SIZE,
  MIN_CODE_FONT_SIZE,
  MAX_CODE_FONT_SIZE,
  useDiffMarks,
} from "../lib/theme";
import { ModelSettings } from "./settings/model-settings";
import { MemorySettings } from "./settings/memory-settings";
import { SkillsSettings } from "./settings/skills-settings";
import { UsageStatsView } from "./settings/usage-stats-view";
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
    desc: "Advanced frontier thinking with 1M context, extended reasoning depth, and multimodal vision. Included in free weekly quota.",
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Ultra-fast response model optimized for real-time coding, tool execution, and responsive natural dialogue.",
  },
  {
    id: "deepseek-v4.1-flash",
    name: "Deepseek v4.1 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "High-performance MoE reasoning model specializing in complex algorithmic coding, mathematics, and architectural refactoring.",
  },
  {
    id: "qwen-3.8-omni-flash",
    name: "Qwen 3.8 Omni Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Native omni-modal foundation model strong across multilingual tasks, software engineering, vision, and audio.",
  },
  {
    id: "gpt-6-luna",
    name: "GPT 6 Luna",
    contextWindow: "272K Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Frontier reasoning powerhouse with 272K context, nuanced writing, and high-fidelity problem solving.",
  },
  {
    id: "combo/coding",
    name: "combo/coding",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Priority failover coding chain: GLM 5.3 Flash -> Gemini 3.8 Flash -> Deepseek v4.1 Flash -> Qwen Omni -> GPT 6 Luna.",
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    contextWindow: "272K Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Balanced reasoning router: GPT 6 Luna -> Deepseek v4.1 Flash -> Gemini 3.8 Flash -> Qwen Omni -> GLM 5.3 Flash.",
  },
  {
    id: "combo/fast",
    name: "combo/fast",
    contextWindow: "272K Context",
    maxOutput: "128K Output",
    supportsThinking: false,
    desc: "Low-latency sub-second chain: GPT 6 Luna -> Gemini 3.8 Flash -> Deepseek v4.1 Flash -> GLM 5.3 Flash -> Qwen Omni.",
  },
];

export const AVATAR_PRESETS = [
  {
    id: "cosmic",
    name: "Cosmic Indigo",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%236366f1"/><stop offset="100%" stop-color="%23a855f7"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g1)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "emerald",
    name: "Emerald Spark",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23059669"/><stop offset="100%" stop-color="%2310b981"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g2)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "solar",
    name: "Solar Sunset",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f97316"/><stop offset="100%" stop-color="%23ec4899"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g3)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "cyber",
    name: "Neon Cyber",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2306b6d4"/><stop offset="100%" stop-color="%233b82f6"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g4)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "amber",
    name: "Mystic Pulse",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d97706"/><stop offset="100%" stop-color="%23ef4444"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g5)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
  },
  {
    id: "obsidian",
    name: "Obsidian Core",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e293b"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(%23g6)"/><circle cx="40" cy="31" r="13" fill="%23ffffff" fill-opacity="0.95"/><path d="M22 65c0-10 8-18 18-18s18 8 18 18" fill="%23ffffff" fill-opacity="0.95"/></svg>`,
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
  const [uiFontSize, setUiFontSize] = useUiFontSize();
  const [codeFontSize, setCodeFontSize] = useCodeFontSize();
  const [diffMarks, setDiffMarks] = useDiffMarks();

  // Local configuration
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [activeModel, setActiveModel] = useState<string>(() => {
    const saved = localStorage.getItem("const_harness_active_model");
    if (!saved || saved === "Const" || saved === "gemini-3.6-flash" || saved === "gemini-3.7-flash" || saved === "qwen-3.8-27b") return "gemini-3.8-flash";
    if (saved === "Gemini 3.8 Flash") return "gemini-3.8-flash";
    if (saved === "GLM 5.3 Flash") return "glm-5.3-flash";
    if (saved === "Deepseek v4.1 Flash") return "deepseek-v4.1-flash";
    if (saved === "Qwen 3.8 Omni Flash") return "qwen-3.8-omni-flash";
    if (saved === "GPT 6 Luna") return "gpt-6-luna";
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

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setIsPresetDropdownOpen(false);
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setIsRoleDropdownOpen(false);
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

  // Profile settings state & mutations
  const updateProfileMutation = useMutation(api.users.updateProfile);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState<string>(user?.name || "Const User");
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingUsername && user?.name) {
      setUsernameDraft(user.name);
    }
  }, [user?.name, isEditingUsername]);

  const handleSaveUsername = async () => {
    const trimmed = usernameDraft.trim();
    if (!trimmed) {
      toast.error("Username cannot be empty");
      return;
    }
    try {
      const existingRaw = localStorage.getItem("const_custom_user_profile");
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const updated = { ...existing, name: trimmed };
      localStorage.setItem("const_custom_user_profile", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("const:user-profile-updated", { detail: updated }));

      try {
        await updateProfileMutation({ name: trimmed });
      } catch {
        // Silently fallback if offline/unauthenticated
      }

      setIsEditingUsername(false);
      toast.success("Username updated successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update username");
    }
  };

  const handleSelectAvatarPreset = async (avatarUrl: string) => {
    try {
      const existingRaw = localStorage.getItem("const_custom_user_profile");
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const updated = { ...existing, image: avatarUrl };
      localStorage.setItem("const_custom_user_profile", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("const:user-profile-updated", { detail: updated }));

      try {
        await updateProfileMutation({ image: avatarUrl });
      } catch {
        // Fallback if offline/unauthenticated
      }

      setIsAvatarPickerOpen(false);
      toast.success("Avatar updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update avatar");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await handleSelectAvatarPreset(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    try {
      const existingRaw = localStorage.getItem("const_custom_user_profile");
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const updated = { ...existing, image: "" };
      localStorage.setItem("const_custom_user_profile", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("const:user-profile-updated", { detail: updated }));

      try {
        await updateProfileMutation({ image: "" });
      } catch {
        // Fallback
      }

      setIsAvatarPickerOpen(false);
      toast.success("Avatar removed (initials restored)");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove avatar");
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
        if (cfg?.personalizationWorkRole !== undefined) {
          setWorkRole(cfg.personalizationWorkRole);
        }
        if (cfg?.personalizationCustomInstructions !== undefined) {
          setCustomInstructions(cfg.personalizationCustomInstructions);
        }
      });
    }
  }, [refreshKey]);

  // Personalization settings state
  const [workRole, setWorkRole] = useState<string>(() => {
    return localStorage.getItem("const_personalization_work_role") || "";
  });
  const [customInstructions, setCustomInstructions] = useState<string>(() => {
    return localStorage.getItem("const_personalization_custom_instructions") || "";
  });
  const [isSavingPersonalization, setIsSavingPersonalization] = useState(false);

  const WORK_ROLE_OPTIONS = useMemo(
    () => [
      { id: "", label: "Select..." },
      { id: "Software Engineer / Developer", label: "Software Engineer / Developer" },
      { id: "Full-Stack Engineer", label: "Full-Stack Engineer" },
      { id: "Frontend Engineer", label: "Frontend Engineer" },
      { id: "Backend Engineer", label: "Backend Engineer" },
      { id: "AI / ML Researcher", label: "AI / ML Researcher" },
      { id: "Data Scientist / Analyst", label: "Data Scientist / Analyst" },
      { id: "DevOps / Infrastructure Engineer", label: "DevOps / Infrastructure Engineer" },
      { id: "Product Manager", label: "Product Manager" },
      { id: "Student / Academic", label: "Student / Academic" },
      { id: "Designer / Creative", label: "Designer / Creative" },
      { id: "Technical Writer", label: "Technical Writer" },
      { id: "Other", label: "Other" },
    ],
    []
  );

  const handleSavePersonalization = () => {
    setIsSavingPersonalization(true);
    localStorage.setItem("const_personalization_work_role", workRole);
    localStorage.setItem("const_personalization_custom_instructions", customInstructions);
    if (window.electron?.saveConfig) {
      window.electron
        .saveConfig({
          personalizationWorkRole: workRole,
          personalizationCustomInstructions: customInstructions,
        })
        .catch(() => {});
    }
    setTimeout(() => {
      setIsSavingPersonalization(false);
      toast.success("Personalization saved successfully");
    }, 200);
  };

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

  // Keyboard Shortcuts state & definitions matching ZCode
  const [shortcutsSearch, setShortcutsSearch] = useState<string>("");
  const { shortcuts, updateShortcut, deleteShortcut, resetAll } = useKeyboardShortcuts();
  const [recordingTarget, setRecordingTarget] = useState<{
    id: string;
    comboIndex: number;
    command: string;
    keys: string[];
  } | null>(null);

  const isMac = useMemo(() => {
    return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  }, []);

  const getCommandName = useCallback(
    (item: ShortcutItem) => {
      const camelId = item.id.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const transKey = `shortcuts.${camelId}` as any;
      const translated = t(transKey);
      return translated && translated !== transKey ? translated : item.command;
    },
    [t]
  );

  const getScopeName = useCallback(
    (scope: string) => {
      const transKey = `shortcuts.scope${scope}` as any;
      const translated = t(transKey);
      return translated && translated !== transKey ? translated : scope;
    },
    [t]
  );

  // Listen to keyboard recording when changing keybindings
  useEffect(() => {
    if (!recordingTarget) return;

    const handleKeyRecord = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingTarget(null);
        return;
      }

      if (e.key === "Enter" && recordingTarget.keys.length > 0) {
        const item = shortcuts.find((s) => s.id === recordingTarget.id);
        if (item) {
          const nextCombos = [...item.keybindings];
          nextCombos[recordingTarget.comboIndex] = recordingTarget.keys;
          updateShortcut(recordingTarget.id, nextCombos);
          const cmdName = getCommandName(item);
          toast.success(t("shortcuts.updatedToast" as any, { command: cmdName }));
        }
        setRecordingTarget(null);
        return;
      }

      const isModifier = ["Control", "Shift", "Alt", "Meta"].includes(e.key);
      if (isModifier) return;

      const keys: string[] = [];
      if (e.ctrlKey || e.metaKey) keys.push(isMac ? "⌘" : "Ctrl");
      if (e.shiftKey) keys.push("Shift");
      if (e.altKey) keys.push("Alt");

      let keyName = e.key;
      if (keyName === " ") keyName = "Space";
      else if (keyName === "ArrowUp") keyName = "Up";
      else if (keyName === "ArrowDown") keyName = "Down";
      else if (keyName === "ArrowLeft") keyName = "Left";
      else if (keyName === "ArrowRight") keyName = "Right";
      else if (keyName.length === 1) keyName = keyName.toUpperCase();

      keys.push(keyName);
      setRecordingTarget((prev) => (prev ? { ...prev, keys } : null));
    };

    window.addEventListener("keydown", handleKeyRecord, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyRecord, { capture: true });
  }, [recordingTarget, shortcuts, updateShortcut, isMac, getCommandName, t]);

  const filteredShortcuts = useMemo(() => {
    if (!shortcutsSearch.trim()) return shortcuts;
    const q = shortcutsSearch.toLowerCase().trim();
    return shortcuts.filter((item) => {
      const cmdName = getCommandName(item).toLowerCase();
      const rawCmd = item.command.toLowerCase();
      const scopeName = getScopeName(item.scope).toLowerCase();
      const rawScope = item.scope.toLowerCase();
      const matchCombo = item.keybindings.some((combo) =>
        combo.some((k) => k.toLowerCase().includes(q))
      );
      return (
        cmdName.includes(q) ||
        rawCmd.includes(q) ||
        scopeName.includes(q) ||
        rawScope.includes(q) ||
        matchCombo
      );
    });
  }, [shortcuts, shortcutsSearch, getCommandName, getScopeName]);

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
        { id: "mcp-servers", label: t("settings.mcpServers"), icon: Cable },
        { id: "marketplace", label: t("settings.marketplace"), icon: Store },
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
          desc: "Give Const extra guidance and context for all your chats and tasks.",
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
      case "marketplace":
      case "skills":
        return {
          title: t("marketplace.title"),
          desc: t("marketplace.subtitle"),
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
          desc: t("settings.capabilityUpcoming"),
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
                    {t("settings.userProfileIdentity")}
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-5 flex flex-col gap-5">
                    {/* Avatar & Username Header Section */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Avatar with Hover Camera Button */}
                        <div className="relative group shrink-0">
                          <Avatar className="h-16 w-16 rounded-full bg-[#eaeaea] dark:bg-[#2b2b2b] border-2 border-[#dedee2] dark:border-[#383838] shadow-sm overflow-hidden">
                            {user?.image ? (
                              <AvatarImage
                                src={user.image}
                                alt={user?.name || "User"}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <AvatarFallback className="text-base font-bold text-[#262626] dark:text-white bg-gradient-to-br from-[#e2e2e5] to-[#c7c7cb] dark:from-[#383838] dark:to-[#222222]">
                                {initials}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <button
                            type="button"
                            onClick={() => setIsAvatarPickerOpen((v) => !v)}
                            className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer backdrop-blur-[1px]"
                            title={t("settings.changeAvatar")}
                          >
                            <Camera className="w-5 h-5" />
                            <span className="text-[9px] font-medium mt-0.5">{t("settings.editAvatar")}</span>
                          </button>
                        </div>

                        {/* Username & Status badge */}
                        <div className="min-w-0 flex flex-col">
                          <div className="flex items-center gap-2">
                            {isEditingUsername ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={usernameDraft}
                                  onChange={(e) => setUsernameDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveUsername();
                                    if (e.key === "Escape") {
                                      setUsernameDraft(user?.name || "Const User");
                                      setIsEditingUsername(false);
                                    }
                                  }}
                                  autoFocus
                                  placeholder={t("settings.enterUsername")}
                                  className="px-2.5 py-1 text-sm font-semibold rounded-lg border border-primary/50 bg-[#ffffff] dark:bg-[#1b1b1b] text-[#262626] dark:text-white focus:outline-none focus:ring-1 focus:ring-primary w-44 sm:w-56"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveUsername}
                                  className="p-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
                                  title={t("settings.saveUsername")}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUsernameDraft(user?.name || "Const User");
                                    setIsEditingUsername(false);
                                  }}
                                  className="p-1 rounded-md bg-[#eaeaea] dark:bg-[#333333] text-[#737373] dark:text-[#d4d4d4] hover:bg-[#dedee2] dark:hover:bg-[#444444] transition-colors cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group/name">
                                <span className="text-base font-semibold text-[#262626] dark:text-white truncate">
                                  {user?.name || "Const User"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUsernameDraft(user?.name || "Const User");
                                    setIsEditingUsername(true);
                                  }}
                                  className="opacity-60 hover:opacity-100 p-1 rounded-md hover:bg-[#eaeaea] dark:hover:bg-[#2e2e2e] text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white transition-all cursor-pointer"
                                  title={t("settings.editUsername")}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-[#737373] dark:text-[#969696] truncate">
                              {user?.email || "Local Workspace"}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Change Avatar Button */}
                      <button
                        type="button"
                        onClick={() => setIsAvatarPickerOpen((v) => !v)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span>{t("settings.changeAvatar")}</span>
                      </button>
                    </div>

                    {/* Avatar Picker Drawer / Popover if Open */}
                    {isAvatarPickerOpen && (
                      <div className="p-4 rounded-xl border border-primary/20 bg-[#ffffff] dark:bg-[#1a1a1a] flex flex-col gap-3.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#262626] dark:text-white flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            {t("settings.chooseAvatarOrUpload")}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsAvatarPickerOpen(false)}
                            className="p-1 rounded text-[#737373] hover:text-black dark:text-[#969696] dark:hover:text-white cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Preset Gradients */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696]">
                            {t("settings.avatarPresets")}
                          </span>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {AVATAR_PRESETS.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => handleSelectAvatarPreset(preset.svg)}
                                className="group/preset relative flex flex-col items-center gap-1 p-2 rounded-lg border border-[#dedee2] dark:border-[#333333] hover:border-primary/60 bg-[#f9f9fb] dark:bg-[#222222] hover:bg-[#f0f0f2] dark:hover:bg-[#2a2a2a] transition-all cursor-pointer"
                              >
                                <img
                                  src={preset.svg}
                                  alt={preset.name}
                                  className="w-10 h-10 rounded-full border border-black/10 dark:border-white/10 group-hover/preset:scale-105 transition-transform"
                                />
                                <span className="text-[10px] text-[#737373] dark:text-[#969696] truncate max-w-full text-center">
                                  {preset.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Action Row: Upload file + Remove */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#dedee2] dark:border-[#333333]">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5 text-primary" />
                            <span>{t("settings.uploadCustomImage")}</span>
                          </button>

                          {user?.image && (
                            <button
                              type="button"
                              onClick={handleRemoveAvatar}
                              className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t("settings.removeAvatar")}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Email Address & Verification */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 rounded-lg bg-[#ffffff] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#333333]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Mail className="w-4 h-4 text-[#737373] dark:text-[#969696] shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] text-[#737373] dark:text-[#969696]">{t("settings.emailAddress")}</span>
                          <span className="text-xs font-medium text-[#262626] dark:text-white truncate">
                            {user?.email || t("settings.noEmailLinked")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {user?.email ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#eaeaea] dark:bg-[#2b2b2b] text-[#737373] dark:text-[#969696]">
                            {t("settings.offlineMode")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Account Identifier */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#dedee2] dark:border-[#383838] text-xs">
                      <div className="flex flex-col">
                        <span className="text-[#737373] dark:text-[#969696]">{t("settings.accountIdentifier")}</span>
                        <span className="font-mono text-[#262626] dark:text-[#d4d4d4] mt-0.5 text-[11px]">
                          {user?.id || "local-user-session"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(user?.id || user?.email || "local-user-session");
                          toast.success(t("settings.accountIdCopied"));
                        }}
                        className="px-2.5 py-1 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span>{t("settings.copyId")}</span>
                      </button>
                    </div>

                    {/* Switch Account and Sign Out */}
                    {(onSwitchAccount || onSignOut) && (
                      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                        {onSwitchAccount && (
                          <button
                            type="button"
                            onClick={onSwitchAccount}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>{t("sidebar.switchAccount")}</span>
                          </button>
                        )}
                        {onSignOut && (
                          <button
                            type="button"
                            onClick={onSignOut}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>{t("sidebar.signOut")}</span>
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
                      {t("settings.tokenAllocation")}
                    </span>
                    <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#262626] dark:text-white">{t("settings.weeklyQuota")}</span>
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
                        <span>{t("settings.percentRemaining", { percent: percentRemaining.toFixed(1) })}</span>
                        <span>{t("settings.resetsIn", { time: quota.resetsInText || "7 days" })}</span>
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
                {/* 1. Workspace & Execution Section */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    {t("settings.workspaceAndExecution")}
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-4">
                    {/* Default Project Location */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          {t("settings.defaultProjectLocation")}
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          {t("settings.defaultProjectLocationDesc")}
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
                            <span>{t("settings.browse")}</span>
                          </button>
                          {defaultProjectLocation && (
                            <button
                              type="button"
                              onClick={handleResetDefaultLocation}
                              className="px-2 py-1 text-[11px] font-medium rounded-md border border-transparent hover:border-[#dedee2] dark:hover:border-[#383838] hover:bg-[#ebebed] dark:hover:bg-[#2e2e2e] text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1 outline-none focus:outline-none"
                              title={t("settings.resetDefaultLocation")}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Agent Permissions */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            {t("settings.defaultPermission")}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                          {t("settings.defaultPermissionDesc")}
                        </span>
                      </div>

                      <div className="relative shrink-0" ref={presetDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsPresetDropdownOpen((prev) => !prev)}
                          className="px-3 py-1.5 rounded-lg bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] border border-[#dedee2] dark:border-[#383838] text-[12px] font-medium text-[#262626] dark:text-white flex items-center gap-2 transition-colors cursor-pointer outline-none focus:outline-none"
                        >
                          <span>
                            {defaultConfirmationMode === "full_access"
                              ? t("settings.fullMachine")
                              : defaultConfirmationMode === "request_review"
                              ? t("settings.requestReview")
                              : t("settings.askBeforeChanges")}
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
                                <span className="text-[12px]">{t("settings.askBeforeChangesDefault")}</span>
                                <span className="text-[10px] text-[#737373] dark:text-[#969696] font-normal">
                                  {t("settings.askBeforeChangesDesc")}
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
                                <span className="text-[12px]">{t("settings.fullMachine")}</span>
                                <span className="text-[10px] text-[#737373] dark:text-[#969696] font-normal">
                                  {t("settings.fullMachineDesc")}
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
                                <span className="text-[12px]">{t("settings.requestReview")}</span>
                                <span className="text-[10px] text-[#737373] dark:text-[#969696] font-normal">
                                  {t("settings.requestReviewDesc")}
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

                    {/* Message Queuing Behavior */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            {t("settings.queueMessageTitle")}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                          {t("settings.queueMessageDesc")}
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
                          title={t("settings.queueModeQueueTitle")}
                        >
                          <span>{t("settings.queueModeQueue")}</span>
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
                          title={t("settings.queueModeSteerTitle")}
                        >
                          <span>{t("settings.queueModeSteer")}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Preferences & System Section */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    {t("settings.preferencesAndSystem")}
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-4">
                    {/* Interface Language */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            {t("settings.interfaceLanguage")}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                          {t("settings.interfaceLanguageDesc")}
                        </span>
                      </div>

                      <div className="relative shrink-0" ref={languageDropdownRef}>
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

                    {/* Desktop Notifications */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Bell className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            {t("settings.taskNotifications")}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                          {t("settings.taskNotificationsDesc")}
                        </span>
                      </div>

                      <Switch
                        checked={taskNotifications}
                        onCheckedChange={handleToggleTaskNotifications}
                      />
                    </div>

                    {/* Completion Sound Effects */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            {t("settings.completionSounds")}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                          {t("settings.completionSoundsDesc")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => playTaskCompletionSound()}
                          className="px-2 py-1 text-[11px] rounded-md border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#737373] dark:text-[#d4d4d4] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1 outline-none focus:outline-none"
                          title={t("settings.previewChime")}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{t("settings.test")}</span>
                        </button>
                        <Switch
                          checked={soundAlerts}
                          onCheckedChange={handleToggleSoundAlerts}
                        />
                      </div>
                    </div>

                    {/* Automatic Updates */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            {t("settings.autoUpdates")}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                          {t("settings.autoUpdatesDesc")}
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
                          <span>{isCheckingUpdate ? t("settings.checkingUpdates") : t("settings.checkUpdates")}</span>
                        </button>
                        <Switch
                          checked={autoUpdates}
                          onCheckedChange={handleToggleAutoUpdates}
                        />
                      </div>
                    </div>

                    {/* Launch on Startup */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Laptop className="w-4 h-4 text-[#737373] dark:text-[#969696]" />
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            {t("settings.launchOnStartup")}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                          {t("settings.launchOnStartupDesc")}
                        </span>
                      </div>

                      <Switch
                        checked={launchOnStartup}
                        onCheckedChange={handleToggleLaunchOnStartup}
                      />
                    </div>

                    {/* Local Storage & System Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                            {t("settings.localStorageTitle")}
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/5 dark:bg-white/10 text-[#737373] dark:text-[#a3a3a3]">
                            v0.1.0-alpha
                          </span>
                        </div>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696]">
                          {t("settings.localStorageDesc")}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenDataFolder}
                        className="self-start sm:self-center px-2.5 py-1 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none shrink-0"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span>{t("settings.openFolder")}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "keyboard-shortcuts" ? (
              /* --------------------------------------------------------- */
              /* Keyboard Shortcuts Tab (Matching ZCode UI & Hotkeys)      */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-4 w-full pb-8 select-none">
                {/* Search Bar & Reset to defaults */}
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] dark:text-[#888888] pointer-events-none" />
                    <input
                      type="text"
                      value={shortcutsSearch}
                      onChange={(e) => setShortcutsSearch(e.target.value)}
                      placeholder={t("shortcuts.searchPlaceholder")}
                      className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] text-[#262626] dark:text-[#ececec] placeholder-[#888888] dark:placeholder-[#737373] outline-none focus:border-[#737373] dark:focus:border-[#525256] transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-[#737373] dark:text-[#6e6e72]">
                      <Keyboard className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      resetAll();
                      toast.success(t("shortcuts.resetSuccess"));
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-[#737373] dark:text-[#969696] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer shrink-0"
                    title={t("shortcuts.resetAllTooltip")}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t("shortcuts.resetAll")}</span>
                  </button>
                </div>

                {/* Shortcuts Table */}
                <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] overflow-hidden">
                  {/* Table Header */}
                  <div className="px-4 py-2.5 border-b border-[#dedee2] dark:border-[#383838] bg-[#f0f0f4] dark:bg-[#282828] grid grid-cols-12 text-xs font-medium text-[#737373] dark:text-[#a0a0a5] select-none">
                    <div className="col-span-5">{t("shortcuts.columnCommand")}</div>
                    <div className="col-span-4 pl-1">{t("shortcuts.columnKeybinding")}</div>
                    <div className="col-span-2 text-left">{t("shortcuts.columnScope")}</div>
                    <div className="col-span-1 text-right pr-1">{t("shortcuts.columnActions")}</div>
                  </div>

                  {/* Table Body */}
                  {filteredShortcuts.length > 0 ? (
                    <div className="divide-y divide-[#dedee2] dark:divide-[#333333]">
                      {filteredShortcuts.map((item) => {
                        const cmdName = getCommandName(item);
                        return (
                          <div
                            key={item.id}
                            className="px-4 py-2.5 grid grid-cols-12 items-center text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group"
                          >
                            {/* Command */}
                            <div className="col-span-5 text-[#262626] dark:text-[#ececec] font-normal text-xs sm:text-[13px] pr-2">
                              {cmdName}
                            </div>

                            {/* Keybinding */}
                            <div className="col-span-4 pl-1 flex flex-col gap-1.5">
                              {item.keybindings.length > 0 ? (
                                item.keybindings.map((combo, comboIdx) => (
                                  <div key={comboIdx} className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      {combo.map((k, kIdx) => (
                                        <kbd
                                          key={kIdx}
                                          className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-white dark:bg-[#2c2c2e] border border-[#dedee2] dark:border-[#3c3c40] text-[#262626] dark:text-[#f0f0f0] shadow-xs"
                                        >
                                          {isMac && k === "Ctrl" ? "⌘" : k}
                                        </kbd>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRecordingTarget({
                                          id: item.id,
                                          comboIndex: comboIdx,
                                          command: item.command,
                                          keys: [...combo],
                                        })
                                      }
                                      className="p-1 rounded text-[#737373] dark:text-[#888888] hover:text-[#262626] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                                      title={t("shortcuts.editTooltip", { command: cmdName })}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRecordingTarget({
                                      id: item.id,
                                      comboIndex: 0,
                                      command: item.command,
                                      keys: [],
                                    })
                                  }
                                  className="text-xs text-[#888888] hover:text-[#555] dark:hover:text-[#aaa] italic text-left cursor-pointer"
                                >
                                  {t("shortcuts.recordShortcut")}
                                </button>
                              )}
                            </div>

                            {/* Scope */}
                            <div className="col-span-2 text-[#737373] dark:text-[#8e8e93] text-xs">
                              {getScopeName(item.scope)}
                            </div>

                            {/* Actions */}
                            <div className="col-span-1 flex justify-end pr-1">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteShortcut(item.id);
                                  toast.info(t("shortcuts.clearedToast", { command: cmdName }));
                                }}
                                className="p-1.5 rounded-lg text-[#737373] dark:text-[#888888] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                                title={t("shortcuts.clearTooltip", { command: cmdName })}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <Keyboard className="w-8 h-8 text-[#a3a3a3] dark:text-[#555555] mb-2" />
                      <p className="text-xs text-[#737373] dark:text-[#969696]">
                        {t("shortcuts.noMatches", { query: shortcutsSearch })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === "appearance" ? (
              /* --------------------------------------------------------- */
              /* Appearance Settings Tab                                   */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl pb-6">
                {/* Theme & Layout Card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    {t("settings.themeAndLayout")}
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-4">
                    {/* 1. App Theme */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          {t("settings.appTheme")}
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          {t("settings.appThemeDesc")}
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
                          title={t("settings.themeSystemTitle")}
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          <span>{t("settings.themeSystem")}</span>
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
                          title={t("settings.themeLightTitle")}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>{t("settings.themeLight")}</span>
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
                          title={t("settings.themeDarkTitle")}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>{t("settings.themeDark")}</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. Conversation Width */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          {t("settings.conversationWidth")}
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          {t("settings.conversationWidthDesc")}
                        </span>
                      </div>

                      {/* Segmented Control */}
                      <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5 shrink-0">
                        {(["default", "narrow", "wide"] as const).map((w) => {
                          const isSelected = conversationWidth === w;
                          const label = w === "default" ? t("settings.widthDefault") : w === "narrow" ? t("settings.widthNarrow") : t("settings.widthWide");
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
                  </div>
                </div>

                {/* Typography & Rendering Card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    {t("settings.typographyAndCode")}
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-4">
                    {/* 3. UI Font Size */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          {t("settings.uiFontSize")}
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          {t("settings.uiFontSizeDesc")}
                        </span>
                      </div>

                      {/* Stepper Control: [-] [16px] [+] and Reset */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={uiFontSize <= MIN_UI_FONT_SIZE}
                            onClick={() => setUiFontSize(Math.max(MIN_UI_FONT_SIZE, uiFontSize - 1))}
                            className={cn(
                              "p-1.5 rounded-md transition-all flex items-center justify-center outline-none focus:outline-none",
                              uiFontSize <= MIN_UI_FONT_SIZE
                                ? "opacity-30 cursor-not-allowed text-[#a9a9a9] dark:text-[#666666]"
                                : "cursor-pointer text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ffffff] dark:hover:bg-[#383838] shadow-2xs"
                            )}
                            title={`Decrease UI font size (${Math.max(MIN_UI_FONT_SIZE, uiFontSize - 1)}px)`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <span className="min-w-[44px] text-center text-[12px] font-medium font-sans tabular-nums text-[#262626] dark:text-white select-none px-1">
                            {uiFontSize}px
                          </span>

                          <button
                            type="button"
                            disabled={uiFontSize >= MAX_UI_FONT_SIZE}
                            onClick={() => setUiFontSize(Math.min(MAX_UI_FONT_SIZE, uiFontSize + 1))}
                            className={cn(
                              "p-1.5 rounded-md transition-all flex items-center justify-center outline-none focus:outline-none",
                              uiFontSize >= MAX_UI_FONT_SIZE
                                ? "opacity-30 cursor-not-allowed text-[#a9a9a9] dark:text-[#666666]"
                                : "cursor-pointer text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ffffff] dark:hover:bg-[#383838] shadow-2xs"
                            )}
                            title={`Increase UI font size (${Math.min(MAX_UI_FONT_SIZE, uiFontSize + 1)}px)`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {uiFontSize !== DEFAULT_UI_FONT_SIZE && (
                          <button
                            type="button"
                            onClick={() => setUiFontSize(DEFAULT_UI_FONT_SIZE)}
                            className="px-2 py-1 text-[11px] font-medium rounded-lg text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ebebed] dark:hover:bg-[#2e2e2e] transition-colors cursor-pointer flex items-center gap-1 border border-transparent hover:border-[#dedee2] dark:hover:border-[#383838]"
                            title="Reset UI font size to default (16px)"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4. Code Font Size */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          {t("settings.codeFontSize")}
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          {t("settings.codeFontSizeDesc")}
                        </span>
                      </div>

                      {/* Stepper Control: [-] [12px] [+] and Reset */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={codeFontSize <= MIN_CODE_FONT_SIZE}
                            onClick={() => setCodeFontSize(Math.max(MIN_CODE_FONT_SIZE, codeFontSize - 1))}
                            className={cn(
                              "p-1.5 rounded-md transition-all flex items-center justify-center outline-none focus:outline-none",
                              codeFontSize <= MIN_CODE_FONT_SIZE
                                ? "opacity-30 cursor-not-allowed text-[#a9a9a9] dark:text-[#666666]"
                                : "cursor-pointer text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ffffff] dark:hover:bg-[#383838] shadow-2xs"
                            )}
                            title={`Decrease code font size (${Math.max(MIN_CODE_FONT_SIZE, codeFontSize - 1)}px)`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <span className="min-w-[44px] text-center text-[12px] font-medium font-sans tabular-nums text-[#262626] dark:text-white select-none px-1">
                            {codeFontSize}px
                          </span>

                          <button
                            type="button"
                            disabled={codeFontSize >= MAX_CODE_FONT_SIZE}
                            onClick={() => setCodeFontSize(Math.min(MAX_CODE_FONT_SIZE, codeFontSize + 1))}
                            className={cn(
                              "p-1.5 rounded-md transition-all flex items-center justify-center outline-none focus:outline-none",
                              codeFontSize >= MAX_CODE_FONT_SIZE
                                ? "opacity-30 cursor-not-allowed text-[#a9a9a9] dark:text-[#666666]"
                                : "cursor-pointer text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ffffff] dark:hover:bg-[#383838] shadow-2xs"
                            )}
                            title={`Increase code font size (${Math.min(MAX_CODE_FONT_SIZE, codeFontSize + 1)}px)`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {codeFontSize !== DEFAULT_CODE_FONT_SIZE && (
                          <button
                            type="button"
                            onClick={() => setCodeFontSize(DEFAULT_CODE_FONT_SIZE)}
                            className="px-2 py-1 text-[11px] font-medium rounded-lg text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ebebed] dark:hover:bg-[#2e2e2e] transition-colors cursor-pointer flex items-center gap-1 border border-transparent hover:border-[#dedee2] dark:hover:border-[#383838]"
                            title="Reset code font size to default (12px)"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 5. Diff marks (matching user Image 1) */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          {t("settings.diffMarksTitle")}
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          {t("settings.diffMarksDesc")}
                        </span>
                      </div>

                      {/* Segmented Control matching user Image 1: Color | +/- */}
                      <div className="inline-flex p-0.5 rounded-lg bg-[#ebebed] dark:bg-[#1b1b1b] border border-[#dedee2] dark:border-[#383838] items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDiffMarks("color")}
                          className={cn(
                            "px-3 py-1 text-[11px] rounded-md transition-all cursor-pointer font-medium outline-none focus:outline-none",
                            diffMarks === "color"
                              ? "bg-[#ffffff] dark:bg-[#e6e6e6] text-[#111111] dark:text-black shadow-2xs"
                              : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                          )}
                          title={t("settings.diffMarksColorTitle")}
                        >
                          {t("settings.diffMarksColor")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffMarks("symbols")}
                          className={cn(
                            "px-3 py-1 text-[11px] rounded-md transition-all cursor-pointer font-medium outline-none focus:outline-none",
                            diffMarks === "symbols"
                              ? "bg-[#ffffff] dark:bg-[#e6e6e6] text-[#111111] dark:text-black shadow-2xs"
                              : "text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                          )}
                          title={t("settings.diffMarksSymbolsTitle")}
                        >
                          {t("settings.diffMarksSymbols")}
                        </button>
                      </div>
                    </div>

                    {/* 6. Interface Scale / Zoom */}
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-[#dedee2] dark:border-[#383838]">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          {t("settings.windowScale")}
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          {t("settings.windowScaleDesc", { min: MIN_ZOOM, max: MAX_ZOOM })}
                        </span>
                      </div>

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
                            title={`Decrease window zoom (${Math.max(MIN_ZOOM, zoom - ZOOM_STEP)}%)`}
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
                            title={`Increase window zoom (${Math.min(MAX_ZOOM, zoom + ZOOM_STEP)}%)`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {zoom !== DEFAULT_ZOOM && (
                          <button
                            type="button"
                            onClick={() => setZoom(DEFAULT_ZOOM)}
                            className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#ebebed] dark:hover:bg-[#2e2e2e] transition-colors cursor-pointer flex items-center gap-1.5 border border-transparent hover:border-[#dedee2] dark:hover:border-[#383838]"
                            title="Reset window zoom to default (100%)"
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
              /* Usage Stats Tab (matching user Image 1 & Image 2)          */
              /* --------------------------------------------------------- */
              <UsageStatsView
                quota={quota}
                activeModel={activeModel}
                user={user}
              />
            ) : activeTab === "personalization" ? (
              /* --------------------------------------------------------- */
              /* Personalization Tab (matching user Image 2 & Image 3)    */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl pb-6">
                {/* 1. What best describes your work? (Image 2 & 3) */}
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                      {t("settings.whatBestDescribesWork")}
                    </span>

                    <div className="relative shrink-0 w-full sm:w-64" ref={roleDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsRoleDropdownOpen((prev) => !prev)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#1b1b1b] hover:bg-[#f9f9fb] dark:hover:bg-[#262626] text-[#262626] dark:text-white flex items-center justify-between gap-2 transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-primary"
                      >
                        <span className="truncate">
                          {WORK_ROLE_OPTIONS.find((r) => r.id === workRole)?.label || t("settings.selectWorkRole")}
                        </span>
                        <ChevronDown className={cn("w-3.5 h-3.5 text-[#737373] dark:text-[#969696] shrink-0 transition-transform duration-150", isRoleDropdownOpen && "rotate-180")} />
                      </button>

                      {isRoleDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-full min-w-[240px] max-h-60 overflow-y-auto bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl shadow-xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                          {WORK_ROLE_OPTIONS.map((opt) => {
                            const isSelected = workRole === opt.id;
                            return (
                              <button
                                key={opt.id || "empty"}
                                type="button"
                                onClick={() => {
                                  setWorkRole(opt.id);
                                  setIsRoleDropdownOpen(false);
                                }}
                                className={cn(
                                  "w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer outline-none focus:outline-none",
                                  isSelected
                                    ? "bg-black/5 dark:bg-white/10 text-[#262626] dark:text-white font-medium"
                                    : "hover:bg-black/5 dark:hover:bg-white/5 text-[#555555] dark:text-[#d4d4d4]"
                                )}
                              >
                                <span className="truncate">{opt.label}</span>
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

                {/* 2. Custom Instructions (Image 3) */}
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                        {t("settings.customInstructions")}
                      </span>
                      <p className="text-xs text-[#737373] dark:text-[#969696] leading-relaxed">
                        {t("settings.customInstructionsDesc")}
                        <button
                          type="button"
                          onClick={() => toast.info(t("settings.instructionsAppliedToast"))}
                          className="ml-1 text-[#3b82f6] hover:underline cursor-pointer inline-block"
                        >
                          {t("settings.learnMore")}
                        </button>
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <textarea
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder={t("settings.customInstructionsPlaceholder")}
                        rows={7}
                        className="w-full p-3.5 text-xs font-mono leading-relaxed rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#171717] text-[#262626] dark:text-[#d4d4d4] placeholder:text-[#a3a3a3] dark:placeholder:text-[#666666] focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[160px] transition-colors"
                      />

                      {/* Save Button matching Image 3 */}
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          disabled={isSavingPersonalization}
                          onClick={handleSavePersonalization}
                          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#262626] hover:bg-[#111111] dark:bg-[#ffffff] dark:hover:bg-[#ebebed] text-white dark:text-black transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          {isSavingPersonalization ? t("settings.saving") : t("settings.save")}
                        </button>
                      </div>
                    </div>
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
            ) : activeTab === "marketplace" || activeTab === "skills" || activeTab === "plugins" ? (
              /* --------------------------------------------------------- */
              /* Marketplace Settings View (Skills & Plugins)              */
              /* --------------------------------------------------------- */
              <div className="pb-10">
                <SkillsSettings isModal={true} initialTab={activeTab === "plugins" ? "plugins" : "skills"} />
              </div>
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
                          {t("settings.capabilityUpcoming")}
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

      {/* Keybinding Recording Modal */}
      {recordingTarget && (() => {
        const targetItem = shortcuts.find((s) => s.id === recordingTarget.id);
        const cmdName = targetItem ? getCommandName(targetItem) : recordingTarget.command;
        return (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={() => setRecordingTarget(null)}
          >
            <div
              className="w-[420px] max-w-[95vw] bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-[#262626] dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{t("shortcuts.changeKeybinding")}</h3>
                  <p className="text-xs text-[#737373] dark:text-[#969696] mt-0.5">
                    {cmdName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecordingTarget(null)}
                  className="p-1 rounded-lg text-[#737373] hover:text-[#262626] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="min-h-[76px] rounded-xl border border-dashed border-[#737373]/40 dark:border-[#555555]/50 bg-black/5 dark:bg-white/5 flex items-center justify-center p-3 select-none">
                {recordingTarget.keys.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    {recordingTarget.keys.map((k, idx) => (
                      <kbd
                        key={idx}
                        className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-white dark:bg-[#2c2c2e] border border-[#dedee2] dark:border-[#3c3c40] text-[#262626] dark:text-white shadow-xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[#737373] dark:text-[#969696] animate-pulse">
                    {t("shortcuts.pressKeysPrompt")}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[#737373] dark:text-[#888888]">
                {t("shortcuts.pressKeysHint")}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#dedee2] dark:border-[#383838]">
                <button
                  type="button"
                  onClick={() => setRecordingTarget(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#737373] dark:text-[#969696] hover:text-[#111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {t("common.cancel") || "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const item = shortcuts.find((s) => s.id === recordingTarget.id);
                    if (item) {
                      const nextCombos = [...item.keybindings];
                      if (recordingTarget.keys.length > 0) {
                        nextCombos[recordingTarget.comboIndex] = recordingTarget.keys;
                      }
                      updateShortcut(recordingTarget.id, nextCombos);
                      toast.success(t("shortcuts.updatedToast", { command: cmdName }));
                    }
                    setRecordingTarget(null);
                  }}
                  disabled={recordingTarget.keys.length === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#171717] dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
                >
                  {t("shortcuts.saveKeybinding")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
