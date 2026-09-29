import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  Check,
  FileText,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreateCheatSheetSheetProps {
  open: boolean;
  onClose: () => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    coverageMode: "short" | "auto" | "long";
    topicFocus?: string;
  }) => void;
}

export function CreateCheatSheetSheet({
  open,
  onClose,
  sources = [],
  onGenerate,
}: CreateCheatSheetSheetProps) {
  const { t } = useI18n();

  const [coverageMode, setCoverageMode] = useState<"short" | "auto" | "long">("auto");
  const [topicFocus, setTopicFocus] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedSourceIds(sources.map((s) => s.id));
      setTopicFocus("");
      setCoverageMode("auto");
    }
  }, [open, sources]);

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
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
        t("chipKeyConcepts", { topic: firstTitle.slice(0, 18) }),
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

  const handleChipClick = (chip: string) => {
    const clean = chip.replace(/^\+\s*/, "");
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
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] bg-[#161616] text-[#e0e0e0] border-t border-[#262626] rounded-t-3xl flex flex-col font-sans select-none overflow-hidden animate-in slide-in-from-bottom duration-300 pb-safe shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#242424] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileSpreadsheet className="h-4 w-4 text-white shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                {t("cheatsheetDialogTitle")}
              </h2>
              <p className="text-[11px] text-[#888888] truncate mt-0.5">
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
            className="p-1 rounded-full text-[#888888] hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 font-sans">
          {/* Section 1: Source Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999]">
                {t("sourceMaterialScope")}
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-white/80 hover:text-white font-medium cursor-pointer"
              >
                {selectedSourceIds.length === sources.length
                  ? t("deselectAll")
                  : t("selectAll")}
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 bg-[#1f1f1f] p-1.5 rounded-xl border border-[#2b2b2b]">
              {sources.map((src) => {
                const isSelected = selectedSourceIds.includes(src.id);
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handleToggleSource(src.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer text-left",
                      isSelected
                        ? "bg-[#282828] text-white"
                        : "hover:bg-[#242424] text-[#888888]"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FileText className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </div>
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "bg-white border-white text-black"
                          : "border-[#444449] bg-transparent"
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Coverage Mode */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {t("coverageAndCardDensity")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "short" as const, label: t("concise"), count: "6-8" },
                { id: "auto" as const, label: t("balanced"), count: "Auto" },
                { id: "long" as const, label: t("inDepth"), count: "10-14" },
              ].map((m) => {
                const isActive = coverageMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setCoverageMode(m.id)}
                    className={cn(
                      "p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5",
                      isActive
                        ? "bg-[#252525] border-white/40 text-white shadow-lg"
                        : "bg-[#1f1f1f] border-[#2c2c2c] text-[#888888] hover:border-[#383838]"
                    )}
                  >
                    <span className="text-xs font-semibold">{m.label}</span>
                    <span className="text-[10px] text-[#888888]">
                      {m.count === "Auto" ? t("autoOption") : t("cardsCount", { count: m.count })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Topic Focus */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {t("cheatsheetTopicFocus")}
            </label>
            <textarea
              value={topicFocus}
              onChange={(e) => setTopicFocus(e.target.value)}
              placeholder={t("cheatsheetTopicPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] text-xs text-white placeholder:text-[#666666] focus:border-[#444444] focus:outline-none resize-none font-sans"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {topicChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#2e2e2e] text-[11px] text-[#a0a0a0] hover:text-white transition-all cursor-pointer active:scale-98"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Submit Action */}
          <div className="pt-2 pb-2">
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className="w-full py-3 rounded-2xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-black font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{t("cheatsheetGenerateBtn")}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
