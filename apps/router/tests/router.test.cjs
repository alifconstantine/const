const test = require("node:test");
const assert = require("node:assert/strict");
const { sourceLoader, appRequire } = require("./source-loader.cjs");
const { NextRequest } = appRequire("next/server");
const { ConvexError } = appRequire("convex/values");
function refs(parts = []) {
  return new Proxy(() => {}, {
    get: (_, p) => (p === "path" ? parts.join(".") : refs([...parts, p])),
  });
}
const api = refs(),
  internal = refs();
const v = new Proxy({}, { get: () => () => ({}) });
let db, ctx, fetches, lastPayload;
function database() {
  const rows = new Map();
  let serial = 0;
  return {
    rows,
    seed(table, id, data) {
      rows.set(id, {
        _id: id,
        _creationTime: Date.now(),
        ...data,
        __table: table,
      });
      return id;
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async patch(id, data) {
      if (!rows.has(id)) throw Error("Missing row " + id);
      rows.set(id, { ...rows.get(id), ...data });
    },
    async insert(table, data) {
      const id = table + ":" + ++serial;
      this.seed(table, id, data);
      return id;
    },
    async delete(id) {
      rows.delete(id);
    },
    query(table) {
      const conditions = [];
      let descending = false,
        predicate = () => true;
      const q = {
        withIndex(_name, fn) {
          const ops = {
            eq(k, value) {
              conditions.push((r) => r[k] === value);
              return ops;
            },
            gte(k, value) {
              conditions.push((r) => r[k] >= value);
              return ops;
            },
            gt(k, value) {
              conditions.push((r) => r[k] > value);
              return ops;
            },
          };
          fn?.(ops);
          return q;
        },
        order(value) {
          descending = value === "desc";
          return q;
        },
        async collect() {
          return [...rows.values()]
            .filter(
              (r) =>
                r.__table === table &&
                conditions.every((c) => c(r)) &&
                predicate(r),
            )
            .sort((a, b) =>
              descending
                ? b._creationTime - a._creationTime
                : a._creationTime - b._creationTime,
            );
        },
        async first() {
          return (await q.collect())[0] ?? null;
        },
        async unique() {
          const found = await q.collect();
          if (found.length > 1) throw Error("Duplicate");
          return found[0] ?? null;
        },
        async take(n) {
          return (await q.collect()).slice(0, n);
        },
      };
      return q;
    },
  };
}
let handlers;
class Client {
  setAuth(token) {
    if (token !== "valid.jwt.token")
      throw new ConvexError("Unauthorized expired token");
    this.userId = "u1";
  }
  async query(ref, args) {
    return invoke(ref, args, this.userId);
  }
  async mutation(ref, args) {
    return invoke(ref, args, this.userId);
  }
}
async function invoke(ref, args, userId) {
  const fn = handlers[ref.path];
  if (!fn) throw Error("Unmapped handler " + ref.path);
  return fn.handler({ ...ctx, userId }, args);
}
const load = sourceLoader({
  "convex/values": { v, ConvexError },
  "convex/browser": { ConvexHttpClient: Client },
  "@convex-dev/auth/server": {
    getAuthUserId: async (context) => context.userId ?? null,
  },
  "../_generated/server": {
    query: (x) => x,
    mutation: (x) => x,
    internalMutation: (x) => x,
    internalAction: (x) => x,
    action: (x) => x,
    httpAction: (x) => x,
  },
  "../_generated/api": { api, internal },
  "@const/backend/_generated/api": { api, internal },
});
const gateway = load("packages/backend/convex/router/gateway.ts");
const keys = load("packages/backend/convex/router/keys.ts");
const combos = load("packages/backend/convex/router/combos.ts");
const catalog = load("packages/backend/convex/router/modelCatalog.ts");
const settings = load("packages/backend/convex/router/settings.ts");
const payments = load("packages/backend/convex/router/payments.ts");
const paymentContract = load("packages/backend/convex/router/paymentContract.ts");
const exchangeRates = load("packages/backend/convex/router/exchangeRates.ts");
const rateContract = load("packages/backend/convex/router/exchangeRateContract.ts");
const { calculateQuotaState, WEEK_MS } = load(
  "packages/backend/convex/router/quotas.ts",
);
const { dayStart, hashKey } = load("packages/backend/convex/router/access.ts");
const { SseUsageParser } = load("apps/router/src/lib/telemetry.ts");
const chat = load("apps/router/src/app/v1/chat/completions/route.ts");
const generation = load("apps/router/src/app/api/generation/chat/route.ts");
const models = load("apps/router/src/app/v1/models/route.ts");
const { benchmarks } = load(
  "apps/router/src/app/(dashboard)/benchmark/benchmark-data.ts",
);
const { isPublicAddress } = load("apps/router/src/lib/public-fetch.ts");
const originalFetch = global.fetch;
const secret = "router-test-secret-32-characters-minimum";
process.env.ROUTER_GATEWAY_SECRET = secret;
process.env.NEXT_PUBLIC_CONVEX_URL = "https://router-test.invalid";
process.env.CONST_ENGINE_API_KEY = "test-key";
handlers = {
  "router.gateway.authenticate": gateway.authenticate,
  "router.gateway.begin": gateway.begin,
  "router.gateway.settle": gateway.settle,
  "router.combos.prepareCombo": combos.prepareCombo,
  "router.combos.listCombos": combos.listCombos,
};
test.beforeEach(async () => {
  db = database();
  ctx = { db, scheduler: { runAfter: async () => null } };
  db.seed("users", "u1", { name: "One" });
  db.seed("users", "u2", { name: "Two" });
  db.seed("apiKeys", "key1", {
    userId: "u1",
    keyHash: await hashKey("sk-const-live-test"),
    keyPrefix: "masked",
    status: "active",
    name: "Production",
    usedTodayTokens: 0,
    dailyPeriodStartAt: dayStart(),
  });
  db.seed("userCredits", "wallet", {
    userId: "u1",
    balanceUsd: 1,
    totalDepositedUsd: 1,
    totalSpentUsd: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  fetches = 0;
  lastPayload = null;
  global.fetch = async (_url, init) => {
    fetches++;
    lastPayload = JSON.parse(init.body);
    if (lastPayload.stream) {
      const text =
        "data: " +
        JSON.stringify({ choices: [{ delta: { content: "OK" } }] }) +
        "\n\ndata: " +
        JSON.stringify({
          usage: {
            prompt_tokens: 20,
            completion_tokens: 5,
            prompt_tokens_details: { cached_tokens: 4 },
          },
          choices: [],
        }) +
        "\n\ndata: [DONE]\n\n";
      const encoder = new TextEncoder(),
        cut = text.indexOf("prompt_tokens") + 4;
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(encoder.encode(text.slice(0, cut)));
            c.enqueue(encoder.encode(text.slice(cut)));
            c.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }
    return Response.json({
      choices: [{ message: { role: "assistant", content: "OK" } }],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 5,
        prompt_tokens_details: { cached_tokens: 4 },
      },
    });
  };
});
test.after(() => {
  global.fetch = originalFetch;
});
const standard = "deepseek-v4.1-flash";
function request(
  body,
  headers = { Authorization: "Bearer sk-const-live-test" },
) {
  return new NextRequest("http://localhost/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
const body = (model = standard) => ({
  model,
  messages: [{ role: "user", content: "Hi" }],
  stream: false,
  max_tokens: 64,
});
const logs = () =>
  [...db.rows.values()].filter((r) => r.__table === "routerLogs");

test("large screenshot encodings do not consume the model's text context reservation", async () => {
  const image = "data:image/png;base64," + "A".repeat(1_300_000);
  const messages = [{ role: "user", content: [
    { type: "text", text: "Verify the completed website." },
    { type: "image_url", image_url: { url: image } },
  ] }];
  const response = await chat.POST(request({ ...body(), messages }));
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(lastPayload.messages, messages);
  assert.equal(fetches, 1);
  assert.equal(logs()[0].promptTokens, 20);
});

test("native upload and tool-observation images at the reported sizes reach the provider unchanged", async () => {
  const upload = "data:image/png;base64," + "A".repeat(1_640_984);
  const screenshot = "data:image/png;base64," + "A".repeat(1_982_944);
  const messages = [
    { role: "user", content: [{ type: "text", text: "Inspect this uploaded image." }, { type: "image_url", image_url: { url: upload } }] },
    { role: "assistant", content: null, tool_calls: [{ id: "screen", type: "function", function: { name: "read", arguments: '{"path":"sheet.png"}' } }] },
    { role: "tool", tool_call_id: "screen", content: "Image attached as a visual tool observation." },
    { role: "user", content: [{ type: "text", text: "Visual tool observation." }, { type: "image_url", image_url: { url: screenshot } }] },
  ];
  const response = await chat.POST(request({ ...body(), messages }));
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(lastPayload.messages, messages);
  assert.equal(fetches, 1);
});

test("media requests still reject text that exceeds the context reservation", async () => {
  const response = await chat.POST(request({ ...body(), messages: [{ role: "user", content: [
    { type: "text", text: "x".repeat(1_000_001) },
    { type: "image_url", image_url: { url: "https://example.com/screenshot.png" } },
  ] }] }));
  assert.equal(response.status, 400);
  assert.equal(fetches, 0);
});

test("combo context limits exclude screenshot encoding and forward the intact image", async () => {
  db.seed("routerCombos", "combo", {
    userId: "u1", name: "Vision", slug: "vision", status: "active", strategy: "priority", contextLength: 10000,
    models: [{ modelId: standard, providerId: "const", providerName: "Const", priority: 1 }],
  });
  const image = "data:image/png;base64," + "A".repeat(1_300_000);
  const input = { ...body("combo/vision"), messages: [{ role: "user", content: [
    { type: "text", text: "Verify the website" },
    { type: "image_url", image_url: { url: image } },
  ] }] };
  const response = await chat.POST(request(input));
  assert.equal(response.status, 200, await response.clone().text());
  await response.text();
  assert.deepEqual(lastPayload.messages, input.messages);
  const tooLong = await chat.POST(request({ ...input, messages: [{ role: "user", content: "x".repeat(30_001) }] }));
  assert.equal(tooLong.status, 400);
});

test("tool serialization flags reach the engine and reject invalid values", async () => {
  const response = await chat.POST(
    request({ ...body(), parallel_tool_calls: false }),
  );
  assert.equal(response.status, 200);
  assert.equal(lastPayload.parallel_tool_calls, false);
  assert.equal(
    (await chat.POST(request({ ...body(), parallel_tool_calls: "false" })))
      .status,
    400,
  );
});

test("an incomplete upstream stream is reported as failure and releases reservations", async () => {
  global.fetch = async () =>
    new Response(
      'data: {"choices":[{"delta":{"reasoning_content":"still thinking"}}]}\n\n',
    );
  const response = await chat.POST(request({ ...body(), stream: true }));
  const text = await response.text();
  assert.match(text, /incomplete_stream/);
  assert.equal(logs()[0].status, 502);
  assert.equal((await db.get("wallet")).reservedNanoUsd, 0);
});

test("the usage parser distinguishes a completion event from a dropped socket", () => {
  for (const tail of [
    "data: [DONE]\n\n",
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
  ]) {
    const parser = new SseUsageParser();
    parser.push(
      new TextEncoder().encode(
        'data: {"choices":[{"delta":{"reasoning":"thought"}}]}\n\n' + tail,
      ),
    );
    parser.finish();
    assert.equal(parser.hasTerminal, true);
    assert.equal(parser.outputText, "thought");
  }
});
const ticketArgs = (model = standard) => ({
  secret,
  rawApiKey: "sk-const-live-test",
  requestId: "req_ticket",
  model,
  requestedModel: model,
  promptTokens: 20,
  maxOutputTokens: 64,
});
const result = (id, extra = {}) => ({
  secret,
  id,
  promptTokens: 20,
  completionTokens: 5,
  cachedTokens: 4,
  status: 200,
  durationMs: 50,
  usageEstimated: false,
  ...extra,
});
test("catalog has no free variants and every chat model has a nonzero rate", () => {
  assert.equal(catalog.BUILTIN_MODELS.filter(m => m.tier === "free").length, 0);
  const llmModels = catalog.BUILTIN_MODELS.filter(m => m.category === "llm");
  assert.equal(llmModels.length, 21);
  for (const model of catalog.BUILTIN_MODELS) {
    assert.equal(model.tier, "paid");
    assert.equal(catalog.getManagedModel(model.modelId + ":free"), undefined);
    if (model.category === "llm") assert(catalog.tokenCostNano(model.modelId, 20, 5) > 0);
  }
  assert.equal(catalog.normalizeConstModelName(standard), "atmo/ali/deepseek-v4.1-flash");
});

test("unauthenticated, revoked, and expired credentials never call the engine", async () => {
  assert.equal((await chat.POST(request(body(), {}))).status, 401);
  assert.equal(
    (await chat.POST(request(body(), { Authorization: "Bearer invalid" })))
      .status,
    401,
  );
  await db.patch("key1", { status: "revoked" });
  assert.equal((await chat.POST(request(body()))).status, 401);
  assert.equal(
    (
      await chat.POST(
        request(body(), { "x-const-sso-token": "expired.jwt.token" }),
      )
    ).status,
    401,
  );
  assert.equal(fetches, 0);
});
test("forged free suffix and malformed messages are rejected before dispatch", async () => {
  assert.equal(
    (await chat.POST(request(body("gpt-6.1-sol:free")))).status,
    400,
  );
  assert.equal(
    (await chat.POST(request({ model: standard, messages: { bad: true } }))).status,
    400,
  );
  assert.equal(fetches, 0);
});
test("standard model request debits wallet and does not create a weekly quota", async () => {
  const res = await chat.POST(request(body()));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).model, standard);
  assert.equal(await db.query("userQuotas").first(), null);
  assert.equal((await db.get("wallet")).balanceNanoUsd, 1e9 - catalog.tokenCostNano(standard, 20, 5, 4));
  assert.equal(logs()[0].billingTier, "paid");
  assert.equal(logs()[0].cachedTokens, 4);
});

test("paid request uses actual cached price, settles once, and releases reservation", async () => {
  const ticket = await gateway.begin.handler(ctx, ticketArgs("gpt-6.1-sol"));
  await gateway.settle.handler(ctx, result(ticket.id));
  await gateway.settle.handler(ctx, result(ticket.id));
  const expected = catalog.tokenCostNano("gpt-6.1-sol", 20, 5, 4);
  const wallet = await db.get("wallet");
  assert.equal(wallet.balanceNanoUsd, 1e9 - expected);
  assert.equal(wallet.reservedNanoUsd, 0);
  assert.equal(logs().length, 1);
  assert.equal((await db.query("creditTransactions").collect()).length, 1);
});
for (const [model, upstream, expectedCostNano] of [
  ["gpt-6.1-sol", "atmo/cx/gpt-6.1-sol", 24840],
  ["gpt-6-astra", "atmo/cx/gpt-6-astra", 113850],
  ["claude-sonnet-5.5", "atmo/cc/claude-sonnet-5-5", 20700],
  ["minimax-m3.1-flash", "atmo/cbcn/minimax-m3.1-flash", 2184],
]) {
  for (const mode of ["API JSON", "API streaming", "playground SSO"]) {
    test(`${model} routes and bills correctly through ${mode}`, async () => {
      const engineFetch = global.fetch;
      let dispatchedModel;
      global.fetch = async (url, init) => {
        dispatchedModel = JSON.parse(init.body).model;
        // Reject IDs outside the engine catalog before returning a completion.
        if (dispatchedModel !== upstream)
          return Response.json({ error: { message: "Model not found" } }, { status: 404 });
        return engineFetch(url, init);
      };
      const streaming = mode !== "API JSON";
      const response = mode === "playground SSO"
        ? await generation.POST(request(
            { ...body(model), thinkingLevel: "medium" },
            { "x-const-sso-token": "valid.jwt.token" },
          ))
        : await chat.POST(request({ ...body(model), stream: streaming }));
      assert.equal(dispatchedModel, upstream);
      assert.equal(response.status, 200);
      if (streaming) {
        assert.match(response.headers.get("content-type"), /event-stream/);
        assert.match(await response.text(), /OK/);
      } else {
        const data = await response.json();
        assert.equal(data.model, model);
        assert.equal(data.choices[0].message.content, "OK");
      }
      const wallet = await db.get("wallet");
      assert.equal(wallet.balanceNanoUsd, 1e9 - expectedCostNano);
      assert.equal(wallet.reservedNanoUsd, 0);
      assert.equal(logs()[0].billingTier, "paid");
      assert.equal(logs()[0].model, model);
      assert.equal((await db.query("creditTransactions").collect()).length, 1);
    });
  }
}

test("zero-balance paid requests never reach the engine", async () => {
  await db.patch("wallet", { balanceUsd: 0 });
  assert.equal((await chat.POST(request(body("gpt-6.1-sol")))).status, 402);
  assert.equal(fetches, 0);
});

test("retired models are absent from discovery and cannot execute while active Claude 5.5 models are listed", async () => {
  const response = await models.GET(new NextRequest("http://localhost/v1/models"));
  const discovered = (await response.json()).data;
  assert(discovered.some((model) => model.id === "claude-sonnet-5.5" && model.vendor === "anthropic"));
  assert(discovered.some((model) => model.id === "claude-opus-5.5" && model.vendor === "anthropic"));
  assert(discovered.some((model) => model.id === "minimax-m3.1-flash" && model.vendor === "minimax"));
  assert(discovered.some((model) => model.id === "qwen-3.8-27b" && model.vendor === "qwen"));
  for (const model of [
    "claude-sonnet-4.6",
    "claude-opus-4.7",
    "qwen-3.8-omni-flash",
    "kimi-k2.8-preview",
    "minimax-m3",
  ]) {
    assert(!discovered.some((entry) => entry.id === model));
    assert.equal(catalog.getManagedModel(model), undefined);
    assert.equal((await chat.POST(request(body(model)))).status, 400);
    await assert.rejects(gateway.begin.handler(ctx, ticketArgs(model)));
  }
  assert.equal(fetches, 0);
});
test("settlement rejects negative values and untrusted callers", async () => {
  const ticket = await gateway.begin.handler(ctx, ticketArgs());
  await assert.rejects(
    gateway.settle.handler(ctx, result(ticket.id, { secret: "wrong" })),
  );
  await assert.rejects(
    gateway.settle.handler(ctx, result(ticket.id, { promptTokens: -1 })),
  );
  assert.equal(logs().length, 0);
});
test("reservations prevent concurrent paid requests overspending the wallet", async () => {
  await db.patch("wallet", { balanceNanoUsd: catalog.tokenCostNano(standard, 20, 64), balanceUsd: 0 });
  await gateway.begin.handler(ctx, ticketArgs());
  await assert.rejects(gateway.begin.handler(ctx, { ...ticketArgs(), requestId: "another" }), /Insufficient credits/);
});

test("daily key rollover clears prior-day counters and stale reservations", async () => {
  await db.patch("key1", {
    dailyLimitTokens: 100,
    dailyPeriodStartAt: dayStart() - 86400000,
    usedTodayTokens: 100,
    reservedTokens: 100,
  });
  await gateway.authenticate.handler(ctx, { rawApiKey: "sk-const-live-test" });
  const ticket = await gateway.begin.handler(ctx, ticketArgs());
  await gateway.settle.handler(ctx, result(ticket.id));
  assert.equal((await db.get("key1")).usedTodayTokens, 25);
  assert.equal((await db.get("key1")).reservedTokens, 0);
});
test("weekly rollover resets both token and image counters", () => {
  const state = calculateQuotaState(
    {
      weeklyLimitTokens: 7000000,
      usedTokens: 7000000,
      usedImages: 20,
      reservedTokens: 100,
      periodStartAt: 100,
      periodEndAt: 100 + WEEK_MS,
    },
    100 + WEEK_MS + 1,
  );
  assert.equal(state.usedTokens, 0);
  assert.equal(state.usedImages, 0);
  assert.equal(state.reservedTokens, 0);
});
test("combo forces stream true, preserves tool messages, and bills its selected target", async () => {
  db.seed("routerCombos", "combo", {
    userId: "u1",
    name: "Coding",
    slug: "coding",
    status: "active",
    strategy: "priority",
    contextLength: 10000,
    models: [
      {
        modelId: standard,
        providerId: "const",
        providerName: "Const",
        priority: 1,
      },
    ],
  });
  const input = {
    ...body("combo/coding"),
    messages: [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call1",
            type: "function",
            function: { name: "test", arguments: "{}" },
          },
        ],
      },
      { role: "tool", content: "OK", tool_call_id: "call1" },
    ],
  };
  const response = await chat.POST(request(input));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /event-stream/);
  await response.text();
  assert.equal(lastPayload.stream, true);
  assert.equal(lastPayload.messages[0].tool_calls[0].id, "call1");
  assert.equal(lastPayload.messages[1].tool_call_id, "call1");
  assert.equal((await db.get("wallet")).balanceNanoUsd, 1e9 - catalog.tokenCostNano(standard, 20, 5, 4));
  assert.equal(logs()[0].resolvedModel, standard);
  assert.equal(logs()[0].model, "combo/coding");
  await db.patch("combo", { status: "disabled" });
  await assert.rejects(
    combos.prepareCombo.handler({ ...ctx, userId: "u1" }, { slug: "coding" }),
  );
});
test("round robin persists its selection between executions", async () => {
  db.seed("routerCombos", "combo", {
    userId: "u1",
    name: "Rotation",
    slug: "rotation",
    status: "active",
    strategy: "round-robin",
    models: [
      { modelId: standard, providerId: "const", priority: 1 },
      { modelId: "glm-5.3-flash", providerId: "const", priority: 2 },
    ],
  });
  const one = await combos.prepareCombo.handler(
    { ...ctx, userId: "u1" },
    { slug: "rotation" },
  );
  const two = await combos.prepareCombo.handler(
    { ...ctx, userId: "u1" },
    { slug: "rotation" },
  );
  assert.notEqual(one.models[0].modelId, two.models[0].modelId);
});
test("SSE usage survives every possible split position", () => {
  const encoder = new TextEncoder();
  const data =
    "data: " +
    JSON.stringify({
      usage: {
        prompt_tokens: 1234,
        completion_tokens: 55,
        prompt_tokens_details: { cached_tokens: 100 },
      },
    }) +
    "\n\n";
  for (let i = 1; i < data.length; i++) {
    const parser = new SseUsageParser();
    parser.push(encoder.encode(data.slice(0, i)));
    parser.push(encoder.encode(data.slice(i)));
    parser.finish();
    assert.equal(parser.promptTokens, 1234);
    assert.equal(parser.completionTokens, 55);
    assert.equal(parser.cachedTokens, 100);
  }
});
test("discovery lists only paid models and authenticates combo discovery", async () => {
  db.seed("routerCombos", "combo", {
    userId: "u1",
    name: "Coding",
    slug: "coding",
    status: "active",
    strategy: "priority",
    contextLength: 10000,
    models: [],
  });
  const response = await models.GET(
    new NextRequest("http://localhost/v1/models", {
      headers: { Authorization: "Bearer sk-const-live-test" },
    }),
  );
  const data = await response.json();
  assert(data.data.some((m) => m.id === standard));
  assert(data.data.some((m) => m.id === "deepseek-v4.1-flash"));
  assert(data.data.every(m => !m.id.endsWith(":free")));
  assert(
    !data.data
      .find((m) => m.id === "deepseek-v4.1-flash")
      .display_name.endsWith(":free"),
  );
  assert(data.data.some((m) => m.id === "combo/coding"));
});
test("saved defaults and privacy settings affect requests", async () => {
  await settings.saveSettings.handler(
    { ...ctx, userId: "u1" },
    {
      defaultModel: standard,
      defaultTemperature: 0.25,
      enableStreaming: false,
      logPayloads: true,
      anonymizeTelemetry: false,
      notifyLowQuota: false,
    },
  );
  const input = body();
  delete input.model;
  const response = await chat.POST(
    request(input, {
      Authorization: "Bearer sk-const-live-test",
      "x-forwarded-for": "203.0.113.1",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(lastPayload.temperature, 0.25);
  assert.equal(logs()[0].prompt, "Hi");
  assert.equal(logs()[0].ip, "203.0.113.1");
});
test("new API keys reveal secrets once and do not persist plaintext", async () => {
  const created = await keys.createKey.handler(
    { ...ctx, userId: "u1" },
    { name: "New" },
  );
  assert(created.rawKey.startsWith("sk-const-live-"));
  assert.equal((await db.get(created.keyId)).rawKey, undefined);
  const listed = await keys.listKeys.handler({ ...ctx, userId: "u1" }, {});
  assert(listed.every((k) => k.rawKey === undefined));
});
test("private and reserved IPv4/IPv6 addresses are blocked", () => {
  for (const address of [
    "127.0.0.1",
    "10.2.3.4",
    "169.254.169.254",
    "100.64.1.1",
    "192.168.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
    "fc00::1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("missing server metering secret fails closed", async () => {
  delete process.env.ROUTER_GATEWAY_SECRET;
  try {
    assert.equal((await chat.POST(request(body()))).status, 503);
    assert.equal(fetches, 0);
  } finally {
    process.env.ROUTER_GATEWAY_SECRET = secret;
  }
});
test("failed upstream calls release held credit without charging the wallet", async () => {
  const origFetch = global.fetch;
  try {
    global.fetch = async () => new Response("Unavailable", { status: 503 });
    const response = await chat.POST(request(body("gpt-6.1-sol")));
    assert.equal(response.status, 503);
    assert.equal((await db.get("wallet")).reservedNanoUsd, 0);
    assert.equal((await db.get("wallet")).balanceUsd, 1);
    assert.equal((await db.query("creditTransactions").collect()).length, 0);
  } finally {
    global.fetch = origFetch;
  }
});
test("cancelled streaming requests persist partial usage and release credit reservations", async () => {
  const response = await chat.POST(request({ ...body(), stream: true }));
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel("user stopped");
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(logs()[0].status, 499);
  assert(logs()[0].totalTokens > 0);
  assert.equal((await db.get("wallet")).reservedNanoUsd, 0);
});
test("new accounts have a readable zero credit balance, not a query crash", async () => {
  const credits = load("packages/backend/convex/router/credits.ts");
  await db.delete("wallet");
  const wallet = await credits.getUserCredits.handler(
    { ...ctx, userId: "u1" },
    {},
  );
  assert.equal(wallet.balanceUsd, 0);
  assert.equal(wallet.topUpAvailable, false);
  await assert.rejects(
    credits.getUserCredits.handler(ctx, {
      ssoToken:
        "ignored." +
        Buffer.from(JSON.stringify({ sub: "u1" })).toString("base64url") +
        ".invalid",
    }),
  );
});
test("saved chat ownership and revision checks prevent cross-user access and lost updates", async () => {
  const chats = load("packages/backend/convex/router/chats.ts");
  const message = {
    id: "message1",
    role: "user",
    content: "Hello",
    createdAt: Date.now(),
  };
  const created = await chats.createChat.handler(
    { ...ctx, userId: "u1" },
    {
      modelId: standard,
      providerId: "const",
      temperature: 0.7,
      messages: [message],
    },
  );
  await assert.rejects(
    chats.updateChat.handler(
      { ...ctx, userId: "u2" },
      {
        chatId: created.chatId,
        messages: [message],
        expectedRevision: created.revision,
      },
    ),
  );
  const updated = await chats.updateChat.handler(
    { ...ctx, userId: "u1" },
    {
      chatId: created.chatId,
      messages: [
        message,
        {
          id: "message2",
          role: "assistant",
          content: "Partial response",
          createdAt: Date.now(),
        },
      ],
      expectedRevision: created.revision,
    },
  );
  assert.equal(updated.revision, 2);
  await assert.rejects(
    chats.updateChat.handler(
      { ...ctx, userId: "u1" },
      { chatId: created.chatId, messages: [message], expectedRevision: 1 },
    ),
  );
  assert.equal((await db.get(created.chatId)).messages.length, 0);
  assert.equal((await db.query("routerMessages").collect()).length, 2);
});

test("Playground opens a local session without loading saved conversations", () => {
  const React = appRequire("react");
  const { renderToStaticMarkup } = appRequire("react-dom/server");
  const calls = [];
  const box = ({ children }) => React.createElement("div", null, children);
  const ui = Object.fromEntries(
    [
      "Button",
      "Slider",
      "Badge",
      "Select",
      "SelectTrigger",
      "SelectValue",
      "SelectContent",
      "SelectItem",
      "ScrollArea",
      "SheetContent",
      "SheetTitle",
    ].map((name) => [name, box]),
  );
  const pageLoad = sourceLoader({
    "@const/backend/_generated/api": { api },
    "@/components/providers/convex-client-provider": {
      useRouterAuth: () => ({
        isAuthenticated: true,
        token: "valid.jwt.token",
      }),
    },
    "convex/react": {
      useQuery: (ref) => {
        calls.push(ref.path);
        assert.equal(ref.path, "router.combos.listCombos");
        return [];
      },
      useMutation: (ref) => {
        calls.push(ref.path);
        assert.ok(
          [
            "router.chats.generateUploadUrl",
            "router.chats.registerFile",
          ].includes(ref.path),
        );
        return async () => {
          throw Error("No upload should run while opening Playground");
        };
      },
      usePaginatedQuery: () => {
        throw Error("Playground must not load saved chats");
      },
    },
    "@const/ui": {
      ...ui,
      Input: () => React.createElement("input", { readOnly: true }),
      Sheet: () => null,
      cn: (...values) => values.filter(Boolean).join(" "),
      toast: { error: () => {}, success: () => {} },
    },
    "@/components/generation/model-selector-panel": {
      ModelSelectorPanel: () => null,
    },
    "@/components/generation/system-instruction-panel": {
      SystemInstructionPanel: () => null,
    },
    "@/components/generation/view-code-dialog": { ViewCodeDialog: () => null },
    "@/components/generation/chat-message-item": {
      ChatMessageItem: () => null,
    },
  });
  const Page = pageLoad(
    "apps/router/src/app/(dashboard)/generation/page.tsx",
  ).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /Playground/);
  assert.match(html, /Message prompt/);
  assert.doesNotMatch(html, /Chat history saved|Chat history|Untitled Chat/);
  assert.deepEqual(
    calls.sort(),
    [
      "router.chats.generateUploadUrl",
      "router.chats.registerFile",
      "router.combos.listCombos",
    ].sort(),
  );
});

const { chartBuckets, formatUsd } = load("apps/router/src/lib/router-analytics.ts");
test("usage charts aggregate every point across long periods without losing requests, tokens, or cost", () => {
 const now = Date.UTC(2026,10,1,12);
 const timeline = Array.from({length: 720}, (_, index) => ({timestamp:now-(719-index)*3600000,tokens:100+index,requests:3,costUsd:0.000123}));
 const buckets = chartBuckets(timeline, "30d", now);
 assert.ok(buckets.length <= 50);
 for(const metric of ["requests","tokens","costUsd"]) {
  const expected = timeline.reduce((sum,p)=>sum+p[metric],0), actual = buckets.reduce((sum,p)=>sum+p[metric],0);
  assert.ok(Math.abs(actual-expected)<1e-9, metric+" totals changed");
 }
 assert.deepEqual(chartBuckets([], "all", now), []);
});
test("short chart periods exclude earlier points and show zero-usage intervals honestly", () => {
 const now = Date.UTC(2026,10,1,12);
 const points = [{timestamp:now-72*3600000,tokens:100,requests:2,costUsd:1},{timestamp:now-3600000,tokens:500,requests:4,costUsd:0.01}];
 const buckets = chartBuckets(points,"24h",now);
 assert.equal(buckets.reduce((sum,p)=>sum+p.tokens,0),500);
 assert.ok(buckets.some(p=>p.tokens===0));
});
test("sub-microdollar amounts never display as free usage", () => {
 assert.equal(formatUsd(0.0000001),"<$0.000001");
 assert.equal(formatUsd(0),"$0.00");
 assert.equal(formatUsd(0.000012),"$0.000012");
});

// Payment tests exercise the production actions, verifier and ledger mutations.
function paymentEnvironment() {
  process.env.SUMOPOD_API_KEY = 'test-sumopod-key';
  db.seed('routerExchangeRates', 'usd-idr', { pair: 'USD_IDR', idrPerUsd: 17000, referenceDate: new Date().toISOString().slice(0, 10), fetchedAt: Date.now() });
  process.env.SUMOPOD_WEBHOOK_TOKEN = 'whtok_test';
  delete process.env.SUMOPOD_WEBHOOK_SECRET;
}
test.afterEach(() => {
  for (const name of ['SUMOPOD_API_KEY', 'SUMOPOD_IDR_PER_USD', 'SUMOPOD_WEBHOOK_TOKEN', 'SUMOPOD_WEBHOOK_SECRET']) delete process.env[name];
});
const paymentCtx = () => ({ ...ctx, userId: 'u1', runMutation: (ref, args) => payments[ref.path.split('.').at(-1)].handler({ ...ctx, userId: 'u1' }, args) });
async function preparePayment(creditCents = 1000, orderId = 'CONST-test-order', requestId = 'request-payment-0001') {
  paymentEnvironment();
  return payments.preparePayment.handler({ ...ctx, userId: 'u1' }, { creditCents, requestId, orderId });
}
const paidEvent = (extra = {}) => ({ eventType: 'payment.completed', orderId: 'CONST-test-order', paymentId: 'payment-1', amountIdr: 170000, status: 'completed', ...extra });
test('checkout fails closed without a rate or verified-webhook credentials', async () => {
  assert.equal(paymentContract.checkoutConfig().available, false);
  await assert.rejects(preparePayment(0), /credit amount/);
  paymentEnvironment();
  assert.equal((await payments.getCheckoutConfig.handler({ ...ctx, userId: 'u1' }, {})).available, true);
  delete process.env.SUMOPOD_WEBHOOK_TOKEN;
  assert.equal(paymentContract.checkoutConfig(17000).available, false);
  process.env.SUMOPOD_WEBHOOK_TOKEN = 'whtok_test';
  assert.equal(paymentContract.checkoutConfig(NaN).available, false);
});
test('quotes use integer cents, round IDR upward and reject invalid amounts', () => {
  assert.deepEqual(paymentContract.quotePayment(101, 17001), { amountIdr: 17172, creditNanoUsd: 1010000000 });
  for (const value of [0, -1, 99, 50001, 100.1, NaN, Infinity]) assert.throws(() => paymentContract.quotePayment(value, 17000));
  assert.equal(paymentContract.isPaymentLink('https://pay.sumopod.com/pay/payment-1'), true);
  assert.equal(paymentContract.isPaymentLink('https://checkout.pymnt.app/payment-links/19f59992-558d-4f32-b9df-f1000bf81036'), true);
  assert.equal(paymentContract.isPaymentLink('https://checkout.pymnt.app/949c9251-d33d-41e1-8f32-5342da523c1e'), true);
  for (const value of ['https://evil.test/pay/id', 'https://pay.sumopod.com.evil.test/pay/id', 'javascript:alert(1)', 'https://a:b@pay.sumopod.com/pay/id', 'https://checkout.pymnt.app.evil.test/payment-links/id', 'http://checkout.pymnt.app/payment-links/id', 'https://checkout.pymnt.app/other/id', 'https://a:b@checkout.pymnt.app/payment-links/id', 'https://checkout.pymnt.app:444/payment-links/id', 'https://checkout.pymnt.app/payment-links/id/extra']) assert.equal(paymentContract.isPaymentLink(value), false);
});

test('reference rates validate currency, dates and finite values before caching', () => {
  const now = Date.UTC(2026, 10, 4, 12);
  const valid = { base: 'USD', quote: 'IDR', date: '2026-11-04', rate: 18143.12 };
  assert.deepEqual(rateContract.parseReferenceRate(valid, now), { idrPerUsd: 18144, referenceDate: '2026-11-04' });
  for (const changed of [{ base: 'EUR' }, { quote: 'EUR' }, { date: '2026-11-05' }, { date: '2026-02-30' }, { date: '2026-10-20' }, { rate: '18143' }, { rate: NaN }, { rate: Infinity }, { rate: 0 }, { rate: 1e7 }]) {
    assert.throws(() => rateContract.parseReferenceRate({ ...valid, ...changed }, now));
  }
  const cached = { idrPerUsd: 18144, referenceDate: valid.date, fetchedAt: now };
  assert.equal(rateContract.usableReferenceRate(cached, now + rateContract.RATE_CACHE_MAX_AGE), 18144);
  assert.equal(rateContract.usableReferenceRate(cached, now + rateContract.RATE_CACHE_MAX_AGE + 1), null);
  assert.equal(rateContract.usableReferenceRate({ ...cached, referenceDate: '2026-10-20' }, now), null);
  assert.equal(rateContract.usableReferenceRate(null, now), null);
});

test('new checkout refuses changed or stale rates but retries preserve an existing invoice', async () => {
  const { order } = await preparePayment();
  await db.patch('usd-idr', { idrPerUsd: 18000 });
  const args = { creditCents: 1000, requestId: 'request-payment-0002', orderId: 'CONST-new', expectedIdrPerUsd: 17000 };
  await assert.rejects(payments.preparePayment.handler({ ...ctx, userId: 'u1' }, args), /rate changed/);
  await db.patch('usd-idr', { fetchedAt: Date.now() - rateContract.RATE_CACHE_MAX_AGE - 1000 });
  assert.equal((await payments.getCheckoutConfig.handler({ ...ctx, userId: 'u1' }, {})).available, false);
  await assert.rejects(payments.preparePayment.handler({ ...ctx, userId: 'u1' }, args), /temporarily unavailable/);
  const retry = await payments.preparePayment.handler({ ...ctx, userId: 'u1' }, { ...args, requestId: order.requestId });
  assert.equal(retry.isNew, false);
  assert.equal(retry.order.amountIdr, 170000);
  assert.equal((await db.query('routerPayments').collect()).length, 1);
});

test('rate refresh stores valid observations and preserves cache on failure', async () => {
  paymentEnvironment();
  const refreshCtx = { runMutation: (ref, args) => exchangeRates.storeReferenceRate.handler(ctx, args) };
  global.fetch = async url => {
    assert.equal(url, 'https://api.frankfurter.dev/v2/rate/USD/IDR');
    return Response.json({ base: 'USD', quote: 'IDR', date: new Date().toISOString().slice(0, 10), rate: 18143.12 });
  };
  await exchangeRates.refresh.handler(refreshCtx, {});
  assert.equal((await db.get('usd-idr')).idrPerUsd, 18144);
  global.fetch = async () => Response.json({ base: 'USD', quote: 'IDR', date: '2020-01-01', rate: 5 });
  await assert.rejects(exchangeRates.refresh.handler(refreshCtx, {}), /Outdated/);
  global.fetch = async () => new Response('unavailable', { status: 503 });
  await assert.rejects(exchangeRates.refresh.handler(refreshCtx, {}), /unavailable/);
  assert.equal((await db.get('usd-idr')).idrPerUsd, 18144);
});
test('checkout requires authentication, isolates history and freezes the original quote', async () => {
  const { order } = await preparePayment();
  await assert.rejects(payments.preparePayment.handler(ctx, { creditCents: 1000, requestId: 'request-payment-0002', orderId: 'CONST-other' }), /Unauthorized/);
  await db.patch('usd-idr', { idrPerUsd: 18000 });
  const again = await payments.preparePayment.handler({ ...ctx, userId: 'u1' }, { creditCents: 1000, requestId: order.requestId, orderId: 'CONST-duplicate' });
  assert.equal(again.isNew, false);
  assert.equal(again.order.amountIdr, 170000);
  assert.deepEqual(await payments.listPayments.handler({ ...ctx, userId: 'u2' }, {}), []);
  assert.equal((await payments.listPayments.handler({ ...ctx, userId: 'u1' }, {})).length, 1);
});
test('checkout action calls QRIS once per request ID and never credits an unpaid invoice', async () => {
  paymentEnvironment(); let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api-pay.sumopod.com/api/v1/payments');
    assert.equal(options.headers['X-Api-Key'], 'test-sumopod-key');
    const body = JSON.parse(options.body);
    assert.equal(body.currency, 'IDR');
    assert.equal(body.payment_method_type_code, 'QRIS');
    assert.equal(body.amount, 170000);
    assert.equal(body.success_return_url, 'https://router.const.web.id/credits');
    return Response.json({ payment_id: 'payment-1', order_id: body.order_id, amount: body.amount, currency: 'IDR', fee: 1490, net_amount: 168510, status: 'pending', expires_at: new Date(Date.now() + 86400000).toISOString().replace('Z', '12345Z'), payment_link_url: 'https://checkout.pymnt.app/payment-links/19f59992-558d-4f32-b9df-f1000bf81036', created_at: null });
  };
  const args = { creditCents: 1000, requestId: 'request-payment-0001' };
  const first = await payments.createPayment.handler(paymentCtx(), args);
  assert.deepEqual(await payments.createPayment.handler(paymentCtx(), args), first);
  assert.equal(calls, 1);
  assert.equal((await db.get('wallet')).balanceUsd, 1);
  assert.equal((await db.query('routerPayments').first()).status, 'pending');
  assert.equal((await payments.listPayments.handler({ ...ctx, userId: 'u1' }, {}))[0].paymentLinkUrl, 'https://checkout.pymnt.app/payment-links/19f59992-558d-4f32-b9df-f1000bf81036');
});
test('ambiguous provider failure retains the order and retry never creates a second invoice', async () => {
  paymentEnvironment(); let calls = 0;
  global.fetch = async () => { calls++; throw new Error('socket closed'); };
  const args = { creditCents: 1000, requestId: 'request-payment-0001' };
  await assert.rejects(payments.createPayment.handler(paymentCtx(), args), /confirmation is delayed/);
  await payments.createPayment.handler(paymentCtx(), args);
  assert.equal(calls, 1);
  assert.equal((await db.query('routerPayments').first()).status, 'creating');
});
test('duplicate and reordered completion webhooks credit exactly once and preserve reservations', async () => {
  await preparePayment();
  await db.patch('wallet', { reservedNanoUsd: 10000 });
  await payments.settlePayment.handler(ctx, paidEvent({ eventType: 'payment.expired', status: 'expired' }));
  await payments.settlePayment.handler(ctx, paidEvent());
  await payments.settlePayment.handler(ctx, paidEvent());
  await payments.settlePayment.handler(ctx, paidEvent({ eventType: 'payment.failed', status: 'failed' }));
  const wallet = await db.get('wallet');
  assert.equal(wallet.balanceNanoUsd, 11e9);
  assert.equal(wallet.totalDepositedUsd, 11);
  assert.equal(wallet.reservedNanoUsd, 10000);
  assert.equal((await db.query('creditTransactions').collect()).length, 1);
  assert.equal((await db.query('routerPayments').first()).status, 'completed');
});
test('mismatched order, amount, status or payment ID cannot credit the wallet', async () => {
  await preparePayment();
  await payments.attachPayment.handler(ctx, { orderId: 'CONST-test-order', paymentId: 'payment-1', paymentLinkUrl: 'https://pay.sumopod.com/pay/payment-1', expiresAt: Date.now() + 1000, feeIdr: 1490, netAmountIdr: 168510 });
  for (const extra of [{ orderId: 'missing' }, { amountIdr: 1 }, { paymentId: 'other' }, { status: 'pending' }]) await assert.rejects(payments.settlePayment.handler(ctx, paidEvent(extra)));
  assert.equal((await db.get('wallet')).balanceUsd, 1);
});
test('webhook signature verifies raw bytes, rejects tampering and stale timestamps, and supports rotation', async () => {
  const { createHmac } = require('node:crypto');
  paymentEnvironment();
  const key = Buffer.from('test-signing-key');
  process.env.SUMOPOD_WEBHOOK_SECRET = 'whsec_' + key.toString('base64');
  const raw = '{"event_type":"payment.test"}';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', key).update('evt_1.' + timestamp + '.' + raw).digest('base64');
  const headers = new Headers({ 'svix-id': 'evt_1', 'svix-timestamp': timestamp, 'svix-signature': 'v1,old v1,' + signature, 'x-webhook-token': 'whtok_test' });
  assert.equal(await paymentContract.verifyPaymentWebhook(headers, raw), true);
  assert.equal(await paymentContract.verifyPaymentWebhook(headers, raw + ' '), false);
  assert.equal(await paymentContract.verifyPaymentWebhook(headers, raw, Date.now() + 301000), false);
  headers.delete('svix-signature');
  assert.equal(await paymentContract.verifyPaymentWebhook(headers, raw), false);
});
test('webhook rejects unsigned payloads, acknowledges tests and credits authenticated events', async () => {
  await preparePayment();
  const request = (body, headers = {}) => new Request('https://example.convex.site/payments/sumopod/webhook', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const event = { event_type: 'payment.completed', data: { payment_id: 'payment-1', order_id: 'CONST-test-order', amount: 170000, status: 'completed' } };
  assert.equal((await payments.sumopodWebhook(paymentCtx(), request(event))).status, 401);
  assert.equal((await payments.sumopodWebhook(paymentCtx(), request({ event_type: 'payment.test' }, { 'x-webhook-token': 'whtok_test' }))).status, 200);
  assert.equal((await payments.sumopodWebhook(paymentCtx(), request(event, { 'x-webhook-token': 'whtok_test' }))).status, 200);
  assert.equal((await db.get('wallet')).balanceUsd, 11);
});

test('one provider payment cannot credit two different orders', async () => {
  await preparePayment();
  await payments.settlePayment.handler(ctx, paidEvent());
  await preparePayment(1000, 'CONST-other-order', 'request-payment-0002');
  await assert.rejects(payments.settlePayment.handler(ctx, paidEvent({ orderId: 'CONST-other-order' })), /already belongs/);
  assert.equal((await db.get('wallet')).balanceUsd, 11);
});
test('completed payment creates a missing wallet and adds only the purchased credit', async () => {
  await preparePayment();
  await db.delete('wallet');
  await payments.settlePayment.handler(ctx, paidEvent());
  const wallet = await db.query('userCredits').first();
  assert.equal(wallet.balanceNanoUsd, 10e9);
  assert.equal(wallet.totalDepositedUsd, 10);
});

test('invalid provider JSON does not attach a checkout or credit the wallet', async () => {
  paymentEnvironment();
  for (const [index, value] of [null, [], { expires_at: { toString: null } }].entries()) {
    global.fetch = async () => Response.json(value);
    await assert.rejects(payments.createPayment.handler(paymentCtx(), { creditCents: 1000, requestId: 'request-invalid-json-' + index }), /invalid checkout/);
  }
  assert.equal((await db.get('wallet')).balanceUsd, 1);
  assert.equal((await db.query('routerPayments').collect()).filter(order => order.paymentLinkUrl).length, 0);
});

test('hosted checkout still rejects mismatched currency or invoice identity', async () => {
  paymentEnvironment();
  const base = { payment_id: 'payment-1', amount: 170000, currency: 'IDR', fee: 1490, net_amount: 168510, status: 'pending', expires_at: new Date(Date.now() + 86400000).toISOString(), payment_link_url: 'https://checkout.pymnt.app/payment-links/19f59992-558d-4f32-b9df-f1000bf81036' };
  for (const [index, changed] of [{ currency: 'USD' }, { amount: 170001 }, { order_id: 'CONST-wrong-order' }, { payment_link_url: 'https://checkout.pymnt.app.evil.test/payment-links/id' }].entries()) {
    global.fetch = async (_url, options) => Response.json({ ...base, order_id: JSON.parse(options.body).order_id, ...changed });
    await assert.rejects(payments.createPayment.handler(paymentCtx(), { creditCents: 1000, requestId: 'request-hosted-invalid-' + index }), /invalid checkout/);
  }
  assert.equal((await db.query('routerPayments').collect()).some(order => order.paymentLinkUrl), false);
  assert.equal((await db.get('wallet')).balanceUsd, 1);
});

test('historical invoice recovery restores its link without crediting or inventing fees', async () => {
  const { order } = await preparePayment();
  await payments.attachPayment.handler(ctx, { orderId: order.orderId, paymentId: 'recovered-payment', paymentLinkUrl: 'https://checkout.pymnt.app/949c9251-d33d-41e1-8f32-5342da523c1e', expiresAt: order.createdAt + 86400000 });
  const recovered = (await payments.listPayments.handler({ ...ctx, userId: 'u1' }, {}))[0];
  assert.equal(recovered.status, 'pending');
  assert.equal(recovered.feeIdr, undefined);
  assert.equal(recovered.netAmountIdr, undefined);
  assert.equal(recovered.amountIdr, 170000);
  assert.equal((await db.get('wallet')).balanceUsd, 1);
  await payments.settlePayment.handler(ctx, paidEvent({ paymentId: 'recovered-payment' }));
  await payments.settlePayment.handler(ctx, paidEvent({ paymentId: 'recovered-payment' }));
  assert.equal((await db.get('wallet')).balanceUsd, 11);
});

test('payment visibility is authenticated, owner-scoped, reversible and idempotent', async () => {
  const { order } = await preparePayment();
  const args = { orderId: order.orderId, hidden: true };
  await assert.rejects(payments.setPaymentVisibility.handler(ctx, args), /Unauthorized/);
  await assert.rejects(payments.setPaymentVisibility.handler({ ...ctx, userId: 'u2' }, args), /Payment not found/);
  await payments.setPaymentVisibility.handler({ ...ctx, userId: 'u1' }, args);
  const hiddenAt = (await db.get(order._id)).archivedAt;
  await payments.setPaymentVisibility.handler({ ...ctx, userId: 'u1' }, args);
  assert.equal((await db.get(order._id)).archivedAt, hiddenAt);
  assert.equal((await payments.listPayments.handler({ ...ctx, userId: 'u1' }, {})).length, 0);
  assert.equal((await payments.listPayments.handler({ ...ctx, userId: 'u1' }, { archived: true })).length, 1);
  assert.equal((await payments.listPayments.handler({ ...ctx, userId: 'u2' }, { archived: true })).length, 0);
  await payments.setPaymentVisibility.handler({ ...ctx, userId: 'u1' }, { ...args, hidden: false });
  assert.equal((await payments.listPayments.handler({ ...ctx, userId: 'u1' }, {})).length, 1);
  assert.equal((await db.get(order._id)).status, 'creating');
  assert.equal((await db.get('wallet')).balanceUsd, 1);
});

test('hiding an invoice does not stop verified completion or create duplicate credit', async () => {
  const { order } = await preparePayment();
  await payments.setPaymentVisibility.handler({ ...ctx, userId: 'u1' }, { orderId: order.orderId, hidden: true });
  await payments.settlePayment.handler(ctx, paidEvent());
  await payments.settlePayment.handler(ctx, paidEvent());
  assert.equal((await db.get('wallet')).balanceUsd, 11);
  const hidden = await payments.listPayments.handler({ ...ctx, userId: 'u1' }, { archived: true });
  assert.equal(hidden[0].status, 'completed');
  assert.equal(hidden[0].amountIdr, order.amountIdr);
  assert.equal((await db.query('creditTransactions').collect()).filter(tx => tx.type === 'deposit').length, 1);
});

test("Opus discovery and settlement use the same fixed input, cache, and output rates", async () => {
  const response = await models.GET(new NextRequest("http://localhost/v1/models"));
  const { data } = await response.json();
  const opus = data.find((model) => model.id === "claude-opus-5.5");
  assert.equal(opus.pricing.unit, "USD/token");
  assert.equal(Number(opus.pricing.prompt), 0.60 / 1e6);
  assert.equal(Number(opus.pricing.cache), 0.060 / 1e6);
  assert.equal(Number(opus.pricing.completion), 3.00 / 1e6);
  assert(!("promo" in opus));

  const ticket = await gateway.begin.handler(ctx, ticketArgs(opus.id));
  await gateway.settle.handler(ctx, result(ticket.id));
  assert.equal((await db.get("wallet")).balanceNanoUsd, 1e9 - 24840);
});

test("benchmark snapshot covers every managed chat model", () => {
  assert.deepEqual(
    Object.keys(benchmarks).sort(),
    catalog.BUILTIN_MODELS.filter(model => model.category === "llm")
      .map(model => model.modelId)
      .sort(),
  );
});

test('per-model maxOutputTokens caps clamp oversized max_tokens before forwarding upstream', async () => {
  for (const [modelId, expectedCap] of [
    ['kimi-k3', 32000],
    ['glm-5.3-flash', 48000],
    ['gemini-3.8-flash', 65536],
  ]) {
    const res = await chat.POST(request({ ...body(modelId), max_tokens: 128000 }));
    assert.equal(res.status, 200);
    assert.equal(lastPayload.max_tokens, expectedCap);
  }
});

test('upstream first-token TTFT timeout aborts keep-alive-only stalls without charging wallet', async () => {
  const prevTimeout = process.env.ROUTER_FIRST_TOKEN_TIMEOUT_MS;
  process.env.ROUTER_FIRST_TOKEN_TIMEOUT_MS = '120';
  let heartbeatTimer;
  global.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          heartbeatTimer = setInterval(() => {
            try {
              controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
            } catch {}
          }, 5);
        },
        cancel() {
          clearInterval(heartbeatTimer);
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
  try {
    const response = await chat.POST(request({ ...body(), stream: true }));
    const text = await response.text();
    assert.match(text, /upstream_ttft_timeout/);
    assert.equal(logs()[0].status, 504);
    const wallet = await db.get('wallet');
    assert.equal(wallet.balanceNanoUsd, 1e9);
    assert.equal(wallet.reservedNanoUsd, 0);
  } finally {
    clearInterval(heartbeatTimer);
    if (prevTimeout === undefined) delete process.env.ROUTER_FIRST_TOKEN_TIMEOUT_MS;
    else process.env.ROUTER_FIRST_TOKEN_TIMEOUT_MS = prevTimeout;
  }
});

test('combo fails over to secondary target when primary emits HTTP 200 keep-alive then capacity_saturated SSE error', async () => {
  db.seed('routerCombos', 'combo_failover', {
    userId: 'u1',
    name: 'Resilient',
    slug: 'resilient',
    status: 'active',
    strategy: 'priority',
    contextLength: 100000,
    models: [
      { modelId: 'deepseek-v4.1-flash', providerId: 'const', providerName: 'Const', priority: 1 },
      { modelId: 'glm-5.3-flash', providerId: 'const', providerName: 'Const', priority: 2 },
    ],
  });
  const engineFetch = global.fetch;
  let callIndex = 0;
  global.fetch = async (url, init) => {
    callIndex += 1;
    if (callIndex === 1) {
      return new Response(
        ': keep-alive\n\ndata: {"error":{"code":"capacity_saturated","message":"All upstream accounts busy"}}\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }
    return engineFetch(url, init);
  };
  const response = await chat.POST(request({ ...body('combo/resilient'), stream: true }));
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.match(text, /OK/);
  assert.equal(callIndex, 2);
  assert.equal(response.headers.get('X-Const-Combo-Selected-Model'), 'glm-5.3-flash');
  assert.equal(response.headers.get('X-Const-Combo-Fallbacks'), '1');
  assert.equal(logs().length, 2);
  assert.equal(logs()[0].resolvedModel, 'deepseek-v4.1-flash');
  assert.equal(logs()[0].status, 429);
  assert.equal(logs()[1].resolvedModel, 'glm-5.3-flash');
  assert.equal(logs()[1].status, 200);
  assert.equal((await db.get('wallet')).balanceNanoUsd, 1e9 - catalog.tokenCostNano('glm-5.3-flash', 20, 5, 4));
  assert.equal((await db.get('wallet')).reservedNanoUsd, 0);
});
