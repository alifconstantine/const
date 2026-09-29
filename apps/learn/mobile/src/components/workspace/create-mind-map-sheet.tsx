import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  GitFork,
  Check,
  FileText,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreateMindMapSheetProps {
  open: boolean;
  onClose: () => void;
  sources: LocalSource[];
  onGenerate: (options: {
    type: "mind_map";
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    count: number;
    selectedSourceIds: string[];
  }) => void;
}

export function CreateMindMapSheet({
  open,
  onClose,
  sources = [],
  onGenerate,
}: CreateMindMapSheetProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [topic, setTopic] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );

  // Sync initial selection when opened
  useEffect(() => {
    if (open) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [open, sources]);

  // Topic suggestion chips based on source material
  const topicChips = useMemo(() => {
    const primarySourceTitle = sources[0]?.title || "";
    if (primarySourceTitle) {
      return [
        isIndo ? `+ Ikhtisar: ${primarySourceTitle.slice(0, 24)}` : `+ Overview: ${primarySourceTitle.slice(0, 24)}`,
        isIndo ? "+ Struktur Hierarki Konsep" : "+ Hierarchical Architecture",
        isIndo ? "+ Taksonomi & Kategori Utama" : "+ Core Taxonomy & Categories",
      ];
    }
    return [
      isIndo ? "+ Peta Konsep Keseluruhan" : "+ Comprehensive Concept Map",
      isIndo ? "+ Alur Pemikiran & Hubungan" : "+ Logical Flow & Relationships",
      isIndo ? "+ Gagasan Pokok & Cabang Materi" : "+ Core Branches & Themes",
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
      type: "mind_map",
      topic: topic.trim(),
      difficulty: "medium",
      count: 10,
      selectedSourceIds:
        selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[60] max-h-[92dvh] bg-[#1a1a1c] text-[#ededed]",
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
              <div className="h-7 w-7 rounded-lg bg-[#2b2b2e] border border-purple-500/40 flex items-center justify-center text-[#c084fc]">
                <GitFork className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {isIndo ? "Buat Peta Pikiran (Mind Map)" : "Create Interactive Mind Map"}
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
          {/* Concept Explanation Card */}
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-2.5 text-purple-200/90 leading-relaxed">
            <GitFork className="h-4 w-4 text-[#c084fc] shrink-0 mt-0.5" />
            <div className="text-[11.5px]">
              {isIndo
                ? "AI akan menganalisis materi sumber untuk menyusun diagram hierarkis interaktif yang menghubungkan konsep pokok, percabangan gagasan, dan detail rujukan secara visual."
                : "AI will analyze your source material to generate an interactive hierarchical diagram connecting core concepts, topic branches, and contextual references."}
            </div>
          </div>

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
                          ? "bg-[#252528] border-purple-500/40 text-white"
                          : "bg-[#202022] border-[#2e2e32] text-[#888888] hover:border-[#3a3a3e]"
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded flex items-center justify-center border transition-colors shrink-0",
                          isSelected
                            ? "bg-[#c084fc] border-[#c084fc] text-[#141416]"
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

          {/* Topic / Specific Input (Optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                {isIndo ? "Fokus Tema Utama (Opsional)" : "Main Theme / Focus (Optional)"}
              </label>
              <span className="text-[10px] text-[#666666]">
                {isIndo ? "Kosongkan untuk cakupan umum" : "Leave blank for general"}
              </span>
            </div>
            <textarea
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                isIndo
                  ? "cth. Arsitektur Jaringan Saraf Tiruan, Alur Logika Bab 2, dll."
                  : "e.g. Neural Network Architecture, Chapter 2 Logic Flow, etc."
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#222225] border border-[#333336] focus:border-[#c084fc]/70 focus:outline-none text-xs text-white placeholder-[#666666] transition-colors resize-none leading-relaxed"
            />

            {/* Rekomendasi Topik */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topicChips.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-2.5 py-1 rounded-lg bg-[#222225] hover:bg-[#2c2c31] border border-[#333336] hover:border-purple-500/40 text-[11px] text-[#888888] hover:text-purple-200 transition-all cursor-pointer truncate max-w-full"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button: "Buat Peta Pikiran" */}
          <div className="pt-2 pb-1">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#c084fc] hover:bg-[#b06cf7] text-[#141416] font-semibold text-xs transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <GitFork className="h-4 w-4" />
              <span>{isIndo ? "Buat Peta Pikiran" : "Generate Mind Map"}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
