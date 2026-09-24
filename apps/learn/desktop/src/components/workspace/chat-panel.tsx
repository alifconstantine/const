import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowRight,
  ArrowUp,
  Square,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Paperclip,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  X,
  Mic,
  MoreVertical,
  Folder,
  History,
  Brain,
  MessageCirclePlus,
  Pencil,
  Search,
  Settings,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Pin,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  ScrollArea,
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  toast,
  AVAILABLE_CONNECTORS,
} from "@const/ui";
import { getConnectedConnectorIds } from "../../lib/connectors-service";
import { DEFAULT_MODELS } from "@const/agent/models";
import type { ModelConfig, AgentMessage } from "@const/agent/types";
import type { FileMutationRecord } from "@const/agent";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, type LocalSource } from "../../lib/db";
import { buildGroundedContext } from "../../lib/grounding/context-builder";
import { buildGroundedSystemPrompt } from "../../lib/grounding/grounding-prompt";
import { useI18n } from "../../lib/i18n";
import {
  calculateConversationMetrics,
  calculateContextUsage,
  formatTokenDisplay,
  formatDurationDisplay,
  parseContextWindowTokens,
} from "../../lib/telemetry";
import { ChatHistoryPanel } from "./chat-history-panel";
import {
  ExecutionTrace,
  MutationsSummaryCard,
  type DisplayToolCall,
  type TraceStep,
} from "./execution-trace";
import { MarkdownContent } from "./markdown-content";
import { SourcePreviewDialog } from "./source-preview-dialog";
import { ImageLightbox } from "./image-lightbox";
import { ApprovalCard } from "./approval-card";
import type { ApprovalRequestData, ApprovalDecision } from "../../vite-env";

interface ChatPanelProps {
  learnId?: string;
  workspacePath?: string;
  permissionMode?: "ask_before_changes" | "full_access";
  sourcesCount?: number;
  onSelectPromptChip?: (prompt: string) => void;
  onSendMessage?: (message: string) => void;
  onAddSource?: () => void;
  onOpenSettings?: (tab?: string) => void;
  externalPrompt?: string | null;
  onExternalPromptConsumed?: () => void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
  onMutationsChange?: (mutations: FileMutationRecord[]) => void;
  onOpenBrowser?: (url: string) => void;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  thinking?: string;
  toolCalls?: DisplayToolCall[];
  traceSteps?: TraceStep[];
  mutations?: FileMutationRecord[];
  attachments?: AttachedFile[];
  isStreaming?: boolean;
  createdAt?: number;
  durationMs?: number;
}

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: "image" | "video" | "pdf" | "code" | "document" | "other";
  url?: string;
  base64?: string;
  path?: string;
  imageIndex?: number;
}

