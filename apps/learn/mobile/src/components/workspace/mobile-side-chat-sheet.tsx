import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ChevronLeft,
  Video,
  Square,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Copy,
  Check,
  Send,
  Sparkles,
  FileText,
  Volume2,
  Film,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { WorkingProcess, type TraceStep, type ToolCallTrace } from "./working-process";
import { MarkdownContent } from "./markdown-content";
import type { LocalArtifact, VideoSummaryData } from "../../lib/db";
import { useI18n } from "../../lib/i18n";

export interface MobileSideChatSession {
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
  toolCalls: ToolCallTrace[];
  content: string;
  outputFilePath?: string;
  videoData?: VideoSummaryData;
  error?: string;
}

export interface MobileSideChatSheetProps {
  open: boolean;
  onClose: () => void;
  artifact?: LocalArtifact | null;
  activeSession?: MobileSideChatSession | null;
  onSendMessage?: (content: string) => Promise<void> | void;
  onStopAgent?: () => void;
  onOpenVideoPlayer?: (data: VideoSummaryData) => void;
  onOpenBrowser?: (url: string) => void;
}

export function MobileSideChatSheet({
  open,
  onClose,
  artifact,
  activeSession,
  onSendMessage,
  onStopAgent,
  onOpenVideoPlayer,
  onOpenBrowser,
}: MobileSideChatSheetProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reconcile session state from active session or artifact
  const session: MobileSideChatSession = useMemo(() => {
    if (activeSession) return activeSession;

    const savedData =
      (artifact?.data?.sideChat as MobileSideChatSession) ||
      (artifact?.data as any) ||
      {};

    return {
      id: artifact?.id || "sidechat",
      role: artifact?.type || "video_summary",
      title: artifact?.title || (isIndo ? "Ringkasan Video" : "Video Summary"),
      prompt: savedData.prompt || artifact?.content || "",
      status: (savedData.status ||
        (artifact?.status === "completed"
          ? "completed"
          : artifact?.status === "error"
          ? "failed"
          : "running")) as any,
      startTime: savedData.startTime || artifact?.createdAt || Date.now(),
      endTime: savedData.endTime,
      durationMs: savedData.durationMs,
      thinking: savedData.thinking || "",
      traceSteps: savedData.traceSteps || [],
      toolCalls: savedData.toolCalls || [],
      content:
        savedData.content ||
        (artifact?.status === "completed"
          ? (savedData as any).result || ""
          : ""),
      outputFilePath: savedData.outputFilePath,
      videoData: savedData.videoData || (artifact?.data as VideoSummaryData),
      error: savedData.error || artifact?.error,
    };
  }, [activeSession, artifact, isIndo]);

  const isRunning = session.status === "running";

  // Live timer for execution duration
  const [liveDuration, setLiveDuration] = useState<number>(() => {
    if (session.durationMs) return session.durationMs;
    if (session.endTime && session.startTime) {
      return session.endTime - session.startTime;
    }
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

  // Auto-scroll to bottom as output streams in
  useEffect(() => {
    if (isRunning && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isRunning, session.content, session.thinking, session.toolCalls?.length]);

  const handleCopyPrompt = () => {
    if (!session.prompt) return;
    navigator.clipboard.writeText(session.prompt).catch(() => {});
    setCopiedPrompt(true);
    toast.success(isIndo ? "Prompt disalin" : "Prompt copied");
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputMessage.trim();
    if (!clean || isSending || !onSendMessage) return;

    setIsSending(true);
    setInputMessage("");
    try {
      await onSendMessage(clean);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  if (!open) return null;

  const hasVideoPlayerReady =
    session.videoData &&
    session.videoData.scenes &&
    session.videoData.scenes.length > 0;

  return (
    <div className="fixed inset-0 z-[60] bg-[#161616] text-[#e0e0e0] flex flex-col font-sans select-text pb-safe animate-in fade-in duration-200">
      {/* 1. Header & Controls */}
      <div className="shrink-0 px-4 py-3 border-b border-[#242424] bg-[#161616]/95 backdrop-blur flex items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1 -ml-1 rounded-full text-[#888] hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded-md uppercase shrink-0 border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              {isIndo ? "VIDEO SUMMARY" : "VIDEO SUMMARY"}
            </span>
            <span className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-[240px]">
              {session.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Live Status Pill */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border",
              isRunning
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                : session.status === "completed"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-destructive/10 text-destructive border-destructive/30"
            )}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span>{durationSec}s</span>
              </>
            ) : session.status === "completed" ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{isIndo ? "Selesai" : "Done"}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-destructive" />
                <span>{isIndo ? "Gagal" : "Failed"}</span>
              </>
            )}
          </div>

          {/* Abort Button when Running */}
          {isRunning && onStopAgent && (
            <button
              type="button"
              onClick={onStopAgent}
              className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-colors"
              title={isIndo ? "Hentikan Agen" : "Stop Agent"}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Scrollable Body: Prompt -> Trace -> Output -> Video Player Button */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Initial Prompt Card */}
        {session.prompt && (
          <div className="p-3.5 rounded-2xl bg-[#1b1b1b] border border-[#262626] space-y-2">
            <div className="flex items-center justify-between text-[#888]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#aaa] flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>{isIndo ? "Instruksi Pembuatan" : "Creation Prompt"}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="inline-flex items-center gap-1 text-[11px] text-[#888] hover:text-white transition-colors"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">
                      {isIndo ? "Tersalin" : "Copied"}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{isIndo ? "Salin" : "Copy"}</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-[#ccc] leading-relaxed line-clamp-3 select-text whitespace-pre-wrap">
              {session.prompt}
            </p>
          </div>
        )}

        {/* Live Execution Trace (Thinking + Tool Calls) */}
        <div className="rounded-2xl bg-[#181818] border border-[#242424] p-3.5">
          <WorkingProcess
            thinking={session.thinking}
            isExecuting={isRunning}
            durationMs={session.durationMs || liveDuration}
            startTime={session.startTime}
            toolCalls={session.toolCalls}
            traceSteps={session.traceSteps}
            onOpenBrowser={onOpenBrowser}
          />
        </div>

        {/* Video Player Ready Action Card */}
        {hasVideoPlayerReady && onOpenVideoPlayer && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-emerald-900/20 border border-emerald-500/40 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-white truncate">
                  {session.videoData?.title || session.title}
                </h3>
                <p className="text-[11px] text-emerald-300/80">
                  {session.videoData?.scenes?.length || 0} Scene Video • Inworld Narration
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenVideoPlayer(session.videoData!)}
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-semibold text-xs inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>{isIndo ? "Putar Video" : "Play Video"}</span>
            </button>
          </div>
        )}

        {/* Markdown Output Content */}
        {session.content && (
          <div className="p-4 rounded-2xl bg-[#181818] border border-[#242424] space-y-3">
            <div className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">
              {isIndo ? "Hasil Sintesis Agen" : "Agent Response"}
            </div>
            <MarkdownContent
              content={session.content}
              onOpenBrowser={onOpenBrowser}
            />
          </div>
        )}

        {/* Error Notice */}
        {session.error && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">
                {isIndo ? "Terjadi Kesalahan" : "Error Occurred"}
              </div>
              <div className="text-[11px] opacity-90 whitespace-pre-wrap break-all">
                {session.error}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Follow-Up Chat Input Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-[#242424] bg-[#161616]">
        <form onSubmit={handleSendFollowUp} className="flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending || isRunning}
            placeholder={
              isRunning
                ? isIndo
                  ? "Agen sedang memproses..."
                  : "Agent is processing..."
                : isIndo
                ? "Ketik instruksi atau minta perubahan suara/model..."
                : "Ask follow-up or request voice/model change..."
            }
            className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-[#202020] border border-[#2a2a2a] text-white placeholder:text-[#666] focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending || isRunning}
            className={cn(
              "p-2.5 rounded-xl font-medium text-xs flex items-center justify-center transition-all cursor-pointer",
              inputMessage.trim() && !isSending && !isRunning
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            )}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
