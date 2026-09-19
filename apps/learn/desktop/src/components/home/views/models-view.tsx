import React, { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  Image as ImageIcon,
  ArrowRight,
  ExternalLink,
  Volume2,
  Unplug,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  toast,
  cn,
} from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import {
  type AiModel,
  type AiProvider,
  type ApiProtocol,
  CONST_ROUTER_DEFAULT_MODELS,
  PRESET_PROVIDERS,
  fetchRemoteModels,
  testProviderConnection,
  getStoredAiConfig,
  saveStoredAiConfig,
} from "../../../lib/ai";
import {
  type VoiceConfigState,
  type VoiceProvider,
  type VoiceModelOption,
  INWORLD_MODELS,
  getStoredVoiceConfig,
  saveStoredVoiceConfig,
  getCachedVoices,
  fetchInworldVoices,
  fetchInworldModels,
  synthesizeSpeech,
} from "../../../lib/voice";

interface ModelsViewProps {
  onOpenSettings?: () => void;
  initialCategory?: "llm" | "image" | "voice";
}

type ModelCategory = "llm" | "image" | "voice";

export function ModelsView({ onOpenSettings, initialCategory = "llm" }: ModelsViewProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  // Modality category
  const [activeCategory, setActiveCategory] = useState<ModelCategory>(initialCategory);

  // Sliding tab indicator
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
  // LLM State
  // =========================================================================
  const [aiConfig, setAiConfig] = useState(() => getStoredAiConfig());
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<AiProvider | null>(null);

  // Model addition state inside expanded card
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [newModelId, setNewModelId] = useState("");
  const [newModelContext, setNewModelContext] = useState("1M");
  const [isAddingModel, setIsAddingModel] = useState(false);

  // Toggle card expansion smoothly
  const handleToggleExpand = (provider: AiProvider) => {
    if (expandedProviderId === provider.id) {
      setExpandedProviderId(null);
      setEditFormData(null);
      setIsAddingModel(false);
    } else {
      setExpandedProviderId(provider.id);
      setEditFormData(JSON.parse(JSON.stringify(provider)));
      setIsAddingModel(false);
    }
  };

  // Save changes to current provider
  const handleApplyProviderEdit = () => {
    if (!editFormData) return;
    if (!editFormData.name.trim() || !editFormData.baseUrl.trim()) {
      toast.error(isIndo ? "Nama dan Base URL wajib diisi." : "Name and Base URL are required.");
      return;
    }

    let updatedProviders = aiConfig.providers.map((p) =>
      p.id === editFormData.id ? editFormData : p
    );
    if (!aiConfig.providers.some((p) => p.id === editFormData.id)) {
      updatedProviders = [...aiConfig.providers, editFormData];
    }

    const newConfig = {
      ...aiConfig,
      providers: updatedProviders,
    };
    setAiConfig(newConfig);
    saveStoredAiConfig(newConfig);
    setExpandedProviderId(null);
    setEditFormData(null);
    setIsAddingModel(false);
    toast.success(
      isIndo
        ? `Pengaturan provider ${editFormData.name} berhasil disimpan.`
        : `Provider ${editFormData.name} saved successfully.`
    );
  };

  const handleCancelProviderEdit = () => {
    setExpandedProviderId(null);
    setEditFormData(null);
    setIsAddingModel(false);
  };

  const handleDeleteProvider = (providerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (providerId === "const-router") {
      toast.error(isIndo ? "Const Router tidak dapat dihapus." : "Const Router cannot be deleted.");
      return;
    }
    const updated = aiConfig.providers.filter((p) => p.id !== providerId);
    const newConfig = {
      ...aiConfig,
      providers: updated,
    };
    setAiConfig(newConfig);
    saveStoredAiConfig(newConfig);
    if (expandedProviderId === providerId) {
      setExpandedProviderId(null);
      setEditFormData(null);
    }
    toast.success(isIndo ? "Provider dihapus." : "Provider deleted.");
  };

  const handleSetDefaultModel = (modelId: string) => {
    const newConfig = {
      ...aiConfig,
      activeModelId: modelId,
    };
    setAiConfig(newConfig);
    saveStoredAiConfig(newConfig);
    toast.success(
      isIndo ? `Model default diubah ke ${modelId}` : `Default model changed to ${modelId}`
    );
  };

  const handleFetchModels = async () => {
    if (!editFormData) return;
    setIsFetchingModels(true);
    const res = await fetchRemoteModels(editFormData.baseUrl, editFormData.apiKey);
    setIsFetchingModels(false);

    if (res.success && res.models && res.models.length > 0) {
      setEditFormData({
        ...editFormData,
        models: res.models,
      });
      toast.success(
        isIndo
          ? `Berhasil mengambil ${res.models.length} model dari endpoint.`
          : `Successfully fetched ${res.models.length} models from endpoint.`
      );
    } else {
      toast.error(res.error || (isIndo ? "Gagal mengambil model." : "Failed to fetch models."));
    }
  };

  const handleRestoreDefaults = () => {
    if (!editFormData) return;
    if (editFormData.id === "const-router") {
      setEditFormData({
        ...editFormData,
        baseUrl: "https://router.const.web.id/v1",
        protocol: "openai-completions",
        models: CONST_ROUTER_DEFAULT_MODELS,
      });
      toast.success(isIndo ? "Model dikembalikan ke default." : "Models restored to default.");
    } else {
      const preset = PRESET_PROVIDERS.find((p) => p.id === editFormData.id);
      if (preset) {
        setEditFormData({
          ...editFormData,
          baseUrl: preset.baseUrl,
          protocol: preset.protocol,
          models: [], // No preset models!
        });
        toast.success(isIndo ? "Konfigurasi direset ke preset." : "Config restored to preset.");
      }
    }
  };

  const handleAddModelToForm = () => {
    if (!editFormData || !newModelId.trim()) return;
    const trimmedId = newModelId.trim();
    if (editFormData.models.some((m) => m.id === trimmedId)) {
      toast.error(isIndo ? "Model ID sudah ada." : "Model ID already exists.");
      return;
    }
    const newModel: AiModel = {
      id: trimmedId,
      name: trimmedId,
      contextWindow: newModelContext.trim() || "1M",
      maxOutputTokens: "128K",
    };
    setEditFormData({
      ...editFormData,
      models: [...editFormData.models, newModel],
    });
    setNewModelId("");
    setIsAddingModel(false);
  };

  const handleRemoveModelFromForm = (modelId: string) => {
    if (!editFormData) return;
    setEditFormData({
      ...editFormData,
      models: editFormData.models.filter((m) => m.id !== modelId),
    });
  };

  // Add Known Provider Preset (NO PRESET MODELS!)
  const handleAddPresetProvider = (preset: (typeof PRESET_PROVIDERS)[0]) => {
    const existing = aiConfig.providers.find((p) => p.id === preset.id);
    if (existing) {
      setExpandedProviderId(existing.id);
      setEditFormData(JSON.parse(JSON.stringify(existing)));
      setIsPresetModalOpen(false);
      return;
    }
    const newProvider: AiProvider = {
      id: preset.id,
      name: preset.name,
      baseUrl: preset.baseUrl,
      apiKey: "",
      protocol: preset.protocol,
      models: [], // Clean, no dummy preset models!
      isCustom: false,
    };
    const updated = [...aiConfig.providers, newProvider];
    const newConfig = { ...aiConfig, providers: updated };
    setAiConfig(newConfig);
    saveStoredAiConfig(newConfig);

    setExpandedProviderId(newProvider.id);
    setEditFormData(JSON.parse(JSON.stringify(newProvider)));
    setIsPresetModalOpen(false);
  };

  // Connection testing state
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    if (!editFormData) return;
    if (!editFormData.baseUrl.trim()) {
      toast.error(isIndo ? "Base URL wajib diisi untuk menguji koneksi." : "Base URL is required to test connection.");
      return;
    }
    setIsTestingConnection(true);
    const res = await testProviderConnection(editFormData.baseUrl, editFormData.apiKey);
    setIsTestingConnection(false);

    if (res.success) {
      toast.success(
        isIndo
          ? `Koneksi berhasil! Latensi: ${res.latencyMs}ms`
          : `Connected successfully! Latency: ${res.latencyMs}ms`
      );
    } else {
      toast.error(
        res.error || (isIndo ? "Gagal terhubung ke penyedia." : "Connection to provider failed.")
      );
    }
  };

  // Add Custom Provider (Completely empty form as requested)
  const handleAddCustomProvider = () => {
    const id = `custom-${Date.now()}`;
    const newProvider: AiProvider = {
      id,
      name: "",
      baseUrl: "",
      apiKey: "",
      protocol: "openai-completions",
      isCustom: true,
      models: [],
    };
    const updated = [...aiConfig.providers, newProvider];
    const newConfig = { ...aiConfig, providers: updated };
    setAiConfig(newConfig);
    saveStoredAiConfig(newConfig);

    setExpandedProviderId(newProvider.id);
    setEditFormData(JSON.parse(JSON.stringify(newProvider)));
  };

  // =========================================================================
  // Voice State
  // =========================================================================
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfigState>(() => getStoredVoiceConfig());
  const [expandedVoiceProviderId, setExpandedVoiceProviderId] = useState<string | null>(null);
  const [editVoiceFormData, setEditVoiceFormData] = useState<VoiceProvider | null>(null);
  const [cachedVoiceList, setCachedVoiceList] = useState(() => getCachedVoices());
  const [availableVoiceModels, setAvailableVoiceModels] = useState<VoiceModelOption[]>(INWORLD_MODELS);
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);
  const [isFetchingVoiceModels, setIsFetchingVoiceModels] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Live audio time update
  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setAudioCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setAudioDuration(audio.duration || 0);
    const onPlay = () => setIsPlayingAudio(true);
    const onPause = () => setIsPlayingAudio(false);
    const onEnded = () => {
      setIsPlayingAudio(false);
      setAudioCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [testAudioUrl]);

  const toggleAudioPlayback = () => {
    const audio = audioPlayerRef.current;
    if (!audio) return;
    if (isPlayingAudio) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const handleReplayAudio = () => {
    const audio = audioPlayerRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const formatAudioTime = (sec: number) => {
    if (!sec || isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleToggleExpandVoice = (provider: VoiceProvider) => {
    if (expandedVoiceProviderId === provider.id) {
      setExpandedVoiceProviderId(null);
      setEditVoiceFormData(null);
    } else {
      setExpandedVoiceProviderId(provider.id);
      setEditVoiceFormData(JSON.parse(JSON.stringify(provider)));
    }
  };

  const handleApplyVoiceProviderEdit = () => {
    if (!editVoiceFormData) return;
    if (!editVoiceFormData.name.trim() || !editVoiceFormData.baseUrl.trim()) {
      toast.error(isIndo ? "Nama dan Base URL wajib diisi." : "Name and Base URL are required.");
      return;
    }
    let updated = voiceConfig.providers.map((p) =>
      p.id === editVoiceFormData.id ? editVoiceFormData : p
    );
    if (!voiceConfig.providers.some((p) => p.id === editVoiceFormData.id)) {
      updated = [...voiceConfig.providers, editVoiceFormData];
    }
    const newConfig: VoiceConfigState = {
      ...voiceConfig,
      providers: updated,
    };
    setVoiceConfig(newConfig);
    saveStoredVoiceConfig(newConfig);
    setExpandedVoiceProviderId(null);
    setEditVoiceFormData(null);
    toast.success(
      isIndo
        ? `Pengaturan suara ${editVoiceFormData.name} berhasil disimpan.`
        : `Voice provider ${editVoiceFormData.name} saved successfully.`
    );
  };

  const handleCancelVoiceProviderEdit = () => {
    setExpandedVoiceProviderId(null);
    setEditVoiceFormData(null);
  };

  const handleDeleteVoiceProvider = (providerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (providerId === "inworld") {
      toast.error(isIndo ? "Inworld TTS tidak dapat dihapus." : "Inworld TTS cannot be deleted.");
      return;
    }
    const updated = voiceConfig.providers.filter((p) => p.id !== providerId);
    const newConfig = { ...voiceConfig, providers: updated };
    setVoiceConfig(newConfig);
    saveStoredVoiceConfig(newConfig);
    if (expandedVoiceProviderId === providerId) {
      setExpandedVoiceProviderId(null);
      setEditVoiceFormData(null);
    }
    toast.success(isIndo ? "Penyedia suara dihapus." : "Voice provider removed.");
  };

  const [isTestingVoiceConnection, setIsTestingVoiceConnection] = useState(false);

  const handleTestVoiceConnection = async (providerToTest?: VoiceProvider) => {
    const target = providerToTest || editVoiceFormData;
    if (!target) return;
    if (!target.baseUrl.trim()) {
      toast.error(isIndo ? "Base URL wajib diisi untuk menguji koneksi." : "Base URL is required to test connection.");
      return;
    }
    setIsTestingVoiceConnection(true);
    const res = await testProviderConnection(target.baseUrl, target.apiKey);
    setIsTestingVoiceConnection(false);

    if (res.success) {
      toast.success(
        isIndo
          ? `Koneksi endpoint suara berhasil! Latensi: ${res.latencyMs}ms`
          : `Voice endpoint connected! Latency: ${res.latencyMs}ms`
      );
    } else {
      toast.error(
        res.error || (isIndo ? "Gagal terhubung ke endpoint suara." : "Failed to connect to voice endpoint.")
      );
    }
  };

  const handleAddCustomVoiceProvider = () => {
    const id = `custom-voice-${Date.now()}`;
    const newProvider: VoiceProvider = {
      id,
      name: "",
      baseUrl: "",
      protocol: "openai-speech",
      apiKey: "",
      model: "",
      voice: "",
      voiceName: "",
      speed: 1.0,
      isDefault: false,
      isCustom: true,
    };
    const updated = [...voiceConfig.providers, newProvider];
    const newConfig = { ...voiceConfig, providers: updated };
    setVoiceConfig(newConfig);
    saveStoredVoiceConfig(newConfig);

    setExpandedVoiceProviderId(newProvider.id);
    setEditVoiceFormData(JSON.parse(JSON.stringify(newProvider)));
  };

  const handleFetchVoiceList = async (apiKey?: string) => {
    const key = (apiKey || editVoiceFormData?.apiKey || "").trim();
    if (!key) {
      toast.error(isIndo ? "Inworld API Key wajib diisi terlebih dahulu." : "Inworld API Key is required.");
      return;
    }
    setIsFetchingVoices(true);
    const res = await fetchInworldVoices(key);
    setIsFetchingVoices(false);

    if (res.success && res.voices && res.voices.length > 0) {
      setCachedVoiceList(res.voices);
      toast.success(
        isIndo
          ? `Berhasil memuat ${res.voices.length} karakter suara dari Inworld.`
          : `Loaded ${res.voices.length} voice characters from Inworld.`
      );
    } else {
      toast.error(res.error || (isIndo ? "Gagal memuat suara." : "Failed to load voices."));
    }
  };

  const handleFetchVoiceModelsList = async (apiKey?: string) => {
    const key = (apiKey || editVoiceFormData?.apiKey || "").trim();
    if (!key) {
      toast.error(isIndo ? "Inworld API Key wajib diisi terlebih dahulu." : "Inworld API Key is required.");
      return;
    }
    setIsFetchingVoiceModels(true);
    const res = await fetchInworldModels(key);
    setIsFetchingVoiceModels(false);

    if (res.success && res.models && res.models.length > 0) {
      setAvailableVoiceModels(res.models);
      toast.success(
        isIndo
          ? `Berhasil memperbarui model suara.`
          : `Successfully updated voice models.`
      );
    } else {
      toast.error(res.error || (isIndo ? "Gagal memuat model suara." : "Failed to load voice models."));
    }
  };

  const handleTestSpeech = async (customProvider?: VoiceProvider) => {
    const target = customProvider || editVoiceFormData || voiceConfig.providers.find((p) => p.id === voiceConfig.activeProviderId) || voiceConfig.providers[0];
    if (!target) return;
    const textToSay = voiceConfig.testText || "Halo! Suara berhasil terhubung dengan Const Learn.";
    setIsTestingVoice(true);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    }

    const res = await synthesizeSpeech({
      provider: target,
      text: textToSay,
    });
    setIsTestingVoice(false);

    if (res.success && res.audioUrl) {
      setTestAudioUrl(res.audioUrl);
      setTimeout(() => {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.play().catch(() => {});
          setIsPlayingAudio(true);
        }
      }, 100);
      toast.success(isIndo ? "Audio berhasil diputar." : "Audio synthesized successfully.");
    } else {
      toast.error(res.error || (isIndo ? "Gagal mensintesis audio." : "Failed to synthesize audio."));
    }
  };

  return (
    <div className="w-full flex flex-col space-y-6 font-sans">
      {/* 1. Header Section - Strict Match with sources-view & learn-home */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
              {isIndo ? "Model" : "Models"}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-sans">
              Const Router
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isIndo
              ? "Masukkan API key Anda untuk menggunakan model dari penyedia berikut."
              : "Enter your API keys to use models from the following providers."}
          </p>
        </div>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary transition-all cursor-pointer w-fit"
          >
            <span>{t("settings")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. Top Toolbar Row: Modality Switcher (Left) & Add Provider Dropdown (Right) */}
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

        {/* Right Side: Add Provider Dropdown (exact height h-9) */}
        {activeCategory === "llm" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-9 px-3.5 rounded-xl border border-border hover:bg-secondary/70 text-xs font-medium text-foreground transition-all flex items-center gap-1.5 cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isIndo ? "Tambah penyedia" : "Add provider"}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-card border-border text-foreground p-1 rounded-xl shadow-xl">
              <DropdownMenuItem
                onClick={() => setIsPresetModalOpen(true)}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{isIndo ? "Pilih penyedia adapter" : "Add provider"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleAddCustomProvider}
                className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{isIndo ? "Tambah kustom penyedia" : "Add a custom provider"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {activeCategory === "voice" && (
          <button
            type="button"
            onClick={handleAddCustomVoiceProvider}
            className="h-9 px-3.5 rounded-xl border border-border hover:bg-secondary/70 text-xs font-medium text-foreground transition-all flex items-center gap-1.5 cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isIndo ? "Tambah penyedia suara" : "Add voice provider"}</span>
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: LLM PROVIDERS & MODELS                                         */}
      {/* ===================================================================== */}
      {activeCategory === "llm" && (
        <div className="space-y-3">
          {aiConfig.providers.map((provider) => {
            const isExpanded = expandedProviderId === provider.id;

            return (
              <div
                key={provider.id}
                className={cn(
                  "rounded-2xl border border-border bg-card/60 transition-all duration-300 overflow-hidden",
                  isExpanded ? "bg-card/90 border-border/90 shadow-xs" : "hover:border-foreground/20 hover:bg-secondary/30"
                )}
              >
                {/* Provider Card Header - Clicking toggles smooth expansion */}
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
                      {isExpanded ? (isIndo ? "Tutup" : "Close") : "Edit"}
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
                {isExpanded && editFormData && (
                  <div className="px-5 pb-5 pt-2 space-y-5 border-t border-border/40 animate-in fade-in-50 duration-200">
                    {/* Subtitle without raw debug ID */}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {editFormData.name || (isIndo ? "Penyedia Baru" : "New Provider")}
                      </h3>
                    </div>

                    {/* 1. Display name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        Display name
                      </label>
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, name: e.target.value })
                        }
                        placeholder="e.g. ConstRouter, DeepSeek, or OpenAI"
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
                        value={editFormData.baseUrl}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, baseUrl: e.target.value })
                        }
                        placeholder="https://..."
                        className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                      />
                    </div>

                    {/* 3. API Protocol */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        API protocol
                      </label>
                      <Select
                        value={editFormData.protocol}
                        onValueChange={(val) =>
                          setEditFormData({
                            ...editFormData,
                            protocol: val as ApiProtocol,
                          })
                        }
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                          <SelectValue placeholder="Select API protocol" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                          <SelectItem value="anthropic-messages" className="text-xs cursor-pointer">
                            Anthropic messages (/v1/messages)
                          </SelectItem>
                          <SelectItem value="openai-completions" className="text-xs cursor-pointer">
                            Chat completions (/chat/completions)
                          </SelectItem>
                          <SelectItem value="openai-responses" className="text-xs cursor-pointer">
                            Responses (/responses)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 4. API Key */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        API key
                      </label>
                      <input
                        type="password"
                        value={editFormData.apiKey || ""}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, apiKey: e.target.value })
                        }
                        placeholder={
                          editFormData.isDefault
                            ? "Configured — enter a new value to replace"
                            : "Enter an API key, or leave blank to use router gateway"
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:border-foreground/40 transition-colors"
                      />
                    </div>

                    {/* 5. Models Catalog Section - NO ICONS, Name & Context Only */}
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
                        {editFormData.models.length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground bg-secondary/10">
                            {isIndo
                              ? "Belum ada model yang terdaftar. Masukkan API key lalu klik 'Fetch available models' atau tambah model secara manual."
                              : "No models configured. Enter API key and click 'Fetch available models' or add manually."}
                          </div>
                        ) : (
                          editFormData.models.map((model) => {
                            const isDefault = aiConfig.activeModelId === model.id;

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
                                  <span className="text-[11px] text-muted-foreground font-sans px-2 py-0.5 rounded-md bg-secondary/80 border border-border/60 shrink-0">
                                    {model.contextWindow || "1M"} Context
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  {isDefault ? (
                                    <span className="text-[11px] font-medium text-foreground/90 px-2.5 py-0.5 rounded-full bg-secondary/80 border border-border/80 flex items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span>Default</span>
                                    </span>
                                  ) : (
                                    /* Only show Set Default for default router or non-custom provider */
                                    (editFormData.isDefault || !editFormData.isCustom) && (
                                      <button
                                        type="button"
                                        onClick={() => handleSetDefaultModel(model.id)}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                      >
                                        Set Default
                                      </button>
                                    )
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
                                  Context Window
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

                    {/* 6. Expanded Card Bottom Actions */}
                    <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-border/70">
                      <div>
                        {editFormData.baseUrl && (
                          <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={isTestingConnection}
                            className="px-3.5 py-2 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isTestingConnection ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Unplug className="w-3.5 h-3.5" />
                            )}
                            <span>{isTestingConnection ? (isIndo ? "Menguji..." : "Testing...") : (isIndo ? "Uji Koneksi" : "Test Connection")}</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleCancelProviderEdit}
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
          })}

          {/* Preset Modal (Zero dummy models!) */}
          {isPresetModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Add Provider</h3>
                  <button
                    type="button"
                    onClick={() => setIsPresetModalOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select a provider adapter to configure. Models will be fetched directly using your API key:
                </p>

                <div className="space-y-2">
                  {PRESET_PROVIDERS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleAddPresetProvider(preset)}
                      className="w-full text-left p-3 rounded-xl border border-border hover:bg-secondary/60 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-semibold text-foreground">{preset.name}</div>
                        <div className="text-[11px] text-muted-foreground font-sans">
                          {preset.baseUrl}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: VOICE PROVIDERS & MODELS                                      */}
      {/* ===================================================================== */}
      {activeCategory === "voice" && (
        <div className="space-y-3">
          {voiceConfig.providers.map((provider) => {
            const isExpanded = expandedVoiceProviderId === provider.id;

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
                {/* Header */}
                <div
                  onClick={() => handleToggleExpandVoice(provider)}
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
                        handleToggleExpandVoice(provider);
                      }}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                        isExpanded
                          ? "bg-secondary text-foreground border-foreground/30 font-semibold"
                          : "border-border hover:bg-secondary text-foreground"
                      )}
                    >
                      {isExpanded ? (isIndo ? "Tutup" : "Close") : "Edit"}
                    </button>
                    {!provider.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteVoiceProvider(provider.id, e)}
                        className="px-3.5 py-1.5 rounded-xl border border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 text-destructive text-xs font-medium transition-all cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Body */}
                {isExpanded && editVoiceFormData && (
                  <div className="px-5 pb-5 pt-2 space-y-5 border-t border-border/40 animate-in fade-in-50 duration-200">
                    {/* Subtitle */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">
                        {editVoiceFormData.name}
                        <span className="text-xs font-normal text-muted-foreground ml-2">
                          {editVoiceFormData.id}
                        </span>
                      </h3>
                      {editVoiceFormData.protocol === "inworld" && (
                        <a
                          href="https://platform.inworld.ai/api-keys"
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <span>Get API Key</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* 1. Display name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        Display name
                      </label>
                      <input
                        type="text"
                        value={editVoiceFormData.name}
                        onChange={(e) =>
                          setEditVoiceFormData({ ...editVoiceFormData, name: e.target.value })
                        }
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
                        value={editVoiceFormData.baseUrl}
                        onChange={(e) =>
                          setEditVoiceFormData({ ...editVoiceFormData, baseUrl: e.target.value })
                        }
                        placeholder="e.g. https://api.inworld.ai or https://api.openai.com/v1"
                        className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                      />
                    </div>

                    {/* 3. API Format */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        API format
                      </label>
                      <Select
                        value={editVoiceFormData.protocol}
                        onValueChange={(val: any) =>
                          setEditVoiceFormData({ ...editVoiceFormData, protocol: val })
                        }
                      >
                        <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                          <SelectValue placeholder="Select API format" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                          <SelectItem value="inworld" className="text-xs cursor-pointer">
                            Inworld TTS (Official REST API)
                          </SelectItem>
                          <SelectItem value="openai-speech" className="text-xs cursor-pointer">
                            OpenAI Speech (/v1/audio/speech)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 4. API Key */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground block">
                        API key
                      </label>
                      <input
                        type="password"
                        value={editVoiceFormData.apiKey || ""}
                        onChange={(e) =>
                          setEditVoiceFormData({ ...editVoiceFormData, apiKey: e.target.value })
                        }
                        placeholder="Enter voice provider API key"
                        className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                      />
                    </div>

                    {/* 5. Model & Voice Configuration */}
                    <div className="space-y-4 pt-2 border-t border-border/40">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Voice Character */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-foreground block">
                              Voice Character
                            </label>
                            {editVoiceFormData.protocol === "inworld" && (
                              <button
                                type="button"
                                onClick={() => handleFetchVoiceList(editVoiceFormData.apiKey)}
                                disabled={isFetchingVoices}
                                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={cn("w-3 h-3", isFetchingVoices && "animate-spin")} />
                                <span>Fetch voices</span>
                              </button>
                            )}
                          </div>

                          {editVoiceFormData.protocol === "inworld" ? (
                            <Select
                              value={editVoiceFormData.voice}
                              onValueChange={(val) => {
                                const selected = cachedVoiceList.find((v) => v.id === val);
                                setEditVoiceFormData({
                                  ...editVoiceFormData,
                                  voice: val,
                                  voiceName: selected?.name || val,
                                });
                              }}
                            >
                              <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                                <SelectValue placeholder="Select Voice Character" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl max-h-60">
                                {cachedVoiceList.map((v) => (
                                  <SelectItem key={v.id} value={v.id} className="text-xs cursor-pointer">
                                    {v.name} {v.gender ? "(" + v.gender + ")" : ""} - {v.langCode || "en-US"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <input
                              type="text"
                              value={editVoiceFormData.voice}
                              onChange={(e) =>
                                setEditVoiceFormData({ ...editVoiceFormData, voice: e.target.value })
                              }
                              placeholder="alloy, echo, fable, onyx, nova, or shimmer"
                              className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                            />
                          )}
                        </div>

                        {/* Model */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-foreground block">
                              Model
                            </label>
                            {editVoiceFormData.protocol === "inworld" && (
                              <button
                                type="button"
                                onClick={() => handleFetchVoiceModelsList(editVoiceFormData.apiKey)}
                                disabled={isFetchingVoiceModels}
                                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={cn("w-3 h-3", isFetchingVoiceModels && "animate-spin")} />
                                <span>Fetch models</span>
                              </button>
                            )}
                          </div>

                          {editVoiceFormData.protocol === "inworld" ? (
                            <Select
                              value={editVoiceFormData.model}
                              onValueChange={(val) =>
                                setEditVoiceFormData({ ...editVoiceFormData, model: val })
                              }
                            >
                              <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                                <SelectValue placeholder="Select TTS model" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                                {availableVoiceModels.map((m) => (
                                  <SelectItem key={m.id} value={m.id} className="text-xs cursor-pointer">
                                    {m.name} {m.badge ? "(" + m.badge + ")" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <input
                              type="text"
                              value={editVoiceFormData.model}
                              onChange={(e) =>
                                setEditVoiceFormData({ ...editVoiceFormData, model: e.target.value })
                              }
                              placeholder="tts-1"
                              className="w-full px-3.5 py-2 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                            />
                          )}
                        </div>
                      </div>

                      {/* Speed & Delivery Mode */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {editVoiceFormData.protocol === "inworld" && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground block">
                              Delivery Mode
                            </label>
                            <Select
                              value={editVoiceFormData.deliveryMode || "BALANCED"}
                              onValueChange={(val: any) =>
                                setEditVoiceFormData({ ...editVoiceFormData, deliveryMode: val })
                              }
                            >
                              <SelectTrigger className="w-full h-10 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                                <SelectItem value="BALANCED" className="text-xs cursor-pointer">BALANCED</SelectItem>
                                <SelectItem value="STABLE" className="text-xs cursor-pointer">STABLE</SelectItem>
                                <SelectItem value="EXPRESSIVE" className="text-xs cursor-pointer">EXPRESSIVE</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground block">
                            Speed: {editVoiceFormData.speed || 1.0}x
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={editVoiceFormData.speed || 1.0}
                            onChange={(e) =>
                              setEditVoiceFormData({
                                ...editVoiceFormData,
                                speed: parseFloat(e.target.value),
                              })
                            }
                            className="w-full h-10 accent-foreground cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Embedded Voice Test Playground inside the card */}
                      <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Volume2 className="w-3.5 h-3.5 text-foreground" />
                            <span className="text-xs font-semibold text-foreground">
                              Voice Test Playground
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-sans">
                            {editVoiceFormData.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={voiceConfig.testText || ""}
                            onChange={(e) =>
                              setVoiceConfig({ ...voiceConfig, testText: e.target.value })
                            }
                            placeholder="Type sample text to speak..."
                            className="flex-1 px-3.5 py-2 rounded-xl bg-background/80 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => handleTestSpeech(editVoiceFormData)}
                            disabled={isTestingVoice}
                            className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 hover:opacity-90 active:scale-95 transition-all"
                          >
                            {isTestingVoice ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            <span>{isTestingVoice ? "Synthesizing..." : "Speak"}</span>
                          </button>
                        </div>

                        {/* Custom Studio Audio Player Bar */}
                        {testAudioUrl && (
                          <div className="p-2.5 rounded-xl bg-card border border-border flex items-center gap-3">
                            <button
                              type="button"
                              onClick={toggleAudioPlayback}
                              className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-95 transition-all shrink-0"
                            >
                              {isPlayingAudio ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5 ml-0.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={handleReplayAudio}
                              className="h-8 w-8 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-all shrink-0"
                              title="Replay"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>

                            <div className="flex-1 flex items-center gap-2">
                              <div className="flex items-center gap-0.5 h-4 px-1">
                                {[40, 75, 55, 90, 30, 80, 60, 95, 45, 70, 85, 35].map(
                                  (height, idx) => (
                                    <span
                                      key={idx}
                                      className={cn(
                                        "w-1 rounded-full transition-all duration-200",
                                        isPlayingAudio ? "bg-foreground" : "bg-muted-foreground/40"
                                      )}
                                      style={{
                                        height: isPlayingAudio
                                          ? Math.max(20, height * (0.5 + Math.random() * 0.5)) + "%"
                                          : "30%",
                                      }}
                                    />
                                  )
                                )}
                              </div>

                              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full bg-foreground transition-all duration-100"
                                  style={{
                                    width:
                                      audioDuration > 0
                                        ? ((audioCurrentTime / audioDuration) * 100) + "%"
                                        : "0%",
                                  }}
                                />
                              </div>

                              <span className="text-[10.5px] font-sans text-muted-foreground shrink-0">
                                {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}
                              </span>
                            </div>

                            <audio ref={audioPlayerRef} src={testAudioUrl} className="hidden" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 6. Bottom Actions: Cancel & Apply with Test Connection */}
                    <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-border/70">
                      <div>
                        {editVoiceFormData.baseUrl && (
                          <button
                            type="button"
                            onClick={() => handleTestVoiceConnection(editVoiceFormData)}
                            disabled={isTestingVoiceConnection}
                            className="px-3.5 py-2 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isTestingVoiceConnection ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Unplug className="w-3.5 h-3.5" />
                            )}
                            <span>{isTestingVoiceConnection ? (isIndo ? "Menguji..." : "Testing...") : (isIndo ? "Uji Koneksi" : "Test Connection")}</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleCancelVoiceProviderEdit}
                          className="px-4 py-2 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyVoiceProviderEdit}
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
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: IMAGE MODELS (Clean Empty State per DESIGN.md)                 */}
      {/* ===================================================================== */}
      {activeCategory === "image" && (
        <div className="py-16 px-4 rounded-2xl border border-dashed border-border bg-card/40 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto">
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-lg text-foreground font-medium">
            {isIndo ? "Model Generator Gambar" : "Image Generation Models"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {isIndo
              ? "Integrasi generator visual (Flux, Recraft, OpenRouter) akan segera hadir di Const Learn."
              : "Visual generation model integrations (Flux, Recraft, OpenRouter) are coming soon to Const Learn."}
          </p>
        </div>
      )}
    </div>
  );
}
