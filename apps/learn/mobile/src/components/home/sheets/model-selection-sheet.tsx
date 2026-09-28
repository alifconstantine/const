import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Check,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Image as ImageIcon,
  ExternalLink,
  Volume2,
  Unplug,
  Eye,
  EyeOff,
  Sparkles,
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
  ScrollArea,
  toast,
  cn,
} from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import { InteractiveBottomSheet } from "./interactive-bottom-sheet";
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
import {
  type ImageModel,
  type ImageProvider,
  type ImageProtocol,
  type ImageConfigState,
  getStoredImageConfig,
  saveStoredImageConfig,
  testImageModelConnectivity,
  testImageProviderConnection,
} from "../../../lib/image";

export type ModelCategory = "llm" | "voice" | "image";

interface ModelSelectionSheetProps {
  open: boolean;
  onClose: () => void;
  onModelSelected?: (modelId: string) => void;
  initialCategory?: ModelCategory;
}

export function ModelSelectionSheet({
  open,
  onClose,
  onModelSelected,
  initialCategory = "llm",
}: ModelSelectionSheetProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [activeCategory, setActiveCategory] = useState<ModelCategory>(initialCategory);

  // Tab indicator
  const llmTabRef = useRef<HTMLButtonElement>(null);
  const voiceTabRef = useRef<HTMLButtonElement>(null);
  const imageTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (!open) return;
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
    return () => clearTimeout(timer);
  }, [activeCategory, open, language]);

  // =========================================================================
  // LLM State
  // =========================================================================
  const [aiConfig, setAiConfig] = useState(() => getStoredAiConfig());
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<AiProvider | null>(null);

  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  // Model addition
  const [newModelId, setNewModelId] = useState("");
  const [newModelContext, setNewModelContext] = useState("1M");
  const [isAddingModel, setIsAddingModel] = useState(false);

  useEffect(() => {
    if (open) {
      setAiConfig(getStoredAiConfig());
      setImageConfig(getStoredImageConfig());
      if (initialCategory) {
        setActiveCategory(initialCategory);
      }
    }
  }, [open, initialCategory]);

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

  const handleSelectDefaultModel = (modelId: string) => {
    const newConfig = {
      ...aiConfig,
      activeModelId: modelId,
    };
    setAiConfig(newConfig);
    saveStoredAiConfig(newConfig);
    onModelSelected?.(modelId);
    toast.success(
      isIndo ? `Model aktif diubah ke ${modelId}` : `Default model changed to ${modelId}`
    );
  };

  const handleCancelProviderEdit = () => {
    setExpandedProviderId(null);
    setEditFormData(null);
    setIsAddingModel(false);
  };

  const handleApplyProviderEdit = () => {
    if (!editFormData) return;
    if (!editFormData.name.trim() || !editFormData.baseUrl.trim()) {
      toast.error(t("nameAndBaseUrlRequired"));
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
        ? `Pengaturan ${editFormData.name} tersimpan.`
        : `Provider ${editFormData.name} saved.`
    );
  };

  const handleDeleteProvider = (providerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (providerId === "const-router") {
      toast.error(t("constRouterCannotDelete"));
      return;
    }
    const updated = aiConfig.providers.filter((p) => p.id !== providerId);
    const newConfig = { ...aiConfig, providers: updated };
    setAiConfig(newConfig);
    saveStoredAiConfig(newConfig);
    if (expandedProviderId === providerId) {
      setExpandedProviderId(null);
      setEditFormData(null);
    }
    toast.success(isIndo ? "Provider dihapus." : "Provider deleted.");
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
          ? `Berhasil mengambil ${res.models.length} model.`
          : `Fetched ${res.models.length} models.`
      );
    } else {
      toast.error(res.error || t("failedFetchModels"));
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
      toast.success(isIndo ? "Model direset ke default." : "Models restored to default.");
    } else {
      const preset = PRESET_PROVIDERS.find((p) => p.id === editFormData.id);
      if (preset) {
        setEditFormData({
          ...editFormData,
          baseUrl: preset.baseUrl,
          protocol: preset.protocol,
          models: [], // No dummy preset models!
        });
        toast.success(isIndo ? "Konfigurasi direset ke preset." : "Config restored to preset.");
      }
    }
  };

  const handleAddModelToForm = () => {
    if (!editFormData || !newModelId.trim()) return;
    const trimmedId = newModelId.trim();
    if (editFormData.models.some((m) => m.id === trimmedId)) {
      toast.error(t("modelIdExists"));
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
      models: [], // Clean, no dummy models!
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

  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    if (!editFormData) return;
    if (!editFormData.baseUrl.trim()) {
      toast.error(t("baseUrlRequiredToTest"));
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
        res.error || t("failedConnectProvider")
      );
    }
  };

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
      toast.error(t("nameAndBaseUrlRequired"));
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
        ? `Pengaturan suara ${editVoiceFormData.name} tersimpan.`
        : `Voice provider ${editVoiceFormData.name} saved.`
    );
  };

  const handleCancelVoiceProviderEdit = () => {
    setExpandedVoiceProviderId(null);
    setEditVoiceFormData(null);
  };

  const handleDeleteVoiceProvider = (providerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (providerId === "inworld") {
      toast.error(t("inworldTtsCannotDelete"));
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
      toast.error(t("baseUrlRequiredToTest"));
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
        res.error || t("failedConnectProvider")
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
      toast.error(t("inworldApiKeyRequired"));
      return;
    }
    setIsFetchingVoices(true);
    const res = await fetchInworldVoices(key);
    setIsFetchingVoices(false);

    if (res.success && res.voices && res.voices.length > 0) {
      setCachedVoiceList(res.voices);
      toast.success(
        isIndo
          ? `Berhasil memuat ${res.voices.length} karakter suara.`
          : `Loaded ${res.voices.length} voice characters.`
      );
    } else {
      toast.error(res.error || t("failedLoadVoices"));
    }
  };

  const handleFetchVoiceModelsList = async (apiKey?: string) => {
    const key = (apiKey || editVoiceFormData?.apiKey || "").trim();
    if (!key) {
      toast.error(t("inworldApiKeyRequired"));
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
      toast.error(res.error || t("failedLoadVoiceModels"));
    }
  };

  const handleTestSpeech = async (customProvider?: VoiceProvider) => {
    const target = customProvider || editVoiceFormData || voiceConfig.providers.find((p) => p.id === voiceConfig.activeProviderId) || voiceConfig.providers[0];
    if (!target) return;
    const textToSay = voiceConfig.testText || "Halo! Suara berhasil terhubung dengan Const Learn.";
    setIsTestingVoice(true);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
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
        }
      }, 100);
      toast.success(isIndo ? "Memutar audio..." : "Playing audio...");
    } else {
      toast.error(res.error || t("failedSynthesizeAudio"));
    }
  };

  // =========================================================================
  // Image State & Handlers
  // =========================================================================
  const [imageConfig, setImageConfig] = useState<ImageConfigState>(() => getStoredImageConfig());
  const [expandedImageProviderId, setExpandedImageProviderId] = useState<string | null>(null);
  const [editImageFormData, setEditImageFormData] = useState<ImageProvider | null>(null);

  const [isTestingImageConnection, setIsTestingImageConnection] = useState(false);
  const [testingImageModelId, setTestingImageModelId] = useState<string | null>(null);
  const [newImageModelId, setNewImageModelId] = useState("");
  const [newImageModelName, setNewImageModelName] = useState("");
  const [isAddingImageModel, setIsAddingImageModel] = useState(false);
  const [showImageApiKey, setShowImageApiKey] = useState(false);

  const handleToggleExpandImageProvider = (provider: ImageProvider) => {
    if (expandedImageProviderId === provider.id) {
      setExpandedImageProviderId(null);
      setEditImageFormData(null);
      setIsAddingImageModel(false);
    } else {
      setExpandedImageProviderId(provider.id);
      setEditImageFormData(JSON.parse(JSON.stringify(provider)));
      setIsAddingImageModel(false);
    }
  };

  const handleAddCustomImageProvider = () => {
    const id = `custom-img-${Date.now()}`;
    const newProvider: ImageProvider = {
      id,
      name: "",
      baseUrl: "",
      apiKey: "",
      protocol: "openrouter",
      models: [],
    };
    const updated = [...imageConfig.providers, newProvider];
    const newConfig: ImageConfigState = { ...imageConfig, providers: updated };
    setImageConfig(newConfig);
    saveStoredImageConfig(newConfig);

    setExpandedImageProviderId(newProvider.id);
    setEditImageFormData(JSON.parse(JSON.stringify(newProvider)));
    setIsAddingImageModel(false);
  };

  const handleApplyImageProviderEdit = () => {
    if (!editImageFormData) return;
    if (!editImageFormData.name.trim() || !editImageFormData.baseUrl.trim()) {
      toast.error(t("providerNameAndBaseUrlRequired"));
      return;
    }

    let updatedProviders = imageConfig.providers.map((p) =>
      p.id === editImageFormData.id ? editImageFormData : p
    );
    if (!imageConfig.providers.some((p) => p.id === editImageFormData.id)) {
      updatedProviders = [...imageConfig.providers, editImageFormData];
    }

    let activeModelId = imageConfig.activeModelId;
    let activeProviderId = imageConfig.activeProviderId;
    if (!activeModelId && editImageFormData.models.length > 0) {
      activeModelId = editImageFormData.models[0]?.id || "";
      activeProviderId = editImageFormData.id;
    }

    const newConfig: ImageConfigState = {
      ...imageConfig,
      providers: updatedProviders,
      activeModelId,
      activeProviderId,
    };
    setImageConfig(newConfig);
    saveStoredImageConfig(newConfig);
    setExpandedImageProviderId(null);
    setEditImageFormData(null);
    setIsAddingImageModel(false);
    toast.success(isIndo ? "Penyedia gambar berhasil disimpan." : "Image provider saved successfully.");
  };

  const handleCancelImageProviderEdit = () => {
    if (editImageFormData && !editImageFormData.name.trim() && !editImageFormData.baseUrl.trim()) {
      const cleaned = imageConfig.providers.filter((p) => p.id !== editImageFormData.id);
      const newConfig: ImageConfigState = { ...imageConfig, providers: cleaned };
      setImageConfig(newConfig);
      saveStoredImageConfig(newConfig);
    }
    setExpandedImageProviderId(null);
    setEditImageFormData(null);
    setIsAddingImageModel(false);
  };

  const handleDeleteImageProvider = (providerId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = imageConfig.providers.filter((p) => p.id !== providerId);
    let activeProviderId = imageConfig.activeProviderId;
    let activeModelId = imageConfig.activeModelId;
    if (activeProviderId === providerId) {
      activeProviderId = updated[0]?.id || "";
      activeModelId = updated[0]?.models[0]?.id || "";
    }
    const newConfig: ImageConfigState = {
      providers: updated,
      activeProviderId,
      activeModelId,
    };
    setImageConfig(newConfig);
    saveStoredImageConfig(newConfig);
    if (expandedImageProviderId === providerId) {
      setExpandedImageProviderId(null);
      setEditImageFormData(null);
    }
    toast.success(isIndo ? "Penyedia gambar dihapus." : "Image provider removed.");
  };

  const handleTestImageProviderConnection = async (targetProvider?: ImageProvider) => {
    const target = targetProvider || editImageFormData;
    if (!target) return;
    if (!target.baseUrl.trim()) {
      toast.error(t("baseUrlRequiredToTest"));
      return;
    }
    setIsTestingImageConnection(true);
    const res = await testImageProviderConnection(target.baseUrl, target.apiKey, target.protocol);
    setIsTestingImageConnection(false);

    if (res.success) {
      toast.success(
        isIndo
          ? `Koneksi endpoint gambar berhasil! Latensi: ${res.latencyMs}ms`
          : `Image endpoint connected! Latency: ${res.latencyMs}ms`
      );
    } else {
      toast.error(
        res.error || t("failedConnectProvider")
      );
    }
  };

  const handleTestImageModel = async (provider: ImageProvider, modelId: string) => {
    setTestingImageModelId(modelId);
    try {
      const res = await testImageModelConnectivity(provider, modelId);
      if (res.success) {
        toast.success(
          isIndo ? `Model ${modelId} aktif & operasional!` : `Model ${modelId} is operational!`,
          {
            description: isIndo
              ? `Latensi: ${res.latencyMs}ms • Endpoint berhasil merespons.`
              : `Latency: ${res.latencyMs}ms • Endpoint responded successfully.`,
          }
        );
      } else {
        toast.error(
          isIndo ? `Pengujian gagal untuk ${modelId}` : `Test failed for ${modelId}`,
          {
            description: res.error || (isIndo ? "Gagal berkomunikasi dengan provider." : "Failed to communicate with provider."),
          }
        );
      }
    } catch (err: any) {
      toast.error(
        isIndo ? `Error pengujian ${modelId}` : `Error testing ${modelId}`,
        {
          description: err.message || "Unknown error occurred.",
        }
      );
    } finally {
      setTestingImageModelId(null);
    }
  };

  const handleAddModelToImageForm = () => {
    if (!editImageFormData) return;
    const cleanId = newImageModelId.trim();
    if (!cleanId) {
      toast.error(t("modelIdRequired"));
      return;
    }
    if (editImageFormData.models.some((m) => m.id === cleanId)) {
      toast.error(t("modelIdExists"));
      return;
    }

    const newModel: ImageModel = {
      id: cleanId,
      name: newImageModelName.trim() || cleanId,
    };

    setEditImageFormData({
      ...editImageFormData,
      models: [...editImageFormData.models, newModel],
    });
    setNewImageModelId("");
    setNewImageModelName("");
    setIsAddingImageModel(false);
    toast.success(isIndo ? `Model ${cleanId} ditambahkan ke form.` : `Model ${cleanId} added to form.`);
  };

  const handleRemoveModelFromImageForm = (modelId: string) => {
    if (!editImageFormData) return;
    setEditImageFormData({
      ...editImageFormData,
      models: editImageFormData.models.filter((m) => m.id !== modelId),
    });
  };

  const handleSelectActiveImageModel = (providerId: string, modelId: string) => {
    const newConfig: ImageConfigState = {
      ...imageConfig,
      activeProviderId: providerId,
      activeModelId: modelId,
    };
    setImageConfig(newConfig);
    saveStoredImageConfig(newConfig);
    toast.success(
      isIndo
        ? `Model gambar aktif diubah ke ${modelId}`
        : `Active image model set to ${modelId}`
    );
  };

  return (
    <InteractiveBottomSheet
      open={open}
      onClose={onClose}
      defaultHeightVh={75}
      ariaLabel="Models and Voice Settings"
    >
      {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {isIndo ? "Pengaturan Model & Suara" : "Models & Voice"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isIndo
                ? "Kelola penyedia model dan sintesis suara"
                : "Manage AI providers and voice synthesis"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modality Sliding Tabs & Top Add Provider Action - Exact matching height h-9 */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex items-center h-9 p-0.5 rounded-xl bg-muted/70 border border-border flex-1 max-w-[260px]">
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
                "relative z-10 flex-1 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center",
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
                "relative z-10 flex-1 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center",
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
                "relative z-10 flex-1 h-full rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center",
                activeCategory === "image"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Image
            </button>
          </div>

          {/* Right Add Provider Button on Mobile */}
          {activeCategory === "llm" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isIndo ? "Tambah" : "Add"}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground p-1 rounded-xl shadow-xl">
                <DropdownMenuItem
                  onClick={() => setIsPresetModalOpen(true)}
                  className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{isIndo ? "Penyedia adapter" : "Add provider"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleAddCustomProvider}
                  className="text-xs px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary/70 focus:bg-secondary/70 flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{isIndo ? "Kustom penyedia" : "Add a custom provider"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {activeCategory === "voice" && (
            <button
              type="button"
              onClick={handleAddCustomVoiceProvider}
              className="h-9 px-3 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isIndo ? "Tambah" : "Add"}</span>
            </button>
          )}

          {activeCategory === "image" && (
            <button
              type="button"
              onClick={handleAddCustomImageProvider}
              className="h-9 px-3 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isIndo ? "Tambah" : "Add"}</span>
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 min-h-0 w-full" viewportClassName="p-4 space-y-3">
          {/* ================================================================= */}
          {/* TAB 1: LLM                                                        */}
          {/* ================================================================= */}
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
                    {/* Collapsed Header - Clicking toggles smooth expansion */}
                    <div
                      onClick={() => handleToggleExpand(provider)}
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {provider.name}
                        </span>
                        {provider.isDefault && (
                          <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10px] font-sans border border-border/70 shrink-0">
                            Default
                          </span>
                        )}
                        {provider.isCustom && (
                          <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10px] font-sans border border-border/70 shrink-0">
                            Custom
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
                            "px-3 py-1 rounded-xl border text-[11px] font-medium transition-all cursor-pointer",
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
                            className="px-3 py-1 rounded-xl border border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 text-destructive text-[11px] font-medium transition-all cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Smooth Expandable Body */}
                    {isExpanded && editFormData && (
                      <div className="p-4 space-y-4 border-t border-border/40 animate-in fade-in-50 duration-200">
                        {/* Subtitle without raw debug ID */}
                        <div>
                          <h3 className="text-xs font-semibold text-foreground">
                            {editFormData.name || (isIndo ? "Penyedia Baru" : "New Provider")}
                          </h3>
                        </div>

                        {/* 1. Display name */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-foreground block">
                            Display name
                          </label>
                          <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, name: e.target.value })
                            }
                            className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                          />
                        </div>

                        {/* 2. Base URL */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-foreground block">
                            Base URL
                          </label>
                          <input
                            type="text"
                            value={editFormData.baseUrl}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, baseUrl: e.target.value })
                            }
                            placeholder="Provider default"
                            className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                          />
                        </div>

                        {/* 3. API Protocol */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-foreground block">
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
                            <SelectTrigger className="w-full h-9 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                              <SelectValue />
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
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-foreground block">
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
                                ? "Configured — enter new value to replace"
                                : "Enter API key or leave blank"
                            }
                            className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                          />
                        </div>

                        {/* 5. Model Catalog Section */}
                        <div className="space-y-2 pt-1 border-t border-border/40">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-foreground block">
                              Models
                            </label>
                            <div className="flex items-center gap-3 text-[11px]">
                              <button
                                type="button"
                                onClick={handleRestoreDefaults}
                                className="text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={handleFetchModels}
                                disabled={isFetchingModels}
                                className="text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={cn("w-3 h-3", isFetchingModels && "animate-spin")}
                                />
                                <span>Fetch models</span>
                              </button>
                            </div>
                          </div>

                          {/* Models List */}
                          <div className="space-y-1.5">
                            {editFormData.models.length === 0 ? (
                              <div className="p-3 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground bg-secondary/10">
                                {isIndo
                                  ? "Belum ada model. Klik 'Fetch models' atau tambah manual."
                                  : "No models. Click 'Fetch models' or add manually."}
                              </div>
                            ) : (
                              editFormData.models.map((model) => {
                                const isDefault = aiConfig.activeModelId === model.id;

                                return (
                                  <div
                                    key={model.id}
                                    className={cn(
                                      "p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2",
                                      isDefault
                                        ? "bg-secondary/70 border-foreground/30 ring-1 ring-foreground/20"
                                        : "bg-secondary/20 border-border"
                                    )}
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <span className="text-xs font-medium text-foreground truncate">
                                        {model.name || model.id}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary/90 border border-border/60 shrink-0 font-sans">
                                        {model.contextWindow || "1M"}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {isDefault ? (
                                        <span className="text-[10.5px] font-medium text-foreground/90 px-2 py-0.5 rounded-full bg-secondary/80 border border-border/80 flex items-center gap-1">
                                          <Check className="w-3 h-3 text-emerald-500" />
                                          <span>Default</span>
                                        </span>
                                      ) : (
                                        (editFormData.isDefault || !editFormData.isCustom) && (
                                          <button
                                            type="button"
                                            onClick={() => handleSelectDefaultModel(model.id)}
                                            className="text-[11px] text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                                          >
                                            Set Default
                                          </button>
                                        )
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleRemoveModelFromForm(model.id)}
                                        className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}

                            {/* Add model row */}
                            {isAddingModel ? (
                              <div className="p-3 rounded-xl border border-dashed border-border bg-secondary/30 space-y-2">
                                <input
                                  type="text"
                                  value={newModelId}
                                  onChange={(e) => setNewModelId(e.target.value)}
                                  placeholder="Model ID (e.g. gemini-2.5-flash)"
                                  className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsAddingModel(false)}
                                    className="px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleAddModelToForm}
                                    className="px-3 py-1 rounded-lg bg-foreground text-background text-xs font-medium"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsAddingModel(true)}
                                className="px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs text-foreground font-medium transition-colors cursor-pointer flex items-center gap-1.5 mt-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add model</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 6. Bottom Actions: Apply & Cancel with Test Connection */}
                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/70">
                          <div>
                            {editFormData.baseUrl && (
                              <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={isTestingConnection}
                                className="px-2.5 py-1.5 rounded-xl border border-border hover:bg-secondary text-[11px] font-medium text-foreground transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                {isTestingConnection ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Unplug className="w-3 h-3" />
                                )}
                                <span>{isTestingConnection ? "..." : (isIndo ? "Uji" : "Test")}</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCancelProviderEdit}
                              className="px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyProviderEdit}
                              className="px-3.5 py-1.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
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

              {/* Preset Modal */}
              {isPresetModalOpen && (
                <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-foreground">Select Preset</h3>
                      <button
                        type="button"
                        onClick={() => setIsPresetModalOpen(false)}
                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Close
                      </button>
                    </div>

                    <div className="space-y-2">
                      {PRESET_PROVIDERS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleAddPresetProvider(preset)}
                          className="w-full text-left p-2.5 rounded-xl border border-border hover:bg-secondary/60 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <div className="text-xs font-semibold text-foreground">
                              {preset.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-sans">
                              {preset.baseUrl}
                            </div>
                          </div>
                          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

  {/* ===================================================================== */}
          {/* TAB 2: VOICE PROVIDERS & MODELS                                  */}
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
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {provider.name}
                        </span>
                        {provider.isDefault && (
                          <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10px] font-sans border border-border/70 shrink-0">
                            Default
                          </span>
                        )}
                        {provider.isCustom && (
                          <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10px] font-sans border border-border/70 shrink-0">
                            Custom
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
                            "px-3 py-1 rounded-xl border text-[11px] font-medium transition-all cursor-pointer",
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
                            className="px-3 py-1 rounded-xl border border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 text-destructive text-[11px] font-medium transition-all cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Body */}
                    {isExpanded && editVoiceFormData && (
                      <div className="p-4 space-y-4 border-t border-border/40 animate-in fade-in-50 duration-200">
                        {/* Subtitle without raw debug ID */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-foreground">
                            {editVoiceFormData.name || (isIndo ? "Penyedia Suara Baru" : "New Voice Provider")}
                          </h3>
                          {editVoiceFormData.protocol === "inworld" && (
                            <a
                              href="https://platform.inworld.ai/api-keys"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <span>Key</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {/* 1. Display name */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-foreground block">
                            Display name
                          </label>
                          <input
                            type="text"
                            value={editVoiceFormData.name}
                            onChange={(e) =>
                              setEditVoiceFormData({ ...editVoiceFormData, name: e.target.value })
                            }
                            className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                          />
                        </div>

                        {/* 2. Base URL */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-foreground block">
                            Base URL
                          </label>
                          <input
                            type="text"
                            value={editVoiceFormData.baseUrl}
                            onChange={(e) =>
                              setEditVoiceFormData({ ...editVoiceFormData, baseUrl: e.target.value })
                            }
                            placeholder="e.g. https://api.inworld.ai or https://api.openai.com/v1"
                            className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                          />
                        </div>

                        {/* 3. API Format */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-foreground block">
                            API format
                          </label>
                          <Select
                            value={editVoiceFormData.protocol}
                            onValueChange={(val: any) =>
                              setEditVoiceFormData({ ...editVoiceFormData, protocol: val })
                            }
                          >
                            <SelectTrigger className="w-full h-9 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                              <SelectItem value="inworld" className="text-xs cursor-pointer">
                                Inworld TTS (Official REST)
                              </SelectItem>
                              <SelectItem value="openai-speech" className="text-xs cursor-pointer">
                                OpenAI Speech (/v1/audio/speech)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 4. API Key */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-foreground block">
                            API key
                          </label>
                          <input
                            type="password"
                            value={editVoiceFormData.apiKey || ""}
                            onChange={(e) =>
                              setEditVoiceFormData({ ...editVoiceFormData, apiKey: e.target.value })
                            }
                            placeholder="Enter API key"
                            className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none ring-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40 transition-colors"
                          />
                        </div>

                        {/* 5. Voice & Model Configuration */}
                        <div className="space-y-3 pt-1 border-t border-border/40">
                          {/* Voice Character */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-medium text-foreground block">
                                Voice Character
                              </label>
                              {editVoiceFormData.protocol === "inworld" && (
                                <button
                                  type="button"
                                  onClick={() => handleFetchVoiceList(editVoiceFormData.apiKey)}
                                  disabled={isFetchingVoices}
                                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <RefreshCw
                                    className={cn("w-2.5 h-2.5", isFetchingVoices && "animate-spin")}
                                  />
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
                                <SelectTrigger className="w-full h-9 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                                  <SelectValue placeholder="Select Voice Character" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl max-h-56">
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
                                placeholder="alloy, echo, fable, onyx, nova"
                                className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                              />
                            )}
                          </div>

                          {/* Model */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-medium text-foreground block">
                                Model
                              </label>
                              {editVoiceFormData.protocol === "inworld" && (
                                <button
                                  type="button"
                                  onClick={() => handleFetchVoiceModelsList(editVoiceFormData.apiKey)}
                                  disabled={isFetchingVoiceModels}
                                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <RefreshCw
                                    className={cn("w-2.5 h-2.5", isFetchingVoiceModels && "animate-spin")}
                                  />
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
                                <SelectTrigger className="w-full h-9 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                                  {availableVoiceModels.map((m) => (
                                    <SelectItem
                                      key={m.id}
                                      value={m.id}
                                      className="text-xs cursor-pointer"
                                    >
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
                                className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                              />
                            )}
                          </div>

                          {/* Speed & Delivery Mode */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {editVoiceFormData.protocol === "inworld" && (
                              <div>
                                <label className="text-[10px] text-muted-foreground block mb-1">
                                  Delivery Mode
                                </label>
                                <Select
                                  value={editVoiceFormData.deliveryMode || "BALANCED"}
                                  onValueChange={(val: any) =>
                                    setEditVoiceFormData({ ...editVoiceFormData, deliveryMode: val })
                                  }
                                >
                                  <SelectTrigger className="w-full h-8 rounded-lg bg-secondary/30 border border-border text-xs text-foreground">
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

                            <div>
                              <label className="text-[10px] text-muted-foreground block mb-1">
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
                                className="w-full h-8 accent-foreground"
                              />
                            </div>
                          </div>

                          {/* Embedded Voice Test Playground inside card */}
                          <div className="p-3 rounded-xl bg-secondary/30 border border-border/80 space-y-2.5 mt-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Volume2 className="w-3.5 h-3.5 text-foreground" />
                                <span className="text-xs font-semibold text-foreground">
                                  Voice Test Playground
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{editVoiceFormData.name}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={voiceConfig.testText || ""}
                                onChange={(e) =>
                                  setVoiceConfig({ ...voiceConfig, testText: e.target.value })
                                }
                                placeholder="Type text to speak..."
                                className="flex-1 px-3 py-1.5 rounded-xl bg-background/80 border border-border text-xs text-foreground outline-none ring-0 focus:ring-1 focus:ring-foreground/20 focus:border-foreground/40"
                              />
                              <button
                                type="button"
                                onClick={() => handleTestSpeech(editVoiceFormData)}
                                disabled={isTestingVoice}
                                className="px-3.5 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0 hover:opacity-90 active:scale-95 transition-all"
                              >
                                {isTestingVoice ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                                <span>{isTestingVoice ? "..." : "Speak"}</span>
                              </button>
                            </div>

                            {testAudioUrl && (
                              <div className="p-2 rounded-xl bg-card border border-border flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={toggleAudioPlayback}
                                  className="h-7 w-7 rounded-lg bg-foreground text-background flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-95 transition-all shrink-0"
                                >
                                  {isPlayingAudio ? (
                                    <Pause className="w-3 h-3" />
                                  ) : (
                                    <Play className="w-3 h-3 ml-0.5" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={handleReplayAudio}
                                  className="h-7 w-7 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-all shrink-0"
                                  title="Replay"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>

                                <div className="flex-1 flex items-center gap-2">
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

                                  <span className="text-[10px] font-sans text-muted-foreground shrink-0">
                                    {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}
                                  </span>
                                </div>

                                <audio ref={audioPlayerRef} src={testAudioUrl} className="hidden" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 6. Bottom Actions: Cancel & Apply with Test Connection */}
                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/70">
                          <div>
                            {editVoiceFormData.baseUrl && (
                              <button
                                type="button"
                                onClick={() => handleTestVoiceConnection(editVoiceFormData)}
                                disabled={isTestingVoiceConnection}
                                className="px-2.5 py-1.5 rounded-xl border border-border hover:bg-secondary text-[11px] font-medium text-foreground transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                {isTestingVoiceConnection ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Unplug className="w-3 h-3" />
                                )}
                                <span>{isTestingVoiceConnection ? "..." : (isIndo ? "Uji" : "Test")}</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCancelVoiceProviderEdit}
                              className="px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyVoiceProviderEdit}
                              className="px-3.5 py-1.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
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

          {/* ================================================================= */}
          {/* TAB 3: IMAGE MODELS & PROVIDERS                                   */}
          {/* ================================================================= */}
          {activeCategory === "image" && (
            <div className="space-y-3">
              {imageConfig.providers.length === 0 ? (
                <div className="py-12 px-4 rounded-2xl border border-dashed border-border bg-card/40 text-center space-y-3">
                  <div className="h-10 w-10 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1 max-w-xs mx-auto">
                    <h3 className="font-serif text-sm text-foreground font-medium">
                      {isIndo ? "Belum Ada Penyedia Gambar" : "No Image Providers Configured"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {isIndo
                        ? "Dukung OpenRouter, Together AI, OpenAI DALL-E, atau endpoint kustom Anda sendiri."
                        : "Supports OpenRouter, Together AI, OpenAI DALL-E, or your own custom endpoint."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomImageProvider}
                    className="px-3.5 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isIndo ? "Tambah Penyedia" : "Add Provider"}</span>
                  </button>
                </div>
              ) : (
                imageConfig.providers.map((provider) => {
                  const isExpanded = expandedImageProviderId === provider.id;
                  const isActiveProvider = imageConfig.activeProviderId === provider.id;

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
                      {/* Provider Header */}
                      <div
                        onClick={() => handleToggleExpandImageProvider(provider)}
                        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {provider.name || (isIndo ? "Penyedia Baru" : "New Provider")}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10px] font-sans border border-border/70 shrink-0">
                            {provider.models.length} {isIndo ? "model" : "models"}
                          </span>
                          {isActiveProvider && (
                            <span className="px-1.5 py-0.5 rounded-md bg-foreground/10 text-foreground text-[10px] font-medium border border-foreground/20 shrink-0">
                              Active
                            </span>
                          )}
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpandImageProvider(provider);
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer",
                              isExpanded
                                ? "bg-secondary text-foreground border-foreground/30 font-semibold"
                                : "border-border hover:bg-secondary text-foreground"
                            )}
                          >
                            {isExpanded ? (isIndo ? "Tutup" : "Close") : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteImageProvider(provider.id, e)}
                            className="px-2.5 py-1 rounded-lg border border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10 text-destructive text-[11px] font-medium transition-all cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Expanded Form */}
                      {isExpanded && editImageFormData && (
                        <div className="px-3.5 pb-4 pt-1 space-y-4 border-t border-border/40 animate-in fade-in-50 duration-200">
                          {/* 1. Name */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-foreground block">
                              {isIndo ? "Nama Penyedia" : "Provider Name"}
                            </label>
                            <input
                              type="text"
                              value={editImageFormData.name}
                              onChange={(e) =>
                                setEditImageFormData({ ...editImageFormData, name: e.target.value })
                              }
                              placeholder="e.g. OpenRouter, Together AI, OpenAI"
                              className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-foreground/20"
                            />
                          </div>

                          {/* 2. Base URL */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-medium text-foreground block">
                                Base URL
                              </label>
                              <span className="text-[10px] text-muted-foreground font-sans">
                                {editImageFormData.protocol === "openrouter"
                                  ? "/images"
                                  : editImageFormData.protocol === "openai-generations"
                                  ? "/images/generations"
                                  : "direct"}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={editImageFormData.baseUrl}
                              onChange={(e) =>
                                setEditImageFormData({ ...editImageFormData, baseUrl: e.target.value })
                              }
                              placeholder={
                                editImageFormData.protocol === "openrouter"
                                  ? "https://openrouter.ai/api/v1"
                                  : "https://api.openai.com/v1"
                              }
                              className="w-full px-3 py-1.5 rounded-xl bg-secondary/30 border border-border text-xs font-sans text-foreground outline-none focus:ring-1 focus:ring-foreground/20"
                            />
                          </div>

                          {/* 3. API Protocol */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-medium text-foreground block">
                                {isIndo ? "Protokol API" : "API Protocol"}
                              </label>
                              <span className="text-[10px] text-muted-foreground font-sans">
                                {editImageFormData.protocol === "openrouter"
                                  ? "POST /images"
                                  : editImageFormData.protocol === "openai-generations"
                                  ? "POST /images/generations"
                                  : "direct POST"}
                              </span>
                            </div>
                            <Select
                              value={editImageFormData.protocol || "openrouter"}
                              onValueChange={(val) =>
                                setEditImageFormData({
                                  ...editImageFormData,
                                  protocol: val as ImageProtocol,
                                })
                              }
                            >
                              <SelectTrigger className="w-full h-9 rounded-xl bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-foreground/20">
                                <SelectValue placeholder={isIndo ? "Pilih protokol" : "Select protocol"} />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                                <SelectItem value="openrouter" className="text-xs cursor-pointer">
                                  OpenRouter Images (/images)
                                </SelectItem>
                                <SelectItem value="openai-generations" className="text-xs cursor-pointer">
                                  OpenAI Generations (/images/generations)
                                </SelectItem>
                                <SelectItem value="custom" className="text-xs cursor-pointer">
                                  Custom Direct Endpoint
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* 4. API Key */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-foreground block">
                              API Key
                            </label>
                            <div className="relative">
                              <input
                                type={showImageApiKey ? "text" : "password"}
                                value={editImageFormData.apiKey || ""}
                                onChange={(e) =>
                                  setEditImageFormData({ ...editImageFormData, apiKey: e.target.value })
                                }
                                placeholder="sk-..."
                                className="w-full px-3 py-1.5 pr-8 rounded-xl bg-secondary/30 border border-border text-xs font-sans text-foreground outline-none focus:ring-1 focus:ring-foreground/20"
                              />
                              <button
                                type="button"
                                onClick={() => setShowImageApiKey(!showImageApiKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground p-1"
                              >
                                {showImageApiKey ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* 5. Models Catalog */}
                          <div className="space-y-2 pt-2 border-t border-border/40">
                            <div>
                              <label className="text-[11px] font-medium text-foreground block">
                                {isIndo ? "Model Gambar" : "Image Models"}
                              </label>
                              <span className="text-[10px] text-muted-foreground">
                                {isIndo
                                  ? "Tambahkan Model ID manual dan lakukan pengujian."
                                  : "Add Model IDs manually and test connectivity."}
                              </span>
                            </div>

                            {/* Models List */}
                            <div className="space-y-1.5">
                              {editImageFormData.models.length === 0 ? (
                                <div className="p-3 rounded-xl border border-dashed border-border text-center text-[11px] text-muted-foreground bg-secondary/10">
                                  {isIndo
                                    ? "Belum ada model. Tambahkan manual di bawah."
                                    : "No models configured. Add manually below."}
                                </div>
                              ) : (
                                editImageFormData.models.map((model) => {
                                  const isActive = imageConfig.activeModelId === model.id;
                                  const isTestingThisModel = testingImageModelId === model.id;

                                  return (
                                    <div
                                      key={model.id}
                                      className={cn(
                                        "p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2",
                                        isActive
                                          ? "bg-secondary/60 border-foreground/30"
                                          : "bg-secondary/20 border-border"
                                      )}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-semibold text-foreground truncate">
                                          {model.name}
                                        </div>
                                        {model.name !== model.id && (
                                          <div className="text-[10px] text-muted-foreground font-sans truncate">
                                            {model.id}
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {isActive ? (
                                          <span className="text-[10px] font-medium text-foreground px-2 py-0.5 rounded-md bg-foreground/10 border border-foreground/20 flex items-center gap-0.5">
                                            <Check className="w-2.5 h-2.5 text-emerald-500" />
                                            <span>Active</span>
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSelectActiveImageModel(editImageFormData.id, model.id)
                                            }
                                            className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md border border-border hover:bg-secondary cursor-pointer"
                                          >
                                            Set Active
                                          </button>
                                        )}

                                        {/* Test Model button */}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleTestImageModel(editImageFormData, model.id)
                                          }
                                          disabled={isTestingThisModel}
                                          className="px-2 py-0.5 rounded-md border border-border hover:bg-secondary text-[10px] font-medium text-foreground flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                        >
                                          {isTestingThisModel ? (
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                          ) : (
                                            <Play className="w-2.5 h-2.5 text-muted-foreground" />
                                          )}
                                          <span>{isTestingThisModel ? "..." : "Test"}</span>
                                        </button>

                                        {/* Delete Model button */}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveModelFromImageForm(model.id)}
                                          className="h-6 w-6 rounded-md border border-border hover:border-destructive/40 hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Manual Model Add inline form */}
                            {isAddingImageModel ? (
                              <div className="p-3 rounded-xl border border-border bg-secondary/30 space-y-2.5 animate-in fade-in-50 duration-200">
                                <div className="text-[11px] font-semibold text-foreground">
                                  {isIndo ? "Tambah Model Manual" : "Add Model Manually"}
                                </div>
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    value={newImageModelId}
                                    onChange={(e) => setNewImageModelId(e.target.value)}
                                    placeholder="Model ID (e.g. flux-1-schnell, dall-e-3)"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs font-sans text-foreground outline-none focus:ring-1 focus:ring-foreground/20"
                                  />
                                  <input
                                    type="text"
                                    value={newImageModelName}
                                    onChange={(e) => setNewImageModelName(e.target.value)}
                                    placeholder="Display Name (e.g. FLUX.1 Schnell)"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-foreground/20"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsAddingImageModel(false);
                                      setNewImageModelId("");
                                      setNewImageModelName("");
                                    }}
                                    className="px-2.5 py-1 rounded-lg border border-border text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleAddModelToImageForm}
                                    className="px-3 py-1 rounded-lg bg-foreground text-background text-[11px] font-medium cursor-pointer"
                                  >
                                    {isIndo ? "Tambah" : "Add"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsAddingImageModel(true)}
                                className="w-full py-1.5 rounded-xl border border-dashed border-border hover:bg-secondary/40 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{isIndo ? "Tambah Model Manual" : "Add Model Manually"}</span>
                              </button>
                            )}
                          </div>

                          {/* Footer Actions: Test Connection, Cancel, Apply */}
                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/70">
                            <div>
                              {editImageFormData.baseUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleTestImageProviderConnection(editImageFormData)}
                                  disabled={isTestingImageConnection}
                                  className="px-2.5 py-1.5 rounded-xl border border-border hover:bg-secondary text-[11px] font-medium text-foreground flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {isTestingImageConnection ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Unplug className="w-3 h-3" />
                                  )}
                                  <span>{isTestingImageConnection ? "..." : (isIndo ? "Uji Koneksi" : "Test")}</span>
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleCancelImageProviderEdit}
                                className="px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-medium text-foreground cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleApplyImageProviderEdit}
                                className="px-3.5 py-1.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 active:scale-95 cursor-pointer"
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
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3.5 border-t border-border bg-secondary/20 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <span>{isIndo ? "Tersimpan otomatis" : "Auto-saved locally"}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium cursor-pointer hover:opacity-90 active:scale-95 transition-all"
          >
            {isIndo ? "Selesai" : "Done"}
          </button>
        </div>
    </InteractiveBottomSheet>
  );
}
