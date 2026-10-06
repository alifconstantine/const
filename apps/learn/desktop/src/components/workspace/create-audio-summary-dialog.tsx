import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  AudioLines,
  Check,
  ChevronDown,
  FileText,
  AlertCircle,
  ArrowRight,
  Settings,
  Volume2,
  Search,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, Popover, PopoverTrigger, PopoverContent, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";
import {
  getStoredVoiceConfig,
  INWORLD_MODELS,
  POPULAR_INWORLD_VOICES,
  getCachedVoices,
} from "../../lib/voice";
import { INWORLD_SUPPORTED_LANGUAGES } from "./create-video-summary-dialog";

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

type ActiveDropdown = "source" | "model" | "voice" | "language" | null;

export function CreateAudioSummaryDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
  onOpenModelsSettings,
}: CreateAudioSummaryDialogProps) {
  const { t, language } = useI18n();

  const [topic, setTopic] = useState("");
  const [lengthMode, setLengthMode] = useState<"short" | "long" | "auto">("auto");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Search queries for dropdowns
  const [voiceSearch, setVoiceSearch] = useState<string>("");
  const [languageSearch, setLanguageSearch] = useState<string>("");

  // Track which custom studio dropdown is currently open
  const [openDropdown, setOpenDropdown] = useState<ActiveDropdown>(null);

  // Voice state
  const [voiceModel, setVoiceModel] = useState("inworld-tts-2");
  const [voiceId, setVoiceId] = useState("Ashley");
  const [audioLanguage, setAudioLanguage] = useState(language === "id" ? "id-ID" : "en-US");

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-studio-dropdown]")) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown === "source") {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openDropdown]);

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

  // Helper labels
  const selectedVoiceObj = availableVoices.find((v) => v.id === voiceId);
  const selectedVoiceDisplay = selectedVoiceObj
    ? `${selectedVoiceObj.name}${selectedVoiceObj.gender ? ` (${selectedVoiceObj.gender})` : ""}`
    : voiceId || t("videoSelectVoicePrompt");

  const selectedModelObj = availableModels.find((m) => m.id === voiceModel);
  const selectedModelDisplay = selectedModelObj?.name || voiceModel || t("videoSelectModelPrompt");

  const selectedLangObj = INWORLD_SUPPORTED_LANGUAGES.find((l) => l.id === audioLanguage);
  const selectedLangDisplay = selectedLangObj?.label || audioLanguage || t("videoSelectLanguagePrompt");

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
      <DialogContent className="max-w-[620px] max-h-[88vh] flex flex-col gap-0 p-0 bg-[#161616] border border-[#2b2b2b] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        {/* Header - Borderless austere studio style */}
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
              {/* Concept Explanation Box */}
              <div className="p-3.5 rounded-xl bg-[#222222] border border-[#2b2b2b] flex items-start gap-3">
                <AudioLines className="h-4 w-4 text-white shrink-0 mt-0.5" />
                <div className="text-xs text-[#d4d4d4] leading-relaxed">
                  {t("audioSummarizeSubtitle")}
                </div>
              </div>

              {/* Sumber Dropdown */}
              <div className="space-y-1.5 relative" data-studio-dropdown>
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("sourceMaterialScope")}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === "source" ? null : "source")}
                    className="w-full h-9 px-3 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
                  >
                    <span className="text-white font-medium truncate">
                      {selectedSourceIds.length === sources.length
                        ? t("allSourcesCount", { count: sources.length })
                        : t("selectedOfTotalSources", {
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
                      <ScrollArea className="max-h-48 w-full" viewportClassName="space-y-1 pr-1">
                        <button
                          type="button"
                          onClick={handleSelectAllSources}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc] cursor-pointer transition-colors"
                        >
                          <span className="font-medium">
                            {t("selectAllSources")}
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

              {/* Length Options: Ringkas, Panjang, Auto */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("summaryLengthAndDepth")}
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
                            ? "bg-[#2b2b2b] border-[#444444] text-white shadow-sm"
                            : "bg-[#222222] border-[#2b2b2b] hover:border-[#383838] text-[#a0a0a0] hover:text-[#e0e0e0]"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">{opt.label}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />}
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
                  className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] focus:border-[#444444] focus:outline-none text-xs text-white placeholder:text-[#666666] resize-none transition-colors font-sans"
                />
              </div>

              {/* Voice Configuration Section */}
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
                  /* Notice when Inworld API Key is missing */
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Voice Model Custom Popover */}
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-medium text-[#888888]">
                      {t("audioVoiceModel")}
                    </label>
                    <Popover
                      modal={true}
                      open={openDropdown === "model"}
                      onOpenChange={(isOpen) => setOpenDropdown(isOpen ? "model" : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={!hasInworldKey}
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
                      </PopoverTrigger>
                      <PopoverContent
                        side="top"
                        align="start"
                        sideOffset={6}
                        avoidCollisions={false}
                        className="w-[var(--radix-popover-trigger-width)] min-w-[200px] max-w-[300px] p-1.5 bg-[#222222] border border-[#2b2b2b] rounded-xl text-white shadow-2xl z-[60]"
                      >
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
                                <span className="truncate pr-2">{m.name}</span>
                                {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0 ml-2" />}
                              </button>
                            );
                          })}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Voice ID Custom Popover with Search & ScrollArea */}
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-medium text-[#888888]">
                      {t("audioVoiceId")}
                    </label>
                    <Popover
                      modal={true}
                      open={openDropdown === "voice"}
                      onOpenChange={(isOpen) => {
                        if (isOpen) {
                          setVoiceSearch("");
                          setOpenDropdown("voice");
                        } else {
                          setOpenDropdown(null);
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={!hasInworldKey || !isModelSelected}
                          className={cn(
                            "w-full h-8 px-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-colors text-left",
                            !isModelSelected || !hasInworldKey
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
                      </PopoverTrigger>
                      <PopoverContent
                        side="top"
                        align="start"
                        sideOffset={6}
                        avoidCollisions={false}
                        className="w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[340px] p-2 bg-[#222222] border border-[#2b2b2b] rounded-xl text-white shadow-2xl z-[60]"
                      >
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

                        {/* ScrollArea with max-height using packages/ui/src/components/ui/scroll-area.tsx */}
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
                                  {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0 ml-2" />}
                                </button>
                              );
                            })
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Audio Language Custom Popover with Search & ScrollArea */}
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-medium text-[#888888]">
                      {t("audioLanguage")}
                    </label>
                    <Popover
                      modal={true}
                      open={openDropdown === "language"}
                      onOpenChange={(isOpen) => {
                        if (isOpen) {
                          setLanguageSearch("");
                          setOpenDropdown("language");
                        } else {
                          setOpenDropdown(null);
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={!hasInworldKey}
                          className={cn(
                            "w-full h-8 px-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-colors text-left",
                            !hasInworldKey
                              ? "bg-[#222222] border-[#2b2b2b] text-[#666666] opacity-50 cursor-not-allowed"
                              : "bg-[#2b2b2b] border-[#383838] hover:border-[#444444] text-white"
                          )}
                        >
                          <span className="truncate">
                            {selectedLangDisplay}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 text-[#888888] shrink-0 transition-transform duration-150",
                              openDropdown === "language" ? "rotate-180 text-white" : ""
                            )}
                          />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="top"
                        align="end"
                        sideOffset={6}
                        avoidCollisions={false}
                        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] max-w-[320px] p-2 bg-[#222222] border border-[#2b2b2b] rounded-xl text-white shadow-2xl z-[60]"
                      >
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
                                  {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0 ml-2" />}
                                </button>
                              );
                            })
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
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
