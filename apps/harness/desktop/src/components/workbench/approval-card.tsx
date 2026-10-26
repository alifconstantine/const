import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { PenLine, Terminal, Info, Copy, Check } from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
import { useTranslation } from "../../lib/i18n";
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
  const { t } = useTranslation();
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [copied, setCopied] = useState(false);
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

  const rawCommandStr = typeof rawCommand === "string" ? rawCommand : "";
  const commandLines = rawCommandStr
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Skip leading comment lines (e.g. #, //, rem, ::) to find the first meaningful command
  const firstExecutableLine =
    commandLines.find((l) => !/^([#/]|rem\b|::)/i.test(l)) ||
    commandLines[0] ||
    "";
  const firstLineCmd = firstExecutableLine.trim();
  const truncatedCmd =
    firstLineCmd.length > 55 ? `${firstLineCmd.slice(0, 52)}...` : firstLineCmd;
  const rawFirstWord = (
    firstLineCmd.split(/\s+/)[0] || ""
  ).toLowerCase().replace(/\.exe$/, "");
  const cmdFirstWord = /^[a-zA-Z0-9_$-]+$/.test(rawFirstWord) ? rawFirstWord : "";
  const cwdRel = request.cwd
    ? request.cwd.replace(/\\/g, "/").split("/").slice(-2).join("/")
    : "";

  const handleCopyCommand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rawCommand) return;
    try {
      await navigator.clipboard.writeText(rawCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Title derivation:
  // e.g. "Allow running whoami?" or "Allow modifying App.tsx?"
  const actionTitle = isMutation
    ? targetFileName && targetFileName !== "file"
      ? t("workbench.allowModifyingNamedFile").replace("{name}", targetFileName)
      : t("workbench.allowModifyingFile")
    : firstLineCmd.length > 0 && firstLineCmd.length <= 32 && !firstLineCmd.includes("&&") && !firstLineCmd.startsWith("#")
    ? t("workbench.allowRunningNamedCommand").replace("{command}", firstLineCmd)
    : cmdFirstWord
    ? t("workbench.allowRunningNamedCommand").replace("{command}", cmdFirstWord)
    : t("workbench.allowRunningCommand");

  // 5. Four refined options matching Image 1 (without the redundant 'always allow in project')
  const options: OptionDef[] = [
    {
      id: "allow_once",
      title: t("common.allow"),
      desc: t("workbench.approvalAllowOnceDesc"),
    },
    {
      id: "full_access",
      title: t("workbench.approvalFullAccessTitle"),
      desc: t("workbench.approvalFullAccessDesc"),
    },
    {
      id: "deny",
      title: t("workbench.approvalRejectTitle"),
      desc: t("workbench.approvalRejectDesc"),
    },
    {
      id: "tell_model",
      title: "",
      desc: t("workbench.approvalTellModel"),
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
      if (e.repeat && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault();
        return;
      }
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
  }, [selectedIdx, feedbackText, isResponding, onDecide]);

  // Auto-focus input when option 4 is selected
  useEffect(() => {
    if (selectedIdx === 3) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [selectedIdx]);

  return (
    <div
      className={cn(
        "w-full max-w-full rounded-2xl bg-[#222222] border border-[#383838] p-3.5 sm:p-4 text-xs font-sans select-none shadow-none transition-colors",
        className
      )}
    >
      {/* 0. Running Tasks Banner attached above card when tasks are active */}
      {runningTasks && runningTasks.length > 0 && (
        <AttachedTaskBanner
          tasks={runningTasks}
          onSelectTask={onSelectTask || (() => {})}
          onStopTask={onStopTask || (() => {})}
          className="-mx-3.5 -mt-3.5 sm:-mx-4 sm:-mt-4 mb-2.5 rounded-t-2xl border-b border-[#383838] bg-[#161616]"
        />
      )}

      {/* 1. Main Action Heading (inspired by Image 2 reference) */}
      <div className="flex items-center gap-2 mb-2 select-none">
        {isMutation ? (
          <PenLine className="w-4 h-4 text-[#969696] shrink-0" />
        ) : (
          <FileIcon
            filename={cmdFirstWord || "terminal"}
            className="w-4 h-4 shrink-0"
            fallbackIcon={<Terminal className="w-4 h-4 text-[#969696] shrink-0" />}
          />
        )}
        <span className="text-[13.5px] font-semibold text-[#ffffff] leading-snug truncate">
          {actionTitle}
        </span>
      </div>

      {/* 2. Dedicated Preview Box (Image 2 design for command / symmetric file info for mutation) */}
      {isMutation ? (
        <div className="w-full bg-[#161616] border border-[#2e2e2e] rounded-xl px-3 py-2 mb-2.5 flex items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0 truncate">
            <FileIcon filename={targetFileName} className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono text-xs font-semibold text-[#ffffff] truncate">
              {targetFileName}
            </span>
            {dirPath && (
              <span className="font-mono text-[11px] text-[#969696] truncate hidden sm:inline">
                {dirPath}
              </span>
            )}
          </div>
          {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
            <div className="flex items-center gap-1.5 font-mono text-xs shrink-0 select-none">
              {diffStats.added > 0 && (
                <span className="text-[#409D62] font-medium">+{diffStats.added}</span>
              )}
              {diffStats.removed > 0 && (
                <span className="text-[#ff5c5c] font-medium">-{diffStats.removed}</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full bg-[#161616] border border-[#2e2e2e] rounded-xl p-3 mb-2.5 flex flex-col min-w-0 relative group">
          {rawCommand && (
            <button
              type="button"
              onClick={handleCopyCommand}
              className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-[#888888] hover:text-[#ffffff] bg-[#222222]/90 hover:bg-[#2b2b2b] border border-[#383838] rounded-md shadow-sm cursor-pointer"
              title={copied ? t("common.copied") : t("common.copy")}
              aria-label={t("common.copy")}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#4ade80]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <ScrollArea
            className="w-full max-h-48 sm:max-h-56 pr-1"
            thumbClassName="bg-white/20 hover:bg-white/30"
          >
            <pre className="font-mono text-xs text-[#e5c07b] whitespace-pre-wrap break-words select-text leading-relaxed pr-2">
              {rawCommand || "command"}
            </pre>
          </ScrollArea>

          {cwdRel && (
            <div className="flex items-center gap-1.5 pt-1.5 mt-2 text-[11px] text-[#969696] font-mono border-t border-[#262626] shrink-0">
              <span className="text-[#5d5d5d]">cwd:</span>
              <span className="truncate">{cwdRel}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Options list: 1..4 in compact pill rows */}
      <div className="space-y-1 py-0.5">
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
                "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer min-w-0 select-none",
                isSelected
                  ? "bg-[#383838] text-[#ffffff]"
                  : "bg-transparent hover:bg-[#2b2b2b]/60 text-[#d4d4d4]"
              )}
            >
              {/* Option number */}
              <span
                className={cn(
                  "font-semibold text-xs shrink-0 w-3.5 text-right font-mono",
                  isSelected ? "text-[#ffffff]" : "text-[#777777]"
                )}
              >
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
                      placeholder={t("workbench.approvalTellModel")}
                      className="w-full bg-transparent text-xs text-[#ffffff] placeholder:text-[#5d5d5d] outline-none border-none p-0 focus:ring-0 font-normal leading-normal select-text"
                    />
                  ) : (
                    <span
                      className={cn(
                        "text-xs font-normal truncate",
                        feedbackText ? "text-[#ffffff]" : "text-[#969696]"
                      )}
                    >
                      {feedbackText || t("workbench.approvalTellModel")}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0 truncate text-xs">
                  <span
                    className={cn(
                      "font-bold shrink-0",
                      isSelected ? "text-[#ffffff]" : "text-[#d4d4d4]"
                    )}
                  >
                    {opt.title}
                  </span>
                  <span
                    className={cn(
                      "font-normal truncate text-[11.5px]",
                      isSelected ? "text-[#d4d4d4]" : "text-[#969696]"
                    )}
                  >
                    {opt.desc}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Footer Row: Info shortcut label on left + Confirm button on right */}
      <div className="flex items-center justify-between pt-2 mt-1 select-none min-w-0">
        <div className="flex items-center gap-1.5 text-[#969696] text-[11px] min-w-0 truncate pr-2">
          <Info className="w-3.5 h-3.5 text-[#969696] shrink-0" />
          <span className="truncate">
            {t("workbench.approvalShortcuts")}
          </span>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isResponding}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#ffffff] text-[#161616] hover:bg-[#eaeaea] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0"
          title={`${t("common.confirm")} (Enter)`}
        >
          {t("common.confirm")}
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
