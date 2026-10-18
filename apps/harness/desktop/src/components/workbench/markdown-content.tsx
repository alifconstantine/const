import React, { useState } from "react";
import { marked, type Token, type Tokens } from "marked";
import { Check, Copy, Download, Maximize2, X } from "lucide-react";
import { cn } from "@const/ui";
import { FileIcon } from "./file-icon";
import { renderMentionBadgeHtml } from "./rich-mention-editor";
import { useTranslation } from "../../lib/i18n";

interface MarkdownContentProps {
  content: string;
  className?: string;
  onOpenFilePreview?: (filePath: string) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  variant?: "default" | "user";
}

export function MarkdownContent({
  content,
  className = "",
  onOpenFilePreview,
  onOpenTrajectory,
  variant = "default",
}: MarkdownContentProps) {
  if (!content) return null;

  // Configure marked for GitHub Flavored Markdown
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  // 1. Normalize @[Title](path) mentions into native badge pills matching AI input
  let processed = content.replace(/@\[([^\]]+)\](?:\(([^)]+)\))/g, (_, label, path) => {
    const trimmedLabel = label.trim();
    const trimmedPath = path.trim().replace(/\\/g, "/");
    let kind = "file";
    let href = `file:///${trimmedPath}`;

    if (
      trimmedPath.includes("transcript.jsonl") ||
      trimmedPath.startsWith("brain/") ||
      trimmedPath.startsWith("conversation://") ||
      trimmedPath.startsWith("trajectory://")
    ) {
      const convoId =
        trimmedPath.match(/brain\/([^\/\\]+)/)?.[1] ||
        trimmedPath.replace(/^(?:conversation|trajectory):\/\/\/?/, "");
      kind = "session";
      href = `trajectory://${convoId || trimmedPath}`;
    } else if (trimmedPath.endsWith("/")) {
      kind = "directory";
      href = `folder:///${trimmedPath}`;
    }

    return renderMentionBadgeHtml({ href, title: trimmedLabel, kind });
  });

  // 2. Normalize legacy/simple @[path] mentions
  processed = processed.replace(/@\[([^\]]+)\]/g, (_, rawPath) => {
    const trimmed = rawPath.trim();
    const normalized = trimmed.replace(/\\/g, "/");
    let kind = "file";
    let href = `file:///${normalized}`;
    let title = normalized.split("/").filter(Boolean).pop() || trimmed;

    if (normalized.includes("transcript.jsonl") || normalized.startsWith("brain/")) {
      const convoId = normalized.match(/brain\/([^\/\\]+)/)?.[1];
      kind = "session";
      href = `trajectory://${convoId || normalized}`;
    } else if (normalized.endsWith("/")) {
      kind = "directory";
      href = `folder:///${normalized}`;
    }

    return renderMentionBadgeHtml({ href, title, kind });
  });

  // 3. Normalize any previously formatted links: [💬 Title](trajectory://...), [📁 Title](folder://...), [Title](file://...)
  processed = processed.replace(/\[(?:💬|📁|📄)?\s*([^\]]+)\]\((trajectory:\/\/[^)]+|folder:\/\/\/[^)]+|file:\/\/\/[^)]+)\)/g, (_, label, href) => {
    const cleanLabel = label.trim().replace(/^[\s💬📁📄]+/, "");
    let kind = "file";
    if (href.startsWith("trajectory://")) {
      kind = "session";
    } else if (href.startsWith("folder://") || cleanLabel.endsWith("/")) {
      kind = "directory";
    }
    return renderMentionBadgeHtml({ href, title: cleanLabel, kind });
  });

  // 4. Normalize standalone file/folder mentions like @"path/to/dir/" or @src/index.ts
  processed = processed.replace(/(^|[\s(])@(?:"([^"]+)"|([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+|[a-zA-Z0-9_\-./\\]+\/))(?=$|[\s),.?!])/g, (match, prefix, quotedPath, unquotedPath) => {
    const raw = quotedPath || unquotedPath;
    if (!raw) return match;
    const normalized = raw.trim().replace(/\\/g, "/");
    let kind = "file";
    let href = `file:///${normalized}`;
    let title = normalized.split("/").filter(Boolean).pop() || normalized;
    if (normalized.endsWith("/")) {
      kind = "directory";
      href = `folder:///${normalized}`;
    }
    return `${prefix}${renderMentionBadgeHtml({ href, title, kind })}`;
  });

  // Normalize file;file:/// or file; links into valid file:/// links for marked
  processed = processed.replace(/\]\(file;file:\/\/\/?/gi, "](file:///");
  processed = processed.replace(/\]\(file;/gi, "](file:///");

  // Normalize single-space indented list items so they parse cleanly into nested lists
  const normalizedContent = processed.replace(/\n( +)([*+-]) /g, (match, spaces, bullet) => {
    return spaces.length === 1 ? `\n  ${bullet} ` : match;
  });

  const tokens = marked.lexer(normalizedContent);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;

    const href = target.getAttribute("href") || "";

    // Trajectory / Conversation links
    if (href.startsWith("trajectory://") || href.startsWith("conversation://")) {
      e.preventDefault();
      const targetIdOrPath = href.replace(/^(?:trajectory|conversation):\/\/\/?/i, "");
      onOpenTrajectory?.(targetIdOrPath);
      return;
    }

    // Folder links
    if (href.startsWith("folder://") || href.endsWith("/")) {
      e.preventDefault();
      let cleanDir = href.replace(/^folder:\/\/\/?/i, "").replace(/^file:\/\/\/?/i, "");
      if (/^\/[a-zA-Z]:/i.test(cleanDir)) {
        cleanDir = cleanDir.slice(1);
      }
      if (window.electron?.openPath) {
        window.electron.openPath(cleanDir);
      } else {
        onOpenFilePreview?.(cleanDir);
      }
      return;
    }

    // File links
    if (
      href.startsWith("file://") ||
      href.startsWith("file;file://") ||
      href.startsWith("file;") ||
      /^[a-zA-Z]:[\\/]/.test(href)
    ) {
      e.preventDefault();
      let cleaned = href
        .replace(/^file;file:\/\/\/?/i, "")
        .replace(/^file:\/\/\/?/i, "")
        .replace(/^file;/i, "");
      if (/^\/[a-zA-Z]:/i.test(cleaned)) {
        cleaned = cleaned.slice(1);
      }
      onOpenFilePreview?.(cleaned);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        variant === "user"
          ? "space-y-1.5 text-[13.5px] leading-relaxed text-[#262626] dark:text-[#ececec] select-text font-sans [&_strong]:font-medium [&_b]:font-medium [&_strong]:text-[#161616] dark:[&_strong]:text-white [&_b]:text-[#161616] dark:[&_b]:text-white"
          : "space-y-3 text-[14px] leading-[1.68] text-[#262626] dark:text-[#d4d4d4] select-text font-sans [&_strong]:font-medium [&_b]:font-medium [&_strong]:text-[#161616] dark:[&_strong]:text-[#ececec] [&_b]:text-[#161616] dark:[&_b]:text-[#ececec]",
        className
      )}
    >
      {tokens.map((token, index) => (
        <TokenRenderer key={index} token={token} variant={variant} />
      ))}
    </div>
  );
}

