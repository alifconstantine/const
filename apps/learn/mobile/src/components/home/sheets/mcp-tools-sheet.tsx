import React from "react";
import { X, Cable, ShieldCheck, Terminal, Code2, FolderTree, Globe, FileCode2, CheckCircle2 } from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../../lib/i18n";

export interface McpToolItem {
  id: string;
  name: string;
  category: "Code Execution" | "Filesystem" | "Web & Knowledge";
  descEn: string;
  descId: string;
  icon: React.ElementType;
}

export const MCP_TOOLS_LIST: McpToolItem[] = [
  {
    id: "execute_code",
    name: "execute_code",
    category: "Code Execution",
    descEn: "Secure sandbox for executing Python and JavaScript computations.",
    descId: "Sandbox terisolasi untuk eksekusi komputasi Python dan JavaScript.",
    icon: Code2,
  },
  {
    id: "execute_terminal_command",
    name: "execute_terminal_command",
    category: "Code Execution",
    descEn: "Runs non-destructive terminal utilities and data analysis scripts.",
    descId: "Menjalankan perintah terminal utilitas dan skrip analisis data.",
    icon: Terminal,
  },
  {
    id: "get_file_content",
    name: "get_file_content",
    category: "Filesystem",
    descEn: "Inspects source files, notes, and local workspace artifacts.",
    descId: "Membaca berkas sumber, catatan, dan artefak workspace.",
    icon: FileCode2,
  },
  {
    id: "set_file_content",
    name: "set_file_content",
    category: "Filesystem",
    descEn: "Creates or modifies note drafts and generated study summaries.",
    descId: "Membuat atau memperbarui draf catatan dan rangkuman belajar.",
    icon: FileCode2,
  },
  {
    id: "list_directory",
    name: "list_directory",
    category: "Filesystem",
    descEn: "Explores files and directories in the current learning workspace.",
    descId: "Menjelajahi struktur direktori dan berkas pada workspace belajar.",
    icon: FolderTree,
  },
  {
    id: "web_search",
    name: "web_search",
    category: "Web & Knowledge",
    descEn: "Real-time web search for fresh learning citations and groundings.",
    descId: "Pencarian web real-time untuk referensi dan sitasi belajar terkini.",
    icon: Globe,
  },
  {
    id: "web_fetch",
    name: "web_fetch",
    category: "Web & Knowledge",
    descEn: "Fetches and parses public web documents and research articles.",
    descId: "Mengambil dan mengekstrak dokumen web publik dan artikel riset.",
    icon: Globe,
  },
];

interface McpToolsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function McpToolsSheet({ open, onClose }: McpToolsSheetProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200",
          open ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-card text-card-foreground border-t border-border rounded-t-[24px] flex flex-col will-change-transform font-sans overflow-hidden select-none transition-transform duration-300 ease-out safe-area-bottom",
          open ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="MCP Tools Status"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-secondary border border-border flex items-center justify-center">
              <Cable className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-foreground tracking-tight">
                  MCP Tools
                </h2>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9.5px] font-medium border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isIndo ? "Terkoneksi" : "Connected"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Composio Remote MCP Sandbox & Web Tools
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tools Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Server Info Card */}
          <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{isIndo ? "Protokol Server" : "Server Protocol"}</span>
              <span className="font-mono font-medium text-foreground">Model Context Protocol (MCP)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{isIndo ? "Transport" : "Transport Layer"}</span>
              <span className="font-mono text-muted-foreground">Composio Cloud SSE</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{isIndo ? "Alat Tersedia" : "Registered Tools"}</span>
              <span className="font-mono font-semibold text-foreground">{MCP_TOOLS_LIST.length} Tools</span>
            </div>
          </div>

          {/* List of Tools */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {isIndo ? "Daftar Alat Agen" : "Agent Tools List"}
            </h3>

            {MCP_TOOLS_LIST.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  className="p-3 rounded-2xl bg-secondary/20 border border-border/70 flex items-start gap-3"
                >
                  <div className="h-7 w-7 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-mono font-semibold text-foreground truncate">
                        {tool.name}
                      </span>
                      <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/50 shrink-0">
                        {tool.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {isIndo ? tool.descId : tool.descEn}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-secondary/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {isIndo ? "Semua alat siap digunakan" : "All tools ready"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium cursor-pointer hover:opacity-90 active:scale-95 transition-all"
          >
            {isIndo ? "Tutup" : "Close"}
          </button>
        </div>
      </div>
    </>
  );
}
