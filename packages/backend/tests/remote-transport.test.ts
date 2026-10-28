import { test, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { RemoteRelay } from "../../../apps/harness/desktop/electron/remote-relay";
import { RemoteClient } from "../../remote/src/client";
import { randomBytes } from "node:crypto";

const runtime = { owner: null as any, watchers: new Set<any>() };
class TestClient {
  private subscriptions = new Set<any>();
  setAuth() {}
  async mutation(reference: any, args: any) {
    const result = await runtime.owner.mutation(reference, args);
    for (const watcher of runtime.watchers) {
      void runtime.owner
        .query(watcher.reference, watcher.args)
        .then(watcher.callback)
        .catch((error: Error) => watcher.error?.(error));
    }
    return result;
  }
  query(reference: any, args: any) {
    return runtime.owner.query(reference, args);
  }
  onUpdate(reference: any, args: any, callback: any, error: any) {
    const watcher = { reference, args, callback, error };
    runtime.watchers.add(watcher);
    this.subscriptions.add(watcher);
    void this.query(reference, args).then(callback).catch(error);
    return () => runtime.watchers.delete(watcher);
  }
  async close() {
    for (const watcher of this.subscriptions) runtime.watchers.delete(watcher);
  }
}

test("desktop and browser exchange encrypted requests/events through the authenticated broker", async () => {
  const t = convexTest(schema, import.meta.glob("../convex/**/*.ts"));
  const ownerId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Owner" }),
  );
  runtime.owner = t.withIdentity({ subject: `${ownerId}|session` });
  runtime.watchers.clear();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("navigator", { userAgent: "Test Android" });
  let calls = 0;
  const factory = () => new TestClient() as any;
  const host = new RemoteRelay(
    "test-desktop",
    () => {},
    (command, reply) => {
      calls++;
      reply(command.type === "desktop:invoke" ? { echo: command.payload.args[0] } : { command: command.type, text: "private reply" });
    },
    factory,
  );
  let mobile: RemoteClient | null = null;
  try {
    const status = await host.start(
      "test-auth",
      "https://fixture.convex.cloud",
      "https://harness.const.web.id",
    );
    const key = new URLSearchParams(
      new URL(status.pairingUrl!).hash.slice(1),
    ).get("key")!;
    const events: any[] = [];
    mobile = new RemoteClient(
      status.sessionId!,
      key,
      "https://fixture.convex.cloud",
      "test-auth",
      (event) => events.push(event),
      () => {},
      () => {},
      factory,
    );
    await mobile.connect();
    expect(await mobile.request({ type: "state:get" }, "one")).toEqual({
      command: "state:get",
      text: "private reply",
    });
    expect(await mobile.request({ type: "state:get" }, "one")).toEqual({
      command: "state:get",
      text: "private reply",
    });
    expect(calls).toBe(1);
    const large = { history: "private history\n".repeat(10000), binary: randomBytes(180000).toString("base64") };
    expect(await mobile.request({ type: "desktop:invoke", payload: { channel: "workspace:read-file", args: [large] } })).toEqual({ echo: large });
    expect(calls).toBe(2);
    host.broadcast({
      type: "agent:stream-event",
      conversationId: "thread",
      event: { type: "token", token: "private event" },
    });
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0].event.token).toBe("private event");
    const rows = await t.run((ctx) => ctx.db.query("remoteEvents").collect());
    expect(JSON.stringify(rows)).not.toContain("private event");
    await host.stop();
    expect(host.getStatus().status).toBe("idle");
    await expect(mobile.request({ type: "state:get" })).rejects.toThrow();
  } finally {
    await mobile?.close();
    await host.stop();
    runtime.watchers.clear();
    vi.unstubAllGlobals();
  }
});
