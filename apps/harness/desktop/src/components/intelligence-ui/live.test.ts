import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readCompletionStream,
  validateGeneratedUi,
} from "../../../tests/intelligence-ui-live-support";

function bytes(text: string, size = 1) {
  const buffer = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < buffer.length; offset += size)
        controller.enqueue(buffer.slice(offset, offset + size));
      controller.close();
    },
  });
}

test("live SSE decoding preserves fragmented UTF-8 content, CRLF, and final usage", async () => {
  const first = JSON.stringify({
    choices: [{ delta: { content: "日本語 " } }],
  });
  const last = JSON.stringify({
    choices: [{ delta: { content: "selesai" }, finish_reason: "stop" }],
    usage: { total_tokens: 42 },
  });
  const result = await readCompletionStream(
    bytes(
      `: comment\r\ndata: ${first}\r\n\r\ndata: ${last}\r\n\r\ndata: [DONE]`,
    ),
  );
  assert.equal(result.content, "日本語 selesai");
  assert.equal(result.events, 2);
  assert.deepEqual(result.usage, { total_tokens: 42 });
});

test("live SSE decoding rejects truncated and tool-calling responses", async () => {
  await assert.rejects(
    () =>
      readCompletionStream(
        bytes('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
      ),
    /without a completion marker/,
  );
  await assert.rejects(
    () =>
      readCompletionStream(
        bytes('data: {"choices":[{"delta":{"tool_calls":[{}]}}]}\n\n'),
      ),
    /Unexpected tool call/,
  );
  await assert.rejects(
    () =>
      readCompletionStream(
        bytes('data: {"error":{"message":"upstream failure"}}\n\n'),
      ),
    /provider returned a stream error/,
  );
});

test("live SSE decoding rejects empty and token-limited generations", async () => {
  await assert.rejects(
    () => readCompletionStream(bytes("data: [DONE]\n\n")),
    /no assistant content/,
  );
  await assert.rejects(
    () =>
      readCompletionStream(
        bytes(
          'data: {"choices":[{"delta":{"content":"cut"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n',
        ),
      ),
    /did not finish normally/,
  );
});

test("live UI validation checks every nested component and all requested formats", () => {
  const program =
    'root = Stack([card, table, chart, form])\ncard = Card([TextContent("Six projects")])\ntable = Table([Col("Project", ["Alpha"])])\nchart = BarChart(["Alpha"], [Series("Delta", [-30])])\nform = Form("priority", Buttons([Button("Send")]), [])';
  assert.deepEqual(
    validateGeneratedUi(`\`\`\`openui-lang\n${program}\n\`\`\``).errors,
    [],
  );
  assert.ok(
    validateGeneratedUi("Ordinary prose").errors.includes(
      "No openui-lang block was generated",
    ),
  );
  assert.ok(
    validateGeneratedUi(
      `\`\`\`openui-lang\n${program.replace('Form("priority"', 'Form("constructor"')}\n\`\`\``,
    ).errors.includes("Invalid Form props"),
  );
});
