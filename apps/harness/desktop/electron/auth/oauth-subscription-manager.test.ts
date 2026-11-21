import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  OAuthSubscriptionManager,
  extractOpenAiAccountProfile,
} from "./oauth-subscription-manager.js";
import {
  parseBuiltinSlashCommand,
  filterBuiltinSlashCommands,
} from "../../src/lib/slash-commands.js";

function makeJwt(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

test("extractOpenAiAccountProfile parses ChatGPT accountId, email, and planType from JWT", () => {
  const access = makeJwt({
    "https://api.openai.com/auth": {
      chatgpt_account_id: "acct_xyz_123",
      chatgpt_plan_type: "plus",
    },
    "https://api.openai.com/profile": {
      email: "Dev@Example.com",
    },
  });
  const profile = extractOpenAiAccountProfile(access);
  assert.equal(profile.accountId, "acct_xyz_123");
  assert.equal(profile.planType, "plus");
  assert.equal(profile.email, "dev@example.com");
});

test("OAuthSubscriptionManager encrypts stored credentials and auto-refreshes expired tokens", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "const-oauth-test-"));
  const storePath = path.join(tmpDir, "oauth.enc");
  const cipher = {
    encrypt: (plain: string) => Buffer.from(`ENC:${plain}`, "utf8"),
    decrypt: (buf: Buffer) => {
      const s = buf.toString("utf8");
      assert.ok(s.startsWith("ENC:"));
      return s.slice(4);
    },
  };

  let refreshCalls = 0;
  const mockFetch: typeof fetch = async () => {
    refreshCalls++;
    return new Response(
      JSON.stringify({
        access_token: "fresh-access-token",
        refresh_token: "fresh-refresh-token",
        expires_in: 3600,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    // Seed an expired encrypted credential on disk
    fs.writeFileSync(
      storePath,
      cipher.encrypt(
        JSON.stringify({
          anthropic: {
            provider: "anthropic",
            accessToken: "expired-token",
            refreshToken: "old-refresh-token",
            expiresAt: Date.now() - 10_000,
            email: "user@anthropic.test",
            connectedAt: Date.now() - 100_000,
            updatedAt: Date.now() - 100_000,
          },
        }),
      ),
    );

    const manager = new OAuthSubscriptionManager({
      storePath,
      cipher,
      fetchImpl: mockFetch,
    });

    const providers = manager.listProviders();
    assert.equal(providers.length, 8);
    assert.equal(manager.getPublicStatus("anthropic").connected, true);
    assert.equal(manager.getPublicStatus("anthropic").email, "user@anthropic.test");

    const refreshed = await manager.getValidCredential("anthropic");
    assert.ok(refreshed);
    assert.equal(refreshed.accessToken, "fresh-access-token");
    assert.equal(refreshed.refreshToken, "fresh-refresh-token");
    assert.equal(refreshCalls, 1);

    // Ensure disk payload stays encrypted
    const diskRaw = fs.readFileSync(storePath, "utf8");
    assert.ok(diskRaw.startsWith("ENC:"));

    manager.disconnect("anthropic");
    assert.equal(manager.getPublicStatus("anthropic").connected, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("OAuthSubscriptionManager discovers live models from OpenAI Codex endpoint without hardcoded dummies", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "const-oauth-models-"));
  const storePath = path.join(tmpDir, "oauth.enc");
  const accessToken = makeJwt({
    "https://api.openai.com/auth": {
      chatgpt_account_id: "acct_live_1",
      chatgpt_plan_type: "plus",
    },
    "https://api.openai.com/profile": {
      email: "models@example.com",
    },
  });

  const requestedUrls: string[] = [];
  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requestedUrls.push(url);
    return new Response(
      JSON.stringify({
        models: [
          {
            slug: "gpt-5.4-codex-live",
            display_name: "GPT-5.4 Codex Live",
            visibility: "list",
            context_window: 272000,
            max_output_tokens: 128000,
            supported_reasoning_levels: [{ effort: "medium" }, { effort: "high" }],
            input_modalities: ["text", "image"],
          },
          {
            slug: "hidden-internal",
            display_name: "Hidden Model",
            visibility: "hidden",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    fs.writeFileSync(
      storePath,
      JSON.stringify({
        "openai-codex": {
          provider: "openai-codex",
          accessToken,
          refreshToken: "rt_1",
          expiresAt: Date.now() + 3600_000,
          accountId: "acct_live_1",
          email: "models@example.com",
          planType: "plus",
          connectedAt: Date.now(),
          updatedAt: Date.now(),
        },
      }),
    );

    const manager = new OAuthSubscriptionManager({ storePath, fetchImpl: mockFetch });
    // Before fetch, unconnected providers and unfetched cache have zero hardcoded dummy models
    const before = manager.listProviders();
    assert.equal(before.find((p) => p.id === "anthropic")?.models.length, 0);
    assert.equal(before.find((p) => p.id === "openai-codex")?.shortName, "OpenAI");

    const fetched = await manager.fetchModels("openai-codex");
    assert.equal(requestedUrls.length, 1);
    assert.ok(requestedUrls[0]!.includes("/codex/models?client_version=0.169.0"));
    assert.equal(fetched.length, 1);
    assert.equal(fetched[0]!.id, "gpt-5.4-codex-live");
    assert.equal(fetched[0]!.name, "GPT-5.4 Codex Live");
    assert.equal(fetched[0]!.contextWindow, "272K");

    // Second getModels hit uses encrypted on-disk discoveredModels cache without extra fetch
    const cached = await manager.getModels("openai-codex");
    assert.equal(cached.length, 1);
    assert.equal(requestedUrls.length, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("OAuthSubscriptionManager parses 5h and weekly rate limits from OpenAI wham/usage and response headers", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "const-oauth-quota-"));
  const storePath = path.join(tmpDir, "oauth.enc");
  const resetPrimarySec = Math.floor(Date.now() / 1000) + 7200;
  const resetWeeklySec = Math.floor(Date.now() / 1000) + 432000;

  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/wham/usage")) {
      return new Response(
        JSON.stringify({
          plan_type: "plus",
          rate_limit: {
            primary_window: { used_percent: 28, limit_window_seconds: 18000, reset_at: resetPrimarySec },
            secondary_window: { used_percent: 12, limit_window_seconds: 604800, reset_at: resetWeeklySec },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  };

  try {
    fs.writeFileSync(
      storePath,
      JSON.stringify({
        "openai-codex": {
          provider: "openai-codex",
          accessToken: "tok_live",
          expiresAt: Date.now() + 3600_000,
          accountId: "acct_1",
          connectedAt: Date.now(),
          updatedAt: Date.now(),
        },
        anthropic: {
          provider: "anthropic",
          accessToken: "ant_tok",
          expiresAt: Date.now() + 3600_000,
          connectedAt: Date.now(),
          updatedAt: Date.now(),
        },
      }),
    );

    const manager = new OAuthSubscriptionManager({ storePath, fetchImpl: mockFetch });
    const quota = await manager.getRateLimits("openai-codex");
    assert.ok(quota);
    assert.equal(quota.windows.length, 2);
    assert.equal(quota.windows[0]!.label, "5h Limit");
    assert.equal(quota.windows[0]!.usedPercent, 28);
    assert.equal(quota.windows[0]!.remainingPercent, 72);
    assert.equal(quota.windows[1]!.label, "Weekly");
    assert.equal(quota.windows[1]!.usedPercent, 12);
    assert.equal(quota.windows[1]!.remainingPercent, 88);

    // Passive Anthropic response header recording (unified 5h / 7d utilization)
    const antQuota = manager.recordRateLimitHeaders("anthropic", {
      "anthropic-ratelimit-unified-5h-utilization": "0.35",
      "anthropic-ratelimit-unified-5h-reset": String(resetPrimarySec),
      "anthropic-ratelimit-unified-7d-utilization": "0.14",
      "anthropic-ratelimit-unified-7d-reset": String(resetWeeklySec),
    });
    assert.ok(antQuota);
    assert.equal(antQuota.windows.length, 2);
    assert.equal(antQuota.windows[0]!.label, "5h Limit");
    assert.equal(antQuota.windows[0]!.usedPercent, 35);
    assert.equal(antQuota.windows[1]!.label, "Weekly");
    assert.equal(antQuota.windows[1]!.usedPercent, 14);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("parseBuiltinSlashCommand and filterBuiltinSlashCommands handle /plan, /goal, /btw, /compact", () => {
  assert.deepEqual(parseBuiltinSlashCommand("/plan redesign auth"), {
    id: "plan",
    args: "redesign auth",
    raw: "/plan redesign auth",
  });
  assert.deepEqual(parseBuiltinSlashCommand("/goal fix all tests"), {
    id: "goal",
    args: "fix all tests",
    raw: "/goal fix all tests",
  });
  assert.deepEqual(parseBuiltinSlashCommand("/btw what file owns OAuth?"), {
    id: "btw",
    args: "what file owns OAuth?",
    raw: "/btw what file owns OAuth?",
  });
  assert.deepEqual(parseBuiltinSlashCommand("/compact"), {
    id: "compact",
    args: "",
    raw: "/compact",
  });
  assert.equal(parseBuiltinSlashCommand("/unknown-skill foo"), null);
  assert.equal(parseBuiltinSlashCommand("normal message"), null);

  assert.equal(filterBuiltinSlashCommands("").length, 4);
  assert.deepEqual(
    filterBuiltinSlashCommands("pl").map((c) => c.id),
    ["plan"],
  );
  assert.deepEqual(
    filterBuiltinSlashCommands("btw").map((c) => c.id),
    ["btw"],
  );
});
