import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { readPluginManifest } from "@const/agent";
import { fileURLToPath } from "node:url";
import { McpStore } from "./store";
import { McpService, exposedToolName } from "./service";
import { initializeDefaultPlugins } from "./default-plugins";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "const-mcp-"));
  const key = randomBytes(32);
  const store = new McpStore(path.join(root, "user"), {
    encrypt: (value) => {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    decrypt: (value) => {
      const cipher = createDecipheriv(
        "aes-256-gcm",
        key,
        value.subarray(0, 12),
      );
      cipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([
        cipher.update(value.subarray(28)),
        cipher.final(),
      ]).toString("utf8");
    },
  });
  const service = new McpService(
    store,
    () => {},
    async () => {},
    () => [],
  );
  return {
    root,
    store,
    service,
    cleanup: async () => {
      await service.invalidate();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
test("default initialization preserves uninstalls and does not reinstall opt-in plugins", async () => {
  const f = fixture();
  try {
    const catalog = [
      { name: "const-guide", defaultInstalled: true },
      { name: "browser-use", defaultInstalled: true },
      { name: "context7" },
    ];
    const installed: string[] = [];
    initializeDefaultPlugins(f.store.home, catalog, [], (name) =>
      installed.push(name),
    );
    assert.deepEqual(installed, ["const-guide", "browser-use"]);
    installed.length = 0;
    initializeDefaultPlugins(f.store.home, catalog, [], (name) =>
      installed.push(name),
    );
    assert.equal(installed.length, 0);
    initializeDefaultPlugins(
      f.store.home,
      [...catalog, { name: "skills-creator", defaultInstalled: true }],
      [],
      (name) => installed.push(name),
    );
    assert.deepEqual(installed, ["skills-creator"]);
  } finally {
    await f.cleanup();
  }
});
test("public configuration and list responses never contain credential values", async () => {
  const f = fixture();
  try {
    const record = f.store.save({
      name: "Private",
      scope: "user",
      transport: "http",
      url: "https://example.com/mcp",
      auth: "api-key",
      apiKey: "secret-token",
      headers: { "X-Private": "header-secret" },
      env: { PRIVATE: "env-secret" },
    });
    const publicText =
      fs.readFileSync(path.join(f.store.home, "mcp.json"), "utf8") +
      JSON.stringify(f.service.list());
    const vault = fs.readFileSync(
      path.join(f.store.home, "mcp-secrets.json"),
      "utf8",
    );
    for (const secret of ["secret-token", "header-secret", "env-secret"]) {
      assert.ok(!publicText.includes(secret));
      assert.ok(!vault.includes(secret));
    }
    assert.equal(f.store.secrets(record.id).apiKey, "secret-token");
    f.store.save({ ...record, name: "Renamed" });
    assert.equal(f.store.secrets(record.id).apiKey, "secret-token");
    f.store.save({ ...record, url: "https://other.example/mcp" });
    assert.equal(f.store.secrets(record.id).apiKey, undefined);
  } finally {
    await f.cleanup();
  }
});
test("OAuth refuses unavailable secure storage before contacting a provider", async () => {
  const f = fixture();
  try {
    const store = new McpStore(f.store.home, {
      encrypt: () => {
        throw new Error("storage");
      },
      decrypt: () => {
        throw new Error("storage");
      },
    });
    let opened = false;
    const service = new McpService(
      store,
      () => {},
      async () => {
        opened = true;
      },
      () => [],
    );
    const record = store.save({
      name: "No vault",
      scope: "user",
      transport: "http",
      url: "https://example.com/mcp",
      auth: "oauth",
    });
    await assert.rejects(service.authenticate(record.id), /storage/);
    assert.equal(opened, false);
  } finally {
    await f.cleanup();
  }
});
test("workspace disablement overrides global availability and never copies the global account", async () => {
  const f = fixture();
  try {
    const workspace = path.join(f.root, "workspace");
    const global = f.store.save({
      key: "docs",
      name: "Docs",
      scope: "user",
      transport: "http",
      url: "https://example.com/mcp",
      auth: "api-key",
      apiKey: "global-only",
    });
    await f.service.override(global.id, workspace);
    const records = f.service.list(workspace);
    assert.equal(records.length, 2);
    assert.equal(records[0]!.isEffective, true);
    assert.equal(records[1]!.isEffective, false);
    assert.equal(records[0]!.hasCredentials, false);
    f.store.save({ ...records[0]!, enabled: false });
    assert.equal(f.service.list(workspace)[0]!.status, "disabled");
    assert.deepEqual(await f.service.tools(workspace), []);
    await f.service.remove(records[0]!.id, workspace);
    assert.equal(f.service.list(workspace)[0]!.id, global.id);
  } finally {
    await f.cleanup();
  }
});
test("repository edits invalidate trust and cannot redirect stored credentials", async () => {
  const f = fixture();
  try {
    const workspace = path.join(f.root, "workspace");
    const record = f.store.save({
      name: "Docs",
      scope: "workspace",
      workspacePath: workspace,
      transport: "http",
      url: "https://example.com/mcp",
      auth: "api-key",
      apiKey: "stay-private",
    });
    const file = path.join(workspace, ".const", "mcp.json");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    data.connections[0].url = "https://other.example/mcp";
    fs.writeFileSync(file, JSON.stringify(data));
    const modified = f.store.get(record.id, workspace);
    assert.equal(f.store.isTrusted(modified), false);
    await assert.rejects(f.service.connect(record.id, workspace), /invalid/);
    assert.deepEqual(await f.service.tools(workspace), []);
    f.store.save(modified);
    assert.equal(f.store.secrets(record.id).apiKey, undefined);
  } finally {
    await f.cleanup();
  }
});
test("rejects malformed configurations and insecure remote credential transport", async () => {
  const f = fixture();
  try {
    const base = {
      name: "Test",
      scope: "user" as const,
      transport: "http" as const,
      auth: "none" as const,
    };
    for (const url of [
      "http://remote.example/mcp",
      "file:///tmp/mcp",
      "https://user:password@example.com/mcp",
    ])
      assert.throws(() => f.store.save({ ...base, url }));
    assert.throws(() =>
      f.store.save({
        ...base,
        scope: "workspace",
        workspacePath: "relative",
        url: "https://example.com/mcp",
      }),
    );
    assert.throws(() =>
      f.store.save({
        ...base,
        transport: "stdio",
        command: "node",
        auth: "oauth",
      }),
    );
  } finally {
    await f.cleanup();
  }
});

async function testServer(oauth = false, failExchange = false) {
  let origin = "";
  let challenge = "";
  let authorized = false;
  let completion: Promise<string> | undefined;
  const methods: string[] = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", origin);
    const buffers: Buffer[] = [];
    for await (const chunk of request) buffers.push(Buffer.from(chunk));
    const body = Buffer.concat(buffers).toString();
    const json = (value: unknown, status = 200) => {
      response
        .writeHead(status, { "Content-Type": "application/json" })
        .end(JSON.stringify(value));
    };
    if (url.pathname === "/.well-known/oauth-protected-resource")
      return json({
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
      });
    if (url.pathname === "/.well-known/oauth-authorization-server")
      return json({
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        registration_endpoint: `${origin}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      });
    if (url.pathname === "/register")
      return json({ ...JSON.parse(body), client_id: "fixture-client" }, 201);
    if (url.pathname === "/token") {
      if (failExchange) return json({ error: "invalid_grant" }, 400);
      const params = new URLSearchParams(body);
      assert.equal(
        createHash("sha256")
          .update(params.get("code_verifier")!)
          .digest("base64url"),
        challenge,
      );
      authorized = true;
      return json({
        access_token: "fixture-token",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "fixture-refresh",
      });
    }
    if (oauth && request.headers.authorization !== "Bearer fixture-token") {
      response
        .writeHead(401, {
          "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
        })
        .end();
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    const message = JSON.parse(body);
    methods.push(message.method);
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
                  name: "query-docs",
                  description: "Fixture echo",
                  inputSchema: {
                    type: "object",
                    properties: { query: { type: "string" } },
                    required: ["query"],
                  },
                  annotations: { readOnlyHint: true },
                },
              ],
            }
          : {
              content: [{ type: "text", text: message.params.arguments.query }],
            };
    json({ jsonrpc: "2.0", id: message.id, result });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
  return {
    url: `${origin}/mcp`,
    methods,
    authorized: () => authorized,
    completion: () => completion!,
    browser: async (value: string) => {
      const auth = new URL(value);
      challenge = auth.searchParams.get("code_challenge")!;
      const callback = new URL(auth.searchParams.get("redirect_uri")!);
      const wrong = new URL(callback);
      wrong.searchParams.set("state", "wrong");
      wrong.searchParams.set("code", "fixture-code");
      assert.equal((await fetch(wrong)).status, 400);
      callback.searchParams.set("state", auth.searchParams.get("state")!);
      callback.searchParams.set("code", "fixture-code");
      completion = fetch(callback).then(async (response) => {
        assert.equal(response.status, failExchange ? 400 : 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        return response.text();
      });
      void completion.catch(() => {});
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
test("real SDK initializes, discovers tools, routes calls, and rejects disabled connections", async () => {
  const f = fixture();
  const server = await testServer();
  try {
    const connection = f.store.save({
      name: "Fixture",
      scope: "user",
      transport: "http",
      url: server.url,
      auth: "none",
    });
    const definitions = await f.service.tools();
    const at = f.service.list()[0]!.lastConnectedAt;
    assert.ok(at && Number.isFinite(Date.parse(at)));
    assert.equal(f.store.lastConnectedAt(connection), at);
    assert.equal(definitions.length, 1);
    assert.equal(definitions[0]!.requiresApproval, true);
    assert.equal(
      definitions[0]!.function.name,
      exposedToolName(connection.id, "query-docs"),
    );
    const result = await f.service.execute(definitions[0]!.function.name, {
      query: "real echo",
    });
    assert.equal(result.isError, false);
    assert.match(result.result, /real echo/);
    assert.ok(server.methods.includes("tools/call"));
    f.store.save({ ...connection, enabled: false });
    assert.equal(
      (
        await f.service.execute(definitions[0]!.function.name, {
          query: "blocked",
        })
      ).isError,
      true,
    );
  } finally {
    await f.cleanup();
    await server.close();
  }
});
test("OAuth discovery, dynamic registration, state validation, and PKCE exchange work end to end", async () => {
  const f = fixture();
  const server = await testServer(true);
  const service = new McpService(
    f.store,
    () => {},
    server.browser,
    () => [],
  );
  try {
    const record = f.store.save({
      name: "OAuth fixture",
      scope: "user",
      transport: "http",
      url: server.url,
      auth: "oauth",
    });
    await service.authenticate(record.id, undefined, "id");
    const page = await server.completion();
    assert.match(page, /Akun berhasil terhubung/);
    assert.match(page, /history.replaceState/);
    assert.match(page, /window.close/);
    assert.ok(
      !page.includes("fixture-code") && !page.includes("fixture-token"),
    );
    assert.equal(server.authorized(), true);
    assert.equal(service.list()[0]!.status, "connected");
    assert.equal(
      f.store.secrets(record.id).tokens?.access_token,
      "fixture-token",
    );
    assert.ok(!JSON.stringify(service.list()).includes("fixture-token"));
    await service.disconnectAccount(record.id);
    assert.equal(service.list()[0]!.status, "disabled");
    assert.equal(f.store.secrets(record.id).tokens, undefined);
    assert.deepEqual(await service.tools(), []);
  } finally {
    await service.invalidate();
    await f.cleanup();
    await server.close();
  }
});
test("cancelling OAuth closes the loopback flow and never saves a token", async () => {
  const f = fixture();
  const server = await testServer(true);
  let redirected!: () => void;
  const opened = new Promise<void>((resolve) => {
    redirected = resolve;
  });
  const service = new McpService(
    f.store,
    () => {},
    async () => {
      redirected();
    },
    () => [],
  );
  try {
    const record = f.store.save({
      name: "Cancelled OAuth",
      scope: "user",
      transport: "http",
      url: server.url,
      auth: "oauth",
    });
    const operation = service.authenticate(record.id);
    const rejected = assert.rejects(operation, /auth/);
    await opened;
    await service.invalidate();
    await rejected;
    assert.equal(f.store.secrets(record.id).tokens, undefined);
  } finally {
    await service.invalidate();
    await f.cleanup();
    await server.close();
  }
});
test("stdio connects to a local child process and discovers its tools", async () => {
  const f = fixture();
  const script = `const rl=require('node:readline').createInterface({input:process.stdin});rl.on('line',line=>{const m=JSON.parse(line);if(m.id===undefined)return;const result=m.method==='initialize'?{protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'local',version:'1.0.0'}}:m.method==='tools/list'?{tools:[{name:'echo',inputSchema:{type:'object'}}]}:{content:[{type:'text',text:'local result'}]};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n')});`;
  try {
    f.store.save({
      name: "Local fixture",
      scope: "user",
      transport: "stdio",
      command: process.execPath,
      args: ["-e", script],
      auth: "none",
    });
    const tools = await f.service.tools();
    assert.equal(tools.length, 1);
    assert.equal(
      (await f.service.execute(tools[0]!.function.name, {})).isError,
      false,
    );
  } finally {
    await f.cleanup();
  }
});

test("failed OAuth token exchange renders a failure page without claiming success", async () => {
  const f = fixture();
  const server = await testServer(true, true);
  const service = new McpService(
    f.store,
    () => {},
    server.browser,
    () => [],
  );
  try {
    const record = f.store.save({
      name: "Failed OAuth",
      scope: "user",
      transport: "http",
      url: server.url,
      auth: "oauth",
    });
    await assert.rejects(service.authenticate(record.id), /auth/);
    const page = await server.completion();
    assert.match(page, /Connection was not completed/);
    assert.ok(!page.includes("Account connected"));
    assert.equal(service.list()[0]!.lastConnectedAt, undefined);
  } finally {
    await service.invalidate();
    await f.cleanup();
    await server.close();
  }
});

test("connection history stays local and is invalidated by endpoint changes", async () => {
  const f = fixture();
  const workspace = path.join(f.root, "workspace");
  try {
    const record = f.store.save({
      name: "History",
      scope: "workspace",
      workspacePath: workspace,
      transport: "http",
      url: "https://example.com/mcp",
      auth: "none",
    });
    f.store.markConnected(record);
    assert.ok(f.store.lastConnectedAt(record));
    assert.ok(
      !fs
        .readFileSync(path.join(workspace, ".const", "mcp.json"), "utf8")
        .includes("lastConnected"),
    );
    const changed = f.store.save({
      ...record,
      url: "https://other.example/mcp",
    });
    assert.equal(f.store.lastConnectedAt(changed), undefined);
  } finally {
    await f.cleanup();
  }
});

test("MCP-only presets use hosted Canva and managed GitHub OAuth", async () => {
  const f = fixture();
  let browserOpened = false;
  const plugins = ["github", "canva"].map((name) => {
    const root = fileURLToPath(
      new URL("../../plugins/" + name + "/", import.meta.url),
    );
    return {
      ...readPluginManifest(root),
      id: name,
      path: root,
      scope: "user" as const,
      isEnabled: true,
      isEffective: true,
      skills: [],
    };
  });
  const service = new McpService(
    f.store,
    () => {},
    async () => {
      browserOpened = true;
    },
    () => plugins,
  );
  try {
    const records = service.list();
    const github = records.find((r) => r.pluginId === "github")!;
    const canva = records.find((r) => r.pluginId === "canva")!;
    assert.equal(github.url, "https://api.githubcopilot.com/mcp/");
    assert.equal(github.auth, "oauth");
    assert.deepEqual(github.authOptions, ["oauth", "api-key"]);
    assert.equal(github.managedOAuth, "github");
    assert.equal(github.oauthClientRequired, false);
    f.store.save({ ...github, auth: "api-key" });
    assert.equal(service.list().find((r) => r.id === github.id)!.auth, "oauth");
    f.store.save({
      ...github,
      auth: "api-key",
      apiKey: "fixture-existing-pat",
    });
    const pat = service.list().find((r) => r.id === github.id)!;
    assert.equal(pat.auth, "api-key");
    assert.equal(pat.hasCredentials, true);
    assert.equal(pat.managedOAuth, undefined);
    assert.equal(canva.url, "https://mcp.canva.com/mcp");
    assert.equal(canva.oauthClientRequired, undefined);
    assert.ok(plugins.every((plugin) => !plugin.entrypoint));

    assert.equal(browserOpened, false);
    assert.equal(
      service.list().find((r) => r.id === canva.id)!.hasCredentials,
      false,
    );
  } finally {
    await service.invalidate();
    await f.cleanup();
  }
});

test("Canva upgrades empty trusted settings while retaining existing accounts and custom clients", async () => {
  const f = fixture();
  const root = fileURLToPath(new URL("../../plugins/canva/", import.meta.url));
  const plugin = {
    ...readPluginManifest(root),
    id: "canva",
    path: root,
    scope: "user" as const,
    isEnabled: true,
    isEffective: true,
    skills: [],
  };
  const service = new McpService(
    f.store,
    () => {},
    async () => {},
    () => [plugin],
  );
  const oldUrl = "https://api.canva.com/connect/v1/mcp";
  try {
    const original = f.store.save({
      key: "plugin-canva-canva",
      name: "Canva",
      scope: "user",
      transport: "http",
      url: oldUrl,
      auth: "oauth",
      enabled: false,
    });
    const migrated = service.list()[0]!;
    assert.equal(migrated.id, original.id);
    assert.equal(migrated.url, "https://mcp.canva.com/mcp");
    assert.equal(migrated.enabled, false);
    f.store.save({ ...original, clientId: "personal-client" });
    assert.equal(service.list()[0]!.url, oldUrl);
    f.store.save({ ...original });
    f.store.writeSecrets(original.id, {
      tokens: { access_token: "existing-account", token_type: "Bearer" },
    });
    assert.equal(service.list()[0]!.url, oldUrl);
    assert.equal(
      f.store.secrets(original.id).tokens!.access_token,
      "existing-account",
    );
  } finally {
    await service.invalidate();
    await f.cleanup();
  }
});
