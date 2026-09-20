import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, localDb } from "../../lib/db";
import {
  ArrowLeft,
  Check,
  Sun,
  Moon,
  Laptop,
  LogOut,
  ArrowLeftRight,
  User as UserIcon,
  Settings,
  Globe,
  Hand,
  ShieldAlert,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  useTheme,
  cn,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  toast,
} from "@const/ui";
import { useI18n, LANGUAGE_OPTIONS } from "../../lib/i18n";
import { SourcesPanel } from "./sources-panel";
import { ChatPanel } from "./chat-panel";
import { RightPane, type RightPaneTab, type RightPaneTabType, type GeneratingArtifactStatus } from "../right-pane";
import { AddSourceDialog } from "./add-source-dialog";
import { CreateStudioArtifactDialog } from "./create-studio-artifact-dialog";
import { CreateMindMapDialog } from "./create-mind-map-dialog";
import { CreateAudioSummaryDialog } from "./create-audio-summary-dialog";
import { CreateVideoSummaryDialog } from "./create-video-summary-dialog";
import { CreatePresentationDialog } from "./create-presentation-dialog";
import { WorkspaceTitle } from "./workspace-title";
import { SettingsView } from "../settings/settings-view";
import { ErrorBoundary } from "../ui/error-boundary";
import { STUDIO_TOOLS } from "./studio-panel";
import { buildGroundedContext } from "../../lib/grounding/context-builder";
import { streamChatCompletion } from "../../lib/ai-stream";
import {
  generateStudioArtifact,
  generateVideoSummaryArtifact,
  generatePresentationArtifact,
} from "../../lib/studio/generator";
import type { FileMutationRecord } from "@const/agent";
import type { LocalArtifact } from "../../lib/db";

interface LearnWorkspaceProps {
  learnId: string;
  initialSourceModalOpen?: boolean;
  onBack: () => void;
  onCreateNew?: () => void;
  user?: any;
  onSignOut?: () => void;
  onSwitchAccount?: () => void;
}

