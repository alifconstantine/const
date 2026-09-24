import React, { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  X,
  Check,
  ChevronDown,
  Sparkles,
  FileText,
  Search,
  BookOpen,
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
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [coverageMode, setCoverageMode] = useState<"short" | "auto" | "long">("auto");
  const [topicFocus, setTopicFocus] = useState<string>("");
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");

  // Default: select all active sources
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources]);

  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return sources;
    const q = sourceSearch.toLowerCase();
    return sources.filter((s) => (s.title || "").toLowerCase().includes(q));
  }, [sources, sourceSearch]);

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
        isIndo ? `+ Intisari: ${firstTitle.slice(0, 20)}` : `+ Key Concepts: ${firstTitle.slice(0, 20)}`,
        isIndo ? "+ Rumus & Formula Kunci" : "+ Formulas & Key Equations",
        isIndo ? "+ Sintaks & Aturan Praktis" : "+ Syntax & Quick Rules",
        isIndo ? "+ Jebakan Soal Ujian" : "+ Common Exam Pitfalls",
      ];
    }
    return [
      isIndo ? "+ Rumus & Formula Kunci" : "+ Formulas & Key Equations",
      isIndo ? "+ Sintaks & Aturan Praktis" : "+ Syntax & Quick Rules",
      isIndo ? "+ Definisi & Asas Kunci" : "+ Key Definitions",
      isIndo ? "+ Jebakan Soal Ujian" : "+ Common Exam Pitfalls",
    ];
  }, [sources, isIndo]);

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
      <DialogContent className="max-w-[560px] p-0 bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none ring-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-card">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground tracking-tight truncate">
                {t("cheatsheetDialogTitle")}
              </h2>
              <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                {t("cheatsheetDialogSubtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Section 1: Source Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground tracking-tight flex items-center justify-between">
                <span>{isIndo ? "Sumber Pembelajaran" : "Learning Sources"}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {selectedSourceIds.length} {isIndo ? "dari" : "of"} {sources.length} {isIndo ? "sumber dipilih" : "sources selected"}
                </span>
              </label>

              <div className="relative" data-studio-dropdown>
                <button
                  type="button"
                  onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                  className="w-full h-10 px-3 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/80 text-foreground flex items-center justify-between text-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {selectedSourceIds.length === sources.length
                        ? isIndo
                          ? `Semua Sumber (${sources.length} dokumen)`
                          : `All Sources (${sources.length} docs)`
                        : isIndo
                        ? `${selectedSourceIds.length} sumber aktif dipilih`
                        : `${selectedSourceIds.length} active sources selected`}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                </button>

                {isSourceDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 p-2 rounded-xl bg-popover border border-border shadow-xl z-20 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-1 pb-1.5 border-b border-border/50">
                      <div className="relative flex-1 mr-2">
                        <Search className="h-3 w-3 absolute left-2 top-2.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={sourceSearch}
                          onChange={(e) => setSourceSearch(e.target.value)}
                          placeholder={isIndo ? "Cari sumber..." : "Search sources..."}
                          className="w-full bg-secondary text-[11px] rounded-lg pl-7 pr-2 py-1 outline-none border border-border/60 text-foreground"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSelectAllSources}
                        className="text-[10.5px] font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer shrink-0"
                      >
                        {selectedSourceIds.length === sources.length
                          ? isIndo ? "Batal Semua" : "Deselect All"
                          : isIndo ? "Pilih Semua" : "Select All"}
                      </button>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {filteredSources.map((src) => {
                        const isSelected = selectedSourceIds.includes(src.id);
                        return (
                          <div
                            key={src.id}
                            onClick={() => handleToggleSource(src.id)}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors",
                              isSelected ? "bg-secondary text-foreground" : "hover:bg-secondary/40 text-muted-foreground"
                            )}
                          >
                            <span className="truncate pr-2">{src.title}</span>
                            <div
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                isSelected ? "bg-sky-500 border-sky-500 text-white" : "border-border"
                              )}
                            >
                              {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Coverage Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground tracking-tight">
                {isIndo ? "Kedalaman & Jumlah Kartu" : "Coverage & Card Density"}
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: "short",
                    title: t("cheatsheetCoverageShort"),
                    desc: t("cheatsheetCoverageShortDesc"),
                  },
                  {
                    id: "auto",
                    title: t("cheatsheetCoverageAuto"),
                    desc: t("cheatsheetCoverageAutoDesc"),
                  },
                  {
                    id: "long",
                    title: t("cheatsheetCoverageLong"),
                    desc: t("cheatsheetCoverageLongDesc"),
                  },
                ].map((mode) => {
                  const isActive = coverageMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setCoverageMode(mode.id as any)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-[84px] select-none",
                        isActive
                          ? "bg-sky-500/10 border-sky-500/40 text-foreground"
                          : "bg-secondary/40 border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn("text-[11.5px] font-semibold tracking-tight", isActive ? "text-sky-400" : "text-foreground")}>
                          {mode.title}
                        </span>
                        <div
                          className={cn(
                            "h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0",
                            isActive ? "border-sky-400 bg-sky-400" : "border-muted-foreground/40"
                          )}
                        >
                          {isActive && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                        {mode.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Topic Focus / Custom Prompt */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground tracking-tight">
                {t("cheatsheetTopicFocus")}
              </label>
              <textarea
                value={topicFocus}
                onChange={(e) => setTopicFocus(e.target.value)}
                placeholder={t("cheatsheetTopicPlaceholder")}
                rows={2}
                className="w-full bg-secondary/60 hover:bg-secondary focus:bg-secondary rounded-xl p-3 text-xs outline-none border border-border/80 focus:border-sky-500/50 text-foreground placeholder:text-muted-foreground/60 resize-none transition-colors"
              />

              {/* Suggestions chips */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {topicChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="text-[10.5px] px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 border border-border/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 border-t border-border/60 bg-secondary/30 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {isIndo ? "Batal" : "Cancel"}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t("cheatsheetGenerateBtn")}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
