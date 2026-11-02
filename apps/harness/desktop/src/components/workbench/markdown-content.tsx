import React, { useEffect, useMemo, useRef, useState } from "react";
import { type Token, type Tokens } from "marked";
import { createResponseMarkdown, responseSections } from "./markdown-parser";
import { highlightCodeToHtmlLines, escapeHtml } from "../../lib/code-highlighter";
import { isPlainInlineText, sanitizeInlineMarkdown, sanitizeHighlightedCode } from "../../lib/safe-markdown";
import { Check, Copy, ChevronDown } from "lucide-react";
import { cn, ScrollArea, toast } from "@const/ui";
import { ResponseTable } from "../intelligence-ui/response-table";
import { FileIcon } from "./file-icon";
import { renderMentionBadgeHtml } from "./rich-mention-editor";
import { useTranslation } from "../../lib/i18n";
import { resolveMarkdownLink, type ResolvedMarkdownLink } from "./markdown-links";

const MermaidBlock = React.lazy(() => import("./mermaid-block").then(module => ({ default: module.MermaidBlock })));

export { resolveMarkdownLink, type ResolvedMarkdownLink };

interface MarkdownContentProps {
  content: string;
  className?: string;
  onOpenFilePreview?: (filePath: string) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  onOpenBrowser?: (url: string) => void;
  variant?: "default" | "user";
  isStreaming?: boolean;
}

const responseMarkdown = createResponseMarkdown(renderMentionBadgeHtml);

export function MarkdownContent({
  content,
  className = "",
  onOpenFilePreview,
  onOpenTrajectory,
  onOpenBrowser,
  variant = "default",
  isStreaming = false,
}: MarkdownContentProps) {
  // Layout changes and panel controls must not reparse the entire transcript.
  const tokens = useMemo(() => responseMarkdown.lexer(content), [content]);
  const sections = useMemo(() => responseSections(tokens, isStreaming || variant === "user"), [tokens, isStreaming, variant]);
  if (!content) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;

    const href = target.getAttribute("href") || "";
    const resolved = resolveMarkdownLink(href);

    if (resolved.type === "plugin") {
      e.preventDefault();
      return;
    }

    if (resolved.type === "external") {
      e.preventDefault();
      if (window.electron?.openExternal) {
        window.electron.openExternal(resolved.url);
      } else {
        window.open(resolved.url);
      }
      return;
    }

    if (resolved.type === "web") {
      e.preventDefault();
      e.stopPropagation();

      if (onOpenBrowser) {
        onOpenBrowser(resolved.url);
      } else {
        window.dispatchEvent(
          new CustomEvent("const:open-browser-tab", {
            detail: { url: resolved.url },
          })
        );
      }
      return;
    }

    if (resolved.type === "trajectory") {
      e.preventDefault();
      onOpenTrajectory?.(resolved.idOrPath);
      return;
    }

    if (resolved.type === "folder") {
      e.preventDefault();
      onOpenFilePreview?.(resolved.path);
      return;
    }

    if (resolved.type === "file") {
      e.preventDefault();
      onOpenFilePreview?.(resolved.path);
      return;
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "cursor-text select-text",
        variant === "user"
          ? "space-y-1.5 text-[13.5px] leading-relaxed text-[#262626] dark:text-white font-sans [&_strong]:font-medium [&_b]:font-medium [&_strong]:text-[#161616] dark:[&_strong]:text-white [&_b]:text-[#161616] dark:[&_b]:text-white"
          : "space-y-3 text-[14px] leading-[1.68] text-[#262626] dark:text-white font-sans [&_strong]:font-medium [&_b]:font-medium [&_strong]:text-[#161616] dark:[&_strong]:text-[#ececec] [&_b]:text-[#161616] dark:[&_b]:text-[#ececec]",
        className
      )}
    >
      {sections.map((section, index) => section.kind === "details" ? (
        <details key={index} data-response-details className="group/details">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl bg-black/[0.025] px-3 py-2 text-sm font-medium outline-none focus-visible:ring-1 focus-visible:ring-[#969696] dark:bg-white/[0.025] [&::-webkit-details-marker]:hidden">
            <span className="flex-1"><InlineRenderer text={section.heading.text} /></span>
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-[#969696] transition-transform group-open/details:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="space-y-3 pb-1 pt-2">{section.tokens.map((token, child) => <TokenRenderer key={child} token={token} variant={variant} />)}</div>
        </details>
      ) : <TokenRenderer key={index} token={section.token} variant={variant} isStreaming={isStreaming} />)}
    </div>
  );
}

