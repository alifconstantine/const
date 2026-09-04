import React, { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb, type LocalMessage, type LocalArtifact } from "../../lib/db";
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
  ArrowRight,
  AudioLines,
  Presentation,
  Video,
  GitFork,
  HelpCircle,
  Award,
  BarChart3,
  Table2,
  ChevronRight,
  PenTool,
  Check,
  RotateCcw,
  Sparkles,
  Brain,
  Terminal,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Package,
  Square,
} from "lucide-react";
import { AddSourceDialog } from "./add-source-dialog";

type WorkspaceTab = "sources" | "chat" | "tools";

interface StudioTool {
  id: string;
  name: string;
  icon: React.ElementType;
  iconColor: string;
}

const STUDIO_TOOLS: StudioTool[] = [
  { id: "audio_summary", name: "Ringkasan Audio", icon: AudioLines, iconColor: "text-indigo-400" },
  { id: "slides", name: "Slide Presentasi", icon: Presentation, iconColor: "text-amber-400" },
  { id: "video_summary", name: "Ringkasan Video", icon: Video, iconColor: "text-emerald-400" },
  { id: "mind_map", name: "Peta Pikiran", icon: GitFork, iconColor: "text-purple-400" },
  { id: "report", name: "Laporan", icon: FileText, iconColor: "text-blue-400" },
  { id: "flashcards", name: "Kartu tanya...", icon: HelpCircle, iconColor: "text-orange-400" },
  { id: "quiz", name: "Kuis", icon: Award, iconColor: "text-green-400" },
  { id: "infographic", name: "Infografis", icon: BarChart3, iconColor: "text-pink-400" },
  { id: "data_table", name: "Tabel Data", icon: Table2, iconColor: "text-cyan-400" },
];

const MOBILE_MODELS = [
  { id: "Const", name: "Gemini 3.6 Flash" },
  { id: "antigravity/gemini-3.6-flash-low", name: "Gemini Flash (Fast)" },
  { id: "antigravity/claude-sonnet-4-6-medium", name: "Claude Sonnet 4.6" },
  { id: "antigravity/claude-opus-4-6-thinking-medium", name: "Claude Opus 4.6" },
];

interface DisplayToolCall {
  id: string;
  name: string;
  args: any;
  result?: any;
  isError?: boolean;
  status: "running" | "completed" | "error";
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  thinking?: string;
  toolCalls?: DisplayToolCall[];
  isStreaming?: boolean;
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

  // Tab & modal states
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chat");
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(initialSourceModalOpen);

  // Search states in Sources tab
  const [searchQuery, setSearchQuery] = useState("");
  const [webScope, setWebScope] = useState("Web");
  const [researchSpeed, setResearchSpeed] = useState("Riset Cepat");

  // Chat states
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("Const");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Record<string, boolean>>({});
  const [expandedToolIds, setExpandedToolIds] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeAssistantRef = useRef<DisplayMessage | null>(null);

  // Editable title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("Notebook tanpa judul");

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

