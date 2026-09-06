"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
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
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
  SheetDescription,
  Skeleton,
  toast,
} from "@const/ui";
import {
  Search,
  Copy,
  Check,
  RefreshCw,
  RotateCcw,
  Zap,
  Clock,
  Gauge,
  ScrollText,
  ChevronRight,
  X,
  Code2,
  Key,
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

function formatTokens(tokens?: number): string {
  if (tokens === undefined || tokens === null) return "0";
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return "0ms";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LogsPage() {
  const { isAuthenticated } = useRouterAuth();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("today");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Queries from Convex
  const logs = useQuery(
    api.router.logs.listLogs,
    isAuthenticated
      ? {
          statusFilter,
          timeRange,
          searchQuery: searchQuery.trim() || undefined,
        }
      : "skip"
  );

  const metrics = useQuery(
    api.router.logs.getLogMetrics,
    isAuthenticated ? { timeRange } : "skip"
  );

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Request ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyRawJson = () => {
    if (!selectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
    setCopiedJson(true);
    toast.success("Telemetry JSON copied to clipboard");
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTimeRange("today");
  };

  const isLoading = logs === undefined && isAuthenticated;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-7 pb-12">
        {/* 1. Breadcrumb: Dashboard > Logs */}
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
                Request Logs
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* 2. Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
              Request Logs.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-light">
              Real-time request audit trails, latency metrics, and token telemetry across your AI gateway.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="rounded-full text-xs h-9 px-3 gap-1.5 border-border/70 cursor-pointer hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Reset all filters"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          </div>
        </div>

        {/* 3. Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Total Requests */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans font-medium text-muted-foreground uppercase tracking-wider">
                Total Requests
              </span>
              <div className="h-7 w-7 rounded-xl bg-secondary flex items-center justify-center text-foreground">
                <ScrollText className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-sans font-semibold text-foreground tracking-tight tabular-nums">
              {metrics?.totalRequests ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground font-sans">
              Success Rate: <span className="text-foreground font-sans font-medium tabular-nums">{metrics?.successRate ?? 100}%</span>
            </p>
          </Card>

          {/* Metric 2: Total Tokens */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans font-medium text-muted-foreground uppercase tracking-wider">
                Tokens Processed
              </span>
              <div className="h-7 w-7 rounded-xl bg-secondary flex items-center justify-center text-foreground">
                <Database className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-sans font-semibold text-foreground tracking-tight tabular-nums">
              {formatTokens(metrics?.totalTokens)}
            </div>
            <p className="text-[11px] text-muted-foreground font-sans">
              Prompt: <span className="tabular-nums">{formatTokens(metrics?.promptTokens)}</span> · Out: <span className="tabular-nums">{formatTokens(metrics?.completionTokens)}</span>
            </p>
          </Card>

          {/* Metric 3: Avg TTFT */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans font-medium text-muted-foreground uppercase tracking-wider">
                Average TTFT
              </span>
              <div className="h-7 w-7 rounded-xl bg-secondary flex items-center justify-center text-foreground">
                <Clock className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-sans font-semibold text-foreground tracking-tight tabular-nums">
              {formatDuration(metrics?.avgTtftMs)}
            </div>
            <p className="text-[11px] text-muted-foreground font-sans">
              Avg Duration: <span className="text-foreground font-sans font-medium tabular-nums">{formatDuration(metrics?.avgDurationMs)}</span>
            </p>
          </Card>

          {/* Metric 4: Generation Speed & Mini Chart */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans font-medium text-muted-foreground uppercase tracking-wider">
                Avg Generation Speed
              </span>
              <div className="h-7 w-7 rounded-xl bg-secondary flex items-center justify-center text-foreground">
                <Gauge className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-sans font-semibold text-foreground tracking-tight tabular-nums">
              {metrics?.avgSpeed ?? 0} <span className="text-xs font-sans font-normal text-muted-foreground">tok/s</span>
            </div>
            {/* 24-bucket mini activity bar chart */}
            <div className="flex items-end gap-1 h-5 pt-1">
              {metrics?.activityBuckets && metrics.activityBuckets.length > 0 ? (
                metrics.activityBuckets.map((b: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex-1 bg-foreground/20 hover:bg-foreground transition-all rounded-sm"
                    style={{ height: `${Math.max(15, b.heightPercent)}%` }}
                    title={`${b.count} requests`}
                  />
                ))
              ) : (
                <div className="text-[10px] text-muted-foreground font-sans">No recent activity</div>
              )}
            </div>
          </Card>
        </div>

        {/* 4. Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input (Broad on the left, matching NaraRouter) */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by request id or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 h-10 rounded-xl bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground font-sans outline-none focus:outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns on the Right (Compact) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[130px] rounded-xl bg-secondary/50 border-border text-xs font-sans text-foreground shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover text-xs font-sans">
                <SelectItem value="all" className="cursor-pointer">
                  All Status
                </SelectItem>
                <SelectItem value="200" className="cursor-pointer">
                  Success (200)
                </SelectItem>
                <SelectItem value="errors" className="cursor-pointer">
                  Errors (4xx / 5xx)
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-10 w-[140px] rounded-xl bg-secondary/50 border-border text-xs font-sans text-foreground shrink-0">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover text-xs font-sans">
                <SelectItem value="today" className="cursor-pointer">
                  Today (24h)
                </SelectItem>
                <SelectItem value="7d" className="cursor-pointer">
                  Past 7 Days
                </SelectItem>
                <SelectItem value="30d" className="cursor-pointer">
                  Past 30 Days
                </SelectItem>
                <SelectItem value="all" className="cursor-pointer">
                  All Time
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 5. Logs Table (OpenRouter Inspired Balanced Spacing) */}
        <Card className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-none transition-all">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/20">
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="w-[140px] pl-5 pr-3 text-xs font-sans font-medium text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="w-[130px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    Request ID
                  </TableHead>
                  <TableHead className="w-[160px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    Model
                  </TableHead>
                  <TableHead className="w-[110px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    Provider
                  </TableHead>
                  <TableHead className="w-[75px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    Combo
                  </TableHead>
                  <TableHead className="w-[95px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    Input
                  </TableHead>
                  <TableHead className="w-[90px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    Output
                  </TableHead>
                  <TableHead className="w-[105px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    Speed
                  </TableHead>
                  <TableHead className="w-[85px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    TTFT
                  </TableHead>
                  <TableHead className="w-[90px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    Duration
                  </TableHead>
                  <TableHead className="w-[130px] px-3 text-xs font-sans font-medium text-muted-foreground">
                    API Key
                  </TableHead>
                  <TableHead className="w-[80px] pl-3 pr-5 text-right text-xs font-sans font-medium text-muted-foreground">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-border/50 hover:bg-transparent">
                      <TableCell className="py-3 pl-5 pr-3">
                        <Skeleton className="h-4 w-20 rounded font-mono" />
                      </TableCell>
                      <TableCell className="px-3">
                        <Skeleton className="h-4 w-20 rounded font-mono" />
                      </TableCell>
                      <TableCell className="px-3">
                        <Skeleton className="h-4 w-28 rounded" />
                      </TableCell>
                      <TableCell className="px-3">
                        <Skeleton className="h-4 w-20 rounded" />
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Skeleton className="h-4 w-12 rounded ml-auto" />
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Skeleton className="h-4 w-12 rounded ml-auto" />
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Skeleton className="h-4 w-14 rounded ml-auto" />
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Skeleton className="h-4 w-14 rounded ml-auto" />
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Skeleton className="h-4 w-12 rounded ml-auto" />
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Skeleton className="h-4 w-14 rounded ml-auto" />
                      </TableCell>
                      <TableCell className="px-3">
                        <Skeleton className="h-4 w-20 rounded font-mono" />
                      </TableCell>
                      <TableCell className="pl-3 pr-5 text-right">
                        <Skeleton className="h-5 w-14 rounded-full ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !logs || logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-16 text-center">
                      <div className="space-y-2 max-w-sm mx-auto">
                        <ScrollText className="h-8 w-8 mx-auto text-muted-foreground/60 stroke-[1.5]" />
                        <h3 className="text-sm font-medium text-foreground font-sans">
                          No requests recorded yet
                        </h3>
                        <p className="text-xs text-muted-foreground font-light leading-relaxed">
                          Requests executed via <code className="text-foreground font-mono">/v1/chat/completions</code> or the <Link href="/generation" className="underline hover:text-foreground">Generation Studio</Link> will stream into this audit trail in real-time.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const isSuccess = log.status >= 200 && log.status < 300;
                    const shortId = log.requestId.length > 14
                      ? `${log.requestId.slice(0, 10)}...`
                      : log.requestId;

                    return (
                      <TableRow
                        key={log._id}
                        onClick={() => setSelectedLog(log)}
                        className="border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer group"
                      >
                        {/* 1. Date */}
                        <TableCell className="py-3 pl-5 pr-3 whitespace-nowrap text-xs font-sans text-muted-foreground tabular-nums">
                          {formatDate(log.createdAt)}
                        </TableCell>

                        {/* 2. Request ID */}
                        <TableCell className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-sans text-xs text-foreground/90">
                            <span>{shortId}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(log.requestId, e)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity cursor-pointer"
                              title="Copy full Request ID"
                            >
                              {copiedId === log.requestId ? (
                                <Check className="h-3 w-3 text-foreground" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        {/* 3. Model */}
                        <TableCell className="py-3 px-3 whitespace-nowrap">
                          <span className="text-xs font-medium font-sans text-foreground">
                            {log.model}
                          </span>
                        </TableCell>

                        {/* 4. Provider */}
                        <TableCell className="py-3 px-3 whitespace-nowrap text-xs font-sans text-muted-foreground">
                          {log.provider}
                        </TableCell>

                        {/* 5. Combo (empty / dash for non-combo) */}
                        <TableCell className="py-3 px-3 whitespace-nowrap text-xs font-sans text-muted-foreground">
                          {log.comboName || "—"}
                        </TableCell>

                        {/* 6. Input Tokens (with cached subtext if any) */}
                        <TableCell className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-sans font-medium text-foreground tabular-nums">
                              {formatTokens(log.promptTokens)}
                            </span>
                            {log.cachedTokens && log.cachedTokens > 0 ? (
                              <span className="text-[10px] font-sans text-muted-foreground tabular-nums">
                                +{formatTokens(log.cachedTokens)} cache
                              </span>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* 7. Output Tokens */}
                        <TableCell className="py-3 px-3 whitespace-nowrap text-xs font-sans font-medium text-foreground tabular-nums">
                          {formatTokens(log.completionTokens)}
                        </TableCell>

                        {/* 8. Speed (tok/s) */}
                        <TableCell className="py-3 px-3 whitespace-nowrap text-xs font-sans text-foreground tabular-nums">
                          {log.tokensPerSecond ? `${log.tokensPerSecond} tok/s` : "—"}
                        </TableCell>

                        {/* 9. TTFT */}
                        <TableCell className="py-3 px-3 whitespace-nowrap text-xs font-sans text-foreground tabular-nums">
                          {formatDuration(log.ttftMs)}
                        </TableCell>

                        {/* 10. Duration */}
                        <TableCell className="py-3 px-3 whitespace-nowrap text-xs font-sans text-muted-foreground tabular-nums">
                          {formatDuration(log.durationMs)}
                        </TableCell>

                        {/* 11. API Key */}
                        <TableCell className="py-3 px-3 whitespace-nowrap text-xs font-sans text-muted-foreground">
                          <span className="truncate max-w-[120px] inline-block font-normal">
                            {log.keyName || "Default"}
                          </span>
                        </TableCell>

                        {/* 12. Status */}
                        <TableCell className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                          <Badge
                            variant="secondary"
                            className={`rounded-md font-sans font-medium text-[11px] tabular-nums px-2 py-0.5 border ${
                              isSuccess
                                ? "bg-secondary text-foreground border-border"
                                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                            }`}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* 6. Slide-Over Detail Drawer (Portal Sheet above header) */}
        <Sheet
          open={!!selectedLog}
          onOpenChange={(open) => {
            if (!open) setSelectedLog(null);
          }}
        >
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-full sm:max-w-[560px] md:max-w-[620px] p-0 flex flex-col bg-card border-l border-border/70 shadow-2xl z-50 gap-0"
          >
            {selectedLog && (
              <>
                {/* Drawer Header */}
                <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center border border-border/70 text-foreground shrink-0">
                      <Code2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="font-sans text-base sm:text-lg font-semibold text-foreground truncate text-left">
                        Request Telemetry
                      </SheetTitle>
                      <SheetDescription className="text-xs font-mono text-muted-foreground truncate text-left">
                        {selectedLog.requestId}
                      </SheetDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyRawJson}
                      className="h-8 rounded-full text-xs font-medium gap-1.5 border-border/70 cursor-pointer hover:bg-secondary"
                    >
                      {copiedJson ? (
                        <Check className="h-3.5 w-3.5 text-foreground" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedJson ? "Copied" : "Copy JSON"}</span>
                    </Button>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                        aria-label="Close telemetry panel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </SheetClose>
                  </div>
                </div>

                {/* Drawer Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 select-text">
                  {/* Status & Timing Highlight */}
                  <div className="p-4 rounded-2xl bg-secondary/30 border border-border/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedLog.status >= 200 && selectedLog.status < 300 ? (
                        <CheckCircle2 className="h-5 w-5 text-foreground stroke-[2]" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500 stroke-[2]" />
                      )}
                      <div>
                        <div className="text-sm font-semibold font-sans text-foreground">
                          HTTP {selectedLog.status} {selectedLog.status === 200 ? "OK" : "Error"}
                        </div>
                        <div className="text-xs text-muted-foreground font-sans">
                          {new Date(selectedLog.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-sans font-semibold text-foreground tabular-nums">
                        {formatDuration(selectedLog.durationMs)}
                      </div>
                      <div className="text-xs font-sans text-muted-foreground">
                        Duration
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics Breakdown */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                      Performance Breakdown
                    </span>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
                        <div className="text-xs text-muted-foreground font-sans">TTFT</div>
                        <div className="text-sm font-sans font-semibold text-foreground mt-0.5 tabular-nums">
                          {formatDuration(selectedLog.ttftMs)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
                        <div className="text-xs text-muted-foreground font-sans">Speed</div>
                        <div className="text-sm font-sans font-semibold text-foreground mt-0.5 tabular-nums">
                          {selectedLog.tokensPerSecond ? `${selectedLog.tokensPerSecond} tok/s` : "—"}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
                        <div className="text-xs text-muted-foreground font-sans">Total Tokens</div>
                        <div className="text-sm font-sans font-semibold text-foreground mt-0.5 tabular-nums">
                          {formatTokens(selectedLog.totalTokens)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Token Accounting */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                      Token Accounting
                    </span>
                    <div className="p-4 rounded-2xl bg-secondary/20 border border-border/60 space-y-2.5 font-sans text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Input / Prompt Tokens</span>
                        <span className="font-sans font-medium text-foreground tabular-nums">{selectedLog.promptTokens}</span>
                      </div>
                      {selectedLog.cachedTokens ? (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Prompt Cache Hit</span>
                          <span className="font-sans font-medium text-foreground tabular-nums">{selectedLog.cachedTokens}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Output / Completion Tokens</span>
                        <span className="font-sans font-medium text-foreground tabular-nums">{selectedLog.completionTokens}</span>
                      </div>
                      <div className="pt-2 border-t border-border/60 flex justify-between items-center font-semibold">
                        <span className="text-foreground">Total Tokens</span>
                        <span className="font-sans font-semibold text-foreground tabular-nums">{selectedLog.totalTokens}</span>
                      </div>
                    </div>
                  </div>

                  {/* Routing & Identity */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                      Routing &amp; Client Identity
                    </span>
                    <div className="p-4 rounded-2xl bg-secondary/20 border border-border/60 space-y-2.5 font-sans text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Model Name</span>
                        <span className="font-medium text-foreground">{selectedLog.model}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Provider</span>
                        <span className="font-medium text-foreground">{selectedLog.provider}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Combo Router</span>
                        <span className="font-medium text-foreground">{selectedLog.comboName || "Direct (None)"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">API Key Used</span>
                        <span className="font-medium text-foreground font-mono">{selectedLog.keyName || "Default Key"}</span>
                      </div>
                      {selectedLog.ip && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Client IP</span>
                          <span className="font-mono text-foreground">{selectedLog.ip}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Error Banner if applicable */}
                  {selectedLog.errorMessage && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-sans space-y-1">
                      <span className="font-semibold text-red-600 dark:text-red-400">Error Message:</span>
                      <p className="font-mono text-foreground/90">{selectedLog.errorMessage}</p>
                    </div>
                  )}

                  {/* Raw Telemetry JSON */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                      Raw Telemetry Payload
                    </span>
                    <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto leading-relaxed border border-border/60">
                      <code>{JSON.stringify(selectedLog, null, 2)}</code>
                    </pre>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
