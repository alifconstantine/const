import React, { useState, useMemo, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  FileText,
  Globe,
  Plus,
  ExternalLink,
  Trash2,
  BookOpen,
  HardDrive,
  Clipboard,
  Video,
  ArrowUpRight,
  FolderPlus,
  Eye,
} from "lucide-react";
import {
  Button,
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
import { SourcePreviewDialog } from "../workspace/source-preview-dialog";

export interface SourcesViewProps {
  onAddSource?: () => void;
  onOpenLearn?: (learnId: string, openAddSource?: boolean) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  sortOption?: "recent" | "oldest" | "title_asc" | "title_desc";
  isAddSourceModalOpen?: boolean;
  onAddSourceModalOpenChange?: (open: boolean) => void;
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
        <div className="h-8 w-8 rounded-xl bg-secondary border border-border/70 text-muted-foreground flex items-center justify-center shrink-0">
          <Globe className="h-4 w-4 text-blue-400" />
        </div>
      );
    case "youtube":
      return (
        <div className="h-8 w-8 rounded-xl bg-secondary border border-border/70 text-rose-400 flex items-center justify-center shrink-0">
          <Video className="h-4 w-4 text-rose-400" />
        </div>
      );
    case "book":
      return (
        <div className="h-8 w-8 rounded-xl bg-secondary border border-border/70 text-amber-400 flex items-center justify-center shrink-0">
          <BookOpen className="h-4 w-4 text-amber-400" />
        </div>
      );
    case "drive":
      return (
        <div className="h-8 w-8 rounded-xl bg-secondary border border-border/70 text-emerald-400 flex items-center justify-center shrink-0">
          <HardDrive className="h-4 w-4 text-emerald-400" />
        </div>
      );
    case "text":
      return (
        <div className="h-8 w-8 rounded-xl bg-secondary border border-border/70 text-indigo-400 flex items-center justify-center shrink-0">
          <Clipboard className="h-4 w-4 text-indigo-400" />
        </div>
      );
    case "file":
    default:
      return (
        <div className="h-8 w-8 rounded-xl bg-secondary border border-border/70 text-muted-foreground flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
      );
  }
}

