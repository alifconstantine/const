import React, { useState, useRef, useEffect } from "react";
import {
  ChevronsDown,
  Plus,
  X,
  SquareTerminal,
  FileText,
  MessageSquare,
  Globe,
  Search,
  Activity,
  Layers,
  Volume2,
  VolumeX,
  Bot,
  FolderTree,
  Waypoints,
} from "lucide-react";
import { FileIcon } from "../workbench/file-icon";
import type { RightPaneTab, RightPaneTabType } from "./types";
import { useTranslation } from "../../lib/i18n";

interface TabHeaderProps {
  tabs: RightPaneTab[];
  activeTabId: string | null;
  isOpeningNewTab: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  onToggleMuteTab?: (tabId: string) => void;
  onCollapse?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function getTabIcon(type: RightPaneTabType) {
  switch (type) {
    case "terminal":
      return SquareTerminal;
    case "review":
      return Layers;
    case "directory":
      return FolderTree;
    case "file_diff":
    case "file_preview":
      return FileText;
    case "side_conversation":
      return MessageSquare;
    case "browser":
      return Globe;
    case "task_output":
      return Activity;
    case "trajectory":
      return Waypoints;
    case "subagent":
      return Bot;
    default:
      return SquareTerminal;
  }
}

function TabFavicon({
  favicon,
  fallbackIcon: FallbackIcon,
  isActive,
}: {
  favicon?: string;
  fallbackIcon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [favicon]);

  if (favicon && !hasError) {
    return (
      <img
        src={favicon}
        alt=""
        className="w-3.5 h-3.5 shrink-0 object-contain rounded-xs pointer-events-none"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <FallbackIcon
      className={`w-3.5 h-3.5 shrink-0 pointer-events-none ${
        isActive ? "text-white" : "text-[#8e8e8e] group-hover:text-white"
      }`}
    />
  );
}

export function TabHeader({
  tabs,
  activeTabId,
  isOpeningNewTab,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onReorderTabs,
  onToggleMuteTab,
  onCollapse,
  isExpanded = false,
  onToggleExpand,
}: TabHeaderProps) {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  // Drag and drop state
  const isDraggingRef = useRef(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"left" | "right" | null>(null);

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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    isDraggingRef.current = true;
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
      isDraggingRef.current = false;
    }, 60);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  // Filter tabs for the dropdown search
  const filteredTabs = tabs.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="h-11 w-full border-b border-[#dedee2] dark:border-[#282828] bg-[#fbfbfb] dark:bg-[#141414] flex items-center px-3 shrink-0 select-none relative z-30"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* 1. Leftmost: ChevronsDown Button for Searching / Switching Open Tabs */}
      <div
        className={`relative shrink-0 ${isDropdownOpen ? "z-50" : ""}`}
        ref={dropdownRef}
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => {
            setIsDropdownOpen((prev) => !prev);
            setSearchQuery("");
          }}
          className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
            isDropdownOpen
              ? "bg-white/10 text-white"
              : "text-[#8e8e8e] hover:text-white hover:bg-white/5"
          }`}
          title={t("rightPane.switchSearchTabs")}
          aria-label={t("rightPane.switchSearchTabs")}
        >
          <ChevronsDown className="w-3.5 h-3.5" />
        </button>

        {/* Dropdown Popover */}
        {isDropdownOpen && (
          <div className="absolute top-8 left-0 w-64 rounded-xl bg-[#1e1e1e] border border-[#333333] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#282828] border border-[#383838] mb-2 text-xs">
              <Search className="w-3.5 h-3.5 text-[#888888] shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={t("rightPane.searchOpenTabs")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-white placeholder-[#666666] outline-none text-xs"
              />
            </div>

            {/* List of tabs */}
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {filteredTabs.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#666666]">
                  {t("rightPane.noTabsFound")}
                </div>
              ) : (
                filteredTabs.map((tItem) => {
                  const Icon = getTabIcon(tItem.type);
                  const isActive = !isOpeningNewTab && tItem.id === activeTabId;
                  return (
                    <div
                      key={tItem.id}
                      onClick={() => {
                        onSelectTab(tItem.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer group transition-colors ${
                        isActive
                          ? "bg-white/10 text-white font-medium"
                          : "text-[#a0a0a0] hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {tItem.type === "file_diff" || tItem.type === "file_preview" || (tItem.type === "directory" && tItem.filePath) ? (
                          <FileIcon filename={tItem.filePath || tItem.title} className="w-3.5 h-3.5 shrink-0" />
                        ) : tItem.type === "browser" ? (
                          <TabFavicon favicon={tItem.favicon} fallbackIcon={Icon} isActive={isActive} />
                        ) : (
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{tItem.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(tItem.id, e);
                        }}
                        className="p-0.5 rounded hover:bg-white/10 text-[#666666] hover:text-white transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
                        title={t("rightPane.closeTab")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Action: Open new tab */}
            <div className="mt-2 pt-2 border-t border-[#333333]">
              <button
                type="button"
                onClick={() => {
                  onNewTab();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#8e8e8e] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>{t("rightPane.openNewTab")}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Middle: Scrollable Tab Strip with tabs and '+' button immediately following the last tab */}
      <div
        ref={tabListRef}
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        onDragOver={(e) => {
          if (draggedIndex !== null) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(e) => {
          if (e.target === tabListRef.current && draggedIndex !== null && onReorderTabs) {
            e.preventDefault();
            onReorderTabs(draggedIndex, tabs.length - 1);
            handleDragEnd();
          }
        }}
        className="flex-1 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0 pl-1.5 pr-[175px]"
      >
        {tabs.map((tab, index) => {
          const Icon = getTabIcon(tab.type);
          const isActive = !isOpeningNewTab && tab.id === activeTabId;
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
                if (!isDraggingRef.current) {
                  onSelectTab(tab.id);
                }
              }}
              className={`relative h-7 px-2.5 rounded-md flex items-center gap-1.5 text-xs shrink-0 cursor-grab active:cursor-grabbing transition-all group select-none ${
                isBeingDragged
                  ? "opacity-35 scale-95 border border-dashed border-[#555]"
                  : isActive
                  ? "bg-[#252525] border border-[#383838] text-white shadow-sm font-medium"
                  : "text-[#8e8e8e] hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {/* Drop position indicator lines */}
              {isDropTarget && dropPosition === "left" && (
                <div className="absolute -left-[3px] top-1 bottom-1 w-[2.5px] bg-[#888888] dark:bg-[#aaaaaa] rounded-full z-30 pointer-events-none" />
              )}
              {isDropTarget && dropPosition === "right" && (
                <div className="absolute -right-[3px] top-1 bottom-1 w-[2.5px] bg-[#888888] dark:bg-[#aaaaaa] rounded-full z-30 pointer-events-none" />
              )}

              {tab.type === "file_diff" || tab.type === "file_preview" || (tab.type === "directory" && tab.filePath) ? (
                <FileIcon filename={tab.filePath || tab.title} className="w-3.5 h-3.5 shrink-0 pointer-events-none" />
              ) : tab.type === "browser" ? (
                <TabFavicon favicon={tab.favicon} fallbackIcon={Icon} isActive={isActive} />
              ) : (
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 pointer-events-none ${
                    isActive ? "text-white" : "text-[#8e8e8e] group-hover:text-white"
                  }`}
                />
              )}
              <span className="truncate max-w-[120px] pointer-events-none">{tab.title}</span>

              {tab.isAudible && (
                <button
                  type="button"
                  draggable={false}
                  onDragStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMuteTab?.(tab.id);
                  }}
                  className={`p-0.5 rounded cursor-pointer transition-colors shrink-0 ml-0.5 ${
                    tab.isMuted
                      ? "text-amber-400 hover:text-amber-300"
                      : "text-blue-400 hover:text-blue-300 animate-pulse"
                  }`}
                  title={tab.isMuted ? t("rightPane.unmuteTab") : t("rightPane.muteTab")}
                  aria-label={tab.isMuted ? t("rightPane.unmuteTab") : t("rightPane.muteTab")}
                >
                  {tab.isMuted ? (
                    <VolumeX className="w-3 h-3 pointer-events-none" />
                  ) : (
                    <Volume2 className="w-3 h-3 pointer-events-none" />
                  )}
                </button>
              )}

              <button
                type="button"
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id, e);
                }}
                className={`p-0.5 rounded ml-0.5 cursor-pointer transition-colors ${
                  isActive
                    ? "text-[#888888] hover:text-white hover:bg-white/10"
                    : "text-transparent group-hover:text-[#888888] hover:!text-white hover:bg-white/10"
                }`}
                title={t("rightPane.closeTab")}
              >
                <X className="w-3 h-3 pointer-events-none" />
              </button>
            </div>
          );
        })}

        {/* 3. '+' Button located immediately to the right of the last tab pill */}
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
          className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
            isOpeningNewTab
              ? "bg-white/10 text-white"
              : "text-[#8e8e8e] hover:text-white hover:bg-white/10"
          }`}
          title={t("rightPane.openNewTab")}
          aria-label={t("rightPane.openNewTab")}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
