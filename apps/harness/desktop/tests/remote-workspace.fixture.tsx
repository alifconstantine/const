import "../src/lib/disable-openui-devtools";
import React from "react";
import { createRoot } from "react-dom/client";
import { AuthenticatedContent } from "../src/App";
import { ConvexClientProvider } from "../src/components/convex-provider";
import { I18nProvider } from "../src/lib/i18n";
import { RemoteRuntimeContext } from "../src/lib/remote-runtime";
import { createDesktopBridge } from "../src/lib/desktop-bridge";
import { initThemeListener } from "../src/lib/theme";
import { Toaster } from "@const/ui";
import "../src/index.css";
import "../src/remote.css";

const listeners = new Map<string, Set<(...args: any[]) => void>>();
const emit = (channel: string, ...args: any[]) => {
  for (const listener of listeners.get(channel) || []) listener({}, ...args);
};
const conversations: any[] = [
  {
    id: "preview-chat",
    title: "Review remote integration",
    project: "/workspace/const",
    model: "test-model",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        id: "one",
        role: "user",
        content: "Audit the remote workspace.",
        timestamp: Date.now() - 3000,
      },
      {
        id: "two",
        role: "assistant",
        content:
          "The workspace uses the same **desktop components**, including chat, model picker, sidepanel, and settings.\n\n<img src=x onerror=\"document.body.dataset.remoteXss='executed'\">\n\n[javascript link](javascript:alert(1))",
        timestamp: Date.now(),
        durationMs: 1500,
      },
    ],
  },
];
const tasks: any[] = [];
const config: any = {
  activeModel: "test-model",
  activeProvider: "const",
  providers: { const: { baseUrl: "https://example.invalid/v1", apiKey: "" } },
  customModels: [],
  enableBrowserUse: true,
  workspaceMemoryEnabled: true,
};
let api: any;
api = createDesktopBridge(
  {
    async invoke(channel: string, ...args: any[]) {
      if (channel === "config:get") return config;
      if (channel === "config:save") {
        Object.assign(config, args[0]);
        return config;
      }
      if (channel === "agent:get-models")
        return [
          {
            id: "test-model",
            name: "Test model",
            displayName: "Test model",
            provider: "const",
            contextWindow: 128000,
            inputTypes: ["text", "image"],
          },
        ];
      if (
        channel === "conversations:list" ||
        channel === "conversations:list-archived"
      )
        return conversations.filter(
          (c) => !!c.isArchived === (channel.endsWith("archived") || !!args[0]),
        );
      if (channel === "conversations:get")
        return conversations.find((c) => c.id === args[0]) || null;
      if (channel === "conversations:search")
        return conversations.filter((c) =>
          `${c.title} ${JSON.stringify(c.messages)}`
            .toLowerCase()
            .includes(String(args[0]).toLowerCase()),
        );
      if (channel === "conversations:save") {
        const i = conversations.findIndex((c) => c.id === args[0].id);
        if (i >= 0) conversations[i] = args[0];
        else conversations.push(args[0]);
        return true;
      }
      if (channel === "conversations:update-ui") {
        const conversation = conversations.find(c => c.id === args[0]);
        if (!conversation) return true;
        const patch = args[1];
        if (patch.rightPaneState) conversation.rightPaneState = patch.rightPaneState;
        if (patch.sideConversation) {
          const sides = conversation.sideConversations || [];
          conversation.sideConversations = [...sides.filter((side: any) => side.id !== patch.sideConversation.id), patch.sideConversation];
        }
        if (patch.deleteSideConversationId) conversation.sideConversations = (conversation.sideConversations || []).filter((side: any) => side.id !== patch.deleteSideConversationId);
        emit("conversations:changed", { conversationId: conversation.id, uiOnly: true });
        return true;
      }
      if (channel === "conversations:rename") {
        const c = conversations.find((c) => c.id === args[0]);
        if (c) c.title = args[1];
        return true;
      }
      if (channel === "conversations:pin") {
        const c = conversations.find((c) => c.id === args[0]);
        if (c) c.isPinned = args[1];
        return true;
      }
      if (channel === "conversations:get-project-pins") return [];
      if (channel === "conversations:get-paths")
        return {
          workspacePath: "D:/Projects/Const",
          taskPath: "D:/Projects/Const/.const/task",
          logPath: "D:/Projects/Const/.const/task/transcript.jsonl",
        };
      if (channel === "conversations:get-transcript")
        return { events: [], messages: [] };
      if (channel === "agent:get-running-sessions" || channel === "tasks:list")
        return [];
      if (channel === "agent:get-session-snapshot") return null;
      if (channel === "agent:generate-title") return "Remote task";
      if (channel === "agent:send-message") {
        const payload = args[0];
        const id = payload.conversationId;
        const runId = "preview-run";
        emit("agent:session-started", { conversationId: id, runId });
        await new Promise((resolve) => setTimeout(resolve, 200));
        emit("agent:stream-event", {
          type: "token",
          token: "The shared desktop chat is working in the remote browser.",
          conversationId: id,
          runId,
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
        emit("agent:stream-event", { type: "done", conversationId: id, runId });
        emit("agent:session-ended", { conversationId: id, runId });
        return {
          success: true,
          messages: [
            ...payload.messages,
            {
              role: "assistant",
              content:
                "The shared desktop chat is working in the remote browser.",
            },
          ],
        };
      }
      if (channel === "scheduled-tasks:list") return tasks;
      if (channel === "scheduled-tasks:history") return [];
      if (channel === "scheduled-tasks:create") {
        tasks.push({
          ...args[0],
          id: "preview-schedule",
          createdAt: Date.now(),
        });
        emit("scheduled-tasks:changed");
        return tasks[0];
      }
      if (channel === "marketplace:list-plugins")
        return { catalog: [], installed: [] };
      if (
        channel === "marketplace:list-installed" ||
        channel === "marketplace:search-skills"
      )
        return [];
      if (channel === "mcp:list") return { servers: [], accounts: [] };
      if (channel === "memory:list") return [];
      if (channel === "memory:get-config")
        return { workspaceMemoryEnabled: true };
      if (channel === "computer:get-capabilities")
        return { platform: "win32", available: false };
      if (channel === "browser:get-control")
        return { controller: "user", requested: false };
      if (channel === "workspace:read-directory")
        return { path: "D:/Projects/Const", entries: [] };
      if (channel === "workspace:resolve-path") return "D:/Projects/Const";
      if (channel === "workspace:list-files") return [];
      if (channel === "remote:get-status")
        return { status: "idle", connectedDevices: [] };
      return true;
    },
    send() {},
    on(channel, handler) {
      const set = listeners.get(channel) || new Set();
      set.add(handler);
      listeners.set(channel, set);
    },
    removeListener(channel, handler) {
      listeners.get(channel)?.delete(handler);
    },
  },
  { getZoomFactor: () => 1, setZoomFactor() {} },
  { getPathForFile: () => "" },
);
window.electron = api;
(window as any).__remoteFixture = {
  updateConversation(id: string, patch: any) {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) throw new Error("Unknown fixture conversation");
    Object.assign(conversation, patch);
    emit("conversations:changed", { conversationId: id });
  },
  emit,
};
localStorage.setItem("const_app_language", "en");
localStorage.setItem("const_harness_theme", "dark");
initThemeListener();
document.documentElement.classList.add("dark");
(globalThis as Record<symbol, unknown>)[
  Symbol.for("openui.devtools.autoMount")
] = true;
function Preview() {
  const [mobile, setMobile] = React.useState(innerWidth < 768);
  React.useEffect(() => {
    const resize = () => setMobile(innerWidth < 768);
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, []);
  return (
    <I18nProvider>
      <RemoteRuntimeContext.Provider
        value={{ deviceName: "desktop-studio", online: true, mobile }}
      >
        <ConvexClientProvider token="fixture" signOut={() => {}}>
          <div
            className={`remote-client ${mobile ? "remote-mobile" : "remote-desktop"}`}
          >
            <AuthenticatedContent
              onSignOut={() => {}}
              onSwitchAccount={() => {}}
            />
            <Toaster />
          </div>
        </ConvexClientProvider>
      </RemoteRuntimeContext.Provider>
    </I18nProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
