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
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import type { UserProfile } from "./sidebar";
import { getUserInitials } from "./sidebar";
import type { UserConfig } from "../vite-env";

interface SettingsViewProps {
  onBackToWorkspace: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  initialTab?: string;
}

export const CONST_ROUTER_DEFAULT_URL = "https://router.const.web.id/v1";

export const BUILTIN_CONST_MODELS = [
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    contextWindow: "1M Context",
    maxOutput: "128K Output",
    supportsThinking: true,
    isDefault: true,
    desc: "Frontier multimodal reasoning & code generation. Included in your 7M weekly tokens quota.",
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
  onBackToWorkspace,
  user,
  initialTab = "model-settings",
}: SettingsViewProps) {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Model settings sub-selection: "const" or custom provider ID or "add-provider"
  const [selectedProviderId, setSelectedProviderId] = useState<string>("const");

  // Electron window controls state
  const [isMaximized, setIsMaximized] = useState(false);

  // Local configuration
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [activeModel, setActiveModel] = useState<string>(() => {
    return localStorage.getItem("const_harness_active_model") || "gemini-3.6-flash";
  });

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

  return (
    <div className="w-screen h-screen overflow-hidden flex bg-[#161616] text-[#d4d4d4] select-none font-sans">
      {/* ------------------------------------------------------------- */}
      {/* Left Sidebar (Full height, 260px, following DESIGN.md) */}
      {/* ------------------------------------------------------------- */}
      <aside className="w-[260px] h-full flex flex-col justify-between shrink-0 bg-[#2b2b2b] text-[#d4d4d4] border-r border-[#383838]/40 p-3 select-none">
        {/* Top: Const Logo and Back to workspace button */}
        <div className="flex flex-col gap-3">
          {/* Frameless top drag handle with Const Logo */}
          <div
            className="flex items-center h-8"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            <div
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="flex items-center gap-2"
            >
              <ConstLogoIcon size="sm" className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Back to workspace button */}
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#d4d4d4] hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#969696]" />
            <span>Back to workspace</span>
          </button>

          {/* Navigation Categories */}
          <ScrollArea className="flex-1 w-full max-h-[calc(100vh-210px)] pr-1">
            <div className="flex flex-col gap-4 pt-1">
              {navCategories.map((cat) => (
                <div key={cat.label} className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-[#737373] px-2.5 tracking-tight">
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
                            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer",
                            isActive
                              ? "bg-[#383838] text-white"
                              : "text-[#d4d4d4] hover:text-white hover:bg-[#383838]/60"
                          )}
                        >
                          <Icon
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isActive ? "text-white" : "text-[#969696]"
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
        </div>

        {/* Bottom Section: Onboard & User Profile */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#383838]/40">
          <button
            type="button"
            onClick={() => setActiveTab("onboard")}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer",
              activeTab === "onboard"
                ? "bg-[#383838] text-white"
                : "text-[#d4d4d4] hover:text-white hover:bg-[#383838]/60"
            )}
          >
            <Rocket className="w-4 h-4 text-[#969696] shrink-0" />
            <span>Onboard</span>
          </button>

          {/* User Profile bar */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-[#383838]/50 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-7 w-7 rounded-full bg-[#1e1e1e] border border-[#383838] shrink-0">
                {user?.image ? (
                  <AvatarImage
                    src={user.image}
                    alt={user?.name || "User"}
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="text-[11px] font-semibold text-white bg-[#383838]">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">
                  {user?.name || "Alif Constantine"}
                </p>
                <p className="text-[10px] text-[#888888] truncate">
                  {user?.email || "Workspace"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className="p-1 rounded-md text-[#969696] hover:text-white transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* Right Main Content Area */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 h-full flex flex-col bg-[#161616] overflow-hidden">
        {/* Top Header Region (Frameless Draggable Window Strip) */}
        <div
          className="h-10 w-full flex items-center justify-end px-3 shrink-0 select-none z-30"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          {/* Window Controls */}
          <div
            className="flex items-center gap-0.5 text-[#d4d4d4]"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={() => window.electron?.minimize?.()}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => window.electron?.maximize?.()}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? (
                <Copy className="w-3 h-3 rotate-180" />
              ) : (
                <Square className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={() => window.electron?.close?.()}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#e81123] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic Section Content */}
        <div className="flex-1 overflow-y-auto px-8 py-4 max-w-6xl w-full mx-auto">
          {activeTab !== "model-settings" ? (
            /* Clean placeholder for other tabs as requested */
            <div className="flex flex-col gap-2 pt-6">
              <h1 className="text-2xl font-medium text-white capitalize">
                {activeTab.replace(/-/g, " ")}
              </h1>
              <p className="text-sm text-[#888888]">
                This section is currently being configured and will be available in an upcoming update.
              </p>
            </div>
          ) : (
            /* ----------------------------------------------------------- */
            /* Model Settings View (1:1 with reference screenshot) */
            /* ----------------------------------------------------------- */
            <div className="flex flex-col gap-6">
              {/* Header Title & Subtitle + Refresh Button */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-medium text-white">Model settings</h1>
                  <p className="mt-1 text-xs text-[#888888]">
                    Manage custom model providers. Once configured, they can be selected during chat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-2 rounded-lg hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                  title="Refresh settings and models"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              {/* Two-Column Card Container (Hairline border, shadow-free, DESIGN.md) */}
              <div className="border border-[#383838] bg-[#1e1e1e] rounded-2xl flex overflow-hidden min-h-[580px]">
                {/* Left Column: Providers & Custom Providers */}
                <div className="w-64 border-r border-[#383838]/60 p-4 shrink-0 flex flex-col justify-between bg-[#242424]/40">
                  <div className="flex flex-col gap-4">
                    {/* Native Main Provider */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-[#737373] tracking-wide">
                        Providers
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedProviderId("const")}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer",
                          selectedProviderId === "const"
                            ? "bg-[#333333] text-white"
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
                      <span className="text-[11px] font-medium text-[#737373] tracking-wide">
                        Custom providers
                      </span>

                      {/* Configured Custom Providers */}
                      <div className="flex flex-col gap-1">
                        {customProviders.map((cp) => (
                          <div
                            key={cp.id}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer group",
                              selectedProviderId === cp.id
                                ? "bg-[#333333] text-white"
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
                            "w-full flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left",
                            selectedProviderId === "add-provider"
                              ? "bg-[#333333] text-white"
                              : "text-[#888888] hover:bg-[#2b2b2b] hover:text-white"
                          )}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add provider</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Provider Configuration or Const Native Details */}
                <div className="flex-1 p-6 overflow-y-auto bg-[#1a1a1a]/60 flex flex-col justify-between">
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
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-[#22c55e]/15 text-[#4ade80] border border-[#22c55e]/30">
                              Native Provider
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#888888]">
                            Connected directly to <code className="text-[#d4d4d4] font-mono">router.const.web.id</code> via your Const Account SSO. No manual API keys required.
                          </p>
                        </div>
                      </div>

                      {/* Free Weekly Quota Card (7M Tokens/Week) */}
                      <div className="border border-[#383838] bg-[#222222] rounded-xl p-4 font-mono">
                        <div className="flex items-center justify-between text-xs text-[#888888] mb-2">
                          <span className="font-semibold tracking-wider text-[#d4d4d4]">
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
                                "text-sm sm:text-base font-bold tracking-tighter select-all",
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

                          <div className="text-xs sm:text-sm text-[#ececec] font-medium tabular-nums">
                            {formatTokenDisplay(quota?.remainingTokens ?? 7_000_000)}{" "}
                            <span className="text-[#888888] font-normal">
                              / {formatTokenDisplay(quota?.weeklyLimitTokens ?? 7_000_000)} tokens left
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Available Models List */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium text-[#d4d4d4]">
                            Available Models on Const Router
                          </Label>
                          <span className="text-[11px] text-[#888888]">
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
                                  "border rounded-xl p-3.5 flex flex-col gap-2 transition-all cursor-pointer",
                                  isCurrent
                                    ? "border-[#ff7a00]/60 bg-[#242424]"
                                    : "border-[#383838] bg-[#222222] hover:border-[#4a4a4a]"
                                )}
                                onClick={() => handleSelectActiveModel(m.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-white">
                                      {m.name}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#333333] text-[#a0a0a0] font-mono">
                                      {m.id}
                                    </span>
                                    {isCurrent && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff7a00]/20 text-[#ff9838] border border-[#ff7a00]/30 font-medium flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        Active in Chat
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#888888]">
                                    <span>{m.contextWindow}</span>
                                    <span>•</span>
                                    <span>{m.maxOutput}</span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-[#999999] leading-relaxed">
                                  {m.desc}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Gateway Connection Details */}
                      <div className="border border-[#383838]/80 bg-[#222222]/40 rounded-xl p-3 text-xs flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[#888888]">
                          <span>Gateway Endpoint:</span>
                          <span className="font-mono text-[#d4d4d4]">
                            {CONST_ROUTER_DEFAULT_URL}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#888888]">
                          <span>Authentication:</span>
                          <span className="text-[#4ade80] flex items-center gap-1">
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
                        <p className="text-xs text-[#888888] mt-0.5">
                          Configure a custom API endpoint and initial model.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {/* Name Field */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#a0a0a0]">Name</Label>
                          <Input
                            type="text"
                            value={newProviderName}
                            onChange={(e) => setNewProviderName(e.target.value)}
                            placeholder="e.g. DeepSeek"
                            className="bg-[#242424] border-[#383838] focus:border-[#d4d4d4] text-xs text-white rounded-xl h-9 font-sans"
                          />
                        </div>

                        {/* Base URL Field */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#a0a0a0]">Base URL</Label>
                          <Input
                            type="text"
                            value={newProviderBaseUrl}
                            onChange={(e) => setNewProviderBaseUrl(e.target.value)}
                            placeholder="https://api.example.com/v1"
                            className="bg-[#242424] border-[#383838] focus:border-[#d4d4d4] text-xs text-white rounded-xl h-9 font-mono"
                          />
                        </div>

                        {/* API Key Field */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-[#a0a0a0]">API key</Label>
                          <div className="relative">
                            <Input
                              type={showApiKey ? "text" : "password"}
                              value={newProviderApiKey}
                              onChange={(e) => setNewProviderApiKey(e.target.value)}
                              placeholder="Enter API key"
                              className="bg-[#242424] border-[#383838] focus:border-[#d4d4d4] text-xs text-white rounded-xl h-9 pr-9 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777777] hover:text-white transition-colors"
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
                          <Label className="text-xs text-[#a0a0a0]">API format</Label>
                          <select
                            value={newProviderFormat}
                            onChange={(e) => setNewProviderFormat(e.target.value)}
                            className="w-full bg-[#242424] border border-[#383838] hover:border-[#4a4a4a] text-xs text-white rounded-xl px-3 py-2 outline-none transition-colors"
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
                          <Label className="text-xs text-[#a0a0a0]">Model list</Label>

                          {newProviderModels.length === 0 ? (
                            <div className="border border-dashed border-[#383838] rounded-xl p-3.5 flex items-center gap-2 text-xs text-[#888888] bg-[#222222]/30">
                              <Info className="w-4 h-4 shrink-0 text-[#777777]" />
                              <span>
                                No models are configured. Add a model to use it in chat.
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {newProviderModels.map((m, idx) => (
                                <div
                                  key={m.id}
                                  className="border border-[#383838] bg-[#242424] rounded-lg px-3 py-2 flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-white">{m.name}</span>
                                    <span className="font-mono text-[#888888] text-[11px]">
                                      ({m.id})
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveModelFromNewProvider(idx)}
                                    className="text-[#888888] hover:text-rose-400 p-1"
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
                                  <Label className="text-[11px] text-[#888888]">Model ID</Label>
                                  <Input
                                    value={tempModelId}
                                    onChange={(e) => setTempModelId(e.target.value)}
                                    placeholder="e.g. deepseek-chat"
                                    className="bg-[#282828] border-[#383838] text-xs text-white rounded-lg h-8 mt-1 font-mono"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px] text-[#888888]">Display Name</Label>
                                  <Input
                                    value={tempModelName}
                                    onChange={(e) => setTempModelName(e.target.value)}
                                    placeholder="e.g. DeepSeek V3"
                                    className="bg-[#282828] border-[#383838] text-xs text-white rounded-lg h-8 mt-1"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsAddingModel(false)}
                                  className="h-7 text-xs rounded-lg border-[#383838]"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleAddModelToNewProvider}
                                  className="h-7 text-xs rounded-lg bg-[#ffffff] text-black hover:bg-[#e0e0e0]"
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsAddingModel(true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#383838] text-xs text-[#d4d4d4] hover:bg-[#282828] hover:text-white transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add model</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Footer Row matching screenshot */}
                      <div className="pt-4 border-t border-[#383838]/60 flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1.5 text-xs text-[#888888]">
                          {newProviderModels.length === 0 && (
                            <>
                              <Info className="w-3.5 h-3.5 text-[#777777]" />
                              <span>Add at least one model before adding the provider.</span>
                            </>
                          )}
                        </div>

                        <Button
                          disabled={newProviderModels.length === 0 || !newProviderName.trim()}
                          onClick={handleSaveNewProvider}
                          className="bg-[#383838] hover:bg-[#444444] text-white rounded-xl text-xs h-9 px-5 transition-all disabled:opacity-40"
                        >
                          Add provider
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
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
