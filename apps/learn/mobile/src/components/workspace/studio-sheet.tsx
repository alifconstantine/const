import React from "react";
import {
  X,
  LayoutGrid,
  ChevronRight,
  Package,
  FileText,
  Download,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalArtifact } from "../../lib/db";

export interface StudioToolItem {
  id: string;
  name: string;
  icon: React.ElementType;
  iconColor: string;
  textColor?: string;
  cardBg: string;
  borderColor: string;
  hoverBg: string;
  hoverBorder: string;
  hasBadge?: boolean;
}

export interface StudioSheetProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  tools: StudioToolItem[];
  toolNameMap: Record<string, string>;
  artifacts?: LocalArtifact[];
  onSelectTool: (toolId: string, toolTitle: string) => void;
  onDownloadArtifact: (art: LocalArtifact) => void;
}

export function StudioSheet({
  open,
  onClose,
  onBack,
  tools,
  toolNameMap,
  artifacts,
  onSelectTool,
  onDownloadArtifact,
}: StudioSheetProps) {
  const { t } = useI18n();

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
          "fixed inset-y-0 left-0 z-50 w-[80vw] max-w-[310px] h-full bg-[#1c1c1e] text-[#d4d4d4]",
          "border-r border-[#333336] rounded-tr-[24px] rounded-br-[24px] flex flex-col will-change-transform font-sans overflow-hidden select-none",
          "transition-[transform,visibility] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          open
            ? "translate-x-0 visible pointer-events-auto shadow-2xl"
            : "-translate-x-[calc(100%+60px)] invisible pointer-events-none shadow-none"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Panel Studio & Tools"
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
              <LayoutGrid className="h-4 w-4 text-white shrink-0" />
            )}
            <span className="text-sm font-semibold text-white tracking-tight truncate">
              {t("studioTools") || "Studio & Tools"}
            </span>
            <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-full bg-[#252528] text-[#969696] border border-[#383838] shrink-0">
              {tools.length} tools
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
        <div className="flex-1 px-3 pt-2.5 pb-3 flex flex-col gap-3 min-h-0 overflow-y-auto">
          {/* Section: 8 Tools 2-Column Grid */}
          <div className="space-y-2">
            <div className="text-[11px] font-sans uppercase tracking-wider font-semibold text-[#888888] px-0.5">
              {t("studioTitle") || "Alat Interaktif"}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const toolTitle = toolNameMap[tool.id] || tool.name;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectTool(tool.id, toolTitle);
                    }}
                    className={`p-2.5 rounded-2xl border ${tool.cardBg} ${tool.borderColor} ${tool.hoverBg} ${tool.hoverBorder} transition-all flex flex-col justify-between min-h-[82px] text-left cursor-pointer active:scale-[0.98] shadow-xs group`}
                  >
                    {/* Top Row: Icon + Badge on left, Chevron on right */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 ${tool.iconColor} shrink-0`} />
                        {tool.hasBadge && (
                          <span className="bg-[#ededed] text-[#141414] text-[8.5px] font-sans font-bold px-1.5 py-0.5 rounded-full leading-none shadow-2xs">
                            {t("badgeNew") || "BARU"}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-[#888888]/40 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>

                    {/* Bottom Row: Tool Title */}
                    <span
                      className={`text-[11.5px] font-medium ${
                        tool.textColor || "text-[#ffffff]"
                      } tracking-tight leading-snug line-clamp-2 mt-auto pt-1`}
                    >
                      {toolTitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Artifacts / Downloads */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-white">
                {t("artifacts") || "Hasil Artefak & Unduhan"}
              </span>
              {artifacts && artifacts.length > 0 && (
                <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-full bg-[#252528] border border-[#383838] text-[#969696]">
                  {artifacts.length === 1
                    ? t("filesCountSingle")
                    : t("filesCount", { count: artifacts.length })}
                </span>
              )}
            </div>

            {artifacts && artifacts.length > 0 ? (
              <div className="space-y-2">
                {artifacts.map((art) => (
                  <div
                    key={art.id}
                    className="p-2.5 rounded-xl bg-[#242426] border border-[#383838] hover:border-[#4d4d52] flex items-center justify-between gap-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {art.isZip ? (
                        <div className="h-8 w-8 rounded-lg bg-[#1c1c1e] text-[#d4d4d4] border border-[#333336] flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-[#1c1c1e] text-[#d4d4d4] border border-[#333336] flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          {art.title}
                        </div>
                        <div className="text-[10px] text-[#969696]">
                          {art.isZip ? "ZIP Archive / Folder" : art.type}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDownloadArtifact(art)}
                      className="h-7 px-2 rounded-lg bg-[#2b2b2e] hover:bg-[#38383c] text-white text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer border border-[#38383c] shrink-0 active:scale-95"
                    >
                      <Download className="h-3 w-3" />
                      <span>{t("download") || "Unduh"}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-dashed border-[#333336] bg-[#222225]/40 min-h-[130px]">
                <div className="h-9 w-9 rounded-2xl bg-[#28282b] border border-[#383838] flex items-center justify-center text-[#969696] mb-2">
                  <Layers className="h-4 w-4 stroke-[1.5] text-[#d4d4d4]" />
                </div>
                <h3 className="text-xs font-medium text-white mb-1">
                  {t("noArtifactsSaved") || "Belum ada artefak tersimpan"}
                </h3>
                <p className="text-[10.5px] text-[#969696] leading-relaxed max-w-[220px]">
                  {t("noArtifactsSavedDesc") || "Dokumen, ringkasan audio, atau modul yang dibuat akan otomatis tersimpan di sini."}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
