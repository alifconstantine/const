"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTER_ENDPOINTS } from "@/lib/api-contract";
import { FREE_MODEL_IDS, BUILTIN_MODELS } from "@/lib/model-specs";
import { Button, Badge, ScrollArea, toast, cn } from "@const/ui";
import {
  Copy,
  Check,
  Terminal,
  ArrowLeft,
  BookOpen,
  Key,
  Zap,
  Shield,
  Cpu,
  Layers,
  Search,
  FileText,
  Mic,
  Video,
  Globe,
  Code2,
  Sliders,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface CodeSnippetProps {
  id: string;
  tabs: Array<{
    label: string;
    lang: string;
    code: string;
  }>;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}

function CodeSnippetTabs({ id, tabs, copiedId, onCopy }: CodeSnippetProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeTab = tabs[activeIdx] || tabs[0]!;
  const copyKey = `${id}-${activeIdx}`;

  return (
    <div className="rounded-xl bg-card border border-border/60 overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 border-b border-border/40 text-xs">
        <div className="flex items-center gap-1">
          {tabs.map((tab, idx) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={cn(
                "px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors",
                activeIdx === idx
                  ? "bg-secondary text-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onCopy(copyKey, activeTab.code)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
        >
          {copiedId === copyKey ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-foreground/90 selection:bg-primary/20">
        <code>{activeTab.code}</code>
      </pre>
    </div>
  );
}

export default function DocsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Snippet copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy snippet");
    }
  };

  const navGroups = [
    {
      title: "Start Building",
      items: [
        { label: "Quickstart", href: "#quickstart" },
        { label: "Authentication", href: "#authentication" },
        { label: "Models & Allowance", href: "#models-allowance" },
        { label: "SDKs & Drop-in Replacement", href: "#sdks" },
        { label: "Coding Agents Setup", href: "#agents-setup" },
      ],
    },
    {
      title: "Core Chat API",
      items: [
        { label: "Chat Completions", href: "#chat" },
        { label: "Streaming (SSE)", href: "#streaming" },
        { label: "Reasoning Effort", href: "#reasoning-effort" },
        { label: "Web Search Grounding", href: "#web-search-grounding" },
        { label: "Vision & Multimodal", href: "#vision" },
        { label: "Tool Calling & JSON Mode", href: "#tools-json" },
      ],
    },
    {
      title: "Utility & Multimodal APIs",
      items: [
        { label: "Model Discovery & Catalog", href: "#models-api" },
        { label: "Audio Transcription (Whisper)", href: "#audio-transcription" },
        { label: "Web Search API", href: "#web-search-api" },
        { label: "Web Content Extractor", href: "#web-fetch-api" },
        { label: "YouTube Transcript", href: "#youtube-transcript-api" },
      ],
    },
    {
      title: "Routing & Reliability",
      items: [
        { label: "Virtual Combos & Failover", href: "#combos" },
        { label: "Response Headers & Telemetry", href: "#headers" },
      ],
    },
    {
      title: "Limits & Governance",
      items: [
        { label: "API Keys & Guardrails", href: "#keys-guardrails" },
        { label: "Errors & Status Codes", href: "#errors" },
        { label: "Per-Token Metering", href: "#metering" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Top Docs Bar */}
      <div className="border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="text-border shrink-0">/</span>
          <span className="text-xs font-medium text-foreground truncate">Documentation</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs rounded-lg gap-1.5 font-mono hidden sm:inline-flex"
            onClick={() => copyCode("nav-base-url", "https://router.const.web.id/v1")}
          >
            {copiedId === "nav-base-url" ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>https://router.const.web.id/v1</span>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8 text-xs rounded-lg px-2.5 sm:px-3">
            <Link href="/keys">
              <span className="sm:hidden">+ Key</span>
              <span className="hidden sm:inline">Create API key</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 text-xs rounded-lg px-2.5 sm:px-3">
            <Link href="/models">Pricing</Link>
          </Button>
        </div>
      </div>

      {/* Main Container with Sticky Sidebar and Scrollable Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex gap-12 items-start">
        {/* Left Sidebar: Fixed / Sticky non-scrolling menu */}
        <aside className="w-60 shrink-0 hidden md:block sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto pr-4 select-none">
          <div className="space-y-6">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-2">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className="block px-2.5 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 min-w-0 max-w-3xl space-y-16 pb-28">
          {/* Header */}
          <header className="space-y-4 pb-6 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary">
                v1 Specification
              </Badge>
              <Badge variant="secondary" className="text-xs font-mono">
                OpenAI Compatible
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-medium tracking-tight">
              Const Router API Documentation
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Const Router is a high-performance universal AI gateway providing drop-in OpenAI-compatible access to frontier models (Claude, DeepSeek, GPT, Gemini, Qwen, GLM, MiniMax, Grok), speech-to-text, live web search grounding, and smart virtual combos with automated failover.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
              <span className="px-2.5 py-1 bg-secondary/50 rounded-md border border-border/40 text-foreground font-medium">
                Base URL: https://router.const.web.id/v1
              </span>
              <span className="px-2.5 py-1 bg-secondary/30 rounded-md border border-border/40">
                Key Prefix: sk-const-live-
              </span>
              <span className="px-2.5 py-1 bg-secondary/30 rounded-md border border-border/40">
                Weekly Free Quota: 7M Tokens
              </span>
            </div>
          </header>

          {/* Quickstart */}
          <section id="quickstart" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Quickstart</h2>
              <Badge variant="secondary" className="font-mono text-[10px]">
                Drop-in Replacement
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connecting to Const Router requires only two changes in standard client code: point your Base URL to <code className="text-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">https://router.const.web.id/v1</code> and supply your <code className="text-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">sk-const-live-...</code> API key.
            </p>

            <CodeSnippetTabs
              id="quickstart"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/chat/completions \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4.1-flash:free",
    "messages": [
      {"role": "user", "content": "Explain Virtual Combos in two sentences."}
    ],
    "temperature": 0.3
  }'`,
                },
                {
                  label: "Python (OpenAI SDK)",
                  lang: "python",
                  code: `from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key="sk-const-live-YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[
        {"role": "user", "content": "Explain Virtual Combos in two sentences."}
    ],
)

print(response.choices[0].message.content)`,
                },
                {
                  label: "TypeScript / Node.js",
                  lang: "typescript",
                  code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://router.const.web.id/v1",
  apiKey: process.env.CONST_API_KEY || "sk-const-live-YOUR_API_KEY",
});

const response = await client.chat.completions.create({
  model: "deepseek-v4.1-flash:free",
  messages: [{ role: "user", content: "Explain Virtual Combos in two sentences." }],
});

console.log(response.choices[0].message.content);`,
                },
              ]}
            />
          </section>

          {/* Authentication */}
          <section id="authentication" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Authentication</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every inference request requires a valid API key passed in the <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">Authorization</code> header with the <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">Bearer</code> prefix.
            </p>

            <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 text-xs font-mono space-y-1.5">
              <p className="text-muted-foreground"># Standard Authorization Header</p>
              <p className="text-foreground">Authorization: Bearer sk-const-live-xxxxxxxxxxxxxxxxxxxxxxxx</p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border/60 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">API Key Lifecycle & Security:</p>
              <ul className="list-disc list-inside space-y-1 leading-relaxed">
                <li>Keys are generated with 256-bit entropy and start with the prefix <code className="font-mono text-foreground">sk-const-live-</code>.</li>
                <li>Keys are revealed <strong>only once</strong> upon creation in Dashboard &rarr; API Keys. Plaintext keys are never stored in backend databases (only SHA-256 hashes).</li>
                <li>Daily spend ceilings and model allowlists can be assigned per key to prevent runaway billing.</li>
                <li>Invalid, revoked, or rate-limited keys are rejected immediately with HTTP 401 or 403 before reaching upstream model engines.</li>
              </ul>
            </div>
          </section>

          {/* Models & Allowance */}
          <section id="models-allowance" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Models & Billing Tiers</h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                Free vs Paid
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Const Router operates two distinct billing tiers: a generous <strong>Free Allowance</strong> and a <strong>Wholesale Pay-per-token</strong> tier.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-card border border-border/60 space-y-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Weekly Free Allowance</span>
                <p className="text-2xl font-medium tracking-tight tabular-nums text-foreground">7,000,000</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tokens per 7-day rolling cycle. Shared across all models carrying the <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">:free</code> suffix. Resets automatically every 7 days.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-card border border-border/60 space-y-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Paid Wholesale Models</span>
                <p className="text-2xl font-medium tracking-tight text-foreground">Per-Token Micro-cost</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct upstream wholesale pricing without monthly subscription lock-ins. Deducted from wallet balance in nano-USD per request.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <p className="text-xs font-medium text-foreground">Available Free Tier Model Identifiers:</p>
              <div className="flex flex-wrap gap-2">
                {FREE_MODEL_IDS.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 bg-secondary/60 rounded-md border border-border/50 text-foreground"
                  >
                    <Sparkles className="h-3 w-3 text-emerald-500" />
                    {id}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Important:</strong> To take advantage of the free allowance, you must specify the exact ID ending in <code className="text-foreground font-mono">:free</code> (e.g. <code className="text-foreground font-mono">deepseek-v4.1-flash:free</code>). Calling non-suffixed IDs (e.g. <code className="text-foreground font-mono">deepseek-v4.1-flash</code>) routes to the paid tier and deducts wallet credits.
              </p>
            </div>
          </section>

          {/* SDKs & Drop-in Replacement */}
          <section id="sdks" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">SDKs & Drop-in Replacement</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Because Const Router conforms to the OpenAI specification, you do not need a custom library. Use official client libraries across all ecosystems:
            </p>

            <CodeSnippetTabs
              id="sdks-examples"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "Python (OpenAI)",
                  lang: "python",
                  code: `# pip install openai
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key=os.environ.get("CONST_API_KEY"),
)`,
                },
                {
                  label: "Node / TypeScript",
                  lang: "typescript",
                  code: `// npm install openai
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://router.const.web.id/v1",
  apiKey: process.env.CONST_API_KEY,
});`,
                },
                {
                  label: "Go (go-openai)",
                  lang: "go",
                  code: `config := openai.DefaultConfig("sk-const-live-YOUR_KEY")
config.BaseURL = "https://router.const.web.id/v1"
client := openai.NewClientWithConfig(config)`,
                },
              ]}
            />
          </section>

          {/* Coding Agents Setup */}
          <section id="agents-setup" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Coding Agents & IDE Setup</h2>
              <Badge variant="secondary" className="font-mono text-[10px]">
                Developer Tools
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Supercharge autonomous coding agents, VS Code extensions, and terminal CLIs by pointing their OpenAI-compatible provider configuration to Const Router.
            </p>

            <CodeSnippetTabs
              id="agents-configs"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "Cursor IDE",
                  lang: "markdown",
                  code: `1. Open Cursor Settings (Cmd + , or Ctrl + ,).
2. Navigate to "Models" -> "OpenAI API Key".
3. Toggle "Override OpenAI Base URL" and enter:
   https://router.const.web.id/v1
4. Paste your API Key:
   sk-const-live-YOUR_API_KEY
5. In the model dropdown, type your model ID:
   deepseek-v4.1-flash:free (or claude-sonnet-5.5 / combo/coding)`,
                },
                {
                  label: "Cline / Roo Code",
                  lang: "markdown",
                  code: `1. Click the gear icon in the Cline / Roo Code panel.
2. Under "API Provider", select "OpenAI Compatible".
3. Base URL:
   https://router.const.web.id/v1
4. API Key:
   sk-const-live-YOUR_API_KEY
5. Model ID:
   deepseek-v4.1-flash:free or claude-sonnet-5.5`,
                },
                {
                  label: "Continue.dev",
                  lang: "json",
                  code: `// ~/.continue/config.json
{
  "models": [
    {
      "title": "Const DeepSeek Flash (Free)",
      "provider": "openai",
      "model": "deepseek-v4.1-flash:free",
      "apiBase": "https://router.const.web.id/v1",
      "apiKey": "sk-const-live-YOUR_API_KEY"
    },
    {
      "title": "Const Claude Sonnet 5.5",
      "provider": "openai",
      "model": "claude-sonnet-5.5",
      "apiBase": "https://router.const.web.id/v1",
      "apiKey": "sk-const-live-YOUR_API_KEY"
    }
  ]
}`,
                },
                {
                  label: "Aider / CLI",
                  lang: "bash",
                  code: `# Configure environment variables for Aider:
export OPENAI_API_BASE="https://router.const.web.id/v1"
export OPENAI_API_KEY="sk-const-live-YOUR_API_KEY"

# Start Aider with any Const Router model:
aider --model openai/deepseek-v4.1-flash:free`,
                },
              ]}
            />
          </section>

          {/* Chat Completions */}
          <section id="chat" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Chat Completions</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Endpoint: <code className="text-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">POST /v1/chat/completions</code>. Supports streaming, reasoning controls, function/tool calling, structured JSON output, vision inputs, and live web search grounding.
            </p>

            <CodeSnippetTabs
              id="chat-completions"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/chat/completions \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4.1-flash:free",
    "messages": [
      {"role": "system", "content": "You are a concise software architect."},
      {"role": "user", "content": "Compare quicksort vs mergesort cache locality."}
    ],
    "temperature": 0.2,
    "max_tokens": 1024
  }'`,
                },
                {
                  label: "Python",
                  lang: "python",
                  code: `from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key="sk-const-live-YOUR_API_KEY",
)

completion = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[
        {"role": "system", "content": "You are a concise software architect."},
        {"role": "user", "content": "Compare quicksort vs mergesort cache locality."},
    ],
    temperature=0.2,
    max_tokens=1024,
)

print(completion.choices[0].message.content)`,
                },
              ]}
            />
          </section>

          {/* Streaming (SSE) */}
          <section id="streaming" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Streaming (Server-Sent Events)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enable SSE by setting <code className="text-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">stream: true</code>. Stream frames pass through with zero proxy buffering delays. The terminal chunk delivers exact token telemetry and usage counters:
            </p>

            <CodeSnippetTabs
              id="streaming-example"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "Python Streaming",
                  lang: "python",
                  code: `stream = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[{"role": "user", "content": "Write a 4-line poem about latency."}],
    stream=True,
)

for chunk in stream:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)`,
                },
                {
                  label: "Raw SSE Frames",
                  lang: "text",
                  code: `data: {"choices": [{"delta": {"content": "Zero"}}]}
data: {"choices": [{"delta": {"content": " buffer"}}]}
data: {"choices": [{"delta": {"content": " speed."}}]}
data: {"usage": {"prompt_tokens": 18, "completion_tokens": 24, "total_tokens": 42}}
data: [DONE]`,
                },
              ]}
            />
          </section>

          {/* Reasoning Effort */}
          <section id="reasoning-effort" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Reasoning Effort</h2>
              <Badge variant="secondary" className="font-mono text-[10px]">
                Thinking Control
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For reasoning models (such as DeepSeek R1, GLM thinking, and OpenAI reasoning architectures), pass the <code className="text-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">reasoning_effort</code> parameter to modulate internal thought token budgets before generating answers.
            </p>

            <div className="rounded-xl bg-card border border-border/60 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-xs min-w-[500px]">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border/40 font-mono">
                  <tr>
                    <th className="px-4 py-3 font-normal">Effort Level</th>
                    <th className="px-4 py-3 font-normal">Thought Budget</th>
                    <th className="px-4 py-3 font-normal">Best Used For</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">"low"</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Minimal chain-of-thought tokens. Lowest latency.
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Quick lookups, high-concurrency bots, simple refactors
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">"medium"</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Balanced reasoning exploration (default setting).
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      General debugging, unit test synthesis, architecture questions
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">"high"</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Extended internal exploration and self-correction cycles.
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Algorithmic puzzles, mathematical proofs, multi-file changes
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">"max"</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Maximal thinking depth up to context token boundaries.
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Mission-critical bug audits and difficult logic puzzles
                    </td>
                  </tr>
                </tbody></table></div></div>

            <CodeSnippetTabs
              id="reasoning-snippet"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "Python",
                  lang: "python",
                  code: `response = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[{"role": "user", "content": "Design an idempotent distributed lock with redis."}],
    reasoning_effort="high",
)
print(response.choices[0].message.content)`,
                },
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/chat/completions \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4.1-flash:free",
    "messages": [{"role": "user", "content": "Solve the 8 queens puzzle."}],
    "reasoning_effort": "high"
  }'`,
                },
              ]}
            />
          </section>

          {/* Web Search Grounding */}
          <section id="web-search-grounding" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Web Search Grounding</h2>
              <Badge variant="secondary" className="font-mono text-[10px]">
                Real-Time Grounding
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Equip any model with live web search grounding directly through chat completions by setting <code className="text-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">web_search: true</code> or <code className="text-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">web_search: "deep-research"</code>. Const Router autonomously searches verified sources, decomposes queries, and injects factual citations into the model prompt before response generation.
            </p>

            <CodeSnippetTabs
              id="web-search-chat"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "Python (extra_body)",
                  lang: "python",
                  code: `response = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[{"role": "user", "content": "What were the major tech releases this week?"}],
    extra_body={"web_search": "deep-research"},
)

print(response.choices[0].message.content)`,
                },
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/chat/completions \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4.1-flash:free",
    "messages": [
      {"role": "user", "content": "What is the latest release version of Next.js?"}
    ],
    "web_search": true
  }'`,
                },
              ]}
            />
          </section>

          {/* Vision & Multimodal */}
          <section id="vision" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Vision & Multimodal Inputs</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pass image URLs or Base64 data URIs using the standard OpenAI content block structure. Supported models include <code className="text-foreground font-mono">deepseek-v4.1-flash:free</code>, <code className="text-foreground font-mono">qwen-3.8-omni-flash:free</code>, <code className="text-foreground font-mono">gemini-3.8-flash</code>, and <code className="text-foreground font-mono">claude-sonnet-5.5</code>.
            </p>

            <CodeSnippetTabs
              id="vision-snippet"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "Python Vision",
                  lang: "python",
                  code: `response = client.chat.completions.create(
    model="gemini-3.8-flash",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Describe this architecture diagram in detail:"},
                {
                    "type": "image_url",
                    "image_url": {"url": "https://example.com/system-architecture.png"},
                },
            ],
        }
    ],
)`,
                },
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/chat/completions \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gemini-3.8-flash",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Extract all text from this receipt:"},
          {"type": "image_url", "image_url": {"url": "https://example.com/receipt.jpg"}}
        ]
      }
    ]
  }'`,
                },
              ]}
            />
          </section>

          {/* Tool Calling & JSON Mode */}
          <section id="tools-json" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Tool Calling & Structured JSON</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Const Router supports standard OpenAI tool schemas via <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">tools</code> and <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">tool_choice</code>. For guaranteed JSON schemas without tools, pass <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">response_format: {"{"} "type": "json_object" {"}"}</code>.
            </p>

            <CodeSnippetTabs
              id="tools-snippet"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "Function Calling",
                  lang: "python",
                  code: `tools = [
    {
        "type": "function",
        "function": {
            "name": "lookup_stock_ticker",
            "description": "Fetch real-time stock quote by ticker symbol",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "e.g. AAPL or NVDA"}
                },
                "required": ["ticker"],
            },
        },
    }
]

response = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[{"role": "user", "content": "What is the price of Nvidia stock?"}],
    tools=tools,
    tool_choice="auto",
)`,
                },
                {
                  label: "JSON Object Mode",
                  lang: "json",
                  code: `{
  "model": "deepseek-v4.1-flash:free",
  "messages": [
    {"role": "system", "content": "You are a database normalizer. Output valid JSON only."},
    {"role": "user", "content": "List 3 SQL indices for a users table."}
  ],
  "response_format": { "type": "json_object" }
}`,
                },
              ]}
            />
          </section>

          {/* Model Discovery & Catalog */}
          <section id="models-api" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Model Discovery & Catalog</h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                GET /v1/models
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Query available models, context windows, capabilities, and token pricing rates. When called with your <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">Authorization</code> header, the response dynamically includes your active <strong>Virtual Combos</strong> (<code className="text-foreground font-mono">combo/&lt;slug&gt;</code>).
            </p>

            <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 text-xs font-mono space-y-1">
              <p className="text-muted-foreground"># Filter models by type: chat, audio, search, or all</p>
              <p className="text-foreground">GET https://router.const.web.id/v1/models?type=all</p>
            </div>

            <CodeSnippetTabs
              id="models-discovery"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/models \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY"`,
                },
                {
                  label: "Response JSON Schema",
                  lang: "json",
                  code: `{
  "object": "list",
  "data": [
    {
      "id": "deepseek-v4.1-flash:free",
      "name": "DeepSeek v4.1 Flash:free",
      "tier": "free",
      "context_length": 1000000,
      "max_output_tokens": 128000,
      "capabilities": {
        "tool_calling": true,
        "vision": true,
        "reasoning": true
      },
      "pricing": {
        "prompt": "0",
        "completion": "0",
        "cache": "0",
        "unit": "USD/token"
      }
    },
    {
      "id": "combo/my-coding-stack",
      "name": "My Coding Stack",
      "owned_by": "user",
      "category": "llm",
      "type": "chat",
      "stream_required": true,
      "billing": "selected_target"
    }
  ]
}`,
                },
              ]}
            />
          </section>

          {/* Audio Transcription */}
          <section id="audio-transcription" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Audio Transcription (Whisper)</h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                POST /v1/audio/transcriptions
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Convert speech to text using <code className="text-foreground font-mono">whisper-large-v3-turbo</code>. Supports audio and video files up to 25 MB with millisecond timestamp segmentation. Billed at <strong>$0.006 per audio minute</strong>.
            </p>

            <CodeSnippetTabs
              id="whisper-snippet"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "cURL (Multipart)",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/audio/transcriptions \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -F "file=@meeting_recording.mp3" \\
  -F "model=whisper-large-v3-turbo" \\
  -F "response_format=verbose_json"`,
                },
                {
                  label: "Python (OpenAI SDK)",
                  lang: "python",
                  code: `with open("meeting_recording.mp3", "rb") as audio_file:
    transcription = client.audio.transcriptions.create(
        model="whisper-large-v3-turbo",
        file=audio_file,
        response_format="verbose_json",
    )

