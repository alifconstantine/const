import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  AlertCircle,
  Loader2,
  Volume2,
  Volume1,
  VolumeX,
  Download,
  Copy,
  Check,
  Bot,
  AudioLines,
  Clock,
  Mic,
  FileText,
} from "lucide-react";
import { Button, ScrollArea, toast, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import { localDb, type LocalArtifact, type AudioSummaryData } from "../../lib/db";
import { getStoredVoiceConfig, synthesizeSpeechChunked } from "../../lib/voice";

export interface AudioSummaryViewerProps {
  artifact: LocalArtifact;
  data: AudioSummaryData;
  onExplainInChat?: (prompt: string) => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatVoiceDisplayName(voiceId?: string): string {
  if (!voiceId) return "";
  if (voiceId.includes("__")) {
    const parts = voiceId.split("__");
    const rawName = parts[parts.length - 1] || voiceId;
    return rawName
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return voiceId
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatVoiceModelName(model?: string): string {
  if (!model) return "";
  return model
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function AudioSummaryViewer({
  artifact,
  data,
  onExplainInChat,
}: AudioSummaryViewerProps) {
  const { t } = useI18n();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [transcriptViewMode, setTranscriptViewMode] = useState<"formatted" | "raw">("formatted");
  const [liveAudioSrc, setLiveAudioSrc] = useState<string>(
    data.audioUrl || data.audioBase64 || ""
  );
  const [audioError, setAudioError] = useState<string | undefined>(data.audioError);

  const audioSrc = liveAudioSrc;

  useEffect(() => {
    if (data.audioUrl || data.audioBase64) {
      setLiveAudioSrc(data.audioUrl || data.audioBase64 || "");
    }
    setAudioError(data.audioError);
  }, [data.audioUrl, data.audioBase64, data.audioError]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioSrc]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Audio playback failed:", err);
          toast.error(t("failedPlayAudio"));
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRewind = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
    setCurrentTime(audio.currentTime);
  };

  const handleForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxDuration = duration || audio.duration || 0;
    audio.currentTime = Math.min(maxDuration, audio.currentTime + 10);
    setCurrentTime(audio.currentTime);
  };

  const handleChangeSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextRate = SPEED_OPTIONS[(currentIndex + 1) % SPEED_OPTIONS.length] || 1;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !isMuted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      audioRef.current.muted = newVol === 0;
    }
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const handleCopyScript = () => {
    if (!data.script) return;
    navigator.clipboard.writeText(data.script);
    setCopied(true);
    toast.success(t("scriptCopiedClipboard"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!audioSrc) return;
    const a = document.createElement("a");
    a.href = audioSrc;
    a.download = `${(data.title || artifact.title || "audio-summary")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(t("downloadingMp3Audio"));
  };

  const handleExplain = () => {
    if (!onExplainInChat) return;
    const prompt = t("explainAudioPrompt", {
      title: data.title || artifact.title || "",
      script: data.script.slice(0, 1500),
    });
    onExplainInChat(prompt);
  };

  const handleRetryAudioSynthesis = async () => {
    if (!data.script?.trim()) {
      toast.error(t("scriptNotFound"));
      return;
    }

    const voiceConfig = getStoredVoiceConfig();
    const provider =
      voiceConfig.providers.find((p) => p.protocol === "inworld") ||
      voiceConfig.providers[0];

    if (!provider || !provider.apiKey?.trim()) {
      toast.error(t("inworldApiKeyRequired"));
      return;
    }

    setIsSynthesizing(true);
    try {
      toast.info(t("startingAudioSynthesis"));
      const synthRes = await synthesizeSpeechChunked({
        provider: {
          ...provider,
          model: data.voiceModel || provider.model || "inworld-tts-2",
          voice: data.voiceId || provider.voice || "Ashley",
        },
        text: data.script,
      });

      if (synthRes.success && (synthRes.audioUrl || synthRes.audioBase64)) {
        const newSrc = synthRes.audioUrl || synthRes.audioBase64 || "";
        setLiveAudioSrc(newSrc);
        setAudioError(undefined);

        const updatedData: AudioSummaryData = {
          ...data,
          audioUrl: synthRes.audioUrl,
          audioBase64: synthRes.audioBase64,
          audioError: undefined,
        };

        await localDb.updateArtifact(artifact.id, {
          data: updatedData,
          content: JSON.stringify(updatedData),
        });

        toast.success(t("audioSynthesizedReady"));
      } else {
        const errMsg = synthRes.error || "Synthesis failed";
        setAudioError(errMsg);
        toast.error(t("failedGenerateAudio", { error: errMsg }));
      }
    } catch (err: any) {
      const errMsg = err?.message || "Synthesis error";
      setAudioError(errMsg);
      toast.error(t("failedGenerateAudio", { error: errMsg }));
    } finally {
      setIsSynthesizing(false);
    }
  };

  const renderFormattedScript = (script: string) => {
    if (!script || !script.trim()) {
      return (
        <p className="text-sm text-muted-foreground italic">
          {t("noTranscriptAvailable")}
        </p>
      );
    }

    const paragraphs = script
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    return (
      <div className="space-y-4">
        {paragraphs.map((paragraph, idx) => {
          // Check if paragraph starts with tone tag e.g. [warmly], [thoughtful]
          const toneMatch = paragraph.match(/^\[([a-zA-Z]+)\]\s*/);
          const tone = toneMatch ? toneMatch[1] : null;
          const remainingText = toneMatch ? paragraph.slice(toneMatch[0].length) : paragraph;

          // Split remaining text by pause indicators e.g. [pause: 500ms]
          const parts = remainingText.split(/(\[pause(?::\s*[^\]]+)?\])/gi);

          return (
            <p
              key={idx}
              className="text-sm leading-relaxed text-foreground font-sans select-text"
            >
              {tone && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary border border-border/70 text-[10.5px] font-sans font-medium text-muted-foreground uppercase tracking-wider mr-2 select-none align-middle shadow-2xs">
                  {tone}
                </span>
              )}
              {parts.map((part, pIdx) => {
                const pauseMatch = part.match(/\[pause(?::\s*([^\]]+))?\]/i);
                if (pauseMatch) {
                  const pauseTime = pauseMatch[1] || "";
                  return (
                    <span
                      key={pIdx}
                      className="inline-flex items-center px-1.5 py-0.5 mx-1 rounded bg-secondary/60 border border-border/50 text-[10.5px] font-mono text-muted-foreground select-none align-middle"
                      title={`Pause ${pauseTime}`}
                    >
                      ⏸ {pauseTime || "pause"}
                    </span>
                  );
                }
                return <React.Fragment key={pIdx}>{part}</React.Fragment>;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground select-none font-sans overflow-hidden">
      {/* Audio element */}
      {audioSrc ? (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      ) : null}

      {/* Main Container with generous spacing and max-w constraint */}
      <ScrollArea className="flex-1 w-full min-h-0 bg-background">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Header Title & Audio Player Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xs space-y-5">
            {/* Top Row: Icon, Title, Metadata & Download Button */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground shrink-0 shadow-2xs mt-0.5">
                  <AudioLines className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-snug line-clamp-2">
                    {data.title || artifact.title}
                  </h1>
                  <div className="flex items-center flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-secondary/80 border border-border/60 text-[11px] font-sans">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>
                        {data.lengthMode === "short"
                          ? t("concise")
                          : data.lengthMode === "long"
                          ? t("inDepth")
                          : t("autoOption")}
                      </span>
                    </span>

                    {data.voiceId && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-secondary/80 border border-border/60 text-[11px] font-sans"
                        title={data.voiceId}
                      >
                        <Mic className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {formatVoiceDisplayName(data.voiceId)}
                          {data.voiceModel ? ` (${formatVoiceModelName(data.voiceModel)})` : ""}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Download Button */}
              {audioSrc ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="h-9 px-3.5 rounded-xl border-border bg-secondary/50 hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer shrink-0 whitespace-nowrap gap-2 shadow-none self-start"
                  title={t("audioDownload")}
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{t("audioDownload")}</span>
                </Button>
              ) : null}
            </div>

            {/* Missing Audio Warning & Retry */}
            {!audioSrc && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-300">
                      {t("audioNotReady")}
                    </p>
                    {audioError && (
                      <p className="text-[11px] text-amber-300/80 mt-0.5 font-sans leading-relaxed">
                        {audioError}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRetryAudioSynthesis}
                  disabled={isSynthesizing}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0 shadow-xs active:scale-95 whitespace-nowrap"
                >
                  {isSynthesizing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{t("synthesizingAudio")}</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>{t("synthesizeAudioNow")}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Audio Player Console Deck */}
            <div className="rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5 space-y-4">
              {/* Progress Bar & Timestamps */}
              <div className="space-y-1.5">
                <div className="relative flex items-center group py-1">
                  {/* Background Track */}
                  <div className="h-1.5 w-full bg-secondary/80 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-foreground transition-all duration-75"
                      style={{
                        width: `${duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                  {/* Invisible native range slider for smooth touch & click interaction */}
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    disabled={!audioSrc}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                    aria-label="Seek audio"
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-sans tabular-nums text-muted-foreground px-0.5">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls Row */}
              <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
                {/* Left: Playback controls */}
                <div className="flex items-center gap-2.5">
                  {/* Rewind 10s */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRewind}
                    disabled={!audioSrc}
                    className="h-8 w-8 p-0 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                    title="Rewind 10s"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>

                  {/* Play / Pause - high contrast tactile studio button */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={!audioSrc}
                    className="h-10 w-10 rounded-full bg-foreground text-background hover:opacity-90 active:scale-95 disabled:opacity-40 flex items-center justify-center transition-all cursor-pointer shadow-xs"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Forward 10s */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleForward}
                    disabled={!audioSrc}
                    className="h-8 w-8 p-0 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                    title="Forward 10s"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>

                  {/* Playback rate pill */}
                  <button
                    type="button"
                    onClick={handleChangeSpeed}
                    disabled={!audioSrc}
                    className="h-8 px-2.5 rounded-xl bg-secondary/70 hover:bg-secondary border border-border/50 text-[11px] font-medium text-foreground transition-colors cursor-pointer tabular-nums disabled:opacity-40 ml-1"
                    title={t("audioSpeed")}
                  >
                    {playbackRate}x
                  </button>
                </div>

                {/* Right: Volume & Mute */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMute}
                    disabled={!audioSrc}
                    className="h-8 w-8 p-0 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4 text-rose-400" />
                    ) : volume < 0.5 ? (
                      <Volume1 className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    disabled={!audioSrc}
                    className="w-16 sm:w-20 h-1 bg-secondary rounded-full appearance-none cursor-pointer accent-foreground disabled:opacity-40"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Script & Transcript Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            {/* Header with Title and Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground tracking-tight">
                  {t("audioTranscript")}
                </h3>
              </div>

              {/* View Switcher, Copy, and Ask In Chat Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Formatted vs Raw Segmented Switcher */}
                <div className="flex items-center p-0.5 rounded-xl bg-secondary/70 border border-border/60">
                  <button
                    type="button"
                    onClick={() => setTranscriptViewMode("formatted")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                      transcriptViewMode === "formatted"
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Formatted
                  </button>
                  <button
                    type="button"
                    onClick={() => setTranscriptViewMode("raw")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                      transcriptViewMode === "raw"
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Raw Script
                  </button>
                </div>

                {/* Copy Script Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyScript}
                  className="h-8 px-2.5 rounded-xl border-border bg-secondary/40 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer shadow-none"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copied ? t("copied") : t("copyScript")}</span>
                </Button>

                {/* Ask in Chat Button */}
                {onExplainInChat && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExplain}
                    className="h-8 px-2.5 rounded-xl border-border bg-secondary/40 hover:bg-secondary text-xs text-foreground gap-1.5 cursor-pointer shadow-none"
                  >
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    <span>{t("askInChat")}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Transcript Content Box */}
            {transcriptViewMode === "formatted" ? (
              <div className="p-4 sm:p-5 rounded-xl bg-secondary/20 border border-border/40 select-text">
                {renderFormattedScript(data.script)}
              </div>
            ) : (
              <pre className="p-4 sm:p-5 rounded-xl bg-secondary/20 border border-border/40 text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap select-text overflow-x-auto">
                {data.script || t("noTranscriptAvailable")}
              </pre>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
