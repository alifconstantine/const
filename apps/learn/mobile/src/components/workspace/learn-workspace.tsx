import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { MobileArtifactReader } from "./mobile-artifact-reader";
import { generateStudioArtifact } from "../../lib/studio/generator";
import { ThinkingProcess } from "./working-process";
import { ImageLightbox } from "./image-lightbox";
import {
  calculateConversationMetrics,
  calculateContextUsage,
  formatTokenDisplay,
  formatDurationDisplay,
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

function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return "";
  try {
    const raw = marked.parse(md, { gfm: true, breaks: true });
    return typeof raw === "string" ? raw : "";
  } catch {
    return md;
  }
}

function htmlToMarkdown(element: HTMLElement | null): string {
  if (!element) return "";

  const text = element.innerText || element.textContent || "";
  if (!text.trim() && !element.querySelector("img, hr, br")) {
    return "";
  }

  function serialize(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(serialize).join("");

    switch (tag) {
      case "h1":
        return `\n\n# ${children.trim()}\n\n`;
      case "h2":
        return `\n\n## ${children.trim()}\n\n`;
      case "h3":
        return `\n\n### ${children.trim()}\n\n`;
      case "h4":
        return `\n\n#### ${children.trim()}\n\n`;
      case "h5":
        return `\n\n##### ${children.trim()}\n\n`;
      case "h6":
        return `\n\n###### ${children.trim()}\n\n`;
      case "p":
        return children.trim() ? `\n\n${children.trim()}\n\n` : "\n";
      case "strong":
      case "b":
        return children.trim() ? `**${children}**` : "";
      case "em":
      case "i":
        return children.trim() ? `*${children}*` : "";
      case "s":
      case "strike":
      case "del":
        return children.trim() ? `~~${children}~~` : "";
      case "code": {
        if (el.parentElement?.tagName.toLowerCase() === "pre") {
          return children;
        }
        return children.trim() ? `\`${children}\`` : "";
      }
      case "pre":
        return `\n\n\`\`\`\n${children.trim()}\n\`\`\`\n\n`;
      case "ul": {
        const items = Array.from(el.children)
          .map((child) => `- ${serialize(child).trim()}`)
          .join("\n");
        return `\n\n${items}\n\n`;
      }
      case "ol": {
        const items = Array.from(el.children)
          .map((child, idx) => `${idx + 1}. ${serialize(child).trim()}`)
          .join("\n");
        return `\n\n${items}\n\n`;
      }
      case "li":
        return children;
      case "blockquote":
        return `\n\n> ${children.trim().replace(/\n+/g, "\n> ")}\n\n`;
      case "hr":
        return `\n\n---\n\n`;
      case "a": {
        const href = el.getAttribute("href") || "#";
        return `[${children.trim() || href}](${href})`;
      }
      case "br":
        return "\n";
      case "div":
        return children.trim() ? `\n${children}\n` : "\n";
      default:
        return children;
    }
  }

  const result = Array.from(element.childNodes).map(serialize).join("");
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
import {
  ArrowLeft,
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
  FilePlus,
  Layers,
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
    id: "data_table",
    name: "Data Table",
    icon: Table2,
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
}

export function MobileLearnWorkspace({
  learnId,
  initialSourceModalOpen = false,
  onBack,
  onCreateNew,
  onSelectLearn,
  user,
  onSignOut,
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
    data_table: t("toolsDataTable"),
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
  const [generatingArtifacts, setGeneratingArtifacts] = useState<GeneratingArtifactStatus[]>([]);
  const [selectedReaderArtifact, setSelectedReaderArtifact] = useState<LocalArtifact | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  // Local state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [availableModels, setAvailableModels] = useState<MobileModel[]>(DEFAULT_MOBILE_MODELS);
  const [selectedModelId, setSelectedModelId] = useState<string>(
    DEFAULT_MOBILE_MODELS[0]!.id
  );
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isContextDropdownOpen, setIsContextDropdownOpen] = useState(false);
  const [searchModelQuery, setSearchModelQuery] = useState("");
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(initialSourceModalOpen);

  // Note Direct Editor State (Image 3)
  const [selectedNoteArtifact, setSelectedNoteArtifact] = useState<LocalArtifact | null>(null);
  const [noteContentInput, setNoteContentInput] = useState("");
  const [noteTitleInput, setNoteTitleInput] = useState("");
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const isNoteInitializedRef = useRef(false);
  const currentNoteArtifactIdRef = useRef<string | null>(null);
  const noteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync selectedNoteArtifact with Dexie live query
  useEffect(() => {
    if (selectedNoteArtifact) {
      if (selectedNoteArtifact.type !== "note") {
        setSelectedNoteArtifact(null);
        return;
      }
      const fresh = artifacts?.find((a) => a.id === selectedNoteArtifact.id);
      if (fresh && fresh.id !== selectedNoteArtifact.id) {
        setSelectedNoteArtifact(fresh);
      }
      if (
        noteEditorRef.current &&
        (!isNoteInitializedRef.current || currentNoteArtifactIdRef.current !== selectedNoteArtifact.id)
      ) {
        isNoteInitializedRef.current = true;
        currentNoteArtifactIdRef.current = selectedNoteArtifact.id;
        noteEditorRef.current.innerHTML = markdownToHtml(selectedNoteArtifact.content || "");
      }
      if (selectedNoteArtifact.title) {
        setNoteTitleInput(selectedNoteArtifact.title);
      }
    } else {
      isNoteInitializedRef.current = false;
      currentNoteArtifactIdRef.current = null;
    }
  }, [artifacts, selectedNoteArtifact?.id, selectedNoteArtifact?.title]);

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

  // Dynamic telemetry metrics for active conversation
  const conversationMetrics = useMemo(() => {
    return calculateConversationMetrics(messages);
  }, [messages]);

  const currentModel = useMemo(() => {
    return (
      availableModels.find((m) => m.id === selectedModelId) ??
      availableModels[0] ??
      DEFAULT_MOBILE_MODELS[0]!
    );
  }, [availableModels, selectedModelId]);

  // Context window usage estimation for learning sources and discussion history
  const contextUsage = useMemo(() => {
    const totalTokens = (currentModel as any)?.contextWindow || 1048576;
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

  // Load chat messages from local Dexie when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    let isMounted = true;
    localDb.getSessionMessages(activeSessionId).then((saved) => {
      if (!isMounted) return;
      if (saved && saved.length > 0) {
        setMessages(
          saved.map((m) => {
            const savedRawError = (m as any).rawError;
            const content =
              m.content ||
              (savedRawError
                ? `${t("failedToCallRouter") || (language === "id" ? "Gagal memanggil Const Router" : "Failed to call Const Router")}: ${savedRawError}`
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
    });

    return () => {
      isMounted = false;
    };
  }, [activeSessionId]);

  // Auto scroll to bottom on message updates in chat tab
  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, activeTab]);

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
    const defaultName = language === "id" ? "Percakapan Baru" : "New Chat";
    const newSessionId = await localDb.createChatSession(learnId, defaultName);
    setActiveSessionId(newSessionId);
    setMessages([]);
    setInputMessage("");
    setAttachedFiles([]);
  };

  const handleSelectChat = (sessionId: string) => {
    if (isStreaming) {
      handleStop();
    }
    setActiveSessionId(sessionId);
  };

  const handleDeleteChat = async (sessionId: string) => {
    await localDb.deleteChatSession(sessionId);
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

  const handleEditAndUndoTurn = async (userMsg: DisplayMessage) => {
    const userIdx = messages.findIndex((m) => m.id === userMsg.id);
    if (userIdx === -1) return;

    let assistantMsg: DisplayMessage | undefined;
    if (userIdx + 1 < messages.length && messages[userIdx + 1]?.role === "assistant") {
      assistantMsg = messages[userIdx + 1];
    }

    await localDb.deleteTurn(userMsg.id, assistantMsg?.id, activeSessionId || undefined);

    setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== assistantMsg?.id));

    const cleanedPrompt = cleanUserMessageContent(userMsg.content);
    setInputMessage(cleanedPrompt);

    if (userMsg.attachments && userMsg.attachments.length > 0) {
      setAttachedFiles([...userMsg.attachments]);
    }

    toast.info(
      language === "id"
        ? "Pesan dikembalikan ke input untuk diedit"
        : "Message restored to input for editing"
    );
  };

  const handleSend = async (customPrompt?: string, attachmentsToSend?: AttachedMedia[]) => {
    let textToSend = (customPrompt || inputMessage).trim();
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
    let priorImagesCount = 0;
    for (const m of messages) {
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

    const nextMessages = [...messages, newUserMsg];
    setMessages([...nextMessages, newAssistantMsg]);
    setInputMessage("");
    setAttachedFiles([]);
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
        onDone: async (finalContent, finalThinking) => {
          const resolvedContent = finalContent || t("noResponseReceived");
          const finalDuration = Date.now() - now;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: resolvedContent,
                    thinking: finalThinking,
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
              durationMs: finalDuration,
              createdAt: Date.now(),
            });
          }
        },
        onError: async (err) => {
          const finalDuration = Date.now() - now;
          const rawErr = err?.message || String(err);
          const errorPrefix =
            t("failedToCallRouter") ||
            (language === "id"
              ? "Gagal memanggil Const Router"
              : "Failed to call Const Router");
          const errorText = `${errorPrefix}: ${rawErr}`;
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
    const content = noteEditorRef.current
      ? htmlToMarkdown(noteEditorRef.current)
      : (art.content || "");
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
      art.data?.questions ||
      art.data?.cards ||
      art.data?.root
    ) {
      handleOpenArtifactReader(art);
      return;
    }

    if (art.type === "note") {
      setSelectedNoteArtifact(art);
      setNoteContentInput(art.content || "");
      setNoteTitleInput(art.title || (language === "id" ? "Catatan Baru" : "New Note"));
      setIsStudioSheetOpen(false);
      setTimeout(() => {
        if (noteEditorRef.current) {
          isNoteInitializedRef.current = true;
          currentNoteArtifactIdRef.current = art.id;
          noteEditorRef.current.innerHTML = markdownToHtml(art.content || "");
        }
      }, 0);
      return;
    }

    // Other artifact types
    toast(art.title || "Artifact");
  };

  const handleDeleteArtifact = async (artId: string) => {
    await localDb.deleteArtifact(artId);
    if (selectedNoteArtifact?.id === artId) {
      setSelectedNoteArtifact(null);
    }
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

  const handleCopyNote = () => {
    const textToCopy = noteEditorRef.current
      ? htmlToMarkdown(noteEditorRef.current)
      : (noteContentInput || selectedNoteArtifact?.content || "");
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    toast.success(
      language === "id" ? "Catatan disalin ke papan klip" : "Note copied to clipboard"
    );
  };

  const handleNoteTitleChange = (newTitle: string) => {
    setNoteTitleInput(newTitle);
    if (selectedNoteArtifact) {
      localDb.updateArtifact(selectedNoteArtifact.id, {
        title: newTitle || (language === "id" ? "Catatan Baru" : "New Note"),
      });
    }
  };

  const handleNoteInput = () => {
    if (!noteEditorRef.current || !selectedNoteArtifact) return;
    const md = htmlToMarkdown(noteEditorRef.current);
    setNoteContentInput(md);

    if (noteDebounceTimerRef.current) clearTimeout(noteDebounceTimerRef.current);
    noteDebounceTimerRef.current = setTimeout(async () => {
      if (selectedNoteArtifact) {
        try {
          await localDb.updateArtifact(selectedNoteArtifact.id, { content: md });
        } catch (err) {
          console.error("Failed to auto-save note:", err);
        }
      }
    }, 450);
  };

  const applyNoteFormat = (action: string, param?: string) => {
    const editor = noteEditorRef.current;
    if (!editor) return;

    editor.focus();

    switch (action) {
      case "undo":
        document.execCommand("undo", false);
        break;
      case "redo":
        document.execCommand("redo", false);
        break;
      case "heading": {
        if (param === "h1") {
          document.execCommand("formatBlock", false, "<h1>");
        } else if (param === "h2") {
          document.execCommand("formatBlock", false, "<h2>");
        } else if (param === "h3") {
          document.execCommand("formatBlock", false, "<h3>");
        } else {
          document.execCommand("formatBlock", false, "<p>");
        }
        break;
      }
      case "bold":
        document.execCommand("bold", false);
        break;
      case "italic":
        document.execCommand("italic", false);
        break;
      case "link": {
        const url = window.prompt(
          language === "id" ? "Masukkan URL tautan:" : "Enter link URL:",
          "https://"
        );
        if (url) {
          document.execCommand("createLink", false, url);
        }
        break;
      }
      case "code": {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          const codeEl = document.createElement("code");
          codeEl.textContent = selectedText;
          range.deleteContents();
          range.insertNode(codeEl);
          selection.removeAllRanges();
        } else {
          document.execCommand("formatBlock", false, "<pre>");
        }
        break;
      }
      case "bullet":
        document.execCommand("insertUnorderedList", false);
        break;
      case "ordered":
        document.execCommand("insertOrderedList", false);
        break;
      case "quote":
        document.execCommand("formatBlock", false, "<blockquote>");
        break;
      case "rule":
        document.execCommand("insertHorizontalRule", false);
        break;
      case "clear":
        document.execCommand("removeFormat", false);
        break;
      default:
        break;
    }

    handleNoteInput();
  };

  const handleConvertToSource = async (art: LocalArtifact | null) => {
    if (!learnId || !art) return;
    const md = noteEditorRef.current
      ? htmlToMarkdown(noteEditorRef.current)
      : (noteContentInput || art.content || "");
    try {
      await localDb.createSource({
        learnId,
        title: noteTitleInput || art.title || (language === "id" ? "Catatan Baru" : "New Note"),
        content: md,
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
      toast.error(
        language === "id"
          ? "Gagal mengonversikan catatan menjadi sumber."
          : "Failed to convert note to source."
      );
    }
  };

  const handleAddNote = async () => {
    if (!learnId) return;

    const allSources = await db.sources.where("learnId").equals(learnId).toArray();
    const activeSources = allSources.filter((s) => s.includedInChat !== false);
    const sourcesCount = activeSources.length;

    // 1. Create generating artifact in Dexie (instantly shows loading state with spinner in Image 1)
    const defaultTitle = language === "id" ? "Catatan Baru" : "New Note";
    const artId = await localDb.createArtifact({
      learnId,
      title: sourcesCount > 0 ? (language === "id" ? "Membuat Catatan..." : "Creating Note...") : defaultTitle,
      type: "note",
      status: sourcesCount > 0 ? "generating" : "completed",
      content: "",
      sourcesCount,
    });

    if (sourcesCount === 0) {
      const created = await db.artifacts.get(artId);
      if (created) {
        handleOpenArtifact(created);
      }
      return;
    }

    // 2. Synthesize note using AI in background
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

      const userPrompt = `Mohon buatkan catatan sintesis komprehensif berdasarkan materi sumber berikut:\n\n${grounded.formattedContext}\n\nBuat catatan yang rapi, padat wawasan, terstruktur, dan mudah dipahami.`;

      let noteContent = "";
      await streamChatCompletion({
        model: activeModelId,
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        onToken: (token) => {
          noteContent += token;
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

          await localDb.updateArtifact(artId, {
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
          await localDb.updateArtifact(artId, {
            title: defaultTitle,
            status: "completed",
            error: err.message,
          });
          toast.error(
            language === "id"
              ? "Gagal menghasilkan ringkasan AI, catatan kosong tetap dibuat."
              : "Failed to generate AI note, blank note created."
          );
        },
      });
    } catch (err: any) {
      console.error("Error initiating note generation:", err);
      await localDb.updateArtifact(artId, {
        title: defaultTitle,
        status: "completed",
        error: err.message,
      });
    }
  };

  const handleTriggerWebSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSourcesSheetOpen(false);
    handleSend(
      language === "id"
        ? `Tolong cari referensi web mendalam (${webScope}, ${researchSpeed}) tentang: ${searchQuery}`
        : `Please perform deep research (${webScope}, ${researchSpeed}) on the web regarding: ${searchQuery}`
    );
    setSearchQuery("");
  };

  const handleSelectStudioTool = (toolId: string, _toolTitle: string) => {
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
    // Other tools: strictly no-op as requested
    return;
  };

  const handleGenerateStudioArtifact = async (options: {
    type: "quiz" | "flashcard" | "mind_map";
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    count: number;
    selectedSourceIds: string[];
  }) => {
    const selectedSources = (sources || []).filter((s) => options.selectedSourceIds.includes(s.id));
    const title = options.topic.trim()
      ? (options.type === "quiz"
          ? `Kuis: ${options.topic}`
          : options.type === "flashcard"
          ? `Kartu: ${options.topic}`
          : `Peta Pikiran: ${options.topic}`)
      : (options.type === "quiz"
          ? (language === "id" ? `Kuis (${options.count} Soal)` : `Quiz (${options.count} Questions)`)
          : options.type === "flashcard"
          ? (language === "id" ? `Kartu Hafalan (${options.count} Kartu)` : `Flashcards (${options.count} Cards)`)
          : (language === "id" ? "Peta Pikiran" : "Mind Map"));

    const initialLoadingTitle =
      options.type === "quiz"
        ? (language === "id" ? "Membuat Kuis..." : "Creating Quiz...")
        : options.type === "flashcard"
        ? (language === "id" ? "Membuat Kartu Tanya-Jawab..." : "Creating Flashcards...")
        : (language === "id" ? "Membuat Peta Pikiran..." : "Creating Mind Map...");

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
        language: language === "id" ? "id" : "en",
      });

      await localDb.updateArtifact(artId, {
        title: result.title || title,
        data: result.data,
        content: JSON.stringify(result.data),
        status: "completed",
      });

      toast.success(
        language === "id"
          ? (options.type === "quiz"
              ? "Kuis berhasil dibuat!"
              : options.type === "flashcard"
              ? "Kartu tanya-jawab berhasil dibuat!"
              : "Peta pikiran berhasil dibuat!")
          : (options.type === "quiz"
              ? "Quiz created successfully!"
              : options.type === "flashcard"
              ? "Flashcards created successfully!"
              : "Mind map created successfully!")
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
        language === "id"
          ? `Gagal membuat materi: ${err?.message || "Terjadi kesalahan"}`
          : `Failed to create material: ${err?.message || "An error occurred"}`
      );
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
                  <div className="absolute right-0 mt-1.5 w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-popover border border-border text-popover-foreground shadow-2xl p-3 z-50 animate-in fade-in duration-100 flex flex-col font-sans select-none">
                    {/* Header: % of context used and tokens */}
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="text-xs font-semibold text-foreground">
                        {contextUsage.rawPercentUsed === 0 ? "0%" : contextUsage.percentUsed} {t("contextUsed")}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        ~{formatTokenDisplay(contextUsage.usedTokens)} / {formatTokenDisplay(contextUsage.totalTokens)}
                      </span>
                    </div>

                    {/* Thin progress bar */}
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden flex gap-0.5 my-2">
                      {contextUsage.sourcesTokens > 0 && (
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{ width: `${Math.max(1, (contextUsage.sourcesTokens / contextUsage.totalTokens) * 100)}%` }}
                        />
                      )}
                      {contextUsage.systemPromptTokens > 0 && (
                        <div
                          className="bg-muted-foreground h-full transition-all"
                          style={{ width: `${Math.max(1, (contextUsage.systemPromptTokens / contextUsage.totalTokens) * 100)}%` }}
                        />
                      )}
                      {contextUsage.messagesTokens > 0 && (
                        <div
                          className="bg-blue-500 h-full transition-all"
                          style={{ width: `${Math.max(1, (contextUsage.messagesTokens / contextUsage.totalTokens) * 100)}%` }}
                        />
                      )}
                      {contextUsage.draftInputTokens > 0 && (
                        <div
                          className="bg-purple-500 h-full transition-all"
                          style={{ width: `${Math.max(1, (contextUsage.draftInputTokens / contextUsage.totalTokens) * 100)}%` }}
                        />
                      )}
                    </div>

                    {/* Breakdown list */}
                    <div className="flex flex-col gap-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="w-2 h-2 rounded-xs bg-emerald-500" />
                          <span>{t("learningSources")} ({learn?.sourcesCount || 0})</span>
                        </div>
                        <span className="font-mono text-muted-foreground">~{formatTokenDisplay(contextUsage.sourcesTokens)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="w-2 h-2 rounded-xs bg-muted-foreground" />
                          <span>{t("tutorInstructions")}</span>
                        </div>
                        <span className="font-mono text-muted-foreground">~{formatTokenDisplay(contextUsage.systemPromptTokens)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="w-2 h-2 rounded-xs bg-blue-500" />
                          <span>{t("chatHistory")}</span>
                        </div>
                        <span className="font-mono text-muted-foreground">~{formatTokenDisplay(contextUsage.messagesTokens)}</span>
                      </div>

                      {contextUsage.draftInputTokens > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-purple-500">
                            <span className="w-2 h-2 rounded-xs bg-purple-500" />
                            <span>{t("currentInput")}</span>
                          </div>
                          <span className="font-mono text-purple-500">~{formatTokenDisplay(contextUsage.draftInputTokens)}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-border text-muted-foreground">
                        <span>{t("availableContext")}</span>
                        <span className="font-mono">~{formatTokenDisplay(contextUsage.availableTokens)}</span>
                      </div>
                    </div>

                    {/* Session Telemetry */}
                    {conversationMetrics && (
                      <div className="mt-2.5 pt-2 border-t border-border flex flex-col gap-1.5">
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                          {t("sessionTelemetry")}
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Turns & Steps</span>
                          <span className="font-mono text-foreground">{conversationMetrics.turns} turns · {conversationMetrics.steps} steps</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Speed & Time</span>
                          <span className="font-mono text-foreground">LLM {formatDurationDisplay(conversationMetrics.llmDurationMs)} · {conversationMetrics.tokPerSec} tok/s</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Cache & Tokens</span>
                          <span className="font-mono text-foreground">{conversationMetrics.cacheHitRate}% cache · ↑{formatTokenDisplay(conversationMetrics.inputTokens)} ↓{formatTokenDisplay(conversationMetrics.outputTokens)}</span>
                        </div>
                      </div>
                    )}
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
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-5 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden overscroll-contain">
            {messages.length === 0 ? (
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
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 text-muted-foreground">
                  <div className="text-3xl mb-2">👋</div>
                  <h2 className="text-base font-medium text-foreground mb-1">
                    Mulai Belajar dengan Sumber
                  </h2>
                  <p className="text-xs leading-relaxed max-w-xs mb-4">
                    Tambahkan tautan web, dokumen PDF, atau video YouTube untuk membuka sitasi dan pembelajaran terverifikasi.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddSourceOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background font-medium text-xs cursor-pointer active:scale-95 shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Tambahkan Sumber</span>
                  </button>
                </div>
              )
            ) : (
              messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                } w-full`}
              >
                {msg.role === "user" ? (
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
                                  <span className="absolute bottom-1 right-1 text-[7px] font-mono bg-black/70 text-white px-1 rounded uppercase font-bold">
                                    VID
                                  </span>
                                </div>
                              ) : (
                                <div className="w-full h-full p-1.5 flex flex-col justify-between rounded-xl bg-secondary/80 text-left">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-bold text-muted-foreground font-mono uppercase">
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
                                  <span className="text-[7.5px] text-muted-foreground font-mono block truncate">
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
                    <div className="flex items-center gap-2 pt-1 pr-1 text-[10.5px] font-mono text-muted-foreground select-none">
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
                        onClick={() => handleEditAndUndoTurn(msg)}
                        className="p-1 rounded hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95"
                        title={t("editMessage")}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-2 group select-text">
                    {/* Thinking Process (Minimalist, auto-collapses once content begins) */}
                    <ThinkingProcess
                      thinking={msg.thinking}
                      isExecuting={Boolean(msg.isStreaming && !msg.content)}
                      durationMs={
                        msg.thinkingDurationMs ||
                        (msg.isStreaming && !msg.content ? liveDurationMs : undefined)
                      }
                    />

                    {/* Assistant Output Message (Pure clean MarkdownContent, matching apps/harness/desktop!) */}
                    {msg.content ? (
                      <div className="px-0.5 text-[14px] text-foreground leading-relaxed select-text font-sans">
                        <MarkdownContent
                          content={msg.content}
                          sourcesMap={sourcesMap}
                          onSourceClick={handleCitationClick}
                        />
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-foreground animate-pulse align-middle" />
                        )}
                      </div>
                    ) : null}

                    {/* Assistant Action Bar: Timestamp & Copy - Always visible */}
                    {!msg.isStreaming && msg.content && (
                      <div className="flex items-center gap-2 pt-0.5 pl-0.5 text-[10.5px] font-mono text-muted-foreground select-none">
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
              "px-3 pt-1.5 shrink-0 bg-background/95 backdrop-blur-xs z-10 w-full transition-[padding] duration-150",
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

      {/* Interactive Full-Screen Reader Overlay */}
      <MobileArtifactReader
        open={isReaderOpen}
        onClose={() => setIsReaderOpen(false)}
        artifact={selectedReaderArtifact}
        onExplainInChat={handleExplainInChat}
      />

      {/* Add Source Pop-up Modal */}
      <AddSourceDialog
        open={isAddSourceOpen}
        onOpenChange={setIsAddSourceOpen}
        learnId={learnId}
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

      {/* Full-Screen Note Direct Editor Modal (Matching Image 3) */}
      {selectedNoteArtifact && selectedNoteArtifact.type === "note" && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center animate-in fade-in duration-200"
          onClick={() => setSelectedNoteArtifact(null)}
        >
          <div
            className="w-full h-[95vh] sm:h-[90vh] sm:max-w-2xl bg-card border-t sm:border border-border rounded-t-[24px] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Breadcrumb & Actions Header (Image 3) */}
            <div className="h-12 px-3 sm:px-4 border-b border-border flex items-center justify-between shrink-0 bg-card rounded-t-[24px] sm:rounded-t-2xl">
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedNoteArtifact(null)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Studio
                </button>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">
                  {language === "id" ? "Catatan" : "Note"}
                </span>
              </div>

              {/* Top Right Action Icons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDeleteArtifact(selectedNoteArtifact.id)}
                  className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors cursor-pointer"
                  title={language === "id" ? "Hapus Catatan" : "Delete Note"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleCopyNote}
                  className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  title={language === "id" ? "Salin" : "Copy"}
                >
                  <Copy className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadArtifact(selectedNoteArtifact)}
                  className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  title={language === "id" ? "Unduh .md" : "Download .md"}
                >
                  <Download className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedNoteArtifact(null)}
                  className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  title={language === "id" ? "Tutup" : "Close"}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Note Title Input (Image 3) */}
            <div className="px-4 pt-3 pb-1 border-b border-border">
              <input
                type="text"
                value={noteTitleInput}
                onChange={(e) => handleNoteTitleChange(e.target.value)}
                placeholder={language === "id" ? "Catatan Baru" : "New Note"}
                className="text-lg sm:text-xl font-bold text-foreground bg-transparent border-none outline-none focus:outline-none w-full placeholder:text-muted-foreground tracking-tight"
              />
            </div>

            {/* Formatting Toolbar (Image 3) */}
            <div className="px-3 py-1.5 border-b border-border bg-secondary/40 flex items-center gap-0.5 overflow-x-auto no-scrollbar shrink-0 select-none">
              <button
                type="button"
                onClick={() => applyNoteFormat("undo")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyNoteFormat("redo")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>

              <div className="w-px h-4 bg-border mx-1 shrink-0" />

              {/* Headings Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-7 px-2 rounded-md hover:bg-secondary text-foreground text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <span>Normal</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-36 bg-popover border-border text-popover-foreground"
                >
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => applyNoteFormat("heading", "p")}
                  >
                    Normal
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer font-bold"
                    onClick={() => applyNoteFormat("heading", "h1")}
                  >
                    Judul 1
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer font-semibold"
                    onClick={() => applyNoteFormat("heading", "h2")}
                  >
                    Judul 2
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer font-medium"
                    onClick={() => applyNoteFormat("heading", "h3")}
                  >
                    Judul 3
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-4 bg-border mx-1 shrink-0" />

              <button
                type="button"
                onClick={() => applyNoteFormat("bold")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Tebal"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyNoteFormat("italic")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Miring"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyNoteFormat("link")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Tautan"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyNoteFormat("code")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Kode"
              >
                <Code className="h-3.5 w-3.5" />
              </button>

              <div className="w-px h-4 bg-border mx-1 shrink-0" />

              <button
                type="button"
                onClick={() => applyNoteFormat("bullet")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Daftar Butir"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyNoteFormat("ordered")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Daftar Bernomor"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyNoteFormat("quote")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Kutipan"
              >
                <Quote className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyNoteFormat("rule")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Garis Pemisah"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyNoteFormat("clear")}
                className="h-7 w-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Hapus Format"
              >
                <RemoveFormatting className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Direct Note Editor Body (Live rendered markdown, no yellow block!) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 select-text">
              <div
                ref={noteEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleNoteInput}
                data-placeholder={
                  language === "id"
                    ? "Tulis catatan atau tempel konten di sini..."
                    : "Write note or paste content here..."
                }
                style={{
                  outline: "none",
                  border: "none",
                  boxShadow: "none",
                }}
                className={cn(
                  "w-full h-full min-h-[350px] bg-transparent text-foreground text-sm font-sans leading-relaxed select-text",
                  "border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ring-0 shadow-none",
                  "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none empty:before:block",
                  "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:tracking-tight",
                  "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:tracking-tight",
                  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2.5 [&_h3]:mb-1",
                  "[&_p]:mb-2 [&_p]:leading-relaxed",
                  "[&_strong]:font-bold [&_strong]:text-foreground",
                  "[&_b]:font-bold [&_b]:text-foreground",
                  "[&_em]:italic [&_em]:text-foreground/90",
                  "[&_i]:italic [&_i]:text-foreground/90",
                  "[&_a]:text-blue-400 [&_a]:underline hover:[&_a]:text-blue-300",
                  "[&_code]:bg-secondary [&_code]:text-foreground [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
                  "[&_pre]:bg-secondary/50 [&_pre]:border [&_pre]:border-border [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:my-2.5 [&_pre]:overflow-x-auto",
                  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1",
                  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1",
                  "[&_li]:leading-relaxed",
                  "[&_blockquote]:border-l-2 [&_blockquote]:border-blue-500 [&_blockquote]:pl-3 [&_blockquote]:py-0.5 [&_blockquote]:my-2.5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
                  "[&_hr]:border-border [&_hr]:my-4"
                )}
              />
            </div>

            {/* Footer / Convert to Source Button (Image 3) */}
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between bg-secondary/30 shrink-0">
              <button
                type="button"
                onClick={() => handleConvertToSource(selectedNoteArtifact)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-98"
              >
                <FilePlus className="h-4 w-4 stroke-[2]" />
                <span>
                  {language === "id" ? "Konversikan menjadi sumber" : "Convert to source"}
                </span>
              </button>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  {language === "id" ? "Tersimpan otomatis" : "Auto-saved"}
                </span>
                <span className="text-muted-foreground">•</span>
                <span>
                  {noteContentInput
                    ? `${noteContentInput.length.toLocaleString()} ${
                        language === "id" ? "karakter" : "chars"
                      }`
                    : "0 karakter"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
