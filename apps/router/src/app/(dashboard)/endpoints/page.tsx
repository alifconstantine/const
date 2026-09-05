"use client";

import { useState, useMemo, useEffect } from "react";
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  toast,
} from "@const/ui";
import {
  MessageSquare,
  CodeXml,
  Bot,
  Binary,
  Image as ImageIcon,
  Paintbrush,
  Mic,
  Volume2,
  Music,
  Video,
  Search,
  ListFilter,
  Copy,
  Check,
  Cpu,
  Layers,
  Key,
  ArrowRight,
  Sparkles,
  ExternalLink,
  X,
} from "lucide-react";
import { getAppUrl } from "@/lib/auth-constants";

interface EndpointItem {
  id: string;
  name: string;
  path: string;
  method: "POST" | "GET";
  protocol: "OPENAI" | "ANTHROPIC" | "UNIVERSAL";
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

interface EndpointCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoints: EndpointItem[];
}

const ENDPOINT_CATEGORIES: EndpointCategory[] = [
  {
    id: "core",
    title: "CORE APIS",
    subtitle: "Primary language model completion and conversational messaging protocols.",
    icon: Cpu,
    endpoints: [
      {
        id: "chat-completions",
        name: "Chat Completions",
        path: "/v1/chat/completions",
        method: "POST",
        protocol: "OPENAI",
        description: "OpenAI-compatible chat completions with streaming, function calling, and structured JSON output.",
        icon: MessageSquare,
        iconBg: "bg-sky-500/10 border-sky-500/20",
        iconColor: "text-sky-500",
      },
      {
        id: "responses",
        name: "Responses",
        path: "/v1/responses",
        method: "POST",
        protocol: "OPENAI",
        description: "OpenAI Responses API format for stateful conversations, chain-of-thought, and reasoning workflows.",
        icon: CodeXml,
        iconBg: "bg-indigo-500/10 border-indigo-500/20",
        iconColor: "text-indigo-500",
      },
      {
        id: "messages",
        name: "Messages",
        path: "/v1/messages",
        method: "POST",
        protocol: "ANTHROPIC",
        description: "Anthropic Claude messages protocol compatible endpoint with prompt caching and tool execution.",
        icon: Bot,
        iconBg: "bg-amber-500/10 border-amber-500/20",
        iconColor: "text-amber-500",
      },
    ],
  },
  {
    id: "media",
    title: "MEDIA & MULTI-MODAL",
    subtitle: "High-dimensional embeddings, computer vision, voice audio, music, and generative video.",
    icon: Layers,
    endpoints: [
      {
        id: "embeddings",
        name: "Embeddings",
        path: "/v1/embeddings",
        method: "POST",
        protocol: "OPENAI",
        description: "Dense vector representations for text similarity, clustering, and semantic RAG search.",
        icon: Binary,
        iconBg: "bg-emerald-500/10 border-emerald-500/20",
        iconColor: "text-emerald-500",
      },
      {
        id: "images-generations",
        name: "Image Generation",
        path: "/v1/images/generations",
        method: "POST",
        protocol: "OPENAI",
        description: "Text-to-image synthesis supporting DALL-E, Imagen, Midjourney, and Stable Diffusion models.",
        icon: ImageIcon,
        iconBg: "bg-purple-500/10 border-purple-500/20",
        iconColor: "text-purple-500",
      },
      {
        id: "images-edits",
        name: "Image Edits",
        path: "/v1/images/edits",
        method: "POST",
        protocol: "OPENAI",
        description: "Canvas expansion, mask-based inpainting, and stylistic variation generation.",
        icon: Paintbrush,
        iconBg: "bg-fuchsia-500/10 border-fuchsia-500/20",
        iconColor: "text-fuchsia-500",
      },
      {
        id: "audio-transcriptions",
        name: "Audio Transcription",
        path: "/v1/audio/transcriptions",
        method: "POST",
        protocol: "OPENAI",
        description: "Speech-to-text audio transcription, speaker diarization, and multilingual translation.",
        icon: Mic,
        iconBg: "bg-rose-500/10 border-rose-500/20",
        iconColor: "text-rose-500",
      },
      {
        id: "audio-speech",
        name: "Audio Speech",
        path: "/v1/audio/speech",
        method: "POST",
        protocol: "OPENAI",
        description: "High-fidelity neural text-to-speech audio synthesis with natural human voice timbre.",
        icon: Volume2,
        iconBg: "bg-teal-500/10 border-teal-500/20",
        iconColor: "text-teal-500",
      },
      {
        id: "music-generations",
        name: "Music Generation",
        path: "/v1/music/generations",
        method: "POST",
        protocol: "UNIVERSAL",
        description: "AI musical composition, backing tracks, sound effects, and instrumental audio synthesis.",
        icon: Music,
        iconBg: "bg-pink-500/10 border-pink-500/20",
        iconColor: "text-pink-500",
      },
      {
        id: "videos-generations",
        name: "Video Generation",
        path: "/v1/videos/generations",
        method: "POST",
        protocol: "UNIVERSAL",
        description: "Text-to-video and image-to-video generation with frame continuity and camera motion control.",
        icon: Video,
        iconBg: "bg-red-500/10 border-red-500/20",
        iconColor: "text-red-500",
      },
    ],
  },
  {
    id: "search",
    title: "SEARCH & DISCOVERY",
    subtitle: "Real-time web indexing, internet search queries, and retrieval citations.",
    icon: Search,
    endpoints: [
      {
        id: "web-search",
        name: "Web Search",
        path: "/v1/search",
        method: "POST",
        protocol: "UNIVERSAL",
        description: "Live search engine query endpoint with grounded web citations, snippets, and source URLs.",
        icon: Search,
        iconBg: "bg-cyan-500/10 border-cyan-500/20",
        iconColor: "text-cyan-500",
      },
    ],
  },
  {
    id: "utility",
    title: "MODELS & UTILITY",
    subtitle: "Catalog discovery, model inventory, and operational status inspection.",
    icon: ListFilter,
    endpoints: [
      {
        id: "list-models",
        name: "List Models",
        path: "/v1/models",
        method: "GET",
        protocol: "OPENAI",
        description: "Discover all active models, available providers, and virtual combos configured in your workspace.",
        icon: ListFilter,
        iconBg: "bg-emerald-500/10 border-emerald-500/20",
        iconColor: "text-emerald-500",
      },
    ],
  },
];

