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
  ExternalLink,
  Send,
  ArrowRight,
  Check,
  ListTodo,
  RotateCcw,
  Globe,
  Bookmark,
  Sparkles,
  Brain,
} from "lucide-react";
import { ScrollArea, cn, BrandLogo, getConnectorForTool, type ConnectorMetadata } from "@const/ui";
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
  onOpenBrowser?: (url: string) => void;
  onOpenStudioArtifact?: (artifact: any) => void;
  onOpenSourcePreview?: (source: any) => void;
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
  onOpenBrowser,
  onOpenStudioArtifact,
  onOpenSourcePreview,
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
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5 w-fit select-none group"
          >
            <span>{formatDuration()}</span>
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-200 ease-out",
                isMainOpen && "rotate-90"
              )}
            />
          </button>

          {/* Smooth Collapsible Content matching apps/harness/desktop */}
          <SmoothCollapse isOpen={isMainOpen}>
            <div className="flex flex-col gap-1.5 pl-3 ml-1 border-l border-border text-[13px] text-muted-foreground pt-1">
              {steps.map((step, idx) => {
                if (step.type === "thought") {
                  return (
                    <ThoughtItem
                      key={step.id || `thought_${idx}`}
                      thinking={step.content || ""}
                      durationMs={step.durationMs}
                      startTime={step.startTime}
                      isExecuting={isExecuting && idx === steps.length - 1 && !step.durationMs}
                      onOpenBrowser={onOpenBrowser}
                    />
                  );
                }

            if (step.type === "tool") {
              const norm = (step.name || "").toLowerCase().replace(/[-_]/g, "");

              // 0. Composio App Connectors (Canva MCP, Google Workspace, YouTube, etc.)
              const connector = getConnectorForTool(step.name || "");
              if (connector) {
                return (
                  <ConnectorToolTraceItem
                    key={step.id || `conn_${idx}`}
                    tool={step}
                    connector={connector}
                    onOpenBrowser={onOpenBrowser}
                  />
                );
              }

              // A. Socratic Question (ask_question)
              if (norm === "askquestion" || norm === "question") {
                if (!step.result && (step as any).status !== "completed") {
                  return (
                    <div
                      key={step.id || `q_${idx}`}
                      className="flex items-center gap-2 py-0.5 text-[13px] text-muted-foreground font-sans select-none"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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

              // A1. Save/Add Source (add_source)
              if (norm === "addsource" || norm === "createsource" || norm === "savesource") {
                return (
                  <AddSourceCard
                    key={step.id || `src_${idx}`}
                    tool={step}
                    onOpenBrowser={onOpenBrowser}
                    onOpenSourcePreview={onOpenSourcePreview}
                  />
                );
              }

              // A2. Create Studio Artifact (create_studio_artifact)
              if (
                norm === "createstudioartifact" ||
                norm === "createartifact" ||
                norm === "createstudyartifact"
              ) {
                return (
                  <StudioArtifactCard
                    key={step.id || `art_${idx}`}
                    tool={step}
                    onOpenStudioArtifact={onOpenStudioArtifact}
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

              // F. Exploration & Search (grep, search, find, web_search)
              if (
                norm === "grep" ||
                norm === "grepsearch" ||
                norm === "search" ||
                norm === "websearch" ||
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

              // F2. Web Fetch (web_fetch, webfetch, fetchurl)
              if (
                norm === "webfetch" ||
                norm === "fetchurl" ||
                norm === "readurl"
              ) {
                return (
                  <WebFetchCard
                    key={step.id || `fetch_${idx}`}
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

              // G2. Native Browser Automation (browser_navigate, browser_snapshot, browser_click, etc.)
              if (norm.startsWith("browser")) {
                return (
                  <BrowserToolCard
                    key={step.id || `browser_${idx}`}
                    tool={step}
                  />
                );
              }

              // G3. Long-Term Memory (retain, recall, reflect)
              if (
                norm === "retain" ||
                norm === "recall" ||
                norm === "reflect" ||
                norm === "remember" ||
                norm === "searchmemory" ||
                norm === "reflectmemory"
              ) {
                return (
                  <MemoryToolCard
                    key={step.id || `mem_${idx}`}
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
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
  onOpenBrowser,
}: {
  thinking: string;
  isExecuting?: boolean;
  durationMs?: number;
  startTime?: number;
  onOpenBrowser?: (url: string) => void;
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
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        <span>{thoughtLabel()}</span>
        <ChevronDown
          className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="pt-1.5 pb-2 pl-0.5 text-[12.5px] leading-relaxed text-muted-foreground select-text">
          <ScrollArea className="w-full max-h-56 pr-2.5 [&>div>div[style]]:!block">
            <MarkdownContent
              content={thinking}
              onOpenBrowser={onOpenBrowser}
              className="text-[12.5px] leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_strong]:block [&_strong]:mb-1 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-1 [&_h3]:text-[12.5px] [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mb-1 [&_p]:my-1"
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
        className="w-full text-left inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-muted min-w-0 max-w-full justify-start select-none"
      >
        <TerminalIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono text-xs text-foreground truncate flex-1 min-w-0 text-left">
          {cmd || "command"}
        </span>
        {isFailed ? (
          <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" title="Failed" />
        ) : tool.result !== undefined || (tool as any).status === "completed" ? (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Success" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" title="Running command..." />
        )}
        <ChevronDown
          className="w-3 h-3 text-muted-foreground shrink-0 ml-1 transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {/* Expanded Terminal Panel */}
      <SmoothCollapse isOpen={isOpen}>
        <div className="mt-1 p-2.5 rounded-xl bg-secondary/80 border border-border font-mono text-[12px] leading-relaxed select-text shadow-xs w-full min-w-0">
          {/* Header line: $ command */}
          <div className="text-foreground flex items-start gap-1.5 pb-1.5 mb-1.5 border-b border-border min-w-0">
            <span className="text-amber-500 font-bold shrink-0">$</span>
            <span className="font-mono text-xs text-foreground break-all leading-snug">
              {cmd}
            </span>
          </div>

          {/* Exit code banner */}
          {exitCodeDisplay && (
            <div className="text-xs text-destructive font-mono font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              <span>{exitCodeDisplay}</span>
            </div>
          )}

          {/* Output stdout/stderr wrapped in ScrollArea */}
          <ScrollArea className="max-h-60 w-full">
            {tool.result === undefined && (tool as any).status === "running" ? (
              <div className="text-amber-500 flex items-center gap-1.5 text-xs italic py-0.5">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span>Running command...</span>
              </div>
            ) : cleanResult ? (
              <div
                className={
                  isFailed
                    ? "text-destructive whitespace-pre-wrap text-[11.5px] font-mono leading-relaxed"
                    : "text-muted-foreground whitespace-pre-wrap text-[11.5px] font-mono leading-relaxed"
                }
              >
                {cleanResult}
              </div>
            ) : (
              <div className="text-muted-foreground/70 italic text-xs">(Command completed with no output)</div>
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
  const normName = (tool.name || "").toLowerCase().replace(/[-_]/g, "");
  const isWeb = normName.includes("web") || normName.includes("online");

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => hasResult && setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none ${
          hasResult ? "cursor-pointer" : ""
        }`}
      >
        {isWeb ? (
          <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        ) : (
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="shrink-0">{isWeb ? "Searched web" : "Searched"}</span>
        <span className="text-foreground font-medium truncate">
          *{query}*
        </span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {resultCount && (
            <span className="text-muted-foreground text-xs font-sans tabular-nums">{resultCount}</span>
          )}
          {hasResult && (
            <ChevronDown
              className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {hasResult && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-secondary/80 border border-border text-xs font-mono select-text">
            <ScrollArea className="max-h-40 w-full text-[11px] text-muted-foreground">
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
// 3b. Web Fetch Card: "Fetched web *url*" + click to expand
// ---------------------------------------------------------------------------
function WebFetchCard({ tool }: { tool: TraceStep | DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);

  let url = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      url = tool.args;
    } else {
      url = tool.args.url || tool.args.link || tool.args.href || "";
    }
  }

  const hasResult = Boolean(tool.result);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => hasResult && setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none ${
          hasResult ? "cursor-pointer" : ""
        }`}
      >
        <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="shrink-0">Fetched web</span>
        <span className="text-foreground font-medium truncate">
          {url}
        </span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {hasResult && (
            <ChevronDown
              className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {hasResult && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-secondary/80 border border-border text-xs font-mono select-text">
            <ScrollArea className="max-h-40 w-full text-[11px] text-muted-foreground">
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
// 3c. Native Browser Automation Card: "Navigated to ...", "Captured ARIA snapshot", etc.
// ---------------------------------------------------------------------------
function BrowserToolCard({ tool }: { tool: TraceStep | DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const norm = (tool.name || "").toLowerCase().replace(/[-_]/g, "");
  const args = typeof tool.args === "object" && tool.args ? tool.args : {};

  let actionLabel = "Browser action";
  let detailLabel = "";

  if (norm === "browsernavigate") {
    actionLabel = "Navigated browser";
    detailLabel = args.url || "";
  } else if (norm === "browsersnapshot") {
    actionLabel = args.diff ? "Captured ARIA diff" : "Captured ARIA snapshot";
    detailLabel = args.selector || "";
  } else if (norm === "browserclick") {
    actionLabel = "Clicked element";
    detailLabel = args.ref ? `[${args.ref}]` : args.selector || (args.x !== undefined ? `(${args.x}, ${args.y})` : "");
  } else if (norm === "browsertype") {
    actionLabel = "Typed into";
    detailLabel = `${args.ref ? `[${args.ref}]` : args.selector || "input"}${args.text ? ` "${String(args.text).slice(0, 36)}"` : ""}`;
  } else if (norm === "browserkey") {
    actionLabel = "Pressed key";
    detailLabel = args.key || "";
  } else if (norm === "browserscroll") {
    actionLabel = "Scrolled page";
    detailLabel = args.ref ? `[${args.ref}]` : args.direction || "down";
  } else if (norm === "browserscreenshot") {
    actionLabel = "Captured Set-of-Mark screenshot";
    detailLabel = args.annotate === false ? "(clean)" : "(annotated)";
  } else if (norm === "browserconsole") {
    actionLabel = "Inspected browser console & network";
    detailLabel = args.level || "";
  } else if (norm === "browserevaluate") {
    actionLabel = Array.isArray(args.steps)
      ? `Executed ${args.steps.length} browser steps`
      : "Evaluated script in browser";
  } else if (norm === "browsertabs") {
    actionLabel = args.action === "switch" ? "Switched browser tab" : "Listed browser tabs";
    detailLabel = args.tabId || "";
  } else if (norm === "browserrequesthelp") {
    actionLabel = "Requested human assistance";
    detailLabel = args.reason || args.secretWanted || "";
  }

  const hasResult = Boolean(tool.result);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => hasResult && setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none ${
          hasResult ? "cursor-pointer" : ""
        }`}
      >
        <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span className="shrink-0">{actionLabel}</span>
        {detailLabel && (
          <span className="text-foreground font-medium truncate">
            {detailLabel}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {hasResult && (
            <ChevronDown
              className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {hasResult && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-secondary/80 border border-border text-xs font-mono select-text">
            <ScrollArea className="max-h-48 w-full text-[11px] text-muted-foreground">
              <pre className="whitespace-pre-wrap">
                {typeof tool.result === "string"
                  ? tool.result.slice(0, 2000)
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
// 3b. Long-Term Memory Card (retain, recall, reflect)
// ---------------------------------------------------------------------------
function MemoryToolCard({ tool }: { tool: TraceStep | DisplayToolCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const norm = (tool.name || "").toLowerCase().replace(/[-_]/g, "");
  const args = tool.args || {};

  let actionLabel = "Memory operation";
  let detailLabel = "";

  if (norm === "retain" || norm === "remember" || norm === "savememory") {
    actionLabel = "Saved to long-term memory";
    if (Array.isArray(args.items) && args.items.length > 0) {
      detailLabel = args.items[0]?.content
        ? String(args.items[0].content).slice(0, 48)
        : `${args.items.length} items`;
    } else if (args.content) {
      detailLabel = String(args.content).slice(0, 48);
    }
  } else if (norm === "recall" || norm === "searchmemory") {
    actionLabel = "Retrieved memory";
    detailLabel = args.query || args.prompt || "";
  } else if (norm === "reflect" || norm === "reflectmemory") {
    actionLabel = "Synthesized memories";
    detailLabel = args.query || "";
  }

  const hasResult = Boolean(tool.result);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => hasResult && setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none ${
          hasResult ? "cursor-pointer" : ""
        }`}
      >
        <Brain className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="shrink-0">{actionLabel}</span>
        {detailLabel && (
          <span className="text-foreground font-medium truncate max-w-[260px]">
            {detailLabel}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {hasResult && (
            <ChevronDown
              className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {hasResult && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-secondary/80 border border-border text-xs font-mono select-text">
            <ScrollArea className="max-h-48 w-full text-[11px] text-muted-foreground">
              <pre className="whitespace-pre-wrap">
                {typeof tool.result === "string"
                  ? tool.result.slice(0, 2000)
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
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none ${
          hasResult ? "cursor-pointer group" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-foreground group-hover:text-foreground truncate font-sans">
            {fileName}
          </span>
          {lineRange && (
            <span className="text-xs text-muted-foreground shrink-0 font-sans tabular-nums">{lineRange}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasResult && (
            <ChevronDown
              className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {hasResult && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-secondary/80 border border-border text-xs font-mono select-text">
            <ScrollArea className="max-h-40 w-full text-[11px] text-muted-foreground">
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
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] min-w-0 select-none ${
          hasSnippet ? "cursor-pointer group" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-foreground group-hover:text-foreground truncate font-sans">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(added > 0 || removed > 0) && (
            <div className="flex items-center gap-1.5 font-sans tabular-nums text-xs">
              {added > 0 && <span className="text-emerald-500">+{added}</span>}
              {removed > 0 && <span className="text-destructive">-{removed}</span>}
            </div>
          )}
          {matchedMutation && onOpenFileDiff && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFileDiff(matchedMutation);
              }}
              className="px-1.5 py-0.5 rounded text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Open diff in Preview panel"
            >
              Focus ↗
            </button>
          )}
          {hasSnippet && (
            <ChevronDown
              className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {hasSnippet && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-secondary/80 border border-border text-xs font-mono select-text">
            <ScrollArea className="max-h-40 w-full text-[11px] text-muted-foreground">
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
}: {
  step: TraceStep | DisplayToolCall;
}) {
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
        const ans =
          typeof item.answer === "object" && item.answer !== null
            ? String(item.answer.label || item.answer.value || JSON.stringify(item.answer))
            : String(item.answer);
        qaPairs.push({ question: String(item.question), answer: ans });
      } else {
        const qText = rawQuestions[idx]?.question || `Question ${idx + 1}`;
        const ans =
          typeof item === "object" && item !== null
            ? String(item.label || item.value || JSON.stringify(item))
            : String(item);
        qaPairs.push({ question: qText, answer: ans });
      }
    });
  } else if (result && typeof result === "object") {
    Object.entries(result).forEach(([k, v]) => {
      const vText =
        typeof v === "object" && v !== null
          ? String((v as any).label || (v as any).value || JSON.stringify(v))
          : String(v);
      qaPairs.push({ question: k, answer: vText });
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
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span>
          Asked {questionCount} question{questionCount > 1 ? "s" : ""}
        </span>
        <ChevronDown
          className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="pt-1.5 pb-2 pl-5 space-y-2 select-text font-sans">
          {qaPairs.map((pair, idx) => (
            <div key={idx} className="space-y-0.5 text-left">
              <div className="font-semibold text-[12.5px] text-foreground leading-snug">
                {pair.question}
              </div>
              <div className="text-[12px] text-muted-foreground leading-snug">
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
        className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename="script.py" />
          <span className="font-sans text-xs text-foreground truncate">
            {code ? code.split("\n")[0]?.slice(0, 35) + "..." : "Python calculation"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          ) : isError ? (
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
          <ChevronDown
            className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
            style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </div>
      </div>

      <SmoothCollapse isOpen={isOpen}>
        <div className="mt-1 p-2.5 rounded-xl bg-secondary/80 border border-border font-mono text-[12px] leading-relaxed select-text shadow-xs w-full min-w-0 space-y-2">
          {/* Visual chart artifacts */}
          {artifacts.length > 0 && (
            <div className="space-y-2">
              {artifacts.map((artPath) => {
                const fileName = artPath.split(/[\\/]/).pop() || artPath;
                const dataUri = mediaPreviews[artPath];

                return (
                  <div
                    key={artPath}
                    className="p-2 rounded-lg bg-card border border-border space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-foreground flex items-center gap-1.5">
                        <Layers className="h-3 w-3 text-amber-500" />
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
                      <div className="rounded overflow-hidden border border-border bg-background p-1">
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
              <div className="text-muted-foreground text-[10px] mb-1">Python script:</div>
              <ScrollArea className="max-h-40 w-full rounded-lg bg-card border border-border">
                <pre className="p-2 text-amber-500 whitespace-pre text-[11px] font-mono">
                  {code}
                </pre>
              </ScrollArea>
            </div>
          )}

          {stdout && (
            <div>
              <div className="text-muted-foreground text-[10px] mb-1">stdout:</div>
              <ScrollArea className="max-h-40 w-full rounded-lg bg-card border border-border">
                <pre className="p-2 text-emerald-500 whitespace-pre-wrap text-[11px] font-mono">
                  {stdout}
                </pre>
              </ScrollArea>
            </div>
          )}

          {stderr && (
            <div>
              <div className="text-destructive text-[10px] mb-1">stderr:</div>
              <ScrollArea className="max-h-40 w-full rounded-lg bg-destructive/10 border border-destructive/30">
                <pre className="p-2 text-destructive whitespace-pre-wrap text-[11px] font-mono">
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
        className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <ListTodo className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-sans text-foreground truncate">
            Roadmap ({completedCount}/{tasks.length})
          </span>
        </div>
        <ChevronDown
          className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </div>

      <SmoothCollapse isOpen={isOpen}>
        <div className="mt-1 p-2 rounded-xl bg-secondary/80 border border-border text-xs font-sans space-y-1.5">
          {tasks.map((task, idx) => {
            const text = task.content || task.text || `Task ${idx + 1}`;
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-2 p-1.5 rounded border text-xs",
                  task.status === "completed"
                    ? "bg-muted/50 border-border text-muted-foreground line-through"
                    : task.status === "in_progress"
                    ? "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-300 font-medium"
                    : "bg-card border-border text-foreground"
                )}
              >
                {task.status === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                ) : task.status === "in_progress" ? (
                  <Loader2 className="h-3.5 w-3.5 text-sky-500 shrink-0 animate-spin mt-0.5" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0 mt-0.5" />
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
// 8.5. Composio Connector Tool Card (Canva MCP, Google Suite, YouTube, etc.)
// ---------------------------------------------------------------------------
function ConnectorToolTraceItem({
  tool,
  connector,
  onOpenBrowser,
}: {
  tool: TraceStep | DisplayToolCall;
  connector: ConnectorMetadata;
  onOpenBrowser?: (url: string) => void;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const isRunning = tool.status === "running" || (!tool.result && !tool.isError);

  // Parse result if JSON
  let parsedResult: any = null;
  if (tool.result) {
    if (typeof tool.result === "object") {
      parsedResult = tool.result;
    } else if (typeof tool.result === "string") {
      try {
        parsedResult = JSON.parse(tool.result);
      } catch {
        parsedResult = null;
      }
    }
  }

  const isPartialSuccess = parsedResult?.status === "partial_success";
  const isExplicitError = Boolean(
    tool.isError ||
      tool.status === "error" ||
      parsedResult?.status === "error" ||
      (parsedResult?.status &&
        parsedResult.status !== "success" &&
        parsedResult.status !== "partial_success")
  );
  const isError = isExplicitError && !isPartialSuccess;

  // Extract clean summary text from arguments
  const summaryText =
    tool.args?.title ||
    tool.args?.prompt ||
    tool.args?.query ||
    tool.args?.topic ||
    (tool.args?.code ? "code_execution" : "");

  // Page / Slide count
  const pageCount = parsedResult?.page_count || parsedResult?.slideCount;

  // Tag / Action
  const tag =
    tool.args?.action ||
    tool.args?.designType ||
    tool.args?.fileType ||
    (tool.args?.code ? "python" : null);

  const resultUrl =
    parsedResult?.editUrl ||
    parsedResult?.edit_url ||
    parsedResult?.spreadsheetUrl ||
    parsedResult?.documentUrl ||
    parsedResult?.presentationUrl ||
    parsedResult?.driveUrl ||
    parsedResult?.videoUrl ||
    parsedResult?.formUrl;

  const viewUrl = parsedResult?.viewUrl || parsedResult?.view_url;
  const thumbnails: Array<{ url: string }> = Array.isArray(parsedResult?.thumbnails)
    ? parsedResult.thumbnails
    : [];

  const resultMessage =
    parsedResult?.message ||
    (typeof tool.result === "string" ? tool.result : null);

  const handleOpenExternal = (url: string) => {
    if (onOpenBrowser) {
      onOpenBrowser(url);
    } else if ((window as any).electron?.openExternal) {
      (window as any).electron.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const hasContent = Boolean(tool.args || tool.result);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5 font-sans">
      {/* Sleek, compact Trigger Row matching TerminalCard & FileReadCard */}
      <div
        onClick={() => hasContent && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none ${
          hasContent ? "cursor-pointer group" : ""
        }`}
      >
        {/* Left: App Logo + Name + Tag/Slide Count + Brief Summary */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <BrandLogo id={connector.id} size="xs" />
          <span className="text-foreground group-hover:text-foreground font-medium truncate font-sans text-xs">
            {connector.name}
          </span>
          {pageCount && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-medium shrink-0">
              {t("slidesCount", { count: pageCount })}
            </span>
          )}
          {tag && !pageCount && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border/50 font-sans shrink-0">
              {tag}
            </span>
          )}
          {summaryText && (
            <span className="text-[11px] text-muted-foreground/80 truncate font-sans hidden sm:inline-block max-w-[220px]">
              "{summaryText}"
            </span>
          )}
        </div>

        {/* Right: Direct Action Button (e.g. Open in App) + Status Badge + Chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Direct Link Button on the trigger row for instant clickability */}
          {resultUrl && !isRunning && !isError && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenExternal(resultUrl);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-500 dark:text-emerald-400 text-[10.5px] font-medium border border-emerald-500/20 shadow-xs cursor-pointer transition-colors"
              title={connector.id === "canva_mcp" ? t("editInCanva") : t("openInApp", { app: connector.name })}
            >
              <span>{connector.id === "canva_mcp" ? t("editInCanva") : t("openInApp", { app: connector.name })}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          )}

          {/* Status Indicator */}
          {isRunning ? (
            <span className="flex items-center gap-1 text-amber-500 text-[11px] font-sans">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{t("working")}</span>
            </span>
          ) : isError ? (
            <span className="flex items-center gap-1 text-destructive text-[11px] font-sans">
              <AlertCircle className="w-3 h-3" />
              <span>{t("failed")}</span>
            </span>
          ) : isPartialSuccess ? (
            <span className="flex items-center gap-1 text-amber-400 text-[11px] font-sans">
              <AlertCircle className="w-3 h-3" />
              <span>{t("notConnected")}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-500 text-[11px] font-sans tabular-nums">
              <Check className="w-3 h-3" />
              <span>{tool.durationMs ? `${tool.durationMs}ms` : t("completed")}</span>
            </span>
          )}

          {hasContent && (
            <ChevronDown
              className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {/* Collapsible Content with Smooth Animation */}
      {hasContent && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2.5 rounded-xl bg-secondary/60 border border-border text-xs select-text shadow-xs w-full min-w-0 space-y-2.5">
            {/* Warning Banner: Account Not Connected */}
            {isPartialSuccess && (
              <div className="p-2.5 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="font-semibold text-xs">{t("connectionRequired")}</div>
                  <div className="text-[11.5px] leading-relaxed opacity-90 text-foreground/90">
                    {resultMessage || t("connectAccountNotice", { app: connector.name })}
                  </div>
                  {resultUrl && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenExternal(resultUrl)}
                        className="inline-flex items-center gap-1 text-[11px] text-amber-400 underline hover:text-amber-300 font-medium cursor-pointer"
                      >
                        <span>{t("openInApp", { app: connector.name })}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Banner: Execution Failed */}
            {isError && (
              <div className="p-2.5 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="font-semibold text-xs">{t("executionFailed")}</div>
                  <div className="text-[11.5px] leading-relaxed opacity-90 font-sans whitespace-pre-wrap break-all">
                    {resultMessage || (typeof tool.result === "string" ? tool.result : t("unknownError"))}
                  </div>
                </div>
              </div>
            )}

            {/* Success Result Message & Action Buttons */}
            {!isError && !isPartialSuccess && resultMessage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    {t("outputResult")}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {viewUrl && viewUrl !== resultUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenExternal(viewUrl)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground text-[10.5px] font-medium border border-border/70 shadow-xs cursor-pointer transition-colors"
                      >
                        <span>{t("viewPresentation")}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {resultUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenExternal(resultUrl)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-medium shadow-xs cursor-pointer transition-colors"
                      >
                        <span>{connector.id === "canva_mcp" ? t("editInCanva") : t("openInApp", { app: connector.name })}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-background/60 border border-border/40 text-[12px] text-foreground/90 leading-relaxed">
                  {resultMessage}
                </div>
              </div>
            )}

            {/* Slide Thumbnails Preview (Canva MCP) */}
            {thumbnails.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="text-[10.5px] text-muted-foreground font-medium">{t("slidePreview")}:</div>
                <ScrollArea orientation="horizontal" className="w-full pb-1 pt-0.5" scrollBarClassName="h-1.5">
                  <div className="flex items-center gap-2 pr-2">
                    {thumbnails.map((thumb, tIdx) => (
                      <div
                        key={tIdx}
                        className="relative shrink-0 rounded-md overflow-hidden border border-border/60 hover:border-primary transition-all shadow-xs group cursor-pointer"
                        onClick={() => resultUrl && handleOpenExternal(resultUrl)}
                        title={t("openSlideInCanva", { index: tIdx + 1 })}
                      >
                        <img
                          src={thumb.url}
                          alt={`Slide ${tIdx + 1}`}
                          className="h-16 w-auto object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded font-sans tabular-nums">
                          {tIdx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Input Parameters Preview */}
            {tool.args && (
              <div className="pt-1.5 border-t border-border/30">
                <div className="text-[10px] text-muted-foreground font-sans uppercase mb-1">
                  {t("inputParams")}
                </div>
                <ScrollArea className="max-h-48 w-full rounded-lg bg-black/20 dark:bg-black/40 border border-border/30">
                  <pre className="p-2.5 text-[11px] font-mono text-foreground/80 whitespace-pre-wrap select-text leading-relaxed">
                    {typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>
        </SmoothCollapse>
      )}
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
    <div className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none">
      <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="capitalize shrink-0">{tool.name}</span>
      {targetArg && (
        <span className="text-foreground truncate">
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
    <div className="w-full rounded-xl bg-card border border-border my-2 select-none font-sans overflow-hidden transition-all shadow-xs animate-in fade-in-0 duration-200">
      <div
        className={cn(
          "flex items-center justify-between px-3.5 py-2 transition-all",
          isOpen && "border-b border-border"
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 text-[13px] text-foreground hover:text-foreground/80 transition-colors cursor-pointer group/card"
        >
          <span className="font-normal text-foreground">
            {mutations.length === 1
              ? t("fileChangedSingle")
              : t("filesChanged", { count: mutations.length })}
          </span>
          <span className="font-sans tabular-nums text-xs text-emerald-500 font-medium">+{totalAdded}</span>
          <span className="font-sans tabular-nums text-xs text-destructive font-medium">-{totalRemoved}</span>
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 border border-border text-[11.5px] text-foreground hover:text-foreground transition-all cursor-pointer font-medium shadow-xs"
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
      className={`flex items-center justify-between group py-1.5 px-2 rounded-lg hover:bg-muted transition-colors ${
        onOpenFileDiff ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <FileIcon filename={fileName} />
        <span
          className={`text-[13px] truncate font-sans ${
            mut.rolledBack
              ? "line-through text-muted-foreground/60"
              : "text-foreground"
          }`}
        >
          {fileName}
        </span>
        {dirPath && (
          <span className="text-[11px] text-muted-foreground/60 font-sans truncate max-w-[240px]">
            /{dirPath}
          </span>
        )}
      </div>

      <div className="shrink-0 ml-2 flex items-center gap-2">
        <div className="flex items-center gap-1.5 font-sans tabular-nums text-xs">
          <span className="text-emerald-500">+{fileStats.added}</span>
          <span className="text-destructive">-{fileStats.removed}</span>
        </div>

        {onOpenFileDiff && !mut.rolledBack && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFileDiff(mut);
            }}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/80 border border-border text-[10.5px] text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs"
            title="Focus in Preview panel"
          >
            Focus ↗
          </button>
        )}

        {mut.rolledBack ? (
          <span className="text-[10.5px] text-emerald-500 font-medium flex items-center gap-0.5">
            <Check className="w-3 h-3 text-emerald-500" />
            <span>{t("undone")}</span>
          </span>
        ) : onRollback ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRollback(mut);
            }}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 border border-border text-[10.5px] text-foreground hover:text-foreground transition-all cursor-pointer shadow-xs"
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

function AddSourceCard({
  tool,
  onOpenBrowser,
  onOpenSourcePreview,
}: {
  tool: TraceStep | DisplayToolCall;
  onOpenBrowser?: (url: string) => void;
  onOpenSourcePreview?: (source: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isRunning = tool.status === "running" || (!tool.result && !tool.isError);
  const title = tool.args?.title || tool.args?.name || "Source";
  const type = String(tool.args?.type || "text").toLowerCase();
  const url = tool.args?.url;
  const content = tool.args?.content;

  return (
    <div className="w-full flex flex-col my-0.5 font-sans">
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground select-none cursor-pointer group"
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <Bookmark className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-foreground font-medium truncate text-xs">
            {title}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-medium shrink-0 uppercase">
            {type}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : tool.isError ? (
            <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <ChevronDown
            className={cn(
              "w-3 h-3 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </div>
      <SmoothCollapse isOpen={isOpen}>
        <div className="flex flex-col gap-2 p-2 mt-1 rounded-md bg-secondary/50 border border-border text-xs text-foreground">
          {url && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground text-[11px]">{url}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenBrowser ? onOpenBrowser(url) : window.open(url, "_blank");
                }}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[11px] hover:opacity-90 transition-opacity cursor-pointer"
              >
                <span>Buka URL</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
          {content && (
            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground bg-background/50 p-2 rounded border border-border/50">
              {content.slice(0, 800)}
              {content.length > 800 && "..."}
            </div>
          )}
          {onOpenSourcePreview && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSourcePreview({
                    id: "preview_source",
                    title,
                    type,
                    url,
                    content,
                  });
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 border border-border text-[11px] text-foreground transition-all cursor-pointer"
              >
                <span>Lihat Dokumen</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </SmoothCollapse>
    </div>
  );
}

function StudioArtifactCard({
  tool,
  onOpenStudioArtifact,
}: {
  tool: TraceStep | DisplayToolCall;
  onOpenStudioArtifact?: (artifact: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isRunning = tool.status === "running" || (!tool.result && !tool.isError);
  const title = tool.args?.title || "Studio Artifact";
  const artifactType = String(tool.args?.artifact_type || tool.args?.type || "artifact").toLowerCase();
  const data = tool.args?.data || {};

  const countLabel =
    artifactType === "flashcard"
      ? `${data?.cards?.length || 0} Cards`
      : artifactType === "quiz"
      ? `${data?.questions?.length || 0} Questions`
      : artifactType === "mind_map"
      ? `Mind Map`
      : artifactType === "cheatsheet"
      ? `${data?.cards?.length || 0} Sections`
      : artifactType;

  return (
    <div className="w-full flex flex-col my-0.5 font-sans">
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground select-none cursor-pointer group"
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-foreground font-medium truncate text-xs">
            {title}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium shrink-0 uppercase">
            {countLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : tool.isError ? (
            <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <ChevronDown
            className={cn(
              "w-3 h-3 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </div>
      <SmoothCollapse isOpen={isOpen}>
        <div className="flex flex-col gap-2 p-2.5 mt-1 rounded-md bg-secondary/50 border border-border text-xs text-foreground">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-xs text-foreground">
              {title}
            </span>
            {onOpenStudioArtifact && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStudioArtifact({
                    title,
                    type: artifactType,
                    data,
                    status: "completed",
                  });
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                <span>Buka di Studio</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            {artifactType === "flashcard" && Array.isArray(data?.cards) && (
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto mt-1">
                {data.cards.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="p-1.5 rounded bg-background/50 border border-border/40 text-[11px]">
                    <span className="font-semibold text-foreground">Q: </span>
                    {c.front}
                  </div>
                ))}
                {data.cards.length > 5 && (
                  <span className="text-[10px] text-muted-foreground">+{data.cards.length - 5} kartu lainnya...</span>
                )}
              </div>
            )}
            {artifactType === "quiz" && Array.isArray(data?.questions) && (
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto mt-1">
                {data.questions.slice(0, 3).map((q: any, i: number) => (
                  <div key={i} className="p-1.5 rounded bg-background/50 border border-border/40 text-[11px]">
                    <span className="font-semibold text-foreground">{i + 1}. </span>
                    {q.question}
                  </div>
                ))}
                {data.questions.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{data.questions.length - 3} soal lainnya...</span>
                )}
              </div>
            )}
            {artifactType === "mind_map" && data?.root && (
              <div className="p-1.5 rounded bg-background/50 border border-border/40 text-[11px]">
                <span className="font-semibold text-foreground">Topik Inti: </span>
                {data.root.label || title}
              </div>
            )}
          </div>
        </div>
      </SmoothCollapse>
    </div>
  );
}


