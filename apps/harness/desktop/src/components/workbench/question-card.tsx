import React, { useState } from "react";
import { HelpCircle, Check, Send, Sparkles } from "lucide-react";
import type { QuestionItem } from "../../vite-env";

export interface QuestionCardProps {
  toolCallId: string;
  questions: QuestionItem[];
  onAnswer: (toolCallId: string, answer: any) => void;
  isAnswered?: boolean;
  answeredValue?: any;
  className?: string;
}

export function QuestionCard({
  toolCallId,
  questions,
  onAnswer,
  isAnswered = false,
  answeredValue,
  className = "",
}: QuestionCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string[]>>({});
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<boolean>(isAnswered);
  const [finalAnswers, setFinalAnswers] = useState<any>(answeredValue);

  if (!questions || questions.length === 0) return null;

  const handleSelectOption = (qIdx: number, optValue: string, isMulti?: boolean) => {
    if (submitted) return;
    setSelectedOptions((prev) => {
      const current = prev[qIdx] || [];
      if (isMulti) {
        const next = current.includes(optValue)
          ? current.filter((v) => v !== optValue)
          : [...current, optValue];
        return { ...prev, [qIdx]: next };
      } else {
        return { ...prev, [qIdx]: [optValue] };
      }
    });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submitted) return;

    const answers = questions.map((q, idx) => {
      const chosen = selectedOptions[idx] || [];
      const custom = (customInputs[idx] || "").trim();
      if (custom) {
        return chosen.length > 0 ? [...chosen, custom].join(", ") : custom;
      }
      if (chosen.length > 0) {
        return q.is_multi_select ? chosen : chosen[0]!;
      }
      const firstOpt = q.options?.[0];
      const fallbackVal =
        typeof firstOpt === "string"
          ? firstOpt
          : firstOpt?.value || firstOpt?.label || "Confirmed";
      return q.is_multi_select ? [fallbackVal] : fallbackVal;
    });

    const result = answers.length === 1 ? answers[0] : answers;
    setFinalAnswers(result);
    setSubmitted(true);
    onAnswer(toolCallId, result);
  };

  return (
    <div
      className={`w-full max-w-xl rounded-2xl bg-[#1c1c1c] border border-[#333333] p-4 text-xs font-sans select-none my-2 shadow-xl ${className}`}
    >
      <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-[#2a2a2a] text-neutral-300">
        <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="font-medium text-sm text-white">Action Required</span>
        {submitted && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <Check className="w-3 h-3" /> Answered
          </span>
        )}
      </div>

      <div className="space-y-4">
        {questions.map((q, qIdx) => {
          const rawOptions: Array<{ label: string; value: string; isRecommended: boolean }> =
            (q.options || []).map((opt, oIdx) => {
              const text = typeof opt === "string" ? opt : opt.label || opt.value || "";
              const val = typeof opt === "string" ? opt : opt.value || opt.label || "";
              const isRecommended =
                oIdx === 0 ||
                text.toLowerCase().includes("(recommended)") ||
                text.toLowerCase().includes("recommended");
              const cleanLabel = text.replace(/\(Recommended\)/i, "").trim();
              return { label: cleanLabel, value: val, isRecommended };
            });

          const sortedOptions = [...rawOptions].sort((a, b) => {
            if (a.isRecommended && !b.isRecommended) return -1;
            if (!a.isRecommended && b.isRecommended) return 1;
            return 0;
          });

          const currentSelected = selectedOptions[qIdx] || [];

          return (
            <div key={qIdx} className="space-y-2.5">
              <p className="font-medium text-neutral-200 text-xs leading-relaxed">
                {q.question}
              </p>

              {/* Options List with (Recommended) at the top */}
              <div className="space-y-1.5">
                {sortedOptions.map((opt, optIdx) => {
                  const isSelected = currentSelected.includes(opt.value);
                  return (
                    <div
                      key={optIdx}
                      onClick={() => handleSelectOption(qIdx, opt.value, q.is_multi_select)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-500/10 border-blue-500/50 text-white font-medium"
                          : opt.isRecommended
                          ? "bg-[#242424] hover:bg-[#2a2a2a] border-[#383838] text-neutral-200"
                          : "bg-[#1e1e1e] hover:bg-[#252525] border-[#2e2e2e] text-neutral-300"
                      } ${submitted ? "pointer-events-none opacity-80" : ""}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-4 h-4 rounded-${
                            q.is_multi_select ? "md" : "full"
                          } border flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? "bg-blue-500 border-blue-500 text-white"
                              : "border-[#4a4a4a] bg-transparent"
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span className="text-xs truncate">{opt.label}</span>
                      </div>

                      {opt.isRecommended && (
                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                          <Sparkles className="w-2.5 h-2.5" />
                          (Recommended)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Custom Write-in User Input */}
              {!submitted && (
                <div className="pt-1">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#141414] border border-[#2e2e2e] focus-within:border-[#444444] transition-colors">
                    <input
                      type="text"
                      placeholder="Or type custom instructions / response..."
                      value={customInputs[qIdx] || ""}
                      onChange={(e) =>
                        setCustomInputs((prev) => ({ ...prev, [qIdx]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      className="w-full bg-transparent text-white placeholder-neutral-500 outline-none text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Submit Button */}
        {!submitted && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs shadow-md transition-all cursor-pointer"
            >
              <span>Submit Answer</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
