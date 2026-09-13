import React, { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Search,
  Cpu,
  Wrench,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { MarkdownContent } from "./markdown-content";

export interface ToolCallItem {
  id: string;
  name: string;
  args?: any;
  result?: any;
  isError?: boolean;
  status?: "running" | "completed" | "error";
}

export interface WorkingProcessProps {
  thinking?: string;
  toolCalls?: ToolCallItem[];
  isExecuting?: boolean;
  durationMs?: number;
}

/**
 * SmoothCollapse: Hardware-accelerated CSS grid accordion for smooth animations
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

export function WorkingProcess({
  thinking,
  toolCalls = [],
  isExecuting = false,
  durationMs,
}: WorkingProcessProps) {
  // Default: open while executing, auto-closes when execution finishes
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

  const hasContent = Boolean(
    (thinking && thinking.trim().length > 0) ||
      (toolCalls && toolCalls.length > 0) ||
      isExecuting
  );

  if (!hasContent) return null;

  // Format execution duration e.g. "Worked for 12s", "Working for 4s..."
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
      {/* Root Summary Header: e.g. "Worked for 12s >" */}
      <button
        type="button"
        onClick={() => setIsMainOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#969696] hover:text-[#e0e0e0] transition-colors cursor-pointer py-0.5 w-fit select-none group"
      >
        <span>{formatDuration()}</span>
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 text-[#777777] group-hover:text-[#a0a0a0] transition-transform duration-200 ease-out",
            isMainOpen && "rotate-90"
          )}
        />
      </button>

      {/* Trace Body with Smooth Collapse */}
      <SmoothCollapse isOpen={isMainOpen}>
        <div className="flex flex-col gap-2 pl-3 ml-1 border-l border-[#2e2e2e]/80 text-[13px] text-[#888888] pt-1 pb-1">
          {/* 1. Thinking Process */}
          {thinking && thinking.trim().length > 0 && (
            <ThoughtItem
              thinking={thinking}
              isExecuting={isExecuting}
              durationMs={durationMs}
            />
          )}

          {/* 2. Tool Calls (Search, MCP, etc.) */}
          {toolCalls && toolCalls.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {toolCalls.map((tc, idx) => (
                <ToolCallCard key={tc.id || `tc_${idx}`} tool={tc} />
              ))}
            </div>
          )}

          {/* 3. Active execution spinner */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-xs text-[#777777] py-0.5">
              <Loader2 className="w-3 h-3 animate-spin text-[#e79737]" />
              <span>Working...</span>
            </div>
          )}
        </div>
      </SmoothCollapse>
    </div>
  );
}

/**
 * ThoughtItem: Minimalist thinking accordion matching harness desktop
 * Header: "Thought for Xs ⌄"
 * Body: Muted markdown content bounded in Radix ScrollArea
 */
function ThoughtItem({
  thinking,
  isExecuting,
  durationMs,
}: {
  thinking: string;
  isExecuting?: boolean;
  durationMs?: number;
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

  const thoughtLabel = () => {
    if (isExecuting) {
      if (durationMs && durationMs >= 1000) {
        return `Thinking (${Math.round(durationMs / 1000)}s)...`;
      }
      return "Thinking...";
    }
    if (durationMs && durationMs > 0) {
      const s = Math.max(1, Math.round(durationMs / 1000));
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
        className="inline-flex items-center gap-1.5 text-[12.5px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        <span>{thoughtLabel()}</span>
        <ChevronDown
          className="w-3 h-3 text-[#777777] transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="pt-1.5 pb-2 text-[12px] leading-relaxed text-[#888888] select-text">
          <ScrollArea className="w-full max-h-52 pr-2.5 [&>div>div[style]]:!block">
            <MarkdownContent
              content={thinking}
              className="text-[12px] leading-relaxed text-[#888888] [&_strong]:font-semibold [&_strong]:text-[#d4d4d4] [&_strong]:block [&_strong]:mb-0.5 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:text-[#d4d4d4] [&_h1]:mb-1 [&_h2]:text-[12.5px] [&_h2]:font-semibold [&_h2]:text-[#d4d4d4] [&_h2]:mb-1 [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:text-[#d4d4d4] [&_h3]:mb-0.5 [&_p]:my-1"
            />
          </ScrollArea>
        </div>
      </SmoothCollapse>
    </div>
  );
}

/**
 * ToolCallCard: Visual representation for future Search or MCP tool calls
 */
function ToolCallCard({ tool }: { tool: ToolCallItem }) {
  const [isOpen, setIsOpen] = useState(false);
  const norm = (tool.name || "").toLowerCase();
  const isSearch = norm.includes("search") || norm.includes("find") || norm.includes("query");
  const isMcp = norm.startsWith("mcp_") || norm.includes("tool");

  let queryText = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      try {
        const parsed = JSON.parse(tool.args);
        queryText = parsed.query || parsed.q || parsed.searchTerm || tool.args;
      } catch {
        queryText = tool.args;
      }
    } else if (typeof tool.args === "object") {
      queryText = tool.args.query || tool.args.q || tool.args.searchTerm || JSON.stringify(tool.args);
    }
  }

  const title = isSearch
    ? `Searched for "${queryText || "sources"}"`
    : isMcp
    ? `MCP: ${tool.name.replace(/^mcp_/, "")}`
    : tool.name || "Tool Call";

  const Icon = isSearch ? Search : isMcp ? Cpu : Wrench;

  return (
    <div className="flex flex-col w-full min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 text-[12.5px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5 select-none"
      >
        <Icon className="w-3.5 h-3.5 text-[#0066ff] shrink-0" />
        <span className="truncate max-w-[260px]">{title}</span>
        {tool.status === "completed" ? (
          <CheckCircle2 className="w-3 h-3 text-[#34d399] shrink-0" />
        ) : tool.status === "error" || tool.isError ? (
          <AlertCircle className="w-3 h-3 text-[#f87171] shrink-0" />
        ) : null}
        <ChevronDown
          className="w-3 h-3 text-[#777777] transition-transform duration-200 ease-out"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {(tool.args || tool.result) && (
        <SmoothCollapse isOpen={isOpen}>
          <div className="pt-1 pb-1.5 pl-5 text-[11px] text-[#777777] font-mono">
            {tool.args && (
              <div className="mb-1">
                <span className="text-[#969696] font-medium">Input: </span>
                <span className="break-all">
                  {typeof tool.args === "object" ? JSON.stringify(tool.args) : String(tool.args)}
                </span>
              </div>
            )}
            {tool.result && (
              <ScrollArea className="max-h-36 w-full rounded bg-[#1b1b1b] p-2 border border-[#2e2e2e]">
                <pre className="text-[10.5px] text-[#969696] whitespace-pre-wrap break-all">
                  {typeof tool.result === "object" ? JSON.stringify(tool.result, null, 2) : String(tool.result)}
                </pre>
              </ScrollArea>
            )}
          </div>
        </SmoothCollapse>
      )}
    </div>
  );
}
