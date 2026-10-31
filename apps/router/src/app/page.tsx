"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Copy, Check, ShieldCheck, Terminal, Zap } from "lucide-react";
import "./landing.css";

interface CatalogItem {
  id: string;
  name: string;
  contextWindow: string;
  input: string;
  officialInput: string;
  cache?: string;
  output: string;
  officialOutput: string;
  savePercent: string;
}

const CATALOG_MODELS: CatalogItem[] = [
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek v4.1 Flash",
    contextWindow: "1M",
    input: "$0.0125",
    officialInput: "$0.150",
    cache: "$0.0125",
    output: "$0.060",
    officialOutput: "$0.600",
    savePercent: "91.7%",
  },
  {
    id: "qwen-3.8-omni-flash",
    name: "Qwen 3.8 Omni Flash",
    contextWindow: "1M",
    input: "$0.0125",
    officialInput: "$0.150",
    cache: "$0.0125",
    output: "$0.055",
    officialOutput: "$0.470",
    savePercent: "91.7%",
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    contextWindow: "1M",
    input: "$0.0125",
    officialInput: "$0.150",
    cache: "$0.0125",
    output: "$0.055",
    officialOutput: "$0.500",
    savePercent: "91.7%",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: "1M",
    input: "$0.020",
    officialInput: "$0.750",
    cache: "$0.020",
    output: "$0.080",
    officialOutput: "$3.750",
    savePercent: "97.3%",
  },
  {
    id: "glm-5.3",
    name: "GLM 5.3",
    contextWindow: "1M",
    input: "$0.035",
    officialInput: "$1.400",
    cache: "$0.035",
    output: "$0.110",
    officialOutput: "$4.400",
    savePercent: "97.5%",
  },
  {
    id: "minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash",
    contextWindow: "1M",
    input: "$0.035",
    officialInput: "$0.150",
    cache: "$0.035",
    output: "$0.135",
    officialOutput: "$0.600",
    savePercent: "76.7%",
  },
  {
    id: "qwen-3.8-max",
    name: "Qwen 3.8 Max",
    contextWindow: "1M",
    input: "$0.050",
    officialInput: "$2.000",
    cache: "$0.050",
    output: "$0.150",
    officialOutput: "$6.000",
    savePercent: "97.5%",
  },
  {
    id: "gpt-6.1-sol",
    name: "GPT 6.1 Sol",
    contextWindow: "500K",
    input: "$0.240",
    officialInput: "$2.000",
    cache: "$0.050",
    output: "$1.200",
    officialOutput: "$10.000",
    savePercent: "88.0%",
  },
  {
    id: "gpt-6-astra",
    name: "GPT 6 Astra",
    contextWindow: "272K",
    input: "$0.450",
    officialInput: "$10.000",
    cache: "$0.090",
    output: "$2.200",
    officialOutput: "$50.000",
    savePercent: "95.5%",
  },
  {
    id: "claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    contextWindow: "1M",
    input: "$0.005",
    officialInput: "$2.000",
    cache: "$0.005",
    output: "$0.025",
    officialOutput: "$10.000",
    savePercent: "99.8%",
  },
  {
    id: "claude-opus-5.5",
    name: "Claude Opus 5.5",
    contextWindow: "1M",
    input: "$0.010",
    officialInput: "$15.000",
    cache: "$0.010",
    output: "$0.050",
    officialOutput: "$75.000",
    savePercent: "99.9%",
  },
  {
    id: "grok-4.7",
    name: "Grok 4.7",
    contextWindow: "500K",
    input: "$0.140",
    officialInput: "$2.000",
    cache: "$0.035",
    output: "$0.450",
    officialOutput: "$6.000",
    savePercent: "93.0%",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, signIn } = useRouterAuth();

  useEffect(() => {
    document.title = "Const Router — Universal AI Gateway for Frontier Models";
  }, []);

  // Particle Canvas Backdrop Loader (monochrome neutral palette, no blue)
  useEffect(() => {
    const existing = document.querySelector('script[src*="MainParticlesComponent"]');
    if (!existing) {
      const initScript = document.createElement("script");
      initScript.type = "module";
      initScript.src = "/_astro/MainParticlesComponent.astro_astro_type_script_index_0_lang.ZV8AJEPG.js?v=4";
      initScript.onload = () => {
        setTimeout(() => {
          if (typeof (window as any).setAllParticlesTheme === "function") {
            (window as any).setAllParticlesTheme("dark");
          }
        }, 30);
      };
      document.body.appendChild(initScript);

      const welcomeScript = document.createElement("script");
      welcomeScript.type = "module";
      welcomeScript.src = "/_astro/index.astro_astro_type_script_index_0_lang.BxMooTve.js";
      document.body.appendChild(welcomeScript);
    }
  }, []);

  // Copy helper command
  const [helperCopied, setHelperCopied] = useState(false);
  const handleCopyHelper = () => {
    navigator.clipboard.writeText('export OPENAI_BASE_URL="https://router.const.web.id/v1"');
    setHelperCopied(true);
    setTimeout(() => setHelperCopied(false), 2000);
  };

  // Integration tabs
  const [activeTab, setActiveTab] = useState(0);
  const [tabCopied, setTabCopied] = useState(false);

  const integrationTabs = [
    {
      id: "cli",
      label: "cURL / CLI",
      filename: "test-gateway.sh",
      note: "Standard OpenAI request format. Test connectivity and model inference:",
      lang: "bash",
      code: `export OPENAI_BASE_URL="https://router.const.web.id/v1"
export OPENAI_API_KEY="sk-const-live-xxxxxxxxxxxx"

curl $OPENAI_BASE_URL/chat/completions \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4.1-flash:free",
    "messages": [{"role": "user", "content": "Explain Virtual Combos in 2 sentences."}]
  }'`,
    },
    {
      id: "python",
      label: "Python (OpenAI SDK)",
      filename: "client.py",
      note: "Drop-in replacement with the standard OpenAI Python library:",
      lang: "python",
      code: `from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key="sk-const-live-xxxxxxxxxxxx",
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[{"role": "user", "content": "Optimize this Python snippet."}],
)

print(response.choices[0].message.content)`,
    },
    {
      id: "typescript",
      label: "TypeScript / Node",
      filename: "router.ts",
      note: "Universal Node.js client with full streaming & tool execution support:",
      lang: "typescript",
      code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://router.const.web.id/v1",
  apiKey: process.env.CONST_ROUTER_API_KEY,
});

