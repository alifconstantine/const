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

  // Total sources count across all learns
  const totalSourcesCount = useMemo(() => {
    return allLearns.reduce((acc, curr) => acc + (curr.sourcesCount || 0), 0);
  }, [allLearns]);

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
  }) => {
    if (data.id) {
      await localDb.updateLearn(data.id, {
        title: data.title,
        description: data.description,
        emoji: data.emoji,
        projectPath: data.projectPath,
      });
    } else {
      const newId = await localDb.createLearn({
        title: data.title,
        description: data.description,
        emoji: data.emoji,
        collectionId: data.collectionId || (activeCollectionId ?? undefined),
        projectPath: data.projectPath,
      });
      // Create initial chat session
      const initialSessionId = await localDb.createSession(newId, "Sesi Awal");
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
        className="p-1.5 -ml-1 rounded-xl bg-[#dedee2]/60 hover:bg-[#dedee2] dark:bg-[#2b2b2b] dark:hover:bg-[#383838] text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-none"
        title="Buka sidebar (Ctrl+B)"
        aria-label="Buka sidebar"
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
    <div className="h-screen w-full flex bg-[#ececee] dark:bg-[#2b2b2b] text-[#262626] dark:text-[#d4d4d4] overflow-hidden select-none">
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

      {/* 2. Main Canvas (Left rounded against sidebar, bg #161616 per DESIGN.md - no dividing lines) */}
      <main
        className={`flex-1 min-w-0 h-full bg-[#f8f8f8] dark:bg-[#161616] text-[#262626] dark:text-[#d4d4d4] overflow-hidden flex flex-col relative transition-[border-radius] duration-200 ${
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
                    <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-[#262626] dark:text-white">
                      Learns
                    </h1>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#dedee2] dark:bg-[#2b2b2b] text-[#737373] dark:text-[#969696] font-mono">
                      {filteredLearns.length}
                    </span>
                  </div>

                  {/* Right: Grid/List Toggle, Search, New Learns */}
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                    {/* View Mode Toggle (Grid vs List/Rows) */}
                    <div className="flex items-center p-0.5 rounded-xl bg-[#ececee] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838]">
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          viewMode === "grid"
                            ? "bg-white dark:bg-[#383838] text-[#111111] dark:text-white shadow-none"
                            : "text-[#737373] dark:text-[#969696] hover:text-black dark:hover:text-white"
                        }`}
                        title="Tampilan Grid"
                        aria-label="Tampilan Grid"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          viewMode === "list"
                            ? "bg-white dark:bg-[#383838] text-[#111111] dark:text-white shadow-none"
                            : "text-[#737373] dark:text-[#969696] hover:text-black dark:hover:text-white"
                        }`}
                        title="Tampilan Baris"
                        aria-label="Tampilan Baris"
                      >
                        <ListIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#8a8a8a] dark:text-[#777777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search learns..."
                        className="h-8 w-44 sm:w-56 pl-8 pr-7 text-xs rounded-xl bg-white dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] placeholder-[#8a8a8a] dark:placeholder-[#777777] focus-visible:ring-1 focus-visible:ring-[#888888] shadow-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a8a8a] dark:text-[#777777] hover:text-[#262626] dark:hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* New Learns Button */}
                    <Button
                      size="sm"
                      onClick={() => handleCreateNewLearn()}
                      className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-[#262626] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-zinc-200 transition-all cursor-pointer shadow-none"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>New Learns</span>
                    </Button>
                  </div>
                </div>

                {/* Section 1: Recently Viewed (Smaller Cards) */}
                {recentlyViewedLearns.length > 0 && !searchQuery && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-1.5 text-[#8a8a8a] dark:text-[#777777]">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">
                        Recently Viewed
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

                {/* Section 2: All Learns ("di bawahnya baru semua learn nya itu") */}
                <section className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[#8a8a8a] dark:text-[#777777]">
                      All Learns
                    </span>
                    {searchQuery && (
                      <span className="text-xs text-[#8a8a8a] dark:text-[#777777]">
                        Hasil pencarian untuk &quot;{searchQuery}&quot;
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
                    {/* First Card: Quick Create Learn Card */}
                    <CreateCard
                      type="learn"
                      onClick={() => handleCreateNewLearn()}
                    />

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
                            title: `Hapus Learn "${l.title}"?`,
                            description:
                              "Tindakan ini tidak dapat dibatalkan. Seluruh catatan riset dan percakapan akan dihapus.",
                          })
                        }
                      />
                    ))}
                  </div>

                  {filteredLearns.length === 0 && searchQuery && (
                    <div className="text-center py-14 px-4 rounded-2xl border border-dashed border-[#dedee2] dark:border-[#383838] bg-white/40 dark:bg-[#1e1e1e]/40">
                      <p className="text-xs text-[#8a8a8a] dark:text-[#888888]">
                        Tidak ada learn yang cocok dengan &quot;{searchQuery}&quot;.
                      </p>
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
                onAddSource={() => handleCreateNewLearn()}
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
                          className="h-8 w-8 rounded-full border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#eaeaea] dark:hover:bg-[#282828] cursor-pointer transition-colors"
                          title="Kembali ke semua koleksi"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{activeCollection.emoji || "📁"}</span>
                            <h2 className="font-serif text-2xl font-normal text-[#262626] dark:text-white">
                              {activeCollection.name}
                            </h2>
                          </div>
                          {activeCollection.description && (
                            <p className="text-xs text-[#8a8a8a] dark:text-[#888888] mt-0.5">
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
                          className="rounded-xl h-8 text-xs border-[#dedee2] dark:border-[#383838] cursor-pointer"
                        >
                          Ubah Koleksi
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({
                              type: "collection",
                              id: activeCollection.id,
                              title: `Hapus Koleksi "${activeCollection.name}"?`,
                              description:
                                "Materi learn di dalam koleksi ini tidak akan dihapus, hanya tautan kategorinya yang dilepaskan.",
                            })
                          }
                          className="rounded-xl h-8 text-xs cursor-pointer"
                        >
                          Hapus
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
                      <CreateCard
                        type="learn"
                        onClick={() => handleCreateNewLearn(activeCollectionId || undefined)}
                      />

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
                              title: `Hapus Learn "${l.title}"?`,
                              description:
                                "Tindakan ini tidak dapat dibatalkan. Seluruh data riset dan artefak yang tersimpan di dalam learn ini akan dihapus permanen.",
                            })
                          }
                        />
                      ))}
                    </div>

                    {collectionLearns.length === 0 && (
                      <div className="text-center py-14 px-4 bg-white/40 dark:bg-[#1e1e1e]/40 rounded-2xl border border-dashed border-[#dedee2] dark:border-[#383838]">
                        <p className="text-xs text-[#8a8a8a] dark:text-[#888888]">
                          Belum ada learn dalam koleksi ini.
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
                        <h2 className="font-serif text-2xl font-normal text-[#262626] dark:text-white">
                          Collections
                        </h2>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#dedee2] dark:bg-[#2b2b2b] text-[#737373] dark:text-[#969696] font-mono">
                          {collections.length} koleksi
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
                      <CreateCard
                        type="collection"
                        onClick={() => {
                          setEditingCollection(null);
                          setIsCreateCollectionOpen(true);
                        }}
                      />

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
                              title: `Hapus Koleksi "${c.name}"?`,
                              description:
                                "Materi learn di dalam koleksi ini tidak akan dihapus, hanya tautan kategorinya yang dilepaskan.",
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
                    <h2 className="font-serif text-2xl font-normal text-[#262626] dark:text-white">
                      Artifact
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#dedee2] dark:bg-[#2b2b2b] text-[#737373] dark:text-[#969696] font-mono">
                      {artifacts.length}
                    </span>
                  </div>
                </div>

                {artifacts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {artifacts.map((art) => (
                      <div
                        key={art.id}
                        className="p-4 rounded-2xl border border-[#dedee2] dark:border-[#383838] bg-white dark:bg-[#222222] hover:border-[#b0b0b0] dark:hover:border-[#4f4f4f] transition-all flex flex-col justify-between shadow-none"
                      >
                        <div className="flex items-start justify-between">
                          <div className="h-9 w-9 rounded-xl bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-lg shrink-0">
                            {art.type === "slide" ? "📊" : art.type === "diagram" ? "📐" : "⚡"}
                          </div>
                          <button
                            type="button"
                            onClick={() => localDb.deleteArtifact(art.id)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-[#8a8a8a] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Hapus artifact"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="my-3">
                          <h4 className="text-sm font-medium text-[#262626] dark:text-[#d4d4d4] line-clamp-2">
                            {art.title}
                          </h4>
                          <span className="inline-block mt-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#f4f4f6] dark:bg-[#2b2b2b] text-[#737373] dark:text-[#969696] border border-[#dedee2] dark:border-[#383838]">
                            {art.type}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#8a8a8a] dark:text-[#777777] pt-1">
                          {new Intl.DateTimeFormat("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(art.updatedAt))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-[#dedee2] dark:border-[#383838] bg-white/40 dark:bg-[#1e1e1e]/40">
                    <div className="h-12 w-12 rounded-2xl bg-[#f4f4f6] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-2xl mx-auto mb-3">
                      🎨
                    </div>
                    <h3 className="font-serif text-lg text-[#262626] dark:text-white font-medium">
                      Belum ada artifact
                    </h3>
                    <p className="text-xs text-[#8a8a8a] dark:text-[#888888] mt-1 max-w-sm mx-auto leading-relaxed">
                      Slide presentasi, visualisasi diagram, dan modul interaktif yang dihasilkan saat Anda belajar dengan agen akan otomatis tersimpan di sini.
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
