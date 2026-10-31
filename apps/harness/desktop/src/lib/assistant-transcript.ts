import type { TraceStep } from "../vite-env";

/** A model response followed by tools is public progress, not the final answer. */
export function archiveAssistantCommentary<T extends { content?: string; traceSteps?: TraceStep[] }>(
  message: T,
  content = message.content || "",
  now = Date.now(),
): T {
  if (!content.trim()) return message.content ? { ...message, content: "" } : message;
  const steps = message.traceSteps || [];
  return { ...message, content: "", traceSteps: [...steps, {
    id: `commentary_${now}_${steps.length}`, type: "commentary", content, startTime: now,
  }] };
}

/** Reconstruct progress → calls/results → final answer for continuation prompts. */
export function serializeAssistantTranscript(message: {
  content?: string; thinking?: string; timestamp?: number; traceSteps?: TraceStep[];
  toolCalls?: Array<{ id: string; name: string; args?: any; result?: any }>;
}): any[] {
  const calls = message.toolCalls || [];
  const seen = new Set<string>();
  const messages: any[] = [];
  let commentary = "";
  let thinking = message.thinking || undefined;
  const addTool = (call: typeof calls[number], index: number) => {
    if (seen.has(call.id)) return;
    seen.add(call.id);
    const id = call.id || `call_${message.timestamp || 0}_${index}`;
    messages.push({ role: "assistant", content: commentary || null, thinking, tool_calls: [{
      id, type: "function", function: { name: call.name,
        arguments: typeof call.args === "string" ? call.args : JSON.stringify(call.args ?? {}) },
    }] });
    commentary = "";
    thinking = undefined;
    messages.push({ role: "tool", tool_call_id: id, name: call.name,
      content: typeof call.result === "string" ? call.result : call.result == null ? "" : JSON.stringify(call.result) });
  };
  for (const step of message.traceSteps || []) {
    if (step.type === "commentary" && step.content) commentary += (commentary ? "\n\n" : "") + step.content;
    if (step.type === "tool") {
      const index = calls.findIndex(call => call.id === (step.toolCallId || step.id));
      if (index >= 0) addTool(calls[index]!, index);
    }
  }
  calls.forEach(addTool);
  if (commentary) messages.push({ role: "assistant", content: commentary });
  if (message.content) messages.push({ role: "assistant", content: message.content, ...(thinking ? { thinking } : {}) });
  return messages;
}