const completion = await client.chat.completions.create({
  model: "claude-sonnet-5.5",
  messages: [{ role: "user", content: "Review this pull request diff." }],
});

console.log(completion.choices[0].message.content);`,
    },
    {
      id: "claude",
      label: "Claude Code (Anthropic Spec)",
      filename: "claude-code.sh",
      note: "Launch Anthropic Claude Code backed directly by Const Router:",
      lang: "bash",
      code: `# Point Claude Code CLI to Const Router's Anthropic Messages endpoint:
export ANTHROPIC_BASE_URL="https://router.const.web.id"
export ANTHROPIC_API_KEY="const_live_xxxxxxxxxxxx"

# Run Claude Code with full tool calling:
claude`,
    },
    {
      id: "streaming",
      label: "SSE Streaming",
      filename: "stream.py",
      note: "Direct edge stream passthrough with token telemetry on the final frame:",
      lang: "python",
      code: `stream = client.chat.completions.create(
    model="qwen-3.8-omni-flash",
    messages=[{"role": "user", "content": "Stream markdown breakdown."}],
    stream=True,
)

for chunk in stream:
    delta = chunk.choices[0].delta.content if chunk.choices else None
    if delta:
        print(delta, end="", flush=True)

# Final stream frame delivers exact server telemetry:
# {"usage": {"prompt_tokens": 14, "completion_tokens": 86}}
# No character estimates. Exact tokens reported by upstream.`,
    },
  ];

  const handleCopyCode = () => {
    const code = integrationTabs[activeTab]?.code ?? "";
    navigator.clipboard.writeText(code);
    setTabCopied(true);
    setTimeout(() => setTabCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#d4d4d4] font-sans selection:bg-white/20 selection:text-white">
      {/* 1. NAVBAR */}
      <LandingNavbar />

      {/* 2. HERO SECTION */}
      <section className="atmo-home-hero">
        {/* Dynamic Canvas Backdrop (monochrome tones) */}
        <div className="hero-video-wrapper">
          <div className="hero-video-container" data-hero-particles="">
            <div
              className="main-particles-component-section"
              data-main-particles-component=""
              data-sync-theme="true"
              data-theme="dark"
              data-ring-width="0.006"
              data-ring-width2="0.107"
              data-ring-displacement="0.62"
              data-density="230"
              data-particles-scale="0.59"
              data-color1="#ffffff"
              data-color2="#a1a1aa"
              data-color3="#52525b"
            >
              <div className="main-particles-container" data-container=""></div>
            </div>
          </div>
        </div>

        {/* Hero Content (Badge removed, Exact headline and subheadline kept) */}
        <div className="home-container home-hero-content">
          <h1 className="hero-headline">
            The Universal Gateway<br />
            for Frontier AI
          </h1>

          <p className="home-hero-description">
            14 frontier models behind a single OpenAI-compatible API. Multi-model failover, native SSE streaming, and transparent per-token metering with zero commitments.
          </p>

          <div className="home-helper">
            <div className="atmo-helper-command">
              <span className="text-white/60 font-mono">$</span>
              <code className="text-xs sm:text-sm whitespace-nowrap text-white">
                export OPENAI_BASE_URL="https://router.const.web.id/v1"
              </code>
              <button
                type="button"
                aria-label="Copy helper command"
                className="atmo-command-copy cursor-pointer"
                onClick={handleCopyHelper}
              >
                {helperCopied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 text-white/60" />
                )}
              </button>
            </div>
          </div>

          {/* CTA Buttons: Get API Key & Explore Model (without icons!) */}
          <div className="home-hero-actions">
            {isAuthenticated ? (
              <Link href="/keys" className="home-button home-button-primary">
                <span>Get API Key</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => signIn("/keys")}
                className="home-button home-button-primary cursor-pointer"
              >
                <span>Get API Key</span>
              </button>
            )}

            <a href="#models" className="home-button home-button-secondary">
              <span>Explore Model</span>
            </a>
          </div>

          <p className="home-hero-footnote">
            OpenAI-compatible &bull; Anthropic Messages spec &bull; Pay per token &bull;{" "}
            <Link href="/docs" className="hover:underline">Explore the docs &rarr;</Link>
          </p>
        </div>
      </section>

      {/* 3. SECTION: ONE API. A LOT LESS IN YOUR WAY */}
      <section id="features" className="home-container home-section">
        <div className="home-section-heading">
          <h2>One API.<br />A lot less in your way.</h2>
          <p>
            Architected specifically for autonomous coding agents, developer tooling, and production workflows that cannot afford dropped connections or unpredictable billing.
          </p>
        </div>

        <div className="features-grid-custom">
          {/* Top Row: Asymmetrical 2 Cards */}
          <div className="features-top-row">
            {/* Card 1: Virtual Combos */}
            <article className="feature-card">
              <span className="feature-tag">Intelligent Routing</span>
              <h3>Virtual Combos &amp; Automatic Failover</h3>
              <p>
                Construct custom multi-model failover chains. If a provider returns 429 rate limits, 503 capacity errors, or latency spikes, Const Router automatically routes to the next healthy model without dropping your client connection.
              </p>

              <div className="router-visual-flow">
                <div className="router-flow-step active">
                  <div className="flex items-center gap-2">
                    <span className="step-label">1. Primary Target</span>
                    <span className="step-val">DeepSeek v4.1 Flash</span>
                  </div>
                  <span className="step-status green">Active / 184ms</span>
                </div>

                <div className="router-flow-step">
                  <div className="flex items-center gap-2">
                    <span className="step-label">2. Failover Chain</span>
                    <span className="step-val">Qwen 3.8 Omni Flash</span>
                  </div>
                  <span className="step-status">Ready (Standby)</span>
                </div>

                <div className="router-flow-step">
                  <div className="flex items-center gap-2">
                    <span className="step-label">3. Fallback Tier</span>
                    <span className="step-val">Claude Sonnet 5.5</span>
                  </div>
                  <span className="text-[11px] text-[#737373]">High-Tier Backup</span>
                </div>
              </div>
            </article>

            {/* Card 2: One Key */}
            <article className="feature-card">
              <span className="feature-tag">Unified Access</span>
              <h3>One Key, All Models</h3>
              <p>
                Drop-in replacement for OpenAI and Anthropic SDKs. Keep your codebase, change only the base URL. Every model in the catalog answers to a single <code className="text-white font-mono">sk-const-live-</code> key.
              </p>

              <div className="key-clients-visual">
                <div className="key-client-item">
                  <span>Python SDK</span>
                  <code>base_url="https://router.const.web.id/v1"</code>
                </div>
                <div className="key-client-item">
                  <span>TypeScript / Node</span>
                  <code>baseURL: "https://router.const.web.id/v1"</code>
                </div>
                <div className="key-client-item">
                  <span>Claude Code CLI</span>
                  <code>ANTHROPIC_BASE_URL="https://router.const.web.id"</code>
                </div>
                <div className="key-client-item">
                  <span>Cursor / Cline</span>
                  <code>OpenAI Compatible Endpoint</code>
                </div>
              </div>
            </article>
          </div>

          {/* Bottom Row: 3 Columns */}
          <div className="features-bottom-row">
            {/* Card 3: Stream */}
            <article className="feature-card">
              <span className="feature-tag">Stream</span>
              <div className="mini-symbol-bars" aria-hidden="true">
                <span></span> <span></span> <span></span> <span></span> <span></span>
              </div>
              <h3>Zero-Buffering SSE</h3>
              <p>
                Direct edge stream passthrough without buffering delays. Exact token usage reports delivered reliably in the stream terminator chunk. Stop the stream, stop paying.
              </p>
              <div className="mini-telemetry-badge">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                <span>184ms TTFT &bull; Live Passthrough</span>
              </div>
            </article>

            {/* Card 4: Guardrails */}
            <article className="feature-card">
              <span className="feature-tag">Guardrails</span>
              <ShieldCheck className="h-5 w-5 text-white/80 my-1" />
              <h3>Keys with Spend Limits</h3>
              <p>
                Create unlimited developer keys for team members or autonomous agent loops. Configure individual daily spend caps and allowed model lists to prevent runaway costs.
              </p>
              <div className="mini-telemetry-badge">
                <span>Daily Spend Caps &bull; Allowlist</span>
              </div>
            </article>

            {/* Card 5: Audit */}
            <article className="feature-card">
              <span className="feature-tag">Audit</span>
              <Terminal className="h-5 w-5 text-white/80 my-1" />
              <h3>Usage You Can Audit</h3>
              <p>
                Every request logged with prompt tokens, completion tokens, latency, and exact micro-cost. Filter by model or time window, inspect raw payload anytime.
              </p>
              <div className="mini-telemetry-badge">
                <span>Exact Tokens &bull; Zero Estimates</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 4. SECTION: DROP-IN INTEGRATION WORKSPACE */}
      <section id="start" className="home-container home-section">
        <div className="home-section-heading">
          <h2>Keep your code.<br />Change the endpoint.</h2>
          <p>
            Connect any tool, SDK, or coding agent in under 60 seconds by pointing the base URL to Const Router.
          </p>
        </div>

        <div className="hp-workspace">
          <div className="hp-workspace-bar">
            <div className="flex items-center">
              <div className="workspace-window-controls">
                <span className="window-dot" />
                <span className="window-dot" />
                <span className="window-dot" />
              </div>
              <div className="hp-tabs" role="tablist">
                {integrationTabs.map((tab, idx) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === activeTab}
                    onClick={() => setActiveTab(idx)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="hp-copy cursor-pointer"
              type="button"
              aria-label="Copy snippet"
              onClick={handleCopyCode}
            >
              {tabCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-[#969696]" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="hp-code-panel">
            <div className="hp-code-note">
              <span>{integrationTabs[activeTab]?.note ?? ""}</span>
              <span>{integrationTabs[activeTab]?.lang ?? ""}</span>
            </div>
            <pre>
              <code>{integrationTabs[activeTab]?.code ?? ""}</code>
            </pre>
          </div>
        </div>

        {/* 3-Part Reference Specs */}
        <div className="hp-reference">
          <div>
            <span className="ref-label">OpenAI Base URL</span>
            <code>https://router.const.web.id/v1</code>
            <p>Universal OpenAI-compatible host for chat completions and transcription.</p>
          </div>
          <div>
            <span className="ref-label">Anthropic Base URL</span>
            <code>https://router.const.web.id</code>
            <p>Direct Anthropic Messages spec passthrough for Claude Code and Anthropic clients.</p>
          </div>
          <div>
            <span className="ref-label">Telemetry Header</span>
            <code>X-Const-Cost</code>
            <p>Exact micro-cost deducted in USD and latency returned in every response header.</p>
          </div>
        </div>
      </section>

      {/* 5. SECTION: MODELS CATALOG TABLE (WITH BRAND LOGOS & YOU SAVE %) */}
      <section id="models" className="home-container home-section">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
              Model Catalog &amp; Live Rates
            </h2>
            <p className="text-sm text-[#969696] pt-1">
              14 frontier models with transparent per-token pricing and instant routing.
            </p>
          </div>
          <Link href="/dashboard" className="home-text-link">
            <span>Explore full catalog in Dashboard</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        <div className="clean-catalog-table">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Model</th>
                  <th className="text-center">Context Window</th>
                  <th className="text-right">Input / 1M Tokens</th>
                  <th className="text-right">Output / 1M Tokens</th>
                  <th className="text-center">You Save</th>
                </tr>
              </thead>
              <tbody>
                {CATALOG_MODELS.map((model) => {
                  return (
                    <tr key={model.id}>
                      <td>
                        <div>
                          <code>{model.id}</code>
                          <span className="text-xs text-[#737373] block pt-0.5">{model.name}</span>
                        </div>
                      </td>
                      <td className="text-center font-mono text-xs text-[#a3a3a3]">
                        {model.contextWindow}
                      </td>
                      <td className="text-right font-mono">
                        <strong className="text-white font-medium">{model.input}</strong>
                        <s>{model.officialInput}</s>
                        {model.cache && <small>cache {model.cache}</small>}
                      </td>
                      <td className="text-right font-mono">
                        <strong className="text-white font-medium">{model.output}</strong>
                        <s>{model.officialOutput}</s>
                      </td>
                      <td className="text-center">
                        <span className="save-percent-pill">
                          Save {model.savePercent}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6. SECTION: SIMPLE, USAGE-BASED PRICING */}
      <section id="pricing" className="home-container home-section">
        <div className="home-section-heading text-center items-center">
          <h2>Simple, usage-based pricing</h2>
          <p className="text-center">
            Pay strictly for tokens consumed. No subscriptions, no tiers, no recurring card lock-in.
          </p>
        </div>

        <div className="clean-pricing-grid">
          {/* Card 1: Pay As You Go */}
          <article className="pricing-card featured">
            <span className="pricing-badge">Zero Subscription Lock-In</span>
            <div className="pricing-amount">$0 / month</div>
            <p className="pricing-desc">
              Deposit credits using QRIS or USDC on Solana. Balance drains purely per token consumed down to fractions of a cent.
            </p>

            <ul className="pricing-features-list">
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>One key for all 14 supported frontier models</span>
              </li>
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Input and output metered strictly from provider reports</span>
              </li>
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Prompt caching billed at up to 90% discount</span>
              </li>
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Unlimited API keys with custom daily spend limits</span>
              </li>
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Balance never expires &bull; zero recurring card charges</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={() => signIn("/keys")}
              className="home-button home-button-primary w-full mt-auto cursor-pointer"
            >
              Get Started with Free Tier
            </button>
          </article>

          {/* Card 2: Production Workflows */}
          <article className="pricing-card">
            <span className="pricing-badge">Production Grade</span>
            <div className="pricing-amount">Usage-Based</div>
            <p className="pricing-desc">
              Engineered for long-running autonomous agent loops, multi-agent workspaces, and high-concurrency coding studios.
            </p>

            <ul className="pricing-features-list">
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Automated multi-model Virtual Combos with instant failover</span>
              </li>
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>SSE streaming with token usage on final frames</span>
              </li>
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Per-key daily rate limits &amp; custom model allowlists</span>
              </li>
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Response latency &amp; cost headers on every request</span>
              </li>
              <li>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>7M weekly free token allowance for eligible models</span>
              </li>
            </ul>

            <Link href="/dashboard" className="home-button home-button-secondary w-full mt-auto">
              Configure Virtual Combos
            </Link>
          </article>
        </div>

        {/* Value Strip */}
        <div className="pricing-value-strip">
          <p>
            <strong>What does $1 get you?</strong> With <code className="text-white font-mono font-medium">deepseek-v4.1-flash</code>, $1 routes over <strong>80,000,000 tokens</strong> &mdash; enough to analyze an entire large codebase dozens of times.
          </p>
          <Link href="/models" className="text-xs text-white/80 hover:underline whitespace-nowrap">
            View Live Rates &rarr;
          </Link>
        </div>
      </section>

      {/* 7. SECTION: QUICKSTART FLOW */}
      <section className="home-container home-section">
        <div className="home-section-heading">
          <h2>From account to first request</h2>
          <p>Start calling frontier models in four straightforward steps.</p>
        </div>

        <div className="home-flow-grid">
          <article>
            <span className="font-mono text-xs text-[#737373]">01</span>
            <h3>Create Account</h3>
            <p>Sign in with your email or Const account. Nothing else required to explore the catalog.</p>
          </article>
          <article>
            <span className="font-mono text-xs text-[#737373]">02</span>
            <h3>Add Balance</h3>
            <p>Deposit USDC on Solana or top up with QRIS. Balance drains per token, never per month.</p>
          </article>
          <article>
            <span className="font-mono text-xs text-[#737373]">03</span>
            <h3>Generate a Key</h3>
            <p>Create an sk-const-live- key, configure daily spend ceilings and allowed models.</p>
          </article>
          <article>
            <span className="font-mono text-xs text-[#737373]">04</span>
            <h3>Start Calling</h3>
            <p>Point any OpenAI or Anthropic tool to router.const.web.id/v1.</p>
          </article>
        </div>
      </section>

      {/* 8. SECTION: BILLING METERING & LEDGER */}
      <section id="billing" className="home-container home-section home-billing-layout">
        <div className="home-billing-intro">
          <h2>How your usage is billed</h2>
          <p>
            Metering comes directly from upstream provider usage reports, so the number you are charged reflects the exact tokens returned by the model &mdash; never a character estimate.
          </p>
          <h3>What you get</h3>
          <ul>
            <li>
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              One key for the OpenAI and Anthropic compatible endpoints
            </li>
            <li>
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              14 frontier models across all major families
            </li>
            <li>
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              Real-time balance deduction per request down to 0.0001&cent;
            </li>
            <li>
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              Full SSE streaming with token usage on the final frame
            </li>
            <li>
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              Per-key daily rate limits and model restrictions
            </li>
            <li>
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              Usage dashboard with cost and latency breakdown
            </li>
          </ul>
        </div>

        <article className="home-billing-ledger">
          <div className="home-ledger-header">
            <span>How billing works</span>
            <span className="text-xs text-[#969696] font-mono">Unit: USD / 1M</span>
          </div>
          <ol>
            <li>
              <span className="font-mono">01</span>
              <p>Deposit USDC on Solana, or top up with QRIS (instant IDR)</p>
            </li>
            <li>
              <span className="font-mono">02</span>
              <p>Input and output tokens counted separately at transparent rates</p>
            </li>
            <li>
              <span className="font-mono">03</span>
              <p>Cached input tokens billed at up to 90% discount</p>
            </li>
            <li>
              <span className="font-mono">04</span>
              <p className="home-formula">
                cost = ((in &minus; cached) &times; input_price + cached &times; input_price &times; 0.10 + out &times; output_price) / 1M
              </p>
            </li>
            <li>
              <span className="font-mono">05</span>
              <p>Balance deducted the moment a request settles</p>
            </li>
            <li>
              <span className="font-mono">06</span>
              <p>A failed upstream request is never billed</p>
            </li>
            <li>
              <span className="font-mono">07</span>
              <p>Empty balance blocks new calls, never overdraws or charges a card</p>
            </li>
          </ol>
        </article>
      </section>

      {/* 9. CLOSING CTA */}
      <section className="home-container home-section text-center py-20 border-t border-[#262626]">
        <div className="max-w-xl mx-auto space-y-5">
          <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
            Start calling frontier models in minutes
          </h2>
          <p className="text-sm text-[#969696]">
            Create a key, configure your daily ceilings, and connect your favorite coding agent.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => signIn("/keys")}
              className="home-button home-button-primary cursor-pointer px-6"
            >
              <span>Get API Key</span>
            </button>
          </div>
        </div>
      </section>

      {/* 10. STUDIO FOOTER */}
      <LandingFooter />
    </div>
  );
}
