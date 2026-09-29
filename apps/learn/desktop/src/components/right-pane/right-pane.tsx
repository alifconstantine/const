import React, { useRef, useState, useEffect, useMemo } from "react";
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
  FileSpreadsheet,
  BookOpen,
  Loader2,
} from "lucide-react";
import {
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast,
  ScrollArea,
} from "@const/ui";
import { TabHeader } from "./tab-header";
import { ReviewTab } from "./review-tab";
import { FileDiffTab } from "./file-diff-tab";
import { FilePreviewTab } from "./file-preview-tab";
import { OpenTabView } from "./open-tab-view";
import { BrowserTab } from "./browser-tab";
import { NotePreviewTab } from "./note-preview-tab";
import { QuizViewer } from "./quiz-viewer";
import { FlashcardViewer } from "./flashcard-viewer";
import { MindMapTab } from "./mind-map-tab";
import { AudioSummaryViewer } from "./audio-summary-viewer";
import { VideoSummaryViewer } from "./video-summary-viewer";
import { PresentationViewer } from "./presentation-viewer";
import { InfographicViewer } from "./infographic-viewer";
import { ReportViewer } from "./report-viewer";
import { CheatSheetViewer } from "./cheatsheet-viewer";
import { STUDIO_TOOLS } from "../workspace/studio-panel";
import { useI18n } from "../../lib/i18n";
import type { RightPaneTab, RightPaneTabType, BrowserSelectedElement } from "./types";
import type { FileMutationRecord } from "@const/agent";
import { type LocalArtifact, type AudioSummaryData, type VideoSummaryData, type SlideDeckData, type InfographicData, type ReportData, type CheatSheetData } from "../../lib/db";

export interface GeneratingArtifactStatus {
  id: string;
  type: "quiz" | "flashcard" | string;
  title: string;
  sourceCount?: number;
}

