import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Maximize2,
  Download,
  FileCode,
  Film,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  toast,
} from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { VideoSummaryData } from "../../lib/db";
import { buildHyperframesHtml } from "../../lib/studio/hyperframes-builder";
import { ImageLightbox } from "../workspace/image-lightbox";

export interface VideoSummaryViewerProps {
  data: VideoSummaryData;
  onExplainInChat?: (prompt: string) => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

/**
 * Format seconds to MM:SS string
 */
function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function VideoSummaryViewer({
  data,
  onExplainInChat: _onExplainInChat,
  onToggleExpand: _onToggleExpand,
  isExpanded: _isExpanded = false,
}: VideoSummaryViewerProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const scenes = data.scenes || [];

  // Resolve MP4 URL from data or const-media://file protocol
  const initialMp4Url = useMemo(() => {
    if (data.mp4Url) return data.mp4Url;
    if (data.mp4Path) return `const-media://file/${data.mp4Path.replace(/\\/g, "/")}`;
    return "";
  }, [data.mp4Url, data.mp4Path]);

  const [mp4Url, setMp4Url] = useState<string>(initialMp4Url);
  const [isRenderingMp4, setIsRenderingMp4] = useState<boolean>(
    !initialMp4Url && data.renderingStatus !== "error"
  );
  const [renderError, setRenderError] = useState<string | null>(
    data.renderingStatus === "error"
      ? data.renderingError || t("failedRenderVideoMp4")
      : null
  );
  const [renderProgress, setRenderProgress] = useState<string>("");
  const [duration, setDuration] = useState<number>(
    Math.max(1, data.totalDurationSeconds || scenes.reduce((sum, s) => sum + (s.durationSeconds || 5), 0))
  );
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync mp4Url and error when data updates
  useEffect(() => {
    if (data.mp4Url) {
      setMp4Url(data.mp4Url);
      setIsRenderingMp4(false);
      setRenderError(null);
    } else if (data.mp4Path) {
      setMp4Url(`const-media://file/${data.mp4Path.replace(/\\/g, "/")}`);
      setIsRenderingMp4(false);
      setRenderError(null);
    } else if (data.renderingStatus === "error") {
      setRenderError(
        data.renderingError || t("failedRenderVideoMp4")
      );
      setIsRenderingMp4(false);
    } else if (data.renderingStatus === "rendering") {
      setIsRenderingMp4(true);
      setRenderError(null);
    }
  }, [data.mp4Url, data.mp4Path, data.renderingStatus, data.renderingError, t]);

  // Auto-heal & Background disk check: Check if video.mp4 already exists on disk
  useEffect(() => {
    if (mp4Url) return;

    let isMounted = true;
    const checkDisk = async () => {
      const electron = (window as any).electron;
      if (!electron?.video?.checkStatus) return;

      try {
        const res = await electron.video.checkStatus({
          learnId: data.learnId || "default",
          artifactId: data.id || "",
          projectPath: data.projectPath,
        });

        if (!isMounted) return;

        if (res?.success && res.exists && res.mp4Url) {
          setMp4Url(res.mp4Url);
          data.mp4Url = res.mp4Url;
          if (res.mp4Path) data.mp4Path = res.mp4Path;
          data.renderingStatus = "completed";
          setIsRenderingMp4(false);
          setRenderError(null);

          // Update Dexie database so it remembers completed status
          try {
            const { localDb } = await import("../../lib/db");
            if (data.id) {
              const art = await localDb.getArtifact(data.id);
              if (art) {
                const updatedData = {
                  ...(art.data as VideoSummaryData),
                  mp4Url: res.mp4Url,
                  mp4Path: res.mp4Path,
                  renderingStatus: "completed",
                };
                await localDb.updateArtifact(data.id, {
                  data: updatedData,
                  content: JSON.stringify(updatedData),
                  status: "completed",
                });
              }
            }
          } catch (dbErr) {
            console.warn("[VideoSummaryViewer] Failed to sync Dexie:", dbErr);
          }
        }
      } catch (err) {
        console.warn("[VideoSummaryViewer] checkStatus error:", err);
      }
    };

    checkDisk();

    // If currently rendering in background, poll checkStatus every 3 seconds
    let intervalId: any = null;
    if (isRenderingMp4) {
      intervalId = setInterval(checkDisk, 3000);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [data.id, data.learnId, data.projectPath, isRenderingMp4, mp4Url]);

  // Listen to background render events and IPC progress
  useEffect(() => {
    const handleRendered = (e: any) => {
      if (e.detail?.artifactId === data.id || !e.detail?.artifactId) {
        if (e.detail?.mp4Url) {
          setMp4Url(e.detail.mp4Url);
          setIsRenderingMp4(false);
          setRenderError(null);
          setRenderProgress("");
          toast.success(isIndo ? "Video berhasil dirender!" : "Video rendered successfully!");
        }
      }
    };

    const handleRenderError = (e: any) => {
      if (e.detail?.artifactId === data.id) {
        setIsRenderingMp4(false);
        const errMsg = e.detail.error || (isIndo ? "Gagal merender video MP4" : "Failed to render MP4 video");
        setRenderError(errMsg);
        setRenderProgress("");
      }
    };

    window.addEventListener("const:video-rendered", handleRendered);
    window.addEventListener("const:video-render-error", handleRenderError);

    const electron = (window as any).electron;
    let cleanupIpc: (() => void) | undefined;
    if (electron?.video?.onRenderProgress) {
      cleanupIpc = electron.video.onRenderProgress((progData: { artifactId: string; chunk: string }) => {
        if (progData.artifactId === data.id || !progData.artifactId) {
          const text = (progData.chunk || "").trim();
          if (text) {
            const lastLine = text.split("\n").filter(Boolean).pop() || text;
            setRenderProgress(lastLine.slice(0, 80));
          }
        }
      });
    }

    return () => {
      window.removeEventListener("const:video-rendered", handleRendered);
      window.removeEventListener("const:video-render-error", handleRenderError);
      if (cleanupIpc) cleanupIpc();
    };
  }, [data.id, isIndo]);

  // Automatic background render trigger if not rendered yet
  useEffect(() => {
    if (mp4Url || renderError) return;

    const electron = (window as any).electron;
    if (electron?.video?.renderMp4 && data.id && !isRenderingMp4) {
      setIsRenderingMp4(true);
      electron.video
        .renderMp4({
          learnId: data.learnId || "default",
          artifactId: data.id,
        })
        .then((res: any) => {
          if (res?.success && res.mp4Path) {
            const url = res.mp4Url || `const-media://file/${res.mp4Path.replace(/\\/g, "/")}`;
            setMp4Url(url);
            setIsRenderingMp4(false);
            setRenderError(null);
          }
        })
        .catch(() => {
          setIsRenderingMp4(false);
        });
    }
  }, [mp4Url, renderError, data.id, data.learnId, isRenderingMp4]);

  // Download MP4 file
  const handleDownloadMp4File = () => {
    if (!mp4Url && !data.mp4Path) return;
    try {
      const a = document.createElement("a");
      a.href = mp4Url || `const-media://file/${(data.mp4Path || "").replace(/\\/g, "/")}`;
      a.download = `${(data.title || "video-summary").replace(/[^a-zA-Z0-9_-]/g, "_")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(isIndo ? "Pengunduhan video MP4 dimulai!" : "MP4 video download started!");
    } catch {
      toast.error(t("failedDownloadVideo"));
    }
  };

  // Export as standalone HyperFrames HTML file
  const handleExportHtml = () => {
    try {
      setIsExporting(true);
      const compositionHtml = buildHyperframesHtml(data);
      const blob = new Blob([compositionHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(data.title || "video-summary").replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(
        isIndo
          ? "File komposisi HyperFrames berhasil diunduh!"
          : "HyperFrames composition downloaded!"
      );
    } catch (err: any) {
      toast.error(err?.message || t("failedExportHtml"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenLightbox = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsLightboxOpen(true);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-start bg-[#161616] overflow-hidden select-none font-sans p-3 sm:p-5">
      {/* Top Header Bar with Title, Expand, and Export */}
      <div className="w-full max-w-5xl flex items-center justify-between px-1 pb-3 shrink-0">
        <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          <h2 className="text-sm sm:text-base font-semibold text-white truncate">
            {data.title || (isIndo ? "Ringkasan Video" : "Video Summary")}
          </h2>
          {duration > 0 && (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-[#222222] border border-[#333333] text-[11px] font-sans text-[#969696] shrink-0 tabular-nums">
              {formatSeconds(duration)}
            </span>
          )}
        </div>

        {/* Top Header Actions: Expand and Export */}
        <div className="flex items-center gap-2 shrink-0">
          {mp4Url && (
            <button
              type="button"
              onClick={handleOpenLightbox}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] text-[#d4d4d4] hover:text-white text-xs font-medium transition-colors border border-[#333333] cursor-pointer"
              title={isIndo ? "Perbesar Video" : "Expand Video"}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isIndo ? "Perbesar" : "Expand"}</span>
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] text-white text-xs font-medium transition-colors border border-[#333333] cursor-pointer"
                title={isIndo ? "Ekspor" : "Export"}
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-white" />
                )}
                <span>{isIndo ? "Ekspor" : "Export"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1 bg-[#222222] border-[#383838] text-white font-sans shadow-xl">
              {mp4Url && (
                <DropdownMenuItem
                  onClick={handleDownloadMp4File}
                  className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#2b2b2b] focus:bg-[#2b2b2b] text-white rounded-md"
                >
                  <Film className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isIndo ? "Unduh Video (MP4)" : "Download Video (MP4)"}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleExportHtml}
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#2b2b2b] focus:bg-[#2b2b2b] text-white rounded-md"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isIndo ? "Unduh Komposisi (HTML)" : "Download HTML"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Video Container (Aspect Ratio 16:9, Pure Native Video Controls like Image 4) */}
      <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl border border-[#2b2b2b] shadow-2xl overflow-hidden flex flex-col relative">
        {mp4Url ? (
          <video
            ref={videoRef}
            src={mp4Url}
            controls
            playsInline
            onLoadedMetadata={(e) => {
              if (e.currentTarget.duration && isFinite(e.currentTarget.duration)) {
                setDuration(e.currentTarget.duration);
              }
            }}
            className="w-full h-full object-contain rounded-2xl bg-black"
          />
        ) : isRenderingMp4 ? (
          <div className="relative w-full h-full bg-[#161616] flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="w-16 h-16 rounded-2xl bg-[#222222] border border-[#383838] flex items-center justify-center mb-4 shadow-xl">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {isIndo ? "Sedang Merender Video MP4..." : "Rendering MP4 Video..."}
            </h3>
            <p className="text-sm text-[#94a3b8] max-w-md mb-4">
              {isIndo
                ? "HyperFrames sedang mengompilasi grafis gerak dan naskah audio menjadi video 1080p berkualitas tinggi."
                : "HyperFrames is compiling motion graphics and narration audio into a high-quality 1080p video."}
            </p>
            {renderProgress ? (
              <div className="px-3 py-1 rounded-full bg-[#202020] border border-[#333333] text-[11px] text-blue-400 font-sans tabular-nums max-w-sm truncate mb-3">
                {renderProgress}
              </div>
            ) : null}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#222222] border border-[#383838] text-xs text-[#cbd5e1]">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>
                {scenes.length}{" "}
                {isIndo
                  ? "Scene Sedang Diproses di Background"
                  : "Scenes Processing in Background"}
              </span>
            </div>
          </div>
        ) : renderError ? (
          <div className="relative w-full h-full bg-[#161616] flex flex-col items-center justify-center p-6 sm:p-8 text-center select-none overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3 shadow-lg">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white mb-1.5">
              {isIndo ? "Gagal Merender Video MP4" : "Failed to Render MP4 Video"}
            </h3>
            <p className="text-xs sm:text-sm text-[#a3a3a3] max-w-md mb-3">
              {isIndo
                ? "Terjadi kendala saat HyperFrames mengompilasi video. Naskah audio dan tata letak grafis tetap aman tersimpan."
                : "An issue occurred while HyperFrames was compiling the video. Narration audio and layout remain safely stored."}
            </p>
            <div className="w-full max-w-md p-2.5 rounded-lg bg-[#202020] border border-[#303030] text-left text-[11px] text-[#f87171] font-sans mb-4 max-h-24 overflow-y-auto select-text break-words">
              {renderError}
            </div>
            <button
              type="button"
              onClick={handleExportHtml}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#252525] hover:bg-[#303030] text-[#d4d4d4] hover:text-white text-xs font-medium transition-all border border-[#383838] cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isIndo ? "Unduh File HTML" : "Download HTML"}</span>
            </button>
          </div>
        ) : (
          <div className="relative w-full h-full bg-[#161616] flex flex-col items-center justify-center p-8 text-center select-none">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
            <p className="text-sm text-[#94a3b8]">
              {isIndo ? "Menyiapkan video..." : "Preparing video..."}
            </p>
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal (Exact same preview modal as Ask AI / Image 4) */}
      {isLightboxOpen && mp4Url && (
        <ImageLightbox
          src={mp4Url}
          alt={data.title || (isIndo ? "Ringkasan Video" : "Video Summary")}
          type="video"
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </div>
  );
}
