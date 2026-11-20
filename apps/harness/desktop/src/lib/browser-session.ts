export const BROWSER_PARTITION = "persist:const_browser";

/**
 * All Harness workspaces and conversations intentionally share one persistent
 * browser session/profile so logins (Google, GitHub, etc.) carry over everywhere.
 */
export function browserPartition(_conversationId?: string): string {
  return BROWSER_PARTITION;
}

export function isBrowserPartition(partition: string): boolean {
  return partition === BROWSER_PARTITION || /^persist:const_browser_session_[A-Za-z0-9%_.!~*'()-]+$/.test(partition);
}
