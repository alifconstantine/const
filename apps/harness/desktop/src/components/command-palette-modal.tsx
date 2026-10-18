import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CalendarClock,
  ChevronDown,
  Clock,
  FolderPlus,
  List,
  MessageSquare,
  MessageCirclePlus,
  PanelLeft,
  Plus,
  Rocket,
  Search,
  Settings,
  PencilSparkles,
  X,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import {
  type ConversationItem,
  formatRelativeTime,
  getCleanConversationTitle,
  isScheduledTaskConversation,
} from "../lib/conversation-store";
import { getProjectDisplayName } from "./sidebar";
import { useTranslation } from "../lib/i18n";

export type PaletteTab = "all" | "actions" | "tasks";
export type TaskCategoryFilter = "all" | "project" | "outside";

export interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  conversations?: ConversationItem[];
  activeConversationId?: string;
  currentProject?: string;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
  onOpenWorkspace?: () => void;
  onOpenScheduledTasks?: () => void;
  onOpenSkills?: () => void;
  onOpenArchive?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onToggleSidebar?: () => void;
}

interface PaletteAction {
  id: string;
  title: string;
  shortcut?: string;
  icon: React.ReactNode;
  category: "suggested" | "navigation" | "tools" | "settings";
  run: () => void;
}

interface TaskItem {
  id: string;
  title: string;
  workspaceName: string;
  updatedAt?: number;
  isProject: boolean;
  isScheduled?: boolean;
  rawMessages?: any[];
  matchedSnippet?: string;
  matchedRole?: "user" | "assistant";
  matchPriority?: number;
}

/**
 * Search inside conversation messages (inputs and outputs) and extract a contextual snippet.
 */
function extractMessageMatch(
  messages: any[],
  query: string
): { role: "user" | "assistant"; snippet: string } | null {
  if (!Array.isArray(messages) || !query.trim()) return null;
  const qLower = query.toLowerCase().trim();

  // Search in reverse to prioritize recent messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;
    let text = "";
    if (typeof msg.content === "string") {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      text = msg.content
        .map((part: any) => (typeof part === "string" ? part : part?.text || ""))
        .join(" ");
    }

    if (!text) continue;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(qLower);
    if (idx !== -1) {
      const singleLine = text.replace(/\s+/g, " ").trim();
      const cleanIdx = singleLine.toLowerCase().indexOf(qLower);
      const matchPos = cleanIdx !== -1 ? cleanIdx : 0;
      const start = Math.max(0, matchPos - 35);
      const end = Math.min(singleLine.length, matchPos + qLower.length + 65);
      const snippet =
        (start > 0 ? "..." : "") +
        singleLine.slice(start, end).trim() +
        (end < singleLine.length ? "..." : "");

      return {
        role: msg.role === "assistant" ? "assistant" : "user",
        snippet,
      };
    }
  }

  return null;
}

/**
 * Highlight matched substrings with a blue pill background.
 */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + lowerQuery.length);
  const after = text.slice(index + lowerQuery.length);

  return (
    <>
      {before}
      <mark className="bg-[#1e3a8a] text-[#93c5fd] rounded-[3px] px-[3px] font-medium">{match}</mark>
      {after}
    </>
  );
}

