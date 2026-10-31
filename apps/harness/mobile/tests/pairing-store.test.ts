import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { clearPairings, leaveWorkspace, readPairings, savePairing } from "../src/pairing-store";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return new Proxy({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  } as Storage, { ownKeys: () => [...data.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
}
beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: memoryStorage(), configurable: true });
});
const token = (account: string, session = "login") => `fixture.${btoa(JSON.stringify({ sub: `${account}|${session}` }))}.unsigned`;
const desktop = { sessionId: "desktop-one", key: "x".repeat(43), deviceName: "Studio" };

test("paired desktops survive reload and token refresh within the same account", () => {
  savePairing(token("one"), desktop);
  assert.deepEqual(readPairings(token("one", "new-login"))?.connections, [desktop]);
  assert.equal(readPairings(token("one"))?.active, desktop.sessionId);
  assert.equal(readPairings(token("two")), null);
  assert.equal(readPairings("malformed-token"), null);
});
test("leaving a workspace keeps its pairing, while removing it clears the persisted proof", () => {
  savePairing(token("one"), desktop);
  localStorage.setItem(`const_remote_grant:${desktop.sessionId}`, "grant");
  leaveWorkspace(token("one"));
  assert.equal(readPairings(token("one"))?.active, undefined);
  assert.deepEqual(readPairings(token("one"))?.connections, [desktop]);
  leaveWorkspace(token("one"), desktop.sessionId);
  assert.deepEqual(readPairings(token("one"))?.connections, []);
  assert.equal(localStorage.getItem(`const_remote_grant:${desktop.sessionId}`), null);
});
test("sign out clears pairing credentials without clearing appearance preferences", () => {
  savePairing(token("one"), desktop);
  localStorage.setItem("theme", "light");
  localStorage.setItem("const_remote_grant:desktop-one", "grant");
  clearPairings();
  assert.equal(readPairings(token("one")), null);
  assert.equal(localStorage.getItem("const_remote_grant:desktop-one"), null);
  assert.equal(localStorage.getItem("theme"), "light");
});