  // Auto scroll to bottom on message updates in chat tab
  useEffect(() => {
    if (activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, activeTab]);

  const handleSaveTitle = async () => {
    setIsEditingTitle(false);
    const trimmed = titleValue.trim() || "Notebook tanpa judul";
    setTitleValue(trimmed);
    await localDb.updateLearn(learnId, { title: trimmed });
  };

  const handleClearHistory = async () => {
    if (learnId) {
      await localDb.clearMessages(learnId);
    }
    setMessages([]);
  };

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

    // Save user message to Dexie
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

    // Build payload for Const Engine
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

    try {
      const baseUrl =
        (import.meta as any).env?.VITE_CONST_ENGINE_BASE_URL ||
        "https://engine.const.web.id/v1";
      const apiKey = (import.meta as any).env?.VITE_CONST_ENGINE_API_KEY || "";
      const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModelId,
          messages: [
            {
              role: "system",
              content:
                "You are Const Learn Agent Mobile, an expert research and educational assistant. Help users understand concepts, explore topics, and generate high-quality summaries.",
            },
            ...formattedMessages,
          ],
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP error ${res.status}`);
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
            // ignore JSON parse error
          }
        }
      }

      // Save assistant message to Dexie
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
      const errorText = `Gagal memanggil Const Engine: ${err.message}`;
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
    MOBILE_MODELS.find((m) => m.id === selectedModelId) || MOBILE_MODELS[0]!;

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden select-none">
      {/* Top Mobile Header */}
      <header className="h-14 px-4 bg-card/60 backdrop-blur-md border-b border-border/50 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-9 w-9 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Kembali"
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
                className="text-sm font-medium text-foreground bg-muted/60 rounded-full px-3 py-1 outline-none border border-border/80 max-w-[170px]"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-serif font-medium text-foreground hover:bg-muted/50 px-2.5 py-1 rounded-full transition-colors cursor-pointer text-left truncate max-w-[180px]"
              title="Klik untuk mengubah judul"
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
              className="h-8 px-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors cursor-pointer border border-border/40"
              title="Reset Percakapan"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsAddSourceOpen(true)}
            className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tambah Sumber"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Bagikan"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area Based on Active Tab */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* TAB 1: SUMBER */}
        {activeTab === "sources" && (
          <div className="p-4 space-y-4 max-w-lg mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-foreground">Sumber Belajar</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                {learn?.sourcesCount || 0} sumber
              </span>
            </div>

            {/* "+ Tambahkan sumber" Button */}
            <button
              type="button"
              onClick={() => setIsAddSourceOpen(true)}
              className="w-full py-2.5 px-4 rounded-full border border-border hover:border-border/80 bg-muted/50 hover:bg-muted text-xs font-medium text-foreground flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tambahkan sumber</span>
            </button>

            {/* Search Box */}
            <div className="w-full bg-muted/60 rounded-2xl p-3 border border-border/60 focus-within:border-border transition-all text-left">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Telusuri sumber baru di web"
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none px-1 py-1"
              />
              <div className="flex items-center justify-between mt-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWebScope(webScope === "Web" ? "Jurnal" : "Web")}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-background/60 hover:bg-background text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40"
                  >
                    <Globe className="h-2.5 w-2.5" />
                    <span>{webScope}</span>
                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setResearchSpeed(
                        researchSpeed === "Riset Cepat" ? "Riset Mendalam" : "Riset Cepat"
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-background/60 hover:bg-background text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40"
                  >
                    <Search className="h-2.5 w-2.5" />
                    <span>{researchSpeed}</span>
                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                  </button>
                </div>

                <button
                  type="button"
                  className="h-6 w-6 rounded-full bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border/40"
                  aria-label="Cari"
                >
                  <Search className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[220px]">
              <div className="h-12 w-12 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-center text-muted-foreground/60 mb-3">
                <FileText className="h-6 w-6 stroke-[1.5]" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                Sumber yang telah disimpan akan muncul di sini
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px] mb-3">
                Tambahkan file, catatan, atau referensi web untuk melandasi pemikiran agent Anda.
              </p>
              <p className="text-xs text-muted-foreground">
                Lepaskan file di sini atau{" "}
                <button
                  type="button"
                  onClick={() => setIsAddSourceOpen(true)}
                  className="text-foreground underline underline-offset-2 hover:text-primary transition-colors cursor-pointer"
                >
                  tambahkan sumber
                </button>
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: CHAT */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-full justify-between p-4 max-w-lg mx-auto min-h-[calc(100vh-8.5rem)]">
            {/* Top Model Selector Pill */}
            <div className="flex items-center justify-between pb-3 select-none">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 hover:bg-muted border border-border/60 text-xs font-medium text-foreground transition-all cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-accent" />
                  <span>{currentModel.name}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>

                {isModelDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-56 rounded-2xl bg-card border border-border shadow-xl p-1.5 z-50">
                    {MOBILE_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(m.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer ${
                          selectedModelId === m.id
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <span>{m.name}</span>
                        {selectedModelId === m.id && (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-[10px] font-mono text-muted-foreground/70">
                100% Native Storage
              </span>
            </div>

            {/* Conversation Stream or Empty Greeting */}
            {messages.length === 0 ? (
              <div className="my-auto py-6">
                <div className="text-3xl mb-3 select-none">👋</div>
                <h1 className="text-xl font-serif font-medium tracking-tight text-foreground mb-2">
                  Ruang Belajar Socrates
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                  Dengan ruang belajar ini, Anda dapat memahami konsep rumit, membedah dokumen materi, atau menghasilkan simulasi bersama asisten cerdas.
                </p>
                <p className="text-xs text-muted-foreground/80 font-medium mb-3">
                  Apa yang ingin Anda eksplorasi?
                </p>

                <div className="flex flex-col gap-2">
                  {[
                    "Pelajari topik baru",
                    "Bedah materi & hipotesis",
                    "Buat ringkasan cerdas",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSend(chip)}
                      className="w-full text-left px-4 py-2.5 rounded-2xl bg-muted/50 hover:bg-muted border border-border/50 text-xs text-foreground transition-all cursor-pointer shadow-xs active:scale-98"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 my-2 flex-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    } w-full`}
                  >
                    {msg.role === "user" ? (
                      <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-muted text-foreground px-4 py-2 text-xs sm:text-sm border border-border/60 shadow-xs leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="w-full space-y-2">
                        {msg.thinking && (
                          <div className="w-full rounded-2xl bg-muted/30 border border-border/40 overflow-hidden text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedThinkingIds((prev) => ({
                                  ...prev,
                                  [msg.id]: !prev[msg.id],
                                }))
                              }
                              className="w-full px-3 py-1.5 flex items-center justify-between text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none bg-muted/20"
                            >
                              <div className="flex items-center gap-1.5">
                                <Brain className="h-3 w-3 text-purple-400" />
                                <span className="font-mono text-[10px] font-medium">
                                  DeepThinking
                                </span>
                              </div>
                              <ChevronDown
                                className={`h-3 w-3 transition-transform ${
                                  expandedThinkingIds[msg.id] ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {expandedThinkingIds[msg.id] && (
                              <div className="p-3 text-muted-foreground font-mono text-[10px] leading-relaxed border-t border-border/40 whitespace-pre-wrap max-h-40 overflow-y-auto bg-background/50">
                                {msg.thinking}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="w-full rounded-3xl rounded-tl-md bg-card/60 border border-border/60 p-3.5 text-xs sm:text-sm text-foreground shadow-xs leading-relaxed whitespace-pre-wrap relative">
                          {msg.content}

                          {msg.isStreaming && (
                            <span className="inline-block w-1.5 h-3 ml-1 bg-accent animate-pulse align-middle" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Mobile Chat Input Form */}
            <div className="pt-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="w-full bg-muted/40 rounded-full p-2 border border-border/70 focus-within:border-foreground/40 transition-all flex items-center justify-between gap-2 shadow-lg"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={isStreaming}
                  placeholder={
                    isStreaming
                      ? "Sedang memproses..."
                      : `Tanyakan apa saja kepada ${currentModel.name}...`
                  }
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none px-3 disabled:opacity-50"
                />

                <div className="flex items-center gap-1.5 shrink-0 pr-1">
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isStreaming}
                    className="h-8 w-8 rounded-full bg-foreground text-background hover:opacity-90 disabled:opacity-30 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                    aria-label="Kirim"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: TOOLS (STUDIO & ARTIFACTS) */}
        {activeTab === "tools" && (
          <div className="p-4 space-y-5 max-w-lg mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-foreground">Studio Tools</span>
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
                      handleSend(`Tolong buatkan ${tool.name} untuk notebook ini.`);
                    }}
                    className="p-2.5 rounded-2xl bg-muted/50 hover:bg-muted border border-border/50 transition-all flex flex-col justify-between h-20 text-left cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center justify-between w-full">
                      <Icon className={`h-4 w-4 ${tool.iconColor}`} />
                      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-40" />
                    </div>
                    <span className="text-[10px] font-normal text-foreground leading-tight line-clamp-2">
                      {tool.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Artifacts / Downloads Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-medium text-foreground">
                  File & Artifacts Hasil Generate
                </span>
                {artifacts && artifacts.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-mono text-muted-foreground">
                    {artifacts.length} file
                  </span>
                )}
              </div>

              {artifacts && artifacts.length > 0 ? (
                <div className="space-y-2">
                  {artifacts.map((art) => (
                    <div
                      key={art.id}
                      className="p-3 rounded-2xl bg-card/60 border border-border/60 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {art.isZip ? (
                          <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">
                            {art.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {art.isZip ? "ZIP Archive / Folder" : art.type}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadArtifact(art)}
                        className="h-8 px-3 rounded-full bg-muted hover:bg-muted/80 text-foreground text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-border/40 shrink-0"
                      >
                        <Download className="h-3 w-3" />
                        <span>Unduh</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-border/40 bg-muted/20 min-h-[140px]">
                  <div className="h-10 w-10 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-center text-muted-foreground/60 mb-2.5">
                    <PenTool className="h-5 w-5 stroke-[1.5]" />
                  </div>
                  <h3 className="text-xs font-medium text-foreground mb-1">
                    Belum ada artifacts atau file zip tersimpan
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[240px]">
                    Setiap folder zip atau file hasil komputasi sandbox akan muncul di sini dan dapat diunduh langsung.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FIXED BOTTOM NAVIGATION BAR: Sumber, Chat, Tools */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-md border-t border-border/50 flex items-center justify-around px-4 z-20">
        {/* Tab 1: Sumber */}
        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors cursor-pointer ${
            activeTab === "sources"
              ? "text-accent font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderOpen className="h-5 w-5" />
          <span className="text-[10px] mt-1 tracking-tight">Sumber</span>
        </button>

        {/* Tab 2: Chat */}
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors cursor-pointer ${
            activeTab === "chat"
              ? "text-accent font-medium"
              : "text-muted-foreground hover:text-foreground"
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
              ? "text-accent font-medium"
              : "text-muted-foreground hover:text-foreground"
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
          console.log("Selected source:", sourceType);
          setIsAddSourceOpen(false);
        }}
      />
    </div>
  );
}
