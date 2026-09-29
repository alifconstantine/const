import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Check,
  ChevronDown,
  FileText,
  Sparkles,
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
  const { t, language } = useI18n();

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    sources.map((s) => s.id)
  );
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const [format, setFormat] = useState<"interactive" | "document">("interactive");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("learning_summary");
  const [depth, setDepth] = useState<"short" | "medium" | "long" | "auto">("medium");
  const [targetLang, setTargetLang] = useState<"id" | "en">(language === "id" ? "id" : "en");
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
      templateTitle: currentTemplate?.name || t("learningReportTitle"),
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
              {t("createReport")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-[#222222] hover:bg-[#2b2b2b] text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
          {/* Sumber Scope Selector */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-medium text-[#969696]">
              {t("sourceScope")}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                className="w-full h-10 px-3.5 rounded-xl bg-[#222222] border border-[#2b2b2b] flex items-center justify-between text-xs text-left cursor-pointer"
              >
                <span className="text-white font-medium truncate">
                  {selectedSourceIds.length === sources.length
                    ? t("allSourcesWithCount", { count: sources.length })
                    : t("selectedOfTotalSources", {
                        selected: selectedSourceIds.length,
                        total: sources.length,
                      })}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#888888]" />
              </button>

              {isSourceDropdownOpen && (
                <div className="mt-1.5 bg-[#222222] border border-[#2b2b2b] rounded-xl p-2 space-y-1 max-h-40 overflow-y-auto shadow-xl">
                  <button
                    type="button"
                    onClick={handleSelectAllSources}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-[#cccccc] cursor-pointer"
                  >
                    <span>
                      {selectedSourceIds.length === sources.length
                        ? t("deselectAll")
                        : t("selectAllSources")}
                    </span>
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
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#2b2b2b] text-xs text-left cursor-pointer"
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
              {t("formatLabel")}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat("interactive")}
                className={cn(
                  "p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer",
                  format === "interactive"
                    ? "bg-[#1e2330] border-[#3b5998] text-white"
                    : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888888]"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">
                    {t("interactiveFormat")}
                  </span>
                  {format === "interactive" && (
                    <div className="h-3.5 w-3.5 rounded-full bg-[#4c75f2] flex items-center justify-center">
                      <Check className="h-2 w-2 text-white stroke-[3]" />
                    </div>
                  )}
                </div>
                <span className="text-[10.5px] text-[#a0a6b5] leading-tight line-clamp-2">
                  {t("interactiveFormatDesc")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("document")}
                className={cn(
                  "p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer",
                  format === "document"
                    ? "bg-[#1e2330] border-[#3b5998] text-white"
                    : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888888]"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">
                    {t("documentFormat")}
                  </span>
                  {format === "document" && (
                    <div className="h-3.5 w-3.5 rounded-full bg-[#4c75f2] flex items-center justify-center">
                      <Check className="h-2 w-2 text-white stroke-[3]" />
                    </div>
                  )}
                </div>
                <span className="text-[10.5px] text-[#a0a6b5] leading-tight line-clamp-2">
                  {t("documentFormatDesc")}
                </span>
              </button>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#969696]">
              {t("templateLabel")}
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
                      className="h-6 w-6 rounded-full bg-[#2a2a2a] text-[#888888] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
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
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>{t("recommendedTemplates")}</span>
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
                        className="h-6 w-6 rounded-full bg-[#2a2a2a] text-[#888888] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
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
                {t("depthAndScope")}
              </label>
              <div className="grid grid-cols-3 gap-1">
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
                      "py-1.5 rounded-xl border text-[10.5px] font-medium transition-all text-center cursor-pointer",
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
                {t("documentLanguage")}
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
                      "py-1.5 rounded-xl border text-[10.5px] font-medium transition-all text-center cursor-pointer",
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
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-[#969696]">
                {t("customGuidanceOptional")}
              </label>
              {currentTemplate?.defaultPrompt && (
                <button
                  type="button"
                  onClick={() => setCustomInstructions(currentTemplate.defaultPrompt || "")}
                  className="text-[10px] text-[#888888] hover:text-white hover:underline cursor-pointer"
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
              className="w-full px-3 py-2 rounded-xl bg-[#222222] border border-[#2b2b2b] text-xs text-white placeholder-[#666666] outline-none resize-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={selectedSourceIds.length === 0}
              className={cn(
                "w-full py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99] cursor-pointer",
                selectedSourceIds.length > 0
                  ? "bg-white hover:bg-neutral-200 text-black font-semibold"
                  : "bg-[#252525] text-[#666] cursor-not-allowed"
              )}
            >
              <FileText className="h-4 w-4" />
              <span>{t("createNowAction")}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
