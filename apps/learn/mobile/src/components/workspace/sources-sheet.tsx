import React from "react";
import {
  X,
  Plus,
  Search,
  Globe,
  FileText,
  ChevronDown,
  FolderOpen,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";

export interface SourcesSheetProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
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
  onBack,
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

      {/* Slide-over Panel from Left: Matches workspace sidebar geometry & position */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[80vw] max-w-[310px] h-full bg-[#1c1c1e] text-[#d4d4d4]",
          "border-r border-[#333336] rounded-tr-[24px] rounded-br-[24px] shadow-2xl flex flex-col will-change-transform font-sans overflow-hidden select-none",
          "transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "-translate-x-full"
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
              {sourcesCount === 1
                ? t("sourcesCountSingle")
                : t("sourcesCount", { count: sourcesCount })}
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

        {/* Content Area */}
        <div className="flex-1 px-3 pt-2.5 pb-3 flex flex-col gap-2.5 min-h-0 overflow-y-auto">
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

          {/* Sources List / Empty State Dropzone: Stretches gracefully to fill lower area */}
          <div
            onClick={() => {
              onClose();
              onOpenAddSource();
            }}
            className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-dashed border-[#333336] bg-[#222225]/40 hover:bg-[#222225]/65 transition-all cursor-pointer group my-0.5"
          >
            <div className="h-10 w-10 rounded-2xl bg-[#28282b] border border-[#383838] flex items-center justify-center text-[#969696] mb-2.5 group-hover:scale-105 group-hover:text-white transition-all shadow-2xs">
              <FileText className="h-4.5 w-4.5 stroke-[1.5] text-[#d4d4d4] group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xs font-semibold text-white mb-1 tracking-tight">
              {t("emptySourcesTitle") || "Belum ada sumber"}
            </h3>
            <p className="text-[10.5px] text-[#969696] leading-relaxed max-w-[200px] mb-3">
              {t("emptySourcesDescription") || "Tambahkan dokumen, link web, atau teks untuk memperkaya pemahaman AI."}
            </p>
            <span
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#2b2b2e] group-hover:bg-[#343438] border border-[#3c3c40] text-[11px] font-medium text-white transition-all active:scale-95 shadow-2xs"
            >
              <Plus className="h-3 w-3" />
              <span>{t("addFirstSource") || "Tambah sumber pertama"}</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
