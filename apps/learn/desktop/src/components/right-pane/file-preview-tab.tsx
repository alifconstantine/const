import React, { useState, useEffect } from "react";
import { Copy, Check, ChevronRight, Eye, Code, ExternalLink } from "lucide-react";
import { ScrollArea } from "@const/ui";
import { FileIcon } from "../workspace/file-icon";
import { MarkdownContent } from "../workspace/markdown-content";
import type { RightPaneTab } from "./types";

interface FilePreviewTabProps {
  tab: RightPaneTab;
}

export function FilePreviewTab({ tab }: FilePreviewTabProps) {
  const [content, setContent] = useState<string>(tab.newContent || tab.previousContent || "");
  const [copied, setCopied] = useState(false);

  const rawPath = tab.filePath || tab.title || "";
  const normalizedPath = rawPath.replace(/\\/g, "/");
  const allParts = normalizedPath.split("/").filter(Boolean);
  const fileName = allParts.pop() || normalizedPath;
  const hasLeadingEllipsis = allParts.length > 2;
  const pathParts = hasLeadingEllipsis ? allParts.slice(-2) : allParts;
  const isMarkdown = fileName.toLowerCase().endsWith(".md") || fileName.toLowerCase().endsWith(".markdown");

  const [mode, setMode] = useState<"formatted" | "raw">(
    tab.previewMode || (isMarkdown ? "formatted" : "raw")
  );

  useEffect(() => {
    const electron = (window as any).electron;
    if (!content && tab.filePath && electron?.readFile) {
      electron.readFile(tab.filePath).then((res: any) => {
        if (res && res.content !== undefined) {
          setContent(res.content);
        } else if (res?.error) {
          setContent(`// Failed to read file: ${res.error}`);
        }
      });
    }
  }, [tab.filePath, content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExternal = () => {
    const electron = (window as any).electron;
    if (tab.filePath && electron?.openPath) {
      electron.openPath(tab.filePath);
    }
  };

  const lines = content.split(/\r?\n/);

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-background select-none font-sans">
      {/* Breadcrumb Path & Actions Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-card text-xs text-muted-foreground shrink-0">
        {/* Breadcrumbs */}
        <div
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden font-mono text-[11.5px] pr-3 select-none"
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
            <FileIcon filename={fileName} className="w-3.5 h-3.5" />
            <span className="truncate">{fileName}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle Formatted / Raw for Markdown files */}
          {isMarkdown && (
            <div className="flex items-center rounded-md bg-muted p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setMode("formatted")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  mode === "formatted"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Rendered preview"
              >
                <Eye className="w-3 h-3" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("raw")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  mode === "raw"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Raw source"
              >
                <Code className="w-3 h-3" />
                <span>Raw</span>
              </button>
            </div>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors cursor-pointer border border-border text-[11px]"
            title="Copy file contents"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Open in external app */}
          {tab.filePath && (
            <button
              type="button"
              onClick={handleOpenExternal}
              className="p-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border"
              title="Open with system default app"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden relative">
        {mode === "formatted" && isMarkdown ? (
          <ScrollArea className="w-full h-full p-4 select-text">
            <div className="max-w-3xl mx-auto prose dark:prose-invert text-xs leading-relaxed">
              <MarkdownContent content={content} />
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="w-full h-full select-text">
            <div className="font-mono text-[11px] leading-5 py-2">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="flex hover:bg-muted/40 transition-colors px-2"
                >
                  <span className="w-10 shrink-0 text-right pr-4 text-muted-foreground/60 select-none font-mono text-[10.5px]">
                    {index + 1}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all text-foreground">
                    {line || "\u00A0"}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
