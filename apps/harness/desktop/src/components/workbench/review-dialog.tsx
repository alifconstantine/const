import React, { useState, useMemo } from "react";
import {
  X,
  RotateCcw,
  Check,
  Layers,
} from "lucide-react";
import { ScrollArea } from "@const/ui";
import type { FileMutationRecord } from "../../vite-env";
import { FileIcon } from "./file-icon";

export interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: FileMutationRecord[];
  onRollbackFile: (record: FileMutationRecord) => void;
  onRollbackAll: (records: FileMutationRecord[]) => void;
}

export interface DiffStats {
  added: number;
  removed: number;
}

export interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
  oldNum?: number;
  newNum?: number;
}

const diffStatsCache = new WeakMap<FileMutationRecord, DiffStats>();

export function getMutationDiffStats(m: FileMutationRecord): DiffStats {
  if (diffStatsCache.has(m)) {
    return diffStatsCache.get(m)!;
  }

  let stats: DiffStats;
  const prev = m.previousContent;
  const next = m.newContent;

  if (m.operation === "create" || prev === null || prev === undefined) {
    const lines = next !== null && next !== undefined ? next.split(/\r?\n/).length : 0;
    stats = { added: Math.max(1, lines), removed: 0 };
  } else if (m.operation === "delete" || next === null || next === undefined) {
    const lines = prev !== null && prev !== undefined ? prev.split(/\r?\n/).length : 0;
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
}

// ---------------------------------------------------------------------------
// Compute accurate line-based diff using prefix/suffix trimming + LCS
// ---------------------------------------------------------------------------
export function computeDiff(
  prev: string | null | undefined,
  next: string | null | undefined
): DiffLine[] {
  const prevLines = prev !== null && prev !== undefined ? prev.split(/\r?\n/) : [];
  const nextLines = next !== null && next !== undefined ? next.split(/\r?\n/) : [];

  if (prev === null || prev === undefined) {
    return nextLines.map((line, idx) => ({
      type: "added",
      content: line,
      newNum: idx + 1,
    }));
  }

  if (next === null || next === undefined) {
    return prevLines.map((line, idx) => ({
      type: "removed",
      content: line,
      oldNum: idx + 1,
    }));
  }

  if (prev === next) {
    return prevLines.map((line, idx) => ({
      type: "context",
      content: line,
      oldNum: idx + 1,
      newNum: idx + 1,
    }));
  }

  // 1. Common prefix trimming
  let prefix = 0;
  while (
    prefix < prevLines.length &&
    prefix < nextLines.length &&
    prevLines[prefix] === nextLines[prefix]
  ) {
    prefix++;
  }

  // 2. Common suffix trimming
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

  const prefixLines: DiffLine[] = [];
  for (let i = 0; i < prefix; i++) {
    prefixLines.push({
      type: "context",
      content: prevLines[i] ?? "",
      oldNum: i + 1,
      newNum: i + 1,
    });
  }

  const suffixLines: DiffLine[] = [];
  const oldSuffixStart = suffixOld + 1;
  const newSuffixStart = suffixNew + 1;
  for (let i = 0; i < prevLines.length - oldSuffixStart; i++) {
    suffixLines.push({
      type: "context",
      content: prevLines[oldSuffixStart + i] ?? "",
      oldNum: oldSuffixStart + i + 1,
      newNum: newSuffixStart + i + 1,
    });
  }

  const midOld = prevLines.slice(prefix, suffixOld + 1);
  const midNew = nextLines.slice(prefix, suffixNew + 1);

  const midDiff = computeLcsDiff(midOld, midNew, prefix);
  return [...prefixLines, ...midDiff, ...suffixLines];
}

function computeLcsDiff(oldLines: string[], newLines: string[], offset: number): DiffLine[] {
  const N = oldLines.length;
  const M = newLines.length;

  if (N === 0) {
    return newLines.map((content, idx) => ({
      type: "added",
      content,
      newNum: offset + idx + 1,
    }));
  }

  if (M === 0) {
    return oldLines.map((content, idx) => ({
      type: "removed",
      content,
      oldNum: offset + idx + 1,
    }));
  }

  // Fallback for massive disjoint blocks to prevent excessive memory/time
  if (N * M > 2500000) {
    const res: DiffLine[] = [];
    for (let i = 0; i < N; i++) {
      res.push({ type: "removed", content: oldLines[i] ?? "", oldNum: offset + i + 1 });
    }
    for (let j = 0; j < M; j++) {
      res.push({ type: "added", content: newLines[j] ?? "", newNum: offset + j + 1 });
    }
    return res;
  }

  const dp: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1]![j + 1] = dp[i]![j]! + 1;
      } else {
        dp[i + 1]![j + 1] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = N;
  let j = M;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({
        type: "context",
        content: oldLines[i - 1] ?? "",
        oldNum: offset + i,
        newNum: offset + j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.push({
        type: "added",
        content: newLines[j - 1] ?? "",
        newNum: offset + j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i]![j - 1]! < dp[i - 1]![j]!)) {
      result.push({
        type: "removed",
        content: oldLines[i - 1] ?? "",
        oldNum: offset + i,
      });
      i--;
    }
  }

  return result.reverse();
}

