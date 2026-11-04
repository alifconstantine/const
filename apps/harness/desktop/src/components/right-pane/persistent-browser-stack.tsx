import type { ReactNode } from "react";
import type { RightPaneTab } from "./types";

/** Guests keep their DOM position when the active conversation or tab order changes. */
export function PersistentBrowserStack({ tabs, activeTabId, foregroundIds, renderContent }: {
  tabs: RightPaneTab[];
  activeTabId: string | null;
  foregroundIds: ReadonlySet<string>;
  renderContent: (tab: RightPaneTab) => ReactNode;
}) {
  return [...tabs].sort((a, b) => a.id.localeCompare(b.id)).map(tab => {
    const active = tab.id === activeTabId && foregroundIds.has(tab.id);
    return <div key={tab.id} data-pane-tab-id={tab.id} role="tabpanel" aria-label={tab.title}
      aria-hidden={!active} inert={!active}
      className={`w-full h-full min-h-0 flex flex-col ${active ? "flex-1 relative z-10" : "absolute inset-0 opacity-0 pointer-events-none -z-10"}`}
      style={{ display: "flex", visibility: "visible" }}>
      {renderContent(tab)}
    </div>;
  });
}
