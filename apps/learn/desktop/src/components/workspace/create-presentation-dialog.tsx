import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Presentation,
  Check,
  ChevronDown,
  FileText,
  Sparkles,
  Sliders,
  Languages,
  Palette,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";
import { PRESENTATION_THEMES } from "../../lib/studio/presentation/themes";

export interface CreatePresentationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: LocalSource[];
  onGenerate: (options: {
    type: "slides";
    topic: string;
    lengthMode: "short" | "medium" | "long" | "auto";
    language: "id" | "en";
    selectedSourceIds: string[];
    themeId?: string;
  }) => void;
}

export function CreatePresentationDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
}: CreatePresentationDialogProps) {
  const { language: currentAppLang } = useI18n();
  const isIndo = currentAppLang === "id";

  const [topic, setTopic] = useState("");
  const [lengthMode, setLengthMode] = useState<"short" | "medium" | "long" | "auto">("auto");
  const [selectedLanguage, setSelectedLanguage] = useState<"id" | "en">(isIndo ? "id" : "en");
  const [selectedTheme, setSelectedTheme] = useState<string>("auto");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

  // Sync default selected sources to all available sources
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources]);

  // Topic suggestion chips
  const topicChips = useMemo(() => {
    const primarySourceTitle = sources[0]?.title || "";
    if (primarySourceTitle) {
      return [
        isIndo ? `+ Ringkasan: ${primarySourceTitle.slice(0, 22)}` : `+ Summary: ${primarySourceTitle.slice(0, 22)}`,
        isIndo ? "+ Materi Kuliah & Kajian" : "+ Lecture & Course Notes",
        isIndo ? "+ Presentasi Eksekutif" : "+ Executive Deck",
        isIndo ? "+ Pitch Deck & Strategi" : "+ Pitch Deck & Strategy",
      ];
    }
    return [
      isIndo ? "+ Presentasi Komprehensif" : "+ Comprehensive Deck",
      isIndo ? "+ Ringkasan Inti Materi" : "+ Core Concept Highlights",
      isIndo ? "+ Panduan & Langkah Kerja" : "+ Practical Guide & Framework",
      isIndo ? "+ Analisis & Prospek Masa Depan" : "+ Strategic Analysis & Outlook",
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
      type: "slides",
      topic: topic.trim(),
      lengthMode,
      language: selectedLanguage,
      themeId: selectedTheme,
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
              <Presentation className="h-4 w-4 text-[#fde047]" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">
              {isIndo ? "Buat Slide Presentasi" : "Generate Presentation Deck"}
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
          {/* Information banner */}
          <div className="p-3.5 rounded-xl bg-[#2a271d] border border-[#4d472c]/50 flex items-start gap-3">
            <Presentation className="h-4 w-4 text-[#fde047] shrink-0 mt-0.5" />
            <div className="text-xs text-[#fef08a] leading-relaxed">
              {isIndo
                ? "AI akan menyusun deck presentasi berformat 16:9 berdasarkan materi sumber. Dilengkapi struktur narasi terpadu, poin-poin terukur, serta opsi unduh ke PPTX dan pratinjau interaktif."
                : "AI will generate a 16:9 widescreen presentation deck directly from your source material, with clear narrative arcs, bullet points, and instant PPTX export."}
            </div>
          </div>

          {/* Source Scope Selector */}
          <div className="space-y-1.5 relative">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo ? "Sumber Rujukan Materi" : "Source Scope"}
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
                <ChevronDown className="h-4 w-4 text-[#888888] shrink-0 ml-2" />
              </button>

              {/* Source Dropdown Menu */}
              {isSourceDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#18181b] border border-[#28282d] rounded-xl shadow-2xl z-30 p-2 overflow-hidden">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#28282d] px-1">
                    <span className="text-[11px] font-medium text-[#888888]">
                      {isIndo ? "Pilih sumber yang disertakan" : "Select included sources"}
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllSources}
                      className="text-[11px] text-[#fde047] hover:underline cursor-pointer"
                    >
                      {selectedSourceIds.length === sources.length
                        ? isIndo
                          ? "Batal pilih semua"
                          : "Deselect all"
                        : isIndo
                        ? "Pilih semua"
                        : "Select all"}
                    </button>
                  </div>

                  <ScrollArea className="max-h-48">
                    <div className="space-y-1 pr-1">
                      {sources.map((src) => {
                        const isSelected = selectedSourceIds.includes(src.id);
                        return (
                          <div
                            key={src.id}
                            onClick={() => handleToggleSource(src.id)}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs transition-colors"
                          >
                            <div
                              className={`h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                isSelected
                                  ? "bg-[#fde047] border-[#fde047] text-black"
                                  : "border-[#44444a] bg-[#1a1a1e]"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <FileText className="h-3.5 w-3.5 text-[#888888] shrink-0" />
                            <span className="text-white truncate flex-1">{src.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {/* Configuration Grid: Length & Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Slide Length Mode */}
            <div className="space-y-1.5">
              <label className="text-[11.5px] font-medium text-[#999999] flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-[#888888]" />
                {isIndo ? "Panjang Presentasi" : "Slide Count"}
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-[#141416] border border-[#28282d] rounded-xl">
                {[
                  { id: "auto", label: "Auto", desc: isIndo ? "Sesuai materi" : "Adaptive" },
                  { id: "short", label: isIndo ? "Pendek" : "Short", desc: "3-5" },
                  { id: "medium", label: isIndo ? "Sedang" : "Med", desc: "6-9" },
                  { id: "long", label: isIndo ? "Panjang" : "Long", desc: "10-14" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLengthMode(item.id as any)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
                      lengthMode === item.id
                        ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                        : "text-[#888888] hover:text-[#d4d4d4]"
                    }`}
                    title={item.desc}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selector */}
            <div className="space-y-1.5">
              <label className="text-[11.5px] font-medium text-[#999999] flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5 text-[#888888]" />
                {isIndo ? "Bahasa Presentasi" : "Language"}
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#141416] border border-[#28282d] rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage("id")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
                    selectedLanguage === "id"
                      ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                      : "text-[#888888] hover:text-[#d4d4d4]"
                  }`}
                >
                  Bahasa Indonesia
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage("en")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
                    selectedLanguage === "en"
                      ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                      : "text-[#888888] hover:text-[#d4d4d4]"
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          {/* Visual Aesthetic Theme Selector */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-[#fde047]" />
                {isIndo ? "Gaya & Estetika Visual Slide" : "Visual Theme & Aesthetic"}
              </span>
              <span className="text-[10.5px] text-[#777777]">
                {selectedTheme === "auto"
                  ? isIndo
                    ? "AI otomatis memilih tema terbaik"
                    : "AI picks best matched palette"
                  : isIndo
                  ? PRESENTATION_THEMES.find((t) => t.id === selectedTheme)?.nameId
                  : PRESENTATION_THEMES.find((t) => t.id === selectedTheme)?.name}
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-[#141416] border border-[#28282d] rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedTheme("auto")}
                className={`py-2 px-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                  selectedTheme === "auto"
                    ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                    : "text-[#888888] hover:text-[#d4d4d4]"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Sparkles className="h-3.5 w-3.5 text-[#fde047] shrink-0" />
                  <span className="truncate">{isIndo ? "Auto (AI)" : "Auto (AI)"}</span>
                </div>
                {selectedTheme === "auto" && <Check className="h-3.5 w-3.5 text-[#fde047] shrink-0 ml-1" />}
              </button>

              {PRESENTATION_THEMES.map((theme) => {
                const isSelected = selectedTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                        : "text-[#888888] hover:text-[#d4d4d4]"
                    }`}
                    title={isIndo ? theme.descriptionId : theme.description}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: theme.colors.accent }}
                      />
                      <span className="truncate">{isIndo ? theme.nameId : theme.name}</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#fde047] shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic / Prompt Textarea */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#999999]">
              {isIndo
                ? "Fokus Topik / Instruksi Tambahan (Opsional)"
                : "Topic Focus / Additional Instructions (Optional)"}
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                isIndo
                  ? "Contoh: Sorot arsitektur sistem, tantangan implementasi, serta proyeksi kuartal depan..."
                  : "e.g. Focus on system architecture, key tradeoffs, and deployment steps..."
              }
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-[#141416] border border-[#28282d] focus:border-[#fde047] focus:ring-1 focus:ring-[#fde047] text-xs text-white placeholder-[#55555a] outline-none transition-all resize-none"
            />

            {/* Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topicChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-2.5 py-1 rounded-full bg-[#1e1e24] hover:bg-[#282830] border border-[#2e2e38] text-[11px] text-[#cccccc] hover:text-white transition-all cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#28282d]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 text-xs text-[#999999] hover:text-white transition-colors cursor-pointer"
            >
              {isIndo ? "Batal" : "Cancel"}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#fde047] hover:bg-[#facc15] text-black font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 active:scale-98"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isIndo ? "Buat Presentasi" : "Generate Slides"}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
