import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Maximize2,
  Download,
  Presentation,
  FileCode,
  FileText,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import {
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast,
} from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalArtifact, SlideDeckData, SlideItem } from "../../lib/db";
import { buildPresentationHtml } from "../../lib/studio/presentation-builder";
import { exportCanvaPresentation } from "../../lib/studio/generator";

export interface MobilePresentationViewerProps {
  artifact?: LocalArtifact;
  data: SlideDeckData;
  onClose: () => void;
  onExplainInChat?: (prompt: string) => void;
}

export function MobilePresentationViewer({
  artifact,
  data,
  onClose,
  onExplainInChat,
}: MobilePresentationViewerProps) {
  const { t, language } = useI18n();
  const isIndo = language === "id";

  const provider = data.provider || "native";
  const slides: SlideItem[] = useMemo(() => data.slides || [], [data.slides]);
  const totalSlides = slides.length || data.slideCount || 0;

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Compile standalone HTML for preview if needed
  const presentationHtml = useMemo(() => {
    if (data.htmlContent && data.htmlContent.trim().length > 100) {
      return data.htmlContent;
    }
    if (slides.length > 0) {
      return buildPresentationHtml({
        title: data.title,
        topic: data.topic,
        language: data.language || (isIndo ? "id" : "en"),
        themeId: data.themeId as any,
        lengthMode: data.lengthMode || "auto",
        slides,
      });
    }
    return "";
  }, [data.htmlContent, data.title, data.topic, data.language, data.themeId, data.lengthMode, slides, isIndo]);

  const goToSlide = (index: number) => {
    if (index < 0 || index >= slides.length) return;
    setCurrentSlideIndex(index);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "GOTO_SLIDE", index },
        "*"
      );
    }
  };

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "SLIDE_CHANGED" && typeof e.data.index === "number") {
        setCurrentSlideIndex(e.data.index);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error("Exit fullscreen error:", err);
      });
    }
  };

  const handleDownloadHtml = () => {
    if (!presentationHtml) return;
    const blob = new Blob([presentationHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title || "presentation"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(isIndo ? "File HTML presentasi berhasil diunduh!" : "Presentation HTML downloaded!");
  };

  const handleDownloadPdf = () => {
    if (data.pdfUrl) {
      const a = document.createElement("a");
      a.href = data.pdfUrl;
      a.download = `${data.title || "presentation"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(isIndo ? "File PDF berhasil diunduh!" : "Presentation PDF downloaded!");
    } else {
      // Direct window print fallback for mobile
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.print();
      } else {
        toast.info(isIndo ? "PDF sedang disiapkan oleh Cloud Sandbox..." : "PDF is preparing in Cloud Sandbox...");
      }
    }
  };

  // Canva export handler for mobile
  const [isExportingCanva, setIsExportingCanva] = useState(false);

  const handleExportCanva = async (format: "pdf" | "pptx") => {
    if (!data.canvaDesignId) {
      toast.error(t("canvaDesignNotFound"));
      return;
    }
    setIsExportingCanva(true);
    toast.info(
      isIndo
        ? `Memulai ekspor Canva ke format ${format.toUpperCase()}...`
        : `Starting Canva export to ${format.toUpperCase()}...`
    );
    try {
      const res = await exportCanvaPresentation({
        designId: data.canvaDesignId,
        format,
      });
      if (res.success && res.downloadUrl) {
        const a = document.createElement("a");
        a.href = res.downloadUrl;
        a.download = `${data.title || "canva_presentation"}.${format}`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success(
          isIndo
            ? `Desain Canva berhasil diekspor ke ${format.toUpperCase()}!`
            : `Canva design successfully exported to ${format.toUpperCase()}!`
        );
      } else {
        throw new Error(res.error || "Export URL not available");
      }
    } catch (err: any) {
      console.error("Canva export error:", err);
      toast.error(t("failedExportCanva", { error: err.message || "Unknown error" }));
    } finally {
      setIsExportingCanva(false);
    }
  };

  // Google Slides links
  const googleSlidesEmbedUrl = useMemo(() => {
    if (data.googleSlidesEmbedUrl) return data.googleSlidesEmbedUrl;
    if (data.googleSlidesUrl) {
      return data.googleSlidesUrl.replace(/\/edit.*$/, "/embed?start=false&loop=false&delayms=3000");
    }
    return "";
  }, [data.googleSlidesEmbedUrl, data.googleSlidesUrl]);

  const googleSlidesPptxUrl = useMemo(() => {
    if (data.googleSlidesUrl) {
      return data.googleSlidesUrl.replace(/\/edit.*$/, "/export/pptx");
    }
    return "";
  }, [data.googleSlidesUrl]);

  const currentSlide = slides[currentSlideIndex] || slides[0];

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-50 bg-[#121212] text-foreground flex flex-col font-sans select-none animate-in fade-in duration-200",
        isFullscreen && "p-4 bg-black"
      )}
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Bar */}
      <header className="h-14 px-3 border-b border-[#242424] bg-[#161616] flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground truncate">
                {data.title || (isIndo ? "Slide Presentasi" : "Presentation")}
              </span>
              <span
                className={cn(
                  "text-[9px] font-sans font-medium px-1.5 py-0.2 rounded-full border shrink-0",
                  provider === "native" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                  provider === "canva" && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                  provider === "slides" && "bg-amber-500/10 text-amber-400 border-amber-500/20"
                )}
              >
                {provider === "native" ? "Native 16:9" : provider === "canva" ? "Canva" : "Google Slides"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {totalSlides} {isIndo ? "slide materi" : "slides"}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="h-8 w-8 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            title={isFullscreen ? (isIndo ? "Keluar Layar Penuh" : "Exit Fullscreen") : (isIndo ? "Layar Penuh" : "Fullscreen")}
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-8 px-2.5 rounded-lg bg-[#242424] hover:bg-[#2c2c2c] text-foreground text-xs font-medium border border-[#333333] flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="text-[11px]">{isIndo ? "Ekspor" : "Export"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1 bg-[#1e1e1e] border-[#2e2e2e]">
              {provider === "native" && (
                <>
                  <DropdownMenuItem
                    className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground"
                    onClick={handleDownloadPdf}
                  >
                    <FileText className="h-3.5 w-3.5 text-red-400" />
                    <span>{isIndo ? "Unduh PDF" : "Download PDF"}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground"
                    onClick={handleDownloadHtml}
                  >
                    <FileCode className="h-3.5 w-3.5 text-blue-400" />
                    <span>{isIndo ? "Unduh HTML Deck" : "Download HTML Deck"}</span>
                  </DropdownMenuItem>
                </>
              )}

              {provider === "canva" && (
                <>
                  <DropdownMenuItem
                    className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground"
                    onClick={() => handleExportCanva("pdf")}
                    disabled={isExportingCanva || !data.canvaDesignId}
                  >
                    <FileText className="h-3.5 w-3.5 text-red-400" />
                    <span>{isIndo ? "Unduh PDF dari Canva" : "Download PDF from Canva"}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground"
                    onClick={() => handleExportCanva("pptx")}
                    disabled={isExportingCanva || !data.canvaDesignId}
                  >
                    <Presentation className="h-3.5 w-3.5 text-orange-400" />
                    <span>{isIndo ? "Unduh PPTX dari Canva" : "Download PPTX from Canva"}</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-[#2e2e2e]" />

                  {data.canvaEditUrl && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground"
                      onClick={() => window.open(data.canvaEditUrl, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{isIndo ? "Buka di Canva" : "Open in Canva"}</span>
                    </DropdownMenuItem>
                  )}
                  {data.canvaViewUrl && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground"
                      onClick={() => window.open(data.canvaViewUrl, "_blank")}
                    >
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{isIndo ? "Lihat Desain Publik" : "View Public Design"}</span>
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {provider === "slides" && (
                <>
                  {data.googleSlidesUrl && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground"
                      onClick={() => window.open(data.googleSlidesUrl, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
                      <span>{isIndo ? "Buka Google Slides" : "Open Google Slides"}</span>
                    </DropdownMenuItem>
                  )}
                  {googleSlidesPptxUrl && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground"
                      onClick={() => window.open(googleSlidesPptxUrl, "_blank")}
                    >
                      <Download className="h-3.5 w-3.5 text-orange-400" />
                      <span>{isIndo ? "Unduh PPTX" : "Download PPTX"}</span>
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0c] overflow-hidden">
        {/* 1. NATIVE & GOOGLE SLIDES ENGINE */}
        {(provider === "native" || provider === "slides") && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* 16:9 Canvas Viewport */}
            <div className="flex-1 relative flex items-center justify-center p-2 bg-[#0a0a0a] overflow-hidden">
              <div className="w-full aspect-[16/9] max-h-full bg-[#141414] rounded-xl overflow-hidden shadow-2xl border border-[#262626] relative">
                {presentationHtml ? (
                  <iframe
                    ref={iframeRef}
                    title="Mobile Presentation Canvas"
                    srcDoc={presentationHtml}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    className="w-full h-full border-0 rounded-xl bg-black"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
                    <p className="text-xs">
                      {isIndo ? "Menyiapkan slide..." : "Preparing slides..."}
                    </p>
                  </div>
                )}

                {/* Navigation Overlay */}
                {slides.length > 0 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#181818]/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-lg text-xs z-20">
                    <button
                      type="button"
                      onClick={() => goToSlide(currentSlideIndex - 1)}
                      disabled={currentSlideIndex <= 0}
                      className="h-5 w-5 rounded-full hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-foreground"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>

                    <span className="font-sans tabular-nums text-[10px] text-foreground font-medium px-1">
                      {currentSlideIndex + 1}/{slides.length}
                    </span>

                    <button
                      type="button"
                      onClick={() => goToSlide(currentSlideIndex + 1)}
                      disabled={currentSlideIndex >= slides.length - 1}
                      className="h-5 w-5 rounded-full hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-foreground"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowNotes(!showNotes)}
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[9px] font-medium border ml-0.5",
                        showNotes
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-white/5 text-muted-foreground border-transparent"
                      )}
                    >
                      Notes
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Speaker Notes Drawer (ONLY shown when toggled on - NO thumbnails) */}
            {showNotes && (
              <div className="h-36 border-t border-[#222222] bg-[#141414] transition-all shrink-0 flex flex-col">
                <div className="flex-1 flex flex-col p-2.5 min-h-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {isIndo
                        ? `Catatan Slide ${currentSlideIndex + 1}`
                        : `Notes for Slide ${currentSlideIndex + 1}`}
                    </span>
                    {onExplainInChat && (
                      <button
                        type="button"
                        onClick={() => {
                          const prompt = isIndo
                            ? `Tolong jelaskan lebih lanjut materi slide "${currentSlide?.title}": ${currentSlide?.speakerNotes || currentSlide?.subtitle || "Materi konsep"}`
                            : `Please elaborate on slide "${currentSlide?.title}": ${currentSlide?.speakerNotes || currentSlide?.subtitle || "Slide concept"}`;
                          onExplainInChat(prompt);
                          onClose();
                        }}
                        className="text-[10px] text-muted-foreground hover:text-amber-400 flex items-center gap-1"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        <span>{isIndo ? "Tanya AI" : "Ask AI"}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex-1 bg-[#1a1a1a] rounded-lg p-2 border border-[#282828] text-xs text-muted-foreground overflow-y-auto leading-relaxed">
                    {currentSlide?.speakerNotes ? (
                      <p className="whitespace-pre-wrap">{currentSlide.speakerNotes}</p>
                    ) : (
                      <p className="italic text-muted-foreground/50">
                        {isIndo ? "Tidak ada catatan untuk slide ini." : "No speaker notes for this slide."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Bar for Google Slides */}
            {provider === "slides" && (
              <div className="h-10 px-3 border-t border-[#222222] bg-[#141414] flex items-center justify-between text-xs text-muted-foreground shrink-0">
                <span className="text-[11px] text-amber-400 font-medium">Google Slides</span>
                <div className="flex items-center gap-3">
                  {googleSlidesPptxUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(googleSlidesPptxUrl, "_blank")}
                      className="hover:text-foreground text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      <span>PPTX</span>
                    </button>
                  )}
                  {data.googleSlidesUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(data.googleSlidesUrl, "_blank")}
                      className="hover:text-amber-400 text-[11px] flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>{isIndo ? "Buka di Google Slides" : "Open in Google Slides"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. CANVA ENGINE */}
        {provider === "canva" && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <div className="w-full bg-[#181818] border border-[#2b2b2b] rounded-2xl p-5 flex flex-col items-center text-center shadow-lg">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white mb-3 shadow-md">
                <Presentation className="h-7 w-7" />
              </div>
              <h2 className="text-base font-bold text-foreground mb-1">
                {data.title || "Canva Presentation"}
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                {isIndo
                  ? "Presentasi berhasil dibuat di Canva. Anda dapat mengunduh sebagai PDF/PPTX atau membuka langsung di Canva Editor."
                  : "Presentation created in Canva. You can download as PDF/PPTX or open directly in Canva Editor."}
              </p>

              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => handleExportCanva("pdf")}
                    disabled={isExportingCanva || !data.canvaDesignId}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isExportingCanva ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>{isIndo ? "Unduh PDF" : "Download PDF"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportCanva("pptx")}
                    disabled={isExportingCanva || !data.canvaDesignId}
                    className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isExportingCanva ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>{isIndo ? "Unduh PPTX" : "Download PPTX"}</span>
                  </button>
                </div>

                {data.canvaEditUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(data.canvaEditUrl, "_blank")}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>{isIndo ? "Buka di Canva Editor" : "Open in Canva"}</span>
                  </button>
                )}

                {data.canvaViewUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(data.canvaViewUrl, "_blank")}
                    className="w-full py-2.5 rounded-xl bg-[#282828] hover:bg-[#333333] text-foreground font-medium text-xs flex items-center justify-center gap-2 border border-[#3d3d3d] cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{isIndo ? "Lihat Pratinjau Publik" : "View Public Link"}</span>
                  </button>
                )}
              </div>
            </div>

            {data.canvaThumbnails && data.canvaThumbnails.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                  {isIndo ? "Halaman Desain" : "Slide Thumbnails"}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {data.canvaThumbnails.map((th, idx) => (
                    <div
                      key={idx}
                      className="aspect-[16/9] rounded-xl overflow-hidden border border-[#2b2b2b] bg-[#161616] relative"
                    >
                      <img src={th.url} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-sans tabular-nums px-1 rounded">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