export default function EndpointsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [copyMode, setCopyMode] = useState<"full" | "path">("full");
  const [originUrl, setOriginUrl] = useState("https://router.const.web.id");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const appUrl = getAppUrl();
      if (appUrl) {
        setOriginUrl(appUrl.replace(/\/+$/, ""));
      }
    } catch {
      // Fallback stays as default
    }
  }, []);

  const baseUrl = `${originUrl}/v1`;

  // Filter endpoints according to search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ENDPOINT_CATEGORIES;

    return ENDPOINT_CATEGORIES.map((cat) => {
      const matched = cat.endpoints.filter((ep) => {
        return (
          ep.name.toLowerCase().includes(q) ||
          ep.path.toLowerCase().includes(q) ||
          ep.description.toLowerCase().includes(q) ||
          ep.protocol.toLowerCase().includes(q) ||
          ep.method.toLowerCase().includes(q)
        );
      });

      return {
        ...cat,
        endpoints: matched,
      };
    }).filter((cat) => cat.endpoints.length > 0);
  }, [searchQuery]);

  // Copy handler
  const handleCopy = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard", {
      description: text,
    });
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-7 pb-12">
        {/* Breadcrumb */}
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
                Endpoints
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-light text-foreground tracking-tight">
              Endpoints.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-light">
              Available proxy endpoints, multi-modal routes, and universal API base paths.
            </p>
          </div>

          {/* Copy Mode Toggle & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search endpoints or paths..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/20 rounded-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Segmented URL Toggle */}
            <div className="inline-flex p-0.5 rounded-lg border border-border/50 bg-secondary/50 text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCopyMode("full")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  copyMode === "full"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Full URL
              </button>
              <button
                type="button"
                onClick={() => setCopyMode("path")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  copyMode === "path"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Path Only
              </button>
            </div>
          </div>
        </div>

        {/* Base URL Master Card */}
        <Card className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/70 to-card/40 backdrop-blur-sm p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono uppercase font-semibold text-muted-foreground tracking-wider">
                  Universal Base URL
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono px-1.5 py-0.5 bg-secondary/60 border-border/60 text-foreground"
                >
                  v1
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border-blue-500/20"
                >
                  OpenAI &amp; Anthropic Ready
                </Badge>
              </div>

              {/* Code display */}
              <div className="flex items-center gap-2 pt-1">
                <code className="font-mono text-sm sm:text-base font-semibold text-foreground px-3 py-1.5 rounded-lg bg-secondary/70 border border-border/60 select-all tracking-tight break-all">
                  {baseUrl}
                </code>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(baseUrl, "master-base-url", "Base URL")}
                      className="h-9 px-3 gap-1.5 shrink-0 border-border/60 bg-background hover:bg-secondary transition-all"
                    >
                      {copiedId === "master-base-url" ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs font-medium text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">Copy</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Copy Universal Base URL</TooltipContent>
                </Tooltip>
              </div>

              <p className="text-xs text-muted-foreground font-light leading-relaxed pt-1">
                Configure this as the <code className="text-foreground/90 font-mono">base_url</code> in your SDKs or client applications. Authenticate using your Bearer API key in the <code className="text-foreground/90 font-mono">Authorization</code> header.
              </p>
            </div>

            {/* Quick API Key Action */}
            <div className="flex sm:flex-row lg:flex-col items-start lg:items-end justify-between lg:justify-center border-t lg:border-t-0 border-border/40 pt-4 lg:pt-0 gap-3">
              <Link href="/keys">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 p-0 hover:bg-transparent group"
                >
                  <Key className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span>Manage API Keys</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Catalog Categories */}
        {filteredCategories.length === 0 ? (
          <div className="p-12 rounded-2xl border border-dashed border-border/60 bg-card/40 flex items-center justify-center min-h-[300px]">
            <Empty className="p-0 border-none">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-secondary text-muted-foreground rounded-2xl p-3 mb-3">
                  <Search className="h-6 w-6 stroke-[1.5]" />
                </EmptyMedia>
                <EmptyTitle className="text-base font-medium font-sans text-foreground">
                  No endpoints found
                </EmptyTitle>
                <EmptyDescription className="text-xs text-muted-foreground font-light max-w-sm">
                  No endpoints matched your search query &ldquo;{searchQuery}&rdquo;. Try searching for another keyword or route.
                </EmptyDescription>
                <div className="pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="h-8 text-xs border-border/60"
                  >
                    Clear search
                  </Button>
                </div>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="space-y-9">
            {filteredCategories.map((category) => {
              const CategoryIcon = category.icon;
              return (
                <div key={category.id} className="space-y-3.5">
                  {/* Category Title & Icon */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-secondary/80 border border-border/50 text-muted-foreground">
                        <CategoryIcon className="h-3.5 w-3.5" />
                      </div>
                      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase font-mono">
                        {category.title}
                      </h2>
                    </div>
                    <span className="text-[11px] text-muted-foreground/70 font-mono">
                      {category.endpoints.length} endpoint{category.endpoints.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Grid of Endpoints */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {category.endpoints.map((endpoint) => {
                      const EndpointIcon = endpoint.icon;
                      const fullUrl = `${originUrl}${endpoint.path}`;
                      const displayPath = copyMode === "full" ? fullUrl : endpoint.path;
                      const copyText = copyMode === "full" ? fullUrl : endpoint.path;
                      const isCopied = copiedId === endpoint.id;

                      return (
                        <div
                          key={endpoint.id}
                          className="group relative flex flex-col justify-between rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 hover:border-border transition-all duration-200 p-4 shadow-2xs"
                        >
                          {/* Top: Icon + Title + Protocol Badge */}
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`p-2 rounded-lg border ${endpoint.iconBg} ${endpoint.iconColor} shrink-0 transition-transform group-hover:scale-105 duration-200`}
                                >
                                  <EndpointIcon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-sm font-medium text-foreground tracking-tight truncate">
                                    {endpoint.name}
                                  </h3>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span
                                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded tracking-wide uppercase ${
                                        endpoint.method === "POST"
                                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                          : "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                                      }`}
                                    >
                                      {endpoint.method}
                                    </span>
                                    <span className="text-[9px] font-mono text-muted-foreground/80 uppercase tracking-wider">
                                      {endpoint.protocol}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Copy Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleCopy(copyText, endpoint.id, endpoint.name)}
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/80 shrink-0 transition-colors"
                                  >
                                    {isCopied ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  Copy {copyMode === "full" ? "full URL" : "path"}
                                </TooltipContent>
                              </Tooltip>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-muted-foreground font-light leading-relaxed line-clamp-2">
                              {endpoint.description}
                            </p>
                          </div>

                          {/* Bottom: Monospace Path bar */}
                          <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(copyText, endpoint.id, endpoint.name)}
                              className="text-left font-mono text-[11px] text-muted-foreground/90 hover:text-foreground truncate transition-colors flex-1"
                              title={displayPath}
                            >
                              {displayPath}
                            </button>
                            <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0 select-none">
                              {copyMode === "full" ? "URL" : "PATH"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
