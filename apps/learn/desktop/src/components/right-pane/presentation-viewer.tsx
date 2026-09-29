import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Maximize2,
  Download,
  Presentation,
  FileCode,
  FileText,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Bot,
  MessageSquare,
  CheckCircle2,
  RotateCw,
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

export interface PresentationViewerProps {
  artifact?: LocalArtifact;
  data: SlideDeckData;
  onExplainInChat?: (prompt: string) => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

export function PresentationViewer({
  artifact,
  data,
  onExplainInChat,
  onToggleExpand: _onToggleExpand,
  isExpanded: _isExpanded = false,
}: PresentationViewerProps) {
  const { t } = useI18n();

  const provider = data.provider || "native";
  const slides: SlideItem[] = useMemo(() => data.slides || [], [data.slides]);
  const totalSlides = slides.length || data.slideCount || 0;

  // Active slide state (1-indexed for display, 0-indexed for logic)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // PDF URL & rendering state
  const initialPdfUrl = useMemo(() => {
    if (data.pdfUrl) return data.pdfUrl;
    if (data.pdfPath) return `const-media://file/${data.pdfPath.replace(/\\/g, "/")}`;
    return "";
  }, [data.pdfUrl, data.pdfPath]);

  const [pdfUrl, setPdfUrl] = useState<string>(initialPdfUrl);
  const [isRenderingPdf, setIsRenderingPdf] = useState<boolean>(
    provider === "native" && !initialPdfUrl && data.renderingStatus !== "error"
  );
  const [renderError, setRenderError] = useState<string | null>(
    data.renderingStatus === "error"
      ? data.renderingError || t("failedRenderPdf")
      : null
  );

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Re-generate HTML content if not provided or to ensure theme consistency
  const presentationHtml = useMemo(() => {
    if (data.htmlContent && data.htmlContent.trim().length > 100) {
      return data.htmlContent;
    }
    if (slides.length > 0) {
      return buildPresentationHtml({
        title: data.title,
        topic: data.topic,
        language: data.language,
        themeId: data.themeId as any,
        lengthMode: data.lengthMode || "auto",
        slides,
      });
    }
    return "";
  }, [data.htmlContent, data.title, data.topic, data.language, data.themeId, slides]);

  // Sync PDF status
  useEffect(() => {
    if (data.pdfUrl) {
      setPdfUrl(data.pdfUrl);
      setIsRenderingPdf(false);
      setRenderError(null);
    } else if (data.pdfPath) {
      setPdfUrl(`const-media://file/${data.pdfPath.replace(/\\/g, "/")}`);
      setIsRenderingPdf(false);
      setRenderError(null);
    } else if (data.renderingStatus === "error") {
      setRenderError(
        data.renderingError || t("failedRenderPdf")
      );
      setIsRenderingPdf(false);
    }
  }, [data.pdfUrl, data.pdfPath, data.renderingStatus, data.renderingError, t]);

  // Check disk for rendered PDF via Electron IPC
  useEffect(() => {
    if (provider !== "native" || pdfUrl) return;

    let isMounted = true;
    const checkDisk = async () => {
      const electron = (window as any).electron;
      if (!electron?.presentation?.checkStatus) return;

      try {
        const res = await electron.presentation.checkStatus({
          learnId: data.learnId || artifact?.learnId || "default",
          artifactId: data.id || artifact?.id || "",
          pdfPath: data.pdfPath,
        });

        if (!isMounted) return;

        if (res?.success && res.exists && res.pdfUrl) {
          setPdfUrl(res.pdfUrl);
          data.pdfUrl = res.pdfUrl;
          if (res.pdfPath) data.pdfPath = res.pdfPath;
          data.renderingStatus = "completed";
          setIsRenderingPdf(false);
          setRenderError(null);
        }
      } catch (err) {
        console.error("Failed to check presentation PDF status:", err);
      }
    };

    checkDisk();
    const interval = setInterval(checkDisk, 2000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (isMounted && isRenderingPdf && !pdfUrl) {
        setIsRenderingPdf(false);
      }
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [provider, pdfUrl, data, artifact, isRenderingPdf]);

  // Send slide navigation message to iframe
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

  // Listen to slide changes from iframe postMessage
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "SLIDE_CHANGED" && typeof e.data.index === "number") {
        setCurrentSlideIndex(e.data.index);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Fullscreen handler
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

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Downloads
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
    toast.success(t("presentationHtmlDownloaded"));
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) {
      toast.error(t("pdfRenderingWait"));
      return;
    }
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${data.title || "presentation"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(t("presentationPdfDownloaded"));
  };

  const handleTriggerPdfExport = async () => {
    const electron = (window as any).electron;
    if (!electron?.presentation?.exportPdf) {
      toast.error(t("pdfExportRequiresDesktop"));
      return;
    }

    try {
      setIsRenderingPdf(true);
      setRenderError(null);
      toast.info(t("startingPdfExport"));

      const res = await electron.presentation.exportPdf({
        learnId: data.learnId || artifact?.learnId || "default",
        artifactId: data.id || artifact?.id || `deck_${Date.now()}`,
        htmlContent: presentationHtml,
        htmlPath: data.htmlPath,
      });

      if (res?.success && res.pdfUrl) {
        setPdfUrl(res.pdfUrl);
        data.pdfUrl = res.pdfUrl;
        if (res.pdfPath) data.pdfPath = res.pdfPath;
        setIsRenderingPdf(false);
        toast.success(t("pdfReady"));
      } else {
        throw new Error(res?.error || "Export failed");
      }
    } catch (err: any) {
      console.error("PDF export error:", err);
      setIsRenderingPdf(false);
      setRenderError(err?.message || "PDF Export failed");
      toast.error(t("failedExportPdf", { error: err.message || t("errorOccurred") }));
    }
  };

  // Canva Export handler
  const [isExportingCanva, setIsExportingCanva] = useState(false);

  const handleExportCanva = async (format: "pdf" | "pptx") => {
    if (!data.canvaDesignId) {
      toast.error(t("canvaDesignNotFound"));
      return;
    }
    setIsExportingCanva(true);
    toast.info(t("startingCanvaExport", { format: format.toUpperCase() }));
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
        toast.success(t("canvaExportSuccess", { format: format.toUpperCase() }));
      } else {
        throw new Error(res.error || "Export URL not available");
      }
    } catch (err: any) {
      console.error("Canva export error:", err);
      toast.error(t("failedExportCanva", { error: err.message || t("errorOccurred") }));
    } finally {
      setIsExportingCanva(false);
    }
  };

