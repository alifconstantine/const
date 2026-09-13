import React, { useState } from "react";
import {
  Plus,
  Search,
  Globe,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
} from "lucide-react";

interface SourcesPanelProps {
  sourcesCount?: number;
  onAddSource: () => void;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}

export function SourcesPanel({
  sourcesCount = 0,
  onAddSource,
  onToggleCollapse,
  isCollapsed = false,
}: SourcesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState("Web");
  const [researchSpeed, setResearchSpeed] = useState("Riset Cepat");

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
    <aside className="w-[300px] xl:w-[320px] h-full flex flex-col bg-card rounded-2xl border border-border/50 text-foreground p-3.5 sm:p-4 shrink-0 select-none overflow-y-auto shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Sumber</span>
          {sourcesCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
              {sourcesCount}
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
        className="w-full py-2 px-3 rounded-full border border-border hover:border-border/80 bg-muted/50 hover:bg-muted text-xs font-medium text-foreground flex items-center justify-center gap-1.5 transition-all cursor-pointer mb-3"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Tambahkan sumber</span>
      </button>

      {/* Search & Web Research Box */}
      <div className="w-full bg-muted/60 rounded-2xl p-2.5 border border-border/60 focus-within:border-border transition-all text-left mb-4">
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

      {/* Empty State (Zero Dummy Data) */}
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
    </aside>
  );
}
