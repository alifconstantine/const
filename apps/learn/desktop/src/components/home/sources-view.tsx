import React, { useState, useMemo, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search,
  FileText,
  Globe,
  Plus,
  ExternalLink,
  PanelLeftOpen,
  Trash2,
  BookOpen,
  HardDrive,
  Clipboard,
  Video,
  X,
  ArrowUpRight,
} from "lucide-react";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@const/ui";
import { db, localDb, type LocalSource, type LocalLearn } from "../../lib/db";
import { useI18n } from "../../lib/i18n";
import { DeleteConfirmDialog } from "./dialogs/delete-confirm-dialog";

interface SourcesViewProps {
  onAddSource?: () => void;
  onOpenLearn?: (learnId: string, openAddSource?: boolean) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(timestamp: number, language: "en" | "id"): string {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return language === "id" ? "Baru saja" : "Just now";
  if (minutes < 60) return language === "id" ? `${minutes}m lalu` : `${minutes}m ago`;
  if (hours < 24) return language === "id" ? `${hours}j lalu` : `${hours}h ago`;
  if (days === 1) return language === "id" ? "Kemarin" : "Yesterday";
  if (days < 7) return language === "id" ? `${days}h lalu` : `${days}d ago`;

  const locale = language === "id" ? "id-ID" : "en-US";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(timestamp));
  } catch {
    const d = new Date(timestamp);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }
}

function getSourceIcon(type: LocalSource["type"]) {
  switch (type) {
    case "url":
    case "docs":
      return (
        <div className="h-7 w-7 rounded-lg bg-[#dedee2] dark:bg-[#282828] border border-[#d0d0d4] dark:border-[#383838] text-[#555555] dark:text-[#a0a0a0] flex items-center justify-center shrink-0">
          <Globe className="h-3.5 w-3.5" />
        </div>
      );
    case "youtube":
      return (
        <div className="h-7 w-7 rounded-lg bg-[#dedee2] dark:bg-[#282828] border border-[#d0d0d4] dark:border-[#383838] text-rose-500 flex items-center justify-center shrink-0">
          <Video className="h-3.5 w-3.5" />
        </div>
      );
    case "book":
      return (
        <div className="h-7 w-7 rounded-lg bg-[#dedee2] dark:bg-[#282828] border border-[#d0d0d4] dark:border-[#383838] text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
          <BookOpen className="h-3.5 w-3.5" />
        </div>
      );
    case "drive":
      return (
        <div className="h-7 w-7 rounded-lg bg-[#dedee2] dark:bg-[#282828] border border-[#d0d0d4] dark:border-[#383838] text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <HardDrive className="h-3.5 w-3.5" />
        </div>
      );
    case "text":
      return (
        <div className="h-7 w-7 rounded-lg bg-[#dedee2] dark:bg-[#282828] border border-[#d0d0d4] dark:border-[#383838] text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Clipboard className="h-3.5 w-3.5" />
        </div>
      );
    case "file":
    default:
      return (
        <div className="h-7 w-7 rounded-lg bg-[#dedee2] dark:bg-[#282828] border border-[#d0d0d4] dark:border-[#383838] text-[#555555] dark:text-[#a0a0a0] flex items-center justify-center shrink-0">
          <FileText className="h-3.5 w-3.5" />
        </div>
      );
  }
}

