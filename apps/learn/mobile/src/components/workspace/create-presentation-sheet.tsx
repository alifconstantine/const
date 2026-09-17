import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Sparkles,
  Presentation,
  Check,
  FileText,
  Sliders,
  Languages,
  Palette,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";
import { PRESENTATION_THEMES } from "../../lib/studio/presentation/themes";

export interface CreatePresentationSheetProps {
  open: boolean;
  onClose: () => void;
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

export function CreatePresentationSheet({
  open,
  onClose,
  sources = [],
  onGenerate,
}: CreatePresentationSheetProps) {
  const { language: currentAppLang } = useI18n();
  const isIndo = currentAppLang === "id";

  const [topic, setTopic] = useState("");
  const [lengthMode, setLengthMode] = useState<"short" | "medium" | "long" | "auto">("auto");
  const [selectedLanguage, setSelectedLanguage] = useState<"id" | "en">(isIndo ? "id" : "en");
  const [selectedTheme, setSelectedTheme] = useState<string>("auto");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );

  useEffect(() => {
    if (open) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [open, sources]);

  const topicChips = useMemo(() => {
    const primarySourceTitle = sources[0]?.title || "";
    if (primarySourceTitle) {
      return [
        isIndo ? `+ Ringkasan: ${primarySourceTitle.slice(0, 20)}` : `+ Summary: ${primarySourceTitle.slice(0, 20)}`,
        isIndo ? "+ Materi Kuliah" : "+ Lecture Notes",
        isIndo ? "+ Presentasi Eksekutif" : "+ Executive Deck",
        isIndo ? "+ Pitch Deck" : "+ Pitch Deck",
      ];
    }
    return [
      isIndo ? "+ Presentasi Lengkap" : "+ Complete Deck",
      isIndo ? "+ Ringkasan Inti" : "+ Core Highlights",
      isIndo ? "+ Panduan & Alur Kerja" : "+ Practical Guide",
      isIndo ? "+ Analisis Strategis" : "+ Strategic Analysis",
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
      type: "slides",
      topic: topic.trim(),
      lengthMode,
      language: selectedLanguage,
      themeId: selectedTheme,
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
        {/* Handle Bar */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 bg-[#444448] rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#28282c] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-[#2b271d] border border-[#4d472c]/50 flex items-center justify-center text-[#fde047]">
              <Presentation className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {isIndo ? "Buat Slide Presentasi" : "Generate Presentation"}
              </h2>
              <p className="text-[11px] text-[#8e8e93]">
                {isIndo ? "Susun deck slide PPT dari materi rujukan" : "Create 16:9 slides from sources"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#262629] text-[#999999] hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Info Banner */}
          <div className="p-3 rounded-2xl bg-[#2a271d]/80 border border-[#4d472c]/40 flex items-start gap-2.5 text-xs text-[#fef08a] leading-relaxed">
            <Presentation className="h-4 w-4 text-[#fde047] shrink-0 mt-0.5" />
            <span>
              {isIndo
                ? "AI akan merangkum materi rujukan ke dalam slide berformat 16:9 siap tayang dengan tata letak visual modern dan opsi unduh PPTX."
                : "AI will distill your sources into a modern 16:9 slide presentation ready to present and export to PPTX."}
            </span>
          </div>

          {/* Sources Scope Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#cccccc]">
                {isIndo ? "Sumber Rujukan" : "Source Scope"}
              </label>
              <button
                type="button"
                onClick={handleToggleAllSources}
                className="text-[11px] text-[#fde047] font-medium active:opacity-75 cursor-pointer"
              >
                {selectedSourceIds.length === sources.length
                  ? isIndo ? "Batal Semua" : "Deselect All"
                  : isIndo ? "Pilih Semua" : "Select All"}
              </button>
            </div>

            {sources.length === 0 ? (
              <p className="text-xs text-[#777777] italic">
                {isIndo ? "Belum ada sumber yang diunggah" : "No sources available"}
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {sources.map((src) => {
                  const isSelected = selectedSourceIds.includes(src.id);
                  return (
                    <div
                      key={src.id}
                      onClick={() => handleToggleSource(src.id)}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer",
                        isSelected
                          ? "bg-[#252529] border-[#fde047]/40 text-white"
                          : "bg-[#1f1f22] border-[#2c2c30] text-[#999999]"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <FileText className="h-4 w-4 shrink-0 text-[#888888]" />
                        <span className="text-xs font-medium truncate">{src.title}</span>
                      </div>
                      <div
                        className={cn(
                          "w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-colors",
                          isSelected
                            ? "bg-[#fde047] border-[#fde047] text-black"
                            : "border-[#48484e] bg-transparent"
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

          {/* Slide Length Mode */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#cccccc] flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-[#888888]" />
              {isIndo ? "Panjang Presentasi" : "Slide Count"}
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#141416] border border-[#2b2b2f] rounded-2xl">
              {[
                { id: "auto", label: "Auto", desc: "Sesuai isi" },
                { id: "short", label: isIndo ? "Pendek" : "Short", desc: "3-5 slide" },
                { id: "medium", label: isIndo ? "Sedang" : "Med", desc: "6-9 slide" },
                { id: "long", label: isIndo ? "Panjang" : "Long", desc: "10-14 slide" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLengthMode(item.id as any)}
                  className={cn(
                    "py-2 px-1 rounded-xl text-xs font-medium text-center transition-all cursor-pointer",
                    lengthMode === item.id
                      ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                      : "text-[#888888] hover:text-[#cccccc]"
                  )}
                >
                  <div>{item.label}</div>
                  <div className="text-[9px] text-[#666666] leading-none mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Language Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#cccccc] flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5 text-[#888888]" />
              {isIndo ? "Bahasa Presentasi" : "Language"}
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#141416] border border-[#2b2b2f] rounded-2xl">
              <button
                type="button"
                onClick={() => setSelectedLanguage("id")}
                className={cn(
                  "py-2 px-3 rounded-xl text-xs font-medium text-center transition-all cursor-pointer",
                  selectedLanguage === "id"
                    ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                    : "text-[#888888] hover:text-[#cccccc]"
                )}
              >
                Bahasa Indonesia
              </button>
              <button
                type="button"
                onClick={() => setSelectedLanguage("en")}
                className={cn(
                  "py-2 px-3 rounded-xl text-xs font-medium text-center transition-all cursor-pointer",
                  selectedLanguage === "en"
                    ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                    : "text-[#888888] hover:text-[#cccccc]"
                )}
              >
                English
              </button>
            </div>
          </div>

          {/* Visual Aesthetic Theme Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#cccccc] flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-[#fde047]" />
                {isIndo ? "Gaya & Estetika Visual" : "Theme & Aesthetic"}
              </label>
              <span className="text-[10.5px] text-[#888888]">
                {selectedTheme === "auto"
                  ? isIndo
                    ? "AI pilih otomatis"
                    : "AI picks best match"
                  : isIndo
                  ? PRESENTATION_THEMES.find((t) => t.id === selectedTheme)?.nameId
                  : PRESENTATION_THEMES.find((t) => t.id === selectedTheme)?.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#141416] border border-[#2b2b2f] rounded-2xl">
              <button
                type="button"
                onClick={() => setSelectedTheme("auto")}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer",
                  selectedTheme === "auto"
                    ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                    : "text-[#888888] hover:text-[#cccccc]"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Sparkles className="h-3.5 w-3.5 text-[#fde047] shrink-0" />
                  <span className="truncate">Auto (AI)</span>
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
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer",
                      isSelected
                        ? "bg-[#28282e] text-white border border-[#38383e] shadow-xs"
                        : "text-[#888888] hover:text-[#cccccc]"
                    )}
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

          {/* Topic Focus & Prompt */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#cccccc]">
              {isIndo ? "Fokus Topik / Catatan Khusus" : "Topic Focus (Optional)"}
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                isIndo
                  ? "Contoh: Fokuskan pada implementasi praktis dan perbandingan strategi..."
                  : "e.g. Highlight practical implementation and comparison..."
              }
              rows={3}
              className="w-full px-3 py-2.5 rounded-2xl bg-[#141416] border border-[#2e2e32] focus:border-[#fde047] text-xs text-white placeholder-[#555558] outline-none transition-all resize-none"
            />

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topicChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className="px-2.5 py-1 rounded-full bg-[#202024] hover:bg-[#28282e] border border-[#2e2e34] text-[11px] text-[#cccccc] active:scale-95 transition-all cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#28282c] bg-[#171719] flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-[#242428] text-xs font-medium text-[#aaaaaa] hover:text-white transition-colors cursor-pointer active:scale-98"
          >
            {isIndo ? "Batal" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-2xl bg-[#fde047] hover:bg-[#facc15] text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isIndo ? "Buat Slide" : "Generate"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
