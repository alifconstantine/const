import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, LocalLearn, LocalCollection, LocalArtifact } from "../../lib/db";
import {
  Button,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@const/ui";
import {
  Search,
  ArrowUpDown,
  Plus,
  ChevronRight,
  ArrowLeft,
  Folder,
  Trash2,
  X,
  BookOpen,
  FileText,
} from "lucide-react";

import { LearnCard, LearnItem } from "./learn-card";
import { CollectionCard, CollectionItem } from "./collection-card";
import { SourcesView } from "./sources-view";
import { CreateLearnDialog } from "./dialogs/create-learn-dialog";
import { CreateCollectionDialog } from "./dialogs/create-collection-dialog";
import { ManageCollectionDialog } from "./dialogs/manage-collection-dialog";
import { DeleteConfirmDialog } from "./dialogs/delete-confirm-dialog";
import { useI18n } from "../../lib/i18n";

type TabKey = "all" | "learns" | "sources" | "collections" | "artifact";
type SortOption = "recent" | "oldest" | "title_asc" | "title_desc";

interface LearnHomeProps {
  onOpenLearn?: (learnId: string, openAddSource?: boolean) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export function LearnHome({
  onOpenLearn,
  searchQuery: propSearchQuery,
  onSearchQueryChange,
}: LearnHomeProps) {
  const { t, language } = useI18n();

  const sortLabels: Record<SortOption, string> = useMemo(
    () => ({
      recent: t("sortRecent"),
      oldest: t("sortOldest"),
      title_asc: t("sortTitleAsc"),
      title_desc: t("sortTitleDesc"),
    }),
    [t]
  );

  const tabs: { key: TabKey; label: string }[] = useMemo(
    () => [
      { key: "all", label: t("tabAll") },
      { key: "learns", label: t("learns") },
      { key: "sources", label: t("sources") },
      { key: "collections", label: t("collections") },
      { key: "artifact", label: t("artifacts") },
    ],
    [t]
  );

  // Navigation & View state (locked to list per user instruction)
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const viewMode = "list";
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;
  const setSearchQuery = onSearchQueryChange ?? setLocalSearchQuery;
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // Floating pill active indicator state
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const currentTab = tabRefs.current[activeTab];
    if (currentTab) {
      setIndicatorStyle({
        left: currentTab.offsetLeft,
        width: currentTab.offsetWidth,
        opacity: 1,
      });
    }
  }, [activeTab]);

  // Dialog states
  const [isCreateLearnOpen, setIsCreateLearnOpen] = useState(false);
  const [editingLearn, setEditingLearn] = useState<LearnItem | null>(null);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);
  const [managingLearn, setManagingLearn] = useState<LearnItem | null>(null);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);

  const handleCreateNewLearn = async (collectionId?: string) => {
    if (onOpenLearn) {
      const id = await localDb.createLearn({
        title: t("untitledNotebook"),
        emoji: "📘",
        collectionId: collectionId || activeCollectionId || undefined,
      });
      onOpenLearn(id, true);
    } else {
      setEditingLearn(null);
      setIsCreateLearnOpen(true);
    }
  };

  const handleTriggerAddSource = async () => {
    if (learns.length === 0) {
      const id = await localDb.createLearn({
        title: t("untitledNotebook"),
        emoji: "📘",
      });
      onOpenLearn?.(id, true);
    } else {
      setIsAddSourceModalOpen(true);
    }
  };
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "learn" | "collection";
    id?: string;
    title: string;
    description: string;
  } | null>(null);

  // Dexie.js Live Queries (Reactive local database with ZERO dummy data)
  const learnsData = useLiveQuery(async () => {
    let items = await db.learns.toArray();
    items = items.filter((l) => !l.isArchived);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
      );
    }
    if (sortOption === "recent") {
      items.sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (sortOption === "oldest") {
      items.sort((a, b) => a.updatedAt - b.updatedAt);
    } else if (sortOption === "title_asc") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOption === "title_desc") {
      items.sort((a, b) => b.title.localeCompare(a.title));
    }
    return items;
  }, [searchQuery, sortOption]);

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

  const learns = useMemo(() => learnsData ?? [], [learnsData]);
  const collections = useMemo(() => collectionsData ?? [], [collectionsData]);
  const artifacts = useMemo(() => artifactsData ?? [], [artifactsData]);

  // Notebooks that have sources attached
  const sourcesLearns = useMemo(() => {
    return learns.filter((l) => (l.sourcesCount || 0) > 0);
  }, [learns]);

  // Active collection when drilled down
  const activeCollection = useMemo(() => {
    if (!activeCollectionId) return null;
    return collections.find((c) => c.id === activeCollectionId) ?? null;
  }, [collections, activeCollectionId]);

  const collectionLearns = useMemo(() => {
    if (!activeCollectionId) return [];
    return learns.filter((l) => l.collectionIds && l.collectionIds.includes(activeCollectionId));
  }, [learns, activeCollectionId]);

  // Total sources count across all learns (live from sources table with fallback to learns sum)
  const rawSourcesCount = useLiveQuery(async () => {
    return await db.sources.count();
  });

  const totalSourcesCount = useMemo(() => {
    if (rawSourcesCount !== undefined) return rawSourcesCount;
    return learns.reduce((acc, curr) => acc + (curr.sourcesCount || 0), 0);
  }, [learns, rawSourcesCount]);

  const getItemCountForActiveTab = () => {
    switch (activeTab) {
      case "all":
        return learns.length + collections.length;
      case "learns":
        return learns.length;
      case "sources":
        return totalSourcesCount;
      case "collections":
        return activeCollectionId ? collectionLearns.length : collections.length;
      case "artifact":
        return artifacts.length;
      default:
        return 0;
    }
  };

  // Submit Learn
  const handleSaveLearn = async (data: {
    id?: string;
    title: string;
    description?: string;
    emoji: string;
    collectionId?: string;
  }) => {
    if (data.id) {
      await localDb.updateLearn(data.id, {
        title: data.title,
        description: data.description,
        emoji: data.emoji,
      });
    } else {
      await localDb.createLearn({
        title: data.title,
        description: data.description,
        emoji: data.emoji,
        collectionId: data.collectionId || (activeCollectionId ?? undefined),
      });
    }
  };

  // Submit Collection
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

  // Handle Delete Confirmation
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

  return (
    <div className="w-full flex-1 flex flex-col bg-background text-foreground overflow-y-auto overflow-x-hidden min-h-0">
      {/* -------------------------------------------------------------
          FLOATING PILL NAVMENU: (All, Learns, Sources, Collections, Artifact)
          with Smooth Sliding Indicator Animation
          ------------------------------------------------------------- */}
      <div className="sticky top-0 z-30 w-full px-3 py-2 flex items-center justify-center select-none bg-background/90 backdrop-blur-md">
        <nav
          ref={navRef}
          aria-label="Navigation Tabs"
          className="relative inline-flex items-center p-1 rounded-full bg-[#222222] border border-[#383838] overflow-x-auto no-scrollbar max-w-full"
        >
          {/* Animated Sliding Pill Indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-full bg-[#2b2b2b] border border-[#383838] transition-all duration-300 pointer-events-none"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.opacity,
              transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          />

          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[tab.key] = el;
                }}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setActiveCollectionId(null);
                }}
                className={`relative z-10 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-tight whitespace-nowrap transition-colors duration-200 cursor-pointer select-none ${
                  isActive
                    ? "text-[#ffffff]"
                    : "text-[#969696] hover:text-[#d4d4d4] active:scale-95"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Collection Drilldown Header Banner */}
      {activeCollection && (
        <div className="mx-4 my-2 px-3.5 py-2 flex items-center gap-2.5 bg-[#222222] border border-[#383838] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveCollectionId(null)}
            className="h-7 w-7 rounded-full border border-[#383838] flex items-center justify-center text-[#969696] hover:text-[#d4d4d4] shrink-0 cursor-pointer active:scale-95 transition-all"
            aria-label={t("backToAllCollections")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-base">{activeCollection.emoji || "📁"}</span>
            <span className="font-sans text-sm font-semibold truncate text-[#d4d4d4]">
              {activeCollection.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingCollection(activeCollection);
                setIsCreateCollectionOpen(true);
              }}
              className="rounded-full h-7 text-[11px] px-2.5 cursor-pointer border-[#383838] text-[#d4d4d4] hover:bg-[#2b2b2b]"
            >
              {t("edit")}
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
              className="rounded-full h-7 text-[11px] px-2.5 cursor-pointer"
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MAIN CONTENT AREA (Mobile)
          ------------------------------------------------------------- */}
      <main className="flex-1 w-full px-4 py-3 space-y-4 pb-28">
        {/* Search & Sort on One Single Line (No List) */}
        <div className="flex items-center gap-2 w-full">
          {/* Search Input */}
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-[#969696] pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "learns"
                  ? t("searchNotebooks")
                  : activeTab === "collections"
                  ? t("searchCollections")
                  : activeTab === "sources"
                  ? t("searchSources")
                  : activeTab === "artifact"
                  ? t("searchArtifacts")
                  : t("searchNotebooksAndCollections")
              }
              className="h-10 w-full pl-10 pr-9 text-xs sm:text-sm rounded-xl bg-[#222222] border-[#383838] text-[#d4d4d4] placeholder:text-[#5d5d5d] focus-visible:ring-1 focus-visible:ring-[#5d5d5d]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 p-1 text-[#969696] hover:text-[#d4d4d4] cursor-pointer"
                aria-label={t("clearSearch")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Sort Dropdown (Recent) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs text-[#969696] hover:text-[#d4d4d4] hover:bg-[#222222] bg-[#222222] border border-[#383838] active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
                title={t("sort")}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>{sortLabels[sortOption]}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 p-1 shadow-none border-[#383838] bg-[#222222]">
              {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSortOption(key)}
                  className="cursor-pointer text-xs py-1.5 px-2 text-[#d4d4d4] hover:bg-[#2b2b2b]"
                >
                  {sortLabels[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tab Content with Smooth Transition */}
        <div key={activeTab + (activeCollectionId || "")} className="animate-in fade-in duration-200 space-y-4">

        {/* =========================================================
            TAB 1: ALL (Recent Learns + Collections)
            ========================================================= */}
        {activeTab === "all" && (
          <div className="space-y-6">
            {/* Section 1: Learns */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-sans text-sm font-semibold tracking-tight text-foreground">
                    {t("learns")}
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#222222] border border-[#383838] text-[#969696] font-mono">
                    {learns.length}
                  </span>
                </div>

                {learns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("learns")}
                    className="text-xs text-[#969696] hover:text-[#d4d4d4] flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <span>{t("viewAll")}</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {learns.length > 0 ? (
                  learns.map((learn) => (
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
                  ))
                ) : (
                  <div className="text-center py-6 px-4 bg-[#1b1b1b] rounded-2xl border border-dashed border-[#2e2e2e]">
                    <p className="text-xs text-[#969696]">{t("noLearnsFound")}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Section 2: Collections */}
            <section className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-sans text-sm font-semibold tracking-tight text-foreground">
                    {t("collections")}
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#222222] border border-[#383838] text-[#969696] font-mono">
                    {collections.length}
                  </span>
                </div>

                {collections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("collections")}
                    className="text-xs text-[#969696] hover:text-[#d4d4d4] flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <span>{t("viewAll")}</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {collections.length > 0 ? (
                  collections.map((col) => (
                    <CollectionCard
                      key={col.id}
                      collection={col}
                      viewMode={viewMode}
                      onClick={(c) => {
                        setActiveCollectionId(c.id);
                        setActiveTab("collections");
                      }}
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
                  ))
                ) : (
                  <div className="text-center py-6 px-4 bg-[#1b1b1b] rounded-2xl border border-dashed border-[#2e2e2e]">
                    <p className="text-xs text-[#969696]">{t("noCollectionsYet")}</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* =========================================================
            TAB 2: LEARNS
            ========================================================= */}
        {activeTab === "learns" && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <h2 className="font-sans text-sm font-semibold tracking-tight text-foreground">
                  {t("allLearns")}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#222222] border border-[#383838] text-[#969696] font-mono">
                  {learns.length}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {learns.length > 0 ? (
                learns.map((learn) => (
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
                ))
              ) : (
                <div className="text-center py-12 px-4 bg-[#1b1b1b] rounded-2xl border border-dashed border-[#2e2e2e]">
                  <div className="h-10 w-10 rounded-xl bg-[#222222] border border-[#383838] flex items-center justify-center text-lg mx-auto mb-2 text-[#969696]">
                    📘
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    {t("noLearnsFound")}
                  </h3>
                  <p className="text-xs text-[#969696]">
                    {searchQuery ? t("noLearnsMatchSearch", { query: searchQuery }) : t("noLearnsDescription")}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* =========================================================
            TAB 3: SOURCES
            ========================================================= */}
        {activeTab === "sources" && (
          <SourcesView
            onAddSource={handleTriggerAddSource}
            onOpenLearn={onOpenLearn}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery("")}
            sortOption={sortOption}
            isAddSourceModalOpen={isAddSourceModalOpen}
            onAddSourceModalOpenChange={setIsAddSourceModalOpen}
          />
        )}

        {/* =========================================================
            TAB 4: COLLECTIONS
            ========================================================= */}
        {activeTab === "collections" && (
          <section className="space-y-2.5">
            {activeCollection ? (
              // Drilled-down collection
              <div className="space-y-3">
                <div className="space-y-2">
                  {collectionLearns.length > 0 ? (
                    collectionLearns.map((learn) => (
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
                    ))
                  ) : (
                    <div className="text-center py-12 px-4 bg-[#1b1b1b] rounded-2xl border border-dashed border-[#2e2e2e]">
                      <p className="text-xs text-[#969696]">
                        {t("noLearnsInCollection")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // All Collections
              <>
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="font-sans text-sm font-semibold tracking-tight text-foreground">
                      {t("collections")}
                    </h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#222222] border border-[#383838] text-[#969696] font-mono">
                      {collections.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCollection(null);
                      setIsCreateCollectionOpen(true);
                    }}
                    className="h-7 px-2.5 rounded-full bg-[#222222] hover:bg-[#2b2b2b] text-foreground text-xs font-medium border border-[#383838] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{t("newCollection")}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {collections.length > 0 ? (
                    collections.map((col) => (
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
                    ))
                  ) : (
                    <div className="text-center py-12 px-4 bg-[#1b1b1b] rounded-2xl border border-dashed border-[#2e2e2e]">
                      <p className="text-xs text-[#969696]">{t("noCollectionsYet")}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCollection(null);
                          setIsCreateCollectionOpen(true);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] text-foreground text-xs font-medium border border-[#383838] transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t("createCardCollection")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {/* =========================================================
            TAB 5: ARTIFACTS
            ========================================================= */}
        {activeTab === "artifact" && (
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 px-0.5">
              <h2 className="font-sans text-sm font-semibold tracking-tight text-foreground">
                {t("artifacts")}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#222222] border border-[#383838] text-[#969696] font-mono">
                {artifacts.length}
              </span>
            </div>

            {artifacts.length > 0 ? (
              <div className="space-y-2">
                {artifacts.map((art) => (
                  <div
                    key={art.id}
                    className="p-3.5 rounded-2xl border border-[#383838] bg-[#1e1e24] hover:bg-[#25252b] active:scale-[0.99] transition-all duration-200 flex flex-col justify-between select-none"
                  >
                    <div className="flex items-start justify-between">
                      <div className="h-8 w-8 rounded-xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center text-base shrink-0">
                        {art.type === "slide" ? "📊" : art.type === "diagram" ? "📐" : "⚡"}
                      </div>
                      <button
                        type="button"
                        onClick={() => localDb.deleteArtifact(art.id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[#969696] hover:text-destructive active:text-destructive cursor-pointer transition-colors"
                        title={t("deleteArtifact")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="my-2">
                      <h4 className="text-xs font-medium text-foreground line-clamp-2">
                        {art.title}
                      </h4>
                      <span className="inline-block mt-1 text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-full bg-[#2b2b2b] border border-[#383838] text-[#969696]">
                        {art.type}
                      </span>
                    </div>

                    <div className="text-[10px] text-[#969696] pt-1.5">
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
              <div className="text-center py-14 px-4 border border-[#2e2e2e] rounded-2xl bg-[#1b1b1b]">
                <div className="h-10 w-10 rounded-xl bg-[#222222] border border-[#383838] flex items-center justify-center text-xl mx-auto mb-2">
                  🎨
                </div>
                <h3 className="font-sans text-sm text-foreground font-semibold">
                  {t("noArtifactsTitle")}
                </h3>
                <p className="text-xs text-[#969696] mt-1 leading-relaxed max-w-xs mx-auto">
                  {t("noArtifactsDesc")}
                </p>
              </div>
            )}
          </section>
        )}
        </div>
      </main>

      {/* -------------------------------------------------------------
          FLOATING ACTION BUTTON (+ New Learn / + New Sources) AT BOTTOM
          ------------------------------------------------------------- */}
      <div className="fixed bottom-6 right-5 z-40 safe-area-bottom">
        {activeTab === "sources" ? (
          <button
            type="button"
            onClick={handleTriggerAddSource}
            className="h-12 px-5 rounded-full bg-foreground text-background hover:opacity-95 active:scale-95 transition-all duration-200 flex items-center gap-2 font-medium text-xs border border-background/20 cursor-pointer select-none shadow-lg"
            aria-label={t("newSources")}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t("newSources")}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleCreateNewLearn()}
            className="h-12 px-5 rounded-full bg-foreground text-background hover:opacity-95 active:scale-95 transition-all duration-200 flex items-center gap-2 font-medium text-xs border border-background/20 cursor-pointer select-none shadow-lg"
            aria-label={t("newLearn")}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t("newLearn")}</span>
          </button>
        )}
      </div>

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
