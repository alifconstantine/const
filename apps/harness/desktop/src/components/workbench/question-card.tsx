import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import type { QuestionItem } from "../../vite-env";

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
  if (lower.includes("fitur") || lower.includes("feature") || lower.includes("layout")) {
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

  // Normalize options list
  const rawOptions: Array<{ label: string; description?: string; isRecommended: boolean }> =
    (currentQ.options || []).map((opt: any, oIdx) => {
      if (typeof opt === "string") {
        const isRec = oIdx === 0 || opt.toLowerCase().includes("recommended");
        const clean = opt.replace(/\(Recommended\)/i, "").trim();
        return { label: clean, isRecommended: isRec };
      }
      const label = String(opt?.label || opt?.value || "");
      const isRec =
        Boolean(opt?.recommended) ||
        oIdx === 0 ||
        label.toLowerCase().includes("recommended");
      const cleanLabel = label.replace(/\(Recommended\)/i, "").trim();
      return {
        label: cleanLabel,
        description: opt?.description,
        isRecommended: isRec,
      };
    });

  // Sort recommended to top
  const sortedOptions = [...rawOptions].sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return 0;
  });

  const totalOptionsCount = sortedOptions.length + 1; // + 1 for custom input (Option 4)
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
              : q.options[0].label
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
      className={`w-full max-w-full rounded-xl bg-white dark:bg-[#232323] border border-[#e2e2e4] dark:border-[#383838] p-3.5 sm:p-4 text-xs font-sans select-none shadow-md dark:shadow-none outline-none transition-colors ${className}`}
    >
      {/* Header Row: [ Category ] Title < 1/2 > */}
      <div className="flex items-center justify-between pb-1.5 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
          <span className="px-2.5 py-0.5 rounded bg-black/5 dark:bg-[#343434] text-[#262626] dark:text-[#d4d4d4] font-medium text-[11px] shrink-0">
            {category}
          </span>
          <span className="font-semibold text-[13px] text-[#1c1c1e] dark:text-white truncate leading-snug">
            {currentQ.question}
          </span>
        </div>

        {/* Pagination < 1/2 > - Next is disabled until current question is answered/confirmed */}
        <div className="flex items-center gap-1 shrink-0 text-neutral-400 font-sans tabular-nums text-xs">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Previous question"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-1 text-[#666666] dark:text-[#999999] text-[11.5px] select-none font-sans">
            {currentIndex + 1} / {questions.length}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex >= questions.length - 1 || !isCurrentAnswered}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-black dark:hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
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

      {/* Options List matching Image 1: Single horizontal line per option, rounded, no borders */}
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
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded transition-colors cursor-pointer min-w-0 ${
                isSelected
                  ? "bg-black/[0.07] dark:bg-white/[0.08] text-[#111111] dark:text-white"
                  : isFocused
                  ? "bg-black/[0.04] dark:bg-white/[0.05] text-[#222222] dark:text-[#e0e0e0]"
                  : "bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[#444444] dark:text-[#b0b0b0]"
              }`}
            >
              {/* Number: 1., 2., 3. */}
              <span className="font-sans tabular-nums text-xs text-[#888888] dark:text-[#777777] font-medium shrink-0">
                {oIdx + 1}.
              </span>

              {/* Title */}
              <span className="font-semibold text-xs text-[#1c1c1e] dark:text-white shrink-0">
                {opt.label}
              </span>

              {/* (Recommended) tag */}
              {opt.isRecommended && (
                <span className="text-[11px] text-[#777777] dark:text-[#888888] font-normal shrink-0">
                  (Recommended)
                </span>
              )}

              {/* Description text inline */}
              {opt.description && (
                <span className="text-[11.5px] text-[#666666] dark:text-[#888888] font-normal truncate">
                  {opt.description}
                </span>
              )}
            </div>
          );
        })}

        {/* Option 4: Custom Write-In User Input matching Image 1 */}
        <div
          onClick={() => {
            setFocusedOptIdx(sortedOptions.length);
            customInputRef.current?.focus();
          }}
          className={`flex items-center gap-2.5 px-2 py-1.5 rounded transition-colors cursor-text min-w-0 ${
            isCustomSelected || focusedOptIdx === sortedOptions.length
              ? "bg-black/[0.07] dark:bg-white/[0.08] text-[#111111] dark:text-white"
              : "bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[#555555] dark:text-[#999999]"
          }`}
        >
          <span className="font-sans tabular-nums text-xs text-[#888888] dark:text-[#777777] font-medium shrink-0">
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
            className="w-full bg-transparent text-xs text-[#1c1c1e] dark:text-white placeholder:text-[#777777] dark:placeholder:text-[#666666] outline-none"
          />
        </div>
      </div>

      {/* Footer Row: Tip & Action Buttons matching Image 1 */}
      <div className="flex items-center justify-between pt-2 select-none min-w-0">
        <div className="flex items-center gap-1.5 text-[#777777] dark:text-[#888888] text-[11px] min-w-0 truncate pr-2">
          <Info className="w-3.5 h-3.5 text-[#777777] dark:text-[#888888] shrink-0" />
          <span className="truncate">Use Tab / arrow keys to choose, then Enter or Space to select</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-2.5 py-1 text-xs font-medium text-[#777777] dark:text-[#999999] hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!isCurrentAnswered}
            className="px-3.5 py-1 rounded text-xs font-semibold bg-[#262626] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-[#e6e6e6] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs cursor-pointer"
          >
            {currentIndex === questions.length - 1 ? "Confirm" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
