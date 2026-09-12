import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  ArrowRight,
  Square,
  ChevronDown,
  Brain,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { DEFAULT_MODELS } from "@const/agent/models";
import type { ModelConfig, AgentMessage } from "@const/agent/types";
import { localDb } from "../../lib/db";
import {
  SocraticQuestionCard,
  PythonRunnerCard,
  TodoWriteCard,
  GenericToolCard,
  type DisplayToolCall,
} from "./tool-cards";

interface ChatPanelProps {
  learnId?: string;
  workspacePath?: string;
  sourcesCount?: number;
  onSelectPromptChip?: (prompt: string) => void;
  onSendMessage?: (message: string) => void;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  thinking?: string;
  toolCalls?: DisplayToolCall[];
  isStreaming?: boolean;
}

export function ChatPanel({
  learnId,
  workspacePath,
  sourcesCount = 0,
  onSelectPromptChip,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("gemini-3.6-flash");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Record<string, boolean>>({});
  const [expandedToolIds, setExpandedToolIds] = useState<Record<string, boolean>>({});
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>(DEFAULT_MODELS);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeAssistantRef = useRef<DisplayMessage | null>(null);

  // Available models list (fetched dynamically from router.const.web.id with fallback)
  useEffect(() => {
    const electron = (window as any).electron;
    if (electron?.agent?.getModels) {
      electron.agent.getModels().then((remoteModels: any[]) => {
        if (remoteModels && Array.isArray(remoteModels) && remoteModels.length > 0) {
          setAvailableModels(remoteModels);
        }
      }).catch(() => {});
    }
  }, []);

  const models: ModelConfig[] = availableModels;
  const currentModel = models.find((m) => m.id === selectedModelId) || models[0]!;

  // 1. Load chat messages from local Dexie database on learnId change
  useEffect(() => {
    if (!learnId) {
      setMessages([]);
      return;
    }
    let isMounted = true;
    localDb.getMessages(learnId).then((saved) => {
      if (!isMounted) return;
      if (saved && saved.length > 0) {
        setMessages(
          saved.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content || "",
            thinking: m.thinking,
            toolCalls: m.toolCalls,
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
  }, [learnId]);

  // Auto scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          // Auto-expand thinking while receiving thinking tokens
          setExpandedThinkingIds((exp) => ({ ...exp, [updated.id]: true }));
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
          const errorMsg = event.error || "Terjadi kesalahan saat memproses permintaan.";
          updated.content = updated.content
            ? `${updated.content}\n\n⚠️ **Error:** ${errorMsg}`
            : `⚠️ **Terjadi kendala:** ${errorMsg}`;
          updated.isStreaming = false;
          setIsStreaming(false);

          if (learnId) {
            localDb.saveMessage({
              id: updated.id,
              learnId,
              role: "assistant",
              content: updated.content,
              thinking: updated.thinking,
              toolCalls: updated.toolCalls,
            });
          }
        } else if (event.type === "done") {
          if (event.fullContent && !updated.content) {
            updated.content = event.fullContent;
          } else if (!updated.content && updated.toolCalls && updated.toolCalls.length > 0) {
            const toolSummary = updated.toolCalls
              .map((tc) => `- \`${tc.name}\`: ${tc.status === "completed" ? "Selesai" : "Gagal"}`)
              .join("\n");
            updated.content = `Selesai menjalankan langkah-langkah tugas:\n\n${toolSummary}`;
          }

          updated.isStreaming = false;
          setIsStreaming(false);

          if (learnId) {
            localDb.saveMessage({
              id: updated.id,
              learnId,
              role: "assistant",
              content: updated.content,
              thinking: updated.thinking,
              toolCalls: updated.toolCalls,
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

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || isStreaming) return;

    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `asst_${Date.now()}`;

    const newUserMsg: DisplayMessage = {
      id: userMsgId,
      role: "user",
      content: textToSend,
    };

    const newAssistantMsg: DisplayMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinking: "",
      toolCalls: [],
      isStreaming: true,
    };

    // 3. Persist user message to Dexie
    if (learnId) {
      await localDb.saveMessage({
        id: userMsgId,
        learnId,
        role: "user",
        content: textToSend,
      });
    }

    const nextMessages = [...messages, newUserMsg];
    setMessages([...nextMessages, newAssistantMsg]);
    setInputMessage("");
    setIsStreaming(true);
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
          authToken: authToken || undefined,
        });

        if (res && res.success === false) {
          const errorContent = `⚠️ Terjadi kendala saat memproses: ${res.error || "Gagal mendapatkan respons dari engine"}`;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: msg.content ? `${msg.content}\n\n${errorContent}` : errorContent,
                    isStreaming: false,
                  }
                : msg
            )
          );
          if (learnId) {
            await localDb.saveMessage({
              id: assistantMsgId,
              learnId,
              role: "assistant",
              content: errorContent,
            });
          }
          setIsStreaming(false);
        } else if (res && res.success) {
          // Guarantee streaming state is turned off and finalize message
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMsgId) {
                let finalContent = msg.content;
                if (!finalContent && msg.toolCalls && msg.toolCalls.length > 0) {
                  const toolSummary = msg.toolCalls
                    .map((tc) => `- \`${tc.name}\`: ${tc.status === "completed" ? "Selesai" : "Gagal"}`)
                    .join("\n");
                  finalContent = `Selesai menjalankan langkah-langkah tugas:\n\n${toolSummary}`;
                }
                const finalized = {
                  ...msg,
                  content: finalContent,
                  isStreaming: false,
                };
                if (learnId && finalized.content) {
                  localDb.saveMessage({
                    id: finalized.id,
                    learnId,
                    role: "assistant",
                    content: finalized.content,
                    thinking: finalized.thinking,
                    toolCalls: finalized.toolCalls,
                  });
                }
                return finalized;
              }
              return msg;
            })
          );
        }
      } catch (err: any) {
        const errorContent = `Terjadi kendala koneksi ke Agent: ${err.message}`;
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
            role: "assistant",
            content: errorContent,
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
                setExpandedThinkingIds((exp) => ({ ...exp, [assistantMsgId]: true }));
              }
            } catch {
              // ignore chunk parse error
            }
          }
        }

        if (learnId) {
          await localDb.saveMessage({
            id: assistantMsgId,
            learnId,
            role: "assistant",
            content: accumulatedContent,
            thinking: accumulatedThinking,
          });
        }
      } catch (err: any) {
        const errorText = `Gagal memanggil Const: ${err.message}`;
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
            role: "assistant",
            content: errorText,
          });
        }
      } finally {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
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
      await localDb.clearMessages(learnId);
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

  const toggleThinking = (msgId: string) => {
    setExpandedThinkingIds((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleTool = (toolId: string) => {
    setExpandedToolIds((prev) => ({ ...prev, [toolId]: !prev[toolId] }));
  };

  return (
    <main className="flex-1 h-full flex flex-col bg-background text-foreground min-w-0 relative select-text">
      {/* Top Header Bar */}
      <div className="h-12 px-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/30">
        {/* Left: Chat Title + Model Selector Pill */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase">
            Socratic Chat
          </span>

          {/* Model Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 hover:bg-muted border border-border/60 text-xs font-medium text-foreground transition-all cursor-pointer shadow-xs active:scale-98"
              aria-label="Pilih Model AI"
            >
              <Sparkles className="h-3 w-3 text-accent" />
              <span>{currentModel.displayName.split("(")[0]?.trim() || "Const"}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-card border border-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider border-b border-border/40 mb-1">
                  Pilih Model Cerdas
                </div>
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
            )}
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="h-7 px-3 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-border/40"
              title="Bersihkan Percakapan"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          <button
            type="button"
            className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Pengaturan Chat"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex flex-col max-w-3xl mx-auto w-full space-y-5">
        {/* Welcome Empty State */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center my-auto py-8">
            <div className="text-3xl sm:text-4xl mb-3 select-none">👋</div>

            <h1 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-foreground mb-2">
              Ruang Belajar Socrates
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6 max-w-xl">
              Didukung oleh model cerdas <strong>{currentModel.displayName}</strong>. Tanyakan konsep riset, bedah dokumen PDF, telusuri kode proyek, atau uji hipotesis bersama Const Agent.
            </p>

            <p className="text-xs text-muted-foreground/80 font-medium mb-3">
              Mulai eksplorasi materi Anda:
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
              {[
                "Pelajari topik baru",
                "Bedah dokumen & riset",
                "Buat konten & simulasi",
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
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              } w-full`}
            >
              {/* User Message Bubble */}
              {msg.role === "user" ? (
                <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-muted text-foreground px-4 py-2.5 text-xs sm:text-sm border border-border/60 shadow-xs leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                /* Assistant Message Section */
                <div className="w-full space-y-3">
                  {/* Thinking Accordion (if available) */}
                  {msg.thinking && (
                    <div className="w-full rounded-2xl bg-muted/30 border border-border/40 overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() => toggleThinking(msg.id)}
                        className="w-full px-3.5 py-2 flex items-center justify-between text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none bg-muted/20"
                      >
                        <div className="flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5 text-purple-400" />
                          <span className="font-mono text-[11px] font-medium">
                            Proses Berpikir (DeepThinking)
                          </span>
                        </div>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${
                            expandedThinkingIds[msg.id] ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {expandedThinkingIds[msg.id] && (
                        <div className="p-3.5 text-muted-foreground font-mono text-[11px] leading-relaxed border-t border-border/40 whitespace-pre-wrap max-h-48 overflow-y-auto bg-background/50">
                          {msg.thinking}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tool Calls Visual Cards (if any) */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="space-y-2 w-full">
                      {msg.toolCalls.map((tc) => {
                        if (tc.name === "ask_question") {
                          return (
                            <SocraticQuestionCard
                              key={tc.id}
                              toolCall={tc}
                              onAnswer={handleAnswerQuestion}
                            />
                          );
                        }
                        if (tc.name === "run_python") {
                          return (
                            <PythonRunnerCard
                              key={tc.id}
                              toolCall={tc}
                              isExpanded={Boolean(expandedToolIds[tc.id])}
                              onToggle={() => toggleTool(tc.id)}
                            />
                          );
                        }
                        if (tc.name === "todo_write") {
                          return (
                            <TodoWriteCard
                              key={tc.id}
                              toolCall={tc}
                              isExpanded={Boolean(expandedToolIds[tc.id])}
                              onToggle={() => toggleTool(tc.id)}
                            />
                          );
                        }
                        return (
                          <GenericToolCard
                            key={tc.id}
                            toolCall={tc}
                            isExpanded={Boolean(expandedToolIds[tc.id])}
                            onToggle={() => toggleTool(tc.id)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Main Assistant Content Bubble */}
                  {msg.content || (msg.isStreaming && (!msg.toolCalls || msg.toolCalls.length === 0)) ? (
                    <div className="w-full rounded-3xl rounded-tl-md bg-card/60 border border-border/60 p-4 text-xs sm:text-sm text-foreground shadow-xs leading-relaxed whitespace-pre-wrap relative">
                      {msg.content}

                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-3.5 ml-1 bg-accent animate-pulse align-middle" />
                      )}
                    </div>
                  ) : !msg.isStreaming && (!msg.toolCalls || msg.toolCalls.length === 0) ? (
                    <div className="w-full rounded-3xl rounded-tl-md bg-card/60 border border-border/60 p-4 text-xs sm:text-sm text-muted-foreground shadow-xs leading-relaxed whitespace-pre-wrap relative">
                      Selesai memproses.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Bottom Chat Input Bar */}
      <div className="p-4 sm:p-5 shrink-0 max-w-3xl mx-auto w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="w-full bg-muted/40 rounded-full p-2 border border-border/70 focus-within:border-foreground/40 transition-all flex items-center justify-between gap-3 shadow-lg"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isStreaming}
            placeholder={
              isStreaming
                ? "Sedang memproses respons asisten..."
                : `Tanyakan apa saja kepada ${currentModel.displayName.split("(")[0]?.trim()}...`
            }
            className="flex-1 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none px-3 disabled:opacity-50"
          />

          <div className="flex items-center gap-2 shrink-0 pr-1">
            <span className="text-[11px] px-3 py-1 rounded-full bg-background/60 text-muted-foreground font-mono border border-border/40 select-none">
              {sourcesCount} sumber
            </span>

            {isStreaming ? (
              <button
                type="button"
                onClick={handleAbort}
                className="h-8 w-8 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-all cursor-pointer"
                title="Hentikan Proses"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="h-8 w-8 rounded-full bg-foreground text-background hover:opacity-90 disabled:opacity-30 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                aria-label="Kirim"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>

        {/* Subtle Model & Workspace Status Footer */}
        <div className="flex items-center justify-between px-3 mt-2 select-none text-[10px] text-muted-foreground font-mono">
          <span>{workspacePath ? `Workspace: ${workspacePath}` : "Global Workspace"}</span>
          <span>Model: {currentModel.displayName}</span>
        </div>
      </div>
    </main>
  );
}
