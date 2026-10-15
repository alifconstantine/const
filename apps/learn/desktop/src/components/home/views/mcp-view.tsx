import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Cable,
  Unplug,
  Search,
  Plus,
  RefreshCw,
  Check,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronDown,
  Terminal,
  Globe,
  Radio,
  FileCode,
  Copy,
  PanelLeft,
  X,
  ArrowLeft,
  Download,
  RotateCcw,
  MoreHorizontal,
} from "lucide-react";
import {
  Button,
  Input,
  Switch,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast,
  cn,
} from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import {
  type McpServerConfig,
  type McpTransport,
  type McpScope,
  AVAILABLE_PRESET_MCP_SERVERS,
  getStoredMcpConfig,
  saveStoredMcpConfig,
  exportMcpServersToJson,
  importMcpServersFromJson,
} from "../../../lib/mcp-connectors";

export interface ServerHealth {
  color: "emerald" | "rose" | "zinc";
  label: string;
  isActionable: boolean;
  actionType: "oauth" | "api_key" | "connect" | "disconnect";
  tooltip: string;
  missingKeyName?: string;
}

export function getServerHealth(server: McpServerConfig): ServerHealth {
  if (server.enabled === false) {
    return {
      color: "zinc",
      label: "Nonaktif",
      isActionable: false,
      actionType: "connect",
      tooltip: "Server sedang dinonaktifkan",
    };
  }

  // 1. Check missing API keys / credentials in env
  if (server.env) {
    for (const [key, val] of Object.entries(server.env)) {
      if (
        (key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET")) &&
        (!val || !val.trim())
      ) {
        return {
          color: "rose",
          label: "Perlu Kredensial",
          isActionable: true,
          actionType: "api_key",
          tooltip: `Kunci ${key} belum diisi`,
          missingKeyName: key,
        };
      }
    }
  }

  // 2. Check missing required OAuth
  const requiresOAuth = Boolean(server.authUrl || server.id === "canva");
  if (requiresOAuth && !server.oauthConnected) {
    return {
      color: "rose",
      label: "Perlu OAuth",
      isActionable: true,
      actionType: "oauth",
      tooltip: "Akun belum terhubung via OAuth",
    };
  }

  // 3. Error state
  if (server.status === "error") {
    return {
      color: "rose",
      label: "Error",
      isActionable: true,
      actionType: "connect",
      tooltip: server.errorMessage || "Koneksi ke server bermasalah",
    };
  }

  // 4. Connected state (green)
  if (server.status === "connected") {
    const toolCount = server.tools?.length || 0;
    return {
      color: "emerald",
      label: "Aktif",
      isActionable: true,
      actionType: "disconnect",
      tooltip: toolCount > 0 ? `Aktif (${toolCount} alat)` : "Aktif dan terhubung",
    };
  }

  // 5. Ready state without errors or missing requirements
  return {
    color: "emerald",
    label: "Siap",
    isActionable: true,
    actionType: "connect",
    tooltip: "Siap terhubung",
  };
}

interface McpViewProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function McpView({ isSidebarOpen = true, onToggleSidebar }: McpViewProps) {
  const { t, language } = useI18n();

  // Servers state
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [activeTab, setActiveTab] = useState<"installed" | "catalog" | "custom" | "all">("installed");
  const [searchQuery, setSearchQuery] = useState("");

  // Sliding pill tab indicator refs
  const installedTabRef = useRef<HTMLButtonElement>(null);
  const catalogTabRef = useRef<HTMLButtonElement>(null);
  const customTabRef = useRef<HTMLButtonElement>(null);
  const allTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  // View mode: 'list' | 'form'
  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [formModeTab, setFormModeTab] = useState<"form" | "json">("form");
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formScope, setFormScope] = useState<McpScope>("user");
  const [formType, setFormType] = useState<McpTransport>("stdio");
  const [formTimeoutMs, setFormTimeoutMs] = useState(30000);
  const [formProtocolVersion, setFormProtocolVersion] = useState("auto");
  const [formCommand, setFormCommand] = useState("npx");
  const [formArgs, setFormArgs] = useState("-y @modelcontextprotocol/server-memory");
  const [formUrl, setFormUrl] = useState("");
  const [formEnvList, setFormEnvList] = useState<Array<{ key: string; value: string }>>([]);
  const [formHeadersList, setFormHeadersList] = useState<Array<{ key: string; value: string }>>([]);
  const [isEnvExpanded, setIsEnvExpanded] = useState(false);
  const [isHeadersExpanded, setIsHeadersExpanded] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");

  // Testing / Connecting / Disconnecting states
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [disconnectingServerId, setDisconnectingServerId] = useState<string | null>(null);
  const [isTestingInForm, setIsTestingInForm] = useState(false);
  const [authenticatingServerId, setAuthenticatingServerId] = useState<string | null>(null);
  const [expandedToolsServerId, setExpandedToolsServerId] = useState<string | null>(null);

  // JSON Import / Export modal
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonModalContent, setJsonModalContent] = useState("");

  // Load config on mount
  useEffect(() => {
    const config = getStoredMcpConfig();
    setServers(config.servers);

    const handleConfigChange = (e: any) => {
      if (e.detail?.servers) {
        setServers(e.detail.servers);
      }
    };
    window.addEventListener("mcp_servers_changed", handleConfigChange);
    return () => window.removeEventListener("mcp_servers_changed", handleConfigChange);
  }, []);

  const saveServers = (updated: McpServerConfig[]) => {
    setServers(updated);
    saveStoredMcpConfig({ servers: updated });
  };

  // Sliding tab indicator effect
  useEffect(() => {
    const updateIndicator = () => {
      let activeEl: HTMLButtonElement | null = null;
      if (activeTab === "installed") activeEl = installedTabRef.current;
      else if (activeTab === "catalog") activeEl = catalogTabRef.current;
      else if (activeTab === "custom") activeEl = customTabRef.current;
      else if (activeTab === "all") activeEl = allTabRef.current;

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
  }, [activeTab, language, viewMode]);

  // Counts
  const installedCount = useMemo(() => servers.filter((s) => s.enabled !== false).length, [servers]);
  const catalogCount = AVAILABLE_PRESET_MCP_SERVERS.length;
  const customCount = useMemo(() => servers.filter((s) => s.isCustom).length, [servers]);
  const allCount = servers.length;

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      const matchQuery =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.command && s.command.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.url && s.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchQuery) return false;

      if (activeTab === "installed") return s.enabled !== false;
      if (activeTab === "catalog") return !s.isCustom;
      if (activeTab === "custom") return s.isCustom;
      return true;
    });
  }, [servers, searchQuery, activeTab]);

  // Open Add Form
  const handleOpenAddForm = () => {
    setEditingServerId(null);
    setFormName("my-mcp-server");
    setFormScope("user");
    setFormType("stdio");
    setFormTimeoutMs(30000);
    setFormProtocolVersion("auto");
    setFormCommand("npx");
    setFormArgs("-y @modelcontextprotocol/server-memory");
    setFormUrl("");
    setFormEnvList([]);
    setFormHeadersList([]);
    setIsEnvExpanded(false);
    setIsHeadersExpanded(false);

    const initialJson = JSON.stringify(
      {
        name: "my-mcp-server",
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-memory"],
        env: {},
      },
      null,
      2
    );
    setRawJsonText(initialJson);
    setFormModeTab("form");
    setViewMode("form");
  };

  // Open Edit Form
  const handleOpenEditForm = (server: McpServerConfig) => {
    setEditingServerId(server.id);
    setFormName(server.name);
    setFormScope(server.scope || "user");
    setFormType(server.transport);
    setFormTimeoutMs(server.timeoutMs || 30000);
    setFormProtocolVersion(server.protocolVersion || "auto");
    setFormCommand(server.command || "npx");
    setFormArgs(server.args ? server.args.join(" ") : "");
    setFormUrl(server.url || "");

    const envPairs = Object.entries(server.env || {}).map(([key, value]) => ({ key, value }));
    setFormEnvList(envPairs);
    setIsEnvExpanded(envPairs.length > 0);

    const headerPairs = Object.entries(server.headers || {}).map(([key, value]) => ({ key, value }));
    setFormHeadersList(headerPairs);
    setIsHeadersExpanded(headerPairs.length > 0);

    const jsonSnippet = JSON.stringify(
      {
        name: server.name,
        type: server.transport,
        ...(server.transport === "stdio"
          ? { command: server.command, args: server.args, env: server.env }
          : { url: server.url, headers: server.headers }),
      },
      null,
      2
    );
    setRawJsonText(jsonSnippet);
    setFormModeTab("form");
    setViewMode("form");
  };

  // Save Form
  const handleSaveForm = () => {
    if (formModeTab === "json") {
      try {
        const parsed = JSON.parse(rawJsonText);
        const name = parsed.name || formName || "custom-mcp";
        const transport: McpTransport =
          parsed.type === "stdio" || parsed.type === "sse" || parsed.type === "http" ? parsed.type : "stdio";
        const id = editingServerId || name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

        const newConfig: McpServerConfig = {
          id,
          name,
          transport,
          scope: formScope,
          timeoutMs: parsed.timeoutMs || formTimeoutMs,
          protocolVersion: formProtocolVersion,
          command: parsed.command,
          args: parsed.args,
          url: parsed.url,
          headers: parsed.headers,
          env: parsed.env,
          enabled: true,
          isCustom: true,
          status: "ready",
        };

        const existingIdx = servers.findIndex((s) => s.id === id);
        let updated: McpServerConfig[];
        if (existingIdx >= 0) {
          updated = [...servers];
          updated[existingIdx] = { ...updated[existingIdx], ...newConfig };
        } else {
          updated = [...servers, newConfig];
        }
        saveServers(updated);
        toast.success(t("serverSavedSuccess", { name }));
        setViewMode("list");
        return;
      } catch (err: any) {
        toast.error(t("mcpInvalidJson", { error: err.message }));
        return;
      }
    }

    // Normal form mode
    const trimmedName = formName.trim();
    if (!trimmedName) {
      toast.error(t("mcpServerNameRequired"));
      return;
    }

    if (formType === "stdio" && !formCommand.trim()) {
      toast.error(t("mcpCommandRequired"));
      return;
    }

    if ((formType === "http" || formType === "sse") && !formUrl.trim()) {
      toast.error(t("mcpUrlRequired"));
      return;
    }

    const envObj: Record<string, string> = {};
    for (const { key, value } of formEnvList) {
      if (key.trim()) envObj[key.trim()] = value;
    }

    const headersObj: Record<string, string> = {};
    for (const { key, value } of formHeadersList) {
      if (key.trim()) headersObj[key.trim()] = value;
    }

    const parsedArgs = formArgs
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const id = editingServerId || trimmedName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const existingIdx = servers.findIndex((s) => s.id === id);

    const newConfig: McpServerConfig = {
      id,
      name: trimmedName,
      transport: formType,
      scope: formScope,
      timeoutMs: formTimeoutMs,
      protocolVersion: formProtocolVersion,
      command: formType === "stdio" ? formCommand.trim() : undefined,
      args: formType === "stdio" ? parsedArgs : undefined,
      url: formType !== "stdio" ? formUrl.trim() : undefined,
      headers: formType !== "stdio" ? headersObj : undefined,
      env: formType === "stdio" ? envObj : undefined,
      enabled: true,
      isCustom: true,
      status: "ready",
    };

    let updated: McpServerConfig[];
    if (existingIdx >= 0) {
      updated = [...servers];
      updated[existingIdx] = { ...updated[existingIdx], ...newConfig };
    } else {
      updated = [...servers, newConfig];
    }

    saveServers(updated);
    toast.success(t("serverSavedSuccess", { name: trimmedName }));
    setViewMode("list");
  };

  // Toggle server enabled
  const handleToggleServer = (serverId: string) => {
    const updated = servers.map((s) => {
      if (s.id === serverId) {
        const nextEnabled = !s.enabled;
        return {
          ...s,
          enabled: nextEnabled,
          status: (nextEnabled ? "ready" : "disabled") as any,
        };
      }
      return s;
    });
    saveServers(updated);
  };

  // Delete server (cleanly disconnects process or session first)
  const handleDeleteServer = async (serverId: string) => {
    const target = servers.find((s) => s.id === serverId);
    if (target && window.electron?.mcp?.disconnect) {
      await window.electron.mcp.disconnect(target).catch(() => {});
    }
    const updated = servers.filter((s) => s.id !== serverId);
    saveServers(updated);
    toast.success(t("serverDeletedSuccess"));
  };

  // Disconnect server (terminates session/process, revokes token)
  const handleDisconnectServer = async (server: McpServerConfig) => {
    setDisconnectingServerId(server.id);
    try {
      if (window.electron?.mcp?.disconnect) {
        await window.electron.mcp.disconnect(server);
      }
      const updated = servers.map((s) => {
        if (s.id === server.id) {
          return {
            ...s,
            status: "disconnected" as const,
            sessionId: undefined,
            oauthConnected: false,
          };
        }
        return s;
      });
      saveServers(updated);
      toast.success(t("connectorDisconnectedNotice", { name: server.name }));
    } catch (err: any) {
      toast.error(t("failedDisconnectNotice", { name: server.name }));
    } finally {
      setDisconnectingServerId(null);
    }
  };

  // Reset to Defaults
  const handleResetToDefault = () => {
    saveServers([]);
    toast.success(t("mcpServersResetSuccess") || "MCP servers reset to defaults.");
  };

  // Connect & Test Server
  const handleTestConnection = async (server: McpServerConfig) => {
    setTestingServerId(server.id);

    try {
      if (window.electron?.mcp?.testConnection) {
        const res = await window.electron.mcp.testConnection(server);
        if (res.success) {
          const toolCount = res.count || res.tools?.length || 0;
          toast.success(t("connectionSuccess", { count: toolCount }));
          const updated = servers.map((s) => {
            if (s.id === server.id) {
              return {
                ...s,
                status: "connected" as const,
                tools: res.tools || [],
                sessionId: res.sessionId,
                lastConnectedAt: Date.now(),
                enabled: true,
                errorMessage: undefined,
              };
            }
            return s;
          });
          saveServers(updated);
          setExpandedToolsServerId(server.id);
        } else {
          toast.error(t("mcpConnectionFailed", { error: res.error || "Unknown error" }));
          const updated = servers.map((s) => {
            if (s.id === server.id) {
              return {
                ...s,
                status: "error" as const,
                errorMessage: res.error,
              };
            }
            return s;
          });
          saveServers(updated);
        }
      } else {
        toast.info("MCP Runner hanya tersedia pada mode Desktop Electron.");
      }
    } catch (err: any) {
      toast.error(t("mcpConnectionFailed", { error: err.message }));
    } finally {
      setTestingServerId(null);
    }
  };

  // Test Connection from Form
  const handleTestFormConnection = async () => {
    setIsTestingInForm(true);
    try {
      if (window.electron?.mcp?.testConnection) {
        const envObj: Record<string, string> = {};
        for (const { key, value } of formEnvList) {
          if (key.trim()) envObj[key.trim()] = value;
        }

        const headersObj: Record<string, string> = {};
        for (const { key, value } of formHeadersList) {
          if (key.trim()) headersObj[key.trim()] = value;
        }

        const parsedArgs = formArgs
          .trim()
          .split(/\s+/)
          .filter(Boolean);

        const tempConfig: McpServerConfig = {
          id: editingServerId || "test-temp-server",
          name: formName || "Test Server",
          transport: formType,
          scope: formScope,
          timeoutMs: formTimeoutMs,
          protocolVersion: formProtocolVersion,
          command: formType === "stdio" ? formCommand.trim() : undefined,
          args: formType === "stdio" ? parsedArgs : undefined,
          url: formType !== "stdio" ? formUrl.trim() : undefined,
          headers: formType !== "stdio" ? headersObj : undefined,
          env: formType === "stdio" ? envObj : undefined,
          enabled: true,
        };

        const res = await window.electron.mcp.testConnection(tempConfig);
        if (res.success) {
          const toolCount = res.count || res.tools?.length || 0;
          toast.success(t("connectionSuccess", { count: toolCount }));
        } else {
          toast.error(t("mcpConnectionFailed", { error: res.error || "Handshake gagal" }));
        }
      } else {
        toast.info("MCP Runner hanya tersedia pada mode Desktop Electron.");
      }
    } catch (err: any) {
      toast.error(t("mcpConnectionFailed", { error: err.message }));
    } finally {
      setIsTestingInForm(false);
    }
  };

  // Start OAuth Flow
  const handleStartOAuth = async (server: McpServerConfig) => {
    setAuthenticatingServerId(server.id);

    try {
      if (window.electron?.mcp?.startOAuth) {
        toast.info(t("connectingOAuth"));
        const res = await window.electron.mcp.startOAuth({
          provider: server.id,
          authUrl: server.authUrl,
        });

        if (res.success) {
          toast.success(t("oAuthSuccess"));

          if (server.id === "canva" && res.token) {
            try {
              const tokenData = {
                accessToken: res.token,
                expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
                tokenType: "Bearer",
              };
              localStorage.setItem("const_canva_tokens_v2", JSON.stringify(tokenData));
              window.dispatchEvent(new Event("connectors_changed"));
              window.dispatchEvent(new CustomEvent("canva:token-changed", { detail: tokenData }));
            } catch {}
          }

          const updated = servers.map((s) => {
            if (s.id === server.id) {
              const headers = { ...(s.headers || {}) };
              const env = { ...(s.env || {}) };
              if (res.token) {
                if (s.transport !== "stdio") {
                  headers["Authorization"] = `Bearer ${res.token}`;
                } else if (s.id === "canva") {
                  env["CANVA_ACCESS_TOKEN"] = res.token;
                }
              }
              return {
                ...s,
                headers: Object.keys(headers).length > 0 ? headers : s.headers,
                env: Object.keys(env).length > 0 ? env : s.env,
                status: "connected" as const,
                oauthConnected: true,
                errorMessage: undefined,
              };
            }
            return s;
          });
          saveServers(updated);
        } else {
          toast.error(t("oAuthFailed", { error: res.error || "Otentikasi dibatalkan" }));
        }
      } else {
        toast.info("Otentikasi OAuth hanya tersedia pada mode Desktop Electron.");
      }
    } catch (err: any) {
      toast.error(t("oAuthFailed", { error: err.message }));
    } finally {
      setAuthenticatingServerId(null);
    }
  };

  // Smart Action Handler (Unifies Connect & Connect Account)
  const handleSmartConnect = async (server: McpServerConfig) => {
    const health = getServerHealth(server);
    if (health.actionType === "api_key") {
      toast.info(
        language === "id"
          ? `Silakan lengkapi kunci ${health.missingKeyName || "API Key"} terlebih dahulu.`
          : `Please fill in the ${health.missingKeyName || "API Key"} first.`
      );
      handleOpenEditForm(server);
      return;
    }
    if (health.actionType === "oauth") {
      await handleStartOAuth(server);
      return;
    }
    await handleTestConnection(server);
  };

  // Add Preset Server
  const handleAddPreset = (preset: McpServerConfig) => {
    if (servers.some((s) => s.id === preset.id)) {
      toast.info(`Server ${preset.name} sudah terdaftar.`);
      return;
    }
    const newServer: McpServerConfig = {
      ...preset,
      enabled: true,
      status: "ready",
    };
    const updated = [...servers, newServer];
    saveServers(updated);
    toast.success(t("serverSavedSuccess", { name: preset.name }));
    setActiveTab("installed");
  };

  // ---------------------------------------------------------------------------
  // RENDER: FORM VIEW (Add or Edit Server)
  // ---------------------------------------------------------------------------
  if (viewMode === "form") {
    return (
      <div className="w-full flex flex-col space-y-6 font-sans select-none">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary transition-all cursor-pointer w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("backToMcpServers") || "Back to MCP Servers"}</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t("mcpServers")}</span>
            <span>/</span>
            <span className="text-foreground font-medium">
              {editingServerId ? t("editMcpServer") : t("newMcpServer")}
            </span>
          </div>
        </div>

        {/* Form Card Container */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 max-w-3xl mx-auto shadow-xs w-full">
          {/* Card Header: Title & Form vs JSON Segmented Control */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl font-normal tracking-tight text-foreground">
                {editingServerId ? t("editMcpServer") : t("newMcpServer")}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {editingServerId ? t("editMcpServerDesc") : t("newMcpServerDesc")}
              </p>
            </div>

            {/* Segmented Button: Form vs JSON */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-muted/70 border border-border">
              <button
                type="button"
                onClick={() => setFormModeTab("form")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  formModeTab === "form"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("formMode")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentObj = {
                    name: formName || "my-mcp-server",
                    type: formType,
                    ...(formType === "stdio"
                      ? {
                          command: formCommand,
                          args: formArgs.trim().split(/\s+/).filter(Boolean),
                          env: formEnvList.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}),
                        }
                      : {
                          url: formUrl,
                          headers: formHeadersList.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}),
                        }),
                  };
                  setRawJsonText(JSON.stringify(currentObj, null, 2));
                  setFormModeTab("json");
                }}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  formModeTab === "json"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("jsonMode")}
              </button>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {formModeTab === "form" ? (
              <>
                {/* 1. Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground block">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="my-mcp-server"
                    className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                  />
                </div>

                {/* 2. Scope & Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      {t("scopeLabel")}
                    </label>
                    <select
                      value={formScope}
                      onChange={(e) => setFormScope(e.target.value as McpScope)}
                      className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 transition-colors cursor-pointer"
                    >
                      <option value="user">{t("scopeUser")}</option>
                      <option value="workspace">{t("scopeWorkspace")}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      {t("typeLabel")}
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as McpTransport)}
                      className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 transition-colors cursor-pointer"
                    >
                      <option value="stdio">{t("typeStdio")}</option>
                      <option value="http">{t("typeHttp")}</option>
                      <option value="sse">{t("typeSse")}</option>
                    </select>
                  </div>
                </div>

                {/* 3. Timeout MS & Protocol Version */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      {t("timeoutMsLabel")}
                    </label>
                    <input
                      type="number"
                      value={formTimeoutMs}
                      onChange={(e) => setFormTimeoutMs(Number(e.target.value) || 30000)}
                      className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      {t("protocolVersionLabel")}
                    </label>
                    <input
                      type="text"
                      value={formProtocolVersion}
                      onChange={(e) => setFormProtocolVersion(e.target.value)}
                      placeholder="auto"
                      className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 transition-colors"
                    />
                  </div>
                </div>

                {/* 4. Transport Specific Fields */}
                {formType === "stdio" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        {t("mcpCommandLabel")}
                      </label>
                      <input
                        type="text"
                        value={formCommand}
                        onChange={(e) => setFormCommand(e.target.value)}
                        placeholder="e.g. npx, uvx, docker"
                        className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground font-mono outline-none ring-0 focus:ring-1 focus:ring-foreground/20 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        {t("argumentsLabel")}
                      </label>
                      <input
                        type="text"
                        value={formArgs}
                        onChange={(e) => setFormArgs(e.target.value)}
                        placeholder="-y @modelcontextprotocol/server-memory"
                        className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground font-mono outline-none ring-0 focus:ring-1 focus:ring-foreground/20 transition-colors"
                      />
                    </div>

                    {/* Collapsible Environment Variables */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEnvExpanded(!isEnvExpanded)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <ChevronDown
                          className={cn(
                            "w-3.5 h-3.5 transition-transform duration-200",
                            !isEnvExpanded && "-rotate-90"
                          )}
                        />
                        <span>{t("envVariablesOptional")}</span>
                        {formEnvList.length > 0 && (
                          <span className="text-[10px] bg-secondary border border-border px-1.5 py-0.2 rounded-full text-foreground">
                            {formEnvList.length}
                          </span>
                        )}
                      </button>

                      {isEnvExpanded && (
                        <div className="mt-3 p-3.5 rounded-xl bg-secondary/20 border border-border space-y-2.5">
                          {formEnvList.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.key}
                                placeholder="KEY"
                                onChange={(e) => {
                                  const next = [...formEnvList];
                                  if (next[idx]) next[idx].key = e.target.value;
                                  setFormEnvList(next);
                                }}
                                className="w-1/2 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:outline-hidden"
                              />
                              <input
                                type="text"
                                value={item.value}
                                placeholder="VALUE"
                                onChange={(e) => {
                                  const next = [...formEnvList];
                                  if (next[idx]) next[idx].value = e.target.value;
                                  setFormEnvList(next);
                                }}
                                className="w-1/2 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => setFormEnvList(formEnvList.filter((_, i) => i !== idx))}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => setFormEnvList([...formEnvList, { key: "", value: "" }])}
                            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer pt-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Environment Variable</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        {t("serverUrlLabel")}
                      </label>
                      <input
                        type="text"
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        placeholder="https://search.parallel.ai/mcp"
                        className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground font-mono outline-none ring-0 focus:ring-1 focus:ring-foreground/20 transition-colors"
                      />
                    </div>

                    {/* Collapsible Headers */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsHeadersExpanded(!isHeadersExpanded)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <ChevronDown
                          className={cn(
                            "w-3.5 h-3.5 transition-transform duration-200",
                            !isHeadersExpanded && "-rotate-90"
                          )}
                        />
                        <span>{t("headersOptional")}</span>
                        {formHeadersList.length > 0 && (
                          <span className="text-[10px] bg-secondary border border-border px-1.5 py-0.2 rounded-full text-foreground">
                            {formHeadersList.length}
                          </span>
                        )}
                      </button>

                      {isHeadersExpanded && (
                        <div className="mt-3 p-3.5 rounded-xl bg-secondary/20 border border-border space-y-2.5">
                          {formHeadersList.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.key}
                                placeholder="Authorization"
                                onChange={(e) => {
                                  const next = [...formHeadersList];
                                  if (next[idx]) next[idx].key = e.target.value;
                                  setFormHeadersList(next);
                                }}
                                className="w-1/2 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:outline-hidden"
                              />
                              <input
                                type="text"
                                value={item.value}
                                placeholder="Bearer sk-..."
                                onChange={(e) => {
                                  const next = [...formHeadersList];
                                  if (next[idx]) next[idx].value = e.target.value;
                                  setFormHeadersList(next);
                                }}
                                className="w-1/2 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => setFormHeadersList(formHeadersList.filter((_, i) => i !== idx))}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => setFormHeadersList([...formHeadersList, { key: "Authorization", value: "" }])}
                            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer pt-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Header HTTP</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              /* JSON Snippet Editor */
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground block">
                  JSON Snippet
                </label>
                <textarea
                  rows={12}
                  value={rawJsonText}
                  onChange={(e) => setRawJsonText(e.target.value)}
                  className="w-full p-3.5 bg-secondary/30 border border-border rounded-xl text-xs text-foreground font-mono focus:outline-hidden leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {t("mcpJsonEditorDesc")}
                </p>
              </div>
            )}

            {/* Bottom Form Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestFormConnection}
                disabled={isTestingInForm}
                className="h-9 px-3.5 rounded-xl border-border hover:bg-secondary text-xs font-medium cursor-pointer"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isTestingInForm && "animate-spin")} />
                <span>{isTestingInForm ? t("testingConnection") : t("mcpTestConnection")}</span>
              </Button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className="h-9 px-4 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  size="sm"
                  onClick={handleSaveForm}
                  className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: MAIN LIST VIEW (Strict match with ModelsView & SkillsView)
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full flex flex-col space-y-6 font-sans select-none">
      {/* 1. Header Section - Strict match with sources-view, models-view & learn-home */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            {!isSidebarOpen && onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-1.5 -ml-1 rounded-xl bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-none"
                title="Open sidebar"
                aria-label="Open sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
              {t("mcpServers")}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans tabular-nums">
              {servers.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("mcpServersSubtitle")}
          </p>
        </div>

        {/* Search Bar & Primary Actions */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchMcpPlaceholder")}
              className="h-8 w-44 sm:w-56 pl-8 pr-7 text-xs rounded-xl bg-card border-border text-foreground placeholder-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40 shadow-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* New Server Button (Primary) */}
          <Button
            size="sm"
            onClick={handleOpenAddForm}
            className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-none"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{t("newMcpServer")}</span>
          </Button>

          {/* More Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-8 w-8 rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center cursor-pointer shadow-none"
                title={t("moreOptions") || "More options"}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-card border-border text-foreground p-1 rounded-xl shadow-xl"
            >
              <DropdownMenuItem
                onClick={() => {
                  setJsonModalContent(exportMcpServersToJson(servers));
                  setIsJsonModalOpen(true);
                }}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                <span>mcpServers.json</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setJsonModalContent("");
                  setIsJsonModalOpen(true);
                }}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Impor JSON</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={handleResetToDefault}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer text-amber-500 hover:text-amber-400 hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t("resetMcpServers")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. Sliding Pill Tab Switcher */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
            ref={installedTabRef}
            type="button"
            onClick={() => setActiveTab("installed")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              activeTab === "installed"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("installedTab")} ({installedCount})
          </button>
          <button
            ref={catalogTabRef}
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              activeTab === "catalog"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("catalogTab")} ({catalogCount})
          </button>
          <button
            ref={customTabRef}
            type="button"
            onClick={() => setActiveTab("custom")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              activeTab === "custom"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("customTab")} ({customCount})
          </button>
          <button
            ref={allTabRef}
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              activeTab === "all"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("allTab")} ({allCount})
          </button>
        </div>
      </div>

      {/* 3. Main Content Area */}
      {activeTab === "catalog" ? (
        /* CATALOG PRESETS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {AVAILABLE_PRESET_MCP_SERVERS.map((preset) => {
            const isInstalled = servers.some((s) => s.id === preset.id);
            return (
              <div
                key={preset.id}
                className="p-4 rounded-2xl bg-card/60 border border-border hover:border-foreground/20 hover:bg-secondary/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
                        <Cable className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground tracking-tight">{preset.name}</div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {preset.transport.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {isInstalled && (
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Installed</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                    {preset.description || (preset.transport === "stdio" ? `${preset.command} ${preset.args?.join(" ")}` : preset.url)}
                  </p>
                </div>

                <div className="pt-4 mt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {preset.transport === "stdio" ? "Local Command (stdio)" : "Remote Streamable URL"}
                  </span>
                  {isInstalled ? (
                    <span className="text-xs text-muted-foreground font-medium px-2 py-1">
                      Active
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleAddPreset(preset)}
                      className="h-7 px-3 rounded-lg text-xs font-medium gap-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-none"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{t("add") || "Add"}</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* INSTALLED / CUSTOM / ALL SERVERS LIST */
        <div>
          {filteredServers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl border border-dashed border-border bg-card/40 text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto text-muted-foreground">
                <Cable className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="font-serif text-lg text-foreground font-medium">
                  {t("noCustomMcpServersTitle")}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("noCustomMcpServersDesc")}
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleOpenAddForm}
                className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("newMcpServer")}</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredServers.map((server) => {
                const isTesting = testingServerId === server.id;
                const isAuthenticating = authenticatingServerId === server.id;
                const isToolsExpanded = expandedToolsServerId === server.id;
                const toolCount = server.tools?.length || 0;
                const health = getServerHealth(server);

                return (
                  <div
                    key={server.id}
                    className={cn(
                      "rounded-2xl border border-border transition-all duration-200 overflow-hidden",
                      server.enabled !== false
                        ? "bg-card/60 hover:bg-secondary/20"
                        : "bg-card/30 opacity-70"
                    )}
                  >
                    {/* Server Card Header */}
                    <div className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Transport Icon */}
                        <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0 text-foreground">
                          {server.transport === "stdio" ? (
                            <Terminal className="w-4 h-4 text-emerald-500" />
                          ) : server.transport === "sse" ? (
                            <Radio className="w-4 h-4 text-sky-500" />
                          ) : (
                            <Globe className="w-4 h-4 text-blue-500" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
                              {server.name}
                            </h3>

                            {/* Status Dot: Hijau = Aktif/Siap, Merah = Ada masalah (belum OAuth / belum API key / error) */}
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full shrink-0 transition-colors",
                                health.color === "emerald"
                                  ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                                  : health.color === "rose"
                                  ? "bg-rose-500 shadow-xs shadow-rose-500/50"
                                  : "bg-muted-foreground/40"
                              )}
                              title={health.tooltip}
                            />

                            {/* Error / Warning Notice Pill */}
                            {health.color === "rose" && (
                              <span className="text-[10px] font-sans px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                {health.label}
                              </span>
                            )}

                            {/* Scope Badge */}
                            <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border/70">
                              {server.scope === "workspace" ? "Workspace" : "User"}
                            </span>

                            {/* Transport Badge */}
                            <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border/70">
                              {server.transport.toUpperCase()}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                            {server.transport === "stdio"
                              ? `${server.command} ${(server.args || []).join(" ")}`
                              : server.url}
                          </p>
                        </div>
                      </div>

                      {/* Right Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Tools Badge / Toggle */}
                        {toolCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedToolsServerId(isToolsExpanded ? null : server.id)}
                            className="px-2.5 py-1 rounded-xl bg-secondary border border-border hover:border-foreground/30 text-[11px] text-emerald-500 font-medium transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>{toolCount} tools</span>
                            <ChevronDown
                              className={cn(
                                "w-3 h-3 transition-transform duration-200",
                                isToolsExpanded && "rotate-180"
                              )}
                            />
                          </button>
                        )}

                        {/* Unified Single Action Button: Connect (or Disconnect) */}
                        {health.actionType === "disconnect" ? (
                          <button
                            type="button"
                            onClick={() => handleDisconnectServer(server)}
                            disabled={disconnectingServerId === server.id}
                            className="h-7 px-2.5 rounded-lg border border-border hover:border-destructive/40 hover:bg-destructive/10 text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-1.5 shadow-none"
                            title={t("disconnect")}
                          >
                            <Unplug className="w-3.5 h-3.5" />
                            <span>{disconnectingServerId === server.id ? "..." : t("disconnect")}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSmartConnect(server)}
                            disabled={isTesting || isAuthenticating}
                            className={cn(
                              "h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-none",
                              health.color === "rose"
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                                : "border-border hover:bg-secondary text-foreground"
                            )}
                            title={health.tooltip}
                          >
                            <Cable className={cn("w-3.5 h-3.5", (isTesting || isAuthenticating) && "animate-spin")} />
                            <span>
                              {isTesting || isAuthenticating
                                ? t("connecting")
                                : t("connect")}
                            </span>
                          </button>
                        )}

                        {/* Refresh / Ping Check Button (Tetap Ada) */}
                        <button
                          type="button"
                          onClick={() => handleTestConnection(server)}
                          disabled={isTesting}
                          className="p-1.5 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                          title={t("mcpTestConnection")}
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", isTesting && "animate-spin")} />
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(server)}
                          className="p-1.5 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteServer(server.id)}
                          className="p-1.5 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Switch Enable/Disable */}
                        <Switch
                          checked={server.enabled !== false}
                          onCheckedChange={() => handleToggleServer(server.id)}
                        />
                      </div>
                    </div>

                    {/* Expandable Tools List */}
                    {isToolsExpanded && server.tools && server.tools.length > 0 && (
                      <div className="px-5 pb-5 pt-2 border-t border-border/40 bg-muted/20 animate-in fade-in-50 duration-200">
                        <div className="text-[11px] font-semibold text-muted-foreground mb-2.5 uppercase tracking-wider">
                          Alat yang Diiklankan ({server.tools.length}):
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {server.tools.map((t, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-card border border-border text-xs"
                            >
                              <div className="font-mono font-medium text-emerald-500 text-[11.5px]">
                                {t.name}
                              </div>
                              {t.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                                  {t.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* JSON Import/Export Modal */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary" />
                <span>mcpServers.json</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsJsonModalOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={12}
              value={jsonModalContent}
              onChange={(e) => setJsonModalContent(e.target.value)}
              className="w-full p-3.5 bg-secondary/30 border border-border rounded-xl text-xs font-mono text-foreground focus:outline-hidden leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(jsonModalContent);
                  toast.success(t("mcpServersJsonCopied"));
                }}
                className="px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs text-foreground flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t("copyJsonAction")}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsJsonModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Batal
                </button>
                <Button
                  size="sm"
                  onClick={() => {
                    try {
                      const imported = importMcpServersFromJson(jsonModalContent);
                      saveServers(imported);
                      toast.success(t("configSavedCount", { count: imported.length }));
                      setIsJsonModalOpen(false);
                    } catch (err: any) {
                      toast.error(t("mcpInvalidJson", { error: err.message }));
                    }
                  }}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  Impor & Simpan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
