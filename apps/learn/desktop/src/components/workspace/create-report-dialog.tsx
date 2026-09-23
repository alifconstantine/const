import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Check,
  ChevronDown,
  FileText,
  Sparkles,
  Pencil,
} from "lucide-react";
import { Dialog, DialogContent, ScrollArea, cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface CreateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  icon?: React.ElementType;
  defaultPrompt?: string;
}

export function CreateReportDialog({
  open,
  onOpenChange,
  sources,
  onGenerate,
}: CreateReportDialogProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  // State
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [format, setFormat] = useState<"interactive" | "document">("interactive");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("learning_summary");
  const [depth, setDepth] = useState<"short" | "medium" | "long" | "auto">("medium");
  const [targetLang, setTargetLang] = useState<"id" | "en">(isIndo ? "id" : "en");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initial selections
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources]);

  // Sync default template when format changes
  useEffect(() => {
    if (format === "interactive") {
      setSelectedTemplateId("learning_summary");
    } else {
      setSelectedTemplateId("briefing_doc");
    }
    setIsEditingPrompt(false);
  }, [format]);

  // Dynamic suggested templates based on primary source
  const suggestedTemplates = useMemo<ReportTemplate[]>(() => {
    const primaryTitle = sources[0]?.title || "";
    if (isIndo) {
      return [
        {
          id: "strategy_doc",
          name: "Dokumen Strategi",
          description: primaryTitle
            ? `Panduan strategis untuk implementasi ${primaryTitle.slice(0, 36)}...`
            : "Panduan strategis untuk menentukan arah dan prioritas implementasi.",
          defaultPrompt: "Fokuskan pada analisis SWOT, prioritas strategis, dan roadmap implementasi.",
        },
        {
          id: "analysis_report",
          name: "Laporan Analisis",
          description: "Tinjauan komprehensif mengenai perbandingan, data kunci, dan implikasi teknis.",
          defaultPrompt: "Sajikan perbandingan mendalam, metrik evaluasi teknis, dan trade-off.",
        },
        {
          id: "concept_guide",
          name: "Panduan Konsep",
          description: "Penjelasan terstruktur mengenai istilah teknis, arsitektur, dan prinsip kerja.",
          defaultPrompt: "Jelaskan konsep rumit dengan analogi sederhana dan definisi istilah kunci.",
        },
        {
          id: "comparison_essay",
          name: "Esai Perbandingan",
          description: "Ulasan informatif yang membandingkan kelebihan dan kekurangan tiap opsi.",
          defaultPrompt: "Bandingkan pendekatan atau solusi alternatif dengan parameter yang jelas.",
        },
      ];
    }

    return [
      {
        id: "strategy_doc",
        name: "Strategy Document",
        description: primaryTitle
          ? `Strategic execution guide for ${primaryTitle.slice(0, 36)}...`
          : "Strategic roadmap for priority setting and operational implementation.",
        defaultPrompt: "Focus on strategic pillars, trade-offs, and implementation roadmap.",
      },
      {
        id: "analysis_report",
        name: "Analysis Report",
        description: "Comprehensive review of comparative data, key findings, and technical nuances.",
        defaultPrompt: "Present in-depth evaluation benchmarks, architectural metrics, and tradeoffs.",
      },
      {
        id: "concept_guide",
        name: "Concept Guide",
        description: "Clear explanations of core terminology, architectural pillars, and principles.",
        defaultPrompt: "Demystify complex technical concepts using clean analogies and precise definitions.",
      },
      {
        id: "comparison_essay",
        name: "Comparative Essay",
        description: "Evaluative essay comparing key strengths, weaknesses, and decision criteria.",
        defaultPrompt: "Compare competing paradigms or solutions with structured dimensions.",
      },
    ];
  }, [sources, isIndo]);

  // Standard templates
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
        name: isIndo ? "Buat Laporan Anda Sendiri" : "Custom Interactive Report",
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
        name: isIndo ? "Buat Laporan Anda Sendiri" : "Custom Report",
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

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] p-0 bg-[#161616] border border-[#2b2b2b] text-[#d4d4d4] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden">
        {/* Header - Borderless austere studio style */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-stone-300" />
            <span className="text-base font-medium text-white tracking-tight">
              {isIndo ? "Buat Laporan" : "Create Report"}
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

        <form onSubmit={handleSubmit} className="flex flex-col max-h-[82vh]">
          <ScrollArea className="flex-1 w-full px-6 py-2">
            <div className="space-y-5 pb-4">
              {/* Sumber Rujukan Materi */}
              <div className="space-y-1.5 relative">
                <label className="text-[12px] font-medium text-[#969696]">
                  {isIndo ? "Sumber Rujukan Materi" : "Source Scope"}
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
                          : `All sources (${sources.length} sources)`
                        : isIndo
                        ? `${selectedSourceIds.length} dari ${sources.length} sumber terpilih`
                        : `${selectedSourceIds.length} of ${sources.length} sources selected`}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#888888] shrink-0" />
                  </button>

                  {isSourceDropdownOpen && (
                    <div className="absolute top-full mt-1.5 left-0 right-0 z-30 bg-[#222222] border border-[#2b2b2b] rounded-xl p-2 shadow-2xl">
                      <ScrollArea className="max-h-48 w-full" viewportClassName="space-y-1 pr-1">
                        <button
                          type="button"
                          onClick={handleSelectAllSources}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc] cursor-pointer transition-colors"
                        >
                          <span className="font-medium">
                            {isIndo ? "Pilih Semua Sumber" : "Select All Sources"}
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

                        {sources.map((src) => {
                          const isSelected = selectedSourceIds.includes(src.id);
                          return (
                            <button
                              key={src.id}
                              type="button"
                              onClick={() => handleToggleSource(src.id)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-left cursor-pointer transition-colors"
                            >
                              <span className="truncate pr-2 font-medium text-white">
                                {src.title || "Sumber"}
                              </span>
                              <div
                                className={cn(
                                  "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
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

              {/* Format Selection (Clean without 'Baru!') */}
              <div className="space-y-2">
                <label className="text-[12px] font-medium text-[#969696]">
                  {isIndo ? "Format" : "Format"}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Option 1: Interaktif */}
                  <button
                    type="button"
                    onClick={() => setFormat("interactive")}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative",
                      format === "interactive"
                        ? "bg-[#1e2330] border-[#3b5998] shadow-sm text-white"
                        : "bg-[#1f1f1f] border-[#2b2b2b] hover:border-[#383838] text-[#888888] hover:text-[#d4d4d4]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-sm font-semibold text-white">
                        {isIndo ? "Interaktif" : "Interactive"}
                      </div>
                      {format === "interactive" && (
                        <div className="h-4 w-4 rounded-full bg-[#4c75f2] flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-[#a0a6b5] leading-relaxed">
                      {isIndo
                        ? "Laporan interaktif dengan sematan konten studio"
                        : "Interactive report with embedded studio widgets and quizzes"}
                    </div>
                  </button>

                  {/* Option 2: Dokumen */}
                  <button
                    type="button"
                    onClick={() => setFormat("document")}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative",
                      format === "document"
                        ? "bg-[#1e2330] border-[#3b5998] shadow-sm text-white"
                        : "bg-[#1f1f1f] border-[#2b2b2b] hover:border-[#383838] text-[#888888] hover:text-[#d4d4d4]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-sm font-semibold text-white">
                        {isIndo ? "Dokumen" : "Document"}
                      </div>
                      {format === "document" && (
                        <div className="h-4 w-4 rounded-full bg-[#4c75f2] flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-[#a0a6b5] leading-relaxed">
                      {isIndo
                        ? "Dokumen terstruktur yang hanya berisi teks"
                        : "Structured narrative document focused purely on text & math"}
                    </div>
                  </button>
                </div>
              </div>

              {/* Template Catalog Grid */}
              <div className="space-y-2.5">
                <label className="text-[12px] font-medium text-[#969696]">
                  {isIndo ? "Template" : "Template"}
                </label>
                <div
                  className={cn(
                    "grid gap-2.5",
                    format === "interactive" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-2"
                  )}
                >
                  {activeTemplateList.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className={cn(
                          "p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative group min-h-[96px]",
                          isSelected
                            ? "bg-[#252525] border-white/40 shadow-sm"
                            : "bg-[#1f1f1f] border-[#2b2b2b] hover:border-[#383838]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="text-xs font-semibold text-white pr-6 leading-snug">
                            {tpl.name}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectTemplate(tpl);
                              setIsEditingPrompt(!isEditingPrompt);
                            }}
                            title={isIndo ? "Kustomisasi Outline" : "Customize Prompt"}
                            className="h-6 w-6 rounded-full bg-[#2a2a2a] hover:bg-[#383838] text-[#888888] hover:text-white flex items-center justify-center shrink-0 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-[11px] text-[#909090] leading-relaxed line-clamp-2">
                          {tpl.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suggested Templates (Only in Document Format, or expandable) */}
              {format === "document" && suggestedTemplates.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#969696]">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>{isIndo ? "Template yang Disarankan" : "Recommended Templates"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {suggestedTemplates.map((tpl) => {
                      const isSelected = selectedTemplateId === tpl.id;
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => handleSelectTemplate(tpl)}
                          className={cn(
                            "p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative group min-h-[96px]",
                            isSelected
                              ? "bg-[#252525] border-white/40 shadow-sm"
                              : "bg-[#1f1f1f] border-[#2b2b2b] hover:border-[#383838]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="text-xs font-semibold text-white pr-6 leading-snug">
                              {tpl.name}
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
                              className="h-6 w-6 rounded-full bg-[#2a2a2a] hover:bg-[#383838] text-[#888888] hover:text-white flex items-center justify-center shrink-0 transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="text-[11px] text-[#909090] leading-relaxed line-clamp-2">
                            {tpl.description}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Depth & Language Controls */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Kedalaman Laporan */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-medium text-[#969696]">
                    {isIndo ? "Kedalaman Analisis" : "Depth & Scope"}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "short", label: isIndo ? "Ringkas" : "Concise" },
                      { id: "medium", label: isIndo ? "Standar" : "Balanced" },
                      { id: "long", label: isIndo ? "Mendalam" : "In-depth" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDepth(m.id as any)}
                        className={cn(
                          "py-1.5 px-2 rounded-xl border text-[11px] font-medium transition-all text-center cursor-pointer",
                          depth === m.id
                            ? "bg-[#252525] border-white/40 text-white font-semibold"
                            : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888] hover:text-white"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bahasa Keluaran */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-medium text-[#969696]">
                    {isIndo ? "Bahasa Dokumen" : "Document Language"}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "id", label: "Bahasa Indonesia" },
                      { id: "en", label: "English" },
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setTargetLang(l.id as any)}
                        className={cn(
                          "py-1.5 px-2 rounded-xl border text-[11px] font-medium transition-all text-center cursor-pointer",
                          targetLang === l.id
                            ? "bg-[#252525] border-white/40 text-white font-semibold"
                            : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888] hover:text-white"
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom Instructions / Outline editor */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] font-medium text-[#969696]">
                    {isIndo ? "Arahan Khusus / Outline (Opsional)" : "Custom Guidance / Outline (Optional)"}
                  </label>
                  {currentTemplate?.defaultPrompt && (
                    <button
                      type="button"
                      onClick={() => setCustomInstructions(currentTemplate.defaultPrompt || "")}
                      className="text-[10.5px] text-[#888888] hover:text-white hover:underline cursor-pointer"
                    >
                      {isIndo ? "Pulihkan Default" : "Reset Default"}
                    </button>
                  )}
                </div>
                <textarea
                  ref={textareaRef}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder={
                    isIndo
                      ? "Contoh: Sorot perbandingan arsitektur AI, gunakan analogi yang mudah dipahami mahasiswa, dan sertakan rumus latensi..."
                      : "E.g., Emphasize latency trade-offs, target academic rigor with clean KaTeX formulations..."
                  }
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] focus:border-[#444444] text-xs text-white placeholder-[#666666] outline-none resize-none transition-colors"
                />
              </div>
            </div>
          </ScrollArea>

          {/* Footer - No AI Usage bar, austere studio buttons */}
          <div className="px-6 py-4 bg-[#161616] border-t border-[#222222] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl hover:bg-[#222222] text-xs font-medium text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              {isIndo ? "Batal" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]",
                selectedSourceIds.length > 0
                  ? "bg-white hover:bg-neutral-200 text-black font-semibold"
                  : "bg-[#252525] text-[#666] cursor-not-allowed"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{isIndo ? "Buat sekarang" : "Create now"}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
