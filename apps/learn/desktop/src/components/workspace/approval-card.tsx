import React, { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import type { ApprovalRequestData, ApprovalDecision } from "../../vite-env";

export interface ApprovalCardProps {
  request: ApprovalRequestData;
  isResponding?: boolean;
  onDecide: (decision: ApprovalDecision, feedback?: string) => void;
  className?: string;
}

type OptionItem = {
  id: ApprovalDecision;
  label: string;
};

function deriveApprovalTitle(command?: string, toolName?: string): string {
  const tLower = (toolName || "").toLowerCase();
  if (tLower === "run_python" || tLower === "python" || tLower === "py" || tLower === "runpython") {
    return "Allow executing Python script?";
  }
  if (tLower === "write" || tLower === "writefile") {
    const rawP = command || "";
    const fileName = rawP.replace(/^write:\s*/, "").split(/[\/\\]/).pop();
    return fileName ? `Allow creating ${fileName}?` : "Allow writing file?";
  }
  if (tLower === "edit" || tLower === "editfile" || tLower === "replaceinfile") {
    const rawP = command || "";
    const fileName = rawP.replace(/^edit:\s*/, "").split(/[\/\\]/).pop();
    return fileName ? `Allow editing ${fileName}?` : "Allow modifying file?";
  }
  if (tLower === "applypatch" || tLower === "patch") {
    const rawP = command || "";
    const fileName = rawP.replace(/^applypatch:\s*/, "").split(/[\/\\]/).pop();
    return fileName ? `Allow patching ${fileName}?` : "Allow modifying file?";
  }

  if (!command) {
    return `Allow executing ${toolName || "action"}?`;
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
  isResponding = false,
  onDecide,
  className = "",
}: ApprovalCardProps) {
  const { t } = useI18n();
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
    request.command ||
    (request.args?.command ?? (typeof request.args === "string" ? request.args : JSON.stringify(request.args, null, 2)));

  const firstLineCmd = (rawCommand || "").split("\n")[0].trim();
  const truncatedCmd =
    firstLineCmd.length > 50 ? `${firstLineCmd.slice(0, 47)}...` : firstLineCmd;

  const options: OptionItem[] = [
    {
      id: "allow_once",
      label: t("allowOnce"),
    },
    {
      id: "allow_conversation",
      label: `${t("allowConversation")} ('${truncatedCmd}')`,
    },
    {
      id: "deny",
      label: t("denyAction"),
    },
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

  // Keyboard shortcuts matching options: 1..3 to select, Enter to submit, Esc to skip
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
        "w-full max-w-full rounded-2xl bg-card border border-border/80 p-3.5 sm:p-4 text-xs select-none shadow-xl transition-colors animate-in fade-in zoom-in-95 duration-150",
        className
      )}
    >
      {/* 1. Header Row */}
      <div className="flex items-center justify-between pb-1.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-3 flex-wrap">
          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium text-[11px] shrink-0 border border-primary/20">
            {request.toolName || "Terminal"}
          </span>
          <span className="font-medium text-[13px] text-foreground truncate leading-snug">
            {title}
          </span>
        </div>
      </div>

      {/* 2. Command Preview Box */}
      {rawCommand && (
        <div className="my-2 w-full rounded-xl bg-secondary/40 border border-border/70 px-3 py-2">
          <ScrollArea className="max-h-28 w-full">
            <pre className="text-[11.5px] font-mono text-foreground/90 leading-relaxed select-text whitespace-pre-wrap break-all font-normal">
              {rawCommand}
            </pre>
          </ScrollArea>
        </div>
      )}

      {/* 3. Numbered Options List */}
      <div className="space-y-1 py-1.5">
        {options.map((opt, idx) => {
          const isSelected = selectedOption === opt.id;
          return (
            <div key={opt.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => setSelectedOption(opt.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer text-left min-w-0 border",
                  isSelected
                    ? "bg-secondary/80 border-border text-foreground font-medium shadow-xs"
                    : "bg-transparent hover:bg-secondary/40 border-transparent text-muted-foreground"
                )}
              >
                <span className="font-sans tabular-nums text-xs text-muted-foreground/80 font-medium shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-xs leading-snug truncate">
                  {opt.label}
                </span>
              </button>

              {/* Conditional Feedback Textarea on Deny */}
              {opt.id === "deny" && isSelected && (
                <div
                  className="mt-1.5 pl-6 pr-1 animate-in fade-in slide-in-from-top-1 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    ref={feedbackInputRef}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={2}
                    placeholder={t("feedbackPlaceholder")}
                    className="w-full rounded-xl bg-secondary/30 border border-border/70 p-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring font-sans leading-relaxed resize-none transition-colors"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Footer Action Buttons */}
      <div className="flex items-center justify-between pt-2 select-none min-w-0 border-t border-border/40 mt-1">
        <div className="flex items-center gap-1.5 text-muted-foreground/70 text-[11px] min-w-0 truncate pr-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Press 1..{options.length}, Enter to submit, Esc to skip</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isResponding}
            className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30"
            title="Skip (Esc)"
          >
            {t("skipAction")}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isResponding}
            className="px-3.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs cursor-pointer"
            title="Submit (Enter)"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
