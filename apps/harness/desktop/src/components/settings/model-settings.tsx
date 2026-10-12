import React, { useState, useEffect, useRef } from "react";
import {
  toast,
  cn,
  ScrollArea,
  DropdownMenu,
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
  // 1. Modality category state: "llm" | "speech" | "image" | "video"
  const [activeCategory, setActiveCategory] = useState<ModelCategory>(initialCategory);

  // Tab indicator sliding animation refs
  const llmTabRef = useRef<HTMLButtonElement>(null);
  const speechTabRef = useRef<HTMLButtonElement>(null);
  const imageTabRef = useRef<HTMLButtonElement>(null);
  const videoTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
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
  const [config, setConfig] = useState<UnifiedMultiModalConfig>(() => loadMultiModalConfig());

  // Reload config on category change or mount
  useEffect(() => {
    setConfig(loadMultiModalConfig());
  }, [activeCategory]);

  // 3. Provider Accordion Expansion State
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);
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
      toast.success(`Default LLM model set to ${modelId}`);
    } else if (activeCategory === "speech") {
      const updated = {
        ...config.speech,
        activeModelId: modelId,
        activeProviderId: providerId,
      };
      setConfig((prev) => ({ ...prev, speech: updated }));
      saveSpeechConfig(updated);
      toast.success(`Default speech model set to ${modelId}`);
    } else if (activeCategory === "image") {
      const updated = {
        ...config.image,
        activeModelId: modelId,
        activeProviderId: providerId,
      };
      setConfig((prev) => ({ ...prev, image: updated }));
      saveImageConfig(updated);
      toast.success(`Default image model set to ${modelId}`);
    } else if (activeCategory === "video") {
      const updated = {
        ...config.video,
        activeModelId: modelId,
        activeProviderId: providerId,
      };
      setConfig((prev) => ({ ...prev, video: updated }));
      saveVideoConfig(updated);
      toast.success(`Default video model set to ${modelId}`);
    }
  };

  // Delete a provider
  const handleDeleteProvider = (providerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (providerId === "const-router" || providerId === "const") {
      toast.error("Const Router gateway is the built-in default provider and cannot be removed.");
      return;
    }

    if (activeCategory === "llm") {
      const updatedProviders = config.llm.providers.filter((p) => p.id !== providerId);
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
      const updatedProviders = config.speech.providers.filter((p) => p.id !== providerId);
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
      const updatedProviders = config.image.providers.filter((p) => p.id !== providerId);
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
      const updatedProviders = config.video.providers.filter((p) => p.id !== providerId);
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
    toast.success("Provider removed.");
  };

  // Save changes to current provider
  const handleApplyProviderEdit = () => {
    if (!editingProvider) return;
    if (!editingProvider.name.trim() || !editingProvider.baseUrl.trim()) {
      toast.error("Provider Name and Base URL are required.");
      return;
    }

    if (activeCategory === "llm") {
      let updatedProviders = config.llm.providers.map((p) =>
        p.id === editingProvider.id ? editingProvider : p
      );
      if (!config.llm.providers.some((p) => p.id === editingProvider.id)) {
        updatedProviders = [...config.llm.providers, editingProvider];
      }
      const updated = { ...config.llm, providers: updatedProviders };
      setConfig((prev) => ({ ...prev, llm: updated }));
      saveLlmConfig(updated);
    } else if (activeCategory === "speech") {
      let updatedProviders = config.speech.providers.map((p) =>
        p.id === editingProvider.id ? editingProvider : p
      );
      if (!config.speech.providers.some((p) => p.id === editingProvider.id)) {
        updatedProviders = [...config.speech.providers, editingProvider];
      }
      const updated = { ...config.speech, providers: updatedProviders };
      setConfig((prev) => ({ ...prev, speech: updated }));
      saveSpeechConfig(updated);
    } else if (activeCategory === "image") {
      let updatedProviders = config.image.providers.map((p) =>
        p.id === editingProvider.id ? editingProvider : p
      );
      if (!config.image.providers.some((p) => p.id === editingProvider.id)) {
        updatedProviders = [...config.image.providers, editingProvider];
      }
      const updated = { ...config.image, providers: updatedProviders };
      setConfig((prev) => ({ ...prev, image: updated }));
      saveImageConfig(updated);
    } else if (activeCategory === "video") {
      let updatedProviders = config.video.providers.map((p) =>
        p.id === editingProvider.id ? editingProvider : p
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
    toast.success(`Saved settings for ${editingProvider.name}`);
  };

  // Test provider latency / connection
  const handleTestConnection = async () => {
    if (!editingProvider || !editingProvider.baseUrl.trim()) {
      toast.error("Please enter a valid Base URL to test connection.");
      return;
    }
    setIsTestingPing(true);
    const res = await testEndpointPing(
      editingProvider.baseUrl,
      editingProvider.apiKey,
      editingProvider.protocol
    );
    setIsTestingPing(false);

    if (res.success) {
      toast.success(`Connected successfully! Latency: ${res.latencyMs ?? 0}ms`);
    } else {
      toast.error(res.error || "Failed to connect to provider endpoint.");
    }
  };

  // Fetch remote models dynamically from /models endpoint
  const handleFetchModels = async () => {
    if (!editingProvider) return;
    setIsFetchingModels(true);
    const res = await fetchRemoteModels(editingProvider.baseUrl, editingProvider.apiKey);
    setIsFetchingModels(false);

    if (res.success && res.models && res.models.length > 0) {
      const existingIds = new Set((editingProvider.models || []).map((m: any) => m.id));
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
      toast.success(`Discovered ${res.models.length} remote models from endpoint.`);
    } else {
      toast.error(res.error || "Failed to fetch models from endpoint.");
    }
  };

  // Restore models to default / clean state
  const handleRestoreDefaults = () => {
    if (!editingProvider) return;
    if (editingProvider.id === "const-router" || editingProvider.id === "const") {
      setEditingProvider({
        ...editingProvider,
        baseUrl: "https://router.const.web.id/v1",
        protocol: "openai-completions",
        models: CONST_ROUTER_LLM_MODELS,
      });
      toast.success("Restored Const Router default models.");
    } else {
      setEditingProvider({
        ...editingProvider,
        models: [],
      });
      toast.success("Cleared model catalog for custom provider.");
    }
  };

  // Add a model manually inside editing provider
  const handleAddModelToForm = () => {
    if (!editingProvider || !newModelId.trim()) return;
    const cleanId = newModelId.trim();
    if ((editingProvider.models || []).some((m: any) => m.id === cleanId)) {
      toast.error(`Model "${cleanId}" is already registered in this provider.`);
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
    toast.success(`Added model ${cleanId}`);
  };

  // Remove a model from the provider form
  const handleRemoveModelFromForm = (modelId: string) => {
    if (!editingProvider) return;
    setEditingProvider({
      ...editingProvider,
      models: (editingProvider.models || []).filter((m: any) => m.id !== modelId),
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
    toast.success(`Added ${preset.name} adapter.`);
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
      const updated = { ...config.llm, activeProviderId, providers: [...config.llm.providers, newProvider] };
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
      const updated = { ...config.speech, activeProviderId, providers: [...config.speech.providers, newProvider] };
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
      const updated = { ...config.image, activeProviderId, providers: [...config.image.providers, newProvider] };
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
      const updated = { ...config.video, activeProviderId, providers: [...config.video.providers, newProvider] };
      setConfig((prev) => ({ ...prev, video: updated }));
      saveVideoConfig(updated);
    }

    setExpandedProviderId(id);
    setEditingProvider(JSON.parse(JSON.stringify(newProvider)));
  };

  // Speech test audio player
  const handlePlayTestSpeech = (voiceName: string, speed = 1.0) => {
    setIsPlayingSpeech(true);
    playSampleSpeechAudio(
      "Halo! Suara berhasil terhubung dan siap digunakan.",
      voiceName,
      speed,
      () => setIsPlayingSpeech(false)
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
    <div className="w-full flex flex-col space-y-6 font-sans">
      {/* Top Toolbar Row: Modality Sliding Switcher (Left) & Add Provider Dropdown (Right) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Modality Sliding Pill Switcher - exact height h-9 */}
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
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeCategory === "llm"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>LLM</span>
          </button>

          <button
            ref={speechTabRef}
            type="button"
            onClick={() => setActiveCategory("speech")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeCategory === "speech"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Speech</span>
          </button>

          <button
            ref={imageTabRef}
            type="button"
            onClick={() => setActiveCategory("image")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeCategory === "image"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Image</span>
          </button>

          <button
            ref={videoTabRef}
            type="button"
            onClick={() => setActiveCategory("video")}
            className={cn(
              "relative z-10 px-4 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none flex items-center justify-center gap-1.5",
              activeCategory === "video"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <VideoIcon className="w-3.5 h-3.5" />
            <span>Video</span>
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
              <span>Add Provider</span>
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
              <span>Choose Adapter Provider</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleAddCustomProvider}
              className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Add Custom Provider</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ===================================================================== */}
      {/* PROVIDERS & MODELS ACCORDION LIST                                     */}
      {/* ===================================================================== */}
      <div className="space-y-3">
        {currentProviders.length === 0 ? (
          <div className="rounded-2xl border border-[#dedee2] dark:border-[#383838] bg-[#f9f9fb] dark:bg-[#222222] px-6 py-11 sm:px-10 sm:py-13 flex flex-col items-center text-center">
            {/* Bespoke Studio Modality Schematic Stage */}
            <div className="mb-6">
              {activeCategory === "speech" ? (
                <div className="w-68 rounded-2xl bg-[#ffffff] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#303030] p-3.5 shadow-2xs flex flex-col gap-3 select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#262626]/60 dark:bg-white/60" />
                      <span className="text-[11px] font-medium text-[#262626] dark:text-[#d4d4d4]">
                        Neural Voice Engine
                      </span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#f0f0f2] dark:bg-[#262626] text-[#737373] dark:text-[#969696]">
                      24kHz • 1.0x
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#f5f5f7] dark:bg-[#222222]">
                    <div className="w-7 h-7 rounded-lg bg-[#262626] dark:bg-white text-white dark:text-[#161616] flex items-center justify-center shrink-0">
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </div>
                    <div className="flex items-center gap-[3px] h-5 flex-1 px-0.5">
                      {[35, 65, 95, 50, 80, 100, 60, 40, 85, 70, 45, 90, 55, 30, 60, 40, 25, 45].map(
                        (h, idx) => (
                          <span
                            key={idx}
                            style={{ height: `${h}%` }}
                            className={cn(
                              "flex-1 rounded-full",
                              idx < 11
                                ? "bg-[#262626]/75 dark:bg-white/75"
                                : "bg-[#262626]/20 dark:bg-white/20"
                            )}
                          />
                        )
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-[#737373] dark:text-[#969696] shrink-0">
                      0:14
                    </span>
                  </div>
                </div>
              ) : activeCategory === "image" ? (
                <div className="w-68 rounded-2xl bg-[#ffffff] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#303030] p-3 shadow-2xs flex flex-col gap-2.5 select-none">
                  <div className="h-24 rounded-xl bg-[#f3f3f6] dark:bg-[#222222] border border-[#dedee2]/70 dark:border-[#2e2e2e] relative overflow-hidden flex items-center justify-center">
                    {/* Corner Framing Marks */}
                    <span className="absolute top-2.5 left-2.5 w-2.5 h-2.5 border-t border-l border-[#262626]/30 dark:border-white/30" />
                    <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 border-t border-r border-[#262626]/30 dark:border-white/30" />
                    <span className="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 border-b border-l border-[#262626]/30 dark:border-white/30" />
                    <span className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 border-b border-r border-[#262626]/30 dark:border-white/30" />

                    {/* Minimalist Geometric Horizon Composition */}
                    <div className="w-4 h-4 rounded-full bg-[#262626]/20 dark:bg-white/20 absolute top-4 right-9" />
                    <div className="w-28 h-28 rounded-full bg-[#262626]/[0.06] dark:bg-white/[0.06] absolute -bottom-16 -left-4" />
                    <div className="w-32 h-32 rounded-full bg-[#262626]/[0.11] dark:bg-white/[0.11] absolute -bottom-20 right-2" />
                    <div className="w-8 h-8 rounded-xl bg-[#ffffff]/90 dark:bg-[#2b2b2b]/90 border border-[#dedee2] dark:border-[#383838] flex items-center justify-center shadow-2xs z-10">
                      <ImageIcon className="w-4 h-4 text-[#262626] dark:text-white" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-medium text-[#262626] dark:text-[#d4d4d4]">
                      Canvas Synthesis
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#f0f0f2] dark:bg-[#262626] text-[#737373] dark:text-[#969696]">
                        1024×1024
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#f0f0f2] dark:bg-[#262626] text-[#737373] dark:text-[#969696]">
                        HD
                      </span>
                    </div>
                  </div>
                </div>
              ) : activeCategory === "video" ? (
                <div className="w-68 rounded-2xl bg-[#ffffff] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#303030] p-3 shadow-2xs flex flex-col gap-2.5 select-none">
                  <div className="h-20 rounded-xl bg-[#f3f3f6] dark:bg-[#222222] border border-[#dedee2]/70 dark:border-[#2e2e2e] relative flex items-center justify-center overflow-hidden">
                    <span className="absolute top-2 left-2.5 text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-[#ffffff]/80 dark:bg-[#161616]/80 text-[#555555] dark:text-[#969696]">
                      1080p • 16:9
                    </span>
                    <span className="absolute top-2 right-2.5 text-[9.5px] font-medium text-[#737373] dark:text-[#969696]">
                      24 FPS
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-[#262626] dark:bg-white text-white dark:text-[#161616] flex items-center justify-center shadow-2xs">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                  </div>
                  {/* Mini Timeline Scrubber */}
                  <div className="h-6 rounded-lg bg-[#f3f3f6] dark:bg-[#222222] px-2 flex items-center gap-1.5 relative">
                    <div className="h-2 rounded-xs bg-[#262626]/65 dark:bg-white/65 w-12" />
                    <div className="h-2 rounded-xs bg-[#262626]/35 dark:bg-white/35 w-16" />
                    <div className="h-2 rounded-xs bg-[#262626]/15 dark:bg-white/15 flex-1" />
                    <div className="absolute left-15 top-1 bottom-1 w-[1.5px] bg-[#262626] dark:bg-white rounded-full" />
                  </div>
                </div>
              ) : (
                <div className="w-68 rounded-2xl bg-[#ffffff] dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#303030] p-3.5 shadow-2xs flex flex-col gap-2.5 select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-[#262626] dark:text-white" />
                      <span className="text-[11px] font-medium text-[#262626] dark:text-[#d4d4d4]">
                        Reasoning Stream
                      </span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#f0f0f2] dark:bg-[#262626] text-[#737373] dark:text-[#969696]">
                      128K
                    </span>
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    <div className="h-2 w-5/6 rounded-full bg-[#262626]/20 dark:bg-white/20" />
                    <div className="h-2 w-2/3 rounded-full bg-[#262626]/12 dark:bg-white/12" />
                  </div>
                </div>
              )}
            </div>

            {/* Title & Description */}
            <h3 className="text-[15px] font-semibold text-[#262626] dark:text-white tracking-tight">
              {activeCategory === "speech"
                ? "No speech providers configured"
                : activeCategory === "image"
                ? "No image providers configured"
                : activeCategory === "video"
                ? "No video providers configured"
                : "No language model providers configured"}
            </h3>
            <p className="text-xs text-[#737373] dark:text-[#969696] max-w-md mt-1.5 leading-relaxed">
              {activeCategory === "speech"
                ? "Connect a speech synthesis adapter or custom audio endpoint to enable voice responses, character selection, and live audio previews."
                : activeCategory === "image"
                ? "Connect an image generation adapter or custom endpoint to synthesize visual assets, diagrams, and high-resolution artwork."
                : activeCategory === "video"
                ? "Connect a video synthesis adapter or custom endpoint to generate widescreen clips, motion graphics, and visual sequences."
                : "Connect an LLM adapter or custom completion endpoint to power coding tasks, reasoning, and agent workflows."}
            </p>

            {/* Subtle Capability Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
              {(activeCategory === "speech"
                ? ["OpenAI Speech API", "Multi-Voice & Rate", "Live Voice Preview"]
                : activeCategory === "image"
                ? ["OpenRouter & OpenAI", "Multi-Aspect Ratio", "HD Synthesis"]
                : activeCategory === "video"
                ? ["1080p & 720p HD", "16:9 & 9:16", "Motion Generation"]
                : ["Chat Completions", "Anthropic Messages", "Dynamic Model Sync"]
              ).map((feature) => (
                <span
                  key={feature}
                  className="text-[11px] text-[#737373] dark:text-[#969696] bg-[#ebebed]/80 dark:bg-[#1a1a1a] border border-[#dedee2] dark:border-[#2e2e2e] px-2.5 py-1 rounded-lg"
                >
                  {feature}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(true)}
                className="h-9 px-4 rounded-xl bg-[#262626] dark:bg-white text-white dark:text-[#161616] text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Choose Adapter</span>
              </button>
              <button
                type="button"
                onClick={handleAddCustomProvider}
                className="h-9 px-4 rounded-xl bg-[#ffffff] dark:bg-[#2b2b2b] hover:bg-[#ebebed] dark:hover:bg-[#333333] text-[#262626] dark:text-[#d4d4d4] border border-[#dedee2] dark:border-[#383838] text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Custom Endpoint</span>
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
                "rounded-2xl border border-border bg-card/60 transition-all duration-300 overflow-hidden",
                isExpanded
                  ? "bg-card/90 border-border/90 shadow-xs"
                  : "hover:border-foreground/20 hover:bg-secondary/30"
              )}
            >
              {/* Provider Card Header */}
              <div
                onClick={() => handleToggleExpand(provider)}
                className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground tracking-tight truncate">
                    {provider.name}
                  </span>
                  {provider.isCustom && (
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10.5px] font-sans border border-border/70 shrink-0">
                      Custom
                    </span>
                  )}
                  {provider.isDefault && (
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10.5px] font-sans border border-border/70 shrink-0">
                      Default
                    </span>
                  )}
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                </div>

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
                        : "border-border hover:bg-secondary text-foreground"
                    )}
                  >
                    {isExpanded ? "Close" : "Edit"}
                  </button>
                  {!provider.isDefault && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteProvider(provider.id, e)}
                      className="px-3.5 py-1.5 rounded-xl border border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 text-destructive text-xs font-medium transition-all cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Smooth Expandable Body */}
              {isExpanded && editingProvider && (
                <div className="px-5 pb-5 pt-2 space-y-5 border-t border-border/40 animate-in fade-in-50 duration-200">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {editingProvider.name || "Configure Provider"}
                    </h3>
                  </div>

                  {/* 1. Display name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      Display name
                    </label>
                    <input
                      type="text"
                      value={editingProvider.name}
                      onChange={(e) =>
                        setEditingProvider({ ...editingProvider, name: e.target.value })
                      }
                      placeholder="e.g. Const Router, OpenAI, or Custom"
                      className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                    />
                  </div>

                  {/* 2. Base URL */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={editingProvider.baseUrl}
                      onChange={(e) =>
                        setEditingProvider({ ...editingProvider, baseUrl: e.target.value })
                      }
                      placeholder="https://..."
                      className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors font-mono"
                    />
                  </div>

                  {/* 3. API Protocol */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      API protocol
                    </label>
                    {activeCategory === "llm" ? (
                      <Select
                        value={editingProvider.protocol || "openai-completions"}
                        onValueChange={(val) =>
                          setEditingProvider({
                            ...editingProvider,
                            protocol: val,
                          })
                        }
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                          <SelectValue placeholder="Select API protocol" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                          <SelectItem value="openai-completions" className="text-xs cursor-pointer">
                            Chat completions (/chat/completions)
                          </SelectItem>
                          <SelectItem value="anthropic-messages" className="text-xs cursor-pointer">
                            Anthropic messages (/v1/messages)
                          </SelectItem>
                          <SelectItem value="openai-responses" className="text-xs cursor-pointer">
                            Responses (/responses)
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
                        <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                          <SelectValue placeholder="Select API format" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                          <SelectItem value="openai-speech" className="text-xs cursor-pointer">
                            OpenAI Speech (/v1/audio/speech)
                          </SelectItem>
                          <SelectItem value="custom" className="text-xs cursor-pointer">
                            Custom Audio Endpoint
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
                        <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                          <SelectValue placeholder="Select API protocol" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                          <SelectItem value="openrouter" className="text-xs cursor-pointer">
                            OpenRouter Images (/images)
                          </SelectItem>
                          <SelectItem value="openai-generations" className="text-xs cursor-pointer">
                            OpenAI Image Generations (/images/generations)
                          </SelectItem>
                          <SelectItem value="custom" className="text-xs cursor-pointer">
                            Custom Direct Endpoint
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
                        <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                          <SelectValue placeholder="Select API protocol" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                          <SelectItem value="openai-video" className="text-xs cursor-pointer">
                            OpenAI Video API
                          </SelectItem>
                          <SelectItem value="custom" className="text-xs cursor-pointer">
                            Custom Direct Endpoint
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* 4. API Key with Visibility Toggle */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      API key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={editingProvider.apiKey || ""}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, apiKey: e.target.value })
                        }
                        placeholder={
                          editingProvider.isDefault
                            ? "Configured — enter a new key to override"
                            : "Enter API key, or leave blank to use router gateway"
                        }
                        className="w-full px-3.5 py-2 pr-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
                        title={showApiKey ? "Hide Key" : "Show Key"}
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
                    <div className="space-y-4 pt-2 border-t border-border/40">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground block">
                            Voice Character
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
                            <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                              <SelectValue placeholder="Select Voice Character" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                              {POPULAR_SPEECH_VOICES.map((v) => (
                                <SelectItem key={v.id} value={v.id} className="text-xs cursor-pointer">
                                  {v.name} - {v.desc}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground block">
                            Speech Rate: {editingProvider.speed || 1.0}x
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
                            Preview voice sample ({editingProvider.voice || "alloy"})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handlePlayTestSpeech(
                              editingProvider.voice || "alloy",
                              editingProvider.speed || 1.0
                            )
                          }
                          disabled={isPlayingSpeech}
                          className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{isPlayingSpeech ? "Playing..." : "Test Audio"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeCategory === "image" && (
                    <div className="space-y-1.5 pt-2 border-t border-border/40">
                      <label className="text-xs font-medium text-foreground block">
                        Default Aspect Ratio
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
                        <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                          <SelectValue placeholder="Select Aspect Ratio" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                          <SelectItem value="1:1" className="text-xs cursor-pointer">1:1 (Square)</SelectItem>
                          <SelectItem value="16:9" className="text-xs cursor-pointer">16:9 (Landscape)</SelectItem>
                          <SelectItem value="9:16" className="text-xs cursor-pointer">9:16 (Portrait)</SelectItem>
                          <SelectItem value="4:3" className="text-xs cursor-pointer">4:3 (Classic)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {activeCategory === "video" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground block">
                          Default Resolution
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
                          <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                            <SelectItem value="720p" className="text-xs cursor-pointer">720p HD</SelectItem>
                            <SelectItem value="1080p" className="text-xs cursor-pointer">1080p Full HD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground block">
                          Aspect Ratio
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
                          <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                            <SelectItem value="16:9" className="text-xs cursor-pointer">16:9 (Widescreen)</SelectItem>
                            <SelectItem value="9:16" className="text-xs cursor-pointer">9:16 (Vertical)</SelectItem>
                            <SelectItem value="1:1" className="text-xs cursor-pointer">1:1 (Square)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* 6. Models Catalog Section */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between pb-1">
                      <div>
                        <label className="text-xs font-medium text-foreground block">
                          Models
                        </label>
                        <span className="text-[11px] text-muted-foreground">
                          Customized model catalog
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <button
                          type="button"
                          onClick={handleRestoreDefaults}
                          className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        >
                          Restore defaults
                        </button>
                        <button
                          type="button"
                          onClick={handleFetchModels}
                          disabled={isFetchingModels}
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          <RefreshCw
                            className={cn("w-3 h-3", isFetchingModels && "animate-spin")}
                          />
                          <span>Fetch available models</span>
                        </button>
                      </div>
                    </div>

                    {/* Models List */}
                    <div className="space-y-2">
                      {(!editingProvider.models || editingProvider.models.length === 0) ? (
                        <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground bg-secondary/10">
                          No models registered. Enter model ID below or fetch from provider.
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
                                  : "bg-secondary/20 border-border"
                              )}
                            >
                              <div className="min-w-0 flex items-center gap-3">
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {model.name || model.id}
                                </span>
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
                                    <span>Default</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSetDefaultModel(model.id, editingProvider.id)}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  >
                                    Set Default
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRemoveModelFromForm(model.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer p-1"
                                  title="Remove model"
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
                                Model ID
                              </label>
                              <input
                                type="text"
                                value={newModelId}
                                onChange={(e) => setNewModelId(e.target.value)}
                                placeholder="e.g. gemini-2.5-flash or gpt-4o"
                                className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground block mb-1">
                                Specs / Context Window
                              </label>
                              <input
                                type="text"
                                value={newModelContext}
                                onChange={(e) => setNewModelContext(e.target.value)}
                                placeholder="e.g. 1M or 128K"
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
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleAddModelToForm}
                              className="px-3 py-1 rounded-lg bg-foreground text-background text-xs font-medium cursor-pointer"
                            >
                              Add
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
                          <span>Add model</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 7. Expanded Card Bottom Actions */}
                  <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-border/70">
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
                          <span>{isTestingPing ? "Testing..." : "Test Connection"}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyProviderEdit}
                        className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                      >
                        Apply
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#f9f9fb] dark:bg-[#222222] border border-[#dedee2] dark:border-[#383838] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#262626] dark:text-white">
                Add {activeCategory.toUpperCase()} Provider Adapter
              </h3>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="text-xs text-[#737373] dark:text-[#969696] hover:text-[#262626] dark:hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-[#737373] dark:text-[#969696]">
              Select an adapter template to prefill endpoint defaults. You can fetch or add models once connected:
            </p>

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
          </div>
        </div>
      )}
    </div>
  );
}
