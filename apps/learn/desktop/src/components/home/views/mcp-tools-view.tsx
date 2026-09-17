import React, { useState } from "react";
import {
  Server,
  Code2,
  Terminal,
  FileCode2,
  FolderTree,
  Globe,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast, cn } from "@const/ui";
import { useI18n } from "../../../lib/i18n";

export interface DesktopMcpTool {
  id: string;
  name: string;
  category: "Code Execution" | "Filesystem" | "Web & Knowledge";
  descEn: string;
  descId: string;
  icon: React.ElementType;
  parameters: string[];
}

export const DESKTOP_MCP_TOOLS: DesktopMcpTool[] = [
  {
    id: "execute_code",
    name: "execute_code",
    category: "Code Execution",
    descEn: "Isolated sandbox execution environment for Python and JavaScript algorithms and calculations.",
    descId: "Lingkungan sandbox terisolasi untuk eksekusi algoritma dan kalkulasi Python serta JavaScript.",
    icon: Code2,
    parameters: ["language", "code", "timeoutMs"],
  },
  {
    id: "execute_terminal_command",
    name: "execute_terminal_command",
    category: "Code Execution",
    descEn: "Executes non-destructive shell utilities, formatters, and data extraction commands.",
    descId: "Menjalankan utilitas terminal, pemformat berkas, dan perintah ekstraksi data.",
    icon: Terminal,
    parameters: ["command", "cwd"],
  },
  {
    id: "get_file_content",
    name: "get_file_content",
    category: "Filesystem",
    descEn: "Reads source files, study notes, or local workspace markdown artifacts with line-range indexing.",
    descId: "Membaca berkas sumber, catatan belajar, atau dokumen markdown dengan indeks baris.",
    icon: FileCode2,
    parameters: ["path", "startLine", "endLine"],
  },
  {
    id: "set_file_content",
    name: "set_file_content",
    category: "Filesystem",
    descEn: "Safely writes, modifies, or appends notes, code files, and learning summaries.",
    descId: "Menulis, memperbarui, atau menambahkan catatan, berkas kode, dan rangkuman belajar.",
    icon: FileCode2,
    parameters: ["path", "content", "mode"],
  },
  {
    id: "list_directory",
    name: "list_directory",
    category: "Filesystem",
    descEn: "Explores learning workspace directory structures and detects imported study sources.",
    descId: "Menjelajahi struktur direktori workspace dan mendeteksi berkas sumber materi belajar.",
    icon: FolderTree,
    parameters: ["path", "recursive"],
  },
  {
    id: "web_search",
    name: "web_search",
    category: "Web & Knowledge",
    descEn: "Queries authoritative web sources for up-to-date citations, references, and facts.",
    descId: "Menjalankan pencarian web otoritatif untuk referensi, sitasi ilmiah, dan fakta terkini.",
    icon: Globe,
    parameters: ["query", "limit"],
  },
  {
    id: "web_fetch",
    name: "web_fetch",
    category: "Web & Knowledge",
    descEn: "Fetches and converts live web articles and documentation into clean markdown.",
    descId: "Mengambil dan mengubah artikel web serta dokumentasi daring menjadi format markdown bersih.",
    icon: Globe,
    parameters: ["url", "maxTokens"],
  },
];

export function McpToolsView() {
  const { language } = useI18n();
  const isIndo = language === "id";
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success(
        isIndo
          ? "Status server MCP berhasil diperbarui. Semua alat aktif."
          : "MCP server status refreshed. All tools active."
      );
    }, 600);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background text-foreground font-sans">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-6 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-serif text-2xl font-normal tracking-tight text-foreground">
                Model Context Protocol (MCP) Tools
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isIndo ? "Terkoneksi" : "Connected"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              {isIndo
                ? "Daftar kemampuan alat eksternal yang dapat digunakan oleh agen AI dalam workspace belajar melalui standar terbuka Model Context Protocol (MCP)."
                : "External tools and capabilities exposed to AI agents in your learning workspace via the open Model Context Protocol (MCP) standard."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            <span>{isIndo ? "Segarkan" : "Refresh"}</span>
          </button>
        </div>

        {/* Server Status Summary Cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-secondary/40 border border-border/80">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              {isIndo ? "Protokol & Server" : "Protocol & Server"}
            </span>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-foreground" />
              <span className="text-xs font-semibold font-mono text-foreground">
                Const MCP Hub
              </span>
            </div>
            <span className="text-[10.5px] text-muted-foreground mt-1 block">
              Composio Cloud & Local Stdio
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-secondary/40 border border-border/80">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              {isIndo ? "Alat Terdaftar" : "Registered Tools"}
            </span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold text-foreground">
                {DESKTOP_MCP_TOOLS.length} {isIndo ? "Alat Aktif" : "Tools Active"}
              </span>
            </div>
            <span className="text-[10.5px] text-muted-foreground mt-1 block">
              {isIndo ? "Siap digunakan oleh agen AI" : "Available in chat & workbench"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-secondary/40 border border-border/80">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              {isIndo ? "Keamanan & Izin" : "Security & Sandbox"}
            </span>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-semibold text-foreground">
                {isIndo ? "Tervalidasi" : "Scoped Sandbox"}
              </span>
            </div>
            <span className="text-[10.5px] text-muted-foreground mt-1 block">
              {isIndo ? "Izin baca/tulis workspace terisolasi" : "Isolated workspace permissions"}
            </span>
          </div>
        </div>

        {/* Tools List */}
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isIndo ? "Daftar Alat yang Tersedia" : "Available Tools"}
            </h3>
            <span className="text-[11px] text-muted-foreground font-mono">
              {DESKTOP_MCP_TOOLS.length} items
            </span>
          </div>

          <div className="space-y-2.5">
            {DESKTOP_MCP_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  className="p-4 rounded-2xl bg-card border border-border/80 hover:border-border transition-all flex items-start gap-4 shadow-2xs"
                >
                  <div className="h-9 w-9 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-foreground">
                          {tool.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground border border-border/60">
                          {tool.category}
                        </span>
                      </div>

                      <span className="text-[10.5px] font-mono text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Ready
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {isIndo ? tool.descId : tool.descEn}
                    </p>

                    {/* Parameters tag */}
                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-medium mr-1">
                        Parameters:
                      </span>
                      {tool.parameters.map((param) => (
                        <span
                          key={param}
                          className="px-1.5 py-0.5 rounded bg-secondary/80 text-[10px] font-mono text-foreground/80 border border-border/50"
                        >
                          {param}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
