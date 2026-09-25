import { useState, useMemo } from "react";
import {
  Button,
  Input,
  cn,
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@const/ui";
import {
  X,
  Search,
  History,
  MessageSquare,
  Trash2,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Check,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";

export interface ChatSessionItem {
  id: string;
  title: string;
  messageCount?: number;
  lastMessageSnippet?: string;
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
}

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  sessions: ChatSessionItem[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onTogglePinChat?: (chatId: string, isPinned: boolean) => void;
}

export function HistoryPanel({
  open,
  onClose,
  sessions,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onTogglePinChat,
}: HistoryPanelProps) {
  const { t, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.lastMessageSnippet && s.lastMessageSnippet.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  // Group sessions by Pinned + Date
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

    filteredSessions.forEach((session) => {
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
  }, [filteredSessions, language]);

  const handleSaveRename = (sessionId: string) => {
    const trimmed = editTitleValue.trim();
    if (trimmed && onRenameChat) {
      onRenameChat(sessionId, trimmed);
    }
    setEditingSessionId(null);
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-[420px] p-0 flex flex-col bg-card border-l border-border/70 shadow-2xl z-50 gap-0"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-foreground" />
            <SheetTitle className="font-sans text-base sm:text-lg font-semibold text-foreground">
              {t("chatHistory") || "Chat history"}
            </SheetTitle>
          </div>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              aria-label="Close history panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

        {/* Search Bar */}
        <div className="p-4 sm:p-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchHistory") || "Search chat history..."}
              className="pl-9 h-9 rounded-xl text-xs font-sans border-border/70 bg-background text-foreground"
              autoFocus
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 pb-6 space-y-4">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground font-light">
              {t("noHistoryTitle") || "No chat history found"}
            </div>
          ) : (
            Object.entries(groupedSessions).map(([groupTitle, groupItems]) => {
              if (groupItems.length === 0) return null;
              return (
                <div key={groupTitle} className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-sans uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                    {groupTitle === (language === "id" ? "Disematkan" : "Pinned") && (
                      <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />
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
                          className="flex items-center gap-1.5 p-1.5 rounded-xl bg-secondary/80 border border-border"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
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
                            className="h-8 text-xs bg-background text-foreground border-border/80 flex-1 rounded-lg"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="default"
                            className="h-8 w-8 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg cursor-pointer"
                            onClick={() => handleSaveRename(session.id)}
                            title="Simpan"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                            onClick={() => setEditingSessionId(null)}
                            title="Batal"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
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
                          "group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-colors select-none",
                          isActive
                            ? "bg-foreground text-background font-medium"
                            : "hover:bg-secondary/70 text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="truncate">
                            {session.title || (language === "id" ? "Percakapan Baru" : "Untitled Chat")}
                          </span>
                          {session.isPinned && (
                            <Pin className="h-3 w-3 shrink-0 text-amber-500 fill-amber-500 rotate-45" />
                          )}
                        </div>

                        {/* Mobile 3-Dots Action Menu */}
                        <div
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors cursor-pointer shrink-0",
                                  isActive
                                    ? "text-background/80 hover:text-background hover:bg-background/20"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                )}
                                title={language === "id" ? "Menu aksi" : "More actions"}
                                aria-label={language === "id" ? "Menu aksi" : "More actions"}
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              sideOffset={4}
                              className="w-44 rounded-xl bg-popover border border-border p-1 text-popover-foreground shadow-2xl z-50"
                            >
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingSessionId(session.id);
                                  setEditTitleValue(session.title || "");
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-foreground hover:bg-muted cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{language === "id" ? "Ubah Nama" : "Edit Name"}</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  onTogglePinChat?.(session.id, !session.isPinned);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-foreground hover:bg-muted cursor-pointer"
                              >
                                {session.isPinned ? (
                                  <>
                                    <PinOff className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>{language === "id" ? "Lepas Sematan" : "Unpin Chat"}</span>
                                  </>
                                ) : (
                                  <>
                                    <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>{language === "id" ? "Sematkan Chat" : "Pin Chat"}</span>
                                  </>
                                )}
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-border my-1" />

                              <DropdownMenuItem
                                onClick={() => onDeleteChat(session.id)}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                <span>{language === "id" ? "Hapus Chat" : "Delete Chat"}</span>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
