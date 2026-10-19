import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  ChevronDown,
  ChevronUp,
  Search,
  ArrowLeft,
  Minus,
  Square,
  X,
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
import { FileIcon } from "./components/workbench/file-icon";
import { MarkdownContent } from "./components/workbench/markdown-content";
import { ExecutionTrace, MutationsSummaryCard } from "./components/workbench/execution-trace";
import { ApprovalCard, SmoothCardMorph } from "./components/workbench/approval-card";
import { QuestionCard } from "./components/workbench/question-card";
import { FloatingWorkbenchCard } from "./components/workbench/floating-workbench-card";
import { ChatMessageItem } from "./components/workbench/chat-message-item";
import { ReviewDialog } from "./components/workbench/review-dialog";
import { RenameTaskDialog } from "./components/workbench/rename-task-dialog";
import { TrajectoryDialog } from "./components/workbench/trajectory-dialog";
import { SettingsView } from "./components/settings-view";
import { ScheduledTasksView } from "./components/scheduled-tasks";
import { SkillsSettings } from "./components/settings/skills-settings";
import { CommandPaletteModal } from "./components/command-palette-modal";
import { type QueuedMessageItem } from "./components/workbench/queue-dock";
import { RightPane, type RightPaneTab, type RightPaneTabType, type BrowserSelectedElement } from "./components/right-pane";
import { BottomPanel } from "./components/bottom-panel";
import { LoginTitleBar } from "./components/login-titlebar";
import { useAppAuth } from "./components/convex-provider";
import {
  useConversationWidth,
  getSavedTheme,
  setSavedTheme,
  getSystemTheme,
  zoomIn,
  zoomOut,
  resetZoom,
} from "./lib/theme";
import {
  getSavedShortcuts,
  matchesShortcutCommand,
  type ShortcutItem,
} from "./lib/shortcuts";
import { useTranslation } from "./lib/i18n";
import { playTaskCompletionSound } from "./lib/sound";
import { localDb } from "./lib/db";
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
  getDefaultAgentMode,
  type ConversationItem,
} from "./lib/conversation-store";
import { resolveMentionedSessionsInPrompt } from "./lib/mention-search";
import type {
  FileMutationRecord,
  TraceStep,
  ApprovalRequestData,
  ApprovalDecision,
  BackgroundTaskItem,
  TodoItem,
  QuestionItem,
  SubAgentItem,
} from "./vite-env";
import authArt from "./assets/auth-art.jpg";

function getGreeting(t: (key: any) => string): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return t("workbench.greetingMorning");
  if (hour >= 12 && hour < 18) return t("workbench.greetingAfternoon");
  return t("workbench.greetingEvening");
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

function formatChatMessageForLlm(
  m: ChatMessage,
  allConvos: ConversationItem[]
): { role: string; content: string | any[] } {
  if (m.role !== "user") {
    return {
      role: m.role,
      content: m.content,
    };
  }

  // Resolve @-mentioned sessions in user prompt
  let textContent = resolveMentionedSessionsInPrompt(m.content || "", allConvos);

  if (!m.attachments || m.attachments.length === 0) {
    return {
      role: "user",
      content: textContent,
    };
  }

  const hasExistingAttachmentSection = textContent.includes("[Attached media / Lampiran media:");
  const attLines = m.attachments.map((att: any) => {
    const pathInfo = att.path ? ` [Path: ${att.path}]` : "";
    const pageInfo = att.pages ? (att.type === "presentation" ? ` [${att.pages} slides]` : ` [${att.pages} pages]`) : "";
    return `- ${att.type.toUpperCase()}: "${att.name}" (${formatFileSize(att.size)})${pageInfo}${pathInfo}`;
  });

  let fullText = textContent;
  if (!hasExistingAttachmentSection) {
    const baseText = fullText.trim() ? fullText : "Please analyze the attached file(s).";
    fullText = `${baseText}\n\n[Attached media / Lampiran media:\n${attLines.join("\n")}]`;
  }

  // Append media notices for video, audio, or binary attachments so AI knows disk location & tools
  const mediaNotices: string[] = [];
  for (const att of m.attachments) {
    if (!att.textContent) {
      if (att.type === "video") {
        mediaNotices.push(
          `[VIDEO ATTACHMENT: "${att.name}" (${formatFileSize(att.size)})${att.path ? ` | Path: ${att.path}` : ""} - Video file is stored on disk at the indicated path. You may use workspace tools (such as ffmpeg, ffprobe, python) to inspect or process it if needed.]`
        );
      } else if (att.type === "audio") {
        mediaNotices.push(
          `[AUDIO ATTACHMENT: "${att.name}" (${formatFileSize(att.size)})${att.path ? ` | Path: ${att.path}` : ""} - Audio file is stored on disk at the indicated path. You may use workspace tools to inspect or transcribe it if needed.]`
        );
      } else if (att.type === "other") {
        mediaNotices.push(
          `[FILE ATTACHMENT: "${att.name}" (${formatFileSize(att.size)})${att.path ? ` | Path: ${att.path}` : ""} - Binary file is stored on disk at the indicated path.]`
        );
      }
    }
  }

  if (mediaNotices.length > 0) {
    fullText = `${fullText}\n\n${mediaNotices.join("\n")}`;
  }

  // Append extracted document/PDF text blocks if available and not already embedded
  const docTextBlocks: string[] = [];
  for (const att of m.attachments) {
    if (att.textContent && att.textContent.trim()) {
      const headerTag = `--- DOCUMENT ATTACHMENT: "${att.name}"`;
      if (!fullText.includes(headerTag)) {
        const meta = [
          att.pages ? (att.type === "presentation" ? `${att.pages} slides` : `${att.pages} pages`) : null,
          att.path ? `Path: ${att.path}` : null,
        ].filter(Boolean).join(", ");
        const metaStr = meta ? ` (${meta})` : "";
        docTextBlocks.push(
          `--- DOCUMENT ATTACHMENT: "${att.name}"${metaStr} ---\n${att.textContent.trim()}\n--- END ATTACHMENT: "${att.name}" ---`
        );
      }
    }
  }

  if (docTextBlocks.length > 0) {
    fullText = `${fullText}\n\n${docTextBlocks.join("\n\n")}`;
  }

  // Collect multimodal image parts (base64 data URLs)
  const imageParts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
  for (const att of m.attachments) {
    if (att.type === "image" && att.base64) {
      imageParts.push({
        type: "image_url",
        image_url: {
          url: att.base64,
        },
      });
    }
  }

  if (imageParts.length > 0) {
    return {
      role: "user",
      content: [
        { type: "text", text: fullText },
        ...imageParts,
      ],
    };
  }

  return {
    role: "user",
    content: fullText,
  };
}

interface ConversationRightPaneState {
  isOpen: boolean;
  isExpanded?: boolean;
  tabs: RightPaneTab[];
  activeTabId: string | null;
  reviewMutations?: FileMutationRecord[] | null;
}

interface ConversationBottomPanelState {
  isOpen: boolean;
  tabs: RightPaneTab[];
  activeTabId: string | null;
  height: number;
}

