import React, { useState, useMemo } from "react";
import {
  X,
  Presentation,
  Sparkles,
  Layers,
  Check,
  FileText,
  Sliders,
  Palette,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreatePresentationSheetProps {
  open: boolean;
  onClose: () => void;
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

const getProviders = (t: (key: any) => string) => [
  {
    id: "native" as const,
    name: "Const Native",
    tagline: t("constNativeTagline"),
    badge: t("recommended"),
    icon: Presentation,
    color: "text-amber-400",
  },
  {
    id: "canva" as const,
    name: "Canva MCP",
    tagline: t("canvaMcpTagline"),
    badge: "Canva AI",
    icon: Sparkles,
    color: "text-cyan-400",
  },
  {
    id: "slides" as const,
    name: "Google Slides",
    tagline: t("googleSlidesTagline"),
    badge: "Google Suite",
    icon: Presentation,
    color: "text-amber-500",
  },
];

const THEMES = [
  { id: "bold_dark", name: "Modern Dark", color: "#38bdf8", bg: "#06080F" },
  { id: "swiss_blue", name: "Swiss Blue", color: "#002fa7", bg: "#f2f2ef" },
  { id: "sea_indigo", name: "Sea Indigo", color: "#5ac8fa", bg: "#060913" },
  { id: "ash_lime", name: "Ash & Lime", color: "#84a300", bg: "#e7e5df" },
];

export function CreatePresentationSheet({
  open,
  onClose,
  sources = [],
  onGenerate,
}: CreatePresentationSheetProps) {
  const { t } = useI18n();
  const providers = useMemo(() => getProviders(t), [t]);

  const [provider, setProvider] = useState<"native" | "canva" | "slides">("native");
  const [lengthMode, setLengthMode] = useState<"short" | "medium" | "long" | "auto">("auto");
  const [customCount, setCustomCount] = useState<number>(10);
  const [isCustomCount, setIsCustomCount] = useState(false);
  const [themeId, setThemeId] = useState<"bold_dark" | "swiss_blue" | "sea_indigo" | "ash_lime">("bold_dark");
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );

  React.useEffect(() => {
    if (open) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [open, sources]);

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleToggleAllSources = () => {
    if (selectedSourceIds.length === sources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSourceIds.length === 0) return;

    onGenerate({
      selectedSourceIds,
      provider,
      lengthMode,
      slideCount: isCustomCount ? Number(customCount) || 10 : undefined,
      themeId,
      customInstructions: customInstructions.trim() || undefined,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[60] max-h-[92vh] flex flex-col rounded-t-3xl bg-[#161616] border-t border-[#262626] shadow-2xl animate-in slide-in-from-bottom duration-300 select-none pb-safe"
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#242424] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Presentation className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t("createPresentationTitle")}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {t("presentationSubtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Section 1: Source Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                {t("sourceScope")}
              </span>
              <button
                type="button"
                onClick={handleToggleAllSources}
                className="text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                {selectedSourceIds.length === sources.length
                  ? t("deselectAll")
                  : t("selectAll")}
              </button>
            </div>

            {sources.length === 0 ? (
              <p className="text-xs text-muted-foreground italic p-3 rounded-xl bg-[#1c1c1c] border border-[#282828]">
                {t("noSourcesInNotebookDesc")}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {sources.map((s) => {
                  const isChecked = selectedSourceIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleToggleSource(s.id)}
                      className={cn(
                        "flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all",
                        isChecked
                          ? "bg-amber-500/10 border-amber-500/40 text-foreground"
                          : "bg-[#1a1a1a] border-[#262626] text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors",
                          isChecked
                            ? "bg-amber-500 border-amber-500 text-black"
                            : "border-white/20 bg-transparent"
                        )}
                      >
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate font-medium flex-1">{s.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Presentation Engine (Native, Canva, Google Slides) */}
          <div>
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
              <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
              {t("presentationEngine")}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {providers.map((p) => {
                const isSelected = provider === p.id;
                const Icon = p.icon;
                return (
                  <div
                    key={p.id}
                    onClick={() => setProvider(p.id as any)}
                    className={cn(
                      "p-3 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all",
                      isSelected
                        ? "bg-[#202020] border-amber-500/80 shadow-sm"
                        : "bg-[#181818] border-[#262626] hover:bg-[#1e1e1e]"
                    )}
                  >
                    <div
                      className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                        isSelected
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                          : "bg-[#222222] border-[#303030] text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {p.name}
                        </span>
                        <span className="text-[9px] font-sans px-1.5 py-0.2 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {p.tagline}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
                        isSelected
                          ? "border-amber-500 bg-amber-500 text-black"
                          : "border-white/20"
                      )}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Slide Count / Length Mode */}
          <div>
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
              <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
              {t("slideCountAndDepth")}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "auto", label: t("modeAdaptiveLabel"), desc: t("modeAdaptiveDesc") },
                { id: "short", label: t("modeConciseLabel"), desc: t("modeConciseDesc") },
                { id: "long", label: t("modeInDepthLabel"), desc: t("modeInDepthDesc") },
                { id: "custom", label: t("custom"), desc: t("slidesCount", { count: customCount }) },
              ].map((m) => {
                const isSelected = m.id === "custom" ? isCustomCount : !isCustomCount && lengthMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (m.id === "custom") {
                        setIsCustomCount(true);
                      } else {
                        setIsCustomCount(false);
                        setLengthMode(m.id as any);
                      }
                    }}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all cursor-pointer",
                      isSelected
                        ? "bg-amber-500/15 border-amber-500 text-foreground"
                        : "bg-[#1a1a1a] border-[#262626] text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="text-xs font-semibold">{m.label}</div>
                    <div className="text-[9px] opacity-70 mt-0.5">{m.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom slide count slider if selected */}
            {isCustomCount && (
              <div className="mt-3 p-3 rounded-xl bg-[#1c1c1c] border border-[#282828] flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {t("targetSlideCount")}
                </span>
                <input
                  type="number"
                  min={3}
                  max={25}
                  value={customCount}
                  onChange={(e) => setCustomCount(Math.max(3, Math.min(25, Number(e.target.value) || 10)))}
                  className="w-16 px-2 py-1 rounded-lg bg-[#141414] border border-[#333333] text-foreground text-xs text-center font-sans tabular-nums font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Section 4: Theme Picker (for Native engine) */}
          {provider === "native" && (
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                {t("designThemePalette")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((th) => {
                  const isSelected = themeId === th.id;
                  return (
                    <div
                      key={th.id}
                      onClick={() => setThemeId(th.id as any)}
                      className={cn(
                        "p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all",
                        isSelected
                          ? "bg-white/10 border-amber-500/80"
                          : "bg-[#1a1a1a] border-[#262626] hover:bg-[#202020]"
                      )}
                    >
                      <div
                        className="h-4 w-4 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: th.color }}
                      />
                      <span className="text-xs font-medium text-foreground truncate">
                        {th.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 5: Custom Prompt / Guidance */}
          <div>
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              {t("customGuidanceOptional")}
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={t("presentationGuidancePlaceholder")}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#1a1a1a] border border-[#2b2b2b] text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-500/80 resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-1 pb-2">
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-black font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
            >
              <Presentation className="h-4 w-4" />
              <span>
                {t("createSlides")} {t("sourcesWithCount", { count: selectedSourceIds.length })}
              </span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
