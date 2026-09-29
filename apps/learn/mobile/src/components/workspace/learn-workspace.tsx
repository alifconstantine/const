import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, type LocalMessage, type LocalArtifact, type LocalChatSession, type LocalSource } from "../../lib/db";
import { buildGroundedContext } from "../../lib/grounding/context-builder";
import { buildGroundedSystemPrompt } from "../../lib/grounding/grounding-prompt";
import {
  DEFAULT_MOBILE_MODELS,
  streamChatCompletion,
  fetchRouterModels,
  generateChatTitle,
  type MobileModel,
} from "../../lib/ai-stream";
import { MarkdownContent } from "./markdown-content";
import { ChatInputCard, type AttachedMedia } from "./chat-input-card";
import { AddSourceDialog } from "./add-source-dialog";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { SourcesSheet } from "./sources-sheet";
import { SourcePreviewDialog } from "./source-preview-dialog";
import { StudioSheet, type GeneratingArtifactStatus } from "./studio-sheet";
import { CreateArtifactSheet } from "./create-artifact-sheet";
import { CreateMindMapSheet } from "./create-mind-map-sheet";
import { CreateAudioSummarySheet } from "./create-audio-summary-sheet";
import { CreatePresentationSheet } from "./create-presentation-sheet";
import { CreateInfographicSheet } from "./create-infographic-sheet";
import { CreateReportSheet } from "./create-report-sheet";
import { CreateCheatSheetSheet } from "./create-cheatsheet-sheet";
import { ModelSelectionSheet } from "../home/sheets/model-selection-sheet";
import { MobileArtifactReader } from "./mobile-artifact-reader";
import {
  generateStudioArtifact,
  generatePresentationArtifact,
  generateInfographicArtifact,
  generateReportArtifact,
  generateCheatSheetArtifact,
} from "../../lib/studio/generator";
import { WorkingProcess } from "./working-process";
import { ImageLightbox } from "./image-lightbox";
import {
  calculateConversationMetrics,
  calculateContextUsage,
  formatTokenDisplay,
  formatDurationDisplay,
  parseContextWindowTokens,
} from "../../lib/telemetry";
import {
  ScrollArea,
  cn,
  toast,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@const/ui";
import { marked } from "marked";
import { useI18n } from "../../lib/i18n";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

async function parseUploadedMedia(files: FileList | File[]): Promise<AttachedMedia[]> {
  const readBase64 = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });

  const newItems: AttachedMedia[] = [];
  const list = Array.from(files);

  for (const file of list) {
    if (!file) continue;

    let type: AttachedMedia["type"] = "other";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";
    else if (
      file.type.includes("pdf") ||
      file.type.includes("document") ||
      file.type.includes("text") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".txt")
    ) {
      type = "document";
    }

    const url =
      type === "image" || type === "video" ? URL.createObjectURL(file) : undefined;
    const base64 = type === "image" ? await readBase64(file) : undefined;

    newItems.push({
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      size: file.size,
      type,
      url,
      base64,
      file,
    });
  }

  return newItems;
}

import {
  ArrowLeft,
  ArrowUp,
  Camera,
  Share2,
  Plus,
  FolderOpen,
  MessageSquare,
  LayoutGrid,
  Search,
  Globe,
  FileText,
  ChevronDown,
  ChevronRight,
  AudioLines,
  Presentation,
  Video,
  GitFork,
  HelpCircle,
  Award,
  BarChart3,
  Table2,
  FileSpreadsheet,
  PenTool,
  Check,
  RotateCcw,
  RotateCw,
  X,
  Brain,
  Download,
  Package,
  Copy,
  Loader2,
  History,
  MessageCirclePlus,
  Pencil,
  Pin,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  SquarePen,
  Eye,
  Trash2,
  BookOpen,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Link as LinkIcon,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  RemoveFormatting,
  Wand2,
  Layers,
  Gauge,
  Database,
} from "lucide-react";

type WorkspaceTab = "sources" | "chat" | "tools";

interface StudioTool {
  id: string;
  name: string;
  icon: React.ElementType;
  iconColor: string;
  textColor?: string;
  cardBg: string;
  borderColor: string;
  hoverBg: string;
  hoverBorder: string;
  hasBadge?: boolean;
}

const STUDIO_TOOLS: StudioTool[] = [
  {
    id: "audio_summary",
    name: "Audio Overview",
    icon: AudioLines,
    iconColor: "text-indigo-600 dark:text-[#a5b4fc]",
    textColor: "text-indigo-950 dark:text-[#dbeafe]",
    cardBg: "bg-indigo-50/70 dark:bg-[#21232d]",
    borderColor: "border-indigo-200/70 dark:border-[#303444]",
    hoverBg: "hover:bg-indigo-100/70 dark:hover:bg-[#282b37]",
    hoverBorder: "hover:border-indigo-300 dark:hover:border-[#3d4257]",
  },
  {
    id: "slides",
    name: "Presentation Slides",
    icon: Presentation,
    iconColor: "text-amber-600 dark:text-[#fde047]",
    textColor: "text-amber-950 dark:text-[#fef9c3]",
    cardBg: "bg-amber-50/70 dark:bg-[#2b291d]",
    borderColor: "border-amber-200/70 dark:border-[#3e3b2a]",
    hoverBg: "hover:bg-amber-100/70 dark:hover:bg-[#353224]",
    hoverBorder: "hover:border-amber-300 dark:hover:border-[#4f4b36]",
  },
  {
    id: "video_summary",
    name: "Video Summary",
    icon: Video,
    iconColor: "text-emerald-600 dark:text-[#86efac]",
    textColor: "text-emerald-950 dark:text-[#dcfce7]",
    cardBg: "bg-emerald-50/70 dark:bg-[#1d2820]",
    borderColor: "border-emerald-200/70 dark:border-[#2b3d30]",
    hoverBg: "hover:bg-emerald-100/70 dark:hover:bg-[#243329]",
    hoverBorder: "hover:border-emerald-300 dark:hover:border-[#384e3e]",
  },
  {
    id: "mind_map",
    name: "Mind Map",
    icon: GitFork,
    iconColor: "text-pink-600 dark:text-[#f472b6]",
    textColor: "text-pink-950 dark:text-[#fce7f3]",
    cardBg: "bg-pink-50/70 dark:bg-[#2e212b]",
    borderColor: "border-pink-200/70 dark:border-[#422f3e]",
    hoverBg: "hover:bg-pink-100/70 dark:hover:bg-[#372834]",
    hoverBorder: "hover:border-pink-300 dark:hover:border-[#543b4f]",
  },
  {
    id: "report",
    name: "Report",
    icon: FileText,
    iconColor: "text-stone-600 dark:text-[#dedac2]",
    textColor: "text-stone-950 dark:text-[#f5f4eb]",
    cardBg: "bg-stone-100/80 dark:bg-[#29281e]",
    borderColor: "border-stone-200/80 dark:border-[#3c3a2b]",
    hoverBg: "hover:bg-stone-200/70 dark:hover:bg-[#343225]",
    hoverBorder: "hover:border-stone-300 dark:hover:border-[#4d4a37]",
  },
  {
    id: "quiz",
    name: "Quiz & Flashcards",
    icon: HelpCircle,
    iconColor: "text-teal-600 dark:text-[#5eead4]",
    textColor: "text-teal-950 dark:text-[#ccfbf1]",
    cardBg: "bg-teal-50/70 dark:bg-[#1c2628]",
    borderColor: "border-teal-200/70 dark:border-[#29383c]",
    hoverBg: "hover:bg-teal-100/70 dark:hover:bg-[#233235]",
    hoverBorder: "hover:border-teal-300 dark:hover:border-[#364b50]",
  },
  {
    id: "infographic",
    name: "Infographic",
    icon: BarChart3,
    iconColor: "text-purple-600 dark:text-[#c084fc]",
    textColor: "text-purple-950 dark:text-[#f3e8ff]",
    cardBg: "bg-purple-50/70 dark:bg-[#28202d]",
    borderColor: "border-purple-200/70 dark:border-[#3a2d42]",
    hoverBg: "hover:bg-purple-100/70 dark:hover:bg-[#322739]",
    hoverBorder: "hover:border-purple-300 dark:hover:border-[#4b3a55]",
  },
  {
    id: "cheatsheet",
    name: "CheatSheet",
    icon: FileSpreadsheet,
    iconColor: "text-sky-600 dark:text-[#38bdf8]",
    textColor: "text-sky-950 dark:text-[#e0f2fe]",
    cardBg: "bg-sky-50/70 dark:bg-[#1a252f]",
    borderColor: "border-sky-200/70 dark:border-[#263746]",
    hoverBg: "hover:bg-sky-100/70 dark:hover:bg-[#22303d]",
    hoverBorder: "hover:border-sky-300 dark:hover:border-[#334a5e]",
  },
];

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  thinkingDurationMs?: number;
  isStreaming?: boolean;
  isError?: boolean;
  rawError?: string;
  toolCalls?: any[];
  durationMs?: number;
  attachments?: any[];
  createdAt?: number;
}

interface MobileLearnWorkspaceProps {
  learnId: string;
  initialSourceModalOpen?: boolean;
  onBack: () => void;
  onCreateNew?: () => void;
  onSelectLearn?: (learnId: string) => void;
  user?: any;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
  onOpenSettings?: () => void;
}

