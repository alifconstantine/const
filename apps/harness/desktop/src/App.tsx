import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  LogIn,
  Loader2,
  Globe,
  Copy,
  Check,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  Play,
  FileText,
  ChevronDown,
} from "lucide-react";
import { ConstLogoIcon, Button, toast, ScrollArea, cn } from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { ConvexClientProvider } from "./components/convex-provider";
import { Sidebar } from "./components/sidebar";
import { TopToolbar } from "./components/workbench/top-toolbar";
import {
  ChatCard,
  type ConversationMetrics,
  type ContextUsageData,
  type ModelItem,
  type AttachedFile,
  formatFileSize,
} from "./components/workbench/chat-card";
import { ChatIndicator } from "./components/workbench/chat-indicator";
import { ImageLightbox } from "./components/workbench/image-lightbox";
import { MarkdownContent } from "./components/workbench/markdown-content";
import { ExecutionTrace, MutationsSummaryCard } from "./components/workbench/execution-trace";
import { ApprovalCard, SmoothCardMorph } from "./components/workbench/approval-card";
import { QuestionCard } from "./components/workbench/question-card";
import { FloatingTodoCard } from "./components/workbench/floating-todo-card";
import { ReviewDialog } from "./components/workbench/review-dialog";
import { RenameTaskDialog } from "./components/workbench/rename-task-dialog";
import { TrajectoryDialog } from "./components/workbench/trajectory-dialog";
import { SettingsView } from "./components/settings-view";
import { ScheduledTasksView } from "./components/scheduled-tasks";
import { CommandPaletteModal } from "./components/command-palette-modal";
import { RightPane, type RightPaneTab, type RightPaneTabType, type BrowserSelectedElement } from "./components/right-pane";
import { useAppAuth } from "./components/convex-provider";
import { useConversationWidth } from "./lib/theme";
import {
  loadConversations,
  saveConversation,
  deleteConversation,
  renameConversation,
  archiveConversation,
  unarchiveConversation,
  pinConversation,
  initConversationStore,
  refreshConversationsFromDisk,
  generateFallbackTitle,
  generateAiTitle,
  normalizeUiMessages,
  type ConversationItem,
} from "./lib/conversation-store";
import type {
  FileMutationRecord,
  TraceStep,
  ApprovalRequestData,
  ApprovalDecision,
  BackgroundTaskItem,
  TodoItem,
  QuestionItem,
} from "./vite-env";
import authArt from "./assets/auth-art.jpg";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return "Morning, how can I help?";
  if (hour >= 12 && hour < 18) return "Afternoon, how can I help?";
  return "Evening, how can I help?";
}

function formatMessageTimestamp(ts: number): string {
  const d = new Date(ts);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = hours.toString().padStart(2, "0");
  return `${month}/${day} ${hoursStr}.${minutes} ${ampm}`;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  traceSteps?: TraceStep[];
  toolCalls?: Array<{
    id: string;
    name: string;
    args?: any;
    result?: any;
    isError?: boolean;
  }>;
  mutations?: FileMutationRecord[];
  timestamp: number;
  durationMs?: number;
  attachments?: AttachedFile[];
}

