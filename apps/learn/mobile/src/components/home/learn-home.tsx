import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
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
  DropdownMenuLabel,
  cn,
} from "@const/ui";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Type,
  Check,
  Plus,
  ChevronRight,
  ArrowLeft,
  Folder,
  FolderInput,
  FolderMinus,
  FolderPlus,
  CheckSquare,
  Edit3,
  MoreVertical,
  Trash2,
  X,
  BookOpen,
  FileText,
  Menu as MenuIcon,
  Box,
  Cable,
  Settings,
  Clock,
  Rows3,
  ChevronDown,
  Package,
  Presentation,
  SquarePen,
  HelpCircle,
  GitFork,
  AudioLines,
  Video,
  BarChart3,
  Table2,
  Layers,
} from "lucide-react";

import { LearnCard, LearnItem } from "./learn-card";
import { CollectionCard, CollectionItem } from "./collection-card";
import { ModuleIcon, getModuleIconDef, getModuleIconLabel } from "./module-icon";
import { LearnIcon } from "./learn-icon";
import { SourcesView } from "./sources-view";
import { CreateLearnDialog } from "./dialogs/create-learn-dialog";
import { CreateCollectionDialog } from "./dialogs/create-collection-dialog";
import { ManageCollectionDialog } from "./dialogs/manage-collection-dialog";
import { DeleteConfirmDialog } from "./dialogs/delete-confirm-dialog";
import { ImportLearnsDialog } from "./dialogs/import-learns-dialog";
import { BatchAddToModuleDialog } from "./dialogs/batch-add-to-module-dialog";
import { MenuContainer, MenuItem } from "../ui/fluid-menu";
import { ModelSelectionSheet } from "./sheets/model-selection-sheet";
import { McpToolsSheet } from "./sheets/mcp-tools-sheet";
import { MobileSettingsSheet } from "./sheets/mobile-settings-sheet";
import type { UserProfile } from "../navbar";
import { useI18n } from "../../lib/i18n";

type TabKey = "all" | "learns" | "sources" | "collections" | "artifact";
type SortOption = "recent" | "oldest" | "title_asc" | "title_desc";

interface LearnHomeProps {
  onOpenLearn?: (learnId: string, openAddSource?: boolean) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onOpenSettings?: () => void;
  user?: UserProfile | null;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
}

interface ArtifactConfig {
  icon: React.ElementType;
  iconColor: string;
  bgClass: string;
}

function getArtifactConfig(type: string, isZip?: boolean): ArtifactConfig {
  if (isZip) {
    return {
      icon: Package,
      iconColor: "text-orange-600 dark:text-[#fb923c]",
      bgClass: "bg-orange-500/10 border-orange-500/20",
    };
  }

  const normalized = (type || "").toLowerCase().trim();

  switch (normalized) {
    case "slide":
    case "slides":
      return {
        icon: Presentation,
        iconColor: "text-amber-600 dark:text-[#fde047]",
        bgClass: "bg-amber-500/10 border-amber-500/20",
      };
    case "note":
    case "notes":
      return {
        icon: SquarePen,
        iconColor: "text-blue-600 dark:text-[#60a5fa]",
        bgClass: "bg-blue-500/10 border-blue-500/20",
      };
    case "quiz":
      return {
        icon: HelpCircle,
        iconColor: "text-teal-600 dark:text-[#5eead4]",
        bgClass: "bg-teal-500/10 border-teal-500/20",
      };
    case "flashcard":
    case "flashcards":
      return {
        icon: BookOpen,
        iconColor: "text-emerald-600 dark:text-[#86efac]",
        bgClass: "bg-emerald-500/10 border-emerald-500/20",
      };
    case "mind_map":
    case "mindmap":
    case "diagram":
      return {
        icon: GitFork,
        iconColor: "text-pink-600 dark:text-[#f472b6]",
        bgClass: "bg-pink-500/10 border-pink-500/20",
      };
    case "audio_summary":
    case "audio":
      return {
        icon: AudioLines,
        iconColor: "text-indigo-600 dark:text-[#a5b4fc]",
        bgClass: "bg-indigo-500/10 border-indigo-500/20",
      };
    case "video_summary":
    case "video":
      return {
        icon: Video,
        iconColor: "text-emerald-600 dark:text-[#86efac]",
        bgClass: "bg-emerald-500/10 border-emerald-500/20",
      };
    case "report":
      return {
        icon: FileText,
        iconColor: "text-stone-600 dark:text-[#dedac2]",
        bgClass: "bg-stone-500/10 border-stone-500/20",
      };
    case "infographic":
      return {
        icon: BarChart3,
        iconColor: "text-purple-600 dark:text-[#c084fc]",
        bgClass: "bg-purple-500/10 border-purple-500/20",
      };
    case "data_table":
    case "table":
      return {
        icon: Table2,
        iconColor: "text-sky-600 dark:text-[#38bdf8]",
        bgClass: "bg-sky-500/10 border-sky-500/20",
      };
    default:
      return {
        icon: Layers,
        iconColor: "text-muted-foreground",
        bgClass: "bg-secondary border-border",
      };
  }
}

