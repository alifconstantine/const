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
import { openExternalUrl } from "../../lib/open-external";
import type { LocalSource } from "../../lib/db";

export interface SourcePreviewDialogProps {
  source: LocalSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLearn?: (learnId: string) => void;
  onOpenBrowser?: (url: string) => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getContentString(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.snippet === "string") return obj.snippet;
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }
  return String(content);
}

export function SourcePreviewDialog({
  source,
  open,
  onOpenChange,
  onOpenLearn,
  onOpenBrowser,
}: SourcePreviewDialogProps) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const [hasCopied, setHasCopied] = useState(false);

  const contentString = useMemo(() => getContentString(source?.content), [source?.content]);

  // Content statistics
  const stats = useMemo(() => {
    if (!contentString) {
      return { characters: 0, words: 0, readingMinutes: 0 };
    }
    const text = contentString.trim();
    const characters = text.length;
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const readingMinutes = Math.max(1, Math.ceil(words / 200));
    return { characters, words, readingMinutes };
  }, [contentString]);

  if (!source) return null;

  const handleCopyContent = async () => {
    if (!contentString) return;
    try {
      await navigator.clipboard.writeText(contentString);
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
        hideClose
        className="w-[92vw] max-w-3xl max-h-[88vh] p-0 rounded-3xl border border-border bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden outline-none"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {source.title || t("previewSource")}
        </DialogTitle>

        {/* 1. Header with Source Info & Quick Actions */}
        <div className="px-6 pt-5 pb-4 border-b border-border/60 flex flex-col gap-3 shrink-0 bg-secondary/15">
          <div className="flex items-start justify-between gap-4">
            {/* Left: Icon, Category & Title */}
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="pt-0.5">
                <SourceIcon source={source} size="lg" />
              </div>

              <div className="min-w-0 flex-1">
                {/* Meta pills row */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="text-[10.5px] font-mono uppercase px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground">
                    {getSourceCategoryLabel(source)}
                  </span>
                  {source.subpagesCount && source.subpagesCount > 1 ? (
                    <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {source.subpagesCount} pages
                    </span>
                  ) : null}
                  {source.size ? (
                    <span className="text-[10.5px] font-mono text-muted-foreground/80 px-1.5 py-0.5">
                      {formatFileSize(source.size)}
                    </span>
                  ) : null}
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight line-clamp-2 leading-snug">
                  {source.title}
                </h3>

                {/* URL if available */}
                {source.url && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onOpenBrowser) {
                        onOpenBrowser(source.url!);
                      } else {
                        openExternalUrl(source.url);
                      }
                    }}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 max-w-full truncate group font-mono text-left cursor-pointer"
                    title={source.url}
                  >
                    <span className="truncate">{source.url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              {/* Copy content button */}
              {contentString && (
                <button
                  type="button"
                  onClick={handleCopyContent}
                  className="h-8 px-2.5 rounded-xl bg-secondary/80 hover:bg-secondary border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title={t("copyContent")}
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="hidden sm:inline text-[11px] text-emerald-500 font-medium">
                        Copied
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-[11px]">
                        {t("copyContent")}
                      </span>
                    </>
                  )}
                </button>
              )}

              {/* Open in workspace button if supported */}
              {onOpenLearn && source.learnId && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenLearn(source.learnId);
                  }}
                  className="h-8 px-2.5 rounded-xl bg-secondary/80 hover:bg-secondary border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title={t("openInWorkspace")}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">
                    {t("openInWorkspace")}
                  </span>
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border/60"
                aria-label={t("cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Subheader Toolbar: Mode Switcher & Content Metrics */}
          <div className="flex items-center justify-between gap-3 pt-1 text-xs">
            {/* View Mode Switcher (Formatted vs Raw Markdown) */}
            <div className="flex items-center p-0.5 rounded-xl bg-muted/60 border border-border/60">
              <button
                type="button"
                onClick={() => setViewMode("formatted")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer",
                  viewMode === "formatted"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{t("formatted")}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("raw")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer",
                  viewMode === "raw"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{t("rawMarkdown")}</span>
              </button>
            </div>

            {/* Reading stats */}
            {contentString ? (
              <div className="flex items-center gap-3 text-muted-foreground text-[11px] font-mono">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 opacity-70" />
                  {t("readingTime", { min: stats.readingMinutes })}
                </span>
                <span className="hidden sm:inline opacity-40">•</span>
                <span className="hidden sm:inline">
                  {t("wordsCount", { count: stats.words.toLocaleString() })}
                </span>
                <span className="hidden md:inline opacity-40">•</span>
                <span className="hidden md:inline">
                  {t("charactersCount", {
                    count: stats.characters.toLocaleString(),
                  })}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* 2. Scrollable Body: Rendered Content */}
        <ScrollArea className="flex-1 w-full min-h-0" viewportClassName="p-6">
          {contentString ? (
            viewMode === "formatted" ? (
              <div className="max-w-none">
                <MarkdownContent
                  content={contentString}
                  onOpenBrowser={onOpenBrowser || openExternalUrl}
                  className="space-y-4 text-sm sm:text-[14.5px] leading-relaxed select-text"
                />
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed select-text font-normal">
                {contentString}
              </div>
            )
          ) : (
            <div className="py-14 text-center flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/10 p-6">
              <div className="w-11 h-11 rounded-2xl bg-secondary border border-border/70 flex items-center justify-center text-muted-foreground mb-3 shadow-2xs">
                <FileText className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">
                {t("noContentCached")}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-4">
                This source was referenced via URL or file link without local text caching. You can visit the link directly.
              </p>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
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
