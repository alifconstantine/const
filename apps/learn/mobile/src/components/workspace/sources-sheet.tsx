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
          "fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[340px] h-full bg-[#1c1c1e] text-[#d4d4d4]",
          "border-r border-[#333336] rounded-tr-[24px] rounded-br-[24px] flex flex-col will-change-transform font-sans overflow-hidden select-none",
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
        <div className="h-14 px-3.5 border-b border-[#2d2d30] flex items-center justify-between shrink-0 bg-[#202022] rounded-tr-[24px]">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="h-8 w-8 rounded-full hover:bg-white/10 text-[#969696] hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0 -ml-1"
                aria-label="Kembali ke Sidebar"
                title="Kembali ke Sidebar"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <FolderOpen className="h-4 w-4 text-white shrink-0" />
            )}
            <span className="text-sm font-semibold text-white tracking-tight truncate">
              {t("learningSources") || "Learning Sources"}
            </span>
            <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-full bg-[#252528] text-[#969696] border border-[#383838] shrink-0">
              {displayCount === 1
                ? t("sourcesCountSingle")
                : t("sourcesCount", { count: displayCount })}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-white/10 text-[#969696] hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
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
              className="w-full h-10 px-3 rounded-xl border border-[#383838] hover:border-[#525256] bg-[#262629] hover:bg-[#323236] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] shrink-0"
            >
              <Plus className="h-4 w-4 text-white" />
              <span>{t("addSource") || "Add source"}</span>
            </button>

            {/* Web Research Search Box */}
            <div className="w-full bg-[#232326] rounded-2xl p-2.5 border border-[#333336] focus-within:border-[#4d4d52] transition-all text-left flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-0.5">
                <Search className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder={t("searchWebSources") || "Cari sumber web baru..."}
                  className="w-full bg-transparent text-xs text-white placeholder:text-[#666666] outline-none font-sans"
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
                    className="text-[#888888] hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    title="Clear"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-[#2e2e32]">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={onToggleWebScope}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#2b2b2e] hover:bg-[#38383c] text-[10px] font-sans text-[#a0a0a0] hover:text-white transition-colors cursor-pointer border border-[#38383c]"
                  >
                    <Globe className="h-2.5 w-2.5" />
                    <span>{webScope === "Web" ? t("webScopeWeb") : t("webScopeJournal")}</span>
                    <ChevronDown className="h-2 w-2 opacity-60" />
                  </button>

                  <button
                    type="button"
                    onClick={onToggleResearchSpeed}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#2b2b2e] hover:bg-[#38383c] text-[10px] font-sans text-[#a0a0a0] hover:text-white transition-colors cursor-pointer border border-[#38383c]"
                  >
                    <Search className="h-2.5 w-2.5" />
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
                    className="h-6 w-6 rounded-lg bg-white/95 hover:bg-white text-black flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs"
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
                <div className="flex items-center justify-between px-1 text-[11px] text-[#969696]">
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
                      className="text-[10.5px] text-white hover:underline cursor-pointer font-medium"
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
                            ? "bg-[#252528] hover:bg-[#2c2c30] border-[#38383a] text-white"
                            : "bg-[#1f1f21]/60 hover:bg-[#252528] border-[#2c2c2f] text-[#888888] opacity-75"
                        )}
                        onClick={() => {
                          localDb.toggleSourceInChat(source.id, !isCarried);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isCarried}
                          onChange={() => {}}
                          className="rounded border-[#444446] bg-[#1a1a1c] h-3.5 w-3.5 text-white focus:ring-0 cursor-pointer pointer-events-none shrink-0 accent-white"
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
                            className="text-xs font-medium text-white truncate leading-tight hover:underline"
                            title={source.title}
                          >
                            {source.title}
                          </p>
                          <p className="text-[10px] text-[#888888] font-mono mt-0.5 truncate flex items-center gap-1">
                            <span className="capitalize font-medium text-[#a1a1aa]">
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
                          className="absolute right-2 text-[#777777] hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
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
                className="flex-1 min-h-[190px] flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-[#333336] bg-[#222225]/40 hover:bg-[#222225]/65 transition-all cursor-pointer group"
              >
                <div className="h-11 w-11 rounded-2xl bg-[#28282b] border border-[#383838] flex items-center justify-center text-[#969696] mb-3 group-hover:scale-105 group-hover:text-white transition-all shadow-2xs">
                  <FileText className="h-5 w-5 stroke-[1.5] text-[#d4d4d4] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xs font-semibold text-white mb-1.5 tracking-tight">
                  {t("emptySourcesTitle") || "Belum ada sumber"}
                </h3>
                <p className="text-[10.5px] text-[#969696] leading-relaxed max-w-[210px] mb-3.5">
                  {t("emptySourcesDescription") ||
                    "Tambahkan dokumen, link web, atau teks untuk memperkaya pemahaman AI."}
                </p>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#2b2b2e] group-hover:bg-[#343438] border border-[#3c3c40] text-[11px] font-medium text-white transition-all active:scale-95 shadow-2xs">
                  <Plus className="h-3 w-3" />
                  <span>{t("addFirstSource") || "Tambah sumber pertama"}</span>
                </span>
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Source Detail Modal (Mobile) */}
      {selectedSourceForPreview && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setSelectedSourceForPreview(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] bg-[#1c1c1e] border border-[#333336] rounded-2xl p-4 shadow-2xl flex flex-col text-left font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#2d2d30]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <SourceIcon source={selectedSourceForPreview} size="md" />
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#252528] text-[#969696] border border-[#383838]">
                    {getSourceCategoryLabel(selectedSourceForPreview)}
                  </span>
                  {selectedSourceForPreview.subpagesCount &&
                  selectedSourceForPreview.subpagesCount > 1 ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {selectedSourceForPreview.subpagesCount} pages
                    </span>
                  ) : null}
                </div>
                <h3 className="text-sm font-semibold text-white truncate">
                  {selectedSourceForPreview.title}
                </h3>
                {selectedSourceForPreview.url && (
                  <a
                    href={selectedSourceForPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline truncate block mt-0.5"
                  >
                    {selectedSourceForPreview.url}
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedSourceForPreview(null)}
                className="h-7 w-7 rounded-full bg-[#252528] hover:bg-[#333336] text-[#969696] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Extracted Text Content */}
            <div className="flex-1 overflow-y-auto mt-3 pr-1">
              <div className="flex items-center justify-between text-[11px] text-[#888888] mb-2">
                <span>Extracted Content & Ground Truth:</span>
                <span>
                  {selectedSourceForPreview.content
                    ? `${selectedSourceForPreview.content.length.toLocaleString()} characters`
                    : "No text cached"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#141416] border border-[#28282b] text-[11px] font-mono text-[#d4d4d4] whitespace-pre-wrap leading-relaxed select-text max-h-[50vh] overflow-y-auto">
                {selectedSourceForPreview.content ||
                  "[Content is not cached locally. This source was added via link.]"}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
