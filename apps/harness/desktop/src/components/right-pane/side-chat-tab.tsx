import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  ArrowUpRight,
  RotateCcw,
} from "lucide-react";
import { ScrollArea, cn, toast } from "@const/ui";
import type { RightPaneTab } from "./types";
import type { FileMutationRecord, TraceStep } from "../../vite-env";
import { ChatCard, type AttachedFile } from "../workbench/chat-card";
import { MarkdownContent } from "../workbench/markdown-content";
import { ExecutionTrace } from "../workbench/execution-trace";
import { AssistantResponse } from "../intelligence-ui/assistant-response";
import { assistantResponseToText, updateIntelligenceUiState } from "../intelligence-ui/protocol";
import type { IntelligenceUiState } from "../intelligence-ui/schema";
import {
  loadSideConversation,
  saveSideConversation,
  deleteSideConversation,
  loadConversations,
  type ConversationItem,
} from "../../lib/conversation-store";
import { resolveMentionedSessionsInPrompt } from "../../lib/mention-search";
import { useTranslation } from "../../lib/i18n";

export interface SideChatMessage {
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
  intelligenceUiState?: IntelligenceUiState;
  attachments?: AttachedFile[];
}

interface SideChatTabProps {
  tab: RightPaneTab;
  parentMessages?: any[];
  parentConversationTitle?: string;
  parentConversationId?: string;
  defaultModel?: string;
  onOpenFilePreview?: (filePath: string) => void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
  onRollbackFile?: (record: FileMutationRecord) => void;
  onRollbackAll?: (records: FileMutationRecord[]) => void;
  onInsertToMainPrompt?: (text: string) => void;
  onUpdateTab?: (tabId: string, updates: Partial<RightPaneTab>) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  conversations?: ConversationItem[];
}

