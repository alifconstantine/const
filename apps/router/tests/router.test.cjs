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
  },
  "../_generated/api": { api, internal },
  "@const/backend/_generated/api": { api, internal },
});
const gateway = load("packages/backend/convex/router/gateway.ts");
const keys = load("packages/backend/convex/router/keys.ts");
const combos = load("packages/backend/convex/router/combos.ts");
const catalog = load("packages/backend/convex/router/modelCatalog.ts");
const settings = load("packages/backend/convex/router/settings.ts");
const { calculateQuotaState, WEEK_MS } = load(
  "packages/backend/convex/router/quotas.ts",
);
const { dayStart, hashKey } = load("packages/backend/convex/router/access.ts");
const { SseUsageParser } = load("apps/router/src/lib/telemetry.ts");
const chat = load("apps/router/src/app/v1/chat/completions/route.ts");
const models = load("apps/router/src/app/v1/models/route.ts");
const { isPublicAddress } = load("apps/router/src/lib/public-fetch.ts");
const originalFetch = global.fetch;
function sidebarFixture(results, authenticated = true) {
  const React = appRequire("react");
  const { renderToStaticMarkup } = appRequire("react-dom/server");
  let subscriptions;
  const sidebarLoad = sourceLoader({
    "convex/react": {
      useQueries: (queries) => {
        subscriptions = queries;
        return results;
      },
    },
    "next/navigation": { usePathname: () => "/models" },
    "next/link": ({ children, ...props }) =>
      React.createElement("a", props, children),
    "@const/backend/_generated/api": { api },
    "@/components/providers/convex-client-provider": {
      useRouterAuth: () => ({ isAuthenticated: authenticated }),
    },
    "./account-menu": {
      AccountMenu: () => React.createElement("div", null, "Account"),
    },
    "@const/ui": {
      Button: ({ children, variant, size, ...props }) =>
        React.createElement("button", props, children),
      ConstLogoIcon: () => null,
      cn: (...names) => names.filter(Boolean).join(" "),
    },
  });
  const { Sidebar } = sidebarLoad(
    "apps/router/src/components/dashboard/sidebar.tsx",
  );
  return {
    html: renderToStaticMarkup(React.createElement(Sidebar)),
    subscriptions,
  };
}
test("sidebar remains usable when production settings or quota queries fail", () => {
  const quota = { weeklyLimitTokens: 7_000_000, remainingTokens: 700_000 };
  const settingsMissing = sidebarFixture({
    quota,
    settings: new Error("Missing function"),
  });
  assert.match(settingsMissing.html, /Models &amp; pricing/);
  assert.match(settingsMissing.html, /700k free tokens/);
  assert.doesNotMatch(settingsMissing.html, /Less than 15%/);
  const bothMissing = sidebarFixture({
    quota: new Error("Quota unavailable"),
    settings: new Error("Settings unavailable"),
  });
  assert.match(bothMissing.html, /Free usage unavailable/);
  assert.match(bothMissing.html, /Retry connection/);
  assert.match(bothMissing.html, /href="\/models"/);
  assert.doesNotMatch(
    bothMissing.html,
    /7M free tokens|Quota unavailable|Settings unavailable/,
  );
  const recovered = sidebarFixture({
    quota,
    settings: { notifyLowQuota: true },
  });
  assert.match(recovered.html, /Less than 15%/);
});
test("sidebar skips protected subscriptions before authentication", () => {
  const { html, subscriptions } = sidebarFixture({}, false);
  assert.deepEqual(subscriptions, {});
  assert.match(html, /href="\/models"/);
  assert.doesNotMatch(html, /Free usage unavailable|7M free tokens/);
});
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
const free = "deepseek-v4.1-flash:free";
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
const body = (model = free) => ({
  model,
  messages: [{ role: "user", content: "Hi" }],
  stream: false,
  max_tokens: 64,
});
const logs = () =>
  [...db.rows.values()].filter((r) => r.__table === "routerLogs");
