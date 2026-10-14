import React, { useState, useMemo } from "react";
import { marked, type Token, type Tokens } from "marked";
import { Check, Copy, Download, Maximize2, X } from "lucide-react";
import { cn } from "@const/ui";
import {
  createMarkedLatexExtension,
  renderKatex,
  sanitizeCurrencyAndMath,
  extractCitationsFromMath,
  type MathToken,
} from "../../lib/marked-latex";
import { convertReferencesToMarkdownLinks } from "../../lib/grounding/source-references";

const mathCitationPattern =
  /(?:\\text\{)?(?:<a\s+[^>]*href="#ref-(?:source-)?(?:[^"]+)"[^>]*>.*?<\/a>|\[\d+\]\(#ref-(?:source-)?(?:[^\s")]+)(?:\s*(?:"|&quot;)(?:.*?)(?:"|&quot;))?\)|\(?\[?(?:source|sumber):[a-zA-Z0-9_\-]+\]?\)?|\[source_[a-zA-Z0-9_\-]+\])(?:\})?/gi;

function cleanMathContentCitations(mathContent: string): {
  cleanMath: string;
  citations: string[];
} {
  const citations: string[] = [];
  let cleanMath = mathContent.replace(mathCitationPattern, (m: string) => {
    citations.push(m.replace(/^\\text\{/, "").replace(/\}$/, "").trim());
    return "";
  });

  cleanMath = cleanMath
    .replace(/\\text\{\s*\}/g, "")
    .replace(/(?:\\quad|\\qquad|\s)+\s*$/g, "")
    .trim();

  return { cleanMath, citations };
}

/**
 * Pre-processes markdown text by extracting any citation markers or badges trapped inside
 * LaTeX math blocks ($...$, $$...$$, \[...\], \(...\)) and placing them immediately outside
 * the math delimiters so that KaTeX can render purely mathematical syntax without parse errors.
 */
export function extractCitationsFromMathText(content: string): string {
  if (!content || typeof content !== "string") return content;

  // 1. Block math: $$...$$ or \[...\] (allows trailing characters/citations on the closing line)
  let result = content.replace(
    /(?:\${2}([\s\S]+?)\${2}|\\\[([\s\S]+?)\\\])([^\n]*)/g,
    (_fullMatch: string, math1: string, math2: string, trailing: string) => {
      const mathContent = math1 ?? math2 ?? "";
      const { cleanMath, citations } = cleanMathContentCitations(mathContent);

      let cleanTrailing = trailing || "";
      if (cleanTrailing) {
        cleanTrailing = cleanTrailing
          .replace(mathCitationPattern, (m: string) => {
            citations.push(m.trim());
            return "";
          })
          .trim();
      }

      const citationStr = citations.length > 0 ? " " + citations.join(" ") : "";
      const trailingStr = cleanTrailing ? " " + cleanTrailing : "";

      if (citationStr || trailingStr) {
        return `$$\n${cleanMath}\n$$\n${citationStr}${trailingStr}\n`;
      }
      return `$$\n${cleanMath}\n$$`;
    }
  );

  // 2. Inline math: \(...\)
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (_fullMatch: string, mathContent: string) => {
    const { cleanMath, citations } = cleanMathContentCitations(mathContent);
    if (citations.length > 0) {
      return `\\(${cleanMath}\\) ${citations.join(" ")}`;
    }
    return `\\(${cleanMath}\\)`;
  });

  // 3. Inline math: $...$
  result = result.replace(/\$([^\$\n\r]+?)\$/g, (fullMatch: string, mathContent: string) => {
    // Ignore currency numbers: e.g. "$100", "$50.00"
    if (/^[\\\$]?\s*\d+(?:[.,]\d+)?\s*[\\\$]?$/.test(mathContent.trim())) {
      return fullMatch;
    }

    const { cleanMath, citations } = cleanMathContentCitations(mathContent);
    if (citations.length > 0) {
      return `$${cleanMath}$ ${citations.join(" ")}`;
    }
    return `$${cleanMath}$`;
  });

  return result;
}

