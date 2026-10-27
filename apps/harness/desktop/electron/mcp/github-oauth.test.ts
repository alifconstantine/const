import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpStore } from "./store";
import { McpService } from "./service";
import { GitHubOAuthClient, GITHUB_MCP_URL } from "./github-oauth";
import { readPluginManifest } from "@const/agent";
import { createGitHubOAuthHandlers } from "../../../../accounts/src/lib/github-oauth";

test("managed GitHub OAuth connects through the hosted callback, refreshes once across parallel calls, and clears account secrets", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "const-github-"));
  // Test codec only. Production uses Electron safeStorage.
  const store = new McpStore(home, {
    encrypt: (value) => Buffer.from(value).reverse(),
    decrypt: (value) => Buffer.from(value).reverse().toString(),
  });
  let origin = "";
  let generation = 0;
  let refreshes = 0;
  let accepted = "";
  let rejectMcp = false;
  let completion: Promise<Response> | undefined;
  const broker = createGitHubOAuthHandlers({
    config: () => ({
      origin,
      clientId: "fixture-client",
      appId: "5490453",
      appSlug: "const-harness",
      clientSecret: "fixture-server-secret",
    }),
    fetch: async (_input, init) => {
      const params = init!.body as URLSearchParams;
      assert.equal(params.get("client_secret"), "fixture-server-secret");
      if (params.get("grant_type") === "refresh_token") {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      accepted = "fixture-access-" + ++generation;
      return Response.json({
        access_token: accepted,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "fixture-refresh-" + generation,
      });
    },
  });
  const server = http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    const url = new URL(request.url!, origin);
    if (url.pathname.startsWith("/oauth/github/")) {
      const result = await broker.handle(
        new Request(url, {
          method: request.method,
          headers: request.headers as Record<string, string>,
          ...(body ? { body } : {}),
        }),
      );
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
      return;
    }
    if (rejectMcp || request.headers.authorization !== "Bearer " + accepted) {
      response.writeHead(401).end();
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    const message = JSON.parse(body);
    if (message.id === undefined) {
      response.writeHead(202).end();
      return;
    }
    const result =
      message.method === "initialize"
        ? {
            protocolVersion: message.params.protocolVersion,
            capabilities: { tools: {} },
            serverInfo: { name: "fixture", version: "1.0.0" },
          }
        : message.method === "tools/list"
          ? {
              tools: [
                {
                  name: "search_repositories",
                  inputSchema: { type: "object" },
                },
              ],
            }
          : { content: [{ type: "text", text: "repository result" }] };
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin =
    "http://127.0.0.1:" +
    (server.address() as import("node:net").AddressInfo).port;
  const github = new GitHubOAuthClient(store, {
    origin,
    fetch: (input, init) =>
      fetch(
        String(input).startsWith(GITHUB_MCP_URL) ? origin + "/mcp" : input,
        init,
      ),
  });
  const root = fileURLToPath(new URL("../../plugins/github/", import.meta.url));
  const plugin = {
    ...readPluginManifest(root),
    id: "github",
    path: root,
    scope: "user" as const,
    isEffective: true,
    isEnabled: true,
    skills: [],
  };
  const service = new McpService(
    store,
    () => {},
    async (value) => {
      const start = await fetch(value, { redirect: "manual" });
      const authorize = new URL(start.headers.get("location")!);
      assert.ok(!value.includes("fixture-server-secret"));
      const callback = new URL(origin + "/oauth/github/callback");
      callback.searchParams.set("state", authorize.searchParams.get("state")!);
      callback.searchParams.set("code", "fixture-code");
      const redirect = await fetch(callback, {
        redirect: "manual",
        headers: { Cookie: start.headers.get("set-cookie")!.split(";")[0]! },
      });
      assert.equal(redirect.status, 303);
      completion = fetch(redirect.headers.get("location")!);
      void completion.catch(() => {});
    },
    () => [plugin],
    github,
  );
  try {
    const record = service.list()[0]!;
    assert.equal(record.auth, "oauth");
    assert.equal(record.managedOAuth, "github");
    await service.authenticate(record.id, undefined, "id");
    assert.match(await (await completion!).text(), /Akun berhasil terhubung/);
    assert.equal(service.list()[0]!.status, "connected");
    assert.ok(!JSON.stringify(service.list()).includes("fixture-access"));
    const definitions = await service.tools();
    assert.equal(definitions.length, 1);
    store.writeSecrets(record.id, {
      ...store.secrets(record.id),
      githubOAuth: {
        ...store.secrets(record.id).githubOAuth,
        expiresAt: Date.now() - 1,
      },
    });
    const results = await Promise.all([
      service.execute(definitions[0]!.function.name, {}),
      service.execute(definitions[0]!.function.name, {}),
    ]);
    assert.ok(results.every((result) => !result.isError));
    assert.equal(refreshes, 1);
    assert.equal(
      store.secrets(record.id).tokens!.access_token,
      "fixture-access-2",
    );
    accepted = "expired-at-provider";
    assert.equal(
      (await service.execute(definitions[0]!.function.name, {})).isError,
      false,
    );
    assert.equal(refreshes, 2);
    rejectMcp = true;
    assert.equal(
      (await service.execute(definitions[0]!.function.name, {})).isError,
      true,
    );
    assert.equal(service.list()[0]!.status, "needs_auth");
    assert.equal(service.list()[0]!.tools.length, 0);
    const failedRefreshes = refreshes;
    assert.deepEqual(await service.tools(), []);
    assert.equal(
      refreshes,
      failedRefreshes,
      "revoked account waits for user reconnection",
    );
    await service.disconnectAccount(record.id);
    assert.equal(store.secrets(record.id).tokens, undefined);
    assert.equal(store.secrets(record.id).githubOAuth, undefined);
    assert.equal(service.list()[0]!.status, "disabled");
  } finally {
    await service.invalidate();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("managed GitHub reports server setup without opening the browser or exposing tokens", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "const-github-setup-"));
  const store = new McpStore(home, {
    encrypt: (value) => Buffer.from(value),
    decrypt: (value) => value.toString(),
  });
  const root = fileURLToPath(new URL("../../plugins/github/", import.meta.url));
  const plugin = {
    ...readPluginManifest(root),
    id: "github",
    path: root,
    scope: "user" as const,
    isEffective: true,
    isEnabled: true,
    skills: [],
  };
  let opened = false;
  const client = new GitHubOAuthClient(store, {
    fetch: async () => Response.json({ error: "setup" }, { status: 503 }),
  });
  const service = new McpService(
    store,
    () => {},
    async () => {
      opened = true;
    },
    () => [plugin],
    client,
  );
  try {
    const record = service.list()[0]!;
    await assert.rejects(service.authenticate(record.id), /setup/);
    assert.equal(opened, false);
    assert.equal(store.secrets(record.id).tokens, undefined);
    assert.equal(service.list()[0]!.error, "setup");
  } finally {
    await service.invalidate();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("a late refresh cannot restore a disconnected account or send tokens to another host", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "const-github-late-"));
  const store = new McpStore(home, {
    encrypt: (value) => Buffer.from(value),
    decrypt: (value) => value.toString(),
  });
  const record = store.save({
    key: "plugin-github-github",
    name: "GitHub",
    scope: "user",
    transport: "http",
    url: GITHUB_MCP_URL,
    auth: "oauth",
  });
  store.writeSecrets(record.id, {
    tokens: {
      access_token: "old-access",
      token_type: "Bearer",
      refresh_token: "old-refresh",
    },
    githubOAuth: { grant: "fixture-grant", expiresAt: Date.now() - 1 },
  });
  let started!: () => void;
  const opened = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finish!: (response: Response) => void;
  let requests = 0;
  const client = new GitHubOAuthClient(store, {
    fetch: async () => {
      requests++;
      started();
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    },
  });
  try {
    await assert.rejects(
      client.fetch(record, "https://evil.example/mcp/"),
      /invalid/,
    );
    assert.equal(requests, 0);
    const controller = new AbortController();
    const pending = client.fetch(record, GITHUB_MCP_URL, {
      signal: controller.signal,
    });
    const rejected = assert.rejects(pending, /auth/);
    await opened;
    controller.abort();
    store.clearSecrets(record.id);
    store.save({ ...record, enabled: false });
    finish(
      Response.json({
        access_token: "late-access",
        token_type: "Bearer",
        refresh_token: "late-refresh",
        grant: "late-grant",
        expires_in: 3600,
      }),
    );
    await rejected;
    assert.equal(store.secrets(record.id).tokens, undefined);
    assert.equal(requests, 1);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
