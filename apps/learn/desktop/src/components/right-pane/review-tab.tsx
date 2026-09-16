import React, { useState, useMemo } from "react";
import {
  FileText,
  RotateCcw,
  ChevronDown,
  Layers,
  Check,
} from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
import { DiffViewer } from "./diff-viewer";
import { FileIcon } from "../workspace/file-icon";
import { getMutationDiffStats } from "../workspace/execution-trace";
import { useI18n } from "../../lib/i18n";
import type { FileMutationRecord } from "@const/agent";

interface ReviewTabProps {
  mutations?: FileMutationRecord[];
  onRollbackFile?: (record: FileMutationRecord) => Promise<any> | void;
  onRollbackAll?: (records: FileMutationRecord[]) => Promise<any> | void;
  onOpenFileDiff?: (record: FileMutationRecord) => void;
}

export function ReviewTab({
  mutations = [],
  onRollbackFile,
  onRollbackAll,
  onOpenFileDiff,
}: ReviewTabProps) {
  const { t } = useI18n();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [isUndoingAll, setIsUndoingAll] = useState(false);

  const unrolledCount = useMemo(() => {
    return mutations.filter((m) => !m.rolledBack).length;
  }, [mutations]);

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

  const toggleFile = (key: string) => {
    setOpenMap((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const handleRollbackAll = async () => {
    if (!onRollbackAll || unrolledCount === 0 || isUndoingAll) return;
    setIsUndoingAll(true);
    try {
      await onRollbackAll(mutations);
    } finally {
      setIsUndoingAll(false);
    }
  };

  if (!mutations || mutations.length === 0) {
    return (
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-8 text-center text-neutral-500 font-sans select-none bg-[#141414]">
        <FileText className="w-10 h-10 mb-3 opacity-30 text-neutral-400" />
        <h3 className="text-sm font-medium text-neutral-300 mb-1">{t("noChangesToReview") || "No Changes to Review"}</h3>
        <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
          {t("noChangesDesc") || "Files modified by the AI will appear here with line-by-line diffs and rollback controls."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[#141414] select-none font-sans text-xs">
      {/* Subheader Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#282828] bg-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-white font-medium">
            <Layers className="w-4 h-4 text-[#0066ff]" />
            <span className="text-[13px]">{t("review") || "Review"}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-black/40 text-neutral-300 text-[11px] font-mono border border-[#2a2a2a]">
            {mutations.length} {mutations.length === 1 ? "file" : "files"}
          </span>
          <div className="flex items-center gap-1 font-mono text-xs">
            <span className="text-[#409D62]">+{totalStats.added}</span>
            <span className="text-[#ff5c5c]">-{totalStats.removed}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onRollbackAll && (
            <button
              type="button"
              onClick={handleRollbackAll}
              disabled={isUndoingAll || unrolledCount === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] hover:border-[#444444] text-[11px] text-neutral-300 hover:text-white transition-all cursor-pointer font-medium disabled:opacity-50"
              title={t("undoAll") || "Undo all changes"}
            >
              <RotateCcw className={`w-3 h-3 text-neutral-400 ${isUndoingAll ? "animate-spin" : ""}`} />
              <span>{t("undoAll") || "Undo all"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Accordion List of Mutated Files */}
      <ScrollArea
        className={cn(
          "flex-1 w-full min-h-0",
          mutations.length === 1 && "flex flex-col"
        )}
        viewportClassName="space-y-0"
      >
        {mutations.map((mut, idx) => {
          const key = mut.id || `mut_${idx}`;
          const isOpen = openMap[key] !== false; // default open
          const stats = getMutationDiffStats(mut);

          const rawPath = mut.filePath || mut.targetFile || "";
          const normalized = rawPath.replace(/\\/g, "/");
          const parts = normalized.split("/").filter(Boolean);
          const fileName = parts.pop() || normalized;
          const dirPath =
            parts.length > 2
              ? `.../${parts.slice(-2).join("/")}`
              : parts.join("/");

          return (
            <div
              key={key}
              className={cn(
                "flex flex-col w-full max-w-full bg-[#141414]",
                mutations.length === 1 && isOpen && "flex-1 min-h-0"
              )}
            >
              {/* File Accordion Header */}
              <div
                onClick={() => toggleFile(key)}
                className="flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.03] transition-colors cursor-pointer select-none group shrink-0"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                  <FileIcon filename={fileName} />
                  <span
                    className={cn(
                      "font-medium truncate",
                      mut.rolledBack
                        ? "line-through text-neutral-500"
                        : "text-neutral-200 group-hover:text-white"
                    )}
                    title={rawPath}
                  >
                    {fileName}
                  </span>
                  {dirPath && (
                    <span className="font-mono text-[11px] text-neutral-500 truncate max-w-[180px]" title={rawPath}>
                      {dirPath}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Diff Stats */}
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <span className="text-[#409D62]">+{stats.added}</span>
                    <span className="text-[#ff5c5c]">-{stats.removed}</span>
                  </div>

                  {/* Single File Open / Focus Button */}
                  {onOpenFileDiff && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFileDiff(mut);
                      }}
                      className="px-1.5 py-0.5 rounded text-[10.5px] text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title={t("openFile") || "Open in dedicated tab"}
                    >
                      Focus ↗
                    </button>
                  )}

                  {/* Undo Button or Undone Indicator */}
                  {mut.rolledBack ? (
                    <span className="text-[11px] text-[#409D62] font-medium flex items-center gap-1 px-1">
                      <Check className="w-3.5 h-3.5 text-[#409D62]" />
                      <span>{t("undone") || "Undone"}</span>
                    </span>
                  ) : onRollbackFile ? (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await onRollbackFile(mut);
                      }}
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title={t("undoFile") || "Undo changes to this file"}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Embedded Diff Viewer when Expanded */}
              {isOpen && (
                <div
                  className={cn(
                    "border-t border-[#222222] bg-[#111111] w-full max-w-full min-w-0",
                    mutations.length === 1 ? "flex-1 min-h-0 flex flex-col" : "min-h-[220px]"
                  )}
                >
                  <DiffViewer
                    previousContent={mut.previousContent}
                    newContent={mut.newContent}
                    className={mutations.length === 1 ? "flex-1 min-h-0 h-full" : undefined}
                  />
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}
