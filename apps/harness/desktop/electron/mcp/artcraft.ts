import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpConnection, McpToolInfo } from "../../src/lib/mcp/types";
import {
  ARTCRAFT_APPS,
  isArtCraftApp,
  type ArtCraftApp,
} from "../../src/lib/mcp/artcraft";

export function artcraftApp(record: McpConnection): ArtCraftApp | undefined {
  return record.transport === "builtin" &&
    record.builtin === "artcraft" &&
    isArtCraftApp(record.artcraftApp) &&
    record.key === `plugin-${record.artcraftApp}-engine`
    ? record.artcraftApp
    : undefined;
}

/** Only resolve native executables. Do not run shells, downloaded code, or a PATH command probe. */
export function findArtcraftRuntime(
  app: ArtCraftApp,
  selected?: string,
): string | undefined {
  const binary = `${app}-cli${process.platform === "win32" ? ".exe" : ""}`;
  const name = ARTCRAFT_APPS[app].name;
  const candidates = selected
    ? [selected]
    : [
        ...[
          process.env.LOCALAPPDATA,
          process.env.ProgramFiles,
          process.env["ProgramFiles(x86)"],
        ]
          .filter((v): v is string => !!v)
          .flatMap((base) => [
            path.join(base, "Programs", "ArtCraft", name, binary),
            path.join(base, "ArtCraft", name, binary),
          ]),
        path.join("/Applications", `${name}.app`, "Contents", "MacOS", binary),
        path.join(
          os.homedir(),
          "Applications",
          `${name}.app`,
          "Contents",
          "MacOS",
          binary,
        ),
        ...[
          "/usr/local/bin",
          "/opt/homebrew/bin",
          "/usr/bin",
          path.join(os.homedir(), ".local", "bin"),
          ...(process.env.PATH ?? "").split(path.delimiter),
        ]
          .filter((dir) => dir && path.isAbsolute(dir))
          .map((dir) => path.join(dir, binary)),
      ];
  for (const candidate of candidates) {
    try {
      if (
        !path.isAbsolute(candidate) ||
        path.basename(candidate).toLowerCase() !== binary
      )
        continue;
      if (fs.statSync(candidate).isFile()) {
        fs.accessSync(
          candidate,
          process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK,
        );
        return fs.realpathSync(candidate);
      }
    } catch {
      /* Try the next official location. */
    }
  }
  return undefined;
}

