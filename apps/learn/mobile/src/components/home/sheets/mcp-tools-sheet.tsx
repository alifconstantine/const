import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Code2,
  Check,
  Copy,
  CheckCheck,
  RotateCcw,
  Layers,
  ArrowLeft,
  Link2,
  Unlink2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Search,
} from "lucide-react";
import {
  AVAILABLE_CONNECTORS,
  type ConnectorMetadata,
  BrandLogo,
  Button,
  toast,
  cn,
} from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import {
  type McpConfigurationState,
  MOBILE_PRESET_MCP_SERVERS,
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

type TabView = "apps" | "json";

interface McpToolsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function McpToolsSheet({ open, onClose }: McpToolsSheetProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [activeTab, setActiveTab] = useState<TabView>("apps");
  const [selectedConnector, setSelectedConnector] = useState<ConnectorMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [connectedIds, setConnectedIds] = useState<string[]>(() => getConnectedConnectorIds());
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);

  // Raw JSON state (Tab 2)
  const [mcpConfig, setMcpConfig] = useState<McpConfigurationState>(() => getStoredMcpConfig());
  const [rawJsonText, setRawJsonText] = useState("");
  const [isCopiedJson, setIsCopiedJson] = useState(false);

  useEffect(() => {
    if (open) {
      const stored = getStoredMcpConfig();
      setMcpConfig(stored);
      setRawJsonText(exportMcpJson(stored));
      setConnectedIds(getConnectedConnectorIds());
      setSelectedConnector(null);
    }
  }, [open]);

  const filteredConnectors = useMemo(() => {
    return AVAILABLE_CONNECTORS.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [searchQuery]);

  const handleToggleConnect = async (connector: ConnectorMetadata) => {
    if (connector.id === "cloud-sandbox") {
      toast.info(
        isIndo
          ? "Cloud Sandbox adalah alat bawaan inti yang selalu aktif."
          : "Cloud Sandbox is a core built-in tool that is always active."
      );
      return;
    }

    const isActive = isConnectorActive(connector.id);
    setIsConnecting(true);

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
      setIsConnecting(false);
    }
  };

  const handleCopyPrompt = (prompt: string, idx: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPromptIndex(idx);
    toast.success(isIndo ? "Prompt disalin!" : "Prompt copied!");
    setTimeout(() => setCopiedPromptIndex(null), 2000);
  };

  // JSON Tab Actions
  const handleApplyJson = () => {
    try {
      const parsed = importMcpJson(rawJsonText);
      setMcpConfig(parsed);
      saveStoredMcpConfig(parsed);
      toast.success(isIndo ? "Konfigurasi JSON berhasil disimpan." : "JSON configuration saved successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Format JSON tidak valid.");
    }
  };

  const handleResetToPresets = () => {
    const defaultConfig: McpConfigurationState = { servers: MOBILE_PRESET_MCP_SERVERS };
    setMcpConfig(defaultConfig);
    setRawJsonText(exportMcpJson(defaultConfig));
    saveStoredMcpConfig(defaultConfig);
    toast.success(isIndo ? "Reset ke preset default berhasil." : "Reset to default presets successfully.");
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(rawJsonText);
    setIsCopiedJson(true);
    toast.success(isIndo ? "JSON berhasil disalin." : "JSON copied to clipboard.");
    setTimeout(() => setIsCopiedJson(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in-50 duration-200">
      <div className="w-full sm:max-w-xl h-[88vh] sm:h-[82vh] max-h-[750px] bg-background border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
        {/* Top Drag Indicator (Mobile) */}
        <div className="w-full pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1.5 rounded-full bg-border" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {isIndo ? "Connectors & Integrasi MCP" : "Connectors & MCP Integrations"}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10.5px] font-medium border border-primary/20">
              {connectedIds.length} {isIndo ? "Aktif" : "Active"}
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

        {/* Tabs Bar */}
        <div className="px-5 pt-3 shrink-0 flex items-center justify-between gap-2 border-b border-border/40 pb-2">
          <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab("apps");
                setSelectedConnector(null);
              }}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeTab === "apps"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isIndo ? "Aplikasi & Tools" : "Apps & Tools"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeTab === "json"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{isIndo ? "MCP JSON" : "MCP JSON"}</span>
            </button>
          </div>
        </div>

        {/* Sheet Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* ============================================================= */}
          {/* TAB 1: APPS & CONNECTORS (LIST VIEW)                          */}
          {/* ============================================================= */}
          {activeTab === "apps" && !selectedConnector && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={isIndo ? "Cari aplikasi atau tools..." : "Search apps or tools..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30 transition-colors"
                />
              </div>

              {/* Connectors List */}
              <div className="space-y-2.5">
                {filteredConnectors.map((connector) => {
                  const isConnected = isConnectorActive(connector.id);

                  return (
                    <div
                      key={connector.id}
                      onClick={() => setSelectedConnector(connector)}
                      className={cn(
                        "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]",
                        isConnected
                          ? "bg-card border-emerald-500/30 hover:border-emerald-500/50"
                          : "bg-card/60 border-border hover:bg-secondary/30"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <BrandLogo id={connector.id} name={connector.name} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {connector.name}
                            </span>
                            {connector.isBuiltin && (
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                                Core
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                            {connector.tagline}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isConnected ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10.5px] font-medium border border-emerald-500/20">
                            <Check className="w-2.5 h-2.5" />
                            <span>{isIndo ? "Aktif" : "Active"}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10.5px] font-medium border border-border">
                            {isIndo ? "Tersedia" : "Ready"}
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs">›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 1: CONNECTOR DETAIL VIEW (Mobile)                         */}
          {/* ============================================================= */}
          {activeTab === "apps" && selectedConnector && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Back to List */}
              <button
                type="button"
                onClick={() => setSelectedConnector(null)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isIndo ? "Kembali ke Daftar" : "Back to List"}</span>
              </button>

              {/* Hero Card */}
              <div className="p-4 rounded-2xl border border-border bg-card/70 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BrandLogo id={selectedConnector.id} name={selectedConnector.name} size="md" />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {selectedConnector.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                        <span>{selectedConnector.category}</span>
                        <span>•</span>
                        <span>{selectedConnector.authType}</span>
                        <span>•</span>
                        <span>{selectedConnector.toolCount} Tools</span>
                      </div>
                    </div>
                  </div>

                  {/* Connect / Disconnect Action */}
                  <div className="shrink-0">
                    {isConnectorActive(selectedConnector.id) ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isConnecting || selectedConnector.isBuiltin}
                        onClick={() => handleToggleConnect(selectedConnector)}
                        className="rounded-xl h-8 text-[11px] px-3 cursor-pointer"
                      >
                        <Unlink2 className="w-3 h-3 mr-1" />
                        <span>{isIndo ? "Putus" : "Disconnect"}</span>
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isConnecting}
                        onClick={() => handleToggleConnect(selectedConnector)}
                        className="rounded-xl h-8 text-[11px] px-3 cursor-pointer bg-foreground text-background"
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        <span>{isIndo ? "Hubungkan" : "Connect"}</span>
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedConnector.description}
                </p>
              </div>

              {/* Skills */}
              <div className="p-4 rounded-2xl border border-border bg-card/40 space-y-2.5">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isIndo ? "Kemampuan (Tools)" : "Capabilities & Tools"}</span>
                </h4>
                <div className="space-y-1.5">
                  {selectedConnector.skills.map((skill, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/60 text-[11px] text-foreground flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span>{skill}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Try Prompts */}
              {selectedConnector.tryPrompts && selectedConnector.tryPrompts.length > 0 && (
                <div className="p-4 rounded-2xl border border-border bg-card/40 space-y-2.5">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>{isIndo ? "Contoh Prompt Belajar" : "Example Study Prompts"}</span>
                  </h4>
                  <div className="space-y-1.5">
                    {selectedConnector.tryPrompts.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleCopyPrompt(p, idx)}
                        className="p-2.5 rounded-lg bg-secondary/30 border border-border hover:bg-secondary/60 transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span className="text-[11px] font-mono text-foreground/90 line-clamp-2 select-none">
                          {p}
                        </span>
                        <span className="shrink-0 text-muted-foreground text-xs">
                          {copiedPromptIndex === idx ? (
                            <CheckCheck className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2: RAW MCP JSON CONFIG (Mobile)                           */}
          {/* ============================================================= */}
          {activeTab === "json" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-secondary/30 border border-border text-[11px] text-muted-foreground leading-relaxed">
                {isIndo
                  ? "Format JSON ini kompatibel dengan standar mcpServers (Antigravity & Claude Desktop)."
                  : "Adheres to standard mcpServers schema for Antigravity & Claude Desktop."}
              </div>

              <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-muted-foreground">mcpServers.json</span>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                    title="Copy"
                  >
                    {isCopiedJson ? (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <textarea
                  value={rawJsonText}
                  onChange={(e) => setRawJsonText(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="w-full p-3 bg-transparent font-mono text-[11px] text-foreground outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleResetToPresets}
                  className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {isIndo ? "Reset Default" : "Reset Default"}
                </button>
                <Button
                  size="sm"
                  onClick={handleApplyJson}
                  className="rounded-lg h-7 text-[11px] px-3 bg-foreground text-background cursor-pointer"
                >
                  <Check className="w-3 h-3 mr-1" />
                  <span>{isIndo ? "Simpan JSON" : "Save JSON"}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
