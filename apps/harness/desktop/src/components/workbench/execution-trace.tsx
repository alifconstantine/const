import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Check,
  Terminal as TerminalIcon,
  Loader2,
  Layers,
  Search,
  Eye,
} from "lucide-react";
import { ScrollArea } from "@const/ui";
import type { FileMutationRecord } from "../../vite-env";
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

interface ExecutionTraceProps {
  thinking?: string;
  toolCalls?: TraceToolCall[];
  mutations?: FileMutationRecord[];
  isExecuting?: boolean;
  durationMs?: number;
  showMutationsSummary?: boolean;
  onRollback?: (record: FileMutationRecord) => void;
  onRollbackAll?: (records: FileMutationRecord[]) => void;
  onOpenReview?: () => void;
}

export function ExecutionTrace({
  thinking,
  toolCalls = [],
  mutations = [],
  isExecuting = false,
  durationMs,
  showMutationsSummary = false,
  onRollback,
  onRollbackAll,
  onOpenReview,
}: ExecutionTraceProps) {
  const [isMainOpen, setIsMainOpen] = useState(true);

  // Filter out internal / malformed tool calls from display
  const validToolCalls = toolCalls.filter((tc) => {
    if (!tc.name) return false;
    const lower = tc.name.toLowerCase();
    return !lower.includes("malformed") && lower !== "tool";
  });

  const hasContent =
    Boolean(thinking) ||
    validToolCalls.length > 0 ||
    mutations.length > 0 ||
    isExecuting;

  if (!hasContent) return null;

  // Format execution duration e.g. "Worked for 5m", "Worked for 22s", or "Working for 12s..."
  const formatDuration = () => {
    if (isExecuting) {
      if (!durationMs || durationMs < 1000) return "Working...";
      const s = Math.round(durationMs / 1000);
      return `Working for ${s}s...`;
    }
    if (!durationMs || durationMs < 1000) return "Worked for a few seconds";
    const s = Math.round(durationMs / 1000);
    if (s < 60) return `Worked for ${s}s`;
    const m = Math.floor(s / 60);
    return `Worked for ${m}m`;
  };

  // 1. Terminal / Shell command tools
  const commandTools = validToolCalls.filter((tc) => {
    const norm = tc.name.toLowerCase().replace(/[-_]/g, "");
    return (
      norm === "bash" ||
      norm === "terminal" ||
      norm === "runcommand" ||
      norm === "sh" ||
      norm === "exec"
    );
  });

  // 2. File modification / mutation tools (write, edit, replace)
  const fileMutationTools = validToolCalls.filter((tc) => {
    const norm = tc.name.toLowerCase().replace(/[-_]/g, "");
    return (
      norm.includes("write") ||
      norm.includes("edit") ||
      norm.includes("replace") ||
      norm.includes("createfile") ||
      norm.includes("modify") ||
      norm.includes("patch")
    );
  });

  // 3. Search and Read tools
  const explorationTools = validToolCalls.filter((tc) => {
    const norm = tc.name.toLowerCase().replace(/[-_]/g, "");
    return (
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
    );
  });

  // 4. Other tools
  const otherTools = validToolCalls.filter(
    (tc) =>
      !commandTools.includes(tc) &&
      !fileMutationTools.includes(tc) &&
      !explorationTools.includes(tc)
  );

  return (
    <div className="w-full flex flex-col gap-1.5 select-none my-1 font-sans">
      {/* Root Summary Header: e.g. Worked for 5m ⌵ */}
      <button
        type="button"
        onClick={() => setIsMainOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#969696] hover:text-[#e0e0e0] transition-colors cursor-pointer py-0.5 w-fit"
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
          {/* 1. Thought Process */}
          {thinking && (
            <ThoughtItem
              thinking={thinking}
              isExecuting={isExecuting}
              durationMs={durationMs}
            />
          )}

          {/* 2. Commands Group */}
          {commandTools.length > 0 && <CommandsGroup tools={commandTools} />}

          {/* 3. File Mutations from tool calls */}
          {fileMutationTools.length > 0 && (
            <FileMutationToolGroup tools={fileMutationTools} mutations={mutations} />
          )}

          {/* 4. Explorations & Searches */}
          {explorationTools.length > 0 && (
            <ExplorationGroup tools={explorationTools} mutations={mutations} />
          )}

          {/* 5. Other Tools */}
          {otherTools.map((tc) => (
            <GenericToolItem key={tc.id} tool={tc} />
          ))}

          {/* 6. Active executing spinner */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-xs text-[#777777] py-1">
              <Loader2 className="w-3 h-3 animate-spin text-[#ff7a00]" />
              <span>Analyzing workspace and tools...</span>
            </div>
          )}
        </div>
      )}

      {/* 7. Changed Files Summary Card (only if explicit showMutationsSummary = true) */}
      {showMutationsSummary && mutations.length > 0 && (
        <MutationsSummaryCard
          mutations={mutations}
          onRollback={onRollback}
          onRollbackAll={onRollbackAll}
          onOpenReview={onOpenReview}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thought Item: Clean text "Thought for 4s", normal standard font, clean colors
// ---------------------------------------------------------------------------
function ThoughtItem({
  thinking,
  isExecuting,
  durationMs,
}: {
  thinking: string;
  isExecuting?: boolean;
  durationMs?: number;
}) {
  const [isOpen, setIsOpen] = useState(isExecuting);

  useEffect(() => {
    if (isExecuting) {
      setIsOpen(true);
    }
  }, [isExecuting]);

  const thoughtLabel = () => {
    if (isExecuting) {
      if (durationMs && durationMs >= 1000) {
        return `Thinking (${Math.round(durationMs / 1000)}s)...`;
      }
      return "Thinking...";
    }
    if (durationMs && durationMs >= 1000) {
      return `Thought for ${Math.round(durationMs / 1000)}s`;
    }
    return "Thought for a few seconds";
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5"
      >
        <span>{thoughtLabel()}</span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-[#666666]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#666666]" />
        )}
      </button>

      {isOpen && (
        <div className="my-1.5 rounded-xl bg-[#141416] border border-[#26262a] text-[13px] leading-relaxed text-[#b0b0b0] select-text shadow-xs overflow-hidden font-sans">
          <div className="px-3 py-1.5 border-b border-[#222225] bg-[#18181b]/70 flex items-center justify-between text-xs text-[#a0a0a0]">
            <span className="font-medium">Thinking Process</span>
            {isExecuting && (
              <span className="flex items-center gap-1 text-[#ff7a00] text-[11px]">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                <span>Reasoning...</span>
              </span>
            )}
          </div>
          <ScrollArea className="max-h-72 w-full p-3 font-sans">
            <MarkdownContent
              content={thinking}
              className="text-[13px] leading-relaxed text-[#b5b5b5] [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:text-[#e0e0e0] [&_h2]:text-[#e0e0e0] [&_h3]:text-[#e0e0e0] [&_p]:my-1.5"
            />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commands Group: e.g. "Ran 2 commands ⌵"
// By default, individual terminal cards are collapsed so it stays clean and concise
// ---------------------------------------------------------------------------
function CommandsGroup({ tools }: { tools: TraceToolCall[] }) {
  const [isGroupOpen, setIsGroupOpen] = useState(true);

  if (tools.length === 1 && tools[0]) {
    return <TerminalCard tool={tools[0]} isSingle />;
  }

  return (
    <div className="flex flex-col gap-1 w-full min-w-0">
      <button
        type="button"
        onClick={() => setIsGroupOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5"
      >
        <span>Ran {tools.length} commands</span>
        {isGroupOpen ? (
          <ChevronDown className="w-3 h-3 text-[#666666]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#666666]" />
        )}
      </button>

      {isGroupOpen && (
        <div className="w-full min-w-0 pl-3 border-l border-[#2e2e2e]/50 ml-1">
          {tools.length > 5 ? (
            <ScrollArea className="max-h-[360px] w-full pr-2">
              <div className="flex flex-col gap-1 py-0.5">
                {tools.map((tc, idx) => (
                  <TerminalCard
                    key={tc.id || idx}
                    tool={tc}
                    isDefaultOpen={Boolean(tc.isError)}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col gap-1 py-0.5">
              {tools.map((tc, idx) => (
                <TerminalCard
                  key={tc.id || idx}
                  tool={tc}
                  isDefaultOpen={Boolean(tc.isError)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal Card: Clean single line row, click to expand terminal output
// ---------------------------------------------------------------------------
function TerminalCard({
  tool,
  isSingle = false,
  isDefaultOpen = false,
}: {
  tool: TraceToolCall;
  isSingle?: boolean;
  isDefaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(isDefaultOpen || isSingle);

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
        className="w-full text-left inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-white/5 min-w-0 max-w-full justify-start"
      >
        <TerminalIcon className="w-3.5 h-3.5 text-[#777777] shrink-0" />
        <span className="font-mono text-xs text-[#d4d4d4] truncate flex-1 min-w-0 text-left">
          {cmd || "command"}
        </span>
        <span className="shrink-0 text-[#666666] ml-1">
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </button>

      {/* Expanded Terminal Panel */}
      {isOpen && (
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
            {cleanResult ? (
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Mutation Group: Tool calls that edited/created files
// Clean rows with Seti VS Code icons and #409D62 / #ff5c5c line diffs
// ---------------------------------------------------------------------------
function FileMutationToolGroup({
  tools,
  mutations,
}: {
  tools: TraceToolCall[];
  mutations: FileMutationRecord[];
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 my-0.5">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5"
      >
        <span>Modified {tools.length} file{tools.length > 1 ? "s" : ""}</span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-[#666666]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#666666]" />
        )}
      </button>

      {isOpen && (
        <div className="flex flex-col gap-0.5 pl-3 border-l border-[#2e2e2e]/50 ml-1 py-0.5">
          {tools.map((tc, idx) => (
            <FileMutationToolItem key={tc.id || idx} tool={tc} mutations={mutations} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileMutationToolItem({
  tool,
  mutations,
}: {
  tool: TraceToolCall;
  mutations: FileMutationRecord[];
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
  const matched = mutations.find((m) => {
    const mName = m.targetFile.replace(/\\/g, "/").split("/").filter(Boolean).pop();
    return (
      m.targetFile === targetArg ||
      m.filePath === targetArg ||
      mName === fileName
    );
  });

  const diffStats = matched ? getMutationDiffStats(matched) : null;

  return (
    <div className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 transition-colors text-[13px] min-w-0">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <FileIcon filename={fileName} />
        <span className="text-[#d4d4d4] truncate font-sans">{fileName}</span>
      </div>
      {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
        <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
          <span className="text-[#409D62]">+{diffStats.added}</span>
          <span className="text-[#ff5c5c]">-{diffStats.removed}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exploration Group: e.g. "Explored 9 files, 5 searches ⌵"
// ---------------------------------------------------------------------------
function ExplorationGroup({
  tools,
  mutations,
}: {
  tools: TraceToolCall[];
  mutations: FileMutationRecord[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Separate searches from file reads
  const searches = tools.filter((t) => {
    const norm = t.name.toLowerCase().replace(/[-_]/g, "");
    return norm === "search" || norm === "grep" || norm === "grepsearch" || norm === "find" || norm === "findbyname";
  });
  const reads = tools.filter((t) => !searches.includes(t));

  const countFiles = reads.length;
  const countSearches = searches.length;

  let summaryLabel = "";
  if (countFiles > 0 && countSearches > 0) {
    summaryLabel = `Explored ${countFiles} file${countFiles > 1 ? "s" : ""}, ${countSearches} search${countSearches > 1 ? "es" : ""}`;
  } else if (countFiles > 0) {
    summaryLabel = `Explored ${countFiles} file${countFiles > 1 ? "s" : ""}`;
  } else {
    summaryLabel = `${countSearches} search${countSearches > 1 ? "es" : ""}`;
  }

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 my-0.5">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer w-fit py-0.5"
      >
        <span>{summaryLabel}</span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-[#666666]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#666666]" />
        )}
      </button>

      {isOpen && (
        <div className="w-full min-w-0 pl-3 border-l border-[#2e2e2e]/50 ml-1 py-0.5">
          {tools.length > 8 ? (
            <ScrollArea className="max-h-[300px] w-full pr-2">
              <div className="flex flex-col gap-0.5">
                {tools.map((tc, idx) => (
                  <ExplorationItem key={tc.id || idx} tool={tc} mutations={mutations} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col gap-0.5">
              {tools.map((tc, idx) => (
                <ExplorationItem key={tc.id || idx} tool={tc} mutations={mutations} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exploration Item: e.g. "Searched *pattern* 7 results" or "Analyzed file.tsx"
// ---------------------------------------------------------------------------
function ExplorationItem({
  tool,
  mutations,
}: {
  tool: TraceToolCall;
  mutations: FileMutationRecord[];
}) {
  const norm = tool.name.toLowerCase().replace(/[-_]/g, "");

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

    return (
      <div className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0">
        <Search className="w-3.5 h-3.5 text-[#777777] shrink-0" />
        <span className="shrink-0">Searched</span>
        <span className="text-[#d4d4d4] font-medium truncate">*{query}*</span>
        {resultCount && (
          <span className="text-[#666666] text-xs shrink-0 ml-auto font-mono">{resultCount}</span>
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

  // Check if this file was mutated
  const matched = mutations.find((m) => {
    const mName = m.targetFile.replace(/\\/g, "/").split("/").filter(Boolean).pop();
    return (
      m.targetFile === targetArg ||
      m.filePath === targetArg ||
      mName === fileName
    );
  });
  const diffStats = matched ? getMutationDiffStats(matched) : null;

  return (
    <div className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <FileIcon filename={fileName} />
        <span className="text-[#d4d4d4] truncate font-sans">
          {fileName}
        </span>
        {lineRange && (
          <span className="text-xs text-[#666666] shrink-0 font-mono">{lineRange}</span>
        )}
      </div>
      {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
        <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
          <span className="text-[#409D62]">+{diffStats.added}</span>
          <span className="text-[#ff5c5c]">-{diffStats.removed}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic Tool Item fallback
// ---------------------------------------------------------------------------
function GenericToolItem({ tool }: { tool: TraceToolCall }) {
  let targetArg = "";
  if (tool.args) {
    if (typeof tool.args === "string") {
      targetArg = tool.args;
    } else {
      targetArg = tool.args.path || tool.args.command || "";
    }
  }

  return (
    <div className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-white/5 text-[13px] text-[#888888] min-w-0">
      <Layers className="w-3.5 h-3.5 text-[#777777] shrink-0" />
      <span className="capitalize shrink-0">{tool.name}</span>
      {targetArg && (
        <span className="text-[#d4d4d4] truncate">{targetArg}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Changed Files Summary Card (Image 5)
// "7 files changed +1370 -189 ⌵" with [Undo all] and [Review]
// Uses #409D62 and #ff5c5c colors
// ---------------------------------------------------------------------------
export function MutationsSummaryCard({
  mutations,
  onRollback,
  onRollbackAll,
  onOpenReview,
}: {
  mutations: FileMutationRecord[];
  onRollback?: (record: FileMutationRecord) => void;
  onRollbackAll?: (records: FileMutationRecord[]) => void;
  onOpenReview?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  let totalAdded = 0;
  let totalRemoved = 0;

  for (const m of mutations) {
    const stats = getMutationDiffStats(m);
    totalAdded += stats.added;
    totalRemoved += stats.removed;
  }

  return (
    <div className="w-full rounded-2xl bg-[#141414] border border-[#262626] p-3 my-2 shadow-xs flex flex-col gap-2 select-none font-sans">
      {/* Header: 7 files changed +1370 -189 ⌵  |  [Undo all] [Review] */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 text-[13px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer"
        >
          <span>
            {mutations.length} file{mutations.length > 1 ? "s" : ""} changed
          </span>
          <span className="font-mono text-xs text-[#409D62]">+{totalAdded}</span>
          <span className="font-mono text-xs text-[#ff5c5c]">-{totalRemoved}</span>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#666666]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#666666]" />
          )}
        </button>

        <div className="flex items-center gap-2">
          {onRollbackAll && (
            <button
              type="button"
              onClick={() => onRollbackAll(mutations)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1e1e1e] hover:bg-[#2b2b2b] border border-[#333333] hover:border-[#444444] text-[11px] text-[#d4d4d4] transition-all cursor-pointer font-medium"
              title="Undo all changes in this turn"
            >
              <RotateCcw className="w-2.5 h-2.5 text-[#ff7a00]" />
              <span>Undo all</span>
            </button>
          )}

          {onOpenReview && (
            <button
              type="button"
              onClick={onOpenReview}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2e2e2e] border border-[#383838] hover:border-[#484848] text-[11px] text-[#e0e0e0] transition-all cursor-pointer font-medium"
              title="Review line by line diffs"
            >
              <Eye className="w-3 h-3 text-[#999999]" />
              <span>Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded list of mutated files */}
      {isOpen && (
        <div className="pt-1.5 border-t border-[#222222] w-full">
          {mutations.length > 6 ? (
            <ScrollArea className="max-h-60 w-full pr-1">
              <div className="flex flex-col gap-0.5">
                {mutations.map((mut) => (
                  <MutationRowItem
                    key={mut.id}
                    mut={mut}
                    onRollback={onRollback}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col gap-0.5">
              {mutations.map((mut) => (
                <MutationRowItem
                  key={mut.id}
                  mut={mut}
                  onRollback={onRollback}
                />
              ))}
            </div>
          )}
        </div>
      )}
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
    <div className="flex items-center justify-between group py-1 px-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <FileIcon filename={fileName} />
        <span
          className={`text-[13px] truncate font-sans ${
            mut.rolledBack ? "line-through text-[#666666]" : "text-[#d4d4d4]"
          }`}
        >
          {fileName}
        </span>
        {dirPath && (
          <span className="text-[11px] text-[#555555] font-mono truncate max-w-[240px]">
            /{dirPath}
          </span>
        )}
      </div>

      <div className="shrink-0 ml-2 flex items-center gap-2">
        {/* Colors #409D62 and #ff5c5c */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-[#409D62]">+{fileStats.added}</span>
          <span className="text-[#ff5c5c]">-{fileStats.removed}</span>
        </div>

        {mut.rolledBack ? (
          <span className="text-[10px] text-[#409D62] flex items-center gap-0.5">
            <Check className="w-3 h-3" />
            <span>Undone</span>
          </span>
        ) : onRollback ? (
          <button
            type="button"
            onClick={() => onRollback(mut)}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded bg-[#202020] hover:bg-[#2e2e2e] border border-[#333333] text-[10px] text-[#cccccc] transition-all cursor-pointer shadow-xs"
            title="Undo changes to this file"
          >
            <RotateCcw className="w-2.5 h-2.5 text-[#ff7a00]" />
            <span>Undo</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
