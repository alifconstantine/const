import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  AudioLines,
  Check,
  ChevronDown,
  Volume2,
  FileText,
  AlertCircle,
  ArrowRight,
  Settings,
  Search,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import {
  getStoredVoiceConfig,
  INWORLD_MODELS,
  POPULAR_INWORLD_VOICES,
  getCachedVoices,
} from "../../lib/voice";
import { INWORLD_SUPPORTED_LANGUAGES } from "./create-video-summary-dialog";
import type { LocalSource } from "../../lib/db";

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
    deliveryMode?: string;
    speed?: number;
  }) => void;
  onOpenSettings?: () => void;
  onOpenModelsSettings?: () => void;
}

type ActiveDropdown =
  | "source"
  | "coverage"
  | "model"
  | "voice"
  | "language"
  | "delivery"
  | "speed"
  | null;

export function CreateAudioSummaryDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
  onOpenSettings,
  onOpenModelsSettings,
}: CreateAudioSummaryDialogProps) {
  const { t, language } = useI18n();

  // Sources selection
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Coverage / Length depth: "auto" | "short" | "long"
  const [lengthMode, setLengthMode] = useState<"short" | "long" | "auto">("auto");

  // Voice state
  const [voiceModel, setVoiceModel] = useState<string>("inworld-tts-2");
  const [voiceId, setVoiceId] = useState<string>("Ashley");
  const [audioLanguage, setAudioLanguage] = useState<string>(language === "id" ? "id-ID" : "en-US");
  const [deliveryMode, setDeliveryMode] = useState<string>("BALANCED");
  const [speed, setSpeed] = useState<number>(1.0);

  // Search queries for dropdowns
  const [voiceSearch, setVoiceSearch] = useState<string>("");
  const [languageSearch, setLanguageSearch] = useState<string>("");

  // Track which custom studio dropdown is currently open
  const [openDropdown, setOpenDropdown] = useState<ActiveDropdown>(null);

  // Optional custom instructions
  const [customPrompt, setCustomPrompt] = useState<string>("");

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-studio-dropdown]")) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openDropdown]);

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

  const isModelSelected = Boolean(voiceModel && voiceModel.trim().length > 0);
  const isInworldModel = voiceModel.startsWith("inworld");
  const isTts2Model = voiceModel === "inworld-tts-2" || voiceModel === "inworld-tts-2-flash";

  // Filter voices by search query
  const filteredVoices = useMemo(() => {
    if (!voiceSearch.trim()) return availableVoices;
    const q = voiceSearch.toLowerCase().trim();
    return availableVoices.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        (v.gender && v.gender.toLowerCase().includes(q)) ||
        (v.description && v.description.toLowerCase().includes(q))
    );
  }, [availableVoices, voiceSearch]);

  // Filter languages by search query
  const filteredLanguages = useMemo(() => {
    if (!languageSearch.trim()) return INWORLD_SUPPORTED_LANGUAGES;
    const q = languageSearch.toLowerCase().trim();
    return INWORLD_SUPPORTED_LANGUAGES.filter(
      (l) => l.label.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
    );
  }, [languageSearch]);

  // Reset dropdown and search states when dialog closes
  useEffect(() => {
    if (!open) {
      setOpenDropdown(null);
      setVoiceSearch("");
      setLanguageSearch("");
    }
  }, [open]);

  // When model is changed, sync voice ID default if not present
  useEffect(() => {
    if (isModelSelected && !voiceId && availableVoices.length > 0) {
      setVoiceId(availableVoices[0]?.id || "Ashley");
    }
  }, [voiceModel, availableVoices, voiceId, isModelSelected]);

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
    setAudioLanguage(language === "id" ? "id-ID" : "en-US");
  }, [inworldProvider, language, open]);

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

  const handleOpenSettingsAction = () => {
    onOpenChange(false);
    if (onOpenModelsSettings) {
      onOpenModelsSettings();
    } else if (onOpenSettings) {
      onOpenSettings();
    }
  };

  const suggestionChips = useMemo(() => {
    return [
      t("videoSuggestEssential"),
      t("videoSuggestCasual"),
      t("videoSuggestAnalogies"),
      t("videoSuggestComparative"),
    ];
  }, [t]);

  const handleApplySuggestion = (chipText: string) => {
    const cleanText = chipText.replace(/^\+\s*/, "");
    if (!customPrompt.trim()) {
      setCustomPrompt(cleanText);
    } else {
      setCustomPrompt((prev) => `${prev}. ${cleanText}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSourceIds.length === 0) return;

    if (!hasInworldKey) {
      handleOpenSettingsAction();
      return;
    }

    onGenerate({
      type: "audio_summary",
      topic: "",
      lengthMode,
      customPrompt: customPrompt.trim() || undefined,
      voiceModel,
      voiceId,
      language: audioLanguage,
      selectedSourceIds:
        selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
      deliveryMode: isTts2Model ? deliveryMode : undefined,
      speed,
    });

    onOpenChange(false);
  };

  // Helper labels
  const selectedVoiceObj = availableVoices.find((v) => v.id === voiceId);
  const selectedVoiceDisplay = selectedVoiceObj
    ? `${selectedVoiceObj.name}${selectedVoiceObj.gender ? ` (${selectedVoiceObj.gender})` : ""}`
    : voiceId || t("videoSelectVoicePrompt");

  const selectedModelObj = availableModels.find((m) => m.id === voiceModel);
  const selectedModelDisplay = selectedModelObj?.name || voiceModel || t("videoSelectModelPrompt");

  const selectedLangObj = INWORLD_SUPPORTED_LANGUAGES.find((l) => l.id === audioLanguage);
  const selectedLangDisplay = selectedLangObj?.label || audioLanguage || t("videoSelectLanguagePrompt");

  const coverageDisplay =
    lengthMode === "short"
      ? t("videoCoverageShortShort")
      : lengthMode === "long"
      ? t("videoCoverageLongShort")
      : t("videoCoverageAutoShort");

  const deliveryDisplay =
    deliveryMode === "STABLE"
      ? t("videoDeliveryStable")
      : deliveryMode === "CREATIVE" || deliveryMode === "EXPRESSIVE"
      ? t("videoDeliveryCreative")
      : t("videoDeliveryBalanced");

  const speedDisplay =
    speed === 0.75
      ? t("videoSpeedSlow")
      : speed === 1.25
      ? t("videoSpeedFast")
      : speed === 1.5
      ? t("videoSpeedVeryFast")
      : t("videoSpeedNormal");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] max-h-[88vh] flex flex-col gap-0 p-0 bg-[#161616] border border-[#2b2b2b] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        {/* Header - AudioLines + "Audio Summarize" + X button (No dividing line) */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-2 bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <AudioLines className="h-4 w-4 text-white shrink-0" />
            <span className="text-sm font-semibold text-white tracking-tight">
              {t("audioSummarizeTitle")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 rounded-lg hover:bg-[#222222] text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 w-full px-5 py-2">
            <div className="space-y-4 pb-2">
              {/* 1. Source Scope (Wide) & Duration Dropdown (Right) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                {/* Source Selection with ScrollArea & Max-Height */}
                <div className="flex-1 space-y-1.5 relative" data-studio-dropdown>
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {t("videoSourceScopeLabel")}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "source" ? null : "source")}
                      className="w-full h-9 px-3 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
                    >
                      <span className="text-white font-medium truncate">
                        {selectedSourceIds.length === sources.length
                          ? t("videoAllSourcesSelected", { count: sources.length })
                          : t("videoSourcesSelectedCount", {
                              selected: selectedSourceIds.length,
                              total: sources.length,
                            })}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-[#888888] shrink-0 transition-transform duration-150",
                          openDropdown === "source" ? "rotate-180 text-white" : ""
                        )}
                      />
                    </button>

                    {openDropdown === "source" && (
                      <div className="absolute top-full mt-1.5 left-0 right-0 z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-2 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                        {/* Select All Toggle */}
                        <button
                          type="button"
                          onClick={handleSelectAllSources}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc] cursor-pointer transition-colors"
                        >
                          <span className="font-medium">
                            {selectedSourceIds.length === sources.length
                              ? t("videoDeselectAllSources")
                              : t("videoSelectAllSources")}
                          </span>
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                              selectedSourceIds.length === sources.length
                                ? "bg-white border-white text-black"
                                : "border-[#444449] bg-transparent"
                            )}
                          >
                            {selectedSourceIds.length === sources.length && (
                              <Check className="h-3 w-3 stroke-[3]" />
                            )}
                          </div>
                        </button>

                        <div className="h-px bg-[#2e2e2e] my-1.5" />

                        {/* ScrollArea with max-height to handle many sources smoothly */}
                        <ScrollArea className="max-h-56 w-full" viewportClassName="space-y-1 pr-1.5">
                          {sources.map((src) => {
                            const isSelected = selectedSourceIds.includes(src.id);
                            return (
                              <button
                                key={src.id}
                                type="button"
                                onClick={() => handleToggleSource(src.id)}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-left cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <FileText className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                                  <span className="truncate text-[#e0e0e0]">{src.title}</span>
                                </div>
                                <div
                                  className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                    isSelected
                                      ? "bg-white border-white text-black"
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

                {/* Duration / Coverage Custom Studio Dropdown */}
                <div className="w-full sm:w-[150px] shrink-0 space-y-1.5 relative" data-studio-dropdown>
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {t("videoCoverageDepthLabel")}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "coverage" ? null : "coverage")}
                      className="w-full h-9 px-3 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
                    >
                      <span className="text-white font-medium truncate">{coverageDisplay}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-[#888888] shrink-0 transition-transform duration-150",
                          openDropdown === "coverage" ? "rotate-180 text-white" : ""
                        )}
                      />
                    </button>

                    {openDropdown === "coverage" && (
                      <div className="absolute top-full mt-1.5 right-0 w-full min-w-[140px] z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                        {(
                          [
                            { id: "auto", label: t("videoCoverageAutoShort") },
                            { id: "short", label: t("videoCoverageShortShort") },
                            { id: "long", label: t("videoCoverageLongShort") },
                          ] as const
                        ).map((opt) => {
                          const isSelected = lengthMode === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setLengthMode(opt.id);
                                setOpenDropdown(null);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-[#2b2b2b] text-white font-medium"
                                  : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                              )}
                            >
                              <span>{opt.label}</span>
                              {isSelected && <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Model Voice / Voice Configuration: Positioned directly below sources */}
              <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-[#2b2b2b] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-white" />
                    <span className="text-xs font-semibold text-white">
                      {t("voiceConfigurationInworld")}
                    </span>
                  </div>
                  {hasInworldKey ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t("apiKeyConnected")}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {t("notConfigured")}
                    </span>
                  )}
                </div>

                {!hasInworldKey ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <div className="flex items-start gap-2 text-xs text-amber-300/90 leading-relaxed">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{t("audioNoApiKeyNotice")}</span>
                    </div>
                    {(onOpenModelsSettings || onOpenSettings) && (
                      <button
                        type="button"
                        onClick={handleOpenSettingsAction}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium cursor-pointer transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>{t("audioOpenModelsSettings")}</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Row 1: Voice Model, Voice ID, Language (Custom Studio Dropdowns) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Voice Model Custom Dropdown */}
                  <div className="space-y-1 relative" data-studio-dropdown>
                    <label className="text-[10.5px] font-medium text-[#888888]">
                      {t("videoVoiceModel")}
                    </label>
                    <button
                      type="button"
                      disabled={!hasInworldKey}
                      onClick={() => setOpenDropdown(openDropdown === "model" ? null : "model")}
                      className="w-full h-8 px-2.5 rounded-lg bg-[#2b2b2b] border border-[#383838] hover:border-[#444444] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between text-xs text-white cursor-pointer transition-colors text-left"
                    >
                      <span className="truncate">{selectedModelDisplay}</span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 text-[#888888] shrink-0 transition-transform duration-150",
                          openDropdown === "model" ? "rotate-180 text-white" : ""
                        )}
                      />
                    </button>

                    {openDropdown === "model" && hasInworldKey && (
                      <div className="absolute top-full mt-1.5 left-0 min-w-full sm:min-w-[240px] w-max max-w-[320px] z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                        <ScrollArea className="max-h-52 w-full" viewportClassName="space-y-1 pr-1">
                          {(availableModels.length > 0
                            ? availableModels
                            : [
                                { id: "inworld-tts-2", name: "Inworld TTS-2" },
                                { id: "inworld-tts-2-flash", name: "Inworld TTS-2 Flash" },
                                { id: "inworld-tts-1.5-max", name: "Inworld TTS-1.5 Max" },
                                { id: "inworld-tts-1.5-mini", name: "Inworld TTS-1.5 Mini" },
                              ]
                          ).map((m) => {
                            const isSelected = voiceModel === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setVoiceModel(m.id);
                                  setOpenDropdown(null);
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors text-left",
                                  isSelected
                                    ? "bg-[#2b2b2b] text-white font-medium"
                                    : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                                )}
                              >
                                <span className="whitespace-nowrap pr-2">{m.name}</span>
                                {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0 ml-2" />}
                              </button>
                            );
                          })}
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  {/* Voice ID Custom Dropdown with Search & ScrollArea */}
                  <div className="space-y-1 relative" data-studio-dropdown>
                    <label className="text-[10.5px] font-medium text-[#888888]">
                      {t("videoVoiceCharacter")}
                    </label>
                    <button
                      type="button"
                      disabled={!hasInworldKey || !isModelSelected}
                      onClick={() => {
                        setVoiceSearch("");
                        setOpenDropdown(openDropdown === "voice" ? null : "voice");
                      }}
                      className={cn(
                        "w-full h-8 px-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-colors text-left",
                        !isModelSelected
                          ? "bg-[#222222] border-[#2b2b2b] text-[#666666] opacity-50 cursor-not-allowed"
                          : "bg-[#2b2b2b] border-[#383838] hover:border-[#444444] text-white"
                      )}
                    >
                      <span className="truncate">
                        {!isModelSelected ? t("videoSelectModelFirst") : selectedVoiceDisplay}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 text-[#888888] shrink-0 transition-transform duration-150",
                          openDropdown === "voice" ? "rotate-180 text-white" : ""
                        )}
                      />
                    </button>

                    {openDropdown === "voice" && isModelSelected && hasInworldKey && (
                      <div className="absolute top-full mt-1.5 left-0 min-w-full sm:min-w-[260px] w-max max-w-[340px] z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-2 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                        {/* Search Input */}
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#181818] border border-[#333333] mb-1.5">
                          <Search className="h-3.5 w-3.5 text-[#888888] shrink-0" />
                          <input
                            type="text"
                            value={voiceSearch}
                            onChange={(e) => setVoiceSearch(e.target.value)}
                            placeholder={t("videoSearchVoicePlaceholder")}
                            className="w-full bg-transparent text-xs text-white placeholder:text-[#666666] focus:outline-none font-sans"
                            autoFocus
                          />
                          {voiceSearch && (
                            <button
                              type="button"
                              onClick={() => setVoiceSearch("")}
                              className="text-[#888888] hover:text-white cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* ScrollArea with max-height */}
                        <ScrollArea className="max-h-56 w-full" viewportClassName="space-y-1 pr-1">
                          {filteredVoices.length === 0 ? (
                            <div className="py-4 text-center text-xs text-[#888888]">
                              {t("videoNoVoicesFound")}
                            </div>
                          ) : (
                            filteredVoices.map((v) => {
                              const isSelected = voiceId === v.id;
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => {
                                    setVoiceId(v.id);
                                    setOpenDropdown(null);
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors",
                                    isSelected
                                      ? "bg-[#2b2b2b] text-white font-medium"
                                      : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                                  )}
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-white truncate">{v.name}</span>
                                      {v.gender && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#333333] text-[#aaaaaa]">
                                          {v.gender}
                                        </span>
                                      )}
                                    </div>
                                    {v.description && (
                                      <span className="text-[10px] text-[#777777] truncate mt-0.5">
                                        {v.description}
                                      </span>
                                    )}
                                  </div>
                                  {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0" />}
                                </button>
                              );
                            })
                          )}
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  {/* Select Language Custom Dropdown with Search & ScrollArea */}
                  <div className="space-y-1 relative" data-studio-dropdown>
                    <label className="text-[10.5px] font-medium text-[#888888]">
                      {t("videoLanguage")}
                    </label>
                    <button
                      type="button"
                      disabled={!hasInworldKey || !isModelSelected}
                      onClick={() => {
                        setLanguageSearch("");
                        setOpenDropdown(openDropdown === "language" ? null : "language");
                      }}
                      className={cn(
                        "w-full h-8 px-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-colors text-left",
                        !isModelSelected
                          ? "bg-[#222222] border-[#2b2b2b] text-[#666666] opacity-50 cursor-not-allowed"
                          : "bg-[#2b2b2b] border-[#383838] hover:border-[#444444] text-white"
                      )}
                    >
                      <span className="truncate">
                        {!isModelSelected ? t("videoSelectModelFirst") : selectedLangDisplay}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 text-[#888888] shrink-0 transition-transform duration-150",
                          openDropdown === "language" ? "rotate-180 text-white" : ""
                        )}
                      />
                    </button>

                    {openDropdown === "language" && isModelSelected && hasInworldKey && (
                      <div className="absolute top-full mt-1.5 right-0 min-w-full sm:min-w-[240px] w-max max-w-[320px] z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-2 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                        {/* Search Input */}
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#181818] border border-[#333333] mb-1.5">
                          <Search className="h-3.5 w-3.5 text-[#888888] shrink-0" />
                          <input
                            type="text"
                            value={languageSearch}
                            onChange={(e) => setLanguageSearch(e.target.value)}
                            placeholder={t("videoSearchLanguagePlaceholder")}
                            className="w-full bg-transparent text-xs text-white placeholder:text-[#666666] focus:outline-none font-sans"
                            autoFocus
                          />
                          {languageSearch && (
                            <button
                              type="button"
                              onClick={() => setLanguageSearch("")}
                              className="text-[#888888] hover:text-white cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* ScrollArea with max-height */}
                        <ScrollArea className="max-h-56 w-full" viewportClassName="space-y-1 pr-1">
                          {filteredLanguages.length === 0 ? (
                            <div className="py-4 text-center text-xs text-[#888888]">
                              {t("videoNoLanguagesFound")}
                            </div>
                          ) : (
                            filteredLanguages.map((lang) => {
                              const isSelected = audioLanguage === lang.id;
                              return (
                                <button
                                  key={lang.id}
                                  type="button"
                                  onClick={() => {
                                    setAudioLanguage(lang.id);
                                    setOpenDropdown(null);
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors",
                                    isSelected
                                      ? "bg-[#2b2b2b] text-white font-medium"
                                      : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                                  )}
                                >
                                  <span className="truncate pr-2">{lang.label}</span>
                                  {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0" />}
                                </button>
                              );
                            })
                          )}
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2 (Conditional): Delivery & Talking Speed Custom Dropdowns */}
                {isModelSelected && (
                  <div
                    className={cn(
                      "grid gap-2.5 pt-1",
                      isInworldModel && isTts2Model ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                    )}
                  >
                    {/* Delivery Mode (Only for Inworld TTS-2 and TTS-2 Flash) */}
                    {isInworldModel && isTts2Model && (
                      <div className="space-y-1 relative" data-studio-dropdown>
                        <label className="text-[10.5px] font-medium text-[#888888]">
                          {t("videoDeliveryMode")}
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenDropdown(openDropdown === "delivery" ? null : "delivery")}
                          className="w-full h-8 px-2.5 rounded-lg bg-[#2b2b2b] border border-[#383838] hover:border-[#444444] flex items-center justify-between text-xs text-white cursor-pointer transition-colors text-left"
                        >
                          <span className="truncate">{deliveryDisplay}</span>
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 text-[#888888] shrink-0 transition-transform duration-150",
                              openDropdown === "delivery" ? "rotate-180 text-white" : ""
                            )}
                          />
                        </button>

                        {openDropdown === "delivery" && (
                          <div className="absolute top-full mt-1.5 left-0 min-w-full sm:min-w-[200px] w-max max-w-[260px] z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                            {(
                              [
                                { id: "BALANCED", label: t("videoDeliveryBalanced") },
                                { id: "STABLE", label: t("videoDeliveryStable") },
                                { id: "CREATIVE", label: t("videoDeliveryCreative") },
                              ] as const
                            ).map((opt) => {
                              const isSelected = deliveryMode === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setDeliveryMode(opt.id);
                                    setOpenDropdown(null);
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors text-left",
                                    isSelected
                                      ? "bg-[#2b2b2b] text-white font-medium"
                                      : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                                  )}
                                >
                                  <span className="whitespace-nowrap pr-2">{opt.label}</span>
                                  {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0 ml-2" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Talking Speed */}
                    <div className="space-y-1 relative" data-studio-dropdown>
                      <label className="text-[10.5px] font-medium text-[#888888]">
                        {t("videoTalkingSpeed")}
                      </label>
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === "speed" ? null : "speed")}
                        className="w-full h-8 px-2.5 rounded-lg bg-[#2b2b2b] border border-[#383838] hover:border-[#444444] flex items-center justify-between text-xs text-white cursor-pointer transition-colors text-left"
                      >
                        <span className="truncate">{speedDisplay}</span>
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 text-[#888888] shrink-0 transition-transform duration-150",
                            openDropdown === "speed" ? "rotate-180 text-white" : ""
                          )}
                        />
                      </button>

                      {openDropdown === "speed" && (
                        <div className="absolute top-full mt-1.5 right-0 min-w-full sm:min-w-[180px] w-max max-w-[240px] z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                          {(
                            [
                              { val: 0.75, label: t("videoSpeedSlow") },
                              { val: 1.0, label: t("videoSpeedNormal") },
                              { val: 1.25, label: t("videoSpeedFast") },
                              { val: 1.5, label: t("videoSpeedVeryFast") },
                            ] as const
                          ).map((opt) => {
                            const isSelected = speed === opt.val;
                            return (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => {
                                  setSpeed(opt.val);
                                  setOpenDropdown(null);
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors text-left",
                                  isSelected
                                    ? "bg-[#2b2b2b] text-white font-medium"
                                    : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                                )}
                              >
                                <span className="whitespace-nowrap pr-2">{opt.label}</span>
                                {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0 ml-2" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Instruction (Optional) + Quick Suggestion Preset Chips */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("videoInstructionLabel")}
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={t("audioCustomPromptPlaceholder")}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] focus:border-[#444444] focus:outline-none text-xs text-white placeholder:text-[#666666] resize-none transition-colors font-sans"
                />

                {/* 4 Saran Quick Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {suggestionChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplySuggestion(chip)}
                      className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#2e2e2e] hover:border-[#383838] text-[11px] text-[#a0a0a0] hover:text-white transition-all cursor-pointer active:scale-98"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer Actions - No divider line */}
          <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 bg-[#161616]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl bg-transparent hover:bg-[#222222] text-xs text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!hasInworldKey || sources.length === 0}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-semibold text-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <span>{t("generateAudioSummary")}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
