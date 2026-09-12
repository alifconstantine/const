import React, { useState, useMemo } from "react";
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
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  Plus,
  ChevronRight,
  ArrowLeft,
  Package,
  Folder,
  Trash2,
  X,
  Layers,
  BookOpen,
} from "lucide-react";

import { LearnCard, LearnItem } from "./learn-card";
import { CollectionCard, CollectionItem } from "./collection-card";
import { CreateCard } from "./create-card";
import { CreateLearnDialog } from "./dialogs/create-learn-dialog";
import { CreateCollectionDialog } from "./dialogs/create-collection-dialog";
import { ManageCollectionDialog } from "./dialogs/manage-collection-dialog";
import { DeleteConfirmDialog } from "./dialogs/delete-confirm-dialog";

type TabKey = "all" | "my_learn" | "collections" | "artifacts";
type SortOption = "recent" | "oldest" | "title_asc" | "title_desc";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Recent",
  oldest: "Oldest",
  title_asc: "A-Z",
  title_desc: "Z-A",
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "my_learn", label: "My Learn" },
  { key: "collections", label: "Collections" },
  { key: "artifacts", label: "Artifacts" },
];

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
  // Navigation & View state (locked to list per user instruction)
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const viewMode = "list";
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;
  const setSearchQuery = onSearchQueryChange ?? setLocalSearchQuery;
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // Dialog states
  const [isCreateLearnOpen, setIsCreateLearnOpen] = useState(false);
  const [editingLearn, setEditingLearn] = useState<LearnItem | null>(null);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);
  const [managingLearn, setManagingLearn] = useState<LearnItem | null>(null);

  const handleCreateNewLearn = async (collectionId?: string) => {
    if (onOpenLearn) {
      const id = await localDb.createLearn({
        title: "Untitled notebook",
        emoji: "📘",
        collectionId: collectionId || activeCollectionId || undefined,
      });
      onOpenLearn(id, true);
    } else {
      setEditingLearn(null);
      setIsCreateLearnOpen(true);
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

  // Active collection when drilled down
  const activeCollection = useMemo(() => {
    if (!activeCollectionId) return null;
    return collections.find((c) => c.id === activeCollectionId) ?? null;
  }, [collections, activeCollectionId]);

  const collectionLearns = useMemo(() => {
    if (!activeCollectionId) return [];
    return learns.filter((l) => l.collectionIds && l.collectionIds.includes(activeCollectionId));
  }, [learns, activeCollectionId]);

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
    <div className="w-full flex-1 flex flex-col bg-background text-foreground min-h-screen">
      {/* -------------------------------------------------------------
          MAIN CONTENT MENU CHIPS: (All, My Learn, Collections, Artifacts)
          ------------------------------------------------------------- */}
      <div className="sticky top-14 z-30 w-full bg-background/90 backdrop-blur-md px-3.5 py-2 select-none">
        <div className="flex items-center gap-1.5 w-full">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setActiveCollectionId(null);
                }}
                className={`flex-1 py-1.5 px-1 rounded-full text-[11px] sm:text-xs font-medium text-center tracking-tight transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-secondary text-foreground font-semibold border border-white/10 shadow-xs active:scale-95"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 active:scale-95"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collection Drilldown Header Banner */}
      {activeCollection && (
        <div className="mx-3.5 my-1.5 px-3 py-2 flex items-center gap-2 bg-secondary/30 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveCollectionId(null)}
            className="h-7 w-7 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 cursor-pointer active:scale-95 transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base">{activeCollection.emoji || "📁"}</span>
            <span className="font-sans text-sm font-semibold truncate text-foreground">
              {activeCollection.name}
            </span>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MAIN CONTENT AREA (Mobile)
          ------------------------------------------------------------- */}
      <main className="flex-1 w-full px-3.5 py-4 space-y-6 pb-28">
        {/* =========================================================
            TAB: ALL (My Learn + Koleksi)
            ========================================================= */}
        {activeTab === "all" && (
          <>
            {/* Section 1: My Learn */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-sans text-base font-semibold tracking-tight text-foreground">
                    My Learn
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                    {learns.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="h-7 px-2 rounded-full flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary active:scale-95 transition-all duration-200 cursor-pointer"
                        title="Sort"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        <span>{SORT_LABELS[sortOption]}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 p-1 shadow-md">
                      {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => setSortOption(key)}
                          className="cursor-pointer text-xs py-1.5 px-2"
                        >
                          {SORT_LABELS[key]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {learns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("my_learn")}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors cursor-pointer pl-1"
                    >
                      <span>View all</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <CreateCard
                  type="learn"
                  onClick={() => handleCreateNewLearn()}
                />

                {learns.map((learn) => (
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
                        title: `Delete notebook "${l.title}"?`,
                        description:
                          "This action cannot be undone. Notebook data will be permanently deleted.",
                      })
                    }
                  />
                ))}
              </div>
            </section>

            {/* Section 2: Collections */}
            <section className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-sans text-base font-semibold tracking-tight text-foreground">
                    Collections
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                    {collections.length}
                  </span>
                </div>

                {collections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("collections")}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <span>View all</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
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
                        title: `Delete collection "${c.name}"?`,
                        description:
                          "Notebooks inside this collection will not be deleted, only unlinked.",
                      })
                    }
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {/* =========================================================
            TAB: MY LEARN (Mobile)
            ========================================================= */}
        {activeTab === "my_learn" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-sans text-base font-semibold tracking-tight text-foreground">
                  My Learn
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                  {learns.length}
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-7 px-2 rounded-full flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary active:scale-95 transition-all duration-200 cursor-pointer"
                    title="Sort"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    <span>{SORT_LABELS[sortOption]}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36 p-1 shadow-md">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => setSortOption(key)}
                      className="cursor-pointer text-xs py-1.5 px-2"
                    >
                      {SORT_LABELS[key]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-2">
              <CreateCard
                type="learn"
                onClick={() => handleCreateNewLearn()}
              />

              {learns.map((learn) => (
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
                      title: `Delete notebook "${l.title}"?`,
                      description: "This notebook will be permanently deleted.",
                    })
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* =========================================================
            TAB: COLLECTIONS (Mobile)
            ========================================================= */}
        {activeTab === "collections" && (
          <section className="space-y-3">
            {activeCollection ? (
              // Drilled-down collection
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveCollectionId(null)}
                      className="h-7 w-7 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer active:scale-95 transition-all"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <div>
                      <h2 className="font-sans text-base font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                        <span>{activeCollection.emoji || "📁"}</span>
                        <span>{activeCollection.name}</span>
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCollection(activeCollection);
                        setIsCreateCollectionOpen(true);
                      }}
                      className="rounded-full h-7 text-[11px] px-2.5 cursor-pointer"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        setDeleteTarget({
                          type: "collection",
                          id: activeCollection.id,
                          title: `Delete collection "${activeCollection.name}"?`,
                          description:
                            "Notebooks in this collection will not be deleted.",
                        })
                      }
                      className="rounded-full h-7 text-[11px] px-2.5 cursor-pointer"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
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
                          title: `Delete notebook "${l.title}"?`,
                          description: "This notebook will be permanently deleted.",
                        })
                      }
                    />
                  ))}
                </div>

                {collectionLearns.length === 0 && (
                  <div className="text-center py-10 px-4 bg-secondary/20 rounded-2xl border border-dashed border-border/70">
                    <p className="text-xs text-muted-foreground">
                      No notebooks in this collection yet.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // All Collections
              <>
                <div className="flex items-center gap-2">
                  <h2 className="font-sans text-base font-semibold tracking-tight text-foreground">
                    Collections
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                    {collections.length}
                  </span>
                </div>

                <div className="space-y-2">
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
                          title: `Delete collection "${c.name}"?`,
                          description:
                            "Notebooks inside this collection will not be deleted.",
                        })
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* =========================================================
            TAB: ARTIFACTS (Mobile)
            ========================================================= */}
        {activeTab === "artifacts" && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-sans text-base font-semibold tracking-tight text-foreground">
                Artifacts
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                {artifacts.length}
              </span>
            </div>

            {artifacts.length > 0 ? (
              <div className="space-y-2">
                {artifacts.map((art) => (
                  <div
                    key={art.id}
                    className="p-3.5 rounded-2xl border border-border/80 dark:border-white/10 bg-[#1e1e22] dark:bg-[#1e1e24] hover:bg-[#25252b] active:bg-gradient-to-r active:from-[#282832] active:to-[#1e1e24] active:scale-[0.99] transition-all duration-200 flex flex-col justify-between select-none"
                  >
                    <div className="flex items-start justify-between">
                      <div className="h-8 w-8 rounded-xl bg-secondary/80 flex items-center justify-center text-lg shrink-0 border border-white/10 shadow-2xs">
                        {art.type === "slide" ? "📊" : art.type === "diagram" ? "📐" : "⚡"}
                      </div>
                      <button
                        type="button"
                        onClick={() => localDb.deleteArtifact(art.id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive active:text-destructive cursor-pointer transition-colors"
                        title="Delete artifact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="my-2">
                      <h4 className="text-xs font-medium text-foreground line-clamp-2">
                        {art.title}
                      </h4>
                      <span className="inline-block mt-1 text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {art.type}
                      </span>
                    </div>

                    <div className="text-[10px] text-muted-foreground pt-1.5">
                      {new Intl.DateTimeFormat("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(art.updatedAt))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-14 px-4">
                <div className="h-10 w-10 rounded-2xl bg-secondary/80 flex items-center justify-center text-xl mx-auto mb-2 border border-white/10">
                  🎨
                </div>
                <h3 className="font-sans text-base text-foreground font-semibold">
                  No artifacts yet
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Artifacts like presentation slides and interactive diagrams generated during your learning sessions will appear here.
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      {/* -------------------------------------------------------------
          FLOATING ACTION BUTTON (+ Create new) CENTERED AT BOTTOM
          ------------------------------------------------------------- */}
      <div className="fixed bottom-6 inset-x-0 flex justify-center z-40 pointer-events-none safe-area-bottom">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto h-12 px-6 rounded-full bg-foreground text-background hover:opacity-95 active:scale-95 active:bg-gradient-to-r active:from-foreground active:to-foreground/80 transition-all duration-200 flex items-center gap-2 font-medium text-sm shadow-xl border border-background/20 cursor-pointer select-none"
              aria-label="Create new"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Create new</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-56 p-1.5 border border-border bg-popover mb-2 shadow-xl rounded-xl">
            <DropdownMenuItem
              onClick={() => handleCreateNewLearn()}
              className="cursor-pointer text-xs py-2.5 px-3 flex items-center gap-3 rounded-lg"
            >
              <div className="h-7 w-7 rounded-md bg-secondary text-foreground flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-medium text-foreground">Create notebook</span>
                <span className="text-[10px] text-muted-foreground">New blank notebook</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={() => {
                setEditingCollection(null);
                setIsCreateCollectionOpen(true);
              }}
              className="cursor-pointer text-xs py-2.5 px-3 flex items-center gap-3 rounded-lg"
            >
              <div className="h-7 w-7 rounded-md bg-secondary text-foreground flex items-center justify-center shrink-0">
                <Folder className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-medium text-foreground">Create collection</span>
                <span className="text-[10px] text-muted-foreground">New category folder</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
