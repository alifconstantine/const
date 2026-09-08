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
import {
  ConstLogoIcon,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast,
} from "@const/ui";
import { AutoScrollTitle } from "../auto-scroll-title";

interface TopToolbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
  conversationTitle?: string;
  project?: string;
  conversationId?: string;
  isPinned?: boolean;
  workspacePath?: string;
  onTogglePin?: () => void;
  onOpenRename?: () => void;
  onArchive?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onOpenTrajectory?: () => void;
  isRightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
  onOpenTerminal?: () => void;
}

export function TopToolbar({
  isSidebarOpen,
  onToggleSidebar,
  onNewChat,
  conversationTitle,
  project,
  conversationId,
  isPinned = false,
  workspacePath,
  onTogglePin,
  onOpenRename,
  onArchive,
  onOpenSettings,
  onOpenTrajectory,
  isRightSidebarOpen = false,
  onToggleRightSidebar,
  onOpenTerminal,
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

  const handleOpenInExplorer = async () => {
    try {
      if (workspacePath && window.electron?.openPath) {
        const ok = await window.electron.openPath(workspacePath);
        if (ok) return;
      }
      if (window.electron?.getConversationPaths && window.electron?.openPath) {
        const paths = await window.electron.getConversationPaths(conversationId, workspacePath);
        if (paths.workspacePath) {
          await window.electron.openPath(paths.workspacePath);
        } else if (paths.taskPath) {
          await window.electron.openPath(paths.taskPath);
        }
      }
    } catch {
      toast.error("Failed to open file explorer");
    }
  };

  const handleCopyPath = async () => {
    try {
      let targetPath = workspacePath;
      if (!targetPath && window.electron?.getConversationPaths) {
        const paths = await window.electron.getConversationPaths(conversationId, workspacePath);
        targetPath = paths.workspacePath || paths.taskPath;
      }
      if (targetPath) {
        await navigator.clipboard.writeText(targetPath);
        toast.success("Path copied to clipboard");
      } else {
        toast.error("No active path available");
      }
    } catch {
      toast.error("Failed to copy path");
    }
  };

  const handleCopyTaskPath = async () => {
    try {
      if (window.electron?.getConversationPaths) {
        const paths = await window.electron.getConversationPaths(conversationId, workspacePath);
        if (paths.taskPath) {
          await navigator.clipboard.writeText(paths.taskPath);
          toast.success("Task path copied to clipboard");
          return;
        }
      }
      if (conversationId) {
        await navigator.clipboard.writeText(`task://${conversationId}`);
        toast.success("Task path copied");
      }
    } catch {
      toast.error("Failed to copy task path");
    }
  };

  const handleCopyLogPath = async () => {
    try {
      if (window.electron?.getConversationPaths) {
        const paths = await window.electron.getConversationPaths(conversationId, workspacePath);
        if (paths.logPath) {
          await navigator.clipboard.writeText(paths.logPath);
          toast.success("Log path copied to clipboard");
          return;
        }
      }
      toast.error("No log path found");
    } catch {
      toast.error("Failed to copy log path");
    }
  };

  const handleCopySessionId = async () => {
    if (conversationId) {
      try {
        await navigator.clipboard.writeText(conversationId);
        toast.success("Session ID copied to clipboard");
      } catch {
        toast.error("Failed to copy session ID");
      }
    }
  };

  const handleReportIssue = () => {
    const url = "https://github.com/alifconstantine/const/issues";
    if (window.electron?.openExternal) {
      window.electron.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div
      className="h-11 w-full flex items-center justify-between px-3 shrink-0 select-none z-30"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left section: Conversation breadcrumb / title and project badge */}
      <div
        className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden mr-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {!isSidebarOpen && (
          <>
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-[#222222] text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer group flex items-center justify-center"
              title="Open sidebar"
              aria-label="Open sidebar"
            >
              <ConstLogoIcon size="sm" className="w-5 h-5 group-hover:hidden" />
              <PanelLeft className="w-5 h-5 hidden group-hover:block text-[#262626] dark:text-[#d4d4d4]" />
            </button>

            <div className="flex items-center gap-0.5 text-[#262626] dark:text-[#d4d4d4]">
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-[#222222] hover:text-black dark:hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Go back"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-[#222222] hover:text-black dark:hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Go forward"
                aria-label="Go forward"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onNewChat}
              className="p-1.5 ml-1 rounded-md text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-[#222222] transition-colors cursor-pointer"
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
            <AutoScrollTitle
              text={conversationTitle}
              className="max-w-[280px]"
              textClassName="text-sm font-medium text-[#161616] dark:text-[#ececec]"
            />

            {project && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#333333] text-xs text-[#262626] dark:text-[#a0a0a0] shrink-0">
                <Folder className="w-3 h-3 text-[#a9a9a9] dark:text-[#999999]" />
                <span className="truncate max-w-[140px]">{project}</span>
              </div>
            )}

            {/* Three-dots menu matching Image 2 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-[#222222] text-[#a9a9a9] dark:text-[#888888] hover:text-[#262626] dark:hover:text-[#d4d4d4] transition-colors cursor-pointer data-[state=open]:bg-black/5 dark:data-[state=open]:bg-[#222222] data-[state=open]:text-white"
                  title="Task options"
                  aria-label="Task options"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="w-56 bg-[#222222] border border-[#383838] text-[#d4d4d4] rounded-xl p-1 shadow-none select-none z-50 font-sans text-[13px]"
              >
                <DropdownMenuItem
                  onClick={onTogglePin}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {isPinned ? "Unpin task" : "Pin task"}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onOpenRename}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  Rename task
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onArchive}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  Archive task
                </DropdownMenuItem>

                <DropdownMenuSeparator className="h-[1px] bg-[#383838] my-1 -mx-1" />

                <DropdownMenuItem
                  onClick={handleOpenInExplorer}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  Open in File Explorer
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyPath}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  Copy path
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyTaskPath}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  Copy task path
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyLogPath}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  Copy log path
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopySessionId}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  Copy session ID
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onOpenSettings?.("general")}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  Go to config
                </DropdownMenuItem>

                <DropdownMenuSeparator className="h-[1px] bg-[#383838] my-1 -mx-1" />

                <DropdownMenuItem
                  onClick={onOpenTrajectory}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  View model trajectory
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleReportIssue}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  Report issue
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Right section: Terminal, Right Panel, and Window Controls */}
      <div
        className="flex items-center gap-1 text-[#262626] dark:text-[#d4d4d4] shrink-0 ml-auto"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >

        <button
          type="button"
          onClick={onOpenTerminal}
          className="p-1.5 rounded-lg text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-[#222222] transition-colors cursor-pointer"
          title="Open terminal"
          aria-label="Open terminal"
        >
          <SquareTerminal className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleRightSidebar}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isRightSidebarOpen
              ? "bg-black/10 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10 shadow-xs"
              : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-[#222222]"
          }`}
          title={isRightSidebarOpen ? "Close right sidebar" : "Open right sidebar"}
          aria-label="Toggle right sidebar"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Hairline Divider */}
        <div className="w-[1px] h-3.5 bg-[#e2e2e4] dark:bg-[#383838]/70 mx-1" />

        {/* Window Controls (Minimize, Maximize/Restore, Close) */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleMaximize}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
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
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#e81123] text-[#262626] dark:text-[#d4d4d4] hover:text-white transition-colors cursor-pointer"
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
