import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Terminal as TerminalIcon,
  Search,
  Loader2,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  ExternalLink,
  Send,
  ArrowRight,
  Check,
  ListTodo,
  RotateCcw,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { FileIcon } from "./file-icon";
import { MarkdownContent } from "./markdown-content";
import { useI18n } from "../../lib/i18n";
import type { FileMutationRecord } from "@const/agent";

export interface TraceStep {
  id: string;
  type: "thought" | "tool";
  content?: string;
  startTime?: number;
  durationMs?: number;
  toolCallId?: string;
  name?: string;
  args?: any;
  result?: any;
  isError?: boolean;
  status?: "running" | "completed" | "error";
  mutation?: FileMutationRecord;
}

export interface DisplayToolCall {
  id: string;
  name: string;
  args: any;
  result?: any;
  isError?: boolean;
  status?: "running" | "completed" | "error";
  durationMs?: number;
  mutation?: FileMutationRecord;
}

export interface ExecutionTraceProps {
  thinking?: string;
  toolCalls?: DisplayToolCall[];
  traceSteps?: TraceStep[];
  mutations?: FileMutationRecord[];
  isExecuting?: boolean;
  durationMs?: number;
  onAnswerQuestion?: (toolCallId: string, answer: any) => void;
  onRollback?: (record: FileMutationRecord) => void;
  onRollbackAll?: (records: FileMutationRecord[]) => void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
  showMutationsSummary?: boolean;
}

