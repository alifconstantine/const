import React, { useRef } from "react";
import { MessageSquare, Globe } from "lucide-react";
import { TabHeader } from "./tab-header";
import { OpenTabView } from "./open-tab-view";
import { TerminalTab } from "./terminal-tab";
import { TaskOutputTab } from "./task-output-tab";
import { ReviewTab } from "./review-tab";
import { FileDiffTab } from "./file-diff-tab";
import { FilePreviewTab } from "./file-preview-tab";
import type { RightPaneTab, RightPaneTabType } from "./types";
import type { FileMutationRecord } from "../../vite-env";

interface RightPaneProps {
  width: number;
  onWidthChange: (width: number) => void;
  tabs: RightPaneTab[];
  activeTabId: string | null;
  isOpeningNewTab: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
  onOpenTabType: (type: RightPaneTabType) => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  workspacePath?: string;
  mutations?: FileMutationRecord[];
  onRollbackFile?: (record: FileMutationRecord) => Promise<any> | void;
  onRollbackAll?: (records: FileMutationRecord[]) => Promise<any> | void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
  onStopTask?: (taskId: string) => void;
}

export function RightPane({
  width,
  onWidthChange,
  tabs,
  activeTabId,
  isOpeningNewTab,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onOpenTabType,
  onReorderTabs,
  workspacePath,
  mutations,
  onRollbackFile,
  onRollbackAll,
  onOpenFileDiff,
  onStopTask,
}: RightPaneProps) {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = startXRef.current - moveEvent.clientX;
      const newWidth = Math.max(320, Math.min(window.innerWidth * 0.75, startWidthRef.current + deltaX));
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

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <aside
      className="h-full flex flex-col relative bg-[#141414] border-l border-[#262626] shrink-0 overflow-hidden z-20"
      style={{ width: `${width}px` }}
    >
      {/* Draggable resize handle on the left edge */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onWidthChange(480)}
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-white/20 transition-colors z-30 group"
        title="Drag to resize, double-click to reset"
      >
        <div className="w-0.5 h-full bg-transparent group-hover:bg-blue-500/50" />
      </div>

      {/* Top Tab Bar matching Image 1 */}
      <TabHeader
        tabs={tabs}
        activeTabId={activeTabId}
        isOpeningNewTab={isOpeningNewTab}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onNewTab={onNewTab}
        onReorderTabs={onReorderTabs}
      />

      {/* Main Tab Body */}
      <div className="flex-1 w-full h-[calc(100%-40px)] min-h-0 relative overflow-hidden flex flex-col bg-[#141414]">
        {isOpeningNewTab || tabs.length === 0 || !activeTab ? (
          /* Empty / New Tab Picker matching Image 2 1:1 */
          <OpenTabView onSelectTabType={onOpenTabType} />
        ) : activeTab.type === "terminal" ? (
          /* Interactive Terminal matching Image 1 1:1 */
          <TerminalTab key={activeTab.id} tab={activeTab} />
        ) : activeTab.type === "task_output" ? (
          /* Background Task Output Tab */
          <TaskOutputTab key={activeTab.id} tab={activeTab} onStopTask={onStopTask} />
        ) : activeTab.type === "review" ? (
          /* Review Changes Tab matching Image 3 */
          <ReviewTab
            key={activeTab.id}
            mutations={mutations}
            onRollbackFile={onRollbackFile}
            onRollbackAll={onRollbackAll}
            onOpenFileDiff={onOpenFileDiff}
          />
        ) : activeTab.type === "file_diff" ? (
          /* Single File Diff Tab matching Image 1 & Image 4 */
          <FileDiffTab
            key={activeTab.id}
            tab={activeTab}
            onRollbackFile={onRollbackFile}
          />
        ) : activeTab.type === "file_preview" ? (
          /* File Preview Tab (Markdown rendered / Code viewer) matching Image 2 */
          <FilePreviewTab
            key={activeTab.id}
            tab={activeTab}
          />
        ) : activeTab.type === "side_conversation" ? (
          /* Side Conversation Tab */
          <div className="flex-1 w-full h-full p-4 text-white flex flex-col items-center justify-center text-center">
            <MessageSquare className="w-8 h-8 mb-2 text-neutral-500 opacity-60" />
            <h4 className="text-sm font-medium text-neutral-300 mb-1">Side Conversation</h4>
            <p className="text-xs text-neutral-500 max-w-xs">
              Open a separate scratchpad conversation alongside your main thread.
            </p>
          </div>
        ) : (
          /* Browser Tab */
          <div className="flex-1 w-full h-full p-4 text-white flex flex-col items-center justify-center text-center">
            <Globe className="w-8 h-8 mb-2 text-neutral-500 opacity-60" />
            <h4 className="text-sm font-medium text-neutral-300 mb-1">Browser Preview</h4>
            <p className="text-xs text-neutral-500 max-w-xs mb-3">
              Inspect web interfaces or local dev server URLs.
            </p>
            {workspacePath && (
              <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
                Workspace: {workspacePath}
              </span>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
