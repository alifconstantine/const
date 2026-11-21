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
    assert.equal(providers.length, 4);
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
