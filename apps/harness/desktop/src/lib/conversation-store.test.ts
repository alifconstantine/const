import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheConversation, initConversationStore, saveConversation, loadConversations } from "./conversation-store";

test("host histories are not mirrored to Web Storage and a failed migration retains the legacy copy", async () => {
  const values = new Map<string, string>();
  const writes: string[] = [];
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writes.push(key); values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const conversation = { id: "performance", title: "Chat", project: "Outside Project", createdAt: 1, updatedAt: 1,
    messages: [{ role: "assistant", content: "x".repeat(1_000_000) }] };
  const saves: any[] = [];
  let failMigration = true;
  let acceptMigration = false;
  const key = "const_harness_conversations";
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: { electron: {
    listConversations: async () => [conversation],
    saveConversation: async (value: unknown) => { saves.push(value); },
    importLegacyConversations: async () => { if (failMigration) throw new Error("offline"); return acceptMigration; },
  } } });
  try {
    values.set(key, JSON.stringify([conversation]));
    await initConversationStore();
    assert.ok(values.has(key));
    failMigration = false;
    await initConversationStore();
    assert.ok(values.has(key)); // A resolved false response must retain the legacy copy.
    acceptMigration = true;
    await initConversationStore();
    assert.equal(values.has(key), false);
    cacheConversation({ ...conversation, title: "Hydrated" });
    assert.equal(saves.length, 0);
    saveConversation({ ...conversation, title: "Updated" });
    assert.equal(saves[0]?.title, "Updated");
    assert.equal(loadConversations()[0]?.messages[0].content.length, 1_000_000);
    assert.deepEqual(writes, []);
    // Restricted Web Storage must not prevent hydration from the authoritative host.
    const inaccessibleStorage = new Proxy({}, { get() { throw new Error("Storage disabled"); } });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: inaccessibleStorage });
    assert.equal((await initConversationStore())[0]?.id, conversation.id);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    // A browser without a host still needs its existing persistence fallback.
    (globalThis as any).window = {};
    saveConversation({ ...conversation, title: "Browser" });
    assert.equal(JSON.parse(values.get(key)!)[0].title, "Browser");
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
