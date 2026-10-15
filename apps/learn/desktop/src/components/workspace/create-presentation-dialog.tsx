import React, { useState, useEffect } from "react";
import {
  X,
  Presentation,
  Check,
  ChevronDown,
  Sliders,
  FileText,
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
    provider: "native";
    lengthMode: "short" | "medium" | "long" | "auto";
    slideCount?: number;
    customInstructions?: string;
  }) => void;
}

export function CreatePresentationDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
}: CreatePresentationDialogProps) {
  const { t } = useI18n();

  // Sources selection
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

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
      provider: "native",
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
              {/* Source Scope Dropdown */}
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
                        ? t("videoAllSourcesSelected", { count: sources.length })
                        : t("videoSourcesSelectedCount", {
                            selected: selectedSourceIds.length,
                            total: sources.length,
                          })}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-[#888888] transition-transform",
                        isSourceDropdownOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isSourceDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 p-1.5 rounded-xl bg-[#1e1e1e] border border-[#2c2c2c] shadow-xl max-h-48 overflow-y-auto space-y-0.5">
                      <div
                        onClick={handleSelectAllSources}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-[#272727] cursor-pointer flex items-center justify-between border-b border-[#282828] mb-1 pb-2"
                      >
                        <span>
                          {selectedSourceIds.length === sources.length
                            ? t("videoDeselectAllSources")
                            : t("videoSelectAllSources")}
                        </span>
                        <span className="text-[10px] text-[#777]">
                          {selectedSourceIds.length}/{sources.length}
                        </span>
                      </div>

                      {sources.map((s) => {
                        const isChecked = selectedSourceIds.includes(s.id);
                        return (
                          <div
                            key={s.id}
                            onClick={() => handleToggleSource(s.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#272727] cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <span
                              className={cn(
                                "truncate pr-2",
                                isChecked ? "text-white font-medium" : "text-[#888]"
                              )}
                            >
                              {s.title}
                            </span>
                            <div
                              className={cn(
                                "h-3.5 w-3.5 rounded flex items-center justify-center shrink-0 border transition-colors",
                                isChecked
                                  ? "bg-white border-white text-black"
                                  : "border-[#444] bg-transparent"
                              )}
                            >
                              {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
