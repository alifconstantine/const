import React, { useState, useMemo } from "react";
import {
  X,
  LayoutGrid,
  ChevronRight,
  Package,
  FileText,
  Download,
  ArrowLeft,
  SquarePen,
  RotateCw,
  MoreVertical,
  Eye,
  Copy,
  Trash2,
  PenTool,
  GitFork,
  HelpCircle,
  Presentation,
  AudioLines,
  Video,
  BarChart3,
  BookOpen,
  Table2,
  FileSpreadsheet,
} from "lucide-react";
import {
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast,
} from "@const/ui";
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

export interface GeneratingArtifactStatus {
  id: string;
  type: "quiz" | "flashcard" | string;
  title: string;
  sourceCount?: number;
}

export interface StudioSheetProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  tools: StudioToolItem[];
  toolNameMap: Record<string, string>;
  artifacts?: LocalArtifact[];
  generatingArtifacts?: GeneratingArtifactStatus[];
  onSelectTool: (toolId: string, toolTitle: string) => void;
  onSelectArtifact?: (art: LocalArtifact) => void;
  onDeleteArtifact?: (artId: string) => void;
  onDownloadArtifact: (art: LocalArtifact) => void;
  onOpenArtifact?: (art: LocalArtifact) => void;
  onAddNote?: () => void;
}

