import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Code2,
  Check,
  Copy,
  CheckCheck,
  RotateCcw,
  Layers,
  ArrowLeft,
  ExternalLink,
  Plus,
  Cable,
  Server,
  Search,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
  BrandLogo,
  AVAILABLE_CONNECTORS,
  type ConnectorMetadata,
  ScrollArea,
  toast,
  cn,
  getCanvaClientId,
  setCanvaClientId,
  getCanvaRedirectUri,
  getStoredCanvaTokens,
} from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import { InteractiveBottomSheet } from "./interactive-bottom-sheet";
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

interface McpToolsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function McpToolsSheet({ open, onClose }: McpToolsSheetProps) {
  const { t, language } = useI18n();

  // Two Main Tabs: Apps & Tools (First) and Custom MCP (Second)
  const [mainTab, setMainTab] = useState<MainTab>("apps");

  // Sliding tab indicator (matching ModelSelectionSheet)
  const appsTabRef = useRef<HTMLButtonElement>(null);
  const customMcpTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (!open) return;
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
    return () => clearTimeout(timer);
  }, [mainTab, open, language]);

  // Apps & Tools State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConnector, setSelectedConnector] = useState<ConnectorMetadata | null>(null);
  const [connectedIds, setConnectedIds] = useState<string[]>(() => getConnectedConnectorIds());
  const [isConnectingId, setIsConnectingId] = useState<string | null>(null);
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);
  const [canvaClientIdInput, setCanvaClientIdInput] = useState(() => getCanvaClientId());

  const handleSaveCanvaClientId = () => {
    setCanvaClientId(canvaClientIdInput);
    toast.success("Canva Client ID berhasil disimpan!");
  };

  // Custom MCP State
  const [customMcpSubTab, setCustomMcpSubTab] = useState<CustomMcpSubTab>("servers");
  const [mcpConfig, setMcpConfig] = useState<McpConfigurationState>(() => getStoredMcpConfig());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sliding tab indicator for Custom MCP sub-tabs (Servers | JSON)
  const serversSubTabRef = useRef<HTMLButtonElement>(null);
  const jsonSubTabRef = useRef<HTMLButtonElement>(null);
  const [subIndicatorStyle, setSubIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (!open) return;
    const updateSubIndicator = () => {
      let activeEl: HTMLButtonElement | null = null;
      if (customMcpSubTab === "servers") activeEl = serversSubTabRef.current;
      else if (customMcpSubTab === "json") activeEl = jsonSubTabRef.current;

      if (activeEl) {
        setSubIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    };
    updateSubIndicator();
    const timer = setTimeout(updateSubIndicator, 50);
    return () => clearTimeout(timer);
  }, [customMcpSubTab, mainTab, open, language]);

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

  useEffect(() => {
    if (open) {
      const stored = getStoredMcpConfig();
      setMcpConfig(stored);
      setFullJsonText(exportMcpJson(stored));
      setConnectedIds(getConnectedConnectorIds());
      setSelectedConnector(null);
      setIsEditingServer(false);
    }
  }, [open]);

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
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q));
      return matchSearch;
    });
  }, [searchQuery]);

  // Connect / Authorize Handler for Apps & Tools
  const handleToggleConnect = async (connector: ConnectorMetadata, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isActive = isConnectorActive(connector.id);
    setIsConnectingId(connector.id);

    try {
      if (isActive) {
        const disconnected = await disconnectConnector(connector.id);
        if (disconnected) {
          setConnectedIds(getConnectedConnectorIds());
          toast.success(t("connectorDisconnectedNotice", { name: connector.name }));
        } else {
          toast.error(t("failedDisconnectNotice", { name: connector.name }));
        }
      } else {
        const res = await connectConnector(connector);
        if (!res || !res.success) {
          toast.error(res?.message || t("failedChangeConnectionStatus"));
          return;
        }
        setConnectedIds(getConnectedConnectorIds());
        if (res.message) {
          toast.success(res.message);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || t("failedChangeConnectionStatus"));
    } finally {
      setIsConnectingId(null);
    }
  };

  const handleCopyPrompt = (prompt: string, idx: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPromptIndex(idx);
    toast.success(t("promptCopiedToClipboard"));
    setTimeout(() => setCopiedPromptIndex(null), 2000);
  };

  // Custom MCP Handlers
  const handleToggleServer = (serverId: string, nextChecked: boolean) => {
    const target = mcpConfig.servers.find((s) => s.id === serverId);
    if (nextChecked && target) {
      if (target.transport === "stdio" && !target.command?.trim()) {
        toast.error(t("mcpCommandRequired"));
        return;
      }
      if (target.transport === "http" || target.transport === "sse") {
        if (!target.url?.trim()) {
          toast.error(t("mcpUrlRequired"));
          return;
        }
        try {
          const parsed = new URL(target.url);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            toast.error(t("mcpInvalidUrl"));
            return;
          }
        } catch {
          toast.error(t("mcpInvalidUrl"));
          return;
        }
      }
    }

    const updated = mcpConfig.servers.map((s) => {
      if (s.id === serverId) {
        return {
          ...s,
          enabled: nextChecked,
          status: (nextChecked ? "ready" : "disabled") as any,
          errorMessage: undefined,
        };
      }
      return s;
    });
    const nextConfig = { ...mcpConfig, servers: updated };
    setMcpConfig(nextConfig);
    saveStoredMcpConfig(nextConfig);
    toast.success(nextChecked ? t("serverEnabledNotice") : t("serverDisabledNotice"));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const currentConfig = getStoredMcpConfig();
      let failedCount = 0;

      const checkedServers = await Promise.all(
        currentConfig.servers.map(async (server) => {
          if (server.enabled === false) {
            return { ...server, status: "disabled" as const, errorMessage: undefined };
          }

          // Reachability check for HTTP / SSE
          if (server.transport === "http" || server.transport === "sse") {
            if (!server.url) {
              failedCount++;
              return { ...server, status: "error" as const, errorMessage: "Missing server URL" };
            }
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);
              await fetch(server.url, {
                method: "HEAD",
                mode: "no-cors",
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              return { ...server, status: "ready" as const, errorMessage: undefined };
            } catch (fetchErr: any) {
              failedCount++;
              const msg =
                fetchErr?.name === "AbortError"
                  ? "Connection timed out"
                  : fetchErr?.message || "Unreachable";
              return { ...server, status: "error" as const, errorMessage: msg };
            }
          }

          // Stdio reachability check
          if (server.transport === "stdio") {
            if (!server.command?.trim()) {
              failedCount++;
              return { ...server, status: "error" as const, errorMessage: "Missing command" };
            }
            return { ...server, status: "ready" as const, errorMessage: undefined };
          }

          return { ...server, status: "ready" as const, errorMessage: undefined };
        })
      );

      const nextConfig = { ...currentConfig, servers: checkedServers };
      setMcpConfig(nextConfig);
      saveStoredMcpConfig(nextConfig);
      setConnectedIds(getConnectedConnectorIds());

      if (failedCount > 0) {
        toast.error(t("serverRefreshFailedCount", { count: failedCount }));
      } else {
        toast.success(t("serverStatusRefreshed"));
      }
    } catch {
      toast.error(t("serverRefreshFailedCount", { count: 1 }));
    } finally {
      setIsRefreshing(false);
    }
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
      headersText:
        server.headers && Object.keys(server.headers).length > 0
          ? JSON.stringify(server.headers, null, 2)
          : "{}",
      command: server.command || "npx",
      argsText: server.args ? server.args.join(" ") : "",
      envText:
        server.env && Object.keys(server.env).length > 0
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
          toast.error(t("mcpServerNameRequired"));
          return;
        }

        const id =
          formData.id ||
          (parsed.name || formData.name)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9_-]/g, "-");

        const isStdio = parsed.type === "stdio" || (!parsed.url && parsed.command);
        const transport = (parsed.type || parsed.transport || (isStdio ? "stdio" : "http")) as McpTransport;

        if (transport === "stdio" && !parsed.command?.trim()) {
          toast.error(t("mcpCommandRequired"));
          return;
        }

        if (transport === "http" || transport === "sse") {
          if (!parsed.url?.trim()) {
            toast.error(t("mcpUrlRequired"));
            return;
          }
          try {
            const parsedUrl = new URL(parsed.url);
            if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
              toast.error(t("mcpInvalidUrl"));
              return;
            }
          } catch {
            toast.error(t("mcpInvalidUrl"));
            return;
          }
        }

        const timeoutMs = parsed.timeoutMs ? Number(parsed.timeoutMs) : formData.timeoutMs;
        if (isNaN(timeoutMs) || timeoutMs <= 0) {
          toast.error(t("mcpInvalidTimeout"));
          return;
        }

        const serverObj: McpServerConfig = {
          id,
          name: parsed.name || formData.name,
          transport,
          scope: parsed.scope || formData.scope,
          timeoutMs,
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
        toast.success(t("serverSavedSuccess", { name: serverObj.name }));
        return;
      } catch (err: any) {
        toast.error(
          t("mcpInvalidJson", { error: err?.message || "" })
        );
        return;
      }
    }

    // Form mode validation
    if (!formData.name.trim()) {
      toast.error(t("mcpServerNameRequired"));
      return;
    }

    const timeout = Number(formData.timeoutMs);
    if (isNaN(timeout) || timeout <= 0) {
      toast.error(t("mcpInvalidTimeout"));
      return;
    }

    if (formData.transport === "stdio" && !formData.command.trim()) {
      toast.error(t("mcpCommandRequired"));
      return;
    }

    if (formData.transport === "http" || formData.transport === "sse") {
      if (!formData.url.trim()) {
        toast.error(t("mcpUrlRequired"));
        return;
      }
      try {
        const parsedUrl = new URL(formData.url.trim());
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          toast.error(t("mcpInvalidUrl"));
          return;
        }
      } catch {
        toast.error(t("mcpInvalidUrl"));
        return;
      }
    }

    let parsedHeaders: Record<string, string> = {};
    if (formData.headersText.trim()) {
      try {
        parsedHeaders = JSON.parse(formData.headersText);
      } catch {
        toast.error(t("invalidHeadersJson"));
        return;
      }
    }

    let parsedEnv: Record<string, string> = {};
    if (formData.envText.trim()) {
      try {
        parsedEnv = JSON.parse(formData.envText);
      } catch {
        toast.error(t("invalidEnvJson"));
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
      timeoutMs: timeout,
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
    toast.success(t("serverSavedSuccess", { name: serverObj.name }));
  };

  const handleDeleteServer = (serverId: string) => {
    const updated = mcpConfig.servers.filter((s) => s.id !== serverId);
    const nextConfig = { ...mcpConfig, servers: updated };
    setMcpConfig(nextConfig);
    saveStoredMcpConfig(nextConfig);
    setIsEditingServer(false);
    toast.success(t("serverDeletedSuccess"));
  };

  const handleSaveFullJson = () => {
    try {
      const imported = importMcpJson(fullJsonText);
      setMcpConfig(imported);
      saveStoredMcpConfig(imported);
      toast.success(t("configSavedCount", { count: imported.servers.length }));
    } catch (err: any) {
      toast.error(
        t("failedSaveMcp") + (err?.message ? `: ${err.message}` : "")
      );
    }
  };

  const handleCopyFullJson = () => {
    navigator.clipboard.writeText(fullJsonText);
    setIsCopiedFullJson(true);
    toast.success(t("configCopiedToClipboard"));
    setTimeout(() => setIsCopiedFullJson(false), 2000);
  };

  return (
    <InteractiveBottomSheet
        open={open}
        onClose={onClose}
        defaultHeightVh={75}
        ariaLabel={t("mcpConnectorsTitle")}
      >
      {/* Sheet Top Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-border/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {t("mcpConnectorsTitle")}
            </h2>
            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20 uppercase tracking-wider">
              Beta
            </span>
            <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10.5px] font-medium border border-border/40">
              {mainTab === "apps" ? t("activeCountBadge", { count: filteredConnectors.length }) : t("installedCountBadge", { count: mcpConfig.servers.length })}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Tab Switcher - Left-Aligned Below Header (matching ModelSelectionSheet) */}
        <div className="px-4 sm:px-6 pt-3 pb-1 flex items-center gap-2 shrink-0">
          <div className="relative flex items-center h-9 p-0.5 rounded-xl bg-muted/70 border border-border w-fit max-w-[280px]">
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
              <span>{t("appsAndToolsTab")}</span>
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
              <span>{t("customMcpTab")}</span>
              {mcpConfig.servers.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary font-sans tabular-nums">
                  {mcpConfig.servers.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <ScrollArea className="flex-1 min-h-0 w-full" viewportClassName="p-4 sm:p-6 space-y-4">
          {/* ============================================================= */}
          {/* TAB 1: APPS & TOOLS (Real Connectors with Open Authorization) */}
          {/* ============================================================= */}
          {mainTab === "apps" && !selectedConnector && (
            <div className="space-y-4">
              {/* Search Bar (Category menu pills hidden) */}
              <div className="space-y-2.5">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={t("searchAppsPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors"
                  />
                </div>
              </div>

              {/* Connectors List (Matching Image 1: Open Authorization style) */}
              <div className="space-y-2.5">
                {filteredConnectors.map((connector) => {
                  const isConnected = isConnectorActive(connector.id);
                  const isConnecting = isConnectingId === connector.id;

                  return (
                    <div
                      key={connector.id}
                      onClick={() => setSelectedConnector(connector)}
                      className="group rounded-2xl border border-border/70 bg-card/60 hover:bg-secondary/20 transition-all p-3.5 flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Logo Box with Status Dot */}
                        <div className="w-10 h-10 rounded-xl bg-secondary/80 border border-border flex items-center justify-center relative shrink-0">
                          <BrandLogo id={connector.id} name={connector.name} size="md" />
                          <span
                            className={cn(
                              "w-2.5 h-2.5 rounded-full ring-2 ring-card absolute -bottom-0.5 -right-0.5 transition-colors",
                              isConnected ? "bg-emerald-500" : "bg-amber-400 ring-amber-400/30"
                            )}
                            title={isConnected ? t("connected") : t("connectorDisconnectedTooltip")}
                          />
                        </div>

                        {/* Title & Subtitle */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {connector.name}
                            </h4>
                            <span
                              className={cn(
                                "text-[9.5px] px-1.5 py-0.5 rounded font-sans font-medium shrink-0",
                                connector.id.includes("canva")
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-secondary text-muted-foreground"
                              )}
                            >
                              {connector.id.includes("canva") ? "Native OAuth" : connector.authType}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1">
                            {connector.id.includes("canva")
                              ? isConnected
                                ? getStoredCanvaTokens()?.displayName
                                  ? `Terhubung: ${getStoredCanvaTokens()?.displayName} (Connect REST API)`
                                  : "Terhubung secara native via Canva OAuth 2.0 PKCE"
                                : "Koneksi resmi langsung ke Canva Connect API tanpa proxy."
                              : isConnected
                              ? t("connectorConnectedTooltip")
                              : t("connectorDisconnectedTooltip")}
                          </p>
                        </div>
                      </div>

                      {/* Right Action: Connect or Disconnect */}
                      <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!isConnected ? (
                          <button
                            type="button"
                            disabled={isConnecting}
                            onClick={(e) => handleToggleConnect(connector, e)}
                            className="text-cyan-400 hover:text-cyan-300 transition-colors text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{isConnecting ? t("connecting") : t("connect")}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10.5px] font-medium border border-emerald-500/20">
                              <Check className="w-3 h-3" />
                              <span>{t("connected")}</span>
                            </span>
                            <button
                              type="button"
                              disabled={isConnecting || connector.isBuiltin}
                              onClick={(e) => handleToggleConnect(connector, e)}
                              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer px-1.5 py-1"
                            >
                              {t("disconnect")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredConnectors.length === 0 && (
                  <div className="text-center py-10 rounded-2xl border border-dashed border-border bg-card/40">
                    <p className="text-xs text-muted-foreground">
                      {t("noConnectorsFoundDesc", { query: searchQuery })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Single Connector Detail View */}
          {mainTab === "apps" && selectedConnector && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <button
                type="button"
                onClick={() => setSelectedConnector(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t("backToAllConnectors")}</span>
              </button>

              <div className="p-4 rounded-2xl border border-border bg-card/80 space-y-4">
                <div className="flex items-start gap-3.5">
                  <BrandLogo id={selectedConnector.id} name={selectedConnector.name} size="md" />
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground">
                        {selectedConnector.name}
                      </h3>
                      <span className="px-1.5 py-0.2 rounded bg-secondary text-muted-foreground text-[10px] font-sans border border-border/70">
                        {selectedConnector.authType}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-secondary text-muted-foreground text-[10px] font-medium border border-border/70">
                        {selectedConnector.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedConnector.tagline}
                    </p>
                    <div className="text-[10.5px] text-muted-foreground/80 flex items-center gap-2 pt-0.5 flex-wrap">
                      <span>{selectedConnector.info.developer}</span>
                      <span>•</span>
                      <span>v{selectedConnector.info.version}</span>
                      <span>•</span>
                      <span>{selectedConnector.toolCount} Available Tools</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  {isConnectorActive(selectedConnector.id) ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isConnectingId === selectedConnector.id || selectedConnector.isBuiltin}
                      onClick={(e) => handleToggleConnect(selectedConnector, e)}
                      className="w-full rounded-xl text-xs h-8 cursor-pointer"
                    >
                      <span>{t("disconnect")}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isConnectingId === selectedConnector.id}
                      onClick={(e) => handleToggleConnect(selectedConnector, e)}
                      className="w-full rounded-xl text-xs h-8 cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      <span>{t("connect")}</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Description & Capabilities */}
              <div className="p-4 rounded-2xl border border-border bg-card/50 space-y-2.5">
                <h4 className="text-xs font-semibold text-foreground">
                  {t("description")}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedConnector.description}
                </p>
              </div>

              {/* Canva Native App Developer Configuration Widget */}
              {selectedConnector.id.includes("canva") && (
                <div className="p-4 rounded-2xl border border-border bg-card/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <span>Konfigurasi Canva App</span>
                    </h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                      PKCE S256
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Koneksi native menggunakan OAuth 2.0 PKCE resmi langsung ke Canva Connect REST API & MCP tanpa perantara proxy.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Canva Client ID
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={canvaClientIdInput}
                        onChange={(e) => setCanvaClientIdInput(e.target.value)}
                        placeholder="OC-AZX..."
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-xl bg-secondary/40 border border-border text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSaveCanvaClientId}
                        className="rounded-xl px-3 h-8 text-xs cursor-pointer shrink-0"
                      >
                        Simpan
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground block">
                      Authorized Redirect URI
                    </span>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50 border border-border/70 text-[10.5px] font-mono text-muted-foreground">
                      <span className="truncate">{getCanvaRedirectUri()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(getCanvaRedirectUri());
                          toast.success("Redirect URI disalin!");
                        }}
                        className="p-1 hover:text-foreground text-muted-foreground cursor-pointer shrink-0"
                        title="Salin URI"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {getStoredCanvaTokens()?.displayName && (
                    <div className="pt-2 border-t border-border/50 text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate font-medium">
                        Akun aktif: {getStoredCanvaTokens()?.displayName}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 rounded-2xl border border-border bg-card/50 space-y-2.5">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>{t("skillsAndCapabilities")}</span>
                </h4>
                <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                  {selectedConnector.skills.map((skill, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-xl bg-secondary/40 border border-border/60 text-xs text-foreground flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate">{skill}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedConnector.tryPrompts && selectedConnector.tryPrompts.length > 0 && (
                <div className="p-4 rounded-2xl border border-border bg-card/50 space-y-2.5">
                  <h4 className="text-xs font-semibold text-foreground">
                    {t("exampleStudyPrompts")}
                  </h4>
                  <div className="space-y-2">
                    {selectedConnector.tryPrompts.map((prompt, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleCopyPrompt(prompt, idx)}
                        className="p-2.5 rounded-xl bg-secondary/30 border border-border hover:bg-secondary/60 transition-colors cursor-pointer flex items-center justify-between gap-2"
                        title="Click to copy prompt"
                      >
                        <p className="text-xs text-foreground/90 font-sans select-none">
                          {prompt}
                        </p>
                        <button type="button" className="p-1 rounded text-muted-foreground hover:text-foreground shrink-0">
                          {copiedPromptIndex === idx ? (
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2: CUSTOM MCP (Full JSON & Servers inside, Image 2 & 3)   */}
          {/* ============================================================= */}
          {mainTab === "custom_mcp" && (
            <div className="space-y-4">
              {/* Sub-toolbar inside Custom MCP: Switcher (Servers | JSON) + Add Server */}
              {!isEditingServer && (
                <div className="flex items-center justify-between gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <div className="relative flex items-center h-9 p-0.5 rounded-xl bg-muted/70 border border-border w-fit shrink-0">
                    <div
                      className="absolute top-0.5 bottom-0.5 left-0 rounded-lg bg-background shadow-2xs pointer-events-none transition-all duration-300"
                      style={{
                        transform: `translateX(${subIndicatorStyle.left}px)`,
                        width: `${subIndicatorStyle.width}px`,
                        opacity: subIndicatorStyle.width > 0 ? 1 : 0,
                        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    />

                    <button
                      ref={serversSubTabRef}
                      type="button"
                      onClick={() => setCustomMcpSubTab("servers")}
                      className={cn(
                        "relative z-10 px-3.5 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5 whitespace-nowrap",
                        customMcpSubTab === "servers"
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Server className="w-3.5 h-3.5" />
                      <span>Servers</span>
                    </button>
                    <button
                      ref={jsonSubTabRef}
                      type="button"
                      onClick={() => setCustomMcpSubTab("json")}
                      className={cn(
                        "relative z-10 px-3.5 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5 whitespace-nowrap",
                        customMcpSubTab === "json"
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>JSON</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="h-8 w-8 rounded-xl border border-border bg-card/60 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Refresh"
                    >
                      <RotateCcw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-primary")} />
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenNewServer}
                      className="h-8 px-3 rounded-xl bg-foreground text-background hover:opacity-90 font-medium text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add server</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-view: Servers list (Matching Image 2 - Zero dummy data) */}
              {customMcpSubTab === "servers" && !isEditingServer && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">Installed</span>
                    <span className="text-xs text-muted-foreground font-sans tabular-nums">{mcpConfig.servers.length}</span>
                  </div>

                  {mcpConfig.servers.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-border bg-card/40 space-y-3">
                      <div className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center mx-auto">
                        <Cable className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">
                          {t("noCustomMcpServersTitle")}
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                          {t("noCustomMcpServersDesc")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenNewServer}
                        className="px-3.5 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t("addServerAction")}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {mcpConfig.servers.map((server) => {
                        const isEnabled = server.enabled !== false;
                        const isStdio = server.transport === "stdio";
                        const isError = server.status === "error";
                        const detail = isStdio
                          ? `stdio · ${server.command || "npx"} ${(server.args || []).join(" ")}`
                          : `${server.transport} · ${server.url || ""}`;

                        return (
                          <div
                            key={server.id}
                            onClick={() => handleEditServer(server)}
                            className={cn(
                              "p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer",
                              isError
                                ? "border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10"
                                : "border-border bg-card/70 hover:bg-secondary/30"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-secondary border border-border/80 flex items-center justify-center relative shrink-0">
                                <Cable className="w-4 h-4 text-muted-foreground" />
                                <span
                                  className={cn(
                                    "w-2 h-2 rounded-full ring-2 ring-card absolute -bottom-0.5 -right-0.5",
                                    isError
                                      ? "bg-rose-500 animate-pulse"
                                      : isEnabled
                                      ? "bg-emerald-500"
                                      : "bg-muted-foreground/40"
                                  )}
                                  title={isError ? server.errorMessage || "Error" : isEnabled ? "Active" : "Disabled"}
                                />
                              </div>

                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-foreground truncate block">
                                    {server.name}
                                  </span>
                                  {isError && (
                                    <span className="text-[9px] px-1 py-0.1 rounded bg-rose-500/10 text-rose-500 font-sans border border-rose-500/20">
                                      Error
                                    </span>
                                  )}
                                </div>
                                <p
                                  className={cn(
                                    "text-[11px] font-sans truncate max-w-[180px] sm:max-w-xs",
                                    isError ? "text-rose-500/90 font-medium" : "text-muted-foreground"
                                  )}
                                >
                                  {isError && server.errorMessage
                                    ? `${detail} — ${server.errorMessage}`
                                    : detail}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => handleToggleServer(server.id, checked)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-view: Form / Edit View (Image 3 style) */}
              {customMcpSubTab === "servers" && isEditingServer && (
                <div className="space-y-4 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingServer(false)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{t("back")}</span>
                    </button>

                    <div className="flex items-center p-0.5 rounded-xl bg-secondary/80 border border-border">
                      <button
                        type="button"
                        onClick={() => setFormMode("form")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
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
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                          formMode === "json"
                            ? "bg-card text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        JSON
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-border bg-card/80 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-foreground">
                        {isEditingExisting ? "Edit MCP Server" : "New MCP Server"}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Fill in the new MCP configuration, then save to return to the list.
                      </p>
                    </div>

                    {formMode === "form" ? (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-foreground">Name</label>
                            <Input
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="my-mcp-server"
                              className="h-8 text-xs rounded-xl bg-secondary/40 border-border"
                            />
                          </div>
                          <div className="w-28 space-y-1 shrink-0">
                            <label className="text-xs font-medium text-foreground">Scope</label>
                            <Select
                              value={formData.scope}
                              onValueChange={(val: McpScope) => setFormData({ ...formData, scope: val })}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-xl bg-secondary/40 border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="workspace">Workspace</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-foreground">Type</label>
                          <Select
                            value={formData.transport}
                            onValueChange={(val: McpTransport) => setFormData({ ...formData, transport: val })}
                          >
                            <SelectTrigger className="h-8 text-xs rounded-xl bg-secondary/40 border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="http">HTTP</SelectItem>
                              <SelectItem value="stdio">stdio</SelectItem>
                              <SelectItem value="sse">SSE</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-foreground">Timeout MS</label>
                          <Input
                            type="number"
                            value={formData.timeoutMs}
                            onChange={(e) => setFormData({ ...formData, timeoutMs: Number(e.target.value) || 30000 })}
                            className="h-8 text-xs rounded-xl bg-secondary/40 border-border"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-foreground">Protocol version</label>
                          <Select
                            value={formData.protocolVersion}
                            onValueChange={(val) => setFormData({ ...formData, protocolVersion: val })}
                          >
                            <SelectTrigger className="h-8 text-xs rounded-xl bg-secondary/40 border-border">
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
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-foreground">URL</label>
                              <Input
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                placeholder="https://mcp.example.com/mcp"
                                className="h-8 text-xs rounded-xl bg-secondary/40 border-border"
                              />
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() => setIsHeadersOpen(!isHeadersOpen)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                {isHeadersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <span>Headers (optional)</span>
                              </button>
                              {isHeadersOpen && (
                                <textarea
                                  value={formData.headersText}
                                  onChange={(e) => setFormData({ ...formData, headersText: e.target.value })}
                                  rows={3}
                                  className="mt-1 w-full p-2.5 rounded-xl bg-secondary/30 border border-border text-xs font-mono text-foreground resize-none"
                                />
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-foreground">Command</label>
                              <Input
                                value={formData.command}
                                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                                placeholder="npx"
                                className="h-8 text-xs rounded-xl bg-secondary/40 border-border"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-foreground">Arguments</label>
                              <Input
                                value={formData.argsText}
                                onChange={(e) => setFormData({ ...formData, argsText: e.target.value })}
                                placeholder="-y @modelcontextprotocol/server-..."
                                className="h-8 text-xs rounded-xl bg-secondary/40 border-border"
                              />
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() => setIsEnvOpen(!isEnvOpen)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                {isEnvOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <span>Environment variables (optional)</span>
                              </button>
                              {isEnvOpen && (
                                <textarea
                                  value={formData.envText}
                                  onChange={(e) => setFormData({ ...formData, envText: e.target.value })}
                                  rows={3}
                                  className="mt-1 w-full p-2.5 rounded-xl bg-secondary/30 border border-border text-xs font-mono text-foreground resize-none"
                                />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={singleJsonText}
                        onChange={(e) => setSingleJsonText(e.target.value)}
                        rows={10}
                        className="w-full p-3 rounded-xl bg-secondary/40 border border-border text-xs font-mono text-foreground resize-none leading-relaxed"
                      />
                    )}

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                      {isEditingExisting && formData.id ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteServer(formData.id!)}
                          className="px-3 py-1.5 rounded-xl border border-destructive/40 text-destructive text-xs font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      ) : <div />}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingServer(false)}
                          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveServer}
                          className="px-4 py-1.5 rounded-xl bg-foreground text-background text-xs font-semibold cursor-pointer shadow-xs"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-view: Full JSON Config inside Custom MCP */}
              {customMcpSubTab === "json" && !isEditingServer && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border text-[11px] text-muted-foreground leading-relaxed">
                    {t("mcpJsonEditorDesc")}
                  </div>

                  <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
                    <div className="px-3 py-2 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
                      <span className="text-[11px] font-sans text-muted-foreground">mcpServers.json</span>
                      <button
                        type="button"
                        onClick={handleCopyFullJson}
                        className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Copy"
                      >
                        {isCopiedFullJson ? (
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <textarea
                      value={fullJsonText}
                      onChange={(e) => setFullJsonText(e.target.value)}
                      rows={12}
                      spellCheck={false}
                      className="w-full p-3 bg-transparent font-mono text-[11px] text-foreground outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleSaveFullJson}
                      className="rounded-xl text-xs h-8 cursor-pointer bg-foreground text-background"
                    >
                      <span>{t("saveChangesAction")}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </InteractiveBottomSheet>
  );
}
