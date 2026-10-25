"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTER_ENDPOINTS } from "@/lib/api-contract";
import { FREE_MODEL_IDS, BUILTIN_MODELS } from "@/lib/model-specs";
import { Button, Badge, ScrollArea, toast, cn } from "@const/ui";
import { Copy, Check, Terminal, ExternalLink, ArrowLeft, BookOpen, Key, Zap, Shield, Cpu, Layers } from "lucide-react";

export default function DocsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Snippet copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy snippet");
    }
  };

  const navGroups = [
    {
      title: "Start building",
      items: [
        { label: "Quickstart", href: "#quickstart" },
        { label: "Authentication", href: "#authentication" },
        { label: "Models & allowance", href: "#models-allowance" },
        { label: "SDKs & Agent setup", href: "#sdks-agents" },
      ],
    },
    {
      title: "API Reference",
      items: [
        { label: "Chat completions", href: "#chat" },
        { label: "Reasoning effort", href: "#reasoning-effort" },
        { label: "Streaming (SSE)", href: "#streaming" },
        { label: "Tool calling & JSON", href: "#tools-json" },
        { label: "Virtual Combos", href: "#combos" },
        { label: "Available endpoints", href: "#endpoints" },
      ],
    },
    {
      title: "Limits & Governance",
      items: [
        { label: "API Keys & guardrails", href: "#keys-guardrails" },
        { label: "Errors & retries", href: "#errors" },
        { label: "Per-token metering", href: "#metering" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Top Docs Bar */}
      <div className="border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <span className="text-border">/</span>
          <span className="text-xs font-medium text-foreground">Documentation</span>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs rounded-lg">
            <Link href="/keys">Create API key</Link>
          </Button>
          <Button asChild size="sm" className="h-8 text-xs rounded-lg">
            <Link href="/models">View Pricing</Link>
          </Button>
        </div>
      </div>

      {/* Main Container with Sticky Sidebar and Scrollable Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex gap-12 items-start">
        {/* Left Sidebar: Fixed / Sticky non-scrolling menu */}
        <aside className="w-56 shrink-0 hidden md:block sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto pr-4 select-none">
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
        <main className="flex-1 min-w-0 max-w-3xl space-y-14 pb-24">
          {/* Header */}
          <header className="space-y-3 pb-6 border-b border-border/40">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight">API Documentation</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Const Router is a high-performance universal AI gateway providing drop-in access to 14 frontier models through standard OpenAI and Anthropic API specifications.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
              <span className="px-2 py-1 bg-secondary/50 rounded border border-border/40">
                Base URL: https://router.const.web.id/v1
              </span>
              <span className="px-2 py-1 bg-secondary/50 rounded border border-border/40">
                OpenAI Spec: 2024-10
              </span>
              <span className="px-2 py-1 bg-secondary/50 rounded border border-border/40">
                Anthropic Messages Spec
              </span>
            </div>
          </header>

          {/* Quickstart */}
          <section id="quickstart" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Quickstart</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Calling models through Const Router requires only two changes to standard client code: point the base URL to <code className="text-foreground font-mono">https://router.const.web.id/v1</code> and supply your Const API key.
            </p>

            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/30 border-b border-border/40 text-xs">
                <span className="font-mono text-muted-foreground">Python SDK Example</span>
                <button
                  type="button"
                  onClick={() =>
                    copyCode(
                      "qs-py",
                      `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="https://router.const.web.id/v1",\n    api_key="const_live_YOUR_KEY",\n)\n\nresponse = client.chat.completions.create(\n    model="deepseek-v4.1-flash",\n    messages=[{"role": "user", "content": "Hello"}],\n)\nprint(response.choices[0].message.content)`,
                    )
                  }
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {copiedId === "qs-py" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedId === "qs-py" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-foreground/90">
{`from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key="const_live_YOUR_KEY",
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Explain Virtual Combos in two sentences."}],
)
print(response.choices[0].message.content)`}
              </pre>
            </div>
          </section>

          {/* Authentication */}
          <section id="authentication" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Authentication</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every inference request requires an active API key passed in the <code className="text-foreground font-mono">Authorization</code> header with the <code className="text-foreground font-mono">Bearer</code> prefix, or via <code className="text-foreground font-mono">x-api-key</code>.
            </p>

            <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 text-xs font-mono space-y-1">
              <p className="text-muted-foreground"># Header syntax</p>
              <p className="text-foreground">Authorization: Bearer const_live_xxxxxxxxxxxxxxxxxxxxxxxx</p>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Keys are revealed once upon creation. Invalid, disabled, or daily-capped keys are rejected with HTTP 401/403 before executing upstream model calls.
            </p>
          </section>

          {/* Models & Allowance */}
          <section id="models-allowance" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Models & Free Allowance</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Const Router operates two billing tiers: Free Tier and Paid Wholesale.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-card border border-border/60 space-y-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Weekly Free Allowance</span>
                <p className="text-2xl font-medium tracking-tight tabular-nums">7,000,000</p>
                <p className="text-xs text-muted-foreground">
                  Tokens per 7-day cycle. Applies automatically to models marked <code className="text-foreground font-mono">:free</code>.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-card border border-border/60 space-y-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Paid Wholesale</span>
                <p className="text-2xl font-medium tracking-tight">Per-Token</p>
                <p className="text-xs text-muted-foreground">
                  Metered down to fractions of a cent with up to 91% discount against official provider rates. No subscriptions.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Eligible Free Tier IDs:</p>
              <div className="flex flex-wrap gap-1.5">
                {FREE_MODEL_IDS.map((id) => (
                  <code key={id} className="text-xs font-mono px-2 py-0.5 bg-secondary rounded border border-border/50">
                    {id}
                  </code>
                ))}
              </div>
            </div>
          </section>

          {/* SDKs & Agent Setup */}
          <section id="sdks-agents" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">SDKs & Agent Setup</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use Const Router with official developer CLIs and autonomous agent frameworks:
            </p>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
                <p className="text-xs font-medium text-foreground">Claude Code CLI (Anthropic Spec)</p>
                <pre className="text-xs font-mono bg-secondary/30 p-2.5 rounded text-foreground/90 overflow-x-auto">
{`export ANTHROPIC_BASE_URL="https://router.const.web.id"
export ANTHROPIC_API_KEY="const_live_YOUR_KEY"
claude`}
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
                <p className="text-xs font-medium text-foreground">Cursor / Cline / Roo Code / OpenCode</p>
                <p className="text-xs text-muted-foreground">
                  Set Provider to <strong className="text-foreground">OpenAI Compatible</strong>, Base URL to <code className="font-mono text-foreground">https://router.const.web.id/v1</code>, and enter your Const API key.
                </p>
              </div>
            </div>
          </section>

          {/* Chat Completions */}
          <section id="chat" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Chat Completions</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Standard endpoint: <code className="text-foreground font-mono">POST /v1/chat/completions</code>. Supports streaming, function/tool calling, structured JSON output, vision inputs, and reasoning controls.
            </p>

            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/30 border-b border-border/40 text-xs">
                <span className="font-mono text-muted-foreground">cURL Payload</span>
                <button
                  type="button"
                  onClick={() =>
                    copyCode(
                      "chat-curl",
                      `curl https://router.const.web.id/v1/chat/completions \\\n  -H "Authorization: Bearer const_live_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "deepseek-v4.1-flash",\n    "messages": [{"role": "user", "content": "Analyze complexity"}],\n    "temperature": 0.2\n  }'`,
                    )
                  }
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {copiedId === "chat-curl" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedId === "chat-curl" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-foreground/90">
{`curl https://router.const.web.id/v1/chat/completions \\
  -H "Authorization: Bearer const_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4.1-flash",
    "messages": [
      {"role": "system", "content": "You are a concise engineering assistant."},
      {"role": "user", "content": "Compare quicksort vs mergesort cache locality."}
    ],
    "temperature": 0.2,
    "max_tokens": 1024
  }'`}
              </pre>
            </div>
          </section>

          {/* Reasoning Effort (Explicitly requested by user) */}
          <section id="reasoning-effort" className="space-y-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium tracking-tight">Reasoning Effort</h2>
              <Badge variant="secondary" className="font-mono text-[10px]">Parameter Guide</Badge>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              For reasoning and thinking models (such as DeepSeek R1, GLM thinking, and OpenAI reasoning architectures), pass the <code className="text-foreground font-mono">reasoning_effort</code> parameter to modulate internal thought token budgets before producing output.
            </p>

            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border/40">
                  <tr>
                    <th className="px-4 py-3 font-normal">Level</th>
                    <th className="px-4 py-3 font-normal">Behavior</th>
                    <th className="px-4 py-3 font-normal">Recommended For</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">"low"</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Minimal internal chain-of-thought tokens. Lowest latency.
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Simple code edits, quick lookups, high-concurrency bots
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">"medium"</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Balanced reasoning budget (default setting).
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      General debugging, unit test synthesis, refactoring
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">"high"</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Extended internal exploration and self-correction cycles.
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Complex algorithmic proofs, architecture planning, multi-file refactors
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-foreground font-medium">"max"</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Maximal thinking depth up to context boundaries.
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      Mission-critical bug audits and difficult logic puzzles
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-secondary/30 border-b border-border/40 text-xs">
                <span className="font-mono text-muted-foreground">Reasoning Request Example</span>
                <button
                  type="button"
                  onClick={() =>
                    copyCode(
                      "reason-py",
                      `from openai import OpenAI\n\nclient = OpenAI(base_url="https://router.const.web.id/v1", api_key="const_live_YOUR_KEY")\n\nresponse = client.chat.completions.create(\n    model="deepseek-v4.1-flash",\n    messages=[{"role": "user", "content": "Prove that √2 is irrational."}],\n    reasoning_effort="high",\n)\nprint(response.choices[0].message.content)`,
                    )
                  }
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {copiedId === "reason-py" ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedId === "reason-py" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-foreground/90">
{`from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key="const_live_YOUR_KEY",
)

# Pass reasoning_effort parameter directly
response = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Design an idempotent distributed lock with redis."}],
    reasoning_effort="high",
)

print(response.choices[0].message.content)`}
              </pre>
            </div>
          </section>

          {/* Streaming (SSE) */}
          <section id="streaming" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Streaming (Server-Sent Events)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enable SSE by setting <code className="text-foreground font-mono">stream: true</code>. Stream frames are passed through directly from upstream without proxy buffering delays. The final terminal chunk delivers exact token telemetry:
            </p>

            <pre className="p-4 rounded-xl bg-card border border-border/60 text-xs font-mono leading-relaxed overflow-x-auto text-foreground/90">
{`data: {"choices": [{"delta": {"content": "..."}}]}
...
data: {"usage": {"prompt_tokens": 42, "completion_tokens": 128}}
data: [DONE]`}
            </pre>
          </section>

          {/* Tool Calling & JSON */}
          <section id="tools-json" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Tool Calling & JSON Mode</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Const Router supports OpenAI standard function schemas via <code className="text-foreground font-mono">tools</code> and <code className="text-foreground font-mono">tool_choice</code>. For structured JSON outputs without tools, pass:
            </p>

            <pre className="p-4 rounded-xl bg-card border border-border/60 text-xs font-mono leading-relaxed overflow-x-auto text-foreground/90">
{`"response_format": { "type": "json_object" }`}
            </pre>
          </section>

          {/* Virtual Combos */}
          <section id="combos" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Virtual Combos & Automatic Failover</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Virtual Combos allow grouping multiple upstream models under a single slug (<code className="text-foreground font-mono">model: "combo/my-coding-stack"</code>). When your primary model returns HTTP 429 (rate limited), 503 (out of capacity), or high latency, Const Router automatically fails over to the next candidate model in the chain before replying to the client.
            </p>

            <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 text-xs space-y-2">
              <p className="font-medium text-foreground">Response Header Telemetry:</p>
              <p className="font-mono text-muted-foreground">
                <code className="text-foreground">X-Const-Combo-Selected-Model</code> identifies the actual model that generated the completion.
              </p>
            </div>
          </section>

          {/* Available Endpoints */}
          <section id="endpoints" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Available Endpoints</h2>
            <div className="rounded-xl bg-card border border-border/60 divide-y divide-border/40 overflow-hidden">
              {ROUTER_ENDPOINTS.map((e) => (
                <div key={e.path} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                        {e.method}
                      </Badge>
                      <code className="font-mono font-medium text-foreground">{e.path}</code>
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-1">{e.description}</p>
                  </div>
                  <span className="text-muted-foreground font-mono text-[11px] shrink-0">{e.name}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Errors & Retries */}
          <section id="errors" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Errors & Retries</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Standard HTTP error codes are preserved:
            </p>

            <div className="rounded-xl bg-card border border-border/60 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border/40 font-mono">
                  <tr>
                    <th className="px-4 py-3 font-normal">Code</th>
                    <th className="px-4 py-3 font-normal">Meaning</th>
                    <th className="px-4 py-3 font-normal">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr>
                    <td className="px-4 py-3 text-destructive font-medium">400</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Malformed request or unsupported parameter</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Check request JSON payload</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-destructive font-medium">401 / 403</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Invalid, revoked, or model-restricted key</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Generate active key in Dashboard &rarr; API Keys</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-amber-500 font-medium">402</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Credit balance depleted or weekly free quota exceeded</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Top up credit or switch to free model</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-amber-500 font-medium">429</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Rate limit reached</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Retry with exponential backoff or use Combos</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-destructive font-medium">502 / 503</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Upstream provider outage</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">Router failover automatically engages</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Metering */}
          <section id="metering" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-medium tracking-tight">Per-Token Metering & Ledger</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every settled request emits an <code className="text-foreground font-mono">X-Const-Cost</code> header with the exact micro-cost in USD deducted from your balance. Failed upstream requests are never billed.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
