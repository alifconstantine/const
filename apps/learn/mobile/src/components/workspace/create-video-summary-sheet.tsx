import React, { useState, useEffect, useMemo } from "react";
import {
  Video,
  X,
  Check,
  ChevronDown,
  Volume2,
  FileText,
  AlertCircle,
  Sliders,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import {
  getStoredVoiceConfig,
  INWORLD_MODELS,
  POPULAR_INWORLD_VOICES,
} from "../../lib/voice/service";
import type { LocalSource } from "../../lib/db";

export interface CreateVideoSummarySheetProps {
  open: boolean;
  onClose: () => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    coverageMode: "auto" | "long";
    language: "id" | "en";
    audioLanguage: string;
    voiceProviderId: string;
    voiceModel: string;
    voiceId: string;
    voiceName: string;
    deliveryMode?: string;
    speed?: number;
    customInstructions?: string;
  }) => void;
  onOpenSettings?: () => void;
}

export const INWORLD_SUPPORTED_LANGUAGES = [
  { id: "id-ID", label: "Bahasa Indonesia (id-ID)" },
  { id: "en-US", label: "English (US) (en-US)" },
  { id: "en-GB", label: "English (UK) (en-GB)" },
  { id: "ja-JP", label: "Japanese (日本語)" },
  { id: "ko-KR", label: "Korean (한국어)" },
  { id: "zh-CN", label: "Chinese (中文)" },
  { id: "es-ES", label: "Spanish (Español)" },
  { id: "fr-FR", label: "French (Français)" },
  { id: "de-DE", label: "German (Deutsch)" },
  { id: "ar-SA", label: "Arabic (العربية)" },
];

