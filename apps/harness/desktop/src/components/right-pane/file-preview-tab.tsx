import React, { useState, useEffect } from "react";
import { Copy, Check, ChevronRight, Eye, Code, ExternalLink, Loader2 } from "lucide-react";
import { ScrollArea, cn } from "@const/ui";
import { FileIcon } from "../workbench/file-icon";
import { MarkdownContent } from "../workbench/markdown-content";
import type { RightPaneTab } from "./types";

interface FilePreviewTabProps {
  tab: RightPaneTab;
}

export function FilePreviewTab({ tab }: FilePreviewTabProps) {
  const [content, setContent] = useState<string>(tab.newContent || tab.previousContent || "");
  const [isLoading, setIsLoading] = useState<boolean>(!content && Boolean(tab.filePath));
  const [copied, setCopied] = useState(false);

  const rawPath = tab.filePath || tab.title || "";
  const normalizedPath = rawPath.replace(/\\/g, "/");
  const pathParts = normalizedPath.split("/").filter(Boolean);
  const fileName = pathParts.pop() || normalizedPath;
  const isMarkdown = fileName.toLowerCase().endsWith(".md") || fileName.toLowerCase().endsWith(".markdown");

  const [mode, setMode] = useState<"formatted" | "raw">(
    tab.previewMode || (isMarkdown ? "formatted" : "raw")
  );

  useEffect(() => {
    if (!content && tab.filePath && window.electron?.readFile) {
      setIsLoading(true);
      window.electron.readFile(tab.filePath).then((res) => {
        if (res && res.content !== undefined) {
          setContent(res.content);
        } else if (res?.error) {
          setContent(`// Failed to read file: ${res.error}`);
        }
        setIsLoading(false);
      });
    }
  }, [tab.filePath, content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExternal = () => {
    if (tab.filePath && window.electron?.openPath) {
      window.electron.openPath(tab.filePath);
    }
  };

  const lines = content.split(/\r?\n/);

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[#141414] select-none font-sans">
      {/* Breadcrumb Path & Actions Header matching Image 2 */}
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
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors cursor-pointer",
                  mode === "formatted"
                    ? "bg-[#333333] text-white"
                    : "text-neutral-400 hover:text-white"
                )}
                title="Formatted Markdown preview"
              >
                <Eye className="w-3 h-3" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("raw")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors cursor-pointer",
                  mode === "raw"
                    ? "bg-[#333333] text-white"
                    : "text-neutral-400 hover:text-white"
                )}
                title="Raw source code view"
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
            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Copy file content"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Open Externally */}
          {tab.filePath && (
            <button
              type="button"
              onClick={handleOpenExternal}
              className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Open file in external editor"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 gap-2 text-xs text-neutral-500 font-sans">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            <span>Reading file...</span>
          </div>
        ) : isMarkdown && mode === "formatted" ? (
          /* Formatted Markdown Rendering matching Image 2 */
          <div className="p-6 max-w-4xl mx-auto font-sans select-text leading-relaxed text-[#d4d4d4]">
            <MarkdownContent content={content} />
          </div>
        ) : (
          /* Monospace Code Viewer matching Image 2 with Line Numbers */
          <ScrollArea className="w-full max-w-full h-full">
            <div className="w-full max-w-full py-3 font-mono text-[12px] leading-5 select-text">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="flex items-start w-full max-w-full hover:bg-white/[0.03] transition-colors"
                >
                  <div className="w-12 px-2 text-right select-none text-[11px] text-neutral-600 dark:text-[#555555] shrink-0 border-r border-[#262626] self-stretch">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 px-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[#d4d4d4]">
                    {line || " "}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
