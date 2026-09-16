import React, { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, LocalLearn, LocalCollection, LocalArtifact } from "../../lib/db";
import {
  Button,
  Input,
  ScrollArea,
} from "@const/ui";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  PanelLeftOpen,
  ArrowLeft,
  Trash2,
  X,
  Folder,
  Clock,
  Layers,
} from "lucide-react";

import { LearnCard, LearnItem } from "./learn-card";
import { CollectionCard, CollectionItem } from "./collection-card";
import { CreateCard } from "./create-card";
import { RecentlyViewedCard } from "./recently-viewed-card";
import { Sidebar, HomeNavTab } from "./sidebar";
import { SourcesView } from "./sources-view";
import { SettingsView } from "../settings/settings-view";
import { CreateLearnDialog } from "./dialogs/create-learn-dialog";
import { CreateCollectionDialog } from "./dialogs/create-collection-dialog";
import { ManageCollectionDialog } from "./dialogs/manage-collection-dialog";
import { DeleteConfirmDialog } from "./dialogs/delete-confirm-dialog";
import { useI18n } from "../../lib/i18n";
import type { UserProfile } from "../navbar";

interface LearnHomeProps {
  onOpenLearn?: (learnId: string, openAddSource?: boolean) => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
}

export function LearnHome({
  onOpenLearn,
  user,
  onSignOut,
  onSwitchAccount,
}: LearnHomeProps) {
  const { t, language } = useI18n();

  // Navigation & Shell State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<HomeNavTab>("learns");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // Dialog States
  const [isCreateLearnOpen, setIsCreateLearnOpen] = useState(false);
  const [editingLearn, setEditingLearn] = useState<LearnItem | null>(null);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);
  const [managingLearn, setManagingLearn] = useState<LearnItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "learn" | "collection";
    id?: string;
    title: string;
    description: string;
  } | null>(null);

  // Dexie.js Live Queries
  const rawLearns = useLiveQuery(async () => {
    const items = await db.learns.toArray();
    return items.filter((l) => !l.isArchived).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  });

  const collectionsData = useLiveQuery(async () => {
    const cols = await db.collections.toArray();
    const allLearns = await db.learns.toArray();
    const withCount: CollectionItem[] = cols.map((c) => ({
      ...c,
      itemCount: allLearns.filter((l) => l.collectionIds?.includes(c.id)).length,
    }));
    withCount.sort((a, b) => b.updatedAt - a.updatedAt);
    return withCount;
  });

  const artifactsData = useLiveQuery(async () => {
    const arts = await db.artifacts.toArray();
    arts.sort((a, b) => b.updatedAt - a.updatedAt);
    return arts;
  });

  const allLearns = useMemo(() => rawLearns ?? [], [rawLearns]);
  const collections = useMemo(() => collectionsData ?? [], [collectionsData]);
  const artifacts = useMemo(() => artifactsData ?? [], [artifactsData]);

  // Filtered learns based on search
  const filteredLearns = useMemo(() => {
    if (!searchQuery.trim()) return allLearns;
    const q = searchQuery.toLowerCase();
    return allLearns.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
    );
  }, [allLearns, searchQuery]);

  // Recently Viewed Learns (Top 5 most recent)
  const recentlyViewedLearns = useMemo(() => {
    return allLearns.slice(0, 5);
  }, [allLearns]);

  // Active collection object when drilled down
  const activeCollection = useMemo(() => {
    if (!activeCollectionId) return null;
    return collections.find((c) => c.id === activeCollectionId) ?? null;
  }, [collections, activeCollectionId]);

  // Filtered learns when viewing a specific collection
  const collectionLearns = useMemo(() => {
    if (!activeCollectionId) return [];
    return allLearns.filter((l) => l.collectionIds && l.collectionIds.includes(activeCollectionId));
  }, [allLearns, activeCollectionId]);

  // Total sources count across all learns (live from sources table with fallback to learns sum)
  const rawSourcesCount = useLiveQuery(async () => {
    return await db.sources.count();
  });

  const totalSourcesCount = useMemo(() => {
    if (rawSourcesCount !== undefined) return rawSourcesCount;
    return allLearns.reduce((acc, curr) => acc + (curr.sourcesCount || 0), 0);
  }, [allLearns, rawSourcesCount]);

  // Action handlers
  const handleCreateNewLearn = async (_collectionId?: string) => {
    setEditingLearn(null);
    setIsCreateLearnOpen(true);
  };

  const handleSaveLearn = async (data: {
    id?: string;
    title: string;
    description?: string;
    emoji: string;
    collectionId?: string;
    projectPath?: string;
    permissionMode?: "ask_before_changes" | "full_access";
  }) => {
    if (data.id) {
      await localDb.updateLearn(data.id, {
        title: data.title,
        description: data.description,
        emoji: data.emoji,
        projectPath: data.projectPath,
        permissionMode: data.permissionMode,
      });
    } else {
      const newId = await localDb.createLearn({
        title: data.title,
        description: data.description,
        emoji: data.emoji,
        collectionId: data.collectionId || (activeCollectionId ?? undefined),
        projectPath: data.projectPath,
        permissionMode: data.permissionMode || "ask_before_changes",
      });
      // Create initial chat session
      const initialSessionId = await localDb.createSession(newId, t("initialSessionTitle"));
      try {
        localStorage.setItem(`const_learn_active_session_${newId}`, initialSessionId);
      } catch {}
      if (onOpenLearn) {
        onOpenLearn(newId, false);
      }
    }
  };

  const handleSaveCollection = async (data: {
    id?: string;
    name: string;
    description?: string;
    emoji: string;
  }) => {
    if (data.id) {
      await localDb.updateCollection(data.id, {
        name: data.name,
        description: data.description,
        emoji: data.emoji,
      });
    } else {
      await localDb.createCollection({
        name: data.name,
        description: data.description,
        emoji: data.emoji,
      });
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "learn" && deleteTarget.id) {
      await localDb.deleteLearn(deleteTarget.id);
    } else if (deleteTarget.type === "collection" && deleteTarget.id) {
      await localDb.deleteCollection(deleteTarget.id);
      if (activeCollectionId === deleteTarget.id) {
        setActiveCollectionId(null);
      }
    }
  };

  // Keyboard shortcut: Toggle sidebar with Ctrl+B or Cmd+B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const renderSidebarToggle = () => {
    if (isSidebarOpen) return null;
    return (
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="p-1.5 -ml-1 rounded-xl bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-none"
        title={t("openSidebarKeyboard")}
        aria-label={t("openSidebar")}
      >
        <PanelLeftOpen className="w-4 h-4" />
      </button>
    );
  };

  // If Settings view is triggered
  if (isSettingsOpen) {
    return (
      <SettingsView
        onBackToWorkspace={() => setIsSettingsOpen(false)}
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
      />
    );
  }

  return (
    <div className="h-screen w-full flex bg-secondary/50 text-foreground overflow-hidden select-none">
      {/* 1. Left Sidebar (Collapsible) */}
      {isSidebarOpen && (
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (tab !== "collections") setActiveCollectionId(null);
          }}
          onCollapse={() => setIsSidebarOpen(false)}
          onCreateNewLearn={() => handleCreateNewLearn()}
          onCreateNewCollection={() => {
            setEditingCollection(null);
            setIsCreateCollectionOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          user={user}
          onSignOut={onSignOut}
          onSwitchAccount={onSwitchAccount}
          learnsCount={allLearns.length}
          sourcesCount={totalSourcesCount}
          collectionsCount={collections.length}
          artifactsCount={artifacts.length}
        />
      )}

      {/* 2. Main Canvas (Left rounded against sidebar, bg-background per DESIGN.md - no dividing lines) */}
      <main
        className={`flex-1 min-w-0 h-full bg-background text-foreground overflow-hidden flex flex-col relative transition-[border-radius] duration-200 ${
          isSidebarOpen ? "rounded-l-2xl sm:rounded-l-3xl" : ""
        }`}
      >
        {/* Scrollable Main Area */}
        <ScrollArea className="flex-1 w-full h-full min-h-0">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 py-7 space-y-9">
            {/* ============================================================ */}
            {/* TAB: LEARNS (Default View)                                   */}
            {/* ============================================================ */}
            {activeTab === "learns" && (
              <div className="space-y-8">
                {/* Heading & Toolbar Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Heading & Total Count */}
                  <div className="flex items-center gap-2.5">
                    {renderSidebarToggle()}
                    <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
                      {t("learns")}
                    </h1>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                      {filteredLearns.length}
                    </span>
                  </div>

                  {/* Right: Grid/List Toggle, Search, New Learns */}
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                    {/* View Mode Toggle (Grid vs List/Rows) */}
                    <div className="flex items-center p-0.5 rounded-xl bg-muted/70 border border-border">
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          viewMode === "grid"
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Grid"
                        aria-label="Grid"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          viewMode === "list"
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="List"
                        aria-label="List"
                      >
                        <ListIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("searchLearns")}
                        className="h-8 w-44 sm:w-56 pl-8 pr-7 text-xs rounded-xl bg-card border-border text-foreground placeholder-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40 shadow-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* New Learns Button */}
                    <Button
                      size="sm"
                      onClick={() => handleCreateNewLearn()}
                      className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-none"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{t("newLearn")}</span>
                    </Button>
                  </div>
                </div>

                {/* Section 1: Recently Viewed (Smaller Cards) */}
                {recentlyViewedLearns.length > 0 && !searchQuery && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">
                        {t("recentlyViewed")}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {recentlyViewedLearns.map((learn) => (
                        <RecentlyViewedCard
                          key={`recent-${learn.id}`}
                          learn={learn}
                          onClick={() => onOpenLearn?.(learn.id, false)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Section 2: All Learns */}
                <section className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {t("allLearns")}
                    </span>
                    {searchQuery && (
                      <span className="text-xs text-muted-foreground">
                        {t("searchResultsFor", { query: searchQuery })}
                      </span>
                    )}
                  </div>

                  <div
                    className={
                      viewMode === "grid"
                        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                        : "space-y-2"
                    }
                  >
                    {/* First Card: Quick Create Learn Card (Grid view mode only) */}
                    {viewMode === "grid" && (
                      <CreateCard
                        type="learn"
                        onClick={() => handleCreateNewLearn()}
                      />
                    )}

                    {/* All User Learn Cards */}
                    {filteredLearns.map((learn) => (
                      <LearnCard
                        key={learn.id}
                        learn={learn}
                        viewMode={viewMode}
                        onClick={() => onOpenLearn?.(learn.id, false)}
                        onEdit={(l) => {
                          setEditingLearn(l);
                          setIsCreateLearnOpen(true);
                        }}
                        onManageCollections={(l) => setManagingLearn(l)}
                        onDelete={(l) =>
                          setDeleteTarget({
                            type: "learn",
                            id: l.id,
                            title: t("deleteLearnTitle", { title: l.title }),
                            description: t("deleteLearnConfirm"),
                          })
                        }
                      />
                    ))}
                  </div>

                  {filteredLearns.length === 0 && (
                    <div className="text-center py-14 px-4 rounded-2xl border border-dashed border-border bg-card/40">
                      <p className="text-xs text-muted-foreground">
                        {searchQuery ? t("noLearnsMatchSearch", { query: searchQuery }) : "Belum ada notebook tersimpan"}
                      </p>
                      {!searchQuery && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            onClick={() => handleCreateNewLearn()}
                            className="h-8 px-3 rounded-xl text-xs font-medium cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            <span>{t("newLearn")}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB: SOURCES                                                 */}
            {/* ============================================================ */}
            {activeTab === "sources" && (
              <SourcesView
                onOpenLearn={(learnId) => onOpenLearn?.(learnId, false)}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(true)}
              />
            )}

            {/* ============================================================ */}
            {/* TAB: COLLECTIONS                                             */}
            {/* ============================================================ */}
            {activeTab === "collections" && (
              <section className="space-y-6">
                {activeCollection ? (
                  // Drilled-down collection view
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-3">
                      <div className="flex items-center gap-3">
                        {renderSidebarToggle()}
                        <button
                          type="button"
                          onClick={() => setActiveCollectionId(null)}
                          className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                          title={t("backToAllCollections")}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{activeCollection.emoji || "📁"}</span>
                            <h2 className="font-serif text-2xl font-normal text-foreground">
                              {activeCollection.name}
                            </h2>
                          </div>
                          {activeCollection.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {activeCollection.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingCollection(activeCollection);
                            setIsCreateCollectionOpen(true);
                          }}
                          className="rounded-xl h-8 text-xs border-border cursor-pointer"
                        >
                          {t("editCollection")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({
                              type: "collection",
                              id: activeCollection.id,
                              title: t("deleteCollectionTitle", { name: activeCollection.name }),
                              description: t("deleteCollectionConfirm"),
                            })
                          }
                          className="rounded-xl h-8 text-xs cursor-pointer"
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    </div>

                    {/* Learns in this collection */}
                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                          : "space-y-2"
                      }
                    >
                      {viewMode === "grid" && (
                        <CreateCard
                          type="learn"
                          onClick={() => handleCreateNewLearn(activeCollectionId || undefined)}
                        />
                      )}

                      {collectionLearns.map((learn) => (
                        <LearnCard
                          key={learn.id}
                          learn={learn}
                          viewMode={viewMode}
                          onClick={() => onOpenLearn?.(learn.id, false)}
                          onEdit={(l) => {
                            setEditingLearn(l);
                            setIsCreateLearnOpen(true);
                          }}
                          onManageCollections={(l) => setManagingLearn(l)}
                          onDelete={(l) =>
                            setDeleteTarget({
                              type: "learn",
                              id: l.id,
                              title: t("deleteLearnTitle", { title: l.title }),
                              description: t("deleteLearnConfirm"),
                            })
                          }
                        />
                      ))}
                    </div>

                    {collectionLearns.length === 0 && (
                      <div className="text-center py-14 px-4 bg-card/40 rounded-2xl border border-dashed border-border">
                        <p className="text-xs text-muted-foreground">
                          {t("noLearnsInCollection")}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  // All Collections overview
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {renderSidebarToggle()}
                        <h2 className="font-serif text-2xl font-normal text-foreground">
                          {t("collections")}
                        </h2>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                          {t("collectionsCountText", { count: collections.length })}
                        </span>
                      </div>
                    </div>

                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                          : "space-y-2"
                      }
                    >
                      {viewMode === "grid" && (
                        <CreateCard
                          type="collection"
                          onClick={() => {
                            setEditingCollection(null);
                            setIsCreateCollectionOpen(true);
                          }}
                        />
                      )}

                      {collections.map((col) => (
                        <CollectionCard
                          key={col.id}
                          collection={col}
                          viewMode={viewMode}
                          onClick={(c) => setActiveCollectionId(c.id)}
                          onEdit={(c) => {
                            setEditingCollection(c);
                            setIsCreateCollectionOpen(true);
                          }}
                          onDelete={(c) =>
                            setDeleteTarget({
                              type: "collection",
                              id: c.id,
                              title: t("deleteCollectionTitle", { name: c.name }),
                              description: t("deleteCollectionConfirm"),
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: ARTIFACT                                                */}
            {/* ============================================================ */}
            {activeTab === "artifacts" && (
              <section className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {renderSidebarToggle()}
                    <h2 className="font-serif text-2xl font-normal text-foreground">
                      {t("artifacts")}
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                      {artifacts.length}
                    </span>
                  </div>
                </div>

                {artifacts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {artifacts.map((art) => (
                      <div
                        key={art.id}
                        className="p-4 rounded-2xl border border-border bg-card hover:border-foreground/20 hover:bg-secondary/40 transition-all flex flex-col justify-between shadow-none"
                      >
                        <div className="flex items-start justify-between">
                          <div className="h-9 w-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-lg shrink-0">
                            {art.type === "slide" ? "📊" : art.type === "diagram" ? "📐" : "⚡"}
                          </div>
                          <button
                            type="button"
                            onClick={() => localDb.deleteArtifact(art.id)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title={t("delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="my-3">
                          <h4 className="text-sm font-medium text-card-foreground line-clamp-2">
                            {art.title}
                          </h4>
                          <span className="inline-block mt-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                            {art.type}
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground pt-1">
                          {new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(art.updatedAt))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border bg-card/40">
                    <div className="h-12 w-12 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-3">
                      <Layers className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <h3 className="font-serif text-lg text-foreground font-medium">
                      {t("noArtifactsTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                      {t("noArtifactsDesc")}
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Dialogs */}
      <CreateLearnDialog
        open={isCreateLearnOpen}
        onOpenChange={setIsCreateLearnOpen}
        collections={collections}
        initialData={
          editingLearn
            ? {
                id: editingLearn.id,
                title: editingLearn.title,
                description: editingLearn.description,
                emoji: editingLearn.emoji,
                collectionIds: editingLearn.collectionIds,
                projectPath: editingLearn.projectPath,
                permissionMode: editingLearn.permissionMode,
              }
            : undefined
        }
        onSubmit={handleSaveLearn}
      />

      <CreateCollectionDialog
        open={isCreateCollectionOpen}
        onOpenChange={setIsCreateCollectionOpen}
        initialData={
          editingCollection
            ? {
                id: editingCollection.id,
                name: editingCollection.name,
                description: editingCollection.description,
                emoji: editingCollection.emoji,
              }
            : undefined
        }
        onSubmit={handleSaveCollection}
      />

      {managingLearn && (
        <ManageCollectionDialog
          open={!!managingLearn}
          onOpenChange={(open) => {
            if (!open) setManagingLearn(null);
          }}
          learnId={managingLearn.id}
          learnTitle={managingLearn.title}
          currentCollectionIds={managingLearn.collectionIds}
          collections={collections}
          onToggle={async (learnId, collectionId) => {
            await localDb.toggleCollection(learnId, collectionId);
          }}
          onCreateNewCollection={() => {
            setEditingCollection(null);
            setIsCreateCollectionOpen(true);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title={deleteTarget.title}
          description={deleteTarget.description}
          onConfirm={handleExecuteDelete}
        />
      )}
    </div>
  );
}
