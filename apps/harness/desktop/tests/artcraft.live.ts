/** Opt-in real-binary checks. Set CONST_ARTCRAFT_RUNTIMES to extracted official portable releases. */
import fs from "node:fs";
import path from "node:path";
import { ArtcraftRuntimeManager } from "../electron/mcp/artcraft";
import { ARTCRAFT_APPS, ARTCRAFT_IDS } from "../src/lib/mcp/artcraft";
import type { McpConnection } from "../src/lib/mcp/types";
import { verifyArtcraftWorkflow } from "./artcraft-workflows";
import assert from "node:assert/strict";

async function main() {
  const root = process.env.CONST_ARTCRAFT_RUNTIMES;
  if (!root || !path.isAbsolute(root))
    throw new Error(
      "Set CONST_ARTCRAFT_RUNTIMES to an absolute folder containing app portable releases.",
    );
  const output = path.join(root, "validation");
  fs.mkdirSync(output, { recursive: true });
  const manager = new ArtcraftRuntimeManager();
  const results: unknown[] = [];
  const conversation = `live-check-${Date.now()}`;
  try {
    for (const app of ARTCRAFT_IDS) {
      const portable = fs
        .readdirSync(path.join(root, app))
        .find((name) => name.includes("portable"));
      const runtime = path.join(root, app, portable ?? "", `${app}-cli.exe`);
      const workspace = path.join(output, app);
      fs.mkdirSync(workspace, { recursive: true });
      const record: McpConnection = {
        id: app,
        key: `plugin-${app}-engine`,
        name: ARTCRAFT_APPS[app].name,
        scope: "user",
        transport: "builtin",
        builtin: "artcraft",
        artcraftApp: app,
        runtimePath: runtime,
        auth: "none",
        enabled: true,
        localFileAccess: true,
        timeoutMs: 60_000,
      };
      try {
        const session = await manager.connect(
          record,
          app,
          workspace,
          conversation,
        );
        fs.writeFileSync(
          path.join(output, `${app}-tools.json`),
          JSON.stringify(session.tools, null, 2),
        );
        if (process.env.CONST_ARTCRAFT_INSPECT === "1") {
          const toolName = session.tools.some(
            (tool) => tool.name === "command_list",
          )
            ? "command_list"
            : "list_commands";
          const response = await session.client.callTool({
            name: toolName,
            arguments: {},
          });
          fs.writeFileSync(
            path.join(output, `${app}-commands.json`),
            JSON.stringify(response, null, 2),
          );
        }
        const result = {
          app,
          version: session.client.getServerVersion(),
          tools: session.tools.length,
          output: session.output,
        };
        if (process.env.CONST_ARTCRAFT_WORKFLOWS === "1") {
          const calls: unknown[] = [];
          try {
            const workflow = await verifyArtcraftWorkflow(
              app,
              session.output,
              async (toolName, args = {}) => {
                const response = await manager.execute(
                  record,
                  app,
                  workspace,
                  conversation,
                  "call_tool",
                  { toolName, arguments: args },
                  undefined,
                  () => {},
                );
                const text = response.content
                  .filter((block) => block.type === "text")
                  .map((block) => block.text)
                  .join("\n");
                calls.push({
                  toolName,
                  args,
                  text: text.slice(0, 10_000),
                  isError: "isError" in response && response.isError,
                });
                if ("isError" in response && response.isError)
                  throw new Error(`${toolName}: ${text}`);
                let parsed: any;
                try {
                  parsed = JSON.parse(text);
                } catch {
                  parsed = text;
                }
                if (parsed?.ok === false)
                  throw new Error(`${toolName}: ${text}`);
                return parsed;
              },
              output,
            );
            Object.assign(result, { workflow });
            if (app === "lightcraft") {
              await manager.disconnect(app);
              const reopened = await manager.connect(
                record,
                app,
                workspace,
                conversation,
              );
              const state = await reopened.client.callTool({
                name: "get_develop",
                arguments: {},
              });
              assert.match(JSON.stringify(state), /0\.25/);
            }
            console.log(app + " workflow passed");
          } finally {
            fs.writeFileSync(
              path.join(output, `${app}-workflow.json`),
              JSON.stringify(calls, null, 2),
            );
          }
        }
        results.push(result);
        console.log(JSON.stringify(result));
      } catch (error) {
        results.push({ app, error: String(error) });
        process.exitCode = 1;
        console.error(app, String(error));
      } finally {
        await manager.disconnect(app);
      }
    }
  } finally {
    await manager.close();
    fs.writeFileSync(
      path.join(output, "inventory.json"),
      JSON.stringify(results, null, 2),
    );
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
