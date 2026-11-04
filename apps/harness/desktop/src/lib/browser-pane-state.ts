import type { ConversationRightPaneState } from "./conversation-store";
import type { RightPaneTab } from "../components/right-pane/types";

export function openBrowserPane(
  state: ConversationRightPaneState,
  url: string | undefined,
  options: { tabId?: string; newTab?: boolean },
  owner: { conversationId: string; project?: string; title: string },
): ConversationRightPaneState {
  const browsers = state.tabs.filter(tab => tab.type === "browser");
  const existing = !options.newTab && (options.tabId
    ? browsers.find(tab => tab.id === options.tabId)
    : browsers.find(tab => tab.id === state.activeTabId) || browsers.at(-1));
  const tab: RightPaneTab = existing
    ? { ...existing, conversationId: owner.conversationId, ...(url ? { url } : {}) }
    : { id: options.tabId || `browser_${crypto.randomUUID()}`, type: "browser", title: owner.title,
      conversationId: owner.conversationId, project: owner.project, url: url || "https://www.google.com" };
  return { ...state, isOpen: true, activeTabId: tab.id,
    tabs: existing ? state.tabs.map(item => item.id === tab.id ? tab : item) : [...state.tabs, tab] };
}

/** Keep each owner's webviews mounted while replacing only that owner's tab list. */
export function retainBrowserTabs(retained: RightPaneTab[], tabs: RightPaneTab[], conversationId: string): RightPaneTab[] {
  const current = new Map(tabs.filter(tab => tab.type === "browser").map(tab => [tab.id, { ...tab, conversationId }]));
  const next = retained.flatMap(tab => tab.conversationId !== conversationId ? [tab]
    : current.has(tab.id) ? [current.get(tab.id)!] : []);
  const existing = new Set(next.map(tab => tab.id));
  return [...next, ...[...current.values()].filter(tab => !existing.has(tab.id))];
}
