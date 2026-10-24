import assert from "node:assert/strict";
import { test } from "node:test";
import { createParser } from "@openuidev/lang-core";
import {
  assistantResponseToText,
  shiftIntelligenceUiState,
  splitAssistantResponse,
  uiProgramToText,
  updateIntelligenceUiState,
} from "./protocol";
import { normalizeUiMessages } from "../../lib/conversation-store";
import { definitions, intelligenceSchema } from "./schema";
import { INTELLIGENCE_UI_PROMPT } from "./prompt";
import {
  compareTableValues,
  formatFormSubmission,
  serializeTableCsv,
  serializeTableTsv,
} from "./format";

const program =
  'root = Stack([metric, changes])\nmetric = Metric("Files changed", "3", "Inspected diff")\nchanges = Table("Changes", ["File", "Purpose"], [["chat.tsx", "Rendering"], ["agent.ts", "Prompt"]])';
const fenced = (value: string) => `\`\`\`openui-lang\n${value}\n\`\`\``;

test("ordinary Markdown, code, and legacy messages pass through unchanged", () => {
  const content =
    '# Answer\n\n| File | Status |\n|---|---|\n| App.tsx | Done |\n\n```tsx\nconst x = "openui-lang";\n```';
  const parts = splitAssistantResponse(content);
  assert.equal(parts.length, 1);
  assert.equal(parts[0]?.content, content);
  assert.equal(parts[0]?.kind, "markdown");
});

test("mixed prose and multiple UI blocks preserve their order", () => {
  const parts = splitAssistantResponse(
    `Before\n\n${fenced(program)}\n\nBetween\n\n${fenced('root = Stack([Text("Second")])')}\n\nAfter`,
  );
  assert.deepEqual(
    parts.map((part) => part.kind),
    ["markdown", "ui", "markdown", "ui", "markdown"],
  );
  assert.ok(parts.every((part) => part.complete));
});

test("OpenUI examples inside longer Markdown fences remain code", () => {
  const content = `Here is the syntax:\n\n\`\`\`\`markdown\n${fenced(program)}\n\`\`\`\``;
  const parts = splitAssistantResponse(content);
  assert.equal(parts.length, 1);
  assert.equal(parts[0]?.content, content);
});

test("streamed UI has a stable identity before and after its closing fence", () => {
  const partial = splitAssistantResponse(
    `Intro\n\n\`\`\`openui-lang\n${program.slice(0, 60)}`,
    true,
  );
  const complete = splitAssistantResponse(`Intro\n\n${fenced(program)}`, false);
  assert.equal(partial[1]?.kind, "ui");
  assert.equal(partial[1]?.complete, false);
  assert.equal(partial[1]?.id, complete[1]?.id);
  assert.equal(complete[1]?.complete, true);
});

test("partial language markers do not flash as assistant prose", () => {
  const parts = splitAssistantResponse("Intro\n\n```openui-la", true);
  assert.equal(parts.map((part) => part.content).join(""), "Intro\n\n");
  assert.equal(
    parts[0]?.id,
    splitAssistantResponse(`Intro\n\n${fenced(program)}`)[0]?.id,
  );
});

test("CRLF and tilde fences work without accepting a shorter closing fence", () => {
  const parts = splitAssistantResponse(
    `~~~~openui-lang\r\n${program}\r\n~~~\r\n~~~~\r\n`,
  );
  assert.equal(parts.length, 1);
  assert.equal(parts[0]?.kind, "ui");
  assert.equal(parts[0]?.complete, true);
  assert.ok(parts[0]?.content.includes("~~~"));
});

test("cancelled, unclosed blocks remain explicitly incomplete", () => {
  const parts = splitAssistantResponse(`\`\`\`openui-lang\n${program}`);
  assert.equal(parts[0]?.complete, false);
});

test("registered components resolve through the real OpenUI parser", () => {
  const parser = createParser(
    intelligenceSchema.toJSONSchema(),
    intelligenceSchema.root,
  );
  const result = parser.parse(program);
  assert.equal(result.root?.typeName, "Stack");
  assert.deepEqual(result.meta.errors, []);
  assert.deepEqual(result.meta.unresolved, []);
});

test("copy and side-to-main projection include table values, not OpenUI source", () => {
  const text = assistantResponseToText(
    `Inspected changes:\n\n${fenced(program)}\n\nReady.`,
  );
  assert.ok(text.includes("Files changed: 3"));
  assert.ok(text.includes("chat.tsx\tRendering"));
  assert.ok(text.endsWith("Ready."));
  assert.ok(!text.includes("root ="));
  assert.ok(!text.includes("openui-lang"));
});

