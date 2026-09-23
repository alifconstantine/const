import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart3,
  Layers,
  AlertCircle,
  Settings,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, cn } from "@const/ui";
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

interface StyleCardDef {
  id: string;
  labelId: string;
  labelEn: string;
  renderThumbnail: () => React.ReactNode;
}

const STYLE_CARDS: StyleCardDef[] = [
  {
    id: "auto",
    labelId: "Pilih otomatis",
    labelEn: "Auto select",
    renderThumbnail: () => (
      <div className="w-full h-full bg-gradient-to-br from-blue-500/10 via-background to-indigo-500/10 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:12px_12px] opacity-20" />
        <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
          <RefreshCw className="h-5 w-5" />
        </div>
      </div>
    ),
  },
  {
    id: "kawaii",
    labelId: "Kawaii",
    labelEn: "Kawaii",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="100" fill="#fdf2f8" />
        <circle cx="30" cy="25" r="4" fill="#f472b6" opacity="0.6" />
        <circle cx="135" cy="20" r="3" fill="#c084fc" opacity="0.6" />
        <circle cx="140" cy="70" r="5" fill="#f472b6" opacity="0.5" />
        <circle cx="20" cy="75" r="3" fill="#fb7185" opacity="0.6" />
        {/* Cute Rocket Body */}
        <path d="M80 18 C62 38, 60 70, 60 78 C70 76, 90 76, 100 78 C100 70, 98 38, 80 18 Z" fill="#a7f3d0" stroke="#059669" strokeWidth="2.5" />
        {/* Fins */}
        <path d="M60 62 C50 65, 46 76, 52 82 C58 82, 60 76, 61 74 Z" fill="#fbcfe8" stroke="#db2777" strokeWidth="2" />
        <path d="M100 62 C110 65, 114 76, 108 82 C102 82, 100 76, 99 74 Z" fill="#fbcfe8" stroke="#db2777" strokeWidth="2" />
        {/* Window */}
        <circle cx="80" cy="46" r="10" fill="#ffffff" stroke="#059669" strokeWidth="2" />
        <circle cx="77" cy="45" r="3.5" fill="#1e293b" />
        <circle cx="83" cy="45" r="3.5" fill="#1e293b" />
        <circle cx="76" cy="43.5" r="1.2" fill="#ffffff" />
        <circle cx="82" cy="43.5" r="1.2" fill="#ffffff" />
        {/* Blushing Cheeks */}
        <ellipse cx="73" cy="50" rx="2.5" ry="1.5" fill="#f472b6" />
        <ellipse cx="87" cy="50" rx="2.5" ry="1.5" fill="#f472b6" />
        {/* Smile */}
        <path d="M78 49 Q80 52 82 49" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Flame */}
        <path d="M72 78 Q80 92 88 78 Z" fill="#fde047" stroke="#ea580c" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "clay",
    labelId: "Tanah liat",
    labelEn: "Claymation",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="100" fill="#d6cfc7" />
        <ellipse cx="80" cy="90" rx="55" ry="8" fill="#b8aba0" opacity="0.6" />
        {/* Clay Rocket Body */}
        <path d="M80 16 C66 32, 64 68, 64 78 C74 81, 86 81, 96 78 C96 68, 94 32, 80 16 Z" fill="#e0533c" />
        {/* Clay Cone Top */}
        <path d="M80 16 C71 28, 70 38, 80 40 C90 38, 89 28, 80 16 Z" fill="#c23b24" />
        {/* Clay Blue Middle Band */}
        <path d="M65 52 C75 55, 85 55, 95 52 L95 66 C85 69, 75 69, 65 66 Z" fill="#2563eb" />
        {/* Clay Window */}
        <circle cx="80" cy="59" r="6" fill="#f8fafc" stroke="#1d4ed8" strokeWidth="2.5" />
        {/* Clay Legs */}
        <path d="M64 68 C54 72, 50 82, 54 88 C60 88, 64 82, 65 77 Z" fill="#3b82f6" />
        <path d="M96 68 C106 72, 110 82, 106 88 C100 88, 96 82, 95 77 Z" fill="#3b82f6" />
        {/* Clay Highlights */}
        <ellipse cx="76" cy="34" rx="3" ry="8" fill="#ffffff" opacity="0.3" transform="rotate(-15 76 34)" />
      </svg>
    ),
  },
  {
    id: "sketch_notes",
    labelId: "Catatan Sketsa",
    labelEn: "Sketch Notes",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="100" fill="#ffffff" />
        {/* Sketch lines & arrows */}
        <path d="M40 30 C30 40, 32 50, 42 60" stroke="#0f172a" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M120 40 C130 50, 126 64, 118 70" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
        {/* Hand-drawn Rocket */}
        <path d="M80 15 C68 35, 66 65, 66 75 C75 73, 85 73, 94 75 C94 65, 92 35, 80 15 Z" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Hand-drawn Fin */}
        <path d="M66 62 L52 74 C58 78, 65 77, 66 74" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M94 62 L108 74 C102 78, 95 77, 94 74" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Cross hatching */}
        <line x1="68" y1="45" x2="74" y2="48" stroke="#0f172a" strokeWidth="1.2" />
        <line x1="68" y1="50" x2="75" y2="53" stroke="#0f172a" strokeWidth="1.2" />
        <line x1="68" y1="55" x2="76" y2="58" stroke="#0f172a" strokeWidth="1.2" />
        {/* Window */}
        <circle cx="80" cy="45" r="7" stroke="#0f172a" strokeWidth="2" fill="none" />
        <circle cx="80" cy="45" r="4" stroke="#0f172a" strokeWidth="1.2" fill="none" />
        {/* Smoke swirls */}
        <path d="M74 80 Q68 90 76 95 Q84 90 80 80 Q86 92 90 88" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "anime",
    labelId: "Anime",
    labelEn: "Anime",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="100" fill="#090d16" />
        {/* Speed rays */}
        <line x1="80" y1="50" x2="10" y2="10" stroke="#38bdf8" strokeWidth="1" opacity="0.4" />
        <line x1="80" y1="50" x2="20" y2="90" stroke="#38bdf8" strokeWidth="1" opacity="0.4" />
        <line x1="80" y1="50" x2="150" y2="15" stroke="#f43f5e" strokeWidth="1" opacity="0.4" />
        <line x1="80" y1="50" x2="140" y2="85" stroke="#f43f5e" strokeWidth="1" opacity="0.4" />
        {/* Mecha Rocket Body angled */}
        <path d="M110 25 L65 55 L75 80 L125 45 Z" fill="#2563eb" stroke="#93c5fd" strokeWidth="2" />
        <path d="M125 45 L110 25 L95 35 L115 52 Z" fill="#f97316" />
        {/* Wing Panels */}
        <path d="M65 55 L40 68 L55 75 Z" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.5" />
        <path d="M85 40 L105 18 L100 32 Z" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.5" />
        {/* Glow Jet Thruster */}
        <ellipse cx="62" cy="72" rx="14" ry="7" fill="#38bdf8" opacity="0.8" transform="rotate(-35 62 72)" />
        <ellipse cx="58" cy="75" rx="8" ry="4" fill="#ffffff" transform="rotate(-35 58 75)" />
      </svg>
    ),
  },
  {
    id: "editorial",
    labelId: "Editorial",
    labelEn: "Editorial",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="100" fill="#f1f5f9" />
        <rect x="15" y="15" width="60" height="70" fill="#0f172a" />
        <rect x="85" y="15" width="60" height="32" fill="#0284c7" />
        <rect x="85" y="53" width="60" height="32" fill="#cbd5e1" />
        {/* Typographic elements */}
        <text x="25" y="42" fill="#38bdf8" fontSize="22" fontWeight="900" fontFamily="sans-serif">01</text>
        <line x1="25" y1="52" x2="60" y2="52" stroke="#ffffff" strokeWidth="2" />
        <line x1="25" y1="60" x2="55" y2="60" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="25" y1="66" x2="48" y2="66" stroke="#94a3b8" strokeWidth="1.5" />
        {/* Minimal geometric rocket icon */}
        <path d="M115 22 L122 35 L108 35 Z" fill="#ffffff" />
        <circle cx="115" cy="28" r="1.5" fill="#0284c7" />
      </svg>
    ),
  },
  {
    id: "vector",
    labelId: "Minimalis Vektor",
    labelEn: "Vector Minimalist",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="100" fill="#0f172a" />
        {/* Concentric circles */}
        <circle cx="80" cy="50" r="36" stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="80" cy="50" r="24" stroke="#475569" strokeWidth="1.5" />
        {/* Data nodes */}
        <circle cx="80" cy="14" r="3.5" fill="#38bdf8" />
        <circle cx="116" cy="50" r="3.5" fill="#818cf8" />
        <circle cx="44" cy="50" r="3.5" fill="#34d399" />
        {/* Center flat rocket */}
        <path d="M80 30 L88 56 L72 56 Z" fill="#38bdf8" />
        <circle cx="80" cy="42" r="3" fill="#0f172a" />
      </svg>
    ),
  },
  {
    id: "3d_photorealistic",
    labelId: "Fotorealistik 3D",
    labelEn: "3D Photorealistic",
    renderThumbnail: () => (
      <div className="w-full h-full bg-gradient-to-b from-[#0a0a0f] via-[#141824] to-[#05070d] flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-24 h-24 rounded-full bg-cyan-500/20 blur-xl" />
        <div className="relative flex flex-col items-center">
          <div className="w-8 h-14 rounded-t-full bg-gradient-to-r from-slate-200 via-white to-slate-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] border border-white/40 flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />
          </div>
          <div className="w-4 h-3 bg-gradient-to-b from-orange-400 to-transparent blur-[1px] mt-0.5" />
        </div>
      </div>
    ),
  },
  {
    id: "retro_comic",
    labelId: "Komik Retro",
    labelEn: "Retro Comic",
    renderThumbnail: () => (
      <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="100" fill="#fef08a" />
        {/* Halftone dots effect */}
        <g fill="#f59e0b" opacity="0.35">
          <circle cx="15" cy="15" r="2" /><circle cx="35" cy="15" r="2" /><circle cx="55" cy="15" r="2" />
          <circle cx="75" cy="15" r="2" /><circle cx="95" cy="15" r="2" /><circle cx="115" cy="15" r="2" />
          <circle cx="25" cy="30" r="2" /><circle cx="45" cy="30" r="2" /><circle cx="65" cy="30" r="2" />
          <circle cx="85" cy="30" r="2" /><circle cx="105" cy="30" r="2" /><circle cx="125" cy="30" r="2" />
        </g>
        {/* Pop-art starburst */}
        <polygon points="80,18 88,38 110,38 92,52 98,72 80,60 62,72 68,52 50,38 72,38" fill="#ef4444" stroke="#000000" strokeWidth="2" />
        {/* Comic speech bubble / text */}
        <rect x="58" y="44" width="44" height="16" rx="4" fill="#ffffff" stroke="#000000" strokeWidth="2" />
        <text x="64" y="56" fill="#000000" fontSize="10" fontWeight="900" fontFamily="sans-serif">BOOM!</text>
      </svg>
    ),
  },
];

