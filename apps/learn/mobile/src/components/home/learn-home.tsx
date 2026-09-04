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
  recent: "Terbaru",
  oldest: "Terlama",
  title_asc: "A-Z",
  title_desc: "Z-A",
};

interface LearnHomeProps {
  onOpenLearn?: (learnId: string, openAddSource?: boolean) => void;
}

export function LearnHome({ onOpenLearn }: LearnHomeProps) {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
        title: "Notebook tanpa judul",
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
          MOBILE TOP CONTROLS BAR: Slim single row
          ------------------------------------------------------------- */}
      <div className="sticky top-0 z-30 w-full bg-background/95 backdrop-blur-md px-3.5 py-2.5 flex items-center justify-between gap-2 select-none">
        {isSearchOpen ? (
          <div className="relative flex items-center flex-1 animate-in fade-in duration-150">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari materi belajar..."
              className="h-8 w-full pl-8 pr-7 text-xs rounded-full bg-secondary/50 border-border/70 focus-visible:ring-1"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="absolute right-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            {/* Left: Active Section Title or Breadcrumb */}
            <div className="flex items-center gap-1.5 min-w-0">
              {activeCollection ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveCollectionId(null)}
                    className="h-7 w-7 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-serif text-sm font-medium truncate text-foreground flex items-center gap-1">
                    <span>{activeCollection.emoji || "📁"}</span>
                    <span>{activeCollection.name}</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="font-serif text-base font-normal tracking-tight text-foreground truncate">
                    {activeTab === "all"
                      ? "Semua Materi"
                      : activeTab === "my_learn"
                      ? "My Learn"
                      : activeTab === "collections"
                      ? "Koleksi"
                      : "Artifact"}
                  </h1>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground font-mono shrink-0">
                    {activeTab === "all"
                      ? learns.length + collections.length
                      : activeTab === "my_learn"
                      ? learns.length
                      : activeTab === "collections"
                      ? collections.length
                      : artifacts.length}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Quick Tools (Search, View Mode, Sort) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Cari materi"
              >
                <Search className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Ganti tampilan"
              >
                {viewMode === "grid" ? (
                  <LayoutGrid className="h-4 w-4" />
                ) : (
                  <ListIcon className="h-4 w-4" />
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-8 px-2 rounded-full flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
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
          </>
        )}
      </div>

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
                  <h2 className="font-serif text-lg font-normal text-foreground">
                    My Learn
                  </h2>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-secondary text-muted-foreground font-mono">
                    {learns.length}
                  </span>
                </div>

                {learns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("my_learn")}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <span>Lihat semua</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div
                className={
                  viewMode === "grid" ? "grid grid-cols-2 gap-2.5" : "space-y-2"
                }
              >
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
                        title: `Hapus Learn "${l.title}"?`,
                        description:
                          "Tindakan ini tidak dapat dibatalkan. Data materi akan dihapus permanen.",
                      })
                    }
                  />
                ))}
              </div>
            </section>

            {/* Section 2: Koleksi */}
            <section className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-lg font-normal text-foreground">
                    Koleksi
                  </h2>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-secondary text-muted-foreground font-mono">
                    {collections.length}
                  </span>
                </div>

                {collections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("collections")}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <span>Lihat semua</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div
                className={
                  viewMode === "grid" ? "grid grid-cols-2 gap-2.5" : "space-y-2"
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
                        title: `Hapus Koleksi "${c.name}"?`,
                        description:
                          "Materi learn di dalam koleksi ini tidak akan dihapus, hanya kategorinya yang dilepaskan.",
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
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-normal text-foreground">
                My Learn
              </h2>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-secondary text-muted-foreground font-mono">
                {learns.length}
              </span>
            </div>

            <div
              className={
                viewMode === "grid" ? "grid grid-cols-2 gap-2.5" : "space-y-2"
              }
            >
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
                      title: `Hapus Learn "${l.title}"?`,
                      description: "Materi belajar akan dihapus permanen.",
                    })
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* =========================================================
            TAB: KOLEKSI (Mobile)
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
                      className="h-7 w-7 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <div>
                      <h2 className="font-serif text-lg font-normal text-foreground flex items-center gap-1.5">
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
                      Ubah
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
                            "Materi learn di dalam koleksi ini tidak akan dihapus.",
                        })
                      }
                      className="rounded-full h-7 text-[11px] px-2.5 cursor-pointer"
                    >
                      Hapus
                    </Button>
                  </div>
                </div>

                <div
                  className={
                    viewMode === "grid" ? "grid grid-cols-2 gap-2.5" : "space-y-2"
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
                          description: "Materi belajar akan dihapus permanen.",
                        })
                      }
                    />
                  ))}
                </div>

                {collectionLearns.length === 0 && (
                  <div className="text-center py-10 px-4 bg-secondary/20 rounded-2xl border border-dashed border-border/70">
                    <p className="text-xs text-muted-foreground">
                      Belum ada learn dalam koleksi ini.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // All Collections
              <>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl font-normal text-foreground">
                    Koleksi
                  </h2>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-secondary text-muted-foreground font-mono">
                    {collections.length}
                  </span>
                </div>

                <div
                  className={
                    viewMode === "grid" ? "grid grid-cols-2 gap-2.5" : "space-y-2"
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
                            "Materi learn di dalam koleksi ini tidak akan dihapus.",
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
            TAB: ARTIFACT (Mobile)
            ========================================================= */}
        {activeTab === "artifacts" && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-normal text-foreground">
                Artifact
              </h2>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-secondary text-muted-foreground font-mono">
                {artifacts.length}
              </span>
            </div>

            {artifacts.length > 0 ? (
              <div className="space-y-2">
                {artifacts.map((art) => (
                  <div
                    key={art.id}
                    className="p-3.5 rounded-2xl border border-border/70 bg-card transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <div className="h-8 w-8 rounded-xl bg-secondary/80 flex items-center justify-center text-lg shrink-0">
                        {art.type === "slide" ? "📊" : art.type === "diagram" ? "📐" : "⚡"}
                      </div>
                      <button
                        type="button"
                        onClick={() => localDb.deleteArtifact(art.id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground active:text-destructive cursor-pointer"
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
              <div className="text-center py-14 px-4">
                <div className="h-10 w-10 rounded-2xl bg-secondary/80 flex items-center justify-center text-xl mx-auto mb-2">
                  🎨
                </div>
                <h3 className="font-serif text-base text-foreground font-medium">
                  Belum ada artifact
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Artifact seperti slide presentasi dan diagram interaktif yang dihasilkan saat Anda belajar akan muncul di sini.
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      {/* -------------------------------------------------------------
          MOBILE BOTTOM NAVIGATION BAR WITH CENTER ELEVATED "+ BUAT"
          ------------------------------------------------------------- */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md safe-area-bottom px-2 py-1.5 flex items-center justify-around shadow-sm">
        {/* All Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("all");
            setActiveCollectionId(null);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors cursor-pointer ${
            activeTab === "all"
              ? "text-[#0066ff] font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-5 w-5" />
          <span className="text-[10px] mt-1 tracking-tight">All</span>
        </button>

        {/* My Learn Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("my_learn");
            setActiveCollectionId(null);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors cursor-pointer relative ${
            activeTab === "my_learn"
              ? "text-[#0066ff] font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="relative">
            <BookOpen className="h-5 w-5" />
            {learns.length > 0 && (
              <span className="absolute -top-1 -right-2.5 h-3.5 min-w-3.5 px-1 rounded-full bg-secondary text-[9px] font-mono flex items-center justify-center text-muted-foreground">
                {learns.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">My Learn</span>
        </button>

        {/* Center Elevated Action Button (+ Buat) */}
        <div className="flex items-center justify-center px-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-12 w-12 -mt-5 rounded-full bg-[#0066ff] text-white shadow-lg hover:bg-[#0052cc] active:scale-95 transition-all flex items-center justify-center cursor-pointer border-2 border-background"
                aria-label="Buat Baru"
              >
                <Plus className="h-6 w-6 stroke-[2.5]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-52 p-1.5 shadow-xl mb-2">
              <DropdownMenuItem
                onClick={() => handleCreateNewLearn()}
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2.5 rounded-lg"
              >
                <div className="h-7 w-7 rounded-md bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-medium text-foreground">Buat Learn</span>
                  <span className="text-[10px] text-muted-foreground">Catatan materi baru</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={() => {
                  setEditingCollection(null);
                  setIsCreateCollectionOpen(true);
                }}
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2.5 rounded-lg"
              >
                <div className="h-7 w-7 rounded-md bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center shrink-0">
                  <Folder className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-medium text-foreground">Buat Koleksi</span>
                  <span className="text-[10px] text-muted-foreground">Kategori materi baru</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Koleksi Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("collections");
            setActiveCollectionId(null);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors cursor-pointer relative ${
            activeTab === "collections"
              ? "text-[#0066ff] font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="relative">
            <Folder className="h-5 w-5" />
            {collections.length > 0 && (
              <span className="absolute -top-1 -right-2.5 h-3.5 min-w-3.5 px-1 rounded-full bg-secondary text-[9px] font-mono flex items-center justify-center text-muted-foreground">
                {collections.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Koleksi</span>
        </button>

        {/* Artifact Tab */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("artifacts");
            setActiveCollectionId(null);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-colors cursor-pointer relative ${
            activeTab === "artifacts"
              ? "text-[#0066ff] font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="relative">
            <Package className="h-5 w-5" />
            {artifacts.length > 0 && (
              <span className="absolute -top-1 -right-2.5 h-3.5 min-w-3.5 px-1 rounded-full bg-secondary text-[9px] font-mono flex items-center justify-center text-muted-foreground">
                {artifacts.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Artifact</span>
        </button>
      </nav>

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
