import React from "react";
import {
  SquareTerminal,
  MessageCirclePlus,
  PanelLeft,
  Folder,
  MoreHorizontal,
  Globe,
} from "lucide-react";
import {
  ConstLogoIcon,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast,
  cn,
} from "@const/ui";
import { AutoScrollTitle } from "../auto-scroll-title";
import { useTranslation } from "../../lib/i18n";

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
  onOpenBrowser?: () => void;
  isBottomPanelOpen?: boolean;
  onToggleBottomPanel?: () => void;
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
  onOpenBrowser,
  isBottomPanelOpen = false,
  onToggleBottomPanel,
}: TopToolbarProps) {
  const { t } = useTranslation();

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
      toast.error(t("toast.failedToOpenExplorer"));
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
        toast.success(t("toast.pathCopied"));
      } else {
        toast.error(t("toast.noActivePath"));
      }
    } catch {
      toast.error(t("toast.failedToCopyPath"));
    }
  };

  const handleCopyTaskPath = async () => {
    try {
      if (window.electron?.getConversationPaths) {
        const paths = await window.electron.getConversationPaths(conversationId, workspacePath);
        if (paths.taskPath) {
          await navigator.clipboard.writeText(paths.taskPath);
          toast.success(t("toast.taskPathCopied"));
          return;
        }
      }
      if (conversationId) {
        await navigator.clipboard.writeText(`task://${conversationId}`);
        toast.success(t("toast.taskPathCopied"));
      }
    } catch {
      toast.error(t("toast.failedToCopyTaskPath"));
    }
  };

  const handleCopyLogPath = async () => {
    try {
      if (window.electron?.getConversationPaths) {
        const paths = await window.electron.getConversationPaths(conversationId, workspacePath);
        if (paths.logPath) {
          await navigator.clipboard.writeText(paths.logPath);
          toast.success(t("toast.logPathCopied"));
          return;
        }
      }
      toast.error(t("toast.noLogPath"));
    } catch {
      toast.error(t("toast.failedToCopyLogPath"));
    }
  };

  const handleCopySessionId = async () => {
    if (conversationId) {
      try {
        await navigator.clipboard.writeText(conversationId);
        toast.success(t("toast.sessionIdCopied"));
      } catch {
        toast.error(t("toast.failedToCopySessionId"));
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleSidebar();
              }}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-[#222222] text-[#262626] dark:text-[#d4d4d4] outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 active:bg-transparent transition-colors cursor-pointer flex items-center justify-center select-none"
              title={t("topToolbar.toggleSidebar")}
              aria-label={t("topToolbar.toggleSidebar")}
            >
              <PanelLeft className="w-4 h-4 text-[#262626] dark:text-[#d4d4d4]" />
            </button>

            <button
              type="button"
              onClick={() => onNewChat?.()}
              className="p-1.5 rounded-lg text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-[#222222] transition-colors cursor-pointer flex items-center justify-center"
              title={typeof navigator !== "undefined" && navigator?.userAgent?.includes("Mac") ? `${t("sidebar.newChat")} (⌘N)` : `${t("sidebar.newChat")} (Ctrl+N)`}
              aria-label={t("sidebar.newChat")}
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
                  title={t("topToolbar.taskOptions")}
                  aria-label={t("topToolbar.taskOptions")}
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
                  {isPinned ? t("topToolbar.unpinTask") : t("topToolbar.pinTask")}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onOpenRename}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.renameTask")}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onArchive}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.archiveTask")}
                </DropdownMenuItem>

                <DropdownMenuSeparator className="h-[1px] bg-[#383838] my-1 -mx-1" />

                <DropdownMenuItem
                  onClick={handleOpenInExplorer}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.openInExplorer")}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyPath}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.copyPath")}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyTaskPath}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.copyTaskPath")}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyLogPath}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.copyLogPath")}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopySessionId}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.copySessionId")}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onOpenSettings?.("general")}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.goToConfig")}
                </DropdownMenuItem>

                <DropdownMenuSeparator className="h-[1px] bg-[#383838] my-1 -mx-1" />

                <DropdownMenuItem
                  onClick={onOpenTrajectory}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.viewModelTrajectory")}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleReportIssue}
                  className="px-3 py-1.5 text-[13px] text-[#d4d4d4] hover:text-white focus:text-white hover:bg-[#303030] focus:bg-[#303030] rounded-lg cursor-pointer outline-none transition-colors"
                >
                  {t("topToolbar.reportIssue")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Right section: Terminal, Browser, and spacing to fixed controls */}
      <div
        className={cn(
          "flex items-center gap-1 text-[#262626] dark:text-[#d4d4d4] shrink-0 ml-auto transition-[padding] duration-300",
          !isRightSidebarOpen ? "pr-[145px]" : "pr-1"
        )}
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => onOpenBrowser?.()}
          className="p-1.5 rounded-lg text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-[#222222] transition-colors cursor-pointer"
          title={t("topToolbar.openBrowser")}
          aria-label={t("topToolbar.openBrowser")}
        >
          <Globe className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleBottomPanel || onOpenTerminal}
          className={cn(
            "p-1.5 rounded-lg transition-colors cursor-pointer",
            isBottomPanelOpen
              ? "bg-black/10 dark:bg-white/10 text-black dark:text-white"
              : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-[#222222]"
          )}
          title={isBottomPanelOpen ? "Close bottom panel (Ctrl+J)" : "Toggle bottom panel (Ctrl+J)"}
          aria-label="Toggle bottom panel (Ctrl+J)"
        >
          <SquareTerminal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
