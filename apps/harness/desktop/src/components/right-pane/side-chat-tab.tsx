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
import {
  loadSideConversation,
  saveSideConversation,
  deleteSideConversation,
} from "../../lib/conversation-store";

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
}: SideChatTabProps) {
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
        setMessages(current);
      } else if (event.type === "token_reset") {
        current[lastIdx] = {
          ...last,
          content: "",
        };
        setMessages(current);
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
        setMessages(current);
      } else if (event.type === "tool_call") {
        const toolCalls = [...(last.toolCalls || [])];
        toolCalls.push({
          id: event.toolCallId || `tc_${Date.now()}`,
          name: event.name || "tool",
          args: event.args,
        });

        const callId = event.toolCallId || `tc_${Date.now()}`;
        const steps = [...(last.traceSteps || [])];
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
        setMessages(current);
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
        setMessages(current);
      } else if (event.type === "session_completed" || event.type === "completed") {
        setIsExecuting(false);
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
          messages: current,
        });
      } else if (event.type === "error") {
        setIsExecuting(false);
        toast.error(event.error || "Error in side agent execution");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sideChatId, effectiveParentId, tab.title, tab.project, tab.createdAt, activeModel, activeMode]);

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
    setMessages(nextMessages);
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
          payloadMessages.push({
            role: m.role,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
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

    // Append current user message
    payloadMessages.push({
      role: "user",
      content: userMsg.content,
    });

    if (window.electron?.sendMessage) {
      try {
        const res = await window.electron.sendMessage({
          messages: payloadMessages,
          model: modelToUse,
          thinkingLevel,
          workspacePath: tab.project,
          mode: modeToUse,
          conversationId: sideChatId,
        });

        if (!res.success && res.error) {
          if (!res.aborted) {
            toast.error(res.error);
          }
          setIsExecuting(false);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to communicate with side agent");
        setIsExecuting(false);
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

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copied to clipboard");
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    deleteSideConversation(effectiveParentId, sideChatId);
    setMessages([]);
    toast.info("Side chat cleared");
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
          title="Clear side chat"
          aria-label="Clear side chat"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Scrollable Messages Feed */}
      <ScrollArea
        ref={scrollRef}
        className="flex-1 w-full h-full min-w-0 [&>div>div[style]]:!block"
      >
        <div className="w-full max-w-full px-3.5 py-4 flex flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id} className="w-full flex flex-col select-text">
              {msg.role === "user" ? (
                /* User Bubble */
                <div className="w-full flex flex-col items-end group">
                  <div className="w-full max-w-[95%] rounded-xl bg-[#f0f0f0] dark:bg-[#242424] border border-[#e2e2e4] dark:border-[#363636] px-3 py-2 text-xs text-[#262626] dark:text-[#ececec] leading-relaxed whitespace-pre-wrap break-words">
                    <MarkdownContent
                      content={msg.content}
                      onOpenFilePreview={onOpenFilePreview}
                      className="space-y-1 text-xs"
                    />
                  </div>
                  {/* Hover actions */}
                  <div className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[#a9a9a9] dark:text-[#777777]">
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
                <div className="w-full flex flex-col gap-2 group">
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
                    <div className="text-xs text-[#262626] dark:text-[#d4d4d4] leading-relaxed break-words">
                      <MarkdownContent
                        content={msg.content}
                        onOpenFilePreview={onOpenFilePreview}
                      />
                    </div>
                  )}

                  {/* Assistant Action Bar: Copy & Bridge to Main */}
                  <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#a9a9a9] dark:text-[#777777]">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1 cursor-pointer"
                      title="Copy text"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy</span>
                    </button>

                    {onInsertToMainPrompt && msg.content && (
                      <button
                        type="button"
                        onClick={() => {
                          onInsertToMainPrompt(msg.content);
                          toast.success("Sent to main chat input");
                        }}
                        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1 text-[#3b82f6] hover:text-[#2563eb] cursor-pointer"
                        title="Insert snippet into main chat prompt"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        <span>To Main Chat</span>
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
        />
      </div>
    </div>
  );
}
