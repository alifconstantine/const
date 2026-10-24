"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { QueryBoundary } from "@/components/query-boundary";
import { Button, Skeleton, Badge, ScrollArea } from "@const/ui";
import { BUILTIN_MODELS } from "@/lib/model-specs";
import { formatTokenAmount, calculateQuotaMetrics } from "@/lib/quota";
const dollars = (n: number) => "$" + n.toFixed(6);
function Overview() {
  const { isAuthenticated } = useRouterAuth();
  const [range, setRange] = useState("7d");
  const analytics = useQuery(
    api.router.logs.getDashboardAnalytics,
    isAuthenticated ? { timeRange: range } : "skip",
  );
  const quota = useQuery(
    api.router.quotas.getUserQuota,
    isAuthenticated ? {} : "skip",
  );
  const logs = useQuery(
    api.router.logs.listLogs,
    isAuthenticated ? { limit: 6 } : "skip",
  );
  const metrics = calculateQuotaMetrics(quota),
    kpi = analytics?.kpi;
  const max = Math.max(1, ...(analytics?.timeline.map((t) => t.tokens) ?? []));
  return (
    <div className="max-w-6xl mx-auto space-y-7 pb-12">
      <header className="flex flex-wrap justify-between gap-4 items-start">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Requests, free allowance, and paid usage in one place.
          </p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-full p-1">
          {[
            ["24h", "today"],
            ["7 days", "7d"],
            ["30 days", "30d"],
            ["All time", "all"],
          ].map(([label, value]) => (
            <Button
              key={value}
              size="sm"
              variant={range === value ? "default" : "ghost"}
              className="rounded-full"
              onClick={() => setRange(value!)}
            >
              {label}
            </Button>
          ))}
        </div>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Paid usage", kpi ? dollars(kpi.costUsd) : undefined],
          ["Requests", kpi?.totalRequests.toLocaleString()],
          [
            "Free tokens used",
            kpi ? formatTokenAmount(kpi.freeTokens) : undefined,
          ],
          [
            "Paid tokens used",
            kpi ? formatTokenAmount(kpi.paidTokens) : undefined,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            {value === undefined ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-medium tabular-nums">{value}</p>
            )}
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
        <section className="bg-card rounded-2xl p-6 space-y-5">
          <div className="flex justify-between">
            <h2 className="font-medium">Token activity</h2>
            <span className="text-xs text-muted-foreground">
              Hourly totals · Live
            </span>
          </div>
          {!analytics ? (
            <Skeleton className="h-36 w-full" />
          ) : !analytics.timeline.length ? (
            <div className="h-36 flex items-center justify-center text-sm text-muted-foreground">
              Send your first request to see activity.
            </div>
          ) : (
            <div
              className="h-36 flex gap-1 items-end overflow-hidden"
              aria-label="Tokens used by hour"
            >
              {analytics.timeline.slice(-120).map((t) => (
                <div
                  key={t.timestamp}
                  className="bg-foreground/75 min-w-1 flex-1 rounded-t-sm"
                  style={{ height: Math.max(2, (t.tokens / max) * 100) + "%" }}
                  title={
                    new Date(t.timestamp).toLocaleString() +
                    ": " +
                    t.tokens +
                    " tokens"
                  }
                />
              ))}
            </div>
          )}
          <div className="flex gap-5 text-xs text-muted-foreground">
            <span>
              Success rate: {kpi ? kpi.successRate.toFixed(1) + "%" : "—"}
            </span>
            <span>
              Average duration:{" "}
              {kpi ? (kpi.avgDurationMs / 1000).toFixed(2) + "s" : "—"}
            </span>
          </div>
        </section>
        <section className="bg-card rounded-2xl p-6 flex flex-col justify-between gap-5">
          <div>
            <h2 className="font-medium">Weekly free allowance</h2>
            <p className="text-3xl font-medium tabular-nums mt-5">
              {quota ? metrics.formattedRemaining : "—"}{" "}
              <span className="text-sm text-muted-foreground font-normal">
                tokens left
              </span>
            </p>
          </div>
          <div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full"
                style={{ width: metrics.percentRemaining + "%" }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Only listed :free models use this allowance. Resets in{" "}
              {metrics.resetsInText}.
            </p>
          </div>
          <Link href="/models" className="text-sm underline underline-offset-4">
            Browse {BUILTIN_MODELS.filter((m) => m.tier === "free").length} free
            models
          </Link>
        </section>
      </div>
      <section className="space-y-4">
        <div className="flex justify-between">
          <h2 className="font-medium">Usage by model</h2>
          <span className="text-xs text-muted-foreground">
            Actual metered cost
          </span>
        </div>
        <div className="bg-card rounded-2xl">
          <ScrollArea orientation="horizontal">
            <table className="min-w-[550px] w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  {["Model", "Requests", "Tokens", "Cost"].map((t) => (
                    <th key={t} className="p-4 font-normal">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics?.modelBreakdown.map((m) => (
                  <tr key={m.model} className="border-t border-border/40">
                    <td className="p-4 font-mono text-xs">
                      {m.model} <Badge variant="secondary">{m.tier}</Badge>
                    </td>
                    <td className="p-4 tabular-nums">{m.requests}</td>
                    <td className="p-4 tabular-nums">
                      {m.tokens.toLocaleString()}
                    </td>
                    <td className="p-4 tabular-nums">{dollars(m.costUsd)}</td>
                  </tr>
                ))}
                {analytics && !analytics.modelBreakdown.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No usage in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>
        <p className="text-xs text-muted-foreground">
          Updates automatically after each request. Totals use hourly buckets.
          Earlier requests without recorded prices are not assigned an estimated
          cost.
        </p>
      </section>
      <section className="space-y-4">
        <div className="flex justify-between">
          <h2 className="font-medium">Recent requests</h2>
          <Link href="/logs" className="text-sm underline underline-offset-4">
            View usage logs
          </Link>
        </div>
        <div className="bg-card rounded-2xl divide-y divide-border/40">
          {logs?.map((log) => (
            <div
              key={log._id}
              className="p-4 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <span className="font-mono">{log.model}</span>
              <span className="text-muted-foreground">
                {log.totalTokens.toLocaleString()} tokens ·{" "}
                {new Date(log.createdAt).toLocaleString()}
              </span>
              <Badge variant={log.status >= 400 ? "destructive" : "secondary"}>
                {log.status}
              </Badge>
            </div>
          ))}
          {logs?.length === 0 && (
            <p className="p-8 text-sm text-muted-foreground text-center">
              Your requests will appear here.
            </p>
          )}
        </div>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button asChild className="rounded-full">
          <Link href="/generation">Open Playground</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/keys">Manage API keys</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/docs">Read documentation</Link>
        </Button>
      </div>
    </div>
  );
}
export default function DashboardPage() {
  return (
    <QueryBoundary name="Overview">
      <Overview />
    </QueryBoundary>
  );
}
