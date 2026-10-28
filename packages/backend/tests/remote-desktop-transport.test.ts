import { expect, test, vi } from "vitest";
import { remoteDesktopTransport } from "../../../apps/harness/desktop/src/lib/remote-desktop-transport";

test("desktop session APIs keep their native shape and bind actions to the current run", async () => {
  const request = vi.fn(async (command: any) => ({
    ok: true,
    value:
      command.payload.channel === "agent:get-running-sessions"
        ? [{ conversationId: "chat", runId: "run" }]
        : true,
  }));
  const bridge = remoteDesktopTransport({ request } as any, () => {});
  try {
    expect(await bridge.transport.invoke("agent:get-running-sessions")).toEqual(
      ["chat"],
    );
    await bridge.transport.invoke("agent:abort", "chat");
    expect(request.mock.calls.at(-1)![0].payload.expectedRunId).toBe("run");
    await expect(bridge.transport.invoke("auth:start-login")).rejects.toThrow(
      "REMOTE_CAPABILITY_DENIED",
    );
    await expect(
      bridge.transport.invoke("remote:start-session"),
    ).rejects.toThrow("REMOTE_CAPABILITY_DENIED");
  } finally {
    bridge.dispose();
  }
});

test("snapshot hydration skips overlapping tokens and restores pending questions", async () => {
  let resolveSnapshot!: (value: any) => void;
  const request = vi.fn((command: any) =>
    command.payload.channel === "conversations:get"
      ? new Promise((resolve) => {
          resolveSnapshot = resolve;
        })
      : Promise.resolve({ ok: true, value: true }),
  );
  const bridge = remoteDesktopTransport({ request } as any, () => {});
  const events: any[] = [];
  bridge.transport.on("agent:stream-event", (_event, value) =>
    events.push(value),
  );
  try {
    const snapshot = bridge.transport.invoke("conversations:get", "chat");
    for (const [remoteSequence, token] of [
      [4, "covered"],
      [6, " fresh"],
    ] as const)
      bridge.event({
        type: "desktop:event",
        channel: "agent:stream-event",
        args: [
          {
            conversationId: "chat",
            runId: "run",
            type: "token",
            token,
            remoteSequence,
          },
        ],
      });
    resolveSnapshot({
      ok: true,
      value: {
        id: "chat",
        messages: [{ role: "user", content: "prompt" }],
        __remoteRevision: { runId: "run", revision: 5 },
        __remoteLive: {
          runId: "run",
          revision: 5,
          text: "snapshot",
          questions: { toolCallId: "question", questions: [] },
        },
      },
    });
    expect((await snapshot).messages.at(-1).content).toBe("snapshot");
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events.map((event) => event.token).filter(Boolean)).toEqual([
      " fresh",
    ]);
    bridge.event({
      type: "desktop:event",
      channel: "agent:stream-event",
      args: [
        {
          conversationId: "chat",
          runId: "run",
          type: "token",
          token: "duplicate",
          remoteSequence: 6,
        },
      ],
    });
    expect(events).toHaveLength(2);
    await bridge.transport.invoke("agent:answer-question", {
      toolCallId: "question",
      answer: "yes",
    });
    expect((request.mock.calls.at(-1)![0] as any).payload.expectedRunId).toBe(
      "run",
    );
  } finally {
    bridge.dispose();
  }
});

test("terminal keystrokes are coalesced and remain ordered across network latency", async () => {
  let firstDone!: (value: any) => void;
  const writes: string[] = [];
  const request = vi.fn((command: any) => {
    writes.push(command.payload.args[0].data);
    return writes.length === 1
      ? new Promise((resolve) => {
          firstDone = resolve;
        })
      : Promise.resolve({ ok: true, value: true });
  });
  const bridge = remoteDesktopTransport({ request } as any, () => {});
  try {
    const a = bridge.transport.invoke("terminal:write", {
      id: "terminal",
      data: "a",
    });
    const b = bridge.transport.invoke("terminal:write", {
      id: "terminal",
      data: "b",
    });
    await vi.waitFor(() => expect(writes).toEqual(["ab"]));
    const c = bridge.transport.invoke("terminal:write", {
      id: "terminal",
      data: "c",
    });
    const d = bridge.transport.invoke("terminal:write", {
      id: "terminal",
      data: "d",
    });
    firstDone({ ok: true, value: true });
    await Promise.all([a, b, c, d]);
    expect(writes).toEqual(["ab", "cd"]);
  } finally {
    bridge.dispose();
  }
});

test("large event fragments reassemble without losing Unicode or tool data", () => {
  const bridge = remoteDesktopTransport({} as any, () => {});
  const received: any[] = [];
  bridge.transport.on("agent:stream-event", (_event, value) =>
    received.push(value),
  );
  const value = { type: "tool_result", result: "日本語🙂".repeat(20000) };
  const serialized = JSON.stringify({
    type: "desktop:event",
    channel: "agent:stream-event",
    args: [value],
  });
  const count = Math.ceil(serialized.length / 8000);
  try {
    for (let index = 0; index < count; index++)
      bridge.event({
        type: "desktop:event-part",
        id: "packet",
        index,
        count,
        data: serialized.slice(index * 8000, (index + 1) * 8000),
      });
    expect(received).toEqual([value]);
  } finally {
    bridge.dispose();
  }
});

test("other devices' prompts hydrate before their live stream and completed changes refresh an open chat", async () => {
  let resolveSnapshot!: (value: any) => void;
  const request = vi.fn(
    () =>
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
  );
  const bridge = remoteDesktopTransport({ request } as any, () => {});
  const received: any[] = [];
  bridge.transport.on("conversations:changed", (_event, value) =>
    received.push(value),
  );
  bridge.transport.on("agent:stream-event", (_event, value) =>
    received.push(value),
  );
  try {
    bridge.event({
      type: "desktop:event",
      channel: "agent:session-started",
      args: [{ conversationId: "chat", runId: "run" }],
    });
    expect(request.mock.calls).toHaveLength(1);
    bridge.event({
      type: "desktop:event",
      channel: "agent:stream-event",
      args: [
        {
          conversationId: "chat",
          runId: "run",
          type: "token",
          token: "next",
          remoteSequence: 2,
        },
      ],
    });
    expect(received).toEqual([]);
    resolveSnapshot({
      ok: true,
      value: {
        id: "chat",
        messages: [{ role: "user", content: "other device prompt" }],
        __remoteRevision: { runId: "run", revision: 1 },
      },
    });
    await vi.waitFor(() => expect(received).toHaveLength(2));
    expect(received[0].remoteMessages[0].content).toBe("other device prompt");
    expect(received[1].token).toBe("next");
    bridge.event({
      type: "desktop:event",
      channel: "conversations:changed",
      args: [{ conversationId: "chat" }],
    });
    resolveSnapshot({
      ok: true,
      value: {
        id: "chat",
        messages: [{ role: "assistant", content: "completed" }],
      },
    });
    await vi.waitFor(() =>
      expect(received.at(-1).remoteMessages?.[0].content).toBe("completed"),
    );
  } finally {
    bridge.dispose();
  }
});
