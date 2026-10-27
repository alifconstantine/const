import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { atomicJson } from "./store";
import type { McpAppRef } from "../../src/lib/mcp/apps";

export interface StoredApp extends McpAppRef {
  connectionId: string;
  fingerprint: string;
  workspace: string;
  resourceUri: string;
  arguments: Record<string, unknown>;
  result: { content: any[]; structuredContent?: Record<string, unknown> };
  checkpointId?: string;
  kind?: "excalidraw";
  scene?: {
    elements: any[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
  };
  modelContext?: string;
}
export class McpAppsStore {
  constructor(private home: string) {}
  private file(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("invalid");
    return path.join(this.home, "mcp-apps", id + ".json");
  }
  get(id: string): StoredApp {
    const file = this.file(id);
    if (fs.statSync(file).size > 24_000_000) throw new Error("invalid");
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (value.id !== id || typeof value.workspace !== "string")
      throw new Error("invalid");
    return value;
  }
  save(app: StoredApp) {
    atomicJson(this.file(app.id), app);
  }
  create(input: Omit<StoredApp, "id" | "filePath">) {
    const id = randomUUID();
    const app = {
      ...input,
      id,
      filePath:
        input.kind === "excalidraw"
          ? path.join(
              input.workspace,
              "artifacts",
              "diagrams",
              id + ".excalidraw",
            )
          : undefined,
    };
    this.save(app);
    return app;
  }
  private artifact(app: StoredApp) {
    let parent = fs.realpathSync(app.workspace);
    for (const part of ["artifacts", "diagrams"]) {
      parent = path.join(parent, part);
      if (fs.existsSync(parent)) {
        if (
          fs.lstatSync(parent).isSymbolicLink() ||
          !fs.statSync(parent).isDirectory()
        )
          throw new Error("invalid");
      } else fs.mkdirSync(parent);
    }
    const target = path.join(parent, app.id + ".excalidraw");
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())
      throw new Error("invalid");
    return target;
  }
  saveScene(id: string, scene: StoredApp["scene"]) {
    if (
      !scene ||
      !Array.isArray(scene.elements) ||
      scene.elements.length > 10000 ||
      Buffer.byteLength(JSON.stringify(scene)) > 8_000_000
    )
      throw new Error("invalid");
    const app = this.get(id);
    if (!app.filePath || app.kind !== "excalidraw") throw new Error("invalid");
    for (const file of Object.values(scene.files ?? {})) {
      if (
        !file ||
        typeof file !== "object" ||
        typeof (file as any).dataURL !== "string" ||
        !/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[a-zA-Z0-9+/=\r\n]+$/.test(
          (file as any).dataURL,
        )
      )
        throw new Error("invalid");
    }
    const filePath = this.artifact(app);
    const clean = {
      elements: scene.elements,
      appState: {
        viewBackgroundColor:
          typeof scene.appState?.viewBackgroundColor === "string"
            ? scene.appState.viewBackgroundColor
            : "#ffffff",
      },
      files: scene.files ?? {},
    };
    atomicJson(filePath, {
      type: "excalidraw",
      version: 2,
      source: "Const Harness",
      ...clean,
      constMcpAppId: id,
    });
    this.save({ ...app, filePath, scene: clean });
    return filePath;
  }
  byPath(filePath: string) {
    const id = path.basename(filePath, ".excalidraw");
    const app = this.get(id);
    if (!app.filePath || path.resolve(app.filePath) !== path.resolve(filePath))
      throw new Error("invalid");
    const safe = this.artifact(app);
    if (!fs.existsSync(safe) || fs.statSync(safe).size > 8_000_000)
      throw new Error("invalid");
    const scene = JSON.parse(fs.readFileSync(safe, "utf8"));
    if (scene.type !== "excalidraw" || !Array.isArray(scene.elements))
      throw new Error("invalid");
    return { ...app, scene };
  }
}
