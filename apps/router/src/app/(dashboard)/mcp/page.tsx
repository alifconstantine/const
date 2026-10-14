"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  BrandLogo,
  AVAILABLE_CONNECTORS,
  type ConnectorMetadata,
  cn,
  toast,
} from "@const/ui";
import {
  Boxes,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Search,
  RefreshCw,
  Terminal,
  Activity,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function McpDashboardPage() {
  const { isAuthenticated } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );
  const userId = user?.email || user?._id || "learn_desktop_user";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeConnector, setActiveConnector] = useState<ConnectorMetadata | null>(null);

  // Connected Accounts State (Synced across Const Learn & Const Router)
  const [connectedAccounts, setConnectedAccounts] = useState<
    Array<{ id: string; toolkit: string; status: string }>
  >([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [connectingConnectorId, setConnectingConnectorId] = useState<string | null>(null);

  // Usage State
  const [usage, setUsage] = useState<{
    allowed: boolean;
    count: number;
    limit: number;
    remaining: number;
    resetDate: string;
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  // Live Test State
  const [testToolSlug, setTestToolSlug] = useState("codeinterpreter");
  const [testInput, setTestInput] = useState("print(2 + 2 * 10)");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<any>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const fetchConnectedAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const res = await fetch(`/v1/mcp/connected-accounts?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.accounts || data.items || [];
        setConnectedAccounts(
          items.map((i: any) => ({
            id: i.id,
            toolkit: (i.toolkit?.slug || i.toolkit || "").toLowerCase(),
            status: i.status || "ACTIVE",
          }))
        );
      }
    } catch (err) {
      console.warn("Failed to fetch connected accounts:", err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const fetchUsage = async () => {
    try {
      setLoadingUsage(true);
      const res = await fetch(`/v1/mcp/usage?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.usage) {
          setUsage(data.usage);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch MCP usage:", err);
    } finally {
      setLoadingUsage(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    fetchConnectedAccounts();
    const interval = setInterval(fetchConnectedAccounts, 10000);
    const onFocus = () => fetchConnectedAccounts();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);

  const isConnected = (connector: ConnectorMetadata) => {
    if (connector.id === "cloud-sandbox") return true;
    const slug = connector.toolkitSlug.toLowerCase().replace(/[-_]/g, "");
    return connectedAccounts.some(
      (a) =>
        a.status === "ACTIVE" &&
        (a.toolkit.replace(/[-_]/g, "") === slug ||
          a.toolkit.includes(slug) ||
          slug.includes(a.toolkit))
    );
  };

  const getConnectedAccountId = (connector: ConnectorMetadata) => {
    const slug = connector.toolkitSlug.toLowerCase().replace(/[-_]/g, "");
    const match = connectedAccounts.find(
      (a) =>
        a.status === "ACTIVE" &&
        (a.toolkit.replace(/[-_]/g, "") === slug ||
          a.toolkit.includes(slug) ||
          slug.includes(a.toolkit))
    );
    return match?.id;
  };

  const handleDisconnect = async (connector: ConnectorMetadata) => {
    const accId = getConnectedAccountId(connector);
    if (!accId) return;
    try {
      toast.info(`Disconnecting ${connector.name}...`);
      const res = await fetch("/v1/mcp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accId, userId }),
      });
      if (res.ok) {
        toast.success(`${connector.name} disconnected.`);
        fetchConnectedAccounts();
      } else {
        toast.error(`Failed to disconnect ${connector.name}.`);
      }
    } catch {
      toast.error(`Failed to disconnect ${connector.name}.`);
    }
  };

  const runTestExecution = async () => {
    setTestStatus("testing");
    setTestResult(null);
    setTestLatency(null);
    const start = performance.now();

    try {
      const res = await fetch("/v1/mcp/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify({
          toolSlug: testToolSlug,
          arguments:
            testToolSlug.toLowerCase().includes("codeinterpreter") ||
            testToolSlug.toLowerCase().includes("sandbox")
              ? { code: testInput }
              : { prompt: "Test Visual Presentation" },
        }),
      });

      const elapsed = Math.round(performance.now() - start);
      setTestLatency(elapsed);

      const json = await res.json();
      if (res.ok && json.success) {
        setTestStatus("success");
        setTestResult(json.data || json.result);
        toast.success("MCP Tool call succeeded!");
        fetchUsage();
      } else {
        setTestStatus("error");
        setTestResult(json.error || "Tool call execution failed.");
        toast.error(json.error || "Execution error");
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestResult(err.message || "Network error");
    }
  };

  const handleConnectOAuth = async (connector: ConnectorMetadata) => {
    try {
      setConnectingConnectorId(connector.id);
      toast.info(`Generating OAuth connection for ${connector.name}...`);
      const res = await fetch("/v1/mcp/auth-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolkit: connector.toolkitSlug,
          userId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.redirectUrl) {
        window.open(data.redirectUrl, "_blank");
        toast.success(`Opened authorization window for ${connector.name}.`);
        setTimeout(fetchConnectedAccounts, 3000);
        setTimeout(fetchConnectedAccounts, 7000);
      } else {
        throw new Error(data.error || "No redirect URL returned.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate OAuth.");
    } finally {
      setConnectingConnectorId(null);
    }
  };

  const filteredConnectors = useMemo(() => {
    return AVAILABLE_CONNECTORS.filter((c) => {
      const matchesCategory = selectedCategory === "All" || c.category === selectedCategory;
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
              MCP Tools & Connectors.
            </h1>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-mono text-[10px]">
              Active Gateway
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground font-light">
            Cloud-hosted Model Context Protocol (MCP) tools for Canva, Google Workspace, Python Sandbox, and educational companion apps.
          </p>
        </div>

        {/* Weekly Quota Card */}
        <div className="flex items-center gap-3 bg-secondary/70 px-4 py-2 rounded-2xl self-start sm:self-auto border border-border/40">
          <Activity className="h-4 w-4 text-emerald-400" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                Weekly Quota
              </span>
              <span className="text-xs font-mono font-medium text-foreground">
                {loadingUsage ? "..." : `${usage?.count ?? 0} / ${usage?.limit ?? 300} calls`}
              </span>
            </div>
            <div className="w-36 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all rounded-full"
                style={{
                  width: `${Math.min(100, (((usage?.count ?? 0) / (usage?.limit ?? 300)) * 100))}%`,
                }}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchUsage}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
            title="Refresh Quota"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingUsage && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Gateway Quick Test Console */}
      <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <h2 className="text-sm font-medium text-foreground">
                Live Cloud MCP Tool Runner
              </h2>
            </div>
            <p className="text-xs text-muted-foreground font-light">
              Test end-to-end execution through Const Router tool gateway (/v1/mcp/execute) with server-side Composio credentials.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <select
              value={testToolSlug}
              onChange={(e) => setTestToolSlug(e.target.value)}
              className="h-9 px-3 rounded-xl bg-secondary text-xs font-mono text-foreground border-none cursor-pointer"
            >
              <option value="codeinterpreter">Cloud Sandbox (Python 3)</option>
              <option value="CANVA_MCP_GENERATE_DESIGN">Canva MCP (Presentation)</option>
              <option value="GOOGLESHEETS_CREATE_SPREADSHEET">Google Sheets (Spreadsheet)</option>
              <option value="GOOGLEDOCS_CREATE_DOCUMENT">Google Docs (Document)</option>
              <option value="YOUTUBE_SEARCH">YouTube Search</option>
            </select>

            <Input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Script or prompt argument"
              className="h-9 w-full sm:w-64 rounded-xl bg-secondary text-xs font-mono text-foreground border-none placeholder:text-muted-foreground"
            />

            <Button
              onClick={runTestExecution}
              disabled={testStatus === "testing"}
              className="h-9 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-xs font-medium px-4 cursor-pointer gap-1.5 shrink-0"
            >
              {testStatus === "testing" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span>Execute Tool</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Live Test Results Output */}
        {testStatus !== "idle" && (
          <div className="mt-4 pt-4 border-t border-border/40 text-xs space-y-2">
            <div className="flex items-center gap-3">
              {testStatus === "testing" && (
                <span className="text-muted-foreground flex items-center gap-1.5 font-mono">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Dispatching call to Composio Tool Router...
                </span>
              )}
              {testStatus === "success" && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-400 rounded-full px-2.5 py-0.5 border-none font-mono">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Success
                  </Badge>
                  {testLatency && (
                    <span className="font-mono text-muted-foreground">
                      Latency: <strong className="text-foreground">{testLatency}ms</strong>
                    </span>
                  )}
                </div>
              )}
              {testStatus === "error" && (
                <Badge className="bg-destructive/15 text-destructive rounded-full px-2.5 py-0.5 border-none font-mono">
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Execution Failed
                </Badge>
              )}
            </div>

            {testResult && (
              <pre className="p-3 rounded-xl bg-secondary/80 font-mono text-[11px] text-foreground overflow-x-auto max-h-48 scrollbar-thin">
                {typeof testResult === "string"
                  ? testResult
                  : JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Categories & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {["All", "Featured", "Productivity", "Creativity", "Developer"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                selectedCategory === cat
                  ? "bg-foreground text-background"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connectors or skills..."
            className="w-full h-8.5 pl-8.5 pr-3 rounded-full bg-secondary text-xs text-foreground placeholder:text-muted-foreground border-none"
          />
        </div>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConnectors.map((connector) => (
          <div
            key={connector.id}
            className="p-5 rounded-2xl bg-card border border-border/40 hover:border-border/80 transition-all flex flex-col justify-between group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex items-center gap-3 cursor-pointer group-hover:opacity-90 transition-opacity"
                  onClick={() => setActiveConnector(connector)}
                >
                  <BrandLogo id={connector.id} name={connector.name} size="md" />
                  <div>
                    <h3 className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">
                      {connector.name}
                    </h3>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {connector.category} • {connector.toolCount} tools
                    </span>
                  </div>
                </div>

                <Badge className="bg-secondary text-muted-foreground rounded-full text-[10px] font-mono border-none">
                  {connector.authType}
                </Badge>
              </div>

              <p
                className="text-xs text-muted-foreground font-light line-clamp-2 cursor-pointer hover:text-foreground/80 transition-colors"
                onClick={() => setActiveConnector(connector)}
              >
                {connector.description}
              </p>

              {/* Skills Tags */}
              <div className="flex flex-wrap gap-1 pt-1">
                {connector.skills.slice(0, 3).map((skill, sIdx) => (
                  <span
                    key={sIdx}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-5 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTestToolSlug(connector.toolkitSlug);
                  toast.info(`Selected ${connector.name} in Live Runner.`);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="h-8 px-3 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer gap-1.5"
              >
                <Terminal className="h-3 w-3" />
                <span>Test in Runner</span>
              </Button>

              {connector.authType !== "No Auth" ? (
                isConnected(connector) ? (
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-mono text-[11px] px-2.5 py-1 flex items-center gap-1.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Connected</span>
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(connector)}
                      className="h-8 px-2.5 rounded-full text-xs font-mono text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                    >
                      <span>Disconnect</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    disabled={connectingConnectorId === connector.id}
                    onClick={() => handleConnectOAuth(connector)}
                    className="h-8 px-3.5 rounded-full bg-secondary hover:bg-foreground hover:text-background text-foreground text-xs font-medium transition-all cursor-pointer gap-1.5"
                  >
                    {connectingConnectorId === connector.id ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect</span>
                        <ExternalLink className="h-3 w-3" />
                      </>
                    )}
                  </Button>
                )
              ) : (
                <Button
                  size="sm"
                  onClick={() => setActiveConnector(connector)}
                  className="h-8 px-3.5 rounded-full bg-secondary hover:bg-foreground hover:text-background text-foreground text-xs font-medium transition-all cursor-pointer gap-1"
                >
                  <span>Details</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {activeConnector && (
        <Dialog open={!!activeConnector} onOpenChange={(open) => !open && setActiveConnector(null)}>
          <DialogContent className="max-w-xl rounded-2xl bg-card border-none p-6 sm:p-8 space-y-6 text-foreground">
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <BrandLogo id={activeConnector.id} name={activeConnector.name} size="lg" />
                <div>
                  <DialogTitle className="text-xl font-serif font-normal text-foreground">
                    {activeConnector.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-light">
                    {activeConnector.tagline}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground font-light leading-relaxed">
                {activeConnector.description}
              </p>

              <div>
                <h4 className="text-[11px] font-mono uppercase text-muted-foreground font-semibold mb-2">
                  Available Tool Capabilities ({activeConnector.skills.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {activeConnector.skills.map((skill, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-secondary/50 font-mono text-[11px] flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span>{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setActiveConnector(null)}
                className="h-9 rounded-full px-4 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Close
              </Button>
              {activeConnector.authType !== "No Auth" && (
                <Button
                  onClick={() => {
                    handleConnectOAuth(activeConnector);
                    setActiveConnector(null);
                  }}
                  className="h-9 rounded-full px-4 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 cursor-pointer gap-1.5"
                >
                  <span>Connect Account</span>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
