"use client";

import { useState, useMemo } from "react";
import { Button, Input, cn } from "@const/ui";
import { X, Search, History, MessageSquare, Trash2 } from "lucide-react";

export interface ChatSessionMeta {
  _id: string;
  title: string;
  modelId: string;
  providerId: string;
  systemInstruction?: string;
  temperature: number;
  thinkingLevel?: string;
  messageCount: number;
  lastMessageSnippet?: string;
  createdAt: number;
  updatedAt: number;
}

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  sessions: ChatSessionMeta[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export function HistoryPanel({
  open,
  onClose,
  sessions,
  activeChatId,
  onSelectChat,
  onDeleteChat,
}: HistoryPanelProps) {
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

    const groups = {
      Today: [] as ChatSessionMeta[],
      Yesterday: [] as ChatSessionMeta[],
      "Previous 7 Days": [] as ChatSessionMeta[],
      Older: [] as ChatSessionMeta[],
    };

    filteredSessions.forEach((session) => {
      const sessionDate = new Date(session.updatedAt);
      if (sessionDate >= today) {
        groups.Today.push(session);
      } else if (sessionDate >= yesterday) {
        groups.Yesterday.push(session);
      } else if (sessionDate >= lastWeek) {
        groups["Previous 7 Days"].push(session);
      } else {
        groups.Older.push(session);
      }
    });

    return groups;
  }, [filteredSessions]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-card border-l border-border/70 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-foreground" />
            <h2 className="font-sans text-base sm:text-lg font-semibold text-foreground">
              Chat history
            </h2>
          </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Bar */}
      <div className="p-4 sm:p-5 pb-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chat history..."
            className="pl-9 h-9 rounded-xl text-xs font-sans border-border/70 bg-background text-foreground"
            autoFocus
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {filteredSessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground font-light">
            No chat history found
          </div>
        ) : (
          Object.entries(groupedSessions).map(([groupTitle, groupItems]) => {
            if (groupItems.length === 0) return null;
            return (
              <div key={groupTitle} className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  {groupTitle}
                </div>
                {groupItems.map((session) => {
                  const isActive = session._id === activeChatId;
                  return (
                    <div
                      key={session._id}
                      onClick={() => {
                        onSelectChat(session._id);
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
                        <span className="truncate">{session.title || "Untitled Chat"}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(session._id);
                        }}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background/20 cursor-pointer shrink-0",
                          isActive ? "text-background" : "text-muted-foreground hover:text-destructive"
                        )}
                        title="Delete chat"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 px-5 border-t border-border/60 bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono text-[11px] text-muted-foreground/80">
          {filteredSessions.length} chats saved
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="h-8 px-4 rounded-full text-xs font-medium cursor-pointer border-border/70"
        >
          Done
        </Button>
      </div>
    </div>
  </>
);
}
