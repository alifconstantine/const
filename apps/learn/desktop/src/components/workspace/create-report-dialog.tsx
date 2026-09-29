import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Check,
  ChevronDown,
  FileText,
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
  const { t, language } = useI18n();

  // State
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [format, setFormat] = useState<"interactive" | "document">("interactive");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("learning_summary");
  const [depth, setDepth] = useState<"short" | "medium" | "long" | "auto">("medium");
  const [targetLang, setTargetLang] = useState<"id" | "en">(language === "id" ? "id" : "en");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    return [
      {
        id: "strategy_doc",
        name: t("strategyDocName"),
        description: primaryTitle
          ? t("strategyDocDescWithTopic", { topic: primaryTitle.slice(0, 36) })
          : t("strategyDocDesc"),
        defaultPrompt: t("strategyDocPrompt"),
      },
      {
        id: "analysis_report",
        name: t("analysisReportName"),
        description: t("analysisReportDesc"),
        defaultPrompt: t("analysisReportPrompt"),
      },
      {
        id: "concept_guide",
        name: t("conceptGuideName"),
        description: t("conceptGuideDesc"),
        defaultPrompt: t("conceptGuidePrompt"),
      },
      {
        id: "comparison_essay",
        name: t("comparisonEssayName"),
        description: t("comparisonEssayDesc"),
        defaultPrompt: t("comparisonEssayPrompt"),
      },
    ];
  }, [sources, t]);

  // Standard templates
  const interactiveTemplates: ReportTemplate[] = useMemo(
    () => [
      {
        id: "learning_summary",
        name: t("learningSummaryName"),
        description: t("learningSummaryDesc"),
        defaultPrompt: t("learningSummaryPrompt"),
      },
      {
        id: "interactive_concept",
        name: t("interactiveStudyGuideName"),
        description: t("interactiveStudyGuideDesc"),
        defaultPrompt: t("interactiveStudyGuidePrompt"),
      },
      {
        id: "custom_interactive",
        name: t("customInteractiveReportName"),
        description: t("customInteractiveReportDesc"),
        defaultPrompt: "",
      },
    ],
    [t]
  );

  const documentTemplates: ReportTemplate[] = useMemo(
    () => [
      {
        id: "custom_document",
        name: t("customReportName"),
        description: t("customReportDesc"),
        defaultPrompt: "",
      },
      {
        id: "briefing_doc",
        name: t("briefingDocName"),
        description: t("briefingDocDesc"),
        defaultPrompt: t("briefingDocPrompt"),
      },
      {
        id: "study_guide",
        name: t("studyGuideName"),
        description: t("studyGuideDesc"),
        defaultPrompt: t("studyGuidePrompt"),
      },
      {
        id: "blog_post",
        name: t("blogPostName"),
        description: t("blogPostDesc"),
        defaultPrompt: t("blogPostPrompt"),
      },
    ],
    [t]
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
      <DialogContent className="max-w-[700px] max-h-[88vh] flex flex-col gap-0 p-0 bg-[#161616] border border-[#2b2b2b] text-[#d4d4d4] rounded-2xl shadow-2xl overflow-hidden font-sans [&>button]:hidden outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0">
        {/* Header - Borderless austere studio style */}
        <div className="shrink-0 flex items-center justify-between px-6 pt-5 pb-2 bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-white shrink-0" />
            <span className="text-sm font-semibold text-white tracking-tight">
              {t("createReport")}
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
          <ScrollArea className="flex-1 min-h-0 w-full px-6 py-2">
            <div className="space-y-5 pb-4">
              {/* Sumber Rujukan Materi */}
              <div className="space-y-1.5 relative" data-studio-dropdown>
                <label className="text-[12px] font-medium text-[#969696]">
                  {t("sourceScope")}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                    className="w-full h-9 px-3 rounded-xl bg-[#222222] border border-[#2b2b2b] hover:border-[#383838] flex items-center justify-between text-xs text-left cursor-pointer transition-colors"
                  >
                    <span className="text-white font-medium truncate">
                      {selectedSourceIds.length === sources.length
                        ? t("allSourcesWithCount", { count: sources.length })
                        : t("selectedOfTotalSources", {
                            selected: selectedSourceIds.length,
                            total: sources.length,
                          })}
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
                      <button
                        type="button"
                        onClick={handleSelectAllSources}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc] cursor-pointer transition-colors"
                      >
                        <span className="font-medium">
                          {selectedSourceIds.length === sources.length
                            ? t("deselectAll")
                            : t("selectAllSources")}
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

                      <ScrollArea className="max-h-52 w-full" viewportClassName="space-y-1 pr-1.5">
                        {sources.map((src) => {
                          const isSelected = selectedSourceIds.includes(src.id);
                          return (
                            <button
                              key={src.id}
                              type="button"
                              onClick={() => handleToggleSource(src.id)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-left cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <FileText className="h-3.5 w-3.5 text-[#777777] shrink-0" />
                                <span className="truncate text-[#e0e0e0]">{src.title}</span>
                              </div>
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
                  {t("formatLabel")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Option 1: Interaktif */}
                  <button
                    type="button"
                    onClick={() => setFormat("interactive")}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative",
                      format === "interactive"
                        ? "bg-[#2b2b2b] border-[#444444] shadow-sm text-white"
                        : "bg-[#222222] border-[#2b2b2b] hover:border-[#383838] text-[#888888] hover:text-[#d4d4d4]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-semibold text-white">
                        {t("interactiveFormat")}
                      </div>
                      {format === "interactive" && (
                        <div className="h-4 w-4 rounded-full bg-white flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-black stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-[#a0a0a0] leading-relaxed">
                      {t("interactiveFormatDesc")}
                    </div>
                  </button>

                  {/* Option 2: Dokumen */}
                  <button
                    type="button"
                    onClick={() => setFormat("document")}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative",
                      format === "document"
                        ? "bg-[#2b2b2b] border-[#444444] shadow-sm text-white"
                        : "bg-[#222222] border-[#2b2b2b] hover:border-[#383838] text-[#888888] hover:text-[#d4d4d4]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-semibold text-white">
                        {t("documentFormat")}
                      </div>
                      {format === "document" && (
                        <div className="h-4 w-4 rounded-full bg-white flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-black stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-[#a0a0a0] leading-relaxed">
                      {t("documentFormatDesc")}
                    </div>
                  </button>
                </div>
              </div>

              {/* Template Catalog Grid */}
              <div className="space-y-2.5">
                <label className="text-[12px] font-medium text-[#969696]">
                  {t("templateLabel")}
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
                            title={t("customizePrompt")}
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
                    <FileText className="h-3.5 w-3.5 text-neutral-400" />
                    <span>{t("recommendedTemplates")}</span>
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
                    {t("depthAndScope")}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "short", label: t("concise") },
                      { id: "medium", label: t("balanced") },
                      { id: "long", label: t("inDepth") },
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
                    {t("documentLanguage")}
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
                    {t("customGuidanceOptional")}
                  </label>
                  {currentTemplate?.defaultPrompt && (
                    <button
                      type="button"
                      onClick={() => setCustomInstructions(currentTemplate.defaultPrompt || "")}
                      className="text-[10.5px] text-[#888888] hover:text-white hover:underline cursor-pointer"
                    >
                      {t("resetDefaultAction")}
                    </button>
                  )}
                </div>
                <textarea
                  ref={textareaRef}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder={t("reportGuidancePlaceholder")}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] focus:border-[#444444] text-xs text-white placeholder-[#666666] outline-none resize-none transition-colors"
                />
              </div>
            </div>
          </ScrollArea>

          {/* Footer - No AI Usage bar, austere studio buttons */}
          <div className="shrink-0 px-6 py-3.5 bg-[#161616] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl hover:bg-[#222222] text-xs font-medium text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.99]",
                selectedSourceIds.length > 0
                  ? "bg-white hover:bg-neutral-200 text-black font-semibold"
                  : "bg-white/40 text-black/50 cursor-not-allowed"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{t("createReport")}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
