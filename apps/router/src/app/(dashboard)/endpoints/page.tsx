"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTER_ENDPOINTS } from "@/lib/api-contract";
import { Button, Input, Badge, toast } from "@const/ui";
import { Copy, Search, Terminal } from "lucide-react";

export default function EndpointsPage() {
  const [search, setSearch] = useState("");

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      toast.success("Endpoint copied");
    } catch {
      toast.error("Could not access clipboard");
    }
  }

  const filtered = ROUTER_ENDPOINTS.filter((e) =>
    (e.name + e.path + e.description).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-6xl mx-auto space-y-7 pb-12">
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
          Endpoints
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Available APIs on Const Router. All execution endpoints require an active key or session.
        </p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          aria-label="Search endpoints"
          className="pl-9 h-9 text-xs rounded-xl bg-card border-border/60"
          placeholder="Filter by name, path, or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((endpoint) => (
          <div
            key={endpoint.path}
            className="bg-card rounded-xl border border-border/60 p-5 flex flex-col justify-between gap-4 transition-colors hover:border-border"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-foreground">{endpoint.name}</span>
                <Badge
                  variant="secondary"
                  className="font-mono text-[10px] px-2 py-0.5 uppercase tracking-wide"
                >
                  {endpoint.method}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {endpoint.description}
              </p>
            </div>

            <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <code className="text-[11px] font-mono text-muted-foreground truncate" title={endpoint.path}>
                {endpoint.path}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1.5"
                onClick={() => copy(endpoint.path)}
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </Button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center text-sm text-muted-foreground bg-card rounded-xl border border-border/60">
            No endpoints match your search.
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border/40">
        <p className="text-xs text-muted-foreground">
          OpenAI-compatible chat completions and transcription pass through with native telemetry.
        </p>
        <Button asChild variant="outline" size="sm" className="rounded-lg">
          <Link href="/docs">View API documentation</Link>
        </Button>
      </div>
    </div>
  );
}
