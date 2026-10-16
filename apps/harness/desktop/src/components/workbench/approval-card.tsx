import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { PenLine, Terminal, Info } from "lucide-react";
import { cn } from "@const/ui";
import { AttachedTaskBanner } from "./attached-task-banner";
import { FileIcon } from "./file-icon";
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

type ApprovalOptionId = "allow_once" | "full_access" | "deny" | "tell_model";

interface OptionDef {
  id: ApprovalOptionId;
  title: string;
  desc: string;
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
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Detect if this approval is for a file mutation or command
  const isMutation = Boolean(
    request.isMutation ||
      request.targetFile ||
      request.filePath ||
      (request.toolName &&
        /write|edit|replace|patch|createfile|modify/i.test(request.toolName))
  );

  // 2. Extract target filename and directory path for mutations
  const fullPath =
    request.filePath ||
    (typeof request.args === "object" && request.args
      ? request.args.targetFile ||
        request.args.TargetFile ||
        request.args.filePath ||
        request.args.path ||
        ""
      : "");

  const targetFileName =
    request.targetFile ||
    (fullPath ? fullPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() : "") ||
    "file";

  const rawDir =
    request.dirPath ||
    (fullPath ? fullPath.replace(/\\/g, "/").split("/").slice(0, -1).join("/") : "");
  const dirPath = rawDir ? (rawDir.endsWith("/") ? rawDir : `${rawDir}/`) : "";

  // 3. Diff stats (e.g. +385 / -12)
  let diffStats = request.diffStats;
  if (!diffStats && isMutation && request.args && typeof request.args === "object") {
    if (request.args.CodeContent || request.args.content || request.args.code) {
      const codeStr = request.args.CodeContent || request.args.content || request.args.code || "";
      const lines = typeof codeStr === "string" ? codeStr.split("\n").length : 1;
      diffStats = { added: lines, removed: 0 };
    } else if (request.args.ReplacementContent) {
      const rep = (request.args.ReplacementContent || "").split("\n").length;
      const tar = (request.args.TargetContent || "").split("\n").length;
      diffStats = { added: rep, removed: tar };
    }
  }

  // 4. Command info for terminal/python
  const rawCommand =
    request.command ||
    (typeof request.args === "string"
      ? request.args
      : request.args?.command || request.args?.cmd || JSON.stringify(request.args || ""));
  const firstLineCmd = (
    (typeof rawCommand === "string" ? rawCommand : "").split("\n")[0] || ""
  ).trim();
  const truncatedCmd =
    firstLineCmd.length > 55 ? `${firstLineCmd.slice(0, 52)}...` : firstLineCmd;
  const cmdFirstWord = (
    firstLineCmd.split(/\s+/)[0] || ""
  ).toLowerCase().replace(/\.exe$/, "");
  const cwdRel = request.cwd
    ? request.cwd.replace(/\\/g, "/").split("/").slice(-2).join("/")
    : "";

  // 5. Four refined options matching Image 1 (without the redundant 'always allow in project')
  const options: OptionDef[] = [
    {
      id: "allow_once",
      title: "Allow",
      desc: "Allow only this time",
    },
    {
      id: "full_access",
      title: "Full access",
      desc: "Grant the agent full access without further confirmation.",
    },
    {
      id: "deny",
      title: "Deny",
      desc: "Reject it for now",
    },
    {
      id: "tell_model",
      title: "",
      desc: "Tell the model what to do instead...",
    },
  ];

  const handleConfirm = () => {
    if (isResponding) return;
    const opt = options[selectedIdx];
    if (!opt) return;

    if (opt.id === "allow_once") {
      onDecide("allow_once");
    } else if (opt.id === "full_access") {
      onDecide("full_access");
    } else if (opt.id === "deny") {
      onDecide("deny");
    } else if (opt.id === "tell_model") {
      onDecide("deny", feedbackText.trim() || undefined);
    }
  };

  // Keyboard navigation: Arrow Up/Down, Tab/Shift-Tab, 1..4 shortcuts, Enter to confirm, Esc to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement === inputRef.current;

      if (e.key === "Escape") {
        e.preventDefault();
        if (isResponding) return;
        onDecide("skip");
        return;
      }

