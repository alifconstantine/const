"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { QueryBoundary } from "@/components/query-boundary";
import { Button, ScrollArea, Skeleton, cn } from "@const/ui";
import { formatUsd, type TimelinePoint } from "@/lib/router-analytics";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { QuickSetup } from "@/components/dashboard/quick-setup";
import { ArrowUpRight, ArrowRight } from "lucide-react";

type Analytics = {
  kpi: {
    totalRequests: number;
    totalTokens: number;
    freeTokens: number;
    paidTokens: number;
    costUsd: number;
    successRate: number;
    avgDurationMs: number;
    legacyTokens?: number;
  };
  timeline: TimelinePoint[];
  modelBreakdown: {
    model: string;
    tier: string;
    requests: number;
    tokens: number;
    costUsd: number;
  }[];
  historicalCostsAvailable?: boolean;
};
type RecentLog = {
  _id: string;
  model: string;
  totalTokens: number;
  status: number;
  createdAt: number;
  billingTier?: string;
};

export function OverviewView({
  analytics,
  wallet,
  logs,
  range = "7d",
  onRangeChange,
}: {
  analytics?: Analytics;
  wallet?: { availableUsd: number };
  logs?: RecentLog[];
  range?: string;
  onRangeChange?: (range: string) => void;
}) {
  const kpi = analytics?.kpi;
  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your traffic, token usage, and spend at a glance.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/generation">
            Open playground <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </header>
      <section
        aria-label="Usage summary"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-3">
          <h2 className="text-sm font-medium">Usage summary</h2>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Usage period"
          >
            {[
              ["24 hours", "today"],
              ["7 days", "7d"],
              ["30 days", "30d"],
              ["All time", "all"],
            ].map(([label, value]) => (
              <button
                key={value}
                type="button"
                aria-pressed={range === value}
                onClick={() => onRangeChange?.(value!)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  range === value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
          {[
            {
              label: "Requests",
              value: kpi?.totalRequests.toLocaleString(),
              detail: "All gateway requests",
            },
            {
              label: "Total tokens",
              value: kpi?.totalTokens.toLocaleString(),
              detail: "Input and output tokens",
            },
            {
              label: "Success rate",
              value: kpi ? `${kpi.successRate.toFixed(1)}%` : undefined,
              detail: "Successful requests in this period",
            },
            {
              label: "Paid usage · USD",
              value: kpi ? formatUsd(kpi.costUsd) : undefined,
              detail: "Metered cost in this period",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="min-w-0 px-5 py-5 max-lg:border-b max-lg:border-border"
            >
              <p className="text-xs text-muted-foreground">{item.label}</p>
              {item.value === undefined ? (
                <Skeleton className="my-3 h-8 w-24" />
              ) : (
                <p className="my-3 break-words text-2xl font-medium tracking-tight tabular-nums">
                  {item.value}
                </p>
              )}
              <p className="text-[11px] leading-5 text-muted-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
        {!!kpi?.legacyTokens && (
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Total tokens also include {kpi.legacyTokens.toLocaleString()} from
            legacy usage.
          </p>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section
          className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6"
          aria-label="Usage activity"
        >
          {analytics ? (
            <ActivityChart timeline={analytics.timeline} range={range} />
          ) : (
            <>
              <Skeleton className="mb-6 h-6 w-40" />
              <Skeleton className="h-64 w-full" />
            </>
          )}
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <span>
              Success rate{" "}
              <strong className="ml-2 font-medium text-foreground tabular-nums">
                {kpi?.totalRequests ? `${kpi.successRate.toFixed(1)}%` : "—"}
              </strong>
            </span>
            <span>
              Average latency{" "}
              <strong className="ml-2 font-medium text-foreground tabular-nums">
                {kpi?.totalRequests
                  ? `${(kpi.avgDurationMs / 1000).toFixed(2)} s`
                  : "—"}
              </strong>
            </span>
          </div>
        </section>
        <section
          className="flex flex-col rounded-xl border border-border bg-card p-5 sm:p-6"
          aria-label="Credit balance"
        >
          <h2 className="text-sm font-medium">Available credit</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">One balance for every model and utility endpoint.</p>
          <div className="my-7">
            {wallet ? <p className="break-words text-3xl font-medium tracking-tight tabular-nums">{formatUsd(wallet.availableUsd)}</p> : <Skeleton className="h-9 w-32" />}
            <p className="mt-2 text-xs text-muted-foreground">Pay as you go · USD</p>
          </div>
          <Link href="/credits" className="mt-auto inline-flex min-h-11 items-center justify-between gap-3 text-xs font-medium hover:text-[var(--router-highlight)]">Add credit with QRIS <ArrowRight className="size-4" /></Link>
        </section>
      </div>
      <section aria-label="Usage by model" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-medium">Usage by model</h2>
          <span className="text-xs text-muted-foreground">Selected period</span>
        </div>
        <ScrollArea
          orientation="horizontal"
          className="rounded-xl border border-border bg-card"
          viewportRef={(node) => {
            if (node) {
              node.tabIndex = 0;
              node.setAttribute("aria-label", "Usage by model data");
              node.setAttribute("role", "region");
            }
          }}
        >
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                {["Model / tier", "Requests", "Tokens", "Cost · USD"].map(
                  (label, index) => (
                    <th
                      key={label}
                      className={cn(
                        "px-5 py-3 font-medium",
                        index > 0 && "text-right",
                      )}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {analytics?.modelBreakdown.map((model) => (
                <tr
                  key={`${model.model}-${model.tier}`}
                  className="hover:bg-secondary/40"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium">{model.model}</p>
                    <p className="mt-1 text-muted-foreground capitalize">
                      {model.tier}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {model.requests.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {model.tokens.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {formatUsd(model.costUsd)}
                  </td>
                </tr>
              ))}
              {!analytics ? (
                <tr>
                  <td colSpan={4} className="p-5">
                    <Skeleton className="h-16 w-full" />
                  </td>
                </tr>
              ) : (
                !analytics.modelBreakdown.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-muted-foreground"
                    >
                      No usage in this period. Try a different date range or
                      send your first request.
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </ScrollArea>
        {analytics?.historicalCostsAvailable === false && (
          <p className="text-xs text-muted-foreground">
            Costs reflect metered requests. Historical costs before metering are
            unavailable.
          </p>
        )}
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4" aria-label="Recent requests">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">Recent requests</h2>
            <Link
              href="/logs"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              All logs <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {logs?.map((log) => (
              <div
                key={log._id}
                className="flex items-center justify-between gap-4 px-5 py-4 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{log.model}</p>
                  <p className="mt-1.5 text-muted-foreground tabular-nums">
                    {log.totalTokens.toLocaleString()} tokens ·{" "}
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 tabular-nums",
                    log.status >= 400
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-secondary text-foreground",
                  )}
                >
                  {log.status}
                </span>
              </div>
            ))}
            {logs === undefined ? (
              <div className="p-5">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              !logs.length && (
                <p className="px-5 py-10 text-center text-xs leading-5 text-muted-foreground">
                  Your latest requests will appear here after you make a call.
                </p>
              )
            )}
          </div>
        </section>
        <QuickSetup />
      </div>
    </div>
  );
}

function Overview() {
  const { isAuthenticated } = useRouterAuth();
  const [range, setRange] = useState("7d");
  const analytics = useQuery(
    api.router.logs.getDashboardAnalytics,
    isAuthenticated ? { timeRange: range } : "skip",
  );
  const wallet = useQuery(
    api.router.credits.getUserCredits,
    isAuthenticated ? {} : "skip",
  );
  const logs = useQuery(
    api.router.logs.listLogs,
    isAuthenticated ? { limit: 8 } : "skip",
  );
  return (
    <OverviewView
      analytics={analytics}
      wallet={wallet}
      logs={logs}
      range={range}
      onRangeChange={setRange}
    />
  );
}
export default function DashboardPage() {
  return (
    <QueryBoundary name="Overview">
      <Overview />
    </QueryBoundary>
  );
}
