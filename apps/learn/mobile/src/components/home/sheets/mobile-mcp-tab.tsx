import React, { useState, useEffect, useMemo } from "react";
import {
  Cable,
  Unplug,
  Search,
  Plus,
  RefreshCw,
  Check,
  Trash2,
  ExternalLink,
  ChevronDown,
  Globe,
  Radio,
  Terminal,
  X,
  Info,
} from "lucide-react";
import { Switch, toast, cn } from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import {
  type McpServerConfig,
  AVAILABLE_PRESET_MCP_SERVERS,
  getStoredMcpConfig,
  saveStoredMcpConfig,
} from "../../../lib/mcp-connectors";
import {
  testRemoteMcpConnection,
  disconnectRemoteMcpServer,
} from "../../../lib/mcp-client";
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
      tooltip: "Server dinonaktifkan",
    };
  }

  // 1. Check missing API keys / credentials
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

  // 5. Ready state
  return {
    color: "emerald",
    label: "Siap",
    isActionable: true,
    actionType: "connect",
    tooltip: "Siap terhubung",
  };
}

export function MobileMcpTab() {
  const { t } = useI18n();

  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [activeTab, setActiveTab] = useState<"installed" | "catalog" | "custom">("installed");
  const [searchQuery, setSearchQuery] = useState("");

  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [disconnectingServerId, setDisconnectingServerId] = useState<string | null>(null);
  const [expandedToolsServerId, setExpandedToolsServerId] = useState<string | null>(null);

  // Add Custom Server Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customToken, setCustomToken] = useState("");
  const [customTimeout, setCustomTimeout] = useState(25000);

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

  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      const matchQuery =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.url && s.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchQuery) return false;

      if (activeTab === "installed") return s.enabled !== false;
      if (activeTab === "catalog") return !s.isCustom;
      if (activeTab === "custom") return s.isCustom;
      return true;
    });
  }, [servers, searchQuery, activeTab]);

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

  const handleDeleteServer = async (serverId: string) => {
    const target = servers.find((s) => s.id === serverId);
    if (target?.url) {
      await disconnectRemoteMcpServer(target.url, target.sessionId, target.headers).catch(() => {});
    }
    const updated = servers.filter((s) => s.id !== serverId);
    saveServers(updated);
    toast.success(t("serverDeletedSuccess"));
  };

  const handleDisconnectServer = async (server: McpServerConfig) => {
    setDisconnectingServerId(server.id);
    try {
      if (server.url) {
        await disconnectRemoteMcpServer(server.url, server.sessionId, server.headers);
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
    } catch {
      toast.error(t("failedDisconnectNotice", { name: server.name }));
    } finally {
      setDisconnectingServerId(null);
    }
  };

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

  const handleTestRemoteConnection = async (server: McpServerConfig) => {
    if (server.transport === "stdio") {
      toast.info("Server stdio di Mobile otomatis dialihkan ke Cloud Gateway saat obrolan dimulai.");
      return;
    }

    if (!server.url) {
      toast.error(t("mcpUrlRequired"));
      return;
    }

    setTestingServerId(server.id);
    const res = await testRemoteMcpConnection(server.url, server.headers, server.timeoutMs);
    setTestingServerId(null);

    if (res.success) {
      const count = res.count || res.tools?.length || 0;
      toast.success(t("connectionSuccess", { count }));
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
      toast.error(t("mcpConnectionFailed", { error: res.error || "Gagal" }));
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
  };

  const handleSaveCustomServer = () => {
    const name = customName.trim();
    const url = customUrl.trim();

    if (!name) {
      toast.error(t("mcpServerNameRequired"));
      return;
    }

    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      toast.error(t("mcpInvalidUrl"));
      return;
    }

    const headers: Record<string, string> = {};
    if (customToken.trim()) {
      headers["Authorization"] = customToken.startsWith("Bearer ")
        ? customToken
        : `Bearer ${customToken}`;
    }

    const id = `custom_${Date.now()}`;
    const newServer: McpServerConfig = {
      id,
      name,
      transport: "http",
      scope: "user",
      timeoutMs: customTimeout,
      url,
      headers,
      enabled: true,
      isCustom: true,
      status: "ready",
    };

    const updated = [...servers, newServer];
    saveServers(updated);
    toast.success(t("serverSavedSuccess", { name }));

    setCustomName("");
    setCustomUrl("");
    setCustomToken("");
    setIsAddModalOpen(false);
    setActiveTab("custom");
  };

  return (
    <div className="space-y-4 pb-12 select-none">
      {/* Mobile Info Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-[#222222] border border-[#383838] flex items-start gap-3">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-semibold text-[#ffffff]">
            {t("mobileMcpNoticeTitle")}
          </div>
          <p className="text-[#969696] text-[11px] mt-0.5 leading-relaxed">
            {t("mobileMcpNoticeDesc")}
          </p>
        </div>
      </div>

      {/* Search & Add Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#969696] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchMcpPlaceholder")}
            className="w-full pl-9 pr-3 py-1.5 bg-[#2b2b2b] border border-[#383838] rounded-xl text-xs text-[#ffffff] placeholder-[#5d5d5d] focus:outline-hidden"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-[#ffffff] text-[#161616] text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 border-b border-[#383838] pb-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("installed")}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors cursor-pointer",
            activeTab === "installed"
              ? "bg-[#2b2b2b] text-[#ffffff] font-semibold"
              : "text-[#969696]"
          )}
        >
          {t("installedTab")} ({servers.filter((s) => s.enabled !== false).length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("catalog")}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors cursor-pointer",
            activeTab === "catalog"
              ? "bg-[#2b2b2b] text-[#ffffff] font-semibold"
              : "text-[#969696]"
          )}
        >
          {t("catalogTab")} ({AVAILABLE_PRESET_MCP_SERVERS.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors cursor-pointer",
            activeTab === "custom"
              ? "bg-[#2b2b2b] text-[#ffffff] font-semibold"
              : "text-[#969696]"
          )}
        >
          {t("customTab")} ({servers.filter((s) => s.isCustom).length})
        </button>
      </div>

      {/* CATALOG PRESET LIST */}
      {activeTab === "catalog" ? (
        <div className="space-y-2.5">
          {AVAILABLE_PRESET_MCP_SERVERS.map((preset) => {
            const isInstalled = servers.some((s) => s.id === preset.id);
            return (
              <div
                key={preset.id}
                className="p-3.5 rounded-2xl bg-[#222222] border border-[#383838] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center shrink-0 text-primary">
                    <Cable className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#ffffff] truncate">
                      {preset.name}
                    </div>
                    <p className="text-[11px] text-[#969696] truncate">
                      {preset.url || preset.description || preset.transport.toUpperCase()}
                    </p>
                  </div>
                </div>

                {isInstalled ? (
                  <span className="text-[11px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                    Terpasang
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddPreset(preset)}
                    className="px-3 py-1 rounded-xl bg-[#ffffff] text-[#161616] text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    Pasang
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* INSTALLED / CUSTOM SERVERS LIST */
        <div className="space-y-2.5">
          {filteredServers.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[#222222] border border-[#383838]">
              <Cable className="w-7 h-7 text-[#969696] mx-auto mb-1.5 opacity-50" />
              <div className="text-xs font-medium text-[#ffffff]">
                {t("noCustomMcpServersTitle")}
              </div>
              <p className="text-[11px] text-[#969696] mt-0.5">
                {t("noCustomMcpServersDesc")}
              </p>
            </div>
          ) : (
            filteredServers.map((server) => {
              const isTesting = testingServerId === server.id;
              const isToolsExpanded = expandedToolsServerId === server.id;
              const toolCount = server.tools?.length || 0;
              const health = getServerHealth(server);

              return (
                <div
                  key={server.id}
                  className={cn(
                    "rounded-2xl border transition-all overflow-hidden",
                    server.enabled !== false
                      ? "bg-[#222222] border-[#383838]"
                      : "bg-[#1b1b1b] border-[#2e2e2e] opacity-75"
                  )}
                >
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center shrink-0 text-[#ffffff]">
                        {server.transport === "stdio" ? (
                          <Terminal className="w-4 h-4 text-emerald-400" />
                        ) : server.transport === "sse" ? (
                          <Radio className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Globe className="w-4 h-4 text-blue-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-[#ffffff] truncate">
                            {server.name}
                          </span>

                          {/* Status Dot: Hijau = Aktif/Siap, Merah = Masalah/Belum OAuth/Belum API Key */}
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
                              health.color === "emerald"
                                ? "bg-emerald-400 shadow-xs shadow-emerald-400/50"
                                : health.color === "rose"
                                ? "bg-rose-400 shadow-xs shadow-rose-400/50"
                                : "bg-[#5d5d5d]"
                            )}
                            title={health.tooltip}
                          />

                          {health.color === "rose" && (
                            <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              {health.label}
                            </span>
                          )}

                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#2b2b2b] text-[#969696] border border-[#383838]">
                            {server.transport.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#969696] font-mono truncate mt-0.5">
                          {server.url || `${server.command} ${(server.args || []).join(" ")}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {toolCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedToolsServerId(isToolsExpanded ? null : server.id)}
                          className="px-2 py-0.5 rounded-lg bg-[#2b2b2b] text-[10px] text-emerald-400 font-medium border border-[#383838]"
                        >
                          {toolCount} tools
                        </button>
                      )}

                      {/* Unified Single Action Button: Connect / Disconnect */}
                      {health.actionType === "disconnect" ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnectServer(server)}
                          disabled={disconnectingServerId === server.id}
                          className="p-1.5 rounded-lg border border-border/80 hover:border-destructive/40 text-rose-400 hover:text-rose-300 active:scale-95 transition-colors"
                          title={t("disconnect")}
                        >
                          <Unplug className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (health.actionType === "oauth") {
                              const url = server.authUrl || "https://mcp.canva.com/authorize";
                              window.open(url, "_blank");
                              return;
                            }
                            handleTestRemoteConnection(server);
                          }}
                          disabled={isTesting}
                          className={cn(
                            "p-1.5 rounded-lg border active:scale-95 transition-colors",
                            health.color === "rose"
                              ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                              : "border-border/80 text-[#969696] hover:text-[#ffffff]"
                          )}
                          title={health.tooltip}
                        >
                          <Cable className={cn("w-3.5 h-3.5", isTesting && "animate-spin")} />
                        </button>
                      )}

                      {/* Refresh / Ping Button (Tetap Ada) */}
                      <button
                        type="button"
                        onClick={() => handleTestRemoteConnection(server)}
                        disabled={isTesting}
                        className="p-1.5 rounded-lg border border-[#383838] text-[#969696] hover:text-[#ffffff] active:scale-95"
                        title="Tes / Refresh"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", isTesting && "animate-spin")} />
                      </button>

                      {server.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteServer(server.id)}
                          className="p-1 rounded-lg border border-[#383838] text-[#969696] hover:text-rose-400"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <Switch
                        checked={server.enabled !== false}
                        onCheckedChange={() => handleToggleServer(server.id)}
                      />
                    </div>
                  </div>

                  {/* Expandable Tools List in Mobile */}
                  {isToolsExpanded && server.tools && server.tools.length > 0 && (
                    <div className="p-3 border-t border-[#383838]/60 bg-[#1a1a1a] space-y-1.5">
                      <div className="text-[10px] font-semibold text-[#969696] uppercase tracking-wider">
                        Daftar Alat ({server.tools.length}):
                      </div>
                      {server.tools.map((t, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-[#222222] border border-[#383838] text-[11px]">
                          <div className="font-mono text-emerald-400 font-medium">{t.name}</div>
                          {t.description && <div className="text-[#969696] text-[10px] mt-0.5">{t.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add Custom Remote Server Sheet/Dialog */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <div className="bg-[#222222] border border-[#383838] rounded-2xl w-full max-w-sm p-4 space-y-3.5 shadow-2xl animate-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#ffffff] flex items-center gap-1.5">
                <Cable className="w-4 h-4 text-primary" />
                <span>{t("newMcpServer")}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-[#969696] hover:text-[#ffffff]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#d4d4d4] mb-1">
                Nama Server
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="My Remote MCP"
                className="w-full px-3 py-1.5 bg-[#2b2b2b] border border-[#383838] rounded-xl text-xs text-[#ffffff] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#d4d4d4] mb-1">
                URL Server (HTTPS)
              </label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://search.parallel.ai/mcp"
                className="w-full px-3 py-1.5 bg-[#2b2b2b] border border-[#383838] rounded-xl text-xs text-[#ffffff] font-mono focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#d4d4d4] mb-1">
                Bearer Token / API Key (Opsional)
              </label>
              <input
                type="text"
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-1.5 bg-[#2b2b2b] border border-[#383838] rounded-xl text-xs text-[#ffffff] font-mono focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#383838]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-[#383838] text-xs text-[#d4d4d4]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCustomServer}
                className="px-4 py-1.5 rounded-xl bg-[#ffffff] text-[#161616] text-xs font-semibold active:scale-95 transition-all shadow-xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
