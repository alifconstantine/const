import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { test } from "node:test";
import { WebSocket } from "ws";
import { RemoteDaemon } from "./remote-daemon";
import type { RemoteDaemonStatus } from "../src/lib/remote-control";

function socketUrl(status: RemoteDaemonStatus): string {
  const pair = new URL(status.pairingUrl!);
  const url = new URL(status.localBridgeUrl!);
  url.searchParams.set("session", status.sessionId!);
  url.searchParams.set("key", new URLSearchParams(pair.hash.slice(1)).get("key")!);
  return url.href;
}

async function connect(status: RemoteDaemonStatus) {
  const ws = new WebSocket(socketUrl(status), { origin: new URL(status.pairingUrl!).origin });
  const [data] = await once(ws, "message");
  assert.equal(JSON.parse(data.toString()).type, "handshake:ack");
  return ws;
}

async function rejected(url: string, origin?: string) {
  const ws = new WebSocket(url, { origin });
  await new Promise<void>((resolve, reject) => {
    ws.on("error", (error) => { assert.match(error.message, /401/); resolve(); });
    ws.on("open", () => { ws.terminate(); reject(new Error("Unauthorized client connected")); });
  });
}

test("pairing page is reachable, localized and keeps the secret out of HTTP responses", async (t) => {
  const daemon = new RemoteDaemon(() => "127.0.0.1");
  t.after(() => daemon.stop());
  const status = await daemon.start();
  const response = await fetch(status.pairingUrl!, { headers: { "Accept-Language": "id-ID" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
  const html = await response.text();
  assert.match(html, /Menghubungkan ke desktop/);
  assert.match(html, /history.replaceState/);
  assert.ok(!html.includes(new URL(status.pairingUrl!).hash.slice(5)));
  assert.equal((await fetch(new URL("/status", status.pairingUrl!))).status, 404);
  const fallback = await fetch(status.pairingUrl!, { headers: { "Accept-Language": "constructor" } });
  assert.equal(fallback.status, 200);
  assert.match(await fallback.text(), /Connecting to desktop/);
  await new Promise<void>((resolve, reject) => {
    const req = http.get(status.pairingUrl!.split("#")[0]!, { headers: { Host: "attacker.example" } }, (res) => {
      assert.equal(res.statusCode, 404); res.resume(); resolve();
    });
    req.on("error", reject);
  });
});

test("authenticates before upgrade and rejects wrong origin, session and key", async (t) => {
  const daemon = new RemoteDaemon(() => "127.0.0.1");
  t.after(() => daemon.stop());
  const status = await daemon.start();
  const url = new URL(socketUrl(status));
  await rejected(url.href, "https://attacker.example");
  url.searchParams.set("session", "wrong");
  await rejected(url.href);
  url.searchParams.set("session", status.sessionId!);
  url.searchParams.set("key", "wrong");
  await rejected(url.href);
  assert.equal(daemon.getStatus().connectedDevices.length, 0);
  const client = await connect(status);
  t.after(() => client.terminate());
  assert.equal(daemon.getStatus().status, "connected");
  assert.equal(daemon.getStatus().connectedDevices.length, 1);
  const [connectedDevice] = daemon.getStatus().connectedDevices;
  assert.ok(connectedDevice);
  assert.ok(connectedDevice.name);
  assert.ok(connectedDevice.connectedAt > 0);
});

test("validates commands, correlates replies, broadcasts, and handles malformed JSON", async (t) => {
  const daemon = new RemoteDaemon(() => "127.0.0.1");
  t.after(() => daemon.stop());
  let calls = 0;
  daemon.onCommand((command, reply) => { calls++; reply({ command: command.type }); });
  const client = await connect(await daemon.start());
  t.after(() => client.terminate());
  let message = once(client, "message");
  client.send(JSON.stringify({ type: "state:get", requestId: "one" }));
  assert.deepEqual(JSON.parse((await message)[0].toString()), { type: "response", requestId: "one", payload: { command: "state:get" } });
  for (const invalid of ['{', 'null', '[]', '{"type":"agent:abort"}', '{"type":"shell:exec"}']) {
    message = once(client, "message"); client.send(invalid);
    assert.equal(JSON.parse((await message)[0].toString()).type, "error");
  }
  assert.equal(calls, 1);
  message = once(client, "message");
  daemon.broadcast({ type: "agent:stream-event", event: { type: "text", text: "hello" } });
  assert.equal(JSON.parse((await message)[0].toString()).event.text, "hello");
});

test("refresh revokes clients and old credentials; stop stays idle after late close events", async (t) => {
  const daemon = new RemoteDaemon(() => "127.0.0.1");
  t.after(() => daemon.stop());
  const old = await daemon.start();
  const client = await connect(old);
  const closed = once(client, "close");
  const refreshed = await daemon.refresh();
  await closed;
  assert.notEqual(old.pairingUrl, refreshed.pairingUrl);
  await rejected(socketUrl(old));
  const next = await connect(refreshed);
  const nextClosed = once(next, "close");
  await daemon.stop();
  await nextClosed;
  assert.equal(daemon.getStatus().status, "idle");
  assert.equal(daemon.getStatus().pairingUrl, null);
  assert.equal((await daemon.refresh()).status, "idle");
});

test("concurrent starts share one listener and stop/start operations serialize", async (t) => {
  const daemon = new RemoteDaemon(() => "127.0.0.1");
  t.after(() => daemon.stop());
  const [one, two] = await Promise.all([daemon.start(), daemon.start()]);
  assert.equal(one.pairingUrl, two.pairingUrl);
  const [, restarted] = await Promise.all([daemon.stop(), daemon.start()]);
  assert.equal(restarted.status, "waiting");
  assert.notEqual(restarted.sessionId, one.sessionId);
});

test("failed network startup can be retried", async (t) => {
  let fail = true;
  const daemon = new RemoteDaemon(() => { if (fail) throw new Error("NO_LAN_ADDRESS"); return "127.0.0.1"; });
  t.after(() => daemon.stop());
  await assert.rejects(daemon.start(), /NO_LAN_ADDRESS/);
  assert.equal(daemon.getStatus().status, "idle");
  fail = false;
  assert.equal((await daemon.start()).status, "waiting");
});

test("failed socket binding releases resources and allows retry", async (t) => {
  let address = "192.0.2.1";
  const daemon = new RemoteDaemon(() => address);
  t.after(() => daemon.stop());
  await assert.rejects(daemon.start());
  assert.equal(daemon.getStatus().status, "idle");
  address = "127.0.0.1";
  assert.equal((await daemon.start()).status, "waiting");
});

test("expired QR credentials cannot open a new connection", async (t) => {
  const daemon = new RemoteDaemon(() => "127.0.0.1");
  t.after(() => daemon.stop());
  const status = await daemon.start();
  t.mock.method(Date, "now", () => status.expiresAt! + 1);
  await rejected(socketUrl(status));
  assert.equal((await daemon.refresh()).status, "waiting");
  const client = await connect(daemon.getStatus());
  t.after(() => client.terminate());
});

test("oversized frames disconnect without reaching the command handler", async (t) => {
  const daemon = new RemoteDaemon(() => "127.0.0.1");
  t.after(() => daemon.stop());
  let called = false;
  daemon.onCommand(() => { called = true; });
  const client = await connect(await daemon.start());
  const closed = once(client, "close");
  client.send("x".repeat(65 * 1024));
  await closed;
  assert.equal(called, false);
});