  // Keyboard navigation for slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        if (currentSlideIndex < slides.length - 1) {
          e.preventDefault();
          goToSlide(currentSlideIndex + 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (currentSlideIndex > 0) {
          e.preventDefault();
          goToSlide(currentSlideIndex - 1);
        }
      } else if (e.key.toLowerCase() === "n") {
        setShowNotes((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, slides.length]);

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

  const googleSlidesPdfUrl = useMemo(() => {
    if (data.googleSlidesUrl) {
      return data.googleSlidesUrl.replace(/\/edit.*$/, "/export/pdf");
    }
    return "";
  }, [data.googleSlidesUrl]);

  const currentSlide = slides[currentSlideIndex] || slides[0];

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full w-full bg-[#121212] text-foreground select-none relative overflow-hidden",
        isFullscreen && "fixed inset-0 z-50 p-6 bg-black"
      )}
    >
      {/* Top Header Bar */}
      <div className="h-11 px-3 border-b border-[#242424] bg-[#161616] flex items-center justify-between shrink-0 gap-2">
        {/* Title and Provider Pill */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Presentation className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground truncate max-w-[180px] sm:max-w-[240px]">
            {data.title || t("presentation")}
          </span>

          <span
            className={cn(
              "text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-full border shrink-0",
              provider === "native" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
              provider === "canva" && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
              provider === "slides" && "bg-amber-500/10 text-amber-400 border-amber-500/20"
            )}
          >
            {provider === "native"
              ? "Const Native (16:9)"
              : provider === "canva"
              ? "Canva"
              : "Google Slides"}
          </span>

          {totalSlides > 0 && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
              {totalSlides === 1 ? t("slidesCountSingle") : t("slidesCount", { count: totalSlides })}
            </span>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* PDF Status / Progress indicator */}
          {provider === "native" && isRenderingPdf && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 px-2 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/20">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">
                {t("renderingPdf")}
              </span>
            </div>
          )}

