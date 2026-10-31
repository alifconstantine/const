import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesAuthState } from "./auth-state";

test("authentication requires an active, matching nonce and rejects replay", () => {
  assert.equal(matchesAuthState("nonce", "nonce"), true);
  for (const [expected, received] of [[null, "nonce"], ["nonce", undefined], ["nonce", "other"], ["nonce", "nonce/"], ["", ""]] as const)
    assert.equal(matchesAuthState(expected, received), false);
});