function TokenRenderer({
  token,
  isNested,
  variant = "default",
}: {
  token: Token;
  isNested?: boolean;
  variant?: "default" | "user";
}) {
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      const Tag = `h${Math.min(heading.depth, 6)}` as keyof React.JSX.IntrinsicElements;
      const sizeClasses =
        heading.depth === 1
          ? "text-[19px] font-medium text-[#161616] dark:text-[#f0f0f0] mt-5 mb-2 tracking-tight"
          : heading.depth === 2
          ? "text-[16px] font-medium text-[#161616] dark:text-[#ececec] mt-4.5 mb-1.5 tracking-tight"
          : heading.depth === 3
          ? "text-[14.5px] font-medium text-[#161616] dark:text-[#e4e4e4] mt-3.5 mb-1 tracking-tight"
          : "text-[13.5px] font-medium text-[#262626] dark:text-[#d4d4d4] mt-3 mb-1";
      return (
        <Tag className={`${sizeClasses} font-sans`}>
          <InlineRenderer text={heading.text} />
        </Tag>
      );
    }

    case "paragraph": {
      const paragraph = token as Tokens.Paragraph;
      return (
        <p
          className={cn(
            variant === "user"
              ? "leading-relaxed text-[#262626] dark:text-[#ececec] m-0 font-sans"
              : "leading-[1.68] text-[#262626] dark:text-[#cfcfcf] my-2 font-sans"
          )}
        >
          <InlineRenderer text={paragraph.text} />
        </p>
      );
    }

    case "table": {
      const tableToken = token as Tokens.Table;
      return (
        <TableBlock
          header={tableToken.header}
          rows={tableToken.rows}
          align={tableToken.align}
        />
      );
    }

    case "code": {
      const code = token as Tokens.Code;
      return <CodeBlock code={code.text} language={code.lang || "text"} />;
    }

    case "list": {
      const list = token as Tokens.List;
      if (list.ordered) {
        const start = list.start || 1;
        return (
          <ol className={cn("space-y-2 my-2.5 pl-0.5 text-[#262626] dark:text-[#cfcfcf]", isNested && "my-1.5 pl-2 space-y-1.5")}>
            {list.items.map((item: Tokens.ListItem, idx: number) => (
              <li key={idx} className="flex items-start gap-2.5 leading-[1.65]">
                <span className="select-none font-sans tabular-nums text-[12px] text-[#888888] dark:text-[#777777] pt-0.5 w-4 text-right shrink-0">
                  {start + idx}.
                </span>
                <div className="flex-1 min-w-0">
                  <ListItemContent item={item} />
                </div>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className={cn("space-y-2 my-2.5 pl-0.5 text-[#262626] dark:text-[#cfcfcf]", isNested && "my-1.5 pl-3 space-y-1.5")}>
          {list.items.map((item: Tokens.ListItem, idx: number) => (
            <li key={idx} className="flex items-start gap-2 leading-[1.65]">
              {item.task ? (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  className="mt-1 mr-0.5 rounded accent-[#ff7a00] shrink-0 pointer-events-none"
                />
              ) : (
                <span className={cn(
                  "select-none text-[#888888] dark:text-[#737373] shrink-0 font-medium",
                  isNested ? "text-[13px] leading-[1.65]" : "text-[15px] leading-[1.6]"
                )}>
                  {isNested ? "-" : "•"}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <ListItemContent item={item} />
              </div>
            </li>
          ))}
        </ul>
      );
    }

    case "blockquote": {
      const bq = token as Tokens.Blockquote;
      return (
        <blockquote className="border-l-2 border-[#e79737] dark:border-[#ff7a00]/80 pl-3.5 py-1.5 my-3 text-[#262626] dark:text-[#a8a8a8] bg-black/[0.03] dark:bg-white/[0.02] rounded-r-lg italic">
          <InlineRenderer text={bq.text} />
        </blockquote>
      );
    }

    case "hr":
      return <div className="h-[1px] bg-[#e2e2e4] dark:bg-[#2e2e32] my-5" />;

    case "space":
      return null;

    default: {
      if ("text" in token && typeof (token as any).text === "string") {
        return (
          <p className="leading-[1.68] text-[#262626] dark:text-[#cfcfcf] my-1.5 font-sans">
            <InlineRenderer text={(token as any).text} />
          </p>
        );
      }
      return null;
    }
  }
}

function ListItemContent({ item }: { item: Tokens.ListItem }) {
  if (!item.tokens || item.tokens.length === 0) {
    return <InlineRenderer text={item.text} />;
  }

  // If there's only 1 text token, render directly without wrapper div
  if (item.tokens.length === 1 && item.tokens[0]?.type === "text") {
    return <InlineRenderer text={item.tokens[0].text} />;
  }

  return (
    <div className="space-y-1.5">
      {item.tokens.map((childToken, cIdx) => {
        if (childToken.type === "text") {
          return (
            <div key={cIdx} className="leading-[1.65]">
              <InlineRenderer text={childToken.text} />
            </div>
          );
        }
        if (childToken.type === "paragraph") {
          return (
            <div key={cIdx} className="leading-[1.65] my-0.5">
              <InlineRenderer text={(childToken as Tokens.Paragraph).text} />
            </div>
          );
        }
        if (childToken.type === "list") {
          return (
            <div key={cIdx} className="mt-1">
              <TokenRenderer token={childToken} isNested />
            </div>
          );
        }
        return <TokenRenderer key={cIdx} token={childToken} isNested />;
      })}
    </div>
  );
}

/**
 * High-fidelity Table Block with Copy, Download, and Fullscreen Expand actions matching Image 1
 */
function TableBlock({
  header,
  rows,
  align,
}: {
  header: Tokens.TableCell[];
  rows: Tokens.TableCell[][];
  align: Array<"center" | "left" | "right" | null>;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to get formatted TSV for pasting into spreadsheets
  const getTableAsTsv = () => {
    const h = header.map((c) => c.text.replace(/\t/g, " ")).join("\t");
    const r = rows
      .map((row) => row.map((c) => c.text.replace(/\t/g, " ")).join("\t"))
      .join("\n");
    return `${h}\n${r}`;
  };

  const handleCopy = async () => {
    try {
      const tsv = getTableAsTsv();
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadCsv = () => {
    const escapeCsv = (val: string) =>
      `"${val.replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const h = header.map((c) => escapeCsv(c.text)).join(",");
    const r = rows
      .map((row) => row.map((c) => escapeCsv(c.text)).join(","))
      .join("\n");
    const csv = `${h}\n${r}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `table-export-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getAlignClass = (index: number) => {
    const a = align[index];
    if (a === "center") return "text-center";
    if (a === "right") return "text-right";
    return "text-left";
  };

  return (
    <>
      <div className="relative group/tbl my-4 rounded-xl border border-[#e2e2e4] dark:border-[#2b2b2e] bg-[#fdfdfd] dark:bg-[#181818] overflow-hidden select-text">
        {/* Action buttons header (Top-Right Action Toolbar matching Image 1) */}
        <div className="flex items-center justify-end px-3 py-2 bg-[#f4f4f6] dark:bg-[#1a1a1a] border-b border-[#e2e2e4] dark:border-[#262628] gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-[#777777] dark:text-[#888888] hover:text-[#161616] dark:hover:text-[#e0e0e0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={copied ? t("workbench.copiedTable") : t("workbench.copyTable")}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#16a34a] dark:text-[#4ade80]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="p-1 rounded text-[#777777] dark:text-[#888888] hover:text-[#161616] dark:hover:text-[#e0e0e0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t("workbench.downloadCsv")}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="p-1 rounded text-[#777777] dark:text-[#888888] hover:text-[#161616] dark:hover:text-[#e0e0e0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={t("workbench.expandTable")}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-[#f0f0f3] dark:bg-[#1f1f22] border-b border-[#e2e2e4] dark:border-[#2b2b2e]">
                {header.map((col, idx) => (
                  <th
                    key={idx}
                    className={cn(
                      "px-4 py-2.5 text-xs font-medium text-[#666666] dark:text-[#969696] tracking-wider",
                      getAlignClass(idx)
                    )}
                  >
                    <InlineRenderer text={col.text} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-[#ececed] dark:border-[#262628] last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className={cn(
                        "px-4 py-3 leading-relaxed text-[#333333] dark:text-[#c4c4c8] align-top",
                        cellIdx === 0 && "font-medium text-[#161616] dark:text-[#ececec]",
                        getAlignClass(cellIdx)
                      )}
                    >
                      <InlineRenderer text={cell.text} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded Modal Overlay for wide tables */}
      {isExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded Table View"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-5xl max-h-[85vh] flex flex-col bg-[#ffffff] dark:bg-[#181818] border border-[#e2e2e4] dark:border-[#383838] rounded-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#f4f4f6] dark:bg-[#202020] border-b border-[#e2e2e4] dark:border-[#383838]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#161616] dark:text-[#f0f0f0]">
                  Table View
                </span>
                <span className="text-xs text-[#888888] dark:text-[#777777]">
                  ({rows.length} rows, {header.length} columns)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#e2e2e4] dark:border-[#383838] hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#16a34a] dark:text-[#4ade80]" />
                      <span>{t("common.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t("workbench.copyTable")}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#e2e2e4] dark:border-[#383838] hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t("workbench.downloadCsv")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#777777] dark:text-[#999999] hover:text-black dark:hover:text-white transition-colors cursor-pointer ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-left border-collapse text-[13.5px]">
                <thead>
                  <tr className="bg-[#f0f0f3] dark:bg-[#1f1f22] border-b border-[#e2e2e4] dark:border-[#2b2b2e]">
                    {header.map((col, idx) => (
                      <th
                        key={idx}
                        className={cn(
                          "px-4 py-3 text-xs font-medium text-[#666666] dark:text-[#969696] tracking-wider",
                          getAlignClass(idx)
                        )}
                      >
                        <InlineRenderer text={col.text} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="border-b border-[#ececed] dark:border-[#262628] last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className={cn(
                            "px-4 py-3 leading-relaxed text-[#333333] dark:text-[#c4c4c8] align-top",
                            cellIdx === 0 && "font-medium text-[#161616] dark:text-[#ececec]",
                            getAlignClass(cellIdx)
                          )}
                        >
                          <InlineRenderer text={cell.text} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl overflow-hidden bg-[#f4f4f6] dark:bg-[#181818] border border-[#e2e2e4] dark:border-[#2e2e2e] my-3 select-none">
      {/* Code Header Strip */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#eaeaea] dark:bg-[#202020] border-b border-[#e2e2e4] dark:border-[#2e2e2e] text-xs">
        <div className="flex items-center gap-1.5">
          <FileIcon filename={language} className="w-3.5 h-3.5" />
          <span className="font-mono text-[11px] text-[#888888] dark:text-[#888888] lowercase">
            {language}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-[#888888] dark:text-[#888888] hover:text-[#262626] dark:hover:text-[#d4d4d4] transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
          title={t("workbench.copyCode")}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[#16a34a] dark:text-[#4ade80]" />
              <span className="text-[#16a34a] dark:text-[#4ade80]">{t("common.copied")}</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>{t("common.copy")}</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-3.5 overflow-x-auto text-[13px] leading-5 font-mono text-[#262626] dark:text-[#d4d4d4] select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function InlineRenderer({ text }: { text: string }) {
  // Parse inline markdown: bold, italic, inline code, links
  const html = marked.parseInline(text);
  if (typeof html === "string") {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: html }}
        className="[&_code]:bg-[#eaeaea] dark:[&_code]:bg-[#242424] [&_code]:text-[#161616] dark:[&_code]:text-[#e0e0e0] [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-[#e2e2e4] dark:[&_code]:border-[#383838] [&_strong]:font-medium [&_b]:font-medium [&_strong]:text-[#161616] dark:[&_strong]:text-[#ececec] [&_em]:italic [&_em]:text-[#262626] dark:[&_em]:text-[#d4d4d4] [&_a:not(.inline-mention-badge)]:text-[#2563eb] dark:[&_a:not(.inline-mention-badge)]:text-[#60a5fa] [&_a:not(.inline-mention-badge)]:hover:underline [&_a:not(.inline-mention-badge)]:font-medium cursor-pointer"
      />
    );
  }
  return <span>{text}</span>;
}