function formatArtifactTimeAgo(timestamp?: number, isIndo = true): string {
  if (!timestamp) return isIndo ? "Baru saja" : "Just now";
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return isIndo ? "Baru saja" : "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isIndo ? `${diffMin} menit lalu` : `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return isIndo ? `${diffHour} jam lalu` : `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return isIndo ? `${diffDay} hari lalu` : `${diffDay}d ago`;
}

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
  artifacts?: LocalArtifact[];
  onDownloadArtifact?: (art: any) => void;
  generatingArtifacts?: GeneratingArtifactStatus[];
  onOpenArtifact?: (art: any) => void;
  onSelectArtifact?: (art: LocalArtifact) => void;
  onDeleteArtifact?: (artId: string) => void;
  onConvertToSource?: (art: any) => void;
  onGenerateNote?: (art: LocalArtifact) => void;
  onExplainInChat?: (prompt: string) => void;
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
  artifacts = [],
  onDownloadArtifact,
  generatingArtifacts = [],
  onOpenArtifact,
  onSelectArtifact,
  onDeleteArtifact,
  onConvertToSource,
  onGenerateNote,
  onExplainInChat,
}: RightPaneProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

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
      case "cheatsheet":
        return FileSpreadsheet;
      default:
        return SquarePen;
    }
  };

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

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const renderTabContent = (tab: RightPaneTab) => {
    if (tab.type === "file_diff") {
      return (
        <FileDiffTab
          tab={tab}
          onRollbackFile={onRollbackFile}
        />
      );
    }
    if (tab.type === "file_preview") {
      return <FilePreviewTab tab={tab} />;
    }
    if (tab.type === "browser") {
      return (
        <BrowserTab
          tab={tab}
          onUpdateTab={onUpdateTab}
          onSelectElementForChat={(element) => {
            if (onExplainInChat) {
              const prompt = `Tolong jelaskan atau analisa elemen <${element.tag}> dari ${element.url}:\nSelector: ${element.selector}\nKonten: "${element.textSnippet}"\n\`\`\`html\n${element.htmlSnippet}\n\`\`\``;
              onExplainInChat(prompt);
            }
          }}
        />
      );
    }
    if (tab.type === "note_preview") {
      return (
        <NotePreviewTab
          tab={tab}
          onUpdateTab={onUpdateTab}
          onDownloadArtifact={onDownloadArtifact}
          onDeleteArtifact={onDeleteArtifact}
          onConvertToSource={onConvertToSource}
          onGenerateNote={onGenerateNote}
          onClose={() => onCloseTab(tab.id, {} as any)}
        />
      );
    }
    if (tab.type === "studio_preview") {
      if (tab.artifact?.type === "quiz" && tab.artifact.data) {
        return (
          <QuizViewer
            quiz={tab.artifact.data}
            onExplainInChat={onExplainInChat}
          />
        );
      }
      if ((tab.artifact?.type === "flashcard" || tab.artifact?.type === "flashcards") && tab.artifact.data) {
        return (
          <FlashcardViewer
            flashcard={tab.artifact.data}
            onExplainInChat={onExplainInChat}
          />
        );
      }
      if (tab.artifact?.type === "mind_map") {
        return <MindMapTab tab={tab} />;
      }
      if (tab.artifact?.type === "audio_summary") {
        const audioData =
          (tab.artifact.data as AudioSummaryData) ||
          (() => {
            try {
              return typeof tab.artifact.content === "string"
                ? JSON.parse(tab.artifact.content)
                : null;
            } catch {
              return null;
            }
          })();
        if (audioData) {
          return (
            <AudioSummaryViewer
              artifact={tab.artifact}
              data={audioData}
              onExplainInChat={onExplainInChat}
            />
          );
        }
      }
      if (tab.artifact?.type === "video_summary") {
        const videoData =
          (tab.artifact.data as VideoSummaryData) ||
          (() => {
            try {
              return typeof tab.artifact.content === "string"
                ? JSON.parse(tab.artifact.content)
                : null;
            } catch {
              return null;
            }
          })();
        if (videoData) {
          return (
            <VideoSummaryViewer
              data={{
                ...videoData,
                id: tab.artifact.id || videoData.id,
                learnId: tab.artifact.learnId || videoData.learnId,
              }}
              onExplainInChat={onExplainInChat}
              onToggleExpand={onToggleCollapse}
              isExpanded={!isCollapsed}
            />
          );
        }
      }
      if (tab.artifact?.type === "slides") {
        const slideData =
          (tab.artifact.data as SlideDeckData) ||
          (() => {
            try {
              return typeof tab.artifact.content === "string"
                ? JSON.parse(tab.artifact.content)
                : null;
            } catch {
              return null;
            }
          })();
        if (slideData) {
          return (
            <PresentationViewer
              artifact={tab.artifact}
              data={{
                ...slideData,
                id: tab.artifact.id || slideData.id,
                learnId: tab.artifact.learnId || slideData.learnId,
              }}
              onExplainInChat={onExplainInChat}
              onToggleExpand={onToggleCollapse}
              isExpanded={!isCollapsed}
            />
          );
        }
      }
      if (tab.artifact?.type === "infographic") {
        const infoData =
          (tab.artifact.data as InfographicData) ||
          (() => {
            try {
              return typeof tab.artifact.content === "string"
                ? JSON.parse(tab.artifact.content)
                : null;
            } catch {
              return null;
            }
          })();
        if (infoData) {
          return (
            <InfographicViewer
              artifact={tab.artifact}
              data={{
                ...infoData,
                id: tab.artifact.id || infoData.id,
                learnId: tab.artifact.learnId || infoData.learnId,
              }}
              onExplainInChat={onExplainInChat}
              onToggleExpand={onToggleCollapse}
              isExpanded={!isCollapsed}
            />
          );
        }
      }
      if (tab.artifact?.type === "report") {
        const reportData =
          (tab.artifact.data as ReportData) ||
          (() => {
            try {
              return typeof tab.artifact.content === "string"
                ? JSON.parse(tab.artifact.content)
                : null;
            } catch {
              return null;
            }
          })();
        if (reportData) {
          return (
            <ReportViewer
              artifact={tab.artifact}
              data={{
                ...reportData,
                id: tab.artifact.id || reportData.id,
                learnId: tab.artifact.learnId || reportData.learnId,
              }}
              onExplainInChat={onExplainInChat}
              onToggleExpand={onToggleCollapse}
              isExpanded={!isCollapsed}
              onSelectStudioTool={onSelectStudioTool}
            />
          );
        }
      }
      if (
        tab.artifact?.type === "cheatsheet" ||
        tab.artifact?.type === "data_table"
      ) {
        const cheatsheetData =
          (tab.artifact.data as CheatSheetData) ||
          (() => {
            try {
              return typeof tab.artifact.content === "string"
                ? JSON.parse(tab.artifact.content)
                : null;
            } catch {
              return null;
            }
          })() || {
            id: tab.artifact.id,
            learnId: tab.artifact.learnId,
            title: tab.artifact.title || "CheatSheet",
            cards: [],
          };
        if (cheatsheetData) {
          return (
            <CheatSheetViewer
              artifact={tab.artifact}
              data={{
                ...cheatsheetData,
                id: tab.artifact.id || cheatsheetData.id,
                learnId: tab.artifact.learnId || cheatsheetData.learnId,
              }}
              onExplainInChat={onExplainInChat}
              onToggleExpand={onToggleCollapse}
              isExpanded={!isCollapsed}
            />
          );
        }
      }
      return null;
    }
    if (tab.type === "mind_map") {
      return <MindMapTab tab={tab} />;
    }
    return (
      <ReviewTab
        mutations={mutations}
        onRollbackFile={onRollbackFile}
        onRollbackAll={onRollbackAll}
        onOpenFileDiff={onOpenFileDiff}
      />
    );
  };

  // Unified Sidebar View with smooth width and tab animation
  return (
    <aside
      style={{ width: isCollapsed ? 48 : (width || 400) }}
      className={cn(
        "h-full flex flex-col relative bg-card rounded-2xl border border-border/50 text-foreground shrink-0 select-none overflow-hidden shadow-xs font-sans",
        !isResizing && "transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
      )}
    >
      {/* Global Persistent Toggle Button (Stationary in top-right corner, zero jitter) */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute top-2 right-2 z-30 h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
          title={isCollapsed ? (t("openStudioPanel") || "Expand Panel") : (t("hidePanel") || "Collapse panel")}
          aria-label={t("studioTitle")}
        >
          <PanelRight className="h-4 w-4" />
        </button>
      )}

      {/* Collapsed Rail View (Staggered dissolve to prevent icon collision) */}
      <div
        className={cn(
          "w-12 h-full flex flex-col items-center pt-12 pb-3 bg-card text-muted-foreground select-none font-sans absolute top-0 right-0 z-10 origin-top-right transition-all ease-out",
          isCollapsed
            ? "opacity-100 scale-100 pointer-events-auto duration-200 delay-100"
            : "opacity-0 scale-95 pointer-events-none duration-150 delay-0"
        )}
      >
        {/* 2-mode mini switcher */}
        <div className="flex flex-col items-center gap-1 pb-2 border-b border-border/40 w-full px-1">
          <button
            type="button"
            onClick={() => {
              onModeChange("studio");
              onToggleCollapse?.();
            }}
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
              mode === "studio"
                ? "bg-primary text-primary-foreground"
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
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            title={`Preview (${mutations.length} changes)`}
          >
            <Layers className="h-3.5 w-3.5" />
            {mutations.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
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
          onClick={() => {
            onAddNote?.();
            if (isCollapsed) onToggleCollapse?.();
          }}
          className="h-8 w-8 rounded-xl bg-muted/60 hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border/40 shadow-xs mt-auto"
          title={t("addNote")}
          aria-label={t("addNote")}
        >
          <SquarePen className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded Content View (Staggered dissolve to prevent icon collision) */}
      <div
        style={{ width: `${width || 400}px`, minWidth: `${width || 400}px` }}
        className={cn(
          "h-full flex flex-col absolute top-0 right-0 origin-top-right transition-all ease-out",
          isCollapsed
            ? "opacity-0 scale-[0.98] pointer-events-none duration-150 delay-0"
            : "opacity-100 scale-100 pointer-events-auto duration-200 delay-100"
        )}
      >
        {/* Top Header with 2 Menus: Studio & Review */}
        <div
              className={`h-12 pl-3 pr-12 bg-card flex items-center justify-between shrink-0 select-none ${
                mode === "studio" ? "border-b-0" : "border-b border-border"
              }`}
            >
              {/* Segmented Control: [ Studio ] [ Review (N) ] */}
              <div className="relative flex items-center bg-muted/70 p-0.5 rounded-xl border border-border">
                {/* Animated Sliding Background Pill */}
                <div
                  className="absolute top-0.5 bottom-0.5 rounded-lg bg-background shadow-xs transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none"
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
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
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
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t("review") || "Review"}</span>
                  {mutations.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-sans tabular-nums text-[10px] font-semibold ml-0.5">
                      {mutations.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

        {/* Main Body based on Active Menu with smooth fade */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {/* Studio Content */}
          <div
            className={cn(
              "flex-1 flex flex-col min-h-0 select-none",
              mode === "studio" ? "flex" : "hidden"
            )}
            style={{ display: mode === "studio" ? "flex" : "none" }}
          >
              <ScrollArea className="flex-1 w-full min-h-0" viewportClassName="p-3 sm:p-3.5 [&>div]:!flex [&>div]:!flex-col [&>div]:!min-h-full">
                {/* Grid of Studio Tools */}
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
                            <span className="bg-foreground text-background text-[9.5px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-2xs">
                              {t("badgeNew")}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
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
              <div className={cn("flex-1 flex flex-col min-h-0", artifacts && artifacts.length > 0 ? "space-y-2 mb-4" : "justify-center")}>
                {artifacts && artifacts.length > 0 ? (
                  <div className="space-y-2">
                    {artifacts.map((art) => {
                      const isGenerating = art.status === "generating";
                      const ItemIcon = getArtifactIcon(art.type, art.isZip);

                      if (isGenerating) {
                        const isMindMap = art.type === "mind_map";
                        const isQuiz = art.type === "quiz";
                        const isFlashcard = art.type === "flashcard" || art.type === "flashcards";
                        const isVideo = art.type === "video_summary";
                        const isSlides = art.type === "slides";
                        const isInfographic = art.type === "infographic";
                        const isReport = art.type === "report";
                        const defaultGeneratingTitle = isInfographic
                          ? (language === "id" ? "Membuat Infografis..." : "Creating Infographic...")
                          : isVideo
                          ? (language === "id" ? "Membuat Ringkasan Video..." : "Creating Video Summary...")
                          : isSlides
                          ? (language === "id" ? "Menyusun Presentasi..." : "Creating Presentation...")
                          : isReport
                          ? (language === "id" ? "Menyusun Laporan..." : "Creating Report...")
                          : isMindMap
                          ? (language === "id" ? "Membuat Peta Pikiran..." : "Creating Mind Map...")
                          : isQuiz
                          ? (language === "id" ? "Membuat Kuis..." : "Creating Quiz...")
                          : isFlashcard
                          ? (language === "id" ? "Membuat Kartu Tanya-Jawab..." : "Creating Flashcards...")
                          : (language === "id" ? "Membuat Catatan..." : "Creating Note...");

                        return (
                          <div
                            key={art.id}
                            className={cn(
                              "p-3 rounded-2xl bg-card flex items-center gap-3 select-none animate-pulse shadow-xs border",
                              isInfographic
                                ? "border-purple-500/30"
                                : isVideo
                                ? "border-emerald-500/30"
                                : isSlides
                                ? "border-amber-500/30"
                                : isReport
                                ? "border-foreground/30"
                                : isMindMap
                                ? "border-purple-500/30"
                                : isQuiz
                                ? "border-amber-500/30"
                                : isFlashcard
                                ? "border-emerald-500/30"
                                : "border-blue-500/30"
                            )}
                          >
                            <div
                              className={cn(
                                "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                                isInfographic
                                  ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                  : isVideo
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : isSlides
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                  : isReport
                                  ? "bg-foreground/10 border-foreground/20 text-foreground"
                                  : isMindMap
                                  ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
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
                                  isInfographic
                                    ? "text-purple-400"
                                    : isVideo
                                    ? "text-emerald-400"
                                    : isSlides
                                    ? "text-amber-400"
                                    : isReport
                                    ? "text-foreground"
                                    : isMindMap
                                    ? "text-purple-400"
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
                                {art.title || defaultGeneratingTitle}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {language === "id"
                                  ? `berdasarkan ${art.sourcesCount ?? 1} sumber`
                                  : `based on ${art.sourcesCount ?? 1} source${
                                      (art.sourcesCount ?? 1) === 1 ? "" : "s"
                                    }`}
                              </div>
                            </div>
                            {onDeleteArtifact && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteArtifact(art.id);
                                }}
                                className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                title={language === "id" ? "Hapus" : "Delete"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      }

                      const isQuiz = art.type === "quiz";
                      const isFlashcard = art.type === "flashcard" || art.type === "flashcards";
                      const isMindMap = art.type === "mind_map";
                      const isSlides = art.type === "slides";
                      const isVideo = art.type === "video_summary";
                      const isInfographic = art.type === "infographic";
                      const isReport = art.type === "report";
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
                          ? (language === "id" ? `${itemCount} Soal` : `${itemCount} Questions`)
                          : isFlashcard
                          ? (language === "id" ? `${itemCount} Kartu` : `${itemCount} Cards`)
                          : isSlides
                          ? (language === "id" ? `${itemCount} Slide` : `${itemCount} Slide${itemCount > 1 ? "s" : ""}`)
                          : isVideo
                          ? (language === "id" ? `${itemCount} Scene` : `${itemCount} Scenes`)
                          : isReport
                          ? (language === "id" ? `${itemCount} Bagian` : `${itemCount} Section${itemCount > 1 ? "s" : ""}`)
                          : null
                        : isMindMap
                        ? (language === "id" ? "Peta Konsep" : "Concept Map")
                        : isInfographic
                        ? (art.data?.styleLabel || (language === "id" ? "Poster Visual" : "Visual Poster"))
                        : null;

                      const handleOpenThis = () => {
                        if (onOpenArtifact) onOpenArtifact(art);
                        else if (onSelectArtifact) onSelectArtifact(art);
                      };

                      return (
                        <div
                          key={art.id}
                          onClick={handleOpenThis}
                          className="p-3 rounded-2xl bg-card hover:bg-secondary/70 border border-border hover:border-border/80 transition-all flex items-center justify-between gap-2.5 cursor-pointer group shadow-xs active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="h-9 w-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground shrink-0 transition-colors">
                              <ItemIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
                                {art.title}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {countText ? `${countText} · ` : art.sourcesCount
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
                                className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                title="Opsi"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-44 p-1 shadow-xl bg-popover border-border"
                            >
                              <DropdownMenuItem
                                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-popover-foreground hover:text-popover-foreground"
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
                                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-popover-foreground hover:text-popover-foreground"
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
                                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-popover-foreground hover:text-popover-foreground"
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
                              <DropdownMenuSeparator className="bg-border" />
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
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 my-auto min-h-[160px]">
                    <div className="h-12 w-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-muted-foreground mb-3 shadow-2xs">
                      <Layers className="h-6 w-6 stroke-[1.5]" />
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
            </ScrollArea>

            {/* "+ Tambahkan catatan" Clean Fixed Footer (Never buggy on scroll) */}
            <div className="p-3 pt-2 flex justify-center shrink-0 border-t border-transparent bg-gradient-to-t from-card via-card/90 to-transparent">
              <button
                type="button"
                onClick={onAddNote}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shadow-md active:scale-98 cursor-pointer border border-border"
              >
                <SquarePen className="h-4 w-4 stroke-[2]" />
                <span>{t("addNote")}</span>
              </button>
            </div>
          </div>

          {/* Review Sidepanel (Persistent Stack keeping tabs mounted) */}
          <div
            className={cn(
              "flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden bg-background animate-in fade-in duration-200",
              mode === "preview" ? "flex" : "hidden"
            )}
            style={{ display: mode === "preview" ? "flex" : "none" }}
          >
            {/* Harness Tab Header with +, Search Dropdown, Drag & Drop */}
            <TabHeader
              tabs={tabs}
              activeTabId={activeTabId}
              isOpeningNewTab={Boolean(isOpeningNewTab)}
              onSelectTab={onSelectTab}
              onCloseTab={onCloseTab}
              onNewTab={onNewTab || (() => {})}
              onReorderTabs={onReorderTabs}
              onToggleMuteTab={(tabId) => {
                const target = tabs.find((t) => t.id === tabId);
                if (target) {
                  onUpdateTab?.(tabId, { isMuted: !target.isMuted });
                }
              }}
            />

            {/* Persistent Tab Stack Viewport */}
            <div className="flex-1 w-full h-[calc(100%-40px)] min-h-0 relative overflow-hidden flex flex-col bg-background">
              {isOpeningNewTab || tabs.length === 0 ? (
                <OpenTabView onSelectTabType={onOpenTabType || (() => {})} />
              ) : null}

              {tabs.map((tab) => {
                const isTabActive = !isOpeningNewTab && tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    className={cn(
                      "w-full h-full min-h-0",
                      isTabActive ? "flex flex-col flex-1" : "hidden"
                    )}
                    style={{ display: isTabActive ? "flex" : "none" }}
                  >
                    {renderTabContent(tab)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
