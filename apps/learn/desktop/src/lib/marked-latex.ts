import katex, { type KatexOptions } from "katex";
import type { MarkedExtension, Tokens } from "marked";

export interface MathToken extends Tokens.Generic {
  type: "blockMath" | "inlineMath";
  raw: string;
  text: string;
  displayMode: boolean;
}

/**
 * Safely render a LaTeX string into HTML using KaTeX.
 */
export function renderKatex(
  math: string,
  displayMode: boolean = false,
  options?: KatexOptions
): string {
  try {
    return katex.renderToString(math, {
      displayMode,
      throwOnError: false,
      output: "htmlAndMathml",
      ...options,
    });
  } catch {
    const escaped = math
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<span class="katex-error text-destructive font-mono text-xs" title="KaTeX parse error">${escaped}</span>`;
  }
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
          // Matches $$...$$ or \[...\] at block level
          const rule = /^(?:\${2}([\s\S]+?)\${2}|\\\[([\s\S]+?)\\\])(?:\n|$)/;
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
          return `<div class="katex-display-wrapper overflow-x-auto my-3 text-center">${renderKatex(
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

            // Ignore currency numbers: e.g. "$100", "$50.00", "$1,000"
            if (/^\d+(?:[.,]\d+)?$/.test(content.trim())) return;

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
