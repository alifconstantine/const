import React, { useState } from "react";
import {
  Check,
  X,
  ChevronDown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  Maximize2,
  Minimize2,
  FileText,
  Share2,
  HelpCircle,
  Award,
} from "lucide-react";
import { ScrollArea } from "@const/ui";
import type { QuizData, QuizQuestion } from "../../lib/db";
import { useI18n } from "../../lib/i18n";

export interface QuizViewerProps {
  quiz: QuizData;
  onExplainInChat?: (prompt: string) => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

export function QuizViewer({
  quiz,
  onExplainInChat,
  onToggleExpand,
  isExpanded = false,
}: QuizViewerProps) {
  const { language } = useI18n();
  const isIndo = language === "id";

  const questions: QuizQuestion[] = quiz.questions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const isAnswered = currentAnswer !== undefined;

  const handleSelectOption = (optionId: string) => {
    if (!currentQ || isAnswered) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: optionId }));
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
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

  const handleExplain = () => {
    if (!currentQ || !onExplainInChat) return;
    const correctOpt = currentQ.options.find((o) => o.isCorrect);
    const selectedOpt = currentQ.options.find((o) => o.id === currentAnswer);

    const promptText = isIndo
      ? `Tolong jelaskan secara mendalam mengenai pertanyaan kuis ini:

**Pertanyaan**: "${currentQ.question}"

**Jawaban Benar**: (${correctOpt?.id}) ${correctOpt?.text}
${correctOpt?.explanation ? `*Konteks*: ${correctOpt.explanation}\n` : ""}
${selectedOpt && !selectedOpt.isCorrect ? `**Jawaban yang Saya Pilih**: (${selectedOpt.id}) ${selectedOpt.text}\n` : ""}
Berdasarkan materi sumber, tolong uraikan mengapa jawaban tersebut adalah yang paling tepat dan berikan pemahaman konseptual yang lebih luas.`
      : `Please explain in-depth this quiz question:

**Question**: "${currentQ.question}"

**Correct Answer**: (${correctOpt?.id}) ${correctOpt?.text}
${correctOpt?.explanation ? `*Context*: ${correctOpt.explanation}\n` : ""}
${selectedOpt && !selectedOpt.isCorrect ? `**My Selected Answer**: (${selectedOpt.id}) ${selectedOpt.text}\n` : ""}
Based on the learning sources, explain why this is the correct answer and provide a broader conceptual understanding.`;

    onExplainInChat(promptText);
  };

  // Calculate score
  const correctCount = questions.filter((q) => {
    const userChoice = answers[q.id];
    const correctChoice = q.options.find((o) => o.isCorrect)?.id;
    return userChoice === correctChoice;
  }).length;

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#888888]">
        <HelpCircle className="h-8 w-8 text-[#5eead4] mb-2" />
        <p className="text-xs">{isIndo ? "Kuis tidak memiliki pertanyaan." : "Quiz has no questions."}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#161618] text-[#e0e0e0] select-none font-sans">
      {/* Top Breadcrumb & Expand bar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#242428] bg-[#1a1a1d] text-xs text-[#888888] shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="hover:text-white transition-colors cursor-pointer">Studio</span>
          <span>&gt;</span>
          <span className="text-white font-medium truncate">
            {quiz.title || (isIndo ? "AI Kuis" : "AI Quiz")}
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

      {/* Main Title & Sources Meta Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between shrink-0 border-b border-[#242428]">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight leading-snug">
            {quiz.title || (isIndo ? "AI Kuis" : "AI Quiz")}
          </h2>
          <button
            type="button"
            onClick={() => setShowPromptDetails(!showPromptDetails)}
            className="text-[11.5px] text-[#5eead4] hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
          >
            <span>
              {isIndo
                ? `Lihat perintah dan ${quiz.sourceCount || 1} sumber`
                : `View prompt and ${quiz.sourceCount || 1} source(s)`}
            </span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${
                showPromptDetails ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-1 text-[#888888]">
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title="Share"
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

      {/* Expandable Prompt / Sources Detail Panel */}
      {showPromptDetails && (
        <div className="px-5 py-3 bg-[#1e1e22] border-b border-[#2c2c32] text-xs space-y-2 animate-in fade-in duration-150 shrink-0">
          {quiz.topic && (
            <div>
              <span className="text-[#888888] font-medium">{isIndo ? "Topik Fokus: " : "Focus Topic: "}</span>
              <span className="text-white">{quiz.topic}</span>
            </div>
          )}
          {quiz.sourceTitles && quiz.sourceTitles.length > 0 && (
            <div>
              <span className="text-[#888888] font-medium">{isIndo ? "Sumber Rujukan: " : "Sources: "}</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {quiz.sourceTitles.map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#28282e] border border-[#383840] text-[10.5px] text-[#d4d4d4]"
                  >
                    <FileText className="h-3 w-3 text-[#5eead4]" />
                    <span className="truncate max-w-[200px]">{t}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scrollable Question Body or Completion Screen */}
      <ScrollArea className="flex-1 w-full min-h-0" viewportClassName="p-4 sm:p-6 flex flex-col justify-start">
        {!isCompleted && currentQ ? (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            {/* Question Counter & Meta */}
            <div className="flex items-center justify-between text-xs text-[#888888]">
              <span className="font-semibold text-white tracking-wide">
                {currentIndex + 1}/{totalQuestions}
              </span>
              <button
                type="button"
                className="h-6 w-6 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Question Text */}
            <h3 className="text-sm sm:text-base font-semibold text-white leading-relaxed">
              {currentQ.question}
            </h3>

            {/* Options List */}
            <div className="space-y-2.5 pt-1">
              {currentQ.options.map((opt) => {
                const isSelected = currentAnswer === opt.id;
                const showResults = isAnswered;
                const isCorrect = opt.isCorrect;

                let cardStyle =
                  "bg-[#1f1f23] border-[#2e2e34] hover:bg-[#26262b] hover:border-[#3e3e46] text-[#d4d4d4]";
                let badgeStyle = "text-[#888888]";

                if (showResults) {
                  if (isCorrect) {
                    cardStyle =
                      "bg-[#13281f] border-[#10b981]/70 text-white shadow-sm";
                    badgeStyle = "text-[#10b981] font-semibold";
                  } else if (isSelected && !isCorrect) {
                    cardStyle =
                      "bg-[#2c1819] border-[#ef4444]/70 text-white shadow-sm";
                    badgeStyle = "text-[#ef4444] font-semibold";
                  } else {
                    cardStyle = "bg-[#1a1a1d] border-[#26262b] text-[#888888] opacity-75";
                  }
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(opt.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${cardStyle} active:scale-[0.99]`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs sm:text-[13px] font-medium leading-snug">
                        <span className={`mr-2 ${badgeStyle}`}>{opt.id}.</span>
                        {opt.text}
                      </span>
                      {showResults && isCorrect && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#10b981] font-semibold shrink-0">
                          <Check className="h-3.5 w-3.5" />
                          <span>{isIndo ? "Benar!" : "Correct!"}</span>
                        </span>
                      )}
                      {showResults && isSelected && !isCorrect && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#ef4444] font-semibold shrink-0">
                          <X className="h-3.5 w-3.5" />
                          <span>{isIndo ? "Kurang tepat" : "Incorrect"}</span>
                        </span>
                      )}
                    </div>

                    {/* Explanations (Shown after answering) */}
                    {showResults && opt.explanation && (
                      <p className="text-[11px] text-[#a0a0a0] leading-relaxed pt-1 pl-5 border-t border-white/5 mt-1">
                        {opt.explanation}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom Row inside Question Card: Hint & Navigation */}
            <div className="pt-3 flex items-center justify-between gap-2">
              {/* Left Action: Petunjuk (before answer) or Jelaskan (after answer) */}
              <div>
                {!isAnswered ? (
                  currentQ.hint && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowHint((prev) => ({
                          ...prev,
                          [currentQ.id]: !prev[currentQ.id],
                        }))
                      }
                      className="text-xs text-[#888888] hover:text-white flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span>{isIndo ? "Petunjuk" : "Hint"}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          showHint[currentQ.id] ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleExplain}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#232328] hover:bg-[#2c2c33] border border-[#383842] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 shadow-xs"
                    title={
                      isIndo
                        ? "Minta AI menjelaskan soal ini di chat"
                        : "Ask AI to explain this question in chat"
                    }
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#5eead4]" />
                    <span>{isIndo ? "Jelaskan" : "Explain in Chat"}</span>
                  </button>
                )}
              </div>

              {/* Right Action: Previous & Next Navigation */}
              <div className="flex items-center gap-2">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-3.5 py-1.5 rounded-xl bg-[#202024] hover:bg-[#28282e] border border-[#2f2f35] text-xs font-medium text-[#d4d4d4] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>{isIndo ? "Sebelumnya" : "Previous"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-1.5 rounded-xl bg-[#0066ff] hover:bg-[#1a75ff] text-xs font-semibold text-white transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                >
                  <span>
                    {currentIndex === totalQuestions - 1
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

            {/* Hint Box (if toggled) */}
            {showHint[currentQ.id] && currentQ.hint && (
              <div className="p-3 rounded-xl bg-[#222228] border border-[#33333e] text-xs text-[#d4d4d4] leading-relaxed animate-in fade-in duration-150">
                <span className="font-semibold text-[#5eead4] mr-1.5">💡 {isIndo ? "Petunjuk:" : "Hint:"}</span>
                {currentQ.hint}
              </div>
            )}
          </div>
        ) : (
          /* Quiz Completion Summary Screen */
          <div className="w-full max-w-md mx-auto text-center py-8 space-y-5 animate-in fade-in duration-200">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-[#1d2d24] border border-[#10b981]/50 flex items-center justify-center text-[#10b981] shadow-lg">
              <Award className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white">
                {isIndo ? "Kuis Telah Selesai!" : "Quiz Completed!"}
              </h3>
              <p className="text-xs text-[#888888] mt-1">
                {isIndo
                  ? `Skor Anda: ${correctCount} dari ${totalQuestions} benar (${Math.round((correctCount / totalQuestions) * 100)}%)`
                  : `Your Score: ${correctCount} of ${totalQuestions} correct (${Math.round((correctCount / totalQuestions) * 100)}%)`}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#1d1d22] border border-[#2c2c34] text-xs text-[#d4d4d4] space-y-2">
              <div className="flex justify-between">
                <span className="text-[#888888]">{isIndo ? "Akurasi" : "Accuracy"}</span>
                <span className="font-semibold text-white">
                  {Math.round((correctCount / totalQuestions) * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888888]">{isIndo ? "Tingkat Kesulitan" : "Difficulty"}</span>
                <span className="capitalize text-white">{quiz.difficulty || "Medium"}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl bg-[#232328] hover:bg-[#2c2c33] border border-[#383842] text-xs font-medium text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isIndo ? "Ulangi Kuis" : "Restart Quiz"}</span>
              </button>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer Feedback Bar */}
      <div className="h-11 px-5 border-t border-[#242428] bg-[#1a1a1d] flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFeedback("good")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
              feedback === "good"
                ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40"
                : "text-[#888888] hover:text-white bg-[#202024] border border-transparent"
            }`}
          >
            <ThumbsUp className="h-3 w-3" />
            <span>{isIndo ? "Konten bagus" : "Good content"}</span>
          </button>
          <button
            type="button"
            onClick={() => setFeedback("bad")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
              feedback === "bad"
                ? "bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40"
                : "text-[#888888] hover:text-white bg-[#202024] border border-transparent"
            }`}
          >
            <ThumbsDown className="h-3 w-3" />
            <span>{isIndo ? "Konten buruk" : "Bad content"}</span>
          </button>
        </div>

        <span className="text-[11px] text-[#666666]">Const Studio</span>
      </div>
    </div>
  );
}
