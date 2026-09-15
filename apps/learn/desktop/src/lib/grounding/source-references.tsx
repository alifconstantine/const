import React from "react";
import { FileText, Globe, BookOpen, Video, ExternalLink } from "lucide-react";
import type { LocalSource } from "../db";

export interface ParsedReference {
  id: string;
  originalText: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse source references from text, e.g. [source:source_123] or source:source_123
 */
export function parseSourceReferences(text: string): ParsedReference[] {
  const pattern = /\[?source:([a-zA-Z0-9_\-]+)\]?/g;
  const matches: ParsedReference[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      id: match[1]!,
      originalText: match[0],
      startIndex: match.index,
      endIndex: pattern.lastIndex,
    });
  }

  return matches;
}

/**
 * Convert [source:id] references in markdown to custom hashtag links
 * before passing into ReactMarkdown/marked:
 * e.g. [source:abc] -> [[source:abc]](#ref-source-abc)
 */
export function convertReferencesToMarkdownLinks(
  text: string,
  sourcesMap?: Map<string, { title: string }>
): string {
  if (!text) return text;

  const pattern = /\[source:([a-zA-Z0-9_\-]+)\]/g;
  return text.replace(pattern, (fullMatch, id) => {
    const matchedSource = sourcesMap?.get(id) || sourcesMap?.get(`source:${id}`);
    const label = matchedSource ? `📄 ${matchedSource.title}` : `[source:${id.slice(0, 8)}]`;
    return `<a href="#ref-source-${id}" class="source-ref-badge" data-source-id="${id}">${label}</a>`;
  });
}

/**
 * Custom Anchor Link component for ReactMarkdown / custom renderer
 * that intercepts #ref-source-{id} clicks.
 */
export function createReferenceLinkComponent(
  onReferenceClick: (sourceId: string) => void
) {
  const ReferenceLink = ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href?: string;
    children?: React.ReactNode;
  }) => {
    if (href?.startsWith("#ref-source-")) {
      const sourceId = href.replace("#ref-source-", "");
      return (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReferenceClick(sourceId);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-[11px] font-medium transition-all cursor-pointer select-none active:scale-95 group"
          title={`View source details (${sourceId})`}
        >
          <FileText className="h-3 w-3 inline text-primary/80 group-hover:text-primary" />
          <span className="truncate max-w-[160px]">{children}</span>
        </button>
      );
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline inline-flex items-center gap-0.5"
        {...props}
      >
        <span>{children}</span>
        <ExternalLink className="h-2.5 w-2.5 opacity-60 inline" />
      </a>
    );
  };

  ReferenceLink.displayName = "ReferenceLinkComponent";
  return ReferenceLink;
}

/**
 * Helper to get matching icon for source type
 */
export function getSourceTypeIcon(type: LocalSource["type"], className = "h-3.5 w-3.5") {
  switch (type) {
    case "url":
    case "docs":
      return <Globe className={className} />;
    case "youtube":
      return <Video className={className} />;
    case "book":
      return <BookOpen className={className} />;
    case "file":
    case "text":
    default:
      return <FileText className={className} />;
  }
}
