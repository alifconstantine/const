import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Check,
  Terminal as TerminalIcon,
  Loader2,
  Layers,
  Search,
  FileSearch,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import type { FileMutationRecord, TraceStep } from "../../vite-env";
import { FileIcon } from "./file-icon";
import { MarkdownContent } from "./markdown-content";
import { getMutationDiffStats } from "./review-dialog";

export interface TraceToolCall {
  id: string;
  name: string;
  args?: any;
  result?: any;
  isError?: boolean;
  lineRange?: string;
}

export interface ExecutionTraceProps {
  thinking?: string;
  toolCalls?: TraceToolCall[];
  traceSteps?: TraceStep[];
  mutations?: FileMutationRecord[];
  isExecuting?: boolean;
  durationMs?: number;
  showMutationsSummary?: boolean;
  pendingApprovalToolCallId?: string;
  onRollback?: (record: FileMutationRecord) => void;
  onRollbackAll?: (records: FileMutationRecord[]) => void;
  onOpenReview?: () => void;
  onAnswerQuestion?: (toolCallId: string, answer: any) => void;
}

// ---------------------------------------------------------------------------
// SmoothCollapse: Hardware-accelerated CSS grid accordion for premium feel
// ---------------------------------------------------------------------------
export function SmoothCollapse({
  isOpen,
  children,
  className = "",
}: {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        opacity: isOpen ? 1 : 0,
        transition:
          "grid-template-rows 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease-out",
        pointerEvents: isOpen ? "auto" : "none",
      }}
      className={className}
    >
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  );
}

