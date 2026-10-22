import { describe, it, expect } from "vitest";
import {
  parseProviderUsage,
  estimateTextTokens,
  estimateToolsTokens,
  estimateSystemPromptTokens,
  estimateMessage,
  calculateContextBreakdown,
  calculateContextOccupancy,
  accumulateSessionUsage,
} from "./token-meter.js";

describe("token-meter", () => {
  describe("parseProviderUsage", () => {
    it("handles standard OpenAI format", () => {
      const raw = {
        prompt_tokens: 120,
        completion_tokens: 45,
        total_tokens: 165,
        prompt_tokens_details: {
          cached_tokens: 40,
        },
        completion_tokens_details: {
          reasoning_tokens: 25,
        },
      };
      const result = parseProviderUsage(raw);
      expect(result).toBeDefined();
      expect(result?.inputTokens).toBe(120);
      expect(result?.outputTokens).toBe(45);
      expect(result?.totalTokens).toBe(165);
      expect(result?.cacheReadTokens).toBe(40);
      expect(result?.reasoningTokens).toBe(25);
    });

    it("handles DeepSeek direct cache hit/miss format", () => {
      const raw = {
        prompt_cache_hit_tokens: 80,
        prompt_cache_miss_tokens: 20,
        completion_tokens: 50,
      };
      const result = parseProviderUsage(raw);
      expect(result).toBeDefined();
      expect(result?.inputTokens).toBe(20);
      expect(result?.outputTokens).toBe(50);
      expect(result?.cacheReadTokens).toBe(80);
      expect(result?.totalTokens).toBe(150);
    });

    it("handles Anthropic format", () => {
      const raw = {
        input_tokens: 150,
        output_tokens: 60,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 30,
      };
      const result = parseProviderUsage(raw);
      expect(result).toBeDefined();
      expect(result?.inputTokens).toBe(150);
      expect(result?.outputTokens).toBe(60);
      expect(result?.cacheReadTokens).toBe(100);
      expect(result?.cacheWriteTokens).toBe(30);
      expect(result?.totalTokens).toBe(340);
    });

    it("handles Pi-AI format", () => {
      const raw = {
        input: 200,
        output: 75,
        totalTokens: 275,
        cacheRead: 50,
        cacheWrite: 0,
        reasoning: 35,
      };
      const result = parseProviderUsage(raw);
      expect(result).toBeDefined();
      expect(result?.inputTokens).toBe(200);
      expect(result?.outputTokens).toBe(75);
      expect(result?.totalTokens).toBe(275);
      expect(result?.cacheReadTokens).toBe(50);
      expect(result?.reasoningTokens).toBe(35);
    });

    it("returns undefined for invalid or zero payload", () => {
      expect(parseProviderUsage(null)).toBeUndefined();
      expect(parseProviderUsage({})).toBeUndefined();
      expect(parseProviderUsage({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })).toBeUndefined();
    });
  });

  describe("estimateTextTokens", () => {
    it("prices text under CHARS_PER_TOKEN divisor", () => {
      expect(estimateTextTokens("")).toBe(0);
      expect(estimateTextTokens("1234")).toBe(1);
      expect(estimateTextTokens("12345678")).toBe(2);
      expect(estimateTextTokens("12345")).toBe(2);
    });
  });

  describe("estimateToolsTokens", () => {
    it("returns 0 for empty or undefined tools", () => {
      expect(estimateToolsTokens([])).toBe(0);
      expect(estimateToolsTokens(undefined)).toBe(0);
    });

    it("prices schema JSON structure plus overhead", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "read",
            description: "Read file contents",
            parameters: { type: "object", properties: { path: { type: "string" } } },
          },
        },
      ];
      const tokens = estimateToolsTokens(tools);
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe("estimateSystemPromptTokens", () => {
    it("prices system prompt with role overhead", () => {
      expect(estimateSystemPromptTokens("")).toBe(0);
      const tokens = estimateSystemPromptTokens("You are an expert software engineer.");
      expect(tokens).toBeGreaterThan(5);
    });
  });

  describe("estimateMessage", () => {
    it("calculates tokens for a user message", () => {
      const msg = {
        role: "user",
        content: "Fix the bug in src/index.ts",
      };
      const tokens = estimateMessage(msg);
      expect(tokens).toBeGreaterThan(5);
    });

    it("includes thinking and tool calls for assistant message", () => {
      const msg = {
        role: "assistant",
        content: "I will read the file.",
        thinking: "Let's inspect src/index.ts first to understand the context.",
        tool_calls: [
          {
            name: "read",
            arguments: JSON.stringify({ path: "src/index.ts" }),
          },
        ],
      };
      const tokens = estimateMessage(msg);
      expect(tokens).toBeGreaterThan(25);
    });
  });

  describe("calculateContextBreakdown", () => {
    it("aggregates system, tools, and message tokens", () => {
      const breakdown = calculateContextBreakdown({
        systemPrompt: "You are Const Assistant.",
        tools: [{ type: "function", function: { name: "read" } }],
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
      });

      expect(breakdown.systemTokens).toBeGreaterThan(0);
      expect(breakdown.toolsTokens).toBeGreaterThan(0);
      expect(breakdown.messageTokens).toBeGreaterThan(0);
      expect(breakdown.totalHeuristicTokens).toBe(
        breakdown.systemTokens + breakdown.toolsTokens + breakdown.messageTokens
      );
    });
  });

  describe("calculateContextOccupancy", () => {
    it("calculates bounded occupancy percentage", () => {
      const occupancy = calculateContextOccupancy(
        {
          pressureTokens: 50000,
          contextWindow: 100000,
        }
      );
      expect(occupancy.percent).toBe(50);
      expect(occupancy.usedTokens).toBe(50000);
      expect(occupancy.contextWindow).toBe(100000);
      expect(occupancy.availableTokens).toBe(50000);
    });

    it("prefers projectedTokens over pressureTokens when available", () => {
      const occupancy = calculateContextOccupancy(
        {
          pressureTokens: 40000,
          projectedTokens: 45000,
          contextWindow: 100000,
        }
      );
      expect(occupancy.usedTokens).toBe(45000);
      expect(occupancy.percent).toBe(45);
    });
  });

  describe("accumulateSessionUsage", () => {
    it("adds usage buckets without double-counting", () => {
      const prev = {
        uncachedInputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 40,
        cacheWriteTokens: 10,
        totalTokens: 200,
        reasoningTokens: 20,
      };
      const next = {
        inputTokens: 50,
        outputTokens: 25,
        totalTokens: 75,
        cacheReadTokens: 15,
        reasoningTokens: 10,
      };
      const updated = accumulateSessionUsage(prev, next);
      expect(updated.uncachedInputTokens).toBe(150);
      expect(updated.outputTokens).toBe(75);
      expect(updated.cacheReadTokens).toBe(55);
      expect(updated.cacheWriteTokens).toBe(10);
      expect(updated.totalTokens).toBe(275);
      expect(updated.reasoningTokens).toBe(30);
    });
  });
});
