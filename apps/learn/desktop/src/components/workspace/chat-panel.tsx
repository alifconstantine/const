import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
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
} from "lucide-react";
import {
  ScrollArea,
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@const/ui";
import { DEFAULT_MODELS } from "@const/agent/models";
import type { ModelConfig, AgentMessage } from "@const/agent/types";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb } from "../../lib/db";
import { useI18n } from "../../lib/i18n";
import { ChatHistoryPanel } from "./chat-history-panel";
import { ExecutionTrace, type DisplayToolCall } from "./execution-trace";
import { MarkdownContent } from "./markdown-content";

interface ChatPanelProps {
  learnId?: string;
  workspacePath?: string;
  sourcesCount?: number;
  onSelectPromptChip?: (prompt: string) => void;
  onSendMessage?: (message: string) => void;
  onAddSource?: () => void;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  thinking?: string;
  toolCalls?: DisplayToolCall[];
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
  path?: string;
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

export function ChatPanel({
  learnId,
  workspacePath,
  sourcesCount = 0,
  onSelectPromptChip,
  onAddSource,
}: ChatPanelProps) {
  const { t, language } = useI18n();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("gemini-3.6-flash");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>(DEFAULT_MODELS);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Attachments state
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isMultiline, setIsMultiline] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Input change handler ensuring reliable return to single-line pill when empty
  const handleInputChange = (val: string) => {
    setInputMessage(val);

    // 1. When text is empty and no attachments, immediately return to single-line pill
    if (!val.trim() && attachments.length === 0) {
      if (isMultiline) {
        setIsMultiline(false);
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      return;
    }

    // 2. When text contains newline, switch to multi-line mode
    if (val.includes("\n")) {
      if (!isMultiline) {
        setIsMultiline(true);
      }
      return;
    }

    // 3. When in multi-line mode but text has shrunk to a short single line (< 35 chars) without attachments, collapse back
    if (isMultiline && val.length < 35 && attachments.length === 0) {
      setIsMultiline(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      return;
    }
  };

  // Auto-grow textarea height calculation (only applies to multi-line mode)
  const adjustHeight = () => {
    if (!isMultiline) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const viewport = textarea.closest(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    const prevScrollTop = viewport ? viewport.scrollTop : 0;

    textarea.style.height = "auto";
    const nextHeight = Math.max(48, textarea.scrollHeight);
    textarea.style.height = `${nextHeight}px`;

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

  useEffect(() => {
    if (isMultiline) {
      adjustHeight();
    } else if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputMessage, attachments.length, isMultiline]);

  // Focus textarea and position cursor at end when switching between single-line and multi-line
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isMultiline]);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutsideDropdown =
        !dropdownRef.current || !dropdownRef.current.contains(target);
      const isOutsideSourcesDropdown =
        !sourcesDropdownRef.current || !sourcesDropdownRef.current.contains(target);

      if (isOutsideDropdown) {
        setIsModelDropdownOpen(false);
      }
      if (isOutsideSourcesDropdown) {
        setIsSourcesDropdownOpen(false);
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
  const currentModel = models.find((m) => m.id === selectedModelId) || models[0]!;

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
        if (prev.length === 0) return prev;
        const lastIndex = prev.length - 1;
        const lastMsg = prev[lastIndex];

        if (!lastMsg || lastMsg.role !== "assistant") return prev;

        const updated: DisplayMessage = { ...lastMsg };

        if (event.type === "token") {
          updated.content = (updated.content || "") + event.token;
        } else if (event.type === "thinking") {
          updated.thinking = (updated.thinking || "") + event.thinking;
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
        } else if (event.type === "error") {
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
              createdAt: updated.createdAt,
            });
          }
        } else if (event.type === "done") {
          if (event.fullContent && !updated.content) {
            updated.content = event.fullContent;
          } else if (!updated.content && updated.toolCalls && updated.toolCalls.length > 0) {
            const toolSummary = updated.toolCalls
              .map((tc) => `- \`${tc.name}\`: ${tc.status === "completed" ? (language === "id" ? "Selesai" : "Completed") : (language === "id" ? "Gagal" : "Failed")}`)
              .join("\n");
            updated.content = language === "id"
              ? `Selesai menjalankan langkah-langkah tugas:\n\n${toolSummary}`
              : `Completed running task steps:\n\n${toolSummary}`;
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
              createdAt: updated.createdAt,
            });
          }
        }

        activeAssistantRef.current = updated;
        const newArr = [...prev];
        newArr[lastIndex] = updated;
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttached: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
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

      newAttached.push({
        id: `att_${Date.now()}_${i}`,
        name: file.name,
        size: file.size,
        type: kind,
        url: kind === "image" || kind === "video" ? URL.createObjectURL(file) : undefined,
        path: (file as any).path,
      });
    }

    setAttachments((prev) => [...prev, ...newAttached]);
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
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || isStreaming) return;

    // 1. Ensure we have an active session
    let currentSessionId = activeSessionId;
    if (!currentSessionId && learnId) {
      currentSessionId = await localDb.createSession(learnId, t("newSessionTitle"));
      setActiveSessionId(currentSessionId);
    }

    // 2. Auto-generate title if this is the first message in the session
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
        await localDb.updateSessionTitle(currentSessionId, fallbackTitle);

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
                localDb.updateSessionTitle(currentSessionId, aiTitle);
              }
            })
            .catch(() => {});
        }
      }
    }

    const now = Date.now();
    const userMsgId = `user_${now}`;
    const assistantMsgId = `asst_${now + 1}`;

    // Append attachments summary to user prompt if any were added
    let promptWithAttachments = textToSend;
    if (attachments.length > 0) {
      const attLabel = language === "id" ? "Lampiran" : "Attachment";
      const attList = attachments
        .map((a) => `- [${attLabel}: ${a.name} (${formatFileSize(a.size)})]`)
        .join("\n");
      promptWithAttachments = `${promptWithAttachments}\n\n${attList}`;
    }

    // Append active/carried sources summary if any
    if (carriedSources.length > 0) {
      const srcLabel = language === "id" ? "Sumber" : "Source";
      const refLabel = language === "id" ? "Referensi Sumber Dibawa" : "Carried Source References";
      const sourceList = carriedSources
        .map((s) => `- [${srcLabel}: ${s.title} (${s.type}${s.url ? ` - ${s.url}` : ""})]`)
        .join("\n");
      promptWithAttachments = `${promptWithAttachments}\n\n${refLabel}:\n${sourceList}`;
    }

    const newUserMsg: DisplayMessage = {
      id: userMsgId,
      role: "user",
      content: promptWithAttachments,
      createdAt: now,
    };

    const newAssistantMsg: DisplayMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinking: "",
      toolCalls: [],
      isStreaming: true,
      createdAt: now + 1,
    };

    // 3. Persist user message to Dexie
    if (learnId) {
      await localDb.saveMessage({
        id: userMsgId,
        learnId,
        sessionId: currentSessionId || undefined,
        role: "user",
        content: promptWithAttachments,
        createdAt: now,
      });
    }

    const nextMessages = [...messages, newUserMsg];
    setMessages([...nextMessages, newAssistantMsg]);
    setInputMessage("");
    setIsMultiline(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setAttachments([]);
    setIsStreaming(true);
    streamStartTimeRef.current = Date.now();
    activeAssistantRef.current = newAssistantMsg;

    const electron = (window as any).electron;

    // 4. Build high-fidelity multi-turn message payload matching OpenAPI / Const specification
    const formattedMessages: any[] = [];
    for (const m of nextMessages) {
      if (m.role === "user") {
        formattedMessages.push({ role: "user", content: m.content });
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
        } else {
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

        const res = await electron.agent.sendMessage({
          messages: formattedMessages,
          model: selectedModelId,
          workspacePath: workspacePath,
          learnId: learnId,
          authToken: authToken || undefined,
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
            await localDb.saveMessage({
              id: assistantMsgId,
              learnId,
              sessionId: currentSessionId || undefined,
              role: "assistant",
              content: errorContent,
              createdAt: now + 1,
            });
          }
          setIsStreaming(false);
        } else if (res && res.success) {
          setIsStreaming(false);
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
                }
                const finalized = {
                  ...msg,
                  content: finalContent,
                  durationMs: finalDuration,
                  isStreaming: false,
                };
                if (learnId && finalized.content) {
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
          await localDb.saveMessage({
            id: assistantMsgId,
            learnId,
            sessionId: currentSessionId || undefined,
            role: "assistant",
            content: errorContent,
            createdAt: now + 1,
          });
        }
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
                content:
                  "You are Const Learn Agent, an expert autonomous coding and learning assistant. You help users understand concepts, analyze files, and write clean, robust code.",
              },
              ...formattedMessages,
            ],
            stream: true,
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

  const handleClearHistory = async () => {
    if (learnId) {
      await localDb.clearMessages(learnId, activeSessionId || undefined);
    }
    setMessages([]);
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

  const renderSourcesDropdown = () => (
    <div className="relative" ref={sourcesDropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsSourcesDropdownOpen(!isSourcesDropdownOpen);
        }}
        className={cn(
          "h-8 px-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer select-none flex items-center gap-1.5 border shrink-0 shadow-xs active:scale-98",
          carriedSourcesCount > 0
            ? "bg-muted/60 hover:bg-muted border-border/70 text-foreground"
            : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/50"
        )}
        aria-label={t("manageCarriedSources")}
        title={t("manageCarriedSources")}
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono text-[11px] text-foreground/90 font-medium">
          {carriedSourcesCount > 1
            ? t("carriedSourcesPill", { count: carriedSourcesCount })
            : carriedSourcesCount === 1
            ? t("carriedSourcesPillSingle")
            : t("sourcesCountNone")}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground/70 transition-transform duration-150 ml-0.5",
            isSourcesDropdownOpen && "rotate-180"
          )}
        />
      </button>

      {isSourcesDropdownOpen && (
        <div
          className="absolute top-full right-0 mt-1.5 w-72 sm:w-80 rounded-2xl bg-card border border-border shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1.5 pb-2 mb-1.5 border-b border-border/50">
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
          <div className="max-h-48 overflow-y-auto space-y-1 py-0.5">
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

          {/* Footer action: Add new source */}
          {onAddSource && (
            <div className="pt-2 mt-1.5 border-t border-border/40">
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
        </div>
      )}
    </div>
  );

  const renderModelDropdown = () => (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsModelDropdownOpen(!isModelDropdownOpen);
        }}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-muted/70 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none shrink-0"
        aria-label={t("selectAiModel")}
        title={t("selectAiModel")}
      >
        <span className="text-[12px] font-medium text-foreground/80">
          {currentModel.displayName.split("(")[0]?.trim() || "Const"}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground/70 transition-transform duration-150 ml-0.5",
            isModelDropdownOpen && "rotate-180"
          )}
        />
      </button>

      {isModelDropdownOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 w-64 rounded-2xl bg-card border border-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider border-b border-border/40 mb-1">
            {t("selectAiModel")}
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedModelId(m.id);
                  setIsModelDropdownOpen(false);
                }}
                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  selectedModelId === m.id
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <div>
                  <div className="font-medium text-foreground">{m.displayName}</div>
                  <div className="text-[10px] text-muted-foreground/70 font-mono">
                    {m.id}
                  </div>
                </div>
                {selectedModelId === m.id && (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

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
          type="submit"
          disabled={!hasInput}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-xs active:scale-95",
            hasInput
              ? "bg-[#1a73e8] hover:bg-[#1557b0] text-white"
              : "bg-muted/60 text-muted-foreground/40 cursor-not-allowed"
          )}
          aria-label={t("sendMessage")}
        >
          <ArrowUp className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>
    );
  };

  const renderPlusButton = () => (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="h-8 w-8 rounded-full hover:bg-muted/70 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
        title={t("attachFileMedia")}
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

  const renderAttachmentsShelf = () => {
    if (attachments.length === 0) return null;
    return (
      <div className="flex items-center gap-2 px-1 pt-1 pb-1.5 overflow-x-auto select-none border-b border-border/40">
        {attachments.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border/60 text-xs text-foreground shrink-0"
          >
            {file.type === "image" ? (
              <ImageIcon className="w-3 h-3 text-primary shrink-0" />
            ) : (
              <FileText className="w-3 h-3 text-primary shrink-0" />
            )}
            <span className="truncate max-w-[120px] font-medium text-[11px]">
              {file.name}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              ({formatFileSize(file.size)})
            </span>
            <button
              type="button"
              onClick={() => removeAttachment(file.id)}
              className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="flex-1 h-full flex flex-col bg-card rounded-2xl border border-border/50 text-foreground min-w-0 relative select-text overflow-hidden shadow-xs">
      {/* Top Header Bar */}
      <div className="h-12 px-4 sm:px-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/30">
        {/* Left: Project / Workspace Folder Indicator */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (workspacePath && (window as any).electron?.openPath) {
                (window as any).electron.openPath(workspacePath);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted text-xs font-medium text-foreground transition-all cursor-pointer border border-border/60 max-w-[200px] sm:max-w-[280px] truncate group select-none shadow-xs active:scale-98 shrink-0"
            title={
              workspacePath
                ? t("openInExplorer", { path: workspacePath })
                : `${t("defaultWorkspace")} (~/.const/learn/workspaces/)`
            }
          >
            <Folder className="h-3.5 w-3.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
            <span className="truncate font-mono text-[11px]">
              {workspacePath
                ? workspacePath.split(/[\\/]/).filter(Boolean).pop() || workspacePath
                : t("defaultWorkspace")}
            </span>
          </button>
        </div>

        {/* Right Header Actions: Sources Indicator, New Chat, History, More Options */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sources Dropdown Indicator */}
          {renderSourcesDropdown()}

          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleNewChat}
            className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer border border-border/60 bg-muted/40 shadow-xs active:scale-98 shrink-0"
            title={t("startConversationNew")}
            aria-label={t("newChat")}
          >
            <MessageCirclePlus className="h-4 w-4 stroke-[1.8]" />
          </button>

          {/* History Button */}
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="relative h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer border border-border/60 bg-muted/40 shadow-xs active:scale-98 shrink-0"
            title={t("chatHistory")}
            aria-label={t("chatHistory")}
          >
            <History className="h-4 w-4 stroke-[1.8]" />
            {sessions.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-1 rounded-full bg-secondary text-[9px] font-mono font-medium text-foreground flex items-center justify-center border border-border/60">
                {sessions.length > 99 ? "99+" : sessions.length}
              </span>
            )}
          </button>

          {/* More Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer border border-border/60 bg-muted/40 shadow-xs active:scale-98 shrink-0"
                aria-label={t("moreOptions")}
                title={t("moreOptions")}
              >
                <MoreVertical className="h-4 w-4 stroke-[1.8]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5 shadow-xl bg-card border border-border z-50">
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
                  <span>Buka Folder Workspace</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Conversation Stream using Radix ScrollArea */}
      <ScrollArea className="flex-1 w-full" viewportClassName="px-4 sm:px-8 py-6 max-w-3xl mx-auto w-full">
        {messages.length === 0 ? (
          /* Welcome Empty State */
          <div className="flex-1 flex flex-col justify-center my-auto py-10">
            <div className="text-3xl sm:text-4xl mb-3 select-none">👋</div>

            <h1 className="text-2xl sm:text-3xl font-sans font-medium tracking-tight text-foreground mb-2">
              {t("welcomeNotebookTitle")}
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4 max-w-xl font-sans">
              {t("welcomeNotebookDesc")}
            </p>

            <p className="text-xs text-muted-foreground/80 font-medium mb-3 font-sans">
              {t("welcomeNotebookPrompt")}
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 font-sans">
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
                  className="px-4 py-2 rounded-full bg-muted/60 hover:bg-muted border border-border/50 text-xs text-foreground transition-all cursor-pointer shadow-xs active:scale-98"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-6 w-full pb-4">
            {messages.map((msg, idx) => {
              const isAssistant = msg.role === "assistant";
              const isUser = msg.role === "user";
              const isLatestAssistant = isAssistant && isStreaming && idx === messages.length - 1;

              if (isUser) {
                return (
                  <div key={msg.id} className="flex flex-col items-end w-full group">
                    <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-muted/80 text-foreground px-4 py-2.5 text-[13.5px] border border-border/60 shadow-xs leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>

                    {/* User hover action bar: Timestamp and Copy */}
                    <div className="flex items-center gap-2 pt-1.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground select-none font-sans">
                      {msg.createdAt && (
                        <span className="text-[11px] font-mono text-muted-foreground/70">
                          {formatMessageTimestamp(msg.createdAt)}
                        </span>
                      )}
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
                    isExecuting={isLatestAssistant}
                    durationMs={isLatestAssistant ? liveDurationMs : msg.durationMs}
                    onAnswerQuestion={handleAnswerQuestion}
                  />

                  {/* Formatted Markdown Content Bubble */}
                  {msg.content ? (
                    <div className="px-0.5">
                      <MarkdownContent content={msg.content} />
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
      <div className="p-4 sm:p-5 shrink-0 max-w-3xl mx-auto w-full font-sans">
        {isMultiline || attachments.length > 0 ? (
          /* Multi-line Mode (Image 3): Rounded card with top-level textarea inside ScrollArea + bottom toolbar */
          <form
            key="chat-input-multi"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="w-full bg-card dark:bg-[#1e1f20] rounded-3xl border border-border/70 focus-within:border-foreground/30 transition-colors p-3 sm:p-3.5 shadow-md flex flex-col gap-2.5"
          >
            {renderAttachmentsShelf()}

            {/* Top: Full-width Textarea with ScrollArea & max height */}
            <ScrollArea
              className="w-full max-h-48 sm:max-h-60 [&>div>div[style]]:!block"
              viewportClassName="pr-1.5"
            >
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => {
                  handleInputChange(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                disabled={isStreaming}
                placeholder={
                  isStreaming
                    ? t("inputStreamingPlaceholder")
                    : t("inputPlaceholder")
                }
                className="w-full resize-none bg-transparent text-[14px] leading-[1.65] text-foreground placeholder:text-muted-foreground/60 outline-none font-sans py-0.5 block disabled:opacity-50 min-h-[48px]"
              />
            </ScrollArea>

            {/* Bottom Row: Plus on left, Model Dropdown + Send button on right */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 shrink-0">
                {renderPlusButton()}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {renderModelDropdown()}
                {renderSendButton()}
              </div>
            </div>
          </form>
        ) : (
          /* Single-line Mode (Image 2): Compact pill shape with plus on left, input in center, model + send on right */
          <form
            key="chat-input-single"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="w-full bg-card dark:bg-[#1e1f20] rounded-full border border-border/70 focus-within:border-foreground/30 transition-colors px-3 py-1.5 sm:py-2 shadow-md flex items-center gap-2.5"
          >
            {renderPlusButton()}

            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => {
                const val = e.target.value;
                handleInputChange(val);
                if (e.target.scrollHeight > 30 || val.includes("\n")) {
                  setIsMultiline(true);
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.includes("\n") || text.length > 50) {
                  setIsMultiline(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                } else if (e.key === "Enter" && e.shiftKey) {
                  setIsMultiline(true);
                }
              }}
              rows={1}
              disabled={isStreaming}
              placeholder={
                isStreaming
                  ? t("inputStreamingPlaceholder")
                  : t("inputPlaceholder")
              }
              className="flex-1 bg-transparent text-[14px] leading-5 text-foreground placeholder:text-muted-foreground/60 outline-none font-sans resize-none overflow-hidden h-[28px] max-h-[28px] py-1 block disabled:opacity-50"
            />

            <div className="flex items-center gap-2 shrink-0">
              {renderModelDropdown()}
              {renderSendButton()}
            </div>
          </form>
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
    </main>
  );
}
