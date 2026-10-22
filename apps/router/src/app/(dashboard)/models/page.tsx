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
  cn,
} from "@const/ui";
import {
  Search,
  Copy,
  Check,
  Zap,
  Box,
  Loader2,
  Brain,
  Mic,
  MessageSquare,
} from "lucide-react";
import { formatTokenDisplay, BUILTIN_MODELS, type ModelPricing } from "@/lib/model-specs";
import { calculateQuotaMetrics } from "@/lib/quota";

interface ModelItem {
  id: string;
  name: string;
  modelId: string;
  provider: string;
  contextWindow: string;
  maxOutputTokens?: string;
  pricing?: ModelPricing;
  inputTypes?: string[];
  outputTypes?: string[];
  supportsThinking?: boolean;
  category?: "llm" | "stt" | "search" | "image";
  endpoint?: string;
}

interface ProviderGroup {
  id: string;
  name: string;
  type: "builtin";
  models: ModelItem[];
}

// Unified Const Provider Catalog: All models run directly on Const Gateway
const PROVIDERS_DATA: ProviderGroup[] = [
  {
    id: "const",
    name: "Const Gateway",
    type: "builtin",
    models: BUILTIN_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      modelId: m.modelId,
      provider: m.provider,
      category: m.category,
      endpoint: m.endpoint,
      contextWindow: m.contextWindow || "1M",
      maxOutputTokens: m.maxOutputTokens || "128K",
      pricing: m.pricing,
      inputTypes: m.inputTypes,
      outputTypes: m.outputTypes,
      supportsThinking: m.supportsThinking,
    })),
  },
];

