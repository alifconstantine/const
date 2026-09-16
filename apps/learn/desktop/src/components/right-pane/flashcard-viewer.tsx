import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  Share2,
  MoreVertical,
  HelpCircle,
  Layers,
  Award,
} from "lucide-react";
import { ScrollArea } from "@const/ui";
import type { FlashcardData, FlashcardItem } from "../../lib/db";
import { useI18n } from "../../lib/i18n";

export interface FlashcardViewerProps {
  flashcard: FlashcardData;
  onExplainInChat?: (prompt: string) => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

export function FlashcardViewer({
  flashcard,
  onExplainInChat,
  onToggleExpand,
  isExpanded = false,
}: FlashcardViewerProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const cards: FlashcardItem[] = flashcard.cards || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, "hard" | "medium" | "easy">>({});
  const [isCompleted, setIsCompleted] = useState(false);

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleRate = (rating: "hard" | "medium" | "easy") => {
    if (!currentCard) return;
    setRatings((prev) => ({ ...prev, [currentCard.id]: rating }));
    handleNext();
  };

  const handleRestart = () => {
    setRatings({});
    setIsFlipped(false);
    setCurrentIndex(0);
    setIsCompleted(false);
  };

  const handleExplain = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard || !onExplainInChat) return;

    const promptText = isIndo
      ? `Tolong jelaskan secara komprehensif mengenai konsep flashcard ini:

**Konsep / Istilah**: "${currentCard.front}"
**Definisi / Intisari**: "${currentCard.back}"

Berdasarkan materi sumber di notebook ini, bagaimana penerapan konsep tersebut dan berikan contoh konkret atau analogi yang mudah dipahami.`
      : `Please explain comprehensively this flashcard concept:

**Concept / Term**: "${currentCard.front}"
**Definition / Takeaway**: "${currentCard.back}"

Based on the notebook sources, explain how this concept applies with concrete examples or intuitive analogies.`;

