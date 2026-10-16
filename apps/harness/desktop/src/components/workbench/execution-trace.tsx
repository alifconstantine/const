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
  Bot,
  Globe,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import type { FileMutationRecord, TraceStep } from "../../vite-env";
import { FileIcon } from "./file-icon";
import { MarkdownContent } from "./markdown-content";
import { getMutationDiffStats } from "./review-dialog";
import { useTranslation } from "../../lib/i18n";

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
  onOpenFileDiff?: (record: FileMutationRecord) => void;
  onOpenFilePreview?: (filePath: string, content?: string) => void;
  onAnswerQuestion?: (toolCallId: string, answer: any) => void;
  onOpenSubAgent?: (step: TraceStep) => void;
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
  onOpenFileDiff,
  onOpenFilePreview,
  onAnswerQuestion,
  onOpenSubAgent,
}: ExecutionTraceProps) {
  const { t } = useTranslation();
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
      if (!durationMs || durationMs < 1000) return `${t("workbench.workingFor")}...`;
      const s = Math.round(durationMs / 1000);
      if (s < 60) return `${t("workbench.workingFor")} ${s}s...`;
      const m = Math.floor(s / 60);
      const remS = s % 60;
      if (remS === 0) return `${t("workbench.workingFor")} ${m}m...`;
      return `${t("workbench.workingFor")} ${m}m ${remS}s...`;
    }
    if (!durationMs || durationMs < 1000) return `${t("workbench.workedFor")} 1s`;
    const s = Math.round(durationMs / 1000);
    if (s < 60) return `${t("workbench.workedFor")} ${s}s`;
    const m = Math.floor(s / 60);
    const remS = s % 60;
    if (remS === 0) return `${t("workbench.workedFor")} ${m}m`;
    return `${t("workbench.workedFor")} ${m}m ${remS}s`;
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

              // A2. SubAgent Delegation (task, spawn_agent, subagent, delegatetask)
              if (
                norm === "task" ||
                norm === "spawnagent" ||
                norm === "subagent" ||
                norm === "delegatetask"
              ) {
                return (
                  <SubAgentTraceItem
                    key={step.id || `subagent_${idx}`}
                    tool={step}
                    onOpenSubAgent={onOpenSubAgent}
                  />
                );
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
                      <span>{t("workbench.askingQuestions")}</span>
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

              // 1.5 Python Runner (run_python, python, code_interpreter)
              if (
                norm === "runpython" ||
                norm === "python" ||
                norm === "codeinterpreter"
              ) {
                return (
                  <PythonRunnerTraceItem
                    key={step.id || `py_${idx}`}
                    tool={step}
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
                    onOpenFileDiff={onOpenFileDiff}
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
                norm === "jfind" ||
                norm === "semanticsearch" ||
                norm === "grep" ||
                norm === "grepsearch" ||
                norm === "search"
              ) {
                return (
                  <ExplorationItem
                    key={step.id || `exp_${idx}`}
                    tool={step}
                    mutations={mutations}
                    onOpenFilePreview={onOpenFilePreview}
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
          onOpenFileDiff={onOpenFileDiff}
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
  const { t } = useTranslation();
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
        return t("workbench.thinkingWithDuration", { duration: String(Math.round(liveStepDuration / 1000)) });
      }
      return `${t("workbench.thinkingEffort")}...`;
    }
    const finalMs = durationMs ?? (liveStepDuration > 0 ? liveStepDuration : undefined);
    if (finalMs !== undefined && finalMs > 0) {
      const s = Math.max(1, Math.round(finalMs / 1000));
      return t("workbench.thoughtFor", { duration: String(s) });
    }
    return t("workbench.thoughtFor", { duration: "1" });
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
// Terminal Command Icon: displays language/tool brand icon powered by @thesvg/react
// ---------------------------------------------------------------------------
function TerminalCommandIcon({ cmd }: { cmd: string }) {
  const trimmed = cmd.trim();
  const firstWord = (trimmed.split(/\s+/)[0] || "")
    .toLowerCase()
    .replace(/^(?:\.\/|.*[\\/])/, "")
    .replace(/\.exe$/, "");

  const knownTools: Record<string, string> = {
    python: "python",
    python3: "python",
    py: "python",
    pytest: "python",
    node: "js",
    nodejs: "js",
    ts: "ts",
    tsx: "tsx",
    "ts-node": "ts",
    npm: "npm",
    npx: "npm",
    pnpm: "pnpm",
    yarn: "js",
    bun: "js",
    cargo: "rust",
    rustc: "rust",
    go: "go",
    golang: "go",
    dart: "dart",
    flutter: "flutter",
    java: "java",
    javac: "java",
    mvn: "java",
    gradle: "java",
    php: "php",
    ruby: "ruby",
    gem: "ruby",
    bundle: "ruby",
    git: "git",
    docker: "docker",
    vite: "vite",
    bash: "bash",
    sh: "sh",
    zsh: "sh",
    powershell: "ps1",
    pwsh: "ps1",
  };

  const matched = knownTools[firstWord];
  if (matched) {
    return (
      <FileIcon
        filename={matched}
        className="w-3.5 h-3.5 shrink-0"
        fallbackIcon={<TerminalIcon className="w-3.5 h-3.5 text-[#777777] shrink-0" />}
      />
    );
  }

  // Check if command runs a specific script file (e.g. ./main.py, test.rs, script.sh)
  const args = trimmed.split(/\s+/);
  for (const part of args) {
    if (part.includes(".") && !part.startsWith("-")) {
      const ext = part.split(".").pop()?.toLowerCase();
      if (
        ext &&
        [
          "py",
          "ts",
          "tsx",
          "js",
          "jsx",
          "sh",
          "bash",
          "ps1",
          "rs",
          "go",
          "dart",
          "rb",
          "php",
          "java",
        ].includes(ext)
      ) {
        return (
          <FileIcon
            filename={part}
            className="w-3.5 h-3.5 shrink-0"
            fallbackIcon={<TerminalIcon className="w-3.5 h-3.5 text-[#777777] shrink-0" />}
          />
        );
      }
    }
  }

  return <TerminalIcon className="w-3.5 h-3.5 text-[#777777] shrink-0" />;
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
  const { t } = useTranslation();
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
        <TerminalCommandIcon cmd={cmd} />
        <span className="font-mono text-xs text-[#d4d4d4] truncate flex-1 min-w-0 text-left">
          {cmd || "command"}
        </span>
        {isWaitingApproval ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a00] animate-ping shrink-0" title={t("workbench.waitingApproval")} />
        ) : isFailed ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff5c5c] shrink-0" title={t("common.error")} />
        ) : tool.result !== undefined ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#409D62] shrink-0" title={t("common.success")} />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-[#e79737] dark:bg-[#ff7a00] animate-pulse shrink-0" title={t("common.loading")} />
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
// Python Runner Item (run_python, python, code_interpreter) with @thesvg/react Python logo
// ---------------------------------------------------------------------------
function PythonRunnerTraceItem({ tool }: { tool: TraceStep | TraceToolCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, string>>({});

  let code = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      try {
        const parsed = JSON.parse(tool.args);
        code = parsed.code || parsed.script || tool.args;
      } catch {
        code = tool.args;
      }
    } else {
      code = tool.args.code || tool.args.script || "";
    }
  }

  const stdout = tool.result?.stdout || (typeof tool.result === "string" ? tool.result : "");
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

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => (code || stdout || stderr || artifacts.length > 0) && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none ${
          code || stdout || stderr || artifacts.length > 0 ? "cursor-pointer group" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename="script.py" />
          <span className="font-sans text-xs text-[#d4d4d4] truncate">
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
          {(code || stdout || stderr || artifacts.length > 0) && (
            <ChevronDown
              className="w-3 h-3 text-[#666666] transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
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
                    className="p-2 rounded-lg bg-[#141416] border border-[#232328] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#e0e0e0] flex items-center gap-1.5">
                        <Layers className="h-3 w-3 text-[#ff7a00]" />
                        <strong>{fileName}</strong>
                      </span>
                    </div>

                    {dataUri && (
                      <div className="rounded overflow-hidden border border-[#232328] bg-black p-1">
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
              <div className="text-[#888888] text-[10px] mb-1">Python script:</div>
              <ScrollArea className="max-h-40 w-full rounded-lg bg-[#141416] border border-[#232328]">
                <pre className="p-2 text-[#e79737] dark:text-[#ff7a00] whitespace-pre text-[11px] font-mono">
                  {code}
                </pre>
              </ScrollArea>
            </div>
          )}

          {stdout && (
            <div>
              <div className="text-[#888888] text-[10px] mb-1">stdout:</div>
              <ScrollArea className="max-h-40 w-full rounded-lg bg-[#141416] border border-[#232328]">
                <pre className="p-2 text-[#409D62] whitespace-pre-wrap text-[11px] font-mono">
                  {stdout}
                </pre>
              </ScrollArea>
            </div>
          )}

          {stderr && (
            <div>
              <div className="text-[#ff5c5c] text-[10px] mb-1">stderr:</div>
              <ScrollArea className="max-h-40 w-full rounded-lg bg-[#ff5c5c]/10 border border-[#ff5c5c]/30">
                <pre className="p-2 text-[#ff5c5c] whitespace-pre-wrap text-[11px] font-mono">
                  {stderr}
                </pre>
              </ScrollArea>
            </div>
          )}
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
  onOpenFileDiff,
}: {
  tool: TraceToolCall | TraceStep;
  mutations: FileMutationRecord[];
  onOpenFileDiff?: (record: FileMutationRecord) => void;
}) {
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

  const handleClick = () => {
    if (matched && onOpenFileDiff) {
      onOpenFileDiff(matched);
    }
  };

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={handleClick}
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 transition-colors text-[13px] min-w-0 select-none ${
          matched && onOpenFileDiff ? "cursor-pointer group" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-[#d4d4d4] group-hover:text-white truncate font-sans">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
            <div className="flex items-center gap-1.5 font-sans tabular-nums text-xs">
              <span className="text-[#409D62]">+{diffStats.added}</span>
              <span className="text-[#ff5c5c]">-{diffStats.removed}</span>
            </div>
          )}
          {matched && onOpenFileDiff && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFileDiff(matched);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-[11px] text-[#555555] dark:text-[#a0a0a0] hover:text-black dark:hover:text-white border border-[#d5d5d9] dark:border-[#333333] transition-colors cursor-pointer"
              title="Open diff in sidebar"
            >
              <span>Open Diff</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exploration Item: e.g. "Searched *pattern* 7 results" or "Read file.tsx"
// ---------------------------------------------------------------------------
function ExplorationItem({
  tool,
  mutations,
  onOpenFilePreview,
}: {
  tool: TraceToolCall | TraceStep;
  mutations: FileMutationRecord[];
  onOpenFilePreview?: (filePath: string, content?: string) => void;
}) {
  const { t } = useTranslation();
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
              <span className="text-[#666666] text-xs font-sans tabular-nums">{resultCount}</span>
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
        onClick={() => {
          if (onOpenFilePreview && targetArg) {
            onOpenFilePreview(
              targetArg,
              typeof tool.result === "string" ? tool.result : undefined
            );
          } else if (hasResult) {
            setIsOpen((prev) => !prev);
          }
        }}
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none ${
          (onOpenFilePreview && targetArg) || hasResult ? "cursor-pointer group" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-[#d4d4d4] group-hover:text-white truncate font-sans">{fileName}</span>
          {lineRange && (
            <span className="text-xs text-[#666666] shrink-0 font-sans tabular-nums">{lineRange}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onOpenFilePreview && targetArg && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFilePreview(
                  targetArg,
                  typeof tool.result === "string" ? tool.result : undefined
                );
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-[11px] text-[#555555] dark:text-[#a0a0a0] hover:text-black dark:hover:text-white border border-[#d5d5d9] dark:border-[#333333] transition-colors cursor-pointer"
              title={t("rightPane.filePreview")}
            >
              <span>{t("common.preview")}</span>
            </button>
          )}
          {!onOpenFilePreview && hasResult && (
            <ChevronDown
              className="w-3 h-3 text-[#666666] transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {!onOpenFilePreview && hasResult && (
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
// SubAgent Delegation Trace Item (Image 2 & 3)
// Monochrome studio styling: [Bot] SubAgent <role> · <Title> [Status]
// ---------------------------------------------------------------------------
function SubAgentTraceItem({
  tool,
  onOpenSubAgent,
}: {
  tool: TraceStep;
  onOpenSubAgent?: (step: TraceStep) => void;
}) {
  const args = tool.args || {};
  const baseRole = (args.agent || args.role || "task") as string;
  const resultStr = typeof tool.result === "string" ? tool.result : "";

  // Batch Mode: args.tasks is a non-empty array
  if (Array.isArray(args.tasks) && args.tasks.length > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        {args.tasks.map((tItem: any, idx: number) => {
          const itemRoleRaw = (tItem?.agent || tItem?.role || baseRole) as string;
          const itemRole =
            itemRoleRaw.toLowerCase().trim() === "task"
              ? "general-purpose"
              : itemRoleRaw;
          const itemHandle = (tItem?.id || tItem?.name) as string | undefined;
          const itemPrompt = (tItem?.assignment || tItem?.task || tItem?.prompt || "") as string;
          const itemTitle =
            tItem?.description ||
            itemHandle ||
            (typeof itemPrompt === "string" && itemPrompt
              ? itemPrompt.slice(0, 70).replace(/[\r\n]+/g, " ")
              : `Batch Task #${idx + 1}`);

          // Check individual task envelope inside batch result if available
          const itemEnvelopeRegex = itemHandle
            ? new RegExp(`<task-result[^>]*name="${itemHandle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "i")
            : null;
          const itemEnvelopeHeader = itemEnvelopeRegex
            ? resultStr.match(itemEnvelopeRegex)?.[0] || ""
            : "";

          const isItemFailed = Boolean(
            tool.isError ||
              (itemEnvelopeHeader
                ? itemEnvelopeHeader.includes('status="failed"') ||
                  itemEnvelopeHeader.includes('status="cancelled"')
                : resultStr.includes('status="failed"'))
          );
          const isItemRunning =
            !isItemFailed &&
            (!tool.result ||
              (itemEnvelopeHeader
                ? itemEnvelopeHeader.includes('status="running"')
                : resultStr.includes('status="running"')));

          const syntheticStep: any = {
            ...tool,
            targetAgentName: itemHandle,
            args: {
              ...args,
              agent: itemRoleRaw,
              name: itemHandle,
              description: itemTitle,
              assignment: itemPrompt,
            },
          };

          return (
            <div
              key={`${tool.id || "batch"}_${idx}`}
              onClick={() => onOpenSubAgent?.(syntheticStep)}
              className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none cursor-pointer group transition-colors"
              title="Click to view subagent execution in sidebar"
            >
              <Bot className="w-3.5 h-3.5 text-[#969696] shrink-0" />
              <span className="text-[#ffffff] font-medium text-xs shrink-0">SubAgent</span>
              <span className="text-[11px] font-sans px-1.5 py-0.2 rounded bg-[#1e1e20] border border-[#2e2e2e] text-[#a0a0a0] shrink-0">
                {itemRole}
              </span>
              {itemHandle && (
                <span className="text-[11px] font-mono text-[#888888] shrink-0">
                  {itemHandle}
                </span>
              )}
              <span className="text-[#5d5d5d] shrink-0">·</span>
              <span className="text-[#d4d4d4] group-hover:text-white transition-colors truncate text-xs flex-1 min-w-0 font-normal">
                {itemTitle}
              </span>
              {isItemFailed && (
                <span className="text-[11px] font-sans text-red-400/90 shrink-0 ml-auto font-medium">
                  Failed
                </span>
              )}
              {isItemRunning && (
                <span className="text-[11px] font-sans text-[#ff9900]/90 shrink-0 ml-auto flex items-center gap-1 font-medium">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Running
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Single-Task Mode
  const role = baseRole.toLowerCase().trim() === "task" ? "general-purpose" : baseRole;
  const nameMatch = resultStr.match(/name="([^"]+)"/);
  const handleName = (args.name || args.id || nameMatch?.[1]) as string | undefined;
  const promptStr = (args.assignment || args.task || args.prompt || "") as string;
  const title =
    args.description ||
    args.name ||
    args.label ||
    (typeof promptStr === "string" && promptStr
      ? promptStr.slice(0, 70).replace(/[\r\n]+/g, " ")
      : "Delegated subagent task");

  const isFailed = Boolean(
    tool.isError ||
      resultStr.includes('status="failed"') ||
      resultStr.includes('status="cancelled"') ||
      resultStr.includes('<error>')
  );
  const isRunning =
    !isFailed && (!tool.result || resultStr.includes('status="running"'));

  return (
    <div
      onClick={() => onOpenSubAgent?.(tool)}
      className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none cursor-pointer group transition-colors"
      title="Click to view subagent execution in sidebar"
    >
      <Bot className="w-3.5 h-3.5 text-[#969696] shrink-0" />
      <span className="text-[#ffffff] font-medium text-xs shrink-0">SubAgent</span>
      <span className="text-[11px] font-sans px-1.5 py-0.2 rounded bg-[#1e1e20] border border-[#2e2e2e] text-[#a0a0a0] shrink-0">
        {role}
      </span>
      {handleName && handleName !== title && (
        <span className="text-[11px] font-mono text-[#888888] shrink-0">
          {handleName}
        </span>
      )}
      <span className="text-[#5d5d5d] shrink-0">·</span>
      <span className="text-[#d4d4d4] group-hover:text-white transition-colors truncate text-xs flex-1 min-w-0 font-normal">
        {title}
      </span>
      {isFailed && (
        <span className="text-[11px] font-sans text-red-400/90 shrink-0 ml-auto font-medium">
          Failed
        </span>
      )}
      {isRunning && (
        <span className="text-[11px] font-sans text-[#ff9900]/90 shrink-0 ml-auto flex items-center gap-1 font-medium">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          Running
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic Tool Item fallback (including browser_* native tools)
// ---------------------------------------------------------------------------
function GenericToolItem({ tool }: { tool: TraceToolCall | TraceStep }) {
  const toolName = tool.name ?? "";
  const isBrowserTool = toolName.startsWith("browser_");
  let targetArg = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      targetArg = tool.args;
    } else if (isBrowserTool) {
      const refOrSel = tool.args.ref || tool.args.selector || "";
      if (tool.args.url) {
        targetArg = tool.args.url;
      } else if (tool.args.text && refOrSel) {
        targetArg = `${refOrSel} → "${tool.args.text}"`;
      } else if (refOrSel) {
        targetArg = refOrSel;
      } else if (tool.args.key) {
        targetArg = `Key: ${tool.args.key}`;
      } else if (tool.args.direction) {
        targetArg = `${tool.args.direction} (${tool.args.amount ?? 350}px)`;
      } else if (tool.args.reason) {
        targetArg = tool.args.reason;
      } else if (tool.args.secretWanted) {
        targetArg = tool.args.secretWanted;
      } else if (Array.isArray(tool.args.steps)) {
        targetArg = `${tool.args.steps.length} step(s)`;
      } else if (tool.args.script) {
        targetArg = String(tool.args.script).slice(0, 60);
      } else if (tool.args.compact) {
        targetArg = "compact";
      }
    } else {
      targetArg =
        tool.args.query ||
        tool.args.path ||
        tool.args.command ||
        (tool.args.op ? `${tool.args.op} ${tool.args.pr || tool.args.repo || ""}`.trim() : "") ||
        (tool.args.thoughts ? String(tool.args.thoughts).slice(0, 40) : "") ||
        (tool.args.code ? String(tool.args.code).slice(0, 40) : "") ||
        "";
    }
  }

  const displayName = isBrowserTool
    ? toolName.replace(/^browser_/, "browser ").replace(/_/g, " ")
    : toolName;

  return (
    <div className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0 select-none">
      {isBrowserTool ? (
        <Globe className="w-3.5 h-3.5 text-blue-400/80 shrink-0" />
      ) : (
        <Layers className="w-3.5 h-3.5 text-[#777777] shrink-0" />
      )}
      <span className="capitalize shrink-0">{displayName}</span>
      {targetArg && <span className="text-[#d4d4d4] truncate font-mono text-xs">{targetArg}</span>}
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
  onOpenFileDiff,
}: {
  mutations: FileMutationRecord[];
  isExecuting?: boolean;
  onRollback?: (record: FileMutationRecord) => void;
  onRollbackAll?: (records: FileMutationRecord[]) => void;
  onOpenReview?: () => void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
}) {
  const { t } = useTranslation();
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
            {mutations.length > 1
              ? t("workbench.filesChanged", { count: String(mutations.length) })
              : t("workbench.fileChanged", { count: String(mutations.length) })}
          </span>
          <span className="font-sans tabular-nums text-xs text-[#409D62] font-medium">+{totalAdded}</span>
          <span className="font-sans tabular-nums text-xs text-[#ff5c5c] font-medium">-{totalRemoved}</span>
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
              title={t("common.undoAll")}
            >
              <RotateCcw className="w-3 h-3 text-[#262626] dark:text-[#d4d4d4]" />
              <span>{t("common.undoAll")}</span>
            </button>
          )}

          {onOpenReview && (
            <button
              type="button"
              onClick={onOpenReview}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f4f4f6] hover:bg-[#eaeaea] dark:bg-[#1e1e1e] dark:hover:bg-[#282828] border border-[#e2e2e4] hover:border-[#d5d5d9] dark:border-[#333333] dark:hover:border-[#444444] text-[11.5px] text-[#262626] hover:text-black dark:text-[#e0e0e0] dark:hover:text-white transition-all cursor-pointer font-medium shadow-xs"
              title={t("workbench.reviewDialogTitle")}
            >
              <FileSearch className="w-3.5 h-3.5 text-[#a9a9a9] dark:text-[#9e9e9e]" />
              <span>{t("rightPane.review")}</span>
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
  const fileName =
    mut.targetFile.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
    mut.targetFile;
  const dirPath =
    mut.targetFile.replace(/\\/g, "/").split("/").slice(0, -1).join("/") || "";
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
        <div className="flex items-center gap-1.5 font-sans tabular-nums text-xs">
          <span className="text-[#409D62]">+{fileStats.added}</span>
          <span className="text-[#ff5c5c]">-{fileStats.removed}</span>
        </div>

        {onOpenFileDiff && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFileDiff(mut);
            }}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-[10px] text-[#555555] dark:text-[#a0a0a0] hover:text-black dark:hover:text-white border border-[#d5d5d9] dark:border-[#333333] transition-all cursor-pointer"
            title="Open diff in sidebar"
          >
            <span>Diff</span>
          </button>
        )}

        {mut.rolledBack ? (
          <span className="text-[10px] text-[#409D62] flex items-center gap-0.5">
            <Check className="w-3 h-3 text-[#409D62]" />
            <span>Undone</span>
          </span>
        ) : onRollback ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRollback(mut);
            }}
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

