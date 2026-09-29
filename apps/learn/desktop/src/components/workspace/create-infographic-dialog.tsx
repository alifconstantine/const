import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  FileText,
  AlertCircle,
  Settings,
  ArrowRight,
  Image as ImageIcon,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";
import { getStoredImageConfig, type ImageProvider, type ImageModel } from "../../lib/image";

export interface CreateInfographicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  onOpenImageSettings?: () => void;
}

export type InfographicOrientation = "landscape" | "portrait" | "square";
export type InfographicDetailLevel = "brief" | "standard" | "detailed";
type ActiveDropdown = "source" | "orientation" | "language" | "model" | null;

interface StyleCardDef {
  id: string;
  label: string;
}

// Visual styles catalog (thumbnail slots are left blank as placeholders for user assets)
const getStyleCards = (t: (key: any) => string): StyleCardDef[] => [
  { id: "auto", label: t("styleAutoSelect") },
  { id: "clean_modern", label: t("styleCleanModern") },
  { id: "sketch_notes", label: t("styleSketchNotes") },
  { id: "vector", label: t("styleVectorMinimalist") },
  { id: "editorial", label: t("styleEditorial") },
  { id: "kawaii", label: t("styleKawaii") },
  { id: "clay", label: t("styleClaymation") },
  { id: "anime", label: t("styleAnime") },
  { id: "3d_photorealistic", label: t("style3dPhotorealistic") },
  { id: "retro_comic", label: t("styleRetroComic") },
];

