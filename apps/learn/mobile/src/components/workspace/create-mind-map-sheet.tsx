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
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[60] max-h-[92vh] flex flex-col rounded-t-3xl bg-[#161616] text-[#e0e0e0] border-t border-[#262626] shadow-2xl animate-in slide-in-from-bottom duration-300 select-none pb-safe"
        role="dialog"
        aria-modal="true"
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3 border-b border-[#242424] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <GitFork className="h-4 w-4 text-white shrink-0" />
            <h2 className="text-sm font-semibold text-white tracking-tight">
              {isIndo ? "Buat Peta Pikiran" : "Create Mind Map"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg hover:bg-[#222222] text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs">
          {/* Concept Explanation Card */}
          <div className="p-3.5 rounded-xl bg-[#222222] border border-[#2b2b2b] flex items-start gap-2.5 text-[#d4d4d4] leading-relaxed">
            <GitFork className="h-4 w-4 text-white shrink-0 mt-0.5" />
            <div className="text-[11.5px]">
              {isIndo
                ? "AI akan menganalisis materi sumber untuk menyusun diagram hierarkis interaktif yang menghubungkan konsep pokok, percabangan gagasan, dan detail rujukan secara visual."
                : "AI will analyze your source material to generate an interactive hierarchical diagram connecting core concepts, topic branches, and contextual references."}
            </div>
          </div>

          {/* Sources Scope Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999]">
                {isIndo ? "Sumber Rujukan Materi" : "Source Scope"}
              </label>
              {sources.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllSources}
                  className="text-[11px] font-medium text-white/80 hover:text-white transition-colors cursor-pointer"
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
              <div className="p-3 rounded-xl bg-[#222222] border border-[#2b2b2b] text-center text-[#888888] text-xs">
                {isIndo
                  ? "Belum ada sumber dalam notebook. AI akan membuat dari topik Anda."
                  : "No sources in notebook. AI will generate based on your topic."}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-xl bg-[#222222] p-1.5 border border-[#2b2b2b]">
                {sources.map((src) => {
                  const isSelected = selectedSourceIds.includes(src.id);
                  return (
                    <div
                      key={src.id}
                      onClick={() => handleToggleSource(src.id)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                        isSelected
                          ? "bg-[#2c2c2c] text-white font-medium"
                          : "text-[#888888] hover:text-[#cccccc]"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                        <span className="text-xs truncate font-medium">
                          {src.title}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "h-4 w-4 rounded flex items-center justify-center border transition-colors shrink-0",
                          isSelected
                            ? "bg-white border-white text-black"
                            : "border-[#444449] bg-transparent"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Topic / Specific Input (Optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999]">
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
              className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] focus:border-[#444444] focus:outline-none text-xs text-white placeholder-[#666666] transition-colors resize-none font-sans"
            />

            {/* Rekomendasi Topik */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topicChips.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] border border-[#2e2e2e] text-[11px] text-[#a0a0a0] hover:text-white transition-all cursor-pointer truncate max-w-full active:scale-98"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button: "Create Mind Map" */}
          <div className="pt-2 pb-2">
            <button
              type="submit"
              disabled={sources.length === 0}
              className="w-full py-3 rounded-2xl bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-black font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98 cursor-pointer"
            >
              <GitFork className="h-4 w-4" />
              <span>{isIndo ? "Buat Mind Map" : "Create Mind Map"}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
