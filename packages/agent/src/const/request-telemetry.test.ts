import { describe, expect, it } from "vitest";
import { trackLlmRequest } from "./request-telemetry.js";
import { parseProviderUsage } from "./token-meter.js";
import type { AgentEvent } from "./types.js";

describe("provider accounting", () => {
  it.each([true, false])("does not add OpenAI cache to the prompt twice (total reported: %s)", reported => {
    const usage = parseProviderUsage({ prompt_tokens: 1000, completion_tokens: 100,
      ...(reported ? { total_tokens: 1100 } : {}), prompt_tokens_details: { cached_tokens: 800 } });
    expect(usage).toMatchObject({ inputTokens: 200, cacheReadTokens: 800, outputTokens: 100, totalTokens: 1100 });
  });

  it("normalizes cache writes, DeepSeek counts and Responses reasoning", () => {
    expect(parseProviderUsage({ prompt_tokens: 1000, completion_tokens: 100,
      prompt_tokens_details: { cached_tokens: 600, cache_write_tokens: 200 } })).toMatchObject({
      inputTokens: 200, cacheReadTokens: 600, cacheWriteTokens: 200, totalTokens: 1100,
    });
    expect(parseProviderUsage({ prompt_tokens: 1000, prompt_cache_hit_tokens: 800,
      prompt_cache_miss_tokens: 200, completion_tokens: 100 })).toMatchObject({ inputTokens: 200, totalTokens: 1100 });
    expect(parseProviderUsage({ input_tokens: 1000, output_tokens: 100,
      input_tokens_details: { cached_tokens: 800 }, output_tokens_details: { reasoning_tokens: 40 } }))
      .toMatchObject({ inputTokens: 200, totalTokens: 1100, reasoningTokens: 40 });
  });

  it("keeps Anthropic cache separate from uncached input", () => {
    expect(parseProviderUsage({ input_tokens: 150, output_tokens: 60,
      cache_read_input_tokens: 100, cache_creation_input_tokens: 30 })).toMatchObject({
      inputTokens: 150, cacheReadTokens: 100, cacheWriteTokens: 30, outputTokens: 60, totalTokens: 340,
    });
  });

  it("keeps Responses cache writes separate while preserving inclusive prompt totals", () => {
    expect(parseProviderUsage({ input_tokens: 1000, output_tokens: 100,
      input_tokens_details: { cached_tokens: 600, cache_write_tokens: 200 },
      output_tokens_details: { reasoning_tokens: 40 } })).toMatchObject({
      inputTokens: 200, cacheReadTokens: 600, cacheWriteTokens: 200,
      outputTokens: 100, totalTokens: 1100, reasoningTokens: 40,
    });
  });
});

describe("request lifecycle", () => {
  it("measures the first generated delta and commits the final cumulative usage once", () => {
    let time = 1000;
    const events: AgentEvent[] = [];
    const request = trackLlmRequest("one", "model", e => events.push(e), () => time);
    time = 1100;
    request.observeDelta({ role: "assistant" });
    request.observeUsage({ prompt_tokens: 1000, completion_tokens: 1 });
    time = 1250;
    request.observeDelta({ reasoning_content: "thinking" });
    time = 2000;
    request.observeUsage({ prompt_tokens: 1000, completion_tokens: 100, prompt_tokens_details: { cached_tokens: 800 } });
    request.finish("completed");
    time = 10000; // Tool execution or a delayed duplicate must not extend model time.
    request.finish("completed");
    const usage = events.filter(e => e.type === "usage");
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ requestId: "one", promptTokens: 1000, completionTokens: 100,
      totalTokens: 1100, cacheHitRate: 80, ttftMs: 250, durationMs: 1000 });
    expect(events.filter(e => e.type === "llm_request")).toHaveLength(2);
  });

  it.each(["failed", "cancelled"] as const)("preserves partial usage when %s", status => {
    const events: AgentEvent[] = [];
    const request = trackLlmRequest(status, "model", e => events.push(e));
    request.observeDelta({ tool_calls: [{ index: 0 }] });
    request.observeUsage({ prompt_tokens: 100, completion_tokens: 5 });
    request.finish(status);
    expect(events.find(e => e.type === "usage")).toMatchObject({ totalTokens: 105 });
    expect(events.at(-1)).toMatchObject({ status });
  });

  it("does not invent usage or TTFT for an empty response", () => {
    const events: AgentEvent[] = [];
    trackLlmRequest("empty", "model", e => events.push(e)).finish("failed");
    expect(events.some(e => e.type === "usage")).toBe(false);
    expect(events.at(-1)).toMatchObject({ ttftMs: undefined });
  });
});
