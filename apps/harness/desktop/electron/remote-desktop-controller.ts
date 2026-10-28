import fs from "node:fs";
import path from "node:path";
import type { RemoteCommand } from "@const/remote/protocol";
import { isDesktopChannel } from "@const/remote/desktop-contract";
import {
  assertSafeRemoteValue,
  redactRemoteConfig,
  restoreRemoteConfig,
} from "@const/remote/desktop-security";
import type { ConversationDatabase } from "./database";

export interface RemoteDesktopContext {
  conversationDb: Pick<
    ConversationDatabase,
    "getConversation" | "saveConversation" | "listRemoteSummaries"
  >;
  activeSessions: {
    get(id: string): { runId: string } | undefined;
    has(id: string): boolean;
    keys(): IterableIterator<string>;
  };
  remoteLive: Map<string, any>;
  remoteRevisions: Map<string, { runId: string; revision: number }>;
  pendingQuestions: Map<string, { runId: string }>;
  loadUserConfig: () => any;
  lastAuthToken: string | null;
  constBrainDir: string;
  invoke: (channel: string, args: any[]) => any;
  notify: (channel: string, payload: any) => void;
}

/** This boundary is shared by UI operations, never by arbitrary Electron IPC. */
export async function dispatchRemoteDesktop(
  command: Extract<RemoteCommand, { type: "desktop:invoke" }>,
  context: RemoteDesktopContext,
) {
  if (!isDesktopChannel(command.payload.channel))
    throw new Error("REMOTE_CAPABILITY_DENIED");
  const {
    conversationDb,
    activeSessions,
    remoteLive,
    remoteRevisions,
    pendingQuestions,
    loadUserConfig,
    lastAuthToken,
    constBrainDir,
    invoke,
    notify,
  } = context;

  const { channel, expectedRunId } = command.payload;
  const args = command.payload.args as any[];
  assertSafeRemoteValue(args);
  // Conversation IDs become directory names in the native handlers. They must
  // remain a single path component even when a paired client sends raw RPC.
  const validateId = (id: unknown, optional = false) => {
    if (optional && (id === undefined || id === null || id === "")) return;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(id))
      throw new Error("REMOTE_INVALID_CONVERSATION_ID");
  };
  for (const value of args) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const key of [
        "conversationId",
        "parentConversationId",
        "sideChatId",
        "sourceSideChatId",
      ])
        if (key in value) validateId(value[key], true);
    }
  }
  if (channel === "conversations:save") validateId(args[0]?.id);
  if (
    [
      "conversations:get",
      "conversations:delete",
      "conversations:rename",
      "conversations:archive",
      "conversations:unarchive",
      "conversations:pin",
      "conversations:get-transcript",
      "agent:get-session-snapshot",
      "agent:get-side-receipts",
      "agent:abort",
    ].includes(channel)
  )
    validateId(args[0]);
  if (channel === "conversations:get-paths") validateId(args[0], true);
  if (channel === "agent:generate-title") args[1] = lastAuthToken || undefined;
  if (channel === "marketplace:open-skills-folder") {
    const payload = args[0];
    const directory =
      payload?.scope === "workspace" &&
      payload.workspacePath &&
      payload.workspacePath !== "Outside Project"
        ? path.join(payload.workspacePath, ".agents", "skills")
        : path.join(constBrainDir, "..", "skills");
    fs.mkdirSync(directory, { recursive: true });
    return { ok: true, value: { __remoteDirectory: path.resolve(directory) } };
  }
  if (
    channel === "file:read-as-data-url" &&
    (typeof args[0] !== "string" || fs.statSync(args[0]).size > 5_500_000)
  )
    throw new Error("REMOTE_TRANSFER_LIMIT");
  if (
    [
      "shell:open-path",
      "shell:show-in-folder",
      "system:open-const-folder",
      "memory:open-in-folder",
    ].includes(channel)
  ) {
    const target =
      channel === "system:open-const-folder"
        ? path.resolve(constBrainDir, "../..")
        : args[0];
    if (typeof target !== "string" || target.length > 4096)
      throw new Error("REMOTE_INVALID_ARGUMENT");
    const stat = fs.statSync(target);
    if (channel === "shell:open-path" && !stat.isDirectory())
      throw new Error("REMOTE_DIRECTORY_REQUIRED");
    return {
      ok: true,
      value: {
        __remoteDirectory: stat.isDirectory()
          ? path.resolve(target)
          : path.dirname(path.resolve(target)),
      },
    };
  }
  let conversationChanged = channel !== "conversations:save";
  if (channel === "agent:get-running-sessions") {
    return {
      ok: true,
      value: Array.from(activeSessions.keys()).map((conversationId) => ({
        conversationId,
        runId: activeSessions.get(conversationId)?.runId,
      })),
    };
  }
  if (channel === "conversations:get") {
    const value = conversationDb.getConversation(args[0]);
    const live = remoteLive.get(args[0]);
    const runId = activeSessions.get(args[0])?.runId;
    return {
      ok: true,
      value: value
        ? {
            ...value,
            __remoteLive: live && runId ? { ...live, runId } : undefined,
            __remoteRevision:
              live && runId
                ? { runId, revision: live.revision }
                : remoteRevisions.get(args[0]),
          }
        : null,
    };
  }
  if (
    channel === "conversations:list" ||
    channel === "conversations:list-archived"
  ) {
    const rows = conversationDb.listRemoteSummaries(
      channel.endsWith("archived") || !!args[0],
    );
    return {
      ok: true,
      value: channel.endsWith("archived")
        ? rows.filter((row) => row.isArchived)
        : rows,
    };
  }
  if (channel === "conversations:save" && args[0]?.id) {
    const stored = conversationDb.getConversation(args[0].id);
    // Lists contain metadata only, so saves from a sidebar action can have an
    // empty transcript. Only send-message replaces authoritative host history.
    if (stored)
      args[0] = {
        ...args[0],
        messages: stored.messages,
        telemetry: stored.telemetry,
        createdAt: stored.createdAt,
        updatedAt:
          activeSessions.has(stored.id) || args[0].updatedAt < stored.updatedAt
            ? stored.updatedAt
            : Date.now(),
      };
    const fields = [
      "title",
      "project",
      "model",
      "mode",
      "isPinned",
      "isArchived",
      "messages",
    ];
    conversationChanged =
      !stored ||
      fields.some(
        (key) =>
          JSON.stringify((stored as any)[key]) !== JSON.stringify(args[0][key]),
      );
  }
  if (
    channel === "agent:abort" ||
    channel === "agent:steer" ||
    channel === "agent:respond-approval" ||
    channel === "agent:update-mode"
  ) {
    const id = channel === "agent:abort" ? args[0] : args[0]?.conversationId;
    if (
      !id ||
      ((channel !== "agent:update-mode" || activeSessions.has(id)) &&
        (!expectedRunId || activeSessions.get(id)?.runId !== expectedRunId))
    )
      throw new Error("REMOTE_STALE_RUN");
  }
  if (
    channel === "agent:answer-question" &&
    (!expectedRunId ||
      pendingQuestions.get(args[0]?.toolCallId)?.runId !== expectedRunId)
  )
    throw new Error("REMOTE_STALE_RUN");
  if (channel === "agent:send-message") {
    if (!args[0]?.conversationId || !Array.isArray(args[0]?.messages))
      throw new Error("REMOTE_INVALID_ARGUMENT");
    const payload = args[0];
    const existing = conversationDb.getConversation(payload.conversationId);
    if (activeSessions.has(payload.conversationId))
      throw new Error("REMOTE_ALREADY_RUNNING");
    const now = Date.now();
    conversationDb.saveConversation({
      ...existing,
      id: payload.conversationId,
      title:
        existing?.title ||
        String(
          payload.messages.find((message: any) => message.role === "user")
            ?.content || payload.conversationId,
        ).slice(0, 80),
      project: payload.workspacePath || "Outside Project",
      messages: payload.messages,
      model: payload.model || existing?.model,
      mode: payload.mode || "ask_before_changes",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    notify("conversations:changed", {
      conversationId: payload.conversationId,
      remoteMessages: payload.messages,
      originRequestId: command.requestId,
    });
    args[0].authToken = lastAuthToken || undefined;
  }
  if (channel === "config:save")
    args[0] = restoreRemoteConfig(args[0], loadUserConfig());
  const result = await invoke(channel, args);
  if (
    conversationChanged &&
    channel.startsWith("conversations:") &&
    [
      "save",
      "delete",
      "rename",
      "archive",
      "unarchive",
      "pin",
      "pin-project",
    ].includes(channel.split(":")[1]!)
  )
    notify("conversations:changed", {
      conversationId: typeof args[0] === "string" ? args[0] : args[0]?.id,
      originRequestId: command.requestId,
    });
  return {
    ok: true,
    value:
      channel === "config:get" || channel === "config:save"
        ? redactRemoteConfig(result)
        : result,
  };
}