print(transcription.text)`,
                },
                {
                  label: "Response JSON",
                  lang: "json",
                  code: `{
  "text": "Hello and welcome to the quarterly planning meeting.",
  "duration": 48.5,
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 3.8,
      "text": "Hello and welcome to the quarterly planning meeting."
    }
  ]
}`,
                },
              ]}
            />
          </section>

          {/* Web Search API */}
          <section id="web-search-api" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Web Search API</h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                POST /v1/search
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Perform direct web searches and multi-step deep research queries. Returns structured sources, titles, snippets, and verified destination URLs. Billed at <strong>$0.005 per search request</strong>.
            </p>

            <CodeSnippetTabs
              id="search-api-snippet"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/search \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Recent advances in solid state lithium batteries 2026",
    "mode": "deep-research",
    "num_results": 5
  }'`,
                },
                {
                  label: "GET Request",
                  lang: "bash",
                  code: `curl "https://router.const.web.id/v1/search?query=OpenAI+GPT-6+architecture&num_results=3" \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY"`,
                },
                {
                  label: "Response JSON",
                  lang: "json",
                  code: `{
  "query": "Solid state battery breakthroughs 2026",
  "results": [
    {
      "title": "Silicon Anode Energy Density Scaling",
      "url": "https://example.com/energy-research",
      "snippet": "Researchers demonstrated 500 Wh/kg cells with over 1000 cycles..."
    }
  ]
}`,
                },
              ]}
            />
          </section>

          {/* Web Content Extractor */}
          <section id="web-fetch-api" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Web Content Extractor</h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                POST /v1/fetch
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Extract clean markdown text and headings from any public web page, stripping navigation, scripts, and cookie banners. Supports optional subpage crawling with strict SSRF protection.
            </p>

            <CodeSnippetTabs
              id="fetch-api-snippet"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/fetch \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://docs.github.com/en/actions",
    "crawl": true,
    "max_pages": 5
  }'`,
                },
                {
                  label: "Response JSON",
                  lang: "json",
                  code: `{
  "url": "https://docs.github.com/en/actions",
  "title": "GitHub Actions Documentation",
  "content": "# GitHub Actions\\n\\nAutomate your workflow from idea to production...",
  "subpagesCount": 4,
  "pages": [
    {"url": "https://docs.github.com/en/actions/quickstart", "title": "Quickstart", "content": "..."}
  ]
}`,
                },
              ]}
            />
          </section>

          {/* YouTube Transcript */}
          <section id="youtube-transcript-api" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">YouTube Transcript Extractor</h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                POST /v1/transcript
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Extract timestamped captions and transcripts from any public YouTube video using either the full watch URL or video ID.
            </p>

            <CodeSnippetTabs
              id="transcript-api-snippet"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl https://router.const.web.id/v1/transcript \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'`,
                },
                {
                  label: "Response JSON",
                  lang: "json",
                  code: `{
  "videoId": "dQw4w9WgXcQ",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Music Video Title",
  "author": "Artist Name",
  "language": "en",
  "lineCount": 85,
  "transcript": "[00:00] We're no strangers to love\\n[00:04] You know the rules and so do I..."
}`,
                },
              ]}
            />
          </section>

          {/* Virtual Combos */}
          <section id="combos" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Virtual Combos & Automated Failover</h2>
              <Badge variant="secondary" className="font-mono text-[10px]">
                High Availability
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Virtual Combos group multiple candidate models under a single slug (<code className="text-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">model: "combo/my-coding-stack"</code>). When your primary model returns HTTP 429 (rate limited), 503 (upstream outage), or encounters high latency/timeouts, Const Router automatically fails over to the next candidate model in the chain before replying to your client.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1.5 text-xs">
                <span className="font-medium text-foreground">Failover Guarantees:</span>
                <p className="text-muted-foreground leading-relaxed">
                  Tool call parameters, message structure, and system prompts are preserved intact across failover attempts. Combos always enforce <code className="text-foreground font-mono">stream: true</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1.5 text-xs">
                <span className="font-medium text-foreground">Target Settlement:</span>
                <p className="text-muted-foreground leading-relaxed">
                  Cost and quota settlement apply only to the model that successfully fulfilled the request. Unsuccessful attempts incur zero charges.
                </p>
              </div>
            </div>

            <CodeSnippetTabs
              id="combo-call"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "Calling a Combo",
                  lang: "python",
                  code: `response = client.chat.completions.create(
    model="combo/my-coding-stack",
    messages=[{"role": "user", "content": "Refactor this database query"}],
    stream=True,
)`,
                },
                {
                  label: "Failover Telemetry Headers",
                  lang: "text",
                  code: `HTTP/1.1 200 OK
X-Const-Request-Id: req_9a8f27d4c1
X-Const-Combo-Selected-Model: qwen-3.8-omni-flash:free
X-Const-Combo-Fallbacks: 1
X-Const-Cost: 0`,
                },
              ]}
            />
          </section>

          {/* Response Headers & Telemetry */}
          <section id="headers" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Response Headers & Telemetry</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every request settled by Const Router returns informative headers to aid in observability and billing reconciliation:
            </p>

            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border/40 font-mono">
                  <tr>
                    <th className="px-4 py-3 font-normal">Header Name</th>
                    <th className="px-4 py-3 font-normal">Description</th>
                    <th className="px-4 py-3 font-normal">Example Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">X-Const-Request-Id</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Unique request trace identifier. Use this when inspecting logs.
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">req_8d2f194c7b</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">X-Const-Cost</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Settled cost deducted from balance in nano-USD (1 USD = 1,000,000,000 nano-USD).
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">125000</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">X-Const-Combo-Selected-Model</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      The exact model that answered the request when routing through a Virtual Combo.
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">deepseek-v4.1-flash:free</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">X-Const-Combo-Fallbacks</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Number of fallback attempts executed prior to reaching a successful model.
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* API Keys & Guardrails */}
          <section id="keys-guardrails" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">API Keys & Guardrails</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Protect your applications against unintended budget consumption or model misuse:
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2 text-xs">
                <span className="font-medium text-foreground">Daily Spend Limits</span>
                <p className="text-muted-foreground leading-relaxed">
                  Set hard USD or token caps per key that reset at 00:00 UTC daily. Requests exceeding this threshold receive HTTP 429 before invoking upstream providers.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2 text-xs">
                <span className="font-medium text-foreground">Model Allowlist Scoping</span>
                <p className="text-muted-foreground leading-relaxed">
                  Restrict specific API keys to free tier models only, or restrict sensitive production keys from calling non-generative utility endpoints.
                </p>
              </div>
            </div>
          </section>

          {/* Errors & Status Codes */}
          <section id="errors" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Errors & Status Codes</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Const Router preserves standard HTTP error codes and returns consistent OpenAI-compatible error objects:
            </p>

            <div className="rounded-xl bg-card border border-border/60 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-xs min-w-[500px]">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border/40 font-mono">
                  <tr>
                    <th className="px-4 py-3 font-normal">Code</th>
                    <th className="px-4 py-3 font-normal">Meaning</th>
                    <th className="px-4 py-3 font-normal">Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr>
                    <td className="px-4 py-3 text-destructive font-medium">400</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Malformed request or invalid JSON payload</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Verify parameter types and JSON formatting</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-destructive font-medium">401 / 403</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Invalid, revoked, or model-restricted API key</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Generate an active sk-const-live- key in Dashboard &rarr; API Keys</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-amber-500 font-medium">402</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Credit balance depleted or weekly free quota exceeded</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Top up credit or switch to an eligible :free model</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-destructive font-medium">413</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Request payload exceeds limit (4 MB for chat, 25 MB for audio)</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Trim conversation history or compress uploaded media</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-amber-500 font-medium">429</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Rate limit or daily spend ceiling reached</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Retry with exponential backoff or use Virtual Combos for failover</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-destructive font-medium">502 / 504</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Upstream provider outage or request timeout (180s)</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Router failover automatically engages on combos</td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>

            <CodeSnippetTabs
              id="error-json"
              copiedId={copiedId}
              onCopy={copyCode}
              tabs={[
                {
                  label: "Standard Error Object",
                  lang: "json",
                  code: `{
  "error": {
    "message": "Sign in or supply an active Const API key.",
    "type": "authentication_error",
    "code": 401
  }
}`,
                },
              ]}
            />
          </section>

          {/* Per-Token Metering */}
          <section id="metering" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Per-Token Metering & Ledger</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every settled request is metered accurately against upstream token reports. Prompt caching discounts are preserved, and unfulfilled or interrupted upstream requests are never billed. View your full transaction and usage ledger anytime in <Link href="/logs" className="text-foreground underline underline-offset-4 hover:text-primary">Dashboard &rarr; Logs</Link>.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
