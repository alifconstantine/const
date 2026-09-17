import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCode,
  Maximize,
  Minimize,
  Presentation,
  FileText,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@const/ui";
import type { SlideDeckData, SlideItem } from "../../lib/db";
import { exportToPptx, exportToPdf, exportToHtml } from "../../lib/studio/pptx-exporter";
import { getTheme } from "../../lib/studio/presentation/themes";
import { SlideContentView } from "../right-pane/slide-content-view";

export interface SlideLightboxProps {
  deck: SlideDeckData;
  initialIndex?: number;
  onClose: () => void;
}

export function SlideLightbox({
  deck,
  initialIndex = 0,
  onClose,
}: SlideLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const slides: SlideItem[] = deck.slides || [];
  const currentSlide: SlideItem | undefined = slides[currentIndex];
  const totalSlides = slides.length;
  const theme = getTheme(deck.themeId);

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, handleNext, handlePrev]);

  const handleDownloadPptx = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsExporting(true);
    try {
      await exportToPptx(deck);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsExporting(true);
    try {
      await exportToPdf(deck);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadHtml = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    exportToHtml(deck);
  };

  if (!currentSlide) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black/92 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-150 select-none text-white font-sans"
      role="dialog"
      aria-modal="true"
      aria-label={deck.title || "Presentation Preview"}
      onClick={onClose}
    >
      {/* Top Floating Control Bar */}
      <div
        className="w-full max-w-6xl flex items-center justify-between z-30 pointer-events-auto shrink-0 mb-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Deck title & Tag */}
        <div className="flex items-center gap-2.5 max-w-[60%]">
          <div className="h-8 w-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-400 shrink-0">
            <Presentation className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate tracking-tight">
              {deck.title}
            </h2>
            <div className="text-[11px] text-[#969696] flex items-center gap-2">
              <span className="capitalize">{currentSlide.layout}</span>
              <span>•</span>
              <span>Slide {currentIndex + 1} of {totalSlides}</span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium" style={{ color: theme.colors.accent }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                {theme.name}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Close Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Unified Download Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isExporting}
                onClick={(e) => e.stopPropagation()}
                className="h-8 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer disabled:opacity-50"
                title="Download Presentation"
              >
                <Download className="h-3.5 w-3.5 text-[#38bdf8]" />
                <span>Export</span>
                <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
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
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">Standard editable slide deck</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDownloadPdf}
                className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
              >
                <FileText className="h-4 w-4 text-[#ef4444] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">Dokumen PDF (.pdf)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">Print-ready 16:9 PDF deck</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDownloadHtml}
                className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
              >
                <FileCode className="h-4 w-4 text-[#f472b6] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">HTML Mandiri (.html)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">Standalone offline presentation</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center transition-colors border border-white/10 cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>

          {/* Prominent Close X Button */}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/20 shadow-lg ml-1"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Center 16:9 Slide Canvas with Left/Right Nav */}
      <div
        className="relative w-full max-w-5xl flex-1 flex items-center justify-center my-auto min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Prev Button */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="absolute left-2 sm:-left-6 z-20 h-11 w-11 rounded-full bg-black/60 hover:bg-black/90 text-white/90 hover:text-white flex items-center justify-center transition-all border border-white/20 shadow-2xl cursor-pointer disabled:opacity-20 disabled:pointer-events-none hover:scale-105 active:scale-95"
          title="Previous Slide (←)"
          aria-label="Previous Slide"
        >
          <ChevronLeft className="h-6 w-6 stroke-[2]" />
        </button>

        {/* 16:9 Slide Surface */}
        <div
          className="w-full aspect-[16/9] max-h-[75vh] rounded-2xl p-6 sm:p-10 md:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden select-text border transition-all"
          style={{
            backgroundColor: theme.colors.bg,
            borderColor: theme.colors.border,
            color: theme.colors.fg,
            fontFamily: theme.fontBody,
          }}
        >
          {/* Top metadata strip */}
          <div
            className="flex items-center justify-between text-xs font-medium tracking-wider uppercase shrink-0 pb-3 border-b"
            style={{
              color: theme.colors.fgMuted,
              borderColor: `${theme.colors.border}80`,
            }}
          >
            <span className="truncate max-w-[70%]" style={{ color: theme.colors.fg }}>{deck.title}</span>
            <span className="font-mono" style={{ fontFamily: theme.fontMono, color: theme.colors.fgMuted }}>
              № {currentSlide.slideNumber || currentIndex + 1} / {totalSlides}
            </span>
          </div>

          {/* Slide Content Body */}
          <div className="flex-1 flex flex-col justify-center py-4 sm:py-6 overflow-y-auto">
            <SlideContentView slide={currentSlide} theme={theme} mode="large" />
          </div>

          {/* Bottom notes / footer strip */}
          <div
            className="flex items-center justify-between text-[11px] pt-3 border-t shrink-0"
            style={{
              color: theme.colors.fgMuted,
              borderColor: `${theme.colors.border}80`,
            }}
          >
            <span className="truncate max-w-[80%]">
              {currentSlide.speakerNotes ? `Catatan: ${currentSlide.speakerNotes}` : "Const Learn Presentation Engine"}
            </span>
            <span className="font-mono" style={{ fontFamily: theme.fontMono }}>16 : 9</span>
          </div>
        </div>

        {/* Floating Next Button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === totalSlides - 1}
          className="absolute right-2 sm:-right-6 z-20 h-11 w-11 rounded-full bg-black/60 hover:bg-black/90 text-white/90 hover:text-white flex items-center justify-center transition-all border border-white/20 shadow-2xl cursor-pointer disabled:opacity-20 disabled:pointer-events-none hover:scale-105 active:scale-95"
          title="Next Slide (→ / Space)"
          aria-label="Next Slide"
        >
          <ChevronRight className="h-6 w-6 stroke-[2]" />
        </button>
      </div>

      {/* Bottom Thumbnail Strip for Fast Jumping */}
      <div
        className="w-full max-w-3xl flex items-center justify-center gap-1.5 py-2 px-3 rounded-full bg-black/60 border border-white/10 backdrop-blur-md shrink-0 mt-2 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {slides.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrentIndex(idx)}
            className={`h-2 transition-all rounded-full cursor-pointer ${
              idx === currentIndex
                ? "w-8"
                : "w-2 bg-white/20 hover:bg-white/40"
            }`}
            style={idx === currentIndex ? { backgroundColor: theme.colors.accent } : undefined}
            title={`Slide ${idx + 1}: ${s.title}`}
          />
        ))}
      </div>
    </div>,
    document.body
  );
}
