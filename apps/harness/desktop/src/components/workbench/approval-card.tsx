import React, { useState, useRef, useEffect } from "react";
import { SquareTerminal, CornerDownLeft } from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
import type { ApprovalRequestData, ApprovalDecision } from "../../vite-env";

export interface ApprovalCardProps {
  request: ApprovalRequestData;
  project?: string;
  isResponding?: boolean;
  onDecide: (decision: ApprovalDecision, feedback?: string) => void;
  className?: string;
}

type OptionItem = {
  id: ApprovalDecision;
  label: string;
};

function deriveApprovalTitle(command?: string, toolName?: string): string {
  if (!command) {
    return `Allow executing ${toolName || "command"}?`;
  }
  const cmd = command.trim();
  // 1. git status
  if (/^git\s+status\b/i.test(cmd)) {
    return "Allow checking git status?";
  }
  // 2. Node -e with fs.writeFileSync or similar
  const fsWriteMatch = cmd.match(/fs\.(?:writeFileSync|writeFile)\s*\(\s*['"`]([^'"`]+)['"`]/i);
  if (fsWriteMatch && fsWriteMatch[1]) {
    const fileName = fsWriteMatch[1].split(/[\/\\]/).pop();
    if (fileName) return `Allow creating ${fileName}?`;
  }
  // 3. Shell redirection to file (> or >>)
  const redirectMatch = cmd.match(/>+\s*([a-zA-Z0-9_\-\.\/\\]+)/);
  if (redirectMatch && redirectMatch[1] && !redirectMatch[1].includes("/dev/null")) {
    const fileName = redirectMatch[1].split(/[\/\\]/).pop();
    if (fileName) return `Allow creating ${fileName}?`;
  }
  // 4. touch file
  const touchMatch = cmd.match(/^touch\s+([a-zA-Z0-9_\-\.\/\\]+)/i);
  if (touchMatch && touchMatch[1]) {
    const fileName = touchMatch[1].split(/[\/\\]/).pop();
    if (fileName) return `Allow creating ${fileName}?`;
  }
  // 5. rm / del / rmdir
  if (/^(?:rm|del|rmdir|Remove-Item)\b/i.test(cmd)) {
    return "Allow deleting files/directories?";
  }
  // 6. git other commands
  if (/^git\b/i.test(cmd)) {
    const sub = cmd.split(/\s+/)[1] || "command";
    return `Allow git ${sub}?`;
  }
  // 7. package manager
  if (/^(?:npm|pnpm|yarn|bun)\s+(?:install|i|add)\b/i.test(cmd)) {
    return "Allow installing packages?";
  }
  // 8. General command
  const firstWord = cmd.split(/\s+/)[0];
  if (firstWord && firstWord.length < 25) {
    return `Allow running ${firstWord}?`;
  }
  return "Allow executing terminal command?";
}

export function ApprovalCard({
  request,
  project,
  isResponding = false,
  onDecide,
  className = "",
}: ApprovalCardProps) {
  const [selectedOption, setSelectedOption] = useState<ApprovalDecision>("allow_once");
  const [feedbackText, setFeedbackText] = useState("");
  const feedbackInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selectedOption === "deny") {
      setTimeout(() => {
        feedbackInputRef.current?.focus();
      }, 50);
    }
  }, [selectedOption]);

  const rawCommand =
    request.command || (request.args?.command ?? JSON.stringify(request.args, null, 2));

  const firstLineCmd = rawCommand.split("\n")[0].trim();
  const truncatedCmd =
    firstLineCmd.length > 60 ? `${firstLineCmd.slice(0, 57)}...` : firstLineCmd;

  const isInsideProject = Boolean(project && project !== "Outside Project");

  // Dynamic options matching reference screenshot (Image 2)
  const options: OptionItem[] = isInsideProject
    ? [
        { id: "allow_once", label: "Yes, allow this time" },
        {
          id: "allow_conversation",
          label: `Yes, and always allow '${truncatedCmd}' in this conversation`,
        },
        {
          id: "allow_project",
          label: `Yes, and always allow '${truncatedCmd}' in this project`,
        },
        { id: "allow_always", label: `Yes, and always allow '${truncatedCmd}'` },
        { id: "deny", label: "No (tell the agent what to do instead)" },
      ]
    : [
        { id: "allow_once", label: "Yes, allow this time" },
        {
          id: "allow_conversation",
          label: `Yes, and always allow '${truncatedCmd}' in this conversation`,
        },
        { id: "allow_always", label: `Yes, and always allow '${truncatedCmd}'` },
        { id: "deny", label: "No (tell the agent what to do instead)" },
      ];

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

  // Keyboard shortcuts matching options: 1..5 to select, Enter to submit, Esc to skip
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

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        e.preventDefault();
        const target = options[num - 1];
        if (target) {
          setSelectedOption(target.id);
        }
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
  }, [selectedOption, feedbackText, isResponding, options]);

  const title = deriveApprovalTitle(request.command, request.toolName);

  return (
    <div
      className={cn(
        "w-full rounded-2xl bg-[#1c1c1f] border border-[#2d2d31] p-3.5 sm:p-4 text-[#d4d4d4] select-none animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-none font-sans",
        className
      )}
    >
      {/* 1. Header: Inline SquareTerminal Icon & Title directly matching reference (Image 2) */}
      <div className="flex items-center gap-2 min-w-0">
        <SquareTerminal className="w-3.5 h-3.5 text-[#88888e] shrink-0" />
        <h2 className="text-[13px] font-medium text-[#ededed] tracking-tight truncate">
          {title}
        </h2>
      </div>

      {/* 2. Command Preview Box: Clean dark bar without borders or copy buttons */}
      <div className="mt-2.5 w-full rounded-lg bg-[#131315] px-3 py-2">
        <ScrollArea className="max-h-36 w-full">
          <pre className="text-[12px] sm:text-[12.5px] font-mono text-[#dcdcdc] leading-relaxed select-text whitespace-pre-wrap break-all font-normal">
            {rawCommand}
          </pre>
        </ScrollArea>
      </div>

      {/* 3. Numbered Options List matching reference (Image 2) */}
      <div className="mt-2.5 flex flex-col gap-0.5">
        {options.map((opt, idx) => {
          const isSelected = selectedOption === opt.id;
          return (
            <div key={opt.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => setSelectedOption(opt.id)}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors select-none w-full",
                  isSelected
                    ? "bg-[#28282c] text-[#ededed] font-medium"
                    : "bg-transparent hover:bg-[#232326] text-[#8e8e93] hover:text-[#b8b8be]"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded text-[11px] font-mono flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "bg-[#38383f] text-[#ededed] font-medium"
                      : "bg-transparent text-[#66666d]"
                  )}
                >
                  {idx + 1}
                </div>
                <span className="text-[12.5px] leading-tight truncate">
                  {opt.label}
                </span>
              </button>

              {/* Conditional Feedback Textarea on Deny */}
              {opt.id === "deny" && isSelected && (
                <div
                  className="mt-1 pl-6.5 pr-1 animate-in fade-in slide-in-from-top-1 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    ref={feedbackInputRef}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={2}
                    placeholder="Tell the agent what to do instead..."
                    className="w-full rounded-md bg-[#141416] border border-[#2e2e2e] focus:border-[#0066ff] p-2 text-[12px] text-[#d4d4d4] placeholder:text-[#555555] outline-none font-sans leading-relaxed resize-none transition-colors"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Footer Action Buttons: No top divider line! Matching reference (Image 2) */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isResponding}
          className="px-3 py-1 rounded text-[12.5px] font-normal text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer mr-1 disabled:opacity-50"
          title="Skip (Esc)"
        >
          Skip
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isResponding}
          className="px-3.5 py-1.5 rounded-lg bg-[#0066ff] hover:bg-[#0055d4] text-white text-[12.5px] font-medium flex items-center gap-1.5 shadow-none transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Submit (Enter)"
        >
          <span>Submit</span>
          <CornerDownLeft className="w-3 h-3 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
