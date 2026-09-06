import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Folder,
  ChevronDown,
  ChevronUp,
  Plus,
  Hand,
  ArrowUp,
  Search,
  Check,
  FolderPlus,
  MessageSquare,
  ShieldAlert,
  Cpu,
  Square,
  Settings,
  Image as ImageIcon,
  AtSign,
  SquarePen,
  Globe,
  Play,
  FileText,
  X,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { ImageLightbox } from "./image-lightbox";

function formatTokenDisplay(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

function formatDurationDisplay(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m${remSec > 0 ? ` ${remSec}s` : ""}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: "image" | "video" | "pdf" | "markdown" | "code" | "document" | "other";
  url?: string;
  path?: string;
}

export interface ConversationMetrics {
  turns: number;
  steps: number;
  llmDurationMs: number;
  toolDurationMs: number;
  ttftSeconds: number;
  tokPerSec: number;
  cacheHitRate: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ContextUsageData {
  usedTokens: number;
  totalTokens: number;
  systemPromptTokens?: number;
  toolsTokens?: number;
  messagesTokens?: number;
}

interface ChatCardProps {
  onSendMessage?: (payload: {
    prompt: string;
    project: string;
    mode: "ask_before_changes" | "full_access";
    model?: string;
    attachments?: AttachedFile[];
  }) => void;
  isExecuting?: boolean;
  onAbort?: () => void;
  compact?: boolean;
  contextUsage?: ContextUsageData;
  metrics?: ConversationMetrics;
  project?: string;
  onProjectChange?: (project: string) => void;
  onOpenSettings?: () => void;
  initialPrompt?: string;
}

export function ChatCard({
  onSendMessage,
  isExecuting = false,
  onAbort,
  compact = false,
  contextUsage,
  metrics,
  project: initialProject,
  onProjectChange,
  onOpenSettings,
  initialPrompt,
}: ChatCardProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Attachments & Plus Menu State
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [previewItem, setPreviewItem] = useState<AttachedFile | null>(null);
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPrompt !== undefined && initialPrompt !== "") {
      setPrompt(initialPrompt);
      textareaRef.current?.focus();
    }
  }, [initialPrompt]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAttached: AttachedFile[] = [];
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      let type: AttachedFile["type"] = "other";
      if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) {
        type = "image";
      } else if (["mp4", "webm", "mov", "mkv"].includes(ext)) {
        type = "video";
      } else if (ext === "pdf") {
        type = "pdf";
      } else if (["md", "markdown"].includes(ext)) {
        type = "markdown";
      } else if (
        ["ts", "tsx", "js", "jsx", "json", "py", "rs", "go", "cpp", "c", "h", "css", "html"].includes(ext)
      ) {
        type = "code";
      } else if (["txt", "doc", "docx", "xls", "xlsx", "csv"].includes(ext)) {
        type = "document";
      }

      const url = URL.createObjectURL(file);
      newAttached.push({
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        type,
        url,
        path: (file as any).path,
      });
    });

    setAttachments((prev) => [...prev, ...newAttached]);
    setIsPlusOpen(false);
    if (e.target) e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // 1. Workspace / Project Selector State (Clean, zero dummy projects)
  const [currentProject, setCurrentProject] = useState<string>(() => {
    return initialProject || localStorage.getItem("const_harness_current_project") || "Outside Project";
  });

  useEffect(() => {
    if (initialProject !== undefined) {
      setCurrentProject(initialProject);
    }
  }, [initialProject]);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [searchWorkspace, setSearchWorkspace] = useState("");
  const [workspaces, setWorkspaces] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("const_harness_workspaces");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // 2. Access Mode State (Only 2 options: ask_before_changes & full_access)
  const [mode, setMode] = useState<"ask_before_changes" | "full_access">("full_access");
  const [isModeOpen, setIsModeOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  // 3. Model Selector State (Persistent in localStorage & ~/.const/config.json)
  const quota = useQuery(api.router.quotas.getUserQuota, {});
  interface ModelItem {
    id: string;
    name: string;
    desc?: string;
    provider: string;
    providerName: string;
  }
  const isConstProvider = (p?: string) => {
    if (!p) return true;
    const clean = p.toLowerCase().trim();
    return (
      clean === "const" ||
      clean === "const-engine" ||
      clean === "const engine" ||
      clean === "const router" ||
      clean === "native" ||
      clean.startsWith("const")
    );
  };

  const [models, setModels] = useState<ModelItem[]>([
    {
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash",
      desc: "Included in 7M Free Weekly Quota",
      provider: "const",
      providerName: "Const",
    },
  ]);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const toggleProvider = (providerId: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const groupedModels = useMemo(() => {
    const map = new Map<string, { providerId: string; providerName: string; items: ModelItem[] }>();
    for (const m of models) {
      const isConst = isConstProvider(m.provider);
      const pid = isConst ? "const" : (m.provider || "custom");
      const pname = isConst ? "Const" : (m.providerName || "Custom");
      if (!map.has(pid)) {
        map.set(pid, { providerId: pid, providerName: pname, items: [] });
      }
      map.get(pid)!.items.push(m);
    }
    return Array.from(map.values());
  }, [models]);

  const [selectedModel, setSelectedModel] = useState<string | null>(() => {
    const saved = localStorage.getItem("const_harness_active_model");
    if (!saved || saved === "Const" || saved.includes("(Const Router)") || saved.includes("(Native)")) {
      return "Gemini 3.6 Flash";
    }
    return saved;
  });
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Fetch available models and user config from engine
  useEffect(() => {
    if (window.electron?.getModels) {
      window.electron
        .getModels()
        .then((items: any[]) => {
          if (items && items.length > 0) {
            setModels(
              items.map((m: any) => {
                const isConst = isConstProvider(m.provider);
                return {
                  id: m.id,
                  name: m.displayName || m.id,
                  desc: m.supportsThinking
                    ? "Supports thinking & tools"
                    : m.supportsTools
                    ? "Supports tools"
                    : undefined,
                  provider: isConst ? "const" : (m.provider || "custom"),
                  providerName: isConst ? "Const" : (m.providerName || "Custom"),
                };
              })
            );
            const saved = localStorage.getItem("const_harness_active_model");
            if (!saved) {
              const first = items[0];
              if (first) {
                const initialName = first.displayName || first.id;
                setSelectedModel(initialName);
                localStorage.setItem("const_harness_active_model", initialName);
              }
            }
          }
        })
        .catch(() => {});
    }

    if (window.electron?.getConfig) {
      window.electron.getConfig().then((cfg) => {
        if (cfg?.activeModel) {
          setSelectedModel(cfg.activeModel);
          localStorage.setItem("const_harness_active_model", cfg.activeModel);
        }
      }).catch(() => {});
    }
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setIsProjectOpen(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(target)) {
        setIsModeOpen(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setIsModelOpen(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setIsContextOpen(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(target)) {
        setIsPlusOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProjectOpen(false);
        setIsModeOpen(false);
        setIsModelOpen(false);
        setIsContextOpen(false);
        setIsPlusOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Viewport element from Radix ScrollArea
    const viewport = textarea.closest(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
    const prevScrollTop = viewport ? viewport.scrollTop : 0;

    // Temporarily reset height to auto to measure accurate scrollHeight
    textarea.style.height = "auto";
    const nextHeight = Math.max(24, textarea.scrollHeight);
    textarea.style.height = `${nextHeight}px`;

    // Handle scroll position in viewport
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
    adjustHeight();
  }, [prompt]);

  const handleOpenFolder = async () => {
    setIsProjectOpen(false);
    if (window.electron?.openDirectoryDialog) {
      const selectedDir = await window.electron.openDirectoryDialog();
      if (selectedDir) {
        setWorkspaces((prev) => {
          const next = prev.includes(selectedDir) ? prev : [selectedDir, ...prev];
          localStorage.setItem("const_harness_workspaces", JSON.stringify(next));
          return next;
        });
        setCurrentProject(selectedDir);
        onProjectChange?.(selectedDir);
        localStorage.setItem("const_harness_current_project", selectedDir);
      }
    }
  };

  const handleSend = () => {
    if ((!prompt.trim() && attachments.length === 0) || isExecuting) return;
    const text = prompt.trim();
    const currentAttachments = [...attachments];
    setPrompt("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }
    const matchedModel = models.find((m) => m.name === selectedModel || m.id === selectedModel);
    onSendMessage?.({
      prompt: text,
      project: currentProject,
      mode,
      model: matchedModel?.id || "gemini-3.6-flash",
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    });
  };

  const displayProjectName =
    currentProject === "Outside Project"
      ? "Outside Project"
      : currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject;

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.toLowerCase().includes(searchWorkspace.toLowerCase())
  );

  const usedTokens = contextUsage?.usedTokens || 33800;
  const totalTokens = contextUsage?.totalTokens || 1_000_000;
  const systemPromptTokens = contextUsage?.systemPromptTokens || 9200;
  const toolsTokens = contextUsage?.toolsTokens || 224;
  const messagesTokens = contextUsage?.messagesTokens || Math.max(0, usedTokens - systemPromptTokens - toolsTokens);
  const percentUsed = Math.max(1, Math.min(100, Math.round((usedTokens / totalTokens) * 100)));

  return (
    <div className="w-full flex flex-col items-center gap-2 select-none">
      {/* Unified Card */}
      <div
        className={`w-full rounded-2xl border border-[#383838] select-none transition-colors ${
          compact ? "bg-[#2b2b2b]" : "bg-[#222222]"
        }`}
      >
        {/* Top Header Strip: Choose Project in #222222 (Only visible in landing view) */}
        {!compact && (
          <div className="w-full px-3.5 pt-2 pb-1.5 flex items-center relative">
            <div className="relative" ref={projectMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsProjectOpen((prev) => !prev);
                  setIsModeOpen(false);
                  setIsModelOpen(false);
                  setIsContextOpen(false);
                }}
                className="inline-flex items-center gap-1.5 text-[13px] text-[#d4d4d4] hover:text-white transition-colors cursor-pointer font-sans"
                title={currentProject}
              >
                <Folder className="w-3.5 h-3.5 text-[#5d5d5d]" />
                <span>{displayProjectName}</span>
                <ChevronDown className="w-3 h-3 text-[#5d5d5d] ml-0.5" />
              </button>

              {/* Choose Project Dropdown Popover */}
              {isProjectOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 sm:w-72 bg-[#222222] border border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                  {/* Real Workspaces List (only shown if real folders were opened) */}
                  {workspaces.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 border-b border-[#383838]/60">
                        <Search className="w-3.5 h-3.5 text-[#5d5d5d] shrink-0" />
                        <input
                          type="text"
                          value={searchWorkspace}
                          onChange={(e) => setSearchWorkspace(e.target.value)}
                          placeholder="Search workspaces"
                          className="w-full bg-transparent text-[13px] text-[#d4d4d4] placeholder:text-[#5d5d5d] outline-none font-sans"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 py-0.5">
                        {filteredWorkspaces.map((ws) => {
                          const wsName = ws.replace(/\\/g, "/").split("/").filter(Boolean).pop() || ws;
                          return (
                            <button
                              key={ws}
                              type="button"
                              onClick={() => {
                                setCurrentProject(ws);
                                onProjectChange?.(ws);
                                localStorage.setItem("const_harness_current_project", ws);
                                setIsProjectOpen(false);
                              }}
                              className="w-full px-2.5 py-1.5 flex items-center justify-between text-[13px] text-[#d4d4d4] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                              title={ws}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Folder className="w-3.5 h-3.5 text-[#5d5d5d] shrink-0" />
                                <div className="flex flex-col text-left truncate">
                                  <span className="truncate">{wsName}</span>
                                  <span className="text-[10px] text-[#777777] truncate">{ws}</span>
                                </div>
                              </div>
                              {currentProject === ws && (
                                <Check className="w-3.5 h-3.5 text-[#d4d4d4] shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="h-[1px] bg-[#383838]/60 my-1" />
                    </>
                  )}

                  {/* Real Action Items */}
                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[13px] text-[#d4d4d4] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#5d5d5d] shrink-0" />
                    <span>Open folder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentProject("Outside Project");
                      onProjectChange?.("Outside Project");
                      localStorage.setItem("const_harness_current_project", "Outside Project");
                      setIsProjectOpen(false);
                    }}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between text-[13px] text-[#d4d4d4] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-[#5d5d5d] shrink-0" />
                      <span>Work outside a project</span>
                    </div>
                    {currentProject === "Outside Project" && (
                      <Check className="w-3.5 h-3.5 text-[#d4d4d4] shrink-0" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Input Box: Background is #2b2b2b with #d4d4d4 text */}
        <div
          className={`w-full bg-[#2b2b2b] rounded-2xl ${
            compact ? "" : "border-t border-[#383838]"
          } px-3.5 pt-2.5 pb-2.5 flex flex-col justify-between transition-colors focus-within:border-[#555555]`}
        >
          {/* Attachments Shelf (Full Previews for Images, Videos, PDFs, Docs) */}
          {attachments.length > 0 && (
            <div className="w-full flex items-center gap-2.5 pb-2.5 overflow-x-auto select-none">
              {attachments.map((file) => {
                const isMedia = file.type === "image" || file.type === "video";
                if (isMedia) {
                  return (
                    <div
                      key={file.id}
                      onClick={() => setPreviewItem(file)}
                      className="group relative w-16 h-16 rounded-xl overflow-hidden border border-[#383838] hover:border-white/40 bg-black/40 shrink-0 cursor-pointer transition-all shadow-sm"
                    >
                      {file.type === "image" && file.url ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover block"
                        />
                      ) : (
                        <div className="w-full h-full relative bg-[#1c1c1c] flex items-center justify-center">
                          {file.url && (
                            <video
                              src={file.url}
                              className="w-full h-full object-cover block pointer-events-none"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white/80" />
                          </div>
                        </div>
                      )}

                      {/* Tooltip overlay on hover */}
                      <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5 text-[10px] text-white pointer-events-none">
                        <span className="truncate font-medium" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[#a0a0a0] font-mono">
                          {formatFileSize(file.size)}
                        </span>
                      </div>

                      {/* Close button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(file.id);
                        }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-[#e11d48] text-white flex items-center justify-center border border-white/20 shadow-md transition-colors cursor-pointer z-20"
                        title="Remove attachment"
                      >
                        <X className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={file.id}
                    onClick={() => setPreviewItem(file)}
                    className="group relative flex items-center gap-2 bg-[#1b1b1b] hover:bg-[#222222] border border-[#383838] rounded-xl px-2.5 py-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <FileText className="w-5 h-5 text-[#ff7a00] shrink-0" />
                    <div className="flex flex-col min-w-0 max-w-[180px]">
                      <span className="text-[12px] text-[#d4d4d4] font-medium truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-[10px] text-[#777777] font-mono">
                        {formatFileSize(file.size)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(file.id);
                      }}
                      className="ml-1 p-0.5 rounded-full hover:bg-white/10 text-[#777777] hover:text-[#e11d48] transition-colors cursor-pointer"
                      title="Remove attachment"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Auto-growing Textarea with ScrollArea */}
          <ScrollArea className="w-full max-h-52 [&>div>div[style]]:!block pr-1.5">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                adjustHeight();
              }}
              rows={1}
              placeholder={
                compact
                  ? "Message or run a task... / commands, @ files or sessions"
                  : "Ask Const anything, @ to add context, / for commands or capabilities"
              }
              className="w-full resize-none bg-transparent text-[14px] leading-5 text-[#d4d4d4] placeholder:text-[#5d5d5d] outline-none font-sans overflow-hidden py-0.5 block"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </ScrollArea>

          {/* Bottom Actions Row: Plus, Hand/Shield, Context Window, Model Selector, Send Button */}
          <div className="flex items-center justify-between pt-2.5 text-xs relative">
            {/* Left Actions: Plus and Mode Selector */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Plus Button & Add Context Dropdown */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlusOpen((prev) => !prev);
                    setIsProjectOpen(false);
                    setIsModeOpen(false);
                    setIsModelOpen(false);
                    setIsContextOpen(false);
                  }}
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                    isPlusOpen
                      ? "text-white bg-white/10"
                      : "text-[#5d5d5d] hover:text-[#d4d4d4] hover:bg-white/5"
                  )}
                  title="Add context"
                  aria-label="Add context"
                >
                  <Plus className="w-4 h-4 stroke-[1.75]" />
                </button>

                {/* Hidden File Input for Media */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/*,video/*,audio/*,.pdf,.md,.markdown,.txt,.json,.js,.jsx,.ts,.tsx,.py,.rs,.go,.cpp,.c,.h,.css,.html,.csv,.doc,.docx"
                />

                {/* Add Context Popover Menu (Image 2) */}
                {isPlusOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-44 bg-[#1e1e1e] border border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[11px] font-medium text-[#777777]">
                      Add Context
                    </div>

                    {/* 1. Media */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-white/5 text-[#d4d4d4] hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <ImageIcon className="w-4 h-4 text-[#888888] group-hover:text-white shrink-0" />
                      <span className="text-[13px]">Media</span>
                    </button>

                    {/* 2. Mentions */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusOpen(false);
                        setPrompt((prev) => (prev ? `${prev} @` : "@"));
                        textareaRef.current?.focus();
                      }}
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-white/5 text-[#d4d4d4] hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <AtSign className="w-4 h-4 text-[#888888] group-hover:text-white shrink-0" />
                      <span className="text-[13px]">Mentions</span>
                    </button>

                    {/* 3. Actions */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusOpen(false);
                        setPrompt((prev) => (prev ? `${prev} /` : "/"));
                        textareaRef.current?.focus();
                      }}
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-white/5 text-[#d4d4d4] hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <SquarePen className="w-4 h-4 text-[#888888] group-hover:text-white shrink-0" />
                      <span className="text-[13px]">Actions</span>
                    </button>

                    {/* 4. Browser */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusOpen(false);
                        setPrompt((prev) => (prev ? `${prev} @browser ` : "@browser "));
                        textareaRef.current?.focus();
                      }}
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-white/5 text-[#d4d4d4] hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <Globe className="w-4 h-4 text-[#888888] group-hover:text-white shrink-0" />
                      <span className="text-[13px]">Browser</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mode Selector Dropdown */}
              <div className="relative" ref={modeMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsModeOpen((prev) => !prev);
                    setIsProjectOpen(false);
                    setIsModelOpen(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] font-normal transition-colors cursor-pointer ${
                    mode === "full_access"
                      ? "text-[#ff7a00] hover:bg-[#ff7a00]/10"
                      : "text-[#d4d4d4] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {mode === "full_access" ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-[#ff7a00] stroke-[1.75]" />
                  ) : (
                    <Hand className="w-3.5 h-3.5 text-[#5d5d5d] stroke-[1.75]" />
                  )}
                  <span>
                    {mode === "full_access" ? "Full access" : "Ask before changes"}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 ml-0.5 ${
                      mode === "full_access" ? "text-[#ff7a00]" : "text-[#5d5d5d]"
                    }`}
                  />
                </button>

                {/* Mode Selector Popover (Only 2 items: Ask before changes & Full access) */}
                {isModeOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-64 sm:w-72 bg-[#222222] border border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    {/* 1. Ask before changes */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("ask_before_changes");
                        setIsModeOpen(false);
                      }}
                      className="w-full p-2.5 flex items-start gap-2.5 rounded-xl hover:bg-white/5 text-left transition-colors cursor-pointer group"
                    >
                      <Hand className="w-4 h-4 text-[#d4d4d4] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] font-normal text-[#d4d4d4] group-hover:text-white">
                          Ask before changes
                        </div>
                        <div className="text-[12px] text-[#888888] leading-tight mt-0.5">
                          Ask before file changes.
                        </div>
                      </div>
                      {mode === "ask_before_changes" && (
                        <Check className="w-3.5 h-3.5 text-[#d4d4d4] shrink-0 ml-auto mt-0.5" />
                      )}
                    </button>

                    {/* 2. Full access */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("full_access");
                        setIsModeOpen(false);
                      }}
                      className="w-full p-2.5 flex items-start gap-2.5 rounded-xl hover:bg-white/5 text-left transition-colors cursor-pointer group"
                    >
                      <ShieldAlert className="w-4 h-4 text-[#ff7a00] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] font-normal text-[#d4d4d4] group-hover:text-white">
                          Full access
                        </div>
                        <div className="text-[12px] text-[#888888] leading-tight mt-0.5">
                          Run with fewer confirmations.
                        </div>
                      </div>
                      {mode === "full_access" && (
                        <Check className="w-3.5 h-3.5 text-[#d4d4d4] shrink-0 ml-auto mt-0.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Actions: Context Window (1st, only if compact), Model Selector (2nd), Send Button (3rd) */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* 1. Context Windows Indicator & Detailed Popover (Image 3 - Only visible when conversation is active) */}
              {compact && (
                <div className="relative" ref={contextMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsContextOpen((prev) => !prev);
                      setIsModelOpen(false);
                      setIsModeOpen(false);
                      setIsProjectOpen(false);
                      setIsPlusOpen(false);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-[#777777] hover:text-[#d4d4d4] hover:bg-white/5 transition-colors cursor-pointer"
                    title="Context window usage"
                    aria-label="Context window usage"
                  >
                    <svg
                      className="w-3.5 h-3.5 transform -rotate-90 text-[#777777] hover:text-[#d4d4d4]"
                      viewBox="0 0 24 24"
                    >
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
                        strokeDasharray={56.5}
                        strokeDashoffset={
                          56.5 - (56.5 * Math.min(100, Math.max(3, percentUsed))) / 100
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {/* Context Window Popover (Image 3) */}
                  {isContextOpen && (
                    <div className="absolute bottom-full mb-2 right-0 w-80 bg-[#1e1e1e] border border-[#383838] rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3 text-left select-none animate-in fade-in zoom-in-95 duration-100">
                      {/* Header: % of context used and tokens */}
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-white font-medium">
                          {percentUsed}% of context used
                        </span>
                        <span className="font-mono text-[12px] text-[#a0a0a0]">
                          ~{formatTokenDisplay(usedTokens)} / {totalTokens >= 1_000_000 ? `${(totalTokens / 1_000_000).toFixed(0)}M` : `${(totalTokens / 1000).toFixed(0)}K`}
                        </span>
                      </div>

                      {/* Multi-segment Horizontal Progress Bar (Image 3) */}
                      <div className="w-full h-2 bg-[#2d2d2d] rounded-full overflow-hidden flex gap-0.5">
                        <div
                          className="bg-[#71717a] h-full rounded-l-full transition-all"
                          style={{
                            width: `${Math.max(1, (systemPromptTokens / totalTokens) * 100)}%`,
                          }}
                          title={`System prompt: ~${formatTokenDisplay(systemPromptTokens)}`}
                        />
                        <div
                          className="bg-[#a855f7] h-full transition-all"
                          style={{
                            width: `${Math.max(1, (toolsTokens / totalTokens) * 100)}%`,
                          }}
                          title={`Tools: ~${formatTokenDisplay(toolsTokens)}`}
                        />
                        <div
                          className="bg-[#3b82f6] h-full rounded-r-full transition-all"
                          style={{
                            width: `${Math.max(1, (messagesTokens / totalTokens) * 100)}%`,
                          }}
                          title={`Messages: ~${formatTokenDisplay(messagesTokens)}`}
                        />
                      </div>

                      {/* Legend / Breakdown List (Image 3) */}
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-xs bg-[#71717a] shrink-0" />
                            <span className="text-[#d4d4d4]">System prompt</span>
                          </div>
                          <span className="font-mono text-[#d4d4d4]">
                            ~{formatTokenDisplay(systemPromptTokens)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-xs bg-[#a855f7] shrink-0" />
                            <span className="text-[#d4d4d4]">Tools</span>
                          </div>
                          <span className="font-mono text-[#d4d4d4]">
                            ~{formatTokenDisplay(toolsTokens)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-xs bg-[#3b82f6] shrink-0" />
                            <span className="text-[#d4d4d4]">Messages</span>
                          </div>
                          <span className="font-mono text-[#d4d4d4]">
                            ~{formatTokenDisplay(messagesTokens)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Model Selector Dropdown (Const ∨) */}
              <div className="relative" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsModelOpen((prev) => !prev);
                    setIsProjectOpen(false);
                    setIsModeOpen(false);
                    setIsContextOpen(false);
                    setIsPlusOpen(false);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[#d4d4d4] hover:text-white hover:bg-white/5 text-[13px] font-normal transition-colors cursor-pointer"
                >
                  <span>{selectedModel || "Manage model"}</span>
                  <ChevronDown className="w-3 h-3 text-[#5d5d5d] ml-0.5" />
                </button>

                {/* Model Selector Popover */}
                {isModelOpen && (
                  <div className="absolute bottom-full mb-2 right-0 w-72 bg-[#222222] border border-[#383838] rounded-2xl shadow-2xl p-2 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    {models.length > 0 ? (
                      <>
                        <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] font-medium tracking-wider text-[#969696] border-b border-[#383838]/40 mb-1.5">
                          <span className="uppercase tracking-wider">Models</span>
                          {quota && (
                            <span className="text-[10px] text-[#4ade80] font-mono">
                              {formatTokenDisplay(quota.remainingTokens)} left
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 pr-0.5">
                          {groupedModels.map((group) => {
                            const isExpanded = Boolean(expandedProviders[group.providerId]);
                            return (
                              <div key={group.providerId} className="flex flex-col">
                                {/* Collapsible Models List under this Provider */}
                                {isExpanded && (
                                  <div className="pl-3 pr-1 py-0.5 border-l border-[#383838]/40 ml-3.5 mb-1.5">
                                    <ScrollArea className="max-h-56">
                                      <div className="space-y-0.5 pr-2">
                                        {group.items.map((m) => {
                                          const isSelected =
                                            selectedModel === m.name || selectedModel === m.id;
                                          return (
                                            <button
                                              key={m.id}
                                              type="button"
                                              onClick={() => {
                                                setSelectedModel(m.name);
                                                localStorage.setItem("const_harness_active_model", m.name);
                                                window.electron?.saveConfig?.({ activeModel: m.id });
                                                setIsModelOpen(false);
                                              }}
                                              className={cn(
                                                "w-full px-2 py-1.5 flex items-center justify-between text-[12px] rounded-lg transition-colors cursor-pointer",
                                                isSelected
                                                  ? "bg-white/10 text-white font-medium"
                                                  : "text-[#d4d4d4] hover:text-white hover:bg-white/5"
                                              )}
                                            >
                                              <div className="flex flex-col text-left">
                                                <span className="font-normal">{m.name}</span>
                                                {m.desc && (
                                                  <span className="text-[10px] text-[#888888] leading-tight mt-0.5">
                                                    {m.desc}
                                                  </span>
                                                )}
                                              </div>
                                              {isSelected && (
                                                <Check className="w-3.5 h-3.5 text-[#d4d4d4] shrink-0 ml-2" />
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </ScrollArea>
                                  </div>
                                )}

                                {/* Provider Accordion Trigger Row */}
                                <button
                                  type="button"
                                  onClick={() => toggleProvider(group.providerId)}
                                  className="w-full px-2.5 py-1.5 flex items-center justify-between text-[12px] font-medium text-[#d4d4d4] hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center">
                                    <span className="text-[#d4d4d4] group-hover:text-white font-medium text-[13px]">
                                      {group.providerName}
                                    </span>
                                  </div>
                                  <div className="flex items-center">
                                    {isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-[#888888] group-hover:text-[#d4d4d4] shrink-0 transition-transform" />
                                    ) : (
                                      <ChevronUp className="w-3.5 h-3.5 text-[#888888] group-hover:text-[#d4d4d4] shrink-0 transition-transform" />
                                    )}
                                  </div>
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Bottom Footer: Manage models */}
                        <div className="h-[1px] bg-[#383838]/60 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsModelOpen(false);
                            onOpenSettings?.();
                          }}
                          className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] text-[#969696] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5 text-[#777777] shrink-0" />
                          <span>Manage models</span>
                        </button>
                      </>
                    ) : (
                      <div className="p-3.5 flex flex-col items-center text-center">
                        <div className="w-9 h-9 rounded-xl bg-[#2a2a2a] border border-[#383838] flex items-center justify-center text-[#d4d4d4] mb-2.5 shadow-sm">
                          <Cpu className="w-4 h-4 text-[#d4d4d4] stroke-[1.75]" />
                        </div>
                        <div className="text-[13px] font-medium text-[#d4d4d4]">
                          No models configured
                        </div>
                        <p className="text-[11px] text-[#888888] leading-relaxed mt-1 mb-3.5">
                          Connect or configure model providers to start executing tasks.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsModelOpen(false);
                            onOpenSettings?.();
                          }}
                          className="w-full py-1.5 px-3 rounded-lg bg-[#333333] hover:bg-[#3d3d3d] border border-[#444444]/60 text-[12px] font-medium text-[#d4d4d4] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#d4d4d4]" />
                          <span>Manage models</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Send or Stop Generation Button */}
              {isExecuting ? (
                <button
                  type="button"
                  onClick={onAbort}
                  className="w-7 h-7 rounded-lg bg-[#383838] hover:bg-[#454545] text-[#ff7a00] flex items-center justify-center cursor-pointer select-none transition-colors"
                  title="Stop generation"
                  aria-label="Stop generation"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!prompt.trim() && attachments.length === 0}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center select-none transition-all ${
                    prompt.trim() || attachments.length > 0
                      ? "bg-[#d4d4d4] text-[#161616] hover:bg-white cursor-pointer shadow-sm active:scale-95"
                      : "bg-[#48484e]/60 text-[#888888] cursor-not-allowed"
                  }`}
                  title="Send message"
                  aria-label="Send message"
                >
                  <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Conversation Footer Info Bar (Option A: Condensed, No Scrollbar) */}
      {compact && metrics && (
        <div
          className="w-full flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-[#888888] pt-1 pb-0.5 select-none overflow-hidden"
          title="Session telemetry metrics"
        >
          <span title={`${metrics.turns} conversation turns, ${metrics.steps} tool execution steps`}>
            {metrics.turns} turns · {metrics.steps} steps
          </span>
          <span className="text-[#444444]">|</span>
          <span title={`LLM duration: ${formatDurationDisplay(metrics.llmDurationMs)} · Tools duration: ${formatDurationDisplay(metrics.toolDurationMs)}`}>
            LLM {formatDurationDisplay(metrics.llmDurationMs)} · Tools {formatDurationDisplay(metrics.toolDurationMs)}
          </span>
          <span className="text-[#444444]">|</span>
          <span title={`Average TTFT: ${metrics.ttftSeconds.toFixed(1)}s · Generation speed: ${metrics.tokPerSec} tok/s`}>
            {metrics.tokPerSec} tok/s
          </span>
          <span className="text-[#444444]">|</span>
          <span title={`Prompt cache hit rate: ${metrics.cacheHitRate}%`}>
            {metrics.cacheHitRate}% cache
          </span>
          <span className="text-[#444444]">|</span>
          <span title={`Input: ${metrics.inputTokens.toLocaleString()} tokens · Output: ${metrics.outputTokens.toLocaleString()} tokens`}>
            ↑{formatTokenDisplay(metrics.inputTokens)} · ↓{formatTokenDisplay(metrics.outputTokens)} tok
          </span>
        </div>
      )}

      {/* Media Lightbox Preview Modal */}
      {previewItem && (
        <ImageLightbox
          src={previewItem.url || ""}
          alt={previewItem.name}
          type={previewItem.type}
          fileSize={previewItem.size}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
