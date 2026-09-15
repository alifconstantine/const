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
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[#141414] select-none font-sans">
      {/* Breadcrumb Path & Actions Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#282828] bg-[#1a1a1a] text-xs text-neutral-400 shrink-0">
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
                className="text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
                title={rawPath}
              >
                ...
              </span>
              <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
            </>
          )}
          {pathParts.map((part, idx) => (
            <React.Fragment key={idx}>
              <span className="text-neutral-500 hover:text-neutral-300 transition-colors shrink-0">
                {part}
              </span>
              <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
            </React.Fragment>
          ))}
          <div className="flex items-center gap-1.5 shrink-0 text-white font-medium" title={rawPath}>
            <FileIcon filename={fileName} className="w-3.5 h-3.5" />
            <span className="truncate">{fileName}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle Formatted / Raw for Markdown files */}
          {isMarkdown && (
            <div className="flex items-center rounded-md bg-[#222222] p-0.5 border border-[#2e2e2e]">
              <button
                type="button"
                onClick={() => setMode("formatted")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  mode === "formatted"
                    ? "bg-[#333333] text-white"
                    : "text-neutral-400 hover:text-neutral-200"
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
                    ? "bg-[#333333] text-white"
                    : "text-neutral-400 hover:text-neutral-200"
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
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#222222] hover:bg-[#2e2e2e] text-neutral-300 hover:text-white transition-colors cursor-pointer border border-[#2e2e2e] text-[11px]"
            title="Copy file contents"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
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
              className="p-1 rounded bg-[#222222] hover:bg-[#2e2e2e] text-neutral-400 hover:text-white transition-colors cursor-pointer border border-[#2e2e2e]"
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
            <div className="max-w-3xl mx-auto prose prose-invert text-xs leading-relaxed">
              <MarkdownContent content={content} />
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="w-full h-full select-text">
            <div className="font-mono text-[11px] leading-5 py-2">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="flex hover:bg-white/[0.03] transition-colors px-2"
                >
                  <span className="w-10 shrink-0 text-right pr-4 text-neutral-600 select-none font-mono text-[10.5px]">
                    {index + 1}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all text-neutral-300">
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
