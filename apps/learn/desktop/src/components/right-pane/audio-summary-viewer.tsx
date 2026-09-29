import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  Loader2,
  Volume2,
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
import { ScrollArea, toast, cn } from "@const/ui";
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
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
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
    a.download = `${(data.title || "audio-summary").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(t("downloadingMp3Audio"));
  };

  const handleExplain = () => {
    if (!onExplainInChat) return;
    const prompt = t("explainAudioPrompt", { title: data.title || "", script: data.script.slice(0, 1500) });
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

  return (
    <div className="h-full flex flex-col bg-background text-foreground select-none">
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

      {/* Main Container */}
      <ScrollArea className="flex-1 w-full" viewportClassName="p-6 space-y-6">
        {/* Header Title Card */}
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-500 shrink-0">
                <AudioLines className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground tracking-tight">
                  {data.title || artifact.title}
                </h1>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {data.lengthMode === "short"
                      ? t("concise")
                      : data.lengthMode === "long"
                      ? t("inDepth")
                      : t("autoOption")}
                  </span>
                  {data.voiceId && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Mic className="h-3 w-3" />
                        {data.voiceId} {data.voiceModel ? `(${data.voiceModel})` : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Download Button */}
            {audioSrc ? (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-colors cursor-pointer"
                title={t("audioDownload")}
              >
                <Download className="h-3.5 w-3.5 text-indigo-500" />
                <span>{t("audioDownload")}</span>
              </button>
            ) : null}
          </div>

          {/* Missing Audio Warning & Retry */}
          {!audioSrc && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-300">
                    {t("audioNotReady")}
                  </p>
                  {audioError && (
                    <p className="text-[11px] text-amber-300/80 mt-0.5 font-sans">
                      {audioError}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRetryAudioSynthesis}
                disabled={isSynthesizing}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0 shadow-xs active:scale-95"
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

          {/* Audio Player Bar */}
          <div className="pt-3 border-t border-border/60 space-y-3">
            {/* Progress Bar */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                disabled={!audioSrc}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-40"
              />
              <div className="flex items-center justify-between text-[10.5px] font-sans tabular-nums text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Play / Pause button */}
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!audioSrc}
                  className="h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-md shadow-indigo-600/25 cursor-pointer active:scale-95"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 fill-white" />
                  ) : (
                    <Play className="h-4 w-4 fill-white ml-0.5" />
                  )}
                </button>

                {/* Rewind 10s */}
                <button
                  type="button"
                  onClick={handleRewind}
                  disabled={!audioSrc}
                  className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  title="Rewind 10s"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                {/* Speed Toggle */}
                <button
                  type="button"
                  onClick={handleChangeSpeed}
                  disabled={!audioSrc}
                  className="px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                  title={t("audioSpeed")}
                >
                  {playbackRate}x
                </button>
              </div>

              {/* Mute & Volume */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={!audioSrc}
                  className="h-8 w-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4 text-rose-500" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Script & Transcript Card */}
        <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-semibold text-foreground">
                {t("audioTranscript")}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyScript}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copied ? t("copied") : t("copyScript")}</span>
              </button>

              {onExplainInChat && (
                <button
                  type="button"
                  onClick={handleExplain}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>{t("askInChat")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Transcript Content */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 text-xs text-foreground/90 leading-relaxed font-sans whitespace-pre-wrap selection:bg-indigo-500/20">
            {data.script || t("noTranscriptAvailable")}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