function cleanUserMessageContent(content: string): string {
  if (!content) return "";
  let cleaned = content;
  cleaned = cleaned.replace(/\n\n\[(?:Lampiran [Mm]edia|Attached [Mm]edia)[\s\S]*$/, "");
  cleaned = cleaned.replace(/\n\n\[Attached media \/ Lampiran media:[\s\S]*$/, "");
  cleaned = cleaned.replace(/\n\n\[(?:Referensi Sumber Dibawa|Carried Source References)[\s\S]*$/, "");
  cleaned = cleaned.replace(/\n\n- \[(?:Lampiran|Attachment):[\s\S]*$/, "");
  cleaned = cleaned.replace(/\n\n- \[(?:Sumber|Source):[\s\S]*$/, "");
  cleaned = cleaned.replace(/^\[(?:Attached media \/ Lampiran media|Lampiran [Mm]edia|Attached [Mm]edia)[\s\S]*?\]\n*/, "");
  return cleaned.trim();
}

function formatMessageTimestamp(ts?: number): string {
  if (!ts) return "";
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getModelProviderInfo(model: ModelConfig): { providerId: string; providerName: string } {
  const p = (model.provider || "").toLowerCase().trim();
  const rawName = (model as any).providerName;
  if (rawName && typeof rawName === "string" && rawName.trim().length > 0) {
    const cleanRaw = rawName.trim();
    if (cleanRaw.toLowerCase().includes("const")) {
      return { providerId: "const", providerName: "Const Router" };
    }
    return { providerId: p || cleanRaw.toLowerCase().replace(/\s+/g, "-"), providerName: cleanRaw };
  }

  if (p === "const" || p.startsWith("const") || p === "native" || p === "const-engine" || p === "const router") {
    return { providerId: "const", providerName: "Const Router" };
  }
  if (p === "google" || p === "gemini") {
    return { providerId: "google", providerName: "Google Gemini" };
  }
  if (p === "openai") {
    return { providerId: "openai", providerName: "OpenAI" };
  }
  if (p === "anthropic") {
    return { providerId: "anthropic", providerName: "Anthropic" };
  }
  if (p === "deepseek") {
    return { providerId: "deepseek", providerName: "DeepSeek" };
  }
  if (p === "groq") {
    return { providerId: "groq", providerName: "Groq" };
  }
  if (p === "openrouter") {
    return { providerId: "openrouter", providerName: "OpenRouter" };
  }
  if (p === "ollama") {
    return { providerId: "ollama", providerName: "Ollama" };
  }

  const id = model.id.toLowerCase();
  if (id.startsWith("gemini-") || id.includes("gemini")) {
    return { providerId: "const", providerName: "Const Router" };
  }
  if (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3")) {
    return { providerId: "openai", providerName: "OpenAI" };
  }
  if (id.startsWith("claude-")) {
    return { providerId: "anthropic", providerName: "Anthropic" };
  }
  if (id.startsWith("deepseek-")) {
    return { providerId: "deepseek", providerName: "DeepSeek" };
  }
  if (id.startsWith("combo/")) {
    return { providerId: "const", providerName: "Const Router" };
  }

  if (p) {
    const formatted = p.charAt(0).toUpperCase() + p.slice(1);
    return { providerId: p, providerName: formatted };
  }

  return { providerId: "const", providerName: "Const Router" };
}

function formatThinkingLabel(level?: string): string {
  if (!level) return "Medium";
  const clean = level.toLowerCase().trim();
  if (clean === "low") return "Low";
  if (clean === "medium") return "Medium";
  if (clean === "high") return "High";
  if (clean === "xhigh" || clean === "extra_high" || clean === "extra-high") return "X-High";
  if (clean === "max") return "Max";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function ChatPanel({
  learnId,
  workspacePath,
  permissionMode = "ask_before_changes",
  sourcesCount = 0,
  onSelectPromptChip,
  onAddSource,
  onOpenSettings,
  externalPrompt,
  onExternalPromptConsumed,
  onOpenFileDiff,
  onMutationsChange,
  onOpenBrowser,
}: ChatPanelProps) {
  const { t, language } = useI18n();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);

  // Observe container width for adaptive responsive UI (heading & chat input)
  const panelRef = useRef<HTMLElement>(null);
  const [panelWidth, setPanelWidth] = useState<number>(600);

  useEffect(() => {
    if (!panelRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setPanelWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, []);

  const isCompact = panelWidth < 480;

  // Sync mutations to parent workspace (for Preview/Review tab)
  const prevMutationsRef = useRef<FileMutationRecord[]>([]);
  useEffect(() => {
    if (!onMutationsChange) return;
    const allMuts: FileMutationRecord[] = [];
    for (const msg of messages) {
      if (msg.mutations && msg.mutations.length > 0) {
        allMuts.push(...msg.mutations);
      }
    }

    const prev = prevMutationsRef.current;
    const hasChanged =
      prev.length !== allMuts.length ||
      prev.some(
        (m, idx) =>
          m.id !== allMuts[idx]?.id ||
          m.rolledBack !== allMuts[idx]?.rolledBack ||
          m.operation !== allMuts[idx]?.operation
      );

    if (hasChanged) {
      prevMutationsRef.current = allMuts;
      onMutationsChange(allMuts);
    }
  }, [messages, onMutationsChange]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    return localStorage.getItem("const_learn_active_model") || "gemini-3.8-flash";
  });
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [menuView, setMenuView] = useState<"main" | "models" | "thinking">("main");
  const [searchModelQuery, setSearchModelQuery] = useState("");
  const [thinkingLevel, setThinkingLevel] = useState<string>(() => {
    return localStorage.getItem("const_learn_thinking_level") || "medium";
  });
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>(DEFAULT_MODELS);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Approval state matching apps/harness
  const permissionModeRef = useRef(permissionMode);
  permissionModeRef.current = permissionMode;
  const [activeApproval, setActiveApproval] = useState<ApprovalRequestData | null>(null);
  const [isRespondingApproval, setIsRespondingApproval] = useState(false);

  // Attachments state (max 5 media/files)
  const MAX_ATTACHMENTS = 5;
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [lightboxItem, setLightboxItem] = useState<{
    src: string;
    alt: string;
    type?: AttachedFile["type"];
    fileSize?: number;
    imageIndex?: number;
  } | null>(null);
  const [isMultiline, setIsMultiline] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const activeAssistantIdRef = useRef<string | null>(null);

  const handleRespondApproval = async (
    decision: ApprovalDecision,
    feedback?: string
  ) => {
    if (!activeApproval) return;
    const approvalId = activeApproval.id || activeApproval.approvalId!;
    setIsRespondingApproval(true);
    try {
      const electron = window.electron;
      if (electron?.agent?.respondApproval) {
        await electron.agent.respondApproval({
          approvalId,
          decision,
          feedback,
          approved: decision !== "deny" && decision !== "skip",
        });
      }
      setActiveApproval(null);
    } catch (err) {
      console.error("Failed to respond to approval:", err);
    } finally {
      setIsRespondingApproval(false);
    }
  };

  const SINGLE_LINE_HEIGHT = 28;
  const MIN_MULTILINE_HEIGHT = 48;
  const MAX_MULTILINE_HEIGHT = 220;

  // Auto-grow textarea height calculation (only applies to multi-line mode)
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Viewport element from Radix ScrollArea
    const viewport = textarea.closest(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    const prevScrollTop = viewport ? viewport.scrollTop : 0;

    if (!isMultiline && attachments.length === 0) {
      textarea.style.height = `${SINGLE_LINE_HEIGHT}px`;
      return;
    }

    textarea.style.height = "auto";
    const nextHeight = Math.max(MIN_MULTILINE_HEIGHT, textarea.scrollHeight);
    textarea.style.height = `${nextHeight}px`;

    // Handle scroll position in viewport
    if (viewport) {
      const isNearBottom =
        viewport.scrollHeight - viewport.clientHeight - prevScrollTop < 40;
      if (isNearBottom) {
        viewport.scrollTop = viewport.scrollHeight;
      } else if (prevScrollTop > 0) {
        viewport.scrollTop = prevScrollTop;
      }
    }
  };

  // Input change handler ensuring reliable return to single-line pill when empty
  const handleInputChange = (val: string) => {
    setInputMessage(val);

    // 1. When text is empty and no attachments, immediately return to single-line pill
    if (!val.trim() && attachments.length === 0) {
      if (isMultiline) {
        setIsMultiline(false);
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = `${SINGLE_LINE_HEIGHT}px`;
      }
      return;
    }

    // 2. When text contains newline or has attachments, switch to multi-line mode
    if (val.includes("\n") || attachments.length > 0) {
      if (!isMultiline) {
        setIsMultiline(true);
      }
      return;
    }

    // 3. In single-line mode, detect if text has wrapped beyond single-line width
    const textarea = textareaRef.current;
    if (textarea && !isMultiline) {
      if (textarea.scrollHeight > SINGLE_LINE_HEIGHT + 4) {
        setIsMultiline(true);
        return;
      }
    }

    // 4. When in multi-line mode but text is single line and short (<= 30 chars) without attachments, collapse back
    if (isMultiline && val.length <= 30 && !val.includes("\n") && attachments.length === 0) {
      setIsMultiline(false);
      if (textarea) {
        textarea.style.height = `${SINGLE_LINE_HEIGHT}px`;
      }
      return;
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (attachments.length > 0) {
      if (!isMultiline) setIsMultiline(true);
    } else if (!inputMessage.trim()) {
      if (isMultiline) setIsMultiline(false);
      textarea.style.height = `${SINGLE_LINE_HEIGHT}px`;
      return;
    } else if (inputMessage.includes("\n")) {
      if (!isMultiline) setIsMultiline(true);
    } else if (!isMultiline && textarea.scrollHeight > SINGLE_LINE_HEIGHT + 4) {
      setIsMultiline(true);
    }

    adjustHeight();
  }, [inputMessage, attachments.length, isMultiline]);

  // Execution timing state
  const [liveDurationMs, setLiveDurationMs] = useState(0);
  const streamStartTimeRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeAssistantRef = useRef<DisplayMessage | null>(null);

  // Timer for live duration while streaming
  useEffect(() => {
    let timer: any = null;
    if (isStreaming) {
      if (!streamStartTimeRef.current) {
        streamStartTimeRef.current = Date.now();
      }
      timer = setInterval(() => {
        if (streamStartTimeRef.current) {
          setLiveDurationMs(Date.now() - streamStartTimeRef.current);
        }
      }, 300);
    } else {
      streamStartTimeRef.current = null;
      setLiveDurationMs(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isStreaming]);

  // Close model dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutsideDropdown =
        !dropdownRef.current || !dropdownRef.current.contains(target);

      if (isOutsideDropdown) {
        setIsModelDropdownOpen(false);
        setMenuView("main");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Available models list (fetched dynamically from router.const.web.id with fallback)
  useEffect(() => {
    const electron = (window as any).electron;
    if (electron?.agent?.getModels) {
      electron.agent
        .getModels()
        .then((remoteModels: any[]) => {
          if (remoteModels && Array.isArray(remoteModels) && remoteModels.length > 0) {
            setAvailableModels(remoteModels);
          }
        })
        .catch(() => {});
    }
  }, []);

  const models: ModelConfig[] = availableModels;
  const currentModel = useMemo(() => {
    return availableModels.find((m) => m.id === selectedModelId) || availableModels[0] || DEFAULT_MODELS[0]!;
  }, [availableModels, selectedModelId]);

  const currentThinkingLevels = useMemo(() => {
    return currentModel?.thinkingLevels || (currentModel?.supportsThinking ? ["low", "medium", "high"] : []);
  }, [currentModel]);

  const groupedModels = useMemo(() => {
    const map = new Map<string, { providerId: string; providerName: string; items: ModelConfig[] }>();
    for (const m of availableModels) {
      const { providerId, providerName } = getModelProviderInfo(m);
      if (!map.has(providerId)) {
        map.set(providerId, { providerId, providerName, items: [] });
      }
      map.get(providerId)!.items.push(m);
    }
    return Array.from(map.values());
  }, [availableModels]);

  const filteredGroupedModels = useMemo(() => {
    const q = searchModelQuery.toLowerCase().trim();
    if (!q) return groupedModels;

    return groupedModels
      .map((group) => {
        const matchesProvider = group.providerName.toLowerCase().includes(q);
        const matchingItems = group.items.filter(
          (m) =>
            matchesProvider ||
            (m.displayName || "").toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q)
        );
        return {
          ...group,
          items: matchingItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [groupedModels, searchModelQuery]);

  const handleSelectModel = (m: ModelConfig) => {
    setSelectedModelId(m.id);
    localStorage.setItem("const_learn_active_model", m.id);
    (window as any).electron?.config?.save?.({ activeModel: m.id })?.catch?.(() => {});

    if (m.id === "combo/coding" || m.displayName === "combo/coding") {
      setThinkingLevel("high");
      localStorage.setItem("const_learn_thinking_level", "high");
    } else if (m.defaultThinkingLevel) {
      setThinkingLevel(m.defaultThinkingLevel);
      localStorage.setItem("const_learn_thinking_level", m.defaultThinkingLevel);
    }
    setIsModelDropdownOpen(false);
    setMenuView("main");
  };

  // Sources live query in this learn
  const sources =
    useLiveQuery(
      () => {
        if (!learnId) return [];
        return db.sources.where("learnId").equals(learnId).reverse().sortBy("createdAt");
      },
      [learnId]
    ) || [];

  const carriedSources = sources.filter((s) => s.includedInChat !== false);
  const carriedSourcesCount = sources.length > 0 ? carriedSources.length : sourcesCount;
  const [isSourcesDropdownOpen, setIsSourcesDropdownOpen] = useState(false);
  const sourcesDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedSourceForPreview, setSelectedSourceForPreview] = useState<LocalSource | null>(null);

  // Current Learn query to fetch notebook title
  const currentLearn = useLiveQuery(() => (learnId ? db.learns.get(learnId) : undefined), [learnId]);

  const sourcesMap = useMemo(() => {
    const map = new Map<string, LocalSource>();
    for (const s of sources) {
      map.set(s.id, s);
      const clean = s.id.replace(/^source_/, "").replace(/^source:/, "");
      map.set(clean, s);
      map.set(`source:${s.id}`, s);
      map.set(`source_${clean}`, s);
      map.set(`source:${clean}`, s);
    }
    return map;
  }, [sources]);

  const handleCitationClick = (sourceId: string) => {
    const cleanId = sourceId.replace(/^\[?source:/i, "").replace(/^source_/, "").replace(/\]$/, "");
    const src =
      sourcesMap.get(cleanId) ||
      sourcesMap.get(`source_${cleanId}`) ||
      sourcesMap.get(`source:${cleanId}`) ||
      sourcesMap.get(sourceId);
    if (src) {
      setSelectedSourceForPreview(src);
    } else {
      toast.info(`Sumber ID: ${sourceId}`);
    }
  };

  // Dynamic telemetry metrics for active conversation (matching apps/harness/desktop)
  const conversationMetrics = useMemo(() => {
    return calculateConversationMetrics(messages);
  }, [messages]);

  // Context window usage estimation for learning sources and discussion history
  const contextUsage = useMemo(() => {
    const totalTokens = parseContextWindowTokens((currentModel as any)?.contextWindow);
    return calculateContextUsage({
      sources,
      messages,
      draftInput: inputMessage,
      totalTokens,
    });
  }, [sources, messages, inputMessage, currentModel]);

  // Context window indicator visibility: only show once user has sent their first message
  const hasStartedChat = useMemo(() => {
    return messages.some((m) => m.role === "user");
  }, [messages]);

  useEffect(() => {
    if (!hasStartedChat && isContextOpen) {
      setIsContextOpen(false);
    }
  }, [hasStartedChat, isContextOpen]);

  // Multi-session chat support: query sessions from Dexie
  const rawSessions = useLiveQuery(
    () => {
      if (!learnId) return [];
      return db.sessions.where("learnId").equals(learnId).reverse().sortBy("updatedAt");
    },
    [learnId]
  );
  const sessions = rawSessions ?? [];

  // Initialize active session from localStorage if available
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (!learnId) return null;
    try {
      return localStorage.getItem(`const_learn_active_session_${learnId}`);
    } catch {
      return null;
    }
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Keep ref for stream callbacks and persist active session ID to localStorage
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    if (learnId && activeSessionId) {
      try {
        localStorage.setItem(`const_learn_active_session_${learnId}`, activeSessionId);
      } catch {}
    }
  }, [learnId, activeSessionId]);

  const isCreatingSessionRef = useRef(false);
  const isCleanedUpRef = useRef(false);

  // Auto-initialize active session safely once sessions are loaded from Dexie
  useEffect(() => {
    if (!learnId || rawSessions === undefined) return;

    // 1. One-time cleanup of duplicate empty initial sessions from previous bug runs
    if (!isCleanedUpRef.current && rawSessions.length > 1) {
      isCleanedUpRef.current = true;
      (async () => {
        try {
          const emptyInitials = rawSessions.filter(
            (s) =>
              (!s.messageCount || s.messageCount === 0) &&
              (s.title === "Sesi Awal" ||
                s.title === "Percakapan Baru" ||
                s.title === "Initial Session" ||
                s.title === "Main Session" ||
                s.title === "New Conversation")
          );
          // If there are duplicate empty initial sessions, delete the excess ones
          if (emptyInitials.length > 1) {
            for (let i = 1; i < emptyInitials.length; i++) {
              await localDb.deleteSession(emptyInitials[i]!.id);
            }
          }
        } catch {}
      })();
    }

    // 2. If sessions exist in DB, select or validate active session
    if (rawSessions.length > 0) {
      const storageKey = `const_learn_active_session_${learnId}`;
      let savedSessionId: string | null = null;
      try {
        savedSessionId = localStorage.getItem(storageKey);
      } catch {}

      const hasActive = activeSessionId && rawSessions.some((s) => s.id === activeSessionId);
      const hasSaved = savedSessionId && rawSessions.some((s) => s.id === savedSessionId);

      if (!hasActive) {
        if (hasSaved) {
          setActiveSessionId(savedSessionId);
        } else {
          setActiveSessionId(rawSessions[0]!.id);
        }
      }
    } else {
      // 3. Only if rawSessions is genuinely empty (0 sessions in DB), create ONE initial session
      if (isCreatingSessionRef.current) return;
      isCreatingSessionRef.current = true;

      (async () => {
        try {
          const fresh = await localDb.getSessions(learnId);
          if (fresh.length > 0) {
            setActiveSessionId(fresh[0]!.id);
          } else {
            const newId = await localDb.createSession(learnId, t("initialSessionTitle"));
            setActiveSessionId(newId);
          }
        } finally {
          isCreatingSessionRef.current = false;
        }
      })();
    }
  }, [learnId, rawSessions, activeSessionId]);

  // Load chat messages when learnId or activeSessionId changes
  useEffect(() => {
    if (!learnId || !activeSessionId) {
      setMessages([]);
      return;
    }
    let isMounted = true;
    localDb.getMessages(learnId, activeSessionId).then((saved) => {
      if (!isMounted) return;
      if (saved && saved.length > 0) {
        setMessages(
          saved.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content || "",
            thinking: m.thinking,
            toolCalls: m.toolCalls,
            traceSteps: m.traceSteps,
            mutations: m.mutations,
            attachments: m.attachments,
            createdAt: m.createdAt || Date.now(),
            durationMs: m.durationMs,
            isStreaming: false,
          }))
        );
      } else {
        setMessages([]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [learnId, activeSessionId]);

  // Calculate chronological session image indices (Image 1, Image 2, Image 3...) across the entire session
  const sessionImageMap = useMemo(() => {
    const map = new Map<string, number>();
    let counter = 0;
    for (const msg of messages) {
      if (msg.role === "user" && msg.attachments) {
        for (const att of msg.attachments) {
          if (att.type === "image") {
            counter++;
            map.set(att.id, counter);
          }
        }
      }
    }
    return map;
  }, [messages]);

  const handleNewChat = async () => {
    if (!learnId) return;

    // If the active session is already empty (0 messages), just reuse it instead of creating another empty session
    const currentSession = sessions.find((s) => s.id === activeSessionId);
    if (
      currentSession &&
      (!currentSession.messageCount || currentSession.messageCount === 0) &&
      messages.length === 0
    ) {
      setIsHistoryOpen(false);
      return;
    }

    const newSessionId = await localDb.createSession(learnId, "Percakapan Baru");
    setActiveSessionId(newSessionId);
    setMessages([]);
    setIsHistoryOpen(false);
  };

  const handleDeleteSession = async (sessionIdToDelete: string) => {
    await localDb.deleteSession(sessionIdToDelete);
    if (activeSessionId === sessionIdToDelete) {
      const remaining = sessions.filter((s) => s.id !== sessionIdToDelete);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0]!.id);
      } else if (learnId) {
        const newId = await localDb.createSession(learnId, "Percakapan Baru");
        setActiveSessionId(newId);
      }
    }
  };

  // Auto scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);


  // 2. Set up Electron stream listener with auto-persistence
  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron?.agent?.onStreamEvent) return;

    const unsubscribe = electron.agent.onStreamEvent((event: any) => {
      setMessages((prev) => {
        let targetIndex = -1;
        if (activeAssistantIdRef.current) {
          targetIndex = prev.findIndex((m) => m.id === activeAssistantIdRef.current);
        }
        if (targetIndex === -1) {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i]?.role === "assistant") {
              targetIndex = i;
              break;
            }
          }
        }

        if (targetIndex === -1) return prev;
        const targetMsg = prev[targetIndex];
        if (!targetMsg) return prev;

        const updated: DisplayMessage = { ...targetMsg };

        if (event.type === "token") {
          updated.content = (updated.content || "") + event.token;
          // Finalize open thought step duration if any
          if (updated.traceSteps && updated.traceSteps.length > 0) {
            const steps = [...updated.traceSteps];
            const lastStep = steps[steps.length - 1];
            if (lastStep && lastStep.type === "thought" && lastStep.startTime && !lastStep.durationMs) {
              steps[steps.length - 1] = {
                ...lastStep,
                durationMs: Math.max(1000, Date.now() - lastStep.startTime),
              };
              updated.traceSteps = steps;
            }
          }
        } else if (event.type === "thinking") {
          updated.thinking = (updated.thinking || "") + event.thinking;
          const steps: TraceStep[] = updated.traceSteps ? [...updated.traceSteps] : [];
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
          updated.traceSteps = steps;
        } else if (event.type === "tool_call") {
          const toolCalls = [...(updated.toolCalls || [])];
          const existingIdx = toolCalls.findIndex((tc) => tc.id === event.toolCallId);
          if (existingIdx >= 0) {
            toolCalls[existingIdx] = {
              ...toolCalls[existingIdx]!,
              name: event.toolName,
              args: event.args,
              status: "running",
            };
          } else {
            toolCalls.push({
              id: event.toolCallId,
              name: event.toolName,
              args: event.args,
              status: "running",
            });
          }
          updated.toolCalls = toolCalls;

          // Trace steps update
          const steps: TraceStep[] = updated.traceSteps ? [...updated.traceSteps] : [];
          if (steps.length > 0) {
            const lastStep = steps[steps.length - 1];
            if (lastStep && lastStep.type === "thought" && lastStep.startTime && !lastStep.durationMs) {
              steps[steps.length - 1] = {
                ...lastStep,
                durationMs: Math.max(1000, Date.now() - lastStep.startTime),
              };
            }
          }
          const sIdx = steps.findIndex((s) => s.id === event.toolCallId || s.toolCallId === event.toolCallId);
          if (sIdx >= 0) {
            steps[sIdx] = {
              ...steps[sIdx]!,
              name: event.toolName,
              args: event.args,
              status: "running",
            };
          } else {
            steps.push({
              id: event.toolCallId,
              type: "tool",
              toolCallId: event.toolCallId,
              name: event.toolName,
              args: event.args,
              status: "running",
              startTime: Date.now(),
            });
          }
          updated.traceSteps = steps;
        } else if (event.type === "ask_question") {
          const toolCalls = [...(updated.toolCalls || [])];
          const existingIdx = toolCalls.findIndex((tc) => tc.id === event.toolCallId);
          const qArgs = {
            question:
              event.question ||
              event.questionData?.question ||
              event.questions?.[0]?.question ||
              "Bagaimana kita ingin melanjutkan?",
            options:
              event.options ||
              event.questionData?.options ||
              event.questions?.[0]?.options ||
              [],
            allow_custom:
              event.allow_custom ?? event.questionData?.allow_custom ?? true,
          };
          if (existingIdx >= 0) {
            toolCalls[existingIdx] = {
              ...toolCalls[existingIdx]!,
              name: "ask_question",
              args: qArgs,
              status: "running",
            };
          } else {
            toolCalls.push({
              id: event.toolCallId,
              name: "ask_question",
              args: qArgs,
              status: "running",
            });
          }
          updated.toolCalls = toolCalls;

          const steps: TraceStep[] = updated.traceSteps ? [...updated.traceSteps] : [];
          const sIdx = steps.findIndex((s) => s.id === event.toolCallId || s.toolCallId === event.toolCallId);
          if (sIdx >= 0) {
            steps[sIdx] = {
              ...steps[sIdx]!,
              name: "ask_question",
              args: qArgs,
              status: "running",
            };
          } else {
            steps.push({
              id: event.toolCallId,
              type: "tool",
              toolCallId: event.toolCallId,
              name: "ask_question",
              args: qArgs,
              status: "running",
              startTime: Date.now(),
            });
          }
          updated.traceSteps = steps;
        } else if (event.type === "approval_request") {
          const approvalId = event.id || event.approvalId || event.approval?.id || event.approval?.approvalId;
          const currentMode = permissionModeRef.current || "ask_before_changes";
          if (currentMode === "full_access") {
            // Auto-approve in full_access mode so execution proceeds without interruption
            if (approvalId && electron?.agent?.respondApproval) {
              electron.agent.respondApproval({
                approvalId,
                approved: true,
                decision: "allow_once",
              }).catch(() => {});
            }
          } else {
            // In ask_before_changes mode, display interactive ApprovalCard
            const approvalData: ApprovalRequestData = event.approval || {
              id: approvalId || `approval_${Date.now()}`,
              approvalId: approvalId || `approval_${Date.now()}`,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              command: event.command,
              args: event.args,
              cwd: event.cwd,
              description: event.description,
              reason: event.reason,
            };
            setActiveApproval(approvalData);
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 60);
          }
        } else if (event.type === "approval_resolved") {
          setActiveApproval(null);
        } else if (event.type === "tool_result") {
          const toolCalls = [...(updated.toolCalls || [])];
          const existingIdx = toolCalls.findIndex((tc) => tc.id === event.toolCallId);
          if (existingIdx >= 0) {
            toolCalls[existingIdx] = {
              ...toolCalls[existingIdx]!,
              result: event.result,
              isError: event.isError,
              status: event.isError ? "error" : "completed",
            };
          }
          updated.toolCalls = toolCalls;

          const steps: TraceStep[] = updated.traceSteps ? [...updated.traceSteps] : [];
          const sIdx = steps.findIndex((s) => s.id === event.toolCallId || s.toolCallId === event.toolCallId);
          if (sIdx >= 0) {
            steps[sIdx] = {
              ...steps[sIdx]!,
              result: event.result,
              isError: event.isError,
              status: event.isError ? "error" : "completed",
              durationMs: steps[sIdx]?.startTime ? Date.now() - steps[sIdx]!.startTime! : undefined,
            };
          }
          updated.traceSteps = steps;
        } else if (event.type === "file_mutation") {
          if (event.record) {
            const mutations = updated.mutations ? [...updated.mutations] : [];
            mutations.push(event.record);
            updated.mutations = mutations;

            if (updated.traceSteps) {
              const steps = updated.traceSteps.map((st) => {
                if (st.type === "tool" && !st.mutation) {
                  const norm = (st.name || "").toLowerCase().replace(/[-_]/g, "");
                  if (
                    norm.includes("write") ||
                    norm.includes("edit") ||
                    norm.includes("replace") ||
                    norm.includes("create") ||
                    norm.includes("patch")
                  ) {
                    return { ...st, mutation: event.record };
                  }
                }
                return st;
              });
              updated.traceSteps = steps;
            }
          }
        } else if (event.type === "error") {
          setActiveApproval(null);
          const defaultError = language === "id"
            ? "Terjadi kesalahan saat memproses permintaan."
            : "An error occurred while processing the request.";
          const errorMsg = event.error || defaultError;
          const errorPrefix = language === "id" ? "Terjadi kendala" : "Issue encountered";
          updated.content = updated.content
            ? `${updated.content}\n\n⚠️ **Error:** ${errorMsg}`
            : `⚠️ **${errorPrefix}:** ${errorMsg}`;
          updated.isStreaming = false;
          setIsStreaming(false);

          if (streamStartTimeRef.current) {
            updated.durationMs = Date.now() - streamStartTimeRef.current;
          }

          if (learnId) {
            localDb.saveMessage({
              id: updated.id,
              learnId,
              sessionId: activeSessionIdRef.current || undefined,
              role: "assistant",
              content: updated.content,
              thinking: updated.thinking,
              toolCalls: updated.toolCalls,
              traceSteps: updated.traceSteps,
              mutations: updated.mutations,
              durationMs: updated.durationMs,
              createdAt: updated.createdAt,
            });
          }
        } else if (event.type === "done") {
          setActiveApproval(null);
          if (event.fullContent && !updated.content) {
            updated.content = event.fullContent;
          } else if (!updated.content && updated.toolCalls && updated.toolCalls.length > 0) {
            const toolSummary = updated.toolCalls
              .map((tc) => `- \`${tc.name}\`: ${tc.status === "completed" ? (language === "id" ? "Selesai" : "Completed") : (language === "id" ? "Gagal" : "Failed")}`)
              .join("\n");
            updated.content = language === "id"
              ? `Selesai menjalankan langkah-langkah tugas:\n\n${toolSummary}`
              : `Completed running task steps:\n\n${toolSummary}`;
          } else if (!updated.content) {
            updated.content = t("noResponseReceived");
          }

          if (streamStartTimeRef.current) {
            updated.durationMs = Date.now() - streamStartTimeRef.current;
          }

          updated.isStreaming = false;
          setIsStreaming(false);

          if (learnId) {
            localDb.saveMessage({
              id: updated.id,
              learnId,
              sessionId: activeSessionIdRef.current || undefined,
              role: "assistant",
              content: updated.content,
              thinking: updated.thinking,
              toolCalls: updated.toolCalls,
              traceSteps: updated.traceSteps,
              mutations: updated.mutations,
              durationMs: updated.durationMs,
              createdAt: updated.createdAt,
            });
          }
        }

        activeAssistantRef.current = updated;
        const newArr = [...prev];
        newArr[targetIndex] = updated;
        return newArr;
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [learnId]);

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);
    const newAttached: AttachedFile[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i]!;
      const fileType = file.type;
      let kind: AttachedFile["type"] = "other";

      if (fileType.startsWith("image/")) kind = "image";
      else if (fileType.startsWith("video/")) kind = "video";
      else if (fileType === "application/pdf" || file.name.endsWith(".pdf")) kind = "pdf";
      else if (
        file.name.endsWith(".ts") ||
        file.name.endsWith(".tsx") ||
        file.name.endsWith(".js") ||
        file.name.endsWith(".py") ||
        file.name.endsWith(".json")
      ) {
        kind = "code";
      } else if (file.name.endsWith(".md") || file.name.endsWith(".txt")) {
        kind = "document";
      }

      let base64: string | undefined = undefined;
      let url: string | undefined = undefined;

      if (kind === "image" || kind === "video") {
        url = URL.createObjectURL(file);
      }

      if (kind === "image") {
        try {
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } catch {}
      }

      newAttached.push({
        id: `att_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size,
        type: kind,
        url: url || base64,
        base64,
        path: (file as any).path,
      });
    }

    setAttachments((prev) => [...prev, ...newAttached].slice(0, MAX_ATTACHMENTS));
    setIsMultiline(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item?.url) {
        URL.revokeObjectURL(item.url);
      }
      const nextAtt = prev.filter((a) => a.id !== id);
      if (
        nextAtt.length === 0 &&
        (!inputMessage.trim() || (!inputMessage.includes("\n") && inputMessage.length < 35))
      ) {
        setIsMultiline(false);
      }
      return nextAtt;
    });
  };

  const handleSend = async (customPrompt?: string) => {
    let textToSend = (customPrompt || inputMessage).trim();
    const currentAttachmentsRaw = [...attachments];

    if ((!textToSend && currentAttachmentsRaw.length === 0) || isStreaming) return;

    setActiveApproval(null);

    if (!textToSend && currentAttachmentsRaw.length > 0) {
      textToSend = t("analyzeAttachedMediaPrompt");
    }

    // 1. Ensure we have an active session
    let currentSessionId = activeSessionId;
    if (!currentSessionId && learnId) {
      try {
        currentSessionId = await localDb.createSession(learnId, t("newSessionTitle"));
        setActiveSessionId(currentSessionId);
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    }

    // 2. Count prior images in this session to maintain chronological session index (Image 1, Image 2, Image 3...)
    let priorImagesCount = 0;
    for (const msg of messages) {
      if (msg.role === "user" && msg.attachments) {
        for (const att of msg.attachments) {
          if (att.type === "image") {
            priorImagesCount++;
          }
        }
      }
    }

    let currentImgCounter = priorImagesCount;
    const currentAttachments: AttachedFile[] = currentAttachmentsRaw.map((att) => {
      if (att.type === "image") {
        currentImgCounter++;
        return {
          ...att,
          imageIndex: currentImgCounter,
        };
      }
      return att;
    });

    // 3. Auto-generate title if this is the first message in the session
    if (currentSessionId) {
      const currentSession = sessions.find((s) => s.id === currentSessionId);
      const isDefaultTitle =
        !currentSession ||
        currentSession.messageCount === 0 ||
        currentSession.title === "Percakapan Baru" ||
        currentSession.title === "Sesi Awal" ||
        currentSession.title === "Initial Session" ||
        currentSession.title === "Main Session" ||
        currentSession.title === "New Conversation";

      if (isDefaultTitle) {
        // Immediate fallback title: first 4-6 words
        const words = textToSend.split(/\s+/).slice(0, 5).join(" ");
        const fallbackTitle = words.length > 35 ? words.slice(0, 32) + "..." : words;
        try {
          await localDb.updateSessionTitle(currentSessionId, fallbackTitle);
        } catch {}

        // Asynchronous AI refinement
        const electronApi = (window as any).electron;
        if (electronApi?.agent?.generateTitle) {
          const authToken =
            localStorage.getItem("const_learn_auth_token") ||
            localStorage.getItem("const_sso_token") ||
            "";
          electronApi.agent
            .generateTitle(textToSend, authToken)
            .then((aiTitle: string | null) => {
              if (aiTitle && currentSessionId) {
                localDb.updateSessionTitle(currentSessionId, aiTitle).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
    }

    const now = Date.now();
    const userMsgId = `user_${now}`;
    const assistantMsgId = `asst_${now + 1}`;

    // 4. Build prompt with numbered image references for the AI
    let promptWithAttachments = textToSend;
    if (currentAttachments.length > 0) {
      const attLines: string[] = [];
      for (const att of currentAttachments) {
        if (att.type === "image" && att.imageIndex) {
          attLines.push(
            `- Image ${att.imageIndex} (Gambar ${att.imageIndex}): "${att.name}" (${formatFileSize(att.size)})`
          );
        } else {
          attLines.push(
            `- File (${att.type}): "${att.name}" (${formatFileSize(att.size)})`
          );
        }
      }
      const attHeader = language === "id" ? "Lampiran Media" : "Attached Media";
      const attInstruction =
        language === "id"
          ? "Catatan AI: Jika pengguna menyebut 'image 1', 'image 2', 'gambar 1', 'foto 2', dsb., kenali dan rujuk gambar sesuai urutan nomor kronologis sesi di atas."
          : "AI Note: When the user refers to 'image 1', 'image 2', etc., refer to the images according to their chronological session order above.";
      promptWithAttachments = `${promptWithAttachments}\n\n[${attHeader}:\n${attLines.join("\n")}\n${attInstruction}]`;
    }

    // Build NotebookLM-style Grounded Context and System Prompt
    const groundedResult = buildGroundedContext(carriedSources);
    const systemPrompt = buildGroundedSystemPrompt({
      availableSourceIds: groundedResult.sourceIds,
      hasSources: groundedResult.activeSources.length > 0,
    });

    if (groundedResult.formattedContext) {
      promptWithAttachments = `${groundedResult.formattedContext}\n\n---\n## USER QUERY\n${promptWithAttachments}`;
    }

    const newUserMsg: DisplayMessage = {
      id: userMsgId,
      role: "user",
      content: textToSend,
      attachments: currentAttachments,
      createdAt: now,
    };

    const newAssistantMsg: DisplayMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinking: "",
      toolCalls: [],
      traceSteps: [],
      isStreaming: true,
      createdAt: now + 1,
    };

    // 5. Persist user message to Dexie
    if (learnId) {
      try {
        await localDb.saveMessage({
          id: userMsgId,
          learnId,
          sessionId: currentSessionId || undefined,
          role: "user",
          content: textToSend,
          attachments: currentAttachments,
          createdAt: now,
        });
      } catch (dbErr) {
        console.error("Failed to persist user message to Dexie:", dbErr);
      }
    }

    const nextMessages = [...messages, newUserMsg];
    setMessages([...nextMessages, newAssistantMsg]);
    setInputMessage("");
    setIsMultiline(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = `${SINGLE_LINE_HEIGHT}px`;
    }
    setAttachments([]);
    setIsStreaming(true);
    streamStartTimeRef.current = Date.now();
    activeAssistantRef.current = newAssistantMsg;
    activeAssistantIdRef.current = assistantMsgId;

    const electron = (window as any).electron;

    // 6. Build high-fidelity multi-turn message payload with vision multimodal support
    const formattedMessages: any[] = [];
    for (const m of nextMessages) {
      if (m.role === "user") {
        const isCurrentSendingMsg = m.id === userMsgId;
        const textForAI = isCurrentSendingMsg ? promptWithAttachments : m.content;
        const imageAttachments = (m.attachments || []).filter(
          (a) => a.type === "image" && (a.base64 || a.url?.startsWith("data:"))
        );

        if (imageAttachments.length > 0) {
          const contentParts: any[] = [
            { type: "text", text: textForAI || "Analyze the attached image(s)." },
          ];
          for (const img of imageAttachments) {
            const dataUrl = img.base64 || img.url;
            if (dataUrl) {
              contentParts.push({
                type: "image_url",
                image_url: {
                  url: dataUrl,
                },
              });
            }
          }
          formattedMessages.push({
            role: "user",
            content: contentParts,
          });
        } else {
          formattedMessages.push({ role: "user", content: textForAI });
        }
      } else if (m.role === "assistant") {
        if (m.toolCalls && m.toolCalls.length > 0) {
          formattedMessages.push({
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: {
                name: tc.name,
                arguments: typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args),
              },
            })),
          });
          for (const tc of m.toolCalls) {
            if (tc.status === "completed" || tc.status === "error") {
              formattedMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content:
                  typeof tc.result === "string"
                    ? tc.result
                    : JSON.stringify(tc.result || {}),
              });
            }
          }
        } else if (m.content && m.content.trim()) {
          formattedMessages.push({
            role: "assistant",
            content: m.content,
          });
        }
      }
    }

    if (electron?.agent?.sendMessage) {
      // 1. Electron IPC Execution with workspacePath and user's SSO auth token
      try {
        const authToken =
          localStorage.getItem("const_learn_auth_token") ||
          localStorage.getItem("const_sso_token") ||
          "";

        const storedMcp = localStorage.getItem("const_mcp_configuration_v3");
        let parsedMcpServers: any[] = [];
        try {
          if (storedMcp) {
            const parsed = JSON.parse(storedMcp);
            if (Array.isArray(parsed?.servers) && parsed.servers.length > 0) {
              parsedMcpServers = parsed.servers.filter(
                (s: any) => s.enabled !== false && s.status !== "disabled"
              );
            }
          }
        } catch {}

        // Add active connected connectors (Canva MCP, Google Suite, YouTube, Cloud Sandbox)
        try {
          const activeConnectorIds = getConnectedConnectorIds();
          for (const connId of activeConnectorIds) {
            const meta = AVAILABLE_CONNECTORS.find((c) => c.id === connId);
            if (meta && !parsedMcpServers.some((s: any) => s.id === meta.id)) {
              parsedMcpServers.push({
                id: meta.id,
                name: meta.name,
                transport: "connector",
                status: "ready",
                description: meta.description,
                skills: meta.skills,
              });
            }
          }
        } catch {}

        const res = await electron.agent.sendMessage({
          messages: formattedMessages,
          systemPrompt: systemPrompt,
          model: selectedModelId,
          workspacePath: workspacePath,
          learnId: learnId,
          authToken: authToken || undefined,
          mode: permissionMode || "ask_before_changes",
          temperature: carriedSources.length > 0 ? 0.2 : 0.7,
          thinkingLevel: currentModel.supportsThinking ? thinkingLevel : undefined,
          mcpServers: parsedMcpServers,
        });

        const finalDuration = streamStartTimeRef.current
          ? Date.now() - streamStartTimeRef.current
          : undefined;

        if (res && res.success === false) {
          const defaultResError = language === "id"
            ? "Gagal mendapatkan respons dari engine"
            : "Failed to get response from engine";
          const errorPrefix = language === "id"
            ? "Terjadi kendala saat memproses"
            : "An issue occurred while processing";
          const errorContent = `⚠️ ${errorPrefix}: ${res.error || defaultResError}`;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: msg.content ? `${msg.content}\n\n${errorContent}` : errorContent,
                    isStreaming: false,
                    durationMs: finalDuration,
                  }
                : msg
            )
          );
          if (learnId) {
            try {
              await localDb.saveMessage({
                id: assistantMsgId,
                learnId,
                sessionId: currentSessionId || undefined,
                role: "assistant",
                content: errorContent,
                createdAt: now + 1,
              });
            } catch {}
          }
        } else if (res && res.success) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMsgId) {
                let finalContent = msg.content;
                if (!finalContent && msg.toolCalls && msg.toolCalls.length > 0) {
                  const toolSummary = msg.toolCalls
                    .map((tc) => `- \`${tc.name}\`: ${tc.status === "completed" ? (language === "id" ? "Selesai" : "Completed") : (language === "id" ? "Gagal" : "Failed")}`)
                    .join("\n");
                  finalContent = language === "id"
                    ? `Selesai menjalankan langkah-langkah tugas:\n\n${toolSummary}`
                    : `Completed running task steps:\n\n${toolSummary}`;
                } else if (!finalContent) {
                  finalContent = t("noResponseReceived");
                }
                const finalized = {
                  ...msg,
                  content: finalContent,
                  durationMs: finalDuration,
                  isStreaming: false,
                };
                if (learnId && finalized.content) {
                  try {
                    localDb.saveMessage({
                      id: finalized.id,
                      learnId,
                      sessionId: currentSessionId || undefined,
                      role: "assistant",
                      content: finalized.content,
                      thinking: finalized.thinking,
                      toolCalls: finalized.toolCalls,
                      createdAt: finalized.createdAt,
                    });
                  } catch {}
                }
                return finalized;
              }
              return msg;
            })
          );
        }
      } catch (err: any) {
        const errorContent = language === "id"
          ? `Terjadi kendala koneksi ke Agent: ${err.message}`
          : `Agent connection error: ${err.message}`;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: errorContent,
                  isStreaming: false,
                }
              : msg
          )
        );
        if (learnId) {
          try {
            await localDb.saveMessage({
              id: assistantMsgId,
              learnId,
              sessionId: currentSessionId || undefined,
              role: "assistant",
              content: errorContent,
              createdAt: now + 1,
            });
          } catch {}
        }
      } finally {
        setIsStreaming(false);
      }
    } else {
      // 2. Direct Web Fallback Execution (for web dev preview)
      try {
        const baseUrl =
          (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
          (import.meta as any).env?.CONST_ROUTER_BASE_URL ||
          (import.meta as any).env?.VITE_CONST_ENGINE_BASE_URL ||
          "https://router.const.web.id/v1";
        const authToken =
          localStorage.getItem("const_learn_auth_token") ||
          localStorage.getItem("const_sso_token") ||
          "";
        const apiKey =
          authToken ||
          (import.meta as any).env?.VITE_CONST_ROUTER_API_KEY ||
          (import.meta as any).env?.VITE_CONST_ENGINE_API_KEY ||
          "";
        const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: selectedModelId,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              ...formattedMessages,
            ],
            stream: true,
            temperature: carriedSources.length > 0 ? 0.2 : 0.7,
            ...(currentModel.supportsThinking && thinkingLevel ? { thinking_level: thinkingLevel } : {}),
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Engine HTTP error ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let accumulatedContent = "";
        let accumulatedThinking = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const json = JSON.parse(dataStr);
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) {
                accumulatedContent += delta.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              }
              if (delta?.reasoning_content) {
                accumulatedThinking += delta.reasoning_content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, thinking: accumulatedThinking }
                      : msg
                  )
                );
              }
            } catch {}
          }
        }

        const finalDuration = streamStartTimeRef.current
          ? Date.now() - streamStartTimeRef.current
          : undefined;

        if (learnId) {
          await localDb.saveMessage({
            id: assistantMsgId,
            learnId,
            sessionId: activeSessionId || undefined,
            role: "assistant",
            content: accumulatedContent,
            thinking: accumulatedThinking,
            createdAt: now + 1,
          });
        }
      } catch (err: any) {
        const errorText = language === "id"
          ? `Gagal memanggil Const: ${err.message}`
          : `Failed to call Const: ${err.message}`;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: errorText,
                  isStreaming: false,
                }
              : msg
          )
        );
        if (learnId) {
          await localDb.saveMessage({
            id: assistantMsgId,
            learnId,
            sessionId: activeSessionId || undefined,
            role: "assistant",
            content: errorText,
            createdAt: now + 1,
          });
        }
      } finally {
        const finalDuration = streamStartTimeRef.current
          ? Date.now() - streamStartTimeRef.current
          : undefined;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, isStreaming: false, durationMs: finalDuration }
              : msg
          )
        );
        setIsStreaming(false);
      }
    }
  };

  useEffect(() => {
    if (externalPrompt && !isStreaming) {
      handleSend(externalPrompt);
      onExternalPromptConsumed?.();
    }
  }, [externalPrompt, isStreaming]);

  const handleAbort = async () => {
    const electron = (window as any).electron;
    if (electron?.agent?.abort) {
      await electron.agent.abort();
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  };

  // Consume external prompt (e.g. from Studio tools)
  useEffect(() => {
    if (externalPrompt && externalPrompt.trim()) {
      handleSend(externalPrompt.trim());
      onExternalPromptConsumed?.();
    }
  }, [externalPrompt]);

  const handleClearHistory = async () => {
    if (learnId) {
      await localDb.clearMessages(learnId, activeSessionId || undefined);
    }
    setMessages([]);
  };

  const handleRollbackFile = async (record: FileMutationRecord, msgId: string) => {
    const electron = (window as any).electron;
    const rollbackFn = electron?.agent?.rollbackFile || electron?.rollbackFile;
    if (!rollbackFn) {
      toast.error(
        language === "id"
          ? "Rollback hanya tersedia di aplikasi desktop"
          : "Rollback is only available in the desktop app"
      );
      return;
    }
    try {
      const res = await rollbackFn(record);
      if (res.success) {
        const raw = record.targetFile || record.filePath || record.absolutePath || "file";
        const fileName = raw.replace(/\\/g, "/").split("/").filter(Boolean).pop() || raw;
        toast.success(
          res.message ||
            (language === "id"
              ? `Berhasil mengembalikan ${fileName}`
              : `Reverted ${fileName}`)
        );
        setMessages((prev) => {
          const next = prev.map((msg) => {
            if (msg.id !== msgId && !msg.mutations?.some((m) => m.id === record.id)) return msg;
            const updatedMuts = msg.mutations?.map((m) =>
              m.id === record.id ? { ...m, rolledBack: true } : m
            );
            return { ...msg, mutations: updatedMuts };
          });
          const target = next.find((m) => m.id === msgId);
          if (target?.mutations) {
            localDb.updateMessageMutations(msgId, target.mutations);
          }
          return next;
        });
      } else {
        toast.error(res.message || (language === "id" ? "Gagal me-rollback berkas" : "Failed to rollback file"));
      }
    } catch (err: any) {
      toast.error(err.message || "Rollback error");
    }
  };

  const handleRollbackAll = async (records: FileMutationRecord[], msgId: string) => {
    const electron = (window as any).electron;
    const rollbackFn = electron?.agent?.rollbackFile || electron?.rollbackFile;
    if (!rollbackFn) {
      toast.error(
        language === "id"
          ? "Rollback hanya tersedia di aplikasi desktop"
          : "Rollback is only available in the desktop app"
      );
      return;
    }
    const unrolled = records.filter((r) => !r.rolledBack);
    if (unrolled.length === 0) {
      toast.info(language === "id" ? "Semua perubahan sudah di-rollback" : "All changes have already been reverted");
      return;
    }
    let successCount = 0;
    const revertedIds = new Set<string>();
    for (const rec of [...unrolled].reverse()) {
      try {
        const res = await rollbackFn(rec);
        if (res.success) {
          successCount++;
          revertedIds.add(rec.id);
        }
      } catch {}
    }
    if (successCount > 0) {
      toast.success(
        language === "id"
          ? `Berhasil mengembalikan ${successCount} berkas`
          : `Reverted ${successCount} file(s)`
      );
      setMessages((prev) => {
        const next = prev.map((msg) => {
          if (msg.id !== msgId && !msg.mutations?.some((m) => revertedIds.has(m.id))) return msg;
          const updatedMuts = msg.mutations?.map((m) =>
            revertedIds.has(m.id) ? { ...m, rolledBack: true } : m
          );
          return { ...msg, mutations: updatedMuts };
        });
        const target = next.find((m) => m.id === msgId);
        if (target?.mutations) {
          localDb.updateMessageMutations(msgId, target.mutations);
        }
        return next;
      });
    }
  };

  const handleEditAndUndoTurn = async (userMsg: DisplayMessage) => {
    const userIdx = messages.findIndex((m) => m.id === userMsg.id);
    if (userIdx === -1) return;

    let assistantMsg: DisplayMessage | undefined;
    if (userIdx + 1 < messages.length && messages[userIdx + 1]?.role === "assistant") {
      assistantMsg = messages[userIdx + 1];
    }

    let rolledBackFilesCount = 0;
    if (assistantMsg?.mutations && assistantMsg.mutations.length > 0) {
      const electron = (window as any).electron;
      const rollbackFn = electron?.agent?.rollbackFile || electron?.rollbackFile;
      if (rollbackFn) {
        const unrolled = assistantMsg.mutations.filter((m) => !m.rolledBack);
        for (const rec of [...unrolled].reverse()) {
          try {
            const res = await rollbackFn(rec);
            if (res.success) {
              rolledBackFilesCount++;
            }
          } catch {}
        }
      }
    }

    await localDb.deleteTurn(userMsg.id, assistantMsg?.id, activeSessionId || undefined);

    setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== assistantMsg?.id));

    const cleanedPrompt = cleanUserMessageContent(userMsg.content);
    setInputMessage(cleanedPrompt);

    if (userMsg.attachments && userMsg.attachments.length > 0) {
      setAttachments([...userMsg.attachments]);
    }

    setIsMultiline(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);

    if (rolledBackFilesCount > 0) {
      toast.success(
        language === "id"
          ? `Pesan dikembalikan untuk diedit & ${rolledBackFilesCount} berkas berhasil di-rollback`
          : `Message restored for editing & ${rolledBackFilesCount} file(s) rolled back`
      );
    } else {
      toast.info(
        language === "id"
          ? "Pesan dikembalikan ke input untuk diedit"
          : "Message restored to input for editing"
      );
    }
  };

  const handleAnswerQuestion = async (toolCallId: string, answer: any) => {
    const stringified = typeof answer === "string" ? answer : JSON.stringify(answer);
    setMessages((prev) => {
      return prev.map((msg) => {
        if (!msg.toolCalls || msg.toolCalls.length === 0) return msg;
        const updatedTc = msg.toolCalls.map((tc) => {
          if (tc.id === toolCallId) {
            return {
              ...tc,
              status: "completed" as const,
              result: stringified,
            };
          }
          return tc;
        });
        return { ...msg, toolCalls: updatedTc };
      });
    });

    const electron = (window as any).electron;
    if (electron?.agent?.answerQuestion) {
      await electron.agent.answerQuestion(toolCallId, answer);
    }
  };

  const renderSourcesDropdown = () => {
    const fullSourcesLabel =
      carriedSourcesCount > 1
        ? t("carriedSourcesPill", { count: carriedSourcesCount })
        : carriedSourcesCount === 1
        ? t("carriedSourcesPillSingle")
        : t("sourcesCountNone");

    return (
      <Popover open={isSourcesDropdownOpen} onOpenChange={setIsSourcesDropdownOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 rounded-xl text-xs font-medium transition-all cursor-pointer select-none flex items-center gap-1.5 border shrink-0 shadow-xs active:scale-98 font-sans",
              isCompact ? "px-2" : "px-2.5",
              carriedSourcesCount > 0
                ? "bg-muted/60 hover:bg-muted border-border/70 text-foreground dark:text-white"
                : "bg-muted/40 hover:bg-muted text-foreground/80 dark:text-white/90 hover:dark:text-white border-border/50",
              isSourcesDropdownOpen && "bg-muted border-foreground/30"
            )}
            aria-label={t("manageCarriedSources")}
            title={fullSourcesLabel}
          >
            <FileText className="h-3.5 w-3.5 text-foreground/70 dark:text-white/80 shrink-0" />
            <span className="font-sans text-xs text-foreground dark:text-white font-medium">
              {isCompact ? carriedSourcesCount : fullSourcesLabel}
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-foreground/60 dark:text-white/70 transition-transform duration-150 ml-0.5",
                isSourcesDropdownOpen && "rotate-180"
              )}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-72 sm:w-80 rounded-2xl bg-card border border-border shadow-2xl p-2.5 z-50 font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1.5 pb-1.5 mb-1">
            <span className="text-[11px] font-semibold text-foreground tracking-tight">
              {t("carriedSourcesTitle", { carried: carriedSourcesCount, total: sources.length })}
            </span>
            {sources.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const allSelected = carriedSources.length === sources.length;
                  if (learnId) {
                    localDb.setAllSourcesInChat(learnId, !allSelected);
                  }
                }}
                className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
              >
                {carriedSources.length === sources.length ? t("deselectAll") : t("selectAll")}
              </button>
            )}
          </div>

          {/* List of sources */}
          <ScrollArea className="max-h-48 w-full" viewportClassName="pr-1">
            <div className="space-y-1 py-0.5">
              {sources.length === 0 ? (
                <div className="py-4 px-2 text-center text-muted-foreground">
                  <FileText className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs font-medium text-foreground">{t("noSourcesInChat")}</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                    {t("noSourcesInChatDesc")}
                  </p>
                </div>
              ) : (
                sources.map((source) => {
                  const isCarried = source.includedInChat !== false;
                  return (
                    <div
                      key={source.id}
                      onClick={() => {
                        localDb.toggleSourceInChat(source.id, !isCarried);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left cursor-pointer transition-colors select-none text-xs",
                        isCarried
                          ? "bg-secondary/70 hover:bg-secondary text-foreground"
                          : "hover:bg-muted/50 text-muted-foreground opacity-60 hover:opacity-100"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isCarried}
                        onChange={() => {}}
                        className="rounded border-border h-3.5 w-3.5 text-primary focus:ring-0 cursor-pointer pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[11.5px] font-medium text-foreground">
                          {source.title}
                        </div>
                        <div className="text-[9.5px] text-muted-foreground/70 font-mono flex items-center gap-1">
                          <span className="capitalize">{source.type}</span>
                          {source.size ? `• ${formatFileSize(source.size)}` : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Footer action: Add new source */}
          {onAddSource && (
            <div className="pt-1.5 mt-1">
              <button
                type="button"
                onClick={() => {
                  setIsSourcesDropdownOpen(false);
                  onAddSource();
                }}
                className="w-full h-7 rounded-xl bg-muted/60 hover:bg-muted text-xs font-medium text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>{t("addSource")}</span>
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  const renderContextIndicator = () => {
    // Only show Context Window indicator once user has sent a message or attached sources
    if (!hasStartedChat && carriedSourcesCount === 0) return null;

    const rawPercentUsed = contextUsage.rawPercentUsed;
    const percentUsed = contextUsage.percentUsed;
    const usedTokens = contextUsage.usedTokens;
    const totalTokens = contextUsage.totalTokens;
    const safePercent = contextUsage.safePercent;

    const isHigh = rawPercentUsed >= 90;
    const isModerate = rawPercentUsed >= 70 && rawPercentUsed < 90;

    return (
      <Popover open={isContextOpen} onOpenChange={setIsContextOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border border-border/60 bg-muted/40 shadow-xs active:scale-98 shrink-0 hover:bg-muted",
              isContextOpen && "bg-muted border-foreground/30",
              isHigh
                ? "text-rose-500 border-rose-500/30"
                : isModerate
                ? "text-amber-500 border-amber-500/30"
                : "text-foreground/80 hover:text-foreground"
            )}
            title={`Context window: ${rawPercentUsed === 0 ? "0%" : percentUsed} (~${formatTokenDisplay(usedTokens)} / ${formatTokenDisplay(totalTokens)})`}
            aria-label={t("contextWindow") || "Context window usage"}
          >
            <svg className="w-3.5 h-3.5 transform -rotate-90" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                className="text-border/80 dark:text-muted/40"
                strokeWidth="2.5"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray={56.55}
                strokeDashoffset={56.55 - (56.55 * safePercent) / 100}
                strokeLinecap="round"
                className={cn(
                  "transition-all duration-300",
                  isHigh
                    ? "text-rose-500 dark:text-rose-400"
                    : isModerate
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-emerald-500 dark:text-emerald-400"
                )}
              />
            </svg>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-72 sm:w-80 max-w-[calc(100vw-32px)] bg-popover border border-border text-popover-foreground rounded-2xl shadow-2xl p-3.5 z-50 flex flex-col gap-2.5 text-left select-none font-sans"
        >
          {/* Header: X% of context used and ~usedTokens / totalTokens */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-baseline gap-1 text-xs">
              <span className="font-bold text-foreground">
                {rawPercentUsed === 0 ? "0%" : rawPercentUsed < 1 ? "<1%" : percentUsed}
              </span>
              <span className="text-muted-foreground font-normal">
                {t("contextUsed") || "of context used"}
              </span>
            </div>
            <span className="font-mono text-xs font-semibold text-foreground/90">
              ~{formatTokenDisplay(usedTokens)} / {formatTokenDisplay(totalTokens)}
            </span>
          </div>

          {/* Multi-segment Horizontal Progress Bar */}
          <div className="w-full h-1.5 bg-muted dark:bg-zinc-800 rounded-full overflow-hidden flex gap-0.5">
            {contextUsage.systemPromptTokens > 0 && (
              <div
                className="bg-zinc-400 dark:bg-zinc-400 h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0.8, (contextUsage.systemPromptTokens / totalTokens) * 100)}%`,
                }}
                title={`${t("systemPrompt") || "System prompt"}: ~${formatTokenDisplay(contextUsage.systemPromptTokens)}`}
              />
            )}
            {contextUsage.toolDefinitionsTokens > 0 && (
              <div
                className="bg-purple-500 dark:bg-purple-400 h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0.8, (contextUsage.toolDefinitionsTokens / totalTokens) * 100)}%`,
                }}
                title={`${t("toolDefinitions") || "Tool definitions"}: ~${formatTokenDisplay(contextUsage.toolDefinitionsTokens)}`}
              />
            )}
            {contextUsage.sourcesTokens > 0 && (
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0.8, (contextUsage.sourcesTokens / totalTokens) * 100)}%`,
                }}
                title={`${t("learningSources") || "Learning sources"}: ~${formatTokenDisplay(contextUsage.sourcesTokens)}`}
              />
            )}
            {contextUsage.messagesTokens > 0 && (
              <div
                className="bg-blue-500 dark:bg-blue-400 h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0.8, (contextUsage.messagesTokens / totalTokens) * 100)}%`,
                }}
                title={`${t("messages") || "Messages"}: ~${formatTokenDisplay(contextUsage.messagesTokens)}`}
              />
            )}
            {contextUsage.draftInputTokens > 0 && (
              <div
                className="bg-pink-500 h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0.8, (contextUsage.draftInputTokens / totalTokens) * 100)}%`,
                }}
                title={`${t("currentInput") || "Current input"}: ~${formatTokenDisplay(contextUsage.draftInputTokens)}`}
              />
            )}
          </div>

          {/* Breakdown List */}
          <div className="flex flex-col gap-2 pt-0.5">
            {/* System Prompt */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-zinc-400 dark:bg-zinc-400 shrink-0" />
                <span className="text-foreground/90 font-medium truncate">
                  {t("systemPrompt") || "System prompt"}
                </span>
              </div>
              <span className="font-mono text-xs font-medium text-foreground/80 shrink-0 ml-2">
                ~{formatTokenDisplay(contextUsage.systemPromptTokens)}
              </span>
            </div>

            {/* Tool Definitions */}
            {contextUsage.toolDefinitionsTokens > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-purple-500 dark:bg-purple-400 shrink-0" />
                  <span className="text-foreground/90 font-medium truncate">
                    {t("toolDefinitions") || "Tool definitions"}
                  </span>
                </div>
                <span className="font-mono text-xs font-medium text-foreground/80 shrink-0 ml-2">
                  ~{formatTokenDisplay(contextUsage.toolDefinitionsTokens)}
                </span>
              </div>
            )}

            {/* Learning Sources (if attached) */}
            {contextUsage.sourcesTokens > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500 shrink-0" />
                  <span className="text-foreground/90 font-medium truncate">
                    {t("learningSources") || "Learning sources"}
                  </span>
                </div>
                <span className="font-mono text-xs font-medium text-foreground/80 shrink-0 ml-2">
                  ~{formatTokenDisplay(contextUsage.sourcesTokens)}
                </span>
              </div>
            )}

            {/* Messages */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-blue-500 dark:bg-blue-400 shrink-0" />
                <span className="text-foreground/90 font-medium truncate">
                  {t("messages") || "Messages"}
                </span>
              </div>
              <span className="font-mono text-xs font-medium text-foreground/80 shrink-0 ml-2">
                ~{formatTokenDisplay(contextUsage.messagesTokens)}
              </span>
            </div>

            {/* Current Input (if typing) */}
            {contextUsage.draftInputTokens > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-pink-500 shrink-0" />
                  <span className="text-foreground/90 font-medium truncate">
                    {t("currentInput") || "Current input"}
                  </span>
                </div>
                <span className="font-mono text-xs font-medium text-foreground/80 shrink-0 ml-2">
                  ~{formatTokenDisplay(contextUsage.draftInputTokens)}
                </span>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderModelDropdown = () => {
    const isCurrentThinkingSupported = Boolean(currentModel?.supportsThinking);
    const currentModelName = currentModel.displayName?.split("(")[0]?.trim() || currentModel.id || "Const";
    const activeThinkingLabel = formatThinkingLabel(thinkingLevel || currentModel.defaultThinkingLevel || "medium");

    // Display string on chat bar: "Gemini 3.8 Flash (High)" or "combo/fast" (no brain icon)
    const triggerDisplayText = isCurrentThinkingSupported
      ? `${currentModelName} (${activeThinkingLabel})`
      : currentModelName;

    const shortModelName = currentModelName
      .replace(/^(Google|Anthropic|OpenAI|Meta)\s+/i, "")
      .replace(/^Gemini\s+/i, "");

    const compactThinkingLabel =
      activeThinkingLabel === "Low"
        ? "Low"
        : activeThinkingLabel === "Medium"
        ? "Med"
        : activeThinkingLabel === "High"
        ? "High"
        : activeThinkingLabel;

    const compactDisplayText = isCurrentThinkingSupported
      ? `${shortModelName} (${compactThinkingLabel})`
      : shortModelName;

    const displayText = isCompact ? compactDisplayText : triggerDisplayText;

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const next = !isModelDropdownOpen;
            if (next) {
              setSearchModelQuery("");
              setMenuView("main");
            }
            setIsModelDropdownOpen(next);
          }}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-muted/70 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none shrink-0",
            isCompact ? "max-w-[135px]" : "max-w-[200px] sm:max-w-[280px]"
          )}
          aria-label={t("selectAiModel")}
          title={triggerDisplayText}
        >
          <span className="text-[12px] font-medium text-foreground/80 truncate">
            {displayText}
          </span>
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground/70 transition-transform duration-150 ml-0.5 shrink-0",
              isModelDropdownOpen && "rotate-180"
            )}
          />
        </button>

        {isModelDropdownOpen && (
          <div
            className="absolute bottom-full right-0 mb-2 w-[275px] max-w-[calc(100vw-32px)] rounded-2xl bg-card border border-border shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* View 1: Main Menu (Choose Model & Thinking Effort) */}
            {menuView === "main" && (
              <div className="flex flex-col gap-0.5">
                {/* 1. Choose Model Menu Item */}
                <button
                  type="button"
                  onClick={() => setMenuView("models")}
                  className="w-full px-3 py-2.5 flex items-center justify-between rounded-xl hover:bg-muted/60 text-left transition-colors cursor-pointer group"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                      {t("chooseModel")}
                    </span>
                    <span className="text-[13px] font-medium text-foreground truncate mt-0.5">
                      {currentModelName}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
                </button>

                {/* 2. Thinking Effort Menu Item */}
                <button
                  type="button"
                  onClick={() => {
                    if (isCurrentThinkingSupported) {
                      setMenuView("thinking");
                    }
                  }}
                  disabled={!isCurrentThinkingSupported}
                  className={cn(
                    "w-full px-3 py-2.5 flex items-center justify-between rounded-xl text-left transition-colors",
                    isCurrentThinkingSupported
                      ? "hover:bg-muted/60 cursor-pointer group"
                      : "opacity-45 cursor-not-allowed"
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                      {t("thinkingEffort")}
                    </span>
                    <span className="text-[13px] font-medium text-foreground truncate mt-0.5">
                      {isCurrentThinkingSupported ? activeThinkingLabel : t("notSupported")}
                    </span>
                  </div>
                  {isCurrentThinkingSupported && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
                  )}
                </button>

                {/* Bottom Footer: Manage models */}
                <div className="flex-none pt-1 border-t border-border/40 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModelDropdownOpen(false);
                      setMenuView("main");
                      onOpenSettings?.("models");
                    }}
                    className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>{t("manageModels")}</span>
                  </button>
                </div>
              </div>
            )}

            {/* View 2: Choose Model Submenu */}
            {menuView === "models" && (
              <div className="flex flex-col">
                {/* Header with Back button and Title */}
                <div className="flex items-center gap-1.5 px-1 py-1 mb-1.5 border-b border-border/40">
                  <button
                    type="button"
                    onClick={() => setMenuView("main")}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={t("back")}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[12px] font-semibold text-foreground">
                    {t("chooseModel")}
                  </span>
                </div>

                {availableModels.length > 0 ? (
                  <>
                    {/* Search Input */}
                    <div className="flex-none flex items-center gap-2 px-2 py-1 mb-1">
                      <Search className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                      <input
                        type="text"
                        value={searchModelQuery}
                        onChange={(e) => setSearchModelQuery(e.target.value)}
                        placeholder={t("searchModels")}
                        className="w-full bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/60 outline-none font-sans"
                        autoFocus
                      />
                      {searchModelQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchModelQuery("")}
                          className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Categorized Model List with ScrollArea */}
                    {filteredGroupedModels.length > 0 ? (
                      <ScrollArea className="max-h-[250px] w-full flex-1 min-h-0" viewportClassName="pr-1">
                        <div className="space-y-2 py-0.5 pr-0.5">
                          {filteredGroupedModels.map((group) => (
                            <div key={group.providerId} className="flex flex-col">
                              {/* Provider Header */}
                              <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-primary select-none tracking-wide">
                                {group.providerName}
                              </div>

                              {/* Model Items */}
                              <div className="flex flex-col space-y-0.5">
                                {group.items.map((m) => {
                                  const isSelected = selectedModelId === m.id;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => handleSelectModel(m)}
                                      className={cn(
                                        "w-full px-2.5 py-1.5 flex items-center justify-between text-[12px] rounded-lg transition-colors cursor-pointer text-left",
                                        isSelected
                                          ? "bg-muted text-foreground font-medium"
                                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                      )}
                                    >
                                      <span className="truncate pr-2">{m.displayName}</span>
                                      {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-foreground shrink-0 ml-auto" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="py-6 px-3 text-center text-xs text-muted-foreground">
                        {t("noModelsFound")}
                      </div>
                    )}

                    {/* Bottom Footer: Manage models */}
                    <div className="flex-none pt-1 border-t border-border/40 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsModelDropdownOpen(false);
                          setMenuView("main");
                          onOpenSettings?.("models");
                        }}
                        className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{t("manageModels")}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 flex flex-col items-center text-center">
                    <div className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground mb-2.5 shadow-2xs">
                      <Cpu className="w-4 h-4 text-muted-foreground stroke-[1.75]" />
                    </div>
                    <div className="text-[13px] font-medium text-foreground">
                      {t("noModelsConfigured")}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-1 mb-3.5">
                      {t("connectModelProviders")}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModelDropdownOpen(false);
                        setMenuView("main");
                        onOpenSettings?.("models");
                      }}
                      className="w-full py-1.5 px-3 rounded-lg bg-muted hover:bg-muted/80 border border-border text-[12px] font-medium text-foreground transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t("manageModels")}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* View 3: Thinking Effort Submenu */}
            {menuView === "thinking" && (
              <div className="flex flex-col">
                {/* Header with Back button and Title */}
                <div className="flex items-center gap-1.5 px-1 py-1 mb-1.5 border-b border-border/40">
                  <button
                    type="button"
                    onClick={() => setMenuView("main")}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={t("back")}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[12px] font-semibold text-foreground">
                    {t("thinkingEffort")}
                  </span>
                </div>

                {/* Thinking Levels List */}
                <div className="flex flex-col space-y-1 py-0.5">
                  {currentThinkingLevels.map((lvl) => {
                    const isSelected =
                      (thinkingLevel || currentModel.defaultThinkingLevel || "medium").toLowerCase() ===
                      lvl.toLowerCase();
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => {
                          setThinkingLevel(lvl);
                          localStorage.setItem("const_learn_thinking_level", lvl);
                          setIsModelDropdownOpen(false);
                          setMenuView("main");
                        }}
                        className={cn(
                          "w-full px-2.5 py-2 flex items-center justify-between text-[12px] rounded-xl transition-colors text-left cursor-pointer",
                          isSelected
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                      >
                        <span className="font-medium text-foreground">
                          {formatThinkingLabel(lvl)}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-foreground shrink-0 ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSendButton = () => {
    if (isStreaming) {
      return (
        <button
          type="button"
          onClick={handleAbort}
          className="h-8 w-8 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title={t("stopGenerating")}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      );
    }

    const hasInput = Boolean(inputMessage.trim() || attachments.length > 0);

    if (!hasInput && !isMultiline) {
      // In single-line mode when empty, show circular mic button (Image 2)
      return (
        <button
          type="button"
          className="h-8 w-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title={t("voiceInput")}
          aria-label={t("voiceInput")}
        >
          <Mic className="h-4 w-4" />
        </button>
      );
    }

    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {isMultiline && (
          <button
            type="button"
            className="h-8 w-8 rounded-full hover:bg-muted/70 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={t("voiceInput")}
            aria-label={t("voiceInput")}
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (hasInput && !isStreaming) {
              handleSend(inputMessage);
            }
          }}
          disabled={!hasInput || isStreaming}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors shrink-0 shadow-xs active:scale-95",
            hasInput && !isStreaming
              ? "bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
              : "bg-muted/60 text-muted-foreground/40 cursor-not-allowed"
          )}
          aria-label={t("sendMessage")}
        >
          <ArrowUp className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>
    );
  };

  const renderPlusButton = () => {
    const isMaxReached = attachments.length >= MAX_ATTACHMENTS;
    return (
      <>
        <button
          type="button"
          onClick={() => {
            if (!isMaxReached) {
              fileInputRef.current?.click();
            }
          }}
          disabled={isMaxReached}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors shrink-0",
            isMaxReached
              ? "opacity-35 cursor-not-allowed text-muted-foreground"
              : "hover:bg-muted/70 text-muted-foreground hover:text-foreground cursor-pointer"
          )}
          title={
            isMaxReached
              ? language === "id"
                ? `Maksimal ${MAX_ATTACHMENTS} media telah tercapai`
                : `Maximum ${MAX_ATTACHMENTS} attachments reached`
              : t("attachFileMedia")
          }
          aria-label={t("attachFileMedia")}
        >
          <Plus className="h-4 w-4 stroke-[2]" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,video/*,audio/*,.pdf,.md,.txt,.py,.json,.csv,.doc,.docx"
        />
      </>
    );
  };

  const renderAttachmentsShelf = () => {
    if (attachments.length === 0) return null;
    return (
      <ScrollArea orientation="horizontal" className="w-full">
        <div className="flex items-center gap-2.5 pt-2.5 pb-2.5 px-2 w-max select-none">
          <TooltipProvider delayDuration={150}>
            {attachments.map((file) => {
              const isImage = file.type === "image";
              const isVideo = file.type === "video";
              const isMedia = isImage || isVideo;
              const ext = (file.name.split(".").pop() || "FILE").toUpperCase();

              return (
                <Tooltip key={file.id}>
                  <TooltipTrigger asChild>
                    <div
                      title={`${file.name} (${formatFileSize(file.size)})`}
                      onClick={() => {
                        if (file.url || file.base64) {
                          setLightboxItem({
                            src: file.url || file.base64 || "",
                            alt: file.name,
                            type: file.type,
                            fileSize: file.size,
                          });
                        }
                      }}
                      className={cn(
                        "relative group shrink-0 rounded-xl border border-border/70 shadow-xs animate-in fade-in zoom-in-95 duration-100 bg-muted/60 select-none cursor-pointer transition-all",
                        isMedia
                          ? "w-20 h-20 hover:opacity-90 active:scale-[0.98]"
                          : "w-36 sm:w-40 h-20 hover:border-foreground/30"
                      )}
                    >
                      {isImage && (file.url || file.base64) ? (
                        <div className="w-full h-full rounded-xl overflow-hidden relative">
                          <img
                            src={file.url || file.base64}
                            alt={file.name}
                            className="w-full h-full object-cover block"
                          />
                          {/* Subtle bottom gradient on hover */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[9.5px] text-white font-medium truncate leading-tight px-0.5">
                              {file.name}
                            </p>
                          </div>
                        </div>
                      ) : isVideo && file.url ? (
                        <div className="w-full h-full rounded-xl overflow-hidden bg-black relative flex items-center justify-center">
                          <video
                            src={file.url}
                            className="w-full h-full object-cover block pointer-events-none"
                            muted
                            playsInline
                            autoPlay
                            loop
                          />
                          <span className="absolute bottom-1 right-1 text-[8px] font-bold text-white bg-black/60 px-1 py-0.5 rounded uppercase tracking-wider font-mono">
                            Video
                          </span>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[9.5px] text-white font-medium truncate leading-tight px-0.5">
                              {file.name}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full p-2 flex flex-col justify-between items-start text-left bg-muted/40 rounded-xl">
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[9px] font-bold text-muted-foreground tracking-wider uppercase font-mono">
                              {ext}
                            </span>
                            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                          </div>
                          {/* Scrollable title with ScrollArea so long titles aren't truncated */}
                          <div className="w-full flex-1 my-1 min-h-0 overflow-hidden">
                            <ScrollArea className="w-full h-full max-h-[34px]">
                              <span className="text-[11px] font-medium text-foreground leading-snug break-words block pr-1">
                                {file.name}
                              </span>
                            </ScrollArea>
                          </div>
                          <div className="w-full flex items-center justify-between">
                            <span className="text-[8.5px] text-muted-foreground font-mono truncate">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Close / Remove button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(file.id);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-card shadow-md border border-border flex items-center justify-center cursor-pointer text-muted-foreground hover:bg-destructive hover:text-white hover:border-destructive hover:scale-105 active:scale-95 transition-all z-20"
                        title={t("removeAttachment")}
                        aria-label={t("removeAttachment")}
                      >
                        <X className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="text-[11px] max-w-[260px] truncate bg-popover text-popover-foreground shadow-md border border-border"
                  >
                    {file.name} ({formatFileSize(file.size)})
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>

          {attachments.length < MAX_ATTACHMENTS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 shrink-0 rounded-xl border border-dashed border-border/70 hover:border-primary/50 text-muted-foreground hover:text-foreground flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer text-[10px] select-none group"
              title={t("addMediaWithCount", { count: attachments.length, max: MAX_ATTACHMENTS })}
            >
              <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-mono text-[9px] text-muted-foreground/80">
                {attachments.length}/{MAX_ATTACHMENTS}
              </span>
            </button>
          )}
        </div>
      </ScrollArea>
    );
  };

  return (
    <main ref={panelRef} className="flex-1 h-full flex flex-col bg-card rounded-2xl border border-border/50 text-foreground min-w-0 relative select-text overflow-hidden shadow-xs">
      {/* Top Header Bar */}
      <div className="h-12 px-3 sm:px-5 flex items-center justify-between shrink-0 select-none gap-2 relative z-20">
        {/* Left: Project / Workspace Folder Indicator */}
        <div className="flex items-center min-w-0 shrink">
          <button
            type="button"
            onClick={() => {
              if (workspacePath && (window as any).electron?.openPath) {
                (window as any).electron.openPath(workspacePath);
              }
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-xl bg-muted/60 hover:bg-muted text-xs font-medium text-foreground dark:text-white transition-all cursor-pointer border border-border/60 select-none shadow-xs active:scale-98 shrink-0 font-sans",
              isCompact ? "h-8 w-8 justify-center px-0" : "px-2.5 py-1 max-w-[200px] sm:max-w-[280px] truncate group"
            )}
            title={
              workspacePath
                ? t("openInExplorer", { path: workspacePath || "" })
                : `${t("defaultWorkspace")} (~/.const/learn/workspaces/)`
            }
            aria-label={t("defaultWorkspace")}
          >
            <Folder className="h-3.5 w-3.5 text-primary dark:text-white shrink-0 group-hover:scale-110 transition-transform" />
            {!isCompact && (
              <span className="truncate font-sans text-xs font-medium">
                {workspacePath
                  ? (workspacePath.split(/[\\/]/).filter(Boolean).pop() || workspacePath)
                  : t("defaultWorkspace")}
              </span>
            )}
          </button>
        </div>

        {/* Right Header Actions: Sources Indicator, New Chat, History, More Options */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sources Dropdown Indicator */}
          {renderSourcesDropdown()}

          {/* New Chat Button (visible when !isCompact) */}
          {!isCompact && (
            <button
              type="button"
              onClick={handleNewChat}
              className="h-8 w-8 rounded-xl hover:bg-muted text-foreground/80 hover:text-foreground dark:text-white/80 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer border border-border/60 bg-muted/40 shadow-xs active:scale-98 shrink-0"
              title={t("startConversationNew")}
              aria-label={t("newChat")}
            >
              <MessageCirclePlus className="h-4 w-4 stroke-[1.8]" />
            </button>
          )}

          {/* Context Window Indicator (visible when !isCompact) */}
          {!isCompact && renderContextIndicator()}

          {/* History Button */}
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="relative h-8 w-8 rounded-xl hover:bg-muted text-foreground/80 hover:text-foreground dark:text-white/80 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer border border-border/60 bg-muted/40 shadow-xs active:scale-98 shrink-0"
            title={t("chatHistory")}
            aria-label={t("chatHistory")}
          >
            <History className="h-4 w-4 stroke-[1.8]" />
            {sessions.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-1 rounded-full bg-secondary text-[9px] font-sans font-medium text-foreground dark:text-white flex items-center justify-center border border-border/60">
                {sessions.length > 99 ? "99+" : sessions.length}
              </span>
            )}
          </button>

          {/* More Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-8 w-8 rounded-xl hover:bg-muted text-foreground/80 hover:text-foreground dark:text-white/80 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer border border-border/60 bg-muted/40 shadow-xs active:scale-98 shrink-0"
                aria-label={t("moreOptions")}
                title={t("moreOptions")}
              >
                <MoreVertical className="h-4 w-4 stroke-[1.8]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5 shadow-xl bg-card border border-border z-50 font-sans">
              {isCompact && (
                <>
                  <DropdownMenuItem
                    onClick={handleNewChat}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs cursor-pointer hover:bg-muted"
                  >
                    <MessageCirclePlus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{t("startConversationNew")}</span>
                  </DropdownMenuItem>
                  {hasStartedChat && (
                    <div className="px-2.5 py-1.5 text-xs text-muted-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{t("contextUsed") || "Context"}</span>
                      </span>
                      <span className="font-mono text-[11px] font-medium text-foreground">
                        {contextUsage.percentUsed} (~{formatTokenDisplay(contextUsage.usedTokens)})
                      </span>
                    </div>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={handleNewChat}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs cursor-pointer hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t("clearConversation")}</span>
              </DropdownMenuItem>
              {workspacePath && (
                <DropdownMenuItem
                  onClick={() => {
                    if ((window as any).electron?.openPath) {
                      (window as any).electron.openPath(workspacePath);
                    }
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs cursor-pointer hover:bg-muted"
                >
                  <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{t("openWorkspaceFolder")}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Conversation Stream using Radix ScrollArea */}
      <ScrollArea className="flex-1 w-full" viewportClassName={cn("py-6 max-w-3xl mx-auto w-full", isCompact ? "px-3 sm:px-4" : "px-4 sm:px-8")}>
        {messages.length === 0 ? (
          carriedSources.length > 0 ? (
            /* NotebookLM Source Guide View (Panduan Sumber) */
            <div className="flex-1 flex flex-col justify-start py-4 max-w-2xl animate-in fade-in duration-200">
              {/* Notebook Title */}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-sans font-semibold tracking-tight text-foreground mb-1.5 leading-snug">
                {currentLearn?.title || carriedSources[0]?.title || t("welcomeNotebookTitle")}
              </h1>

              {/* Meta: Source count and date */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground/80 font-sans mb-5 select-none">
                <span>{carriedSources.length} sumber</span>
                <span>•</span>
                <span>
                  {new Date(carriedSources[0]?.createdAt || Date.now()).toLocaleDateString(
                    "id-ID",
                    { day: "numeric", month: "short", year: "numeric" }
                  )}
                </span>
              </div>

              {/* Source Guide Summary */}
              <div className="text-[13.5px] sm:text-[14px] leading-relaxed text-foreground/90 font-sans mb-4">
                <MarkdownContent
                  content={
                    currentLearn?.description?.trim() ||
                    `Sumber ini menyajikan materi komprehensif mengenai **${carriedSources[0]?.title}**${
                      carriedSources.length > 1
                        ? ` beserta ${carriedSources.length - 1} dokumen pendukung lainnya`
                        : ""
                    }. Materi ini menguraikan parameter kunci, metodologi, dan prinsip dasar yang dapat dijadikan rujukan utama dalam sesi belajar ini. Secara keseluruhan, teks tersebut berfungsi sebagai **panduan teknis** bagi Anda untuk memahami konsep secara mendalam dan terverifikasi.`
                  }
                  sourcesMap={sourcesMap}
                  onSourceClick={handleCitationClick}
                  onOpenBrowser={onOpenBrowser}
                />
              </div>

              {/* Action Bar (Simpan ke Catatan & Feedback) */}
              <div className="flex items-center gap-2 mb-6 select-none">
                <button
                  type="button"
                  onClick={() => {
                    toast.info(
                      "Fitur 'Simpan ke Catatan' (Notes as Sources) akan hadir pada pembaruan berikutnya."
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/60 text-xs font-medium text-foreground transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 group"
                  title="Simpan ringkasan ke catatan"
                >
                  <Pin className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span>Simpan ke catatan</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const textToCopy =
                      currentLearn?.description?.trim() ||
                      `Ringkasan Sumber: ${carriedSources[0]?.title}`;
                    navigator.clipboard.writeText(textToCopy);
                    toast.success("Ringkasan sumber disalin!");
                  }}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Salin ringkasan"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => toast.success("Terima kasih atas masukannya!")}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Bagus"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => toast.info("Masukan Anda telah dicatat.")}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Kurang relevan"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Suggested Questions Stack (Chips) */}
              <div className="flex flex-col gap-2.5 max-w-xl font-sans">
                {[
                  `Jelaskan konsep dan poin utama dari "${carriedSources[0]?.title}" secara ringkas.`,
                  `Bandingkan model atau argumen penting yang dijelaskan dalam sumber ini.`,
                  `Apa saja kesimpulan kunci atau penerapan praktis menurut dokumen ini?`,
                ].map((question, qIdx) => (
                  <button
                    key={qIdx}
                    type="button"
                    onClick={() => {
                      onSelectPromptChip?.(question);
                      handleSend(question);
                    }}
                    className="w-full text-left px-4 py-3 rounded-2xl bg-muted/35 hover:bg-muted/70 border border-border/50 hover:border-border text-xs sm:text-[13px] text-foreground transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99] group leading-relaxed"
                  >
                    <span className="group-hover:text-primary transition-colors">
                      {question}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Welcome Empty State when no sources attached yet */
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-12 max-w-xl mx-auto px-4 select-none animate-in fade-in duration-300">
              <div className="h-14 w-14 rounded-2xl bg-secondary/80 border border-border/70 flex items-center justify-center text-2xl mb-4 shadow-2xs">
                👋
              </div>

              <h1 className="text-2xl sm:text-3xl font-sans font-semibold tracking-tight text-foreground mb-2">
                {t("welcomeNotebookTitle")}
              </h1>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4 max-w-md mx-auto font-sans">
                {t("welcomeNotebookDesc")}
              </p>

              <p className="text-xs text-muted-foreground/80 font-medium mb-3.5 font-sans">
                {t("welcomeNotebookPrompt")}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 font-sans">
                {[
                  t("chipLearnNewTopic"),
                  t("chipCreateContent"),
                  t("chipContinueProject"),
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      onSelectPromptChip?.(chip);
                      handleSend(chip);
                    }}
                    className="px-4 py-2 rounded-full bg-secondary/70 hover:bg-secondary border border-border/70 hover:border-foreground/30 text-xs font-medium text-foreground transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col space-y-6 w-full pb-4">
            {messages.map((msg, idx) => {
              const isAssistant = msg.role === "assistant";
              const isUser = msg.role === "user";
              const isLatestAssistant = isAssistant && isStreaming && idx === messages.length - 1;

              if (isUser) {
                const cleanedContent = cleanUserMessageContent(msg.content);
                const hasAttachments = msg.attachments && msg.attachments.length > 0;

                return (
                  <div key={msg.id} className="flex flex-col items-end w-full group">
                    {/* User Attachments Thumbnails (Compact) */}
                    {hasAttachments && (
                      <div className="flex flex-wrap items-center justify-end gap-2 mb-1.5 max-w-[85%]">
                        {msg.attachments!.map((att) => {
                          const isImage = att.type === "image";
                          const isVideo = att.type === "video";
                          const isMedia = isImage || isVideo;
                          const imgIdx = sessionImageMap.get(att.id) ?? att.imageIndex;
                          const ext = (att.name.split(".").pop() || "FILE").toUpperCase();

                          return (
                            <div
                              key={att.id}
                              onClick={() => {
                                if (att.url || att.base64) {
                                  setLightboxItem({
                                    src: att.url || att.base64 || "",
                                    alt: att.name,
                                    type: att.type,
                                    fileSize: att.size,
                                    imageIndex: imgIdx,
                                  });
                                }
                              }}
                              className={cn(
                                "relative rounded-xl border border-border/70 overflow-hidden shadow-xs bg-muted/60 select-none",
                                isMedia
                                  ? "w-20 h-20 sm:w-24 sm:h-24 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all"
                                  : "w-32 sm:w-36 h-20 sm:h-24 p-2 flex flex-col justify-between items-start text-left bg-muted/50"
                              )}
                              title={`${att.name} (${formatFileSize(att.size)})`}
                            >
                              {isImage && (att.url || att.base64) ? (
                                <img
                                  src={att.url || att.base64}
                                  alt={att.name}
                                  className="w-full h-full object-cover block"
                                />
                              ) : isVideo && att.url ? (
                                <div className="w-full h-full relative flex items-center justify-center bg-black">
                                  <video
                                    src={att.url}
                                    className="w-full h-full object-cover pointer-events-none"
                                    muted
                                    playsInline
                                  />
                                  <span className="absolute bottom-1 right-1 text-[8px] font-bold text-white bg-black/60 px-1 py-0.5 rounded uppercase tracking-wider font-mono">
                                    Video
                                  </span>
                                </div>
                              ) : (
                                <div className="w-full h-full flex flex-col justify-between items-start text-left">
                                  <div className="flex items-center justify-between w-full">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase font-mono">
                                      {ext}
                                    </span>
                                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                  </div>
                                  <div className="w-full flex-1 my-1 min-h-0 overflow-hidden">
                                    <ScrollArea className="w-full h-full max-h-[36px]">
                                      <span className="text-[10.5px] font-medium text-foreground leading-tight break-words block pr-1">
                                        {att.name}
                                      </span>
                                    </ScrollArea>
                                  </div>
                                  <div className="w-full">
                                    <span className="text-[8.5px] text-muted-foreground font-mono block truncate">
                                      {formatFileSize(att.size)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {cleanedContent ? (
                      <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-muted/80 text-foreground px-4 py-2.5 text-[13.5px] border border-border/60 shadow-xs leading-relaxed whitespace-pre-wrap font-sans">
                        {cleanedContent}
                      </div>
                    ) : null}

                    {/* User hover action bar: Timestamp, Copy, Edit */}
                    <div className="flex items-center gap-2 pt-1.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground select-none font-sans">
                      {msg.createdAt && (
                        <span className="text-[11px] font-mono text-muted-foreground/70">
                          {formatMessageTimestamp(msg.createdAt)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, cleanedContent || msg.content)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title={t("copyMessage")}
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditAndUndoTurn(msg)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title={t("editMessage")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="w-full flex flex-col gap-2 group">
                  {/* Execution Trace (Worked for Xs >) */}
                  <ExecutionTrace
                    thinking={msg.thinking}
                    toolCalls={msg.toolCalls}
                    traceSteps={msg.traceSteps}
                    mutations={msg.mutations}
                    isExecuting={isLatestAssistant}
                    durationMs={isLatestAssistant ? liveDurationMs : msg.durationMs}
                    onAnswerQuestion={handleAnswerQuestion}
                    onRollback={(rec) => handleRollbackFile(rec, msg.id)}
                    onRollbackAll={(recs) => handleRollbackAll(recs, msg.id)}
                    onOpenFileDiff={onOpenFileDiff}
                    onOpenBrowser={onOpenBrowser}
                  />

                  {/* Formatted Markdown Content Bubble */}
                  {msg.content ? (
                    <div className="px-0.5">
                      <MarkdownContent
                        content={msg.content}
                        sourcesMap={sourcesMap}
                        onSourceClick={handleCitationClick}
                        onOpenBrowser={onOpenBrowser}
                      />
                      {isLatestAssistant && (
                        <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary animate-pulse align-middle" />
                      )}
                    </div>
                  ) : isLatestAssistant ? (
                    <div className="text-xs text-muted-foreground italic px-1 flex items-center gap-2">
                      <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse align-middle" />
                      <span>{t("processingResponse")}</span>
                    </div>
                  ) : null}

                  {/* Changed Files Summary Card at the bottom of the message only after all output is finished (matching apps/harness/desktop) */}
                  {!isLatestAssistant && msg.mutations && msg.mutations.length > 0 && (
                    <MutationsSummaryCard
                      mutations={msg.mutations}
                      isExecuting={false}
                      onRollback={(rec) => handleRollbackFile(rec, msg.id)}
                      onRollbackAll={(recs) => handleRollbackAll(recs, msg.id)}
                      onOpenFileDiff={onOpenFileDiff}
                    />
                  )}

                  {/* Assistant hover action bar: Timestamp and Copy */}
                  {!isLatestAssistant && msg.content && (
                    <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground select-none font-sans">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title={t("copyMessage")}
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {msg.createdAt && (
                        <span className="text-[11px] font-mono text-muted-foreground/70">
                          {formatMessageTimestamp(msg.createdAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Sticky Bottom Chat Input Container */}
      <div className={cn("shrink-0 max-w-3xl mx-auto w-full font-sans", isCompact ? "p-2.5 sm:p-3" : "p-4 sm:p-5")}>
        {activeApproval ? (
          <ApprovalCard
            request={activeApproval}
            isResponding={isRespondingApproval}
            onDecide={handleRespondApproval}
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isStreaming && (inputMessage.trim() || attachments.length > 0)) {
                handleSend(inputMessage);
              }
            }}
            className={cn(
              "w-full bg-card border border-border focus-within:border-primary/50 transition-[border-color,padding] duration-150 shadow-md rounded-[24px]",
              isMultiline || attachments.length > 0
                ? "p-3 sm:p-3.5"
                : isCompact
                ? "px-3 py-2 sm:py-2.5"
                : "px-3 py-1.5 sm:py-2"
            )}
            style={{
              display: "grid",
              gridTemplateAreas: attachments.length > 0
                ? '"shelf shelf shelf" "input input input" "plus . actions"'
                : isMultiline || isCompact
                ? '"input input input" "plus . actions"'
                : '"plus input actions"',
              gridTemplateColumns: "auto 1fr auto",
              alignItems: isMultiline || attachments.length > 0 || isCompact ? "stretch" : "center",
              rowGap: isMultiline || attachments.length > 0 || isCompact ? "0.5rem" : "0",
              columnGap: "0.5rem",
            }}
          >
            {/* Attachments Shelf */}
            {attachments.length > 0 && (
              <div style={{ gridArea: "shelf" }} className="w-full overflow-hidden">
                {renderAttachmentsShelf()}
              </div>
            )}

            {/* Textarea with ScrollArea - Persistent across single-line & multi-line modes (NEVER UNMOUNTED) */}
            <div style={{ gridArea: "input" }} className="min-w-0 w-full flex items-center">
              <ScrollArea
                className={cn(
                  "w-full",
                  isMultiline || attachments.length > 0
                    ? "max-h-48 sm:max-h-60 [&>div>div[style]]:!block pr-1.5"
                    : isCompact
                    ? "min-h-[28px] max-h-32 overflow-hidden pr-1"
                    : "h-[28px] overflow-hidden"
                )}
              >
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => {
                    handleInputChange(e.target.value);
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (text.includes("\n") || text.length > 60) {
                      setIsMultiline(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!isStreaming && (inputMessage.trim() || attachments.length > 0)) {
                        handleSend(inputMessage);
                      }
                    } else if (e.key === "Enter" && e.shiftKey) {
                      setIsMultiline(true);
                    }
                  }}
                  rows={isMultiline || attachments.length > 0 ? 2 : 1}
                  disabled={isStreaming}
                  placeholder={
                    isStreaming
                      ? t("inputStreamingPlaceholder")
                      : t("inputPlaceholder")
                  }
                  className={cn(
                    "w-full resize-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none font-sans block disabled:opacity-50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-hidden transition-[height] duration-200 ease-out",
                    isMultiline || attachments.length > 0
                      ? "leading-[1.65] py-0.5 min-h-[48px]"
                      : isCompact
                      ? "leading-5 py-0.5 min-h-[26px] max-h-[80px]"
                      : "leading-5 py-1 h-[28px] max-h-[28px] overflow-hidden"
                  )}
                  style={{
                    height: isMultiline || attachments.length > 0 || isCompact ? undefined : `${SINGLE_LINE_HEIGHT}px`,
                  }}
                />
              </ScrollArea>
            </div>

            {/* Plus Button */}
            <div style={{ gridArea: "plus" }} className="shrink-0 self-center flex items-center">
              {renderPlusButton()}
            </div>

            {/* Right Action Items: Model Dropdown + Send Button */}
            <div style={{ gridArea: "actions" }} className="flex items-center gap-1.5 shrink-0 justify-self-end self-center">
              {renderModelDropdown()}
              {renderSendButton()}
            </div>
          </form>
        )}

        {/* Active Conversation Footer Telemetry Bar (Matching apps/harness/desktop) */}
        {conversationMetrics && (
          <div
            className="w-full flex items-center justify-center gap-x-2 text-[11px] font-mono text-muted-foreground pt-2 pb-0.5 select-none overflow-hidden truncate"
            title={`Session telemetry metrics:
${conversationMetrics.turns} turns · ${conversationMetrics.steps} steps
LLM: ${formatDurationDisplay(conversationMetrics.llmDurationMs)} · Tools: ${formatDurationDisplay(conversationMetrics.toolDurationMs)}
Speed: ${conversationMetrics.tokPerSec} tok/s · TTFT: ${conversationMetrics.ttftSeconds.toFixed(1)}s
Cache: ${conversationMetrics.cacheHitRate}%
Tokens: ↑${formatTokenDisplay(conversationMetrics.inputTokens)} · ↓${formatTokenDisplay(conversationMetrics.outputTokens)} tok`}
          >
            {isCompact ? (
              <span className="truncate">
                {conversationMetrics.turns} turns · {conversationMetrics.tokPerSec} tok/s · {conversationMetrics.cacheHitRate}% cache
              </span>
            ) : (
              <div className="w-full flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                <span title={`${conversationMetrics.turns} conversation turns, ${conversationMetrics.steps} tool execution steps`}>
                  {conversationMetrics.turns} turns · {conversationMetrics.steps} steps
                </span>
                <span className="text-border">|</span>
                <span title={`LLM duration: ${formatDurationDisplay(conversationMetrics.llmDurationMs)} · Tools duration: ${formatDurationDisplay(conversationMetrics.toolDurationMs)}`}>
                  LLM {formatDurationDisplay(conversationMetrics.llmDurationMs)} · Tools {formatDurationDisplay(conversationMetrics.toolDurationMs)}
                </span>
                <span className="text-border">|</span>
                <span title={`Average TTFT: ${conversationMetrics.ttftSeconds.toFixed(1)}s · Generation speed: ${conversationMetrics.tokPerSec} tok/s`}>
                  {conversationMetrics.tokPerSec} tok/s
                </span>
                <span className="text-border">|</span>
                <span title={`Prompt cache hit rate: ${conversationMetrics.cacheHitRate}%`}>
                  {conversationMetrics.cacheHitRate}% cache
                </span>
                <span className="text-border">|</span>
                <span title={`Input: ${conversationMetrics.inputTokens.toLocaleString()} tokens · Output: ${conversationMetrics.outputTokens.toLocaleString()} tokens`}>
                  ↑{formatTokenDisplay(conversationMetrics.inputTokens)} · ↓{formatTokenDisplay(conversationMetrics.outputTokens)} tok
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide-over Chat History Panel */}
      <ChatHistoryPanel
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(sessionId) => setActiveSessionId(sessionId)}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
      />

      {/* Media Lightbox */}
      {lightboxItem && (
        <ImageLightbox
          src={lightboxItem.src}
          alt={lightboxItem.alt}
          type={lightboxItem.type}
          fileSize={lightboxItem.fileSize}
          imageIndex={lightboxItem.imageIndex}
          onClose={() => setLightboxItem(null)}
        />
      )}

      {/* Source Reference Inspection Modal */}
      <SourcePreviewDialog
        source={selectedSourceForPreview}
        open={!!selectedSourceForPreview}
        onOpenChange={(open) => {
          if (!open) setSelectedSourceForPreview(null);
        }}
        onOpenBrowser={onOpenBrowser}
      />
    </main>
  );
}
