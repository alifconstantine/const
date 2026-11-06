import type { StoredMessage } from "./database";
import { latestTodoState } from "../src/lib/activity-state";

/** Host plan updates survive a richer or delayed renderer checkpoint of the same turn. */
export function mergeCanonicalTodoState(target: StoredMessage[], source: StoredMessage[]): StoredMessage[] {
  const todos = latestTodoState(source);
  if (!todos) return target;
  const targetUsers = target.filter(message => message.role === "user");
  const sourceUsers = source.filter(message => message.role === "user");
  if (targetUsers.length !== sourceUsers.length) return target;
  const left = targetUsers[targetUsers.length - 1], right = sourceUsers[sourceUsers.length - 1];
  if ((left?.id && right?.id && left.id !== right.id) || JSON.stringify(left?.content) !== JSON.stringify(right?.content)) return target;
  let index = target.length - 1;
  while (index >= 0 && target[index]?.role !== "assistant") index--;
  if (index < 0 || target.slice(index + 1).some(message => message.role === "user")) return target;
  if (JSON.stringify(target[index]?.todos) === JSON.stringify(todos)) return target;
  return target.map((message, i) => i === index ? { ...message, todos } : message);
}

/** Keep renderer traces when it has already saved the current turn. */
export function selectAgentAutosaveMessages(
  existing: StoredMessage[],
  updated: StoredMessage[],
): StoredMessage[] {
  if (updated.length === 0) return existing;
  const userCount = (messages: StoredMessage[]) => messages.filter((m) => m.role === "user").length;
  let lastUser = existing.length - 1;
  while (lastUser >= 0 && existing[lastUser]?.role !== "user") lastUser--;
  const hasCurrentResponse = existing.slice(lastUser + 1).some((m) =>
    m.role === "assistant" && m.durationMs !== undefined &&
    (m.content || m.thinking || m.traceSteps?.length || m.toolCalls?.length),
  );
  return hasCurrentResponse && userCount(existing) >= userCount(updated) ? mergeCanonicalTodoState(existing, updated) : updated;
}
