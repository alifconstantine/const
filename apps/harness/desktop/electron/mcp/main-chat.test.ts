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
import { createGoogleMcpHandler } from "../../../../accounts/src/lib/google-mcp";
import {
  GOOGLE_CONNECTORS,
  GOOGLE_IDENTITY_SCOPES,
  GOOGLE_MCP_ORIGIN,
} from "../../../shared/google-connectors";
import { McpService, exposedToolName } from "./service";
import { McpStore } from "./store";
import { GITHUB_MCP_URL } from "./github-oauth";

// The real chat loop, approval engine, MCP SDK, and Google REST adapter run here.
// Only model/provider responses and encrypted storage are fixtures; no real accounts are accessed.
for (const mode of [
  "ask_before_changes",
  "full_access",
  "deny",
  "deferred",
] as const) {
  test(`Main Chat discovers and calls GitHub, Canva and seven Google plugins (${mode})`, async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "const-main-chat-mcp-"));
    const store = new McpStore(path.join(home, "vault"), {
      encrypt: (value) => Buffer.from(value).reverse(),
      decrypt: (value) => Buffer.from(value).reverse().toString(),
    });
    const names = [
      "github",
      "canva",
      ...Object.values(GOOGLE_CONNECTORS).map((c) => c.plugin),
    ];
    const plugins = names.map((name) => {
      const root = fileURLToPath(
        new URL(`../../plugins/${name}/`, import.meta.url),
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
    const realFetch = globalThis.fetch;
    const executed: string[] = [];
    const modelRequests: Record<string, any>[] = [];
    let plan: { name: string; args: object }[] = [];
    const google = createGoogleMcpHandler({
      fetch: async (input, init) => {
        assert.equal(
          new Headers(init?.headers).get("authorization"),
          "Bearer fixture-google",
        );
        if (String(input).includes("/userinfo"))
          return Response.json({ sub: "fixture-google-user" });
        executed.push(String(input));
        return Response.json({
          id: "fixture-resource",
          title: "Main Chat audit fixture",
          success: true,
        });
      },
    });
    const fixtureMcp = async (provider: string, init: RequestInit = {}) => {
      assert.equal(
        new Headers(init.headers).get("authorization"),
        `Bearer fixture-${provider}`,
      );
      if (init.method !== "POST") return new Response(null, { status: 405 });
      const message = JSON.parse(String(init.body));
      if (message.id === undefined) return new Response(null, { status: 202 });
      const result =
        message.method === "initialize"
          ? {
              protocolVersion: message.params.protocolVersion,
              capabilities: { tools: {} },
              serverInfo: { name: provider, version: "1.0" },
            }
          : message.method === "tools/list"
            ? {
                tools: [
                  {
                    name:
                      provider === "github"
                        ? "search_repositories"
                        : "search_designs",
                    description: `Search ${provider}`,
                    inputSchema: {
                      type: "object",
                      properties: { query: { type: "string" } },
                      required: ["query"],
                    },
                  },
                  ...(mode === "deferred" && provider === "github"
                    ? Array.from({ length: 70 }, (_, i) => ({
                        name: `extra_fixture_${i}`,
                        description: "Additional discovered GitHub tool",
                        inputSchema: { type: "object" },
                      }))
                    : []),
                ],
              }
            : {
                content: [
                  { type: "text", text: `${provider} fixture results` },
                ],
              };
      if (message.method === "tools/call") executed.push(provider);
      return Response.json({ jsonrpc: "2.0", id: message.id, result });
    };
    globalThis.fetch = async (input, init) => {
      const address = input instanceof Request ? input.url : String(input);
      if (address.startsWith(GITHUB_MCP_URL)) return fixtureMcp("github", init);
      if (address.startsWith("https://mcp.canva.com/mcp"))
        return fixtureMcp("canva", init);
      if (address.startsWith(GOOGLE_MCP_ORIGIN + "/mcp/google/"))
        return google(
          new Request(address, init),
          new URL(address).pathname.split("/").at(-1)!,
        );
      if (address === "https://model.fixture.invalid/v1/chat/completions") {
        const request = JSON.parse(String(init?.body));
        modelRequests.push(request);
        if (mode === "deferred") {
          assert.ok(request.tools.length <= 128);
          assert.ok(
            request.tools.some(
              (t: any) => t.function.name === "mcp_search_tools",
            ),
          );
          assert.ok(
            request.tools.some((t: any) => t.function.name === "mcp_call_tool"),
          );
          assert.ok(
            !request.tools.some((t: any) => t.function.name === plan[3]!.name),
          );
          let delta;
          if (modelRequests.length === 1)
            delta = {
              tool_calls: [
                {
                  index: 0,
                  id: "search",
                  type: "function",
                  function: {
                    name: "mcp_search_tools",
                    arguments: JSON.stringify({
                      query: "Google Docs create_document",
                      limit: 5,
                    }),
                  },
                },
              ],
            };
          else if (modelRequests.length === 2) {
            const result = request.messages.findLast(
              (m: any) => m.role === "tool",
            );
            const discovered = JSON.parse(result.content);
            assert.ok(
              discovered.tools.some(
                (t: any) =>
                  t.toolName === plan[3]!.name &&
                  t.inputSchema.required.includes("title"),
              ),
            );
            delta = {
              tool_calls: [
                {
                  index: 0,
                  id: "call",
                  type: "function",
                  function: {
                    name: "mcp_call_tool",
                    arguments: JSON.stringify({
                      toolName: plan[3]!.name,
                      arguments: plan[3]!.args,
                    }),
                  },
                },
              ],
            };
          } else delta = { content: "Audit completed using connected tools." };
          return new Response(
            `data: ${JSON.stringify({ choices: [{ delta, finish_reason: modelRequests.length < 3 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
            { headers: { "Content-Type": "text/event-stream" } },
          );
        }
        if (modelRequests.length === 1) {
          for (const call of plan)
            assert.ok(
              request.tools.some((t: any) => t.function.name === call.name),
            );
          assert.ok(
            request.tools.every(
              (t: any) => !Object.hasOwn(t, "requiresApproval"),
            ),
          );
          assert.ok(
            request.tools.every((t: any) => t.function.name.startsWith("mcp_")),
          );
        }
        const delta =
          modelRequests.length === 1
            ? {
                tool_calls: plan.map((call, index) => ({
                  index,
                  id: `call_${index}`,
                  type: "function",
                  function: {
                    name: call.name,
                    arguments: JSON.stringify(call.args),
                  },
                })),
              }
            : { content: "Audit completed using connected tools." };
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta, finish_reason: modelRequests.length === 1 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }
      throw new Error(
        "Unexpected network destination in chat audit: " +
          new URL(address).origin,
      );
    };
    const service = new McpService(
      store,
      () => {},
      async () => {
        throw new Error("Browser consent is covered separately");
      },
      () => plugins,
    );
    try {
      const records = service.list();
      const scopes = [
        ...new Set([
          ...GOOGLE_IDENTITY_SCOPES,
          ...Object.values(GOOGLE_CONNECTORS).flatMap((c) => [...c.scopes]),
        ]),
      ].sort();
      for (const record of records) {
        if (record.managedOAuth === "google") {
          const { GoogleOAuthClient } = await import("./google-oauth");
          const accountId = new GoogleOAuthClient(store).accountId(record);
          store.writeSecrets(accountId, {
            tokens: {
              access_token: "fixture-google",
              token_type: "Bearer",
              refresh_token: "fixture-refresh",
            },
            googleOAuth: {
              grant: "fixture-receipt",
              expiresAt: Date.now() + 3600000,
              subject: "fixture-subject",
              scopes,
            },
          });
          store.writeSecrets(record.id, { googleAccountId: accountId });
        } else
          store.writeSecrets(record.id, {
            tokens: {
              access_token:
                record.managedOAuth === "github"
                  ? "fixture-github"
                  : "fixture-canva",
              token_type: "Bearer",
            },
          });
      }
      const operations: Record<string, [string, object]> = {
        github: ["search_repositories", { query: "fixture" }],
        canva: ["search_designs", { query: "fixture" }],
        "google-drive": ["list_files", {}],
        "google-docs": [
          "create_document",
          { title: "Main Chat audit fixture" },
        ],
        "google-sheets": [
          "get_values",
          { spreadsheetId: "fixture-sheet", range: "A1" },
        ],
        "google-slides": [
          "get_presentation",
          { presentationId: "fixture-deck" },
        ],
        gmail: ["list_messages", { q: "in:inbox" }],
        "google-calendar": ["list_events", { calendarId: "primary" }],
        "google-classroom": ["list_courses", {}],
      };
      plan = records.map((record) => {
        const plugin = plugins.find((p) => p.id === record.pluginId)!;
        const [tool, args] = operations[plugin.name]!;
        return { name: exposedToolName(record.id, tool), args };
      });
      const agent = createConstAgent({
        preset: "harness",
        baseUrl: "https://model.fixture.invalid/v1",
        apiKey: "fixture",
        model: "fixture-model",
        workspacePath: home,
        ...(mode === "deferred" ? {} : { tools: [] }),
        mode:
          mode === "deny" || mode === "deferred" ? "ask_before_changes" : mode,
        maxTurns: mode === "deferred" ? 3 : 2,
        externalTools: (signal) => service.tools(home, signal),
        externalToolHandler: (name, args, signal) =>
          service.execute(name, args, home, signal),
      });
      const events: AgentEvent[] = [];
      const history = await agent.run(
        [
          {
            role: "user",
            content:
              "Audit the connected GitHub, Canva and Google apps using fixture data.",
          },
        ],
        (event) => {
          events.push(event);
          if (event.type === "approval_request")
            queueMicrotask(() =>
              agent.resolveApproval(event.approvalId!, {
                approvalId: event.approvalId!,
                decision: mode === "deny" ? "deny" : "allow_once",
              }),
            );
        },
      );
      assert.equal(
        history.at(-1)?.content,
        "Audit completed using connected tools.",
      );
      if (mode === "deferred") {
        assert.equal(modelRequests.length, 3);
        assert.equal(modelRequests[0]!.tools.length, 66);
        assert.equal(executed.length, 1);
        assert.equal(
          events.filter((e) => e.type === "approval_request").length,
          1,
        );
        assert.equal(
          events.filter((e) => e.type === "tool_result" && !e.isError).length,
          2,
        );
        assert.ok(
          modelRequests[2]!.messages.some(
            (m: any) =>
              m.role === "tool" &&
              m.content.includes("Main Chat audit fixture"),
          ),
        );
        return;
      }
      assert.equal(modelRequests.length, 2);
      assert.equal(
        modelRequests[1]!.messages.filter((m: any) => m.role === "tool").length,
        9,
      );
      assert.equal(
        events.filter((e) => e.type === "approval_request").length,
        mode === "deny" ? 1 : mode === "full_access" ? 0 : 9,
      );
      assert.equal(executed.length, mode === "deny" ? 0 : 9);
      if (mode !== "deny") {
        assert.equal(
          events.filter((e) => e.type === "tool_result" && !e.isError).length,
          9,
        );
        assert.ok(
          modelRequests[1]!.messages.some(
            (m: any) =>
              m.role === "tool" &&
              m.content.includes("Main Chat audit fixture"),
          ),
        );
      }
    } finally {
      await service.invalidate();
      globalThis.fetch = realFetch;
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
}
