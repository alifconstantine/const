import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Bot,
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
  const { t } = useI18n();

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

    const promptText = t("explainFlashcardPrompt", {
      front: currentCard.front,
      back: currentCard.back,
    });

    onExplainInChat(promptText);
  };

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <Layers className="h-8 w-8 text-pink-500 mb-2" />
        <p className="text-xs">{t("flashcardsEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background text-foreground select-none font-sans">
      {/* Top Breadcrumb & Expand Bar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-card text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="hover:text-foreground transition-colors cursor-pointer">Studio</span>
          <span>&gt;</span>
          <span className="text-foreground font-medium truncate">
            {flashcard.title || t("flashcardsDeck")}
          </span>
        </div>

        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Main Title Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between shrink-0 border-b border-border">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-snug">
            {flashcard.title || t("flashcardTitle")}
          </h2>
          <span className="text-[11.5px] text-muted-foreground block mt-0.5">
            {t("cardsBasedOnSources", { count: totalCards, sources: flashcard.sourceCount || 1 })}
          </span>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            className="h-7 w-7 rounded-lg hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="h-7 w-7 rounded-lg hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
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
            <div className="w-full flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {currentIndex + 1} / {totalCards}
              </span>
              <span className="text-[11px] text-muted-foreground/60">
                {t("clickCardToFlip")}
              </span>
            </div>

            {/* 3D Flip Card Container */}
            <div
              onClick={handleFlip}
              className="w-full min-h-[220px] sm:min-h-[260px] p-6 rounded-2xl bg-card hover:bg-secondary/70 border border-border hover:border-border/80 transition-all cursor-pointer shadow-md flex flex-col justify-between active:scale-[0.99] relative group"
            >
              {/* Card Label Tag */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="uppercase tracking-wider font-semibold text-pink-600 dark:text-pink-400">
                  {isFlipped ? t("cardBackAnswer") : t("cardFrontTerm")}
                </span>
                <span className="text-muted-foreground/70 group-hover:text-foreground transition-colors">
                  {t("flipCard")} ⟲
                </span>
              </div>

              {/* Card Main Content */}
              <div className="my-auto py-3">
                {!isFlipped ? (
                  <h3 className="text-base sm:text-lg font-semibold text-foreground leading-relaxed text-center">
                    {currentCard.front}
                  </h3>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-center">
                    {currentCard.back}
                  </p>
                )}
              </div>

              {/* Card Bottom Hint & AI Explain */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground/70 truncate max-w-[200px]">
                  {currentCard.hint ? `💡 ${currentCard.hint}` : ""}
                </span>

                <button
                  type="button"
                  onClick={handleExplain}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-[11px] font-medium text-foreground transition-all cursor-pointer active:scale-95 shrink-0"
                  title={t("explainInChat")}
                >
                  <Bot className="h-3 w-3 text-teal-500" />
                  <span>{t("explainAction")}</span>
                </button>
              </div>
            </div>

            {/* Self-Rating Buttons (Shown on Back) */}
            {isFlipped && (
              <div className="w-full flex items-center justify-center gap-2 pt-1 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => handleRate("hard")}
                  className="flex-1 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400 font-medium transition-colors cursor-pointer"
                >
                  {t("hardRating")}
                </button>
                <button
                  type="button"
                  onClick={() => handleRate("medium")}
                  className="flex-1 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400 font-medium transition-colors cursor-pointer"
                >
                  {t("goodRating")}
                </button>
                <button
                  type="button"
                  onClick={() => handleRate("easy")}
                  className="flex-1 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400 font-medium transition-colors cursor-pointer"
                >
                  {t("easyRating")}
                </button>
              </div>
            )}

            {/* Previous & Next controls */}
            <div className="w-full flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={handlePrev}
                className="px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 disabled:opacity-40 disabled:pointer-events-none border border-border text-xs font-medium text-foreground transition-colors cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>{t("previousAction")}</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
              >
                <span>
                  {currentIndex === totalCards - 1
                    ? t("finishAction")
                    : t("nextAction")}
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Completion Screen */
          <div className="w-full max-w-md mx-auto text-center py-8 space-y-4 animate-in fade-in duration-200">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-500 shadow-lg">
              <Award className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {t("flashcardsSessionComplete")}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t("reviewedAllCards", { count: totalCards })}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t("reviewAgain")}</span>
              </button>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