export function MobileLearnWorkspace({
  learnId,
  initialSourceModalOpen = false,
  onBack,
  onCreateNew,
  onSelectLearn,
  user,
  onSignOut,
  onSwitchAccount,
  onOpenSettings,
}: MobileLearnWorkspaceProps) {
  const { t, language } = useI18n();

  const toolNameMap: Record<string, string> = {
    audio_summary: t("toolsAudioSummary"),
    slides: t("toolsSlides"),
    video_summary: t("toolsVideo"),
    mind_map: t("toolsMindMap"),
    report: t("toolsReport"),
    quiz: t("toolsQuiz"),
    flashcards: t("toolsFlashcards") || (language === "id" ? "Kartu Tanya-Jawab" : "Flashcards"),
    infographic: t("toolsInfographic"),
    cheatsheet: t("toolsCheatSheet") || "CheatSheet",
    data_table: t("toolsCheatSheet") || t("toolsDataTable") || "CheatSheet",
  };

  // Live notebook data from local Dexie
  const learn = useLiveQuery(async () => {
    return await db.learns.get(learnId);
  }, [learnId]);

  // Live artifacts from local Dexie
  const artifacts = useLiveQuery(async () => {
    const list = await db.artifacts.where("learnId").equals(learnId).toArray();
    return list.sort((a, b) => {
      const timeA = Math.max(a.updatedAt || 0, a.createdAt || 0);
      const timeB = Math.max(b.updatedAt || 0, b.createdAt || 0);
      return timeB - timeA;
    });
  }, [learnId]);

  // Live sources from local Dexie
  const sources =
    useLiveQuery(async () => {
      return await db.sources
        .where("learnId")
        .equals(learnId)
        .reverse()
        .sortBy("createdAt");
    }, [learnId]) || [];

  const carriedSources = sources.filter((s) => s.includedInChat !== false);

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

  const [selectedSourceForPreview, setSelectedSourceForPreview] =
    useState<LocalSource | null>(null);

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

  // Navigation drawers & sheets
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSourcesSheetOpen, setIsSourcesSheetOpen] = useState(false);
  const [isStudioSheetOpen, setIsStudioSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chat");

  // Studio Artifact creation, in-progress generating, and full-screen reader states
  const [isCreateArtifactSheetOpen, setIsCreateArtifactSheetOpen] = useState(false);
  const [createArtifactType, setCreateArtifactType] = useState<"quiz" | "flashcard">("quiz");
  const [isCreateMindMapSheetOpen, setIsCreateMindMapSheetOpen] = useState(false);
  const [isCreateAudioSummaryOpen, setIsCreateAudioSummaryOpen] = useState(false);
  const [isCreatePresentationOpen, setIsCreatePresentationOpen] = useState(false);
  const [isCreateInfographicOpen, setIsCreateInfographicOpen] = useState(false);
  const [isCreateReportSheetOpen, setIsCreateReportSheetOpen] = useState(false);
  const [isCreateCheatSheetOpen, setIsCreateCheatSheetOpen] = useState(false);
  const [modelSelectionCategory, setModelSelectionCategory] = useState<"llm" | "voice" | "image">("voice");
  const [isModelSelectionSheetOpen, setIsModelSelectionSheetOpen] = useState(false);
  const [generatingArtifacts, setGeneratingArtifacts] = useState<GeneratingArtifactStatus[]>([]);
  const [selectedReaderArtifact, setSelectedReaderArtifact] = useState<LocalArtifact | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  // Open link directly in user's default browser on mobile
  const handleOpenBrowser = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Local state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [availableModels, setAvailableModels] = useState<MobileModel[]>(DEFAULT_MOBILE_MODELS);
  const [selectedModelId, setSelectedModelId] = useState<string>(
    DEFAULT_MOBILE_MODELS[0]!.id
  );
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isContextDropdownOpen, setIsContextDropdownOpen] = useState(false);
  const [searchModelQuery, setSearchModelQuery] = useState("");
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(initialSourceModalOpen);
  const [addSourceInitialSearch, setAddSourceInitialSearch] = useState<{
    query: string;
    scope?: "web" | "journal";
    speed?: "fast" | "deep";
    autoSearch?: boolean;
  } | undefined>(undefined);

  // Inline Message Editing State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingAttachments, setEditingAttachments] = useState<AttachedMedia[]>([]);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic visualViewport tracking to adjust cleanly when software keyboard opens/closes
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewport = () => {
      if (window.visualViewport) {
        const vv = window.visualViewport;
        const screenH = window.innerHeight;
        const isKb = screenH - vv.height > 100;
        setIsKeyboardOpen(isKb);
        setViewportHeight(vv.height);

        // Auto-scroll messages into view when keyboard opens
        if (isKb && messagesEndRef.current) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 80);
        }
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewport);
      window.visualViewport.addEventListener("scroll", updateViewport);
    } else {
      window.addEventListener("resize", updateViewport);
    }
    updateViewport();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewport);
        window.visualViewport.removeEventListener("scroll", updateViewport);
      } else {
        window.removeEventListener("resize", updateViewport);
      }
    };
  }, []);

  const currentModel = useMemo(() => {
    return (
      availableModels.find((m) => m.id === selectedModelId) ??
      availableModels[0] ??
      DEFAULT_MOBILE_MODELS[0]!
    );
  }, [availableModels, selectedModelId]);

  // Dynamic telemetry metrics for active conversation
  const conversationMetrics = useMemo(() => {
    return calculateConversationMetrics(messages);
  }, [messages]);

  // Context window usage estimation for learning sources and discussion history
  const contextUsage = useMemo(() => {
    const totalTokens = parseContextWindowTokens((currentModel as any)?.contextWindow);
    return calculateContextUsage({
      sources,
      sourcesCount: learn?.sourcesCount || 0,
      messages,
      draftInput: inputMessage,
      totalTokens,
    });
  }, [sources, learn?.sourcesCount, messages, inputMessage, currentModel]);

  // Context window indicator visibility: only show once user has sent their first message
  const hasStartedChat = useMemo(() => {
    return messages.some((m) => m.role === "user");
  }, [messages]);

  useEffect(() => {
    if (!hasStartedChat && isContextDropdownOpen) {
      setIsContextDropdownOpen(false);
    }
  }, [hasStartedChat, isContextDropdownOpen]);

  const filteredModels = useMemo(() => {
    const q = searchModelQuery.toLowerCase().trim();
    if (!q) return availableModels;
    return availableModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q)
    );
  }, [availableModels, searchModelQuery]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState("Web");
  const [researchSpeed, setResearchSpeed] = useState("Fast Research");
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedMedia[]>([]);
  const [lightboxItem, setLightboxItem] = useState<{
    src: string;
    alt: string;
    type?: AttachedMedia["type"];
    fileSize?: number;
    imageIndex?: number;
  } | null>(null);
  const [expandedUserMessageId, setExpandedUserMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamStartTime, setStreamStartTime] = useState<number>(0);
  const [liveDurationMs, setLiveDurationMs] = useState<number>(0);

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

  // Reactively query chat sessions for this learn/notebook
  const sessions = useLiveQuery(async () => {
    if (!learnId) return [];
    return await localDb.getChatSessions(learnId);
  }, [learnId]);

  // Current active chat session
  const activeSession = useMemo(() => {
    return sessions?.find((s) => s.id === activeSessionId) || sessions?.[0] || null;
  }, [sessions, activeSessionId]);

  // Initialize or restore active chat session on learnId change
  useEffect(() => {
    if (!learnId) {
      setActiveSessionId(null);
      return;
    }
    let isMounted = true;
    (async () => {
      const existing = await localDb.getChatSessions(learnId);
      if (!isMounted) return;
      if (existing.length === 0) {
        const defaultName = language === "id" ? "Percakapan Baru" : "New Chat";
        const newId = await localDb.createChatSession(learnId, defaultName);
        if (isMounted) {
          setActiveSessionId(newId);
        }
      } else if (!activeSessionId || !existing.some((s) => s.id === activeSessionId)) {
        setActiveSessionId(existing[0]!.id);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [learnId]);

  // Live timer for working process duration
  useEffect(() => {
    if (!isStreaming || !streamStartTime) return;
    const interval = setInterval(() => {
      setLiveDurationMs(Math.max(0, Date.now() - streamStartTime));
    }, 400);
    return () => clearInterval(interval);
  }, [isStreaming, streamStartTime]);

  // Fetch available models dynamically from router on mount
  useEffect(() => {
    fetchRouterModels().then((models) => {
      if (models && models.length > 0) {
        setAvailableModels(models);
      }
    });
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const shouldScrollToLastUserRef = useRef<boolean>(true);
  const isUserSendingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Editable session title in header
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(
    language === "id" ? "Percakapan Baru" : "New Chat"
  );

  useEffect(() => {
    if (activeSession?.title) {
      setTitleValue(activeSession.title);
    } else {
      setTitleValue(language === "id" ? "Percakapan Baru" : "New Chat");
    }
  }, [activeSession?.title, language]);

  // ID of the last user message in the current conversation for scroll positioning
  const lastUserMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") return messages[i]!.id;
    }
    return null;
  }, [messages]);

  // Load chat messages from local Dexie when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      setIsMessagesLoaded(true);
      return;
    }
    let isMounted = true;
    setIsMessagesLoaded(false);
    shouldScrollToLastUserRef.current = true;
    localDb.getSessionMessages(activeSessionId).then((saved) => {
      if (!isMounted) return;
      shouldScrollToLastUserRef.current = true;
      if (saved && saved.length > 0) {
        setMessages(
          saved.map((m) => {
            const savedRawError = (m as any).rawError;
            const content =
              m.content ||
              (savedRawError
                ? t("callConstFailed", { error: savedRawError })
                : "");
            return {
              id: m.id,
              role: m.role as "user" | "assistant",
              content,
              thinking: m.thinking,
              toolCalls: m.toolCalls,
              durationMs: m.durationMs,
              attachments: m.attachments,
              createdAt: m.createdAt,
              isStreaming: false,
            };
          })
        );
      } else {
        setMessages([]);
      }
      setIsMessagesLoaded(true);
    });

    return () => {
      isMounted = false;
    };
  }, [activeSessionId]);

  // Scroll positioning helper: aligns to the last user message at top of viewport with comfortable margin, or scrolls to top if empty
  const scrollToLastUserMessage = (behavior: ScrollBehavior = "auto") => {
    const container = chatScrollContainerRef.current;
    if (!container) return;

    if (lastUserMessageRef.current) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = lastUserMessageRef.current.getBoundingClientRect();
      const currentScrollTop = container.scrollTop;
      const targetOffsetTop = targetRect.top - containerRect.top + currentScrollTop;
      // Position with 12px top margin so user message bubble sits comfortably at top (matching Gemini reference)
      const desiredScrollTop = Math.max(0, targetOffsetTop - 12);

      if (behavior === "smooth") {
        container.scrollTo({ top: desiredScrollTop, behavior: "smooth" });
      } else {
        container.scrollTop = desiredScrollTop;
      }
    } else {
      container.scrollTop = 0;
    }
  };

  // Smart scroll effect: positions viewport at the last user message immediately on load/switch before paint,
  // scrolls smoothly when user sends a new message, and smoothly tracks incoming assistant stream.
  useLayoutEffect(() => {
    if (activeTab !== "chat" || !isMessagesLoaded) return;

    if (shouldScrollToLastUserRef.current) {
      shouldScrollToLastUserRef.current = false;
      scrollToLastUserMessage("auto");
      requestAnimationFrame(() => {
        scrollToLastUserMessage("auto");
      });
      return;
    }

    if (isUserSendingRef.current) {
      isUserSendingRef.current = false;
      requestAnimationFrame(() => {
        scrollToLastUserMessage("smooth");
      });
      return;
    }

    if (isStreaming) {
      const container = chatScrollContainerRef.current;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages, isStreaming, activeTab, isMessagesLoaded]);

  const handleCopy = (id: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleSaveTitle = async () => {
    setIsEditingTitle(false);
    const defaultName = language === "id" ? "Percakapan Baru" : "New Chat";
    const trimmed = titleValue.trim() || defaultName;
    setTitleValue(trimmed);
    if (activeSessionId) {
      await localDb.updateChatSession(activeSessionId, { title: trimmed });
    }
  };

  const handleClearHistory = async () => {
    if (isStreaming) {
      handleStop();
    }
    shouldScrollToLastUserRef.current = true;
    if (activeSessionId) {
      await localDb.clearSessionMessages(activeSessionId);
    }
    setMessages([]);
  };

  // Create a new chat session within the current workspace/learn
  const handleNewChat = async () => {
    if (isStreaming) {
      handleStop();
    }
    if (!learnId) return;
    shouldScrollToLastUserRef.current = true;
    const defaultName = language === "id" ? "Percakapan Baru" : "New Chat";
    const newSessionId = await localDb.createChatSession(learnId, defaultName);
    setActiveSessionId(newSessionId);
    setMessages([]);
    setIsMessagesLoaded(true);
    setInputMessage("");
    setAttachedFiles([]);
  };

  const handleSelectChat = (sessionId: string) => {
    if (isStreaming) {
      handleStop();
    }
    shouldScrollToLastUserRef.current = true;
    setActiveSessionId(sessionId);
  };

  const handleDeleteChat = async (sessionId: string) => {
    await localDb.deleteChatSession(sessionId);
    shouldScrollToLastUserRef.current = true;
    if (activeSessionId === sessionId) {
      const remaining = (sessions || []).filter((s) => s.id !== sessionId);
      if (remaining.length > 0 && remaining[0]) {
        setActiveSessionId(remaining[0].id);
      } else {
        const defaultName = language === "id" ? "Percakapan Baru" : "New Chat";
        const newId = await localDb.createChatSession(learnId, defaultName);
        setActiveSessionId(newId);
        setMessages([]);
      }
    }
  };

  const handleRenameChat = async (sessionId: string, newTitle: string) => {
    const trimmed = newTitle.trim() || (language === "id" ? "Percakapan Baru" : "New Chat");
    await localDb.updateChatSession(sessionId, { title: trimmed });
    if (sessionId === activeSessionId) {
      setTitleValue(trimmed);
    }
  };

  const handleTogglePinChat = async (sessionId: string, isPinned: boolean) => {
    await localDb.updateChatSession(sessionId, { isPinned });
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleEditFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - editingAttachments.length;
    if (remainingSlots <= 0) {
      if (editFileInputRef.current) editFileInputRef.current.value = "";
      return;
    }

    const newItems = await parseUploadedMedia(Array.from(files).slice(0, remainingSlots));
    setEditingAttachments((prev) => [...prev, ...newItems].slice(0, 5));
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - editingAttachments.length;
    if (remainingSlots <= 0) {
      if (editImageInputRef.current) editImageInputRef.current.value = "";
      return;
    }

    const newItems = await parseUploadedMedia(Array.from(files).slice(0, remainingSlots));
    setEditingAttachments((prev) => [...prev, ...newItems].slice(0, 5));
    if (editImageInputRef.current) editImageInputRef.current.value = "";
  };

  const removeEditAttachment = (id: string) => {
    setEditingAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item?.url) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleStartEditMessage = (msg: DisplayMessage) => {
    if (isStreaming) {
      toast.warning(
        language === "id"
          ? "Tunggu AI selesai merespons sebelum mengedit pesan"
          : "Please wait for AI to finish responding before editing"
      );
      return;
    }
    const cleaned = cleanUserMessageContent(msg.content);
    setEditingMessageId(msg.id);
    setEditingText(cleaned || msg.content || "");
    setEditingAttachments(msg.attachments ? [...msg.attachments] : []);
    setTimeout(() => {
      if (editTextareaRef.current) {
        editTextareaRef.current.focus();
        editTextareaRef.current.style.height = "auto";
        editTextareaRef.current.style.height = `${Math.min(editTextareaRef.current.scrollHeight, 240)}px`;
      }
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
    setEditingAttachments([]);
  };

  const handleConfirmEditTurn = async (userMsg: DisplayMessage) => {
    const textToSend = editingText.trim();
    const attachmentsToSend = [...editingAttachments];

    if (!textToSend && attachmentsToSend.length === 0) return;

    const userIdx = messages.findIndex((m) => m.id === userMsg.id);
    if (userIdx === -1) return;

    // 1. Truncate from DB starting from this user message
    await localDb.truncateSessionFromMessage(userMsg.id, activeSessionId || undefined);

    // 2. Keep prior conversation history
    const priorHistory = messages.slice(0, userIdx);

    // 3. Exit inline editing
    setEditingMessageId(null);
    setEditingText("");
    setEditingAttachments([]);

    // 4. Send updated prompt to AI
    await handleSend(textToSend, attachmentsToSend, priorHistory);
  };

  const handleSend = async (
    customPrompt?: string,
    attachmentsToSend?: AttachedMedia[],
    overrideHistory?: DisplayMessage[]
  ) => {
    let textToSend = (customPrompt !== undefined ? customPrompt : inputMessage).trim();
    const currentAttachments = attachmentsToSend || attachedFiles;
    if ((!textToSend && currentAttachments.length === 0) || isStreaming) return;

    if (!textToSend && currentAttachments.length > 0) {
      textToSend = t("analyzeAttachedMediaPrompt");
    }

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      const defaultName = language === "id" ? "Percakapan Baru" : "New Chat";
      try {
        targetSessionId = await localDb.createChatSession(learnId, defaultName);
        setActiveSessionId(targetSessionId);
      } catch (err) {
        console.error("Failed to create chat session:", err);
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const now = Date.now();
    setStreamStartTime(now);
    setLiveDurationMs(0);

    const userMsgId = `user_${now}`;
    const assistantMsgId = `asst_${now}`;

    // Count prior images in the session
    const historyBase = overrideHistory !== undefined ? overrideHistory : messages;
    let priorImagesCount = 0;
    for (const m of historyBase) {
      if (m.role === "user" && m.attachments) {
        for (const a of m.attachments) {
          if (a.type === "image") {
            priorImagesCount++;
          }
        }
      }
    }

    let currentSessionImageCounter = 0;
    const processedAttachments = currentAttachments.map((a) => {
      let imageIndex: number | undefined = undefined;
      if (a.type === "image") {
        currentSessionImageCounter++;
        imageIndex = priorImagesCount + currentSessionImageCounter;
      }
      return {
        id: a.id,
        name: a.name,
        size: a.size,
        type: a.type,
        url: a.url,
        base64: a.base64,
        imageIndex,
      };
    });

    // Format prompt text with chronological image numbers for AI context
    let promptWithAttachments = textToSend;
    if (processedAttachments.length > 0) {
      const imageLines = processedAttachments
        .filter((a) => a.type === "image")
        .map(
          (a) =>
            `- Image ${a.imageIndex} (Gambar ${a.imageIndex}): "${a.name}"`
        );
      const otherLines = processedAttachments
        .filter((a) => a.type !== "image")
        .map((a) => `- Document/File: "${a.name}" (${formatFileSize(a.size)})`);

      const mediaList = [...imageLines, ...otherLines].join("\n");
      promptWithAttachments = `${textToSend ? textToSend + "\n\n" : ""}[Attached media / Lampiran media:\n${mediaList}\n\nNote for AI: The images above are provided in chronological order as Image 1, Image 2, etc. When the user refers to "image 1", "image 2", "gambar 1", "foto 1", etc., refer to the corresponding image listed above.]`;
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
      attachments: processedAttachments,
      createdAt: now,
    };

    const newAssistantMsg: DisplayMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinking: "",
      isStreaming: true,
      createdAt: now,
    };

    // Save user message to Dexie with sessionId
    if (learnId && targetSessionId) {
      try {
        await localDb.saveMessage({
          id: userMsgId,
          learnId,
          sessionId: targetSessionId,
          role: "user",
          content: textToSend,
          attachments: processedAttachments,
          createdAt: now,
        });
      } catch (err) {
        console.error("Failed to save user message to Dexie:", err);
      }
    }

    // Auto-generate title with AI (with fallback) for this chat session
    const isDefaultTitle =
      !activeSession?.title ||
      activeSession.title.trim().toLowerCase() === "percakapan baru" ||
      activeSession.title.trim().toLowerCase() === "new chat" ||
      activeSession.title.trim().toLowerCase() === "untitled chat" ||
      activeSession.title.trim().toLowerCase() === "untitled notebook" ||
      activeSession.title.trim().toLowerCase() === "notebook tanpa judul";

    if (isDefaultTitle && textToSend && targetSessionId) {
      generateChatTitle(textToSend, selectedModelId).then((newTitle) => {
        if (newTitle && newTitle.trim().length > 0) {
          setTitleValue(newTitle);
          localDb.updateChatSession(targetSessionId!, { title: newTitle });
        }
      });
    }

    const nextMessages = [...historyBase, newUserMsg];
    isUserSendingRef.current = true;
    setMessages([...nextMessages, newAssistantMsg]);
    if (overrideHistory === undefined) {
      setInputMessage("");
      setAttachedFiles([]);
    }
    setIsStreaming(true);

    const formattedMessages = nextMessages.map((m, idx) => {
      const isLatest = idx === nextMessages.length - 1;
      if (isLatest) {
        if (
          processedAttachments.some((a) => a.type === "image" && (a.base64 || a.url))
        ) {
          const parts: any[] = [];
          if (promptWithAttachments) {
            parts.push({ type: "text", text: promptWithAttachments });
          }
          for (const a of processedAttachments) {
            if (a.type === "image" && (a.base64 || a.url)) {
              parts.push({
                type: "image_url",
                image_url: {
                  url: a.base64 || a.url,
                },
              });
            }
          }
          return {
            role: m.role,
            content: parts,
          };
        }
        return {
          role: m.role,
          content: promptWithAttachments || m.content || "",
        };
      }
      return {
        role: m.role,
        content: m.content || "",
      };
    });

    try {
      await streamChatCompletion({
        model: selectedModelId,
        messages: formattedMessages,
        systemPrompt,
        temperature: carriedSources.length > 0 ? 0.2 : 0.7,
        signal: controller.signal,
        onThinking: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, thinking: (msg.thinking || "") + chunk }
                : msg
            )
          );
        },
        onToolCallStart: (toolCall) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    toolCalls: [
                      ...(msg.toolCalls || []).filter((tc: any) => tc.id !== toolCall.id),
                      toolCall,
                    ],
                  }
                : msg
            )
          );
        },
        onToolCallResult: (toolCall) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    toolCalls: (msg.toolCalls || []).map((tc: any) =>
                      tc.id === toolCall.id ? toolCall : tc
                    ),
                  }
                : msg
            )
          );
        },
        onToken: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMsgId) return msg;
              const hasThinking = Boolean(msg.thinking && msg.thinking.trim().length > 0);
              const thinkingDur =
                msg.thinkingDurationMs ?? (hasThinking ? Math.max(1000, Date.now() - now) : undefined);
              return {
                ...msg,
                content: (msg.content || "") + chunk,
                thinkingDurationMs: thinkingDur,
              };
            })
          );
        },
        onDone: async (finalContent, finalThinking, finalToolCalls) => {
          const resolvedContent = finalContent || t("noResponseReceived");
          const finalDuration = Date.now() - now;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: resolvedContent,
                    thinking: finalThinking,
                    toolCalls: finalToolCalls && finalToolCalls.length > 0 ? finalToolCalls : msg.toolCalls,
                    thinkingDurationMs:
                      msg.thinkingDurationMs ??
                      (finalThinking && finalThinking.trim().length > 0
                        ? Math.max(1000, Date.now() - now)
                        : undefined),
                    durationMs: finalDuration,
                    isStreaming: false,
                  }
                : msg
            )
          );
          setIsStreaming(false);
          abortControllerRef.current = null;

          if (learnId && targetSessionId) {
            await localDb.saveMessage({
              id: assistantMsgId,
              learnId,
              sessionId: targetSessionId,
              role: "assistant",
              content: resolvedContent,
              thinking: finalThinking,
              toolCalls: finalToolCalls && finalToolCalls.length > 0 ? finalToolCalls : undefined,
              durationMs: finalDuration,
              createdAt: Date.now(),
            });
          }
        },
        onError: async (err) => {
          const finalDuration = Date.now() - now;
          const rawErr = err?.message || String(err);
          const errorText = t("callConstFailed", { error: rawErr });
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: errorText,
                    durationMs: finalDuration,
                    isStreaming: false,
                  }
                : msg
            )
          );
          setIsStreaming(false);
          abortControllerRef.current = null;

          if (learnId && targetSessionId) {
            await localDb.saveMessage({
              id: assistantMsgId,
              learnId,
              sessionId: targetSessionId,
              role: "assistant",
              content: errorText,
              durationMs: finalDuration,
              createdAt: Date.now(),
            });
          }
        },
      });
    } catch (err: any) {
      console.error("streamChatCompletion error:", err);
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleDownloadArtifact = (art: LocalArtifact | null) => {
    if (!art) return;
    const content = art.content || "";
    if (art.fileUrl) {
      const a = document.createElement("a");
      a.href = art.fileUrl;
      a.download = art.title || "artifact.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (content) {
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${art.title || "artifact"}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenArtifact = (art: LocalArtifact) => {
    if (
      art.type === "quiz" ||
      art.type === "flashcard" ||
      art.type === "mind_map" ||
      art.type === "slides" ||
      art.type === "infographic" ||
      art.type === "report" ||
      art.type === "cheatsheet" ||
      art.type === "data_table" ||
      art.data?.imageUrl ||
      art.data?.questions ||
      art.data?.cards ||
      art.data?.root ||
      art.data?.slides ||
      art.data?.sections
    ) {
      handleOpenArtifactReader(art);
      return;
    }

    if (art.type === "note") {
      handleOpenArtifactReader(art);
      return;
    }

    // Other artifact types
    toast(art.title || "Artifact");
  };

  const handleDeleteArtifact = async (artId: string) => {
    await localDb.deleteArtifact(artId);
    if (selectedReaderArtifact?.id === artId) {
      setIsReaderOpen(false);
      setSelectedReaderArtifact(null);
    }
    toast.success(
      language === "id"
        ? "Catatan berhasil dihapus"
        : "Note deleted successfully"
    );
  };

  const handleConvertToSource = async (art: LocalArtifact | null) => {
    if (!learnId || !art) return;
    try {
      await localDb.createSource({
        learnId,
        title: art.title || (language === "id" ? "Catatan Baru" : "New Note"),
        content: art.content || "",
        type: "text",
        includedInChat: true,
      });
      toast.success(
        language === "id"
          ? "Catatan berhasil dikonversikan menjadi sumber!"
          : "Note converted to source successfully!"
      );
    } catch (err) {
      console.error("Failed to convert note to source:", err);
      toast.error(t("failedConvertNoteToSource"));
    }
  };

  const handleAddNote = async () => {
    if (!learnId) return;

    const defaultTitle = language === "id" ? "Catatan Baru" : "New Note";
    const artId = await localDb.createArtifact({
      learnId,
      title: defaultTitle,
      type: "note",
      status: "completed",
      content: "",
      sourcesCount: 0,
    });

    const created = await localDb.getArtifact(artId);
    if (created) {
      handleOpenArtifactReader(created);
    }
  };

  const handleGenerateNote = async (art: LocalArtifact | null) => {
    if (!learnId || !art) return;

    const allSources = await db.sources.where("learnId").equals(learnId).toArray();
    const activeSources = allSources.filter((s) => s.includedInChat !== false);
    const sourcesCount = activeSources.length;

    if (sourcesCount === 0) {
      toast.error(t("addSourcesFirstForNote"));
      return;
    }

    const defaultTitle = language === "id" ? "Catatan Baru" : "New Note";
    await localDb.updateArtifact(art.id, {
      status: "generating",
      sourcesCount,
    });

    try {
      const grounded = buildGroundedContext(activeSources);
      const activeModelId =
        localStorage.getItem("const_learn_active_model") || selectedModelId || "gemini-3.8-flash";

      const systemPrompt = `You are Const Learn AI Tutor — an expert educational researcher and synthesizer.
Your task is to generate a comprehensive, structured study note synthesizing the provided sources.
Format the note in clear, beautiful Markdown:
- An engaging, descriptive title (H1)
- Key Concepts / Ringkasan Intisari (bullet points)
- In-depth Explanation / Pembahasan Mendalam (H2, H3, code/tables if applicable)
- Key Takeaways & Study Questions / Poin Penting & Pertanyaan Refleksi
- Rujukan Sumber / Source References
Respond in ${language === "id" ? "Indonesian (Bahasa Indonesia)" : "English"}.`;

      const userPrompt = `Mohon buatkan catatan sintesis komprehensif berdasarkan materi sumber berikut:\n\n${grounded.formattedContext}\n\nBuat catatan yang rapi, padat wawasan, terstruktur, dan mudah dipahami. Gunakan tabel Markdown jika terdapat data perbandingan atau ringkasan matriks.`;

      let noteContent = "";
      await streamChatCompletion({
        model: activeModelId,
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        onToken: async (token) => {
          noteContent += token;
          await localDb.updateArtifact(art.id, {
            content: noteContent,
          });
        },
        onDone: async (finalContent) => {
          const contentToSave = finalContent || noteContent;
          let noteTitle = language === "id" ? "Catatan: Ringkasan Sumber" : "Study Note: Summary";
          const h1Match = contentToSave.match(/^#\s+(.+)$/m);
          if (h1Match && h1Match[1]) {
            noteTitle = h1Match[1].replace(/[*_~`]/g, "").trim();
          } else if (learn?.title) {
            noteTitle = `${language === "id" ? "Catatan: " : "Note: "}${learn.title}`;
          }

          await localDb.updateArtifact(art.id, {
            title: noteTitle,
            content: contentToSave,
            status: "completed",
          });

          toast.success(
            language === "id"
              ? `Catatan "${noteTitle}" selesai dibuat!`
              : `Note "${noteTitle}" created successfully!`
          );
        },
        onError: async (err) => {
          console.error("Failed to generate note:", err);
          await localDb.updateArtifact(art.id, {
            status: "completed",
            error: err.message,
          });
          toast.error(
            t("failedCreateMaterial", { error: err.message || t("errorOccurred") })
          );
        },
      });
    } catch (err: any) {
      console.error("Error initiating note generation:", err);
      await localDb.updateArtifact(art.id, {
        status: "completed",
        error: err.message,
      });
    }
  };

  const handleTriggerWebSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSourcesSheetOpen(false);
    setAddSourceInitialSearch({
      query: searchQuery.trim(),
      scope: webScope.toLowerCase() === "journal" ? "journal" : "web",
      speed: researchSpeed.includes("Deep") ? "deep" : "fast",
      autoSearch: true,
    });
    setIsAddSourceOpen(true);
    setSearchQuery("");
  };

  const handleSelectStudioTool = (toolId: string, _toolTitle?: string) => {
    if (toolId === "quiz") {
      setCreateArtifactType("quiz");
      setIsCreateArtifactSheetOpen(true);
      return;
    }
    if (toolId === "flashcards" || toolId === "flashcard") {
      setCreateArtifactType("flashcard");
      setIsCreateArtifactSheetOpen(true);
      return;
    }
    if (toolId === "mind_map") {
      setIsCreateMindMapSheetOpen(true);
      return;
    }
    if (toolId === "audio_summary" || toolId === "audio") {
      setIsCreateAudioSummaryOpen(true);
      return;
    }
    if (toolId === "slides" || toolId === "presentation") {
      setIsCreatePresentationOpen(true);
      return;
    }
    if (toolId === "infographic") {
      setIsCreateInfographicOpen(true);
      return;
    }
    if (toolId === "report") {
      setIsCreateReportSheetOpen(true);
      return;
    }
    if (toolId === "cheatsheet" || toolId === "data_table") {
      setIsCreateCheatSheetOpen(true);
      return;
    }
    // Other tools: strictly no-op as requested
    return;
  };

  const handleGenerateStudioArtifact = async (options: {
    type: "quiz" | "flashcard" | "mind_map" | "audio_summary";
    topic: string;
    difficulty?: "easy" | "medium" | "hard";
    count?: number;
    lengthMode?: "short" | "medium" | "long" | "auto";
    language?: "id" | "en" | string;
    selectedSourceIds: string[];
    themeId?: string;
    customPrompt?: string;
    voiceModel?: string;
    voiceId?: string;
  }) => {
    const selectedSources = (sources || []).filter((s) => options.selectedSourceIds.includes(s.id));
    const targetLang = (options.language?.startsWith("id") || language === "id") ? "id" : "en";

    const title = options.topic.trim()
      ? (options.type === "quiz"
          ? t("quizTopicTitle", { topic: options.topic })
          : options.type === "flashcard"
          ? t("flashcardTopicTitle", { topic: options.topic })
          : options.type === "audio_summary"
          ? t("audioSummaryTopicTitle", { topic: options.topic })
          : t("mindMapTopicTitle", { topic: options.topic }))
      : (options.type === "quiz"
          ? t("quizWithQuestions", { count: options.count || 5 })
          : options.type === "flashcard"
          ? t("flashcardWithCards", { count: options.count || 10 })
          : options.type === "audio_summary"
          ? t("audioSummaryTitle")
          : t("mindMapTitle"));

    const initialLoadingTitle =
      options.type === "quiz"
        ? t("creatingQuizStatus")
        : options.type === "flashcard"
        ? t("creatingFlashcardsStatus")
        : options.type === "audio_summary"
        ? t("creatingAudioSummaryStatus")
        : t("creatingMindMapStatus");

    // 1. Immediately create in Dexie with status: "generating"
    const artId = await localDb.createArtifact({
      learnId,
      title: initialLoadingTitle,
      type: options.type,
      status: "generating",
      sourcesCount: selectedSources.length,
      content: "",
    });

    // Open StudioSheet so user sees progress card immediately
    setIsStudioSheetOpen(true);

    try {
      const result = await generateStudioArtifact({
        learnId,
        type: options.type,
        topic: options.topic,
        sources: selectedSources,
        count: options.count,
        difficulty: options.difficulty,
        lengthMode: options.lengthMode,
        language: targetLang,
        themeId: options.themeId,
        customPrompt: options.customPrompt,
        voiceModel: options.voiceModel,
        voiceId: options.voiceId,
        audioLanguage: options.language,
      });

      await localDb.updateArtifact(artId, {
        title: result.title || title,
        data: result.data,
        content: JSON.stringify(result.data),
        status: "completed",
      });

      toast.success(
        options.type === "quiz"
          ? t("quizCreatedSuccess")
          : options.type === "flashcard"
          ? t("flashcardsCreatedSuccess")
          : options.type === "mind_map"
          ? t("mindMapCreatedSuccess")
          : options.type === "audio_summary"
          ? t("audioSummaryCreatedSuccess")
          : t("presentationCreatedSuccess")
      );

      const fullArt = await localDb.getArtifact(artId);
      if (fullArt) {
        setIsStudioSheetOpen(false);
        setSelectedReaderArtifact(fullArt);
        setIsReaderOpen(true);
      }
    } catch (err: any) {
      console.error("Failed to generate studio artifact on mobile:", err);
      await localDb.updateArtifact(artId, {
        title,
        status: "error",
        error: err?.message || "Generation failed",
      });
      toast.error(
        t("failedCreateMaterial", { error: err?.message || t("errorOccurred") })
      );
    }
  };

  const handleGeneratePresentation = async (options: {
    selectedSourceIds: string[];
    provider: "native" | "canva" | "slides";
    lengthMode: "short" | "medium" | "long" | "auto";
    slideCount?: number;
    themeId?: "bold_dark" | "swiss_blue" | "sea_indigo" | "ash_lime";
    customInstructions?: string;
  }) => {
    const selectedSources = (sources || []).filter((s) => options.selectedSourceIds.includes(s.id));
    const targetLang = language === "id" ? "id" : "en";
    const title = t("presentationTitle");

    const artId = await localDb.createArtifact({
      learnId,
      title: t("creatingPresentationStatus"),
      type: "slides",
      status: "generating",
      sourcesCount: selectedSources.length,
      content: "",
    });

    setIsStudioSheetOpen(true);

    try {
      const result = await generatePresentationArtifact({
        artifactId: artId,
        learnId,
        sources: selectedSources,
        provider: options.provider,
        lengthMode: options.lengthMode,
        slideCount: options.slideCount,
        language: targetLang,
        themeId: options.themeId || "bold_dark",
        customInstructions: options.customInstructions,
      });

      await localDb.updateArtifact(artId, {
        title: result.title || title,
        data: result.data,
        content: JSON.stringify(result.data),
        status: "completed",
      });

      toast.success(t("presentationCreatedSuccess"));

      const fullArt = await localDb.getArtifact(artId);
      if (fullArt) {
        setIsStudioSheetOpen(false);
        setSelectedReaderArtifact(fullArt);
        setIsReaderOpen(true);
      }
    } catch (err: any) {
      console.error("Failed to generate presentation on mobile:", err);
      await localDb.updateArtifact(artId, {
        title,
        status: "error",
        error: err?.message || "Generation failed",
      });
      toast.error(
        t("failedCreatePresentation", { error: err?.message || t("errorOccurred") })
      );
    }
  };

  const handleGenerateInfographic = async (params: {
    selectedSourceIds: string[];
    language: "id" | "en";
    orientation: "landscape" | "portrait" | "square";
    style: string;
    detailLevel: "brief" | "standard" | "detailed";
    customDescription?: string;
    providerId?: string;
    modelId?: string;
  }) => {
    if (!learnId) return;

    const selectedSources = (sources || []).filter((s) =>
      params.selectedSourceIds.includes(s.id)
    );
    if (selectedSources.length === 0) return;

    const title = t("studyInfographicTitle");

    // 1. Create generating artifact in Dexie
    const artId = await localDb.createArtifact({
      learnId,
      title: t("creatingInfographicStatus"),
      type: "infographic",
      status: "generating",
      sourcesCount: selectedSources.length,
      content: "",
    });

    // Open StudioSheet so user sees progress card immediately
    setIsStudioSheetOpen(true);

    try {
      const result = await generateInfographicArtifact({
        artifactId: artId,
        learnId,
        sources: selectedSources,
        language: params.language,
        orientation: params.orientation,
        style: params.style,
        detailLevel: params.detailLevel,
        customDescription: params.customDescription,
        providerId: params.providerId,
        modelId: params.modelId,
      });

      await localDb.updateArtifact(artId, {
        title: result.title || title,
        data: result.data,
        content: JSON.stringify(result.data),
        status: "completed",
      });

      toast.success(t("infographicCreatedSuccess"));

      const fullArt = await localDb.getArtifact(artId);
      if (fullArt) {
        setIsStudioSheetOpen(false);
        setSelectedReaderArtifact(fullArt);
        setIsReaderOpen(true);
      }
    } catch (err: any) {
      console.error("Failed to generate infographic on mobile:", err);
      await localDb.updateArtifact(artId, {
        title,
        status: "error",
        error: err?.message || "Generation failed",
      });
      toast.error(
        t("failedCreateInfographic", { error: err?.message || t("errorOccurred") })
      );
    }
  };

  const handleGenerateReport = async (options: {
    selectedSourceIds: string[];
    format: "interactive" | "document";
    templateId: string;
    templateTitle: string;
    templateDescription?: string;
    depth: "short" | "medium" | "long" | "auto";
    language: "id" | "en";
    customInstructions?: string;
  }) => {
    if (!learnId) return;

    const selectedSources = (sources || []).filter((s) =>
      options.selectedSourceIds.includes(s.id)
    );
    if (selectedSources.length === 0) return;

    const title = options.templateTitle || t("learningReportTitle");

    const artId = await localDb.createArtifact({
      learnId,
      title: t("generatingReportStatus"),
      type: "report",
      status: "generating",
      sourcesCount: selectedSources.length,
      content: "",
    });

    setIsStudioSheetOpen(true);

    try {
      const result = await generateReportArtifact({
        artifactId: artId,
        learnId,
        sources: selectedSources,
        format: options.format,
        templateId: options.templateId,
        templateTitle: options.templateTitle,
        templateDescription: options.templateDescription,
        depth: options.depth,
        language: options.language,
        customInstructions: options.customInstructions,
      });

      await localDb.updateArtifact(artId, {
        title: result.title || title,
        data: result.data,
        content: JSON.stringify(result.data),
        status: "completed",
      });

      toast.success(t("reportCreatedSuccess"));

      const fullArt = await localDb.getArtifact(artId);
      if (fullArt) {
        setIsStudioSheetOpen(false);
        setSelectedReaderArtifact(fullArt);
        setIsReaderOpen(true);
      }
    } catch (err: any) {
      console.error("Failed to generate report on mobile:", err);
      await localDb.updateArtifact(artId, {
        title,
        status: "error",
        error: err?.message || "Generation failed",
      });
      toast.error(
        t("failedCreateReport", { error: err?.message || t("errorOccurred") })
      );
    }
  };

  const handleGenerateCheatSheet = async (options: {
    selectedSourceIds: string[];
    coverageMode: "short" | "auto" | "long";
    topicFocus?: string;
  }) => {
    if (!learnId) return;

    const selectedSources = (sources || []).filter((s) => options.selectedSourceIds.includes(s.id));
    if (selectedSources.length === 0) return;

    const targetLang = language === "id" ? "id" : "en";
    const title = options.topicFocus?.trim()
      ? `CheatSheet: ${options.topicFocus.trim()}`
      : t("smartCheatSheetTitle");

    const artId = await localDb.createArtifact({
      learnId,
      title: t("creatingCheatSheetStatus"),
      type: "cheatsheet",
      status: "generating",
      sourcesCount: selectedSources.length,
      content: "",
    });

    setIsStudioSheetOpen(true);

    try {
      const result = await generateCheatSheetArtifact({
        artifactId: artId,
        learnId,
        sources: selectedSources,
        coverageMode: options.coverageMode,
        topicFocus: options.topicFocus,
        language: targetLang,
      });

      await localDb.updateArtifact(artId, {
        title: result.title || title,
        data: result.data,
        content: JSON.stringify(result.data),
        status: "completed",
      });

      toast.success(t("cheatSheetCreatedSuccess"));

      const fullArt = await localDb.getArtifact(artId);
      if (fullArt) {
        setIsStudioSheetOpen(false);
        setSelectedReaderArtifact(fullArt);
        setIsReaderOpen(true);
      }
    } catch (err: any) {
      console.error("Failed to generate cheatsheet on mobile:", err);
      await localDb.updateArtifact(artId, {
        title,
        status: "error",
        error: err?.message || "Generation failed",
      });
      toast.error(
        t("failedCreateCheatSheet", { error: err?.message || t("errorOccurred") })
      );
      const fullArt = await localDb.getArtifact(artId);
      if (fullArt) {
        setIsStudioSheetOpen(false);
        setSelectedReaderArtifact(fullArt);
        setIsReaderOpen(true);
      }
    }
  };

  const handleOpenArtifactReader = (art: LocalArtifact) => {
    setIsStudioSheetOpen(false);
    setSelectedReaderArtifact(art);
    setIsReaderOpen(true);
  };

  const handleExplainInChat = (prompt: string) => {
    setIsReaderOpen(false);
    setActiveTab("chat");
    handleSend(prompt);
  };

  return (
    <div
      className="w-full flex flex-col bg-background text-foreground overflow-hidden select-none fixed inset-0"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : "100dvh",
        maxHeight: viewportHeight ? `${viewportHeight}px` : "100dvh",
      }}
    >
      {/* Top Mobile Header with Garis 2, Model Selector, Context Window, New Chat, and Titik 3 */}
      <header className="h-14 px-3 sm:px-4 bg-card/90 border-b border-border flex items-center justify-between shrink-0 z-20 select-none">
        {/* Left Section: Garis 2 (Sidebar Toggle) & Model Selector */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          {/* Tombol Garis Dua */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="h-9 w-9 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-border shrink-0 active:scale-95"
            title="Buka Menu"
            aria-label="Buka Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="8" x2="20" y2="8" />
              <line x1="4" y1="16" x2="20" y2="16" />
            </svg>
          </button>

          {/* Model Selector Trigger */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                const next = !isModelDropdownOpen;
                if (next) {
                  setSearchModelQuery("");
                  setIsContextDropdownOpen(false);
                }
                setIsModelDropdownOpen(next);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-colors duration-150 cursor-pointer max-w-[135px] sm:max-w-[200px]"
              title={currentModel.name}
            >
              <span className="font-sans text-[12px] truncate">{currentModel.name}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            </button>

            {isModelDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => {
                    setIsModelDropdownOpen(false);
                    setSearchModelQuery("");
                  }}
                />
                <div className="absolute left-0 mt-1.5 w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-popover border border-border text-popover-foreground shadow-2xl p-2 z-50 animate-in fade-in duration-100 flex flex-col gap-1 font-sans">
                  {/* Search Input (Matching Desktop) */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded-xl bg-secondary/60 border border-border/70">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={searchModelQuery}
                      onChange={(e) => setSearchModelQuery(e.target.value)}
                      placeholder={t("searchModels")}
                      className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none font-sans"
                      autoFocus
                    />
                    {searchModelQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchModelQuery("")}
                        className="p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Scrollable Model List */}
                  <ScrollArea className="max-h-[260px] w-full" viewportClassName="pr-1">
                    <div className="space-y-1 py-0.5">
                      {filteredModels.length > 0 ? (
                        filteredModels.map((m) => {
                          const isSelected = selectedModelId === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedModelId(m.id);
                                setIsModelDropdownOpen(false);
                                setSearchModelQuery("");
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-xl text-xs flex flex-col cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-secondary text-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                              )}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-sans text-[13px] font-medium text-foreground">{m.name}</span>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-foreground shrink-0 ml-auto" />
                                )}
                              </div>
                              {m.description && (
                                <span className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                                  {m.description}
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="py-6 px-3 text-center text-xs text-muted-foreground">
                          {t("noModelsFound")}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Section: Context Window + New Chat + Titik 3 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Context Window Indicator - Only visible after user sends their first message */}
          {hasStartedChat && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !isContextDropdownOpen;
                  if (next) setIsModelDropdownOpen(false);
                  setIsContextDropdownOpen(next);
                }}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 border border-border transition-colors cursor-pointer shrink-0 active:scale-95",
                  contextUsage.rawPercentUsed >= 90
                    ? "text-red-500"
                    : contextUsage.rawPercentUsed >= 75
                    ? "text-amber-500"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={`Context: ${contextUsage.rawPercentUsed === 0 ? "0%" : contextUsage.percentUsed}`}
                aria-label="Context & session info"
              >
                <svg className="w-3.5 h-3.5 transform -rotate-90" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.2}
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
                    strokeDashoffset={56.55 - (56.55 * contextUsage.safePercent) / 100}
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {/* Context Dropdown Info */}
              {isContextDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsContextDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-popover border border-border text-popover-foreground shadow-2xl p-3.5 z-50 animate-in fade-in duration-100 flex flex-col gap-2.5 font-sans select-none">
                    {/* Header: X% of context used and ~usedTokens / totalTokens */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-baseline gap-1 text-xs">
                        <span className="font-bold text-foreground">
                          {contextUsage.rawPercentUsed === 0 ? "0%" : contextUsage.rawPercentUsed < 1 ? "<1%" : contextUsage.percentUsed}
                        </span>
                        <span className="text-muted-foreground font-normal">
                          {t("contextUsed") || "of context used"}
                        </span>
                      </div>
                      <span className="font-sans tabular-nums text-xs font-semibold text-foreground/90">
                        ~{formatTokenDisplay(contextUsage.usedTokens)} / {formatTokenDisplay(contextUsage.totalTokens)}
                      </span>
                    </div>

                    {/* Multi-segment Horizontal Progress Bar */}
                    <div className="w-full h-1.5 bg-muted dark:bg-zinc-800 rounded-full overflow-hidden flex gap-0.5">
                      {contextUsage.systemPromptTokens > 0 && (
                        <div
                          className="bg-zinc-400 dark:bg-zinc-400 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(0.8, (contextUsage.systemPromptTokens / contextUsage.totalTokens) * 100)}%`,
                          }}
                          title={`${t("systemPrompt") || "System prompt"}: ~${formatTokenDisplay(contextUsage.systemPromptTokens)}`}
                        />
                      )}
                      {contextUsage.toolDefinitionsTokens > 0 && (
                        <div
                          className="bg-purple-500 dark:bg-purple-400 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(0.8, (contextUsage.toolDefinitionsTokens / contextUsage.totalTokens) * 100)}%`,
                          }}
                          title={`${t("toolDefinitions") || "Tool definitions"}: ~${formatTokenDisplay(contextUsage.toolDefinitionsTokens)}`}
                        />
                      )}
                      {contextUsage.sourcesTokens > 0 && (
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(0.8, (contextUsage.sourcesTokens / contextUsage.totalTokens) * 100)}%`,
                          }}
                          title={`${t("learningSources") || "Learning sources"}: ~${formatTokenDisplay(contextUsage.sourcesTokens)}`}
                        />
                      )}
                      {contextUsage.messagesTokens > 0 && (
                        <div
                          className="bg-blue-500 dark:bg-blue-400 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(0.8, (contextUsage.messagesTokens / contextUsage.totalTokens) * 100)}%`,
                          }}
                          title={`${t("messages") || "Messages"}: ~${formatTokenDisplay(contextUsage.messagesTokens)}`}
                        />
                      )}
                      {contextUsage.draftInputTokens > 0 && (
                        <div
                          className="bg-pink-500 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(0.8, (contextUsage.draftInputTokens / contextUsage.totalTokens) * 100)}%`,
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
                        <span className="font-sans tabular-nums text-xs font-medium text-foreground/80 shrink-0 ml-2">
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
                          <span className="font-sans tabular-nums text-xs font-medium text-foreground/80 shrink-0 ml-2">
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
                          <span className="font-sans tabular-nums text-xs font-medium text-foreground/80 shrink-0 ml-2">
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
                        <span className="font-sans tabular-nums text-xs font-medium text-foreground/80 shrink-0 ml-2">
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
                          <span className="font-sans tabular-nums text-xs font-medium text-foreground/80 shrink-0 ml-2">
                            ~{formatTokenDisplay(contextUsage.draftInputTokens)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleNewChat}
            className="h-8 w-8 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border shrink-0 active:scale-95"
            title={t("newChat") || "Chat Baru"}
            aria-label={t("newChat") || "Chat Baru"}
          >
            <MessageCirclePlus className="h-4 w-4" />
          </button>

          {/* Titik 3 (More options) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-8 w-8 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border shrink-0 active:scale-95"
                title={t("moreOptions") || "Opsi lainnya"}
                aria-label={t("moreOptions") || "Opsi lainnya"}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-52 rounded-xl bg-popover border border-border p-1 text-popover-foreground shadow-2xl z-50 font-sans"
            >
              <DropdownMenuItem
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-foreground hover:bg-secondary cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t("editChatName") || "Ubah Nama"}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setIsSourcesSheetOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-foreground hover:bg-secondary cursor-pointer"
              >
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t("sources") || "Sumber Belajar"}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setIsStudioSheetOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-foreground hover:bg-secondary cursor-pointer"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t("studioTitle") || "Studio Tools"}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-border my-1" />

              <DropdownMenuItem
                onClick={handleNewChat}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-foreground hover:bg-secondary cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t("newChat") || "Chat Baru"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Chat Workspace (Full Viewport Height - No Bottom Nav) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden max-w-lg mx-auto w-full relative">

          {/* Scrollable Conversation Stream */}
          <div
            ref={chatScrollContainerRef}
            className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-5 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden overscroll-contain"
          >
            {!isMessagesLoaded ? (
              <div className="flex-1 w-full min-h-[200px]" />
            ) : messages.length === 0 ? (
              carriedSources.length > 0 ? (
                /* Mobile NotebookLM Source Guide View */
                <div className="flex flex-col justify-start py-3 animate-in fade-in duration-200 select-none">
                  {/* Title */}
                  <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-1 leading-snug">
                    {learn?.title || carriedSources[0]?.title || "Panduan Sumber Belajar"}
                  </h1>

                  {/* Meta */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans mb-3.5">
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
                  <div className="text-[13px] leading-relaxed text-foreground/90 font-sans mb-3.5">
                    <MarkdownContent
                      content={
                        learn?.description?.trim() ||
                        `Sumber ini menyajikan materi komprehensif mengenai **${carriedSources[0]?.title}**${
                          carriedSources.length > 1
                            ? ` beserta ${carriedSources.length - 1} dokumen pendukung lainnya`
                            : ""
                        }. Materi ini menguraikan parameter kunci, metodologi, dan prinsip dasar yang dapat dijadikan rujukan utama dalam sesi belajar ini. Secara keseluruhan, teks tersebut berfungsi sebagai **panduan teknis** bagi Anda untuk memahami konsep secara mendalam dan terverifikasi.`
                      }
                      sourcesMap={sourcesMap}
                      onSourceClick={handleCitationClick}
                      onOpenBrowser={handleOpenBrowser}
                    />
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        toast.info(
                          "Fitur 'Simpan ke Catatan' (Notes as Sources) akan hadir pada pembaruan berikutnya."
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-all cursor-pointer active:scale-95"
                    >
                      <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Simpan ke catatan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const textToCopy =
                          learn?.description?.trim() ||
                          `Ringkasan Sumber: ${carriedSources[0]?.title}`;
                        navigator.clipboard.writeText(textToCopy);
                        toast.success("Ringkasan sumber disalin!");
                      }}
                      className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Salin ringkasan"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.success("Terima kasih atas masukannya!")}
                      className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Bagus"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info("Masukan dicatat.")}
                      className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Kurang relevan"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Suggested Question Chips */}
                  <div className="flex flex-col gap-2 font-sans">
                    {[
                      `Jelaskan konsep dan poin utama dari "${carriedSources[0]?.title}" secara ringkas.`,
                      `Bandingkan model atau argumen penting yang dijelaskan dalam sumber ini.`,
                      `Apa saja kesimpulan kunci atau penerapan praktis menurut dokumen ini?`,
                    ].map((question, qIdx) => (
                      <button
                        key={qIdx}
                        type="button"
                        onClick={() => handleSend(question)}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl bg-secondary/60 hover:bg-secondary border border-border text-xs text-foreground transition-all cursor-pointer active:scale-[0.99] leading-relaxed"
                      >
                        <span>{question}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-10 px-4 text-muted-foreground select-none">
                  <div className="h-12 w-12 rounded-2xl bg-secondary/80 border border-border/70 flex items-center justify-center text-xl mx-auto mb-3 shadow-2xs">
                    👋
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-foreground mb-1 tracking-tight font-sans">
                    {t("welcomeNotebookTitle")}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto mb-4 font-sans">
                    {t("welcomeNotebookDesc")}
                  </p>
                  
                  <div className="flex flex-col items-center gap-2.5 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => setIsAddSourceOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium text-xs cursor-pointer active:scale-95 shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>{t("addSource")}</span>
                    </button>

                    <div className="flex flex-col w-full gap-1.5 font-sans pt-1">
                      {[
                        t("chipLearnNewTopic"),
                        t("chipCreateContent"),
                        t("chipContinueProject"),
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => handleSend(chip)}
                          className="w-full text-center px-3.5 py-2 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/70 text-xs font-medium text-foreground transition-all cursor-pointer active:scale-[0.98]"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            ) : (
              messages.map((msg) => (
              <div
                key={msg.id}
                ref={msg.id === lastUserMsgId ? lastUserMessageRef : undefined}
                className={cn(
                  "flex flex-col w-full",
                  msg.role === "user" ? "items-end" : "items-start",
                  msg.id === lastUserMsgId && "scroll-mt-4"
                )}
              >
                {msg.role === "user" ? (
                  editingMessageId === msg.id ? (
                    <div className="w-full flex flex-col items-end group">
                      <div className="w-full max-w-[92%] rounded-2xl bg-secondary/95 text-foreground p-3 border border-border shadow-md flex flex-col gap-2.5 font-sans transition-all">
                        {/* Attachments Shelf inside edit mode */}
                        {editingAttachments.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pb-1.5 border-b border-border/40">
                            {editingAttachments.map((att) => {
                              const isImage = att.type === "image";
                              return (
                                <div
                                  key={att.id}
                                  className="relative rounded-lg border border-border/60 bg-background/80 px-2 py-1 flex items-center gap-1.5 text-xs select-none shadow-2xs"
                                >
                                  {isImage && (att.url || att.base64) ? (
                                    <img
                                      src={att.url || att.base64}
                                      alt={att.name}
                                      className="w-5 h-5 rounded object-cover"
                                    />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                  )}
                                  <span className="max-w-[100px] truncate text-[11px] font-medium text-foreground">
                                    {att.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeEditAttachment(att.id)}
                                    className="p-0.5 rounded-full hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                    title={language === "id" ? "Hapus lampiran" : "Remove attachment"}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Textarea */}
                        <textarea
                          ref={editTextareaRef}
                          value={editingText}
                          onChange={(e) => {
                            setEditingText(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (editingText.trim() || editingAttachments.length > 0) {
                                handleConfirmEditTurn(msg);
                              }
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              handleCancelEdit();
                            }
                          }}
                          rows={Math.max(2, Math.min(6, editingText.split("\n").length))}
                          className="w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 outline-none font-sans block"
                          placeholder={language === "id" ? "Edit pesan Anda..." : "Edit your message..."}
                        />

                        {/* Action Bar matching screenshot */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/30">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => editFileInputRef.current?.click()}
                              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title={language === "id" ? "Tambah lampiran berkas" : "Add file attachment"}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title={language === "id" ? "Batal" : "Cancel"}
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => editImageInputRef.current?.click()}
                              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title={language === "id" ? "Lampirkan foto / tangkapan layar" : "Attach image / screenshot"}
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmEditTurn(msg)}
                              disabled={!editingText.trim() && editingAttachments.length === 0}
                              className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-not-allowed shadow-xs"
                              title={language === "id" ? "Kirim revisi" : "Send update"}
                            >
                              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-end group">
                      {/* Attached Media / Files Preview (Compact) */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5 justify-end max-w-[88%]">
                          {msg.attachments.map((att: any, attIdx: number) => {
                            const isImage = att.type === "image";
                            const isVideo = att.type === "video";
                            const isMedia = isImage || isVideo;
                            const imgIdx = sessionImageMap.get(att.id) ?? att.imageIndex;
                            const ext = (att.name.split(".").pop() || "FILE").toUpperCase();

                            return (
                              <div
                                key={att.id || attIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
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
                                  "relative shrink-0 rounded-xl border border-border bg-secondary/50 overflow-hidden shadow-xs select-none",
                                  isMedia
                                    ? "w-16 h-16 sm:w-20 sm:h-20 cursor-pointer active:scale-95 transition-transform"
                                    : "w-28 sm:w-32 h-16 sm:h-20"
                                )}
                              >
                                {isImage && (att.url || att.base64) ? (
                                  <div className="w-full h-full rounded-xl overflow-hidden relative">
                                    <img
                                      src={att.url || att.base64}
                                      alt={att.name}
                                      className="w-full h-full object-cover block"
                                    />
                                  </div>
                                ) : isVideo && att.url ? (
                                  <div className="w-full h-full rounded-xl overflow-hidden bg-black relative flex items-center justify-center">
                                    <Video className="w-5 h-5 text-muted-foreground" />
                                    <span className="absolute bottom-1 right-1 text-[7px] font-sans bg-black/70 text-white px-1 rounded uppercase font-bold">
                                      VID
                                    </span>
                                  </div>
                                ) : (
                                  <div className="w-full h-full p-1.5 flex flex-col justify-between rounded-xl bg-secondary/80 text-left">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[8px] font-bold text-muted-foreground font-sans uppercase">
                                        {ext}
                                      </span>
                                      <FileText className="w-3 h-3 text-foreground shrink-0" />
                                    </div>
                                    <div className="w-full flex-1 my-0.5 min-h-0 overflow-hidden">
                                      <ScrollArea className="w-full h-full max-h-[30px] sm:max-h-[34px]">
                                        <span className="text-[9px] font-medium text-foreground leading-tight break-words block pr-1">
                                          {att.name}
                                        </span>
                                      </ScrollArea>
                                    </div>
                                    <span className="text-[7.5px] text-muted-foreground font-sans tabular-nums block truncate">
                                      {formatFileSize(att.size)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* User Message Bubble with ScrollArea when long */}
                      {(() => {
                        const cleanedContent = cleanUserMessageContent(msg.content);
                        if (!cleanedContent) return null;

                        const isLongPrompt =
                          cleanedContent.length > 250 || cleanedContent.split("\n").length > 4;
                        const isExpanded = expandedUserMessageId === msg.id;

                        return (
                          <div
                            onClick={() => {
                              if (isLongPrompt) {
                                setExpandedUserMessageId(isExpanded ? null : msg.id);
                              }
                            }}
                            className={cn(
                              "max-w-[88%] rounded-2xl bg-secondary text-secondary-foreground border border-border px-3.5 py-2.5 text-[13.5px] select-text leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] shadow-xs font-sans transition-colors duration-150",
                              isLongPrompt && !isExpanded && "cursor-pointer hover:border-foreground/30"
                            )}
                          >
                            {isLongPrompt ? (
                              <ScrollArea
                                className={cn(
                                  "w-full transition-[max-height] duration-200 ease-in-out",
                                  isExpanded ? "max-h-[360px]" : "max-h-24"
                                )}
                                viewportClassName="[&>div[style]]:!block"
                              >
                                <div className="pr-1.5">{cleanedContent}</div>
                              </ScrollArea>
                            ) : (
                              <div>{cleanedContent}</div>
                            )}
                          </div>
                        );
                      })()}

                      {/* User Message Action Bar: Timestamp, Copy, Edit - Always visible */}
                      <div className="flex items-center gap-2 pt-1 pr-1 text-[10.5px] font-sans tabular-nums text-muted-foreground select-none">
                        {msg.createdAt && <span>{formatTimestamp(msg.createdAt)}</span>}
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, cleanUserMessageContent(msg.content) || msg.content)}
                          className="p-1 rounded hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95"
                          title={t("copyMessage")}
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditMessage(msg)}
                          className="p-1 rounded hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95"
                          title={t("editMessage")}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="w-full flex flex-col gap-2 group select-text">
                    {/* Working & Tool Execution Process */}
                    <WorkingProcess
                      thinking={msg.thinking}
                      toolCalls={msg.toolCalls}
                      isExecuting={Boolean(
                        msg.isStreaming &&
                          (!msg.content ||
                            (msg.toolCalls && msg.toolCalls.some((tc: any) => !tc.result)))
                      )}
                      durationMs={
                        msg.thinkingDurationMs ||
                        (msg.isStreaming && !msg.content ? liveDurationMs : undefined)
                      }
                      onOpenBrowser={handleOpenBrowser}
                    />

                    {/* Assistant Output Message (Pure clean MarkdownContent, matching apps/harness/desktop!) */}
                    {msg.content ? (
                      <div className="px-0.5 text-[14px] text-foreground leading-relaxed select-text font-sans">
                        <MarkdownContent
                          content={msg.content}
                          sourcesMap={sourcesMap}
                          onSourceClick={handleCitationClick}
                          onOpenBrowser={handleOpenBrowser}
                        />
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-foreground animate-pulse align-middle" />
                        )}
                      </div>
                    ) : null}

                    {/* Assistant Action Bar: Timestamp & Copy - Always visible */}
                    {!msg.isStreaming && msg.content && (
                      <div className="flex items-center gap-2 pt-0.5 pl-0.5 text-[10.5px] font-sans tabular-nums text-muted-foreground select-none">
                        {msg.createdAt && <span>{formatTimestamp(msg.createdAt)}</span>}
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 rounded hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95"
                          title={t("copyMessage")}
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

          {/* Sticky Bottom Chat Input Bar - Pinned right above keyboard or safe-area */}
          <div
            className={cn(
              "px-3 pt-1.5 shrink-0 bg-background/95 backdrop-blur-xs z-10 w-full transition-[padding,opacity] duration-150",
              editingMessageId !== null && "opacity-50 pointer-events-none",
              isKeyboardOpen
                ? "pb-1.5"
                : "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            )}
          >
            <ChatInputCard
              inputMessage={inputMessage}
              onChangeInput={setInputMessage}
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              selectedModelName={currentModel.name}
              sourcesCount={learn?.sourcesCount || 0}
              onOpenSources={() => setIsSourcesSheetOpen(true)}
              attachments={attachedFiles}
              onAttachmentsChange={setAttachedFiles}
              onPreviewMedia={setLightboxItem}
            />

            {/* Active Conversation Footer Telemetry Bar */}
            {conversationMetrics && (
              <div className="w-full flex items-center justify-center gap-1.5 pt-1.5 pb-0.5 select-none flex-wrap">
                {/* Pill 1: Session statistics (Gauge) */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground transition-colors select-none cursor-pointer"
                    >
                      <Gauge className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {conversationMetrics.turns} turns {conversationMetrics.steps} steps · {conversationMetrics.tokPerSec} tok/s
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="center"
                    sideOffset={8}
                    className="w-[88vw] max-w-80 p-3.5 rounded-xl bg-popover/95 backdrop-blur-md border border-border/80 shadow-2xl z-50 font-sans"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-[13px] text-foreground">Session statistics</span>
                    </div>
                    <div className="space-y-2 text-[12.5px] font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">LLM time</span>
                        <span className="tabular-nums text-foreground">{formatDurationDisplay(conversationMetrics.llmDurationMs)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tool time</span>
                        <span className="tabular-nums text-foreground">{formatDurationDisplay(conversationMetrics.toolDurationMs)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Avg time to first token (TTFT)</span>
                        <span className="tabular-nums text-foreground">{conversationMetrics.ttftSeconds.toFixed(1)}s</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tokens per second (TPS)</span>
                        <span className="tabular-nums text-foreground">{conversationMetrics.tokPerSec} tok/s</span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Pill 2: Token usage (Database) */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground transition-colors select-none cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {formatTokenDisplay(conversationMetrics.totalTokens)} tok · Cache hit {conversationMetrics.cacheHitRate}%
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="center"
                    sideOffset={8}
                    className="w-[88vw] max-w-80 p-3.5 rounded-xl bg-popover/95 backdrop-blur-md border border-border/80 shadow-2xl z-50 font-sans"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-[13px] text-foreground">Token usage</span>
                      </div>
                      <span className="tabular-nums font-medium text-foreground text-[13px]">
                        {conversationMetrics.totalTokens.toLocaleString()} tok
                      </span>
                    </div>
                    <div className="my-2 border-t border-border/60" />
                    <div className="space-y-2 text-[12.5px] font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cache hit</span>
                        <span className="tabular-nums text-foreground">{conversationMetrics.cacheHitRate}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Uncached input</span>
                        <span className="tabular-nums text-foreground">{conversationMetrics.uncachedInputTokens.toLocaleString()} tok</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cached input</span>
                        <span className="tabular-nums text-foreground">{conversationMetrics.cachedInputTokens.toLocaleString()} tok</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Output</span>
                        <span className="tabular-nums text-foreground">{conversationMetrics.outputTokens.toLocaleString()} tok</span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <input
              ref={editFileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleEditFileSelect}
              accept="image/*,video/*,audio/*,.pdf,.md,.txt,.py,.json,.csv,.doc,.docx"
            />
            <input
              ref={editImageInputRef}
              type="file"
              className="hidden"
              onChange={handleEditImageSelect}
              accept="image/*"
            />
          </div>
        </div>

      {/* Rename Notebook Dialog */}
      <Dialog open={isEditingTitle} onOpenChange={setIsEditingTitle}>
        <DialogContent className="w-[90vw] max-w-[360px] p-5 rounded-2xl bg-card border border-border text-foreground [&>button]:hidden font-sans">
          <DialogTitle className="text-sm font-semibold">{t("renameChatDialogTitle") || "Ubah Nama Percakapan"}</DialogTitle>
          <div className="mt-3 space-y-3">
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              autoFocus
              className="w-full px-3 py-2 text-xs bg-secondary/60 border border-border rounded-xl text-foreground outline-none focus:border-foreground/40"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveTitle}
                className="px-3.5 py-1.5 text-xs bg-foreground hover:bg-foreground/90 text-background font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smooth Animated Workspace Sidebar */}
      <WorkspaceSidebar
        open={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onBack={onBack}
        onNewChat={handleNewChat}
        notebookTitle={titleValue}
        notebookEmoji={learn?.emoji || "📘"}
        onRenameNotebook={() => setIsEditingTitle(true)}
        sourcesCount={learn?.sourcesCount || 0}
        onOpenSources={() => setIsSourcesSheetOpen(true)}
        toolsCount={STUDIO_TOOLS.length}
        artifactsCount={artifacts?.length || 0}
        onOpenStudio={() => setIsStudioSheetOpen(true)}
        sessions={sessions || []}
        activeChatId={activeSessionId}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onTogglePinChat={handleTogglePinChat}
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
        onOpenSettings={onOpenSettings}
      />

      {/* Sources Slide-over Sheet */}
      <SourcesSheet
        open={isSourcesSheetOpen}
        onClose={() => setIsSourcesSheetOpen(false)}
        learnId={learnId}
        onBack={() => {
          setIsSourcesSheetOpen(false);
          setIsSidebarOpen(true);
        }}
        sourcesCount={learn?.sourcesCount || 0}
        onOpenAddSource={() => setIsAddSourceOpen(true)}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        webScope={webScope}
        onToggleWebScope={() => setWebScope(webScope === "Web" ? "Journal" : "Web")}
        researchSpeed={researchSpeed}
        onToggleResearchSpeed={() =>
          setResearchSpeed(
            researchSpeed === "Fast Research" ? "Deep Research" : "Fast Research"
          )
        }
        onSearchWeb={handleTriggerWebSearch}
      />

      {/* Studio & Tools Slide-over Sheet */}
      <StudioSheet
        open={isStudioSheetOpen}
        onClose={() => setIsStudioSheetOpen(false)}
        onBack={() => {
          setIsStudioSheetOpen(false);
          setIsSidebarOpen(true);
        }}
        tools={STUDIO_TOOLS}
        toolNameMap={toolNameMap}
        artifacts={artifacts || []}
        generatingArtifacts={generatingArtifacts}
        onSelectTool={handleSelectStudioTool}
        onSelectArtifact={handleOpenArtifactReader}
        onDeleteArtifact={handleDeleteArtifact}
        onDownloadArtifact={handleDownloadArtifact}
        onOpenArtifact={handleOpenArtifact}
        onAddNote={handleAddNote}
      />

      {/* Create Studio Artifact (Quiz / Flashcard) Bottom Sheet */}
      <CreateArtifactSheet
        open={isCreateArtifactSheetOpen}
        onClose={() => setIsCreateArtifactSheetOpen(false)}
        initialType={createArtifactType}
        sources={sources || []}
        onGenerate={handleGenerateStudioArtifact}
      />

      {/* Create Mind Map Bottom Sheet */}
      <CreateMindMapSheet
        open={isCreateMindMapSheetOpen}
        onClose={() => setIsCreateMindMapSheetOpen(false)}
        sources={sources || []}
        onGenerate={handleGenerateStudioArtifact}
      />

      {/* Create Audio Summary Bottom Sheet */}
      <CreateAudioSummarySheet
        open={isCreateAudioSummaryOpen}
        onClose={() => setIsCreateAudioSummaryOpen(false)}
        sources={sources || []}
        onGenerate={handleGenerateStudioArtifact}
        onOpenModelsSettings={() => {
          setModelSelectionCategory("voice");
          setIsModelSelectionSheetOpen(true);
        }}
      />

      {/* Model Selection Sheet for Voice, Image & LLM */}
      <ModelSelectionSheet
        open={isModelSelectionSheetOpen}
        onClose={() => setIsModelSelectionSheetOpen(false)}
        initialCategory={modelSelectionCategory}
      />

      {/* Create Presentation Bottom Sheet */}
      <CreatePresentationSheet
        open={isCreatePresentationOpen}
        onClose={() => setIsCreatePresentationOpen(false)}
        sources={sources || []}
        onGenerate={handleGeneratePresentation}
      />

      {/* Create Infographic Bottom Sheet */}
      <CreateInfographicSheet
        open={isCreateInfographicOpen}
        onClose={() => setIsCreateInfographicOpen(false)}
        sources={sources || []}
        onGenerate={handleGenerateInfographic}
        onOpenModelsSettings={() => {
          setModelSelectionCategory("image");
          setIsModelSelectionSheetOpen(true);
        }}
      />

      {/* Create Report Bottom Sheet */}
      <CreateReportSheet
        open={isCreateReportSheetOpen}
        onClose={() => setIsCreateReportSheetOpen(false)}
        sources={sources || []}
        onGenerate={handleGenerateReport}
      />

      {/* Create CheatSheet Bottom Sheet */}
      <CreateCheatSheetSheet
        open={isCreateCheatSheetOpen}
        onClose={() => setIsCreateCheatSheetOpen(false)}
        sources={sources || []}
        onGenerate={handleGenerateCheatSheet}
      />

      {/* Interactive Full-Screen Reader Overlay */}
      <MobileArtifactReader
        open={isReaderOpen}
        onClose={() => setIsReaderOpen(false)}
        artifact={
          (artifacts || []).find((a) => a.id === selectedReaderArtifact?.id) ||
          selectedReaderArtifact
        }
        onExplainInChat={handleExplainInChat}
        onSelectStudioTool={handleSelectStudioTool}
        onDeleteArtifact={handleDeleteArtifact}
        onConvertToSource={handleConvertToSource}
        onGenerateNote={handleGenerateNote}
      />

      {/* Add Source Pop-up Modal */}
      <AddSourceDialog
        open={isAddSourceOpen}
        onOpenChange={(open) => {
          setIsAddSourceOpen(open);
          if (!open) setAddSourceInitialSearch(undefined);
        }}
        learnId={learnId}
        initialSearch={addSourceInitialSearch}
        onSelectSource={(sourceType) => {
          setIsAddSourceOpen(false);
        }}
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
      />
    </div>
  );
}
