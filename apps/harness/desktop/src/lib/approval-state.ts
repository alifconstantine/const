interface ApprovalIdentity {
  id?: string;
  approvalId?: string;
}

export function approvalResponseKey(conversationId: string, approvalId: string): string {
  return JSON.stringify([conversationId, approvalId]);
}

/** Both the stream event and IPC acknowledgement may resolve the same request. */
export function removeMatchingApproval<T extends ApprovalIdentity>(
  pending: Map<string, T>, conversationId: string, approvalId: string,
): Map<string, T> {
  const current = pending.get(conversationId);
  if (!current || (current.approvalId || current.id) !== approvalId) return pending;
  const next = new Map(pending);
  next.delete(conversationId);
  return next;
}

/** Acquires synchronously, before React can render a disabled button. */
export class ApprovalResponseGate {
  private pending = new Set<string>();

  async run<T>(key: string, submit: () => Promise<T>): Promise<T | undefined> {
    if (this.pending.has(key)) return undefined;
    this.pending.add(key);
    try {
      return await submit();
    } finally {
      this.pending.delete(key);
    }
  }
}
