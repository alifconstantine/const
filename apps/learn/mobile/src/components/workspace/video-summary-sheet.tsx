import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Download,
  X,
  FileCode,
  Film,
  Loader2,
  Video,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { VideoSummaryData } from "../../lib/db";
import { renderVideoInSandbox } from "../../lib/composio";
import { buildHyperframesHtml } from "../../lib/studio/hyperframes-builder";

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  let pos = 0;
  function setUint16(data: number) { out.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { out.setUint32(pos, data, true); pos += 4; }
  setUint32(0x46464952);
  setUint32(length - 8);
  setUint32(0x45564157);
  setUint32(0x20746d66);
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(length - pos - 4);
  const channels: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  let offset = 0;
  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      const sample = Math.max(-1, Math.min(1, channels[i]![offset]!));
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      out.setInt16(pos, intSample | 0, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([out.buffer], { type: "audio/wav" });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function ScrubberBar({
  currentTime,
  totalDuration,
  sceneOffsets,
  onSeek,
}: {
  currentTime: number;
  totalDuration: number;
  sceneOffsets: number[];
  onSeek: (time: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getTimeFromPointer = (clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * totalDuration;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    const newTime = getTimeFromPointer(e.clientX);
    onSeek(newTime);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      const newTime = getTimeFromPointer(e.clientX);
      onSeek(newTime);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
    }
  };

  const progressPercent = totalDuration > 0 ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100)) : 0;

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex-1 h-6 flex items-center cursor-pointer select-none group touch-none"
    >
      {/* Background Track */}
      <div className="relative w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        {/* Fill Bar */}
        <div
          className="h-full bg-white transition-[width] duration-75 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Scene Boundary Markers */}
      {sceneOffsets.map((offset, idx) => {
        if (offset <= 0 || offset >= totalDuration) return null;
        const leftPercent = (offset / totalDuration) * 100;
        return (
          <div
            key={idx}
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 bg-[#161616] pointer-events-none z-10 opacity-70"
            style={{ left: `${leftPercent}%` }}
          />
        );
      })}

      {/* Thumb Knob */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg pointer-events-none z-20"
        style={{
          left: `${progressPercent}%`,
          transform: `translate(-50%, -50%) scale(${isDragging ? 1.25 : 1})`,
        }}
      />
    </div>
  );
}

export interface VideoSummarySheetProps {
  open: boolean;
  onClose: () => void;
  data: VideoSummaryData;
  onExplainInChat?: (prompt: string) => void;
}

export function VideoSummarySheet({
  open,
  onClose,
  data,
  onExplainInChat: _onExplainInChat,
}: VideoSummarySheetProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isRenderingCloud, setIsRenderingCloud] = useState(false);
  const [stitchedAudioUrl, setStitchedAudioUrl] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lightboxIframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(360);

  const scenes = data.scenes || [];
  const totalDuration = Math.max(
    1,
    data.totalDurationSeconds ||
      scenes.reduce((sum, s) => sum + (s.durationSeconds || 5), 0)
  );

  useEffect(() => {
    if (data.combinedAudioBase64 || data.combinedAudioUrl) {
      setStitchedAudioUrl(data.combinedAudioBase64 || data.combinedAudioUrl || "");
      return;
    }

    const audios = (data.scenes || []).map((s) => s.audioBase64 || s.audioUrl).filter(Boolean);
    if (audios.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buffers: AudioBuffer[] = [];
        for (const src of audios) {
          if (cancelled) break;
          const resp = await fetch(src as string);
          const arrayBuf = await resp.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arrayBuf);
          buffers.push(decoded);
        }
        if (!cancelled && buffers.length > 0) {
          const sampleRate = buffers[0]!.sampleRate;
          const numChannels = buffers[0]!.numberOfChannels;
          const totalLen = buffers.reduce((sum, b) => sum + b.length, 0);
          const combined = audioCtx.createBuffer(numChannels, totalLen, sampleRate);
          let offset = 0;
          for (const b of buffers) {
            for (let ch = 0; ch < numChannels; ch++) {
              combined.getChannelData(ch).set(b.getChannelData(Math.min(ch, b.numberOfChannels - 1)), offset);
            }
            offset += b.length;
          }
          const blob = audioBufferToWavBlob(combined);
          const b64 = await blobToBase64(blob);
          if (!cancelled) setStitchedAudioUrl(b64);
        }
        await audioCtx.close();
      } catch (err) {
        console.warn("[MobileVideo] Client-side audio stitch failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data]);

  const masterAudioSrc = stitchedAudioUrl || data.combinedAudioBase64 || data.combinedAudioUrl || "";

  // Compute start offsets for each scene
  const sceneOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    scenes.forEach((s) => {
      offsets.push(acc);
      acc += Math.max(3.0, s.durationSeconds || 5);
    });
    return offsets;
  }, [scenes]);

  const currentSceneIndex = useMemo(() => {
    for (let i = sceneOffsets.length - 1; i >= 0; i--) {
      if (currentTime >= (sceneOffsets[i] ?? 0)) {
        return i;
      }
    }
    return 0;
  }, [currentTime, sceneOffsets]);

  // Measure container for 1080p scaling
  useEffect(() => {
    if (!playerContainerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(playerContainerRef.current);
    return () => ro.disconnect();
  }, [open]);

  const scale = containerWidth / 1920;

  // Sync active iframe GSAP timeline
  const syncTimeline = useCallback(
    (time: number) => {
      const activeIframe = isLightboxOpen
        ? lightboxIframeRef.current
        : iframeRef.current;
      if (activeIframe?.contentWindow) {
        const win = activeIframe.contentWindow as any;
        if (typeof win.__seekTo === "function") {
          win.__seekTo(time);
        } else {
          const tl = win?.__timelines?.["root"];
          if (tl && typeof tl.seek === "function") {
            tl.seek(time, false);
          }
        }
      }
    },
    [isLightboxOpen]
  );

  const seekTo = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, totalDuration));
      setCurrentTime(clamped);
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
      }
      syncTimeline(clamped);
    },
    [totalDuration, syncTimeline]
  );

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    } else {
      if (currentTime >= totalDuration - 0.2) {
        seekTo(0);
      }
      setIsPlaying(true);
      if (audioRef.current && !isMuted) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [isPlaying, currentTime, totalDuration, isMuted, seekTo]);

  // Primary animation clock
  useEffect(() => {
    if (!isPlaying) return;

    let lastTimestamp = performance.now();

    const tick = (now: number) => {
      const deltaSec = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      setCurrentTime((prev) => {
        let nextTime = prev + deltaSec;
        if (audioRef.current && !audioRef.current.paused && audioRef.current.currentTime > 0) {
          nextTime = audioRef.current.currentTime;
        }

        if (nextTime >= totalDuration) {
          setIsPlaying(false);
          audioRef.current?.pause();
          syncTimeline(totalDuration);
          return totalDuration;
        }

        syncTimeline(nextTime);
        return nextTime;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, totalDuration, syncTimeline]);

  // Sync mute state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // HyperFrames HTML composition: Ensure latest buildHyperframesHtml is used
  // if saved data.hyperframesHtml does not contain __seekTo
  const compositionHtml = useMemo(() => {
    if (data.hyperframesHtml && data.hyperframesHtml.includes("__seekTo")) {
      return data.hyperframesHtml;
    }
    return buildHyperframesHtml(data);
  }, [data]);

  // Export HTML
  const handleExportHtml = () => {
    try {
      const html = compositionHtml || data.hyperframesHtml || "";
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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
    }
  };

  // Render MP4 via Composio Cloud Sandbox
  const handleRenderCloudMp4 = async () => {
    if (isRenderingCloud) return;
    const targetHtml = compositionHtml || data.hyperframesHtml;
    if (!targetHtml) {
      toast.error(t("noHyperframesComposition"));
      return;
    }

    setIsRenderingCloud(true);
    toast(
      isIndo
        ? "Sedang merender video MP4 di Composio Cloud Sandbox..."
        : "Rendering MP4 video in Composio Cloud Sandbox..."
    );

    try {
      const res = await renderVideoInSandbox({
        htmlContent: targetHtml,
        totalDurationSeconds: totalDuration,
      });

      if (res.success && res.mp4Base64) {
        // Trigger download of MP4 base64
        const blob = await fetch(`data:video/mp4;base64,${res.mp4Base64}`).then((r) => r.blob());
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(data.title || "video-summary").replace(/[^a-zA-Z0-9_-]/g, "_")}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(
          isIndo ? "Video MP4 berhasil dirender dan diunduh!" : "MP4 video rendered and downloaded!"
        );
      } else {
        toast.error(
          res.error || t("failedRenderVideoMp4")
        );
      }
    } catch (err: any) {
      console.error("[MobileVideo] Cloud render error:", err);
      toast.error(err?.message || t("cloudRenderError"));
    } finally {
      setIsRenderingCloud(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#161616] text-white flex flex-col font-sans select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      {/* Audio Element */}
      {masterAudioSrc && (
        <audio
          ref={audioRef}
          src={masterAudioSrc}
          preload="auto"
          onEnded={() => {
            setIsPlaying(false);
            seekTo(totalDuration);
          }}
        />
      )}

      {/* Top Header */}
      <header className="h-14 px-4 bg-[#161616] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div className="h-8 w-8 rounded-xl bg-[#222222] border border-[#2b2b2b] flex items-center justify-center text-white shrink-0">
            <Video className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xs font-semibold text-white truncate leading-tight">
              {data.title || (isIndo ? "Ringkasan Video" : "Video Summary")}
            </h2>
            <p className="text-[10.5px] text-[#888888] truncate">
              {scenes.length} Scenes • {formatSeconds(totalDuration)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-xl bg-[#222222] hover:bg-[#2b2b2b] text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Main Video Player Container (Centered 16:9, Pure Video Focus, Zero Storyboard) */}
      <div className="flex-1 w-full min-h-0 flex items-center justify-center p-3 sm:p-4 bg-[#161616] overflow-hidden">
        <div className="w-full max-w-lg aspect-video bg-[#161616] rounded-2xl border border-[#2b2b2b] shadow-2xl relative overflow-hidden flex flex-col">
          <div
            ref={playerContainerRef}
            className="relative flex-1 w-full min-h-0 bg-[#161616] flex items-center justify-center overflow-hidden"
          >
            {data.mp4Url ? (
              <video
                ref={(el) => {
                  if (el) {
                    if (isPlaying && el.paused) el.play().catch(() => {});
                    else if (!isPlaying && !el.paused) el.pause();
                    el.muted = isMuted;
                  }
                }}
                src={data.mp4Url}
                className="w-full h-full object-contain bg-[#161616]"
                playsInline
                muted={isMuted}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => {
                  setIsPlaying(false);
                  setCurrentTime(totalDuration);
                }}
                onClick={togglePlay}
              />
            ) : (
              /* Scaled 1080p Iframe Fallback */
              <div
                className="absolute top-0 left-0 origin-top-left pointer-events-none"
                style={{
                  width: "1920px",
                  height: "1080px",
                  transform: `scale(${scale})`,
                }}
              >
                <iframe
                  ref={iframeRef}
                  srcDoc={compositionHtml}
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full border-none bg-[#161616]"
                  title="HyperFrames Mobile Player"
                  onLoad={() => {
                    const win = iframeRef.current?.contentWindow as any;
                    if (typeof win?.__seekTo === "function") {
                      win.__seekTo(currentTime);
                    } else {
                      const tl = win?.__timelines?.["root"];
                      if (tl && typeof tl.seek === "function") {
                        tl.seek(currentTime, false);
                      }
                    }
                  }}
                />
              </div>
            )}

            {/* Center Play Overlay */}
            {!isPlaying && (
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-12 h-12 rounded-2xl bg-[#161616]/80 hover:bg-[#161616]/95 border border-[#383838] text-white flex items-center justify-center transition-all shadow-xl cursor-pointer z-20"
                title="Play"
              >
                <Play className="w-5 h-5 ml-0.5 fill-white text-white" />
              </button>
            )}
          </div>

          {/* Player Controls Bar */}
          <div className="shrink-0 bg-[#161616] px-3 py-2 text-white flex flex-col gap-1.5 z-30 select-none">
            {/* Timeline Scrubber */}
            <div className="flex items-center gap-2.5 w-full">
              <span className="text-[10px] font-sans font-medium text-[#969696] w-9 text-right tabular-nums shrink-0">
                {formatSeconds(currentTime)}
              </span>
              <ScrubberBar
                currentTime={currentTime}
                totalDuration={totalDuration}
                sceneOffsets={sceneOffsets}
                onSeek={seekTo}
              />
              <span className="text-[10px] font-sans font-medium text-[#969696] w-9 text-left tabular-nums shrink-0">
                {formatSeconds(totalDuration)}
              </span>
            </div>

            {/* Controls Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="h-7 w-7 rounded-lg bg-[#222222] text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-3 h-3 fill-white" />
                  ) : (
                    <Play className="w-3 h-3 fill-white ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => seekTo(0)}
                  className="h-7 w-7 rounded-lg text-[#d4d4d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>

                {(masterAudioSrc || data.mp4Url) && (
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className="h-7 w-7 rounded-lg text-[#d4d4d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {isMuted ? (
                      <VolumeX className="w-3 h-3 text-red-400" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="h-7 w-7 rounded-lg text-[#d4d4d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={handleRenderCloudMp4}
                  disabled={isRenderingCloud}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-black text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40"
                >
                  {isRenderingCloud ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Film className="w-3 h-3" />
                  )}
                  <span>MP4</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportHtml}
                  className="h-7 w-7 rounded-lg bg-[#222222] text-[#d4d4d4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="HTML"
                >
                  <FileCode className="w-3 h-3 text-emerald-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Lightbox / Fullscreen Modal with Top 'X' Button */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-[#161616] flex flex-col items-center justify-center p-2 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          {/* Top Bar with Prominent 'X' */}
          <div className="w-full flex items-center justify-between p-2">
            <span className="text-xs font-medium text-white truncate pr-2">
              {data.title || "Video Preview"}
            </span>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="h-8 w-8 rounded-xl bg-[#222222] text-[#d4d4d4] hover:text-white flex items-center justify-center cursor-pointer border border-[#383838]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 16:9 Maximized Player */}
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-[#161616] border border-[#2b2b2b] relative flex flex-col">
            <div className="relative flex-1 w-full min-h-0 bg-[#161616] overflow-hidden">
              {data.mp4Url ? (
                <video
                  src={data.mp4Url}
                  className="w-full h-full object-contain bg-[#161616]"
                  playsInline
                  autoPlay
                  controls
                />
              ) : (
                <iframe
                  ref={lightboxIframeRef}
                  srcDoc={compositionHtml}
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full border-none bg-[#161616]"
                  title="HyperFrames Lightbox Player"
                  onLoad={() => {
                    const win = lightboxIframeRef.current?.contentWindow as any;
                    if (typeof win?.__seekTo === "function") {
                      win.__seekTo(currentTime);
                    } else {
                      const tl = win?.__timelines?.["root"];
                      if (tl && typeof tl.seek === "function") {
                        tl.seek(currentTime, false);
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
