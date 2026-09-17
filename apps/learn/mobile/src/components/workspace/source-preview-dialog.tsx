import React, { useState, useMemo } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Eye,
  Code2,
  FileText,
  ArrowUpRight,
  Clock,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  ScrollArea,
  cn,
  toast,
} from "@const/ui";
import { MarkdownContent } from "./markdown-content";
import { SourceIcon, getSourceCategoryLabel } from "./source-icon";
import { useI18n } from "../../lib/i18n";
import type { LocalSource } from "../../lib/db";

export interface SourcePreviewDialogProps {
  source: LocalSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLearn?: (learnId: string) => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SourcePreviewDialog({
  source,
  open,
  onOpenChange,
  onOpenLearn,
}: SourcePreviewDialogProps) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const [hasCopied, setHasCopied] = useState(false);

  // Content statistics
  const stats = useMemo(() => {
    if (!source?.content) {
      return { characters: 0, words: 0, readingMinutes: 0 };
    }
    const text = source.content.trim();
    const characters = text.length;
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const readingMinutes = Math.max(1, Math.ceil(words / 200));
    return { characters, words, readingMinutes };
  }, [source?.content]);

  if (!source) return null;

  const handleCopyContent = async () => {
    if (!source.content) return;
    try {
      await navigator.clipboard.writeText(source.content);
      setHasCopied(true);
      toast.success(t("contentCopied"));
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy content");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-lg max-h-[90vh] p-0 rounded-2xl border border-border bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden outline-none font-sans"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {source.title || t("previewSource")}
        </DialogTitle>

        {/* 1. Header with Source Info & Actions */}
        <div className="p-4 border-b border-border flex flex-col gap-2.5 shrink-0 bg-secondary/15">
          <div className="flex items-start justify-between gap-3">
            {/* Left: Icon, Category & Title */}
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="pt-0.5 shrink-0">
                <SourceIcon source={source} size="md" />
              </div>

              <div className="min-w-0 flex-1">
                {/* Meta pills */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                    {getSourceCategoryLabel(source)}
                  </span>
                  {source.subpagesCount && source.subpagesCount > 1 ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center gap-1">
                      <Layers className="w-2.5 h-2.5" />
                      {source.subpagesCount} pgs
                    </span>
                  ) : null}
                  {source.size ? (
                    <span className="text-[10px] font-mono text-muted-foreground/80 px-1 py-0.5">
                      {formatFileSize(source.size)}
                    </span>
                  ) : null}
                </div>

                {/* Title */}
                <h3 className="text-sm font-semibold text-foreground tracking-tight line-clamp-2 leading-snug">
                  {source.title}
                </h3>

                {/* URL */}
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5 max-w-full truncate font-mono"
                    title={source.url}
                  >
                    <span className="truncate">{source.url.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                  </a>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 shrink-0 pt-0.5">
              {/* Copy content button */}
              {source.content && (
                <button
                  type="button"
                  onClick={handleCopyContent}
                  className="h-7 w-7 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border/70 active:scale-95"
                  title={t("copyContent")}
                >
                  {hasCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {/* Open in workspace button */}
              {onOpenLearn && source.learnId && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenLearn(source.learnId);
                  }}
                  className="h-7 w-7 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border/70 active:scale-95"
                  title={t("openInWorkspace")}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-7 w-7 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border/70 active:scale-95"
                aria-label={t("cancel")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Subheader Toolbar: Mode Switcher & Stats */}
          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            {/* View Mode Switcher (Formatted vs Raw Markdown) */}
            <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/60">
              <button
                type="button"
                onClick={() => setViewMode("formatted")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer",
                  viewMode === "formatted"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="w-3 h-3" />
                <span>{t("formatted")}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("raw")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer",
                  viewMode === "raw"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code2 className="w-3 h-3" />
                <span>{t("rawMarkdown")}</span>
              </button>
            </div>

            {/* Reading stats */}
            {source.content ? (
              <div className="flex items-center gap-2 text-muted-foreground text-[10.5px] font-mono">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 opacity-70" />
                  {t("readingTime", { min: stats.readingMinutes })}
                </span>
                <span className="opacity-40">•</span>
                <span>
                  {t("wordsCount", { count: stats.words.toLocaleString() })}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* 2. Scrollable Body */}
        <ScrollArea className="flex-1 w-full min-h-0" viewportClassName="p-4">
          {source.content ? (
            viewMode === "formatted" ? (
              <div className="max-w-none">
                <MarkdownContent
                  content={source.content}
                  className="space-y-3 text-xs sm:text-[13.5px] leading-relaxed select-text"
                />
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-[11px] font-mono text-foreground whitespace-pre-wrap leading-relaxed select-text font-normal">
                {source.content}
              </div>
            )
          ) : (
            <div className="py-10 text-center flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 p-4">
              <div className="w-10 h-10 rounded-xl bg-secondary border border-border/70 flex items-center justify-center text-muted-foreground mb-2.5 shadow-2xs">
                <FileText className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h4 className="text-xs font-medium text-foreground mb-1">
                {t("noContentCached")}
              </h4>
              <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed mb-3">
                This source was referenced via URL or file link without local text caching. You can visit the link directly.
              </p>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all shadow-2xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{t("openOriginalLink")}</span>
                </a>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