export function CommandPaletteModal({
  open,
  onClose,
  conversations = [],
  onSelectConversation,
  onNewChat,
  onOpenWorkspace,
  onOpenScheduledTasks,
  onOpenSkills,
  onOpenArchive,
  onOpenSettings,
  onToggleSidebar,
}: CommandPaletteModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<PaletteTab>("all");
  const [taskCategory, setTaskCategory] = useState<TaskCategoryFilter>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Focus input and reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setTab("all");
      setTaskCategory("all");
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Listen to Escape key globally
  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open, onClose]);

  // All Real Tasks extracted from conversations
  const allTasks: TaskItem[] = useMemo(() => {
    return conversations
      .filter((c) => Boolean(c.title || c.id))
      .map((c) => {
        const isProject = Boolean(
          c.project && c.project !== "Outside Project" && c.project !== "General"
        );
        const workspaceName = getProjectDisplayName(c.project);
        return {
          id: c.id,
          title: getCleanConversationTitle(c.title) || "Untitled Task",
          workspaceName: workspaceName || "default",
          updatedAt: c.updatedAt,
          isProject,
          isScheduled: isScheduledTaskConversation(c),
          rawMessages: c.messages,
        };
      })
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [conversations]);

  // Filtered Tasks based on query and taskCategory (Title > Workspace > Messages)
  const filteredTasks = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = allTasks;

    if (tab === "tasks") {
      if (taskCategory === "project") {
        list = list.filter((t) => t.isProject);
      } else if (taskCategory === "outside") {
        list = list.filter((t) => !t.isProject);
      }
    }

    if (!q) return list;

    const matchedList: TaskItem[] = [];

    for (const t of list) {
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchWs = (t.workspaceName || "").toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);

      if (matchTitle) {
        matchedList.push({
          ...t,
          matchPriority: 0,
        });
        continue;
      }

      if (matchWs || matchId) {
        matchedList.push({
          ...t,
          matchPriority: 1,
        });
        continue;
      }

      // Deep search into conversation prompt input & assistant output
      const messageMatch = extractMessageMatch(t.rawMessages || [], q);
      if (messageMatch) {
        matchedList.push({
          ...t,
          matchPriority: 2,
          matchedSnippet: messageMatch.snippet,
          matchedRole: messageMatch.role,
        });
      }
    }

    // Sort: Title/Workspace match first, then message content match; within each group, newest first
    return matchedList.sort((a, b) => {
      const pDiff = (a.matchPriority ?? 0) - (b.matchPriority ?? 0);
      if (pDiff !== 0) return pDiff;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
  }, [allTasks, query, tab, taskCategory]);

  // Displayed Tasks: Max 5 in All tab
  const displayedTasks = useMemo(() => {
    if (tab === "all") {
      return filteredTasks.slice(0, 5);
    }
    return filteredTasks;
  }, [filteredTasks, tab]);

  // Real functional actions only (clean, zero dummy actions, no sub headings)
  const actions: PaletteAction[] = useMemo(
    () => [
      {
        id: "act-new-chat",
        title: t("commandPalette.newChat"),
        shortcut: typeof navigator !== "undefined" && navigator?.userAgent?.includes("Mac") ? "⌘K" : "Ctrl+K",
        icon: <MessageCirclePlus size={16} />,
        category: "suggested",
        run: () => {
          onClose();
          onNewChat?.();
        },
      },
      {
        id: "act-open-workspace",
        title: t("commandPalette.openWorkspace"),
        shortcut: "Ctrl+O",
        icon: <FolderPlus size={16} />,
        category: "suggested",
        run: () => {
          onClose();
          onOpenWorkspace?.();
        },
      },
      {
        id: "act-scheduled-tasks",
        title: t("commandPalette.openScheduledTasks"),
        icon: <CalendarClock size={16} />,
        category: "tools",
        run: () => {
          onClose();
          onOpenScheduledTasks?.();
        },
      },
      {
        id: "act-skills",
        title: t("skillsTitle") || "Agent Skills",
        icon: <PencilSparkles size={16} />,
        category: "tools",
        run: () => {
          onClose();
          onOpenSkills?.();
        },
      },
      {
        id: "act-archived-sessions",
        title: t("commandPalette.archivedSessions"),
        icon: <Archive size={16} />,
        category: "navigation",
        run: () => {
          onClose();
          onOpenArchive?.();
        },
      },
      {
        id: "act-settings",
        title: t("commandPalette.openSettings"),
        icon: <Settings size={16} />,
        category: "settings",
        run: () => {
          onClose();
          onOpenSettings?.();
        },
      },
      {
        id: "act-toggle-sidebar",
        title: t("commandPalette.toggleSidebar"),
        shortcut: "Ctrl+B",
        icon: <PanelLeft size={16} />,
        category: "navigation",
        run: () => {
          onClose();
          onToggleSidebar?.();
        },
      },
    ],
    [
      t,
      onClose,
      onNewChat,
      onOpenWorkspace,
      onOpenScheduledTasks,
      onOpenArchive,
      onOpenSettings,
      onToggleSidebar,
    ]
  );

  // Filtered Actions
  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase().trim();
    return actions.filter((a) => a.title.toLowerCase().includes(q));
  }, [actions, query]);

  // Displayed Actions: Max 4 in All tab
  const displayedActions = useMemo(() => {
    if (tab === "all") {
      return filteredActions.slice(0, 4);
    }
    return filteredActions;
  }, [filteredActions, tab]);

  // Handle open session / task
  const handleSelectTask = (taskId: string) => {
    onClose();
    onSelectConversation?.(taskId);
  };

  // Flat Selectable Items for Keyboard Navigation
  const flatSelectableItems = useMemo(() => {
    const items: Array<{ id: string; run: () => void }> = [];
    if (tab === "all" || tab === "tasks") {
      displayedTasks.forEach((s) => {
        items.push({
          id: `task-${s.id}`,
          run: () => handleSelectTask(s.id),
        });
      });
    }
    if (tab === "all" || tab === "actions") {
      displayedActions.forEach((a) => {
        items.push({
          id: `act-${a.id}`,
          run: a.run,
        });
      });
    }
    return items;
  }, [tab, displayedTasks, displayedActions]);

  // Reset selected index on filter/tab/category change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, tab, taskCategory]);

  // Scroll active item into view
  useEffect(() => {
    const activeEl = itemRefs.current[selectedIndex];
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        flatSelectableItems.length > 0 ? (prev + 1) % flatSelectableItems.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        flatSelectableItems.length > 0
          ? (prev - 1 + flatSelectableItems.length) % flatSelectableItems.length
          : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatSelectableItems[selectedIndex]) {
        flatSelectableItems[selectedIndex].run();
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const tabs: PaletteTab[] = ["all", "actions", "tasks"];
      const currentIdx = tabs.indexOf(tab);
      const nextIdx = e.shiftKey
        ? (currentIdx - 1 + tabs.length) % tabs.length
        : (currentIdx + 1) % tabs.length;
      const targetTab = tabs[nextIdx];
      if (targetTab) {
        setTab(targetTab);
      }
    }
  };

  if (!open) return null;

  let itemCursor = 0;
  itemRefs.current = [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-[min(600px,calc(100vw-32px))] h-[min(560px,calc(100dvh-40px))] max-h-[560px] bg-[#18181b] border border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.65),0_0_1px_rgba(255,255,255,0.15)] flex flex-col overflow-hidden text-white font-sans animate-in fade-in zoom-in-[0.985] duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rounded Pill Search Input Box */}
        <div className="flex-none px-4 pt-3.5 pb-2 flex items-center box-border">
          <div className="flex-1 flex items-center gap-2.5 h-10 px-3.5 rounded-full bg-white/[0.06] border border-white/10 box-border">
            <Search size={16} className="text-white/45 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 h-full bg-transparent border-none text-white text-sm outline-none placeholder:text-white/40 p-0 font-sans"
              placeholder={t("commandPalette.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Search actions or tasks"
            />
            {query.trim() !== "" && (
              <button
                type="button"
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer p-0 border-none"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear query"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs Row */}
        <div
          className="flex-none px-4 pt-1.5 pb-2.5 flex items-center gap-1.5 border-b border-white/[0.07]"
          role="tablist"
        >
          <button
            type="button"
            className={cn(
              "h-7 px-3 rounded-full inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-all duration-100 cursor-pointer select-none",
              tab === "all"
                ? "bg-white/[0.13] text-white border border-white/[0.18]"
                : "text-white/65 hover:bg-white/[0.07] hover:text-white border border-transparent"
            )}
            onClick={() => setTab("all")}
            role="tab"
            aria-selected={tab === "all"}
          >
            <List size={13} />
            <span>{t("commandPalette.all")}</span>
          </button>
          <button
            type="button"
            className={cn(
              "h-7 px-3 rounded-full inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-all duration-100 cursor-pointer select-none",
              tab === "actions"
                ? "bg-white/[0.13] text-white border border-white/[0.18]"
                : "text-white/65 hover:bg-white/[0.07] hover:text-white border border-transparent"
            )}
            onClick={() => setTab("actions")}
            role="tab"
            aria-selected={tab === "actions"}
          >
            <Rocket size={13} />
            <span>{t("commandPalette.actions")}</span>
          </button>
          <button
            type="button"
            className={cn(
              "h-7 px-3 rounded-full inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-all duration-100 cursor-pointer select-none",
              tab === "tasks"
                ? "bg-white/[0.13] text-white border border-white/[0.18]"
                : "text-white/65 hover:bg-white/[0.07] hover:text-white border border-transparent"
            )}
            onClick={() => setTab("tasks")}
            role="tab"
            aria-selected={tab === "tasks"}
          >
            <MessageSquare size={13} />
            <span>{t("commandPalette.tasks")}</span>
          </button>
        </div>

        {/* Sub-Filter Chips for Tasks Tab */}
        {tab === "tasks" && (
          <div className="flex-none px-4 py-1.5 flex items-center gap-1.5 bg-black/15 border-b border-white/[0.05]">
            <button
              type="button"
              className={cn(
                "text-[11.5px] font-sans px-2 py-0.5 rounded-md transition-colors duration-100 cursor-pointer border",
                taskCategory === "all"
                  ? "bg-white/10 text-white font-medium border-white/12"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/80 border-transparent font-normal"
              )}
              onClick={() => setTaskCategory("all")}
            >
              {t("commandPalette.all")} ({allTasks.length})
            </button>
            <button
              type="button"
              className={cn(
                "text-[11.5px] font-sans px-2 py-0.5 rounded-md transition-colors duration-100 cursor-pointer border",
                taskCategory === "project"
                  ? "bg-white/10 text-white font-medium border-white/12"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/80 border-transparent font-normal"
              )}
              onClick={() => setTaskCategory("project")}
            >
              {t("commandPalette.project")} ({allTasks.filter((t) => t.isProject).length})
            </button>
            <button
              type="button"
              className={cn(
                "text-[11.5px] font-sans px-2 py-0.5 rounded-md transition-colors duration-100 cursor-pointer border",
                taskCategory === "outside"
                  ? "bg-white/10 text-white font-medium border-white/12"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/80 border-transparent font-normal"
              )}
              onClick={() => setTaskCategory("outside")}
            >
              {t("commandPalette.outside")} ({allTasks.filter((t) => !t.isProject).length})
            </button>
          </div>
        )}

        {/* Scrollable Results Body using @const/ui ScrollArea */}
        <ScrollArea className="flex-1 min-h-0 w-full" viewportClassName="px-3 py-2.5">
          <div className="flex flex-col gap-1">
            {/* Tasks Section (No sub heading) */}
            {(tab === "all" || tab === "tasks") && displayedTasks.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {displayedTasks.map((task) => {
                  const currentIndex = itemCursor++;
                  const isActive = currentIndex === selectedIndex;
                  const hasSnippet = Boolean(task.matchedSnippet);
                  return (
                    <button
                      key={task.id}
                      ref={(el) => {
                        itemRefs.current[currentIndex] = el;
                      }}
                      type="button"
                      className={cn(
                        "w-full flex flex-col justify-center px-2.5 rounded-lg text-left transition-colors duration-75 cursor-pointer text-white border-none",
                        hasSnippet ? "py-1.5 min-h-[48px] gap-1" : "h-9",
                        isActive ? "bg-white/[0.08]" : "bg-transparent hover:bg-white/[0.08]"
                      )}
                      onClick={() => handleSelectTask(task.id)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                    >
                      <div className="w-full flex items-center gap-2.5 min-w-0">
                        <span className="text-white/50 shrink-0 flex items-center justify-center">
                          <MessageSquare size={16} />
                        </span>
                        <span className="text-[13.5px] font-normal text-white truncate flex-1 min-w-0">
                          <HighlightMatch text={task.title} query={query} />
                        </span>
                        <div className="shrink-0 flex items-center gap-2 ml-2">
                          <span className="text-[11px] text-white/50 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded max-w-[120px] truncate">
                            {task.workspaceName || "default"}
                          </span>
                          <div className="flex items-center gap-1 min-w-[24px] text-right">
                            {task.isScheduled && (
                              <Clock size={12} className="text-white/40 shrink-0" />
                            )}
                            <span className="text-xs text-white/40">
                              {formatRelativeTime(task.updatedAt ?? Date.now())}
                            </span>
                          </div>
                        </div>
                      </div>

                      {hasSnippet && (
                        <div className="w-full flex items-center gap-1.5 pl-[26px] text-[11.5px] min-w-0">
                          <span
                            className={cn(
                              "px-1 py-[0.5px] text-[9.5px] font-medium uppercase tracking-wider rounded border shrink-0",
                              task.matchedRole === "user"
                                ? "text-[#93c5fd] bg-[#1e3a8a]/30 border-[#1e3a8a]/50"
                                : "text-[#86efac] bg-[#14532d]/30 border-[#14532d]/50"
                            )}
                          >
                            {task.matchedRole === "user" ? "User" : "Agent"}
                          </span>
                          <span className="truncate text-white/60">
                            <HighlightMatch text={task.matchedSnippet!} query={query} />
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Show more results button for All tab when > 5 tasks exist */}
                {tab === "all" && filteredTasks.length > 5 && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12.5px] text-white/60 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer w-fit mt-0.5 border-none bg-transparent"
                    onClick={() => setTab("tasks")}
                  >
                    <span>Show more results</span>
                    <ChevronDown size={13} />
                  </button>
                )}
              </div>
            )}

            {/* Actions Section (No sub heading) */}
            {(tab === "all" || tab === "actions") && displayedActions.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {displayedActions.map((act) => {
                  const currentIndex = itemCursor++;
                  const isActive = currentIndex === selectedIndex;
                  return (
                    <button
                      key={act.id}
                      ref={(el) => {
                        itemRefs.current[currentIndex] = el;
                      }}
                      type="button"
                      className={cn(
                        "w-full h-9 flex items-center gap-2.5 px-2.5 rounded-lg text-left transition-colors duration-75 cursor-pointer text-white border-none",
                        isActive ? "bg-white/[0.08]" : "bg-transparent hover:bg-white/[0.08]"
                      )}
                      onClick={act.run}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                    >
                      <span className="text-white/65 shrink-0 flex items-center justify-center">
                        {act.icon}
                      </span>
                      <span className="text-[13.5px] font-normal text-white truncate flex-1 min-w-0">
                        <HighlightMatch text={act.title} query={query} />
                      </span>
                      {act.shortcut && (
                        <span className="text-[11px] text-white/50 bg-white/[0.07] border border-white/[0.08] px-1.5 py-0.5 rounded ml-auto shrink-0 font-sans">
                          {act.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {flatSelectableItems.length === 0 && (
              <div className="py-10 px-4 text-center flex flex-col items-center gap-1.5">
                <p className="text-sm font-medium text-white/70 m-0">
                  {t("commandPalette.noResults")}
                </p>
                <span className="text-xs text-white/40">
                  Try searching for chat titles, workspace names, or actions like "new chat"
                </span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
