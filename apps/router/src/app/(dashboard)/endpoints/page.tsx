"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  cn,
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
  X,
} from "lucide-react";

interface EndpointItem {
  id: string;
  name: string;
  path: string;
  method: "POST" | "GET";
  protocol?: "OPENAI" | "ANTHROPIC" | "UNIVERSAL";
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

interface EndpointCategory {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  endpoints: EndpointItem[];
}

const ENDPOINT_CATEGORIES: EndpointCategory[] = [
  {
    id: "core",
    title: "CORE APIS",
    icon: Cpu,
    iconColor: "text-rose-500",
    endpoints: [
      {
        id: "chat-completions",
        name: "Chat Completions",
        path: "/v1/chat/completions",
        method: "POST",
        protocol: "OPENAI",
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
        icon: Bot,
        iconBg: "bg-amber-500/10 border-amber-500/20",
        iconColor: "text-amber-500",
      },
    ],
  },
  {
    id: "media",
    title: "MEDIA & MULTI-MODAL",
    icon: Layers,
    iconColor: "text-purple-500",
    endpoints: [
      {
        id: "embeddings",
        name: "Embeddings",
        path: "/v1/embeddings",
        method: "POST",
        protocol: "OPENAI",
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
        icon: Video,
        iconBg: "bg-red-500/10 border-red-500/20",
        iconColor: "text-red-500",
      },
    ],
  },
  {
    id: "search",
    title: "SEARCH & DISCOVERY",
    icon: Search,
    iconColor: "text-cyan-500",
    endpoints: [
      {
        id: "web-search",
        name: "Web Search",
        path: "/v1/search",
        method: "POST",
        protocol: "UNIVERSAL",
        icon: Search,
        iconBg: "bg-cyan-500/10 border-cyan-500/20",
        iconColor: "text-cyan-500",
      },
    ],
  },
  {
    id: "utility",
    title: "MODELS & UTILITY",
    icon: ListFilter,
    iconColor: "text-emerald-500",
    endpoints: [
      {
        id: "list-models",
        name: "List Models",
        path: "/v1/models",
        method: "GET",
        protocol: "OPENAI",
        icon: ListFilter,
        iconBg: "bg-emerald-500/10 border-emerald-500/20",
        iconColor: "text-emerald-500",
      },
    ],
  },
];

export default function EndpointsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const originUrl = "https://router.const.web.id";
  const baseUrl = "https://router.const.web.id/v1";
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter endpoints according to search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ENDPOINT_CATEGORIES;

    return ENDPOINT_CATEGORIES.map((cat) => {
      const matched = cat.endpoints.filter((ep) => {
        return (
          ep.name.toLowerCase().includes(q) ||
          ep.path.toLowerCase().includes(q) ||
          (ep.protocol && ep.protocol.toLowerCase().includes(q)) ||
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
  const handleCopy = (text: string, id: string) => {
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
      <div className="space-y-6 pb-12">
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
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-serif font-light text-foreground tracking-tight">
            Endpoints.
          </h1>
        </div>

        {/* Top Controls: Minimal Base URL Bar + Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Base URL Bar */}
          <div className="flex-1 flex items-center justify-between gap-3 h-10 px-3.5 rounded-xl border border-border bg-secondary/50 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider shrink-0">
                BASE URL
              </span>
              <code className="text-xs font-mono text-foreground font-medium truncate select-all">
                {baseUrl}
              </code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(baseUrl, "master-base-url")}
              className="h-7 px-2.5 gap-1.5 shrink-0 text-xs text-muted-foreground hover:text-foreground hover:bg-card/60 rounded-lg transition-colors"
            >
              {copiedId === "master-base-url" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-500 text-[11px] font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </Button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-[280px] shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search endpoints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 h-10 rounded-xl bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Catalog Categories */}
        {filteredCategories.length === 0 ? (
          <div className="p-12 rounded-xl border border-dashed border-border/50 bg-card/30 flex items-center justify-center min-h-[260px]">
            <Empty className="p-0 border-none">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-secondary text-muted-foreground rounded-2xl p-3 mb-3">
                  <Search className="h-6 w-6 stroke-[1.5]" />
                </EmptyMedia>
                <EmptyTitle className="text-base font-medium font-sans text-foreground">
                  No endpoints found
                </EmptyTitle>
                <EmptyDescription className="text-xs text-muted-foreground font-light max-w-sm">
                  No endpoints matched your search &ldquo;{searchQuery}&rdquo;.
                </EmptyDescription>
                <div className="pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="h-8 text-xs border-border/50"
                  >
                    Clear search
                  </Button>
                </div>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredCategories.map((category) => {
              const CategoryIcon = category.icon;
              return (
                <div key={category.id} className="space-y-3">
                  {/* Category Title & Icon */}
                  <div className="flex items-center gap-2">
                    <CategoryIcon className={cn("h-3.5 w-3.5", category.iconColor)} />
                    <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase font-mono">
                      {category.title}
                    </h2>
                  </div>

                  {/* Grid of Endpoints */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {category.endpoints.map((endpoint) => {
                      const EndpointIcon = endpoint.icon;
                      const fullUrl = `${originUrl}${endpoint.path}`;
                      const isCopied = copiedId === endpoint.id;

                      return (
                        <div
                          key={endpoint.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card/40 hover:bg-card/75 hover:border-border/70 transition-all group min-w-0"
                        >
                          {/* Left: Icon + Title & Path */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={cn(
                                "p-2 rounded-lg shrink-0 flex items-center justify-center border",
                                endpoint.iconBg,
                                endpoint.iconColor
                              )}
                            >
                              <EndpointIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                                  {endpoint.name}
                                </span>
                                {endpoint.protocol === "ANTHROPIC" && (
                                  <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border/40 shrink-0">
                                    ANTHROPIC
                                  </span>
                                )}
                              </div>
                              <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
                                {endpoint.path}
                              </p>
                            </div>
                          </div>

                          {/* Right: Copy Button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopy(fullUrl, endpoint.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0 ml-1.5"
                              >
                                {isCopied ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Copy URL</TooltipContent>
                          </Tooltip>
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

