import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Loader2, Terminal, Check, AlertCircle } from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { MarkdownContent } from "./markdown-content";

export interface ToolCallTrace {
  id: string;
  name: string;
  args?: any;
  result?: any;
  isError?: boolean;
  durationMs?: number;
}

export interface ThinkingProcessProps {
  thinking?: string;
  isExecuting?: boolean;
  durationMs?: number;
  startTime?: number;
  toolCalls?: ToolCallTrace[];
}

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
 * ThinkingProcess / WorkingProcess (Mobile):
 * Clean minimalist accordion rendering reasoning traces and tool executions (Code Interpreter).
 */
export function ThinkingProcess({
  thinking = "",
  isExecuting = false,
  durationMs,
  startTime,
  toolCalls = [],
}: ThinkingProcessProps) {
  const hasTools = Boolean(toolCalls && toolCalls.length > 0);
  const hasThinking = Boolean(thinking && thinking.trim().length > 0);

  // Auto-open when working starts, auto-close when execution completes & final content streams
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

  // Live timer for active execution duration
  const [liveStepDuration, setLiveStepDuration] = useState<number>(0);

  useEffect(() => {
    if (!isExecuting) return;
    const effectiveStart = startTime || Date.now();
    const update = () => setLiveStepDuration(Math.max(0, Date.now() - effectiveStart));
    update();
    const interval = setInterval(update, 400);
    return () => clearInterval(interval);
  }, [isExecuting, startTime]);

  const thoughtLabel = () => {
    const isRunningTool = hasTools && toolCalls.some((tc) => !tc.result);

    if (isExecuting) {
      const liveSeconds = Math.round(liveStepDuration / 1000);
      if (isRunningTool) {
        return liveSeconds >= 1
          ? `Running Code Interpreter (${liveSeconds}s)...`
          : "Running Code Interpreter...";
      }
      if (liveSeconds >= 1) {
        return `Thinking (${liveSeconds}s)...`;
      }
      return "Thinking...";
    }

    const finalMs = durationMs ?? (liveStepDuration > 0 ? liveStepDuration : undefined);
    const s = finalMs !== undefined && finalMs > 0 ? Math.max(1, Math.round(finalMs / 1000)) : 0;

    if (hasTools) {
      return s > 0 ? `Thought & Ran Code (${s}s)` : "Thought & Ran Code";
    }

    if (s > 0) {
      return `Thought for ${s}s`;
    }
    return "Thought for a few seconds";
  };

  if (!hasThinking && !hasTools && !isExecuting) return null;

  return (
    <div className="flex flex-col w-full min-w-0 my-1 font-sans select-none">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        {hasTools && (
          <Terminal className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
        )}
        <span>{thoughtLabel()}</span>
        <ChevronDown
          className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out shrink-0"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="pt-1.5 pb-2 text-[12px] leading-relaxed text-muted-foreground select-text space-y-2.5">
          <ScrollArea className="w-full max-h-72 pr-2.5 [&>div>div[style]]:!block">
            {/* Tool Execution Cards */}
            {hasTools && (
              <div className="space-y-2 mb-2">
                {toolCalls.map((tc, idx) => {
                  const isRunning = isExecuting && !tc.result;
                  const isPython =
                    tc.name === "code_interpreter" ||
                    tc.name?.toLowerCase().includes("python") ||
                    tc.args?.code;

                  return (
                    <div
                      key={tc.id || idx}
                      className="p-2.5 rounded-xl bg-secondary/30 border border-border/70 space-y-2 select-text"
                    >
                      {/* Tool Header */}
                      <div className="flex items-center justify-between text-[11.5px]">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Terminal className="w-3.5 h-3.5 text-foreground shrink-0" />
                          <span>Code Interpreter</span>
                          {isPython && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border/50 font-mono">
                              python
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10.5px]">
                          {isRunning ? (
                            <span className="flex items-center gap-1 text-amber-500 font-mono">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Running in sandbox...
                            </span>
                          ) : tc.isError ? (
                            <span className="flex items-center gap-1 text-destructive font-mono">
                              <AlertCircle className="w-3 h-3" />
                              Error
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-500 font-mono">
                              <Check className="w-3 h-3" />
                              {tc.durationMs ? `${tc.durationMs}ms` : "Done"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Code Input */}
                      {tc.args?.code && (
                        <div className="p-2 rounded-lg bg-black/40 border border-border/40 text-[11px] font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto leading-tight">
                          <code>{tc.args.code}</code>
                        </div>
                      )}

                      {/* Tool Output Result */}
                      {tc.result && (
                        <div
                          className={cn(
                            "p-2 rounded-lg text-[11px] font-mono whitespace-pre-wrap break-all border leading-tight",
                            tc.isError
                              ? "bg-destructive/10 border-destructive/30 text-destructive"
                              : "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          <div className="text-[9.5px] font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Output
                          </div>
                          <div>{tc.result}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Thinking / Reasoning content */}
            {hasThinking ? (
              <div className="space-y-1">
                {hasTools && (
                  <div className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Reasoning
                  </div>
                )}
                <MarkdownContent
                  content={thinking}
                  className="text-[12px] leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_strong]:block [&_strong]:mb-0.5 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mb-1 [&_h2]:text-[12.5px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-1 [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mb-0.5 [&_p]:my-1"
                />
              </div>
            ) : isExecuting && !hasTools ? (
              <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                <span>Thinking...</span>
              </div>
            ) : null}
          </ScrollArea>
        </div>
      </SmoothCollapse>
    </div>
  );
}

// Alias for backward compatibility
export const WorkingProcess = ThinkingProcess;
