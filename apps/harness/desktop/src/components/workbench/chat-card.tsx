import { createPortal } from "react-dom";
import { useRemoteRuntime } from "../../lib/remote-runtime";
import { getModelContextLimit } from "../../lib/model-context";
import { estimateMessage } from "@const/agent/token-meter";
import { ROUTER_DEFAULT_MODELS } from "../../lib/router-models";
import { modelDisplayName, uniqueModelsById, resolveModelId } from "../../lib/model-identity";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Folder,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  X,
  Brain,
  Gauge,
  Database,
  Box,
  Eye,
  PencilSparkles,
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
import { ImageLightbox } from "./image-lightbox";
import { AttachedTaskBanner } from "./attached-task-banner";
import type { BackgroundTaskItem } from "../../vite-env";
import { getDefaultAgentMode, type ConversationItem } from "../../lib/conversation-store";
import { useTranslation } from "../../lib/i18n";
import {
  type ActiveAtToken,
  type MentionCandidate,
  type WorkspaceFileEntry,
  searchMentionCandidates,
} from "../../lib/mention-search";
import { MentionPopover } from "./mention-popover";
import { FileIcon } from "./file-icon";
import { RichMentionEditor, type RichMentionEditorRef, type ActiveSlashToken } from "./rich-mention-editor";
import { QueueDock, type QueuedMessageItem } from "./queue-dock";
import type { LocalSkill } from "../../lib/db";
import { SkillSlashPopover } from "./skill-slash-popover";
import { extractSkillsAndAugmentPrompt } from "../../lib/skills/skills-service";
import { useResolvedSkills } from "../../lib/skills/use-skills";
import { usePluginInventory } from "../../lib/plugins/plugins-service";


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
  if (ms < 1000) return `${(Math.max(0, ms) / 1000).toFixed(2)}s`;
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
  type: "image" | "video" | "audio" | "pdf" | "markdown" | "code" | "document" | "presentation" | "spreadsheet" | "other";
  url?: string;
  base64?: string;
  path?: string;
  imageIndex?: number;
  textContent?: string;
  pages?: number;
}

export function cleanAttachmentsForPersistence(attachments?: AttachedFile[]): AttachedFile[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map((att) => {
    const permanentUrl = att.path
      ? `const-file://${att.path.replace(/\\/g, "/")}`
      : att.url?.startsWith("blob:")
      ? undefined
      : att.url;
    return {
      ...att,
      url: permanentUrl || att.url,
    };
  });
}

export const readBase64 = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });

