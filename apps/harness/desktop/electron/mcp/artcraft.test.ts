import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createConstAgent, readPluginManifest } from "@const/agent";
import { ArtcraftRuntimeManager, artcraftLaunch } from "./artcraft";
import { McpService, exposedToolName } from "./service";
import { McpStore } from "./store";
import {
  ARTCRAFT_APPS,
  ARTCRAFT_IDS,
  type ArtCraftApp,
} from "../../src/lib/mcp/artcraft";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "const-artcraft-"));
  const work = path.join(root, "work");
  fs.mkdirSync(work);
  const store = new McpStore(path.join(root, "home"), {
    encrypt: (v) => Buffer.from(v),
    decrypt: (v) => v.toString(),
  });
  let started = 0,
    calls = 0,
    running = 0,
    concurrent = 0;
  let pause: (() => Promise<void>) | undefined;
  let pauseDiscovery: (() => Promise<void>) | undefined;
  const manager = new ArtcraftRuntimeManager(() => {
    started++;
    const [client, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new Server(
      { name: "ArtCraft fixture", version: "1" },
      { capabilities: { tools: {} } },
    );
    let document = "";
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      await pauseDiscovery?.();
      return {
        tools: [
          {
            name: "edit",
            description: "Set the active document",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          },
          {
            name: "inspect",
            description: "Read the active document",
            inputSchema: { type: "object" },
          },
        ],
      };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      calls++;
      running++;
      concurrent = Math.max(concurrent, running);
      try {
        await pause?.();
        if (request.params.name === "edit")
          document = String(request.params.arguments?.text);
        return {
          content: [{ type: "text", text: JSON.stringify({ document }) }],
        };
      } finally {
        running--;
      }
    });
    void server.connect(serverTransport);
    return client;
  });
  const record = (app: ArtCraftApp = "gridcraft") => {
    const command = path.join(
      root,
      `${app}-cli${process.platform === "win32" ? ".exe" : ""}`,
    );
    fs.writeFileSync(command, "fixture", { mode: 0o700 });
    return store.save({
      key: `plugin-${app}-engine`,
      name: app,
      scope: "user",
      transport: "builtin",
      builtin: "artcraft",
      artcraftApp: app,
      runtimePath: command,
      localFileAccess: true,
      auth: "none",
    });
  };
  const cleanup = async () => {
    await manager.close();
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("const-artcraft-"));
    fs.rmSync(root, { recursive: true, force: true });
  };
  return {
    root,
    work,
    store,
    manager,
    record,
    cleanup,
    stats: () => ({ started, calls, concurrent }),
    pause: (fn?: () => Promise<void>) => {
      pause = fn;
    },
    pauseDiscovery: (fn?: () => Promise<void>) => {
      pauseDiscovery = fn;
    },
  };
}

