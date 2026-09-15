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
import { StudioSheet } from "./studio-sheet";
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
}

const STUDIO_TOOLS: StudioTool[] = [
  {
    id: "audio_summary",
    name: "Audio Overview",
    icon: AudioLines,
    iconColor: "text-[#a5b4fc]",
    textColor: "text-[#dbeafe]",
    cardBg: "bg-[#21232d]",
    borderColor: "border-[#303444]",
    hoverBg: "hover:bg-[#282b37]",
    hoverBorder: "hover:border-[#3d4257]",
  },
  {
    id: "slides",
    name: "Presentation Slides",
    icon: Presentation,
    iconColor: "text-[#fde047]",
    textColor: "text-[#fef9c3]",
    cardBg: "bg-[#2b291d]",
    borderColor: "border-[#3e3b2a]",
    hoverBg: "hover:bg-[#353224]",
    hoverBorder: "hover:border-[#4f4b36]",
  },
  {
    id: "video_summary",
    name: "Video Summary",
    icon: Video,
    iconColor: "text-[#86efac]",
    textColor: "text-[#dcfce7]",
    cardBg: "bg-[#1d2820]",
    borderColor: "border-[#2b3d30]",
    hoverBg: "hover:bg-[#243329]",
    hoverBorder: "hover:border-[#384e3e]",
  },
  {
    id: "mind_map",
    name: "Mind Map",
    icon: GitFork,
    iconColor: "text-[#f472b6]",
    textColor: "text-[#fce7f3]",
    cardBg: "bg-[#2e212b]",
    borderColor: "border-[#422f3e]",
    hoverBg: "hover:bg-[#372834]",
    hoverBorder: "hover:border-[#543b4f]",
  },
  {
    id: "report",
    name: "Report",
    icon: FileText,
    iconColor: "text-[#dedac2]",
    textColor: "text-[#f5f4eb]",
    cardBg: "bg-[#29281e]",
    borderColor: "border-[#3c3a2b]",
    hoverBg: "hover:bg-[#343225]",
    hoverBorder: "hover:border-[#4d4a37]",
  },
  {
    id: "browser",
    name: "Browser",
    icon: Globe,
    iconColor: "text-[#38bdf8]",
    textColor: "text-[#e0f2fe]",
    cardBg: "bg-[#1e262f]",
    borderColor: "border-[#2c3947]",
    hoverBg: "hover:bg-[#25313d]",
    hoverBorder: "hover:border-[#38495a]",
  },
  {
    id: "quiz",
    name: "Quiz",
    icon: HelpCircle,
    iconColor: "text-[#5eead4]",
    textColor: "text-[#ccfbf1]",
    cardBg: "bg-[#1c2628]",
    borderColor: "border-[#29383c]",
    hoverBg: "hover:bg-[#233235]",
    hoverBorder: "hover:border-[#364b50]",
  },
  {
    id: "infographic",
    name: "Infographic",
    icon: BarChart3,
    iconColor: "text-[#c084fc]",
    textColor: "text-[#f3e8ff]",
    cardBg: "bg-[#28202d]",
    borderColor: "border-[#3a2d42]",
    hoverBg: "hover:bg-[#322739]",
    hoverBorder: "hover:border-[#4b3a55]",
  },
];

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  thinkingDurationMs?: number;
  isStreaming?: boolean;
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
    browser: t("toolsBrowser"),
    quiz: t("toolsQuiz"),
    infographic: t("toolsInfographic"),
  };

  // Live notebook data from local Dexie
  const learn = useLiveQuery(async () => {
    return await db.learns.get(learnId);
  }, [learnId]);

  // Live artifacts from local Dexie
  const artifacts = useLiveQuery(async () => {
    return await db.artifacts.where("learnId").equals(learnId).toArray();
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

  // Dynamic telemetry metrics for active conversation
  const conversationMetrics = useMemo(() => {
    return calculateConversationMetrics(messages);
  }, [messages]);

  // Context window usage estimation for learning sources and discussion history
  const contextUsage = useMemo(() => {
    return calculateContextUsage({
      sources,
      sourcesCount: learn?.sourcesCount || 0,
      messages,
      draftInput: inputMessage,
      totalTokens: 1048576,
    });
  }, [sources, learn?.sourcesCount, messages, inputMessage]);

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
          saved.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content || "",
            thinking: m.thinking,
            toolCalls: m.toolCalls,
            durationMs: m.durationMs,
            attachments: m.attachments,
            createdAt: m.createdAt,
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
          const errorText =
            language === "id"
              ? `Gagal memanggil Const Router: ${err.message}`
              : `Failed to call Const Router: ${err.message}`;
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

  const handleDownloadArtifact = (art: LocalArtifact) => {
    if (art.fileUrl) {
      const a = document.createElement("a");
      a.href = art.fileUrl;
      a.download = art.title || "artifact.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (art.content) {
      const blob = new Blob([art.content], { type: "text/markdown;charset=utf-8" });
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

  const handleSelectStudioTool = (toolId: string, toolTitle: string) => {
    setIsStudioSheetOpen(false);
    if (toolId === "browser") {
      handleSend(
        language === "id"
          ? "Tolong gunakan browser untuk mencari referensi web dan riset mendalam terkait topik ini."
          : "Please use the browser to search the web and research in-depth references for this topic."
      );
    } else {
      handleSend(
        language === "id"
          ? `Tolong buatkan ${toolTitle} untuk notebook ini.`
          : `Please create a ${toolTitle} for this notebook.`
      );
    }
  };

  const currentModel =
    availableModels.find((m) => m.id === selectedModelId) ??
    availableModels[0] ??
    DEFAULT_MOBILE_MODELS[0]!;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#161616] text-[#d4d4d4] overflow-hidden select-none">
      {/* Top Mobile Header with Garis 2, Model Selector, Context Window, New Chat, and Titik 3 */}
      <header className="h-14 px-3 sm:px-4 bg-[#222222] border-b border-[#383838] flex items-center justify-between shrink-0 z-20 select-none">
        {/* Left Section: Garis 2 (Sidebar Toggle) & Model Selector */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          {/* Tombol Garis Dua */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="h-9 w-9 rounded-xl hover:bg-[#2b2b2b] text-[#d4d4d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-[#383838] shrink-0 active:scale-95"
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-xs font-medium text-[#d4d4d4] hover:text-white transition-colors duration-150 cursor-pointer max-w-[135px] sm:max-w-[200px]"
              title={currentModel.name}
            >
              <span className="font-sans text-[12px] truncate">{currentModel.name}</span>
              <ChevronDown className="h-3 w-3 text-[#969696] shrink-0" />
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
                <div className="absolute left-0 mt-1.5 w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-[#1e1e20] border border-[#383838] shadow-2xl p-2 z-50 animate-in fade-in duration-100 flex flex-col gap-1 font-sans">
                  {/* Search Input (Matching Desktop) */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded-xl bg-[#262628] border border-[#333335]">
                    <Search className="w-3.5 h-3.5 text-[#888888] shrink-0" />
                    <input
                      type="text"
                      value={searchModelQuery}
                      onChange={(e) => setSearchModelQuery(e.target.value)}
                      placeholder={t("searchModels")}
                      className="w-full bg-transparent text-xs text-white placeholder:text-[#666666] outline-none font-sans"
                      autoFocus
                    />
                    {searchModelQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchModelQuery("")}
                        className="p-0.5 hover:bg-[#333335] rounded text-[#888888] hover:text-white transition-colors cursor-pointer"
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
                                  ? "bg-[#2b2b2b] text-white font-medium"
                                  : "text-[#969696] hover:text-white hover:bg-[#262628]"
                              )}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-sans text-[13px] font-medium text-white">{m.name}</span>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-white shrink-0 ml-auto" />
                                )}
                              </div>
                              {m.description && (
                                <span className="text-[11px] text-[#777777] mt-0.5 leading-snug line-clamp-2">
                                  {m.description}
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="py-6 px-3 text-center text-xs text-[#888888]">
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
          {/* Context Window Indicator */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const next = !isContextDropdownOpen;
                if (next) setIsModelDropdownOpen(false);
                setIsContextDropdownOpen(next);
              }}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-xl bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] transition-colors cursor-pointer shrink-0 active:scale-95",
                contextUsage.rawPercentUsed >= 90
                  ? "text-red-400"
                  : contextUsage.rawPercentUsed >= 75
                  ? "text-[#e79737]"
                  : "text-[#a9a9a9] hover:text-[#d4d4d4]"
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
                  stroke="#383838"
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
                <div className="absolute right-0 mt-1.5 w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-[#1e1e20] border border-[#383838] shadow-2xl p-3 z-50 animate-in fade-in duration-100 flex flex-col font-sans select-none">
                  {/* Header: % of context used and tokens */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#2d2d30]">
                    <span className="text-xs font-semibold text-white">
                      {contextUsage.rawPercentUsed === 0 ? "0%" : contextUsage.percentUsed} {t("contextUsed")}
                    </span>
                    <span className="font-mono text-[11px] text-[#888888]">
                      ~{formatTokenDisplay(contextUsage.usedTokens)} / {formatTokenDisplay(contextUsage.totalTokens)}
                    </span>
                  </div>

                  {/* Thin progress bar */}
                  <div className="w-full h-1.5 bg-[#2d2d30] rounded-full overflow-hidden flex gap-0.5 my-2">
                    {contextUsage.sourcesTokens > 0 && (
                      <div
                        className="bg-[#10b981] h-full transition-all"
                        style={{ width: `${Math.max(1, (contextUsage.sourcesTokens / contextUsage.totalTokens) * 100)}%` }}
                      />
                    )}
                    {contextUsage.systemPromptTokens > 0 && (
                      <div
                        className="bg-[#71717a] h-full transition-all"
                        style={{ width: `${Math.max(1, (contextUsage.systemPromptTokens / contextUsage.totalTokens) * 100)}%` }}
                      />
                    )}
                    {contextUsage.messagesTokens > 0 && (
                      <div
                        className="bg-[#3b82f6] h-full transition-all"
                        style={{ width: `${Math.max(1, (contextUsage.messagesTokens / contextUsage.totalTokens) * 100)}%` }}
                      />
                    )}
                    {contextUsage.draftInputTokens > 0 && (
                      <div
                        className="bg-[#a855f7] h-full transition-all"
                        style={{ width: `${Math.max(1, (contextUsage.draftInputTokens / contextUsage.totalTokens) * 100)}%` }}
                      />
                    )}
                  </div>

                  {/* Breakdown list */}
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#a0a0a0]">
                        <span className="w-2 h-2 rounded-xs bg-[#10b981]" />
                        <span>{t("learningSources")} ({learn?.sourcesCount || 0})</span>
                      </div>
                      <span className="font-mono text-[#888888]">~{formatTokenDisplay(contextUsage.sourcesTokens)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#a0a0a0]">
                        <span className="w-2 h-2 rounded-xs bg-[#71717a]" />
                        <span>{t("tutorInstructions")}</span>
                      </div>
                      <span className="font-mono text-[#888888]">~{formatTokenDisplay(contextUsage.systemPromptTokens)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#a0a0a0]">
                        <span className="w-2 h-2 rounded-xs bg-[#3b82f6]" />
                        <span>{t("chatHistory")}</span>
                      </div>
                      <span className="font-mono text-[#888888]">~{formatTokenDisplay(contextUsage.messagesTokens)}</span>
                    </div>

                    {contextUsage.draftInputTokens > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[#a855f7]">
                          <span className="w-2 h-2 rounded-xs bg-[#a855f7]" />
                          <span>{t("currentInput")}</span>
                        </div>
                        <span className="font-mono text-[#a855f7]">~{formatTokenDisplay(contextUsage.draftInputTokens)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-[#2d2d30] text-[#777777]">
                      <span>{t("availableContext")}</span>
                      <span className="font-mono">~{formatTokenDisplay(contextUsage.availableTokens)}</span>
                    </div>
                  </div>

                  {/* Session Telemetry */}
                  {conversationMetrics && (
                    <div className="mt-2.5 pt-2 border-t border-[#2d2d30] flex flex-col gap-1.5">
                      <div className="text-[10px] uppercase font-semibold text-[#666666] tracking-wider">
                        {t("sessionTelemetry")}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#a0a0a0]">Turns & Steps</span>
                        <span className="font-mono text-white">{conversationMetrics.turns} turns · {conversationMetrics.steps} steps</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#a0a0a0]">Speed & Time</span>
                        <span className="font-mono text-white">LLM {formatDurationDisplay(conversationMetrics.llmDurationMs)} · {conversationMetrics.tokPerSec} tok/s</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#a0a0a0]">Cache & Tokens</span>
                        <span className="font-mono text-white">{conversationMetrics.cacheHitRate}% cache · ↑{formatTokenDisplay(conversationMetrics.inputTokens)} ↓{formatTokenDisplay(conversationMetrics.outputTokens)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleNewChat}
            className="h-8 w-8 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] text-[#d4d4d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#383838] shrink-0 active:scale-95"
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
                className="h-8 w-8 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] text-[#d4d4d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#383838] shrink-0 active:scale-95"
                title={t("moreOptions") || "Opsi lainnya"}
                aria-label={t("moreOptions") || "Opsi lainnya"}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-52 rounded-xl bg-[#222222] border border-[#383838] p-1 text-[#d4d4d4] shadow-2xl z-50 font-sans"
            >
              <DropdownMenuItem
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5 text-[#969696]" />
                <span>{t("editLearn") || "Ubah Nama Notebook"}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setIsSourcesSheetOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] cursor-pointer"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#969696]" />
                <span>{t("sources") || "Sumber Belajar"}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setIsStudioSheetOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] cursor-pointer"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-[#969696]" />
                <span>{t("studioTitle") || "Studio Tools"}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-[#383838] my-1" />

              <DropdownMenuItem
                onClick={handleNewChat}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#969696]" />
                <span>{t("newChat") || "Chat Baru"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Chat Workspace (Full Viewport Height - No Bottom Nav) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden max-w-lg mx-auto w-full relative">

          {/* Scrollable Conversation Stream */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-5 min-h-0">
            {messages.length === 0 ? (
              carriedSources.length > 0 ? (
                /* Mobile NotebookLM Source Guide View */
                <div className="flex flex-col justify-start py-3 animate-in fade-in duration-200 select-none">
                  {/* Title */}
                  <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white mb-1 leading-snug">
                    {learn?.title || carriedSources[0]?.title || "Panduan Sumber Belajar"}
                  </h1>

                  {/* Meta */}
                  <div className="flex items-center gap-2 text-xs text-[#969696] font-sans mb-3.5">
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
                  <div className="text-[13px] leading-relaxed text-[#d4d4d4] font-sans mb-3.5">
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#242424] hover:bg-[#2e2e2e] border border-white/10 text-xs font-medium text-white transition-all cursor-pointer active:scale-95"
                    >
                      <Pin className="h-3.5 w-3.5 text-[#969696]" />
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
                      className="p-1.5 rounded-full hover:bg-[#242424] text-[#969696] hover:text-white transition-colors cursor-pointer"
                      title="Salin ringkasan"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.success("Terima kasih atas masukannya!")}
                      className="p-1.5 rounded-full hover:bg-[#242424] text-[#969696] hover:text-white transition-colors cursor-pointer"
                      title="Bagus"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info("Masukan dicatat.")}
                      className="p-1.5 rounded-full hover:bg-[#242424] text-[#969696] hover:text-white transition-colors cursor-pointer"
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
                        className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#242424]/70 hover:bg-[#2a2a2a] border border-white/10 text-xs text-[#e0e0e0] transition-all cursor-pointer active:scale-[0.99] leading-relaxed"
                      >
                        <span>{question}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 text-[#969696]">
                  <div className="text-3xl mb-2">👋</div>
                  <h2 className="text-base font-medium text-white mb-1">
                    Mulai Belajar dengan Sumber
                  </h2>
                  <p className="text-xs leading-relaxed max-w-xs mb-4">
                    Tambahkan tautan web, dokumen PDF, atau video YouTube untuk membuka sitasi dan pembelajaran terverifikasi.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddSourceOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black font-medium text-xs cursor-pointer active:scale-95 shadow-xs"
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
                                "relative rounded-xl border border-[#383838] bg-[#1a1917] overflow-hidden shadow-xs select-none",
                                isMedia
                                  ? "w-16 h-16 sm:w-20 sm:h-20 cursor-pointer active:scale-95 transition-transform"
                                  : "w-28 sm:w-32 h-16 sm:h-20"
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
                                  <Video className="w-5 h-5 text-[#969696]" />
                                  <span className="absolute bottom-1 right-1 text-[7px] font-mono bg-black/70 text-white px-1 rounded uppercase font-bold">
                                    VID
                                  </span>
                                </div>
                              ) : (
                                <div className="w-full h-full p-1.5 flex flex-col justify-between rounded-xl bg-[#262626]/80 text-left">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-bold text-[#888888] font-mono uppercase">
                                      {ext}
                                    </span>
                                    <FileText className="w-3 h-3 text-[#d4d4d4] shrink-0" />
                                  </div>
                                  <div className="w-full flex-1 my-0.5 min-h-0 overflow-hidden">
                                    <ScrollArea className="w-full h-full max-h-[30px] sm:max-h-[34px]">
                                      <span className="text-[9px] font-medium text-[#d4d4d4] leading-tight break-words block pr-1">
                                        {att.name}
                                      </span>
                                    </ScrollArea>
                                  </div>
                                  <span className="text-[7.5px] text-[#777777] font-mono block truncate">
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
                            "max-w-[88%] rounded-2xl bg-[#222222] border border-[#383838] px-3.5 py-2.5 text-[13.5px] text-[#ececec] select-text leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] shadow-xs font-sans transition-colors duration-150",
                            isLongPrompt && !isExpanded && "cursor-pointer hover:border-[#555555]"
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

                    {/* User Message Action Bar: Timestamp, Copy, Edit */}
                    <div className="flex items-center gap-2 pt-1 pr-1 text-[10.5px] font-mono text-[#777777] select-none">
                      {msg.createdAt && <span>{formatTimestamp(msg.createdAt)}</span>}
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, cleanUserMessageContent(msg.content) || msg.content)}
                        className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                        title={t("copyMessage")}
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-[#34d399]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditAndUndoTurn(msg)}
                        className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
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

                    {/* Assistant Output Message (Pure clean MarkdownContent, NO card wrapper, matching apps/harness/desktop!) */}
                    {msg.content ? (
                      <div className="px-0.5 text-[14px] text-[#d4d4d4] leading-relaxed select-text font-sans">
                        <MarkdownContent
                          content={msg.content}
                          sourcesMap={sourcesMap}
                          onSourceClick={handleCitationClick}
                        />
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-white animate-pulse align-middle" />
                        )}
                      </div>
                    ) : null}

                    {/* Assistant Action Bar: Timestamp & Copy */}
                    {!msg.isStreaming && msg.content && (
                      <div className="flex items-center gap-2 pt-0.5 pl-0.5 text-[10.5px] font-mono text-[#777777] select-none">
                        {msg.createdAt && <span>{formatTimestamp(msg.createdAt)}</span>}
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                          title={t("copyMessage")}
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-[#34d399]" />
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

          {/* Sticky Bottom Chat Input Bar - Pinned right at bottom */}
          <div className="p-3 pt-1 shrink-0 bg-[#161616]/95 backdrop-blur-xs z-10 w-full">
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
        <DialogContent className="w-[90vw] max-w-[360px] p-5 rounded-2xl bg-[#1e1e20] border border-[#383838] text-white [&>button]:hidden font-sans">
          <DialogTitle className="text-sm font-semibold">{t("editLearn") || "Ubah Nama Notebook"}</DialogTitle>
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
              className="w-full px-3 py-2 text-xs bg-[#262628] border border-[#383838] rounded-xl text-white outline-none focus:border-[#555555]"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="px-3 py-1.5 text-xs text-[#969696] hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveTitle}
                className="px-3.5 py-1.5 text-xs bg-white hover:bg-neutral-200 text-[#141414] font-semibold rounded-lg transition-colors cursor-pointer"
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
        onSelectTool={handleSelectStudioTool}
        onDownloadArtifact={handleDownloadArtifact}
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
      {selectedSourceForPreview && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3"
          onClick={() => setSelectedSourceForPreview(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] bg-[#1c1c1e] border border-[#333336] rounded-2xl p-4 shadow-2xl flex flex-col text-left font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#2d2d30]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#252528] text-[#969696] border border-[#383838]">
                    {selectedSourceForPreview.type}
                  </span>
                  {selectedSourceForPreview.subpagesCount &&
                  selectedSourceForPreview.subpagesCount > 1 ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {selectedSourceForPreview.subpagesCount} pages
                    </span>
                  ) : null}
                </div>
                <h3 className="text-sm font-semibold text-white truncate">
                  {selectedSourceForPreview.title}
                </h3>
                {selectedSourceForPreview.url && (
                  <a
                    href={selectedSourceForPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline truncate block mt-0.5"
                  >
                    {selectedSourceForPreview.url}
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedSourceForPreview(null)}
                className="h-7 w-7 rounded-full bg-[#252528] hover:bg-[#333336] text-[#969696] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Extracted Text Content */}
            <div className="flex-1 overflow-y-auto mt-3 pr-1">
              <div className="flex items-center justify-between text-[11px] text-[#888888] mb-2">
                <span>Verified Source Content (Ground Truth):</span>
                <span>
                  {selectedSourceForPreview.content
                    ? `${selectedSourceForPreview.content.length.toLocaleString()} characters`
                    : "No text cached"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#141416] border border-[#28282b] text-[11px] font-mono text-[#d4d4d4] whitespace-pre-wrap leading-relaxed select-text max-h-[50vh] overflow-y-auto">
                {selectedSourceForPreview.content ||
                  "[Content is not cached locally. This source was added via link.]"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
