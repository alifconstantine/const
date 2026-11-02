import DOMPurify from "dompurify";

/** Plain text can use React's escaping without invoking the Markdown/DOM parsers. */
export function isPlainInlineText(text: string): boolean {
  // Includes HTML/entities, escapes, breaks, Markdown delimiters and GFM links/email.
  return !/[\\`*_[\]~<>&\r\n:@]|www\./i.test(text);
}

/** Model output and imported transcripts are untrusted in both desktop and web. */
export function sanitizeInlineMarkdown(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a",
      "span",
      "strong",
      "b",
      "em",
      "i",
      "del",
      "s",
      "code",
      "br",
      "kbd",
      "sub",
      "sup",
      "img",
    ],
    ALLOWED_ATTR: ["class", "href", "title", "src", "alt", "rel"],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|file|folder|workspace|trajectory|conversation|plugin|browser):|\/(?!\/)|#)/i,
  });
}

/** A highlighter may decorate source text; it must never change or execute it. */
export function sanitizeHighlightedCode(html: string, source: string): string {
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ["span"], ALLOWED_ATTR: ["class"], ALLOW_DATA_ATTR: false });
  const template = document.createElement("template");
  template.innerHTML = clean;
  if (template.content.textContent === source.replace(/\r\n/g, "\n")) return clean;
  return source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
