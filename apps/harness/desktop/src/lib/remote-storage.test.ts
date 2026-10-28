import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteUiStorage } from "./remote-storage";

function backingStorage() {
  const values = new Map<string, string>();
  let full = false;
  const storage = {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) {
      if (full) throw new DOMException("Quota exceeded", "QuotaExceededError");
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
  return { storage, fill: () => { full = true; } };
}

test("remote UI survives a quota failure after a large generated response", () => {
  const backing = backingStorage();
  const ui = createRemoteUiStorage("host", backing.storage);
  ui.setItem("transcript", "previous turn");
  backing.fill();
  assert.doesNotThrow(() => ui.setItem("transcript", "completed turn"));
  assert.doesNotThrow(() => ui.setItem("activeConversation", "chat"));
  assert.equal(ui.getItem("transcript"), "completed turn");
  assert.equal(ui.getItem("activeConversation"), "chat");
});

test("reload restores persisted UI and keeps different hosts and pairing credentials separate", () => {
  const { storage } = backingStorage();
  storage.setItem("const_remote_key:one", "pairing-key");
  storage.setItem("const_remote_token", "token");
  const first = createRemoteUiStorage("one", storage);
  const second = createRemoteUiStorage("two", storage);
  first.setItem("chat", "first");
  second.setItem("chat", "second");
  assert.equal(createRemoteUiStorage("one", storage).getItem("chat"), "first");
  first.clear();
  assert.equal(second.getItem("chat"), "second");
  assert.equal(storage.getItem("const_remote_key:one"), "pairing-key");
  assert.equal(storage.getItem("const_remote_token"), "token");
});

test("property access, enumeration and deletion agree with Storage methods", () => {
  const { storage } = backingStorage();
  const ui = createRemoteUiStorage("host", storage);
  ui.theme = "dark";
  ui.setItem("zoom", "100");
  assert.equal(ui.theme, "dark");
  assert.equal(ui.getItem("theme"), "dark");
  assert.equal(ui.length, 2);
  assert.deepEqual(Object.keys(ui), ["theme", "zoom"]);
  assert.equal(ui.key(1), "zoom");
  delete ui.theme;
  assert.equal(ui.getItem("theme"), null);
  assert.equal(storage.getItem("const_remote_ui:host:theme"), null);
});

test("restricted storage falls back to a working tab cache", () => {
  const storage = new Proxy({} as Storage, { get() { throw new Error("Storage denied"); } });
  const ui = createRemoteUiStorage("host", storage);
  assert.doesNotThrow(() => ui.setItem("theme", "dark"));
  assert.equal(ui.getItem("theme"), "dark");
  assert.doesNotThrow(() => ui.removeItem("theme"));
  assert.equal(ui.length, 0);
});
