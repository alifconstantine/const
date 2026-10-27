import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createConstAgent, type AgentEvent } from "@const/agent";
import { McpService, exposedToolName } from "./service";
import { McpStore } from "./store";
import { McpAppsStore } from "./apps-store";
import { messageApps, sandboxHtml } from "../../src/lib/mcp/apps";

test("MCP Apps preserves UI metadata, hides app-only tools, stores diagrams and isolates checkpoint access", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "const-apps-"));
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(workspace);
  const store = new McpStore(path.join(root, "home"), {
    encrypt: (v) => Buffer.from(v),
    decrypt: (v) => v.toString(),
  });
  let advertised = false;
  let shared = 0;
  const elements = [
    {
      type: "rectangle",
      id: "box",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      label: { text: "Const" },
    },
  ];
  const server = http.createServer(async (request, response) => {
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    let body = "";
    for await (const chunk of request) body += chunk;
    const message = JSON.parse(body);
    if (message.id === undefined) {
      response.writeHead(202).end();
      return;
    }
    let result: any;
    if (message.method === "initialize") {
      advertised =
        !!message.params.capabilities.extensions?.[
          "io.modelcontextprotocol/ui"
        ];
      result = {
        protocolVersion: message.params.protocolVersion,
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "Excalidraw fixture", version: "1" },
      };
    } else if (message.method === "tools/list")
      result = {
        tools: [
          {
            name: "create_view",
            inputSchema: { type: "object" },
            _meta: { ui: { resourceUri: "ui://excalidraw/mcp-app.html" } },
          },
          ...["read_checkpoint", "save_checkpoint", "export_to_excalidraw"].map(
            (name) => ({
              name,
              inputSchema: { type: "object" },
              _meta: { ui: { visibility: ["app"] } },
            }),
          ),
        ],
      };
    else if (message.method === "resources/read")
      result = {
        contents: [
          {
            uri: "ui://excalidraw/mcp-app.html",
            mimeType: "text/html;profile=mcp-app",
            text: "<!doctype html><h1>Fixture diagram</h1>",
            _meta: { ui: { csp: { resourceDomains: ["https://esm.sh"] } } },
          },
        ],
      };
    else if (message.params.name === "read_checkpoint")
      result = {
        content: [{ type: "text", text: JSON.stringify({ elements }) }],
      };
    else if (message.params.name === "save_checkpoint")
      result = { content: [{ type: "text", text: "ok" }] };
    else if (message.params.name === "export_to_excalidraw") {
      shared++;
      result = {
        content: [{ type: "text", text: "https://excalidraw.com/#fixture" }],
      };
    } else
      result = {
        content: [{ type: "text", text: "Diagram created" }],
        structuredContent: { checkpointId: "fixture-checkpoint" },
      };
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}/mcp`;
  const plugin = {
    name: "excalidraw",
    version: "1",
    description: "Fixture",
    author: { name: "Fixture" },
    interface: { displayName: "Excalidraw", icon: "excalidraw" },
    mcpServers: {
      excalidraw: { transport: "http" as const, url, auth: "none" as const },
    },
    id: "excalidraw",
    path: root,
    scope: "user" as const,
    skills: [],
    isEnabled: true,
    isEffective: true,
  };
  const service = new McpService(
    store,
    () => {},
    async () => {},
    () => [plugin],
  );
  try {
    const tools = await service.tools(workspace);
    assert.ok(advertised);
    assert.equal(tools.length, 2);
    assert.ok(
      !tools.some((tool) => tool.function.name.includes("save_checkpoint")),
    );
    assert.equal(
      (
        await service.execute(
          exposedToolName(
            service.list(workspace)[0]!.id,
            "export_to_excalidraw",
          ),
          { json: "{}" },
          workspace,
        )
      ).isError,
      true,
    );
    const create = tools.find((tool) =>
      tool.function.name.endsWith("create_view"),
    )!;
    const realFetch = globalThis.fetch;
    const requests: any[] = [];
    try {
      globalThis.fetch = async (input, init) => {
        if (
          String(input) !== "https://model.fixture.invalid/v1/chat/completions"
        )
          return realFetch(input, init);
        const request = JSON.parse(String(init?.body));
        requests.push(request);
        assert.ok(
          request.tools.some(
            (tool: any) => tool.function.name === create.function.name,
          ),
        );
        assert.ok(
          !request.tools.some((tool: any) =>
            tool.function.name.includes("save_checkpoint"),
          ),
        );
        const delta =
          requests.length === 1
            ? {
                tool_calls: [
                  {
                    index: 0,
                    id: "draw",
                    type: "function",
                    function: {
                      name: create.function.name,
                      arguments: JSON.stringify({
                        elements: JSON.stringify(elements),
                      }),
                    },
                  },
                ],
              }
            : { content: "Diagram ready." };
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta, finish_reason: requests.length === 1 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
          { headers: { "Content-Type": "text/event-stream" } },
        );
      };
      const agent = createConstAgent({
        preset: "harness",
        baseUrl: "https://model.fixture.invalid/v1",
        apiKey: "fixture",
        model: "fixture",
        workspacePath: workspace,
        tools: [],
        mode: "ask_before_changes",
        maxTurns: 2,
        externalTools: (signal) => service.tools(workspace, signal),
        externalToolHandler: (name, args, signal) =>
          service.execute(name, args, workspace, signal),
      });
      const events: AgentEvent[] = [];
      const history = await agent.run(
        [{ role: "user", content: "Draw a diagram" }],
        (event) => {
          events.push(event);
          if (event.type === "approval_request")
            queueMicrotask(() =>
              agent.resolveApproval(event.approvalId!, {
                approvalId: event.approvalId!,
                decision: "allow_once",
              }),
            );
        },
      );
      assert.equal(history.at(-1)?.content, "Diagram ready.");
      assert.equal(
        events.filter((event) => event.type === "approval_request").length,
        1,
      );
      const result = events.find(
        (event) => event.type === "tool_result" && !event.isError,
      )!;
      assert.equal(result.type, "tool_result");
      if (result.type !== "tool_result") throw new Error("Missing tool result");
      assert.equal(
        messageApps({ toolCalls: [{ result: result.result }] }).length,
        1,
      );
      assert.ok(
        requests[1].messages.some(
          (message: any) =>
            message.role === "tool" &&
            JSON.parse(message.content).constMcpApp?.filePath.endsWith(
              ".excalidraw",
            ),
        ),
      );
    } finally {
      globalThis.fetch = realFetch;
    }
    const result = await service.execute(
      create.function.name,
      { elements: JSON.stringify(elements) },
      workspace,
    );
    const ref = messageApps({ toolCalls: [{ result: result.result }] })[0]!;
    assert.ok(
      ref.id &&
        ref.filePath?.startsWith(path.join(workspace, "artifacts", "diagrams")),
    );
    const view = await service.appView(ref.id);
    assert.match(view.html, /Fixture diagram/);
    assert.equal(view.scene?.elements.length, 1);
    assert.deepEqual(view.csp.resourceDomains, ["https://esm.sh"]);
    await assert.rejects(
      service.appCall(ref.id, "read_checkpoint", { id: "someone-else" }),
      /invalid/,
    );
    await assert.rejects(
      service.appCall(ref.id, "export_to_excalidraw", { json: "{}" }),
      /invalid/,
    );
    assert.equal(shared, 0);
    await service.appCall(ref.id, "export_to_excalidraw", { json: "{}" }, true);
    assert.equal(shared, 1);
    const scene = {
      elements: [
        {
          ...elements[0],
          version: 2,
          label: undefined,
          customData: { edited: true },
        },
      ],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {
        fixture: { id: "fixture", dataURL: "data:image/png;base64,AAAA" },
      },
    };
    const filePath = await service.saveDiagram(ref.id, scene);
    assert.equal(
      JSON.parse(fs.readFileSync(filePath, "utf8")).type,
      "excalidraw",
    );
    assert.deepEqual(service.readDiagram(filePath).scene.files, scene.files);
    await service.appContext(ref.id, "User changed the diagram");
    const context = await service.execute(
      "mcp_read_app_context",
      { id: ref.id },
      workspace,
    );
    assert.match(context.result, /User changed/);
    assert.match(context.result, /edited/);
    const other = path.join(root, "other");
    fs.mkdirSync(other);
    assert.equal(
      (await service.execute("mcp_read_app_context", { id: ref.id }, other))
        .isError,
      true,
    );
    await service.invalidate();
    assert.equal(service.readDiagram(filePath).scene.elements[0].version, 2);
    store.save({ ...store.list()[0]!, enabled: false });
    await assert.rejects(service.appView(ref.id), /invalid/);
    // The user's local file remains usable after disconnecting the server.
    assert.equal(service.readDiagram(filePath).id, ref.id);
  } finally {
    await service.invalidate();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("diagram files are bounded to their workspace and app records survive restart", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "const-apps-storage-"));
  try {
    const apps = new McpAppsStore(path.join(root, "home"));
    const workspace = path.join(root, "workspace");
    fs.mkdirSync(workspace);
    const ref = apps.create({
      kind: "excalidraw",
      connectionId: "fixture",
      fingerprint: "fixture",
      title: "Excalidraw",
      workspace,
      resourceUri: "ui://excalidraw/mcp-app.html",
      arguments: {},
      result: { content: [] },
    });
    assert.throws(() => apps.get("../../secret"));
    assert.throws(() =>
      apps.saveScene(ref.id, {
        elements: [],
        files: { image: { dataURL: "https://evil.example/image" } },
      }),
    );
    const target = apps.saveScene(ref.id, { elements: [], files: {} });
    const reopened = new McpAppsStore(path.join(root, "home"));
    assert.equal(reopened.byPath(target).id, ref.id);
    assert.throws(() =>
      reopened.byPath(path.join(root, "elsewhere", path.basename(target))),
    );
    const blockedWorkspace = path.join(root, "blocked");
    fs.mkdirSync(blockedWorkspace);
    const outside = path.join(root, "outside");
    fs.mkdirSync(outside);
    fs.symlinkSync(
      outside,
      path.join(blockedWorkspace, "artifacts"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const blocked = apps.create({ ...ref, workspace: blockedWorkspace });
    assert.throws(
      () => apps.saveScene(blocked.id, { elements: [] }),
      /invalid/,
    );
    assert.deepEqual(fs.readdirSync(outside), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("app cards survive normalized chat results and sandbox markup cannot widen host permissions", () => {
  const ref = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Excalidraw",
  };
  const result = JSON.stringify({ constMcpApp: ref });
  assert.equal(
    messageApps({ toolCalls: [{ result }], traceSteps: [{ result }] }).length,
    1,
  );
  assert.deepEqual(
    messageApps({
      toolCalls: [{ result, isError: true }, { result: "plain text" }],
    }),
    [],
  );
  const html = sandboxHtml("<script>fixture()</script>", {
    resourceDomains: [
      "https://esm.sh",
      "https://evil.example'; script-src *",
      "file:///",
    ],
  });
  assert.match(html, /default-src 'none'/);
  assert.match(html, /frame-src 'none'/);
  assert.ok(!html.includes("evil.example") && !html.includes("file:///"));
});
