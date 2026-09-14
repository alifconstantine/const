import React from "react";
import {
  PanelRight,
  AudioLines,
  Presentation,
  Video,
  GitFork,
  FileText,
  Globe,
  HelpCircle,
  BarChart3,
  ChevronRight,
  Plus,
  SquarePen,
  PenTool,
} from "lucide-react";
import { ScrollArea } from "@const/ui";

import { useI18n, type TranslationKey } from "../../lib/i18n";

export interface StudioTool {
  id: string;
  translationKey: TranslationKey;
  icon: React.ElementType;
  iconColor: string;
  textColor?: string;
  cardBg: string;
  borderColor: string;
  hoverBg: string;
  hoverBorder: string;
  hasBadge?: boolean;
}

export const STUDIO_TOOLS: StudioTool[] = [
  {
    id: "audio_summary",
    translationKey: "toolsAudioSummary",
    icon: AudioLines,
    iconColor: "text-[#a5b4fc]",
    textColor: "text-[#dbeafe]",
    cardBg: "bg-[#21232d]",
    borderColor: "border-[#303444]",
    hoverBg: "hover:bg-[#282b37]",
    hoverBorder: "hover:border-[#3d4257]",
  },
  {
    id: "slides",
    translationKey: "toolsSlides",
    icon: Presentation,
    iconColor: "text-[#fde047]",
    textColor: "text-[#fef9c3]",
    cardBg: "bg-[#2b291d]",
    borderColor: "border-[#3e3b2a]",
    hoverBg: "hover:bg-[#353224]",
    hoverBorder: "hover:border-[#4f4b36]",
  },
  {
    id: "video_summary",
    translationKey: "toolsVideo",
    icon: Video,
    iconColor: "text-[#86efac]",
    textColor: "text-[#dcfce7]",
    cardBg: "bg-[#1d2820]",
    borderColor: "border-[#2b3d30]",
    hoverBg: "hover:bg-[#243329]",
    hoverBorder: "hover:border-[#384e3e]",
  },
  {
    id: "mind_map",
    translationKey: "toolsMindMap",
    icon: GitFork,
    iconColor: "text-[#f472b6]",
    textColor: "text-[#fce7f3]",
    cardBg: "bg-[#2e212b]",
    borderColor: "border-[#422f3e]",
    hoverBg: "hover:bg-[#372834]",
    hoverBorder: "hover:border-[#543b4f]",
  },
  {
    id: "report",
    translationKey: "toolsReport",
    icon: FileText,
    iconColor: "text-[#dedac2]",
    textColor: "text-[#f5f4eb]",
    cardBg: "bg-[#29281e]",
    borderColor: "border-[#3c3a2b]",
    hoverBg: "hover:bg-[#343225]",
    hoverBorder: "hover:border-[#4d4a37]",
  },
  {
    id: "browser",
    translationKey: "toolsBrowser",
    icon: Globe,
    iconColor: "text-[#38bdf8]",
    textColor: "text-[#e0f2fe]",
    cardBg: "bg-[#1e262f]",
    borderColor: "border-[#2c3947]",
    hoverBg: "hover:bg-[#25313d]",
    hoverBorder: "hover:border-[#38495a]",
  },
  {
    id: "quiz",
    translationKey: "toolsQuiz",
    icon: HelpCircle,
    iconColor: "text-[#5eead4]",
    textColor: "text-[#ccfbf1]",
    cardBg: "bg-[#1c2628]",
    borderColor: "border-[#29383c]",
    hoverBg: "hover:bg-[#233235]",
    hoverBorder: "hover:border-[#364b50]",
  },
  {
    id: "infographic",
    translationKey: "toolsInfographic",
    icon: BarChart3,
    iconColor: "text-[#c084fc]",
    textColor: "text-[#f3e8ff]",
    cardBg: "bg-[#28202d]",
    borderColor: "border-[#3a2d42]",
    hoverBg: "hover:bg-[#322739]",
    hoverBorder: "hover:border-[#4b3a55]",
  },
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

        {/* Top-aligned: Vertical Stack of Studio Tools Icons */}
        <div className="flex flex-col items-center gap-1.5 mt-2.5">
          {STUDIO_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const toolName = t(tool.translationKey);
            return (
              <div
                key={tool.id}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-default"
                title={toolName}
                aria-label={toolName}
              >
                <Icon className={`h-4 w-4 ${tool.iconColor} opacity-75`} />
              </div>
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
      className="w-[285px] sm:w-[310px] lg:w-[360px] xl:w-[420px] 2xl:w-[480px] h-full flex flex-col bg-card rounded-2xl border border-border/50 text-foreground p-3 sm:p-3.5 shrink-0 select-none shadow-xs font-sans overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1 shrink-0">
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

      {/* Scrollable Studio Content using ScrollArea from @const/ui */}
      <ScrollArea className="flex-1 w-full min-h-0 -mr-1 pr-1">
        <div className="flex flex-col min-h-full pb-1">
          {/* 3-Column Grid of Studio Tools (8 Tools) */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {STUDIO_TOOLS.map((tool) => {
              const Icon = tool.icon;
              const toolName = t(tool.translationKey);
              return (
                <div
                  key={tool.id}
                  className={`p-2.5 sm:p-3 rounded-2xl border ${tool.cardBg} ${tool.borderColor} transition-all flex flex-col justify-between h-[86px] sm:h-[90px] text-left cursor-default shadow-xs select-none`}
                >
                  {/* Top Row: Icon on left, Chevron on right */}
                  <div className="flex items-center justify-between w-full">
                    <Icon className={`h-4 w-4 ${tool.iconColor} shrink-0`} />
                    <ChevronRight className="h-3.5 w-3.5 text-[#888888]/60 shrink-0" />
                  </div>

                  {/* Bottom Row: Tool Name */}
                  <span className={`text-[10.5px] sm:text-xs font-medium ${tool.textColor || "text-foreground"} tracking-tight leading-tight line-clamp-2 mt-auto`}>
                    {toolName}
                  </span>
                </div>
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
          <div className="pt-3 flex justify-center mt-auto">
            <button
              type="button"
              onClick={onAddNote}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground hover:bg-foreground/90 text-background text-xs font-medium transition-all shadow-xs active:scale-98 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>{t("addNote")}</span>
            </button>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
