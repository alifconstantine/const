import React, { useState } from "react";
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
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onOpenSettings,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"project" | "design" | "outside">("project");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const initials = getUserInitials(user?.name, user?.email);

  const toggleFolder = (folderName: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  // Group conversations by project, design, or outside
  const filteredConversations = conversations.filter((c) => {
    if (activeTab === "design") return false;
    return activeTab === "outside"
      ? c.project === "Outside Project"
      : c.project !== "Outside Project";
  });

  const grouped = filteredConversations.reduce((acc, c) => {
    const key = c.project || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, ConversationItem[]>);

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
                      <Hash className="w-3.5 h-3.5 text-[#d4d4d4]" />
                      <span>Outside Project</span>
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
                  <Hash className="w-3.5 h-3.5 text-[#d4d4d4]" />
                  <span>Outside Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right: Collapse all, Filter/Sort, Archive - default #d4d4d4 */}
            <div className="flex items-center gap-1 text-[#d4d4d4]">
              <button
                type="button"
                onClick={() => {
                  const allKeys = Object.keys(grouped);
                  const allCollapsed = allKeys.length > 0 && allKeys.every((k) => collapsedFolders[k]);
                  const next: Record<string, boolean> = {};
                  for (const k of allKeys) {
                    next[k] = !allCollapsed;
                  }
                  setCollapsedFolders(next);
                }}
                className="p-1 rounded-md hover:bg-[#383838] hover:text-white transition-colors cursor-pointer"
                title="Collapse or expand all"
                aria-label="Collapse or expand all"
              >
                <ChevronsDownUp className="w-3.5 h-3.5" />
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

      {/* Middle: Chat History (Image 1 style with ScrollArea) */}
      <div className="flex-1 overflow-hidden flex flex-col my-1">
        <ScrollArea className="flex-1 w-full">
          <div className="flex flex-col gap-3 py-1 pr-1.5">
            <div className="text-[11px] font-medium text-[#969696] uppercase tracking-wider px-2">
              {activeTab === "project"
                ? "Projects"
                : activeTab === "outside"
                ? "Outside Conversations"
                : "Design"}
            </div>

            {activeTab === "design" ? (
              <div className="px-2.5 py-6 text-xs text-[#777777] italic text-center">
                Design workspace
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="px-2.5 py-4 text-xs text-[#777777] italic text-center">
                No tasks yet
              </div>
            ) : (
              Object.entries(grouped).map(([projectName, items]) => {
                const isCollapsed = Boolean(collapsedFolders[projectName]);
                return (
                  <div key={projectName} className="flex flex-col gap-1">
                    {/* Collapsible Project / Group Header (Image 1) */}
                    <button
                      type="button"
                      onClick={() => toggleFolder(projectName)}
                      className="w-full flex items-center gap-2 px-2.5 py-1 text-[13px] font-medium text-[#d4d4d4] hover:text-white transition-colors cursor-pointer text-left group select-none"
                      title={projectName}
                    >
                      {isCollapsed ? (
                        <Folder className="w-4 h-4 text-[#777777] group-hover:text-[#d4d4d4] shrink-0" />
                      ) : (
                        <FolderOpen className="w-4 h-4 text-[#777777] group-hover:text-[#d4d4d4] shrink-0" />
                      )}
                      <span className="truncate">{getProjectDisplayName(projectName)}</span>
                    </button>

                    {/* Task / Conversation Items (Image 1 style, no orange badge, comfortable sizing) */}
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
              })
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
