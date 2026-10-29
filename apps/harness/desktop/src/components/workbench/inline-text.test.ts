import assert from "node:assert/strict";
import test from "node:test";
import { marked } from "marked";
import { isPlainInlineText } from "../../lib/safe-markdown";

test("plain inline fast path agrees with the Markdown parser", () => {
  for (const text of ["Normal streaming text", "Bahasa Indonesia 日本語 中文", "1 + 2 = 3", "Wait... almost done!", "", "A pipe | remains plain"]) {
    assert.equal(isPlainInlineText(text), true, text);
    assert.equal(marked.parseInline(text, { gfm: true, breaks: true }), text);
  }
});

test("formatting, entities, HTML, escapes and GFM autolinks stay on the sanitized path", () => {
  for (const text of ["**bold**", "_italic_", "~~deleted~~", "`code`", "[link](https://example.com)", "<img src=x onerror=alert(1)>", "&amp;", "line\nnext", "escaped\\*star", "www.example.com", "https://example.com", "ftp://example.com", "name@example.com", "a < b", "a > b"]) {
    assert.equal(isPlainInlineText(text), false, text);
  }
});
