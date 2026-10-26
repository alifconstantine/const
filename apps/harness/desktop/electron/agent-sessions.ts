/** A conversation has one owner; an old run may never release its replacement. */
export class AgentSessionRegistry<T extends { runId: string }> extends Map<string, T> {
  claim(conversationId: string, session: T): boolean {
    if (this.has(conversationId)) return false;
    this.set(conversationId, session);
    return true;
  }

  owns(conversationId: string, runId: string): boolean {
    return this.get(conversationId)?.runId === runId;
  }

  release(conversationId: string, runId: string): boolean {
    return this.owns(conversationId, runId) && this.delete(conversationId);
  }
}
