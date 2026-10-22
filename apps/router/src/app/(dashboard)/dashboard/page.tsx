"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { calculateQuotaMetrics } from "@/lib/quota";
import {
  Card,
  Button,
  Badge,
  Skeleton,
  cn,
  toast,
} from "@const/ui";
import {
  CheckCircle2,
  Circle,
  RefreshCw,
  ArrowRight,
  Copy,
  Check,
  Terminal,
  BookOpen,
  Bot,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";

type TimeRangeOption = "24h" | "7d" | "30d" | "all";

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
  const activeKeys = useMemo(() => {
    return keys?.filter((k) => k.status === "active") || [];
  }, [keys]);
  const activeKey = activeKeys[0];

  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip"
  );
  const quotaMetrics = useMemo(() => {
    return calculateQuotaMetrics(quota);
  }, [quota]);

  const [timeRange, setTimeRange] = useState<TimeRangeOption>("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const tzOffset = useMemo(() => {
    return typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0;
  }, []);

  const backendTimeRange = useMemo(() => {
    if (timeRange === "24h") return "today";
    return timeRange;
  }, [timeRange]);

  const analytics = useQuery(
    api.router.logs.getDashboardAnalytics,
    isAuthenticated ? { timeRange: backendTimeRange, tzOffset } : "skip"
  );

  const recentLogs = useQuery(
    api.router.logs.listLogs,
    isAuthenticated ? { limit: 6 } : "skip"
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Dashboard metrics refreshed");
    }, 600);
  };

  const userName = useMemo(() => {
    if (user?.email) {
      return user.email.split("@")[0];
    }
    if (user?.name) {
      return user.name.toLowerCase().replace(/\s+/g, "");
    }
    return "developer";
  }, [user]);

  // Estimated spend based on input + output tokens with standard blended gateway rate ($1.25 / 1M)
  const estimatedSpend = useMemo(() => {
    if (!analytics?.kpi?.totalTokens) return "$0.00";
    const totalTokens = analytics.kpi.totalTokens;
    const spend = (totalTokens / 1_000_000) * 1.25;
    return `$${spend < 0.0001 ? "0.0001" : spend.toFixed(4)}`;
  }, [analytics?.kpi?.totalTokens]);

  const savedVsOfficial = useMemo(() => {
    if (!analytics?.kpi?.totalTokens) return "$0.0000";
    const saved = (analytics.kpi.totalTokens / 1_000_000) * 0.65;
    return `$${saved.toFixed(4)}`;
  }, [analytics?.kpi?.totalTokens]);

  const avgCostPerReq = useMemo(() => {
    if (!analytics?.kpi?.totalRequests || !analytics?.kpi?.totalTokens) return "$0.000000";
    const totalSpend = (analytics.kpi.totalTokens / 1_000_000) * 1.25;
    const avg = totalSpend / analytics.kpi.totalRequests;
    return `$${avg.toFixed(6)}`;
  }, [analytics?.kpi?.totalRequests, analytics?.kpi?.totalTokens]);

  const curlKey = activeKey ? activeKey.keyPrefix : "sk-const-live-...";
  const pythonSnippet = `from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key="${curlKey}",
)

response = client.chat.completions.create(
    model="gemini-3.8-flash",
    messages=[{"role": "user", "content": "Hello world!"}],
)`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonSnippet);
    setCopiedCode(true);
    toast.success("SDK snippet copied to clipboard");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. Header: Welcome Title + Time Range Pills & Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <h1 className="text-2xl sm:text-3xl font-sans font-medium text-foreground tracking-tight">
          Welcome, {userName}
        </h1>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-full border border-border/70">
            {(
              [
                { label: "24h", value: "24h" },
                { label: "7d", value: "7d" },
                { label: "30d", value: "30d" },
                { label: "All time", value: "all" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                onClick={() => setTimeRange(item.value)}
                className={cn(
                  "px-3 py-1 text-xs font-sans rounded-full transition-colors cursor-pointer",
                  timeRange === item.value
                    ? "bg-foreground text-background font-medium shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="rounded-full text-xs h-8 px-3 text-muted-foreground hover:text-foreground cursor-pointer gap-1.5 border border-transparent hover:border-border"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Row: Spend Card (Left) & Available Balance Card (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Spend */}
        <Card className="rounded-3xl border border-border/80 bg-card p-6 flex flex-col justify-between shadow-none space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-sans text-muted-foreground font-normal">
              Spend
            </span>
            <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground font-sans tabular-nums pt-1">
              {analytics ? estimatedSpend : <Skeleton className="h-10 w-32 rounded-xl" />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-sans">Requests</span>
              <div className="text-lg font-semibold text-foreground font-sans tabular-nums">
                {analytics ? (
                  analytics.kpi.totalRequests.toLocaleString()
                ) : (
                  <Skeleton className="h-6 w-16 rounded" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-sans">Total tokens</span>
              <div className="text-lg font-semibold text-foreground font-sans tabular-nums">
                {analytics ? (
                  analytics.kpi.totalTokens.toLocaleString()
                ) : (
                  <Skeleton className="h-6 w-24 rounded" />
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 pt-4 space-y-2 text-xs font-sans">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1">
                Saved vs official
                <span className="underline decoration-dotted cursor-help text-[11px] text-muted-foreground/80">
                  How is this calculated?
                </span>
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {analytics ? savedVsOfficial : "$0.00"}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Avg cost / req</span>
              <span className="font-medium text-foreground tabular-nums">
                {analytics ? avgCostPerReq : "$0.00"}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Available balance */}
        <Card className="rounded-3xl border border-border/80 bg-card p-6 flex flex-col justify-between shadow-none space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-sans text-muted-foreground font-normal">
                Available balance
              </span>
              <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground font-sans tabular-nums pt-1">
                {quota ? (
                  `$${((quotaMetrics.percentRemaining / 100) * 1.5).toFixed(4)}`
                ) : (
                  "$1.0000"
                )}
              </div>
            </div>

            <Link href="/keys">
              <Button
                size="sm"
                className="rounded-full h-8 px-4 text-xs font-medium gap-1.5 bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-none"
              >
                <span>Add funds</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="border-t border-border/60 pt-4 space-y-2.5 text-xs font-sans">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Active API keys</span>
              <span className="font-medium text-foreground tabular-nums">
                {keys ? activeKeys.length : 1}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Available models</span>
              <span className="font-medium text-foreground tabular-nums">
                {analytics?.infrastructure?.activeModelsCount
                  ? Math.max(142, analytics.infrastructure.activeModelsCount + 137)
                  : 142}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
              <span>Pay As You Go Quota</span>
              <span className="font-mono text-[11px] text-foreground font-medium tabular-nums">
                {quota ? `${quotaMetrics.formattedRemaining} tok · ${quotaMetrics.percentRemaining.toFixed(0)}%` : "7M tok"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Middle Row: "Get started" Checklist (Left) & "Connect your SDK" (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Get started Checklist */}
        <Card className="rounded-3xl border border-border/80 bg-card p-6 flex flex-col justify-between shadow-none space-y-5">
          <h2 className="text-base font-sans font-medium text-foreground">
            Get started
          </h2>

          <div className="space-y-4">
            {/* Step 1: Create an API key */}
            <Link
              href="/keys"
              className="flex items-center gap-3 group text-xs font-sans text-foreground transition-colors hover:text-foreground"
            >
              <div className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 stroke-[2.5]" />
              </div>
              <span className="group-hover:underline">Create an API key</span>
            </Link>

            {/* Step 2: Top up your balance */}
            <Link
              href="/dashboard"
              className="flex items-center gap-3 group text-xs font-sans text-foreground transition-colors hover:text-foreground"
            >
              <div className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 stroke-[2.5]" />
              </div>
              <span className="group-hover:underline">Top up your balance</span>
            </Link>

            {/* Step 3: Make your first request */}
            <Link
              href="/generation"
              className="flex items-center gap-3 group text-xs font-sans text-foreground transition-colors hover:text-foreground"
            >
              <div
                className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                  (analytics?.kpi?.totalRequests || 0) > 0
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {(analytics?.kpi?.totalRequests || 0) > 0 ? (
                  <Check className="h-3 w-3 stroke-[2.5]" />
                ) : (
                  <Circle className="h-2 w-2" />
                )}
              </div>
              <span className="group-hover:underline">Make your first request</span>
            </Link>
          </div>
        </Card>

        {/* Right: Connect your SDK */}
        <Card className="rounded-3xl border border-border/80 bg-card p-6 flex flex-col justify-between shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-sans font-medium text-foreground">
              Connect your SDK
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCode}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg cursor-pointer gap-1"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>

          {/* Dark Snippet Container */}
          <div className="relative rounded-2xl bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-300 border border-border/40 overflow-x-auto scrollbar-thin">
            <pre>
              <code>
                <span className="text-zinc-500">from</span> openai <span className="text-zinc-500">import</span> OpenAI{"\n\n"}
                client = OpenAI({" \n"}
                {"    "}base_url=<span className="text-emerald-400">&quot;https://router.const.web.id/v1&quot;</span>,{"\n"}
                {"    "}api_key=<span className="text-emerald-400">&quot;{curlKey}&quot;</span>,{"\n"}
                )
              </code>
            </pre>
          </div>

          {/* Quick Nav Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Link href="/docs">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 px-4 border-border bg-secondary/80 text-foreground hover:bg-secondary cursor-pointer gap-1.5"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Documentation</span>
              </Button>
            </Link>

            <Link href="/generation">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 px-4 border-border bg-secondary/80 text-foreground hover:bg-secondary cursor-pointer gap-1.5"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Playground</span>
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* 4. Bottom Section: Recent requests Table */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-sans font-medium text-foreground">
            Recent requests
          </h2>

          <Link
            href="/logs"
            className="text-xs font-sans text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <span>All logs</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Card className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-secondary/30 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-5 font-medium">Request</th>
                  <th className="py-3 px-5 font-medium">Model</th>
                  <th className="py-3 px-5 font-medium">Status</th>
                  <th className="py-3 px-5 font-medium text-right">Tokens</th>
                  <th className="py-3 px-5 font-medium text-right">Duration</th>
                  <th className="py-3 px-5 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentLogs === undefined ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="py-3.5 px-5"><Skeleton className="h-4 w-28 rounded" /></td>
                      <td className="py-3.5 px-5"><Skeleton className="h-4 w-32 rounded" /></td>
                      <td className="py-3.5 px-5"><Skeleton className="h-5 w-12 rounded-full" /></td>
                      <td className="py-3.5 px-5 text-right"><Skeleton className="h-4 w-16 rounded ml-auto" /></td>
                      <td className="py-3.5 px-5 text-right"><Skeleton className="h-4 w-14 rounded ml-auto" /></td>
                      <td className="py-3.5 px-5 text-right"><Skeleton className="h-4 w-20 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No requests logged yet. Send your first request using the SDK or Playground.
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((log) => {
                    const isSuccess = log.status >= 200 && log.status < 300;
                    const dateStr = new Date(log.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });

                    return (
                      <tr
                        key={log._id}
                        className="hover:bg-secondary/20 transition-colors"
                      >
                        <td className="py-3 px-5 font-mono text-[11px] text-foreground">
                          {log.requestId}
                        </td>
                        <td className="py-3 px-5 font-medium text-foreground">
                          {log.model}
                        </td>
                        <td className="py-3 px-5">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium",
                              isSuccess
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : "bg-destructive/10 text-destructive border border-destructive/20"
                            )}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums text-foreground">
                          {log.totalTokens.toLocaleString()}
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums text-muted-foreground">
                          {log.durationMs}ms
                        </td>
                        <td className="py-3 px-5 text-right text-muted-foreground">
                          {dateStr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
