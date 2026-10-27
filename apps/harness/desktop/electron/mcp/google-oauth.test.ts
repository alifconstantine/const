import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPluginManifest } from "@const/agent";
import { McpStore } from "./store";
import { McpService } from "./service";
import { GoogleOAuthClient, managedGoogleApp } from "./google-oauth";
import {
  GOOGLE_CONNECTORS,
  GOOGLE_IDENTITY_SCOPES,
  GOOGLE_MCP_ORIGIN,
  googleMcpUrl,
  type GoogleApp,
} from "../../../shared/google-connectors";
import { createGoogleOAuthHandlers } from "../../../../accounts/src/lib/google-oauth";
import { createGoogleMcpHandler } from "../../../../accounts/src/lib/google-mcp";

test("seven managed Google plugins connect over real MCP, share scoped credentials and refresh, and disconnect independently", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "const-google-"));
  const store = new McpStore(home, {
    encrypt: (v) => Buffer.from(v).reverse(),
    decrypt: (v) => Buffer.from(v).reverse().toString(),
  });
  let origin = "";
  let generation = 0;
  let refreshes = 0;
  let browserVisits = 0;
  let scope = "";
  let accepted = "";
  let holdRefresh: (() => void) | undefined;
  let refreshStarted: (() => void) | undefined;
  let completion: Promise<Response> | undefined;
  const broker = createGoogleOAuthHandlers({
    config: () => ({
      origin,
      clientId: "fixture-google-client",
      clientSecret: "fixture-secret",
    }),
    fetch: async (input, init) => {
      if (String(input).includes("userinfo"))
        return Response.json({
          sub: "one-stable-account",
          email: "fixture@example.test",
          email_verified: true,
        });
      assert.equal(String(input), "https://oauth2.googleapis.com/token");
      const form = init?.body as URLSearchParams;
      const refresh = form.get("grant_type") === "refresh_token";
      if (refresh) {
        refreshes++;
        refreshStarted?.();
        if (refreshStarted)
          await new Promise<void>((resolve) => (holdRefresh = resolve));
        else await new Promise((resolve) => setTimeout(resolve, 25));
      }
      accepted = "fixture-access-" + ++generation;
      return Response.json({
        access_token: accepted,
        token_type: "Bearer",
        expires_in: 3600,
        ...(!refresh ? { refresh_token: "fixture-refresh", scope } : {}),
      });
    },
  });
  const mcp = createGoogleMcpHandler({
    fetch: async (input, init) => {
      if (String(input).includes("userinfo"))
        return Response.json({ sub: "one-stable-account" });
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer " + accepted,
      );
      assert.ok(new URL(String(input)).hostname.endsWith("googleapis.com"));
      return Response.json({ fixture: true, resource: String(input) });
    },
  });
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    const url = new URL(req.url!, origin);
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      ...(body ? { body } : {}),
    });
    const result = url.pathname.startsWith("/oauth/")
      ? await broker.handle(request)
      : req.headers.authorization !== "Bearer " + accepted
        ? new Response(null, { status: 401 })
        : await mcp(request, url.pathname.split("/").at(-1)!);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin =
    "http://127.0.0.1:" +
    (server.address() as import("node:net").AddressInfo).port;
  const google = new GoogleOAuthClient(store, {
    origin,
    fetch: (input, init) =>
      fetch(
        String(input).startsWith(GOOGLE_MCP_ORIGIN + "/mcp/")
          ? String(input).replace(GOOGLE_MCP_ORIGIN, origin)
          : input,
        init,
      ),
  });
  const plugins = (Object.keys(GOOGLE_CONNECTORS) as GoogleApp[]).map((app) => {
    const root = fileURLToPath(
      new URL(
        `../../plugins/${GOOGLE_CONNECTORS[app].plugin}/`,
        import.meta.url,
      ),
    );
    const manifest = readPluginManifest(root);
    assert.equal(manifest.entrypoint, undefined);
    assert.equal(manifest.defaultInstalled, undefined);
    assert.equal(manifest.mcpServers?.[app]?.url, googleMcpUrl(app));
    return {
      ...manifest,
      id: manifest.name,
      path: root,
      skills: [],
      scope: "user" as const,
      isEffective: true,
      isEnabled: true,
    };
  });
  const service = new McpService(
    store,
    () => {},
    async (address) => {
      browserVisits++;
      const start = await fetch(address, { redirect: "manual" });
      assert.equal(start.status, 303);
      const authorize = new URL(start.headers.get("location")!);
      scope = authorize.searchParams.get("scope")!;
      const callback = new URL(origin + "/oauth/google/callback");
      callback.searchParams.set("state", authorize.searchParams.get("state")!);
      callback.searchParams.set("code", "fixture-code");
      const response = await fetch(callback, {
        headers: { Cookie: start.headers.get("set-cookie")!.split(";")[0]! },
        redirect: "manual",
      });
      assert.equal(response.status, 303);
      completion = fetch(response.headers.get("location")!);
    },
    () => plugins,
    undefined,
    google,
  );
  try {
    const records = service.list();
    assert.equal(records.length, 7);
    for (const record of records) {
      assert.equal(record.managedOAuth, "google");
      assert.equal(record.oauthClientRequired, false);
      await service.authenticate(record.id);
      const response = await completion!;
      assert.equal(response.status, 200);
      assert.match(await response.text(), /window.close/);
    }
    assert.equal(browserVisits, 7);
    const connected = service.list();
    assert.ok(
      connected.every(
        (r) =>
          r.status === "connected" &&
          r.hasCredentials &&
          r.accountEmail === "fixture@example.test" &&
          r.tools.length >= 3 &&
          r.lastConnectedAt,
      ),
    );
    const accountId = google.accountId(records[0]!);
    assert.ok(records.every((r) => google.accountId(r) === accountId));
    assert.ok(
      records.every(
        (r) =>
          !store.secrets(r.id).tokens &&
          store.secrets(r.id).googleAccountId === accountId,
      ),
    );
    const persisted = fs.readFileSync(path.join(home, "mcp.json"), "utf8");
    assert.ok(
      !persisted.includes("fixture-access") &&
        !persisted.includes("fixture-refresh") &&
        !persisted.includes("fixture@example.test"),
    );
    await service.authenticate(records[0]!.id);
    assert.equal(
      browserVisits,
      7,
      "already-granted apps reuse the shared account",
    );
    const definitions = await service.tools();
    assert.ok(definitions.length >= 40);
    assert.ok(definitions.every((t) => t.requiresApproval));
    const account = store.secrets(accountId);
    store.writeSecrets(accountId, {
      ...account,
      googleOAuth: { ...account.googleOAuth!, expiresAt: 0 },
    });
    const result = await Promise.all(
      definitions
        .filter(
          (t) =>
            t.function.name.endsWith("get_document") ||
            t.function.name.endsWith("get_presentation") ||
            t.function.name.endsWith("list_courses"),
        )
        .map((t) =>
          service.execute(
            t.function.name,
            t.function.name.endsWith("get_document")
              ? { documentId: "doc-1" }
              : t.function.name.endsWith("get_presentation")
                ? { presentationId: "deck-1" }
                : {},
          ),
        ),
    );
    assert.equal(refreshes, 1);
    assert.ok(result.every((r) => JSON.stringify(r).includes("fixture")));
    accepted = "force-server-401";
    const docsTool = definitions.find((t) =>
      t.function.name.endsWith("get_document"),
    )!;
    await service.execute(docsTool.function.name, { documentId: "doc-1" });
    assert.equal(refreshes, 2, "401 retries once through managed refresh");
    const first = records[0]!;
    const workspace = path.join(home, "project");
    fs.mkdirSync(workspace);
    const isolated = store.save({
      ...first,
      id: undefined,
      scope: "workspace",
      workspacePath: workspace,
    });
    assert.notEqual(google.accountId(isolated), accountId);
    assert.equal(google.reuse(isolated), false);
    assert.equal(google.credentials(isolated), undefined);
    await assert.rejects(
      google.fetch(
        { ...first, url: "https://evil.example/mcp" },
        "https://evil.example/mcp",
      ),
      /invalid/,
    );
    await service.disconnectAccount(first.id);
    assert.ok(store.secrets(accountId).tokens);
    assert.equal(store.secrets(first.id).googleAccountId, undefined);
    for (const record of records.slice(1, -1))
      await service.disconnectAccount(record.id);
    const last = records.at(-1)!;
    const before = store.secrets(accountId);
    store.writeSecrets(accountId, {
      ...before,
      googleOAuth: { ...before.googleOAuth!, expiresAt: 0 },
    });
    const started = new Promise<void>((resolve) => (refreshStarted = resolve));
    const inFlight = google.fetch(last, googleMcpUrl(managedGoogleApp(last)!));
    await started;
    await service.disconnectAccount(last.id);
    assert.deepEqual(store.secrets(accountId), {});
    holdRefresh!();
    await assert.rejects(inFlight, /auth/);
    assert.deepEqual(
      store.secrets(accountId),
      {},
      "late refresh cannot recreate a disconnected account",
    );
  } finally {
    holdRefresh?.();
    await service.invalidate();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("adding Google permissions tolerates a concurrent refresh of the same account", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "const-google-race-"));
  const store = new McpStore(home, {
    encrypt: (v) => Buffer.from(v),
    decrypt: (v) => v.toString(),
  });
  const record = store.save({
    name: "Google Docs",
    key: "plugin-google-docs-docs",
    scope: "user",
    transport: "http",
    auth: "oauth",
    url: googleMcpUrl("docs"),
  });
  const scopes = [
    ...GOOGLE_IDENTITY_SCOPES,
    ...GOOGLE_CONNECTORS.docs.scopes,
  ].sort();
  const subject = "a".repeat(43);
  let finish!: (value: Response) => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => (started = resolve));
  const google = new GoogleOAuthClient(store, {
    fetch: async () => {
      started();
      return new Promise<Response>((resolve) => (finish = resolve));
    },
  });
  const key = google.accountId(record);
  const account = {
    tokens: {
      access_token: "before-refresh",
      token_type: "Bearer",
      refresh_token: "stable-refresh",
    },
    googleOAuth: {
      grant: "old-receipt",
      expiresAt: Date.now() + 3600000,
      subject,
      scopes,
    },
  };
  store.writeSecrets(key, account);
  store.writeSecrets(record.id, { googleAccountId: key });
  try {
    const exchange = google.exchange(
      record,
      "code",
      "ticket",
      "verifier",
      new AbortController().signal,
    );
    await pending;
    store.writeSecrets(key, {
      ...account,
      tokens: { ...account.tokens, access_token: "refreshed-access" },
      googleOAuth: { ...account.googleOAuth, grant: "refresh-receipt" },
    });
    finish(
      Response.json({
        access_token: "expanded-access",
        refresh_token: "new-refresh",
        token_type: "Bearer",
        expires_in: 3600,
        subject,
        grant: "expanded-receipt",
        scope: [...scopes, ...GOOGLE_CONNECTORS.gmail.scopes].join(" "),
      }),
    );
    await exchange;
    assert.equal(store.secrets(key).tokens?.access_token, "expanded-access");
    assert.ok(
      store
        .secrets(key)
        .googleOAuth?.scopes.includes(GOOGLE_CONNECTORS.gmail.scopes[0]),
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("Connect account opens Google consent on the same click when saved credentials were revoked", async () => {
  const home = fs.mkdtempSync(
    path.join(os.tmpdir(), "const-google-reconnect-"),
  );
  const store = new McpStore(home, {
    encrypt: (v) => Buffer.from(v),
    decrypt: (v) => v.toString(),
  });
  const root = fileURLToPath(
    new URL("../../plugins/google-docs/", import.meta.url),
  );
  const plugin = {
    ...readPluginManifest(root),
    id: "google-docs",
    path: root,
    scope: "user" as const,
    isEnabled: true,
    isEffective: true,
    skills: [],
  };
  const scopes = [
    ...GOOGLE_IDENTITY_SCOPES,
    ...GOOGLE_CONNECTORS.docs.scopes,
  ].sort();
  const subject = "a".repeat(43);
  let visits = 0;
  let refreshes = 0;
  let completion: Promise<Response> | undefined;
  const adapter = createGoogleMcpHandler({
    fetch: async () => Response.json({ sub: "fixture-user" }),
  });
  const google = new GoogleOAuthClient(store, {
    fetch: async (input, init) => {
      const address = String(input);
      if (address.endsWith("/oauth/google/config"))
        return Response.json({ configured: true });
      if (address.endsWith("/oauth/google/refresh")) {
        refreshes++;
        return Response.json({ error: "auth" }, { status: 401 });
      }
      if (address.endsWith("/oauth/google/exchange"))
        return Response.json({
          access_token: "fresh-access",
          refresh_token: "fresh-refresh",
          token_type: "Bearer",
          expires_in: 3600,
          subject,
          grant: "new-receipt",
          scope: scopes.join(" "),
        });
      assert.equal(address, googleMcpUrl("docs"));
      if (
        new Headers(init?.headers).get("authorization") !==
        "Bearer fresh-access"
      )
        return new Response(null, { status: 401 });
      return adapter(new Request(address, init), "docs");
    },
  });
  const service = new McpService(
    store,
    () => {},
    async (address) => {
      visits++;
      const url = new URL(address);
      const callback = new URL("http://127.0.0.1:24139/oauth/callback");
      callback.searchParams.set("state", url.searchParams.get("state")!);
      callback.searchParams.set("code", "fixture-code");
      callback.searchParams.set("ticket", "fixture-ticket");
      completion = fetch(callback);
    },
    () => [plugin],
    undefined,
    google,
  );
  try {
    const record = service.list()[0]!;
    const key = google.accountId(record);
    store.writeSecrets(key, {
      tokens: {
        access_token: "revoked-access",
        token_type: "Bearer",
        refresh_token: "revoked-refresh",
      },
      googleOAuth: {
        grant: "old-receipt",
        subject,
        expiresAt: Date.now() + 3600000,
        scopes,
      },
    });
    store.writeSecrets(record.id, { googleAccountId: key });
    await service.authenticate(record.id);
    assert.equal((await completion!).status, 200);
    assert.equal(visits, 1);
    assert.equal(refreshes, 1);
    assert.equal(service.list()[0]!.status, "connected");
    assert.equal(store.secrets(key).tokens?.access_token, "fresh-access");
  } finally {
    await service.invalidate();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
