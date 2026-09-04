"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
  ConstLogoIcon,
  toast,
} from "@const/ui";
import {
  Search,
  Copy,
  Check,
  Zap,
  Box,
  Cpu,
  Plus,
  Loader2,
  FileText,
  Image as ImageIcon,
  FileCode,
  Headphones,
  Video,
  Wrench,
} from "lucide-react";

interface ModelCapability {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ModelItem {
  id: string;
  name: string;
  modelId: string;
  provider: "const";
  contextWindow: string;
  maxOutputTokens: string;
  capabilities: ModelCapability[];
  isDefault?: boolean;
}

interface ProviderGroup {
  id: string;
  name: string;
  type: "builtin" | "byok" | "oauth";
  models: ModelItem[];
}

const CAPABILITIES = {
  text: { id: "text", label: "Text", icon: FileText },
  image: { id: "image", label: "Image (Vision)", icon: ImageIcon },
  file: { id: "file", label: "File (Documents)", icon: FileCode },
  audio: { id: "audio", label: "Audio", icon: Headphones },
  video: { id: "video", label: "Video", icon: Video },
  tools: { id: "tools", label: "Tool Calling", icon: Wrench },
};

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
        contextWindow: "1M",
        maxOutputTokens: "64K", // Upstream: 65,536 tokens
        isDefault: true,
        capabilities: [
          CAPABILITIES.text,
          CAPABILITIES.image,
          CAPABILITIES.file,
          CAPABILITIES.audio,
          CAPABILITIES.video,
          CAPABILITIES.tools,
        ],
      },
    ],
  },
];

export default function ModelsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);

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
        body: JSON.stringify({ model: model.modelId }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        toast.success(`Model ${model.name} is operational`, {
          description: `Latency: ${data.latency}ms • Response: "${data.reply}"`,
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

    return PROVIDERS_DATA.map((provider) => {
      // Check provider filter
      if (selectedProvider !== "all" && provider.id !== selectedProvider) {
        return null;
      }

      // Filter models inside provider
      const matchedModels = provider.models.filter((model) => {
        if (!query) return true;
        const inName = model.name.toLowerCase().includes(query);
        const inId = model.modelId.toLowerCase().includes(query);
        const inCapabilities = model.capabilities.some((cap) =>
          cap.label.toLowerCase().includes(query)
        );
        return inName || inId || inCapabilities;
      });

      if (matchedModels.length === 0 && query) {
        return null;
      }

      return {
        ...provider,
        models: matchedModels,
      };
    }).filter(Boolean) as ProviderGroup[];
  }, [searchQuery, selectedProvider]);

  // Total available models count across filtered
  const totalAvailableModels = PROVIDERS_DATA.reduce(
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

        {/* 3. Plan & Quota Banner Card (Replicating exact layout from reference) */}
        <Card className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-4 shadow-none">
          {/* Top Tier Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                Current Plan
              </span>
              <h2 className="text-xl sm:text-2xl font-sans font-semibold text-foreground tracking-tight">
                Free
              </h2>
              <p className="text-xs text-muted-foreground font-light">
                Base models are included. Upgrade to unlock higher tiers.
              </p>
            </div>

            <div className="flex items-center gap-8 self-start sm:self-auto pt-1 sm:pt-0">
              <div className="space-y-0.5 text-left sm:text-right">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Available
                </div>
                <div className="text-sm sm:text-base font-semibold text-foreground font-mono">
                  {totalAvailableModels} models
                </div>
              </div>

              <div className="space-y-0.5 text-left sm:text-right">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Locked
                </div>
                <div className="text-sm sm:text-base font-semibold text-foreground font-mono">
                  0 models
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Allowance Row */}
          <div className="pt-4 border-t border-border/60 space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Free for paid usage
                </span>
                <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
                  Free
                </span>
              </div>

              {/* Set to 0 since no dummy values are used */}
              <div className="text-xs font-mono font-medium text-foreground">
                0 / 0 Used
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground font-light">
              Shared daily allowance across all free-for-paid models. Resets daily.
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
              className="w-full pl-10 pr-4 h-10 rounded-xl bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
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
              <SelectTrigger className="h-10 min-w-[170px] rounded-xl bg-secondary/50 border-border text-xs font-sans text-foreground">
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Select Provider" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover text-xs font-sans">
                <SelectItem value="all" className="cursor-pointer">
                  All Providers
                </SelectItem>
                <SelectItem value="const" className="cursor-pointer">
                  Const
                </SelectItem>
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
                className="mt-2 rounded-full text-xs h-8"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            filteredProviders.map((provider) => (
              <Card
                key={provider.id}
                className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-none transition-all"
              >
                {/* Provider Header: Const Logo + Provider Name (no internal endpoints or badges) */}
                <div className="px-6 py-3.5 bg-secondary/40 border-b border-border/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ConstLogoIcon size="xs" className="w-5 h-5 text-foreground" />
                    <span className="text-sm font-semibold text-foreground font-sans">
                      {provider.name}
                    </span>
                  </div>
                </div>

                {/* Models Table with adjusted column order */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/20">
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="w-[34%] min-w-[200px] pl-6 pr-4 text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                          Model
                        </TableHead>
                        <TableHead className="w-[22%] min-w-[150px] px-4 text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                          Capabilities
                        </TableHead>
                        <TableHead className="w-[15%] min-w-[110px] px-4 text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                          Context Window
                        </TableHead>
                        <TableHead className="w-[15%] min-w-[110px] px-4 text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                          Max Output Token
                        </TableHead>
                        <TableHead className="w-[14%] min-w-[100px] pl-4 pr-6 text-right text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.models.map((model) => (
                        <TableRow
                          key={model.id}
                          className="border-border/50 hover:bg-secondary/20 transition-colors"
                        >
                          {/* 1. Model Name with Copy Button next to it */}
                          <TableCell className="py-4 pl-6 pr-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-foreground font-sans">
                                {model.name}
                              </span>

                              {/* Copy model identifier (gemini-3.6-flash) */}
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

                          {/* 2. Capabilities: Icon-only with Tooltips */}
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {model.capabilities.map((cap) => {
                                const IconComp = cap.icon;
                                return (
                                  <Tooltip key={cap.id}>
                                    <TooltipTrigger asChild>
                                      <div className="h-7 w-7 rounded-lg bg-secondary/80 border border-border/60 flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-help">
                                        <IconComp className="h-3.5 w-3.5 text-muted-foreground" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      {cap.label}
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </TableCell>

                          {/* 3. Context Window: Plain text */}
                          <TableCell className="py-4 px-4">
                            <span className="text-xs font-mono text-foreground font-normal">
                              {model.contextWindow}
                            </span>
                          </TableCell>

                          {/* 4. Max Output Token: Plain text (64K) */}
                          <TableCell className="py-4 px-4">
                            <span className="text-xs font-mono text-foreground font-normal">
                              {model.maxOutputTokens}
                            </span>
                          </TableCell>

                          {/* 5. Action: Test Model Button */}
                          <TableCell className="py-4 pl-4 pr-6 text-right">
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
