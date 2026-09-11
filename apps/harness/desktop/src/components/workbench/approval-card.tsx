import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { SquareTerminal, CornerDownLeft, Info } from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
import { AttachedTaskBanner } from "./attached-task-banner";
import type {
  ApprovalRequestData,
  ApprovalDecision,
  BackgroundTaskItem,
} from "../../vite-env";

export interface ApprovalCardProps {
  request: ApprovalRequestData;
  project?: string;
  isResponding?: boolean;
  onDecide: (decision: ApprovalDecision, feedback?: string) => void;
  runningTasks?: BackgroundTaskItem[];
  onSelectTask?: (task: BackgroundTaskItem) => void;
  onStopTask?: (taskId: string) => void;
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
  runningTasks,
  onSelectTask,
  onStopTask,
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
        "w-full max-w-full rounded-xl bg-white dark:bg-[#232323] border border-[#e2e2e4] dark:border-[#383838] p-3.5 sm:p-4 text-xs font-sans select-none shadow-md dark:shadow-none outline-none transition-colors",
        className
      )}
    >
      {/* 0. Running Tasks Banner attached above card when tasks are active */}
      {runningTasks && runningTasks.length > 0 && (
        <AttachedTaskBanner
          tasks={runningTasks}
          onSelectTask={onSelectTask || (() => {})}
          onStopTask={onStopTask || (() => {})}
          className="-mx-3.5 -mt-3.5 sm:-mx-4 sm:-mt-4 mb-2 rounded-t-xl border-b border-[#e2e2e4] dark:border-[#383838] bg-[#f8f8f8] dark:bg-[#1e1e1e]"
        />
      )}

      {/* 1. Header Row: [ Terminal ] Title matching QuestionCard */}
      <div className="flex items-center justify-between pb-1.5 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
          <span className="px-2.5 py-0.5 rounded bg-black/5 dark:bg-[#343434] text-[#262626] dark:text-[#d4d4d4] font-medium text-[11px] shrink-0">
            Terminal
          </span>
          <span className="font-semibold text-[13px] text-[#1c1c1e] dark:text-white truncate leading-snug">
            {title}
          </span>
        </div>
      </div>

      {/* 2. Command Preview Box: Compact, rounded, dark bar */}
      <div className="my-1.5 w-full rounded bg-[#f4f4f6] dark:bg-[#1c1c1e] border border-[#e2e2e4] dark:border-[#303030] px-3 py-2">
        <ScrollArea className="max-h-32 w-full">
          <pre className="text-[12px] font-mono text-[#262626] dark:text-[#dcdcdc] leading-relaxed select-text whitespace-pre-wrap break-all font-normal">
            {rawCommand}
          </pre>
        </ScrollArea>
      </div>

      {/* 3. Numbered Options List matching QuestionCard styling */}
      <div className="space-y-1 py-1.5">
        {options.map((opt, idx) => {
          const isSelected = selectedOption === opt.id;
          return (
            <div key={opt.id} className="flex flex-col">
              <div
                onClick={() => setSelectedOption(opt.id)}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-1.5 rounded transition-colors cursor-pointer min-w-0",
                  isSelected
                    ? "bg-black/[0.07] dark:bg-white/[0.08] text-[#111111] dark:text-white"
                    : "bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[#444444] dark:text-[#b0b0b0]"
                )}
              >
                {/* Number: 1., 2., 3., 4., 5. */}
                <span className="font-mono text-xs text-[#888888] dark:text-[#777777] font-medium shrink-0">
                  {idx + 1}.
                </span>

                {/* Option Label */}
                <span
                  className={cn(
                    "text-xs leading-snug truncate",
                    isSelected
                      ? "font-semibold text-[#1c1c1e] dark:text-white"
                      : "text-[#333333] dark:text-[#cccccc]"
                  )}
                >
                  {opt.label}
                </span>
              </div>

              {/* Conditional Feedback Textarea on Deny */}
              {opt.id === "deny" && isSelected && (
                <div
                  className="mt-1 pl-6 pr-1 animate-in fade-in slide-in-from-top-1 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    ref={feedbackInputRef}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={2}
                    placeholder="Tell the agent what to do instead..."
                    className="w-full rounded bg-white dark:bg-[#1a1a1a] border border-[#e2e2e4] dark:border-[#383838] p-2 text-xs text-[#1c1c1e] dark:text-white placeholder:text-[#777777] dark:placeholder:text-[#666666] outline-none font-sans leading-relaxed resize-none transition-colors"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Footer Action Buttons matching QuestionCard */}
      <div className="flex items-center justify-between pt-2 select-none min-w-0">
        <div className="flex items-center gap-1.5 text-[#777777] dark:text-[#888888] text-[11px] min-w-0 truncate pr-2">
          <Info className="w-3.5 h-3.5 text-[#777777] dark:text-[#888888] shrink-0" />
          <span className="truncate">Press 1..{options.length} to choose, Enter to submit, Esc to skip</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isResponding}
            className="px-2.5 py-1 text-xs font-medium text-[#777777] dark:text-[#999999] hover:text-[#111111] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-30"
            title="Skip (Esc)"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isResponding}
            className="px-3.5 py-1 rounded text-xs font-semibold bg-[#262626] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-[#e6e6e6] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs cursor-pointer"
            title="Submit (Enter)"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

export interface SmoothCardMorphProps {
  activeKey: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * SmoothCardMorph seamlessly swaps cards in place (e.g. AI Input <-> Approval Card)
 * and smoothly animates the height expansion / contraction in a fraction of a second (~260ms)
 * using an ease-out spring-like cubic bezier curve.
 */
export function SmoothCardMorph({
  activeKey,
  children,
  className = "",
}: SmoothCardMorphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevKeyRef = useRef(activeKey);
  const prevHeightRef = useRef<number | null>(null);

  // Continuously record latest stable height of content when not in transition
  useLayoutEffect(() => {
    if (contentRef.current && !isTransitioning) {
      prevHeightRef.current = contentRef.current.offsetHeight;
    }
  });

  useLayoutEffect(() => {
    if (prevKeyRef.current !== activeKey) {
      const oldH = prevHeightRef.current ?? (containerRef.current?.offsetHeight ?? 0);
      const newH = contentRef.current?.offsetHeight ?? 0;

      prevKeyRef.current = activeKey;

      if (oldH > 0 && newH > 0 && Math.abs(oldH - newH) > 4) {
        // 1. Lock to old height synchronously
        setHeight(oldH);
        setIsTransitioning(true);

        // 2. Next animation frame, smoothly animate to the target height
        const raf = requestAnimationFrame(() => {
          setHeight(newH);
        });

        return () => cancelAnimationFrame(raf);
      }
    }
  }, [activeKey]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current && e.propertyName === "height") {
      // Release explicit height to "auto" so dynamic inner content (like textareas) resizes naturally
      setHeight(null);
      setIsTransitioning(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onTransitionEnd={handleTransitionEnd}
      style={{
        height: height !== null ? `${height}px` : "auto",
        transition: isTransitioning
          ? "height 260ms cubic-bezier(0.16, 1, 0.3, 1)"
          : "none",
        overflow: isTransitioning ? "hidden" : "visible",
      }}
      className={cn("w-full transition-colors", className)}
    >
      <div
        ref={contentRef}
        key={activeKey}
        className="w-full animate-in fade-in duration-200"
      >
        {children}
      </div>
    </div>
  );
}
