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
  Check,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  Plus,
  ChevronRight,
  ArrowLeft,
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
  title_asc: "Nama (A-Z)",
  title_desc: "Nama (Z-A)",
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

  // Dexie.js Live Queries (Reactive, ACID-compliant local database with ZERO dummy data)
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

  // Active collection object when drilled down
  const activeCollection = useMemo(() => {
    if (!activeCollectionId) return null;
    return collections.find((c) => c.id === activeCollectionId) ?? null;
  }, [collections, activeCollectionId]);

  // Filtered learns when viewing a specific collection
  const collectionLearns = useMemo(() => {
    if (!activeCollectionId) return [];
    return learns.filter((l) => l.collectionIds && l.collectionIds.includes(activeCollectionId));
  }, [learns, activeCollectionId]);

  // Submit Learn creation or edit
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
      await localDb.createLearn({
        title: data.title,
        description: data.description,
        emoji: data.emoji,
        collectionId: data.collectionId || (activeCollectionId ?? undefined),
        projectPath: data.projectPath,
      });
    }
  };

  // Submit Collection creation or edit
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
          TOP BAR: Filter Pills on Left, Tools on Right (Ref: Gemini Notebook)
          ------------------------------------------------------------- */}
      <div className="sticky top-0 z-30 w-full bg-background/95 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-4 select-none">
        {/* Left: Filter Tabs (All, My Learn, Koleksi, Artifact) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              setActiveCollectionId(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("my_learn");
              setActiveCollectionId(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "my_learn"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <span>My Learn</span>
            {learns.length > 0 && (
              <span className="text-[10px] opacity-75">({learns.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("collections");
              setActiveCollectionId(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "collections"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <span>Koleksi</span>
            {collections.length > 0 && (
              <span className="text-[10px] opacity-75">({collections.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("artifacts");
              setActiveCollectionId(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "artifacts"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <span>Artifact</span>
            {artifacts.length > 0 && (
              <span className="text-[10px] opacity-75">({artifacts.length})</span>
            )}
          </button>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search Input / Expandable */}
          {isSearchOpen ? (
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari learn atau topik..."
                className="h-8 w-44 sm:w-60 pl-8 pr-7 text-xs rounded-full bg-secondary/50 border-border/70 focus-visible:ring-1"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }}
                className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Cari materi"
            >
              <Search className="h-4 w-4" />
            </button>
          )}

          {/* Grid / List View Toggle */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title={viewMode === "grid" ? "Tampilan Daftar" : "Tampilan Grid"}
          >
            {viewMode === "grid" ? (
              <LayoutGrid className="h-4 w-4" />
            ) : (
              <ListIcon className="h-4 w-4" />
            )}
          </button>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-8 px-2.5 rounded-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{SORT_LABELS[sortOption]}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 p-1.5 shadow-md">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSortOption(key)}
                  className={`cursor-pointer text-xs py-1.5 px-2 flex items-center justify-between ${
                    sortOption === key ? "font-medium text-foreground bg-secondary/80" : ""
                  }`}
                >
                  <span>{SORT_LABELS[key]}</span>
                  {sortOption === key && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* + Buat Baru CTA Pill (Dropdown or Click) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="h-8 px-3.5 rounded-full text-xs font-medium gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Buat baru</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-md">
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => handleCreateNewLearn()}
              >
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Buat Learn Baru</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                onClick={() => {
                  setEditingCollection(null);
                  setIsCreateCollectionOpen(true);
                }}
              >
                <Folder className="h-4 w-4 text-primary" />
                <span>Buat Koleksi Baru</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* -------------------------------------------------------------
          MAIN CONTENT AREA
          ------------------------------------------------------------- */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 space-y-10">
        {/* =========================================================
            TAB: ALL (Shows "My Learn" AND "Koleksi")
            ========================================================= */}
        {activeTab === "all" && (
          <>
            {/* Section 1: My Learn */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-serif text-xl font-normal text-foreground">
                    My Learn
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                    {learns.length}
                  </span>
                </div>

                {learns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("my_learn")}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer group"
                  >
                    <span>Lihat semua</span>
                    <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>

              {/* Grid or List of My Learn */}
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                    : "space-y-2"
                }
              >
                {/* First Item: + Buat learn baru card */}
                <CreateCard
                  type="learn"
                  onClick={() => handleCreateNewLearn()}
                />

                {/* Real User Learns */}
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
                          "Tindakan ini tidak dapat dibatalkan. Seluruh data riset dan artefak yang tersimpan di dalam learn ini akan dihapus permanen.",
                      })
                    }
                  />
                ))}
              </div>
            </section>

            {/* Section 2: Koleksi (Manual categorization of learns) */}
            <section className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-serif text-xl font-normal text-foreground">
                    Koleksi
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                    {collections.length}
                  </span>
                </div>

                {collections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("collections")}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer group"
                  >
                    <span>Lihat semua</span>
                    <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>

              {/* Grid or List of Koleksi */}
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                    : "space-y-2"
                }
              >
                {/* First Item: + Buat koleksi baru card */}
                <CreateCard
                  type="collection"
                  onClick={() => {
                    setEditingCollection(null);
                    setIsCreateCollectionOpen(true);
                  }}
                />

                {/* Real User Collections */}
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
                          "Materi learn di dalam koleksi ini tidak akan dihapus, hanya tautan kategorinya yang dilepaskan.",
                      })
                    }
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {/* =========================================================
            TAB: MY LEARN (Full view of learns)
            ========================================================= */}
        {activeTab === "my_learn" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="font-serif text-2xl font-normal text-foreground">
                  My Learn
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                  {learns.length} materi
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
              {/* First Item: + Buat learn baru card */}
              <CreateCard
                type="learn"
                onClick={() => handleCreateNewLearn()}
              />

              {/* Real User Learns */}
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
                        "Tindakan ini tidak dapat dibatalkan. Seluruh data riset dan artefak yang tersimpan di dalam learn ini akan dihapus permanen.",
                    })
                  }
                />
              ))}
            </div>

            {learns.length === 0 && searchQuery && (
              <div className="text-center py-12 text-xs text-muted-foreground">
                Tidak ada materi belajar yang cocok dengan pencarian &quot;{searchQuery}&quot;.
              </div>
            )}
          </section>
        )}

        {/* =========================================================
            TAB: KOLEKSI (Collections or Drilled-down collection)
            ========================================================= */}
        {activeTab === "collections" && (
          <section className="space-y-4">
            {activeCollection ? (
              // Drilled-down collection view
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveCollectionId(null)}
                      className="h-8 w-8 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                      title="Kembali ke semua koleksi"
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
                      className="rounded-full h-8 text-xs cursor-pointer"
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
                      className="rounded-full h-8 text-xs cursor-pointer"
                    >
                      Hapus
                    </Button>
                  </div>
                </div>

                {/* List of learns in this collection */}
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
                  <div className="text-center py-14 px-4 bg-secondary/20 rounded-2xl border border-dashed border-border/70">
                    <p className="text-xs text-muted-foreground">
                      Belum ada learn dalam koleksi ini.
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      Tambahkan learn menggunakan menu titik tiga pada kartu learn di halaman utama.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // All Collections view
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-serif text-2xl font-normal text-foreground">
                      Koleksi
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
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
              </>
            )}
          </section>
        )}

        {/* =========================================================
            TAB: ARTIFACT (Research outputs, diagrams, simulations)
            ========================================================= */}
        {activeTab === "artifacts" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="font-serif text-2xl font-normal text-foreground">
                  Artifact
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                  {artifacts.length} artifact
                </span>
              </div>
            </div>

            {artifacts.length > 0 ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                    : "space-y-2"
                }
              >
                {artifacts.map((art) => (
                  <div
                    key={art.id}
                    className="p-5 rounded-2xl border border-border/70 bg-card hover:border-foreground/30 hover:bg-secondary/30 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 rounded-xl bg-secondary/80 flex items-center justify-center text-xl shrink-0">
                        {art.type === "slide" ? "📊" : art.type === "diagram" ? "📐" : "⚡"}
                      </div>
                      <button
                        type="button"
                        onClick={() => localDb.deleteArtifact(art.id)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        title="Hapus artifact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="my-3">
                      <h4 className="text-sm font-medium text-foreground line-clamp-2">
                        {art.title}
                      </h4>
                      <span className="inline-block mt-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {art.type}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground pt-2">
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
              <div className="text-center py-20 px-4">
                <div className="h-12 w-12 rounded-2xl bg-secondary/80 flex items-center justify-center text-2xl mx-auto mb-3">
                  🎨
                </div>
                <h3 className="font-serif text-lg text-foreground font-medium">
                  Belum ada artifact
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                  Artifact seperti slide presentasi HTML, visualisasi diagram D3, dan modul interaktif yang dihasilkan saat Anda belajar dengan agen akan tersimpan otomatis di sini.
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      {/* -------------------------------------------------------------
          MODALS & DIALOGS
          ------------------------------------------------------------- */}
      {/* Create / Edit Learn Dialog */}
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

      {/* Create / Edit Collection Dialog */}
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

      {/* Manage Collections for a Learn Dialog */}
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

      {/* Delete Confirmation Dialog */}
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
