import React, { useState } from "react";
import { Copy, Check, RotateCcw, ChevronRight } from "lucide-react";
import { DiffViewer } from "./diff-viewer";
import { FileIcon } from "../workbench/file-icon";
import { getMutationDiffStats } from "../workbench/review-dialog";
import type { RightPaneTab } from "./types";
import type { FileMutationRecord } from "../../vite-env";

interface FileDiffTabProps {
  tab: RightPaneTab;
  onRollbackFile?: (record: FileMutationRecord) => Promise<any> | void;
}

export function FileDiffTab({ tab, onRollbackFile }: FileDiffTabProps) {
  const [copied, setCopied] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const mutation = tab.mutation;
  const previousContent = tab.previousContent ?? mutation?.previousContent;
  const newContent = tab.newContent ?? mutation?.newContent;

  const rawPath = tab.filePath || mutation?.filePath || mutation?.targetFile || tab.title || "";
  const normalizedPath = rawPath.replace(/\\/g, "/");
  const pathParts = normalizedPath.split("/").filter(Boolean);
  const fileName = pathParts.pop() || normalizedPath;

  const stats = mutation
    ? getMutationDiffStats(mutation)
    : {
        added: (newContent?.split("\n").length || 0),
        removed: (previousContent?.split("\n").length || 0),
      };

  const handleCopy = () => {
    const diffText = `--- a/${fileName}\n+++ b/${fileName}\n${newContent || ""}`;
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRollback = async () => {
    if (!mutation || !onRollbackFile || isUndoing) return;
    setIsUndoing(true);
    try {
      await onRollbackFile(mutation);
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[#141414] select-none font-sans">
      {/* Breadcrumb Path & Action Bar matching Image 1 & Image 4 */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#282828] bg-[#1a1a1a] text-xs text-neutral-400 shrink-0">
        {/* Breadcrumb Navigation */}
        <div
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden font-mono text-[11.5px] pr-3 select-none"
        >
          {pathParts.map((part, idx) => (
            <React.Fragment key={idx}>
              <span className="text-neutral-500 hover:text-neutral-300 transition-colors shrink-0">
                {part}
              </span>
              <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
            </React.Fragment>
          ))}
          <div className="flex items-center gap-1.5 shrink-0 text-white font-medium">
            <FileIcon filename={fileName} />
            <span className="truncate">{fileName}</span>
            <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 ml-1">
              (single edit)
            </span>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Diff Stats Badge */}
          <div className="flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-black/30 border border-[#2a2a2a]">
            <span className="text-[#409D62]">+{stats.added}</span>
            <span className="text-[#ff5c5c]">-{stats.removed}</span>
          </div>

          {/* Copy Diff Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Copy diff"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Revert / Undo File Button */}
          {mutation && onRollbackFile && (
            <button
              type="button"
              onClick={handleRollback}
              disabled={isUndoing}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] hover:border-[#444444] text-[11px] text-neutral-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 font-medium"
              title="Revert changes to this file"
            >
              <RotateCcw className={`w-3 h-3 text-neutral-400 ${isUndoing ? "animate-spin" : ""}`} />
              <span>Undo</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Diff Body */}
      <div className="flex-1 w-full max-w-full min-w-0 flex flex-col overflow-hidden">
        <DiffViewer
          previousContent={previousContent}
          newContent={newContent}
          className="flex-1 min-h-0 h-full"
        />
      </div>
    </div>
  );
}
