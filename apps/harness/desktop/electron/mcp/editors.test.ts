import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import JSZip from "jszip";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readPluginManifest, createConstAgent } from "@const/agent";
import {
  EditorRuntimeManager,
  editorProject,
  unityProjectReady,
} from "./editors";
import { extractEditorArchive, archivePath, EditorSetup } from "./editor-setup";
import { EDITOR_IDS, type EditorApp } from "../../src/lib/mcp/editors";
import { McpStore } from "./store";
import { McpService, exposedToolName } from "./service";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "const-editors-"));
  const work = path.join(root, "work");
  fs.mkdirSync(work);
  const store = new McpStore(path.join(root, "home"), {
    encrypt: (v) => Buffer.from(v),
    decrypt: (v) => v.toString(),
  });
  let current = "",
    offline = false,
    statusOnly = false,
    started = 0,
    writes = 0,
    running = 0,
    concurrent = 0;
  let pause: (() => Promise<void>) | undefined;
  const manager = new EditorRuntimeManager(store.home, () => {
    started++;
    const [transport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new Server(
      { name: "editor fixture", version: "1" },
      { capabilities: { tools: { listChanged: true } } },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: (statusOnly
        ? ["unity-cli-status"]
        : [
            "execute_blender_code",
            "execute_blender_code_for_cli",
            "project_get_settings",
            "call_tool",
            "edit",
            "inspect",
          ]
      ).map((name) => ({
        name,
        description: name,
        inputSchema: { type: "object" as const },
      })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (
        request.params.name === "execute_blender_code" ||
        (request.params.name === "call_tool" &&
          request.params.arguments?.toolset_name === "ConstHarnessContext")
      )
        return {
          isError: offline,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                result: { const_harness_project: current },
              }),
            },
          ],
        };
      if (request.params.name === "project_get_settings")
        return { isError: offline, content: [{ type: "text", text: "{}" }] };
      running++;
      concurrent = Math.max(concurrent, running);
      try {
        await pause?.();
        if (request.params.name === "edit") writes++;
        return {
          content: [{ type: "text", text: JSON.stringify({ writes }) }],
        };
      } finally {
        running--;
      }
    });
    void server.connect(serverTransport);
    return transport;
  });
  manager.setup.prepared = () => true;
  const record = (
    app: EditorApp = "blender",
    scope: "user" | "workspace" = "user",
  ) => {
    let project = work;
    if (app === "blender") {
      project = path.join(work, "scene.blend");
      fs.writeFileSync(project, "fixture");
    }
    if (app === "godot")
      fs.writeFileSync(path.join(work, "project.godot"), "config_version=5\n");
    if (app === "unity") {
      fs.mkdirSync(path.join(work, "Assets"), { recursive: true });
      fs.mkdirSync(path.join(work, "Packages"), { recursive: true });
      fs.writeFileSync(path.join(work, "Packages", "manifest.json"), "{}");
    }
    if (app === "unreal") {
      project = path.join(work, "Game.uproject");
      fs.writeFileSync(project, "{}");
    }
    current = project;
    return store.save({
      key: `plugin-${app}-editor`,
      name: app,
      scope,
      workspacePath: scope === "workspace" ? work : undefined,
      transport: "builtin",
      builtin: "editor",
      editorApp: app,
      editorProjectPath: project,
      auth: "none",
    });
  };
  const service = (app: EditorApp) => {
    const plugin = {
      ...readPluginManifest(path.resolve(__dirname, `../../plugins/${app}`)),
      id: app,
      path: "fixture",
      scope: "user" as const,
      isEnabled: true,
      isEffective: true,
      skills: [],
    };
    return new McpService(
      store,
      () => {},
      async () => {},
      () => [plugin],
      undefined,
      undefined,
      undefined,
      manager,
    );
  };
  return {
    root,
    work,
    store,
    manager,
    record,
    service,
    setCurrent: (value: string) => {
      current = value;
    },
    setOffline: () => {
      offline = true;
    },
    setStatusOnly: (value: boolean) => {
      statusOnly = value;
    },
    pause: (fn?: () => Promise<void>) => {
      pause = fn;
    },
    stats: () => ({ started, writes, concurrent }),
    cleanup: async () => {
      await manager.close();
      assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
      assert.ok(path.basename(root).startsWith("const-editors-"));
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test("four optional MCP-only plugins have strictly bound profiles; fingerprints include project and port", async () => {
  const f = fixture();
  try {
    for (const app of EDITOR_IDS) {
      const manifest = readPluginManifest(
        path.resolve(__dirname, `../../plugins/${app}`),
      );
      assert.equal(manifest.mcpServers?.editor?.editorApp, app);
      assert.equal(manifest.defaultInstalled, undefined);
      assert.equal(manifest.entrypoint, undefined);
      const record = f.record(app);
      assert.notEqual(
        f.store.fingerprint(record),
        f.store.fingerprint({ ...record, editorPort: 9877 }),
      );
      assert.notEqual(
        f.store.fingerprint(record),
        f.store.fingerprint({ ...record, editorProjectPath: f.root }),
      );
      assert.throws(
        () => f.store.save({ ...record, url: "http://127.0.0.1:8000/mcp" }),
        /invalid/,
      );
      assert.throws(
        () => f.store.save({ ...record, command: "node" }),
        /invalid/,
      );
      assert.throws(() => f.store.save({ ...record, editorPort: 80 }), /./);
    }
  } finally {
    await f.cleanup();
  }
});

test("project targeting rejects outside workspaces, ambiguous Unreal projects and symlink escapes", async () => {
  const f = fixture();
  try {
    const record = f.record();
    assert.equal(
      editorProject(record, f.work),
      fs.realpathSync(record.editorProjectPath!).toLowerCase(),
    );
    assert.throws(() => editorProject(record), /editor_project/);
    assert.throws(
      () => editorProject(record, path.join(f.work, "missing")),
      /./,
    );
    const outside = path.join(f.root, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "project.godot"), "");
    const link = path.join(f.work, "link");
    fs.symlinkSync(
      outside,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    const godot = {
      ...record,
      key: "plugin-godot-editor",
      editorApp: "godot" as const,
      editorProjectPath: link,
    };
    assert.throws(() => editorProject(godot, f.work), /editor_project/);
    f.record("unreal");
    fs.writeFileSync(path.join(f.work, "Other.uproject"), "{}");
    assert.throws(
      () =>
        editorProject(
          {
            ...record,
            key: "plugin-unreal-editor",
            editorApp: "unreal",
            editorProjectPath: f.work,
          },
          f.work,
        ),
      /editor_project/,
    );
  } finally {
    await f.cleanup();
  }
});

test("verified archive extraction rejects traversal and links, preserves directories and Unix execute permissions", async () => {
  const f = fixture();
  try {
    for (const entry of [
      "../escape",
      "/outside",
      "C:/outside",
      "a\\..\\escape",
    ])
      assert.throws(() => archivePath(f.work, entry), /editor_setup/);
    const zip = new JSZip();
    zip.file("bin/tool", "ok", { unixPermissions: 0o100755 });
    zip.folder("empty");
    await extractEditorArchive(
      await zip.generateAsync({ type: "nodebuffer", platform: "UNIX" }),
      f.work,
      true,
    );
    assert.equal(
      fs.readFileSync(path.join(f.work, "bin", "tool"), "utf8"),
      "ok",
    );
    assert.ok(fs.statSync(path.join(f.work, "empty")).isDirectory());
    const malicious = new JSZip();
    malicious.file("../escape", "no");
    await assert.rejects(
      extractEditorArchive(
        await malicious.generateAsync({ type: "nodebuffer" }),
        f.work,
        true,
      ),
      /editor_setup/,
    );
    const linked = new JSZip();
    linked.file("linked", "../outside", { unixPermissions: 0o120777 });
    await assert.rejects(
      extractEditorArchive(
        await linked.generateAsync({ type: "nodebuffer", platform: "UNIX" }),
        f.work,
        true,
      ),
      /editor_setup/,
    );
  } finally {
    await f.cleanup();
  }
});

test("Blender and Unreal recheck the live project before every write; Godot refuses an offline authenticated editor", async () => {
  const f = fixture();
  try {
    for (const app of ["blender", "unreal"] as const) {
      const record = f.record(app);
      const discovered = await f.manager.execute(
        record,
        f.work,
        "discover_tools",
        {},
        undefined,
        () => {},
      );
      if (app === "blender")
        assert.doesNotMatch(
          JSON.stringify(discovered),
          /execute_blender_code_for_cli/,
        );
      f.setCurrent(path.join(f.root, "other.blend"));
      fs.writeFileSync(path.join(f.root, "other.blend"), "");
      await assert.rejects(
        f.manager.execute(
          record,
          f.work,
          "call_tool",
          { toolName: "edit", arguments: {} },
          undefined,
          () => {},
        ),
        /editor_project/,
      );
      assert.equal(f.stats().writes, 0);
    }
    const godot = f.record("godot");
    f.setOffline();
    await assert.rejects(
      f.manager.execute(
        godot,
        f.work,
        "call_tool",
        { toolName: "edit", arguments: {} },
        undefined,
        () => {},
      ),
      /editor_wait/,
    );
    assert.equal(f.stats().writes, 0);
  } finally {
    await f.cleanup();
  }
});

test("shared editor queues serialize aliases, promptly cancel queued calls, and recheck authorization before dispatch", async () => {
  const f = fixture();
  try {
    const record = f.record();
    let release!: () => void, entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    f.pause(() => {
      entered();
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const first = f.manager.execute(
      record,
      f.work,
      "call_tool",
      { toolName: "edit", arguments: {} },
      undefined,
      () => {},
    );
    await waiting;
    const controller = new AbortController();
    const cancelled = f.manager.execute(
      { ...record, id: "alias" },
      f.work,
      "call_tool",
      { toolName: "edit", arguments: {} },
      controller.signal,
      () => {},
    );
    controller.abort();
    await assert.rejects(cancelled);
    let trusted = true;
    const revoked = f.manager.execute(
      record,
      f.work,
      "call_tool",
      { toolName: "edit", arguments: {} },
      undefined,
      () => {
        if (!trusted) throw new Error("invalid");
      },
    );
    trusted = false;
    f.pause();
    release();
    await first;
    await assert.rejects(revoked, /invalid/);
    assert.equal(f.stats().writes, 1);
    assert.equal(f.stats().concurrent, 1);
  } finally {
    await f.cleanup();
  }
});

test("Unity initialization with a status-only tool is not connected; readiness rejects compilation and wrong projects", async () => {
  const f = fixture();
  try {
    const record = f.record("unity");
    f.setStatusOnly(true);
    await assert.rejects(
      f.manager.probe(record, f.work, () => {}),
      /editor_wait/,
    );
    const status = (state: string, project = f.work) => ({
      success: true,
      data: { instances: [{ projectPath: project, state }] },
    });
    assert.equal(unityProjectReady(status("ready"), f.work), true);
    assert.equal(unityProjectReady(status("compiling"), f.work), false);
    assert.equal(unityProjectReady(status("ready", f.root), f.work), false);
    assert.equal(
      unityProjectReady({ success: false, data: { instances: [] } }, f.work),
      false,
    );
  } finally {
    await f.cleanup();
  }
});

test("cancelled editor writes block aliases until explicit reconnection and are never replayed", async () => {
  const f = fixture();
  try {
    const record = f.record();
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    f.pause(() => {
      entered();
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const controller = new AbortController();
    const write = f.manager.execute(
      record,
      f.work,
      "call_tool",
      { toolName: "edit", arguments: {} },
      controller.signal,
      () => {},
    );
    await started;
    controller.abort();
    await assert.rejects(write);
    // Let the underlying SDK cancellation propagate before the next queued call.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await assert.rejects(
      f.manager.execute(
        { ...record, id: "alias" },
        f.work,
        "call_tool",
        { toolName: "edit", arguments: {} },
        undefined,
        () => {},
      ),
      /connection/,
    );
    assert.equal(f.stats().started, 1);
    f.pause();
    release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(f.stats().writes, 1);
    await f.manager.disconnect(record.id);
    await f.manager.execute(
      record,
      f.work,
      "call_tool",
      { toolName: "inspect", arguments: {} },
      undefined,
      () => {},
    );
    assert.equal(f.stats().writes, 1);
    assert.equal(f.stats().started, 2);
  } finally {
    await f.cleanup();
  }
});

test("runtime setup checks pinned hashes, cancels network work and removes incomplete staging", async () => {
  const f = fixture();
  const original = globalThis.fetch;
  try {
    const setup = new EditorSetup(f.store.home);
    globalThis.fetch = async () => new Response("invalid executable");
    await assert.rejects(setup.prepare("unity"), /editor_setup/);
    assert.equal(setup.prepared("unity"), false);
    assert.equal(setup.busy("unity"), false);
    globalThis.fetch = async (_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = options?.signal;
        signal?.addEventListener(
          "abort",
          () => reject(new Error("cancelled")),
          { once: true },
        );
      });
    const install = setup.prepare("unity");
    assert.equal(setup.busy("unity"), true);
    setup.cancel("unity");
    await assert.rejects(install);
    assert.equal(setup.busy("unity"), false);
    assert.deepEqual(fs.readdirSync(path.dirname(setup.root("unity"))), []);
  } finally {
    globalThis.fetch = original;
    await f.cleanup();
  }
});

test("Settings project picker saves a workspace override and refuses stale async changes", async () => {
  const f = fixture();
  const record = f.record();
  const service = f.service("blender");
  try {
    await service.configureEditor(
      record.id,
      "project",
      f.work,
      async () => record.editorProjectPath!,
    );
    const current = service.list(f.work)[0]!;
    assert.equal(current.scope, "workspace");
    assert.notEqual(current.id, record.id);
    assert.equal(f.store.get(record.id).scope, "user");
    let choose!: (path: string) => void;
    const picker = service.configureEditor(
      current.id,
      "project",
      f.work,
      () =>
        new Promise<string>((resolve) => {
          choose = resolve;
        }),
    );
    f.store.save({ ...current, enabled: false });
    choose(record.editorProjectPath!);
    await assert.rejects(picker, /invalid/);
  } finally {
    await service.invalidate();
    await f.cleanup();
  }
});

test("project add-on installation preserves existing files and rejects junction destinations", async () => {
  const f = fixture();
  try {
    const setup = new EditorSetup(f.store.home);
    await setup.prepare("unreal");
    setup.installProject("unreal", f.work);
    const destination = path.join(
      f.work,
      "Plugins",
      "ConstHarnessBridge",
      "Content",
      "Python",
      "init_unreal.py",
    );
    assert.match(fs.readFileSync(destination, "utf8"), /get_project_file_path/);
    fs.writeFileSync(destination, "custom");
    setup.installProject("unreal", f.work);
    assert.equal(fs.readFileSync(destination, "utf8"), "custom");
    const other = path.join(f.root, "other");
    fs.mkdirSync(other);
    fs.symlinkSync(
      path.join(f.work, "Plugins"),
      path.join(other, "Plugins"),
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(
      () => setup.installProject("unreal", other),
      /editor_project/,
    );
  } finally {
    await f.cleanup();
  }
});

test("Main Chat advertises lazy approved gateways, executes deferred calls and blocks edited workspace trust", async () => {
  const f = fixture();
  const record = f.record();
  const service = f.service("blender");
  try {
    const tools = await service.tools(f.work);
    assert.equal(tools.length, 2);
    assert.ok(tools.every((tool) => tool.requiresApproval));
    assert.equal(f.stats().started, 0);
    const response = await service.execute(
      exposedToolName(record.id, "discover_tools"),
      { query: "edit" },
      f.work,
      undefined,
      "main-chat",
    );
    assert.equal(response.isError, false);
    assert.match(response.result, /sharedLiveEditor/);
    await service.tools(f.work, undefined, 0);
    const result = await service.execute(
      "mcp_call_tool",
      {
        toolName: exposedToolName(record.id, "call_tool"),
        arguments: { toolName: "edit", arguments: {} },
      },
      f.work,
      undefined,
      "main-chat",
    );
    assert.equal(result.isError, false);
    assert.equal(f.stats().writes, 1);
    const configPath = path.join(f.store.home, "mcp.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.connections[0].editorPort = 9877;
    fs.writeFileSync(configPath, JSON.stringify(config));
    assert.equal((await service.tools(f.work)).length, 0);
    assert.equal(
      (
        await service.execute(
          exposedToolName(record.id, "call_tool"),
          { toolName: "edit", arguments: {} },
          f.work,
        )
      ).isError,
      true,
    );
    assert.equal(f.stats().writes, 1);
  } finally {
    await service.invalidate();
    await f.cleanup();
  }
});

for (const allow of [false, true])
  test(
    "Main Chat catalog search and approval " +
      (allow ? "allows" : "denies") +
      " editor writes before connection",
    async () => {
      const f = fixture();
      const record = f.record();
      const service = f.service("blender");
      const original = globalThis.fetch;
      let turns = 0;
      try {
        globalThis.fetch = async (input, init) => {
          assert.match(String(input), /model\.fixture\.invalid/);
          const request = JSON.parse(String(init?.body));
          assert.ok(
            !request.tools.some((tool: any) => "requiresApproval" in tool),
          );
          const round = ++turns;
          assert.ok(
            request.tools.some(
              (tool: any) => tool.function.name === "mcp_search_tools",
            ),
          );
          assert.ok(
            !request.tools.some(
              (tool: any) =>
                tool.function.name === exposedToolName(record.id, "call_tool"),
            ),
          );
          if (round === 2) assert.equal(f.stats().started, 0);
          const delta =
            round <= 2
              ? {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call-" + round,
                      type: "function",
                      function: {
                        name:
                          round === 1 ? "mcp_search_tools" : "mcp_call_tool",
                        arguments: JSON.stringify(
                          round === 1
                            ? { query: "Blender call_tool" }
                            : {
                                toolName: exposedToolName(
                                  record.id,
                                  "call_tool",
                                ),
                                arguments: { toolName: "edit", arguments: {} },
                              },
                        ),
                      },
                    },
                  ],
                }
              : { content: "Done" };
          return new Response(
            "data: " +
              JSON.stringify({
                choices: [
                  { delta, finish_reason: turns <= 2 ? "tool_calls" : "stop" },
                ],
              }) +
              "\n\ndata: [DONE]\n\n",
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
          maxTurns: 3,
          mode: "ask_before_changes",
          deferNativeTools: true,
          externalTools: (signal) => service.tools(f.work, signal, 0),
          externalToolHandler: (name, args, signal) =>
            service.execute(name, args, f.work, signal, "chat"),
        });
        await agent.run(
          [
            {
              role: "user",
              content: "Edit the Blender scene using the plugin.",
            },
          ],
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
        assert.equal(f.stats().writes, allow ? 1 : 0);
        assert.equal(f.stats().started, allow ? 1 : 0);
      } finally {
        globalThis.fetch = original;
        await service.invalidate();
        await f.cleanup();
      }
    },
  );
