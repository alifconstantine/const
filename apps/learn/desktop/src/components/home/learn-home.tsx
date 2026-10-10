import React, { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, LocalLearn, LocalCollection, LocalArtifact } from "../../lib/db";
import {
  Button,
  Input,
  ScrollArea,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  cn,
  toast,
} from "@const/ui";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  PanelLeft,
  ArrowLeft,
  Trash2,
  X,
  FolderInput,
  FolderMinus,
  FolderPlus,
  CheckSquare,
  Edit3,
  MoreVertical,
  Clock,
  Layers,
  Presentation,
  SquarePen,
  HelpCircle,
  BookOpen,
  GitFork,
  AudioLines,
  Video,
  FileText,
  BarChart3,
  Table2,
  Package,
  ArrowUp,
  ArrowDown,
  Calendar,
  Type,
  Check,
  ChevronDown,
} from "lucide-react";

import { LearnCard, LearnItem } from "./learn-card";
import { CollectionCard, CollectionItem } from "./collection-card";
import { ModuleIcon, getModuleIconDef, getModuleIconLabel } from "./module-icon";
import { LearnIcon } from "./learn-icon";
import { CreateCard } from "./create-card";
import { RecentlyViewedCard } from "./recently-viewed-card";
import { Sidebar, HomeNavTab } from "./sidebar";
import { DesktopUpdateBadge } from "./desktop-update-badge";
import { SourcesView } from "./sources-view";
import { ModelsView } from "./views/models-view";
import { McpToolsView } from "./views/mcp-tools-view";
import { CreateLearnDialog } from "./dialogs/create-learn-dialog";
import { CreateCollectionDialog } from "./dialogs/create-collection-dialog";
import { ManageCollectionDialog } from "./dialogs/manage-collection-dialog";
import { DeleteConfirmDialog } from "./dialogs/delete-confirm-dialog";
import { ImportLearnsDialog } from "./dialogs/import-learns-dialog";
import { BatchAddToModuleDialog } from "./dialogs/batch-add-to-module-dialog";
import { useI18n } from "../../lib/i18n";
import type { UserProfile } from "../navbar";

