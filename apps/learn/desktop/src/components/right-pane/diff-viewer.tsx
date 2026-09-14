import React, { useState, useMemo } from "react";
import { ChevronsUpDown } from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { computeDiff, type DiffLine } from "../workspace/execution-trace";

export interface DiffViewerProps {
  previousContent: string | null | undefined;
  newContent: string | null | undefined;
  className?: string;
  maxHeight?: string | number;
}

interface HunkBlock {
  type: "lines" | "folded";
  lines: DiffLine[];
  id: string;
  startIndex: number;
  count: number;
}

export function DiffViewer({
  previousContent,
  newContent,
  className = "",
  maxHeight,
}: DiffViewerProps) {
  const [unfoldedHunkIds, setUnfoldedHunkIds] = useState<Set<string>>(new Set());
  const [expandedChunkCounts, setExpandedChunkCounts] = useState<Record<string, number>>({});

  const allLines = useMemo(() => {
    return computeDiff(previousContent, newContent);
  }, [previousContent, newContent]);

  // Group diff into active chunks and folded context blocks
  const blocks = useMemo(() => {
    const result: HunkBlock[] = [];
    const CONTEXT_MARGIN = 3;
    const MIN_FOLD_SIZE = 8;

    let i = 0;
    while (i < allLines.length) {
      if (allLines[i]?.type !== "context") {
        // Collect active hunk lines
        const hunkLines: DiffLine[] = [];
        while (i < allLines.length && allLines[i]?.type !== "context") {
          hunkLines.push(allLines[i]!);
          i++;
        }
        result.push({
          type: "lines",
          lines: hunkLines,
          id: `hunk_${result.length}`,
          startIndex: i - hunkLines.length,
          count: hunkLines.length,
        });
      } else {
        // Count consecutive context lines
        let contextCount = 0;
        const startCtx = i;
        while (i < allLines.length && allLines[i]?.type === "context") {
          contextCount++;
          i++;
        }

        if (contextCount >= MIN_FOLD_SIZE) {
          // Keep leading context lines
          const leadingContext = allLines.slice(startCtx, startCtx + CONTEXT_MARGIN);
          if (leadingContext.length > 0) {
            result.push({
              type: "lines",
              lines: leadingContext,
              id: `ctx_lead_${result.length}`,
              startIndex: startCtx,
              count: leadingContext.length,
            });
          }

          // Folded block in the middle
          const foldStart = startCtx + CONTEXT_MARGIN;
          const foldEnd = startCtx + contextCount - CONTEXT_MARGIN;
          const foldedLines = allLines.slice(foldStart, foldEnd);

          if (foldedLines.length > 0) {
            result.push({
              type: "folded",
              lines: foldedLines,
              id: `folded_${result.length}`,
              startIndex: foldStart,
              count: foldedLines.length,
            });
          }

          // Keep trailing context lines
          const trailingContext = allLines.slice(foldEnd, startCtx + contextCount);
          if (trailingContext.length > 0) {
            result.push({
              type: "lines",
              lines: trailingContext,
              id: `ctx_trail_${result.length}`,
              startIndex: foldEnd,
              count: trailingContext.length,
            });
          }
        } else {
          // Few context lines, display directly
          const ctxLines = allLines.slice(startCtx, startCtx + contextCount);
          result.push({
            type: "lines",
            lines: ctxLines,
            id: `ctx_short_${result.length}`,
            startIndex: startCtx,
            count: ctxLines.length,
          });
        }
      }
    }

    return result;
  }, [allLines]);

  const handleToggleFold = (id: string) => {
    setUnfoldedHunkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandChunk = (id: string, delta: number) => {
    setExpandedChunkCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  const hasAnyFolded = blocks.some((b) => b.type === "folded");
  const allUnfolded = blocks
    .filter((b) => b.type === "folded")
    .every((b) => unfoldedHunkIds.has(b.id));

  const handleToggleAllFolds = () => {
    if (allUnfolded) {
      setUnfoldedHunkIds(new Set());
    } else {
      setUnfoldedHunkIds(new Set(blocks.filter((b) => b.type === "folded").map((b) => b.id)));
    }
  };

  if (allLines.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-neutral-500 font-sans">
        No content to compare.
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-full h-full flex-1 min-h-0 flex flex-col font-mono text-xs select-text bg-[#141414] overflow-hidden", className)}>
      {/* Global Toggle Toolbar if folded chunks exist */}
      {hasAnyFolded && (
        <div className="flex items-center justify-end px-3 py-1 bg-[#1a1a1a] border-b border-[#282828] select-none text-[11px] text-neutral-400 shrink-0">
          <button
            type="button"
            onClick={handleToggleAllFolds}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-white/5"
            title={allUnfolded ? "Collapse unchanged blocks" : "Expand all unchanged blocks"}
          >
            <ChevronsUpDown className="w-3 h-3 text-neutral-400" />
            <span>{allUnfolded ? "Collapse context" : "Expand all lines"}</span>
          </button>
        </div>
      )}

      {/* Main Diff Content */}
      <ScrollArea
        className="w-full max-w-full flex-1 min-h-0 h-full"
        viewportClassName="h-full"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <div className="w-full max-w-full pb-6">
          {blocks.map((block) => {
            if (block.type === "folded") {
              const isUnfolded = unfoldedHunkIds.has(block.id);
              const extraVisible = expandedChunkCounts[block.id] || 0;

              if (isUnfolded) {
                return (
                  <div key={block.id} className="w-full max-w-full">
                    {block.lines.map((line, lIdx) => (
                      <DiffLineRow key={`unfolded_${block.startIndex + lIdx}`} line={line} />
                    ))}
                  </div>
                );
              }

              const visibleTop = block.lines.slice(0, extraVisible);
              const visibleBottom = extraVisible > 0 ? block.lines.slice(-extraVisible) : [];
              const remainingCount = Math.max(0, block.lines.length - extraVisible * 2);

              return (
                <div key={block.id} className="w-full max-w-full flex flex-col select-none">
                  {visibleTop.map((line, lIdx) => (
                    <DiffLineRow key={`top_${block.startIndex + lIdx}`} line={line} />
                  ))}

                  {remainingCount > 0 ? (
                    <div className="w-full flex items-center justify-between px-3 py-1 my-0.5 bg-[#1e1e22] hover:bg-[#25252b] border-y border-[#2d2d35] text-[11.5px] text-neutral-400 transition-colors">
                      <button
                        type="button"
                        onClick={() => handleExpandChunk(block.id, 10)}
                        className="px-2 py-0.5 rounded text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Show 10 more lines above"
                      >
                        +10
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleFold(block.id)}
                        className="flex-1 text-center py-0.5 font-sans font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>+{remainingCount} more lines</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExpandChunk(block.id, 10)}
                        className="px-2 py-0.5 rounded text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Show 10 more lines below"
                      >
                        +10
                      </button>
                    </div>
                  ) : null}

                  {visibleBottom.map((line, lIdx) => (
                    <DiffLineRow key={`bottom_${block.startIndex + lIdx}`} line={line} />
                  ))}
                </div>
              );
            }

            // Standard line blocks
            return (
              <div key={block.id} className="w-full max-w-full">
                {block.lines.map((line, lIdx) => (
                  <DiffLineRow key={`line_${block.startIndex + lIdx}`} line={line} />
                ))}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const isAdded = line.type === "added";
  const isRemoved = line.type === "removed";

  return (
    <div
      className={cn(
        "flex items-start w-full max-w-full leading-5 font-mono text-[12px] group hover:bg-white/[0.03] transition-colors",
        isAdded && "bg-[#238636]/15 text-[#e6edf3]",
        isRemoved && "bg-[#da3633]/15 text-[#e6edf3]"
      )}
    >
      {/* Old Line Number */}
      <div
        className={cn(
          "w-10 sm:w-12 px-2 text-right select-none text-[11px] shrink-0 border-r border-[#262626] self-stretch",
          isRemoved ? "text-[#ff5c5c] font-medium" : "text-[#555555]"
        )}
      >
        {line.oldNum ?? ""}
      </div>

      {/* New Line Number */}
      <div
        className={cn(
          "w-10 sm:w-12 px-2 text-right select-none text-[11px] shrink-0 border-r border-[#262626] self-stretch",
          isAdded ? "text-[#409D62] font-medium" : "text-[#555555]"
        )}
      >
        {line.newNum ?? ""}
      </div>

      {/* Diff Sign Indicator */}
      <div
        className={cn(
          "w-5 text-center select-none font-mono text-xs shrink-0 font-bold self-stretch",
          isAdded && "text-[#409D62]",
          isRemoved && "text-[#ff5c5c]",
          !isAdded && !isRemoved && "text-transparent"
        )}
      >
        {isAdded ? "+" : isRemoved ? "-" : " "}
      </div>

      {/* Code Line Content */}
      <div className="flex-1 min-w-0 px-1.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {line.content || " "}
      </div>
    </div>
  );
}
