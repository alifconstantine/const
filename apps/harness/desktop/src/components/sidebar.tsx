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
  ScrollArea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from "@const/ui";
import {
  PanelLeftClose,
  ArrowLeft,
  ArrowRight,
  MessageCirclePlus,
  Search,
  CalendarClock,
  Palette,
  Speech,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MessageSquare,
  Hash,
  Folder,
  FolderOpen,
  ChevronsDownUp,
  SlidersHorizontal,
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
} from "lucide-react";
import {
  type ConversationItem,
  formatRelativeTime,
  loadArchivedConversations,
  unarchiveConversation,
  setProjectPinned,
  getPinnedProjects,
} from "../lib/conversation-store";

export interface UserProfile {
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
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => void;
  onArchiveConversation?: (id: string) => void;
  onUnarchiveConversation?: (id: string) => void;
  onOpenSettings?: () => void;
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

export function Sidebar({
  user,
  onSignOut,
  onSwitchAccount,
  onCollapse,
  onNewChat,
  onNewChatOutside,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onArchiveConversation,
  onUnarchiveConversation,
  onOpenSettings,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"project" | "design" | "outside">("project");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [isProjectsSectionCollapsed, setIsProjectsSectionCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("const_harness_projects_section_collapsed") === "true";
  });
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

  const toggleProjectsSection = () => {
    setIsProjectsSectionCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("const_harness_projects_section_collapsed", String(next));
      return next;
    });
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
      if (!c.project || c.project === "Outside Project") {
        outside.push(c);
      } else {
        const list = pMap[c.project] || [];
        list.push(c);
        pMap[c.project] = list;
      }
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

