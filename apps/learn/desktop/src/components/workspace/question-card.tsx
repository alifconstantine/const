import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@const/ui";

export interface QuestionOption {
  label: string;
  value?: string;
  description?: string;
  recommended?: boolean;
}

export interface QuestionItem {
  id?: string;
  category?: string;
  question: string;
  options?: Array<string | QuestionOption>;
  is_multi_select?: boolean;
}

export interface QuestionCardProps {
  toolCallId: string;
  questions: QuestionItem[];
  onAnswer: (toolCallId: string, answer: any) => void;
  onDismiss?: () => void;
  className?: string;
}

function deriveCategory(questionText: string, explicitCategory?: string): string {
  if (explicitCategory && explicitCategory.trim().length > 0) {
    return explicitCategory.trim();
  }
  const lower = questionText.toLowerCase();
  if (lower.includes("tema") || lower.includes("theme") || lower.includes("desain") || lower.includes("design")) {
    return "Tema Desain";
  }
  if (lower.includes("warna") || lower.includes("color") || lower.includes("palet") || lower.includes("palette")) {
    return "Palet Warna";
  }
  if (lower.includes("font") || lower.includes("tipografi") || lower.includes("typography")) {
    return "Tipografi";
  }
  if (lower.includes("fitur") || lower.includes("feature") || lower.includes("layout") || lower.includes("struktur")) {
    return "Struktur Layout";
  }
  if (lower.includes("animasi") || lower.includes("animation") || lower.includes("interaksi")) {
    return "Interaksi";
  }
  return "Konfirmasi";
}

