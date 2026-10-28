import { expect, test, vi, afterEach } from "vitest";

vi.mock("../../../apps/harness/desktop/src/components/intelligence-ui/protocol", () => ({ shiftIntelligenceUiState: (state: unknown) => state }));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function setup() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  const record = { id: "chat", title: "Task", project: "/workspace", createdAt: 1, updatedAt: 2, messages: [{ id: "answer", role: "assistant", content: "Host answer" }], telemetry: { context: { usedTokens: 100, totalTokens: 1000 } }, rightPaneState: { isOpen: true, activeTabId: null, tabs: [] } };
  const listConversations = vi.fn(async () => [record]);
  const updateConversationUi = vi.fn(async () => true);
  const saveConversation = vi.fn(async () => true);
  const target = new EventTarget();
  vi.stubGlobal("window", { electron: { listConversations, updateConversationUi, saveConversation }, dispatchEvent: target.dispatchEvent.bind(target) });
  const store = await import("../../../apps/harness/desktop/src/lib/conversation-store");
  await store.initConversationStore();
  return { store, record, listConversations, updateConversationUi, saveConversation, target };
}

test("sidebar summaries preserve hydrated history, telemetry and pane state", async () => {
  const s = await setup();
  s.listConversations.mockResolvedValueOnce([{ id: "chat", title: "Renamed", project: "/workspace", createdAt: 1, updatedAt: 3, messages: [], __remoteSummary: true } as any]);
  const [refreshed] = await s.store.refreshConversationsFromDisk();
  expect(refreshed.title).toBe("Renamed");
  expect(refreshed.messages).toEqual(s.record.messages);
  expect(refreshed.telemetry).toEqual(s.record.telemetry);
  expect(refreshed.rightPaneState).toEqual(s.record.rightPaneState);
  // A complete host record with [] is a real empty history, not a summary.
  s.listConversations.mockResolvedValueOnce([{ ...s.record, messages: [] }]);
  expect((await s.store.refreshConversationsFromDisk())[0].messages).toEqual([]);
});

test("host side-chat updates replace stale local caches, including deletion", async () => {
  const s = await setup();
  const side = { id: "side_chat_a", parentConversationId: "chat", title: "Side", project: "/workspace", createdAt: 1, updatedAt: 2, messages: [{ role: "assistant", content: "old" }] };
  s.store.saveSideConversation(side);
  expect(s.saveConversation).not.toHaveBeenCalled();
  expect(s.updateConversationUi).toHaveBeenCalledWith("chat", { sideConversation: expect.objectContaining({ id: side.id }) });
  const events: any[] = [];
  s.target.addEventListener("const:side-conversation-saved", event => events.push((event as CustomEvent).detail));
  s.store.syncConversationUi({ ...s.record, sideConversations: [{ ...side, messages: [{ role: "assistant", content: "new" }] }] } as any);
  expect(s.store.loadSideConversation("chat", side.id)?.messages[0].content).toBe("new");
  s.store.syncConversationUi({ ...s.record, sideConversations: [] } as any);
  expect(s.store.loadSideConversation("chat", side.id)).toBeNull();
  expect(events).toEqual([{ id: side.id, fromHost: true }, { id: side.id, fromHost: true }]);
  expect(s.updateConversationUi).toHaveBeenCalledTimes(1);
});
