import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import { RemoteClient } from "../../remote/src/client";
import { remoteFailureAction } from "../../remote/src/errors";

const storage = new Map<string, string>();
const clients: RemoteClient[] = [];
const grant = { sessionId: "session", deviceId: "device", secretHash: "x".repeat(43) };
beforeEach(() => {
  storage.clear();
  storage.set("const_remote_grant:session", JSON.stringify(grant));
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("navigator", { userAgent: "Android" });
});
afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.close()));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup() {
  const transport = {
    setAuth() {},
    mutation: vi.fn(async (_reference: any, _args: any): Promise<any> => "device"),
    onUpdate: vi.fn((_reference: any, _args: any, _next: (value: any) => void, _error: (error: Error) => void) => vi.fn()),
    close: vi.fn(async () => {}),
  };
  const failure = vi.fn();
  const client = new RemoteClient("session", "x".repeat(43), "https://fixture.convex.cloud", "test-token", () => {}, () => {}, failure, () => transport as any);
  clients.push(client);
  return { client, transport, failure };
}
function feed(transport: ReturnType<typeof setup>["transport"]) {
  transport.onUpdate.mock.calls[0]![2]({ heartbeatAt: Date.now(), deviceName: "Desktop", events: [], responses: [], revision: 0 });
}

test("connection is ready only after its authenticated feed arrives", async () => {
  const { client, transport } = setup();
  let ready = false;
  const connecting = client.connect().then(() => { ready = true; });
  await Promise.resolve();
  expect(ready).toBe(false);
  feed(transport);
  await connecting;
  expect(ready).toBe(true);
});

test("a feed that never arrives times out and releases the connection", async () => {
  vi.useFakeTimers();
  const { client, transport } = setup();
  const result = expect(client.connect()).rejects.toThrow("REMOTE_TIMEOUT");
  await vi.advanceTimersByTimeAsync(25_000);
  await result;
  expect(transport.close).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

test("closing an unfinished pairing rejects promptly and late completion cannot store a grant", async () => {
  storage.delete("const_remote_grant:session");
  storage.set("const_remote_device_secret:session", grant.secretHash);
  const { client, transport } = setup();
  let finishJoin!: (value: string) => void;
  transport.mutation.mockImplementation(() => new Promise(resolve => { finishJoin = resolve; }));
  const result = expect(client.connect()).rejects.toThrow("REMOTE_DISCONNECTED");
  await vi.waitFor(() => expect(transport.mutation).toHaveBeenCalledOnce());
  await client.close(true);
  await result;
  finishJoin("late-device");
  await Promise.resolve();
  expect(storage.has("const_remote_grant:session")).toBe(false);
  expect(transport.onUpdate).not.toHaveBeenCalled();
});

test("broker rejection preserves its structured reason for login or a fresh QR", async () => {
  const { client, transport, failure } = setup();
  const expired = new ConvexError({ code: "REMOTE_SESSION_EXPIRED" });
  const result = expect(client.connect()).rejects.toBe(expired);
  transport.onUpdate.mock.calls[0]![3](expired);
  await result;
  expect(failure).toHaveBeenCalledWith(expired);
  expect(remoteFailureAction(expired)).toBe("missingKey");
  expect(remoteFailureAction(new ConvexError({ code: "REMOTE_UNAUTHORIZED" }))).toBe("login");
  expect(remoteFailureAction(new Error("REMOTE_UNAUTHORIZED"))).toBe("error");
});

test("corrupt tab state can pair again instead of permanently failing JSON parsing", async () => {
  storage.set("const_remote_grant:session", "{bad-json");
  const { client, transport } = setup();
  const connecting = client.connect();
  await vi.waitFor(() => expect(transport.onUpdate).toHaveBeenCalledOnce());
  feed(transport);
  await connecting;
  expect(getFunctionName(transport.mutation.mock.calls[0]![0])).toBe("remote:join");
  expect(JSON.parse(storage.get("const_remote_grant:session")!).deviceId).toBe("device");
});

test("a request still encrypting during shutdown cannot be submitted afterwards", async () => {
  const { client, transport } = setup();
  const connecting = client.connect();
  feed(transport);
  await connecting;
  const request = expect(client.request({ type: "state:get" })).rejects.toThrow("REMOTE_DISCONNECTED");
  await client.close();
  await request;
  expect(transport.mutation).not.toHaveBeenCalled();
  await client.close();
  expect(transport.close).toHaveBeenCalledOnce();
});
