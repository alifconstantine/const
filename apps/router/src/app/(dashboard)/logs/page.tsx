"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { QueryBoundary } from "@/components/query-boundary";
import {
  Button,
  Input,
  Badge,
  ScrollArea,
  Dialog,
  DialogContent,
  DialogTitle,
  toast,
  cn,
} from "@const/ui";
import type { Doc } from "@const/backend/_generated/dataModel";
import { Search, X, Check, Copy } from "lucide-react";

function Logs() {
  const { isAuthenticated } = useRouterAuth();
  const [range, setRange] = useState("today");
  const [tier, setTier] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Doc<"routerLogs"> | null>(null);

  const logs = usePaginatedQuery(
    api.router.logs.paginateLogs,
    isAuthenticated
      ? {
          timeRange: range,
          tier,
          statusFilter: status,
          searchQuery: query || undefined,
        }
      : "skip",
    { initialNumItems: 30 },
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
      toast.success("Request details copied");
    } catch {
      toast.error("Could not access clipboard");
    }
  }

  const tierOptions = [
    { id: "all", label: "All tiers" },
    { id: "free", label: "Free" },
    { id: "paid", label: "Paid" },
  ];

  const statusOptions = [
    { id: "all", label: "All status" },
    { id: "success", label: "Success" },
    { id: "errors", label: "Errors" },
  ];

  const rangeOptions = [
    { id: "today", label: "24h" },
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
    { id: "all", label: "All time" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-serif font-normal text-foreground tracking-tight">Usage logs</h1>
        <p className="text-sm text-muted-foreground">
          Detailed request telemetry, token consumption, and settled micro-costs.
        </p>
      </header>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
          className="flex gap-2 flex-1 max-w-lg"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              aria-label="Search usage logs"
              placeholder="Search by model, API key, or Request ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 rounded-xl bg-card border-border/60 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setQuery("");
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" variant="outline" size="sm" className="rounded-xl px-4">
            Search
          </Button>
        </form>

        {/* Filter Controls (Segmented groups) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-full">
          {/* Tier Selector */}
          <div className="flex items-center gap-0.5 bg-secondary/50 p-1 rounded-xl border border-border/50">
            {tierOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTier(opt.id)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                  tier === opt.id
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Status Selector */}
          <div className="flex items-center gap-0.5 bg-secondary/50 p-1 rounded-xl border border-border/50">
            {statusOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatus(opt.id)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                  status === opt.id
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Range Selector */}
          <div className="flex items-center gap-0.5 bg-secondary/50 p-1 rounded-xl border border-border/50">
            {rangeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                  range === opt.id
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {query && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>Active filter: <code className="text-foreground font-mono">{query}</code></span>
          <button
            type="button"
            className="underline hover:text-foreground cursor-pointer"
            onClick={() => {
              setQuery("");
              setSearch("");
            }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Logs View: Responsive Mobile Cards + Desktop Table */}
      <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
        {/* Mobile Cards (sm:hidden) */}
        <div className="divide-y divide-border/40 sm:hidden">
          {logs.results.map((log) => (
            <div
              key={log._id}
              onClick={() => setSelected(log)}
              className="p-3.5 space-y-2.5 hover:bg-secondary/20 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-semibold text-xs text-foreground truncate">
                    {log.model}
                  </p>
                  {log.resolvedModel && log.resolvedModel !== log.model && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      &rarr; {log.resolvedModel}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                    {log.requestId}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="font-mono text-[9px] px-1.5 py-0">
                    {log.billingTier ?? "Legacy"}
                  </Badge>
                  <Badge
                    variant={log.status >= 400 ? "destructive" : "secondary"}
                    className="font-mono text-[9px] px-1.5 py-0"
                  >
                    {log.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/30 text-[11px] font-mono">
                <div>
                  <span className="text-[9px] text-muted-foreground uppercase block">Tokens</span>
                  <span className="text-foreground">
                    {(log.promptTokens + log.completionTokens).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground uppercase block">Cost</span>
                  <span className="text-foreground font-medium">
                    {log.costNanoUsd === undefined
                      ? "—"
                      : "$" + (log.costNanoUsd / 1e9).toFixed(5)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground uppercase block">Duration</span>
                  <span className="text-muted-foreground">
                    {(log.durationMs / 1000).toFixed(2)}s
                  </span>
                </div>
              </div>

              <div className="text-[10px] font-mono text-muted-foreground/80 flex items-center justify-between">
                <span>{new Date(log.createdAt).toLocaleString()}</span>
                <span className="text-primary text-[10px] font-sans">Tap for JSON &rarr;</span>
              </div>
            </div>
          ))}

          {logs.results.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-xs">
              {logs.status === "LoadingFirstPage"
                ? "Loading usage logs…"
                : "No requests match the selected filters."}
            </div>
          )}
        </div>

        {/* Desktop Table (hidden sm:block) */}
        <div className="hidden sm:block">
          <ScrollArea orientation="horizontal">
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead className="text-muted-foreground bg-secondary/40 border-b border-border/40">
                <tr>
                  {[
                    "Model & Request",
                    "Tier",
                    "Status",
                    "Input / Cached",
                    "Output",
                    "Cost",
                    "Duration",
                    "Timestamp",
                  ].map((v) => (
                    <th key={v} className="px-5 py-3.5 font-normal">
                      {v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs.results.map((log) => {
                  return (
                    <tr
                      key={log._id}
                      className="hover:bg-secondary/20 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelected(log)}
                            className="text-left group cursor-pointer"
                          >
                            <p className="font-mono font-medium text-foreground group-hover:underline">
                              {log.model}
                            </p>
                            {log.resolvedModel && log.resolvedModel !== log.model && (
                              <p className="text-[11px] text-muted-foreground">
                                &rarr; {log.resolvedModel}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">
                              {log.requestId}
                            </p>
                          </button>
                        </div>
                      </td>

                      <td className="p-4">
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {log.billingTier ?? "Legacy"}
                        </Badge>
                      </td>

                      <td className="p-4">
                        <Badge
                          variant={log.status >= 400 ? "destructive" : "secondary"}
                          className="font-mono text-[10px]"
                        >
                          {log.status}
                        </Badge>
                      </td>

                      <td className="p-4 tabular-nums font-mono">
                        <span>{log.promptTokens.toLocaleString()}</span>
                        {log.cachedTokens ? (
                          <span className="text-muted-foreground ml-1">
                            ({log.cachedTokens.toLocaleString()})
                          </span>
                        ) : null}
                      </td>

                      <td className="p-4 tabular-nums font-mono">
                        <span>{log.completionTokens.toLocaleString()}</span>
                        {log.usageEstimated && (
                          <span className="block text-[10px] text-muted-foreground">Estimated</span>
                        )}
                      </td>

                      <td className="p-4 tabular-nums font-mono font-medium">
                        {log.costNanoUsd === undefined
                          ? "—"
                          : "$" + (log.costNanoUsd / 1e9).toFixed(6)}
                      </td>

                      <td className="p-4 font-mono text-muted-foreground">
                        {(log.durationMs / 1000).toFixed(2)}s
                      </td>

                      <td className="p-4 text-muted-foreground font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}

                {logs.results.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-12 text-center text-muted-foreground text-xs"
                    >
                      {logs.status === "LoadingFirstPage"
                        ? "Loading usage logs…"
                        : "No requests match the selected filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-between items-center gap-3 pt-2">
        <p className="text-xs text-muted-foreground">
          Showing {logs.results.length} requests. Token reports reflect provider reports.
        </p>
        {logs.status !== "Exhausted" && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={logs.status !== "CanLoadMore"}
            onClick={() => logs.loadMore(30)}
          >
            {logs.status === "LoadingMore" ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>

      {/* Request Details Dialog */}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl bg-card border-border/70 rounded-2xl p-5 sm:p-6">
          <DialogTitle className="text-base font-medium">Request Telemetry</DialogTitle>
          <ScrollArea orientation="both" className="max-h-[60vh] bg-secondary/30 rounded-lg p-3">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify(selected, null, 2)}
            </pre>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={copy} variant="outline" size="sm" className="gap-1.5 rounded-lg">
              <Copy className="h-3.5 w-3.5" />
              <span>Copy JSON</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LogsPage() {
  return (
    <QueryBoundary name="Usage logs">
      <Logs />
    </QueryBoundary>
  );
}
