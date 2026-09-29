import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  AudioLines,
  Check,
  FileText,
  AlertCircle,
  ArrowRight,
  Settings,
  Volume2,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";
import {
  getStoredVoiceConfig,
  INWORLD_MODELS,
  POPULAR_INWORLD_VOICES,
  getCachedVoices,
} from "../../lib/voice";

export interface CreateAudioSummarySheetProps {
  open: boolean;
  onClose: () => void;
  sources: LocalSource[];
  onGenerate: (options: {
    type: "audio_summary";
    topic: string;
    lengthMode: "short" | "long" | "auto";
    customPrompt?: string;
    voiceModel: string;
    voiceId: string;
    language: string;
    selectedSourceIds: string[];
  }) => void;
  onOpenModelsSettings?: () => void;
}

const LANGUAGE_OPTIONS = [
  { id: "id-ID", label: "Bahasa Indonesia (id-ID)" },
  { id: "en-US", label: "English (US) (en-US)" },
  { id: "en-GB", label: "English (UK) (en-GB)" },
  { id: "ja-JP", label: "Japanese (ja-JP)" },
  { id: "ko-KR", label: "Korean (ko-KR)" },
  { id: "zh-CN", label: "Chinese (zh-CN)" },
];

export function CreateAudioSummarySheet({
  open,
  onClose,
  sources = [],
  onGenerate,
  onOpenModelsSettings,
}: CreateAudioSummarySheetProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [topic, setTopic] = useState("");
  const [lengthMode, setLengthMode] = useState<"short" | "long" | "auto">("auto");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );

  // Voice state
  const [voiceModel, setVoiceModel] = useState("inworld-tts-2");
  const [voiceId, setVoiceId] = useState("Ashley");
  const [audioLanguage, setAudioLanguage] = useState(isIndo ? "id-ID" : "en-US");

  // Read stored voice config
  const voiceConfig = useMemo(() => getStoredVoiceConfig(), [open]);
  const inworldProvider = useMemo(
    () => voiceConfig.providers.find((p) => p.protocol === "inworld") || voiceConfig.providers[0],
    [voiceConfig]
  );
  const hasInworldKey = Boolean(inworldProvider?.apiKey?.trim());

  const availableVoices = useMemo(() => {
    if (!hasInworldKey) return [];
    const cached = getCachedVoices();
    if (cached.length > 0) return cached;
    return POPULAR_INWORLD_VOICES;
  }, [hasInworldKey]);

  const availableModels = useMemo(() => {
    if (!hasInworldKey) return [];
    return INWORLD_MODELS;
  }, [hasInworldKey]);

  useEffect(() => {
    if (open) {
      setSelectedSourceIds(sources.map((s) => s.id));
      if (inworldProvider) {
        if (inworldProvider.model) setVoiceModel(inworldProvider.model);
        if (inworldProvider.voice) setVoiceId(inworldProvider.voice);
      }
      setAudioLanguage(isIndo ? "id-ID" : "en-US");
    }
  }, [open, sources, inworldProvider, isIndo]);

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleToggleAllSources = () => {
    if (selectedSourceIds.length === sources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasInworldKey) {
      if (onOpenModelsSettings) {
        onClose();
        onOpenModelsSettings();
      }
      return;
    }

    onGenerate({
      type: "audio_summary",
      topic: topic.trim(),
      lengthMode,
      customPrompt: customPrompt.trim(),
      voiceModel,
      voiceId,
      language: audioLanguage,
      selectedSourceIds:
        selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[60] max-h-[92dvh] bg-[#1a1a1c] text-[#ededed]",
          "border-t border-[#333336] rounded-t-[28px] shadow-2xl flex flex-col font-sans",
          "animate-in slide-in-from-bottom duration-300 ease-out select-none"
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Swipe Pill / Header */}
        <div className="pt-3 pb-2 px-4 flex flex-col items-center border-b border-[#2d2d30] shrink-0 bg-[#202022] rounded-t-[28px]">
          <div className="w-10 h-1 rounded-full bg-[#444448] mb-2" />
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#242335] border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <AudioLines className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {t("audioSummarizeTitle")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-full bg-[#2a2a2d] hover:bg-[#38383c] text-[#969696] hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Concept Explanation Card */}
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2.5 text-indigo-200/90 leading-relaxed">
            <AudioLines className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-[11.5px]">{t("audioSummarizeSubtitle")}</div>
          </div>

          {/* Sources Scope Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                {isIndo ? "Pilih Sumber Acuan" : "Reference Sources"}
              </label>
              <button
                type="button"
                onClick={handleToggleAllSources}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                {selectedSourceIds.length === sources.length
                  ? isIndo
                    ? "Batal Pilih Semua"
                    : "Deselect All"
                  : isIndo
                  ? "Pilih Semua"
                  : "Select All"}
              </button>
            </div>

            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {sources.map((source) => {
                const isSelected = selectedSourceIds.includes(source.id);
                return (
                  <div
                    key={source.id}
                    onClick={() => handleToggleSource(source.id)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer active:scale-[0.99]",
                      isSelected
                        ? "bg-indigo-950/30 border-indigo-500/40 text-white"
                        : "bg-[#212124] border-[#2e2e33] text-[#8e8e93]"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate text-xs font-medium">{source.title}</span>
                    </div>
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-[#48484a] bg-transparent"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Length Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
              {isIndo ? "Panjang & Kedalaman" : "Summary Length"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: "short",
                  label: t("audioLengthRingkas"),
                  desc: t("audioLengthRingkasDesc"),
                },
                {
                  id: "long",
                  label: t("audioLengthPanjang"),
                  desc: t("audioLengthPanjangDesc"),
                },
                {
                  id: "auto",
                  label: t("audioLengthAuto"),
                  desc: t("audioLengthAutoDesc"),
                },
              ].map((opt) => {
                const isSelected = lengthMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLengthMode(opt.id as any)}
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between active:scale-95",
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500 text-white"
                        : "bg-[#212124] border-[#2e2e33] text-[#8e8e93]"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-semibold">{opt.label}</span>
                      {isSelected && <Check className="h-3 w-3 text-indigo-400" />}
                    </div>
                    <p className="text-[9.5px] text-[#777777] leading-tight line-clamp-2">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Instruction */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
              {t("audioCustomPromptLabel")}
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={t("audioCustomPromptPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#141416] border border-[#28282d] focus:border-indigo-500/80 focus:outline-none text-xs text-white placeholder:text-[#666666] resize-none"
            />
          </div>

          {/* Voice Configuration */}
          <div className="p-3 rounded-xl bg-[#212124] border border-[#2e2e33] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-white">
                  {isIndo ? "Suara Inworld TTS" : "Inworld TTS Voice"}
                </span>
              </div>
              {hasInworldKey ? (
                <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {isIndo ? "Aktif" : "Active"}
                </span>
              ) : (
                <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {isIndo ? "Belum Ada Key" : "No API Key"}
                </span>
              )}
            </div>

            {!hasInworldKey && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-start gap-1.5 text-[11px] text-amber-300/90 leading-tight">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t("audioNoApiKeyNotice")}</span>
                </div>
                {onOpenModelsSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenModelsSettings();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium cursor-pointer transition-colors"
                  >
                    <Settings className="h-3 w-3" />
                    <span>{t("audioOpenModelsSettings")}</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </button>
                )}
              </div>
            )}

            {/* Dropdowns */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-[#888888] font-medium">
                  {t("audioVoiceModel")}
                </label>
                <select
                  disabled={!hasInworldKey}
                  value={voiceModel}
                  onChange={(e) => setVoiceModel(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-[#151517] border border-[#2e2e33] text-xs text-white disabled:opacity-40"
                >
                  {availableModels.length === 0 ? (
                    <option value="">{isIndo ? "Tidak ada model" : "No models"}</option>
                  ) : (
                    availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[#888888] font-medium">
                  {t("audioVoiceId")}
                </label>
                <select
                  disabled={!hasInworldKey}
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-[#151517] border border-[#2e2e33] text-xs text-white disabled:opacity-40"
                >
                  {availableVoices.length === 0 ? (
                    <option value="">{isIndo ? "Tidak ada suara" : "No voices"}</option>
                  ) : (
                    availableVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.gender ? `(${v.gender})` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-[#888888] font-medium">
                {t("audioLanguage")}
              </label>
              <select
                disabled={!hasInworldKey}
                value={audioLanguage}
                onChange={(e) => setAudioLanguage(e.target.value)}
                className="w-full h-8 px-2 rounded-lg bg-[#151517] border border-[#2e2e33] text-xs text-white disabled:opacity-40"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-2 pb-1">
            <button
              type="submit"
              disabled={!hasInworldKey || sources.length === 0}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
            >
              <AudioLines className="h-4 w-4" />
              <span>{isIndo ? "Buat Ringkasan Audio" : "Generate Audio Summary"}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