export function SourcesView({
  onAddSource,
  onOpenLearn,
  searchQuery = "",
  onClearSearch,
  sortOption = "recent",
  isAddSourceModalOpen: propIsAddSourceModalOpen,
  onAddSourceModalOpenChange,
}: SourcesViewProps) {
  const { t, language } = useI18n();

  // Tab: "all" (All Sources) or "workspace" (By Workspace)
  const [activeCategory, setActiveCategory] = useState<"all" | "workspace">("all");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<LocalSource | null>(null);
  const [localAddSourceModalOpen, setLocalAddSourceModalOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<LocalSource | null>(null);

  const isAddSourceModalOpen =
    propIsAddSourceModalOpen !== undefined ? propIsAddSourceModalOpen : localAddSourceModalOpen;
  const setIsAddSourceModalOpen = onAddSourceModalOpenChange ?? setLocalAddSourceModalOpen;

  // Animated sliding pill indicator
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
  const learns = useMemo(() => (rawLearns ?? []).filter((l) => !l.isArchived), [rawLearns]);

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

  // Filter & sort sources
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

    // Sort
    return [...list].sort((a, b) => {
      if (sortOption === "recent") {
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      } else if (sortOption === "oldest") {
        return (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0);
      } else if (sortOption === "title_asc") {
        return a.title.localeCompare(b.title);
      } else if (sortOption === "title_desc") {
        return b.title.localeCompare(a.title);
      }
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
  }, [sources, searchQuery, learnsMap, sortOption]);

  // Grouped by workspace for "Berdasarkan Workspace" category
  const workspaceGroups = useMemo(() => {
    const groups: Array<{
      workspace: LocalLearn;
      sources: LocalSource[];
    }> = [];

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

    // Sort workspace groups by newest source or workspace updatedAt
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

  const handleCreateNewWorkspaceAndAddSource = async () => {
    setIsAddSourceModalOpen(false);
    const newId = await localDb.createLearn({
      title: t("untitledNotebook"),
      emoji: "📘",
    });
    onOpenLearn?.(newId, true);
  };

  // Render a single mobile source row / card
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
        onClick={() => setPreviewSource(source)}
        className="w-full p-3 rounded-2xl border border-border/80 bg-card hover:bg-secondary/60 active:bg-secondary/80 transition-all flex flex-col gap-2.5 cursor-pointer select-none shadow-2xs"
      >
        {/* Top Row: Icon, Title, & Actions */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {getSourceIcon(source.type)}

            <div className="min-w-0 flex-1 pt-0.5">
              <h4
                className="text-xs sm:text-sm font-medium text-foreground truncate leading-snug"
                title={source.title}
              >
                {source.title}
              </h4>

              {source.url && (
                <p
                  className="text-[11px] text-muted-foreground truncate font-mono mt-0.5"
                  title={source.url}
                >
                  {source.url.replace(/^https?:\/\//, "")}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div
            className="flex items-center gap-1 shrink-0 pt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewSource(source)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors active:scale-95"
              title={t("previewSource")}
              aria-label={t("previewSource")}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            {source.url && (
              <button
                type="button"
                onClick={() => handleOpenSourceUrl(source.url)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors active:scale-95"
                title={source.url}
                aria-label="Open URL"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenLearn?.(source.learnId)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors active:scale-95"
              title={t("openInWorkspace")}
              aria-label={t("openInWorkspace")}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setDeleteTarget(source)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors active:scale-95"
              title={t("delete")}
              aria-label={t("delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom Metadata Row: Workspace Badge, Type, Date */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showWorkspaceTag && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLearn?.(source.learnId);
                }}
                className="font-medium px-2 py-0.5 rounded-md bg-secondary border border-border/70 text-foreground hover:bg-secondary/80 hover:border-border transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 max-w-[170px] truncate active:scale-95"
                title={workspaceTitle}
              >
                <span className="shrink-0">{workspaceEmoji}</span>
                <span className="truncate">{workspaceTitle}</span>
              </button>
            )}

            <span className="font-mono uppercase text-[10px] opacity-80 shrink-0">
              {source.type}
              {source.size ? ` • ${formatFileSize(source.size)}` : ""}
            </span>
          </div>

          {dateFormatted && (
            <span className="text-[10px] text-muted-foreground/80 shrink-0 font-mono">
              {dateFormatted}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col space-y-3.5">
      {/* 1. Header & Category Switcher */}
      <div className="space-y-3">
        {/* Title and total counter */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <h2 className="font-sans text-sm font-semibold tracking-tight text-foreground">
              {t("sources")}
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground font-mono">
              {filteredSources.length}
            </span>
          </div>
        </div>

        {/* Category Switcher Tabs: "Semua" (All) vs "Berdasarkan Workspace" (By Workspace) */}
        <div className="flex flex-col gap-2">
          <div className="relative flex items-center p-0.5 rounded-xl bg-secondary/80 border border-border/70 w-full">
            {/* Smooth animated sliding pill background */}
            <div
              className="absolute top-0.5 bottom-0.5 rounded-lg bg-card border border-border shadow-2xs transition-all duration-300 pointer-events-none"
              style={{
                left: `${indicatorStyle.left}px`,
                width: `${indicatorStyle.width}px`,
                opacity: indicatorStyle.width > 0 ? 1 : 0,
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />

            <button
              ref={allTabRef}
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`relative z-10 flex-1 py-1.5 rounded-lg text-xs font-medium text-center transition-colors duration-200 cursor-pointer select-none ${
                activeCategory === "all"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("allSources")}
            </button>
            <button
              ref={workspaceTabRef}
              type="button"
              onClick={() => setActiveCategory("workspace")}
              className={`relative z-10 flex-1 py-1.5 rounded-lg text-xs font-medium text-center transition-colors duration-200 cursor-pointer select-none ${
                activeCategory === "workspace"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("byWorkspace")}
            </button>
          </div>

          {/* Sub-filter if in "Berdasarkan Workspace": Horizontal Workspace Pills */}
          {activeCategory === "workspace" && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-full">
              <button
                type="button"
                onClick={() => setSelectedWorkspaceId("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer border ${
                  selectedWorkspaceId === "all"
                    ? "bg-foreground text-background border-transparent font-semibold shadow-sm"
                    : "bg-secondary/70 border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary active:scale-95"
                }`}
              >
                {t("allWorkspaces")}
              </button>

              {workspacesWithSources.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                    selectedWorkspaceId === ws.id
                      ? "bg-foreground text-background border-transparent font-semibold shadow-sm"
                      : "bg-secondary/70 border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary active:scale-95"
                  }`}
                >
                  <span>{ws.emoji || "📘"}</span>
                  <span className="max-w-[120px] truncate">{ws.title}</span>
                  <span className="text-[10px] opacity-75 font-mono">
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
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-border/80 bg-card min-h-[260px]">
          <div className="w-12 h-12 rounded-2xl bg-secondary border border-border/60 flex items-center justify-center text-muted-foreground mb-3">
            <FileText className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">
            {t("noSavedSourcesTitle")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-4">
            {t("noSavedSourcesDesc")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerAddSource}
            className="rounded-full text-xs border-border hover:bg-secondary cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>{t("addFirstSource")}</span>
          </Button>
        </div>
      ) : filteredSources.length === 0 ? (
        /* Empty State: Zero Search Results */
        <div className="py-12 text-center rounded-2xl border border-dashed border-border/80 bg-card px-4">
          <p className="text-xs text-muted-foreground">
            {t("noSourcesMatching", { query: searchQuery })}
          </p>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="mt-2 text-xs text-foreground underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      ) : activeCategory === "all" ? (
        /* "Semua" View: Flat rows sorted by recent */
        <div className="space-y-2">
          {filteredSources.map((source) => renderSourceRow(source, true))}
        </div>
      ) : (
        /* "Berdasarkan Workspace" View: Grouped by Workspace */
        <div className="space-y-4">
          {workspaceGroups.map(({ workspace, sources: wsSources }) => (
            <div key={workspace.id} className="space-y-2">
              {/* Workspace Header */}
              <div className="flex items-center justify-between px-1 py-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">{workspace.emoji || "📘"}</span>
                  <span className="font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs">
                    {workspace.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground">
                    {wsSources.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenLearn?.(workspace.id)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                >
                  <span>{t("openInWorkspace")}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              {/* Rows inside this workspace */}
              {wsSources.length > 0 ? (
                <div className="space-y-2">
                  {wsSources.map((source) => renderSourceRow(source, false))}
                </div>
              ) : (
                <div className="py-4 text-center text-[11px] text-muted-foreground rounded-xl border border-dashed border-border/80 bg-card/50">
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

      {/* Add Source Workspace Selector Modal */}
      <Dialog
        open={isAddSourceModalOpen}
        onOpenChange={setIsAddSourceModalOpen}
      >
        <DialogContent className="w-[92vw] max-w-[420px] p-5 rounded-2xl border border-border bg-card text-foreground shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-sans text-base font-semibold tracking-tight text-foreground">
              {t("selectWorkspaceToAddSource")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              {t("selectWorkspaceToAddSourceDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2.5 space-y-2 max-h-[280px] overflow-y-auto no-scrollbar">
            {learns.length > 0 ? (
              learns.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setIsAddSourceModalOpen(false);
                    onOpenLearn?.(l.id, true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border hover:border-border/80 bg-secondary/40 hover:bg-secondary active:bg-secondary/90 transition-all flex items-center justify-between text-left cursor-pointer group select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-lg shrink-0">{l.emoji || "📘"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {l.title}
                      </p>
                      {l.description && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {l.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 ml-2" />
                </button>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                {t("noLearnsFound")}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCreateNewWorkspaceAndAddSource}
              className="rounded-full h-9 px-4 text-xs border border-border text-foreground hover:bg-secondary cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{t("createCardLearn")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddSourceModalOpen(false)}
              className="rounded-full h-9 px-4 text-xs text-muted-foreground hover:text-foreground cursor-pointer w-full sm:w-auto"
            >
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Source Preview Dialog */}
      <SourcePreviewDialog
        source={previewSource}
        open={!!previewSource}
        onOpenChange={(open) => {
          if (!open) setPreviewSource(null);
        }}
        onOpenLearn={onOpenLearn}
      />
    </div>
  );
}
