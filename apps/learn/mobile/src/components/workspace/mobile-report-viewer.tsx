import React, { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  X,
  BookOpen,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  BarChart3,
  HelpCircle,
  Layers,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import { MarkdownContent } from "./markdown-content";
import { localDb, type LocalArtifact, type ReportData, type ReportSection } from "../../lib/db";

export interface MobileReportViewerProps {
  artifact?: LocalArtifact;
  data: ReportData;
  onClose: () => void;
  onExplainInChat?: (prompt: string) => void;
  onSelectStudioTool?: (toolId: string) => void;
}

export function MobileReportViewer({
  artifact,
  data,
  onClose,
  onExplainInChat,
  onSelectStudioTool,
}: MobileReportViewerProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [activeSectionId, setActiveSectionId] = useState<string>(
    data.sections?.[0]?.id || ""
  );
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(data.feedback || null);
  const [dismissedWidgets, setDismissedWidgets] = useState<Record<string, boolean>>({});
  const [showSourcesSheet, setShowSourcesSheet] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Auto track active section
  useEffect(() => {
    if (!data.sections || data.sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const secId = entry.target.getAttribute("data-section-id");
            if (secId) {
              setActiveSectionId(secId);
            }
          }
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0.1,
      }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [data.sections]);

  const handleScrollToSection = (secId: string) => {
    setActiveSectionId(secId);
    const targetEl = sectionRefs.current[secId];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCopyMarkdown = () => {
    const fullMarkdown =
      `# ${data.title}\n\n` +
      data.sections
        .map((s, idx) => `## ${idx + 1}. ${s.title}\n\n${s.content}`)
        .join("\n\n---\n\n");

    navigator.clipboard.writeText(fullMarkdown);
    setCopied(true);
    toast.success(
      isIndo ? "Laporan berhasil disalin sebagai Markdown" : "Report copied as Markdown"
    );
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (type: "good" | "bad") => {
    const nextFeedback = feedback === type ? null : type;
    setFeedback(nextFeedback);
    if (artifact?.id) {
      localDb
        .updateArtifact(artifact.id, {
          data: {
            ...data,
            feedback: nextFeedback || undefined,
          },
        })
        .catch((err) => console.error("Failed to save feedback", err));
    }
    toast.success(
      isIndo ? "Terima kasih atas masukan Anda!" : "Thank you for your feedback!"
    );
  };

  const handleWidgetAction = (sec: ReportSection) => {
    if (!sec.recommendedWidget) return;
    const targetTool = sec.recommendedWidget.targetTool || sec.recommendedWidget.type;

    if (onSelectStudioTool && targetTool) {
      onClose();
      onSelectStudioTool(targetTool);
    } else if (onExplainInChat) {
      onClose();
      onExplainInChat(
        isIndo
          ? `Bantu buatkan ${sec.recommendedWidget.title} berdasarkan bab "${sec.title}".`
          : `Please generate ${sec.recommendedWidget.title} based on "${sec.title}".`
      );
    }
  };

  const getWidgetIcon = (type?: string) => {
    switch (type) {
      case "infographic":
      case "chart":
        return BarChart3;
      case "quiz":
        return HelpCircle;
      case "flashcard":
        return Layers;
      default:
        return Sparkles;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#161616] text-[#d4d4d4] flex flex-col font-sans select-text overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Bar */}
      <header className="h-14 px-3.5 border-b border-[#2b2b2b] bg-[#161616] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-[#222222] hover:bg-[#2c2c2c] text-[#888888] hover:text-white flex items-center justify-center transition-colors shrink-0"
            aria-label={isIndo ? "Kembali" : "Back"}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-semibold text-white truncate tracking-tight">
              {data.title}
            </h1>
            <div className="text-[10px] text-[#888888] flex items-center gap-1.5">
              <span>{isIndo ? "Laporan Pembelajaran" : "Learning Report"}</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => setShowSourcesSheet(true)}
                className="text-stone-300 underline font-medium"
              >
                {data.sourceCount || 1} {isIndo ? "sumber" : "sources"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            title={isIndo ? "Salin Markdown" : "Copy Markdown"}
            className="h-8 w-8 rounded-full bg-[#222222] hover:bg-[#2c2c2c] text-[#888888] hover:text-white flex items-center justify-center transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </header>

      {/* Horizontal Table of Contents (TOC) Chip Bar */}
      <div className="px-3.5 py-2 border-b border-[#222222] bg-[#1a1a1a] flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 select-none">
        {(data.toc && data.toc.length > 0
          ? data.toc
          : data.sections?.map((s) => ({ id: s.id, order: s.order, title: s.title }))
        ).map((item, idx) => {
          const isCurrent = activeSectionId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleScrollToSection(item.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors",
                isCurrent
                  ? "bg-white text-black shadow-xs font-semibold"
                  : "bg-[#252525] text-[#909090] hover:text-white"
              )}
            >
              <span>{idx + 1}. </span>
              <span>{item.title.replace(/^\d+[\.\s]*/, "")}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {data.sections?.map((sec) => {
          const WidgetIcon = getWidgetIcon(sec.recommendedWidget?.type);
          const isWidgetDismissed = dismissedWidgets[sec.id];

          return (
            <article
              key={sec.id}
              ref={(el) => {
                sectionRefs.current[sec.id] = el;
              }}
              data-section-id={sec.id}
              className="scroll-mt-4 space-y-3"
            >
              <h2 className="text-lg font-semibold text-white tracking-tight leading-snug">
                {sec.title}
              </h2>

              <div className="prose prose-invert max-w-none text-[#d4d4d4] leading-relaxed text-xs">
                <MarkdownContent content={sec.content} />
              </div>

              {/* Recommended Widget Card */}
              {data.format === "interactive" && sec.recommendedWidget && !isWidgetDismissed && (
                <div className="p-3.5 rounded-2xl bg-[#222222] border border-[#2e2e2e] shadow-md flex items-start justify-between gap-2.5">
                  <div
                    onClick={() => handleWidgetAction(sec)}
                    className="flex items-start gap-2.5 flex-1 cursor-pointer"
                  >
                    <div className="h-7 w-7 rounded-lg bg-[#2c2c2c] border border-[#383838] flex items-center justify-center shrink-0 mt-0.5 text-stone-300">
                      <WidgetIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[9.5px] font-semibold text-[#888888] uppercase tracking-wider">
                        {sec.recommendedWidget.badge || (isIndo ? "Direkomendasikan" : "Recommended")}
                      </div>
                      <div className="text-xs font-semibold text-white">
                        {sec.recommendedWidget.title}
                      </div>
                      {sec.recommendedWidget.description && (
                        <div className="text-[10.5px] text-[#909090] leading-tight line-clamp-2">
                          {sec.recommendedWidget.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDismissedWidgets((prev) => ({ ...prev, [sec.id]: true }))}
                    className="h-6 w-6 rounded-full hover:bg-[#2c2c2c] text-[#707070] hover:text-white flex items-center justify-center shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {/* Feedback Section */}
        <div className="pt-4 pb-10 flex items-center gap-2 justify-center border-t border-[#222222]">
          <button
            type="button"
            onClick={() => handleFeedback("good")}
            className={cn(
              "py-1.5 px-3 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors",
              feedback === "good"
                ? "bg-[#252525] border-white/40 text-white font-semibold"
                : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888888]"
            )}
          >
            <ThumbsUp className="h-3 w-3" />
            <span>{isIndo ? "Laporan bagus" : "Good report"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleFeedback("bad")}
            className={cn(
              "py-1.5 px-3 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors",
              feedback === "bad"
                ? "bg-[#252525] border-white/40 text-white font-semibold"
                : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888888]"
            )}
          >
            <ThumbsDown className="h-3 w-3" />
            <span>{isIndo ? "Laporan buruk" : "Bad report"}</span>
          </button>
        </div>
      </main>

      {/* Sources bottom sheet modal */}
      {showSourcesSheet && (
        <div className="fixed inset-0 z-60 bg-black/80 flex flex-col justify-end">
          <div className="bg-[#222222] border-t border-[#2e2e2e] rounded-t-3xl p-5 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {isIndo ? "Sumber Rujukan Laporan" : "Report Sources"}
              </h3>
              <button
                type="button"
                onClick={() => setShowSourcesSheet(false)}
                className="h-7 w-7 rounded-full bg-[#2c2c2c] text-[#888888] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {data.sourceTitles?.map((title, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-[#1a1a1a] text-xs text-white flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#888888]">[{i + 1}]</span>
                  <span className="truncate">{title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
