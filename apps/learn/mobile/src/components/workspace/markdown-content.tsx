import React, { useState } from "react";
import { marked, type Token, type Tokens } from "marked";
import { Check, Copy, Download, Maximize2, X } from "lucide-react";
import { cn } from "@const/ui";
import { createMarkedLatexExtension, renderKatex, type MathToken } from "../../lib/marked-latex";
import { convertReferencesToMarkdownLinks } from "../../lib/grounding/source-references";

// Configure marked globally once with GitHub Flavored Markdown and LaTeX extensions
marked.use(createMarkedLatexExtension());
marked.setOptions({
  gfm: true,
  breaks: true,
});

interface MarkdownContentProps {
  content: string;
  className?: string;
  sourcesMap?: Map<string, { title: string }>;
  onSourceClick?: (sourceId: string) => void;
}

export function MarkdownContent({
  content,
  className = "",
  sourcesMap,
  onSourceClick,
}: MarkdownContentProps) {
  if (!content) return null;

  // Normalize single-space indented list items so they parse cleanly into nested lists
  let normalizedContent = content.replace(/\n( +)([*+-]) /g, (match, spaces, bullet) => {
    return spaces.length === 1 ? `\n  ${bullet} ` : match;
  });

  // Convert [source:id] citations into markdown anchor links
  normalizedContent = convertReferencesToMarkdownLinks(normalizedContent, sourcesMap);

  const tokens = marked.lexer(normalizedContent);

  const handleClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest("a");
    if (target) {
      const href = target.getAttribute("href");
      if (href && href.startsWith("#ref-source-")) {
        e.preventDefault();
        e.stopPropagation();
        const sourceId = href.replace("#ref-source-", "");
        onSourceClick?.(sourceId);
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "space-y-2.5 text-[13px] sm:text-[14px] leading-[1.65] text-[#d4d4d4] select-text font-sans [&_strong]:font-semibold [&_b]:font-semibold [&_strong]:text-[#ffffff] [&_b]:text-[#ffffff]",
        "[&_.source-ref-badge]:inline-flex [&_.source-ref-badge]:items-center [&_.source-ref-badge]:justify-center [&_.source-ref-badge]:w-4.5 [&_.source-ref-badge]:h-4.5 [&_.source-ref-badge]:min-w-[18px] [&_.source-ref-badge]:min-h-[18px] [&_.source-ref-badge]:rounded-full [&_.source-ref-badge]:bg-[#26282d] [&_.source-ref-badge]:hover:bg-[#34373d] [&_.source-ref-badge]:border [&_.source-ref-badge]:border-white/15 [&_.source-ref-badge]:text-[#9ca3af] hover:[&_.source-ref-badge]:text-white [&_.source-ref-badge]:text-[10px] [&_.source-ref-badge]:font-medium [&_.source-ref-badge]:no-underline [&_.source-ref-badge]:cursor-pointer [&_.source-ref-badge]:select-none [&_.source-ref-badge]:align-middle [&_.source-ref-badge]:-translate-y-[1px] [&_.source-ref-badge]:mx-0.5 [&_.source-ref-badge]:transition-all [&_.source-ref-badge]:active:scale-90 shadow-2xs",
        className
      )}
    >
      {tokens.map((token, index) => (
        <TokenRenderer key={index} token={token} />
      ))}
    </div>
  );
}