export function CreateInfographicDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
  onOpenImageSettings,
}: CreateInfographicDialogProps) {
  const { t, language } = useI18n();

  // Form states
  const [selectedLanguage, setSelectedLanguage] = useState<"id" | "en">(language === "id" ? "id" : "en");
  const [orientation, setOrientation] = useState<InfographicOrientation>("landscape");
  const [selectedStyle, setSelectedStyle] = useState<string>("auto");
  const [detailLevel, setDetailLevel] = useState<InfographicDetailLevel>("standard");
  const styleCards = useMemo(() => getStyleCards(t), [t]);
  const [customDescription, setCustomDescription] = useState("");

  // Source selections
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Active studio dropdown
  const [openDropdown, setOpenDropdown] = useState<ActiveDropdown>(null);

  // Model & Provider selection
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");

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

  // Carousel ref for styles
  const stylesCarouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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

  // Initialize selected model & provider
  useEffect(() => {
    if (open) {
      setOpenDropdown(null);
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
      } else {
        setSelectedProviderId("");
        setSelectedModelId("");
      }

      if (sources.length > 0 && selectedSourceIds.length === 0) {
        setSelectedSourceIds(sources.map((s) => s.id));
      }
    }
  }, [open, allAvailableModels, imageConfig, sources]);

  // Check carousel scroll availability
  const checkScroll = () => {
    const el = stylesCarouselRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 10);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
  }, [open]);

  const handleScrollRight = () => {
    if (stylesCarouselRef.current) {
      stylesCarouselRef.current.scrollBy({ left: 240, behavior: "smooth" });
      setTimeout(checkScroll, 250);
    }
  };

  const handleScrollLeft = () => {
    if (stylesCarouselRef.current) {
      stylesCarouselRef.current.scrollBy({ left: -240, behavior: "smooth" });
      setTimeout(checkScroll, 250);
    }
  };

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

  const suggestionChips = useMemo(() => [
    t("chipHighlight3Metrics"),
    t("chipStepByStepFlow"),
    t("chipProsConsTable"),
    t("chipHierarchicalConcept"),
  ], [t]);

  const handleApplySuggestion = (chipText: string) => {
    if (!customDescription.trim()) {
      setCustomDescription(chipText);
    } else {
      setCustomDescription((prev) => `${prev}. ${chipText}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasConfiguredImageModel || selectedSourceIds.length === 0) return;

    onGenerate({
      selectedSourceIds:
        selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
      language: selectedLanguage,
      orientation,
      style: selectedStyle,
      detailLevel,
      customDescription: customDescription.trim() || undefined,
      providerId: selectedProviderId,
      modelId: selectedModelId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] max-h-[88vh] flex flex-col gap-0 p-0 bg-[#161616] border border-[#2b2b2b] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        {/* Header - Borderless austere studio style */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-2 bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-4 w-4 text-white shrink-0" />
            <span className="text-sm font-semibold text-white tracking-tight">
              {t("createInfographicTitle")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 rounded-lg hover:bg-[#222222] text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title={t("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 w-full px-5 py-2">
            <div className="space-y-4 pb-2">
              {/* 1. Pemilihan Source (Lebar) & Orientasi (Kanan) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                {/* Source Selection */}
                <div
                  className={cn(
                    "flex-1 space-y-1.5 relative",
                    openDropdown === "source" ? "z-40" : "z-10"
                  )}
                  data-studio-dropdown
                >
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {t("sourceScope")}
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
                          : t("selectedOfTotalSources", { selected: selectedSourceIds.length, total: sources.length })}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-[#888888] shrink-0 transition-transform duration-150",
                          openDropdown === "source" ? "rotate-180 text-white" : ""
                        )}
                      />
                    </button>

                    {openDropdown === "source" && (
                      <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-[#222222] border border-[#2b2b2b] rounded-xl p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                        {/* Select All Toggle */}
                        <button
                          type="button"
                          onClick={handleSelectAllSources}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc] cursor-pointer transition-colors"
                        >
                          <span className="font-medium">
                            {selectedSourceIds.length === sources.length ? t("deselectAll") : t("selectAllSources")}
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

                        <ScrollArea className="max-h-52 w-full" viewportClassName="space-y-1 pr-1.5">
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

                {/* Orientasi (Dropdown matching Video Summary Coverage dropdown) */}
                <div
                  className={cn(
                    "w-full sm:w-[160px] shrink-0 space-y-1.5 relative",
                    openDropdown === "orientation" ? "z-40" : "z-10"
                  )}
                  data-studio-dropdown
                >
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {t("orientation")}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "orientation" ? null : "orientation")}
                      className="w-full h-9 px-3 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
                    >
                      <span className="text-white font-medium truncate">
                        {orientation === "landscape"
                          ? t("orientationLandscape")
                          : orientation === "portrait"
                          ? t("orientationPortrait")
                          : t("orientationSquare")}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-[#888888] shrink-0 transition-transform duration-150",
                          openDropdown === "orientation" ? "rotate-180 text-white" : ""
                        )}
                      />
                    </button>

                    {openDropdown === "orientation" && (
                      <div className="absolute top-full mt-1.5 right-0 w-full min-w-[155px] z-50 bg-[#222222] border border-[#2b2b2b] rounded-xl p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                        {(
                          [
                            { id: "landscape", label: t("orientationLandscape") },
                            { id: "portrait", label: t("orientationPortrait") },
                            { id: "square", label: t("orientationSquare") },
                          ] as const
                        ).map((item) => {
                          const isSelected = orientation === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setOrientation(item.id);
                                setOpenDropdown(null);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-[#2b2b2b] text-white font-medium"
                                  : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                              )}
                            >
                              <span>{item.label}</span>
                              {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Visual Style (Gaya Visual - Blank asset placeholders) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {t("selectVisualStyle")}
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleScrollLeft}
                      disabled={!canScrollLeft}
                      className="h-6 w-6 rounded-lg bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] text-[#888888] hover:text-white disabled:opacity-30 disabled:hover:border-[#2b2b2b] disabled:hover:text-[#888888] disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                      title={t("scrollLeft")}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleScrollRight}
                      disabled={!canScrollRight}
                      className="h-6 w-6 rounded-lg bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] text-[#888888] hover:text-white disabled:opacity-30 disabled:hover:border-[#2b2b2b] disabled:hover:text-[#888888] disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                      title={t("scrollRight")}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="relative group">
                  <div
                    ref={stylesCarouselRef}
                    onScroll={checkScroll}
                    className="flex items-center gap-2.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1 pt-0.5 scroll-smooth"
                  >
                    {styleCards.map((style) => {
                      const isSelected = selectedStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setSelectedStyle(style.id)}
                          className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer text-left focus:outline-none"
                        >
                          <div
                            className={cn(
                              "w-24 h-16 rounded-xl overflow-hidden relative transition-all border flex items-center justify-center",
                              isSelected
                                ? "bg-[#2b2b2b] border-white/80 ring-1 ring-white/40 text-white shadow-xs"
                                : "bg-[#222222] border-[#2e2e2e] hover:border-[#383838] text-[#555555] hover:text-[#777777]"
                            )}
                          >
                            {/* Kosongan: Clean minimalist placeholder box for future assets */}
                            <div className="w-8 h-6 rounded-md border border-dashed border-current/40 flex items-center justify-center opacity-40">
                              <ImageIcon className="w-3.5 h-3.5 stroke-[1.5]" />
                            </div>

                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-white text-black flex items-center justify-center shadow-xs">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-[10.5px] font-medium tracking-tight text-center truncate max-w-24",
                              isSelected ? "text-white font-semibold" : "text-[#888888]"
                            )}
                          >
                            {style.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Tingkat Detail & Bahasa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Tingkat Detail */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {t("detailLevel")}
                  </label>
                  <div className="h-9 p-0.5 bg-[#222222] border border-[#2b2b2b] rounded-xl grid grid-cols-3 gap-0.5">
                    {(
                      [
                        { id: "brief", label: t("detailBrief") },
                        { id: "standard", label: t("detailStandard") },
                        { id: "detailed", label: t("detailDetailed") },
                      ] as const
                    ).map((item) => {
                      const isSelected = detailLevel === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDetailLevel(item.id)}
                          className={cn(
                            "h-full rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer",
                            isSelected
                              ? "bg-[#2b2b2b] text-white font-medium shadow-2xs"
                              : "text-[#888888] hover:text-white"
                          )}
                        >
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pilih Bahasa */}
                <div
                  className={cn(
                    "space-y-1.5 relative",
                    openDropdown === "language" ? "z-40" : "z-10"
                  )}
                  data-studio-dropdown
                >
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {t("contentLanguage")}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "language" ? null : "language")}
                      className="w-full h-9 px-3 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
                    >
                      <span className="text-white font-medium">
                        {selectedLanguage === "id" ? t("indonesianLanguage") : t("englishLanguage")}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-[#888888] shrink-0 transition-transform duration-150",
                          openDropdown === "language" ? "rotate-180 text-white" : ""
                        )}
                      />
                    </button>

                    {openDropdown === "language" && (
                      <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-[#222222] border border-[#2b2b2b] rounded-xl p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLanguage("id");
                            setOpenDropdown(null);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                            selectedLanguage === "id"
                              ? "bg-[#2b2b2b] text-white font-medium"
                              : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                          )}
                        >
                          <span>{t("indonesianLanguage")}</span>
                          {selectedLanguage === "id" && <Check className="h-3.5 w-3.5 text-white" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLanguage("en");
                            setOpenDropdown(null);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                            selectedLanguage === "en"
                              ? "bg-[#2b2b2b] text-white font-medium"
                              : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                          )}
                        >
                          <span>{t("englishLanguage")}</span>
                          {selectedLanguage === "en" && <Check className="h-3.5 w-3.5 text-white" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Model Gambar AI (Card matching Video Summary style) */}
              <div
                className={cn(
                  "p-3.5 rounded-xl bg-[#1c1c1c] border border-[#2b2b2b] space-y-3 relative",
                  openDropdown === "model" ? "z-30" : "z-10"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-white" />
                    <span className="text-xs font-semibold text-white">
                      {t("imageGenerationModel")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasConfiguredImageModel ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2b2b2b] text-[#d4d4d4] border border-[#383838]">
                        {t("readyStatus")}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {t("notConfigured")}
                      </span>
                    )}

                    {onOpenImageSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          onOpenImageSettings();
                        }}
                        className="text-[11px] text-[#888888] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Settings className="h-3 w-3" />
                        <span>{t("manageAction")}</span>
                      </button>
                    )}
                  </div>
                </div>

                {!hasConfiguredImageModel ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <div className="flex items-start gap-2 text-xs text-amber-300/90 leading-relaxed">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        {t("imageModelRequiredNotice")}
                      </span>
                    </div>
                    {onOpenImageSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          onOpenImageSettings();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium cursor-pointer transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>{t("openModelsSettings")}</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "space-y-1 relative",
                      openDropdown === "model" ? "z-40" : "z-10"
                    )}
                    data-studio-dropdown
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "model" ? null : "model")}
                      className="w-full h-8 px-2.5 rounded-lg bg-[#2b2b2b] border border-[#383838] hover:border-[#444444] flex items-center justify-between text-xs text-white cursor-pointer transition-colors text-left"
                    >
                      <span className="truncate">
                        {selectedModelId || t("selectModelPlaceholder")}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 text-[#888888] shrink-0 transition-transform duration-150",
                          openDropdown === "model" ? "rotate-180 text-white" : ""
                        )}
                      />
                    </button>

                    {openDropdown === "model" && (
                      <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-[#222222] border border-[#2b2b2b] rounded-xl p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
                        <ScrollArea className="max-h-52 w-full" viewportClassName="space-y-1 pr-1">
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
                                  setOpenDropdown(null);
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors text-left",
                                  isSelected
                                    ? "bg-[#2b2b2b] text-white font-medium"
                                    : "hover:bg-[#282828] text-[#cccccc] hover:text-white"
                                )}
                              >
                                <div className="min-w-0 flex-1 mr-2">
                                  <div className="text-xs truncate font-medium text-white">
                                    {model.name || model.id}
                                  </div>
                                  <div className="text-[10px] text-[#888888] truncate">
                                    {provider.name} · {provider.protocol}
                                  </div>
                                </div>
                                {isSelected && <Check className="h-3.5 w-3.5 text-white shrink-0 ml-2" />}
                              </button>
                            );
                          })}
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Deskripsi Tambahan / Instruksi Khusus + Preset Chips */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("customInstructionsOptional")}
                </label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder={t("infographicGuidancePlaceholder")}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] focus:border-[#444444] focus:outline-none text-xs text-white placeholder:text-[#666666] resize-none transition-colors font-sans"
                />

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {suggestionChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplySuggestion(chip)}
                      className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#2e2e2e] hover:border-[#383838] text-[11px] text-[#a0a0a0] hover:text-white transition-all cursor-pointer active:scale-98"
                    >
                      +{chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer Actions - Borderless austere studio style */}
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
              disabled={!hasConfiguredImageModel || selectedSourceIds.length === 0}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-semibold text-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <span>{t("generateInfographicAction")}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
