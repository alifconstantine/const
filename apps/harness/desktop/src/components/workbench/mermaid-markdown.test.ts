import assert from "node:assert/strict";
import test from "node:test";
import { marked, type Tokens } from "marked";
import { INTELLIGENCE_UI_PROMPT } from "../intelligence-ui/prompt";

test("marked lexer identifies mermaid code blocks correctly", () => {
  const content = `Here is a diagram:

\`\`\`mermaid
flowchart TD
  A[Start] --> B{Decide}
  B -->|Yes| C[Process]
  B -->|No| D[End]
\`\`\`

Prose continues.`;

  const tokens = marked.lexer(content);
  const codeToken = tokens.find((t) => t.type === "code") as Tokens.Code | undefined;

  assert.ok(codeToken, "Code token must exist");
  assert.equal(codeToken.lang, "mermaid");
  assert.ok(codeToken.text.includes("flowchart TD"));
});

test("marked lexer parses diverse diagram types", () => {
  const diagrams = [
    "sequenceDiagram\n  Alice->>Bob: Hello",
    "classDiagram\n  class Animal {\n    +String name\n  }",
    "stateDiagram-v2\n  [*] --> Still\n  Still --> [*]",
    "erDiagram\n  CUSTOMER ||--o{ ORDER : places",
    "gantt\n  title Project\n  section A : a1, 2026-01-01, 30d",
    "mindmap\n  root((Project))\n    Origin\n    Features",
  ];

  for (const def of diagrams) {
    const tokens = marked.lexer(`\`\`\`mermaid\n${def}\n\`\`\``);
    const codeToken = tokens[0] as Tokens.Code;
    assert.equal(codeToken.type, "code");
    assert.equal(codeToken.lang, "mermaid");
    assert.equal(codeToken.text, def);
  }
});

test("INTELLIGENCE_UI_PROMPT instructs the model to use mermaid for diagrams", () => {
  assert.ok(INTELLIGENCE_UI_PROMPT.includes("mermaid"));
  assert.ok(INTELLIGENCE_UI_PROMPT.includes("flowchart TD"));
  assert.ok(INTELLIGENCE_UI_PROMPT.includes("sequenceDiagram"));
});
