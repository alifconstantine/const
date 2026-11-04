/** Session operations never infer their target from whichever chat happens to be running. */
export function requireConversationId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(value)) throw new Error("A valid conversation ID is required");
  return value;
}

export function updateSessionMode<T extends { mode?: string; agent: { updateMode(mode: "request_review" | "ask_before_changes" | "full_access"): void } }>(
  sessions: Map<string, T>, conversationId: string, mode: "request_review" | "ask_before_changes" | "full_access",
): boolean {
  const target = sessions.get(requireConversationId(conversationId));
  if (!target) return false;
  target.agent.updateMode(mode);
  target.mode = mode;
  return true;
}
