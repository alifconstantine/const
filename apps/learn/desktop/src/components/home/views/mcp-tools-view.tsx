import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Check,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Copy,
  CheckCheck,
  Code2,
  Server,
  Layers,
  RotateCcw,
  Cable,
  MoreHorizontal,
  ExternalLink,
  Search,
  ArrowLeft,
  ShieldCheck,
  Unlink2,
  Link2,
  Upload,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  BrandLogo,
  AVAILABLE_CONNECTORS,
  type ConnectorMetadata,
  toast,
  cn,
} from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import {
  type McpServerConfig,
  type McpConfigurationState,
  type McpTransport,
  type McpScope,
  getStoredMcpConfig,
  saveStoredMcpConfig,
  exportMcpJson,
  importMcpJson,
} from "../../../lib/mcp-connectors";
import {
  getConnectedConnectorIds,
  isConnectorActive,
  connectConnector,
  disconnectConnector,
} from "../../../lib/connectors-service";

type MainTab = "apps" | "custom_mcp";
type CustomMcpSubTab = "servers" | "json";
type FormMode = "form" | "json";
type CategoryFilter = "All" | "Featured" | "Productivity" | "Creativity" | "Education" | "Developer";

interface ServerFormData {
  id?: string;
  name: string;
  scope: McpScope;
  transport: McpTransport;
  timeoutMs: number;
  protocolVersion: string;
  url: string;
  headersText: string;
  command: string;
  argsText: string;
  envText: string;
}

const DEFAULT_SERVER_FORM: ServerFormData = {
  name: "my-mcp-server",
  scope: "user",
  transport: "http",
  timeoutMs: 30000,
  protocolVersion: "auto",
  url: "https://mcp.example.com/mcp",
  headersText: "{}",
  command: "npx",
  argsText: "",
  envText: "{}",
};

