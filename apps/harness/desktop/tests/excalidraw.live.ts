import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readPluginManifest } from "@const/agent";
import { McpStore } from "../electron/mcp/store";
import { McpService } from "../electron/mcp/service";
import { messageApps } from "../src/lib/mcp/apps";

// Optional public-provider smoke test. Sends only this synthetic diagram, never account data.
async function main() {
  const output = process.argv[2];
  if (!output || !path.isAbsolute(output))
    throw new Error("Pass an absolute output JSON path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "const-excalidraw-live-"));
  const store = new McpStore(path.join(root, "home"), {
    encrypt: (v) => Buffer.from(v),
    decrypt: (v) => v.toString(),
  });
  const pluginPath = path.resolve("plugins/excalidraw");
  const plugin = {
    ...readPluginManifest(pluginPath),
    id: "excalidraw",
    path: pluginPath,
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
    const tools = await service.tools(root);
    console.log(
      JSON.stringify({
        tools: tools.map((t) => t.function.name.replace(/^mcp_[a-f0-9]+_/, "")),
      }),
    );
    const draw = tools.find((tool) =>
      tool.function.name.endsWith("create_view"),
    );
    if (!draw) throw new Error("Live create_view tool unavailable");
    const elements = [
      { type: "cameraUpdate", x: 0, y: 0, width: 800, height: 600 },
      {
        type: "rectangle",
        id: "chat",
        x: 65,
        y: 170,
        width: 190,
        height: 105,
        backgroundColor: "#dbe4ff",
        roundness: { type: 3 },
        label: { text: "Main Chat", fontSize: 24 },
      },
      {
        type: "rectangle",
        id: "editor",
        x: 490,
        y: 170,
        width: 230,
        height: 105,
        backgroundColor: "#d3f9d8",
        roundness: { type: 3 },
        label: { text: "Excalidraw", fontSize: 24 },
      },
      {
        type: "arrow",
        id: "flow",
        x: 270,
        y: 222,
        width: 200,
        height: 0,
        points: [
          [0, 0],
          [200, 0],
        ],
        endArrowhead: "arrow",
      },
      {
        type: "text",
        id: "caption",
        x: 145,
        y: 355,
        width: 500,
        height: 30,
        text: "Draw in chat. Edit in the sidepanel.",
        fontSize: 22,
      },
    ];
    const result = await service.execute(
      draw.function.name,
      { elements: JSON.stringify(elements) },
      root,
    );
    if (result.isError) throw new Error(result.result);
    const ref = messageApps({ toolCalls: [{ result: result.result }] })[0];
    if (!ref) throw new Error("Live server did not return MCP Apps metadata");
    const view = await service.appView(ref.id);
    fs.writeFileSync(output, JSON.stringify({ view, result: result.result }));
    console.log(
      JSON.stringify({
        success: true,
        resourceUri: view.resourceUri,
        htmlBytes: Buffer.byteLength(view.html),
        sceneElements: view.scene?.elements.length,
        output,
      }),
    );
  } finally {
    await service.invalidate();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
