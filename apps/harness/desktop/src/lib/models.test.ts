import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUTER_DEFAULT_MODELS } from "./router-models";
import {
  modelDisplayName,
  resolveModelId,
  uniqueModelsById,
} from "./model-identity";
import {
  createAgentEventForwarder,
  shouldNotifyAgentFailure,
} from "./agent-errors";
import {
  saveLlmConfig,
  fetchRemoteModels,
  loadMultiModalConfig,
} from "./models-config";

test("catalog offers only paid model IDs and no preset combos", () => {
  const ids = ROUTER_DEFAULT_MODELS.map(model => model.id);
  assert.ok(ids.length > 0);
  assert.deepEqual(ids.filter(id => id.endsWith(":free")), []);
  assert.ok(!ids.some(id => id.startsWith("combo/")));
  assert.ok(ids.includes("deepseek-v4.1-flash"));
});

test("same display names never collapse free/paid variants", () => {
  const models = [
    { id: "deepseek-v4.1-flash:free", name: "DeepSeek", provider: "const" },
    { id: "deepseek-v4.1-flash", name: "DeepSeek", provider: "const" },
    { id: "deepseek-v4.1-flash", name: "DeepSeek", provider: "custom" },
    {
      id: "deepseek-v4.1-flash:free",
      name: "DeepSeek",
      provider: "const-router",
    },
  ];
  assert.equal(uniqueModelsById(models).length, 2);
  assert.equal(
    modelDisplayName(models[0]!.id, models[0]!.name),
    "DeepSeek:free",
  );
  assert.equal(
    modelDisplayName(models[0]!.id, "DeepSeek:free"),
    "DeepSeek:free",
  );
});

test("retired free selection is retained for rejection and never converted silently to paid", async () => {
  const storage = new Map<string, string>();
  const saved: unknown[] = [];
  const events: Event[] = [];
  const oldWindow = globalThis.window;
  const oldStorage = globalThis.localStorage;
  const fakeStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: fakeStorage,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      electron: {
        saveConfig: async (config: unknown) => {
          saved.push(config);
        },
      },
      dispatchEvent: (event: Event) => {
        events.push(event);
        return true;
      },
    },
  });
  try {
    const config = loadMultiModalConfig().llm;
    config.providers = config.providers.map(provider => provider.id === "const-router" ? {
      ...provider,
      models: [...provider.models, { id: "combo/my-coding", name: "My coding combo" }, { id: "glm-5.3-flash:free", name: "Retired" }],
    } : provider);
    config.activeModelId = "deepseek-v4.1-flash:free";
    saveLlmConfig(config);
    const reloaded = loadMultiModalConfig().llm;
    assert.equal(reloaded.activeModelId, "");
    assert.ok(reloaded.providers.find(provider => provider.id === "const-router")!.models.every(model => !model.id.endsWith(":free")));
    assert.ok(reloaded.providers.find(provider => provider.id === "const-router")!.models.some(model => model.id === "combo/my-coding"));
    assert.equal(storage.get("const_llm_active_model"), config.activeModelId);
    assert.equal(
      storage.get("const_harness_active_model"),
      config.activeModelId,
    );
    assert.equal(
      (saved[0] as { activeModel: string }).activeModel,
      config.activeModelId,
    );
    assert.equal(
      (saved[0] as { activeProvider: string }).activeProvider,
      "const",
    );
    assert.equal(
      (events[0] as CustomEvent).detail.modelId,
      config.activeModelId,
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: oldWindow,
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: oldStorage,
    });
  }
});

test("Const discovery hides retired free variants from an older router response", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: [
          { id: "deepseek-v4.1-flash:free", name: "DeepSeek" },
          { id: "deepseek-v4.1-flash", name: "DeepSeek" },
        ],
      }),
    );
  try {
    const result = await fetchRemoteModels("https://router.const.web.id/v1");
    assert.deepEqual(result.models, [
      { id: "deepseek-v4.1-flash", name: "DeepSeek" },
    ]);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("one failed request produces one notification across stream and IPC", () => {
  let notifications = 0;
  const event = {
    type: "error",
    error: "Const error (402): Insufficient credits",
  };
  const forwarder = createAgentEventForwarder(() => {
    notifications++;
    return true;
  });
  forwarder.forward(event);
  forwarder.forward(event);
  if (
    shouldNotifyAgentFailure({
      error: event.error,
      errorReported: forwarder.errorReported,
    })
  )
    notifications++;
  assert.equal(notifications, 1);
  // A new request can independently report the same error.
  createAgentEventForwarder(() => {
    notifications++;
    return true;
  }).forward(event);
  assert.equal(notifications, 2);
});

test("IPC still reports undelivered failures, while cancellation stays silent", () => {
  const forwarder = createAgentEventForwarder(() => false);
  forwarder.forward({ type: "error", error: "Unavailable" });
  assert.ok(
    shouldNotifyAgentFailure({
      error: "Unavailable",
      errorReported: forwarder.errorReported,
    }),
  );
  assert.ok(!shouldNotifyAgentFailure({ error: "Cancelled", aborted: true }));
});
