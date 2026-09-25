import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Check,
  ChevronDown,
  Presentation,
  Sliders,
  Layers,
  Palette,
  LayoutTemplate,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreatePresentationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    provider: "native" | "canva" | "slides";
    lengthMode: "short" | "medium" | "long" | "auto";
    slideCount?: number;
    themeId?: "bold_dark" | "swiss_blue" | "sea_indigo" | "ash_lime";
    customInstructions?: string;
  }) => void;
}

const getProviders = (isIndo: boolean) => [
  {
    id: "native" as const,
    name: "Const Native",
    tagline: isIndo
      ? "Open-Design 1920×1080 Canvas Deck & PDF"
      : "Open-Design 1920×1080 Canvas Deck & PDF",
    badge: isIndo ? "Direkomendasikan" : "Recommended",
    icon: Presentation,
    color: "text-amber-400",
  },
  {
    id: "canva" as const,
    name: "Canva MCP",
    tagline: isIndo
      ? "Template Canva & Desain Interaktif"
      : "Editable Canva Design & Live Templates",
    badge: "Canva AI",
    icon: LayoutTemplate,
    color: "text-cyan-400",
  },
  {
    id: "slides" as const,
    name: "Google Slides",
    tagline: isIndo
      ? "Slide Cloud di Google Drive & PPTX"
      : "Cloud Slides in Google Drive & PPTX",
    badge: "Google Suite",
    icon: Layers,
    color: "text-emerald-400",
  },
];

const THEMES = [
  { id: "bold_dark", name: "Modern Dark", color: "#38bdf8", bg: "#080C16" },
  { id: "swiss_blue", name: "Klein Blue Swiss", color: "#002FA7", bg: "#fafaf8" },
  { id: "sea_indigo", name: "Sea Indigo", color: "#5ac8fa", bg: "#0a0e1a" },
  { id: "ash_lime", name: "Ash & Lime", color: "#84a300", bg: "#f1efea" },
] as const;

