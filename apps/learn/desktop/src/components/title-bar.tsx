import React, { useEffect } from "react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
  useTheme,
  cn,
} from "@const/ui";
import { useI18n } from "../lib/i18n";

interface TitleBarProps {
  className?: string;
  onOpenFolder?: (folderPath: string) => void;
}

export function TitleBar({ className, onOpenFolder }: TitleBarProps) {
  const [theme] = useTheme();
  const { t } = useI18n();

  const isMac =
    typeof window !== "undefined" &&
    window.electron?.platform === "darwin";

  const isWin =
    typeof window !== "undefined" &&
    window.electron?.platform === "win32";

  // Dynamic theme update for Windows titleBarOverlay to match Antigravity
  useEffect(() => {
    if (!isWin || !window.electron?.window?.setTitleBarOverlay) return;
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    window.electron.window.setTitleBarOverlay({
      color: isDark ? "#161616" : "#f3f3f3",
      symbolColor: isDark ? "#d4d4d4" : "#374151",
      height: 30,
    });
  }, [theme, isWin]);

  // Window control actions
  const handleMinimize = () => {
    window.electron?.window?.minimize?.() || window.electron?.minimize?.();
  };

  const handleMaximize = () => {
    window.electron?.window?.maximize?.() || window.electron?.maximize?.();
  };

  const handleClose = () => {
    window.electron?.window?.close?.() || window.electron?.close?.();
  };

  const handleOpenFolder = async () => {
    if (window.electron?.openDirectoryDialog) {
      const folderPath = await window.electron.openDirectoryDialog();
      if (folderPath) {
        if (onOpenFolder) {
          onOpenFolder(folderPath);
        } else {
          window.dispatchEvent(
            new CustomEvent("const:open-workspace-folder", {
              detail: { folderPath },
            })
          );
        }
      }
    }
  };

  const handleZoomIn = async () => {
    if (window.electron?.window?.getZoomLevel && window.electron?.window?.setZoomLevel) {
      const current = await window.electron.window.getZoomLevel();
      await window.electron.window.setZoomLevel(current + 0.5);
    }
  };

  const handleZoomOut = async () => {
    if (window.electron?.window?.getZoomLevel && window.electron?.window?.setZoomLevel) {
      const current = await window.electron.window.getZoomLevel();
      await window.electron.window.setZoomLevel(Math.max(-2, current - 0.5));
    }
  };

  const handleResetZoom = async () => {
    if (window.electron?.window?.setZoomLevel) {
      await window.electron.window.setZoomLevel(0);
    }
  };

  const handleToggleFullscreen = () => {
    if (window.electron?.window?.toggleFullScreen) {
      window.electron.window.toggleFullScreen();
    }
  };

  const handleToggleDevTools = () => {
    if (window.electron?.window?.toggleDevTools) {
      window.electron.window.toggleDevTools();
    }
  };

  return (
    <header
      className={cn(
        "h-[30px] min-h-[30px] w-full flex items-center justify-between bg-[#161616] text-[#d4d4d4] text-[12px] select-none shrink-0 z-50 transition-colors",
        isMac ? "pl-[72px] pr-2" : isWin ? "pl-2 pr-[140px]" : "px-2",
        className
      )}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left side: Minimalist Brand Name + Menubar */}
      <div
        className="flex items-center gap-1 h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* Minimalist Antigravity-style Title: plain text ConstLearn */}
        <span className="text-[12px] text-[#d4d4d4] font-normal pl-2 pr-1 select-none tracking-normal">
          ConstLearn
        </span>

        {/* Unified Application Menubar */}
        <Menubar className="border-none bg-transparent h-[22px] p-0 space-x-0.5 shadow-none rounded-none">
          {/* File Menu */}
          <MenubarMenu>
            <MenubarTrigger className="h-[22px] px-2 text-[12px] font-normal text-[#969696] hover:text-[#d4d4d4] hover:bg-white/5 data-[state=open]:bg-white/5 data-[state=open]:text-[#d4d4d4] rounded-[4px] transition-colors cursor-pointer select-none">
              {t("menuFile") || "File"}
            </MenubarTrigger>
            <MenubarContent className="min-w-[13rem] rounded-xl shadow-xl bg-[#1e1e1e] border border-[#383838] text-[#d4d4d4]">
              <MenubarItem
                onClick={() => window.dispatchEvent(new CustomEvent("const:new-learn"))}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("newLearn") || "New Learn"}
                <MenubarShortcut>{isMac ? "⌘K" : "Ctrl+K"}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => window.dispatchEvent(new CustomEvent("const:new-collection"))}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("newCollection") || "New Collection"}
                <MenubarShortcut>{isMac ? "⇧⌘N" : "Ctrl+Shift+N"}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator className="bg-[#383838]" />
              <MenubarItem
                onClick={handleOpenFolder}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuOpenFolder") || "Open Workspace Folder..."}
                <MenubarShortcut>{isMac ? "⌘O" : "Ctrl+O"}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator className="bg-[#383838]" />
              <MenubarItem
                onClick={() => window.dispatchEvent(new CustomEvent("const:open-settings"))}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("settings") || "Settings"}
                <MenubarShortcut>{isMac ? "⌘," : "Ctrl+,"}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator className="bg-[#383838]" />
              <MenubarItem
                onClick={handleClose}
                className="cursor-pointer text-xs text-rose-400 hover:text-rose-300 focus:text-rose-300 hover:bg-white/5 focus:bg-white/5"
              >
                {t("menuExit") || "Exit"}
                <MenubarShortcut>{isMac ? "⌘Q" : "Alt+F4"}</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* Edit Menu */}
          <MenubarMenu>
            <MenubarTrigger className="h-[22px] px-2 text-[12px] font-normal text-[#969696] hover:text-[#d4d4d4] hover:bg-white/5 data-[state=open]:bg-white/5 data-[state=open]:text-[#d4d4d4] rounded-[4px] transition-colors cursor-pointer select-none">
              {t("menuEdit") || "Edit"}
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem] rounded-xl shadow-xl bg-[#1e1e1e] border border-[#383838] text-[#d4d4d4]">
              <MenubarItem
                onClick={() => document.execCommand("undo")}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuUndo") || "Undo"}
                <MenubarShortcut>{isMac ? "⌘Z" : "Ctrl+Z"}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => document.execCommand("redo")}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuRedo") || "Redo"}
                <MenubarShortcut>{isMac ? "⇧⌘Z" : "Ctrl+Y"}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator className="bg-[#383838]" />
              <MenubarItem
                onClick={() => document.execCommand("cut")}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuCut") || "Cut"}
                <MenubarShortcut>{isMac ? "⌘X" : "Ctrl+X"}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => document.execCommand("copy")}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuCopy") || "Copy"}
                <MenubarShortcut>{isMac ? "⌘C" : "Ctrl+C"}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => document.execCommand("paste")}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuPaste") || "Paste"}
                <MenubarShortcut>{isMac ? "⌘V" : "Ctrl+V"}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator className="bg-[#383838]" />
              <MenubarItem
                onClick={() => document.execCommand("selectAll")}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuSelectAll") || "Select All"}
                <MenubarShortcut>{isMac ? "⌘A" : "Ctrl+A"}</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* View Menu */}
          <MenubarMenu>
            <MenubarTrigger className="h-[22px] px-2 text-[12px] font-normal text-[#969696] hover:text-[#d4d4d4] hover:bg-white/5 data-[state=open]:bg-white/5 data-[state=open]:text-[#d4d4d4] rounded-[4px] transition-colors cursor-pointer select-none">
              {t("menuView") || "View"}
            </MenubarTrigger>
            <MenubarContent className="min-w-[13rem] rounded-xl shadow-xl bg-[#1e1e1e] border border-[#383838] text-[#d4d4d4]">
              <MenubarItem
                onClick={() => window.dispatchEvent(new CustomEvent("const:toggle-sidebar"))}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuToggleSidebar") || "Toggle Sidebar"}
                <MenubarShortcut>{isMac ? "⌘B" : "Ctrl+B"}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator className="bg-[#383838]" />
              <MenubarItem
                onClick={handleZoomIn}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuZoomIn") || "Zoom In"}
                <MenubarShortcut>{isMac ? "⌘+" : "Ctrl+="}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={handleZoomOut}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuZoomOut") || "Zoom Out"}
                <MenubarShortcut>{isMac ? "⌘-" : "Ctrl+-"}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={handleResetZoom}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuResetZoom") || "Reset Zoom"}
                <MenubarShortcut>{isMac ? "⌘0" : "Ctrl+0"}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator className="bg-[#383838]" />
              <MenubarItem
                onClick={handleToggleFullscreen}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuToggleFullscreen") || "Toggle Full Screen"}
                <MenubarShortcut>F11</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={handleToggleDevTools}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuDevTools") || "Developer Tools"}
                <MenubarShortcut>{isMac ? "⌥⌘I" : "Ctrl+Shift+I"}</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* Window Menu */}
          <MenubarMenu>
            <MenubarTrigger className="h-[22px] px-2 text-[12px] font-normal text-[#969696] hover:text-[#d4d4d4] hover:bg-white/5 data-[state=open]:bg-white/5 data-[state=open]:text-[#d4d4d4] rounded-[4px] transition-colors cursor-pointer select-none">
              {t("menuWindow") || "Window"}
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem] rounded-xl shadow-xl bg-[#1e1e1e] border border-[#383838] text-[#d4d4d4]">
              <MenubarItem
                onClick={handleMinimize}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuMinimize") || "Minimize"}
                <MenubarShortcut>{isMac ? "⌘M" : "Ctrl+M"}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={handleMaximize}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuMaximize") || "Maximize / Restore"}
              </MenubarItem>
              <MenubarSeparator className="bg-[#383838]" />
              <MenubarItem
                onClick={handleClose}
                className="cursor-pointer text-xs hover:bg-white/5 hover:text-[#d4d4d4] focus:bg-white/5 focus:text-[#d4d4d4] text-[#d4d4d4]"
              >
                {t("menuClose") || "Close"}
                <MenubarShortcut>{isMac ? "⌘W" : "Ctrl+W"}</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      {/* Center draggable region */}
      <div className="flex-1 h-full" />

      {/* Right side: Native Windows 11 window controls are overlaid automatically by Electron titleBarOverlay */}
    </header>
  );
}
