export const BROWSER_PARTITION = "persist:const_browser";

/** Storage belongs to a conversation, even when two previews use the same origin. */
export function browserPartition(conversationId?: string): string {
  return conversationId ? `${BROWSER_PARTITION}_session_${encodeURIComponent(conversationId)}` : BROWSER_PARTITION;
}

export function isBrowserPartition(partition: string): boolean {
  return partition === BROWSER_PARTITION || /^persist:const_browser_session_[A-Za-z0-9%_.!~*'()-]+$/.test(partition);
}
