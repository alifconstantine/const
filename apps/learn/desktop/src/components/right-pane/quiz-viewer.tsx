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
  const { t } = useI18n();

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

    const contextLine = correctOpt?.explanation
      ? t("quizContextLine", { explanation: correctOpt.explanation })
      : "";
    const selectedLine = selectedOpt && !selectedOpt.isCorrect
      ? t("quizSelectedLine", { selectedId: selectedOpt.id, selectedText: selectedOpt.text })
      : "";

    const promptText = t("explainQuizPrompt", {
      question: currentQ.question,
      correctId: correctOpt?.id || "",
      correctText: correctOpt?.text || "",
      contextLine,
      selectedLine,
    });

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
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <HelpCircle className="h-8 w-8 text-teal-500 mb-2" />
        <p className="text-xs">{t("quizHasNoQuestions")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background text-foreground select-none font-sans">
      {/* Top Breadcrumb & Expand bar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-card text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="hover:text-foreground transition-colors cursor-pointer">Studio</span>
          <span>&gt;</span>
          <span className="text-foreground font-medium truncate">
            {quiz.title || t("aiQuiz")}
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

      {/* Main Title & Sources Meta Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between shrink-0 border-b border-border">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-snug">
            {quiz.title || t("aiQuiz")}
          </h2>
          <button
            type="button"
            onClick={() => setShowPromptDetails(!showPromptDetails)}
            className="text-[11.5px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
          >
            <span>
              {t("viewPromptAndSources", { count: quiz.sourceCount || 1 })}
            </span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${
                showPromptDetails ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="h-7 w-7 rounded-lg hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Share"
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

      {/* Expandable Prompt / Sources Detail Panel */}
      {showPromptDetails && (
        <div className="px-5 py-3 bg-muted/70 border-b border-border text-xs space-y-2 animate-in fade-in duration-150 shrink-0">
          {quiz.topic && (
            <div>
              <span className="text-muted-foreground font-medium">{t("focusTopicPrefix")}</span>
              <span className="text-foreground">{quiz.topic}</span>
            </div>
          )}
          {quiz.sourceTitles && quiz.sourceTitles.length > 0 && (
            <div>
              <span className="text-muted-foreground font-medium">{t("sourcesPrefix")}</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {quiz.sourceTitles.map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-[10.5px] text-foreground"
                  >
                    <FileText className="h-3 w-3 text-teal-500" />
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
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tracking-wide">
                {currentIndex + 1}/{totalQuestions}
              </span>
              <button
                type="button"
                className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Question Text */}
            <h3 className="text-sm sm:text-base font-semibold text-foreground leading-relaxed">
              {currentQ.question}
            </h3>

            {/* Options List */}
            <div className="space-y-2.5 pt-1">
              {currentQ.options.map((opt) => {
                const isSelected = currentAnswer === opt.id;
                const showResults = isAnswered;
                const isCorrect = opt.isCorrect;

                let cardStyle =
                  "bg-card border-border hover:bg-secondary/70 hover:border-border/80 text-foreground";
                let badgeStyle = "text-muted-foreground";

                if (showResults) {
                  if (isCorrect) {
                    cardStyle =
                      "bg-emerald-500/10 border-emerald-500/60 text-foreground shadow-xs";
                    badgeStyle = "text-emerald-600 dark:text-emerald-400 font-semibold";
                  } else if (isSelected && !isCorrect) {
                    cardStyle =
                      "bg-rose-500/10 border-rose-500/60 text-foreground shadow-xs";
                    badgeStyle = "text-rose-600 dark:text-rose-400 font-semibold";
                  } else {
                    cardStyle = "bg-muted/50 border-border/60 text-muted-foreground opacity-75";
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
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                          <Check className="h-3.5 w-3.5" />
                          <span>{t("correctBadge")}</span>
                        </span>
                      )}
                      {showResults && isSelected && !isCorrect && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold shrink-0">
                          <X className="h-3.5 w-3.5" />
                          <span>{t("incorrectBadge")}</span>
                        </span>
                      )}
                    </div>

                    {/* Explanations (Shown after answering) */}
                    {showResults && opt.explanation && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 pl-5 border-t border-border mt-1">
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
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    >
                      <span>{t("hintBadge")}</span>
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-all cursor-pointer active:scale-95 shadow-xs"
                    title={t("explainInChat")}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-teal-500" />
                    <span>{t("explainInChat")}</span>
                  </button>
                )}
              </div>

              {/* Right Action: Previous & Next Navigation */}
              <div className="flex items-center gap-2">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>{t("previousQuestion")}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                >
                  <span>
                    {currentIndex === totalQuestions - 1
                      ? t("finishAction")
                      : t("nextAction")}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Hint Box (if toggled) */}
            {showHint[currentQ.id] && currentQ.hint && (
              <div className="p-3 rounded-xl bg-secondary border border-border text-xs text-foreground leading-relaxed animate-in fade-in duration-150">
                <span className="font-semibold text-teal-600 dark:text-teal-400 mr-1.5">💡 {t("hintPrefix")}</span>
                {currentQ.hint}
              </div>
            )}
          </div>
        ) : (
          /* Quiz Completion Summary Screen */
          <div className="w-full max-w-md mx-auto text-center py-8 space-y-5 animate-in fade-in duration-200">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-lg">
              <Award className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {t("quizCompleted")}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t("yourScoreSummary", {
                  score: correctCount,
                  total: totalQuestions,
                  pct: Math.round((correctCount / totalQuestions) * 100),
                })}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border text-xs text-foreground space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("accuracy")}</span>
                <span className="font-semibold text-foreground">
                  {Math.round((correctCount / totalQuestions) * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("difficulty")}</span>
                <span className="capitalize text-foreground">{quiz.difficulty || "Medium"}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t("restartQuiz")}</span>
              </button>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer Feedback Bar */}
      <div className="h-11 px-5 border-t border-border bg-card flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFeedback("good")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
              feedback === "good"
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40"
                : "text-muted-foreground hover:text-foreground bg-secondary border border-transparent"
            }`}
          >
            <ThumbsUp className="h-3 w-3" />
            <span>{t("goodContent")}</span>
          </button>
          <button
            type="button"
            onClick={() => setFeedback("bad")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
              feedback === "bad"
                ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40"
                : "text-muted-foreground hover:text-foreground bg-secondary border border-transparent"
            }`}
          >
            <ThumbsDown className="h-3 w-3" />
            <span>{t("badContent")}</span>
          </button>
        </div>

        <span className="text-[11px] text-muted-foreground/60">Const Studio</span>
      </div>
    </div>
  );
}
