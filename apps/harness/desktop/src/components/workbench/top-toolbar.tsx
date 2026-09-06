import React, { useState, useEffect } from "react";
import {
  SquareTerminal,
  PanelRight,
  ArrowLeft,
  ArrowRight,
  MessageCirclePlus,
  PanelLeft,
  Minus,
  Square,
  Copy,
  X,
  Folder,
  MoreHorizontal,
} from "lucide-react";
import { ConstLogoIcon } from "@const/ui";

interface TopToolbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
  conversationTitle?: string;
  project?: string;
  diffStats?: { additions: number; deletions: number };
}

export function TopToolbar({
  isSidebarOpen,
  onToggleSidebar,
  onNewChat,
  conversationTitle,
  project,
  diffStats,
}: TopToolbarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial maximized state
    window.electron?.isMaximized?.().then((max) => setIsMaximized(Boolean(max)));

    // Listen to maximize/unmaximize changes
    const cleanup = window.electron?.onMaximizedChange?.((max) => {
      setIsMaximized(max);
    });

    return () => {
      cleanup?.();
    };
  }, []);

  const handleMinimize = () => {
    window.electron?.minimize?.();
  };

  const handleMaximize = () => {
    window.electron?.maximize?.();
  };

  const handleClose = () => {
    window.electron?.close?.();
  };

  return (
    <div
      className="h-11 w-full flex items-center justify-between px-3 shrink-0 select-none z-30"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left section: Conversation breadcrumb / title and project badge */}
      <div
        className="flex items-center gap-2 min-w-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {!isSidebarOpen && (
          <>
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg hover:bg-[#222222] text-[#d4d4d4] transition-colors cursor-pointer group flex items-center justify-center"
              title="Open sidebar"
              aria-label="Open sidebar"
            >
              <ConstLogoIcon size="sm" className="w-5 h-5 group-hover:hidden" />
              <PanelLeft className="w-5 h-5 hidden group-hover:block text-[#d4d4d4]" />
            </button>

            <div className="flex items-center gap-0.5 text-[#d4d4d4]">
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-[#222222] hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Go back"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-[#222222] hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Go forward"
                aria-label="Go forward"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onNewChat}
              className="p-1.5 ml-1 rounded-md text-[#d4d4d4] hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
              title="New task"
              aria-label="New task"
            >
              <MessageCirclePlus className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Conversation Title & Project Pill */}
        {conversationTitle && (
          <div className="flex items-center gap-2 min-w-0 pl-1">
            <span className="text-sm font-medium text-[#ececec] truncate max-w-[280px]">
              {conversationTitle}
            </span>

            {project && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#222222] border border-[#333333] text-xs text-[#a0a0a0] shrink-0">
                <Folder className="w-3 h-3 text-[#999999]" />
                <span className="truncate max-w-[140px]">{project}</span>
              </div>
            )}

            <button
              type="button"
              className="p-1 rounded hover:bg-[#222222] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer"
              title="More options"
              aria-label="More options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Right section: Folder, Changes, Terminal, Right Panel, and Window Controls */}
      <div
        className="flex items-center gap-1 text-[#d4d4d4]"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >

        {/* Changes Badge (+X -Y) */}
        {diffStats && (diffStats.additions > 0 || diffStats.deletions > 0) && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#222222] border border-[#333333] text-xs font-mono text-[#a0a0a0]">
            <span>Changes</span>
            <span className="text-[#409D62]">+{diffStats.additions}</span>
            <span className="text-[#ff5c5c]">-{diffStats.deletions}</span>
          </div>
        )}

        <button
          type="button"
          className="p-1.5 rounded-lg text-[#d4d4d4] hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
          title="Open terminal"
          aria-label="Open terminal"
        >
          <SquareTerminal className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="p-1.5 rounded-lg text-[#d4d4d4] hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
          title="Toggle right sidebar"
          aria-label="Toggle right sidebar"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Hairline Divider */}
        <div className="w-[1px] h-3.5 bg-[#383838]/70 mx-1" />

        {/* Window Controls (Minimize, Maximize/Restore, Close) */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleMaximize}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#e81123] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
