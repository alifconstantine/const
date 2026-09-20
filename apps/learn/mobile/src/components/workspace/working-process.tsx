import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Terminal as TerminalIcon,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  ExternalLink,
  Check,
  ListTodo,
} from "lucide-react";
import { ScrollArea, cn, BrandLogo, getConnectorForTool, type ConnectorMetadata } from "@const/ui";
import { FileIcon } from "./file-icon";
import { MarkdownContent } from "./markdown-content";
import { useI18n } from "../../lib/i18n";

export interface TraceStep {
  id?: string;
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
}

export interface ToolCallTrace {
  id: string;
  name: string;
  args?: any;
  result?: any;
  isError?: boolean;
  status?: "running" | "completed" | "error";
  durationMs?: number;
}

export interface WorkingProcessProps {
  thinking?: string;
  isExecuting?: boolean;
  durationMs?: number;
  startTime?: number;
  toolCalls?: ToolCallTrace[];
  traceSteps?: TraceStep[];
  onOpenBrowser?: (url: string) => void;
  onOpenFileDiff?: (record: any) => void;
}

export type ThinkingProcessProps = WorkingProcessProps;
export type ExecutionTraceProps = WorkingProcessProps;

/**
 * SmoothCollapse: Hardware-accelerated CSS grid accordion for smooth mobile animations
 */
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

/**
 * WorkingProcess (Mobile):
 * Sleek, tree-structured execution trace matching Desktop UI (Image 2):
 * - Root toggle: "Worked for a few seconds ⌄"
 * - Left border tree indentation
 * - Sub-collapsible reasoning: "Thought for a few seconds ⌄"
 * - Unified chronological tool rows (Google Slides, Canva, Roadmap, Terminal, Files, etc.)
 */
export function WorkingProcess({
  thinking = "",
  isExecuting = false,
  durationMs,
  startTime,
  toolCalls = [],
  traceSteps = [],
  onOpenBrowser,
  onOpenFileDiff,
}: WorkingProcessProps) {
  const { t, language } = useI18n();

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

  // Live timer for active execution duration
  const [liveDuration, setLiveDuration] = useState<number>(0);

  useEffect(() => {
    if (!isExecuting) return;
    const effectiveStart = startTime || Date.now();
    const update = () => setLiveDuration(Math.max(0, Date.now() - effectiveStart));
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [isExecuting, startTime]);

  // Normalize chronological steps (supports live traceSteps or fallback thinking + toolCalls)
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

    // Fallback: Thought first, followed by toolCalls in order
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
        durationMs: tc.durationMs,
      });
    }
    return result;
  }, [traceSteps, thinking, toolCalls, durationMs]);

  const hasContent = steps.length > 0 || isExecuting;
  if (!hasContent) return null;

  // Format execution duration matching Image 2 e.g. "Worked for a few seconds", "Working (12s)..."
  const formatDuration = () => {
    const effectiveMs = durationMs ?? (liveDuration > 0 ? liveDuration : undefined);

    if (isExecuting) {
      if (!effectiveMs || effectiveMs < 1000) {
        return language === "id" ? "Bekerja..." : "Working...";
      }
      const s = Math.round(effectiveMs / 1000);
      if (s < 60) {
        return language === "id" ? `Bekerja (${s}s)...` : `Working (${s}s)...`;
      }
      const m = Math.floor(s / 60);
      const remS = s % 60;
      return language === "id"
        ? `Bekerja (${m}m ${remS}s)...`
        : `Working (${m}m ${remS}s)...`;
    }

    if (!effectiveMs || effectiveMs < 1000) {
      return language === "id" ? "Bekerja beberapa detik" : "Worked for a few seconds";
    }
    const s = Math.round(effectiveMs / 1000);
    if (s < 60) {
      return language === "id" ? `Bekerja selama ${s}s` : `Worked for ${s}s`;
    }
    const m = Math.floor(s / 60);
    const remS = s % 60;
    if (remS === 0) {
      return language === "id" ? `Bekerja selama ${m}m` : `Worked for ${m}m`;
    }
    return language === "id"
      ? `Bekerja selama ${m}m ${remS}s`
      : `Worked for ${m}m ${remS}s`;
  };

  return (
    <div className="w-full flex flex-col gap-1.5 select-none my-1 font-sans">
      {/* Root Summary Header: e.g. "Worked for a few seconds ⌄" matching Image 2 */}
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

      {/* Indented Tree Structure matching Image 2 with smooth collapse */}
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

              // 0. Composio App Connectors (Canva MCP, Google Suite, YouTube, etc.)
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

              // 1. Todo Write / Roadmap
              if (norm === "todowrite" || norm === "todo") {
                return (
                  <TodoWriteTraceItem
                    key={step.id || `todo_${idx}`}
                    tool={step}
                  />
                );
              }

              // 2. Python Runner (run_python, code_interpreter)
              if (norm === "runpython" || norm === "python" || norm === "codeinterpreter") {
                return (
                  <PythonRunnerTraceItem
                    key={step.id || `py_${idx}`}
                    tool={step}
                  />
                );
              }

              // 3. Terminal / Shell command
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

              // 4. File Mutation Card
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
                    onOpenFileDiff={onOpenFileDiff}
                  />
                );
              }

              // 5. Exploration & Search (grep, search, find)
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

              // 6. File Reads
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

              // 7. Generic Tool Item Fallback
              return <GenericToolItem key={step.id || `other_${idx}`} tool={step} />;
            }

            return null;
          })}

          {/* Active executing spinner */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span>{language === "id" ? "Bekerja..." : "Working..."}</span>
            </div>
          )}
        </div>
      </SmoothCollapse>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Thought Item: Minimalist thinking accordion matching Image 2