test("all 13 packaged profiles and official icons exist; unsupported flags and symlink output folders are refused", async () => {
  const f = fixture();
  try {
    for (const app of ARTCRAFT_IDS) {
      const plugin = readPluginManifest(
        path.resolve(__dirname, `../../plugins/${app}`),
      );
      assert.equal(plugin.mcpServers?.engine?.artcraftApp, app);
      assert.equal(plugin.defaultInstalled, undefined);
      assert.ok(
        fs.statSync(
          path.resolve(
            __dirname,
            `../../public/assets/plugins/artcraft/${app}.png`,
          ),
        ).size > 100,
      );
      const launch = artcraftLaunch(app, f.work, "chat");
      assert.equal(
        launch.args.includes("--automation-read-root"),
        ARTCRAFT_APPS[app].roots,
      );
      if (app === "vectorcraft") assert.ok(launch.args.includes("--headless"));
      if (app === "lightcraft") assert.ok(launch.args.includes("--library"));
    }
    const other = path.join(f.root, "linked-work");
    fs.mkdirSync(other);
    fs.symlinkSync(
      f.work,
      path.join(other, "artifacts"),
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(() => artcraftLaunch("gridcraft", other, "chat"), /runtime/);
  } finally {
    await f.cleanup();
  }
});

test("engines are lazy, isolate chat/workspace documents and serialize edits; deleting a chat releases its engines", async () => {
  const f = fixture();
  try {
    const record = f.record();
    const call = (
      conversation: string,
      toolName: string,
      args = {},
      workspace = f.work,
    ) =>
      f.manager.execute(
        record,
        "v1",
        workspace,
        conversation,
        "call_tool",
        { toolName, arguments: args },
        undefined,
        () => {},
      );
    assert.equal(f.stats().started, 0);
    await call("a", "edit", { text: "A" });
    await call("b", "edit", { text: "B" });
    assert.match(JSON.stringify(await call("a", "inspect")), /A/);
    const other = path.join(f.root, "other");
    fs.mkdirSync(other);
    await call("a", "edit", { text: "Other" }, other);
    assert.match(JSON.stringify(await call("a", "inspect")), /A/);
    assert.equal(f.stats().started, 3);
    f.pause(() => new Promise((resolve) => setTimeout(resolve, 15)));
    await Promise.all([
      call("a", "edit", { text: "First" }),
      call("a", "edit", { text: "Second" }),
    ]);
    assert.equal(f.stats().concurrent, 1);
    assert.match(JSON.stringify(await call("a", "inspect")), /Second/);
    await f.manager.releaseConversation("a");
    assert.match(JSON.stringify(await call("b", "inspect")), /B/);
    assert.equal(f.stats().started, 3);
  } finally {
    await f.cleanup();
  }
});

test("queued calls recheck approval/configuration and cancellation before dispatch", async () => {
  const f = fixture();
  try {
    const record = f.record();
    let released!: () => void;
    const gate = new Promise<void>((resolve) => {
      released = resolve;
    });
    f.pause(() => gate);
    const first = f.manager.execute(
      record,
      "v1",
      f.work,
      "chat",
      "call_tool",
      { toolName: "edit", arguments: { text: "first" } },
      undefined,
      () => {},
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    let allowed = true;
    const second = f.manager.execute(
      record,
      "v1",
      f.work,
      "chat",
      "call_tool",
      { toolName: "edit", arguments: { text: "second" } },
      undefined,
      () => {
        if (!allowed) throw new Error("revoked");
      },
    );
    const controller = new AbortController();
    const third = f.manager.execute(
      record,
      "v1",
      f.work,
      "chat",
      "call_tool",
      { toolName: "edit", arguments: { text: "third" } },
      controller.signal,
      () => {},
    );
    allowed = false;
    controller.abort();
    released();
    const results = await Promise.allSettled([first, second, third]);
    assert.equal(results[0].status, "fulfilled");
    assert.equal(results[1].status, "rejected");
    assert.equal(results[2].status, "rejected");
    assert.equal(f.stats().calls, 1);
  } finally {
    await f.cleanup();
  }
});

test("cancelling during slow discovery stops waiting promptly and dispatches no mutation", async () => {
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    f.pauseDiscovery(() => gate);
    const record = f.record();
    const controller = new AbortController();
    const execution = f.manager.execute(
      record,
      "v1",
      f.work,
      "chat",
      "call_tool",
      { toolName: "edit", arguments: { text: "cancelled" } },
      controller.signal,
      () => {},
    );
    controller.abort(new Error("cancelled"));
    await assert.rejects(execution, /cancelled/);
    assert.equal(f.stats().calls, 0);
  } finally {
    release();
    await f.cleanup();
  }
});

test("MCP routing advertises lazy gateways, checks local file consent, trust and plugin identity", async () => {
  const f = fixture();
  const plugin = {
    ...readPluginManifest(path.resolve(__dirname, "../../plugins/gridcraft")),
    id: "gridcraft",
    path: "fixture",
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
    undefined,
    undefined,
    f.manager,
  );
  try {
    const record = f.record();
    const defs = await service.tools(f.work);
    assert.equal(defs.length, 2);
    assert.equal(f.stats().started, 0);
    assert.ok(defs.every((tool) => tool.requiresApproval));
    const deferred = await service.tools(f.work, undefined, 1);
    assert.equal(deferred[0]?.function.name, "mcp_search_tools");
    const search = await service.execute(
      "mcp_search_tools",
      { query: "spreadsheet" },
      f.work,
      undefined,
      "chat",
    );
    assert.match(search.result, /discover_tools/);
    assert.equal(f.stats().started, 0);
    const discovery = await service.execute(
      exposedToolName(record.id, "discover_tools"),
      { query: "edit" },
      f.work,
      undefined,
      "chat",
    );
    assert.equal(discovery.isError, false);
    assert.match(discovery.result, /inputSchema/);
    const response = await service.execute(
      "mcp_call_tool",
      {
        toolName: exposedToolName(record.id, "call_tool"),
        arguments: { toolName: "edit", arguments: { text: "Persisted" } },
      },
      f.work,
      undefined,
      "chat",
    );
    assert.equal(response.isError, false);
    await assert.rejects(
      service.save({ ...record, artcraftApp: "cadcraft" }),
      /invalid/,
    );
    await assert.rejects(service.save({ ...record, id: undefined }), /invalid/);
    await service.save({ ...record, localFileAccess: false });
    assert.equal((await service.tools(f.work)).length, 0);
    const noConsent = await service.execute(
      exposedToolName(record.id, "call_tool"),
      { toolName: "inspect", arguments: {} },
      f.work,
      undefined,
      "chat",
    );
    assert.equal(noConsent.isError, true);
    await service.save({ ...record, localFileAccess: true });
    const file = path.join(f.store.home, "mcp.json");
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    config.connections[0].runtimePath += ".changed";
    fs.writeFileSync(file, JSON.stringify(config));
    assert.equal((await service.tools(f.work)).length, 0);
    assert.equal(
      (
        await service.execute(
          exposedToolName(record.id, "call_tool"),
          { toolName: "inspect", arguments: {} },
          f.work,
          undefined,
          "chat",
        )
      ).isError,
      true,
    );
  } finally {
    await service.invalidate();
    await f.cleanup();
  }
});

test("CLI selection cannot overwrite settings changed while the native picker was open", async () => {
  const f = fixture();
  const plugin = {
    ...readPluginManifest(path.resolve(__dirname, "../../plugins/gridcraft")),
    id: "gridcraft",
    path: "fixture",
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
    undefined,
    undefined,
    f.manager,
  );
  try {
    const record = f.record();
    let choose!: (file: string) => void;
    const selection = service.configureArtcraft(
      record.id,
      f.work,
      () =>
        new Promise<string>((resolve) => {
          choose = resolve;
        }),
    );
    f.store.save({ ...record, enabled: false });
    choose(record.runtimePath!);
    await assert.rejects(selection, /invalid/);
    assert.equal(f.store.get(record.id).enabled, false);
    assert.equal(f.stats().started, 0);
  } finally {
    await service.invalidate();
    await f.cleanup();
  }
});

test("an unexpectedly closed engine is not silently restarted or replayed; explicit disconnect permits reopening", async () => {
  const f = fixture();
  try {
    const record = f.record();
    const session = await f.manager.connect(record, "v1", f.work, "chat");
    await session.client.close();
    await assert.rejects(
      f.manager.execute(
        record,
        "v1",
        f.work,
        "chat",
        "call_tool",
        { toolName: "edit", arguments: { text: "uncertain" } },
        undefined,
        () => {},
      ),
      /connection/,
    );
    assert.equal(f.stats().started, 1);
    assert.equal(f.stats().calls, 0);
    await f.manager.disconnect(record.id);
    await f.manager.connect(record, "v1", f.work, "chat");
    assert.equal(f.stats().started, 2);
  } finally {
    await f.cleanup();
  }
});

for (const allow of [true, false])
  test(`Main Chat ArtCraft calls use real MCP routing only after agent approval (${allow ? "allow" : "deny"})`, async () => {
    const f = fixture();
    const record = f.record();
    const plugin = {
      ...readPluginManifest(path.resolve(__dirname, "../../plugins/gridcraft")),
      id: "gridcraft",
      path: "fixture",
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
      undefined,
      undefined,
      f.manager,
    );
    const original = globalThis.fetch;
    let turns = 0;
    try {
      globalThis.fetch = async (input, init) => {
        assert.match(String(input), /model\.fixture\.invalid/);
        const request = JSON.parse(String(init?.body));
        assert.ok(
          !request.tools.some((tool: any) => "requiresApproval" in tool),
        );
        const delta =
          ++turns === 1
            ? {
                tool_calls: [
                  {
                    index: 0,
                    id: "call",
                    type: "function",
                    function: {
                      name: exposedToolName(record.id, "call_tool"),
                      arguments: JSON.stringify({
                        toolName: "edit",
                        arguments: { text: "Main Chat" },
                      }),
                    },
                  },
                ],
              }
            : { content: "Done" };
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta, finish_reason: turns === 1 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
          { headers: { "Content-Type": "text/event-stream" } },
        );
      };
      const agent = createConstAgent({
        preset: "harness",
        tools: [],
        baseUrl: "https://model.fixture.invalid/v1",
        apiKey: "fixture",
        model: "fixture",
        workspacePath: f.work,
        maxTurns: 2,
        mode: "ask_before_changes",
        externalTools: (signal) => service.tools(f.work, signal),
        externalToolHandler: (name, args, signal) =>
          service.execute(name, args, f.work, signal, "chat"),
      });
      await agent.run(
        [{ role: "user", content: "Edit the spreadsheet with ArtCraft." }],
        (event) => {
          if (event.type === "approval_request")
            queueMicrotask(() =>
              agent.resolveApproval(event.approvalId!, {
                approvalId: event.approvalId!,
                decision: allow ? "allow_once" : "deny",
              }),
            );
        },
      );
      assert.equal(f.stats().calls, allow ? 1 : 0);
      assert.equal(f.stats().started, allow ? 1 : 0);
    } finally {
      globalThis.fetch = original;
      await service.invalidate();
      await f.cleanup();
    }
  });
