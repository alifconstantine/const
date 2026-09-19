import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Check,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Link2,
  Unlink2,
  Code2,
  Layers,
  Copy,
  CheckCheck,
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
  getConnectedConnectorIds,
  isConnectorActive,
  connectConnector,
  disconnectConnector,
} from "../../../lib/connectors-service";
import { McpToolsView } from "./mcp-tools-view";

type MainTab = "connectors" | "mcp_json";
type CategoryFilter = "All" | "Featured" | "Productivity" | "Creativity" | "Education" | "Developer";

export function ConnectorsView() {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [mainTab, setMainTab] = useState<MainTab>("connectors");
  const [selectedConnector, setSelectedConnector] = useState<ConnectorMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("All");
  const [connectedIds, setConnectedIds] = useState<string[]>(() => getConnectedConnectorIds());
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setConnectedIds(getConnectedConnectorIds());
    };
    window.addEventListener("connectors_changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("connectors_changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const filteredConnectors = useMemo(() => {
    return AVAILABLE_CONNECTORS.filter((c) => {
      // Exclude Code Interpreter / Cloud Sandbox on Desktop
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

  const handleToggleConnect = async (connector: ConnectorMetadata) => {
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
    toast.success(isIndo ? "Prompt disalin ke clipboard!" : "Prompt copied to clipboard!");
    setTimeout(() => setCopiedPromptIndex(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-foreground tracking-tight">
              {isIndo ? "Connectors & Integrasi MCP" : "Connectors & MCP Integrations"}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
              {connectedIds.length} {isIndo ? "Aktif" : "Active"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isIndo
              ? "Hubungkan akun Canva MCP, Google Workspace, dan YouTube untuk memperluas kapabilitas AI Tutor."
              : "Connect Canva MCP, Google Workspace, and YouTube to expand your AI Tutor's capabilities."}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setMainTab("connectors");
              setSelectedConnector(null);
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              mainTab === "connectors"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isIndo ? "Aplikasi & Tools" : "Apps & Tools"}</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab("mcp_json")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              mainTab === "mcp_json"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{isIndo ? "Kustom MCP (JSON)" : "Custom MCP (JSON)"}</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: CONNECTORS & APPS (Const AI Style)                        */}
      {/* ================================================================= */}
      {mainTab === "connectors" && !selectedConnector && (
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

          {/* Connectors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConnectors.map((connector) => {
              const isConnected = isConnectorActive(connector.id);

              return (
                <div
                  key={connector.id}
                  onClick={() => setSelectedConnector(connector)}
                  className={cn(
                    "group rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-xs",
                    isConnected
                      ? "bg-card border-emerald-500/30 hover:border-emerald-500/50"
                      : "bg-card/60 border-border hover:border-foreground/20 hover:bg-secondary/20"
                  )}
                >
                  <div>
                    {/* Top Row: Logo & Status Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <BrandLogo id={connector.id} name={connector.name} size="md" />

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10.5px] font-mono border border-border/70">
                          {connector.authType}
                        </span>
                        {isConnected ? (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                            <Check className="w-3 h-3" />
                            <span>{isIndo ? "Terhubung" : "Connected"}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground text-[11px] font-medium border border-border">
                            {isIndo ? "Tersedia" : "Available"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* App Title & Tagline */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {connector.name}
                        </h3>
                        {connector.isBuiltin && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                            Core
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {connector.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="text-[11px]">
                      {connector.toolCount} {isIndo ? "Tools" : "Tools"}
                    </span>
                    <span className="text-[11px] font-medium text-foreground group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      <span>{isIndo ? "Detail & Otorisasi" : "Details & Connect"}</span>
                      <span>→</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

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
      )}

      {/* ================================================================= */}
      {/* DETAIL VIEW: SINGLE CONNECTOR (Const AI ConnectorDetailView)     */}
      {/* ================================================================= */}
      {mainTab === "connectors" && selectedConnector && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => setSelectedConnector(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isIndo ? "Kembali ke Semua Connectors" : "Back to All Connectors"}</span>
          </button>

          {/* Hero Header Card */}
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

            {/* Action Connect Button */}
            <div className="shrink-0 flex items-center gap-3">
              {isConnectorActive(selectedConnector.id) ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isConnecting || selectedConnector.isBuiltin}
                  onClick={() => handleToggleConnect(selectedConnector)}
                  className="rounded-xl px-5 h-9 text-xs font-medium cursor-pointer"
                >
                  <Unlink2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>{isIndo ? "Putuskan Koneksi" : "Disconnect"}</span>
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  disabled={isConnecting}
                  onClick={() => handleToggleConnect(selectedConnector)}
                  className="rounded-xl px-6 h-9 text-xs font-medium cursor-pointer bg-foreground text-background hover:opacity-90"
                >
                  <Link2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>{isIndo ? "Hubungkan Akun" : "Connect Account"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Description & Capabilities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Description & Tools */}
            <div className="md:col-span-2 space-y-6">
              {/* Overview Box */}
              <div className="p-5 rounded-2xl border border-border bg-card/50 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>{isIndo ? "Tentang Integrasi" : "About Integration"}</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedConnector.description}
                </p>
              </div>

              {/* Skills / Capabilities List */}
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

              {/* Try Prompts */}
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
                        <button
                          type="button"
                          className="p-1 rounded text-muted-foreground hover:text-foreground shrink-0"
                        >
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

            {/* Right Column: Developer & Links */}
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
                  <div className="pt-2 border-t border-border/50 space-y-1.5 text-[11px]">
                    <a
                      href={selectedConnector.info.privacyPolicy}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline block"
                    >
                      Privacy Policy ↗
                    </a>
                    <a
                      href={selectedConnector.info.termsOfService}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline block"
                    >
                      Terms of Service ↗
                    </a>
                  </div>
                </div>
              </div>

              {/* Status Box */}
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border text-xs text-muted-foreground leading-relaxed space-y-1.5">
                <span className="font-semibold text-foreground block">
                  {isIndo ? "Bagaimana cara kerjanya?" : "How does this work?"}
                </span>
                <p>
                  {isIndo
                    ? "Setelah terhubung, AI Tutor dapat secara otomatis membaca atau memodifikasi dokumen saat Anda memberikan instruksi dalam obrolan."
                    : "Once connected, AI Tutor can automatically interact with this application when given instructions during study sessions."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: RAW MCP JSON CONFIG (For Power Users)                      */}
      {/* ================================================================= */}
      {mainTab === "mcp_json" && <McpToolsView />}
    </div>
  );
}
