import React, { useState } from "react";
import {
  X,
  Sparkles,
  HelpCircle,
  Layers,
  Check,
  FileText,
  Sliders,
  ChevronDown,
  GitFork,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreateArtifactSheetProps {
  open: boolean;
  onClose: () => void;
  initialType?: "quiz" | "flashcard" | "mind_map";
  sources: LocalSource[];
  onGenerate: (options: {
    type: "quiz" | "flashcard" | "mind_map";
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    count: number;
    selectedSourceIds: string[];
  }) => void;
}

export function CreateArtifactSheet({
  open,
  onClose,
  initialType = "quiz",
  sources = [],
  onGenerate,
}: CreateArtifactSheetProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const [artifactType, setArtifactType] = useState<"quiz" | "flashcard" | "mind_map">(initialType);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState<number>(10);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );

  // Sync initial type when opened
  React.useEffect(() => {
    if (open) {
      setArtifactType(initialType);
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [open, initialType, sources]);

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleToggleAllSources = () => {
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
      count,
      selectedSourceIds,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] bg-[#1a1a1c] text-[#ededed]",
          "border-t border-[#333336] rounded-t-[28px] shadow-2xl flex flex-col font-sans",
          "animate-in slide-in-from-bottom duration-300 ease-out select-none"
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Swipe Pill / Header */}
        <div className="pt-3 pb-2 px-4 flex flex-col items-center border-b border-[#2d2d30] shrink-0 bg-[#202022] rounded-t-[28px]">
          <div className="w-10 h-1 rounded-full bg-[#444448] mb-2" />
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#2b2b2e] border border-[#3a3a3e] flex items-center justify-center text-[#ededed]">
                {artifactType === "quiz" ? (
                  <HelpCircle className="h-4 w-4" />
                ) : artifactType === "flashcard" ? (
                  <Layers className="h-4 w-4" />
                ) : (
                  <GitFork className="h-4 w-4 text-purple-400" />
                )}
              </div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {artifactType === "quiz"
                  ? isIndo
                    ? "Buat Kuis Interaktif"
                    : "Create Interactive Quiz"
                  : artifactType === "flashcard"
                  ? isIndo
                    ? "Buat Kartu Tanya-Jawab"
                    : "Create Flashcards"
                  : isIndo
                  ? "Buat Peta Pikiran"
                  : "Create Mind Map"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-full bg-[#2a2a2d] hover:bg-[#38383c] text-[#969696] hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Toggle Type: Kuis vs Kartu Tanya-Jawab vs Peta Pikiran */}
          <div>
            <label className="block text-[11px] font-semibold text-[#888888] uppercase tracking-wider mb-2">
              {isIndo ? "Tipe Alat" : "Tool Type"}
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-[#222225] p-1 rounded-xl border border-[#333336]">
              <button
                type="button"
                onClick={() => setArtifactType("quiz")}
                className={cn(
                  "py-2 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 text-xs",
                  artifactType === "quiz"
                    ? "bg-[#2f2f33] text-white shadow-xs border border-[#44444a]"
                    : "text-[#888888] hover:text-[#d4d4d4]"
                )}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>{isIndo ? "Kuis" : "Quiz"}</span>
              </button>
              <button
                type="button"
                onClick={() => setArtifactType("flashcard")}
                className={cn(
                  "py-2 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 text-xs",
                  artifactType === "flashcard"
                    ? "bg-[#2f2f33] text-white shadow-xs border border-[#44444a]"
                    : "text-[#888888] hover:text-[#d4d4d4]"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{isIndo ? "Kartu" : "Cards"}</span>
              </button>
              <button
                type="button"
                onClick={() => setArtifactType("mind_map")}
                className={cn(
                  "py-2 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 text-xs",
                  artifactType === "mind_map"
                    ? "bg-[#2f2f33] text-purple-300 shadow-xs border border-purple-500/40"
                    : "text-[#888888] hover:text-[#d4d4d4]"
                )}
              >
                <GitFork className="h-3.5 w-3.5" />
                <span>{isIndo ? "Peta Pikiran" : "Mind Map"}</span>
              </button>
            </div>
          </div>

          {/* Topic / Specific Input (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                {isIndo ? "Topik Spesifik (Opsional)" : "Specific Topic (Optional)"}
              </label>
              <span className="text-[10px] text-[#666666]">
                {isIndo ? "Kosongkan untuk cakupan umum" : "Leave blank for general"}
              </span>
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                isIndo
                  ? "cth. Bab 3: Logika Proposisi & Kalkulus..."
                  : "e.g. Chapter 3: Propositional Logic..."
              }
              className="w-full px-3 py-2.5 rounded-xl bg-[#222225] border border-[#333336] text-white placeholder-[#666666] focus:outline-none focus:border-[#ededed]/60 text-xs transition-colors"
            />
          </div>

          {/* Mind Map Notice or Counts & Difficulty Row */}
          {artifactType === "mind_map" ? (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11.5px] text-purple-200/90 leading-relaxed">
              {isIndo
                ? "AI akan membuat diagram hierarkis interaktif yang memetakan konsep utama, cabang gagasan, dan keterkaitan materi dari sumber yang Anda tentukan."
                : "AI will generate an interactive hierarchical diagram mapping core concepts, key branches, and conceptual relationships from your selected sources."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Question / Card Count */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  {artifactType === "quiz"
                    ? isIndo
                      ? "Jumlah Soal"
                      : "Question Count"
                    : isIndo
                    ? "Jumlah Kartu"
                    : "Card Count"}
                </label>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 15].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setCount(cnt)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-center font-mono font-medium transition-all text-xs",
                        count === cnt
                          ? "bg-[#2f2f33] border-[#ededed]/60 text-white shadow-xs"
                          : "bg-[#222225] border-[#333336] text-[#888888] hover:text-[#d4d4d4]"
                      )}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  {isIndo ? "Tingkat Kesulitan" : "Difficulty"}
                </label>
                <div className="flex items-center gap-1">
                  {(["easy", "medium", "hard"] as const).map((diff) => {
                    const label =
                      diff === "easy"
                        ? isIndo
                          ? "Mudah"
                          : "Easy"
                        : diff === "medium"
                        ? isIndo
                          ? "Sedang"
                          : "Medium"
                        : isIndo
                        ? "Sulit"
                        : "Hard";
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setDifficulty(diff)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg border text-center font-medium transition-all text-[11px]",
                          difficulty === diff
                            ? "bg-[#2f2f33] border-[#ededed]/60 text-white shadow-xs"
                            : "bg-[#222225] border-[#333336] text-[#888888] hover:text-[#d4d4d4]"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Sources Scope Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                {isIndo ? "Pilih Sumber Acuan" : "Reference Sources"}
              </label>
              {sources.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllSources}
                  className="text-[11px] text-[#ededed] hover:underline cursor-pointer"
                >
                  {selectedSourceIds.length === sources.length
                    ? isIndo
                      ? "Batal Semua"
                      : "Deselect All"
                    : isIndo
                    ? "Pilih Semua"
                    : "Select All"}
                </button>
              )}
            </div>

            {sources.length === 0 ? (
              <div className="p-3 rounded-xl bg-[#222225] border border-[#333336] text-center text-[#888888] text-xs">
                {isIndo
                  ? "Belum ada sumber dalam notebook. AI akan membuat dari topik Anda."
                  : "No sources in notebook. AI will generate based on your topic."}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {sources.map((src) => {
                  const isSelected = selectedSourceIds.includes(src.id);
                  return (
                    <div
                      key={src.id}
                      onClick={() => handleToggleSource(src.id)}
                      className={cn(
                        "p-2 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all",
                        isSelected
                          ? "bg-[#252528] border-[#ededed]/40 text-white"
                          : "bg-[#202022] border-[#2e2e32] text-[#888888] hover:border-[#3a3a3e]"
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded flex items-center justify-center border transition-colors shrink-0",
                          isSelected
                            ? "bg-white border-white text-black"
                            : "border-[#4a4a4f] bg-transparent"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <FileText className="h-3.5 w-3.5 text-[#888888] shrink-0" />
                      <span className="text-xs truncate flex-1 font-medium">
                        {src.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Button: "Buat sekarang" */}
          <div className="pt-2 pb-1">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-white hover:bg-[#ededed] text-black font-semibold text-xs transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isIndo ? "Buat sekarang" : "Generate now"}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
