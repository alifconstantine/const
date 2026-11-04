import assert from "node:assert/strict";
import { test } from "node:test";
import { openBrowserPane, retainBrowserTabs } from "./browser-pane-state";
import type { ConversationRightPaneState } from "./conversation-store";
import { createDesktopBridge } from "./desktop-bridge";

const empty = (): ConversationRightPaneState => ({ isOpen: false, tabs: [], activeTabId: null });
const owner = (conversationId: string) => ({ conversationId, project: "same-project", title: "Browser" });

test("two chats in one project open different browser tabs and only update their own pane", () => {
  const a = openBrowserPane(empty(), "https://a.test", { tabId: "a-tab" }, owner("a"));
  const b = openBrowserPane(empty(), "https://b.test", { tabId: "b-tab" }, owner("b"));
  const nextB = openBrowserPane(b, "https://b.test/next", {}, owner("b"));
  assert.equal(a.tabs[0]!.url, "https://a.test");
  assert.equal(nextB.tabs[0]!.id, "b-tab");
  assert.equal(nextB.tabs[0]!.conversationId, "b");
  assert.equal(nextB.tabs[0]!.url, "https://b.test/next");
  assert.equal(nextB.tabs.length, 1);
});

test("retaining guests across chat switches keeps object identity and removes closed tabs", () => {
  const a = openBrowserPane(empty(), undefined, { tabId: "a-tab" }, owner("a"));
  const b = openBrowserPane(empty(), undefined, { tabId: "b-tab" }, owner("b"));
  const retained = retainBrowserTabs([], a.tabs, "a");
  const switched = retainBrowserTabs(retained, b.tabs, "b");
  assert.equal(switched[0], retained[0]);
  assert.deepEqual(switched.map(tab => tab.id), ["a-tab", "b-tab"]);
  assert.deepEqual(retainBrowserTabs(switched, [], "a").map(tab => tab.id), ["b-tab"]);
  assert.deepEqual(retainBrowserTabs(switched, a.tabs, "a").map(tab => tab.id), ["a-tab", "b-tab"]);
});

test("task output, undo, terminals and subagent controls preserve their explicit owner through the bridge", async () => {
  const calls: unknown[][] = [];
  const api = createDesktopBridge({ async invoke(...args: unknown[]) { calls.push(args); return true; }, send() {}, on() {}, removeListener() {} }, { setZoomFactor() {}, getZoomFactor: () => 1 }, { getPathForFile: () => "" });
  await api.getBackgroundTaskLogs("job-b", "b");
  await api.killBackgroundTask("job-b", "b");
  await api.killSubAgent("worker-b", "b");
  await api.rollbackFile({ id: "mutation-b" }, "b");
  await api.terminal.write({ id: "terminal-b", data: "pwd\n", conversationId: "b" });
  await api.terminal.destroy("terminal-b", "b");
  assert.deepEqual(calls, [
    ["tasks:get-output", "job-b", "b"], ["tasks:kill", "job-b", "b"], ["subagents:kill", "worker-b", "b"],
    ["agent:rollback-file", { record: { id: "mutation-b" }, conversationId: "b" }],
    ["terminal:write", { id: "terminal-b", data: "pwd\n", conversationId: "b" }], ["terminal:destroy", "terminal-b", "b"],
  ]);
});

test("an explicit new-tab request never reuses another existing tab", () => {
  const a = openBrowserPane(empty(), "https://a.test", { tabId: "a-tab" }, owner("a"));
  const next = openBrowserPane(a, "https://second.test", { tabId: "second", newTab: true }, owner("a"));
  assert.equal(next.activeTabId, "second");
  assert.equal(next.tabs.length, 2);
  assert.equal(next.tabs[0]!.url, "https://a.test");
});

test("the desktop transport preserves browser ownership and the target of help actions", async () => {
  const calls: unknown[][] = [];
  const api = createDesktopBridge({
    async invoke(...args: unknown[]) { calls.push(args); return true; },
    send() {}, on() {}, removeListener() {},
  }, { setZoomFactor() {}, getZoomFactor: () => 1 }, { getPathForFile: () => "" });
  await api.browser.registerTab("tab-b", 42, "b");
  await api.browser.setActiveTab("tab-b", "b");
  await api.browser.listTabs("b");
  await api.browser.getControl("tab-b");
  await api.browser.releaseControl("tab-b");
  await api.browser.openTab("https://b.test", { tabId: "tab-b", conversationId: "b" });
  await api.browser.unregisterTab("tab-b", 42);
  assert.deepEqual(calls, [
    ["browser:register-tab", { tabId: "tab-b", guestContentsId: 42, conversationId: "b" }],
    ["browser:set-active-tab", "tab-b", "b"],
    ["browser:list-tabs", "b"],
    ["browser:get-control", "tab-b"],
    ["browser:release-control", "tab-b"],
    ["browser:open-tab", { url: "https://b.test", tabId: "tab-b", conversationId: "b" }],
    ["browser:unregister-tab", "tab-b", 42],
  ]);
});