const TokenRenderer = React.memo(function TokenRenderer({
  token,
  isNested,
  variant = "default",
  isStreaming = false,
}: {
  token: Token;
  isNested?: boolean;
  variant?: "default" | "user";
  isStreaming?: boolean;
}) {
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      const Tag = `h${Math.min(heading.depth, 6)}` as keyof React.JSX.IntrinsicElements;
      const sizeClasses =
        heading.depth === 1
          ? "text-[19px] font-medium text-[#161616] dark:text-white mt-5 mb-2 tracking-tight"
          : heading.depth === 2
          ? "text-[16px] font-medium text-[#161616] dark:text-white mt-4.5 mb-1.5 tracking-tight"
          : heading.depth === 3
          ? "text-[14.5px] font-medium text-[#161616] dark:text-white mt-3.5 mb-1 tracking-tight"
          : "text-[13.5px] font-medium text-[#262626] dark:text-white mt-3 mb-1";
      return (
        <Tag className={`${sizeClasses} font-sans cursor-text select-text`}>
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
              ? "leading-relaxed text-[#262626] dark:text-white m-0 font-sans"
              : "leading-[1.68] text-[#262626] dark:text-white my-1.5 last:mb-0 font-sans",
            "cursor-text select-text"
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
      const lang = (code.lang || "text").toLowerCase().trim().split(/[\s:{]/)[0] || "";
      if (lang === "mermaid") {
        return <React.Suspense fallback={<pre className="whitespace-pre-wrap">{code.text}</pre>}><MermaidBlock code={code.text} isStreaming={isStreaming} /></React.Suspense>;
      }
      return <CodeBlock code={code.text} language={code.lang || "text"} />;
    }

    case "list": {
      const list = token as Tokens.List;
      if (list.ordered) {
        const start = list.start || 1;
        return (
          <ol start={Number(start)} className={cn("space-y-2 my-2.5 last:mb-0 pl-0.5 text-[#262626] dark:text-white cursor-text select-text", isNested && "my-1.5 pl-2 space-y-1.5")}>
            {list.items.map((item: Tokens.ListItem, idx: number) => (
              <li key={idx} className="flex items-start gap-2.5 leading-[1.65] cursor-text select-text">
                <span aria-hidden="true" className="select-none font-sans tabular-nums text-[12px] text-[#888888] dark:text-[#777777] pt-0.5 w-4 text-right shrink-0">
                  {start + idx}.
                </span>
                <div className="flex-1 min-w-0 cursor-text select-text">
                  <ListItemContent item={item} isStreaming={isStreaming} />
                </div>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className={cn("space-y-2 my-2.5 last:mb-0 pl-0.5 text-[#262626] dark:text-white cursor-text select-text", isNested && "my-1.5 pl-3 space-y-1.5")}>
          {list.items.map((item: Tokens.ListItem, idx: number) => (
            <li key={idx} className="flex items-start gap-2 leading-[1.65] cursor-text select-text">
              {item.task ? (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  aria-label={item.text}
                  className="mt-1 mr-0.5 rounded accent-[#969696] shrink-0 pointer-events-none"
                />
              ) : (
                <span className={cn(
                  "select-none text-[#888888] dark:text-[#737373] shrink-0 font-medium",
                  isNested ? "text-[13px] leading-[1.65]" : "text-[15px] leading-[1.6]"
                )}>
                  {isNested ? "-" : "•"}
                </span>
              )}
              <div className="flex-1 min-w-0 cursor-text select-text">
                <ListItemContent item={item} isStreaming={isStreaming} />
              </div>
            </li>
          ))}
        </ul>
      );
    }

    case "blockquote": {
      const bq = token as Tokens.Blockquote;
      return (
        <blockquote className="space-y-2 rounded-xl bg-black/[0.035] px-4 py-2.5 my-3 last:mb-0 text-[#262626] dark:bg-white/[0.035] dark:text-white cursor-text select-text">
          {bq.tokens.map((child, index) => <TokenRenderer key={index} token={child} variant={variant} isStreaming={isStreaming} />)}
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
          <p className="leading-[1.68] text-[#262626] dark:text-white my-1.5 last:mb-0 font-sans cursor-text select-text">
            <InlineRenderer text={(token as any).text} />
          </p>
        );
      }
      return null;
    }
  }
});

function ListItemContent({
  item,
  isStreaming = false,
}: {
  item: Tokens.ListItem;
  isStreaming?: boolean;
}) {
  if (!item.tokens || item.tokens.length === 0) {
    return <InlineRenderer text={item.text} />;
  }

  // If there's only 1 text token, render directly without wrapper div
  if (item.tokens.length === 1 && item.tokens[0]?.type === "text") {
    return <InlineRenderer text={item.tokens[0].text} />;
  }

  return (
    <div className="space-y-1.5 cursor-text select-text">
      {item.tokens.map((childToken, cIdx) => {
        if (childToken.type === "text") {
          return (
            <div key={cIdx} className="leading-[1.65] cursor-text select-text">
              <InlineRenderer text={childToken.text} />
            </div>
          );
        }
        if (childToken.type === "paragraph") {
          return (
            <div key={cIdx} className="leading-[1.65] my-0.5 cursor-text select-text">
              <InlineRenderer text={(childToken as Tokens.Paragraph).text} />
            </div>
          );
        }
        if (childToken.type === "list") {
          return (
            <div key={cIdx} className="mt-1 cursor-text select-text">
              <TokenRenderer token={childToken} isNested isStreaming={isStreaming} />
            </div>
          );
        }
        return <TokenRenderer key={cIdx} token={childToken} isNested isStreaming={isStreaming} />;
      })}
    </div>
  );
}

function TableBlock({ header, rows, align }: { header: Tokens.TableCell[]; rows: Tokens.TableCell[][]; align: Array<"center" | "left" | "right" | null> }) {
  return <ResponseTable columns={header.map((cell) => cell.text)} rows={rows.map((row) => row.map((cell) => cell.text))} align={align} renderCell={(value) => <InlineRenderer text={value} />} />;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const highlighted = useMemo(() => {
    if (code.length > 100_000) return escapeHtml(code);
    const aliases: Record<string, string> = { javascript: "js", typescript: "ts", python: "py", shell: "sh", plaintext: "text" };
    const tag = language.toLowerCase().split(/[\s:{]/)[0] || "text";
    return sanitizeHighlightedCode(highlightCodeToHtmlLines(code, aliases[tag] || tag).join("\n"), code);
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common.failedToCopy"));
    }
  };

  return (
    <div data-response-code-block className="rounded-xl overflow-hidden bg-[#f4f4f6] dark:bg-[#181818] border border-[#e2e2e4] dark:border-[#2e2e2e] my-3 select-none">
      {/* Code Header Strip */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#eaeaea] dark:bg-[#202020] text-xs">
        <div className="flex items-center gap-1.5">
          <FileIcon filename={language} className="w-3.5 h-3.5" />
          <span className="font-sans text-xs text-[#666666] dark:text-[#969696] lowercase">
            {language}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="response-code-copy flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs text-[#666666] hover:bg-black/5 dark:text-[#969696] dark:hover:bg-white/5 outline-none focus-visible:ring-1 focus-visible:ring-[#969696]"
          title={t("workbench.copyCode")}
          aria-label={t("workbench.copyCode")}
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
      <ScrollArea orientation="horizontal" className="bg-[#181818]" thumbClassName="bg-white/20 hover:bg-white/30">
      <pre className="p-3.5 text-[13px] leading-6 font-mono text-white select-text">
        <code data-response-code data-language={language} dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
      </ScrollArea>
    </div>
  );
}

const InlineRenderer = React.memo(function InlineRenderer({ text }: { text: string }) {
  // Parse inline markdown: bold, italic, inline code, links
  const html = useMemo(() => {
    if (isPlainInlineText(text)) return null;
    const parsed = responseMarkdown.parseInline(text);
    return typeof parsed === "string" ? sanitizeInlineMarkdown(parsed) : null;
  }, [text]);
  if (typeof html === "string") {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: html }}
        className="cursor-text select-text [&_code]:bg-[#eaeaea] dark:[&_code]:bg-[#242424] [&_code]:text-[#161616] dark:[&_code]:text-[#e0e0e0] [&_code]:font-mono [&_code]:text-[13px] [&_code]:px-1 [&_code]:py-px [&_code]:rounded [&_strong]:font-medium [&_b]:font-medium [&_strong]:text-[#161616] dark:[&_strong]:text-[#ececec] [&_em]:italic [&_em]:text-[#262626] dark:[&_em]:text-[#d4d4d4] [&_a]:cursor-pointer [&_a:not(.inline-mention-badge)]:text-[#2563eb] dark:[&_a:not(.inline-mention-badge)]:text-[#60a5fa] [&_a:not(.inline-mention-badge)]:hover:underline [&_a:not(.inline-mention-badge)]:font-medium"
      />
    );
  }
  return <span className="cursor-text select-text">{text}</span>;
});
