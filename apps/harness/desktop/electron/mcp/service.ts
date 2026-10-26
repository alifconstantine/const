import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  UnauthorizedError,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
} from "@modelcontextprotocol/sdk/client/auth.js";
import {
  ToolListChangedNotificationSchema,
  CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  resolveSkillRegistry,
  type InstalledPlugin,
  type NativeToolDefinition,
  type ToolExecutionResult,
} from "@const/agent";
import type {
  McpConnection,
  McpConnectionView,
  McpSaveInput,
  McpToolInfo,
} from "../../src/lib/mcp/types";
import { McpStore, validateEndpoint, validWorkspace } from "./store";

import { respondOAuth } from "./oauth-page";

const CALLBACK = "http://127.0.0.1:24139/oauth/callback";
interface LiveConnection {
  client: Client;
  transport: Transport;
  tools: McpToolInfo[];
  fingerprint: string;
}
interface Login {
  id: string;
  abort: () => void;
  done: Promise<void>;
}
export function exposedToolName(id: string, tool: string) {
  const hash = createHash("sha256")
    .update(`${id}:${tool}`)
    .digest("hex")
    .slice(0, 20);
  return `mcp_${hash}_${tool
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase()
    .slice(0, 38)}`;
}

export class McpService {
  private live = new Map<string, LiveConnection>();
  private states = new Map<
    string,
    Pick<McpConnectionView, "status" | "error">
  >();
  private pending = new Map<string, Promise<LiveConnection>>();
  private controllers = new Map<string, AbortController>();
  private retryAfter = new Map<string, number>();
  private login?: Login;
  constructor(
    readonly store: McpStore,
    private readonly changed: () => void,
    private readonly openExternal: (url: string) => Promise<unknown>,
    private readonly plugins: (workspace?: string) => InstalledPlugin[] = (
      workspace,
    ) => resolveSkillRegistry(workspace).plugins,
  ) {}

