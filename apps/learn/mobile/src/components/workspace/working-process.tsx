import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Loader2, Terminal, Check, AlertCircle, ExternalLink } from "lucide-react";
import { ScrollArea, cn, BrandLogo, getConnectorForTool } from "@const/ui";
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
 * Clean minimalist accordion rendering reasoning traces and tool executions (Composio & Cloud Sandbox).
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
        const runningTool = toolCalls.find((tc) => !tc.result);
        const runningConnector = runningTool ? getConnectorForTool(runningTool.name || "") : null;
        const toolTitle = runningConnector
          ? runningConnector.name
          : runningTool?.name === "code_interpreter"
          ? "Cloud Sandbox"
          : "Tool";
        return liveSeconds >= 1
          ? `Running ${toolTitle} (${liveSeconds}s)...`
          : `Running ${toolTitle}...`;
      }
      if (liveSeconds >= 1) {
        return `Thinking (${liveSeconds}s)...`;
      }
      return "Thinking...";
    }

    const finalMs = durationMs ?? (liveStepDuration > 0 ? liveStepDuration : undefined);
    const s = finalMs !== undefined && finalMs > 0 ? Math.max(1, Math.round(finalMs / 1000)) : 0;

    if (hasTools) {
      const firstConnector = getConnectorForTool(toolCalls[0]?.name || "");
      const toolTitle = firstConnector
        ? firstConnector.name
        : toolCalls[0]?.name === "code_interpreter"
        ? "Cloud Sandbox"
        : "Tool";
      return s > 0
        ? `Thought & Ran ${toolCalls.length > 1 ? "Tools" : toolTitle} (${s}s)`
        : `Thought & Ran ${toolCalls.length > 1 ? "Tools" : toolTitle}`;
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
                  const connector = getConnectorForTool(tc.name || "");
                  const isPython =
                    tc.name === "code_interpreter" ||
                    tc.name?.toLowerCase().includes("python") ||
                    tc.args?.code;

                  const tag =
                    tc.args?.action ||
                    tc.args?.designType ||
                    tc.args?.fileType ||
                    (isPython ? "python" : null);

                  // Parse result if JSON
                  let parsedResult: any = null;
                  if (tc.result) {
                    if (typeof tc.result === "object") {
                      parsedResult = tc.result;
                    } else if (typeof tc.result === "string") {
                      try {
                        parsedResult = JSON.parse(tc.result);
                      } catch {
                        parsedResult = null;
                      }
                    }
                  }

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
                  const pageCount = parsedResult?.page_count || parsedResult?.slideCount;

                  const resultMessage =
                    parsedResult?.message || (typeof tc.result === "string" ? tc.result : null);

                  const displayName = connector
                    ? connector.name
                    : tc.name === "code_interpreter"
                    ? "Cloud Sandbox"
                    : tc.name || "Tool Call";

                  return (
                    <div
                      key={tc.id || idx}
                      className="p-2.5 rounded-xl bg-secondary/30 border border-border/70 space-y-2 select-text"
                    >
                      {/* Tool Header */}
                      <div className="flex items-center justify-between text-[11.5px]">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          {connector ? (
                            <BrandLogo id={connector.id} size="xs" />
                          ) : (
                            <Terminal className="w-3.5 h-3.5 text-foreground shrink-0" />
                          )}
                          <span>{displayName}</span>
                          {pageCount && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                              {pageCount} Slide
                            </span>
                          )}
                          {tag && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border/50 font-mono">
                              {tag}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10.5px]">
                          {isRunning ? (
                            <span className="flex items-center gap-1 text-amber-500 font-mono">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Running...
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

                      {/* Code or Arguments Input */}
                      {tc.args && (
                        <div className="p-2 rounded-lg bg-black/40 border border-border/40 text-[11px] font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto leading-tight">
                          {tc.args.code ? (
                            <code>{tc.args.code}</code>
                          ) : tc.args.prompt ? (
                            <div>
                              <span className="text-muted-foreground">prompt: </span>
                              <span>"{tc.args.prompt}"</span>
                            </div>
                          ) : tc.args.title ? (
                            <div>
                              <span className="text-muted-foreground">{tc.args.action || "title"}: </span>
                              <span>"{tc.args.title}"</span>
                            </div>
                          ) : tc.args.query ? (
                            <div>
                              <span className="text-muted-foreground">query: </span>
                              <span>"{tc.args.query}"</span>
                            </div>
                          ) : tc.args.topic ? (
                            <div>
                              <span className="text-muted-foreground">topic: </span>
                              <span>"{tc.args.topic}"</span>
                            </div>
                          ) : (
                            <code>{JSON.stringify(tc.args)}</code>
                          )}
                        </div>
                      )}

                      {/* Tool Output Result */}
                      {tc.result && (
                        <div
                          className={cn(
                            "p-2 rounded-lg text-[11px] leading-tight border space-y-1.5",
                            tc.isError
                              ? "bg-destructive/10 border-destructive/30 text-destructive font-mono"
                              : "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-1.5">
                            <div className="text-[9.5px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                              Output
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {viewUrl && viewUrl !== resultUrl && (
                                <a
                                  href={viewUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border/60 text-[9.5px] font-medium shadow-xs"
                                >
                                  <span>Lihat Slide</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                              {resultUrl && (
                                <a
                                  href={resultUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[9.5px] font-medium shadow-xs"
                                >
                                  <span>{connector?.id === "canva_mcp" ? "Edit di Canva" : "Buka Link"}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Slide Thumbnails Preview if returned by Canva MCP */}
                          {thumbnails.length > 0 && (
                            <div className="space-y-1 pt-0.5">
                              <div className="text-[9.5px] text-muted-foreground font-medium">Pratinjau Slide:</div>
                              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
                                {thumbnails.map((t, tIdx) => (
                                  <a
                                    key={tIdx}
                                    href={resultUrl || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="relative shrink-0 rounded overflow-hidden border border-border/60 shadow-xs"
                                  >
                                    <img
                                      src={t.url}
                                      alt={`Slide ${tIdx + 1}`}
                                      className="h-12 w-auto object-cover"
                                      loading="lazy"
                                    />
                                    <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[8px] px-1 rounded font-mono">
                                      {tIdx + 1}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {resultMessage ? (
                            <div className="font-sans text-[11px] whitespace-pre-wrap">{resultMessage}</div>
                          ) : (
                            <div className="font-mono whitespace-pre-wrap break-all">{tc.result}</div>
                          )}
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
