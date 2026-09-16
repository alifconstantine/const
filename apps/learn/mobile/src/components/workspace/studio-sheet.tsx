import React, { useState, useMemo } from "react";
import {
  X,
  LayoutGrid,
  ChevronRight,
  Package,
  FileText,
  Download,
  Layers,
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
  Loader2,
  Sparkles,
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

function formatArtifactTimeAgo(date?: Date | number, isIndo?: boolean): string {
  if (!date) return "";
  const d = typeof date === "number" || typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return isIndo ? "Baru saja" : "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isIndo ? `${diffMin} menit lalu` : `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return isIndo ? `${diffHour} jam lalu` : `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return isIndo ? `${diffDay} hari lalu` : `${diffDay}d ago`;
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
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("const_learn_report_banner_dismissed") === "true";
    } catch {
      return false;
    }
  });

  const handleDismissBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBannerDismissed(true);
    try {
      localStorage.setItem("const_learn_report_banner_dismissed", "true");
    } catch {}
  };

  const formatRelativeTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return language === "id" ? "baru saja" : "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ${language === "id" ? "lalu" : "ago"}`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ${language === "id" ? "lalu" : "ago"}`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ${language === "id" ? "lalu" : "ago"}`;
  };

  const getArtifactIcon = (type: string, isZip?: boolean) => {
    if (isZip) return Package;
    switch (type) {
      case "note":
        return SquarePen;
      case "mind_map":
        return GitFork;
      case "quiz":
        return HelpCircle;
      case "slides":
        return Presentation;
      case "audio_summary":
        return AudioLines;
      case "video_summary":
        return Video;
      case "report":
        return FileText;
      case "infographic":
        return BarChart3;
      case "flashcards":
      case "flashcard":
        return BookOpen;
      case "data_table":
        return Table2;
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
          "fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] sm:max-w-[360px] h-full bg-[#1c1c1e] text-[#d4d4d4]",
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
          {/* Banner: Laporan Interaktif (Image 1) */}
          {!isBannerDismissed && (
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#1f2824] via-[#1a2e22] to-[#1e2622] border border-[#2d4d38]/60 flex items-center justify-between gap-2 shadow-xs select-none shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base select-none shrink-0" role="img" aria-label="Celebration">
                  🎆
                </span>
                <span className="text-[11px] font-medium text-[#e2e8f0] leading-snug">
                  {language === "id"
                    ? "Baru: Anda kini dapat membuat Laporan Interaktif."
                    : "New: You can now create Interactive Reports."}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const reportTitle = toolNameMap["report"] || (language === "id" ? "Laporan" : "Report");
                    onSelectTool("report", reportTitle);
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-white text-neutral-900 text-[10.5px] font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {language === "id" ? "Coba" : "Try"}
                </button>
                <button
                  type="button"
                  onClick={handleDismissBanner}
                  className="h-5 w-5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title={language === "id" ? "Tutup banner" : "Dismiss banner"}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Section: Tools Grid (Matching Image 1) */}
          <div className="space-y-2 shrink-0">
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

          {/* Section: Activities & Generated Outputs */}
          <div className="space-y-2.5 pt-1 flex-1">
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

            <div className="space-y-2">
              {artifacts && artifacts.length > 0 && artifacts.map((art) => {
                const isGenerating = art.status === "generating";
                const ItemIcon = getArtifactIcon(art.type, art.isZip);

                if (isGenerating) {
                  const defaultGenTitle =
                    art.type === "quiz"
                      ? (language === "id" ? "Membuat Kuis..." : "Creating Quiz...")
                      : art.type === "flashcard" || art.type === "flashcards"
                      ? (language === "id" ? "Membuat Kartu Tanya-Jawab..." : "Creating Flashcards...")
                      : (language === "id" ? "Membuat Catatan..." : "Creating Note...");

                  return (
                    <div
                      key={art.id}
                      className="p-2.5 rounded-2xl bg-[#1c1c1f] border border-blue-500/30 flex items-center gap-2.5 select-none animate-pulse shadow-xs"
                    >
                      <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                        <RotateCw className="h-4 w-4 animate-spin text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white tracking-tight truncate">
                          {art.title || defaultGenTitle}
                        </div>
                        <div className="text-[10.5px] text-neutral-400 truncate mt-0.5">
                          {language === "id"
                            ? `berdasarkan ${art.sourcesCount ?? 1} sumber`
                            : `based on ${art.sourcesCount ?? 1} source${
                                (art.sourcesCount ?? 1) === 1 ? "" : "s"
                              }`}
                        </div>
                      </div>
                    </div>
                  );
                }

                const isQuiz = art.type === "quiz";
                const isFlashcard = art.type === "flashcard" || art.type === "flashcards";
                const itemCount = isQuiz && art.data?.questions
                  ? art.data.questions.length
                  : isFlashcard && art.data?.cards
                  ? art.data.cards.length
                  : null;
                const countText = itemCount !== null && itemCount !== undefined
                  ? isQuiz
                    ? (language === "id" ? `${itemCount} soal` : `${itemCount} questions`)
                    : (language === "id" ? `${itemCount} kartu` : `${itemCount} cards`)
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
                    className="p-2.5 rounded-2xl bg-[#242426] hover:bg-[#2c2c2f] border border-[#383838] hover:border-[#4d4d52] transition-all flex items-center justify-between gap-2 cursor-pointer group shadow-xs active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-xl bg-[#1c1c1e] text-[#d4d4d4] border border-[#333336] flex items-center justify-center shrink-0 group-hover:text-white transition-colors">
                        <ItemIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white tracking-tight truncate group-hover:text-blue-400 transition-colors">
                          {art.title}
                        </div>
                        <div className="text-[10.5px] text-[#969696] truncate mt-0.5">
                          {countText ? `${countText} · ` : art.sourcesCount
                            ? `${art.sourcesCount} ${
                                language === "id" ? "sumber" : "sources"
                              } · `
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
                          className="h-7 w-7 rounded-lg hover:bg-white/10 text-[#969696] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                          title="Opsi"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44 p-1 shadow-xl bg-[#1e1e22] border-[#333338]"
                      >
                        <DropdownMenuItem
                          className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-neutral-300 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenThis();
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>
                            {isQuiz
                              ? (language === "id" ? "Buka Kuis" : "Open Quiz")
                              : isFlashcard
                              ? (language === "id" ? "Buka Flashcard" : "Open Flashcards")
                              : (language === "id" ? "Buka Catatan" : "Open Note")}
                          </span>
                        </DropdownMenuItem>
                        {art.content && (
                          <DropdownMenuItem
                            className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-neutral-300 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(art.content || "");
                              toast.success(
                                language === "id"
                                  ? "Catatan disalin"
                                  : "Note copied"
                              );
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>
                              {language === "id" ? "Salin Teks" : "Copy Text"}
                            </span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-neutral-300 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownloadArtifact?.(art);
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>
                            {language === "id"
                              ? "Unduh .md"
                              : "Download .md"}
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#2e2e34]" />
                        <DropdownMenuItem
                          className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteArtifact?.(art.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>
                            {language === "id" ? "Hapus" : "Delete"}
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
            <div className="flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-dashed border-[#333336] bg-[#222225]/40 min-h-[130px]">
              <div className="h-9 w-9 rounded-2xl bg-[#28282b] border border-[#383838] flex items-center justify-center text-[#969696] mb-2">
                <PenTool className="h-4 w-4 stroke-[1.5] text-[#d4d4d4]" />
              </div>
              <h3 className="text-xs font-semibold text-white mb-1">
                {t("studioEmptyTitle") || "Output studio akan disimpan di sini"}
              </h3>
              <p className="text-[10.5px] text-[#969696] leading-relaxed max-w-[220px]">
                {t("studioEmptyDesc") ||
                  "Setelah menambahkan sumber, klik untuk menambahkan Ringkasan Audio, Panduan Belajar, Peta Konsep, dan banyak lagi."}
              </p>
            </div>
          )}
        </div>

        {/* "+ Tambahkan catatan" Button pinned at the bottom (Image 1) */}
        <div className="p-3 pt-2 flex justify-center mt-auto shrink-0 sticky bottom-0 bg-gradient-to-t from-[#1c1c1e] via-[#1c1c1e]/95 to-transparent">
          <button
            type="button"
            onClick={() => {
              onAddNote?.();
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-neutral-900 hover:bg-neutral-100 text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer border border-white/20"
          >
            <SquarePen className="h-4 w-4 stroke-[2]" />
            <span>{t("addNote") || "Tambahkan catatan"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

