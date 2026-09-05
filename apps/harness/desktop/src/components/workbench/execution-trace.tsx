import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Check,
  Terminal as TerminalIcon,
  Loader2,
  Brain,
  Layers,
  Search,
} from "lucide-react";
import type { FileMutationRecord } from "../../vite-env";

export interface TraceToolCall {
  id: string;
  name: string;
  args?: any;
  result?: any;
  isError?: boolean;
}

interface ExecutionTraceProps {
  thinking?: string;
  toolCalls?: TraceToolCall[];
  mutations?: FileMutationRecord[];
  isExecuting?: boolean;
  durationMs?: number;
  onRollback?: (record: FileMutationRecord) => void;
}

export function ExecutionTrace({
  thinking,
  toolCalls = [],
  mutations = [],
  isExecuting = false,
  durationMs,
  onRollback,
}: ExecutionTraceProps) {
  const [isMainOpen, setIsMainOpen] = useState(true);

  // If there's nothing to trace and not executing, render nothing
  const hasContent =
    Boolean(thinking) ||
    toolCalls.length > 0 ||
    mutations.length > 0 ||
    isExecuting;

  if (!hasContent) return null;

  // Format execution duration e.g. "Worked for 22s" or "Working for 12s..."
  const formatDuration = () => {
    if (isExecuting) {
      if (!durationMs) return "Working...";
      const s = Math.round(durationMs / 1000);
      return `Working for ${s}s...`;
    }
    if (!durationMs) return "Worked for a few seconds";
    const s = Math.round(durationMs / 1000);
    if (s < 60) return `Worked for ${s}s`;
    const m = Math.floor(s / 60);
    return `Worked for ${m}m`;
  };

  return (
    <div className="w-full flex flex-col gap-1.5 select-none my-1 font-sans">
      {/* Root Summary Header: e.g. Worked for 13m ⌵ */}
      <button
        type="button"
        onClick={() => setIsMainOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#969696] hover:text-[#d4d4d4] transition-colors cursor-pointer py-0.5 w-fit"
      >
        <span>{formatDuration()}</span>
        {isMainOpen ? (
          <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        )}
      </button>

      {/* Trace Body when expanded */}
      {isMainOpen && (
        <div className="flex flex-col gap-2 pl-3 ml-1 border-l border-[#2e2e2e]/70 text-[13px] text-[#888888]">
          {/* 1. Thought Process (Image 1 & 3) */}
          {thinking && <ThoughtItem thinking={thinking} isExecuting={isExecuting} />}

          {/* 2. Tool Calls & Explorations (Image 1, 2, 3) */}
          {toolCalls.map((tc) => (
            <ToolTraceItem key={tc.id} tool={tc} />
          ))}

          {/* 3. Edited / Created Files with diff stats (+X -Y) (Image 1) */}
          {mutations.map((mut) => (
            <MutationTraceItem key={mut.id} record={mut} onRollback={onRollback} />
          ))}

          {/* Active executing spinner */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-xs text-[#777777] py-1">
              <Loader2 className="w-3 h-3 animate-spin text-[#ff7a00]" />
              <span>Analyzing workspace and tools...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thought Item: e.g. "Thought for 6s >" or "Thought a few seconds ⌵"
// ---------------------------------------------------------------------------
function ThoughtItem({
  thinking,
  isExecuting,
}: {
  thinking: string;
  isExecuting?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5"
      >
        <Brain className="w-3 h-3 text-[#ff7a00]/80" />
        <span>{isExecuting ? "Thinking..." : "Thought for a few seconds"}</span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-[#666666]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#666666]" />
        )}
      </button>

      {isOpen && (
        <div className="my-1.5 p-3 rounded-xl bg-[#181818] border border-[#2e2e2e] text-[12px] font-mono leading-relaxed text-[#888888] whitespace-pre-wrap select-text max-h-60 overflow-y-auto">
          {thinking}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Language Badge (TS, JS, PY, JSON, etc.)
// ---------------------------------------------------------------------------
function FileBadge({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  let badgeText = ext.toUpperCase();
  let badgeStyle = "text-[#888888] bg-white/5 border-[#383838]";

  if (ext === "ts" || ext === "tsx") {
    badgeText = "TS";
    badgeStyle = "text-[#3b82f6] bg-[#1d4ed8]/15 border-[#1e40af]/30";
  } else if (ext === "js" || ext === "jsx") {
    badgeText = "JS";
    badgeStyle = "text-[#eab308] bg-[#854d0e]/15 border-[#713f12]/30";
  } else if (ext === "py") {
    badgeText = "PY";
    badgeStyle = "text-[#22c55e] bg-[#15803d]/15 border-[#166534]/30";
  } else if (ext === "json") {
    badgeText = "JSON";
    badgeStyle = "text-[#14b8a6] bg-[#0f766e]/15 border-[#115e59]/30";
  } else if (ext === "css" || ext === "scss") {
    badgeText = "CSS";
    badgeStyle = "text-[#38bdf8] bg-[#0369a1]/15 border-[#075985]/30";
  } else if (ext === "html") {
    badgeText = "HTML";
    badgeStyle = "text-[#f97316] bg-[#c2410c]/15 border-[#9a3412]/30";
  } else if (ext === "md") {
    badgeText = "MD";
    badgeStyle = "text-[#c084fc] bg-[#7e22ce]/15 border-[#6b21a8]/30";
  }

  return (
    <span
      className={`inline-block text-[10px] font-mono font-semibold px-1 py-0.2 rounded border ${badgeStyle}`}
    >
      {badgeText}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mutation Trace Item: e.g. "Edited TS mutation-ledger.ts +77 -0" (Image 1)
// ---------------------------------------------------------------------------
function MutationTraceItem({
  record,
  onRollback,
}: {
  record: FileMutationRecord;
  onRollback?: (record: FileMutationRecord) => void;
}) {
  const isRolledBack = record.rolledBack;
  const fileName =
    record.targetFile.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
    record.targetFile;

  // Approximate diff calculation
  let added = 1;
  let removed = 0;
  if (record.operation === "create") {
    added = record.newContent ? record.newContent.split("\n").length : 1;
    removed = 0;
  } else if (record.operation === "modify") {
    const prevLines = record.previousContent ? record.previousContent.split("\n").length : 0;
    const newLines = record.newContent ? record.newContent.split("\n").length : 0;
    if (newLines >= prevLines) {
      added = newLines - prevLines + 1;
      removed = 0;
    } else {
      added = 1;
      removed = prevLines - newLines;
    }
  }

  return (
    <div className="flex items-center justify-between group py-0.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[#888888]">
          {record.operation === "create" ? "Created" : "Edited"}
        </span>
        <FileBadge filename={fileName} />
        <span
          className={`font-mono text-[13px] truncate ${
            isRolledBack ? "line-through text-[#666666]" : "text-[#d4d4d4]"
          }`}
          title={record.targetFile}
        >
          {fileName}
        </span>
        {!isRolledBack && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] ml-1">
            <span className="text-[#4ade80]">+{added}</span>
            <span className="text-[#f87171]">-{removed}</span>
          </span>
        )}
      </div>

      {/* Undo Button / Status */}
      {onRollback && (
        <div className="shrink-0 ml-3">
          {isRolledBack ? (
            <span className="text-[11px] text-[#666666] flex items-center gap-1">
              <Check className="w-3 h-3 text-[#4ade80]" />
              <span>Undone</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onRollback(record)}
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded bg-[#242424] hover:bg-[#333333] border border-[#383838] text-[11px] text-[#d4d4d4] transition-all cursor-pointer shadow-xs"
              title="Rollback file"
            >
              <RotateCcw className="w-2.5 h-2.5 text-[#ff7a00]" />
              <span>Undo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool Trace Item: e.g. "Analyzed TS index.ts #L1-5" or "Terminal ⌵" (Image 1, 2)
// ---------------------------------------------------------------------------
function ToolTraceItem({ tool }: { tool: TraceToolCall }) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedName = tool.name.toLowerCase();

  // Extract argument details
  let targetArg = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      try {
        const parsed = JSON.parse(tool.args);
        targetArg = parsed.path || parsed.command || parsed.targetFile || "";
      } catch {
        targetArg = tool.args;
      }
    } else {
      targetArg = tool.args.path || tool.args.command || tool.args.targetFile || "";
    }
  }

  // 1. Terminal / Bash execution (Image 2)
  if (normalizedName === "bash" || normalizedName === "terminal" || normalizedName === "cmd") {
    const isError = tool.isError;
    const command = targetArg;
    const resultText =
      typeof tool.result === "string"
        ? tool.result
        : JSON.stringify(tool.result, null, 2);

    return (
      <div className="w-full my-1.5 flex flex-col">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5"
        >
          <TerminalIcon className="w-3.5 h-3.5 text-[#888888]" />
          <span>Terminal</span>
          {isOpen ? (
            <ChevronDown className="w-3 h-3 text-[#666666]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#666666]" />
          )}
        </button>

        {isOpen && (
          <div className="mt-1 p-3 rounded-xl bg-[#181818] border border-[#2e2e2e] font-mono text-[12px] leading-relaxed select-text overflow-x-auto">
            {command && (
              <div className="text-[#d4d4d4] flex items-center gap-1.5 mb-1.5">
                <span className="text-[#ff7a00] font-bold">$</span>
                <span>{command}</span>
              </div>
            )}
            {resultText && (
              <div className={isError ? "text-[#f87171]" : "text-[#888888]"}>
                {resultText}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. Read / Explored files (Image 1)
  if (normalizedName === "read" || normalizedName === "read_file" || normalizedName === "list_dir") {
    const fileName =
      targetArg.replace(/\\/g, "/").split("/").filter(Boolean).pop() || targetArg;

    return (
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="text-[#888888]">Analyzed</span>
        <FileBadge filename={fileName} />
        <span className="font-mono text-[13px] text-[#d4d4d4] truncate">
          {fileName}
        </span>
      </div>
    );
  }

  // 3. SubAgent call (Image 3)
  if (normalizedName.includes("subagent")) {
    return (
      <div className="flex items-center gap-1.5 py-0.5 text-[12px] text-[#888888]">
        <Layers className="w-3 h-3 text-[#38bdf8]" />
        <span>SubAgent</span>
        <span className="text-[#d4d4d4] font-mono">{targetArg}</span>
      </div>
    );
  }

  // 4. Fallback tool representation
  return (
    <div className="flex items-center gap-1.5 py-0.5 text-[12px] text-[#888888]">
      <Search className="w-3 h-3 text-[#888888]" />
      <span className="capitalize">{tool.name}</span>
      {targetArg && <span className="text-[#d4d4d4] font-mono truncate">{targetArg}</span>}
    </div>
  );
}
