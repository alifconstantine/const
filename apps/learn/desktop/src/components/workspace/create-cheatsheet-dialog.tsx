import React, { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  X,
  Check,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreateCheatSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    coverageMode: "short" | "auto" | "long";
    topicFocus?: string;
  }) => void;
}

export function CreateCheatSheetDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
}: CreateCheatSheetDialogProps) {
  const { t } = useI18n();

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [coverageMode, setCoverageMode] = useState<"short" | "auto" | "long">("auto");
  const [topicFocus, setTopicFocus] = useState<string>("");
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

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

  // Default: select all active sources
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources]);

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllSources = () => {
    if (selectedSourceIds.length === sources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  };

  const topicChips = useMemo(() => {
    const firstTitle = sources[0]?.title || "";
    if (firstTitle) {
      return [
        t("chipKeyConcepts", { topic: firstTitle.slice(0, 20) }),
        t("chipFormulasKeyEquations"),
        t("chipSyntaxQuickRules"),
        t("chipCommonExamPitfalls"),
      ];
    }
    return [
      t("chipFormulasKeyEquations"),
      t("chipSyntaxQuickRules"),
      t("chipKeyDefinitions"),
      t("chipCommonExamPitfalls"),
    ];
  }, [sources, t]);

  const handleChipClick = (chipText: string) => {
    const clean = chipText.replace(/^\+\s*/, "");
    if (!topicFocus.trim()) {
      setTopicFocus(clean);
    } else {
      setTopicFocus((prev) => `${prev}, ${clean}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSourceIds.length === 0) return;

    onGenerate({
      selectedSourceIds:
        selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
      coverageMode,
      topicFocus: topicFocus.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] w-full max-h-[88vh] flex flex-col gap-0 p-0 bg-[#161616] border border-[#2b2b2b] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        {/* Header - Borderless austere studio style */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-2 bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-4 w-4 text-white shrink-0" />
            <span className="text-sm font-semibold text-white tracking-tight">
              {t("cheatsheetDialogTitle")}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 w-full px-5 py-2">
            <div className="space-y-4 pb-2">
              {/* Concept Explanation Box */}
              <div className="p-3.5 rounded-xl bg-[#222222] border border-[#2b2b2b] flex items-start gap-3">
                <FileSpreadsheet className="h-4 w-4 text-white shrink-0 mt-0.5" />
                <div className="text-xs text-[#d4d4d4] leading-relaxed">
                  {t("cheatsheetDialogSubtitle")}
                </div>
              </div>

              {/* Source Selection (matching Video Summary studio dropdown) */}
              <div className="space-y-1.5 relative" data-studio-dropdown>
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("sourceMaterialScope")}
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
                        : t("selectedOfTotalSources", {
                            selected: selectedSourceIds.length,
                            total: sources.length,
                          })}
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
                      {/* Select All Toggle */}
                      <button
                        type="button"
                        onClick={handleSelectAllSources}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc] cursor-pointer transition-colors"
                      >
                        <span className="font-medium">
                          {selectedSourceIds.length === sources.length
                            ? t("deselectAll")
                            : t("selectAll")}
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

                      {/* ScrollArea with max-height to handle many sources smoothly */}
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

              {/* Coverage & Card Density */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("coverageAndCardDensity")}
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: "short" as const,
                      title: t("cheatsheetCoverageShort"),
                      desc: t("cheatsheetCoverageShortDesc"),
                    },
                    {
                      id: "auto" as const,
                      title: t("cheatsheetCoverageAuto"),
                      desc: t("cheatsheetCoverageAutoDesc"),
                    },
                    {
                      id: "long" as const,
                      title: t("cheatsheetCoverageLong"),
                      desc: t("cheatsheetCoverageLongDesc"),
                    },
                  ].map((mode) => {
                    const isSelected = coverageMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setCoverageMode(mode.id)}
                        className={cn(
                          "p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer min-w-0 h-[88px]",
                          isSelected
                            ? "bg-[#252525] border-white/40 text-white shadow-lg"
                            : "bg-[#1f1f1f] border-[#2c2c2c] hover:border-[#383838] text-[#888888] opacity-80 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span
                            className={cn(
                              "text-xs font-semibold truncate pr-1.5",
                              isSelected ? "text-white" : "text-[#d0d0d0]"
                            )}
                          >
                            {mode.title}
                          </span>
                          <div
                            className={cn(
                              "h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                              isSelected ? "border-white bg-white text-black" : "border-[#444449] bg-transparent"
                            )}
                          >
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-[#888888] line-clamp-2 leading-tight">
                          {mode.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topic Focus or Custom Prompt */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {t("cheatsheetTopicFocus")}
                </label>
                <textarea
                  value={topicFocus}
                  onChange={(e) => setTopicFocus(e.target.value)}
                  placeholder={t("cheatsheetTopicPlaceholder")}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] focus:border-[#444444] focus:outline-none text-xs text-white placeholder:text-[#666666] resize-none transition-colors font-sans"
                />

                {/* Suggestions chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {topicChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#2e2e2e] hover:border-[#383838] text-[11px] text-[#a0a0a0] hover:text-white transition-all cursor-pointer active:scale-98"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer Actions - Borderless studio style */}
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
              disabled={selectedSourceIds.length === 0}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-semibold text-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>{t("cheatsheetGenerateBtn")}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
