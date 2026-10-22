"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  cn,
  toast,
} from "@const/ui";
import {
  Search,
  Copy,
  Check,
  Terminal,
  Code2,
  Cpu,
  Layers,
  Sparkles,
  Laptop,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Workflow,
  Boxes,
  Zap,
} from "lucide-react";

type CategoryId = "all" | "ide" | "cli" | "sdk" | "ecosystem";

interface IntegrationItem {
  id: string;
  name: string;
  category: CategoryId;
  categoryLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  badge: string;
  popular?: boolean;
  docPath?: string;
  configType: "json" | "bash" | "python" | "typescript" | "env";
  defaultSnippet: (baseUrl: string, apiKey: string) => string;
  steps: Array<{ title: string; desc: string }>;
}

export default function IntegrationsPage() {
  const { isAuthenticated } = useRouterAuth();
  const baseUrl = "https://router.const.web.id/v1";
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIntegration, setActiveIntegration] = useState<IntegrationItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live Gateway Connection Tester State
  const [testKey, setTestKey] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const apiKeys = useQuery(
    api.router.keys.listKeys,
    isAuthenticated ? {} : "skip"
  );

  // Set default test key if user has one
  useEffect(() => {
    if (apiKeys && apiKeys.length > 0 && !testKey) {
      setTestKey(apiKeys[0]?.rawKey || apiKeys[0]?.keyPrefix || "sk-const-live-demo");
    }
  }, [apiKeys, testKey]);

  const activeApiKey = useMemo(() => {
    if (apiKeys && apiKeys.length > 0) {
      return apiKeys[0]?.rawKey || apiKeys[0]?.keyPrefix || "sk-const-live-yourkey";
    }
    return "sk-const-live-yourkey";
  }, [apiKeys]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedKey((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const runConnectionTest = async () => {
    setTestStatus("testing");
    setTestLatency(null);
    setTestMessage(null);

    const startTime = performance.now();
    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${testKey || "sk-const-live-anonymous"}`,
        },
      });

      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);
      setTestLatency(latencyMs);

      if (response.ok) {
        const data = await response.json();
        const modelCount = data?.data?.length ?? 0;
        setTestStatus("success");
        setTestMessage(`${response.status} OK • ${modelCount} models discovered`);
      } else {
        setTestStatus("error");
        setTestMessage(`HTTP ${response.status}: ${response.statusText || "Gateway response failed"}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection refused";
      setTestStatus("error");
      setTestMessage(msg);
    }
  };

  const integrationsList: IntegrationItem[] = useMemo(() => [
    {
      id: "cursor",
      name: "Cursor",
      category: "ide",
      categoryLabel: "IDE",
      description: "Supercharge Cursor with high-speed model routing, custom combos, and weekly free token allowance.",
      icon: Laptop,
      iconBg: "bg-sky-500/10",
      iconColor: "text-sky-400",
      badge: "Popular IDE",
      popular: true,
      configType: "bash",
      steps: [
        { title: "Open Settings", desc: "Open Cursor Settings > Models > OpenAI API Key." },
        { title: "Configure Base URL", desc: `Enable 'Override OpenAI Base URL' and paste: ${baseUrl}` },
        { title: "Add Const Models", desc: "Add model names: 'gemini-3.8-flash' or custom 'combo/<slug>'." },
      ],
      defaultSnippet: (b, k) => `# In Cursor Settings > Models:
OpenAI API Base URL: ${b}
API Key: ${k}

# Recommended Model IDs to add:
gemini-3.8-flash
glm-5.3-flash
deepseek-v4.1-flash`,
    },
    {
      id: "continue",
      name: "VS Code Continue",
      category: "ide",
      categoryLabel: "IDE",
      description: "Leading open-source AI code assistant extension inside Visual Studio Code.",
      icon: Code2,
      iconBg: "bg-indigo-500/10",
      iconColor: "text-indigo-400",
      badge: "VS Code Extension",
      popular: true,
      configType: "json",
      steps: [
        { title: "Open Config", desc: "Open ~/.continue/config.json in VS Code." },
        { title: "Insert Provider", desc: "Add Const Router to the 'models' array with provider set to 'openai'." },
        { title: "Reload Extension", desc: "Reload Continue window to activate your new model routes." },
      ],
      defaultSnippet: (b, k) => `{
  "models": [
    {
      "title": "Const - Gemini Flash",
      "provider": "openai",
      "model": "gemini-3.8-flash",
      "apiBase": "${b}",
      "apiKey": "${k}"
    },
    {
      "title": "Const - GLM Flash",
      "provider": "openai",
      "model": "glm-5.3-flash",
      "apiBase": "${b}",
      "apiKey": "${k}"
    }
  ]
}`,
    },
    {
      id: "cline",
      name: "Cline / Roo Code",
      category: "ide",
      categoryLabel: "IDE",
      description: "Autonomous coding agent extension for VS Code with terminal and filesystem execution.",
      icon: Workflow,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      badge: "Autonomous Agent",
      popular: true,
      configType: "json",
      steps: [
        { title: "Select API Provider", desc: "In Cline settings, choose 'OpenAI Compatible'." },
        { title: "Enter Credentials", desc: `Set Base URL to ${baseUrl} and enter your Const API key.` },
        { title: "Specify Model ID", desc: "Set Model ID to 'gemini-3.8-flash' or your custom 'combo/<slug>'." },
      ],
      defaultSnippet: (b, k) => `// Cline / Roo Code Settings:
Provider: OpenAI Compatible
Base URL: ${b}
API Key: ${k}
Model ID: gemini-3.8-flash`,
    },
    {
      id: "windsurf",
      name: "Windsurf",
      category: "ide",
      categoryLabel: "IDE",
      description: "Codeium's agentic IDE with multi-file reasoning and custom OpenAI endpoint routing.",
      icon: Zap,
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-400",
      badge: "Agentic IDE",
      configType: "bash",
      steps: [
        { title: "Settings", desc: "Navigate to Windsurf > Preferences > AI Model Providers." },
        { title: "Custom OpenAI Provider", desc: `Provide ${baseUrl} as the endpoint URL.` },
        { title: "Select Model", desc: "Choose gemini-3.8-flash or your configured combo chain." },
      ],
      defaultSnippet: (b, k) => `Base URL: ${b}
API Key: ${k}
Custom Model: gemini-3.8-flash`,
    },
    {
      id: "aider",
      name: "Aider",
      category: "cli",
      categoryLabel: "CLI Agent",
      description: "Terminal AI pair programming tool with git auto-commit and syntax-aware diffs.",
      icon: Terminal,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      badge: "CLI Tool",
      popular: true,
      configType: "bash",
      steps: [
        { title: "Export Environment", desc: "Export OPENAI_API_BASE and OPENAI_API_KEY in your shell." },
        { title: "Launch Aider", desc: "Run aider specifying openai/gemini-3.8-flash as model." },
      ],
      defaultSnippet: (b, k) => `export OPENAI_API_BASE="${b}"
export OPENAI_API_KEY="${k}"

# Launch Aider with Const Router
aider --model openai/gemini-3.8-flash`,
    },
    {
      id: "claude-code",
      name: "Claude Code",
      category: "cli",
      categoryLabel: "CLI Agent",
      description: "Anthropic's terminal agent redirected through Const Gateway with OpenAI protocol mapping.",
      icon: Terminal,
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-400",
      badge: "CLI Agent",
      configType: "bash",
      steps: [
        { title: "Proxy Setup", desc: "Point ANTHROPIC_BASE_URL to Const's /v1 endpoint adapter." },
        { title: "Run", desc: "Execute claude with your session token." },
      ],
      defaultSnippet: (b, k) => `export ANTHROPIC_BASE_URL="${b}"
export ANTHROPIC_API_KEY="${k}"

claude`,
    },
    {
      id: "curl-cli",
      name: "cURL / Terminal",
      category: "cli",
      categoryLabel: "CLI Tool",
      description: "Direct terminal commands, shell scripts, and CI/CD automated health checks.",
      icon: Terminal,
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-400",
      badge: "cURL",
      configType: "bash",
      steps: [
        { title: "Execute Request", desc: "Use cURL with JSON payload and Authorization Bearer header." },
      ],
      defaultSnippet: (b, k) => `curl -X POST "${b}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${k}" \\
  -d '{
    "model": "gemini-3.8-flash",
    "messages": [
      {"role": "user", "content": "Hello from Const Gateway!"}
    ]
  }'`,
    },
    {
      id: "openai-python",
      name: "OpenAI Python SDK",
      category: "sdk",
      categoryLabel: "Python",
      description: "Official OpenAI Python client library. Zero code changes required beyond base_url.",
      icon: Code2,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      badge: "Python SDK",
      popular: true,
      configType: "python",
      steps: [
        { title: "Install Client", desc: "pip install openai" },
        { title: "Initialize Client", desc: `Pass base_url="${baseUrl}" and your api_key.` },
        { title: "Stream or Fetch", desc: "Call chat.completions.create with any Const model or combo." },
      ],
      defaultSnippet: (b, k) => `from openai import OpenAI

client = OpenAI(
    base_url="${b}",
    api_key="${k}",
)

response = client.chat.completions.create(
    model="gemini-3.8-flash",
    messages=[
        {"role": "user", "content": "Explain quantum computing in one sentence."}
    ],
)

print(response.choices[0].message.content)`,
    },
    {
      id: "openai-node",
      name: "OpenAI TypeScript SDK",
      category: "sdk",
      categoryLabel: "TypeScript",
      description: "Official OpenAI Node.js / TypeScript SDK with full streaming and tool calling.",
      icon: Code2,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      badge: "TypeScript",
      popular: true,
      configType: "typescript",
      steps: [
        { title: "Install Client", desc: "npm install openai" },
        { title: "Set baseURL", desc: `Instantiate new OpenAI({ baseURL: "${baseUrl}", apiKey: ... })` },
      ],
      defaultSnippet: (b, k) => `import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "${b}",
  apiKey: "${k}",
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: "gemini-3.8-flash",
    messages: [{ role: "user", content: "Write a quick Rust snippet." }],
  });

  console.log(completion.choices[0].message.content);
}

main();`,
    },
    {
      id: "vercel-ai",
      name: "Vercel AI SDK",
      category: "sdk",
      categoryLabel: "Framework",
      description: "Build reactive, streaming AI user interfaces in Next.js, React, and Svelte.",
      icon: Sparkles,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
      badge: "Vercel AI SDK",
      configType: "typescript",
      steps: [
        { title: "Install Packages", desc: "npm install ai @ai-sdk/openai" },
        { title: "Configure Provider", desc: `Create provider with createOpenAI({ baseURL: "${baseUrl}" })` },
      ],
      defaultSnippet: (b, k) => `import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const constAi = createOpenAI({
  baseURL: "${b}",
  apiKey: "${k}",
});

const { text } = await generateText({
  model: constAi("gemini-3.8-flash"),
  prompt: "How does rate limiting work?",
});

console.log(text);`,
    },
    {
      id: "langchain",
      name: "LangChain / LlamaIndex",
      category: "sdk",
      categoryLabel: "Framework",
      description: "Framework for building context-aware agents, RAG pipelines, and reasoning loops.",
      icon: Boxes,
      iconBg: "bg-lime-500/10",
      iconColor: "text-lime-400",
      badge: "RAG & Agents",
      configType: "python",
      steps: [
        { title: "Import ChatOpenAI", desc: "from langchain_openai import ChatOpenAI" },
        { title: "Configure Endpoint", desc: `Set openai_api_base="${baseUrl}" and model="gemini-3.8-flash"` },
      ],
      defaultSnippet: (b, k) => `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gemini-3.8-flash",
    openai_api_base="${b}",
    openai_api_key="${k}",
    temperature=0.2,
)

response = llm.invoke("Summarize modern distributed systems.")
print(response.content)`,
    },
    {
      id: "const-harness",
      name: "Const Harness Desktop",
      category: "ecosystem",
      categoryLabel: "Ecosystem",
      description: "Local desktop sandbox and automated test harness with real-time agent observability.",
      icon: Cpu,
      iconBg: "bg-cyan-500/10",
      iconColor: "text-cyan-400",
      badge: "Official Desktop App",
      configType: "bash",
      steps: [
        { title: "Launch App", desc: "Open Const Harness Desktop application." },
        { title: "Sync Keys", desc: "Keys automatically synchronize via secure local IPC tunnel." },
      ],
      defaultSnippet: (b, k) => `# Const Harness Desktop configuration
# Connects seamlessly via local socket:
CONST_ROUTER_URL="${b}"
CONST_API_KEY="${k}"`,
    },
  ], [baseUrl]);

  const filteredIntegrations = useMemo(() => {
    return integrationsList.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.badge.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [integrationsList, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
            Integrations.
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-light">
            Connect Const Router to your coding IDEs, agents, CLI tools, and development stacks.
          </p>
        </div>

        {/* Global Base URL Pill */}
        <div className="flex items-center gap-2 bg-secondary/70 px-3 py-1.5 rounded-full self-start sm:self-auto">
          <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
            Base URL
          </span>
          <code className="text-xs font-mono text-foreground font-medium selection:bg-foreground selection:text-background">
            {baseUrl}
          </code>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(baseUrl, "global-base-url")}
            className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
            title="Copy Base URL"
          >
            {copiedKey === "global-base-url" ? (
              <Check className="h-3 w-3 text-foreground" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Live Gateway Connection Tester Widget */}
      <div className="p-5 sm:p-6 rounded-2xl bg-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-foreground" />
              <h2 className="text-sm font-medium text-foreground">
                Quick Gateway Ping
              </h2>
            </div>
            <p className="text-xs text-muted-foreground font-light">
              Test end-to-end connectivity and response latency to the Const Router gateway from your current browser session.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <Input
                type="text"
                value={testKey}
                onChange={(e) => setTestKey(e.target.value)}
                placeholder="Enter API Key to test"
                className="h-9 w-full sm:w-64 rounded-xl bg-secondary text-xs font-mono text-foreground border-none placeholder:text-muted-foreground"
              />
            </div>

            <Button
              onClick={runConnectionTest}
              disabled={testStatus === "testing"}
              className="h-9 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-xs font-medium px-4 cursor-pointer gap-1.5 shrink-0"
            >
              {testStatus === "testing" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Pinging...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span>Test Connection</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Test Result Feedback */}
        {testStatus !== "idle" && (
          <div className="mt-4 pt-4 flex flex-wrap items-center gap-3 text-xs">
            {testStatus === "testing" && (
              <span className="text-muted-foreground flex items-center gap-1.5 font-mono">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Measuring round-trip latency to {baseUrl}/models...
              </span>
            )}

            {testStatus === "success" && (
              <div className="flex items-center gap-3">
                <Badge className="bg-secondary text-foreground rounded-full px-2.5 py-0.5 border-none flex items-center gap-1 font-mono">
                  <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
                  <span>Connected</span>
                </Badge>
                {testLatency !== null && (
                  <span className="font-mono text-xs text-muted-foreground">
                    Latency: <strong className="text-foreground font-medium">{testLatency}ms</strong>
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {testMessage}
                </span>
              </div>
            )}

            {testStatus === "error" && (
              <div className="flex items-center gap-3">
                <Badge className="bg-destructive/15 text-destructive rounded-full px-2.5 py-0.5 border-none flex items-center gap-1 font-mono">
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Failed</span>
                </Badge>
                <span className="text-xs text-destructive font-mono">
                  {testMessage}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "all", label: "All" },
            { id: "ide", label: "IDEs & Editors" },
            { id: "cli", label: "CLI Agents" },
            { id: "sdk", label: "SDKs & Libs" },
            { id: "ecosystem", label: "Ecosystem" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as CategoryId)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                selectedCategory === cat.id
                  ? "bg-foreground text-background"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Filter */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools or SDKs..."
            className="w-full h-8.5 pl-8.5 pr-3 rounded-full bg-secondary text-xs text-foreground placeholder:text-muted-foreground border-none"
          />
        </div>
      </div>

      {/* Integrations Grid */}
      {filteredIntegrations.length === 0 ? (
        <div className="p-12 rounded-2xl bg-card text-center space-y-2">
          <Layers className="h-8 w-8 text-muted-foreground mx-auto stroke-[1.5]" />
          <p className="text-sm font-medium text-foreground">No integrations match your filter</p>
          <p className="text-xs text-muted-foreground">Try clearing search query or switching categories.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((item) => {
            const Icon = item.icon;
            const snippet = item.defaultSnippet(baseUrl, activeApiKey);

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-card hover:bg-secondary/30 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-xl shrink-0", item.iconBg, item.iconColor)}>
                        <Icon className="h-5 w-5 stroke-[1.75]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">
                          {item.name}
                        </h3>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {item.categoryLabel}
                        </span>
                      </div>
                    </div>

                    <Badge className="bg-secondary text-muted-foreground rounded-full text-[10px] font-mono font-normal border-none">
                      {item.badge}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 font-light">
                    {item.description}
                  </p>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-5 pt-3 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(snippet, `card-${item.id}`)}
                    className="h-8 px-3 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer gap-1.5"
                    title="Quick Copy Config"
                  >
                    {copiedKey === `card-${item.id}` ? (
                      <>
                        <Check className="h-3 w-3 text-foreground" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy snippet</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => setActiveIntegration(item)}
                    className="h-8 px-3.5 rounded-full bg-secondary hover:bg-foreground hover:text-background text-foreground text-xs font-medium transition-all cursor-pointer gap-1"
                  >
                    <span>Configure</span>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Integration Detail & Setup Modal */}
      {activeIntegration && (
        <Dialog open={!!activeIntegration} onOpenChange={(open) => !open && setActiveIntegration(null)}>
          <DialogContent className="max-w-2xl rounded-2xl bg-card border-none p-6 sm:p-8 space-y-6 text-foreground">
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <div className={cn("p-3 rounded-2xl shrink-0", activeIntegration.iconBg, activeIntegration.iconColor)}>
                  <activeIntegration.icon className="h-6 w-6 stroke-[1.75]" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-serif font-normal text-foreground">
                    Connect {activeIntegration.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-light">
                    {activeIntegration.description}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Step-by-Step Instructions */}
            <div className="space-y-3">
              <span className="text-[11px] font-mono uppercase text-muted-foreground font-semibold tracking-wider">
                Setup Instructions
              </span>
              <div className="space-y-2">
                {activeIntegration.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50">
                    <span className="h-5 w-5 rounded-full bg-card text-foreground font-mono text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="text-xs space-y-0.5">
                      <p className="font-medium text-foreground">{step.title}</p>
                      <p className="text-muted-foreground font-light">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration Snippet Block */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-muted-foreground font-semibold tracking-wider">
                  Configuration Snippet ({activeIntegration.configType})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleCopy(
                      activeIntegration.defaultSnippet(baseUrl, activeApiKey),
                      "modal-snippet"
                    )
                  }
                  className="h-7 px-2.5 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer gap-1.5"
                >
                  {copiedKey === "modal-snippet" ? (
                    <>
                      <Check className="h-3 w-3 text-foreground" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-secondary/80 font-mono text-xs text-foreground overflow-x-auto selection:bg-foreground selection:text-background">
                <pre className="leading-relaxed">
                  {activeIntegration.defaultSnippet(baseUrl, activeApiKey)}
                </pre>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setActiveIntegration(null)}
                className="h-9 rounded-full px-4 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  handleCopy(
                    activeIntegration.defaultSnippet(baseUrl, activeApiKey),
                    "modal-snippet-btn"
                  );
                  setActiveIntegration(null);
                }}
                className="h-9 rounded-full bg-foreground text-background hover:bg-foreground/90 px-5 text-xs font-medium cursor-pointer"
              >
                Copy &amp; Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