export function CreateVideoSummarySheet({
  open,
  onClose,
  sources = [],
  onGenerate,
  onOpenSettings,
}: CreateVideoSummarySheetProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );
  const [coverageMode, setCoverageMode] = useState<"auto" | "long">("auto");
  const [voiceModel, setVoiceModel] = useState<string>("inworld-tts-2");
  const [voiceId, setVoiceId] = useState<string>("Ashley");
  const [audioLanguage, setAudioLanguage] = useState<string>(
    isIndo ? "id-ID" : "en-US"
  );
  const [speed, setSpeed] = useState<number>(1.0);
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Check Inworld TTS configuration from stored voice config
  const voiceConfig = useMemo(() => getStoredVoiceConfig(), [open]);
  const inworldProvider = voiceConfig.providers.find(
    (p) => p.protocol === "inworld" || p.id === "inworld"
  );
  const hasInworldKey = Boolean(inworldProvider?.apiKey?.trim());

  useEffect(() => {
    if (open) {
      setSelectedSourceIds(sources.map((s) => s.id));
      if (inworldProvider) {
        if (inworldProvider.voice) setVoiceId(inworldProvider.voice);
        if (inworldProvider.model) setVoiceModel(inworldProvider.model);
        if (inworldProvider.speed) setSpeed(inworldProvider.speed);
      }
    }
  }, [open, sources, inworldProvider]);

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
    if (selectedSourceIds.length === 0) return;

    onGenerate({
      selectedSourceIds,
      coverageMode,
      language: isIndo ? "id" : "en",
      audioLanguage,
      voiceProviderId: "inworld",
      voiceModel,
      voiceId,
      voiceName: voiceId,
      speed,
      customInstructions: customInstructions.trim() || undefined,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[60] max-h-[92vh] flex flex-col rounded-t-3xl bg-[#161616] text-[#e0e0e0] border-t border-[#262626] shadow-2xl animate-in slide-in-from-bottom duration-300 select-none pb-safe">
        {/* Handle Bar */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#242424] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Video className="h-4 w-4 shrink-0" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {isIndo ? "Buat Ringkasan Video" : "Create Video Summary"}
              </h2>
              <p className="text-[11px] text-[#888]">
                {isIndo
                  ? "Sintesis video naratif dengan Inworld TTS & HyperFrames"
                  : "Synthesize narrative video with Inworld TTS & HyperFrames"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#888] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Missing API Key Alert */}
          {!hasInworldKey && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-amber-200">
                  {isIndo ? "API Key Inworld TTS Diperlukan" : "Inworld TTS API Key Required"}
                </div>
                <div className="text-[11px] text-amber-300/90 leading-relaxed">
                  {isIndo
                    ? "Ringkasan video menggunakan Inworld TTS untuk narasi suara berkualitas tinggi. Silakan masukkan API Key di Pengaturan."
                    : "Video summaries require Inworld TTS for high quality voice narration. Please configure your API key in Settings."}
                </div>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-medium transition-colors"
                  >
                    <Settings className="w-3 h-3" />
                    <span>{isIndo ? "Buka Pengaturan Suara" : "Open Voice Settings"}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sources Multi-Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#888]" />
                <span>{isIndo ? "Sumber Pembelajaran" : "Study Sources"}</span>
              </label>
              {sources.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllSources}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  {selectedSourceIds.length === sources.length
                    ? isIndo
                      ? "Batalkan Semua"
                      : "Deselect All"
                    : isIndo
                    ? "Pilih Semua"
                    : "Select All"}
                </button>
              )}
            </div>

            {sources.length === 0 ? (
              <div className="p-3 rounded-xl bg-[#1c1c1c] border border-[#262626] text-xs text-[#777] text-center">
                {isIndo
                  ? "Belum ada sumber materi. Tambahkan materi terlebih dahulu."
                  : "No sources found. Please add study materials first."}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {sources.map((s) => {
                  const isChecked = selectedSourceIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleToggleSource(s.id)}
                      className={cn(
                        "flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all",
                        isChecked
                          ? "bg-white/[0.06] border-emerald-500/40 text-white"
                          : "bg-[#181818] border-[#242424] text-[#888] hover:border-[#333]"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                          isChecked
                            ? "bg-emerald-500 border-emerald-500 text-black"
                            : "border-[#444] bg-[#222]"
                        )}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate flex-1 font-medium">{s.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coverage Depth Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/90">
              {isIndo ? "Cakupan Materi Video" : "Coverage Depth"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCoverageMode("auto")}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all",
                  coverageMode === "auto"
                    ? "bg-white/[0.08] border-emerald-500/50 text-white shadow-xs"
                    : "bg-[#181818] border-[#262626] text-[#888] hover:border-[#333]"
                )}
              >
                <div className="font-semibold text-xs text-white">
                  {isIndo ? "Adaptif (4-7 Scene)" : "Adaptive (4-7 Scenes)"}
                </div>
                <div className="text-[10.5px] text-[#888] mt-0.5 leading-tight">
                  {isIndo ? "Ringkas & to-the-point" : "Balanced & concise"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCoverageMode("long")}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all",
                  coverageMode === "long"
                    ? "bg-white/[0.08] border-emerald-500/50 text-white shadow-xs"
                    : "bg-[#181818] border-[#262626] text-[#888] hover:border-[#333]"
                )}
              >
                <div className="font-semibold text-xs text-white">
                  {isIndo ? "Mendalam (7-10 Scene)" : "In-Depth (7-10 Scenes)"}
                </div>
                <div className="text-[10.5px] text-[#888] mt-0.5 leading-tight">
                  {isIndo ? "Komprehensif & detail" : "Detailed walkthrough"}
                </div>
              </button>
            </div>
          </div>

          {/* Voice Character & Persona */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/90 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-[#888]" />
                <span>{isIndo ? "Karakter Suara Narator" : "Narrator Voice"}</span>
              </span>
              <span className="text-[10.5px] text-[#777]">Inworld TTS</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_INWORLD_VOICES.map((v) => {
                const isSelected = voiceId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoiceId(v.id)}
                    className={cn(
                      "p-2 rounded-xl border text-left transition-all flex items-center justify-between",
                      isSelected
                        ? "bg-white/[0.08] border-emerald-500/50 text-white"
                        : "bg-[#181818] border-[#262626] text-[#888] hover:border-[#333]"
                    )}
                  >
                    <div>
                      <div className="font-semibold text-xs text-white">{v.name}</div>
                      <div className="text-[10px] text-[#777]">
                        {v.gender} • {v.id === "Ashley" || v.id === "Olivia" ? "Ramah" : "Jelas"}
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Collapsible (Model, Language, Speed) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] text-[#888] hover:text-white transition-colors"
            >
              <Sliders className="w-3 h-3" />
              <span>{isIndo ? "Opsi Lanjutan (Model & Bahasa)" : "Advanced (Model & Language)"}</span>
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform duration-200",
                  showAdvanced && "rotate-180"
                )}
              />
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3 rounded-xl bg-[#181818] border border-[#242424] space-y-3 animate-in fade-in">
                {/* Voice Model */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#aaa]">
                    {isIndo ? "Model Audio" : "Voice Model"}
                  </label>
                  <select
                    value={voiceModel}
                    onChange={(e) => setVoiceModel(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[#222] border border-[#333] text-white focus:outline-none focus:border-emerald-500"
                  >
                    {INWORLD_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.badge})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Audio Language */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#aaa]">
                    {isIndo ? "Bahasa Narasi" : "Audio Language"}
                  </label>
                  <select
                    value={audioLanguage}
                    onChange={(e) => setAudioLanguage(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[#222] border border-[#333] text-white focus:outline-none focus:border-emerald-500"
                  >
                    {INWORLD_SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speaking Speed */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-[#aaa]">
                    <span>{isIndo ? "Kecepatan Bicara" : "Speaking Speed"}</span>
                    <span>{speed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.75}
                    max={1.5}
                    step={0.05}
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-[#333] rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Custom User Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/90">
              {isIndo ? "Instruksi Tambahan (Opsional)" : "Custom Guidance (Optional)"}
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={
                isIndo
                  ? "Contoh: Fokuskan pada analogi sederhana, tekankan rumus di scene 2..."
                  : "e.g. Focus on simple analogies, emphasize key definitions..."
              }
              rows={2}
              className="w-full text-xs px-3 py-2 rounded-xl bg-[#181818] border border-[#262626] text-white placeholder:text-[#555] focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0 || !hasInworldKey}
              className={cn(
                "w-full py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                selectedSourceIds.length > 0 && hasInworldKey
                  ? "bg-white text-black hover:bg-white/90 active:scale-[0.99] shadow-lg shadow-white/5"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {selectedSourceIds.length === 0
                  ? isIndo
                    ? "Pilih Minimal 1 Sumber"
                    : "Select at least 1 source"
                  : !hasInworldKey
                  ? isIndo
                    ? "Konfigurasi Inworld API Key Dulu"
                    : "Configure Inworld API Key first"
                  : isIndo
                  ? "Mulai Buat Ringkasan Video"
                  : "Generate Video Summary"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
