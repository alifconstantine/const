import assert from "node:assert/strict";
import { test } from "node:test";
import { createResponseMarkdown, responseSections } from "./markdown-parser";

const parser = createResponseMarkdown(mention => `<a class="badge" href="${mention.href}">${mention.title}</a>`);

test("mentions and legacy links never change fenced or indented source code", () => {
  const source = 'const example = "@[Report](outputs/report.html)";\n// @src/index.ts [File](file:///tmp/file.ts)';
  for (const markdown of ["```ts\n" + source + "\n```", "~~~ts\n" + source + "\n~~~", source.split("\n").map(line => "    " + line).join("\n")]) {
    const token = parser.lexer(markdown)[0]!;
    assert.equal(token.type, "code");
    assert.equal(token.text, source);
  }
});

test("inline code and code nested in emphasis remain literal while authored mentions work", () => {
  const literal = parser.parseInline('**Use `@[Report](outputs/report.html)` and `@src/index.ts`**') as string;
  assert.ok(!literal.includes('class="badge"'));
  assert.ok(literal.includes('<code>@[Report](outputs/report.html)</code>'));
  const mention = parser.parseInline('@[Report](outputs/report.html) and @[docs/brief.md]') as string;
  assert.ok(mention.includes('href="workspace:///outputs/report.html"'));
  assert.ok(mention.includes('href="workspace:///docs/brief.md"'));
});

test("relative Markdown links get a canonical workspace href without changing their labels", () => {
  const html = parser.parseInline('[Open **result**](outputs/result.html)') as string;
  assert.equal(html, '<a href="workspace:///outputs/result.html">Open <strong>result</strong></a>');
});

test("blockquote children preserve their lists and code blocks", () => {
  const quote = parser.lexer('> - First\n> - Second\n>\n> ```js\n> const x = "@[file]";\n> ```')[0]!;
  assert.equal(quote.type, "blockquote");
  assert.equal(quote.tokens![0]!.type, "list");
  assert.ok(quote.tokens!.some(token => token.type === "code" && token.text === 'const x = "@[file]";'));
});

test("only implementation details collapse and verification stays outside, in all supported languages", () => {
  for (const title of ["Implementation details", "Detail implementasi", "Detalles de implementación", "実装の詳細", "实现细节"]) {
    const tokens = parser.lexer(`Result ready.\n\n## ${title}\n\nTechnical text.\n\n### Nested\n\nMore detail.\n\n## Verification\n\nPassed.`);
    const sections = responseSections(tokens, false);
    const details = sections.find(section => section.kind === "details")!;
    assert.equal(details.kind, "details");
    if (details.kind === "details") assert.ok(!details.tokens.some(token => token.type === "heading" && token.text === "Verification"));
    assert.ok(sections.some(section => section.kind === "block" && section.token.type === "heading" && section.token.text === "Verification"));
    assert.ok(responseSections(tokens, true).every(section => section.kind === "block"));
  }
});
