import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Box,
  Volume2,
  Image as ImageIcon,
  Brain,
  Check,
  ArrowRight,
} from "lucide-react";
import { toast, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import {
  type AiModel,
  type AiProvider,
  getStoredAiConfig,
  saveStoredAiConfig,
} from "../../lib/ai";
import {
  type VoiceConfigState,
  type VoiceProvider,
  INWORLD_MODELS,
  getStoredVoiceConfig,
  saveStoredVoiceConfig,
} from "../../lib/voice";
import {
  type ImageConfigState,
  type ImageProvider,
  type ImageModel,
  getStoredImageConfig,
  saveStoredImageConfig,
} from "../../lib/image";

export type ModelCategory = "llm" | "voice" | "image";

export interface DefaultModelsSettingsProps {
  onOpenModels?: () => void;
  initialCategory?: ModelCategory;
}

export function DefaultModelsSettings({
  onOpenModels,
  initialCategory = "llm",
}: DefaultModelsSettingsProps) {
  const { t, language } = useI18n();
  const [activeCategory, setActiveCategory] = useState<ModelCategory>(initialCategory);

  // Tab indicator refs
  const llmTabRef = useRef<HTMLButtonElement>(null);
  const voiceTabRef = useRef<HTMLButtonElement>(null);
  const imageTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const updateIndicator = () => {
      let activeEl: HTMLButtonElement | null = null;
      if (activeCategory === "llm") activeEl = llmTabRef.current;
      else if (activeCategory === "voice") activeEl = voiceTabRef.current;
      else if (activeCategory === "image") activeEl = imageTabRef.current;

      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    };

    updateIndicator();
    const timer = setTimeout(updateIndicator, 50);
    window.addEventListener("resize", updateIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeCategory, language]);

  // =========================================================================
  // Config States
  // =========================================================================
  const [aiConfig, setAiConfig] = useState(() => getStoredAiConfig());
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfigState>(() => getStoredVoiceConfig());
  const [imageConfig, setImageConfig] = useState<ImageConfigState>(() => getStoredImageConfig());

  // Reload config on category change or mount
  useEffect(() => {
    setAiConfig(getStoredAiConfig());
    setVoiceConfig(getStoredVoiceConfig());
    setImageConfig(getStoredImageConfig());
  }, [activeCategory]);

  // =========================================================================
  // 1. LLM Models
  // =========================================================================
  const availableLlmModels = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      providerId: string;
      providerName: string;
      contextWindow?: string;
      maxOutputTokens?: string;
      description?: string;
      supportsThinking?: boolean;
    }> = [];

    (aiConfig.providers || []).forEach((provider) => {
      (provider.models || []).forEach((model) => {
        list.push({
          id: model.id,
          name: model.name || model.id,
          providerId: provider.id,
          providerName: provider.name,
          contextWindow: model.contextWindow,
          maxOutputTokens: model.maxOutputTokens,
          description: model.description,
          supportsThinking: model.supportsThinking,
        });
      });
    });

    return list;
  }, [aiConfig]);

  const handleSelectDefaultLlm = (modelId: string, modelName?: string) => {
    const newConfig = {
      ...aiConfig,
      activeModelId: modelId,
    };
    setAiConfig(newConfig);
    saveStoredAiConfig(newConfig);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("const_learn_active_model", modelId);
    }
    toast.success(
      language === "id"
        ? `Model ${modelName || modelId} dipilih sebagai default LLM`
        : t("defaultModelChanged", { modelId: modelName || modelId })
    );
  };

  // =========================================================================
  // 2. Voice Models
  // =========================================================================
  const availableVoiceModels = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      providerId: string;
      providerName: string;
      protocol: string;
      model: string;
      voice: string;
      voiceName?: string;
      badge?: string;
      desc?: string;
      languages?: string;
    }> = [];

    (voiceConfig.providers || []).forEach((provider) => {
      const hasKey = Boolean(provider.apiKey && provider.apiKey.trim().length > 0);
      const isConfigured =
        hasKey ||
        Boolean(
          provider.baseUrl &&
            !provider.baseUrl.includes("openai.com") &&
            !provider.baseUrl.includes("inworld.ai")
        );

      if (!isConfigured) return;

      if (provider.protocol === "inworld") {
        INWORLD_MODELS.forEach((modelOpt) => {
          list.push({
            id: `${provider.id}-${modelOpt.id}`,
            name: modelOpt.name,
            providerId: provider.id,
            providerName: provider.name,
            protocol: provider.protocol,
            model: modelOpt.id,
            voice: provider.voice || "Ashley",
            voiceName: provider.voiceName || provider.voice || "Ashley",
            badge: modelOpt.badge,
            desc: language === "id" ? modelOpt.descId : modelOpt.descEn,
            languages: modelOpt.languages,
          });
        });
      } else if (provider.protocol === "openai-speech") {
        const standardSpeech = [
          {
            id: "tts-1",
            name: "OpenAI TTS 1",
            desc: language === "id" ? "Model suara standar latensi cepat." : "Sub-second low latency standard voice model.",
          },
          {
            id: "tts-1-hd",
            name: "OpenAI TTS 1 HD",
            desc: language === "id" ? "Model suara resolusi tinggi (High Definition)." : "High-definition neural audio synthesis model.",
          },
        ];
        standardSpeech.forEach((m) => {
          list.push({
            id: `${provider.id}-${m.id}`,
            name: m.name,
            providerId: provider.id,
            providerName: provider.name,
            protocol: provider.protocol,
            model: m.id,
            voice: provider.voice || "alloy",
            voiceName: provider.voiceName || provider.voice || "alloy",
            badge: "OpenAI",
            desc: m.desc,
            languages: "Multilingual",
          });
        });
      } else {
        list.push({
          id: `${provider.id}-${provider.model || "default"}`,
          name: `${provider.name} (${provider.model || "default"})`,
          providerId: provider.id,
          providerName: provider.name,
          protocol: provider.protocol,
          model: provider.model || "default",
          voice: provider.voice || "default",
          voiceName: provider.voiceName || provider.voice || "default",
          badge: "Custom",
          desc: provider.baseUrl,
        });
      }
    });

    return list;
  }, [voiceConfig, language]);

  const handleSelectDefaultVoice = (providerId: string, modelId: string, modelName: string) => {
    const updatedProviders = (voiceConfig.providers || []).map((p) => {
      if (p.id === providerId) {
        return { ...p, model: modelId };
      }
      return p;
    });
    const newConfig: VoiceConfigState = {
      ...voiceConfig,
      providers: updatedProviders,
      activeProviderId: providerId,
    };
    setVoiceConfig(newConfig);
    saveStoredVoiceConfig(newConfig);
    toast.success(
      language === "id"
        ? `Model suara ${modelName} dipilih sebagai default Voice`
        : `Voice model ${modelName} set as default`
    );
  };

  // =========================================================================
  // 3. Image Models
  // =========================================================================
  const availableImageModels = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      providerId: string;
      providerName: string;
      description?: string;
    }> = [];

    (imageConfig.providers || []).forEach((provider) => {
      const hasKey = Boolean(provider.apiKey && provider.apiKey.trim().length > 0);
      const isConfigured =
        hasKey ||
        Boolean(
          provider.baseUrl &&
            !provider.baseUrl.includes("openrouter.ai") &&
            provider.baseUrl.trim().length > 0
        );

      if (!isConfigured) return;

      (provider.models || []).forEach((model) => {
        list.push({
          id: model.id,
          name: model.name || model.id,
          providerId: provider.id,
          providerName: provider.name,
          description: model.description,
        });
      });
    });

    return list;
  }, [imageConfig]);

  const handleSelectDefaultImage = (providerId: string, modelId: string, modelName: string) => {
    const newConfig: ImageConfigState = {
      ...imageConfig,
      activeProviderId: providerId,
      activeModelId: modelId,
    };
    setImageConfig(newConfig);
    saveStoredImageConfig(newConfig);
    toast.success(
      language === "id"
        ? `Model gambar ${modelName} dipilih sebagai default Image`
        : t("activeImageModelSet", { modelId: modelName })
    );
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl pb-6 font-sans">
      {/* 1. Modality Sliding Pill Switcher (Matching Home Page Models) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex items-center h-9 p-0.5 rounded-xl bg-muted/70 border border-border w-fit">
          <div
            className="absolute top-0.5 bottom-0.5 left-0 rounded-lg bg-background shadow-2xs pointer-events-none transition-all duration-300"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.width > 0 ? 1 : 0,
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />

          <button
            ref={llmTabRef}
            type="button"
            onClick={() => setActiveCategory("llm")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              activeCategory === "llm"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            LLM
          </button>
          <button
            ref={voiceTabRef}
            type="button"
            onClick={() => setActiveCategory("voice")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              activeCategory === "voice"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Voice
          </button>
          <button
            ref={imageTabRef}
            type="button"
            onClick={() => setActiveCategory("image")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center",
              activeCategory === "image"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Image
          </button>
        </div>

        {onOpenModels && (
          <button
            type="button"
            onClick={onOpenModels}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary transition-all cursor-pointer w-fit"
          >
            <span>{language === "id" ? "Buka Menu Models" : "Manage in Models"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. Subheader Info */}
      <div className="flex items-center justify-between px-0.5">
        <div>
          <h3 className="text-xs sm:text-sm font-semibold text-foreground">
            {activeCategory === "llm" && (language === "id" ? "Model LLM Default" : "Default LLM Model")}
            {activeCategory === "voice" && (language === "id" ? "Model Suara Default" : "Default Voice AI")}
            {activeCategory === "image" && (language === "id" ? "Model Gambar Default" : "Default Image AI")}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {activeCategory === "llm" &&
              (language === "id"
                ? "Pilih model AI default untuk analisis teks dan riset materi belajar."
                : "Choose the default AI model for text analysis and study research.")}
            {activeCategory === "voice" &&
              (language === "id"
                ? "Pilih model suara default untuk sintesis audio dan video summary."
                : "Choose the default voice model for audio and video summaries.")}
            {activeCategory === "image" &&
              (language === "id"
                ? "Pilih model gambar default untuk pembuatan infografis visual."
                : "Choose the default image model for infographic generation.")}
          </p>
        </div>
        <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border shrink-0">
          {activeCategory === "llm" && `${availableLlmModels.length} Models`}
          {activeCategory === "voice" && `${availableVoiceModels.length} Models`}
          {activeCategory === "image" && `${availableImageModels.length} Models`}
        </span>
      </div>

      {/* =================================================================== */}
      {/* 3. Content: LLM Modality                                            */}
      {/* =================================================================== */}
      {activeCategory === "llm" && (
        <div className="space-y-2.5">
          {availableLlmModels.length === 0 ? (
            <div className="py-12 px-4 rounded-2xl border border-dashed border-border bg-secondary/10 text-center space-y-3">
              <div className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center mx-auto">
                <Box className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {language === "id" ? "Tidak ada model LLM" : "No LLM models configured"}
                </h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {language === "id"
                    ? "Belum ada model LLM yang dikonfigurasi. Tambahkan provider dan model di menu Models."
                    : "No LLM models configured. Add providers and models in the Models menu."}
                </p>
              </div>
              {onOpenModels && (
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>{language === "id" ? "Buka Menu Models" : "Open Models"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            availableLlmModels.map((model) => {
              const isSelected = aiConfig.activeModelId === model.id;

              return (
                <div
                  key={`${model.providerId}-${model.id}`}
                  onClick={() => handleSelectDefaultLlm(model.id, model.name)}
                  className={cn(
                    "p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 sm:gap-4",
                    isSelected
                      ? "border-foreground/30 dark:border-white/30 bg-secondary/80 dark:bg-[#222222] shadow-xs"
                      : "border-border/70 hover:border-foreground/20 bg-card hover:bg-secondary/40 text-card-foreground"
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                        {model.name}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-sans border border-border/70">
                        {model.providerName}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-foreground/10 text-foreground font-medium border border-border/50 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500" />
                          Default
                        </span>
                      )}
                      {model.supportsThinking && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          <Brain className="w-2.5 h-2.5" />
                          Thinking
                        </span>
                      )}
                    </div>
                    {model.description && (
                      <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                        {model.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-0.5 text-[10px] font-sans tabular-nums text-muted-foreground">
                      <span>{model.contextWindow || "1M"} Context</span>
                      <span>•</span>
                      <span>{model.maxOutputTokens || "128K"} Output</span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                        isSelected
                          ? "border-foreground dark:border-white bg-foreground dark:bg-white"
                          : "border-muted-foreground/60"
                      )}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-background dark:bg-black" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. Content: Voice Modality                                          */}
      {/* =================================================================== */}
      {activeCategory === "voice" && (
        <div className="space-y-2.5">
          {availableVoiceModels.length === 0 ? (
            <div className="py-12 px-4 rounded-2xl border border-dashed border-border bg-secondary/10 text-center space-y-3">
              <div className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center mx-auto">
                <Volume2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {language === "id" ? "Tidak ada model suara" : "No voice models configured"}
                </h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {language === "id"
                    ? "API key suara (Inworld TTS atau Custom Speech) belum diisi. Masukkan API key di menu Models untuk memilih default suara."
                    : "No voice API key is configured. Please enter an API key in the Models menu to choose a default voice."}
                </p>
              </div>
              {onOpenModels && (
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>{language === "id" ? "Buka Menu Models" : "Open Models"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            availableVoiceModels.map((voice) => {
              const currentProvider = voiceConfig.providers.find((p) => p.id === voice.providerId);
              const isSelected =
                voiceConfig.activeProviderId === voice.providerId &&
                currentProvider?.model === voice.model;

              return (
                <div
                  key={voice.id}
                  onClick={() => handleSelectDefaultVoice(voice.providerId, voice.model, voice.name)}
                  className={cn(
                    "p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 sm:gap-4",
                    isSelected
                      ? "border-foreground/30 dark:border-white/30 bg-secondary/80 dark:bg-[#222222] shadow-xs"
                      : "border-border/70 hover:border-foreground/20 bg-card hover:bg-secondary/40 text-card-foreground"
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="h-6 w-6 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                        <Volume2 className="w-3.5 h-3.5 text-foreground" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                        {voice.name}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-sans border border-border/70">
                        {voice.providerName}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-foreground/10 text-foreground font-medium border border-border/50 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500" />
                          Default
                        </span>
                      )}
                      {voice.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans border border-border/70">
                          {voice.badge}
                        </span>
                      )}
                    </div>
                    {voice.desc && (
                      <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                        {voice.desc}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-0.5 text-[10px] font-sans tabular-nums text-muted-foreground">
                      <span>Character: {voice.voiceName || voice.voice}</span>
                      {voice.languages && (
                        <>
                          <span>•</span>
                          <span>{voice.languages}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                        isSelected
                          ? "border-foreground dark:border-white bg-foreground dark:bg-white"
                          : "border-muted-foreground/60"
                      )}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-background dark:bg-black" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. Content: Image Modality                                          */}
      {/* =================================================================== */}
      {activeCategory === "image" && (
        <div className="space-y-2.5">
          {availableImageModels.length === 0 ? (
            <div className="py-12 px-4 rounded-2xl border border-dashed border-border bg-secondary/10 text-center space-y-3">
              <div className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center mx-auto">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {language === "id" ? "Tidak ada model gambar" : "No image models configured"}
                </h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {language === "id"
                    ? "Belum ada provider atau model gambar yang dikonfigurasi. Silakan tambahkan provider gambar di menu Models."
                    : "No image provider or models configured. Please configure an image provider in the Models menu."}
                </p>
              </div>
              {onOpenModels && (
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>{language === "id" ? "Buka Menu Models" : "Open Models"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            availableImageModels.map((img) => {
              const isSelected =
                imageConfig.activeProviderId === img.providerId &&
                imageConfig.activeModelId === img.id;

              return (
                <div
                  key={`${img.providerId}-${img.id}`}
                  onClick={() => handleSelectDefaultImage(img.providerId, img.id, img.name)}
                  className={cn(
                    "p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 sm:gap-4",
                    isSelected
                      ? "border-foreground/30 dark:border-white/30 bg-secondary/80 dark:bg-[#222222] shadow-xs"
                      : "border-border/70 hover:border-foreground/20 bg-card hover:bg-secondary/40 text-card-foreground"
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="h-6 w-6 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                        <ImageIcon className="w-3.5 h-3.5 text-foreground" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                        {img.name}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-sans border border-border/70">
                        {img.providerName}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-foreground/10 text-foreground font-medium border border-border/50 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500" />
                          Default
                        </span>
                      )}
                    </div>
                    {img.description && (
                      <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                        {img.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-0.5 text-[10px] font-sans tabular-nums text-muted-foreground">
                      <span>Model ID: {img.id}</span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                        isSelected
                          ? "border-foreground dark:border-white bg-foreground dark:bg-white"
                          : "border-muted-foreground/60"
                      )}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-background dark:bg-black" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
