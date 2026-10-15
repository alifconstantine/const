import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  Presentation,
  Video,
  Square,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ban,
  FileText,
  Folder,
  Copy,
  Check,
  ExternalLink,
  Plus,
  ArrowUp,
} from "lucide-react";
import { ScrollArea, cn, toast } from "@const/ui";
import { ExecutionTrace, type DisplayToolCall, type TraceStep } from "../workspace/execution-trace";
import { MarkdownContent } from "../workspace/markdown-content";
import type { RightPaneTab } from "./types";
import type { FileMutationRecord } from "@const/agent";
import type { LocalArtifact } from "../../lib/db";
import { useI18n } from "../../lib/i18n";

export interface SideChatSession {
  id: string;
  role: "presentation" | "video_summary" | string;
  title: string;
  prompt: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startTime: number;
  endTime?: number;
  durationMs?: number;
  thinking?: string;
  traceSteps: TraceStep[];
  toolCalls: DisplayToolCall[];
  mutations?: FileMutationRecord[];
  content: string;
  outputFilePath?: string;
  turnCount?: number;
  error?: string;
}

export interface SideChatTabProps {
  tab: RightPaneTab;
  artifact?: LocalArtifact;
  activeSession?: SideChatSession;
  onStopAgent?: (conversationId: string) => void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
  onOpenBrowser?: (url: string) => void;
}