interface LearnHomeProps {
  onOpenLearn?: (learnId: string, openAddSource?: boolean) => void;
  onOpenSettings?: (tab?: string) => void;
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
  onOpenSettings,
  user,
  onSignOut,
  onSwitchAccount,
}: LearnHomeProps) {
  const { t, language } = useI18n();

  // Navigation & Shell State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<HomeNavTab>("learns");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  const handleOpenSettingsTab = (tab: string = "general") => {
    if (onOpenSettings) {
      onOpenSettings(tab);
    } else {
      window.dispatchEvent(
        new CustomEvent("const:open-settings", { detail: { tab } })
      );
    }
  };

  // Artifacts View & Filter States
  const [artifactViewMode, setArtifactViewMode] = useState<"grid" | "list">("grid");
  const [artifactSearchQuery, setArtifactSearchQuery] = useState("");
  const [artifactCategory, setArtifactCategory] = useState<string>("all");

  // Folder Sorting States
  type FolderSortBy = "createdAt" | "name" | "lastOpened";
  type SortDirection = "asc" | "desc";

  const [folderSortBy, setFolderSortBy] = useState<FolderSortBy>(() => {
    try {
      const saved = localStorage.getItem("const_learn_folder_sort_by");
      if (saved === "createdAt" || saved === "name" || saved === "lastOpened") {
        return saved;
      }
    } catch {}
    return "createdAt";
  });

  const [folderSortDirection, setFolderSortDirection] = useState<SortDirection>(() => {
    try {
      const saved = localStorage.getItem("const_learn_folder_sort_direction");
      if (saved === "asc" || saved === "desc") {
        return saved;
      }
    } catch {}
    return "desc";
  });

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

  const getSortLabel = (sort: FolderSortBy) => {
    switch (sort) {
      case "createdAt":
        return t("sortCreatedAt");
      case "name":
        return t("sortName");
      case "lastOpened":
        return t("sortLastOpened");
    }
  };

  const isMac =
    typeof window !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  // Dialog States
  const [isCreateLearnOpen, setIsCreateLearnOpen] = useState(false);
  const [editingLearn, setEditingLearn] = useState<LearnItem | null>(null);
  const [targetCollectionIdForNewLearn, setTargetCollectionIdForNewLearn] = useState<string | null>(null);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [managingLearn, setManagingLearn] = useState<LearnItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "learn" | "collection" | "batch";
    id?: string;
    title: string;
    description?: string;
    itemPreview?: {
      title: string;
      description?: string;
      emoji?: string;
      sourcesCount?: number;
    };
    warningText?: string;
  } | null>(null);

  // Multi-Select States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLearnIds, setSelectedLearnIds] = useState<Set<string>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [isBatchAddToModuleOpen, setIsBatchAddToModuleOpen] = useState(false);

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

  // Filtered and sorted collections based on search and sort preferences
  const filteredCollections = useMemo(() => {
    let list = collections;
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
  }, [collections, searchQuery, folderSortBy, folderSortDirection]);

  // Recently Viewed Learns (Top 5 most recent)
  const recentlyViewedLearns = useMemo(() => {
    return allLearns.slice(0, 5);
  }, [allLearns]);

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

    if (artifactSearchQuery.trim()) {
      const q = artifactSearchQuery.toLowerCase().trim();
      list = list.filter((art) => {
        const titleMatch = art.title.toLowerCase().includes(q);
        const typeMatch = (art.type || "").toLowerCase().includes(q);
        const parent = art.learnId ? learnsMap.get(art.learnId) : null;
        const parentMatch = parent ? parent.title.toLowerCase().includes(q) : false;
        return titleMatch || typeMatch || parentMatch;
      });
    }

    return list;
  }, [artifacts, artifactCategory, artifactSearchQuery, learnsMap]);

  // Active collection object when drilled down
  const activeCollection = useMemo(() => {
    if (!activeCollectionId) return null;
    return collections.find((c) => c.id === activeCollectionId) ?? null;
  }, [collections, activeCollectionId]);

  // Filtered learns when viewing a specific collection
  const collectionLearns = useMemo(() => {
    if (!activeCollectionId) return [];
    let list = allLearns.filter((l) => l.collectionIds && l.collectionIds.includes(activeCollectionId));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allLearns, activeCollectionId, searchQuery]);

  const handleImportLearns = async (learnIds: string[]) => {
    if (!activeCollectionId) return;
    await localDb.addLearnsToCollection(activeCollectionId, learnIds);
  };

  const handleRemoveFromCollection = async (learnId: string) => {
    if (!activeCollectionId) return;
    await localDb.removeLearnFromCollection(activeCollectionId, learnId);
  };

  // Total sources count across all learns (live from sources table with fallback to learns sum)
  const rawSourcesCount = useLiveQuery(async () => {
    return await db.sources.count();
  });

  const totalSourcesCount = useMemo(() => {
    if (rawSourcesCount !== undefined) return rawSourcesCount;
    return allLearns.reduce((acc, curr) => acc + (curr.sourcesCount || 0), 0);
  }, [allLearns, rawSourcesCount]);

  // Action handlers
  const handleCreateNewLearn = async (collectionId?: string) => {
    setEditingLearn(null);
    setTargetCollectionIdForNewLearn(collectionId || activeCollectionId || null);
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
        collectionIds:
          data.collectionId !== undefined
            ? data.collectionId
              ? [data.collectionId]
              : []
            : undefined,
      });
    } else {
      const colId = data.collectionId || targetCollectionIdForNewLearn || (activeCollectionId ?? undefined);
      const newId = await localDb.createLearn({
        title: data.title,
        description: data.description,
        emoji: data.emoji,
        collectionId: colId,
        projectPath: data.projectPath,
        permissionMode: data.permissionMode || "ask_before_changes",
      });
      setTargetCollectionIdForNewLearn(null);
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

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "learn") {
        if (deleteTarget.id) {
          await localDb.deleteLearn(deleteTarget.id);
          toast.success(t("workspaceDeletedSuccess"));
        }
      } else if (deleteTarget.type === "collection") {
        if (deleteTarget.id) {
          await localDb.deleteCollection(deleteTarget.id);
          if (activeCollectionId === deleteTarget.id) {
            setActiveCollectionId(null);
          }
          toast.success(t("collectionDeletedSuccess"));
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
        toast.success(t("batchDeleteSuccess"));
      }
    } catch (err: any) {
      console.error("Failed to execute delete:", err);
      toast.error(t("failedDeleteWorkspace"));
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
    if (activeTab === "learns") {
      if (selectedLearnIds.size === filteredLearns.length && filteredLearns.length > 0) {
        setSelectedLearnIds(new Set());
      } else {
        setSelectedLearnIds(new Set(filteredLearns.map((l) => l.id)));
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

  const handleBatchDeleteClick = () => {
    const isCol = activeTab === "collections" && !activeCollection;
    const count = isCol ? selectedCollectionIds.size : selectedLearnIds.size;
    if (count === 0) return;
    setDeleteTarget({
      type: "batch",
      title: language === "id" ? `Hapus ${count} item?` : `Delete ${count} items?`,
      description: t("batchDeleteConfirm", { count }),
    });
  };

  // Reset multi-select when switching tabs or collection
  useEffect(() => {
    setSelectedLearnIds(new Set());
    setSelectedCollectionIds(new Set());
    setIsSelectionMode(false);
  }, [activeTab, activeCollectionId]);

  // Keyboard shortcut: Toggle sidebar with Ctrl+B / Cmd+B, Create new learn with Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (!isInput) {
          e.preventDefault();
          handleCreateNewLearn();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen to menu actions dispatched from TitleBar
  useEffect(() => {
    const onToggleSidebar = () => setIsSidebarOpen((prev) => !prev);
    const onNewLearn = () => handleCreateNewLearn();
    const onNewCollection = () => {
      setEditingCollection(null);
      setIsCreateCollectionOpen(true);
    };
    const onOpenWorkspaceFolder = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.folderPath) {
        const folderName =
          detail.folderPath.split(/[\\/]/).filter(Boolean).pop() || t("untitledNotebook");
        const newId = await localDb.createLearn({
          title: folderName,
          emoji: "folder",
          projectPath: detail.folderPath,
          permissionMode: "ask_before_changes",
        });
        const initialSessionId = await localDb.createSession(newId, t("initialSessionTitle"));
        try {
          localStorage.setItem(`const_learn_active_session_${newId}`, initialSessionId);
        } catch {}
        if (onOpenLearn) {
          onOpenLearn(newId, false);
        }
      }
    };

    const onNavigateTab = (e: any) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
    };

    window.addEventListener("const:toggle-sidebar", onToggleSidebar);
    window.addEventListener("const:new-learn", onNewLearn);
    window.addEventListener("const:new-collection", onNewCollection);
    window.addEventListener("const:open-workspace-folder", onOpenWorkspaceFolder);
    window.addEventListener("const:navigate-tab", onNavigateTab);

    return () => {
      window.removeEventListener("const:toggle-sidebar", onToggleSidebar);
      window.removeEventListener("const:new-learn", onNewLearn);
      window.removeEventListener("const:new-collection", onNewCollection);
      window.removeEventListener("const:open-workspace-folder", onOpenWorkspaceFolder);
      window.removeEventListener("const:navigate-tab", onNavigateTab);
    };
  }, [onOpenLearn, t]);

  const renderSidebarToggle = () => null;

  return (
    <div className="h-full w-full flex bg-secondary/60 dark:bg-[#121212] text-foreground overflow-hidden select-none">
      {/* 1. Left Sidebar (Collapsible with smooth slide, NO bouncing) */}
      <div
        className={`shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out ${
          isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="w-64 h-full">
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
            onOpenSettings={() => handleOpenSettingsTab("general")}
            user={user}
            onSignOut={onSignOut}
            onSwitchAccount={onSwitchAccount}
            learnsCount={allLearns.length}
            sourcesCount={totalSourcesCount}
            collectionsCount={collections.length}
            artifactsCount={artifacts.length}
          />
        </div>
      </div>

      {/* 2. Main Canvas (Floating card with rounded corners on all sides: top, right, bottom, left) */}
      <main className="flex-1 min-w-0 bg-background text-foreground overflow-hidden flex flex-col relative rounded-2xl sm:rounded-3xl border border-border/50 shadow-sm m-2 sm:m-2.5">
        {/* Top Header Bar when sidebar is collapsed (Kimi Reference Style) */}
        {!isSidebarOpen && (
          <div className="h-10 px-4 pt-3 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center"
                title={t("openSidebarKeyboard")}
                aria-label={t("openSidebar")}
              >
                <PanelLeft className="w-4 h-4" />
              </button>
              <DesktopUpdateBadge />
            </div>
          </div>
        )}

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
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans">
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

                    {/* Multi-Select Toggle */}
                    <Button
                      variant={isSelectionMode ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (isSelectionMode) {
                          handleExitSelectionMode();
                        } else {
                          setIsSelectionMode(true);
                        }
                      }}
                      className={`h-8 px-2.5 rounded-xl text-xs font-medium gap-1.5 transition-all cursor-pointer ${
                        isSelectionMode
                          ? "bg-primary/15 border-primary/40 text-primary hover:bg-primary/25"
                          : "border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                      title={isSelectionMode ? t("cancelSelect") : t("select")}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isSelectionMode ? t("cancelSelect") : t("select")}</span>
                    </Button>

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
                        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
                        : "space-y-2"
                    }
                  >
                    {/* First Card: Quick Create Learn Card (Grid view mode only, not searching) */}
                    {viewMode === "grid" && !searchQuery && (
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
                            title: t("deleteWorkspaceTitle", { title: l.title }),
                            itemPreview: {
                              title: l.title,
                              description: l.description,
                              emoji: l.emoji,
                              sourcesCount: l.sourcesCount,
                            },
                            warningText: t("deleteWorkspaceWarningDesc"),
                          })
                        }
                      />
                    ))}
                  </div>

                  {/* Empty State when no learns exist - only in list mode */}
                  {viewMode === "list" && filteredLearns.length === 0 && !searchQuery && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[50vh] sm:min-h-[55vh] py-12 px-4 select-none col-span-full">
                      <div className="h-16 w-16 rounded-3xl bg-secondary/80 border border-border/80 flex items-center justify-center text-muted-foreground mb-4 shadow-2xs">
                        <BookOpen className="h-7 w-7 stroke-[1.5] text-muted-foreground/80" />
                      </div>
                      <h3 className="text-base sm:text-lg font-medium text-foreground mb-1.5 tracking-tight font-sans">
                        {t("noLearnsFound")}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mb-5 leading-relaxed font-sans">
                        {t("noLearnsDescription")}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handleCreateNewLearn()}
                        className="h-9 px-4 rounded-xl text-xs font-medium gap-1.5 cursor-pointer shadow-xs active:scale-95"
                      >
                        <Plus className="h-4 w-4 stroke-[2.5]" />
                        <span>{t("newLearn")}</span>
                      </Button>
                    </div>
                  )}

                  {/* Empty Search Result State */}
                  {filteredLearns.length === 0 && searchQuery && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[40vh] py-12 px-4 col-span-full">
                      <div className="h-12 w-12 rounded-2xl bg-secondary/60 border border-border/70 flex items-center justify-center text-muted-foreground mb-3 shadow-2xs">
                        <Search className="h-5 w-5 text-muted-foreground/70" />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1 font-sans">
                        {t("noLearnsMatchSearch", { query: searchQuery })}
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
                onOpenLearn={(learnId) => onOpenLearn?.(learnId, false)}
                isSidebarOpen={isSidebarOpen}
              />
            )}

            {/* ============================================================ */}
            {/* TAB: COLLECTIONS                                             */}
            {/* ============================================================ */}
            {activeTab === "collections" && (
              <section className="space-y-6">
                {activeCollection ? (
                  // Drilled-down collection view (Page Collection)
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderSidebarToggle()}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCollectionId(null);
                            setSearchQuery("");
                          }}
                          className="h-8 w-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors shrink-0"
                          title={t("backToAllCollections")}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div className="h-10 w-10 rounded-xl bg-secondary/80 border border-border/70 flex items-center justify-center text-foreground shadow-2xs shrink-0">
                          <ModuleIcon icon={activeCollection.emoji} className="w-5 h-5 text-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5">
                            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground truncate">
                              {activeCollection.name}
                            </h1>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans">
                              {collectionLearns.length === 1
                                ? t("learnCountTextSingle")
                                : t("learnCountText", { count: collectionLearns.length })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">
                            {activeCollection.description || t("modulesSubtitle")}
                          </p>
                        </div>
                      </div>

                      {/* Collection Actions */}
                      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
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

                        {/* Multi-Select Toggle */}
                        <Button
                          variant={isSelectionMode ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            if (isSelectionMode) {
                              handleExitSelectionMode();
                            } else {
                              setIsSelectionMode(true);
                            }
                          }}
                          className={`h-8 px-2.5 rounded-xl text-xs font-medium gap-1.5 transition-all cursor-pointer ${
                            isSelectionMode
                              ? "bg-primary/15 border-primary/40 text-primary hover:bg-primary/25"
                              : "border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                          title={isSelectionMode ? t("cancelSelect") : t("select")}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{isSelectionMode ? t("cancelSelect") : t("select")}</span>
                        </Button>

                        {/* Search within collection */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <Input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={language === "id" ? "Cari dalam folder..." : "Search in folder..."}
                            className="h-8 w-36 sm:w-48 pl-8 pr-7 text-xs rounded-xl bg-card border-border text-foreground placeholder-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40 shadow-none"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Import Learn Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsImportDialogOpen(true)}
                          className="h-8 px-3 rounded-xl text-xs font-medium gap-1.5 border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <FolderInput className="w-3.5 h-3.5 text-primary" />
                          <span className="hidden sm:inline">{language === "id" ? "Import Materi" : "Import"}</span>
                        </Button>

                        {/* New Learn inside this collection */}
                        <Button
                          size="sm"
                          onClick={() => handleCreateNewLearn(activeCollection.id)}
                          className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-none"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{t("newLearn")}</span>
                        </Button>

                        {/* Collection dropdown options (Edit / Delete) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="h-8 w-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                              title={t("moreOptions")}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 p-1.5 shadow-xl bg-popover border-border text-popover-foreground">
                            <DropdownMenuItem
                              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-secondary"
                              onClick={() => {
                                setEditingCollection(activeCollection);
                                setIsCreateCollectionOpen(true);
                              }}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>{t("editCollection")}</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-border" />
                            <DropdownMenuItem
                              className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-600"
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
                    </div>

                    {/* Learns in this collection */}
                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
                          : "space-y-2"
                      }
                    >
                      {viewMode === "grid" && (
                        <CreateCard
                          type="learn"
                          viewMode={viewMode}
                          onClick={() => handleCreateNewLearn(activeCollection.id)}
                        />
                      )}

                      {collectionLearns.map((learn) => (
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
                              title: t("deleteWorkspaceTitle", { title: l.title }),
                              itemPreview: {
                                title: l.title,
                                description: l.description,
                                emoji: l.emoji,
                                sourcesCount: l.sourcesCount,
                              },
                              warningText: t("deleteWorkspaceWarningDesc"),
                            })
                          }
                        />
                      ))}
                    </div>

                    {/* Empty State when no learns in collection - only in list mode */}
                    {viewMode === "list" && collectionLearns.length === 0 && !searchQuery && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[50vh] sm:min-h-[55vh] py-12 px-4 select-none">
                        <div className="h-16 w-16 rounded-3xl bg-secondary/80 border border-border/80 flex items-center justify-center text-muted-foreground mb-4 shadow-2xs">
                          <BookOpen className="h-7 w-7 stroke-[1.5] text-muted-foreground/80" />
                        </div>
                        <h3 className="text-base sm:text-lg font-medium text-foreground mb-1.5 tracking-tight font-sans">
                          {t("noLearnsInCollection")}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mb-5 leading-relaxed font-sans">
                          {t("noLearnsInCollectionDesc")}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleCreateNewLearn(activeCollection.id)}
                          className="h-9 px-4 rounded-xl text-xs font-medium gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Plus className="h-4 w-4 stroke-[2.5]" />
                          <span>{t("createCardLearn")}</span>
                        </Button>
                      </div>
                    )}

                    {/* Empty Search Result State */}
                    {collectionLearns.length === 0 && searchQuery && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[40vh] py-12 px-4">
                        <div className="h-12 w-12 rounded-2xl bg-secondary/60 border border-border/70 flex items-center justify-center text-muted-foreground mb-3 shadow-2xs">
                          <Search className="h-5 w-5 text-muted-foreground/70" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1 font-sans">
                          {t("noLearnsMatchSearch", { query: searchQuery })}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  // All Collections overview
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          {renderSidebarToggle()}
                          <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
                            {t("collections")}
                          </h1>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans">
                            {collections.length === 1
                              ? t("collectionsCountTextSingle")
                              : t("collectionsCountText", { count: collections.length })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("modulesSubtitle")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {/* Sort Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-xl border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center"
                              title={t("sortBy")}
                            >
                              {folderSortDirection === "asc" ? (
                                <ArrowUp className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-md">
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

                        {/* View Mode Toggle */}
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

                        {/* Multi-Select Toggle */}
                        <Button
                          variant={isSelectionMode ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            if (isSelectionMode) {
                              handleExitSelectionMode();
                            } else {
                              setIsSelectionMode(true);
                            }
                          }}
                          className={`h-8 px-2.5 rounded-xl text-xs font-medium gap-1.5 transition-all cursor-pointer ${
                            isSelectionMode
                              ? "bg-primary/15 border-primary/40 text-primary hover:bg-primary/25"
                              : "border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                          title={isSelectionMode ? t("cancelSelect") : t("select")}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{isSelectionMode ? t("cancelSelect") : t("select")}</span>
                        </Button>

                        {/* Search Input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <Input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t("searchCollections")}
                            className="h-8 w-36 sm:w-48 pl-8 pr-7 text-xs rounded-xl bg-card border-border text-foreground placeholder-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40 shadow-none"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingCollection(null);
                            setIsCreateCollectionOpen(true);
                          }}
                          className="h-8 px-3.5 rounded-xl text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-none"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{t("newCollection")}</span>
                        </Button>
                      </div>
                    </div>

                    {/* Flat collections view */}
                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
                          : "space-y-2"
                      }
                    >
                      {viewMode === "grid" && (
                        <CreateCard
                          type="collection"
                          viewMode={viewMode}
                          onClick={() => {
                            setEditingCollection(null);
                            setIsCreateCollectionOpen(true);
                          }}
                        />
                      )}

                      {filteredCollections.map((col) => (
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

                    {/* Empty State when no collections exist - only in list mode */}
                    {viewMode === "list" && collections.length === 0 && !searchQuery && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[50vh] sm:min-h-[55vh] py-12 px-4 select-none">
                        <div className="h-16 w-16 rounded-3xl bg-secondary/80 border border-border/80 flex items-center justify-center text-muted-foreground mb-4 shadow-2xs">
                          <FolderPlus className="h-7 w-7 stroke-[1.5] text-muted-foreground/80" />
                        </div>
                        <h3 className="text-base sm:text-lg font-medium text-foreground mb-1.5 tracking-tight font-sans">
                          {t("noCollectionsYet")}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mb-5 leading-relaxed font-sans">
                          {t("noCollectionsYetDesc")}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingCollection(null);
                            setIsCreateCollectionOpen(true);
                          }}
                          className="h-9 px-4 rounded-xl text-xs font-medium gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Plus className="h-4 w-4 stroke-[2.5]" />
                          <span>{t("createCardCollection")}</span>
                        </Button>
                      </div>
                    )}

                    {/* Empty Search Result State */}
                    {filteredCollections.length === 0 && searchQuery && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[40vh] py-12 px-4">
                        <div className="h-12 w-12 rounded-2xl bg-secondary/60 border border-border/70 flex items-center justify-center text-muted-foreground mb-3 shadow-2xs">
                          <Search className="h-5 w-5 text-muted-foreground/70" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1 font-sans">
                          {t("noCollectionsMatchSearch", { query: searchQuery })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: ARTIFACTS                                               */}
            {/* ============================================================ */}
            {activeTab === "artifacts" && (
              <section className="space-y-6">
                {/* Header & Controls Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      {renderSidebarToggle()}
                      <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
                        {t("artifacts")}
                      </h1>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans tabular-nums">
                        {filteredArtifacts.length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {language === "id"
                        ? "Semua hasil dan artefak belajar yang dihasilkan"
                        : "All generated learning artifacts and materials"}
                    </p>
                  </div>

                  {/* Right: Grid/List Toggle, Category Dropdown & Search */}
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                    {/* View Mode Toggle (Grid vs List) */}
                    <div className="flex items-center p-0.5 rounded-xl bg-muted/70 border border-border">
                      <button
                        type="button"
                        onClick={() => setArtifactViewMode("grid")}
                        className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          artifactViewMode === "grid"
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
                        onClick={() => setArtifactViewMode("list")}
                        className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          artifactViewMode === "list"
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="List"
                        aria-label="List"
                      >
                        <ListIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Category Dropdown Filter */}
                    {(() => {
                      const activeCat = artifactCategories.find((c) => c.id === artifactCategory) || artifactCategories[0];
                      const ActiveCatIcon = activeCat?.icon || Layers;
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 rounded-xl text-xs font-medium gap-1.5 border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                              title={language === "id" ? "Filter Kategori" : "Filter Category"}
                            >
                              <ActiveCatIcon className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{activeCat?.label}</span>
                              <span className="text-[10px] opacity-70 font-sans tabular-nums">({activeCat?.count})</span>
                              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-md">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 py-1 font-medium font-sans">
                              {language === "id" ? "Kategori Artefak" : "Artifact Categories"}
                            </DropdownMenuLabel>
                            {artifactCategories.map((cat) => {
                              const CatIcon = cat.icon;
                              const isSelected = artifactCategory === cat.id;
                              return (
                                <DropdownMenuItem
                                  key={cat.id}
                                  className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 font-sans"
                                  onClick={() => setArtifactCategory(cat.id)}
                                >
                                  <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="flex-1">{cat.label}</span>
                                  <span className="text-[10px] text-muted-foreground font-sans tabular-nums">({cat.count})</span>
                                  {isSelected && <Check className="h-3.5 w-3.5 ml-1 text-primary" />}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    })()}

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="text"
                        value={artifactSearchQuery}
                        onChange={(e) => setArtifactSearchQuery(e.target.value)}
                        placeholder={language === "id" ? "Cari artefak..." : "Search artifacts..."}
                        className="h-8 w-44 sm:w-56 pl-8 pr-7 text-xs rounded-xl bg-card border-border text-foreground placeholder-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/40 shadow-none"
                      />
                      {artifactSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setArtifactSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content: Grid or List */}
                {filteredArtifacts.length > 0 ? (
                  artifactViewMode === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                              "min-h-[145px] w-full p-4 rounded-xl border transition-all flex flex-col justify-between select-none shadow-none relative",
                              art.learnId && onOpenLearn
                                ? "border-border hover:border-foreground/20 bg-card hover:bg-secondary/70 cursor-pointer group"
                                : "border-border bg-card"
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
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title={t("delete")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="space-y-1.5 my-2">
                              <h4
                                className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors leading-snug"
                                title={art.title}
                              >
                                {art.title}
                              </h4>
                              {parentLearn && (
                                <div className="flex items-center">
                                  <span
                                    className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary border border-border/70 text-muted-foreground hover:text-foreground transition-colors max-w-full truncate"
                                    title={parentLearn.title}
                                  >
                                    <LearnIcon icon={parentLearn.emoji} className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{parentLearn.title}</span>
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2.5 font-sans text-[10px]">
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
                              "w-full px-4 py-3 rounded-xl border transition-all flex items-center justify-between gap-4 select-none group shadow-none",
                              art.learnId && onOpenLearn
                                ? "border-border hover:border-foreground/20 bg-card hover:bg-secondary/70 cursor-pointer"
                                : "border-border bg-card"
                            )}
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              <div
                                className={cn(
                                  "h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform",
                                  config.bgClass
                                )}
                              >
                                <Icon className={cn("h-4 w-4", config.iconColor)} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4
                                  className="text-xs sm:text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors leading-snug"
                                  title={art.title}
                                >
                                  {art.title}
                                </h4>
                                {parentLearn && (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span
                                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors max-w-[240px] truncate"
                                      title={parentLearn.title}
                                    >
                                      <LearnIcon icon={parentLearn.emoji} className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                      <span className="truncate">{parentLearn.title}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground font-sans">
                              <span className="text-[11px] hidden sm:inline">
                                {new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }).format(new Date(art.updatedAt))}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  localDb.deleteArtifact(art.id);
                                }}
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                                title={t("delete")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border bg-card/40">
                    <div className="h-12 w-12 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-3">
                      <Layers className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <h3 className="font-serif text-lg text-foreground font-medium">
                      {artifactSearchQuery || artifactCategory !== "all"
                        ? language === "id"
                          ? "Tidak ada artefak yang cocok"
                          : "No matching artifacts"
                        : t("noArtifactsTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                      {artifactSearchQuery || artifactCategory !== "all"
                        ? language === "id"
                          ? "Coba ubah kata kunci pencarian atau kategori filter."
                          : "Try adjusting your search query or category filter."
                        : t("noArtifactsDesc")}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* TAB: MODELS                                                  */}
            {/* ============================================================ */}
            {activeTab === "models" && (
              <ModelsView onOpenSettings={() => handleOpenSettingsTab("models")} />
            )}

            {/* ============================================================ */}
            {/* TAB: MCP TOOLS & CONNECTORS                                  */}
            {/* ============================================================ */}
            {activeTab === "mcp" && <McpToolsView />}
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
          allLearns={allLearns}
          onImport={handleImportLearns}
        />
      )}

      {/* Floating Multi-Select Action Bar (HUD) */}
      {isSelectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <div className="flex items-center gap-1 sm:gap-2 px-3 py-2 rounded-2xl bg-[#1c1c1c] text-foreground border border-border/80 shadow-2xl backdrop-blur-md">
            {/* Selected Counter */}
            <div className="px-2 py-1 text-xs font-medium font-sans text-muted-foreground whitespace-nowrap">
              {t("itemsSelected", {
                count:
                  activeTab === "collections" && !activeCollection
                    ? selectedCollectionIds.size
                    : selectedLearnIds.size,
              })}
            </div>

            <div className="h-4 w-px bg-border/80" />

            {/* Select All / Deselect All */}
            <button
              type="button"
              onClick={handleSelectAll}
              className="h-8 px-2.5 rounded-xl text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {(activeTab === "collections" && !activeCollection
                  ? selectedCollectionIds.size === collections.length && collections.length > 0
                  : activeTab === "collections" && activeCollection
                  ? selectedLearnIds.size === collectionLearns.length && collectionLearns.length > 0
                  : selectedLearnIds.size === filteredLearns.length && filteredLearns.length > 0)
                  ? t("deselectAll")
                  : t("selectAll")}
              </span>
            </button>

            {/* Add to Module (only when learns are selected) */}
            {selectedLearnIds.size > 0 && (
              <button
                type="button"
                onClick={() => setIsBatchAddToModuleOpen(true)}
                className="h-8 px-2.5 rounded-xl text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                <FolderPlus className="h-3.5 w-3.5 text-primary" />
                <span>{t("addToModule")}</span>
              </button>
            )}

            {/* Remove from current Module (when inside drilled-down module and learns selected) */}
            {activeCollection && selectedLearnIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchRemoveFromActiveCollection}
                className="h-8 px-2.5 rounded-xl text-xs flex items-center gap-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                <FolderMinus className="h-3.5 w-3.5" />
                <span>{t("removeFromModule")}</span>
              </button>
            )}

            {/* Batch Delete */}
            {((activeTab === "collections" && !activeCollection && selectedCollectionIds.size > 0) ||
              selectedLearnIds.size > 0) && (
              <button
                type="button"
                onClick={handleBatchDeleteClick}
                className="h-8 px-2.5 rounded-xl text-xs flex items-center gap-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {t("batchDelete")} (
                  {activeTab === "collections" && !activeCollection
                    ? selectedCollectionIds.size
                    : selectedLearnIds.size}
                  )
                </span>
              </button>
            )}

            <div className="h-4 w-px bg-border/80" />

            {/* Cancel / Close Selection Mode */}
            <button
              type="button"
              onClick={handleExitSelectionMode}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
              title={t("cancelSelect")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
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
          itemPreview={deleteTarget.itemPreview}
          warningText={deleteTarget.warningText}
          onConfirm={handleExecuteDelete}
        />
      )}
    </div>
  );
}