  const toggleCollapseAllProjects = () => {
    setIsProjectsSectionCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("const_harness_projects_section_collapsed", String(next));
      if (!next) {
        // When opening projects section, also ensure inner project folders are open
        const nextFolders: Record<string, boolean> = {};
        for (const k of sortedProjectKeys) {
          nextFolders[k] = false;
        }
        setCollapsedFolders(nextFolders);
      }
      return next;
    });
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

  return (
    <aside className="w-64 h-full flex flex-col justify-between shrink-0 select-none bg-[#2b2b2b] text-[#d4d4d4] p-3">
      {/* Top Header & Navigation Actions (No dividing lines, following DESIGN.md) */}
      <div className="flex flex-col gap-1">
        {/* Logo and Back/Forward Navigation */}
        <div
          className="flex items-center justify-between h-9 mb-2"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          {/* Logo with hover-to-collapse effect */}
          <button
            type="button"
            onClick={onCollapse}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="p-1.5 rounded-lg hover:bg-[#383838] text-[#d4d4d4] transition-colors cursor-pointer group flex items-center justify-center"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ConstLogoIcon size="sm" className="w-5 h-5 group-hover:hidden transition-transform" />
            <PanelLeftClose className="w-5 h-5 hidden group-hover:block text-[#d4d4d4]" />
          </button>

          {/* Go Back & Go Forward: Default #d4d4d4 */}
          <div
            className="flex items-center gap-0.5 text-[#d4d4d4]"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-[#383838] hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Go back"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-[#383838] hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Go forward"
              aria-label="Go forward"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Items (All text and icons are #d4d4d4 by default) */}
        <div className="space-y-0.5 text-xs font-medium">
          {/* New Task / Chat */}
          <button
            type="button"
            onClick={() => onNewChat?.()}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#d4d4d4] hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
          >
            <MessageCirclePlus className="w-4 h-4 text-[#d4d4d4]" />
            <span>New task</span>
          </button>

          {/* Search */}
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#d4d4d4] hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#d4d4d4]" />
            <span>Search</span>
          </button>

          {/* Automations */}
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#d4d4d4] hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
          >
            <CalendarClock className="w-4 h-4 text-[#d4d4d4]" />
            <span>Automations</span>
          </button>

          {/* Design */}
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#d4d4d4] hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
          >
            <Palette className="w-4 h-4 text-[#d4d4d4]" />
            <span>Design</span>
          </button>

          {/* Speech */}
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[#d4d4d4] hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
          >
            <Speech className="w-4 h-4 text-[#d4d4d4]" />
            <span>Speech</span>
          </button>
        </div>

        {/* Switcher Dropdown (Project, Design, Outside Project) & Action Icons */}
        <div className="pt-3 pb-1 mt-1">
          <div className="flex items-center justify-between">
            {/* Left: Dropdown Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#222222] hover:bg-[#383838] text-[#d4d4d4] rounded-lg text-xs font-medium transition-colors cursor-pointer outline-none select-none"
                >
                  {activeTab === "project" && (
                    <>
                      <Folder className="w-3.5 h-3.5 text-[#d4d4d4]" />
                      <span>Project</span>
                    </>
                  )}
                  {activeTab === "design" && (
                    <>
                      <Palette className="w-3.5 h-3.5 text-[#d4d4d4]" />
                      <span>Design</span>
                    </>
                  )}
                  {activeTab === "outside" && (
                    <>
                      <MessageSquare className="w-3.5 h-3.5 text-[#d4d4d4]" />
                      <span>Conversation</span>
                    </>
                  )}
                  <ChevronDown className="w-3 h-3 text-[#969696] ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-44 bg-[#222222] border-[#383838] text-[#d4d4d4] p-1 rounded-xl shadow-xl z-50 text-xs"
              >
                <DropdownMenuItem
                  onClick={() => setActiveTab("project")}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    activeTab === "project"
                      ? "bg-[#383838] text-white font-medium"
                      : "hover:bg-[#303030] text-[#d4d4d4]"
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-[#d4d4d4]" />
                  <span>Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActiveTab("design")}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    activeTab === "design"
                      ? "bg-[#383838] text-white font-medium"
                      : "hover:bg-[#303030] text-[#d4d4d4]"
                  }`}
                >
                  <Palette className="w-3.5 h-3.5 text-[#d4d4d4]" />
                  <span>Design</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActiveTab("outside")}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    activeTab === "outside"
                      ? "bg-[#383838] text-white font-medium"
                      : "hover:bg-[#303030] text-[#d4d4d4]"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#d4d4d4]" />
                  <span>Conversation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right: Collapse all, Filter/Sort, Archive - default #d4d4d4 */}
            <div className="flex items-center gap-1 text-[#d4d4d4]">
              <button
                type="button"
                onClick={toggleCollapseAllProjects}
                className="p-1 rounded-md hover:bg-[#383838] hover:text-white transition-colors cursor-pointer group"
                title={isProjectsSectionCollapsed ? "Expand all projects" : "Collapse all projects"}
                aria-label={isProjectsSectionCollapsed ? "Expand all projects" : "Collapse all projects"}
              >
                <div className="transition-transform duration-200 flex items-center justify-center">
                  {isProjectsSectionCollapsed ? (
                    <ChevronsUpDown className="w-3.5 h-3.5 text-[#d4d4d4] group-hover:text-white transition-all duration-200 scale-105" />
                  ) : (
                    <ChevronsDownUp className="w-3.5 h-3.5 text-[#d4d4d4] group-hover:text-white transition-all duration-200" />
                  )}
                </div>
              </button>
              <button
                type="button"
                className="p-1 rounded-md hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
                title="Filter and sort"
                aria-label="Filter and sort"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleOpenArchiveModal}
                className="p-1 rounded-md hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
                title="Archived sessions"
                aria-label="Archived sessions"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Middle: Chat History (Image 1, 2, 3 style with ScrollArea) */}
      <div className="flex-1 overflow-hidden flex flex-col my-1">
        <ScrollArea className="flex-1 w-full">
          <div className="flex flex-col gap-2 py-1 pr-1.5">
            {activeTab === "design" ? (
              <div className="px-2.5 py-6 text-xs text-[#777777] italic text-center">
                Design workspace
              </div>
            ) : sortedProjectKeys.length === 0 && outsideConversations.length === 0 ? (
              <div className="px-2.5 py-4 text-xs text-[#777777] italic text-center">
                No tasks yet
              </div>
            ) : (
              <>
                {/* 1. Projects Section (Visible in Project view) */}
                {activeTab === "project" && (
                  <div className="flex flex-col gap-1">
                    {/* Header: Projects with Chevron and Action Icons (Image 1, 2, 3) */}
                    <div className="w-full flex items-center justify-between px-2.5 py-1 text-[13px] text-[#969696] hover:text-[#d4d4d4] transition-colors select-none group">
                      <button
                        type="button"
                        onClick={toggleProjectsSection}
                        className="flex items-center gap-1.5 font-medium cursor-pointer text-left text-[#969696] hover:text-[#d4d4d4]"
                      >
                        <span>Projects</span>
                        {isProjectsSectionCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-[#777777] transition-transform" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[#777777] transition-transform" />
                        )}
                      </button>

                      <div className="flex items-center gap-1 text-[#777777]">
                        <button
                          type="button"
                          onClick={() => {
                            // Toggle all project folders inside
                            const allFoldersCollapsed =
                              sortedProjectKeys.length > 0 &&
                              sortedProjectKeys.every((k) => collapsedFolders[k]);
                            const next: Record<string, boolean> = {};
                            for (const k of sortedProjectKeys) {
                              next[k] = !allFoldersCollapsed;
                            }
                            setCollapsedFolders(next);
                          }}
                          className="p-1 rounded hover:bg-[#383838] hover:text-[#d4d4d4] transition-colors cursor-pointer"
                          title="Toggle all project folders"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNewChat?.()}
                          className="p-1 rounded hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
                          title="New task in project"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Project Folders List (when Projects section is not collapsed) */}
                    {!isProjectsSectionCollapsed && (
                      <div className="flex flex-col gap-1">
                        {sortedProjectKeys.map((projectName, index) => {
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
                                className="relative w-full flex items-center justify-between px-2 py-1 rounded-lg text-[13px] font-medium text-[#d4d4d4] hover:text-white transition-colors group/folder select-none hover:bg-white/5"
                                title={`Drag to reorder • ${projectName}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleFolder(projectName)}
                                  className="w-full flex items-center gap-2 min-w-0 pr-14 cursor-pointer text-left cursor-grab active:cursor-grabbing"
                                >
                                  {isCollapsed ? (
                                    <Folder className="w-4 h-4 text-[#777777] group-hover/folder:text-[#d4d4d4] shrink-0" />
                                  ) : (
                                    <FolderOpen className="w-4 h-4 text-[#777777] group-hover/folder:text-[#d4d4d4] shrink-0" />
                                  )}
                                  <span className="truncate">{getProjectDisplayName(projectName)}</span>
                                </button>

                                {/* Action icons on hover: Pin (left of plus) and MessageCirclePlus */}
                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePinProject(projectName);
                                    }}
                                    className={`p-1 rounded hover:bg-[#383838] transition-colors cursor-pointer ${
                                      pinnedProjects.includes(projectName)
                                        ? "text-white opacity-100"
                                        : "text-[#888888] hover:text-white opacity-0 group-hover/folder:opacity-100"
                                    }`}
                                    title={pinnedProjects.includes(projectName) ? "Unpin project" : "Pin project"}
                                    aria-label="Pin project"
                                  >
                                    <Pin
                                      className={`w-3.5 h-3.5 ${
                                        pinnedProjects.includes(projectName)
                                          ? "fill-current text-[#d4d4d4] rotate-45"
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
                                    className="p-1 rounded hover:bg-[#383838] text-[#888888] hover:text-white transition-colors cursor-pointer opacity-0 group-hover/folder:opacity-100"
                                    title={`New task in ${getProjectDisplayName(projectName)}`}
                                    aria-label="New chat in this project"
                                  >
                                    <MessageCirclePlus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Task / Conversation Items inside Project */}
                              {!isCollapsed && (
                                <div className="flex flex-col gap-0.5 pl-1">
                                  {items.map((convo) => {
                                    const isActive = convo.id === activeConversationId;
                                    const isMenuOpen = openMenuConvoId === convo.id;
                                    return (
                                      <div
                                        key={convo.id}
                                        onClick={() => onSelectConversation?.(convo.id)}
                                        className={`relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer group/chat text-left overflow-hidden ${
                                          isActive
                                            ? "bg-[#383838] text-white font-medium shadow-xs"
                                            : "text-[#d4d4d4] hover:text-white hover:bg-white/5"
                                        }`}
                                      >
                                        <span className="truncate font-normal flex-1 pr-14" title={convo.title}>
                                          {convo.title || "Untitled task"}
                                        </span>

                                        <span
                                          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#888888] font-mono pointer-events-none transition-opacity duration-150 ${
                                            isMenuOpen ? "opacity-0" : "group-hover/chat:opacity-0"
                                          }`}
                                        >
                                          {formatRelativeTime(convo.updatedAt || convo.createdAt)}
                                        </span>

                                        <div
                                          className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pl-1.5 py-0.5 rounded-md transition-opacity duration-150 z-10 ${
                                            isMenuOpen
                                              ? "opacity-100 pointer-events-auto bg-[#383838]"
                                              : "opacity-0 pointer-events-none group-hover/chat:opacity-100 group-hover/chat:pointer-events-auto"
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onArchiveConversation?.(convo.id);
                                            }}
                                            className="p-1 rounded hover:bg-[#484848] text-[#969696] hover:text-white transition-colors cursor-pointer"
                                            title="Archive task"
                                            aria-label="Archive task"
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
                                                    ? "bg-[#484848] text-white"
                                                    : "hover:bg-[#484848] text-[#969696] hover:text-white"
                                                }`}
                                                title="More actions"
                                                aria-label="More actions"
                                              >
                                                <MoreHorizontal className="w-3.5 h-3.5" />
                                              </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              side="bottom"
                                              align="end"
                                              sideOffset={4}
                                              className="w-36 bg-[#222222] border-[#383838] text-[#d4d4d4] p-1 rounded-xl shadow-xl z-50 text-xs"
                                            >
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenMenuConvoId(null);
                                                  handleOpenRename(convo);
                                                }}
                                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[#303030] text-[#d4d4d4] hover:text-white"
                                              >
                                                <Pencil className="w-3.5 h-3.5" />
                                                <span>Rename</span>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenMenuConvoId(null);
                                                  handleOpenDelete(convo);
                                                }}
                                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-red-500/10 text-red-400 hover:text-red-300"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>Delete</span>
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Conversation Section (Fixed at bottom, Image 1, 2, 3) */}
                {(activeTab === "project" || activeTab === "outside") && (
                  <div className="flex flex-col gap-1 mt-1">
                    {/* Header: Conversation with Chevron, Grip, and Plus */}
                    <div className="w-full flex items-center justify-between px-2.5 py-1 text-[13px] text-[#969696] hover:text-[#d4d4d4] transition-colors select-none group">
                      <button
                        type="button"
                        onClick={toggleConversationsCollapsed}
                        className="flex items-center gap-1.5 font-medium cursor-pointer text-left text-[#969696] hover:text-[#d4d4d4]"
                      >
                        <span>Conversation</span>
                        {isConversationsCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-[#777777] transition-transform" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[#777777] transition-transform" />
                        )}
                      </button>

                      <div className="flex items-center gap-1 text-[#777777]">
                        <div className="p-1 text-[#666666]">
                          <GripVertical className="w-3.5 h-3.5 opacity-60" />
                        </div>
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
                          className="p-1 rounded hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
                          title="New conversation"
                          aria-label="New conversation"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Conversations List: NO folder icons, comfortable sizing */}
                    {!isConversationsCollapsed && (
                      <div className="flex flex-col gap-0.5 pl-1">
                        {outsideConversations.length === 0 ? (
                          <div className="px-2.5 py-2 text-xs text-[#777777] italic">
                            No conversations
                          </div>
                        ) : (
                          outsideConversations.map((convo) => {
                            const isActive = convo.id === activeConversationId;
                            const isMenuOpen = openMenuConvoId === convo.id;
                            return (
                              <div
                                key={convo.id}
                                onClick={() => onSelectConversation?.(convo.id)}
                                className={`relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer group/chat text-left overflow-hidden ${
                                  isActive
                                    ? "bg-[#383838] text-white font-medium shadow-xs"
                                    : "text-[#d4d4d4] hover:text-white hover:bg-white/5"
                                }`}
                              >
                                <span className="truncate font-normal flex-1 pr-14" title={convo.title}>
                                  {convo.title || "Untitled task"}
                                </span>

                                <span
                                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#888888] font-mono pointer-events-none transition-opacity duration-150 ${
                                    isMenuOpen ? "opacity-0" : "group-hover/chat:opacity-0"
                                  }`}
                                >
                                  {formatRelativeTime(convo.updatedAt || convo.createdAt)}
                                </span>

                                <div
                                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pl-1.5 py-0.5 rounded-md transition-opacity duration-150 z-10 ${
                                    isMenuOpen
                                      ? "opacity-100 pointer-events-auto bg-[#383838]"
                                      : "opacity-0 pointer-events-none group-hover/chat:opacity-100 group-hover/chat:pointer-events-auto"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onArchiveConversation?.(convo.id);
                                    }}
                                    className="p-1 rounded hover:bg-[#484848] text-[#969696] hover:text-white transition-colors cursor-pointer"
                                    title="Archive task"
                                    aria-label="Archive task"
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
                                            ? "bg-[#484848] text-white"
                                            : "hover:bg-[#484848] text-[#969696] hover:text-white"
                                        }`}
                                        title="More actions"
                                        aria-label="More actions"
                                      >
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      side="bottom"
                                      align="end"
                                      sideOffset={4}
                                      className="w-36 bg-[#222222] border-[#383838] text-[#d4d4d4] p-1 rounded-xl shadow-xl z-50 text-xs"
                                    >
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenMenuConvoId(null);
                                          handleOpenRename(convo);
                                        }}
                                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[#303030] text-[#d4d4d4] hover:text-white"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                        <span>Rename</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenMenuConvoId(null);
                                          handleOpenDelete(convo);
                                        }}
                                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-red-500/10 text-red-400 hover:text-red-300"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
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
              className="w-full flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-[#383838] transition-colors text-left outline-none cursor-pointer group"
              aria-label="Account menu"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8 rounded-full border border-[#383838] shrink-0">
                  {user?.image ? (
                    <AvatarImage
                      src={user.image}
                      alt={user.name || "Avatar"}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-[#383838] text-[#d4d4d4] font-sans text-xs font-medium">
                    {user === undefined ? (
                      <UserIcon className="h-3.5 w-3.5 text-[#d4d4d4] animate-pulse" />
                    ) : (
                      initials
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#d4d4d4] truncate">
                    {user?.name || "Const User"}
                  </p>
                  <p className="text-[11px] text-[#969696] truncate">
                    {user?.email || "Workspace"}
                  </p>
                </div>
              </div>
              <ChevronsUpDown className="w-4 h-4 text-[#d4d4d4] group-hover:text-white shrink-0" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" side="top" className="w-56 p-1.5 shadow-2xl mb-1 bg-popover border border-border text-popover-foreground">
            {(user?.name || user?.email) && (
              <>
                <div className="px-2.5 py-2">
                  {user.name && (
                    <p className="text-xs font-semibold text-popover-foreground truncate">
                      {user.name}
                    </p>
                  )}
                  {user.email && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-popover-foreground hover:bg-sidebar-accent rounded-md"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {onSwitchAccount && (
              <DropdownMenuItem
                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-popover-foreground hover:bg-sidebar-accent rounded-md"
                onClick={onSwitchAccount}
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span>Switch account</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-destructive hover:bg-destructive/10 rounded-md"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 1. Archived Sessions Modal (matching const-harness) */}
      <Dialog open={isArchiveModalOpen} onOpenChange={setIsArchiveModalOpen}>
        <DialogContent className="max-w-md bg-[#1e1e1e] border border-[#383838] text-[#d4d4d4] p-0 rounded-2xl shadow-2xl overflow-hidden duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-[#333333]">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-white">
              <Archive className="w-4 h-4 text-[#888888]" />
              <span>Archived Sessions</span>
              {archivedSessions.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#2a2a2a] text-[#888888] font-mono">
                  {archivedSessions.length}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 flex flex-col gap-3">
            {archivedSessions.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={archiveSearchQuery}
                  onChange={(e) => setArchiveSearchQuery(e.target.value)}
                  placeholder="Search archived sessions..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#282828] border border-[#383838] rounded-lg text-[#d4d4d4] placeholder-[#777777] focus:outline-none focus:border-[#555555]"
                />
                {archiveSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setArchiveSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777777] hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <div className="max-h-80 overflow-y-auto flex flex-col gap-1 pr-1">
              {isArchiveLoading ? (
                <div className="py-8 text-center text-xs text-[#777777]">Loading archived sessions...</div>
              ) : archivedSessions.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#777777]">
                  <Archive className="w-8 h-8 opacity-40" />
                  <span className="text-xs">No archived conversations</span>
                </div>
              ) : filteredArchivedSessions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#777777]">No matching archived conversations</div>
              ) : (
                filteredArchivedSessions.map((convo) => (
                  <div
                    key={convo.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#242424] hover:bg-[#2c2c2c] border border-transparent hover:border-[#383838] transition-all group"
                  >
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-[#d4d4d4] truncate">
                        {convo.title || "Untitled task"}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-[#777777]">
                        <span className="truncate max-w-[120px]">
                          {getProjectDisplayName(convo.project)}
                        </span>
                        <span>•</span>
                        <span>{formatRelativeTime(convo.updatedAt || convo.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsArchiveModalOpen(false);
                          onSelectConversation?.(convo.id);
                        }}
                        className="h-7 px-2.5 text-xs bg-[#2b2b2b] border-[#383838] hover:bg-[#383838] text-[#d4d4d4] hover:text-white"
                      >
                        Open
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-[#383838] text-[#888888] hover:text-white transition-colors cursor-pointer outline-none"
                            title="More actions"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-40 bg-[#222222] border-[#383838] text-[#d4d4d4] p-1 rounded-xl shadow-xl z-50 text-xs"
                        >
                          <DropdownMenuItem
                            onClick={() => handleUnarchiveSession(convo.id)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[#303030] text-[#d4d4d4] hover:text-white"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                            <span>Unarchive session</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenDelete(convo)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-red-500/10 text-red-400 hover:text-red-300"
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
        </DialogContent>
      </Dialog>

      {/* 2. Rename Task Dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-sm bg-[#1e1e1e] border border-[#383838] text-[#d4d4d4] p-5 rounded-2xl shadow-2xl duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-white">Rename Task</DialogTitle>
            <DialogDescription className="text-xs text-[#777777]">
              Enter a new title for this conversation.
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
              placeholder="Conversation title..."
              className="bg-[#282828] border-[#383838] text-white text-xs focus-visible:ring-1 focus-visible:ring-[#555555]"
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRenameTarget(null)}
              className="bg-transparent border-[#383838] text-xs hover:bg-[#303030] text-[#d4d4d4]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmRename}
              disabled={!renameDraft.trim()}
              className="bg-white hover:bg-zinc-200 text-black text-xs font-medium"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-[#1e1e1e] border border-[#383838] text-[#d4d4d4] p-5 rounded-2xl shadow-2xl duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-white">Delete Task</DialogTitle>
            <DialogDescription className="text-xs text-[#999999] pt-1">
              Are you sure you want to permanently delete{" "}
              <span className="text-white font-medium">"{deleteTarget?.title || "Untitled task"}"</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              className="bg-transparent border-[#383838] text-xs hover:bg-[#303030] text-[#d4d4d4]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
