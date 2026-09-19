import React, { useState, useEffect, useRef } from "react";
import {
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  CheckCheck,
  Code2,
  Server,
  Layers,
  Monitor,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  toast,
  cn,
} from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import {
  type McpServerConfig,
  type McpConfigurationState,
  type McpTransport,
  type McpScope,
  PRESET_MCP_SERVERS,
  getStoredMcpConfig,
  saveStoredMcpConfig,
  exportMcpJson,
  importMcpJson,
} from "../../../lib/mcp-connectors";

type TabView = "servers" | "json";

export function McpToolsView() {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [activeTab, setActiveTab] = useState<TabView>("servers");

  // Sliding tab indicator
  const serversTabRef = useRef<HTMLButtonElement>(null);
  const jsonTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const updateIndicator = () => {
      let activeEl: HTMLButtonElement | null = null;
      if (activeTab === "servers") activeEl = serversTabRef.current;
      else if (activeTab === "json") activeEl = jsonTabRef.current;

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
  }, [activeTab, language]);

  // MCP Configuration State
  const [mcpConfig, setMcpConfig] = useState<McpConfigurationState>(() => getStoredMcpConfig());
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<McpServerConfig | null>(null);
  const [envJsonText, setEnvJsonText] = useState("");
  const [isEnvOpen, setIsEnvOpen] = useState(true);

  // Raw JSON state
  const [rawJsonText, setRawJsonText] = useState("");
  const [isCopiedJson, setIsCopiedJson] = useState(false);

  // Preset Selection Modal
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  useEffect(() => {
    setRawJsonText(exportMcpJson(mcpConfig));
  }, [mcpConfig]);

  const handleToggleExpand = (server: McpServerConfig) => {
    if (expandedServerId === server.id) {
      setExpandedServerId(null);
      setEditFormData(null);
      setEnvJsonText("");
    } else {
      setExpandedServerId(server.id);
      setEditFormData(JSON.parse(JSON.stringify(server)));
      setEnvJsonText(
        server.env && Object.keys(server.env).length > 0
          ? JSON.stringify(server.env, null, 2)
          : '{\n  "MY_API_KEY": "your-key"\n}'
      );
      setIsEnvOpen(Boolean(server.env && Object.keys(server.env).length > 0));
    }
  };

  // Save changes to current server
  const handleApplyServerEdit = () => {
    if (!editFormData) return;
    if (!editFormData.name.trim()) {
      toast.error(isIndo ? "Name wajib diisi." : "Name is required.");
      return;
    }

    if (editFormData.transport === "stdio" && !editFormData.command?.trim()) {
      toast.error(isIndo ? "Command wajib diisi untuk transport stdio." : "Command is required for stdio transport.");
      return;
    }

    if ((editFormData.transport === "sse" || editFormData.transport === "http") && !editFormData.url?.trim()) {
      toast.error(isIndo ? "URL wajib diisi untuk transport SSE/HTTP." : "URL is required for SSE/HTTP transport.");
      return;
    }

    let parsedEnv: Record<string, string> = {};
    if (envJsonText.trim()) {
      try {
        const parsed = JSON.parse(envJsonText);
        if (typeof parsed === "object" && parsed !== null) {
          parsedEnv = parsed;
        }
      } catch {
        toast.error(isIndo ? "Format Environment variables JSON tidak valid." : "Invalid Environment variables JSON syntax.");
        return;
      }
    }

    const updatedServer: McpServerConfig = {
      ...editFormData,
      env: parsedEnv,
    };

    const updated = mcpConfig.servers.map((s) =>
      s.id === updatedServer.id ? updatedServer : s
    );

    const newConfig = { servers: updated };
    setMcpConfig(newConfig);
    saveStoredMcpConfig(newConfig);
    setExpandedServerId(null);
    setEditFormData(null);
    toast.success(
      isIndo
        ? `Server ${updatedServer.name} berhasil disimpan.`
        : `Server ${updatedServer.name} saved successfully.`
    );
  };

  const handleCancelServerEdit = () => {
    setExpandedServerId(null);
    setEditFormData(null);
  };

  const handleDeleteServer = (serverId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = mcpConfig.servers.filter((s) => s.id !== serverId);
    const newConfig = { servers: updated };
    setMcpConfig(newConfig);
    saveStoredMcpConfig(newConfig);
    if (expandedServerId === serverId) {
      setExpandedServerId(null);
      setEditFormData(null);
    }
    toast.success(isIndo ? "Server MCP dihapus." : "MCP server deleted.");
  };

  // Add Custom Server
  const handleAddCustomServer = () => {
    const id = `custom-${Date.now()}`;
    const newServer: McpServerConfig = {
      id,
      name: isIndo ? "Server Kustom" : "Custom Server",
      transport: "stdio",
      scope: "user",
      timeoutMs: 30000,
      protocolVersion: "auto",
      command: "npx",
      args: [],
      env: {},
      isCustom: true,
      status: "ready",
    };
    const updated = [...mcpConfig.servers, newServer];
    const newConfig = { servers: updated };
    setMcpConfig(newConfig);
    saveStoredMcpConfig(newConfig);
    setExpandedServerId(newServer.id);
    setEditFormData(JSON.parse(JSON.stringify(newServer)));
    setEnvJsonText('{\n  "MY_API_KEY": "your-key"\n}');
    setIsEnvOpen(true);
  };

  // Add Preset Server
  const handleAddPresetServer = (preset: McpServerConfig) => {
    if (mcpConfig.servers.some((s) => s.id === preset.id)) {
      toast.error(isIndo ? "Server ini sudah terpasang." : "This preset server is already added.");
      return;
    }
    const updated = [...mcpConfig.servers, preset];
    const newConfig = { servers: updated };
    setMcpConfig(newConfig);
    saveStoredMcpConfig(newConfig);
    setIsPresetModalOpen(false);
    toast.success(
      isIndo
        ? `Server ${preset.name} berhasil ditambahkan.`
        : `Server ${preset.name} added successfully.`
    );
  };

  // Apply JSON Changes
  const handleApplyJson = () => {
    try {
      const parsed = importMcpJson(rawJsonText);
      setMcpConfig(parsed);
      saveStoredMcpConfig(parsed);
      toast.success(isIndo ? "Konfigurasi JSON berhasil diterapkan!" : "JSON configuration applied successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Invalid JSON syntax");
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(rawJsonText);
    setIsCopiedJson(true);
    toast.success(isIndo ? "JSON berhasil disalin!" : "JSON copied to clipboard!");
    setTimeout(() => setIsCopiedJson(false), 2000);
  };

  const handleResetToPresets = () => {
    const resetConfig = { servers: PRESET_MCP_SERVERS };
    setMcpConfig(resetConfig);
    saveStoredMcpConfig(resetConfig);
    setExpandedServerId(null);
    setEditFormData(null);
    toast.success(isIndo ? "Konfigurasi direset ke preset default." : "Configuration reset to default presets.");
  };

  return (
    <div className="w-full flex flex-col space-y-6 font-sans">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
              {isIndo ? "Model Context Protocol" : "Model Context Protocol"}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans">
              MCP Servers
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isIndo
              ? "Kelola server Model Context Protocol (MCP) dan eksekusi alat untuk agen belajar Anda."
              : "Manage Model Context Protocol (MCP) servers and tool execution for your AI workspace."}
          </p>
        </div>
      </div>

      {/* 2. Top Toolbar Row: Sliding Pill Switcher (Left) & Add Server Dropdown (Right) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Sliding Pill Switcher - exact height h-9 */}
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
            ref={serversTabRef}
            type="button"
            onClick={() => setActiveTab("servers")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeTab === "servers"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Servers</span>
          </button>

          <button
            ref={jsonTabRef}
            type="button"
            onClick={() => setActiveTab("json")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeTab === "json"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>JSON Config</span>
          </button>
        </div>

        {/* Right Side: Add Server Dropdown */}
        {activeTab === "servers" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-9 px-3.5 rounded-xl border border-border hover:bg-secondary/70 text-xs font-medium text-foreground transition-all flex items-center gap-1.5 cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isIndo ? "Tambah server" : "Add server"}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-card border-border text-foreground p-1 rounded-xl shadow-xl">
              <DropdownMenuItem
                onClick={() => setIsPresetModalOpen(true)}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{isIndo ? "Pilih dari template preset" : "Add from preset"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleAddCustomServer}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{isIndo ? "Tambah server kustom" : "Add custom server"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: SERVERS LIST (MODELS VIEW STYLE)                                */}
      {/* ===================================================================== */}
      {activeTab === "servers" && (
        <div className="space-y-3">
          {mcpConfig.servers.map((server) => {
            const isExpanded = expandedServerId === server.id;

            return (
              <div
                key={server.id}
                className={cn(
                  "rounded-2xl border border-border bg-card/60 transition-all duration-300 overflow-hidden",
                  isExpanded ? "bg-card/90 border-border/90 shadow-xs" : "hover:border-foreground/20 hover:bg-secondary/30"
                )}
              >
                {/* Server Card Header - Matches user screenshot media_1789818089728.png */}
                <div
                  onClick={() => handleToggleExpand(server)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-semibold text-foreground tracking-tight truncate">
                      {server.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10.5px] font-mono border border-border/70 shrink-0">
                      {server.transport}
                    </span>
                    {server.isDefault && (
                      <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10.5px] font-sans border border-border/70 shrink-0">
                        Default
                      </span>
                    )}
                    {server.isCustom && (
                      <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10.5px] font-sans border border-border/70 shrink-0">
                        Custom
                      </span>
                    )}
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                      title="Ready"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExpand(server);
                      }}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                        isExpanded
                          ? "bg-secondary text-foreground border-foreground/30 font-semibold"
                          : "border-border hover:bg-secondary text-foreground"
                      )}
                    >
                      {isExpanded ? (isIndo ? "Tutup" : "Close") : "Edit"}
                    </button>
                  </div>
                </div>

                {/* Expanded Form - Matches user screenshot media_1789818062622.png */}
                {isExpanded && editFormData && (
                  <div className="px-5 pb-5 pt-3 space-y-4 border-t border-border/40 animate-in fade-in-50 duration-200">
                    {/* Row 1: Name (Left) & Scope (Right) */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-medium text-foreground/80 block">
                          Name
                        </label>
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, name: e.target.value })
                          }
                          placeholder="e.g. Canva or Composio"
                          className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                        />
                      </div>

                      <div className="w-36 space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground block text-right pr-1">
                          Scope
                        </label>
                        <Select
                          value={editFormData.scope || "user"}
                          onValueChange={(val) =>
                            setEditFormData({
                              ...editFormData,
                              scope: val as McpScope,
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-9 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                            <div className="flex items-center gap-1.5">
                              <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                              <SelectValue placeholder="User" />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                            <SelectItem value="user" className="text-xs cursor-pointer">
                              User
                            </SelectItem>
                            <SelectItem value="workspace" className="text-xs cursor-pointer">
                              Workspace
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 2: Type */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground/80 block">
                        Type
                      </label>
                      <Select
                        value={editFormData.transport}
                        onValueChange={(val) =>
                          setEditFormData({
                            ...editFormData,
                            transport: val as McpTransport,
                          })
                        }
                      >
                        <SelectTrigger className="w-full h-9 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                          <SelectValue placeholder="stdio (local command)" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                          <SelectItem value="stdio" className="text-xs cursor-pointer">
                            stdio (local command)
                          </SelectItem>
                          <SelectItem value="sse" className="text-xs cursor-pointer">
                            sse (remote stream)
                          </SelectItem>
                          <SelectItem value="http" className="text-xs cursor-pointer">
                            http (streamable)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Row 3: Timeout MS */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground/80 block">
                        Timeout MS
                      </label>
                      <input
                        type="number"
                        value={editFormData.timeoutMs || 30000}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            timeoutMs: parseInt(e.target.value) || 30000,
                          })
                        }
                        placeholder="30000"
                        className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                      />
                    </div>

                    {/* Row 4: Protocol version */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground/80 block">
                        Protocol version
                      </label>
                      <Select
                        value={editFormData.protocolVersion || "auto"}
                        onValueChange={(val) =>
                          setEditFormData({
                            ...editFormData,
                            protocolVersion: val,
                          })
                        }
                      >
                        <SelectTrigger className="w-full h-9 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                          <SelectValue placeholder="Auto (recommended)" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                          <SelectItem value="auto" className="text-xs cursor-pointer">
                            Auto (recommended)
                          </SelectItem>
                          <SelectItem value="2024-11-05" className="text-xs cursor-pointer">
                            2024-11-05
                          </SelectItem>
                          <SelectItem value="2024-10-07" className="text-xs cursor-pointer">
                            2024-10-07
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Row 5 & 6: Command and Arguments (or URL) */}
                    {editFormData.transport === "stdio" ? (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground/80 block">
                            Command
                          </label>
                          <input
                            type="text"
                            value={editFormData.command || ""}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, command: e.target.value })
                            }
                            placeholder="npx"
                            className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs font-mono text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground/80 block">
                            Arguments (space separated)
                          </label>
                          <input
                            type="text"
                            value={(editFormData.args || []).join(" ")}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                args: e.target.value.split(" ").filter(Boolean),
                              })
                            }
                            placeholder="-y mcp-remote@latest https://mcp.canva.com/mcp"
                            className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs font-mono text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground/80 block">
                          URL
                        </label>
                        <input
                          type="text"
                          value={editFormData.url || ""}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, url: e.target.value })
                          }
                          placeholder="https://mcp.canva.com/mcp"
                          className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs font-mono text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                        />
                      </div>
                    )}

                    {/* Row 7: Environment variables (optional) Accordion */}
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEnvOpen(!isEnvOpen)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      >
                        {isEnvOpen ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>Environment variables (optional)</span>
                      </button>

                      {isEnvOpen && (
                        <textarea
                          rows={4}
                          value={envJsonText}
                          onChange={(e) => setEnvJsonText(e.target.value)}
                          placeholder={'{\n  "MY_API_KEY": "your-key"\n}'}
                          spellCheck={false}
                          className="w-full p-3 rounded-xl bg-secondary/30 border border-border text-xs font-mono text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 resize-none leading-relaxed transition-colors"
                        />
                      )}
                    </div>

                    {/* Row 8: Bottom Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/40">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteServer(editFormData.id, e)}
                        className="text-xs text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        <span>Delete</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelServerEdit}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyServerEdit}
                          className="px-4 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: JSON CONFIG                                                    */}
      {/* ===================================================================== */}
      {activeTab === "json" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border text-xs text-muted-foreground leading-relaxed">
            {isIndo
              ? "Konfigurasi ini mengikuti format standar mcpServers yang kompatibel dengan Antigravity, Claude Desktop, dan Cursor. Anda dapat langsung mengedit atau menempelkan JSON di bawah ini."
              : "This configuration adheres to the standard mcpServers schema compatible with Antigravity, Claude Desktop, and Cursor. You can edit or paste JSON directly below."}
          </div>

          <div className="relative rounded-2xl border border-border bg-card/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">
                mcpServers.json
              </span>
              <button
                type="button"
                onClick={handleCopyJson}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Copy JSON"
              >
                {isCopiedJson ? (
                  <CheckCheck className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <textarea
              value={rawJsonText}
              onChange={(e) => setRawJsonText(e.target.value)}
              rows={16}
              spellCheck={false}
              className="w-full p-4 bg-transparent font-mono text-xs text-foreground outline-none resize-none leading-relaxed"
            />
          </div>

          {/* JSON Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetToPresets}
              className="px-4 py-2 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              {isIndo ? "Reset ke Default" : "Reset to Presets"}
            </button>

            <button
              type="button"
              onClick={handleApplyJson}
              className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isIndo ? "Terapkan JSON" : "Apply JSON"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Preset Modal */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {isIndo ? "Pilih Template Server MCP" : "Choose MCP Server Preset"}
              </h3>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {PRESET_MCP_SERVERS.map((preset) => {
                const isInstalled = mcpConfig.servers.some((s) => s.id === preset.id);

                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isInstalled}
                    onClick={() => handleAddPresetServer(preset)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer",
                      isInstalled
                        ? "opacity-50 bg-secondary/20 border-border cursor-not-allowed"
                        : "bg-secondary/30 border-border hover:bg-secondary/60 hover:border-foreground/30 active:scale-[0.99]"
                    )}
                  >
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        {preset.name}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {preset.transport === "stdio"
                          ? `${preset.command} ${preset.args?.join(" ")}`
                          : preset.url}
                      </span>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border/70 shrink-0">
                      {isInstalled ? (isIndo ? "Terpasang" : "Installed") : "+ Tambah"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
