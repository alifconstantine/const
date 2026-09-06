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

export function getMutationDiffStats(m: FileMutationRecord): DiffStats {
  let added = 0;
  let removed = 0;
  if (m.operation === "create") {
    added = m.newContent ? m.newContent.split("\n").length : 1;
  } else if (m.operation === "modify") {
    const p = m.previousContent ? m.previousContent.split("\n").length : 0;
    const n = m.newContent ? m.newContent.split("\n").length : 0;
    if (n >= p) {
      added = n - p + 1;
    } else {
      added = 1;
      removed = p - n;
    }
  } else if (m.operation === "delete") {
    removed = m.previousContent ? m.previousContent.split("\n").length : 1;
  }
  return { added, removed };
}

// ---------------------------------------------------------------------------
// Compute simple line-based diff for preview
// ---------------------------------------------------------------------------
interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
  oldNum?: number;
  newNum?: number;
}

function computeDiff(prev: string | null, next: string | null): DiffLine[] {
  const prevLines = prev !== null ? prev.split(/\r?\n/) : [];
  const nextLines = next !== null ? next.split(/\r?\n/) : [];

  if (prev === null) {
    return nextLines.map((line, idx) => ({
      type: "added",
      content: line,
      newNum: idx + 1,
    }));
  }

  if (next === null) {
    return prevLines.map((line, idx) => ({
      type: "removed",
      content: line,
      oldNum: idx + 1,
    }));
  }

  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < prevLines.length || j < nextLines.length) {
    const prevLine = prevLines[i];
    const nextLine = nextLines[j];

    if (i < prevLines.length && j < nextLines.length && prevLine === nextLine) {
      diff.push({
        type: "context",
        content: prevLine ?? "",
        oldNum: i + 1,
        newNum: j + 1,
      });
      i++;
      j++;
    } else {
      // Lookahead match
      let matchInNext = -1;
      for (let k = j; k < Math.min(j + 5, nextLines.length); k++) {
        if (prevLine !== undefined && prevLine === nextLines[k]) {
          matchInNext = k;
          break;
        }
      }

      if (matchInNext !== -1) {
        while (j < matchInNext) {
          diff.push({
            type: "added",
            content: nextLines[j] ?? "",
            newNum: j + 1,
          });
          j++;
        }
      } else if (i < prevLines.length) {
        diff.push({
          type: "removed",
          content: prevLines[i] ?? "",
          oldNum: i + 1,
        });
        i++;
      } else if (j < nextLines.length) {
        diff.push({
          type: "added",
          content: nextLines[j] ?? "",
          newNum: j + 1,
        });
        j++;
      }
    }
  }

  return diff;
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
      if (m.operation === "create") {
        added += m.newContent ? m.newContent.split("\n").length : 1;
      } else if (m.operation === "modify") {
        const p = m.previousContent ? m.previousContent.split("\n").length : 0;
        const n = m.newContent ? m.newContent.split("\n").length : 0;
        if (n >= p) {
          added += n - p + 1;
        } else {
          added += 1;
          removed += p - n;
        }
      } else if (m.operation === "delete") {
        removed += m.previousContent ? m.previousContent.split("\n").length : 1;
      }
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