    onExplainInChat(promptText);
  };

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#888888]">
        <Layers className="h-8 w-8 text-[#f472b6] mb-2" />
        <p className="text-xs">{isIndo ? "Flashcard tidak memiliki kartu." : "Flashcards deck is empty."}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#161618] text-[#e0e0e0] select-none font-sans">
      {/* Top Breadcrumb & Expand Bar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#242428] bg-[#1a1a1d] text-xs text-[#888888] shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="hover:text-white transition-colors cursor-pointer">Studio</span>
          <span>&gt;</span>
          <span className="text-white font-medium truncate">
            {flashcard.title || (isIndo ? "Flashcards" : "Flashcards Deck")}
          </span>
        </div>

        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="h-6 w-6 rounded-md hover:bg-white/10 text-[#888888] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Main Title Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between shrink-0 border-b border-[#242428]">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight leading-snug">
            {flashcard.title || (isIndo ? "Kartu Tanya-Jawab" : "Flashcards")}
          </h2>
          <span className="text-[11.5px] text-[#999999] block mt-0.5">
            {isIndo
              ? `${totalCards} kartu berdasarkan ${flashcard.sourceCount || 1} sumber`
              : `${totalCards} cards based on ${flashcard.sourceCount || 1} source(s)`}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[#888888]">
          <button
            type="button"
            className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card Body Area */}
      <ScrollArea className="flex-1 w-full min-h-0" viewportClassName="p-4 sm:p-6 flex flex-col justify-center items-center">
        {!isCompleted && currentCard ? (
          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            {/* Counter */}
            <div className="w-full flex items-center justify-between text-xs text-[#888888]">
              <span className="font-semibold text-white">
                {currentIndex + 1} / {totalCards}
              </span>
              <span className="text-[11px] text-[#777777]">
                {isIndo ? "Klik kartu untuk membalik" : "Click card to flip"}
              </span>
            </div>

            {/* 3D Flip Card Container */}
            <div
              onClick={handleFlip}
              className="w-full min-h-[220px] sm:min-h-[260px] p-6 rounded-2xl bg-[#1d1d22] hover:bg-[#222228] border border-[#2e2e36] hover:border-[#3e3e48] transition-all cursor-pointer shadow-lg flex flex-col justify-between active:scale-[0.99] relative group"
            >
              {/* Card Label Tag */}
              <div className="flex items-center justify-between text-[11px] text-[#888888]">
                <span className="uppercase tracking-wider font-semibold text-[#f472b6]">
                  {isFlipped ? (isIndo ? "Penjelasan / Jawaban" : "Back / Answer") : (isIndo ? "Konsep / Pertanyaan" : "Front / Term")}
                </span>
                <span className="text-[#666666] group-hover:text-[#aaaaaa] transition-colors">
                  {isIndo ? "Balik ⟲" : "Flip ⟲"}
                </span>
              </div>

              {/* Card Main Content */}
              <div className="my-auto py-3">
                {!isFlipped ? (
                  <h3 className="text-base sm:text-lg font-semibold text-white leading-relaxed text-center">
                    {currentCard.front}
                  </h3>
                ) : (
                  <p className="text-xs sm:text-sm text-[#e0e0e0] leading-relaxed text-center">
                    {currentCard.back}
                  </p>
                )}
              </div>

              {/* Card Bottom Hint & AI Explain */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-[11px] text-[#777777] truncate max-w-[200px]">
                  {currentCard.hint ? `💡 ${currentCard.hint}` : ""}
                </span>

                <button
                  type="button"
                  onClick={handleExplain}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#27272e] hover:bg-[#32323b] border border-[#3a3a44] text-[11px] font-medium text-white transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Jelaskan di Chat"
                >
                  <Sparkles className="h-3 w-3 text-[#5eead4]" />
                  <span>{isIndo ? "Jelaskan" : "Explain"}</span>
                </button>
              </div>
            </div>

            {/* Self-Rating Buttons (Shown on Back) */}
            {isFlipped && (
              <div className="w-full flex items-center justify-center gap-2 pt-1 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => handleRate("hard")}
                  className="flex-1 py-1.5 rounded-xl bg-[#2b181a] hover:bg-[#381c1f] border border-[#ef4444]/40 text-xs text-[#ef4444] font-medium transition-colors cursor-pointer"
                >
                  {isIndo ? "Belum Paham" : "Hard"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRate("medium")}
                  className="flex-1 py-1.5 rounded-xl bg-[#282516] hover:bg-[#36321b] border border-[#f59e0b]/40 text-xs text-[#f59e0b] font-medium transition-colors cursor-pointer"
                >
                  {isIndo ? "Ragu-ragu" : "Good"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRate("easy")}
                  className="flex-1 py-1.5 rounded-xl bg-[#14261d] hover:bg-[#193326] border border-[#10b981]/40 text-xs text-[#10b981] font-medium transition-colors cursor-pointer"
                >
                  {isIndo ? "Sudah Paham" : "Easy"}
                </button>
              </div>
            )}

            {/* Previous & Next controls */}
            <div className="w-full flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={handlePrev}
                className="px-3.5 py-1.5 rounded-xl bg-[#202024] hover:bg-[#28282e] disabled:opacity-40 disabled:pointer-events-none border border-[#2f2f35] text-xs font-medium text-[#d4d4d4] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>{isIndo ? "Sebelumnya" : "Previous"}</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-1.5 rounded-xl bg-[#0066ff] hover:bg-[#1a75ff] text-xs font-semibold text-white transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
              >
                <span>
                  {currentIndex === totalCards - 1
                    ? isIndo
                      ? "Selesai"
                      : "Finish"
                    : isIndo
                    ? "Berikutnya"
                    : "Next"}
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Completion Screen */
          <div className="w-full max-w-md mx-auto text-center py-8 space-y-4 animate-in fade-in duration-200">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-[#2d1e2a] border border-[#f472b6]/50 flex items-center justify-center text-[#f472b6] shadow-lg">
              <Award className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white">
                {isIndo ? "Sesi Flashcard Selesai!" : "Flashcards Session Complete!"}
              </h3>
              <p className="text-xs text-[#888888] mt-1">
                {isIndo
                  ? `Anda telah meninjau seluruh ${totalCards} kartu materi ini.`
                  : `You've reviewed all ${totalCards} cards.`}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl bg-[#232328] hover:bg-[#2c2c33] border border-[#383842] text-xs font-medium text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isIndo ? "Ulangi Kartu" : "Review Again"}</span>
              </button>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
