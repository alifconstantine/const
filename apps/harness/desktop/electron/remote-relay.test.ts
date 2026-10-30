import assert from "node:assert/strict";
import { test } from "node:test";
import { getFunctionName } from "convex/server";
import { digest, openWithCode } from "@const/remote/crypto";
import { RemoteRelay } from "./remote-relay";

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
