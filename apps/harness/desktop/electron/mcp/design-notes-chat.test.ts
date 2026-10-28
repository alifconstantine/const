import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createConstAgent,
  readPluginManifest,
  type AgentEvent,
} from "@const/agent";
import { McpService } from "./service";
import { McpStore } from "./store";
import { FIGMA_DESKTOP_URL, FIGMA_REMOTE_URL } from "../../src/lib/mcp/presets";

for (const allow of [true, false])
  test(`Main Chat uses Figma Desktop context and writes an Obsidian note through real MCP/approval routing (${allow ? "allow" : "deny"})`, async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "const-design-notes-chat-"),
    );
    const folder = path.join(root, "vault");
    fs.mkdirSync(path.join(folder, ".obsidian"), { recursive: true });
    const plugins = ["figma", "obsidian"].map((name) => {
      const location = fileURLToPath(
        new URL(`../../plugins/${name}/`, import.meta.url),
      );
      return {
        ...readPluginManifest(location),
        id: name,
        path: location,
        scope: "user" as const,
        isEnabled: true,
        isEffective: true,
        skills: [],
      };
    });
    const store = new McpStore(path.join(root, "home"), {
      encrypt: (v) => Buffer.from(v),
      decrypt: (v) => v.toString(),
    });
    const service = new McpService(
      store,
      () => {},
      async () => {
        throw new Error("No browser should open");
      },
      () => plugins,
    );
    const original = globalThis.fetch;
    let figmaCalls = 0;
    let turn = 0;
    const modelRequests: any[] = [];
    try {
      globalThis.fetch = async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === FIGMA_DESKTOP_URL) {
          assert.ok(!new Headers(init?.headers).has("authorization"));
          if (init?.method !== "POST")
            return new Response(null, { status: 405 });
          const message = JSON.parse(String(init.body));
          if (message.id === undefined)
            return new Response(null, { status: 202 });
          let result;
          if (message.method === "initialize")
            result = {
              protocolVersion: message.params.protocolVersion,
              capabilities: { tools: {} },
              serverInfo: { name: "Figma desktop fixture", version: "1" },
            };
          else if (message.method === "tools/list")
            result = {
              tools: [
                {
                  name: "get_design_context",
                  description: "Read selected design",
                  inputSchema: {
                    type: "object",
                    properties: { nodeId: { type: "string" } },
                    required: ["nodeId"],
                  },
                },
              ],
            };
          else {
            figmaCalls++;
            result = {
              content: [
                {
                  type: "text",
                  text: "Fixture Figma design: Dashboard, 1440px, Inter, #161616",
                },
              ],
            };
          }
          return Response.json({ jsonrpc: "2.0", id: message.id, result });
        }
        if (url === "https://model.fixture.invalid/v1/chat/completions") {
          const request = JSON.parse(String(init?.body));
          modelRequests.push(request);
          turn++;
          assert.ok(
            !request.tools.some((tool: any) => "requiresApproval" in tool),
          );
          const toolName = request.tools.find((tool: any) =>
            tool.function.name.endsWith(
              turn === 1 ? "get_design_context" : "write_note",
            ),
          )?.function.name;
          const delta =
            turn <= 2
              ? {
                  tool_calls: [
                    {
                      index: 0,
                      id: `call${turn}`,
                      type: "function",
                      function: {
                        name: toolName,
                        arguments: JSON.stringify(
                          turn === 1
                            ? { nodeId: "1:2" }
                            : {
                                path: "Design/Dashboard.md",
                                content:
                                  "# Dashboard\n\nFigma fixture design notes.\n",
                              },
                        ),
                      },
                    },
                  ],
                }
              : { content: "Design notes saved." };
          return new Response(
            `data: ${JSON.stringify({ choices: [{ delta, finish_reason: turn <= 2 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
            { headers: { "Content-Type": "text/event-stream" } },
          );
        }
        throw new Error("Unexpected network destination");
      };
      const records = service.list(root);
      const obsidian = records.find((record) => record.builtin === "obsidian")!;
      const figma = records.find(
        (record) => record.key === "plugin-figma-figma",
      )!;
      assert.equal(figma.url, FIGMA_DESKTOP_URL);
      await service.chooseVault(obsidian.id, root, async () => folder);
      const events: AgentEvent[] = [];
      const agent = createConstAgent({
        preset: "harness",
        tools: [],
        baseUrl: "https://model.fixture.invalid/v1",
        apiKey: "fixture",
        model: "fixture",
        workspacePath: root,
        maxTurns: 3,
        mode: "ask_before_changes",
        externalTools: (signal) => service.tools(root, signal),
        externalToolHandler: (name, args, signal) =>
          service.execute(name, args, root, signal),
      });
      await agent.run(
        [
          {
            role: "user",
            content:
              "Read the selected Figma design and create an Obsidian note.",
          },
        ],
        (event) => {
          events.push(event);
          if (event.type === "approval_request")
            queueMicrotask(() =>
              agent.resolveApproval(event.approvalId!, {
                approvalId: event.approvalId!,
                decision: allow ? "allow_once" : "deny",
              }),
            );
        },
      );
      assert.equal(figmaCalls, allow ? 1 : 0);
      assert.equal(
        fs.existsSync(path.join(folder, "Design/Dashboard.md")),
        allow,
      );
      if (allow) {
        assert.ok(
          modelRequests[1].messages.some(
            (message: any) =>
              message.role === "tool" && message.content.includes("1440px"),
          ),
        );
        assert.match(
          fs.readFileSync(path.join(folder, "Design/Dashboard.md"), "utf8"),
          /Figma fixture/,
        );
        assert.equal(
          events.filter((event) => event.type === "approval_request").length,
          2,
        );
      }
      // Remote mode remains unavailable without the publisher's approved client.
      await service.save({
        ...figma,
        url: FIGMA_REMOTE_URL,
        auth: "oauth",
        scopes: "mcp:connect",
      });
      const remote = service
        .list(root)
        .find((record) => record.id === figma.id)!;
      assert.equal(remote.oauthClientRequired, true);
      await assert.rejects(service.authenticate(figma.id, root), /auth/);
    } finally {
      await service.invalidate();
      globalThis.fetch = original;
      if (
        path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) &&
        path.basename(root).startsWith("const-design-notes-chat-")
      )
        fs.rmSync(root, { recursive: true, force: true });
    }
  });
