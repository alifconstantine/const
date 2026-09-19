import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  Image as ImageIcon,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  ArrowRight,
  Bot,
  Info,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  Cpu,
  Zap,
  Code2,
} from "lucide-react";
import { toast, cn } from "@const/ui";
import { useI18n } from "../../../lib/i18n";
import { BUILTIN_MODELS } from "../../settings/settings-view";
import {
  INWORLD_BASE_URL,
  INWORLD_TTS_MODELS,
  type InworldVoice,
  type InworldConfigState,
  getStoredInworldConfig,
  saveStoredInworldConfig,
  getCachedVoices,
  fetchInworldVoices,
  testInworldVoice,
} from "../../../lib/inworld-service";

interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  apiFormat: "openai" | "anthropic" | "gemini";
  models: string[];
}

const CUSTOM_PROVIDERS_STORAGE_KEY = "const_learn_custom_providers";

function getStoredCustomProviders(): CustomProvider[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PROVIDERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredCustomProviders(providers: CustomProvider[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_PROVIDERS_STORAGE_KEY, JSON.stringify(providers));
  } catch {}
}

interface ModelsViewProps {
  onOpenSettings?: () => void;
  initialCategory?: "llm" | "image" | "voice";
}

type ModelCategory = "llm" | "image" | "voice";

