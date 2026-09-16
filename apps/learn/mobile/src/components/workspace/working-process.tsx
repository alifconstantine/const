import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { MarkdownContent } from "./markdown-content";

export interface ThinkingProcessProps {
  thinking?: string;
  isExecuting?: boolean;
  durationMs?: number;
  startTime?: number;
  toolCalls?: any[]; // Kept for backward-compatibility if passed
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
 * ThinkingProcess (Mobile):
 * Clean minimalist thinking accordion matching apps/harness/desktop:
 * - Header: "Thinking (Xs)... ⌄" while reasoning, "Thought for Xs ⌄" when done
 * - Auto-opens when thinking starts, auto-collapses when thinking completes & answer streams
 * - Tappable anytime to inspect or collapse thinking trace
 * - Pure typography without bulky card containers
 */
export function ThinkingProcess({
  thinking = "",
  isExecuting = false,
  durationMs,
  startTime,
}: ThinkingProcessProps) {
  // Auto-open when thinking starts, auto-close when thinking finishes
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

  // Live timer for active thinking duration
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
    if (isExecuting) {
      const liveSeconds = Math.round(liveStepDuration / 1000);
      if (liveSeconds >= 1) {
        return `Thinking (${liveSeconds}s)...`;
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

  const hasThinking = Boolean(thinking && thinking.trim().length > 0);
  if (!hasThinking && !isExecuting) return null;

  return (
    <div className="flex flex-col w-full min-w-0 my-1 font-sans select-none">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        <span>{thoughtLabel()}</span>
        <ChevronDown
          className="w-3 h-3 text-muted-foreground transition-transform duration-200 ease-out shrink-0"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="pt-1.5 pb-2 text-[12px] leading-relaxed text-muted-foreground select-text">
          <ScrollArea className="w-full max-h-56 pr-2.5 [&>div>div[style]]:!block">
            {hasThinking ? (
              <MarkdownContent
                content={thinking}
                className="text-[12px] leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_strong]:block [&_strong]:mb-0.5 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mb-1 [&_h2]:text-[12.5px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-1 [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mb-0.5 [&_p]:my-1"
              />
            ) : (
              <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                <span>Thinking...</span>
              </div>
            )}
          </ScrollArea>
        </div>
      </SmoothCollapse>
    </div>
  );
}

// Alias for backward compatibility
export const WorkingProcess = ThinkingProcess;
