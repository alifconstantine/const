import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ListOrdered,
  Copy,
  Check,
  Download,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  BarChart3,
  HelpCircle,
  Layers,
  FileText,
  Printer,
  Share2,
  MoreVertical,
  Menu,
} from "lucide-react";
import {
  ScrollArea,
  cn,
  toast,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@const/ui";
import { useI18n } from "../../lib/i18n";
import { MarkdownContent } from "../workspace/markdown-content";
import { localDb, type LocalArtifact, type ReportData, type ReportSection } from "../../lib/db";

export interface ReportViewerProps {
  artifact?: LocalArtifact;
  data: ReportData;
  onExplainInChat?: (prompt: string) => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  onSelectStudioTool?: (toolId: string) => void;
}

export function ReportViewer({
  artifact,
  data,
  onExplainInChat,
  onToggleExpand: _onToggleExpand,
  isExpanded: _isExpanded = false,
  onSelectStudioTool,
}: ReportViewerProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [activeSectionId, setActiveSectionId] = useState<string>(
    data.sections?.[0]?.id || ""
  );
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(data.feedback || null);
  const [dismissedWidgets, setDismissedWidgets] = useState<Record<string, boolean>>({});
  const [showSourcesPopup, setShowSourcesPopup] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const maximizedSectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Auto-track active section on scroll
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
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0.1,
      }
    );

    const activeRefs = isMaximized ? maximizedSectionRefs.current : sectionRefs.current;
    Object.values(activeRefs).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [data.sections, isMaximized]);

  // Handle Escape key to exit maximized view
  useEffect(() => {
    if (!isMaximized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  const handleScrollToSection = (secId: string, isMaximizedMode = false) => {
    setActiveSectionId(secId);
    const refs = isMaximizedMode ? maximizedSectionRefs.current : sectionRefs.current;
    const targetEl = refs[secId];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCopyMarkdown = () => {
    const fullMarkdown =
      `# ${data.title}\n\n` +
      (data.sections || [])
        .map((s, idx) => `## ${idx + 1}. ${s.title}\n\n${s.content}`)
        .join("\n\n---\n\n");

    navigator.clipboard.writeText(fullMarkdown);
    setCopied(true);
    toast.success(
      isIndo ? "Laporan berhasil disalin sebagai Markdown" : "Report copied as Markdown"
    );
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    handleCopyMarkdown();
  };

  const handleDownloadMarkdown = () => {
    const fullMarkdown =
      `# ${data.title}\n\n` +
      (data.sections || [])
        .map((s, idx) => `## ${idx + 1}. ${s.title}\n\n${s.content}`)
        .join("\n\n---\n\n");

    const blob = new Blob([fullMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.title || "laporan").replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(
      isIndo ? "File Markdown berhasil diunduh!" : "Markdown file downloaded!"
    );
  };

  const handlePrint = () => {
    window.print();
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
      isIndo
        ? "Terima kasih atas masukan Anda!"
        : "Thank you for your feedback!"
    );
  };

  const handleWidgetAction = (sec: ReportSection) => {
    if (!sec.recommendedWidget) return;
    const targetTool = sec.recommendedWidget.targetTool || sec.recommendedWidget.type;

    if (onSelectStudioTool && targetTool) {
      onSelectStudioTool(targetTool);
    } else if (onExplainInChat) {
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
    <div className="h-full flex flex-col bg-[#161616] text-[#d4d4d4] font-sans overflow-hidden select-text">
      {/* Top Header Bar with Title, Sources, Expand/Maximize, and Export (matching Video Summary layout) */}
      <div className="h-14 px-3 sm:px-4 border-b border-[#2b2b2b] bg-[#161616] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 truncate min-w-0 pr-2">
          <FileText className="h-4 w-4 text-stone-300 shrink-0" />
          <h1 className="text-xs sm:text-sm font-semibold text-white truncate tracking-tight">
            {data.title}
          </h1>
        </div>

        {/* Top Header Actions: Scope, Expand (Video Summary style), and Export */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Sumber Scope Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSourcesPopup(!showSourcesPopup)}
              className="h-8 px-2.5 sm:px-3 rounded-full bg-[#222222] border border-[#2e2e2e] hover:border-[#383838] text-[11px] sm:text-xs font-medium text-[#d4d4d4] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <BookOpen className="h-3 w-3 text-[#969696]" />
              <span className="hidden sm:inline">
                {isIndo
                  ? `Lihat ${data.sourceCount || 1} sumber`
                  : `View ${data.sourceCount || 1} source${(data.sourceCount || 1) > 1 ? "s" : ""}`}
              </span>
              <span className="sm:hidden">{data.sourceCount || 1}</span>
            </button>

            {/* Sources dropdown popover */}
            {showSourcesPopup && data.sourceTitles && data.sourceTitles.length > 0 && (
              <div className="absolute top-full mt-2 right-0 w-64 bg-[#222222] border border-[#2b2b2b] rounded-xl p-2.5 shadow-2xl z-40 select-none">
                <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider mb-2 px-1">
                  {isIndo ? "Sumber Rujukan Laporan" : "Source References"}
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {data.sourceTitles.map((title, i) => (
                    <div
                      key={i}
                      className="px-2 py-1.5 rounded-lg bg-[#1a1a1a] text-xs text-white truncate flex items-center gap-2"
                    >
                      <span className="text-[10px] font-mono text-[#888888]">[{i + 1}]</span>
                      <span className="truncate">{title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Perbesar / Expand button (exactly matching Video Summary) */}
          <button
            type="button"
            onClick={() => setIsMaximized(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] text-[#d4d4d4] hover:text-white text-xs font-medium transition-colors border border-[#333333] cursor-pointer"
            title={isIndo ? "Perbesar Laporan" : "Expand Report"}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isIndo ? "Perbesar" : "Expand"}</span>
          </button>

          {/* Ekspor Dropdown (matching Video Summary export dropdown) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2b2b2b] text-white text-xs font-medium transition-colors border border-[#333333] cursor-pointer"
                title={isIndo ? "Ekspor" : "Export"}
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">{isIndo ? "Ekspor" : "Export"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1 bg-[#222222] border-[#383838] text-white font-sans shadow-xl">
              <DropdownMenuItem
                onClick={handleDownloadMarkdown}
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#2b2b2b] focus:bg-[#2b2b2b] text-white rounded-md"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>{isIndo ? "Unduh Markdown (.md)" : "Download Markdown (.md)"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleCopyMarkdown}
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#2b2b2b] focus:bg-[#2b2b2b] text-white rounded-md"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isIndo ? "Salin ke Clipboard" : "Copy to Clipboard"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handlePrint}
                className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#2b2b2b] focus:bg-[#2b2b2b] text-white rounded-md"
              >
                <Printer className="w-3.5 h-3.5 text-purple-400" />
                <span>{isIndo ? "Cetak / Simpan PDF" : "Print / Save PDF"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Body: 2-Column TOC & Reading Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Table of Contents (TOC) Sidebar */}
        <aside className="w-56 sm:w-64 h-full border-r border-[#2b2b2b] bg-[#161616] flex flex-col shrink-0 select-none">
          <div className="p-3.5 pb-2 flex items-center gap-2 text-xs font-semibold text-[#888888] tracking-wider uppercase">
            <ListOrdered className="h-3.5 w-3.5" />
            <span>{isIndo ? "Daftar Bab" : "Table of Contents"}</span>
          </div>

          <ScrollArea className="flex-1 px-2.5 pb-4">
            <nav className="space-y-1">
              {data.toc && data.toc.length > 0
                ? data.toc.map((item, idx) => {
                    const isCurrent = activeSectionId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleScrollToSection(item.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-start gap-2",
                          isCurrent
                            ? "bg-[#252525] text-white font-medium shadow-xs"
                            : "text-[#909090] hover:bg-[#1f1f1f] hover:text-[#d4d4d4]"
                        )}
                      >
                        <span className="font-mono text-[11px] text-[#707070] shrink-0 mt-0.5">
                          {idx + 1}.
                        </span>
                        <span className="leading-snug line-clamp-2">
                          {item.title.replace(/^\d+[\.\s]*/, "")}
                        </span>
                      </button>
                    );
                  })
                : data.sections?.map((sec, idx) => {
                    const isCurrent = activeSectionId === sec.id;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => handleScrollToSection(sec.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-start gap-2",
                          isCurrent
                            ? "bg-[#252525] text-white font-medium shadow-xs"
                            : "text-[#909090] hover:bg-[#1f1f1f] hover:text-[#d4d4d4]"
                        )}
                      >
                        <span className="font-mono text-[11px] text-[#707070] shrink-0 mt-0.5">
                          {idx + 1}.
                        </span>
                        <span className="leading-snug line-clamp-2">{sec.title}</span>
                      </button>
                    );
                  })}
            </nav>
          </ScrollArea>

          {/* Bottom Left: Feedback Pills */}
          <div className="p-3 border-t border-[#222222] bg-[#161616] flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleFeedback("good")}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-xl text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
                feedback === "good"
                  ? "bg-[#252525] border-white/40 text-white font-semibold"
                  : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888888] hover:text-white"
              )}
            >
              <ThumbsUp className="h-3 w-3" />
              <span>{isIndo ? "Laporan bagus" : "Good report"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleFeedback("bad")}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-xl text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
                feedback === "bad"
                  ? "bg-[#252525] border-white/40 text-white font-semibold"
                  : "bg-[#1f1f1f] border-[#2b2b2b] text-[#888888] hover:text-white"
              )}
            >
              <ThumbsDown className="h-3 w-3" />
              <span>{isIndo ? "Laporan buruk" : "Bad report"}</span>
            </button>
          </div>
        </aside>

        {/* Right Column: Reading Canvas (Markdown + KaTeX Math) */}
        <main className="flex-1 h-full overflow-hidden flex flex-col bg-[#161616]">
          <ScrollArea className="flex-1 w-full px-8 py-6">
            <div className="max-w-[760px] mx-auto space-y-10 pb-16">
              {data.sections?.map((sec, idx) => {
                const WidgetIcon = getWidgetIcon(sec.recommendedWidget?.type);
                const isWidgetDismissed = dismissedWidgets[sec.id];

                return (
                  <article
                    key={sec.id}
                    ref={(el) => {
                      sectionRefs.current[sec.id] = el;
                    }}
                    data-section-id={sec.id}
                    className="scroll-mt-6 space-y-4"
                  >
                    {/* Section Title */}
                    <div className="space-y-1">
                      <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight leading-snug">
                        {sec.title}
                      </h2>
                    </div>

                    {/* Section Content with Markdown + KaTeX LaTeX Rendering */}
                    <div className="prose prose-invert max-w-none text-[#d4d4d4] leading-relaxed text-[13.5px]">
                      <MarkdownContent content={sec.content} />
                    </div>

                    {/* Interactive Embedded Widget Card (NotebookLM style) */}
                    {data.format === "interactive" &&
                      sec.recommendedWidget &&
                      !isWidgetDismissed && (
                        <div className="mt-6 p-4 rounded-2xl bg-[#222222] border border-[#2e2e2e] shadow-lg flex items-start justify-between gap-3 relative transition-all group hover:border-[#3d3d3d]">
                          <div
                            onClick={() => handleWidgetAction(sec)}
                            className="flex items-start gap-3 cursor-pointer flex-1"
                          >
                            <div className="h-8 w-8 rounded-xl bg-[#2c2c2c] border border-[#383838] flex items-center justify-center shrink-0 mt-0.5 text-stone-300">
                              <WidgetIcon className="h-4 w-4" />
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider">
                                {sec.recommendedWidget.badge ||
                                  (isIndo ? "Direkomendasikan" : "Recommended")}
                              </div>
                              <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
                                {sec.recommendedWidget.title}
                              </div>
                              {sec.recommendedWidget.description && (
                                <div className="text-[11px] text-[#909090] leading-relaxed">
                                  {sec.recommendedWidget.description}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setDismissedWidgets((prev) => ({ ...prev, [sec.id]: true }))
                            }
                            className="h-6 w-6 rounded-md hover:bg-[#2c2c2c] text-[#707070] hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                            title={isIndo ? "Tutup Rekomendasi" : "Dismiss Widget"}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                  </article>
                );
              })}
            </div>
          </ScrollArea>
        </main>
      </div>

      {/* Floating Centered Modal Report View (matching Gemini Notebook / NotebookLM layout) */}
      {isMaximized &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center p-3 sm:p-5 md:p-7 select-none animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            onClick={() => setIsMaximized(false)}
          >
            {/* Centered Floating Modal Card */}
            <div
              className="relative w-full max-w-[1240px] h-[88vh] max-h-[860px] bg-[#1c1c1e] border border-[#2b2b2b] rounded-3xl shadow-2xl flex flex-col overflow-hidden select-text animate-in zoom-in-95 duration-150 font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header inside the Card */}
              <header className="h-14 px-5 sm:px-6 border-b border-[#282828] bg-[#1c1c1e] flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate">
                    {data.title}
                  </h1>
                </div>

                {/* Right Actions: [Lihat 1 sumber] [Share2] [Minimize2] [X] [MoreVertical ⋮] */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Sumber Scope Pill */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSourcesPopup(!showSourcesPopup)}
                      className="h-8 px-3.5 rounded-full bg-[#262628] hover:bg-[#303032] border border-[#333333] text-xs font-normal text-[#d4d4d4] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>
                        {isIndo
                          ? `Lihat ${data.sourceCount || 1} sumber`
                          : `View ${data.sourceCount || 1} source${(data.sourceCount || 1) > 1 ? "s" : ""}`}
                      </span>
                    </button>

                    {/* Sources dropdown popover */}
                    {showSourcesPopup && data.sourceTitles && data.sourceTitles.length > 0 && (
                      <div className="absolute top-full mt-2 right-0 w-72 bg-[#222224] border border-[#2e2e30] rounded-xl p-3 shadow-2xl z-50 select-none">
                        <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider mb-2 px-1">
                          {isIndo ? "Sumber Rujukan Laporan" : "Source References"}
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {data.sourceTitles.map((title, i) => (
                            <div
                              key={i}
                              className="px-2.5 py-1.5 rounded-lg bg-[#18181a] text-xs text-white truncate flex items-center gap-2"
                            >
                              <span className="text-[10px] font-mono text-[#888888]">[{i + 1}]</span>
                              <span className="truncate">{title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Share button */}
                  <button
                    type="button"
                    onClick={handleShare}
                    className="h-8 w-8 rounded-lg hover:bg-[#28282a] text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title={isIndo ? "Bagikan / Salin" : "Share / Copy"}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {/* Minimize / Collapse back to panel button */}
                  <button
                    type="button"
                    onClick={() => setIsMaximized(false)}
                    className="h-8 w-8 rounded-lg hover:bg-[#28282a] text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title={isIndo ? "Perkecil (Kembali ke panel)" : "Restore"}
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>

                  {/* Close X button */}
                  <button
                    type="button"
                    onClick={() => setIsMaximized(false)}
                    className="h-8 w-8 rounded-lg hover:bg-[#28282a] text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Close (Esc)"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* More options ⋮ dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="h-8 w-8 rounded-lg hover:bg-[#28282a] text-[#a3a3a3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Opsi Lainnya"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 p-1 bg-[#222224] border-[#2e2e30] text-white font-sans shadow-xl">
                      <DropdownMenuItem
                        onClick={handleDownloadMarkdown}
                        className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#2b2b2d] focus:bg-[#2b2b2d] text-white rounded-md"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                        <span>{isIndo ? "Unduh Markdown (.md)" : "Download Markdown (.md)"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleCopyMarkdown}
                        className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#2b2b2d] focus:bg-[#2b2b2d] text-white rounded-md"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isIndo ? "Salin ke Clipboard" : "Copy to Clipboard"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handlePrint}
                        className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 hover:bg-[#2b2b2d] focus:bg-[#2b2b2d] text-white rounded-md"
                      >
                        <Printer className="w-3.5 h-3.5 text-purple-400" />
                        <span>{isIndo ? "Cetak / Simpan PDF" : "Print / Save PDF"}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>

              {/* 2-Column Body inside Modal Card */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Left Column: TOC */}
                <aside className="w-56 sm:w-64 h-full border-r border-[#282828] bg-[#1c1c1e] flex flex-col shrink-0 select-none">
                  {/* Top hamburger list icon button */}
                  <div className="p-3.5 pb-2 flex items-center">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg bg-[#252528] text-white flex items-center justify-center hover:bg-[#2e2e32] transition-colors"
                      title="Daftar Bab"
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                  </div>

                  <ScrollArea className="flex-1 px-2.5 pb-4">
                    <nav className="space-y-1">
                      {(data.toc && data.toc.length > 0 ? data.toc : data.sections || []).map((item, idx) => {
                        const isCurrent = activeSectionId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleScrollToSection(item.id, true)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-start gap-1.5",
                              isCurrent
                                ? "bg-[#28282b] text-white font-medium shadow-xs"
                                : "text-[#909090] hover:bg-[#222225] hover:text-[#d4d4d4]"
                            )}
                          >
                            <span className="shrink-0">{idx + 1}.</span>
                            <span className="leading-snug line-clamp-2">
                              {item.title.replace(/^\d+[\.\s]*/, "")}
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                  </ScrollArea>

                  {/* Bottom Left: Feedback Pills */}
                  <div className="p-3 border-t border-[#282828] bg-[#1c1c1e] flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleFeedback("good")}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded-xl text-[11px] font-medium border flex items-center justify-center gap-1 transition-colors cursor-pointer",
                        feedback === "good"
                          ? "bg-[#28282b] border-white/40 text-white font-semibold"
                          : "bg-[#222225] border-[#2e2e30] text-[#888888] hover:text-white"
                      )}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      <span>{isIndo ? "Laporan bagus" : "Good report"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFeedback("bad")}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded-xl text-[11px] font-medium border flex items-center justify-center gap-1 transition-colors cursor-pointer",
                        feedback === "bad"
                          ? "bg-[#28282b] border-white/40 text-white font-semibold"
                          : "bg-[#222225] border-[#2e2e30] text-[#888888] hover:text-white"
                      )}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      <span>{isIndo ? "Laporan buruk" : "Bad report"}</span>
                    </button>
                  </div>
                </aside>

                {/* Right Column: Reading Canvas */}
                <main className="flex-1 h-full overflow-hidden flex flex-col bg-[#1c1c1e]">
                  <ScrollArea className="flex-1 w-full px-8 sm:px-14 py-8">
                    <div className="max-w-[760px] mx-auto space-y-10 pb-20">
                      {data.sections?.map((sec) => {
                        const WidgetIcon = getWidgetIcon(sec.recommendedWidget?.type);
                        const isWidgetDismissed = dismissedWidgets[sec.id];

                        return (
                          <article
                            key={sec.id}
                            ref={(el) => {
                              maximizedSectionRefs.current[sec.id] = el;
                            }}
                            data-section-id={sec.id}
                            className="scroll-mt-6 space-y-4"
                          >
                            {/* Section Heading matching screenshot */}
                            <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight leading-snug">
                              {sec.title}
                            </h2>

                            {/* Section Content with Markdown + KaTeX */}
                            <div className="prose prose-invert max-w-none text-[#d4d4d4] leading-relaxed text-[14px]">
                              <MarkdownContent content={sec.content} />
                            </div>

                            {/* Interactive Embedded Widget Card (matching screenshot) */}
                            {data.format === "interactive" &&
                              sec.recommendedWidget &&
                              !isWidgetDismissed && (
                                <div className="mt-6 p-3.5 rounded-2xl bg-[#28282b] border border-[#333336] shadow-md flex items-start justify-between gap-3 relative transition-all group hover:border-[#404044]">
                                  <div
                                    onClick={() => {
                                      setIsMaximized(false);
                                      handleWidgetAction(sec);
                                    }}
                                    className="flex items-start gap-3 cursor-pointer flex-1 min-w-0"
                                  >
                                    <div className="h-8 w-8 rounded-xl bg-[#323236] border border-[#3c3c40] flex items-center justify-center shrink-0 mt-0.5 text-stone-200">
                                      <WidgetIcon className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="text-[10px] font-medium text-[#888888] tracking-wide">
                                        {sec.recommendedWidget.badge ||
                                          (isIndo ? "Direkomendasikan • Widget" : "Recommended • Widget")}
                                      </div>
                                      <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                                        {sec.recommendedWidget.title}
                                      </div>
                                      {sec.recommendedWidget.description && (
                                        <div className="text-[11px] text-[#909090] leading-snug line-clamp-2">
                                          {sec.recommendedWidget.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDismissedWidgets((prev) => ({ ...prev, [sec.id]: true }))
                                    }
                                    className="h-6 w-6 rounded-md hover:bg-[#323236] text-[#707070] hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                                    title={isIndo ? "Tutup Rekomendasi" : "Dismiss Widget"}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                          </article>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </main>
              </div>
            </div>

            {/* Disclaimer at bottom (matching screenshot) */}
            <div className="text-[11.5px] text-[#666666] text-center mt-2.5 select-none pointer-events-none">
              {isIndo
                ? "Const Learn dapat membuat kesalahan, jadi periksa kembali responsnya."
                : "Const Learn can make mistakes, so double-check its responses."}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
