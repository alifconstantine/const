"use client";

import React, { useMemo, useState } from "react";
import { marked, type Token, type Tokens } from "marked";
import hljs from "highlight.js";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@const/ui";

interface MarkdownContentProps {
  content: string;
  isStreaming?: boolean;
  compact?: boolean;
  className?: string;
}

// Configure marked with GFM support
marked.setOptions({
  gfm: true,
  breaks: true,
});

export function MarkdownContent({
  content,
  isStreaming = false,
  compact = false,
  className = "",
}: MarkdownContentProps) {
  const tokens = useMemo(() => {
    if (!content) return [];
    try {
      return marked.lexer(content);
    } catch {
      return [];
    }
  }, [content]);

  if (!content) return null;

  return (
    <div
      className={cn(
        compact
          ? "space-y-2.5 text-[13px] sm:text-[13.5px] leading-relaxed text-foreground/85 select-text font-sans"
          : "space-y-3.5 text-[14px] sm:text-[15px] leading-relaxed text-foreground select-text font-sans",
        className,
      )}
    >
      {tokens.map((token, index) => (
        <BlockTokenRenderer
          key={index}
          token={token}
          isStreaming={isStreaming && index === tokens.length - 1}
          compact={compact}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block Token Renderer
// ---------------------------------------------------------------------------
function BlockTokenRenderer({
  token,
  isStreaming,
  compact = false,
}: {
  token: Token;
  isStreaming?: boolean;
  compact?: boolean;
}) {
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      const Tag =
        `h${Math.min(heading.depth, 6)}` as keyof React.JSX.IntrinsicElements;
      const sizeClasses = compact
        ? heading.depth === 1
          ? "text-base font-semibold text-foreground mt-3 mb-1.5 tracking-tight border-b border-border/30 pb-1"
          : heading.depth === 2
            ? "text-sm sm:text-base font-semibold text-foreground mt-2.5 mb-1 tracking-tight"
            : heading.depth === 3
              ? "text-xs sm:text-sm font-semibold text-foreground/95 mt-2 mb-1"
              : "text-xs font-medium text-foreground/90 mt-1.5 mb-0.5"
        : heading.depth === 1
          ? "text-xl sm:text-2xl font-semibold text-foreground mt-5 mb-2.5 tracking-tight border-b border-border/40 pb-1.5"
          : heading.depth === 2
            ? "text-lg sm:text-xl font-semibold text-foreground mt-4 mb-2 tracking-tight border-b border-border/30 pb-1"
            : heading.depth === 3
              ? "text-base sm:text-lg font-semibold text-foreground mt-3 mb-1.5"
              : "text-sm sm:text-base font-medium text-foreground/90 mt-2 mb-1";

      return (
        <Tag className={cn(sizeClasses, "font-sans")}>
          <InlineTokensRenderer
            tokens={heading.tokens}
            fallbackText={heading.text}
          />
        </Tag>
      );
    }

    case "paragraph": {
      const paragraph = token as Tokens.Paragraph;
      return (
        <p
          className={cn(
            "leading-relaxed",
            compact
              ? "text-foreground/85 my-1.5 text-[13px] sm:text-[13.5px]"
              : "text-foreground/90 my-2",
          )}
        >
          <InlineTokensRenderer
            tokens={paragraph.tokens}
            fallbackText={paragraph.text}
          />
        </p>
      );
    }

    case "code": {
      const code = token as Tokens.Code;
      return (
        <CodeBlock
          code={code.text}
          language={code.lang || "text"}
          isStreaming={isStreaming}
          compact={compact}
        />
      );
    }

    case "table": {
      const table = token as Tokens.Table;
      return <TableRenderer table={table} compact={compact} />;
    }

    case "list": {
      const list = token as Tokens.List;
      return <ListRenderer list={list} compact={compact} />;
    }

    case "blockquote": {
      const bq = token as Tokens.Blockquote;
      return (
        <blockquote
          className={cn(
            "border-l-2 border-foreground/30 pl-4 text-muted-foreground bg-secondary/15 rounded-r-xl italic font-sans",
            compact ? "py-1 my-2 text-xs sm:text-[13px]" : "py-1.5 my-3",
          )}
        >
          {bq.tokens?.map((t, i) => (
            <BlockTokenRenderer key={i} token={t} compact={compact} />
          )) || <InlineTokensRenderer fallbackText={bq.text} />}
        </blockquote>
      );
    }

    case "hr":
      return (
        <hr className={cn("border-border/60", compact ? "my-2.5" : "my-4")} />
      );

    case "space":
      return null;

    case "html": {
      const htmlToken = token as Tokens.HTML;
      return (
        <div children={htmlToken.text} className={compact ? "my-1" : "my-2"} />
      );
    }

    default: {
      if ("text" in token && typeof (token as any).text === "string") {
        return (
          <p className="leading-relaxed text-foreground/90 my-1.5">
            <InlineTokensRenderer fallbackText={(token as any).text} />
          </p>
        );
      }
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// GitHub Dark Syntax Highlighted Code Block
// ---------------------------------------------------------------------------
interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  isStreaming?: boolean;
  compact?: boolean;
}

export function CodeBlock({
  code,
  language = "text",
  className = "",
  compact = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Normalize language name
  const cleanLang = language.trim().split(/\s+/)[0]?.toLowerCase() || "text";

  const highlightedHtml = useMemo(() => {
    if (!code) return "";
    try {
      if (cleanLang && cleanLang !== "text" && hljs.getLanguage(cleanLang)) {
        return hljs.highlight(code, {
          language: cleanLang,
          ignoreIllegals: true,
        }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return escapeHtml(code);
    }
  }, [code, cleanLang]);

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
    <div
      className={cn(
        "rounded-2xl overflow-hidden bg-[#0d1117] border border-[#30363d] select-none shadow-md",
        compact ? "my-2" : "my-3.5",
        className,
      )}
    >
      {/* GitHub Dark Code Header */}
      <div
        className={cn(
          "flex items-center justify-between bg-[#161b22] border-b border-[#30363d] text-xs",
          compact ? "px-3.5 py-1.5" : "px-4 py-2",
        )}
      >
        <span
          className={cn(
            "font-mono text-[#8b949e] font-medium tracking-wide lowercase",
            compact ? "text-[11px]" : "text-[11.5px]",
          )}
        >
          {cleanLang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 font-mono text-[#8b949e] hover:text-[#c9d1d9] transition-colors cursor-pointer rounded-lg hover:bg-white/5 active:scale-95",
            compact ? "text-[10.5px] py-0.5 px-2" : "text-[11px] py-1 px-2",
          )}
          title="Copy code"
        >
          {copied ? (
            <>
              <Check
                className={
                  compact
                    ? "w-3 h-3 text-[#3fb950]"
                    : "w-3.5 h-3.5 text-[#3fb950]"
                }
              />
              <span className="text-[#3fb950] font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body with GitHub Dark Color Tokens */}
      <pre
        className={cn(
          "overflow-x-auto font-mono leading-relaxed text-[#c9d1d9] select-text [scrollbar-width:thin] github-dark-highlight",
          compact
            ? "p-3 text-[12px] sm:text-[12.5px]"
            : "p-4 text-[13px] sm:text-[13.5px]",
        )}
      >
        <code
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          className="font-mono"
        />
      </pre>

      {/* Scoped GitHub Dark Theme CSS Variables & Token Colors */}
      <style jsx global>{`
        .github-dark-highlight .hljs-doctag,
        .github-dark-highlight .hljs-keyword,
        .github-dark-highlight .hljs-meta .hljs-keyword,
        .github-dark-highlight .hljs-template-tag,
        .github-dark-highlight .hljs-template-variable,
        .github-dark-highlight .hljs-type,
        .github-dark-highlight .hljs-variable.language_ {
          color: #ff7b72;
        }
        .github-dark-highlight .hljs-title,
        .github-dark-highlight .hljs-title.class_,
        .github-dark-highlight .hljs-title.class_.inherited__,
        .github-dark-highlight .hljs-title.function_ {
          color: #d2a8ff;
        }
        .github-dark-highlight .hljs-attr,
        .github-dark-highlight .hljs-attribute,
        .github-dark-highlight .hljs-literal,
        .github-dark-highlight .hljs-meta,
        .github-dark-highlight .hljs-number,
        .github-dark-highlight .hljs-operator,
        .github-dark-highlight .hljs-variable,
        .github-dark-highlight .hljs-selector-attr,
        .github-dark-highlight .hljs-selector-class,
        .github-dark-highlight .hljs-selector-id {
          color: #79c0ff;
        }
        .github-dark-highlight .hljs-regexp,
        .github-dark-highlight .hljs-string,
        .github-dark-highlight .hljs-meta .hljs-string {
          color: #a5d6ff;
        }
        .github-dark-highlight .hljs-built_in,
        .github-dark-highlight .hljs-symbol {
          color: #ffa657;
        }
        .github-dark-highlight .hljs-comment,
        .github-dark-highlight .hljs-code,
        .github-dark-highlight .hljs-formula {
          color: #8b949e;
          font-style: italic;
        }
        .github-dark-highlight .hljs-name,
        .github-dark-highlight .hljs-quote,
        .github-dark-highlight .hljs-selector-tag,
        .github-dark-highlight .hljs-selector-pseudo {
          color: #7ee787;
        }
        .github-dark-highlight .hljs-subst {
          color: #c9d1d9;
        }
        .github-dark-highlight .hljs-section {
          color: #1f6feb;
          font-weight: bold;
        }
        .github-dark-highlight .hljs-bullet {
          color: #f2cc60;
        }
        .github-dark-highlight .hljs-emphasis {
          color: #c9d1d9;
          font-style: italic;
        }
        .github-dark-highlight .hljs-strong {
          color: #c9d1d9;
          font-weight: bold;
        }
        .github-dark-highlight .hljs-addition {
          color: #aff5b4;
          background-color: #033a16;
        }
        .github-dark-highlight .hljs-deletion {
          color: #ffd8d3;
          background-color: #67060c;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Renderer (GFM GitHub Dark Style)
// ---------------------------------------------------------------------------
function TableRenderer({
  table,
  compact = false,
}: {
  table: Tokens.Table;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-sm select-text [scrollbar-width:thin]",
        compact ? "my-2 text-xs" : "my-4",
      )}
    >
      <table className="w-full text-left text-xs sm:text-sm font-sans border-collapse">
        <thead className="bg-[#161b22] border-b border-[#30363d] text-foreground font-semibold">
          <tr>
            {table.header.map((cell, idx) => {
              const alignClass =
                table.align[idx] === "center"
                  ? "text-center"
                  : table.align[idx] === "right"
                    ? "text-right"
                    : "text-left";
              return (
                <th
                  key={idx}
                  className={cn(
                    "font-semibold text-foreground/90 tracking-wide border-r border-[#30363d]/50 last:border-r-0 whitespace-nowrap",
                    compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-xs",
                    alignClass,
                  )}
                >
                  <InlineTokensRenderer
                    tokens={cell.tokens}
                    fallbackText={cell.text}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#30363d]/60">
          {table.rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="hover:bg-white/[0.02] transition-colors odd:bg-transparent even:bg-[#161b22]/30"
            >
              {row.map((cell, cellIdx) => {
                const alignClass =
                  table.align[cellIdx] === "center"
                    ? "text-center"
                    : table.align[cellIdx] === "right"
                      ? "text-right"
                      : "text-left";
                return (
                  <td
                    key={cellIdx}
                    className={cn(
                      "text-foreground/85 border-r border-[#30363d]/50 last:border-r-0",
                      compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5",
                      alignClass,
                    )}
                  >
                    <InlineTokensRenderer
                      tokens={cell.tokens}
                      fallbackText={cell.text}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List Renderer (Ordered, Unordered, Task List)
// ---------------------------------------------------------------------------
function ListRenderer({
  list,
  compact = false,
}: {
  list: Tokens.List;
  compact?: boolean;
}) {
  const Tag = list.ordered ? "ol" : "ul";
  const listClasses = list.ordered
    ? cn(
        "list-decimal pl-6 text-foreground/90",
        compact
          ? "space-y-1 my-1.5 text-xs sm:text-[13px]"
          : "space-y-1.5 my-2.5",
      )
    : cn(
        "list-disc pl-6 text-foreground/90",
        compact
          ? "space-y-1 my-1.5 text-xs sm:text-[13px]"
          : "space-y-1.5 my-2.5",
      );

  return (
    <Tag className={listClasses} start={list.start || 1}>
      {list.items.map((item, idx) => (
        <ListItemRenderer key={idx} item={item} compact={compact} />
      ))}
    </Tag>
  );
}

function ListItemRenderer({
  item,
  compact = false,
}: {
  item: Tokens.ListItem;
  compact?: boolean;
}) {
  if (item.task) {
    return (
      <li className="list-none -ml-4 flex items-start gap-2.5 leading-relaxed py-0.5">
        <input
          type="checkbox"
          checked={item.checked}
          readOnly
          className="mt-1 h-3.5 w-3.5 rounded border-[#30363d] bg-[#161b22] accent-[#58a6ff] pointer-events-none shrink-0"
        />
        <div className="flex-1">
          {item.tokens ? (
            item.tokens.map((tok, i) => {
              if (tok.type === "checkbox") return null;
              if (tok.type === "list") {
                return (
                  <ListRenderer
                    key={i}
                    list={tok as Tokens.List}
                    compact={compact}
                  />
                );
              }
              if (tok.type === "text") {
                const textTok = tok as Tokens.Text;
                return (
                  <InlineTokensRenderer
                    key={i}
                    tokens={textTok.tokens}
                    fallbackText={textTok.text}
                  />
                );
              }
              return (
                <BlockTokenRenderer key={i} token={tok} compact={compact} />
              );
            })
          ) : (
            <InlineTokensRenderer fallbackText={item.text} />
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="leading-relaxed pl-1">
      {item.tokens ? (
        item.tokens.map((tok, i) => {
          if (tok.type === "list") {
            return (
              <ListRenderer
                key={i}
                list={tok as Tokens.List}
                compact={compact}
              />
            );
          }
          if (tok.type === "text") {
            const textTok = tok as Tokens.Text;
            return (
              <InlineTokensRenderer
                key={i}
                tokens={textTok.tokens}
                fallbackText={textTok.text}
              />
            );
          }
          return <BlockTokenRenderer key={i} token={tok} compact={compact} />;
        })
      ) : (
        <InlineTokensRenderer fallbackText={item.text} />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Inline Tokens Renderer (Bold, Italic, Link, Inline Code, Del)
// ---------------------------------------------------------------------------
export function InlineTokensRenderer({
  tokens,
  fallbackText,
}: {
  tokens?: Token[];
  fallbackText?: string;
}) {
  if (!tokens || tokens.length === 0) {
    if (fallbackText) {
      return <span>{fallbackText}</span>;
    }
    return null;
  }

  return (
    <>
      {tokens.map((tok, i) => (
        <InlineToken key={i} token={tok} />
      ))}
    </>
  );
}

function InlineToken({ token }: { token: Token }) {
  switch (token.type) {
    case "text": {
      const textTok = token as Tokens.Text;
      if (textTok.tokens && textTok.tokens.length > 0) {
        return (
          <InlineTokensRenderer
            tokens={textTok.tokens}
            fallbackText={textTok.text}
          />
        );
      }
      return <span>{textTok.text}</span>;
    }

    case "strong": {
      const strong = token as Tokens.Strong;
      return (
        <strong className="font-semibold text-foreground">
          <InlineTokensRenderer
            tokens={strong.tokens}
            fallbackText={strong.text}
          />
        </strong>
      );
    }

    case "em": {
      const em = token as Tokens.Em;
      return (
        <em className="italic text-foreground">
          <InlineTokensRenderer tokens={em.tokens} fallbackText={em.text} />
        </em>
      );
    }

    case "codespan": {
      const cs = token as Tokens.Codespan;
      return (
        <code className="font-mono text-[12px] px-1.5 py-0.5 rounded-md bg-[#161b22] text-[#e6edf3] border border-[#30363d] select-text">
          {cs.text}
        </code>
      );
    }

    case "link": {
      const link = token as Tokens.Link;
      return (
        <a
          href={
            /^https?:\/\//i.test(link.href) || link.href.startsWith("mailto:")
              ? link.href
              : undefined
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#58a6ff] hover:text-[#79c0ff] hover:underline underline-offset-2 transition-colors break-all inline-flex items-center gap-0.5 font-medium"
        >
          <InlineTokensRenderer tokens={link.tokens} fallbackText={link.text} />
          <ExternalLink className="h-3 w-3 opacity-60 shrink-0 inline ml-0.5" />
        </a>
      );
    }

    case "del": {
      const del = token as Tokens.Del;
      return (
        <del className="line-through text-muted-foreground">
          <InlineTokensRenderer tokens={del.tokens} fallbackText={del.text} />
        </del>
      );
    }

    case "br":
      return <br />;

    case "escape":
      return <span>{(token as any).text}</span>;

    default:
      if ("text" in token && typeof (token as any).text === "string") {
        return <span>{(token as any).text}</span>;
      }
      return null;
  }
}

// ---------------------------------------------------------------------------
// HTML escape fallback
// ---------------------------------------------------------------------------
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
