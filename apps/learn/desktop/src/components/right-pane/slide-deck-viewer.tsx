import React, { useState, useEffect } from "react";
import {
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
import { getTheme } from "../../lib/studio/presentation/themes";
import { SlideLightbox } from "../workspace/slide-lightbox";
import { SlideContentView } from "./slide-content-view";

export interface SlideDeckViewerProps {
  deck: SlideDeckData;
  onExplainInChat?: (prompt: string) => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

export function SlideDeckViewer({
  deck: initialDeck,
  onExplainInChat,
  onToggleExpand,
  isExpanded = false,
}: SlideDeckViewerProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  // Editable local deck state
  const [deck, setDeck] = useState<SlideDeckData>(initialDeck);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAddingBullet, setIsAddingBullet] = useState(false);
  const [newBulletText, setNewBulletText] = useState("");

  // Keep state in sync if parent passes updated deck
  useEffect(() => {
    setDeck(initialDeck);
  }, [initialDeck]);

  const slides = deck.slides || [];
  const currentSlide = slides[currentSlideIndex];
  const totalSlides = slides.length;
  const theme = getTheme(deck.themeId);

  const handleNext = () => {
    if (currentSlideIndex < totalSlides - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
    }
  };

  const handleDownloadPptx = async () => {
    setIsExporting(true);
    try {
      await exportToPptx(deck);
      toast.success(isIndo ? "File PPTX berhasil diunduh" : "PPTX exported successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export PPTX");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      await exportToPdf(deck);
      toast.success(isIndo ? "File PDF presentasi berhasil diunduh" : "PDF presentation exported successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadHtml = () => {
    try {
      exportToHtml(deck);
      toast.success(isIndo ? "File HTML presentasi berhasil diunduh" : "HTML deck exported successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export HTML");
    }
  };

  const handleExplain = () => {
    if (!currentSlide || !onExplainInChat) return;
    const prompt = isIndo
      ? `Tolong jelaskan secara mendalam mengenai topik pada slide ${currentSlideIndex + 1}: "${currentSlide.title}" dari presentasi "${deck.title}".
Subtitle: ${currentSlide.subtitle || "-"}
Poin:
${(currentSlide.bullets || []).map((b) => `- ${b}`).join("\n")}
Bagaimana konteks detailnya dan berikan contoh penerapannya?`
      : `Please explain in detail the topic on slide ${currentSlideIndex + 1}: "${currentSlide.title}" from the presentation "${deck.title}".
Subtitle: ${currentSlide.subtitle || "-"}
Points:
${(currentSlide.bullets || []).map((b) => `- ${b}`).join("\n")}
What are the detailed nuances and practical examples?`;
    onExplainInChat(prompt);
  };

  // Add bullet element
  const handleAddBulletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBulletText.trim() || !currentSlide) return;

    const updatedSlides = [...slides];
    const targetSlide = { ...currentSlide };
    targetSlide.bullets = [...(targetSlide.bullets || []), newBulletText.trim()];
    updatedSlides[currentSlideIndex] = targetSlide;

    setDeck({ ...deck, slides: updatedSlides });
    setNewBulletText("");
    setIsAddingBullet(false);
    toast.success(isIndo ? "Poin baru ditambahkan ke slide" : "New bullet added to slide");
  };

  // Delete bullet element
  const handleDeleteBullet = (bulletIdx: number) => {
    if (!currentSlide) return;
    const updatedSlides = [...slides];
    const targetSlide = { ...currentSlide };
    targetSlide.bullets = (targetSlide.bullets || []).filter((_, idx) => idx !== bulletIdx);
    updatedSlides[currentSlideIndex] = targetSlide;

    setDeck({ ...deck, slides: updatedSlides });
  };

  // Add a new blank slide
  const handleAddNewSlide = () => {
    const newSlide: SlideItem = {
      id: `slide_${Date.now()}`,
      slideNumber: totalSlides + 1,
      layout: "bullets",
      title: isIndo ? "Slide Baru" : "New Slide",
      subtitle: isIndo ? "Keterangan pokok materi" : "Core topic subtitle",
      bullets: [
        isIndo ? "Poin pembahasan pertama" : "First key point",
        isIndo ? "Poin pembahasan kedua" : "Second key point",
      ],
    };

    const updatedSlides = [...slides, newSlide];
    setDeck({ ...deck, slides: updatedSlides });
    setCurrentSlideIndex(updatedSlides.length - 1);
    toast.success(isIndo ? "Slide baru ditambahkan" : "New slide added");
  };

  if (!currentSlide || totalSlides === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground font-sans">
        <Presentation className="h-10 w-10 stroke-[1.5] mb-2 opacity-30 text-amber-500" />
        <p className="text-xs font-medium text-foreground">
          {isIndo ? "Tidak ada slide yang tersedia" : "No slides available"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#161616] text-[#ffffff] font-sans select-none overflow-hidden relative">
      {/* Top Action Header */}
      <div className="h-12 px-4 border-b border-[#2b2b2b] bg-[#1d1d1f] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div className="h-7 w-7 rounded-lg bg-[#28282e] border border-[#38383e] flex items-center justify-center text-[#fde047] shrink-0">
            <Presentation className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xs font-semibold text-white truncate tracking-tight">
              {deck.title}
            </h2>
            <div className="text-[10px] text-[#969696] flex items-center gap-1.5">
              <span>{totalSlides} {isIndo ? "slide" : "slides"}</span>
              <span>•</span>
              <span className="capitalize">{currentSlide.layout}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: theme.colors.accent }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                {theme.name}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Ask AI */}
          {onExplainInChat && (
            <button
              type="button"
              onClick={handleExplain}
              className="h-7 px-2.5 rounded-lg bg-[#28282e] hover:bg-[#34343d] text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors border border-[#38383e] cursor-pointer"
              title={isIndo ? "Tanya AI mengenai slide ini" : "Ask AI about this slide"}
            >
              <Sparkles className="h-3 w-3 text-[#fde047]" />
              <span className="hidden sm:inline">{isIndo ? "Tanya AI" : "Ask AI"}</span>
            </button>
          )}

          {/* Unified Download Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isExporting}
                className="h-7 px-2.5 rounded-lg bg-[#28282e] hover:bg-[#34343d] text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors border border-[#38383e] cursor-pointer disabled:opacity-50"
                title={isIndo ? "Unduh Slide Presentasi" : "Download Slide Deck"}
              >
                <Download className="h-3 w-3 text-[#38bdf8]" />
                <span className="hidden sm:inline">{isIndo ? "Unduh" : "Download"}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
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
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">{isIndo ? "File presentasi Microsoft PPTX" : "Standard slide deck"}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDownloadPdf}
                className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
              >
                <FileText className="h-4 w-4 text-[#ef4444] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">Dokumen PDF (.pdf)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">{isIndo ? "Dokumen slide 16:9 siap cetak" : "Print-ready 16:9 PDF deck"}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDownloadHtml}
                className="cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-md hover:bg-white/10 text-white focus:bg-white/10 focus:text-white"
              >
                <FileCode className="h-4 w-4 text-[#f472b6] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-[12px] leading-tight">HTML Mandiri (.html)</span>
                  <span className="text-[10px] text-[#969696] leading-tight mt-0.5">{isIndo ? "Player slide interaktif offline" : "Standalone offline presentation"}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Maximize to Lightbox (Front-of-screen overlay) */}
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="h-7 w-7 rounded-lg bg-[#28282e] hover:bg-[#34343d] text-white flex items-center justify-center transition-colors border border-[#38383e] cursor-pointer ml-0.5"
            title={isIndo ? "Perbesar ke Depan Layar (Fullscreen Preview)" : "Expand into Lightbox Preview"}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Slide Viewer Canvas */}
      <div className="flex-1 flex flex-col justify-between p-4 overflow-y-auto">
        {/* 16:9 Canvas Area */}
        <div
          onClick={() => setIsLightboxOpen(true)}
          className="w-full aspect-[16/9] rounded-2xl p-5 sm:p-7 flex flex-col justify-between shadow-xl relative cursor-pointer group transition-all"
          style={{
            backgroundColor: theme.colors.bg,
            borderColor: theme.colors.border,
            borderWidth: "1px",
            borderStyle: "solid",
            color: theme.colors.fg,
            fontFamily: theme.fontBody,
          }}
          title={isIndo ? "Klik untuk memperbesar ke depan layar" : "Click to maximize"}
        >
          {/* Subtle expand indicator icon on top right */}
          <div
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-md text-[10px] flex items-center gap-1 border shadow-sm"
            style={{
              backgroundColor: `${theme.colors.bg}d9`,
              borderColor: theme.colors.border,
              color: theme.colors.fg,
            }}
          >
            <Maximize2 className="h-3 w-3" />
            <span>{isIndo ? "Klik Perbesar" : "Maximize"}</span>
          </div>

          {/* Slide Header */}
          <div
            className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider shrink-0 pb-2 border-b"
            style={{
              color: theme.colors.fgMuted,
              borderColor: `${theme.colors.border}80`,
            }}
          >
            <span className="truncate max-w-[70%]">{deck.title}</span>
            <span className="font-mono" style={{ fontFamily: theme.fontMono }}>
              № {currentSlideIndex + 1} / {totalSlides}
            </span>
          </div>

          {/* Slide Layout Content */}
          <div className="flex-1 flex flex-col justify-center py-2 overflow-hidden">
            <SlideContentView slide={currentSlide} theme={theme} mode="compact" />
          </div>

          {/* Slide Footer */}
          <div
            className="flex items-center justify-between text-[10px] border-t pt-1.5 shrink-0"
            style={{
              color: theme.colors.fgMuted,
              borderColor: `${theme.colors.border}80`,
            }}
          >
            <span className="truncate max-w-[80%]">
              {currentSlide.speakerNotes ? `Catatan: ${currentSlide.speakerNotes}` : "Const Learn Presentation"}
            </span>
            <span className="font-mono" style={{ fontFamily: theme.fontMono }}>16 : 9</span>
          </div>
        </div>

        {/* In-Place Slide Elements Manager (Add/Remove Bullet & Element) */}
        <div className="mt-3 p-3 rounded-xl bg-[#1d1d1f] border border-[#2b2b2b] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#969696] flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#fde047]" />
              {isIndo ? "Elemen Poin Slide Ini" : "Slide Bullet Elements"}
            </span>
            {!isAddingBullet && (
              <button
                type="button"
                onClick={() => setIsAddingBullet(true)}
                className="text-[11px] text-[#fde047] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>{isIndo ? "Tambah Poin" : "Add Bullet"}</span>
              </button>
            )}
          </div>

          {/* Bullets editor list */}
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {(currentSlide.bullets || []).map((bullet, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[#222222] border border-[#303030] text-xs text-white"
              >
                <span className="text-[11px] truncate flex-1">• {bullet}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteBullet(idx)}
                  className="h-5 w-5 rounded hover:bg-red-500/20 text-[#888888] hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                  title={isIndo ? "Hapus poin ini" : "Remove this bullet"}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Inline Add Bullet Input */}
          {isAddingBullet && (
            <form onSubmit={handleAddBulletSubmit} className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={newBulletText}
                onChange={(e) => setNewBulletText(e.target.value)}
                placeholder={isIndo ? "Tuliskan poin penjelasan baru..." : "Enter new bullet point text..."}
                autoFocus
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#141416] border border-[#38383e] focus:border-[#fde047] text-xs text-white placeholder-[#66666e] outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-[#fde047] hover:bg-[#facc15] text-black text-xs font-medium cursor-pointer"
              >
                {isIndo ? "Simpan" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingBullet(false)}
                className="px-2 py-1.5 rounded-lg bg-[#28282e] text-[#888888] hover:text-white text-xs cursor-pointer"
              >
                {isIndo ? "Batal" : "Cancel"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Navigation Toolbar */}
      <div className="h-12 px-4 border-t border-[#2b2b2b] bg-[#1d1d1f] flex items-center justify-between shrink-0">
        {/* Prev Slide Button */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentSlideIndex === 0}
          className="h-8 px-2.5 rounded-lg bg-[#28282e] hover:bg-[#34343d] text-white text-xs font-medium flex items-center gap-1 transition-colors border border-[#38383e] cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{isIndo ? "Sebelumnya" : "Prev"}</span>
        </button>

        {/* Thumbnails fast jump carousel */}
        <div className="flex items-center gap-1 max-w-[50%] overflow-x-auto py-1 px-1">
          {slides.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlideIndex(idx)}
              className={`h-6 px-2 rounded-md text-[10px] font-mono transition-all cursor-pointer ${
                idx === currentSlideIndex
                  ? "bg-[#38bdf8] text-black font-bold"
                  : "bg-[#28282e] text-[#888888] hover:text-white hover:bg-[#34343d]"
              }`}
            >
              {idx + 1}
            </button>
          ))}
          {/* Add Slide Button */}
          <button
            type="button"
            onClick={handleAddNewSlide}
            className="h-6 w-6 rounded-md bg-[#28282e] hover:bg-[#34343d] text-[#fde047] flex items-center justify-center transition-colors cursor-pointer border border-[#38383e]"
            title={isIndo ? "Tambah slide baru" : "Add new slide"}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Next Slide Button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={currentSlideIndex === totalSlides - 1}
          className="h-8 px-2.5 rounded-lg bg-[#0066ff] hover:bg-[#0055dd] text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        >
          <span className="hidden sm:inline">{isIndo ? "Selanjutnya" : "Next"}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Front-of-screen Lightbox overlay */}
      {isLightboxOpen && (
        <SlideLightbox
          deck={deck}
          initialIndex={currentSlideIndex}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </div>
  );
}
