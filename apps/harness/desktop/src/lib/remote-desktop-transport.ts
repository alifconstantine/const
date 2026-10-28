import type { RemoteClient } from "@const/remote/client";
import {
  desktopEvents,
  isDesktopChannel,
} from "@const/remote/desktop-contract";
import type { RemotePacket } from "@const/remote/protocol";
import type { DesktopTransport } from "./desktop-bridge";

/** The desktop preload contract backed by the authenticated, encrypted relay. */
export function remoteDesktopTransport(
  peer: RemoteClient,
  onResync: () => void,
  chooseDirectory?: () => Promise<string | null>,
) {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  const runs = new Map<string, string>();
  const ownRequests = new Map<string, number>();
  const sequences = new Map<string, { runId: string; revision: number }>();
  const questions = new Map<string, string>();
  const hydrating = new Map<string, { dirty: boolean; metadata: any }>();
  const snapshots = new Map<
    string,
    { packets: RemotePacket[]; timer?: ReturnType<typeof setTimeout> }
  >();
  const fragments = new Map<
    string,
    { parts: string[]; count: number; at: number }
  >();
  let active = 0;
  let disposed = false;
  const waiting: Array<() => void> = [];
  const emit = (channel: string, ...args: any[]) => {
    for (const callback of listeners.get(channel) || []) callback({}, ...args);
  };
  const hydrateConversation = (metadata: any) => {
    const id = metadata?.conversationId;
    if (typeof id !== "string") return;
    const pending = hydrating.get(id);
    if (pending) {
      pending.dirty = true;
      pending.metadata = metadata;
      return;
    }
    const state = { dirty: false, metadata };
    hydrating.set(id, state);
    void (async () => {
      try {
        do {
          state.dirty = false;
          const conversation = await invokeRaw("conversations:get", id);
          if (!disposed)
            emit("conversations:changed", {
              ...state.metadata,
              remoteMessages: conversation?.messages,
            });
        } while (state.dirty && !disposed);
      } catch {
        if (!disposed) emit("conversations:changed", state.metadata);
      } finally {
        hydrating.delete(id);
      }
    })();
  };
  const observeRuns = (channel: string, value: any) => {
    if (
      channel === "agent:session-started" &&
      value?.conversationId &&
      value.runId
    ) {
      runs.set(value.conversationId, value.runId);
      if (sequences.get(value.conversationId)?.runId !== value.runId)
        sequences.set(value.conversationId, {
          runId: value.runId,
          revision: 0,
        });
    }
    if (
      channel === "agent:session-ended" &&
      runs.get(value?.conversationId) === value.runId
    )
      runs.delete(value.conversationId);
    if (
      channel === "agent:stream-event" &&
      value?.type === "ask_question" &&
      value.toolCallId &&
      value.runId
    )
      questions.set(value.toolCallId, value.runId);
    if (channel === "agent:stream-event" && value?.type === "question_resolved")
      questions.delete(value.toolCallId);
  };
  const event = (packet: RemotePacket) => {
    if (disposed) return;
    if (packet.type === "resync") {
      fragments.clear();
      onResync();
      return;
    }
    if (packet.type === "desktop:event-part") {
      for (const [id, value] of fragments)
        if (Date.now() - value.at > 60_000) fragments.delete(id);
      const { id, index, count, data } = packet as any;
      if (
        typeof id !== "string" ||
        !Number.isInteger(index) ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > 250 ||
        index < 0 ||
        index >= count ||
        typeof data !== "string" ||
        data.length > 8000 ||
        fragments.size > 16
      )
        return;
      const value = fragments.get(id) || { parts: [], count, at: Date.now() };
      if (value.count !== count) return;
      value.parts[index] = data;
      fragments.set(id, value);
      if (value.parts.filter((part) => part !== undefined).length === count) {
        fragments.delete(id);
        try {
          event(JSON.parse(value.parts.join("")));
        } catch {
          onResync();
        }
      }
      return;
    }
    if (
      packet.type !== "desktop:event" ||
      !desktopEvents.has(String(packet.channel)) ||
      !Array.isArray(packet.args)
    )
      return;
    if (
      packet.channel === "conversations:changed" &&
      ownRequests.has(packet.args[0]?.originRequestId)
    )
      return;
    const value = packet.args[0];
    if (packet.channel === "conversations:changed" && value?.conversationId) {
      hydrateConversation(value);
      return;
    }
    const snapshot = snapshots.get(value?.conversationId);
    if (snapshot && String(packet.channel).startsWith("agent:")) {
      if (snapshot.packets.length < 1000) snapshot.packets.push(packet);
      else onResync();
      return;
    }
    if (
      packet.channel === "agent:stream-event" &&
      typeof value?.remoteSequence === "number" &&
      value.runId
    ) {
      const previous = sequences.get(value.conversationId);
      if (
        previous &&
        previous.runId === value.runId &&
        value.remoteSequence <= previous.revision
      )
        return;
      sequences.set(value.conversationId, {
        runId: value.runId,
        revision: value.remoteSequence,
      });
    }
    const newRun =
      packet.channel === "agent:session-started" &&
      value?.runId &&
      runs.get(value.conversationId) !== value.runId;
    observeRuns(String(packet.channel), packet.args[0]);
    emit(String(packet.channel), ...packet.args);
    if (newRun) hydrateConversation({ conversationId: value.conversationId });
  };
  const invokeRaw = async (channel: string, ...args: any[]): Promise<any> => {
    if (disposed) throw new Error("REMOTE_DISCONNECTED");
    if (channel === "window:is-maximized") return false;
    if (
      channel === "window:set-theme-mode" ||
      channel === "window:set-zoom-factor"
    )
      return true;
    if (channel === "auth:open-external") {
      const url = new URL(args[0]);
      if (!["https:", "http:", "mailto:"].includes(url.protocol))
        throw new Error("REMOTE_UNSAFE_URL");
      window.open(url.href, "_blank", "noopener,noreferrer");
      return true;
    }
    if (channel === "remote:get-status")
      return { status: "idle", connectedDevices: [] };
    if (
      channel === "browser:register-tab" ||
      channel === "browser:unregister-tab" ||
      channel === "conversations:import-legacy"
    )
      return undefined;
    if (channel === "system:show-notification") return false;
    if (channel === "dialog:open-directory" && chooseDirectory)
      return await chooseDirectory();
    if (!isDesktopChannel(channel)) throw new Error("REMOTE_CAPABILITY_DENIED");
    const long = channel === "agent:send-message";
    if (!long && active >= 6)
      await new Promise<void>((resolve) => waiting.push(resolve));
    if (disposed) throw new Error("REMOTE_DISCONNECTED");
    if (!long) active++;
    const conversationId =
      channel === "agent:abort" ? args[0] : args[0]?.conversationId;
    const snapshotId =
      ["conversations:get", "agent:get-session-snapshot"].includes(channel) &&
      typeof args[0] === "string"
        ? (args[0] as string)
        : null;
    const snapshot = snapshotId
      ? ({ packets: snapshots.get(snapshotId)?.packets || [] } as {
          packets: RemotePacket[];
          timer?: ReturnType<typeof setTimeout>;
        })
      : null;
    if (snapshotId && snapshot) {
      const previous = snapshots.get(snapshotId);
      if (previous?.timer) clearTimeout(previous.timer);
      snapshots.set(snapshotId, snapshot);
    }
    let snapshotReleased = false;
    const releaseSnapshot = (value?: any) => {
      if (!snapshotId || !snapshot || snapshots.get(snapshotId) !== snapshot)
        return;
      snapshotReleased = true;
      if (value?.__remoteRevision)
        sequences.set(snapshotId, value.__remoteRevision);
      const live = value?.__remoteLive;
      if (live?.runId) {
        runs.set(snapshotId, live.runId);
        if (channel === "conversations:get" && live.text) {
          const messages = [...(value.messages || [])];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            if (
              typeof last.content === "string" &&
              last.content.length < live.text.length
            )
              messages[messages.length - 1] = { ...last, content: live.text };
          } else
            messages.push({
              id: `${live.runId}_live`,
              role: "assistant",
              content: live.text,
              timestamp: Date.now(),
            });
          value.messages = messages;
        }
      }
      snapshot.timer = setTimeout(() => {
        if (disposed || snapshots.get(snapshotId) !== snapshot) return;
        snapshots.delete(snapshotId);
        if (live?.runId) {
          event({
            type: "desktop:event",
            channel: "agent:session-started",
            args: [{ conversationId: snapshotId, runId: live.runId }],
          });
          if (live.approval)
            event({
              type: "desktop:event",
              channel: "agent:stream-event",
              args: [
                {
                  ...live.approval,
                  conversationId: snapshotId,
                  runId: live.runId,
                },
              ],
            });
          if (live.questions)
            event({
              type: "desktop:event",
              channel: "agent:stream-event",
              args: [
                {
                  type: "ask_question",
                  ...live.questions,
                  conversationId: snapshotId,
                  runId: live.runId,
                },
              ],
            });
        }
        for (const packet of snapshot.packets) event(packet);
      }, 0);
    };
    try {
      for (const [id, at] of ownRequests)
        if (Date.now() - at > 120_000) ownRequests.delete(id);
      const requestId = crypto.randomUUID();
      ownRequests.set(requestId, Date.now());
      const expectedRunId =
        channel === "agent:answer-question"
          ? questions.get(args[0]?.toolCallId)
          : runs.get(conversationId);
      const response = await peer.request(
        { type: "desktop:invoke", payload: { channel, args, expectedRunId } },
        requestId,
        long ? 8 * 60 * 60_000 : 60_000,
      );
      if (!response?.ok)
        throw new Error(response?.error || "REMOTE_COMMAND_FAILED");
      const value = response.value;
      if (typeof value?.__remoteDirectory === "string") {
        window.dispatchEvent(
          new CustomEvent("const:remote-open-directory", {
            detail: value.__remoteDirectory,
          }),
        );
        return true;
      }
      if (channel === "agent:get-running-sessions" && Array.isArray(value)) {
        for (const session of value)
          if (session.runId) {
            runs.set(session.conversationId, session.runId);
            queueMicrotask(() => {
              if (!disposed)
                event({
                  type: "desktop:event",
                  channel: "agent:session-started",
                  args: [session],
                });
            });
          }
        return value.map((session) =>
          typeof session === "string" ? session : session.conversationId,
        );
      }
      if (channel === "agent:get-session-snapshot" && value?.runId)
        runs.set(args[0], value.runId);
      releaseSnapshot(value);
      return value;
    } finally {
      if (!snapshotReleased) releaseSnapshot();
      if (!long) {
        active--;
        waiting.shift()?.();
      }
    }
  };
  const terminals = new Map<
    string,
    {
      data: string;
      running: boolean;
      timer?: ReturnType<typeof setTimeout>;
      waiters: Array<{
        resolve: (value: any) => void;
        reject: (error: unknown) => void;
      }>;
    }
  >();
  const flushTerminal = async (id: string) => {
    const queue = terminals.get(id);
    if (!queue || queue.running) return;
    queue.running = true;
    try {
      while (queue.data && !disposed) {
        const data = queue.data.slice(0, 32000);
        queue.data = queue.data.slice(32000);
        await invokeRaw("terminal:write", { id, data });
      }
      if (disposed) throw new Error("REMOTE_DISCONNECTED");
      for (const waiter of queue.waiters.splice(0)) waiter.resolve(true);
    } catch (error) {
      queue.data = "";
      for (const waiter of queue.waiters.splice(0)) waiter.reject(error);
    } finally {
      queue.running = false;
      if (!queue.data) terminals.delete(id);
    }
  };
  const invoke = (channel: string, ...args: any[]): Promise<any> => {
    if (channel !== "terminal:write") return invokeRaw(channel, ...args);
    const { id, data } = args[0] || {};
    if (disposed || typeof id !== "string" || typeof data !== "string")
      return Promise.reject(new Error("REMOTE_INVALID_ARGUMENT"));
    const queue = terminals.get(id) || {
      data: "",
      running: false,
      waiters: [],
    };
    if (queue.data.length + data.length > 256000)
      return Promise.reject(new Error("REMOTE_TRANSFER_LIMIT"));
    queue.data += data;
    terminals.set(id, queue);
    const result = new Promise((resolve, reject) =>
      queue.waiters.push({ resolve, reject }),
    );
    if (!queue.running && !queue.timer)
      queue.timer = setTimeout(() => {
        queue.timer = undefined;
        void flushTerminal(id);
      }, 24);
    return result;
  };
  const transport: DesktopTransport = {
    invoke,
    send: () => {}, // Native window controls are absent on the web.
    on(channel, callback) {
      const set = listeners.get(channel) || new Set();
      set.add(callback);
      listeners.set(channel, set);
    },
    removeListener(channel, callback) {
      listeners.get(channel)?.delete(callback);
    },
  };
  return {
    transport,
    event,
    emit,
    dispose() {
      disposed = true;
      fragments.clear();
      listeners.clear();
      questions.clear();
      for (const snapshot of snapshots.values())
        if (snapshot.timer) clearTimeout(snapshot.timer);
      snapshots.clear();
      for (const queue of terminals.values()) {
        if (queue.timer) clearTimeout(queue.timer);
        for (const waiter of queue.waiters.splice(0))
          waiter.reject(new Error("REMOTE_DISCONNECTED"));
      }
      terminals.clear();
      for (const resolve of waiting.splice(0)) resolve();
    },
  };
}
