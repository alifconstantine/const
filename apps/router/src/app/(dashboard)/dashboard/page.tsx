"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  Card,
  Button,
  toast,
} from "@const/ui";
import {
  Coins,
  TrendingUp,
  ShieldCheck,
  Clock,
  Copy,
  Check,
  Terminal,
  ExternalLink,
} from "lucide-react";

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

  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedModel, setCopiedModel] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [trendRange, setTrendRange] = useState<"7D" | "30D" | "90D">("7D");

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const userName = user?.name ? user.name.split(" ")[0] : "Developer";

  const apiEndpoint = "https://router.const.web.id/api/v1";
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
  const curlSnippet = `curl https://router.const.web.id/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${curlKey}" \\
  -d '{
    "model": "${defaultModel}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

  return (
    <div className="space-y-8">
      {/* Top Greeting Header (Editorial Lora serif title matching DESIGN.md) */}
      <div className="space-y-1.5">
        <h1 className="text-3xl sm:text-4xl font-serif font-normal text-foreground tracking-tight flex items-center gap-2">
          <span>{getGreeting()}, {userName}!</span>
          <span className="text-3xl">👋</span>
        </h1>
        <p className="text-sm text-muted-foreground font-light">
          Here&apos;s your API usage overview for today.
        </p>
      </div>

      {/* Row of 4 Metric Cards (Monochrome tint ladder & iOS 30% squircle icons) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tokens Used Today */}
        <Card className="rounded-3xl border-border/70 bg-card p-5 transition-colors">
          <div className="flex items-center gap-2.5 pb-3">
            <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center">
              <Coins className="h-4 w-4 stroke-[1.75]" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Tokens Used Today</span>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-semibold tracking-tight text-foreground font-mono">
              0 <span className="text-xs text-muted-foreground font-sans font-normal">tokens</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-light">
              No usage today
            </p>
          </div>
        </Card>

        {/* Requests Today */}
        <Card className="rounded-3xl border-border/70 bg-card p-5 transition-colors">
          <div className="flex items-center gap-2.5 pb-3">
            <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center">
              <TrendingUp className="h-4 w-4 stroke-[1.75]" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Requests Today</span>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-semibold tracking-tight text-foreground font-mono">
              0
            </div>
            <p className="text-[11px] text-muted-foreground font-light">
              +0 vs yesterday
            </p>
          </div>
        </Card>

        {/* Success Rate */}
        <Card className="rounded-3xl border-border/70 bg-card p-5 transition-colors">
          <div className="flex items-center gap-2.5 pb-3">
            <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 stroke-[1.75]" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Success Rate</span>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-semibold tracking-tight text-foreground font-mono">
              0.0%
            </div>
            <p className="text-[11px] text-muted-foreground font-light">
              No traffic
            </p>
          </div>
        </Card>

        {/* Avg Latency */}
        <Card className="rounded-3xl border-border/70 bg-card p-5 transition-colors">
          <div className="flex items-center gap-2.5 pb-3">
            <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center">
              <Clock className="h-4 w-4 stroke-[1.75]" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Avg Latency</span>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-semibold tracking-tight text-muted-foreground font-mono">
              —
            </div>
            <p className="text-[11px] text-muted-foreground font-light">
              No traffic
            </p>
          </div>
        </Card>
      </div>

      {/* Lower Grid: Usage Trend & Quick Start */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Usage Trend Chart Area */}
        <Card className="lg:col-span-2 rounded-3xl border-border/70 bg-card p-6 flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between pb-4">
            <div className="space-y-0.5">
              <h3 className="text-base font-semibold tracking-tight text-foreground font-sans">
                Usage Trend
              </h3>
              <p className="text-xs text-muted-foreground font-light">
                Token usage over time
              </p>
            </div>
            <div className="flex items-center gap-1 bg-secondary p-1 rounded-full border border-border text-xs font-mono">
              {(["7D", "30D", "90D"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTrendRange(range)}
                  className={`px-3 py-0.5 rounded-full cursor-pointer transition-colors ${
                    trendRange === range
                      ? "bg-card text-foreground font-medium shadow-none"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Minimal Empty Monochrome Chart Frame */}
          <div className="h-64 w-full flex flex-col justify-between py-2">
            <div className="flex-1 flex flex-col justify-between border-b border-border/60 text-[11px] font-mono text-muted-foreground/60">
              <div className="flex justify-between items-center border-b border-border/30 pb-1">
                <span>10.0</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/30 pb-1">
                <span>7.5</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/30 pb-1">
                <span>5.0</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/30 pb-1">
                <span>2.5</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span>0.0</span>
                <div className="flex-1 border-b border-border/60 mx-2" />
              </div>
            </div>

            {/* Date timeline labels */}
            <div className="flex justify-between text-[11px] font-mono text-muted-foreground/60 pt-2 px-1">
              <span>Aug 28</span>
              <span>Aug 29</span>
              <span>Aug 30</span>
              <span>Aug 31</span>
              <span>Sep 1</span>
              <span>Sep 2</span>
              <span>Sep 3</span>
            </div>
          </div>
        </Card>

        {/* Right: Quick Start Card */}
        <Card className="rounded-3xl border-border/70 bg-card p-6 space-y-5 transition-colors">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-secondary text-foreground flex items-center justify-center">
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

          <div className="space-y-3.5 pt-1">
            {/* Field 1: API Endpoint */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
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
              <label className="text-xs text-muted-foreground font-medium">
                API Key
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary border border-border text-xs">
                {activeKey ? (
                  <>
                    <span className="text-foreground font-mono font-medium">{activeKey.keyPrefix}</span>
                    <Link
                      href="/keys"
                      className="text-xs font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 shrink-0"
                    >
                      Manage keys
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground italic font-light">No API key yet</span>
                    <Link
                      href="/keys"
                      className="text-xs font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 shrink-0"
                    >
                      Create key
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Field 3: Model */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                Model
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

          {/* Action Buttons (Stadium-pill geometry per DESIGN.md) */}
          <div className="flex items-center gap-2.5 pt-2">
            <Button
              size="sm"
              onClick={() => copyToClipboard(curlSnippet, setCopiedCurl, "cURL command")}
              className="flex-1 rounded-full gap-2 text-xs font-medium cursor-pointer h-10 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none border border-transparent"
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
                className="w-full rounded-full gap-2 text-xs font-medium border border-border bg-background hover:bg-secondary text-foreground cursor-pointer h-10 shadow-none"
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
