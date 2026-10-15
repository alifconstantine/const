import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Presentation,
  Sliders,
  FileText,
  Cable,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, BrandLogo, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";
import { isConnectorActive, syncConnectedConnectors } from "../../lib/connectors-service";

export interface CreatePresentationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: LocalSource[];
  onNavigateToMcp?: () => void;
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

export function CreatePresentationDialog({
  open,
  onOpenChange,
  sources,
  onNavigateToMcp,
  onGenerate,
}: CreatePresentationDialogProps) {
  const { t } = useI18n();

  // Sources selection
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

  // Provider
  const [provider, setProvider] = useState<"native" | "canva" | "slides">("native");

  // Active MCP connector states (Canva MCP & Google Slides)
  const [activeConnections, setActiveConnections] = useState<{
    canva: boolean;
    slides: boolean;
  }>(() => ({
    canva: isConnectorActive("canva_mcp") || isConnectorActive("canva"),
    slides: isConnectorActive("google-slides") || isConnectorActive("googleslides"),
  }));

  useEffect(() => {
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

  const handleOpenMcpMenu = () => {
    onOpenChange(false);
    if (onNavigateToMcp) {
      onNavigateToMcp();
    } else {
      window.dispatchEvent(
        new CustomEvent("const:navigate-home-tab", { detail: { tab: "mcp" } })
      );
    }
  };

  // Length mode & slide count
  const [lengthMode, setLengthMode] = useState<"short" | "medium" | "long" | "auto">("auto");
  const [customSlideCount, setCustomSlideCount] = useState<number>(10);
  const [isCustomCount, setIsCustomCount] = useState(false);

  // Optional instructions
  const [customInstructions, setCustomInstructions] = useState("");

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-studio-dropdown]")) {
        setIsSourceDropdownOpen(false);
      }
    };
    if (isSourceDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isSourceDropdownOpen]);

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
      customInstructions: customInstructions.trim() || undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] w-full max-h-[88vh] flex flex-col gap-0 p-0 bg-[#161616] border border-[#2b2b2b] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-2 bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <Presentation className="h-4 w-4 text-white shrink-0" />
            <span className="text-sm font-semibold text-white tracking-tight">
              {t("createPresentationTitle")}
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
          <ScrollArea className="flex-1 min-h-0 w-full px-5 py-2">
            <div className="space-y-4 pb-2">
              {/* Source Scope Dropdown (consistent with Video Summary) */}
              <div className="space-y-1.5 relative" data-studio-dropdown>
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("sourceScope")}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
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
                        isSourceDropdownOpen ? "rotate-180 text-white" : ""
                      )}
                    />
                  </button>

                  {isSourceDropdownOpen && (
                    <div className="absolute top-full mt-1.5 left-0 right-0 z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-2 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100">
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
                <label className="text-[11.5px] font-medium text-[#999999] font-sans">
                  {t("presentationEngine")}
                </label>
                <div className="grid grid-cols-3 gap-2.5">
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
                          "p-3 rounded-xl border text-left flex flex-col justify-between gap-2.5 transition-all cursor-pointer font-sans min-h-[72px]",
                          isSelected
                            ? "bg-[#252525] border-white/40 shadow-lg text-white"
                            : "bg-[#1f1f1f] border-[#2c2c2c] hover:border-[#383838] opacity-80 hover:opacity-100 text-[#888888]"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate w-full">
                          {p.logoId ? (
                            <BrandLogo
                              id={p.logoId}
                              size="xs"
                              className="w-5 h-5 rounded-md p-0.5 border-0 shadow-none bg-transparent shrink-0"
                            />
                          ) : (
                            <Presentation className="h-4 w-4 text-white shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-white truncate">
                            {p.id === "slides" ? "Google Slides" : p.name}
                          </span>
                        </div>

                        {/* Connection status badge */}
                        <div className="flex items-center">
                          {p.id === "native" ? (
                            <span className="text-[10px] font-sans font-medium text-[#969696] bg-[#222222] border border-[#2e2e2e] px-1.5 py-0.5 rounded-md">
                              {t("connectorStatusBuiltin")}
                            </span>
                          ) : isConnected ? (
                            <span className="text-[10px] font-sans font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              {t("connectorStatusConnected")}
                            </span>
                          ) : (
                            <span className="text-[10px] font-sans font-medium text-[#969696] bg-[#222222] border border-[#2e2e2e] px-1.5 py-0.5 rounded-md flex items-center gap-1">
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
                    <div className="p-3 rounded-xl bg-[#1c1c1c] border border-[#2e2e2e] space-y-2.5 animate-in fade-in-0 duration-150">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-[#252528] border border-[#2e2e2e] text-amber-400 shrink-0">
                          <Cable className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white font-sans">
                            {provider === "canva"
                              ? t("canvaMcpNotConnected")
                              : t("googleSlidesNotConnected")}
                          </div>
                          <p className="text-[11.5px] text-[#d4d4d4] mt-0.5 leading-relaxed font-sans">
                            {provider === "canva"
                              ? t("canvaMcpNotConnectedDesc")
                              : t("googleSlidesNotConnectedDesc")}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenMcpMenu}
                        className="w-full py-1.5 px-3 rounded-xl bg-[#252528] hover:bg-[#383838] border border-[#2e2e2e] hover:border-[#383838] text-xs font-medium text-white flex items-center justify-between gap-1.5 transition-colors cursor-pointer font-sans"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Cable className="h-3.5 w-3.5 text-white shrink-0" />
                          <span>{t("openMcpMenuHome")}</span>
                          <span className="text-[9.5px] font-sans font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 leading-none">
                            Beta
                          </span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-[#969696] shrink-0" />
                      </button>
                    </div>
                  )}
              </div>

              {/* Slide Count / Length Mode */}
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: "auto" as const,
                        label: t("modeAdaptiveLabel"),
                        desc: t("modeAdaptiveDesc"),
                      },
                      {
                        id: "short" as const,
                        label: t("modeConciseLabel"),
                        desc: t("modeConciseDesc"),
                      },
                      {
                        id: "long" as const,
                        label: t("modeInDepthLabel"),
                        desc: t("modeInDepthDesc"),
                      },
                    ].map((mode) => {
                      const isSelected = lengthMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setLengthMode(mode.id)}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                            isSelected
                              ? "bg-[#252525] border-white/40 text-white shadow"
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
                              ? "bg-[#252525] border-white text-white font-semibold shadow"
                              : "bg-[#1f1f1f] border-[#2c2c2c] hover:border-[#383838] text-[#999]"
                          )}
                        >
                          {t("slidesCount", { count })}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Guidance (Optional) */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("customGuidanceOptional")}
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder={t("presentationGuidancePlaceholder")}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] focus:border-[#444444] text-xs text-white placeholder:text-[#666666] outline-none resize-none transition-colors font-sans"
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
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-semibold text-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <Presentation className="h-3.5 w-3.5" />
              <span>{t("createSlides")}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
