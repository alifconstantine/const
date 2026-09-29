import React, { useState, useEffect } from "react";
import {
  X,
  HelpCircle,
  Layers,
  Check,
  ChevronDown,
  FileText,
  GitFork,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreateStudioArtifactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: "quiz" | "flashcard";
  sources: LocalSource[];
  onGenerate: (options: {
    type: "quiz" | "flashcard";
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    count: number;
    selectedSourceIds: string[];
  }) => void;
}

export function CreateStudioArtifactDialog({
  open,
  onOpenChange,
  initialType = "quiz",
  sources,
  onGenerate,
}: CreateStudioArtifactDialogProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [artifactType, setArtifactType] = useState<"quiz" | "flashcard">(initialType);
  const [countMode, setCountMode] = useState<"5" | "10" | "custom">("10");
  const [customCount, setCustomCount] = useState<number>(15);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [topic, setTopic] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

  useEffect(() => {
    setArtifactType(initialType);
  }, [initialType]);

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

  // Sync default selected sources to all available sources
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources]);

  const countValue =
    countMode === "5"
      ? 5
      : countMode === "10"
      ? 10
      : Math.max(1, Math.min(50, Number(customCount) || 10));

  // Smart suggestions based on source titles
  const topicChips = React.useMemo(() => {
    const primarySourceTitle = sources[0]?.title || "";
    if (primarySourceTitle) {
      return [
        isIndo ? `+ Uji Pemahaman: ${primarySourceTitle.slice(0, 24)}` : `+ Key Concepts: ${primarySourceTitle.slice(0, 24)}`,
        isIndo ? "+ Analisis Perbandingan Kinerja" : "+ Performance Comparison",
        isIndo ? "+ Karakteristik & Metodologi Kunci" : "+ Key Characteristics",
      ];
    }
    return [
      isIndo ? "+ Uji Pemahaman Konsep" : "+ Test Core Understanding",
      isIndo ? "+ Analisis Perbandingan" : "+ Comparative Analysis",
      isIndo ? "+ Karakteristik & Prinsip Utama" : "+ Main Principles",
    ];
  }, [sources, isIndo]);

  const handleChipClick = (chipText: string) => {
    const cleanText = chipText.replace(/^\+\s*/, "");
    if (!topic.trim()) {
      setTopic(cleanText);
    } else {
      setTopic((prev) => `${prev}, ${cleanText}`);
    }
  };

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
    onGenerate({
      type: artifactType,
      topic: topic.trim(),
      difficulty,
      count: countValue,
      selectedSourceIds:
        selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[580px] max-h-[88vh] flex flex-col gap-0 p-0 bg-[#161616] border border-[#2b2b2b] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        {/* Header - Borderless austere studio style */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-2 bg-[#161616]">
          <div className="flex items-center gap-2.5">
            {artifactType === "quiz" ? (
              <HelpCircle className="h-4 w-4 text-white shrink-0" />
            ) : (
              <Layers className="h-4 w-4 text-white shrink-0" />
            )}
            <span className="text-sm font-semibold text-white tracking-tight">
              {artifactType === "quiz"
                ? isIndo
                  ? "Kuis Interaktif"
                  : "Interactive Quiz"
                : isIndo
                ? "Kartu Tanya-Jawab (Flashcards)"
                : "Flashcards Deck"}
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
              {/* Top Switcher: Quiz vs Flashcards */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {isIndo ? "Format Belajar" : "Learning Format"}
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#222222] border border-[#2b2b2b]">
                  <button
                    type="button"
                    onClick={() => setArtifactType("quiz")}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                      artifactType === "quiz"
                        ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                        : "text-[#888888] hover:text-[#cccccc]"
                    )}
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-white" />
                    <span className="truncate">{isIndo ? "Kuis Pilihan Ganda" : "Interactive Quiz"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setArtifactType("flashcard")}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                      artifactType === "flashcard"
                        ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                        : "text-[#888888] hover:text-[#cccccc]"
                    )}
                  >
                    <Layers className="h-3.5 w-3.5 text-white" />
                    <span className="truncate">{isIndo ? "Kartu Flashcards" : "Flashcards Deck"}</span>
                  </button>
                </div>
              </div>

              {/* Row: Jumlah Pertanyaan & Tingkat Kesulitan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Jumlah Pertanyaan */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11.5px] font-medium text-[#999999]">
                      {artifactType === "quiz"
                        ? isIndo
                          ? "Jumlah Pertanyaan"
                          : "Number of Questions"
                        : isIndo
                        ? "Jumlah Kartu"
                        : "Number of Cards"}
                    </label>
                    {countMode === "custom" && (
                      <span className="text-[10px] text-[#777777]">1 - 50</span>
                    )}
                  </div>
                  <div className="inline-flex w-full rounded-xl bg-[#222222] border border-[#2b2b2b] p-0.5">
                    <button
                      type="button"
                      onClick={() => setCountMode("5")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer",
                        countMode === "5"
                          ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                          : "text-[#888888] hover:text-[#cccccc]"
                      )}
                    >
                      5
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountMode("10")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1",
                        countMode === "10"
                          ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                          : "text-[#888888] hover:text-[#cccccc]"
                      )}
                    >
                      {countMode === "10" && <Check className="h-3 w-3 text-white stroke-[2.5]" />}
                      <span>10</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountMode("custom")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1",
                        countMode === "custom"
                          ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                          : "text-[#888888] hover:text-[#cccccc]"
                      )}
                    >
                      {countMode === "custom" && <Check className="h-3 w-3 text-white stroke-[2.5]" />}
                      <span>{isIndo ? "Kustom" : "Custom"}</span>
                    </button>
                  </div>

                  {countMode === "custom" && (
                    <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={customCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setCustomCount(isNaN(val) ? ("" as any) : Math.max(1, Math.min(50, val)));
                        }}
                        onBlur={() => {
                          if (!customCount || Number(customCount) < 1) setCustomCount(5);
                          else if (Number(customCount) > 50) setCustomCount(50);
                        }}
                        placeholder="1-50"
                        className="w-20 h-8 px-2.5 rounded-lg bg-[#222222] border border-[#2b2b2b] text-white font-sans tabular-nums text-xs focus:outline-none focus:border-[#444444] transition-colors text-center"
                      />
                      <span className="text-[11px] text-[#777777]">
                        {artifactType === "quiz"
                          ? isIndo
                            ? "soal (maks. 50)"
                            : "questions (max 50)"
                          : isIndo
                          ? "kartu (maks. 50)"
                          : "cards (max 50)"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tingkat Kesulitan */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {isIndo ? "Tingkat Kesulitan" : "Difficulty Level"}
                  </label>
                  <div className="inline-flex w-full rounded-xl bg-[#222222] border border-[#2b2b2b] p-0.5">
                    <button
                      type="button"
                      onClick={() => setDifficulty("easy")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer",
                        difficulty === "easy"
                          ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                          : "text-[#888888] hover:text-[#cccccc]"
                      )}
                    >
                      {isIndo ? "Mudah" : "Easy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDifficulty("medium")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1",
                        difficulty === "medium"
                          ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                          : "text-[#888888] hover:text-[#cccccc]"
                      )}
                    >
                      {difficulty === "medium" && <Check className="h-3 w-3 text-white stroke-[2.5]" />}
                      <span>{isIndo ? "Sedang" : "Medium"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDifficulty("hard")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs transition-all cursor-pointer",
                        difficulty === "hard"
                          ? "bg-[#2b2b2b] text-white shadow-xs font-semibold"
                          : "text-[#888888] hover:text-[#cccccc]"
                      )}
                    >
                      {isIndo ? "Sulit" : "Hard"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sumber Dropdown */}
              <div className="space-y-1.5 relative" data-studio-dropdown>
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {isIndo ? "Sumber Rujukan Materi" : "Source Material Scope"}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                    className="w-full h-9 px-3 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
                  >
                    <span className="text-white font-medium truncate">
                      {selectedSourceIds.length === sources.length
                        ? isIndo
                          ? `Semua sumber (${sources.length} sumber)`
                          : `All sources (${sources.length})`
                        : isIndo
                        ? `${selectedSourceIds.length} dari ${sources.length} sumber terpilih`
                        : `${selectedSourceIds.length} of ${sources.length} sources selected`}
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
                      <ScrollArea className="max-h-48 w-full" viewportClassName="space-y-1 pr-1">
                        <button
                          type="button"
                          onClick={handleSelectAllSources}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc] cursor-pointer transition-colors"
                        >
                          <span className="font-medium">
                            {selectedSourceIds.length === sources.length ? (isIndo ? "Batalkan Semua" : "Deselect All") : (isIndo ? "Pilih Semua Sumber" : "Select All")}
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
                        {sources.map((s) => {
                          const isSelected = selectedSourceIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleToggleSource(s.id)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-left cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <FileText className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                                <span className="truncate text-[#e0e0e0]">{s.title}</span>
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

              {/* Apa topiknya? (Textarea Input) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] font-medium text-[#999999]">
                    {isIndo ? "Apa topiknya? (Opsional)" : "What is the topic? (Optional)"}
                  </label>
                  <span className="text-[10px] text-[#777777]">
                    {isIndo ? "Kosongkan untuk cakupan umum" : "Leave blank for general"}
                  </span>
                </div>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={2}
                  placeholder={
                    isIndo
                      ? "Contoh: Identifikasi 5 perbedaan utama antara model reasoning dan non-reasoning berdasarkan data rujukan."
                      : "E.g., Compare 5 key differences between reasoning and non-reasoning models."
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] focus:border-[#444444] focus:outline-none text-xs text-white placeholder:text-[#666666] resize-none transition-colors font-sans leading-relaxed"
                />

                {/* Quick Topic Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {topicChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#2e2e2e] hover:border-[#383838] text-[11px] text-[#a0a0a0] hover:text-white transition-all cursor-pointer truncate max-w-full active:scale-98"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer - Borderless, clean austere buttons, no AI usage bar */}
          <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 bg-[#161616]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl bg-transparent hover:bg-[#222222] text-xs text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              {isIndo ? "Batal" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={sources.length === 0}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-semibold text-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <span>
                {artifactType === "quiz"
                  ? isIndo ? "Buat Kuis" : "Create Quiz"
                  : isIndo ? "Buat Flashcards" : "Create Flashcards"}
              </span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

  );
}
