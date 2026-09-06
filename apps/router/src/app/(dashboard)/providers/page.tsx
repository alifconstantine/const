"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import type { Id } from "@const/backend/_generated/dataModel";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
  Card,
  Button,
  Badge,
  Input,
  ScrollArea,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ConstLogoIcon,
  toast,
  cn,
} from "@const/ui";
import {
  Cpu,
  Plus,
  Search,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Power,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
  Server,
  Zap,
  Globe,
  Settings2,
  AlertCircle,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { LobeProviderIcon } from "@/components/providers/lobe-provider-icon";
import { ModelConfigDialog, type ModelConfigData } from "@/components/models/model-config-dialog";
import {
  formatTokenDisplay,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_OUTPUT,
} from "@/lib/model-specs";

interface ModelItem {
  modelId: string;
  name: string;
  contextWindow?: string;
  maxOutputTokens?: string;
  inputTypes?: string[];
  outputTypes?: string[];
  enabled: boolean;
}

interface ProviderDefinition {
  id: string;
  name: string;
  category: "managed" | "byok" | "custom";
  protocol: "openai-compatible" | "anthropic" | "google-ai" | "custom";
  description: string;
  defaultBaseUrl?: string;
  docUrl?: string;
  iconLetter?: string;
}

const PRESET_PROVIDERS: ProviderDefinition[] = [
  {
    id: "const",
    name: "Const",
    category: "managed",
    protocol: "openai-compatible",
    description: "Platform Managed High-Speed infrastructure with default Gemini 3.6 Flash pool.",
    docUrl: "/endpoints",
    iconLetter: "C",
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "byok",
    protocol: "openai-compatible",
    description: "GPT-4o, o1, o3-mini, GPT-4 Turbo, and embeddings via official OpenAI API key.",
    defaultBaseUrl: "https://api.openai.com/v1",
    docUrl: "https://platform.openai.com/api-keys",
    iconLetter: "O",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "byok",
    protocol: "anthropic",
    description: "Claude 3.7 Sonnet (Hybrid Reasoning), Claude 3.5 Sonnet, and Claude 3.5 Haiku.",
    defaultBaseUrl: "https://api.anthropic.com",
    docUrl: "https://console.anthropic.com/settings/keys",
    iconLetter: "A",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    category: "byok",
    protocol: "openai-compatible",
    description: "DeepSeek-V3 and DeepSeek-R1 reasoning models via official high-speed API.",
    defaultBaseUrl: "https://api.deepseek.com",
    docUrl: "https://platform.deepseek.com/api_keys",
    iconLetter: "D",
  },
  {
    id: "groq",
    name: "Groq",
    category: "byok",
    protocol: "openai-compatible",
    description: "Ultra-fast LPU inference (500+ tok/s) for Llama 3.3 70B & DeepSeek R1 Distill.",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    docUrl: "https://console.groq.com/keys",
    iconLetter: "G",
  },
  {
    id: "google",
    name: "Google AI Studio",
    category: "byok",
    protocol: "google-ai",
    description: "Gemini 2.5 Flash, 2.5 Pro, and multimodal vision via Google AI Studio key.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    docUrl: "https://aistudio.google.com/app/apikey",
    iconLetter: "G",
  },
];

export default function ProvidersPage() {
  const { isAuthenticated, signIn } = useRouterAuth();

  // 1. Live Convex Data
  const userProviders = useQuery(
    api.router.providers.listUserProviders,
    isAuthenticated ? {} : "skip"
  );
  const saveProviderMutation = useMutation(api.router.providers.saveUserProvider);
  const toggleProviderMutation = useMutation(api.router.providers.toggleProviderStatus);
  const deleteProviderMutation = useMutation(api.router.providers.deleteUserProvider);
  const updateModelsMutation = useMutation(api.router.providers.updateImportedModels);

  // 2. Local State
  const [activeTab, setActiveTab] = useState<"all" | "byok" | "oauth" | "custom">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog State: Configure Provider (Preset or Custom)
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedProviderMeta, setSelectedProviderMeta] = useState<ProviderDefinition | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formProtocol, setFormProtocol] = useState<"openai-compatible" | "anthropic" | "google-ai" | "custom">("openai-compatible");
  const [showApiKey, setShowApiKey] = useState(false);

  // Model Fetching & Checklist State
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<ModelItem[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [manualModelId, setManualModelId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  // Dialog State: Manage Existing Models
  const [manageDoc, setManageDoc] = useState<{
    _id: Id<"userProviders">;
    name: string;
    importedModels: ModelItem[];
  } | null>(null);
  const [manageSearch, setManageSearch] = useState("");

  // Dialog State: Add / Edit Model Dialog
  const [modelConfigOpen, setModelConfigOpen] = useState(false);
  const [modelConfigTarget, setModelConfigTarget] = useState<"import-list" | "manage-list">("import-list");
  const [modelConfigInitial, setModelConfigInitial] = useState<Partial<ModelConfigData> | null>(null);
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);

  // Map of configured providers by providerId
  const configuredMap = useMemo(() => {
    const map = new Map<string, any>();
    if (userProviders) {
      for (const p of userProviders) {
        map.set(p.providerId, p);
      }
    }
    return map;
  }, [userProviders]);

  // Total stats
  const totalConnected = (userProviders?.filter((p) => p.status === "active").length || 0) + 1; // +1 for Const
  const totalImportedModels =
    (userProviders?.reduce(
      (acc, p) => acc + (p.status === "active" ? p.importedModels.filter((m) => m.enabled).length : 0),
      0
    ) || 0) + 1;

  // Filter custom providers
  const customProviders = useMemo(() => {
    if (!userProviders) return [];
    return userProviders.filter((p) => p.providerId.startsWith("custom-"));
  }, [userProviders]);

  // Filtered fetched models in config modal
  const filteredConfigModels = useMemo(() => {
    if (!modelSearch.trim()) return fetchedModels;
    const q = modelSearch.toLowerCase().trim();
    return fetchedModels.filter(
      (m) => m.name.toLowerCase().includes(q) || m.modelId.toLowerCase().includes(q)
    );
  }, [fetchedModels, modelSearch]);

  const selectedCount = fetchedModels.filter((m) => m.enabled).length;

  // Filtered managed models in manage dialog
  const filteredManagedModels = useMemo(() => {
    if (!manageDoc) return [];
    if (!manageSearch.trim()) return manageDoc.importedModels;
    const q = manageSearch.toLowerCase().trim();
    return manageDoc.importedModels.filter(
      (m) => m.name.toLowerCase().includes(q) || m.modelId.toLowerCase().includes(q)
    );
  }, [manageDoc, manageSearch]);

  const activeManagedCount = manageDoc?.importedModels.filter((m) => m.enabled).length || 0;

  // Toggle all filtered models in manage dialog
  const handleToggleAllManaged = (enable: boolean) => {
    setManageDoc((prev) => {
      if (!prev) return null;
      const targetIds = new Set(filteredManagedModels.map((m) => m.modelId));
      return {
        ...prev,
        importedModels: prev.importedModels.map((m) =>
          targetIds.has(m.modelId) ? { ...m, enabled: enable } : m
        ),
      };
    });
  };

  // Open configuration for preset provider
  const handleOpenPreset = (provider: ProviderDefinition) => {
    const existing = configuredMap.get(provider.id);
    setSelectedProviderMeta(provider);
    setIsCustomMode(false);
    setFormName(provider.name);
    setFormApiKey("");
    setFormBaseUrl(existing?.baseUrl || provider.defaultBaseUrl || "");
    setFormProtocol(provider.protocol);
    const existingModels = existing?.importedModels ? [...existing.importedModels] : [];
    setFetchedModels(existingModels);
    setShowApiKey(false);
    setModelSearch("");
    setIsSettingsExpanded(existingModels.length === 0);
    setIsConfigOpen(true);
  };

  // Open configuration for new custom provider
  const handleOpenNewCustom = () => {
    setSelectedProviderMeta(null);
    setIsCustomMode(true);
    setFormName("");
    setFormApiKey("");
    setFormBaseUrl("");
    setFormProtocol("openai-compatible");
    setFetchedModels([]);
    setShowApiKey(false);
    setModelSearch("");
    setManualModelId("");
    setIsSettingsExpanded(true);
    setIsConfigOpen(true);
  };

  // Trigger server-side model fetching
  const handleFetchModels = async () => {
    const targetProviderId = isCustomMode ? "custom" : selectedProviderMeta?.id;
    if (!targetProviderId) return;

    if (!isCustomMode && !formApiKey.trim()) {
      toast.error("Please enter your API Key first.");
      return;
    }

    if (isCustomMode && !formBaseUrl.trim()) {
      toast.error("Base URL is required for custom engines.");
      return;
    }

    setIsFetchingModels(true);
    try {
      const res = await fetch("/api/providers/fetch-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: targetProviderId,
          apiKey: formApiKey.trim(),
          baseUrl: formBaseUrl.trim(),
          protocol: formProtocol,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        if (data.models && data.models.length > 0) {
          // Default: all models checked (enabled: true) as requested!
          const normalized = data.models.map((m: any) => ({
            ...m,
            enabled: true,
          }));
          setFetchedModels(normalized);
          setIsSettingsExpanded(false);
          toast.success(`Discovered ${normalized.length} models`, {
            description: "All models are selected by default. You can customize the selection before importing.",
          });
        } else if (data.warning) {
          toast.info("Discovery info", { description: data.warning });
        } else {
          toast.info("No models discovered automatically. You can add model IDs manually below.");
        }
      } else {
        toast.error("Failed to connect or fetch models", {
          description: data?.error || `HTTP ${res.status}: Failed to reach provider endpoint.`,
        });
      }
    } catch (err: any) {
      toast.error("Connection error", {
        description: err?.message || "Failed to reach model fetch endpoint.",
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Toggle model selection
  const handleToggleModel = (modelId: string) => {
    setFetchedModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, enabled: !m.enabled } : m))
    );
  };

  // Select all or deselect all
  const handleToggleSelectAll = (select: boolean) => {
    if (!modelSearch.trim()) {
      setFetchedModels((prev) => prev.map((m) => ({ ...m, enabled: select })));
    } else {
      const targetIds = new Set(filteredConfigModels.map((m) => m.modelId));
      setFetchedModels((prev) =>
        prev.map((m) => (targetIds.has(m.modelId) ? { ...m, enabled: select } : m))
      );
    }
  };

  // Add manual model for custom provider
  const handleAddManualModel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = manualModelId.trim();
    if (!cleanId) return;

    if (fetchedModels.some((m) => m.modelId.toLowerCase() === cleanId.toLowerCase())) {
      toast.error("Model already in list");
      return;
    }

    const newModel: ModelItem = {
      modelId: cleanId,
      name: cleanId,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      maxOutputTokens: DEFAULT_MAX_OUTPUT,
      inputTypes: ["text"],
      outputTypes: ["text"],
      enabled: true,
    };

    setFetchedModels((prev) => [newModel, ...prev]);
    setManualModelId("");
    toast.success(`Added "${cleanId}"`);
  };

  // Save model from ModelConfigDialog (Add or Edit model)
  const handleSaveModelConfig = (data: ModelConfigData) => {
    if (modelConfigTarget === "import-list") {
      if (editingModelIndex !== null && editingModelIndex >= 0) {
        setFetchedModels((prev) =>
          prev.map((m, idx) =>
            idx === editingModelIndex
              ? {
                  ...m,
                  modelId: data.modelId,
                  name: data.name || data.modelId,
                  contextWindow: data.contextWindow,
                  maxOutputTokens: data.maxOutputTokens,
                  inputTypes: data.inputTypes,
                  outputTypes: data.outputTypes,
                }
              : m
          )
        );
        toast.success(`Updated "${data.modelId}"`);
      } else {
        if (fetchedModels.some((m) => m.modelId.toLowerCase() === data.modelId.toLowerCase())) {
          toast.error("Model ID already exists in list");
          return;
        }
        const newModel: ModelItem = {
          modelId: data.modelId,
          name: data.name || data.modelId,
          contextWindow: data.contextWindow,
          maxOutputTokens: data.maxOutputTokens,
          inputTypes: data.inputTypes,
          outputTypes: data.outputTypes,
          enabled: true,
        };
        setFetchedModels((prev) => [newModel, ...prev]);
        toast.success(`Added "${data.modelId}"`);
      }
    } else if (modelConfigTarget === "manage-list") {
      if (!manageDoc) return;
      if (editingModelIndex !== null && editingModelIndex >= 0) {
        setManageDoc((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            importedModels: prev.importedModels.map((m, idx) =>
              idx === editingModelIndex
                ? {
                    ...m,
                    modelId: data.modelId,
                    name: data.name || data.modelId,
                    contextWindow: data.contextWindow,
                    maxOutputTokens: data.maxOutputTokens,
                    inputTypes: data.inputTypes,
                    outputTypes: data.outputTypes,
                  }
                : m
            ),
          };
        });
        toast.success(`Updated "${data.modelId}" in draft`);
      } else {
        if (manageDoc.importedModels.some((m) => m.modelId.toLowerCase() === data.modelId.toLowerCase())) {
          toast.error("Model ID already exists in provider");
          return;
        }
        const newModel: ModelItem = {
          modelId: data.modelId,
          name: data.name || data.modelId,
          contextWindow: data.contextWindow,
          maxOutputTokens: data.maxOutputTokens,
          inputTypes: data.inputTypes,
          outputTypes: data.outputTypes,
          enabled: true,
        };
        setManageDoc((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            importedModels: [newModel, ...prev.importedModels],
          };
        });
        toast.success(`Added "${data.modelId}" to provider`);
      }
    }
    setModelConfigOpen(false);
  };

  // Save Provider & Import Models
  const handleSaveProvider = async () => {
    const finalProviderId = isCustomMode
      ? `custom-${Date.now()}`
      : selectedProviderMeta?.id;

    if (!finalProviderId) return;

    const trimmedName = (formName || selectedProviderMeta?.name || "Custom Provider").trim();
    if (!trimmedName) {
      toast.error("Please enter a name for the provider.");
      return;
    }

    const selectedModels = fetchedModels.filter((m) => m.enabled);
    if (selectedModels.length === 0) {
      toast.error("Please select at least one model to import.");
      return;
    }

    setIsSaving(true);
    try {
      await saveProviderMutation({
        providerId: finalProviderId,
        name: trimmedName,
        protocol: formProtocol,
        apiKey: formApiKey.trim() || undefined,
        baseUrl: formBaseUrl.trim() || undefined,
        importedModels: fetchedModels,
      });

      toast.success("Provider connected successfully!", {
        description: `${trimmedName} is active with ${selectedModels.length} models imported into your catalog.`,
      });

      setIsConfigOpen(false);
    } catch (err: any) {
      toast.error("Failed to save provider", {
        description: err?.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Provider Active/Disabled
  const handleToggleStatus = async (providerDocId: Id<"userProviders">, currentStatus: string, name: string) => {
    const nextStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      await toggleProviderMutation({
        providerDocId,
        status: nextStatus,
      });
      toast.success(`Provider ${nextStatus === "active" ? "enabled" : "disabled"}`, {
        description: `${name} has been ${nextStatus === "active" ? "activated" : "deactivated"}.`,
      });
    } catch (err: any) {
      toast.error("Failed to update status", { description: err?.message });
    }
  };

  // Delete Provider
  const handleDeleteProvider = async (providerDocId: Id<"userProviders">, name: string) => {
    if (!confirm(`Are you sure you want to disconnect ${name}? All imported models from this provider will be removed.`)) {
      return;
    }
    try {
      await deleteProviderMutation({ providerDocId });
      toast.success("Provider disconnected", {
        description: `${name} and its imported models were removed.`,
      });
    } catch (err: any) {
      toast.error("Failed to delete provider", { description: err?.message });
    }
  };

  // Save updated models from Manage Dialog
  const handleSaveManagedModels = async () => {
    if (!manageDoc) return;
    try {
      await updateModelsMutation({
        providerDocId: manageDoc._id,
        importedModels: manageDoc.importedModels,
      });
      toast.success("Models updated", {
        description: `Model selection for ${manageDoc.name} has been updated.`,
      });
      setManageDoc(null);
      setManageSearch("");
    } catch (err: any) {
      toast.error("Failed to update models", { description: err?.message });
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-7 pb-12">
        {/* 1. Breadcrumb: Dashboard > Providers */}
        <Breadcrumb>
          <BreadcrumbList className="text-xs font-sans">
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/40" />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium text-foreground">
                Providers &amp; BYOK
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* 2. Heading with Add Custom inline */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-sans font-semibold text-foreground tracking-tight">
              Providers &amp; BYOK.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-light">
              Bring your own API keys, connect private OpenAI-compatible endpoints, and import models into your universal gateway.
            </p>
          </div>

          {isAuthenticated && (
            <Button
              onClick={handleOpenNewCustom}
              className="rounded-full gap-1.5 text-xs font-medium cursor-pointer h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Custom</span>
            </Button>
          )}
        </div>

        {/* 3. Controls: Search + Filter Tabs (All / BYOK / OAuth / Custom) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search providers by name or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 h-10 rounded-xl bg-secondary/50 text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl text-xs font-sans shrink-0 h-10">
            {(["all", "byok", "oauth", "custom"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors font-medium text-xs",
                  activeTab === tab
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "all" ? "All" : tab === "oauth" ? "OAuth" : tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* OAuth Tab Empty State */}
        {activeTab === "oauth" && (
          <div className="p-12 rounded-2xl border border-dashed border-border/70 bg-card text-center space-y-2">
            <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground/60 stroke-[1.5]" />
            <h3 className="text-sm font-medium text-foreground">
              No OAuth Providers Connected
            </h3>
            <p className="text-xs text-muted-foreground font-light max-w-sm mx-auto">
              OAuth provider authentication integrations will appear here.
            </p>
          </div>
        )}

        {/* 4. Popular Providers Grid (Official @lobehub/icons vector SVGs) */}
        {(activeTab === "all" || activeTab === "byok") && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRESET_PROVIDERS.map((provider) => {
                const isConst = provider.id === "const";
                const userConfig = configuredMap.get(provider.id);
                const isConnected = isConst || !!userConfig;
                const isActive = isConst || userConfig?.status === "active";
                const importedCount = isConst
                  ? 1
                  : userConfig?.importedModels?.filter((m: any) => m.enabled).length || 0;

                return (
                  <Card
                    key={provider.id}
                    className="rounded-2xl border-none bg-card p-5 space-y-4 shadow-none flex flex-col justify-between transition-all"
                  >
                    <div className="space-y-3">
                      {/* Card Header: Icon + Name + Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Official @lobehub/icons Brand Logo Tile */}
                          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0 p-2 overflow-hidden">
                            <LobeProviderIcon providerId={provider.id} size={22} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-foreground font-sans truncate">
                              {provider.name}
                            </h4>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isConst ? (
                          <Badge className="rounded-full text-[10px] font-mono py-0.5 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none shrink-0">
                            Built-in
                          </Badge>
                        ) : userProviders === undefined ? (
                          <Skeleton className="h-5 w-20 rounded-full shrink-0" />
                        ) : isConnected ? (
                          isActive ? (
                            <Badge className="rounded-full text-[10px] font-mono py-0.5 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none shrink-0">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="rounded-full text-[10px] font-mono py-0.5 px-2 bg-secondary text-muted-foreground border-none shrink-0">
                              Disabled
                            </Badge>
                          )
                        ) : (
                          <Badge className="rounded-full text-[10px] font-mono py-0.5 px-2 bg-secondary/60 text-muted-foreground/70 border-none shrink-0">
                            Not configured
                          </Badge>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground font-light leading-relaxed line-clamp-2">
                        {provider.description}
                      </p>

                      {/* Connection Details if Connected */}
                      {userConfig && (
                        <div className="p-2.5 rounded-xl bg-secondary/50 text-[11px] font-mono space-y-1">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Key:</span>
                            <span className="text-foreground">{userConfig.keyPrefix}</span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Models:</span>
                            <span className="text-foreground font-medium">
                              {importedCount} imported
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions (Stadium Pills per DESIGN.md) */}
                    <div className="pt-2 flex items-center justify-between gap-2">
                      {isConst ? (
                        <div className="flex items-center justify-end w-full">
                          <Link href="/models">
                            <Button
                              size="sm"
                              className="rounded-full text-xs h-8 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none cursor-pointer"
                            >
                              <span>View</span>
                            </Button>
                          </Link>
                        </div>
                      ) : userProviders === undefined ? (
                        <div className="flex items-center justify-between w-full">
                          <Skeleton className="h-4 w-16 rounded" />
                          <Skeleton className="h-8 w-24 rounded-full" />
                        </div>
                      ) : isConnected ? (
                        <div className="flex items-center justify-between w-full gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setManageSearch("");
                              setManageDoc({
                                _id: userConfig._id,
                                name: provider.name,
                                importedModels: [...userConfig.importedModels],
                              });
                            }}
                            className="rounded-full text-xs h-8 px-3 border-border hover:bg-secondary cursor-pointer"
                          >
                            <Settings2 className="h-3 w-3 mr-1" />
                            <span>Models ({importedCount})</span>
                          </Button>

                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleToggleStatus(userConfig._id, userConfig.status, provider.name)
                                  }
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                                  aria-label="Toggle provider"
                                >
                                  <Power className={cn("h-3.5 w-3.5", isActive ? "text-emerald-500" : "text-muted-foreground")} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {isActive ? "Disable provider" : "Enable provider"}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenPreset(provider)}
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                                  aria-label="Edit provider key"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Update key / Re-fetch</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteProvider(userConfig._id, provider.name)}
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 cursor-pointer"
                                  aria-label="Disconnect provider"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Disconnect provider</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          {provider.docUrl && (
                            <a
                              href={provider.docUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-sans"
                            >
                              <span>Get key</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!isAuthenticated) {
                                signIn("/providers");
                              } else {
                                handleOpenPreset(provider);
                              }
                            }}
                            className="rounded-full text-xs h-8 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none cursor-pointer ml-auto"
                          >
                            <span>Connect</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Custom Endpoints Section (Ollama / vLLM / Local) */}
        {(activeTab === "all" || activeTab === "custom") && (
          <div className="space-y-4 pt-2">
            {isAuthenticated && customProviders.length > 0 && (
              <div className="flex items-center justify-end pl-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenNewCustom}
                  className="rounded-full text-xs h-7 px-3 border-none bg-secondary hover:bg-secondary/80 cursor-pointer gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Provider</span>
                </Button>
              </div>
            )}

            {userProviders === undefined ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2].map((i) => (
                  <Card key={i} className="rounded-2xl border-none bg-card p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-2xl" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28 rounded" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <div className="flex justify-between pt-2">
                      <Skeleton className="h-7 w-20 rounded-full" />
                      <Skeleton className="h-7 w-16 rounded-full" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : customProviders.length === 0 ? (
              <div className="p-8 sm:p-10 rounded-2xl border-none bg-card text-center space-y-3">
                <Server className="h-8 w-8 mx-auto text-muted-foreground/60 stroke-[1.5]" />
                <h4 className="text-sm font-medium text-foreground">
                  No Custom Endpoints Connected
                </h4>
                <p className="text-xs text-muted-foreground font-light max-w-md mx-auto">
                  Connect local Ollama instances (<code className="font-mono text-[11px]">http://localhost:11434</code>), vLLM, LM Studio, or private OpenAI-compatible cloud proxies.
                </p>
                {isAuthenticated ? (
                  <Button
                    onClick={handleOpenNewCustom}
                    size="sm"
                    className="rounded-full text-xs h-8 px-4 mt-1 border-none"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    <span>Connect Custom Provider</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => signIn("/providers")}
                    size="sm"
                    className="rounded-full text-xs h-8 px-4 mt-1 border-none"
                  >
                    <span>Sign In to Connect</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customProviders.map((cp) => {
                  const isActive = cp.status === "active";
                  const modelCount = cp.importedModels.filter((m: any) => m.enabled).length;

                  return (
                    <Card
                      key={cp._id}
                      className="rounded-2xl border-none bg-card p-5 space-y-4 shadow-none flex flex-col justify-between transition-all"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground font-mono text-xs font-semibold shrink-0">
                              <Server className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold text-foreground font-sans truncate">
                                {cp.name}
                              </h4>
                            </div>
                          </div>

                          <Badge
                            className={cn(
                              "rounded-full text-[10px] font-mono py-0.5 px-2 border-none shrink-0",
                              isActive
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-secondary text-muted-foreground"
                            )}
                          >
                            {isActive ? "Active" : "Disabled"}
                          </Badge>
                        </div>

                        {cp.baseUrl && (
                          <div className="p-2 rounded-xl bg-secondary/50 text-[11px] font-mono truncate text-muted-foreground">
                            {cp.baseUrl}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                          <span>Models:</span>
                          <span className="text-foreground font-medium">{modelCount} active</span>
                        </div>
                      </div>

                      <div className="pt-3 flex items-center justify-between">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setManageSearch("");
                            setManageDoc({
                              _id: cp._id,
                              name: cp.name,
                              importedModels: [...cp.importedModels],
                            });
                          }}
                          className="rounded-full text-xs h-8 px-3 border-border hover:bg-secondary cursor-pointer"
                        >
                          <Settings2 className="h-3 w-3 mr-1" />
                          <span>Models ({modelCount})</span>
                        </Button>

                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleStatus(cp._id, cp.status, cp.name)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Power className={cn("h-3.5 w-3.5", isActive ? "text-emerald-500" : "text-muted-foreground")} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {isActive ? "Disable" : "Enable"}
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteProvider(cp._id, cp.name)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 1: CONFIGURE PROVIDER & DISCOVER/IMPORT MODELS      */}
        {/* ========================================================= */}
        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <DialogContent className="rounded-2xl border-none bg-card max-w-xl sm:max-w-2xl p-6 sm:p-7 shadow-xl h-[88vh] max-h-[92vh] flex flex-col gap-3.5 overflow-hidden">
            <DialogHeader className="space-y-1.5 text-left shrink-0">
              <DialogTitle className="text-lg font-sans font-medium text-foreground tracking-tight flex items-center gap-2">
                <span>Configure {isCustomMode ? "Custom Provider" : selectedProviderMeta?.name}</span>
                <Badge className="rounded-full text-[10px] font-mono py-0 px-2 bg-secondary text-muted-foreground border-none">
                  {formProtocol}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-light leading-relaxed">
                Provide your credentials to discover and import models into your Const Router gateway.
              </DialogDescription>
            </DialogHeader>

            {fetchedModels.length === 0 ? (
              <ScrollArea type="always" className="flex-1 min-h-0">
                <div className="space-y-4 pr-2.5 py-1">
                  {/* Form Field: Name (For Custom) */}
                  {isCustomMode && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground font-sans">
                        Provider Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Local Ollama Workstation"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl bg-secondary/60 border-none text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:ring-1 focus:ring-inset focus:ring-foreground/20 transition-all"
                      />
                    </div>
                  )}

                  {/* Form Field: Base URL (Required for Custom, Optional for Preset) */}
                  {(isCustomMode || selectedProviderMeta?.defaultBaseUrl) && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground font-sans">
                          Base URL
                        </label>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {isCustomMode ? "Required" : "Default preset"}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. http://localhost:11434 or https://api.together.xyz/v1"
                        value={formBaseUrl}
                        onChange={(e) => setFormBaseUrl(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl bg-secondary/60 border-none text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-inset focus:ring-foreground/20 transition-all"
                      />
                    </div>
                  )}

                  {/* Form Field: Protocol Select (For Custom) */}
                  {isCustomMode && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground font-sans">
                        Protocol Compatibility
                      </label>
                      <Select
                        value={formProtocol}
                        onValueChange={(val: any) => setFormProtocol(val)}
                      >
                        <SelectTrigger className="h-10 rounded-xl bg-secondary/60 border-none focus:ring-1 focus:ring-inset focus:ring-foreground/20 text-xs font-sans text-foreground transition-all">
                          <SelectValue placeholder="Select Protocol" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none bg-popover text-xs font-sans shadow-lg">
                          <SelectItem value="openai-compatible" className="cursor-pointer">
                            OpenAI-Compatible (/v1/chat/completions)
                          </SelectItem>
                          <SelectItem value="anthropic" className="cursor-pointer">
                            Anthropic-Compatible (/v1/messages)
                          </SelectItem>
                          <SelectItem value="google-ai" className="cursor-pointer">
                            Google Gemini API
                          </SelectItem>
                          <SelectItem value="custom" className="cursor-pointer">
                            Custom Passthrough
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Form Field: API Key */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground font-sans">
                        API Key
                      </label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {isCustomMode ? "Optional" : "Encrypted at rest"}
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showApiKey ? "text" : "password"}
                        placeholder={
                          configuredMap.has(selectedProviderMeta?.id || "")
                            ? "Enter new key to replace, or keep blank to retain existing key"
                            : "e.g. sk-..."
                        }
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-secondary/60 border-none text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-inset focus:ring-foreground/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label={showApiKey ? "Hide key" : "Show key"}
                      >
                        {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Fetch Action Button */}
                  <div className="pt-1">
                    <Button
                      type="button"
                      onClick={handleFetchModels}
                      disabled={isFetchingModels}
                      className="w-full rounded-full gap-2 text-xs font-medium cursor-pointer h-10 bg-secondary hover:bg-secondary/80 text-foreground border-none shadow-none"
                    >
                      {isFetchingModels ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Connecting &amp; Fetching Models...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Test Connection &amp; Fetch Models</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Manual Model Adder (For Custom Provider) */}
                  {isCustomMode && (
                    <div className="pt-3 space-y-2 border-t border-border/60">
                      <label className="text-xs font-medium text-foreground font-sans">
                        Can&apos;t find your model? Add manually:
                      </label>
                      <form onSubmit={handleAddManualModel} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. qwen2.5-coder:32b or my-fine-tuned-model"
                          value={manualModelId}
                          onChange={(e) => setManualModelId(e.target.value)}
                          className="flex-1 h-9 px-3 rounded-xl bg-secondary/60 border border-border/80 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none hover:border-foreground/30 focus:border-foreground/40 focus:ring-1 focus:ring-inset focus:ring-foreground/15 transition-colors"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs h-9 px-3 cursor-pointer shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          <span>Add</span>
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
                {/* Connection Settings Card (Compact with Edit/Hide toggle) */}
                <div className="rounded-xl border border-border/70 bg-secondary/25 p-3 shrink-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0 font-mono text-xs">
                        {isCustomMode ? (
                          <Server className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <LobeProviderIcon providerId={selectedProviderMeta?.id || ""} className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground truncate font-sans">
                            {formName || selectedProviderMeta?.name || "Custom Provider"}
                          </span>
                          <Badge className="rounded-full text-[10px] font-mono py-0 px-1.5 bg-secondary text-muted-foreground border-none">
                            {formProtocol}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                          {formBaseUrl || selectedProviderMeta?.defaultBaseUrl || "Default preset endpoint"}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                      className="text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground cursor-pointer shrink-0 gap-1"
                    >
                      <Settings2 className="h-3 w-3" />
                      <span>{isSettingsExpanded ? "Hide Settings" : "Edit Settings"}</span>
                    </Button>
                  </div>

                  {/* Expandable Settings */}
                  {isSettingsExpanded && (
                    <ScrollArea className="mt-3 pt-3 border-t border-border/50 max-h-36 pr-2">
                      <div className="space-y-2.5 pr-1 py-0.5">
                        {isCustomMode && (
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-foreground font-sans">Provider Name</label>
                            <input
                              type="text"
                              value={formName}
                              onChange={(e) => setFormName(e.target.value)}
                              className="w-full h-8 px-3 rounded-lg bg-secondary/60 border border-border text-xs text-foreground outline-none"
                            />
                          </div>
                        )}

                        {(isCustomMode || selectedProviderMeta?.defaultBaseUrl) && (
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-foreground font-sans">Base URL</label>
                            <input
                              type="text"
                              value={formBaseUrl}
                              onChange={(e) => setFormBaseUrl(e.target.value)}
                              className="w-full h-8 px-3 rounded-lg bg-secondary/60 border border-border text-xs font-mono text-foreground outline-none"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-foreground font-sans">API Key</label>
                          <input
                            type={showApiKey ? "text" : "password"}
                            placeholder={configuredMap.has(selectedProviderMeta?.id || "") ? "Keep blank to retain key" : "e.g. sk-..."}
                            value={formApiKey}
                            onChange={(e) => setFormApiKey(e.target.value)}
                            className="w-full h-8 px-3 rounded-lg bg-secondary/60 border border-border text-xs font-mono text-foreground outline-none"
                          />
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onClick={handleFetchModels}
                          disabled={isFetchingModels}
                          className="w-full rounded-lg text-xs h-8 bg-secondary hover:bg-secondary/80 text-foreground border-none gap-1.5 cursor-pointer"
                        >
                          {isFetchingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          <span>Re-test Connection &amp; Refresh Models</span>
                        </Button>
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Models Section */}
                <div className="flex-1 min-h-0 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground font-sans">
                        Select Models to Import
                      </span>
                      <Badge className="rounded-full text-[10px] font-mono py-0 px-2 bg-primary text-primary-foreground">
                        {selectedCount} / {fetchedModels.length} selected
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setModelConfigTarget("import-list");
                          setModelConfigInitial(null);
                          setEditingModelIndex(null);
                          setModelConfigOpen(true);
                        }}
                        className="text-[11px] h-7 px-2.5 rounded-full cursor-pointer gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add model</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleSelectAll(true)}
                        className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        All
                      </Button>
                      <span className="text-border">|</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleSelectAll(false)}
                        className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        None
                      </Button>
                    </div>
                  </div>

                  {/* Filter search */}
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter models list..."
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-8 rounded-lg bg-secondary/40 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none font-sans focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
                    />
                    {modelSearch && (
                      <button
                        type="button"
                        onClick={() => setModelSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 rounded"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Models ScrollArea */}
                  <ScrollArea type="always" className="flex-1 min-h-0 w-full p-1.5 border border-border/70 rounded-xl bg-secondary/20">
                    <div className="space-y-1.5 pr-2 py-0.5">
                      {filteredConfigModels.length === 0 ? (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                          No models found matching &quot;{modelSearch}&quot;
                        </div>
                      ) : (
                        filteredConfigModels.map((model) => (
                          <div
                            key={model.modelId}
                            onClick={() => handleToggleModel(model.modelId)}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border",
                              model.enabled
                                ? "bg-card border-border/80 text-foreground"
                                : "bg-transparent border-transparent opacity-60 hover:opacity-100"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div
                                className={cn(
                                  "h-4 w-4 rounded flex items-center justify-center border transition-colors shrink-0",
                                  model.enabled
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-muted-foreground/40 bg-background"
                                )}
                              >
                                {model.enabled && <Check className="h-3 w-3 stroke-[2.5]" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate font-sans">
                                  {model.name}
                                </p>
                                <p className="text-[10px] font-mono text-muted-foreground truncate">
                                  {model.modelId}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                                {formatTokenDisplay(model.contextWindow, "1M")}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const idx = fetchedModels.findIndex((m) => m.modelId === model.modelId);
                                  setModelConfigTarget("import-list");
                                  setModelConfigInitial({
                                    modelId: model.modelId,
                                    name: model.name,
                                    contextWindow: model.contextWindow || DEFAULT_CONTEXT_WINDOW,
                                    maxOutputTokens: model.maxOutputTokens || DEFAULT_MAX_OUTPUT,
                                    inputTypes: model.inputTypes || ["text"],
                                    outputTypes: model.outputTypes || ["text"],
                                  });
                                  setEditingModelIndex(idx >= 0 ? idx : null);
                                  setModelConfigOpen(true);
                                }}
                                className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Edit model specs"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Manual Model Adder (For Custom Provider) */}
                  {isCustomMode && (
                    <form onSubmit={handleAddManualModel} className="flex gap-2 shrink-0 pt-1">
                      <input
                        type="text"
                        placeholder="Add model manually (e.g. qwen2.5-coder:32b)..."
                        value={manualModelId}
                        onChange={(e) => setManualModelId(e.target.value)}
                        className="flex-1 h-8 px-3 rounded-lg bg-secondary/50 border border-border/80 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none hover:border-foreground/30 focus:border-foreground/40 focus:ring-1 focus:ring-inset focus:ring-foreground/15 transition-colors"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-xs h-8 px-3 cursor-pointer shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        <span>Add</span>
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <DialogFooter className="pt-2 flex flex-row items-center justify-end gap-3 sm:space-x-0 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfigOpen(false)}
                disabled={isSaving}
                className="rounded-full text-xs h-9 px-4 border-none bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer shadow-none"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveProvider}
                disabled={isSaving || selectedCount === 0}
                className="rounded-full text-xs h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-none gap-1.5 cursor-pointer transition-all border-none"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Import {selectedCount} Models</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================= */}
        {/* MODAL 2: MANAGE IMPORTED MODELS FOR CONNECTED PROVIDER    */}
        {/* ========================================================= */}
        <Dialog
          open={!!manageDoc}
          onOpenChange={(open) => {
            if (!open) {
              setManageDoc(null);
              setManageSearch("");
            }
          }}
        >
          <DialogContent className="rounded-2xl border-none bg-card max-w-lg sm:max-w-xl p-6 sm:p-7 shadow-xl h-[85vh] max-h-[85vh] flex flex-col gap-3.5 overflow-hidden">
            <DialogHeader className="space-y-1.5 text-left shrink-0">
              <DialogTitle className="text-lg font-sans font-medium text-foreground tracking-tight">
                Manage Models: {manageDoc?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-light">
                Enable or disable specific models routed to this provider, or configure specs.
              </DialogDescription>
            </DialogHeader>

            {manageDoc && (
              <>
                {/* Controls row: Active Count + Select All/None + Add Model */}
                <div className="flex items-center justify-between gap-2 shrink-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-sans">
                      {activeManagedCount} / {manageDoc.importedModels.length} active
                    </span>
                    <span className="text-border">|</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAllManaged(true)}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer font-medium transition-colors"
                    >
                      All
                    </button>
                    <span className="text-border">·</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAllManaged(false)}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer font-medium transition-colors"
                    >
                      None
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setModelConfigTarget("manage-list");
                      setModelConfigInitial(null);
                      setEditingModelIndex(null);
                      setModelConfigOpen(true);
                    }}
                    className="rounded-full text-xs h-7 px-2.5 cursor-pointer gap-1 border-none bg-secondary hover:bg-secondary/80 text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add model</span>
                  </Button>
                </div>

                {/* Search input */}
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search models by name or ID..."
                    value={manageSearch}
                    onChange={(e) => setManageSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-8 rounded-lg bg-secondary/40 border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none font-sans focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
                  />
                  {manageSearch && (
                    <button
                      type="button"
                      onClick={() => setManageSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Scrollable Model List */}
                <ScrollArea type="always" className="flex-1 min-h-0 w-full">
                  <div className="space-y-1.5 pr-2.5 py-1">
                    {filteredManagedModels.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        {manageSearch ? (
                          <>No models found matching &quot;{manageSearch}&quot;</>
                        ) : (
                          <>No models available. Click &quot;Add model&quot; to add one.</>
                        )}
                      </div>
                    ) : (
                      filteredManagedModels.map((model) => (
                        <div
                          key={model.modelId}
                          onClick={() => {
                            setManageDoc((prev) => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                importedModels: prev.importedModels.map((m) =>
                                  m.modelId === model.modelId ? { ...m, enabled: !m.enabled } : m
                                ),
                              };
                            });
                          }}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors border",
                            model.enabled
                              ? "bg-secondary/70 border-border/60 text-foreground"
                              : "bg-transparent border-transparent opacity-50 hover:opacity-100"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div
                              className={cn(
                                "h-4 w-4 rounded flex items-center justify-center border transition-colors shrink-0",
                                model.enabled
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/40 bg-background"
                              )}
                            >
                              {model.enabled && <Check className="h-3 w-3 stroke-[2.5]" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium font-sans truncate">{model.name}</p>
                              <p className="text-[10px] font-mono text-muted-foreground truncate">
                                {model.modelId}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border/50 text-muted-foreground">
                              {formatTokenDisplay(model.contextWindow, "1M")}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                const idx = manageDoc.importedModels.findIndex((m) => m.modelId === model.modelId);
                                setModelConfigTarget("manage-list");
                                setModelConfigInitial({
                                  modelId: model.modelId,
                                  name: model.name,
                                  contextWindow: model.contextWindow || DEFAULT_CONTEXT_WINDOW,
                                  maxOutputTokens: model.maxOutputTokens || DEFAULT_MAX_OUTPUT,
                                  inputTypes: model.inputTypes || ["text"],
                                  outputTypes: model.outputTypes || ["text"],
                                });
                                setEditingModelIndex(idx >= 0 ? idx : null);
                                setModelConfigOpen(true);
                              }}
                              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Edit model specs"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </>
            )}

            <DialogFooter className="pt-2 flex flex-row items-center justify-end gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setManageDoc(null);
                  setManageSearch("");
                }}
                className="rounded-full text-xs h-9 px-4 cursor-pointer border-none bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground shadow-none"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveManagedModels}
                className="rounded-full text-xs h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90 font-medium cursor-pointer border-none shadow-none"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Global Add / Edit Model Dialog */}
        <ModelConfigDialog
          open={modelConfigOpen}
          onOpenChange={setModelConfigOpen}
          title={editingModelIndex !== null ? "Edit model" : "Add model"}
          initialData={modelConfigInitial}
          onSave={handleSaveModelConfig}
        />
      </div>
    </TooltipProvider>
  );
}