export function QuestionCard({
  toolCallId,
  questions,
  onAnswer,
  onDismiss,
  className = "",
}: QuestionCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});
  const [focusedOptIdx, setFocusedOptIdx] = useState<number>(0);
  const customInputRef = useRef<HTMLInputElement>(null);

  if (!questions || questions.length === 0) return null;

  const currentQ = questions[currentIndex] || questions[0]!;
  const category = deriveCategory(currentQ.question, currentQ.category);

  // Normalize options list safely handling strings and objects
  const rawOptions: Array<{ label: string; description?: string; isRecommended: boolean }> =
    (currentQ.options || []).map((opt: any, oIdx) => {
      if (typeof opt === "string") {
        const isRec = oIdx === 0 || opt.toLowerCase().includes("recommended");
        const clean = opt.replace(/\(Recommended\)/i, "").trim();
        return { label: clean || opt, isRecommended: isRec };
      }
      const label = String(opt?.label || opt?.value || opt?.title || opt?.text || "");
      const isRec =
        Boolean(opt?.recommended || opt?.isRecommended) ||
        oIdx === 0 ||
        label.toLowerCase().includes("recommended");
      const cleanLabel = label.replace(/\(Recommended\)/i, "").trim();
      return {
        label: cleanLabel || label || `Option ${oIdx + 1}`,
        description: typeof opt?.description === "string" ? opt.description : undefined,
        isRecommended: isRec,
      };
    });

  // Sort recommended to top
  const sortedOptions = [...rawOptions].sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return 0;
  });

  const totalOptionsCount = sortedOptions.length + 1; // + 1 for custom input
  const currentSelectedValue = answers[currentIndex] || "";
  const currentCustomValue = (customInputs[currentIndex] || "").trim();
  const isCurrentAnswered = Boolean(
    (currentSelectedValue && currentSelectedValue.trim().length > 0) ||
    currentCustomValue.length > 0
  );
  const isCustomSelected =
    Boolean(currentCustomValue.length > 0) ||
    currentSelectedValue === currentCustomValue;

  const handleSelectOption = (optLabel: string, isRecommended?: boolean) => {
    const finalLabel = isRecommended ? `${optLabel} (Recommended)` : optLabel;
    setAnswers((prev) => ({ ...prev, [currentIndex]: finalLabel }));
    setCustomInputs((prev) => ({ ...prev, [currentIndex]: "" }));
  };

  const handleCustomChange = (val: string) => {
    setCustomInputs((prev) => ({ ...prev, [currentIndex]: val }));
    if (val.trim()) {
      setAnswers((prev) => ({ ...prev, [currentIndex]: val.trim() }));
    } else {
      setAnswers((prev) => {
        const next: Record<number, string> = { ...prev };
        delete next[currentIndex];
        return next;
      });
    }
  };

  const handleNext = () => {
    if (!isCurrentAnswered) return;

    let activeAns: string = answers[currentIndex] || "";
    const custom = (customInputs[currentIndex] || "").trim();
    if (custom) {
      activeAns = custom;
    }

    const updatedAnswers: Record<number, string> = { ...answers, [currentIndex]: activeAns };
    setAnswers(updatedAnswers);

    if (currentIndex < questions.length - 1) {
      // Advance to next question in wizard flow
      setCurrentIndex((prev) => prev + 1);
      setFocusedOptIdx(0);
    } else {
      // Final question answered: bundle all answers together
      const finalResult = questions.map((q, idx) => {
        const chosen =
          updatedAnswers[idx] ||
          (q.options?.[0]
            ? typeof q.options[0] === "string"
              ? q.options[0]
              : (q.options[0] as any).label || (q.options[0] as any).value || "Confirmed"
            : "Confirmed");
        return {
          question: q.question,
          answer: chosen,
        };
      });
      onAnswer(toolCallId, finalResult);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setFocusedOptIdx(0);
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      onAnswer(toolCallId, "Dismissed");
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedOptIdx((prev) => (prev + 1) % totalOptionsCount);
      if (focusedOptIdx === totalOptionsCount - 2) {
        customInputRef.current?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedOptIdx((prev) => (prev - 1 + totalOptionsCount) % totalOptionsCount);
    } else if (e.key === " " && focusedOptIdx < sortedOptions.length) {
      e.preventDefault();
      const opt = sortedOptions[focusedOptIdx];
      if (opt) handleSelectOption(opt.label, opt.isRecommended);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (focusedOptIdx < sortedOptions.length && !isCurrentAnswered) {
        const opt = sortedOptions[focusedOptIdx];
        if (opt) handleSelectOption(opt.label, opt.isRecommended);
      }
      if (isCurrentAnswered) {
        handleNext();
      }
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={cn(
        "w-full max-w-full rounded-2xl bg-card border border-border/80 p-3.5 sm:p-4 text-xs font-sans select-none shadow-xl outline-none transition-colors animate-in fade-in zoom-in-95 duration-150",
        className
      )}
    >
      {/* Header Row: [ Category ] Title < 1/2 > */}
      <div className="flex items-center justify-between pb-1.5 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
          <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium text-[11px] shrink-0 border border-primary/20">
            {category}
          </span>
          <span className="font-semibold text-[13px] text-foreground truncate leading-snug">
            {currentQ.question}
          </span>
        </div>

        {/* Pagination < 1/2 > - Next is disabled until current question is answered/confirmed */}
        <div className="flex items-center gap-1 shrink-0 text-muted-foreground font-sans tabular-nums text-xs">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Previous question"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-1 text-muted-foreground text-[11.5px] select-none font-sans">
            {currentIndex + 1} / {questions.length}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex >= questions.length - 1 || !isCurrentAnswered}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
            title={
              !isCurrentAnswered
                ? "Please choose or confirm an answer first"
                : "Next question"
            }
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Options List: Single horizontal line per option, rounded */}
      <div className="space-y-1 py-1.5">
        {sortedOptions.map((opt, oIdx) => {
          const isSelected =
            currentSelectedValue === `${opt.label} (Recommended)` ||
            currentSelectedValue === opt.label;
          const isFocused = focusedOptIdx === oIdx;

          return (
            <div
              key={oIdx}
              onClick={() => {
                setFocusedOptIdx(oIdx);
                handleSelectOption(opt.label, opt.isRecommended);
              }}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer min-w-0 border",
                isSelected
                  ? "bg-secondary/80 border-border text-foreground font-medium shadow-xs"
                  : isFocused
                  ? "bg-secondary/40 border-transparent text-foreground"
                  : "bg-transparent hover:bg-secondary/30 border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Number: 1., 2., 3. */}
              <span className="font-sans tabular-nums text-xs text-muted-foreground font-medium shrink-0">
                {oIdx + 1}.
              </span>

              {/* Title */}
              <span className="font-semibold text-xs text-foreground shrink-0">
                {opt.label}
              </span>

              {/* (Recommended) tag */}
              {opt.isRecommended && (
                <span className="text-[11px] text-primary/80 font-normal shrink-0">
                  (Recommended)
                </span>
              )}

              {/* Description text inline */}
              {opt.description && (
                <span className="text-[11.5px] text-muted-foreground font-normal truncate">
                  {opt.description}
                </span>
              )}
            </div>
          );
        })}

        {/* Custom Write-In User Input */}
        <div
          onClick={() => {
            setFocusedOptIdx(sortedOptions.length);
            customInputRef.current?.focus();
          }}
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors cursor-text min-w-0 border",
            isCustomSelected || focusedOptIdx === sortedOptions.length
              ? "bg-secondary/80 border-border text-foreground font-medium shadow-xs"
              : "bg-transparent hover:bg-secondary/30 border-transparent text-muted-foreground"
          )}
        >
          <span className="font-sans tabular-nums text-xs text-muted-foreground font-medium shrink-0">
            {sortedOptions.length + 1}.
          </span>
          <input
            ref={customInputRef}
            type="text"
            placeholder="Enter your answer..."
            value={customInputs[currentIndex] || ""}
            onChange={(e) => handleCustomChange(e.target.value)}
            onFocus={() => setFocusedOptIdx(sortedOptions.length)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (isCurrentAnswered) {
                  handleNext();
                }
              }
            }}
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
        </div>
      </div>

      {/* Footer Row: Tip & Action Buttons */}
      <div className="flex items-center justify-between pt-2 select-none min-w-0">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] min-w-0 truncate pr-2">
          <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">Use Tab / arrow keys to choose, then Enter or Space to select</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!isCurrentAnswered}
            className="px-3.5 py-1 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs cursor-pointer"
          >
            {currentIndex === questions.length - 1 ? "Confirm" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