function AuthenticatedContent({
  onSignOut,
  onSwitchAccount,
}: {
  onSignOut: () => void;
  onSwitchAccount: () => void;
}) {
  const user = useQuery(api.auth.queries.currentUser, {});
  const { token } = useAppAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScheduledTasksOpen, setIsScheduledTasksOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isTrajectoryOpen, setIsTrajectoryOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>("general");
  const greeting = getGreeting();

  const handleOpenSettings = (tab: string = "general") => {
    const resolvedTab = tab === "model" ? "model-settings" : tab;
    setSettingsTab(resolvedTab);
    setIsSettingsOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    const handleOpenCommandPalette = () => setIsSearchOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("const:open-command-palette", handleOpenCommandPalette);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("const:open-command-palette", handleOpenCommandPalette);
    };
  }, []);

  // Conversation history & state
  const [conversations, setConversations] = useState<ConversationItem[]>(() => {
    return loadConversations();
  });

  useEffect(() => {
    initConversationStore().then((list) => {
      setConversations(list);
    });

    if (window.electron?.onConversationsChanged) {
      const unsubscribe = window.electron.onConversationsChanged(async (data) => {
        const refreshed = await refreshConversationsFromDisk();
        setConversations(refreshed);

        // If the changed conversation is currently open, reload its messages ONLY if currently empty in memory
        if (data?.conversationId && data.conversationId === conversationIdRef.current) {
          if (runningConvoIdsRef.current.has(data.conversationId)) {
            return;
          }
          if (messagesRef.current.length === 0 && window.electron?.getConversation) {
            const activeConvo = await window.electron.getConversation(data.conversationId);
            if (activeConvo && activeConvo.messages && activeConvo.messages.length > 0) {
              setMessages(normalizeUiMessages(activeConvo.messages) as any);
            }
          }
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const [conversationId, setConversationId] = useState<string>(
    () => `session_${Date.now()}`
  );
  const conversationIdRef = React.useRef(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);
  const [conversationTitle, setConversationTitle] = useState<string>("");
  const [currentProject, setCurrentProject] = useState<string>(() => {
    return localStorage.getItem("const_harness_current_project") || "Outside Project";
  });
  const [activeModelItem, setActiveModelItem] = useState<ModelItem | null>(null);
  const [lastKnownLlmUsage, setLastKnownLlmUsage] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null>(null);

  // Right Sidebar (Side Pane) state & tab management
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("const_harness_right_sidebar_open");
    return saved ? JSON.parse(saved) : false;
  });
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("const_harness_right_sidebar_width");
    return saved ? Number(saved) : 480;
  });
  const [rightPaneTabs, setRightPaneTabs] = useState<RightPaneTab[]>([]);
  const [activeRightPaneTabId, setActiveRightPaneTabId] = useState<string | null>(null);
  const [isOpeningNewTab, setIsOpeningNewTab] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("const_harness_right_sidebar_open", JSON.stringify(isRightSidebarOpen));
  }, [isRightSidebarOpen]);

  useEffect(() => {
    localStorage.setItem("const_harness_right_sidebar_width", String(rightSidebarWidth));
  }, [rightSidebarWidth]);

  const handleToggleRightSidebar = () => {
    setIsRightSidebarOpen((prev) => !prev);
  };

  // Background Tasks Management
  const [runningTasks, setRunningTasks] = useState<BackgroundTaskItem[]>([]);

  useEffect(() => {
    if (window.electron?.listBackgroundTasks) {
      window.electron.listBackgroundTasks().then((tasks) => {
        if (tasks) {
          setRunningTasks(tasks.filter((t) => t.status === "running"));
        }
      });
    }
    if (window.electron?.onBackgroundTaskEvent) {
      const unsub = window.electron.onBackgroundTaskEvent((event) => {
        if (window.electron?.listBackgroundTasks) {
          window.electron.listBackgroundTasks().then((tasks) => {
            if (tasks) {
              setRunningTasks(tasks.filter((t) => t.status === "running"));
            }
          });
        }
      });
      return () => unsub();
    }
  }, []);

  const handleSelectRunningTask = (task: BackgroundTaskItem) => {
    const tabId = `task_${task.id}`;
    const existingTab = rightPaneTabs.find((t) => t.id === tabId || t.taskId === task.id);
    if (existingTab) {
      setActiveRightPaneTabId(existingTab.id);
      setIsRightSidebarOpen(true);
      return;
    }
    const newTab: RightPaneTab = {
      id: tabId,
      title: task.command.length > 20 ? task.command.slice(0, 20) + "..." : task.command,
      type: "task_output",
      taskId: task.id,
      command: task.command,
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
    setIsRightSidebarOpen(true);
  };

  const handleStopBackgroundTask = async (taskId: string) => {
    if (window.electron?.killBackgroundTask) {
      await window.electron.killBackgroundTask(taskId);
      setRunningTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const handleOpenTerminal = async () => {
    setIsRightSidebarOpen(true);
    let resolvedCwd = currentProject === "Outside Project" ? undefined : currentProject;
    if (window.electron?.resolveWorkspacePath) {
      try {
        resolvedCwd = await window.electron.resolveWorkspacePath({
          project: currentProject,
          conversationId,
        });
      } catch {}
    }

    const baseTitle =
      currentProject !== "Outside Project"
        ? currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject
        : "outside";

    const existingMatchingTerm = rightPaneTabs.find(
      (t) =>
        t.type === "terminal" &&
        ((resolvedCwd && t.cwd === resolvedCwd) ||
          (t.project === currentProject &&
            (currentProject !== "Outside Project" || t.conversationId === conversationId)))
    );

    if (existingMatchingTerm) {
      setActiveRightPaneTabId(existingMatchingTerm.id);
      setIsOpeningNewTab(false);
      return;
    }

    const countWithBase = rightPaneTabs.filter(
      (t) => t.type === "terminal" && t.title.startsWith(baseTitle)
    ).length;
    const title = countWithBase === 0 ? baseTitle : `${baseTitle} (${countWithBase + 1})`;

    const newTab: RightPaneTab = {
      id: `terminal_${Date.now()}`,
      type: "terminal",
      title,
      cwd: resolvedCwd,
      project: currentProject,
      conversationId,
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
    setIsOpeningNewTab(false);
  };

  const handleOpenBrowser = (initialUrl?: any) => {
    setIsRightSidebarOpen(true);
    const resolvedUrl =
      typeof initialUrl === "string" && initialUrl.trim() && initialUrl !== "[object Object]"
        ? initialUrl.trim()
        : "https://www.google.com";

    const existingBrowser = rightPaneTabs.find((t) => t.type === "browser");
    if (existingBrowser) {
      if (
        typeof initialUrl === "string" &&
        initialUrl.trim() &&
        initialUrl !== "[object Object]" &&
        initialUrl !== existingBrowser.url
      ) {
        handleUpdateTab(existingBrowser.id, { url: resolvedUrl });
      }
      setActiveRightPaneTabId(existingBrowser.id);
      setIsOpeningNewTab(false);
      return;
    }

    const newTab: RightPaneTab = {
      id: `browser_${Date.now()}`,
      type: "browser",
      title: "Browser",
      url: resolvedUrl,
      project: currentProject,
      conversationId,
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
    setIsOpeningNewTab(false);
  };

  const handleUpdateTab = (tabId: string, updates: Partial<RightPaneTab>) => {
    setRightPaneTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t))
    );
  };

  const handleSelectElementForChat = (element: BrowserSelectedElement) => {
    const selectorLabel = element.id
      ? `#${element.id}`
      : element.className
      ? `${element.tag}.${element.className.split(" ")[0]}`
      : element.selector || element.tag;
    const details = [
      element.rect ? `${element.rect.width}x${element.rect.height}` : null,
      element.color ? `color: ${element.color}` : null,
      element.font ? `font: ${element.font}` : null,
      element.textSnippet ? `"${element.textSnippet}"` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const formatted = `@browser [${selectorLabel}] (${details})`;
    setEditingPrompt((prev) => (prev ? `${prev} ${formatted} ` : `${formatted} `));
  };

  const handleOpenTabType = async (type: RightPaneTabType) => {
    let title = "";
    let resolvedCwd = currentProject === "Outside Project" ? undefined : currentProject;
    if (type === "terminal") {
      if (window.electron?.resolveWorkspacePath) {
        try {
          resolvedCwd = await window.electron.resolveWorkspacePath({
            project: currentProject,
            conversationId,
          });
        } catch {}
      }
      const baseTitle =
        currentProject !== "Outside Project"
          ? currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject
          : "outside";

      const countWithBase = rightPaneTabs.filter(
        (t) => t.type === "terminal" && t.title.startsWith(baseTitle)
      ).length;
      title = countWithBase === 0 ? baseTitle : `${baseTitle} (${countWithBase + 1})`;
    } else if (type === "review") {
      const count = rightPaneTabs.filter((t) => t.type === type).length;
      title = count === 0 ? "Review" : `Review (${count + 1})`;
    } else if (type === "side_conversation") {
      const count = rightPaneTabs.filter((t) => t.type === type).length;
      title = count === 0 ? "Side chat" : `Side chat ${count + 1}`;
    } else {
      const count = rightPaneTabs.filter((t) => t.type === type).length;
      title = count === 0 ? "Browser" : `Browser ${count + 1}`;
    }

    const newTab: RightPaneTab = {
      id: `${type}_${Date.now()}`,
      type,
      title,
      url: type === "browser" ? "https://www.google.com" : undefined,
      cwd: resolvedCwd,
      project: currentProject,
      conversationId,
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
    setIsOpeningNewTab(false);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabIndex = rightPaneTabs.findIndex((t) => t.id === tabId);
    const tabToClose = rightPaneTabs.find((t) => t.id === tabId);
    if (tabToClose && tabToClose.type === "terminal") {
      window.electron?.terminal?.destroy(tabId);
    }
    const nextTabs = rightPaneTabs.filter((t) => t.id !== tabId);
    setRightPaneTabs(nextTabs);
    if (activeRightPaneTabId === tabId) {
      if (nextTabs.length > 0) {
        const nextActive = nextTabs[Math.min(tabIndex, nextTabs.length - 1)] ?? nextTabs[0];
        if (nextActive) {
          setActiveRightPaneTabId(nextActive.id);
          setIsOpeningNewTab(false);
        } else {
          setActiveRightPaneTabId(null);
          setIsOpeningNewTab(true);
        }
      } else {
        setActiveRightPaneTabId(null);
        setIsOpeningNewTab(true);
      }
    }
  };

  const handleNewTab = () => {
    setIsOpeningNewTab(true);
  };

  const handleReorderTabs = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setRightPaneTabs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      if (moved) {
        next.splice(toIndex, 0, moved);
      }
      return next;
    });
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = React.useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [sidebarReviewMutations, setSidebarReviewMutations] = useState<FileMutationRecord[] | null>(null);

  const allSessionMutations = useMemo(() => {
    const list: FileMutationRecord[] = [];
    for (const msg of messages) {
      if (msg.mutations) {
        list.push(...msg.mutations);
      }
    }
    return list;
  }, [messages]);

  const handleOpenFileDiff = (mutation: FileMutationRecord) => {
    setIsRightSidebarOpen(true);
    const filePath = mutation.filePath || mutation.targetFile;
    const fileName =
      filePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
      filePath ||
      "Diff";

    const existing = rightPaneTabs.find(
      (t) =>
        t.type === "file_diff" &&
        (t.filePath === filePath ||
          t.mutation?.targetFile === mutation.targetFile ||
          t.title === fileName)
    );

    if (existing) {
      setRightPaneTabs((prev) =>
        prev.map((t) =>
          t.id === existing.id
            ? {
                ...t,
                mutation,
                filePath,
                previousContent: mutation.previousContent,
                newContent: mutation.newContent,
              }
            : t
        )
      );
      setActiveRightPaneTabId(existing.id);
      setIsOpeningNewTab(false);
      return;
    }

    const newTab: RightPaneTab = {
      id: `diff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "file_diff",
      title: fileName,
      filePath,
      mutation,
      previousContent: mutation.previousContent,
      newContent: mutation.newContent,
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
    setIsOpeningNewTab(false);
  };

  const handleOpenFilePreview = (filePath: string, content?: string) => {
    setIsRightSidebarOpen(true);
    const fileName =
      filePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
      filePath ||
      "Preview";

    const existing = rightPaneTabs.find(
      (t) => t.type === "file_preview" && (t.filePath === filePath || t.title === fileName)
    );

    if (existing) {
      if (content !== undefined) {
        setRightPaneTabs((prev) =>
          prev.map((t) =>
            t.id === existing.id ? { ...t, filePath, newContent: content } : t
          )
        );
      }
      setActiveRightPaneTabId(existing.id);
      setIsOpeningNewTab(false);
      return;
    }

    const newTab: RightPaneTab = {
      id: `preview_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "file_preview",
      title: fileName,
      filePath,
      newContent: content,
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
    setIsOpeningNewTab(false);
  };

  const handleOpenReview = (mutationsToReview?: FileMutationRecord[]) => {
    setIsRightSidebarOpen(true);
    if (mutationsToReview && mutationsToReview.length > 0) {
      setSidebarReviewMutations(mutationsToReview);
    }
    const existing = rightPaneTabs.find((t) => t.type === "review");
    if (existing) {
      setActiveRightPaneTabId(existing.id);
      setIsOpeningNewTab(false);
      return;
    }

    const newTab: RightPaneTab = {
      id: `review_${Date.now()}`,
      type: "review",
      title: "Review",
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
    setIsOpeningNewTab(false);
  };

  const conversationsRef = React.useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const [runningConvoIds, setRunningConvoIds] = useState<Set<string>>(new Set());
  const runningConvoIdsRef = React.useRef(runningConvoIds);
  useEffect(() => {
    runningConvoIdsRef.current = runningConvoIds;
  }, [runningConvoIds]);
  const isExecuting = runningConvoIds.has(conversationId);
  const activeSessionMessagesRef = React.useRef<Map<string, ChatMessage[]>>(new Map());
  const executionStartTimeMapRef = React.useRef<Map<string, number>>(new Map());
  const [liveDurationMs, setLiveDurationMs] = useState<number>(0);
  const [pendingApprovals, setPendingApprovals] = useState<Map<string, ApprovalRequestData>>(new Map());
  const [isRespondingApproval, setIsRespondingApproval] = useState<boolean>(false);
  const activeApproval = pendingApprovals.get(conversationId);
  const [pendingQuestions, setPendingQuestions] = useState<
    Map<string, { toolCallId: string; questions: QuestionItem[] }>
  >(new Map());
  const activeQuestion = pendingQuestions.get(conversationId);
  const [conversationTodos, setConversationTodos] = useState<Map<string, TodoItem[]>>(new Map());

  const activeTodos = useMemo(() => {
    const fromMap = conversationTodos.get(conversationId);
    if (fromMap && fromMap.length > 0) return fromMap;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === "assistant" && msg.traceSteps) {
        for (let j = msg.traceSteps.length - 1; j >= 0; j--) {
          const st = msg.traceSteps[j];
          if (st && (st.name === "todo_write" || st.name === "todo") && st.args?.todos) {
            return st.args.todos as TodoItem[];
          }
        }
      }
    }
    return null;
  }, [conversationTodos, conversationId, messages]);

  const handleAnswerQuestion = async (toolCallId: string, answer: any) => {
    setPendingQuestions((prev) => {
      const next = new Map(prev);
      next.delete(conversationId);
      return next;
    });

    setMessages((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      const last = prev[lastIdx];
      if (!last || last.role !== "assistant") return prev;
      const steps = (last.traceSteps || []).map((st) =>
        st.type === "tool" && (st.toolCallId === toolCallId || st.id === toolCallId)
          ? { ...st, result: answer }
          : st
      );
      const tools = (last.toolCalls || []).map((tc) =>
        tc.id === toolCallId ? { ...tc, result: answer } : tc
      );
      const next = [...prev];
      next[lastIdx] = { ...last, traceSteps: steps, toolCalls: tools };
      return next;
    });

    if (window.electron?.answerQuestion) {
      await window.electron.answerQuestion(toolCallId, answer);
    }
  };

  useEffect(() => {
    if (!isExecuting) {
      setLiveDurationMs(0);
      return;
    }
    const startTime = executionStartTimeMapRef.current.get(conversationId) || Date.now();
    setLiveDurationMs(Date.now() - startTime);
    const interval = setInterval(() => {
      const start = executionStartTimeMapRef.current.get(conversationId);
      if (start) {
        setLiveDurationMs(Date.now() - start);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isExecuting, conversationId]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const [previewMedia, setPreviewMedia] = useState<AttachedFile | null>(null);
  const [reviewingMutations, setReviewingMutations] = useState<FileMutationRecord[] | null>(null);

  // Message hover actions state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "good" | "bad">>({});
  const [editingPrompt, setEditingPrompt] = useState<string>("");
  const [expandedUserMessageId, setExpandedUserMessageId] = useState<string | null>(null);

  // Close expanded user prompt when clicking outside
  useEffect(() => {
    if (!expandedUserMessageId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(`[data-expanded-prompt="${expandedUserMessageId}"]`)) {
        return;
      }
      setExpandedUserMessageId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [expandedUserMessageId]);

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleFeedback = (id: string, type: "good" | "bad") => {
    setFeedbackMap((prev) => ({
      ...prev,
      [id]: prev[id] === type ? undefined! : type,
    }));
    toast.success(type === "good" ? "Response marked as helpful" : "Feedback recorded");
  };

  const handleEditMessage = (content: string) => {
    setEditingPrompt(content);
    toast.info("Message loaded into prompt for editing");
  };

  const renderMessageAttachment = (att: AttachedFile) => {
    if (att.type === "image" && att.url) {
      return (
        <div
          key={att.id}
          onClick={() => setPreviewMedia(att)}
          className="group relative rounded-xl overflow-hidden border border-[#e2e2e4] dark:border-[#383838] hover:border-black/30 dark:hover:border-white/30 bg-[#f4f4f6] dark:bg-black/40 max-w-sm max-h-72 shadow-md cursor-pointer transition-all"
        >
          <img
            src={att.url}
            alt={att.name}
            className="w-full h-full object-contain max-h-72"
          />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white">
            <p className="truncate font-medium">{att.name}</p>
            <span className="text-[10px] text-[#a0a0a0] font-mono">
              {formatFileSize(att.size)}
            </span>
          </div>
        </div>
      );
    }
    if (att.type === "video" && att.url) {
      return (
        <div
          key={att.id}
          onClick={() => setPreviewMedia(att)}
          className="group relative rounded-xl overflow-hidden border border-[#e2e2e4] dark:border-[#383838] hover:border-black/30 dark:hover:border-white/30 bg-black max-w-sm max-h-72 shadow-md cursor-pointer transition-all"
        >
          <video
            src={att.url}
            className="w-full h-full max-h-72 rounded-xl pointer-events-none"
          />
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white">
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div
        key={att.id}
        onClick={() => setPreviewMedia(att)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-[#1e1e1e] hover:bg-[#f4f4f6] dark:hover:bg-[#252525] border border-[#e2e2e4] dark:border-[#383838] hover:border-black/20 dark:hover:border-white/20 text-xs text-[#262626] dark:text-[#d4d4d4] shadow-sm cursor-pointer transition-all"
      >
        <FileText className="w-4 h-4 text-[#e79737] dark:text-[#ff7a00] shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate max-w-[200px]" title={att.name}>
            {att.name}
          </span>
          <span className="text-[10px] text-[#a9a9a9] dark:text-[#777777] font-mono">
            {formatFileSize(att.size)}
          </span>
        </div>
      </div>
    );
  };

  // Clean display project name (e.g. "small-web" instead of full path)
  const displayProject = useMemo(() => {
    if (currentProject === "Outside Project") return "";
    return currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject;
  }, [currentProject]);

  // Dynamic Conversation Width classes (Default: 3xl/768px, Narrow: slightly wider at 640px, Wide: slightly narrower at 4xl/896px)
  const [conversationWidth] = useConversationWidth();

  const landingWidthClass = useMemo(() => {
    if (conversationWidth === "narrow") return "max-w-xl";
    if (conversationWidth === "wide") return "max-w-3xl";
    return "max-w-2xl";
  }, [conversationWidth]);

  const streamWidthClass = useMemo(() => {
    if (conversationWidth === "narrow") return "max-w-[640px]";
    if (conversationWidth === "wide") return "max-w-4xl";
    return "max-w-3xl";
  }, [conversationWidth]);

  const userBubbleWidthClass = useMemo(() => {
    if (conversationWidth === "narrow") return "max-w-xl";
    if (conversationWidth === "wide") return "max-w-3xl";
    return "max-w-2xl";
  }, [conversationWidth]);

  // Dynamic Context Usage computation (Image 3)
  const contextUsage = useMemo<ContextUsageData>(() => {
    // Exact estimate based on agent system prompt + registered tools
    // System prompt: ~850 tokens (const system prompt template)
    // Tools schemas: ~950 tokens (11 agent tools JSON schemas)
    const systemPromptTokens = 850;
    const toolsTokens = 950;

    // Estimate tokens dynamically from active conversation messages (chars / ~3.8)
    const messagesTokens = Math.round(
      messages.reduce((sum, msg) => {
        const contentChars = (msg.content || "").length;
        const thinkingChars = (msg.thinking || "").length;
        const toolCallsChars = msg.toolCalls ? JSON.stringify(msg.toolCalls).length : 0;
        let traceStepsChars = 0;
        if (msg.traceSteps) {
          for (const step of msg.traceSteps) {
            if (step.type === "tool" && step.result) {
              traceStepsChars += (typeof step.result === "string" ? step.result : JSON.stringify(step.result)).length;
            }
          }
        }
        let attachmentTokens = 0;
        if (msg.attachments) {
          for (const att of msg.attachments) {
            if (att.type === "image") attachmentTokens += 1600;
            else if (att.type === "video") attachmentTokens += 3200;
            else attachmentTokens += Math.round((att.size || 0) / 4);
          }
        }
        return sum + (contentChars + thinkingChars + toolCallsChars + traceStepsChars) / 3.8 + attachmentTokens;
      }, 0)
    );

    const modelLimit = activeModelItem?.contextWindow || 1_048_576;
    const totalTokens = modelLimit;

    // If we have verified ground-truth usage from the LLM provider API:
    let usedTokens: number;
    if (lastKnownLlmUsage && lastKnownLlmUsage.totalTokens > 0) {
      usedTokens = Math.max(lastKnownLlmUsage.totalTokens, systemPromptTokens + toolsTokens + messagesTokens);
    } else {
      usedTokens = systemPromptTokens + toolsTokens + messagesTokens;
    }

    return {
      usedTokens,
      totalTokens,
      systemPromptTokens,
      toolsTokens,
      messagesTokens,
    };
  }, [messages, activeModelItem, lastKnownLlmUsage]);

  const contextUsageRef = React.useRef(contextUsage);
  useEffect(() => {
    contextUsageRef.current = contextUsage;
  }, [contextUsage]);

  const activeModelItemRef = React.useRef(activeModelItem);
  useEffect(() => {
    activeModelItemRef.current = activeModelItem;
  }, [activeModelItem]);

  // Dynamic Conversation Metrics for footer bar (Image 2)
  const conversationMetrics = useMemo<ConversationMetrics | undefined>(() => {
    if (messages.length === 0) return undefined;

    const userMessages = messages.filter((m) => m.role === "user");
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const turns = Math.max(1, userMessages.length);

    let totalToolCalls = 0;
    for (const m of assistantMessages) {
      if (m.toolCalls) totalToolCalls += m.toolCalls.length;
    }
    const steps = Math.max(1, assistantMessages.length + totalToolCalls);

    // Dynamic estimation of execution durations & tokens
    const toolDurationMs = Math.max(1000, totalToolCalls * 1500);
    const estimatedLlmMs = Math.max(3000, turns * 4500 + totalToolCalls * 2000);

    const outputTokens = Math.max(
      32,
      Math.round(
        assistantMessages.reduce(
          (sum, m) => sum + (m.content?.length || 0) / 3.8 + (m.thinking?.length || 0) / 4,
          0
        )
      )
    );

    // Multi-turn context accumulates input tokens across turns
    const baseInputTokensPerTurn = 850 + 950;
    const messageInputTokens = Math.round(
      userMessages.reduce((sum, m) => sum + (m.content?.length || 0) / 3.8, 0)
    );
    const inputTokens = Math.max(
      1800,
      baseInputTokensPerTurn * turns + messageInputTokens + Math.round(outputTokens * 0.5)
    );

    const ttftSeconds = Math.max(1.2, +(1.2 + (turns > 3 ? 0.8 : 0.2)).toFixed(1));
    const tokPerSec =
      outputTokens > 0 && estimatedLlmMs > 0
        ? Math.max(25, Math.min(180, Math.round(outputTokens / (estimatedLlmMs / 1000))))
        : 58;
    const cacheHitRate = turns > 1 ? 76 : turns === 1 ? 64 : 0;

    return {
      turns,
      steps,
      llmDurationMs: estimatedLlmMs,
      toolDurationMs,
      ttftSeconds,
      tokPerSec,
      cacheHitRate,
      inputTokens,
      outputTokens,
    };
  }, [messages]);

  // Smart auto-scroll: pause when user scrolls up, resume when user is near bottom
  const isAutoScrollEnabledRef = useRef<boolean>(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);
  const lastProgrammaticScrollTimeRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);

  useEffect(() => {
    const scrollContainer = chatScrollRef.current;
    if (!scrollContainer) return;
    const viewport = (scrollContainer.querySelector("[data-radix-scroll-area-viewport]") ||
      scrollContainer) as HTMLElement;
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isScrollable = scrollHeight > clientHeight + 40;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const scrollTolerance = 40;

      const isProgrammatic = Date.now() - lastProgrammaticScrollTimeRef.current < 150;

      if (!isProgrammatic) {
        if (scrollTop < prevScrollTopRef.current) {
          isAutoScrollEnabledRef.current = false;
        } else if (distanceFromBottom < scrollTolerance) {
          isAutoScrollEnabledRef.current = true;
        }
      }

      // Hide if not scrollable or within 180px from bottom (matches const-ai threshold)
      if (distanceFromBottom <= 180 || !isScrollable) {
        setShowScrollBottomBtn(false);
      } else {
        setShowScrollBottomBtn(true);
      }

      prevScrollTopRef.current = scrollTop;
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        // User scrolled up with mousewheel -> immediately disable auto-scroll
        isAutoScrollEnabledRef.current = false;
        const { scrollTop, scrollHeight, clientHeight } = viewport;
        const isScrollable = scrollHeight > clientHeight + 40;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        if (isScrollable && distanceFromBottom > 80) {
          setShowScrollBottomBtn(true);
        }
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    viewport.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [messages.length > 0]);

  const scrollToBottom = () => {
    isAutoScrollEnabledRef.current = true;
    setShowScrollBottomBtn(false);
    lastProgrammaticScrollTimeRef.current = Date.now();
    const scrollContainer = chatScrollRef.current;
    const viewport = (scrollContainer?.querySelector("[data-radix-scroll-area-viewport]") ||
      scrollContainer) as HTMLElement | null;
    if (viewport) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "smooth",
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Auto scroll to bottom only when enabled
  useEffect(() => {
    if (messages.length > 0 && isAutoScrollEnabledRef.current) {
      const scrollContainer = chatScrollRef.current;
      const viewport = (scrollContainer?.querySelector("[data-radix-scroll-area-viewport]") ||
        scrollContainer) as HTMLElement | null;
      if (viewport) {
        lastProgrammaticScrollTimeRef.current = Date.now();
        viewport.scrollTop = viewport.scrollHeight;
        prevScrollTopRef.current = viewport.scrollTop;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" as any });
      }
    }
  }, [messages, isExecuting]);

  // Query active background sessions on mount & subscribe to session lifecycle
  useEffect(() => {
    if (window.electron?.getRunningSessions) {
      window.electron.getRunningSessions().then((ids) => {
        if (ids && ids.length > 0) {
          setRunningConvoIds(new Set(ids));
        }
      });
    }

    const unsubStarted = window.electron?.onSessionStarted?.((data) => {
      if (data?.conversationId) {
        setRunningConvoIds((prev) => new Set(prev).add(data.conversationId));
      }
    });

    const unsubEnded = window.electron?.onSessionEnded?.((data) => {
      if (data?.conversationId) {
        setRunningConvoIds((prev) => {
          const next = new Set(prev);
          next.delete(data.conversationId);
          return next;
        });
      }
    });

    return () => {
      unsubStarted?.();
      unsubEnded?.();
    };
  }, []);

  // Handle agent streaming events from Electron main process concurrently across all conversations
  useEffect(() => {
    if (!window.electron?.onAgentEvent) return;

    const unsubscribe = window.electron.onAgentEvent((event: any) => {
      const targetConvoId = event.conversationId || conversationIdRef.current;
      if (!targetConvoId) return;

      // Retrieve or initialize accumulated message list for this session
      let targetMsgs = activeSessionMessagesRef.current.get(targetConvoId);
      if (!targetMsgs) {
        if (targetConvoId === conversationIdRef.current) {
          targetMsgs = [...messagesRef.current];
        } else {
          const found = conversationsRef.current.find((c) => c.id === targetConvoId);
          targetMsgs = found?.messages ? [...found.messages] : [];
        }
      }

      if (event.type === "token") {
        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          const last = targetMsgs[lastIdx];
          if (last && last.role === "assistant") {
            // Finalize any open thought step so ThoughtItem auto-closes and freezes duration
            let steps = last.traceSteps;
            if (steps && steps.length > 0) {
              const lastStep = steps[steps.length - 1];
              if (lastStep && lastStep.type === "thought" && lastStep.startTime && !lastStep.durationMs) {
                steps = [...steps];
                steps[steps.length - 1] = {
                  ...lastStep,
                  durationMs: Math.max(1000, Date.now() - lastStep.startTime),
                };
              }
            }
            const updated: ChatMessage = {
              ...last,
              content: last.content + (event.token || ""),
              traceSteps: steps,
            };
            targetMsgs = [...targetMsgs];
            targetMsgs[lastIdx] = updated;
          }
        }
        activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);
        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }
      } else if (event.type === "token_reset") {
        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          const last = targetMsgs[lastIdx];
          if (last && last.role === "assistant") {
            const updated: ChatMessage = {
              ...last,
              content: "",
            };
            targetMsgs = [...targetMsgs];
            targetMsgs[lastIdx] = updated;
          }
        }
        activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);
        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }
      } else if (event.type === "thinking") {
        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          const last = targetMsgs[lastIdx];
          if (last && last.role === "assistant") {
            const steps: TraceStep[] = last.traceSteps ? [...last.traceSteps] : [];
            const lastStep = steps[steps.length - 1];
            if (lastStep && lastStep.type === "thought") {
              steps[steps.length - 1] = {
                ...lastStep,
                content: (lastStep.content || "") + (event.thinking || ""),
              };
            } else {
              steps.push({
                id: `thought_${Date.now()}_${steps.length}`,
                type: "thought",
                content: event.thinking || "",
                startTime: Date.now(),
              });
            }
            const updated: ChatMessage = {
              ...last,
              thinking: (last.thinking || "") + (event.thinking || ""),
              traceSteps: steps,
            };
            targetMsgs = [...targetMsgs];
            targetMsgs[lastIdx] = updated;
          }
        }
        activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);
        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }
      } else if (event.type === "tool_call") {
        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          const last = targetMsgs[lastIdx];
          if (last && last.role === "assistant") {
            const steps: TraceStep[] = last.traceSteps ? [...last.traceSteps] : [];
            const lastStep = steps[steps.length - 1];
            if (lastStep && lastStep.type === "thought" && lastStep.startTime && !lastStep.durationMs) {
              steps[steps.length - 1] = {
                ...lastStep,
                durationMs: Math.max(1000, Date.now() - lastStep.startTime),
              };
            }
            const callId = event.toolCallId || `tc_${Date.now()}_${steps.length}`;
            steps.push({
              id: callId,
              type: "tool",
              toolCallId: callId,
              name: event.toolName || "tool",
              args: event.args,
            });
            const tools = last.toolCalls ? [...last.toolCalls] : [];
            tools.push({
              id: callId,
              name: event.toolName || "tool",
              args: event.args,
            });
            const updated: ChatMessage = {
              ...last,
              toolCalls: tools,
              traceSteps: steps,
            };
            targetMsgs = [...targetMsgs];
            targetMsgs[lastIdx] = updated;
          }
        }
        activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);
        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }
      } else if (event.type === "tool_result") {
        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          const last = targetMsgs[lastIdx];
          if (last && last.role === "assistant") {
            const tools = (last.toolCalls || []).map((tc) =>
              tc.id === event.toolCallId
                ? { ...tc, result: event.result, isError: event.isError }
                : tc
            );
            const steps = (last.traceSteps || []).map((st) =>
              st.type === "tool" && (st.toolCallId === event.toolCallId || st.id === event.toolCallId)
                ? { ...st, result: event.result, isError: event.isError }
                : st
            );
            const updated: ChatMessage = {
              ...last,
              toolCalls: tools,
              traceSteps: steps,
            };
            targetMsgs = [...targetMsgs];
            targetMsgs[lastIdx] = updated;
          }
        }
        if (event.toolName === "ask_question") {
          setPendingQuestions((prev) => {
            if (!prev.has(targetConvoId)) return prev;
            const next = new Map(prev);
            next.delete(targetConvoId);
            return next;
          });
        }
        activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);
        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }
      } else if (event.type === "file_mutation") {
        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          const last = targetMsgs[lastIdx];
          if (last && last.role === "assistant") {
            const mutations = last.mutations ? [...last.mutations] : [];
            if (event.record) {
              mutations.push(event.record);
            }
            const steps = (last.traceSteps || []).map((st) => {
              if (st.type === "tool" && event.record && !st.mutation) {
                const norm = (st.name || "").toLowerCase().replace(/[-_]/g, "");
                if (norm.includes("write") || norm.includes("edit") || norm.includes("replace")) {
                  return { ...st, mutation: event.record };
                }
              }
              return st;
            });
            const updated: ChatMessage = {
              ...last,
              mutations,
              traceSteps: steps,
            };
            targetMsgs = [...targetMsgs];
            targetMsgs[lastIdx] = updated;
          }
        }
        activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);
        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }
      } else if (event.type === "usage") {
        const usage = event.usage || event;
        const promptTokens = Math.max(0, Math.round(Number(usage.promptTokens ?? usage.prompt_tokens ?? 0) || 0));
        const completionTokens = Math.max(0, Math.round(Number(usage.completionTokens ?? usage.completion_tokens ?? 0) || 0));
        const totalTokens = Math.max(0, Math.round(Number(usage.totalTokens ?? usage.total_tokens ?? (promptTokens + completionTokens)) || (promptTokens + completionTokens)));
        if (totalTokens > 0) {
          if (targetConvoId === conversationIdRef.current) {
            setLastKnownLlmUsage({ promptTokens, completionTokens, totalTokens });
          }
          const stored = loadConversations();
          const target = stored.find((c) => c.id === targetConvoId);
          if (target) {
            const sys = target.contextUsage?.systemPromptTokens ?? 850;
            const tls = target.contextUsage?.toolsTokens ?? 950;
            target.contextUsage = {
              usedTokens: totalTokens,
              totalTokens: target.contextUsage?.totalTokens || (activeModelItemRef.current?.contextWindow || 1_048_576),
              systemPromptTokens: sys,
              toolsTokens: tls,
              messagesTokens: Math.max(0, totalTokens - (sys + tls)),
            };
            saveConversation(target);
          }
        }
      } else if (event.type === "approval_request") {
        const approvalData: ApprovalRequestData = event.approval || {
          id: event.id || event.approvalId,
          approvalId: event.approvalId || event.id,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          command: event.command,
          args: event.args,
          cwd: event.cwd,
          description: event.description,
          reason: event.reason,
          createdAt: event.createdAt || event.timestamp || Date.now(),
          timestamp: event.timestamp || event.createdAt || Date.now(),
        };
        if (approvalData && (approvalData.id || approvalData.approvalId)) {
          setPendingApprovals((prev) => {
            const next = new Map(prev);
            next.set(targetConvoId, approvalData);
            return next;
          });
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 60);
        }
      } else if (event.type === "approval_resolved") {
        setPendingApprovals((prev) => {
          if (!prev.has(targetConvoId)) return prev;
          const next = new Map(prev);
          next.delete(targetConvoId);
          return next;
        });
      } else if (event.type === "todo_update") {
        setConversationTodos((prev) => {
          const next = new Map(prev);
          next.set(targetConvoId, event.todos);
          return next;
        });
        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          const last = targetMsgs[lastIdx];
          if (last && last.role === "assistant") {
            const steps: TraceStep[] = last.traceSteps ? [...last.traceSteps] : [];
            const existingIdx = steps.findIndex(
              (s) => s.name === "todo_write" || s.name === "todo"
            );
            if (existingIdx >= 0) {
              steps[existingIdx] = {
                ...steps[existingIdx]!,
                args: { todos: event.todos },
              };
            } else {
              steps.push({
                id: `todo_${Date.now()}`,
                type: "tool",
                toolCallId: `todo_${Date.now()}`,
                name: "todo_write",
                args: { todos: event.todos },
              });
            }
            const updated: ChatMessage = {
              ...last,
              traceSteps: steps,
            };
            targetMsgs = [...targetMsgs];
            targetMsgs[lastIdx] = updated;
          }
        }
        activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);
        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }
      } else if (event.type === "ask_question") {
        setPendingQuestions((prev) => {
          const next = new Map(prev);
          next.set(targetConvoId, {
            toolCallId: event.toolCallId,
            questions: event.questions,
          });
          return next;
        });
        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          const last = targetMsgs[lastIdx];
          if (last && last.role === "assistant") {
            const steps: TraceStep[] = last.traceSteps ? [...last.traceSteps] : [];
            const callId = event.toolCallId || `tc_q_${Date.now()}`;
            const existing = steps.find((s) => s.id === callId || s.toolCallId === callId);
            if (!existing) {
              steps.push({
                id: callId,
                type: "tool",
                toolCallId: callId,
                name: "ask_question",
                args: { questions: event.questions },
              });
              const tools = last.toolCalls ? [...last.toolCalls] : [];
              tools.push({
                id: callId,
                name: "ask_question",
                args: { questions: event.questions },
              });
              const updated: ChatMessage = {
                ...last,
                toolCalls: tools,
                traceSteps: steps,
              };
              targetMsgs = [...targetMsgs];
              targetMsgs[lastIdx] = updated;
            }
          }
        }
        activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);
        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }
      } else if (event.type === "task_started") {
        if (event.task) {
          setRunningTasks((prev) => {
            const filtered = prev.filter((t) => t.id !== event.task.id);
            return [...filtered, event.task];
          });
        }
      } else if (event.type === "task_stopped") {
        if (event.taskId) {
          setRunningTasks((prev) => prev.filter((t) => t.id !== event.taskId));
        }
      } else if (event.type === "done") {
        setRunningConvoIds((prev) => {
          const next = new Set(prev);
          next.delete(targetConvoId);
          return next;
        });

        setPendingApprovals((prev) => {
          if (!prev.has(targetConvoId)) return prev;
          const next = new Map(prev);
          next.delete(targetConvoId);
          return next;
        });

        const startTime = executionStartTimeMapRef.current.get(targetConvoId);
        const finalDuration = startTime ? Date.now() - startTime : undefined;
        executionStartTimeMapRef.current.delete(targetConvoId);

        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          if (targetMsgs[lastIdx]?.role === "assistant") {
            const curContent = targetMsgs[lastIdx].content;
            const steps = (targetMsgs[lastIdx].traceSteps || []).map((st) => {
              if (st.type === "thought" && st.startTime && !st.durationMs) {
                return {
                  ...st,
                  durationMs: Math.max(1000, Date.now() - st.startTime),
                };
              }
              return st;
            });
            const lastMsg = targetMsgs[lastIdx];
            if (lastMsg) {
              targetMsgs = [...targetMsgs];
              targetMsgs[lastIdx] = {
                ...lastMsg,
                id: lastMsg.id || `msg_${Date.now()}_assistant`,
                role: "assistant",
                content: event.fullContent || curContent || "",
                durationMs: finalDuration,
                traceSteps: steps,
              };
            }
          }
        }
        activeSessionMessagesRef.current.delete(targetConvoId);

        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }

        const stored = loadConversations();
        const target = stored.find((c) => c.id === targetConvoId);
        if (target) {
          target.messages = targetMsgs;
          target.updatedAt = Date.now();
          target.contextUsage = contextUsageRef.current;
          saveConversation(target);
          setConversations(loadConversations());
        }
      } else if (event.type === "error") {
        setRunningConvoIds((prev) => {
          const next = new Set(prev);
          next.delete(targetConvoId);
          return next;
        });

        setPendingApprovals((prev) => {
          if (!prev.has(targetConvoId)) return prev;
          const next = new Map(prev);
          next.delete(targetConvoId);
          return next;
        });

        setPendingQuestions((prev) => {
          if (!prev.has(targetConvoId)) return prev;
          const next = new Map(prev);
          next.delete(targetConvoId);
          return next;
        });

        const startTime = executionStartTimeMapRef.current.get(targetConvoId);
        const finalDuration = startTime ? Math.max(1000, Date.now() - startTime) : undefined;
        executionStartTimeMapRef.current.delete(targetConvoId);

        const errorText = event.error || "Agent execution stopped";
        const isUserCancelled =
          errorText.toLowerCase().includes("user cancelled") ||
          errorText.toLowerCase().includes("abort");

        if (targetMsgs.length > 0) {
          const lastIdx = targetMsgs.length - 1;
          const lastMsg = targetMsgs[lastIdx];
          if (lastMsg && lastMsg.role === "assistant") {
            const steps: TraceStep[] = (lastMsg.traceSteps || []).map((st) => {
              if (st.type === "thought" && st.startTime && !st.durationMs) {
                return {
                  ...st,
                  durationMs: Math.max(1000, Date.now() - st.startTime),
                };
              }
              if (st.type === "tool" && !st.result) {
                return {
                  ...st,
                  result: isUserCancelled ? "Cancelled by user." : "Tool failed due to error.",
                  isError: true,
                  durationMs: st.durationMs || 1000,
                };
              }
              return st;
            });

            if (steps.length === 0) {
              steps.push({
                id: `thought_err_${Date.now()}`,
                type: "thought",
                content: lastMsg.thinking || (isUserCancelled ? "Task execution stopped by user." : errorText),
                durationMs: finalDuration || lastMsg.durationMs || 1000,
              });
            }

            let finalContent = lastMsg.content ? lastMsg.content.trim() : "";
            if (!finalContent) {
              finalContent = isUserCancelled ? "User cancelled agent execution." : errorText;
            } else if (
              !finalContent.includes(errorText) &&
              !finalContent.includes("User cancelled")
            ) {
              finalContent = `${finalContent}\n\n${isUserCancelled ? "User cancelled agent execution." : errorText}`;
            }

            targetMsgs = [...targetMsgs];
            targetMsgs[lastIdx] = {
              ...lastMsg,
              id: lastMsg.id || `msg_${Date.now()}_assistant`,
              role: "assistant",
              content: finalContent,
              durationMs: finalDuration || lastMsg.durationMs || 1000,
              traceSteps: steps,
            };
          } else {
            const newAssistantMsg: ChatMessage = {
              id: `msg_${Date.now()}_assistant`,
              role: "assistant",
              content: isUserCancelled ? "User cancelled agent execution." : errorText,
              durationMs: finalDuration || 1000,
              timestamp: Date.now(),
              traceSteps: [
                {
                  id: `thought_err_${Date.now()}`,
                  type: "thought",
                  content: isUserCancelled ? "Task execution stopped by user." : errorText,
                  durationMs: finalDuration || 1000,
                },
              ],
            };
            targetMsgs = [...targetMsgs, newAssistantMsg];
          }
        }

        activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);

        if (targetConvoId === conversationIdRef.current) {
          setMessages(targetMsgs);
        }

        const stored = loadConversations();
        const target = stored.find((c) => c.id === targetConvoId);
        if (target) {
          target.messages = targetMsgs;
          target.updatedAt = Date.now();
          saveConversation(target);
          setConversations(loadConversations());
        }

        if (isUserCancelled) {
          // Handled without error notification
        } else {
          toast.error(event.error || "Agent execution error");
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSendMessage = async ({
    prompt,
    project,
    mode,
    model,
    thinkingLevel,
    attachments,
    maxOutputTokens,
  }: {
    prompt: string;
    project: string;
    mode: "ask_before_changes" | "full_access";
    model?: string;
    thinkingLevel?: string;
    attachments?: AttachedFile[];
    maxOutputTokens?: number;
  }) => {
    if ((!prompt.trim() && (!attachments || attachments.length === 0)) || isExecuting) return;

    setEditingPrompt("");

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      attachments,
    };

    const assistantPlaceholder: ChatMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: "assistant",
      content: "",
      thinking: "",
      traceSteps: [],
      toolCalls: [],
      mutations: [],
      timestamp: Date.now(),
    };

    const currentStreamMessages = [...messages, userMsg];
    const initialSessionMsgs = [...currentStreamMessages, assistantPlaceholder];
    setMessages(initialSessionMsgs);
    setRunningConvoIds((prev) => new Set(prev).add(conversationId));
    executionStartTimeMapRef.current.set(conversationId, Date.now());
    activeSessionMessagesRef.current.set(conversationId, initialSessionMsgs);
    setLiveDurationMs(0);

    const isFirstMessage = messages.length === 0;
    let titleToUse = conversationTitle;

    if (isFirstMessage) {
      titleToUse = prompt.trim()
        ? generateFallbackTitle(prompt)
        : attachments && attachments[0]
        ? `Attachment: ${attachments[0].name}`
        : "New task";
      setConversationTitle(titleToUse);

      // Asynchronously request AI to generate an ultra-clean title
      generateAiTitle(
        prompt || (attachments && attachments[0]?.name) || "New task",
        (aiTitle) => {
          setConversationTitle(aiTitle);
          const stored = loadConversations();
          const target = stored.find((c) => c.id === conversationId);
          if (target) {
            target.title = aiTitle;
            target.updatedAt = Date.now();
            saveConversation(target);
            setConversations(loadConversations());
          }
        },
        token || undefined
      );
    }

    const updatedConvo: ConversationItem = {
      id: conversationId,
      title: titleToUse || "New task",
      project: project,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: currentStreamMessages,
      contextUsage: contextUsage,
    };
    saveConversation(updatedConvo);
    setConversations(loadConversations());

    if (window.electron?.sendMessage) {
      try {
        const payloadMessages = currentStreamMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await window.electron.sendMessage({
          messages: payloadMessages,
          model,
          thinkingLevel,
          workspacePath: project,
          mode,
          conversationId,
          authToken: token || undefined,
          maxOutputTokens,
        });

        if (!res.success && res.error) {
          if (!res.aborted && !res.error.toLowerCase().includes("cancelled") && !res.error.toLowerCase().includes("abort")) {
            toast.error(res.error);
          }
          setRunningConvoIds((prev) => {
            const next = new Set(prev);
            next.delete(conversationId);
            return next;
          });
          activeSessionMessagesRef.current.delete(conversationId);
        }
      } catch (err: any) {
        if (!err.message?.toLowerCase().includes("cancelled") && !err.message?.toLowerCase().includes("abort")) {
          toast.error(err.message || "Communication error with agent");
        }
        setRunningConvoIds((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
        activeSessionMessagesRef.current.delete(conversationId);
      }
    } else {
      setTimeout(() => {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
          const next = [...prev];
          const updated: ChatMessage = {
            ...last,
            content: "Const Agent is ready! Running with complete workspace integration.",
          };
          next[lastIdx] = updated;
          return next;
        });
        setRunningConvoIds((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
        activeSessionMessagesRef.current.delete(conversationId);
      }, 600);
    }
  };

  const handleRollback = async (record: FileMutationRecord) => {
    if (!window.electron?.rollbackFile) {
      toast.error("Rollback is only available in the desktop application");
      return;
    }
    try {
      const res = await window.electron.rollbackFile(record);
      if (res.success) {
        toast.success(res.message || `Reverted ${record.targetFile}`);
        setMessages((prev) => {
          const next = prev.map((msg) => ({
            ...msg,
            mutations: msg.mutations?.map((m) =>
              m.id === record.id ? { ...m, rolledBack: true } : m
            ),
          }));
          const stored = loadConversations();
          const target = stored.find((c) => c.id === conversationId);
          if (target) {
            target.messages = next;
            target.updatedAt = Date.now();
            saveConversation(target);
            setConversations(loadConversations());
          }
          return next;
        });
      } else {
        toast.error(res.message || `Failed to rollback ${record.targetFile}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Rollback error");
    }
  };

  const handleRollbackAll = async (records: FileMutationRecord[]) => {
    if (!window.electron?.rollbackFile) {
      toast.error("Rollback is only available in the desktop application");
      return;
    }
    const unrolled = records.filter((r) => !r.rolledBack);
    if (unrolled.length === 0) {
      toast.info("All changes have already been reverted");
      return;
    }
    let successCount = 0;
    const revertedIds = new Set<string>();
    for (const record of [...unrolled].reverse()) {
      try {
        const res = await window.electron.rollbackFile(record);
        if (res.success) {
          successCount++;
          revertedIds.add(record.id);
        }
      } catch {}
    }
    if (successCount > 0) {
      toast.success(`Reverted ${successCount} file(s)`);
      setMessages((prev) => {
        const next = prev.map((msg) => ({
          ...msg,
          mutations: msg.mutations?.map((m) =>
            revertedIds.has(m.id) ? { ...m, rolledBack: true } : m
          ),
        }));
        const stored = loadConversations();
        const target = stored.find((c) => c.id === conversationId);
        if (target) {
          target.messages = next;
          target.updatedAt = Date.now();
          saveConversation(target);
          setConversations(loadConversations());
        }
        return next;
      });
    }
  };

  const handleAbort = async (targetId?: string) => {
    const rawTarget =
      typeof targetId === "string" && targetId.trim().length > 0
        ? targetId.trim()
        : null;
    const currentId = conversationIdRef.current || conversationId;
    const idToAbort = rawTarget || currentId;

    // 1. Immediately transition UI out of executing mode
    setRunningConvoIds((prev) => {
      const next = new Set(prev);
      if (rawTarget) next.delete(rawTarget);
      if (currentId) next.delete(currentId);
      if (idToAbort) next.delete(idToAbort);
      return next;
    });
    setPendingApprovals((prev) => {
      const next = new Map(prev);
      if (rawTarget) next.delete(rawTarget);
      if (currentId) next.delete(currentId);
      if (idToAbort) next.delete(idToAbort);
      return next;
    });
    setPendingQuestions((prev) => {
      const next = new Map(prev);
      if (rawTarget) next.delete(rawTarget);
      if (currentId) next.delete(currentId);
      if (idToAbort) next.delete(idToAbort);
      return next;
    });

    // 2. Capture and freeze execution duration
    const startTime =
      (idToAbort ? executionStartTimeMapRef.current.get(idToAbort) : undefined) ||
      (currentId ? executionStartTimeMapRef.current.get(currentId) : undefined);
    const finalDuration = startTime ? Math.max(1000, Date.now() - startTime) : 1000;
    if (idToAbort) executionStartTimeMapRef.current.delete(idToAbort);
    if (currentId) executionStartTimeMapRef.current.delete(currentId);

    // 3. Finalize assistant message and preserve execution trace
    let sessionMsgs =
      (idToAbort ? activeSessionMessagesRef.current.get(idToAbort) : undefined) ||
      (currentId ? activeSessionMessagesRef.current.get(currentId) : undefined) ||
      messagesRef.current ||
      [];
    if (sessionMsgs && sessionMsgs.length > 0) {
      const lastIdx = sessionMsgs.length - 1;
      const last = sessionMsgs[lastIdx];
      if (last && last.role === "assistant") {
        const steps: TraceStep[] = (last.traceSteps || []).map((st) => {
          if (st.type === "thought" && st.startTime && !st.durationMs) {
            return {
              ...st,
              durationMs: Math.max(1000, Date.now() - st.startTime),
            };
          }
          if (st.type === "tool" && !st.result) {
            return {
              ...st,
              result: "Command or tool cancelled by user.",
              isError: true,
              durationMs: st.durationMs || 1000,
            };
          }
          return st;
        });

        // Ensure at least one trace step is present so ExecutionTrace accordion renders "Worked for Xs >"
        if (steps.length === 0) {
          steps.push({
            id: `thought_cancel_${Date.now()}`,
            type: "thought",
            content: last.thinking || "Task execution stopped by user.",
            durationMs: finalDuration,
          });
        }

        const cancelNote = "User cancelled agent execution.";
        const curContent = last.content ? last.content.trim() : "";
        const finalContent = curContent
          ? (curContent.includes(cancelNote) ? curContent : `${curContent}\n\n${cancelNote}`)
          : cancelNote;

        const updatedMsgs = [...sessionMsgs];
        updatedMsgs[lastIdx] = {
          ...last,
          id: last.id || `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: finalContent,
          durationMs: finalDuration || last.durationMs || 1000,
          traceSteps: steps,
        };
        sessionMsgs = updatedMsgs;
      } else {
        // Assistant message hasn't been added yet, add cancelled assistant message
        const newAssistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: "User cancelled agent execution.",
          durationMs: finalDuration,
          timestamp: Date.now(),
          traceSteps: [
            {
              id: `thought_cancel_${Date.now()}`,
              type: "thought",
              content: "Task execution stopped by user.",
              durationMs: finalDuration,
            },
          ],
        };
        sessionMsgs = [...sessionMsgs, newAssistantMsg];
      }

      if (idToAbort) activeSessionMessagesRef.current.set(idToAbort, sessionMsgs);
      if (currentId) activeSessionMessagesRef.current.set(currentId, sessionMsgs);

      setMessages(sessionMsgs);

      const stored = loadConversations();
      const target = stored.find((c) => c.id === idToAbort || c.id === currentId);
      if (target) {
        target.messages = sessionMsgs;
        target.updatedAt = Date.now();
        saveConversation(target);
        setConversations(loadConversations());
      }
    }

    // 4. Trigger backend abort in parallel to kill process trees and terminate LLM stream
    if (window.electron?.abortAgent) {
      window.electron.abortAgent(idToAbort).catch(() => {});
    }

    toast.info("Agent execution stopped");
  };

  const handleRespondApproval = async (
    approvalId: string,
    decision: ApprovalDecision,
    feedback?: string
  ) => {
    if (!window.electron?.respondApproval) return;
    setIsRespondingApproval(true);
    try {
      const res = await window.electron.respondApproval({
        conversationId,
        approvalId,
        decision,
        feedback,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to submit approval response");
      } else {
        setPendingApprovals((prev) => {
          const next = new Map(prev);
          next.delete(conversationId);
          return next;
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit approval response");
    } finally {
      setIsRespondingApproval(false);
    }
  };

  const handleNewChat = (targetProject?: string) => {
    setIsScheduledTasksOpen(false);
    setMessages([]);
    setConversationTitle("");
    setConversationId(`session_${Date.now()}`);
    setEditingPrompt("");
    setLastKnownLlmUsage(null);
    if (targetProject) {
      setCurrentProject(targetProject);
      localStorage.setItem("const_harness_current_project", targetProject);
    }
  };

  const handleSelectConversation = async (id: string) => {
    setIsScheduledTasksOpen(false);

    // If this conversation is currently executing in background, restore its live session messages
    const activeRunningMsgs = activeSessionMessagesRef.current.get(id);
    if (activeRunningMsgs) {
      let target = conversations.find((c) => c.id === id);
      setConversationId(id);
      setConversationTitle(target?.title || "Task");
      setCurrentProject(target?.project || "Outside Project");
      setMessages([...activeRunningMsgs]);
      setEditingPrompt("");
      if (target?.contextUsage?.usedTokens) {
        setLastKnownLlmUsage({
          promptTokens: target.contextUsage.usedTokens,
          completionTokens: 0,
          totalTokens: target.contextUsage.usedTokens,
        });
      } else {
        setLastKnownLlmUsage(null);
      }
      return;
    }

    let target = conversations.find((c) => c.id === id);
    if (!target && window.electron?.getConversation) {
      const diskConvo = await window.electron.getConversation(id);
      if (diskConvo) {
        target = diskConvo;
        const refreshed = await refreshConversationsFromDisk();
        setConversations(refreshed);
      }
    }
    if (target) {
      setConversationId(target.id);
      setConversationTitle(target.title);
      setCurrentProject(target.project || "Outside Project");
      setMessages(normalizeUiMessages(target.messages || []));
      setEditingPrompt("");
      if (target.contextUsage?.usedTokens) {
        setLastKnownLlmUsage({
          promptTokens: target.contextUsage.usedTokens,
          completionTokens: 0,
          totalTokens: target.contextUsage.usedTokens,
        });
      } else {
        setLastKnownLlmUsage(null);
      }
    }
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    const updated = loadConversations();
    setConversations(updated);
    if (id === conversationId) {
      handleNewChat();
    }
  };

  const handleRenameConversation = (id: string, title: string) => {
    renameConversation(id, title);
    const updated = loadConversations();
    setConversations(updated);
    if (id === conversationId) {
      setConversationTitle(title);
    }
  };

  const handleArchiveConversation = (id: string) => {
    archiveConversation(id);
    const updated = loadConversations();
    setConversations(updated);
    if (id === conversationId) {
      handleNewChat();
    }
    toast.success("Conversation archived");
  };

  const handleUnarchiveConversation = async (id: string) => {
    await unarchiveConversation(id);
    const updated = loadConversations();
    setConversations(updated);
    toast.success("Conversation restored");
  };

  const handleTogglePinConversation = async (id: string) => {
    const target = conversations.find((c) => c.id === id);
    const nextPinned = !target?.isPinned;
    await pinConversation(id, nextPinned);
    const updated = loadConversations();
    setConversations(updated);
    toast.success(nextPinned ? "Task pinned" : "Task unpinned");
  };

  const handleOpenWorkspaceFromPalette = async () => {
    if (window.electron?.openDirectoryDialog) {
      const selectedDir = await window.electron.openDirectoryDialog();
      if (selectedDir) {
        setCurrentProject(selectedDir);
        localStorage.setItem("const_harness_current_project", selectedDir);
        const existingRaw = localStorage.getItem("const_harness_workspaces");
        let list: string[] = [];
        try {
          list = existingRaw ? JSON.parse(existingRaw) : [];
        } catch {}
        if (!list.includes(selectedDir)) {
          list.unshift(selectedDir);
          localStorage.setItem("const_harness_workspaces", JSON.stringify(list));
        }
        handleNewChat(selectedDir);
      }
    }
  };

  if (isSettingsOpen) {
    return (
      <SettingsView
        initialTab={settingsTab}
        onBackToWorkspace={() => setIsSettingsOpen(false)}
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
      />
    );
  }

  return (
    <div className="h-full w-full max-w-full flex bg-[#ececee] dark:bg-[#2b2b2b] text-[#262626] dark:text-[#d4d4d4] overflow-hidden select-none">
      {/* Left Sidebar (Only visible when isSidebarOpen = true) */}
      {isSidebarOpen && (
        <Sidebar
          user={user}
          onSignOut={onSignOut}
          onSwitchAccount={onSwitchAccount}
          onCollapse={() => setIsSidebarOpen(false)}
          onNewChat={handleNewChat}
          onNewChatOutside={() => handleNewChat("Outside Project")}
          conversations={conversations}
          activeConversationId={conversationId}
          runningConvoIds={runningConvoIds}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onArchiveConversation={handleArchiveConversation}
          onUnarchiveConversation={handleUnarchiveConversation}
          onOpenSettings={(tab) => handleOpenSettings(tab || "general")}
          onOpenScheduledTasks={() => setIsScheduledTasksOpen(true)}
          isScheduledTasksActive={isScheduledTasksOpen}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      )}

      {/* Main Content Area: Background #f8f8f8 (light) / #161616 (dark), text #262626 / #d4d4d4 */}
      <main
        className={`flex-1 min-w-0 h-full bg-[#f8f8f8] dark:bg-[#161616] text-[#262626] dark:text-[#d4d4d4] overflow-hidden flex flex-col relative transition-[border-radius] duration-200 ${
          isSidebarOpen ? "rounded-l-2xl sm:rounded-l-3xl border-l border-[#dedee2] dark:border-[#333333]/40" : ""
        }`}
      >
        {isScheduledTasksOpen ? (
          <ScheduledTasksView
            onBackToWorkspace={() => setIsScheduledTasksOpen(false)}
            onOpenSession={(sessionId) => {
              setIsScheduledTasksOpen(false);
              handleSelectConversation(sessionId);
            }}
            currentWorkspacePath={currentProject === "Outside Project" ? undefined : currentProject}
          />
        ) : (
          <>
            {(() => {
              const activeConvo = conversations.find((c) => c.id === conversationId);
              return (
                <TopToolbar
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                  onNewChat={handleNewChat}
                  conversationTitle={conversationTitle}
                  project={displayProject}
                  conversationId={conversationId}
                  isPinned={Boolean(activeConvo?.isPinned)}
                  workspacePath={currentProject === "Outside Project" ? undefined : currentProject}
                  onTogglePin={() => handleTogglePinConversation(conversationId)}
                  onOpenRename={() => setIsRenameDialogOpen(true)}
                  onArchive={() => handleArchiveConversation(conversationId)}
                  onOpenSettings={handleOpenSettings}
                  onOpenTrajectory={() => setIsTrajectoryOpen(true)}
                  isRightSidebarOpen={isRightSidebarOpen}
                  onToggleRightSidebar={handleToggleRightSidebar}
                  onOpenTerminal={handleOpenTerminal}
                  onOpenBrowser={handleOpenBrowser}
                />
              );
            })()}

            {/* Main Workbench Body: Center Conversation Canvas + Collapsible Right Sidebar */}
            <div className="flex-1 min-w-0 flex flex-row overflow-hidden relative">
              <div className="flex-1 min-w-0 h-full flex flex-col relative overflow-hidden">
                {/* Dynamic Canvas: Landing Layout when 0 messages vs Active Stream Layout */}
                {messages.length === 0 ? (
          <div className="flex-1 min-w-0 relative flex flex-col items-center justify-center px-3.5 sm:px-6 md:px-8 pt-6 pb-6 overflow-y-auto">
            {/* Centered Conversation Container */}
            <div className={cn("relative flex flex-col items-center w-full max-w-full z-10 translate-y-6 sm:translate-y-8", landingWidthClass)}>

              {/* Greeting Text */}
              <h1 className="text-2xl sm:text-[28px] font-medium tracking-tight text-[#262626] dark:text-[#d4d4d4] text-center mb-6 z-10 font-sans">
                {greeting}
              </h1>

              {/* Floating Chat Input Card */}
              <div className="w-full max-w-full z-10 min-w-0">
                <ChatCard
                  onSendMessage={handleSendMessage}
                  isExecuting={isExecuting}
                  onAbort={() => handleAbort()}
                  showContextUsage={false}
                  project={currentProject}
                  onProjectChange={setCurrentProject}
                  onOpenSettings={(tab) => handleOpenSettings(tab || "model-settings")}
                  initialPrompt={editingPrompt}
                  onModelChange={setActiveModelItem}
                  runningTasks={runningTasks}
                  onSelectTask={handleSelectRunningTask}
                  onStopTask={handleStopBackgroundTask}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col relative">
            {/* Left Vertical Mini-Timeline Navigator (TurnTimelineNav matching const-harness) */}
            <ChatIndicator
              messages={messages}
              isExecuting={isExecuting}
              scrollContainerRef={chatScrollRef}
            />

            {/* Floating Todo List Card matching Image 1 */}
            {activeTodos && activeTodos.length > 0 && (
              <FloatingTodoCard
                todos={activeTodos}
                isExecuting={isExecuting}
              />
            )}

            {/* Scrollable Message Stream with @const/ui ScrollArea */}
            <ScrollArea
              ref={chatScrollRef}
              data-chat-viewport="true"
              className="flex-1 w-full h-full min-w-0 [&>div>div[style]]:!block"
            >
              <div className={cn("w-full max-w-full mx-auto px-3.5 sm:px-6 md:px-8 py-6 flex flex-col gap-6", streamWidthClass)}>
                {messages.map((msg, idx) => (
                  <div key={msg.id} data-chat-anchor-key={msg.id} className="w-full flex flex-col">
                    {msg.role === "user" ? (
                      <div className="w-full flex flex-col items-end group">
                        {/* Attached Files (if any) */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={cn("flex flex-wrap gap-2 mb-2 justify-end", userBubbleWidthClass)}>
                            {msg.attachments.map((att) => renderMessageAttachment(att))}
                          </div>
                        )}
                        {/* User message bubble (Image 2 collapsed, Image 3 expanded on click, closes on click outside) */}
                        {(() => {
                          const isLongPrompt = msg.content.length > 250 || msg.content.split("\n").length > 4;
                          const isExpanded = expandedUserMessageId === msg.id;

                          return (
                            <div
                              data-expanded-prompt={msg.id}
                              onClick={() => {
                                const sel = window.getSelection();
                                if (sel && sel.toString().trim().length > 0) return;
                                // Only expand if currently collapsed; closing is handled by clicking outside
                                if (isLongPrompt && !isExpanded) {
                                  setExpandedUserMessageId(msg.id);
                                }
                              }}
                              className={cn(
                                "w-full rounded-2xl bg-[#f0f0f0] dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] px-4 py-3 text-[14px] text-[#262626] dark:text-[#ececec] select-text leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] shadow-xs overflow-hidden transition-all duration-200",
                                userBubbleWidthClass,
                                isLongPrompt && !isExpanded && "cursor-pointer hover:border-[#b0b0b0] dark:hover:border-[#484848]"
                              )}
                            >
                              {isLongPrompt ? (
                                <ScrollArea
                                  className={cn(
                                    "w-full transition-[max-height] duration-200 ease-in-out",
                                    isExpanded ? "max-h-[380px]" : "max-h-24"
                                  )}
                                  viewportClassName="[&>div[style]]:!block"
                                >
                                  <div className="pr-2">{msg.content}</div>
                                </ScrollArea>
                              ) : (
                                <div>{msg.content}</div>
                              )}
                            </div>
                          );
                        })()}
                        {/* User hover action bar: Timestamp, Copy, Edit */}
                        <div className="flex items-center gap-2 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[#a9a9a9] dark:text-[#888888] select-none">
                          <span className="text-[11px] font-mono text-[#a9a9a9] dark:text-[#777777]">
                            {formatMessageTimestamp(msg.timestamp)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer"
                            title="Copy message"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditMessage(msg.content)}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer"
                            title="Edit message"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-2.5 group">
                        <ExecutionTrace
                          thinking={msg.thinking}
                          toolCalls={msg.toolCalls}
                          traceSteps={msg.traceSteps}
                          mutations={msg.mutations}
                          isExecuting={isExecuting && idx === messages.length - 1}
                          pendingApprovalToolCallId={
                            isExecuting && idx === messages.length - 1
                              ? activeApproval?.toolCallId
                              : undefined
                          }
                          durationMs={
                            isExecuting && idx === messages.length - 1
                              ? liveDurationMs
                              : msg.durationMs
                          }
                          onRollback={handleRollback}
                          onRollbackAll={handleRollbackAll}
                          onAnswerQuestion={handleAnswerQuestion}
                          onOpenFileDiff={handleOpenFileDiff}
                          onOpenFilePreview={handleOpenFilePreview}
                          onOpenReview={() => handleOpenReview(msg.mutations)}
                        />

                        {/* Formatted Markdown Content */}
                        {msg.content ? (
                          <div className="px-0.5">
                            <MarkdownContent content={msg.content} />
                          </div>
                        ) : null}

                        {/* Requirement: Changed Files Summary Card at the bottom of the message only after all output is finished */}
                        {!(isExecuting && idx === messages.length - 1) && msg.mutations && msg.mutations.length > 0 && (
                          <MutationsSummaryCard
                            mutations={msg.mutations}
                            isExecuting={false}
                            onRollback={handleRollback}
                            onRollbackAll={handleRollbackAll}
                            onOpenReview={() => handleOpenReview(msg.mutations)}
                            onOpenFileDiff={handleOpenFileDiff}
                          />
                        )}

                        {/* Assistant hover action bar: Copy, Good, Bad, and Timestamp */}
                        {!isExecuting && msg.content && (
                          <div className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[#a9a9a9] dark:text-[#888888] select-none">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer"
                              title="Copy response"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(msg.id, "good")}
                              className={cn(
                                "p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer",
                                feedbackMap[msg.id] === "good"
                                  ? "text-[#4ade80]"
                                  : "text-[#a9a9a9] dark:text-[#888888] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                              )}
                              title="Good response"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(msg.id, "bad")}
                              className={cn(
                                "p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer",
                                feedbackMap[msg.id] === "bad"
                                  ? "text-[#ef4444]"
                                  : "text-[#a9a9a9] dark:text-[#888888] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                              )}
                              title="Bad response"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[11px] font-mono text-[#a9a9a9] dark:text-[#777777] ml-1.5">
                              {formatMessageTimestamp(msg.timestamp)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Anchored Bottom Card: Swapped with SmoothCardMorph between ChatCard and ApprovalCard */}
            <div className="w-full px-3.5 sm:px-6 md:px-8 pb-4 pt-2 flex justify-center bg-[#f8f8f8] dark:bg-[#161616] shrink-0 min-w-0 relative z-20">
              <div className={cn("w-full max-w-full min-w-0 relative", streamWidthClass)}>
                {/* Floating Scroll to Bottom Button directly above Bottom Card */}
                {showScrollBottomBtn && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
                    <button
                      type="button"
                      onClick={scrollToBottom}
                      className="w-8 h-8 rounded-full bg-white dark:bg-[#252528] hover:bg-[#f4f4f5] dark:hover:bg-[#323236] border border-[#e2e2e4] dark:border-[#383838] shadow-md text-[#555555] hover:text-[#171717] dark:text-[#d4d4d4] dark:hover:text-white transition-all flex items-center justify-center animate-in fade-in zoom-in-95 duration-150 cursor-pointer"
                      title="Scroll to bottom"
                      aria-label="Scroll to bottom"
                    >
                      <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                )}

                <SmoothCardMorph
                  activeKey={
                    activeQuestion
                      ? `question_${activeQuestion.toolCallId}`
                      : activeApproval
                      ? `approval_${activeApproval.id || activeApproval.approvalId || "active"}`
                      : "chat"
                  }
                >
                  {activeQuestion ? (
                    <QuestionCard
                      toolCallId={activeQuestion.toolCallId}
                      questions={activeQuestion.questions}
                      onAnswer={handleAnswerQuestion}
                      onDismiss={() => handleAnswerQuestion(activeQuestion.toolCallId, "Dismissed")}
                    />
                  ) : activeApproval ? (
                    <ApprovalCard
                      request={activeApproval}
                      project={currentProject}
                      isResponding={isRespondingApproval}
                      runningTasks={runningTasks}
                      onSelectTask={handleSelectRunningTask}
                      onStopTask={handleStopBackgroundTask}
                      onDecide={(decision, feedback) =>
                        handleRespondApproval(
                          activeApproval.id || activeApproval.approvalId!,
                          decision,
                          feedback
                        )
                      }
                    />
                  ) : (
                    <ChatCard
                      compact
                      isExecuting={isExecuting}
                      onSendMessage={handleSendMessage}
                      onAbort={() => handleAbort()}
                      showContextUsage={true}
                      contextUsage={contextUsage}
                      metrics={conversationMetrics}
                      project={currentProject}
                      onProjectChange={setCurrentProject}
                      onOpenSettings={(tab) => handleOpenSettings(tab || "model-settings")}
                      initialPrompt={editingPrompt}
                      onModelChange={setActiveModelItem}
                      runningTasks={runningTasks}
                      onSelectTask={handleSelectRunningTask}
                      onStopTask={handleStopBackgroundTask}
                    />
                  )}
                </SmoothCardMorph>
              </div>
            </div>
          </div>
        )}
              </div>

              {/* Right Sidebar (Side Pane) matching Image 1 & 2 */}
              {isRightSidebarOpen && (
                <RightPane
                  width={rightSidebarWidth}
                  onWidthChange={setRightSidebarWidth}
                  tabs={rightPaneTabs}
                  activeTabId={activeRightPaneTabId}
                  isOpeningNewTab={isOpeningNewTab}
                  onSelectTab={(tabId) => {
                    setActiveRightPaneTabId(tabId);
                    setIsOpeningNewTab(false);
                  }}
                  onCloseTab={handleCloseTab}
                  onNewTab={handleNewTab}
                  onOpenTabType={handleOpenTabType}
                  onReorderTabs={handleReorderTabs}
                  workspacePath={currentProject === "Outside Project" ? undefined : currentProject}
                  mutations={
                    sidebarReviewMutations && sidebarReviewMutations.length > 0
                      ? sidebarReviewMutations
                      : allSessionMutations
                  }
                  onRollbackFile={handleRollback}
                  onRollbackAll={handleRollbackAll}
                  onOpenFileDiff={handleOpenFileDiff}
                  onStopTask={handleStopBackgroundTask}
                  onUpdateTab={handleUpdateTab}
                  onSelectElementForChat={handleSelectElementForChat}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* Media Lightbox Preview Modal */}
      {previewMedia && (
        <ImageLightbox
          src={previewMedia.url || ""}
          alt={previewMedia.name}
          type={previewMedia.type}
          fileSize={previewMedia.size}
          onClose={() => setPreviewMedia(null)}
        />
      )}

      {/* Review Changes Modal Dialog */}
      <ReviewDialog
        open={Boolean(reviewingMutations && reviewingMutations.length > 0)}
        onOpenChange={(open: boolean) => {
          if (!open) setReviewingMutations(null);
        }}
        mutations={reviewingMutations || []}
        onRollbackFile={handleRollback}
        onRollbackAll={handleRollbackAll}
      />

      {/* Command Palette / Quick Search Modal (1:1 with const-harness) */}
      <CommandPaletteModal
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        conversations={conversations}
        activeConversationId={conversationId}
        currentProject={currentProject}
        onSelectConversation={handleSelectConversation}
        onNewChat={() => handleNewChat()}
        onOpenWorkspace={handleOpenWorkspaceFromPalette}
        onOpenScheduledTasks={() => setIsScheduledTasksOpen(true)}
        onOpenArchive={() => {
          window.dispatchEvent(new CustomEvent("const:open-archive-modal"));
        }}
        onOpenSettings={handleOpenSettings}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Rename Task Dialog */}
      <RenameTaskDialog
        open={isRenameDialogOpen}
        currentTitle={conversationTitle || ""}
        onClose={() => setIsRenameDialogOpen(false)}
        onConfirm={(newTitle) => handleRenameConversation(conversationId, newTitle)}
      />

      {/* Trajectory Modal Dialog */}
      <TrajectoryDialog
        open={isTrajectoryOpen}
        onClose={() => setIsTrajectoryOpen(false)}
        conversationId={conversationId}
        conversationTitle={conversationTitle}
        messages={messages}
      />
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("const_harness_auth_token");
  });
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);
  const isWaitingAuthRef = useRef(false);
  isWaitingAuthRef.current = isWaitingAuth;
  const [manualToken, setManualToken] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  // Set Accounts Hub URL: Default to production accounts.const.web.id
  const accountsBaseUrl =
    (import.meta.env.VITE_ACCOUNTS_URL as string) || "https://accounts.const.web.id";

  // Listen for deep link callback in Electron or browser redirect
  useEffect(() => {
    // 1. Electron deep-link listener
    if (window.electron?.onAuthCallback) {
      const unsubscribe = window.electron.onAuthCallback(
        (data: { url: string; token?: string; cancelled?: boolean; error?: string }) => {
          // If cancelled by main process or state invalidated
          if (data.cancelled) {
            toast.info("Sign-in attempt was cancelled. Click 'Sign in' to try again.");
            return;
          }

          // Strict UI guard: If user is no longer waiting (clicked Cancel), reject callback
          if (!isWaitingAuthRef.current) {
            toast.info("Sign-in attempt was cancelled. Click 'Sign in' to try again.");
            return;
          }

          if (data.token) {
            localStorage.setItem("const_harness_auth_token", data.token);
            setToken(data.token);
            setIsWaitingAuth(false);
            isWaitingAuthRef.current = false;
            toast.success("Signed in successfully");
          }
        }
      );
      return () => unsubscribe();
    }

    // 2. Storage event listener (sync across windows or tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_harness_auth_token" && e.newValue && isWaitingAuthRef.current) {
        setToken(e.newValue);
        setIsWaitingAuth(false);
        isWaitingAuthRef.current = false;
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Browser query param fallback (if tested in browser)
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get("token");
    if (urlToken && isWaitingAuthRef.current) {
      localStorage.setItem("const_harness_auth_token", urlToken);
      setToken(urlToken);
      setIsWaitingAuth(false);
      isWaitingAuthRef.current = false;
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Poll localStorage while waiting for authentication
  useEffect(() => {
    if (!isWaitingAuth) return;
    const interval = setInterval(() => {
      const saved = localStorage.getItem("const_harness_auth_token");
      if (saved) {
        setToken(saved);
        setIsWaitingAuth(false);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [isWaitingAuth]);

  const handleSignIn = async () => {
    setIsWaitingAuth(true);
    isWaitingAuthRef.current = true;

    if (window.electron?.startAuth) {
      try {
        const res = await window.electron.startAuth({
          accountsUrl: accountsBaseUrl,
        });
        if (!res.success) {
          toast.error(res.error || "Failed to start authentication");
          setIsWaitingAuth(false);
          isWaitingAuthRef.current = false;
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to start authentication server");
        setIsWaitingAuth(false);
        isWaitingAuthRef.current = false;
      }
    } else {
      const continueTarget = `${window.location.origin}${window.location.pathname}`;
      const base = accountsBaseUrl.replace(/\/+$/, "");
      const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&prompt=select_account&app=harness`;
      window.location.href = targetUrl;
    }
  };

  const handleCancelAuth = async () => {
    setIsWaitingAuth(false);
    isWaitingAuthRef.current = false;
    setShowManualInput(false);
    setManualToken("");

    if (window.electron?.cancelAuth) {
      try {
        await window.electron.cancelAuth();
      } catch {}
    }

    localStorage.removeItem("const_harness_auth_token");
    localStorage.removeItem("const_sso_token");
    toast.info("Sign-in cancelled");
  };

  const handleManualTokenSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = manualToken.trim();
    if (!cleanToken || cleanToken.length < 10 || !/^[A-Za-z0-9_\-\.\+\=\|\~]+$/.test(cleanToken)) {
      toast.error("Invalid token format");
      return;
    }
    localStorage.setItem("const_harness_auth_token", cleanToken);
    setToken(cleanToken);
    setIsWaitingAuth(false);
    toast.success("Authenticated successfully");
  };

  const handleSignOut = () => {
    localStorage.removeItem("const_harness_auth_token");
    localStorage.removeItem("const_sso_token");
    setToken(null);
    setIsWaitingAuth(false);
  };

  const handleSwitchAccount = async () => {
    localStorage.removeItem("const_harness_auth_token");
    localStorage.removeItem("const_sso_token");
    setToken(null);
    setIsWaitingAuth(true);

    if (window.electron?.startAuth) {
      try {
        const res = await window.electron.startAuth({
          accountsUrl: accountsBaseUrl,
          action: "switch_account",
        });
        if (!res.success) {
          toast.error(res.error || "Failed to switch account");
          setIsWaitingAuth(false);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to switch account");
        setIsWaitingAuth(false);
      }
    } else {
      const continueTarget = `${window.location.origin}${window.location.pathname}`;
      const base = accountsBaseUrl.replace(/\/+$/, "");
      const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&action=switch_account&app=harness`;
      window.location.href = targetUrl;
    }
  };

  // -------------------------------------------------------------
  // 1. Authenticated View: Sidebar + Left-Rounded Canvas
  // -------------------------------------------------------------
  if (token) {
    return (
      <ConvexClientProvider token={token} signOut={handleSignOut}>
        <AuthenticatedContent
          onSignOut={handleSignOut}
          onSwitchAccount={handleSwitchAccount}
        />
      </ConvexClientProvider>
    );
  }

  // -------------------------------------------------------------
  // 2. Unauthenticated View: Redesigned Split Login Page with @const/ui
  // -------------------------------------------------------------
  return (
    <div className="h-full max-h-full w-full overflow-hidden flex bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Left Column: Sign-in Card */}
      <div className="flex h-full w-full flex-col justify-between p-6 sm:p-8 lg:p-10 lg:w-1/2 overflow-hidden">
        {/* Brand Mark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ConstLogoIcon size="sm" className="w-6 h-6 text-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-normal tracking-tight text-foreground">
              Const
            </span>
            <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
              Harness
            </span>
          </div>
        </div>

        {/* Center: Sign in content */}
        <div className="my-auto mx-auto w-full max-w-sm shrink-0 py-2">
          <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            Sign in to Const Harness.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sign in to start building and debugging with native AI agents — no complex setup required.
          </p>

          <div className="mt-8 min-h-[148px]">
            {!isWaitingAuth ? (
              <Button
                onClick={handleSignIn}
                size="lg"
                className="w-full h-12 rounded-xl text-sm font-medium gap-2 cursor-pointer transition-all active:scale-[0.99]"
              >
                <LogIn className="h-4 w-4" />
                Sign in to Const Harness
              </Button>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-300">
                {/* Button 1: Waiting state matching user reference image */}
                <div className="w-full h-12 rounded-xl text-sm font-medium gap-2.5 flex items-center justify-center bg-[#222222] border border-[#383838] text-[#969696] select-none cursor-wait transition-all">
                  <Loader2 className="h-4 w-4 animate-spin text-[#969696]" />
                  <span>Waiting for Const authentication...</span>
                </div>

                {/* Button 2: Cancel button smoothly animated in */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelAuth}
                  className="w-full h-12 rounded-xl text-sm font-medium border border-[#383838] bg-[#2b2b2b] hover:bg-[#383838] text-[#d4d4d4] hover:text-white cursor-pointer transition-all active:scale-[0.99] animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  Cancel
                </Button>

                {/* Manual token fallback */}
                <div className="pt-2 text-center">
                  {!showManualInput ? (
                    <button
                      type="button"
                      onClick={() => setShowManualInput(true)}
                      className="text-[11px] text-[#5d5d5d] hover:text-[#969696] underline underline-offset-4 cursor-pointer transition-colors"
                    >
                      Having trouble? Enter token manually
                    </button>
                  ) : (
                    <form
                      onSubmit={handleManualTokenSubmit}
                      className="space-y-2 text-left mt-2 p-3 rounded-xl bg-[#222222] border border-[#383838] animate-in fade-in duration-200"
                    >
                      <label className="text-[11px] font-medium text-[#969696]">
                        Paste authentication token:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualToken}
                          onChange={(e) => setManualToken(e.target.value)}
                          placeholder="eyJhbGciOi..."
                          className="flex-1 h-9 px-3 text-xs bg-[#2b2b2b] border border-[#383838] rounded-xl text-[#d4d4d4] placeholder-[#5d5d5d] focus:outline-none focus:border-[#5d5d5d]"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="h-9 px-3 text-xs rounded-xl"
                        >
                          Verify
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            <span>English</span>
          </div>
          <span>© 2026 Const · All rights reserved.</span>
        </div>
      </div>

      {/* Right Column: Artwork image (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 h-full p-4 overflow-hidden items-center justify-center">
        <div className="relative h-full w-full max-h-full overflow-hidden rounded-3xl border border-border shadow-inner">
          <img
            src={authArt}
            alt="Const Harness Art"
            className="h-full w-full object-cover select-none"
          />
        </div>
      </div>
    </div>
  );
}
