import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  ArrowLeft,
  SquarePen,
  FolderOpen,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  Check,
  ChevronsUpDown,
  LogOut,
  Globe,
  Moon,
  Sun,
} from "lucide-react";
import {
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  ScrollArea,
  Avatar,
  AvatarImage,
  AvatarFallback,
  useTheme,
} from "@const/ui";
import { useI18n, LANGUAGE_OPTIONS } from "../../lib/i18n";
import type { ChatSessionItem } from "./history-panel";

export interface WorkspaceSidebarProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  onNewChat: () => void;
  notebookTitle?: string;
  notebookEmoji?: string;
  onRenameNotebook?: () => void;
  sourcesCount: number;
  onOpenSources: () => void;
  toolsCount?: number;
  artifactsCount?: number;
  onOpenStudio: () => void;
  sessions: ChatSessionItem[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onTogglePinChat?: (chatId: string, isPinned: boolean) => void;
  user?: any;
  onSignOut?: () => void;
}

function getUserInitials(name?: string | null, email?: string | null): string {
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
  return "A";
}

export function WorkspaceSidebar({
  open,
  onClose,
  onBack,
  onNewChat,
  sourcesCount,
  onOpenSources,
  toolsCount = 8,
  onOpenStudio,
  sessions,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onTogglePinChat,
  user,
  onSignOut,
}: WorkspaceSidebarProps) {
  const { t, language, setLanguage } = useI18n();
  const [theme, setTheme] = useTheme();
  const [isRecentExpanded, setIsRecentExpanded] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Group sessions by Pinned + Chronology
  const groupedSessions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const pinnedLabel = language === "id" ? "Disematkan" : "Pinned";
    const todayLabel = language === "id" ? "Hari Ini" : "Today";
    const yesterdayLabel = language === "id" ? "Kemarin" : "Yesterday";
    const lastWeekLabel = language === "id" ? "7 Hari Terakhir" : "Previous 7 Days";
    const olderLabel = language === "id" ? "Lebih Lama" : "Older";

    const groups: Record<string, ChatSessionItem[]> = {
      [pinnedLabel]: [],
      [todayLabel]: [],
      [yesterdayLabel]: [],
      [lastWeekLabel]: [],
      [olderLabel]: [],
    };

    sessions.forEach((session) => {
      if (session.isPinned) {
        groups[pinnedLabel]!.push(session);
        return;
      }
      const sessionDate = new Date(session.updatedAt);
      if (sessionDate >= today) {
        groups[todayLabel]!.push(session);
      } else if (sessionDate >= yesterday) {
        groups[yesterdayLabel]!.push(session);
      } else if (sessionDate >= lastWeek) {
        groups[lastWeekLabel]!.push(session);
      } else {
        groups[olderLabel]!.push(session);
      }
    });

    return groups;
  }, [sessions, language]);

  const handleSaveRename = (sessionId: string) => {
    const trimmed = editTitleValue.trim();
    if (trimmed && onRenameChat) {
      onRenameChat(sessionId, trimmed);
    }
    setEditingSessionId(null);
  };

  const displayName = user?.name || "Alif Farhanul Hakim";
  const userSubtitle = user?.email || "Pro";
  const initials = useMemo(() => {
    return getUserInitials(user?.name, user?.email);
  }, [user]);

  return (
    <>
      {/* 1. Backdrop Overlay with smooth fade-in/fade-out */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] transition-opacity duration-300 ease-out",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. Sidebar Drawer: Balanced mobile scale, rounded-tr/br-3xl, pure studio layout */}
      {/* 2. Sidebar Drawer: Perfectly calibrated mobile scale, rounded-tr/br-[24px] */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[80vw] max-w-[310px] h-full bg-[#1c1c1e] text-[#d4d4d4]",
          "border-r border-[#333336] rounded-tr-[24px] rounded-br-[24px] shadow-2xl flex flex-col will-change-transform font-sans overflow-hidden select-none",
          "transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          WebkitOverflowScrolling: "touch",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar Navigasi"
      >
        {/* TOP BAR: Back to Home Page (Left) + Close Button X (Right) */}
        <div className="h-14 px-4 border-b border-[#2d2d30] flex items-center justify-between shrink-0 bg-[#202022] rounded-tr-[24px]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onBack();
            }}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-[#2b2b2b] text-white transition-colors cursor-pointer group active:scale-95"
            title={t("backToHome") || "Kembali ke Beranda"}
          >
            <ArrowLeft className="h-4 w-4 text-[#969696] group-hover:text-white transition-colors" />
            <span className="text-[14px] font-semibold tracking-tight text-white">
              Const Learn
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-[#2b2b2b] text-[#969696] hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Tutup Sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* TOP INTERACTIVE ROWS: Balanced h-10 with rounded-full styling (No search bar) */}
        <div className="px-3 pt-2.5 pb-2 space-y-1 shrink-0 border-b border-[#2d2d30]">
          {/* Row 1: Percakapan baru (New Chat) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewChat();
            }}
            className="w-full flex items-center gap-2.5 px-3 h-10 rounded-full hover:bg-[#28282b] text-white text-[13px] font-medium transition-colors cursor-pointer active:scale-98"
          >
            <SquarePen className="h-4 w-4 text-white shrink-0" />
            <span>{language === "id" ? "Percakapan baru" : "New chat"}</span>
          </button>

          {/* Row 2: Sources (Sumber Belajar) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSources();
            }}
            className="w-full flex items-center justify-between px-3 h-10 rounded-full hover:bg-[#28282b] text-white text-[13px] font-medium transition-colors cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <FolderOpen className="h-4 w-4 text-[#d4d4d4]" />
              <span>{language === "id" ? "Sumber Belajar" : "Sources"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-full bg-[#252528] text-[#969696] border border-[#333336]">
                {sourcesCount === 1
                  ? t("sourcesCountSingle")
                  : t("sourcesCount", { count: sourcesCount })}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-[#777777]" />
            </div>
          </button>

          {/* Row 3: Studio & Tools */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenStudio();
            }}
            className="w-full flex items-center justify-between px-3 h-10 rounded-full hover:bg-[#28282b] text-white text-[13px] font-medium transition-colors cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <LayoutGrid className="h-4 w-4 text-[#d4d4d4]" />
              <span>{language === "id" ? "Studio & Tools" : "Studio & Tools"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-sans px-2 py-0.5 rounded-full bg-[#252528] text-[#969696] border border-[#333336]">
                {toolsCount} tools
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-[#777777]" />
            </div>
          </button>
        </div>

        {/* CHAT HISTORY SECTION: Terbaru ⌵ (Collapsible / Grouped) */}
        <div className="flex-1 flex flex-col min-h-0 pt-1">
          {/* Header: Terbaru ⌵ (Recent with chevron) */}
          <div
            onClick={() => setIsRecentExpanded(!isRecentExpanded)}
            className="px-4 pt-2.5 pb-1 flex items-center justify-between select-none cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#9a9a9a] group-hover:text-white transition-colors">
              <span>{language === "id" ? "Terbaru" : "Recent"}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-[#9a9a9a] group-hover:text-white transition-transform duration-200",
                  !isRecentExpanded && "-rotate-90"
                )}
              />
            </div>
            {sessions.length > 0 && (
              <span className="text-[11px] text-[#777777] font-medium">
                {sessions.length}
              </span>
            )}
          </div>

          {/* Scrollable Sessions List */}
          {isRecentExpanded && (
            <ScrollArea className="flex-1 px-3 py-0.5 pb-2" viewportClassName="space-y-0.5">
              {sessions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#777777] font-light">
                  {t("noHistoryTitle") ||
                    (language === "id"
                      ? "Belum ada riwayat percakapan"
                      : "No conversation history")}
                </div>
              ) : (
                Object.entries(groupedSessions).map(([groupTitle, groupItems]) => {
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={groupTitle} className="space-y-0.5 mb-1.5">
                      {/* Section label when multiple groups exist */}
                      <div className="px-3 py-1 text-[10.5px] font-medium tracking-wide text-[#777777] flex items-center gap-1.5">
                        {groupTitle === (language === "id" ? "Disematkan" : "Pinned") && (
                          <Pin className="h-3 w-3 text-white fill-white" />
                        )}
                        <span>{groupTitle}</span>
                      </div>

                      {groupItems.map((session) => {
                        const isActive = session.id === activeChatId;
                        const isEditing = editingSessionId === session.id;

                        if (isEditing) {
                          return (
                            <div
                              key={session.id}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#202023] border border-[#383838] my-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editTitleValue}
                                onChange={(e) => setEditTitleValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveRename(session.id);
                                  }
                                  if (e.key === "Escape") {
                                    setEditingSessionId(null);
                                  }
                                }}
                                autoFocus
                                className="h-7.5 text-xs bg-[#161618] text-white border border-[#383838] px-2.5 flex-1 rounded-full outline-none"
                              />
                              <button
                                type="button"
                                className="h-7 w-7 shrink-0 bg-white hover:bg-neutral-200 text-black rounded-full flex items-center justify-center cursor-pointer"
                                onClick={() => handleSaveRename(session.id)}
                                title="Simpan"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="h-7 w-7 shrink-0 text-[#888888] hover:text-white rounded-full flex items-center justify-center cursor-pointer"
                                onClick={() => setEditingSessionId(null)}
                                title="Batal"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={session.id}
                            onClick={() => {
                              onSelectChat(session.id);
                              onClose();
                            }}
                            className={cn(
                              "group relative flex items-center justify-between px-3 h-10 rounded-full cursor-pointer transition-colors select-none my-0.5",
                              isActive
                                ? "bg-[#28282b] text-white font-medium"
                                : "text-[#c4c4c4] hover:text-white hover:bg-[#202023]"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-1 flex-1">
                              <span className="truncate text-[13px] leading-normal font-normal">
                                {session.title ||
                                  (language === "id"
                                    ? "Percakapan baru"
                                    : "Untitled chat")}
                              </span>
                              {session.isPinned && (
                                <Pin className="h-3 w-3 shrink-0 text-white fill-white rotate-45" />
                              )}
                            </div>

                            {/* 3-Dots Action Menu */}
                            <div
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="w-7.5 h-7.5 rounded-full transition-colors cursor-pointer flex items-center justify-center text-[#8e8e93] hover:text-white hover:bg-white/10 active:scale-95"
                                    title={language === "id" ? "Menu aksi" : "More actions"}
                                    aria-label={language === "id" ? "Menu aksi" : "More actions"}
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  sideOffset={4}
                                  className="w-48 rounded-2xl bg-[#222222] border border-[#383838] p-1.5 text-[#d4d4d4] shadow-2xl z-50 font-sans text-xs"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingSessionId(session.id);
                                      setEditTitleValue(session.title || "");
                                    }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-xl text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-[#969696]" />
                                    <span>
                                      {language === "id" ? "Ubah Nama" : "Edit Name"}
                                    </span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => {
                                      onTogglePinChat?.(session.id, !session.isPinned);
                                    }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-xl text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] cursor-pointer"
                                  >
                                    {session.isPinned ? (
                                      <>
                                        <PinOff className="h-3.5 w-3.5 text-[#969696]" />
                                        <span>
                                          {language === "id"
                                            ? "Lepas Sematan"
                                            : "Unpin Chat"}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Pin className="h-3.5 w-3.5 text-[#969696]" />
                                        <span>
                                          {language === "id"
                                            ? "Sematkan Chat"
                                            : "Pin Chat"}
                                        </span>
                                      </>
                                    )}
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator className="bg-[#383838] my-1" />

                                  <DropdownMenuItem
                                    onClick={() => onDeleteChat(session.id)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                    <span>
                                      {language === "id" ? "Hapus Chat" : "Delete Chat"}
                                    </span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </ScrollArea>
          )}
        </div>

        {/* BOTTOM USER PROFILE & ACCOUNT MENU (Matches Desktop Sidebar 1:1, beautifully balanced) */}
        <div className="p-2.5 border-t border-[#2d2d30] shrink-0 bg-[#18181a] rounded-br-[24px]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2.5 p-1.5 rounded-xl hover:bg-[#28282b] transition-colors text-left outline-none cursor-pointer group active:scale-98"
                aria-label="Account menu"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-8 w-8 rounded-full border border-[#383838] shrink-0">
                    {user?.image ? (
                      <AvatarImage src={user.image} alt={user.name || "Avatar"} />
                    ) : null}
                    <AvatarFallback className="bg-[#28282b] text-[#d4d4d4] font-sans text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-white truncate leading-tight">
                      {displayName}
                    </p>
                    <p className="text-[10.5px] text-[#969696] truncate mt-0.5">
                      {userSubtitle}
                    </p>
                  </div>
                </div>
                <ChevronsUpDown className="w-3.5 h-3.5 text-[#969696] group-hover:text-white shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={8}
              className="w-56 p-1.5 mb-1 bg-[#222222] border border-[#383838] text-[#d4d4d4] rounded-2xl shadow-xl select-none text-xs font-sans z-50"
            >
              <div className="px-2.5 py-2 border-b border-[#333336] mb-1">
                <p className="text-xs font-medium text-white truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-[#969696] truncate">
                  {userSubtitle}
                </p>
              </div>

              {/* Theme */}
              <div className="px-2.5 py-1.5 flex flex-col gap-1.5">
                <span className="text-[11px] text-[#969696] font-medium flex items-center gap-1.5">
                  {theme === "dark" ? (
                    <Moon className="h-3.5 w-3.5" />
                  ) : (
                    <Sun className="h-3.5 w-3.5" />
                  )}
                  {t("theme")}
                </span>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#1a1a1c] border border-[#333336]">
                  {(["system", "light", "dark"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTheme(mode)}
                      className={`flex-1 py-1 rounded text-[11px] font-medium capitalize transition-all cursor-pointer ${
                        theme === mode
                          ? "bg-[#28282b] text-white shadow-2xs font-semibold"
                          : "text-[#8e8e93] hover:text-white"
                      }`}
                    >
                      {mode === "system"
                        ? t("themeSystem")
                        : mode === "light"
                          ? t("themeLight")
                          : t("themeDark")}
                    </button>
                  ))}
                </div>
              </div>

              <DropdownMenuSeparator className="bg-[#333336] my-1" />

              {/* Language Switch */}
              <div className="px-2.5 py-1.5 flex flex-col gap-1.5">
                <span className="text-[11px] text-[#969696] font-medium flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  {t("language")}
                </span>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#1a1a1c] border border-[#333336]">
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setLanguage(opt.code)}
                      className={`flex-1 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                        language === opt.code
                          ? "bg-[#28282b] text-white shadow-2xs font-semibold"
                          : "text-[#8e8e93] hover:text-white"
                      }`}
                    >
                      {opt.label === "Bahasa Indonesia" ? "Indonesia" : opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {onSignOut && (
                <>
                  <DropdownMenuSeparator className="bg-[#333336] my-1" />
                  <DropdownMenuItem
                    onClick={() => {
                      onClose();
                      onSignOut();
                    }}
                    className="cursor-pointer flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-rose-500/10 focus:bg-rose-500/10 text-rose-400 focus:text-rose-400"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>{t("logout")}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