export async function parseUploadedFiles(files: FileList | File[], conversationId?: string): Promise<AttachedFile[]> {
  const result: AttachedFile[] = [];
  const list = Array.from(files);

  for (let i = 0; i < list.length; i++) {
    const file = list[i]!;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const fileType = (file.type || "").toLowerCase();
    let type: AttachedFile["type"] = "other";

    if (
      fileType.startsWith("image/") ||
      ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "ico"].includes(ext)
    ) {
      type = "image";
    } else if (
      fileType.startsWith("video/") ||
      ["mp4", "webm", "mov", "mkv", "avi"].includes(ext)
    ) {
      type = "video";
    } else if (
      fileType.startsWith("audio/") ||
      ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)
    ) {
      type = "audio";
    } else if (fileType === "application/pdf" || ext === "pdf") {
      type = "pdf";
    } else if (["pptx", "ppt", "odp"].includes(ext)) {
      type = "presentation";
    } else if (["xlsx", "xls", "ods"].includes(ext)) {
      type = "spreadsheet";
    } else if (["md", "markdown"].includes(ext)) {
      type = "markdown";
    } else if (
      [
        "ts", "tsx", "js", "jsx", "json", "py", "rs", "go", "cpp", "c", "h", "hpp", "cs",
        "css", "html", "sh", "bash", "zsh", "sql", "yaml", "yml", "xml", "toml", "env", "ini"
      ].includes(ext)
    ) {
      type = "code";
    } else if (["txt", "doc", "docx", "csv", "tsv", "rtf", "log", "odt"].includes(ext)) {
      type = "document";
    }

    const filePath =
      window.electron && typeof window.electron.getPathForFile === "function"
        ? window.electron.getPathForFile(file)
        : (file as any).path || "";

    const isMedia = type === "image" || type === "video" || type === "audio";
    const url = isMedia ? URL.createObjectURL(file) : undefined;
    const base64 = (type === "image" || type === "pdf" || file.size < 8 * 1024 * 1024)
      ? await readBase64(file)
      : undefined;

    let textContent: string | undefined;
    let pages: number | undefined;

    // 1. Text/Code/Markdown/CSV direct extraction
    const isPlainText =
      ["markdown", "code"].includes(type) ||
      (["document"].includes(type) && !["docx", "doc", "rtf", "odt"].includes(ext));

    if (isPlainText && file.size < 5 * 1024 * 1024) {
      try {
        textContent = await file.text();
        if (textContent.length > 80_000) {
          textContent = textContent.slice(0, 80_000) + "\n... [Content truncated at 80,000 characters]";
        }
      } catch {}
    }

    // 2. Office Document Extraction (.docx, .pptx, .xlsx, .odt, .ods, .odp)
    const isOfficeDoc = ["docx", "pptx", "xlsx", "odt", "ods", "odp"].includes(ext);
    if (isOfficeDoc && window.electron?.extractDocumentText) {
      try {
        const res = await window.electron.extractDocumentText({
          filePath: filePath || undefined,
          bufferBase64: !filePath ? base64 : undefined,
          filename: file.name,
        });
        if (res.success && res.text) {
          textContent = res.text;
          pages = res.pages;
        }
      } catch {}
    }

    // 3. PDF Text Extraction
    if (type === "pdf") {
      try {
        if (window.electron?.extractDocumentText) {
          const res = await window.electron.extractDocumentText({
            filePath: filePath || undefined,
            bufferBase64: !filePath ? base64 : undefined,
            filename: file.name,
          });
          if (res.success && res.text) {
            textContent = res.text;
            pages = res.pages;
          }
        } else if (window.electron?.extractPdfText) {
          if (filePath) {
            const res = await window.electron.extractPdfText({ filePath });
            if (res.success && res.text) {
              textContent = res.text;
              pages = res.pages;
            }
          } else if (base64) {
            const res = await window.electron.extractPdfText({ bufferBase64: base64 });
            if (res.success && res.text) {
              textContent = res.text;
              pages = res.pages;
            }
          }
        }
      } catch {}
    }

    let finalPath = filePath;
    let savedFilename = file.name;
    // Persist to conversation's .user_uploaded directory via electron
    if (window.electron?.saveAttachment && (base64 || textContent || filePath)) {
      try {
        const saved = await window.electron.saveAttachment({
          conversationId,
          name: file.name,
          sourcePath: filePath || undefined,
          base64: base64 || (textContent ? btoa(unescape(encodeURIComponent(textContent))) : undefined),
        });
        if (saved.success && saved.path) {
          finalPath = saved.path;
          if (saved.filename) {
            savedFilename = saved.filename;
          }
        }
      } catch (err) {
        console.warn("[chat-card] Failed to save attachment to disk:", err);
      }
    }

    const safeUrl = url || (finalPath ? `const-file://${finalPath.replace(/\\/g, "/")}` : base64);

    result.push({
      id: `file_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      name: savedFilename || file.name,
      size: file.size,
      type,
      url: safeUrl,
      base64,
      path: finalPath,
      textContent,
      pages,
    });
  }

  return result;
}

export interface ConversationMetrics {
  turns: number;
  steps?: number;
  modelRequests: number;
  toolCalls: number;
  hasUsage: boolean;
  incompleteUsage: boolean;
  workingDurationMs: number;
  llmDurationMs?: number;
  toolDurationMs?: number;
  waitingDurationMs?: number;
  ttftSeconds?: number;
  tokPerSec?: number;
  cacheHitRate?: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  uncachedInputTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
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

export { getModelContextLimit } from "../../lib/model-context";

export const INITIAL_DEFAULT_MODELS: ModelItem[] = ROUTER_DEFAULT_MODELS.map((model) => ({ ...model, name: model.displayName }));

let globalCachedModels: ModelItem[] | null = null;

interface ChatCardProps {
  conversationId?: string;
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
  showProjectHeader?: boolean;
  showContextUsage?: boolean;
  contextUsage?: ContextUsageData;
  metrics?: ConversationMetrics;
  project?: string;
  onProjectChange?: (project: string) => void;
  onModelChange?: (model: ModelItem) => void;
  onOpenSettings?: (tab?: string) => void;
  initialPrompt?: string;
  /** Model ID or name to restore when switching to an existing conversation. */
  initialModel?: string;
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
  isolatedModel?: boolean;
  queuedMessages?: QueuedMessageItem[];
  onQueueMessage?: (payload: { prompt: string; attachments?: AttachedFile[] }) => void;
  onRemoveQueuedMessage?: (id: string) => void;
  onEditQueuedMessage?: (id: string, newText: string) => void;
  onSteerMessage?: (item: QueuedMessageItem) => void;
  onSteerAllQueuedMessages?: () => void;
  onSteerDraft?: (payload: { prompt: string; attachments?: AttachedFile[] }) => void;
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
  conversationId,
  onSendMessage,
  isExecuting = false,
  onAbort,
  compact = false,
  showProjectHeader = false,
  showContextUsage,
  contextUsage,
  metrics,
  project: initialProject,
  onProjectChange,
  onModelChange,
  onOpenSettings,
  initialPrompt,
  initialModel,
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
  isolatedModel = false,
  queuedMessages,
  onQueueMessage,
  onRemoveQueuedMessage,
  onEditQueuedMessage,
  onSteerMessage,
  onSteerAllQueuedMessages,
  onSteerDraft,
}: ChatCardProps) {
  const remote = useRemoteRuntime();
  const [telemetryTarget, setTelemetryTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTelemetryTarget(remote?.mobile ? document.getElementById("remote-header-telemetry") : null); }, [remote?.mobile, conversationId]);
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
    const newAttached = await parseUploadedFiles(filesToProcess, conversationId);

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
    const newAttached = await parseUploadedFiles(filesToProcess, conversationId);
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
    const newAttached = await parseUploadedFiles(filesToProcess, conversationId);
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
  const { installed: installedPlugins } = usePluginInventory(currentProject === "Outside Project" ? undefined : currentProject);
  const resolvedSkills = useResolvedSkills(currentProject === "Outside Project" ? undefined : currentProject);
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
      plugins: installedPlugins,
      query: mentionToken.query,
      quoted: mentionToken.quoted,
      files: workspaceFiles,
      sessionMedia: allSessionMedia,
      conversations,
      currentProject,
      maxResults: 25,
    });
  }, [mentionToken, workspaceFiles, allSessionMedia, conversations, currentProject, installedPlugins]);

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

  // Skills from Dexie Database
  const availableSkills: LocalSkill[] = useMemo(() => {
    return resolvedSkills.filter((s) => s.isEnabled && !s.pluginId);
  }, [resolvedSkills]);

  // Slash token state for SkillSlashPopover
  const [slashToken, setSlashToken] = useState<ActiveSlashToken | null>(null);
  const [slashSkillIndex, setSlashSkillIndex] = useState(0);

  const filteredSkills = useMemo(() => {
    if (!slashToken) return [];
    const q = slashToken.query.toLowerCase().trim();
    const matches = availableSkills.filter((s) => {
      if (!q) return true;
      return (
        s.slug.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
      );
    });
    return matches;
  }, [slashToken, availableSkills]);

  const handleSelectSkill = (skill: LocalSkill) => {
    if (!skill) return;
    editorRef.current?.insertSkillMention(skill);
    setSlashToken(null);
    setSlashSkillIndex(0);
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

  const [models, setModels] = useState<ModelItem[]>(() => {
    if (globalCachedModels && globalCachedModels.length > 0) {
      return globalCachedModels;
    }
    return INITIAL_DEFAULT_MODELS;
  });

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

  // Persist canonical IDs; display names must never select a billing tier.
  const normalizeModelKey = (raw: string | null | undefined): string | null => {
    if (!raw || raw === "Const" || raw.includes("(Const Router)") || raw.includes("(Native)")) return null;
    return resolveModelId(raw, models);
  };

  /**
   * Helper to resolve the initial model for a conversation or workspace:
   * 1. initialModel prop (per-conversation override when switching chats)
   * 2. per-workspace model if in an active project (localStorage)
   * 3. last-used model globally (localStorage)
   */
  const getInitialResolvedModel = (fromPropVal?: string, projectVal?: string): string | null => {
    const fromProp = normalizeModelKey(fromPropVal);
    if (fromProp) return fromProp;

    if (projectVal && projectVal !== "Outside Project" && projectVal !== "[object Object]") {
      try {
        const wsSaved = localStorage.getItem(`const_harness_workspace_model_${projectVal}`);
        const normWs = normalizeModelKey(wsSaved);
        if (normWs) return normWs;
      } catch {}
    }

    try {
      const saved =
        localStorage.getItem("const_harness_active_model") ||
        localStorage.getItem("const_llm_active_model");
      const normalized = normalizeModelKey(saved);
      if (normalized) return normalized;
    } catch {}

    return null;
  };

  const [selectedModel, setSelectedModel] = useState<string | null>(() => {
    return getInitialResolvedModel(initialModel, initialProject);
  });

  useEffect(() => {
    if (isolatedModel) return;
    const onModelChanged = (event: Event) => {
      const modelId = (event as CustomEvent<{ modelId: string }>).detail?.modelId;
      if (modelId) setSelectedModel(modelId);
    };
    window.addEventListener("const:active-model-changed", onModelChanged);
    return () => window.removeEventListener("const:active-model-changed", onModelChanged);
  }, [isolatedModel]);

  // When switching conversations or projects, restore the appropriate model
  useEffect(() => {
    if (initialModel !== undefined && initialModel !== null && initialModel !== "") {
      const normalized = normalizeModelKey(initialModel);
      if (normalized) {
        setSelectedModel(normalized);
      }
    } else if (initialProject && initialProject !== "Outside Project" && initialProject !== "[object Object]") {
      // New chat in project: check project's saved model first
      try {
        const wsModel = localStorage.getItem(`const_harness_workspace_model_${initialProject}`);
        const normWs = normalizeModelKey(wsModel);
        if (normWs) {
          setSelectedModel(normWs);
          return;
        }
      } catch {}
      // Fallback to global last-used
      const saved =
        localStorage.getItem("const_harness_active_model") ||
        localStorage.getItem("const_llm_active_model");
      const normalized = normalizeModelKey(saved);
      if (normalized) {
        setSelectedModel(normalized);
      }
    } else {
      // New chat outside project -> inherit last used model
      const saved =
        localStorage.getItem("const_harness_active_model") ||
        localStorage.getItem("const_llm_active_model");
      const normalized = normalizeModelKey(saved);
      if (normalized) {
        setSelectedModel(normalized);
      }
    }
  }, [initialModel, initialProject]);

  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isModelClosing, setIsModelClosing] = useState(false);
  const closeModelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Active Model Object & Dynamic Thinking Level Support
  const currentModelItem = useMemo(() => {
    if (!selectedModel) return models[0] ?? null;
    const clean = selectedModel.toLowerCase().trim();
    const matched = models.find(
      (m) =>
        m.name === selectedModel ||
        m.id === selectedModel ||
        m.name.toLowerCase() === clean ||
        m.id.toLowerCase() === clean
    );
    if (matched) return matched;

    // CRITICAL: NEVER fall back to models[0] if selectedModel is set!
    // Synthesize an immediate ModelItem with the selectedModel name/id so it never flashes models[0]
    const displayName = normalizeModelKey(selectedModel) || selectedModel;
    return {
      id: selectedModel,
      name: displayName,
      provider: "const",
      providerName: "ConstRouter",
      supportsThinking: true,
      contextWindow: getModelContextLimit(selectedModel, contextUsage?.totalTokens),
    };
  }, [models, selectedModel, contextUsage?.totalTokens]);

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
  const [modelPopoverView, setModelPopoverView] = useState<"overview" | "select-model">("overview");

  const handleCloseModelPopover = useCallback(() => {
    if (isModelClosing || !isModelOpen) return;
    setIsModelClosing(true);
    if (closeModelTimeoutRef.current) clearTimeout(closeModelTimeoutRef.current);
    closeModelTimeoutRef.current = setTimeout(() => {
      setIsModelOpen(false);
      setIsModelClosing(false);
      setModelPopoverView("overview");
      closeModelTimeoutRef.current = null;
    }, 180);
  }, [isModelClosing, isModelOpen]);

  const handleOpenModelPopover = useCallback(() => {
    if (closeModelTimeoutRef.current) {
      clearTimeout(closeModelTimeoutRef.current);
      closeModelTimeoutRef.current = null;
    }
    setIsModelClosing(false);
    setIsModelOpen(true);
    setModelPopoverView("overview");
  }, []);

  const handleToggleModelPopover = useCallback(() => {
    if (isModelOpen && !isModelClosing) {
      handleCloseModelPopover();
    } else {
      handleOpenModelPopover();
    }
  }, [isModelOpen, isModelClosing, handleCloseModelPopover, handleOpenModelPopover]);

  const handleCloseModelPopoverRef = useRef(handleCloseModelPopover);
  useEffect(() => {
    handleCloseModelPopoverRef.current = handleCloseModelPopover;
  }, [handleCloseModelPopover]);

  const handleToggleModelPopoverRef = useRef(handleToggleModelPopover);
  useEffect(() => {
    handleToggleModelPopoverRef.current = handleToggleModelPopover;
  }, [handleToggleModelPopover]);

  useEffect(() => {
    return () => {
      if (closeModelTimeoutRef.current) {
        clearTimeout(closeModelTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectLevelByIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(supportedThinkingLevels.length - 1, index));
      const nextLvl = supportedThinkingLevels[clamped];
      if (nextLvl) {
        setThinkingLevel(nextLvl);
        localStorage.setItem("const_harness_thinking_level", nextLvl);
        localStorage.setItem("const_harness_user_thinking_override", "true");
      }
    },
    [supportedThinkingLevels]
  );

  const activeThinkingIndex = useMemo(() => {
    const idx = supportedThinkingLevels.indexOf(thinkingLevel);
    return idx >= 0 ? idx : Math.max(0, supportedThinkingLevels.indexOf("medium"));
  }, [supportedThinkingLevels, thinkingLevel]);

  const totalLevels = supportedThinkingLevels.length || 1;

  const getDotPositionStyle = useCallback(
    (i: number) => {
      if (totalLevels <= 1) return { left: "50%" };
      const pct = (i / (totalLevels - 1)) * 100;
      const offset = 11 - 22 * (i / (totalLevels - 1));
      return { left: `calc(${pct}% + ${offset}px)` };
    },
    [totalLevels]
  );

  const fillWidthStyle = useMemo(() => {
    if (totalLevels <= 1) return "100%";
    const dotPos = getDotPositionStyle(activeThinkingIndex).left;
    return `calc(${dotPos} + 10px)`;
  }, [totalLevels, getDotPositionStyle, activeThinkingIndex]);

  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isThinkingSupported || supportedThinkingLevels.length === 0) return;
    const track = e.currentTarget;
    try {
      track.setPointerCapture(e.pointerId);
    } catch {}

    const update = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const x = clientX - rect.left;
      const pad = 11;
      const usable = rect.width - pad * 2;
      const ratio = Math.max(0, Math.min(1, (x - pad) / usable));
      const index = Math.round(ratio * (totalLevels - 1));
      handleSelectLevelByIndex(index);
    };

    update(e.clientX);

    const onPointerMove = (moveEvent: PointerEvent) => {
      update(moveEvent.clientX);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      try {
        track.releasePointerCapture(upEvent.pointerId);
      } catch {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const thinkingLabel = useMemo(() => {
    if (!isThinkingSupported) return "Off";
    if (thinkingLevel === "xhigh") return "XHigh";
    return thinkingLevel.charAt(0).toUpperCase() + thinkingLevel.slice(1);
  }, [isThinkingSupported, thinkingLevel]);

  useEffect(() => {
    if (isThinkingSupported && supportedThinkingLevels.length > 0) {
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

  // Global Keyboard Shortcuts: Open Model Menu (Ctrl+M) & Cycle Thought Level (Ctrl+T)
  useEffect(() => {
    const handleOpenModelMenu = () => {
      handleToggleModelPopoverRef.current();
    };

    const handleCycleThoughtLevel = () => {
      if (!isThinkingSupported || supportedThinkingLevels.length === 0) return;
      setThinkingLevel((prev) => {
        const curIdx = supportedThinkingLevels.indexOf(prev);
        const nextIdx = (curIdx + 1) % supportedThinkingLevels.length;
        const next = supportedThinkingLevels[nextIdx] ?? prev;
        localStorage.setItem("const_harness_thinking_level", next);
        localStorage.setItem("const_harness_user_thinking_override", "true");
        toast.info(`Thinking depth: ${next}`);
        return next;
      });
    };

    window.addEventListener("const:open-model-menu", handleOpenModelMenu);
    window.addEventListener("const:cycle-thought-level", handleCycleThoughtLevel);
    return () => {
      window.removeEventListener("const:open-model-menu", handleOpenModelMenu);
      window.removeEventListener("const:cycle-thought-level", handleCycleThoughtLevel);
    };
  }, [isThinkingSupported, supportedThinkingLevels]);

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
              let name = modelDisplayName(m.id, m.displayName || m.name);
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
                  getModelContextLimit(m.id, m.contextWindow ?? m.context_window),
              };
            });

            const deduped: ModelItem[] = uniqueModelsById(mapped);
            globalCachedModels = deduped;
            setModels(deduped);

            // An in-flight catalog refresh must preserve a newer user selection.
            setSelectedModel((prev) => {
              const requested = prev || getInitialResolvedModel(initialModel, initialProject);
              const modelId = requested ? resolveModelId(requested, deduped) : deduped[0]?.id || null;
              if (modelId && !isolatedModel) localStorage.setItem("const_harness_active_model", modelId);
              return modelId;
            });
          }
        })
        .catch(() => {});
    }

    // Only query electron config on first launch if there is no initialModel AND no saved model in localStorage
    if (
      !initialModel &&
      !localStorage.getItem("const_harness_active_model") &&
      !localStorage.getItem("const_llm_active_model") &&
      window.electron?.getConfig
    ) {
      window.electron.getConfig().then((cfg) => {
        if (cfg?.activeModel) {
          const modelName = resolveModelId(cfg.activeModel, models);
          setSelectedModel((prev) => prev || modelName);
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
        handleCloseModelPopoverRef.current();
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(target)) {
        setIsPlusOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProjectOpen(false);
        setIsModeOpen(false);
        handleCloseModelPopoverRef.current();
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
    if (!text && attachments.length === 0) return;
    if (isExecuting && !onQueueMessage && !onSteerDraft) return;

    if (!text && attachments.length > 0) {
      text = "Please analyze the attached media/file(s).";
    }

    const currentAttachments = [...attachments];
    setPrompt("");
    editorRef.current?.clear();
    setAttachments([]);

    // Augment prompt if skills are referenced (/slug or inline mention badges)
    const { augmentedPrompt } = extractSkillsAndAugmentPrompt(text, availableSkills);
    const finalPrompt = augmentedPrompt;

    if (isExecuting) {
      const savedQueueMode = localStorage.getItem("const_harness_queue_mode") || "queue";
      if (savedQueueMode === "steer" && onSteerDraft) {
        onSteerDraft({
          prompt: finalPrompt,
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        });
        toast.info("Steering active agent directly with message");
        return;
      }
      if (onQueueMessage) {
        onQueueMessage({
          prompt: finalPrompt,
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        });
      }
      return;
    }

    const matchedModel = models.find((m) => m.name === selectedModel || m.id === selectedModel);
    onSendMessage?.({
      prompt: finalPrompt,
      project: currentProject,
      mode,
      model: matchedModel?.id || currentModelItem?.id || models[0]?.id || "",
      thinkingLevel: isThinkingSupported ? thinkingLevel : undefined,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      maxOutputTokens: matchedModel?.maxOutputTokens || currentModelItem?.maxOutputTokens,
    });
  };

  const handleSteerCurrentDraft = () => {
    if (!onSteerDraft) return;
    let text = (editorRef.current?.getText() || prompt).trim();
    if (!text && attachments.length === 0) return;

    if (!text && attachments.length > 0) {
      text = "Please analyze the attached media/file(s).";
    }

    const currentAttachments = [...attachments];
    setPrompt("");
    editorRef.current?.clear();
    setAttachments([]);

    const { augmentedPrompt } = extractSkillsAndAugmentPrompt(text, availableSkills);

    if (onSteerDraft) {
      onSteerDraft({
        prompt: augmentedPrompt,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      });
    }
  };

  const displayProjectName =
    !currentProject || typeof currentProject !== "string" || currentProject === "Outside Project" || currentProject === "[object Object]"
      ? "Outside Project"
      : currentProject.replace(/\\/g, "/").split("/").filter(Boolean).pop() || currentProject;

  const availableWorkspaces = Array.from(new Set([
    ...workspaces,
    ...(conversations || []).map(conversation => conversation.project),
    currentProject,
  ].filter((project): project is string => !!project && project !== "Outside Project" && project !== "[object Object]")));
  const filteredWorkspaces = availableWorkspaces.filter((ws) =>
    ws.toLowerCase().includes(searchWorkspace.toLowerCase())
  );

  // Real-time calculation of tokens for draft prompt and pending attachments
  const draftInputTokens = useMemo(() =>
    prompt.trim() || attachments.length
      ? estimateMessage({ role: "user", content: prompt, attachments }) : 0,
    [prompt, attachments]);

  const modelContextLimit = useMemo(() => {
    const modelId = currentModelItem?.id || selectedModel || "";
    const explicitLimit = currentModelItem?.contextWindow;
    return getModelContextLimit(modelId, contextUsage?.totalTokens ?? explicitLimit);
  }, [currentModelItem, selectedModel, contextUsage?.totalTokens]);

  const totalTokens = modelContextLimit > 0 ? modelContextLimit : 1_000_000;
  const systemPromptTokens = contextUsage?.systemPromptTokens ?? 0;
  const toolsTokens = contextUsage?.toolsTokens ?? 0;
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
    setIsModelClosing(false);
    setIsContextOpen(false);
    setIsPlusOpen(false);
    setMentionToken(null);
    setSlashToken(null);
    setModelPopoverView("overview");
  };

  const isAnyBottomMenuOpen =
    isPlusOpen ||
    isModeOpen ||
    isContextOpen ||
    isModelOpen ||
    isModelClosing ||
    Boolean(mentionToken) ||
    Boolean(slashToken);

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
        {/* Top Header Strip: Choose Project (Visible in landing view or when showProjectHeader is true) */}
        {(!compact || showProjectHeader) && (
          <div data-workspace-selector className={cn("w-full px-3.5 pt-2 pb-1.5 flex items-center relative min-w-0 rounded-t-2xl", isProjectOpen ? "z-30" : "z-10")}>
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
                  {availableWorkspaces.length > 0 && (
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
                                  if (!initialModel && ws && ws !== "Outside Project" && ws !== "[object Object]") {
                                    try {
                                      const wsModel = localStorage.getItem(`const_harness_workspace_model_${ws}`);
                                      const normWs = normalizeModelKey(wsModel);
                                      if (normWs) {
                                        setSelectedModel(normWs);
                                      }
                                    } catch {}
                                  }
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

        {/* Queued Messages Dock attached directly above AI input card, matching Screenshot */}
        {isExecuting && queuedMessages && queuedMessages.length > 0 && (
          <QueueDock
            items={queuedMessages}
            onSteerItem={onSteerMessage || (() => {})}
            onRemoveItem={onRemoveQueuedMessage || (() => {})}
            onEditItem={onEditQueuedMessage}
            className={compact ? "max-w-full rounded-t-2xl" : "rounded-t-2xl -mx-[1px] w-[calc(100%+2px)] max-w-[calc(100%+2px)]"}
          />
        )}

        {/* AI Input Box: Background is #ffffff (light) / #2b2b2b (dark) with #262626 / #d4d4d4 text */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "w-full bg-[#ffffff] dark:bg-[#2b2b2b] flex flex-col justify-between transition-colors min-w-0 relative",
            compact
              ? isExecuting && queuedMessages && queuedMessages.length > 0
                ? "max-w-full rounded-b-2xl rounded-t-none border-t border-[#e2e2e4] dark:border-[#383838]"
                : "max-w-full rounded-2xl"
              : isExecuting && queuedMessages && queuedMessages.length > 0
                ? "rounded-b-2xl rounded-t-none border border-[#e2e2e4] dark:border-[#383838] border-t-0 -mx-[1px] -mb-[1px] w-[calc(100%+2px)] max-w-[calc(100%+2px)]"
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

            {/* Skill Slash Popover (/) */}
            {slashToken && (
              <SkillSlashPopover
                skills={filteredSkills}
                selectedIndex={slashSkillIndex}
                query={slashToken.query}
                onSelect={handleSelectSkill}
                onHover={(idx) => setSlashSkillIndex(idx)}
                onOpenSettings={() => onOpenSettings?.("skills")}
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
              onSlashTokenChange={(tok) => {
                setSlashToken(tok);
                setSlashSkillIndex(0);
              }}
              onOpenFilePreview={onOpenFilePreview}
              onOpenTrajectory={onOpenTrajectory}
              onSend={handleSend}
              onPasteFiles={handlePasteFiles}
              placeholder={
                isExecuting && queuedMessages && queuedMessages.length > 0 && !prompt.trim()
                  ? t("workbench.steerQueuePlaceholder")
                  : t("workbench.askPlaceholder")
              }
              disabled={false}
              onKeyDown={(e) => {
                // Skills Slash Popover Keyboard Navigation
                if (slashToken && filteredSkills.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSlashSkillIndex((prev) => (prev + 1) % filteredSkills.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSlashSkillIndex((prev) => (prev - 1 + filteredSkills.length) % filteredSkills.length);
                    return;
                  }
                  if (e.key === "Tab" || e.key === "Enter") {
                    e.preventDefault();
                    const skill = filteredSkills[slashSkillIndex];
                    if (skill) {
                      handleSelectSkill(skill);
                    }
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setSlashToken(null);
                    return;
                  }
                }

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

                // Keyboard Steering: Cmd/Ctrl + Enter
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  const text = (editorRef.current?.getText() || prompt).trim();
                  if (!text && (!attachments || attachments.length === 0)) {
                    // Empty draft: Steer all queued messages into active turn!
                    if (isExecuting && queuedMessages && queuedMessages.length > 0) {
                      e.preventDefault();
                      onSteerAllQueuedMessages?.();
                      return;
                    }
                  } else {
                    // Draft has content: Steer this draft directly into active turn!
                    if (isExecuting) {
                      e.preventDefault();
                      handleSteerCurrentDraft();
                      return;
                    }
                  }
                }

                // Plain Enter while AI is generating: Queue message into QueueDock!
                if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                  if (isExecuting) {
                    e.preventDefault();
                    handleSend();
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

                    {/* 2.5 Skills (/) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusOpen(false);
                        editorRef.current?.insertSlash();
                      }}
                      className="w-full px-2.5 py-2 flex items-center gap-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white text-xs transition-colors cursor-pointer group"
                    >
                      <PencilSparkles className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-[13px]">Skills (/)</span>
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
              {/* Model Selector Dropdown */}
              <div className="relative min-w-0 shrink" ref={modelMenuRef}>
                <button
                  type="button"
                  onClick={handleToggleModelPopover}
                  className={cn(
                    "inline-flex items-center transition-colors cursor-pointer text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 text-[13px] font-normal",
                    (isModelOpen || isModelClosing) && "bg-black/5 dark:bg-white/10 text-black dark:text-white",
                    isNarrow
                      ? "w-7 h-7 justify-center rounded-md"
                      : "gap-1 px-1.5 py-1 rounded-md min-w-0 max-w-[120px] sm:max-w-[180px] md:max-w-[240px]"
                  )}
                  title={`Model: ${currentModelItem?.name || selectedModel || "Select Model"}`}
                >
                  {isNarrow ? (
                    <Box className="w-4 h-4 text-[#a9a9a9] dark:text-[#d4d4d4] stroke-[1.75] shrink-0" />
                  ) : (
                    <>
                      <span className="truncate min-w-0">{currentModelItem?.name || selectedModel || "Select Model"}</span>
                      <ChevronDown className="w-3 h-3 text-[#a9a9a9] dark:text-[#5d5d5d] ml-0.5 shrink-0" />
                    </>
                  )}
                </button>

                {/* Unified Model & Thinking Level Popover */}
                {(isModelOpen || isModelClosing) && (
                  <div
                    className={cn(
                      "absolute bottom-full mb-2 right-0 w-[260px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#1c1c1e] border border-[#e2e2e4] dark:border-[#2c2c2e] rounded-2xl shadow-2xl z-[60] flex flex-col text-left select-none",
                      isModelClosing
                        ? "animate-popover-slide-out"
                        : "animate-popover-slide-in",
                      modelPopoverView === "overview" ? "p-3.5" : "p-2"
                    )}
                  >
                    {modelPopoverView === "overview" ? (
                      /* Image 1: Overview with Thinking Level Title, Model Selector Trigger, Gear Icon, and Thinking Slider */
                      <div
                        key="overview"
                        className="relative flex flex-col animate-in fade-in-0 duration-150 ease-out"
                      >
                        {/* Manage Models Gear Button (top-right corner with hover) */}
                        <button
                          type="button"
                          onClick={() => {
                            handleCloseModelPopover();
                            onOpenSettings?.("model-settings");
                          }}
                          title={t("workbench.manageModels")}
                          aria-label={t("workbench.manageModels")}
                          className="absolute -top-0.5 -right-0.5 w-6 h-6 flex items-center justify-center rounded-md text-[#71717a] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer z-10"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>

                        {/* Centered Header: Thinking Level Title + Model Selector Trigger */}
                        <div className="flex flex-col items-center justify-center px-6 mb-3.5 text-center">
                          <span className="text-[13px] font-semibold text-[#3b82f6] leading-none select-none tracking-tight">
                            {thinkingLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => setModelPopoverView("select-model")}
                            className="mt-1 inline-flex items-center justify-center gap-0.5 text-[12px] text-[#8e8e93] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white transition-colors cursor-pointer group max-w-[190px] leading-tight font-normal"
                            title={currentModelItem?.name || selectedModel || "Select Model"}
                          >
                            <span className="truncate">
                              {currentModelItem?.name || selectedModel || "Select Model"}
                            </span>
                            <ChevronRight className="w-3 h-3 text-[#71717a] group-hover:text-black dark:group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        </div>

                        {/* Bottom Row: Thinking Level Slider Track */}
                        <div
                          className={cn(
                            "relative w-full h-[26px] bg-[#242426] dark:bg-[#2a2a2e] rounded-full cursor-pointer select-none overflow-hidden touch-none",
                            (!isThinkingSupported || supportedThinkingLevels.length === 0) &&
                              "opacity-40 cursor-not-allowed pointer-events-none"
                          )}
                          onPointerDown={handleSliderPointerDown}
                          role="slider"
                          aria-valuemin={0}
                          aria-valuemax={totalLevels - 1}
                          aria-valuenow={activeThinkingIndex}
                          aria-valuetext={thinkingLabel}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                              e.preventDefault();
                              handleSelectLevelByIndex(activeThinkingIndex - 1);
                            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                              e.preventDefault();
                              handleSelectLevelByIndex(activeThinkingIndex + 1);
                            }
                          }}
                        >
                          {/* Active Blue Fill */}
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-[#3b82f6] rounded-full transition-all duration-100 pointer-events-none"
                            style={{ width: fillWidthStyle }}
                          />
                          {/* Step Dots */}
                          {supportedThinkingLevels.map((lvl, i) => (
                            <div
                              key={lvl}
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3.5px] h-[3.5px] rounded-full bg-white/45 pointer-events-none z-[2]"
                              style={getDotPositionStyle(i)}
                            />
                          ))}
                          {/* White Thumb Knob */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.4)] pointer-events-none z-[3] transition-all duration-100"
                            style={getDotPositionStyle(activeThinkingIndex)}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Image 2: Model Search and List */
                      <div
                        key="select-model"
                        className="flex flex-col text-left animate-in fade-in-0 duration-150 ease-out"
                      >
                        {models.length > 0 ? (
                          <>
                            {/* Header: Back Button + Search Input */}
                            <div className="flex-none flex items-center gap-1.5 px-2.5 py-1.5 mb-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus-within:border-[#3b82f6]/40 transition-colors">
                              <button
                                type="button"
                                onClick={() => setModelPopoverView("overview")}
                                className="p-1 -ml-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md text-[#71717a] hover:text-black dark:hover:text-white transition-colors cursor-pointer shrink-0"
                                title={t("common.back") || "Back"}
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <Search className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                              <input
                                type="text"
                                value={searchModelQuery}
                                onChange={(e) => setSearchModelQuery(e.target.value)}
                                placeholder={t("workbench.searchModels")}
                                className="w-full bg-transparent text-[12px] text-[#262626] dark:text-[#d4d4d4] placeholder:text-[#71717a] outline-none font-sans"
                                autoFocus
                              />
                              {searchModelQuery && (
                                <button
                                  type="button"
                                  onClick={() => setSearchModelQuery("")}
                                  className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded text-[#71717a] hover:text-black dark:hover:text-white transition-colors cursor-pointer shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Models categorized with ScrollArea */}
                            {filteredGroupedModels.length > 0 ? (
                              <ScrollArea className="max-h-[240px] w-full flex-1 min-h-0">
                                <div className="space-y-1.5 py-0.5">
                                  {filteredGroupedModels.map((group) => (
                                    <div key={group.providerId} className="flex flex-col">
                                      {/* Category Header */}
                                      <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold text-[#71717a] uppercase tracking-wider select-none">
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
                                                setSelectedModel(m.id);
                                                if (!isolatedModel) {
                                                  localStorage.setItem("const_harness_active_model", m.id);
                                                  localStorage.setItem("const_llm_active_model", m.id);
                                                  window.electron?.saveConfig?.({ activeModel: m.id });
                                                }
                                                if (
                                                  !isolatedModel &&
                                                  currentProject &&
                                                  currentProject !== "Outside Project" &&
                                                  currentProject !== "[object Object]"
                                                ) {
                                                  try {
                                                    localStorage.setItem(
                                                      `const_harness_workspace_model_${currentProject}`,
                                                      m.id || m.name
                                                    );
                                                  } catch {}
                                                }
                                                // Retain user's current thinking level if supported by the newly selected model
                                                const targetLevels =
                                                  m.thinkingLevels && m.thinkingLevels.length > 0
                                                    ? m.thinkingLevels
                                                    : ["low", "medium", "high", "xhigh", "max"];

                                                if (m.supportsThinking !== false && m.id !== "combo/fast") {
                                                  if (!targetLevels.includes(thinkingLevel)) {
                                                    const fallback =
                                                      m.defaultThinkingLevel &&
                                                      targetLevels.includes(m.defaultThinkingLevel)
                                                        ? m.defaultThinkingLevel
                                                        : targetLevels.includes("medium")
                                                        ? "medium"
                                                        : targetLevels[targetLevels.length - 1]!;
                                                    setThinkingLevel(fallback);
                                                    localStorage.setItem("const_harness_thinking_level", fallback);
                                                  }
                                                }
                                                handleCloseModelPopover();
                                              }}
                                              className={cn(
                                                "w-full px-2.5 py-1.5 flex items-center justify-between text-[12.5px] rounded-lg transition-colors cursor-pointer text-left",
                                                isSelected
                                                  ? "bg-black/10 dark:bg-white/10 text-black dark:text-white font-medium"
                                                  : "text-[#3f3f46] dark:text-[#a1a1aa] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                                              )}
                                            >
                                              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                                <span className="truncate font-normal">{m.name}</span>
                                              </div>
                                              {isSelected && (
                                                <Check className="w-3.5 h-3.5 text-black dark:text-white shrink-0 ml-auto" />
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
                              <div className="py-6 px-3 text-center text-xs text-[#71717a]">
                                {t("workbench.noModelsFound")}
                              </div>
                            )}

                            {/* Bottom Footer: Manage models */}
                            <div className="flex-none pt-1.5 mt-1 border-t border-[#e2e2e4]/60 dark:border-[#2c2c2e]">
                              <button
                                type="button"
                                onClick={() => {
                                  handleCloseModelPopover();
                                  onOpenSettings?.("model-settings");
                                }}
                                className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] text-[#71717a] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left"
                              >
                                <Settings className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                                <span>{t("workbench.manageModels")}</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="p-3.5 flex flex-col items-center text-center">
                            <div className="w-9 h-9 rounded-xl bg-[#f4f4f6] dark:bg-[#2a2a2a] border border-[#e2e2e4] dark:border-[#383838] flex items-center justify-center text-[#262626] dark:text-[#d4d4d4] mb-2.5 shadow-sm">
                              <Cpu className="w-4 h-4 text-[#262626] dark:text-[#d4d4d4] stroke-[1.75]" />
                            </div>
                            <div className="text-[13px] font-medium text-[#262626] dark:text-[#d4d4d4]">
                              {t("workbench.noModelsConfigured")}
                            </div>
                            <p className="text-[11px] text-[#71717a] leading-relaxed mt-1 mb-3.5">
                              {t("workbench.connectModelsDesc")}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                handleCloseModelPopover();
                                onOpenSettings?.("model-settings");
                              }}
                              className="w-full py-1.5 px-3 rounded-lg bg-[#dedee2] hover:bg-[#d5d5d9] dark:bg-[#333333] dark:hover:bg-[#3d3d3d] border border-[#d5d5d9] dark:border-[#444444]/60 text-[12px] font-medium text-[#262626] dark:text-[#d4d4d4] hover:text-black dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#262626] dark:text-[#d4d4d4]" />
                              <span>{t("workbench.manageModels")}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Send or Stop Generation Button */}
              {isExecuting ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Stop Generation Button (Circular Blue Button matching Screenshot) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAbort?.();
                    }}
                    className="w-7 h-7 rounded-full bg-[#3b82f6] hover:bg-[#2563eb] text-white flex items-center justify-center cursor-pointer select-none transition-all shrink-0 shadow-sm active:scale-95"
                    title={t("workbench.stopExecution")}
                    aria-label={t("workbench.stopExecution")}
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                  </button>

                  {/* Send/Queue Button when user has typed text or attached files during execution */}
                  {(onQueueMessage || onSteerDraft) && (prompt.trim() || attachments.length > 0) && (
                    <button
                      type="button"
                      onClick={handleSend}
                      className="w-7 h-7 rounded-lg flex items-center justify-center select-none transition-all shrink-0 bg-[#262626] dark:bg-[#d4d4d4] text-white dark:text-[#161616] hover:bg-black dark:hover:bg-white cursor-pointer shadow-sm active:scale-95"
                      title={t("workbench.steerMessage")}
                      aria-label={t("workbench.steerMessage")}
                    >
                      <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  )}
                </div>
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
        const cachedInputTokens = metrics ? (metrics.cachedInputTokens ?? Math.round(metrics.inputTokens * ((metrics.cacheHitRate ?? 0) / 100))) : 0;
        const uncachedInputTokens = metrics ? (metrics.uncachedInputTokens ?? Math.max(0, metrics.inputTokens - cachedInputTokens)) : 0;

        const telemetry = (
          <div data-remote-telemetry className="w-full flex items-center justify-between gap-2 sm:gap-4 pt-2 pb-0.5 px-1 select-none flex-wrap">
            {/* Left: Session statistics & Context Windows */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              {metrics && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                      title={t("workbench.sessionStatistics")}
                      aria-label={t("workbench.sessionStatistics")}
                    >
                      <Gauge className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span data-telemetry-label>
                        {t(metrics.turns === 1 ? "workbench.telemetryTurn" : "workbench.telemetryTurns").replace("{count}", String(metrics.turns))} &middot; {t(metrics.steps === 1 ? "workbench.telemetryStep" : "workbench.telemetrySteps").replace("{count}", String(metrics.steps ?? "—"))} &middot; {metrics.tokPerSec === undefined ? "—" : metrics.tokPerSec.toFixed(1)} tok/s
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
                      <span className="font-medium text-[13px] text-foreground">{t("workbench.sessionStatistics")}</span>
                    </div>
                    <div className="space-y-2 text-[12.5px] font-sans">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryModelRequests")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.modelRequests || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryToolCalls")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.toolCalls}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryWorkingTime")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{formatDurationDisplay(metrics.workingDurationMs)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.llmTime")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.llmDurationMs === undefined ? "—" : formatDurationDisplay(metrics.llmDurationMs)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.toolTime")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.toolDurationMs === undefined ? "—" : formatDurationDisplay(metrics.toolDurationMs)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryWaitingTime")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.waitingDurationMs === undefined ? "—" : formatDurationDisplay(metrics.waitingDurationMs)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryTtft")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.ttftSeconds === undefined ? "—" : `${metrics.ttftSeconds.toFixed(2)}s`}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryTps")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.tokPerSec === undefined ? "—" : `${metrics.tokPerSec.toFixed(1)} tok/s`}</span>
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
                      title={`${t("workbench.telemetryContextTitle")}: ~${formatTokenDisplay(usedTokens)} / ${formatTokenDisplay(totalTokens)}`}
                      aria-label={t("workbench.telemetryContextTitle")}
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
                            56.55 - (56.55 * (rawPercentUsed > 0 ? safePercent : 0)) / 100
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
                        {t("workbench.telemetryContextUsed").replace("{percent}", rawPercentUsed === 0 ? "0%" : rawPercentUsed < 0.1 ? "<0.1%" : `${percentUsed}%`)}
                      </span>
                      <span className="font-sans tabular-nums text-[12px] text-muted-foreground">
                        ~{formatTokenDisplay(usedTokens)} / {formatTokenDisplay(totalTokens)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground">{t("workbench.telemetryContextEstimate")}</p>
                    {/* Multi-segment Horizontal Progress Bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex gap-0.5">
                      {systemPromptTokens > 0 && (
                        <div
                          className="bg-[#71717a] h-full transition-all"
                          style={{
                            width: `${Math.min(100, (systemPromptTokens / totalTokens) * 100)}%`,
                          }}
                          title={`${t("workbench.telemetrySystemPrompt")}: ~${formatTokenDisplay(systemPromptTokens)}`}
                        />
                      )}
                      {toolsTokens > 0 && (
                        <div
                          className="bg-[#a855f7] h-full transition-all"
                          style={{
                            width: `${Math.min(100, (toolsTokens / totalTokens) * 100)}%`,
                          }}
                          title={`${t("workbench.telemetryTools")}: ~${formatTokenDisplay(toolsTokens)}`}
                        />
                      )}
                      {effectiveMessagesTokens > 0 && (
                        <div
                          className="bg-[#3b82f6] h-full transition-all"
                          style={{
                            width: `${Math.min(100, (effectiveMessagesTokens / totalTokens) * 100)}%`,
                          }}
                          title={`${t("workbench.telemetryMessages")}: ~${formatTokenDisplay(effectiveMessagesTokens)}`}
                        />
                      )}
                      {draftInputTokens > 0 && (
                        <div
                          className="bg-[#10b981] h-full transition-all"
                          style={{
                            width: `${Math.min(100, (draftInputTokens / totalTokens) * 100)}%`,
                          }}
                          title={`${t("workbench.telemetryCurrentInput")}: ~${formatTokenDisplay(draftInputTokens)}`}
                        />
                      )}
                    </div>

                    {/* Legend / Breakdown List */}
                    <div className="flex flex-col gap-2 pt-1 text-[12px]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-xs bg-[#71717a] shrink-0" />
                          <span className="text-foreground">{t("workbench.telemetrySystemPrompt")}</span>
                        </div>
                        <span className="font-sans tabular-nums text-foreground">
                          {contextUsage?.systemPromptTokens === undefined ? "—" : `~${formatTokenDisplay(systemPromptTokens)}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-xs bg-[#a855f7] shrink-0" />
                          <span className="text-foreground">{t("workbench.telemetryTools")}</span>
                        </div>
                        <span className="font-sans tabular-nums text-foreground">
                          {contextUsage?.toolsTokens === undefined ? "—" : `~${formatTokenDisplay(toolsTokens)}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-xs bg-[#3b82f6] shrink-0" />
                          <span className="text-foreground">{t("workbench.telemetryMessages")}</span>
                        </div>
                        <span className="font-sans tabular-nums text-foreground">
                          ~{formatTokenDisplay(effectiveMessagesTokens)}
                        </span>
                      </div>

                      {draftInputTokens > 0 && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-xs bg-[#10b981] shrink-0" />
                            <span className="text-[#10b981] font-medium">{t("workbench.telemetryCurrentInput")}</span>
                          </div>
                          <span className="font-sans tabular-nums text-[#10b981]">
                            ~{formatTokenDisplay(draftInputTokens)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-border/80">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-xs bg-muted-foreground/30 shrink-0" />
                          <span className="text-muted-foreground">{t("workbench.telemetryAvailable")}</span>
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
                      title={t("workbench.telemetryUsage")}
                      aria-label={t("workbench.telemetryUsage")}
                    >
                      <Database className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span data-telemetry-label>
                        {metrics.hasUsage ? formatTokenDisplay(convTokens) : "—"} tok &middot; {t("workbench.telemetryCacheHit")} {metrics.cacheHitRate === undefined ? "—" : `${metrics.cacheHitRate.toFixed(1)}%`}
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
                        <span className="font-medium text-[13px] text-foreground">{t("workbench.telemetryUsage")}</span>
                      </div>
                      <span className="tabular-nums font-medium text-foreground text-[13px]">
                        {metrics.hasUsage ? convTokens.toLocaleString() : "—"} tok
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">{t("workbench.telemetryUsageScope")}</p>
                    <div className="space-y-2 text-[12.5px] font-sans">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryCacheHit")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.cacheHitRate === undefined ? "—" : `${metrics.cacheHitRate.toFixed(1)}%`}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryUncached")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.hasUsage ? uncachedInputTokens.toLocaleString() : "—"} tok</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryCached")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.hasUsage ? cachedInputTokens.toLocaleString() : "—"} tok</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryOutput")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.hasUsage ? metrics.outputTokens.toLocaleString() : "—"} tok</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("workbench.telemetryCacheWrite")}</span>
                        <span className="tabular-nums text-foreground shrink-0">{metrics.hasUsage ? (metrics.cacheWriteTokens ?? 0).toLocaleString() : "—"} tok</span>
                      </div>
                      {(!metrics.hasUsage || metrics.incompleteUsage) && <p className="text-muted-foreground">{t(metrics.hasUsage ? "workbench.telemetryPartialUsage" : "workbench.telemetryUnavailable")}</p>}
                      {metrics.reasoningTokens && metrics.reasoningTokens > 0 ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{t("workbench.telemetryReasoning")}</span>
                          <span className="tabular-nums text-foreground shrink-0">{metrics.reasoningTokens.toLocaleString()} tok</span>
                        </div>
                      ) : null}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        );
        return remote?.mobile && telemetryTarget ? createPortal(telemetry, telemetryTarget) : telemetry;
      })()}

      {/* Media Lightbox Preview Modal */}
      {previewItem && (
        <ImageLightbox
          src={previewItem.path ? `const-file://${previewItem.path.replace(/\\/g, "/")}` : (previewItem.url || previewItem.base64 || "")}
          fallbackBase64={previewItem.base64}
          filePath={previewItem.path}
          alt={previewItem.name}
          type={previewItem.type}
          fileSize={previewItem.size}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