test("empty or invalid programs do not throw and retain inspectable source", () => {
  assert.equal(uiProgramToText(""), "");
  assert.equal(uiProgramToText("not a UI program"), "not a UI program");
});

test("unknown components produce validation errors instead of arbitrary execution", () => {
  const parser = createParser(
    intelligenceSchema.toJSONSchema(),
    intelligenceSchema.root,
  );
  const result = parser.parse(
    'root = Stack([unsafe])\nunsafe = Execute("rm -rf")',
  );
  assert.ok(
    result.meta.errors.some((error) => error.code === "unknown-component"),
  );
  assert.equal(
    Object.keys(intelligenceSchema.toJSONSchema().functions || {}).length,
    0,
  );
  assert.equal(
    Object.keys(intelligenceSchema.toJSONSchema().actions || {}).length,
    0,
  );
});

test("component schemas bound chart values and reject invalid form types", () => {
  assert.equal(
    definitions.BarChart.props.safeParse({
      title: "Chart",
      items: [{ label: "a", value: Infinity }],
    }).success,
    false,
  );
  assert.equal(
    definitions.Form.props.safeParse({
      name: "form",
      title: "Form",
      fields: [{ name: "secret", label: "Secret", type: "password" }],
      submitLabel: "Go",
    }).success,
    false,
  );
});

test("message state is isolated by message and block and survives JSON persistence", () => {
  const messages = [{ id: "main-message" }, { id: "side-message" }];
  let updated = updateIntelligenceUiState(messages, "side-message", "ui-20", {
    choices: { scope: "Both chats" },
  });
  updated = updateIntelligenceUiState(updated, "side-message", "ui-80", {
    other: true,
  });
  const restored = JSON.parse(JSON.stringify(updated));
  assert.deepEqual(restored[0], messages[0]);
  assert.deepEqual(restored[1].intelligenceUiState["ui-20"], {
    choices: { scope: "Both chats" },
  });
  assert.deepEqual(restored[1].intelligenceUiState["ui-80"], { other: true });
  assert.deepEqual(messages[1], { id: "side-message" });
});

test("the agent prompt derives from the same allowed component contracts", () => {
  for (const name of Object.keys(definitions))
    assert.ok(INTELLIGENCE_UI_PROMPT.includes(`${name}(`));
  assert.ok(INTELLIGENCE_UI_PROMPT.includes("openui-lang"));
  assert.ok(INTELLIGENCE_UI_PROMPT.includes("permission flow"));
});

test("history normalization retains form state when assistant and tool turns merge", () => {
  const prefix = "Tool analysis";
  const normalized = normalizeUiMessages([
    { id: "analysis", role: "assistant", content: prefix },
    { role: "tool", tool_call_id: "call1", name: "read", content: "File read" },
    {
      id: "response",
      role: "assistant",
      content: fenced(program),
      intelligenceUiState: { "ui-0": { preferences: { scope: "Both chats" } } },
    },
  ]);
  const block = splitAssistantResponse(normalized[0].content).find(
    (part) => part.kind === "ui",
  )!;
  assert.deepEqual(normalized[0].intelligenceUiState[block.id], {
    preferences: { scope: "Both chats" },
  });
  assert.deepEqual(shiftIntelligenceUiState(undefined, 5), {});
});

test("form submission uses visible labels and localized boolean values without runtime metadata", () => {
  assert.equal(
    formatFormSubmission(
      "Pilihan",
      [
        { label: "Cakupan", value: "Kedua chat" },
        { label: "Jumlah", value: 0 },
        { label: "Aktif", value: false },
        { label: "Catatan", value: "" },
      ],
      { yes: "Ya", no: "Tidak" },
    ),
    "Pilihan\n\nCakupan: Kedua chat\nJumlah: 0\nAktif: Tidak",
  );
});

test("numeric table sorting handles negative values and decimals correctly", () => {
  const values = ["120", "-2", "12", "-30", "0", "1.5"];
  const collator = new Intl.Collator("en", { numeric: true });
  assert.deepEqual(
    values.sort((a, b) => compareTableValues(a, b, collator)),
    ["-30", "-2", "0", "1.5", "12", "120"],
  );
});

test("spreadsheet export preserves signed numbers and escapes formulas and quoted cells", () => {
  assert.equal(
    serializeTableCsv(["Value"], [["-30"], ["+12.5"], ["=1+1"], ['a,"b"']]),
    '"Value"\r\n"-30"\r\n"+12.5"\r\n"\'=1+1"\r\n"a,""b"""',
  );
  assert.equal(
    serializeTableTsv(["Value"], [["-30"], ["=1+1"], ["line\nbreak"]]),
    "Value\n-30\n'=1+1\nline break",
  );
});
