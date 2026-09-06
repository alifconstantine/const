import React, { useState, useMemo } from "react";
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
  Settings,
  LogOut,
  ArrowLeftRight,
  User as UserIcon,
  ChevronsUpDown,
  Plus,
} from "lucide-react";
import {
  type ConversationItem,
  formatRelativeTime,
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
  onNewChat?: () => void;
  onNewChatOutside?: () => void;
  conversations?: ConversationItem[];
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
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

    return {
      projectMap: pMap,
      outsideConversations: outside,
      sortedProjectKeys: ordered,
    };
  }, [conversations, projectOrder]);

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
            onClick={onNewChat}
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
                className="p-1 rounded-md hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
                title="Archive"
                aria-label="Archive"
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
                              <button
                                type="button"
                                onClick={() => toggleFolder(projectName)}
                                className="w-full flex items-center gap-2 px-2.5 py-1 text-[13px] font-medium text-[#d4d4d4] hover:text-white transition-colors cursor-grab active:cursor-grabbing text-left group select-none"
                                title={`Drag to reorder • ${projectName}`}
                              >
                                {isCollapsed ? (
                                  <Folder className="w-4 h-4 text-[#777777] group-hover:text-[#d4d4d4] shrink-0" />
                                ) : (
                                  <FolderOpen className="w-4 h-4 text-[#777777] group-hover:text-[#d4d4d4] shrink-0" />
                                )}
                                <span className="truncate">{getProjectDisplayName(projectName)}</span>
                              </button>

                              {/* Task / Conversation Items inside Project */}
                              {!isCollapsed && (
                                <div className="flex flex-col gap-0.5 pl-1">
                                  {items.map((convo) => {
                                    const isActive = convo.id === activeConversationId;
                                    return (
                                      <button
                                        key={convo.id}
                                        type="button"
                                        onClick={() => onSelectConversation?.(convo.id)}
                                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors cursor-pointer group text-left ${
                                          isActive
                                            ? "bg-[#383838] text-white font-medium shadow-xs"
                                            : "text-[#d4d4d4] hover:text-white hover:bg-white/5"
                                        }`}
                                        title={convo.title}
                                      >
                                        <span className="truncate font-normal">
                                          {convo.title || "Untitled task"}
                                        </span>
                                        <span className="text-xs text-[#888888] font-mono shrink-0 ml-1">
                                          {formatRelativeTime(convo.updatedAt || convo.createdAt)}
                                        </span>
                                      </button>
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
                            return (
                              <button
                                key={convo.id}
                                type="button"
                                onClick={() => onSelectConversation?.(convo.id)}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors cursor-pointer group text-left ${
                                  isActive
                                    ? "bg-[#383838] text-white font-medium shadow-xs"
                                    : "text-[#d4d4d4] hover:text-white hover:bg-white/5"
                                }`}
                                title={convo.title}
                              >
                                <span className="truncate font-normal">
                                  {convo.title || "Untitled task"}
                                </span>
                                <span className="text-xs text-[#888888] font-mono shrink-0 ml-1">
                                  {formatRelativeTime(convo.updatedAt || convo.createdAt)}
                                </span>
                              </button>
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
    </aside>
  );
}
