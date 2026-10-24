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
} from "@const/ui";
import type { Doc } from "@const/backend/_generated/dataModel";
function Logs() {
  const { isAuthenticated } = useRouterAuth();
  const [range, setRange] = useState("today"),
    [tier, setTier] = useState("all"),
    [status, setStatus] = useState("all"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
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
  const selectStyle = "rounded-xl bg-secondary px-3 py-2 text-xs";
  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
      toast.success("Request details copied");
    } catch {
      toast.error("Could not access clipboard");
    }
  }
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-3xl font-medium tracking-tight">Usage logs</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Actual requests, free allowance usage, and paid costs.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
          className="flex gap-2 flex-1 min-w-64"
        >
          <Input
            aria-label="Search usage logs"
            placeholder="Search models, keys, or a full request ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <select
          aria-label="Usage tier"
          className={selectStyle}
          value={tier}
          onChange={(e) => setTier(e.target.value)}
        >
          <option value="all">Free & paid</option>
          <option value="free">Free usage</option>
          <option value="paid">Paid usage</option>
        </select>
        <select
          aria-label="Request status"
          className={selectStyle}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="errors">Errors</option>
        </select>
        <select
          aria-label="Time range"
          className={selectStyle}
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="today">Last 24 hours</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="all">All time</option>
        </select>
      </div>
      {query && (
        <div className="text-xs text-muted-foreground">
          Search: {query}{" "}
          <button
            className="underline ml-3"
            onClick={() => {
              setQuery("");
              setSearch("");
            }}
          >
            Clear
          </button>
        </div>
      )}
      <div className="rounded-2xl bg-card overflow-hidden">
        <ScrollArea orientation="horizontal">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="text-muted-foreground bg-secondary/30">
              <tr>
                {[
                  "Model & request",
                  "Tier",
                  "Status",
                  "Input / cached",
                  "Output",
                  "Cost",
                  "Duration",
                  "Date",
                ].map((v) => (
                  <th key={v} className="px-4 py-4 font-normal">
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.results.map((log) => (
                <tr
                  key={log._id}
                  className="border-t border-border/40 hover:bg-secondary/30"
                >
                  <td className="p-4">
                    <button
                      onClick={() => setSelected(log)}
                      className="text-left hover:underline"
                    >
                      <p className="font-mono">{log.model}</p>
                      {log.resolvedModel && log.resolvedModel !== log.model && (
                        <p className="text-muted-foreground mt-1">
                          {log.resolvedModel}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {log.requestId}
                      </p>
                    </button>
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary">
                      {log.billingTier ?? "Legacy"}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={log.status >= 400 ? "destructive" : "secondary"}
                    >
                      {log.status}
                    </Badge>
                  </td>
                  <td className="p-4 tabular-nums">
                    {log.promptTokens.toLocaleString()} /{" "}
                    {(log.cachedTokens ?? 0).toLocaleString()}
                  </td>
                  <td className="p-4 tabular-nums">
                    {log.completionTokens.toLocaleString()}
                    {log.usageEstimated && (
                      <p className="text-muted-foreground mt-1">Estimated</p>
                    )}
                  </td>
                  <td className="p-4 tabular-nums">
                    {log.costNanoUsd === undefined
                      ? "Not recorded"
                      : "$" + (log.costNanoUsd / 1e9).toFixed(6)}
                  </td>
                  <td className="p-4">{(log.durationMs / 1000).toFixed(2)}s</td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.results.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="p-12 text-center text-muted-foreground"
                  >
                    {logs.status === "LoadingFirstPage"
                      ? "Loading usage…"
                      : "No requests match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </div>
      <div className="flex justify-between gap-3 items-center">
        <p className="text-xs text-muted-foreground">
          {logs.results.length} requests loaded. Cached tokens are part of
          input; free requests count input plus output.
        </p>
        {logs.status !== "Exhausted" && (
          <Button
            variant="outline"
            disabled={logs.status !== "CanLoadMore"}
            onClick={() => logs.loadMore(30)}
          >
            {logs.status === "LoadingMore" ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogTitle>Request details</DialogTitle>
          <ScrollArea orientation="both" className="max-h-[60vh]">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all p-3">
              {JSON.stringify(selected, null, 2)}
            </pre>
          </ScrollArea>
          <Button onClick={copy} variant="outline">
            Copy JSON
          </Button>
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
