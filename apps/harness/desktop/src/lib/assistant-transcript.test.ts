import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveAssistantCommentary, serializeAssistantTranscript } from "./assistant-transcript";
import { normalizeUiMessages } from "./conversation-store";
import type { TraceStep } from "../vite-env";

test("commentary is immutable, separated by model turn, and never concatenated with the final answer", () => {
  const original = { content: "I will inspect the workspace.", traceSteps: [] as TraceStep[] };
  const archived = archiveAssistantCommentary(original, original.content, 1);
  assert.equal(original.content, "I will inspect the workspace.");
  assert.equal(original.traceSteps.length, 0);
  assert.equal(archived.content, "");
  assert.deepEqual(archived.traceSteps.map(step => [step.type, step.content]), [["commentary", original.content]]);
  assert.equal(archiveAssistantCommentary(archived), archived);
});

const history = () => [
  { role: "user", content: "Research satellite debris.", timestamp: 1 },
  { role: "assistant", content: "I'll check the sources.\n\nThen verify the dates.", thinking: "Consider primary sources", timestamp: 2,
    tool_calls: [{ id: "read", function: { name: "read", arguments: '{"path":"sources.md"}' } }] },
  { role: "tool", tool_call_id: "read", name: "read", content: "Source contents" },
  { role: "assistant", content: "The sources are readable. I'll compare their figures.", timestamp: 3,
    tool_calls: [{ id: "search", function: { name: "grep", arguments: '{"pattern":"debris"}' } }] },
  { role: "tool", tool_call_id: "search", name: "grep", content: "Verified figures" },
  { role: "assistant", content: "## Findings\n\nA complete final answer.", timestamp: 4 },
];

test("raw history hydrates progress, thinking and tools in order, keeping only the final response outside Working", () => {
  const raw = history();
  const before = JSON.stringify(raw);
  const messages = normalizeUiMessages(raw);
  const answer = messages[1];
  assert.equal(messages.length, 2);
  assert.equal(answer.content, "## Findings\n\nA complete final answer.");
  assert.deepEqual(answer.traceSteps.map((step: any) => step.type), ["thought", "commentary", "tool", "commentary", "tool"]);
  assert.match(answer.traceSteps[1].content, /\n\nThen verify/);
  assert.equal(answer.toolCalls[0].result, "Source contents");
  assert.equal(JSON.stringify(raw), before);
  const persisted = JSON.parse(JSON.stringify(messages));
  assert.deepEqual(normalizeUiMessages(persisted), persisted);
});

test("continuation restores progress and tool results before the final answer without duplicates", () => {
  const answer = normalizeUiMessages(history())[1];
  const serialized = serializeAssistantTranscript(answer);
  assert.deepEqual(serialized.map(message => message.role), ["assistant", "tool", "assistant", "tool", "assistant"]);
  assert.equal(serialized[0].content, "I'll check the sources.\n\nThen verify the dates.");
  assert.equal(serialized[2].content, "The sources are readable. I'll compare their figures.");
  assert.equal(serialized[4].content, answer.content);
  assert.deepEqual(serialized.filter(message => message.role === "tool").map(message => message.tool_call_id), ["read", "search"]);
});

test("a raw tool-call turn is progress even before its result has arrived", () => {
  const answer = normalizeUiMessages(history().slice(0, 2))[1];
  assert.equal(answer.content, "");
  assert.equal(answer.traceSteps[1].type, "commentary");
});
