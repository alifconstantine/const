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
  AudioLines,
  Play,
  Pause,
  Download,
  Copy,
  Clock,
  Mic,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn, toast } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import { localDb, type LocalArtifact, type QuizData, type QuizQuestion, type FlashcardData, type FlashcardItem, type AudioSummaryData, type VideoSummaryData, type SlideDeckData, type InfographicData } from "../../lib/db";
import { getStoredVoiceConfig, synthesizeSpeechChunked } from "../../lib/voice";
import { MobileMindMapViewer } from "./mobile-mind-map-viewer";
import { VideoSummarySheet } from "./video-summary-sheet";
import { MobilePresentationViewer } from "./mobile-presentation-viewer";
import { MobileInfographicViewer } from "./mobile-infographic-viewer";

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
  const isAudioSummary = artifact.type === "audio_summary";
  const isVideoSummary = artifact.type === "video_summary";

  const quizData = isQuiz ? (artifact.data as QuizData) : null;
  const flashcardData = isFlashcard ? (artifact.data as FlashcardData) : null;
  const audioSummaryData = isAudioSummary
    ? (artifact.data as AudioSummaryData) ||
      (() => {
        try {
          return typeof artifact.content === "string"
            ? JSON.parse(artifact.content)
            : null;
        } catch {
          return null;
        }
      })()
    : null;
  const videoSummaryData = isVideoSummary
    ? (artifact.data as VideoSummaryData) ||
      (() => {
        try {
          return typeof artifact.content === "string"
            ? JSON.parse(artifact.content)
            : null;
        } catch {
          return null;
        }
      })()
    : null;
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

  if (isVideoSummary && videoSummaryData) {
    return (
      <VideoSummarySheet
        open={open}
        onClose={onClose}
        data={videoSummaryData}
        onExplainInChat={onExplainInChat}
      />
    );
  }

  const isSlides = artifact.type === "slides" || Boolean(artifact.data?.slides);
  const slideDeckData = isSlides
    ? (artifact.data as SlideDeckData) ||
      (() => {
        try {
          return typeof artifact.content === "string"
            ? JSON.parse(artifact.content)
            : null;
        } catch {
          return null;
        }
      })()
    : null;

  if (isSlides && slideDeckData) {
    return (
      <MobilePresentationViewer
        artifact={artifact}
        data={slideDeckData}
        onClose={onClose}
        onExplainInChat={onExplainInChat}
      />
    );
  }

  if (isMindMap && mindMapData) {
    return <MobileMindMapViewer data={mindMapData} onClose={onClose} />;
  }

  const isInfographic = artifact.type === "infographic" || Boolean(artifact.data?.imageUrl);
  const infographicData = isInfographic
    ? (artifact.data as InfographicData) ||
      (() => {
        try {
          return typeof artifact.content === "string"
            ? JSON.parse(artifact.content)
            : null;
        } catch {
          return null;
        }
      })()
    : null;

  if (isInfographic && infographicData) {
    return (
      <MobileInfographicViewer
        artifact={artifact}
        data={infographicData}
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
            {isQuiz ? (
              <HelpCircle className="h-4 w-4" />
            ) : isAudioSummary ? (
              <AudioLines className="h-4 w-4 text-indigo-400" />
            ) : (
              <Layers className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-semibold text-foreground truncate">
              {artifact.title}
            </h1>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span>
                {isQuiz
                  ? isIndo ? "Kuis Interaktif" : "Quiz"
                  : isAudioSummary
                  ? isIndo ? "Ringkasan Audio" : "Audio Summarize"
                  : isIndo ? "Kartu Flashcard" : "Flashcards"}
              </span>
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
        ) : isFlashcard && flashcardData ? (
          <MobileFlashcardBody
            flashcard={flashcardData}
            onExplainInChat={(prompt) => {
              onClose();
              onExplainInChat(prompt);
            }}
          />
        ) : isAudioSummary && audioSummaryData ? (
          <MobileAudioSummaryBody
            artifact={artifact}
            data={audioSummaryData}
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

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

function MobileAudioSummaryBody({
  artifact,
  data,
  onExplainInChat,
}: {
  artifact?: LocalArtifact;
  data: AudioSummaryData;
  onExplainInChat: (prompt: string) => void;
}) {
  const { t, language } = useI18n();
  const isIndo = language === "id";
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [liveAudioSrc, setLiveAudioSrc] = useState<string>(
    data.audioUrl || data.audioBase64 || ""
  );
  const [audioError, setAudioError] = useState<string | undefined>(data.audioError);

  const audioSrc = liveAudioSrc;

  React.useEffect(() => {
    if (data.audioUrl || data.audioBase64) {
      setLiveAudioSrc(data.audioUrl || data.audioBase64 || "");
    }
    setAudioError(data.audioError);
  }, [data.audioUrl, data.audioBase64, data.audioError]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioSrc]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRewind = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  };

  const handleChangeSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextRate = SPEED_OPTIONS[(currentIndex + 1) % SPEED_OPTIONS.length] || 1;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const handleCopy = () => {
    if (!data.script) return;
    navigator.clipboard.writeText(data.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!audioSrc) return;
    const a = document.createElement("a");
    a.href = audioSrc;
    a.download = `${(data.title || "audio-summary").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRetryAudioSynthesis = async () => {
    if (!data.script?.trim()) {
      toast.error(isIndo ? "Naskah tidak ditemukan." : "Script not found.");
      return;
    }

    const voiceConfig = getStoredVoiceConfig();
    const provider =
      voiceConfig.providers.find((p) => p.protocol === "inworld") ||
      voiceConfig.providers[0];

    if (!provider || !provider.apiKey?.trim()) {
      toast.error(
        isIndo
          ? "API Key Inworld belum dikonfigurasi di menu Pengaturan Model."
          : "Inworld API Key is not configured in Models settings."
      );
      return;
    }

    setIsSynthesizing(true);
    try {
      toast.info(
        isIndo
          ? "Memulai sintesis audio dengan Inworld TTS..."
          : "Starting audio synthesis with Inworld TTS..."
      );
      const synthRes = await synthesizeSpeechChunked({
        provider: {
          ...provider,
          model: data.voiceModel || provider.model || "inworld-tts-2",
          voice: data.voiceId || provider.voice || "Ashley",
        },
        text: data.script,
      });

      if (synthRes.success && (synthRes.audioUrl || synthRes.audioBase64)) {
        const newSrc = synthRes.audioUrl || synthRes.audioBase64 || "";
        setLiveAudioSrc(newSrc);
        setAudioError(undefined);

        const updatedData: AudioSummaryData = {
          ...data,
          audioUrl: synthRes.audioUrl,
          audioBase64: synthRes.audioBase64,
          audioError: undefined,
        };

        if (artifact?.id) {
          await localDb.updateArtifact(artifact.id, {
            data: updatedData,
            content: JSON.stringify(updatedData),
          });
        }

        toast.success(
          isIndo
            ? "Audio berhasil disintesis dan siap diputar!"
            : "Audio synthesized successfully and ready to play!"
        );
      } else {
        const errMsg = synthRes.error || "Synthesis failed";
        setAudioError(errMsg);
        toast.error(
          isIndo
            ? `Gagal mensintesis audio: ${errMsg}`
            : `Failed to synthesize audio: ${errMsg}`
        );
      }
    } catch (err: any) {
      const errMsg = err?.message || "Synthesis error";
      setAudioError(errMsg);
      toast.error(
        isIndo
          ? `Terjadi kesalahan saat sintesis: ${errMsg}`
          : `An error occurred during synthesis: ${errMsg}`
      );
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {audioSrc ? (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      ) : null}

      {/* Audio Player Card */}
      <div className="p-4 rounded-2xl bg-card border border-border space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <AudioLines className="h-4 w-4 text-indigo-400" />
            <span>{isIndo ? "Pemutar Suara" : "Voice Player"}</span>
          </div>

          {audioSrc && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t("audioDownload")}</span>
            </button>
          )}
        </div>

        {/* Missing Audio Warning & Retry */}
        {!audioSrc && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-300">
                  {isIndo ? "File audio belum siap atau gagal disintesis" : "Audio file is not ready or failed to synthesize"}
                </p>
                {audioError && (
                  <p className="text-[11px] text-amber-300/80 mt-0.5 font-mono">
                    {audioError}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRetryAudioSynthesis}
              disabled={isSynthesizing}
              className="w-full py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs active:scale-95"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{isIndo ? "Memproses Audio..." : "Synthesizing Audio..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isIndo ? "Sintesis Audio Sekarang" : "Synthesize Audio Now"}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioSrc}
            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-40"
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>

        {/* Player controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              disabled={!audioSrc}
              className="h-11 w-11 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={handleRewind}
              disabled={!audioSrc}
              className="h-9 w-9 rounded-full bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center active:scale-95"
              title="Rewind 10s"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleChangeSpeed}
              disabled={!audioSrc}
              className="px-2.5 py-1 rounded-full bg-secondary text-xs font-semibold text-foreground active:scale-95"
            >
              {playbackRate}x
            </button>
          </div>

          <div className="text-[10px] text-muted-foreground flex flex-col items-end">
            <span>{data.voiceId || "Ashley"}</span>
            <span>{data.language || "id-ID"}</span>
          </div>
        </div>
      </div>

      {/* Transcript Card */}
      <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <FileText className="h-4 w-4 text-indigo-400" />
            <span>{t("audioTranscript")}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary text-[11px] text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? (isIndo ? "Tersalin" : "Copied") : (isIndo ? "Salin" : "Copy")}</span>
            </button>

            <button
              type="button"
              onClick={() => onExplainInChat(`Tolong jelaskan lebih dalam ringkasan audio berikut:\n${data.script.slice(0, 1000)}`)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-[11px] font-medium"
            >
              <Sparkles className="h-3 w-3" />
              <span>{isIndo ? "Tanya" : "Ask"}</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-secondary/30 text-xs text-foreground/90 leading-relaxed font-sans whitespace-pre-wrap">
          {data.script || (isIndo ? "Tidak ada naskah transkrip." : "No transcript available.")}
        </div>
      </div>
    </div>
  );
}