function formatMessageTimestamp(ts: number): string {
  const d = new Date(ts);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function SideChatTab({
  tab,
  parentMessages = [],
  parentConversationTitle,
  parentConversationId,
  defaultModel,
  onOpenFilePreview,
  onOpenFileDiff,
  onRollbackFile,
  onRollbackAll,
  onInsertToMainPrompt,
  onUpdateTab,
  onOpenTrajectory,
  conversations: propConversations,
}: SideChatTabProps) {
  const { t } = useTranslation();
  const effectiveConversations = propConversations || loadConversations();
  const effectiveParentId = tab.parentConversationId || parentConversationId || "root";
  const sideChatId = tab.id;

  // Initialize messages from persisted side store
  const [messages, setMessages] = useState<SideChatMessage[]>(() => {
    const saved = loadSideConversation(effectiveParentId, sideChatId);
    return saved?.messages || [];
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>(() => tab.model || defaultModel || "gemini-3.8-flash");
  const [activeMode, setActiveMode] = useState<"request_review" | "ask_before_changes" | "full_access">("ask_before_changes");
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<SideChatMessage[]>(messages);
  messagesRef.current = messages;

  const commitMessages = useCallback((next: SideChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const handleIntelligenceStateChange = useCallback((messageId: string, blockId: string, state: Record<string, unknown>) => {
    const next = updateIntelligenceUiState(messagesRef.current, messageId, blockId, state);
    commitMessages(next);
    saveSideConversation({
      id: sideChatId,
      parentConversationId: effectiveParentId,
      title: tab.title || t("rightPane.sideChat"),
      project: tab.project || "Outside Project",
      model: activeModel,
      mode: activeMode,
      createdAt: tab.createdAt || Date.now(),
      updatedAt: Date.now(),
      messages: next,
    });
  }, [sideChatId, effectiveParentId, tab.title, tab.project, tab.createdAt, activeModel, activeMode, commitMessages, t]);

  // Auto-scroll logic
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, []);

  // Sync tab updates when activeModel changes
  const handleModelSelect = (modelItem: any) => {
    const modelName = modelItem?.id || modelItem?.name || modelItem;
    if (modelName) {
      setActiveModel(modelName);
      onUpdateTab?.(tab.id, { model: modelName });
    }
  };

  // Listen for agent streaming events matching this sideChatId
  useEffect(() => {
    if (!window.electron?.onAgentEvent) return;

    const unsubscribe = window.electron.onAgentEvent((event: any) => {
      if (event.conversationId !== sideChatId) return;

      // 1. Completion / Done events from Const Agent & Electron
      if (
        event.type === "done" ||
        event.type === "session_completed" ||
        event.type === "completed" ||
        (event.type === "status" && event.status === "done")
      ) {
        setIsExecuting(false);
        const current = [...messagesRef.current];
        if (current.length > 0) {
          const lastIdx = current.length - 1;
          const last = current[lastIdx];
          if (last && last.role === "assistant") {
            const steps = (last.traceSteps || []).map((st) => {
              if (st.type === "thought" && st.startTime && !st.durationMs) {
                return {
                  ...st,
                  durationMs: Math.max(1000, Date.now() - st.startTime),
                };
              }
              return st;
            });
            current[lastIdx] = {
              ...last,
              content: event.fullContent || last.content || "",
              traceSteps: steps,
              durationMs: last.durationMs || (last.timestamp ? Date.now() - last.timestamp : undefined),
            };
            commitMessages(current);
          }
        }
        // Persist final conversation state
        saveSideConversation({
          id: sideChatId,
          parentConversationId: effectiveParentId,
          title: tab.title || "Side chat",
          project: tab.project || "Outside Project",
          model: activeModel,
          mode: activeMode,
          createdAt: tab.createdAt || Date.now(),
          updatedAt: Date.now(),
          messages: current.length > 0 ? current : messagesRef.current,
        });
        return;
      }

      // 2. Error events
      if (event.type === "error" || (event.type === "status" && event.status === "error")) {
        setIsExecuting(false);
        const errStr = event.error || event.message || "";
        if (
          errStr &&
          !errStr.toLowerCase().includes("cancelled") &&
          !errStr.toLowerCase().includes("abort")
        ) {
          toast.error(errStr);
        }
        return;
      }

      const current = [...messagesRef.current];
      if (current.length === 0) return;

      const lastIdx = current.length - 1;
      const last = current[lastIdx];
      if (!last || last.role !== "assistant") return;

      if (event.type === "token") {
        let steps = last.traceSteps ? [...last.traceSteps] : [];
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          if (lastStep && lastStep.type === "thought" && lastStep.startTime && !lastStep.durationMs) {
            steps[steps.length - 1] = {
              ...lastStep,
              durationMs: Math.max(1000, Date.now() - lastStep.startTime),
            };
          }
        }
        current[lastIdx] = {
          ...last,
          content: last.content + (event.token || ""),
          traceSteps: steps,
        };
        commitMessages(current);
      } else if (event.type === "token_reset") {
        current[lastIdx] = {
          ...last,
          content: "",
        };
        commitMessages(current);
      } else if (event.type === "thinking") {
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
        current[lastIdx] = {
          ...last,
          thinking: (last.thinking || "") + (event.thinking || ""),
          traceSteps: steps,
        };
        commitMessages(current);
      } else if (event.type === "tool_call") {
        const toolCalls = [...(last.toolCalls || [])];
        toolCalls.push({
          id: event.toolCallId || `tc_${Date.now()}`,
          name: event.name || "tool",
          args: event.args,
        });

        const callId = event.toolCallId || `tc_${Date.now()}`;
        const steps = [...(last.traceSteps || [])];
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          if (lastStep && lastStep.type === "thought" && lastStep.startTime && !lastStep.durationMs) {
            steps[steps.length - 1] = {
              ...lastStep,
              durationMs: Math.max(1000, Date.now() - lastStep.startTime),
            };
          }
        }
        steps.push({
          id: callId,
          type: "tool",
          toolCallId: callId,
          name: event.toolName || event.name || "tool",
          args: event.args,
          startTime: Date.now(),
        });

        current[lastIdx] = {
          ...last,
          toolCalls,
          traceSteps: steps,
        };
        commitMessages(current);
      } else if (event.type === "tool_result") {
        const toolCalls = (last.toolCalls || []).map((tc) =>
          tc.id === event.toolCallId
            ? { ...tc, result: event.result, isError: event.isError }
            : tc
        );

        const steps = (last.traceSteps || []).map((st) =>
          st.id === event.toolCallId || st.toolCallId === event.toolCallId
            ? {
                ...st,
                result: event.result,
                isError: event.isError,
                durationMs: st.startTime ? Math.max(100, Date.now() - st.startTime) : 250,
              }
            : st
        );

        const mutations = [...(last.mutations || [])];
        if (event.mutation) {
          mutations.push(event.mutation);
        }

        current[lastIdx] = {
          ...last,
          toolCalls,
          traceSteps: steps,
          mutations,
        };
        commitMessages(current);
      } else if (event.type === "file_mutation") {
        const mutations = [...(last.mutations || [])];
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
        current[lastIdx] = {
          ...last,
          mutations,
          traceSteps: steps,
        };
        commitMessages(current);
      }
    });

    const unsubEnded = window.electron?.onSessionEnded?.((data) => {
      if (data?.conversationId === sideChatId) {
        setIsExecuting(false);
      }
    });

    return () => {
      unsubscribe();
      unsubEnded?.();
    };
  }, [sideChatId, effectiveParentId, tab.title, tab.project, tab.createdAt, activeModel, activeMode, commitMessages]);

  const handleSendMessage = async ({
    prompt,
    mode,
    model,
    thinkingLevel,
    attachments,
  }: {
    prompt: string;
    project: string;
    mode: "request_review" | "ask_before_changes" | "full_access";
    model?: string;
    thinkingLevel?: string;
    attachments?: AttachedFile[];
  }) => {
    if ((!prompt.trim() && (!attachments || attachments.length === 0)) || isExecuting) return;

    const userMsg: SideChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: prompt.trim(),
      timestamp: Date.now(),
      attachments,
    };

    const assistantPlaceholder: SideChatMessage = {
      id: `msg_asst_${Date.now()}`,
      role: "assistant",
      content: "",
      thinking: "",
      traceSteps: [],
      toolCalls: [],
      mutations: [],
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMsg, assistantPlaceholder];
    commitMessages(nextMessages);
    setIsExecuting(true);

    const modelToUse = model || activeModel;
    const modeToUse = mode || activeMode;

    // Persist immediately
    saveSideConversation({
      id: sideChatId,
      parentConversationId: effectiveParentId,
      title: tab.title || "Side chat",
      project: tab.project || "Outside Project",
      model: modelToUse,
      mode: modeToUse,
      createdAt: tab.createdAt || Date.now(),
      updatedAt: Date.now(),
      messages: [...messages, userMsg],
    });

    setTimeout(() => scrollToBottom(true), 50);

    // Construct Payload with Shared Memory + ZCode-style Side Chat framing
    const sideChatFramingSystemPrompt = `You are running in a Side Chat companion thread inside the user's workspace.
The conversation history provided above is inherited from the parent task for your background context and awareness.
Do NOT automatically resume, repeat, or continue the parent task's execution unless the user explicitly asks you to do so in this side chat session.
Answer the user's query directly. Only modify workspace files or run commands if specifically requested by the user in this session.`;

    const payloadMessages: any[] = [
      {
        role: "system",
        content: sideChatFramingSystemPrompt,
      },
    ];

    // Inject parent task context
    if (parentMessages && parentMessages.length > 0) {
      for (const m of parentMessages) {
        if (m.role === "user" || m.role === "assistant") {
          let textContent = "";
          const contentVal = (m as any).content;
          if (typeof contentVal === "string") {
            textContent = contentVal;
          } else if (Array.isArray(contentVal)) {
            textContent = contentVal
              .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
              .map((p: any) => p.text)
              .join("\n");
          } else {
            textContent = String(contentVal || "");
          }
          payloadMessages.push({
            role: m.role,
            content: textContent,
          });
        }
      }
    }

    // Inject side chat thread history
    for (const m of messages) {
      if (m.role === "user" || m.role === "assistant") {
        payloadMessages.push({
          role: m.role,
          content: m.content,
        });
      }
    }

    // Append current user message (with resolved session mentions context)
    const resolvedPrompt = resolveMentionedSessionsInPrompt(userMsg.content, effectiveConversations);
    payloadMessages.push({
      role: "user",
      content: resolvedPrompt,
    });

    if (window.electron?.sendMessage) {
      try {
        const authToken = localStorage.getItem("const_harness_auth_token") || undefined;
        const res = await window.electron.sendMessage({
          messages: payloadMessages,
          model: modelToUse,
          thinkingLevel,
          workspacePath: tab.project,
          mode: modeToUse,
          conversationId: sideChatId,
          authToken,
        });

        if (!res.success && res.error) {
          if (
            !res.aborted &&
            !res.error.toLowerCase().includes("cancelled") &&
            !res.error.toLowerCase().includes("abort")
          ) {
            toast.error(res.error);
          }
        }
      } catch (err: any) {
        if (
          !err.message?.toLowerCase().includes("cancelled") &&
          !err.message?.toLowerCase().includes("abort")
        ) {
          toast.error(err.message || "Failed to communicate with side agent");
        }
      } finally {
        setIsExecuting(false);
        const finalMsgs = messagesRef.current;
        if (finalMsgs.length > 0) {
          saveSideConversation({
            id: sideChatId,
            parentConversationId: effectiveParentId,
            title: tab.title || "Side chat",
            project: tab.project || "Outside Project",
            model: modelToUse,
            mode: modeToUse,
            createdAt: tab.createdAt || Date.now(),
            updatedAt: Date.now(),
            messages: finalMsgs,
          });
        }
      }
    } else {
      // Mock fallback if electron not available
      setTimeout(() => {
        setIsExecuting(false);
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last) {
            last.content = "Electron bridge is not connected in this browser session.";
          }
          return copy;
        });
      }, 1000);
    }
  };

  const handleAbort = async () => {
    if (window.electron?.abortAgent) {
      await window.electron.abortAgent(sideChatId);
    }
    setIsExecuting(false);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      const isAssistant = messagesRef.current.find((message) => message.id === id)?.role === "assistant";
      await navigator.clipboard.writeText(isAssistant ? assistantResponseToText(text) : text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success(t("toast.copied"));
    } catch { toast.error(t("toast.copyFailed")); }
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    deleteSideConversation(effectiveParentId, sideChatId);
    setMessages([]);
    toast.info(t("rightPane.sideChatCleared"));
  };

  return (
    <div className="flex-1 w-full h-full min-h-0 flex flex-col bg-[#ffffff] dark:bg-[#141414] text-[#1c1c1c] dark:text-[#ededed] overflow-hidden select-none">
      {/* 1. Header Strip: Only Refresh / Clear Chat button */}
      <div className="h-8 px-3 pt-1 flex items-center justify-end shrink-0">
        <button
          type="button"
          onClick={handleClearChat}
          disabled={messages.length === 0 || isExecuting}
          className="p-1 rounded text-[#8e8e8e] hover:text-[#e11d48] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("rightPane.clearSideChat")}
          aria-label={t("rightPane.clearSideChat")}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Scrollable Messages Feed */}
      <ScrollArea
        ref={scrollRef}
        className="flex-1 w-full h-full min-w-0 select-text [&>div>div[style]]:!block"
      >
        <div className="w-full max-w-full px-3.5 py-4 flex flex-col gap-4 select-text">
          {messages.map((msg) => (
            <div key={msg.id} className="w-full flex flex-col select-text cursor-text">
              {msg.role === "user" ? (
                /* User Bubble */
                <div className="w-full flex flex-col items-end group select-text cursor-text">
                  <div className="w-fit max-w-[85%] rounded-2xl rounded-tr-[2px] bg-[#f0f0f0] dark:bg-[#242424] border border-[#e2e2e4] dark:border-[#363636] px-3.5 py-2 text-xs text-[#262626] dark:text-[#ececec] leading-relaxed break-words select-text cursor-text">
                    <MarkdownContent
                      content={msg.content}
                      onOpenFilePreview={onOpenFilePreview}
                      onOpenTrajectory={onOpenTrajectory}
                      variant="user"
                    />
                  </div>
                  {/* Hover actions */}
                  <div className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[#a9a9a9] dark:text-[#777777] select-none pointer-events-none group-hover:pointer-events-auto">
                    <span>{formatMessageTimestamp(msg.timestamp)}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                      title="Copy"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Assistant Bubble */
                <div className="w-full flex flex-col gap-2 group select-text cursor-text">
                  <ExecutionTrace
                    thinking={msg.thinking}
                    toolCalls={msg.toolCalls}
                    traceSteps={msg.traceSteps}
                    mutations={msg.mutations}
                    isExecuting={isExecuting && msg.id === messages[messages.length - 1]?.id}
                    onRollback={onRollbackFile}
                    onRollbackAll={onRollbackAll}
                    onOpenFileDiff={onOpenFileDiff}
                    onOpenFilePreview={onOpenFilePreview}
                  />

                  {msg.content && (
                    <div className="text-xs text-[#262626] dark:text-[#d4d4d4] leading-relaxed break-words select-text cursor-text">
                      <AssistantResponse
                        content={msg.content}
                        isStreaming={isExecuting && msg.id === messages[messages.length - 1]?.id}
                        disabled={isExecuting}
                        state={msg.intelligenceUiState}
                        onStateChange={(blockId, state) => handleIntelligenceStateChange(msg.id, blockId, state)}
                        onSubmit={(prompt) => handleSendMessage({ prompt, project: tab.project || "Outside Project", mode: activeMode, model: activeModel })}
                        onOpenFilePreview={onOpenFilePreview}
                        onOpenTrajectory={onOpenTrajectory}
                      />
                    </div>
                  )}

                  {/* Assistant Action Bar: Copy & Bridge to Main */}
                  <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#a9a9a9] dark:text-[#777777] select-none pointer-events-none group-hover:pointer-events-auto">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1 cursor-pointer"
                      title={t("common.copy")}
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{t("common.copy")}</span>
                    </button>

                    {onInsertToMainPrompt && msg.content && (
                      <button
                        type="button"
                        onClick={() => {
                          onInsertToMainPrompt(assistantResponseToText(msg.content));
                          toast.success(t("rightPane.sentToMainChat"));
                        }}
                        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1 text-[#3b82f6] hover:text-[#2563eb] cursor-pointer"
                        title={t("rightPane.insertSnippet")}
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        <span>{t("rightPane.toMainChat")}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 3. Anchored Bottom Input Card with Responsive Icon-Only Toolbar */}
      <div className="w-full px-2.5 pb-2.5 pt-1 bg-transparent shrink-0">
        <ChatCard
          compact={true}
          forceIconOnly={true}
          isExecuting={isExecuting}
          onSendMessage={handleSendMessage}
          onAbort={handleAbort}
          project={tab.project}
          onModelChange={handleModelSelect}
          mode={activeMode}
          onModeChange={setActiveMode}
          onOpenFilePreview={onOpenFilePreview}
          onOpenTrajectory={onOpenTrajectory}
          conversations={effectiveConversations}
        />
      </div>
    </div>
  );
}
