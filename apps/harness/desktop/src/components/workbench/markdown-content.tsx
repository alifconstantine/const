import React, { useState } from "react";
import { marked, type Token, type Tokens } from "marked";
import { Check, Copy } from "lucide-react";
import { cn, ScrollArea } from "@const/ui";
import { ResponseTable } from "../intelligence-ui/response-table";
import { MermaidBlock } from "./mermaid-block";
import { FileIcon } from "./file-icon";
import { renderMentionBadgeHtml } from "./rich-mention-editor";
import { useTranslation } from "../../lib/i18n";
import { resolveMarkdownLink, type ResolvedMarkdownLink } from "./markdown-links";

export { resolveMarkdownLink, type ResolvedMarkdownLink };

interface MarkdownContentProps {
  content: string;
  className?: string;
  onOpenFilePreview?: (filePath: string) => void;
  onOpenTrajectory?: (conversationIdOrPath: string) => void;
  onOpenBrowser?: (url: string) => void;
  variant?: "default" | "user";
}

export function MarkdownContent({
  content,
  className = "",
  onOpenFilePreview,
  onOpenTrajectory,
  onOpenBrowser,
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

    if (trimmedPath.startsWith("plugin://")) {
      kind = "plugin";
      href = trimmedPath;
    } else if (
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
        return <MermaidBlock code={code.text} />;
      }
      return <CodeBlock code={code.text} language={code.lang || "text"} />;
    }

    case "list": {
      const list = token as Tokens.List;
      if (list.ordered) {
        const start = list.start || 1;
        return (
          <ol className={cn("space-y-2 my-2.5 last:mb-0 pl-0.5 text-[#262626] dark:text-white cursor-text select-text", isNested && "my-1.5 pl-2 space-y-1.5")}>
            {list.items.map((item: Tokens.ListItem, idx: number) => (
              <li key={idx} className="flex items-start gap-2.5 leading-[1.65] cursor-text select-text">
                <span className="select-none font-sans tabular-nums text-[12px] text-[#888888] dark:text-[#777777] pt-0.5 w-4 text-right shrink-0">
                  {start + idx}.
                </span>
                <div className="flex-1 min-w-0 cursor-text select-text">
                  <ListItemContent item={item} />
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
              <div className="flex-1 min-w-0 cursor-text select-text">
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
        <blockquote className="border-l-2 border-[#b0b0b0] dark:border-[#383838] pl-3.5 py-1.5 my-2.5 last:mb-0 text-[#262626] dark:text-[#a8a8a8] bg-black/[0.03] dark:bg-white/[0.02] rounded-r-lg italic cursor-text select-text">
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
          <p className="leading-[1.68] text-[#262626] dark:text-white my-1.5 last:mb-0 font-sans cursor-text select-text">
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
              <TokenRenderer token={childToken} isNested />
            </div>
          );
        }
        return <TokenRenderer key={cIdx} token={childToken} isNested />;
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
      <ScrollArea orientation="horizontal" thumbClassName="bg-white/20 hover:bg-white/30">
      <pre className="p-3.5 text-[13px] leading-5 font-mono text-[#262626] dark:text-white select-text">
        <code>{code}</code>
      </pre>
      </ScrollArea>
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
        className="cursor-text select-text [&_code]:bg-[#eaeaea] dark:[&_code]:bg-[#242424] [&_code]:text-[#161616] dark:[&_code]:text-[#e0e0e0] [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-[#e2e2e4] dark:[&_code]:border-[#383838] [&_strong]:font-medium [&_b]:font-medium [&_strong]:text-[#161616] dark:[&_strong]:text-[#ececec] [&_em]:italic [&_em]:text-[#262626] dark:[&_em]:text-[#d4d4d4] [&_a]:cursor-pointer [&_a:not(.inline-mention-badge)]:text-[#2563eb] dark:[&_a:not(.inline-mention-badge)]:text-[#60a5fa] [&_a:not(.inline-mention-badge)]:hover:underline [&_a:not(.inline-mention-badge)]:font-medium"
      />
    );
  }
  return <span className="cursor-text select-text">{text}</span>;
}
