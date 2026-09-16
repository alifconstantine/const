import React, { useRef, useState, useEffect } from "react";
import {
  PanelRight,
  PenTool,
  Layers,
  SquarePen,
  ChevronRight,
  Plus,
  Package,
  FileText,
  Download,
  RotateCw,
  MoreVertical,
  X,
  Eye,
  Copy,
  Trash2,
  HelpCircle,
  GitFork,
  Presentation,
  AudioLines,
  Video,
  BarChart3,
  Table2,
  BookOpen,
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
import { TabHeader } from "./tab-header";
import { ReviewTab } from "./review-tab";
import { FileDiffTab } from "./file-diff-tab";
import { FilePreviewTab } from "./file-preview-tab";
import { OpenTabView } from "./open-tab-view";
import { BrowserTab } from "./browser-tab";
import { NotePreviewTab } from "./note-preview-tab";
import { STUDIO_TOOLS } from "../workspace/studio-panel";
import { useI18n } from "../../lib/i18n";
import type { RightPaneTab, RightPaneTabType } from "./types";
import type { FileMutationRecord } from "@const/agent";

export interface RightPaneProps {
  width?: number;
  onWidthChange?: (width: number) => void;
  isCollapsed?: boolean;
  isResizing?: boolean;
  onToggleCollapse?: () => void;
  mode: "studio" | "preview";
  onModeChange: (mode: "studio" | "preview") => void;
  tabs: RightPaneTab[];
  activeTabId: string | null;
  isOpeningNewTab?: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onNewTab?: () => void;
  onOpenTabType?: (type: RightPaneTabType) => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
  mutations?: FileMutationRecord[];
  onRollbackFile?: (record: FileMutationRecord) => Promise<any> | void;
  onRollbackAll?: (records: FileMutationRecord[]) => Promise<any> | void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
  onSelectStudioTool?: (toolId: string) => void;
  onAddNote?: () => void;
  artifacts?: any[];
  onDownloadArtifact?: (art: any) => void;
  onOpenArtifact?: (art: any) => void;
  onDeleteArtifact?: (artId: string) => void;
  activeNoteArtifact?: any | null;
  onCloseNote?: () => void;
  onConvertToSource?: (art: any) => void;
}

export function RightPane({
  width,
  onWidthChange,
  isCollapsed = false,
  isResizing = false,
  onToggleCollapse,
  mode,
  onModeChange,
  tabs,
  activeTabId,
  isOpeningNewTab = false,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onOpenTabType,
  onReorderTabs,
  onUpdateTab,
  mutations = [],
  onRollbackFile,
  onRollbackAll,
  onOpenFileDiff,
  onSelectStudioTool,
  onAddNote,
  artifacts,
  onDownloadArtifact,
  onOpenArtifact,
  onDeleteArtifact,
  activeNoteArtifact,
  onCloseNote,
  onConvertToSource,
}: RightPaneProps) {
  const { t, language } = useI18n();

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
        return BookOpen;
      case "data_table":
        return Table2;
      default:
        return SquarePen;
    }
  };

  const isDraggingRef = useRef(false);
  const [isInternalDragging, setIsInternalDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width || 400);

  // Tab indicator refs and style for animated sliding pill
  const studioBtnRef = useRef<HTMLButtonElement>(null);
  const reviewBtnRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 2, width: 0 });

  useEffect(() => {
    const activeRef = mode === "studio" ? studioBtnRef.current : reviewBtnRef.current;
    if (activeRef) {
      setIndicatorStyle({
        left: activeRef.offsetLeft,
        width: activeRef.offsetWidth,
      });
    }
  }, [mode, mutations.length]);

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onWidthChange || isCollapsed) return;
    setIsInternalDragging(true);
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width || 400;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = startXRef.current - moveEvent.clientX;
      const newWidth = Math.max(300, Math.min(window.innerWidth * 0.65, startWidthRef.current + deltaX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsInternalDragging(false);
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Unified Sidebar View with smooth width and tab animation
  return (
    <aside
      style={{ width: isCollapsed ? 48 : (width || 400) }}
      className={cn(
        "h-full flex flex-col relative bg-card rounded-2xl border border-border/50 text-foreground shrink-0 select-none overflow-hidden shadow-xs font-sans",
        !isResizing && !isInternalDragging && "transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
      )}
    >
      {/* Collapsed Rail View */}
      <div
        className={cn(
          "w-12 h-full flex flex-col items-center py-3 bg-card text-muted-foreground select-none font-sans absolute top-0 right-0 z-10 transition-opacity duration-200",
          isCollapsed ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Top: Reopen Panel Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title={t("openStudioPanel") || "Expand Panel"}
          aria-label={t("studioTitle")}
        >
          <PanelRight className="h-4 w-4" />
        </button>

        {/* 2-mode mini switcher */}
        <div className="flex flex-col items-center gap-1 mt-3 pb-2 border-b border-border/40 w-full px-1">
          <button
            type="button"
            onClick={() => {
              onModeChange("studio");
              onToggleCollapse?.();
            }}
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
              mode === "studio"
                ? "bg-[#0066ff] text-white"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            title="Studio"
          >
            <PenTool className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onModeChange("preview");
              onToggleCollapse?.();
            }}
            className={cn(
              "relative h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
              mode === "preview"
                ? "bg-[#0066ff] text-white"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            title={`Preview (${mutations.length} changes)`}
          >
            <Layers className="h-3.5 w-3.5" />
            {mutations.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#10b981]" />
            )}
          </button>
        </div>

        {/* Vertical Stack of Studio Tools Icons */}
        <div className="flex flex-col items-center gap-1.5 mt-2">
          {STUDIO_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const toolName = t(tool.translationKey);
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => {
                  onSelectStudioTool?.(tool.id);
                  if (tool.id !== "browser" && mode !== "studio") {
                    onModeChange("studio");
                  }
                  onToggleCollapse?.();
                }}
                className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors cursor-pointer group"
                title={toolName}
                aria-label={toolName}
              >
                <Icon className={`h-3.5 w-3.5 ${tool.iconColor} opacity-75 group-hover:opacity-100 transition-opacity`} />
              </button>
            );
          })}
        </div>

        {/* Bottom: Note Button pinned to bottom */}
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

      {/* Expanded Content View */}
      <div
        style={{ width: `${width || 400}px`, minWidth: `${width || 400}px` }}
        className={cn(
          "h-full flex flex-col transition-opacity duration-200 relative",
          isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
        )}
      >
        {/* Draggable resize handle on the left edge */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={() => onWidthChange?.(400)}
          className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-white/20 transition-colors z-30 group"
          title="Drag to resize, double-click to reset"
        >
          <div className="w-0.5 h-full bg-transparent group-hover:bg-[#0066ff]/50" />
        </div>

        {/* Conditional View: When Note is Active in Studio (Image 3) vs Studio/Review Overview */}
        {mode === "studio" && activeNoteArtifact ? (
          <NotePreviewTab
            artifact={activeNoteArtifact}
            onClose={onCloseNote}
            onDeleteArtifact={onDeleteArtifact}
            onConvertToSource={onConvertToSource}
            onToggleCollapse={onToggleCollapse}
          />
        ) : (
          <>
            {/* Top Header with 2 Menus: Studio & Review */}
            <div
              className={`h-12 px-3 bg-[#1e1e20] flex items-center justify-between shrink-0 select-none ${
                mode === "studio" ? "border-b-0" : "border-b border-[#282828]"
              }`}
            >
              {/* Segmented Control: [ Studio ] [ Review (N) ] */}
              <div className="relative flex items-center bg-[#141416] p-0.5 rounded-xl border border-[#2d2d30]">
                {/* Animated Sliding Background Pill */}
                <div
                  className="absolute top-0.5 bottom-0.5 rounded-lg bg-[#28282b] shadow-2xs transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none"
                  style={{
                    left: `${indicatorStyle.left}px`,
                width: indicatorStyle.width ? `${indicatorStyle.width}px` : undefined,
                opacity: indicatorStyle.width ? 1 : 0,
              }}
            />

            <button
              ref={studioBtnRef}
              type="button"
              onClick={() => onModeChange("studio")}
              className={cn(
                "relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer select-none",
                mode === "studio"
                  ? "text-white"
                  : "text-[#888888] hover:text-[#d4d4d4]"
              )}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>{t("studio") || "Studio"}</span>
            </button>

            <button
              ref={reviewBtnRef}
              type="button"
              onClick={() => onModeChange("preview")}
              className={cn(
                "relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer select-none",
                mode === "preview"
                  ? "text-white"
                  : "text-[#888888] hover:text-[#d4d4d4]"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t("review") || "Review"}</span>
              {mutations.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981] font-mono text-[10px] font-semibold ml-0.5">
                  {mutations.length}
                </span>
              )}
            </button>
          </div>

          {/* Collapse Button */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="h-7 w-7 rounded-lg hover:bg-[#2c2c30] text-[#969696] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title={t("hidePanel") || "Collapse panel"}
            >
              <PanelRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Main Body based on Active Menu with smooth fade */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {mode === "studio" ? (
            /* Studio Content */
            <div className="flex-1 flex flex-col p-3 sm:p-3.5 overflow-y-auto min-h-0 select-none animate-in fade-in duration-200">
              {/* Banner: Laporan Interaktif (Image 1) */}
              {!isBannerDismissed && (
                <div className="mb-3.5 p-2.5 rounded-2xl bg-gradient-to-r from-[#1f2824] via-[#1a2e22] to-[#1e2622] border border-[#2d4d38]/60 flex items-center justify-between gap-2 shadow-xs select-none shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base select-none shrink-0" role="img" aria-label="Celebration">
                      🎆
                    </span>
                    <span className="text-[11.5px] font-medium text-[#e2e8f0] leading-snug">
                      {language === "id"
                        ? "Baru: Anda kini dapat membuat Laporan Interaktif."
                        : "New: You can now create Interactive Reports."}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectStudioTool?.("report")}
                      className="px-3 py-1 rounded-full bg-white text-neutral-900 text-[11px] font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      {language === "id" ? "Coba" : "Try"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissBanner}
                      className="h-6 w-6 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      title={language === "id" ? "Tutup banner" : "Dismiss banner"}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* 3x3 Grid of Studio Tools (9 Tools matching Image 1) */}
              <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
                {STUDIO_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const toolName = t(tool.translationKey);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => onSelectStudioTool?.(tool.id)}
                      className={`p-3 rounded-2xl border ${tool.cardBg} ${tool.borderColor} ${tool.hoverBg} ${tool.hoverBorder} transition-all flex flex-col justify-between h-[86px] sm:h-[90px] text-left group cursor-pointer shadow-xs active:scale-[0.98]`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`h-4 w-4 ${tool.iconColor} shrink-0`} />
                          {tool.hasBadge && (
                            <span className="bg-[#ededed] text-[#141414] text-[9.5px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-2xs">
                              {t("badgeNew")}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-[#888888]/60 group-hover:text-[#d4d4d4] group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                      <span
                        className={`text-[11px] sm:text-xs font-medium ${
                          tool.textColor || "text-foreground"
                        } tracking-tight leading-snug line-clamp-2 mt-auto`}
                      >
                        {toolName}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Studio Activities & Generated Outputs List (Image 1) */}
              <div className="flex-1 flex flex-col min-h-0 space-y-2 mb-4">
                {artifacts && artifacts.length > 0 ? (
                  <div className="space-y-2">
                    {artifacts.map((art) => {
                      const isGenerating = art.status === "generating";
                      const ItemIcon = getArtifactIcon(art.type, art.isZip);

                      if (isGenerating) {
                        return (
                          <div
                            key={art.id}
                            className="p-3 rounded-2xl bg-[#1c1c1f] border border-blue-500/30 flex items-center gap-3 select-none animate-pulse shadow-xs"
                          >
                            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                              <RotateCw className="h-4 w-4 animate-spin text-blue-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-white tracking-tight truncate">
                                {art.title ||
                                  (language === "id"
                                    ? "Membuat Catatan..."
                                    : "Creating Note...")}
                              </div>
                              <div className="text-[11px] text-neutral-400 truncate mt-0.5">
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

                      return (
                        <div
                          key={art.id}
                          onClick={() => onOpenArtifact?.(art)}
                          className="p-3 rounded-2xl bg-[#1e1e21] hover:bg-[#25252a] border border-[#2d2d32] hover:border-[#3d3d44] transition-all flex items-center justify-between gap-2.5 cursor-pointer group shadow-xs active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="h-9 w-9 rounded-xl bg-[#28282e] border border-[#383842] flex items-center justify-center text-[#d4d4d4] group-hover:text-white shrink-0 transition-colors">
                              <ItemIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-white tracking-tight truncate group-hover:text-blue-400 transition-colors">
                                {art.title}
                              </div>
                              <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                                {art.sourcesCount
                                  ? `${art.sourcesCount} ${
                                      language === "id" ? "sumber" : "source"
                                    } · `
                                  : ""}
                                {formatRelativeTime(art.createdAt || art.updatedAt)}
                              </div>
                            </div>
                          </div>

                          {/* Dropdown Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="h-8 w-8 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                title="Opsi"
                              >
                                <MoreVertical className="h-4 w-4" />
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
                                  onOpenArtifact?.(art);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>
                                  {language === "id"
                                    ? "Buka Pratinjau"
                                    : "Open Preview"}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-neutral-300 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (art.content) {
                                    navigator.clipboard.writeText(art.content);
                                    toast.success(
                                      language === "id"
                                        ? "Catatan disalin"
                                        : "Note copied"
                                    );
                                  }
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                <span>
                                  {language === "id"
                                    ? "Salin Catatan"
                                    : "Copy Note"}
                                </span>
                              </DropdownMenuItem>
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
                ) : (
                  /* Empty State Studio Output */
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 min-h-[160px]">
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
                )}
              </div>

              {/* "+ Tambahkan catatan" Button pinned at the bottom (Image 1) */}
              <div className="pt-3 pb-1 flex justify-center mt-auto shrink-0 sticky bottom-0 bg-gradient-to-t from-card via-card/95 to-transparent">
                <button
                  type="button"
                  onClick={onAddNote}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-neutral-900 hover:bg-neutral-100 text-xs font-semibold transition-all shadow-md active:scale-98 cursor-pointer border border-white/20"
                >
                  <SquarePen className="h-4 w-4 stroke-[2]" />
                  <span>{t("addNote")}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Review Sidepanel matching apps/harness/desktop */
            <div className="flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden bg-[#141414] animate-in fade-in duration-200">
              {/* Harness Tab Header with +, Search Dropdown, Drag & Drop */}
              <TabHeader
                tabs={tabs}
                activeTabId={activeTabId}
                isOpeningNewTab={Boolean(isOpeningNewTab)}
                onSelectTab={onSelectTab}
                onCloseTab={onCloseTab}
                onNewTab={onNewTab || (() => {})}
                onReorderTabs={onReorderTabs}
              />

              {/* Active Tab Body matching apps/harness/desktop */}
              <div className="flex-1 w-full h-[calc(100%-40px)] min-h-0 relative overflow-hidden flex flex-col bg-[#141414]">
                {isOpeningNewTab || tabs.length === 0 || !activeTab ? (
                  <OpenTabView onSelectTabType={onOpenTabType || (() => {})} />
                ) : activeTab.type === "file_diff" ? (
                  <FileDiffTab
                    key={activeTab.id}
                    tab={activeTab}
                    onRollbackFile={onRollbackFile}
                  />
                ) : activeTab.type === "file_preview" ? (
                  <FilePreviewTab key={activeTab.id} tab={activeTab} />
                ) : activeTab.type === "browser" ? (
                  <BrowserTab
                    key={activeTab.id}
                    tab={activeTab}
                    onUpdateTab={onUpdateTab}
                  />
                ) : activeTab.type === "note_preview" ? (
                  <NotePreviewTab
                    key={activeTab.id}
                    tab={activeTab}
                    onUpdateTab={onUpdateTab}
                    onDownloadArtifact={onDownloadArtifact}
                  />
                ) : (
                  <ReviewTab
                    key={activeTab.id || "review_tab"}
                    mutations={mutations}
                    onRollbackFile={onRollbackFile}
                    onRollbackAll={onRollbackAll}
                    onOpenFileDiff={onOpenFileDiff}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </>
    )}
  </div>
</aside>
  );
}
