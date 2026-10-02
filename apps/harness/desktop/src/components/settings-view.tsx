import React, { useState, useEffect, useMemo } from "react";
import {
  ConstLogoIcon,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Input,
  Label,
  ScrollArea,
  toast,
  cn,
} from "@const/ui";
import {
  ArrowLeft,
  SlidersHorizontal,
  Palette,
  Cpu,
  Globe,
  Monitor,
  Brain,
  Bot,
  Puzzle,
  Server,
  Sparkles,
  Terminal,
  Anchor,
  Database,
  BarChart3,
  Rocket,
  Settings,
  RotateCw,
  Folder,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Info,
  ShieldCheck,
  Minus,
  Square,
  Copy,
  X,
  Sun,
  Moon,
  Hand,
  ShieldAlert,
  LogOut,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import type { UserProfile } from "./sidebar";
import { getUserInitials } from "./sidebar";
import type { ConversationItem } from "../lib/conversation-store";
import type { UserConfig } from "../vite-env";
import { useTheme, useConversationWidth, type Theme, type ConversationWidth } from "../lib/theme";

export interface SettingsViewProps {
  open?: boolean;
  onClose?: () => void;
  onBackToWorkspace?: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  initialTab?: string;
  conversations?: ConversationItem[];
}

export const CONST_ROUTER_DEFAULT_URL = "https://router.const.web.id/v1";

export const BUILTIN_CONST_MODELS = [
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high"],
    isDefault: true,
    desc: "Frontier multimodal reasoning & code generation. Included in your 7M weekly tokens quota.",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high"],
    desc: "Hybrid frontier reasoning model with dynamic thinking effort. Included in your 7M weekly tokens quota.",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
    desc: "Advanced frontier thinking with extended reasoning depth (up to max). Included in your 7M weekly tokens quota.",
  },
  {
    id: "combo/auto",
    name: "combo/auto",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    thinkingLevels: ["low", "medium", "high"],
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
    thinkingLevels: ["low", "medium", "high"],
    desc: "Specialized models tuned for software architecture, code generation, refactoring, and logical reasoning.",
  },
];

