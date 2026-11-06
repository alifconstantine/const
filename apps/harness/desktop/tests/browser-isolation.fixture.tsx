import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { BrowserTab } from "../src/components/right-pane/browser-tab";
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

function SearchFixture({ url }: { url: string }) {
  const [tab, setTab] = useState<RightPaneTab>({
    id: "search-test", conversationId: "search-test", type: "browser", title: "Browser", url,
  });
  return <BrowserTab tab={tab} onUpdateTab={(_id, updates) => setTab(current => ({ ...current, ...updates }))} />;
}

(window as any).__renderSearch = (url: string) => flushSync(() => root.render(<SearchFixture url={url} />));
(window as any).__submitSearch = (query: string) => {
  const input = container.querySelector("input")!;
  flushSync(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, query);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  flushSync(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
};
