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
  Brain,
} from "lucide-react";
import {
  ScrollArea,
  cn,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { ImageLightbox } from "./image-lightbox";
import { AttachedTaskBanner } from "./attached-task-banner";
import type { BackgroundTaskItem } from "../../vite-env";

function getThinkingDescription(lvl: string): string {
  switch (lvl.toLowerCase()) {
    case "low":
      return "Fast reasoning";
    case "medium":
      return "Balanced thinking";
    case "high":
      return "Thorough analysis";
    case "xhigh":
      return "Extended reasoning";
    case "max":
      return "Maximum depth";
    case "minimal":
      return "Minimal tokens";
    case "off":
      return "No thinking";
    default:
      return `${lvl} effort`;
  }
}

function formatTokenDisplay(tokens: number): string {
  if (!tokens || isNaN(tokens) || tokens <= 0) return "0";
  const rounded = Math.round(tokens);
  if (rounded < 1000) return `${rounded}`;
  if (rounded < 1_000_000) {
    const k = rounded / 1000;
    return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const m = rounded / 1_000_000;
  return `${m.toFixed(1).replace(/\.0$/, "")}M`;
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

export interface ModelItem {
  id: string;
  name: string;
  desc?: string;
  provider: string;
  providerName: string;
  supportsThinking?: boolean;
  thinkingLevels?: string[];
  defaultThinkingLevel?: string;
  maxOutputTokens?: number;
  contextWindow?: number;
}

interface ChatCardProps {
  onSendMessage?: (payload: {
    prompt: string;
    project: string;
    mode: "ask_before_changes" | "full_access";
    model?: string;
    thinkingLevel?: string;
    attachments?: AttachedFile[];
    maxOutputTokens?: number;
  }) => void;
  isExecuting?: boolean;
  onAbort?: () => void;
  compact?: boolean;
  showContextUsage?: boolean;
  contextUsage?: ContextUsageData;
  metrics?: ConversationMetrics;
  project?: string;
  onProjectChange?: (project: string) => void;
  onModelChange?: (model: ModelItem) => void;
  onOpenSettings?: (tab?: string) => void;
  initialPrompt?: string;
  runningTasks?: BackgroundTaskItem[];
  onSelectTask?: (task: BackgroundTaskItem) => void;
  onStopTask?: (taskId: string) => void;
}

export function ChatCard({
  onSendMessage,
  isExecuting = false,
  onAbort,
  compact = false,
  showContextUsage,
  contextUsage,
  metrics,
  project: initialProject,
  onProjectChange,
  onModelChange,
  onOpenSettings,
  initialPrompt,
  runningTasks,
  onSelectTask,
  onStopTask,
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
      id: "deepseek-v4-flash",
      name: "DeepSeek-V4-Flash",
      desc: "Frontier speed & reasoning",
      provider: "deepseek",
      providerName: "DeepSeek",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 128000,
      contextWindow: 128000,
    },
    {
      id: "deepseek-v4-pro",
      name: "DeepSeek-V4-Pro",
      desc: "Advanced reasoning & deep code generation",
      provider: "deepseek",
      providerName: "DeepSeek",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
      defaultThinkingLevel: "high",
      maxOutputTokens: 128000,
      contextWindow: 128000,
    },
    {
      id: "deepseek-v4-flash-vision-exp",
      name: "DeepSeek-V4-Flash-Vision-Exp",
      desc: "Multimodal frontier reasoning",
      provider: "deepseek",
      providerName: "DeepSeek",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 128000,
      contextWindow: 128000,
    },
    {
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash",
      desc: "Frontier multimodal reasoning & code generation",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 128000,
      contextWindow: 1048576,
    },
    {
      id: "gemini-3.7-flash",
      name: "Gemini 3.7 Flash",
      desc: "Hybrid frontier reasoning model",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 128000,
      contextWindow: 1048576,
    },
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash",
      desc: "Advanced frontier thinking & max depth",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 128000,
      contextWindow: 1048576,
    },
    {
      id: "combo/auto",
      name: "combo/auto",
      desc: "Virtual Combo auto router with dynamic reasoning",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 128000,
      contextWindow: 1000000,
    },
    {
      id: "combo/fast",
      name: "combo/fast",
      desc: "Virtual Combo fast chain optimized for sub-second latency",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: false,
      maxOutputTokens: 128000,
      contextWindow: 1000000,
    },
    {
      id: "combo/coding",
      name: "combo/coding",
      desc: "Virtual Combo coding chain optimized for high-depth reasoning",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high"],
      defaultThinkingLevel: "high",
      maxOutputTokens: 128000,
      contextWindow: 1000000,
    },
  ]);

  const [searchModelQuery, setSearchModelQuery] = useState("");

  const groupedModels = useMemo(() => {
    const map = new Map<string, { providerId: string; providerName: string; items: ModelItem[] }>();
    for (const m of models) {
      const isConst = isConstProvider(m.provider);
      const pid = isConst ? "const" : (m.provider || "custom");
      const pname = isConst ? "ConstRouter" : (m.providerName || "Custom");
      if (!map.has(pid)) {
        map.set(pid, { providerId: pid, providerName: pname, items: [] });
      }
      map.get(pid)!.items.push(m);
    }
    return Array.from(map.values());
  }, [models]);

  const filteredGroupedModels = useMemo(() => {
    const q = searchModelQuery.toLowerCase().trim();
    if (!q) return groupedModels;

    return groupedModels
      .map((group) => {
        const matchesProvider = group.providerName.toLowerCase().includes(q);
        const matchingItems = group.items.filter(
          (m) =>
            matchesProvider ||
            m.name.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q)
        );
        return {
          ...group,
          items: matchingItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [groupedModels, searchModelQuery]);

  const [selectedModel, setSelectedModel] = useState<string | null>(() => {
    const saved = localStorage.getItem("const_harness_active_model");
    if (!saved || saved === "Const" || saved.includes("(Const Router)") || saved.includes("(Native)")) {
      return "Gemini 3.6 Flash";
    }
    if (saved === "Auto Router" || saved === "Auto (Best Available)" || saved === "combo/auto") return "combo/auto";
    if (saved === "Low-Latency Fast Chain" || saved === "Fast (Low Latency)" || saved === "combo/fast") return "combo/fast";
    if (saved === "Coding Agent Chain" || saved === "Coding & Reasoning" || saved === "combo/coding") return "combo/coding";
    return saved;
  });
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Active Model Object & Dynamic Thinking Level Support
  const currentModelItem = useMemo(() => {
    return (
      models.find((m) => m.name === selectedModel || m.id === selectedModel) ||
      models.find((m) => m.id === "gemini-3.6-flash") ||
      models[0]
    );
  }, [models, selectedModel]);

  useEffect(() => {
    if (currentModelItem) {
      onModelChange?.(currentModelItem);
    }
  }, [currentModelItem, onModelChange]);

  const isThinkingSupported = Boolean(
    currentModelItem?.id === "combo/fast"
      ? false
      : currentModelItem?.supportsThinking ||
        (currentModelItem?.id?.startsWith("gemini-3.") ?? false) ||
        currentModelItem?.id === "combo/coding" ||
        currentModelItem?.id === "combo/auto"
  );

  const supportedThinkingLevels: string[] = useMemo(() => {
    if (!isThinkingSupported) return [];
    if (currentModelItem?.thinkingLevels && currentModelItem.thinkingLevels.length > 0) {
      return currentModelItem.thinkingLevels;
    }
    if (
      currentModelItem?.id === "gemini-3.8-flash" ||
      currentModelItem?.name?.toLowerCase().includes("3.8")
    ) {
      return ["low", "medium", "high", "xhigh", "max"];
    }
    return ["low", "medium", "high"];
  }, [isThinkingSupported, currentModelItem]);

  const [thinkingLevel, setThinkingLevel] = useState<string>(() => {
    return localStorage.getItem("const_harness_thinking_level") || "medium";
  });
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const thinkingMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isThinkingSupported && supportedThinkingLevels.length > 0) {
      if (currentModelItem?.id === "combo/coding" && supportedThinkingLevels.includes("high")) {
        // High reasoning effort by default for coding combo
        if (thinkingLevel !== "high" && !localStorage.getItem("const_harness_user_thinking_override")) {
          setThinkingLevel("high");
          localStorage.setItem("const_harness_thinking_level", "high");
          return;
        }
      }
      if (!supportedThinkingLevels.includes(thinkingLevel)) {
        const fallback = currentModelItem?.defaultThinkingLevel || (supportedThinkingLevels.includes("medium")
          ? "medium"
          : supportedThinkingLevels[0]!);
        setThinkingLevel(fallback);
        localStorage.setItem("const_harness_thinking_level", fallback);
      }
    }
  }, [isThinkingSupported, supportedThinkingLevels, thinkingLevel, currentModelItem]);

  // Fetch available models and user config from engine
  useEffect(() => {
    if (window.electron?.getModels) {
      window.electron
        .getModels()
        .then((items: any[]) => {
          if (items && items.length > 0) {
            const mapped = items.map((m: any) => {
              const isConst = isConstProvider(m.provider);
              let supportsThinking = Boolean(
                m.supportsThinking || m.supports_thinking || m.supports_reasoning
              );
              let name = m.displayName || m.name || m.id;
              let defaultThinkingLevel = m.defaultThinkingLevel || m.default_thinking_level || "medium";

              if (m.id === "combo/auto" || name === "Auto Router" || name === "Auto (Best Available)") {
                name = "combo/auto";
                supportsThinking = true;
                defaultThinkingLevel = "medium";
              } else if (m.id === "combo/fast" || name === "Low-Latency Fast Chain" || name === "Fast (Low Latency)") {
                name = "combo/fast";
                supportsThinking = false;
              } else if (m.id === "combo/coding" || name === "Coding Agent Chain" || name === "Coding & Reasoning") {
                name = "combo/coding";
                supportsThinking = true;
                defaultThinkingLevel = "high";
              }

              return {
                id: m.id,
                name,
                desc: supportsThinking
                  ? "Supports thinking & tools"
                  : m.supportsTools
                  ? "Supports tools"
                  : undefined,
                provider: isConst ? "const" : (m.provider || "custom"),
                providerName: isConst ? "Const" : (m.providerName || "Custom"),
                supportsThinking,
                thinkingLevels:
                  m.thinkingLevels ||
                  m.thinking_levels ||
                  (m.id === "gemini-3.8-flash" || (name || m.id).includes("3.8")
                    ? ["low", "medium", "high", "xhigh", "max"]
                    : supportsThinking
                    ? ["low", "medium", "high"]
                    : undefined),
                defaultThinkingLevel,
                maxOutputTokens: m.maxOutputTokens ?? m.max_output_tokens ?? (isConst ? 128000 : 65536),
                contextWindow:
                  m.contextWindow ??
                  m.context_window ??
                  (m.id?.includes("gemini") ? 1048576 : (m.id?.includes("combo") ? 1000000 : 128000)),
              };
            });

            // Deduplicate items defensively so neither same normalized ID nor same name appears twice
            const seenIds = new Set<string>();
            const seenNames = new Set<string>();
            const deduped: ModelItem[] = [];
            for (const item of mapped) {
              const normId = item.id.toLowerCase().replace(/\s+/g, "-").trim();
              const normName = item.name.toLowerCase().trim();
              if (normId && !seenIds.has(normId) && normName && !seenNames.has(normName)) {
                seenIds.add(normId);
                seenNames.add(normName);
                deduped.push(item);
              }
            }
            setModels(deduped);

            const saved = localStorage.getItem("const_harness_active_model");
            if (!saved) {
              const first = deduped[0];
              if (first) {
                const initialName = first.name || first.id;
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
          let modelName = cfg.activeModel;
          if (modelName === "combo/auto" || modelName === "Auto Router" || modelName === "Auto (Best Available)") modelName = "combo/auto";
          else if (modelName === "combo/fast" || modelName === "Low-Latency Fast Chain" || modelName === "Fast (Low Latency)") modelName = "combo/fast";
          else if (modelName === "combo/coding" || modelName === "Coding Agent Chain" || modelName === "Coding & Reasoning") modelName = "combo/coding";
          setSelectedModel(modelName);
          localStorage.setItem("const_harness_active_model", modelName);
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
      if (thinkingMenuRef.current && !thinkingMenuRef.current.contains(target)) {
        setIsThinkingOpen(false);
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
        setIsThinkingOpen(false);
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
      thinkingLevel: isThinkingSupported ? thinkingLevel : undefined,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      maxOutputTokens: matchedModel?.maxOutputTokens,
    });
  };

  const displayProjectName =
    currentProject === "Outside Project"
      ? "Outside Project"
      : currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject;

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.toLowerCase().includes(searchWorkspace.toLowerCase())
  );

  // Real-time calculation of tokens for draft prompt and pending attachments
  const draftInputTokens = useMemo(() => {
    let tokens = 0;
    if (prompt && prompt.trim().length > 0) {
      tokens += Math.max(1, Math.ceil(prompt.trim().length / 3.8));
    }
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === "image") {
          tokens += 258;
        } else if (att.size && att.size > 0) {
          tokens += Math.max(10, Math.ceil(att.size / 3.8));
        } else {
          tokens += 50;
        }
      }
    }
    return tokens;
  }, [prompt, attachments]);

  const modelContextLimit = useMemo(() => {
    if (currentModelItem?.contextWindow && currentModelItem.contextWindow > 0) {
      return currentModelItem.contextWindow;
    }
    const id = (currentModelItem?.id || selectedModel || "").toLowerCase();
    if (id.includes("gemini")) return 1_048_576;
    if (id.includes("combo")) return 1_000_000;
    if (id.includes("deepseek")) return 128_000;
    if (id.includes("claude")) return 200_000;
    if (id.includes("gpt-4")) return 128_000;
    return contextUsage?.totalTokens ?? 1_000_000;
  }, [currentModelItem, selectedModel, contextUsage?.totalTokens]);

  const totalTokens = modelContextLimit > 0 ? modelContextLimit : 1_000_000;
  const systemPromptTokens = contextUsage?.systemPromptTokens ?? 850;
  const toolsTokens = contextUsage?.toolsTokens ?? 950;
  const messagesTokens = contextUsage?.messagesTokens ?? 0;
  const effectiveMessagesTokens = Math.max(
    messagesTokens,
    (contextUsage?.usedTokens ?? 0) - (systemPromptTokens + toolsTokens)
  );
  const baseUsedTokens = systemPromptTokens + toolsTokens + effectiveMessagesTokens;
  const usedTokens = baseUsedTokens + draftInputTokens;
  const rawPercentUsed = totalTokens > 0 ? (usedTokens / totalTokens) * 100 : 0;
  const safePercent = isFinite(rawPercentUsed) ? Math.min(100, Math.max(0, rawPercentUsed)) : 0;
  const percentUsed = safePercent >= 1 ? Math.round(safePercent) : +safePercent.toFixed(1);

  // Context Message indicator should only show when ongoing chat has started (or explicitly enabled)
  const shouldShowContextUsage = showContextUsage !== undefined ? showContextUsage : compact;

  const closeAllMenus = () => {
    setIsProjectOpen(false);
    setIsModeOpen(false);
    setIsModelOpen(false);
    setIsThinkingOpen(false);
    setIsContextOpen(false);
    setIsPlusOpen(false);
  };

  const isAnyBottomMenuOpen = isPlusOpen || isModeOpen || isContextOpen || isModelOpen || isThinkingOpen;

  return (
    <div className="w-full max-w-full flex flex-col items-center gap-2 select-none min-w-0">
      {/* Unified Card */}
      <div
        className={`w-full max-w-full rounded-2xl border border-[#e2e2e4] dark:border-[#383838] select-none transition-colors shadow-sm dark:shadow-none min-w-0 ${
          compact ? "bg-[#ffffff] dark:bg-[#2b2b2b]" : "bg-[#ffffff] dark:bg-[#222222]"
        }`}
      >
        {/* Top Header Strip: Choose Project (Only visible in landing view) */}
        {!compact && (
          <div className={cn("w-full px-3.5 pt-2 pb-1.5 flex items-center relative min-w-0 rounded-t-2xl", isProjectOpen ? "z-30" : "z-10")}>
            <div className="relative max-w-full min-w-0" ref={projectMenuRef}>
              <button
                type="button"
                onClick={() => {
                  const next = !isProjectOpen;
                  closeAllMenus();
                  setIsProjectOpen(next);
                }}
                className="inline-flex items-center gap-1.5 text-[13px] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer font-sans max-w-full"
                title={currentProject}
              >
                <Folder className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#5d5d5d] shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-[320px]">{displayProjectName}</span>
                <ChevronDown className="w-3 h-3 text-[#a9a9a9] dark:text-[#5d5d5d] ml-0.5 shrink-0" />
              </button>

              {/* Choose Project Dropdown Popover */}
              {isProjectOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 sm:w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                  {/* Real Workspaces List (only shown if real folders were opened) */}
                  {workspaces.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 border-b border-[#e2e2e4] dark:border-[#383838]/60">
                        <Search className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#5d5d5d] shrink-0" />
                        <input
                          type="text"
                          value={searchWorkspace}
                          onChange={(e) => setSearchWorkspace(e.target.value)}
                          placeholder="Search workspaces"
                          className="w-full bg-transparent text-[13px] text-[#262626] dark:text-[#d4d4d4] placeholder:text-[#a9a9a9] dark:placeholder:text-[#5d5d5d] outline-none font-sans"
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
                              className="w-full px-2.5 py-1.5 flex items-center justify-between text-[13px] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                              title={ws}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Folder className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#5d5d5d] shrink-0" />
                                <div className="flex flex-col text-left truncate">
                                  <span className="truncate">{wsName}</span>
                                  <span className="text-[10px] text-[#a9a9a9] dark:text-[#777777] truncate">{ws}</span>
                                </div>
                              </div>
                              {currentProject === ws && (
                                <Check className="w-3.5 h-3.5 text-[#262626] dark:text-[#d4d4d4] shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="h-[1px] bg-[#e2e2e4] dark:bg-[#383838]/60 my-1" />
                    </>
                  )}

                  {/* Real Action Items */}
                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[13px] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#5d5d5d] shrink-0" />
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
                    className="w-full px-2.5 py-1.5 flex items-center justify-between text-[13px] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#5d5d5d] shrink-0" />
                      <span>Work outside a project</span>
                    </div>
                    {currentProject === "Outside Project" && (
                      <Check className="w-3.5 h-3.5 text-[#262626] dark:text-[#d4d4d4] shrink-0" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Input Box: Background is #ffffff (light) / #2b2b2b (dark) with #262626 / #d4d4d4 text */}
        <div
          className={cn(
            "w-full max-w-full bg-[#ffffff] dark:bg-[#2b2b2b] flex flex-col justify-between transition-colors focus-within:border-[#a9a9a9] dark:focus-within:border-[#555555] min-w-0 relative",
            compact ? "rounded-2xl" : "rounded-2xl border border-[#e2e2e4] dark:border-[#383838] -mx-[1px] -mb-[1px] w-[calc(100%+2px)]",
            isAnyBottomMenuOpen ? "z-30" : "z-10"
          )}
        >
          {/* Running Tasks Banner attached above input, matching Image 3 */}
          {runningTasks && runningTasks.length > 0 && (
            <AttachedTaskBanner
              tasks={runningTasks}
              onSelectTask={onSelectTask || (() => {})}
              onStopTask={onStopTask || (() => {})}
              className="rounded-t-2xl"
            />
          )}

          <div className="w-full px-3 sm:px-3.5 pt-2.5 pb-2.5 flex flex-col justify-between min-w-0">
            {/* Attachments Shelf (Square Cards for Images, Videos, PDFs, Docs) */}
            {attachments.length > 0 && (
            <div className="w-full flex items-center gap-2.5 pt-1.5 pb-2.5 px-0.5 overflow-x-auto select-none scrollbar-none">
              <TooltipProvider delayDuration={150}>
                {attachments.map((file) => {
                  const isImage = file.type === "image";
                  const isVideo = file.type === "video";
                  const isMedia = isImage || isVideo;
                  const ext = (file.name.split(".").pop() || "FILE").toUpperCase();

                  return (
                    <Tooltip key={file.id}>
                      <TooltipTrigger asChild>
                        <div
                          onClick={() => setPreviewItem(file)}
                          className={`relative w-20 h-20 group shrink-0 rounded-xl border border-[#e2e2e4] dark:border-[#383838] shadow-sm animate-in fade-in zoom-in-95 duration-100 bg-[#f4f4f6] dark:bg-[#1a1917] select-none cursor-pointer transition-all ${
                            isMedia
                              ? "hover:opacity-90 active:scale-[0.98]"
                              : "hover:border-black/30 dark:hover:border-white/30"
                          }`}
                        >
                          {isImage && file.url ? (
                            <div className="w-full h-full rounded-xl overflow-hidden">
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-cover block"
                              />
                            </div>
                          ) : isVideo ? (
                            <div className="w-full h-full rounded-xl overflow-hidden bg-black relative">
                              {file.url && (
                                <video
                                  src={file.url}
                                  className="w-full h-full object-cover block pointer-events-none"
                                  muted
                                  playsInline
                                  autoPlay
                                  loop
                                />
                              )}
                              <span className="absolute bottom-1 right-1 text-[8px] font-bold text-white bg-black/60 px-1 py-0.5 rounded uppercase tracking-wider font-mono">
                                Video
                              </span>
                            </div>
                          ) : (
                            <div className="w-full h-full p-2 flex flex-col justify-between items-start text-left bg-[#f4f4f6] dark:bg-[#1a1917]/70 rounded-xl">
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[9px] font-bold text-[#888888] dark:text-[#888888] tracking-wider uppercase font-mono">
                                  {ext}
                                </span>
                                <FileText className="w-3.5 h-3.5 text-[#e79737] shrink-0" />
                              </div>
                              <div className="w-full min-w-0">
                                <span className="text-[11px] font-medium text-[#262626] dark:text-[#d4d4d4] leading-tight w-full line-clamp-2 break-words block">
                                  {file.name}
                                </span>
                                <span className="text-[8.5px] text-[#a9a9a9] dark:text-[#777777] font-mono mt-0.5 block truncate">
                                  {formatFileSize(file.size)}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Close / Remove button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeAttachment(file.id);
                            }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white dark:bg-[#262626] shadow-md border border-[#e2e2e4] dark:border-[#444444] flex items-center justify-center cursor-pointer text-[#555555] dark:text-[#cccccc] hover:bg-[#e11d48] hover:text-white dark:hover:bg-[#e11d48] dark:hover:text-white dark:hover:border-[#e11d48] hover:scale-105 active:scale-95 transition-all z-20"
                            title="Remove attachment"
                            aria-label="Remove attachment"
                          >
                            <X className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={6}
                        className="z-50 max-w-[220px] bg-[#262626] dark:bg-[#1e1e1e] text-white dark:text-[#e0e0e0] text-[11px] px-2.5 py-1.5 rounded-lg shadow-2xl border border-black/10 dark:border-[#383838] select-none pointer-events-none break-all"
                      >
                        <div className="font-medium truncate max-w-[200px]">{file.name}</div>
                        <div className="text-[9.5px] text-[#a0a0a0] font-mono mt-0.5">
                          {formatFileSize(file.size)}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
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
              className="w-full resize-none bg-transparent text-[14px] leading-5 text-[#262626] dark:text-[#d4d4d4] placeholder:text-[#a9a9a9] dark:placeholder:text-[#5d5d5d] outline-none font-sans overflow-hidden py-0.5 block"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </ScrollArea>

          {/* Bottom Actions Row: Plus, Hand/Shield, Context Window, Model Selector, Send Button */}
          <div className="flex items-center justify-between pt-2.5 text-xs relative min-w-0 gap-1.5 sm:gap-2">
            {/* Left Actions: Plus and Mode Selector */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
              {/* Plus Button & Add Context Dropdown */}
              <div className="relative shrink-0" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isPlusOpen;
                    closeAllMenus();
                    setIsPlusOpen(next);
                  }}
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                    isPlusOpen
                      ? "text-[#262626] dark:text-white bg-black/10 dark:bg-white/10"
                      : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
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

                {/* Add Context Popover Menu */}
                {isPlusOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-44 max-w-[calc(100vw-32px)] bg-white dark:bg-[#1e1e1e] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[11px] font-medium text-[#a9a9a9] dark:text-[#777777]">
                      Add Context
                    </div>

                    {/* 1. Media */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <ImageIcon className="w-4 h-4 text-[#a9a9a9] dark:text-[#888888] group-hover:text-[#262626] dark:group-hover:text-white shrink-0" />
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
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <AtSign className="w-4 h-4 text-[#a9a9a9] dark:text-[#888888] group-hover:text-[#262626] dark:group-hover:text-white shrink-0" />
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
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <SquarePen className="w-4 h-4 text-[#a9a9a9] dark:text-[#888888] group-hover:text-[#262626] dark:group-hover:text-white shrink-0" />
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
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <Globe className="w-4 h-4 text-[#a9a9a9] dark:text-[#888888] group-hover:text-[#262626] dark:group-hover:text-white shrink-0" />
                      <span className="text-[13px]">Browser</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Access Mode Selector: Ask before changes vs Full access */}
              <div className="relative min-w-0" ref={modeMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isModeOpen;
                    closeAllMenus();
                    setIsModeOpen(next);
                  }}
                  className={`inline-flex items-center gap-1.5 px-1.5 sm:px-2 py-1 rounded-md text-[13px] font-normal transition-colors cursor-pointer shrink-0 max-w-[155px] sm:max-w-none ${
                    mode === "full_access"
                      ? "text-[#e79737] hover:bg-[#e79737]/10"
                      : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  title={mode === "full_access" ? "Full access" : "Ask before changes"}
                >
                  {mode === "full_access" ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-[#e79737] stroke-[1.75] shrink-0" />
                  ) : (
                    <Hand className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#5d5d5d] stroke-[1.75] shrink-0" />
                  )}
                  <span className="truncate">
                    {mode === "full_access" ? "Full access" : "Ask before changes"}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 ml-0.5 shrink-0 ${
                      mode === "full_access" ? "text-[#e79737]" : "text-[#a9a9a9] dark:text-[#5d5d5d]"
                    }`}
                  />
                </button>

                {/* Mode Selector Popover (Only 2 items: Ask before changes & Full access) */}
                {isModeOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-64 sm:w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    {/* 1. Ask before changes */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("ask_before_changes");
                        setIsModeOpen(false);
                      }}
                      className="w-full p-2.5 flex items-start gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors cursor-pointer group"
                    >
                      <Hand className="w-4 h-4 text-[#262626] dark:text-[#d4d4d4] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] font-normal text-[#262626] dark:text-[#d4d4d4] group-hover:text-black dark:group-hover:text-white">
                          Ask before changes
                        </div>
                        <div className="text-[12px] text-[#a9a9a9] dark:text-[#888888] leading-tight mt-0.5">
                          Ask before file changes.
                        </div>
                      </div>
                      {mode === "ask_before_changes" && (
                        <Check className="w-3.5 h-3.5 text-[#262626] dark:text-[#d4d4d4] shrink-0 ml-auto mt-0.5" />
                      )}
                    </button>

                    {/* 2. Full access */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("full_access");
                        setIsModeOpen(false);
                      }}
                      className="w-full p-2.5 flex items-start gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors cursor-pointer group"
                    >
                      <ShieldAlert className="w-4 h-4 text-[#e79737] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] font-normal text-[#262626] dark:text-[#d4d4d4] group-hover:text-black dark:group-hover:text-white">
                          Full access
                        </div>
                        <div className="text-[12px] text-[#a9a9a9] dark:text-[#888888] leading-tight mt-0.5">
                          Run with fewer confirmations.
                        </div>
                      </div>
                      {mode === "full_access" && (
                        <Check className="w-3.5 h-3.5 text-[#e79737] shrink-0 ml-auto mt-0.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Actions: Context Window, Model Selector, Send Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
              {/* 1. Context Windows Indicator & Detailed Popover */}
              {shouldShowContextUsage && (
                <div className="relative" ref={contextMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isContextOpen;
                      closeAllMenus();
                      setIsContextOpen(next);
                    }}
                    className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${
                      rawPercentUsed >= 90
                        ? "text-red-500 hover:text-red-400"
                        : rawPercentUsed >= 75
                        ? "text-[#e79737] hover:text-[#ff9838]"
                        : "text-[#a9a9a9] dark:text-[#777777] hover:text-[#262626] dark:hover:text-[#d4d4d4]"
                    }`}
                    title={`Context window: ${rawPercentUsed === 0 ? "0%" : rawPercentUsed < 0.1 ? "<0.1%" : `${percentUsed}%`} (~${formatTokenDisplay(usedTokens)} / ${formatTokenDisplay(totalTokens)})`}
                    aria-label="Context window usage"
                  >
                    <svg
                      className="w-3.5 h-3.5 transform -rotate-90"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        fill="none"
                        stroke="currentColor"
                        className="text-[#e2e2e4] dark:text-[#383838]"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeDasharray={56.55}
                        strokeDashoffset={
                          56.55 - (56.55 * safePercent) / 100
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {/* Context Window Popover */}
                  {isContextOpen && (
                    <div className="absolute bottom-full mb-2 right-0 w-72 sm:w-80 max-w-[calc(100vw-32px)] bg-white dark:bg-[#1e1e1e] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3 text-left select-none animate-in fade-in zoom-in-95 duration-100">
                      {/* Header: % of context used and tokens */}
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-[#161616] dark:text-white font-medium">
                          {rawPercentUsed === 0 ? "0%" : rawPercentUsed < 0.1 ? "<0.1%" : `${percentUsed}%`} of context used
                        </span>
                        <span className="font-mono text-[12px] text-[#a9a9a9] dark:text-[#a0a0a0]">
                          ~{formatTokenDisplay(usedTokens)} / {formatTokenDisplay(totalTokens)}
                        </span>
                      </div>

                      {/* Multi-segment Horizontal Progress Bar */}
                      <div className="w-full h-2 bg-[#f0f0f2] dark:bg-[#2d2d2d] rounded-full overflow-hidden flex gap-0.5">
                        {systemPromptTokens > 0 && (
                          <div
                            className="bg-[#71717a] h-full transition-all"
                            style={{
                              width: `${Math.max(0.5, (systemPromptTokens / totalTokens) * 100)}%`,
                            }}
                            title={`System prompt: ~${formatTokenDisplay(systemPromptTokens)}`}
                          />
                        )}
                        {toolsTokens > 0 && (
                          <div
                            className="bg-[#a855f7] h-full transition-all"
                            style={{
                              width: `${Math.max(0.5, (toolsTokens / totalTokens) * 100)}%`,
                            }}
                            title={`Tools: ~${formatTokenDisplay(toolsTokens)}`}
                          />
                        )}
                        {effectiveMessagesTokens > 0 && (
                          <div
                            className="bg-[#3b82f6] h-full transition-all"
                            style={{
                              width: `${Math.max(0.5, (effectiveMessagesTokens / totalTokens) * 100)}%`,
                            }}
                            title={`Messages: ~${formatTokenDisplay(effectiveMessagesTokens)}`}
                          />
                        )}
                        {draftInputTokens > 0 && (
                          <div
                            className="bg-[#10b981] h-full transition-all"
                            style={{
                              width: `${Math.max(0.5, (draftInputTokens / totalTokens) * 100)}%`,
                            }}
                            title={`Current input: ~${formatTokenDisplay(draftInputTokens)}`}
                          />
                        )}
                      </div>

                      {/* Legend / Breakdown List */}
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-xs bg-[#71717a] shrink-0" />
                            <span className="text-[#262626] dark:text-[#d4d4d4]">System prompt</span>
                          </div>
                          <span className="font-mono text-[#262626] dark:text-[#d4d4d4]">
                            ~{formatTokenDisplay(systemPromptTokens)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-xs bg-[#a855f7] shrink-0" />
                            <span className="text-[#262626] dark:text-[#d4d4d4]">Tools</span>
                          </div>
                          <span className="font-mono text-[#262626] dark:text-[#d4d4d4]">
                            ~{formatTokenDisplay(toolsTokens)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-xs bg-[#3b82f6] shrink-0" />
                            <span className="text-[#262626] dark:text-[#d4d4d4]">Messages</span>
                          </div>
                          <span className="font-mono text-[#262626] dark:text-[#d4d4d4]">
                            ~{formatTokenDisplay(effectiveMessagesTokens)}
                          </span>
                        </div>

                        {draftInputTokens > 0 && (
                          <div className="flex items-center justify-between text-[12px]">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-xs bg-[#10b981] shrink-0" />
                              <span className="text-[#10b981] font-medium">Current input</span>
                            </div>
                            <span className="font-mono text-[#10b981]">
                              ~{formatTokenDisplay(draftInputTokens)}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[12px] pt-1 border-t border-[#e2e2e4] dark:border-[#383838]/60">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-xs bg-[#e2e2e4] dark:bg-[#383838] shrink-0" />
                            <span className="text-[#777777] dark:text-[#888888]">Available context</span>
                          </div>
                          <span className="font-mono text-[#777777] dark:text-[#888888]">
                            ~{formatTokenDisplay(Math.max(0, totalTokens - usedTokens))}
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
                    const next = !isModelOpen;
                    closeAllMenus();
                    if (next) setSearchModelQuery("");
                    setIsModelOpen(next);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 text-[13px] font-normal transition-colors cursor-pointer max-w-[135px] sm:max-w-[180px] md:max-w-[240px]"
                  title={selectedModel || "Manage model"}
                >
                  <span className="truncate">{selectedModel || "Manage model"}</span>
                  <ChevronDown className="w-3 h-3 text-[#a9a9a9] dark:text-[#5d5d5d] ml-0.5 shrink-0" />
                </button>

                {/* Model Selector Popover */}
                {isModelOpen && (
                  <div className="absolute bottom-full mb-2 right-0 w-[260px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#1e1e1e] border border-[#e2e2e4] dark:border-[#333333] rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    {models.length > 0 ? (
                      <>
                        {/* Search Input at the top (pinned, outside scroll) */}
                        <div className="flex-none flex items-center gap-2 px-2 py-1 mb-1">
                          <Search className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#777777] shrink-0" />
                          <input
                            type="text"
                            value={searchModelQuery}
                            onChange={(e) => setSearchModelQuery(e.target.value)}
                            placeholder="Search models..."
                            className="w-full bg-transparent text-[12px] text-[#262626] dark:text-[#d4d4d4] placeholder:text-[#a9a9a9] dark:placeholder:text-[#666666] outline-none font-sans"
                            autoFocus
                          />
                          {searchModelQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchModelQuery("")}
                              className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded text-[#a9a9a9] hover:text-[#262626] dark:hover:text-white transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Models categorized with ScrollArea */}
                        {filteredGroupedModels.length > 0 ? (
                          <ScrollArea className="max-h-[260px] w-full flex-1 min-h-0" viewportClassName="pr-1">
                            <div className="space-y-2 py-0.5 pr-0.5">
                              {filteredGroupedModels.map((group) => (
                                <div key={group.providerId} className="flex flex-col">
                                  {/* Category Header */}
                                  <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-[#5ea0e8] dark:text-[#5ea0e8] select-none tracking-wide">
                                    {group.providerName}
                                  </div>

                                  {/* Model Items */}
                                  <div className="flex flex-col space-y-0.5">
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
                                            if (m.id === "combo/coding" || m.name === "combo/coding") {
                                              setThinkingLevel("high");
                                              localStorage.setItem("const_harness_thinking_level", "high");
                                            } else if (m.defaultThinkingLevel) {
                                              setThinkingLevel(m.defaultThinkingLevel);
                                              localStorage.setItem("const_harness_thinking_level", m.defaultThinkingLevel);
                                            }
                                            setIsModelOpen(false);
                                          }}
                                          className={cn(
                                            "w-full px-2.5 py-1.5 flex items-center justify-between text-[13px] rounded-lg transition-colors cursor-pointer text-left",
                                            isSelected
                                              ? "bg-black/5 dark:bg-white/[0.08] text-black dark:text-white font-medium"
                                              : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06]"
                                          )}
                                        >
                                          <span className="truncate font-normal min-w-0 pr-2">{m.name}</span>
                                          {isSelected && (
                                            <Check className="w-4 h-4 text-[#262626] dark:text-white shrink-0 ml-auto" />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        ) : (
                          <div className="py-6 px-3 text-center text-xs text-[#a9a9a9] dark:text-[#777777]">
                            No models found
                          </div>
                        )}

                        {/* Bottom Footer: Manage models (pinned, outside scroll) */}
                        <div className="flex-none pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsModelOpen(false);
                              onOpenSettings?.("model-settings");
                            }}
                            className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] text-[#a9a9a9] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#777777] shrink-0" />
                            <span>Manage models</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-3.5 flex flex-col items-center text-center">
                        <div className="w-9 h-9 rounded-xl bg-[#f4f4f6] dark:bg-[#2a2a2a] border border-[#e2e2e4] dark:border-[#383838] flex items-center justify-center text-[#262626] dark:text-[#d4d4d4] mb-2.5 shadow-sm">
                          <Cpu className="w-4 h-4 text-[#262626] dark:text-[#d4d4d4] stroke-[1.75]" />
                        </div>
                        <div className="text-[13px] font-medium text-[#262626] dark:text-[#d4d4d4]">
                          No models configured
                        </div>
                        <p className="text-[11px] text-[#a9a9a9] dark:text-[#888888] leading-relaxed mt-1 mb-3.5">
                          Connect or configure model providers to start executing tasks.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsModelOpen(false);
                            onOpenSettings?.("model-settings");
                          }}
                          className="w-full py-1.5 px-3 rounded-lg bg-[#dedee2] hover:bg-[#d5d5d9] dark:bg-[#333333] dark:hover:bg-[#3d3d3d] border border-[#d5d5d9] dark:border-[#444444]/60 text-[12px] font-medium text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#262626] dark:text-[#d4d4d4]" />
                          <span>Manage models</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2.5 Thinking / Reasoning Level Selector (Right next to Model Selector, shown when model supports thinking) */}
              {isThinkingSupported && supportedThinkingLevels.length > 0 && (
                <div className="relative" ref={thinkingMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isThinkingOpen;
                      closeAllMenus();
                      setIsThinkingOpen(next);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 text-[13px] font-normal transition-colors cursor-pointer shrink-0"
                    title={`Thinking effort: ${thinkingLevel}`}
                    aria-label={`Thinking effort: ${thinkingLevel}`}
                  >
                    <Brain className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#888888] shrink-0" />
                    <span className="capitalize">{thinkingLevel}</span>
                    <ChevronDown className="w-3 h-3 text-[#a9a9a9] dark:text-[#5d5d5d] ml-0.5 shrink-0" />
                  </button>

                  {/* Thinking Level Popover Dropdown */}
                  {isThinkingOpen && (
                    <div className="absolute bottom-full mb-2 right-0 w-44 max-w-[calc(100vw-32px)] bg-white dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2 py-1 text-[11px] font-medium text-[#a9a9a9] dark:text-[#888888] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Thinking</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {supportedThinkingLevels.map((lvl) => {
                          const isSelected = thinkingLevel === lvl;
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => {
                                setThinkingLevel(lvl);
                                localStorage.setItem("const_harness_thinking_level", lvl);
                                setIsThinkingOpen(false);
                              }}
                              className={cn(
                                "w-full px-2.5 py-1.5 flex items-center justify-between text-[12px] rounded-lg transition-colors cursor-pointer capitalize text-left",
                                isSelected
                                  ? "bg-black/10 dark:bg-white/10 text-black dark:text-white font-medium"
                                  : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                              )}
                            >
                              <span className="font-normal capitalize">{lvl}</span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#262626] dark:text-[#d4d4d4] shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Send or Stop Generation Button */}
              {isExecuting ? (
                <button
                  type="button"
                  onClick={onAbort}
                  className="w-7 h-7 rounded-lg bg-[#dedee2] hover:bg-[#d5d5d9] dark:bg-[#383838] dark:hover:bg-[#454545] text-[#e79737] dark:text-[#ff7a00] flex items-center justify-center cursor-pointer select-none transition-colors shrink-0"
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
                  className={`w-7 h-7 rounded-lg flex items-center justify-center select-none transition-all shrink-0 ${
                    prompt.trim() || attachments.length > 0
                      ? "bg-[#262626] dark:bg-[#d4d4d4] text-white dark:text-[#161616] hover:bg-black dark:hover:bg-white cursor-pointer shadow-sm active:scale-95"
                      : "bg-[#f0f0f2] dark:bg-[#48484e]/60 text-[#a9a9a9] dark:text-[#888888] cursor-not-allowed"
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

      {/* Active Conversation Footer Info Bar (Option A: Condensed, No Scrollbar) */}
      {compact && metrics && (
        <div
          className="w-full flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-[#a9a9a9] dark:text-[#888888] pt-1 pb-0.5 select-none overflow-hidden"
          title="Session telemetry metrics"
        >
          <span title={`${metrics.turns} conversation turns, ${metrics.steps} tool execution steps`}>
            {metrics.turns} turns · {metrics.steps} steps
          </span>
          <span className="text-[#d5d5d9] dark:text-[#444444]">|</span>
          <span title={`LLM duration: ${formatDurationDisplay(metrics.llmDurationMs)} · Tools duration: ${formatDurationDisplay(metrics.toolDurationMs)}`}>
            LLM {formatDurationDisplay(metrics.llmDurationMs)} · Tools {formatDurationDisplay(metrics.toolDurationMs)}
          </span>
          <span className="text-[#d5d5d9] dark:text-[#444444]">|</span>
          <span title={`Average TTFT: ${metrics.ttftSeconds.toFixed(1)}s · Generation speed: ${metrics.tokPerSec} tok/s`}>
            {metrics.tokPerSec} tok/s
          </span>
          <span className="text-[#d5d5d9] dark:text-[#444444]">|</span>
          <span title={`Prompt cache hit rate: ${metrics.cacheHitRate}%`}>
            {metrics.cacheHitRate}% cache
          </span>
          <span className="text-[#d5d5d9] dark:text-[#444444]">|</span>
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
