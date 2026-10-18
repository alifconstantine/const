import React, { useState, useMemo, useEffect } from "react";
import {
  ConstLogoIcon,
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  ScrollArea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  cn,
} from "@const/ui";
import {
  PanelLeft,
  PlusCircle,
  MessageCirclePlus,
  Search,
  CalendarClock,
  Clock,
  Palette,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Hash,
  Folder,
  FolderOpen,
  ChevronsDownUp,
  Archive,
  ArchiveRestore,
  Settings,
  LogOut,
  ArrowLeftRight,
  User as UserIcon,
  ChevronsUpDown,
  Plus,
  Pin,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Loader2,
  Hand,
  Globe,
  ZoomIn,
  BarChart2,
  Check,
  PencilSparkles,
} from "lucide-react";
import { AutoScrollTitle } from "./auto-scroll-title";
import {
  type ConversationItem,
  formatRelativeTime,
  loadArchivedConversations,
  unarchiveConversation,
  setProjectPinned,
  getPinnedProjects,
  isScheduledTaskConversation,
  isSideChatConversation,
  getCleanConversationTitle,
} from "../lib/conversation-store";
import { useTheme, type Theme, useInterfaceZoom } from "../lib/theme";
import { useTranslation, type SupportedLanguage } from "../lib/i18n";

export interface UserProfile {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
}

interface SidebarProps {
  user?: UserProfile | null;
  onSignOut: () => void;
  onSwitchAccount?: () => void;
  onCollapse: () => void;
  onNewChat?: (project?: string) => void;
  onNewChatOutside?: () => void;
  conversations?: ConversationItem[];
  activeConversationId?: string;
  runningConvoIds?: Set<string>;
  pendingApprovals?: Map<string, any>;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => void;
  onArchiveConversation?: (id: string) => void;
  onUnarchiveConversation?: (id: string) => void;
  onOpenSettings?: (tab?: string) => void;
  onOpenScheduledTasks?: () => void;
  isScheduledTasksActive?: boolean;
  onOpenSkills?: () => void;
  isSkillsActive?: boolean;
  onOpenSearch?: () => void;
}

export function getUserInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0];
    const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
    if (first) {
      if (last && last[0]) {
        return (first[0] + last[0]).toUpperCase();
      }
      return first.substring(0, 2).toUpperCase();
    }
  }
  if (email && email.trim()) {
    const parts = email.trim().split("@");
    const username = parts[0];
    if (username && username.length > 0) {
      return username.substring(0, 2).toUpperCase();
    }
  }
  return "U";
}

export function getProjectDisplayName(projectName: string): string {
  if (!projectName || projectName === "Outside Project" || projectName === "General") {
    return projectName || "General";
  }
  return projectName.replace(/\\/g, "/").split("/").filter(Boolean).pop() || projectName;
}

export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "简体中文" },
  { code: "es", label: "Español" },
];