export function CreatePresentationDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
}: CreatePresentationDialogProps) {
  const { language } = useI18n();
  const isIndo = language === "id";
  const providers = useMemo(() => getProviders(isIndo), [isIndo]);

  // Sources selection
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

  // Provider
  const [provider, setProvider] = useState<"native" | "canva" | "slides">("native");

  // Length mode & slide count
  const [lengthMode, setLengthMode] = useState<"short" | "medium" | "long" | "auto">("auto");
  const [customSlideCount, setCustomSlideCount] = useState<number>(10);
  const [isCustomCount, setIsCustomCount] = useState(false);

  // Theme
  const [themeId, setThemeId] = useState<"bold_dark" | "swiss_blue" | "sea_indigo" | "ash_lime">("bold_dark");

  // Optional instructions
  const [customInstructions, setCustomInstructions] = useState("");

  // Sync initial selections
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources]);

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
    if (selectedSourceIds.length === 0) return;

    let targetCount: number | undefined = undefined;
    if (isCustomCount && customSlideCount > 0) {
      targetCount = customSlideCount;
    } else if (lengthMode === "short") {
      targetCount = 4;
    } else if (lengthMode === "long") {
      targetCount = 10;
    } else if (lengthMode === "medium") {
      targetCount = 7;
    }

    onGenerate({
      selectedSourceIds:
        selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
      provider,
      lengthMode,
      slideCount: targetCount,
      themeId: provider === "native" ? themeId : undefined,
      customInstructions: customInstructions.trim() || undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] max-h-[88vh] flex flex-col gap-0 p-0 bg-[#161616] border border-[#2b2b2b] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-2 bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <Presentation className="h-4 w-4 text-white shrink-0" />
            <span className="text-sm font-semibold text-white tracking-tight">
              {isIndo ? "Buat Slide Presentasi" : "Create Presentation Slides"}
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
          <ScrollArea className="flex-1 min-h-0 w-full px-5 py-1">
            <div className="space-y-4 pb-3">
              {/* Concept Box */}
              <div className="p-3.5 rounded-xl bg-[#222222] border border-[#2b2b2b] flex items-start gap-3">
                <div className="text-xs text-[#d4d4d4] leading-relaxed">
                  {isIndo
                    ? "Hasilkan slide presentasi berstandar Open-Design 1920×1080, Canva, atau Google Slides dari catatan dan materi sumber Anda."
                    : "Generate professional 1920x1080 Open-Design, Canva, or Google Slides decks from your study sources."}
                </div>
              </div>

              {/* Sumber Dropdown */}
              <div className="space-y-1.5 relative">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {isIndo ? "Sumber Rujukan Materi" : "Source Scope"}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                    className="w-full h-9 px-3 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
                  >
                    <span className="text-white font-medium truncate">
                      {selectedSourceIds.length === sources.length
                        ? isIndo
                          ? `Semua sumber (${sources.length} sumber)`
                          : `All sources (${sources.length})`
                        : isIndo
                        ? `${selectedSourceIds.length} dari ${sources.length} sumber terpilih`
                        : `${selectedSourceIds.length} of ${sources.length} sources selected`}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#888888] shrink-0" />
                  </button>

                  {isSourceDropdownOpen && (
                    <div className="absolute top-full mt-1.5 left-0 right-0 z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-2 shadow-2xl">
                      <ScrollArea className="max-h-48 w-full" viewportClassName="space-y-1 pr-1">
                        <button
                          type="button"
                          onClick={handleSelectAllSources}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc] cursor-pointer transition-colors"
                        >
                          <span className="font-medium">
                            {isIndo ? "Pilih Semua Sumber" : "Select All Sources"}
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

                        {sources.map((src) => {
                          const isSelected = selectedSourceIds.includes(src.id);
                          return (
                            <button
                              key={src.id}
                              type="button"
                              onClick={() => handleToggleSource(src.id)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-left cursor-pointer transition-colors"
                            >
                              <span className="truncate pr-2 font-medium text-white">
                                {src.title || "Sumber"}
                              </span>
                              <div
                                className={cn(
                                  "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
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

              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {isIndo ? "Pilih Engine / Format Presentasi" : "Presentation Engine"}
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {providers.map((p) => {
                    const isSelected = provider === p.id;
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProvider(p.id as any)}
                        className={cn(
                          "p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden",
                          isSelected
                            ? "bg-[#252525] border-white/40 shadow-lg"
                            : "bg-[#1f1f1f] border-[#2c2c2c] hover:border-[#3a3a3a] opacity-80 hover:opacity-100"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Icon className={cn("h-4 w-4", p.color)} />
                            <span className="text-[9px] font-sans uppercase px-1.5 py-0.5 rounded bg-[#2e2e2e] text-[#aaa]">
                              {p.badge}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-white mb-1">{p.name}</div>
                          <div className="text-[10.5px] text-[#888] leading-tight line-clamp-2">
                            {p.tagline}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slide Count / Length Mode */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {isIndo ? "Jumlah Slide & Kedalaman" : "Slide Count & Depth"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCount(!isCustomCount)}
                    className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Sliders className="h-3 w-3" />
                    {isCustomCount
                      ? isIndo
                        ? "Mode Otomatis"
                        : "Preset Mode"
                      : isIndo
                      ? "Atur Jumlah Angka"
                      : "Custom Count"}
                  </button>
                </div>

                {!isCustomCount ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: "auto",
                        label: isIndo ? "Otomatis" : "Adaptive",
                        desc: isIndo ? "5–8 Slide proporsional" : "5–8 Balanced slides",
                      },
                      {
                        id: "short",
                        label: isIndo ? "Singkat" : "Concise",
                        desc: isIndo ? "3–5 Slide intisari" : "3–5 Essential slides",
                      },
                      {
                        id: "long",
                        label: isIndo ? "Panjang" : "In-Depth",
                        desc: isIndo ? "8–12+ Slide mendalam" : "8–12+ Comprehensive",
                      },
                    ].map((mode) => {
                      const isSelected = lengthMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setLengthMode(mode.id as any)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                            isSelected
                              ? "bg-[#252525] border-white/40 text-white"
                              : "bg-[#1f1f1f] border-[#2c2c2c] hover:border-[#383838] text-[#888]"
                          )}
                        >
                          <div className="text-xs font-semibold">{mode.label}</div>
                          <div className="text-[10px] text-[#777] mt-0.5">{mode.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {[5, 8, 10, 12, 15].map((count) => {
                      const isSelected = customSlideCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setCustomSlideCount(count)}
                          className={cn(
                            "flex-1 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                            isSelected
                              ? "bg-[#252525] border-amber-400 text-amber-300 font-semibold shadow"
                              : "bg-[#1f1f1f] border-[#2c2c2c] hover:border-[#383838] text-[#999]"
                          )}
                        >
                          {count} {isIndo ? "Slide" : "Slides"}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Native Theme Selection */}
              {provider === "native" && (
                <div className="space-y-2">
                  <label className="text-[11.5px] font-medium text-[#999999] flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5" />
                    {isIndo ? "Palet Tema Desain (Open-Design)" : "Design Theme Palette"}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {THEMES.map((th) => {
                      const isSelected = themeId === th.id;
                      return (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => setThemeId(th.id as any)}
                          className={cn(
                            "p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer",
                            isSelected
                              ? "bg-[#252525] border-white/40 shadow"
                              : "bg-[#1f1f1f] border-[#2c2c2c] hover:border-[#383838] opacity-75 hover:opacity-100"
                          )}
                        >
                          <div
                            className="h-3.5 w-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: th.color }}
                          />
                          <span className="text-[11px] font-medium text-white truncate">
                            {th.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Guidance */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {isIndo ? "Instruksi Khusus Tambahan (Opsional)" : "Custom Guidance (Optional)"}
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder={
                    isIndo
                      ? "Contoh: Fokuskan pada perbandingan arsitektur, buat tone profesional untuk presentasi pimpinan..."
                      : "E.g., Emphasize benchmarks and key findings, target technical leadership..."
                  }
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] focus:border-[#444444] text-xs text-white placeholder-[#666666] outline-none resize-none transition-colors"
                />
              </div>
            </div>
          </ScrollArea>

          {/* Footer Actions - Borderless */}
          <div className="shrink-0 px-5 py-3.5 bg-[#161616] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl bg-transparent hover:bg-[#222222] text-xs font-medium text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              {isIndo ? "Batal" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-semibold text-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <span>{isIndo ? "Buat Slide Presentasi" : "Create Slides"}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
