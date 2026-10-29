import assert from "node:assert/strict";
import { test } from "node:test";
import { Script } from "node:vm";
import { sampleWidget, widgetFence } from "../../../tests/widget.fixture";
import {
  parseWidget,
  parseWidgetMessage,
  safeWidgetLink,
  widgetPreview,
} from "./widget-contract";
import { buildWidgetDocument } from "./widget-document";
import type { IntelligenceUiState } from "./schema";
import {
  assistantResponseToText,
  splitAssistantResponse,
  updateIntelligenceUiState,
  shiftIntelligenceUiState,
} from "./protocol";

test("widget framing preserves Markdown, multiple renderers and stable history identities", () => {
  const source = `Before\n\n${widgetFence}\n\n\`\`\`mermaid\nflowchart TD\nA-->B\n\`\`\`\nAfter`;
  const parts = splitAssistantResponse(source);
  assert.deepEqual(
    parts.map((part) => part.kind),
    ["markdown", "widget", "markdown"],
  );
  const partial = splitAssistantResponse(
    source.slice(0, source.indexOf("\n```\n\n```mermaid")),
    true,
  );
  assert.equal(partial[1]?.id, parts[1]?.id);
  assert.equal(partial[1]?.complete, false);
  const wrapped = splitAssistantResponse(
    `\`\`\`\`markdown\n${widgetFence}\n\`\`\`\``,
  );
  assert.equal(wrapped.length, 1);
  assert.equal(wrapped[0]?.kind, "markdown");
  assert.equal(
    splitAssistantResponse("Before\n```const-wid", true)[0]?.content,
    "Before\n",
  );
});

test("strict widget contract rejects malformed, oversized and unknown capabilities", () => {
  assert.ok(parseWidget(JSON.stringify(sampleWidget)));
  for (const patch of [
    { version: 2 },
    { libraries: ["electron"] },
    { extra: "tool" },
    { html: "x".repeat(100001) },
    { initialState: JSON.parse('{"__proto__":{}}') },
  ])
    assert.equal(
      parseWidget(JSON.stringify({ ...sampleWidget, ...patch })),
      null,
    );
  assert.equal(parseWidget('{"version":1'), null);
});

test("streaming preview requires complete CSS and HTML values and contains no runtime", () => {
  const source = JSON.stringify(sampleWidget);
  const prefix = source.slice(0, source.indexOf(',"js":'));
  const preview = widgetPreview(prefix);
  assert.ok(preview);
  assert.equal(
    widgetPreview(source.slice(0, source.indexOf(',"html":'))),
    null,
  );
  const html = buildWidgetDocument(preview, {
    channel: "test",
    nonce: "test-nonce",
    theme: "dark",
    preview: true,
  });
  assert.ok(html.includes("script-src &#39;none&#39;"));
  assert.ok(!html.includes('type="module"'));
  assert.ok(!html.includes("postMessage"));
  assert.ok(html.includes('<fieldset disabled aria-disabled="true"'));
});

test("bridge validates channel, message types, finite sizing, URLs and bounded state", () => {
  assert.equal(
    parseWidgetMessage({ channel: "other", type: "ready" }, "ours"),
    null,
  );
  assert.equal(
    parseWidgetMessage({ channel: "ours", type: "runTool" }, "ours"),
    null,
  );
  assert.equal(
    parseWidgetMessage(
      { channel: "ours", type: "resize", height: Infinity },
      "ours",
    ),
    null,
  );
  assert.deepEqual(
    parseWidgetMessage(
      { channel: "ours", type: "resize", height: 99999 },
      "ours",
    ),
    { type: "resize", height: 2400 },
  );
  assert.equal(
    parseWidgetMessage(
      { channel: "ours", type: "state", state: { text: "x".repeat(32001) } },
      "ours",
    ),
    null,
  );
  assert.equal(
    parseWidgetMessage(
      { channel: "ours", type: "followUp", text: " " },
      "ours",
    ),
    null,
  );
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:secret@example.com",
    "data:text/html,x",
  ])
    assert.equal(safeWidgetLink(url), null);
  assert.equal(safeWidgetLink("https://example.com"), "https://example.com/");
});

test("widget state and copy use originating message boundaries without leaking executable code", () => {
  const messages: Array<{
    id: string;
    intelligenceUiState?: IntelligenceUiState;
  }> = [{ id: "main" }, { id: "side" }];
  const updated = updateIntelligenceUiState(messages, "side", "ui-20", {
    guests: 4,
  });
  assert.equal(updated[0]?.intelligenceUiState, undefined);
  assert.deepEqual(updated[1]?.intelligenceUiState?.["ui-20"], { guests: 4 });
  assert.deepEqual(
    shiftIntelligenceUiState(updated[1]?.intelligenceUiState, 10),
    { "ui-30": { guests: 4 } },
  );
  assert.equal(
    assistantResponseToText(widgetFence),
    `${sampleWidget.title}\n${sampleWidget.description}`,
  );
});

test("documents protect script boundaries, bundle a self-contained runtime and restrict network by library", () => {
  const html = buildWidgetDocument(
    {
      ...sampleWidget,
      title: "<script>x</script>",
      js: 'const x = "</script><script>bad</script>";',
    },
    {
      channel: "ours",
      nonce: "test-nonce",
      theme: "dark",
      state: { note: "</script>" },
    },
  );
  assert.ok(html.includes("&lt;script&gt;x&lt;/script&gt;"));
  assert.ok(html.includes('"\\u003c/script>"'));
  assert.ok(html.includes('"<\\/script><script>bad<\\/script>"'));
  assert.ok(html.includes("connect-src &#39;none&#39;"));
  const runtime = html.match(
    /<script nonce="test-nonce">([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(runtime);
  assert.doesNotThrow(() => new Script(runtime));
  assert.ok(!runtime.includes("__name"));
  assert.throws(() =>
    buildWidgetDocument(sampleWidget, {
      channel: "ours",
      nonce: 'bad"nonce',
      theme: "dark",
    }),
  );
  const three = buildWidgetDocument(
    { ...sampleWidget, libraries: ["three"] },
    { channel: "ours", nonce: "test", theme: "light" },
  );
  assert.ok(three.includes("three@0.180.0"));
  assert.ok(!three.includes("tile.openstreetmap.org"));
});

test("standalone export restores saved values and renders a localized notice for host-only actions", () => {
  const html = buildWidgetDocument(sampleWidget, {
    channel: "export",
    nonce: "export",
    theme: "light",
    standalone: true,
    state: { currency: "USD", $controls: { people: { value: "7" } } },
    exportNotice: "Buka di Const",
  });
  assert.ok(html.includes('"people":{"value":"7"}'));
  assert.ok(html.includes("Buka di Const"));
  assert.ok(html.includes("const-export-notice"));
});
