import React from "react";
import {
  X,
  LayoutGrid,
  ChevronRight,
  Package,
  FileText,
  Download,
  Layers,
} from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
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
  tools: StudioToolItem[];
  toolNameMap: Record<string, string>;
  artifacts?: LocalArtifact[];
  onSelectTool: (toolId: string, toolTitle: string) => void;
  onDownloadArtifact: (art: LocalArtifact) => void;
}

export function StudioSheet({
  open,
  onClose,
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
        aria-label="Panel Studio & Tools"
      >
        {/* Header */}
        <div className="h-14 px-4 border-b border-[#2d2d30] flex items-center justify-between shrink-0 bg-[#202022] rounded-tl-[24px]">
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="h-4 w-4 text-white" />
            <span className="text-[14px] font-semibold text-white">
              {t("studioTools") || "Studio & Tools"}
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
        <ScrollArea className="flex-1 p-4 space-y-5" viewportClassName="space-y-5">
          {/* Section: 8 Tools 2-Column Grid */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#888888]">
              {t("studioTitle") || "Alat Interaktif"}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
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
                    className={`p-3 rounded-2xl border ${tool.cardBg} ${tool.borderColor} ${tool.hoverBg} ${tool.hoverBorder} transition-all flex flex-col justify-between h-[88px] text-left cursor-pointer active:scale-98 shadow-xs`}
                  >
                    {/* Top Row: Icon + Badge on left, Chevron on right */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 ${tool.iconColor} shrink-0`} />
                        {tool.hasBadge && (
                          <span className="bg-[#ededed] text-[#141414] text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-2xs">
                            {t("badgeNew") || "BARU"}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-[#888888]/60 shrink-0" />
                    </div>

                    {/* Bottom Row: Tool Title */}
                    <span
                      className={`text-xs font-medium ${
                        tool.textColor || "text-[#ffffff]"
                      } tracking-tight leading-snug line-clamp-2 mt-auto`}
                    >
                      {toolTitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Artifacts / Downloads */}
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                {t("artifacts") || "Hasil Artefak & Unduhan"}
              </span>
              {artifacts && artifacts.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#222222] border border-[#383838] font-mono text-[#969696]">
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
                    className="p-3 rounded-xl bg-[#262628] border border-[#383838] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {art.isZip ? (
                        <div className="h-8 w-8 rounded-lg bg-[#242426] text-[#d4d4d4] border border-[#333336] flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-[#242426] text-[#d4d4d4] border border-[#333336] flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#d4d4d4] truncate">
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
                      className="h-8 px-3 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-[#383838] shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{t("download") || "Unduh"}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-[#2e2e2e] bg-[#1b1b1b] min-h-[140px]">
                <div className="h-10 w-10 rounded-xl bg-[#222222] border border-[#383838] flex items-center justify-center text-[#969696] mb-2.5">
                  <Layers className="h-4 w-4 stroke-[1.5]" />
                </div>
                <h3 className="text-xs font-medium text-white mb-1">
                  {t("noArtifactsSaved") || "Belum ada artefak tersimpan"}
                </h3>
                <p className="text-[11px] text-[#969696] leading-relaxed max-w-[240px]">
                  {t("noArtifactsSavedDesc") || "Dokumen, ringkasan audio, atau modul yang dibuat akan otomatis tersimpan di sini."}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}
