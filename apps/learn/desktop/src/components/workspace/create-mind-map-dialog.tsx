import React, { useState, useEffect } from "react";
import {
  X,
  GitFork,
  Check,
  ChevronDown,
  FileText,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreateMindMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: LocalSource[];
  onGenerate: (options: {
    type: "mind_map";
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    count: number;
    selectedSourceIds: string[];
  }) => void;
}

export function CreateMindMapDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
}: CreateMindMapDialogProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [topic, setTopic] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

  // Sync default selected sources to all available sources
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources]);

  // Smart suggestions based on source titles
  const topicChips = React.useMemo(() => {
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
      type: "mind_map",
      topic: topic.trim(),
      difficulty: "medium",
      count: 10,
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
              <GitFork className="h-4 w-4 text-[#c084fc]" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">
              {isIndo ? "Peta Pikiran Interaktif (Mind Map)" : "Interactive Mind Map"}
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
          {/* Mind Map Concept Explanation Box */}
          <div className="p-3.5 rounded-xl bg-[#231a28] border border-[#4a2e56]/40 flex items-start gap-3">
            <GitFork className="h-4 w-4 text-[#c084fc] shrink-0 mt-0.5" />
            <div className="text-xs text-[#e9d5ff] leading-relaxed">
              {isIndo
                ? "AI akan menganalisis materi sumber untuk menyusun diagram hierarkis interaktif yang menghubungkan konsep pokok, percabangan gagasan, dan detail rujukan secara visual."
                : "AI will analyze your source material to generate an interactive hierarchical diagram connecting core concepts, topic branches, and contextual references."}
            </div>
          </div>

          {/* Sumber Dropdown */}
          <div className="space-y-1.5 relative">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo ? "Sumber Rujukan Materi" : "Source Material Scope"}
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
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/5 flex items-center justify-between font-medium text-[#c084fc] cursor-pointer"
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
                          <Check className="h-3.5 w-3.5 text-[#c084fc] shrink-0" />
                        )}
                      </button>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {/* Apa fokus topiknya? (Textarea Input) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-[#999999]">
                {isIndo ? "Fokus Tema Utama (Opsional)" : "Main Theme / Focus (Optional)"}
              </label>
              <span className="text-[10.5px] text-[#777777]">
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141416] border border-[#28282d] focus:border-[#c084fc]/70 focus:outline-none text-xs text-white placeholder-[#555555] transition-colors resize-none leading-relaxed"
            />

            {/* Rekomendasi Topik */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topicChips.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-2.5 py-1 rounded-lg bg-[#202025] hover:bg-[#28282f] border border-[#2e2e34] hover:border-[#3e3e46] text-[11px] text-[#999999] hover:text-white transition-all cursor-pointer truncate max-w-full"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-2 flex justify-end gap-2 border-t border-[#25252a]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#999999] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              {isIndo ? "Batal" : "Cancel"}
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#c084fc] hover:bg-[#b06cf7] text-[#141416] font-semibold text-xs transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 fill-current" />
              <span>{isIndo ? "Buat Peta Pikiran" : "Generate Mind Map"}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
