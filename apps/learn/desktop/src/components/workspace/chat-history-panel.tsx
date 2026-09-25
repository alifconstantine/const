import React, { useState, useMemo } from "react";
import {
  Button,
  Input,
  cn,
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
  DrawerDescription,
  ScrollArea,
} from "@const/ui";
import {
  X,
  Search,
  History,
  MessageSquare,
  Trash2,
  Plus,
  Clock,
} from "lucide-react";
import type { LocalChatSession } from "../../lib/db";
import { useI18n } from "../../lib/i18n";

interface ChatHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  sessions: LocalChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export function ChatHistoryPanel({
  open,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
}: ChatHistoryPanelProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.lastMessageSnippet && s.lastMessageSnippet.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups: Record<string, LocalChatSession[]> = {
      [t("today")]: [],
      [t("yesterday")]: [],
      [t("last7Days")]: [],
      [t("older")]: [],
    };

    filteredSessions.forEach((session) => {
      const sessionDate = new Date(session.updatedAt);
      if (sessionDate >= today) {
        groups[t("today")]?.push(session);
      } else if (sessionDate >= yesterday) {
        groups[t("yesterday")]?.push(session);
      } else if (sessionDate >= lastWeek) {
        groups[t("last7Days")]?.push(session);
      } else {
        groups[t("older")]?.push(session);
      }
    });

    return groups;
  }, [filteredSessions, t]);

  return (
    <Drawer
      direction="right"
      open={open}
      onOpenChange={(v) => !v && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent
        overlayClassName="top-9 h-[calc(100vh-2.25rem)]"
        className="top-9 bottom-0 h-[calc(100vh-2.25rem)] w-full sm:max-w-[400px] p-0 flex flex-col bg-card border-l border-t border-b border-border/70 shadow-2xl z-50 gap-0 select-none focus:outline-none rounded-l-2xl sm:rounded-l-3xl overflow-hidden"
      >
        <DrawerDescription className="sr-only">
          {t("chatHistory") || "Chat History"}
        </DrawerDescription>

        {/* Header */}
        <div className="p-4 sm:p-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <History className="h-4 w-4" />
            </div>
            <DrawerTitle className="font-serif text-base font-semibold text-foreground">
              {t("chatHistory")}
            </DrawerTitle>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onNewChat();
                onClose();
              }}
              className="h-8 px-2.5 rounded-xl text-xs gap-1.5 font-medium cursor-pointer border-border/70 hover:bg-muted"
              title={t("startConversationNew")}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("newChat")}</span>
            </Button>

            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label={t("close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-3 px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchHistory")}
              className="pl-9 pr-7 h-9 rounded-xl text-xs font-sans border-border/70 bg-secondary/30 text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1 w-full" viewportClassName="px-3 py-1 pb-6 space-y-4">
          {filteredSessions.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40 stroke-[1.5]" />
              <p className="font-medium text-foreground">
                {searchQuery ? t("noHistorySearchTitle") : t("noHistoryTitle")}
              </p>
              <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-[200px] mx-auto">
                {searchQuery
                  ? t("noHistorySearchDesc", { query: searchQuery })
                  : t("noHistoryDesc")}
              </p>
            </div>
          ) : (
            Object.entries(groupedSessions).map(([groupTitle, groupItems]) => {
              if (groupItems.length === 0) return null;
              return (
                <div key={groupTitle} className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-sans uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    <span>{groupTitle}</span>
                  </div>

                  {groupItems.map((session) => {
                    const isActive = session.id === activeSessionId;
                    return (
                      <div
                        key={session.id}
                        onClick={() => {
                          onSelectSession(session.id);
                          onClose();
                        }}
                        className={cn(
                          "group relative flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs cursor-pointer transition-all select-none min-h-[44px]",
                          isActive
                            ? "bg-foreground text-background font-medium shadow-xs"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
                          <MessageSquare
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-background/80" : "text-muted-foreground"
                            )}
                          />
                          <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <p
                              className={cn(
                                "truncate font-medium leading-normal",
                                isActive ? "text-background" : "text-foreground"
                              )}
                            >
                              {session.title || t("newSessionTitle")}
                            </p>
                            {session.lastMessageSnippet && (
                              <p
                                className={cn(
                                  "text-[11px] truncate mt-0.5 line-clamp-1 leading-normal",
                                  isActive
                                    ? "text-background/70"
                                    : "text-muted-foreground/80"
                                )}
                              >
                                {session.lastMessageSnippet}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {/* Delete Session Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                            }}
                            className={cn(
                              "opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 cursor-pointer",
                              isActive
                                ? "text-background/80 hover:text-rose-300"
                                : "text-muted-foreground hover:text-destructive"
                            )}
                            title={t("deleteSession")}
                            aria-label={t("deleteSession")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