export function SourcesView({
  onAddSource,
  onOpenLearn,
  isSidebarOpen = true,
  onToggleSidebar,
}: SourcesViewProps) {
  const { t, language } = useI18n();

  // Tab: "all" (All / Recent) or "workspace" (By Workspace)
  const [activeCategory, setActiveCategory] = useState<"all" | "workspace">("all");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LocalSource | null>(null);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);

  // Tab indicator smooth animation refs & state
  const allTabRef = useRef<HTMLButtonElement>(null);
  const workspaceTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const updateIndicator = () => {
      const activeEl = activeCategory === "all" ? allTabRef.current : workspaceTabRef.current;
      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    };

    updateIndicator();
    const timer = setTimeout(updateIndicator, 50);
    window.addEventListener("resize", updateIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeCategory, language]);

  // Dexie.js Live Queries
  const rawSources = useLiveQuery(() => db.sources.toArray());
  const rawLearns = useLiveQuery(() => db.learns.toArray());

  const sources = useMemo(() => rawSources ?? [], [rawSources]);
  const learns = useMemo(() => rawLearns ?? [], [rawLearns]);

  // Map learns for fast workspace info lookup
  const learnsMap = useMemo(() => {
    return new Map<string, LocalLearn>(learns.map((l) => [l.id, l]));
  }, [learns]);

  // Workspaces that currently have at least 1 source
  const workspacesWithSources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sources) {
      counts.set(s.learnId, (counts.get(s.learnId) || 0) + 1);
    }
    return learns.map((l) => ({
      ...l,
      sourcesInDb: counts.get(l.id) || 0,
    }));
  }, [learns, sources]);

  // Filter sources based on search query
  const filteredSources = useMemo(() => {
    let list = sources;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const titleMatch = s.title.toLowerCase().includes(q);
        const urlMatch = s.url ? s.url.toLowerCase().includes(q) : false;
        const typeMatch = s.type ? s.type.toLowerCase().includes(q) : false;
        const ws = learnsMap.get(s.learnId);
        const wsMatch = ws ? ws.title.toLowerCase().includes(q) : false;
        return titleMatch || urlMatch || typeMatch || wsMatch;
      });
    }

    // Sort by recent (updatedAt or createdAt desc)
    return [...list].sort(
      (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    );
  }, [sources, searchQuery, learnsMap]);

  // Grouped by workspace for "Berdasarkan Workspace" category
  const workspaceGroups = useMemo(() => {
    const groups: Array<{
      workspace: LocalLearn;
      sources: LocalSource[];
    }> = [];

    // Map learns that match selected workspace filter
    const targetLearns =
      selectedWorkspaceId === "all"
        ? learns
        : learns.filter((l) => l.id === selectedWorkspaceId);

    for (const l of targetLearns) {
      const wsSources = filteredSources.filter((s) => s.learnId === l.id);
      if (wsSources.length > 0 || selectedWorkspaceId === l.id) {
        groups.push({
          workspace: l,
          sources: wsSources,
        });
      }
    }

    // Sort workspace groups by the newest source or workspace updatedAt
    groups.sort((a, b) => {
      const aRecent = a.sources[0]?.updatedAt || a.workspace.updatedAt || 0;
      const bRecent = b.sources[0]?.updatedAt || b.workspace.updatedAt || 0;
      return bRecent - aRecent;
    });

    return groups;
  }, [learns, selectedWorkspaceId, filteredSources]);

  const handleOpenSourceUrl = (url?: string) => {
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.open(url);
    }
  };

  const handleTriggerAddSource = () => {
    if (onAddSource) {
      onAddSource();
    } else {
      setIsAddSourceModalOpen(true);
    }
  };

  const handleDeleteSource = async () => {
    if (!deleteTarget) return;
    await localDb.deleteSource(deleteTarget.id);
    setDeleteTarget(null);
  };

  // Render a single minimalist source row
  const renderSourceRow = (source: LocalSource, showWorkspaceTag = true) => {
    const workspace = learnsMap.get(source.learnId);
    const workspaceTitle = workspace?.title || t("untitledNotebook");
    const workspaceEmoji = workspace?.emoji || "📘";
    const dateFormatted = formatRelativeTime(
      source.updatedAt || source.createdAt,
      language
    );

    return (
      <div
        key={source.id}
        onClick={() => onOpenLearn?.(source.learnId)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-[#dedee2] dark:border-[#383838] hover:border-[#b0b0b0] dark:hover:border-[#4f4f4f] bg-white dark:bg-[#222222] hover:bg-[#f4f4f6] dark:hover:bg-[#282828] transition-all flex items-center justify-between gap-3 group select-none cursor-pointer shadow-none"
      >
        {/* Left: Icon, Title & Optional Link */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {getSourceIcon(source.type)}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4
                className="text-xs sm:text-sm font-medium text-[#262626] dark:text-[#d4d4d4] truncate group-hover:text-black dark:group-hover:text-white transition-colors"
                title={source.title}
              >
                {source.title}
              </h4>
            </div>

            {source.url && (
              <p
                className="text-[11px] text-[#8a8a8a] dark:text-[#777777] truncate font-mono mt-0.5 max-w-sm sm:max-w-md"
                title={source.url}
              >
                {source.url.replace(/^https?:\/\//, "")}
              </p>
            )}
          </div>
        </div>

        {/* Right: Workspace Badge, Type/Size, Date, Quick Actions */}
        <div className="flex items-center gap-3 shrink-0 text-xs text-[#8a8a8a] dark:text-[#777777]">
          {/* Workspace badge */}
          {showWorkspaceTag && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLearn?.(source.learnId);
              }}
              className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] text-[#555555] dark:text-[#aaaaaa] hover:text-[#111111] dark:hover:text-white hover:border-[#b0b0b0] dark:hover:border-[#555555] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 max-w-[170px] truncate"
              title={workspaceTitle}
            >
              <span className="shrink-0">{workspaceEmoji}</span>
              <span className="truncate">{workspaceTitle}</span>
            </button>
          )}

          {/* Type / Size Info */}
          <span className="text-[11px] font-mono text-[#8a8a8a] dark:text-[#777777] uppercase hidden md:inline shrink-0">
            {source.type}
            {source.size ? ` • ${formatFileSize(source.size)}` : ""}
          </span>

          {/* Date */}
          {dateFormatted && (
            <span className="text-[11px] text-[#8a8a8a] dark:text-[#777777] hidden sm:inline shrink-0">
              {dateFormatted}
            </span>
          )}

          {/* Action Buttons */}
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {source.url && (
              <button
                type="button"
                onClick={() => handleOpenSourceUrl(source.url)}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#8a8a8a] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white cursor-pointer transition-colors"
                title={source.url}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenLearn?.(source.learnId)}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#8a8a8a] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white cursor-pointer transition-colors"
              title={t("openInWorkspace")}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setDeleteTarget(source)}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-rose-500/10 text-[#8a8a8a] hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer transition-colors"
              title={t("delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-4">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              {!isSidebarOpen && onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className="p-1.5 -ml-1 rounded-xl bg-[#dedee2]/60 hover:bg-[#dedee2] dark:bg-[#2b2b2b] dark:hover:bg-[#383838] text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-none"
                  title={t("openSidebarKeyboard")}
                  aria-label={t("openSidebar")}
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}
              <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-[#262626] dark:text-white">
                {t("sourcesViewTitle")}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#dedee2] dark:bg-[#2b2b2b] text-[#737373] dark:text-[#969696] font-mono">
                {filteredSources.length}
              </span>
            </div>
            <p className="text-xs text-[#8a8a8a] dark:text-[#888888] mt-0.5">
              {t("sourcesViewSubtitle")}
            </p>
          </div>

          {/* Right Toolbar: Search & Add Source Button */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8a8a8a] dark:text-[#777777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchSourcesPlaceholder")}
                className="h-8 w-44 sm:w-56 pl-8 pr-7 text-xs rounded-xl bg-white dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] placeholder-[#8a8a8a] dark:placeholder-[#777777] focus-visible:ring-1 focus-visible:ring-[#888888] shadow-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a8a8a] dark:text-[#777777] hover:text-[#262626] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Add Source Button (UI is present) */}
            <Button
              size="sm"
              onClick={handleTriggerAddSource}
              className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-[#262626] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-zinc-200 transition-all cursor-pointer shadow-none"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t("addSourceBtn")}</span>
            </Button>
          </div>
        </div>

        {/* Category Switcher Tabs: "Semua" vs "Berdasarkan Workspace" */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex items-center p-0.5 rounded-xl bg-[#ececee] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838]">
            {/* Smooth animated sliding pill background */}
            <div
              className="absolute top-0.5 bottom-0.5 left-0 rounded-lg bg-white dark:bg-[#383838] shadow-xs pointer-events-none transition-all duration-300"
              style={{
                transform: `translateX(${indicatorStyle.left}px)`,
                width: `${indicatorStyle.width}px`,
                opacity: indicatorStyle.width > 0 ? 1 : 0,
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />

            <button
              ref={allTabRef}
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`relative z-10 px-3.5 py-1 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                activeCategory === "all"
                  ? "text-[#111111] dark:text-white"
                  : "text-[#737373] dark:text-[#969696] hover:text-black dark:hover:text-white"
              }`}
            >
              {t("allSources")}
            </button>
            <button
              ref={workspaceTabRef}
              type="button"
              onClick={() => setActiveCategory("workspace")}
              className={`relative z-10 px-3.5 py-1 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                activeCategory === "workspace"
                  ? "text-[#111111] dark:text-white"
                  : "text-[#737373] dark:text-[#969696] hover:text-black dark:hover:text-white"
              }`}
            >
              {t("byWorkspace")}
            </button>
          </div>

          {/* Sub-filter if in "Berdasarkan Workspace": Workspace pills */}
          {activeCategory === "workspace" && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full animate-in fade-in-50 duration-200">
              <button
                type="button"
                onClick={() => setSelectedWorkspaceId("all")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-colors cursor-pointer border ${
                  selectedWorkspaceId === "all"
                    ? "bg-[#262626] dark:bg-white text-white dark:text-black border-transparent shadow-none"
                    : "bg-white dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#737373] dark:text-[#969696] hover:text-black dark:hover:text-white"
                }`}
              >
                {t("allWorkspaces")}
              </button>

              {workspacesWithSources.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-colors cursor-pointer border flex items-center gap-1.5 ${
                    selectedWorkspaceId === ws.id
                      ? "bg-[#262626] dark:bg-white text-white dark:text-black border-transparent shadow-none"
                      : "bg-white dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#737373] dark:text-[#969696] hover:text-black dark:hover:text-white"
                  }`}
                >
                  <span>{ws.emoji || "📘"}</span>
                  <span className="max-w-[120px] truncate">{ws.title}</span>
                  <span className="text-[10px] opacity-70 font-mono">
                    {ws.sourcesInDb}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Content: Source Rows */}
      {sources.length === 0 ? (
        /* Empty State: Zero Sources in App */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-dashed border-[#dedee2] dark:border-[#383838] bg-white/40 dark:bg-[#1e1e1e]/40 min-h-[320px]">
          <div className="w-12 h-12 rounded-2xl bg-[#f4f4f6] dark:bg-[#282828] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#737373] dark:text-[#888888] mb-3">
            <FileText className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-medium text-[#262626] dark:text-white mb-1">
            {t("noSavedSourcesTitle")}
          </h3>
          <p className="text-xs text-[#8a8a8a] dark:text-[#888888] max-w-md leading-relaxed mb-4">
            {t("noSavedSourcesDesc")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerAddSource}
            className="rounded-xl text-xs border-[#dedee2] dark:border-[#383838] hover:bg-[#eaeaea] dark:hover:bg-[#2c2c2c] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>{t("addFirstSource")}</span>
          </Button>
        </div>
      ) : filteredSources.length === 0 ? (
        /* Empty State: Zero Search Results */
        <div className="py-14 text-center rounded-2xl border border-dashed border-[#dedee2] dark:border-[#383838] bg-white/40 dark:bg-[#1e1e1e]/40">
          <p className="text-xs text-[#8a8a8a] dark:text-[#888888]">
            {t("noSourcesMatching", { query: searchQuery })}
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-2 text-xs text-[#262626] dark:text-white underline cursor-pointer"
          >
            Reset
          </button>
        </div>
      ) : activeCategory === "all" ? (
        /* "Semua" View: Flat rows sorted by recent */
        <div className="space-y-2 animate-in fade-in-50 duration-200">
          {filteredSources.map((source) => renderSourceRow(source, true))}
        </div>
      ) : (
        /* "Berdasarkan Workspace" View: Grouped by Workspace */
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {workspaceGroups.map(({ workspace, sources: wsSources }) => (
            <div key={workspace.id} className="space-y-2">
              {/* Minimalist Workspace Header */}
              <div className="flex items-center justify-between px-1 py-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">{workspace.emoji || "📘"}</span>
                  <span className="font-medium text-[#262626] dark:text-white">
                    {workspace.title}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#dedee2] dark:bg-[#2b2b2b] text-[#737373] dark:text-[#969696]">
                    {wsSources.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenLearn?.(workspace.id)}
                  className="text-[11px] text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{t("openInWorkspace")}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              {/* Rows inside this workspace */}
              {wsSources.length > 0 ? (
                <div className="space-y-1.5">
                  {wsSources.map((source) => renderSourceRow(source, false))}
                </div>
              ) : (
                <div className="py-4 text-center text-[11px] text-[#8a8a8a] dark:text-[#777777] rounded-xl border border-dashed border-[#dedee2] dark:border-[#383838]">
                  {t("noSourcesInWorkspace")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Source Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("deleteSourceConfirm", { title: deleteTarget?.title || "" })}
        description={t("deleteSourceDesc")}
        onConfirm={handleDeleteSource}
      />

      {/* Add Source Workspace Selector Modal (UI is present) */}
      <Dialog
        open={isAddSourceModalOpen}
        onOpenChange={setIsAddSourceModalOpen}
      >
        <DialogContent className="sm:max-w-[420px] p-6 rounded-2xl border border-[#dedee2] dark:border-[#383838] bg-white dark:bg-[#222222] text-[#262626] dark:text-[#d4d4d4] shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-medium tracking-tight text-[#262626] dark:text-white">
              {t("selectWorkspaceToAddSource")}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8a8a8a] dark:text-[#888888] pt-1">
              {t("selectWorkspaceToAddSourceDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-1.5 max-h-[300px] overflow-y-auto">
            {learns.length > 0 ? (
              learns.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setIsAddSourceModalOpen(false);
                    onOpenLearn?.(l.id, true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#dedee2] dark:border-[#383838] hover:border-[#b0b0b0] dark:hover:border-[#555555] bg-[#f8f8f8] dark:bg-[#282828] hover:bg-[#ececee] dark:hover:bg-[#333333] transition-all flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-lg shrink-0">{l.emoji || "📘"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#262626] dark:text-white truncate">
                        {l.title}
                      </p>
                      {l.description && (
                        <p className="text-[11px] text-[#8a8a8a] dark:text-[#777777] truncate mt-0.5">
                          {l.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#8a8a8a] group-hover:text-black dark:group-hover:text-white shrink-0 ml-2" />
                </button>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-[#8a8a8a] dark:text-[#888888]">
                {t("noLearnsFound")}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddSourceModalOpen(false)}
              className="rounded-xl h-8 px-4 text-xs border-[#dedee2] dark:border-[#383838] cursor-pointer"
            >
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
