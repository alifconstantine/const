import React, { useRef, useEffect } from "react";
import { X, Layers, FileText } from "lucide-react";
import { FileIcon } from "../workspace/file-icon";
import type { RightPaneTab } from "./types";

interface TabHeaderProps {
  tabs: RightPaneTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onToggleSidebar?: () => void;
}

export function TabHeader({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}: TabHeaderProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new tabs are appended
  const prevTabsLengthRef = useRef(tabs.length);
  useEffect(() => {
    if (tabs.length > prevTabsLengthRef.current && tabListRef.current) {
      tabListRef.current.scrollTo({
        left: tabListRef.current.scrollWidth,
        behavior: "smooth",
      });
    }
    prevTabsLengthRef.current = tabs.length;
  }, [tabs.length]);

  return (
    <div className="h-9 px-1.5 bg-[#1a1a1a] border-b border-[#282828] flex items-center justify-between shrink-0 select-none text-xs">
      {/* Scrollable Tab Strip */}
      <div
        ref={tabListRef}
        onWheel={(e) => {
          if (e.deltaY !== 0 && tabListRef.current) {
            tabListRef.current.scrollLeft += e.deltaY;
          }
        }}
        className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1 h-full py-1"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isReview = tab.type === "review";

          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-sans transition-all cursor-pointer border shrink-0 group select-none ${
                isActive
                  ? "bg-[#252528] text-white border-[#383838] font-medium shadow-2xs"
                  : "bg-transparent text-[#999999] hover:text-white hover:bg-white/[0.04] border-transparent"
              }`}
              title={tab.filePath || tab.title}
            >
              {isReview ? (
                <Layers className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#0066ff]" : "text-[#888888]"}`} />
              ) : tab.filePath || tab.title ? (
                <FileIcon filename={tab.filePath || tab.title} className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 shrink-0 text-[#888888]" />
              )}

              <span className="truncate max-w-[140px]">{tab.title}</span>

              {/* Close Button for non-review tabs */}
              {!isReview && (
                <button
                  type="button"
                  onClick={(e) => onCloseTab(tab.id, e)}
                  className="w-4 h-4 rounded hover:bg-white/10 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity ml-0.5"
                  title="Close tab"
                >
                  <X className="w-3 h-3 text-[#aaaaaa]" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
