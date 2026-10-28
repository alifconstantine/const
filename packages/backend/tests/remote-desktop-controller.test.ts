import { expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";
import {
  dispatchRemoteDesktop,
  type RemoteDesktopContext,
} from "../../../apps/harness/desktop/electron/remote-desktop-controller";
import { REDACTED } from "../../remote/src/desktop-security";

function setup() {
  const stored: any = {
    id: "chat",
    title: "Task",
    project: "Outside Project",
    createdAt: 1,
    updatedAt: 20,
    messages: [
      { role: "user", content: "prompt" },
      { role: "assistant", content: "live result" },
    ],
  };
  const context: RemoteDesktopContext = {
    conversationDb: {
      getConversation: vi.fn(() => stored),
      listRemoteSummaries: vi.fn(() => [{ ...stored, messages: [] }]),
      saveConversation: vi.fn(),
    },
    activeSessions: new Map<string, { runId: string }>(),
    remoteLive: new Map(),
    remoteRevisions: new Map(),
    pendingQuestions: new Map(),
    loadUserConfig: () => ({ providers: { one: { apiKey: "host-secret" } } }),
    lastAuthToken: "host-auth",
    constBrainDir: process.cwd(),
    invoke: vi.fn(async () => true),
    notify: vi.fn(),
  };
  const invoke = (channel: string, args: any[] = [], expectedRunId?: string) =>
    dispatchRemoteDesktop(
      {
        type: "desktop:invoke",
        requestId: "request",
        payload: { channel, args, expectedRunId },
      } as any,
      context,
    );
  return { context, stored, invoke };
}
test("dispatcher rejects pairing/auth IPC and executable file opening before native invocation", async () => {
  const s = setup();
  await expect(s.invoke("remote:start-session", ["token"])).rejects.toThrow(
    "REMOTE_CAPABILITY_DENIED",
  );
  await expect(s.invoke("auth:start-login")).rejects.toThrow(
    "REMOTE_CAPABILITY_DENIED",
  );
  await expect(
    s.invoke("shell:open-path", [fileURLToPath(import.meta.url)]),
  ).rejects.toThrow("REMOTE_DIRECTORY_REQUIRED");
  expect(s.context.invoke).not.toHaveBeenCalled();
});
test("aborts, approvals and question answers cannot target a replaced run", async () => {
  const s = setup();
  (s.context.activeSessions as Map<string, { runId: string }>).set("chat", {
    runId: "current",
  });
  s.context.pendingQuestions.set("question", { runId: "current" });
  await expect(s.invoke("agent:abort", ["chat"], "old")).rejects.toThrow(
    "REMOTE_STALE_RUN",
  );
  await expect(
    s.invoke(
      "agent:respond-approval",
      [
        {
          conversationId: "chat",
          approvalId: "approval",
          decision: "allow_once",
        },
      ],
      "old",
    ),
  ).rejects.toThrow("REMOTE_STALE_RUN");
  await expect(
    s.invoke(
      "agent:answer-question",
      [{ toolCallId: "question", answer: "yes" }],
      "old",
    ),
  ).rejects.toThrow("REMOTE_STALE_RUN");
  expect(s.context.invoke).not.toHaveBeenCalled();
  await expect(s.invoke("agent:abort", ["chat"], "current")).resolves.toEqual({
    ok: true,
    value: true,
  });
});
test("remote prompts use the host's authentication, and are saved before starting the agent", async () => {
  const s = setup();
  const payload = {
    conversationId: "chat",
    messages: [{ role: "user", content: "new prompt" }],
    authToken: "browser-supplied-token",
  };
  await s.invoke("agent:send-message", [payload]);
  expect(payload.authToken).toBe("host-auth");
  expect(s.context.conversationDb.saveConversation).toHaveBeenCalledWith(
    expect.objectContaining({ messages: payload.messages }),
  );
  expect(s.context.invoke).toHaveBeenCalledWith("agent:send-message", [
    payload,
  ]);
});
test("active and stale browser checkpoints cannot overwrite newer host messages", async () => {
  const s = setup();
  (s.context.activeSessions as Map<string, { runId: string }>).set("chat", {
    runId: "run",
  });
  await s.invoke("conversations:save", [
    { ...s.stored, updatedAt: 10, messages: [] },
  ]);
  expect(s.context.invoke).toHaveBeenCalledWith("conversations:save", [
    expect.objectContaining({ messages: s.stored.messages, updatedAt: 20 }),
  ]);
  expect(s.context.notify).not.toHaveBeenCalled();
});
test("settings reads mask credentials and masked saves restore the existing host value", async () => {
  const s = setup();
  vi.mocked(s.context.invoke).mockImplementation(async () =>
    s.context.loadUserConfig(),
  );
  const result = await s.invoke("config:get");
  expect(result.value.providers.one.apiKey).toBe(REDACTED);
  await s.invoke("config:save", [result.value]);
  expect(s.context.invoke).toHaveBeenLastCalledWith("config:save", [
    { providers: { one: { apiKey: "host-secret" } } },
  ]);
});

test("idle sidebar metadata saves cannot erase the transcript omitted from summaries", async () => {
  const s = setup();
  await s.invoke("conversations:save", [
    { ...s.stored, title: "Renamed", updatedAt: 30, messages: [] },
  ]);
  expect(s.context.invoke).toHaveBeenCalledWith("conversations:save", [
    expect.objectContaining({ title: "Renamed", messages: s.stored.messages }),
  ]);
});

test("conversation identifiers cannot traverse host directories through native RPC", async () => {
  const s = setup();
  for (const id of ["../escape", "C:\\escape", "a/b", "..", "a".repeat(201)]) {
    for (const [channel, args] of [
      ["conversations:save", [{ ...s.stored, id }]],
      ["conversations:get-transcript", [id]],
      ["agent:send-message", [{ conversationId: id, messages: [] }]],
      ["workspace:resolve-path", [{ conversationId: id }]],
      ["file:save-attachment", [{ conversationId: id, name: "image.png" }]],
      ["terminal:create", [{ id: "terminal", conversationId: id }]],
    ] as const) {
      await expect(s.invoke(channel, [...args])).rejects.toThrow(
        "REMOTE_INVALID_CONVERSATION_ID",
      );
    }
  }
  expect(s.context.invoke).not.toHaveBeenCalled();
  expect(s.context.conversationDb.saveConversation).not.toHaveBeenCalled();
});