export function ExecutionTrace({
  thinking,
  toolCalls = [],
  traceSteps = [],
  mutations = [],
  isExecuting = false,
  durationMs,
  showMutationsSummary = false,
  pendingApprovalToolCallId,
  onRollback,
  onRollbackAll,
  onOpenReview,
  onAnswerQuestion,
}: ExecutionTraceProps) {
  // Default: Open while executing to view progress live; automatically closed when worked/finished
  const [isMainOpen, setIsMainOpen] = useState(isExecuting);
  const wasExecutingRef = useRef(isExecuting);

  useEffect(() => {
    if (isExecuting && !wasExecutingRef.current) {
      // Started executing -> auto open
      setIsMainOpen(true);
    } else if (!isExecuting && wasExecutingRef.current) {
      // Completed execution -> auto close
      setIsMainOpen(false);
    }
    wasExecutingRef.current = isExecuting;
  }, [isExecuting]);

  // Normalize chronological steps (supports live traceSteps and fallback history)
  const steps: TraceStep[] = useMemo(() => {
    if (traceSteps && traceSteps.length > 0) {
      return traceSteps.filter((st) => {
        if (st.type === "thought") {
          return Boolean(st.content && st.content.trim().length > 0);
        }
        if (st.type === "tool") {
          if (!st.name) return false;
          const lower = st.name.toLowerCase();
          return !lower.includes("malformed") && lower !== "tool";
        }
        return true;
      });
    }

    // Fallback for previous messages that only have thinking + toolCalls
    const result: TraceStep[] = [];
    if (thinking && thinking.trim().length > 0) {
      result.push({
        id: "thought_fallback",
        type: "thought",
        content: thinking,
        durationMs,
      });
    }
    for (const tc of toolCalls) {
      if (!tc.name) continue;
      const lower = tc.name.toLowerCase();
      if (lower.includes("malformed") || lower === "tool") continue;
      result.push({
        id: tc.id,
        type: "tool",
        toolCallId: tc.id,
        name: tc.name,
        args: tc.args,
        result: tc.result,
        isError: tc.isError,
      });
    }
    return result;
  }, [traceSteps, thinking, toolCalls, durationMs]);

  const hasContent = steps.length > 0 || mutations.length > 0 || isExecuting;
  if (!hasContent) return null;

  // Format execution duration e.g. "Worked for 1m 56s", "Worked for 22s", or "Working for 12s..."
  const formatDuration = () => {
    if (isExecuting) {
      if (!durationMs || durationMs < 1000) return "Working...";
      const s = Math.round(durationMs / 1000);
      if (s < 60) return `Working for ${s}s...`;
      const m = Math.floor(s / 60);
      const remS = s % 60;
      if (remS === 0) return `Working for ${m}m...`;
      return `Working for ${m}m ${remS}s...`;
    }
    if (!durationMs || durationMs < 1000) return "Worked for a few seconds";
    const s = Math.round(durationMs / 1000);
    if (s < 60) return `Worked for ${s}s`;
    const m = Math.floor(s / 60);
    const remS = s % 60;
    if (remS === 0) return `Worked for ${m}m`;
    return `Worked for ${m}m ${remS}s`;
  };

  return (
    <div className="w-full flex flex-col gap-1.5 select-none my-1 font-sans">
      {/* Root Summary Header: e.g. Worked for 22s > */}
      <button
        type="button"
        onClick={() => setIsMainOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#a9a9a9] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#e0e0e0] transition-colors cursor-pointer py-0.5 w-fit select-none"
      >
        <span>{formatDuration()}</span>
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#777777] transition-transform duration-200 ease-out",
            isMainOpen && "rotate-90"
          )}
        />
      </button>

      {/* Trace Body with Smooth Collapse */}
      <SmoothCollapse isOpen={isMainOpen}>
        <div className="flex flex-col gap-1.5 pl-3 ml-1 border-l border-[#e2e2e4] dark:border-[#2e2e2e]/70 text-[13px] text-[#a9a9a9] dark:text-[#888888] pt-1">
          {steps.map((step, idx) => {
            if (step.type === "thought") {
              return (
                <ThoughtItem
                  key={step.id || `thought_${idx}`}
                  thinking={step.content || ""}
                  durationMs={step.durationMs}
                  startTime={step.startTime}
                  isExecuting={isExecuting && idx === steps.length - 1 && !step.durationMs}
                />
              );
            }

            if (step.type === "tool") {
              const norm = (step.name || "").toLowerCase().replace(/[-_]/g, "");

              // A. Todo Write / Checklist (Rendered in floating card at top-right, not in working process)
              if (norm === "todowrite" || norm === "todo") {
                return null;
              }

              // B. Ask Question (Image 2: "? Asking questions" while pending, "? Asked N questions ⌄" when answered)
              if (norm === "askquestion" || norm === "question") {
                if (!step.result) {
                  return (
                    <div
                      key={step.id || `q_${idx}`}
                      className="flex items-center gap-2 py-0.5 text-[13px] text-[#888888] font-sans select-none"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-[#777777] shrink-0" />
                      <span>Asking questions</span>
                    </div>
                  );
                }
                return (
                  <AskedQuestionsTraceItem
                    key={step.id || `q_${idx}`}
                    step={step}
                  />
                );
              }

              // 1. Terminal / Shell command (bash, run_command, terminal, exec)
              if (
                norm === "bash" ||
                norm === "terminal" ||
                norm === "runcommand" ||
                norm === "sh" ||
                norm === "exec"
              ) {
                const isWaitingApproval = Boolean(
                  pendingApprovalToolCallId &&
                    (step.id === pendingApprovalToolCallId ||
                      (step as any).toolCallId === pendingApprovalToolCallId)
                );
                return (
                  <TerminalCard
                    key={step.id || `cmd_${idx}`}
                    tool={step}
                    isDefaultOpen={Boolean(step.isError || isWaitingApproval)}
                    isWaitingApproval={isWaitingApproval}
                  />
                );
              }

              // 2. File Mutation (write, edit, replace, apply_patch)
              if (
                norm.includes("write") ||
                norm.includes("edit") ||
                norm.includes("replace") ||
                norm.includes("createfile") ||
                norm.includes("modify") ||
                norm.includes("patch")
              ) {
                return (
                  <FileMutationToolItem
                    key={step.id || `mut_${idx}`}
                    tool={step}
                    mutations={mutations}
                  />
                );
              }

              // 3. Exploration & Search (read, grep, search, find, listdir)
              if (
                norm === "read" ||
                norm === "readfile" ||
                norm === "cat" ||
                norm === "viewfile" ||
                norm === "listdir" ||
                norm === "ls" ||
                norm === "find" ||
                norm === "findbyname" ||
                norm === "grep" ||
                norm === "grepsearch" ||
                norm === "search"
              ) {
                return (
                  <ExplorationItem
                    key={step.id || `exp_${idx}`}
                    tool={step}
                    mutations={mutations}
                  />
                );
              }

              // 4. Other tools
              return <GenericToolItem key={step.id || `other_${idx}`} tool={step} />;
            }

            return null;
          })}

          {/* Active executing spinner */}
          {isExecuting && !pendingApprovalToolCallId && (
            <div className="flex items-center gap-2 text-xs text-[#a9a9a9] dark:text-[#777777] py-1">
              <Loader2 className="w-3 h-3 animate-spin text-[#e79737] dark:text-[#ff7a00]" />
              <span>Working...</span>
            </div>
          )}
        </div>
      </SmoothCollapse>

      {/* 7. Changed Files Summary Card (only if explicit showMutationsSummary = true) */}
      {showMutationsSummary && mutations.length > 0 && (
        <MutationsSummaryCard
          mutations={mutations}
          isExecuting={isExecuting}
          onRollback={onRollback}
          onRollbackAll={onRollbackAll}
          onOpenReview={onOpenReview}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asked Questions Trace Item (Matching Image 2)
// Header: "? Asked 2 questions ⌄"
// Body: Bold question + muted answer
// ---------------------------------------------------------------------------
function AskedQuestionsTraceItem({ step }: { step: TraceStep | TraceToolCall }) {
  const [isOpen, setIsOpen] = useState(true);

  let rawQuestions: any[] = [];
  if (step.args) {
    let parsedArgs = step.args;
    if (typeof parsedArgs === "string") {
      try {
        parsedArgs = JSON.parse(parsedArgs);
      } catch {}
    }
    rawQuestions =
      parsedArgs?.questions ||
      (Array.isArray(parsedArgs) ? parsedArgs : [parsedArgs]);
  }

  // Parse Q&A pairs
  const qaPairs: Array<{ question: string; answer: string }> = [];

  let result = step.result;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {}
  }

  if (Array.isArray(result)) {
    result.forEach((item, idx) => {
      if (item && typeof item === "object" && item.question && item.answer) {
        qaPairs.push({ question: String(item.question), answer: String(item.answer) });
      } else {
        const qText = rawQuestions[idx]?.question || `Question ${idx + 1}`;
        qaPairs.push({ question: qText, answer: String(item) });
      }
    });
  } else if (result && typeof result === "object") {
    Object.entries(result).forEach(([k, v]) => {
      qaPairs.push({ question: k, answer: String(v) });
    });
  } else if (result) {
    const qText = rawQuestions[0]?.question || "Question";
    qaPairs.push({ question: qText, answer: String(result) });
  }

  const questionCount = qaPairs.length || rawQuestions.length || 1;

  return (
    <div className="flex flex-col w-full min-w-0 my-0.5 font-sans select-none">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#666666] dark:text-[#888888] hover:text-[#111111] dark:hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        <HelpCircle className="w-3.5 h-3.5 text-[#777777] shrink-0" />
        <span>
          Asked {questionCount} question{questionCount > 1 ? "s" : ""}
        </span>
        <ChevronDown
          className="w-3.5 h-3.5 text-[#777777] transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="pt-1.5 pb-2 pl-5 space-y-2 select-text font-sans">
          {qaPairs.map((pair, idx) => (
            <div key={idx} className="space-y-0.5 text-left">
              <div className="font-semibold text-[12.5px] text-[#1c1c1e] dark:text-[#d4d4d4] leading-snug">
                {pair.question}
              </div>
              <div className="text-[12px] text-[#666666] dark:text-[#888888] leading-snug">
                {pair.answer}
              </div>
            </div>
          ))}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thought Item: Clean minimalist layout exactly matching user reference image
// Header: "Thought for 7s ⌄"
// Body: Bold title + muted text (#888888), NO cards, NO borders, NO extra boxes
// ---------------------------------------------------------------------------
function ThoughtItem({
  thinking,
  isExecuting,
  durationMs,
  startTime,
}: {
  thinking: string;
  isExecuting?: boolean;
  durationMs?: number;
  startTime?: number;
}) {
  // 1. Auto open when thinking starts, and auto close when thinking completes
  const [isOpen, setIsOpen] = useState(Boolean(isExecuting));
  const prevExecutingRef = useRef(Boolean(isExecuting));

  useEffect(() => {
    if (isExecuting && !prevExecutingRef.current) {
      setIsOpen(true);
    } else if (!isExecuting && prevExecutingRef.current) {
      setIsOpen(false);
    }
    prevExecutingRef.current = Boolean(isExecuting);
  }, [isExecuting]);

  // 2. Bugfix: Live timer measures strictly THIS thought step's duration from startTime
  const [liveStepDuration, setLiveStepDuration] = useState<number>(0);

  useEffect(() => {
    if (!isExecuting) return;
    const effectiveStart = startTime || Date.now();
    const update = () => setLiveStepDuration(Math.max(0, Date.now() - effectiveStart));
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [isExecuting, startTime]);

  const thoughtLabel = () => {
    if (isExecuting) {
      if (liveStepDuration >= 1000) {
        return `Thinking (${Math.round(liveStepDuration / 1000)}s)...`;
      }
      return "Thinking...";
    }
    const finalMs = durationMs ?? (liveStepDuration > 0 ? liveStepDuration : undefined);
    if (finalMs !== undefined && finalMs > 0) {
      const s = Math.max(1, Math.round(finalMs / 1000));
      return `Thought for ${s}s`;
    }
    return "Thought for a few seconds";
  };

  if (!thinking && !isExecuting) return null;

  return (
    <div className="flex flex-col w-full min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        <span>{thoughtLabel()}</span>
        <ChevronDown
          className="w-3.5 h-3.5 text-[#777777] transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="pt-1.5 pb-2 pl-0.5 text-[12.5px] leading-relaxed text-[#888888] select-text">
          {/* Scroll area bounded max height matching Image 1 */}
          <ScrollArea className="w-full max-h-56 pr-2.5 [&>div>div[style]]:!block">
            <MarkdownContent
              content={thinking}
              className="text-[12.5px] leading-relaxed text-[#888888] [&_strong]:font-semibold [&_strong]:text-[#d4d4d4] [&_strong]:block [&_strong]:mb-1 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:text-[#d4d4d4] [&_h1]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-[#d4d4d4] [&_h2]:mb-1 [&_h3]:text-[12.5px] [&_h3]:font-semibold [&_h3]:text-[#d4d4d4] [&_h3]:mb-1 [&_p]:my-1"
            />
          </ScrollArea>
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal Card: Clean single line row, click to expand terminal output
// ---------------------------------------------------------------------------
function TerminalCard({
  tool,
  isDefaultOpen = false,
  isWaitingApproval = false,
}: {
  tool: TraceToolCall | TraceStep;
  isDefaultOpen?: boolean;
  isWaitingApproval?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(isDefaultOpen);

  let cmd = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      try {
        const parsed = JSON.parse(tool.args);
        cmd = parsed.command || parsed.cmd || tool.args;
      } catch {
        cmd = tool.args;
      }
    } else {
      cmd = tool.args.command || tool.args.cmd || "";
    }
  }

  const rawResult =
    typeof tool.result === "string"
      ? tool.result
      : tool.result
      ? JSON.stringify(tool.result, null, 2)
      : "";

  const isFailed = Boolean(tool.isError);

  // Extract exit code if present
  let exitCodeDisplay: string | null = null;
  const exitMatch = rawResult.match(
    /(?:\[Command (?:failed with exit code|exited with code) (\d+)\]|Exit code:?\s*(\d+))/i
  );
  if (exitMatch) {
    const code = exitMatch[1] || exitMatch[2];
    exitCodeDisplay = `Exit code ${code}`;
  } else if (isFailed) {
    exitCodeDisplay = "Command failed";
  }

  // Deduplicate exit code from output body
  const cleanResult = rawResult
    .replace(/^Exit code:?\s*\d+\s*/i, "")
    .replace(/\[Command (?:failed with exit code|exited with code) \d+\]\s*/gi, "")
    .trim();

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      {/* Trigger: Left aligned, single row with truncate */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full text-left inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-white/5 min-w-0 max-w-full justify-start select-none"
      >
        <TerminalIcon className="w-3.5 h-3.5 text-[#777777] shrink-0" />
        <span className="font-mono text-xs text-[#d4d4d4] truncate flex-1 min-w-0 text-left">
          {cmd || "command"}
        </span>
        {isWaitingApproval ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a00] animate-ping shrink-0" title="Waiting for user approval" />
        ) : isFailed ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff5c5c] shrink-0" title="Failed" />
        ) : tool.result !== undefined ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#409D62] shrink-0" title="Success" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-[#e79737] dark:bg-[#ff7a00] animate-pulse shrink-0" title="Running command..." />
        )}
        <ChevronDown
          className="w-3 h-3 text-[#666666] shrink-0 ml-1 transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {/* Expanded Terminal Panel with Smooth Collapse */}
      <SmoothCollapse isOpen={isOpen}>
        <div className="mt-1 p-2.5 rounded-xl bg-[#0e0e10] border border-[#232328] font-mono text-[12px] leading-relaxed select-text shadow-xs w-full min-w-0">
          {/* Header line: $ command */}
          <div className="text-[#cccccc] flex items-start gap-1.5 pb-1.5 mb-1.5 border-b border-[#202024] min-w-0">
            <span className="text-[#ff7a00] font-bold shrink-0">$</span>
            <span className="font-mono text-xs text-[#e0e0e0] break-all leading-snug">
              {cmd}
            </span>
          </div>

          {/* Exit code banner */}
          {exitCodeDisplay && (
            <div className="text-xs text-[#ff5c5c] font-mono font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff5c5c]" />
              <span>{exitCodeDisplay}</span>
            </div>
          )}

          {/* Output stdout/stderr wrapped in ScrollArea */}
          <ScrollArea className="max-h-60 w-full">
            {isWaitingApproval ? (
              <div className="text-[#888888] flex items-center gap-1.5 text-xs py-0.5 font-sans">
                <span>Waiting for user input...</span>
              </div>
            ) : tool.result === undefined ? (
              <div className="text-[#e79737] dark:text-[#ff7a00] flex items-center gap-1.5 text-xs italic py-0.5">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span>Running command...</span>
              </div>
            ) : cleanResult ? (
              <div
                className={
                  isFailed
                    ? "text-[#ff5c5c] whitespace-pre-wrap text-[11.5px] font-mono leading-relaxed"
                    : "text-[#999999] whitespace-pre-wrap text-[11.5px] font-mono leading-relaxed"
                }
              >
                {cleanResult}
              </div>
            ) : (
              <div className="text-[#555555] italic text-xs">(Command completed with no output)</div>
            )}
          </ScrollArea>
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Mutation Tool Item: Clean Seti icon + filename + +X -Y diffs (#409D62 / #ff5c5c)
// ---------------------------------------------------------------------------
function FileMutationToolItem({
  tool,
  mutations,
}: {
  tool: TraceToolCall | TraceStep;
  mutations: FileMutationRecord[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  let targetArg = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      targetArg = tool.args;
    } else {
      targetArg =
        tool.args.TargetFile ||
        tool.args.targetFile ||
        tool.args.filePath ||
        tool.args.path ||
        "";
    }
  }

  const fileName =
    targetArg.replace(/\\/g, "/").split("/").filter(Boolean).pop() || targetArg || "file";

  // Match with mutations to find line diff stats
  const matched =
    (tool as any).mutation ||
    mutations.find((m) => {
      const mName = m.targetFile.replace(/\\/g, "/").split("/").filter(Boolean).pop();
      return (
        m.targetFile === targetArg ||
        m.filePath === targetArg ||
        mName === fileName
      );
    });

  const diffStats = matched ? getMutationDiffStats(matched) : null;

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => diffStats && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 transition-colors text-[13px] min-w-0 select-none ${
          diffStats ? "cursor-pointer" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-[#d4d4d4] truncate font-sans">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-[#409D62]">+{diffStats.added}</span>
              <span className="text-[#ff5c5c]">-{diffStats.removed}</span>
            </div>
          )}
          {diffStats && (
            <ChevronDown
              className="w-3 h-3 text-[#666666] transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {matched && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-[#0e0e10] border border-[#232328] text-xs font-mono select-text">
            <div className="text-[#888888] text-[11px] mb-1">
              Operation: <span className="uppercase text-[#d4d4d4]">{matched.operation}</span>
            </div>
            {matched.newContent && (
              <ScrollArea className="max-h-40 w-full text-[11.5px] text-[#999999]">
                <pre className="whitespace-pre-wrap">{matched.newContent.slice(0, 1000)}</pre>
              </ScrollArea>
            )}
          </div>
        </SmoothCollapse>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exploration Item: e.g. "Searched *pattern* 7 results" or "Read file.tsx"
// ---------------------------------------------------------------------------
function ExplorationItem({
  tool,
  mutations,
}: {
  tool: TraceToolCall | TraceStep;
  mutations: FileMutationRecord[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const norm = (tool.name || "").toLowerCase().replace(/[-_]/g, "");

  // 1. Searches (grep, search, find)
  if (
    norm === "search" ||
    norm === "grep" ||
    norm === "grepsearch" ||
    norm === "find" ||
    norm === "findbyname"
  ) {
    let query = "";
    if (tool.args) {
      if (typeof tool.args === "string") {
        query = tool.args;
      } else {
        query =
          tool.args.query ||
          tool.args.Query ||
          tool.args.pattern ||
          tool.args.Pattern ||
          tool.args.text ||
          "";
      }
    }

    let resultCount = "";
    if (typeof tool.result === "string") {
      const matchLines = tool.result.split("\n").filter(Boolean).length;
      resultCount = `${matchLines} results`;
    }

    const hasResult = Boolean(tool.result);

    return (
      <div className="w-full min-w-0 flex flex-col my-0.5">
        <div
          onClick={() => hasResult && setIsOpen((prev) => !prev)}
          className={`flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none ${
            hasResult ? "cursor-pointer" : ""
          }`}
        >
          <Search className="w-3.5 h-3.5 text-[#777777] shrink-0" />
          <span className="shrink-0">Searched</span>
          <span className="text-[#d4d4d4] font-medium truncate">*{query}*</span>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {resultCount && (
              <span className="text-[#666666] text-xs font-mono">{resultCount}</span>
            )}
            {hasResult && (
              <ChevronDown
                className="w-3 h-3 text-[#666666] transition-transform duration-200 ease-out"
                style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
              />
            )}
          </div>
        </div>

        {hasResult && (
          <SmoothCollapse isOpen={isOpen}>
            <div className="mt-1 p-2 rounded-xl bg-[#0e0e10] border border-[#232328] text-xs font-mono select-text">
              <ScrollArea className="max-h-40 w-full text-[11px] text-[#999999]">
                <pre className="whitespace-pre-wrap">
                  {typeof tool.result === "string"
                    ? tool.result.slice(0, 1500)
                    : JSON.stringify(tool.result, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </SmoothCollapse>
        )}
      </div>
    );
  }

  // 2. File Reads (read, cat, listdir, viewfile)
  let targetArg = "";
  let lineRange = "";

  if (tool.args) {
    if (typeof tool.args === "string") {
      targetArg = tool.args;
    } else {
      targetArg =
        tool.args.AbsolutePath ||
        tool.args.path ||
        tool.args.filePath ||
        tool.args.targetPath ||
        tool.args.DirectoryPath ||
        "";
      if (typeof tool.args.StartLine === "number" && typeof tool.args.EndLine === "number") {
        lineRange = `#L${tool.args.StartLine}-${tool.args.EndLine}`;
      } else if (typeof tool.args.offset === "number") {
        const offset = tool.args.offset;
        const limit = tool.args.limit || 50;
        lineRange = `#L${offset}-${offset + limit}`;
      }
    }
  }

  const fileName =
    targetArg.replace(/\\/g, "/").split("/").filter(Boolean).pop() || targetArg;

  const hasResult = Boolean(tool.result);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => hasResult && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none ${
          hasResult ? "cursor-pointer" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-[#d4d4d4] truncate font-sans">{fileName}</span>
          {lineRange && (
            <span className="text-xs text-[#666666] shrink-0 font-mono">{lineRange}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasResult && (
            <ChevronDown
              className="w-3 h-3 text-[#666666] transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {hasResult && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-[#0e0e10] border border-[#232328] text-xs font-mono select-text">
            <ScrollArea className="max-h-40 w-full text-[11px] text-[#999999]">
              <pre className="whitespace-pre-wrap">
                {typeof tool.result === "string"
                  ? tool.result.slice(0, 1500)
                  : JSON.stringify(tool.result, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        </SmoothCollapse>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic Tool Item fallback
// ---------------------------------------------------------------------------
function GenericToolItem({ tool }: { tool: TraceToolCall | TraceStep }) {
  let targetArg = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      targetArg = tool.args;
    } else {
      targetArg = tool.args.path || tool.args.command || "";
    }
  }

  return (
    <div className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none">
      <Layers className="w-3.5 h-3.5 text-[#777777] shrink-0" />
      <span className="capitalize shrink-0">{tool.name}</span>
      {targetArg && <span className="text-[#d4d4d4] truncate">{targetArg}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Changed Files Summary Card
// "7 files changed +1370 -189 ⌵" with [Undo all] and [Review]
// Uses #409D62 and #ff5c5c colors and SmoothCollapse
// ---------------------------------------------------------------------------
export function MutationsSummaryCard({
  mutations,
  isExecuting = false,
  onRollback,
  onRollbackAll,
  onOpenReview,
}: {
  mutations: FileMutationRecord[];
  isExecuting?: boolean;
  onRollback?: (record: FileMutationRecord) => void;
  onRollbackAll?: (records: FileMutationRecord[]) => void;
  onOpenReview?: () => void;
}) {
  // Default: Open while executing, automatically closes when finished
  const [isOpen, setIsOpen] = useState(isExecuting);
  const wasExecutingRef = useRef(isExecuting);

  useEffect(() => {
    if (isExecuting && !wasExecutingRef.current) {
      setIsOpen(true);
    } else if (!isExecuting && wasExecutingRef.current) {
      setIsOpen(false);
    }
    wasExecutingRef.current = isExecuting;
  }, [isExecuting]);

  let totalAdded = 0;
  let totalRemoved = 0;

  for (const m of mutations) {
    const stats = getMutationDiffStats(m);
    totalAdded += stats.added;
    totalRemoved += stats.removed;
  }

  return (
    <div className="w-full rounded-xl bg-white dark:bg-[#141414] border border-[#e2e2e4] dark:border-[#2b2b2b] my-2 select-none font-sans overflow-hidden transition-all shadow-xs animate-in fade-in-0 duration-200">
      {/* Header matching reference image: 1 file changed +27 -13 >  |  [Undo all] [Review] */}
      <div className={cn("flex items-center justify-between px-3.5 py-2 transition-all", isOpen && "border-b border-[#e2e2e4] dark:border-[#242424]")}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 text-[13px] text-[#262626] dark:text-[#cccccc] hover:text-black dark:hover:text-white transition-colors cursor-pointer group/card"
        >
          <span className="font-normal text-[#262626] dark:text-[#d4d4d4]">
            {mutations.length} file{mutations.length > 1 ? "s" : ""} changed
          </span>
          <span className="font-mono text-xs text-[#409D62] font-medium">+{totalAdded}</span>
          <span className="font-mono text-xs text-[#ff5c5c] font-medium">-{totalRemoved}</span>
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#777777] group-hover/card:text-[#262626] dark:group-hover/card:text-[#cccccc] transition-transform duration-200 ease-out",
              isOpen && "rotate-90"
            )}
          />
        </button>

        <div className="flex items-center gap-2">
          {onRollbackAll && (
            <button
              type="button"
              onClick={() => onRollbackAll(mutations)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f4f4f6] hover:bg-[#eaeaea] dark:bg-[#1e1e1e] dark:hover:bg-[#282828] border border-[#e2e2e4] hover:border-[#d5d5d9] dark:border-[#333333] dark:hover:border-[#444444] text-[11.5px] text-[#262626] hover:text-black dark:text-[#d4d4d4] dark:hover:text-white transition-all cursor-pointer font-medium shadow-xs"
              title="Undo all changes in this turn"
            >
              <RotateCcw className="w-3 h-3 text-[#262626] dark:text-[#d4d4d4]" />
              <span>Undo all</span>
            </button>
          )}

          {onOpenReview && (
            <button
              type="button"
              onClick={onOpenReview}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f4f4f6] hover:bg-[#eaeaea] dark:bg-[#1e1e1e] dark:hover:bg-[#282828] border border-[#e2e2e4] hover:border-[#d5d5d9] dark:border-[#333333] dark:hover:border-[#444444] text-[11.5px] text-[#262626] hover:text-black dark:text-[#e0e0e0] dark:hover:text-white transition-all cursor-pointer font-medium shadow-xs"
              title="Review line by line diffs"
            >
              <FileSearch className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#9e9e9e]" />
              <span>Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded list of mutated files with SmoothCollapse */}
      <SmoothCollapse isOpen={isOpen}>
        <div className="px-3 py-2 w-full">
          {mutations.length > 6 ? (
            <ScrollArea className="max-h-60 w-full pr-1" viewportClassName="[&>div[style]]:!block">
              <div className="flex flex-col gap-0.5">
                {mutations.map((mut) => (
                  <MutationRowItem key={mut.id} mut={mut} onRollback={onRollback} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col gap-0.5">
              {mutations.map((mut) => (
                <MutationRowItem key={mut.id} mut={mut} onRollback={onRollback} />
              ))}
            </div>
          )}
        </div>
      </SmoothCollapse>
    </div>
  );
}

function MutationRowItem({
  mut,
  onRollback,
}: {
  mut: FileMutationRecord;
  onRollback?: (record: FileMutationRecord) => void;
}) {
  const fileName =
    mut.targetFile.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
    mut.targetFile;
  const dirPath =
    mut.targetFile.replace(/\\/g, "/").split("/").slice(0, -1).join("/") || "";
  const fileStats = getMutationDiffStats(mut);

  return (
    <div className="flex items-center justify-between group py-1.5 px-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <FileIcon filename={fileName} />
        <span
          className={`text-[13px] truncate font-sans ${
            mut.rolledBack ? "line-through text-[#888888] dark:text-[#666666]" : "text-[#262626] dark:text-[#d4d4d4]"
          }`}
        >
          {fileName}
        </span>
        {dirPath && (
          <span className="text-[11px] text-[#a9a9a9] dark:text-[#555555] font-mono truncate max-w-[240px]">
            /{dirPath}
          </span>
        )}
      </div>

      <div className="shrink-0 ml-2 flex items-center gap-2">
        {/* Colors #409D62 and #ff5c5c matching worked */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-[#409D62]">+{fileStats.added}</span>
          <span className="text-[#ff5c5c]">-{fileStats.removed}</span>
        </div>

        {mut.rolledBack ? (
          <span className="text-[10px] text-[#409D62] flex items-center gap-0.5">
            <Check className="w-3 h-3 text-[#409D62]" />
            <span>Undone</span>
          </span>
        ) : onRollback ? (
          <button
            type="button"
            onClick={() => onRollback(mut)}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded bg-[#f4f4f6] hover:bg-[#eaeaea] dark:bg-[#202020] dark:hover:bg-[#2e2e2e] border border-[#e2e2e4] dark:border-[#333333] text-[10px] text-[#262626] hover:text-black dark:text-[#d4d4d4] dark:hover:text-white transition-all cursor-pointer shadow-xs"
            title="Undo changes to this file"
          >
            <RotateCcw className="w-2.5 h-2.5 text-[#262626] dark:text-[#d4d4d4]" />
            <span>Undo</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