export function McpToolsView() {
  const { language } = useI18n();
  const isIndo = language === "id";

  // Two Main Tabs: Apps & Tools (First) and Custom MCP (Second)
  const [mainTab, setMainTab] = useState<MainTab>("apps");

  // Sliding tab indicator (matching ModelsView)
  const appsTabRef = useRef<HTMLButtonElement>(null);
  const customMcpTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const updateIndicator = () => {
      let activeEl: HTMLButtonElement | null = null;
      if (mainTab === "apps") activeEl = appsTabRef.current;
      else if (mainTab === "custom_mcp") activeEl = customMcpTabRef.current;

      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    };
    updateIndicator();
    const timer = setTimeout(updateIndicator, 50);
    window.addEventListener("resize", updateIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [mainTab, language]);

  // Apps & Tools State
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConnector, setSelectedConnector] = useState<ConnectorMetadata | null>(null);
  const [connectedIds, setConnectedIds] = useState<string[]>(() => getConnectedConnectorIds());
  const [isConnectingId, setIsConnectingId] = useState<string | null>(null);
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);

  // Custom MCP State
  const [customMcpSubTab, setCustomMcpSubTab] = useState<CustomMcpSubTab>("servers");
  const [mcpConfig, setMcpConfig] = useState<McpConfigurationState>(() => getStoredMcpConfig());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form / Editor View State (Image 3)
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("form");
  const [formData, setFormData] = useState<ServerFormData>(DEFAULT_SERVER_FORM);
  const [isHeadersOpen, setIsHeadersOpen] = useState(false);
  const [isEnvOpen, setIsEnvOpen] = useState(false);
  const [singleJsonText, setSingleJsonText] = useState("");

  // Full JSON Config inside Custom MCP
  const [fullJsonText, setFullJsonText] = useState("");
  const [isCopiedFullJson, setIsCopiedFullJson] = useState(false);

  // Import Dialog State
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importJsonInput, setImportJsonInput] = useState("");

  useEffect(() => {
    const handleUpdate = () => {
      setMcpConfig(getStoredMcpConfig());
      setConnectedIds(getConnectedConnectorIds());
    };
    window.addEventListener("mcp_servers_changed", handleUpdate);
    window.addEventListener("connectors_changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("mcp_servers_changed", handleUpdate);
      window.removeEventListener("connectors_changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Sync full json
  useEffect(() => {
    setFullJsonText(exportMcpJson(mcpConfig));
  }, [mcpConfig]);

  // Sync single json text
  useEffect(() => {
    if (formMode === "form") {
      let parsedHeaders: Record<string, string> = {};
      try {
        if (formData.headersText.trim()) parsedHeaders = JSON.parse(formData.headersText);
      } catch {}

      let parsedEnv: Record<string, string> = {};
      try {
        if (formData.envText.trim()) parsedEnv = JSON.parse(formData.envText);
      } catch {}

      const singleObj: Record<string, any> = {
        name: formData.name,
        type: formData.transport,
        scope: formData.scope,
        timeoutMs: formData.timeoutMs,
        protocolVersion: formData.protocolVersion,
      };

      if (formData.transport === "stdio") {
        singleObj.command = formData.command;
        singleObj.args = formData.argsText
          ? formData.argsText.trim().split(/\s+/).filter(Boolean)
          : [];
        if (Object.keys(parsedEnv).length > 0) singleObj.env = parsedEnv;
      } else {
        singleObj.url = formData.url;
        if (Object.keys(parsedHeaders).length > 0) singleObj.headers = parsedHeaders;
      }

      setSingleJsonText(JSON.stringify(singleObj, null, 2));
    }
  }, [formData, formMode]);

  // Real Connectors Filtering (No dummy data)
  const filteredConnectors = useMemo(() => {
    return AVAILABLE_CONNECTORS.filter((c) => {
      if (c.id === "cloud-sandbox") return false;
      const matchCat = selectedCategory === "All" || c.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  // Connect / Authorize Handler for Apps & Tools
  const handleToggleConnect = async (connector: ConnectorMetadata, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isActive = isConnectorActive(connector.id);
    setIsConnectingId(connector.id);

    try {
      if (isActive) {
        await disconnectConnector(connector.id);
        setConnectedIds(getConnectedConnectorIds());
        toast.success(
          isIndo
            ? `${connector.name} berhasil dinonaktifkan.`
            : `${connector.name} disconnected successfully.`
        );
      } else {
        const res = await connectConnector(connector);
        setConnectedIds(getConnectedConnectorIds());
        if (res.message) {
          toast.success(res.message);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengubah status koneksi.");
    } finally {
      setIsConnectingId(null);
    }
  };

  const handleCopyPrompt = (prompt: string, idx: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPromptIndex(idx);
    toast.success(isIndo ? "Prompt disalin ke clipboard!" : "Prompt copied to clipboard!");
    setTimeout(() => setCopiedPromptIndex(null), 2000);
  };

  // Custom MCP Handlers
  const handleToggleServer = (serverId: string, nextChecked: boolean) => {
    const updated = mcpConfig.servers.map((s) => {
      if (s.id === serverId) {
        return {
          ...s,
          enabled: nextChecked,
          status: (nextChecked ? "ready" : "disabled") as any,
        };
      }
      return s;
    });
    const nextConfig = { ...mcpConfig, servers: updated };
    setMcpConfig(nextConfig);
    saveStoredMcpConfig(nextConfig);
    toast.success(
      isIndo
        ? `Server ${nextChecked ? "diaktifkan" : "dinonaktifkan"}.`
        : `Server ${nextChecked ? "enabled" : "disabled"}.`
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setMcpConfig(getStoredMcpConfig());
      setConnectedIds(getConnectedConnectorIds());
      toast.success(isIndo ? "Status server berhasil diperbarui." : "Server status refreshed.");
    }, 500);
  };

  const handleOpenNewServer = () => {
    setFormData(DEFAULT_SERVER_FORM);
    setIsEditingExisting(false);
    setFormMode("form");
    setIsHeadersOpen(false);
    setIsEnvOpen(false);
    setIsEditingServer(true);
  };

  const handleEditServer = (server: McpServerConfig) => {
    setFormData({
      id: server.id,
      name: server.name,
      scope: server.scope || "user",
      transport: server.transport,
      timeoutMs: server.timeoutMs || 30000,
      protocolVersion: server.protocolVersion || "auto",
      url: server.url || "",
      headersText: server.headers && Object.keys(server.headers).length > 0
        ? JSON.stringify(server.headers, null, 2)
        : "{}",
      command: server.command || "npx",
      argsText: server.args ? server.args.join(" ") : "",
      envText: server.env && Object.keys(server.env).length > 0
        ? JSON.stringify(server.env, null, 2)
        : "{}",
    });
    setIsHeadersOpen(Boolean(server.headers && Object.keys(server.headers).length > 0));
    setIsEnvOpen(Boolean(server.env && Object.keys(server.env).length > 0));
    setIsEditingExisting(true);
    setFormMode("form");
    setIsEditingServer(true);
  };

  const handleSaveServer = () => {
    if (formMode === "json") {
      try {
        const parsed = JSON.parse(singleJsonText);
        if (!parsed.name && !formData.name) {
          toast.error(isIndo ? "Name wajib diisi." : "Name is required.");
          return;
        }

        const id =
          formData.id ||
          (parsed.name || formData.name)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9_-]/g, "-");

        const isStdio = parsed.type === "stdio" || (!parsed.url && parsed.command);
        const serverObj: McpServerConfig = {
          id,
          name: parsed.name || formData.name,
          transport: (parsed.type || parsed.transport || (isStdio ? "stdio" : "http")) as McpTransport,
          scope: parsed.scope || formData.scope,
          timeoutMs: parsed.timeoutMs || formData.timeoutMs,
          protocolVersion: parsed.protocolVersion || formData.protocolVersion,
          command: parsed.command || (isStdio ? "npx" : undefined),
          args: Array.isArray(parsed.args) ? parsed.args : [],
          url: parsed.url,
          headers: parsed.headers || {},
          env: parsed.env || {},
          enabled: true,
          status: "ready",
          isCustom: true,
        };

        const exists = mcpConfig.servers.some((s) => s.id === id);
        let updatedServers: McpServerConfig[];
        if (exists) {
          updatedServers = mcpConfig.servers.map((s) => (s.id === id ? serverObj : s));
        } else {
          updatedServers = [...mcpConfig.servers, serverObj];
        }

        const nextConfig = { ...mcpConfig, servers: updatedServers };
        setMcpConfig(nextConfig);
        saveStoredMcpConfig(nextConfig);
        setIsEditingServer(false);
        toast.success(isIndo ? `Server ${serverObj.name} disimpan.` : `Server ${serverObj.name} saved.`);
        return;
      } catch (err: any) {
        toast.error(
          isIndo ? `Format JSON tidak valid: ${err?.message || ""}` : `Invalid JSON syntax: ${err?.message || ""}`
        );
        return;
      }
    }

    // Form mode validation
    if (!formData.name.trim()) {
      toast.error(isIndo ? "Nama server wajib diisi." : "Server name is required.");
      return;
    }

    if (formData.transport === "stdio" && !formData.command.trim()) {
      toast.error(isIndo ? "Command wajib diisi untuk stdio." : "Command is required for stdio.");
      return;
    }

    if ((formData.transport === "http" || formData.transport === "sse") && !formData.url.trim()) {
      toast.error(isIndo ? "URL wajib diisi untuk HTTP/SSE." : "URL is required for HTTP/SSE.");
      return;
    }

    let parsedHeaders: Record<string, string> = {};
    if (formData.headersText.trim()) {
      try {
        parsedHeaders = JSON.parse(formData.headersText);
      } catch {
        toast.error(isIndo ? "Format Headers JSON tidak valid." : "Invalid Headers JSON syntax.");
        return;
      }
    }

    let parsedEnv: Record<string, string> = {};
    if (formData.envText.trim()) {
      try {
        parsedEnv = JSON.parse(formData.envText);
      } catch {
        toast.error(isIndo ? "Format Environment variables JSON tidak valid." : "Invalid Environment variables JSON syntax.");
        return;
      }
    }

    const id =
      formData.id ||
      formData.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_-]/g, "-");

    const serverObj: McpServerConfig = {
      id,
      name: formData.name.trim(),
      transport: formData.transport,
      scope: formData.scope,
      timeoutMs: Number(formData.timeoutMs) || 30000,
      protocolVersion: formData.protocolVersion,
      command: formData.transport === "stdio" ? formData.command.trim() : undefined,
      args:
        formData.transport === "stdio"
          ? formData.argsText.trim().split(/\s+/).filter(Boolean)
          : undefined,
      url: formData.transport !== "stdio" ? formData.url.trim() : undefined,
      headers: parsedHeaders,
      env: parsedEnv,
      enabled: true,
      status: "ready",
      isCustom: true,
    };

    const exists = mcpConfig.servers.some((s) => s.id === id);
    let updatedServers: McpServerConfig[];
    if (exists) {
      updatedServers = mcpConfig.servers.map((s) => (s.id === id ? serverObj : s));
    } else {
      updatedServers = [...mcpConfig.servers, serverObj];
    }

    const nextConfig = { ...mcpConfig, servers: updatedServers };
    setMcpConfig(nextConfig);
    saveStoredMcpConfig(nextConfig);
    setIsEditingServer(false);
    toast.success(isIndo ? `Server ${serverObj.name} disimpan.` : `Server ${serverObj.name} saved.`);
  };

  const handleDeleteServer = (serverId: string) => {
    const updated = mcpConfig.servers.filter((s) => s.id !== serverId);
    const nextConfig = { ...mcpConfig, servers: updated };
    setMcpConfig(nextConfig);
    saveStoredMcpConfig(nextConfig);
    setIsEditingServer(false);
    toast.success(isIndo ? "Server dihapus." : "Server deleted.");
  };

  const handleResetAllServers = () => {
    const emptyConfig: McpConfigurationState = { servers: [] };
    setMcpConfig(emptyConfig);
    saveStoredMcpConfig(emptyConfig);
    toast.success(isIndo ? "Semua server MCP dibersihkan." : "All MCP servers cleared.");
  };

  const handleSaveFullJson = () => {
    try {
      const imported = importMcpJson(fullJsonText);
      setMcpConfig(imported);
      saveStoredMcpConfig(imported);
      toast.success(
        isIndo
          ? `Berhasil memperbarui ${imported.servers.length} server MCP.`
          : `Successfully updated ${imported.servers.length} MCP servers.`
      );
    } catch (err: any) {
      toast.error(
        isIndo ? `Format JSON tidak valid: ${err?.message || ""}` : `Invalid JSON syntax: ${err?.message || ""}`
      );
    }
  };

  const handleCopyFullJson = () => {
    navigator.clipboard.writeText(fullJsonText);
    setIsCopiedFullJson(true);
    toast.success(isIndo ? "Konfigurasi disalin ke clipboard!" : "Configuration copied to clipboard!");
    setTimeout(() => setIsCopiedFullJson(false), 2000);
  };

  const handleExecuteImport = () => {
    if (!importJsonInput.trim()) return;
    try {
      const imported = importMcpJson(importJsonInput);
      setMcpConfig(imported);
      saveStoredMcpConfig(imported);
      setIsImportDialogOpen(false);
      setImportJsonInput("");
      toast.success(
        isIndo
          ? `Berhasil mengimpor ${imported.servers.length} server MCP.`
          : `Successfully imported ${imported.servers.length} MCP servers.`
      );
    } catch (err: any) {
      toast.error(
        isIndo ? `Gagal mengimpor JSON: ${err?.message || ""}` : `Failed to import JSON: ${err?.message || ""}`
      );
    }
  };

  return (
    <div className="w-full flex flex-col space-y-6 font-sans">
      {/* =================================================================== */}
      {/* 1. Header Section - Clean & Harmonized with Models/Sources         */}
      {/* =================================================================== */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
            {isIndo ? "Connectors & Integrasi MCP" : "Connectors & MCP Integrations"}
          </h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
            {mainTab === "apps" ? `${connectedIds.length} ${isIndo ? "Aktif" : "Active"}` : `${mcpConfig.servers.length} Installed`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {isIndo
            ? "Hubungkan akun Canva MCP, Google Workspace, dan YouTube, atau kelola server MCP kustom."
            : "Connect Canva MCP, Google Workspace, and YouTube to expand your AI Tutor's capabilities."}
        </p>
      </div>

      {/* =================================================================== */}
      {/* 2. Main Tab Navigation Switcher - Left-Aligned Below Header        */}
      {/* =================================================================== */}
      <div className="flex items-center gap-2">
        {/* Modality Sliding Pill Switcher - exact height h-9 matching ModelsView */}
        <div className="relative flex items-center h-9 p-0.5 rounded-xl bg-muted/70 border border-border w-fit">
          <div
            className="absolute top-0.5 bottom-0.5 left-0 rounded-lg bg-background shadow-2xs pointer-events-none transition-all duration-300"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.width > 0 ? 1 : 0,
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />

          <button
            ref={appsTabRef}
            type="button"
            onClick={() => {
              setMainTab("apps");
              setSelectedConnector(null);
              setIsEditingServer(false);
            }}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              mainTab === "apps"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isIndo ? "Apps & Tools" : "Apps & Tools"}</span>
          </button>

          <button
            ref={customMcpTabRef}
            type="button"
            onClick={() => {
              setMainTab("custom_mcp");
              setSelectedConnector(null);
              setIsEditingServer(false);
            }}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              mainTab === "custom_mcp"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{isIndo ? "Custom MCP" : "Custom MCP"}</span>
            {mcpConfig.servers.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary font-mono">
                {mcpConfig.servers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: APPS & TOOLS (Real Connectors with Open authorization style) */}
      {/* =================================================================== */}
      {mainTab === "apps" && !selectedConnector && (
        <div className="space-y-6">
          {/* Search & Category Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isIndo ? "Cari aplikasi, alat, atau skill..." : "Search apps, tools, or skills..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors"
              />
            </div>

            {/* Category Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(["All", "Featured", "Productivity", "Creativity", "Education", "Developer"] as CategoryFilter[]).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                      selectedCategory === cat
                        ? "bg-foreground text-background"
                        : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60"
                    )}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Connectors List (Matching Image 1: Open Authorization style) */}
          <div className="space-y-3">
            {filteredConnectors.map((connector) => {
              const isConnected = isConnectorActive(connector.id);
              const isConnecting = isConnectingId === connector.id;

              return (
                <div
                  key={connector.id}
                  onClick={() => setSelectedConnector(connector)}
                  className="group rounded-2xl border border-border/70 bg-card/60 hover:bg-secondary/20 transition-all p-4 flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Logo Box with Status Dot */}
                    <div className="w-11 h-11 rounded-xl bg-secondary/80 border border-border flex items-center justify-center relative shrink-0">
                      <BrandLogo id={connector.id} name={connector.name} size="md" />
                      <span
                        className={cn(
                          "w-2.5 h-2.5 rounded-full ring-2 ring-card absolute -bottom-0.5 -right-0.5 transition-colors",
                          isConnected ? "bg-emerald-500" : "bg-amber-400 ring-amber-400/30"
                        )}
                        title={isConnected ? "Connected" : "Disconnected"}
                      />
                    </div>

                    {/* App Title & Subtitle */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {connector.name}
                        </h4>
                        <span className="text-[10.5px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono">
                          {connector.authType}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed truncate max-w-sm sm:max-w-xl">
                        {isConnected
                          ? (isIndo ? "Konektor plugin ini sudah terhubung dan tersedia." : "This plugin MCP server is connected and available.")
                          : (isIndo ? "Hubungkan untuk menggunakan plugin MCP ini." : "Connect to use this plugin MCP server.")}
                      </p>
                    </div>
                  </div>

                  {/* Right Action: Connect or Disconnect */}
                  <div className="shrink-0 flex items-center gap-3">
                    {!isConnected ? (
                      <button
                        type="button"
                        disabled={isConnecting}
                        onClick={(e) => handleToggleConnect(connector, e)}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{isConnecting ? (isIndo ? "Menghubungkan..." : "Connecting...") : "Connect"}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-medium border border-emerald-500/20">
                          <Check className="w-3 h-3" />
                          <span>{isIndo ? "Terhubung" : "Connected"}</span>
                        </span>
                        <button
                          type="button"
                          disabled={isConnecting || connector.isBuiltin}
                          onClick={(e) => handleToggleConnect(connector, e)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer px-2 py-1"
                        >
                          {isIndo ? "Putus" : "Disconnect"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredConnectors.length === 0 && (
              <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-card/40">
                <p className="text-xs text-muted-foreground">
                  {isIndo
                    ? `Tidak ada aplikasi yang sesuai dengan "${searchQuery}".`
                    : `No connectors found matching "${searchQuery}".`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail View for Single Connector */}
      {mainTab === "apps" && selectedConnector && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <button
            type="button"
            onClick={() => setSelectedConnector(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isIndo ? "Kembali ke Semua Connectors" : "Back to All Connectors"}</span>
          </button>

          <div className="p-6 rounded-3xl border border-border bg-card/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <BrandLogo id={selectedConnector.id} name={selectedConnector.name} size="lg" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-semibold text-foreground tracking-tight">
                    {selectedConnector.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-xs font-mono border border-border/70">
                    {selectedConnector.authType}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-xs font-medium border border-border/70">
                    {selectedConnector.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  {selectedConnector.tagline}
                </p>
                <div className="text-[11px] text-muted-foreground/80 flex items-center gap-3 pt-1">
                  <span>{selectedConnector.info.developer}</span>
                  <span>•</span>
                  <span>v{selectedConnector.info.version}</span>
                  <span>•</span>
                  <span>{selectedConnector.toolCount} Available Tools</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              {isConnectorActive(selectedConnector.id) ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isConnectingId === selectedConnector.id || selectedConnector.isBuiltin}
                  onClick={(e) => handleToggleConnect(selectedConnector, e)}
                  className="rounded-xl px-5 h-9 text-xs font-medium cursor-pointer"
                >
                  <Unlink2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>{isIndo ? "Putuskan Koneksi" : "Disconnect"}</span>
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  disabled={isConnectingId === selectedConnector.id}
                  onClick={(e) => handleToggleConnect(selectedConnector, e)}
                  className="rounded-xl px-6 h-9 text-xs font-medium cursor-pointer bg-foreground text-background hover:opacity-90"
                >
                  <Link2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>{isIndo ? "Hubungkan" : "Connect"}</span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="p-5 rounded-2xl border border-border bg-card/50 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>{isIndo ? "Tentang Integrasi" : "About Integration"}</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedConnector.description}
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card/50 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>{isIndo ? "Kemampuan & Tools (Capabilities)" : "Skills & Capabilities"}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {selectedConnector.skills.map((skill, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-secondary/40 border border-border/60 text-xs text-foreground flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate">{skill}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedConnector.tryPrompts && selectedConnector.tryPrompts.length > 0 && (
                <div className="p-5 rounded-2xl border border-border bg-card/50 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {isIndo ? "Contoh Prompt Belajar" : "Example Study Prompts"}
                  </h3>
                  <div className="space-y-2">
                    {selectedConnector.tryPrompts.map((prompt, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleCopyPrompt(prompt, idx)}
                        className="p-3 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/60 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                        title="Click to copy prompt"
                      >
                        <p className="text-xs text-foreground/90 font-mono select-none">
                          {prompt}
                        </p>
                        <button type="button" className="p-1 rounded text-muted-foreground hover:text-foreground shrink-0">
                          {copiedPromptIndex === idx ? (
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-border bg-card/50 space-y-3">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                  {isIndo ? "Informasi Pengembang" : "Developer Information"}
                </h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Developer</span>
                    <span className="font-medium text-foreground">{selectedConnector.info.developer}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Website</span>
                    <a
                      href={selectedConnector.info.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <span>{selectedConnector.info.website.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: CUSTOM MCP (Full JSON & Servers inside, Image 2 & 3 style)   */}
      {/* =================================================================== */}
      {mainTab === "custom_mcp" && (
        <div className="space-y-6">
          {/* Sub Toolbar inside Custom MCP: Switcher (Servers | JSON Config) + Add Server Button */}
          {!isEditingServer && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left: Sub-tabs [Servers] [JSON Config] */}
              <div className="flex items-center p-0.5 rounded-xl bg-secondary/60 border border-border w-fit">
                <button
                  type="button"
                  onClick={() => setCustomMcpSubTab("servers")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
                    customMcpSubTab === "servers"
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Servers</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomMcpSubTab("json")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
                    customMcpSubTab === "json"
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>JSON Config</span>
                </button>
              </div>

              {/* Right: Refresh & + Add server */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-xl border border-border bg-card/60 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                      title={isIndo ? "Opsi" : "Options"}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground p-1 rounded-xl shadow-xl">
                    <DropdownMenuItem
                      onClick={() => setIsImportDialogOpen(true)}
                      className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{isIndo ? "Impor dari JSON" : "Import from JSON"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleCopyFullJson}
                      className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{isIndo ? "Salin mcpServers.json" : "Copy mcpServers.json"}</span>
                    </DropdownMenuItem>
                    {mcpConfig.servers.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-1 bg-border/60" />
                        <DropdownMenuItem
                          onClick={handleResetAllServers}
                          className="text-xs px-3 py-2 rounded-lg cursor-pointer text-destructive hover:bg-destructive/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isIndo ? "Hapus Semua Server" : "Clear All Servers"}</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-8 w-8 rounded-xl border border-border bg-card/60 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  title="Refresh"
                >
                  <RotateCcw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-primary")} />
                </button>

                <button
                  type="button"
                  onClick={handleOpenNewServer}
                  className="h-8 px-3.5 rounded-xl bg-foreground text-background hover:opacity-90 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isIndo ? "Add server" : "Add server"}</span>
                </button>
              </div>
            </div>
          )}

          {/* SUB-VIEW 1: SERVERS LIST (Matching Image 2 - Clean & 0 dummy data) */}
          {customMcpSubTab === "servers" && !isEditingServer && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground tracking-tight">
                  Installed
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {mcpConfig.servers.length}
                </span>
              </div>

              {mcpConfig.servers.length === 0 ? (
                <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-border bg-card/40 space-y-3">
                  <div className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center mx-auto">
                    <Cable className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h3 className="text-sm font-semibold text-foreground">
                      {isIndo ? "Belum Ada Server MCP Kustom" : "No Custom MCP Servers"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {isIndo
                        ? "Tambahkan server MCP kustom untuk menghubungkan alat eksternal atau skrip ke ruang kerja Anda."
                        : "Add a custom MCP server to connect external tools or scripts to your workspace."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenNewServer}
                    className="px-4 py-2 rounded-xl bg-foreground text-background hover:opacity-90 text-xs font-medium cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isIndo ? "Tambah Server Baru" : "Add Server"}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {mcpConfig.servers.map((server) => {
                    const isEnabled = server.enabled !== false;
                    const isStdio = server.transport === "stdio";
                    const detailText = isStdio
                      ? `stdio · ${server.command || "npx"} ${(server.args || []).join(" ")}`
                      : `${server.transport} · ${server.url || ""}`;

                    return (
                      <div
                        key={server.id}
                        onClick={() => handleEditServer(server)}
                        className="group p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-card/60 hover:bg-secondary/30 hover:border-foreground/20 transition-all cursor-pointer flex items-center justify-between gap-4 shadow-2xs"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-secondary/80 border border-border/80 flex items-center justify-center relative shrink-0">
                            <Cable className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            <span
                              className={cn(
                                "w-2.5 h-2.5 rounded-full ring-2 ring-card absolute -bottom-0.5 -right-0.5 transition-colors",
                                isEnabled ? "bg-amber-400" : "bg-muted-foreground/40"
                              )}
                            />
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground truncate">
                                {server.name}
                              </span>
                              {server.scope && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono uppercase border border-border/60">
                                  {server.scope}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-sm sm:max-w-xl">
                              {detailText}
                            </p>
                          </div>
                        </div>

                        <div
                          className="shrink-0 flex items-center gap-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToggleServer(server.id, checked)}
                            className="data-[state=checked]:bg-foreground"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 2: FORM / JSON SERVER EDITOR (Matching Image 3) */}
          {customMcpSubTab === "servers" && isEditingServer && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">
                    {isEditingExisting
                      ? (isIndo ? "Edit MCP server" : "Edit MCP server")
                      : (isIndo ? "New MCP server" : "New MCP server")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isIndo
                      ? "Isi konfigurasi MCP baru, lalu simpan untuk kembali ke daftar."
                      : "Fill in the new MCP configuration, then save to return to the list."}
                  </p>
                </div>

                {/* Form | JSON Toggle for Single Server */}
                <div className="flex items-center p-0.5 rounded-xl bg-secondary/80 border border-border self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setFormMode("form")}
                    className={cn(
                      "px-3.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                      formMode === "form"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMode("json")}
                    className={cn(
                      "px-3.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                      formMode === "json"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    JSON
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card/80 p-5 sm:p-7 shadow-xs space-y-5">
                {formMode === "form" ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Name</label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="my-mcp-server"
                          className="h-9 text-xs rounded-xl bg-secondary/40 border-border text-foreground"
                        />
                      </div>

                      <div className="space-y-1.5 shrink-0 sm:w-44">
                        <label className="text-xs font-medium text-foreground">Scope</label>
                        <Select
                          value={formData.scope}
                          onValueChange={(val: McpScope) => setFormData({ ...formData, scope: val })}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-secondary/40 border-border">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="workspace">Workspace</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Type</label>
                      <Select
                        value={formData.transport}
                        onValueChange={(val: McpTransport) => setFormData({ ...formData, transport: val })}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-secondary/40 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="http">HTTP</SelectItem>
                          <SelectItem value="stdio">stdio</SelectItem>
                          <SelectItem value="sse">SSE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Timeout MS</label>
                      <Input
                        type="number"
                        value={formData.timeoutMs}
                        onChange={(e) => setFormData({ ...formData, timeoutMs: Number(e.target.value) || 30000 })}
                        className="h-9 text-xs rounded-xl bg-secondary/40 border-border text-foreground"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Protocol version</label>
                      <Select
                        value={formData.protocolVersion}
                        onValueChange={(val) => setFormData({ ...formData, protocolVersion: val })}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-secondary/40 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="auto">Auto (recommended)</SelectItem>
                          <SelectItem value="2024-11-05">2024-11-05</SelectItem>
                          <SelectItem value="v1">v1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.transport !== "stdio" ? (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">URL</label>
                          <Input
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            placeholder="https://mcp.example.com/mcp"
                            className="h-9 text-xs rounded-xl bg-secondary/40 border-border text-foreground"
                          />
                        </div>

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setIsHeadersOpen(!isHeadersOpen)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
                          >
                            {isHeadersOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            <span>{isIndo ? "Headers (opsional)" : "Headers (optional)"}</span>
                          </button>

                          {isHeadersOpen && (
                            <div className="mt-2 space-y-1.5">
                              <textarea
                                value={formData.headersText}
                                onChange={(e) => setFormData({ ...formData, headersText: e.target.value })}
                                placeholder='{\n  "Authorization": "Bearer your-token"\n}'
                                rows={3}
                                spellCheck={false}
                                className="w-full p-3 rounded-xl bg-secondary/30 border border-border text-xs font-mono text-foreground focus:outline-none focus:border-foreground/30 resize-none"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">Command</label>
                            <Input
                              value={formData.command}
                              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                              placeholder="npx"
                              className="h-9 text-xs rounded-xl bg-secondary/40 border-border text-foreground"
                            />
                          </div>
                          <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-xs font-medium text-foreground">Arguments</label>
                            <Input
                              value={formData.argsText}
                              onChange={(e) => setFormData({ ...formData, argsText: e.target.value })}
                              placeholder="-y composio-mcp"
                              className="h-9 text-xs rounded-xl bg-secondary/40 border-border text-foreground"
                            />
                          </div>
                        </div>

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setIsEnvOpen(!isEnvOpen)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
                          >
                            {isEnvOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            <span>{isIndo ? "Environment variables (opsional)" : "Environment variables (optional)"}</span>
                          </button>

                          {isEnvOpen && (
                            <div className="mt-2 space-y-1.5">
                              <textarea
                                value={formData.envText}
                                onChange={(e) => setFormData({ ...formData, envText: e.target.value })}
                                placeholder='{\n  "API_KEY": "secret"\n}'
                                rows={3}
                                spellCheck={false}
                                className="w-full p-3 rounded-xl bg-secondary/30 border border-border text-xs font-mono text-foreground focus:outline-none focus:border-foreground/30 resize-none"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={singleJsonText}
                    onChange={(e) => setSingleJsonText(e.target.value)}
                    rows={12}
                    spellCheck={false}
                    className="w-full p-3.5 rounded-xl bg-secondary/40 border border-border text-xs font-mono text-foreground focus:outline-none focus:border-foreground/30 resize-none leading-relaxed"
                  />
                )}

                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                  {isEditingExisting && formData.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteServer(formData.id!)}
                      className="px-3.5 py-1.5 rounded-xl border border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isIndo ? "Hapus" : "Delete"}</span>
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingServer(false)}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveServer}
                      className="px-5 py-2 rounded-xl bg-foreground text-background hover:opacity-90 text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: FULL JSON CONFIG (Inside Custom MCP) */}
          {customMcpSubTab === "json" && !isEditingServer && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground tracking-tight">
                    mcpServers.json
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isIndo
                      ? "Konfigurasi ini kompatibel dengan standar mcpServers (Antigravity & Claude Desktop)."
                      : "Adheres to the official mcpServers specification used by Antigravity, Claude Desktop, and Cursor."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyFullJson}
                    className="h-8 px-3 rounded-xl border border-border bg-card/60 hover:bg-secondary text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isCopiedFullJson ? (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span>{isIndo ? "Salin JSON" : "Copy JSON"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFullJson}
                    className="h-8 px-4 rounded-xl bg-foreground text-background hover:opacity-90 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  >
                    {isIndo ? "Simpan Perubahan" : "Save Changes"}
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card/80 overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 border-b border-border/60 bg-secondary/30 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">mcpServers Configuration</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {mcpConfig.servers.length} servers
                  </span>
                </div>
                <textarea
                  value={fullJsonText}
                  onChange={(e) => setFullJsonText(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  className="w-full p-4 bg-transparent font-mono text-xs text-foreground outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* QUICK IMPORT JSON DIALOG                                            */}
      {/* =================================================================== */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {isIndo ? "Impor Konfigurasi mcpServers" : "Import mcpServers Configuration"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isIndo
                ? "Tempelkan potongan JSON mcpServers dari Claude Desktop atau Antigravity."
                : "Paste your mcpServers JSON configuration from Claude Desktop or Antigravity."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <textarea
              value={importJsonInput}
              onChange={(e) => setImportJsonInput(e.target.value)}
              placeholder='{\n  "mcpServers": {\n    "my-server": {\n      "url": "https://mcp.example.com/mcp"\n    }\n  }\n}'
              rows={8}
              spellCheck={false}
              className="w-full p-3 rounded-2xl bg-secondary/40 border border-border text-xs font-mono text-foreground focus:outline-none focus:border-foreground/30 resize-none leading-relaxed"
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportJsonInput("");
              }}
              className="rounded-xl text-xs h-8 cursor-pointer"
            >
              {isIndo ? "Batal" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteImport}
              className="rounded-xl text-xs h-8 cursor-pointer bg-foreground text-background hover:opacity-90"
            >
              {isIndo ? "Terapkan Impor" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
