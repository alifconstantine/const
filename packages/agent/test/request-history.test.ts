import { afterEach, expect, it, vi } from "vitest";
import { ConstAgent } from "../src/const/const-agent.js";
import { fitRequestHistory } from "../src/const/request-history.js";
import type { AgentMessage } from "../src/const/types.js";

afterEach(() => vi.unstubAllGlobals());

function longHistory(): AgentMessage[] {
  const history: AgentMessage[] = [{ role: "user", content: "Build Website; preserve the user's existing files." }];
  for (let index = 0; index < 280; index++) {
    history.push({ role: "assistant", content: "", tool_calls: [{ id: `old_${index}`, type: "function", function: { name: "read", arguments: JSON.stringify({ path: `site/file-${index}.txt` }) } }] });
    history.push({ role: "tool", tool_call_id: `old_${index}`, content: `Observed file ${index}; check passed.` });
  }
  history.push({ role: "user", content: "Keep the latest requirement: verify keyboard navigation." });
  history.push({ role: "assistant", content: "", tool_calls: [0, 1, 2].map(index => ({ id: `fresh_${index}`, type: "function" as const, function: { name: "read", arguments: "{}" } })) });
  for (const index of [0, 1, 2]) history.push({ role: "tool", tool_call_id: `fresh_${index}`, content: `Fresh observation ${index}` });
  history.push({ role: "user", toolObservationId: "fresh_2", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] });
  return history;
}

function expectCompleteToolBatches(messages: AgentMessage[]) {
  let pending = new Set<string>();
  for (const message of messages) {
    if (message.role === "tool") {
      expect(pending.has(message.tool_call_id!)).toBe(true);
      pending.delete(message.tool_call_id!);
    } else {
      expect(pending.size).toBe(0);
      pending = new Set(message.tool_calls?.map(call => call.id));
    }
  }
  expect(pending.size).toBe(0);
}

it("fits a long task under the router message limit without orphaned tools, lost requirements or media changes", () => {
  const history = longHistory();
  const before = JSON.stringify(history);
  const fitted = fitRequestHistory(history);
  expect(fitted.length).toBeLessThan(480);
  expectCompleteToolBatches(fitted);
  expect(fitted).toContain(history[0]);
  expect(fitted).toContain(history.at(-6));
  expect(fitted.at(-1)).toBe(history.at(-1));
  expect(JSON.stringify(fitted)).toContain("Observed file 0; check passed.");
  expect(JSON.stringify(fitted)).toContain("site/file-0.txt");
  expect(JSON.stringify(history)).toBe(before);
});

it("continues past 500 stored messages through a tool turn instead of receiving the router's HTTP 400", async () => {
  const requests: { messages: AgentMessage[] }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body); requests.push(body);
    if (body.messages.length > 500) return Response.json({ error: { message: "Supply between 1 and 500 messages." } }, { status: 400 });
    const delta = requests.length === 1
      ? { tool_calls: [{ index: 0, id: "next", type: "function", function: { name: "mcp_fixture_check", arguments: "{}" } }] }
      : { content: "Verification complete." };
    return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: requests.length === 1 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`);
  }));
  const history = longHistory();
  const originalLength = history.length;
  const result = await new ConstAgent({
    model: "test", baseUrl: "https://fixture.invalid/v1", apiKey: "", mode: "full_access", maxTurns: 2, tools: [],
    externalToolHandler: async () => ({ result: "Keyboard navigation verified", isError: false }),
  }).run(history, () => {});
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    expect(request.messages.length).toBeLessThanOrEqual(500);
    expectCompleteToolBatches(request.messages);
  }
  expect(JSON.stringify(requests[0]?.messages)).toContain("data:image/png;base64,AAAA");
  expect(result.at(-1)?.content).toBe("Verification complete.");
  expect(result.length).toBeGreaterThan(originalLength);
  expect(history).toHaveLength(originalLength);
});

it("refuses to split an oversized current batch into orphaned tool results", () => {
  const history: AgentMessage[] = [
    { role: "user", content: "Run a batch" },
    { role: "assistant", content: "", tool_calls: Array.from({ length: 500 }, (_, index) => ({ id: String(index), type: "function", function: { name: "read", arguments: "{}" } })) },
    ...Array.from({ length: 500 }, (_, index): AgentMessage => ({ role: "tool", tool_call_id: String(index), content: "result" })),
  ];
  expect(() => fitRequestHistory(history)).toThrow("current tool batch");
});