// Header: "Thought for a few seconds ⌄"
// Body: Muted markdown text without heavy boxes or "REASONING" uppercase header
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
  const { language } = useI18n();
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
        const s = Math.round(liveStepDuration / 1000);
        return language === "id" ? `Sedang berpikir (${s}s)...` : `Thinking (${s}s)...`;
      }
      return language === "id" ? "Sedang berpikir..." : "Thinking...";
    }
    const finalMs = durationMs ?? (liveStepDuration > 0 ? liveStepDuration : undefined);
    if (finalMs !== undefined && finalMs > 0) {
      const s = Math.max(1, Math.round(finalMs / 1000));
      return language === "id" ? `Berpikir selama ${s}s` : `Thought for ${s}s`;
    }
    return language === "id" ? "Berpikir beberapa detik" : "Thought for a few seconds";
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
        <div className="pt-1 pb-2 pl-0.5 text-[12.5px] leading-relaxed text-muted-foreground select-text">
          <ScrollArea className="w-full max-h-60 pr-2 [&>div>div[style]]:!block">
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
// 2. Connector Tool Trace Item (Google Slides, Canva MCP, YouTube, etc.)
// Sleek interactive row matching Image 2:
// [Icon] Google Slides  [9 Slides]  "Dario Amodei - We Must Pace the Fr..."  [Open in Google Slides ↗]  ✓ Completed >
// ---------------------------------------------------------------------------
function ConnectorToolTraceItem({
  tool,
  connector,
  onOpenBrowser,
}: {
  tool: TraceStep;
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

  // Summary title / topic / query
  const summaryText =
    tool.args?.title ||
    tool.args?.prompt ||
    tool.args?.query ||
    tool.args?.topic ||
    (tool.args?.code ? "code_execution" : "");

  // Page / Slide count
  const pageCount = parsedResult?.page_count || parsedResult?.slideCount;

  // Action tag
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

  const handleOpenLink = (url: string) => {
    if (onOpenBrowser) {
      onOpenBrowser(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const hasContent = Boolean(tool.args || tool.result);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5 font-sans">
      {/* Sleek Trigger Row matching Image 2 */}
      <div
        onClick={() => hasContent && setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none",
          hasContent && "cursor-pointer group"
        )}
      >
        {/* Left: Brand Logo + Name + Tag/Slide Count + Brief Summary in Quotes */}
        <div className="flex items-center gap-1.5 xs:gap-2 min-w-0 pr-1.5">
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
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border/50 font-mono shrink-0">
              {tag}
            </span>
          )}
          {summaryText && (
            <span className="text-[11px] text-muted-foreground/80 truncate font-mono hidden xs:inline-block max-w-[110px] sm:max-w-[200px]">
              "{summaryText}"
            </span>
          )}
        </div>

        {/* Right: Quick Action Button (Open in App) + Status Badge + Chevron */}
        <div className="flex items-center gap-1.5 xs:gap-2 shrink-0">
          {resultUrl && !isRunning && !isError && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenLink(resultUrl);
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
            <span className="flex items-center gap-1 text-amber-500 text-[11px] font-mono">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{t("working")}</span>
            </span>
          ) : isError ? (
            <span className="flex items-center gap-1 text-destructive text-[11px] font-mono">
              <AlertCircle className="w-3 h-3" />
              <span>{t("failed")}</span>
            </span>
          ) : isPartialSuccess ? (
            <span className="flex items-center gap-1 text-amber-400 text-[11px] font-mono">
              <AlertCircle className="w-3 h-3" />
              <span>{t("notConnected")}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-500 text-[11px] font-mono">
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

      {/* Collapsible Content */}
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
                        onClick={() => handleOpenLink(resultUrl)}
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
                  <div className="text-[11.5px] leading-relaxed opacity-90 font-mono whitespace-pre-wrap break-all">
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
                        onClick={() => handleOpenLink(viewUrl)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground text-[10.5px] font-medium border border-border/70 shadow-xs cursor-pointer transition-colors"
                      >
                        <span>{t("viewPresentation")}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {resultUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenLink(resultUrl)}
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

            {/* Slide Thumbnails Preview (Canva MCP / Slides) */}
            {thumbnails.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="text-[10.5px] text-muted-foreground font-medium">{t("slidePreview")}:</div>
                <ScrollArea orientation="horizontal" className="w-full pb-1 pt-0.5" scrollBarClassName="h-1.5">
                  <div className="flex items-center gap-2 pr-2">
                    {thumbnails.map((thumb, tIdx) => (
                      <div
                        key={tIdx}
                        className="relative shrink-0 rounded-md overflow-hidden border border-border/60 hover:border-primary transition-all shadow-xs group cursor-pointer"
                        onClick={() => resultUrl && handleOpenLink(resultUrl)}
                        title={t("openSlideInCanva", { index: tIdx + 1 })}
                      >
                        <img
                          src={thumb.url}
                          alt={`Slide ${tIdx + 1}`}
                          className="h-16 w-auto object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded font-mono">
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
                <div className="text-[10px] text-muted-foreground font-mono uppercase mb-1">
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
// 3. Todo Write Item / Roadmap (Image 2: [Icon] Roadmap (1/3) >)
// ---------------------------------------------------------------------------
function TodoWriteTraceItem({ tool }: { tool: TraceStep }) {
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
// 4. Terminal Card
// ---------------------------------------------------------------------------
function TerminalCard({
  tool,
  isDefaultOpen = false,
}: {
  tool: TraceStep;
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

  const isFailed = Boolean(tool.isError || tool.status === "error");

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

  const cleanResult = rawResult
    .replace(/^Exit code:?\s*\d+\s*/i, "")
    .replace(/\[Command (?:failed with exit code|exited with code) \d+\]\s*/gi, "")
    .trim();

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
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
        ) : tool.result !== undefined || tool.status === "completed" ? (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Success" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" title="Running command..." />
        )}
        <ChevronDown
          className="w-3 h-3 text-muted-foreground shrink-0 ml-1 transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="mt-1 p-2.5 rounded-xl bg-secondary/80 border border-border font-mono text-[12px] leading-relaxed select-text shadow-xs w-full min-w-0">
          <div className="text-foreground flex items-start gap-1.5 pb-1.5 mb-1.5 border-b border-border min-w-0">
            <span className="text-amber-500 font-bold shrink-0">$</span>
            <span className="font-mono text-xs text-foreground break-all leading-snug">
              {cmd}
            </span>
          </div>

          {exitCodeDisplay && (
            <div className="text-xs text-destructive font-mono font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              <span>{exitCodeDisplay}</span>
            </div>
          )}

          <ScrollArea className="max-h-60 w-full">
            {tool.result === undefined && tool.status === "running" ? (
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
// 5. Grep Search Card
// ---------------------------------------------------------------------------
function GrepSearchCard({ tool }: { tool: TraceStep }) {
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
        className={cn(
          "flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none",
          hasResult && "cursor-pointer"
        )}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="shrink-0">Searched</span>
        <span className="text-foreground font-medium truncate">
          *{query}*
        </span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {resultCount && (
            <span className="text-muted-foreground text-xs font-mono">{resultCount}</span>
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
// 6. File Read Card
// ---------------------------------------------------------------------------
function FileReadCard({ tool }: { tool: TraceStep }) {
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
        className={cn(
          "flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none",
          hasResult && "cursor-pointer group"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-foreground group-hover:text-foreground truncate font-sans">
            {fileName}
          </span>
          {lineRange && (
            <span className="text-xs text-muted-foreground shrink-0 font-mono">{lineRange}</span>
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
// 7. File Mutation Card
// ---------------------------------------------------------------------------
function FileMutationCard({
  tool,
  onOpenFileDiff,
}: {
  tool: TraceStep;
  onOpenFileDiff?: (record: any) => void;
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

  const hasSnippet = Boolean(tool.args?.CodeContent || tool.args?.ReplacementContent || tool.args?.content);

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => hasSnippet && setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] min-w-0 select-none",
          hasSnippet && "cursor-pointer group"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <FileIcon filename={fileName} />
          <span className="text-foreground group-hover:text-foreground truncate font-sans">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
                {tool.args?.CodeContent || tool.args?.ReplacementContent || tool.args?.content}
              </pre>
            </ScrollArea>
          </div>
        </SmoothCollapse>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Python Runner Item
// ---------------------------------------------------------------------------
function PythonRunnerTraceItem({ tool }: { tool: TraceStep }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  let code = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      code = tool.args;
    } else {
      code = tool.args.code || tool.args.script || "";
    }
  }

  const rawResult =
    typeof tool.result === "string"
      ? tool.result
      : tool.result
      ? JSON.stringify(tool.result, null, 2)
      : "";

  const isFailed = Boolean(tool.isError || tool.status === "error");

  return (
    <div className="w-full min-w-0 flex flex-col my-0.5">
      <div
        onClick={() => (code || rawResult) && setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted text-[13px] text-muted-foreground min-w-0 select-none",
          (code || rawResult) && "cursor-pointer group"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-sans text-foreground font-medium text-xs">
            Python Execution
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isFailed ? (
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          ) : rawResult ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          )}
          {(code || rawResult) && (
            <ChevronDown
              className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          )}
        </div>
      </div>

      {(code || rawResult) && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="mt-1 p-2 rounded-xl bg-secondary/80 border border-border text-xs font-mono select-text space-y-1.5">
            {code && (
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Script:</div>
                <ScrollArea className="max-h-36 w-full rounded-md bg-card border border-border p-2 text-amber-500 text-[11px]">
                  <pre className="whitespace-pre">{code}</pre>
                </ScrollArea>
              </div>
            )}
            {rawResult && (
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Output:</div>
                <ScrollArea className="max-h-36 w-full rounded-md bg-card border border-border p-2 text-emerald-500 text-[11px]">
                  <pre className="whitespace-pre-wrap">{rawResult}</pre>
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
function GenericToolItem({ tool }: { tool: TraceStep }) {
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
        <span className="text-foreground truncate font-mono text-xs">
          {typeof targetArg === "string" ? targetArg : JSON.stringify(targetArg)}
        </span>
      )}
    </div>
  );
}

// Backward-compatible aliases
export const ThinkingProcess = WorkingProcess;
export const ExecutionTrace = WorkingProcess;
