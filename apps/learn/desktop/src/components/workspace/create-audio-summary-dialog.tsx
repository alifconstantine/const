import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  AudioLines,
  Check,
  ChevronDown,
  FileText,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Settings,
  Volume2,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";
import {
  getStoredVoiceConfig,
  INWORLD_MODELS,
  POPULAR_INWORLD_VOICES,
  getCachedVoices,
} from "../../lib/voice";

export interface CreateAudioSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function CreateAudioSummaryDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
  onOpenModelsSettings,
}: CreateAudioSummaryDialogProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [topic, setTopic] = useState("");
  const [lengthMode, setLengthMode] = useState<"short" | "long" | "auto">("auto");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

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

  // Cached and popular voices
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

  // Sync initial selections
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources]);

  useEffect(() => {
    if (inworldProvider) {
      if (inworldProvider.model) setVoiceModel(inworldProvider.model);
      if (inworldProvider.voice) setVoiceId(inworldProvider.voice);
    }
    setAudioLanguage(isIndo ? "id-ID" : "en-US");
  }, [inworldProvider, isIndo, open]);

  const handleToggleSource = (sourceId: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    );
  };

  const handleSelectAllSources = () => {
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
        onOpenChange(false);
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] p-0 bg-[#19191b] border border-[#2e2e33] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#28282d] bg-[#1d1d21]">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#242335] border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <AudioLines className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">
              {t("audioSummarizeTitle")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 rounded-lg hover:bg-white/10 text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Concept Explanation Box */}
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
            <AudioLines className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-200/90 leading-relaxed">
              {t("audioSummarizeSubtitle")}
            </div>
          </div>

          {/* Sumber Dropdown */}
          <div className="space-y-1.5 relative">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo ? "Sumber Rujukan Materi" : "Source Material Scope"}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                className="w-full h-9 px-3 rounded-xl bg-[#141416] border border-[#28282d] hover:border-[#38383e] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
              >
                <span className="text-white font-medium truncate">
                  {selectedSourceIds.length === sources.length
                    ? isIndo
                      ? `Semua sumber (${sources.length} sumber)`
                      : `All sources (${sources.length})`
                    : isIndo
                    ? `${selectedSourceIds.length} dari ${sources.length} sumber terpilih`
                    : `${selectedSourceIds.length} of ${sources.length} sources selected`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#888888] shrink-0" />
              </button>

              {isSourceDropdownOpen && (
                <div className="absolute top-full mt-1.5 left-0 right-0 z-30 bg-[#1a1a1d] border border-[#333338] rounded-xl p-2 shadow-2xl">
                  <ScrollArea className="max-h-48 w-full" viewportClassName="space-y-1 pr-1">
                    <button
                      type="button"
                      onClick={handleSelectAllSources}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-xs text-[#cccccc] cursor-pointer transition-colors"
                    >
                      <span className="font-medium">
                        {isIndo ? "Pilih Semua Sumber" : "Select All Sources"}
                      </span>
                      <div
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                          selectedSourceIds.length === sources.length
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-[#444449] bg-transparent"
                        )}
                      >
                        {selectedSourceIds.length === sources.length && (
                          <Check className="h-3 w-3 stroke-[3]" />
                        )}
                      </div>
                    </button>
                    <div className="h-[1px] bg-[#28282d] my-1" />

                    {sources.map((src) => {
                      const isSelected = selectedSourceIds.includes(src.id);
                      return (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => handleToggleSource(src.id)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-xs text-left cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <FileText className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                            <span className="truncate text-[#e0e0e0]">{src.title}</span>
                          </div>
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0",
                              isSelected
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-[#444449] bg-transparent"
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {/* Length Options: Ringkas, Panjang, Auto */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo ? "Panjang & Kedalaman Ringkasan" : "Summary Length & Depth"}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
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
                      "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500/80 text-white shadow-sm"
                        : "bg-[#141416] border-[#28282d] hover:border-[#38383e] text-[#a0a0a0] hover:text-[#e0e0e0]"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{opt.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                      </div>
                      <p className="text-[10px] text-[#888888] leading-tight line-clamp-2">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Instruction Input (Optional) */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {t("audioCustomPromptLabel")}
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={t("audioCustomPromptPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#141416] border border-[#28282d] hover:border-[#38383e] focus:border-indigo-500/80 focus:outline-none text-xs text-white placeholder:text-[#666666] resize-none transition-colors"
            />
          </div>

          {/* Voice Configuration Section */}
          <div className="p-3.5 rounded-xl bg-[#141416] border border-[#28282d] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-semibold text-white">
                  {isIndo ? "Konfigurasi Suara (Inworld TTS)" : "Voice Configuration (Inworld TTS)"}
                </span>
              </div>
              {hasInworldKey ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {isIndo ? "API Key Terhubung" : "API Key Connected"}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {isIndo ? "Belum Dikonfigurasi" : "Not Configured"}
                </span>
              )}
            </div>

            {!hasInworldKey ? (
              /* Notice when Inworld API Key is missing: Dropdowns have 0 options / disabled */
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-amber-300/90 leading-relaxed">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t("audioNoApiKeyNotice")}</span>
                </div>
                {onOpenModelsSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenModelsSettings();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium cursor-pointer transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>{t("audioOpenModelsSettings")}</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </button>
                )}
              </div>
            ) : null}

            {/* Dropdowns */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Voice Model */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-medium text-[#888888]">
                  {t("audioVoiceModel")}
                </label>
                <select
                  disabled={!hasInworldKey}
                  value={voiceModel}
                  onChange={(e) => setVoiceModel(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-[#1a1a1d] border border-[#2e2e33] text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-indigo-500"
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

              {/* Voice ID */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-medium text-[#888888]">
                  {t("audioVoiceId")}
                </label>
                <select
                  disabled={!hasInworldKey}
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-[#1a1a1d] border border-[#2e2e33] text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-indigo-500"
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

              {/* Audio Language */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-medium text-[#888888]">
                  {t("audioLanguage")}
                </label>
                <select
                  disabled={!hasInworldKey}
                  value={audioLanguage}
                  onChange={(e) => setAudioLanguage(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-[#1a1a1d] border border-[#2e2e33] text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-indigo-500"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#28282d]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 text-xs text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!hasInworldKey || sources.length === 0}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isIndo ? "Buat Ringkasan Audio" : "Generate Audio Summary"}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
