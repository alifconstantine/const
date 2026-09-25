import React, { useState } from "react";
import {
  X,
  Plus,
  Search,
  Globe,
  FileText,
  ChevronDown,
  FolderOpen,
  ArrowLeft,
  Trash2,
  BookOpen,
  HardDrive,
  Clipboard,
} from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, type LocalSource } from "@/lib/db";
import { useI18n } from "../../lib/i18n";
import { SourceIcon, getSourceCategoryLabel } from "./source-icon";
import { SourcePreviewDialog } from "./source-preview-dialog";

export interface SourcesSheetProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  learnId?: string;
  sourcesCount?: number;
  onOpenAddSource: () => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  webScope: string;
  onToggleWebScope: () => void;
  researchSpeed: string;
  onToggleResearchSpeed: () => void;
  onSearchWeb?: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SourcesSheet({
  open,
  onClose,
  onBack,
  learnId,
  sourcesCount: fallbackCount = 0,
  onOpenAddSource,
  searchQuery,
  onSearchQueryChange,
  webScope,
  onToggleWebScope,
  researchSpeed,
  onToggleResearchSpeed,
  onSearchWeb,
}: SourcesSheetProps) {
  const { t } = useI18n();
  const [selectedSourceForPreview, setSelectedSourceForPreview] =
    useState<LocalSource | null>(null);

  // Live Dexie query for sources
  const sources =
    useLiveQuery(
      () => {
        if (!learnId) return [];
        return db.sources
          .where("learnId")
          .equals(learnId)
          .reverse()
          .sortBy("createdAt");
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

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] transition-[opacity,visibility] duration-300 ease-out",
          open ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Panel from Left: Matches workspace sidebar geometry & position */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[340px] h-full bg-card text-card-foreground",
          "border-r border-border rounded-tr-[24px] rounded-br-[24px] flex flex-col will-change-transform font-sans overflow-hidden select-none",
          "transition-[transform,visibility] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          open
            ? "translate-x-0 visible pointer-events-auto shadow-2xl"
            : "-translate-x-[calc(100%+60px)] invisible pointer-events-none shadow-none"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Panel Sumber Belajar"
      >
        {/* Header - Seamless matching sidebar top bar */}
        <div className="h-14 px-3.5 border-b border-border flex items-center justify-between shrink-0 bg-secondary/40 rounded-tr-[24px]">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0 -ml-1"
                aria-label="Kembali ke Sidebar"
                title="Kembali ke Sidebar"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <FolderOpen className="h-4 w-4 text-foreground shrink-0" />
            )}
            <span className="text-sm font-semibold text-foreground tracking-tight truncate">
              {t("learningSources") || "Learning Sources"}
            </span>
            <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/70 shrink-0">
              {displayCount === 1
                ? t("sourcesCountSingle")
                : t("sourcesCount", { count: displayCount })}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Area with Clean Gap Spacing */}
        <ScrollArea className="flex-1" viewportClassName="p-3.5">
          <div className="flex flex-col gap-3">
            {/* "+ Add source" Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddSource();
              }}
              className="w-full h-10 px-3 rounded-xl border border-border hover:border-border/80 bg-foreground text-background hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>{t("addSource") || "Add source"}</span>
            </button>

            {/* Web Research Search Box */}
            <div className="w-full bg-secondary/50 rounded-2xl p-2.5 border border-border focus-within:border-foreground/30 transition-all text-left flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-0.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder={t("searchWebSources") || "Cari sumber web baru..."}
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none font-sans"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && onSearchWeb) {
                      onSearchWeb();
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchQueryChange("")}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-secondary transition-colors cursor-pointer shrink-0"
                    title="Clear"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={onToggleWebScope}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary hover:bg-secondary/80 text-[10px] font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/70"
                  >
                    <Globe className="h-2.5 w-2.5" />
                    <span>{webScope === "Web" ? t("webScopeWeb") : t("webScopeJournal")}</span>
                    <ChevronDown className="h-2 w-2 opacity-60" />
                  </button>

                  <button
                    type="button"
                    onClick={onToggleResearchSpeed}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary hover:bg-secondary/80 text-[10px] font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/70"
                  >
                    <span>
                      {researchSpeed === "Fast Research" ? t("speedFast") : t("speedDeep")}
                    </span>
                    <ChevronDown className="h-2 w-2 opacity-60" />
                  </button>
                </div>

                {onSearchWeb && (
                  <button
                    type="button"
                    onClick={onSearchWeb}
                    className="h-6 w-6 rounded-lg bg-foreground text-background hover:opacity-90 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs"
                    aria-label={t("search")}
                  >
                    <Search className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Sources List or Empty State */}
            {sources.length > 0 ? (
              <div className="flex flex-col gap-2 pt-0.5">
                {/* Header selection info & bulk toggle */}
                <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                  <span>
                    {t("carriedSourcesHeader", {
                      carried: carriedCount,
                      total: sources.length,
                    }) || `${carriedCount} of ${sources.length} sources active in chat`}
                  </span>
                  {learnId && (
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = carriedCount === sources.length;
                        localDb.setAllSourcesInChat(learnId, !allSelected);
                      }}
                      className="text-[10.5px] text-foreground hover:underline cursor-pointer font-medium"
                    >
                      {carriedCount === sources.length
                        ? t("deselectAll") || "Deselect all"
                        : t("selectAll") || "Select all"}
                    </button>
                  )}
                </div>

                {/* List of items */}
                <div className="flex flex-col gap-2">
                  {filteredSources.map((source) => {
                    const isCarried = source.includedInChat !== false;
                    return (
                      <div
                        key={source.id}
                        className={cn(
                          "group relative flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer",
                          isCarried
                            ? "bg-card hover:bg-secondary/60 border-border text-foreground shadow-2xs"
                            : "bg-secondary/30 hover:bg-secondary/60 border-border/60 text-muted-foreground opacity-75"
                        )}
                        onClick={() => {
                          localDb.toggleSourceInChat(source.id, !isCarried);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isCarried}
                          onChange={() => {}}
                          className="rounded border-border bg-background h-3.5 w-3.5 text-foreground focus:ring-0 cursor-pointer pointer-events-none shrink-0"
                        />

                        <SourceIcon source={source} size="sm" />

                        <div
                          className="flex-1 min-w-0 pr-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSourceForPreview(source);
                          }}
                        >
                          <p
                            className="text-xs font-medium text-foreground truncate leading-tight hover:underline"
                            title={source.title}
                          >
                            {source.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-sans tabular-nums mt-0.5 truncate flex items-center gap-1">
                            <span className="capitalize font-medium text-foreground/80">
                              {getSourceCategoryLabel(source)}
                            </span>
                            {source.size ? `• ${formatFileSize(source.size)}` : null}
                            {source.subpagesCount && source.subpagesCount > 1
                              ? `• ${source.subpagesCount} pages`
                              : null}
                          </p>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            localDb.deleteSource(source.id);
                          }}
                          className="absolute right-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1 rounded-md transition-colors cursor-pointer"
                          title={t("removeSource") || "Hapus sumber"}
                          aria-label={t("removeSource") || "Hapus sumber"}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Empty State */
              <div
                onClick={() => {
                  onClose();
                  onOpenAddSource();
                }}
                className="flex-1 min-h-[190px] flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-border/80 bg-card/40 hover:bg-secondary/40 transition-all cursor-pointer group"
              >
                <div className="h-11 w-11 rounded-2xl bg-secondary border border-border/70 flex items-center justify-center text-muted-foreground mb-3 group-hover:scale-105 group-hover:text-foreground transition-all shadow-2xs">
                  <FileText className="h-5 w-5 stroke-[1.5] text-foreground group-hover:text-foreground transition-colors" />
                </div>
                <h3 className="text-xs font-semibold text-foreground mb-1.5 tracking-tight">
                  {t("emptySourcesTitle") || "Belum ada sumber"}
                </h3>
                <p className="text-[10.5px] text-muted-foreground leading-relaxed max-w-[210px] mb-3.5">
                  {t("emptySourcesDescription") ||
                    "Tambahkan dokumen, link web, atau teks untuk memperkaya pemahaman AI."}
                </p>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary group-hover:bg-secondary/80 border border-border text-[11px] font-medium text-foreground transition-all active:scale-95 shadow-2xs">
                  <Plus className="h-3 w-3" />
                  <span>{t("addFirstSource") || "Tambah sumber pertama"}</span>
                </span>
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Source Detail Modal (Mobile) */}
      <SourcePreviewDialog
        source={selectedSourceForPreview}
        open={!!selectedSourceForPreview}
        onOpenChange={(open) => {
          if (!open) setSelectedSourceForPreview(null);
        }}
      />
    </>
  );
}
