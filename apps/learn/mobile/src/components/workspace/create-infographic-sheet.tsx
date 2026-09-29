import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  BarChart3,
  Sparkles,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Settings,
  RefreshCw,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";
import { getStoredImageConfig, type ImageProvider, type ImageModel } from "../../lib/image";

export interface CreateInfographicSheetProps {
  open: boolean;
  onClose: () => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    language: "id" | "en";
    orientation: "landscape" | "portrait" | "square";
    style: string;
    detailLevel: "brief" | "standard" | "detailed";
    customDescription?: string;
    providerId?: string;
    modelId?: string;
  }) => void;
  onOpenModelsSettings?: () => void;
}

export type MobileInfographicOrientation = "landscape" | "portrait" | "square";
export type MobileInfographicDetailLevel = "brief" | "standard" | "detailed";

interface StyleItem {
  id: string;
  labelId: string;
  labelEn: string;
  renderThumbnail: () => React.ReactNode;
}

const MOBILE_STYLE_ITEMS: StyleItem[] = [
  {
    id: "auto",
    labelId: "Pilih otomatis",
    labelEn: "Auto select",
    renderThumbnail: () => (
      <div className="w-full h-full bg-gradient-to-br from-blue-500/15 via-background to-indigo-500/15 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
          <RefreshCw className="h-4 w-4" />
        </div>
      </div>
    ),
  },
  {
    id: "kawaii",
    labelId: "Kawaii",
    labelEn: "Kawaii",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none">
        <rect width="160" height="100" fill="#fdf2f8" />
        <path d="M80 18 C62 38, 60 70, 60 78 C70 76, 90 76, 100 78 C100 70, 98 38, 80 18 Z" fill="#a7f3d0" stroke="#059669" strokeWidth="2.5" />
        <circle cx="80" cy="46" r="10" fill="#ffffff" stroke="#059669" strokeWidth="2" />
        <circle cx="77" cy="45" r="3.5" fill="#1e293b" />
        <circle cx="83" cy="45" r="3.5" fill="#1e293b" />
        <ellipse cx="73" cy="50" rx="2.5" ry="1.5" fill="#f472b6" />
        <ellipse cx="87" cy="50" rx="2.5" ry="1.5" fill="#f472b6" />
      </svg>
    ),
  },
  {
    id: "clay",
    labelId: "Tanah liat",
    labelEn: "Claymation",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none">
        <rect width="160" height="100" fill="#d6cfc7" />
        <path d="M80 16 C66 32, 64 68, 64 78 C74 81, 86 81, 96 78 C96 68, 94 32, 80 16 Z" fill="#e0533c" />
        <path d="M65 52 C75 55, 85 55, 95 52 L95 66 C85 69, 75 69, 65 66 Z" fill="#2563eb" />
        <circle cx="80" cy="59" r="6" fill="#f8fafc" stroke="#1d4ed8" strokeWidth="2.5" />
      </svg>
    ),
  },
  {
    id: "sketch_notes",
    labelId: "Catatan Sketsa",
    labelEn: "Sketch Notes",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none">
        <rect width="160" height="100" fill="#ffffff" />
        <path d="M80 15 C68 35, 66 65, 66 75 C75 73, 85 73, 94 75 C94 65, 92 35, 80 15 Z" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <line x1="68" y1="45" x2="74" y2="48" stroke="#0f172a" strokeWidth="1.2" />
        <line x1="68" y1="50" x2="75" y2="53" stroke="#0f172a" strokeWidth="1.2" />
        <circle cx="80" cy="45" r="6" stroke="#0f172a" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    id: "anime",
    labelId: "Anime",
    labelEn: "Anime",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none">
        <rect width="160" height="100" fill="#090d16" />
        <line x1="80" y1="50" x2="10" y2="10" stroke="#38bdf8" strokeWidth="1" opacity="0.4" />
        <line x1="80" y1="50" x2="150" y2="15" stroke="#f43f5e" strokeWidth="1" opacity="0.4" />
        <path d="M110 25 L65 55 L75 80 L125 45 Z" fill="#2563eb" stroke="#93c5fd" strokeWidth="2" />
        <ellipse cx="62" cy="72" rx="12" ry="6" fill="#38bdf8" opacity="0.8" transform="rotate(-35 62 72)" />
      </svg>
    ),
  },
  {
    id: "editorial",
    labelId: "Editorial",
    labelEn: "Editorial",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none">
        <rect width="160" height="100" fill="#f1f5f9" />
        <rect x="15" y="15" width="60" height="70" fill="#0f172a" />
        <rect x="85" y="15" width="60" height="32" fill="#0284c7" />
        <text x="25" y="42" fill="#38bdf8" fontSize="22" fontWeight="900">01</text>
      </svg>
    ),
  },
  {
    id: "vector",
    labelId: "Minimalis Vektor",
    labelEn: "Vector Minimalist",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none">
        <rect width="160" height="100" fill="#0f172a" />
        <circle cx="80" cy="50" r="32" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d="M80 30 L88 56 L72 56 Z" fill="#38bdf8" />
      </svg>
    ),
  },
  {
    id: "3d_photorealistic",
    labelId: "Fotorealistik 3D",
    labelEn: "3D Photorealistic",
    renderThumbnail: () => (
      <div className="w-full h-full bg-gradient-to-b from-[#0a0a0f] via-[#141824] to-[#05070d] flex items-center justify-center relative overflow-hidden">
        <div className="w-7 h-12 rounded-t-full bg-gradient-to-r from-slate-200 via-white to-slate-400 shadow-[0_0_12px_rgba(56,189,248,0.5)] border border-white/40 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_6px_#06b6d4]" />
        </div>
      </div>
    ),
  },
  {
    id: "retro_comic",
    labelId: "Komik Retro",
    labelEn: "Retro Comic",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none">
        <rect width="160" height="100" fill="#fef08a" />
        <polygon points="80,18 88,38 110,38 92,52 98,72 80,60 62,72 68,52 50,38 72,38" fill="#ef4444" stroke="#000000" strokeWidth="2" />
        <rect x="58" y="44" width="44" height="16" rx="4" fill="#ffffff" stroke="#000000" strokeWidth="2" />
        <text x="64" y="56" fill="#000000" fontSize="10" fontWeight="900">BOOM!</text>
      </svg>
    ),
  },
];

