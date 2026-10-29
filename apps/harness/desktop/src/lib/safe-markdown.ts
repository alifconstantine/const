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
      /^(?:(?:https?|mailto|file|folder|trajectory):|\/(?!\/)|#)/i,
  });
}
