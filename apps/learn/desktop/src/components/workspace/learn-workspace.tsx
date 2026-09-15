import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb } from "../../lib/db";
import {
  ArrowLeft,
  Check,
  Sun,
  Moon,
  Laptop,
  LogOut,
  ArrowLeftRight,
  User as UserIcon,
  Settings,
  Globe,
  Hand,
  ShieldAlert,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  useTheme,
  cn,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@const/ui";
import { useI18n, LANGUAGE_OPTIONS } from "../../lib/i18n";
import { SourcesPanel } from "./sources-panel";
import { ChatPanel } from "./chat-panel";
import { RightPane, type RightPaneTab, type RightPaneTabType } from "../right-pane";
import { AddSourceDialog } from "./add-source-dialog";
import { SettingsView } from "../settings/settings-view";
import { ErrorBoundary } from "../ui/error-boundary";
import type { FileMutationRecord } from "@const/agent";

interface LearnWorkspaceProps {
  learnId: string;
  initialSourceModalOpen?: boolean;
  onBack: () => void;
  onCreateNew?: () => void;
  user?: any;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
}

export function LearnWorkspace({
  learnId,
  initialSourceModalOpen = false,
  onBack,
  onCreateNew,
  user,
  onSignOut,
  onSwitchAccount,
}: LearnWorkspaceProps) {
  const [theme, setTheme] = useTheme();
  const { t, language, setLanguage } = useI18n();

  // Live notebook data from Dexie
  const learn = useLiveQuery(async () => {
    return await db.learns.get(learnId);
  }, [learnId]);

  // Live artifacts from Dexie
  const artifacts = useLiveQuery(async () => {
    return await db.artifacts.where("learnId").equals(learnId).toArray();
  }, [learnId]);

  // Dialog & Panel states
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(initialSourceModalOpen);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [isStudioCollapsed, setIsStudioCollapsed] = useState(false);
  const [pendingStudioPrompt, setPendingStudioPrompt] = useState<string | null>(null);

  // Right Pane: Dual Studio & Preview/Review state
  const [rightPaneMode, setRightPaneMode] = useState<"studio" | "preview">("studio");
  const [rightPaneTabs, setRightPaneTabs] = useState<RightPaneTab[]>([
    { id: "review", type: "review", title: "Review" },
  ]);
  const [activeRightPaneTabId, setActiveRightPaneTabId] = useState<string>("review");
  const [isOpeningNewTab, setIsOpeningNewTab] = useState(false);
  const [sessionMutations, setSessionMutations] = useState<FileMutationRecord[]>([]);

  const handleOpenFileDiff = (mutation: FileMutationRecord) => {
    setIsStudioCollapsed(false);
    setRightPaneMode("preview");
    setIsOpeningNewTab(false);

    const filePath = mutation.filePath || mutation.targetFile || "";
    const fileName =
      filePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
      filePath ||
      "Diff";

    const existing = rightPaneTabs.find(
      (t) =>
        t.type === "file_diff" &&
        (t.filePath === filePath ||
          t.mutation?.targetFile === mutation.targetFile ||
          t.title === fileName)
    );

    if (existing) {
      setRightPaneTabs((prev) =>
        prev.map((t) =>
          t.id === existing.id
            ? {
                ...t,
                mutation,
                filePath,
                previousContent: mutation.previousContent,
                newContent: mutation.newContent,
              }
            : t
        )
      );
      setActiveRightPaneTabId(existing.id);
      return;
    }

    const newTab: RightPaneTab = {
      id: `diff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "file_diff",
      title: fileName,
      filePath,
      mutation,
      previousContent: mutation.previousContent,
      newContent: mutation.newContent,
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
  };

  const handleSelectTab = (tabId: string) => {
    setIsOpeningNewTab(false);
    setActiveRightPaneTabId(tabId);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRightPaneTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      if (activeRightPaneTabId === tabId) {
        if (next.length > 0) {
          const nextActive = next[Math.min(idx, next.length - 1)];
          setActiveRightPaneTabId(nextActive?.id || "review");
        } else {
          setActiveRightPaneTabId("review");
        }
      }
      return next;
    });
  };

  const handleNewTab = () => {
    setIsStudioCollapsed(false);
    setRightPaneMode("preview");
    setIsOpeningNewTab(true);
  };

  const handleOpenTabType = (type: RightPaneTabType) => {
    setIsOpeningNewTab(false);
    if (type === "review") {
      const existing = rightPaneTabs.find((t) => t.type === "review");
      if (existing) {
        setActiveRightPaneTabId(existing.id);
      } else {
        const reviewTab: RightPaneTab = {
          id: "review",
          type: "review",
          title: "Review",
        };
        setRightPaneTabs((prev) => [reviewTab, ...prev]);
        setActiveRightPaneTabId("review");
      }
    } else if (type === "browser") {
      const browserTab: RightPaneTab = {
        id: `browser_${Date.now()}`,
        type: "browser",
        title: "Browser",
        url: "https://google.com",
      };
      setRightPaneTabs((prev) => [...prev, browserTab]);
      setActiveRightPaneTabId(browserTab.id);
    } else if (type === "file_preview") {
      const previewTab: RightPaneTab = {
        id: `preview_${Date.now()}`,
        type: "file_preview",
        title: "Untitled",
      };
      setRightPaneTabs((prev) => [...prev, previewTab]);
      setActiveRightPaneTabId(previewTab.id);
    }
  };

  const handleReorderTabs = (fromIndex: number, toIndex: number) => {
    setRightPaneTabs((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(fromIndex, 1);
      if (removed) {
        result.splice(toIndex, 0, removed);
      }
      return result;
    });
  };

  const handleUpdateTab = (tabId: string, updates: Partial<RightPaneTab>) => {
    setRightPaneTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t))
    );
  };

  const handleDownloadArtifact = (art: any) => {
    if (art.content) {
      const blob = new Blob([art.content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${art.title || "artifact"}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleRollbackFile = async (record: FileMutationRecord) => {
    const electron = (window as any).electron;
    const rollbackFn = electron?.agent?.rollbackFile || electron?.rollbackFile;
    if (rollbackFn) {
      await rollbackFn(record);
    }
    setSessionMutations((prev) =>
      prev.map((m) => (m.id === record.id ? { ...m, rolledBack: true } : m))
    );
    setRightPaneTabs((prev) =>
      prev.map((t) =>
        t.mutation && t.mutation.id === record.id
          ? { ...t, mutation: { ...t.mutation, rolledBack: true } }
          : t
      )
    );
    try {
      const msgs = await db.messages
        .filter((m) => Boolean(m.mutations?.some((mut) => mut.id === record.id)))
        .toArray();
      for (const msg of msgs) {
        if (msg.mutations) {
          const updated = msg.mutations.map((m) =>
            m.id === record.id ? { ...m, rolledBack: true } : m
          );
          await db.messages.update(msg.id, { mutations: updated });
        }
      }
    } catch {}
  };

  const handleRollbackAll = async (records: FileMutationRecord[]) => {
    const electron = (window as any).electron;
    const rollbackFn = electron?.agent?.rollbackFile || electron?.rollbackFile;
    if (rollbackFn) {
      for (const rec of [...records].reverse()) {
        try {
          await rollbackFn(rec);
        } catch {}
      }
    }
    const recordIds = new Set(records.map((r) => r.id));
    setSessionMutations((prev) =>
      prev.map((m) => (recordIds.has(m.id) ? { ...m, rolledBack: true } : m))
    );
    setRightPaneTabs((prev) =>
      prev.map((t) =>
        t.mutation && recordIds.has(t.mutation.id)
          ? { ...t, mutation: { ...t.mutation, rolledBack: true } }
          : t
      )
    );
    try {
      const msgs = await db.messages
        .filter((m) => Boolean(m.mutations?.some((mut) => recordIds.has(mut.id))))
        .toArray();
      for (const msg of msgs) {
        if (msg.mutations) {
          const updated = msg.mutations.map((m) =>
            recordIds.has(m.id) ? { ...m, rolledBack: true } : m
          );
          await db.messages.update(msg.id, { mutations: updated });
        }
      }
    } catch {}
  };

  // Dynamic responsive default widths
  const getResponsiveWidths = () => {
    if (typeof window === "undefined") {
      return { sources: 330, studio: 400 };
    }
    const w = window.innerWidth;
    if (w >= 1800) {
      // Large 1080p full-screen or 2K/4K: Keep Ask AI comfortably proportioned (~950-1040px max)
      // by giving generous breathing room to Sources (400px) and Studio (480px)
      return { sources: 400, studio: 480 };
    }
    if (w >= 1500) {
      // Standard laptop / scaled 1080p: Ask AI stays balanced (~750-820px)
      return { sources: 350, studio: 420 };
    }
    if (w >= 1300) {
      return { sources: 315, studio: 370 };
    }
    if (w >= 1100) {
      // Medium/compact desktop: Ask AI remains dominant (~520-580px, ~50% width)
      return { sources: 280, studio: 320 };
    }
    // Small desktop window (< 1100px): compact side panels so Ask AI has space
    return { sources: 250, studio: 285 };
  };

  const [sourcesWidth, setSourcesWidth] = useState<number>(() => getResponsiveWidths().sources);
  const [studioWidth, setStudioWidth] = useState<number>(() => getResponsiveWidths().studio);
  const [isManualWidth, setIsManualWidth] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>("general");

  const responsiveDefaults = getResponsiveWidths();
  const isLayoutModified =
    sourcesWidth !== responsiveDefaults.sources || studioWidth !== responsiveDefaults.studio;

  const handleResetLayout = () => {
    setIsManualWidth(false);
    const defaults = getResponsiveWidths();
    setSourcesWidth(defaults.sources);
    setStudioWidth(defaults.studio);
  };

  useEffect(() => {
    const handleResize = () => {
      if (!isManualWidth) {
        const { sources, studio } = getResponsiveWidths();
        setSourcesWidth(sources);
        setStudioWidth(studio);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isManualWidth]);

  // Drag resizing for Sources panel
  const handleSourcesMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsManualWidth(true);
    const startX = e.clientX;
    const startWidth = sourcesWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 230), 520);
      setSourcesWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Drag resizing for Studio panel
  const handleStudioMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsManualWidth(true);
    const startX = e.clientX;
    const startWidth = studioWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 260), 580);
      setStudioWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(t("untitledNotebook"));

  useEffect(() => {
    if (learn?.title) {
      setTitleValue(learn.title);
    }
  }, [learn?.title]);

  const handleSaveTitle = async () => {
    setIsEditingTitle(false);
    const trimmed = titleValue.trim() || t("untitledNotebook");
    setTitleValue(trimmed);
    await localDb.updateLearn(learnId, { title: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setTitleValue(learn?.title || t("untitledNotebook"));
      setIsEditingTitle(false);
    }
  };

  const handleSelectSource = async (sourceType: string) => {
    setIsAddSourceOpen(false);
    if (!learnId) return;

    if (sourceType === "upload") {
      const filePaths = await window.electron?.openFileDialog?.({ multiple: true });
      if (filePaths && filePaths.length > 0) {
        for (const filePath of filePaths) {
          const fileName = filePath.split(/[\\/]/).pop() || t("sourceFileFallback");
          await localDb.createSource({
            learnId,
            title: fileName,
            type: "file",
            path: filePath,
            includedInChat: true,
          });
        }
      }
    } else if (sourceType === "paste") {
      const text = await navigator.clipboard.readText().catch(() => "");
      if (text && text.trim()) {
        const snippet = text.trim().slice(0, 30);
        await localDb.createSource({
          learnId,
          title: t("copiedQuote", { snippet }),
          type: "text",
          content: text,
          size: new Blob([text]).size,
          includedInChat: true,
        });
      }
    } else if (sourceType === "url") {
      const url = window.prompt(t("enterUrlPrompt"));
      if (url && url.trim()) {
        await localDb.createSource({
          learnId,
          title: url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          type: "url",
          url: url.trim(),
          includedInChat: true,
        });
      }
    }
  };

  const handleDropFiles = async (files: File[]) => {
    if (!learnId || !files || files.length === 0) return;
    try {
      const { parseUploadedFile } = await import("../../lib/sources/document-parser");
      for (const file of files) {
        const parsed = await parseUploadedFile(file);
        await localDb.createSource({
          learnId,
          title: parsed.title,
          type: "file",
          content: parsed.content,
          size: parsed.size,
          includedInChat: true,
        });
      }
    } catch (err) {
      console.error("Failed to parse dropped files:", err);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden select-none">
      {/* Top Workspace Header Bar */}
      <header className="h-14 px-4 bg-card/60 backdrop-blur-md border-b border-border/50 flex items-center justify-between shrink-0 z-10">
        {/* Left: Back button + Notebook Title (No Logo, Clean Sans-Serif) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={t("backToHome")}
            aria-label={t("back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Editable Title */}
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                className="text-sm font-medium text-foreground bg-muted/60 rounded-full px-3 py-1 outline-none border border-border/80 min-w-[200px] font-sans"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-semibold text-foreground hover:bg-muted/50 px-2.5 py-1 rounded-full transition-colors cursor-pointer text-left font-sans tracking-tight"
              title={t("clickToRename")}
            >
              {titleValue}
            </button>
          )}

          {learn?.projectPath && (
            <span
              className="hidden md:inline-flex items-center text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 max-w-[220px] truncate"
              title={learn.projectPath}
            >
              📁 {learn.projectPath.split(/[\\/]/).filter(Boolean).pop()}
            </span>
          )}
        </div>

        {/* Right: Reset Layout, Permission Mode & User Account */}
        <div className="flex items-center gap-2">
          {/* Reset Panel Layout Button (Left of Permission Mode) */}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleResetLayout}
                  disabled={!isLayoutModified}
                  aria-label={isLayoutModified ? t("resetLayout") : t("layoutDefault")}
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center transition-all select-none",
                    isLayoutModified
                      ? "text-foreground bg-secondary/70 hover:bg-secondary border border-border/80 shadow-xs cursor-pointer active:scale-95 hover:border-border"
                      : "text-muted-foreground/35 bg-transparent border border-transparent cursor-not-allowed"
                  )}
                  title={isLayoutModified ? t("resetLayoutDesc") : t("layoutDefaultDesc")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center" className="text-xs font-sans">
                {isLayoutModified ? t("resetLayoutDesc") : t("layoutDefaultDesc")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Permission Mode Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border/70 bg-secondary/40 hover:bg-secondary/70 text-foreground transition-all cursor-pointer select-none"
                title={t("permissionModeLabel")}
              >
                {(learn?.permissionMode || "ask_before_changes") === "ask_before_changes" ? (
                  <>
                    <Hand className="h-3.5 w-3.5 text-foreground shrink-0" />
                    <span className="hidden sm:inline">{t("askBeforeChanges")}</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-[#e79737] shrink-0" />
                    <span className="hidden sm:inline text-[#e79737]">{t("fullAccess")}</span>
                  </>
                )}
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5 opacity-70 shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-xl">
              {/* Option 1: Ask before changes */}
              <DropdownMenuItem
                className="cursor-pointer flex items-start gap-2.5 p-2 rounded-xl text-left"
                onClick={async () => {
                  if (learnId) {
                    await localDb.updateLearn(learnId, { permissionMode: "ask_before_changes" });
                  }
                }}
              >
                <Hand className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground">
                    {t("askBeforeChanges")}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {t("askBeforeChangesDesc")}
                  </div>
                </div>
                {(learn?.permissionMode || "ask_before_changes") === "ask_before_changes" && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1 mt-0.5" />
                )}
              </DropdownMenuItem>

              {/* Option 2: Full access */}
              <DropdownMenuItem
                className="cursor-pointer flex items-start gap-2.5 p-2 rounded-xl text-left"
                onClick={async () => {
                  if (learnId) {
                    await localDb.updateLearn(learnId, { permissionMode: "full_access" });
                  }
                }}
              >
                <ShieldAlert className="h-4 w-4 text-[#e79737] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground">
                    {t("fullAccess")}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {t("fullAccessDesc")}
                  </div>
                </div>
                {(learn?.permissionMode || "ask_before_changes") === "full_access" && (
                  <Check className="h-3.5 w-3.5 text-[#e79737] shrink-0 ml-1 mt-0.5" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Account Only */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative flex items-center justify-center rounded-full outline-none ring-offset-background transition-all hover:ring-2 hover:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none"
                aria-label="Account menu"
              >
                <Avatar className="h-7 w-7 rounded-full border border-border/70 transition-transform active:scale-95">
                  {user?.image ? (
                    <AvatarImage
                      src={user.image}
                      alt={user.name || "Avatar"}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-foreground text-background font-sans text-xs font-semibold">
                    {user === undefined ? (
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                    ) : (
                      user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"
                    )}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-md">
              {(user?.name || user?.email) && (
                <>
                  <div className="px-2.5 py-2">
                    {user.name && (
                      <p className="text-xs font-semibold text-foreground truncate">
                        {user.name}
                      </p>
                    )}
                    {user.email && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Settings */}
              <DropdownMenuItem
                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSettingsInitialTab("general");
                  setIsSettingsOpen(true);
                }}
              >
                <Settings className="h-4 w-4" />
                <span>{t("settings")}</span>
              </DropdownMenuItem>

              {/* Theme (Submenu) */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4" />
                  ) : theme === "light" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Laptop className="h-4 w-4" />
                  )}
                  <span>{t("theme")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[140px] p-1.5 shadow-md">
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTheme("system")}
                  >
                    <div className="flex items-center gap-2">
                      <Laptop className="h-3.5 w-3.5" />
                      <span>{t("themeSystem")}</span>
                    </div>
                    {theme === "system" && <Check className="h-3.5 w-3.5 ml-2" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTheme("light")}
                  >
                    <div className="flex items-center gap-2">
                      <Sun className="h-3.5 w-3.5" />
                      <span>{t("themeLight")}</span>
                    </div>
                    {theme === "light" && <Check className="h-3.5 w-3.5 ml-2" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTheme("dark")}
                  >
                    <div className="flex items-center gap-2">
                      <Moon className="h-3.5 w-3.5" />
                      <span>{t("themeDark")}</span>
                    </div>
                    {theme === "dark" && <Check className="h-3.5 w-3.5 ml-2" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Language (Submenu) */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground">
                  <Globe className="h-4 w-4" />
                  <span>{t("language")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[150px] p-1.5 shadow-md">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setLanguage(lang.code)}
                    >
                      <span>{lang.label}</span>
                      {language === lang.code && <Check className="h-3.5 w-3.5 ml-2" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {onSwitchAccount && (
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground"
                  onClick={onSwitchAccount}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>{t("switchAccount")}</span>
                </DropdownMenuItem>
              )}

              {onSignOut && (
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-destructive focus:text-destructive"
                  onClick={onSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("logout")}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 3-Column Floating Cards Body Layout */}
      <div className="flex-1 flex overflow-hidden p-2 sm:p-2.5 gap-1.5 sm:gap-2 bg-background">
        {/* Left Column: Sumber */}
        <SourcesPanel
          learnId={learnId}
          sourcesCount={learn?.sourcesCount || 0}
          width={sourcesWidth}
          onAddSource={() => setIsAddSourceOpen(true)}
          onSelectSource={handleSelectSource}
          onDropFiles={handleDropFiles}
          isCollapsed={isSourcesCollapsed}
          onToggleCollapse={() => setIsSourcesCollapsed(!isSourcesCollapsed)}
        />

        {/* Left Resize Handle */}
        {!isSourcesCollapsed && (
          <div
            onMouseDown={handleSourcesMouseDown}
            onDoubleClick={() => {
              setIsManualWidth(false);
              setSourcesWidth(getResponsiveWidths().sources);
            }}
            className="w-1.5 hover:w-2 -mx-1 sm:-mx-1.5 h-full cursor-col-resize z-20 group flex items-center justify-center transition-all select-none shrink-0"
            title="Drag to resize / Double-click to reset"
          >
            <div className="w-0.5 h-7 rounded-full bg-border/40 group-hover:bg-primary/70 group-hover:h-12 transition-all" />
          </div>
        )}

        {/* Center Column: Socratic Chat */}
        <ChatPanel
          learnId={learnId}
          workspacePath={learn?.projectPath}
          permissionMode={learn?.permissionMode || "ask_before_changes"}
          sourcesCount={learn?.sourcesCount || 0}
          onAddSource={() => setIsAddSourceOpen(true)}
          onOpenSettings={(tab) => {
            setSettingsInitialTab(tab || "models");
            setIsSettingsOpen(true);
          }}
          onSelectPromptChip={(prompt) => {
            console.log("Selected prompt chip:", prompt);
          }}
          externalPrompt={pendingStudioPrompt}
          onExternalPromptConsumed={() => setPendingStudioPrompt(null)}
          onOpenFileDiff={handleOpenFileDiff}
          onMutationsChange={setSessionMutations}
        />

        {/* Right Resize Handle */}
        {!isStudioCollapsed && (
          <div
            onMouseDown={handleStudioMouseDown}
            onDoubleClick={() => {
              setIsManualWidth(false);
              setStudioWidth(getResponsiveWidths().studio);
            }}
            className="w-1.5 hover:w-2 -mx-1 sm:-mx-1.5 h-full cursor-col-resize z-20 group flex items-center justify-center transition-all select-none shrink-0"
            title="Drag to resize / Double-click to reset"
          >
            <div className="w-0.5 h-7 rounded-full bg-border/40 group-hover:bg-primary/70 group-hover:h-12 transition-all" />
          </div>
        )}

        {/* Right Column: Dual Studio & Preview RightPane */}
        <ErrorBoundary
          title="Panel samping mengalami kendala"
          description="Terjadi kesalahan pada panel Studio/Preview."
        >
          <RightPane
            width={studioWidth}
            onWidthChange={(w) => {
              setIsManualWidth(true);
              setStudioWidth(w);
            }}
            isCollapsed={isStudioCollapsed}
            onToggleCollapse={() => setIsStudioCollapsed(!isStudioCollapsed)}
            mode={rightPaneMode}
            onModeChange={setRightPaneMode}
            tabs={rightPaneTabs}
            activeTabId={activeRightPaneTabId}
            isOpeningNewTab={isOpeningNewTab}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onNewTab={handleNewTab}
            onOpenTabType={handleOpenTabType}
            onReorderTabs={handleReorderTabs}
            onUpdateTab={handleUpdateTab}
            mutations={sessionMutations}
            onRollbackFile={handleRollbackFile}
            onRollbackAll={handleRollbackAll}
            onOpenFileDiff={handleOpenFileDiff}
            onSelectStudioTool={undefined}
            onAddNote={() => {
              console.log("Add note clicked");
            }}
            artifacts={artifacts || []}
            onDownloadArtifact={handleDownloadArtifact}
          />
        </ErrorBoundary>
      </div>

      {/* Add Source Pop-up Modal */}
      <AddSourceDialog
        open={isAddSourceOpen}
        onOpenChange={setIsAddSourceOpen}
        learnId={learnId}
        onSelectSource={handleSelectSource}
      />

      {/* Settings Modal / Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <SettingsView
            initialTab={settingsInitialTab}
            onBackToWorkspace={() => setIsSettingsOpen(false)}
            user={user}
            onSignOut={onSignOut}
            onSwitchAccount={onSwitchAccount}
          />
        </div>
      )}
    </div>
  );
}
