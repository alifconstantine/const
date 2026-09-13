import React, { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, type LocalMessage, type LocalArtifact } from "../../lib/db";
import {
  DEFAULT_MOBILE_MODELS,
  streamChatCompletion,
  fetchRouterModels,
  type MobileModel,
} from "../../lib/ai-stream";
import { MarkdownContent } from "./markdown-content";
import { ChatInputCard, type AttachedMedia } from "./chat-input-card";
import { AddSourceDialog } from "./add-source-dialog";
import { WorkingProcess } from "./working-process";
import { ScrollArea, cn } from "@const/ui";
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
} from "lucide-react";

type WorkspaceTab = "sources" | "chat" | "tools";

interface StudioTool {
  id: string;
  name: string;
  icon: React.ElementType;
  iconColor: string;
}

const STUDIO_TOOLS: StudioTool[] = [
  { id: "audio_summary", name: "Audio Overview", icon: AudioLines, iconColor: "text-indigo-400" },
  { id: "slides", name: "Slide Deck", icon: Presentation, iconColor: "text-amber-400" },
  { id: "video_summary", name: "Video Summary", icon: Video, iconColor: "text-emerald-400" },
  { id: "mind_map", name: "Mind Map", icon: GitFork, iconColor: "text-purple-400" },
  { id: "report", name: "Briefing Doc", icon: FileText, iconColor: "text-blue-400" },
  { id: "flashcards", name: "Flashcards", icon: HelpCircle, iconColor: "text-orange-400" },
  { id: "quiz", name: "Study Quiz", icon: Award, iconColor: "text-green-400" },
  { id: "infographic", name: "Infographic", icon: BarChart3, iconColor: "text-pink-400" },
  { id: "data_table", name: "Data Table", icon: Table2, iconColor: "text-cyan-400" },
];

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
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
  user?: any;
}

