import React, { useRef, useEffect } from "react";
import { ArrowUp, Square, Sparkles, BookOpen, Lightbulb, HelpCircle } from "lucide-react";

interface ChatInputCardProps {
  inputMessage: string;
  onChangeInput: (val: string) => void;
  onSend: (customPrompt?: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  selectedModelName: string;
  showChips?: boolean;
}

const QUICK_CHIPS = [
  { label: "Jelaskan konsep ini", icon: Lightbulb },
  { label: "Beri contoh nyata", icon: BookOpen },
  { label: "Kuis / Tes pemahaman", icon: HelpCircle },
];

export function ChatInputCard({
  inputMessage,
  onChangeInput,
  onSend,
  onStop,
  isStreaming,
  selectedModelName,
  showChips = true,
}: ChatInputCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 140);
    textarea.style.height = `${Math.max(nextHeight, 26)}px`;
  }, [inputMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && inputMessage.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 select-none">
      {/* Quick Action Chips (Shown when appropriate) */}
      {showChips && !isStreaming && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 px-1">
          {QUICK_CHIPS.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => onSend(chip.label)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b1b1b] hover:bg-[#252528] border border-[#2e2e2e] text-[11px] font-medium text-[#969696] hover:text-[#d4d4d4] transition-colors cursor-pointer active:scale-98"
              >
                <Icon className="h-3 w-3 text-[#5d5d5d]" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 1-Line Input Box adhering strictly to DESIGN.md (#2b2b2b, 1px #383838, zero shadow) */}
      <div className="w-full bg-[#2b2b2b] rounded-2xl border border-[#383838] p-2 flex items-end gap-2 transition-colors focus-within:border-[#5d5d5d]">
        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => onChangeInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={
            isStreaming
              ? "Generating response..."
              : `Ask ${selectedModelName}...`
          }
          className="flex-1 bg-transparent text-[14px] leading-5 text-[#d4d4d4] placeholder:text-[#5d5d5d] outline-none resize-none py-1 px-2 max-h-36 overflow-y-auto font-sans"
        />

        <div className="shrink-0 flex items-center gap-1">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="h-8 w-8 rounded-xl bg-[#383838] hover:bg-[#48484e] text-[#f87171] hover:text-[#ffffff] flex items-center justify-center transition-colors cursor-pointer active:scale-95 border border-[#48484e]"
              aria-label="Stop generation"
              title="Stop generation"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSend()}
              disabled={!inputMessage.trim()}
              className="h-8 w-8 rounded-xl bg-[#383838] hover:bg-[#48484e] disabled:opacity-30 text-[#d4d4d4] hover:text-[#ffffff] flex items-center justify-center transition-colors cursor-pointer active:scale-95 disabled:cursor-not-allowed border border-[#48484e]"
              aria-label="Send prompt"
              title="Send prompt"
            >
              <ArrowUp className="h-4 w-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