// Configure marked globally once with GitHub Flavored Markdown and LaTeX extensions
marked.use(createMarkedLatexExtension());
marked.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = tokens ? this.parser.parseInline(tokens) : "";
      if (href && (href.startsWith("#ref-source-") || href.startsWith("#ref-"))) {
        const sourceId = href.replace(/^#ref-(?:source-)?/, "");
        return `<a href="#ref-source-${sourceId}" class="source-ref-badge" data-source-id="${sourceId}" data-source-number="${text}" title="${title || ""}">${text}</a>`;
      }
      return `<a href="${href}"${title ? ` title="${title}"` : ""} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    html({ text }) {
      return text;
    },
  },
});
marked.setOptions({
  gfm: true,
  breaks: true,
});

interface MarkdownContentProps {
  content: string;
  className?: string;
  sourcesMap?: Map<string, { title: string }>;
  onSourceClick?: (sourceId: string) => void;
  onOpenBrowser?: (url: string) => void;
}

export const MarkdownContent = React.memo(function MarkdownContent({
  content,
  className = "",
  sourcesMap,
  onSourceClick,
  onOpenBrowser,
}: MarkdownContentProps) {
  const tokens = useMemo(() => {
    if (!content || typeof content !== "string") return [];

    // Sanitize currency and escaped math hallucinations (e.g. \1.60$ -> $1.60)
    let normalizedContent = sanitizeCurrencyAndMath(content);

    // Normalize single-space indented list items so they parse cleanly into nested lists
    normalizedContent = normalizedContent.replace(/\n( +)([*+-]) /g, (match, spaces, bullet) => {
      return spaces.length === 1 ? `\n  ${bullet} ` : match;
    });

    // Extract any citations trapped inside math delimiters ($...$, $$...$$, \[...\], \(...\))
    normalizedContent = extractCitationsFromMathText(normalizedContent);

    // Convert [source:id] citations into markdown anchor links
    normalizedContent = convertReferencesToMarkdownLinks(normalizedContent, sourcesMap);

    return marked.lexer(normalizedContent);
  }, [content, sourcesMap]);

  if (!content || typeof content !== "string") return null;

  const handleClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest("a");
    if (target) {
      const href = target.getAttribute("href");
      if (href && (href.startsWith("#ref-source-") || href.startsWith("#ref-"))) {
        e.preventDefault();
        e.stopPropagation();
        const sourceId = href.replace(/^#ref-(?:source-)?/, "");
        onSourceClick?.(sourceId);
      } else if (href && (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("www."))) {
        if (onOpenBrowser) {
          e.preventDefault();
          e.stopPropagation();
          const targetUrl = href.startsWith("www.") ? `https://${href}` : href;
          onOpenBrowser(targetUrl);
        }
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "space-y-2.5 text-[13px] sm:text-[14px] leading-[1.65] text-foreground dark:text-white select-text font-sans [&_strong]:font-semibold [&_b]:font-semibold [&_strong]:text-foreground dark:[&_strong]:text-white [&_b]:text-foreground dark:[&_b]:text-white",
        "[&_.source-ref-badge]:inline-flex [&_.source-ref-badge]:items-center [&_.source-ref-badge]:justify-center [&_.source-ref-badge]:w-4.5 [&_.source-ref-badge]:h-4.5 [&_.source-ref-badge]:min-w-[18px] [&_.source-ref-badge]:min-h-[18px] [&_.source-ref-badge]:rounded-full [&_.source-ref-badge]:bg-secondary hover:[&_.source-ref-badge]:bg-secondary/80 [&_.source-ref-badge]:border [&_.source-ref-badge]:border-border [&_.source-ref-badge]:text-muted-foreground hover:[&_.source-ref-badge]:text-foreground [&_.source-ref-badge]:text-[10px] [&_.source-ref-badge]:font-medium [&_.source-ref-badge]:no-underline [&_.source-ref-badge]:cursor-pointer [&_.source-ref-badge]:select-none [&_.source-ref-badge]:align-middle [&_.source-ref-badge]:-translate-y-[1px] [&_.source-ref-badge]:mx-0.5 [&_.source-ref-badge]:transition-all [&_.source-ref-badge]:active:scale-90 shadow-2xs",
        className
      )}
    >
      {tokens.map((token, index) => (
        <TokenRenderer
          key={index}
          token={token}
          sourcesMap={sourcesMap}
          onSourceClick={onSourceClick}
        />
      ))}
    </div>
  );
});

