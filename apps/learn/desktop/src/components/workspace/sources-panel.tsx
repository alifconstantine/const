import React, { useState } from "react";
import {
  Plus,
  Search,
  Globe,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Trash2,
  BookOpen,
  HardDrive,
  Clipboard,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, type LocalSource } from "@/lib/db";

interface SourcesPanelProps {
  learnId?: string;
  sourcesCount?: number;
  onAddSource: () => void;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSourceIcon(type: LocalSource["type"]) {
  switch (type) {
    case "url":
      return <Globe className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    case "book":
      return <BookOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    case "drive":
      return <HardDrive className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
    case "text":
      return <Clipboard className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
    case "file":
    default:
      return <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

export function SourcesPanel({
  learnId,
  sourcesCount: fallbackCount = 0,
  onAddSource,
  onToggleCollapse,
  isCollapsed = false,
}: SourcesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState("Web");
  const [researchSpeed, setResearchSpeed] = useState("Riset Cepat");

  // Query sources live from Dexie database
  const sources =
    useLiveQuery(
      () => {
        if (!learnId) return [];
        return db.sources.where("learnId").equals(learnId).reverse().sortBy("createdAt");
      },
      [learnId]
    ) || [];

  const displayCount = sources.length > 0 ? sources.length : fallbackCount;
  const carriedCount = sources.filter((s) => s.includedInChat !== false).length;

  const filteredSources = searchQuery.trim()
    ? sources.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : sources;

  if (isCollapsed) {
    return (
      <div className="w-12 h-full flex flex-col items-center py-3 bg-card rounded-2xl border border-border/50 text-muted-foreground shrink-0 select-none shadow-xs">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Buka Panel Sumber"
          aria-label="Buka Sumber"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onAddSource}
          className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer mt-1"
          title="Tambahkan sumber"
          aria-label="Tambahkan sumber"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-[300px] xl:w-[320px] h-full flex flex-col bg-card rounded-2xl border border-border/50 text-foreground p-3.5 sm:p-4 shrink-0 select-none overflow-hidden shadow-xs font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Sumber</span>
          {displayCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
              {displayCount}
            </span>
          )}
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="h-7 w-7 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Sembunyikan Panel"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* "+ Tambahkan sumber" Button */}
      <button
        type="button"
        onClick={onAddSource}
        className="w-full py-2 px-3 rounded-full border border-border hover:border-border/80 bg-muted/50 hover:bg-muted text-xs font-medium text-foreground flex items-center justify-center gap-1.5 transition-all cursor-pointer mb-3 shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Tambahkan sumber</span>
      </button>

      {/* Search & Web Research Box */}
      <div className="w-full bg-muted/60 rounded-2xl p-2.5 border border-border/60 focus-within:border-border transition-all text-left mb-3 shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Telusuri sumber baru di web"
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none px-1 py-1"
        />
        <div className="flex items-center justify-between mt-2 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWebScope(webScope === "Web" ? "Jurnal" : "Web")}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-background/60 hover:bg-background text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40"
            >
              <Globe className="h-2.5 w-2.5" />
              <span>{webScope}</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </button>

            <button
              type="button"
              onClick={() =>
                setResearchSpeed(
                  researchSpeed === "Riset Cepat" ? "Riset Mendalam" : "Riset Cepat"
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-background/60 hover:bg-background text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40"
            >
              <Search className="h-2.5 w-2.5" />
              <span>{researchSpeed}</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </button>
          </div>

          <button
            type="button"
            className="h-6 w-6 rounded-full bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border/40"
            aria-label="Cari"
          >
            <Search className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Sources List or Empty State */}
      {sources.length > 0 ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Subheader: Selection info & Bulk toggle */}
          <div className="flex items-center justify-between px-1 pb-2 mb-1.5 border-b border-border/40 text-[11px] text-muted-foreground shrink-0">
            <span>
              Dibawa: <strong className="text-foreground font-mono">{carriedCount}</strong>/{sources.length}
            </span>
            {learnId && (
              <button
                type="button"
                onClick={() => {
                  const allSelected = carriedCount === sources.length;
                  localDb.setAllSourcesInChat(learnId, !allSelected);
                }}
                className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
              >
                {carriedCount === sources.length ? "Batal Semua" : "Pilih Semua"}
              </button>
            )}
          </div>

          {/* Scrollable list of source cards */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {filteredSources.map((source) => {
              const isCarried = source.includedInChat !== false;
              return (
                <div
                  key={source.id}
                  className={`group relative flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                    isCarried
                      ? "bg-secondary/60 hover:bg-secondary border-border/70 text-foreground"
                      : "bg-muted/20 hover:bg-muted/40 border-border/30 text-muted-foreground opacity-70 hover:opacity-100"
                  }`}
                  onClick={() => {
                    localDb.toggleSourceInChat(source.id, !isCarried);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isCarried}
                    onChange={() => {}}
                    className="rounded border-border h-3.5 w-3.5 text-primary focus:ring-0 cursor-pointer pointer-events-none shrink-0"
                  />

                  <div className="shrink-0">{getSourceIcon(source.type)}</div>

                  <div className="flex-1 min-w-0 pr-6">
                    <p
                      className="text-xs font-medium text-foreground truncate leading-tight"
                      title={source.title}
                    >
                      {source.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5 truncate flex items-center gap-1">
                      <span className="capitalize">{source.type}</span>
                      {source.size ? `• ${formatFileSize(source.size)}` : null}
                    </p>
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      localDb.deleteSource(source.id);
                    }}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 h-6 w-6 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex items-center justify-center transition-all cursor-pointer"
                    title="Hapus Sumber"
                    aria-label="Hapus Sumber"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State (Zero Dummy Data) */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 min-h-[220px]">
          <div className="h-10 w-10 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-center text-muted-foreground/60 mb-3">
            <FileText className="h-5 w-5 stroke-[1.5]" />
          </div>
          <h3 className="text-xs font-medium text-foreground mb-1">
            Sumber yang telah disimpan akan muncul di sini
          </h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[240px] mb-3">
            Tambahkan file, situs, atau lainnya. Kemudian, ajukan pertanyaan atau buat sesuatu berdasarkan sumber ini.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Lepaskan file di sini atau{" "}
            <button
              type="button"
              onClick={onAddSource}
              className="text-foreground underline underline-offset-2 hover:text-primary transition-colors cursor-pointer"
            >
              tambahkan sumber
            </button>
          </p>
        </div>
      )}
    </aside>
  );
}
