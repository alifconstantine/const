"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  Card,
  Button,
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
  cn,
  toast,
} from "@const/ui";
import {
  Coins,
  Layers,
  Zap,
  Gauge,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  ChevronRight,
  Server,
  KeyRound,
  Box,
  Scale,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";

function formatTokens(tokens?: number): string {
  if (tokens === undefined || tokens === null) return "0";
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

type TimeRangeOption = "today" | "7d" | "30d" | "90d" | "all";

export default function DashboardOverviewPage() {
  const { isAuthenticated } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );

  const keys = useQuery(
    api.router.keys.listKeys,
    isAuthenticated ? {} : "skip"
  );
  const activeKey = keys?.find((k) => k.status === "active");

  const [timeRange, setTimeRange] = useState<TimeRangeOption>("7d");
  const analytics = useQuery(
    api.router.logs.getDashboardAnalytics,
    isAuthenticated ? { timeRange } : "skip"
  );

  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedModel, setCopiedModel] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const userName = user?.name ? user.name.split(" ")[0] : "Developer";

  const apiEndpoint = "https://router.const.web.id/v1/chat/completions";
  const defaultModel = "gemini-3.6-flash";

  const copyToClipboard = (text: string, setter: (val: boolean) => void, label: string) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast.success("Copied to clipboard", {
      description: `${label} has been copied.`,
    });
    setTimeout(() => setter(false), 2000);
  };

  const curlKey = activeKey ? activeKey.keyPrefix : "YOUR_API_KEY";
  const curlSnippet = `curl https://router.const.web.id/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${curlKey}" \\
  -d '{
    "model": "${defaultModel}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

  // Max value for Timeline chart
  const timelineMaxTokens = Math.max(
    1,
    ...(analytics?.timeline?.map((t) => t.totalTokens) || [1])
  );

  return (
    <div className="space-y-8 select-none">
      {/* 1. Header with Editorial Greeting & Time Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-foreground tracking-tight flex items-center gap-2">
            <span>{getGreeting()}, {userName}!</span>
            <span className="text-3xl">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground font-light">
            AI gateway telemetry, token consumption, and model performance.
          </p>
        </div>

        {/* Time Filter Pills */}
        <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-full border border-border/70 self-start sm:self-center">
          {(
            [
              { label: "Today", value: "today" },
              { label: "7D", value: "7d" },
              { label: "30D", value: "30d" },
              { label: "90D", value: "90d" },
              { label: "All", value: "all" },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              onClick={() => setTimeRange(item.value)}
              className={cn(
                "px-3.5 py-1 text-xs font-sans rounded-full transition-colors cursor-pointer",
                timeRange === item.value
                  ? "bg-foreground text-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top KPI Cards (4 Cards - Pure Token & Performance Accounting) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tokens */}
        <Card className="rounded-3xl border-border/70 bg-card p-5 transition-colors">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs text-muted-foreground font-medium font-sans">
              Total Tokens
            </span>
            <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/50">
              <Coins className="h-4 w-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground font-sans tabular-nums">
              {analytics ? formatTokens(analytics.kpi.totalTokens) : "0"}
            </div>
            <p className="text-xs text-muted-foreground font-light flex items-center gap-1 font-sans">
              <span className="tabular-nums font-normal text-foreground/80">
                {analytics?.kpi.totalRequests.toLocaleString() || "0"}
              </span>{" "}
              requests logged
            </p>
          </div>
        </Card>

        {/* Card 2: Input Tokens */}
        <Card className="rounded-3xl border-border/70 bg-card p-5 transition-colors">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs text-muted-foreground font-medium font-sans">
              Input Tokens
            </span>
            <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/50">
              <Layers className="h-4 w-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground font-sans tabular-nums">
              {analytics ? formatTokens(analytics.kpi.promptTokens) : "0"}
            </div>
            <p className="text-xs text-muted-foreground font-light font-sans">
              {analytics?.kpi.cachedTokens ? (
                <span>
                  incl.{" "}
                  <strong className="font-medium text-foreground">
                    {formatTokens(analytics.kpi.cachedTokens)}
                  </strong>{" "}
                  cached
                </span>
              ) : (
                "Prompt context payload"
              )}
            </p>
          </div>
        </Card>

        {/* Card 3: Output Tokens */}
        <Card className="rounded-3xl border-border/70 bg-card p-5 transition-colors">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs text-muted-foreground font-medium font-sans">
              Output Tokens
            </span>
            <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/50">
              <Zap className="h-4 w-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground font-sans tabular-nums">
              {analytics ? formatTokens(analytics.kpi.completionTokens) : "0"}
            </div>
            <p className="text-xs text-muted-foreground font-light font-sans">
              Generated response tokens
            </p>
          </div>
        </Card>

        {/* Card 4: Throughput & Speed */}
        <Card className="rounded-3xl border-border/70 bg-card p-5 transition-colors">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs text-muted-foreground font-medium font-sans">
              Speed & Latency
            </span>
            <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/50">
              <Gauge className="h-4 w-4 stroke-[1.75]" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground font-sans tabular-nums">
              {analytics?.kpi.avgSpeed ? (
                <>
                  {analytics.kpi.avgSpeed}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    tok/s
                  </span>
                </>
              ) : (
                "—"
              )}
            </div>
            <p className="text-xs text-muted-foreground font-light font-sans tabular-nums">
              {analytics?.kpi.avgTtftMs ? (
                <>
                  <span className="text-foreground/80 font-normal">
                    {analytics.kpi.avgTtftMs}ms
                  </span>{" "}
                  TTFT &middot; {analytics.kpi.avgDurationMs}ms total
                </>
              ) : (
                "No latency recorded"
              )}
            </p>
          </div>
        </Card>
      </div>

      {/* 3. Infrastructure & Performance Snapshot Strip */}
      <Card className="rounded-2xl border-border/70 bg-secondary/30 p-3.5 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
          <div className="flex items-center gap-3 pt-2 sm:pt-0 sm:px-3 first:pl-1">
            <Server className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-[11px] font-sans text-muted-foreground uppercase tracking-wider font-semibold">
                Providers
              </div>
              <div className="text-base font-semibold font-sans text-foreground tabular-nums">
                {analytics?.infrastructure.activeProvidersCount || 1} Active
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:pt-0 sm:px-3">
            <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-[11px] font-sans text-muted-foreground uppercase tracking-wider font-semibold">
                API Keys
              </div>
              <div className="text-base font-semibold font-sans text-foreground tabular-nums">
                {analytics?.infrastructure.activeKeysCount || 0} Configured
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:pt-0 sm:px-3">
            <Box className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-[11px] font-sans text-muted-foreground uppercase tracking-wider font-semibold">
                Models
              </div>
              <div className="text-base font-semibold font-sans text-foreground tabular-nums">
                {analytics?.infrastructure.activeModelsCount || 0} Invoked
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:pt-0 sm:px-3">
            <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-[11px] font-sans text-muted-foreground uppercase tracking-wider font-semibold">
                I/O Ratio
              </div>
              <div className="text-base font-semibold font-sans text-foreground tabular-nums">
                {analytics?.kpi.ioRatio || "—"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:pt-0 sm:px-3">
            <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-[11px] font-sans text-muted-foreground uppercase tracking-wider font-semibold">
                Success Rate
              </div>
              <div className="text-base font-semibold font-sans text-foreground tabular-nums">
                {analytics?.kpi.successRate ?? 100}%
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Visual Analytics: Usage Trend & Provider Distribution (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Usage Trend Chart */}
        <Card className="lg:col-span-2 rounded-3xl border-border/70 bg-card p-6 flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between pb-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold tracking-tight text-foreground font-sans">
                  Usage Trend
                </h3>
                <Link
                  href="/logs"
                  className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <span>View audit logs</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground font-light">
                {analytics && analytics.kpi.totalRequests > 0
                  ? `${analytics.kpi.totalTokens.toLocaleString()} tokens across ${analytics.kpi.totalRequests} requests (${timeRange.toUpperCase()})`
                  : "No requests in selected window"}
              </p>
            </div>
          </div>

          {/* Activity Bar Chart Visualization */}
          <div className="h-64 w-full flex flex-col justify-between py-2">
            {analytics && analytics.timeline.length > 0 && analytics.kpi.totalRequests > 0 ? (
              <div className="flex-1 flex flex-col justify-end">
                <div className="h-48 flex items-end gap-1 sm:gap-2 px-1 border-b border-border/60 pb-1">
                  {analytics.timeline.map((bucket, idx) => {
                    const heightPercent = Math.max(
                      4,
                      Math.round((bucket.totalTokens / timelineMaxTokens) * 100)
                    );
                    return (
                      <TooltipProvider key={idx}>
                        <Tooltip delayDuration={100}>
                          <TooltipTrigger asChild>
                            <div className="flex-1 h-full flex flex-col justify-end group cursor-pointer">
                              <div
                                style={{ height: `${heightPercent}%` }}
                                className={cn(
                                  "w-full rounded-t-sm transition-all duration-300",
                                  bucket.totalTokens > 0
                                    ? "bg-foreground group-hover:bg-foreground/80"
                                    : "bg-muted/30"
                                )}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="text-xs p-2.5 font-sans bg-popover border-border/80 shadow-lg space-y-1"
                          >
                            <div className="font-semibold text-foreground">
                              {bucket.label}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground space-y-0.5 tabular-nums">
                              <div>Total: {bucket.totalTokens.toLocaleString()} tok</div>
                              <div>
                                {bucket.promptTokens.toLocaleString()} in / {bucket.completionTokens.toLocaleString()} out
                              </div>
                              <div className="text-foreground/90 font-medium pt-0.5">
                                {bucket.requests} requests
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[11px] font-mono text-muted-foreground/60 pt-2 px-1">
                  <span>Start of {timeRange.toUpperCase()}</span>
                  <span>Token Traffic Intensity</span>
                  <span>Now</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-border/60 rounded-2xl p-6">
                <Terminal className="h-6 w-6 text-muted-foreground/40" />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-foreground">
                    No requests recorded for this period
                  </p>
                  <p className="text-[11px] text-muted-foreground font-light">
                    Send requests via cURL or test in Playground to generate live telemetry.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Right: Provider Distribution */}
        <Card className="rounded-3xl border-border/70 bg-card p-6 flex flex-col justify-between transition-colors">
          <div className="space-y-1 pb-4">
            <h3 className="text-base font-semibold tracking-tight text-foreground font-sans">
              Provider Distribution
            </h3>
            <p className="text-xs text-muted-foreground font-light">
              Routing share across active AI providers.
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-4">
            {!analytics?.providerBreakdown || analytics.providerBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground font-light">
                No provider traffic yet
              </div>
            ) : (
              analytics.providerBreakdown.map((item) => (
                <div key={item.provider} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-sans">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <span className="h-2 w-2 rounded-full bg-foreground" />
                      <span>{item.provider}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-muted-foreground tabular-nums">
                      <span>{formatTokens(item.totalTokens)}</span>
                      <span className="font-semibold text-foreground">
                        {item.sharePercent}%
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 w-full rounded-full bg-secondary/80 overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, Math.max(3, item.sharePercent))}%` }}
                      className="h-full bg-foreground rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-border/50 text-[11px] text-muted-foreground font-sans flex items-center justify-between">
            <span>Dynamic load balanced</span>
            <Link
              href="/providers"
              className="underline hover:text-foreground font-medium transition-colors"
            >
              Manage providers
            </Link>
          </div>
        </Card>
      </div>

      {/* 5. Model Breakdown Table */}
      <Card className="rounded-3xl border-border/70 bg-card overflow-hidden transition-colors">
        <div className="p-6 pb-4 border-b border-border/60 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold tracking-tight text-foreground font-sans">
              Model Breakdown
            </h3>
            <p className="text-xs text-muted-foreground font-light">
              Tokens, requests, and workload share per model.
            </p>
          </div>
          <Link
            href="/models"
            className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <span>Model catalog</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground pl-6 py-3">
                  Model
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right py-3">
                  Requests
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right py-3">
                  Input Tokens
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right py-3">
                  Output Tokens
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right py-3">
                  Total Tokens
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground pr-6 py-3 w-48 text-right">
                  Share (%)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!analytics?.modelBreakdown || analytics.modelBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-xs text-muted-foreground font-sans"
                  >
                    No model usage logged yet. Run a prompt in Playground or via API.
                  </TableCell>
                </TableRow>
              ) : (
                analytics.modelBreakdown.map((item) => (
                  <TableRow
                    key={item.model}
                    className="border-border/40 hover:bg-secondary/20 transition-colors"
                  >
                    {/* Model */}
                    <TableCell className="pl-6 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                        <span className="font-sans text-xs font-medium text-foreground">
                          {item.model}
                        </span>
                      </div>
                    </TableCell>

                    {/* Requests */}
                    <TableCell className="text-right py-3.5 text-xs font-sans text-foreground/90 tabular-nums">
                      {item.requests.toLocaleString()}
                    </TableCell>

                    {/* Input Tokens */}
                    <TableCell className="text-right py-3.5 text-xs font-sans text-muted-foreground tabular-nums">
                      {formatTokens(item.inputTokens)}
                    </TableCell>

                    {/* Output Tokens */}
                    <TableCell className="text-right py-3.5 text-xs font-sans text-muted-foreground tabular-nums">
                      {formatTokens(item.outputTokens)}
                    </TableCell>

                    {/* Total Tokens */}
                    <TableCell className="text-right py-3.5 text-xs font-sans font-semibold text-foreground tabular-nums">
                      {formatTokens(item.totalTokens)}
                    </TableCell>

                    {/* Share Bar */}
                    <TableCell className="pr-6 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2.5">
                        <div className="h-2 w-24 rounded-full bg-secondary/80 overflow-hidden">
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(3, item.sharePercent))}%`,
                            }}
                            className="h-full bg-foreground rounded-full"
                          />
                        </div>
                        <span className="text-xs font-mono font-medium text-foreground w-12 text-right tabular-nums">
                          {item.sharePercent}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 6. Lower Grid: Activity Heatmap (GitHub Style) & Quick Start */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Activity Heatmap (52-week calendar grid) */}
        <Card className="lg:col-span-2 rounded-3xl border-border/70 bg-card p-6 flex flex-col justify-between transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-foreground stroke-[1.75]" />
                <h3 className="text-base font-semibold tracking-tight text-foreground font-sans">
                  Activity Heatmap
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-light">
                Annual token request frequency across 52 weeks.
              </p>
            </div>

            {/* Most active day highlight */}
            {analytics?.mostActiveDay && analytics.mostActiveDay.tokens > 0 && (
              <div className="text-xs font-sans text-muted-foreground bg-secondary/60 px-3 py-1 rounded-full border border-border/50 self-start sm:self-auto tabular-nums">
                Busiest Day:{" "}
                <strong className="text-foreground font-medium">
                  {analytics.mostActiveDay.date}
                </strong>{" "}
                ({formatTokens(analytics.mostActiveDay.tokens)} tokens)
              </div>
            )}
          </div>

          {/* 52-Week Contribution Grid */}
          <div className="py-2 overflow-x-auto select-none">
            <div className="inline-block min-w-[640px]">
              <div className="grid grid-rows-7 grid-flow-col gap-1.5 p-1">
                {analytics?.dailyHeatmap?.map((day) => (
                  <TooltipProvider key={day.date}>
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "w-3 h-3 rounded-[2px] transition-colors cursor-pointer",
                            day.level === 0 && "bg-secondary/50 hover:bg-secondary border border-border/30",
                            day.level === 1 && "bg-foreground/25 hover:bg-foreground/35",
                            day.level === 2 && "bg-foreground/50 hover:bg-foreground/60",
                            day.level === 3 && "bg-foreground/75 hover:bg-foreground/85",
                            day.level === 4 && "bg-foreground hover:bg-foreground/90"
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="text-xs p-2.5 font-sans bg-popover border-border/80 shadow-md"
                      >
                        <div className="font-semibold text-foreground">
                          {day.date}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground tabular-nums">
                          {day.tokens.toLocaleString()} tokens &middot; {day.count} requests
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center justify-between text-[11px] font-sans text-muted-foreground pt-3 px-1">
                <span className="font-mono">Past 52 Weeks</span>
                <div className="flex items-center gap-1.5">
                  <span>Less</span>
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-secondary/50 border border-border/30" />
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-foreground/25" />
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-foreground/50" />
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-foreground/75" />
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-foreground" />
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Quick Start Card */}
        <Card className="rounded-3xl border-border/70 bg-card p-6 space-y-5 transition-colors">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border/50">
                <Terminal className="h-4 w-4 stroke-[1.75]" />
              </div>
              <h3 className="text-base font-semibold tracking-tight text-foreground font-sans">
                Quick Start
              </h3>
            </div>
            <p className="text-xs text-muted-foreground font-light pl-10">
              Start making requests in seconds.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {/* Field 1: API Endpoint */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium font-sans">
                API Endpoint
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary border border-border text-xs font-mono">
                <span className="text-foreground truncate select-all">{apiEndpoint}</span>
                <button
                  onClick={() => copyToClipboard(apiEndpoint, setCopiedEndpoint, "API Endpoint")}
                  className="p-1 rounded-md hover:bg-card text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0 ml-2"
                  aria-label="Copy API Endpoint"
                >
                  {copiedEndpoint ? (
                    <Check className="h-3.5 w-3.5 text-foreground" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Field 2: API Key */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium font-sans">
                API Key
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary border border-border text-xs">
                {activeKey ? (
                  <>
                    <span className="text-foreground font-mono font-medium">{activeKey.keyPrefix}</span>
                    <Link
                      href="/keys"
                      className="text-xs font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 shrink-0 font-sans"
                    >
                      Manage keys
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground italic font-light font-sans">No API key yet</span>
                    <Link
                      href="/keys"
                      className="text-xs font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 shrink-0 font-sans"
                    >
                      Create key
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Field 3: Model */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium font-sans">
                Default Model
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary border border-border text-xs font-mono">
                <span className="text-foreground">{defaultModel}</span>
                <button
                  onClick={() => copyToClipboard(defaultModel, setCopiedModel, "Model Name")}
                  className="p-1 rounded-md hover:bg-card text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0 ml-2"
                  aria-label="Copy Model Name"
                >
                  {copiedModel ? (
                    <Check className="h-3.5 w-3.5 text-foreground" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-2">
            <Button
              size="sm"
              onClick={() => copyToClipboard(curlSnippet, setCopiedCurl, "cURL command")}
              className="flex-1 rounded-full gap-2 text-xs font-medium cursor-pointer h-10 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none border border-transparent font-sans"
            >
              {copiedCurl ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Terminal className="h-3.5 w-3.5" />
              )}
              <span>Copy cURL</span>
            </Button>

            <Link href="/endpoints" className="flex-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-full gap-2 text-xs font-medium border border-border bg-background hover:bg-secondary text-foreground cursor-pointer h-10 shadow-none font-sans"
              >
                <span>View Docs</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