export function CreateInfographicDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
  onOpenImageSettings,
}: CreateInfographicDialogProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  // Form states
  const [selectedLanguage, setSelectedLanguage] = useState<"id" | "en">(isIndo ? "id" : "en");
  const [orientation, setOrientation] = useState<InfographicOrientation>("landscape");
  const [selectedStyle, setSelectedStyle] = useState<string>("auto");
  const [detailLevel, setDetailLevel] = useState<InfographicDetailLevel>("standard");
  const [customDescription, setCustomDescription] = useState("");

  // Source selections
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);

  // Model & Provider selection
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

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
      if (allAvailableModels.length > 0) {
        // Find if active matches
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

      // Default sources
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
    onOpenChange(false);
  };

  // Dimensions string
  const currentDimensionLabel =
    orientation === "portrait"
      ? "1024 × 1792 px (9:16)"
      : orientation === "square"
      ? "1024 × 1024 px (1:1)"
      : "1792 × 1024 px (16:9)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] w-[95vw] p-0 bg-[#16171a] border border-[#2a2c33] text-foreground rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden">
        {/* Header (Matching Reference Image) */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#262830]">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {isIndo ? "Sesuaikan Infografik" : "Customize Infographic"}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={isIndo ? "Tutup" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 text-sm max-h-[80vh] overflow-y-auto">
          {/* Row 1: Pilih Bahasa & Pilih Orientasi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Pilih Bahasa */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                {isIndo ? "Pilih bahasa" : "Select language"}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#202227] hover:bg-[#252830] border border-[#30333d] flex items-center justify-between text-xs font-medium text-foreground transition-all cursor-pointer"
                >
                  <span>{selectedLanguage === "id" ? "Indonesia" : "English"}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>

                {isLanguageDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 p-1 bg-[#1e2026] border border-[#323642] rounded-xl shadow-xl z-30 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLanguage("id");
                        setIsLanguageDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-xs rounded-lg flex items-center justify-between cursor-pointer",
                        selectedLanguage === "id"
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-foreground hover:bg-white/5"
                      )}
                    >
                      <span>Indonesia</span>
                      {selectedLanguage === "id" && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLanguage("en");
                        setIsLanguageDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-xs rounded-lg flex items-center justify-between cursor-pointer",
                        selectedLanguage === "en"
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-foreground hover:bg-white/5"
                      )}
                    >
                      <span>English</span>
                      {selectedLanguage === "en" && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pilih Orientasi (Segmented Control matching Reference) */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                {isIndo ? "Pilih orientasi" : "Select orientation"}
              </label>
              <div className="h-11 p-1 bg-[#202227] border border-[#30333d] rounded-xl grid grid-cols-3 gap-1">
                {(
                  [
                    { id: "landscape", labelId: "Lanskap", labelEn: "Landscape" },
                    { id: "portrait", labelId: "Potret", labelEn: "Portrait" },
                    { id: "square", labelId: "Persegi", labelEn: "Square" },
                  ] as const
                ).map((item) => {
                  const isSelected = orientation === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setOrientation(item.id)}
                      className={cn(
                        "h-full rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        isSelected
                          ? "bg-[#2d3039] text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                      <span>{isIndo ? item.labelId : item.labelEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Pilih Gaya Visual (Scrollable Carousel with Next button) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                {isIndo ? "Pilih gaya visual" : "Select visual style"}
              </label>
              <div className="flex items-center gap-1">
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={handleScrollLeft}
                    className="h-6 w-6 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                )}
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={handleScrollRight}
                    className="h-6 w-6 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="relative group">
              <div
                ref={stylesCarouselRef}
                onScroll={checkScroll}
                className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 scroll-smooth"
              >
                {STYLE_CARDS.map((style) => {
                  const isSelected = selectedStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyle(style.id)}
                      className="flex flex-col items-center gap-2 shrink-0 cursor-pointer text-left focus:outline-hidden"
                    >
                      <div
                        className={cn(
                          "w-28 h-20 rounded-xl overflow-hidden relative transition-all border",
                          isSelected
                            ? "border-primary ring-2 ring-primary/40 shadow-md scale-[1.02]"
                            : "border-[#30333d] hover:border-[#424654] opacity-85 hover:opacity-100"
                        )}
                      >
                        {style.renderThumbnail()}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-medium tracking-tight text-center truncate max-w-28",
                          isSelected ? "text-primary font-semibold" : "text-muted-foreground"
                        )}
                      >
                        {isIndo ? style.labelId : style.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Next Arrow on Right (Matches Reference Image) */}
              {canScrollRight && (
                <button
                  type="button"
                  onClick={handleScrollRight}
                  className="absolute right-0 top-1/2 -translate-y-6 h-9 w-9 rounded-full bg-[#1e2026]/90 border border-[#363a47] text-foreground hover:bg-[#282b34] flex items-center justify-center shadow-xl transition-all cursor-pointer backdrop-blur-xs z-10"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Scroll Indicator Bar */}
            <div className="w-48 h-1 bg-[#23252d] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-[#3d4252] rounded-full transition-all duration-150"
                style={{
                  width: "40%",
                  marginLeft: stylesCarouselRef.current
                    ? `${(stylesCarouselRef.current.scrollLeft /
                        (stylesCarouselRef.current.scrollWidth -
                          stylesCarouselRef.current.clientWidth || 1)) *
                        60}%`
                    : "0%",
                }}
              />
            </div>
          </div>

          {/* Row 3: Tingkat Detail & Sumber */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Tingkat Detail */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                {isIndo ? "Tingkat detail" : "Detail level"}
              </label>
              <div className="h-11 p-1 bg-[#202227] border border-[#30333d] rounded-xl grid grid-cols-3 gap-1">
                {(
                  [
                    { id: "brief", labelId: "Singkat", labelEn: "Brief", badge: undefined },
                    { id: "standard", labelId: "Standar", labelEn: "Standard", badge: undefined },
                    { id: "detailed", labelId: "Terperinci", labelEn: "Detailed", badge: "BETA" },
                  ] as const
                ).map((item) => {
                  const isSelected = detailLevel === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDetailLevel(item.id)}
                      className={cn(
                        "h-full rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all cursor-pointer relative",
                        isSelected
                          ? "bg-[#2d3039] text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <span className="truncate">{isIndo ? item.labelId : item.labelEn}</span>
                      {item.badge && (
                        <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-primary/20 text-primary border border-primary/30 uppercase tracking-tighter">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sumber Multi-select */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                {isIndo ? "Sumber" : "Sources"}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#202227] hover:bg-[#252830] border border-[#30333d] flex items-center justify-between text-xs font-medium text-foreground transition-all cursor-pointer"
                >
                  <span className="truncate">
                    {selectedSourceIds.length === 0
                      ? isIndo
                        ? "Pilih sumber..."
                        : "Select sources..."
                      : selectedSourceIds.length === sources.length
                      ? isIndo
                        ? `Semua sumber (${sources.length})`
                        : `All sources (${sources.length})`
                      : `${selectedSourceIds.length} ${
                          isIndo ? "sumber" : selectedSourceIds.length > 1 ? "sources" : "source"
                        }`}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>

                {isSourceDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 p-2 bg-[#1e2026] border border-[#323642] rounded-xl shadow-xl z-30 space-y-1 max-h-56 overflow-y-auto">
                    <button
                      type="button"
                      onClick={handleSelectAllSources}
                      className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg flex items-center justify-between cursor-pointer"
                    >
                      <span>
                        {selectedSourceIds.length === sources.length
                          ? isIndo
                            ? "Batalkan semua"
                            : "Deselect all"
                          : isIndo
                          ? "Pilih semua sumber"
                          : "Select all sources"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {selectedSourceIds.length}/{sources.length}
                      </span>
                    </button>
                    <div className="h-px bg-white/10 my-1" />
                    {sources.map((s) => {
                      const isChecked = selectedSourceIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleToggleSource(s.id)}
                          className="px-2.5 py-1.5 rounded-lg hover:bg-white/5 flex items-center gap-2.5 cursor-pointer text-xs transition-colors"
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-sm border flex items-center justify-center transition-colors shrink-0",
                              isChecked
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/40 bg-transparent"
                            )}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className="truncate text-foreground/90">{s.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Pilih Model Gambar (Requested Addition) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <span>{isIndo ? "Pilih Model Gambar" : "Select Image Model"}</span>
                <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md font-mono">
                  AI Generator
                </span>
              </label>

              {onOpenImageSettings && (
                <button
                  type="button"
                  onClick={onOpenImageSettings}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="h-3 w-3" />
                  <span>{isIndo ? "Kelola Model" : "Manage Models"}</span>
                </button>
              )}
            </div>

            {hasConfiguredImageModel ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#202227] hover:bg-[#252830] border border-[#30333d] flex items-center justify-between text-xs font-medium text-foreground transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-muted-foreground shrink-0 uppercase tracking-tight">
                      {availableProviders.find((p) => p.id === selectedProviderId)?.name || "Provider"}
                    </span>
                    <span className="truncate font-mono text-foreground">
                      {selectedModelId || (isIndo ? "Pilih model..." : "Select model...")}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>

                {isModelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 bg-[#1e2026] border border-[#323642] rounded-xl shadow-xl z-30 space-y-1 max-h-56 overflow-y-auto">
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
                            "w-full px-3 py-2 text-left text-xs rounded-lg flex items-center justify-between cursor-pointer transition-colors",
                            isSelected
                              ? "bg-primary/15 text-primary font-medium"
                              : "text-foreground hover:bg-white/5"
                          )}
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="font-mono text-xs truncate">{model.name || model.id}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {provider.name} · {provider.protocol}
                            </div>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Warning banner when no image model exists (User required constraint) */
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-amber-200">
                    {isIndo
                      ? "Belum ada Model Gambar yang Dikonfigurasi"
                      : "No Image Model Configured"}
                  </div>
                  <div className="text-amber-300/80 mt-0.5">
                    {isIndo
                      ? "Fitur Infografis membutuhkan model gambar (OpenRouter, Together, DALL-E, atau custom). Tambahkan model di Pengaturan > Model > Image."
                      : "Infographics require an active image model. Please add a model in Settings > Models > Image to proceed."}
                  </div>
                  {onOpenImageSettings && (
                    <button
                      type="button"
                      onClick={onOpenImageSettings}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>{isIndo ? "Buka Pengaturan Model" : "Open Models Settings"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Row 5: Deskripsikan Infografis (Prompt Textarea matching Reference) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {isIndo
                ? "Deskripsikan infografis yang ingin Anda buat"
                : "Describe the infographic you want to create"}
            </label>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder={
                isIndo
                  ? 'Tentukan gaya, warna, atau fokusnya: "Gunakan tema warna biru dan soroti 3 statistik utama."'
                  : 'Specify style, color, or focus: "Use a blue palette and highlight 3 core key metrics."'
              }
              rows={3}
              className="w-full px-3.5 py-3 rounded-xl bg-[#202227] border border-[#30333d] focus:border-primary text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden transition-all resize-none"
            />
          </div>

          {/* Footer (Matching Reference Layout) */}
          <div className="flex items-center justify-between pt-4 border-t border-[#262830] gap-4">
            {/* AI Usage Indicator & Canvas Resolution */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-muted-foreground shrink-0 font-medium">
                {isIndo ? "Penggunaan AI" : "AI Usage"}
              </span>
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-24 h-1.5 bg-[#252830] rounded-full overflow-hidden flex">
                  <div className="w-1/3 bg-blue-500 rounded-full" />
                  <div className="w-1/4 bg-indigo-500 rounded-full ml-0.5" />
                </div>
                <span className="text-[11px] text-muted-foreground/75 truncate font-mono">
                  {currentDimensionLabel}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
              >
                {isIndo ? "Buat nanti" : "Later"}
              </button>

              <button
                type="submit"
                disabled={!hasConfiguredImageModel}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md",
                  hasConfiguredImageModel
                    ? "bg-white text-black hover:bg-slate-200 active:scale-[0.98]"
                    : "bg-white/10 text-muted-foreground cursor-not-allowed opacity-50"
                )}
                title={
                  !hasConfiguredImageModel
                    ? isIndo
                      ? "Perlu mengonfigurasi model gambar terlebih dahulu"
                      : "Configure an image model first"
                    : undefined
                }
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isIndo ? "Buat sekarang" : "Create now"}</span>
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
