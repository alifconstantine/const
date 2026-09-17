import React, { useState } from "react";
import {
  X,
  Sparkles,
  HelpCircle,
  Layers,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Award,
  ChevronDown,
  GitFork,
} from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { LocalArtifact, QuizData, QuizQuestion, FlashcardData, FlashcardItem, SlideDeckData } from "../../lib/db";
import { MobileMindMapViewer } from "./mobile-mind-map-viewer";
import { MobileSlideViewer } from "./mobile-slide-viewer";

export interface MobileArtifactReaderProps {
  open: boolean;
  onClose: () => void;
  artifact: LocalArtifact | null;
  onExplainInChat: (prompt: string) => void;
}

export function MobileArtifactReader({
  open,
  onClose,
  artifact,
  onExplainInChat,
}: MobileArtifactReaderProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  if (!open || !artifact) return null;

  const isQuiz = artifact.type === "quiz";
  const isFlashcard = artifact.type === "flashcard" || artifact.type === "flashcards";
  const isMindMap = artifact.type === "mind_map" || Boolean(artifact.data?.root);
  const isSlides = artifact.type === "slides" || Boolean(artifact.data?.slides);

  const quizData = isQuiz ? (artifact.data as QuizData) : null;
  const flashcardData = isFlashcard ? (artifact.data as FlashcardData) : null;
  const mindMapData = isMindMap
    ? artifact.data?.root
      ? (artifact.data as any)
      : (() => {
          try {
            return typeof artifact.content === "string"
              ? JSON.parse(artifact.content)
              : artifact.content;
          } catch {
            return null;
          }
        })()
    : null;
  const slideDeckData = isSlides
    ? artifact.data?.slides
      ? (artifact.data as SlideDeckData)
      : (() => {
          try {
            return typeof artifact.content === "string"
              ? JSON.parse(artifact.content)
              : artifact.content;
          } catch {
            return null;
          }
        })()
    : null;

  if (isMindMap && mindMapData) {
    return <MobileMindMapViewer data={mindMapData} onClose={onClose} />;
  }

  if (isSlides && slideDeckData) {
    return (
      <MobileSlideViewer
        deck={slideDeckData}
        onClose={onClose}
        onExplainInChat={onExplainInChat}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground flex flex-col font-sans select-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Navigation Bar */}
      <header className="h-14 px-3 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div className="h-8 w-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
            {isQuiz ? <HelpCircle className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-semibold text-foreground truncate">
              {artifact.title}
            </h1>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span>{isQuiz ? (isIndo ? "Kuis Interaktif" : "Quiz") : (isIndo ? "Kartu Flashcard" : "Flashcards")}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Interactive Body */}
      <div className="flex-1 overflow-y-auto">
        {isQuiz && quizData ? (
          <MobileQuizBody
            quiz={quizData}
            onExplainInChat={(prompt) => {
              onClose();
              onExplainInChat(prompt);
            }}
          />
        ) : flashcardData ? (
          <MobileFlashcardBody
            flashcard={flashcardData}
            onExplainInChat={(prompt) => {
              onClose();
              onExplainInChat(prompt);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* MOBILE QUIZ BODY (Matches Screen Recording)                               */
/* ========================================================================= */

function MobileQuizBody({
  quiz,
  onExplainInChat,
}: {
  quiz: QuizData;
  onExplainInChat: (prompt: string) => void;
}) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const questions: QuizQuestion[] = quiz.questions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const isAnswered = Boolean(currentAnswer);

  const handleSelectOption = (optId: string) => {
    if (isAnswered || !currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: optId }));
  };

  const handleNext = () => {
    if (currentIndex < totalQ - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleRestart = () => {
    setAnswers({});
    setShowHint({});
    setCurrentIndex(0);
    setIsCompleted(false);
  };

  // Trigger Socratic Explain in Chat
  const handleExplain = () => {
    if (!currentQ) return;
    const correctOpt = currentQ.options.find((o) => o.isCorrect);
    const selectedOpt = currentQ.options.find((o) => o.id === currentAnswer);

    const prompt = isIndo
      ? `Tolong jelaskan lebih mendalam tentang pertanyaan kuis berikut:\n\n**Pertanyaan:** "${currentQ.question}"\n${
          selectedOpt ? `**Jawaban Saya:** (${selectedOpt.id}) ${selectedOpt.text}\n` : ""
        }**Kunci Jawaban:** (${correctOpt?.id}) ${correctOpt?.text}\n${
          correctOpt?.explanation ? `**Penjelasan:** ${correctOpt.explanation}\n` : ""
        }\nMengapa jawaban ini tepat dan apa konsep kunci di baliknya?`
      : `Please explain this quiz question in depth:\n\n**Question:** "${currentQ.question}"\n${
          selectedOpt ? `**My Answer:** (${selectedOpt.id}) ${selectedOpt.text}\n` : ""
        }**Correct Answer:** (${correctOpt?.id}) ${correctOpt?.text}\n${
          correctOpt?.explanation ? `**Explanation:** ${correctOpt.explanation}\n` : ""
        }\nWhy is this correct and what is the key underlying concept?`;

    onExplainInChat(prompt);
  };

  if (isCompleted) {
    const correctCount = questions.filter((q) => {
      const userChoice = answers[q.id];
      const correctChoice = q.options.find((o) => o.isCorrect)?.id;
      return userChoice === correctChoice;
    }).length;
    const scorePct = Math.round((correctCount / totalQ) * 100);

    return (
      <div className="p-5 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="h-16 w-16 rounded-full bg-secondary border border-border flex items-center justify-center mb-4 text-amber-500">
          <Award className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">
          {isIndo ? "Kuis Selesai!" : "Quiz Completed!"}
        </h2>
        <p className="text-xs text-muted-foreground mb-6">
          {isIndo
            ? `Anda menjawab ${correctCount} dari ${totalQ} soal dengan benar (${scorePct}%).`
            : `You scored ${correctCount} out of ${totalQ} questions correctly (${scorePct}%).`}
        </p>

        <div className="w-full max-w-xs space-y-2.5">
          <button
            type="button"
            onClick={handleRestart}
            className="w-full py-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-medium text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{isIndo ? "Ulangi Kuis" : "Retry Quiz"}</span>
          </button>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Progress Counter & Hint Toggle */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {isIndo ? "Pertanyaan" : "Question"} {currentIndex + 1}
          </span>
          <span>/</span>
          <span>{totalQ}</span>
        </div>

        {currentQ.hint && (
          <button
            type="button"
            onClick={() =>
              setShowHint((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))
            }
            className="text-[11px] text-foreground hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>{isIndo ? "Petunjuk" : "Hint"}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                showHint[currentQ.id] && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {/* Hint Pill */}
      {showHint[currentQ.id] && currentQ.hint && (
        <div className="p-3 rounded-xl bg-secondary/60 border border-border text-xs text-foreground animate-in fade-in">
          💡 {currentQ.hint}
        </div>
      )}

      {/* Question Card */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
        <p className="text-sm font-medium text-foreground leading-relaxed">
          {currentQ.question}
        </p>
      </div>

      {/* Options List */}
      <div className="space-y-2">
        {currentQ.options.map((opt) => {
          const isSelected = currentAnswer === opt.id;
          const isCorrect = opt.isCorrect;

          let optionStyle =
            "bg-card border-border text-foreground hover:bg-secondary/70";
          let letterStyle = "bg-secondary text-muted-foreground border-border";

          if (isAnswered) {
            if (isCorrect) {
              optionStyle = "bg-emerald-950/40 border-emerald-500/60 text-emerald-200";
              letterStyle = "bg-emerald-500 text-black border-emerald-400";
            } else if (isSelected) {
              optionStyle = "bg-rose-950/40 border-rose-500/60 text-rose-200";
              letterStyle = "bg-rose-500 text-white border-rose-400";
            }
          }

          return (
            <div
              key={opt.id}
              onClick={() => handleSelectOption(opt.id)}
              className={cn(
                "p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer active:scale-[0.99]",
                optionStyle
              )}
            >
              <div
                className={cn(
                  "h-6 w-6 rounded-lg font-bold text-xs flex items-center justify-center border shrink-0 mt-0.5",
                  letterStyle
                )}
              >
                {isAnswered && isCorrect ? (
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                ) : isAnswered && isSelected ? (
                  <X className="h-3.5 w-3.5 stroke-[3]" />
                ) : (
                  opt.id.toUpperCase()
                )}
              </div>
              <span className="text-xs font-medium leading-snug flex-1">
                {opt.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Feedback & Explanation Box with "Jelaskan" button */}
      {isAnswered && (
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              {currentQ.options.find((o) => o.id === currentAnswer)?.isCorrect ? (
                <>
                  <span className="text-emerald-400">✓</span>
                  <span>{isIndo ? "Jawaban Anda Benar!" : "Correct Answer!"}</span>
                </>
              ) : (
                <>
                  <span className="text-rose-400">✕</span>
                  <span>{isIndo ? "Jawaban Kurang Tepat" : "Incorrect"}</span>
                </>
              )}
            </span>

            {/* "Jelaskan" Button */}
            <button
              type="button"
              onClick={handleExplain}
              className="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-[11px] font-medium border border-border flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>{isIndo ? "Jelaskan" : "Explain"}</span>
            </button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {currentQ.options.find((o) => o.id === currentAnswer)?.explanation ||
              currentQ.options.find((o) => o.isCorrect)?.explanation ||
              (isIndo
                ? "Pilihan di atas adalah jawaban yang paling tepat sesuai konteks materi."
                : "The option above is the most accurate answer according to the material.")}
          </p>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="pt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-xl bg-secondary border border-border text-xs font-medium text-foreground disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{isIndo ? "Sebelumnya" : "Previous"}</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
        >
          <span>
            {currentIndex === totalQ - 1
              ? isIndo
                ? "Selesai"
                : "Finish"
              : isIndo
              ? "Selanjutnya"
              : "Next"}
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* MOBILE FLASHCARD BODY                                                     */
/* ========================================================================= */

function MobileFlashcardBody({
  flashcard,
  onExplainInChat,
}: {
  flashcard: FlashcardData;
  onExplainInChat: (prompt: string) => void;
}) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const cards: FlashcardItem[] = flashcard.cards || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, "hard" | "medium" | "easy">>({});

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;

  if (!currentCard) return null;

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleExplain = () => {
    const prompt = isIndo
      ? `Tolong jelaskan konsep flashcard ini lebih mendalam:\n\n**Depan (Istilah/Pertanyaan):** "${currentCard.front}"\n**Belakang (Penjelasan):** "${currentCard.back}"\n\nBerikan contoh konkret dan analogi mudah dipahami.`
      : `Please explain this flashcard concept in depth:\n\n**Front (Term/Question):** "${currentCard.front}"\n**Back (Explanation):** "${currentCard.back}"\n\nProvide a concrete example and simple analogy.`;
    onExplainInChat(prompt);
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Progress Counter & Action */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="text-foreground">{currentIndex + 1}</span>
          <span>/</span>
          <span>{totalCards}</span>
        </div>

        <button
          type="button"
          onClick={handleExplain}
          className="text-[11px] text-foreground hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="h-3 w-3 text-amber-300" />
          <span>{isIndo ? "Jelaskan dengan AI" : "Explain with AI"}</span>
        </button>
      </div>

      {/* 3D Flip Card */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="w-full min-h-[260px] p-6 rounded-3xl bg-card border border-border shadow-md flex flex-col justify-between text-center cursor-pointer transition-all active:scale-[0.99]"
      >
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {isFlipped ? (isIndo ? "Jawaban / Belakang" : "Back / Answer") : (isIndo ? "Pertanyaan / Depan" : "Front / Question")}
        </div>

        <div className="my-auto py-4">
          <p className="text-base font-semibold text-foreground leading-relaxed">
            {isFlipped ? currentCard.back : currentCard.front}
          </p>
        </div>

        <div className="text-[10px] text-muted-foreground">
          {isIndo ? "Ketuk untuk membalik kartu" : "Tap to flip card"}
        </div>
      </div>

      {/* Confidence Rating Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {(["hard", "medium", "easy"] as const).map((lvl) => {
          const label =
            lvl === "hard"
              ? isIndo ? "Sulit" : "Hard"
              : lvl === "medium"
              ? isIndo ? "Sedang" : "Medium"
              : isIndo ? "Mudah" : "Easy";
          const isSelected = ratings[currentCard.id] === lvl;
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => setRatings((prev) => ({ ...prev, [currentCard.id]: lvl }))}
              className={cn(
                "py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer active:scale-95",
                isSelected
                  ? "bg-card border-border text-foreground shadow-xs font-semibold"
                  : "bg-secondary/60 border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="pt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-xl bg-secondary border border-border text-xs font-medium text-foreground disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{isIndo ? "Sebelumnya" : "Previous"}</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === totalCards - 1}
          className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
        >
          <span>{isIndo ? "Selanjutnya" : "Next"}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
