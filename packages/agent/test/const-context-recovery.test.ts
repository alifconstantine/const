import { afterEach, describe, expect, it, vi } from "vitest";
import { ConstAgent, compactHistoryForContext } from "../src/const/const-agent.js";
import { isContextWindowError } from "../src/const/model-retry.js";
import type { AgentEvent, AgentMessage } from "../src/const/types.js";

const config = { model: "test-model", baseUrl: "https://example.invalid/v1", apiKey: "test", tools: [], contextWindow: 128_000, maxTokens: 65_536 };
const done = () => new Response('data: {"choices":[{"delta":{"content":"Finished"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
const overflow = () => Response.json({ error: { message: "Request exceeds model context window" } }, { status: 400 });

afterEach(() => vi.unstubAllGlobals());

describe("Const context rejection recovery", () => {
  it("retries HTTP overflow with smaller output and retains the latest instruction", async () => {
    const requests: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return requests.length === 1 ? overflow() : done();
    }));
    const events: AgentEvent[] = [];
    const history = await new ConstAgent(config).run([{ role: "user", content: "Finish the existing website" }], e => events.push(e));
    expect(requests).toHaveLength(2);
    expect(requests[1].max_tokens).toBeLessThan(requests[0].max_tokens);
    expect(requests[1].messages).toContainEqual({ role: "user", content: "Finish the existing website" });
    expect(history.at(-1)?.content).toBe("Finished");
    expect(events.some(e => e.type === "error")).toBe(false);
  });

  it("recovers context errors carried inside SSE without retrying the same oversized request", async () => {
    const requests: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return requests.length === 1
        ? new Response('data: {"error":{"message":"maximum context length exceeded","code":"context_length_exceeded"}}\n\n')
        : done();
    }));
    await new ConstAgent(config).run([{ role: "user", content: "Continue" }], () => {});
    expect(requests).toHaveLength(2);
    expect(requests[1].max_tokens).toBeLessThan(requests[0].max_tokens);
  });

  it("bounds recovery and surfaces an unrecoverable context rejection", async () => {
    const fetch = vi.fn(async () => overflow());
    vi.stubGlobal("fetch", fetch);
    const events: AgentEvent[] = [];
    await expect(new ConstAgent(config).run([{ role: "user", content: "Continue" }], e => events.push(e))).rejects.toThrow("context window");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(events.some(e => e.type === "error" && e.error.includes("context window"))).toBe(true);
  });

  it("recovers a later overflow after a successful tool turn without removing its native image", async () => {
    const requests: any[] = [];
    const image = "data:image/png;base64," + "A".repeat(1_982_944);
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      if (requests.length === 1 || requests.length === 3) return overflow();
      if (requests.length === 2) return new Response('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"step","type":"function","function":{"name":"mcp_fixture_step","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n');
      return done();
    }));
    await new ConstAgent({ ...config, inputTypes: ["text", "image"], mode: "full_access", externalToolHandler: async () => ({ result: "Next check", isError: false }) }).run([
      { role: "user", content: [{ type: "text", text: "Inspect the image" }, { type: "image_url", image_url: { url: image } }] },
    ], () => {});
    expect(requests).toHaveLength(4);
    for (const request of requests) expect(request.messages.find((message: any) => message.role === "user").content[1].image_url.url).toBe(image);
    expect(requests[1].max_tokens).toBe(8192);
    expect(requests[2].max_tokens).toBeGreaterThan(8192);
    expect(requests[3].max_tokens).toBe(8192);
  });

  it("does not retry unrelated bad requests", async () => {
    const fetch = vi.fn(async () => Response.json({ error: { message: "Invalid tool schema" } }, { status: 400 }));
    vi.stubGlobal("fetch", fetch);
    await expect(new ConstAgent(config).run([{ role: "user", content: "Continue" }], () => {})).rejects.toThrow("Invalid tool schema");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(isContextWindowError("Invalid tool schema")).toBe(false);
  });

  it("clamps output to leave room for the prompt within a small model window", async () => {
    let request: any;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => { request = JSON.parse(init.body); return done(); }));
    await new ConstAgent({ ...config, contextWindow: 32_000 }).run([{ role: "user", content: "Hello" }], () => {});
    expect(request.max_tokens).toBeGreaterThan(0);
    expect(request.max_tokens).toBeLessThan(32_000);
  });

  it("keeps fresh tool evidence and tool pairs intact during aggressive request-only compaction", () => {
    const history: AgentMessage[] = [
      { role: "user", content: "Keep the original requirements" },
      { role: "assistant", content: "", thinking: "T".repeat(4000), tool_calls: [{ id: "a", type: "function", function: { name: "read", arguments: '{"path":"screen.png"}' } }] },
      { role: "tool", tool_call_id: "a", name: "read", content: "R".repeat(4000) },
      { role: "user", toolObservationId: "a", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] },
    ];
    const compacted = compactHistoryForContext(history, 0);
    expect(compacted[0].content).toBe(history[0].content);
    expect(compacted[1].tool_calls).toEqual(history[1].tool_calls);
    expect(compacted[2]).toBe(history[2]);
    expect(compacted[3]).toBe(history[3]);
    expect(history[1].thinking).toHaveLength(4000);
  });
});
