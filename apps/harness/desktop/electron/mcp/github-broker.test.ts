import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  createGitHubOAuthHandlers,
  DESKTOP_CALLBACK,
} from "../../../../accounts/src/lib/github-oauth";

const config = {
  origin: "https://accounts.example.test",
  clientId: "fixture-client",
  appId: "5490453",
  appSlug: "const-harness",
  clientSecret: "fixture-server-secret",
};
const verifier = "a".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = "b".repeat(64);
function fixture() {
  let now = Date.now();
  let calls = 0;
  let redeemed = false;
  const broker = createGitHubOAuthHandlers({
    config: () => config,
    now: () => now,
    fetch: async (input, init) => {
      calls++;
      assert.equal(
        String(input),
        "https://github.com/login/oauth/access_token",
      );
      assert.equal(init?.redirect, "error");
      const form = init!.body as URLSearchParams;
      assert.equal(form.get("client_secret"), config.clientSecret);
      assert.equal(form.get("client_id"), config.clientId);
      if (form.get("grant_type") !== "refresh_token") {
        assert.equal(
          form.get("redirect_uri"),
          config.origin + "/oauth/github/callback",
        );
        assert.equal(form.get("code_verifier"), verifier);
        if (redeemed)
          return Response.json(
            { error: "bad_verification_code" },
            { status: 400 },
          );
        redeemed = true;
      }
      return Response.json({
        access_token: "fixture-access",
        token_type: "bearer",
        expires_in: 28800,
        refresh_token: "fixture-refresh-" + calls,
        refresh_token_expires_in: 15897600,
      });
    },
  });
  const start = async () => {
    const response = await broker.handle(
      new Request(
        config.origin +
          "/oauth/github/start?state=" +
          state +
          "&code_challenge=" +
          challenge +
          "&language=id&redirect_uri=https://evil.example",
      ),
    );
    assert.equal(response.status, 303);
    const authorize = new URL(response.headers.get("location")!);
    assert.equal(authorize.origin, "https://github.com");
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    assert.equal(
      authorize.searchParams.get("redirect_uri"),
      config.origin + "/oauth/github/callback",
    );
    assert.ok(!authorize.toString().includes(config.clientSecret));
    const cookie = response.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    return {
      ticket: authorize.searchParams.get("state")!,
      cookie: cookie.split(";")[0]!,
    };
  };
  const post = (path: string, data: object, origin?: string) =>
    broker.handle(
      new Request(config.origin + "/oauth/github/" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify(data),
      }),
    );
  return {
    broker,
    start,
    post,
    calls: () => calls,
    expire: (duration = 11 * 60_000) => {
      now += duration;
    },
  };
}

test("GitHub callback binds browser cookie and signed state, then returns only a code to a fixed desktop callback", async () => {
  const f = fixture();
  const { ticket, cookie } = await f.start();
  const callback =
    config.origin + "/oauth/github/callback?code=fixture-code&state=" + ticket;
  assert.equal((await f.broker.handle(new Request(callback))).status, 403);
  assert.equal(
    (
      await f.broker.handle(
        new Request(callback + "x", { headers: { Cookie: cookie } }),
      )
    ).status,
    403,
  );
  const result = await f.broker.handle(
    new Request(callback, { headers: { Cookie: cookie } }),
  );
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("cache-control"), "no-store");
  const target = new URL(result.headers.get("location")!);
  assert.equal(target.origin + target.pathname, DESKTOP_CALLBACK);
  assert.equal(target.searchParams.get("state"), state);
  assert.equal(target.searchParams.get("code"), "fixture-code");
  assert.equal(target.searchParams.get("ticket"), ticket);
  assert.ok(
    !target.toString().includes("access_token") &&
      !target.toString().includes(config.clientSecret),
  );
  assert.match(result.headers.get("set-cookie")!, /Max-Age=0/);
});
test("GitHub exchange requires PKCE proof and same-origin browser requests; only upstream receives the secret", async () => {
  const f = fixture();
  const { ticket } = await f.start();
  const input = { code: "fixture-code", ticket, verifier };
  assert.equal(
    (await f.post("exchange", { ...input, verifier: "c".repeat(43) })).status,
    403,
  );
  assert.equal(
    (await f.post("exchange", input, "https://evil.example")).status,
    403,
  );
  assert.equal(f.calls(), 0);
  const response = await f.post("exchange", input);
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!text.includes(config.clientSecret));
  const data = JSON.parse(text);
  assert.equal(data.access_token, "fixture-access");
  assert.ok(data.grant);
  assert.equal((await f.post("exchange", input)).status, 401);
});
test("GitHub refresh grants are tied to the exact refresh token and expire", async () => {
  const f = fixture();
  const { ticket } = await f.start();
  const first = await (
    await f.post("exchange", { code: "fixture-code", ticket, verifier })
  ).json();
  assert.equal(
    (
      await f.post("refresh", {
        grant: first.grant,
        refresh_token: "other-token",
      })
    ).status,
    403,
  );
  assert.equal(f.calls(), 1);
  const next = await (
    await f.post("refresh", {
      grant: first.grant,
      refresh_token: first.refresh_token,
    })
  ).json();
  assert.notEqual(next.refresh_token, first.refresh_token);
  assert.notEqual(next.grant, first.grant);
  assert.equal(
    (
      await f.post("refresh", {
        grant: ticket,
        refresh_token: next.refresh_token,
      })
    ).status,
    403,
  );
  f.expire();
  assert.equal(
    (await f.post("exchange", { code: "another-code", ticket, verifier }))
      .status,
    403,
  );
});
test("denied consent returns an error to the pending desktop; unsolicited callbacks and missing setup fail closed", async () => {
  const f = fixture();
  const { ticket, cookie } = await f.start();
  const response = await f.broker.handle(
    new Request(
      config.origin +
        "/oauth/github/callback?error=access_denied&state=" +
        ticket,
      { headers: { Cookie: cookie } },
    ),
  );
  const target = new URL(response.headers.get("location")!);
  assert.equal(target.searchParams.get("error"), "access_denied");
  assert.equal(target.searchParams.get("state"), state);
  assert.equal(f.calls(), 0);
  const unsolicited = await f.broker.handle(
    new Request(config.origin + "/oauth/github/callback?code=untrusted"),
  );
  assert.equal(unsolicited.status, 200);
  assert.equal(unsolicited.headers.get("location"), null);
  assert.ok(!(await unsolicited.text()).includes("untrusted"));
  const missing = createGitHubOAuthHandlers({
    config: () => ({ ...config, clientSecret: "" }),
  });
  const setup = await missing.handle(
    new Request(config.origin + "/oauth/github/config"),
  );
  assert.equal(setup.status, 503);
  assert.deepEqual(await setup.json(), { error: "setup" });
});
