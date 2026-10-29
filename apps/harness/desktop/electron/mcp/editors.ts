import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolResultSchema,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpConnection, McpToolInfo } from "../../src/lib/mcp/types";
import {
  isEditorApp,
  EDITORS,
  type EditorApp,
} from "../../src/lib/mcp/editors";
import { EditorSetup, runEditorProcess } from "./editor-setup";

export function editorApp(record: McpConnection): EditorApp | undefined {
  return record.transport === "builtin" &&
    record.builtin === "editor" &&
    isEditorApp(record.editorApp) &&
    record.key === `plugin-${record.editorApp}-editor`
    ? record.editorApp
    : undefined;
}
function canonical(file: string) {
  const resolved = fs.realpathSync(file);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
export function editorProject(
  record: McpConnection,
  workspace?: string,
): string {
  const app = editorApp(record);
  if (!app || !workspace || !path.isAbsolute(workspace))
    throw new Error("editor_project");
  const root = canonical(workspace);
  let project = record.editorProjectPath ?? root;
  try {
    project = canonical(project);
    const relative = path.relative(root, project);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      throw new Error("editor_project");
    if (app === "blender") {
      if (
        !fs.statSync(project).isFile() ||
        path.extname(project).toLowerCase() !== ".blend"
      )
        throw new Error("editor_project");
    } else if (app === "godot") {
      if (!fs.statSync(path.join(project, "project.godot")).isFile())
        throw new Error("editor_project");
    } else if (app === "unity") {
      if (
        !fs.statSync(path.join(project, "Assets")).isDirectory() ||
        !fs.statSync(path.join(project, "Packages", "manifest.json")).isFile()
      )
        throw new Error("editor_project");
    } else {
      if (
        !fs.statSync(project).isFile() ||
        path.extname(project).toLowerCase() !== ".uproject"
      ) {
        const projects = fs
          .readdirSync(project)
          .filter((file) => file.endsWith(".uproject"));
        if (projects.length !== 1) throw new Error("editor_project");
        project = canonical(path.join(project, projects[0]!));
      }
      if (!fs.statSync(project).isFile()) throw new Error("editor_project");
    }
    const finalRelative = path.relative(root, project);
    if (
      finalRelative === ".." ||
      finalRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(finalRelative)
    )
      throw new Error("editor_project");
    return project;
  } catch {
    throw new Error("editor_project");
  }
}

export const EDITOR_GATEWAYS: McpToolInfo[] = [
  {
    name: "discover_tools",
    readOnly: false,
    description:
      "Connect to the selected live editor project and find its real MCP tools by action. Inspect inputSchema before using call_tool. This controls the user's open editor, shared by chats. Save before major changes. Rendered images can be shown in Main Chat; link confirmed exports with absolute file paths. For Godot activate on-demand groups through its native discover_tools, then rediscover their tools here. For Unreal first discover list_toolsets/describe_toolset, then dispatch through its native call_tool.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "call_tool",
    readOnly: false,
    description:
      "Run an exact tool from this editor's discover_tools using arguments matching its schema. The open project is checked before dispatch. State is shared across chats; calls are serialized. A failed or cancelled write may have completed: inspect in the editor before reconnecting or retrying. Explicitly save native projects and exports. Do not claim an embedded 3D viewport or a saved file without confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        toolName: { type: "string" },
        arguments: { type: "object", additionalProperties: true },
      },
      required: ["toolName", "arguments"],
      additionalProperties: false,
    },
  },
];

interface EditorSession {
  client: Client;
  transport: Transport;
  project: string;
  app: EditorApp;
  tools: McpToolInfo[];
  users: Set<string>;
  closed: boolean;
  uncertain: boolean;
  verified: boolean;
  endpoint: string;
}
type TransportFactory = (
  app: EditorApp,
  record: McpConnection,
  project: string,
) => Transport;
type Result = ReturnType<typeof CallToolResultSchema.parse>;

