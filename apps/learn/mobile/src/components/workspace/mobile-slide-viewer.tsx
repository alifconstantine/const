import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  FileCode,
  Sparkles,
  Plus,
  Trash2,
  Presentation,
  Layers,
  FileText,
  ChevronDown,
} from "lucide-react";
import {
  cn,
  toast,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@const/ui";
import type { SlideDeckData, SlideItem } from "../../lib/db";
import { useI18n } from "../../lib/i18n";
import { exportToPptx, exportToPdf, exportToHtml } from "../../lib/studio/pptx-exporter";

export interface MobileSlideViewerProps {
  deck: SlideDeckData;
  onClose: () => void;
  onExplainInChat?: (prompt: string) => void;
}

export function MobileSlideViewer({
  deck: initialDeck,
  onClose,
  onExplainInChat,
}: MobileSlideViewerProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const [deck, setDeck] = useState<SlideDeckData>(initialDeck);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAddingBullet, setIsAddingBullet] = useState(false);
  const [newBulletText, setNewBulletText] = useState("");

  const slides = deck.slides || [];
  const currentSlide = slides[currentIndex];
  const totalSlides = slides.length;

  // Touch swipe support
  const touchStartXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || !e.changedTouches[0]) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 45) {
      if (diff > 0 && currentIndex < totalSlides - 1) {
        // Swiped left -> Next
        setCurrentIndex((prev) => prev + 1);
      } else if (diff < 0 && currentIndex > 0) {
        // Swiped right -> Prev
        setCurrentIndex((prev) => prev - 1);
      }
    }
    touchStartXRef.current = null;
  };

  const handleNext = useCallback(() => {
    if (currentIndex < totalSlides - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, totalSlides]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleDownloadPptx = async () => {
    setIsExporting(true);
    try {
      await exportToPptx(deck);
      toast.success(isIndo ? "File PPTX berhasil diunduh" : "PPTX downloaded");
    } catch (err: any) {
      toast.error(err?.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      await exportToPdf(deck);
      toast.success(isIndo ? "File PDF berhasil diunduh" : "PDF downloaded");
    } catch (err: any) {
      toast.error(err?.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadHtml = () => {
    try {
      exportToHtml(deck);
      toast.success(isIndo ? "File HTML berhasil diunduh" : "HTML downloaded");
    } catch (err: any) {
      toast.error(err?.message || "Export failed");
    }
  };

  const handleExplain = () => {
    if (!currentSlide || !onExplainInChat) return;
    const prompt = isIndo
      ? `Tolong jelaskan secara mendalam topik slide ${currentIndex + 1}: "${currentSlide.title}" dari presentasi "${deck.title}".
Subtitle: ${currentSlide.subtitle || "-"}
Poin:
${(currentSlide.bullets || []).map((b) => `- ${b}`).join("\n")}`
      : `Please explain slide ${currentIndex + 1}: "${currentSlide.title}" from presentation "${deck.title}".
Subtitle: ${currentSlide.subtitle || "-"}
Points:
${(currentSlide.bullets || []).map((b) => `- ${b}`).join("\n")}`;
    onExplainInChat(prompt);
  };

  // Add bullet element
  const handleAddBulletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBulletText.trim() || !currentSlide) return;

    const updatedSlides = [...slides];
    const targetSlide = { ...currentSlide };
    targetSlide.bullets = [...(targetSlide.bullets || []), newBulletText.trim()];
    updatedSlides[currentIndex] = targetSlide;

    setDeck({ ...deck, slides: updatedSlides });
    setNewBulletText("");
    setIsAddingBullet(false);
    toast.success(isIndo ? "Poin ditambahkan" : "Bullet added");
  };

  // Delete bullet element
  const handleDeleteBullet = (bulletIdx: number) => {
    if (!currentSlide) return;
    const updatedSlides = [...slides];
    const targetSlide = { ...currentSlide };
    targetSlide.bullets = (targetSlide.bullets || []).filter((_, idx) => idx !== bulletIdx);
    updatedSlides[currentIndex] = targetSlide;

    setDeck({ ...deck, slides: updatedSlides });
  };

  // Add a new slide
  const handleAddNewSlide = () => {
    const newSlide: SlideItem = {
      id: `slide_${Date.now()}`,
      slideNumber: totalSlides + 1,
      layout: "bullets",
      title: isIndo ? "Slide Baru" : "New Slide",
      subtitle: isIndo ? "Sub-judul materi" : "Topic subtitle",
      bullets: [
        isIndo ? "Poin utama pertama" : "First key point",
        isIndo ? "Poin utama kedua" : "Second key point",
      ],
    };

    const updatedSlides = [...slides, newSlide];
    setDeck({ ...deck, slides: updatedSlides });
    setCurrentIndex(updatedSlides.length - 1);
    toast.success(isIndo ? "Slide baru ditambahkan" : "New slide added");
  };

  if (!currentSlide || totalSlides === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground font-sans">
        <Presentation className="h-10 w-10 mb-2 opacity-30 text-amber-500" />
        <p className="text-xs font-medium text-foreground">
          {isIndo ? "Tidak ada slide yang tersedia" : "No slides available"}
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#161616] text-[#ffffff] flex flex-col font-sans select-none animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <header className="h-14 px-3.5 border-b border-[#2b2b2b] bg-[#1d1d1f] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div className="h-8 w-8 rounded-xl bg-[#28282e] border border-[#38383e] flex items-center justify-center text-[#fde047] shrink-0">
            <Presentation className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-semibold text-white truncate tracking-tight">
              {deck.title}
            </h1>
            <div className="text-[10px] text-[#969696] flex items-center gap-1.5">
              <span>{currentIndex + 1} / {totalSlides}</span>
              <span>•</span>
              <span className="capitalize">{currentSlide.layout}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Maximize Front-of-screen Overlay */}
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="h-8 w-8 rounded-full bg-[#28282e] hover:bg-[#34343d] text-white flex items-center justify-center transition-colors border border-[#38383e] cursor-pointer"
            title={isIndo ? "Perbesar ke Depan Layar" : "Maximize Lightbox"}
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Unified Download Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isExporting}
                className="h-8 w-8 rounded-full bg-[#28282e] hover:bg-[#34343d] text-[#38bdf8] flex items-center justify-center transition-colors border border-[#38383e] cursor-pointer disabled:opacity-50"
                title={isIndo ? "Unduh Slide" : "Download Deck"}
              >
                <Download className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 bg-[#1e1e24] border-[#38383e] text-white shadow-xl z-50">
              <DropdownMenuItem
                onClick={handleDownloadPptx}
                className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
              >
                <Presentation className="h-4 w-4 text-[#38bdf8] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">PowerPoint (.pptx)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">{isIndo ? "File presentasi PPTX" : "Standard slide deck"}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDownloadPdf}
                className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
              >
                <FileText className="h-4 w-4 text-[#ef4444] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">Dokumen PDF (.pdf)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">{isIndo ? "Dokumen slide 16:9 siap cetak" : "Print-ready 16:9 PDF"}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDownloadHtml}
                className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
              >
                <FileCode className="h-4 w-4 text-[#f472b6] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">HTML Mandiri (.html)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">{isIndo ? "Player slide offline" : "Standalone offline player"}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-[#28282e] hover:bg-[#34343d] text-[#969696] hover:text-white flex items-center justify-center transition-colors border border-[#38383e] cursor-pointer active:scale-95"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Interactive Slide Body */}
      <div
        className="flex-1 overflow-y-auto p-4 flex flex-col justify-between"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 16:9 Slide Surface */}
        <div
          onClick={() => setIsLightboxOpen(true)}
          className="w-full aspect-[16/9] rounded-2xl bg-[#222222] border border-[#383838] p-4 sm:p-6 flex flex-col justify-between shadow-xl relative cursor-pointer active:scale-[0.99] transition-transform"
        >
          {/* Top metadata */}
          <div className="flex items-center justify-between text-[10px] text-[#969696] font-medium tracking-wide uppercase shrink-0 border-b border-white/5 pb-1.5">
            <span className="truncate max-w-[70%]">{deck.title}</span>
            <span className="font-mono">№ {currentIndex + 1} / {totalSlides}</span>
          </div>

          {/* Slide Layout Body */}
          <div className="flex-1 flex flex-col justify-center py-2 overflow-hidden">
            {currentSlide.layout === "hero" ? (
              <div className="text-center space-y-1.5">
                {currentSlide.accentTag && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold uppercase tracking-wider">
                    {currentSlide.accentTag}
                  </span>
                )}
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight line-clamp-3">
                  {currentSlide.title}
                </h2>
                {currentSlide.subtitle && (
                  <p className="text-[11px] text-[#969696] line-clamp-2">
                    {currentSlide.subtitle}
                  </p>
                )}
              </div>
            ) : currentSlide.layout === "numbers" ? (
              <div className="space-y-2">
                <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                  {currentSlide.title}
                </h2>
                <div className="grid grid-cols-2 gap-1.5">
                  {(currentSlide.numbers || []).slice(0, 2).map((num, nIdx) => (
                    <div key={nIdx} className="p-2 rounded-xl bg-[#2b2b2b] border border-[#383838]">
                      <div className="text-lg font-black text-[#38bdf8] font-mono">{num.value}</div>
                      <div className="text-[10px] font-medium text-white truncate">{num.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                  {currentSlide.title}
                </h2>
                <div className="space-y-1">
                  {(currentSlide.bullets || []).slice(0, 3).map((b, bIdx) => (
                    <div
                      key={bIdx}
                      className="p-1.5 rounded-lg bg-[#2b2b2b] border border-[#383838] text-[10px] text-white flex items-center gap-1.5"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-[#38bdf8] shrink-0" />
                      <span className="truncate">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="text-[9px] text-[#707070] border-t border-white/5 pt-1 flex items-center justify-between shrink-0">
            <span className="truncate max-w-[75%]">{currentSlide.speakerNotes || "Const Learn"}</span>
            <span className="font-mono text-[#38bdf8] flex items-center gap-1">
              <Maximize2 className="h-2.5 w-2.5" />
              <span>{isIndo ? "Ketuk Perbesar" : "Tap Maximize"}</span>
            </span>
          </div>
        </div>

        {/* In-Place Slide Bullet Elements Editor */}
        <div className="mt-3 p-3 rounded-2xl bg-[#1d1d1f] border border-[#2b2b2b] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#969696] flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#fde047]" />
              {isIndo ? "Poin Slide Ini" : "Slide Bullets"}
            </span>
            {!isAddingBullet && (
              <button
                type="button"
                onClick={() => setIsAddingBullet(true)}
                className="text-xs text-[#fde047] font-medium flex items-center gap-1 cursor-pointer active:opacity-75"
              >
                <Plus className="h-3 w-3" />
                <span>{isIndo ? "Tambah Poin" : "Add Bullet"}</span>
              </button>
            )}
          </div>

          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
            {(currentSlide.bullets || []).map((b, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-[#222222] border border-[#303030] text-xs text-white"
              >
                <span className="text-[11px] truncate flex-1">• {b}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteBullet(idx)}
                  className="h-5 w-5 rounded text-[#888888] hover:text-red-400 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {isAddingBullet && (
            <form onSubmit={handleAddBulletSubmit} className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={newBulletText}
                onChange={(e) => setNewBulletText(e.target.value)}
                placeholder={isIndo ? "Poin baru..." : "New bullet..."}
                autoFocus
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-[#141416] border border-[#38383e] focus:border-[#fde047] text-xs text-white placeholder-[#66666e] outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#fde047] text-black text-xs font-semibold"
              >
                {isIndo ? "OK" : "OK"}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingBullet(false)}
                className="px-2 py-1.5 rounded-xl bg-[#28282e] text-[#888888] text-xs"
              >
                {isIndo ? "Batal" : "Cancel"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Floating Navigation Toolbar */}
      <footer className="h-16 px-4 border-t border-[#2b2b2b] bg-[#1d1d1f] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="h-9 px-3 rounded-xl bg-[#28282e] text-white text-xs font-medium flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{isIndo ? "Prev" : "Prev"}</span>
        </button>

        {/* Thumbnail Dots */}
        <div className="flex items-center gap-1 max-w-[45%] overflow-x-auto py-1 px-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "h-2 rounded-full transition-all cursor-pointer",
                idx === currentIndex ? "w-5 bg-[#38bdf8]" : "w-1.5 bg-white/20"
              )}
            />
          ))}
          <button
            type="button"
            onClick={handleAddNewSlide}
            className="w-5 h-5 rounded-full bg-[#28282e] text-[#fde047] flex items-center justify-center ml-1"
            title="Tambah Slide"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === totalSlides - 1}
          className="h-9 px-3 rounded-xl bg-[#0066ff] hover:bg-[#0055dd] text-white text-xs font-medium flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none active:scale-95"
        >
          <span>{isIndo ? "Next" : "Next"}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </footer>

      {/* Full Front-of-Screen Lightbox Overlay (Matches ImageLightbox UX) */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-between bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
          role="dialog"
          aria-modal="true"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Bar with Prominent X button */}
          <div className="w-full flex items-center justify-between z-30 pb-2 border-b border-white/10">
            <div className="min-w-0 flex-1 mr-3">
              <span className="text-xs font-semibold text-white truncate block">
                {deck.title}
              </span>
              <span className="text-[10px] text-[#969696]">
                Slide {currentIndex + 1} / {totalSlides}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Unified Download Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isExporting}
                    className="h-8 px-2.5 rounded-xl bg-white/10 text-xs text-white font-medium flex items-center gap-1.5 border border-white/10"
                    title={isIndo ? "Unduh Slide" : "Download Deck"}
                  >
                    <Download className="h-3.5 w-3.5 text-[#38bdf8]" />
                    <span>{isIndo ? "Unduh" : "Download"}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1.5 bg-[#1e1e24] border-[#38383e] text-white shadow-xl z-[120]">
                  <DropdownMenuItem
                    onClick={handleDownloadPptx}
                    className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
                  >
                    <Presentation className="h-4 w-4 text-[#38bdf8] shrink-0" />
                    <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">PowerPoint (.pptx)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">{isIndo ? "File presentasi PPTX" : "Standard slide deck"}</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDownloadPdf}
                    className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
                  >
                    <FileText className="h-4 w-4 text-[#ef4444] shrink-0" />
                    <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">Dokumen PDF (.pdf)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">{isIndo ? "Dokumen slide 16:9 siap cetak" : "Print-ready 16:9 PDF"}</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDownloadHtml}
                    className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
                  >
                    <FileCode className="h-4 w-4 text-[#f472b6] shrink-0" />
                    <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">HTML Mandiri (.html)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">{isIndo ? "Player slide offline" : "Standalone offline player"}</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Prominent Close X */}
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer shadow-lg active:scale-95 border border-white/20"
                aria-label="Tutup Layar Penuh"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Large Centered 16:9 Canvas */}
          <div className="w-full aspect-[16/9] my-auto rounded-2xl bg-[#161616] border border-[#383838] p-5 sm:p-7 flex flex-col justify-between shadow-2xl relative">
            <div className="flex items-center justify-between text-[11px] text-[#969696] uppercase border-b border-white/10 pb-2">
              <span>{deck.title}</span>
              <span>№ {currentIndex + 1} / {totalSlides}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center py-3">
              {currentSlide.layout === "hero" ? (
                <div className="text-center space-y-2">
                  {currentSlide.accentTag && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase">
                      {currentSlide.accentTag}
                    </span>
                  )}
                  <h1 className="text-xl sm:text-2xl font-black text-white leading-snug">
                    {currentSlide.title}
                  </h1>
                  {currentSlide.subtitle && (
                    <p className="text-xs text-[#969696]">{currentSlide.subtitle}</p>
                  )}
                </div>
              ) : currentSlide.layout === "numbers" ? (
                <div className="space-y-3">
                  <h2 className="text-sm sm:text-base font-bold text-white">{currentSlide.title}</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {(currentSlide.numbers || []).slice(0, 2).map((n, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-[#222222] border border-[#383838]">
                        <div className="text-2xl font-black text-[#38bdf8] font-mono">{n.value}</div>
                        <div className="text-xs font-semibold text-white mt-1">{n.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <h2 className="text-sm sm:text-base font-bold text-white">{currentSlide.title}</h2>
                  <div className="space-y-1.5">
                    {(currentSlide.bullets || []).map((b, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-[#222222] border border-[#383838] text-xs text-white flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#38bdf8] shrink-0" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-[#808080] border-t border-white/10 pt-2 flex items-center justify-between">
              <span>{currentSlide.speakerNotes || "Const Learn"}</span>
              <span className="font-mono">16 : 9</span>
            </div>
          </div>

          {/* Bottom Floating Nav in Lightbox */}
          <div className="w-full flex items-center justify-between pt-2 border-t border-white/10 z-30">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="h-10 px-4 rounded-xl bg-white/15 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-20 active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Prev</span>
            </button>

            <span className="text-xs text-[#969696] font-mono">
              {currentIndex + 1} / {totalSlides}
            </span>

            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex === totalSlides - 1}
              className="h-10 px-4 rounded-xl bg-[#0066ff] text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-20 active:scale-95"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