export default function ModelsPage() {
  const { isAuthenticated } = useRouterAuth();
  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip"
  );

  const metrics = useMemo(() => {
    return calculateQuotaMetrics(quota);
  }, [quota]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "llm" | "stt" | "search">("all");
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);

  // Unified single provider: Const Gateway
  const allProviders = PROVIDERS_DATA;

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
          providerId: "const",
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

  // Filter models by category and search query
  const filteredProviders = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allProviders.map((provider) => {
      // Filter models inside provider
      const matchedModels = provider.models.filter((model) => {
        // Modality / Category filter
        if (selectedCategory !== "all") {
          const isAudio = model.category === "stt" || model.inputTypes?.includes("audio") || model.modelId.includes("whisper");
          const isSearch = model.category === "search" || model.inputTypes?.includes("search") || model.modelId === "const-search";
          const isLlm = !isAudio && !isSearch;

          if (selectedCategory === "llm" && !isLlm) return false;
          if (selectedCategory === "stt" && !isAudio) return false;
          if (selectedCategory === "search" && !isSearch) return false;
        }

        if (!query) return true;
        const inName = model.name.toLowerCase().includes(query);
        const inId = model.modelId.toLowerCase().includes(query);
        return inName || inId;
      });

      if (matchedModels.length === 0 && (query || selectedCategory !== "all")) {
        return null;
      }

      return {
        ...provider,
        models: matchedModels,
      };
    }).filter(Boolean) as ProviderGroup[];
  }, [allProviders, searchQuery, selectedCategory]);

  // Total available models count across filtered
  const totalAvailableModels = allProviders.reduce(
    (acc, prov) => acc + prov.models.length,
    0
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-7 pb-12">
        {/* 1. Heading (Lora serif, declarative sentence with period per DESIGN.md) */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
            Models &amp; Pricing.
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-light">
            Unified Const models directory, context limits, and transparent Pay-As-You-Go pricing.
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
                Pay As You Go
              </h2>
              <p className="text-xs text-muted-foreground font-light">
                All models are managed on Const Gateway with transparent metered usage.
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
                  Active
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                <span className="font-semibold text-foreground">
                  {metrics.formattedUsed} / {metrics.formattedLimit} Used
                </span>
                <span className="text-muted-foreground">
                  ({metrics.percentRemaining.toFixed(0)}% left)
                </span>
              </div>
            </div>

            {/* Minimal borderless progress bar counting down from 100 to 0 */}
            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-300", metrics.barColor)}
                style={{ width: `${metrics.percentRemaining}%` }}
              />
            </div>

            <p className="text-[11px] text-muted-foreground font-light">
              Shared weekly token quota across all Const models. Resets in {metrics.resetsInText}.
            </p>
          </div>
        </Card>

        {/* 4. Controls: Category Filter Pills + Search Model + Provider Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "all", label: "All Modalities", icon: null },
              { id: "llm", label: "LLM / Chat", icon: MessageSquare },
              { id: "stt", label: "Audio / STT", icon: Mic },
              { id: "search", label: "Search", icon: Search },
            ].map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all cursor-pointer whitespace-nowrap",
                    isActive
                      ? "bg-foreground text-background font-medium shadow-sm"
                      : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-10 rounded-xl bg-secondary/50 border-none text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
              />
            </div>
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
                No models match your current filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
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
                        <TableHead className="w-[26%] min-w-[190px] pl-6 pr-3 text-xs font-sans font-medium text-muted-foreground">
                          Model
                        </TableHead>
                        <TableHead className="w-[10%] min-w-[75px] px-3 text-xs font-sans font-medium text-muted-foreground">
                          Context
                        </TableHead>
                        <TableHead className="w-[10%] min-w-[85px] px-3 text-xs font-sans font-medium text-muted-foreground">
                          Max Output
                        </TableHead>
                        <TableHead className="w-[11%] min-w-[85px] px-3 text-xs font-sans font-medium text-muted-foreground">
                          Input (/1M)
                        </TableHead>
                        <TableHead className="w-[11%] min-w-[85px] px-3 text-xs font-sans font-medium text-muted-foreground">
                          Cache (/1M)
                        </TableHead>
                        <TableHead className="w-[11%] min-w-[85px] px-3 text-xs font-sans font-medium text-muted-foreground">
                          Output (/1M)
                        </TableHead>
                        <TableHead className="w-[11%] min-w-[95px] px-3 text-xs font-sans font-medium text-muted-foreground">
                          Modality
                        </TableHead>
                        <TableHead className="w-[10%] min-w-[110px] pl-3 pr-6 text-right text-xs font-sans font-medium text-muted-foreground">
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
                          {/* 1. Model Name with Copy Button and Endpoint next to it */}
                          <TableCell className="py-4 pl-6 pr-3">
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

                              {/* Endpoint badge */}
                              {model.endpoint && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground border border-border/40">
                                  {model.endpoint}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* 2. Context Window */}
                          <TableCell className="py-4 px-3">
                            <span className="text-xs font-sans text-foreground font-normal tabular-nums">
                              {model.contextWindow}
                            </span>
                          </TableCell>

                          {/* 3. Max Output */}
                          <TableCell className="py-4 px-3">
                            <span className="text-xs font-sans text-foreground font-normal tabular-nums">
                              {model.maxOutputTokens}
                            </span>
                          </TableCell>

                          {/* 4. Input Price */}
                          <TableCell className="py-4 px-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono font-medium text-foreground">
                                {model.pricing?.input ?? "-"}
                              </span>
                              {model.pricing?.unit && model.pricing.unit !== "/ 1M tokens" && model.pricing.input !== "-" && (
                                <span className="text-[10px] font-sans text-muted-foreground/80">
                                  {model.pricing.unit}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* 5. Cached Price */}
                          <TableCell className="py-4 px-3">
                            <span className="text-xs font-mono text-muted-foreground">
                              {model.pricing?.cache ?? "-"}
                            </span>
                          </TableCell>

                          {/* 6. Output Price */}
                          <TableCell className="py-4 px-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono font-medium text-foreground">
                                {model.pricing?.output ?? "-"}
                              </span>
                              {model.pricing?.unit && model.pricing.unit !== "/ 1M tokens" && model.pricing.output !== "-" && (
                                <span className="text-[10px] font-sans text-muted-foreground/80">
                                  {model.pricing.unit}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* 7. Modality badges */}
                          <TableCell className="py-4 px-3">
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
                              {model.inputTypes?.includes("audio") && (
                                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center gap-1">
                                  <Mic className="h-2.5 w-2.5" />
                                  Audio
                                </span>
                              )}
                              {model.inputTypes?.includes("search") && (
                                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-md bg-secondary border border-border text-foreground flex items-center gap-1">
                                  <Search className="h-2.5 w-2.5 text-muted-foreground" />
                                  Search
                                </span>
                              )}
                              {model.supportsThinking && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-md bg-secondary border border-border text-foreground font-medium flex items-center gap-1 cursor-default">
                                      <Brain className="h-2.5 w-2.5 text-muted-foreground" />
                                      Reasoning
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    Supports dynamic thinking effort (low, medium, high)
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>

                          {/* 8. Action: Test Model */}
                          <TableCell className="py-4 pl-3 pr-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
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
                                    <span>Test</span>
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
      </div>
    </TooltipProvider>
  );
}
