"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { QueryBoundary } from "@/components/query-boundary";
import { Button, Skeleton, Badge, ScrollArea, toast, cn } from "@const/ui";
import { BUILTIN_MODELS } from "@/lib/model-specs";
import { formatTokenAmount, calculateQuotaMetrics } from "@/lib/quota";
import { Check, Copy, Terminal, ShieldCheck, ArrowUpRight } from "lucide-react";

const dollars = (n: number) => "$" + n.toFixed(6);

const QUICK_SETUP_CODE = {
  curl: `curl https://router.const.web.id/v1/chat/completions \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4.1-flash:free",
    "messages": [{"role": "user", "content": "Hello world"}]
  }'`,
  python: `from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key="sk-const-live-YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[{"role": "user", "content": "Hello world"}],
)
print(response.choices[0].message.content)`,
  javascript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://router.const.web.id/v1",
  apiKey: process.env.CONST_API_KEY,
});

const response = await client.chat.completions.create({
  model: "deepseek-v4.1-flash:free",
  messages: [{ role: "user", content: "Hello world" }],
});
console.log(response.choices[0].message.content);`,
};

function Overview() {
  const { isAuthenticated } = useRouterAuth();
  const [range, setRange] = useState("7d");
  const [setupTab, setSetupTab] = useState<"curl" | "python" | "javascript">("curl");
  const [copiedSetup, setCopiedSetup] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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
    isAuthenticated ? { limit: 8 } : "skip",
  );

  const metrics = calculateQuotaMetrics(quota);
  const kpi = analytics?.kpi;
  const max = Math.max(1, ...(analytics?.timeline.map((t) => t.tokens) ?? []));

  async function copyBaseUrl() {
    try {
      await navigator.clipboard.writeText("https://router.const.web.id/v1");
      setCopiedUrl(true);
      toast.success("Base URL copied");
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      toast.error("Could not copy Base URL");
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(QUICK_SETUP_CODE[setupTab]);
      setCopiedSetup(true);
      toast.success("Snippet copied");
      setTimeout(() => setCopiedSetup(false), 2000);
    } catch {
      toast.error("Could not copy snippet");
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-7 pb-12">
      {/* Header */}
      <header className="flex flex-wrap justify-between gap-4 items-start">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-normal text-foreground tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Requests, free allowance, and paid usage in one place.
          </p>
        </div>

        {/* Minimal Time Range Segmented Selector */}
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl border border-border/50">
          {[
            ["24h", "today"],
            ["7 days", "7d"],
            ["30 days", "30d"],
            ["All time", "all"],
          ].map(([label, value]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value!)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                range === value
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* KPI Cards */}
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
          <div
            key={label}
            className="rounded-xl bg-card border border-border/60 p-5 space-y-2"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            {value === undefined ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-medium tracking-tight tabular-nums">{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Activity Chart & Free Allowance */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
        <section className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-medium text-sm">Token activity</h2>
            <span className="text-xs text-muted-foreground font-mono">
              Hourly totals
            </span>
          </div>

          {!analytics ? (
            <Skeleton className="h-36 w-full" />
          ) : !analytics.timeline.length ? (
            <div className="h-36 flex items-center justify-center text-xs text-muted-foreground">
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
                  className="bg-foreground/80 min-w-[2px] flex-1 rounded-t-sm hover:bg-foreground transition-colors"
                  style={{ height: Math.max(2, (t.tokens / max) * 100) + "%" }}
                  title={
                    new Date(t.timestamp).toLocaleString() +
                    ": " +
                    t.tokens.toLocaleString() +
                    " tokens"
                  }
                />
              ))}
            </div>
          )}

          <div className="flex gap-5 text-xs text-muted-foreground pt-1 border-t border-border/30">
            <span>
              Success rate:{" "}
              <strong className="text-foreground font-mono">
                {kpi ? kpi.successRate.toFixed(1) + "%" : "—"}
              </strong>
            </span>
            <span>
              Average latency:{" "}
              <strong className="text-foreground font-mono">
                {kpi ? (kpi.avgDurationMs / 1000).toFixed(2) + "s" : "—"}
              </strong>
            </span>
          </div>
        </section>

        {/* Free Allowance Card */}
        <section className="bg-card border border-border/60 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-sm">Weekly Free Allowance</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                7M / Cycle
              </span>
            </div>
            <p className="text-2xl font-medium tracking-tight tabular-nums mt-4">
              {quota ? metrics.formattedRemaining : "—"}{" "}
              <span className="text-xs text-muted-foreground font-normal">
                tokens left
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-300"
                style={{ width: metrics.percentRemaining + "%" }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Resets in <span className="text-foreground font-medium">{metrics.resetsInText}</span>. Applies to all models marked <code className="text-foreground font-mono">:free</code>.
            </p>
          </div>

          <Link
            href="/models"
            className="text-xs font-medium text-foreground hover:underline inline-flex items-center gap-1 pt-2 border-t border-border/30"
          >
            <span>Browse {BUILTIN_MODELS.filter((m) => m.tier === "free").length} free tier models</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </section>
      </div>

      {/* Quick Setup Card */}
      <section className="bg-card border border-border/60 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-sm">Quick Setup</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Drop-in replacement for OpenAI SDK clients. Replace the base URL and use your key.
            </p>
          </div>

          {/* Language selector & Copy */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border/50">
              {(["curl", "python", "javascript"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSetupTab(t)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors cursor-pointer capitalize",
                    setupTab === t
                      ? "bg-card text-foreground shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "curl" ? "cURL" : t === "python" ? "Python" : "Node.js"}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 rounded-lg"
              onClick={copySnippet}
            >
              {copiedSetup ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Base URL Pill */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono">Base URL:</span>
            <code className="font-mono text-foreground font-medium">https://router.const.web.id/v1</code>
          </div>
          <button
            type="button"
            onClick={copyBaseUrl}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono cursor-pointer"
          >
            {copiedUrl ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            <span>{copiedUrl ? "Copied" : "Copy URL"}</span>
          </button>
        </div>

        {/* Code Snippet */}
        <div className="rounded-lg bg-secondary/20 border border-border/40 overflow-hidden">
          <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-foreground/90">
            {QUICK_SETUP_CODE[setupTab]}
          </pre>
        </div>
      </section>

      {/* Recent Requests (Moved UP!) */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-medium text-sm">Recent requests</h2>
          <Link
            href="/logs"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <span>View usage logs</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="bg-card border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
          {logs?.map((log) => (
            <div
              key={log._id}
              className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-secondary/20 transition-colors"
            >
              <span className="font-mono font-medium text-foreground">{log.model}</span>
              <span className="text-muted-foreground font-mono">
                {log.totalTokens.toLocaleString()} tokens ·{" "}
                {new Date(log.createdAt).toLocaleString()}
              </span>
              <Badge
                variant={log.status >= 400 ? "destructive" : "secondary"}
                className="font-mono text-[10px]"
              >
                {log.status}
              </Badge>
            </div>
          ))}

          {logs?.length === 0 && (
            <p className="p-8 text-xs text-muted-foreground text-center">
              Your recent requests will appear here once you send calls.
            </p>
          )}
        </div>
      </section>

      {/* Usage By Model (Moved to the VERY BOTTOM!) */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-medium text-sm">Usage by model</h2>
          <span className="text-xs text-muted-foreground font-mono">
            Metered telemetry
          </span>
        </div>

        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <ScrollArea orientation="horizontal">
            <table className="min-w-[550px] w-full text-sm text-left">
              <thead className="bg-secondary/40 text-xs text-muted-foreground border-b border-border/40">
                <tr>
                  {["Model", "Requests", "Tokens", "Cost"].map((t) => (
                    <th key={t} className="px-5 py-3.5 font-normal">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {analytics?.modelBreakdown.map((m) => (
                  <tr key={m.model} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-4 font-mono text-xs">
                      {m.model}{" "}
                      <Badge variant="secondary" className="ml-1 text-[10px] font-mono">
                        {m.tier}
                      </Badge>
                    </td>
                    <td className="p-4 tabular-nums text-xs">{m.requests}</td>
                    <td className="p-4 tabular-nums text-xs font-mono">
                      {m.tokens.toLocaleString()}
                    </td>
                    <td className="p-4 tabular-nums text-xs font-mono font-medium">
                      {dollars(m.costUsd)}
                    </td>
                  </tr>
                ))}
                {analytics && !analytics.modelBreakdown.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-8 text-center text-xs text-muted-foreground"
                    >
                      No usage recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </section>

      {/* Bottom Actions */}
      <div className="flex flex-wrap gap-2.5 pt-2">
        <Button asChild size="sm" className="rounded-lg">
          <Link href="/generation">Open Playground</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-lg">
          <Link href="/keys">Manage API keys</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-lg">
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
