import React, { useRef } from "react";
import { FileText, MessageSquare, Globe, RotateCcw } from "lucide-react";
import { TabHeader } from "./tab-header";
import { OpenTabView } from "./open-tab-view";
import { TerminalTab } from "./terminal-tab";
import { TaskOutputTab } from "./task-output-tab";
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
          /* Review Changes Tab */
          <div className="flex-1 w-full h-full p-4 overflow-y-auto text-white flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#282828]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-neutral-400" />
                <h3 className="text-sm font-medium text-neutral-200">Review Changes</h3>
              </div>
              <span className="text-xs text-neutral-500">
                {mutations?.length || 0} modified files
              </span>
            </div>

            {!mutations || mutations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                <FileText className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">No pending file modifications in this session.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mutations.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="p-3 rounded-lg bg-[#1e1e1e] border border-[#2e2e2e] flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-medium text-neutral-200 truncate">
                          {m.filePath}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                            m.operation === "create"
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : m.operation === "delete"
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {m.operation}
                        </span>
                      </div>
                      {onRollbackFile && (
                        <button
                          type="button"
                          onClick={() => onRollbackFile(m)}
                          className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          title="Revert file"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
