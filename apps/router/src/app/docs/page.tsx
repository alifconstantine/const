"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ConstLogoIcon,
  Button,
  Badge,
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
  ArrowRight,
  ExternalLink,
  Bot,
  Zap,
  ChevronRight,
  Key,
  Shield,
  HelpCircle,
  AlertTriangle,
  Send,
  Boxes,
  Globe,
  Workflow,
  Radio,
  Video,
  ListOrdered,
  Image as ImageIcon,
  Wand2,
  Mic,
  Volume2,
  Music,
  Search,
} from "lucide-react";

interface NavSection {
  id: string;
  title: string;
}

const NAV_SECTIONS: NavSection[] = [
  { id: "quickstart", title: "Quickstart" },
  { id: "authentication", title: "Authentication & keys" },
  { id: "endpoints", title: "Endpoint support" },
  { id: "streaming", title: "Streaming" },
  { id: "models", title: "Models & Pricing" },
  { id: "reasoning", title: "Reasoning (Thinking)" },
  { id: "image-generation", title: "Image generation" },
  { id: "image-edits", title: "Image edits" },
  { id: "audio-transcription", title: "Audio transcription" },
  { id: "speech", title: "Speech (TTS)" },
  { id: "music-generation", title: "Music generation" },
  { id: "web-search", title: "Web search" },
  { id: "embeddings", title: "Embeddings" },
  { id: "rerank", title: "Rerank" },
  { id: "video-generation", title: "Video generation" },
  { id: "rate-limits", title: "Rate limits & quotas" },
  { id: "errors", title: "Errors" },
  { id: "model-combos", title: "Model combos" },
];

