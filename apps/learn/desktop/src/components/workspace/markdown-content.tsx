import React, { useState } from "react";
import { marked, type Token, type Tokens } from "marked";
import { Check, Copy, Download, Maximize2, X } from "lucide-react";
import { cn } from "@const/ui";
import { useI18n } from "../../lib/i18n";
import { createMarkedLatexExtension, renderKatex, type MathToken } from "../../lib/marked-latex";

// Configure marked globally once with GitHub Flavored Markdown and LaTeX extensions
marked.use(createMarkedLatexExtension());
marked.setOptions({
  gfm: true,
  breaks: true,
});

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  if (!content) return null;

  // Normalize single-space indented list items so they parse cleanly into nested lists
  const normalizedContent = content.replace(/\n( +)([*+-]) /g, (match, spaces, bullet) => {
    return spaces.length === 1 ? `\n  ${bullet} ` : match;
  });

  const tokens = marked.lexer(normalizedContent);

  return (
    <div
      className={cn(
        "space-y-3 text-[14px] leading-[1.68] text-foreground dark:text-white select-text font-sans [&_strong]:font-semibold [&_b]:font-semibold [&_strong]:text-foreground dark:[&_strong]:text-white [&_b]:text-foreground dark:[&_b]:text-white",
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
          ? "text-[19px] font-semibold text-foreground dark:text-white mt-5 mb-2 tracking-tight"
          : heading.depth === 2
          ? "text-[16px] font-semibold text-foreground dark:text-white mt-4 mb-1.5 tracking-tight"
          : heading.depth === 3
          ? "text-[14.5px] font-semibold text-foreground dark:text-white mt-3.5 mb-1 tracking-tight"
          : "text-[13.5px] font-semibold text-foreground dark:text-white mt-3 mb-1";
      return (
        <Tag className={`${sizeClasses} font-sans`}>
          <InlineRenderer text={heading.text} />
        </Tag>
      );
    }

    case "paragraph": {
      const paragraph = token as Tokens.Paragraph;
      return (
        <p className="leading-[1.68] text-foreground dark:text-white my-2 font-sans">
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
          <ol className={cn("space-y-2 my-2.5 pl-0.5 text-foreground dark:text-white", isNested && "my-1.5 pl-2 space-y-1.5")}>
            {list.items.map((item: Tokens.ListItem, idx: number) => (
              <li key={idx} className="flex items-start gap-2.5 leading-[1.65]">
                <span className="select-none font-sans text-[12px] text-muted-foreground dark:text-white/60 pt-0.5 w-4 text-right shrink-0">
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
        <ul className={cn("space-y-2 my-2.5 pl-0.5 text-foreground dark:text-white", isNested && "my-1.5 pl-3 space-y-1.5")}>
          {list.items.map((item: Tokens.ListItem, idx: number) => (
            <li key={idx} className="flex items-start gap-2 leading-[1.65]">
              {item.task ? (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  className="mt-1 mr-0.5 rounded accent-primary shrink-0 pointer-events-none"
                />
              ) : (
                <span className={cn(
                  "select-none text-muted-foreground dark:text-white/60 shrink-0 font-medium",
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
        <blockquote className="border-l-2 border-primary/80 pl-3.5 py-1.5 my-3 text-muted-foreground dark:text-white/80 bg-muted/20 rounded-r-lg italic">
          <InlineRenderer text={bq.text} />
        </blockquote>
      );
    }

    case "hr":
      return <div className="h-[1px] bg-border my-5" />;

    case "space":
      return null;

    default: {
      if ("text" in token && typeof (token as any).text === "string") {
        return (
          <p className="leading-[1.68] text-foreground dark:text-white my-1.5 font-sans">
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

function TableBlock({
  header,
  rows,
  align,
}: {
  header: Tokens.TableCell[];
  rows: Tokens.TableCell[][];
  align: Array<"center" | "left" | "right" | null>;
}) {
  const { t } = useI18n();
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
    } catch {}
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
      <div className="relative group/tbl my-4 rounded-xl border border-border/70 bg-card overflow-hidden select-text">
        <div className="flex items-center justify-end px-3 py-2 bg-muted/40 border-b border-border/50 gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={copied ? t("tableCopied") : t("copyTsv")}
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
            title={t("downloadCsv")}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={t("expandView")}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-muted/30 border-b border-border/60">
                {header.map((col, idx) => (
                  <th
                    key={idx}
                    className={cn(
                      "px-4 py-2.5 text-xs font-medium text-muted-foreground tracking-wider",
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
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors"
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className={cn(
                        "px-4 py-3 leading-relaxed text-foreground dark:text-white align-top",
                        cellIdx === 0 && "font-medium text-foreground dark:text-white",
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
          aria-label="Expanded Table View"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-5xl max-h-[85vh] flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 bg-muted/40 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {t("dataTable")}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {t("tableRowsCols", { rows: rows.length, cols: header.length })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-foreground transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t("copiedBadge")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t("copyTsvShort")}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-foreground transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t("downloadCsv")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-left border-collapse text-[13.5px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    {header.map((col, idx) => (
                      <th
                        key={idx}
                        className={cn(
                          "px-4 py-3 text-xs font-medium text-muted-foreground tracking-wider",
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
                      className="border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors"
                    >
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className={cn(
                            "px-4 py-3 leading-relaxed text-foreground dark:text-white align-top",
                            cellIdx === 0 && "font-medium text-foreground dark:text-white",
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
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="rounded-xl overflow-hidden bg-muted/30 border border-border/60 my-3 select-none">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-muted/60 border-b border-border/50 text-xs">
        <span className="font-mono text-[11px] text-muted-foreground lowercase">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-muted"
          title={t("copyCode")}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500">{t("copiedBadge")}</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>{t("copy")}</span>
            </>
          )}
        </button>
      </div>

      <pre className="p-3.5 overflow-x-auto text-[13px] leading-5 font-mono text-foreground/90 select-text">
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
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [showSource, setShowSource] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(math);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const html = renderKatex(math, displayMode);

  return (
    <div className="rounded-xl overflow-hidden bg-muted/25 border border-border/60 my-3 select-none">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-muted/50 border-b border-border/40 text-xs">
        <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
          LaTeX
        </span>
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
                <span className="text-emerald-500">{t("copiedBadge")}</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>{t("copy")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {showSource ? (
        <pre className="p-3.5 overflow-x-auto text-[13px] leading-5 font-mono text-foreground/90 select-text bg-muted/10">
          <code>{math}</code>
        </pre>
      ) : (
        <div
          className="p-3.5 overflow-x-auto text-center leading-normal text-foreground select-text font-sans [&_.katex-display]:my-0"
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
        className="[&_code]:bg-muted/80 [&_code]:text-foreground dark:[&_code]:text-white [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-border/60 [&_strong]:font-semibold [&_b]:font-semibold [&_strong]:text-foreground dark:[&_strong]:text-white [&_b]:text-foreground dark:[&_b]:text-white [&_em]:italic [&_em]:text-foreground/90 dark:[&_em]:text-white [&_a]:text-primary dark:[&_a]:text-sky-400 [&_a]:hover:underline cursor-text"
      />
    );
  }
  return <span>{text}</span>;
}
