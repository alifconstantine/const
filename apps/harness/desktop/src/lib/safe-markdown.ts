import DOMPurify from "dompurify";

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
