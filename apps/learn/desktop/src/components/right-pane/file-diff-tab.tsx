import React, { useState } from "react";
import { Copy, Check, RotateCcw, ChevronRight } from "lucide-react";
import { DiffViewer } from "./diff-viewer";
import { FileIcon } from "../workspace/file-icon";
import { getMutationDiffStats } from "../workspace/execution-trace";
import { useI18n } from "../../lib/i18n";
import type { RightPaneTab } from "./types";
import type { FileMutationRecord } from "@const/agent";

interface FileDiffTabProps {
  tab: RightPaneTab;
  onRollbackFile?: (record: FileMutationRecord) => Promise<any> | void;
}

export function FileDiffTab({ tab, onRollbackFile }: FileDiffTabProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const mutation = tab.mutation;
  const previousContent = tab.previousContent ?? mutation?.previousContent;
  const newContent = tab.newContent ?? mutation?.newContent;

  const rawPath = tab.filePath || mutation?.filePath || mutation?.targetFile || tab.title || "";
  const normalizedPath = rawPath.replace(/\\/g, "/");
  const allParts = normalizedPath.split("/").filter(Boolean);
  const fileName = allParts.pop() || normalizedPath;
  const hasLeadingEllipsis = allParts.length > 2;
  const pathParts = hasLeadingEllipsis ? allParts.slice(-2) : allParts;

  const stats = mutation
    ? getMutationDiffStats(mutation)
    : {
        added: newContent?.split("\n").length || 0,
        removed: previousContent?.split("\n").length || 0,
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
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-background select-none font-sans">
      {/* Breadcrumb Path & Action Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-card text-xs text-muted-foreground shrink-0">
        {/* Breadcrumb Navigation */}
        <div
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden font-sans text-[11.5px] pr-3 select-none"
        >
          {hasLeadingEllipsis && (
            <>
              <span
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title={rawPath}
              >
                ...
              </span>
              <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
            </>
          )}
          {pathParts.map((part, idx) => (
            <React.Fragment key={idx}>
              <span className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                {part}
              </span>
              <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
            </React.Fragment>
          ))}
          <div className="flex items-center gap-1.5 shrink-0 text-foreground font-medium" title={rawPath}>
            <FileIcon filename={fileName} />
            <span className="truncate">{fileName}</span>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Diff Stats Badge */}
          <div className="flex items-center gap-1 font-sans tabular-nums text-xs px-2 py-0.5 rounded bg-muted/70 border border-border">
            <span className="text-emerald-600 dark:text-emerald-400">+{stats.added}</span>
            <span className="text-red-600 dark:text-red-400">-{stats.removed}</span>
          </div>

          {/* Copy Diff Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={t("copyDiff") || "Copy diff"}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Revert / Undo File Button */}
          {mutation && onRollbackFile && (
            mutation.rolledBack ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 px-1.5 py-1">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t("undone") || "Undone"}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRollback}
                disabled={isUndoing}
                className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/80 border border-border hover:border-border/80 text-[11px] text-foreground transition-all cursor-pointer disabled:opacity-50 font-medium"
                title={t("undoFile") || "Revert changes to this file"}
              >
                <RotateCcw className={`w-3 h-3 text-muted-foreground ${isUndoing ? "animate-spin" : ""}`} />
                <span>{t("undo") || "Undo"}</span>
              </button>
            )
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