export function ModelsView({ onOpenSettings, initialCategory = "llm" }: ModelsViewProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  // Top Modality Switcher: LLM | Image | Voice
  const [activeCategory, setActiveCategory] = useState<ModelCategory>(initialCategory);

  // Sliding Indicator Animation Refs & State (matching SourcesView animation)
  const llmTabRef = useRef<HTMLButtonElement>(null);
  const imageTabRef = useRef<HTMLButtonElement>(null);
  const voiceTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const updateIndicator = () => {
      let activeEl: HTMLButtonElement | null = null;
      if (activeCategory === "llm") activeEl = llmTabRef.current;
      else if (activeCategory === "image") activeEl = imageTabRef.current;
      else if (activeCategory === "voice") activeEl = voiceTabRef.current;

      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    };

    updateIndicator();
    const timer = setTimeout(updateIndicator, 40);
    window.addEventListener("resize", updateIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeCategory, language]);

  // Selected Left Sidebar Item within each category
  // For LLM: "const-router" | "add-provider" | provider.id
  // For Voice: "inworld" | "add-provider" | provider.id
  // For Image: "imagen" | "add-provider"
  const [selectedProviderId, setSelectedProviderId] = useState<string>("const-router");

  // When switching category, adjust default selectedProviderId
  const handleCategoryChange = (category: ModelCategory) => {
    setActiveCategory(category);
    if (category === "llm") setSelectedProviderId("const-router");
    else if (category === "voice") setSelectedProviderId("inworld");
    else if (category === "image") setSelectedProviderId("imagen");
  };

  // ===========================================================================
  // 1. LLM Const Router State
  // ===========================================================================
  const [activeModel, setActiveModel] = useState<string>(() => {
    return (
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("const_learn_active_model")) ||
      "gemini-3.8-flash"
    );
  });

  // Custom Providers State
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>(() =>
    getStoredCustomProviders()
  );

  // Add/Edit Provider Form State
  const [editingProviderName, setEditingProviderName] = useState("");
  const [editingProviderBaseUrl, setEditingProviderBaseUrl] = useState("");
  const [editingProviderApiKey, setEditingProviderApiKey] = useState("");
  const [editingProviderFormat, setEditingProviderFormat] = useState<"openai" | "anthropic" | "gemini">("openai");
  const [editingProviderModels, setEditingProviderModels] = useState<string[]>([]);
  const [newModelInput, setNewModelInput] = useState("");
  const [isAddingModelInputOpen, setIsAddingModelInputOpen] = useState(false);
  const [showProviderApiKey, setShowProviderApiKey] = useState(false);

  // ===========================================================================
  // 2. Inworld Voice State
  // ===========================================================================
  const [inworldConfig, setInworldConfig] = useState<InworldConfigState>(() =>
    getStoredInworldConfig()
  );
  const [showInworldApiKey, setShowInworldApiKey] = useState(false);
  const [voices, setVoices] = useState<InworldVoice[]>(() => getCachedVoices());
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);
  const [isSavingInworld, setIsSavingInworld] = useState(false);

  // Audio Testing State
  const [testText, setTestText] = useState<string>(
    () =>
      inworldConfig.testText ||
      (isIndo
        ? "Halo! Inworld TTS berhasil terhubung dengan Const Learn."
        : "Hello! Inworld TTS has successfully connected to Const Learn.")
  );
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [testError, setTestError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load configuration on mount without wiping stored keys
  useEffect(() => {
    if (window.electron?.config?.get) {
      window.electron.config
        .get()
        .then((cfg: any) => {
          if (cfg?.activeModel) {
            setActiveModel(cfg.activeModel);
          }
          if (cfg?.voice?.inworld) {
            const electronVoice = cfg.voice.inworld;
            setInworldConfig((prev) => {
              const incomingKey = (electronVoice.apiKey || "").trim();
              const effectiveKey = incomingKey || prev.apiKey;
              return {
                ...prev,
                ...electronVoice,
                apiKey: effectiveKey,
                baseUrl: INWORLD_BASE_URL,
              };
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  // Audio player events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !testAudioUrl) return;

    try {
      audio.load();
    } catch {}

    const handleTimeUpdate = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlayingAudio(false);
      setAudioProgress(0);
    };
    const handlePlay = () => setIsPlayingAudio(true);
    const handlePause = () => setIsPlayingAudio(false);
    const handleError = () => {
      setIsPlayingAudio(false);
      setTestError(
        audio.error?.message ||
          (isIndo ? "Format audio tidak didukung oleh player." : "Audio playback error.")
      );
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("canplay", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("canplay", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, [testAudioUrl]);

  // Handle default model selection in Const Router
  const handleSelectDefaultModel = (modelId: string) => {
    setActiveModel(modelId);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("const_learn_active_model", modelId);
    }
    if (window.electron?.config?.save) {
      window.electron.config.save({ activeModel: modelId }).catch(() => {});
    }
    toast.success(
      isIndo ? `Model default diubah ke ${modelId}` : `Default model set to ${modelId}`
    );
  };

  // Helper to get model icon
  const getModelIcon = (id: string) => {
    if (id.includes("3.8")) return Sparkles;
    if (id.includes("3.7")) return Cpu;
    if (id.includes("coding")) return Code2;
    if (id.includes("fast")) return Zap;
    return Bot;
  };

  // ===========================================================================
  // Custom Provider Handlers
  // ===========================================================================
  const handleOpenAddProvider = () => {
    setEditingProviderName("");
    setEditingProviderBaseUrl("");
    setEditingProviderApiKey("");
    setEditingProviderFormat("openai");
    setEditingProviderModels([]);
    setNewModelInput("");
    setIsAddingModelInputOpen(false);
    setShowProviderApiKey(false);
    setSelectedProviderId("add-provider");
  };

  const handleSelectCustomProvider = (p: CustomProvider) => {
    setEditingProviderName(p.name);
    setEditingProviderBaseUrl(p.baseUrl);
    setEditingProviderApiKey(p.apiKey);
    setEditingProviderFormat(p.apiFormat);
    setEditingProviderModels(p.models || []);
    setNewModelInput("");
    setIsAddingModelInputOpen(false);
    setSelectedProviderId(p.id);
  };

  const handleAddModelToProvider = () => {
    const trimmed = newModelInput.trim();
    if (!trimmed) return;
    if (!editingProviderModels.includes(trimmed)) {
      setEditingProviderModels([...editingProviderModels, trimmed]);
    }
    setNewModelInput("");
    setIsAddingModelInputOpen(false);
  };

  const handleRemoveModelFromProvider = (modelName: string) => {
    setEditingProviderModels(editingProviderModels.filter((m) => m !== modelName));
  };

  const handleSaveCustomProvider = () => {
    const trimmedName = editingProviderName.trim();
    const trimmedBaseUrl = editingProviderBaseUrl.trim();
    if (!trimmedName || !trimmedBaseUrl) {
      toast.error(
        isIndo
          ? "Nama penyedia dan Base URL wajib diisi."
          : "Provider name and Base URL are required."
      );
      return;
    }

    if (editingProviderModels.length === 0) {
      toast.error(
        isIndo
          ? "Tambahkan setidaknya satu model sebelum menyimpan provider."
          : "Add at least one model before saving the provider."
      );
      return;
    }

    const providerId =
      selectedProviderId !== "add-provider"
        ? selectedProviderId
        : `custom-${Date.now()}`;

    const newProvider: CustomProvider = {
      id: providerId,
      name: trimmedName,
      baseUrl: trimmedBaseUrl,
      apiKey: editingProviderApiKey.trim(),
      apiFormat: editingProviderFormat,
      models: editingProviderModels,
    };

    const updatedList =
      selectedProviderId !== "add-provider"
        ? customProviders.map((p) => (p.id === providerId ? newProvider : p))
        : [...customProviders, newProvider];

    setCustomProviders(updatedList);
    saveStoredCustomProviders(updatedList);

    // Sync to Electron main config
    if (window.electron?.config?.save) {
      const customModelsPayload = updatedList.flatMap((p) =>
        p.models.map((m) => ({
          id: `${p.name.toLowerCase()}/${m}`,
          displayName: `${m} (${p.name})`,
          provider: p.id,
          baseUrl: p.baseUrl,
          supportsThinking: true,
          supportsTools: true,
        }))
      );
      const providersPayload: Record<string, any> = {};
      updatedList.forEach((p) => {
        providersPayload[p.id] = {
          name: p.name,
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
        };
      });
      window.electron.config
        .save({
          providers: providersPayload,
          customModels: customModelsPayload,
        })
        .catch(() => {});
    }

    setSelectedProviderId(providerId);
    toast.success(
      isIndo
        ? `Provider ${trimmedName} berhasil disimpan!`
        : `Provider ${trimmedName} saved successfully!`
    );
  };

  const handleDeleteCustomProvider = (providerId: string) => {
    const updated = customProviders.filter((p) => p.id !== providerId);
    setCustomProviders(updated);
    saveStoredCustomProviders(updated);
    if (selectedProviderId === providerId) {
      setSelectedProviderId(activeCategory === "llm" ? "const-router" : "inworld");
    }
    toast.success(isIndo ? "Provider dihapus." : "Provider removed.");
  };

  // ===========================================================================
  // Inworld Voice Handlers
  // ===========================================================================
  const handleFetchVoices = async () => {
    const key = (inworldConfig.apiKey || "").trim();
    if (!key) {
      toast.error(
        isIndo
          ? "Masukkan API Key Inworld terlebih dahulu."
          : "Please enter your Inworld API Key first."
      );
      return;
    }

    setIsFetchingVoices(true);
    try {
      const res = await fetchInworldVoices(key);
      if (res.success && res.voices && res.voices.length > 0) {
        setVoices(res.voices);
        toast.success(
          isIndo
            ? `${res.voices.length} karakter suara berhasil dimuat.`
            : `${res.voices.length} voices loaded successfully.`
        );
      } else {
        toast.error(res.error || "Gagal mengambil daftar suara.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch voices.");
    } finally {
      setIsFetchingVoices(false);
    }
  };

  const handleTestVoice = async () => {
    const key = (inworldConfig.apiKey || "").trim();
    if (!key) {
      toast.error(
        isIndo
          ? "Masukkan API Key Inworld terlebih dahulu."
          : "Please enter your Inworld API Key first."
      );
      return;
    }

    setIsTestingVoice(true);
    setTestError(null);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const res = await testInworldVoice({
        apiKey: key,
        voiceId: inworldConfig.voiceId || "Ashley",
        model: inworldConfig.model || "inworld-tts-2",
        text: testText.trim(),
        deliveryMode: inworldConfig.deliveryMode,
        speakingRate: inworldConfig.speakingRate,
      });

      if (res.success && res.audioUrl) {
        setTestAudioUrl(res.audioUrl);
        toast.success(isIndo ? "Sintesis suara berhasil!" : "Voice synthesized successfully!");
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
        }, 120);
      } else {
        setTestError(res.error || "Gagal menghasilkan audio sampel.");
        toast.error(res.error || "Failed to synthesize voice.");
      }
    } catch (err: any) {
      setTestError(err.message || "Test voice request error.");
      toast.error(err.message || "Test voice failed.");
    } finally {
      setIsTestingVoice(false);
    }
  };

  const togglePlayAudio = async () => {
    const audio = audioRef.current;
    if (!audio || !testAudioUrl) return;
    if (isPlayingAudio) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch (err) {
        console.error("Playback error:", err);
      }
    }
  };

  const handleReplayAudio = async () => {
    const audio = audioRef.current;
    if (!audio || !testAudioUrl) return;
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch (err) {
      console.error("Replay error:", err);
    }
  };

  const handleSaveInworldConfig = async () => {
    setIsSavingInworld(true);
    try {
      const cleanConfig = {
        ...inworldConfig,
        apiKey: (inworldConfig.apiKey || "").trim(),
        testText: testText.trim(),
      };

      const updated = saveStoredInworldConfig(cleanConfig);
      setInworldConfig(updated);

      if (window.electron?.config?.save) {
        await window.electron.config.save({
          voice: {
            activeProvider: "inworld",
            inworld: {
              baseUrl: INWORLD_BASE_URL,
              apiKey: updated.apiKey,
              model: updated.model,
              voiceId: updated.voiceId,
              voiceName: updated.voiceName,
              deliveryMode: updated.deliveryMode,
              speakingRate: updated.speakingRate,
              language: updated.language,
            },
          },
        });
      }

      toast.success(
        isIndo
          ? "Konfigurasi Inworld TTS berhasil disimpan!"
          : "Inworld TTS configuration saved!"
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration.");
    } finally {
      setIsSavingInworld(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background text-foreground font-sans">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex items-start justify-between pb-3">
          <div>
            <h1 className="text-2xl font-normal font-serif tracking-tight text-foreground">
              {isIndo ? "Pengaturan Model" : "Model Settings"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isIndo
                ? "Kelola penyedia model kustom untuk penalaran teks, visual diagram, dan sintesis suara."
                : "Manage custom model providers. Once configured, they can be selected during chat and study sessions."}
            </p>
          </div>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary transition-all cursor-pointer"
            >
              <span>{t("settings")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Modality Switcher Pill Tabs with Smooth Animated Sliding Indicator */}
        <div className="relative flex items-center p-0.5 rounded-xl bg-muted/70 border border-border w-fit mb-5">
          {/* Smooth animated sliding pill background (same as Sources tab animation) */}
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
            onClick={() => handleCategoryChange("llm")}
            className={cn(
              "relative z-10 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none",
              activeCategory === "llm"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            LLM
          </button>
          <button
            ref={imageTabRef}
            type="button"
            onClick={() => handleCategoryChange("image")}
            className={cn(
              "relative z-10 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none",
              activeCategory === "image"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Image
          </button>
          <button
            ref={voiceTabRef}
            type="button"
            onClick={() => handleCategoryChange("voice")}
            className={cn(
              "relative z-10 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer select-none",
              activeCategory === "voice"
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Voice
          </button>
        </div>

        {/* Main Two-Column Card Container (Directly matching wireframe) */}
        <div className="rounded-2xl border border-border/80 bg-card/40 flex flex-col md:flex-row min-h-[540px] overflow-hidden shadow-2xs">
          {/* Left Column: Provider List */}
          <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-border/70 p-4 space-y-4 shrink-0 bg-secondary/15 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 block">
                {isIndo ? "Penyedia" : "Provider"}
              </span>

              {/* Providers for LLM */}
              {activeCategory === "llm" && (
                <div className="space-y-1">
                  {/* Const Router (Native) */}
                  <button
                    type="button"
                    onClick={() => setSelectedProviderId("const-router")}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left",
                      selectedProviderId === "const-router"
                        ? "bg-secondary text-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Bot className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>Const Router</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  </button>

                  {/* Custom Providers */}
                  {customProviders.map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => handleSelectCustomProvider(cp)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left group",
                        selectedProviderId === cp.id
                          ? "bg-secondary text-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Layers className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground" />
                        <span className="truncate">{cp.name}</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Providers for Voice */}
              {activeCategory === "voice" && (
                <div className="space-y-1">
                  {/* Inworld TTS */}
                  <button
                    type="button"
                    onClick={() => setSelectedProviderId("inworld")}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left",
                      selectedProviderId === "inworld"
                        ? "bg-secondary text-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Volume2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Inworld TTS</span>
                    </div>
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        inworldConfig.apiKey.trim() ? "bg-emerald-500" : "bg-muted-foreground/40"
                      )}
                    />
                  </button>

                  {/* Custom Voice Providers if any */}
                  {customProviders
                    .filter((p) => p.apiFormat === "openai")
                    .map((cp) => (
                      <button
                        key={cp.id}
                        type="button"
                        onClick={() => handleSelectCustomProvider(cp)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left group",
                          selectedProviderId === cp.id
                            ? "bg-secondary text-foreground font-semibold shadow-2xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        )}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Layers className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-foreground" />
                          <span className="truncate">{cp.name}</span>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      </button>
                    ))}
                </div>
              )}

              {/* Providers for Image */}
              {activeCategory === "image" && (
                <div className="space-y-1">
                  {/* Google Imagen 3 */}
                  <button
                    type="button"
                    onClick={() => setSelectedProviderId("imagen")}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left",
                      selectedProviderId === "imagen"
                        ? "bg-secondary text-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Google Imagen 3</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  </button>
                </div>
              )}
            </div>

            {/* + Add Provider Button at the bottom of the sidebar */}
            <button
              type="button"
              onClick={handleOpenAddProvider}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-border/80 transition-all cursor-pointer",
                selectedProviderId === "add-provider"
                  ? "bg-foreground text-background border-foreground font-semibold shadow-2xs"
                  : "bg-background/80 hover:bg-secondary text-foreground shadow-2xs active:scale-95"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isIndo ? "Tambah Penyedia" : "Add provider"}</span>
            </button>
          </div>

          {/* Right Column: Configuration / Model List */}
          <div className="flex-1 p-6 md:p-8 flex flex-col justify-between space-y-6">
            {/* =================================================================== */}
            {/* SCENARIO 1: LLM -> CONST ROUTER (List Model Only, No Config Form)   */}
            {/* =================================================================== */}
            {activeCategory === "llm" && selectedProviderId === "const-router" && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">Const Router</h2>
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/70">
                      Default: {activeModel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isIndo
                      ? "Pilih model penalaran default untuk digunakan dalam obrolan asisten AI."
                      : "Select the default reasoning model to use across chat and study sessions."}
                  </p>
                </div>

                <div className="space-y-2.5 max-w-2xl">
                  {BUILTIN_MODELS.map((model) => {
                    const isSelected = activeModel === model.id;
                    const Icon = getModelIcon(model.id);

                    return (
                      <div
                        key={model.id}
                        onClick={() => handleSelectDefaultModel(model.id)}
                        className={cn(
                          "p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 group",
                          isSelected
                            ? "bg-secondary/70 border-foreground/30 shadow-2xs ring-1 ring-foreground/20"
                            : "bg-background border-border/70 hover:border-border hover:bg-secondary/30"
                        )}
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            className={cn(
                              "h-9 w-9 rounded-xl border flex items-center justify-center transition-colors shrink-0 mt-0.5",
                              isSelected
                                ? "bg-foreground text-background border-foreground"
                                : "bg-secondary/80 border-border text-muted-foreground group-hover:text-foreground"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-foreground flex items-center gap-2 flex-wrap">
                              <span>{model.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border/60">
                                {model.contextWindow}
                              </span>
                              {model.supportsThinking && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-500/20">
                                  Thinking
                                </span>
                              )}
                            </div>
                            <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                              {isIndo ? model.descId : model.descEn}
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-foreground text-background text-xs font-semibold shrink-0">
                            <Check className="w-3.5 h-3.5" />
                            <span>{isIndo ? "Default" : "Active"}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectDefaultModel(model.id);
                            }}
                            className="px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground group-hover:text-foreground hover:bg-secondary transition-all shrink-0 cursor-pointer"
                          >
                            {isIndo ? "Pilih Default" : "Set Default"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* SCENARIO 2: ADD OR EDIT CUSTOM PROVIDER (Matching Reference Image)  */}
            {/* =================================================================== */}
            {(selectedProviderId === "add-provider" ||
              customProviders.some((p) => p.id === selectedProviderId)) && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {selectedProviderId === "add-provider"
                        ? isIndo
                          ? "Tambah Penyedia Model"
                          : "Add model provider"
                        : isIndo
                        ? "Edit Penyedia Model"
                        : "Edit model provider"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isIndo
                        ? "Konfigurasi endpoint API kustom dan model awal."
                        : "Configure a custom API endpoint and initial model."}
                    </p>
                  </div>

                  {selectedProviderId !== "add-provider" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomProvider(selectedProviderId)}
                      className="text-xs text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-xl border border-destructive/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isIndo ? "Hapus" : "Delete"}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-4 max-w-xl">
                  {/* Provider Name */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {isIndo ? "Nama" : "Name"}
                    </label>
                    <input
                      type="text"
                      value={editingProviderName}
                      onChange={(e) => setEditingProviderName(e.target.value)}
                      placeholder="e.g. DeepSeek"
                      className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                  </div>

                  {/* Base URL */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={editingProviderBaseUrl}
                      onChange={(e) => setEditingProviderBaseUrl(e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      API key
                    </label>
                    <div className="relative">
                      <input
                        type={showProviderApiKey ? "text" : "password"}
                        value={editingProviderApiKey}
                        onChange={(e) => setEditingProviderApiKey(e.target.value)}
                        placeholder="Enter API key"
                        className="w-full px-3.5 py-2 pr-10 rounded-xl border border-border bg-background text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProviderApiKey(!showProviderApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showProviderApiKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* API format */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      API format
                    </label>
                    <select
                      value={editingProviderFormat}
                      onChange={(e) =>
                        setEditingProviderFormat(e.target.value as "openai" | "anthropic" | "gemini")
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground cursor-pointer"
                    >
                      <option value="openai">OpenAI compatible (/v1/chat/completions)</option>
                      <option value="anthropic">Anthropic messages (/v1/messages)</option>
                      <option value="gemini">Google Gemini (/v1beta/models)</option>
                    </select>
                  </div>

                  {/* Model List */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Model list
                    </label>

                    <div className="rounded-xl border border-dashed border-border/80 p-3.5 space-y-2 bg-secondary/20">
                      {editingProviderModels.length === 0 ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                          <Info className="w-4 h-4 shrink-0 text-muted-foreground/80" />
                          <span>
                            {isIndo
                              ? "Belum ada model dikonfigurasi. Tambahkan model untuk dipakai di chat."
                              : "No models are configured. Add a model to use it in chat."}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 py-1">
                          {editingProviderModels.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-mono text-foreground shadow-2xs"
                            >
                              <span>{m}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveModelFromProvider(m)}
                                className="text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add model row */}
                      {isAddingModelInputOpen ? (
                        <div className="flex items-center gap-2 pt-2">
                          <input
                            type="text"
                            value={newModelInput}
                            onChange={(e) => setNewModelInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddModelToProvider();
                            }}
                            placeholder="e.g. deepseek-chat"
                            className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleAddModelToProvider}
                            className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 cursor-pointer"
                          >
                            {isIndo ? "Tambah" : "Add"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingModelInputOpen(false);
                              setNewModelInput("");
                            }}
                            className="px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {isIndo ? "Batal" : "Cancel"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingModelInputOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isIndo ? "Tambah model" : "Add model"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer for Add Provider */}
                <div className="pt-4 border-t border-border/70 flex items-center justify-between gap-4">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {editingProviderModels.length === 0
                        ? isIndo
                          ? "Tambahkan minimal satu model sebelum menambahkan penyedia."
                          : "Add at least one model before adding the provider."
                        : isIndo
                        ? "Penyedia model akan langsung tersedia di obrolan."
                        : "Provider models will be immediately available in chat."}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCustomProvider}
                    disabled={editingProviderModels.length === 0 || !editingProviderName.trim()}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0",
                      editingProviderModels.length === 0 || !editingProviderName.trim()
                        ? "opacity-50 bg-secondary text-muted-foreground cursor-not-allowed"
                        : "bg-foreground text-background hover:opacity-90 active:scale-95"
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {selectedProviderId === "add-provider"
                        ? isIndo ? "Tambah Penyedia" : "Add provider"
                        : isIndo ? "Simpan Perubahan" : "Save changes"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* SCENARIO 3: VOICE -> INWORLD TTS                                    */}
            {/* =================================================================== */}
            {activeCategory === "voice" && selectedProviderId === "inworld" && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground">Inworld TTS</h2>
                    <a
                      href="https://platform.inworld.ai/api-keys"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (window.electron?.openExternal) {
                          e.preventDefault();
                          window.electron.openExternal("https://platform.inworld.ai/api-keys");
                        }
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 hover:underline"
                    >
                      <span>{isIndo ? "Dapatkan API Key" : "Get Inworld Key"}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isIndo
                      ? "Konfigurasi endpoint API dan model sintesis suara text-to-speech."
                      : "Configure custom API endpoint and speech synthesis model."}
                  </p>
                </div>

                <div className="space-y-4 max-w-xl">
                  {/* Name */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {isIndo ? "Nama" : "Name"}
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value="Inworld TTS (Voice)"
                      className="w-full px-3.5 py-2 rounded-xl border border-border/80 bg-secondary/30 text-xs text-muted-foreground cursor-not-allowed select-all font-mono"
                    />
                  </div>

                  {/* Base URL (Read-only) */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Base URL
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={INWORLD_BASE_URL}
                      className="w-full px-3.5 py-2 rounded-xl border border-border/80 bg-secondary/30 text-xs text-muted-foreground cursor-not-allowed select-all font-mono"
                    />
                  </div>

                  {/* API Key */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-foreground">
                        API key
                      </label>
                      {inworldConfig.apiKey.trim() && (
                        <span className="text-[10.5px] text-emerald-500 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {isIndo ? "Tersimpan" : "Configured"}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showInworldApiKey ? "text" : "password"}
                        value={inworldConfig.apiKey}
                        onChange={(e) =>
                          setInworldConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                        }
                        placeholder="Enter Inworld API key..."
                        className="w-full px-3.5 py-2 pr-10 rounded-xl border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => setShowInworldApiKey(!showInworldApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showInworldApiKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {isIndo ? "Pilih Model" : "Select model"}
                    </label>
                    <select
                      value={inworldConfig.model}
                      onChange={(e) =>
                        setInworldConfig((prev) => ({ ...prev, model: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground cursor-pointer"
                    >
                      {INWORLD_TTS_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.latency})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Voice Persona & Fetch Voice */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {isIndo ? "Karakter Suara" : "Voice persona"}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={inworldConfig.voiceId}
                        onChange={(e) => {
                          const vId = e.target.value;
                          const found = voices.find((v) => v.voiceId === vId);
                          setInworldConfig((prev) => ({
                            ...prev,
                            voiceId: vId,
                            voiceName: found?.displayName || vId,
                          }));
                        }}
                        className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground cursor-pointer"
                      >
                        {voices.map((v) => (
                          <option key={v.voiceId} value={v.voiceId}>
                            {v.displayName} ({v.gender.replace("VOICE_GENDER_", "").toLowerCase()})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleFetchVoices}
                        disabled={isFetchingVoices}
                        className={cn(
                          "px-3 py-2 rounded-xl border border-border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs",
                          isFetchingVoices
                            ? "opacity-60 cursor-not-allowed bg-secondary"
                            : "bg-secondary/60 hover:bg-secondary text-foreground"
                        )}
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", isFetchingVoices && "animate-spin")} />
                        <span>
                          {isFetchingVoices
                            ? isIndo ? "Memuat..." : "Fetching..."
                            : isIndo ? "Ambil Suara" : "Fetch Voices"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Test Voice Section */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {isIndo ? "Uji Coba Suara (TTS)" : "Test Voice (TTS)"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={testText}
                        onChange={(e) => setTestText(e.target.value)}
                        placeholder={
                          isIndo
                            ? "Ketik kalimat uji coba suara..."
                            : "Type sample text to synthesize..."
                        }
                        className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                      />
                      <button
                        type="button"
                        onClick={handleTestVoice}
                        disabled={isTestingVoice}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs",
                          isTestingVoice
                            ? "bg-secondary text-muted-foreground cursor-not-allowed"
                            : "bg-foreground text-background hover:opacity-90 active:scale-95"
                        )}
                      >
                        {isTestingVoice ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>{isIndo ? "Menguji..." : "Synthesizing..."}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{isIndo ? "Uji Suara" : "Test Voice"}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {testError && (
                      <div className="mt-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{testError}</span>
                      </div>
                    )}

                    {/* Minimal Inline Audio Player */}
                    {testAudioUrl && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-secondary/40 border border-border/80 flex items-center justify-between gap-3">
                        <audio ref={audioRef} src={testAudioUrl} preload="auto" />

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={togglePlayAudio}
                            className="h-7 w-7 rounded-lg bg-foreground text-background flex items-center justify-center cursor-pointer hover:opacity-90 transition-all active:scale-95"
                          >
                            {isPlayingAudio ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleReplayAudio}
                            className="h-7 w-7 rounded-lg border border-border/70 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer hover:bg-secondary transition-all"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>

                          <div className="text-[11.5px] font-medium text-foreground">
                            {inworldConfig.voiceId || "Ashley"}{" "}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({audioDuration ? `${audioDuration.toFixed(1)}s` : "Ready"})
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 max-w-[140px] h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-100"
                            style={{ width: `${audioProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer for Voice */}
                <div className="pt-4 border-t border-border/70 flex items-center justify-between gap-4">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isIndo
                        ? "Kredensial tersimpan lokal dengan aman di perangkat Anda."
                        : "Credentials stored securely on your local device."}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveInworldConfig}
                    disabled={isSavingInworld}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0",
                      isSavingInworld
                        ? "opacity-70 bg-secondary text-muted-foreground cursor-not-allowed"
                        : "bg-foreground text-background hover:opacity-90 active:scale-95"
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {isSavingInworld
                        ? isIndo ? "Menyimpan..." : "Saving..."
                        : isIndo ? "Simpan Konfigurasi" : "Save configuration"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* SCENARIO 4: IMAGE -> GOOGLE IMAGEN 3                                */}
            {/* =================================================================== */}
            {activeCategory === "image" && selectedProviderId === "imagen" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Google Imagen 3</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isIndo
                      ? "Generator visual bawaan untuk diagram materi pembelajaran dan konsep studi."
                      : "Default visual generator for educational diagrams and concept illustrations."}
                  </p>
                </div>

                <div className="space-y-3 max-w-xl text-xs">
                  <div className="p-4 rounded-xl border border-border/80 bg-secondary/20">
                    <span className="text-muted-foreground block text-[11px] mb-1">
                      {isIndo ? "Rasio Aspek Default" : "Default Aspect Ratio"}
                    </span>
                    <span className="font-mono font-semibold text-foreground">16:9 (Slide & Video slots)</span>
                  </div>

                  <div className="p-4 rounded-xl border border-border/80 bg-secondary/20">
                    <span className="text-muted-foreground block text-[11px] mb-1">
                      {isIndo ? "Gaya Visual Preferensi" : "Preferred Visual Style"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {isIndo ? "Diagram Edukatif & Skematik Bersih" : "Educational Schematic & Clean Vector"}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/70 flex items-center justify-between gap-4">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isIndo
                        ? "Imagen 3 terintegrasi langsung melalui Const Engine."
                        : "Imagen 3 is natively connected via Const Engine."}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
