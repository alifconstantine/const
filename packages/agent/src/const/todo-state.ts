import type { TodoItem } from "./types.js";

/** Shared by the executor, history restore and Activity. An empty array means clear. */
export function parseTodoItems(value: unknown): TodoItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: TodoItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return undefined;
    const content = raw.content ?? raw.task ?? raw.text ?? raw.title;
    const status = raw.status ?? "pending";
    if (typeof content !== "string" || !content.trim() || !["pending", "in_progress", "completed"].includes(status)) return undefined;
    items.push({ content: content.trim(), status, ...(typeof raw.id === "string" ? { id: raw.id } : {}) });
  }
  return items;
}

export function isTodoTool(name: string | undefined): boolean {
  return ["todo", "todowrite"].includes((name || "").toLowerCase().replace(/[-_]/g, ""));
}

/** Canonical state wins over legacy arguments. Failed/in-flight legacy calls never commit. */
export function latestTodoState(messages: readonly any[]): TodoItem[] | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== "assistant" && message?.role !== "tool") continue;
    const canonical = parseTodoItems(message.todos);
    if (canonical) return canonical;
    const calls = message.traceSteps?.length ? message.traceSteps : message.toolCalls || [];
    for (let callIndex = calls.length - 1; callIndex >= 0; callIndex--) {
      const call = calls[callIndex];
      if (!isTodoTool(call?.name) || call.isError !== false) continue;
      const items = parseTodoItems(call.args?.todos ?? call.args?.tasks ?? call.args?.items);
      if (items) return items;
    }
  }
  return undefined;
}
