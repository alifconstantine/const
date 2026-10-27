import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createGoogleOAuthHandlers } from "../../../../accounts/src/lib/google-oauth";
import {
  GOOGLE_CONNECTORS,
  GOOGLE_IDENTITY_SCOPES,
} from "../../../shared/google-connectors";

const config = {
  origin: "https://accounts.example.test",
  clientId: "fixture-google-client",
  clientSecret: "fixture-google-secret",
};
const verifier = "a".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = "b".repeat(64);
function fixture() {
  let now = Date.now();
  let subject = "fixture-google-subject";
  let scopes = [...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_CONNECTORS.docs.scopes];
  let refreshes = 0;
  let calls = 0;
  const broker = createGoogleOAuthHandlers({
    config: () => config,
    now: () => now,
    fetch: async (input, init) => {
      calls++;
      assert.equal(init?.redirect, "error");
      if (
        String(input) === "https://openidconnect.googleapis.com/v1/userinfo"
      ) {
        assert.equal(
          new Headers(init?.headers).get("authorization"),
          "Bearer fixture-access",
        );
        return Response.json({
          sub: subject,
          email: "person@example.test",
          email_verified: true,
        });
      }
      assert.equal(String(input), "https://oauth2.googleapis.com/token");
      const params = init?.body as URLSearchParams;
      assert.equal(params.get("client_secret"), config.clientSecret);
      assert.equal(params.get("client_id"), config.clientId);
      const refresh = params.get("grant_type") === "refresh_token";
      if (refresh) refreshes++;
      else {
        assert.equal(params.get("code_verifier"), verifier);
        assert.equal(
          params.get("redirect_uri"),
          config.origin + "/oauth/google/callback",
        );
      }
      return Response.json({
        access_token: "fixture-access",
        token_type: "Bearer",
        expires_in: 3600,
        ...(!refresh
          ? { refresh_token: "fixture-refresh", scope: scopes.join(" ") }
          : {}),
      });
    },
  });
  const start = async (app = "docs", grant?: string) => {
    const url = new URL(config.origin + "/oauth/google/start");
    for (const [key, value] of Object.entries({
      app,
      state,
      code_challenge: challenge,
      language: "id",
      redirect_uri: "https://evil.example",
    }))
      url.searchParams.set(key, value);
    if (grant) url.searchParams.set("grant", grant);
    const response = await broker.handle(new Request(url));
    assert.equal(response.status, 303);
    const authorize = new URL(response.headers.get("location")!);
    assert.equal(authorize.origin, "https://accounts.google.com");
    assert.equal(authorize.pathname, "/o/oauth2/v2/auth");
    assert.equal(
      authorize.searchParams.get("redirect_uri"),
      config.origin + "/oauth/google/callback",
    );
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    assert.equal(authorize.searchParams.get("access_type"), "offline");
    assert.equal(authorize.searchParams.get("include_granted_scopes"), "true");
    assert.ok(!authorize.toString().includes(config.clientSecret));
    assert.match(
      response.headers.get("set-cookie")!,
      /HttpOnly; SameSite=Lax; Max-Age=600; Secure/,
    );
    return {
      ticket: authorize.searchParams.get("state")!,
      cookie: response.headers.get("set-cookie")!.split(";")[0]!,
      authorize,
    };
  };
  const post = (path: string, data: object, origin?: string) =>
    broker.handle(
      new Request(config.origin + "/oauth/google/" + path, {
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
    expire: () => (now += 601000),
    subject: (v: string) => (subject = v),
    scopes: (v: string[]) => (scopes = v),
    calls: () => calls,
    refreshes: () => refreshes,
  };
}
test("Google broker binds state, cookie and PKCE, requests only the chosen app, and preserves nonrotating refresh tokens", async () => {
  const f = fixture();
  const login = await f.start();
  assert.ok(!login.authorize.searchParams.get("scope")!.includes("gmail"));
  const callbackUrl =
    config.origin +
    "/oauth/google/callback?code=fixture-code&state=" +
    login.ticket;
  assert.equal((await f.broker.handle(new Request(callbackUrl))).status, 403);
  const callback = await f.broker.handle(
    new Request(callbackUrl, { headers: { Cookie: login.cookie } }),
  );
  assert.equal(callback.status, 303);
  const target = new URL(callback.headers.get("location")!);
  assert.equal(
    target.origin + target.pathname,
    "http://127.0.0.1:24139/oauth/callback",
  );
  assert.equal(target.searchParams.get("state"), state);
  assert.equal(target.searchParams.get("code"), "fixture-code");
  assert.match(callback.headers.get("set-cookie")!, /Max-Age=0/);
  assert.equal(
    (
      await f.post("exchange", {
        code: "fixture-code",
        ticket: login.ticket,
        verifier: "z".repeat(43),
      })
    ).status,
    403,
  );
  assert.equal(f.calls(), 0);
  const exchange = await f.post("exchange", {
    code: "fixture-code",
    ticket: login.ticket,
    verifier,
  });
  assert.equal(exchange.status, 200);
  const grant = await exchange.json();
  assert.equal(grant.email, "person@example.test");
  assert.ok(grant.grant && grant.subject);
  assert.equal(exchange.headers.get("cache-control"), "no-store");
  assert.ok(!JSON.stringify(grant).includes(config.clientSecret));
  const decodedReceipt = JSON.parse(
    Buffer.from(grant.grant.split(".")[0], "base64url").toString(),
  );
  assert.ok(!JSON.stringify(decodedReceipt).includes("fixture-refresh"));
  const refreshed = await f.post("refresh", {
    grant: grant.grant,
    refresh_token: grant.refresh_token,
  });
  assert.equal(refreshed.status, 200);
  const renewed = await refreshed.json();
  assert.equal(renewed.refresh_token, "fixture-refresh");
  assert.equal(renewed.scope, grant.scope);
  assert.equal(f.refreshes(), 1);
  assert.equal(
    (
      await f.post("refresh", {
        grant: renewed.grant,
        refresh_token: "someone-elses-token",
      })
    ).status,
    403,
  );
  assert.equal(f.refreshes(), 1);
  const incremental = await f.start("gmail", renewed.grant);
  assert.ok(
    incremental.authorize.searchParams.get("scope")!.includes("documents"),
  );
  assert.ok(
    incremental.authorize.searchParams.get("scope")!.includes("gmail.modify"),
  );
});
test("Google broker rejects missing app permissions and account switching, expired state, foreign origins and oversized bodies", async () => {
  const f = fixture();
  const login = await f.start();
  f.scopes(GOOGLE_IDENTITY_SCOPES);
  const partial = await f.post("exchange", {
    code: "fixture-code",
    ticket: login.ticket,
    verifier,
  });
  assert.equal(partial.status, 403);
  assert.deepEqual(await partial.json(), { error: "scope" });
  f.scopes([...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_CONNECTORS.docs.scopes]);
  const first = await (
    await f.post("exchange", {
      code: "fixture-code",
      ticket: login.ticket,
      verifier,
    })
  ).json();
  const second = await f.start("gmail", first.grant);
  f.scopes([...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_CONNECTORS.gmail.scopes]);
  f.subject("another-google-account");
  const switched = await f.post("exchange", {
    code: "fixture-code",
    ticket: second.ticket,
    verifier,
  });
  assert.equal(switched.status, 409);
  assert.deepEqual(await switched.json(), { error: "account" });
  const calls = f.calls();
  assert.equal(
    (await f.post("exchange", {}, "https://evil.example")).status,
    403,
  );
  assert.equal(
    (await f.post("exchange", { large: "x".repeat(33000) })).status,
    413,
  );
  f.expire();
  assert.equal(
    (
      await f.post("exchange", {
        code: "fixture-code",
        ticket: login.ticket,
        verifier,
      })
    ).status,
    403,
  );
  assert.equal(f.calls(), calls);
});
test("Google callback denial returns to fixed loopback and failures hide provider input; absent deployment config reports setup", async () => {
  const f = fixture();
  const login = await f.start();
  const callback = await f.broker.handle(
    new Request(
      config.origin +
        "/oauth/google/callback?error=private-provider-error&state=" +
        login.ticket,
      { headers: { Cookie: login.cookie } },
    ),
  );
  const target = new URL(callback.headers.get("location")!);
  assert.equal(target.searchParams.get("error"), "access_denied");
  const failure = await f.broker.handle(
    new Request(
      config.origin +
        "/oauth/google/callback?code=private-code&state=invalid&language=id",
    ),
  );
  const html = await failure.text();
  assert.match(html, /Koneksi Google/);
  assert.match(html, /history.replaceState/);
  assert.ok(!html.includes("private-code"));
  assert.match(
    failure.headers.get("content-security-policy")!,
    /frame-ancestors 'none'/,
  );
  const missing = createGoogleOAuthHandlers({
    config: () => ({ ...config, clientSecret: "" }),
  });
  const result = await missing.handle(
    new Request(config.origin + "/oauth/google/config"),
  );
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: "setup" });
});
