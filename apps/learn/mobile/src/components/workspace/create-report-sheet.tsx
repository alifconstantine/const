import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Check,
  ChevronDown,
  FileText,
  Pencil,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreateReportSheetProps {
  open: boolean;
  onClose: () => void;
  sources: LocalSource[];
  onGenerate: (options: {
    selectedSourceIds: string[];
    format: "interactive" | "document";
    templateId: string;
    templateTitle: string;
    templateDescription?: string;
    depth: "short" | "medium" | "long" | "auto";
    language: "id" | "en";
    customInstructions?: string;
  }) => void;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  defaultPrompt?: string;
}

export function CreateReportSheet({
  open,
  onClose,
  sources = [],
  onGenerate,
}: CreateReportSheetProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [format, setFormat] = useState<"interactive" | "document">("interactive");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("learning_summary");
  const [depth, setDepth] = useState<"short" | "medium" | "long" | "auto">("medium");
  const [targetLang, setTargetLang] = useState<"id" | "en">(isIndo ? "id" : "en");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [open, sources]);

  useEffect(() => {
    if (format === "interactive") {
      setSelectedTemplateId("learning_summary");
    } else {
      setSelectedTemplateId("briefing_doc");
    }
    setIsEditingPrompt(false);
  }, [format]);

  // Suggested templates based on primary source
  const suggestedTemplates = useMemo<ReportTemplate[]>(() => {
    const primaryTitle = sources[0]?.title || "";
    if (isIndo) {
      return [
        {
          id: "strategy_doc",
          name: "Dokumen Strategi",
          description: primaryTitle
            ? `Panduan strategis untuk ${primaryTitle.slice(0, 32)}...`
            : "Panduan strategis untuk menentukan arah dan prioritas implementasi.",
          defaultPrompt: "Fokuskan pada analisis SWOT, prioritas strategis, dan roadmap.",
        },
        {
          id: "analysis_report",
          name: "Laporan Analisis",
          description: "Tinjauan komprehensif mengenai perbandingan dan data teknis.",
          defaultPrompt: "Sajikan perbandingan mendalam, metrik evaluasi teknis, dan trade-off.",
        },
        {
          id: "concept_guide",
          name: "Panduan Konsep",
          description: "Penjelasan terstruktur mengenai istilah dan metodologi teknis.",
          defaultPrompt: "Jelaskan konsep rumit dengan analogi sederhana dan definisi istilah.",
        },
        {
          id: "comparison_essay",
          name: "Esai Perbandingan",
          description: "Ulasan informatif yang membandingkan kelebihan dan kekurangan opsi.",
          defaultPrompt: "Bandingkan pendekatan atau solusi alternatif dengan parameter jelas.",
        },
      ];
    }

    return [
      {
        id: "strategy_doc",
        name: "Strategy Document",
        description: primaryTitle
          ? `Strategic roadmap for ${primaryTitle.slice(0, 32)}...`
          : "Strategic roadmap for priority setting and operational implementation.",
        defaultPrompt: "Focus on strategic pillars, trade-offs, and implementation roadmap.",
      },
      {
        id: "analysis_report",
        name: "Analysis Report",
        description: "Comprehensive review of comparative data, findings, and technical nuances.",
        defaultPrompt: "Present in-depth evaluation benchmarks, architectural metrics, and tradeoffs.",
      },
      {
        id: "concept_guide",
        name: "Concept Guide",
        description: "Clear explanations of core terminology, architectural pillars, and principles.",
        defaultPrompt: "Demystify complex technical concepts using clean analogies and definitions.",
      },
      {
        id: "comparison_essay",
        name: "Comparative Essay",
        description: "Evaluative essay comparing key strengths, weaknesses, and criteria.",
        defaultPrompt: "Compare competing paradigms or solutions with structured dimensions.",
      },
    ];
  }, [sources, isIndo]);

  const interactiveTemplates: ReportTemplate[] = useMemo(
    () => [
      {
        id: "learning_summary",
        name: isIndo ? "Ringkasan Pembelajaran" : "Learning Summary",
        description: isIndo
          ? "Merangkum konsep utama bersama konten studio untuk membantu Anda belajar."
          : "Synthesizes core concepts alongside embedded studio widgets for focused learning.",
        defaultPrompt: isIndo
          ? "Fokuskan pada intisari pembelajaran dengan sematan kuis uji pemahaman konsep."
          : "Focus on key takeaways with embedded knowledge check widgets.",
      },
      {
        id: "interactive_concept",
        name: isIndo ? "Panduan Belajar Interaktif" : "Interactive Study Guide",
        description: isIndo
          ? "Panduan belajar bertahap dengan glosarium, kuis cepat, dan visualisasi data."
          : "Step-by-step study guide with glossaries, quick quizzes, and data visualizations.",
        defaultPrompt: isIndo
          ? "Sajikan panduan bertahap dengan glosarium istilah dan kartu hafalan."
          : "Provide a phased study guide with terminology glossary and recall flashcards.",
      },
      {
        id: "custom_interactive",
        name: isIndo ? "Buat Laporan Sendiri" : "Custom Report",
        description: isIndo
          ? "Buat laporan sesuai keinginan Anda dengan menentukan struktur dan gaya khusus."
          : "Create a tailored report defining your preferred structure and style.",
        defaultPrompt: "",
      },
    ],
    [isIndo]
  );

  const documentTemplates: ReportTemplate[] = useMemo(
    () => [
      {
        id: "custom_document",
        name: isIndo ? "Buat Laporan Sendiri" : "Custom Report",
        description: isIndo
          ? "Buat laporan sesuai keinginan Anda dengan menentukan struktur, gaya, dan fokus."
          : "Craft a customized document defining outline, tone, and focal points.",
        defaultPrompt: "",
      },
      {
        id: "briefing_doc",
        name: isIndo ? "Dokumen Petunjuk Arahan" : "Briefing Document",
        description: isIndo
          ? "Ringkasan eksekutif sumber Anda yang menyertakan kutipan dan insight penting."
          : "Executive briefing synthesizing high-level insights, key takeaways, and references.",
        defaultPrompt: isIndo
          ? "Tulis ringkasan eksekutif berstandar profesional untuk pengambil keputusan."
          : "Draft an executive briefing highlighting key decisions and evidence.",
      },
      {
        id: "study_guide",
        name: isIndo ? "Panduan Belajar" : "Study Guide",
        description: isIndo
          ? "Kuis jawaban singkat, saran pertanyaan esai, dan glosarium istilah penting."
          : "Short-answer questions, essay prompts, and essential glossary.",
        defaultPrompt: isIndo
          ? "Sertakan glosarium, latihan soal mandiri, dan ringkasan konsep utama."
          : "Include concept glossaries, practice questions, and chapter summaries.",
      },
      {
        id: "blog_post",
        name: isIndo ? "Postingan Blog" : "Blog Post",
        description: isIndo
          ? "Poin-poin penting yang disajikan dalam artikel naratif yang sangat mudah dibaca."
          : "Engaging narrative article translating technical findings for broader audiences.",
        defaultPrompt: isIndo
          ? "Gunakan gaya bahasa naratif yang menarik, mengalir, dan mudah dipahami publik."
          : "Use an engaging narrative voice accessible to broad audiences.",
      },
    ],
    [isIndo]
  );

  const activeTemplateList = format === "interactive" ? interactiveTemplates : documentTemplates;

  const currentTemplate =
    activeTemplateList.find((t) => t.id === selectedTemplateId) ||
    suggestedTemplates.find((t) => t.id === selectedTemplateId) ||
    activeTemplateList[0];

  const handleSelectTemplate = (template: ReportTemplate) => {
    setSelectedTemplateId(template.id);
    if (template.defaultPrompt && !customInstructions) {
      setCustomInstructions(template.defaultPrompt);
    }
  };

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
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
    if (selectedSourceIds.length === 0) return;

    onGenerate({
      selectedSourceIds:
        selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
      format,
      templateId: currentTemplate?.id || "learning_summary",
      templateTitle: currentTemplate?.name || "Laporan Belajar",
      templateDescription: currentTemplate?.description,
      depth,
      language: targetLang,
      customInstructions: customInstructions.trim() || undefined,
    });

    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] bg-[#161616] text-[#d4d4d4] rounded-t-3xl border-t border-[#2b2b2b] shadow-2xl flex flex-col will-change-transform font-sans overflow-hidden">
        {/* Drag handle */}
        <div className="w-12 h-1 bg-[#333333] rounded-full mx-auto mt-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-stone-300" />
            <h2 className="text-base font-semibold text-white tracking-tight">
              {isIndo ? "Buat Laporan" : "Create Report"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-[#222222] hover:bg-[#2b2b2b] text-[#888888] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
          {/* Sumber Scope Selector */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-medium text-[#969696]">
              {isIndo ? "Sumber Rujukan Materi" : "Source Scope"}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                className="w-full h-10 px-3.5 rounded-xl bg-[#222222] border border-[#2b2b2b] flex items-center justify-between text-xs text-left"
              >
                <span className="text-white font-medium truncate">
                  {selectedSourceIds.length === sources.length
                    ? isIndo
                      ? `Semua sumber (${sources.length})`
                      : `All sources (${sources.length})`
                    : isIndo
                    ? `${selectedSourceIds.length} dari ${sources.length} terpilih`
                    : `${selectedSourceIds.length} of ${sources.length} selected`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#888888]" />
              </button>

              {isSourceDropdownOpen && (
                <div className="mt-1.5 bg-[#222222] border border-[#2b2b2b] rounded-xl p-2 space-y-1 max-h-40 overflow-y-auto shadow-xl">
                  <button
                    type="button"
                    onClick={handleSelectAllSources}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc]"
                  >
                    <span>{isIndo ? "Pilih Semua" : "Select All"}</span>
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center",
                        selectedSourceIds.length === sources.length
                          ? "bg-white border-white text-black"
                          : "border-[#444449]"
                      )}
                    >
                      {selectedSourceIds.length === sources.length && (
                        <Check className="h-3 w-3 stroke-[3]" />
                      )}
                    </div>
                  </button>

                  {sources.map((src) => {
                    const isSelected = selectedSourceIds.includes(src.id);
                    return (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => handleToggleSource(src.id)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-left"
                      >
                        <span className="truncate pr-2 text-white">{src.title || "Sumber"}</span>
                        <div
                          className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                            isSelected
                              ? "bg-white border-white text-black"
                              : "border-[#444449]"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Format Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#969696]">
              {isIndo ? "Format" : "Format"}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat("interactive")}
                className={cn(
                  "p-3 rounded-2xl border text-left flex flex-col justify-between transition-all",
                  format === "interactive"
                    ? "bg-[#1e2330] border-[#3b5998] text-white"
                    : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888888]"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">
                    {isIndo ? "Interaktif" : "Interactive"}
                  </span>
                  {format === "interactive" && (
                    <div className="h-3.5 w-3.5 rounded-full bg-[#4c75f2] flex items-center justify-center">
                      <Check className="h-2 w-2 text-white stroke-[3]" />
                    </div>
                  )}
                </div>
                <span className="text-[10.5px] text-[#a0a6b5] leading-tight line-clamp-2">
                  {isIndo ? "Sematan konten studio interaktif" : "With embedded studio widgets"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("document")}
                className={cn(
                  "p-3 rounded-2xl border text-left flex flex-col justify-between transition-all",
                  format === "document"
                    ? "bg-[#1e2330] border-[#3b5998] text-white"
                    : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888888]"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">
                    {isIndo ? "Dokumen" : "Document"}
                  </span>
                  {format === "document" && (
                    <div className="h-3.5 w-3.5 rounded-full bg-[#4c75f2] flex items-center justify-center">
                      <Check className="h-2 w-2 text-white stroke-[3]" />
                    </div>
                  )}
                </div>
                <span className="text-[10.5px] text-[#a0a6b5] leading-tight line-clamp-2">
                  {isIndo ? "Dokumen terstruktur teks murni" : "Pure structured text document"}
                </span>
              </button>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#969696]">
              {isIndo ? "Template" : "Template"}
            </label>
            <div className="space-y-2">
              {activeTemplateList.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={cn(
                      "p-3 rounded-2xl border text-left flex items-start justify-between gap-2.5 transition-all cursor-pointer",
                      isSelected
                        ? "bg-[#252525] border-white/40 shadow-sm"
                        : "bg-[#1f1f1f] border-[#2b2b2b]"
                    )}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">{tpl.name}</div>
                      <div className="text-[11px] text-[#888888] leading-tight line-clamp-2">
                        {tpl.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTemplate(tpl);
                        setIsEditingPrompt(!isEditingPrompt);
                      }}
                      className="h-6 w-6 rounded-full bg-[#2a2a2a] text-[#888888] hover:text-white flex items-center justify-center shrink-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Suggested Templates (Only in Document Format) */}
          {format === "document" && suggestedTemplates.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#969696]">
                <FileText className="h-3.5 w-3.5 text-amber-400" />
                <span>{isIndo ? "Template yang Disarankan" : "Recommended Templates"}</span>
              </div>
              <div className="space-y-2">
                {suggestedTemplates.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={cn(
                        "p-3 rounded-2xl border text-left flex items-start justify-between gap-2.5 transition-all cursor-pointer",
                        isSelected
                          ? "bg-[#252525] border-white/40 shadow-sm"
                          : "bg-[#1f1f1f] border-[#2b2b2b]"
                      )}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate">{tpl.name}</div>
                        <div className="text-[11px] text-[#888888] leading-tight line-clamp-2">
                          {tpl.description}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTemplate(tpl);
                          setIsEditingPrompt(true);
                          setTimeout(() => {
                            textareaRef.current?.focus();
                            textareaRef.current?.scrollIntoView({ behavior: "smooth" });
                          }, 50);
                        }}
                        className="h-6 w-6 rounded-full bg-[#2a2a2a] text-[#888888] hover:text-white flex items-center justify-center shrink-0"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Depth & Language */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#969696]">
                {isIndo ? "Kedalaman" : "Depth"}
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: "short", label: isIndo ? "Ringkas" : "Short" },
                  { id: "medium", label: isIndo ? "Sedang" : "Med" },
                  { id: "long", label: isIndo ? "Dalam" : "Deep" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDepth(m.id as any)}
                    className={cn(
                      "py-1.5 rounded-xl border text-[10.5px] font-medium transition-all text-center",
                      depth === m.id
                        ? "bg-[#252525] border-white/40 text-white font-semibold"
                        : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888]"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#969696]">
                {isIndo ? "Bahasa" : "Language"}
              </label>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { id: "id", label: "Indonesia" },
                  { id: "en", label: "English" },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setTargetLang(l.id as any)}
                    className={cn(
                      "py-1.5 rounded-xl border text-[10.5px] font-medium transition-all text-center",
                      targetLang === l.id
                        ? "bg-[#252525] border-white/40 text-white font-semibold"
                        : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888]"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="space-y-1 pt-1">
            <label className="text-[11px] font-medium text-[#969696]">
              {isIndo ? "Arahan Khusus (Opsional)" : "Custom Outline (Optional)"}
            </label>
            <textarea
              ref={textareaRef}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={
                isIndo
                  ? "Contoh: Fokus pada analisis perbandingan dan rumus matematika..."
                  : "E.g., Emphasize comparison metrics and KaTeX formulas..."
              }
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] text-xs text-white placeholder-[#666666] outline-none resize-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className={cn(
                "w-full py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99]",
                selectedSourceIds.length > 0
                  ? "bg-white hover:bg-neutral-200 text-black font-semibold"
                  : "bg-[#252525] text-[#666] cursor-not-allowed"
              )}
            >
              <FileText className="h-4 w-4" />
              <span>{isIndo ? "Buat sekarang" : "Create now"}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
