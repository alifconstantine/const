import React, { useState } from "react";
import { marked, type Token, type Tokens } from "marked";
import { Check, Copy } from "lucide-react";

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
    <div className={`space-y-3 text-[14px] leading-relaxed text-[#d4d4d4] select-text font-sans ${className}`}>
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
          ? "text-xl font-semibold text-white mt-4 mb-2"
          : heading.depth === 2
          ? "text-lg font-semibold text-white mt-3 mb-1.5"
          : "text-base font-medium text-[#d4d4d4] mt-2 mb-1";
      return (
        <Tag className={`${sizeClasses} tracking-tight font-sans`}>
          <InlineRenderer text={heading.text} />
        </Tag>
      );
    }

    case "paragraph": {
      const paragraph = token as Tokens.Paragraph;
      return (
        <p className="leading-relaxed text-[#d4d4d4] my-1.5">
          <InlineRenderer text={paragraph.text} />
        </p>
      );
    }

    case "code": {
      const code = token as Tokens.Code;
      return <CodeBlock code={code.text} language={code.lang || "text"} />;
    }

    case "list": {
      const list = token as Tokens.List;
      if (list.ordered) {
        return (
          <ol className="list-decimal pl-5 space-y-1.5 my-2 text-[#d4d4d4]" start={list.start || 1}>
            {list.items.map((item: Tokens.ListItem, idx: number) => (
              <li key={idx} className="leading-relaxed pl-1">
                <InlineRenderer text={item.text} />
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="list-disc pl-5 space-y-1.5 my-2 text-[#d4d4d4]">
          {list.items.map((item: Tokens.ListItem, idx: number) => (
            <li key={idx} className="leading-relaxed pl-1">
              <InlineRenderer text={item.text} />
            </li>
          ))}
        </ul>
      );
    }

    case "blockquote": {
      const bq = token as Tokens.Blockquote;
      return (
        <blockquote className="border-l-2 border-[#ff7a00]/70 pl-3.5 py-1 my-2.5 text-[#a3a3a3] bg-white/[0.02] rounded-r-lg italic">
          <InlineRenderer text={bq.text} />
        </blockquote>
      );
    }

    case "hr":
      return <div className="h-[1px] bg-[#333333]/80 my-4" />;

    case "space":
      return null;

    default: {
      if ("text" in token && typeof (token as any).text === "string") {
        return (
          <p className="leading-relaxed text-[#d4d4d4] my-1">
            <InlineRenderer text={(token as any).text} />
          </p>
        );
      }
      return null;
    }
  }
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
    <div className="rounded-xl overflow-hidden bg-[#181818] border border-[#2e2e2e] my-3 select-none">
      {/* Code Header Strip */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#202020] border-b border-[#2e2e2e] text-xs">
        <span className="font-mono text-[11px] text-[#888888] lowercase">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-[#888888] hover:text-[#d4d4d4] transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-white/5"
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

      {/* Code Body */}
      <pre className="p-3.5 overflow-x-auto text-[13px] leading-5 font-mono text-[#d4d4d4] select-text">
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
        className="[&>code]:bg-[#242424] [&>code]:text-[#e0e0e0] [&>code]:font-mono [&>code]:text-[12px] [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:border [&>code]:border-[#383838] [&>strong]:font-semibold [&>strong]:text-white [&>a]:text-[#ff7a00] [&>a]:hover:underline"
      />
    );
  }
  return <span>{text}</span>;
}
