"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { getAppUrl } from "@/lib/auth-constants";
import {
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  cn,
  toast,
} from "@const/ui";
import {
  Copy,
  Check,
  Terminal,
  Code2,
  Cpu,
  Layers,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
  Bot,
  Zap,
} from "lucide-react";

export default function DocsPage() {
  const [appUrl, setAppUrl] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<"curl" | "typescript" | "python" | "fetch">("curl");

  useEffect(() => {
    setAppUrl(getAppUrl());
  }, []);

  const baseUrl = useMemo(() => {
    return appUrl ? `${appUrl}/v1` : "https://router.const.dev/v1";
  }, [appUrl]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedKey((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const quickstartSnippets = {
    curl: `curl -X POST "${baseUrl}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -d '{
    "model": "gemini-3.6-flash",
    "messages": [
      {"role": "system", "content": "You are a concise engineering assistant."},
      {"role": "user", "content": "Write an idiomatic TypeScript debounce function."}
    ],
    "temperature": 0.3
  }'`,
    typescript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: process.env.CONST_API_KEY || "sk-const-live-yourkey",
});

async function main() {
  const response = await client.chat.completions.create({
    model: "combo/coding", // Uses dynamic fallback chain
    messages: [
      { role: "user", content: "Explain how zero-copy networking works." },
    ],
    stream: true,
  });

  for await (const chunk of response) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main();`,
    python: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="sk-const-live-yourkey",
)

response = client.chat.completions.create(
    model="gemini-3.6-flash",
    messages=[
        {"role": "user", "content": "Write a Python asyncio task pool."}
    ],
)

print(response.choices[0].message.content)`,
    fetch: `const response = await fetch("${baseUrl}/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-const-live-yourkey",
  },
  body: JSON.stringify({
    model: "gemini-3.6-flash",
    messages: [{ role: "user", content: "Hello Const Gateway!" }],
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);`,
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
            Documentation.
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-light">
            Interactive API reference, OpenAI-compatible endpoint specifications, and routing guides.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-2 bg-secondary/70 px-3 py-1.5 rounded-full">
            <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
              Base URL
            </span>
            <code className="text-xs font-mono text-foreground font-medium selection:bg-foreground selection:text-background">
              {baseUrl}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy(baseUrl, "docs-base-url")}
              className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {copiedKey === "docs-base-url" ? (
                <Check className="h-3 w-3 text-foreground" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>

          <Link href="/generation">
            <Button
              size="sm"
              className="h-8 rounded-full bg-secondary hover:bg-foreground hover:text-background text-foreground text-xs font-medium px-3.5 cursor-pointer gap-1.5"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Playground</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Documentation Tabs */}
      <Tabs defaultValue="quickstart" className="space-y-6">
        <TabsList className="bg-secondary/60 p-1 rounded-full w-full sm:w-auto overflow-x-auto justify-start border-none">
          <TabsTrigger
            value="quickstart"
            className="rounded-full text-xs font-medium px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
          >
            Quickstart
          </TabsTrigger>
          <TabsTrigger
            value="endpoints"
            className="rounded-full text-xs font-medium px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
          >
            Endpoints API
          </TabsTrigger>
          <TabsTrigger
            value="combos"
            className="rounded-full text-xs font-medium px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
          >
            Virtual Combos
          </TabsTrigger>
          <TabsTrigger
            value="quotas"
            className="rounded-full text-xs font-medium px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
          >
            7M Token Quotas
          </TabsTrigger>
          <TabsTrigger
            value="errors"
            className="rounded-full text-xs font-medium px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
          >
            Error Codes
          </TabsTrigger>
        </TabsList>

        {/* 1. Quickstart Section */}
        <TabsContent value="quickstart" className="space-y-6 mt-0">
          <div className="p-6 rounded-2xl bg-card space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-medium text-foreground">
                Getting Started with Const Router
              </h2>
              <p className="text-xs text-muted-foreground font-light">
                Const Router is an OpenAI-compatible reverse proxy. Any client, SDK, or IDE that supports OpenAI can be redirected to Const by changing the base URL.
              </p>
            </div>

            {/* Steps grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-secondary/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-foreground text-background font-mono text-xs flex items-center justify-center font-medium">
                    1
                  </span>
                  <span className="text-xs font-medium text-foreground">Create API Key</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-light">
                  Generate your <code>sk-const-live-...</code> key from the <Link href="/keys" className="underline text-foreground">API keys</Link> page.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-secondary/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-foreground text-background font-mono text-xs flex items-center justify-center font-medium">
                    2
                  </span>
                  <span className="text-xs font-medium text-foreground">Set Base URL</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-light">
                  Point your client or SDK to <code>{baseUrl}</code> with Bearer authorization.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-secondary/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-foreground text-background font-mono text-xs flex items-center justify-center font-medium">
                    3
                  </span>
                  <span className="text-xs font-medium text-foreground">Pick a Model</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-light">
                  Request <code>gemini-3.6-flash</code> or use smart combos like <code>combo/coding</code>.
                </p>
              </div>
            </div>

            {/* Code Snippet Box with Multi-Language Switcher */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-full">
                  {(["curl", "typescript", "python", "fetch"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setActiveLang(lang)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-mono font-medium transition-colors cursor-pointer capitalize",
                        activeLang === lang
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {lang === "typescript" ? "TypeScript" : lang}
                    </button>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(quickstartSnippets[activeLang], `qs-${activeLang}`)}
                  className="h-7 px-3 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer gap-1.5"
                >
                  {copiedKey === `qs-${activeLang}` ? (
                    <>
                      <Check className="h-3 w-3 text-foreground" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Code</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-secondary/80 font-mono text-xs text-foreground overflow-x-auto selection:bg-foreground selection:text-background">
                <pre className="leading-relaxed">
                  {quickstartSnippets[activeLang]}
                </pre>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 2. Endpoints API Reference */}
        <TabsContent value="endpoints" className="space-y-6 mt-0">
          {/* Chat Completions */}
          <div className="p-6 rounded-2xl bg-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Badge className="bg-foreground text-background rounded-full px-2.5 py-0.5 text-xs font-mono border-none font-semibold">
                  POST
                </Badge>
                <code className="text-sm font-mono font-medium text-foreground">
                  /v1/chat/completions
                </code>
              </div>
              <Badge className="bg-secondary text-muted-foreground rounded-full text-[10px] font-mono border-none">
                OpenAI Compatible
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground font-light">
              Generates a model response or reasoning stream given a list of messages. Supports Server-Sent Events (SSE) streaming.
            </p>

            {/* Request Schema Table */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase text-muted-foreground font-semibold tracking-wider">
                Request Body Parameters
              </span>
              <div className="space-y-1.5">
                {[
                  { name: "model", type: "string", required: true, desc: "ID of the model (e.g. 'gemini-3.6-flash') or combo ('combo/coding')." },
                  { name: "messages", type: "array", required: true, desc: "List of conversation messages with 'role' ('system', 'user', 'assistant') and 'content'." },
                  { name: "stream", type: "boolean", required: false, desc: "If true, returns an SSE stream of incremental text deltas." },
                  { name: "temperature", type: "number", required: false, desc: "Sampling temperature between 0.0 and 2.0 (default 0.7)." },
                  { name: "max_tokens", type: "integer", required: false, desc: "Maximum output completion tokens to generate." },
                  { name: "reasoning_effort", type: "string", required: false, desc: "Controls reasoning tokens for thinking models: 'low', 'medium', or 'high'." },
                ].map((param) => (
                  <div key={param.name} className="p-3 rounded-xl bg-secondary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-foreground font-semibold">{param.name}</code>
                      <span className="font-mono text-[10px] text-muted-foreground">({param.type})</span>
                      {param.required && (
                        <span className="text-[9px] font-mono uppercase bg-foreground/10 text-foreground px-1.5 py-0.2 rounded-full">
                          Required
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground text-left sm:text-right font-light text-[11px]">
                      {param.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Models Discovery Endpoint */}
          <div className="p-6 rounded-2xl bg-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Badge className="bg-secondary text-foreground rounded-full px-2.5 py-0.5 text-xs font-mono border-none font-semibold">
                  GET
                </Badge>
                <code className="text-sm font-mono font-medium text-foreground">
                  /v1/models
                </code>
              </div>
              <Badge className="bg-secondary text-muted-foreground rounded-full text-[10px] font-mono border-none">
                OpenAI Compatible
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground font-light">
              Lists all currently available models on Const Router, including standard models, combo routing aliases, and your configured BYOK provider models.
            </p>

            <div className="p-4 rounded-xl bg-secondary/80 font-mono text-xs text-foreground overflow-x-auto">
              <pre className="leading-relaxed">
{`{
  "object": "list",
  "data": [
    { "id": "gemini-3.6-flash", "object": "model", "owned_by": "const" },
    { "id": "combo/coding", "object": "model", "owned_by": "const" },
    { "id": "combo/fast", "object": "model", "owned_by": "const" },
    { "id": "combo/auto", "object": "model", "owned_by": "const" }
  ]
}`}
              </pre>
            </div>
          </div>
        </TabsContent>

        {/* 3. Virtual Combos */}
        <TabsContent value="combos" className="space-y-6 mt-0">
          <div className="p-6 rounded-2xl bg-card space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-medium text-foreground">
                High-Availability Virtual Combos
              </h2>
              <p className="text-xs text-muted-foreground font-light">
                Virtual Combos group multiple underlying models into a single virtual endpoint. If the primary model encounters rate limits (HTTP 429) or upstream downtime (502), Const Router automatically switches to your fallback model with zero downtime.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-secondary/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-foreground" />
                  <code className="text-xs font-mono font-semibold text-foreground">combo/coding</code>
                </div>
                <p className="text-[11px] text-muted-foreground font-light">
                  Optimized for coding agents and IDE autocomplete. Prioritizes Gemini 3.6 Flash and falls back to secondary coding reasoning engines.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-secondary/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-foreground" />
                  <code className="text-xs font-mono font-semibold text-foreground">combo/fast</code>
                </div>
                <p className="text-[11px] text-muted-foreground font-light">
                  Ultra low-latency combo targeting &lt;100ms TTFT (time-to-first-token). Perfect for realtime UI streaming and quick classification.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-secondary/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-foreground" />
                  <code className="text-xs font-mono font-semibold text-foreground">combo/auto</code>
                </div>
                <p className="text-[11px] text-muted-foreground font-light">
                  Intelligent auto-router that balances cost, token quotas, and capability requirements dynamically.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-secondary/30 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Want to create custom model combos with priority or round-robin strategies?
              </span>
              <Link href="/combos">
                <Button
                  size="sm"
                  className="h-8 rounded-full bg-foreground text-background hover:bg-foreground/90 text-xs font-medium px-4 cursor-pointer gap-1"
                >
                  <span>Manage Combos</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </TabsContent>

        {/* 4. Quotas & Fair Use */}
        <TabsContent value="quotas" className="space-y-6 mt-0">
          <div className="p-6 rounded-2xl bg-card space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-medium text-foreground">
                Weekly 7 Million Token Allowance
              </h2>
              <p className="text-xs text-muted-foreground font-light">
                Const provides all developers with a generous 7,000,000 token allowance every week to access hosted models at no cost.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-secondary/40 flex items-start gap-3">
                <Zap className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-foreground">Automatic 7-Day Rolling Cycle</p>
                  <p className="text-muted-foreground font-light">
                    Your 7M token quota begins the moment your account is registered. Every 7 days, your used tokens automatically reset back to 0, granting you a fresh 7M token pool.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-secondary/40 flex items-start gap-3">
                <Cpu className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-foreground">Combined Input + Output Accounting</p>
                  <p className="text-muted-foreground font-light">
                    Both prompt tokens and completion tokens generated by Const models are deducted accurately using server-side token telemetry counters.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-secondary/40 flex items-start gap-3">
                <Layers className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-foreground">BYOK (Bring Your Own Key) Unlimited Routing</p>
                  <p className="text-muted-foreground font-light">
                    When you configure external providers (OpenAI, Anthropic, DeepSeek, Google AI) via the <Link href="/providers" className="underline text-foreground">Providers</Link> tab, your requests bypass the 7M free quota and route directly against your external provider keys.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 5. Error Codes Reference */}
        <TabsContent value="errors" className="space-y-6 mt-0">
          <div className="p-6 rounded-2xl bg-card space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-medium text-foreground">
                HTTP Status Codes &amp; Diagnostics
              </h2>
              <p className="text-xs text-muted-foreground font-light">
                Standard HTTP error codes returned by the gateway and how to resolve them.
              </p>
            </div>

            <div className="space-y-2">
              {[
                {
                  code: "401 Unauthorized",
                  title: "Invalid API Key",
                  desc: "The Bearer authorization header is missing or the provided key is revoked/invalid.",
                  fix: "Verify your API key at /keys and confirm your client sends 'Authorization: Bearer sk-const-live-...'.",
                },
                {
                  code: "404 Not Found",
                  title: "Model Not Found",
                  desc: "The requested model ID does not exist or has not been enabled on your account.",
                  fix: "Check available models via GET /v1/models or use 'gemini-3.6-flash'.",
                },
                {
                  code: "429 Too Many Requests",
                  title: "Weekly Quota Exceeded",
                  desc: "You have exhausted your weekly 7,000,000 free token quota.",
                  fix: "Wait for the 7-day cycle reset countdown shown on your dashboard, or connect external BYOK providers.",
                },
                {
                  code: "502 Bad Gateway",
                  title: "Upstream Provider Failure",
                  desc: "The upstream AI provider is experiencing transient downtime or timed out.",
                  fix: "Route through a Virtual Combo (e.g. 'combo/coding') to ensure automatic failover.",
                },
              ].map((err) => (
                <div key={err.code} className="p-4 rounded-xl bg-secondary/40 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-foreground">{err.code}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">{err.title}</span>
                  </div>
                  <p className="text-muted-foreground font-light">{err.desc}</p>
                  <p className="text-[11px] text-foreground/90 font-mono pt-1">
                    Fix: {err.fix}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