/** Gate the real editor, not just its MCP handshake. Each dispatch checks project identity again. */
export class EditorRuntimeManager {
  readonly setup: EditorSetup;
  private sessions = new Map<string, EditorSession>();
  private pending = new Map<
    string,
    { id: string; controller: AbortController; promise: Promise<EditorSession> }
  >();
  private tails = new Map<string, Promise<unknown>>();
  private epochs = new Map<string, number>();
  private generation = 0;
  private uncertainEndpoints = new Set<string>();
  constructor(
    home: string,
    private readonly factory?: TransportFactory,
    private readonly unityStatus?: (
      project: string,
      signal?: AbortSignal,
    ) => Promise<unknown>,
  ) {
    this.setup = new EditorSetup(home);
  }
  connected(record: McpConnection, workspace?: string) {
    try {
      const app = editorApp(record)!;
      const project = editorProject(record, workspace);
      const session = this.sessions.get(
        `${this.endpoint(app, record, project)}:${project}`,
      );
      return (
        !!session &&
        session.verified &&
        !session.closed &&
        !this.uncertainEndpoints.has(session.endpoint)
      );
    } catch {
      return false;
    }
  }
  tools(record: McpConnection, workspace?: string): McpToolInfo[] {
    if (!this.connected(record, workspace)) return [];
    const app = editorApp(record)!;
    const project = editorProject(record, workspace);
    return (
      this.sessions.get(`${this.endpoint(app, record, project)}:${project}`)
        ?.tools ?? []
    );
  }
  private endpoint(app: EditorApp, record: McpConnection, project: string) {
    // Even different projects must share one queue when they address the same physical Blender/UE endpoint.
    return app === "blender" || app === "unreal"
      ? `${app}:${record.editorPort ?? EDITORS[app].port}`
      : `${app}:${project}`;
  }
  private async serialized<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const job = (this.tails.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(operation);
    this.tails.set(key, job);
    try {
      return await job;
    } finally {
      if (this.tails.get(key) === job) this.tails.delete(key);
    }
  }
  private transport(
    app: EditorApp,
    record: McpConnection,
    project: string,
  ): Transport {
    if (this.factory) return this.factory(app, record, project);
    if (app === "unreal")
      return new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${record.editorPort ?? 8000}/mcp`),
      );
    const launch = this.setup.paths(app);
    const env = getDefaultEnvironment();
    const args = [...launch.args];
    if (app === "blender") {
      env.BLENDER_MCP_HOST = "127.0.0.1";
      env.BLENDER_MCP_PORT = String(record.editorPort ?? 9876);
    } else if (app === "godot") env.GODOT_MCP_PROJECT_PATH = project;
    else args.push("mcp", "--project-path", project);
    return new StdioClientTransport({
      command: launch.command,
      args,
      cwd: app === "blender" ? launch.cwd : project,
      env,
      stderr: "ignore",
    });
  }
  private async catalog(
    session: EditorSession,
    record: McpConnection,
    signal?: AbortSignal,
  ) {
    const tools: McpToolInfo[] = [];
    let cursor: string | undefined;
    const cursors = new Set<string>();
    do {
      const page = await session.client.listTools(cursor ? { cursor } : {}, {
        signal,
        timeout: record.timeoutMs,
      });
      for (const tool of page.tools) {
        // This connection targets the live editor. Offline variants require a separate
        // Blender executable configuration and duplicate the live tools' capabilities.
        if (session.app === "blender" && tool.name.endsWith("_for_cli"))
          continue;
        tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          readOnly: tool.annotations?.readOnlyHint === true,
        });
      }
      cursor = page.nextCursor;
      if (tools.length > 2000 || (cursor && cursors.has(cursor)))
        throw new Error("connection");
      if (cursor) cursors.add(cursor);
    } while (cursor);
    session.tools = tools;
  }
  private async session(record: McpConnection, workspace: string) {
    const app = editorApp(record);
    if (!app) throw new Error("invalid");
    const project = editorProject(record, workspace);
    const key = `${this.endpoint(app, record, project)}:${project}`;
    const existing = this.sessions.get(key);
    if (existing) {
      if (existing.closed || existing.uncertain) throw new Error("connection");
      existing.users.add(record.id);
      return existing;
    }
    const pending = this.pending.get(key);
    if (pending) {
      const shared = await pending.promise;
      shared.users.add(record.id);
      return shared;
    }
    if (this.sessions.size + this.pending.size >= 12) throw new Error("busy");
    const epoch = this.epochs.get(record.id) ?? 0;
    const controller = new AbortController();
    const promise = (async () => {
      const transport = this.transport(app, record, project);
      const client = new Client({ name: "const-harness", version: "1.0.0" });
      const session: EditorSession = {
        client,
        transport,
        project,
        app,
        tools: [],
        users: new Set([record.id]),
        closed: false,
        uncertain: false,
        verified: false,
        endpoint: this.endpoint(app, record, project),
      };
      try {
        await client.connect(transport, {
          timeout: record.timeoutMs,
          signal: controller.signal,
        });
        await this.catalog(session, record, controller.signal);
        controller.signal.throwIfAborted();
        if (epoch !== (this.epochs.get(record.id) ?? 0))
          throw new Error("invalid");
        client.onclose = () => {
          session.closed = true;
        };
        // Refresh on every gateway too. Notifications do not race a running serialized write.
        client.setNotificationHandler(
          ToolListChangedNotificationSchema,
          () => {},
        );
        this.sessions.set(key, session);
        return session;
      } catch (error) {
        await client.close().catch(() => {});
        await transport.close().catch(() => {});
        throw error;
      }
    })();
    this.pending.set(key, { id: record.id, controller, promise });
    try {
      return await promise;
    } finally {
      if (this.pending.get(key)?.promise === promise) this.pending.delete(key);
    }
  }
  private async call(
    session: EditorSession,
    record: McpConnection,
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    return CallToolResultSchema.parse(
      await session.client.callTool({ name, arguments: args }, undefined, {
        timeout: record.timeoutMs,
        signal,
      }),
    );
  }
  private async ready(
    session: EditorSession,
    record: McpConnection,
    signal?: AbortSignal,
  ) {
    let result: Result;
    if (session.app === "blender") {
      result = await this.call(
        session,
        record,
        "execute_blender_code",
        {
          code: 'import bpy\nresult = {"const_harness_project": bpy.data.filepath}',
        },
        signal,
      );
      if (result.isError) throw new Error("editor_wait");
      const project = findProject(result);
      if (!project || canonical(project) !== session.project)
        throw new Error("editor_project");
    } else if (session.app === "godot") {
      // The bridge authenticates with a per-project token and refuses another project's editor.
      result = await this.call(
        session,
        record,
        "project_get_settings",
        { prefix: "application/config/name" },
        signal,
      );
    } else if (session.app === "unity") {
      if (
        session.tools.length === 0 ||
        session.tools.every((tool) => tool.name === "unity-cli-status")
      )
        throw new Error("editor_wait");
      try {
        const status = this.unityStatus
          ? await this.unityStatus(session.project, signal)
          : JSON.parse(
              await runEditorProcess(
                this.setup.paths("unity").command,
                [
                  "status",
                  "--project-path",
                  session.project,
                  "--format",
                  "json",
                ],
                {
                  signal,
                  cwd: session.project,
                  env: getDefaultEnvironment(),
                  timeout: 30_000,
                },
              ),
            );
        if (!unityProjectReady(status, session.project))
          throw new Error("editor_wait");
      } catch {
        throw new Error("editor_wait");
      }
      return;
    } else {
      result = await this.call(
        session,
        record,
        "call_tool",
        {
          toolset_name: "ConstHarnessContext",
          tool_name: "project_file",
          arguments: {},
        },
        signal,
      );
      const project = findProject(result);
      if (!project || canonical(project) !== session.project)
        throw new Error("editor_project");
    }
    if (result.isError) throw new Error("editor_wait");
  }
  async execute(
    record: McpConnection,
    workspace: string,
    gateway: string,
    args: Record<string, unknown>,
    signal: AbortSignal | undefined,
    authorize: () => void,
  ): Promise<Result> {
    const app = editorApp(record);
    if (!app) throw new Error("invalid");
    const project = editorProject(record, workspace);
    const epoch = this.epochs.get(record.id) ?? 0;
    const generation = this.generation;
    signal?.throwIfAborted();
    authorize();
    const operation = this.serialized(
      this.endpoint(app, record, project),
      async (): Promise<Result> => {
        signal?.throwIfAborted();
        authorize();
        if (this.uncertainEndpoints.has(this.endpoint(app, record, project)))
          throw new Error("connection");
        if (
          generation !== this.generation ||
          epoch !== (this.epochs.get(record.id) ?? 0)
        )
          throw new Error("invalid");
        const session = await this.session(record, workspace);
        signal?.throwIfAborted();
        session.verified = false;
        await this.catalog(session, record, signal);
        await this.ready(session, record, signal);
        session.verified = true;
        authorize();
        if (
          generation !== this.generation ||
          epoch !== (this.epochs.get(record.id) ?? 0) ||
          session.closed
        )
          throw new Error("invalid");
        if (gateway === "discover_tools") {
          if (
            (args.query !== undefined &&
              (typeof args.query !== "string" || args.query.length > 1000)) ||
            (args.limit !== undefined &&
              (!Number.isInteger(args.limit) ||
                Number(args.limit) < 1 ||
                Number(args.limit) > 20))
          )
            throw new Error("invalid");
          const words = String(args.query ?? "")
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
          const tools = session.tools
            .map((tool) => ({
              tool,
              score: words.filter((word) =>
                `${tool.name} ${tool.description}`.toLowerCase().includes(word),
              ).length,
            }))
            .filter((item) => !words.length || item.score)
            .sort((a, b) => b.score - a.score)
            .slice(0, Number(args.limit ?? 8))
            .map((item) => item.tool);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  app,
                  project,
                  editor: session.client.getServerVersion(),
                  sharedLiveEditor: true,
                  tools,
                }),
              },
            ],
          };
        }
        if (
          gateway !== "call_tool" ||
          typeof args.toolName !== "string" ||
          !session.tools.some((tool) => tool.name === args.toolName) ||
          !args.arguments ||
          typeof args.arguments !== "object" ||
          Array.isArray(args.arguments)
        )
          throw new Error("invalid");
        try {
          return await this.call(
            session,
            record,
            args.toolName,
            args.arguments as Record<string, unknown>,
            signal,
          );
        } catch (error) {
          // A timeout/cancellation is not proof that a live editor mutation rolled back.
          session.uncertain = true;
          this.uncertainEndpoints.add(session.endpoint);
          throw error;
        }
      },
    );
    if (!signal) return operation;
    let onAbort: (() => void) | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(signal.reason ?? new Error("connection"));
          signal.addEventListener("abort", onAbort, { once: true });
          if (signal.aborted) onAbort();
        }),
      ]);
    } finally {
      if (onAbort) signal.removeEventListener("abort", onAbort);
    }
  }
  async probe(record: McpConnection, workspace: string, authorize: () => void) {
    await this.execute(
      record,
      workspace,
      "discover_tools",
      {},
      undefined,
      authorize,
    );
    return this.session(record, workspace);
  }
  async disconnect(id: string) {
    this.epochs.set(id, (this.epochs.get(id) ?? 0) + 1);
    const pending = [...this.pending.values()].filter((job) => job.id === id);
    for (const job of pending) job.controller.abort();
    const sessions = [...this.sessions.entries()].filter(([, session]) =>
      session.users.has(id),
    );
    for (const [key, session] of sessions) {
      session.closed = true;
      this.uncertainEndpoints.delete(session.endpoint);
      this.sessions.delete(key);
    }
    await Promise.allSettled([
      ...pending.map((job) => job.promise),
      ...sessions.map(async ([, session]) => {
        await session.client.close();
        await session.transport.close();
      }),
    ]);
  }
  async close() {
    this.generation++;
    await Promise.allSettled(
      [
        ...new Set(
          [...this.sessions.values()]
            .flatMap((session) => [...session.users])
            .concat([...this.pending.values()].map((job) => job.id)),
        ),
      ].map((id) => this.disconnect(id)),
    );
  }
}

/** Parse only our fixed read-only probe's identity, not arbitrary strings resembling local paths. */
export function findProject(result: unknown, depth = 0): string | undefined {
  if (depth > 10) return;
  if (typeof result === "string") {
    if (result.startsWith("const-harness-project:"))
      return result.slice("const-harness-project:".length);
    try {
      return findProject(JSON.parse(result), depth + 1);
    } catch {
      return;
    }
  }
  if (!result || typeof result !== "object") return;
  if (
    "const_harness_project" in result &&
    typeof result.const_harness_project === "string"
  )
    return result.const_harness_project;
  for (const value of Object.values(result)) {
    const project = findProject(value, depth + 1);
    if (project) return project;
  }
}

export function unityProjectReady(raw: unknown, project: string): boolean {
  const status = raw as {
    success?: boolean;
    data?: {
      instances?: { projectPath?: string; project?: string; state?: string }[];
    };
  };
  return (
    status?.success === true &&
    Array.isArray(status.data?.instances) &&
    status.data.instances.some((instance) => {
      try {
        return (
          instance.state === "ready" &&
          canonical(instance.projectPath ?? instance.project ?? "") ===
            canonical(project)
        );
      } catch {
        return false;
      }
    })
  );
}