      if (isInputFocused) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleConfirm();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIdx((prev) => (prev - 1 + options.length) % options.length);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIdx((prev) => (prev + 1) % options.length);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          setSelectedIdx((prev) => (prev - 1 + options.length) % options.length);
        } else {
          setSelectedIdx((prev) => (prev + 1) % options.length);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= options.length) {
          e.preventDefault();
          setSelectedIdx(num - 1);
          if (num === 4) {
            setTimeout(() => inputRef.current?.focus(), 20);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIdx, feedbackText, isResponding]);

  // Auto-focus input when option 4 is selected
  useEffect(() => {
    if (selectedIdx === 3) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [selectedIdx]);

  return (
    <div
      className={cn(
        "w-full max-w-full rounded-2xl bg-[#18181b] dark:bg-[#18181b] border border-[#2e2e32] dark:border-[#2e2e32] p-4 sm:p-5 text-xs font-sans select-none shadow-2xl transition-colors",
        className
      )}
    >
      {/* 0. Running Tasks Banner attached above card when tasks are active */}
      {runningTasks && runningTasks.length > 0 && (
        <AttachedTaskBanner
          tasks={runningTasks}
          onSelectTask={onSelectTask || (() => {})}
          onStopTask={onStopTask || (() => {})}
          className="-mx-4 -mt-4 sm:-mx-5 sm:-mt-5 mb-3 rounded-t-2xl border-b border-[#2e2e32] bg-[#141416]"
        />
      )}

      {/* 1. Header: Permission required (Image 1 reference) */}
      <div className="text-[11.5px] font-medium text-[#888888] dark:text-[#888888] tracking-wide mb-1.5 select-none">
        Permission required
      </div>

      {/* 2. Target item row: [Icon] Awaiting approval [FileIcon] filename dir +diff */}
      <div className="flex items-center gap-2 min-w-0 text-xs py-1 select-none mb-3">
        {isMutation ? (
          <PenLine className="w-3.5 h-3.5 text-[#888888] dark:text-[#888888] shrink-0" />
        ) : (
          <Terminal className="w-3.5 h-3.5 text-[#888888] dark:text-[#888888] shrink-0" />
        )}
        <span className="font-medium text-[#888888] dark:text-[#888888] shrink-0">
          Awaiting approval
        </span>

        {isMutation ? (
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <FileIcon filename={targetFileName} className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono font-semibold text-white truncate text-xs">
              {targetFileName}
            </span>
            {dirPath && (
              <span className="font-mono text-[#777777] truncate text-[11.5px]">
                {dirPath}
              </span>
            )}
            {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
              <span className="flex items-center gap-1 font-mono text-[11.5px] shrink-0 ml-1">
                {diffStats.added > 0 && (
                  <span className="text-[#409D62]">+{diffStats.added}</span>
                )}
                {diffStats.removed > 0 && (
                  <span className="text-[#ff5c5c]">-{diffStats.removed}</span>
                )}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <FileIcon
              filename={cmdFirstWord || "terminal"}
              className="w-3.5 h-3.5 shrink-0"
              fallbackIcon={<Terminal className="w-3.5 h-3.5 text-[#888888] shrink-0" />}
            />
            <span className="font-mono font-semibold text-white truncate text-xs">
              {truncatedCmd}
            </span>
            {cwdRel && (
              <span className="font-mono text-[#777777] truncate text-[11.5px]">
                {cwdRel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Options list: 1..4 in clean pill rows */}
      <div className="space-y-1.5 py-1">
        {options.map((opt, idx) => {
          const isSelected = selectedIdx === idx;
          const isTellModel = opt.id === "tell_model";

          return (
            <div
              key={opt.id}
              onClick={() => {
                setSelectedIdx(idx);
                if (isTellModel) {
                  setTimeout(() => inputRef.current?.focus(), 20);
                }
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer min-w-0 select-none",
                isSelected
                  ? "bg-[#2c2d30] text-white shadow-xs"
                  : "bg-transparent hover:bg-white/[0.04] text-[#a0a0a0]"
              )}
            >
              {/* Option number */}
              <span className="font-semibold text-xs text-[#7f7f7f] shrink-0 w-3.5 text-right font-mono">
                {idx + 1}.
              </span>

              {/* Option Title and Description or Inline Input */}
              {isTellModel ? (
                <div className="flex-1 flex items-center min-w-0">
                  {isSelected ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Tell the model what to do instead..."
                      className="w-full bg-transparent text-xs text-white placeholder:text-[#888888] outline-none border-none p-0 focus:ring-0 font-normal leading-normal select-text"
                    />
                  ) : (
                    <span className="text-xs text-[#888888] font-normal truncate">
                      {feedbackText || "Tell the model what to do instead..."}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 min-w-0 truncate text-xs">
                  <span
                    className={cn(
                      "font-bold shrink-0",
                      isSelected ? "text-white" : "text-[#d4d4d4]"
                    )}
                  >
                    {opt.title}
                  </span>
                  <span className="text-[#888888] font-normal truncate text-[11.5px]">
                    {opt.desc}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Footer Row: Info shortcut label on left + Confirm button on right */}
      <div className="flex items-center justify-between pt-3 mt-1.5 select-none min-w-0">
        <div className="flex items-center gap-1.5 text-[#777777] text-[11px] min-w-0 truncate pr-2">
          <Info className="w-3.5 h-3.5 text-[#777777] shrink-0" />
          <span className="truncate">
            Use Tab / arrow keys to choose, then press Enter to confirm
          </span>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isResponding}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#e6e6e6] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs cursor-pointer shrink-0"
          title="Confirm (Enter)"
        >
          Confirm
        </button>
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
      // Release explicit height to "auto" so dynamic inner content resizes naturally
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
