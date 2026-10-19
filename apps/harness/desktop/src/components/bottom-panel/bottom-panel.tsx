import React, { useState, useRef, useEffect } from "react";
import {
  SquareTerminal,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Trash2,
} from "lucide-react";
import { TerminalTab } from "../right-pane/terminal-tab";
import type { RightPaneTab } from "../right-pane/types";
import { useTranslation } from "../../lib/i18n";
import { cn } from "@const/ui";

interface BottomPanelProps {
  height: number;
  onHeightChange: (height: number) => void;
  tabs: RightPaneTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onClose: () => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  onClearTerminal?: (tabId: string) => void;
  onDraggingChange?: (isDragging: boolean) => void;
}

export function BottomPanel({
  height,
  onHeightChange,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onClose,
  onReorderTabs,
  onClearTerminal,
  onDraggingChange,
}: BottomPanelProps) {
  const { t } = useTranslation();
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(height);

  // Drag and drop state for terminal tabs
  const isTabDraggingRef = useRef(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"left" | "right" | null>(null);

  const isMaximized = height >= 450;

  const handleToggleExpand = () => {
    if (isMaximized) {
      onHeightChange(260);
    } else {
      const maxHeight = Math.max(380, Math.round(window.innerHeight * 0.65));
      onHeightChange(maxHeight);
    }
  };

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    onDraggingChange?.(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startYRef.current - moveEvent.clientY;
      const minHeight = 130;
      const maxHeight = Math.max(minHeight, Math.round(window.innerHeight * 0.75));
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + deltaY));
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      onDraggingChange?.(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    isTabDraggingRef.current = true;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? "left" : "right";

    if (dragOverIndex !== index || dropPosition !== position) {
      setDragOverIndex(index);
      setDropPosition(position);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || !onReorderTabs) {
      handleDragEnd();
      return;
    }

    if (draggedIndex === index) {
      handleDragEnd();
      return;
    }

    let targetIndex = index;
    if (draggedIndex < index) {
      targetIndex = dropPosition === "left" ? index - 1 : index;
    } else {
      targetIndex = dropPosition === "left" ? index : index + 1;
    }
    targetIndex = Math.max(0, Math.min(tabs.length - 1, targetIndex));

    onReorderTabs(draggedIndex, targetIndex);
    handleDragEnd();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
    setTimeout(() => {
      isTabDraggingRef.current = false;
    }, 60);
  };

  return (
    <div
      className="w-full shrink-0 flex flex-col relative bg-[#101010] text-[#d4d4d4] border-t border-[#dedee2] dark:border-[#282828] z-30 overflow-hidden select-none rounded-b-[10px]"
      style={{ height: `${height}px` }}
    >
      {/* Draggable resize handle on top edge */}
      <div
        onMouseDown={handleMouseDownResize}
        onDoubleClick={handleToggleExpand}
        className="absolute top-0 left-0 right-0 h-1.5 -translate-y-1/2 cursor-row-resize hover:bg-[#3b82f6]/40 transition-colors z-40 group"
        title={t("bottomPanel.dragToResize")}
      >
        <div className="w-full h-[1px] bg-transparent group-hover:bg-[#3b82f6]" />
      </div>

      {/* Tab Header matching reference video & SidePanel */}
      <div
        onDoubleClick={handleToggleExpand}
        className="h-9 px-2.5 flex items-center justify-between shrink-0 bg-[#f8f8f8] dark:bg-[#161616] border-b border-[#dedee2] dark:border-[#282828]"
      >
        {/* Left: Tab items & Add Button */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const isBeingDragged = draggedIndex === index;
            const isDropTarget = dragOverIndex === index && draggedIndex !== index;

            return (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (!isTabDraggingRef.current) {
                    onSelectTab(tab.id);
                  }
                }}
                className={cn(
                  "relative group flex items-center gap-1.5 h-6.5 px-2.5 rounded text-xs font-medium cursor-grab active:cursor-grabbing transition-all select-none",
                  isBeingDragged
                    ? "opacity-35 scale-95 border border-dashed border-[#555]"
                    : isActive
                    ? "bg-white dark:bg-[#202020] text-[#171717] dark:text-[#f0f0f0] border border-[#dedee2] dark:border-[#333333] shadow-xs"
                    : "text-[#737373] hover:text-[#171717] dark:hover:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent"
                )}
                title={tab.cwd ? `${tab.title} (${tab.cwd})` : tab.title}
              >
                {/* Drop position indicator lines */}
                {isDropTarget && dropPosition === "left" && (
                  <div className="absolute -left-[3px] top-1 bottom-1 w-[2.5px] bg-[#3b82f6] rounded-full z-30 pointer-events-none" />
                )}
                {isDropTarget && dropPosition === "right" && (
                  <div className="absolute -right-[3px] top-1 bottom-1 w-[2.5px] bg-[#3b82f6] rounded-full z-30 pointer-events-none" />
                )}

                <SquareTerminal className="w-3.5 h-3.5 shrink-0 opacity-80 pointer-events-none" />
                <span className="truncate max-w-[140px] pointer-events-none">{tab.title || "Terminal"}</span>
                <button
                  type="button"
                  draggable={false}
                  onDragStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[#888888] hover:text-[#171717] dark:hover:text-white transition-colors ml-0.5 cursor-pointer"
                  title={t("rightPane.closeTab")}
                  aria-label={t("rightPane.closeTab")}
                >
                  <X className="w-3 h-3 pointer-events-none" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onNewTab}
            onDragOver={(e) => {
              if (draggedIndex !== null) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverIndex(-1);
                setDropPosition("right");
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedIndex !== null && onReorderTabs) {
                onReorderTabs(draggedIndex, tabs.length - 1);
              }
              handleDragEnd();
            }}
            className="w-6 h-6 flex items-center justify-center rounded text-[#737373] hover:text-[#171717] dark:hover:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t("bottomPanel.newTerminal")}
            aria-label={t("bottomPanel.newTerminal")}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Actions (Clear terminal, Expand/Restore size, Close panel) */}
        <div className="flex items-center gap-0.5 shrink-0 ml-auto">
          {onClearTerminal && activeTabId && (
            <button
              type="button"
              onClick={() => onClearTerminal(activeTabId)}
              className="w-6 h-6 flex items-center justify-center rounded text-[#737373] hover:text-[#171717] dark:hover:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title={t("bottomPanel.clearTerminal")}
              aria-label={t("bottomPanel.clearTerminal")}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleExpand}
            className="w-6 h-6 flex items-center justify-center rounded text-[#737373] hover:text-[#171717] dark:hover:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={isMaximized ? t("bottomPanel.restorePanel") : t("bottomPanel.expandPanel")}
            aria-label={isMaximized ? t("bottomPanel.restorePanel") : t("bottomPanel.expandPanel")}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-[#737373] hover:text-[#171717] dark:hover:text-[#d4d4d4] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t("bottomPanel.closePanel")}
            aria-label={t("bottomPanel.closePanel")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Persistent Terminal Sessions Body */}
      <div className="flex-1 w-full min-h-0 relative overflow-hidden bg-[#101010]">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                "w-full h-full min-h-0",
                isActive ? "flex flex-col flex-1 relative z-10" : "hidden"
              )}
              style={isActive ? { display: "flex" } : { display: "none" }}
            >
              <TerminalTab tab={tab} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
