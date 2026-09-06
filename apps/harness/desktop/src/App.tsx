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
  type AttachedFile,
  formatFileSize,
} from "./components/workbench/chat-card";
import { ChatIndicator } from "./components/workbench/chat-indicator";
import { ImageLightbox } from "./components/workbench/image-lightbox";
import { MarkdownContent } from "./components/workbench/markdown-content";
import { ExecutionTrace, MutationsSummaryCard } from "./components/workbench/execution-trace";
import { ReviewDialog } from "./components/workbench/review-dialog";
import { SettingsView } from "./components/settings-view";
import { useAppAuth } from "./components/convex-provider";
import {
  loadConversations,
  saveConversation,
  deleteConversation,
  renameConversation,
  archiveConversation,
  unarchiveConversation,
  initConversationStore,
  generateFallbackTitle,
  generateAiTitle,
  type ConversationItem,
} from "./lib/conversation-store";
import type { FileMutationRecord, TraceStep } from "./vite-env";
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
  const [settingsTab, setSettingsTab] = useState<string>("model");
  const greeting = getGreeting();

  const handleOpenSettings = (tab: string = "model") => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  // Conversation history & state
  const [conversations, setConversations] = useState<ConversationItem[]>(() => {
    return loadConversations();
  });

  useEffect(() => {
    initConversationStore().then((list) => {
      setConversations(list);
    });
  }, []);

  const [conversationId, setConversationId] = useState<string>(
    () => `session_${Date.now()}`
  );
  const [conversationTitle, setConversationTitle] = useState<string>("");
  const [currentProject, setCurrentProject] = useState<string>(() => {
    return localStorage.getItem("const_harness_current_project") || "Outside Project";
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const executionStartTimeRef = React.useRef<number | null>(null);
  const [liveDurationMs, setLiveDurationMs] = useState<number>(0);

  useEffect(() => {
    if (!isExecuting) {
      setLiveDurationMs(0);
      return;
    }
    const interval = setInterval(() => {
      if (executionStartTimeRef.current) {
        setLiveDurationMs(Date.now() - executionStartTimeRef.current);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isExecuting]);

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
          className="group relative rounded-xl overflow-hidden border border-[#383838] hover:border-white/30 bg-black/40 max-w-sm max-h-72 shadow-md cursor-pointer transition-all"
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
          className="group relative rounded-xl overflow-hidden border border-[#383838] hover:border-white/30 bg-black max-w-sm max-h-72 shadow-md cursor-pointer transition-all"
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
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#383838] hover:border-white/20 text-xs text-[#d4d4d4] shadow-sm cursor-pointer transition-all"
      >
        <FileText className="w-4 h-4 text-[#ff7a00] shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate max-w-[200px]" title={att.name}>
            {att.name}
          </span>
          <span className="text-[10px] text-[#777777] font-mono">
            {formatFileSize(att.size)}
          </span>
        </div>
      </div>
    );
  };

  // Compute accumulated diff stats across assistant messages in this conversation
  const diffStats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const msg of messages) {
      if (msg.mutations) {
        for (const mut of msg.mutations) {
          if (mut.rolledBack) continue;
          if (mut.operation === "create") {
            additions += mut.newContent ? mut.newContent.split("\n").length : 1;
          } else if (mut.operation === "modify") {
            const prev = mut.previousContent ? mut.previousContent.split("\n").length : 0;
            const next = mut.newContent ? mut.newContent.split("\n").length : 0;
            if (next >= prev) {
              additions += next - prev + 1;
            } else {
              additions += 1;
              deletions += prev - next;
            }
          } else if (mut.operation === "delete") {
            deletions += mut.previousContent ? mut.previousContent.split("\n").length : 1;
          }
        }
      }
    }
    return { additions, deletions };
  }, [messages]);

  // Clean display project name (e.g. "small-web" instead of full path)
  const displayProject = useMemo(() => {
    if (currentProject === "Outside Project") return "";
    return currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject;
  }, [currentProject]);

  // Dynamic Context Usage computation (Image 3)
  const contextUsage = useMemo<ContextUsageData>(() => {
    const systemPromptTokens = 9200;
    const toolsTokens = 2400;

    // Estimate tokens dynamically from active conversation messages (chars / ~3.8)
    const messagesTokens = Math.round(
      messages.reduce((sum, msg) => {
        const contentChars = (msg.content || "").length;
        const thinkingChars = (msg.thinking || "").length;
        const toolCallsChars = msg.toolCalls ? JSON.stringify(msg.toolCalls).length : 0;
        return sum + (contentChars + thinkingChars + toolCallsChars) / 3.8;
      }, 0)
    );

    const totalTokens = 1_000_000;
    const usedTokens = systemPromptTokens + toolsTokens + messagesTokens;

    return {
      usedTokens,
      totalTokens,
      systemPromptTokens,
      toolsTokens,
      messagesTokens,
    };
  }, [messages]);

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
    const baseInputTokensPerTurn = 9200 + 2400;
    const messageInputTokens = Math.round(
      userMessages.reduce((sum, m) => sum + (m.content?.length || 0) / 3.8, 0)
    );
    const inputTokens = Math.max(
      11600,
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

  // Auto scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isExecuting]);

  // Handle agent streaming events from Electron main process
  useEffect(() => {
    if (!window.electron?.onAgentEvent) return;

    const unsubscribe = window.electron.onAgentEvent((event: any) => {
      if (event.type === "token") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
          const updated: ChatMessage = {
            ...last,
            content: last.content + (event.token || ""),
          };
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "thinking") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
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
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "tool_call") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
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
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "tool_result") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
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
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "file_mutation") {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (!last || last.role !== "assistant") return prev;
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
          const next = [...prev];
          next[lastIdx] = updated;
          return next;
        });
      } else if (event.type === "done") {
        setIsExecuting(false);
        const finalDuration = executionStartTimeRef.current
          ? Date.now() - executionStartTimeRef.current
          : undefined;
        executionStartTimeRef.current = null;

        setMessages((latest) => {
          const updatedLatest = [...latest];
          if (updatedLatest.length > 0) {
            const lastIdx = updatedLatest.length - 1;
            if (updatedLatest[lastIdx]?.role === "assistant") {
              const curContent = updatedLatest[lastIdx].content;
              const steps = (updatedLatest[lastIdx].traceSteps || []).map((st) => {
                if (st.type === "thought" && st.startTime && !st.durationMs) {
                  return {
                    ...st,
                    durationMs: Math.max(1000, Date.now() - st.startTime),
                  };
                }
                return st;
              });
              updatedLatest[lastIdx] = {
                ...updatedLatest[lastIdx],
                content: curContent || event.fullContent || "",
                durationMs: finalDuration,
                traceSteps: steps,
              };
            }
          }

          const stored = loadConversations();
          const target = stored.find((c) => c.id === conversationId);
          if (target) {
            target.messages = updatedLatest;
            target.updatedAt = Date.now();
            saveConversation(target);
            setConversations(loadConversations());
          }
          return updatedLatest;
        });
      } else if (event.type === "error") {
        setIsExecuting(false);
        executionStartTimeRef.current = null;
        toast.error(event.error || "Agent execution error");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [conversationId]);

  const handleSendMessage = async ({
    prompt,
    project,
    mode,
    model,
    thinkingLevel,
    attachments,
  }: {
    prompt: string;
    project: string;
    mode: "ask_before_changes" | "full_access";
    model?: string;
    thinkingLevel?: string;
    attachments?: AttachedFile[];
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
    setMessages([...currentStreamMessages, assistantPlaceholder]);
    setIsExecuting(true);
    executionStartTimeRef.current = Date.now();
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
        });

        if (!res.success && res.error) {
          toast.error(res.error);
          setIsExecuting(false);
        }
      } catch (err: any) {
        toast.error(err.message || "Communication error with agent");
        setIsExecuting(false);
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
        setIsExecuting(false);
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

  const handleAbort = async () => {
    if (window.electron?.abortAgent) {
      await window.electron.abortAgent();
    }
    setIsExecuting(false);
  };

  const handleNewChat = (targetProject?: string) => {
    if (isExecuting) {
      handleAbort();
    }
    setMessages([]);
    setConversationTitle("");
    setConversationId(`session_${Date.now()}`);
    setEditingPrompt("");
    setIsExecuting(false);
    if (targetProject) {
      setCurrentProject(targetProject);
      localStorage.setItem("const_harness_current_project", targetProject);
    }
  };

  const handleSelectConversation = (id: string) => {
    if (isExecuting) {
      handleAbort();
    }
    const target = conversations.find((c) => c.id === id);
    if (target) {
      setConversationId(target.id);
      setConversationTitle(target.title);
      setCurrentProject(target.project || "Outside Project");
      setMessages(target.messages || []);
      setEditingPrompt("");
      setIsExecuting(false);
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
    <div className="h-screen w-screen flex bg-[#2b2b2b] text-[#d4d4d4] overflow-hidden select-none">
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
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onArchiveConversation={handleArchiveConversation}
          onUnarchiveConversation={handleUnarchiveConversation}
          onOpenSettings={() => handleOpenSettings("model")}
        />
      )}

      {/* Main Content Area: Background #161616, text #d4d4d4, rounded only on left */}
      <main
        className={`flex-1 h-full bg-[#161616] text-[#d4d4d4] overflow-hidden flex flex-col relative transition-[border-radius] duration-200 ${
          isSidebarOpen ? "rounded-l-2xl sm:rounded-l-3xl border-l border-[#333333]/40" : ""
        }`}
      >
        {/* Top Window Toolbar */}
        <TopToolbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onNewChat={handleNewChat}
          conversationTitle={conversationTitle}
          project={displayProject}
          diffStats={diffStats}
        />

        {/* Dynamic Canvas: Landing Layout when 0 messages vs Active Stream Layout */}
        {messages.length === 0 ? (
          <div className="flex-1 relative flex flex-col items-center justify-center px-4 sm:px-8 pt-6 pb-6 overflow-y-auto">
            {/* Centered Conversation Container */}
            <div className="relative flex flex-col items-center w-full max-w-2xl z-10 translate-y-6 sm:translate-y-8">

              {/* Greeting Text: Color #d4d4d4 */}
              <h1 className="text-2xl sm:text-[28px] font-medium tracking-tight text-[#d4d4d4] text-center mb-6 z-10 font-sans">
                {greeting}
              </h1>

              {/* Floating Chat Input Card */}
              <div className="w-full z-10">
                <ChatCard
                  onSendMessage={handleSendMessage}
                  isExecuting={isExecuting}
                  onAbort={handleAbort}
                  contextUsage={contextUsage}
                  project={currentProject}
                  onProjectChange={setCurrentProject}
                  onOpenSettings={() => handleOpenSettings("model")}
                  initialPrompt={editingPrompt}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col relative">
            {/* Left Vertical Mini-Timeline Navigator (TurnTimelineNav matching const-harness) */}
            <ChatIndicator
              messages={messages}
              isExecuting={isExecuting}
              scrollContainerRef={chatScrollRef}
            />

            {/* Scrollable Message Stream with @const/ui ScrollArea */}
            <ScrollArea
              ref={chatScrollRef}
              data-chat-viewport="true"
              className="flex-1 w-full h-full [&>div>div[style]]:!block"
            >
              <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
                {messages.map((msg, idx) => (
                  <div key={msg.id} data-chat-anchor-key={msg.id} className="w-full flex flex-col">
                    {msg.role === "user" ? (
                      <div className="w-full flex flex-col items-end group">
                        {/* Attached Files (if any) */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2 justify-end max-w-2xl">
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
                                "max-w-2xl w-full rounded-2xl bg-[#222222] border border-[#383838] px-4 py-3 text-[14px] text-[#ececec] select-text leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] shadow-sm overflow-hidden transition-all duration-200",
                                isLongPrompt && !isExpanded && "cursor-pointer hover:border-[#484848]"
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
                        {/* User hover action bar: Timestamp (e.g. 8/16 01.00 AM), Copy, Edit */}
                        <div className="flex items-center gap-2 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[#888888] select-none">
                          <span className="text-[11px] font-mono text-[#777777]">
                            {formatMessageTimestamp(msg.timestamp)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
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
                            className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                            title="Edit message"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-2.5 max-w-3xl group">
                        <ExecutionTrace
                          thinking={msg.thinking}
                          toolCalls={msg.toolCalls}
                          traceSteps={msg.traceSteps}
                          mutations={msg.mutations}
                          isExecuting={isExecuting && idx === messages.length - 1}
                          durationMs={
                            isExecuting && idx === messages.length - 1
                              ? liveDurationMs
                              : msg.durationMs
                          }
                          onRollback={handleRollback}
                          onRollbackAll={handleRollbackAll}
                        />

                        {/* Formatted Markdown Content */}
                        {msg.content ? (
                          <div className="px-0.5">
                            <MarkdownContent content={msg.content} />
                          </div>
                        ) : null}

                        {/* Requirement 3: Changed Files Summary Card at the bottom of the chat message */}
                        {msg.mutations && msg.mutations.length > 0 && (
                          <MutationsSummaryCard
                            mutations={msg.mutations}
                            isExecuting={isExecuting && idx === messages.length - 1}
                            onRollback={handleRollback}
                            onRollbackAll={handleRollbackAll}
                            onOpenReview={() => setReviewingMutations(msg.mutations || null)}
                          />
                        )}

                        {/* Assistant hover action bar: Copy, Good, Bad, and Timestamp directly to the right of Bad response */}
                        {!isExecuting && msg.content && (
                          <div className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[#888888] select-none">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
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
                                "p-1 rounded hover:bg-white/10 transition-colors cursor-pointer",
                                feedbackMap[msg.id] === "good"
                                  ? "text-[#4ade80]"
                                  : "text-[#888888] hover:text-[#d4d4d4]"
                              )}
                              title="Good response"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(msg.id, "bad")}
                              className={cn(
                                "p-1 rounded hover:bg-white/10 transition-colors cursor-pointer",
                                feedbackMap[msg.id] === "bad"
                                  ? "text-[#ef4444]"
                                  : "text-[#888888] hover:text-[#d4d4d4]"
                              )}
                              title="Bad response"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[11px] font-mono text-[#777777] ml-1.5">
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

            {/* Anchored Bottom Chat Input (No dividing line!) */}
            <div className="w-full px-4 sm:px-8 pb-4 pt-2 flex justify-center bg-[#161616] shrink-0">
              <div className="w-full max-w-3xl">
                <ChatCard
                  compact
                  isExecuting={isExecuting}
                  onSendMessage={handleSendMessage}
                  onAbort={handleAbort}
                  contextUsage={contextUsage}
                  metrics={conversationMetrics}
                  project={currentProject}
                  onProjectChange={setCurrentProject}
                  onOpenSettings={() => handleOpenSettings("model")}
                  initialPrompt={editingPrompt}
                />
              </div>
            </div>
          </div>
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
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("const_harness_auth_token");
  });
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);

  // Set Accounts Hub URL: Default to production accounts.const.web.id
  const accountsBaseUrl =
    (import.meta.env.VITE_ACCOUNTS_URL as string) || "https://accounts.const.web.id";

  // Listen for deep link callback in Electron or browser redirect
  useEffect(() => {
    // 1. Electron deep-link listener
    if (window.electron?.onAuthCallback) {
      const unsubscribe = window.electron.onAuthCallback(
        (data: { url: string; token?: string }) => {
          if (data.token) {
            localStorage.setItem("const_harness_auth_token", data.token);
            setToken(data.token);
            setIsWaitingAuth(false);
          }
        }
      );
      return () => unsubscribe();
    }

    // 2. Storage event listener (sync across windows or tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_harness_auth_token" && e.newValue) {
        setToken(e.newValue);
        setIsWaitingAuth(false);
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Browser query param fallback (if tested in browser)
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get("token");
    if (urlToken) {
      localStorage.setItem("const_harness_auth_token", urlToken);
      setToken(urlToken);
      setIsWaitingAuth(false);
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
    const continueTarget = window.electron?.openExternal
      ? "const-harness://callback"
      : `${window.location.origin}${window.location.pathname}`;

    const base = accountsBaseUrl.replace(/\/+$/, "");
    const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&prompt=select_account`;
    setIsWaitingAuth(true);

    if (window.electron?.openExternal) {
      await window.electron.openExternal(targetUrl);
    } else {
      window.location.href = targetUrl;
    }
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

    const continueTarget = window.electron?.openExternal
      ? "const-harness://callback"
      : `${window.location.origin}${window.location.pathname}`;

    const base = accountsBaseUrl.replace(/\/+$/, "");
    const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&action=switch_account`;

    if (window.electron?.openExternal) {
      await window.electron.openExternal(targetUrl);
    } else {
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
    <div className="h-screen max-h-screen w-full overflow-hidden flex bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
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

          <div className="mt-8 space-y-4">
            <Button
              onClick={handleSignIn}
              size="lg"
              className="w-full h-12 rounded-xl text-sm font-medium gap-2 cursor-pointer transition-all active:scale-[0.99]"
            >
              <LogIn className="h-4 w-4" />
              {isWaitingAuth ? "Return to Login Tab" : "Sign in to Const Harness"}
            </Button>
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
