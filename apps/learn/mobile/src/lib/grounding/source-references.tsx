import React from "react";
import { FileText, Globe, BookOpen, ExternalLink, ClipboardPaste } from "lucide-react";
import type { LocalSource } from "../db";
import { YouTubeSvgIcon } from "../../components/workspace/source-icon";

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

export function normalizeSourceId(id: string): string {
  if (!id) return "";
  return id.replace(/^\[?source:/i, "").replace(/^source_/i, "").replace(/\]$/, "").trim();
}

/**
 * Convert [source:id] references in markdown to compact numbered badges [1], [2]
 * with informative hover tooltips and hashtag links, matching NotebookLM and Open-Notebook.
 */
export function convertReferencesToMarkdownLinks(
  text: string,
  sourcesMap?: Map<string, { title: string; type?: string }>
): string {
  if (!text) return text;

  // Regex to detect [source:id], [Source: id], [sumber: id], [source_id], or (source: id)
  // Supports backslash-escaped brackets and underscores, e.g. \[source:source\_123\]
  const pattern =
    /(?:\\?\[\\?\[?(?:source|sumber):\s*([a-zA-Z0-9_\\\-]+)\\?\]?\\?\]|\\?\[(source_[a-zA-Z0-9_\\\-]+)\\?\]|\((?:source|sumber):\s*([a-zA-Z0-9_\\\-]+)\)|(?:source|sumber):\s*([a-zA-Z0-9_\\\-]+))/gi;

  // Regex to match and normalize existing raw markdown links: e.g. [1](#ref-source-abc), \[1\](#ref-abc), [1](#ref-...)
  const markdownLinkPattern =
    /\\?\[(\d+)\\?\]\(#ref-(?:source-)?([^\s")]+)(?:\s*(?:"|&quot;)(.*?)(?:"|&quot;))?\)/gi;

  // Regex to match and normalize legacy raw HTML citation badges (e.g. from previously saved messages)
  const legacyHtmlPattern =
    /<a\s+[^>]*href="#ref-(?:source-)?([^"]+)"[^>]*>(?:.*?)<\/a>/gi;

  const getCleanKey = (rawId: string) =>
    rawId
      .replace(/\\_/g, "_")
      .replace(/^source_/, "")
      .replace(/^source:/i, "")
      .replace(/^sumber:/i, "")
      .replace(/\\/g, "")
      .trim();

  // Pre-pass: Map each unique source to an incremental citation number [1], [2], [3]
  const sourceNumberMap = new Map<string, number>();
  let nextNumber = 1;

  let scanMatch: RegExpExecArray | null;
  const tempText = text;
  while ((scanMatch = pattern.exec(tempText)) !== null) {
    const rawId = scanMatch[1] || scanMatch[2] || scanMatch[3] || scanMatch[4];
    if (!rawId) continue;
    const cleanKey = getCleanKey(rawId);
    if (!sourceNumberMap.has(cleanKey)) {
      sourceNumberMap.set(cleanKey, nextNumber++);
    }
  }

  markdownLinkPattern.lastIndex = 0;
  while ((scanMatch = markdownLinkPattern.exec(tempText)) !== null) {
    const rawId = scanMatch[2];
    if (!rawId) continue;
    const cleanKey = getCleanKey(rawId);
    if (!sourceNumberMap.has(cleanKey)) {
      sourceNumberMap.set(cleanKey, nextNumber++);
    }
  }

  legacyHtmlPattern.lastIndex = 0;
  while ((scanMatch = legacyHtmlPattern.exec(tempText)) !== null) {
    const rawId = scanMatch[1];
    if (!rawId) continue;
    const cleanKey = getCleanKey(rawId);
    if (!sourceNumberMap.has(cleanKey)) {
      sourceNumberMap.set(cleanKey, nextNumber++);
    }
  }

  // Reset pattern indices
  pattern.lastIndex = 0;
  markdownLinkPattern.lastIndex = 0;
  legacyHtmlPattern.lastIndex = 0;

  const renderBadge = (cleanKey: string, num: number | string, tooltip?: string) => {
    const cleanTooltip = (tooltip || `Sumber #${num}`)
      .replace(/\|/g, "—")
      .replace(/"/g, "&quot;")
      .replace(/[\r\n]+/g, " ");
    return `<a href="#ref-source-${cleanKey}" class="source-ref-badge" data-source-id="${cleanKey}" data-source-number="${num}" title="${cleanTooltip}">${num}</a>`;
  };

  // Replace each reference with compact numbered citation badge:
  let result = text.replace(pattern, (_fullMatch, id1, id2, id3, id4) => {
    const rawId = id1 || id2 || id3 || id4;
    const cleanKey = getCleanKey(rawId);
    const num = sourceNumberMap.get(cleanKey) || 1;

    const matchedSource =
      sourcesMap?.get(rawId) ||
      sourcesMap?.get(cleanKey) ||
      sourcesMap?.get(`source_${cleanKey}`) ||
      sourcesMap?.get(`source:${rawId}`) ||
      sourcesMap?.get(`source:${cleanKey}`);

    const rawTitle = matchedSource?.title || `Sumber #${num}`;
    const cleanTitle = rawTitle.replace(/\|/g, "—");
    const cleanTooltip = `${cleanTitle} (Sumber ${num})`;

    return renderBadge(cleanKey, num, cleanTooltip);
  });

  // Replace existing markdown links e.g. [1](#ref-source-abc) or \[1\](#ref-abc)
  result = result.replace(markdownLinkPattern, (_fullMatch, numStr, rawId, title) => {
    const cleanKey = getCleanKey(rawId);
    const num = parseInt(numStr, 10) || sourceNumberMap.get(cleanKey) || 1;

    const matchedSource =
      sourcesMap?.get(cleanKey) ||
      sourcesMap?.get(`source_${cleanKey}`) ||
      sourcesMap?.get(`source:${cleanKey}`);

    const rawTitle = title || matchedSource?.title || `Sumber #${num}`;
    const cleanTitle = rawTitle.replace(/\|/g, "—");
    const cleanTooltip = `${cleanTitle} (Sumber ${num})`;

    return renderBadge(cleanKey, num, cleanTooltip);
  });

  // Also normalize legacy HTML citation badges
  result = result.replace(legacyHtmlPattern, (_fullMatch, id) => {
    const cleanKey = getCleanKey(id);
    const num = sourceNumberMap.get(cleanKey) || 1;

    const matchedSource =
      sourcesMap?.get(cleanKey) ||
      sourcesMap?.get(`source_${cleanKey}`) ||
      sourcesMap?.get(`source:${cleanKey}`);

    const rawTitle = matchedSource?.title || `Sumber #${num}`;
    const cleanTitle = rawTitle.replace(/\|/g, "—");
    const cleanTooltip = `${cleanTitle} (Sumber ${num})`;

    return renderBadge(cleanKey, num, cleanTooltip);
  });

  return result;
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
    if (href && (href.startsWith("#ref-source-") || href.startsWith("#ref-"))) {
      const sourceId = href.replace(/^#ref-(?:source-)?/, "");
      return (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReferenceClick(sourceId);
          }}
          className="inline-flex items-center justify-center w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full bg-secondary hover:bg-secondary/80 border border-border text-muted-foreground hover:text-foreground text-[10px] font-medium transition-all cursor-pointer select-none active:scale-90 align-middle -translate-y-[1px] mx-0.5"
          title={`View source details (${sourceId})`}
        >
          {children}
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
      return <YouTubeSvgIcon className={className} />;
    case "book":
      return <BookOpen className={className} />;
    case "text":
      return <ClipboardPaste className={className} />;
    case "file":
    default:
      return <FileText className={className} />;
  }
}
