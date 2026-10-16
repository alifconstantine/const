import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
  X,
  Brain,
  Gauge,
  Database,
  Box,
  Eye,
} from "lucide-react";
import {
  ScrollArea,
  cn,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Popover,
  PopoverTrigger,
  PopoverContent,
  toast,
} from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { ImageLightbox } from "./image-lightbox";
import { AttachedTaskBanner } from "./attached-task-banner";
import type { BackgroundTaskItem } from "../../vite-env";
import { getDefaultAgentMode, type ConversationItem } from "../../lib/conversation-store";
import { useTranslation } from "../../lib/i18n";
import {
  type ActiveAtToken,
  type MentionCandidate,
  type WorkspaceFileEntry,
  activeAtToken,
  searchMentionCandidates,
} from "../../lib/mention-search";
import { MentionPopover } from "./mention-popover";
import { FileIcon } from "./file-icon";
import { RichMentionEditor, type RichMentionEditorRef } from "./rich-mention-editor";


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

export const MAX_ATTACHMENTS = 5;

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: "image" | "video" | "pdf" | "markdown" | "code" | "document" | "other";
  url?: string;
  base64?: string;
  path?: string;
  imageIndex?: number;
}

export const readBase64 = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });

export async function parseUploadedFiles(files: FileList | File[]): Promise<AttachedFile[]> {
  const result: AttachedFile[] = [];
  const list = Array.from(files);

  for (let i = 0; i < list.length; i++) {
    const file = list[i]!;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const fileType = (file.type || "").toLowerCase();
    let type: AttachedFile["type"] = "other";

    if (
      fileType.startsWith("image/") ||
      ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext)
    ) {
      type = "image";
    } else if (
      fileType.startsWith("video/") ||
      ["mp4", "webm", "mov", "mkv"].includes(ext)
    ) {
      type = "video";
    } else if (fileType === "application/pdf" || ext === "pdf") {
      type = "pdf";
    } else if (["md", "markdown"].includes(ext)) {
      type = "markdown";
    } else if (
      ["ts", "tsx", "js", "jsx", "json", "py", "rs", "go", "cpp", "c", "h", "css", "html", "sh", "sql"].includes(ext)
    ) {
      type = "code";
    } else if (["txt", "doc", "docx", "xls", "xlsx", "csv", "rtf"].includes(ext)) {
      type = "document";
    }

    const url = type === "image" || type === "video" ? URL.createObjectURL(file) : undefined;
    const base64 = type === "image" ? await readBase64(file) : undefined;

    result.push({
      id: `file_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      size: file.size,
      type,
      url: url || base64,
      base64,
      path: (file as any).path,
    });
  }

  return result;
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
  totalTokens?: number;
  cachedInputTokens?: number;
  uncachedInputTokens?: number;
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
    mode: "request_review" | "ask_before_changes" | "full_access";
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
  mode?: "request_review" | "ask_before_changes" | "full_access";
  onModeChange?: (mode: "request_review" | "ask_before_changes" | "full_access") => void;
  conversations?: ConversationItem[];
  sessionMedia?: AttachedFile[];
  onOpenFilePreview?: (filePath: string) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  forceIconOnly?: boolean;
}

export interface MentionedItem {
  id: string;
  name: string;
  kind: "file" | "directory" | "media" | "session";
  path: string;
  fullPath?: string;
  fileType?: "code" | "image" | "doc" | "generic";
  size?: number;
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
  mode: controlledMode,
  onModeChange,
  conversations,
  sessionMedia,
  onOpenFilePreview,
  onOpenTrajectory,
  forceIconOnly = false,
}: ChatCardProps) {
  const { t } = useTranslation();
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [containerNarrow, setContainerNarrow] = useState(false);

  useEffect(() => {
    const el = cardContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerNarrow(entry.contentRect.width < 500);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isNarrow = forceIconOnly || containerNarrow;

  const [prompt, setPrompt] = useState("");
  const editorRef = useRef<RichMentionEditorRef>(null);
  const [isContextOpen, setIsContextOpen] = useState(false);

  // Attachments & Plus Menu State
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [previewItem, setPreviewItem] = useState<AttachedFile | null>(null);
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    editorRef.current?.focus();
    return () => {
      attachments.forEach((a) => {
        if (a.url && a.url.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(a.url);
          } catch {}
        }
      });
    };
  }, []);

  useEffect(() => {
    if (initialPrompt !== undefined) {
      setPrompt(initialPrompt);
      if (initialPrompt !== "") {
        editorRef.current?.focus();
        editorRef.current?.setText(initialPrompt);
      }
    }
  }, [initialPrompt]);

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      toast.warning(`Maximum ${MAX_ATTACHMENTS} media attachments reached`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsPlusOpen(false);
      return;
    }

    const fileList = Array.from(files);
    if (fileList.length > remainingSlots) {
      toast.warning(
        `Only ${remainingSlots} more file(s) allowed (limit ${MAX_ATTACHMENTS}). Excess files were not uploaded.`
      );
    }

    const filesToProcess = fileList.slice(0, remainingSlots);
    const newAttached = await parseUploadedFiles(filesToProcess);

    setAttachments((prev) => [...prev, ...newAttached].slice(0, MAX_ATTACHMENTS));
    setIsPlusOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item?.url && item.url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(item.url);
        } catch {}
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const handlePasteFiles = async (files: FileList) => {
    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      toast.warning(`Maximum ${MAX_ATTACHMENTS} media attachments reached`);
      return;
    }

    const fileList = Array.from(files);
    if (fileList.length > remainingSlots) {
      toast.warning(
        `Only ${remainingSlots} more file(s) allowed (limit ${MAX_ATTACHMENTS}). Excess files were not uploaded.`
      );
    }

    const filesToProcess = fileList.slice(0, remainingSlots);
    const newAttached = await parseUploadedFiles(filesToProcess);
    setAttachments((prev) => [...prev, ...newAttached].slice(0, MAX_ATTACHMENTS));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const droppedFiles = e.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      toast.warning(`Maximum ${MAX_ATTACHMENTS} media attachments reached`);
      return;
    }

    const fileList = Array.from(droppedFiles);
    if (fileList.length > remainingSlots) {
      toast.warning(
        `Only ${remainingSlots} more file(s) allowed (limit ${MAX_ATTACHMENTS}). Excess files were not uploaded.`
      );
    }

    const filesToProcess = fileList.slice(0, remainingSlots);
    const newAttached = await parseUploadedFiles(filesToProcess);
    setAttachments((prev) => [...prev, ...newAttached].slice(0, MAX_ATTACHMENTS));
  };

  // 1. Workspace / Project Selector State (Clean, zero dummy projects)
  const [currentProject, setCurrentProject] = useState<string>(() => {
    if (typeof initialProject === "string" && initialProject !== "[object Object]") {
      return initialProject;
    }
    try {
      const saved = localStorage.getItem("const_harness_current_project");
      if (saved && saved !== "[object Object]" && typeof saved === "string") {
        return saved;
      }
    } catch {}
    return "Outside Project";
  });

  useEffect(() => {
    if (typeof initialProject === "string" && initialProject !== "[object Object]") {
      setCurrentProject(initialProject);
    } else if (initialProject !== undefined) {
      setCurrentProject("Outside Project");
    }
  }, [initialProject]);

  // Mention & Context Autocomplete State
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileEntry[]>([]);
  const [mentionToken, setMentionToken] = useState<ActiveAtToken | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const handleSerializedChange = useCallback((val: string) => {
    setPrompt(val);
  }, []);

  const handleMentionTokenChange = useCallback((token: ActiveAtToken | null) => {
    setMentionToken(token);
    if (!token) setMentionIndex(0);
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!currentProject || currentProject === "Outside Project") {
      setWorkspaceFiles([]);
      return;
    }
    if (window.electron?.listFiles) {
      window.electron
        .listFiles(currentProject)
        .then((res) => {
          if (isMounted && Array.isArray(res)) {
            setWorkspaceFiles(res);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [currentProject]);

  const allSessionMedia = useMemo(() => {
    const combined = [...(sessionMedia || []), ...attachments];
    const unique: AttachedFile[] = [];
    const seen = new Set<string>();
    for (const item of combined) {
      if (item && item.name && !seen.has(item.name)) {
        seen.add(item.name);
        unique.push(item);
      }
    }
    return unique;
  }, [sessionMedia, attachments]);

  const mentionCandidates = useMemo(() => {
    if (!mentionToken) return [];
    return searchMentionCandidates({
      query: mentionToken.query,
      quoted: mentionToken.quoted,
      files: workspaceFiles,
      sessionMedia: allSessionMedia,
      conversations,
      currentProject,
      maxResults: 25,
    });
  }, [mentionToken, workspaceFiles, allSessionMedia, conversations, currentProject]);

  const handleDrillDirectory = (candidate: MentionCandidate) => {
    if (!candidate || !candidate.drillPath) return;
    editorRef.current?.drillDirectory(candidate);
    setMentionIndex(0);
  };

  const handleSelectMentionCandidate = (candidate: MentionCandidate) => {
    if (!candidate) return;
    editorRef.current?.insertMention(candidate);
    setMentionToken(null);
    setMentionIndex(0);
  };
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

  // 2. Access Mode State (request_review, ask_before_changes, full_access)
  const [mode, setMode] = useState<"request_review" | "ask_before_changes" | "full_access">(() => {
    if (controlledMode) return controlledMode;
    return getDefaultAgentMode();
  });

  useEffect(() => {
    if (controlledMode !== undefined) {
      setMode(controlledMode);
    }
  }, [controlledMode]);

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
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
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
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 128000,
      contextWindow: 128000,
    },
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash",
      desc: "Advanced frontier thinking & reasoning depth",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
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
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 128000,
      contextWindow: 1048576,
    },
    {
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash",
      desc: "Frontier multimodal reasoning & code generation",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 128000,
      contextWindow: 1048576,
    },
    {
      id: "qwen-3.8-27b",
      name: "Qwen 3.8 27B",
      desc: "Open-weight reasoning powerhouse with deep thinking capabilities",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
      defaultThinkingLevel: "medium",
      maxOutputTokens: 65536,
      contextWindow: 131072,
    },
    {
      id: "combo/auto",
      name: "combo/auto",
      desc: "Virtual Combo auto router with dynamic reasoning",
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
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
      thinkingLevels: ["low", "medium", "high", "xhigh", "max"],
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
      return "Gemini 3.8 Flash";
    }
    if (saved === "gemini-3.8-flash") return "Gemini 3.8 Flash";
    if (saved === "gemini-3.7-flash") return "Gemini 3.7 Flash";
    if (saved === "gemini-3.6-flash") return "Gemini 3.6 Flash";
    if (saved === "qwen-3.8-27b") return "Qwen 3.8 27B";
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
      models.find((m) => m.id === "gemini-3.8-flash") ||
      models.find((m) => m.name === "Gemini 3.8 Flash") ||
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
      : currentModelItem?.supportsThinking !== undefined
      ? currentModelItem.supportsThinking
      : true
  );

  const supportedThinkingLevels: string[] = useMemo(() => {
    if (!isThinkingSupported) return [];
    if (currentModelItem?.thinkingLevels && currentModelItem.thinkingLevels.length > 0) {
      return currentModelItem.thinkingLevels;
    }
    return ["low", "medium", "high", "xhigh", "max"];
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
        let fallback = currentModelItem?.defaultThinkingLevel;
        if (!fallback || !supportedThinkingLevels.includes(fallback)) {
          fallback = supportedThinkingLevels.includes("medium")
            ? "medium"
            : supportedThinkingLevels[supportedThinkingLevels.length - 1]!;
        }
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
              let supportsThinking =
                m.id === "combo/fast"
                  ? false
                  : m.supportsThinking !== undefined
                  ? Boolean(m.supportsThinking)
                  : true;
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
                thinkingLevels: supportsThinking
                  ? m.thinkingLevels || m.thinking_levels || ["low", "medium", "high", "xhigh", "max"]
                  : undefined,
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

            // Normalize selectedModel with freshly loaded models
            setSelectedModel((prev) => {
              const current = prev || localStorage.getItem("const_harness_active_model");
              if (!current || current === "gemini-3.8-flash" || current === "gemini-3.6-flash") {
                const foundDefault = deduped.find((m) => m.id === "gemini-3.8-flash");
                const defaultName = foundDefault ? foundDefault.name : "Gemini 3.8 Flash";
                localStorage.setItem("const_harness_active_model", defaultName);
                return defaultName;
              }
              const found = deduped.find((m) => m.id === current || m.name === current);
              if (found) {
                localStorage.setItem("const_harness_active_model", found.name);
                return found.name;
              }
              return current;
            });
          }
        })
        .catch(() => {});
    }

    if (window.electron?.getConfig) {
      window.electron.getConfig().then((cfg) => {
        if (cfg?.activeModel) {
          const raw = cfg.activeModel;
          let modelName = raw;
          if (raw === "gemini-3.8-flash") modelName = "Gemini 3.8 Flash";
          else if (raw === "gemini-3.7-flash") modelName = "Gemini 3.7 Flash";
          else if (raw === "gemini-3.6-flash") modelName = "Gemini 3.6 Flash";
          else if (raw === "qwen-3.8-27b") modelName = "Qwen 3.8 27B";
          else if (raw === "combo/auto" || raw === "Auto Router" || raw === "Auto (Best Available)") modelName = "combo/auto";
          else if (raw === "combo/fast" || raw === "Low-Latency Fast Chain" || raw === "Fast (Low Latency)") modelName = "combo/fast";
          else if (raw === "combo/coding" || raw === "Coding Agent Chain" || raw === "Coding & Reasoning") modelName = "combo/coding";
          else {
            const found = models.find((m) => m.id === raw || m.name === raw);
            if (found) modelName = found.name;
          }
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
    let text = (editorRef.current?.getText() || prompt).trim();
    if ((!text && attachments.length === 0) || isExecuting) return;

    if (!text && attachments.length > 0) {
      text = "Please analyze the attached media/file(s).";
    }

    const currentAttachments = [...attachments];
    setPrompt("");
    editorRef.current?.clear();
    setAttachments([]);
    const matchedModel = models.find((m) => m.name === selectedModel || m.id === selectedModel);
    onSendMessage?.({
      prompt: text,
      project: currentProject,
      mode,
      model: matchedModel?.id || currentModelItem?.id || "gemini-3.8-flash",
      thinkingLevel: isThinkingSupported ? thinkingLevel : undefined,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      maxOutputTokens: matchedModel?.maxOutputTokens || currentModelItem?.maxOutputTokens,
    });
  };

  const displayProjectName =
    !currentProject || typeof currentProject !== "string" || currentProject === "Outside Project" || currentProject === "[object Object]"
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
    setMentionToken(null);
  };

  const isAnyBottomMenuOpen =
    isPlusOpen || isModeOpen || isContextOpen || isModelOpen || isThinkingOpen || Boolean(mentionToken);

  return (
    <div
      ref={cardContainerRef}
      className="w-full max-w-full flex flex-col items-center gap-2 select-none min-w-0"
    >
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
                  if (next) setSearchWorkspace("");
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
                <div className="absolute top-full left-0 mt-2 w-64 sm:w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-1.5 z-[60] flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                  {/* Real Workspaces List (only shown if real folders were opened) */}
                  {workspaces.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 border-b border-[#e2e2e4] dark:border-[#383838]/60">
                        <Search className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#5d5d5d] shrink-0" />
                        <input
                          type="text"
                          value={searchWorkspace}
                          onChange={(e) => setSearchWorkspace(e.target.value)}
                          placeholder={t("workbench.searchWorkspaces")}
                          className="w-full bg-transparent text-[13px] text-[#262626] dark:text-[#d4d4d4] placeholder:text-[#a9a9a9] dark:placeholder:text-[#5d5d5d] outline-none font-sans"
                          autoFocus
                        />
                      </div>

                      <ScrollArea className="max-h-48">
                        <div className="flex flex-col gap-0.5 py-0.5">
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
                      </ScrollArea>

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
                    <span>{t("sidebar.openFolder")}</span>
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
                      <span>{t("sidebar.outsideProject")}</span>
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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "w-full bg-[#ffffff] dark:bg-[#2b2b2b] flex flex-col justify-between transition-colors min-w-0 relative",
            compact
              ? "max-w-full rounded-2xl"
              : "rounded-2xl border border-[#e2e2e4] dark:border-[#383838] -mx-[1px] -mb-[1px] w-[calc(100%+2px)] max-w-[calc(100%+2px)]",
            isDraggingOver && "ring-2 ring-primary/60 border-primary dark:border-primary/80 bg-primary/5",
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

          <div className="w-full px-3 sm:px-3.5 pt-2.5 pb-2.5 flex flex-col justify-between min-w-0 relative">
            {/* Mention Autocomplete Popover */}
            {mentionToken && (
              <MentionPopover
                candidates={mentionCandidates}
                selectedIndex={mentionIndex}
                onSelect={handleSelectMentionCandidate}
                onDrill={handleDrillDirectory}
                onHover={(idx) => setMentionIndex(idx)}
              />
            )}

            {/* Attachments Shelf (Square Cards for Images, Videos, PDFs, Docs) */}
            {attachments.length > 0 && (
              <div className="w-full flex items-center gap-2.5 pt-1.5 pb-2.5 px-0.5 overflow-x-auto select-none scrollbar-none">
                <TooltipProvider delayDuration={150}>
                  {attachments.map((file) => {
                    const isImage = file.type === "image";
                    const isVideo = file.type === "video";
                    const isMedia = isImage || isVideo;
                    const ext = (file.name.split(".").pop() || "FILE").toUpperCase();
                    const mediaSrc = file.url || file.base64;

                    return (
                      <Tooltip key={file.id}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => setPreviewItem(file)}
                            className={cn(
                              "relative group shrink-0 rounded-xl border border-[#e2e2e4] dark:border-[#383838] shadow-sm animate-in fade-in zoom-in-95 duration-100 bg-[#f4f4f6] dark:bg-[#1a1917] select-none cursor-pointer transition-all",
                              isMedia
                                ? "w-20 h-20 hover:opacity-90 active:scale-[0.98]"
                                : "w-32 sm:w-36 h-20 hover:border-black/30 dark:hover:border-white/30"
                            )}
                          >
                            {isImage && mediaSrc ? (
                              <div className="w-full h-full rounded-xl overflow-hidden relative">
                                <img
                                  src={mediaSrc}
                                  alt={file.name}
                                  className="w-full h-full object-cover block"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  <p className="text-[8.5px] text-white font-medium truncate leading-tight px-0.5">
                                    {file.name}
                                  </p>
                                </div>
                              </div>
                            ) : isVideo && file.url ? (
                              <div className="w-full h-full rounded-xl overflow-hidden bg-black relative flex items-center justify-center">
                                <video
                                  src={file.url}
                                  className="w-full h-full object-cover block pointer-events-none"
                                  muted
                                  playsInline
                                  autoPlay
                                  loop
                                />
                                <span className="absolute bottom-1 right-1 text-[8px] font-bold text-white bg-black/60 px-1 py-0.5 rounded uppercase tracking-wider font-mono">
                                  Video
                                </span>
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  <p className="text-[8.5px] text-white font-medium truncate leading-tight px-0.5">
                                    {file.name}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full p-2 flex flex-col justify-between items-start text-left bg-[#f4f4f6] dark:bg-[#1a1917]/70 rounded-xl">
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-[9px] font-bold text-[#888888] dark:text-[#888888] tracking-wider uppercase font-mono">
                                    {ext}
                                  </span>
                                  <FileIcon filename={file.name} className="w-3.5 h-3.5 shrink-0" />
                                </div>
                                <div className="w-full min-w-0">
                                  <span className="text-[11px] font-medium text-[#262626] dark:text-[#d4d4d4] leading-tight w-full line-clamp-2 break-words block" title={file.name}>
                                    {file.name}
                                  </span>
                                  <span className="text-[8.5px] text-[#a9a9a9] dark:text-[#777777] font-sans tabular-nums mt-0.5 block truncate">
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
                          <div className="text-[9.5px] text-[#a0a0a0] font-sans tabular-nums mt-0.5">
                            {formatFileSize(file.size)}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            )}

          {/* Auto-growing Textarea with Inline Mentions matching Screenshot */}
          {/* Inline Rich Mention Editor matching Antigravity & Image 1 */}
          <div
            onClick={() => {
              editorRef.current?.focus();
            }}
            className="w-full py-0.5 cursor-text"
          >
            <RichMentionEditor
              ref={editorRef}
              initialValue={initialPrompt || ""}
              onSerializedChange={handleSerializedChange}
              onMentionTokenChange={handleMentionTokenChange}
              onOpenFilePreview={onOpenFilePreview}
              onOpenTrajectory={onOpenTrajectory}
              onSend={handleSend}
              onPasteFiles={handlePasteFiles}
              placeholder={t("workbench.askPlaceholder")}
              disabled={isExecuting}
              onKeyDown={(e) => {
                if (mentionToken && mentionCandidates.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
                    return;
                  }
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const candidate = mentionCandidates[mentionIndex];
                    if (candidate) {
                      if (candidate.drill) {
                        handleDrillDirectory(candidate);
                      } else {
                        handleSelectMentionCandidate(candidate);
                      }
                    }
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const candidate = mentionCandidates[mentionIndex];
                    if (candidate) {
                      handleSelectMentionCandidate(candidate);
                    }
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setMentionToken(null);
                    return;
                  }
                }
              }}
            />
          </div>

          {/* Bottom Actions Row: Plus, Hand/Shield, Context Window, Model Selector, Send Button */}
          <div className={cn("flex items-center justify-between pt-2.5 text-xs relative w-full min-w-0 gap-1.5", isAnyBottomMenuOpen ? "z-40" : "z-10")}>
            {/* Left Actions: Plus and Mode Selector */}
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 shrink">
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
                  disabled={attachments.length >= MAX_ATTACHMENTS}
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/*,video/*,audio/*,.pdf,.md,.markdown,.txt,.json,.js,.jsx,.ts,.tsx,.py,.rs,.go,.cpp,.c,.h,.css,.html,.csv,.doc,.docx"
                />

                {/* Add Context Popover Menu */}
                {isPlusOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-44 max-w-[calc(100vw-32px)] bg-white dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-1.5 z-[60] flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[11px] font-medium text-[#a9a9a9] dark:text-[#777777]">
                      {t("workbench.addContext")}
                    </div>

                    {/* 1. Media */}
                    <button
                      type="button"
                      disabled={attachments.length >= MAX_ATTACHMENTS}
                      onClick={() => {
                        setIsPlusOpen(false);
                        if (attachments.length >= MAX_ATTACHMENTS) {
                          toast.warning(t("workbench.maxMediaReached").replace("{count}", String(MAX_ATTACHMENTS)));
                          return;
                        }
                        fileInputRef.current?.click();
                      }}
                      className={cn(
                        "w-full px-2.5 py-2 flex items-center justify-between rounded-xl text-xs transition-colors cursor-pointer group",
                        attachments.length >= MAX_ATTACHMENTS
                          ? "opacity-50 cursor-not-allowed text-[#a9a9a9] dark:text-[#777777]"
                          : "hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <ImageIcon className="w-4 h-4 text-[#a9a9a9] dark:text-[#888888] group-hover:text-[#262626] dark:group-hover:text-white shrink-0" />
                        <span className="text-[13px]">{t("workbench.media")}</span>
                      </div>
                      {attachments.length > 0 && (
                        <span className="text-[10px] font-sans tabular-nums text-[#a9a9a9] dark:text-[#777777]">
                          {attachments.length}/{MAX_ATTACHMENTS}
                        </span>
                      )}
                    </button>

                    {/* 2. Mentions */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusOpen(false);
                        editorRef.current?.insertAt();
                      }}
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <AtSign className="w-4 h-4 text-[#a9a9a9] dark:text-[#888888] group-hover:text-[#262626] dark:group-hover:text-white shrink-0" />
                      <span className="text-[13px]">{t("workbench.mentions")}</span>
                    </button>

                    {/* 3. Actions */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusOpen(false);
                        editorRef.current?.insertCommand(" /");
                      }}
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <SquarePen className="w-4 h-4 text-[#a9a9a9] dark:text-[#888888] group-hover:text-[#262626] dark:group-hover:text-white shrink-0" />
                      <span className="text-[13px]">{t("common.actions")}</span>
                    </button>

                    {/* 4. Browser */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusOpen(false);
                        editorRef.current?.insertCommand(" @browser ");
                      }}
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <Globe className="w-4 h-4 text-[#a9a9a9] dark:text-[#888888] group-hover:text-[#262626] dark:group-hover:text-white shrink-0" />
                      <span className="text-[13px]">{t("rightPane.browser")}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Access Mode Selector: Ask before changes vs Full access */}
              <div className="relative min-w-0 shrink" ref={modeMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isModeOpen;
                    closeAllMenus();
                    setIsModeOpen(next);
                  }}
                  className={cn(
                    "inline-flex items-center transition-colors cursor-pointer",
                    isNarrow
                      ? "w-7 h-7 justify-center rounded-md"
                      : "gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-md text-[13px] font-normal min-w-0 max-w-[155px]",
                    mode === "full_access"
                      ? "text-[#e79737] hover:bg-[#e79737]/10"
                      : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                  title={
                    mode === "full_access"
                      ? "Full access"
                      : mode === "request_review"
                      ? "Request review"
                      : "Ask before changes"
                  }
                >
                  {mode === "full_access" ? (
                    <ShieldAlert className="w-4 h-4 text-[#e79737] stroke-[1.75] shrink-0" />
                  ) : mode === "request_review" ? (
                    <Eye className="w-4 h-4 text-[#262626] dark:text-[#d4d4d4] stroke-[1.75] shrink-0" />
                  ) : (
                    <Hand className="w-4 h-4 text-[#a9a9a9] dark:text-[#d4d4d4] stroke-[1.75] shrink-0" />
                  )}
                  {!isNarrow && (
                    <>
                      <span className="truncate min-w-0">
                        {mode === "full_access"
                          ? "Full access"
                          : mode === "request_review"
                          ? "Request review"
                          : "Ask before changes"}
                      </span>
                      <ChevronDown
                        className={`w-3 h-3 ml-0.5 shrink-0 ${
                          mode === "full_access"
                            ? "text-[#e79737]"
                            : "text-[#a9a9a9] dark:text-[#5d5d5d]"
                        }`}
                      />
                    </>
                  )}
                </button>

                {/* Mode Selector Popover (3 items: Request review, Ask before changes & Full access) */}
                {isModeOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-64 sm:w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-1.5 z-[60] flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    {/* 1. Request review */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("request_review");
                        onModeChange?.("request_review");
                        setIsModeOpen(false);
                      }}
                      className="w-full p-2.5 flex items-start gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors cursor-pointer group"
                    >
                      <Eye className="w-4 h-4 text-[#262626] dark:text-[#d4d4d4] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[13px] font-normal text-[#262626] dark:text-[#d4d4d4] group-hover:text-black dark:group-hover:text-white">
                          Request review
                        </div>
                        <div className="text-[12px] text-[#a9a9a9] dark:text-[#888888] leading-tight mt-0.5">
                          Request approval before every action (files, commands).
                        </div>
                      </div>
                      {mode === "request_review" && (
                        <Check className="w-3.5 h-3.5 text-[#262626] dark:text-[#d4d4d4] shrink-0 ml-auto mt-0.5" />
                      )}
                    </button>

                    {/* 2. Ask before changes */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("ask_before_changes");
                        onModeChange?.("ask_before_changes");
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
                          Ask before terminal & external changes.
                        </div>
                      </div>
                      {mode === "ask_before_changes" && (
                        <Check className="w-3.5 h-3.5 text-[#262626] dark:text-[#d4d4d4] shrink-0 ml-auto mt-0.5" />
                      )}
                    </button>

                    {/* 3. Full access */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("full_access");
                        onModeChange?.("full_access");
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

            {/* Right Actions: Model Selector, Send Button */}
            <div className="flex items-center gap-1 sm:gap-2 shrink min-w-0 ml-auto">
              {/* Model Selector Dropdown (Const ∨) */}
              <div className="relative min-w-0 shrink" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isModelOpen;
                    closeAllMenus();
                    if (next) setSearchModelQuery("");
                    setIsModelOpen(next);
                  }}
                  className={cn(
                    "inline-flex items-center transition-colors cursor-pointer text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 text-[13px] font-normal",
                    isNarrow
                      ? "w-7 h-7 justify-center rounded-md"
                      : "gap-1 px-1.5 py-1 rounded-md min-w-0 max-w-[120px] sm:max-w-[180px] md:max-w-[240px]"
                  )}
                  title={`Model: ${currentModelItem?.name || selectedModel || "Gemini 3.8 Flash"}`}
                >
                  {isNarrow ? (
                    <Box className="w-4 h-4 text-[#a9a9a9] dark:text-[#d4d4d4] stroke-[1.75] shrink-0" />
                  ) : (
                    <>
                      <span className="truncate min-w-0">{currentModelItem?.name || selectedModel || "Gemini 3.8 Flash"}</span>
                      <ChevronDown className="w-3 h-3 text-[#a9a9a9] dark:text-[#5d5d5d] ml-0.5 shrink-0" />
                    </>
                  )}
                </button>

                {/* Model Selector Popover */}
                {isModelOpen && (
                  <div className="absolute bottom-full mb-2 right-0 w-[260px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-1.5 z-[60] flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                    {models.length > 0 ? (
                      <>
                        {/* Search Input at the top (pinned, outside scroll) */}
                        <div className="flex-none flex items-center gap-2 px-2.5 py-1.5 mb-1 border-b border-[#e2e2e4]/60 dark:border-[#383838]/60">
                          <Search className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#777777] shrink-0" />
                          <input
                            type="text"
                            value={searchModelQuery}
                            onChange={(e) => setSearchModelQuery(e.target.value)}
                            placeholder="Search models..."
                            className="w-full bg-transparent text-[12px] text-[#262626] dark:text-[#d4d4d4] placeholder:text-[#a9a9a9] dark:placeholder:text-[#777777] outline-none font-sans"
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
                          <ScrollArea className="max-h-[260px] w-full flex-1 min-h-0">
                            <div className="space-y-1.5 py-0.5">
                              {filteredGroupedModels.map((group) => (
                                <div key={group.providerId} className="flex flex-col">
                                  {/* Category Header */}
                                  <div className="px-2.5 pt-1.5 pb-0.5 text-[11px] font-medium text-[#a9a9a9] dark:text-[#888888] uppercase tracking-wider select-none">
                                    {group.providerName}
                                  </div>

                                  {/* Model Items */}
                                  <div className="flex flex-col space-y-0.5">
                                    {group.items.map((m) => {
                                      const isSelected =
                                        currentModelItem?.id === m.id ||
                                        selectedModel === m.name ||
                                        selectedModel === m.id;
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
                                            "w-full px-2.5 py-1.5 flex items-center justify-between text-[12px] rounded-lg transition-colors cursor-pointer text-left",
                                            isSelected
                                              ? "bg-black/10 dark:bg-white/10 text-black dark:text-white font-medium"
                                              : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                                          )}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                            <span className="truncate font-normal">{m.name}</span>
                                          </div>
                                          {isSelected && (
                                            <Check className="w-3.5 h-3.5 text-[#262626] dark:text-[#d4d4d4] shrink-0 ml-auto" />
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
                        <div className="flex-none pt-1 mt-1 border-t border-[#e2e2e4]/60 dark:border-[#383838]/60">
                          <button
                            type="button"
                            onClick={() => {
                              setIsModelOpen(false);
                              onOpenSettings?.("model-settings");
                            }}
                            className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
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
                    className={cn(
                      "inline-flex items-center transition-colors cursor-pointer text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 text-[13px] font-normal shrink-0",
                      isNarrow
                        ? "w-7 h-7 justify-center rounded-md"
                        : "gap-1 px-1.5 py-1 rounded-md"
                    )}
                    title={`Thinking effort: ${thinkingLevel}`}
                    aria-label={`Thinking effort: ${thinkingLevel}`}
                  >
                    <Brain className="w-4 h-4 text-[#a9a9a9] dark:text-[#d4d4d4] stroke-[1.75] shrink-0" />
                    {!isNarrow && (
                      <>
                        <span className="capitalize">{thinkingLevel === "xhigh" ? "XHigh" : thinkingLevel}</span>
                        <ChevronDown className="w-3 h-3 text-[#a9a9a9] dark:text-[#5d5d5d] ml-0.5 shrink-0" />
                      </>
                    )}
                  </button>

                  {/* Thinking Level Popover Dropdown */}
                  {isThinkingOpen && (
                    <div className="absolute bottom-full mb-2 right-0 w-36 max-w-[calc(100vw-32px)] bg-white dark:bg-[#222222] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl shadow-2xl p-1.5 z-[60] flex flex-col text-left select-none animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2 py-1 text-[11px] font-medium text-[#a9a9a9] dark:text-[#888888] uppercase tracking-wider mb-0.5">
                        {t("workbench.thinking")}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {supportedThinkingLevels.map((lvl) => {
                          const isSelected = thinkingLevel === lvl;
                          const label = lvl === "xhigh" ? "XHigh" : lvl.charAt(0).toUpperCase() + lvl.slice(1);
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => {
                                setThinkingLevel(lvl);
                                localStorage.setItem("const_harness_thinking_level", lvl);
                                localStorage.setItem("const_harness_user_thinking_override", "true");
                                setIsThinkingOpen(false);
                              }}
                              className={cn(
                                "w-full px-2.5 py-1.5 flex items-center justify-between text-[12px] rounded-lg transition-colors cursor-pointer text-left",
                                isSelected
                                  ? "bg-black/10 dark:bg-white/10 text-black dark:text-white font-medium"
                                  : "text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                              )}
                            >
                              <span className="font-normal">{label}</span>
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAbort?.();
                  }}
                  className="w-7 h-7 rounded-lg bg-[#dedee2] hover:bg-[#d5d5d9] dark:bg-[#383838] dark:hover:bg-[#454545] text-[#e79737] dark:text-[#ff7a00] flex items-center justify-center cursor-pointer select-none transition-colors shrink-0"
                  title={t("workbench.stopExecution")}
                  aria-label={t("workbench.stopExecution")}
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
                  title={t("workbench.sendMessage")}
                  aria-label={t("workbench.sendMessage")}
                >
                  <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Active Conversation Footer Telemetry Bar */}
      {compact && (metrics || shouldShowContextUsage) && (() => {
        const convTokens = metrics ? (metrics.totalTokens ?? (metrics.inputTokens + metrics.outputTokens)) : 0;
        const cachedInputTokens = metrics ? (metrics.cachedInputTokens ?? Math.round(metrics.inputTokens * (metrics.cacheHitRate / 100))) : 0;
        const uncachedInputTokens = metrics ? (metrics.uncachedInputTokens ?? Math.max(0, metrics.inputTokens - cachedInputTokens)) : 0;

        return (
          <div className="w-full flex items-center justify-between gap-2 sm:gap-4 pt-2 pb-0.5 px-1 select-none flex-wrap">
            {/* Left: Session statistics & Context Windows */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              {metrics && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                      title="Session statistics"
                    >
                      <Gauge className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {metrics.turns} {metrics.turns === 1 ? "turn" : "turns"} · {metrics.steps} steps · {metrics.tokPerSec} tok/s
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    sideOffset={8}
                    className="w-72 sm:w-80 p-3.5 rounded-xl bg-popover/95 backdrop-blur-md border border-border/80 shadow-2xl z-50 font-sans"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-[13px] text-foreground">Session statistics</span>
                    </div>
                    <div className="space-y-2 text-[12.5px] font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">LLM time</span>
                        <span className="tabular-nums text-foreground">{formatDurationDisplay(metrics.llmDurationMs)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tool time</span>
                        <span className="tabular-nums text-foreground">{formatDurationDisplay(metrics.toolDurationMs)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Avg time to first token (TTFT)</span>
                        <span className="tabular-nums text-foreground">{metrics.ttftSeconds.toFixed(1)}s</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tokens per second (TPS)</span>
                        <span className="tabular-nums text-foreground">{metrics.tokPerSec} tok/s</span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Context Window usage (Circle progress + percentage) */}
              {shouldShowContextUsage && (
                <Popover open={isContextOpen} onOpenChange={setIsContextOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 group",
                        rawPercentUsed >= 90
                          ? "text-red-500 hover:text-red-400 hover:bg-red-500/10 data-[state=open]:bg-red-500/15"
                          : rawPercentUsed >= 75
                          ? "text-[#e79737] hover:text-[#ff9838] hover:bg-[#e79737]/10 data-[state=open]:bg-[#e79737]/15"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground"
                      )}
                      title={`Context window: ${rawPercentUsed === 0 ? "0%" : rawPercentUsed < 0.1 ? "<0.1%" : `${percentUsed}%`} (~${formatTokenDisplay(usedTokens)} / ${formatTokenDisplay(totalTokens)})`}
                      aria-label="Context window usage"
                    >
                      <svg
                        className="w-3.5 h-3.5 shrink-0 transform -rotate-90"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="none"
                          stroke="currentColor"
                          className="text-muted-foreground/30 dark:text-muted-foreground/20"
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
                            56.55 - (56.55 * (rawPercentUsed > 0 ? Math.max(1, safePercent) : 0)) / 100
                          }
                          strokeLinecap="round"
                          className={cn(
                            rawPercentUsed >= 90
                              ? "text-red-500"
                              : rawPercentUsed >= 75
                              ? "text-[#e79737]"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                      </svg>
                      <span className="tabular-nums font-medium">
                        {rawPercentUsed === 0 ? "0%" : rawPercentUsed < 0.1 ? "<0.1%" : `${percentUsed}%`}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    sideOffset={8}
                    className="w-72 sm:w-80 p-3.5 rounded-xl bg-popover/95 backdrop-blur-md border border-border/80 shadow-2xl z-50 font-sans select-none flex flex-col gap-3"
                  >
                    {/* Header: % of context used and tokens */}
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-foreground font-medium">
                        {rawPercentUsed === 0 ? "0%" : rawPercentUsed < 0.1 ? "<0.1%" : `${percentUsed}%`} of context used
                      </span>
                      <span className="font-sans tabular-nums text-[12px] text-muted-foreground">
                        ~{formatTokenDisplay(usedTokens)} / {formatTokenDisplay(totalTokens)}
                      </span>
                    </div>

                    {/* Multi-segment Horizontal Progress Bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex gap-0.5">
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
                    <div className="flex flex-col gap-2 pt-1 text-[12px]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-xs bg-[#71717a] shrink-0" />
                          <span className="text-foreground">System prompt</span>
                        </div>
                        <span className="font-sans tabular-nums text-foreground">
                          ~{formatTokenDisplay(systemPromptTokens)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-xs bg-[#a855f7] shrink-0" />
                          <span className="text-foreground">Tools</span>
                        </div>
                        <span className="font-sans tabular-nums text-foreground">
                          ~{formatTokenDisplay(toolsTokens)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-xs bg-[#3b82f6] shrink-0" />
                          <span className="text-foreground">Messages</span>
                        </div>
                        <span className="font-sans tabular-nums text-foreground">
                          ~{formatTokenDisplay(effectiveMessagesTokens)}
                        </span>
                      </div>

                      {draftInputTokens > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-xs bg-[#10b981] shrink-0" />
                            <span className="text-[#10b981] font-medium">Current input</span>
                          </div>
                          <span className="font-sans tabular-nums text-[#10b981]">
                            ~{formatTokenDisplay(draftInputTokens)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-border/80">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-xs bg-muted-foreground/30 shrink-0" />
                          <span className="text-muted-foreground">Available context</span>
                        </div>
                        <span className="font-sans tabular-nums text-muted-foreground">
                          ~{formatTokenDisplay(Math.max(0, totalTokens - usedTokens))}
                        </span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Right: Token usage (Database) */}
            {metrics && (
              <div className="flex items-center ml-auto shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                      title="Token usage"
                    >
                      <Database className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {formatTokenDisplay(convTokens)} tok · Cache hit {metrics.cacheHitRate}%
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={8}
                    className="w-72 sm:w-80 p-3.5 rounded-xl bg-popover/95 backdrop-blur-md border border-border/80 shadow-2xl z-50 font-sans"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-[13px] text-foreground">Token usage</span>
                      </div>
                      <span className="tabular-nums font-medium text-foreground text-[13px]">
                        {convTokens.toLocaleString()} tok
                      </span>
                    </div>
                    <div className="space-y-2 text-[12.5px] font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cache hit</span>
                        <span className="tabular-nums text-foreground">{metrics.cacheHitRate}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Uncached input</span>
                        <span className="tabular-nums text-foreground">{uncachedInputTokens.toLocaleString()} tok</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cached input</span>
                        <span className="tabular-nums text-foreground">{cachedInputTokens.toLocaleString()} tok</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Output</span>
                        <span className="tabular-nums text-foreground">{metrics.outputTokens.toLocaleString()} tok</span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        );
      })()}

      {/* Media Lightbox Preview Modal */}
      {previewItem && (
        <ImageLightbox
          src={previewItem.url || previewItem.base64 || ""}
          alt={previewItem.name}
          type={previewItem.type}
          fileSize={previewItem.size}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