export function SideChatTab({
  tab,
  artifact: propArtifact,
  activeSession,
  onStopAgent,
  onOpenFileDiff,
  onOpenBrowser,
}: SideChatTabProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const artifact = propArtifact || tab.artifact;
  const isPresentation =
    artifact?.type === "slides" ||
    tab.sideChatRole === "presentation" ||
    activeSession?.role === "presentation";

  // Reconcile session state from active in-memory session or saved artifact data
  const session: SideChatSession = useMemo(() => {
    if (activeSession) {
      return activeSession;
    }

    const savedData = (artifact?.data?.sideChat as SideChatSession) || (artifact?.data as any) || {};
    return {
      id: artifact?.id || tab.id,
      role: isPresentation ? "presentation" : "video_summary",
      title: artifact?.title || tab.title || (isPresentation ? "Presentation Slides" : "Video Summary"),
      prompt: savedData.prompt || artifact?.content || "",
      status: (savedData.status || (artifact?.status === "completed" ? "completed" : artifact?.status === "error" ? "failed" : "running")) as any,
      startTime: savedData.startTime || artifact?.createdAt || Date.now(),
      endTime: savedData.endTime,
      durationMs: savedData.durationMs,
      thinking: savedData.thinking || "",
      traceSteps: savedData.traceSteps || [],
      toolCalls: savedData.toolCalls || [],
      mutations: savedData.mutations || [],
      content: savedData.content || (artifact?.status === "completed" ? (savedData as any).result || "" : ""),
      outputFilePath: savedData.outputFilePath || artifact?.data?.pdfPath || artifact?.data?.mp4Path || undefined,
      turnCount: savedData.turnCount || (savedData.traceSteps?.length ? 1 : 0),
      error: savedData.error || artifact?.error,
    };
  }, [activeSession, artifact, tab, isPresentation]);

  const isRunning = session.status === "running";
  const [liveDuration, setLiveDuration] = useState<number>(() => {
    if (session.durationMs) return session.durationMs;
    if (session.endTime && session.startTime) return session.endTime - session.startTime;
    return Math.max(0, Date.now() - session.startTime);
  });

  useEffect(() => {
    if (!isRunning) {
      if (session.endTime && session.startTime) {
        setLiveDuration(session.endTime - session.startTime);
      }
      return;
    }

    const timer = setInterval(() => {
      setLiveDuration(Math.max(0, Date.now() - session.startTime));
    }, 500);

    return () => clearInterval(timer);
  }, [isRunning, session.startTime, session.endTime]);

  const durationSec = Math.max(0, Math.round(liveDuration / 1000));
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Auto-scroll to bottom during live execution
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isRunning && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isRunning, session.traceSteps?.length, session.content, session.thinking]);

  const handleCopyPrompt = () => {
    if (!session.prompt) return;
    navigator.clipboard.writeText(session.prompt).catch(() => {});
    setCopiedPrompt(true);
    toast.success(isIndo ? "Prompt disalin ke clipboard" : "Prompt copied to clipboard");
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleOpenFile = async () => {
    const electron = typeof window !== "undefined" ? (window as any).electron : null;
    if (session.outputFilePath && electron?.openPath) {
      const opened = await electron.openPath(session.outputFilePath);
      if (!opened) {
        toast.error(
          isIndo
            ? "Gagal membuka file. Pastikan file telah selesai dibuat di folder Downloads."
            : "Failed to open file. Make sure file exists in Downloads."
        );
      }
    } else if (session.outputFilePath) {
      window.open(`file://${session.outputFilePath}`, "_blank");
    }
  };

  const handleShowInFolder = async () => {
    const electron = typeof window !== "undefined" ? (window as any).electron : null;
    if (session.outputFilePath && electron?.showItemInFolder) {
      await electron.showItemInFolder(session.outputFilePath);
    } else {
      toast.info(session.outputFilePath || "Path not available");
    }
  };

  const roleLabel = isPresentation
    ? (isIndo ? "PRESENTASI SLIDES" : "PRESENTATION")
    : (isIndo ? "VIDEO SUMMARY" : "VIDEO SUMMARY");

  return (
    <div className="flex-1 w-full h-full flex flex-col min-h-0 bg-background text-foreground select-text font-sans">
      {/* 1. Header & Controls (Matching Reference: apps/harness/desktop subagent-tab) */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border/60 bg-card/60 backdrop-blur flex items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded-md uppercase shrink-0 border",
              isPresentation
                ? "bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30"
                : "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30"
            )}
          >
            {roleLabel}
          </span>
          <span className="text-xs text-foreground truncate font-semibold">
            {session.title}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {session.turnCount && session.turnCount > 0 ? (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {session.turnCount} {session.turnCount === 1 ? "turn" : "turns"}
            </span>
          ) : null}

          <span className="text-[11px] text-muted-foreground tabular-nums">
            {durationSec}s
          </span>

          {/* Status badge */}
          {isRunning && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/25">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{isIndo ? "Sedang Dibuat" : "Running"}</span>
            </span>
          )}
          {session.status === "completed" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
              <CheckCircle2 className="w-3 h-3" />
              <span>{isIndo ? "Selesai" : "Completed"}</span>
            </span>
          )}
          {session.status === "failed" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-500 border border-red-500/25">
              <AlertCircle className="w-3 h-3" />
              <span>{isIndo ? "Gagal" : "Failed"}</span>
            </span>
          )}
          {session.status === "cancelled" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
              <Ban className="w-3 h-3" />
              <span>{isIndo ? "Dibatalkan" : "Cancelled"}</span>
            </span>
          )}

          {/* Action: Open File & Show in Folder when finished */}
          {session.outputFilePath && (
            <>
              <button
                type="button"
                onClick={handleOpenFile}
                title={session.outputFilePath}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-secondary hover:bg-muted text-foreground border border-border transition-colors cursor-pointer shadow-2xs"
              >
                <FileText className="w-3 h-3 text-primary" />
                <span>Buka {isPresentation ? "PDF" : "MP4"}</span>
              </button>
              <button
                type="button"
                onClick={handleShowInFolder}
                title={isIndo ? "Tampilkan di Folder Downloads" : "Show in Folder"}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer shadow-2xs"
              >
                <Folder className="w-3 h-3" />
              </button>
            </>
          )}

          {/* Action: Stop Generating Button (Top Right) */}
          {isRunning && onStopAgent && (
            <button
              type="button"
              onClick={() => onStopAgent(session.id)}
              title={isIndo ? "Hentikan Proses Pembuatan" : "Stop Generating"}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors cursor-pointer"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Stop</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Chat Area: Read-Only Message Flow */}
      <ScrollArea ref={scrollRef} className="flex-1 w-full h-full min-h-0">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
          {/* User Message: The Synthesized Prompt (Styled matching Main Chat's right-aligned bubble) */}
          <div className="w-full flex flex-col items-end group">
            <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-muted/80 text-foreground px-4 py-2.5 text-[13.5px] border border-border/60 shadow-xs leading-relaxed font-sans">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border/40 text-[11px] text-muted-foreground font-medium select-none gap-4">
                <span>{isIndo ? "Prompt Pengarah" : "Directive Prompt"}</span>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1 text-[11px] hover:text-foreground transition-colors cursor-pointer"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>{isIndo ? "Disalin" : "Copied"}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{isIndo ? "Salin" : "Copy"}</span>
                    </>
                  )}
                </button>
              </div>
              <div className="whitespace-pre-wrap select-text text-[13px] leading-relaxed">
                {session.prompt || (isIndo ? "Menyiapkan instruksi..." : "Preparing instructions...")}
              </div>
            </div>
          </div>

          {/* Assistant Message: Execution Trace (Thoughts, Tools, Logs, File Mutations) + Result */}
          <div className="w-full flex flex-col gap-3 group">
            <ExecutionTrace
              thinking={session.thinking}
              toolCalls={session.toolCalls}
              traceSteps={session.traceSteps}
              mutations={session.mutations}
              isExecuting={isRunning}
              durationMs={liveDuration}
              onOpenFileDiff={onOpenFileDiff}
              onOpenBrowser={onOpenBrowser}
            />

            {/* Markdown Content Output */}
            {session.content ? (
              <div className="px-1 text-[13.5px] leading-relaxed">
                <MarkdownContent
                  content={session.content}
                  onOpenBrowser={onOpenBrowser}
                />
              </div>
            ) : isRunning ? (
              <div className="text-xs text-muted-foreground italic px-2 flex items-center gap-2 select-none">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>
                  {isIndo
                    ? isPresentation
                      ? "Agent sedang merancang slide dan mengompilasi PDF..."
                      : "Agent sedang merangkum scene, menyintesis narasi, dan merender video..."
                    : "Agent is executing tools and compiling media..."}
                </span>
              </div>
            ) : null}

            {/* Error Banner if execution failed */}
            {session.error && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold mb-0.5">
                    {isIndo ? "Proses Gagal" : "Execution Failed"}
                  </div>
                  <div>{session.error}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* 3. Bottom Bar: Read-Only Input Container (Matching Main Chat UI) */}
      <div className="shrink-0 p-3 sm:p-4 bg-background border-t border-border/40 select-none">
        <div className="w-full max-w-4xl mx-auto">
          <div className="w-full bg-card border border-border transition-[border-color,padding,opacity] duration-150 shadow-md rounded-[24px] px-3 py-2 flex items-center justify-between gap-2">
            {/* Plus / Action Icon Placeholder */}
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/40 bg-muted/40 shrink-0">
              <Plus className="h-4 w-4" />
            </div>

            {/* Read-Only State Display */}
            <div className="flex-1 min-w-0 text-[13px] text-muted-foreground/60 italic truncate select-none px-1">
              {isRunning
                ? isIndo
                  ? "SideChat read-only — AI sedang mengeksekusi instruksi..."
                  : "SideChat read-only — AI is executing instructions..."
                : isIndo
                ? "SideChat read-only — eksekusi tugas telah selesai"
                : "SideChat read-only — task execution finished"}
            </div>

            {/* Read-Only Pill & Disabled Send Icon */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50">
                Read Only
              </span>
              <button
                type="button"
                disabled
                className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/60 text-muted-foreground/40 cursor-not-allowed shrink-0"
                aria-label="Send (disabled)"
              >
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
