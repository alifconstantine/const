import "../src/lib/disable-openui-devtools";
import React, { Profiler, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../src/lib/i18n";
import { SideChatTab } from "../src/components/right-pane/side-chat-tab";
import type { RightPaneTab } from "../src/components/right-pane/types";
import "../src/index.css";

const counts = { commits: 0, updates: 0 };
localStorage.setItem("const_app_language", "en");
localStorage.removeItem("const_harness_side_chat_parent");
const listeners = new Set<(event: any) => void>();
const started = new Set<(event: any) => void>();
const ended = new Set<(event: any) => void>();
let sent: any;
let steered: any;
const parentSnapshot = { conversationId: "parent", runId: "parent-run", revision: 4, status: "calling_tool", activeTool: "read", updatedAt: Date.now(), startedAt: Date.now(), objective: "Inspect project", recentOutput: "" };
window.electron = {
  getModels: async () => [{ id: "fixture-model", name: "Fixture", provider: "custom" }],
  getRunningSessions: async () => [],
  getSideReceipts: async () => ({}),
  getSessionSnapshot: async () => parentSnapshot,
  onAgentEvent: (callback: (event: any) => void) => { listeners.add(callback); return () => listeners.delete(callback); },
  onSessionStarted: (callback: (event: any) => void) => { started.add(callback); return () => started.delete(callback); },
  onSessionEnded: (callback: (event: any) => void) => { ended.add(callback); return () => ended.delete(callback); },
  sendMessage: async (payload: any) => {
    sent = payload;
    for (const callback of started) callback({ conversationId: payload.conversationId, runId: "side-run" });
    window.dispatchEvent(new Event("fixture-remount"));
    await new Promise(resolve => setTimeout(resolve, 100));
    for (const callback of listeners) callback({ conversationId: payload.conversationId, runId: "side-run", type: "done", fullContent: "Currently inspecting the project." });
    for (const callback of ended) callback({ conversationId: payload.conversationId, runId: "side-run" });
    return { success: true, messages: [...payload.messages, { role: "assistant", content: "Currently inspecting the project." }] };
  },
  steerAgent: async (payload: any) => {
    steered = payload;
    for (const callback of listeners) callback({ conversationId: payload.sourceSideChatId, type: "side_steer_receipt", instructionId: payload.instructionId, status: "consumed", runId: payload.expectedRunId });
    for (const callback of listeners) callback({ conversationId: payload.sourceSideChatId, type: "side_steer_receipt", instructionId: payload.instructionId, status: "plan_updated", runId: payload.expectedRunId });
    return { success: true };
  },
} as unknown as NonNullable<Window["electron"]>;

function Fixture() {
  const [tab, setTab] = useState<RightPaneTab>({ id: "side_conversation_fixture", type: "side_conversation", title: "Side chat", parentConversationId: "parent", project: "Outside Project", model: "fixture-model" });
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const remount = () => { setVisible(false); setTimeout(() => setVisible(true), 20); };
    window.addEventListener("fixture-remount", remount);
    return () => window.removeEventListener("fixture-remount", remount);
  }, []);
  return <Profiler id="side" onRender={() => { counts.commits++; }}>
    {visible && <SideChatTab tab={tab} parentConversationId="parent" onUpdateTab={(_id, patch) => {
      counts.updates++;
      setTab(previous => ({ ...previous, ...patch }));
    }} />}
  </Profiler>;
}

createRoot(document.getElementById("root")!).render(<I18nProvider><Fixture /></I18nProvider>);
setTimeout(() => {
  const before = { ...counts };
  setTimeout(() => {
    const editor = document.querySelector<HTMLElement>('[contenteditable="true"]');
    if (editor) {
      editor.textContent = "testing side chat";
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "testing side chat" }));
    }
    const idleCommits = counts.commits - before.commits;
    setTimeout(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')?.click();
      setTimeout(() => {
        document.querySelector<HTMLButtonElement>('button[aria-label="Send instruction to running task"]')?.click();
        setTimeout(() => {
          const result = document.createElement("output");
          result.id = "fixture-result";
          const stored = JSON.parse(localStorage.getItem("const_harness_side_chat_parent") || "[]");
          result.textContent = JSON.stringify({ idleCommits, updates: counts.updates, editor: Boolean(editor), sentKind: sent?.sessionKind, snapshot: sent?.messages?.[0]?.content?.includes("parent-run"), responseRestored: document.body.textContent?.includes("Currently inspecting the project."), steeredParent: steered?.conversationId, steeredRun: steered?.expectedRunId, receipt: document.body.textContent?.includes("The task plan was updated after delivery"), storedReceipt: stored[0]?.messages?.[0]?.instruction?.status });
          document.body.appendChild(result);
        }, 150);
      }, 300);
    }, 100);
  }, 500);
}, 1500);