export function artcraftLaunch(
  app: ArtCraftApp,
  workspace: string,
  session: string,
) {
  const root = fs.realpathSync(workspace);
  if (!fs.statSync(root).isDirectory()) throw new Error("runtime");
  // Separate persistent output/library folders as well as separate in-memory engines.
  const token = createHash("sha256").update(session).digest("hex").slice(0, 20);
  let output = root;
  for (const segment of ["artifacts", app, token]) {
    output = path.join(output, segment);
    if (!fs.existsSync(output)) fs.mkdirSync(output);
    const stat = fs.lstatSync(output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("runtime");
  }
  const resolved = fs.realpathSync(output);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("runtime");
  const args = ["mcp"];
  if (app === "vectorcraft") args.push("--headless");
  if (ARTCRAFT_APPS[app].roots)
    args.push(
      "--automation-read-root",
      root,
      "--automation-write-root",
      resolved,
    );
  if (app === "lightcraft")
    args.push("--library", path.join(resolved, "library"));
  if (app === "filmcraft") args.push("--data-dir", path.join(resolved, "data"));
  return { args, cwd: resolved, output: resolved, workspace: root };
}

export const ARTCRAFT_GATEWAYS: McpToolInfo[] = [
  {
    name: "discover_tools",
    readOnly: false,
    description:
      "Start this app's local headless engine for the current chat and find its real MCP tools. Search by action; inspect returned inputSchema, then use call_tool. No GUI or account is required. Files persist in the returned outputDirectory; save native files explicitly before disconnecting. This engine does not control the desktop window. A failed write may have succeeded: inspect before retrying.",
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
      "Call an exact tool returned by this app's discover_tools with arguments matching its inputSchema. Uses the same app + workspace + chat engine. Use absolute paths in outputDirectory for saves/exports; link saved files for previews in Main Chat. Do not claim a native editor is embedded or a file saved until the tool confirms it. Never repeat an uncertain write without inspecting state.",
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

interface Session {
  client: Client;
  transport: Transport;
  fingerprint: string;
  tools: McpToolInfo[];
  recordId: string;
  workspace: string;
  conversation: string;
  output: string;
  tail: Promise<unknown>;
  closed: boolean;
}
type TransportFactory = (
  options: ConstructorParameters<typeof StdioClientTransport>[0],
) => Transport;

/** Owns stateful engines independently from stateless remote MCP connections. */
export class ArtcraftRuntimeManager {
  onUnexpectedClose?: (id: string) => void;
  private sessions = new Map<string, Session>();
  private pending = new Map<
    string,
    { recordId: string; controller: AbortController; promise: Promise<Session> }
  >();
  private generation = new Map<string, number>();
  private catalogs = new Map<string, McpToolInfo[]>();
  constructor(
    private readonly makeTransport: TransportFactory = (options) =>
      new StdioClientTransport(options),
  ) {}
  tools(id: string) {
    return this.catalogs.get(id) ?? [];
  }
  private key(id: string, workspace: string, conversation: string) {
    return JSON.stringify([id, fs.realpathSync(workspace), conversation]);
  }
  async connect(
    record: McpConnection,
    fingerprint: string,
    workspace: string,
    conversation: string,
  ) {
    const app = artcraftApp(record);
    if (!app || !path.isAbsolute(workspace) || !conversation)
      throw new Error("runtime");
    if (!ARTCRAFT_APPS[app].roots && !record.localFileAccess)
      throw new Error("runtime");
    const key = this.key(record.id, workspace, conversation);
    const existing = this.sessions.get(key);
    if (existing) {
      if (existing.closed || existing.fingerprint !== fingerprint)
        throw new Error("connection");
      return existing;
    }
    const pending = this.pending.get(key);
    if (pending) return pending.promise;
    // Never evict an engine with an unsaved active document behind the user's back.
    if (this.sessions.size + this.pending.size >= 24) throw new Error("busy");
    const command = findArtcraftRuntime(app, record.runtimePath);
    if (!command) throw new Error("runtime");
    const launch = artcraftLaunch(app, workspace, conversation);
    const controller = new AbortController();
    const epoch = this.generation.get(record.id) ?? 0;
    const promise = (async () => {
      const client = new Client({ name: "const-harness", version: "1.0.0" });
      const transport = this.makeTransport({
        command,
        args: launch.args,
        cwd: launch.cwd,
        env: getDefaultEnvironment(),
        stderr: "ignore",
      });
      try {
        await client.connect(transport, {
          timeout: record.timeoutMs,
          signal: controller.signal,
        });
        const tools: McpToolInfo[] = [];
        let cursor: string | undefined;
        const cursors = new Set<string>();
        do {
          const page = await client.listTools(cursor ? { cursor } : {}, {
            timeout: record.timeoutMs,
            signal: controller.signal,
          });
          for (const tool of page.tools)
            tools.push({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
              readOnly: tool.annotations?.readOnlyHint === true,
            });
          cursor = page.nextCursor;
          if (tools.length > 2000 || (cursor && cursors.has(cursor)))
            throw new Error("connection");
          if (cursor) cursors.add(cursor);
        } while (cursor);
        if (
          controller.signal.aborted ||
          epoch !== (this.generation.get(record.id) ?? 0)
        )
          throw new Error("connection");
        const session: Session = {
          client,
          transport,
          tools,
          fingerprint,
          recordId: record.id,
          conversation,
          workspace: launch.workspace,
          output: launch.output,
          tail: Promise.resolve(),
          closed: false,
        };
        client.onclose = () => {
          const expected = session.closed;
          session.closed = true;
          if (!expected) this.onUnexpectedClose?.(record.id);
        };
        this.sessions.set(key, session);
        this.catalogs.set(record.id, tools);
        return session;
      } catch (error) {
        await client.close().catch(() => {});
        await transport.close().catch(() => {});
        throw error;
      }
    })();
    this.pending.set(key, { recordId: record.id, controller, promise });
    try {
      return await promise;
    } finally {
      if (this.pending.get(key)?.promise === promise) this.pending.delete(key);
    }
  }
  async execute(
    record: McpConnection,
    fingerprint: string,
    workspace: string,
    conversation: string,
    gateway: string,
    args: Record<string, unknown>,
    signal: AbortSignal | undefined,
    authorize: () => void,
  ) {
    signal?.throwIfAborted();
    authorize();
    const connection = this.connect(
      record,
      fingerprint,
      workspace,
      conversation,
    );
    // Startup can be shared by another call in this chat. Cancel this waiter promptly
    // without replaying a mutation or killing an engine another waiter is using.
    let onAbort: (() => void) | undefined;
    let session: Session;
    try {
      session = await Promise.race([
        connection,
        new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(signal?.reason ?? new Error("connection"));
          signal?.addEventListener("abort", onAbort, { once: true });
          if (signal?.aborted) onAbort();
        }),
      ]);
    } finally {
      if (onAbort) signal?.removeEventListener("abort", onAbort);
    }
    const operation = session.tail
      .catch(() => {})
      .then(async () => {
        signal?.throwIfAborted();
        authorize();
        if (session.closed) throw new Error("connection");
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
          const matches = session.tools
            .map((tool) => ({
              tool,
              score: words.filter((word) =>
                `${tool.name} ${tool.description}`.toLowerCase().includes(word),
              ).length,
            }))
            .filter((item) => !words.length || item.score)
            .sort((a, b) => b.score - a.score);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  app: record.artcraftApp,
                  version: session.client.getServerVersion(),
                  outputDirectory: session.output,
                  libraryDirectory:
                    record.artcraftApp === "lightcraft"
                      ? path.join(session.output, "library")
                      : undefined,
                  workspace: session.workspace,
                  totalMatches: matches.length,
                  tools: matches
                    .slice(0, Number(args.limit ?? 8))
                    .map(({ tool }) => tool),
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
        // Keep the active engine on cancellation/timeout. Its last write may have completed.
        return CallToolResultSchema.parse(
          await session.client.callTool(
            {
              name: args.toolName,
              arguments: args.arguments as Record<string, unknown>,
            },
            undefined,
            { timeout: record.timeoutMs, signal },
          ),
        );
      });
    session.tail = operation;
    return operation;
  }
  async disconnect(id: string) {
    this.generation.set(id, (this.generation.get(id) ?? 0) + 1);
    this.catalogs.delete(id);
    const pending = [...this.pending.values()].filter((p) => p.recordId === id);
    for (const item of pending) item.controller.abort();
    const sessions = [...this.sessions.entries()].filter(
      ([, s]) => s.recordId === id,
    );
    for (const [key, session] of sessions) {
      session.closed = true;
      this.sessions.delete(key);
    }
    await Promise.all([
      ...sessions.map(async ([, s]) => {
        await s.client.close().catch(() => {});
        await s.transport.close().catch(() => {});
      }),
      ...pending.map((p) => p.promise.catch(() => {})),
    ]);
  }
  async releaseConversation(conversation: string) {
    const pending = [...this.pending.entries()].filter(
      ([key]) => JSON.parse(key)[2] === conversation,
    );
    for (const [, item] of pending) item.controller.abort();
    const sessions = [...this.sessions.entries()].filter(
      ([, session]) => session.conversation === conversation,
    );
    for (const [key, session] of sessions) {
      session.closed = true;
      this.sessions.delete(key);
    }
    await Promise.all([
      ...sessions.map(async ([, s]) => {
        await s.client.close().catch(() => {});
        await s.transport.close().catch(() => {});
      }),
      ...pending.map(([, p]) => p.promise.catch(() => {})),
    ]);
  }
  async close() {
    await Promise.all(
      [
        ...new Set(
          [...this.sessions.values(), ...this.pending.values()].map(
            (s) => s.recordId,
          ),
        ),
      ].map((id) => this.disconnect(id)),
    );
  }
}
