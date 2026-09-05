"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
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
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  toast,
} from "@const/ui";
import {
  Search,
  Copy,
  Check,
  Zap,
  Box,
  Plus,
  Loader2,
  Pencil,
} from "lucide-react";
import { ModelConfigDialog } from "@/components/models/model-config-dialog";
import { formatTokenDisplay } from "@/lib/model-specs";

interface ModelItem {
  id: string;
  name: string;
  modelId: string;
  provider: string;
  providerDocId?: string;
  providerId?: string;
  contextWindow: string;
  maxOutputTokens?: string;
  inputTypes?: string[];
  outputTypes?: string[];
  isDefault?: boolean;
}

interface ProviderGroup {
  id: string;
  name: string;
  type: "builtin" | "byok" | "oauth";
  models: ModelItem[];
}

// Provider Catalog: Const with Gemini 3.6 Flash
const PROVIDERS_DATA: ProviderGroup[] = [
  {
    id: "const",
    name: "Const",
    type: "builtin",
    models: [
      {
        id: "gemini-3.6-flash",
        name: "Gemini 3.6 Flash",
        modelId: "gemini-3.6-flash",
        provider: "const",
        contextWindow: "1000000",
        maxOutputTokens: "128000",
        inputTypes: ["text", "image", "video"],
        outputTypes: ["text"],
        isDefault: true,
      },
    ],
  },
];

function formatTokenAmount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

