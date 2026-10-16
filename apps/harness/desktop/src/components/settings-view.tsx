import React, { useState, useEffect, useMemo, useRef } from "react";
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
  SlidersHorizontal,
  Palette,
  Box,
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
  Plus,
  Minus,
  RotateCcw,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Info,
  ShieldCheck,
  X,
  Sun,
  Moon,
  LogOut,
  ArrowLeftRight,
  ChevronDown,
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
import { loadMultiModalConfig } from "../lib/models-config";
import { Volume2, Image as ImageIcon, Video as VideoIcon } from "lucide-react";

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

  let colorClass = "text-[#262626] dark:text-[#d4d4d4]";
  if (clamped <= 10) {
    colorClass = "text-rose-600 dark:text-rose-500";
  } else if (clamped <= 30) {
    colorClass = "text-amber-600 dark:text-amber-400";
  }

  return { bar, colorClass };
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
  const presetDropdownRef = useRef<HTMLDivElement>(null);

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

  // Load config on mount or refresh
  useEffect(() => {
    if (window.electron?.getConfig) {
      window.electron.getConfig().then((cfg) => {
        setConfig(cfg);
        if (cfg?.activeModel) {
          setActiveModel(cfg.activeModel);
        }
      });
    }
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    toast.success("Settings & models refreshed");
  };

  const handleSelectActiveModel = (modelId: string) => {
    setActiveModel(modelId);
    const found = BUILTIN_CONST_MODELS.find((m) => m.id === modelId);
    const displayName = found?.name || modelId;
    localStorage.setItem("const_harness_active_model", displayName);
    if (window.electron?.saveConfig) {
      window.electron.saveConfig({ activeModel: modelId }).catch(() => {});
    }
    toast.success(`Active model set to ${displayName}`);
  };

  // Original Const Harness Nav Categories
  const navCategories = [
    {
      label: "Basics",
      items: [
        { id: "general", label: "General", icon: SlidersHorizontal },
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "model-settings", label: "Model settings", icon: Box },
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
        {/* Left Sidebar inside Modal (Original Const Harness Menus)    */}
        {/* ----------------------------------------------------------- */}
        <aside className="w-[220px] sm:w-[240px] h-full flex flex-col justify-between shrink-0 bg-[#f4f4f6] dark:bg-[#222222] border-r border-[#dedee2] dark:border-[#383838] p-3 select-none">
          {/* Top Branding Strip */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 shrink-0 mb-1">
            <ConstLogoIcon size="sm" className="w-5 h-5 text-[#262626] dark:text-white" />
            <span className="text-xs font-semibold text-[#262626] dark:text-white tracking-tight">Settings</span>
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
                              isActive ? "text-[#262626] dark:text-white" : "text-[#737373] dark:text-[#969696]"
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

          {/* Bottom Section: Onboard & User Profile (Zero divider lines) */}
          <div className="flex flex-col gap-1.5 pt-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("onboard")}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left outline-none focus:outline-none",
                activeTab === "onboard"
                  ? "bg-[#e2e2e5] dark:bg-[#383838] text-[#262626] dark:text-white"
                  : "text-[#555555] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b]"
              )}
            >
              <Rocket
                className={cn(
                  "w-4 h-4 shrink-0",
                  activeTab === "onboard" ? "text-[#262626] dark:text-white" : "text-[#737373] dark:text-[#969696]"
                )}
              />
              <span>Onboard</span>
            </button>

            {/* User Profile Bar */}
            <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-[#e9e9ec] dark:hover:bg-[#2b2b2b] transition-colors mt-0.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-7 w-7 rounded-full bg-[#e2e2e5] dark:bg-[#383838] border border-[#dedee2] dark:border-[#383838] shrink-0">
                  {user?.image ? (
                    <AvatarImage
                      src={user.image}
                      alt={user?.name || "User"}
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="text-[11px] font-semibold text-[#262626] dark:text-white bg-[#e2e2e5] dark:bg-[#383838]">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#262626] dark:text-white truncate">
                    {user?.name || "Const User"}
                  </p>
                  <p className="text-[10px] text-[#737373] dark:text-[#969696] truncate">
                    {user?.email || "Workspace"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className="p-1 rounded-md text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer outline-none focus:outline-none"
                title="Account Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* ----------------------------------------------------------- */}
        {/* Right Main Content Area (Antigravity pop-up header & X)     */}
        {/* ----------------------------------------------------------- */}
        <main className="flex-1 h-full flex flex-col min-w-0 bg-[#ffffff] dark:bg-[#161616] overflow-hidden">
          {/* Header Row: Title, Subtitle, and Top-Right Close Button 'X' (zero divider lines) */}
          <div className="flex-none px-6 sm:px-8 pt-5 pb-2 flex items-start justify-between gap-4 select-none">
            <div>
              <h1 className="text-xl font-medium tracking-tight text-[#262626] dark:text-white capitalize">
                {activeTab === "model-settings"
                  ? "Model settings"
                  : activeTab.replace(/-/g, " ")}
              </h1>
              <p className="mt-1 text-xs text-[#737373] dark:text-[#969696]">
                {activeTab === "general"
                  ? "Manage profile details, default workbench preferences, and system environment."
                  : activeTab === "appearance"
                  ? "Configure theme mode and conversation workbench layout."
                  : activeTab === "model-settings"
                  ? "Configure multi-modal AI models for LLM reasoning, speech synthesis, image generation, and cinematic video."
                  : activeTab === "usage-stats"
                  ? "Monitor your weekly token consumption and account usage limits."
                  : activeTab === "memory"
                  ? "Save and reuse long-term context across your workspaces and global sessions."
                  : "This section is currently being configured and will be available in an upcoming update."}
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
            {activeTab === "general" ? (
              /* --------------------------------------------------------- */
              /* General Settings Tab                                      */
              /* --------------------------------------------------------- */
              <div className="flex flex-col gap-5 max-w-2xl pb-6">
                {/* Account Profile Card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Account
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
                          ) : (
                            <AvatarFallback className="text-xs font-semibold text-[#262626] dark:text-white bg-[#e2e2e5] dark:bg-[#383838]">
                              {initials}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="min-w-0 flex flex-col">
                          <span className="text-[13px] font-medium text-[#262626] dark:text-white truncate">
                            {user?.name || "Const User"}
                          </span>
                          <span className="text-xs text-[#737373] dark:text-[#969696] truncate">
                            {user?.email || "Local Workspace"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#ebebed] dark:bg-[#1b1b1b] text-[#555555] dark:text-[#d4d4d4] border border-[#dedee2] dark:border-[#383838]">
                          Local Studio
                        </span>
                      </div>
                    </div>

                    {quota && (
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#737373] dark:text-[#969696]">Weekly Token Quota</span>
                          <span className="font-sans tabular-nums text-[#262626] dark:text-[#d4d4d4]">
                            {formatTokenDisplay(quota.remainingTokens)} / {formatTokenDisplay(quota.weeklyLimitTokens || 7_000_000)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#e5e5e8] dark:bg-[#2b2b2b] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#22c55e] transition-all rounded-full"
                            style={{ width: `${Math.max(2, percentRemaining)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {(onSwitchAccount || onSignOut) && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {onSwitchAccount && (
                          <button
                            type="button"
                            onClick={onSwitchAccount}
                            className="px-2.5 py-1 text-xs rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>Switch account</span>
                          </button>
                        )}
                        {onSignOut && (
                          <button
                            type="button"
                            onClick={onSignOut}
                            className="px-2.5 py-1 text-xs rounded-lg text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer flex items-center gap-1.5 outline-none focus:outline-none"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign out</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Agent Settings Card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[14px] font-semibold text-[#262626] dark:text-white">
                    Agent Settings
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                        Security Preset
                      </span>
                      <span className="text-[12px] text-[#737373] dark:text-[#969696]">
                        Controls the actions the agent can take.
                      </span>
                      <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[#737373] dark:text-[#969696]">
                        <span>
                          Learn more about{" "}
                          <strong className="font-medium text-[#262626] dark:text-white">
                            {defaultConfirmationMode === "full_access" ? "Full machine" : "Ask before changes"}
                          </strong>
                        </span>
                        <span
                          className="inline-flex items-center cursor-help"
                          title={
                            defaultConfirmationMode === "full_access"
                              ? "Full machine: The agent executes actions and file edits without asking for manual confirmation each time."
                              : "Ask before changes: The agent will require manual confirmation before running terminal commands or modifying files."
                          }
                        >
                          <Info className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        </span>
                      </div>
                    </div>

                    {/* Dropdown Selector */}
                    <div className="relative" ref={presetDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsPresetDropdownOpen((prev) => !prev)}
                        className="px-3 py-1.5 rounded-lg bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] border border-[#dedee2] dark:border-[#383838] text-[12px] font-medium text-[#262626] dark:text-white flex items-center gap-2 transition-colors cursor-pointer outline-none focus:outline-none"
                      >
                        <span>
                          {defaultConfirmationMode === "full_access" ? "Full Machine" : "Ask Before Changes"}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                      </button>

                      {isPresetDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#ffffff] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-xl shadow-xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                          <button
                            type="button"
                            onClick={() => {
                              handleSetDefaultMode("ask_before_changes");
                              setIsPresetDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full px-2.5 py-2 rounded-lg text-left flex items-start justify-between gap-2 transition-colors cursor-pointer outline-none focus:outline-none",
                              defaultConfirmationMode === "ask_before_changes"
                                ? "bg-black/5 dark:bg-white/10 text-[#262626] dark:text-white font-medium"
                                : "hover:bg-black/5 dark:hover:bg-white/5 text-[#555555] dark:text-[#d4d4d4]"
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="text-[12px]">Ask Before Changes</span>
                              <span className="text-[10px] text-[#737373] dark:text-[#969696] font-normal">
                                Ask before file changes & command execution.
                              </span>
                            </div>
                            {defaultConfirmationMode === "ask_before_changes" && (
                              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#262626] dark:text-white" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleSetDefaultMode("full_access");
                              setIsPresetDropdownOpen(false);
                            }}
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
                                Run with full terminal & editing permissions.
                              </span>
                            </div>
                            {defaultConfirmationMode === "full_access" && (
                              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#262626] dark:text-white" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Workbench Preferences Card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    Workbench Preferences
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-3.5">
                    {/* Default LLM */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          Default LLM Model
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Active model selected for new tasks and workbench chat.
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab("model-settings")}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus:outline-none"
                        title="Manage models in Model settings"
                      >
                        <Bot className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span>{activeModel}</span>
                      </button>
                    </div>

                    {/* Default Speech */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          Default Voice AI
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Synthesizes audio responses and voice dialogues.
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab("model-settings")}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus:outline-none"
                        title="Manage speech in Model settings"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span className="text-[#737373] dark:text-[#969696]">
                          {multiModalConfig.speech.activeModelId || "Not configured"}
                        </span>
                      </button>
                    </div>

                    {/* Default Image */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          Default Image AI
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Generates visual assets and UI mockups.
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab("model-settings")}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus:outline-none"
                        title="Manage images in Model settings"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span className="text-[#737373] dark:text-[#969696]">
                          {multiModalConfig.image.activeModelId || "Not configured"}
                        </span>
                      </button>
                    </div>

                    {/* Default Video */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[#262626] dark:text-white">
                          Default Video AI
                        </span>
                        <span className="text-[11px] text-[#737373] dark:text-[#969696] mt-0.5">
                          Generates cinematic video clips and motion sequences.
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab("model-settings")}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#f0f0f2] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus:outline-none"
                        title="Manage videos in Model settings"
                      >
                        <VideoIcon className="w-3.5 h-3.5 text-[#737373] dark:text-[#969696]" />
                        <span className="text-[#737373] dark:text-[#969696]">
                          {multiModalConfig.video.activeModelId || "Not configured"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* About & System Card */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#969696] uppercase tracking-wider">
                    About
                  </span>
                  <div className="rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] p-4 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#737373] dark:text-[#969696]">Version</span>
                      <span className="font-mono text-[#262626] dark:text-[#d4d4d4]">v0.1.0-alpha</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#737373] dark:text-[#969696]">Platform</span>
                      <span className="font-mono text-[#262626] dark:text-[#d4d4d4]">
                        {window.electron?.platform || "desktop"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#737373] dark:text-[#969696]">Runtime</span>
                      <span className="font-mono text-[#262626] dark:text-[#d4d4d4]">
                        Electron {window.electron?.versions?.electron || "34"} • Node {window.electron?.versions?.node || "20"}
                      </span>
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
                      Your weekly quota of 7,000,000 tokens covers all queries routed through the Const native router. Custom external providers configured in Model Settings use your own API keys directly.
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
              /* Memory Settings View (Image 1 style)                      */
              /* --------------------------------------------------------- */
              <MemorySettings currentProject={currentProject} />
            ) : (
              /* --------------------------------------------------------- */
              /* Generic Placeholder for other original tabs               */
              /* (browser-use, computer-use, memory, subagents, plugins,   */
              /* mcp-servers, skills, commands, hooks, indexing, onboard)  */
              /* --------------------------------------------------------- */
              (() => {
                const currentItem =
                  navCategories
                    .flatMap((c) => c.items)
                    .find((i) => i.id === activeTab) ||
                  (activeTab === "onboard"
                    ? { id: "onboard", label: "Onboard", icon: Rocket }
                    : null);
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
