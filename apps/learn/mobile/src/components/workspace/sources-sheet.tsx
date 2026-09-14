import React from "react";
import {
  X,
  Plus,
  Search,
  Globe,
  FileText,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
import { useI18n } from "../../lib/i18n";

export interface SourcesSheetProps {
  open: boolean;
  onClose: () => void;
  sourcesCount: number;
  onOpenAddSource: () => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  webScope: string;
  onToggleWebScope: () => void;
  researchSpeed: string;
  onToggleResearchSpeed: () => void;
  onSearchWeb?: () => void;
}

export function SourcesSheet({
  open,
  onClose,
  sourcesCount,
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

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] transition-opacity duration-300 ease-out",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Panel from Right: Sized to match workspace sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-[80vw] max-w-[310px] h-full bg-[#1c1c1e] text-[#d4d4d4]",
          "border-l border-[#333336] rounded-tl-[24px] rounded-bl-[24px] shadow-2xl flex flex-col will-change-transform font-sans overflow-hidden select-none",
          "transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Panel Sumber Belajar"
      >
        {/* Header */}
        <div className="h-14 px-4 border-b border-[#2d2d30] flex items-center justify-between shrink-0 bg-[#202022] rounded-tl-[24px]">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="h-4 w-4 text-white" />
            <span className="text-[14px] font-semibold text-white">
              {t("learningSources") || "Learning Sources"}
            </span>
            <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-full bg-[#252528] text-[#969696] border border-[#383838]">
              {sourcesCount === 1
                ? t("sourcesCountSingle")
                : t("sourcesCount", { count: sourcesCount })}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-white/10 text-[#969696] hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1 p-3.5 space-y-3.5" viewportClassName="space-y-3.5">
          {/* "+ Add source" Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddSource();
            }}
            className="w-full py-2.5 px-3 rounded-xl border border-[#383838] hover:border-[#5d5d5d] bg-[#28282b] hover:bg-[#333336] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-99"
          >
            <Plus className="h-4 w-4 text-white" />
            <span>{t("addSource") || "Add source"}</span>
          </button>

          {/* Web Research Search Box */}
          <div className="w-full bg-[#242426] rounded-2xl p-3 border border-[#333336] focus-within:border-[#555555] transition-all text-left space-y-2.5">
            <div className="flex items-center gap-2">
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
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#333336]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleWebScope}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-[10.5px] text-[#969696] hover:text-white transition-colors cursor-pointer border border-[#383838]"
                >
                  <Globe className="h-2.5 w-2.5" />
                  <span>{webScope === "Web" ? t("webScopeWeb") : t("webScopeJournal")}</span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>

                <button
                  type="button"
                  onClick={onToggleResearchSpeed}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-[10.5px] text-[#969696] hover:text-white transition-colors cursor-pointer border border-[#383838]"
                >
                  <Search className="h-2.5 w-2.5" />
                  <span>
                    {researchSpeed === "Fast Research" ? t("speedFast") : t("speedDeep")}
                  </span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>
              </div>

              {onSearchWeb && (
                <button
                  type="button"
                  onClick={onSearchWeb}
                  className="h-6 w-6 rounded-lg bg-white hover:bg-neutral-200 text-black flex items-center justify-center transition-colors cursor-pointer"
                  aria-label={t("search")}
                >
                  <Search className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Sources List / Empty State */}
          <div className="flex flex-col items-center justify-center text-center p-6 min-h-[200px] border border-[#2e2e2e] rounded-2xl bg-[#1b1b1b]">
            <div className="h-10 w-10 rounded-2xl bg-[#222222] border border-[#383838] flex items-center justify-center text-[#969696] mb-3">
              <FileText className="h-5 w-5 stroke-[1.5] text-white" />
            </div>
            <h3 className="text-xs font-semibold text-white mb-1">
              {t("emptySourcesTitle") || "Belum ada sumber"}
            </h3>
            <p className="text-[11px] text-[#969696] leading-relaxed max-w-[220px] mb-3">
              {t("emptySourcesDescription") || "Tambahkan dokumen, link web, atau teks untuk memperkaya pemahaman AI."}
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddSource();
              }}
              className="text-xs text-white hover:underline transition-colors cursor-pointer font-medium"
            >
              + {t("addFirstSource") || "Tambah sumber pertama"}
            </button>
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}
