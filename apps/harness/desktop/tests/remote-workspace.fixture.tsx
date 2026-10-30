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
import { RemoteDirectoryPicker } from "../src/components/remote-directory-picker";
import { RemoteWorkspaceBoundary } from "../src/components/remote-workspace-boundary";
import { RemotePullToRefresh } from "../src/components/remote-pull-to-refresh";
import { scopedRemoteStorage } from "../src/lib/remote-storage";
import { installRemotePullToRefresh } from "../src/lib/remote-pull-to-refresh";
import { marked } from "marked";
import { RemoteControlModal } from "../src/components/remote-control-modal";
import type { RemoteDaemonStatus } from "../src/lib/remote-control";
import "../src/index.css";
import "../src/remote.css";

const listeners = new Map<string, Set<(...args: any[]) => void>>();
// Count actual parser work to catch expensive history renders on panel toggles.
const markdownWork = { blocks: 0, inline: 0 };
const lex = marked.lexer.bind(marked);
const parseInline = marked.parseInline.bind(marked);
marked.lexer = (...args) => { markdownWork.blocks++; return lex(...args); };
marked.parseInline = (...args) => { markdownWork.inline++; return parseInline(...args); };
scopedRemoteStorage("fixture");
if (new URLSearchParams(location.search).has("landing")) localStorage.removeItem("const_harness_active_conversation_id");
let directoryResolver: ((path: string | null) => void) | undefined;
const emit = (channel: string, ...args: any[]) => {
  for (const listener of listeners.get(channel) || []) listener({}, ...args);
};
const conversations: any[] = [
  {
    id: "preview-chat",
    title: "Review remote integration",
    project: "/workspace/const",
    model: "test-model",
    telemetry: {
      version: 1,
      requests: { "preview-request": { requestId: "preview-request", model: "test-model", startedAt: Date.now(), promptTokens: 1200, completionTokens: 600, totalTokens: 1800, cacheReadTokens: 500, durationMs: 2000, status: "completed" } },
      context: { usedTokens: 6400, totalTokens: 128000, model: "test-model", updatedAt: Date.now() },
    },
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
const longMenus = new URLSearchParams(location.search).has("long-menus");
if (longMenus) {
  for (let index = 1; index <= 24; index++) conversations.push({
    id: `preview-project-${index}`, title: `Workspace ${index}`, project: `/workspace/project-${index}`,
    createdAt: Date.now(), updatedAt: Date.now(), messages: [],
  });
}
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
let remoteStatus: RemoteDaemonStatus = {
  status: "idle", deviceId: "fixture-desktop", sessionId: null, pairingUrl: null,
  pairingCode: null, localBridgeUrl: null, expiresAt: null, connectedDevices: [], transport: "relay",
};
let pairingRevision = 0;
let remoteActionError: string | null = null;
function updateRemoteStatus(patch: Partial<RemoteDaemonStatus>) {
  remoteStatus = { ...remoteStatus, ...patch };
  emit("remote:status-changed", remoteStatus);
  return remoteStatus;
}
api = createDesktopBridge(
  {
    async invoke(channel: string, ...args: any[]) {
      if (["remote:start-session", "remote:refresh-session", "remote:stop-session"].includes(channel)) {
        if (remoteActionError) throw new Error(remoteActionError);
        if (channel === "remote:stop-session") return updateRemoteStatus({ status: "idle", sessionId: null, pairingUrl: null, pairingCode: null, expiresAt: null, connectedDevices: [] });
        pairingRevision++;
        return updateRemoteStatus({ status: "waiting", sessionId: `fixture-${pairingRevision}`, pairingUrl: `https://harness.const.web.id/r/fixture-${pairingRevision}#key=${"x".repeat(43)}`, pairingCode: pairingRevision % 2 ? "ABC-234" : "XYZ-789", expiresAt: Date.now() + 15 * 60_000, connectedDevices: [] });
      }
      if (channel === "config:get") return config;
      if (channel === "dialog:open-directory") return new Promise(resolve => {
        directoryResolver?.(null);
        directoryResolver = resolve;
        window.dispatchEvent(new Event("fixture:open-directory"));
      });
      if (channel === "usage:list") return conversations.flatMap(conversation => Object.values(conversation.telemetry?.requests || {}).map((request: any) => ({ id: `llm_${conversation.id}_${request.requestId}`, requestId: `llm_${conversation.id}_${request.requestId}`, conversationId: conversation.id, model: request.model, promptTokens: request.promptTokens, completionTokens: request.completionTokens, totalTokens: request.totalTokens, durationMs: request.durationMs, status: 200, createdAt: request.startedAt })));
      if (channel === "config:save") {
        Object.assign(config, args[0]);
        return config;
      }
      if (channel === "agent:get-models")
        return Array.from({ length: longMenus ? 30 : 1 }, (_, index) => (
          {
            id: index ? `test-model-${index}` : "test-model",
            name: index ? `Test model ${index}` : "Test model",
            displayName: index ? `Test model ${index}` : "Test model",
            provider: "const",
            contextWindow: 128000,
            inputTypes: ["text", "image"],
          }
        ));
      if (
        channel === "conversations:list" ||
        channel === "conversations:list-archived"
      )
        return conversations.filter(
          (c) => !!c.isArchived === (channel.endsWith("archived") || !!args[0]),
        ).map(({ messages: _messages, telemetry: _telemetry, sideConversations: _sides, rightPaneState: _pane, ...summary }) => ({ ...summary, messages: [], __remoteSummary: true }));
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
        return args[0] ? [] : [{ name: "mobile-picked", path: "mobile-picked", isDirectory: true, size: 0, lastModified: Date.now() }];
      if (channel === "workspace:resolve-path") return "D:/Projects/Const";
      if (channel === "workspace:list-files") return [];
      if (channel === "remote:get-status")
        return remoteStatus;
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
  markdownWork,
  updateRemoteStatus,
  setRemoteActionError(error: string | null) { remoteActionError = error; },
  installRemotePullToRefresh,
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
  const [directoryPicker, setDirectoryPicker] = React.useState(false);
  const [crash, setCrash] = React.useState(false);
  React.useEffect(() => {
    const fail = () => setCrash(true);
    addEventListener("fixture:crash", fail);
    return () => removeEventListener("fixture:crash", fail);
  }, []);
  React.useEffect(() => {
    const open = () => setDirectoryPicker(true);
    addEventListener("fixture:open-directory", open);
    return () => { removeEventListener("fixture:open-directory", open); directoryResolver?.(null); directoryResolver = undefined; };
  }, []);
  React.useEffect(() => {
    const resize = () => {
      setMobile(innerWidth < 768);
      document.body.classList.toggle("remote-mobile-root", innerWidth < 768);
      document.documentElement.style.setProperty("--remote-height", `${visualViewport?.height || innerHeight}px`);
    };
    resize();
    addEventListener("resize", resize);
    return () => {
      removeEventListener("resize", resize);
      document.body.classList.remove("remote-mobile-root");
      document.documentElement.style.removeProperty("--remote-height");
    };
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
            <RemotePullToRefresh enabled={mobile}>
              {crash ? <Crash /> : <AuthenticatedContent
                onSignOut={() => {}}
                onSwitchAccount={() => {}}
              />}
            </RemotePullToRefresh>
            {directoryPicker && <RemoteDirectoryPicker initialPath="/workspace" select={async path => {
              directoryResolver?.(path); directoryResolver = undefined; setDirectoryPicker(false);
            }} close={() => { directoryResolver?.(null); directoryResolver = undefined; setDirectoryPicker(false); }} />}
            <Toaster />
          </div>
        </ConvexClientProvider>
      </RemoteRuntimeContext.Provider>
    </I18nProvider>
  );
}
function Crash(): React.ReactNode { throw new Error("Fixture render failure"); }
function HostControlPreview() {
  const [open, setOpen] = React.useState(true);
  return <I18nProvider><ConvexClientProvider token="fixture" signOut={() => {}}>
    <button onClick={() => setOpen(true)}>Open remote control fixture</button>
    <RemoteControlModal isOpen={open} onClose={() => setOpen(false)} />
  </ConvexClientProvider></I18nProvider>;
}
createRoot(document.getElementById("root")!).render(
  <I18nProvider><RemoteWorkspaceBoundary>{new URLSearchParams(location.search).has("host-control") ? <HostControlPreview /> : <Preview />}</RemoteWorkspaceBoundary></I18nProvider>,
);
