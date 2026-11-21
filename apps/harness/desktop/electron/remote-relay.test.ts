import assert from "node:assert/strict";
import { test } from "node:test";
import { getFunctionName } from "convex/server";
import { digest, openWithCode } from "@const/remote/crypto";
import { extractRemoteErrorCode, RemoteRelay } from "./remote-relay";

function fixture(create: (args: any) => Promise<string>) {
  const attempts: any[] = [];
  let closed = false;
  const client = {
    setAuth() {},
    async mutation(reference: any, args: any) {
      if (getFunctionName(reference) !== "remote:create") return;
      attempts.push(args);
      return create(args);
    },
    onUpdate: () => () => {},
    async close() { closed = true; },
  };
  const relay = new RemoteRelay("Test desktop", () => {}, () => {}, () => client as any);
  return { relay, attempts, get closed() { return closed; } };
}

test("the displayed pairing code unlocks the same key as the QR/link", async (t) => {
  const s = fixture(async () => "session");
  t.after(() => s.relay.stop());
  const status = await s.relay.start("token", "https://fixture.convex.cloud", "https://harness.example");
  const args = s.attempts[0];
  assert.equal(s.attempts.length, 1);
  assert.equal(status.pairingCode, args.pairingCode);
  const secret = await openWithCode(status.pairingCode!.replace("-", "").toLowerCase(), args.encryptedSecret);
  assert.equal(secret, new URLSearchParams(new URL(status.pairingUrl!).hash.slice(1)).get("key"));
  assert.equal(await digest(secret), args.pairHash);
});

test("a legacy relay keeps QR/link pairing without advertising an unusable code", async (t) => {
  const s = fixture(async args => {
    if (args.pairingCode) throw new Error("ArgumentValidationError: Object contains extra field `pairingCode` that is not in the validator.");
    return "legacy-session";
  });
  t.after(() => s.relay.stop());
  const status = await s.relay.start("token", "https://fixture.convex.cloud", "https://harness.example");
  assert.equal(s.attempts.length, 2);
  assert.equal(s.attempts[1].pairingCode, undefined);
  assert.equal(status.pairingCode, null);
  assert.ok(status.pairingUrl);
});

for (const reason of ["REMOTE_TIMEOUT", "REMOTE_SESSION_LIMIT", "Network error", "REMOTE_UNAUTHORIZED"]) {
  test(`${reason} does not retry session creation without pairing credentials`, async () => {
    const s = fixture(async () => { throw new Error(reason); });
    await assert.rejects(s.relay.start("token", "https://fixture.convex.cloud", "https://harness.example"), new RegExp(reason));
    assert.equal(s.attempts.length, 1);
    assert.equal(s.relay.getStatus().pairingCode, null);
    assert.equal(s.relay.getStatus().status, "idle");
    assert.equal(s.closed, true);
  });
}

test("closing and reopening resumes the same host grant without creating a new session", async () => {
  const first = fixture(async () => "session");
  const initial = await first.relay.start("token", "https://fixture.convex.cloud", "https://harness.example");
  const saved = first.relay.exportSession()!;
  await first.relay.stop(false);
  const next = fixture(async () => { throw new Error("must not create another session"); });
  try {
    const resumed = await next.relay.start("token", "https://fixture.convex.cloud", "https://harness.example", saved);
    assert.equal(resumed.sessionId, initial.sessionId);
    assert.equal(resumed.pairingUrl, initial.pairingUrl);
    assert.equal(resumed.pairingCode, initial.pairingCode);
    assert.equal(resumed.expiresAt, initial.expiresAt);
    assert.equal(next.attempts.length, 0);
  } finally { await next.relay.stop(); }
});

test("resuming a legacy link-only session does not invent an unusable pairing code", async () => {
  const s = fixture(async () => { throw new Error("must resume"); });
  try {
    const status = await s.relay.start("token", "https://fixture.convex.cloud", "https://harness.example", {
      sessionId: "legacy", hostHash: "h".repeat(43), secret: "x".repeat(43), pairingCode: null,
      pairExpiresAt: Date.now() + 1000, expiresAt: Date.now() + 10_000,
    });
    assert.equal(status.pairingCode, null);
    assert.ok(status.pairingUrl);
  } finally { await s.relay.stop(); }
});

test("extractRemoteErrorCode and RemoteRelay normalize ConvexError data.code across resume and create", async () => {
  const wireExpired = Object.assign(
    new Error("[CONVEX M(remote:heartbeat)] Server Error\n  Called by client"),
    { data: { code: "REMOTE_SESSION_EXPIRED" } },
  );
  assert.equal(extractRemoteErrorCode(wireExpired), "REMOTE_SESSION_EXPIRED");

  const resumeClient = {
    setAuth() {},
    async mutation(reference: any) {
      if (getFunctionName(reference) === "remote:heartbeat") throw wireExpired;
      throw new Error("unexpected mutation");
    },
    onUpdate: () => () => {},
    async close() {},
  };
  const resumeRelay = new RemoteRelay("Test desktop", () => {}, () => {}, () => resumeClient as any);
  await assert.rejects(
    resumeRelay.start("token", "https://fixture.convex.cloud", "https://harness.example", {
      sessionId: "stale", hostHash: "h".repeat(43), secret: "x".repeat(43), pairingCode: "ABC-123",
      pairExpiresAt: Date.now() + 1000, expiresAt: Date.now() + 10_000,
    }),
    /^Error: REMOTE_SESSION_EXPIRED$|REMOTE_SESSION_EXPIRED/,
  );

  const wireLimit = Object.assign(
    new Error("[CONVEX M(remote:create)] Server Error\n  Called by client"),
    { data: { code: "REMOTE_SESSION_LIMIT" } },
  );
  let createAttempts = 0;
  const limitClient = {
    setAuth() {},
    async mutation(reference: any) {
      if (getFunctionName(reference) === "remote:create") {
        createAttempts++;
        throw wireLimit;
      }
    },
    onUpdate: () => () => {},
    async close() {},
  };
  const limitRelay = new RemoteRelay("Test desktop", () => {}, () => {}, () => limitClient as any);
  await assert.rejects(
    limitRelay.start("token", "https://fixture.convex.cloud", "https://harness.example"),
    /REMOTE_SESSION_LIMIT/,
  );
  assert.equal(createAttempts, 1);
});