function TokenRenderer({ token, isNested }: { token: Token; isNested?: boolean }) {
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      const Tag = `h${Math.min(heading.depth, 6)}` as keyof React.JSX.IntrinsicElements;
      const sizeClasses =
        heading.depth === 1
          ? "text-[16px] font-semibold text-[#ffffff] mt-3.5 mb-1.5 tracking-tight"
          : heading.depth === 2
          ? "text-[14.5px] font-semibold text-[#f0f0f0] mt-3 mb-1 tracking-tight"
          : heading.depth === 3
          ? "text-[13.5px] font-medium text-[#e4e4e4] mt-2.5 mb-1 tracking-tight"
          : "text-[13px] font-medium text-[#d4d4d4] mt-2 mb-1";
      return (
        <Tag className={`${sizeClasses} font-sans`}>
          <InlineRenderer text={heading.text} />
        </Tag>
      );
    }

    case "paragraph": {
      const paragraph = token as Tokens.Paragraph;
      return (
        <p className="leading-[1.65] text-[#d4d4d4] my-1.5 font-sans">
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

    case "blockMath": {
      const mathToken = token as unknown as MathToken;
      return <MathBlock math={mathToken.text} displayMode={true} />;
    }

    case "code": {
      const code = token as Tokens.Code;
      const lang = (code.lang || "text").toLowerCase().trim();
      if (lang === "math" || lang === "latex" || lang === "katex") {
        return <MathBlock math={code.text} displayMode={true} />;
      }
      return <CodeBlock code={code.text} language={lang} />;
    }

    case "list": {
      const list = token as Tokens.List;
      if (list.ordered) {
        const start = list.start || 1;
        return (
          <ol className={cn("space-y-1.5 my-2 pl-0.5 text-[#d4d4d4]", isNested && "my-1 pl-2 space-y-1")}>
            {list.items.map((item: Tokens.ListItem, idx: number) => (
              <li key={idx} className="flex items-start gap-2 leading-[1.6]">
                <span className="select-none font-mono text-[11px] text-[#969696] pt-0.5 w-4 text-right shrink-0">
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
        <ul className={cn("space-y-1.5 my-2 pl-0.5 text-[#d4d4d4]", isNested && "my-1 pl-2.5 space-y-1")}>
          {list.items.map((item: Tokens.ListItem, idx: number) => (
            <li key={idx} className="flex items-start gap-2 leading-[1.6]">
              {item.task ? (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  className="mt-1 mr-0.5 rounded accent-white shrink-0 pointer-events-none"
                />
              ) : (
                <span className={cn(
                  "select-none text-[#969696] shrink-0 font-medium",
                  isNested ? "text-[12px] leading-[1.6]" : "text-[14px] leading-[1.5]"
                )}>
                  {isNested ? "–" : "•"}
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
        <blockquote className="border-l-2 border-[#555555] pl-3 py-1 my-2.5 text-[#d4d4d4] bg-[#222222]/60 rounded-r-lg italic text-[12.5px]">
          <InlineRenderer text={bq.text} />
        </blockquote>
      );
    }

    case "hr":
      return <div className="h-[1px] bg-[#383838] my-3.5" />;

    case "space":
      return null;

    default: {
      if ("text" in token && typeof (token as any).text === "string") {
        return (
          <p className="leading-[1.65] text-[#d4d4d4] my-1 font-sans">
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

  if (item.tokens.length === 1 && item.tokens[0]?.type === "text") {
    return <InlineRenderer text={item.tokens[0].text} />;
  }

  return (
    <div className="space-y-1">
      {item.tokens.map((childToken, cIdx) => {
        if (childToken.type === "text") {
          return (
            <div key={cIdx} className="leading-[1.6]">
              <InlineRenderer text={childToken.text} />
            </div>
          );
        }
        if (childToken.type === "paragraph") {
          return (
            <div key={cIdx} className="leading-[1.6] my-0.5">
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

  const getAlignClass = (index: number) => {
    const a = align[index];
    if (a === "center") return "text-center";
    if (a === "right") return "text-right";
    return "text-left";
  };

  return (
    <>
      <div className="relative group/tbl my-3 rounded-xl border border-[#383838] bg-[#1b1b1b] overflow-hidden select-text">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#222222] border-b border-[#383838] gap-1">
          <span className="text-[11px] font-mono text-[#969696]">Table</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded text-[#969696] hover:text-[#ffffff] hover:bg-white/5 transition-colors cursor-pointer"
              title={copied ? "Copied" : "Copy TSV"}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#4ade80]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="p-1 rounded text-[#969696] hover:text-[#ffffff] hover:bg-white/5 transition-colors cursor-pointer"
              title="Expand table"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#222222] border-b border-[#383838]">
                {header.map((col, idx) => (
                  <th
                    key={idx}
                    className={cn(
                      "px-3 py-2 text-[11px] font-medium text-[#969696] tracking-wider whitespace-nowrap",
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
                  className="border-b border-[#2e2e2e] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className={cn(
                        "px-3 py-2 leading-relaxed text-[#d4d4d4] align-top whitespace-nowrap",
                        cellIdx === 0 && "font-medium text-[#ffffff]",
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

      {isExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-h-[85vh] flex flex-col bg-[#161616] border border-[#383838] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#222222] border-b border-[#383838]">
              <span className="text-xs font-medium text-[#ffffff]">
                Table ({rows.length} rows)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-[#383838] hover:bg-white/5 text-[#d4d4d4] cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-[#969696] hover:text-[#ffffff] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#222222] border-b border-[#383838]">
                    {header.map((col, idx) => (
                      <th
                        key={idx}
                        className={cn(
                          "px-3 py-2 text-[11px] font-medium text-[#969696] tracking-wider",
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
                    <tr key={rowIdx} className="border-b border-[#2e2e2e] last:border-b-0">
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className={cn(
                            "px-3 py-2 leading-relaxed text-[#d4d4d4] align-top",
                            cellIdx === 0 && "font-medium text-[#ffffff]",
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
    <div className="rounded-xl overflow-hidden bg-[#1b1b1b] border border-[#2e2e2e] my-2.5 select-none">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#222222] border-b border-[#2e2e2e] text-xs">
        <span className="font-mono text-[10px] text-[#969696] lowercase">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-[#969696] hover:text-[#ffffff] transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-white/5"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[#4ade80]" />
              <span className="text-[#4ade80]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <pre className="p-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-[#d4d4d4] select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MathBlock({
  math,
  displayMode = true,
}: {
  math: string;
  displayMode?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showSource, setShowSource] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(math);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const html = renderKatex(math, displayMode);

  return (
    <div className="rounded-xl overflow-hidden bg-[#1b1b1b] border border-[#2e2e2e] my-2.5 select-none">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#222222] border-b border-[#2e2e2e] text-xs">
        <span className="font-mono text-[10px] text-[#969696] uppercase tracking-wider">
          LaTeX
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSource(!showSource)}
            className="text-[11px] text-[#969696] hover:text-[#ffffff] transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-white/5"
          >
            {showSource ? "Rendered" : "TeX"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-[#969696] hover:text-[#ffffff] transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-white/5"
            title="Copy LaTeX"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[#4ade80]" />
                <span className="text-[#4ade80]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {showSource ? (
        <pre className="p-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-[#d4d4d4] select-text bg-black/20">
          <code>{math}</code>
        </pre>
      ) : (
        <div
          className="p-3 overflow-x-auto text-center leading-normal text-[#e4e4e4] select-text font-sans touch-pan-x [&_.katex-display]:my-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

function InlineRenderer({ text }: { text: string }) {
  const html = marked.parseInline(text);
  if (typeof html === "string") {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: html }}
        className="[&_code]:bg-[#242424] [&_code]:text-[#ececec] [&_code]:font-mono [&_code]:text-[11.5px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-[#383838] [&_strong]:font-semibold [&_b]:font-semibold [&_strong]:text-[#ffffff] [&_em]:italic [&_em]:text-[#d4d4d4] [&_a]:text-[#ffffff] [&_a]:underline [&_a]:decoration-[#666666] [&_a]:hover:decoration-white cursor-text"
      />
    );
  }
  return <span>{text}</span>;
}
