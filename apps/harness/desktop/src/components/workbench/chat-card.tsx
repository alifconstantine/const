import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  ChevronDown,
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
} from "lucide-react";
import { ScrollArea } from "@const/ui";

interface ChatCardProps {
  onSendMessage?: (payload: {
    prompt: string;
    project: string;
    mode: "ask_before_changes" | "full_access";
    model?: string;
  }) => void;
  isExecuting?: boolean;
  onAbort?: () => void;
  compact?: boolean;
  contextUsage?: {
    usedTokens: number;
    totalTokens: number;
  };
  project?: string;
  onProjectChange?: (project: string) => void;
  onOpenSettings?: () => void;
}

export function ChatCard({
  onSendMessage,
  isExecuting = false,
  onAbort,
  compact = false,
  contextUsage,
  project: initialProject,
  onProjectChange,
  onOpenSettings,
}: ChatCardProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

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
  const [models, setModels] = useState<{ id: string; name: string; desc?: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(() => {
    return localStorage.getItem("const_harness_active_model") || null;
  });
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Fetch available models and user config from engine
  useEffect(() => {
    if (window.electron?.getModels) {
      window.electron
        .getModels()
        .then((items) => {
          if (items && items.length > 0) {
            setModels(
              items.map((m) => ({
                id: m.id,
                name: m.displayName || m.id,
                desc: m.supportsThinking
                  ? "Supports thinking & tools"
                  : m.supportsTools
                  ? "Supports tools"
                  : undefined,
              }))
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
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProjectOpen(false);
        setIsModeOpen(false);
        setIsModelOpen(false);
        setIsContextOpen(false);
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
    if (!prompt.trim() || isExecuting) return;
    const text = prompt.trim();
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }
    const matchedModel = models.find((m) => m.name === selectedModel);
    onSendMessage?.({
      prompt: text,
      project: currentProject,
      mode,
      model: matchedModel?.id || "Const",
    });
  };

  const displayProjectName =
    currentProject === "Outside Project"
      ? "Outside Project"
      : currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject;

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.toLowerCase().includes(searchWorkspace.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col items-center gap-3 select-none">
      {/* Unified Card: Top header background is #222222 */}
      <div className="w-full rounded-2xl bg-[#222222] border border-[#383838] select-none transition-colors">
        {/* Top Header Strip: Choose Project in #222222 */}
        <div className="w-full px-3.5 pt-2 pb-1.5 flex items-center relative">
          <div className="relative" ref={projectMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsProjectOpen((prev) => !prev);
                setIsModeOpen(false);
                setIsModelOpen(false);
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

        {/* AI Input Box: Background is #2b2b2b with #d4d4d4 text and #5d5d5d placeholder */}
        <div className="w-[calc(100%+2px)] -mx-[1px] -mb-[1px] bg-[#2b2b2b] rounded-2xl border border-[#383838] px-3.5 pt-2.5 pb-2.5 flex flex-col justify-between transition-colors focus-within:border-[#555555]">
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
                  ? "Ask for follow-up changes"
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

          {/* Bottom Actions Row: Plus, Hand/Shield, Model Selector, Send Button */}
          <div className="flex items-center justify-between pt-2.5 text-xs relative">
            {/* Left Actions: Plus and Mode Selector */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="w-6 h-6 flex items-center justify-center rounded-md text-[#5d5d5d] hover:text-[#d4d4d4] hover:bg-white/5 transition-colors cursor-pointer"
                title="Add context"
                aria-label="Add context"
              >
                <Plus className="w-4 h-4 stroke-[1.75]" />
              </button>

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

            {/* Right Actions: Model Pill & Send Button */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Model Selector Dropdown */}
              <div className="relative" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsModelOpen((prev) => !prev);
                    setIsProjectOpen(false);
                    setIsModeOpen(false);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[#d4d4d4] hover:text-white hover:bg-white/5 text-[13px] font-normal transition-colors cursor-pointer"
                >
                  <span>{selectedModel || "Manage model"}</span>
                  <ChevronDown className="w-3 h-3 text-[#5d5d5d] ml-0.5" />
                </button>

                {/* Model Selector Popover */}
                {isModelOpen && (
                  <div className="absolute bottom-full mb-2 right-0 w-64 bg-[#222222] border border-[#383838] rounded-2xl shadow-2xl p-2 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    {models.length > 0 ? (
                      <>
                        <div className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[#969696]">
                          Models
                        </div>
                        {models.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedModel(m.name);
                              localStorage.setItem("const_harness_active_model", m.name);
                              window.electron?.saveConfig?.({ activeModel: m.id || m.name });
                              setIsModelOpen(false);
                            }}
                            className="w-full px-2.5 py-2 flex items-center justify-between text-[13px] text-[#d4d4d4] hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                          >
                            <div className="flex flex-col text-left">
                              <span className="font-normal text-[#d4d4d4]">{m.name}</span>
                              {m.desc && (
                                <span className="text-[11px] text-[#888888]">{m.desc}</span>
                              )}
                            </div>
                            {selectedModel === m.name && (
                              <Check className="w-3.5 h-3.5 text-[#d4d4d4] shrink-0" />
                            )}
                          </button>
                        ))}
                        <div className="h-[1px] bg-[#383838]/60 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsModelOpen(false);
                            onOpenSettings?.();
                          }}
                          className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] text-[#969696] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5 text-[#5d5d5d] shrink-0" />
                          <span>Manage models & providers...</span>
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

              {/* Context Windows Indicator (Image 4) */}
              {compact && (
                <div className="relative" ref={contextMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsContextOpen((prev) => !prev)}
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
                          56.5 -
                          (56.5 *
                            Math.min(
                              100,
                              Math.max(
                                5,
                                ((contextUsage?.usedTokens || 58400) /
                                  (contextUsage?.totalTokens || 200000)) *
                                  100
                              )
                            )) /
                            100
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {/* Context Window Popover (Image 4) */}
                  {isContextOpen && (
                    <div className="absolute bottom-full mb-2 right-0 w-72 bg-[#1e1e1e] border border-[#383838] rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2 text-left select-none animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-white font-medium">Context windows</span>
                        <span className="font-mono text-[#888888]">
                          {((contextUsage?.usedTokens || 58400) / 1000).toFixed(1)}K/
                          {((contextUsage?.totalTokens || 200000) / 1000).toFixed(0)}K (
                          {(
                            ((contextUsage?.usedTokens || 58400) /
                              (contextUsage?.totalTokens || 200000)) *
                            100
                          ).toFixed(1)}
                          %)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#2c2c2c] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                5,
                                ((contextUsage?.usedTokens || 58400) /
                                  (contextUsage?.totalTokens || 200000)) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Send or Stop Generation Button */}
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
                  disabled={!prompt.trim()}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center select-none transition-all ${
                    prompt.trim()
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
    </div>
  );
}
