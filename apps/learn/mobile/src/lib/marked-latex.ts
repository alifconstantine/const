import katex, { type KatexOptions } from "katex";
import type { MarkedExtension, Tokens } from "marked";

export interface MathToken extends Tokens.Generic {
  type: "blockMath" | "inlineMath";
  raw: string;
  text: string;
  displayMode: boolean;
}

/**
 * Defensively extract citation tags and badges that may have been placed inside
 * LaTeX math mode (e.g. \text{[source:1]}, [source:id], or pre-rendered HTML badges).
 * KaTeX throws parse errors on raw HTML like `<a href...>` and brackets inside text mode.
 */
export function extractCitationsFromMath(rawMath: string): {
  cleaned: string;
  badges: string[];
} {
  if (!rawMath || typeof rawMath !== "string") {
    return { cleaned: "", badges: [] };
  }

  let cleaned = rawMath;
  const badges: string[] = [];

  // Match HTML citation badges: <a href="#ref-..." class="source-ref-badge" ...>...</a>
  const htmlBadgePattern = /(?:\\text\{)?(<a\s+[^>]*href="#ref-(?:source-)?(?:[^"]+)"[^>]*>.*?<\/a>)(?:\})?/gi;
  // Match markdown links: [1](#ref-source-...) or [1](#ref-...)
  const mdLinkPattern = /(?:\\text\{)?(\[(\d+)\]\(#ref-(?:source-)?(?:[^\s")]+)(?:\s*(?:"|&quot;)(?:.*?)(?:"|&quot;))?\))(?:\})?/gi;
  // Match source reference tags: [source:id], (source:id), [source_id]
  const sourcePattern = /(?:\\text\{)?(\[(?:source|sumber):([a-zA-Z0-9_\-]+)\]|\((?:source|sumber):([a-zA-Z0-9_\-]+)\)|\[(source_[a-zA-Z0-9_\-]+)\])(?:\})?/gi;

  cleaned = cleaned.replace(htmlBadgePattern, (_m, badge) => {
    badges.push(badge);
    return "";
  });

  cleaned = cleaned.replace(mdLinkPattern, (_m, link) => {
    badges.push(link);
    return "";
  });

  cleaned = cleaned.replace(sourcePattern, (_m, tag) => {
    badges.push(tag);
    return "";
  });

  cleaned = cleaned
    .replace(/\\text\{\s*\}/g, "")
    .replace(/(?:\\quad|\\qquad|\s)+\s*$/g, "")
    .trim();

  return { cleaned, badges };
}

/**
 * Safely render a LaTeX string into HTML using KaTeX.
 */
export function renderKatex(
  math: string,
  displayMode: boolean = false,
  options?: KatexOptions
): string {
  const { cleaned, badges } = extractCitationsFromMath(math);
  try {
    const rendered = katex.renderToString(cleaned, {
      displayMode,
      throwOnError: false,
      errorColor: "inherit",
      output: "htmlAndMathml",
      ...options,
    });
    if (badges.length > 0 && !displayMode) {
      return `${rendered} ${badges.join(" ")}`;
    }
    return rendered;
  } catch {
    const escaped = cleaned
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const badgeStr = badges.length > 0 ? ` ${badges.join(" ")}` : "";
    return `<span class="katex-fallback font-mono text-xs">${escaped}</span>${badgeStr}`;
  }
}

/**
 * Sanitize common LLM currency hallucination patterns and broken escapes:
 * e.g. "\1.60$", "$\1.60$", "\0.27$", "(\1.86$)" -> "$1.60", "$0.27", "($1.86)"
 * Note: Never rewrite standard digits followed by "$" (e.g. "$2 \times 2$" or "= 0 $$")
 * as that breaks valid math closing delimiters.
 */
export function sanitizeCurrencyAndMath(text: string): string {
  if (!text || typeof text !== "string") return text;
  
  // 1. Convert patterns like \1.60$ or $\1.60$ or \0.27$ or \1.86$ into $1.60, $0.27, $1.86
  let sanitized = text.replace(/(?:\\|\$)?\\(\d+(?:[.,]\d+)?)\$/g, "$$$1");

  // 2. Convert raw backslash currency like "\$1.60" into "$1.60"
  sanitized = sanitized.replace(/\\\$(\d+(?:[.,]\d+)?)/g, "$$$1");

  return sanitized;
}

/**
 * Marked extension that parses both block and inline LaTeX mathematics.
 *
 * Supports:
 * - Block math: `$$...$$` and `\[...\]`
 * - Inline math: `$..$` and `\(...\)`
 * - Ignores standard currency patterns like `$100` or `$50.00`.
 */
export function createMarkedLatexExtension(
  options?: KatexOptions
): MarkedExtension {
  return {
    extensions: [
      {
        name: "blockMath",
        level: "block",
        start(src: string) {
          const match = src.match(/(\${2}|\\\[)/);
          return match ? match.index : undefined;
        },
        tokenizer(src: string) {
          // Matches $$...$$ or \[...\] at block level (allows trailing spaces and line breaks)
          const rule = /^(?:\${2}([\s\S]+?)\${2}|\\\[([\s\S]+?)\\\])(?:\s*(?:\n|$)|$)/;
          const match = rule.exec(src);
          if (match) {
            const raw = match[0];
            const text = (match[1] ?? match[2] ?? "").trim();
            return {
              type: "blockMath",
              raw,
              text,
              displayMode: true,
            };
          }
        },
        renderer(token) {
          const mathToken = token as unknown as MathToken;
          return `<div class="katex-display-wrapper overflow-x-auto my-2.5 text-center">${renderKatex(
            mathToken.text,
            true,
            options
          )}</div>\n`;
        },
      },
      {
        name: "inlineMath",
        level: "inline",
        start(src: string) {
          const match = src.match(/(\${1,2}|\\\()/);
          return match ? match.index : undefined;
        },
        tokenizer(src: string) {
          // 1. Inline display math: $$...$$
          const doubleDollarRule = /^\${2}([\s\S]+?)\${2}/;
          const matchDouble = doubleDollarRule.exec(src);
          if (matchDouble) {
            return {
              type: "inlineMath",
              raw: matchDouble[0],
              text: (matchDouble[1] ?? "").trim(),
              displayMode: true,
            };
          }

          // 2. Parentheses math: \(...\)
          const parenRule = /^\\\(([\s\S]+?)\\\)/;
          const matchParen = parenRule.exec(src);
          if (matchParen) {
            return {
              type: "inlineMath",
              raw: matchParen[0],
              text: (matchParen[1] ?? "").trim(),
              displayMode: false,
            };
          }

          // 3. Single dollar math: $...$
          const singleDollarRule = /^\$([^\$\n\r]+?)\$/;
          const matchSingle = singleDollarRule.exec(src);
          if (matchSingle) {
            const content = matchSingle[1];
            if (!content) return;

            // Ignore if leading or trailing space (standard LaTeX convention, prevents false positives)
            if (/^\s/.test(content) || /\s$/.test(content)) return;

            // Ignore currency numbers: e.g. "$100", "$50.00", "$1,000", "\$100", "100$", "\1.60$"
            if (/^[\\\$]?\s*\d+(?:[.,]\d+)?\s*[\\\$]?$/.test(content.trim())) return;

            return {
              type: "inlineMath",
              raw: matchSingle[0],
              text: content.trim(),
              displayMode: false,
            };
          }
        },
        renderer(token) {
          const mathToken = token as unknown as MathToken;
          return renderKatex(mathToken.text, !!mathToken.displayMode, options);
        },
      },
    ],
  };
}
