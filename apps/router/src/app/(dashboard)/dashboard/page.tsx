"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
  const defaultModel = "gemini-2.5-flash";

  const copyToClipboard = (text: string, setter: (val: boolean) => void, label: string) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast.success("Copied to clipboard", {
      description: `${label} has been copied.`,
    });
    setTimeout(() => setter(false), 2000);
  };

  const curlSnippet = `curl https://router.const.web.id/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "${defaultModel}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <span>{getGreeting()}, {userName}!</span>
          <span className="text-2xl">👋</span>
        </h1>
        <p className="text-xs text-muted-foreground font-normal">
          Here&apos;s your API usage overview for today.
        </p>
      </div>

      {/* Row of 4 Metric Cards (Using @const/ui Card with clean monochrome palette) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tokens Used Today */}
        <Card className="rounded-2xl border-border/70 bg-card p-4 transition-colors">
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
            <p className="text-[11px] text-muted-foreground">
              No usage today
            </p>
          </div>
        </Card>

        {/* Requests Today */}
        <Card className="rounded-2xl border-border/70 bg-card p-4 transition-colors">
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
            <p className="text-[11px] text-muted-foreground">
              +0 vs yesterday
            </p>
          </div>
        </Card>

        {/* Success Rate */}
        <Card className="rounded-2xl border-border/70 bg-card p-4 transition-colors">
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
            <p className="text-[11px] text-muted-foreground">
              No traffic
            </p>
          </div>
        </Card>

        {/* Avg Latency */}
        <Card className="rounded-2xl border-border/70 bg-card p-4 transition-colors">
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
            <p className="text-[11px] text-muted-foreground">
              No traffic
            </p>
          </div>
        </Card>
      </div>

      {/* Lower Grid: Usage Trend & Quick Start */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Usage Trend Chart Area */}
        <Card className="lg:col-span-2 rounded-2xl border-border/70 bg-card p-5 flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between pb-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Usage Trend
              </h3>
              <p className="text-xs text-muted-foreground font-normal">
                Token usage over time
              </p>
            </div>
            <div className="flex items-center gap-1 bg-secondary p-1 rounded-full border border-border text-xs font-mono">
              {(["7D", "30D", "90D"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTrendRange(range)}
                  className={`px-2.5 py-0.5 rounded-full cursor-pointer transition-colors ${
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
          <div className="h-60 w-full flex flex-col justify-between py-2">
            <div className="flex-1 flex flex-col justify-between border-b border-border/60 text-[11px] font-mono text-muted-foreground/60">
              <div className="flex justify-between items-center border-b border-border/30 pb-1">
                <span>1.0</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/30 pb-1">
                <span>7.5</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/30 pb-1">
                <span>5</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/30 pb-1">
                <span>2.5</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span>0</span>
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
        <Card className="rounded-2xl border-border/70 bg-card p-5 space-y-4 transition-colors">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-secondary text-foreground flex items-center justify-center">
                <Terminal className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Quick Start
              </h3>
            </div>
            <p className="text-xs text-muted-foreground font-normal pl-9">
              Start making requests in seconds.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {/* Field 1: API Endpoint */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">
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
              <label className="text-[11px] text-muted-foreground font-medium">
                API Key
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary border border-border text-xs">
                <span className="text-muted-foreground italic font-normal">No API key yet</span>
                <Link
                  href="/keys"
                  className="text-xs font-medium text-[#0066ff] hover:underline shrink-0"
                >
                  Create key
                </Link>
              </div>
            </div>

            {/* Field 3: Model */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">
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

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => copyToClipboard(curlSnippet, setCopiedCurl, "cURL command")}
              className="flex-1 rounded-full gap-1.5 text-xs font-medium cursor-pointer h-9 bg-[#0066ff] hover:bg-[#0052cc] text-white border-none shadow-none"
            >
              {copiedCurl ? (
                <Check className="h-3.5 w-3.5 text-white" />
              ) : (
                <Terminal className="h-3.5 w-3.5" />
              )}
              <span>Copy cURL</span>
            </Button>

            <Link href="/endpoints" className="flex-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-full gap-1.5 text-xs font-medium border-border text-foreground hover:bg-secondary cursor-pointer h-9"
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