function formatTokenDisplay(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

function generateAsciiBar(
  percentRemaining: number,
  totalLength = 24
): { bar: string; colorClass: string } {
  const clamped = Math.max(0, Math.min(100, percentRemaining));
  let filled = Math.round((clamped / 100) * totalLength);
  if (clamped > 0 && filled === 0) filled = 1;
  if (clamped < 100 && filled === totalLength) filled = totalLength - 1;
  const unfilled = Math.max(0, totalLength - filled);
  const bar = `${"█".repeat(filled)}${"░".repeat(unfilled)}`;

  let colorClass = "text-[#d4d4d4]";
  if (clamped <= 10) {
    colorClass = "text-rose-500";
  } else if (clamped <= 30) {
    colorClass = "text-amber-400";
  }

  return { bar, colorClass };
}

export function SettingsView({
  open,
  onClose,
  onBackToWorkspace,
  user,
  onSignOut,
  onSwitchAccount,
  initialTab = "general",
  conversations,
}: SettingsViewProps) {
  const handleClose = () => {
    if (onClose) onClose();
    else if (onBackToWorkspace) onBackToWorkspace();
  };

  useEffect(() => {
    if (open === false) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onBackToWorkspace]);

  // Normalize legacy tab names
  const normalizedInitialTab = useMemo(() => {
    if (initialTab === "model" || initialTab === "models") return "model-settings";
    return initialTab || "general";
  }, [initialTab]);

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>(normalizedInitialTab);

  // Sync activeTab when initialTab prop changes
  useEffect(() => {
    setActiveTab(normalizedInitialTab);
  }, [normalizedInitialTab]);

  // Antigravity Queued Messages state
  const [queuedMessageMode, setQueuedMessageMode] = useState<"queue" | "send_immediately">(() => {
    return (
      (localStorage.getItem("const_harness_queued_messages") as
        | "queue"
        | "send_immediately") || "queue"
    );
  });

  // Antigravity Plan Review Policy state
  const [planReviewPolicy, setPlanReviewPolicy] = useState<"always_proceed" | "ask_review">(() => {
    return (
      (localStorage.getItem("const_harness_plan_review_policy") as
        | "always_proceed"
        | "ask_review") || "always_proceed"
    );
  });
  const [isPlanReviewDropdownOpen, setIsPlanReviewDropdownOpen] = useState(false);
  const planReviewDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlanReviewDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (planReviewDropdownRef.current && !planReviewDropdownRef.current.contains(e.target as Node)) {
        setIsPlanReviewDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPlanReviewDropdownOpen]);

  // Project list from conversations matching Antigravity screenshot
  const projectList = useMemo(() => {
    if (!conversations || conversations.length === 0) {
      return ["const4", "Const", "constharness2"];
    }
    const set = new Set<string>();
    for (const c of conversations) {
      if (c.project && c.project !== "Outside Project") {
        set.add(c.project);
      }
    }
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ["const4", "Const", "constharness2"];
  }, [conversations]);

  // Appearance & Theme settings
  const [theme, setTheme] = useTheme();
  const [conversationWidth, setConversationWidth] = useConversationWidth();

  // Model settings sub-selection: "const" or custom provider ID or "add-provider"
  const [selectedProviderId, setSelectedProviderId] = useState<string>("const");

  // Electron window controls state
  const [isMaximized, setIsMaximized] = useState(false);

  // Local configuration
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [activeModel, setActiveModel] = useState<string>(() => {
    return localStorage.getItem("const_harness_active_model") || "gemini-3.6-flash";
  });

  const [defaultConfirmationMode, setDefaultConfirmationMode] = useState<
    "ask_before_changes" | "full_access"
  >(() => {
    return (
      (localStorage.getItem("const_harness_default_mode") as
        | "ask_before_changes"
        | "full_access") || "ask_before_changes"
    );
  });

  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const presetDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPresetDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setIsPresetDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPresetDropdownOpen]);

  const handleSetDefaultMode = (mode: "ask_before_changes" | "full_access") => {
    setDefaultConfirmationMode(mode);
    localStorage.setItem("const_harness_default_mode", mode);
    window.dispatchEvent(new CustomEvent("const:default-mode-changed", { detail: mode }));
    toast.success(
      `Security preset set to ${mode === "full_access" ? "Full Machine" : "Ask Before Changes"}`
    );
  };

  const [customProviders, setCustomProviders] = useState<
    Array<{
      id: string;
      name: string;
      baseUrl: string;
      apiKey: string;
      format: string;
      models: Array<{ id: string; name: string }>;
    }>
  >([]);

  // Add Provider form state
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState("");
  const [newProviderApiKey, setNewProviderApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [newProviderFormat, setNewProviderFormat] = useState<string>(
    "Anthropic: messages (/v1/messages)"
  );
  const [newProviderModels, setNewProviderModels] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Add Model dialog state
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [tempModelId, setTempModelId] = useState("");
  const [tempModelName, setTempModelName] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  // Real-time reactive query for 7M Token Quota from Convex
  const quota = useQuery(api.router.quotas.getUserQuota, {});

  // Compute remaining token percentage
  const percentRemaining = useMemo(() => {
    if (!quota) return 100;
    const limit = quota.weeklyLimitTokens || 7_000_000;
    return Math.max(0, Math.min(100, (quota.remainingTokens / limit) * 100));
  }, [quota]);

  const { bar: asciiBar, colorClass: barColorClass } = useMemo(() => {
    return generateAsciiBar(percentRemaining, 24);
  }, [percentRemaining]);

  // Window maximized tracking
  useEffect(() => {
    window.electron?.isMaximized?.().then((max) => setIsMaximized(Boolean(max)));
    const cleanup = window.electron?.onMaximizedChange?.((max) => {
      setIsMaximized(max);
    });
    return () => cleanup?.();
  }, []);

  // Load config on mount or refresh
  useEffect(() => {
    if (window.electron?.getConfig) {
      window.electron.getConfig().then((cfg) => {
        setConfig(cfg);
        if (cfg?.activeModel) {
          setActiveModel(cfg.activeModel);
        }
        try {
          const stored = localStorage.getItem("const_harness_custom_providers");
          if (stored) {
            setCustomProviders(JSON.parse(stored));
          }
        } catch {}
      });
    }
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    toast.success("Settings & models refreshed");
  };

  const handleSelectActiveModel = (modelId: string) => {
    setActiveModel(modelId);
    localStorage.setItem("const_harness_active_model", modelId);
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ activeModel: modelId }).catch(() => {});
    }
    toast.success(`Active model set to ${modelId}`);
  };

  const handleAddModelToNewProvider = () => {
    if (!tempModelId.trim()) {
      toast.error("Model ID cannot be empty");
      return;
    }
    const nameToUse = tempModelName.trim() || tempModelId.trim();
    setNewProviderModels((prev) => [
      ...prev,
      { id: tempModelId.trim(), name: nameToUse },
    ]);
    setTempModelId("");
    setTempModelName("");
    setIsAddingModel(false);
  };

  const handleRemoveModelFromNewProvider = (index: number) => {
    setNewProviderModels((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveNewProvider = async () => {
    if (!newProviderName.trim()) {
      toast.error("Provider Name is required");
      return;
    }
    if (!newProviderBaseUrl.trim()) {
      toast.error("Base URL is required");
      return;
    }
    if (newProviderModels.length === 0) {
      toast.error("Add at least one model before adding the provider");
      return;
    }

    const providerId = `custom_${Date.now()}`;
    const newProvider = {
      id: providerId,
      name: newProviderName.trim(),
      baseUrl: newProviderBaseUrl.trim(),
      apiKey: newProviderApiKey.trim(),
      format: newProviderFormat,
      models: newProviderModels,
    };

    const updated = [...customProviders, newProvider];
    setCustomProviders(updated);
    localStorage.setItem(
      "const_harness_custom_providers",
      JSON.stringify(updated)
    );

    // Also persist to electron ~/.const/config.json
    if (window.electron?.saveConfig && config) {
      const mergedProviders = {
        ...config.providers,
        [providerId]: {
          name: newProvider.name,
          baseUrl: newProvider.baseUrl,
          apiKey: newProvider.apiKey,
        },
      };
      const mergedModels = [
        ...(config.customModels || []),
        ...newProvider.models.map((m) => ({
          id: m.id,
          displayName: m.name,
          provider: providerId,
          baseUrl: newProvider.baseUrl,
          supportsThinking: true,
          supportsTools: true,
        })),
      ];

      try {
        await window.electron.saveConfig({
          providers: mergedProviders,
          customModels: mergedModels,
        });
      } catch {}
    }

    toast.success(`Provider "${newProvider.name}" added successfully`);
    setNewProviderName("");
    setNewProviderBaseUrl("");
    setNewProviderApiKey("");
    setNewProviderModels([]);
    setSelectedProviderId(providerId);
  };

  const handleDeleteCustomProvider = async (id: string) => {
    const updated = customProviders.filter((p) => p.id !== id);
    setCustomProviders(updated);
    localStorage.setItem(
      "const_harness_custom_providers",
      JSON.stringify(updated)
    );

    if (window.electron?.saveConfig && config) {
      const remainingProviders = { ...config.providers };
      delete remainingProviders[id];
      const remainingModels = (config.customModels || []).filter(
        (m) => m.provider !== id
      );
      try {
        await window.electron.saveConfig({
          providers: remainingProviders,
          customModels: remainingModels,
        });
      } catch {}
    }

    toast.success("Custom provider removed");
    if (selectedProviderId === id) {
      setSelectedProviderId("const");
    }
  };

  // Nav categories matching reference screenshot
  const navCategories = [
    {
      label: "Basics",
      items: [
        { id: "general", label: "General", icon: SlidersHorizontal },
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "model-settings", label: "Model settings", icon: Cpu },
        { id: "browser-use", label: "Browser Use", icon: Globe },
        { id: "computer-use", label: "Computer Use", icon: Monitor },
      ],
    },
    {
      label: "Agent capabilities",
      items: [
        { id: "memory", label: "Memory", icon: Brain },
        { id: "subagents", label: "Subagents", icon: Bot },
        { id: "plugins", label: "Plugins", icon: Puzzle },
        { id: "mcp-servers", label: "MCP Servers", icon: Server },
        { id: "skills", label: "Skills", icon: Sparkles },
        { id: "commands", label: "Commands", icon: Terminal },
        { id: "hooks", label: "Hooks", icon: Anchor },
      ],
    },
    {
      label: "Data and statistics",
      items: [
        { id: "indexing", label: "Indexing", icon: Database },
        { id: "usage-stats", label: "Usage stats", icon: BarChart3 },
      ],
    },
  ];

  const initials = getUserInitials(user?.name, user?.email);

  if (open !== undefined && !open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="w-[980px] max-w-[95vw] h-[670px] max-h-[88vh] bg-[#161616] border border-[#383838] rounded-2xl flex overflow-hidden text-[#d4d4d4] font-sans outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 shadow-[0_24px_70px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-[0.985] duration-150"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* ----------------------------------------------------------- */}
        {/* Left Sidebar inside Modal (Antigravity Style)               */}
        {/* ----------------------------------------------------------- */}
        <aside className="w-[220px] sm:w-[240px] h-full flex flex-col justify-between shrink-0 bg-[#222222] border-r border-[#383838] p-3 select-none">
          <ScrollArea className="flex-1 min-h-0 w-full pr-1">
            <div className="flex flex-col gap-4 pt-1">
              {/* Settings Section */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[#969696] px-2 tracking-tight">
                  Settings
                </span>
                <div className="flex flex-col gap-0.5">
                  {[
                    { id: "general", label: "General" },
                    { id: "application", label: "Application" },
                    { id: "appearance", label: "Appearance" },
                    { id: "model-settings", label: "Models" },
                    { id: "customizations", label: "Customizations" },
                  ].map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                          "w-full flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                          isActive
                            ? "bg-[#383838] text-white"
                            : "text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b]"
                        )}
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Projects Section */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[#969696] px-2 tracking-tight">
                  Projects
                </span>
                <div className="flex flex-col gap-0.5">
                  {projectList.slice(0, 3).map((p) => {
                    const isActive = activeTab === `project:${p}`;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setActiveTab(`project:${p}`)}
                        className={cn(
                          "w-full flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                          isActive
                            ? "bg-[#383838] text-white"
                            : "text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b]"
                        )}
                      >
                        <span className="truncate">{p}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setActiveTab("projects-all")}
                    className={cn(
                      "w-full flex items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left",
                      activeTab === "projects-all"
                        ? "bg-[#383838] text-white font-medium"
                        : "text-[#969696] hover:text-white hover:bg-[#2b2b2b]"
                    )}
                  >
                    <span className="truncate">Show All</span>
                  </button>
                </div>
              </div>

              {/* Not in Project Section */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[#969696] px-2 tracking-tight">
                  Not in Project
                </span>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("conversations")}
                    className={cn(
                      "w-full flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                      activeTab === "conversations"
                        ? "bg-[#383838] text-white"
                        : "text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b]"
                    )}
                  >
                    <span className="truncate">Conversations</span>
                  </button>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Bottom Section: Shortcuts, Provide Feedback, and User Profile (Zero divider lines) */}
          <div className="flex flex-col gap-1 pt-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("shortcuts")}
              className={cn(
                "w-full flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left",
                activeTab === "shortcuts"
                  ? "bg-[#383838] text-white"
                  : "text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b]"
              )}
            >
              <span>Shortcuts</span>
            </button>
            <button
              type="button"
              onClick={() => {
                toast.info("Feedback dialog opened. Thanks for helping us improve!");
              }}
              className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#969696] hover:text-white hover:bg-[#2b2b2b] transition-colors cursor-pointer text-left"
            >
              <span>Provide Feedback</span>
            </button>

            {/* User Profile Bar */}
            <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-[#2b2b2b] transition-colors mt-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-7 w-7 rounded-full bg-[#383838] text-white border border-[#383838] shrink-0">
                  {user?.image ? (
                    <AvatarImage src={user.image} alt={user?.name || "User"} className="object-cover" />
                  ) : (
                    <AvatarFallback className="text-[11px] font-semibold text-white bg-[#383838]">
                      {initials || "A"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">
                    {user?.name || "Alif Farhanul Hakim"}
                  </p>
                  <p className="text-[10px] text-[#969696] truncate">
                    {user?.email || "nepatasfc@gmail.com"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ----------------------------------------------------------- */}
        {/* Right Main Content Area                                     */}
        {/* ----------------------------------------------------------- */}
        <main className="flex-1 h-full flex flex-col min-w-0 bg-[#161616] overflow-hidden">
          {/* Header Row: Title, Subtitle, and Top-Right Close Button 'X' (zero divider lines) */}
          <div className="flex-none px-6 sm:px-8 pt-5 pb-2 flex items-start justify-between gap-4 select-none">
            <div>
              <h1 className="text-xl font-medium tracking-tight text-white capitalize">
                {activeTab === "model-settings"
                  ? "Models"
                  : activeTab.startsWith("project:")
                  ? `Project: ${activeTab.replace("project:", "")}`
                  : activeTab.replace(/-/g, " ")}
              </h1>
              <p className="mt-1 text-xs text-[#969696]">
                {activeTab === "general"
                  ? "Configure agent execution, queued message delivery, and permissions."
                  : activeTab === "application"
                  ? "Manage application behavior, workbench settings, and environment runtime."
                  : activeTab === "appearance"
                  ? "Configure theme mode and conversation workbench layout."
                  : activeTab === "model-settings"
                  ? "Manage custom model providers. Once configured, they can be selected during chat."
                  : activeTab === "customizations"
                  ? "Configure agent capabilities, subagents, MCP servers, and custom tools."
                  : activeTab === "shortcuts"
                  ? "Quick reference for workbench and agent keyboard shortcuts."
                  : activeTab === "conversations" || activeTab === "projects-all"
                  ? "Review workspace projects, active sessions, and conversational tasks."
                  : "Manage your workbench preferences and configurations."}
              </p>
            </div>

            {/* Top Right Close button X */}
            <button
              type="button"
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#969696] hover:text-white hover:bg-[#2b2b2b] transition-colors cursor-pointer shrink-0"
              title="Close Settings (Esc)"
              aria-label="Close Settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dynamic Section Content via Radix ScrollArea */}
          <ScrollArea className="flex-1 min-h-0 w-full" viewportClassName="px-6 sm:px-8 py-4">
            {activeTab === "general" ? (
              /* ----------------------------------------------------------- */
              /* General Settings Tab (Antigravity Style)                    */
              /* ----------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl">
                {/* 1. Execution */}
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Execution</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-white">Queued Messages</span>
                      <span className="text-xs text-[#969696]">Configure when follow-up messages are sent.</span>
                      <span className="text-[11px] text-[#5d5d5d] flex items-center gap-1 mt-0.5">
                        Keyboard shortcuts <Info className="w-3 h-3 cursor-help text-[#5d5d5d]" />
                      </span>
                    </div>
                    <div className="inline-flex p-1 rounded-lg bg-[#161616] border border-[#383838] items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setQueuedMessageMode("queue");
                          localStorage.setItem("const_harness_queued_messages", "queue");
                        }}
                        className={cn(
                          "px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer",
                          queuedMessageMode === "queue"
                            ? "bg-[#383838] text-white"
                            : "text-[#969696] hover:text-white"
                        )}
                      >
                        Queue
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQueuedMessageMode("send_immediately");
                          localStorage.setItem("const_harness_queued_messages", "send_immediately");
                        }}
                        className={cn(
                          "px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer",
                          queuedMessageMode === "send_immediately"
                            ? "bg-[#383838] text-white"
                            : "text-[#969696] hover:text-white"
                        )}
                      >
                        Send Immediately
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Global Permissions */}
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Global Permissions</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-2 flex flex-col gap-1.5">
                    {/* Security Preset */}
                    <div className="p-3.5 rounded-lg bg-[#2b2b2b] flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-white">Security Preset</span>
                        <span className="text-xs text-[#969696]">Controls the actions the agent can take.</span>
                        <span className="text-[11px] text-[#5d5d5d] flex items-center gap-1 mt-0.5">
                          Learn more about{" "}
                          <strong className="font-medium text-[#d4d4d4]">
                            {defaultConfirmationMode === "full_access" ? "Full machine" : "Ask before changes"}
                          </strong>
                          <Info className="w-3 h-3 cursor-help text-[#5d5d5d]" />
                        </span>
                      </div>

                      {/* Dropdown Selector */}
                      <div className="relative" ref={presetDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsPresetDropdownOpen((prev) => !prev)}
                          className="px-3 py-1.5 rounded-lg bg-[#1b1b1b] hover:bg-[#252528] border border-[#2e2e2e] text-xs font-medium text-white flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <span>
                            {defaultConfirmationMode === "full_access" ? "Full Machine" : "Ask Before Changes"}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 text-[#969696]" />
                        </button>

                        {isPresetDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#222222] border border-[#383838] rounded-xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in duration-100 shadow-none">
                            <button
                              type="button"
                              onClick={() => {
                                handleSetDefaultMode("ask_before_changes");
                                setIsPresetDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full px-2.5 py-2 rounded-lg text-left flex items-start justify-between gap-2 transition-colors cursor-pointer",
                                defaultConfirmationMode === "ask_before_changes"
                                  ? "bg-[#383838] text-white font-medium"
                                  : "hover:bg-[#2b2b2b] text-[#d4d4d4] hover:text-white"
                              )}
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">Ask Before Changes</span>
                                <span className="text-[10px] text-[#969696] font-normal">
                                  Ask before file changes & command execution.
                                </span>
                              </div>
                              {defaultConfirmationMode === "ask_before_changes" && (
                                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-white" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleSetDefaultMode("full_access");
                                setIsPresetDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full px-2.5 py-2 rounded-lg text-left flex items-start justify-between gap-2 transition-colors cursor-pointer",
                                defaultConfirmationMode === "full_access"
                                  ? "bg-[#383838] text-white font-medium"
                                  : "hover:bg-[#2b2b2b] text-[#d4d4d4] hover:text-white"
                              )}
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">Full Machine</span>
                                <span className="text-[10px] text-[#969696] font-normal">
                                  Run with full terminal & editing permissions.
                                </span>
                              </div>
                              {defaultConfirmationMode === "full_access" && (
                                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-white" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tool Permissions */}
                    <div className="p-3.5 rounded-lg bg-[#2b2b2b] flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-white">Tool Permissions</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-[#1b1b1b] text-white border border-[#2e2e2e]">
                            2
                          </span>
                        </div>
                        <span className="text-xs text-[#969696]">Modify permissions for file, terminal, and MCP tools.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("customizations")}
                        className="px-3.5 py-1.5 rounded-lg bg-[#1b1b1b] hover:bg-[#252528] border border-[#2e2e2e] text-xs font-medium text-white transition-colors cursor-pointer"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Agent Behavior */}
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Agent Behavior</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-white">Plan Review Policy</span>
                      <span className="text-xs text-[#969696]">Whether the agent asks you to review its documents.</span>
                      <span className="text-[11px] text-[#5d5d5d] flex items-center gap-1 mt-0.5">
                        <Info className="w-3 h-3 text-[#5d5d5d]" />
                        Type <code className="px-1 py-0.5 bg-[#2b2b2b] rounded font-mono text-[10px] text-white">/</code> and select <code className="px-1 py-0.5 bg-[#2b2b2b] rounded font-mono text-[10px] text-white">plan</code> to have the agent generate a plan.
                      </span>
                    </div>
                    <div className="relative" ref={planReviewDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsPlanReviewDropdownOpen((prev) => !prev)}
                        className="px-3 py-1.5 rounded-lg bg-[#1b1b1b] hover:bg-[#252528] border border-[#2e2e2e] text-xs font-medium text-white flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <span>{planReviewPolicy === "always_proceed" ? "Always Proceed" : "Ask Review"}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-[#969696]" />
                      </button>
                      {isPlanReviewDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#222222] border border-[#383838] rounded-xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in duration-100 shadow-none">
                          <button
                            type="button"
                            onClick={() => {
                              setPlanReviewPolicy("always_proceed");
                              localStorage.setItem("const_harness_plan_review_policy", "always_proceed");
                              setIsPlanReviewDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition-colors cursor-pointer",
                              planReviewPolicy === "always_proceed" ? "bg-[#383838] text-white font-medium" : "text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white"
                            )}
                          >
                            <span>Always Proceed</span>
                            {planReviewPolicy === "always_proceed" && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlanReviewPolicy("ask_review");
                              localStorage.setItem("const_harness_plan_review_policy", "ask_review");
                              setIsPlanReviewDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition-colors cursor-pointer",
                              planReviewPolicy === "ask_review" ? "bg-[#383838] text-white font-medium" : "text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white"
                            )}
                          >
                            <span>Ask Review</span>
                            {planReviewPolicy === "ask_review" && <Check className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Network Permissions */}
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Network Permissions</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-white">Network Access Rules</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-[#1b1b1b] text-white border border-[#2e2e2e]">
                          1
                        </span>
                      </div>
                      <span className="text-xs text-[#969696]">Configure allowed and denied URLs for reading.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toast.info("Network access is unrestricted in local harness")}
                      className="px-3.5 py-1.5 rounded-lg bg-[#1b1b1b] hover:bg-[#252528] border border-[#2e2e2e] text-xs font-medium text-white transition-colors cursor-pointer"
                    >
                      Open
                    </button>
                  </div>
                </div>

                {/* 5. Terminal & Tooling Permissions */}
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Terminal & Tooling Permissions</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-2 flex flex-col gap-1.5">
                    <div className="p-3.5 rounded-lg bg-[#2b2b2b] flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-white">Active Model</span>
                        <span className="text-xs text-[#969696]">Default frontier model used for workspace chat and agent reasoning.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("model-settings")}
                        className="px-2.5 py-1 text-xs rounded-lg border border-[#2e2e2e] bg-[#1b1b1b] hover:bg-[#252528] text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Manage models in Model settings"
                      >
                        <Cpu className="w-3.5 h-3.5 text-[#969696]" />
                        <span className="font-mono">{activeModel}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 6. Account Profile Card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Account</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-4 flex flex-col gap-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 rounded-full bg-[#383838] text-white border border-[#383838] shrink-0">
                          {user?.image ? (
                            <AvatarImage src={user.image} alt={user?.name || "User"} className="object-cover" />
                          ) : (
                            <AvatarFallback className="text-xs font-semibold text-white bg-[#383838]">
                              {initials || "A"}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="min-w-0 flex flex-col">
                          <span className="text-[13px] font-medium text-white truncate">
                            {user?.name || "Alif Farhanul Hakim"}
                          </span>
                          <span className="text-xs text-[#969696] truncate">
                            {user?.email || "nepatasfc@gmail.com"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-sans bg-[#1b1b1b] text-white border border-[#2e2e2e]">
                          Harness Studio
                        </span>
                      </div>
                    </div>

                    {quota && (
                      <div className="pt-2 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#969696]">Weekly Token Quota</span>
                          <span className="font-mono text-white/90">
                            {formatTokenDisplay(quota.remainingTokens)} / {formatTokenDisplay(quota.weeklyLimitTokens || 7_000_000)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#161616] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#22c55e] transition-all rounded-full"
                            style={{ width: `${Math.max(2, percentRemaining)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {(onSwitchAccount || onSignOut) && (
                      <div className="pt-2 flex items-center justify-end gap-2">
                        {onSwitchAccount && (
                          <button
                            type="button"
                            onClick={onSwitchAccount}
                            className="px-2.5 py-1 text-xs rounded-lg border border-[#2e2e2e] bg-[#1b1b1b] hover:bg-[#252528] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>Switch account</span>
                          </button>
                        )}
                        {onSignOut && (
                          <button
                            type="button"
                            onClick={onSignOut}
                            className="px-2.5 py-1 text-xs rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign out</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === "appearance" ? (
              /* ----------------------------------------------------------- */
              /* Appearance Settings Tab (Antigravity Style)                 */
              /* ----------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl">
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Interface & Layout</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-2 flex flex-col gap-1.5">
                    {/* Theme row */}
                    <div className="p-3.5 rounded-lg bg-[#2b2b2b] flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-white">Theme</span>
                        <span className="text-xs text-[#969696]">Select light, dark, or follow system appearance.</span>
                      </div>

                      <div className="inline-flex p-1 rounded-lg bg-[#161616] border border-[#383838] items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setTheme("system")}
                          className={cn(
                            "px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1.5",
                            theme === "system"
                              ? "bg-[#383838] text-white font-medium"
                              : "text-[#969696] hover:text-white"
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
                            "px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1.5",
                            theme === "light"
                              ? "bg-[#383838] text-white font-medium"
                              : "text-[#969696] hover:text-white"
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
                            "px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1.5",
                            theme === "dark"
                              ? "bg-[#383838] text-white font-medium"
                              : "text-[#969696] hover:text-white"
                          )}
                          title="Dark theme"
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>Dark</span>
                        </button>
                      </div>
                    </div>

                    {/* Conversation Width row */}
                    <div className="p-3.5 rounded-lg bg-[#2b2b2b] flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-white">Conversation Width</span>
                        <span className="text-xs text-[#969696]">Maximum width of the conversation container in workbench.</span>
                      </div>

                      <div className="inline-flex p-1 rounded-lg bg-[#161616] border border-[#383838] items-center gap-1 shrink-0">
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
                                "px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer",
                                isSelected
                                  ? "bg-[#383838] text-white font-medium"
                                  : "text-[#969696] hover:text-white"
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
              </div>
            ) : activeTab === "application" ? (
              /* ----------------------------------------------------------- */
              /* Application Settings Tab                                    */
              /* ----------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl">
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Workbench Preferences</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-2 flex flex-col gap-1.5">
                    <div className="p-3.5 rounded-lg bg-[#2b2b2b] flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-white">Code Syntax Highlighting</span>
                        <span className="text-xs text-[#969696]">Highlight syntax and diff changes in chat and preview.</span>
                      </div>
                      <span className="text-xs font-medium text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-2.5 py-0.5 rounded-md">
                        Enabled
                      </span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#2b2b2b] flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-white">Auto-Scroll Output</span>
                        <span className="text-xs text-[#969696]">Automatically follow terminal and chat streaming responses.</span>
                      </div>
                      <span className="text-xs font-medium text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-2.5 py-0.5 rounded-md">
                        Smooth
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">System Runtime & Environment</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-2 flex flex-col gap-1.5">
                    <div className="p-3 rounded-lg bg-[#2b2b2b] flex items-center justify-between text-xs">
                      <span className="text-[#969696]">Platform</span>
                      <span className="font-mono text-white/90">{window.electron?.platform || "desktop"}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#2b2b2b] flex items-center justify-between text-xs">
                      <span className="text-[#969696]">Runtime</span>
                      <span className="font-mono text-white/90">
                        Electron {window.electron?.versions?.electron || "34"} • Node {window.electron?.versions?.node || "20"}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#2b2b2b] flex items-center justify-between text-xs">
                      <span className="text-[#969696]">Harness Version</span>
                      <span className="font-mono text-white/90">v0.1.0-alpha</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "customizations" ? (
              /* ----------------------------------------------------------- */
              /* Customizations / Agent Capabilities Tab                    */
              /* ----------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl">
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Agent Capabilities</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "mcp-servers", label: "MCP Servers", desc: "External Model Context Protocol tool integrations.", icon: Server, badge: "Active" },
                      { id: "skills", label: "Skills", desc: "Domain-specific procedural workflows and guidance.", icon: Sparkles, badge: "Installed" },
                      { id: "subagents", label: "Subagents", desc: "Autonomous worker agents with specialized system prompts.", icon: Bot, badge: "Ready" },
                      { id: "commands", label: "Commands", desc: "Slash commands and fast interactive macros.", icon: Terminal, badge: "Available" },
                      { id: "hooks", label: "Hooks", desc: "Event-driven lifecycle callbacks and triggers.", icon: Anchor, badge: "Ready" },
                      { id: "memory", label: "Memory", desc: "Long-term workspace state and conversational recall.", icon: Brain, badge: "Enabled" },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border border-[#383838] bg-[#222222] p-3.5 flex flex-col justify-between gap-2.5 hover:border-[#4a4a4a] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-[#2b2b2b] text-white">
                                <Icon className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-medium text-white">{item.label}</span>
                            </div>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1b1b1b] text-[#969696] border border-[#2e2e2e]">
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#969696] leading-relaxed">{item.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : activeTab === "shortcuts" ? (
              /* ----------------------------------------------------------- */
              /* Shortcuts Tab                                               */
              /* ----------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl">
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">Keyboard Shortcuts</span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-2 flex flex-col gap-1.5">
                    {[
                      { key: "Ctrl + K / Cmd + K", desc: "Open Command Palette / Quick Search" },
                      { key: "Ctrl + Shift + K", desc: "Direct Task Search in Command Palette" },
                      { key: "Ctrl + B / Cmd + B", desc: "Toggle Left Sidebar" },
                      { key: "Ctrl + , / Cmd + ,", desc: "Open Settings Dialog" },
                      { key: "Esc", desc: "Close Pop-up Modals / Command Palette" },
                      { key: "Enter", desc: "Send Message in Workbench" },
                      { key: "Shift + Enter", desc: "New line in Chat Input" },
                    ].map((s) => (
                      <div key={s.key} className="p-3 rounded-lg bg-[#2b2b2b] flex items-center justify-between gap-4">
                        <span className="text-xs text-[#d4d4d4]">{s.desc}</span>
                        <kbd className="px-2 py-1 text-[11px] font-mono bg-[#1b1b1b] border border-[#2e2e2e] rounded-md text-white">
                          {s.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : activeTab === "conversations" || activeTab === "projects-all" || activeTab.startsWith("project:") ? (
              /* ----------------------------------------------------------- */
              /* Projects & Conversations Tab                                */
              /* ----------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl">
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-white">
                    {activeTab.startsWith("project:")
                      ? `Project: ${activeTab.replace("project:", "")}`
                      : "Workspace Projects & Sessions"}
                  </span>
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-2 flex flex-col gap-1.5">
                    {projectList.map((p) => (
                      <div key={p} className="p-3 rounded-lg bg-[#2b2b2b] flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <Folder className="w-4 h-4 text-[#969696]" />
                          <span className="text-xs font-medium text-white">{p}</span>
                        </div>
                        <span className="text-[11px] text-[#969696] font-sans">Active Project</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : activeTab === "usage-stats" ? (
              /* ----------------------------------------------------------- */
              /* Usage Stats Tab                                             */
              /* ----------------------------------------------------------- */
              <div className="flex flex-col gap-6 max-w-2xl">
                {/* 3 Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-4 flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                      Remaining
                    </span>
                    <span className="text-xl font-semibold font-mono text-white mt-1">
                      {formatTokenDisplay(quota?.remainingTokens ?? 7_000_000)}
                    </span>
                    <span className="text-[11px] text-[#969696]">
                      {percentRemaining.toFixed(1)}% available
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-4 flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                      Weekly Quota
                    </span>
                    <span className="text-xl font-semibold font-mono text-white mt-1">
                      {formatTokenDisplay(quota?.weeklyLimitTokens ?? 7_000_000)}
                    </span>
                    <span className="text-[11px] text-[#969696]">
                      Included free weekly
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#383838] bg-[#222222] p-4 flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-[#969696] uppercase tracking-wider">
                      Resets In
                    </span>
                    <span className="text-xl font-semibold font-mono text-white mt-1">
                      {quota?.resetsInText || "7d 0h"}
                    </span>
                    <span className="text-[11px] text-[#969696]">
                      Rolling weekly cycle
                    </span>
                  </div>
                </div>

                {/* Quota Progress Card */}
                <div className="rounded-xl border border-[#383838] bg-[#222222] p-4 sm:p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-white">
                        Token Allocation
                      </span>
                      <span className="text-[11px] text-[#969696] mt-0.5">
                        {formatTokenDisplay((quota?.weeklyLimitTokens ?? 7_000_000) - (quota?.remainingTokens ?? 7_000_000))} used of {formatTokenDisplay(quota?.weeklyLimitTokens ?? 7_000_000)} limit
                      </span>
                    </div>
                    <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md bg-[#1b1b1b] border border-[#2e2e2e] text-white">
                      {percentRemaining.toFixed(0)}% Left
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-[#161616] overflow-hidden border border-[#383838]">
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

                  <div className="font-mono text-[11px] text-[#969696] flex items-center justify-between">
                    <span>0 tokens</span>
                    <span>{formatTokenDisplay(quota?.weeklyLimitTokens ?? 7_000_000)} max</span>
                  </div>
                </div>

                {/* Informational note */}
                <div className="rounded-xl border border-[#383838] bg-[#222222] p-3.5 flex items-start gap-2.5 text-xs text-[#969696]">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#5d5d5d]" />
                  <div className="flex flex-col gap-1 leading-relaxed">
                    <span className="font-medium text-white">Router Native Gateway</span>
                    <span>
                      Your weekly quota of 7,000,000 tokens covers all queries routed through the Const native router. Custom external providers configured in Model Settings use your own API keys directly.
                    </span>
                  </div>
                </div>
              </div>
            ) : activeTab !== "model-settings" ? (
              /* Clean placeholder for other tabs as requested */
              <div className="flex flex-col gap-2 pt-6 max-w-2xl">
                <h1 className="text-xl font-medium text-white capitalize">
                  {activeTab.replace(/-/g, " ")}
                </h1>
                <p className="text-xs text-[#969696]">
                  This section is currently being configured and will be available in an upcoming update.
                </p>
              </div>
            ) : (
              /* ----------------------------------------------------------- */
              /* Model Settings View                                         */
              /* ----------------------------------------------------------- */
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#969696]">
                    Manage custom model providers. Once configured, they can be selected during chat.
                  </span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="p-1.5 rounded-lg hover:bg-[#2b2b2b] text-[#969696] hover:text-white transition-colors cursor-pointer"
                    title="Refresh settings and models"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Two-Column Card Container */}
                <div className="border border-[#383838] bg-[#222222] rounded-xl flex overflow-hidden min-h-[460px] flex-1">
                  {/* Left Column: Providers & Custom Providers */}
                  <div className="w-60 border-r border-[#383838] p-3.5 shrink-0 flex flex-col justify-between bg-[#1b1b1b]">
                    <div className="flex flex-col gap-4">
                      {/* Native Main Provider */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-medium text-[#969696] tracking-wide">
                          Providers
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedProviderId("const")}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer",
                            selectedProviderId === "const"
                              ? "bg-[#383838] text-white"
                              : "text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ConstLogoIcon size="xs" className="w-4 h-4 text-white shrink-0" />
                            <span className="truncate">Const</span>
                          </div>
                          {/* Status dot: green active */}
                          <div className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                        </button>
                      </div>

                      {/* Custom Providers */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-medium text-[#969696] tracking-wide">
                          Custom providers
                        </span>

                        {/* Configured Custom Providers */}
                        <div className="flex flex-col gap-1">
                          {customProviders.map((cp) => (
                            <div
                              key={cp.id}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer group",
                                selectedProviderId === cp.id
                                  ? "bg-[#383838] text-white"
                                  : "text-[#d4d4d4] hover:bg-[#2b2b2b] hover:text-white"
                              )}
                              onClick={() => setSelectedProviderId(cp.id)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <BoxIcon className="w-3.5 h-3.5 text-[#969696] shrink-0" />
                                <span className="truncate">{cp.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCustomProvider(cp.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 transition-opacity"
                                  title="Delete provider"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* + Add provider button */}
                          <button
                            type="button"
                            onClick={() => setSelectedProviderId("add-provider")}
                            className={cn(
                              "w-full flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left",
                              selectedProviderId === "add-provider"
                                ? "bg-[#383838] text-white"
                                : "text-[#969696] hover:bg-[#2b2b2b] hover:text-white"
                            )}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add provider</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Provider Configuration or Const Native Details via ScrollArea */}
                  <ScrollArea className="flex-1 min-h-0 w-full bg-[#161616]" viewportClassName="p-6">
                    <div className="flex flex-col justify-between min-h-full">
                      {selectedProviderId === "const" ? (
                        /* --------------------------------------------------------- */
                        /* Const Native Provider (router.const.web.id) */
                        /* --------------------------------------------------------- */
                        <div className="flex flex-col gap-6">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <ConstLogoIcon size="sm" className="w-5 h-5 text-white" />
                                <h2 className="text-base font-medium text-white">
                                  Const
                                </h2>
                                <span className="text-[10px] font-sans px-2 py-0.5 rounded-md bg-[#22c55e]/15 text-[#4ade80] border border-[#22c55e]/30">
                                  Native Provider
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#969696]">
                                Connected directly to <code className="text-[#d4d4d4] font-mono">router.const.web.id</code> via your Const Account SSO. No manual API keys required.
                              </p>
                            </div>
                          </div>

                          {/* Free Weekly Quota Card (7M Tokens/Week) */}
                          <div className="border border-[#383838] bg-[#222222] rounded-xl p-4 font-sans">
                            <div className="flex items-center justify-between text-xs text-[#969696] mb-2">
                              <span className="font-semibold tracking-wider text-white">
                                FREE WEEKLY QUOTA
                              </span>
                              <span className="tabular-nums text-[11px]">
                                Resets in {quota?.resetsInText || "7d 0h"}
                              </span>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    "text-sm sm:text-base font-bold tracking-tighter select-all font-mono",
                                    barColorClass
                                  )}
                                >
                                  [{asciiBar}]
                                </span>
                                <span
                                  className={cn(
                                    "text-xs sm:text-sm font-semibold tabular-nums",
                                    barColorClass
                                  )}
                                >
                                  {percentRemaining.toFixed(0)}%
                                </span>
                              </div>

                              <div className="text-xs sm:text-sm text-white font-medium tabular-nums">
                                {formatTokenDisplay(quota?.remainingTokens ?? 7_000_000)}{" "}
                                <span className="text-[#969696] font-normal">
                                  / {formatTokenDisplay(quota?.weeklyLimitTokens ?? 7_000_000)} tokens left
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Available Models List */}
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-white">
                                Available Models on Const Router
                              </Label>
                              <span className="text-[11px] text-[#969696]">
                                Synchronized automatically with chat
                              </span>
                            </div>

                            <div className="flex flex-col gap-2">
                              {BUILTIN_CONST_MODELS.map((m) => {
                                const isCurrent = activeModel === m.id || activeModel === m.name;
                                return (
                                  <div
                                    key={m.id}
                                    className={cn(
                                      "border rounded-xl p-3.5 flex flex-col gap-2 transition-colors cursor-pointer",
                                      isCurrent
                                        ? "border-[#0066ff] bg-[#2b2b2b]"
                                        : "border-[#383838] bg-[#222222] hover:border-[#4a4a4a] hover:bg-[#252525]"
                                    )}
                                    onClick={() => handleSelectActiveModel(m.id)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-white">
                                          {m.name}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1b1b1b] text-[#969696] font-mono border border-[#2e2e2e]">
                                          {m.id}
                                        </span>
                                        {isCurrent && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0066ff]/20 text-[#60a5fa] border border-[#0066ff]/30 font-medium flex items-center gap-1 font-sans">
                                            <Check className="w-3 h-3" />
                                            Active in Chat
                                          </span>
                                        )}
                                        {m.supportsThinking && (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1b1b1b] text-[#969696] border border-[#2e2e2e] font-sans">
                                            Thinking: {m.thinkingLevels?.join(", ") || "low, medium, high"}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[11px] text-[#969696]">
                                        <span>{m.contextWindow}</span>
                                        <span>•</span>
                                        <span>{m.maxOutput}</span>
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-[#969696] leading-relaxed">
                                      {m.desc}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Gateway Connection Details */}
                          <div className="border border-[#383838] bg-[#222222] rounded-xl p-3 text-xs flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[#969696]">
                              <span>Gateway Endpoint:</span>
                              <span className="font-mono text-white">
                                {CONST_ROUTER_DEFAULT_URL}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[#969696]">
                              <span>Authentication:</span>
                              <span className="text-[#22c55e] flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Account SSO Linked
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* --------------------------------------------------------- */
                        /* Custom Provider Configuration (1:1 with Screenshot) */
                        /* --------------------------------------------------------- */
                        <div className="flex flex-col gap-5">
                          <div>
                            <h2 className="text-base font-medium text-white">
                              Add model provider
                            </h2>
                            <p className="text-xs text-[#969696] mt-0.5">
                              Configure a custom API endpoint and initial model.
                            </p>
                          </div>

                          <div className="space-y-4">
                            {/* Name Field */}
                            <div className="space-y-1.5">
                              <Label className="text-xs text-[#d4d4d4]">Name</Label>
                              <Input
                                type="text"
                                value={newProviderName}
                                onChange={(e) => setNewProviderName(e.target.value)}
                                placeholder="e.g. DeepSeek"
                                className="bg-[#2b2b2b] border-[#383838] focus:border-[#d4d4d4] text-xs text-white placeholder:text-[#5d5d5d] rounded-xl h-9 font-sans"
                              />
                            </div>

                            {/* Base URL Field */}
                            <div className="space-y-1.5">
                              <Label className="text-xs text-[#d4d4d4]">Base URL</Label>
                              <Input
                                type="text"
                                value={newProviderBaseUrl}
                                onChange={(e) => setNewProviderBaseUrl(e.target.value)}
                                placeholder="https://api.example.com/v1"
                                className="bg-[#2b2b2b] border-[#383838] focus:border-[#d4d4d4] text-xs text-white placeholder:text-[#5d5d5d] rounded-xl h-9 font-mono"
                              />
                            </div>

                            {/* API Key Field */}
                            <div className="space-y-1.5">
                              <Label className="text-xs text-[#d4d4d4]">API key</Label>
                              <div className="relative">
                                <Input
                                  type={showApiKey ? "text" : "password"}
                                  value={newProviderApiKey}
                                  onChange={(e) => setNewProviderApiKey(e.target.value)}
                                  placeholder="Enter API key"
                                  className="bg-[#2b2b2b] border-[#383838] focus:border-[#d4d4d4] text-xs text-white placeholder:text-[#5d5d5d] rounded-xl h-9 pr-9 font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowApiKey(!showApiKey)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#969696] hover:text-white transition-colors"
                                >
                                  {showApiKey ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* API Format Dropdown */}
                            <div className="space-y-1.5">
                              <Label className="text-xs text-[#d4d4d4]">API format</Label>
                              <select
                                value={newProviderFormat}
                                onChange={(e) => setNewProviderFormat(e.target.value)}
                                className="w-full bg-[#2b2b2b] border border-[#383838] hover:border-[#4a4a4a] text-xs text-white rounded-xl px-3 py-2 outline-none transition-colors"
                              >
                                <option value="Anthropic: messages (/v1/messages)">
                                  Anthropic: messages (/v1/messages)
                                </option>
                                <option value="OpenAI: chat/completions (/v1/chat/completions)">
                                  OpenAI: chat/completions (/v1/chat/completions)
                                </option>
                                <option value="Google: generateContent (/v1beta)">
                                  Google: generateContent (/v1beta)
                                </option>
                              </select>
                            </div>

                            {/* Model List */}
                            <div className="space-y-2">
                              <Label className="text-xs text-[#d4d4d4]">Model list</Label>

                              {newProviderModels.length === 0 ? (
                                <div className="border border-dashed border-[#383838] rounded-xl p-3.5 flex items-center gap-2 text-xs text-[#969696] bg-[#222222]">
                                  <Info className="w-4 h-4 shrink-0 text-[#5d5d5d]" />
                                  <span>
                                    No models are configured. Add a model to use it in chat.
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {newProviderModels.map((m, idx) => (
                                    <div
                                      key={m.id}
                                      className="border border-[#383838] bg-[#2b2b2b] rounded-lg px-3 py-2 flex items-center justify-between text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-white">{m.name}</span>
                                        <span className="font-mono text-[#969696] text-[11px]">
                                          ({m.id})
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveModelFromNewProvider(idx)}
                                        className="text-[#969696] hover:text-rose-500 p-1 transition-colors"
                                        title="Remove model"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add Model Inline Popover or Trigger */}
                              {isAddingModel ? (
                                <div className="border border-[#383838] bg-[#222222] rounded-xl p-3 flex flex-col gap-2.5">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[11px] text-[#969696]">Model ID</Label>
                                      <Input
                                        value={tempModelId}
                                        onChange={(e) => setTempModelId(e.target.value)}
                                        placeholder="e.g. deepseek-chat"
                                        className="bg-[#2b2b2b] border-[#383838] text-xs text-white placeholder:text-[#5d5d5d] rounded-lg h-8 mt-1 font-mono"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-[11px] text-[#969696]">Display Name</Label>
                                      <Input
                                        value={tempModelName}
                                        onChange={(e) => setTempModelName(e.target.value)}
                                        placeholder="e.g. DeepSeek V3"
                                        className="bg-[#2b2b2b] border-[#383838] text-xs text-white placeholder:text-[#5d5d5d] rounded-lg h-8 mt-1"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setIsAddingModel(false)}
                                      className="h-7 text-xs rounded-lg border-[#383838] bg-[#1b1b1b] hover:bg-[#252528] text-[#d4d4d4]"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={handleAddModelToNewProvider}
                                      className="h-7 text-xs rounded-lg bg-white text-black hover:bg-[#d4d4d4]"
                                    >
                                      Add
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setIsAddingModel(true)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2e2e2e] bg-[#1b1b1b] hover:bg-[#252528] text-xs text-white transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add model</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Footer Row (Zero divider line) */}
                          <div className="pt-4 flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1.5 text-xs text-[#969696]">
                              {newProviderModels.length === 0 && (
                                <>
                                  <Info className="w-3.5 h-3.5 text-[#5d5d5d]" />
                                  <span>Add at least one model before adding the provider.</span>
                                </>
                              )}
                            </div>

                            <Button
                              disabled={newProviderModels.length === 0 || !newProviderName.trim()}
                              onClick={handleSaveNewProvider}
                              className="bg-white hover:bg-[#d4d4d4] text-black font-medium rounded-xl text-xs h-9 px-5 transition-all disabled:opacity-40"
                            >
                              Add provider
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
          )}
        </ScrollArea>
      </main>
      </div>
    </div>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}