export const THEME_OPTIONS: { label: string; value: Theme }[] = [
  { label: "Default", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

export const ZOOM_OPTIONS = [
  { label: "80%", value: 80 },
  { label: "90%", value: 90 },
  { label: "100% (Default)", value: 100 },
  { label: "110%", value: 110 },
  { label: "125%", value: 125 },
];

export function Sidebar({
  user,
  onSignOut,
  onSwitchAccount,
  onCollapse,
  onNewChat,
  onNewChatOutside,
  conversations = [],
  activeConversationId,
  runningConvoIds,
  pendingApprovals,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onArchiveConversation,
  onUnarchiveConversation,
  onOpenSettings,
  onOpenScheduledTasks,
  isScheduledTasksActive,
  onOpenSkills,
  isSkillsActive,
  onOpenSearch,
}: SidebarProps) {
  const [theme, setTheme] = useTheme();
  const [currentZoom, setCurrentZoom] = useInterfaceZoom();
  const { t, language: currentLanguage, setLanguage } = useTranslation();

  const handleSelectLanguage = (code: string) => {
    setLanguage(code as SupportedLanguage);
  };

  const [activeTab, setActiveTab] = useState<"project" | "recent" | "outside">("project");
  const [hoveredConvoId, setHoveredConvoId] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [isConversationsCollapsed, setIsConversationsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_conversations_collapsed") === "true";
  });

  // Project reordering state with localStorage persistence
  const [projectOrder, setProjectOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("const_harness_project_order");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Pinned projects state (persisted to SQLite disk and localStorage)
  const [pinnedProjects, setPinnedProjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("const_harness_pinned_projects");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    getPinnedProjects().then((pins) => {
      if (Array.isArray(pins) && pins.length > 0) {
        setPinnedProjects(pins);
        localStorage.setItem("const_harness_pinned_projects", JSON.stringify(pins));
      }
    });
  }, []);

  const togglePinProject = (projectName: string) => {
    setPinnedProjects((prev) => {
      const isPinned = prev.includes(projectName);
      const next = isPinned ? prev.filter((p) => p !== projectName) : [...prev, projectName];
      localStorage.setItem("const_harness_pinned_projects", JSON.stringify(next));
      setProjectPinned(projectName, !isPinned);
      return next;
    });
  };

  // State to track which conversation item's 3-dots dropdown menu is open
  const [openMenuConvoId, setOpenMenuConvoId] = useState<string | null>(null);

  // History visible chats limit before showing "See all (total)"
  const VISIBLE_CHATS_LIMIT = 6;

  // Track which project folders have their chat list expanded beyond VISIBLE_CHATS_LIMIT
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [isOutsideExpanded, setIsOutsideExpanded] = useState<boolean>(false);
  const [isRecentExpanded, setIsRecentExpanded] = useState<boolean>(false);

  const toggleExpandProject = (projectName: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectName]: !prev[projectName],
    }));
  };

  // Archive Modal State
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archivedSessions, setArchivedSessions] = useState<ConversationItem[]>([]);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [isArchiveLoading, setIsArchiveLoading] = useState(false);

  const handleOpenArchiveModal = async () => {
    setIsArchiveModalOpen(true);
    setArchiveSearchQuery("");
    setIsArchiveLoading(true);
    try {
      const list = await loadArchivedConversations();
      setArchivedSessions(list);
    } finally {
      setIsArchiveLoading(false);
    }
  };

  useEffect(() => {
    const handleOpenModal = () => {
      handleOpenArchiveModal();
    };
    window.addEventListener("const:open-archive-modal", handleOpenModal);
    return () => window.removeEventListener("const:open-archive-modal", handleOpenModal);
  }, []);

  useEffect(() => {
    if (!isArchiveModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsArchiveModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isArchiveModalOpen]);

  const handleUnarchiveSession = async (id: string) => {
    await unarchiveConversation(id);
    onUnarchiveConversation?.(id);
    setArchivedSessions((prev) => prev.filter((c) => c.id !== id));
  };

  // Rename Modal State
  const [renameTarget, setRenameTarget] = useState<ConversationItem | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const handleOpenRename = (convo: ConversationItem) => {
    setRenameTarget(convo);
    setRenameDraft(convo.title || "");
  };

  const handleConfirmRename = () => {
    if (renameTarget && renameDraft.trim()) {
      onRenameConversation?.(renameTarget.id, renameDraft.trim());
    }
    setRenameTarget(null);
    setRenameDraft("");
  };

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<ConversationItem | null>(null);

  const handleOpenDelete = (convo: ConversationItem) => {
    setDeleteTarget(convo);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDeleteConversation?.(deleteTarget.id);
      setArchivedSessions((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const filteredArchivedSessions = useMemo(() => {
    if (!archiveSearchQuery.trim()) return archivedSessions;
    const q = archiveSearchQuery.toLowerCase();
    return archivedSessions.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.project && c.project.toLowerCase().includes(q))
    );
  }, [archivedSessions, archiveSearchQuery]);

  const [draggedProjectIndex, setDraggedProjectIndex] = useState<number | null>(null);
  const [dragOverProjectIndex, setDragOverProjectIndex] = useState<number | null>(null);

  const initials = getUserInitials(user?.name, user?.email);

  const toggleFolder = (folderName: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const toggleConversationsCollapsed = () => {
    setIsConversationsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("const_harness_conversations_collapsed", String(next));
      return next;
    });
  };

  // Separate into Projects vs Outside/Conversations
  const { projectMap, outsideConversations, sortedProjectKeys } = useMemo(() => {
    const pMap: Record<string, ConversationItem[]> = {};
    const outside: ConversationItem[] = [];

    for (const c of conversations) {
      if (isSideChatConversation(c)) continue;
      if (!c.project || c.project === "Outside Project") {
        outside.push(c);
      } else {
        const list = pMap[c.project] || [];
        list.push(c);
        pMap[c.project] = list;
      }
    }

    const sortByRecent = (a: ConversationItem, b: ConversationItem) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      const timeA = a.updatedAt || a.createdAt || 0;
      const timeB = b.updatedAt || b.createdAt || 0;
      return timeB - timeA;
    };

    outside.sort(sortByRecent);
    for (const key of Object.keys(pMap)) {
      pMap[key]?.sort(sortByRecent);
    }

    const rawKeys = Object.keys(pMap);

    // Apply projectOrder
    const ordered: string[] = [];
    for (const key of projectOrder) {
      if (rawKeys.includes(key)) {
        ordered.push(key);
      }
    }
    for (const key of rawKeys) {
      if (!ordered.includes(key)) {
        ordered.push(key);
      }
    }

    // Pinned projects always come first!
    const pinned = ordered.filter((k) => pinnedProjects.includes(k));
    const unpinned = ordered.filter((k) => !pinnedProjects.includes(k));
    const finalOrdered = [...pinned, ...unpinned];

    return {
      projectMap: pMap,
      outsideConversations: outside,
      sortedProjectKeys: finalOrdered,
    };
  }, [conversations, projectOrder, pinnedProjects]);

  // Flat chronologically sorted conversations for Recent view
  const recentConversations = useMemo(() => {
    return conversations
      .filter((c) => !isSideChatConversation(c))
      .sort((a, b) => {
        const timeA = a.updatedAt || a.createdAt || 0;
        const timeB = b.updatedAt || b.createdAt || 0;
        return timeB - timeA;
      });
  }, [conversations]);

  // Auto-expand project or section if the active conversation is beyond VISIBLE_CHATS_LIMIT
  useEffect(() => {
    if (!activeConversationId) return;

    for (const [projectName, items] of Object.entries(projectMap)) {
      const activeIdx = items.findIndex((c) => c.id === activeConversationId);
      if (activeIdx >= VISIBLE_CHATS_LIMIT) {
        setExpandedProjects((prev) => (prev[projectName] ? prev : { ...prev, [projectName]: true }));
      }
    }

    const outsideIdx = outsideConversations.findIndex((c) => c.id === activeConversationId);
    if (outsideIdx >= VISIBLE_CHATS_LIMIT) {
      setIsOutsideExpanded(true);
    }

    const recentIdx = recentConversations.findIndex((c) => c.id === activeConversationId);
    if (recentIdx >= VISIBLE_CHATS_LIMIT) {
      setIsRecentExpanded(true);
    }
  }, [activeConversationId, projectMap, outsideConversations, recentConversations]);

  // Check if all project folders are currently collapsed
  const areAllFoldersCollapsed = useMemo(() => {
    if (sortedProjectKeys.length === 0) return false;
    return sortedProjectKeys.every((k) => Boolean(collapsedFolders[k]));
  }, [sortedProjectKeys, collapsedFolders]);

  const toggleCollapseAllProjects = () => {
    const shouldCollapse = !areAllFoldersCollapsed;
    const nextFolders: Record<string, boolean> = {};
    for (const k of sortedProjectKeys) {
      nextFolders[k] = shouldCollapse;
    }
    setCollapsedFolders(nextFolders);
  };

  // Drag and drop handlers for projects
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedProjectIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sortedProjectKeys[index] || "");
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedProjectIndex === null || draggedProjectIndex === index) return;
    setDragOverProjectIndex(index);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = () => {
    setDragOverProjectIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedProjectIndex === null || draggedProjectIndex === targetIndex) {
      setDraggedProjectIndex(null);
      setDragOverProjectIndex(null);
      return;
    }

    const nextOrder = [...sortedProjectKeys];
    const [moved] = nextOrder.splice(draggedProjectIndex, 1);
    if (moved) {
      nextOrder.splice(targetIndex, 0, moved);
      setProjectOrder(nextOrder);
      localStorage.setItem("const_harness_project_order", JSON.stringify(nextOrder));
    }
    setDraggedProjectIndex(null);
    setDragOverProjectIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedProjectIndex(null);
    setDragOverProjectIndex(null);
  };

  const renderConversationItem = (
    convo: ConversationItem,
    options?: { showProjectTooltip?: boolean }
  ) => {
    const isActive = convo.id === activeConversationId;
    const isMenuOpen = openMenuConvoId === convo.id;
    const isHovered = hoveredConvoId === convo.id;
    const projectName =
      convo.project && convo.project !== "Outside Project"
        ? convo.project
        : t("sidebar.outsideProject");

    const content = (
      <div
        key={convo.id}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-no-select]")) return;
          onSelectConversation?.(convo.id);
        }}
        onMouseEnter={() => setHoveredConvoId(convo.id)}
        onMouseLeave={() => setHoveredConvoId(null)}
        className={`relative w-full max-w-full h-8 flex items-center justify-between rounded-md px-2 text-[13px] transition-colors cursor-pointer group/chat text-left ${
          isActive
            ? "bg-[#dedee2] dark:bg-[#383838] text-[#262626] dark:text-white font-medium shadow-xs"
            : "text-[#666666] dark:text-[#999999] hover:text-black dark:hover:text-white hover:bg-[#dedee2]/60 dark:hover:bg-white/5"
        }`}
      >
        <AutoScrollTitle
          text={getCleanConversationTitle(convo.title)}
          className="flex-1 mr-2"
          textClassName={
            isActive
              ? "font-medium text-[#262626] dark:text-white"
              : "font-normal text-[#666666] dark:text-[#999999] group-hover/chat:text-black dark:group-hover/chat:text-white transition-colors"
          }
          isParentHovered={isHovered}
        />

        <div
          data-no-select="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 shrink-0 ml-auto select-none"
        >
          {/* Relative time or Loading Spinner or Approval Waiting */}
          {pendingApprovals?.has(convo.id) ? (
            <div
              title="Needs permission / Waiting for approval"
              className="flex items-center justify-center p-0.5 text-amber-500 shrink-0"
            >
              <Hand className="w-3.5 h-3.5 text-[#ff7a00] dark:text-[#ff9500] animate-pulse shrink-0" />
            </div>
          ) : runningConvoIds?.has(convo.id) ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#969696]" />
          ) : (
            <div
              className={`items-center gap-1 ${
                isMenuOpen ? "hidden" : "flex group-hover/chat:hidden"
              }`}
            >
              {isScheduledTaskConversation(convo) && (
                <Clock className="w-3 h-3 text-[#777777] dark:text-[#888888] shrink-0" />
              )}
              <span
                className={`text-[11px] font-sans tabular-nums whitespace-nowrap select-none ${
                  isActive
                    ? "text-[#262626] dark:text-[#b0b0b0] font-medium"
                    : "text-[#888888] dark:text-[#777777]"
                }`}
              >
                {formatRelativeTime(convo.updatedAt || convo.createdAt)}
              </span>
            </div>
          )}

          {/* Actions on hover or when dropdown menu is open */}
          <div
            className={`items-center gap-0.5 ${
              isMenuOpen ? "flex" : "hidden group-hover/chat:flex"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onArchiveConversation?.(convo.id);
              }}
              className="p-1 rounded hover:bg-[#dedee2] dark:hover:bg-[#484848] text-[#888888] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer"
              title={t("sidebar.archiveConvo")}
              aria-label={t("sidebar.archiveConvo")}
            >
              <Archive className="w-3.5 h-3.5" />
            </button>

            <DropdownMenu
              open={isMenuOpen}
              onOpenChange={(open) => setOpenMenuConvoId(open ? convo.id : null)}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className={`p-1 rounded transition-colors cursor-pointer outline-none ${
                    isMenuOpen
                      ? "bg-[#dedee2] dark:bg-[#484848] text-[#262626] dark:text-white"
                      : "hover:bg-[#dedee2] dark:hover:bg-[#484848] text-[#888888] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white"
                  }`}
                  title={t("common.actions")}
                  aria-label={t("common.actions")}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="end"
                sideOffset={4}
                className="w-36 bg-[#ffffff] dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] p-1 rounded-xl shadow-xl z-50 text-xs"
              >
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuConvoId(null);
                    handleOpenRename(convo);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-[#303030] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#8a8a8a] dark:text-[#a0a0a0]" />
                  <span>{t("sidebar.renameConvo")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuConvoId(null);
                    onArchiveConversation?.(convo.id);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-[#303030] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white"
                >
                  <Archive className="w-3.5 h-3.5 text-[#8a8a8a] dark:text-[#a0a0a0]" />
                  <span>{t("sidebar.archived")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#dedee2] dark:bg-[#383838] my-1" />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuConvoId(null);
                    handleOpenDelete(convo);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-red-500/10 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t("common.delete")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );

    if (options?.showProjectTooltip) {
      return (
        <Tooltip key={convo.id} open={isMenuOpen ? false : undefined}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={8}
            className="bg-[#222222] border border-[#383838] text-[#d4d4d4] rounded-xl px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 shadow-xl select-none pointer-events-none"
          >
            <Folder className="w-3.5 h-3.5 text-[#969696]" />
            <span>{projectName}</span>
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  const isMac =
    typeof window !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

  return (
    <aside className="w-64 h-full flex flex-col justify-between shrink-0 select-none bg-transparent text-[#666666] dark:text-[#999999] p-3">
      {/* Top Header & Navigation Actions (No dividing lines, following DESIGN.md) */}
      <div className="flex flex-col gap-1">
        {/* Logo and Collapse Button */}
        <div
          className="flex items-center justify-between h-9 mb-1"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <ConstLogoIcon size="sm" className="w-5 h-5 text-foreground shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-base font-normal tracking-tight text-foreground">
                Const
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Harness
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-0.5 text-[#666666] dark:text-[#999999]"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={onCollapse}
              className="p-1.5 rounded-lg hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#666666] dark:text-[#999999] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action: Create New Chat Button (Always crisp white as primary action) */}
        <div className="pt-1 pb-1.5">
          <button
            type="button"
            onClick={() => onNewChat?.()}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/80 hover:bg-secondary border border-border/60 hover:border-border text-foreground font-medium text-xs transition-all cursor-pointer shadow-2xs group active:scale-[0.99]"
            title={`New chat (${isMac ? "⌘K" : "Ctrl+K"})`}
          >
            <div className="flex items-center gap-2">
              <MessageCirclePlus className="w-4 h-4 text-black dark:text-white transition-colors stroke-[1.8]" />
              <span className="font-medium text-black dark:text-white">
                {t("sidebar.newChat")}
              </span>
            </div>
            <span className="text-xs text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white font-sans transition-colors select-none tracking-tight">
              {isMac ? "⌘K" : "Ctrl+K"}
            </span>
          </button>
        </div>

        {/* Navigation Items (Gray by default, white on hover) */}
        <div className="space-y-0.5 text-xs font-medium">

          {/* Search */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[#666666] dark:text-[#999999] hover:bg-[#dedee2] dark:hover:bg-[#383838] hover:text-black dark:hover:text-white transition-colors cursor-pointer group"
          >
            <Search className="w-4 h-4 text-[#777777] dark:text-[#888888] group-hover:text-black dark:group-hover:text-white transition-colors" />
            <span>{t("common.search")}</span>
          </button>

          {/* Scheduled Tasks */}
          <button
            type="button"
            onClick={onOpenScheduledTasks}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-[#dedee2] dark:hover:bg-[#383838] hover:text-black dark:hover:text-white transition-colors cursor-pointer group ${
              isScheduledTasksActive
                ? "bg-[#dedee2] dark:bg-[#383838] text-black dark:text-white font-medium"
                : "text-[#666666] dark:text-[#999999]"
            }`}
          >
            <CalendarClock className={`w-4 h-4 transition-colors ${
              isScheduledTasksActive
                ? "text-black dark:text-white"
                : "text-[#777777] dark:text-[#888888] group-hover:text-black dark:group-hover:text-white"
            }`} />
            <span>{t("sidebar.scheduledTasks")}</span>
          </button>

          {/* Agent Skills (matching learn home sidebar) */}
          <button
            type="button"
            onClick={onOpenSkills}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-[#dedee2] dark:hover:bg-[#383838] hover:text-black dark:hover:text-white transition-colors cursor-pointer group ${
              isSkillsActive
                ? "bg-[#dedee2] dark:bg-[#383838] text-black dark:text-white font-medium"
                : "text-[#666666] dark:text-[#999999]"
            }`}
          >
            <PencilSparkles className={`w-4 h-4 transition-colors ${
              isSkillsActive
                ? "text-primary"
                : "text-[#777777] dark:text-[#888888] group-hover:text-primary"
            }`} />
            <span>{t("settings.skills") || "Agent Skills"}</span>
          </button>
        </div>

        {/* Switcher Dropdown (Recent, Project, Conversation) & Action Icons */}
        <div className="pt-3 pb-1 mt-1">
          <div className="flex items-center justify-between">
            {/* Left: Dropdown Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-transparent hover:bg-[#dedee2] dark:hover:bg-[#383838] data-[state=open]:bg-[#dedee2] dark:data-[state=open]:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white dark:data-[state=open]:text-white rounded-lg text-[13px] font-medium transition-colors cursor-pointer outline-none select-none group"
                >
                  {activeTab === "project" && (
                    <>
                      <Folder className="w-3.5 h-3.5 text-[#777777] dark:text-[#888888] group-hover:text-black dark:group-hover:text-white transition-colors shrink-0" />
                      <span>{t("sidebar.projects")}</span>
                    </>
                  )}
                  {activeTab === "outside" && (
                    <>
                      <MessageSquare className="w-3.5 h-3.5 text-[#777777] dark:text-[#888888] group-hover:text-black dark:group-hover:text-white transition-colors shrink-0" />
                      <span>{t("sidebar.outsideProject")}</span>
                    </>
                  )}
                  {activeTab === "recent" && (
                    <>
                      <Clock className="w-3.5 h-3.5 text-[#777777] dark:text-[#888888] group-hover:text-black dark:group-hover:text-white transition-colors shrink-0" />
                      <span>{t("sidebar.recent")}</span>
                    </>
                  )}
                  <ChevronDown className="w-3 h-3 text-[#777777] dark:text-[#888888] group-hover:text-black dark:group-hover:text-white ml-0.5 transition-colors shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={4}
                className="w-44 bg-[#ffffff] dark:bg-[#222222] border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] p-1 rounded-xl shadow-xl z-50 font-sans text-xs"
              >
                <DropdownMenuItem
                  onClick={() => setActiveTab("project")}
                  className={cn(
                    "flex items-center justify-between !px-2.5 !py-1.5 !text-xs rounded-lg cursor-pointer transition-colors",
                    activeTab === "project"
                      ? "bg-[#dedee2] dark:bg-[#383838] text-black dark:text-white font-medium"
                      : "hover:bg-[#dedee2]/60 dark:hover:bg-[#303030] text-[#262626] dark:text-[#d4d4d4]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 shrink-0" />
                    <span>{t("sidebar.projects")}</span>
                  </div>
                  {activeTab === "project" && <Check className="w-3 h-3 text-black dark:text-white shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActiveTab("outside")}
                  className={cn(
                    "flex items-center justify-between !px-2.5 !py-1.5 !text-xs rounded-lg cursor-pointer transition-colors",
                    activeTab === "outside"
                      ? "bg-[#dedee2] dark:bg-[#383838] text-black dark:text-white font-medium"
                      : "hover:bg-[#dedee2]/60 dark:hover:bg-[#303030] text-[#262626] dark:text-[#d4d4d4]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>{t("sidebar.outsideProject")}</span>
                  </div>
                  {activeTab === "outside" && <Check className="w-3 h-3 text-black dark:text-white shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActiveTab("recent")}
                  className={cn(
                    "flex items-center justify-between !px-2.5 !py-1.5 !text-xs rounded-lg cursor-pointer transition-colors",
                    activeTab === "recent"
                      ? "bg-[#dedee2] dark:bg-[#383838] text-black dark:text-white font-medium"
                      : "hover:bg-[#dedee2]/60 dark:hover:bg-[#303030] text-[#262626] dark:text-[#d4d4d4]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{t("sidebar.recent")}</span>
                  </div>
                  {activeTab === "recent" && <Check className="w-3 h-3 text-black dark:text-white shrink-0" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right: Collapse all (ONLY when in Projects view) & Archive */}
            <div className="flex items-center gap-0.5 text-[#777777] dark:text-[#888888]">
              {activeTab === "project" && sortedProjectKeys.length > 0 && (
                <button
                  type="button"
                  onClick={toggleCollapseAllProjects}
                  className="p-1 rounded-md hover:bg-[#dedee2] dark:hover:bg-[#383838] hover:text-black dark:hover:text-white transition-colors cursor-pointer group"
                  title={areAllFoldersCollapsed ? t("sidebar.expandAll") : t("sidebar.collapseAll")}
                  aria-label={areAllFoldersCollapsed ? t("sidebar.expandAll") : t("sidebar.collapseAll")}
                >
                  <div className="transition-transform duration-200 flex items-center justify-center">
                    {areAllFoldersCollapsed ? (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#777777] dark:text-[#888888] group-hover:text-black dark:group-hover:text-white transition-all duration-200" />
                    ) : (
                      <ChevronsDownUp className="w-3.5 h-3.5 text-[#777777] dark:text-[#888888] group-hover:text-black dark:group-hover:text-white transition-all duration-200" />
                    )}
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenArchiveModal}
                className="p-1 rounded-md hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                title={t("sidebar.archivedSessions")}
                aria-label={t("sidebar.archivedSessions")}
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Middle: Chat History (Image 1, 2, 3 style with ScrollArea) */}
      <div className="flex-1 overflow-hidden flex flex-col my-1 w-full max-w-full">
        <ScrollArea className="flex-1 w-full [&>div>div[style]]:!block" viewportClassName="[&>div[style]]:!block">
          <div className="flex flex-col gap-2 py-1 pr-1.5 w-full max-w-full">
            {activeTab === "recent" ? (
              <TooltipProvider delayDuration={150}>
                <div className="flex flex-col gap-0.5 pl-1 w-full max-w-full">
                  {recentConversations.length === 0 ? (
                    <div className="px-2.5 py-4 text-xs text-[#a9a9a9] dark:text-[#777777] italic text-center">
                      No recent tasks
                    </div>
                  ) : (
                    <>
                      {(isRecentExpanded
                        ? recentConversations
                        : recentConversations.slice(0, VISIBLE_CHATS_LIMIT)
                      ).map((convo) => renderConversationItem(convo, { showProjectTooltip: true }))}

                      {recentConversations.length > VISIBLE_CHATS_LIMIT && (
                        <button
                          type="button"
                          onClick={() => setIsRecentExpanded((prev) => !prev)}
                          className="w-full h-8 flex items-center px-2.5 rounded-lg text-xs font-normal text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white hover:bg-[#dedee2]/60 dark:hover:bg-white/5 transition-colors cursor-pointer text-left select-none"
                        >
                          <span>{isRecentExpanded ? "Show less" : `See all (${recentConversations.length})`}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </TooltipProvider>
            ) : activeTab === "outside" ? (
              <div className="flex flex-col gap-0.5 pl-1 w-full max-w-full">
                {outsideConversations.length === 0 ? (
                  <div className="px-2.5 py-4 text-xs text-[#a9a9a9] dark:text-[#777777] italic text-center">
                    No conversations outside project
                  </div>
                ) : (
                  <>
                    {(isOutsideExpanded
                      ? outsideConversations
                      : outsideConversations.slice(0, VISIBLE_CHATS_LIMIT)
                    ).map((convo) => renderConversationItem(convo))}

                    {outsideConversations.length > VISIBLE_CHATS_LIMIT && (
                      <button
                        type="button"
                        onClick={() => setIsOutsideExpanded((prev) => !prev)}
                        className="w-full h-8 flex items-center px-2 rounded-lg text-xs font-normal text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white hover:bg-[#dedee2]/60 dark:hover:bg-white/5 transition-colors cursor-pointer text-left select-none"
                      >
                        <span>{isOutsideExpanded ? "Show less" : `See all (${outsideConversations.length})`}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : sortedProjectKeys.length === 0 && outsideConversations.length === 0 ? (
              <div className="px-2.5 py-4 text-xs text-[#a9a9a9] dark:text-[#777777] italic text-center">
                No tasks yet
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {/* Project Folders List */}
                {sortedProjectKeys.length === 0 ? (
                  <div className="px-2.5 py-2 text-xs text-[#a9a9a9] dark:text-[#777777] italic text-center">
                    No project folders
                  </div>
                ) : (
                  sortedProjectKeys.map((projectName, index) => {
                          const items = projectMap[projectName] || [];
                          const isCollapsed = Boolean(collapsedFolders[projectName]);
                          const isDragging = draggedProjectIndex === index;
                          const isDragOver = dragOverProjectIndex === index;

                          return (
                            <div
                              key={projectName}
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, index)}
                              onDragEnd={handleDragEnd}
                              className={`flex flex-col gap-1 rounded-lg transition-all ${
                                isDragging ? "opacity-40 scale-[0.98]" : ""
                              } ${
                                isDragOver
                                  ? "bg-white/5 ring-1 ring-white/20"
                                  : ""
                              }`}
                            >
                              {/* Collapsible Project / Group Header */}
                              <div
                                className="relative w-full max-w-full overflow-hidden flex items-center justify-between px-2 py-1 rounded-md text-[13px] font-medium text-[#666666] dark:text-[#999999] hover:text-black dark:hover:text-white transition-colors group/folder select-none hover:bg-[#dedee2]/60 dark:hover:bg-white/5"
                                title={`Drag to reorder • ${projectName}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleFolder(projectName)}
                                  className="w-full flex items-center gap-2 min-w-0 pr-14 cursor-pointer text-left cursor-grab active:cursor-grabbing"
                                >
                                  {isCollapsed ? (
                                    <Folder className="w-4 h-4 text-[#777777] dark:text-[#888888] group-hover/folder:text-black dark:group-hover/folder:text-white transition-colors shrink-0" />
                                  ) : (
                                    <FolderOpen className="w-4 h-4 text-[#777777] dark:text-[#888888] group-hover/folder:text-black dark:group-hover/folder:text-white transition-colors shrink-0" />
                                  )}
                                  <span className="truncate group-hover/folder:text-black dark:group-hover/folder:text-white transition-colors">{getProjectDisplayName(projectName)}</span>
                                </button>

                                {/* Action icons on hover: Pin (left of plus) and MessageCirclePlus */}
                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       togglePinProject(projectName);
                                    }}
                                    className={`p-1 rounded hover:bg-[#dedee2] dark:hover:bg-[#383838] transition-colors cursor-pointer ${
                                      pinnedProjects.includes(projectName)
                                        ? "text-[#262626] dark:text-white opacity-100"
                                        : "text-[#777777] dark:text-[#888888] hover:text-[#262626] dark:hover:text-white opacity-0 group-hover/folder:opacity-100"
                                    }`}
                                    title={pinnedProjects.includes(projectName) ? "Unpin project" : "Pin project"}
                                    aria-label="Pin project"
                                  >
                                    <Pin
                                      className={`w-3.5 h-3.5 ${
                                        pinnedProjects.includes(projectName)
                                          ? "fill-current text-[#262626] dark:text-white rotate-45"
                                          : ""
                                      }`}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNewChat?.(projectName);
                                    }}
                                    className="p-1 rounded hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#777777] dark:text-[#888888] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer opacity-0 group-hover/folder:opacity-100"
                                    title={`New task in ${getProjectDisplayName(projectName)}`}
                                    aria-label="New chat in this project"
                                  >
                                    <MessageCirclePlus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Task / Conversation Items inside Project */}
                              {!isCollapsed && (
                                <div className="flex flex-col gap-0.5 pl-1 w-full max-w-full">
                                  {(() => {
                                    const isExpanded = Boolean(expandedProjects[projectName]);
                                    const displayItems = isExpanded
                                      ? items
                                      : items.slice(0, VISIBLE_CHATS_LIMIT);
                                    const hasMore = items.length > VISIBLE_CHATS_LIMIT;

                                    return (
                                      <>
                                        {displayItems.map((convo) => renderConversationItem(convo))}

                                        {hasMore && (
                                          <button
                                            type="button"
                                            onClick={() => toggleExpandProject(projectName)}
                                            className="w-full h-8 flex items-center px-2 rounded-lg text-xs font-normal text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white hover:bg-[#dedee2]/60 dark:hover:bg-white/5 transition-colors cursor-pointer text-left select-none"
                                          >
                                            <span>{isExpanded ? "Show less" : `See all (${items.length})`}</span>
                                          </button>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })
                )}

                {/* Collapsible Outside Project group when inside Project View */}
                {outsideConversations.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1 pt-1">
                    <div className="relative w-full max-w-full overflow-hidden flex items-center justify-between px-2 py-1 rounded-md text-[13px] font-medium text-[#666666] dark:text-[#999999] hover:text-black dark:hover:text-white transition-colors group/folder select-none hover:bg-[#dedee2]/60 dark:hover:bg-white/5">
                      <button
                        type="button"
                        onClick={toggleConversationsCollapsed}
                        className="w-full flex items-center gap-2 min-w-0 pr-8 cursor-pointer text-left"
                      >
                        <MessageSquare className="w-4 h-4 text-[#777777] dark:text-[#888888] group-hover/folder:text-black dark:group-hover/folder:text-white transition-colors shrink-0" />
                        <span className="truncate group-hover/folder:text-black dark:group-hover/folder:text-white transition-colors">
                          {t("sidebar.outsideProject")}
                        </span>
                        {isConversationsCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-[#777777] dark:text-[#888888] shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[#777777] dark:text-[#888888] shrink-0" />
                        )}
                      </button>

                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNewChatOutside) {
                              onNewChatOutside();
                            } else {
                              onNewChat?.();
                            }
                          }}
                          className="p-1 rounded hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#777777] dark:text-[#888888] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer opacity-0 group-hover/folder:opacity-100"
                          title="New conversation outside project"
                          aria-label="New conversation outside project"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {!isConversationsCollapsed && (
                      <div className="flex flex-col gap-0.5 pl-1 w-full max-w-full">
                        {(isOutsideExpanded
                          ? outsideConversations
                          : outsideConversations.slice(0, VISIBLE_CHATS_LIMIT)
                        ).map((convo) => renderConversationItem(convo))}

                        {outsideConversations.length > VISIBLE_CHATS_LIMIT && (
                          <button
                            type="button"
                            onClick={() => setIsOutsideExpanded((prev) => !prev)}
                            className="w-full h-8 flex items-center px-2 rounded-lg text-xs font-normal text-[#777777] dark:text-[#888888] hover:text-black dark:hover:text-white hover:bg-[#dedee2]/60 dark:hover:bg-white/5 transition-colors cursor-pointer text-left select-none"
                          >
                            <span>{isOutsideExpanded ? "Show less" : `See all (${outsideConversations.length})`}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom: Preserved Full Account Settings (No borders) */}
      <div className="pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-[#dedee2] dark:hover:bg-[#383838] transition-colors text-left outline-none cursor-pointer group"
              aria-label="Account menu"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8 rounded-full border border-[#d5d5d9] dark:border-[#383838] shrink-0">
                  {user?.image ? (
                    <AvatarImage
                      src={user.image}
                      alt={user.name || "Avatar"}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-[#dedee2] dark:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] font-sans text-xs font-medium">
                    {user === undefined ? (
                      <UserIcon className="h-3.5 w-3.5 text-[#a9a9a9] dark:text-[#d4d4d4] animate-pulse" />
                    ) : (
                      initials
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#666666] dark:text-[#999999] group-hover:text-black dark:group-hover:text-white transition-colors truncate">
                    {user?.name || "Const User"}
                  </p>
                  <p className="text-[11px] text-[#888888] dark:text-[#777777] truncate">
                    {user?.email || "Workspace"}
                  </p>
                </div>
              </div>
              <ChevronsUpDown className="w-4 h-4 text-[#777777] dark:text-[#888888] group-hover:text-black dark:group-hover:text-white transition-colors shrink-0" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-56 p-1.5 shadow-2xl mb-1 bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] rounded-2xl select-none animate-in fade-in zoom-in-95 duration-100"
          >
            {/* 1. Settings (paling atas) */}
            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2.5 text-[13px] py-2 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] focus:text-[#111111] dark:focus:text-white rounded-xl outline-none transition-colors"
              onClick={() => onOpenSettings?.("general")}
            >
              <Settings className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
              <span>{t("sidebar.settings")}</span>
            </DropdownMenuItem>

            {/* 2. Language (Submenu) */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 text-[13px] py-2 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] focus:text-[#111111] dark:focus:text-white data-[state=open]:bg-[#f4f4f5] dark:data-[state=open]:bg-[#2e2e2e] data-[state=open]:text-[#111111] dark:data-[state=open]:text-white rounded-xl outline-none transition-colors [&>svg:last-child]:text-[#737373] dark:[&>svg:last-child]:text-[#737373] [&>svg:last-child]:w-3.5 [&>svg:last-child]:h-3.5">
                <Globe className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
                <span>{t("sidebar.language")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[170px] p-1.5 rounded-2xl bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] shadow-2xl select-none">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    className="cursor-pointer flex items-center justify-between text-[13px] py-1.5 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] focus:text-[#111111] dark:focus:text-white rounded-xl outline-none transition-colors"
                    onClick={() => handleSelectLanguage(lang.code)}
                  >
                    <span>{lang.label}</span>
                    {currentLanguage === lang.code && (
                      <Check className="w-3.5 h-3.5 text-[#111111] dark:text-white ml-2 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* 3. App theme (Submenu) */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 text-[13px] py-2 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] focus:text-[#111111] dark:focus:text-white data-[state=open]:bg-[#f4f4f5] dark:data-[state=open]:bg-[#2e2e2e] data-[state=open]:text-[#111111] dark:data-[state=open]:text-white rounded-xl outline-none transition-colors [&>svg:last-child]:text-[#737373] dark:[&>svg:last-child]:text-[#737373] [&>svg:last-child]:w-3.5 [&>svg:last-child]:h-3.5">
                <Palette className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
                <span>{t("sidebar.theme")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[150px] p-1.5 rounded-2xl bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] shadow-2xl select-none">
                {THEME_OPTIONS.map((item) => (
                  <DropdownMenuItem
                    key={item.value}
                    className="cursor-pointer flex items-center justify-between text-[13px] py-1.5 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] focus:text-[#111111] dark:focus:text-white rounded-xl outline-none transition-colors"
                    onClick={() => setTheme(item.value)}
                  >
                    <span>{item.value === "system" ? t("sidebar.defaultTheme") : item.value === "light" ? t("sidebar.lightTheme") : t("sidebar.darkTheme")}</span>
                    {theme === item.value && (
                      <Check className="w-3.5 h-3.5 text-[#111111] dark:text-white ml-2 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* 4. Interface zoom (Submenu) */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2.5 text-[13px] py-2 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] focus:text-[#111111] dark:focus:text-white data-[state=open]:bg-[#f4f4f5] dark:data-[state=open]:bg-[#2e2e2e] data-[state=open]:text-[#111111] dark:data-[state=open]:text-white rounded-xl outline-none transition-colors [&>svg:last-child]:text-[#737373] dark:[&>svg:last-child]:text-[#737373] [&>svg:last-child]:w-3.5 [&>svg:last-child]:h-3.5">
                <ZoomIn className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
                <span>{t("sidebar.zoom")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[160px] p-1.5 rounded-2xl bg-white dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] shadow-2xl select-none">
                {ZOOM_OPTIONS.map((item) => (
                  <DropdownMenuItem
                    key={item.value}
                    className="cursor-pointer flex items-center justify-between text-[13px] py-1.5 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] focus:text-[#111111] dark:focus:text-white rounded-xl outline-none transition-colors"
                    onClick={() => setCurrentZoom(item.value)}
                  >
                    <span>{item.label}</span>
                    {currentZoom === item.value && (
                      <Check className="w-3.5 h-3.5 text-[#111111] dark:text-white ml-2 shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator className="my-1 bg-[#dedee2] dark:bg-[#333333]" />

            {/* 5. Usage stats */}
            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2.5 text-[13px] py-2 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] focus:text-[#111111] dark:focus:text-white rounded-xl outline-none transition-colors"
              onClick={() => onOpenSettings?.("usage-stats")}
            >
              <BarChart2 className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
              <span>{t("settings.usageStats")}</span>
            </DropdownMenuItem>

            {/* (Upgrade excluded as requested) */}

            <DropdownMenuSeparator className="my-1 bg-[#dedee2] dark:bg-[#333333]" />

            {/* 6. Switch account */}
            {onSwitchAccount && (
              <DropdownMenuItem
                className="cursor-pointer flex items-center gap-2.5 text-[13px] py-2 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-[#111111] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-[#2e2e2e] focus:bg-[#f4f4f5] dark:focus:bg-[#2e2e2e] focus:text-[#111111] dark:focus:text-white rounded-xl outline-none transition-colors"
                onClick={onSwitchAccount}
              >
                <ArrowLeftRight className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
                <span>{t("sidebar.switchAccount")}</span>
              </DropdownMenuItem>
            )}

            {/* 7. Log out */}
            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2.5 text-[13px] py-2 px-2.5 text-[#262626] dark:text-[#d4d4d4] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/10 focus:text-red-500 dark:focus:text-red-400 focus:bg-red-500/10 dark:focus:bg-red-500/10 rounded-xl outline-none transition-colors"
              onClick={onSignOut}
            >
              <LogOut className="w-4 h-4 text-[#737373] dark:text-[#8e8e93] shrink-0" />
              <span>{t("sidebar.signOut")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 1. Archived Sessions Modal (matching Settings pop-up smooth animation & style) */}
      {isArchiveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-xs select-none p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setIsArchiveModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Archived Sessions"
        >
          <div
            className="w-[min(560px,calc(100vw-32px))] max-w-[560px] max-h-[85vh] bg-white dark:bg-[#1e1e1e] border border-[#e2e2e4] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] rounded-2xl shadow-2xl dark:shadow-[0_24px_70px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col font-sans outline-none focus:outline-none focus-visible:outline-none ring-0 animate-in fade-in zoom-in-[0.985] duration-150"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            {/* Header: aligned flex header matching Settings style */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e2e4] dark:border-[#333333] shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#161616] dark:text-white">
                <Archive className="w-4 h-4 text-[#a9a9a9] dark:text-[#888888]" />
                <span>{t("sidebar.archivedSessions")}</span>
                {archivedSessions.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0f0f2] dark:bg-[#2a2a2a] text-[#262626] dark:text-[#888888] font-sans tabular-nums">
                    {archivedSessions.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="p-1.5 rounded-lg text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-[#f0f0f2] dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer outline-none focus:outline-none shrink-0"
                title={`${t("common.close")} (Esc)`}
                aria-label={t("common.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 w-full min-w-0 overflow-hidden flex-1">
              {archivedSessions.length > 0 && (
                <div className="relative w-full min-w-0">
                  <Search className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#777777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={archiveSearchQuery}
                    onChange={(e) => setArchiveSearchQuery(e.target.value)}
                    placeholder={t("sidebar.searchArchived")}
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#f4f4f6] dark:bg-[#282828] border border-[#e2e2e4] dark:border-[#383838] rounded-lg text-[#262626] dark:text-[#d4d4d4] placeholder-[#a9a9a9] dark:placeholder-[#777777] focus:outline-none transition-colors"
                  />
                  {archiveSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setArchiveSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a9a9a9] dark:text-[#777777] hover:text-[#262626] dark:hover:text-white p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="w-full min-w-0 max-h-80 overflow-y-auto overflow-x-hidden flex flex-col gap-1.5 pr-1">
                {isArchiveLoading ? (
                  <div className="py-8 text-center text-xs text-[#a9a9a9] dark:text-[#777777]">Loading archived sessions...</div>
                ) : archivedSessions.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#a9a9a9] dark:text-[#777777]">
                    <Archive className="w-8 h-8 opacity-40" />
                    <span className="text-xs">No archived conversations</span>
                  </div>
                ) : filteredArchivedSessions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#a9a9a9] dark:text-[#777777]">No matching archived conversations</div>
                ) : (
                  filteredArchivedSessions.map((convo) => (
                    <div
                      key={convo.id}
                      onClick={() => {
                        setIsArchiveModalOpen(false);
                        onSelectConversation?.(convo.id);
                      }}
                      className="w-full min-w-0 flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#f4f4f6] dark:bg-[#242424] hover:bg-[#eaeaea] dark:hover:bg-[#2c2c2c] border border-transparent hover:border-[#e2e2e4] dark:hover:border-[#383838] transition-all group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5 overflow-hidden">
                        <p
                          className="text-xs font-medium text-[#262626] dark:text-[#d4d4d4] truncate block"
                          title={convo.title || "Untitled task"}
                        >
                          {getCleanConversationTitle(convo.title)}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-[#a9a9a9] dark:text-[#777777]">
                          <span className="truncate max-w-[140px]">
                            {getProjectDisplayName(convo.project)}
                          </span>
                          <span>•</span>
                          <span className="shrink-0">{formatRelativeTime(convo.updatedAt || convo.createdAt)}</span>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1.5 shrink-0 ml-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsArchiveModalOpen(false);
                            onSelectConversation?.(convo.id);
                          }}
                          className="h-7 px-2.5 text-xs bg-white dark:bg-[#2b2b2b] border-[#e2e2e4] dark:border-[#383838] hover:bg-[#eaeaea] dark:hover:bg-[#383838] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white shrink-0 cursor-pointer"
                        >
                          Open
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg hover:bg-[#dedee2] dark:hover:bg-[#383838] text-[#a9a9a9] dark:text-[#888888] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer outline-none shrink-0"
                              title="More actions"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-40 bg-white dark:bg-[#222222] border-[#e2e2e4] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] p-1 rounded-xl shadow-xl z-50 text-xs"
                          >
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnarchiveSession(convo.id);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-[#303030] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                              <span>Unarchive session</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDelete(convo);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-red-500/10 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete session</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Rename Task Dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-sm bg-white dark:bg-[#1e1e1e] border border-[#e2e2e4] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] p-5 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-[#161616] dark:text-white">{t("sidebar.renameConvo")}</DialogTitle>
            <DialogDescription className="text-xs text-[#a9a9a9] dark:text-[#777777]">
              {t("workbench.renameTaskPlaceholder")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <Input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirmRename();
                }
              }}
              autoFocus
              placeholder={t("sidebar.renameConvo")}
              className="bg-[#f4f4f6] dark:bg-[#282828] border-[#e2e2e4] dark:border-[#383838] text-[#262626] dark:text-white text-xs focus-visible:ring-0 focus:outline-none transition-colors"
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRenameTarget(null)}
              className="bg-transparent border-[#e2e2e4] dark:border-[#383838] text-xs hover:bg-[#eaeaea] dark:hover:bg-[#303030] text-[#262626] dark:text-[#d4d4d4]"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmRename}
              disabled={!renameDraft.trim()}
              className="bg-[#262626] hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-medium"
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-white dark:bg-[#1e1e1e] border border-[#e2e2e4] dark:border-[#383838] text-[#262626] dark:text-[#d4d4d4] p-5 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-[#161616] dark:text-white">{t("sidebar.deleteConvoTitle")}</DialogTitle>
            <DialogDescription className="text-xs text-[#a9a9a9] dark:text-[#999999] pt-1">
              {t("sidebar.deleteConvoDesc")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              className="bg-transparent border-[#e2e2e4] dark:border-[#383838] text-xs hover:bg-[#eaeaea] dark:hover:bg-[#303030] text-[#262626] dark:text-[#d4d4d4]"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