export function CreateInfographicSheet({
  open,
  onClose,
  sources = [],
  onGenerate,
  onOpenModelsSettings,
}: CreateInfographicSheetProps) {
  const { t, language } = useI18n();

  const [selectedLanguage, setSelectedLanguage] = useState<"id" | "en">(language === "id" ? "id" : "en");
  const [orientation, setOrientation] = useState<MobileInfographicOrientation>("landscape");
  const [selectedStyle, setSelectedStyle] = useState<string>("auto");
  const [detailLevel, setDetailLevel] = useState<MobileInfographicDetailLevel>("standard");
  const [customDescription, setCustomDescription] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );

  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const stylesCarouselRef = useRef<HTMLDivElement>(null);

  // Load configured image providers
  const imageConfig = useMemo(() => {
    return getStoredImageConfig();
  }, [open]);

  const availableProviders = useMemo(() => {
    return (imageConfig.providers || []).filter((p) => p.models && p.models.length > 0);
  }, [imageConfig]);

  const allAvailableModels = useMemo(() => {
    const list: Array<{ provider: ImageProvider; model: ImageModel }> = [];
    availableProviders.forEach((p) => {
      p.models.forEach((m) => {
        list.push({ provider: p, model: m });
      });
    });
    return list;
  }, [availableProviders]);

  const hasConfiguredImageModel = allAvailableModels.length > 0;

  useEffect(() => {
    if (open) {
      setSelectedSourceIds(sources.map((s) => s.id));

      if (allAvailableModels.length > 0) {
        const activeMatch = allAvailableModels.find(
          (item) =>
            item.provider.id === imageConfig.activeProviderId &&
            item.model.id === imageConfig.activeModelId
        );
        if (activeMatch) {
          setSelectedProviderId(activeMatch.provider.id);
          setSelectedModelId(activeMatch.model.id);
        } else {
          setSelectedProviderId(allAvailableModels[0]!.provider.id);
          setSelectedModelId(allAvailableModels[0]!.model.id);
        }
      }
    }
  }, [open, sources, allAvailableModels, imageConfig]);

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
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
    if (!hasConfiguredImageModel) return;

    onGenerate({
      selectedSourceIds:
        selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
      language: selectedLanguage,
      orientation,
      style: selectedStyle,
      detailLevel,
      customDescription: customDescription.trim(),
      providerId: selectedProviderId,
      modelId: selectedModelId,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] bg-[#16171a] text-foreground rounded-t-[28px] border-t border-[#2e313b] flex flex-col font-sans overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Handle Bar & Top Header */}
        <div className="pt-3 pb-2 px-5 flex flex-col items-center shrink-0 border-b border-[#262830]">
          <div className="w-10 h-1.5 rounded-full bg-white/20 mb-3" />
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("customizeInfographic")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Section 1: Bahasa & Orientasi */}
          <div className="grid grid-cols-2 gap-3">
            {/* Bahasa */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                {t("language")}
              </label>
              <div className="h-10 p-1 bg-[#202227] border border-[#30333d] rounded-xl grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage("id")}
                  className={cn(
                    "h-full rounded-lg font-medium transition-all text-center",
                    selectedLanguage === "id"
                      ? "bg-[#2d3039] text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ID
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage("en")}
                  className={cn(
                    "h-full rounded-lg font-medium transition-all text-center",
                    selectedLanguage === "en"
                      ? "bg-[#2d3039] text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  EN
                </button>
              </div>
            </div>

            {/* Orientasi */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                {t("orientation")}
              </label>
              <div className="h-10 p-1 bg-[#202227] border border-[#30333d] rounded-xl grid grid-cols-3 gap-0.5">
                {(
                  [
                    { id: "landscape", label: t("orientationLandscape") },
                    { id: "portrait", label: t("orientationPortrait") },
                    { id: "square", label: t("orientationSquare") },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOrientation(item.id)}
                    className={cn(
                      "h-full rounded-lg text-[10px] font-medium flex items-center justify-center transition-all truncate px-0.5",
                      orientation === item.id
                        ? "bg-[#2d3039] text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Pilih Gaya Visual */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
              {t("selectVisualStyle")}
            </label>
            <div
              ref={stylesCarouselRef}
              className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1 pt-0.5"
            >
              {MOBILE_STYLE_ITEMS.map((style) => {
                const isSelected = selectedStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedStyle(style.id)}
                    className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer text-left"
                  >
                    <div
                      className={cn(
                        "w-24 h-16 rounded-xl overflow-hidden relative transition-all border",
                        isSelected
                          ? "border-primary ring-2 ring-primary/40 scale-[1.02]"
                          : "border-[#30333d] opacity-80"
                      )}
                    >
                      {style.renderThumbnail()}
                      {isSelected && (
                        <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-2 w-2 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium tracking-tight text-center truncate max-w-24",
                        isSelected ? "text-primary font-semibold" : "text-muted-foreground"
                      )}
                    >
                      {language === "id" ? style.labelId : style.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Tingkat Detail */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
              {t("detailLevel")}
            </label>
            <div className="h-10 p-1 bg-[#202227] border border-[#30333d] rounded-xl grid grid-cols-3 gap-1">
              {(
                [
                  { id: "brief", label: t("detailBrief") },
                  { id: "standard", label: t("detailStandard") },
                  { id: "detailed", label: t("detailDetailed") },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDetailLevel(item.id)}
                  className={cn(
                    "h-full rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all",
                    detailLevel === item.id
                      ? "bg-[#2d3039] text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {detailLevel === item.id && <Check className="h-3 w-3 text-primary" />}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Model Gambar */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
              {t("selectImageModel")}
            </label>

            {hasConfiguredImageModel ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="w-full h-10 px-3 rounded-xl bg-[#202227] border border-[#30333d] flex items-center justify-between text-xs font-medium text-foreground cursor-pointer"
                >
                  <span className="truncate font-sans">
                    {selectedModelId || t("selectModelPlaceholder")}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>

                {isModelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 p-1 bg-[#1e2026] border border-[#323642] rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto space-y-0.5">
                    {allAvailableModels.map(({ provider, model }) => {
                      const isSelected =
                        selectedProviderId === provider.id && selectedModelId === model.id;
                      return (
                        <button
                          key={`${provider.id}_${model.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedProviderId(provider.id);
                            setSelectedModelId(model.id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-2.5 py-1.5 text-left text-xs rounded-lg flex items-center justify-between cursor-pointer",
                            isSelected
                              ? "bg-primary/15 text-primary font-medium"
                              : "text-foreground hover:bg-white/5"
                          )}
                        >
                          <div className="truncate min-w-0 mr-2">
                            <div className="font-sans text-xs truncate">{model.name || model.id}</div>
                            <div className="text-[9px] text-muted-foreground truncate">{provider.name}</div>
                          </div>
                          {isSelected && <Check className="h-3 w-3 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-[11px]">
                  <div className="font-semibold text-amber-200">
                    {t("noImageModelConfigured")}
                  </div>
                  <div className="text-amber-300/80 mt-0.5">
                    {t("noImageModelConfiguredDesc")}
                  </div>
                  {onOpenModelsSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenModelsSettings();
                      }}
                      className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-black font-semibold text-[11px] cursor-pointer"
                    >
                      <Settings className="h-3 w-3" />
                      <span>{t("settings")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Sumber Materi */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("sourcesWithCount", { selected: selectedSourceIds.length, total: sources.length })}
              </label>
              <button
                type="button"
                onClick={handleSelectAllSources}
                className="text-[10px] text-primary hover:underline"
              >
                {selectedSourceIds.length === sources.length
                  ? t("deselectAll")
                  : t("selectAll")}
              </button>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1 p-1 bg-[#1a1c22] rounded-xl border border-[#2a2c35]">
              {sources.map((s) => {
                const isChecked = selectedSourceIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => handleToggleSource(s.id)}
                    className="px-2 py-1.5 rounded-lg hover:bg-white/5 flex items-center gap-2 cursor-pointer text-[11px]"
                  >
                    <div
                      className={cn(
                        "h-3.5 w-3.5 rounded-xs border flex items-center justify-center shrink-0",
                        isChecked ? "bg-primary border-primary text-primary-foreground" : "border-white/30"
                      )}
                    >
                      {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                    <span className="truncate text-foreground/90">{s.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 6: Deskripsi Kustom */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
              {t("customDescriptionOptional")}
            </label>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder={t("customDescriptionPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#202227] border border-[#30333d] focus:border-primary text-xs text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-hidden"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 pb-3">
            <button
              type="submit"
              disabled={!hasConfiguredImageModel || selectedSourceIds.length === 0}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer",
                hasConfiguredImageModel && selectedSourceIds.length > 0
                  ? "bg-white text-black hover:bg-slate-200"
                  : "bg-white/10 text-muted-foreground cursor-not-allowed opacity-50"
              )}
            >
              <Sparkles className="h-4 w-4" />
              <span>{t("createNow")}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
