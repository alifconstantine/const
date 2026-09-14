import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, type LocalMessage, type LocalArtifact, type LocalChatSession } from "../../lib/db";
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
import { HistoryPanel } from "./history-panel";
import { ThinkingProcess } from "./working-process";
import { ImageLightbox } from "./image-lightbox";
import { ScrollArea, cn, toast } from "@const/ui";
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
  Sparkles,
  Brain,
  Download,
  Package,
  Copy,
  Loader2,
  History,
  MessageCirclePlus,
  Pencil,
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
    hasBadge: true,
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
}

export function MobileLearnWorkspace({
  learnId,
  initialSourceModalOpen = false,
  onBack,
  onCreateNew,
  onSelectLearn,
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

  // Navigation tabs: sources, chat, tools
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
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(initialSourceModalOpen);
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
      targetSessionId = await localDb.createChatSession(learnId, defaultName);
      setActiveSessionId(targetSessionId);
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
      await localDb.saveMessage({
        id: userMsgId,
        learnId,
        sessionId: targetSessionId,
        role: "user",
        content: textToSend,
        attachments: processedAttachments,
        createdAt: now,
      });
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
    } catch {
      // Errors handled in onError callback
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

  const currentModel =
    availableModels.find((m) => m.id === selectedModelId) ??
    availableModels[0] ??
    DEFAULT_MOBILE_MODELS[0]!;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#161616] text-[#d4d4d4] overflow-hidden select-none">
      {/* Top Mobile Header (Level 1 Header Well: #222222 per DESIGN.md) */}
      <header className="h-14 px-4 bg-[#222222] border-b border-[#383838] flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-8 w-8 rounded-xl hover:bg-[#2b2b2b] text-[#969696] hover:text-[#ffffff] flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-transparent hover:border-[#383838]"
            aria-label={t("backToHome")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {isEditingTitle ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className="text-[13px] font-medium text-[#ffffff] bg-[#2b2b2b] rounded-xl px-2.5 py-1 outline-none border border-[#383838] max-w-[170px]"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="h-7 w-7 rounded-xl bg-[#0066ff] text-[#ffffff] flex items-center justify-center cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-[14px] font-sans font-medium text-[#d4d4d4] hover:text-[#ffffff] hover:bg-[#2b2b2b] px-2.5 py-1 rounded-xl transition-colors cursor-pointer text-left truncate max-w-[180px]"
              title={t("clickToRename")}
            >
              {titleValue}
            </button>
          )}
        </div>

        {/* Right actions: New Chat (left, primary accent) & History (right, muted) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleNewChat}
            className="h-8 w-8 rounded-xl bg-[#0066ff] hover:bg-[#0055dd] text-[#ffffff] flex items-center justify-center transition-all duration-150 cursor-pointer border border-[#0066ff]/80 shadow-xs active:scale-95"
            title={t("newChat") || "Chat Baru"}
            aria-label={t("newChat") || "Chat Baru"}
          >
            <MessageCirclePlus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="h-8 w-8 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] text-[#969696] hover:text-[#ffffff] flex items-center justify-center transition-colors cursor-pointer border border-[#383838] active:scale-95"
            title={t("chatHistory") || "Riwayat Chat"}
            aria-label={t("chatHistory") || "Riwayat Chat"}
          >
            <History className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area Based on Active Tab */}
      {activeTab === "chat" ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 max-w-lg mx-auto w-full relative">
          {/* Top Model Selector Pill */}
          <div className="flex items-center justify-between px-4 py-2 select-none shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-xs font-medium text-[#d4d4d4] transition-colors duration-150 cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-[#0066ff]" />
                <span>{currentModel.name}</span>
                <ChevronDown className="h-3 w-3 text-[#969696]" />
              </button>

              {isModelDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-[#222222] border border-[#383838] p-1.5 z-50 animate-in fade-in duration-100">
                  {availableModels.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModelId(m.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex flex-col cursor-pointer transition-colors ${
                        selectedModelId === m.id
                          ? "bg-[#2b2b2b] text-[#ffffff] font-medium"
                          : "text-[#969696] hover:text-[#d4d4d4] hover:bg-[#2b2b2b]/50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-sans">{m.name}</span>
                        {selectedModelId === m.id && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#0066ff]" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#5d5d5d] mt-0.5">
                        {m.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Conversation Stream */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-5 min-h-0">
            {messages.map((msg) => (
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
                                    <FileText className="w-3 h-3 text-[#0066ff] shrink-0" />
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
                        <MarkdownContent content={msg.content} />
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#0066ff] animate-pulse align-middle" />
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
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Sticky Bottom Chat Input Bar - Pinned right above bottom nav */}
          <div className="p-3 pt-1 shrink-0 bg-[#161616]/95 backdrop-blur-xs z-10 w-full">
            <ChatInputCard
              inputMessage={inputMessage}
              onChangeInput={setInputMessage}
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              selectedModelName={currentModel.name}
              sourcesCount={learn?.sourcesCount || 0}
              onOpenSources={() => setIsAddSourceOpen(true)}
              attachments={attachedFiles}
              onAttachmentsChange={setAttachedFiles}
              onPreviewMedia={setLightboxItem}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-20">
          {/* TAB 1: SOURCES */}
          {activeTab === "sources" && (
            <div className="p-4 space-y-4 max-w-lg mx-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#ffffff]">{t("learningSources")}</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#222222] border border-[#383838] text-[#969696] font-mono">
                  {(learn?.sourcesCount || 0) === 1
                    ? t("sourcesCountSingle")
                    : t("sourcesCount", { count: learn?.sourcesCount || 0 })}
                </span>
              </div>

              {/* "+ Add source" Button */}
              <button
                type="button"
                onClick={() => setIsAddSourceOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#383838] hover:border-[#5d5d5d] bg-[#2b2b2b] hover:bg-[#383838] text-xs font-medium text-[#d4d4d4] hover:text-[#ffffff] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{t("addSource")}</span>
              </button>

              {/* Search Box */}
              <div className="w-full bg-[#222222] rounded-xl p-3 border border-[#383838] focus-within:border-[#5d5d5d] transition-all text-left">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchWebSources")}
                  className="w-full bg-transparent text-xs text-[#d4d4d4] placeholder:text-[#5d5d5d] outline-none px-1 py-1"
                />
                <div className="flex items-center justify-between mt-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setWebScope(webScope === "Web" ? "Journal" : "Web")}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-[11px] text-[#969696] hover:text-[#d4d4d4] transition-colors cursor-pointer border border-[#383838]"
                    >
                      <Globe className="h-2.5 w-2.5" />
                      <span>{webScope === "Web" ? t("webScopeWeb") : t("webScopeJournal")}</span>
                      <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setResearchSpeed(
                          researchSpeed === "Fast Research" ? "Deep Research" : "Fast Research"
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-[11px] text-[#969696] hover:text-[#d4d4d4] transition-colors cursor-pointer border border-[#383838]"
                    >
                      <Search className="h-2.5 w-2.5" />
                      <span>
                        {researchSpeed === "Fast Research" ? t("speedFast") : t("speedDeep")}
                      </span>
                      <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="h-6 w-6 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-[#969696] hover:text-[#ffffff] flex items-center justify-center transition-colors cursor-pointer border border-[#383838]"
                    aria-label={t("search")}
                  >
                    <Search className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Empty State */}
              <div className="flex flex-col items-center justify-center text-center p-6 min-h-[200px] border border-[#2e2e2e] rounded-xl bg-[#1b1b1b]">
                <div className="h-10 w-10 rounded-xl bg-[#222222] border border-[#383838] flex items-center justify-center text-[#969696] mb-3">
                  <FileText className="h-5 w-5 stroke-[1.5]" />
                </div>
                <h3 className="text-xs font-medium text-[#ffffff] mb-1">
                  {t("emptySourcesTitle")}
                </h3>
                <p className="text-[11px] text-[#969696] leading-relaxed max-w-[240px] mb-3">
                  {t("emptySourcesDescription")}
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddSourceOpen(true)}
                  className="text-xs text-[#0066ff] hover:underline transition-colors cursor-pointer"
                >
                  + {t("addFirstSource")}
                </button>
              </div>
            </div>
          )}

        {/* TAB 3: TOOLS (STUDIO & ARTIFACTS) */}
        {activeTab === "tools" && (
          <div className="p-4 space-y-5 max-w-lg mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#ffffff]">{t("studioTools")}</span>
            </div>

            {/* 2-Column Grid of Tools (8 Tools, Matching Reference UI) */}
            <div className="grid grid-cols-2 gap-2.5">
              {STUDIO_TOOLS.map((tool) => {
                const Icon = tool.icon;
                const toolTitle = toolNameMap[tool.id] || tool.name;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      setActiveTab("chat");
                      if (tool.id === "browser") {
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
                    }}
                    className={`p-3 rounded-2xl border ${tool.cardBg} ${tool.borderColor} ${tool.hoverBg} ${tool.hoverBorder} transition-all flex flex-col justify-between h-[86px] text-left cursor-pointer active:scale-98 shadow-xs`}
                  >
                    {/* Top Row: Icon + Badge on left, Chevron on right */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 ${tool.iconColor} shrink-0`} />
                        {tool.hasBadge && (
                          <span className="bg-[#ededed] text-[#141414] text-[9.5px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-2xs">
                            {t("badgeNew")}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-[#888888]/60 shrink-0" />
                    </div>

                    {/* Bottom Row: Tool Title */}
                    <span className={`text-xs font-medium ${tool.textColor || "text-[#ffffff]"} tracking-tight leading-snug line-clamp-2 mt-auto`}>
                      {toolTitle}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Artifacts / Downloads Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-[#ffffff]">
                  {t("artifacts")}
                </span>
                {artifacts && artifacts.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#222222] border border-[#383838] font-mono text-[#969696]">
                    {artifacts.length === 1
                      ? t("filesCountSingle")
                      : t("filesCount", { count: artifacts.length })}
                  </span>
                )}
              </div>

              {artifacts && artifacts.length > 0 ? (
                <div className="space-y-2">
                  {artifacts.map((art) => (
                    <div
                      key={art.id}
                      className="p-3 rounded-xl bg-[#222222] border border-[#383838] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {art.isZip ? (
                          <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#d4d4d4] truncate">
                            {art.title}
                          </div>
                          <div className="text-[10px] text-[#969696] font-mono">
                            {art.isZip ? "ZIP Archive / Folder" : art.type}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadArtifact(art)}
                        className="h-8 px-3 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-[#ffffff] text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-[#383838] shrink-0"
                      >
                        <Download className="h-3 w-3" />
                        <span>{t("download")}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 rounded-xl border border-[#2e2e2e] bg-[#1b1b1b] min-h-[140px]">
                  <div className="h-9 w-9 rounded-xl bg-[#222222] border border-[#383838] flex items-center justify-center text-[#969696] mb-2.5">
                    <PenTool className="h-4 w-4 stroke-[1.5]" />
                  </div>
                  <h3 className="text-xs font-medium text-[#ffffff] mb-1">
                    {t("noArtifactsSaved")}
                  </h3>
                  <p className="text-[11px] text-[#969696] leading-relaxed max-w-[240px]">
                    {t("noArtifactsSavedDesc")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR (Sources, Chat, Studio) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#222222] border-t border-[#383838] flex items-center justify-around px-4 z-20">
        {/* Tab 1: Sources */}
        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors cursor-pointer ${
            activeTab === "sources"
              ? "text-[#0066ff] font-medium"
              : "text-[#969696] hover:text-[#d4d4d4]"
          }`}
        >
          <FolderOpen className="h-5 w-5" />
          <span className="text-[10px] mt-1 tracking-tight">{t("sources")}</span>
        </button>

        {/* Tab 2: Chat */}
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors cursor-pointer ${
            activeTab === "chat"
              ? "text-[#0066ff] font-medium"
              : "text-[#969696] hover:text-[#d4d4d4]"
          }`}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-[10px] mt-1 tracking-tight">{t("chat")}</span>
        </button>

        {/* Tab 3: Tools */}
        <button
          type="button"
          onClick={() => setActiveTab("tools")}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors cursor-pointer ${
            activeTab === "tools"
              ? "text-[#0066ff] font-medium"
              : "text-[#969696] hover:text-[#d4d4d4]"
          }`}
        >
          <LayoutGrid className="h-5 w-5" />
          <span className="text-[10px] mt-1 tracking-tight">{t("studioTitle")}</span>
        </button>
      </nav>

      {/* Add Source Pop-up Modal */}
      <AddSourceDialog
        open={isAddSourceOpen}
        onOpenChange={setIsAddSourceOpen}
        onSelectSource={(sourceType) => {
          setIsAddSourceOpen(false);
        }}
      />

      {/* Chat History Panel (Drawer matching apps/router generation) */}
      <HistoryPanel
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions || []}
        activeChatId={activeSessionId}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onTogglePinChat={handleTogglePinChat}
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
    </div>
  );
}