export default function DocsPage() {
  const baseUrl = "https://router.const.web.id/v1";
  const [activeSection, setActiveSection] = useState("quickstart");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [requestTab, setRequestTab] = useState<"curl" | "python" | "typescript" | "fetch">("curl");

  useEffect(() => {
    // Scroll spy for active section
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 180;
      for (const section of NAV_SECTIONS) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedCode((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -90;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  useEffect(() => {
    document.title = "Documentation - Const Router";
  }, []);

  return (
    <>
      <title>Documentation - Const Router</title>
      <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground font-sans">
        {/* Top Navbar matching Const Harness studio header and logo structure */}
        <header className="h-14 sticky top-0 z-50 bg-card border-b border-border px-4 sm:px-8 flex items-center justify-between select-none">
        {/* Left: Brand Logo + Home */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <ConstLogoIcon
              size="sm"
              className="w-6 h-6 text-foreground shrink-0 transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-normal tracking-tight text-foreground">
                Const
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                Router
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </Link>
        </div>

        {/* Right: Open Dashboard + Language + Theme Toggle */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button
              size="sm"
              className="h-8 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs cursor-pointer shadow-none transition-all gap-1.5"
            >
              <span>Open dashboard</span>
            </Button>
          </Link>

          <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded-lg border border-border bg-secondary">
            <Globe className="h-3.5 w-3.5" />
            <span className="font-mono text-[11px]">EN</span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Hero Header matching screenshot structure with Const Harness palette */}
      <div className="relative overflow-hidden border-b border-border/60 bg-card/40 py-12 sm:py-16 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto space-y-3.5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-muted-foreground text-xs font-mono">
            <span>Developer docs</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-normal tracking-tight text-foreground">
            Build on the Const Router API
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground font-light max-w-2xl leading-relaxed">
            One stable, OpenAI-compatible endpoint across leading models. Point any OpenAI SDK at our base URL, authenticate with your key, and ship.
          </p>
        </div>
      </div>

      {/* Main 2-Column Documentation Grid matching screenshot */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: ON THIS PAGE Navigation Menu (Sticky) */}
          <aside className="lg:col-span-3">
            <div className="sticky top-24 space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold px-3">
                ON THIS PAGE
              </span>

              <nav className="space-y-0.5">
                {NAV_SECTIONS.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer block",
                        isActive
                          ? "bg-secondary text-foreground font-medium shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      )}
                    >
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Right Column: Main Content Sections */}
          <main className="lg:col-span-9 space-y-16">
            {/* 1. Quickstart Section */}
            <section id="quickstart" className="space-y-6 scroll-mt-24">
              <div className="space-y-2">
                <h2 className="text-2xl font-serif font-normal text-white">
                  Quickstart
                </h2>
                <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                  Three steps to your first response: create a key, set the base URL, send a request. The API speaks the OpenAI Chat Completions format, so existing OpenAI clients work by changing two lines.
                </p>
              </div>

              {/* Step 1: Create an API key */}
              <div className="p-6 rounded-2xl bg-[#222222] border border-[#383838]/60 space-y-3.5">
                <h3 className="text-sm font-semibold text-white">
                  1. Create an API key
                </h3>
                <p className="text-xs text-[#969696] font-light leading-relaxed">
                  Sign in and open the API keys page to mint a key. The secret is shown once at creation — copy it immediately and store it securely. Keys begin with the prefix <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">sk-const-live-</code>.
                </p>
                <div>
                  <Link href="/keys">
                    <Button
                      size="sm"
                      className="h-8 px-3.5 rounded-xl bg-white hover:bg-white/90 text-[#161616] text-xs font-medium cursor-pointer gap-1.5 shadow-none"
                    >
                      <span>Open API keys</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Step 2: Set the base URL */}
              <div className="p-6 rounded-2xl bg-[#222222] border border-[#383838]/60 space-y-3.5">
                <h3 className="text-sm font-semibold text-white">
                  2. Set the base URL
                </h3>
                <p className="text-xs text-[#969696] font-light leading-relaxed">
                  Send all requests to the gateway base URL. The chat endpoint lives at <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">/v1/chat/completions</code>.
                </p>

                {/* Code Box: TEXT */}
                <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#222222] border-b border-[#2e2e2e] text-[11px] font-mono text-[#969696]">
                    <span>TEXT</span>
                    <button
                      onClick={() => handleCopy(baseUrl, "qs-base-url")}
                      className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedCode === "qs-base-url" ? (
                        <>
                          <Check className="h-3 w-3 text-white" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-3.5 font-mono text-xs text-[#d4d4d4] select-all overflow-x-auto">
                    {baseUrl}
                  </div>
                </div>
              </div>

              {/* Step 3: Send a request */}
              <div className="p-6 rounded-2xl bg-[#222222] border border-[#383838]/60 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    3. Send a request
                  </h3>

                  {/* Tabs: CURL, PYTHON, TYPESCRIPT, FETCH */}
                  <div className="flex items-center gap-1 bg-[#1b1b1b] p-0.5 rounded-lg border border-[#2e2e2e]">
                    {(["curl", "python", "typescript", "fetch"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setRequestTab(tab)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-mono uppercase transition-colors cursor-pointer",
                          requestTab === tab
                            ? "bg-[#383838] text-white font-semibold"
                            : "text-[#969696] hover:text-white"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#222222] border-b border-[#2e2e2e] text-[11px] font-mono text-[#969696]">
                    <span className="uppercase">{requestTab}</span>
                    <button
                      onClick={() => {
                        const snippet =
                          requestTab === "curl"
                            ? `curl -X POST "${baseUrl}/chat/completions" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -d '{"model": "gemini-3.8-flash", "messages": [{"role": "user", "content": "Hello!"}]}'`
                            : requestTab === "python"
                            ? `from openai import OpenAI\n\nclient = OpenAI(base_url="${baseUrl}", api_key="sk-const-live-yourkey")\nresponse = client.chat.completions.create(model="gemini-3.8-flash", messages=[{"role": "user", "content": "Hello!"}])\nprint(response.choices[0].message.content)`
                            : `import OpenAI from "openai";\n\nconst client = new OpenAI({ baseURL: "${baseUrl}", apiKey: "sk-const-live-yourkey" });\nconst response = await client.chat.completions.create({ model: "gemini-3.8-flash", messages: [{ role: "user", content: "Hello!" }] });\nconsole.log(response.choices[0].message.content);`;
                        handleCopy(snippet, `qs-req-${requestTab}`);
                      }}
                      className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedCode === `qs-req-${requestTab}` ? (
                        <>
                          <Check className="h-3 w-3 text-white" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-4 font-mono text-xs text-[#d4d4d4] overflow-x-auto leading-relaxed">
                    {requestTab === "curl" && (
                      <pre>{`curl -X POST "${baseUrl}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -d '{
    "model": "gemini-3.8-flash",
    "messages": [
      {"role": "system", "content": "You are a precise technical writer."},
      {"role": "user", "content": "Summarize distributed consensus in one sentence."}
    ],
    "temperature": 0.2
  }'`}</pre>
                    )}

                    {requestTab === "python" && (
                      <pre>{`from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="sk-const-live-yourkey",
)

response = client.chat.completions.create(
    model="gemini-3.8-flash",
    messages=[
        {"role": "user", "content": "Explain quantum computing in one sentence."}
    ],
)

print(response.choices[0].message.content)`}</pre>
                    )}

                    {requestTab === "typescript" && (
                      <pre>{`import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: "sk-const-live-yourkey",
});

async function main() {
  const completion = await client.chat.completions.create({
    model: "gemini-3.8-flash",
    messages: [{ role: "user", content: "Explain quantum computing." }],
  });

  console.log(completion.choices[0].message.content);
}

main();`}</pre>
                    )}

                    {requestTab === "fetch" && (
                      <pre>{`const res = await fetch("${baseUrl}/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-const-live-yourkey",
  },
  body: JSON.stringify({
    model: "gemini-3.8-flash",
    messages: [{ role: "user", content: "Hello from browser fetch!" }],
  }),
});

const data = await res.json();
console.log(data.choices[0].message.content);`}</pre>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Authentication & Keys */}
            <section id="authentication" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Authentication &amp; keys
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                All requests to Const Router endpoints must authenticate using HTTP Bearer authentication. Include your key in the <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">Authorization</code> header:
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-3.5 font-mono text-xs text-[#d4d4d4]">
                <code>Authorization: Bearer sk-const-live-xxxxxxxxxxxxxxxxxxxx</code>
              </div>

              <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 text-xs text-[#d4d4d4] space-y-1">
                <p className="font-semibold text-white">Security Best Practice</p>
                <p className="text-[#969696] font-light">
                  Never commit API keys into source control. Always load keys via environment variables (e.g., <code className="font-mono text-white">process.env.OPENAI_API_KEY</code> or <code className="font-mono text-white">os.environ["OPENAI_API_KEY"]</code>).
                </p>
              </div>
            </section>

            {/* 3. Endpoint Support */}
            <section id="endpoints" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Endpoint support
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Const Router provides standard OpenAI-compatible endpoints, along with cross-protocol Anthropic adapters:
              </p>

              <div className="rounded-2xl border border-[#383838]/60 bg-[#222222] overflow-hidden text-xs">
                <div className="grid grid-cols-12 p-3 bg-[#1b1b1b] border-b border-[#2e2e2e] font-mono text-[11px] uppercase text-[#969696] font-semibold">
                  <span className="col-span-2">Method</span>
                  <span className="col-span-5">Endpoint</span>
                  <span className="col-span-5">Protocol / Capability</span>
                </div>

                {[
                  { method: "POST", path: "/v1/chat/completions", protocol: "OpenAI Chat Completions", desc: "Streaming & non-streaming text & reasoning" },
                  { method: "GET", path: "/v1/models", protocol: "OpenAI Models List", desc: "Lists all available models (?type=llm, audio, search, all)" },
                  { method: "POST", path: "/v1/audio/transcriptions", protocol: "OpenAI Audio Whisper", desc: "Speech-to-text audio transcription (Whisper Large V3 Turbo)" },
                  { method: "POST", path: "/v1/search", protocol: "Const Search (Exa AI)", desc: "Web search and deep research grounding" },
                  { method: "POST", path: "/v1/images/generations", protocol: "OpenAI Image Generation", desc: "Text-to-image synthesis (Imagen 3, DALL-E, Flux)" },
                  { method: "POST", path: "/v1/images/edits", protocol: "OpenAI Image Edits", desc: "Multipart inpainting & image editing" },
                  { method: "POST", path: "/v1/audio/speech", protocol: "OpenAI Audio Speech (TTS)", desc: "Text-to-speech audio streaming" },
                  { method: "POST", path: "/v1/audio/music", protocol: "Const Generative Music", desc: "Full-length music track generation" },
                  { method: "POST", path: "/v1/embeddings", protocol: "OpenAI Embeddings", desc: "High-dimensional dense vector embeddings" },
                  { method: "POST", path: "/v1/rerank", protocol: "Cohere-compatible Rerank", desc: "Semantic cross-encoder document reranking" },
                  { method: "POST", path: "/v1/videos", protocol: "Const Video Generation", desc: "Text-to-video & image-to-video synthesis" },
                  { method: "POST", path: "/v1/responses", protocol: "OpenAI Responses API", desc: "Structured stateful agent responses" },
                  { method: "POST", path: "/v1/messages", protocol: "Anthropic Messages API", desc: "Claude-compatible messages format" },
                ].map((ep) => (
                  <div key={ep.path} className="grid grid-cols-12 p-3 border-b border-[#2e2e2e]/40 last:border-none items-center font-mono">
                    <span className="col-span-2 text-white font-bold">{ep.method}</span>
                    <span className="col-span-5 text-[#d4d4d4] truncate pr-2">{ep.path}</span>
                    <span className="col-span-5 text-[#969696] font-sans text-xs truncate">{ep.protocol}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Streaming */}
            <section id="streaming" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Streaming
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Set <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">"stream": true</code> in your POST body to receive incremental token deltas streamed over Server-Sent Events (SSE). Chunks arrive as:
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4]">
                <pre>{`data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":" world"},"index":0}]}

data: [DONE]`}</pre>
              </div>
            </section>

            {/* 5. Models */}
            <section id="models" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Models &amp; Pricing
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Const provides native high-speed models out-of-the-box with unified Pay-As-You-Go pricing and zero multi-vendor configuration. Pricing is per 1M tokens unless specified:
              </p>

              <div className="overflow-x-auto rounded-xl border border-[#383838]/60 bg-[#222222]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1b1b1b] border-b border-[#383838]/60 text-[#969696] font-medium font-sans">
                    <tr>
                      <th className="py-2.5 px-4 font-normal">Model</th>
                      <th className="py-2.5 px-3 font-normal">Context</th>
                      <th className="py-2.5 px-3 font-normal">Max Out</th>
                      <th className="py-2.5 px-3 font-normal">Input (/1M)</th>
                      <th className="py-2.5 px-3 font-normal">Cache (/1M)</th>
                      <th className="py-2.5 px-3 font-normal">Output (/1M)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#383838]/40 font-mono text-[#d4d4d4]">
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-white">GPT 6 Luna</td>
                      <td className="py-2.5 px-3">272K</td>
                      <td className="py-2.5 px-3">128K</td>
                      <td className="py-2.5 px-3 text-white">$0.0125</td>
                      <td className="py-2.5 px-3 text-[#969696]">$0.0125</td>
                      <td className="py-2.5 px-3 text-white">$0.065</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-white">GLM 5.3 Flash</td>
                      <td className="py-2.5 px-3">1M</td>
                      <td className="py-2.5 px-3">128K</td>
                      <td className="py-2.5 px-3 text-white">$0.018</td>
                      <td className="py-2.5 px-3 text-[#969696]">$0.018</td>
                      <td className="py-2.5 px-3 text-white">$0.065</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-white">Qwen 3.8 Omni Flash</td>
                      <td className="py-2.5 px-3">1M</td>
                      <td className="py-2.5 px-3">128K</td>
                      <td className="py-2.5 px-3 text-white">$0.0125</td>
                      <td className="py-2.5 px-3 text-[#969696]">$0.0125</td>
                      <td className="py-2.5 px-3 text-white">$0.06</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-white">Deepseek v4.1 Flash</td>
                      <td className="py-2.5 px-3">1M</td>
                      <td className="py-2.5 px-3">128K</td>
                      <td className="py-2.5 px-3 text-white">$0.0125</td>
                      <td className="py-2.5 px-3 text-[#969696]">$0.0125</td>
                      <td className="py-2.5 px-3 text-white">$0.075</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-white">Gemini 3.8 Flash</td>
                      <td className="py-2.5 px-3">1M</td>
                      <td className="py-2.5 px-3">128K</td>
                      <td className="py-2.5 px-3 text-white">$0.02</td>
                      <td className="py-2.5 px-3 text-[#969696]">$0.02</td>
                      <td className="py-2.5 px-3 text-white">$0.08</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-white">GPT Image 2</td>
                      <td className="py-2.5 px-3">-</td>
                      <td className="py-2.5 px-3">-</td>
                      <td className="py-2.5 px-3 text-[#969696]">-</td>
                      <td className="py-2.5 px-3 text-[#969696]">-</td>
                      <td className="py-2.5 px-3 text-white">$0.02 <span className="text-[10px] text-[#969696]">/image</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-white">Whisper Large V3 Turbo</td>
                      <td className="py-2.5 px-3">-</td>
                      <td className="py-2.5 px-3">-</td>
                      <td className="py-2.5 px-3 text-white">$0.006 <span className="text-[10px] text-[#969696]">/min</span></td>
                      <td className="py-2.5 px-3 text-[#969696]">-</td>
                      <td className="py-2.5 px-3 text-[#969696]">-</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-sans font-medium text-white">Const Search</td>
                      <td className="py-2.5 px-3">-</td>
                      <td className="py-2.5 px-3">-</td>
                      <td className="py-2.5 px-3 text-white">$0.005 <span className="text-[10px] text-[#969696]">/search</span></td>
                      <td className="py-2.5 px-3 text-[#969696]">-</td>
                      <td className="py-2.5 px-3 text-[#969696]">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 6. Reasoning */}
            <section id="reasoning" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Reasoning (Thinking)
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Reasoning (&quot;thinking&quot;) models spend part of their token budget on internal cognitive steps before producing an answer. Control how deeply they think per request with the <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">reasoning_effort</code> parameter.
              </p>

              <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-2 text-xs text-[#969696] font-light">
                <span className="font-semibold text-white">How reasoning_effort works:</span>
                <p>
                  Higher effort yields deeper analytical chains — ideal for complex math, edge-case debugging, and architectural planning, but consumes additional output tokens and adds latency. Higher levels are clamped automatically to what each underlying model supports instead of throwing an error.
                </p>
              </div>

              {/* Reasoning Effort Table */}
              <div className="rounded-xl border border-[#383838]/60 bg-[#222222] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1b1b1b] text-[#969696] font-mono border-b border-[#2e2e2e]">
                    <tr>
                      <th className="px-4 py-3">EFFORT</th>
                      <th className="px-4 py-3">THINKING</th>
                      <th className="px-4 py-3">COST &amp; SPEED</th>
                      <th className="px-4 py-3">RECOMMENDED USE CASE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2e2e] text-[#d4d4d4]">
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">none</td>
                      <td className="px-4 py-3 text-[#969696]">Off</td>
                      <td className="px-4 py-3 font-light text-[#969696]">Cheapest, no thinking tokens</td>
                      <td className="px-4 py-3">Disable reasoning when you require a direct, fast response</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">minimal</td>
                      <td className="px-4 py-3 text-[#969696]">Glance</td>
                      <td className="px-4 py-3 font-light text-[#969696]">Near-zero cost, fastest thinking</td>
                      <td className="px-4 py-3">Trivial tasks that need a subtle touch of validation</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">low</td>
                      <td className="px-4 py-3 text-[#969696]">Short</td>
                      <td className="px-4 py-3 font-light text-[#969696]">Cheapest thinking, fast TTFT</td>
                      <td className="px-4 py-3">Everyday conversational chat, simple Q&amp;A, summaries</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">medium</td>
                      <td className="px-4 py-3 text-[#969696]">Moderate</td>
                      <td className="px-4 py-3 font-light text-[#969696]">Balanced tokens &amp; latency</td>
                      <td className="px-4 py-3">Most general developer tasks — the sensible default</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">high</td>
                      <td className="px-4 py-3 text-[#969696]">Long, deep</td>
                      <td className="px-4 py-3 font-light text-[#969696]">More tokens, higher latency</td>
                      <td className="px-4 py-3">Hard algorithmic math, multi-step coding, refactoring</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">xhigh</td>
                      <td className="px-4 py-3 text-[#969696]">Exhaustive</td>
                      <td className="px-4 py-3 font-light text-[#969696]">Heavy token budget, slower</td>
                      <td className="px-4 py-3">Frontier coding challenges, long-horizon autonomous agents</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">max</td>
                      <td className="px-4 py-3 text-[#969696]">Unconstrained</td>
                      <td className="px-4 py-3 font-light text-[#969696]">Maximum tokens and duration</td>
                      <td className="px-4 py-3">Deepest possible analysis (<code className="font-mono text-white">ultra</code> is an accepted alias)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* JSON Example */}
              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>REASONING REQUEST PAYLOAD</span>
                  <button
                    onClick={() => handleCopy(`{\n  "model": "gemini-3.8-flash",\n  "messages": [\n    { "role": "user", "content": "Prove that sqrt(2) is irrational." }\n  ],\n  "reasoning_effort": "high"\n}`, "reasoning-json")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "reasoning-json" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`{
  "model": "gemini-3.8-flash",
  "messages": [
    { "role": "user", "content": "Prove that sqrt(2) is irrational." }
  ],
  "reasoning_effort": "high"
}`}</pre>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] font-mono text-xs text-[#969696] space-y-1">
                <p className="text-white font-medium font-sans text-xs">Cross-Endpoint Support:</p>
                <p className="text-[11px]">POST /v1/chat/completions &rarr; <span className="text-[#d4d4d4]">&quot;reasoning_effort&quot;: &quot;high&quot;</span></p>
                <p className="text-[11px]">POST /v1/responses &rarr; <span className="text-[#d4d4d4]">&quot;reasoning&quot;: &#123; &quot;effort&quot;: &quot;high&quot; &#125;</span></p>
                <p className="text-[11px]">POST /v1/messages &rarr; <span className="text-[#d4d4d4]">&quot;output_config&quot;: &#123; &quot;effort&quot;: &quot;high&quot; &#125;</span></p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1.5 text-xs">
                  <span className="font-semibold text-white">Safe to Always Send</span>
                  <p className="text-[#969696] font-light">
                    <code className="font-mono text-[#d4d4d4]">reasoning_effort</code> is a no-op on non-reasoning models. You can send it globally without conditional logic. Unsupported levels gracefully clamp to the maximum level allowed by the target model.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1.5 text-xs">
                  <span className="font-semibold text-white">Output Budget Awareness</span>
                  <p className="text-[#969696] font-light">
                    Reasoning models draw thinking tokens from the same overall budget. Setting an excessively low <code className="font-mono text-[#d4d4d4]">max_tokens</code> may exhaust tokens before visible text is produced. We recommend leaving room or omitting the limit.
                  </p>
                </div>
              </div>
            </section>

            {/* 7. Image generation */}
            <section id="image-generation" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Image generation
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Generate high-resolution visual assets directly from descriptive text prompts via <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">POST /v1/images/generations</code>. Fully compatible with OpenAI Image Generation SDKs.
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>CURL EXAMPLE</span>
                  <button
                    onClick={() => handleCopy(`curl -X POST "${baseUrl}/images/generations" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -d '{\n    "model": "gpt-image-2",\n    "prompt": "Minimalist architecture of a modern glass pavilion in mist, editorial photograph",\n    "n": 1,\n    "size": "1024x1024",\n    "response_format": "url"\n  }'`, "img-gen-curl")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "img-gen-curl" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`curl -X POST "${baseUrl}/images/generations" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -d '{
    "model": "gpt-image-2",
    "prompt": "Minimalist architecture of a modern glass pavilion in mist, editorial photograph",
    "n": 1,
    "size": "1024x1024",
    "response_format": "url"
  }'`}</pre>
              </div>

              <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-2 text-xs text-[#969696] font-light">
                <span className="font-semibold text-white">Supported Sizes &amp; Formats:</span>
                <ul className="list-disc list-inside space-y-1 pt-1 text-[#d4d4d4]">
                  <li><code className="font-mono text-white">size</code>: <code className="font-mono text-[#969696]">1024x1024</code> (1k), <code className="font-mono text-[#969696]">2048x2048</code> (2k), <code className="font-mono text-[#969696]">4096x4096</code> (4k)</li>
                  <li><code className="font-mono text-white">response_format</code>: <code className="font-mono text-[#969696]">&quot;url&quot;</code> (temporary signed storage URL) or <code className="font-mono text-[#969696]">&quot;b64_json&quot;</code> (inline Base64 payload)</li>
                  <li><code className="font-mono text-white">models</code>: <code className="font-mono text-white font-semibold">gpt-image-2</code> (Const Image), <code className="font-mono text-[#969696]">imagen-3.0-generate-002</code>, <code className="font-mono text-[#969696]">dall-e-3</code>, <code className="font-mono text-[#969696]">flux-1-schnell</code></li>
                </ul>
              </div>
            </section>

            {/* 8. Image edits */}
            <section id="image-edits" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Image edits
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Edit, inpaint, or modify existing images by supplying an original image and a prompt specifying the alterations via <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">POST /v1/images/edits</code>. Powered by Const Images (<code className="text-white font-mono">gpt-image-2</code>). Uses <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">multipart/form-data</code> or JSON payload.
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>MULTIPART CURL SNIPPET</span>
                  <button
                    onClick={() => handleCopy(`curl -X POST "${baseUrl}/images/edits" \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -F image="@original.png" \\\n  -F mask="@mask.png" \\\n  -F prompt="Add a sleek wooden coffee table in the center of the room" \\\n  -F model="gpt-image-2" \\\n  -F size="1024x1024"`, "img-edit-curl")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "img-edit-curl" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`curl -X POST "${baseUrl}/images/edits" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -F image="@original.png" \\
  -F mask="@mask.png" \\
  -F prompt="Add a sleek wooden coffee table in the center of the room" \\
  -F model="gpt-image-2" \\
  -F size="1024x1024"`}</pre>
              </div>

              <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1.5 text-xs text-[#969696] font-light">
                <span className="font-semibold text-white">Mask Specification:</span>
                <p>
                  The <code className="font-mono text-[#d4d4d4]">mask</code> parameter is an optional PNG file where transparency indicates the exact area to replace. If omitted, the entire image is modified guided by the prompt.
                </p>
              </div>
            </section>

            {/* 9. Audio transcription */}
            <section id="audio-transcription" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Audio transcription
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Transcribe spoken audio files into clean, timestamped text using Whisper and Gemini Audio models via <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">POST /v1/audio/transcriptions</code>.
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>SPEECH-TO-TEXT CURL</span>
                  <button
                    onClick={() => handleCopy(`curl -X POST "${baseUrl}/audio/transcriptions" \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -F file="@meeting-recording.mp3" \\\n  -F model="whisper-large-v3-turbo" \\\n  -F language="id" \\\n  -F response_format="json"`, "transcribe-curl")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "transcribe-curl" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`curl -X POST "${baseUrl}/audio/transcriptions" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -F file="@meeting-recording.mp3" \\
  -F model="whisper-large-v3-turbo" \\
  -F language="id" \\
  -F response_format="json"`}</pre>
              </div>

              <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1.5 text-xs text-[#969696] font-light">
                <span className="font-semibold text-white">Output Formats:</span>
                <p>
                  Supported <code className="font-mono text-[#d4d4d4]">response_format</code> values include <code className="font-mono text-white">json</code>, <code className="font-mono text-white">text</code>, <code className="font-mono text-white">srt</code> (subtitles), and <code className="font-mono text-white">verbose_json</code>. Supports MP3, MP4, M4A, WAV, and WebM up to 25 MB per upload.
                </p>
              </div>
            </section>

            {/* 10. Speech (TTS) */}
            <section id="speech" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Speech (Text-to-Speech)
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Synthesize natural human speech from text with sub-second latency via <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">POST /v1/audio/speech</code>. Returns raw binary audio streaming directly to your client.
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>TEXT-TO-SPEECH CURL</span>
                  <button
                    onClick={() => handleCopy(`curl -X POST "${baseUrl}/audio/speech" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -d '{\n    "model": "tts-1",\n    "input": "Halo! Selamat datang di platform Const Router.",\n    "voice": "alloy",\n    "response_format": "mp3",\n    "speed": 1.0\n  }' \\\n  --output welcome.mp3`, "tts-curl")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "tts-curl" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`curl -X POST "${baseUrl}/audio/speech" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -d '{
    "model": "tts-1",
    "input": "Halo! Selamat datang di platform Const Router.",
    "voice": "alloy",
    "response_format": "mp3",
    "speed": 1.0
  }' \\
  --output welcome.mp3`}</pre>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1 text-xs">
                  <span className="font-semibold text-white">Preset Voices</span>
                  <p className="text-[#969696] font-light">
                    Available voices: <code className="font-mono text-[#d4d4d4]">alloy</code>, <code className="font-mono text-[#d4d4d4]">echo</code>, <code className="font-mono text-[#d4d4d4]">fable</code>, <code className="font-mono text-[#d4d4d4]">onyx</code>, <code className="font-mono text-[#d4d4d4]">nova</code>, and <code className="font-mono text-[#d4d4d4]">shimmer</code>.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1 text-xs">
                  <span className="font-semibold text-white">Audio Formats</span>
                  <p className="text-[#969696] font-light">
                    Outputs high-compression <code className="font-mono text-[#d4d4d4]">mp3</code>, low-latency <code className="font-mono text-[#d4d4d4]">opus</code> (for WebRTC/VoIP), <code className="font-mono text-[#d4d4d4]">aac</code>, or lossless <code className="font-mono text-[#d4d4d4]">flac</code> / <code className="font-mono text-[#d4d4d4]">wav</code>.
                  </p>
                </div>
              </div>
            </section>

            {/* 11. Music generation */}
            <section id="music-generation" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Music generation
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Generate full musical tracks, instrumental themes, and backing audio from text prompts and genre tags via <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">POST /v1/audio/music</code>.
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>MUSIC SYNTHESIS CURL</span>
                  <button
                    onClick={() => handleCopy(`curl -X POST "${baseUrl}/audio/music" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -d '{\n    "model": "musicgen-large",\n    "prompt": "Chill lofi hip-hop beat with gentle electric piano and vinyl crackle",\n    "tags": "lofi, chill, instrumental, relaxing",\n    "duration": 30,\n    "instrumental": true\n  }'`, "music-gen-curl")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "music-gen-curl" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`curl -X POST "${baseUrl}/audio/music" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -d '{
    "model": "musicgen-large",
    "prompt": "Chill lofi hip-hop beat with gentle electric piano and vinyl crackle",
    "tags": "lofi, chill, instrumental, relaxing",
    "duration": 30,
    "instrumental": true
  }'`}</pre>
              </div>

              <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1.5 text-xs text-[#969696] font-light">
                <span className="font-semibold text-white">Execution Model:</span>
                <p>
                  Music synthesis runs asynchronously. Long duration requests return a task identifier (<code className="font-mono text-[#d4d4d4]">&quot;task_id&quot;: &quot;music_0194...&quot;</code>) with pollable status endpoints, or stream directly once rendered.
                </p>
              </div>
            </section>

            {/* 12. Web search */}
            <section id="web-search" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Web search &amp; groundings
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Ground LLM responses with verified real-time internet search results. Enable search grounding by passing the <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">web_search</code> tool in your chat completions request:
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>SEARCH GROUNDED COMPLETION</span>
                  <button
                    onClick={() => handleCopy(`curl -X POST "${baseUrl}/chat/completions" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -d '{\n    "model": "gemini-3.8-flash",\n    "messages": [\n      {"role": "user", "content": "What was the most significant AI announcement in the last 24 hours?"}\n    ],\n    "tools": [{ "type": "web_search" }]\n  }'`, "web-search-curl")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "web-search-curl" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`curl -X POST "${baseUrl}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -d '{
    "model": "gemini-3.8-flash",
    "messages": [
      {"role": "user", "content": "What was the most significant AI announcement in the last 24 hours?"}
    ],
    "tools": [{ "type": "web_search" }]
  }'`}</pre>
              </div>

              <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1.5 text-xs text-[#969696] font-light">
                <span className="font-semibold text-white">Citations &amp; Sources:</span>
                <p>
                  When search grounding is active, the response object includes a <code className="font-mono text-[#d4d4d4]">grounding_metadata</code> payload containing source URLs, titles, and snippet citations for end-user transparency.
                </p>
              </div>
            </section>

            {/* 13. Embeddings */}
            <section id="embeddings" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Embeddings
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Generate vector embeddings for semantic search, retrieval-augmented generation (RAG), and clustering via <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">POST /v1/embeddings</code>:
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4]">
                <pre>{`curl -X POST "${baseUrl}/embeddings" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -d '{
    "model": "text-embedding-3-small",
    "input": "Distributed consensus in modern cloud systems"
  }'`}</pre>
              </div>
            </section>

            {/* 14. Rerank */}
            <section id="rerank" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Rerank
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Reorder candidate retrieval documents by semantic relevance with sub-millisecond scoring via <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">POST /v1/rerank</code>:
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>RERANK REQUEST</span>
                  <button
                    onClick={() => handleCopy(`curl -X POST "${baseUrl}/rerank" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -d '{\n    "model": "rerank-v3",\n    "query": "How do I configure CORS headers in Next.js?",\n    "documents": [\n      "Next.js route handlers support OPTIONS and custom headers.",\n      "PostgreSQL connection pooling guidelines.",\n      "Cross-origin resource sharing configuration in app router."\n    ],\n    "top_n": 2\n  }'`, "rerank-curl")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "rerank-curl" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`curl -X POST "${baseUrl}/rerank" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -d '{
    "model": "rerank-v3",
    "query": "How do I configure CORS headers in Next.js?",
    "documents": [
      "Next.js route handlers support OPTIONS and custom headers.",
      "PostgreSQL connection pooling guidelines.",
      "Cross-origin resource sharing configuration in app router."
    ],
    "top_n": 2
  }'`}</pre>
              </div>
            </section>

            {/* 15. Video generation */}
            <section id="video-generation" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Video generation
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Generate high-quality video clips via <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">POST /v1/videos</code> using text-to-video (<code className="font-mono text-white">t2v</code>) and image-to-video (<code className="font-mono text-white">i2v</code>) pipelines.
              </p>

              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>ASYNC VIDEO TASK</span>
                  <button
                    onClick={() => handleCopy(`curl -X POST "${baseUrl}/videos" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -d '{\n    "model": "gemini-veo-2.0",\n    "prompt": "Drone shot of ocean waves crashing onto black volcanic cliffs at golden hour",\n    "mode": "t2v",\n    "resolution": "1080p",\n    "duration": 5\n  }'`, "video-curl")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "video-curl" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`curl -X POST "${baseUrl}/videos" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -d '{
    "model": "gemini-veo-2.0",
    "prompt": "Drone shot of ocean waves crashing onto black volcanic cliffs at golden hour",
    "mode": "t2v",
    "resolution": "1080p",
    "duration": 5
  }'`}</pre>
              </div>

              <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1 text-xs text-[#969696] font-light">
                <span className="font-semibold text-white">Polling Pattern:</span>
                <p>
                  Video tasks return <code className="font-mono text-white">202 Accepted</code> with a task id. Poll <code className="font-mono text-white">GET /v1/videos/&#123;id&#125;</code> every ~5 seconds until <code className="font-mono text-emerald-400">&quot;status&quot;: &quot;succeeded&quot;</code> to retrieve the download URL.
                </p>
              </div>
            </section>

            {/* 16. Rate limits & quotas */}
            <section id="rate-limits" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Rate limits &amp; quotas
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Const operates on a Pay-As-You-Go model with a generous weekly baseline allocation of <strong>7,000,000 tokens</strong> and <strong>20 image operations</strong>:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1 text-xs">
                  <span className="font-semibold text-white">7-Day Rolling Cycle</span>
                  <p className="text-[#969696] font-light">
                    Your baseline allocation automatically refreshes every 7 days from registration with live metering in the dashboard.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1 text-xs">
                  <span className="font-semibold text-white">Unified Pay-As-You-Go</span>
                  <p className="text-[#969696] font-light">
                    Pay-As-You-Go metered usage covers all models under one unified account without needing external provider keys or multi-vendor billing.
                  </p>
                </div>
              </div>
            </section>

            {/* 17. Errors */}
            <section id="errors" className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl font-serif font-normal text-white">
                Errors
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Errors use a single, stable JSON envelope. Match against the <code className="font-mono text-[#d4d4d4]">type</code> field rather than parsing the message string. Correlate issues with the <code className="font-mono text-white">request_id</code>:
              </p>

              {/* Error Envelope Code Block */}
              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>STANDARD ERROR ENVELOPE</span>
                  <button
                    onClick={() => handleCopy(`{\n  "error": {\n    "type": "rate_limited",\n    "message": "Rate limit exceeded. Please retry later.",\n    "request_id": "req_01948b8c71..."\n  }\n}`, "err-envelope")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "err-envelope" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`{
  "error": {
    "type": "rate_limited",
    "message": "Rate limit exceeded. Please retry later.",
    "request_id": "req_01948b8c71..."
  }
}`}</pre>
              </div>

              {/* Error Codes Table */}
              <div className="rounded-xl border border-[#383838]/60 bg-[#222222] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1b1b1b] text-[#969696] font-mono border-b border-[#2e2e2e]">
                    <tr>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-4 py-3">TYPE</th>
                      <th className="px-4 py-3">MEANING &amp; REMEDY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2e2e] text-[#d4d4d4]">
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">400</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">validation_error</td>
                      <td className="px-4 py-3">The request was malformed or failed validation (e.g. missing <code className="font-mono text-white">model</code> or <code className="font-mono text-white">messages</code> payload).</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">401</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">unauthorized</td>
                      <td className="px-4 py-3">Missing or invalid API key. Verify your key on the dashboard and check the <code className="font-mono text-white">Authorization: Bearer</code> header.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">403</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">forbidden</td>
                      <td className="px-4 py-3">Authenticated, but your account lacks permission to the requested model or the key is revoked.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">404</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">not_found</td>
                      <td className="px-4 py-3">The requested model alias or endpoint does not exist. Check <code className="font-mono text-white">GET /v1/models</code> for valid names.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">413</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">payload_too_large</td>
                      <td className="px-4 py-3">The request body or input context exceeds the maximum allowed token or byte threshold.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">415</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">unsupported_media_type</td>
                      <td className="px-4 py-3">Content-Type must be <code className="font-mono text-white">application/json</code> (or <code className="font-mono text-white">multipart/form-data</code> for audio/image uploads).</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">429</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">rate_limited</td>
                      <td className="px-4 py-3">Rate limit reached or weekly 7,000,000 token quota exceeded. Wait for rolling reset or top up your Pay-As-You-Go balance.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">500</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">internal_error</td>
                      <td className="px-4 py-3">An unexpected gateway exception occurred. Retry with backoff or contact support with the <code className="font-mono text-white">request_id</code>.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">502</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">bad_gateway</td>
                      <td className="px-4 py-3">Upstream model execution failed or returned an invalid response. Model combos handle this automatically.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-white">503</td>
                      <td className="px-4 py-3 font-mono text-[#969696]">service_unavailable</td>
                      <td className="px-4 py-3">The model service is temporarily overloaded or undergoing maintenance. Retry with exponential backoff.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 18. Model combos */}
            <section id="model-combos" className="space-y-4 scroll-mt-24 pb-16">
              <h2 className="text-2xl font-serif font-normal text-white">
                Custom virtual combos
              </h2>
              <p className="text-xs sm:text-sm text-[#969696] font-light leading-relaxed">
                Virtual combos are user-defined failover chains configured in the Combos dashboard with custom identifiers of the form <code className="text-[#d4d4d4] font-mono bg-[#1b1b1b] px-1.5 py-0.5 rounded border border-[#2e2e2e]">combo/&lt;slug&gt;</code>. Users configure their own sequence of Const models to guarantee 100% uptime with sub-second failover.
              </p>

              {/* What is a combo & Circuit breaker cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1.5 text-xs">
                  <span className="font-semibold text-white">In-Flight Cascading Fallback</span>
                  <p className="text-[#969696] font-light leading-relaxed">
                    When invoking <code className="font-mono text-white">combo/&lt;slug&gt;</code>, the gateway attempts each model in your custom order: <code className="font-mono text-[#d4d4d4]">Target 1 &rarr; (if 429/500/timeout) &rarr; Target 2 &rarr; Target 3</code>. The first target that succeeds returns immediately.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1.5 text-xs">
                  <span className="font-semibold text-white">Automatic Circuit Breaker</span>
                  <p className="text-[#969696] font-light leading-relaxed">
                    A built-in circuit breaker prevents repeatedly hitting failing targets. After an upstream error, that model enters a cooldown window where subsequent calls skip it immediately to preserve throughput.
                  </p>
                </div>
              </div>

              {/* Combo cURL Snippet */}
              <div className="rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] p-4 font-mono text-xs text-[#d4d4d4] space-y-2">
                <div className="flex items-center justify-between text-[#969696] border-b border-[#2e2e2e] pb-2 text-[11px]">
                  <span>CALLING A CUSTOM COMBO</span>
                  <button
                    onClick={() => handleCopy(`curl ${baseUrl}/chat/completions \\\n  -H "Authorization: Bearer sk-const-live-yourkey" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "combo/my-route",\n    "messages": [{"role": "user", "content": "Write a high-performance LRU cache in Rust"}]\n  }'`, "combo-curl")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === "combo-curl" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre>{`curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer sk-const-live-yourkey" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "combo/my-route",
    "messages": [{"role": "user", "content": "Write a high-performance LRU cache in Rust"}]
  }'`}</pre>
              </div>

              {/* Custom Combo Configuration Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1">
                  <span className="text-white font-mono font-semibold">1. Identity &amp; Slug</span>
                  <p className="text-[#969696] font-light">
                    Assign a human-readable name and an API route slug (e.g. <code className="text-white font-mono">combo/production-code</code>).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1">
                  <span className="text-white font-mono font-semibold">2. Select Models</span>
                  <p className="text-[#969696] font-light">
                    Add your desired sequence of Const models (e.g. Gemini 3.8 Flash &rarr; Deepseek v4.1 &rarr; GLM 5.3) with drag-and-drop priorities.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#222222] border border-[#383838]/60 space-y-1">
                  <span className="text-white font-mono font-semibold">3. Context &amp; Persona</span>
                  <p className="text-[#969696] font-light">
                    Optionally constrain maximum context length or inject a default system persona across all models in the chain.
                  </p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  </>
);
}