  private configurations(workspace?: string): McpConnection[] {
    const plugins = this.plugins(workspace);
    for (const plugin of plugins) {
      for (const [serverKey, server] of Object.entries(
        plugin.mcpServers ?? {},
      )) {
        const key = `plugin-${plugin.name}-${serverKey}`;
        if (
          !this.store
            .list(plugin.workspacePath)
            .some((item) => item.key === key && item.scope === plugin.scope)
        ) {
          this.store.save({
            key,
            name: plugin.interface.displayName,
            scope: plugin.scope,
            workspacePath: plugin.workspacePath,
            transport: server.transport,
            url: server.url,
            command: server.command,
            args: server.args,
            auth: server.auth,
          });
        }
      }
    }
    return this.store.list(workspace).map((record) => {
      if (!record.key.startsWith("plugin-")) return record;
      const matches = plugins.filter((item) =>
        Object.keys(item.mcpServers ?? {}).some(
          (key) => `plugin-${item.name}-${key}` === record.key,
        ),
      );
      const plugin =
        matches.find(
          (item) =>
            item.scope === record.scope &&
            validWorkspace(item.workspacePath) === record.workspacePath,
        ) ?? matches.find((item) => item.isEffective);
      const definition = Object.entries(plugin?.mcpServers ?? {}).find(
        ([key]) => `plugin-${plugin?.name}-${key}` === record.key,
      )?.[1];
      return {
        ...record,
        pluginId: plugin?.id,
        pluginName: plugin?.interface.displayName,
        authOptions: definition?.authOptions,
        apiKeyUrl: definition?.apiKeyUrl,
        oauthUrl: definition?.oauthUrl,
        oauthClientRequired: definition?.oauthClientRequired,
        setupUrl: definition?.setupUrl,
        enabled: record.enabled && !!plugin?.isEnabled && !!plugin?.isEffective,
      };
    });
  }
  list(workspace?: string): McpConnectionView[] {
    const seen = new Set<string>();
    return this.configurations(workspace).map((record) => {
      const isEffective = !seen.has(record.key);
      seen.add(record.key);
      let hasCredentials = false;
      try {
        if (this.store.isTrusted(record)) {
          const secret = this.store.secrets(record.id);
          hasCredentials = !!(secret.apiKey || secret.tokens);
        }
      } catch {
        return {
          ...record,
          isEffective,
          hasCredentials: false,
          status: "error",
          error: "storage",
          tools: [],
        };
      }
      const state = this.states.get(record.id);
      return {
        ...record,
        isEffective,
        hasCredentials,
        lastConnectedAt: this.store.lastConnectedAt(record),
        status: !record.enabled
          ? "disabled"
          : (state?.status ??
            (record.auth !== "none" && !hasCredentials
              ? "needs_auth"
              : "disconnected")),
        error: state?.error,
        tools: this.live.get(record.id)?.tools ?? [],
      };
    });
  }
  private get(id: string, workspace?: string) {
    const record = this.list(workspace).find((item) => item.id === id);
    if (!record || !record.isEffective || !record.enabled)
      throw new Error("invalid");
    return record;
  }
  async save(input: McpSaveInput) {
    if (input.id) await this.disconnect(input.id);
    // Custom callers cannot impersonate a plugin or mint a plugin-managed key.
    const { key: _key, pluginId: _plugin, pluginName: _name, ...safe } = input;
    this.store.save(safe);
    this.changed();
  }
  async remove(id: string, workspace?: string) {
    const record = this.store.get(id, workspace);
    if (
      record.key.startsWith("plugin-") &&
      (record.scope !== "workspace" ||
        this.plugins(workspace).some(
          (plugin) =>
            plugin.scope === "workspace" &&
            Object.keys(plugin.mcpServers ?? {}).some(
              (key) => `plugin-${plugin.name}-${key}` === record.key,
            ),
        ))
    )
      throw new Error("invalid");
    await this.disconnect(id);
    this.store.remove(id, workspace);
    this.states.delete(id);
    this.changed();
  }
  async override(id: string, workspace: string) {
    const record = this.store.get(id);
    if (record.scope !== "user") throw new Error("invalid");
    const { id: _id, ...fields } = record;
    this.store.save({
      ...fields,
      scope: "workspace",
      workspacePath: workspace,
    });
    this.changed();
  }
  async disconnect(id: string, _workspace?: string) {
    if (this.login?.id === id) this.login.abort();
    this.controllers.get(id)?.abort();
    const active = this.live.get(id);
    this.live.delete(id);
    await active?.client.close().catch(() => {});
    await this.pending.get(id)?.catch(() => {});
    this.retryAfter.delete(id);
    this.states.set(id, { status: "disconnected" });
    this.changed();
  }
  async disconnectAccount(id: string, workspace?: string) {
    const record = this.store.get(id, workspace);
    await this.disconnect(id);
    const {
      tokens: _tokens,
      apiKey: _apiKey,
      ...remaining
    } = this.store.secrets(id);
    if (Object.keys(remaining).length) this.store.writeSecrets(id, remaining);
    else this.store.clearSecrets(id);
    this.store.save({ ...record, enabled: false });
    this.changed();
  }
  async invalidate() {
    const login = this.login;
    login?.abort();
    await Promise.all(
      [...new Set([...this.live.keys(), ...this.pending.keys()])].map((id) =>
        this.disconnect(id),
      ),
    );
    await login?.done;
    this.changed();
  }
  private provider(
    record: McpConnection,
    authorize?: (url: URL) => Promise<void>,
    state?: string,
    signal?: AbortSignal,
  ): OAuthClientProvider {
    let verifier = "";
    let discovery: OAuthDiscoveryState | undefined;
    const update = (patch: object) => {
      if (
        signal?.aborted ||
        this.store.fingerprint(
          this.store.get(record.id, record.workspacePath),
        ) !== this.store.fingerprint(record)
      )
        throw new Error("auth");
      this.store.writeSecrets(record.id, {
        ...this.store.secrets(record.id),
        ...patch,
      });
    };
    return {
      redirectUrl: CALLBACK,
      clientMetadata: {
        client_name: "Const Harness",
        redirect_uris: [CALLBACK],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        ...(record.scopes ? { scope: record.scopes } : {}),
      },
      state: () => state ?? randomBytes(32).toString("hex"),
      clientInformation: () =>
        this.store.secrets(record.id).clientInformation ??
        (record.clientId
          ? {
              client_id: record.clientId,
              client_secret: this.store.secrets(record.id).clientSecret,
            }
          : undefined),
      saveClientInformation: (clientInformation) =>
        update({ clientInformation }),
      tokens: () => this.store.secrets(record.id).tokens,
      saveTokens: (tokens) => update({ tokens }),
      saveCodeVerifier: (value) => {
        verifier = value;
      },
      codeVerifier: () => {
        if (!verifier) throw new Error("auth");
        return verifier;
      },
      saveDiscoveryState: (value) => {
        discovery = value;
      },
      discoveryState: () => discovery,
      redirectToAuthorization: async (url) => {
        if (!authorize) throw new UnauthorizedError("Authentication required");
        validateEndpoint(url.toString());
        await authorize(url);
      },
      invalidateCredentials: (scope) => {
        if (scope === "all" || scope === "tokens")
          update({ tokens: undefined });
        if (scope === "all" || scope === "client")
          update({ clientInformation: undefined });
        if (scope === "all" || scope === "verifier") verifier = "";
        if (scope === "all" || scope === "discovery") discovery = undefined;
      },
    };
  }
  async authenticate(
    id: string,
    workspace?: string,
    language = "en",
  ): Promise<void> {
    const record = this.get(id, workspace);
    if (record.transport !== "http" || record.auth !== "oauth")
      throw new Error("invalid");
    if (record.oauthClientRequired && !record.clientId) throw new Error("auth");
    if (this.login) throw new Error("busy");
    await this.disconnect(id);
    if (!this.store.isTrusted(record)) throw new Error("invalid");
    // Verify the OS vault before registering a client or opening the user's browser.
    this.store.writeSecrets(id, this.store.secrets(id));
    const state = randomBytes(32).toString("hex");
    const controller = new AbortController();
    let resolveCode!: (code: string) => void;
    let rejectCode!: (error: Error) => void;
    const code = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });
    void code.catch(() => {});
    let callbackResponse: http.ServerResponse | undefined;
    const server = http.createServer((request, response) => {
      const url = new URL(request.url ?? "/", CALLBACK);
      if (
        request.method !== "GET" ||
        url.pathname !== "/oauth/callback" ||
        url.searchParams.get("state") !== state
      ) {
        respondOAuth(response, false, language);
        return;
      }
      if (url.searchParams.has("error") || !url.searchParams.get("code")) {
        rejectCode(new Error("auth"));
        respondOAuth(response, false, language);
        return;
      }
      const discovery = provider.discoveryState?.();
      if (discovery && !(discovery instanceof Promise)) {
        const expected =
          discovery.authorizationServerMetadata?.issuer ??
          String(discovery.authorizationServerUrl);
        const issuer = url.searchParams.get("iss");
        const metadata = discovery.authorizationServerMetadata as
          Record<string, unknown> | undefined;
        if (
          (issuer && issuer !== expected) ||
          (metadata?.authorization_response_iss_parameter_supported && !issuer)
        ) {
          rejectCode(new Error("auth"));
          respondOAuth(response, false, language);
          return;
        }
      }
      if (callbackResponse) {
        respondOAuth(response, false, language);
        return;
      }
      callbackResponse = response;
      resolveCode(url.searchParams.get("code")!);
    });
    const provider = this.provider(
      record,
      async (url) => {
        await this.openExternal(url.toString());
      },
      state,
      controller.signal,
    );
    let finishLogin!: () => void;
    const done = new Promise<void>((resolve) => {
      finishLogin = resolve;
    });
    this.login = {
      id,
      done,
      abort: () => {
        controller.abort();
        rejectCode(new Error("auth"));
      },
    };
    const timer = setTimeout(
      () => this.login?.id === id && this.login.abort(),
      5 * 60_000,
    );
    this.states.set(id, { status: "connecting" });
    this.changed();
    let transport: StreamableHTTPClientTransport | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(24139, "127.0.0.1", resolve);
      });
      transport = new StreamableHTTPClientTransport(new URL(record.url!), {
        authProvider: provider,
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(record.timeoutMs),
              ...(init?.signal ? [init.signal] : []),
            ]),
          }),
      });
      const client = new Client({ name: "const-harness", version: "1.0.0" });
      try {
        await client.connect(transport, {
          timeout: record.timeoutMs,
          signal: controller.signal,
        });
      } catch (error) {
        if (!(error instanceof UnauthorizedError)) throw error;
        await transport.finishAuth(await code);
      } finally {
        await client.close().catch(() => {});
      }
      if (controller.signal.aborted) throw new Error("auth");
      await this.connect(id, workspace);
      if (controller.signal.aborted) throw new Error("auth");
      if (callbackResponse) respondOAuth(callbackResponse, true, language);
    } catch {
      if (callbackResponse && !callbackResponse.writableEnded)
        respondOAuth(callbackResponse, false, language);
      this.states.set(id, { status: "needs_auth", error: "auth" });
      throw new Error("auth");
    } finally {
      clearTimeout(timer);
      this.login = undefined;
      server.close();
      // Allow the response to flush before closing remaining keep-alive sockets.
      setTimeout(() => server.closeAllConnections(), 1000).unref();
      await transport?.close().catch(() => {});
      this.changed();
      finishLogin();
    }
  }
  async connect(id: string, workspace?: string): Promise<LiveConnection> {
    const record = this.get(id, workspace);
    if (!this.store.isTrusted(record)) throw new Error("invalid");
    const fingerprint = this.store.fingerprint(record);
    const active = this.live.get(id);
    if (active?.fingerprint === fingerprint) return active;
    const pending = this.pending.get(id);
    if (pending) return pending;
    const controller = new AbortController();
    this.controllers.set(id, controller);
    const operation = this.establish(record, fingerprint, controller.signal);
    this.pending.set(id, operation);
    try {
      return await operation;
    } finally {
      if (this.pending.get(id) === operation) this.pending.delete(id);
      if (this.controllers.get(id) === controller) this.controllers.delete(id);
    }
  }
  private async establish(
    record: McpConnection,
    fingerprint: string,
    signal: AbortSignal,
  ): Promise<LiveConnection> {
    this.states.set(record.id, { status: "connecting" });
    this.changed();
    const client = new Client({ name: "const-harness", version: "1.0.0" });
    try {
      const secret = this.store.secrets(record.id);
      const headers = new Headers(secret.headers);
      if (record.auth === "api-key") {
        if (!secret.apiKey)
          throw new UnauthorizedError("Authentication required");
        headers.set("Authorization", `Bearer ${secret.apiKey}`);
      }
      const transport: Transport =
        record.transport === "http"
          ? new StreamableHTTPClientTransport(validateEndpoint(record.url!), {
              authProvider:
                record.auth === "oauth"
                  ? this.provider(record, undefined, undefined, signal)
                  : undefined,
              fetch: (input, init) =>
                fetch(input, {
                  ...init,
                  signal: AbortSignal.any([
                    signal,
                    AbortSignal.timeout(record.timeoutMs),
                    ...(init?.signal ? [init.signal] : []),
                  ]),
                }),
              requestInit: { headers },
            })
          : new StdioClientTransport({
              command: record.command!,
              args: record.args,
              cwd: record.cwd ?? record.workspacePath,
              env: { ...getDefaultEnvironment(), ...secret.env },
              stderr: "ignore",
            });
      await client.connect(transport, { timeout: record.timeoutMs, signal });
      const tools = await this.readTools(client, record.timeoutMs, signal);
      if (signal.aborted) throw new Error("connection");
      this.store.markConnected(record);
      const active = { client, transport, tools, fingerprint };
      this.live.set(record.id, active);
      this.retryAfter.delete(record.id);
      client.setNotificationHandler(
        ToolListChangedNotificationSchema,
        async () => {
          try {
            active.tools = await this.readTools(
              client,
              record.timeoutMs,
              signal,
            );
            this.changed();
          } catch {
            /* Reconnect refreshes schemas. */
          }
        },
      );
      client.onclose = () => {
        if (this.live.get(record.id) === active) {
          this.live.delete(record.id);
          this.states.set(record.id, { status: "disconnected" });
          this.changed();
        }
      };
      this.states.set(record.id, { status: "connected" });
      this.changed();
      return active;
    } catch (error) {
      await client.close().catch(() => {});
      const auth = error instanceof UnauthorizedError;
      this.retryAfter.set(record.id, Date.now() + 30_000);
      this.states.set(record.id, {
        status: auth ? "needs_auth" : "error",
        error: auth ? "auth" : "connection",
      });
      this.changed();
      throw new Error(auth ? "auth" : "connection");
    }
  }
  private async readTools(
    client: Client,
    timeout: number,
    signal: AbortSignal,
  ) {
    const tools: McpToolInfo[] = [];
    let cursor: string | undefined;
    const cursors = new Set<string>();
    do {
      const page = await client.listTools(cursor ? { cursor } : {}, {
        timeout,
        signal,
      });
      for (const tool of page.tools)
        tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          readOnly: tool.annotations?.readOnlyHint === true,
        });
      cursor = page.nextCursor;
      if ((cursor && cursors.has(cursor)) || tools.length > 1000)
        throw new Error("connection");
      if (cursor) cursors.add(cursor);
    } while (cursor);
    return tools;
  }
  async tools(
    workspace?: string,
    signal?: AbortSignal,
  ): Promise<NativeToolDefinition[]> {
    let records: McpConnectionView[];
    try {
      records = this.list(workspace);
    } catch {
      return [];
    } // A malformed MCP file must not break ordinary native chat tools.
    const eligible = records.filter(
      (record) =>
        record.isEffective &&
        record.enabled &&
        this.store.isTrusted(record) &&
        (record.auth === "none" || record.hasCredentials) &&
        (this.retryAfter.get(record.id) ?? 0) <= Date.now(),
    );
    const definitions: NativeToolDefinition[] = [];
    await Promise.all(
      eligible.map(async (record) => {
        if (signal?.aborted) return;
        try {
          const operation = this.connect(record.id, workspace);
          let onAbort: (() => void) | undefined;
          const aborted = new Promise<never>((_resolve, reject) => {
            onAbort = () => reject(new Error("connection"));
            signal?.addEventListener("abort", onAbort, { once: true });
            if (signal?.aborted) onAbort();
          });
          let active: LiveConnection;
          try {
            active = await Promise.race([operation, aborted]);
          } finally {
            if (onAbort) signal?.removeEventListener("abort", onAbort);
          }
          for (const tool of active.tools)
            definitions.push({
              type: "function",
              requiresApproval: true,
              function: {
                name: exposedToolName(record.id, tool.name),
                description:
                  `[${record.name}] ${tool.description ?? tool.name}`.slice(
                    0,
                    8000,
                  ),
                parameters: tool.inputSchema,
              },
            });
        } catch {
          /* One unavailable integration must not prevent a chat from starting. */
        }
      }),
    );
    return definitions;
  }
  async execute(
    name: string,
    args: Record<string, unknown>,
    workspace?: string,
    signal?: AbortSignal,
  ): Promise<ToolExecutionResult> {
    try {
      for (const record of this.list(workspace)) {
        if (
          !record.isEffective ||
          !record.enabled ||
          !this.store.isTrusted(record)
        )
          continue;
        const active = this.live.get(record.id);
        const tool = active?.tools.find(
          (item) => exposedToolName(record.id, item.name) === name,
        );
        if (
          !active ||
          !tool ||
          active.fingerprint !== this.store.fingerprint(record)
        )
          continue;
        const result = CallToolResultSchema.parse(
          await active.client.callTool(
            { name: tool.name, arguments: args },
            undefined,
            { signal, timeout: record.timeoutMs },
          ),
        );
        const images = result.content.flatMap((item) =>
          item.type === "image" && item.data.length < 8_000_000
            ? [{ data: item.data, mimeType: item.mimeType }]
            : [],
        );
        const text = result.content.filter((item) => item.type !== "image");
        return {
          result: JSON.stringify({
            content: text,
            structuredContent: result.structuredContent,
          }).slice(0, 100_000),
          isError: result.isError === true,
          images,
        };
      }
      return {
        result:
          "MCP connection is disabled, unavailable, or its configuration changed. Reconnect it in Settings > MCP Servers.",
        isError: true,
      };
    } catch {
      return {
        result:
          "MCP tool execution failed. Check the connection in Settings > MCP Servers.",
        isError: true,
      };
    }
  }
}
