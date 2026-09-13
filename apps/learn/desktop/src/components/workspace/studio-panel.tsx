import React from "react";
import {
  PanelRight,
  AudioLines,
  Presentation,
  Video,
  GitFork,
  FileText,
  HelpCircle,
  Award,
  BarChart3,
  Table2,
  ChevronRight,
  Plus,
  SquarePen,
  PenTool,
} from "lucide-react";

import { useI18n, type TranslationKey } from "../../lib/i18n";

interface StudioTool {
  id: string;
  translationKey: TranslationKey;
  icon: React.ElementType;
  iconColor: string;
}

const STUDIO_TOOLS: StudioTool[] = [
  { id: "audio_summary", translationKey: "toolsAudioSummary", icon: AudioLines, iconColor: "text-indigo-400" },
  { id: "slides", translationKey: "toolsSlides", icon: Presentation, iconColor: "text-amber-400" },
  { id: "video_summary", translationKey: "toolsVideo", icon: Video, iconColor: "text-emerald-400" },
  { id: "mind_map", translationKey: "toolsMindMap", icon: GitFork, iconColor: "text-purple-400" },
  { id: "report", translationKey: "toolsReport", icon: FileText, iconColor: "text-blue-400" },
  { id: "flashcards", translationKey: "toolsFlashcards", icon: HelpCircle, iconColor: "text-orange-400" },
  { id: "quiz", translationKey: "toolsQuiz", icon: Award, iconColor: "text-green-400" },
  { id: "infographic", translationKey: "toolsInfographic", icon: BarChart3, iconColor: "text-pink-400" },
  { id: "data_table", translationKey: "toolsDataTable", icon: Table2, iconColor: "text-cyan-400" },
];

interface StudioPanelProps {
  width?: number;
  onSelectTool?: (toolId: string) => void;
  onAddNote?: () => void;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}

export function StudioPanel({
  width,
  onSelectTool,
  onAddNote,
  onToggleCollapse,
  isCollapsed = false,
}: StudioPanelProps) {
  const { t } = useI18n();

  if (isCollapsed) {
    return (
      <div className="w-12 h-full flex flex-col items-center py-3 bg-card rounded-2xl border border-border/50 text-muted-foreground shrink-0 select-none shadow-xs">
        {/* Top: Reopen Panel Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title={t("openStudioPanel")}
          aria-label={t("studioTitle")}
        >
          <PanelRight className="h-4 w-4" />
        </button>

        {/* Top-aligned: Vertical Stack of Studio Tools Icons (Image 3) */}
        <div className="flex flex-col items-center gap-1.5 mt-2.5">
          {STUDIO_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const toolName = t(tool.translationKey);
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelectTool?.(tool.id)}
                className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors cursor-pointer group"
                title={toolName}
                aria-label={toolName}
              >
                <Icon className={`h-4 w-4 ${tool.iconColor} opacity-75 group-hover:opacity-100 transition-opacity`} />
              </button>
            );
          })}
        </div>

        {/* Bottom: Note Button pinned to bottom (Image 3) */}
        <button
          type="button"
          onClick={onAddNote}
          className="h-8 w-8 rounded-xl bg-muted/60 hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border/40 shadow-xs mt-auto"
          title={t("addNote")}
          aria-label={t("addNote")}
        >
          <SquarePen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <aside
      style={{ width: isCollapsed ? undefined : width ? `${width}px` : undefined }}
      className="w-[285px] sm:w-[310px] lg:w-[360px] xl:w-[420px] 2xl:w-[480px] h-full flex flex-col bg-card rounded-2xl border border-border/50 text-foreground p-3 sm:p-3.5 shrink-0 select-none overflow-y-auto shadow-xs font-sans"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm font-semibold tracking-tight text-foreground">{t("studioTitle")}</span>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={t("hidePanel")}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 3x3 Grid of Studio Tools */}
      <div className="grid grid-cols-3 gap-1.5 mb-6">
        {STUDIO_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const toolName = t(tool.translationKey);
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool?.(tool.id)}
              className="p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/50 hover:border-border/80 transition-all flex flex-col justify-between h-[84px] text-left group cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
            >
              <div className="flex items-center justify-between w-full">
                <div className="h-6 w-6 rounded-lg bg-background/70 border border-border/40 flex items-center justify-center group-hover:bg-background group-hover:border-border/70 transition-all shrink-0">
                  <Icon className={`h-3.5 w-3.5 ${tool.iconColor}`} />
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-foreground tracking-tight leading-snug line-clamp-2 mt-1">
                {toolName}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty State Studio Output (Zero Dummy Data) */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 min-h-[180px]">
        <div className="h-12 w-12 rounded-2xl bg-secondary/80 border border-border/50 flex items-center justify-center text-muted-foreground/80 mb-3 shadow-2xs">
          <PenTool className="h-6 w-6 stroke-[1.5]" />
        </div>
        <h3 className="text-xs font-semibold text-foreground mb-1.5 tracking-tight">
          {t("studioEmptyTitle")}
        </h3>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed max-w-[280px]">
          {t("studioEmptyDesc")}
        </p>
      </div>

      {/* "+ Tambahkan catatan" Button */}
      <div className="pt-3 flex justify-center">
        <button
          type="button"
          onClick={onAddNote}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground hover:bg-foreground/90 text-background text-xs font-medium transition-all shadow-xs active:scale-98 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>{t("addNote")}</span>
        </button>
      </div>
    </aside>
  );
}
