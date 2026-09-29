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
  const { t, language } = useI18n();
  const isIndo = language === "id";

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
        isIndo ? `+ Intisari: ${firstTitle.slice(0, 18)}` : `+ Key Concepts: ${firstTitle.slice(0, 18)}`,
        isIndo ? "+ Rumus & Formula Kunci" : "+ Formulas & Equations",
        isIndo ? "+ Sintaks & Aturan Praktis" : "+ Syntax & Rules",
        isIndo ? "+ Jebakan Soal Ujian" : "+ Exam Pitfalls",
      ];
    }
    return [
      isIndo ? "+ Rumus & Formula Kunci" : "+ Formulas & Equations",
      isIndo ? "+ Sintaks & Aturan Praktis" : "+ Syntax & Rules",
      isIndo ? "+ Definisi & Asas Kunci" : "+ Key Definitions",
      isIndo ? "+ Jebakan Soal Ujian" : "+ Exam Pitfalls",
    ];
  }, [sources, isIndo]);

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
                {isIndo ? "Buat CheatSheet" : "Create CheatSheet"}
              </h2>
              <p className="text-[11px] text-[#888888] truncate mt-0.5">
                {selectedSourceIds.length === sources.length
                  ? isIndo
                    ? `Semua sumber (${sources.length} sumber)`
                    : `All sources (${sources.length})`
                  : isIndo
                  ? `${selectedSourceIds.length} dari ${sources.length} sumber dipilih`
                  : `${selectedSourceIds.length} of ${sources.length} sources selected`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg hover:bg-[#222222] text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Section 1: Source Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999]">
                {isIndo ? "Sumber Rujukan Materi" : "Source Scope"}
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-white/80 hover:text-white font-medium cursor-pointer"
              >
                {selectedSourceIds.length === sources.length
                  ? isIndo ? "Batal Semua" : "Deselect All"
                  : isIndo ? "Pilih Semua" : "Select All"}
              </button>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1 rounded-xl bg-[#222222] p-1.5 border border-[#2b2b2b]">
              {sources.map((src) => {
                const isSelected = selectedSourceIds.includes(src.id);
                return (
                  <div
                    key={src.id}
                    onClick={() => handleToggleSource(src.id)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                      isSelected ? "bg-[#2c2c2c] text-white font-medium" : "text-[#888888] hover:text-[#cccccc]"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FileText className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                      <span className="truncate text-xs">{src.title}</span>
                    </div>
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "bg-white border-white text-black" : "border-[#444449] bg-transparent"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Coverage Mode */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo ? "Kedalaman & Kepadatan Kartu" : "Coverage & Card Density"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "short" as const, label: isIndo ? "Ringkas" : "Concise", count: "6-8" },
                { id: "auto" as const, label: isIndo ? "Seimbang" : "Balanced", count: "Auto" },
                { id: "long" as const, label: isIndo ? "Lengkap" : "Comprehensive", count: "10-14" },
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
                      {m.count} {isIndo ? "kartu" : "cards"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Topic Focus */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo ? "Fokus Topik atau Arahan Kustom (Opsional)" : "Topic Focus or Custom Prompt (Optional)"}
            </label>
            <textarea
              value={topicFocus}
              onChange={(e) => setTopicFocus(e.target.value)}
              placeholder={
                isIndo
                  ? "Contoh: Fokus pada bab 3, tekankan sintaks CLI dan jebakan umum..."
                  : "e.g., Focus on chapter 3, emphasize CLI syntax and pitfalls..."
              }
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
              <span>{isIndo ? "Buat CheatSheet" : "Create CheatSheet"}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
