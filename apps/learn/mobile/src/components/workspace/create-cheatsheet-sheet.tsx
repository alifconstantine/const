import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  Check,
  FileText,
  Sparkles,
  BookOpen,
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
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] bg-card text-card-foreground border-t border-border rounded-t-[28px] flex flex-col font-sans select-none overflow-hidden animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Sheet Header */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-foreground truncate">
                {t("cheatsheetDialogTitle")}
              </h2>
              <p className="text-[10px] text-muted-foreground truncate">
                {t("activeSourcesSelected", { count: selectedSourceIds.length })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Section 1: Source Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                {t("sourceScope")}
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[10px] text-sky-400 font-medium cursor-pointer"
              >
                {selectedSourceIds.length === sources.length
                  ? t("deselectAll")
                  : t("selectAll")}
              </button>
            </div>

            <div className="max-h-28 overflow-y-auto space-y-1 rounded-xl bg-secondary/30 p-1.5 border border-border/50">
              {sources.map((src) => {
                const isSelected = selectedSourceIds.includes(src.id);
                return (
                  <div
                    key={src.id}
                    onClick={() => handleToggleSource(src.id)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                      isSelected ? "bg-secondary text-foreground font-medium" : "text-muted-foreground"
                    )}
                  >
                    <span className="truncate pr-2 text-[11px]">{src.title}</span>
                    <div
                      className={cn(
                        "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                        isSelected ? "bg-sky-500 border-sky-500 text-white" : "border-border"
                      )}
                    >
                      {isSelected && <Check className="h-2 w-2 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Coverage Mode */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              {t("coverageAndCardDensity")}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "short", label: t("concise"), count: "6-8" },
                { id: "auto", label: t("autoOption"), count: "Auto" },
                { id: "long", label: t("inDepth"), count: "10-14" },
              ].map((m) => {
                const isActive = coverageMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setCoverageMode(m.id as any)}
                    className={cn(
                      "p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5",
                      isActive
                        ? "bg-sky-500/10 border-sky-500/50 text-sky-400"
                        : "bg-secondary/40 border-border/70 text-muted-foreground"
                    )}
                  >
                    <span className="text-[11.5px] font-semibold">{m.label}</span>
                    <span className="text-[9.5px] opacity-75">
                      {m.count === "Auto" ? t("autoOption") : t("cardsCount", { count: m.count })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Topic Focus */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              {t("cheatsheetTopicFocus")}
            </label>
            <textarea
              value={topicFocus}
              onChange={(e) => setTopicFocus(e.target.value)}
              placeholder={t("cheatsheetTopicPlaceholder")}
              rows={2}
              className="w-full bg-secondary/50 rounded-xl p-2.5 text-xs outline-none border border-border focus:border-sky-500/50 text-foreground placeholder:text-muted-foreground/60 resize-none"
            />
            <div className="flex flex-wrap gap-1">
              {topicChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Submit Action */}
          <div className="pt-2 pb-6">
            <button
              type="submit"
              disabled={sources.length === 0}
              className="w-full py-3 rounded-2xl bg-foreground text-background font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t("cheatsheetGenerateBtn")}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
