import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentEvent } from "./types.js";
import { calculateContextBreakdown } from "./token-meter.js";

vi.mock("./skill-registry.js", () => ({
  resolveSkillRegistry: () => ({ skills: [], plugins: [] }),
  pluginInvocationInstructions: () => "",
}));
vi.mock("./tools.js", () => ({
  CONST_DEFAULT_TOOLS: [], CONST_LEARN_TOOLS: [],
  extractCommandArg: () => undefined, extractPathArg: () => undefined,
  resolveSafePath: (_file: string, workspace: string) => workspace,
  isPathWithinWorkspace: () => true,
  executeNativeTool: async (_name: string, _args: unknown, _workspace: string, context: any) => {
    if (_name === "ask_question") return { result: await context.askUser([{ question: "Continue?" }]), isError: false };
    return { result: "tool-result-".repeat(100), isError: false };
  },
}));
vi.mock("./subagent.js", () => ({ globalSubAgentManager: {}, formatTaskResultEnvelope: () => "" }));

import { ConstAgent } from "./const-agent.js";

function stream(frames: unknown[], trailing = false) {
  return new Response(frames.map(frame => `data: ${JSON.stringify(frame)}`).join("\n\n") + (trailing ? "" : "\n\n"), {
    status: 200, headers: { "Content-Type": "text/event-stream" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("agent telemetry wiring", () => {
  it("records every model round through tools, final usage without newline, and the final compacted context", async () => {
    const bodies: any[] = [];
    const fetch = vi.fn(async (_url: unknown, init: any) => {
      bodies.push(JSON.parse(init.body));
      if (bodies.length === 1) return stream([
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "call1", function: { name: "read", arguments: "{}" } }] }, finish_reason: "tool_calls" }] },
        { usage: { prompt_tokens: 1000, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 800 } } },
        { usage: { prompt_tokens: 1000, completion_tokens: 100, prompt_tokens_details: { cached_tokens: 800 } } },
      ]);
      return stream([
        { choices: [{ delta: { content: "Finished." }, finish_reason: "stop" }] },
        { usage: { prompt_tokens: 2000, completion_tokens: 200 } },
      ], true);
    });
    vi.stubGlobal("fetch", fetch);
    const events: AgentEvent[] = [];
    const agent = new ConstAgent({ baseUrl: "https://example.invalid/v1", apiKey: "test", model: "custom",
      workspacePath: process.cwd(), tools: [], contextWindow: 32000, mode: "full_access" });
    const history = await agent.run([{ role: "user", content: "Read and finish" }], event => events.push(event));
    expect(history.at(-1)?.content).toBe("Finished.");
    expect(bodies[1].messages.some((m: any) => m.role === "tool" && m.content.includes("tool-result"))).toBe(true);
    const usage = events.filter(e => e.type === "usage");
    expect(usage).toHaveLength(2);
    expect(usage.reduce((n, e) => n + e.totalTokens, 0)).toBe(3300);
    expect(new Set(usage.map(e => e.requestId)).size).toBe(2);
    expect(usage[0]?.cacheHitRate).toBe(80);
    expect(events.filter(e => e.type === "llm_request" && e.phase === "finished")).toHaveLength(2);
    const context = events.filter(e => e.type === "context_update").at(-1)!;
    const expected = calculateContextBreakdown({ systemPrompt: bodies[1].messages[0].content, tools: [], messages: history });
    expect(context.usedTokens).toBe(expected.totalHeuristicTokens);
    expect(context.totalTokens).toBe(32000);
  });

  it("measures model time independently from a tool waiting for a user", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ++calls === 1 ? stream([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "question", function: { name: "ask_question", arguments: "{}" } }] }, finish_reason: "tool_calls" }] },
      { usage: { prompt_tokens: 100, completion_tokens: 10 } },
    ]) : stream([{ choices: [{ delta: { content: "Done" }, finish_reason: "stop" }] }, { usage: { prompt_tokens: 200, completion_tokens: 20 } }])));
    const events: AgentEvent[] = [];
    const agent = new ConstAgent({ baseUrl: "https://example.invalid/v1", apiKey: "test", model: "custom", workspacePath: process.cwd(), tools: [],
      onAskQuestion: async () => { await new Promise(resolve => setTimeout(resolve, 50)); return { answer: "yes" }; } });
    await agent.run([{ role: "user", content: "Ask me" }], e => events.push(e));
    const tool = events.find(e => e.type === "tool_result");
    expect(tool?.type).toBe("tool_result");
    if (tool?.type !== "tool_result") throw new Error("Missing tool result");
    expect(tool.waitingMs).toBeGreaterThanOrEqual(40);
    expect(tool.durationMs).toBeLessThan(tool.waitingMs!);
    const finishedIndex = events.findIndex(e => e.type === "llm_request" && e.phase === "finished");
    expect(finishedIndex).toBeLessThan(events.findIndex(e => e.type === "ask_question"));
  });

  it("finalizes failed fetches without inventing provider usage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"message":"invalid request"}}', { status: 400 })));
    const events: AgentEvent[] = [];
    const agent = new ConstAgent({ baseUrl: "https://example.invalid/v1", apiKey: "test", model: "custom", workspacePath: process.cwd(), tools: [] });
    await expect(agent.run([{ role: "user", content: "Hello" }], e => events.push(e))).rejects.toThrow("invalid request");
    expect(events.some(e => e.type === "usage")).toBe(false);
    expect(events.find(e => e.type === "llm_request" && e.phase === "finished")).toMatchObject({ status: "failed" });
  });

  it("preserves reported partial usage when a running stream is cancelled", async () => {
    const payload = [
      { usage: { prompt_tokens: 100, completion_tokens: 5 } },
      { choices: [{ delta: { reasoning_content: "still working" } }] },
    ].map(frame => `data: ${JSON.stringify(frame)}\n\n`).join("");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(payload)); },
    }))));
    const events: AgentEvent[] = [];
    const agent = new ConstAgent({ baseUrl: "https://example.invalid/v1", apiKey: "test", model: "custom", workspacePath: process.cwd(), tools: [] });
    await agent.run([{ role: "user", content: "Start" }], event => {
      events.push(event);
      if (event.type === "thinking") agent.abort();
    });
    expect(events.find(e => e.type === "usage")).toMatchObject({ totalTokens: 105 });
    expect(events.find(e => e.type === "llm_request" && e.phase === "finished")).toMatchObject({ status: "cancelled" });
  });
});
