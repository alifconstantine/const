import React, { useState } from "react";
import { marked, type Token, type Tokens } from "marked";
import { Check, Copy, Download, Maximize2, X } from "lucide-react";
import { cn } from "@const/ui";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  if (!content) return null;

  // Configure marked for GitHub Flavored Markdown
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  const tokens = marked.lexer(content);

  return (
    <div
      className={cn(
        "space-y-3 text-[14px] leading-[1.68] text-[#262626] dark:text-[#d4d4d4] select-text font-sans [&_strong]:font-medium [&_b]:font-medium [&_strong]:text-[#161616] dark:[&_strong]:text-[#ececec] [&_b]:text-[#161616] dark:[&_b]:text-[#ececec]",
        className
      )}
    >
      {tokens.map((token, index) => (
        <TokenRenderer key={index} token={token} />
      ))}
    </div>
  );
}

function TokenRenderer({ token }: { token: Token }) {
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
        <p className="leading-[1.68] text-[#262626] dark:text-[#cfcfcf] my-2 font-sans">
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
          <ol className="space-y-2 my-3 pl-1 text-[#262626] dark:text-[#cfcfcf]">
            {list.items.map((item: Tokens.ListItem, idx: number) => (
              <li key={idx} className="flex items-start gap-2.5 leading-[1.65]">
                <span className="select-none font-mono text-[12px] text-[#888888] dark:text-[#777777] pt-0.5 w-4 text-right shrink-0">
                  {start + idx}.
                </span>
                <div className="flex-1 min-w-0">
                  <InlineRenderer text={item.text} />
                </div>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="space-y-2 my-3 pl-1 text-[#262626] dark:text-[#cfcfcf]">
          {list.items.map((item: Tokens.ListItem, idx: number) => (
            <li key={idx} className="flex items-start gap-2.5 leading-[1.65]">
              <span className="select-none text-[#888888] dark:text-[#737373] text-[15px] leading-[1.6] shrink-0">
                •
              </span>
              <div className="flex-1 min-w-0">
                <InlineRenderer text={item.text} />
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
            title={copied ? "Copied table" : "Copy table (TSV)"}
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
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="p-1 rounded text-[#777777] dark:text-[#888888] hover:text-[#161616] dark:hover:text-[#e0e0e0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Expand table"
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
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy TSV</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#e2e2e4] dark:border-[#383838] hover:bg-black/5 dark:hover:bg-white/5 text-[#262626] dark:text-[#d4d4d4] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
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
        <span className="font-mono text-[11px] text-[#888888] dark:text-[#888888] lowercase">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-[#888888] dark:text-[#888888] hover:text-[#262626] dark:hover:text-[#d4d4d4] transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[#16a34a] dark:text-[#4ade80]" />
              <span className="text-[#16a34a] dark:text-[#4ade80]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
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
        className="[&>code]:bg-[#eaeaea] dark:[&>code]:bg-[#242424] [&>code]:text-[#161616] dark:[&>code]:text-[#e0e0e0] [&>code]:font-mono [&>code]:text-[12.5px] [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:border [&>code]:border-[#e2e2e4] dark:[&>code]:border-[#383838] [&>strong]:font-medium [&_strong]:font-medium [&_b]:font-medium [&>strong]:text-[#161616] dark:[&>strong]:text-[#ececec] [&_strong]:text-[#161616] dark:[&_strong]:text-[#ececec] [&>em]:italic [&>em]:text-[#262626] dark:[&>em]:text-[#d4d4d4] [&>a]:text-[#e79737] dark:[&>a]:text-[#ff7a00] [&>a]:hover:underline cursor-text"
      />
    );
  }
  return <span>{text}</span>;
}
