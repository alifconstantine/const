"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTER_ENDPOINTS } from "@/lib/api-contract";
import { Button, Input, toast, cn } from "@const/ui";
import { ArrowUpRight, Check, Copy, Search } from "lucide-react";

const DETAILS: Record<
  string,
  { response: string; auth: string; format: string }
> = {
  "/v1/chat/completions": {
    response: "Chat completion object or server-sent events when streaming",
    auth: "API key or session",
    format: "JSON → JSON / SSE",
  },
  "/v1/models": {
    response:
      "Model list; authenticated requests also return your active combos",
    auth: "Public · optional auth",
    format: "JSON",
  },
  "/v1/audio/transcriptions": {
    response: "Transcribed text in the requested response format",
    auth: "API key or session",
    format: "Multipart form → text / JSON",
  },
  "/v1/search": {
    response: "Search results with source URLs",
    auth: "API key or session",
    format: "JSON → JSON",
  },
  "/v1/fetch": {
    response: "Page title, extracted content, and discovered subpages",
    auth: "API key or session",
    format: "JSON → JSON",
  },
  "/v1/transcript": {
    response: "Video metadata, language, and timestamped transcript",
    auth: "API key or session",
    format: "JSON → JSON",
  },
};

export default function EndpointsPage() {
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [copied, setCopied] = useState<string | null>(null);
  const filtered = ROUTER_ENDPOINTS.filter(
    (endpoint) =>
      (method === "all" || endpoint.method === method) &&
      `${endpoint.name} ${endpoint.path} ${endpoint.description} ${endpoint.method}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      setCopied(path);
      toast.success("Endpoint URL copied");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy. Select the endpoint path to copy manually.");
    }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            API endpoints
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            One interface for chat, audio, search, and web content.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/docs">
            Read documentation <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </header>
      <section
        className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border bg-card px-5 py-5"
        aria-label="API authentication"
      >
        <div>
          <h2 className="text-sm font-medium">
            Authenticate with a bearer token
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use an active API key for execution endpoints. Model discovery is
            public.
          </p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <code className="whitespace-nowrap text-xs text-[var(--router-highlight)]">
            Authorization: Bearer YOUR_API_KEY
          </code>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search endpoints"
            className="h-10 bg-card pl-9"
            placeholder="Search name, path, or capability…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1" role="group" aria-label="HTTP method">
            {["all", "GET", "POST"].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={method === value}
                onClick={() => setMethod(value)}
                className={cn(
                  "rounded-md px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-ring",
                  method === value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "all" ? "All methods" : value}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {filtered.length} endpoints
          </span>
        </div>
      </div>
      <section
        className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
        aria-label="Endpoint reference"
      >
        {filtered.map((endpoint) => {
          const detail = DETAILS[endpoint.path]!;
          return (
            <article
              key={endpoint.path}
              className="grid gap-5 px-5 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:gap-10 sm:px-6"
            >
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 text-[10px] font-semibold",
                      endpoint.method === "GET"
                        ? "border-border text-foreground"
                        : "border-ring/20 bg-ring/5 text-[var(--router-highlight)]",
                    )}
                  >
                    {endpoint.method}
                  </span>
                  <code className="break-all text-sm">{endpoint.path}</code>
                </div>
                <h2 className="text-sm font-medium">{endpoint.name}</h2>
                <p className="mt-2 max-w-lg text-xs leading-6 text-muted-foreground">
                  {endpoint.description}
                </p>
              </div>
              <div className="flex flex-col items-start justify-between gap-4">
                <dl className="space-y-3 text-xs">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <dt className="text-muted-foreground">Authentication</dt>
                    <dd>{detail.auth}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Response</dt>
                    <dd className="mt-1.5 leading-5">{detail.response}</dd>
                  </div>
                  <div className="text-muted-foreground">
                    <dt className="sr-only">Format</dt>
                    <dd>{detail.format}</dd>
                  </div>
                </dl>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 gap-2 text-xs"
                  onClick={() => copy(endpoint.path)}
                  aria-label={`Copy URL for ${endpoint.name}`}
                >
                  {copied === endpoint.path ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied === endpoint.path ? "Copied" : "Copy endpoint URL"}
                </Button>
              </div>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="px-5 py-14 text-center">
            <h2 className="text-sm font-medium">No matching endpoints</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Try a capability such as chat, audio, or search.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={() => {
                setSearch("");
                setMethod("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          Copy a full URL for this deployment, then add your API key.
        </p>
        <Link
          href="/keys"
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:text-[var(--router-highlight)]"
        >
          Manage API keys <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