export default function ModelsPage() {
  const { isAuthenticated } = useRouterAuth();
  const userProviders = useQuery(
    api.router.providers.listUserProviders,
    isAuthenticated ? {} : "skip"
  );
  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip"
  );
  const updateSingleModelMutation = useMutation(api.router.providers.updateSingleModel);

  const weeklyLimit = quota?.weeklyLimitTokens ?? 7_000_000;
  const usedTokens = quota?.usedTokens ?? 0;
  const percentRemaining = useMemo(() => {
    if (!quota) return 100;
    return Math.max(0, Math.min(100, quota.percentRemaining));
  }, [quota]);
  const resetsInText = quota?.resetsInText ?? "7d";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null);

  // Combine built-in Const provider with user's active connected providers
  const allProviders = useMemo(() => {
    const list: ProviderGroup[] = [...PROVIDERS_DATA];

    if (userProviders) {
      for (const up of userProviders) {
        if (up.status !== "active") continue;
        const enabledModels = up.importedModels.filter((m: any) => m.enabled);
        if (enabledModels.length === 0) continue;

        list.push({
          id: up.providerId,
          name: up.name,
          type: "byok",
          models: enabledModels.map((m: any) => ({
            id: `${up.providerId}/${m.modelId}`,
            name: m.name,
            modelId: m.modelId,
            provider: up.name,
            providerDocId: up._id,
            providerId: up.providerId,
            contextWindow: m.contextWindow || "1000000",
            maxOutputTokens: m.maxOutputTokens || "128000",
            inputTypes: m.inputTypes || ["text"],
            outputTypes: m.outputTypes || ["text"],
          })),
        });
      }
    }

    return list;
  }, [userProviders]);

  // Copy model identifier to clipboard
  const handleCopyModel = (modelId: string, displayName: string) => {
    navigator.clipboard.writeText(modelId);
    setCopiedModelId(modelId);
    toast.success("Model ID copied to clipboard", {
      description: `${displayName} (${modelId})`,
    });
    setTimeout(() => setCopiedModelId(null), 2000);
  };

  // Test model connectivity via server route
  const handleTestModel = async (model: ModelItem) => {
    setTestingModelId(model.id);
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.modelId,
          provider: model.provider,
          providerId: model.providerId || (model.provider === "const" ? "const" : undefined),
          providerDocId: model.providerDocId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        toast.success(`Model ${model.name} is operational`, {
          description: `Latency: ${data.latency}ms • Reply: "${data.reply}"`,
        });
      } else {
        const errorMsg =
          data?.error || `HTTP ${res.status}: Failed to communicate with engine`;
        toast.error(`Test failed for ${model.name}`, {
          description: errorMsg,
        });
      }
    } catch (err: any) {
      toast.error(`Connection error for ${model.name}`, {
        description: err?.message || "Failed to reach test server endpoint.",
      });
    } finally {
      setTestingModelId(null);
    }
  };

  // Filter models by provider and search query
  const filteredProviders = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allProviders.map((provider) => {
      // Check provider filter
      if (selectedProvider !== "all" && provider.id !== selectedProvider) {
        return null;
      }

      // Filter models inside provider
      const matchedModels = provider.models.filter((model) => {
        if (!query) return true;
        const inName = model.name.toLowerCase().includes(query);
        const inId = model.modelId.toLowerCase().includes(query);
        return inName || inId;
      });

      if (matchedModels.length === 0 && query) {
        return null;
      }

      return {
        ...provider,
        models: matchedModels,
      };
    }).filter(Boolean) as ProviderGroup[];
  }, [allProviders, searchQuery, selectedProvider]);

  // Total available models count across filtered
  const totalAvailableModels = allProviders.reduce(
    (acc, prov) => acc + prov.models.length,
    0
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-7 pb-12">
        {/* 1. Breadcrumb: Dashboard > Models */}
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
                Models
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* 2. Heading (Lora serif, declarative sentence with period per DESIGN.md) */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
            Models Catalog.
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-light">
            Active models directory, context boundaries, token limits, and gateway
            connectivity testing.
          </p>
        </div>

        {/* 3. Plan & Quota Banner Card (Real Quota UI without lines) */}
        <Card className="rounded-2xl border-none bg-card p-5 sm:p-6 space-y-4 shadow-none">
          {/* Top Tier Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                Current Plan
              </span>
              <h2 className="text-xl sm:text-2xl font-sans font-semibold text-foreground tracking-tight">
                Free
              </h2>
              <p className="text-xs text-muted-foreground font-light">
                Base models are included with 7M weekly token quota.
              </p>
            </div>

            <div className="flex items-center gap-8 self-start sm:self-auto pt-1 sm:pt-0">
              <div className="space-y-0.5 text-left sm:text-right">
                <div className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                  Available
                </div>
                <div className="text-sm sm:text-base font-semibold text-foreground font-sans tabular-nums">
                  {totalAvailableModels} models
                </div>
              </div>

              <div className="space-y-0.5 text-left sm:text-right">
                <div className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                  Locked
                </div>
                <div className="text-sm sm:text-base font-semibold text-foreground font-sans tabular-nums">
                  0 models
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Allowance Row (Real Quota Meter) */}
          <div className="pt-2 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                  Weekly Token Quota
                </span>
                <span className="text-[9px] font-sans font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none uppercase">
                  Free
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                <span className="font-semibold text-foreground">
                  {formatTokenAmount(usedTokens)} / {formatTokenAmount(weeklyLimit)} Used
                </span>
                <span className="text-muted-foreground">
                  ({percentRemaining}% left)
                </span>
              </div>
            </div>

            {/* Minimal borderless progress bar counting down from 100 to 0 */}
            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-300"
                style={{ width: `${percentRemaining}%` }}
              />
            </div>

            <p className="text-[11px] text-muted-foreground font-light">
              Shared 7M weekly token quota across all Const models. Resets in {resetsInText}.
            </p>
          </div>
        </Card>

        {/* 4. Controls: Search Model + Provider Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Left: Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search model name or capability..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 h-10 rounded-xl bg-secondary/50 border-none text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
            />
          </div>

          {/* Right: Provider Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <Select
              value={selectedProvider}
              onValueChange={(val) => {
                if (val === "add_provider") {
                  window.location.href = "/providers";
                  return;
                }
                setSelectedProvider(val);
              }}
            >
              <SelectTrigger className="h-10 min-w-[140px] rounded-xl bg-secondary/50 border-none text-xs font-sans text-foreground">
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none bg-popover text-xs font-sans shadow-lg">
                <SelectItem value="all" className="cursor-pointer">
                  All
                </SelectItem>
                {allProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                    {p.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem
                  value="add_provider"
                  className="cursor-pointer font-medium text-foreground hover:bg-secondary flex items-center gap-1.5"
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    <span>Add Provider</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 5. Model Listing: Grouped by Provider Card with Table inside */}
        <div className="space-y-6">
          {filteredProviders.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-border/70 bg-card text-center space-y-2">
              <Box className="h-8 w-8 mx-auto text-muted-foreground/60 stroke-[1.5]" />
              <h3 className="text-sm font-medium text-foreground">
                No models found
              </h3>
              <p className="text-xs text-muted-foreground font-light max-w-sm mx-auto">
                No models match your current search query &quot;{searchQuery}&quot;.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedProvider("all");
                }}
                className="mt-2 rounded-full text-xs h-8 border-none bg-secondary hover:bg-secondary/80"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            filteredProviders.map((provider) => (
              <Card
                key={provider.id}
                className="rounded-2xl border-none bg-card overflow-hidden shadow-none transition-all"
              >
                {/* Provider Header: Provider Name */}
                <div className="px-6 py-3.5 bg-secondary/40 border-none flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-foreground font-sans">
                      {provider.name}
                    </span>
                  </div>
                </div>

                {/* Models Table with adjusted column order */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/20">
                      <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="w-[35%] min-w-[200px] pl-6 pr-4 text-xs font-sans font-medium text-muted-foreground">
                          Model
                        </TableHead>
                        <TableHead className="w-[15%] min-w-[100px] px-4 text-xs font-sans font-medium text-muted-foreground">
                          Context Window
                        </TableHead>
                        <TableHead className="w-[15%] min-w-[100px] px-4 text-xs font-sans font-medium text-muted-foreground">
                          Max Output
                        </TableHead>
                        <TableHead className="w-[15%] min-w-[110px] px-4 text-xs font-sans font-medium text-muted-foreground">
                          Modality
                        </TableHead>
                        <TableHead className="w-[20%] min-w-[140px] pl-4 pr-6 text-right text-xs font-sans font-medium text-muted-foreground">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.models.map((model) => (
                        <TableRow
                          key={model.id}
                          className="border-none hover:bg-secondary/20 transition-colors"
                        >
                          {/* 1. Model Name with Copy Button next to it */}
                          <TableCell className="py-4 pl-6 pr-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-foreground font-sans">
                                {model.name}
                              </span>

                              {/* Copy model identifier */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() =>
                                      handleCopyModel(model.modelId, model.name)
                                    }
                                    className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                    title={`Copy ${model.modelId}`}
                                    aria-label={`Copy ${model.modelId}`}
                                  >
                                    {copiedModelId === model.modelId ? (
                                      <Check className="h-3.5 w-3.5 text-foreground" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Copy &quot;{model.modelId}&quot; to clipboard
                                </TooltipContent>
                              </Tooltip>

                              {model.isDefault && (
                                <Badge className="rounded-full text-[10px] font-sans py-0 px-2 bg-primary text-primary-foreground border-transparent">
                                  Default
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* 2. Context Window */}
                          <TableCell className="py-4 px-4">
                            <span className="text-xs font-sans text-foreground font-normal tabular-nums">
                              {formatTokenDisplay(model.contextWindow, "1M")}
                            </span>
                          </TableCell>

                          {/* 3. Max Output */}
                          <TableCell className="py-4 px-4">
                            <span className="text-xs font-sans text-foreground font-normal tabular-nums">
                              {formatTokenDisplay(model.maxOutputTokens, "128K")}
                            </span>
                          </TableCell>

                          {/* 4. Modality badges */}
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {model.inputTypes?.includes("text") && (
                                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-md bg-secondary border border-border text-foreground">
                                  Text
                                </span>
                              )}
                              {model.inputTypes?.includes("image") && (
                                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-md bg-secondary border border-border text-foreground">
                                  Image
                                </span>
                              )}
                              {model.inputTypes?.includes("video") && (
                                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-md bg-secondary border border-border text-foreground">
                                  Video
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* 5. Action: Edit (if BYOK) + Test Model */}
                          <TableCell className="py-4 pl-4 pr-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {model.providerDocId && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setEditingModel(model)}
                                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                                      aria-label={`Edit ${model.name}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    Edit model specs
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              <Button
                                size="sm"
                                onClick={() => handleTestModel(model)}
                                disabled={testingModelId === model.id}
                                className="rounded-full gap-1.5 text-xs font-medium cursor-pointer h-8 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none"
                              >
                                {testingModelId === model.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Testing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-3 w-3 fill-current" />
                                    <span>Test Model</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Edit Model Configuration Dialog */}
        <ModelConfigDialog
          open={!!editingModel}
          onOpenChange={(open) => !open && setEditingModel(null)}
          title={`Edit model: ${editingModel?.name || editingModel?.modelId}`}
          initialData={
            editingModel
              ? {
                  modelId: editingModel.modelId,
                  name: editingModel.name,
                  contextWindow: editingModel.contextWindow,
                  maxOutputTokens: editingModel.maxOutputTokens,
                  inputTypes: editingModel.inputTypes,
                  outputTypes: editingModel.outputTypes,
                }
              : null
          }
          onSave={async (data) => {
            if (!editingModel?.providerDocId) return;
            try {
              await updateSingleModelMutation({
                providerDocId: editingModel.providerDocId as any,
                modelId: editingModel.modelId,
                contextWindow: data.contextWindow,
                maxOutputTokens: data.maxOutputTokens,
                inputTypes: data.inputTypes,
                outputTypes: data.outputTypes,
              });
              toast.success("Model updated successfully", {
                description: `Updated configuration for ${data.modelId}`,
              });
              setEditingModel(null);
            } catch (err: any) {
              toast.error("Failed to update model", {
                description: err?.message || "An unexpected error occurred",
              });
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
}
