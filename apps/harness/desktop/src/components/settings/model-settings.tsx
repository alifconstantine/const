import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../../lib/i18n";
import { modelDisplayName } from "../../lib/model-identity";
import {
  toast,
  cn,
  ScrollArea,
  DropdownMenu,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@const/ui";
import {
  Box,
  Bot,
  Volume2,
  Image as ImageIcon,
  Video as VideoIcon,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronDown,
  Unplug,
  Play,
} from "lucide-react";
import {
  type ModelCategory,
  type LlmModel,
  type LlmProvider,
  type SpeechModel,
  type SpeechProvider,
  type ImageModel,
  type ImageProvider,
  type VideoModel,
  type VideoProvider,
  type UnifiedMultiModalConfig,
  loadMultiModalConfig,
  saveLlmConfig,
  saveSpeechConfig,
  saveImageConfig,
  saveVideoConfig,
  CONST_ROUTER_LLM_MODELS,
  PRESET_LLM_PROVIDERS,
  PRESET_SPEECH_PROVIDERS,
  POPULAR_SPEECH_VOICES,
  PRESET_IMAGE_PROVIDERS,
  PRESET_VIDEO_PROVIDERS,
  testEndpointPing,
  fetchRemoteModels,
  playSampleSpeechAudio,
} from "../../lib/models-config";

export interface ModelSettingsProps {
  quota?: any;
  initialCategory?: ModelCategory;
  onActiveModelChanged?: (modelId: string) => void;
}

export function ModelSettings({
  quota: _quota,
  initialCategory = "llm",
  onActiveModelChanged,
}: ModelSettingsProps) {
  const { t } = useTranslation();
  // 1. Modality category state: "llm" | "speech" | "image" | "video"
  const [activeCategory, setActiveCategory] =
    useState<ModelCategory>(initialCategory);

  // Tab indicator sliding animation refs
  const llmTabRef = useRef<HTMLButtonElement>(null);
  const speechTabRef = useRef<HTMLButtonElement>(null);
  const imageTabRef = useRef<HTMLButtonElement>(null);
  const videoTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const updateIndicator = () => {
      let activeEl: HTMLButtonElement | null = null;
      if (activeCategory === "llm") activeEl = llmTabRef.current;
      else if (activeCategory === "speech") activeEl = speechTabRef.current;
      else if (activeCategory === "image") activeEl = imageTabRef.current;
      else if (activeCategory === "video") activeEl = videoTabRef.current;

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
  }, [activeCategory]);

  // 2. Multi-modal configuration state
  const [config, setConfig] = useState<UnifiedMultiModalConfig>(() =>
    loadMultiModalConfig(),
  );

  // Reload config on category change or mount
  useEffect(() => {
    setConfig(loadMultiModalConfig());
  }, [activeCategory]);

  // 3. Provider Accordion Expansion State
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(
    null,
  );
  const [editingProvider, setEditingProvider] = useState<any | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // Inline model addition state inside expanded provider card
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [newModelId, setNewModelId] = useState("");
  const [newModelContext, setNewModelContext] = useState("");

  // Preset picker modal dialog state
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  // Speech testing state
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);

  // Toggle card expansion smoothly
  const handleToggleExpand = (provider: any) => {
    if (expandedProviderId === provider.id) {
      setExpandedProviderId(null);
      setEditingProvider(null);
      setIsAddingModel(false);
      setShowApiKey(false);
    } else {
      setExpandedProviderId(provider.id);
      setEditingProvider(JSON.parse(JSON.stringify(provider)));
      setIsAddingModel(false);
      setShowApiKey(false);
      setNewModelId("");
      setNewModelContext("");
    }
  };

  // Close editing form
  const handleCancelEdit = () => {
    setExpandedProviderId(null);
    setEditingProvider(null);
    setIsAddingModel(false);
    setShowApiKey(false);
  };

  // Set default / active model directly
  const handleSetDefaultModel = (modelId: string, providerId: string) => {
    if (activeCategory === "llm") {
      const updated = {
        ...config.llm,
        activeModelId: modelId,
        activeProviderId: providerId,
      };
      setConfig((prev) => ({ ...prev, llm: updated }));
      saveLlmConfig(updated);
      onActiveModelChanged?.(modelId);
      toast.success(t("toast.activeModelSet"));
    } else if (activeCategory === "speech") {
      const updated = {
        ...config.speech,
        activeModelId: modelId,
        activeProviderId: providerId,
      };
      setConfig((prev) => ({ ...prev, speech: updated }));
      saveSpeechConfig(updated);
      toast.success(t("toast.activeModelSet"));
    } else if (activeCategory === "image") {
      const updated = {
        ...config.image,
        activeModelId: modelId,
        activeProviderId: providerId,
      };
      setConfig((prev) => ({ ...prev, image: updated }));
      saveImageConfig(updated);
      toast.success(t("toast.activeModelSet"));
    } else if (activeCategory === "video") {
      const updated = {
        ...config.video,
        activeModelId: modelId,
        activeProviderId: providerId,
      };
      setConfig((prev) => ({ ...prev, video: updated }));
      saveVideoConfig(updated);
      toast.success(t("toast.activeModelSet"));
    }
  };

  // Delete a provider
  const handleDeleteProvider = (providerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (providerId === "const-router" || providerId === "const") {
      toast.error(t("settings.providerProtected"));
      return;
    }

    if (activeCategory === "llm") {
      const updatedProviders = config.llm.providers.filter(
        (p) => p.id !== providerId,
      );
      const newActiveProvider = updatedProviders[0]?.id || "const-router";
      const newActiveModel =
        config.llm.activeProviderId === providerId
          ? updatedProviders[0]?.models[0]?.id || "gemini-3.8-flash"
          : config.llm.activeModelId;
      const updated = {
        providers: updatedProviders,
        activeProviderId: newActiveProvider,
        activeModelId: newActiveModel,
      };
      setConfig((prev) => ({ ...prev, llm: updated }));
      saveLlmConfig(updated);
    } else if (activeCategory === "speech") {
      const updatedProviders = config.speech.providers.filter(
        (p) => p.id !== providerId,
      );
      const newActiveProvider = updatedProviders[0]?.id || "";
      const newActiveModel = updatedProviders[0]?.models[0]?.id || "";
      const updated = {
        ...config.speech,
        providers: updatedProviders,
        activeProviderId: newActiveProvider,
        activeModelId: newActiveModel,
      };
      setConfig((prev) => ({ ...prev, speech: updated }));
      saveSpeechConfig(updated);
    } else if (activeCategory === "image") {
      const updatedProviders = config.image.providers.filter(
        (p) => p.id !== providerId,
      );
      const newActiveProvider = updatedProviders[0]?.id || "";
      const newActiveModel = updatedProviders[0]?.models[0]?.id || "";
      const updated = {
        providers: updatedProviders,
        activeProviderId: newActiveProvider,
        activeModelId: newActiveModel,
      };
      setConfig((prev) => ({ ...prev, image: updated }));
      saveImageConfig(updated);
    } else if (activeCategory === "video") {
      const updatedProviders = config.video.providers.filter(
        (p) => p.id !== providerId,
      );
      const newActiveProvider = updatedProviders[0]?.id || "";
      const newActiveModel = updatedProviders[0]?.models[0]?.id || "";
      const updated = {
        providers: updatedProviders,
        activeProviderId: newActiveProvider,
        activeModelId: newActiveModel,
      };
      setConfig((prev) => ({ ...prev, video: updated }));
      saveVideoConfig(updated);
    }

    if (expandedProviderId === providerId) {
      setExpandedProviderId(null);
      setEditingProvider(null);
    }
    toast.success(t("settings.providerRemoved"));
  };

  // Save changes to current provider
  const handleApplyProviderEdit = () => {
    if (!editingProvider) return;
    if (!editingProvider.name.trim() || !editingProvider.baseUrl.trim()) {
      toast.error(t("settings.providerFieldsRequired"));
      return;
    }

    if (activeCategory === "llm") {
      let updatedProviders = config.llm.providers.map((p) =>
        p.id === editingProvider.id ? editingProvider : p,
      );
      if (!config.llm.providers.some((p) => p.id === editingProvider.id)) {
        updatedProviders = [...config.llm.providers, editingProvider];
      }
      const updated = { ...config.llm, providers: updatedProviders };
      setConfig((prev) => ({ ...prev, llm: updated }));
      saveLlmConfig(updated);
    } else if (activeCategory === "speech") {
      let updatedProviders = config.speech.providers.map((p) =>
        p.id === editingProvider.id ? editingProvider : p,
      );
      if (!config.speech.providers.some((p) => p.id === editingProvider.id)) {
        updatedProviders = [...config.speech.providers, editingProvider];
      }
      const updated = { ...config.speech, providers: updatedProviders };
      setConfig((prev) => ({ ...prev, speech: updated }));
      saveSpeechConfig(updated);
    } else if (activeCategory === "image") {
      let updatedProviders = config.image.providers.map((p) =>
        p.id === editingProvider.id ? editingProvider : p,
      );
      if (!config.image.providers.some((p) => p.id === editingProvider.id)) {
        updatedProviders = [...config.image.providers, editingProvider];
      }
      const updated = { ...config.image, providers: updatedProviders };
      setConfig((prev) => ({ ...prev, image: updated }));
      saveImageConfig(updated);
    } else if (activeCategory === "video") {
      let updatedProviders = config.video.providers.map((p) =>
        p.id === editingProvider.id ? editingProvider : p,
      );
      if (!config.video.providers.some((p) => p.id === editingProvider.id)) {
        updatedProviders = [...config.video.providers, editingProvider];
      }
      const updated = { ...config.video, providers: updatedProviders };
      setConfig((prev) => ({ ...prev, video: updated }));
      saveVideoConfig(updated);
    }

    setExpandedProviderId(null);
    setEditingProvider(null);
    setIsAddingModel(false);
    toast.success(t("settings.providerSaved"));
  };

  // Test provider latency / connection
  const handleTestConnection = async () => {
    if (!editingProvider || !editingProvider.baseUrl.trim()) {
      toast.error(t("settings.providerUrlRequired"));
      return;
    }
    setIsTestingPing(true);
    const res = await testEndpointPing(
      editingProvider.baseUrl,
      editingProvider.apiKey,
      editingProvider.protocol,
    );
    setIsTestingPing(false);

    if (res.success) {
      toast.success(
        t("settings.providerConnected", { latency: res.latencyMs ?? 0 }),
      );
    } else {
      toast.error(res.error || t("settings.providerConnectFailed"));
    }
  };

  // Fetch remote models dynamically from /models endpoint
  const handleFetchModels = async () => {
    if (!editingProvider) return;
    setIsFetchingModels(true);
    const res = await fetchRemoteModels(
      editingProvider.baseUrl,
      editingProvider.apiKey,
    );
    setIsFetchingModels(false);

    if (res.success && res.models && res.models.length > 0) {
      const existingIds = new Set(
        (editingProvider.models || []).map((m: any) => m.id),
      );
      const newlyAdded = res.models
        .filter((m) => !existingIds.has(m.id))
        .map((m) => ({
          id: m.id,
          name: m.name || m.id,
          contextWindow: "128K",
          maxOutput: "16K",
        }));

      const merged = [...(editingProvider.models || []), ...newlyAdded];
      setEditingProvider({
        ...editingProvider,
        models: merged,
      });
      toast.success(
        t("settings.modelsDiscovered", { count: res.models.length }),
      );
    } else {
      toast.error(res.error || t("settings.modelsFetchFailed"));
    }
  };

  // Restore models to default / clean state
  const handleRestoreDefaults = () => {
    if (!editingProvider) return;
    if (
      editingProvider.id === "const-router" ||
      editingProvider.id === "const"
    ) {
      setEditingProvider({
        ...editingProvider,
        baseUrl: "https://router.const.web.id/v1",
        protocol: "openai-completions",
        models: CONST_ROUTER_LLM_MODELS,
      });
      toast.success(t("settings.modelsRestored"));
    } else {
      setEditingProvider({
        ...editingProvider,
        models: [],
      });
      toast.success(t("settings.modelsCleared"));
    }
  };

  // Add a model manually inside editing provider
  const handleAddModelToForm = () => {
    if (!editingProvider || !newModelId.trim()) return;
    const cleanId = newModelId.trim();
    if ((editingProvider.models || []).some((m: any) => m.id === cleanId)) {
      toast.error(t("settings.modelExists"));
      return;
    }

    const newModel = {
      id: cleanId,
      name: cleanId,
      contextWindow: newModelContext.trim() || "128K",
      maxOutput: "16K",
    };

    setEditingProvider({
      ...editingProvider,
      models: [...(editingProvider.models || []), newModel],
    });
    setNewModelId("");
    setNewModelContext("");
    setIsAddingModel(false);
    toast.success(t("settings.modelAdded"));
  };

  // Remove a model from the provider form
  const handleRemoveModelFromForm = (modelId: string) => {
    if (!editingProvider) return;
    setEditingProvider({
      ...editingProvider,
      models: (editingProvider.models || []).filter(
        (m: any) => m.id !== modelId,
      ),
    });
  };

  // Add a Preset Adapter Provider (clean, no dummy models)
  const handleAddPresetProvider = (preset: any) => {
    const id = `${preset.id}-${Date.now()}`;
    const newProvider = {
      id,
      name: preset.name,
      baseUrl: preset.baseUrl,
      apiKey: "",
      protocol: preset.protocol,
      models: [], // Clean, empty models list!
      isCustom: false,
    };

    if (activeCategory === "llm") {
      const activeProviderId = config.llm.activeProviderId || newProvider.id;
      const updated = {
        ...config.llm,
        activeProviderId,
        providers: [...config.llm.providers, newProvider as LlmProvider],
      };
      setConfig((prev) => ({ ...prev, llm: updated }));
      saveLlmConfig(updated);
    } else if (activeCategory === "speech") {
      const activeProviderId = config.speech.activeProviderId || newProvider.id;
      const updated = {
        ...config.speech,
        activeProviderId,
        providers: [
          ...config.speech.providers,
          {
            ...newProvider,
            model: preset.defaultModel || "tts-1",
            voice: preset.defaultVoice || "alloy",
            speed: 1.0,
          } as SpeechProvider,
        ],
      };
      setConfig((prev) => ({ ...prev, speech: updated }));
      saveSpeechConfig(updated);
    } else if (activeCategory === "image") {
      const activeProviderId = config.image.activeProviderId || newProvider.id;
      const updated = {
        ...config.image,
        activeProviderId,
        providers: [...config.image.providers, newProvider as ImageProvider],
      };
      setConfig((prev) => ({ ...prev, image: updated }));
      saveImageConfig(updated);
    } else if (activeCategory === "video") {
      const activeProviderId = config.video.activeProviderId || newProvider.id;
      const updated = {
        ...config.video,
        activeProviderId,
        providers: [
          ...config.video.providers,
          {
            ...newProvider,
            defaultResolution: "1080p",
            aspectRatio: "16:9",
          } as VideoProvider,
        ],
      };
      setConfig((prev) => ({ ...prev, video: updated }));
      saveVideoConfig(updated);
    }

    setExpandedProviderId(newProvider.id);
    setEditingProvider(JSON.parse(JSON.stringify(newProvider)));
    setIsPresetModalOpen(false);
    toast.success(t("settings.providerAdded"));
  };

  // Add a Custom Provider
  const handleAddCustomProvider = () => {
    const id = `custom-${Date.now()}`;
    let newProvider: any;

    if (activeCategory === "llm") {
      newProvider = {
        id,
        name: "",
        baseUrl: "",
        apiKey: "",
        protocol: "openai-completions",
        isCustom: true,
        models: [],
      };
      const activeProviderId = config.llm.activeProviderId || id;
      const updated = {
        ...config.llm,
        activeProviderId,
        providers: [...config.llm.providers, newProvider],
      };
      setConfig((prev) => ({ ...prev, llm: updated }));
      saveLlmConfig(updated);
    } else if (activeCategory === "speech") {
      newProvider = {
        id,
        name: "",
        baseUrl: "",
        apiKey: "",
        protocol: "openai-speech",
        model: "tts-1",
        voice: "alloy",
        speed: 1.0,
        isCustom: true,
        models: [],
      };
      const activeProviderId = config.speech.activeProviderId || id;
      const updated = {
        ...config.speech,
        activeProviderId,
        providers: [...config.speech.providers, newProvider],
      };
      setConfig((prev) => ({ ...prev, speech: updated }));
      saveSpeechConfig(updated);
    } else if (activeCategory === "image") {
      newProvider = {
        id,
        name: "",
        baseUrl: "",
        apiKey: "",
        protocol: "openrouter",
        isCustom: true,
        models: [],
      };
      const activeProviderId = config.image.activeProviderId || id;
      const updated = {
        ...config.image,
        activeProviderId,
        providers: [...config.image.providers, newProvider],
      };
      setConfig((prev) => ({ ...prev, image: updated }));
      saveImageConfig(updated);
    } else if (activeCategory === "video") {
      newProvider = {
        id,
        name: "",
        baseUrl: "",
        apiKey: "",
        protocol: "custom",
        defaultResolution: "1080p",
        aspectRatio: "16:9",
        isCustom: true,
        models: [],
      };
      const activeProviderId = config.video.activeProviderId || id;
      const updated = {
        ...config.video,
        activeProviderId,
        providers: [...config.video.providers, newProvider],
      };
      setConfig((prev) => ({ ...prev, video: updated }));
      saveVideoConfig(updated);
    }

    setExpandedProviderId(id);
    setEditingProvider(JSON.parse(JSON.stringify(newProvider)));
  };

  // Speech test audio player
  const handlePlayTestSpeech = (voiceName: string, speed = 1.0) => {
    setIsPlayingSpeech(true);
    playSampleSpeechAudio(t("settings.ttsTestText"), voiceName, speed, () =>
      setIsPlayingSpeech(false),
    );
  };

  // Current category providers list
  const currentProviders =
    activeCategory === "llm"
      ? config.llm.providers
      : activeCategory === "speech"
        ? config.speech.providers
        : activeCategory === "image"
          ? config.image.providers
          : config.video.providers;

  // Current active model ID
  const currentActiveModelId =
    activeCategory === "llm"
      ? config.llm.activeModelId
      : activeCategory === "speech"
        ? config.speech.activeModelId
        : activeCategory === "image"
          ? config.image.activeModelId
          : config.video.activeModelId;

  // Preset providers options for active category
  const activePresets =
    activeCategory === "llm"
      ? PRESET_LLM_PROVIDERS
      : activeCategory === "speech"
        ? PRESET_SPEECH_PROVIDERS
        : activeCategory === "image"
          ? PRESET_IMAGE_PROVIDERS
          : PRESET_VIDEO_PROVIDERS;

  return (
    <div className="w-full min-w-0 flex flex-col space-y-5 pb-6 font-sans">
      {/* Top Toolbar Row: Modality Sliding Switcher (Left) & Add Provider Dropdown (Right) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Modality Sliding Pill Switcher - exact height h-9 */}
        <div className="relative flex items-center h-9 p-0.5 rounded-xl bg-neutral-100 dark:bg-[#222222] w-fit">
          <div
            className="absolute top-0.5 bottom-0.5 left-0 rounded-lg bg-background  pointer-events-none transition-all duration-300"
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
              "relative z-10 px-3 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeCategory === "llm"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Box className="w-3.5 h-3.5" />
            <span>{t("settings.llm")}</span>
          </button>

          <button
            ref={speechTabRef}
            type="button"
            onClick={() => setActiveCategory("speech")}
            className={cn(
              "relative z-10 px-3 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeCategory === "speech"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{t("settings.speech")}</span>
          </button>

          <button
            ref={imageTabRef}
            type="button"
            onClick={() => setActiveCategory("image")}
            className={cn(
              "relative z-10 px-3 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeCategory === "image"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{t("settings.image")}</span>
          </button>

          <button
            ref={videoTabRef}
            type="button"
            onClick={() => setActiveCategory("video")}
            className={cn(
              "relative z-10 px-3 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeCategory === "video"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <VideoIcon className="w-3.5 h-3.5" />
            <span>{t("settings.video")}</span>
          </button>
        </div>

        {/* Right Side: Add Provider Dropdown (exact height h-9) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-9 px-3.5 rounded-xl border border-border hover:bg-secondary/70 text-xs font-medium text-foreground transition-all flex items-center gap-1.5 cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("settings.addProvider")}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-54 bg-card border-border text-foreground p-1 rounded-xl shadow-xl"
          >
            <DropdownMenuItem
              onClick={() => setIsPresetModalOpen(true)}
              className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{t("settings.chooseAdapterProvider")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleAddCustomProvider}
              className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{t("settings.addCustomProvider")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===================================================================== */}
      {/* PROVIDERS & MODELS ACCORDION LIST                                     */}
      {/* ===================================================================== */}
      <div className="space-y-3">
        {currentProviders.length === 0 ? (
          <div className="settings-surface rounded-2xl bg-neutral-50 dark:bg-[#222222] py-12 px-6 flex flex-col items-center justify-center text-center select-none">
            {/* Category Icon */}
            <div className="w-12 h-12 rounded-2xl bg-[#ebebed] dark:bg-[#2b2b2b] border border-[#dedee2] dark:border-[#383838] flex items-center justify-center text-[#262626] dark:text-white mb-3.5 ">
              {activeCategory === "speech" ? (
                <Volume2 className="w-5 h-5 text-[#737373] dark:text-[#969696]" />
              ) : activeCategory === "image" ? (
                <ImageIcon className="w-5 h-5 text-[#737373] dark:text-[#969696]" />
              ) : activeCategory === "video" ? (
                <VideoIcon className="w-5 h-5 text-[#737373] dark:text-[#969696]" />
              ) : (
                <Box className="w-5 h-5 text-[#737373] dark:text-[#969696]" />
              )}
            </div>

            {/* Title & Description */}
            <h3 className="text-sm font-semibold text-[#262626] dark:text-white tracking-tight">
              {activeCategory === "speech"
                ? t("settings.noSpeechProviders")
                : activeCategory === "image"
                  ? t("settings.noImageProviders")
                  : activeCategory === "video"
                    ? t("settings.noVideoProviders")
                    : t("settings.noLlmProviders")}
            </h3>
            <p className="text-xs text-[#737373] dark:text-[#969696] max-w-sm mt-1 leading-relaxed">
              {activeCategory === "speech"
                ? t("settings.connectSpeechDesc")
                : activeCategory === "image"
                  ? t("settings.connectImageDesc")
                  : activeCategory === "video"
                    ? t("settings.connectVideoDesc")
                    : t("settings.connectLlmDesc")}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(true)}
                className="h-8 px-3.5 rounded-xl bg-[#262626] dark:bg-white text-white dark:text-[#161616] text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer "
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("settings.chooseAdapter")}</span>
              </button>
              <button
                type="button"
                onClick={handleAddCustomProvider}
                className="h-8 px-3.5 rounded-xl bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#ebebed] dark:hover:bg-[#333333] text-[#262626] dark:text-[#d4d4d4] border border-[#dedee2] dark:border-[#383838] text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>{t("settings.customEndpoint")}</span>
              </button>
            </div>
          </div>
        ) : (
          currentProviders.map((provider: any) => {
            const isExpanded = expandedProviderId === provider.id;

            return (
              <div
                key={provider.id}
                className={cn(
                  "settings-surface rounded-2xl bg-neutral-50 dark:bg-[#222222] transition-colors overflow-hidden",
                  isExpanded
                    ? "bg-neutral-100 dark:bg-[#222222]"
                    : "hover:bg-neutral-100 dark:hover:bg-[#2b2b2b]",
                )}
              >
                {/* Provider Card Header */}
                <div className="p-4 flex flex-wrap items-center justify-between gap-3 select-none">
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(provider)}
                    aria-expanded={isExpanded}
                    className="flex items-center gap-2.5 min-w-0 text-left"
                  >
                    <span className="text-sm font-medium text-foreground truncate">
                      {provider.name}
                    </span>
                    {provider.isCustom && (
                      <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10.5px] font-sans border border-border/70 shrink-0">
                        {t("settings.customBadge")}
                      </span>
                    )}
                    {provider.isDefault && (
                      <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10.5px] font-sans border border-border/70 shrink-0">
                        {t("settings.defaultBadge")}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExpand(provider);
                      }}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                        isExpanded
                          ? "bg-secondary text-foreground border-foreground/30 font-semibold"
                          : "border-border hover:bg-secondary text-foreground",
                      )}
                    >
                      {isExpanded ? t("common.close") : t("common.edit")}
                    </button>
                    {!provider.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProvider(provider.id, e)}
                        className="px-3.5 py-1.5 rounded-xl border border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 text-destructive text-xs font-medium transition-all cursor-pointer"
                      >
                        {t("common.delete")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Smooth Expandable Body */}
                {isExpanded && editingProvider && (
                  <div className="px-5 pb-5 pt-2 space-y-5 border-border/40 animate-in fade-in-50 duration-200">
                    {/* 1. Display name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        {t("settings.providerName")}
                      </label>
                      <input
                        type="text"
                        value={editingProvider.name}
                        onChange={(e) =>
                          setEditingProvider({
                            ...editingProvider,
                            name: e.target.value,
                          })
                        }
                        placeholder={t("settings.providerName")}
                        className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                      />
                    </div>

                    {/* 2. Base URL */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        {t("settings.baseUrl")}
                      </label>
                      <input
                        type="text"
                        value={editingProvider.baseUrl}
                        onChange={(e) =>
                          setEditingProvider({
                            ...editingProvider,
                            baseUrl: e.target.value,
                          })
                        }
                        placeholder="https://..."
                        className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors font-sans"
                      />
                    </div>

                    {/* 3. API Protocol */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        {t("settings.apiProtocol")}
                      </label>
                      {activeCategory === "llm" ? (
                        <Select
                          value={
                            editingProvider.protocol || "openai-completions"
                          }
                          onValueChange={(val) =>
                            setEditingProvider({
                              ...editingProvider,
                              protocol: val,
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-8 rounded-[8px] bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                            <SelectValue
                              placeholder={t("settings.apiProtocol")}
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                            <SelectItem
                              value="openai-completions"
                              className="text-xs cursor-pointer"
                            >
                              {t("settings.apiChatCompletions")}
                            </SelectItem>
                            <SelectItem
                              value="anthropic-messages"
                              className="text-xs cursor-pointer"
                            >
                              {t("settings.apiAnthropicMessages")}
                            </SelectItem>
                            <SelectItem
                              value="openai-responses"
                              className="text-xs cursor-pointer"
                            >
                              {t("settings.apiResponses")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : activeCategory === "speech" ? (
                        <Select
                          value={editingProvider.protocol || "openai-speech"}
                          onValueChange={(val) =>
                            setEditingProvider({
                              ...editingProvider,
                              protocol: val,
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-8 rounded-[8px] bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                            <SelectValue
                              placeholder={t("settings.apiProtocol")}
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                            <SelectItem
                              value="openai-speech"
                              className="text-xs cursor-pointer"
                            >
                              OpenAI Speech (/v1/audio/speech)
                            </SelectItem>
                            <SelectItem
                              value="custom"
                              className="text-xs cursor-pointer"
                            >
                              {t("settings.customEndpoint")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : activeCategory === "image" ? (
                        <Select
                          value={editingProvider.protocol || "openrouter"}
                          onValueChange={(val) =>
                            setEditingProvider({
                              ...editingProvider,
                              protocol: val,
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-8 rounded-[8px] bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                            <SelectValue
                              placeholder={t("settings.apiProtocol")}
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                            <SelectItem
                              value="openrouter"
                              className="text-xs cursor-pointer"
                            >
                              OpenRouter Images (/images)
                            </SelectItem>
                            <SelectItem
                              value="openai-generations"
                              className="text-xs cursor-pointer"
                            >
                              OpenAI Image Generations (/images/generations)
                            </SelectItem>
                            <SelectItem
                              value="custom"
                              className="text-xs cursor-pointer"
                            >
                              {t("settings.customEndpoint")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select
                          value={editingProvider.protocol || "openai-video"}
                          onValueChange={(val) =>
                            setEditingProvider({
                              ...editingProvider,
                              protocol: val,
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-8 rounded-[8px] bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                            <SelectValue
                              placeholder={t("settings.apiProtocol")}
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                            <SelectItem
                              value="openai-video"
                              className="text-xs cursor-pointer"
                            >
                              OpenAI Video API
                            </SelectItem>
                            <SelectItem
                              value="custom"
                              className="text-xs cursor-pointer"
                            >
                              {t("settings.customEndpoint")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* 4. API Key with Visibility Toggle */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        {t("settings.apiKey")}
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={editingProvider.apiKey || ""}
                          onChange={(e) =>
                            setEditingProvider({
                              ...editingProvider,
                              apiKey: e.target.value,
                            })
                          }
                          placeholder={
                            editingProvider.isDefault
                              ? t("settings.apiKeyConfigured")
                              : t("settings.apiKey")
                          }
                          className="w-full px-3.5 py-2 pr-10 rounded-xl bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors font-sans"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
                          title={t(
                            showApiKey
                              ? "settings.hideApiKey"
                              : "settings.showApiKey",
                          )}
                        >
                          {showApiKey ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 5. Modality Specific Controls */}
                    {activeCategory === "speech" && (
                      <div className="space-y-4 pt-2 border-border/40">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground block">
                              {t("settings.voice")}
                            </label>
                            <Select
                              value={editingProvider.voice || "alloy"}
                              onValueChange={(val) =>
                                setEditingProvider({
                                  ...editingProvider,
                                  voice: val,
                                  voiceName: val,
                                })
                              }
                            >
                              <SelectTrigger className="w-full h-8 rounded-[8px] bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                                <SelectValue placeholder={t("common.select")} />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                                {POPULAR_SPEECH_VOICES.map((v) => (
                                  <SelectItem
                                    key={v.id}
                                    value={v.id}
                                    className="text-xs cursor-pointer"
                                  >
                                    {v.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground block">
                              {t("settings.speed")}:{" "}
                              {editingProvider.speed || 1.0}x
                            </label>
                            <div className="flex items-center gap-2 pt-2">
                              <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={editingProvider.speed || 1.0}
                                onChange={(e) =>
                                  setEditingProvider({
                                    ...editingProvider,
                                    speed: parseFloat(e.target.value),
                                  })
                                }
                                className="w-full accent-foreground cursor-pointer"
                              />
                              <span className="text-xs text-muted-foreground w-10 text-right">
                                {editingProvider.speed || 1.0}x
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Live Speech Synthesis Playback */}
                        <div className="p-3 rounded-xl bg-secondary/20 border border-border flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-xs text-foreground truncate">
                              {t("settings.playSampleAudio")} (
                              {editingProvider.voice || "alloy"})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handlePlayTestSpeech(
                                editingProvider.voice || "alloy",
                                editingProvider.speed || 1.0,
                              )
                            }
                            disabled={isPlayingSpeech}
                            className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>
                              {isPlayingSpeech
                                ? t("settings.playing")
                                : t("settings.playSampleAudio")}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {activeCategory === "image" && (
                      <div className="space-y-1.5 pt-2 border-border/40">
                        <label className="text-xs font-medium text-foreground block">
                          {t("settings.aspectRatio")}
                        </label>
                        <Select
                          value={editingProvider.aspectRatio || "1:1"}
                          onValueChange={(val) =>
                            setEditingProvider({
                              ...editingProvider,
                              aspectRatio: val,
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-8 rounded-[8px] bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                            <SelectValue placeholder={t("common.select")} />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                            <SelectItem
                              value="1:1"
                              className="text-xs cursor-pointer"
                            >
                              1:1
                            </SelectItem>
                            <SelectItem
                              value="16:9"
                              className="text-xs cursor-pointer"
                            >
                              16:9
                            </SelectItem>
                            <SelectItem
                              value="9:16"
                              className="text-xs cursor-pointer"
                            >
                              9:16
                            </SelectItem>
                            <SelectItem
                              value="4:3"
                              className="text-xs cursor-pointer"
                            >
                              4:3 (Classic)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {activeCategory === "video" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-border/40">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground block">
                            {t("settings.resolution")}
                          </label>
                          <Select
                            value={editingProvider.defaultResolution || "1080p"}
                            onValueChange={(val: any) =>
                              setEditingProvider({
                                ...editingProvider,
                                defaultResolution: val,
                              })
                            }
                          >
                            <SelectTrigger className="w-full h-8 rounded-[8px] bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                              <SelectItem
                                value="720p"
                                className="text-xs cursor-pointer"
                              >
                                720p HD
                              </SelectItem>
                              <SelectItem
                                value="1080p"
                                className="text-xs cursor-pointer"
                              >
                                1080p Full HD
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground block">
                            {t("settings.aspectRatio")}
                          </label>
                          <Select
                            value={editingProvider.aspectRatio || "16:9"}
                            onValueChange={(val: any) =>
                              setEditingProvider({
                                ...editingProvider,
                                aspectRatio: val,
                              })
                            }
                          >
                            <SelectTrigger className="w-full h-8 rounded-[8px] bg-neutral-100 dark:bg-[#2b2b2b] border border-transparent text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                              <SelectItem
                                value="16:9"
                                className="text-xs cursor-pointer"
                              >
                                16:9 (Widescreen)
                              </SelectItem>
                              <SelectItem
                                value="9:16"
                                className="text-xs cursor-pointer"
                              >
                                9:16 (Vertical)
                              </SelectItem>
                              <SelectItem
                                value="1:1"
                                className="text-xs cursor-pointer"
                              >
                                1:1
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* 6. Models Catalog Section */}
                    <div className="space-y-2 pt-2 border-border/40">
                      <div className="flex items-center justify-between pb-1">
                        <div>
                          <label className="text-xs font-medium text-foreground block">
                            {t("settings.models")}
                          </label>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <button
                            type="button"
                            onClick={handleRestoreDefaults}
                            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            {t("settings.restoreDefaults")}
                          </button>
                          <button
                            type="button"
                            onClick={handleFetchModels}
                            disabled={isFetchingModels}
                            className="text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <RefreshCw
                              className={cn(
                                "w-3 h-3",
                                isFetchingModels && "animate-spin",
                              )}
                            />
                            <span>{t("settings.fetchModels")}</span>
                          </button>
                        </div>
                      </div>

                      {/* Models List */}
                      <div className="space-y-2">
                        {!editingProvider.models ||
                        editingProvider.models.length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground bg-secondary/10">
                            {t("settings.noModelsRegistered")}
                          </div>
                        ) : (
                          editingProvider.models.map((model: any) => {
                            const isDefault = currentActiveModelId === model.id;

                            return (
                              <div
                                key={model.id}
                                className={cn(
                                  "p-3 rounded-xl border transition-colors flex items-center justify-between gap-3",
                                  isDefault
                                    ? "bg-secondary/60 border-foreground/30"
                                    : "bg-secondary/20 border-border",
                                )}
                              >
                                <div className="min-w-0 flex items-center gap-3">
                                  <div className="min-w-0">
                                    <span className="block text-xs font-semibold text-foreground truncate">
                                      {modelDisplayName(model.id, model.name)}
                                    </span>
                                    <span className="block text-[11px] text-muted-foreground truncate mt-1">
                                      {model.id}
                                    </span>
                                  </div>
                                  {model.contextWindow && (
                                    <span className="text-[11px] text-muted-foreground font-sans px-2 py-0.5 rounded-md bg-secondary/80 border border-border/60 shrink-0">
                                      {model.contextWindow}
                                    </span>
                                  )}
                                  {model.badge && (
                                    <span className="text-[10px] text-muted-foreground font-sans px-1.5 py-0.5 rounded-md bg-secondary border border-border/50 shrink-0">
                                      {model.badge}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  {isDefault ? (
                                    <span className="text-[11px] font-medium text-foreground/90 px-2.5 py-0.5 rounded-full bg-secondary/80 border border-border/80 flex items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span>{t("settings.defaultBadge")}</span>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetDefaultModel(
                                          model.id,
                                          editingProvider.id,
                                        )
                                      }
                                      className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      {t("settings.setDefault")}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveModelFromForm(model.id)
                                    }
                                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer p-1"
                                    title={t("common.remove")}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* Add Model Row */}
                        {isAddingModel ? (
                          <div className="p-3 rounded-xl border border-dashed border-border bg-secondary/30 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] text-muted-foreground block mb-1">
                                  {t("settings.modelId")}
                                </label>
                                <input
                                  type="text"
                                  value={newModelId}
                                  onChange={(e) =>
                                    setNewModelId(e.target.value)
                                  }
                                  placeholder={t("settings.modelId")}
                                  className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-muted-foreground block mb-1">
                                  {t("settings.contextWindow")}
                                </label>
                                <input
                                  type="text"
                                  value={newModelContext}
                                  onChange={(e) =>
                                    setNewModelContext(e.target.value)
                                  }
                                  placeholder="128K"
                                  className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setIsAddingModel(false)}
                                className="px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                {t("common.cancel")}
                              </button>
                              <button
                                type="button"
                                onClick={handleAddModelToForm}
                                className="px-3 py-1 rounded-lg bg-foreground text-background text-xs font-medium cursor-pointer"
                              >
                                {t("settings.addModel")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsAddingModel(true)}
                            className="px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs text-foreground font-medium transition-colors cursor-pointer flex items-center gap-1.5 mt-2"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t("settings.addCustomModel")}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 7. Expanded Card Bottom Actions */}
                    <div className="flex items-center justify-between gap-2.5 pt-4 border-border/70">
                      <div>
                        {editingProvider.baseUrl && (
                          <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={isTestingPing}
                            className="px-3.5 py-2 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isTestingPing ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Unplug className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {isTestingPing
                                ? t("settings.testingPing")
                                : t("settings.testPing")}
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-4 py-2 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-colors cursor-pointer"
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyProviderEdit}
                          className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                        >
                          {t("settings.apply")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. Preset Adapter Picker Modal */}
      {isPresetModalOpen && (
        <Dialog open onOpenChange={setIsPresetModalOpen}>
          <DialogContent
            hideClose
            aria-describedby={undefined}
            className="bg-white dark:bg-[#222222] border-0 rounded-2xl w-[calc(100%-32px)] max-w-md p-5 space-y-4 gap-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-medium text-[#262626] dark:text-white">
                {t("settings.addProviderAdapter")} (
                {activeCategory.toUpperCase()})
              </DialogTitle>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="text-xs text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white cursor-pointer"
              >
                {t("common.close")}
              </button>
            </div>

            <ScrollArea className="max-h-72 pr-1">
              <div className="space-y-2">
                {activePresets.map((preset: any) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAddPresetProvider(preset)}
                    className="w-full text-left p-3 rounded-xl border border-[#dedee2] dark:border-[#383838] bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#ebebed] dark:hover:bg-[#333333] transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-xs font-semibold text-[#262626] dark:text-white">
                        {preset.name}
                      </div>
                      <div className="text-[11px] text-[#737373] dark:text-[#969696] truncate max-w-xs">
                        {preset.baseUrl}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-[#737373] dark:text-[#969696] shrink-0" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