export function LearnHome({
  onOpenLearn,
  searchQuery: propSearchQuery,
  onSearchQueryChange,
  onOpenSettings,
  user,
  onSignOut,
  onSwitchAccount,
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
  const [artifactCategory, setArtifactCategory] = useState<string>("all");

  // Folder Sorting States
  type FolderSortBy = "createdAt" | "name" | "lastOpened";
  type FolderSortDirection = "asc" | "desc";

  const [folderSortBy, setFolderSortBy] = useState<FolderSortBy>(() => {
    try {
      const saved = localStorage.getItem("const_learn_folder_sort_by");
      if (saved === "createdAt" || saved === "name" || saved === "lastOpened") {
        return saved;
      }
    } catch {}
    return "createdAt";
  });

  const [folderSortDirection, setFolderSortDirection] = useState<FolderSortDirection>(() => {
    try {
      const saved = localStorage.getItem("const_learn_folder_sort_direction");
      if (saved === "asc" || saved === "desc") {
        return saved;
      }
    } catch {}
    return "desc";
  });

  const [folderGroupByIcon, setFolderGroupByIcon] = useState<boolean>(() => {
    try {
      return localStorage.getItem("const_learn_folder_group_icon") === "1";
    } catch {}
    return false;
  });

  const [collapsedIconGroups, setCollapsedIconGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem("const_learn_folder_sort_by", folderSortBy);
    } catch {}
  }, [folderSortBy]);

  useEffect(() => {
    try {
      localStorage.setItem("const_learn_folder_sort_direction", folderSortDirection);
    } catch {}
  }, [folderSortDirection]);

  useEffect(() => {
    try {
      localStorage.setItem("const_learn_folder_group_icon", folderGroupByIcon ? "1" : "0");
    } catch {}
  }, [folderGroupByIcon]);

  const getSortLabel = (sort: FolderSortBy) => {
    switch (sort) {
      case "createdAt": return t("sortCreatedAt");
      case "name": return t("sortName");
      case "lastOpened": return t("sortLastOpened");
    }
  };

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
  const [targetCollectionIdForNewLearn, setTargetCollectionIdForNewLearn] = useState<string | null>(null);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [managingLearn, setManagingLearn] = useState<LearnItem | null>(null);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [isFluidMenuExpanded, setIsFluidMenuExpanded] = useState(false);
  const [isModelSheetOpen, setIsModelSheetOpen] = useState(false);
  const [isMcpSheetOpen, setIsMcpSheetOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);

  const handleCreateNewLearn = async (collectionId?: string) => {
    const targetColId = collectionId || activeCollectionId || undefined;
    if (onOpenLearn) {
      const id = await localDb.createLearn({
        title: t("untitledNotebook"),
        emoji: "📘",
        collectionId: targetColId,
      });
      onOpenLearn(id, true);
    } else {
      setEditingLearn(null);
      setTargetCollectionIdForNewLearn(targetColId || null);
      setIsCreateLearnOpen(true);
    }
  };

  const handleImportLearns = async (learnIds: string[]) => {
    if (!activeCollectionId) return;
    await localDb.addLearnsToCollection(activeCollectionId, learnIds);
  };

  const handleRemoveFromCollection = async (learnId: string) => {
    if (!activeCollectionId) return;
    await localDb.removeLearnFromCollection(activeCollectionId, learnId);
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
    type: "learn" | "collection" | "batch";
    id?: string;
    title: string;
    description: string;
  } | null>(null);

  // Multi-Select States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLearnIds, setSelectedLearnIds] = useState<Set<string>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [isBatchAddToModuleOpen, setIsBatchAddToModuleOpen] = useState(false);

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

  const rawAllLearns = useLiveQuery(async () => {
    return await db.learns.toArray();
  });
  const allLearns = useMemo(() => rawAllLearns ?? [], [rawAllLearns]);

  // Lookup map of learnId -> LocalLearn (for parent learn info in cards)
  const learnsMap = useMemo(() => {
    const map = new Map<string, LocalLearn>();
    for (const l of allLearns) {
      map.set(l.id, l);
    }
    return map;
  }, [allLearns]);

  // Category counts and definitions for Artifacts tab
  const artifactCategories = useMemo(() => {
    type ArtifactCategoryKey =
      | "all"
      | "slide"
      | "note"
      | "diagram"
      | "quiz"
      | "flashcard"
      | "media"
      | "report"
      | "table";

    const counts: Record<ArtifactCategoryKey, number> = {
      all: artifacts.length,
      slide: 0,
      note: 0,
      diagram: 0,
      quiz: 0,
      flashcard: 0,
      media: 0,
      report: 0,
      table: 0,
    };

    for (const art of artifacts) {
      const type = (art.type || "").toLowerCase().trim();
      if (type === "slide" || type === "slides") counts.slide++;
      else if (type === "note" || type === "notes") counts.note++;
      else if (type === "diagram" || type === "mind_map" || type === "mindmap") counts.diagram++;
      else if (type === "quiz") counts.quiz++;
      else if (type === "flashcard" || type === "flashcards") counts.flashcard++;
      else if (type === "audio" || type === "audio_summary" || type === "video" || type === "video_summary") counts.media++;
      else if (type === "report" || type === "infographic") counts.report++;
      else if (type === "table" || type === "data_table") counts.table++;
    }

    const allCategories: Array<{
      id: string;
      label: string;
      icon: React.ElementType;
      count: number;
    }> = [
      { id: "all", label: language === "id" ? "Semua" : "All", icon: Layers, count: counts.all },
      { id: "slide", label: "Slides", icon: Presentation, count: counts.slide },
      { id: "note", label: language === "id" ? "Catatan" : "Notes", icon: SquarePen, count: counts.note },
      { id: "diagram", label: "Diagram & Mind Map", icon: GitFork, count: counts.diagram },
      { id: "quiz", label: "Quiz", icon: HelpCircle, count: counts.quiz },
      { id: "flashcard", label: "Flashcards", icon: BookOpen, count: counts.flashcard },
      { id: "media", label: language === "id" ? "Audio & Video" : "Audio & Video", icon: Video, count: counts.media },
      { id: "report", label: language === "id" ? "Laporan" : "Reports", icon: FileText, count: counts.report },
      { id: "table", label: language === "id" ? "Tabel" : "Tables", icon: Table2, count: counts.table },
    ];

    return allCategories.filter((c) => c.id === "all" || c.count > 0);
  }, [artifacts, language]);

  // Filtered artifacts by category and search query
  const filteredArtifacts = useMemo(() => {
    let list = artifacts;

    if (artifactCategory !== "all") {
      list = list.filter((art) => {
        const type = (art.type || "").toLowerCase().trim();
        if (artifactCategory === "slide") return type === "slide" || type === "slides";
        if (artifactCategory === "note") return type === "note" || type === "notes";
        if (artifactCategory === "diagram") return type === "diagram" || type === "mind_map" || type === "mindmap";
        if (artifactCategory === "quiz") return type === "quiz";
        if (artifactCategory === "flashcard") return type === "flashcard" || type === "flashcards";
        if (artifactCategory === "media") return type === "audio" || type === "audio_summary" || type === "video" || type === "video_summary";
        if (artifactCategory === "report") return type === "report" || type === "infographic";
        if (artifactCategory === "table") return type === "table" || type === "data_table";
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((art) => {
        const titleMatch = art.title.toLowerCase().includes(q);
        const typeMatch = (art.type || "").toLowerCase().includes(q);
        const parent = art.learnId ? learnsMap.get(art.learnId) : null;
        const parentMatch = parent ? parent.title.toLowerCase().includes(q) : false;
        return titleMatch || typeMatch || parentMatch;
      });
    }

    return list;
  }, [artifacts, artifactCategory, searchQuery, learnsMap]);

  // Filtered and sorted collections based on search and sort preferences
  const filteredCollections = useMemo(() => {
    let list = collectionsData ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      let result = 0;
      if (folderSortBy === "createdAt") {
        const aTime = a.createdAt || a.updatedAt || 0;
        const bTime = b.createdAt || b.updatedAt || 0;
        result = aTime - bTime;
      } else if (folderSortBy === "name") {
        result = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      } else if (folderSortBy === "lastOpened") {
        const aTime = a.lastOpenedAt || a.updatedAt || a.createdAt || 0;
        const bTime = b.lastOpenedAt || b.updatedAt || b.createdAt || 0;
        result = aTime - bTime;
      }

      return folderSortDirection === "asc" ? result : -result;
    });
  }, [collectionsData, searchQuery, folderSortBy, folderSortDirection]);

  // Grouped collections by icon (for groupByIcon mode)
  const groupedCollections = useMemo(() => {
    const groupMap = new Map<string, { iconId: string; label: string; items: CollectionItem[] }>();
    for (const col of filteredCollections) {
      const iconId = col.emoji || "folder";
      if (!groupMap.has(iconId)) {
        const label = getModuleIconLabel(iconId, language);
        groupMap.set(iconId, { iconId, label, items: [] });
      }
      groupMap.get(iconId)!.items.push(col);
    }
    return Array.from(groupMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredCollections, language]);

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
    let list = learns.filter((l) => l.collectionIds && l.collectionIds.includes(activeCollectionId));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [learns, activeCollectionId, searchQuery]);

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
      const colId = data.collectionId || targetCollectionIdForNewLearn || (activeCollectionId ?? undefined);
      await localDb.createLearn({
        title: data.title,
        description: data.description,
        emoji: data.emoji,
        collectionId: colId,
      });
      setTargetCollectionIdForNewLearn(null);
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
      const newId = await localDb.createCollection({
        name: data.name,
        description: data.description,
        emoji: data.emoji,
      });
      if (newId) {
        if (selectedLearnIds.size > 0) {
          await localDb.addLearnsToCollection(newId, Array.from(selectedLearnIds));
          setSelectedLearnIds(new Set());
          setIsSelectionMode(false);
        }
        setActiveCollectionId(newId);
        setActiveTab("collections");
      }
    }
  };

  // Handle Delete Confirmation
  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "learn") {
      if (deleteTarget.id) {
        await localDb.deleteLearn(deleteTarget.id);
      }
    } else if (deleteTarget.type === "collection") {
      if (deleteTarget.id) {
        await localDb.deleteCollection(deleteTarget.id);
        if (activeCollectionId === deleteTarget.id) {
          setActiveCollectionId(null);
        }
      }
    } else if (deleteTarget.type === "batch") {
      if (selectedLearnIds.size > 0) {
        await localDb.batchDeleteLearns(Array.from(selectedLearnIds));
        setSelectedLearnIds(new Set());
      }
      if (selectedCollectionIds.size > 0) {
        await localDb.batchDeleteCollections(Array.from(selectedCollectionIds));
        setSelectedCollectionIds(new Set());
      }
      setIsSelectionMode(false);
    }
  };

  // Multi-Select Action Handlers
  const toggleLearnSelection = (id: string) => {
    setSelectedLearnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleCollectionSelection = (id: string) => {
    setSelectedCollectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (activeTab === "all") {
      const isAllSelected =
        selectedLearnIds.size === learns.length &&
        selectedCollectionIds.size === filteredCollections.length &&
        (learns.length > 0 || filteredCollections.length > 0);

      if (isAllSelected) {
        setSelectedLearnIds(new Set());
        setSelectedCollectionIds(new Set());
      } else {
        setSelectedLearnIds(new Set(learns.map((l) => l.id)));
        setSelectedCollectionIds(new Set(filteredCollections.map((c) => c.id)));
      }
    } else if (activeTab === "learns") {
      if (selectedLearnIds.size === learns.length && learns.length > 0) {
        setSelectedLearnIds(new Set());
      } else {
        setSelectedLearnIds(new Set(learns.map((l) => l.id)));
      }
    } else if (activeTab === "collections") {
      if (activeCollection) {
        if (selectedLearnIds.size === collectionLearns.length && collectionLearns.length > 0) {
          setSelectedLearnIds(new Set());
        } else {
          setSelectedLearnIds(new Set(collectionLearns.map((l) => l.id)));
        }
      } else {
        if (selectedCollectionIds.size === filteredCollections.length && filteredCollections.length > 0) {
          setSelectedCollectionIds(new Set());
        } else {
          setSelectedCollectionIds(new Set(filteredCollections.map((c) => c.id)));
        }
      }
    }
  };

  const handleExitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedLearnIds(new Set());
    setSelectedCollectionIds(new Set());
  };

  const handleBatchAddToModule = async (targetModuleId: string) => {
    if (selectedLearnIds.size === 0) return;
    await localDb.addLearnsToCollection(targetModuleId, Array.from(selectedLearnIds));
    setSelectedLearnIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBatchRemoveFromActiveCollection = async () => {
    if (!activeCollectionId || selectedLearnIds.size === 0) return;
    for (const learnId of selectedLearnIds) {
      await localDb.removeLearnFromCollection(activeCollectionId, learnId);
    }
    setSelectedLearnIds(new Set());
  };

  const totalSelectedCount =
    activeTab === "collections" && !activeCollection
      ? selectedCollectionIds.size
      : activeTab === "all"
      ? selectedLearnIds.size + selectedCollectionIds.size
      : selectedLearnIds.size;

  const handleBatchDeleteClick = () => {
    if (totalSelectedCount === 0) return;
    setDeleteTarget({
      type: "batch",
      title: language === "id" ? `Hapus ${totalSelectedCount} item?` : `Delete ${totalSelectedCount} items?`,
      description: t("batchDeleteConfirm", { count: totalSelectedCount }),
    });
  };

  // Reset multi-select when switching tabs or collection
  useEffect(() => {
    setSelectedLearnIds(new Set());
    setSelectedCollectionIds(new Set());
    setIsSelectionMode(false);
  }, [activeTab, activeCollectionId]);

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
          className="relative inline-flex items-center p-1 rounded-full bg-secondary/80 border border-border/80 overflow-x-auto no-scrollbar max-w-full"
        >
          {/* Animated Sliding Pill Indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-full bg-background border border-border/60 shadow-2xs transition-all duration-300 pointer-events-none"
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
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground active:scale-95"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* -------------------------------------------------------------
          MAIN CONTENT AREA (Mobile)
          ------------------------------------------------------------- */}
      <main className="flex-1 w-full px-4 py-3 space-y-4 pb-28">
        {/* Search & Sort on One Single Line (No List) */}
        <div className="flex items-center gap-2 w-full">
          {/* Search Input */}
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
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
              className="h-10 w-full pl-10 pr-9 text-xs sm:text-sm rounded-xl bg-card border border-border/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
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
                className="h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary bg-card border border-border/80 active:scale-95 transition-all duration-200 cursor-pointer shrink-0 shadow-2xs"
                title={t("sort")}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>{sortLabels[sortOption]}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 p-1 border-border bg-popover text-popover-foreground shadow-md">
              {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSortOption(key)}
                  className="cursor-pointer text-xs py-1.5 px-2 text-foreground hover:bg-secondary rounded-lg"
                >
                  {sortLabels[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Multi-Select Toggle Button */}
          <button
            type="button"
            onClick={() => {
              if (isSelectionMode) {
                handleExitSelectionMode();
              } else {
                setIsSelectionMode(true);
              }
            }}
            className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs border active:scale-95 transition-all duration-200 cursor-pointer shrink-0 shadow-2xs ${
              isSelectionMode
                ? "bg-primary/15 border-primary/40 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary bg-card border-border/80"
            }`}
            title={isSelectionMode ? t("cancelSelect") : t("select")}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isSelectionMode ? t("cancelSelect") : t("select")}</span>
          </button>
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
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground font-sans">
                    {learns.length}
                  </span>
                </div>

                {learns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("learns")}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors cursor-pointer"
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
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedLearnIds.has(learn.id)}
                      onSelect={toggleLearnSelection}
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
                  <div className="text-center py-6 px-4 bg-card rounded-2xl border border-dashed border-border/80 shadow-2xs">
                    <p className="text-xs text-muted-foreground">{t("noLearnsFound")}</p>
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
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground font-sans">
                    {filteredCollections.length}
                  </span>
                </div>

                {filteredCollections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("collections")}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <span>{t("viewAll")}</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {filteredCollections.length > 0 ? (
                  filteredCollections.map((col) => (
                    <CollectionCard
                      key={col.id}
                      collection={col}
                      viewMode={viewMode}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedCollectionIds.has(col.id)}
                      onSelect={toggleCollectionSelection}
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
                  <div className="text-center py-6 px-4 bg-card rounded-2xl border border-dashed border-border/80 shadow-2xs">
                    <p className="text-xs text-muted-foreground">{t("noCollectionsYet")}</p>
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground font-sans">
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
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedLearnIds.has(learn.id)}
                    onSelect={toggleLearnSelection}
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
                <div className="text-center py-12 px-4 bg-card rounded-2xl border border-dashed border-border/80 shadow-2xs">
                  <div className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-lg mx-auto mb-2 text-muted-foreground">
                    📘
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    {t("noLearnsFound")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
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
              // Drilled-down collection (Mobile Page Collection)
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-card border border-border/70 space-y-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCollectionId(null);
                          setSearchQuery("");
                        }}
                        className="h-8 w-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary cursor-pointer transition-colors shrink-0"
                        title={t("backToAllCollections")}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <div className="h-9 w-9 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-foreground shadow-2xs shrink-0">
                        <ModuleIcon icon={activeCollection.emoji} className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-sans text-sm font-semibold text-foreground truncate leading-tight">
                          {activeCollection.name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                          <span>
                            {collectionLearns.length}{" "}
                            {language === "id" ? "materi" : "notebooks"}
                          </span>
                          {activeCollection.description && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[120px]">
                                {activeCollection.description}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Collection Options Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-7 w-7 rounded-lg border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary cursor-pointer transition-colors shrink-0"
                          title={t("moreOptions")}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 p-1.5 shadow-md">
                        <DropdownMenuItem
                          className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                          onClick={() => {
                            setEditingCollection(activeCollection);
                            setIsCreateCollectionOpen(true);
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{t("editCollection")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-destructive focus:text-destructive"
                          onClick={() =>
                            setDeleteTarget({
                              type: "collection",
                              id: activeCollection.id,
                              title: t("deleteCollectionTitle", { name: activeCollection.name }),
                              description: t("deleteCollectionConfirm"),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{t("delete")}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <Button
                      size="sm"
                      onClick={() => handleCreateNewLearn(activeCollection.id)}
                      className="h-7 px-3 rounded-full text-xs font-medium gap-1 bg-primary text-primary-foreground flex-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>{t("newLearn")}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsImportDialogOpen(true)}
                      className="h-7 px-3 rounded-full text-xs font-medium gap-1 border-border/80 flex-1 cursor-pointer"
                    >
                      <FolderInput className="h-3.5 w-3.5 text-primary" />
                      <span>{language === "id" ? "Import Materi" : "Import"}</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {collectionLearns.length > 0 ? (
                    collectionLearns.map((learn) => (
                      <LearnCard
                        key={learn.id}
                        learn={learn}
                        viewMode={viewMode}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedLearnIds.has(learn.id)}
                        onSelect={toggleLearnSelection}
                        onClick={() => onOpenLearn?.(learn.id, false)}
                        onEdit={(l) => {
                          setEditingLearn(l);
                          setIsCreateLearnOpen(true);
                        }}
                        onManageCollections={(l) => setManagingLearn(l)}
                        onRemoveFromCollection={() => handleRemoveFromCollection(learn.id)}
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
                    <div className="text-center py-10 px-4 bg-card rounded-2xl border border-dashed border-border/80 shadow-2xs flex flex-col items-center">
                      <div className="h-10 w-10 rounded-xl bg-secondary border border-border/60 flex items-center justify-center mb-2">
                        <Folder className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-foreground mb-0.5">
                        {language === "id" ? "Folder ini masih kosong" : "This folder is empty"}
                      </p>
                      <p className="text-[11px] text-muted-foreground max-w-xs mb-3">
                        {language === "id"
                          ? "Mulai tambahkan materi belajar ke dalam folder ini."
                          : "Start organizing notebooks inside this folder."}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleCreateNewLearn(activeCollection.id)}
                          className="h-7 px-3 rounded-full text-xs font-medium cursor-pointer"
                        >
                          <Plus className="h-3 w-3 mr-1 stroke-[2.5]" />
                          <span>{t("newLearn")}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsImportDialogOpen(true)}
                          className="h-7 px-3 rounded-full text-xs font-medium border-border cursor-pointer"
                        >
                          <FolderInput className="h-3 w-3 mr-1 text-primary" />
                          <span>{language === "id" ? "Import" : "Import"}</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // All Collections
              <>
                <div className="flex items-start justify-between px-0.5 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-serif text-lg font-normal tracking-tight text-foreground">
                        {t("collections")}
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground font-sans">
                        {filteredCollections.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t("modulesSubtitle")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Sort Button */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-7 w-7 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground border border-border/80 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                          title={t("sortBy")}
                        >
                          {folderSortDirection === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-md mr-1">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 py-1 font-medium">
                          {t("sortBy")}
                        </DropdownMenuLabel>
                        {(["createdAt", "name", "lastOpened"] as const).map((option) => {
                          const iconMap = {
                            createdAt: Calendar,
                            name: Type,
                            lastOpened: Clock,
                          } as const;
                          const Icon = iconMap[option];
                          return (
                            <DropdownMenuItem
                              key={option}
                              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                              onClick={() => setFolderSortBy(option)}
                            >
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{getSortLabel(option)}</span>
                              {folderSortBy === option && <Check className="h-3 w-3 ml-auto text-primary" />}
                            </DropdownMenuItem>
                          );
                        })}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 py-1 font-medium">
                          {t("sortOrder")}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                          onClick={() => setFolderSortDirection("asc")}
                        >
                          <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{t("sortAsc")}</span>
                          {folderSortDirection === "asc" && <Check className="h-3 w-3 ml-auto text-primary" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2"
                          onClick={() => setFolderSortDirection("desc")}
                        >
                          <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{t("sortDesc")}</span>
                          {folderSortDirection === "desc" && <Check className="h-3 w-3 ml-auto text-primary" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Group by Icon Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setFolderGroupByIcon((v) => !v);
                        setCollapsedIconGroups(new Set());
                      }}
                      className={`h-7 w-7 rounded-full border flex items-center justify-center transition-colors cursor-pointer shadow-2xs ${
                        folderGroupByIcon
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-secondary hover:bg-secondary/80 text-muted-foreground border-border/80"
                      }`}
                      title={language === "id" ? "Kelompokkan berdasarkan ikon" : "Group by icon"}
                    >
                      <Rows3 className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingCollection(null);
                        setIsCreateCollectionOpen(true);
                      }}
                      className="h-7 px-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium border border-border/80 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus className="h-3 w-3" />
                      <span>{t("newCollection")}</span>
                    </button>
                  </div>
                </div>

                {/* Grouped by icon accordion view */}
                {folderGroupByIcon ? (
                  <div className="space-y-1.5">
                    {groupedCollections.length === 0 && (
                      <div className="text-center py-12 px-4 bg-card rounded-2xl border border-dashed border-border/80 shadow-2xs">
                        <p className="text-xs text-muted-foreground">{t("noCollectionsYet")}</p>
                      </div>
                    )}
                    {groupedCollections.map((group) => {
                      const isCollapsed = collapsedIconGroups.has(group.iconId);
                      const IconComp = getModuleIconDef(group.iconId).icon;
                      const toggleGroup = () =>
                        setCollapsedIconGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.iconId)) next.delete(group.iconId);
                          else next.add(group.iconId);
                          return next;
                        });

                      return (
                        <div key={group.iconId} className="rounded-xl border border-border/60 overflow-hidden">
                          {/* Group header */}
                          <button
                            type="button"
                            onClick={toggleGroup}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-muted/40 active:bg-muted/80 transition-colors text-left cursor-pointer"
                          >
                            <IconComp className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium text-foreground flex-1">
                              {group.label}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono mr-1">
                              {group.items.length}
                            </span>
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </button>

                          {/* Group body */}
                          {!isCollapsed && (
                            <div className="divide-y divide-border/40">
                              {group.items.map((col) => (
                                <CollectionCard
                                  key={col.id}
                                  collection={col}
                                  viewMode={viewMode}
                                  isSelectionMode={isSelectionMode}
                                  isSelected={selectedCollectionIds.has(col.id)}
                                  onSelect={toggleCollectionSelection}
                                  onClick={(c) => {
                                    localDb.markCollectionOpened(c.id).catch(() => {});
                                    setActiveCollectionId(c.id);
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
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Flat list view (default) */
                  <div className="space-y-2">
                    {filteredCollections.length > 0 ? (
                      filteredCollections.map((col) => (
                        <CollectionCard
                          key={col.id}
                          collection={col}
                          viewMode={viewMode}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedCollectionIds.has(col.id)}
                          onSelect={toggleCollectionSelection}
                          onClick={(c) => {
                            localDb.markCollectionOpened(c.id).catch(() => {});
                            setActiveCollectionId(c.id);
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
                      <div className="text-center py-12 px-4 bg-card rounded-2xl border border-dashed border-border/80 shadow-2xs">
                        <p className="text-xs text-muted-foreground">{t("noCollectionsYet")}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCollection(null);
                            setIsCreateCollectionOpen(true);
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium border border-border/80 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>{t("createCardCollection")}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* =========================================================
            TAB 5: ARTIFACTS
            ========================================================= */}
        {activeTab === "artifact" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="flex items-center gap-2">
                <h2 className="font-sans text-sm font-semibold tracking-tight text-foreground">
                  {t("artifacts")}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground font-mono">
                  {filteredArtifacts.length}
                </span>
              </div>

              {/* Category Dropdown Menu */}
              {(() => {
                const activeCat = artifactCategories.find((c) => c.id === artifactCategory) || artifactCategories[0];
                const ActiveCatIcon = activeCat?.icon || Layers;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 rounded-lg text-xs font-medium gap-1.5 border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <ActiveCatIcon className="w-3 h-3 text-muted-foreground" />
                        <span>{activeCat?.label}</span>
                        <span className="text-[10px] opacity-70 font-mono">({activeCat?.count})</span>
                        <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-md">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 py-1 font-medium">
                        {language === "id" ? "Kategori Artefak" : "Artifact Categories"}
                      </DropdownMenuLabel>
                      {artifactCategories.map((cat) => {
                        const CatIcon = cat.icon;
                        const isSelected = artifactCategory === cat.id;
                        return (
                          <DropdownMenuItem
                            key={cat.id}
                            className="cursor-pointer text-xs py-2 px-2 flex items-center gap-2"
                            onClick={() => setArtifactCategory(cat.id)}
                          >
                            <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="flex-1">{cat.label}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">({cat.count})</span>
                            {isSelected && <Check className="h-3.5 w-3.5 ml-1 text-primary" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })()}
            </div>

            {filteredArtifacts.length > 0 ? (
              <div className="space-y-2">
                {filteredArtifacts.map((art) => {
                  const config = getArtifactConfig(art.type, art.isZip);
                  const Icon = config.icon;
                  const parentLearn = art.learnId ? learnsMap.get(art.learnId) : undefined;

                  return (
                    <div
                      key={art.id}
                      onClick={() => {
                        if (art.learnId && onOpenLearn) {
                          onOpenLearn(art.learnId);
                        }
                      }}
                      className={cn(
                        "p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-secondary/60 active:scale-[0.99] transition-all duration-200 flex flex-col justify-between select-none shadow-2xs",
                        art.learnId && onOpenLearn && "cursor-pointer group"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform",
                            config.bgClass
                          )}
                        >
                          <Icon className={cn("h-4 w-4", config.iconColor)} />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            localDb.deleteArtifact(art.id);
                          }}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive active:text-destructive cursor-pointer transition-colors"
                          title={t("deleteArtifact")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5 my-2">
                        <h4
                          className="text-xs font-medium text-foreground truncate leading-snug group-hover:text-primary transition-colors"
                          title={art.title}
                        >
                          {art.title}
                        </h4>
                        {parentLearn && (
                          <div className="flex items-center">
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary/80 border border-border/60 text-muted-foreground max-w-full truncate"
                              title={parentLearn.title}
                            >
                              <LearnIcon icon={parentLearn.emoji} className="w-3 h-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{parentLearn.title}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/40 flex items-center justify-between font-mono">
                        <span>
                          {new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(art.updatedAt))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-14 px-4 border border-dashed border-border/80 rounded-2xl bg-card">
                <div className="h-10 w-10 rounded-xl bg-secondary border border-border/60 flex items-center justify-center text-muted-foreground mx-auto mb-2">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-sans text-sm text-foreground font-semibold">
                  {searchQuery || artifactCategory !== "all"
                    ? language === "id"
                      ? "Tidak ada artefak yang cocok"
                      : "No matching artifacts"
                    : t("noArtifactsTitle")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xs mx-auto">
                  {searchQuery || artifactCategory !== "all"
                    ? language === "id"
                      ? "Coba ubah kata kunci pencarian atau kategori filter."
                      : "Try adjusting your search query or category filter."
                    : t("noArtifactsDesc")}
                </p>
              </div>
            )}
          </section>
        )}
        </div>
      </main>

      {/* -------------------------------------------------------------
          FLOATING MULTI-SELECT ACTION BAR (HUD) (Mobile)
          ------------------------------------------------------------- */}
      {isSelectionMode && (
        <div className="fixed bottom-5 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto safe-area-bottom">
          <div className="flex items-center justify-between sm:justify-start gap-1 px-3 py-2 rounded-2xl bg-[#1c1c1c] text-foreground border border-border/80 shadow-2xl backdrop-blur-md max-w-md mx-auto">
            {/* Selected Counter */}
            <div className="px-2 py-1 text-xs font-medium font-sans text-muted-foreground whitespace-nowrap">
              {t("itemsSelected", { count: totalSelectedCount })}
            </div>

            <div className="h-4 w-px bg-border/80 shrink-0" />

            {/* Select All / Deselect All */}
            <button
              type="button"
              onClick={handleSelectAll}
              className="h-8 px-2 rounded-xl text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground active:bg-secondary/80 transition-colors cursor-pointer"
            >
              <CheckSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px]">
                {(activeTab === "collections" && !activeCollection
                  ? selectedCollectionIds.size === filteredCollections.length && filteredCollections.length > 0
                  : activeTab === "collections" && activeCollection
                  ? selectedLearnIds.size === collectionLearns.length && collectionLearns.length > 0
                  : activeTab === "all"
                  ? selectedLearnIds.size === learns.length && selectedCollectionIds.size === filteredCollections.length && (learns.length > 0 || filteredCollections.length > 0)
                  : selectedLearnIds.size === learns.length && learns.length > 0)
                  ? t("deselectAll")
                  : t("selectAll")}
              </span>
            </button>

            {/* Add to Module (only when learns are selected) */}
            {selectedLearnIds.size > 0 && (
              <button
                type="button"
                onClick={() => setIsBatchAddToModuleOpen(true)}
                className="h-8 px-2 rounded-xl text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground active:bg-secondary/80 transition-colors cursor-pointer"
              >
                <FolderPlus className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[11px]">{t("addToModule")}</span>
              </button>
            )}

            {/* Remove from current Module (when inside drilled-down module and learns selected) */}
            {activeCollection && selectedLearnIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchRemoveFromActiveCollection}
                className="h-8 px-2 rounded-xl text-xs flex items-center gap-1 text-amber-500 hover:text-amber-400 active:bg-amber-500/10 transition-colors cursor-pointer"
              >
                <FolderMinus className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px]">{t("removeFromModule")}</span>
              </button>
            )}

            {/* Batch Delete */}
            {totalSelectedCount > 0 && (
              <button
                type="button"
                onClick={handleBatchDeleteClick}
                className="h-8 px-2 rounded-xl text-xs flex items-center gap-1 text-rose-500 hover:text-rose-400 active:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px]">
                  {t("batchDelete")} ({totalSelectedCount})
                </span>
              </button>
            )}

            <div className="h-4 w-px bg-border/80 shrink-0" />

            {/* Cancel / Close Selection Mode */}
            <button
              type="button"
              onClick={handleExitSelectionMode}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary/80 transition-colors cursor-pointer shrink-0"
              title={t("cancelSelect")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          FLOATING ACTION CONTAINER: (+ New Learn / + New Sources) + FLUID MENU
          ------------------------------------------------------------- */}
      {!isSelectionMode && (
        <div className="fixed bottom-6 right-5 z-40 safe-area-bottom flex items-center gap-2.5">
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

          {/* Fluid circular menu for Models, MCP Tools, and Settings */}
          <MenuContainer
            direction="up"
            size={48}
            spacing={56}
            isExpanded={isFluidMenuExpanded}
            onExpandedChange={setIsFluidMenuExpanded}
          >
            {/* Trigger item (morphs MenuIcon <-> X) */}
            <MenuItem
              label="Menu Cepat"
              icon={
                <div className="relative w-5 h-5 flex items-center justify-center text-white">
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out origin-center text-white",
                      isFluidMenuExpanded ? "opacity-0 scale-0 rotate-180" : "opacity-100 scale-100 rotate-0"
                    )}
                  >
                    <MenuIcon size={20} strokeWidth={2} className="text-white" />
                  </div>
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out origin-center text-white",
                      isFluidMenuExpanded ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-0 -rotate-180"
                    )}
                  >
                    <X size={20} strokeWidth={2} className="text-white" />
                  </div>
                </div>
              }
            />

            {/* Child 1: Model AI */}
            <MenuItem
              label="Model AI"
              icon={<Box size={20} strokeWidth={1.8} className="text-white" />}
              onClick={() => {
                setIsFluidMenuExpanded(false);
                setIsModelSheetOpen(true);
              }}
            />

            {/* Child 2: MCP Tools */}
            <MenuItem
              label="MCP Tools"
              icon={<Cable size={20} strokeWidth={1.8} className="text-white" />}
              onClick={() => {
                setIsFluidMenuExpanded(false);
                setIsMcpSheetOpen(true);
              }}
            />

            {/* Child 3: Pengaturan */}
            <MenuItem
              label={t("settings")}
              icon={<Settings size={20} strokeWidth={1.8} className="text-white" />}
              onClick={() => {
                setIsFluidMenuExpanded(false);
                setIsSettingsSheetOpen(true);
              }}
            />
          </MenuContainer>
        </div>
      )}

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
            : targetCollectionIdForNewLearn
            ? {
                id: "",
                title: "",
                collectionIds: [targetCollectionIdForNewLearn],
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

      {activeCollection && (
        <ImportLearnsDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          collection={activeCollection}
          allLearns={learns}
          onImport={handleImportLearns}
        />
      )}

      {/* Batch Add to Module Dialog */}
      <BatchAddToModuleDialog
        open={isBatchAddToModuleOpen}
        onOpenChange={setIsBatchAddToModuleOpen}
        selectedCount={selectedLearnIds.size}
        collections={collections}
        onAddToModule={handleBatchAddToModule}
        onCreateNewModule={() => {
          setEditingCollection(null);
          setIsCreateCollectionOpen(true);
        }}
      />

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

      {/* Fluid Menu Bottom Sheets */}
      <ModelSelectionSheet
        open={isModelSheetOpen}
        onClose={() => setIsModelSheetOpen(false)}
      />

      <McpToolsSheet
        open={isMcpSheetOpen}
        onClose={() => setIsMcpSheetOpen(false)}
      />

      <MobileSettingsSheet
        open={isSettingsSheetOpen}
        onClose={() => setIsSettingsSheetOpen(false)}
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
      />
    </div>
  );
}