const getStoredRightPaneState = (convoId: string): ConversationRightPaneState | null => {
  if (!convoId) return null;
  try {
    const raw = localStorage.getItem(`const_harness_right_pane_${convoId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return {
          isOpen: Boolean(parsed.isOpen),
          isExpanded: Boolean(parsed.isExpanded && parsed.isOpen),
          tabs: Array.isArray(parsed.tabs) ? parsed.tabs : [],
          activeTabId: typeof parsed.activeTabId === "string" ? parsed.activeTabId : null,
          reviewMutations: Array.isArray(parsed.reviewMutations) ? parsed.reviewMutations : null,
        };
      }
    }
  } catch {}
  return null;
};

const storeRightPaneState = (convoId: string, state: ConversationRightPaneState) => {
  if (!convoId) return;
  try {
    localStorage.setItem(`const_harness_right_pane_${convoId}`, JSON.stringify(state));
  } catch {}
};

const removeStoredRightPaneState = (convoId: string) => {
  if (!convoId) return;
  try {
    localStorage.removeItem(`const_harness_right_pane_${convoId}`);
  } catch {}
};

function AuthenticatedContent({
  onSignOut,
  onSwitchAccount,
}: {
  onSignOut: () => void;
  onSwitchAccount: () => void;
}) {
  const user = useQuery(api.auth.queries.currentUser, {});
  const [localProfile, setLocalProfile] = useState<{ name?: string; image?: string }>(() => {
    try {
      const saved = localStorage.getItem("const_custom_user_profile");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ name?: string; image?: string }>;
      if (customEvent.detail) {
        setLocalProfile(customEvent.detail);
      } else {
        try {
          const saved = localStorage.getItem("const_custom_user_profile");
          setLocalProfile(saved ? JSON.parse(saved) : {});
        } catch {
          setLocalProfile({});
        }
      }
    };
    window.addEventListener("const:user-profile-updated", handleProfileUpdate);
    return () => window.removeEventListener("const:user-profile-updated", handleProfileUpdate);
  }, []);

  const effectiveUser = useMemo(() => {
    if (!user && !localProfile.name && !localProfile.image) return user;
    return {
      ...(user || { id: "local-user-session", email: "Local Workspace" }),
      name: localProfile.name !== undefined ? localProfile.name : user?.name,
      image: localProfile.image !== undefined ? localProfile.image : user?.image,
    };
  }, [user, localProfile]);

  const { token } = useAppAuth();
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScheduledTasksOpen, setIsScheduledTasksOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);

  useEffect(() => {
    window.electron?.isMaximized?.().then((max) => setIsWindowMaximized(Boolean(max)));
    const cleanup = window.electron?.onMaximizedChange?.((max) => {
      setIsWindowMaximized(max);
    });
    return () => {
      cleanup?.();
    };
  }, []);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isTrajectoryOpen, setIsTrajectoryOpen] = useState(false);
  const [trajectoryTargetConversationId, setTrajectoryTargetConversationId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<string>("general");
  const [isTaskFindOpen, setIsTaskFindOpen] = useState(false);
  const [taskFindQuery, setTaskFindQuery] = useState("");
  const [taskFindIndex, setTaskFindIndex] = useState(0);
  const greeting = getGreeting(t);

  const handleOpenSettings = (tab: string = "general") => {
    const resolvedTab = tab === "model" ? "model-settings" : tab;
    setSettingsTab(resolvedTab);
    setIsSettingsOpen(true);
  };

  const handleOpenTrajectory = useCallback((idOrPath?: string) => {
    if (!idOrPath) {
      setTrajectoryTargetConversationId(null);
      setIsTrajectoryOpen(true);
      return;
    }
    const cleaned = idOrPath.replace(/^trajectory:\/\//, "");
    const brainMatch = cleaned.match(/brain[/\\]([^/\\]+)/i);
    const targetId = (brainMatch ? brainMatch[1] : cleaned.split(/[/\\]/)[0]) || null;

    const allConvos = loadConversations();
    const found = targetId ? allConvos.find((c) => c.id === targetId || cleaned.includes(c.id)) : null;
    if (found) {
      setTrajectoryTargetConversationId(found.id);
    } else {
      setTrajectoryTargetConversationId(targetId);
    }
    setIsTrajectoryOpen(true);
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
    try {
      const saved = localStorage.getItem("const_harness_current_project");
      if (saved && saved !== "[object Object]" && typeof saved === "string") {
        return saved;
      }
    } catch {}
    return "Outside Project";
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("const_harness_current_project");
      if (saved === "[object Object]") {
        localStorage.setItem("const_harness_current_project", "Outside Project");
        setCurrentProject("Outside Project");
      }
    } catch {}
  }, []);
  const [currentMode, setCurrentMode] = useState<"request_review" | "ask_before_changes" | "full_access">(() => {
    return getDefaultAgentMode();
  });

  const handleModeChange = async (newMode: "request_review" | "ask_before_changes" | "full_access") => {
    setCurrentMode(newMode);
    try {
      localStorage.setItem("const_harness_default_mode", newMode);
    } catch {}

    const targetConvoId = conversationIdRef.current || conversationId;
    const stored = loadConversations();
    const target = stored.find((c) => c.id === targetConvoId);
    if (target) {
      target.mode = newMode;
      target.updatedAt = Date.now();
      saveConversation(target);
      setConversations(loadConversations());
    }

    if (newMode === "full_access") {
      setPendingApprovals((prev) => {
        if (!prev.has(targetConvoId)) return prev;
        const next = new Map(prev);
        next.delete(targetConvoId);
        return next;
      });
    }

    if (window.electron?.updateMode) {
      await window.electron.updateMode({
        mode: newMode,
        conversationId: targetConvoId,
      });
    }
  };

  const [activeModelItem, setActiveModelItem] = useState<ModelItem | null>(null);
  const [lastKnownLlmUsage, setLastKnownLlmUsage] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null>(null);

  // Right Sidebar (Side Pane) state & tab management - initialized closed on startup
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false);
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState<boolean>(false);
  const [rightPaneTabs, setRightPaneTabs] = useState<RightPaneTab[]>([]);
  const [activeRightPaneTabId, setActiveRightPaneTabId] = useState<string | null>(null);
  const [sidebarReviewMutations, setSidebarReviewMutations] = useState<FileMutationRecord[] | null>(null);
  const [isOpeningNewTab, setIsOpeningNewTab] = useState<boolean>(false);
  const [isDraggingRightSidebar, setIsDraggingRightSidebar] = useState<boolean>(false);

  // Bottom Panel (Terminal) state management - dockable below main chat
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState<boolean>(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(260);
  const [bottomPanelTabs, setBottomPanelTabs] = useState<RightPaneTab[]>([]);
  const [activeBottomTabId, setActiveBottomTabId] = useState<string | null>(null);
  const [isDraggingBottomPanel, setIsDraggingBottomPanel] = useState<boolean>(false);

  // Per-conversation right pane cache and live state references
  const convoRightPaneMapRef = useRef<Map<string, ConversationRightPaneState>>(new Map());
  const isRightSidebarOpenRef = useRef(isRightSidebarOpen);
  isRightSidebarOpenRef.current = isRightSidebarOpen;
  const isRightSidebarExpandedRef = useRef(isRightSidebarExpanded);
  isRightSidebarExpandedRef.current = isRightSidebarExpanded;
  const rightPaneTabsRef = useRef(rightPaneTabs);
  rightPaneTabsRef.current = rightPaneTabs;
  const activeRightPaneTabIdRef = useRef<string | null>(activeRightPaneTabId);
  activeRightPaneTabIdRef.current = activeRightPaneTabId;
  const sidebarReviewMutationsRef = useRef(sidebarReviewMutations);
  sidebarReviewMutationsRef.current = sidebarReviewMutations;

  // Per-conversation bottom panel cache and live state references
  const convoBottomPanelMapRef = useRef<Map<string, ConversationBottomPanelState>>(new Map());
  const isBottomPanelOpenRef = useRef(isBottomPanelOpen);
  isBottomPanelOpenRef.current = isBottomPanelOpen;
  const bottomPanelTabsRef = useRef(bottomPanelTabs);
  bottomPanelTabsRef.current = bottomPanelTabs;
  const activeBottomTabIdRef = useRef<string | null>(activeBottomTabId);
  activeBottomTabIdRef.current = activeBottomTabId;
  const bottomPanelHeightRef = useRef(bottomPanelHeight);
  bottomPanelHeightRef.current = bottomPanelHeight;

  // Cleanup legacy global open state on mount so it never forces sidepanel open at startup
  useEffect(() => {
    try {
      localStorage.removeItem("const_harness_right_sidebar_open");
    } catch {}
  }, []);

  // Minimum width protection for main content column (matching apps/learn protection)
  const MIN_MAIN_CONTENT_WIDTH = 460;

  const clampRightSidebarWidth = useCallback(
    (desiredWidth: number, sidebarOpen = isSidebarOpen) => {
      const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
      const effectiveSidebarWidth = sidebarOpen ? 256 : 0;
      // Account for layout margins/paddings (~32px)
      const maxAllowedByMain = Math.max(300, windowWidth - effectiveSidebarWidth - MIN_MAIN_CONTENT_WIDTH - 32);
      const maxRightSidebarWidth = Math.min(
        Math.max(Math.round(windowWidth * 0.55), 580),
        850,
        maxAllowedByMain
      );
      return Math.min(Math.max(desiredWidth, 300), maxRightSidebarWidth);
    },
    [isSidebarOpen]
  );

  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("const_harness_right_sidebar_width");
    const initial = saved ? Number(saved) : 480;
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const maxAllowed = Math.max(300, windowWidth - 256 - 460 - 32);
    return Math.min(Math.max(initial, 300), maxAllowed);
  });

  useEffect(() => {
    localStorage.setItem("const_harness_right_sidebar_width", String(rightSidebarWidth));
  }, [rightSidebarWidth]);

  // Auto-save active conversation's right pane state whenever it changes
  useEffect(() => {
    if (!conversationId) return;
    const state: ConversationRightPaneState = {
      isOpen: isRightSidebarOpen,
      isExpanded: Boolean(isRightSidebarOpen && isRightSidebarExpanded),
      tabs: rightPaneTabs,
      activeTabId: activeRightPaneTabId,
      reviewMutations: sidebarReviewMutations,
    };
    convoRightPaneMapRef.current.set(conversationId, state);
    storeRightPaneState(conversationId, state);
  }, [conversationId, isRightSidebarOpen, isRightSidebarExpanded, rightPaneTabs, activeRightPaneTabId, sidebarReviewMutations]);

  const saveCurrentConversationRightPaneState = useCallback(() => {
    const currentId = conversationIdRef.current;
    if (!currentId) return;
    const state: ConversationRightPaneState = {
      isOpen: isRightSidebarOpenRef.current,
      isExpanded: Boolean(isRightSidebarOpenRef.current && isRightSidebarExpandedRef.current),
      tabs: rightPaneTabsRef.current,
      activeTabId: activeRightPaneTabIdRef.current,
      reviewMutations: sidebarReviewMutationsRef.current,
    };
    convoRightPaneMapRef.current.set(currentId, state);
    storeRightPaneState(currentId, state);

    const bottomState: ConversationBottomPanelState = {
      isOpen: isBottomPanelOpenRef.current,
      tabs: bottomPanelTabsRef.current,
      activeTabId: activeBottomTabIdRef.current,
      height: bottomPanelHeightRef.current,
    };
    convoBottomPanelMapRef.current.set(currentId, bottomState);
  }, []);

  const restoreConversationRightPaneState = useCallback((targetConvoId: string) => {
    if (!targetConvoId) return;
    const state =
      convoRightPaneMapRef.current.get(targetConvoId) ||
      getStoredRightPaneState(targetConvoId) ||
      {
        isOpen: false,
        isExpanded: false,
        tabs: [],
        activeTabId: null,
        reviewMutations: null,
      };

    convoRightPaneMapRef.current.set(targetConvoId, state);
    setIsRightSidebarOpen(state.isOpen);
    setIsRightSidebarExpanded(Boolean(state.isOpen && state.isExpanded));
    setRightPaneTabs(state.tabs || []);
    setActiveRightPaneTabId(state.activeTabId || null);
    setSidebarReviewMutations(state.reviewMutations || null);
    setIsOpeningNewTab(false);

    if (state.activeTabId) {
      const activeBrowserTab = state.tabs?.find(
        (t) => t.id === state.activeTabId && t.type === "browser"
      );
      if (activeBrowserTab) {
        window.electron?.browser?.setActiveTab(activeBrowserTab.id);
      }
    }

    const bottomState = convoBottomPanelMapRef.current.get(targetConvoId);
    if (bottomState) {
      setIsBottomPanelOpen(bottomState.isOpen);
      setBottomPanelTabs(bottomState.tabs || []);
      setActiveBottomTabId(bottomState.activeTabId || null);
      if (bottomState.height) setBottomPanelHeight(bottomState.height);
    } else {
      setIsBottomPanelOpen(false);
      setBottomPanelTabs([]);
      setActiveBottomTabId(null);
    }
  }, []);

  // Window resize protection (matching apps/learn)
  useEffect(() => {
    const handleResize = () => {
      setRightSidebarWidth((prev) => clampRightSidebarWidth(prev));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampRightSidebarWidth]);

  // Clamp right sidebar width when left sidebar is opened or closed
  useEffect(() => {
    setRightSidebarWidth((prev) => clampRightSidebarWidth(prev, isSidebarOpen));
  }, [isSidebarOpen, clampRightSidebarWidth]);

  // Measure exact main container pixel width for continuous, glitch-free panel expansion animations
  const mainContainerRef = useRef<HTMLElement | null>(null);
  const [mainContainerWidth, setMainContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!mainContainerRef.current) return;
    const updateWidth = () => {
      if (mainContainerRef.current) {
        setMainContainerWidth(mainContainerRef.current.clientWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(mainContainerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleToggleRightSidebar = () => {
    setIsRightSidebarOpen((prev) => {
      if (prev) {
        setIsRightSidebarExpanded(false);
      }
      return !prev;
    });
  };

  const handleToggleBottomPanel = useCallback(async () => {
    if (!isBottomPanelOpenRef.current && bottomPanelTabsRef.current.length === 0) {
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
        currentProject && currentProject !== "Outside Project"
          ? currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject
          : "outside";

      const initialTabId = `bottom_terminal_${Date.now()}`;
      const newTab: RightPaneTab = {
        id: initialTabId,
        type: "terminal",
        title: baseTitle,
        cwd: resolvedCwd,
        project: currentProject,
        conversationId,
      };
      setBottomPanelTabs([newTab]);
      setActiveBottomTabId(initialTabId);
      setIsBottomPanelOpen(true);
      return;
    }

    setIsBottomPanelOpen((prev) => !prev);
  }, [currentProject, conversationId]);

  const handleNewBottomTab = useCallback(async () => {
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
      currentProject && currentProject !== "Outside Project"
        ? currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject
        : "outside";

    const countWithBase = bottomPanelTabsRef.current.filter(
      (t) => t.type === "terminal" && t.title.startsWith(baseTitle)
    ).length;
    const title = countWithBase === 0 ? baseTitle : `${baseTitle} (${countWithBase + 1})`;

    const newTab: RightPaneTab = {
      id: `bottom_terminal_${Date.now()}`,
      type: "terminal",
      title,
      cwd: resolvedCwd,
      project: currentProject,
      conversationId,
    };
    setBottomPanelTabs((prev) => [...prev, newTab]);
    setActiveBottomTabId(newTab.id);
    setIsBottomPanelOpen(true);
  }, [currentProject, conversationId]);

  const handleReorderBottomTabs = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setBottomPanelTabs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      if (moved) {
        next.splice(toIndex, 0, moved);
      }
      return next;
    });
  }, []);

  const handleClearBottomTerminal = useCallback((tabId: string) => {
    if (window.electron?.terminal?.write) {
      window.electron.terminal.write({ id: tabId, data: "\x0c" });
    }
  }, []);

  const handleCloseBottomTab = useCallback((tabId: string) => {
    window.electron?.terminal?.destroy(tabId);
    setBottomPanelTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== tabId);
      if (remaining.length === 0) {
        setIsBottomPanelOpen(false);
        setActiveBottomTabId(null);
      } else if (activeBottomTabId === tabId) {
        setActiveBottomTabId(remaining[remaining.length - 1]?.id ?? null);
      }
      return remaining;
    });
  }, [activeBottomTabId]);

  const handleMouseDownRightResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRightSidebar(true);
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = clampRightSidebarWidth(startWidth + deltaX);
      setRightSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingRightSidebar(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
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
    handleToggleBottomPanel();
  };

  const handleOpenBrowser = useCallback(
    (initialUrl?: any, options?: { tabId?: string; newTab?: boolean }) => {
      setIsRightSidebarOpen(true);
      setIsOpeningNewTab(false);
      const hasCustomUrl =
        typeof initialUrl === "string" &&
        initialUrl.trim().length > 0 &&
        initialUrl !== "[object Object]";
      const resolvedUrl = hasCustomUrl ? initialUrl.trim() : "https://www.google.com";

      setRightPaneTabs((prev) => {
        const browserTabs = prev.filter((t) => t.type === "browser");

        if (!options?.newTab && browserTabs.length > 0) {
          // 1. Explicit tabId if requested
          // 2. Currently active tab if it is a browser tab
          // 3. Otherwise the LAST (most recently opened) browser tab
          const targetTab =
            (options?.tabId ? browserTabs.find((t) => t.id === options.tabId) : undefined) ||
            browserTabs.find((t) => t.id === activeRightPaneTabIdRef.current) ||
            browserTabs[browserTabs.length - 1]!;

          setActiveRightPaneTabId(targetTab.id);
          window.electron?.browser?.setActiveTab(targetTab.id);

          if (hasCustomUrl && resolvedUrl !== targetTab.url) {
            return prev.map((t) => (t.id === targetTab.id ? { ...t, url: resolvedUrl } : t));
          }
          return prev;
        }

        const count = browserTabs.length;
        const newTab: RightPaneTab = {
          id: options?.tabId || `browser_${Date.now()}`,
          type: "browser",
          title: count === 0 ? "Browser" : `Browser ${count + 1}`,
          url: resolvedUrl,
          project: currentProject,
          conversationId,
        };
        setActiveRightPaneTabId(newTab.id);
        window.electron?.browser?.setActiveTab(newTab.id);
        return [...prev, newTab];
      });
    },
    [currentProject, conversationId]
  );

  // Sync active browser tab with Electron BrowserController & listen for AI auto-open requests
  useEffect(() => {
    const activeTab = rightPaneTabs.find((t) => t.id === activeRightPaneTabId);
    if (activeTab && activeTab.type === "browser") {
      window.electron?.browser?.setActiveTab(activeTab.id);
    }
  }, [activeRightPaneTabId, rightPaneTabs]);

  useEffect(() => {
    const unsub = window.electron?.browser?.onOpenTabRequest?.((data) => {
      handleOpenBrowser(data?.url, {
        tabId: data?.tabId,
        newTab: data?.newTab,
      });
    });
    return () => {
      unsub?.();
    };
  }, [handleOpenBrowser]);

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
    } else if (type === "directory") {
      const baseTitle =
        currentProject && currentProject !== "Outside Project"
          ? currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "Direktori"
          : "Direktori";
      title = baseTitle;
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
      parentConversationId: conversationId,
      model: activeModelItem?.id || activeModelItem?.name || "gemini-3.8-flash",
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
    setIsOpeningNewTab(false);
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const allSessionMutations = useMemo(() => {
    const list: FileMutationRecord[] = [];
    for (const msg of messages) {
      if (msg.mutations) {
        list.push(...msg.mutations);
      }
    }
    return list;
  }, [messages]);

  const sessionMediaAttachments = useMemo(() => {
    const list: AttachedFile[] = [];
    const seen = new Set<string>();
    for (const msg of messages) {
      if (Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          if (att && att.name && !seen.has(att.name)) {
            seen.add(att.name);
            list.push(att);
          }
        }
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
  const [queuedMessagesByConvo, setQueuedMessagesByConvo] = useState<Record<string, QueuedMessageItem[]>>({});
  const queuedMessagesByConvoRef = React.useRef(queuedMessagesByConvo);
  useEffect(() => {
    queuedMessagesByConvoRef.current = queuedMessagesByConvo;
  }, [queuedMessagesByConvo]);
  const currentQueuedMessages = queuedMessagesByConvo[conversationId] || [];

  const handleSendMessageRef = React.useRef<(args: any) => void>(() => {});
  const currentProjectRef = React.useRef(currentProject);
  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);
  const currentModeRef = React.useRef(currentMode);
  useEffect(() => {
    currentModeRef.current = currentMode;
  }, [currentMode]);

  const activeSessionMessagesRef = React.useRef<Map<string, ChatMessage[]>>(new Map());
  const executionStartTimeMapRef = React.useRef<Map<string, number>>(new Map());
  const [liveDurationMs, setLiveDurationMs] = useState<number>(0);

  const handleQueueMessage = useCallback((payload: { prompt: string; attachments?: AttachedFile[] }) => {
    const newItem: QueuedMessageItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      prompt: payload.prompt,
      attachments: payload.attachments,
      timestamp: Date.now(),
    };
    setQueuedMessagesByConvo((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newItem],
    }));
  }, [conversationId]);

  const handleRemoveQueuedMessage = useCallback((id: string) => {
    setQueuedMessagesByConvo((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).filter((item) => item.id !== id),
    }));
  }, [conversationId]);

  const handleEditQueuedMessage = useCallback((id: string, newText: string) => {
    setQueuedMessagesByConvo((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map((item) =>
        item.id === id ? { ...item, prompt: newText } : item
      ),
    }));
  }, [conversationId]);

  const handleSteerMessage = useCallback((item: QueuedMessageItem) => {
    handleRemoveQueuedMessage(item.id);

    if (window.electron?.steerAgent) {
      window.electron
        .steerAgent({
          conversationId: item.conversationId,
          prompt: item.prompt,
          attachments: item.attachments,
        })
        .then((res) => {
          if (!res?.success && res?.notRunning) {
            handleSendMessageRef.current?.({
              prompt: item.prompt,
              project: currentProjectRef.current || "Outside Project",
              mode: currentModeRef.current,
              attachments: item.attachments,
            });
          }
        })
        .catch(() => {});
    }
  }, [handleRemoveQueuedMessage]);

  const handleSteerAllQueuedMessages = useCallback(() => {
    const items = queuedMessagesByConvoRef.current[conversationId] || [];
    if (items.length === 0) return;

    setQueuedMessagesByConvo((prev) => ({
      ...prev,
      [conversationId]: [],
    }));

    for (const item of items) {
      handleSteerMessage(item);
    }
  }, [conversationId, handleSteerMessage]);

  const handleSteerDraft = useCallback((payload: { prompt: string; attachments?: AttachedFile[] }) => {
    if (window.electron?.steerAgent) {
      window.electron
        .steerAgent({
          conversationId,
          prompt: payload.prompt,
          attachments: payload.attachments,
        })
        .then((res) => {
          if (!res?.success && res?.notRunning) {
            handleSendMessageRef.current?.({
              prompt: payload.prompt,
              project: currentProjectRef.current || "Outside Project",
              mode: currentModeRef.current,
              attachments: payload.attachments,
            });
          }
        })
        .catch(() => {});
    }
  }, [conversationId]);
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

  const [conversationSubAgents, setConversationSubAgents] = useState<Map<string, SubAgentItem[]>>(new Map());

  const activeSubAgents = useMemo(() => {
    const fromMap = conversationSubAgents.get(conversationId);
    if (fromMap && fromMap.length > 0) return fromMap;
    const foundAgents: SubAgentItem[] = [];
    for (const msg of messages) {
      if (msg && msg.role === "assistant" && msg.traceSteps) {
        for (const st of msg.traceSteps) {
          if (!st) continue;
          const isSubTool =
            st.name === "task" ||
            st.name === "spawn_agent" ||
            st.name === "subagent" ||
            st.name === "delegate_task";
          if (!isSubTool) continue;

          const baseRole = (st.args?.agent || st.args?.role || "task") as string;
          const resultStr = typeof st.result === "string" ? st.result : "";

          if (Array.isArray(st.args?.tasks) && st.args.tasks.length > 0) {
            st.args.tasks.forEach((tItem: any, idx: number) => {
              const tRole = (tItem?.agent || tItem?.role || baseRole) as string;
              const tName = (tItem?.id || tItem?.name || `Task${idx + 1}`) as string;
              const tDesc = (tItem?.description || tName || tRole) as string;
              const tPrompt = (tItem?.assignment || tItem?.task || tItem?.prompt || tDesc) as string;
              const agentId = `${st.toolCallId || st.id}_batch_${idx}`;
              const isFailed = st.isError || resultStr.includes(`status="failed"`);
              const isRunning = !st.result || resultStr.includes(`status="running"`);
              if (!foundAgents.some((a) => a.id === agentId)) {
                foundAgents.push({
                  id: agentId,
                  name: tName,
                  role: tRole,
                  description: tDesc,
                  prompt: tPrompt,
                  status: isFailed ? "failed" : isRunning ? "running" : "completed",
                  startTime: st.startTime || Date.now(),
                  endTime: isRunning ? undefined : Date.now(),
                  logs: [],
                  result: resultStr || undefined,
                });
              }
            });
          } else if (
            st.args?.agent ||
            st.args?.role ||
            st.args?.task ||
            st.args?.prompt ||
            st.args?.assignment ||
            st.args?.description
          ) {
            const role = baseRole;
            const nameMatch = resultStr.match(/name="([^"]+)"/);
            const idMatch = resultStr.match(/id="([^"]+)"/);
            const statusMatch = resultStr.match(/status="([^"]+)"/);
            const parsedStatus = statusMatch?.[1];
            const description = (st.args.description || st.args.name || nameMatch?.[1] || role) as string;
            const prompt = (st.args.assignment || st.args.task || st.args.prompt || description) as string;
            const agentId = idMatch?.[1] || (st.result as any)?.agentId || st.toolCallId || st.id;
            const status: SubAgentItem["status"] =
              parsedStatus === "failed" || st.isError
                ? "failed"
                : parsedStatus === "cancelled" || parsedStatus === "killed"
                ? "killed"
                : parsedStatus === "running" || !st.result
                ? "running"
                : "completed";
            if (!foundAgents.some((a) => a.id === agentId)) {
              foundAgents.push({
                id: agentId,
                name: (st.args.name || nameMatch?.[1]) as string | undefined,
                role,
                description,
                prompt,
                status,
                startTime: st.startTime || Date.now(),
                endTime: status === "running" ? undefined : Date.now(),
                logs: [],
                result: resultStr || undefined,
              });
            }
          }
        }
      }
    }
    return foundAgents.length > 0 ? foundAgents : null;
  }, [conversationSubAgents, conversationId, messages]);

  const handleKillSubAgent = async (agentId: string) => {
    if (window.electron?.killSubAgent) {
      await window.electron.killSubAgent(agentId);
    }
    setConversationSubAgents((prev) => {
      const next = new Map(prev);
      const list = next.get(conversationId) || [];
      next.set(
        conversationId,
        list.map((a) =>
          a.id === agentId || a.name === agentId
            ? { ...a, status: "killed", endTime: Date.now() }
            : a
        )
      );
      return next;
    });
  };

  const handleOpenSubAgent = (subAgent: SubAgentItem) => {
    const tabId = `subagent_${subAgent.id}`;
    const existingTab = rightPaneTabs.find((t) => t.id === tabId || t.subAgentId === subAgent.id);
    if (existingTab) {
      setActiveRightPaneTabId(existingTab.id);
      setIsRightSidebarOpen(true);
      return;
    }

    const index = activeSubAgents?.findIndex((a) => a.id === subAgent.id) ?? -1;
    const handlePrefix = subAgent.name ? `${subAgent.name}: ` : index >= 0 ? `Sub-agent ${index + 1}: ` : "Sub-agent: ";
    const displayTitle = subAgent.description.toLowerCase().startsWith("sub-agent")
      ? subAgent.description
      : `${handlePrefix}${subAgent.description.slice(0, 30)}`;

    const newTab: RightPaneTab = {
      id: tabId,
      type: "subagent",
      title: displayTitle,
      subAgentId: subAgent.id,
      subAgent,
      createdAt: Date.now(),
    };

    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
    setIsRightSidebarOpen(true);
  };

  const handleOpenSubAgentFromTrace = (step: any) => {
    const args = step.args || {};
    const resultStr = typeof step.result === "string" ? step.result : "";
    const idMatch = resultStr.match(/id="([^"]+)"/);
    const nameMatch = resultStr.match(/name="([^"]+)"/);
    const extractedId = step.targetAgentId || idMatch?.[1];
    const extractedName = step.targetAgentName || args.name || nameMatch?.[1];
    const promptText = args.assignment || args.task || args.prompt || "";
    const title =
      args.description ||
      args.name ||
      args.label ||
      (typeof promptText === "string" && promptText ? promptText.slice(0, 50) : "Subagent Task");

    const matching = activeSubAgents?.find(
      (a) =>
        (extractedId && a.id === extractedId) ||
        (extractedName && a.name && a.name.toLowerCase() === String(extractedName).toLowerCase()) ||
        (step.id && a.id.includes(step.id)) ||
        (step.toolCallId && a.id.includes(step.toolCallId)) ||
        a.description === title ||
        (a.prompt && typeof promptText === "string" && promptText.length > 0 && a.prompt.includes(promptText.slice(0, 30)))
    );

    if (matching) {
      handleOpenSubAgent(matching);
      return;
    }

    const statusMatch = resultStr.match(/status="([^"]+)"/);
    const parsedStatus = statusMatch?.[1];
    const fallbackStatus: SubAgentItem["status"] =
      parsedStatus === "failed" || step.isError
        ? "failed"
        : parsedStatus === "cancelled" || parsedStatus === "killed"
        ? "killed"
        : parsedStatus === "running" || !step.result
        ? "running"
        : "completed";

    const fallbackAgent: SubAgentItem = {
      id: extractedId || step.id || `agent_${Date.now()}`,
      name: extractedName,
      description: title,
      prompt: promptText || title,
      role: args.agent || args.role || "task",
      status: fallbackStatus,
      startTime: step.startTime || Date.now() - 5000,
      endTime: fallbackStatus === "running" ? undefined : Date.now(),
      logs: [`Spawned with role '${args.agent || args.role || "task"}'`],
      result: resultStr || undefined,
      error: fallbackStatus === "failed" ? (resultStr || "Failed") : undefined,
    };

    handleOpenSubAgent(fallbackAgent);
  };

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
      toast.success(t("toast.copied"));
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(t("toast.copyFailed"));
    }
  };

  const handleFeedback = (id: string, type: "good" | "bad") => {
    setFeedbackMap((prev) => ({
      ...prev,
      [id]: prev[id] === type ? undefined! : type,
    }));
    toast.success(type === "good" ? t("toast.responseHelpful") : t("toast.feedbackRecorded"));
  };

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const handleStartEditMessage = (id: string) => {
    if (isExecuting) return;
    setEditingMessageId(id);
  };

  const handleCancelEditMessage = () => {
    setEditingMessageId(null);
  };

  const handleSubmitEditMessage = async (
    messageId: string,
    newContent: string,
    messageIdx: number,
    attachments?: AttachedFile[]
  ) => {
    if (isExecuting) {
      toast.warning(t("toast.waitBeforeEditing"));
      return;
    }

    const trimmed = newContent.trim();
    if (!trimmed && (!attachments || attachments.length === 0)) {
      toast.error(t("toast.emptyMessage"));
      return;
    }

    // 1. Gather all file mutations from this turn onwards that have not been rolled back
    const mutationsToRevert: FileMutationRecord[] = [];
    for (let i = messageIdx; i < messages.length; i++) {
      const msg = messages[i];
      if (msg?.mutations && Array.isArray(msg.mutations)) {
        for (const m of msg.mutations) {
          if (!m.rolledBack) {
            mutationsToRevert.push(m);
          }
        }
      }
    }

    // 2. Perform automated file rollback in reverse chronological order
    if (mutationsToRevert.length > 0 && window.electron?.rollbackFile) {
      let revertedCount = 0;
      for (const rec of [...mutationsToRevert].reverse()) {
        try {
          const res = await window.electron.rollbackFile(rec);
          if (res?.success) revertedCount++;
        } catch {}
      }
      if (revertedCount > 0) {
        toast.info(t("toast.revertedFiles").replace("{count}", String(revertedCount)));
      }
    }

    // 3. Truncate conversation history: preserve history strictly before messageIdx
    const targetMsg = messages[messageIdx];
    const updatedUserMsg: ChatMessage = {
      id: targetMsg?.id || messageId || `msg_${Date.now()}_user`,
      role: "user",
      content: trimmed || (attachments && attachments.length > 0 ? "Please analyze the attached media/file(s)." : ""),
      timestamp: Date.now(),
      attachments: attachments !== undefined ? attachments : targetMsg?.attachments,
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

    const preservedHistory = messages.slice(0, messageIdx);
    const newStreamMessages = [...preservedHistory, updatedUserMsg];
    const initialSessionMsgs = [...newStreamMessages, assistantPlaceholder];

    setMessages(initialSessionMsgs);
    setEditingMessageId(null);
    setRunningConvoIds((prev) => new Set(prev).add(conversationId));
    executionStartTimeMapRef.current.set(conversationId, Date.now());
    activeSessionMessagesRef.current.set(conversationId, initialSessionMsgs);
    setLiveDurationMs(0);

    // Persist updated conversation to disk
    const stored = loadConversations();
    const target = stored.find((c) => c.id === conversationId);
    if (target) {
      target.messages = newStreamMessages;
      target.updatedAt = Date.now();
      saveConversation(target);
      setConversations(loadConversations());
    }

    // 4. Dispatch re-run request to AI agent with clean context
    if (window.electron?.sendMessage) {
      try {
        const allConvos = conversations.length > 0 ? conversations : loadConversations();
        const payloadMessages = newStreamMessages.map((m) => formatChatMessageForLlm(m, allConvos));

        const res = await window.electron.sendMessage({
          messages: payloadMessages,
          model: activeModelItem?.id || activeModelItem?.name,
          thinkingLevel: undefined,
          workspacePath: currentProject === "Outside Project" ? undefined : currentProject,
          mode: currentMode,
          conversationId,
          authToken: token || undefined,
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
        toast.error(err?.message || "Failed to send edited message");
        setRunningConvoIds((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
        activeSessionMessagesRef.current.delete(conversationId);
      }
    }
  };

  const renderMessageAttachment = (att: AttachedFile) => {
    const mediaSrc = att.url || att.base64;
    if (att.type === "image" && mediaSrc) {
      return (
        <div
          key={att.id}
          onClick={() => setPreviewMedia(att)}
          className="group relative rounded-xl overflow-hidden border border-[#e2e2e4] dark:border-[#383838] hover:border-black/30 dark:hover:border-white/30 bg-[#f4f4f6] dark:bg-black/40 max-w-sm max-h-72 shadow-md cursor-pointer transition-all"
        >
          <img
            src={mediaSrc}
            alt={att.name}
            className="w-full h-full object-contain max-h-72"
          />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white">
            <p className="truncate font-medium">{att.name}</p>
            <span className="text-[10px] text-[#a0a0a0] font-sans tabular-nums">
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
        <FileIcon filename={att.name} className="w-4 h-4 shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate max-w-[200px]" title={att.name}>
            {att.name}
          </span>
          <span className="text-[10px] text-[#a9a9a9] dark:text-[#777777] font-sans tabular-nums">
            {formatFileSize(att.size)}
          </span>
        </div>
      </div>
    );
  };

  // Clean display project name (e.g. "small-web" instead of full path)
  const displayProject = useMemo(() => {
    if (
      typeof currentProject !== "string" ||
      !currentProject ||
      currentProject === "Outside Project" ||
      currentProject === "[object Object]"
    ) {
      return "";
    }
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
    if (conversationWidth === "narrow") return "max-w-[85%] sm:max-w-xl";
    if (conversationWidth === "wide") return "max-w-[85%] sm:max-w-3xl";
    return "max-w-[85%] sm:max-w-2xl";
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
    const totalTokens = inputTokens + outputTokens;
    const cachedInputTokens = Math.round(inputTokens * (cacheHitRate / 100));
    const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);

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
      totalTokens,
      cachedInputTokens,
      uncachedInputTokens,
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

        // Trigger desktop completion notification if enabled
        try {
          const taskNotifsEnabled = localStorage.getItem("const_harness_task_notifications") !== "false";
          if (taskNotifsEnabled) {
            if (window.electron?.showNotification) {
              window.electron.showNotification({
                title: "Task Completed",
                body: "Agent has finished executing the task.",
              }).catch(() => {});
            } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("Task Completed", {
                body: "Agent has finished executing the task.",
              });
            }
          }
        } catch {}

        // Play completion audio chime if enabled
        try {
          const soundEnabled = localStorage.getItem("const_harness_sound_alerts") !== "false";
          if (soundEnabled) {
            playTaskCompletionSound();
          }
        } catch {}

        const queued = queuedMessagesByConvoRef.current[data.conversationId];
        if (queued && queued.length > 0) {
          const [nextItem, ...remaining] = queued;
          if (nextItem) {
            setQueuedMessagesByConvo((prev) => ({
              ...prev,
              [data.conversationId]: remaining,
            }));
            setTimeout(() => {
              handleSendMessageRef.current?.({
                prompt: nextItem.prompt,
                project: currentProjectRef.current || "Outside Project",
                mode: currentModeRef.current,
                attachments: nextItem.attachments,
              });
            }, 150);
          }
        }
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
        if (event.toolName) {
          // Record tool execution directly to local desktop Dexie database
          localDb.recordRequestLog({
            requestId: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            model: event.toolName,
            conversationId: targetConvoId,
            promptTokens: 120,
            completionTokens: 60,
            totalTokens: 180,
            durationMs: 650,
            status: event.isError ? 500 : 200,
            toolNames: [event.toolName],
            createdAt: Date.now(),
          }).catch(() => {});
        }
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

          // Record LLM request directly to local desktop Dexie database
          localDb.recordRequestLog({
            requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            model: target?.model || activeModelItemRef.current?.name || "agy/gemini-3.8-flash-tiered",
            conversationId: targetConvoId,
            promptTokens,
            completionTokens,
            totalTokens,
            durationMs: 1200,
            status: 200,
            createdAt: Date.now(),
          }).catch(() => {});
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
      } else if (event.type === "subagent_started") {
        if (event.agent) {
          setConversationSubAgents((prev) => {
            const next = new Map(prev);
            const list = next.get(targetConvoId) || [];
            const filtered = list.filter((a) => a.id !== event.agent!.id);
            next.set(targetConvoId, [...filtered, event.agent!]);
            return next;
          });
        }
      } else if (event.type === "subagent_updated") {
        if (event.agent) {
          setConversationSubAgents((prev) => {
            const next = new Map(prev);
            const list = next.get(targetConvoId) || [];
            const idx = list.findIndex((a) => a.id === event.agent!.id);
            if (idx >= 0) {
              const updatedList = [...list];
              updatedList[idx] = { ...updatedList[idx]!, ...event.agent! };
              next.set(targetConvoId, updatedList);
            } else {
              next.set(targetConvoId, [...list, event.agent!]);
            }
            return next;
          });
        }
      } else if (event.type === "subagent_finished" || event.type === "subagent_killed") {
        const agentId = event.agentId || event.agent?.id;
        if (agentId) {
          setConversationSubAgents((prev) => {
            const next = new Map(prev);
            const list = next.get(targetConvoId) || [];
            const status =
              event.type === "subagent_killed"
                ? "killed"
                : event.error || event.agent?.status === "failed"
                ? "failed"
                : event.agent?.status || "completed";
            const updatedList = list.map((a) =>
              a.id === agentId
                ? {
                    ...a,
                    ...(event.agent || {}),
                    status: status as any,
                    result: event.result ?? event.agent?.result ?? a.result,
                    error: event.error ?? event.agent?.error ?? a.error,
                    endTime: event.agent?.endTime || Date.now(),
                  }
                : a
            );
            next.set(targetConvoId, updatedList);
            return next;
          });
        }
      } else if (event.type === "steer_message") {
        if (event.message) {
          const steerMsg: ChatMessage = {
            id: `msg_${Date.now()}_steer`,
            role: "user",
            content: event.message.content || "",
            timestamp: event.message.timestamp || Date.now(),
            attachments: event.message.attachments,
          };
          const nextAssistantPlaceholder: ChatMessage = {
            id: `msg_${Date.now()}_assistant`,
            role: "assistant",
            content: "",
            thinking: "",
            traceSteps: [],
            toolCalls: [],
            mutations: [],
            timestamp: Date.now(),
          };
          targetMsgs = [...targetMsgs, steerMsg, nextAssistantPlaceholder];
          activeSessionMessagesRef.current.set(targetConvoId, targetMsgs);
          if (targetConvoId === conversationIdRef.current) {
            setMessages(targetMsgs);
          }
        }
      } else if (event.type === "done") {
        setRunningConvoIds((prev) => {
          const next = new Set(prev);
          next.delete(targetConvoId);
          return next;
        });

        const queued = queuedMessagesByConvoRef.current[targetConvoId];
        if (queued && queued.length > 0) {
          const [nextItem, ...remaining] = queued;
          if (nextItem) {
            setQueuedMessagesByConvo((prev) => ({
              ...prev,
              [targetConvoId]: remaining,
            }));
            setTimeout(() => {
              handleSendMessageRef.current?.({
                prompt: nextItem.prompt,
                project: currentProjectRef.current || "Outside Project",
                mode: currentModeRef.current,
                attachments: nextItem.attachments,
              });
            }, 150);
          }
        }

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
    mode: "request_review" | "ask_before_changes" | "full_access";
    model?: string;
    thinkingLevel?: string;
    attachments?: AttachedFile[];
    maxOutputTokens?: number;
  }) => {
    if ((!prompt.trim() && (!attachments || attachments.length === 0)) || isExecuting) return;

    setEditingPrompt("");

    const effectivePrompt =
      prompt.trim() ||
      (attachments && attachments.length > 0 ? "Please analyze the attached media/file(s)." : "");

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: effectivePrompt,
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
      const modelForTitle = model || activeModelItem?.id || activeModelItem?.name || undefined;
      generateAiTitle(
        prompt || (attachments && attachments[0]?.name) || "New task",
        (aiTitle) => {
          if (conversationIdRef.current === conversationId) {
            setConversationTitle(aiTitle);
          }
          const stored = loadConversations();
          const target = stored.find((c) => c.id === conversationId);
          if (target) {
            target.title = aiTitle;
            target.updatedAt = Date.now();
            saveConversation(target);
            setConversations(loadConversations());
          }
        },
        token || undefined,
        modelForTitle
      );
    }

    const effectiveMode = mode || currentMode;
    const updatedConvo: ConversationItem = {
      id: conversationId,
      title: titleToUse || "New task",
      project: project,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: currentStreamMessages,
      contextUsage: contextUsage,
      mode: effectiveMode,
    };
    saveConversation(updatedConvo);
    setConversations(loadConversations());

    if (window.electron?.sendMessage) {
      try {
        const allConvos = conversations.length > 0 ? conversations : loadConversations();
        const payloadMessages = currentStreamMessages.map((m) => formatChatMessageForLlm(m, allConvos));

        const res = await window.electron.sendMessage({
          messages: payloadMessages,
          model,
          thinkingLevel,
          workspacePath: project,
          mode: effectiveMode,
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
  handleSendMessageRef.current = handleSendMessage;

  const handleRollback = async (record: FileMutationRecord) => {
    if (!window.electron?.rollbackFile) {
      toast.error(t("toast.rollbackDesktopOnly"));
      return;
    }
    try {
      const res = await window.electron.rollbackFile(record);
      if (res.success) {
        toast.success(res.message || t("toast.revertedFile").replace("{file}", record.targetFile));
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
      toast.error(t("toast.rollbackDesktopOnly"));
      return;
    }
    const unrolled = records.filter((r) => !r.rolledBack);
    if (unrolled.length === 0) {
      toast.info(t("toast.allReverted"));
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
      toast.success(t("toast.revertedFiles").replace("{count}", String(successCount)));
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

    // 1b. Immediately mark running subagents as killed in UI
    setConversationSubAgents((prev) => {
      const next = new Map(prev);
      const list = next.get(currentId) || [];
      if (list.length > 0) {
        next.set(
          currentId,
          list.map((a) =>
            a.status === "running"
              ? { ...a, status: "killed", endTime: Date.now() }
              : a
          )
        );
      }
      return next;
    });

    // Terminate running subagents via IPC
    if (window.electron?.killSubAgent && activeSubAgents) {
      for (const sa of activeSubAgents) {
        if (sa.status === "running") {
          window.electron.killSubAgent(sa.id).catch(() => {});
        }
      }
    }

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

    toast.info(t("toast.agentStopped"));
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
        if (decision === "full_access") {
          setCurrentMode("full_access");
          try {
            localStorage.setItem("const_harness_default_mode", "full_access");
          } catch {}
        }
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

  const handleNewChat = (targetProject?: any) => {
    saveCurrentConversationRightPaneState();

    setIsScheduledTasksOpen(false);
    setIsSkillsOpen(false);
    setIsSettingsOpen(false);
    setIsRenameDialogOpen(false);
    setIsTrajectoryOpen(false);
    setTrajectoryTargetConversationId(null);
    setEditingMessageId(null);
    setMessages([]);
    setConversationTitle("");
    const newSessionId = `session_${Date.now()}`;
    setConversationId(newSessionId);
    conversationIdRef.current = newSessionId;
    setEditingPrompt("");
    setLastKnownLlmUsage(null);
    setCurrentMode(getDefaultAgentMode());

    // Reset right pane for fresh new chat session - default closed
    const freshRightPane: ConversationRightPaneState = {
      isOpen: false,
      isExpanded: false,
      tabs: [],
      activeTabId: null,
      reviewMutations: null,
    };
    convoRightPaneMapRef.current.set(newSessionId, freshRightPane);
    storeRightPaneState(newSessionId, freshRightPane);
    setIsRightSidebarOpen(false);
    setIsRightSidebarExpanded(false);
    setRightPaneTabs([]);
    setActiveRightPaneTabId(null);
    setSidebarReviewMutations(null);
    setIsOpeningNewTab(false);

    // Reset bottom panel for fresh new chat session
    const freshBottomPane: ConversationBottomPanelState = {
      isOpen: false,
      tabs: [],
      activeTabId: null,
      height: 260,
    };
    convoBottomPanelMapRef.current.set(newSessionId, freshBottomPane);
    setIsBottomPanelOpen(false);
    setBottomPanelTabs([]);
    setActiveBottomTabId(null);

    // Only update project if targetProject is a valid string, not a MouseEvent or "[object Object]"
    if (
      typeof targetProject === "string" &&
      targetProject.trim() &&
      targetProject !== "[object Object]"
    ) {
      setCurrentProject(targetProject);
      try {
        localStorage.setItem("const_harness_current_project", targetProject);
      } catch {}
    }
  };

  const handleSelectConversation = async (id: string) => {
    if (id === conversationIdRef.current) return;
    setIsScheduledTasksOpen(false);
    setIsSkillsOpen(false);
    setEditingMessageId(null);

    // Save outgoing conversation right pane state
    saveCurrentConversationRightPaneState();

    // If this conversation is currently executing in background, restore its live session messages
    const activeRunningMsgs = activeSessionMessagesRef.current.get(id);
    if (activeRunningMsgs) {
      let target = conversations.find((c) => c.id === id);
      setConversationId(id);
      conversationIdRef.current = id;
      setConversationTitle(target?.title || "Task");
      setCurrentProject(target?.project || "Outside Project");
      if (target?.mode) {
        setCurrentMode(target.mode);
      }
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
      restoreConversationRightPaneState(id);
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
      conversationIdRef.current = target.id;
      setConversationTitle(target.title);
      setCurrentProject(target.project || "Outside Project");
      if (target.mode) {
        setCurrentMode(target.mode);
      }
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
      restoreConversationRightPaneState(target.id);
    }
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    convoRightPaneMapRef.current.delete(id);
    removeStoredRightPaneState(id);
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
    toast.success(t("toast.convoArchived"));
  };

  const handleUnarchiveConversation = async (id: string) => {
    await unarchiveConversation(id);
    const updated = loadConversations();
    setConversations(updated);
    toast.success(t("toast.convoRestored"));
  };

  const handleTogglePinConversation = async (id: string) => {
    const target = conversations.find((c) => c.id === id);
    const nextPinned = !target?.isPinned;
    await pinConversation(id, nextPinned);
    const updated = loadConversations();
    setConversations(updated);
    toast.success(nextPinned ? t("toast.taskPinned") : t("toast.taskUnpinned"));
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

  // Find in Task matches calculation & auto-scroll
  const taskFindMatches = useMemo(() => {
    if (!taskFindQuery.trim()) return [];
    const q = taskFindQuery.toLowerCase();
    const matches: number[] = [];
    messages.forEach((m, idx) => {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content || "");
      if (text.toLowerCase().includes(q)) {
        matches.push(idx);
      }
    });
    return matches;
  }, [messages, taskFindQuery]);

  useEffect(() => {
    if (!isTaskFindOpen || taskFindMatches.length === 0) return;
    const targetIdx = taskFindMatches[taskFindIndex];
    if (targetIdx !== undefined && messages[targetIdx]) {
      const targetMsg = messages[targetIdx];
      const el = document.querySelector(`[data-chat-anchor-key="${targetMsg.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [isTaskFindOpen, taskFindIndex, taskFindMatches, messages]);

  // Task Navigation History (for Navigate Back Ctrl+[ and Navigate Forward Ctrl+])
  const visitedHistoryRef = useRef<string[]>([]);
  const forwardHistoryRef = useRef<string[]>([]);
  const isNavigatingHistoryRef = useRef(false);

  useEffect(() => {
    if (!conversationId) return;
    if (isNavigatingHistoryRef.current) {
      isNavigatingHistoryRef.current = false;
      return;
    }
    const stack = visitedHistoryRef.current;
    if (stack[stack.length - 1] !== conversationId) {
      stack.push(conversationId);
      forwardHistoryRef.current = [];
    }
  }, [conversationId]);

  const handleNavigateBack = useCallback(() => {
    const stack = visitedHistoryRef.current;
    if (stack.length > 1) {
      const current = stack.pop()!;
      forwardHistoryRef.current.push(current);
      const prevId = stack[stack.length - 1];
      if (prevId) {
        isNavigatingHistoryRef.current = true;
        handleSelectConversation(prevId);
      }
    }
  }, [handleSelectConversation]);

  const handleNavigateForward = useCallback(() => {
    const forward = forwardHistoryRef.current;
    if (forward.length > 0) {
      const nextId = forward.pop()!;
      visitedHistoryRef.current.push(nextId);
      isNavigatingHistoryRef.current = true;
      handleSelectConversation(nextId);
    }
  }, [handleSelectConversation]);

  const handlePreviousTask = useCallback(() => {
    const list = conversationsRef.current;
    if (!list || list.length === 0) return;
    const curIdx = list.findIndex((c) => c.id === conversationIdRef.current);
    if (curIdx > 0 && list[curIdx - 1]) {
      handleSelectConversation(list[curIdx - 1]!.id);
    }
  }, [handleSelectConversation]);

  const handleNextTask = useCallback(() => {
    const list = conversationsRef.current;
    if (!list || list.length === 0) return;
    const curIdx = list.findIndex((c) => c.id === conversationIdRef.current);
    if (curIdx >= 0 && curIdx < list.length - 1 && list[curIdx + 1]) {
      handleSelectConversation(list[curIdx + 1]!.id);
    }
  }, [handleSelectConversation]);

  const handleCycleSessionMode = useCallback(() => {
    const modes: Array<"ask_before_changes" | "request_review" | "full_access"> = [
      "ask_before_changes",
      "request_review",
      "full_access",
    ];
    const curIdx = modes.indexOf(currentModeRef.current);
    const nextMode = modes[(curIdx + 1) % modes.length] ?? "ask_before_changes";
    setCurrentMode(nextMode);
    toast({
      title: "Session Mode Changed",
      description: `Mode set to: ${nextMode.replace(/_/g, " ")}`,
    });
  }, []);

  const handleCloseCurrentContext = useCallback(() => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }
    if (isSearchOpen) {
      setIsSearchOpen(false);
      return;
    }
    if (isScheduledTasksOpen) {
      setIsScheduledTasksOpen(false);
      return;
    }
    if (isSkillsOpen) {
      setIsSkillsOpen(false);
      return;
    }
    if (isTaskFindOpen) {
      setIsTaskFindOpen(false);
      return;
    }
    if (isRightSidebarOpenRef.current) {
      if (activeRightPaneTabIdRef.current) {
        handleCloseTab(activeRightPaneTabIdRef.current);
      } else {
        setIsRightSidebarOpen(false);
      }
    }
  }, [isSettingsOpen, isSearchOpen, isScheduledTasksOpen, isSkillsOpen, isTaskFindOpen, handleCloseTab]);

  // Global Keyboard Shortcuts matching ZCode Reference
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const activeShortcuts = getSavedShortcuts();
      const check = (id: string) => matchesShortcutCommand(e, id, activeShortcuts);

      // 1. Open Command Center: Ctrl+K or Ctrl+Shift+P (or Ctrl+P)
      if (check("open_command_center") || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p")) {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // 2. Open Settings: Ctrl+,
      if (check("open_settings")) {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
        return;
      }

      // 3. Find in Task: Ctrl+F
      if (check("find_in_task")) {
        e.preventDefault();
        setIsTaskFindOpen(true);
        window.dispatchEvent(new CustomEvent("const:find-in-task"));
        return;
      }

      // 4. Toggle Sidebar: Ctrl+B
      if (check("toggle_sidebar")) {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // 5. Toggle Light/Dark Theme: Ctrl+Shift+L
      if (check("toggle_theme")) {
        e.preventDefault();
        const curTheme = getSavedTheme();
        const isDark = curTheme === "dark" || (curTheme === "system" && getSystemTheme() === "dark");
        setSavedTheme(isDark ? "light" : "dark");
        return;
      }

      // 6. Toggle Terminal: Ctrl+J
      if (check("toggle_terminal")) {
        e.preventDefault();
        handleToggleBottomPanel();
        return;
      }

      // 7. Toggle Side Pane: Ctrl+Alt+B
      if (check("toggle_side_pane")) {
        e.preventDefault();
        handleToggleRightSidebar();
        return;
      }

      // 8. Previous Task: Ctrl+Shift+[
      if (check("previous_task")) {
        e.preventDefault();
        handlePreviousTask();
        return;
      }

      // 9. Next Task: Ctrl+Shift+]
      if (check("next_task")) {
        e.preventDefault();
        handleNextTask();
        return;
      }

      // 10. Navigate Back: Ctrl+[
      if (check("navigate_back") && !isInput) {
        e.preventDefault();
        handleNavigateBack();
        return;
      }

      // 11. Navigate Forward: Ctrl+]
      if (check("navigate_forward") && !isInput) {
        e.preventDefault();
        handleNavigateForward();
        return;
      }

      // 12. Open Model Menu: Ctrl+M
      if (check("open_model_menu")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("const:open-model-menu"));
        return;
      }

      // 13. Cycle Session Mode: Ctrl+Shift+M
      if (check("cycle_session_mode")) {
        e.preventDefault();
        handleCycleSessionMode();
        return;
      }

      // 14. Cycle Thought Level: Ctrl+T
      if (check("cycle_thought_level")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("const:cycle-thought-level"));
        return;
      }

      // 15. New Task: Ctrl+N (Reference from ZCode)
      if (check("new_task")) {
        const isInModal = target?.closest?.("[role='dialog'], [data-modal]");
        if (!isInModal) {
          e.preventDefault();
          handleNewChat();
          return;
        }
      }

      // 16. Open Workspace: Ctrl+O
      if (check("open_workspace")) {
        e.preventDefault();
        handleOpenWorkspaceFromPalette();
        return;
      }

      // 17. Close Current Context: Ctrl+W
      if (check("close_current_context")) {
        e.preventDefault();
        handleCloseCurrentContext();
        return;
      }

      // 18. Zoom In: Ctrl++
      if (check("zoom_in")) {
        e.preventDefault();
        zoomIn();
        return;
      }

      // 19. Zoom Out: Ctrl+-
      if (check("zoom_out")) {
        e.preventDefault();
        zoomOut();
        return;
      }

      // 20. Reset Zoom: Ctrl+0
      if (check("reset_zoom")) {
        e.preventDefault();
        resetZoom();
        return;
      }
    };

    const handleOpenCommandPalette = () => setIsSearchOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("const:open-command-palette", handleOpenCommandPalette);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("const:open-command-palette", handleOpenCommandPalette);
    };
  }, [
    handleNewChat,
    handleOpenTerminal,
    handleToggleBottomPanel,
    handleToggleRightSidebar,
    handleOpenWorkspaceFromPalette,
    handlePreviousTask,
    handleNextTask,
    handleNavigateBack,
    handleNavigateForward,
    handleCycleSessionMode,
    handleCloseCurrentContext,
  ]);

  return (
    <div
      className={cn(
        "h-full w-full max-w-full flex bg-[#ececee] dark:bg-[#101011] text-[#262626] dark:text-[#d4d4d4] overflow-hidden select-none p-2.5",
        isSidebarOpen ? "gap-2.5" : "gap-0"
      )}
    >
      {/* 1. Left Sidebar (Collapsible with smooth slide, NO bouncing) */}
      <div
        className={`shrink-0 overflow-hidden transition-[width,opacity] duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
          isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="w-64 h-full">
          <Sidebar
            user={effectiveUser}
            onSignOut={onSignOut}
            onSwitchAccount={onSwitchAccount}
            onCollapse={() => setIsSidebarOpen(false)}
            onNewChat={handleNewChat}
            onNewChatOutside={() => handleNewChat("Outside Project")}
            conversations={conversations}
            activeConversationId={conversationId}
            runningConvoIds={runningConvoIds}
            pendingApprovals={pendingApprovals}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onRenameConversation={handleRenameConversation}
            onArchiveConversation={handleArchiveConversation}
            onUnarchiveConversation={handleUnarchiveConversation}
            onOpenSettings={(tab) => handleOpenSettings(tab || "general")}
            onOpenScheduledTasks={() => {
              setIsScheduledTasksOpen(true);
              setIsSkillsOpen(false);
            }}
            isScheduledTasksActive={isScheduledTasksOpen}
            onOpenSkills={() => {
              setIsSkillsOpen(true);
              setIsScheduledTasksOpen(false);
            }}
            isSkillsActive={isSkillsOpen}
            onOpenSearch={() => setIsSearchOpen(true)}
          />
        </div>
      </div>

      {/* 2. Main Content Area */}
      <main
        ref={mainContainerRef}
        className="flex-1 min-w-0 h-full relative overflow-hidden"
      >
        {isSkillsOpen ? (
          <div className="h-full w-full flex flex-col overflow-hidden bg-[#f8f8f8] dark:bg-[#161616] text-[#262626] dark:text-[#d4d4d4] rounded-[10px] border border-[#dedee2] dark:border-[#282828] shadow-xs">
            {/* Top Toolbar matching ScheduledTasks / TopToolbar */}
            <div
              className="h-10 px-4 flex items-center justify-between shrink-0 select-none relative z-30"
              style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
              <div
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                className="flex items-center gap-1.5 text-[13px]"
              >
                <button
                  type="button"
                  onClick={() => setIsSkillsOpen(false)}
                  className="flex items-center gap-1.5 text-xs text-[#969696] hover:text-foreground hover:bg-[#dedee2]/60 dark:hover:bg-[#222222] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t("common.back")}</span>
                </button>
              </div>

              {/* Window Controls matching ScheduledTasksView and TopToolbar */}
              <div
                className="flex items-center gap-0.5 text-[#969696] shrink-0 ml-auto"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => window.electron?.minimize?.()}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title={t("topToolbar.minimize")}
                  aria-label={t("topToolbar.minimize")}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => window.electron?.maximize?.()}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title={isWindowMaximized ? t("topToolbar.restore") : t("topToolbar.maximize")}
                  aria-label={isWindowMaximized ? t("topToolbar.restore") : t("topToolbar.maximize")}
                >
                  {isWindowMaximized ? (
                    <Copy className="w-3 h-3 rotate-180" />
                  ) : (
                    <Square className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.electron?.close?.()}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#e81123] hover:text-white transition-colors cursor-pointer"
                  title={t("topToolbar.close")}
                  aria-label={t("topToolbar.close")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scroll Area with SkillsSettings */}
            <ScrollArea className="flex-1 w-full h-full min-h-0">
              <div className="max-w-7xl mx-auto px-6 sm:px-10 py-7 space-y-9">
                <SkillsSettings
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                />
              </div>
            </ScrollArea>
          </div>
        ) : isScheduledTasksOpen ? (
          <div className="h-full w-full flex flex-col overflow-hidden bg-[#f8f8f8] dark:bg-[#161616] text-[#262626] dark:text-[#d4d4d4] rounded-[10px] border border-[#dedee2] dark:border-[#282828] shadow-xs">
            <ScheduledTasksView
              onBackToWorkspace={() => setIsScheduledTasksOpen(false)}
              onOpenSession={(sessionId) => {
                setIsScheduledTasksOpen(false);
                handleSelectConversation(sessionId);
              }}
              currentWorkspacePath={currentProject === "Outside Project" ? undefined : currentProject}
            />
          </div>
        ) : (
          <>
            {/* Center Main Chat Panel Card */}
            <div
              className={cn(
                "h-full bg-[#f8f8f8] dark:bg-[#161616] text-[#262626] dark:text-[#d4d4d4] border border-[#dedee2] dark:border-[#282828] shadow-xs flex flex-col overflow-hidden relative rounded-[10px]",
                !isDraggingRightSidebar && "transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
              )}
              style={{
                width: !isRightSidebarOpen
                  ? "100%"
                  : `calc(100% - ${rightSidebarWidth + 10}px)`,
              }}
            >
              {(() => {
                const activeConvo = conversations.find((c) => c.id === conversationId);
                return (
                  <TopToolbar
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                    onNewChat={() => handleNewChat()}
                    conversationTitle={conversationTitle}
                    project={displayProject}
                    conversationId={conversationId}
                    isPinned={Boolean(activeConvo?.isPinned)}
                    workspacePath={currentProject === "Outside Project" ? undefined : currentProject}
                    onTogglePin={() => handleTogglePinConversation(conversationId)}
                    onOpenRename={() => setIsRenameDialogOpen(true)}
                    onArchive={() => handleArchiveConversation(conversationId)}
                    onOpenSettings={handleOpenSettings}
                    onOpenTrajectory={() => handleOpenTrajectory()}
                    isRightSidebarOpen={isRightSidebarOpen}
                    onToggleRightSidebar={handleToggleRightSidebar}
                    onOpenTerminal={handleToggleBottomPanel}
                    isBottomPanelOpen={isBottomPanelOpen}
                    onToggleBottomPanel={handleToggleBottomPanel}
                    onOpenBrowser={handleOpenBrowser}
                  />
                );
              })()}

              {/* Main Conversation Canvas (Landing or Stream) */}
              <div className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
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
                  key={conversationId}
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
                  mode={currentMode}
                  onModeChange={handleModeChange}
                  conversations={conversations}
                  sessionMedia={sessionMediaAttachments}
                  onOpenFilePreview={handleOpenFilePreview}
                  onOpenTrajectory={handleOpenTrajectory}
                  queuedMessages={currentQueuedMessages}
                  onQueueMessage={handleQueueMessage}
                  onRemoveQueuedMessage={handleRemoveQueuedMessage}
                  onEditQueuedMessage={handleEditQueuedMessage}
                  onSteerMessage={handleSteerMessage}
                  onSteerAllQueuedMessages={handleSteerAllQueuedMessages}
                  onSteerDraft={handleSteerDraft}
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

            {/* Top-Right Floating Card: Unified Todo & Sub-Agents */}
            {((activeTodos && activeTodos.length > 0) || (activeSubAgents && activeSubAgents.length > 0)) && (
              <div className="absolute top-4 right-6 z-30 flex flex-col gap-2.5 items-end pointer-events-none">
                <FloatingWorkbenchCard
                  todos={activeTodos || []}
                  subagents={activeSubAgents || []}
                  isExecuting={isExecuting}
                  onSelectSubAgent={handleOpenSubAgent}
                  onKillAgent={handleKillSubAgent}
                  className="pointer-events-auto"
                />
              </div>
            )}

            {/* In-Task Find Bar (Ctrl+F) */}
            {isTaskFindOpen && (
              <div className="absolute top-4 right-6 z-40 flex items-center gap-1.5 p-1.5 rounded-xl border border-[#dedee2] dark:border-[#38383c] bg-white dark:bg-[#1c1c1e] shadow-xl text-xs text-[#262626] dark:text-white animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#737373] dark:text-[#888888] pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={taskFindQuery}
                    onChange={(e) => {
                      setTaskFindQuery(e.target.value);
                      setTaskFindIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (taskFindMatches.length > 0) {
                          if (e.shiftKey) {
                            setTaskFindIndex((prev) => (prev - 1 + taskFindMatches.length) % taskFindMatches.length);
                          } else {
                            setTaskFindIndex((prev) => (prev + 1) % taskFindMatches.length);
                          }
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setIsTaskFindOpen(false);
                      }
                    }}
                    placeholder="Find in task..."
                    className="w-48 pl-8 pr-2 py-1 text-xs rounded-lg border border-[#e2e2e4] dark:border-[#2f2f32] bg-[#f9f9fb] dark:bg-[#141416] text-[#262626] dark:text-white placeholder-[#888888] dark:placeholder-[#666666] outline-none focus:border-[#737373] dark:focus:border-[#6e6e72]"
                  />
                </div>

                <span className="text-[11px] text-[#737373] dark:text-[#888888] px-1 select-none whitespace-nowrap min-w-[50px] text-center">
                  {taskFindQuery.trim()
                    ? taskFindMatches.length > 0
                      ? `${taskFindIndex + 1} of ${taskFindMatches.length}`
                      : "0 results"
                    : ""}
                </span>

                <button
                  type="button"
                  disabled={taskFindMatches.length === 0}
                  onClick={() =>
                    setTaskFindIndex((prev) => (prev - 1 + taskFindMatches.length) % taskFindMatches.length)
                  }
                  className="p-1 rounded text-[#737373] hover:text-[#262626] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 cursor-pointer"
                  title="Previous match (Shift+Enter)"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={taskFindMatches.length === 0}
                  onClick={() =>
                    setTaskFindIndex((prev) => (prev + 1) % taskFindMatches.length)
                  }
                  className="p-1 rounded text-[#737373] hover:text-[#262626] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 cursor-pointer"
                  title="Next match (Enter)"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsTaskFindOpen(false)}
                  className="p-1 rounded text-[#737373] hover:text-[#262626] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ml-0.5"
                  title="Close (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Scrollable Message Stream with @const/ui ScrollArea */}
            <ScrollArea
              ref={chatScrollRef}
              data-chat-viewport="true"
              className="flex-1 w-full h-full min-w-0 select-text [&>div>div[style]]:!block"
            >
              <div className={cn("w-full max-w-full mx-auto px-3.5 sm:px-6 md:px-8 py-6 flex flex-col gap-6 select-text", streamWidthClass)}>
                {messages.map((msg, idx) => (
                  <div key={msg.id} data-chat-anchor-key={msg.id} className="w-full flex flex-col select-text cursor-text">
                    <ChatMessageItem
                      message={msg}
                      idx={idx}
                      isExecuting={isExecuting && idx === messages.length - 1}
                      liveDurationMs={liveDurationMs}
                      activeApproval={activeApproval}
                      expandedUserMessageId={expandedUserMessageId}
                      onToggleExpandUserMessage={(id) => setExpandedUserMessageId(id)}
                      copiedId={copiedId}
                      onCopyMessage={handleCopyMessage}
                      isEditing={editingMessageId === msg.id}
                      onStartEdit={handleStartEditMessage}
                      onCancelEdit={handleCancelEditMessage}
                      onSubmitEdit={handleSubmitEditMessage}
                      onRollback={handleRollback}
                      onRollbackAll={handleRollbackAll}
                      onAnswerQuestion={handleAnswerQuestion}
                      onOpenFileDiff={handleOpenFileDiff}
                      onOpenFilePreview={handleOpenFilePreview}
                      onOpenTrajectory={handleOpenTrajectory}
                      onOpenReview={handleOpenReview}
                      onOpenSubAgent={handleOpenSubAgentFromTrace}
                      renderAttachment={renderMessageAttachment}
                      userBubbleWidthClass={userBubbleWidthClass}
                    />

                    {/* Assistant hover action bar: Copy, Good, Bad, and Timestamp */}
                    {!isExecuting && msg.role === "assistant" && msg.content && (
                          <div className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[#a9a9a9] dark:text-[#888888] select-none pointer-events-none group-hover:pointer-events-auto">
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
                            <span className="text-[11px] font-sans tabular-nums text-[#a9a9a9] dark:text-[#777777] ml-1.5">
                              {formatMessageTimestamp(msg.timestamp)}
                            </span>
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
                      key={conversationId}
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
                      mode={currentMode}
                      onModeChange={handleModeChange}
                      conversations={conversations}
                      sessionMedia={sessionMediaAttachments}
                      onOpenFilePreview={handleOpenFilePreview}
                      onOpenTrajectory={handleOpenTrajectory}
                      queuedMessages={currentQueuedMessages}
                      onQueueMessage={handleQueueMessage}
                      onRemoveQueuedMessage={handleRemoveQueuedMessage}
                      onEditQueuedMessage={handleEditQueuedMessage}
                      onSteerMessage={handleSteerMessage}
                      onSteerAllQueuedMessages={handleSteerAllQueuedMessages}
                      onSteerDraft={handleSteerDraft}
                    />
                  )}
                </SmoothCardMorph>
              </div>
            </div>
          </div>
        )}
              </div>

              {/* Bottom Panel (Docked Terminal matching reference video) */}
              {bottomPanelTabs.length > 0 && (
                <div
                  className={cn(
                    "w-full shrink-0 overflow-hidden transition-[height,opacity] duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] z-30",
                    isBottomPanelOpen ? "opacity-100" : "h-0 opacity-0 pointer-events-none"
                  )}
                  style={{ height: isBottomPanelOpen ? `${bottomPanelHeight}px` : 0 }}
                >
                  <BottomPanel
                    height={bottomPanelHeight}
                    onHeightChange={setBottomPanelHeight}
                    tabs={bottomPanelTabs}
                    activeTabId={activeBottomTabId}
                    onSelectTab={setActiveBottomTabId}
                    onCloseTab={handleCloseBottomTab}
                    onNewTab={handleNewBottomTab}
                    onReorderTabs={handleReorderBottomTabs}
                    onClearTerminal={handleClearBottomTerminal}
                    onClose={() => setIsBottomPanelOpen(false)}
                    onDraggingChange={setIsDraggingBottomPanel}
                  />
                </div>
              )}
            </div>

            {/* Splitter resize handle in the 10px gap between Main Chat and SidePanel */}
            <div
              onMouseDown={handleMouseDownRightResize}
              onDoubleClick={() => setRightSidebarWidth(clampRightSidebarWidth(480))}
              className={cn(
                "absolute top-0 bottom-0 cursor-col-resize select-none flex items-center justify-center z-25 overflow-hidden",
                !isDraggingRightSidebar && "transition-[right,opacity] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                isRightSidebarOpen && !isRightSidebarExpanded
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              )}
              style={{
                right: `${rightSidebarWidth}px`,
                width: "10px",
              }}
              title={t("rightPane.dragToResize")}
            >
              <div className="w-[1px] h-full bg-transparent group-hover:bg-[#dedee2] dark:group-hover:bg-[#282828] transition-colors" />
            </div>

            {/* Right SidePanel Card: Anchored to the right edge, smoothly expands from right to left */}
            <div
              className={cn(
                "absolute top-0 bottom-0 right-0 h-full overflow-hidden flex flex-row justify-end z-30",
                !isDraggingRightSidebar && "transition-[width,opacity] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                isRightSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              )}
              style={{
                width: !isRightSidebarOpen
                  ? 0
                  : isRightSidebarExpanded
                  ? "100%"
                  : `${rightSidebarWidth}px`,
              }}
            >
              <div
                className="h-full overflow-hidden shrink-0"
                style={{
                  width: isRightSidebarExpanded ? "100%" : `${rightSidebarWidth}px`,
                  minWidth: isRightSidebarExpanded ? "100%" : `${rightSidebarWidth}px`,
                  transition: !isDraggingRightSidebar
                    ? "width 300ms cubic-bezier(0.16,1,0.3,1), min-width 300ms cubic-bezier(0.16,1,0.3,1)"
                    : "none",
                }}
              >
                <RightPane
                  width={isRightSidebarExpanded ? (mainContainerWidth || (typeof window !== "undefined" ? window.innerWidth : 1280)) : rightSidebarWidth}
                  maxWidth={clampRightSidebarWidth(window.innerWidth)}
                  minWidth={300}
                  onWidthChange={(w) => setRightSidebarWidth(clampRightSidebarWidth(w))}
                  onDraggingChange={setIsDraggingRightSidebar}
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
                  subagents={activeSubAgents || []}
                  onKillAgent={handleKillSubAgent}
                  parentMessages={messages}
                  parentConversationTitle={conversationTitle}
                  parentConversationId={conversationId}
                  defaultModel={activeModelItem?.id || activeModelItem?.name || "gemini-3.8-flash"}
                  onOpenFilePreview={handleOpenFilePreview}
                  onOpenTrajectory={handleOpenTrajectory}
                  conversations={conversations}
                  onInsertToMainPrompt={(text) => {
                    setEditingPrompt((prev) => (prev ? `${prev}\n\n${text}` : text));
                  }}
                  onCollapse={() => {
                    setIsRightSidebarExpanded(false);
                    setIsRightSidebarOpen(false);
                  }}
                  isExpanded={isRightSidebarExpanded}
                  onToggleExpand={() => setIsRightSidebarExpanded((prev) => !prev)}
                />
              </div>
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
        onOpenScheduledTasks={() => {
          setIsScheduledTasksOpen(true);
          setIsSkillsOpen(false);
        }}
        onOpenSkills={() => {
          setIsSkillsOpen(true);
          setIsScheduledTasksOpen(false);
        }}
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
      {(() => {
        const activeTrajectoryConvoId = trajectoryTargetConversationId || conversationId;
        const allConvos = conversations.length > 0 ? conversations : loadConversations();
        const targetConvo =
          activeTrajectoryConvoId === conversationId
            ? null
            : allConvos.find((c) => c.id === activeTrajectoryConvoId);
        const activeTrajectoryTitle = targetConvo?.title || (activeTrajectoryConvoId === conversationId ? conversationTitle : "Session Trajectory");
        const activeTrajectoryMessages = targetConvo?.messages || (activeTrajectoryConvoId === conversationId ? messages : []);

        return (
          <TrajectoryDialog
            open={isTrajectoryOpen}
            onClose={() => {
              setIsTrajectoryOpen(false);
              setTrajectoryTargetConversationId(null);
            }}
            conversationId={activeTrajectoryConvoId}
            conversationTitle={activeTrajectoryTitle}
            messages={activeTrajectoryMessages}
          />
        );
      })()}

      {/* Settings Modal (Antigravity Style Pop-up) */}
      <SettingsView
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onBackToWorkspace={() => setIsSettingsOpen(false)}
        initialTab={settingsTab}
        currentProject={currentProject}
        user={effectiveUser}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
      />
    </div>
  );
}

export default function App() {
  const { t, language } = useTranslation();
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
            toast.info(t("toast.signInCancelled"));
            return;
          }

          // Strict UI guard: If user is no longer waiting (clicked Cancel), reject callback
          if (!isWaitingAuthRef.current) {
            toast.info(t("toast.signInCancelled"));
            return;
          }

          if (data.token) {
            localStorage.setItem("const_harness_auth_token", data.token);
            setToken(data.token);
            setIsWaitingAuth(false);
            isWaitingAuthRef.current = false;
            toast.success(t("toast.signedIn"));
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
    toast.info(t("toast.signInCancelled"));
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
    toast.success(t("toast.signedIn"));
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
    <div className="h-full max-h-full w-full overflow-hidden flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Top Header Drag & Window Controls Strip */}
      <LoginTitleBar />

      {/* Split Content Area */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex">
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
              {t("auth.signInTitle")}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("auth.signInDesc")}
            </p>

            <div className="mt-8 min-h-[148px]">
              {!isWaitingAuth ? (
                <Button
                  onClick={handleSignIn}
                  size="lg"
                  className="w-full h-12 rounded-xl text-sm font-medium gap-2 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <LogIn className="h-4 w-4" />
                  {t("auth.signInButton")}
                </Button>
              ) : (
                <div className="space-y-3 animate-in fade-in duration-300">
                  {/* Button 1: Waiting state matching user reference image */}
                  <div className="w-full h-12 rounded-xl text-sm font-medium gap-2.5 flex items-center justify-center bg-[#222222] border border-[#383838] text-[#969696] select-none cursor-wait transition-all">
                    <Loader2 className="h-4 w-4 animate-spin text-[#969696]" />
                    <span>{t("auth.waitingAuth")}</span>
                  </div>

                  {/* Button 2: Cancel button smoothly animated in */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelAuth}
                    className="w-full h-12 rounded-xl text-sm font-medium border border-[#383838] bg-[#2b2b2b] hover:bg-[#383838] text-[#d4d4d4] hover:text-white cursor-pointer transition-all active:scale-[0.99] animate-in fade-in slide-in-from-top-1 duration-200"
                  >
                    {t("common.cancel")}
                  </Button>

                  {/* Manual token fallback */}
                  <div className="pt-2 text-center">
                    {!showManualInput ? (
                      <button
                        type="button"
                        onClick={() => setShowManualInput(true)}
                        className="text-[11px] text-[#5d5d5d] hover:text-[#969696] underline underline-offset-4 cursor-pointer transition-colors"
                      >
                        {t("auth.havingTrouble")}
                      </button>
                    ) : (
                      <form
                        onSubmit={handleManualTokenSubmit}
                        className="space-y-2 text-left mt-2 p-3 rounded-xl bg-[#222222] border border-[#383838] animate-in fade-in duration-200"
                      >
                        <label className="text-[11px] font-medium text-[#969696]">
                          {t("auth.pasteToken")}
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
                            {t("auth.verify")}
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
              <span>{language === "id" ? "Indonesia" : language === "ja" ? "日本語" : language === "zh" ? "中文" : language === "es" ? "Español" : "English"}</span>
            </div>
            <span>{t("auth.allRightsReserved")}</span>
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
    </div>
  );
}
