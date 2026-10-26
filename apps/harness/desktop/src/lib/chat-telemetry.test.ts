import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyTelemetry, reduceTelemetry, summarizeTelemetry, estimateVisibleContext, mergeTelemetry, telemetryForHistory } from "./chat-telemetry";
import { getModelContextLimit } from "./model-context";
import { estimateMessage } from "@const/agent/token-meter";
import { ROUTER_DEFAULT_MODELS } from "./router-models";

const usage = (requestId: string, promptTokens = 1000, completionTokens = 100) => ({
  type: "usage", requestId, model: "custom", startedAt: 1000,
  promptTokens, completionTokens, totalTokens: promptTokens + completionTokens,
  cacheReadTokens: 800, cacheWriteTokens: 0, durationMs: 1000, ttftMs: 200,
});

test("multiple model rounds accumulate; a repeated snapshot replaces instead of adding", () => {
  let state = reduceTelemetry(undefined, usage("a"));
  state = reduceTelemetry(state, usage("a"));
  state = reduceTelemetry(state, usage("b", 2000, 200));
  const summary = summarizeTelemetry(state);
  assert.equal(summary.totalTokens, 3300);
  assert.equal(summary.modelRequests, 2);
  assert.equal(summary.llmDurationMs, 2000);
  assert.equal(summary.tokPerSec, 150);
  assert.equal(summary.ttftSeconds, 0.2);
  assert.equal(summary.uncachedInputTokens, 1400);
  assert.equal(summary.cacheHitRate, 1600 / 3000 * 100);
});

test("separate conversations cannot contaminate usage or context; a snapshot can shrink", () => {
  const a = reduceTelemetry(undefined, usage("a"));
  let b = reduceTelemetry(undefined, { type: "context_update", usedTokens: 5000, totalTokens: 128000,
    systemPromptTokens: 100, toolsTokens: 200, messagesTokens: 4700 });
  b = reduceTelemetry(b, { type: "context_update", usedTokens: 500, totalTokens: 128000,
    systemPromptTokens: 100, toolsTokens: 200, messagesTokens: 200 });
  assert.equal(a.context, undefined);
  assert.equal(b.context?.usedTokens, 500);
  assert.equal(summarizeTelemetry(b).hasUsage, false);
});

test("tool results do not create billed model tokens; waiting is separate from execution", () => {
  let state = reduceTelemetry(undefined, { type: "tool_call", toolCallId: "tool1" });
  state = reduceTelemetry(state, { type: "tool_result", toolCallId: "tool1", result: "x".repeat(10000), durationMs: 250, waitingMs: 30000 });
  state = reduceTelemetry(state, { type: "tool_result", toolCallId: "tool1", result: "updated result" });
  const summary = summarizeTelemetry(state);
  assert.equal(summary.totalTokens, 0);
  assert.equal(summary.toolCalls, 1);
  assert.equal(summary.toolDurationMs, 250);
  assert.equal(summary.waitingDurationMs, 30000);
});

test("legacy and missing provider usage stays unknown; partially reported usage is marked", () => {
  assert.equal(summarizeTelemetry().hasUsage, false);
  assert.equal(summarizeTelemetry().tokPerSec, undefined);
  assert.equal(summarizeTelemetry().ttftSeconds, undefined);
  let state = reduceTelemetry(undefined, usage("one"));
  state = reduceTelemetry(state, { type: "llm_request", phase: "started", requestId: "no-usage", model: "custom", startedAt: 2000 });
  assert.equal(summarizeTelemetry(state).incompleteUsage, true);
  assert.equal(summarizeTelemetry(state).totalTokens, 1100);
});

test("continuing legacy history never presents new request usage as a complete lifetime total", () => {
  const legacy = telemetryForHistory([{ role: "user", content: "old task" }, { role: "assistant", content: "old answer" }]);
  const continued = reduceTelemetry(legacy, usage("new"));
  assert.equal(summarizeTelemetry(continued).totalTokens, 1100);
  assert.equal(summarizeTelemetry(continued).incompleteUsage, true);
  assert.equal(telemetryForHistory([{ role: "user", content: "new task" }, { role: "assistant", content: "" }]).historyIncomplete, false);
});

test("the same tool result stored in calls and traces is priced once", () => {
  const tool = { id: "tool1", name: "read", args: { path: "file" }, result: "x".repeat(1000) };
  const message = { role: "assistant", content: "Done", toolCalls: [tool], traceSteps: [{ ...tool, type: "tool" }] };
  const withoutTrace = { ...message, traceSteps: [] };
  assert.equal(estimateVisibleContext([message]), estimateVisibleContext([withoutTrace]));
  const withoutResult = { ...withoutTrace, toolCalls: [{ ...tool, result: undefined }] };
  assert.equal(estimateVisibleContext([message]) - estimateVisibleContext([withoutResult]), estimateMessage({ role: "tool", content: tool.result }));
});

test("cache write and reasoning preserve the accounting identity after reload", () => {
  let state = reduceTelemetry(undefined, { ...usage("anthropic", 280, 60), cacheReadTokens: 100, cacheWriteTokens: 30, reasoningTokens: 20 });
  state = JSON.parse(JSON.stringify(state));
  const s = summarizeTelemetry(state);
  assert.equal(s.uncachedInputTokens, 150);
  assert.equal(s.uncachedInputTokens + s.cachedInputTokens + s.cacheWriteTokens + s.outputTokens, s.totalTokens);
  assert.equal(s.reasoningTokens, 20);
});

test("subagent requests contribute once to billing without changing main context/timing", () => {
  let state = reduceTelemetry(undefined, usage("parent"));
  const event = { type: "subagent_updated", agent: { requests: { child: { ...usage("child", 2000, 200) } } } };
  state = reduceTelemetry(state, event);
  state = reduceTelemetry(state, event);
  const s = summarizeTelemetry(state);
  assert.equal(s.totalTokens, 3300);
  assert.equal(s.modelRequests, 1);
  assert.equal(s.llmDurationMs, 1000);
  assert.equal(state.context, undefined);
});

test("stale renderer saves preserve completed requests and the latest context", () => {
  const started = reduceTelemetry(undefined, { type: "llm_request", phase: "started", requestId: "a", model: "custom", startedAt: 1000 });
  let complete = reduceTelemetry(started, usage("a"));
  complete = reduceTelemetry(complete, { type: "llm_request", requestId: "a", status: "completed" });
  complete = reduceTelemetry(complete, { type: "context_update", usedTokens: 500, totalTokens: 128000, updatedAt: 200 });
  const stale = reduceTelemetry(started, { type: "context_update", usedTokens: 9000, totalTokens: 128000, updatedAt: 100 });
  const restored = mergeTelemetry(complete, stale)!;
  assert.equal(restored.requests.a?.status, "completed");
  assert.equal(summarizeTelemetry(restored).totalTokens, 1100);
  assert.equal(restored.context?.usedTokens, 500);
});

test("model capacity respects explicit small limits and uses the shared catalog", () => {
  assert.equal(getModelContextLimit("custom", 32000), 32000);
  assert.equal(getModelContextLimit("custom", 128000), 128000);
  assert.equal(getModelContextLimit("custom", "128K"), 128000);
  assert.equal(getModelContextLimit("custom", "1.5M"), 1500000);
  for (const model of ROUTER_DEFAULT_MODELS) assert.equal(getModelContextLimit(model.id), model.contextWindow);
  assert.equal(getModelContextLimit("custom", Number.NaN), 1000000);
  assert.deepEqual(emptyTelemetry(), { version: 1, requests: {} });
});