const ticketArgs = (model = free) => ({
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
test("only three explicitly listed IDs can use :free", () => {
  assert.equal(
    catalog.BUILTIN_MODELS.filter((m) => m.tier === "free").length,
    3,
  );
  assert.equal(catalog.getManagedModel("gpt-6.1-sol:free"), undefined);
  assert.equal(catalog.getManagedModel("atmo/arbitrary:free"), undefined);
  assert.equal(catalog.getManagedModel("deepseek-v4.1-flash").tier, "paid");
  assert.equal(
    catalog.normalizeConstModelName(free),
    "atmo/ali/deepseek-v4.1-flash-1017",
  );
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
    (await chat.POST(request({ model: free, messages: { bad: true } }))).status,
    400,
  );
  assert.equal(fetches, 0);
});
test("free request reduces weekly quota and retains cache as input, without wallet debit", async () => {
  const res = await chat.POST(request(body()));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.equal((await res.json()).model, free);
  const quota = await db.query("userQuotas").first();
  assert.equal(quota.usedTokens, 25);
  assert.equal(quota.reservedTokens, 0);
  assert.equal((await db.get("wallet")).balanceUsd, 1);
  assert.equal(logs()[0].billingTier, "free");
  assert.equal(logs()[0].cachedTokens, 4);
  assert.equal(logs()[0].ip, undefined);
  assert.equal(logs()[0].prompt, undefined);
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
test("zero-balance paid requests never reach the engine", async () => {
  await db.patch("wallet", { balanceUsd: 0 });
  assert.equal((await chat.POST(request(body("gpt-6.1-sol")))).status, 402);
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
test("reservations prevent concurrent free requests overspending the remaining allowance", async () => {
  db.seed("userQuotas", "quota", {
    userId: "u1",
    weeklyLimitTokens: 100,
    usedTokens: 0,
    periodStartAt: Date.now(),
    periodEndAt: Date.now() + WEEK_MS,
    reservedTokens: 0,
  });
  await gateway.begin.handler(ctx, ticketArgs());
  await assert.rejects(
    gateway.begin.handler(ctx, { ...ticketArgs(), requestId: "another" }),
  );
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
test("combo forces stream true, preserves tool messages, and debits free usage for its target", async () => {
  db.seed("routerCombos", "combo", {
    userId: "u1",
    name: "Coding",
    slug: "coding",
    status: "active",
    strategy: "priority",
    contextLength: 10000,
    models: [
      {
        modelId: free,
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
  assert.equal((await db.query("userQuotas").first()).usedTokens, 25);
  assert.equal(logs()[0].resolvedModel, free);
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
      { modelId: free, providerId: "const", priority: 1 },
      { modelId: "glm-5.3-flash:free", providerId: "const", priority: 2 },
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
test("discovery retains both free and paid variants and authenticates combo discovery", async () => {
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
  assert(data.data.some((m) => m.id === free));
  assert(data.data.some((m) => m.id === "deepseek-v4.1-flash"));
  assert(data.data.some((m) => m.id === "combo/coding"));
});
test("saved defaults and privacy settings affect requests", async () => {
  await settings.saveSettings.handler(
    { ...ctx, userId: "u1" },
    {
      defaultModel: free,
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
  global.fetch = async () => new Response("Unavailable", { status: 503 });
  const response = await chat.POST(request(body("gpt-6.1-sol")));
  assert.equal(response.status, 503);
  assert.equal((await db.get("wallet")).reservedNanoUsd, 0);
  assert.equal((await db.get("wallet")).balanceUsd, 1);
  assert.equal((await db.query("creditTransactions").collect()).length, 0);
});
test("cancelled streaming requests persist partial usage and release free reservations", async () => {
  const response = await chat.POST(request({ ...body(), stream: true }));
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel("user stopped");
  assert.equal(logs()[0].status, 499);
  assert(logs()[0].totalTokens > 0);
  assert.equal((await db.query("userQuotas").first()).reservedTokens, 0);
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
      modelId: free,
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
