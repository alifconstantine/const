import React, { useState, useEffect } from "react";
import {
  X,
  Presentation,
  Check,
  ChevronDown,
  Sliders,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, cn, toast } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreatePresentationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    provider: "native";
    lengthMode: "medium" | "long" | "auto";
    slideCount?: number;
    customInstructions?: string;
  }) => Promise<void> | void;
}

export function CreatePresentationDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
}: CreatePresentationDialogProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  // Sources selection
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Length mode & slide count
  const [lengthMode, setLengthMode] = useState<"medium" | "long" | "auto">("auto");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSourceIds.length === 0 || isSynthesizing) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error(
        isIndo
          ? "Tidak ada koneksi internet. Pastikan perangkat Anda terhubung ke jaringan."
          : "No internet connection. Please check your network connection."
      );
      return;
    }

    let targetCount: number | undefined = undefined;
    if (isCustomCount && customSlideCount > 0) {
      targetCount = customSlideCount;
    } else if (lengthMode === "long") {
      targetCount = 10;
    } else if (lengthMode === "medium") {
      targetCount = 7;
    }

    try {
      setIsSynthesizing(true);
      await onGenerate({
        selectedSourceIds:
          selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
        provider: "native",
        lengthMode,
        slideCount: targetCount,
        customInstructions: customInstructions.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Presentation prompt synthesis error:", err);
      toast.error(err?.message || t("errorOccurred"));
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] w-full max-h-[88vh] flex flex-col gap-0 p-0 bg-[#161616] border border-[#2b2b2b] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
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
            className="p-1 rounded-lg text-[#777777] hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 p-5 min-h-0">
            <div className="space-y-4">
              {/* Sources Dropdown */}
              <div className="space-y-1.5" data-studio-dropdown>
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("videoSourceScopeLabel")}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#202020] border border-[#2c2c2c] hover:border-[#383838] flex items-center justify-between text-xs text-white transition-colors cursor-pointer"
                  >
                    <span className="truncate">
                      {selectedSourceIds.length === 0
                        ? isIndo
                          ? "Pilih sumber rujukan..."
                          : "Select sources..."
                        : selectedSourceIds.length === sources.length
                        ? t("videoAllSourcesSelected", { count: sources.length })
                        : t("videoSourcesSelectedCount", {
                            selected: selectedSourceIds.length,
                            total: sources.length,
                          })}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-[#777] transition-transform",
                        isSourceDropdownOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isSourceDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 p-2 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] shadow-2xl max-h-56 flex flex-col">
                      <div
                        onClick={handleSelectAllSources}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-[#272727] cursor-pointer flex items-center justify-between border-b border-[#282828] mb-1 pb-2 shrink-0"
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

                      <ScrollArea className="flex-1 max-h-40 overflow-y-auto pr-1">
                        {sources.map((src) => {
                          const isSelected = selectedSourceIds.includes(src.id);
                          return (
                            <button
                              key={src.id}
                              type="button"
                              onClick={() => handleToggleSource(src.id)}
                              className="w-full px-2.5 py-2 rounded-lg text-xs hover:bg-[#282828] cursor-pointer flex items-center justify-between transition-colors text-left font-sans"
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

              {/* Engine Spec Banner: Const Native 16:9 PDF */}
              <div className="p-3 rounded-xl bg-[#1d1d1d] border border-[#2d2d2d] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <Presentation className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                      <span>Const Native (16:9 PDF Deck)</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Autonomous
                      </span>
                    </div>
                    <p className="text-[11px] text-[#888888] truncate mt-0.5">
                      {isIndo
                        ? "AI menentukan tata letak, palet warna, tipografi, dan mengekspor ke format PDF"
                        : "AI determines layout, color palette, typography, and exports directly to PDF"}
                    </p>
                  </div>
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
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        id: "auto" as const,
                        label: t("modeAdaptiveLabel"),
                        desc: isIndo
                          ? "AI menentukan jumlah slide ideal secara proporsional"
                          : "AI dynamically determines the optimal slide count",
                      },
                      {
                        id: "long" as const,
                        label: t("modeInDepthLabel"),
                        desc: isIndo
                          ? "Kajian mendalam dan komprehensif (~10-12 slide)"
                          : "In-depth comprehensive analysis (~10-12 slides)",
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
                    {[5, 8, 10, 12, 15, 20].map((count) => {
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

          {/* Footer Actions */}
          <div className="shrink-0 px-5 py-3.5 bg-[#161616] flex items-center justify-end gap-2 border-t border-[#242424]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl bg-transparent hover:bg-[#222222] text-xs font-medium text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0 || isSynthesizing}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-semibold text-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t("synthesizingPrompt") || "Meracik Prompt..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t("createSlides")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