export function ReviewDialog({
  open,
  onOpenChange,
  mutations,
  onRollbackFile,
  onRollbackAll,
}: ReviewDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeMutation = mutations[selectedIndex] || mutations[0];

  const totalStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const m of mutations) {
      const s = getMutationDiffStats(m);
      added += s.added;
      removed += s.removed;
    }
    return { added, removed };
  }, [mutations]);

  const diffLines = useMemo(() => {
    if (!activeMutation) return [];
    return computeDiff(activeMutation.previousContent, activeMutation.newContent);
  }, [activeMutation]);

  if (!open || mutations.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
      <div className="relative w-full max-w-5xl h-[85vh] flex flex-col rounded-2xl bg-[#161616] border border-[#2b2b2b] shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2b2b2b] bg-[#1a1a1a]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#ff7a00]" />
              <h2 className="text-sm font-medium text-[#e5e5e5]">Review Changes</h2>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs text-[#888888]">
              <span>({mutations.length} file{mutations.length > 1 ? "s" : ""})</span>
              <span className="text-[#409D62]">+{totalStats.added}</span>
              <span className="text-[#ff5c5c]">-{totalStats.removed}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRollbackAll(mutations)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] border border-[#383838] hover:border-[#484848] text-xs text-[#d4d4d4] transition-all cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3 text-[#ff7a00]" />
              <span>Undo all</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-[#888888] hover:text-white transition-colors cursor-pointer"
              title="Close review"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Pane: Left File List + Right Diff Viewer */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Sidebar: File List */}
          <div className="w-72 shrink-0 border-r border-[#2b2b2b] bg-[#141414] flex flex-col h-full overflow-hidden">
            <ScrollArea className="flex-1 h-full w-full">
              <div className="p-2 flex flex-col gap-1">
                {mutations.map((mut, idx) => {
                  const fileName =
                    mut.targetFile.replace(/\\/g, "/").split("/").filter(Boolean).pop() ||
                    mut.targetFile;
                  const dirPath =
                    mut.targetFile.replace(/\\/g, "/").split("/").slice(0, -1).join("/") || "";
                  const isSelected = idx === selectedIndex;
                  const fileStats = getMutationDiffStats(mut);

                  return (
                    <div
                      key={mut.id}
                      onClick={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors group ${
                        isSelected
                          ? "bg-[#242424] text-white border border-[#383838]"
                          : "text-[#999999] hover:bg-white/5 hover:text-[#d4d4d4]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <FileIcon filename={fileName} />
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`font-medium truncate ${
                              mut.rolledBack ? "line-through text-[#666666]" : ""
                            }`}
                          >
                            {fileName}
                          </span>
                          {dirPath && (
                            <span className="text-[10px] text-[#666666] truncate">
                              {dirPath}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <span className="text-[#409D62]">+{fileStats.added}</span>
                          <span className="text-[#ff5c5c]">-{fileStats.removed}</span>
                        </div>
                        {mut.rolledBack ? (
                          <span className="text-[10px] text-[#409D62] flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" />
                            <span>Undone</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRollbackFile(mut);
                            }}
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1e1e1e] hover:bg-[#333333] border border-[#333333] text-[10px] text-[#cccccc] transition-all cursor-pointer"
                            title="Undo only this file"
                          >
                            <RotateCcw className="w-2.5 h-2.5 text-[#ff7a00]" />
                            <span>Undo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right Area: Diff Viewer */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#121212] overflow-hidden">
            {activeMutation ? (
              <>
                {/* File Sub-header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#252525] bg-[#161616]/50 shrink-0 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileIcon
                      filename={
                        activeMutation.targetFile
                          .replace(/\\/g, "/")
                          .split("/")
                          .filter(Boolean)
                          .pop() || ""
                      }
                    />
                    <span className="font-mono text-[#e5e5e5] truncate">
                      {activeMutation.targetFile}
                    </span>
                    <span className="text-[#666666] uppercase text-[10px] px-1.5 py-0.5 rounded bg-white/5">
                      {activeMutation.operation}
                    </span>
                  </div>

                  <div className="shrink-0 ml-3">
                    {activeMutation.rolledBack ? (
                      <span className="text-[11px] text-[#409D62] flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Changes reverted</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRollbackFile(activeMutation)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#2c2c2c] border border-[#383838] text-xs text-[#d4d4d4] transition-all cursor-pointer font-medium"
                      >
                        <RotateCcw className="w-3 h-3 text-[#ff7a00]" />
                        <span>Undo this file</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Diff Lines Table */}
                <ScrollArea className="flex-1 h-full w-full font-mono text-[12px] leading-relaxed p-2 select-text">
                  {diffLines.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-xs text-[#666666]">
                      No line changes detected
                    </div>
                  ) : (
                    diffLines.map((line, idx) => {
                      let rowStyle = "text-[#888888] hover:bg-white/[0.02]";
                      let sign = " ";
                      if (line.type === "added") {
                        rowStyle = "bg-[#409D62]/10 text-[#409D62]";
                        sign = "+";
                      } else if (line.type === "removed") {
                        rowStyle = "bg-[#ff5c5c]/10 text-[#ff5c5c]";
                        sign = "-";
                      }

                      return (
                        <div
                          key={idx}
                          className={`flex items-start px-2 py-0.5 rounded-xs ${rowStyle}`}
                        >
                          <span className="w-8 shrink-0 text-right pr-2 text-[#555555] select-none text-[11px]">
                            {line.oldNum || ""}
                          </span>
                          <span className="w-8 shrink-0 text-right pr-2 text-[#555555] select-none text-[11px]">
                            {line.newNum || ""}
                          </span>
                          <span className="w-4 shrink-0 text-center font-bold select-none">
                            {sign}
                          </span>
                          <span className="flex-1 whitespace-pre-wrap break-all">
                            {line.content || " "}
                          </span>
                        </div>
                      );
                    })
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-[#666666]">
                Select a file to review changes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