export function LearnWorkspace({
  learnId,
  initialSourceModalOpen = false,
  onBack,
  onCreateNew,
  user,
  onSignOut,
  onSwitchAccount,
}: LearnWorkspaceProps) {
  const [theme, setTheme] = useTheme();
  const { t, language, setLanguage } = useI18n();

  // Live notebook data from Dexie
  const learn = useLiveQuery(async () => {
    return await db.learns.get(learnId);
  }, [learnId]);

  // Live sources from Dexie
  const sources = useLiveQuery(async () => {
    return await db.sources.where("learnId").equals(learnId).toArray();
  }, [learnId]);

  // Live artifacts from Dexie sorted by recent activity
  const artifacts = useLiveQuery(async () => {
    const list = await db.artifacts.where("learnId").equals(learnId).toArray();
    return list.sort((a, b) => {
      const timeA = Math.max(a.updatedAt || 0, a.createdAt || 0);
      const timeB = Math.max(b.updatedAt || 0, b.createdAt || 0);
      return timeB - timeA;
    });
  }, [learnId]);

  // Auto-clean any stale stuck "generating" artifacts (e.g. from previous app crashes or interrupted renders)
  useEffect(() => {
    if (!learnId) return;
    const cleanupStale = async () => {
      try {
        const stuck = await db.artifacts
          .where("learnId")
          .equals(learnId)
          .filter((a) => a.status === "generating" && (!a.createdAt || Date.now() - a.createdAt > 15 * 1000))
          .toArray();
        for (const item of stuck) {
          console.log("[learn-workspace] Auto-cleaning stuck generating artifact:", item.id);
          await db.artifacts.delete(item.id);
        }
      } catch (err) {
        console.warn("[learn-workspace] Failed to clean up stuck artifacts:", err);
      }
    };
    cleanupStale();
  }, [learnId, artifacts]);

  // Dialog & Panel states
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(initialSourceModalOpen);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [isStudioCollapsed, setIsStudioCollapsed] = useState(false);
  const [pendingStudioPrompt, setPendingStudioPrompt] = useState<string | null>(null);

  // Studio Artifact creation & generation states
  const [isCreateStudioOpen, setIsCreateStudioOpen] = useState(false);
  const [createStudioType, setCreateStudioType] = useState<"quiz" | "flashcard">("quiz");
  const [isCreateMindMapOpen, setIsCreateMindMapOpen] = useState(false);
  const [isCreateAudioSummaryOpen, setIsCreateAudioSummaryOpen] = useState(false);
  const [isCreateVideoOpen, setIsCreateVideoOpen] = useState(false);
  const [isCreatePresentationOpen, setIsCreatePresentationOpen] = useState(false);
  const [generatingArtifacts, setGeneratingArtifacts] = useState<GeneratingArtifactStatus[]>([]);

  // Right Pane: Dual Studio & Preview/Review state
  const [rightPaneMode, setRightPaneMode] = useState<"studio" | "preview">("studio");
  const [activeNoteArtifactId, setActiveNoteArtifactId] = useState<string | null>(null);
  const [rightPaneTabs, setRightPaneTabs] = useState<RightPaneTab[]>([
    { id: "review", type: "review", title: "Review" },
  ]);
  const [activeRightPaneTabId, setActiveRightPaneTabId] = useState<string>("review");
  const [isOpeningNewTab, setIsOpeningNewTab] = useState(false);
  const [sessionMutations, setSessionMutations] = useState<FileMutationRecord[]>([]);

  const activeNoteArtifact = (artifacts || []).find((a) => a.id === activeNoteArtifactId) || null;

  const handleOpenFileDiff = (mutation: FileMutationRecord) => {
    setIsStudioCollapsed(false);
    setRightPaneMode("preview");
    setIsOpeningNewTab(false);

    const filePath = mutation.filePath || mutation.targetFile || "";
    const fileName =
      filePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
      filePath ||
      "Diff";

    const existing = rightPaneTabs.find(
      (t) =>
        t.type === "file_diff" &&
        (t.filePath === filePath ||
          t.mutation?.targetFile === mutation.targetFile ||
          t.title === fileName)
    );

    if (existing) {
      setRightPaneTabs((prev) =>
        prev.map((t) =>
          t.id === existing.id
            ? {
                ...t,
                mutation,
                filePath,
                previousContent: mutation.previousContent,
                newContent: mutation.newContent,
              }
            : t
        )
      );
      setActiveRightPaneTabId(existing.id);
      return;
    }

    const newTab: RightPaneTab = {
      id: `diff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "file_diff",
      title: fileName,
      filePath,
      mutation,
      previousContent: mutation.previousContent,
      newContent: mutation.newContent,
    };
    setRightPaneTabs((prev) => [...prev, newTab]);
    setActiveRightPaneTabId(newTab.id);
  };

  const handleSelectTab = (tabId: string) => {
    setIsOpeningNewTab(false);
    setActiveRightPaneTabId(tabId);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRightPaneTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      if (activeRightPaneTabId === tabId) {
        if (next.length > 0) {
          const nextActive = next[Math.min(idx, next.length - 1)];
          setActiveRightPaneTabId(nextActive?.id || "review");
        } else {
          setActiveRightPaneTabId("review");
        }
      }
      return next;
    });
  };

  const handleNewTab = () => {
    setIsStudioCollapsed(false);
    setRightPaneMode("preview");
    setIsOpeningNewTab(true);
  };

  const handleOpenTabType = (type: RightPaneTabType) => {
    setIsOpeningNewTab(false);
    if (type === "review") {
      const existing = rightPaneTabs.find((t) => t.type === "review");
      if (existing) {
        setActiveRightPaneTabId(existing.id);
      } else {
        const reviewTab: RightPaneTab = {
          id: "review",
          type: "review",
          title: "Review",
        };
        setRightPaneTabs((prev) => [reviewTab, ...prev]);
        setActiveRightPaneTabId("review");
      }
    } else if (type === "browser") {
      handleOpenBrowser();
    } else if (type === "file_preview") {
      const previewTab: RightPaneTab = {
        id: `preview_${Date.now()}`,
        type: "file_preview",
        title: "Untitled",
      };
      setRightPaneTabs((prev) => [...prev, previewTab]);
      setActiveRightPaneTabId(previewTab.id);
    }
  };

  const handleReorderTabs = (fromIndex: number, toIndex: number) => {
    setRightPaneTabs((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(fromIndex, 1);
      if (removed) {
        result.splice(toIndex, 0, removed);
      }
      return result;
    });
  };

  const handleUpdateTab = (tabId: string, updates: Partial<RightPaneTab>) => {
    setRightPaneTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t))
    );
  };

  const handleDownloadArtifact = (art: any) => {
    if (art.content) {
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

  const handleRollbackFile = async (record: FileMutationRecord) => {
    const electron = (window as any).electron;
    const rollbackFn = electron?.agent?.rollbackFile || electron?.rollbackFile;
    if (rollbackFn) {
      await rollbackFn(record);
    }
    setSessionMutations((prev) =>
      prev.map((m) => (m.id === record.id ? { ...m, rolledBack: true } : m))
    );
    setRightPaneTabs((prev) =>
      prev.map((t) =>
        t.mutation && t.mutation.id === record.id
          ? { ...t, mutation: { ...t.mutation, rolledBack: true } }
          : t
      )
    );
    try {
      const msgs = await db.messages
        .filter((m) => Boolean(m.mutations?.some((mut) => mut.id === record.id)))
        .toArray();
      for (const msg of msgs) {
        if (msg.mutations) {
          const updated = msg.mutations.map((m) =>
            m.id === record.id ? { ...m, rolledBack: true } : m
          );
          await db.messages.update(msg.id, { mutations: updated });
        }
      }
    } catch {}
  };

  const handleRollbackAll = async (records: FileMutationRecord[]) => {
    const electron = (window as any).electron;
    const rollbackFn = electron?.agent?.rollbackFile || electron?.rollbackFile;
    if (rollbackFn) {
      for (const rec of [...records].reverse()) {
        try {
          await rollbackFn(rec);
        } catch {}
      }
    }
    const recordIds = new Set(records.map((r) => r.id));
    setSessionMutations((prev) =>
      prev.map((m) => (recordIds.has(m.id) ? { ...m, rolledBack: true } : m))
    );
    setRightPaneTabs((prev) =>
      prev.map((t) =>
        t.mutation && recordIds.has(t.mutation.id)
          ? { ...t, mutation: { ...t.mutation, rolledBack: true } }
          : t
      )
    );
    try {
      const msgs = await db.messages
        .filter((m) => Boolean(m.mutations?.some((mut) => recordIds.has(mut.id))))
        .toArray();
      for (const msg of msgs) {
        if (msg.mutations) {
          const updated = msg.mutations.map((m) =>
            recordIds.has(m.id) ? { ...m, rolledBack: true } : m
          );
          await db.messages.update(msg.id, { mutations: updated });
        }
      }
    } catch {}
  };

  // Dynamic responsive default widths
  const getResponsiveWidths = () => {
    if (typeof window === "undefined") {
      return { sources: 330, studio: 400 };
    }
    const w = window.innerWidth;
    if (w >= 1800) {
      // Large 1080p full-screen or 2K/4K: Keep Ask AI comfortably proportioned (~950-1040px max)
      // by giving generous breathing room to Sources (400px) and Studio (480px)
      return { sources: 400, studio: 480 };
    }
    if (w >= 1500) {
      // Standard laptop / scaled 1080p: Ask AI stays balanced (~750-820px)
      return { sources: 350, studio: 420 };
    }
    if (w >= 1300) {
      return { sources: 315, studio: 370 };
    }
    if (w >= 1100) {
      // Medium/compact desktop: Ask AI remains dominant (~520-580px, ~50% width)
      return { sources: 280, studio: 320 };
    }
    // Small desktop window (< 1100px): compact side panels so Ask AI has space
    return { sources: 250, studio: 285 };
  };

  // Minimum width protection for Ask AI central column
  const MIN_CHAT_WIDTH = 360;

  const clampStudioWidth = (
    desiredWidth: number,
    currentSourcesWidth = sourcesWidth,
    sourcesCollapsed = isSourcesCollapsed
  ) => {
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const effectiveSourcesWidth = sourcesCollapsed ? 48 : currentSourcesWidth;
    // Account for padding (p-2 sm:p-2.5 = 16-20px), gaps (gap-1.5 sm:gap-2 = 12-16px), resize handles ~ 44px
    const maxAllowedByChat = Math.max(260, windowWidth - effectiveSourcesWidth - MIN_CHAT_WIDTH - 44);
    const maxStudioWidth = Math.min(Math.max(Math.round(windowWidth * 0.65), 750), 960, maxAllowedByChat);
    return Math.min(Math.max(desiredWidth, 260), maxStudioWidth);
  };

  const clampSourcesWidth = (
    desiredWidth: number,
    currentStudioWidth = studioWidth,
    studioCollapsed = isStudioCollapsed
  ) => {
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const effectiveStudioWidth = studioCollapsed ? 48 : currentStudioWidth;
    const maxAllowedSources = Math.max(230, windowWidth - effectiveStudioWidth - MIN_CHAT_WIDTH - 44);
    const maxSourcesWidth = Math.min(520, maxAllowedSources);
    return Math.min(Math.max(desiredWidth, 230), maxSourcesWidth);
  };

  const [sourcesWidth, setSourcesWidth] = useState<number>(() => getResponsiveWidths().sources);
  const [studioWidth, setStudioWidth] = useState<number>(() => getResponsiveWidths().studio);
  const [isManualWidth, setIsManualWidth] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>("general");
  const [isMindMapDialogOpen, setIsMindMapDialogOpen] = useState(false);

  const responsiveDefaults = getResponsiveWidths();
  const isLayoutModified =
    sourcesWidth !== responsiveDefaults.sources || studioWidth !== responsiveDefaults.studio;

  useEffect(() => {
    const onOpenSettings = () => {
      setSettingsInitialTab("general");
      setIsSettingsOpen(true);
    };
    const onToggleSidebar = () => {
      setIsSourcesCollapsed((prev) => !prev);
    };
    const onNewLearn = () => {
      if (onCreateNew) {
        onCreateNew();
      } else {
        onBack();
      }
    };

    window.addEventListener("const:open-settings", onOpenSettings);
    window.addEventListener("const:toggle-sidebar", onToggleSidebar);
    window.addEventListener("const:new-learn", onNewLearn);

    return () => {
      window.removeEventListener("const:open-settings", onOpenSettings);
      window.removeEventListener("const:toggle-sidebar", onToggleSidebar);
      window.removeEventListener("const:new-learn", onNewLearn);
    };
  }, [onCreateNew, onBack]);

  const handleResetLayout = () => {
    setIsManualWidth(false);
    const defaults = getResponsiveWidths();
    setSourcesWidth(defaults.sources);
    setStudioWidth(defaults.studio);
  };

  const handleOpenBrowser = (initialUrl?: string) => {
    setIsStudioCollapsed(false);
    setRightPaneMode("preview");
    setIsOpeningNewTab(false);

    const existingBrowser = rightPaneTabs.find((t) => t.type === "browser");
    if (existingBrowser) {
      if (initialUrl && initialUrl !== existingBrowser.url) {
        handleUpdateTab(existingBrowser.id, { url: initialUrl });
      }
      setActiveRightPaneTabId(existingBrowser.id);
    } else {
      const browserTab: RightPaneTab = {
        id: `browser_${Date.now()}`,
        type: "browser",
        title: language === "id" ? "Peramban Web" : "Web Browser",
        url: initialUrl || "", // Tidak buka apa-apa di awal sesuai permintaan user
      };
      setRightPaneTabs((prev) => [...prev, browserTab]);
      setActiveRightPaneTabId(browserTab.id);
    }

    // Sesuaikan lebar studio/preview agar browser lebih luas dan nyaman (memicu isLayoutModified & tombol refresh di heading)
    const responsiveDefaults = getResponsiveWidths();
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const targetBrowserWidth = clampStudioWidth(
      Math.max(
        studioWidth,
        Math.min(Math.round(windowWidth * 0.45), 720),
        600
      )
    );

    if (studioWidth < targetBrowserWidth) {
      setStudioWidth(targetBrowserWidth);
      setIsManualWidth(true);
    } else if (studioWidth !== responsiveDefaults.studio) {
      setIsManualWidth(true);
    }
  };

  const handleOpenStudioArtifact = (art: LocalArtifact) => {
    setIsStudioCollapsed(false);
    setRightPaneMode("preview");
    setIsOpeningNewTab(false);

    const existingTab = rightPaneTabs.find(
      (t) => t.type === "studio_preview" && t.artifact?.id === art.id
    );

    if (existingTab) {
      setActiveRightPaneTabId(existingTab.id);
    } else {
      const tabId = `studio_${art.id}_${Date.now()}`;
      const newTab: RightPaneTab = {
        id: tabId,
        type: "studio_preview",
        title: art.title,
        artifact: art,
      };
      setRightPaneTabs((prev) => [...prev, newTab]);
      setActiveRightPaneTabId(tabId);
    }

    // Auto-widen studio/preview pane width like handleOpenBrowser
    const responsiveDefaults = getResponsiveWidths();
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const targetStudioWidth = clampStudioWidth(
      Math.max(
        studioWidth,
        Math.min(Math.round(windowWidth * 0.45), 720),
        600
      )
    );

    if (studioWidth < targetStudioWidth) {
      setStudioWidth(targetStudioWidth);
      setIsManualWidth(true);
    } else if (studioWidth !== responsiveDefaults.studio) {
      setIsManualWidth(true);
    }
  };

  const handleGenerateStudioArtifact = async (params: {
    type: "quiz" | "flashcard" | "mind_map" | "audio_summary";
    topic: string;
    selectedSourceIds: string[];
    count?: number;
    difficulty?: "easy" | "medium" | "hard";
    lengthMode?: "short" | "medium" | "long" | "auto";
    language?: "id" | "en" | string;
    themeId?: string;
    customPrompt?: string;
    voiceModel?: string;
    voiceId?: string;
  }) => {
    // 1. Ensure studio panel is open and in Studio mode so user immediately sees the progress card!
    setIsStudioCollapsed(false);
    setRightPaneMode("studio");

    const selectedSources = (sources || []).filter((s) => params.selectedSourceIds.includes(s.id));
    const targetLang = (params.language?.startsWith("id") || language === "id") ? "id" : "en";
    const isIndo = targetLang === "id";

    const title = params.topic.trim()
      ? (params.type === "quiz"
          ? (isIndo ? `Kuis: ${params.topic}` : `Quiz: ${params.topic}`)
          : params.type === "flashcard"
          ? (isIndo ? `Kartu: ${params.topic}` : `Flashcard: ${params.topic}`)
          : params.type === "audio_summary"
          ? (isIndo ? `Ringkasan Audio: ${params.topic}` : `Audio Summary: ${params.topic}`)
          : (isIndo ? `Peta Pikiran: ${params.topic}` : `Mind Map: ${params.topic}`))
      : (params.type === "quiz"
          ? (isIndo ? `Kuis (${params.count || 5} Soal)` : `Quiz (${params.count || 5} Questions)`)
          : params.type === "flashcard"
          ? (isIndo ? `Kartu Hafalan (${params.count || 10} Kartu)` : `Flashcards (${params.count || 10} Cards)`)
          : params.type === "audio_summary"
          ? (isIndo ? "Ringkasan Audio" : "Audio Summary")
          : (isIndo ? "Peta Pikiran" : "Mind Map"));

    const initialLoadingTitle =
      params.type === "quiz"
        ? (isIndo ? "Membuat Kuis..." : "Creating Quiz...")
        : params.type === "flashcard"
        ? (isIndo ? "Membuat Kartu Tanya-Jawab..." : "Creating Flashcards...")
        : params.type === "audio_summary"
        ? (isIndo ? "Membuat Ringkasan Audio..." : "Creating Audio Summary...")
        : (isIndo ? "Membuat Peta Pikiran..." : "Creating Mind Map...");

    // 2. Immediately create in Dexie with status: "generating" (appears instantly in Artifacts list)
    const artId = await localDb.createArtifact({
      learnId,
      title: initialLoadingTitle,
      type: params.type,
      status: "generating",
      sourcesCount: selectedSources.length,
      content: "",
    });

    try {
      // Call background AI generator
      const result = await generateStudioArtifact({
        learnId,
        type: params.type,
        topic: params.topic,
        sources: selectedSources,
        count: params.count,
        difficulty: params.difficulty,
        lengthMode: params.lengthMode,
        language: targetLang,
        themeId: params.themeId,
        customPrompt: params.customPrompt,
        voiceModel: params.voiceModel,
        voiceId: params.voiceId,
        audioLanguage: params.language,
      });

      // Update Dexie artifact to completed
      await localDb.updateArtifact(artId, {
        title: result.title || title,
        data: result.data,
        content: JSON.stringify(result.data),
        status: "completed",
      });

      toast.success(
        isIndo
          ? (params.type === "quiz"
              ? "Kuis berhasil dibuat!"
              : params.type === "flashcard"
              ? "Kartu tanya-jawab berhasil dibuat!"
              : params.type === "mind_map"
              ? "Peta pikiran berhasil dibuat!"
              : params.type === "audio_summary"
              ? "Ringkasan audio berhasil dibuat!"
              : "Presentasi berhasil disusun!")
          : (params.type === "quiz"
              ? "Quiz created successfully!"
              : params.type === "flashcard"
              ? "Flashcards created successfully!"
              : params.type === "mind_map"
              ? "Mind map created successfully!"
              : params.type === "audio_summary"
              ? "Audio summary created successfully!"
              : "Presentation slides created successfully!")
      );

      // Auto-open in preview & auto-widen
      const fullArt = await localDb.getArtifact(artId);
      if (fullArt) {
        handleOpenStudioArtifact(fullArt);
      }
    } catch (err: any) {
      console.error("Failed to generate studio artifact:", err);
      await localDb.updateArtifact(artId, {
        title,
        status: "error",
        error: err?.message || "Generation failed",
      });
      toast.error(
        isIndo
          ? `Gagal membuat materi: ${err?.message || "Terjadi kesalahan"}`
          : `Failed to create material: ${err?.message || "An error occurred"}`
      );
    }
  };

  const handleGenerateVideoSummary = async (params: {
    selectedSourceIds: string[];
    coverageMode: "short" | "long" | "auto";
    language: "id" | "en";
    audioLanguage?: string;
    voiceProviderId: string;
    voiceModel: string;
    voiceId: string;
    voiceName: string;
    deliveryMode?: string;
    speed?: number;
    customInstructions?: string;
  }) => {
    if (!learnId) return;

    const selectedSources = (sources || []).filter((s) =>
      params.selectedSourceIds.includes(s.id)
    );
    if (selectedSources.length === 0) return;

    const isIndo = Boolean(
      (params.audioLanguage && params.audioLanguage.startsWith("id")) ||
      params.language === "id"
    );
    const title = isIndo ? "Ringkasan Video" : "Video Summary";

    // 1. Create generating artifact in Dexie
    const artId = await localDb.createArtifact({
      learnId,
      title: isIndo ? "Membuat Ringkasan Video..." : "Creating Video Summary...",
      type: "video_summary",
      status: "generating",
      sourcesCount: selectedSources.length,
      content: "",
    });

    try {
      // 2. Call generator in background
      const result = await generateVideoSummaryArtifact({
        artifactId: artId,
        learnId,
        sources: selectedSources,
        coverageMode: params.coverageMode,
        language: params.language,
        audioLanguage: params.audioLanguage,
        voiceProviderId: params.voiceProviderId,
        voiceModel: params.voiceModel,
        voiceId: params.voiceId,
        voiceName: params.voiceName,
        deliveryMode: params.deliveryMode,
        speed: params.speed,
        customInstructions: params.customInstructions,
      });

      // 3. Update artifact in Dexie
      await localDb.updateArtifact(artId, {
        title: result.title || title,
        data: result.data,
        content: JSON.stringify(result.data),
        status: "completed",
      });

      toast.success(
        isIndo
          ? "Ringkasan Video berhasil dibuat!"
          : "Video Summary created successfully!"
      );

      // 4. Auto-open in preview & auto-widen
      const fullArt = await localDb.getArtifact(artId);
      if (fullArt) {
        handleOpenStudioArtifact(fullArt);
      }
    } catch (err: any) {
      console.error("Failed to generate video summary:", err);
      await localDb.updateArtifact(artId, {
        title,
        status: "error",
        error: err?.message || "Generation failed",
      });
      toast.error(
        isIndo
          ? `Gagal membuat ringkasan video: ${err?.message || "Terjadi kesalahan"}`
          : `Failed to create video summary: ${err?.message || "An error occurred"}`
      );
    }
  };

  const handleGeneratePresentation = async (params: {
    provider: "native" | "canva" | "slides";
    selectedSourceIds: string[];
    lengthMode: "short" | "medium" | "long" | "auto";
    slideCount?: number;
    themeId?: "bold_dark" | "swiss_blue" | "sea_indigo" | "ash_lime";
    customInstructions?: string;
  }) => {
    if (!learnId) return;

    const selectedSources = (sources || []).filter((s) =>
      params.selectedSourceIds.includes(s.id)
    );
    if (selectedSources.length === 0) return;

    const isIndo = language === "id";
    const targetLang: "id" | "en" = isIndo ? "id" : "en";
    const title = isIndo ? "Presentasi Materi" : "Presentation Slides";

    // 1. Create generating artifact in Dexie
    const artId = await localDb.createArtifact({
      learnId,
      title: isIndo ? "Menyusun Presentasi..." : "Creating Presentation...",
      type: "slides",
      status: "generating",
      sourcesCount: selectedSources.length,
      content: "",
    });

    try {
      // 2. Call generator in background
      const result = await generatePresentationArtifact({
        artifactId: artId,
        learnId,
        sources: selectedSources,
        provider: params.provider,
        lengthMode: params.lengthMode,
        slideCount: params.slideCount,
        themeId: params.themeId || "bold_dark",
        language: targetLang,
        customInstructions: params.customInstructions,
      });

      // 3. Update artifact in Dexie
      await localDb.updateArtifact(artId, {
        title: result.title || title,
        data: result.data,
        content: JSON.stringify(result.data),
        status: "completed",
      });

      toast.success(
        isIndo
          ? "Presentasi berhasil dibuat!"
          : "Presentation created successfully!"
      );

      // 4. Auto-open in preview & auto-widen
      const fullArt = await localDb.getArtifact(artId);
      if (fullArt) {
        handleOpenStudioArtifact(fullArt);
      }
    } catch (err: any) {
      console.error("Failed to generate presentation:", err);
      await localDb.updateArtifact(artId, {
        title,
        status: "error",
        error: err?.message || "Generation failed",
      });
      toast.error(
        isIndo
          ? `Gagal menyusun presentasi: ${err?.message || "Terjadi kesalahan"}`
          : `Failed to create presentation: ${err?.message || "An error occurred"}`
      );
    }
  };

  const handleSelectStudioTool = (toolId: string) => {
    if (toolId === "browser") {
      handleOpenBrowser();
    } else if (
      toolId === "quiz" ||
      toolId === "flashcards" ||
      toolId === "flashcard"
    ) {
      setCreateStudioType(
        toolId === "flashcards" || toolId === "flashcard"
          ? "flashcard"
          : "quiz"
      );
      setIsCreateStudioOpen(true);
    } else if (toolId === "mind_map") {
      setIsCreateMindMapOpen(true);
    } else if (toolId === "audio_summary" || toolId === "audio") {
      setIsCreateAudioSummaryOpen(true);
    } else if (toolId === "video_summary" || toolId === "video") {
      setIsCreateVideoOpen(true);
    } else if (toolId === "slides" || toolId === "presentation") {
      setIsCreatePresentationOpen(true);
    } else {
      return;
    }
  };

  const handleOpenArtifact = (art: any) => {
    if (
      art.type === "quiz" ||
      art.type === "flashcard" ||
      art.type === "mind_map" ||
      art.type === "audio_summary" ||
      art.type === "video_summary" ||
      art.type === "slides" ||
      art.data?.questions ||
      art.data?.cards ||
      art.data?.root ||
      art.data?.script ||
      art.data?.scenes ||
      art.data?.slides
    ) {
      handleOpenStudioArtifact(art);
      return;
    }

    if (art.type === "note") {
      setIsStudioCollapsed(false);
      setRightPaneMode("studio");
      setActiveNoteArtifactId(art.id);

      // Auto-widen studio/preview width comfortably (matching Image 3)
      const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
      const targetPreviewWidth = clampStudioWidth(
        Math.max(
          studioWidth,
          Math.min(Math.round(windowWidth * 0.45), 720),
          620
        )
      );
      if (studioWidth < targetPreviewWidth) {
        setStudioWidth(targetPreviewWidth);
        setIsManualWidth(true);
      }
      return;
    }
  };

  const handleCloseNote = () => {
    setActiveNoteArtifactId(null);
  };

  const handleConvertToSource = async (art: any) => {
    if (!learnId || !art) return;
    try {
      await localDb.createSource({
        learnId,
        title: art.title || (language === "id" ? "Catatan Baru" : "New Note"),
        content: art.content || "",
        type: "text",
        includedInChat: true,
      });
      toast.success(
        language === "id"
          ? "Catatan berhasil dikonversikan menjadi sumber!"
          : "Note converted to source successfully!"
      );
    } catch (err) {
      console.error("Failed to convert note to source:", err);
      toast.error(
        language === "id"
          ? "Gagal mengonversikan catatan menjadi sumber."
          : "Failed to convert note to source."
      );
    }
  };

  const handleDeleteArtifact = async (artId: string) => {
    await localDb.deleteArtifact(artId);
    if (activeNoteArtifactId === artId) {
      setActiveNoteArtifactId(null);
    }
    setRightPaneTabs((prev) =>
      prev.filter(
        (t) =>
          !(t.type === "studio_preview" && t.artifact?.id === artId) &&
          t.artifactId !== artId &&
          t.id !== `note_${artId}`
      )
    );
  };

  const handleAddNote = async () => {
    if (!learnId) return;

    const defaultTitle = language === "id" ? "Catatan Baru" : "New Note";
    const artId = await localDb.createArtifact({
      learnId,
      title: defaultTitle,
      type: "note",
      status: "completed",
      content: "",
      sourcesCount: 0,
    });

    setActiveNoteArtifactId(artId);
    setIsStudioCollapsed(false);
    setRightPaneMode("studio");
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const targetPreviewWidth = clampStudioWidth(
      Math.max(
        studioWidth,
        Math.min(Math.round(windowWidth * 0.45), 720),
        620
      )
    );
    if (studioWidth < targetPreviewWidth) {
      setStudioWidth(targetPreviewWidth);
      setIsManualWidth(true);
    }
  };

  const handleGenerateNote = async (art: LocalArtifact) => {
    if (!learnId || !art) return;

    const allSources = await db.sources.where("learnId").equals(learnId).toArray();
    const activeSources = allSources.filter((s) => s.includedInChat !== false);
    const sourcesCount = activeSources.length;

    if (sourcesCount === 0) {
      toast.error(
        language === "id"
          ? "Tambahkan sumber materi terlebih dahulu untuk menghasilkan catatan AI."
          : "Add sources to the notebook first to generate an AI note."
      );
      return;
    }

    const defaultTitle = language === "id" ? "Catatan Baru" : "New Note";
    await localDb.updateArtifact(art.id, {
      status: "generating",
      sourcesCount,
    });

    try {
      const grounded = buildGroundedContext(activeSources);
      const activeModelId =
        localStorage.getItem("const_learn_active_model") || "gemini-3.8-flash";

      const systemPrompt = `You are Const Learn AI Tutor — an expert educational researcher and synthesizer.
Your task is to generate a comprehensive, structured study note synthesizing the provided sources.
Format the note in clear, beautiful Markdown:
- An engaging, descriptive title (H1)
- Key Concepts / Ringkasan Intisari (bullet points)
- In-depth Explanation / Pembahasan Mendalam (H2, H3, code/tables if applicable)
- Key Takeaways & Study Questions / Poin Penting & Pertanyaan Refleksi
- Rujukan Sumber / Source References
Respond in ${language === "id" ? "Indonesian (Bahasa Indonesia)" : "English"}.`;

      const userPrompt = `Mohon buatkan catatan sintesis komprehensif berdasarkan materi sumber berikut:\n\n${grounded.formattedContext}\n\nBuat catatan yang rapi, padat wawasan, terstruktur, dan mudah dipahami. Gunakan tabel Markdown jika terdapat data perbandingan atau ringkasan matriks.`;

      let noteContent = "";
      await streamChatCompletion({
        model: activeModelId,
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        onToken: async (token) => {
          noteContent += token;
          await localDb.updateArtifact(art.id, {
            content: noteContent,
          });
        },
        onDone: async (finalContent) => {
          const contentToSave = finalContent || noteContent;
          let noteTitle = language === "id" ? "Catatan: Ringkasan Sumber" : "Study Note: Summary";
          const h1Match = contentToSave.match(/^#\s+(.+)$/m);
          if (h1Match && h1Match[1]) {
            noteTitle = h1Match[1].replace(/[*_~`]/g, "").trim();
          } else if (learn?.title) {
            noteTitle = `${language === "id" ? "Catatan: " : "Note: "}${learn.title}`;
          }

          await localDb.updateArtifact(art.id, {
            title: noteTitle,
            content: contentToSave,
            status: "completed",
          });

          toast.success(
            language === "id"
              ? `Catatan "${noteTitle}" selesai dibuat!`
              : `Note "${noteTitle}" completed!`
          );
        },
        onError: async (err) => {
          console.error("Failed to generate note:", err);
          await localDb.updateArtifact(art.id, {
            status: "completed",
            error: err.message,
          });
          toast.error(
            language === "id"
              ? "Gagal menghasilkan ringkasan AI: " + err.message
              : "Failed to generate AI note: " + err.message
          );
        },
      });
    } catch (err: any) {
      console.error("Error initiating note generation:", err);
      await localDb.updateArtifact(art.id, {
        status: "completed",
        error: err.message,
      });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (!isManualWidth) {
        const { sources, studio } = getResponsiveWidths();
        setSourcesWidth(clampSourcesWidth(sources));
        setStudioWidth(clampStudioWidth(studio));
      } else {
        setSourcesWidth((prev) => clampSourcesWidth(prev));
        setStudioWidth((prev) => clampStudioWidth(prev));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isManualWidth, sourcesWidth, studioWidth, isSourcesCollapsed, isStudioCollapsed]);

  const [isDraggingSources, setIsDraggingSources] = useState(false);
  const [isDraggingStudio, setIsDraggingStudio] = useState(false);

  // Drag resizing for Sources panel
  const handleSourcesMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsManualWidth(true);
    setIsDraggingSources(true);
    const startX = e.clientX;
    const startWidth = sourcesWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setSourcesWidth(clampSourcesWidth(startWidth + delta));
    };

    const onMouseUp = () => {
      setIsDraggingSources(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Drag resizing for Studio panel (expanded max width to support comfortable webview browsing)
  const handleStudioMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsManualWidth(true);
    setIsDraggingStudio(true);
    const startX = e.clientX;
    const startWidth = studioWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      setStudioWidth(clampStudioWidth(startWidth + delta));
    };

    const onMouseUp = () => {
      setIsDraggingStudio(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };



  const handleSelectSource = async (sourceType: string) => {
    setIsAddSourceOpen(false);
    if (!learnId) return;

    if (sourceType === "upload") {
      const filePaths = await window.electron?.openFileDialog?.({ multiple: true });
      if (filePaths && filePaths.length > 0) {
        for (const filePath of filePaths) {
          const fileName = filePath.split(/[\\/]/).pop() || t("sourceFileFallback");
          await localDb.createSource({
            learnId,
            title: fileName,
            type: "file",
            path: filePath,
            includedInChat: true,
          });
        }
      }
    } else if (sourceType === "paste") {
      const text = await navigator.clipboard.readText().catch(() => "");
      if (text && text.trim()) {
        const snippet = text.trim().slice(0, 30);
        await localDb.createSource({
          learnId,
          title: t("copiedQuote", { snippet }),
          type: "text",
          content: text,
          size: new Blob([text]).size,
          includedInChat: true,
        });
      }
    } else if (sourceType === "url") {
      const url = window.prompt(t("enterUrlPrompt"));
      if (url && url.trim()) {
        await localDb.createSource({
          learnId,
          title: url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          type: "url",
          url: url.trim(),
          includedInChat: true,
        });
      }
    }
  };

  const handleDropFiles = async (files: File[]) => {
    if (!learnId || !files || files.length === 0) return;
    try {
      const { parseUploadedFile } = await import("../../lib/sources/document-parser");
      for (const file of files) {
        const parsed = await parseUploadedFile(file);
        await localDb.createSource({
          learnId,
          title: parsed.title,
          type: "file",
          content: parsed.content,
          size: parsed.size,
          includedInChat: true,
        });
      }
    } catch (err) {
      console.error("Failed to parse dropped files:", err);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground overflow-hidden select-none">
      {/* Top Workspace Header Bar */}
      <header className="h-14 px-4 bg-card/60 backdrop-blur-md border-b border-border/50 flex items-center justify-between shrink-0 z-10">
        {/* Left: Back button + Notebook Title (No Logo, Clean Sans-Serif) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={t("backToHome")}
            aria-label={t("back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Workspace Title (Auto-resizing inline input, NotebookLM style) */}
          <WorkspaceTitle
            title={learn?.title || t("untitledNotebook")}
            onSave={async (newTitle) => {
              await localDb.updateLearn(learnId, { title: newTitle });
            }}
            placeholder={t("untitledNotebook")}
          />

          {learn?.projectPath && (
            <span
              className="hidden md:inline-flex items-center text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 max-w-[220px] truncate"
              title={learn.projectPath}
            >
              📁 {learn.projectPath.split(/[\\/]/).filter(Boolean).pop()}
            </span>
          )}
        </div>

        {/* Right: Reset Layout, Permission Mode & User Account */}
        <div className="flex items-center gap-2">
          {/* Reset Panel Layout Button (Left of Permission Mode) */}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleResetLayout}
                  disabled={!isLayoutModified}
                  aria-label={isLayoutModified ? t("resetLayout") : t("layoutDefault")}
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center transition-all select-none",
                    isLayoutModified
                      ? "text-foreground bg-secondary/70 hover:bg-secondary border border-border/80 shadow-xs cursor-pointer active:scale-95 hover:border-border"
                      : "text-muted-foreground/35 bg-transparent border border-transparent cursor-not-allowed"
                  )}
                  title={isLayoutModified ? t("resetLayoutDesc") : t("layoutDefaultDesc")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center" className="text-xs font-sans">
                {isLayoutModified ? t("resetLayoutDesc") : t("layoutDefaultDesc")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Permission Mode Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border/70 bg-secondary/40 hover:bg-secondary/70 text-foreground transition-all cursor-pointer select-none"
                title={t("permissionModeLabel")}
              >
                {(learn?.permissionMode || "ask_before_changes") === "ask_before_changes" ? (
                  <>
                    <Hand className="h-3.5 w-3.5 text-foreground shrink-0" />
                    <span className="hidden sm:inline">{t("askBeforeChanges")}</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="hidden sm:inline text-amber-500">{t("fullAccess")}</span>
                  </>
                )}
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5 opacity-70 shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-xl">
              {/* Option 1: Ask before changes */}
              <DropdownMenuItem
                className="cursor-pointer flex items-start gap-2.5 p-2 rounded-xl text-left"
                onClick={async () => {
                  if (learnId) {
                    await localDb.updateLearn(learnId, { permissionMode: "ask_before_changes" });
                  }
                }}
              >
                <Hand className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground">
                    {t("askBeforeChanges")}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {t("askBeforeChangesDesc")}
                  </div>
                </div>
                {(learn?.permissionMode || "ask_before_changes") === "ask_before_changes" && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1 mt-0.5" />
                )}
              </DropdownMenuItem>

              {/* Option 2: Full access */}
              <DropdownMenuItem
                className="cursor-pointer flex items-start gap-2.5 p-2 rounded-xl text-left"
                onClick={async () => {
                  if (learnId) {
                    await localDb.updateLearn(learnId, { permissionMode: "full_access" });
                  }
                }}
              >
                <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground">
                    {t("fullAccess")}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {t("fullAccessDesc")}
                  </div>
                </div>
                {(learn?.permissionMode || "ask_before_changes") === "full_access" && (
                  <Check className="h-3.5 w-3.5 text-amber-500 shrink-0 ml-1 mt-0.5" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Account Only */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative flex items-center justify-center rounded-full outline-none ring-offset-background transition-all hover:ring-2 hover:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none"
                aria-label="Account menu"
              >
                <Avatar className="h-7 w-7 rounded-full border border-border/70 transition-transform active:scale-95">
                  {user?.image ? (
                    <AvatarImage
                      src={user.image}
                      alt={user.name || "Avatar"}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-foreground text-background font-sans text-xs font-semibold">
                    {user === undefined ? (
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                    ) : (
                      user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"
                    )}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-md">
              {(user?.name || user?.email) && (
                <>
                  <div className="px-2.5 py-2">
                    {user.name && (
                      <p className="text-xs font-semibold text-foreground truncate">
                        {user.name}
                      </p>
                    )}
                    {user.email && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Settings */}
              <DropdownMenuItem
                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSettingsInitialTab("general");
                  setIsSettingsOpen(true);
                }}
              >
                <Settings className="h-4 w-4" />
                <span>{t("settings")}</span>
              </DropdownMenuItem>

              {/* Theme (Submenu) */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4" />
                  ) : theme === "light" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Laptop className="h-4 w-4" />
                  )}
                  <span>{t("theme")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[140px] p-1.5 shadow-md">
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTheme("system")}
                  >
                    <div className="flex items-center gap-2">
                      <Laptop className="h-3.5 w-3.5" />
                      <span>{t("themeSystem")}</span>
                    </div>
                    {theme === "system" && <Check className="h-3.5 w-3.5 ml-2" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTheme("light")}
                  >
                    <div className="flex items-center gap-2">
                      <Sun className="h-3.5 w-3.5" />
                      <span>{t("themeLight")}</span>
                    </div>
                    {theme === "light" && <Check className="h-3.5 w-3.5 ml-2" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTheme("dark")}
                  >
                    <div className="flex items-center gap-2">
                      <Moon className="h-3.5 w-3.5" />
                      <span>{t("themeDark")}</span>
                    </div>
                    {theme === "dark" && <Check className="h-3.5 w-3.5 ml-2" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Language (Submenu) */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground">
                  <Globe className="h-4 w-4" />
                  <span>{t("language")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[150px] p-1.5 shadow-md">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      className="cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setLanguage(lang.code)}
                    >
                      <span>{lang.label}</span>
                      {language === lang.code && <Check className="h-3.5 w-3.5 ml-2" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {onSwitchAccount && (
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-muted-foreground hover:text-foreground"
                  onClick={onSwitchAccount}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>{t("switchAccount")}</span>
                </DropdownMenuItem>
              )}

              {onSignOut && (
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2.5 text-destructive focus:text-destructive"
                  onClick={onSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("logout")}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 3-Column Floating Cards Body Layout */}
      <div className="flex-1 flex overflow-hidden p-2 sm:p-2.5 gap-1.5 sm:gap-2 bg-background">
        {/* Left Column: Sumber */}
        <SourcesPanel
          learnId={learnId}
          sourcesCount={learn?.sourcesCount || 0}
          width={sourcesWidth}
          onAddSource={() => setIsAddSourceOpen(true)}
          onSelectSource={handleSelectSource}
          onDropFiles={handleDropFiles}
          isCollapsed={isSourcesCollapsed}
          isResizing={isDraggingSources}
          onToggleCollapse={() => setIsSourcesCollapsed(!isSourcesCollapsed)}
        />

        {/* Left Resize Handle */}
        <div
          onMouseDown={handleSourcesMouseDown}
          onDoubleClick={() => {
            setIsManualWidth(false);
            setSourcesWidth(getResponsiveWidths().sources);
          }}
          className={cn(
            "w-1.5 hover:w-2 -mx-1 sm:-mx-1.5 h-full cursor-col-resize z-20 group flex items-center justify-center transition-all select-none shrink-0",
            isSourcesCollapsed ? "w-0 opacity-0 pointer-events-none -mx-0 overflow-hidden" : "opacity-100"
          )}
          title="Drag to resize / Double-click to reset"
        >
          <div className="w-0.5 h-7 rounded-full bg-border/40 group-hover:bg-primary/70 group-hover:h-12 transition-all" />
        </div>

        {/* Center Column: Socratic Chat */}
        <ChatPanel
          learnId={learnId}
          workspacePath={learn?.projectPath}
          permissionMode={learn?.permissionMode || "ask_before_changes"}
          sourcesCount={learn?.sourcesCount || 0}
          onAddSource={() => setIsAddSourceOpen(true)}
          onOpenSettings={(tab) => {
            setSettingsInitialTab(tab || "models");
            setIsSettingsOpen(true);
          }}
          onSelectPromptChip={(prompt) => {
            console.log("Selected prompt chip:", prompt);
          }}
          externalPrompt={pendingStudioPrompt}
          onExternalPromptConsumed={() => setPendingStudioPrompt(null)}
          onOpenFileDiff={handleOpenFileDiff}
          onMutationsChange={setSessionMutations}
        />

        {/* Right Resize Handle */}
        <div
          onMouseDown={handleStudioMouseDown}
          onDoubleClick={() => {
            setIsManualWidth(false);
            setStudioWidth(getResponsiveWidths().studio);
          }}
          className={cn(
            "w-1.5 hover:w-2 -mx-1 sm:-mx-1.5 h-full cursor-col-resize z-20 group flex items-center justify-center transition-all select-none shrink-0",
            isStudioCollapsed ? "w-0 opacity-0 pointer-events-none -mx-0 overflow-hidden" : "opacity-100"
          )}
          title="Drag to resize / Double-click to reset"
        >
          <div className="w-0.5 h-7 rounded-full bg-border/40 group-hover:bg-primary/70 group-hover:h-12 transition-all" />
        </div>

        {/* Right Column: Dual Studio & Preview RightPane */}
        <div
          style={{ width: isStudioCollapsed ? 48 : (studioWidth || 400) }}
          className={cn(
            "h-full flex flex-col shrink-0 overflow-hidden",
            isStudioCollapsed && "w-12"
          )}
        >
          <ErrorBoundary
            title="Panel samping mengalami kendala"
            description="Terjadi kesalahan pada panel Studio/Preview."
          >
            <RightPane
              width={studioWidth}
              onWidthChange={(w) => {
                setIsManualWidth(true);
                setStudioWidth(clampStudioWidth(w));
              }}
              isCollapsed={isStudioCollapsed}
              isResizing={isDraggingStudio}
              onToggleCollapse={() => setIsStudioCollapsed(!isStudioCollapsed)}
              mode={rightPaneMode}
              onModeChange={setRightPaneMode}
              tabs={rightPaneTabs}
              activeTabId={activeRightPaneTabId}
              isOpeningNewTab={isOpeningNewTab}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
              onNewTab={handleNewTab}
              onOpenTabType={handleOpenTabType}
              onReorderTabs={handleReorderTabs}
              onUpdateTab={handleUpdateTab}
              mutations={sessionMutations}
              onRollbackFile={handleRollbackFile}
              onRollbackAll={handleRollbackAll}
              onOpenFileDiff={handleOpenFileDiff}
              onSelectStudioTool={handleSelectStudioTool}
              onAddNote={handleAddNote}
              onOpenArtifact={handleOpenArtifact}
              onDeleteArtifact={handleDeleteArtifact}
              activeNoteArtifact={activeNoteArtifact}
              onCloseNote={handleCloseNote}
              onConvertToSource={handleConvertToSource}
              onGenerateNote={handleGenerateNote}
              artifacts={artifacts || []}
              onDownloadArtifact={handleDownloadArtifact}
              generatingArtifacts={generatingArtifacts}
              onSelectArtifact={handleOpenStudioArtifact}
              onExplainInChat={(prompt) => setPendingStudioPrompt(prompt)}
            />
          </ErrorBoundary>
        </div>
      </div>

      {/* Add Source Pop-up Modal */}
      <AddSourceDialog
        open={isAddSourceOpen}
        onOpenChange={setIsAddSourceOpen}
        learnId={learnId}
        onSelectSource={handleSelectSource}
      />

      {/* Create Studio Artifact (Quiz / Flashcard) Dialog */}
      <CreateStudioArtifactDialog
        open={isCreateStudioOpen}
        onOpenChange={setIsCreateStudioOpen}
        initialType={createStudioType}
        sources={sources || []}
        onGenerate={handleGenerateStudioArtifact}
      />

      {/* Dedicated Create Mind Map Dialog */}
      <CreateMindMapDialog
        open={isCreateMindMapOpen}
        onOpenChange={setIsCreateMindMapOpen}
        sources={sources || []}
        onGenerate={handleGenerateStudioArtifact}
      />

      {/* Dedicated Create Audio Summary Dialog */}
      <CreateAudioSummaryDialog
        open={isCreateAudioSummaryOpen}
        onOpenChange={setIsCreateAudioSummaryOpen}
        sources={sources || []}
        onGenerate={handleGenerateStudioArtifact}
        onOpenModelsSettings={() => {
          setSettingsInitialTab("models");
          setIsSettingsOpen(true);
        }}
      />

      {/* Dedicated Create Video Summary Dialog */}
      <CreateVideoSummaryDialog
        open={isCreateVideoOpen}
        onOpenChange={setIsCreateVideoOpen}
        sources={sources || []}
        onGenerate={handleGenerateVideoSummary}
        onOpenSettings={() => {
          setSettingsInitialTab("models");
          setIsSettingsOpen(true);
        }}
      />

      {/* Dedicated Create Presentation Dialog */}
      <CreatePresentationDialog
        open={isCreatePresentationOpen}
        onOpenChange={setIsCreatePresentationOpen}
        sources={sources || []}
        onGenerate={handleGeneratePresentation}
      />

      {/* Settings Modal / Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <SettingsView
            initialTab={settingsInitialTab}
            onBackToWorkspace={() => setIsSettingsOpen(false)}
            user={user}
            onSignOut={onSignOut}
            onSwitchAccount={onSwitchAccount}
          />
        </div>
      )}
    </div>
  );
}
