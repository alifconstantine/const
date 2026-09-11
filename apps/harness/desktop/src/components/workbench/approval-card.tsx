import React, { useState, useRef, useEffect } from "react";
import {
  Terminal,
  Folder,
  Copy,
  Check,
  CornerDownLeft,
} from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
import type { ApprovalRequestData } from "../../vite-env";

export interface ApprovalCardProps {
  request: ApprovalRequestData;
  isResponding?: boolean;
  onDecide: (
    decision: "allow_once" | "allow_always" | "deny" | "skip",
    feedback?: string
  ) => void;
  className?: string;
}

type SelectedOption = "allow_once" | "allow_always" | "deny";

function deriveApprovalTitle(command?: string, toolName?: string): string {
  if (!command) {
    return `Allow executing ${toolName || "command"}?`;
  }
  const cmd = command.trim();
  // 1. Node -e with fs.writeFileSync or similar
  const fsWriteMatch = cmd.match(/fs\.(?:writeFileSync|writeFile)\s*\(\s*['"`]([^'"`]+)['"`]/i);
  if (fsWriteMatch && fsWriteMatch[1]) {
    const fileName = fsWriteMatch[1].split(/[\/\\]/).pop();
    if (fileName) return `Allow creating ${fileName}?`;
  }
  // 2. Shell redirection to file (> or >>)
  const redirectMatch = cmd.match(/>+\s*([a-zA-Z0-9_\-\.\/\\]+)/);
  if (redirectMatch && redirectMatch[1] && !redirectMatch[1].includes("/dev/null")) {
    const fileName = redirectMatch[1].split(/[\/\\]/).pop();
    if (fileName) return `Allow creating ${fileName}?`;
  }
  // 3. touch file
  const touchMatch = cmd.match(/^touch\s+([a-zA-Z0-9_\-\.\/\\]+)/i);
  if (touchMatch && touchMatch[1]) {
    const fileName = touchMatch[1].split(/[\/\\]/).pop();
    if (fileName) return `Allow creating ${fileName}?`;
  }
  // 4. rm / del / rmdir
  if (/^(?:rm|del|rmdir|Remove-Item)\b/i.test(cmd)) {
    return "Allow deleting files/directories?";
  }
  // 5. git
  if (/^git\b/i.test(cmd)) {
    const sub = cmd.split(/\s+/)[1] || "command";
    return `Allow git ${sub}?`;
  }
  // 6. package manager
  if (/^(?:npm|pnpm|yarn|bun)\s+(?:install|i|add)\b/i.test(cmd)) {
    return "Allow installing packages?";
  }
  // 7. General first command
  const firstWord = cmd.split(/\s+/)[0];
  if (firstWord && firstWord.length < 25) {
    return `Allow running ${firstWord}?`;
  }
  return "Allow executing terminal command?";
}

export function ApprovalCard({
  request,
  isResponding = false,
  onDecide,
  className = "",
}: ApprovalCardProps) {
  const [selectedOption, setSelectedOption] = useState<SelectedOption>("allow_once");
  const [feedbackText, setFeedbackText] = useState("");
  const [copied, setCopied] = useState(false);
  const feedbackInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selectedOption === "deny") {
      setTimeout(() => {
        feedbackInputRef.current?.focus();
      }, 50);
    }
  }, [selectedOption]);

  const rawCommand = request.command || (request.args?.command ?? JSON.stringify(request.args, null, 2));

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(rawCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleSubmit = () => {
    if (isResponding) return;
    if (selectedOption === "deny") {
      onDecide("deny", feedbackText.trim() || undefined);
    } else {
      onDecide(selectedOption);
    }
  };

  const handleSkip = () => {
    if (isResponding) return;
    onDecide("skip");
  };

  // Keyboard shortcuts: 1, 2, 3 to select, Enter to submit, Esc to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInsideFeedback = activeEl === feedbackInputRef.current;
      const tagName = (activeEl?.tagName || "").toLowerCase();
      const isOtherInput =
        !isInsideFeedback &&
        (tagName === "input" ||
          tagName === "textarea" ||
          (activeEl as HTMLElement)?.isContentEditable);

      if (isOtherInput) {
        return;
      }

      if (isInsideFeedback) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleSubmit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          handleSkip();
        }
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        setSelectedOption("allow_once");
      } else if (e.key === "2") {
        e.preventDefault();
        setSelectedOption("allow_always");
      } else if (e.key === "3") {
        e.preventDefault();
        setSelectedOption("deny");
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedOption, feedbackText, isResponding]);

  const title = deriveApprovalTitle(request.command, request.toolName);
  const truncatedCmdForOption =
    rawCommand.length > 85 ? `${rawCommand.slice(0, 82)}...` : rawCommand;

  return (
    <div
      className={cn(
        "w-full rounded-2xl bg-[#1c1c1e] dark:bg-[#1e1e20] border border-[#333336] p-4 sm:p-5 text-[#d4d4d4] select-none animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-none font-sans",
        className
      )}
    >
      {/* 1. Header: Icon & Dynamic Title matching screenshot */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-5 h-5 rounded border border-[#444448] bg-[#28282b] flex items-center justify-center text-[#d4d4d4] shrink-0">
            <Terminal className="w-3 h-3 text-[#d4d4d4]" />
          </div>
          <h2 className="text-[14px] sm:text-[15px] font-medium text-white tracking-tight truncate">
            {title}
          </h2>
        </div>
      </div>

      {/* 2. Command Preview Box */}
      <div className="flex flex-col gap-1.5">
        {request.cwd && (
          <div
            className="flex items-center gap-1.5 text-[11px] font-mono text-[#777777] px-0.5 truncate"
            title={request.cwd}
          >
            <Folder className="w-3 h-3 text-[#555555] shrink-0" />
            <span className="text-[#555555]">cwd:</span>
            <span className="text-[#999999] truncate">{request.cwd}</span>
          </div>
        )}

        <div className="relative group rounded-xl bg-[#121214] border border-[#2b2b2e] p-3">
          <ScrollArea className="max-h-40 w-full pr-8">
            <pre className="text-[12px] sm:text-[12.5px] font-mono text-[#dcdcdc] leading-relaxed select-text whitespace-pre-wrap break-all font-normal">
              {rawCommand}
            </pre>
          </ScrollArea>

          {/* Quick Copy Button */}
          <button
            type="button"
            onClick={handleCopyCommand}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-[#1e1e20] hover:bg-[#28282b] border border-[#38383c] text-[#888888] hover:text-white transition-colors cursor-pointer"
            title="Copy command"
            aria-label="Copy command"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#4ade80]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 3. Numbered Options List matching screenshot */}
      <div className="mt-3.5 flex flex-col gap-1.5">
        {/* Option 1: Yes, allow this time */}
        <div
          onClick={() => setSelectedOption("allow_once")}
          className={cn(
            "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer text-left",
            selectedOption === "allow_once"
              ? "bg-[#28282b] border-[#444448] text-white"
              : "bg-transparent hover:bg-[#222225] border-transparent text-[#a3a3a3] hover:text-[#d4d4d4]"
          )}
        >
          <div
            className={cn(
              "w-5 h-5 rounded flex items-center justify-center font-mono text-[11px] font-semibold shrink-0 transition-colors",
              selectedOption === "allow_once"
                ? "bg-[#38383c] text-white"
                : "bg-[#262628] text-[#777777]"
            )}
          >
            1
          </div>
          <span className="text-[13px] font-medium leading-tight">
            Yes, allow this time
          </span>
        </div>

        {/* Option 2: Yes, and always allow '<command>' */}
        <div
          onClick={() => setSelectedOption("allow_always")}
          className={cn(
            "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer text-left min-w-0",
            selectedOption === "allow_always"
              ? "bg-[#28282b] border-[#444448] text-white"
              : "bg-transparent hover:bg-[#222225] border-transparent text-[#a3a3a3] hover:text-[#d4d4d4]"
          )}
        >
          <div
            className={cn(
              "w-5 h-5 rounded flex items-center justify-center font-mono text-[11px] font-semibold shrink-0 transition-colors",
              selectedOption === "allow_always"
                ? "bg-[#38383c] text-white"
                : "bg-[#262628] text-[#777777]"
            )}
          >
            2
          </div>
          <span className="text-[13px] font-medium leading-tight truncate">
            Yes, and always allow &apos;{truncatedCmdForOption}&apos;
          </span>
        </div>

        {/* Option 3: No (tell the agent what to do instead) */}
        <div
          onClick={() => setSelectedOption("deny")}
          className={cn(
            "flex flex-col gap-2 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer text-left",
            selectedOption === "deny"
              ? "bg-[#28282b] border-[#444448] text-white"
              : "bg-transparent hover:bg-[#222225] border-transparent text-[#a3a3a3] hover:text-[#d4d4d4]"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded flex items-center justify-center font-mono text-[11px] font-semibold shrink-0 transition-colors",
                selectedOption === "deny"
                  ? "bg-[#38383c] text-white"
                  : "bg-[#262628] text-[#777777]"
              )}
            >
              3
            </div>
            <span className="text-[13px] font-medium leading-tight">
              No (tell the agent what to do instead)
            </span>
          </div>

          {/* Conditional Feedback Textarea */}
          {selectedOption === "deny" && (
            <div
              className="mt-1 pl-8 animate-in fade-in slide-in-from-top-1 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <textarea
                ref={feedbackInputRef}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={2}
                placeholder="Tell the agent what to do instead (e.g. use bun, run tests first, skip this command)..."
                className="w-full rounded-lg bg-[#141416] border border-[#38383c] focus:border-[#0066ff] p-2.5 text-[12.5px] text-[#d4d4d4] placeholder:text-[#555555] outline-none font-sans leading-relaxed resize-none transition-colors"
              />
              <span className="text-[10px] text-[#666666] mt-1 block">
                Press Ctrl+Enter or click Submit to send instruction.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Footer Action Buttons */}
      <div className="mt-4 pt-3 flex items-center justify-end gap-2 border-t border-[#2d2d30]">
        {/* Skip text button */}
        <button
          type="button"
          onClick={handleSkip}
          disabled={isResponding}
          className="px-3.5 py-1.5 rounded-lg text-[13px] font-normal text-[#888888] hover:text-[#e0e0e0] transition-colors cursor-pointer disabled:opacity-50"
          title="Skip this command (Esc)"
        >
          Skip
        </button>

        {/* Submit button matching screenshot (blue primary button) */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isResponding}
          className="px-4 py-1.5 rounded-lg bg-[#0066ff] hover:bg-[#0055d4] text-white text-[13px] font-medium transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-none"
          title="Submit decision (Enter)"
        >
          <span>Submit</span>
          <CornerDownLeft className="w-3 h-3 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
