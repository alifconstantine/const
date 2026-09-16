import React, { useState } from "react";
import {
  Share2,
  Maximize2,
  Minimize2,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  toast,
  cn,
} from "@const/ui";
import { useI18n } from "../../lib/i18n";
import { db } from "../../lib/db";
import { MindMapCanvas } from "../workspace/mind-map/mind-map-canvas";
import type { MindMapData } from "../workspace/mind-map/types";
import type { RightPaneTab } from "./types";

interface MindMapTabProps {
  tab: RightPaneTab;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function MindMapTab({
  tab,
  isFullscreen = false,
  onToggleFullscreen,
}: MindMapTabProps) {
  const { t } = useI18n();

  const data: MindMapData | null = tab.mindMapData || (tab as any).artifact ? (() => {
    try {
      if (tab.mindMapData) return tab.mindMapData;
      const art = (tab as any).artifact;
      if (art?.data?.root) return art.data;
      if (typeof art?.content === "string") {
        return JSON.parse(art.content);
      }
      return art?.content || null;
    } catch {
      return null;
    }
  })() : null;

  const [feedback, setFeedback] = useState<"good" | "bad" | null>(
    data?.feedback || null
  );

  const handleFeedback = async (val: "good" | "bad") => {
    const next = feedback === val ? null : val;
    setFeedback(next);
    if (data?.id) {
      try {
        const art = await db.artifacts.get(data.id);
        if (art && art.content) {
          const parsed = JSON.parse(art.content);
          parsed.feedback = next;
          await db.artifacts.update(data.id, {
            content: JSON.stringify(parsed),
          });
        }
      } catch (err) {
        console.error("Failed to update artifact feedback:", err);
      }
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success(t("copy") ? `${t("copy")}!` : "Tautan disalin");
    }
  };

  if (!data || !data.root) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-6 bg-[#161618]">
        <span>Data Peta Pikiran tidak ditemukan atau rusak.</span>
      </div>
    );
  }

  const sourceCount = data.sourceCount || (data.sourceIds ? data.sourceIds.length : 1);
  const sourceNames = data.sourceNames || [];

  return (
    <div className="w-full h-full flex flex-col bg-[#161618] text-[#d4d4d4] font-sans relative overflow-hidden select-none">
      {/* Top Header matching video reference */}
      <div className="px-5 py-3 border-b border-[#28282b] bg-[#1a1a1d] flex items-center justify-between shrink-0">
        {/* Left: Breadcrumbs & Title & Source Chip */}
        <div className="flex flex-col min-w-0 pr-4">
          <div className="text-[11px] font-medium text-[#888890] flex items-center gap-1.5 mb-0.5">
            <span>Studio</span>
            <span className="text-[#55555c]">&gt;</span>
            <span className="text-white/80">Aplikasi</span>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate">
              {data.title || tab.title}
            </h2>

            {/* Source badge chip */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="px-2.5 py-0.5 rounded-full bg-[#26262a] hover:bg-[#323236] text-[11px] font-medium text-[#b0b4be] border border-[#38383e] transition-colors cursor-pointer shrink-0"
                >
                  {sourceCount === 1
                    ? t("viewSourcesSingle") || "Lihat 1 sumber"
                    : t("viewSources", { count: sourceCount }) || `Lihat ${sourceCount} sumber`}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 bg-[#222225] border-[#36363a] text-white p-3 space-y-2">
                <div className="text-xs font-semibold text-white">Sumber yang Digunakan:</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {sourceNames.length > 0 ? (
                    sourceNames.map((name, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[#a5a5ad]">
                        <FileText className="w-3.5 h-3.5 text-[#888888] shrink-0" />
                        <span className="truncate">{name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#888888]">1 sumber dari notebook</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleShare}
            className="h-8 w-8 rounded-lg hover:bg-white/10 text-[#a0a0a8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Bagikan"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="h-8 w-8 rounded-lg hover:bg-white/10 text-[#a0a0a8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            className="h-8 w-8 rounded-lg hover:bg-white/10 text-[#a0a0a8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Menu Lainnya"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Mind Map Canvas */}
      <div className="flex-1 w-full min-h-0 relative">
        <MindMapCanvas root={data.root} title={data.title} />
      </div>

      {/* Footer with Thumbs Up / Down feedback matching video reference */}
      <div className="px-5 py-2.5 border-t border-[#252528] bg-[#18181b] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleFeedback("good")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border",
              feedback === "good"
                ? "bg-[#0066ff]/20 border-[#0066ff]/60 text-white"
                : "bg-transparent border-transparent text-[#888890] hover:text-white hover:bg-white/5"
            )}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>{t("goodContent") || "Konten bagus"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleFeedback("bad")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border",
              feedback === "bad"
                ? "bg-rose-500/20 border-rose-500/60 text-rose-300"
                : "bg-transparent border-transparent text-[#888890] hover:text-white hover:bg-white/5"
            )}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>{t("badContent") || "Konten buruk"}</span>
          </button>
        </div>

        <div className="text-[11px] text-[#6e6e76] font-mono">
          Interactive Canvas • Const Studio
        </div>
      </div>
    </div>
  );
}
