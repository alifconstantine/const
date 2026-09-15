import React, { useRef } from "react";
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
} from "lucide-react";
import { TabHeader } from "./tab-header";
import { ReviewTab } from "./review-tab";
import { FileDiffTab } from "./file-diff-tab";
import { FilePreviewTab } from "./file-preview-tab";
import { OpenTabView } from "./open-tab-view";
import { BrowserTab } from "./browser-tab";
import { STUDIO_TOOLS } from "../workspace/studio-panel";
import { useI18n } from "../../lib/i18n";
import type { RightPaneTab, RightPaneTabType } from "./types";
import type { FileMutationRecord } from "@const/agent";

export interface RightPaneProps {
  width?: number;
  onWidthChange?: (width: number) => void;
  isCollapsed?: boolean;
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
}

export function RightPane({
  width,
  onWidthChange,
  isCollapsed = false,
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
}: RightPaneProps) {
  const { t } = useI18n();

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width || 400);

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onWidthChange || isCollapsed) return;
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

  // Collapsed Sidebar view
  if (isCollapsed) {
    return (
      <div className="w-12 h-full flex flex-col items-center py-3 bg-card rounded-2xl border border-border/50 text-muted-foreground shrink-0 select-none shadow-xs font-sans">
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
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              mode === "studio"
                ? "bg-[#0066ff] text-white"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
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
            className={`relative h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              mode === "preview"
                ? "bg-[#0066ff] text-white"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
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
                  if (mode !== "studio") onModeChange("studio");
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
    );
  }

  // Expanded Sidebar view
  return (
    <aside
      style={{ width: width ? `${width}px` : undefined }}
      className="w-[290px] sm:w-[320px] lg:w-[370px] xl:w-[430px] 2xl:w-[480px] h-full flex flex-col relative bg-card rounded-2xl border border-border/50 text-foreground shrink-0 select-none overflow-hidden shadow-xs font-sans"
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

      {/* Top Header with 2 Menus: Studio & Review */}
      <div
        className={`h-12 px-3 bg-[#1e1e20] flex items-center justify-between shrink-0 select-none ${
          mode === "studio" ? "border-b-0" : "border-b border-[#282828]"
        }`}
      >
        {/* Segmented Control: [ Studio ] [ Review (N) ] */}
        <div className="flex items-center gap-1 bg-[#141416] p-0.5 rounded-xl border border-[#2d2d30]">
          <button
            type="button"
            onClick={() => onModeChange("studio")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer select-none ${
              mode === "studio"
                ? "bg-[#28282b] text-white shadow-2xs"
                : "text-[#888888] hover:text-[#d4d4d4] hover:bg-white/[0.02]"
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>{t("studio") || "Studio"}</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("preview")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer select-none ${
              mode === "preview"
                ? "bg-[#28282b] text-white shadow-2xs"
                : "text-[#888888] hover:text-[#d4d4d4] hover:bg-white/[0.02]"
            }`}
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

      {/* Main Body based on Active Menu */}
      {mode === "studio" ? (
        /* Studio Content */
        <div className="flex-1 flex flex-col p-3 sm:p-3.5 overflow-y-auto min-h-0 select-none">
          {/* 3x3 Grid of Studio Tools */}
          <div className="grid grid-cols-3 gap-2 mb-6">
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
                  <span className={`text-[11px] sm:text-xs font-medium ${tool.textColor || "text-foreground"} tracking-tight leading-snug line-clamp-2 mt-auto`}>
                    {toolName}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Section: Artifacts / Downloads (matching mobile StudioSheet) */}
          {artifacts && (
            <div className="pt-2 space-y-2.5 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {t("artifacts") || "Hasil Artefak & Unduhan"}
                </span>
                {artifacts.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/80 border border-border/60 font-mono text-muted-foreground">
                    {artifacts.length === 1
                      ? t("filesCountSingle") || "1 file"
                      : t("filesCount", { count: artifacts.length }) || `${artifacts.length} files`}
                  </span>
                )}
              </div>

              {artifacts.length > 0 ? (
                <div className="space-y-2">
                  {artifacts.map((art) => (
                    <div
                      key={art.id}
                      className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-lg bg-secondary text-muted-foreground border border-border/40 flex items-center justify-center shrink-0">
                          {art.isZip ? <Package className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">
                            {art.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {art.isZip ? "ZIP Archive / Folder" : art.type || "Document"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDownloadArtifact?.(art)}
                        className="h-7 px-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-border/60 shrink-0"
                      >
                        <Download className="h-3 w-3" />
                        <span>{t("download") || "Unduh"}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Empty State Studio Output */}
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
      ) : (
        /* Review Sidepanel matching apps/harness/desktop */
        <div className="flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden bg-[#141414]">
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
              <BrowserTab key={activeTab.id} tab={activeTab} onUpdateTab={onUpdateTab} />
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
    </aside>
  );
}