// ---------------------------------------------------------------------------
// SmoothCollapse: Hardware-accelerated CSS grid accordion for smooth feel
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
  onAnswerQuestion,
  onRollback,
  onRollbackAll,
  onOpenFileDiff,
  showMutationsSummary = false,
}: ExecutionTraceProps) {
  // Auto-open while executing to view progress live; auto-close when finished
  const [isMainOpen, setIsMainOpen] = useState(isExecuting);
  const wasExecutingRef = useRef(isExecuting);

  useEffect(() => {
    if (isExecuting && !wasExecutingRef.current) {
      setIsMainOpen(true);
    } else if (!isExecuting && wasExecutingRef.current) {
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
        status: tc.status,
      });
    }
    return result;
  }, [traceSteps, thinking, toolCalls, durationMs]);

  const hasContent = steps.length > 0 || isExecuting || (mutations && mutations.length > 0);
  if (!hasContent) return null;

  // Format execution duration e.g. "Worked for 22s", "Working for 12s..."
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
      {(steps.length > 0 || isExecuting) && (
        <>
          {/* Root Summary Header: e.g. Worked for 22s > */}
          <button
            type="button"
            onClick={() => setIsMainOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#a9a9a9] dark:text-[#969696] hover:text-[#262626] dark:hover:text-[#e0e0e0] transition-colors cursor-pointer py-0.5 w-fit select-none group"
          >
            <span>{formatDuration()}</span>
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#777777] group-hover:text-foreground transition-transform duration-200 ease-out",
                isMainOpen && "rotate-90"
              )}
            />
          </button>

          {/* Smooth Collapsible Content matching apps/harness/desktop */}
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

              // A. Socratic Question (ask_question)
              if (norm === "askquestion" || norm === "question") {
                return (
                  <AskedQuestionsTraceItem
                    key={step.id || `q_${idx}`}
                    step={step}
                    onAnswer={onAnswerQuestion}
                  />
                );
              }

              // B. Python Execution (run_python)
              if (norm === "runpython" || norm === "python") {
                return (
                  <PythonRunnerTraceItem
                    key={step.id || `py_${idx}`}
                    tool={step}
                  />
                );
              }

              // C. Todo Write (todo_write)
              if (norm === "todowrite" || norm === "todo") {
                return (
                  <TodoWriteTraceItem
                    key={step.id || `todo_${idx}`}
                    tool={step}
                  />
                );
              }

              // D. Terminal / Shell command (run_command, bash, terminal, sh, exec)
              if (
                norm === "bash" ||
                norm === "terminal" ||
                norm === "runcommand" ||
                norm === "sh" ||
                norm === "exec"
              ) {
                return (
                  <TerminalCard
                    key={step.id || `cmd_${idx}`}
                    tool={step}
                    isDefaultOpen={Boolean(step.isError)}
                  />
                );
              }

              // E. File Mutation (write, edit, replace, apply_patch)
              if (
                norm.includes("write") ||
                norm.includes("edit") ||
                norm.includes("replace") ||
                norm.includes("createfile") ||
                norm.includes("modify") ||
                norm.includes("patch")
              ) {
                return (
                  <FileMutationCard
                    key={step.id || `mut_${idx}`}
                    tool={step}
                    mutations={mutations}
                    onOpenFileDiff={onOpenFileDiff}
                  />
                );
              }

              // F. Exploration & Search (grep, search, find)
              if (
                norm === "grep" ||
                norm === "grepsearch" ||
                norm === "search" ||
                norm === "find" ||
                norm === "findbyname"
              ) {
                return (
                  <GrepSearchCard
                    key={step.id || `exp_${idx}`}
                    tool={step}
                  />
                );
              }

              // G. File Reads (read, readfile, cat, viewfile, listdir, ls)
              if (
                norm === "read" ||
                norm === "readfile" ||
                norm === "cat" ||
                norm === "viewfile" ||
                norm === "listdir" ||
                norm === "ls"
              ) {
                return (
                  <FileReadCard
                    key={step.id || `read_${idx}`}
                    tool={step}
                  />
                );
              }

              // H. Generic fallback
              return <GenericToolItem key={step.id || `other_${idx}`} tool={step} />;
            }

            return null;
          })}

          {/* Active executing spinner */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-xs text-[#a9a9a9] dark:text-[#777777] py-1">
              <Loader2 className="w-3 h-3 animate-spin text-[#e79737] dark:text-[#ff7a00]" />
              <span>Working...</span>
            </div>
          )}
        </div>
      </SmoothCollapse>
        </>
      )}

      {showMutationsSummary && mutations && mutations.length > 0 && (
        <MutationsSummaryCard
          mutations={mutations}
          isExecuting={isExecuting}
          onRollback={onRollback}
          onRollbackAll={onRollbackAll}
          onOpenFileDiff={onOpenFileDiff}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Thought Item: Minimalist thinking accordion matching apps/harness/desktop
// Header: "Thought for 7s ⌄"
// Body: Muted markdown text (#888888), NO cards, NO heavy borders
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

  // Live timer strictly for this thought step's duration from startTime
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
        className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#262626] dark:hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        <span>{thoughtLabel()}</span>
        <ChevronDown
          className="w-3.5 h-3.5 text-[#777777] transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="pt-1.5 pb-2 pl-0.5 text-[12.5px] leading-relaxed text-[#888888] select-text">
          <ScrollArea className="w-full max-h-56 pr-2.5 [&>div>div[style]]:!block">
            <MarkdownContent
              content={thinking}
              className="text-[12.5px] leading-relaxed text-[#888888] [&_strong]:font-semibold [&_strong]:text-foreground [&_strong]:block [&_strong]:mb-1 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-1 [&_h3]:text-[12.5px] [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mb-1 [&_p]:my-1"
            />
          </ScrollArea>
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Terminal Card: Single row trigger, click to expand terminal output
// ---------------------------------------------------------------------------
function TerminalCard({
  tool,
  isDefaultOpen = false,
}: {
  tool: TraceStep | DisplayToolCall;
  isDefaultOpen?: boolean;
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

  const isFailed = Boolean(tool.isError || (tool as any).status === "error");

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
      {/* Trigger row */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full text-left inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#262626] dark:hover:text-[#d4d4d4] transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 min-w-0 max-w-full justify-start select-none"
      >
        <TerminalIcon className="w-3.5 h-3.5 text-[#777777] shrink-0" />
        <span className="font-mono text-xs text-foreground/90 dark:text-[#d4d4d4] truncate flex-1 min-w-0 text-left">
          {cmd || "command"}
        </span>
        {isFailed ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff5c5c] shrink-0" title="Failed" />
        ) : tool.result !== undefined || (tool as any).status === "completed" ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#409D62] shrink-0" title="Success" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-[#e79737] dark:bg-[#ff7a00] animate-pulse shrink-0" title="Running command..." />
        )}
        <ChevronDown
          className="w-3 h-3 text-[#666666] shrink-0 ml-1 transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {/* Expanded Terminal Panel */}
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
            {tool.result === undefined && (tool as any).status === "running" ? (
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
// 3. Grep / Search Card: "Searched *pattern* 7 results" + click to expand
// ---------------------------------------------------------------------------
function GrepSearchCard({ tool }: { tool: TraceStep | DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);

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
  } else if (Array.isArray(tool.result)) {
    resultCount = `${tool.result.length} results`;
  }

  const hasResult = Boolean(tool.result);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => hasResult && setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none ${
          hasResult ? "cursor-pointer" : ""
        }`}
      >
        <Search className="w-3.5 h-3.5 text-[#777777] shrink-0" />
        <span className="shrink-0">Searched</span>
        <span className="text-foreground/90 dark:text-[#d4d4d4] font-medium truncate">
          *{query}*
        </span>
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

// ---------------------------------------------------------------------------
// 4. File Read Card: FileIcon + filename + line range + preview snippet
// ---------------------------------------------------------------------------
function FileReadCard({ tool }: { tool: TraceStep | DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);

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
    targetArg.replace(/\\/g, "/").split("/").filter(Boolean).pop() || targetArg || "file";

  const hasResult = Boolean(tool.result);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => hasResult && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none ${
          hasResult ? "cursor-pointer group" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-foreground/90 dark:text-[#d4d4d4] group-hover:text-foreground dark:group-hover:text-white truncate font-sans">
            {fileName}
          </span>
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
// 5. File Mutation Card: FileIcon + filename + +X -Y diffs
// ---------------------------------------------------------------------------
function FileMutationCard({
  tool,
  mutations = [],
  onOpenFileDiff,
}: {
  tool: TraceStep | DisplayToolCall;
  mutations?: FileMutationRecord[];
  onOpenFileDiff?: (record: FileMutationRecord) => void;
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

  const matchedMutation = tool.mutation || mutations.find((m) => {
    const p = m.targetFile || m.filePath || "";
    return p === targetArg || p.endsWith("/" + fileName);
  });

  // Calculate approximate lines added/removed from content or replacement
  let added = 0;
  let removed = 0;
  if (tool.args) {
    if (typeof tool.args.CodeContent === "string") {
      added = tool.args.CodeContent.split("\n").length;
    } else if (typeof tool.args.ReplacementContent === "string") {
      added = tool.args.ReplacementContent.split("\n").length;
      if (typeof tool.args.TargetContent === "string") {
        removed = tool.args.TargetContent.split("\n").length;
      }
    } else if (typeof tool.args.content === "string") {
      added = tool.args.content.split("\n").length;
    }
  }

  const hasSnippet = Boolean(tool.args?.CodeContent || tool.args?.ReplacementContent || tool.args?.content);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => hasSnippet && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[13px] min-w-0 select-none ${
          hasSnippet ? "cursor-pointer group" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-foreground/90 dark:text-[#d4d4d4] group-hover:text-foreground dark:group-hover:text-white truncate font-sans">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(added > 0 || removed > 0) && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              {added > 0 && <span className="text-[#409D62]">+{added}</span>}
              {removed > 0 && <span className="text-[#ff5c5c]">-{removed}</span>}
            </div>
          )}
          {matchedMutation && onOpenFileDiff && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFileDiff(matchedMutation);
              }}
              className="px-1.5 py-0.5 rounded text-[10.5px] text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Open diff in Preview panel"
            >
              Focus ↗
            </button>
          )}
          {hasSnippet && (
            <ChevronDown
              className="w-3 h-3 text-[#666666] transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {hasSnippet && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-[#0e0e10] border border-[#232328] text-xs font-mono select-text">
            <ScrollArea className="max-h-40 w-full text-[11px] text-[#999999]">
              <pre className="whitespace-pre-wrap">
                {String(
                  tool.args?.ReplacementContent ||
                    tool.args?.CodeContent ||
                    tool.args?.content ||
                    ""
                ).slice(0, 1500)}
              </pre>
            </ScrollArea>
          </div>
        </SmoothCollapse>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Asked Questions Trace Item: "? Asked N questions ⌄" with questions & answers
// ---------------------------------------------------------------------------
function AskedQuestionsTraceItem({
  step,
  onAnswer,
}: {
  step: TraceStep | DisplayToolCall;
  onAnswer?: (toolCallId: string, answer: any) => void;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(true);
  const [customInput, setCustomInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const isCompleted = Boolean(step.result || (step as any).status === "completed");

  // Parse Q&A pairs for completed questions
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

  const handleSelect = async (opt: string) => {
    if (isCompleted || isSubmitting || !onAnswer) return;
    setSelectedOption(opt);
    setIsSubmitting(true);
    try {
      await onAnswer(step.id, opt);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed || isCompleted || isSubmitting || !onAnswer) return;
    setSelectedOption(trimmed);
    setIsSubmitting(true);
    try {
      await onAnswer(step.id, trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-w-0 my-0.5 font-sans select-none">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#666666] dark:text-[#888888] hover:text-[#111111] dark:hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        <HelpCircle className="w-3.5 h-3.5 text-[#777777] shrink-0" />
        <span>
          {isCompleted
            ? `Asked ${questionCount} question${questionCount > 1 ? "s" : ""}`
            : "Asking questions"}
        </span>
        <ChevronDown
          className="w-3.5 h-3.5 text-[#777777] transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="pt-1.5 pb-2 pl-5 space-y-2 select-text font-sans">
          {isCompleted ? (
            qaPairs.map((pair, idx) => (
              <div key={idx} className="space-y-0.5 text-left">
                <div className="font-semibold text-[12.5px] text-foreground dark:text-[#d4d4d4] leading-snug">
                  {pair.question}
                </div>
                <div className="text-[12px] text-[#666666] dark:text-[#888888] leading-snug">
                  {pair.answer}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2 text-left">
              {rawQuestions.map((qObj, qIdx) => {
                const questionText = qObj?.question || "Bagaimana kita ingin melanjutkan?";
                const options: string[] = Array.isArray(qObj?.options) ? qObj.options : [];
                return (
                  <div key={qIdx} className="space-y-2">
                    <div className="font-semibold text-[12.5px] text-foreground dark:text-[#d4d4d4] leading-snug">
                      {questionText}
                    </div>
                    {options.length > 0 && (
                      <div className="space-y-1.5">
                        {options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleSelect(opt)}
                            className={cn(
                              "w-full text-left p-2 rounded-lg border transition-all text-xs font-medium flex items-center justify-between cursor-pointer",
                              selectedOption === opt
                                ? "bg-sky-500/20 border-sky-400 text-sky-200"
                                : "bg-background/60 hover:bg-black/5 dark:hover:bg-white/5 border-border/60 text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-mono">
                                {oIdx + 1}
                              </span>
                              <span>{opt}</span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground opacity-70" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <form onSubmit={handleCustomSubmit} className="pt-1 flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  disabled={isSubmitting}
                  placeholder={t("customAnswerPlaceholder")}
                  className="flex-1 bg-background/80 border border-border/60 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-sky-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={!customInput.trim() || isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                >
                  <Send className="h-3 w-3" />
                </button>
              </form>
            </div>
          )}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Python Runner Item with Charts & Output
// ---------------------------------------------------------------------------
function PythonRunnerTraceItem({ tool }: { tool: TraceStep | DisplayToolCall }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, string>>({});

  const code = tool.args?.code || "";
  const stdout = tool.result?.stdout || "";
  const stderr = tool.result?.stderr || "";
  const artifacts: string[] = Array.isArray(tool.result?.artifacts)
    ? tool.result.artifacts
    : [];

  const isRunning = (tool as any).status === "running";
  const isError = Boolean(tool.isError || (tool as any).status === "error");

  useEffect(() => {
    if (artifacts.length === 0) return;
    const electron = (window as any).electron;
    if (!electron?.readMedia) return;

    let isMounted = true;
    for (const artPath of artifacts) {
      if (
        artPath.endsWith(".png") ||
        artPath.endsWith(".svg") ||
        artPath.endsWith(".jpg") ||
        artPath.endsWith(".jpeg")
      ) {
        electron.readMedia(artPath).then((dataUri: string | null) => {
          if (isMounted && dataUri) {
            setMediaPreviews((prev) => ({ ...prev, [artPath]: dataUri }));
          }
        });
      }
    }
    return () => {
      isMounted = false;
    };
  }, [artifacts]);

  const handleOpenPath = (targetPath: string) => {
    const electron = (window as any).electron;
    if (electron?.openPath) {
      electron.openPath(targetPath);
    }
  };

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[13px] text-[#888888] min-w-0 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename="script.py" />
          <span className="font-mono text-xs text-foreground/90 dark:text-[#d4d4d4] truncate">
            {code ? code.split("\n")[0]?.slice(0, 35) + "..." : "Python calculation"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <span className="w-1.5 h-1.5 rounded-full bg-[#e79737] dark:bg-[#ff7a00] animate-pulse" />
          ) : isError ? (
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff5c5c]" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-[#409D62]" />
          )}
          <ChevronDown
            className="w-3 h-3 text-[#666666] transition-transform duration-200 ease-out"
            style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </div>
      </div>

      <SmoothCollapse isOpen={isOpen}>
        <div className="mt-1 p-2.5 rounded-xl bg-[#0e0e10] border border-[#232328] font-mono text-[12px] leading-relaxed select-text shadow-xs w-full min-w-0 space-y-2">
          {/* Visual chart artifacts */}
          {artifacts.length > 0 && (
            <div className="space-y-2">
              {artifacts.map((artPath) => {
                const fileName = artPath.split(/[\\/]/).pop() || artPath;
                const dataUri = mediaPreviews[artPath];

                return (
                  <div
                    key={artPath}
                    className="p-2 rounded-lg bg-[#161618] border border-[#27272b] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#e0e0e0] flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-yellow-500" />
                        <strong>{fileName}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenPath(artPath)}
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline cursor-pointer"
                      >
                        <span>{t("openFile")}</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </button>
                    </div>

                    {dataUri && (
                      <div className="rounded overflow-hidden border border-[#2f2f35] bg-[#000000] p-1">
                        <img
                          src={dataUri}
                          alt={fileName}
                          className="max-h-60 w-auto mx-auto object-contain rounded"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {code && (
            <div>
              <div className="text-[#777777] text-[10px] mb-1">Python script:</div>
              <pre className="p-2 rounded-lg bg-[#161618] border border-[#27272b] overflow-x-auto text-[#ffd438] max-h-40 overflow-y-auto whitespace-pre">
                {code}
              </pre>
            </div>
          )}

          {stdout && (
            <div>
              <div className="text-[#777777] text-[10px] mb-1">stdout:</div>
              <pre className="p-2 rounded-lg bg-[#161618] border border-[#27272b] overflow-x-auto text-[#409D62] max-h-40 overflow-y-auto whitespace-pre-wrap">
                {stdout}
              </pre>
            </div>
          )}

          {stderr && (
            <div>
              <div className="text-[#ff5c5c] text-[10px] mb-1">stderr:</div>
              <pre className="p-2 rounded-lg bg-[#ff5c5c]/10 border border-[#ff5c5c]/30 overflow-x-auto text-[#ff5c5c] max-h-40 overflow-y-auto whitespace-pre-wrap">
                {stderr}
              </pre>
            </div>
          )}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Todo Write Item
// ---------------------------------------------------------------------------
function TodoWriteTraceItem({ tool }: { tool: TraceStep | DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const rawTasks = tool.args?.todos || tool.args?.tasks || [];
  const tasks: Array<{ content?: string; text?: string; status: "pending" | "in_progress" | "completed" }> =
    Array.isArray(rawTasks) ? rawTasks : [];

  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[13px] text-[#888888] min-w-0 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <ListTodo className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-sans text-foreground/90 dark:text-[#d4d4d4] truncate">
            Roadmap ({completedCount}/{tasks.length})
          </span>
        </div>
        <ChevronDown
          className="w-3 h-3 text-[#666666] transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </div>

      <SmoothCollapse isOpen={isOpen}>
        <div className="mt-1 p-2 rounded-xl bg-[#0e0e10] border border-[#232328] text-xs font-sans space-y-1.5">
          {tasks.map((task, idx) => {
            const text = task.content || task.text || `Task ${idx + 1}`;
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-2 p-1.5 rounded border text-xs",
                  task.status === "completed"
                    ? "bg-[#161618]/50 border-[#27272b] text-[#666666] line-through"
                    : task.status === "in_progress"
                    ? "bg-cyan-950/20 border-cyan-500/40 text-cyan-300 font-medium"
                    : "bg-[#161618] border-[#27272b] text-[#d4d4d4]"
                )}
              >
                {task.status === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#409D62] shrink-0 mt-0.5" />
                ) : task.status === "in_progress" ? (
                  <Loader2 className="h-3.5 w-3.5 text-cyan-400 shrink-0 animate-spin mt-0.5" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-[#555555] shrink-0 mt-0.5" />
                )}
                <span>{text}</span>
              </div>
            );
          })}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. Generic Tool Item Fallback
// ---------------------------------------------------------------------------
function GenericToolItem({ tool }: { tool: TraceStep | DisplayToolCall }) {
  let targetArg = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      targetArg = tool.args;
    } else {
      targetArg = tool.args.path || tool.args.command || Object.values(tool.args)[0] || "";
    }
  }

  return (
    <div className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none">
      <Layers className="w-3.5 h-3.5 text-[#777777] shrink-0" />
      <span className="capitalize shrink-0">{tool.name}</span>
      {targetArg && (
        <span className="text-foreground/90 dark:text-[#d4d4d4] truncate">
          {typeof targetArg === "string" ? targetArg : JSON.stringify(targetArg)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 10. MutationsSummaryCard & Rollback diff calculation
// ---------------------------------------------------------------------------
export interface DiffStats {
  added: number;
  removed: number;
}

export interface DiffLine {
  type: "context" | "added" | "removed";
  content: string;
  oldNum?: number;
  newNum?: number;
}

const diffStatsCache = new WeakMap<FileMutationRecord, DiffStats>();

export function computeDiff(
  prev: string | null | undefined,
  next: string | null | undefined
): DiffLine[] {
  try {
    const safePrev = typeof prev === "string" ? prev : (prev != null ? String(prev) : null);
    const safeNext = typeof next === "string" ? next : (next != null ? String(next) : null);

    const prevLines = safePrev !== null ? safePrev.split(/\r?\n/) : [];
    const nextLines = safeNext !== null ? safeNext.split(/\r?\n/) : [];

    if (safePrev === null) {
      return nextLines.map((line, idx) => ({
        type: "added",
        content: line,
        newNum: idx + 1,
      }));
    }

    if (safeNext === null) {
      return prevLines.map((line, idx) => ({
        type: "removed",
        content: line,
        oldNum: idx + 1,
      }));
    }

    if (safePrev === safeNext) {
      return prevLines.map((line, idx) => ({
        type: "context",
        content: line,
        oldNum: idx + 1,
        newNum: idx + 1,
      }));
    }

    // Safety guard for very large files (> 3000 lines) to prevent freezing main thread
    if (prevLines.length + nextLines.length > 3000) {
      const truncatedNext = nextLines.slice(0, 300);
      return [
        ...truncatedNext.map((line, idx) => ({
          type: "added" as const,
          content: line,
          newNum: idx + 1,
        })),
        {
          type: "context" as const,
          content: `... (${nextLines.length - 300} more lines omitted for performance) ...`,
        },
      ];
    }

    let prefix = 0;
    while (
      prefix < prevLines.length &&
      prefix < nextLines.length &&
      prevLines[prefix] === nextLines[prefix]
    ) {
      prefix++;
    }

    let suffixOld = prevLines.length - 1;
    let suffixNew = nextLines.length - 1;
    while (
      suffixOld >= prefix &&
      suffixNew >= prefix &&
      prevLines[suffixOld] === nextLines[suffixNew]
    ) {
      suffixOld--;
      suffixNew--;
    }

    const lines: DiffLine[] = [];
    for (let i = 0; i < prefix; i++) {
      lines.push({ type: "context", content: prevLines[i]!, oldNum: i + 1, newNum: i + 1 });
    }

    for (let i = prefix; i <= suffixOld; i++) {
      lines.push({ type: "removed", content: prevLines[i]!, oldNum: i + 1 });
    }

    for (let i = prefix; i <= suffixNew; i++) {
      lines.push({ type: "added", content: nextLines[i]!, newNum: i + 1 });
    }

    for (let i = suffixOld + 1; i < prevLines.length; i++) {
      const nextIdx = suffixNew + 1 + (i - (suffixOld + 1));
      lines.push({ type: "context", content: prevLines[i]!, oldNum: i + 1, newNum: nextIdx + 1 });
    }

    return lines;
  } catch (err) {
    console.error("[computeDiff error]:", err);
    return [];
  }
}

export function getMutationDiffStats(m: FileMutationRecord): DiffStats {
  try {
    if (!m) return { added: 0, removed: 0 };
    if (diffStatsCache.has(m)) {
      return diffStatsCache.get(m)!;
    }

    let stats: DiffStats;
    const prev = typeof m.previousContent === "string" ? m.previousContent : (m.previousContent != null ? String(m.previousContent) : null);
    const next = typeof m.newContent === "string" ? m.newContent : (m.newContent != null ? String(m.newContent) : null);

    if (m.operation === "create" || prev === null) {
      const lines = next !== null ? next.split(/\r?\n/).length : 0;
      stats = { added: Math.max(1, lines), removed: 0 };
    } else if (m.operation === "delete" || next === null) {
      const lines = prev !== null ? prev.split(/\r?\n/).length : 0;
      stats = { added: 0, removed: Math.max(1, lines) };
    } else if (prev === next) {
      stats = { added: 0, removed: 0 };
    } else {
      const diff = computeDiff(prev, next);
      let added = 0;
      let removed = 0;
      for (const line of diff) {
        if (line.type === "added") added++;
        else if (line.type === "removed") removed++;
      }
      stats = { added, removed };
    }

    diffStatsCache.set(m, stats);
    return stats;
  } catch (err) {
    console.error("[getMutationDiffStats error]:", err);
    return { added: 0, removed: 0 };
  }
}

export function MutationsSummaryCard({
  mutations,
  isExecuting = false,
  onRollback,
  onRollbackAll,
  onOpenFileDiff,
}: {
  mutations: FileMutationRecord[];
  isExecuting?: boolean;
  onRollback?: (record: FileMutationRecord) => void;
  onRollbackAll?: (records: FileMutationRecord[]) => void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
}) {
  const { t, language } = useI18n();
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

  const unrolledCount = mutations.filter((m) => !m.rolledBack).length;

  return (
    <div className="w-full rounded-xl bg-card dark:bg-[#141414] border border-border/70 dark:border-[#2b2b2b] my-2 select-none font-sans overflow-hidden transition-all shadow-xs animate-in fade-in-0 duration-200">
      <div
        className={cn(
          "flex items-center justify-between px-3.5 py-2 transition-all",
          isOpen && "border-b border-border/60 dark:border-[#242424]"
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 text-[13px] text-foreground/90 dark:text-[#cccccc] hover:text-foreground dark:hover:text-white transition-colors cursor-pointer group/card"
        >
          <span className="font-normal text-foreground/90 dark:text-[#d4d4d4]">
            {mutations.length === 1
              ? t("fileChangedSingle")
              : t("filesChanged", { count: mutations.length })}
          </span>
          <span className="font-mono text-xs text-[#409D62] font-medium">+{totalAdded}</span>
          <span className="font-mono text-xs text-[#ff5c5c] font-medium">-{totalRemoved}</span>
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200 ease-out",
              isOpen && "rotate-90"
            )}
          />
        </button>

        <div className="flex items-center gap-2">
          {onRollbackAll && unrolledCount > 0 && (
            <button
              type="button"
              onClick={() => onRollbackAll(mutations)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted dark:bg-[#1e1e1e] dark:hover:bg-[#282828] border border-border/80 dark:border-[#333333] text-[11.5px] text-foreground/90 hover:text-foreground dark:text-[#d4d4d4] dark:hover:text-white transition-all cursor-pointer font-medium shadow-xs"
              title={t("undoAllChangesInTurn")}
            >
              <RotateCcw className="w-3 h-3 text-muted-foreground" />
              <span>{t("undoAll")}</span>
            </button>
          )}
        </div>
      </div>

      <SmoothCollapse isOpen={isOpen}>
        <div className="px-3 py-2 w-full">
          {mutations.length > 6 ? (
            <ScrollArea className="max-h-60 w-full pr-1" viewportClassName="[&>div[style]]:!block">
              <div className="flex flex-col gap-0.5">
                {mutations.map((mut) => (
                  <MutationRowItem key={mut.id} mut={mut} onRollback={onRollback} onOpenFileDiff={onOpenFileDiff} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col gap-0.5">
              {mutations.map((mut) => (
                <MutationRowItem key={mut.id} mut={mut} onRollback={onRollback} onOpenFileDiff={onOpenFileDiff} />
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
  onOpenFileDiff,
}: {
  mut: FileMutationRecord;
  onRollback?: (record: FileMutationRecord) => void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
}) {
  const { t, language } = useI18n();
  const rawPath = mut.targetFile || mut.filePath || mut.absolutePath || "file";
  const fileName = rawPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || rawPath;
  const dirPath = rawPath.replace(/\\/g, "/").split("/").slice(0, -1).join("/") || "";
  const fileStats = getMutationDiffStats(mut);

  return (
    <div
      onClick={() => onOpenFileDiff?.(mut)}
      className={`flex items-center justify-between group py-1.5 px-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors ${
        onOpenFileDiff ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <FileIcon filename={fileName} />
        <span
          className={`text-[13px] truncate font-sans ${
            mut.rolledBack
              ? "line-through text-muted-foreground/60 dark:text-[#666666]"
              : "text-foreground/90 dark:text-[#d4d4d4]"
          }`}
        >
          {fileName}
        </span>
        {dirPath && (
          <span className="text-[11px] text-muted-foreground/60 dark:text-[#555555] font-mono truncate max-w-[240px]">
            /{dirPath}
          </span>
        )}
      </div>

      <div className="shrink-0 ml-2 flex items-center gap-2">
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-[#409D62]">+{fileStats.added}</span>
          <span className="text-[#ff5c5c]">-{fileStats.removed}</span>
        </div>

        {onOpenFileDiff && !mut.rolledBack && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFileDiff(mut);
            }}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/70 hover:bg-muted dark:bg-[#202020] dark:hover:bg-[#2e2e2e] border border-border/80 dark:border-[#333333] text-[10.5px] text-neutral-400 hover:text-white transition-all cursor-pointer shadow-xs"
            title="Focus in Preview panel"
          >
            Focus ↗
          </button>
        )}

        {mut.rolledBack ? (
          <span className="text-[10.5px] text-[#409D62] font-medium flex items-center gap-0.5">
            <Check className="w-3 h-3 text-[#409D62]" />
            <span>{t("undone")}</span>
          </span>
        ) : onRollback ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRollback(mut);
            }}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded bg-muted/70 hover:bg-muted dark:bg-[#202020] dark:hover:bg-[#2e2e2e] border border-border/80 dark:border-[#333333] text-[10.5px] text-foreground/80 hover:text-foreground dark:text-[#d4d4d4] dark:hover:text-white transition-all cursor-pointer shadow-xs"
            title={language === "id" ? "Undo perubahan pada berkas ini" : "Undo changes to this file"}
          >
            <RotateCcw className="w-2.5 h-2.5 text-muted-foreground" />
            <span>Undo</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

