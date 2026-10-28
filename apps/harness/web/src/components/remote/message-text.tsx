"use client";
import type { ReactNode } from "react";

// Text is rendered as React nodes, never HTML from the remote computer.
function inline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g)
    .map((part, index) => {
      if (part.startsWith("`"))
        return (
          <code
            key={index}
            className="rounded bg-black/5 px-1 dark:bg-white/10"
          >
            {part.slice(1, -1)}
          </code>
        );
      if (part.startsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      if (link)
        return (
          <a
            key={index}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            {link[1]}
          </a>
        );
      return part;
    });
}
export function MessageText({ content }: { content: unknown }) {
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((block: any) => block?.text || "").join("\n")
        : "";
  return (
    <div className="space-y-3 break-words [overflow-wrap:anywhere] text-[14px] leading-7">
      {text.split(/(```[\s\S]*?(?:```|$))/g).map((block, index) => {
        if (block.startsWith("```"))
          return (
            <pre
              key={index}
              className="whitespace-pre-wrap rounded-xl bg-black/5 dark:bg-[#222222] p-4 text-xs leading-6"
            >
              <code>
                {block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}
              </code>
            </pre>
          );
        return (
          <p key={index} className="whitespace-pre-wrap">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}