          {provider === "native" && pdfUrl && !isRenderingPdf && (
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-emerald-400/90 font-sans font-medium">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              PDF Ready
            </span>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="h-7 w-7 rounded-lg hover:bg-[#252525] text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          {/* Download & Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 px-2.5 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] text-foreground text-xs font-medium border border-[#333333] flex items-center gap-1.5 transition-colors cursor-pointer"
                title={t("exportAndDownload")}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("export")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1 bg-[#1e1e1e] border-[#2e2e2e]">
              {provider === "native" && (
                <>
                  <DropdownMenuItem
                    className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground hover:bg-[#2a2a2a]"
                    onClick={handleDownloadPdf}
                    disabled={!pdfUrl && isRenderingPdf}
                  >
                    <FileText className="h-3.5 w-3.5 text-red-400" />
                    <span>{t("downloadPdf169")}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground hover:bg-[#2a2a2a]"
                    onClick={handleDownloadHtml}
                  >
                    <FileCode className="h-3.5 w-3.5 text-blue-400" />
                    <span>{t("downloadHtmlDeck")}</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-[#2e2e2e]" />

                  <DropdownMenuItem
                    className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-[#2a2a2a]"
                    onClick={handleTriggerPdfExport}
                    disabled={isRenderingPdf}
                  >
                    <RotateCw className={cn("h-3.5 w-3.5", isRenderingPdf && "animate-spin")} />
                    <span>{t("rerenderPdf")}</span>
                  </DropdownMenuItem>
                </>
              )}

              {provider === "canva" && (
                <>
                  <DropdownMenuItem
                    className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground hover:bg-[#2a2a2a]"
                    onClick={() => handleExportCanva("pdf")}
                    disabled={isExportingCanva || !data.canvaDesignId}
                  >
                    <FileText className="h-3.5 w-3.5 text-red-400" />
                    <span>{t("downloadPdfFromCanva")}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground hover:bg-[#2a2a2a]"
                    onClick={() => handleExportCanva("pptx")}
                    disabled={isExportingCanva || !data.canvaDesignId}
                  >
                    <Presentation className="h-3.5 w-3.5 text-orange-400" />
                    <span>{t("downloadPptxFromCanva")}</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-[#2e2e2e]" />

                  {data.canvaEditUrl && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground hover:bg-[#2a2a2a]"
                      onClick={() => window.open(data.canvaEditUrl, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{t("openInCanvaEditor")}</span>
                    </DropdownMenuItem>
                  )}
                  {data.canvaViewUrl && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground hover:bg-[#2a2a2a]"
                      onClick={() => window.open(data.canvaViewUrl, "_blank")}
                    >
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{t("viewPublicDesign")}</span>
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {provider === "slides" && (
                <>
                  {data.googleSlidesUrl && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground hover:bg-[#2a2a2a]"
                      onClick={() => window.open(data.googleSlidesUrl, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
                      <span>{t("openInGoogleSlides")}</span>
                    </DropdownMenuItem>
                  )}
                  {googleSlidesPptxUrl && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground hover:bg-[#2a2a2a]"
                      onClick={() => window.open(googleSlidesPptxUrl, "_blank")}
                    >
                      <Download className="h-3.5 w-3.5 text-orange-400" />
                      <span>{t("downloadPowerPointPptx")}</span>
                    </DropdownMenuItem>
                  )}
                  {googleSlidesPdfUrl && (
                    <DropdownMenuItem
                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center gap-2 text-foreground hover:bg-[#2a2a2a]"
                      onClick={() => window.open(googleSlidesPdfUrl, "_blank")}
                    >
                      <FileText className="h-3.5 w-3.5 text-red-400" />
                      <span>{t("downloadPdfFile")}</span>
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Presentation Stage */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0c] overflow-hidden">
        {/* Render Error Banner if any */}
        {renderError && (
          <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{renderError}</span>
          </div>
        )}

        {/* 1. NATIVE & GOOGLE SLIDES ENGINE VIEW */}
        {(provider === "native" || provider === "slides") && (
          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* 16:9 Canvas Viewport */}
            <div className="flex-1 relative flex items-center justify-center p-2 sm:p-4 bg-[#0a0a0a] overflow-hidden">
              <div
                className="w-full max-w-full aspect-[16/9] max-h-full bg-[#141414] rounded-xl overflow-hidden shadow-2xl border border-[#262626] relative"
              >
                {presentationHtml ? (
                  <iframe
                    ref={iframeRef}
                    title="Const Presentation Canvas"
                    srcDoc={presentationHtml}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    className="w-full h-full border-0 rounded-xl bg-black"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                    <p className="text-xs">
                      {t("loadingPresentationSlides")}
                    </p>
                  </div>
                )}

                {/* Floating Navigation Controls Overlay */}
                {slides.length > 0 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#181818]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg text-xs z-20">
                    <button
                      type="button"
                      onClick={() => goToSlide(currentSlideIndex - 1)}
                      disabled={currentSlideIndex <= 0}
                      className="h-6 w-6 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer text-foreground"
                      title={t("prevSlide") + " (←)"}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="font-sans tabular-nums text-[11px] text-foreground/90 font-medium px-1 select-none">
                      {currentSlideIndex + 1} / {slides.length}
                    </span>

                    <button
                      type="button"
                      onClick={() => goToSlide(currentSlideIndex + 1)}
                      disabled={currentSlideIndex >= slides.length - 1}
                      className="h-6 w-6 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer text-foreground"
                      title={t("nextSlide") + " (→ / Space)"}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <div className="w-px h-3 bg-white/15 mx-0.5" />

                    <button
                      type="button"
                      onClick={() => setShowNotes(!showNotes)}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer border",
                        showNotes
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground border-transparent"
                      )}
                      title={t("toggleSpeakerNotes")}
                    >
                      Notes
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Speaker Notes Drawer (ONLY displayed when toggled on - NO slide thumbnails!) */}
            {showNotes && (
              <div className="h-44 sm:h-52 border-t border-[#222222] bg-[#141414] transition-all duration-200 shrink-0 flex flex-col">
                <div className="flex-1 flex flex-col p-3 min-h-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t("speakerNotesSlide", {
                        slide: currentSlideIndex + 1,
                        title: currentSlide?.title || "",
                      })}
                    </span>
                    {onExplainInChat && (
                      <button
                        type="button"
                        onClick={() => {
                          const prompt = t("explainSlidePrompt", {
                            title: currentSlide?.title || "",
                            notes: currentSlide?.speakerNotes || currentSlide?.subtitle || "",
                          });
                          onExplainInChat(prompt);
                        }}
                        className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Bot className="h-3 w-3" />
                        <span>{t("askAiAboutSlide")}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex-1 bg-[#1a1a1a] rounded-lg p-2.5 border border-[#282828] text-xs text-muted-foreground/90 overflow-y-auto leading-relaxed">
                    {currentSlide?.speakerNotes ? (
                      <p className="whitespace-pre-wrap">{currentSlide.speakerNotes}</p>
                    ) : (
                      <p className="italic text-muted-foreground/50">
                        {t("noSpeakerNotes")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Bar for Google Slides */}
            {provider === "slides" && (
              <div className="h-10 px-4 border-t border-[#222222] bg-[#141414] flex items-center justify-between text-xs text-muted-foreground shrink-0">
                <span className="flex items-center gap-1.5 font-medium text-amber-400">
                  <Presentation className="h-3.5 w-3.5" />
                  Google Slides Document
                </span>
                <div className="flex items-center gap-3">
                  {googleSlidesPptxUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(googleSlidesPptxUrl, "_blank")}
                      className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      <span>PPTX</span>
                    </button>
                  )}
                  {googleSlidesPdfUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(googleSlidesPdfUrl, "_blank")}
                      className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      <span>PDF</span>
                    </button>
                  )}
                  {data.googleSlidesUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(data.googleSlidesUrl, "_blank")}
                      className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1 font-medium"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>{t("openInGoogleSlides")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. CANVA ENGINE VIEW */}
        {provider === "canva" && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto w-full flex flex-col items-center text-center">
              {/* Canva Header Card */}
              <div className="w-full bg-[#181818] border border-[#2b2b2b] rounded-2xl p-6 sm:p-8 flex flex-col items-center mb-6 shadow-xl">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-lg">
                  <Presentation className="h-8 w-8" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-2">
                  {data.title || "Canva Presentation"}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
                  {t("canvaSuccessDesc")}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleExportCanva("pdf")}
                    disabled={isExportingCanva || !data.canvaDesignId}
                    className="px-5 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    {isExportingCanva ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>{t("downloadPdf")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportCanva("pptx")}
                    disabled={isExportingCanva || !data.canvaDesignId}
                    className="px-5 py-2.5 rounded-xl bg-orange-600/90 hover:bg-orange-600 text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    {isExportingCanva ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>{t("downloadPptx")}</span>
                  </button>

                  {data.canvaEditUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(data.canvaEditUrl, "_blank")}
                      className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>{t("openInCanvaEditor")}</span>
                    </button>
                  )}

                  {data.canvaViewUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(data.canvaViewUrl, "_blank")}
                      className="px-5 py-2.5 rounded-xl bg-[#282828] hover:bg-[#333333] text-foreground font-medium text-xs sm:text-sm flex items-center gap-2 border border-[#3d3d3d] transition-all cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                      <span>{t("viewPublicLink")}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Canva Thumbnails Grid if present */}
              {data.canvaThumbnails && data.canvaThumbnails.length > 0 && (
                <div className="w-full">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-left">
                    {t("canvaSlidePreviews")}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {data.canvaThumbnails.map((thumb, idx) => (
                      <div
                        key={idx}
                        className="aspect-[16/9] rounded-xl overflow-hidden border border-[#2b2b2b] bg-[#161616] relative group"
                      >
                        <img
                          src={thumb.url}
                          alt={`Canva slide ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] font-sans tabular-nums px-1.5 py-0.5 rounded">
                          Slide #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
