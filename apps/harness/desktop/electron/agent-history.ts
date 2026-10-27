import type { StoredMessage } from "./database";

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
  return hasCurrentResponse && userCount(existing) >= userCount(updated) ? existing : updated;
}