function TokenRenderer({
  token,
  isNested,
  sourcesMap,
  onSourceClick,
}: {
  token: Token;
  isNested?: boolean;
  sourcesMap?: Map<string, { title: string }>;
  onSourceClick?: (sourceId: string) => void;
}) {
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      const Tag = `h${Math.min(heading.depth, 6)}` as keyof React.JSX.IntrinsicElements;
      const sizeClasses =
        heading.depth === 1
          ? "text-[16px] font-semibold text-foreground dark:text-white mt-3.5 mb-1.5 tracking-tight"
          : heading.depth === 2
          ? "text-[14.5px] font-semibold text-foreground dark:text-white mt-3 mb-1 tracking-tight"
          : heading.depth === 3
          ? "text-[13.5px] font-medium text-foreground dark:text-white mt-2.5 mb-1 tracking-tight"
          : "text-[13px] font-medium text-foreground dark:text-white mt-2 mb-1";
      return (
        <Tag className={`${sizeClasses} font-sans`}>
          <InlineRenderer text={heading.text} sourcesMap={sourcesMap} />
        </Tag>
      );
    }

    case "paragraph": {
      const paragraph = token as Tokens.Paragraph;
      return (
        <p className="leading-[1.65] text-foreground dark:text-white my-1.5 font-sans">
          <InlineRenderer text={paragraph.text} sourcesMap={sourcesMap} />
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
          sourcesMap={sourcesMap}
          onSourceClick={onSourceClick}
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
          <ol className={cn("space-y-1.5 my-2 pl-0.5 text-foreground dark:text-white", isNested && "my-1 pl-2 space-y-1")}>
            {list.items.map((item: Tokens.ListItem, idx: number) => (
              <li key={idx} className="flex items-start gap-2 leading-[1.6]">
                <span className="select-none font-sans tabular-nums text-[11.5px] text-muted-foreground pt-0.5 w-4 text-right shrink-0">
                  {start + idx}.
                </span>
                <div className="flex-1 min-w-0">
                  <ListItemContent
                    item={item}
                    sourcesMap={sourcesMap}
                    onSourceClick={onSourceClick}
                  />
                </div>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className={cn("space-y-1.5 my-2 pl-0.5 text-foreground dark:text-white", isNested && "my-1 pl-2.5 space-y-1")}>
          {list.items.map((item: Tokens.ListItem, idx: number) => (
            <li key={idx} className="flex items-start gap-2.5 leading-[1.6]">
              <span className="select-none text-muted-foreground text-[13px] leading-none pt-1 shrink-0">
                •
              </span>
              <div className="flex-1 min-w-0">
                <ListItemContent
                  item={item}
                  sourcesMap={sourcesMap}
                  onSourceClick={onSourceClick}
                />
              </div>
            </li>
          ))}
        </ul>
      );
    }

    case "blockquote": {
      const bq = token as Tokens.Blockquote;
      return (
        <blockquote className="border-l-2 border-primary/60 pl-3 my-2 text-muted-foreground italic font-sans">
          {bq.tokens ? (
            bq.tokens.map((subToken, subIdx) => (
              <TokenRenderer
                key={subIdx}
                token={subToken}
                sourcesMap={sourcesMap}
                onSourceClick={onSourceClick}
              />
            ))
          ) : (
            <InlineRenderer text={bq.text} sourcesMap={sourcesMap} />
          )}
        </blockquote>
      );
    }

    case "hr":
      return <hr className="border-border my-4" />;

    case "space":
      return null;

    default:
      if ("tokens" in token && Array.isArray((token as { tokens?: Token[] }).tokens)) {
        return (
          <div>
            {((token as { tokens: Token[] }).tokens).map((childToken, cIdx) => (
              <TokenRenderer
                key={cIdx}
                token={childToken}
                sourcesMap={sourcesMap}
                onSourceClick={onSourceClick}
              />
            ))}
          </div>
        );
      }
      if ("text" in token && typeof (token as { text?: unknown }).text === "string") {
        return <InlineRenderer text={(token as { text: string }).text} sourcesMap={sourcesMap} />;
      }
      return null;
  }
}

function ListItemContent({
  item,
  sourcesMap,
  onSourceClick,
}: {
  item: Tokens.ListItem;
  sourcesMap?: Map<string, { title: string }>;
  onSourceClick?: (sourceId: string) => void;
}) {
  if (!item.tokens || item.tokens.length === 0) {
    return <InlineRenderer text={item.text} sourcesMap={sourcesMap} />;
  }

  if (item.tokens.length === 1 && item.tokens[0]?.type === "text") {
    return <InlineRenderer text={item.tokens[0].text} sourcesMap={sourcesMap} />;
  }

  return (
    <div className="space-y-1">
      {item.tokens.map((childToken, cIdx) => {
        if (childToken.type === "text") {
          return (
            <div key={cIdx} className="leading-[1.6]">
              <InlineRenderer text={childToken.text} sourcesMap={sourcesMap} />
            </div>
          );
        }
        if (childToken.type === "paragraph") {
          return (
            <div key={cIdx} className="leading-[1.6] my-0.5">
              <InlineRenderer text={(childToken as Tokens.Paragraph).text} sourcesMap={sourcesMap} />
            </div>
          );
        }
        if (childToken.type === "list") {
          return (
            <div key={cIdx} className="mt-1">
              <TokenRenderer
                token={childToken}
                isNested
                sourcesMap={sourcesMap}
                onSourceClick={onSourceClick}
              />
            </div>
          );
        }
        return (
          <TokenRenderer
            key={cIdx}
            token={childToken}
            isNested
            sourcesMap={sourcesMap}
            onSourceClick={onSourceClick}
          />
        );
      })}
    </div>
  );
}

function TableBlock({
  header,
  rows,
  align,
  sourcesMap,
  onSourceClick,
}: {
  header: Tokens.TableCell[];
  rows: Tokens.TableCell[][];
  align: Array<"center" | "left" | "right" | null>;
  sourcesMap?: Map<string, { title: string }>;
  onSourceClick?: (sourceId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCitationClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest("a");
    if (target) {
      const href = target.getAttribute("href");
      if (href && (href.startsWith("#ref-source-") || href.startsWith("#ref-"))) {
        e.preventDefault();
        e.stopPropagation();
        const sourceId = href.replace(/^#ref-(?:source-)?/, "");
        onSourceClick?.(sourceId);
      }
    }
  };

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
    const a = align?.[index];
    if (a === "center") return "text-center";
    if (a === "right") return "text-right";
    return "text-left";
  };

  return (
    <>
      <div
        onClick={handleCitationClick}
        className="relative group/tbl my-3.5 rounded-xl border border-border/80 bg-card overflow-hidden select-text"
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/60 gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-sans text-muted-foreground">Table</span>
            <span className="text-[10px] text-muted-foreground/80 font-sans tabular-nums">
              ({rows.length} rows)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title={copied ? "Copied" : "Copy TSV"}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Expand table"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto touch-pan-x scrollbar-thin">
          <table className="w-full text-left border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-muted/30 border-b border-border/60">
                {header.map((col, idx) => (
                  <th
                    key={idx}
                    className={cn(
                      "px-3 py-2 text-[11px] font-medium text-muted-foreground tracking-wider",
                      idx === 0 ? "whitespace-nowrap w-12 text-center" : "min-w-[130px]",
                      getAlignClass(idx)
                    )}
                  >
                    <InlineRenderer text={col.text} sourcesMap={sourcesMap} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors"
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className={cn(
                        "px-3 py-2 leading-relaxed text-foreground dark:text-white align-top",
                        cellIdx === 0
                          ? "font-medium text-foreground dark:text-white whitespace-nowrap w-12 text-center"
                          : "min-w-[130px] whitespace-normal break-words",
                        getAlignClass(cellIdx)
                      )}
                    >
                      <InlineRenderer text={cell.text} sourcesMap={sourcesMap} />
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
          onClick={handleCitationClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 [&_.source-ref-badge]:inline-flex [&_.source-ref-badge]:items-center [&_.source-ref-badge]:justify-center [&_.source-ref-badge]:w-4.5 [&_.source-ref-badge]:h-4.5 [&_.source-ref-badge]:min-w-[18px] [&_.source-ref-badge]:min-h-[18px] [&_.source-ref-badge]:rounded-full [&_.source-ref-badge]:bg-secondary hover:[&_.source-ref-badge]:bg-secondary/80 [&_.source-ref-badge]:border [&_.source-ref-badge]:border-border [&_.source-ref-badge]:text-muted-foreground hover:[&_.source-ref-badge]:text-foreground [&_.source-ref-badge]:text-[10px] [&_.source-ref-badge]:font-medium [&_.source-ref-badge]:no-underline [&_.source-ref-badge]:cursor-pointer [&_.source-ref-badge]:select-none [&_.source-ref-badge]:align-middle [&_.source-ref-badge]:-translate-y-[1px] [&_.source-ref-badge]:mx-0.5 [&_.source-ref-badge]:transition-all [&_.source-ref-badge]:active:scale-90 shadow-2xs"
        >
          <div className="w-full max-h-[85vh] flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
              <span className="text-xs font-medium text-foreground">
                Table ({rows.length} rows)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-border hover:bg-muted text-foreground cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-border hover:bg-muted text-foreground cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer ml-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto touch-pan-x p-3">
              <table className="w-full text-left border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/60">
                    {header.map((col, idx) => (
                      <th
                        key={idx}
                        className={cn(
                          "px-3 py-2 text-[11px] font-medium text-muted-foreground tracking-wider",
                          idx === 0 ? "whitespace-nowrap w-12 text-center" : "min-w-[130px]",
                          getAlignClass(idx)
                        )}
                      >
                        <InlineRenderer text={col.text} sourcesMap={sourcesMap} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-border/40 last:border-b-0">
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className={cn(
                            "px-3 py-2 leading-relaxed text-foreground dark:text-white align-top",
                            cellIdx === 0
                              ? "font-medium text-foreground dark:text-white whitespace-nowrap w-12 text-center"
                              : "min-w-[130px] whitespace-normal break-words",
                            getAlignClass(cellIdx)
                          )}
                        >
                          <InlineRenderer text={cell.text} sourcesMap={sourcesMap} />
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
    <div className="rounded-xl overflow-hidden bg-muted/30 border border-border/60 my-2.5 select-none">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border/50 text-xs">
        <span className="font-mono text-[10px] text-muted-foreground lowercase">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-muted"
          title="Copy code"
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
      </div>

      <pre className="p-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-foreground/90 select-text">
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

  // Defensively extract any citations or badges from math
  const { cleaned, badges } = extractCitationsFromMath(math);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleaned);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const html = renderKatex(cleaned, displayMode);

  return (
    <div className="rounded-xl overflow-hidden bg-muted/25 border border-border/60 my-2.5 select-none">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border/40 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            LaTeX
          </span>
          {badges.length > 0 && (
            <div
              className="inline-flex items-center gap-1"
              dangerouslySetInnerHTML={{ __html: badges.join("") }}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSource(!showSource)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-muted"
          >
            {showSource ? "Rendered" : "TeX"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-muted"
            title="Copy LaTeX"
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
        </div>
      </div>

      {showSource ? (
        <pre className="p-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-foreground/90 select-text bg-muted/10">
          <code>{cleaned}</code>
        </pre>
      ) : (
        <div
          className="p-3 overflow-x-auto text-center leading-normal text-foreground select-text font-sans touch-pan-x [&_.katex-display]:my-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

function InlineRenderer({
  text,
  sourcesMap,
}: {
  text?: string;
  sourcesMap?: Map<string, { title: string }>;
}) {
  const safeText = typeof text === "string" ? text : (text ? String(text) : "");
  if (!safeText) return null;
  const sanitized = sanitizeCurrencyAndMath(safeText);
  const extracted = extractCitationsFromMathText(sanitized);
  const normalized = convertReferencesToMarkdownLinks(extracted, sourcesMap);
  const html = marked.parseInline(normalized);
  if (typeof html === "string") {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: html }}
        className="[&_code]:bg-muted/80 [&_code]:text-foreground dark:[&_code]:text-white [&_code]:font-mono [&_code]:text-[11.5px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-border/60 [&_strong]:font-semibold [&_b]:font-semibold [&_strong]:text-foreground dark:[&_strong]:text-white [&_b]:text-foreground dark:[&_b]:text-white [&_em]:italic [&_em]:text-foreground/90 dark:[&_em]:text-white [&_a:not(.source-ref-badge)]:text-primary dark:[&_a:not(.source-ref-badge)]:text-sky-400 [&_a:not(.source-ref-badge)]:underline [&_a:not(.source-ref-badge)]:decoration-primary/40 [&_a:not(.source-ref-badge)]:hover:decoration-primary cursor-text [&_.source-ref-badge]:inline-flex [&_.source-ref-badge]:items-center [&_.source-ref-badge]:justify-center [&_.source-ref-badge]:w-4.5 [&_.source-ref-badge]:h-4.5 [&_.source-ref-badge]:min-w-[18px] [&_.source-ref-badge]:min-h-[18px] [&_.source-ref-badge]:rounded-full [&_.source-ref-badge]:bg-secondary hover:[&_.source-ref-badge]:bg-secondary/80 [&_.source-ref-badge]:border [&_.source-ref-badge]:border-border [&_.source-ref-badge]:text-muted-foreground hover:[&_.source-ref-badge]:text-foreground [&_.source-ref-badge]:text-[10px] [&_.source-ref-badge]:font-medium [&_.source-ref-badge]:no-underline [&_.source-ref-badge]:cursor-pointer [&_.source-ref-badge]:select-none [&_.source-ref-badge]:align-middle [&_.source-ref-badge]:-translate-y-[1px] [&_.source-ref-badge]:mx-0.5 [&_.source-ref-badge]:transition-all [&_.source-ref-badge]:active:scale-90"
      />
    );
  }
  return <span>{safeText}</span>;
}
