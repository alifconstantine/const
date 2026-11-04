import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PersistentBrowserStack } from "../src/components/right-pane/persistent-browser-stack";
import { browserPartition } from "../src/lib/browser-session";
import type { RightPaneTab } from "../src/components/right-pane/types";

const container = document.createElement("div");
container.style.cssText = "position:fixed;inset:0;z-index:10";
const style = document.createElement("style");
style.textContent = "[data-pane-tab-id]{position:absolute;inset:0;display:flex;visibility:visible}[data-pane-tab-id][aria-hidden=true]{opacity:0;pointer-events:none;z-index:-1}";
document.head.appendChild(style);
document.body.appendChild(container);
const root = createRoot(container);
(window as any).__renderIsolation = (ids: string[], active: string, url: string) => {
  const tabs: RightPaneTab[] = ids.map(id => ({ id, type: "browser", title: id, conversationId: id, url }));
  flushSync(() => root.render(<PersistentBrowserStack tabs={tabs} activeTabId={active} foregroundIds={new Set([active])}
    renderContent={tab => <webview id={`isolation-${tab.id}`} src={tab.url} partition={browserPartition(tab.id)}
      webpreferences="contextIsolation=yes,backgroundThrottling=no" style={{ width: 600, height: 500 }} />} />));
};
(window as any).__unmountIsolation = () => flushSync(() => root.unmount());
