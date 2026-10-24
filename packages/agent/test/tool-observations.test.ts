import { afterEach, describe, expect, it, vi } from "vitest";
import { appendToolObservations, UNAVAILABLE_TOOL_VISION } from "../src/const/tool-observations.js";
import type { AgentMessage } from "../src/const/types.js";
import { createConstAgent } from "../src/const/const-agent.js";
import { executeNativeTool } from "../src/const/tools.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizeUiMessages } from "../../../apps/harness/desktop/src/lib/conversation-store";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=";
const image = { data: png, mimeType: "image/png", scale: 0.5 };
afterEach(() => vi.unstubAllGlobals());

describe("visual tool observations", () => {
  it("keeps synthetic image observations out of user chat bubbles", () => {
    const history: AgentMessage[] = [
      { role: "user", content: "Inspect the app" },
      { role: "assistant", content: "", tool_calls: [{ id: "call_0", type: "function", function: { name: "computer_get_app_state", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "call_0", content: "App inspected" },
    ];
    appendToolObservations(history, [{ id: "call_0", name: "computer_get_app_state", images: [image] }]);
    history.push({ role: "assistant", content: "Observation complete" });
    const ui = normalizeUiMessages(history);
    expect(ui.filter(message => message.role === "user")).toHaveLength(1);
    expect(ui.some(message => message.toolObservationId)).toBe(false);
    expect(ui.at(-1)?.content).toContain("Observation complete");
  });
  it("retains only the last two tool images without removing uploaded user images", () => {
    const history: AgentMessage[] = [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,user" } }] }];
    for (let i = 0; i < 10; i++) appendToolObservations(history, [{ id: String(i), name: "computer_get_app_state", images: [image] }]);
    const observations = history.filter(message => message.toolObservationId);
    expect(observations.flatMap(message => Array.isArray(message.content) ? message.content.filter(part => part.type === "image_url") : [])).toHaveLength(2);
    expect(history[0]!.content).toEqual([{ type: "image_url", image_url: { url: "data:image/png;base64,user" } }]);
    expect(JSON.stringify(observations)).toContain("Earlier tool image released");
  });

  it("makes unsupported vision explicit instead of pretending the screenshot was seen", () => {
    const history: AgentMessage[] = [];
    appendToolObservations(history, [{ id: "one", name: "computer_click", images: [image] }], false);
    expect(history[0]!.content).toBe(UNAVAILABLE_TOOL_VISION); expect(JSON.stringify(history)).not.toContain(png);
  });

  it("reads image files as actual media rather than returning only filesystem metadata", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "const-image-read-"));
    try {
      const file = path.join(dir, "image.png"); await writeFile(file, Buffer.from(png, "base64"));
      const result = await executeNativeTool("read", { path: file }, dir);
      expect(result.isError).toBe(false); expect(result.images?.[0]).toEqual({ data: png, mimeType: "image/png" });
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("stops resending tool images when an unknown provider rejects vision", async () => {
    const requests: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      if (requests.length === 2) return new Response(JSON.stringify({ error: { message: "image_url input is unsupported by this model" } }), { status: 400 });
      const delta = requests.length < 4
        ? { tool_calls: [{ index: 0, id: `call_${requests.length}`, type: "function", function: { name: "computer_get_app_state", arguments: '{"app":"Fixture"}' } }] }
        : { content: "Visual verification is unavailable." };
      return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: requests.length < 4 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
    }));
    const handler = vi.fn(async () => ({ result: "App inspected", isError: false, images: [image] }));
    const agent = createConstAgent({ model: "unknown-model", baseUrl: "http://fixture.invalid/v1", apiKey: "", mode: "full_access", maxTurns: 4, workspacePath: process.cwd(), computerHandler: handler });
    await agent.run([{ role: "user", content: "Inspect the fixture" }], () => {});
    expect(requests).toHaveLength(4); expect(handler).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(requests[1].messages)).toContain("data:image/png;base64,");
    expect(JSON.stringify(requests[2].messages)).not.toContain("data:image/png;base64,");
    expect(JSON.stringify(requests[3].messages)).not.toContain("data:image/png;base64,");
    expect(JSON.stringify(requests[3].messages)).toContain(UNAVAILABLE_TOOL_VISION);
  });

  it("delivers a computer image to the next model request after all batch tool responses", async () => {
    const requests: any[] = [];
    const calls = ["computer_get_app_state", "computer_hotkey"].map((name, index) => ({ index, id: `call_${index}`, type: "function", function: { name, arguments: JSON.stringify({ app: "Fixture", key: "Ctrl+F" }) } }));
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      const delta = requests.length === 1 ? { tool_calls: calls } : { content: "The input was delivered; the intended outcome is unverified." };
      return new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: requests.length === 1 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }));
    const handler = vi.fn(async () => ({ result: "Verification: unverified", isError: false, images: [image] }));
    const agent = createConstAgent({ model: "test-model", inputTypes: ["text", "image"], baseUrl: "http://fixture.invalid/v1", apiKey: "", mode: "full_access", maxTurns: 3, conversationId: "fixture-session", workspacePath: process.cwd(), computerHandler: handler });
    await agent.run([{ role: "user", content: "Inspect the fixture" }], () => {});
    expect(requests).toHaveLength(2);
    const messages = requests[1].messages;
    const firstResult = messages.findIndex((message: any) => message.role === "tool" && message.tool_call_id === "call_0");
    expect(messages[firstResult + 1]).toMatchObject({ role: "tool", tool_call_id: "call_1" });
    expect(messages[firstResult + 2].role).toBe("user");
    expect(JSON.stringify(messages[firstResult + 2].content)).toContain(`data:image/png;base64,${png}`);
    expect(handler.mock.calls[0]?.[2]).toMatchObject({ sessionId: "fixture-session" });
  });
});