export function MobileLearnWorkspace({
  learnId,
  initialSourceModalOpen = false,
  onBack,
  onCreateNew,
}: MobileLearnWorkspaceProps) {
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
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [availableModels, setAvailableModels] = useState<MobileModel[]>(DEFAULT_MOBILE_MODELS);
  const [selectedModelId, setSelectedModelId] = useState<string>(
    DEFAULT_MOBILE_MODELS[0]!.id
  );
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(initialSourceModalOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState("Web");
  const [researchSpeed, setResearchSpeed] = useState("Fast Research");
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedMedia[]>([]);
  const [expandedUserMessageId, setExpandedUserMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamStartTime, setStreamStartTime] = useState<number>(0);
  const [liveDurationMs, setLiveDurationMs] = useState<number>(0);

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

  // Editable title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("Untitled notebook");

  useEffect(() => {
    if (learn?.title) {
      setTitleValue(learn.title);
    }
  }, [learn?.title]);

  // Load chat messages from local Dexie on mount / learnId change
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
  }, [learnId]);

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
    const trimmed = titleValue.trim() || "Notebook tanpa judul";
    setTitleValue(trimmed);
    await localDb.updateLearn(learnId, { title: trimmed });
  };

  const handleClearHistory = async () => {
    if (isStreaming) {
      handleStop();
    }
    if (learnId) {
      await localDb.clearMessages(learnId);
    }
    setMessages([]);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleSend = async (customPrompt?: string, attachmentsToSend?: AttachedMedia[]) => {
    const textToSend = (customPrompt || inputMessage).trim();
    const currentAttachments = attachmentsToSend || attachedFiles;
    if ((!textToSend && currentAttachments.length === 0) || isStreaming) return;

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

    const serializedAttachments = currentAttachments.map((a) => ({
      id: a.id,
      name: a.name,
      size: a.size,
      type: a.type,
      url: a.url,
    }));

    const newUserMsg: DisplayMessage = {
      id: userMsgId,
      role: "user",
      content: textToSend,
      attachments: serializedAttachments,
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

    // Save user message to Dexie
    if (learnId) {
      await localDb.saveMessage({
        id: userMsgId,
        learnId,
        role: "user",
        content: textToSend,
        attachments: serializedAttachments,
        createdAt: now,
      });
    }

    const nextMessages = [...messages, newUserMsg];
    setMessages([...nextMessages, newAssistantMsg]);
    setInputMessage("");
    setAttachedFiles([]);
    setIsStreaming(true);

    const formattedMessages = nextMessages.map((m) => ({
      role: m.role,
      content: m.content || "",
    }));

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
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: (msg.content || "") + chunk }
                : msg
            )
          );
        },
        onDone: async (finalContent, finalThinking) => {
          const finalDuration = Date.now() - now;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: finalContent,
                    thinking: finalThinking,
                    durationMs: finalDuration,
                    isStreaming: false,
                  }
                : msg
            )
          );
          setIsStreaming(false);
          abortControllerRef.current = null;

          if (learnId) {
            await localDb.saveMessage({
              id: assistantMsgId,
              learnId,
              role: "assistant",
              content: finalContent,
              thinking: finalThinking,
              durationMs: finalDuration,
              createdAt: Date.now(),
            });
          }
        },
        onError: async (err) => {
          const finalDuration = Date.now() - now;
          const errorText = `Gagal memanggil Const Router: ${err.message}`;
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

          if (learnId) {
            await localDb.saveMessage({
              id: assistantMsgId,
              learnId,
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
            aria-label="Back to home"
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
              title="Click to rename"
            >
              {titleValue}
            </button>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          {activeTab === "chat" && messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="h-8 px-2 rounded-xl hover:bg-[#2b2b2b] text-[#969696] hover:text-[#ffffff] flex items-center gap-1 text-[11px] transition-colors cursor-pointer border border-[#383838]"
              title="Clear conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsAddSourceOpen(true)}
            className="h-8 w-8 rounded-xl hover:bg-[#2b2b2b] text-[#969696] hover:text-[#ffffff] flex items-center justify-center transition-colors cursor-pointer border border-[#383838]"
            aria-label="Add source"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: titleValue, url: window.location.href }).catch(() => {});
              }
            }}
            className="h-8 w-8 rounded-xl hover:bg-[#2b2b2b] text-[#969696] hover:text-[#ffffff] flex items-center justify-center transition-colors cursor-pointer border border-[#383838]"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
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

            <span className="text-[10px] font-mono text-[#5d5d5d]">
              Local IndexedDB
            </span>
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
                    {/* Attached Media / Files Preview */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5 justify-end max-w-[88%]">
                        {msg.attachments.map((att: any, attIdx: number) => (
                          <div
                            key={att.id || attIdx}
                            className="rounded-xl border border-[#383838] bg-[#1a1917] p-1 shadow-xs"
                          >
                            {att.type === "image" && att.url ? (
                              <img
                                src={att.url}
                                alt={att.name}
                                className="w-16 h-16 rounded-lg object-cover block"
                              />
                            ) : (
                              <div className="px-2.5 py-1.5 rounded-lg bg-[#262626] flex items-center gap-2 text-xs text-[#d4d4d4]">
                                <FileText className="w-3.5 h-3.5 text-[#0066ff]" />
                                <span className="truncate max-w-[120px]">{att.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* User Message Bubble with ScrollArea when long */}
                    {(() => {
                      const isLongPrompt =
                        msg.content.length > 250 || msg.content.split("\n").length > 4;
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
                              <div className="pr-1.5">{msg.content}</div>
                            </ScrollArea>
                          ) : (
                            <div>{msg.content}</div>
                          )}
                        </div>
                      );
                    })()}

                    {/* User Message Action Bar: Timestamp & Copy */}
                    <div className="flex items-center gap-2 pt-1 pr-1 text-[10.5px] font-mono text-[#777777] select-none">
                      {msg.createdAt && <span>{formatTimestamp(msg.createdAt)}</span>}
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                        title="Salin pesan"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-[#34d399]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-2 group select-text">
                    {/* Working Process (Thinking, Live Timer, Tool Calls) */}
                    <WorkingProcess
                      thinking={msg.thinking}
                      toolCalls={msg.toolCalls}
                      isExecuting={Boolean(msg.isStreaming)}
                      durationMs={msg.isStreaming ? liveDurationMs : msg.durationMs}
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
                          title="Salin jawaban"
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
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-20">
          {/* TAB 1: SOURCES */}
          {activeTab === "sources" && (
            <div className="p-4 space-y-4 max-w-lg mx-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#ffffff]">Learning Sources</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#222222] border border-[#383838] text-[#969696] font-mono">
                  {learn?.sourcesCount || 0} {learn?.sourcesCount === 1 ? "source" : "sources"}
                </span>
              </div>

              {/* "+ Add source" Button */}
              <button
                type="button"
                onClick={() => setIsAddSourceOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#383838] hover:border-[#5d5d5d] bg-[#2b2b2b] hover:bg-[#383838] text-xs font-medium text-[#d4d4d4] hover:text-[#ffffff] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add source</span>
              </button>

              {/* Search Box */}
              <div className="w-full bg-[#222222] rounded-xl p-3 border border-[#383838] focus-within:border-[#5d5d5d] transition-all text-left">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for new sources on the web"
                  className="w-full bg-transparent text-xs text-[#d4d4d4] placeholder:text-[#5d5d5d] outline-none px-1 py-1"
                />
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#2e2e2e]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setWebScope(webScope === "Web" ? "Journal" : "Web")}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-[11px] text-[#969696] hover:text-[#d4d4d4] transition-colors cursor-pointer border border-[#383838]"
                    >
                      <Globe className="h-2.5 w-2.5" />
                      <span>{webScope}</span>
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
                      <span>{researchSpeed}</span>
                      <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="h-6 w-6 rounded-lg bg-[#2b2b2b] hover:bg-[#383838] text-[#969696] hover:text-[#ffffff] flex items-center justify-center transition-colors cursor-pointer border border-[#383838]"
                    aria-label="Search"
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
                  Saved sources will appear here
                </h3>
                <p className="text-[11px] text-[#969696] leading-relaxed max-w-[240px] mb-3">
                  Add files, notes, or web links to ground your AI assistant.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddSourceOpen(true)}
                  className="text-xs text-[#0066ff] hover:underline transition-colors cursor-pointer"
                >
                  + Add first source
                </button>
              </div>
            </div>
          )}

        {/* TAB 3: TOOLS (STUDIO & ARTIFACTS) */}
        {activeTab === "tools" && (
          <div className="p-4 space-y-5 max-w-lg mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#ffffff]">Studio Tools</span>
            </div>

            {/* 3x3 Grid of Tools */}
            <div className="grid grid-cols-3 gap-2">
              {STUDIO_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      setActiveTab("chat");
                      handleSend(`Please create a ${tool.name} for this notebook.`);
                    }}
                    className="p-2.5 rounded-xl bg-[#222222] hover:bg-[#2b2b2b] border border-[#383838] transition-all flex flex-col justify-between h-20 text-left cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center justify-between w-full">
                      <Icon className={`h-4 w-4 ${tool.iconColor}`} />
                      <ChevronRight className="h-3 w-3 text-[#5d5d5d]" />
                    </div>
                    <span className="text-[10px] font-normal text-[#d4d4d4] leading-tight line-clamp-2">
                      {tool.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Artifacts / Downloads Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-[#ffffff]">
                  Generated Files & Artifacts
                </span>
                {artifacts && artifacts.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#222222] border border-[#383838] font-mono text-[#969696]">
                    {artifacts.length} {artifacts.length === 1 ? "file" : "files"}
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
                        <span>Download</span>
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
                    No artifacts or files saved yet
                  </h3>
                  <p className="text-[11px] text-[#969696] leading-relaxed max-w-[240px]">
                    Any files produced in learning sessions will appear here and can be downloaded directly.
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
          <span className="text-[10px] mt-1 tracking-tight">Sources</span>
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
          <span className="text-[10px] mt-1 tracking-tight">Chat</span>
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
          <span className="text-[10px] mt-1 tracking-tight">Studio</span>
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
    </div>
  );
}