export function StudioSheet({
  open,
  onClose,
  onBack,
  tools,
  toolNameMap,
  artifacts,
  generatingArtifacts = [],
  onSelectTool,
  onSelectArtifact,
  onDownloadArtifact,
  onOpenArtifact,
  onDeleteArtifact,
  onAddNote,
}: StudioSheetProps) {
  const { t } = useI18n();

  const formatRelativeTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return t("relativeJustNow");
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return t("relativeMinutesAgo", { minutes: diffMin });
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t("relativeHoursAgo", { hours: diffHr });
    const diffDay = Math.floor(diffHr / 24);
    return t("relativeDaysAgo", { days: diffDay });
  };

  const getArtifactIcon = (type: string, isZip?: boolean) => {
    if (isZip) return Package;
    const t = (type || "").toLowerCase().trim();
    switch (t) {
      case "note":
      case "notes":
        return SquarePen;
      case "mind_map":
      case "mindmap":
      case "diagram":
        return GitFork;
      case "quiz":
        return HelpCircle;
      case "slide":
      case "slides":
        return Presentation;
      case "audio":
      case "audio_summary":
        return AudioLines;
      case "video":
      case "video_summary":
        return Video;
      case "report":
        return FileText;
      case "infographic":
        return BarChart3;
      case "flashcard":
      case "flashcards":
        return BookOpen;
      case "data_table":
      case "cheatsheet":
        return FileSpreadsheet;
      default:
        return SquarePen;
    }
  };

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
          "fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] sm:max-w-[360px] h-full bg-card text-card-foreground",
          "border-r border-border rounded-tr-[24px] rounded-br-[24px] flex flex-col will-change-transform font-sans overflow-hidden select-none",
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
              <LayoutGrid className="h-4 w-4 text-foreground shrink-0" />
            )}
            <span className="text-sm font-semibold text-foreground tracking-tight truncate">
              {t("studioTools")}
            </span>
            <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/70 shrink-0">
              {tools.length} tools
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 px-3 pt-2.5 pb-3 flex flex-col gap-3 min-h-0 overflow-y-auto">
          {/* Section: Tools Grid (Matching Image 1) */}
          <div className="space-y-2 shrink-0">
            <div className="text-[11px] font-sans uppercase tracking-wider font-semibold text-muted-foreground px-0.5">
              {t("studioTitle")}
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
                      onSelectTool(tool.id, toolTitle);
                    }}
                    className={`p-2.5 rounded-2xl border ${tool.cardBg} ${tool.borderColor} ${tool.hoverBg} ${tool.hoverBorder} transition-all flex flex-col justify-between min-h-[82px] text-left cursor-pointer active:scale-[0.98] shadow-xs group`}
                  >
                    {/* Top Row: Icon + Badge on left, Chevron on right */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 ${tool.iconColor} shrink-0`} />
                        {tool.hasBadge && (
                          <span className="bg-foreground text-background text-[8.5px] font-sans font-bold px-1.5 py-0.5 rounded-full leading-none shadow-2xs">
                            {t("badgeNew")}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground/80 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>

                    {/* Bottom Row: Tool Title */}
                    <span
                      className={`text-[11.5px] font-medium ${
                        tool.textColor || "text-foreground"
                      } tracking-tight leading-snug line-clamp-2 mt-auto pt-1`}
                    >
                      {toolTitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Activities & Generated Outputs */}
          <div className="space-y-2 pt-1 flex-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-foreground">
                {t("artifacts")}
              </span>
              {artifacts && artifacts.length > 0 && (
                <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-full bg-secondary border border-border/70 text-muted-foreground">
                  {artifacts.length}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {(artifacts || []).map((art) => {
                const isGenerating = art.status === "generating";
                const ItemIcon = getArtifactIcon(art.type, art.isZip);

                const isAudio = art.type === "audio_summary" || art.type === "audio";
                const isQuiz = art.type === "quiz";
                const isFlashcard = art.type === "flashcard" || art.type === "flashcards";
                const isMindMap = art.type === "mind_map" || art.type === "mindmap" || art.type === "diagram";
                const isSlides = art.type === "slides" || art.type === "slide";
                const isReport = art.type === "report";
                const isInfographic = art.type === "infographic";
                const isVideo = art.type === "video_summary" || art.type === "video";
                const isNote = art.type === "note" || art.type === "notes" || (!isAudio && !isQuiz && !isFlashcard && !isMindMap && !isSlides && !isVideo && !isInfographic && !isReport);

                if (isGenerating) {
                  const defaultGenTitle = isAudio
                    ? t("creatingAudioSummaryStatus")
                    : isInfographic
                    ? t("creatingInfographicStatus")
                    : isVideo
                    ? t("creatingVideoSummaryStatus")
                    : isReport
                    ? t("generatingReportStatus")
                    : isSlides
                    ? t("creatingPresentationStatus")
                    : isMindMap
                    ? t("creatingMindMapStatus")
                    : isQuiz
                    ? t("creatingQuizStatus")
                    : isFlashcard
                    ? t("creatingFlashcardsStatus")
                    : t("creatingNoteStatus");

                  return (
                    <div
                      key={art.id}
                      className={cn(
                        "p-2.5 rounded-2xl bg-secondary/50 flex items-center gap-2.5 select-none animate-pulse shadow-xs border",
                        isAudio
                          ? "border-indigo-500/30"
                          : isReport
                          ? "border-foreground/30"
                          : isInfographic
                          ? "border-purple-500/30"
                          : isVideo
                          ? "border-emerald-500/30"
                          : isMindMap
                          ? "border-purple-500/30"
                          : isSlides
                          ? "border-amber-400/40"
                          : isQuiz
                          ? "border-amber-500/30"
                          : isFlashcard
                          ? "border-emerald-500/30"
                          : "border-blue-500/30"
                      )}
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border",
                          isAudio
                            ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                            : isReport
                            ? "bg-foreground/10 border-foreground/20 text-foreground"
                            : isInfographic
                            ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                            : isVideo
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : isMindMap
                            ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                            : isSlides
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            : isQuiz
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            : isFlashcard
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        )}
                      >
                        <RotateCw
                          className={cn(
                            "h-4 w-4 animate-spin",
                            isAudio
                              ? "text-indigo-400"
                              : isReport
                              ? "text-foreground"
                              : isInfographic
                              ? "text-purple-400"
                              : isVideo
                              ? "text-emerald-400"
                              : isMindMap
                              ? "text-purple-400"
                              : isSlides
                              ? "text-amber-400"
                              : isQuiz
                              ? "text-amber-400"
                              : isFlashcard
                              ? "text-emerald-400"
                              : "text-blue-400"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground tracking-tight truncate">
                          {art.title || defaultGenTitle}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground truncate mt-0.5">
                          {(art.sourcesCount ?? 1) === 1
                            ? t("basedOnSourcesCountSingle")
                            : t("basedOnSourcesCount", { count: art.sourcesCount ?? 1 })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const itemCount = isQuiz && art.data?.questions
                  ? art.data.questions.length
                  : isFlashcard && art.data?.cards
                  ? art.data.cards.length
                  : isSlides
                  ? (art.data?.slideCount || (art.data?.slides && art.data.slides.length > 0 ? art.data.slides.length : art.data?.canvaThumbnails?.length || null))
                  : isVideo && art.data?.scenes
                  ? art.data.scenes.length
                  : isReport && art.data?.sections
                  ? art.data.sections.length
                  : null;
                const countText = itemCount !== null && itemCount !== undefined
                  ? isQuiz
                    ? (itemCount === 1 ? t("questionsCountSingle") : t("questionsCount", { count: itemCount }))
                    : isFlashcard
                    ? (itemCount === 1 ? t("cardsCountSingle") : t("cardsCount", { count: itemCount }))
                    : isSlides
                    ? (itemCount === 1 ? t("slidesCountSingle") : t("slidesCount", { count: itemCount }))
                    : isVideo
                    ? (itemCount === 1 ? t("scenesCountSingle") : t("scenesCount", { count: itemCount }))
                    : isReport
                    ? (itemCount === 1 ? t("sectionsCountSingle") : t("sectionsCount", { count: itemCount }))
                    : null
                  : isAudio
                  ? t("audioSummaryTitle")
                  : isMindMap
                  ? t("conceptMap")
                  : isInfographic
                  ? (art.data?.styleLabel || t("visualPoster"))
                  : null;

                const handleOpenThis = () => {
                  onClose();
                  if (onOpenArtifact) onOpenArtifact(art);
                  else if (onSelectArtifact) onSelectArtifact(art);
                };

                return (
                  <div
                    key={art.id}
                    onClick={handleOpenThis}
                    className="p-2.5 rounded-2xl bg-card hover:bg-secondary/60 border border-border hover:border-border/80 transition-all flex items-center justify-between gap-2 cursor-pointer group shadow-2xs active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-xl bg-secondary text-foreground border border-border/70 flex items-center justify-center shrink-0 group-hover:text-foreground transition-colors">
                        <ItemIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
                          {art.title}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground truncate mt-0.5">
                          {countText ? `${countText} · ` : art.sourcesCount
                            ? `${art.sourcesCount === 1 ? t("basedOnSourcesSingle") : t("basedOnSources", { count: art.sourcesCount })} · `
                            : ""}
                          {formatRelativeTime(art.createdAt || art.updatedAt)}
                        </div>
                      </div>
                    </div>

                    {/* Dropdown Options */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="h-7 w-7 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                          title="Opsi"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44 p-1 shadow-xl bg-popover border border-border text-popover-foreground"
                      >
                        {/* Open / Preview Action */}
                        <DropdownMenuItem
                          className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-foreground hover:bg-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenThis();
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>
                            {isQuiz
                              ? t("openQuiz")
                              : isFlashcard
                              ? t("openFlashcards")
                              : isMindMap
                              ? t("openMindMap")
                              : isSlides
                              ? t("openSlides")
                              : isNote
                              ? t("openNote")
                              : t("openPreview")}
                          </span>
                        </DropdownMenuItem>

                        {/* Copy Note Action: ONLY for text notes/reports */}
                        {(isNote || isReport) && art.content && (
                          <DropdownMenuItem
                            className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-foreground hover:bg-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(art.content || "");
                              toast.success(t("noteCopied"));
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>
                              {t("copyNote")}
                            </span>
                          </DropdownMenuItem>
                        )}

                        {/* Download Actions: tailored per type. Quiz, Mind Map, and Flashcards DO NOT have download */}
                        {isAudio && (
                          <DropdownMenuItem
                            className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-foreground hover:bg-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadArtifact?.(art);
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>
                              {t("downloadAudio")}
                            </span>
                          </DropdownMenuItem>
                        )}

                        {isInfographic && (
                          <DropdownMenuItem
                            className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-foreground hover:bg-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadArtifact?.(art);
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>
                              {t("downloadImage")}
                            </span>
                          </DropdownMenuItem>
                        )}

                        {isVideo && (
                          <DropdownMenuItem
                            className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-foreground hover:bg-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadArtifact?.(art);
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>
                              {t("downloadVideo")}
                            </span>
                          </DropdownMenuItem>
                        )}

                        {(isNote || isReport) && (
                          <DropdownMenuItem
                            className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-foreground hover:bg-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadArtifact?.(art);
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>
                              {t("downloadMd")}
                            </span>
                          </DropdownMenuItem>
                        )}

                        {isSlides && art.fileUrl && (
                          <DropdownMenuItem
                            className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-foreground hover:bg-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadArtifact?.(art);
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>
                              {t("downloadPresentation")}
                            </span>
                          </DropdownMenuItem>
                        )}

                        {/* Separator & Delete */}
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (art.id) onDeleteArtifact?.(art.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>
                            {t("delete")}
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Empty State if neither exists */}
          {(!artifacts || artifacts.length === 0) && (
            <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-dashed border-border/80 bg-card/40 min-h-[130px]">
              <div className="h-9 w-9 rounded-2xl bg-secondary border border-border/70 flex items-center justify-center text-muted-foreground mb-2">
                <PenTool className="h-4 w-4 stroke-[1.5] text-foreground" />
              </div>
              <h3 className="text-xs font-semibold text-foreground mb-1">
                {t("studioEmptyTitle")}
              </h3>
              <p className="text-[10.5px] text-muted-foreground leading-relaxed max-w-[220px]">
                {t("studioEmptyDesc")}
              </p>
            </div>
          )}
        </div>

        {/* "+ Tambahkan catatan" Button pinned at the bottom (Image 1) */}
        <div className="p-3 pt-2 flex justify-center mt-auto shrink-0 sticky bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent">
          <button
            type="button"
            onClick={() => {
              onAddNote?.();
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-foreground text-background hover:opacity-90 text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer border border-border/20"
          >
            <SquarePen className="h-4 w-4 stroke-[2]" />
            <span>{t("addNote")}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

