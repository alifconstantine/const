import React, { useState, useEffect } from "react";
import {
  X,
  HelpCircle,
  Layers,
  Sparkles,
  Check,
  ChevronDown,
  FileText,
  GitFork,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea } from "@const/ui";
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
  const [countLevel, setCountLevel] = useState<"less" | "standard" | "more">("standard");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [topic, setTopic] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

  useEffect(() => {
    setArtifactType(initialType);
  }, [initialType]);

  // Sync default selected sources to all available sources
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources]);

  const countValue = countLevel === "less" ? 5 : countLevel === "more" ? 15 : 10;

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
      <DialogContent className="max-w-[580px] p-0 bg-[#19191b] border border-[#2e2e33] text-[#e0e0e0] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#28282d] bg-[#1d1d21]">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#28282e] border border-[#38383e] flex items-center justify-center">
              {artifactType === "quiz" ? (
                <HelpCircle className="h-4 w-4 text-[#5eead4]" />
              ) : (
                <Layers className="h-4 w-4 text-[#f472b6]" />
              )}
            </div>
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
            className="h-7 w-7 rounded-lg hover:bg-white/10 text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Top Switcher: Quiz vs Flashcards */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999] uppercase tracking-wider">
              {isIndo ? "Pilih Format Belajar" : "Choose Learning Format"}
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#141416] border border-[#28282d]">
              <button
                type="button"
                onClick={() => setArtifactType("quiz")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  artifactType === "quiz"
                    ? "bg-[#28282e] text-white shadow-xs border border-[#3d3d45]"
                    : "text-[#888888] hover:text-[#d4d4d4]"
                }`}
              >
                <HelpCircle className="h-3.5 w-3.5 text-[#5eead4]" />
                <span className="truncate">{isIndo ? "Kuis Pilihan Ganda" : "Interactive Quiz"}</span>
              </button>
              <button
                type="button"
                onClick={() => setArtifactType("flashcard")}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  artifactType === "flashcard"
                    ? "bg-[#28282e] text-white shadow-xs border border-[#3d3d45]"
                    : "text-[#888888] hover:text-[#d4d4d4]"
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-[#f472b6]" />
                <span className="truncate">{isIndo ? "Kartu Flashcards" : "Flashcards Deck"}</span>
              </button>
            </div>
          </div>

          {/* Row: Jumlah Pertanyaan & Tingkat Kesulitan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Jumlah Pertanyaan */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {artifactType === "quiz"
                    ? isIndo
                      ? "Jumlah Pertanyaan"
                      : "Number of Questions"
                    : isIndo
                    ? "Jumlah Kartu"
                    : "Number of Cards"}
                </label>
                <div className="inline-flex w-full rounded-xl bg-[#141416] border border-[#28282d] p-0.5">
                  <button
                    type="button"
                    onClick={() => setCountLevel("less")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      countLevel === "less"
                        ? "bg-[#28282e] text-white shadow-xs"
                        : "text-[#888888] hover:text-[#d4d4d4]"
                    }`}
                  >
                    {isIndo ? "Sedikit (5)" : "Few (5)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountLevel("standard")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      countLevel === "standard"
                        ? "bg-[#28282e] text-white shadow-xs"
                        : "text-[#888888] hover:text-[#d4d4d4]"
                    }`}
                  >
                    {countLevel === "standard" && (
                      <Check className="h-3 w-3 text-[#5eead4]" />
                    )}
                    <span>{isIndo ? "Standar (10)" : "Standard (10)"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountLevel("more")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      countLevel === "more"
                        ? "bg-[#28282e] text-white shadow-xs"
                        : "text-[#888888] hover:text-[#d4d4d4]"
                    }`}
                  >
                    {isIndo ? "Banyak (15)" : "Many (15)"}
                  </button>
                </div>
              </div>

              {/* Tingkat Kesulitan */}
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-[#999999]">
                  {isIndo ? "Tingkat Kesulitan" : "Difficulty Level"}
                </label>
                <div className="inline-flex w-full rounded-xl bg-[#141416] border border-[#28282d] p-0.5">
                  <button
                    type="button"
                    onClick={() => setDifficulty("easy")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      difficulty === "easy"
                        ? "bg-[#28282e] text-white shadow-xs"
                        : "text-[#888888] hover:text-[#d4d4d4]"
                    }`}
                  >
                    {isIndo ? "Mudah" : "Easy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDifficulty("medium")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      difficulty === "medium"
                        ? "bg-[#28282e] text-white shadow-xs"
                        : "text-[#888888] hover:text-[#d4d4d4]"
                    }`}
                  >
                    {difficulty === "medium" && <Check className="h-3 w-3 text-[#5eead4]" />}
                    <span>{isIndo ? "Sedang" : "Medium"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDifficulty("hard")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      difficulty === "hard"
                        ? "bg-[#28282e] text-white shadow-xs"
                        : "text-[#888888] hover:text-[#d4d4d4]"
                    }`}
                  >
                    {isIndo ? "Sulit" : "Hard"}
                  </button>
                </div>
              </div>
            </div>

          {/* Sumber Dropdown */}
          <div className="space-y-1.5 relative">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo ? "Sumber Rujukan" : "Source Scope"}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                className="w-full h-9 px-3 rounded-xl bg-[#141416] border border-[#28282d] hover:border-[#38383e] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
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
                <ChevronDown className="h-3.5 w-3.5 text-[#888888] shrink-0" />
              </button>

              {isSourceDropdownOpen && (
                <div className="absolute top-full mt-1.5 left-0 right-0 z-30 bg-[#1a1a1d] border border-[#333338] rounded-xl p-2 shadow-2xl">
                  <ScrollArea className="max-h-48 w-full" viewportClassName="space-y-1 pr-1">
                    <button
                      type="button"
                      onClick={handleSelectAllSources}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/5 flex items-center justify-between font-medium text-[#5eead4] cursor-pointer"
                    >
                      <span>{selectedSourceIds.length === sources.length ? (isIndo ? "Batalkan Semua" : "Deselect All") : (isIndo ? "Pilih Semua Sumber" : "Select All")}</span>
                    </button>
                    <div className="h-px bg-[#28282d] my-1" />
                    {sources.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleToggleSource(s.id)}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/5 flex items-center justify-between gap-2 cursor-pointer text-[#d4d4d4]"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-3.5 w-3.5 text-[#888888] shrink-0" />
                          <span className="truncate">{s.title}</span>
                        </div>
                        {selectedSourceIds.includes(s.id) && (
                          <Check className="h-3.5 w-3.5 text-[#5eead4] shrink-0" />
                        )}
                      </button>
                    ))}
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
                {isIndo ? "Kosongkan untuk merangkum seluruh materi" : "Leave blank for general summary"}
              </span>
            </div>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder={
                isIndo
                  ? "Contoh: Identifikasi 5 perbedaan utama antara model reasoning dan non-reasoning berdasarkan data rujukan."
                  : "E.g., Compare 5 key differences between reasoning and non-reasoning models."
              }
              className="w-full p-3 rounded-xl bg-[#141416] border border-[#28282d] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#0066ff] resize-none transition-colors"
            />

            {/* Quick Topic Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topicChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-2.5 py-1 rounded-lg bg-[#202024] hover:bg-[#28282e] border border-[#2f2f35] hover:border-[#3f3f48] text-[11px] text-[#a0a0a0] hover:text-white transition-all cursor-pointer active:scale-98"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-between border-t border-[#28282d]">
            {/* AI Estimation Indicator */}
            <div className="flex items-center gap-2 text-[11px] text-[#888888]">
              <Sparkles className="h-3.5 w-3.5 text-[#5eead4]" />
              <span>
                {isIndo ? "Penggunaan AI Terverifikasi" : "Verified AI Generation"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3.5 py-2 rounded-xl bg-[#202024] hover:bg-[#28282d] text-xs font-medium text-[#a0a0a0] hover:text-white transition-colors cursor-pointer"
              >
                {isIndo ? "Buat nanti" : "Cancel"}
              </button>
              <button
                type="submit"
                onClick={handleSubmit as any}
                className="px-4 py-2 rounded-xl bg-[#0066ff] hover:bg-[#1a75ff] text-xs font-semibold text-white shadow-md transition-all cursor-pointer active:scale-98 flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isIndo ? "Buat sekarang" : "Generate Now"}</span>
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
