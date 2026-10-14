import React, { useState } from "react";
import {
  X,
  Presentation,
  Check,
  FileText,
  Sliders,
  Cable,
  ChevronRight,
} from "lucide-react";
import { BrandLogo, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";
import { isConnectorActive, syncConnectedConnectors } from "../../lib/connectors-service";

export interface CreatePresentationSheetProps {
  open: boolean;
  onClose: () => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    provider: "native" | "canva" | "slides";
    lengthMode: "short" | "medium" | "long" | "auto";
    slideCount?: number;
    customInstructions?: string;
  }) => void;
}

const PROVIDERS = [
  {
    id: "native" as const,
    name: "Const Native",
    logoId: null,
  },
  {
    id: "canva" as const,
    name: "Canva",
    logoId: "canva",
  },
  {
    id: "slides" as const,
    name: "Slides",
    logoId: "google-slides",
  },
];

export function CreatePresentationSheet({
  open,
  onClose,
  sources = [],
  onGenerate,
}: CreatePresentationSheetProps) {
  const { t } = useI18n();

  const [provider, setProvider] = useState<"native" | "canva" | "slides">("native");

  // Active MCP connector states (Canva MCP & Google Slides)
  const [activeConnections, setActiveConnections] = useState<{
    canva: boolean;
    slides: boolean;
  }>(() => ({
    canva: isConnectorActive("canva_mcp") || isConnectorActive("canva"),
    slides: isConnectorActive("google-slides") || isConnectorActive("googleslides"),
  }));

  React.useEffect(() => {
    if (!open) return;
    const updateActiveConnections = () => {
      setActiveConnections({
        canva: isConnectorActive("canva_mcp") || isConnectorActive("canva"),
        slides: isConnectorActive("google-slides") || isConnectorActive("googleslides"),
      });
    };

    updateActiveConnections();
    syncConnectedConnectors()
      .then(() => updateActiveConnections())
      .catch(() => {});

    window.addEventListener("connectors_changed", updateActiveConnections);
    return () => {
      window.removeEventListener("connectors_changed", updateActiveConnections);
    };
  }, [open]);

  const handleOpenMcpSheet = () => {
    onClose();
    window.dispatchEvent(new CustomEvent("const:open-mcp-sheet"));
  };

  const [lengthMode, setLengthMode] = useState<"short" | "medium" | "long" | "auto">("auto");
  const [customCount, setCustomCount] = useState<number>(10);
  const [isCustomCount, setIsCustomCount] = useState(false);
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
      customInstructions: customInstructions.trim() || undefined,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[60] max-h-[92vh] flex flex-col rounded-t-3xl bg-[#161616] text-[#e0e0e0] border-t border-[#262626] shadow-2xl animate-in slide-in-from-bottom duration-300 select-none pb-safe"
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-[#242424] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Presentation className="h-4 w-4 text-white shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-white">
                {t("createPresentationTitle")}
              </h2>
              <p className="text-[11px] text-[#888888]">
                {selectedSourceIds.length === sources.length
                  ? t("allSourcesCount", { count: sources.length })
                  : t("selectedOfTotalSources", {
                      selected: selectedSourceIds.length,
                      total: sources.length,
                    })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg hover:bg-[#222222] text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Section 1: Source Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999]">
                {t("sourceMaterialScope")}
              </label>
              <button
                type="button"
                onClick={handleToggleAllSources}
                className="text-[11px] font-medium text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                {selectedSourceIds.length === sources.length
                  ? t("deselectAll")
                  : t("selectAll")}
              </button>
            </div>

            {sources.length === 0 ? (
              <p className="text-xs text-[#888888] italic p-3 rounded-xl bg-[#222222] border border-[#2b2b2b]">
                {t("noSourcesInNotebookDesc")}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-xl bg-[#222222] p-1.5 border border-[#2b2b2b]">
                {sources.map((s) => {
                  const isChecked = selectedSourceIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleToggleSource(s.id)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                        isChecked
                          ? "bg-[#2c2c2c] text-white font-medium"
                          : "text-[#888888] hover:text-[#cccccc]"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                        <span className="truncate text-xs">{s.title}</span>
                      </div>
                      <div
                        className={cn(
                          "h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors",
                          isChecked
                            ? "bg-white border-white text-black"
                            : "border-[#444449] bg-transparent"
                        )}
                      >
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Presentation Engine (Native, Canva, Slides) */}
          <div className="space-y-2">
            <label className="text-[11.5px] font-medium text-[#999999] font-sans">
              {t("presentationEngine")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => {
                const isSelected = provider === p.id;
                const isConnected =
                  p.id === "native"
                    ? true
                    : p.id === "canva"
                    ? activeConnections.canva
                    : activeConnections.slides;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={cn(
                      "p-2.5 rounded-xl border text-left flex flex-col justify-between gap-2 cursor-pointer transition-all min-h-[70px] font-sans",
                      isSelected
                        ? "bg-[#252525] border-white/40 shadow-sm text-white"
                        : "bg-[#1f1f1f] border-[#2c2c2c] hover:border-[#383838] opacity-80 hover:opacity-100 text-[#888888]"
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate w-full">
                      {p.logoId ? (
                        <BrandLogo
                          id={p.logoId}
                          size="xs"
                          className="w-4 h-4 rounded-md p-0.5 border-0 shadow-none bg-transparent shrink-0"
                        />
                      ) : (
                        <Presentation className="h-3.5 w-3.5 text-white shrink-0" />
                      )}
                      <span className="text-[11.5px] font-semibold text-white truncate">
                        {p.id === "slides" ? "Google Slides" : p.name}
                      </span>
                    </div>

                    {/* Connection status badge */}
                    <div className="flex items-center">
                      {p.id === "native" ? (
                        <span className="text-[9.5px] font-sans font-medium text-[#969696] bg-[#222222] border border-[#2e2e2e] px-1.5 py-0.5 rounded-md">
                          {t("connectorStatusBuiltin")}
                        </span>
                      ) : isConnected ? (
                        <span className="text-[9.5px] font-sans font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {t("connectorStatusConnected")}
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-sans font-medium text-[#969696] bg-[#222222] border border-[#2e2e2e] px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5d5d5d]"></span>
                          {t("connectorStatusNotConnected")}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Notice banner when selected provider is not connected */}
            {provider !== "native" &&
              ((provider === "canva" && !activeConnections.canva) ||
                (provider === "slides" && !activeConnections.slides)) && (
                <div className="p-2.5 rounded-xl bg-[#1c1c1c] border border-[#2e2e2e] space-y-2 animate-in fade-in-0 duration-150">
                  <div className="flex items-start gap-2">
                    <div className="p-1 rounded-lg bg-[#252528] border border-[#2e2e2e] text-amber-400 shrink-0">
                      <Cable className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11.5px] font-semibold text-white font-sans">
                        {provider === "canva"
                          ? t("canvaMcpNotConnected")
                          : t("googleSlidesNotConnected")}
                      </div>
                      <p className="text-[10.5px] text-[#d4d4d4] mt-0.5 leading-relaxed font-sans">
                        {provider === "canva"
                          ? t("canvaMcpNotConnectedDesc")
                          : t("googleSlidesNotConnectedDesc")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenMcpSheet}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-[#252528] hover:bg-[#383838] border border-[#2e2e2e] hover:border-[#383838] text-[11px] font-medium text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-sans"
                  >
                    <Cable className="h-3 w-3 text-white" />
                    <span>{t("openMcpMenu")}</span>
                    <ChevronRight className="h-3 w-3 text-[#969696]" />
                  </button>
                </div>
              )}
          </div>

          {/* Section 3: Slide Count / Length Mode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999]">
                {t("slideCountAndDepth")}
              </label>
              <button
                type="button"
                onClick={() => setIsCustomCount(!isCustomCount)}
                className="text-[11px] text-[#aaaaaa] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <Sliders className="h-3 w-3" />
                {isCustomCount ? t("presetMode") : t("customCount")}
              </button>
            </div>

            {!isCustomCount ? (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "auto" as const, label: t("modeAdaptiveLabel"), desc: t("modeAdaptiveDesc") },
                  { id: "short" as const, label: t("modeConciseLabel"), desc: t("modeConciseDesc") },
                  { id: "long" as const, label: t("modeInDepthLabel"), desc: t("modeInDepthDesc") },
                ].map((m) => {
                  const isSelected = lengthMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setLengthMode(m.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                        isSelected
                          ? "bg-[#252525] border-white/40 text-white shadow"
                          : "bg-[#1f1f1f] border-[#2c2c2c] text-[#888888] hover:border-[#383838]"
                      )}
                    >
                      <div className="text-xs font-semibold">{m.label}</div>
                      <div className="text-[9px] text-[#888888] mt-0.5">{m.desc}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#222222] border border-[#2b2b2b] flex items-center justify-between gap-3">
                <span className="text-xs text-[#888888]">
                  {t("targetSlideCount")}
                </span>
                <input
                  type="number"
                  min={3}
                  max={25}
                  value={customCount}
                  onChange={(e) => setCustomCount(Math.max(3, Math.min(25, Number(e.target.value) || 10)))}
                  className="w-16 px-2 py-1 rounded-lg bg-[#141414] border border-[#333333] text-white text-xs text-center font-sans tabular-nums font-bold focus:outline-none focus:border-white/50"
                />
              </div>
            )}
          </div>

          {/* Section 4: Custom Prompt / Guidance */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {t("customGuidanceOptional")}
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={t("presentationGuidancePlaceholder")}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] text-xs text-white placeholder:text-[#666666] focus:outline-none focus:border-[#444444] resize-none font-sans"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 pb-2">
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className="w-full py-3 rounded-2xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-black font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98 cursor-pointer"
            >
              <Presentation className="h-4 w-4" />
              <span>{t("createSlides")}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
