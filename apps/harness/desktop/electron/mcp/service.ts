import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
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
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  resolveSkillRegistry,
  CONST_DEFAULT_TOOLS,
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

import { GitHubOAuthClient, isManagedGitHub } from "./github-oauth";
import { GoogleOAuthClient, managedGoogleApp } from "./google-oauth";
import { respondOAuth } from "./oauth-page";
import { McpAppsStore, type StoredApp } from "./apps-store";
import type { McpAppView } from "../../src/lib/mcp/apps";
import path from "node:path";
import { ObsidianVault, obsidianTransport } from "./obsidian";
import {
  ArtcraftRuntimeManager,
  artcraftApp,
  findArtcraftRuntime,
  ARTCRAFT_GATEWAYS,
} from "./artcraft";
import {
  EditorRuntimeManager,
  editorApp,
  editorProject,
  EDITOR_GATEWAYS,
} from "./editors";
import {
  isEditorApp,
  EDITORS,
  type EditorAction,
} from "../../src/lib/mcp/editors";
import { ARTCRAFT_APPS, isArtCraftApp } from "../../src/lib/mcp/artcraft";

const CALLBACK = "http://127.0.0.1:24139/oauth/callback";
const SEARCH_TOOLS = "mcp_search_tools";
const CALL_TOOL = "mcp_call_tool";
// Harness has 64 native tools; leave room under the common 128-function provider limit.
const DIRECT_TOOL_LIMIT = Math.max(2, 128 - CONST_DEFAULT_TOOLS.length);
const CATALOG_TOOLS: NativeToolDefinition[] = [
  {
    type: "function",
    requiresApproval: false,
    function: {
      name: SEARCH_TOOLS,
      description:
        "Find tools from connected apps by app name, action, or keywords. Returns toolName, description and inputSchema. Then use mcp_call_tool with the selected toolName and arguments matching its schema. Search again for another app or action.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    requiresApproval: true,
    function: {
      name: CALL_TOOL,
      description:
        "Execute a connected-app tool found with mcp_search_tools. Use its exact toolName and arguments matching the returned inputSchema. Results come from the connected account. A failed write must not be retried without checking its outcome.",
      parameters: {
        type: "object",
        properties: {
          toolName: { type: "string" },
          arguments: { type: "object", additionalProperties: true },
        },
        required: ["toolName", "arguments"],
        additionalProperties: false,
      },
    },
  },
];
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
  private readonly artcraft: ArtcraftRuntimeManager;
  private readonly editors: EditorRuntimeManager;
  private live = new Map<string, LiveConnection>();
  private states = new Map<
    string,
    Pick<McpConnectionView, "status" | "error">
  >();
  private pending = new Map<string, Promise<LiveConnection>>();
  private controllers = new Map<string, AbortController>();
  private retryAfter = new Map<string, number>();
  private login?: Login;
  private readonly github: GitHubOAuthClient;
  private readonly google: GoogleOAuthClient;
  readonly apps: McpAppsStore;
  constructor(
    readonly store: McpStore,
    private readonly changed: () => void,
    private readonly openExternal: (url: string) => Promise<unknown>,
    private readonly plugins: (workspace?: string) => InstalledPlugin[] = (
      workspace,
    ) => resolveSkillRegistry(workspace).plugins,
    github?: GitHubOAuthClient,
    google?: GoogleOAuthClient,
    artcraft?: ArtcraftRuntimeManager,
    editors?: EditorRuntimeManager,
  ) {
    this.github = github ?? new GitHubOAuthClient(store);
    this.google = google ?? new GoogleOAuthClient(store);
    this.apps = new McpAppsStore(store.home);
    this.artcraft = artcraft ?? new ArtcraftRuntimeManager();
    this.editors = editors ?? new EditorRuntimeManager(store.home);
    this.artcraft.onUnexpectedClose = (id) => {
      this.states.set(id, { status: "error", error: "connection" });
      this.changed();
    };
  }

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
            builtin: server.builtin,
            artcraftApp: isArtCraftApp(server.artcraftApp)
              ? server.artcraftApp
              : undefined,
            editorApp: isEditorApp(server.editorApp)
              ? server.editorApp
              : undefined,
            timeoutMs: ["artcraft", "editor"].includes(server.builtin ?? "")
              ? 180_000
              : undefined,
            url: server.url,
            command: server.command,
            args: server.args,
            auth: server.auth,
          });
        }
      }
    }
    return this.store.list(workspace).map((savedRecord) => {
      let record = savedRecord;
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
      // Move untouched, unauthenticated v1 Canva connections to the hosted DCR endpoint.
      // Preserve accounts or custom OAuth configuration already supplied by the user.
      if (
        plugin?.name === "canva" &&
        definition?.url === "https://mcp.canva.com/mcp" &&
        record.url === "https://api.canva.com/connect/v1/mcp" &&
        record.auth === "oauth" &&
        !record.clientId &&
        !record.scopes &&
        this.store.isTrusted(record)
      ) {
        try {
          if (Object.keys(this.store.secrets(record.id)).length === 0)
            record = this.store.save({ ...record, url: definition.url });
        } catch {
          /* Keep listing usable; the per-record status reports vault errors. */
        }
      }
      if (
        plugin?.name === "github" &&
        definition?.auth === "oauth" &&
        record.key === "plugin-github-github" &&
        record.url === "https://api.githubcopilot.com/mcp/" &&
        record.auth === "api-key" &&
        !record.clientId &&
        !record.scopes &&
        this.store.isTrusted(record)
      ) {
        try {
          if (Object.keys(this.store.secrets(record.id)).length === 0)
            record = this.store.save({ ...record, auth: "oauth" });
        } catch {
          /* The normal listing reports vault errors. */
        }
      }
      return {
        ...record,
        pluginId: plugin?.id,
        pluginName: plugin?.interface.displayName,
        authOptions: definition?.authOptions,
        apiKeyUrl: definition?.apiKeyUrl,
        oauthUrl: definition?.oauthUrl,
        oauthClientRequired:
          isManagedGitHub(record) || managedGoogleApp(record)
            ? false
            : definition?.oauthClientRequired,
        managedOAuth: isManagedGitHub(record)
          ? "github"
          : managedGoogleApp(record)
            ? "google"
            : undefined,
        setupUrl:
          plugin?.name === "github" && !isManagedGitHub(record)
            ? undefined
            : definition?.setupUrl,
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
      let accountEmail: string | undefined;
      try {
        if (this.store.isTrusted(record)) {
          const secret = this.store.secrets(record.id);
          const google = managedGoogleApp(record)
            ? this.google.credentials(record)
            : undefined;
          hasCredentials = managedGoogleApp(record)
            ? !!google
            : !!(secret.apiKey || secret.tokens);
          accountEmail = google?.googleOAuth.email;
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
      let state = this.states.get(record.id);
      if (
        editorApp(record) &&
        state?.status === "connected" &&
        !this.editors.connected(record, workspace)
      )
        state = undefined;
      return {
        ...record,
        isEffective,
        editorPrepared: editorApp(record)
          ? this.editors.setup.prepared(editorApp(record)!)
          : undefined,
        editorInstalling: editorApp(record)
          ? this.editors.setup.busy(editorApp(record)!)
          : undefined,
        detectedProject: editorApp(record)
          ? (() => {
              try {
                return editorProject(record, workspace);
              } catch {
                return undefined;
              }
            })()
          : undefined,
        detectedRuntime: artcraftApp(record)
          ? findArtcraftRuntime(artcraftApp(record)!, record.runtimePath)
          : undefined,
        hasCredentials,
        accountEmail,
        lastConnectedAt: this.store.lastConnectedAt(record),
        status: !record.enabled
          ? "disabled"
          : managedGoogleApp(record) &&
              !hasCredentials &&
              state?.status !== "connecting"
            ? "needs_auth"
            : (state?.status ??
              (record.auth !== "none" && !hasCredentials
                ? "needs_auth"
                : "disconnected")),
        error: state?.error,
        tools:
          record.builtin === "editor"
            ? this.editors.tools(record, workspace)
            : record.builtin === "artcraft"
              ? this.artcraft.tools(record.id)
              : (this.live.get(record.id)?.tools ?? []),
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
    if (
      input.transport === "builtin" &&
      (!input.id ||
        (!(
          input.builtin === "obsidian" &&
          this.store.get(input.id, input.workspacePath).key ===
            "plugin-obsidian-vault"
        ) &&
          !(
            ["artcraft", "editor"].includes(input.builtin ?? "") &&
            (input.builtin === "editor" ? editorApp : artcraftApp)({
              ...input,
              key: this.store.get(input.id, input.workspacePath).key,
            } as McpConnection)
          )))
    )
      throw new Error("invalid");
    if (input.id) {
      const previous = this.store.get(input.id, input.workspacePath);
      await this.disconnect(input.id);
      if (
        managedGoogleApp(previous) &&
        (previous.url !== input.url ||
          previous.transport !== input.transport ||
          previous.auth !== input.auth ||
          previous.clientId !== input.clientId ||
          previous.scopes !== input.scopes)
      )
        this.google.unlink(previous);
    }
    // Custom callers cannot impersonate a plugin or mint a plugin-managed key.
    const { key: _key, pluginId: _plugin, pluginName: _name, ...safe } = input;
    this.store.save(safe);
    this.changed();
  }
  async configureEditor(
    id: string,
    action: EditorAction,
    workspace: string | undefined,
    choose?: (app: string) => Promise<string | null>,
    reveal?: (file: string) => void,
  ) {
    const record = this.get(id, workspace);
    const app = editorApp(record);
    if (!app || !this.store.isTrusted(record)) throw new Error("invalid");
    if (action === "cancel") {
      this.editors.setup.cancel(app);
      return;
    }
    const fingerprint = this.store.fingerprint(record);
    const authorize = () => {
      const current = this.get(id, workspace);
      if (
        !this.store.isTrusted(current) ||
        this.store.fingerprint(current) !== fingerprint
      )
        throw new Error("invalid");
    };
    if (action === "project") {
      if (!workspace || !choose) throw new Error("editor_project");
      const selected = await choose(app);
      if (!selected) return;
      authorize();
      const project = editorProject(
        { ...record, editorProjectPath: selected },
        workspace,
      );
      await this.editors.disconnect(id);
      authorize();
      if (record.scope === "user") {
        const { id: _id, ...fields } = record;
        this.store.save({
          ...fields,
          scope: "workspace",
          workspacePath: workspace,
          editorProjectPath: project,
        });
      } else this.store.save({ ...record, editorProjectPath: project });
      this.changed();
      return;
    }
    if (action === "reveal") {
      if (app !== "blender" || !this.editors.setup.prepared(app))
        throw new Error("editor_setup");
      reveal?.(path.join(this.editors.setup.root(app), "mcp-1.0.3.zip"));
      return;
    }
    if (!["install", "login", "pipeline"].includes(action))
      throw new Error("invalid");
    const project = editorProject(record, workspace);
    const prepare = this.editors.setup.prepare(app);
    this.changed();
    try {
      await prepare;
      authorize();
      // Re-resolve symlinks after asynchronous downloads before writing any project files.
      if (editorProject(this.get(id, workspace), workspace) !== project)
        throw new Error("editor_project");
      if (action === "install")
        this.editors.setup.installProject(
          app,
          app === "unreal" ? path.dirname(project) : project,
        );
      else {
        if (app !== "unity") throw new Error("invalid");
        const job = this.editors.setup.unityAction(
          action as "login" | "pipeline",
          project,
        );
        this.changed();
        await job;
        authorize();
      }
    } finally {
      this.changed();
    }
  }
  async configureArtcraft(
    id: string,
    workspace: string | undefined,
    choose?: () => Promise<string | null>,
  ) {
    const record = this.get(id, workspace);
    const app = artcraftApp(record);
    if (!app || !this.store.isTrusted(record)) throw new Error("invalid");
    const fingerprint = this.store.fingerprint(record);
    const selected = choose ? await choose() : undefined;
    if (selected === null) return;
    const runtime = findArtcraftRuntime(app, selected);
    if (!runtime) throw new Error("runtime");
    await this.disconnect(id);
    const current = this.get(id, workspace);
    if (
      !this.store.isTrusted(current) ||
      this.store.fingerprint(current) !== fingerprint
    )
      throw new Error("invalid");
    this.store.save({ ...current, runtimePath: runtime });
    this.changed();
  }
  async chooseVault(
    id: string,
    workspace: string | undefined,
    choose: () => Promise<string | null>,
  ) {
    const record = this.get(id, workspace);
    if (
      record.key !== "plugin-obsidian-vault" ||
      record.transport !== "builtin" ||
      record.builtin !== "obsidian" ||
      !this.store.isTrusted(record)
    )
      throw new Error("invalid");
    const fingerprint = this.store.fingerprint(record);
    const chosen = await choose();
    if (!chosen) return;
    const vault = new ObsidianVault(chosen);
    const current = this.get(id, workspace);
    if (
      !this.store.isTrusted(current) ||
      this.store.fingerprint(current) !== fingerprint
    )
      throw new Error("invalid");
    await this.disconnect(id);
    const latest = this.get(id, workspace);
    if (
      !this.store.isTrusted(latest) ||
      this.store.fingerprint(latest) !== fingerprint
    )
      throw new Error("invalid");
    this.store.save({ ...latest, vaultPath: vault.root });
    this.changed();
    await this.connect(id, workspace);
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
    if (managedGoogleApp(record)) this.google.unlink(record);
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
      ...(record.transport === "builtin"
        ? { vaultPath: undefined, editorProjectPath: undefined }
        : {}),
    });
    this.changed();
  }
  async disconnect(id: string, _workspace?: string) {
    await this.artcraft.disconnect(id);
    await this.editors.disconnect(id);
    if (this.login?.id === id) this.login.abort();
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
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
    if (managedGoogleApp(record)) this.google.unlink(record);
    const {
      tokens: _tokens,
      apiKey: _apiKey,
      githubOAuth: _github,
      ...remaining
    } = this.store.secrets(id);
    if (Object.keys(remaining).length) this.store.writeSecrets(id, remaining);
    else this.store.clearSecrets(id);
    this.store.save({ ...record, enabled: false });
    this.changed();
  }
  async invalidate() {
    await this.artcraft.close();
    await this.editors.close();
    await this.editors.setup.close();
    const login = this.login;
    login?.abort();
    await Promise.all(
      [
        ...new Set([
          ...this.live.keys(),
          ...this.pending.keys(),
          ...this.states.keys(),
        ]),
      ].map((id) => this.disconnect(id)),
    );
    await login?.done;
    this.changed();
  }
  async releaseConversation(conversation: string) {
    await this.artcraft.releaseConversation(conversation);
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
    const managedGitHub = isManagedGitHub(record);
    const managedGoogle = managedGoogleApp(record);
    const reuseGoogle =
      managedGoogle && this.states.get(id)?.status !== "needs_auth";
    if (
      !managedGitHub &&
      !managedGoogle &&
      record.oauthClientRequired &&
      !record.clientId
    )
      throw new Error("auth");
    if (this.login) throw new Error("busy");
    await this.disconnect(id);
    if (this.login) throw new Error("busy");
    if (!this.store.isTrusted(record)) throw new Error("invalid");
    // Verify the OS vault before registering a client or opening the user's browser.
    this.store.writeSecrets(id, this.store.secrets(id));
    if (reuseGoogle && this.google.reuse(record)) {
      try {
        await this.connect(id, workspace);
        return;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !["auth", "scope"].includes(error.message)
        )
          throw error;
        // Revoked credentials can survive a restart. Continue to browser consent on this click.
        await this.disconnect(id);
      }
    }
    // Reusing saved credentials awaited network I/O; another login or settings edit may have started.
    if (this.login) throw new Error("busy");
    const current = this.get(id, workspace);
    if (
      !this.store.isTrusted(current) ||
      this.store.fingerprint(current) !== this.store.fingerprint(record)
    )
      throw new Error("invalid");
    const state = randomBytes(32).toString("hex");
    const controller = new AbortController();
    let resolveCode!: (code: string) => void;
    let rejectCode!: (error: Error) => void;
    const code = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });
    void code.catch(() => {});
    const githubVerifier = randomBytes(32).toString("base64url");
    let githubTicket = "";
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
      if (managedGitHub || managedGoogle) {
        githubTicket = url.searchParams.get("ticket") ?? "";
        if (!githubTicket || githubTicket.length > 4096) {
          rejectCode(new Error("auth"));
          respondOAuth(response, false, language);
          return;
        }
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
      if (managedGitHub || managedGoogle) {
        const authorize = managedGoogle
          ? await this.google.authorizationUrl(
              record,
              state,
              GitHubOAuthClient.challenge(githubVerifier),
              language,
              controller.signal,
            )
          : await this.github.authorizationUrl(
              state,
              GitHubOAuthClient.challenge(githubVerifier),
              language,
              controller.signal,
            );
        await this.openExternal(authorize);
        const broker = managedGoogle ? this.google : this.github;
        await broker.exchange(
          record,
          await code,
          githubTicket,
          githubVerifier,
          controller.signal,
        );
      } else {
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
      }
      if (controller.signal.aborted) throw new Error("auth");
      await this.connect(id, workspace);
      if (controller.signal.aborted) throw new Error("auth");
      if (callbackResponse) respondOAuth(callbackResponse, true, language);
    } catch (error) {
      if (callbackResponse && !callbackResponse.writableEnded)
        respondOAuth(callbackResponse, false, language);
      const reason =
        error instanceof Error &&
        ["setup", "scope", "account", "connection"].includes(error.message)
          ? (error.message as "setup" | "scope" | "account" | "connection")
          : "auth";
      this.states.set(id, { status: "needs_auth", error: reason });
      throw new Error(reason);
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
    if (editorApp(record)) {
      if (!workspace) throw new Error("editor_project");
      await this.editors.disconnect(id);
      this.states.set(id, { status: "connecting" });
      this.changed();
      try {
        const active = await this.editors.probe(record, workspace, () => {
          const current = this.get(id, workspace);
          if (
            !this.store.isTrusted(current) ||
            this.store.fingerprint(current) !== fingerprint
          )
            throw new Error("invalid");
        });
        this.store.markConnected(record);
        this.states.set(id, { status: "connected" });
        this.changed();
        return { ...active, fingerprint };
      } catch (error) {
        const code =
          error instanceof Error &&
          ["editor_setup", "editor_project", "editor_wait"].includes(
            error.message,
          )
            ? (error.message as
                "editor_setup" | "editor_project" | "editor_wait")
            : "connection";
        this.states.set(id, { status: "error", error: code });
        this.changed();
        throw error;
      }
    }
    if (artcraftApp(record)) {
      if (!workspace) throw new Error("runtime");
      this.states.set(id, { status: "connecting" });
      this.changed();
      const probe = `settings-probe-${record.id}`;
      try {
        // A probe has its own document/library; never reuse a chat engine for Settings.
        const active = await this.artcraft.connect(
          record,
          fingerprint,
          workspace,
          probe,
        );
        const current = this.get(id, workspace);
        if (
          !this.store.isTrusted(current) ||
          this.store.fingerprint(current) !== fingerprint
        )
          throw new Error("invalid");
        this.store.markConnected(record);
        this.states.set(id, { status: "connected" });
        this.changed();
        return active;
      } catch (error) {
        this.states.set(id, {
          status: "error",
          error:
            error instanceof Error && error.message === "runtime"
              ? "runtime"
              : "connection",
        });
        this.changed();
        throw error;
      } finally {
        await this.artcraft.releaseConversation(probe);
      }
    }
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
      if (!this.live.has(id) && this.controllers.get(id) === controller)
        this.controllers.delete(id);
    }
  }
  private async establish(
    record: McpConnection,
    fingerprint: string,
    signal: AbortSignal,
  ): Promise<LiveConnection> {
    this.states.set(record.id, { status: "connecting" });
    this.changed();
    const client = new Client(
      { name: "const-harness", version: "1.0.0" },
      {
        capabilities: {
          extensions: {
            "io.modelcontextprotocol/ui": {
              mimeTypes: ["text/html;profile=mcp-app"],
            },
          },
        } as any,
      },
    );
    try {
      const secret = this.store.secrets(record.id);
      const headers = new Headers(secret.headers);
      if (record.auth === "api-key") {
        if (!secret.apiKey)
          throw new UnauthorizedError("Authentication required");
        headers.set("Authorization", `Bearer ${secret.apiKey}`);
      }
      const transport: Transport =
        record.transport === "builtin"
          ? await (async () => {
              if (
                record.key !== "plugin-obsidian-vault" ||
                record.builtin !== "obsidian" ||
                !record.vaultPath
              )
                throw new Error("vault");
              return obsidianTransport(record.vaultPath);
            })()
          : record.transport === "http"
            ? new StreamableHTTPClientTransport(validateEndpoint(record.url!), {
                authProvider:
                  record.auth === "oauth" &&
                  !isManagedGitHub(record) &&
                  !managedGoogleApp(record)
                    ? this.provider(record, undefined, undefined, signal)
                    : undefined,
                fetch: (input, init) => {
                  const bounded = {
                    ...init,
                    signal: AbortSignal.any([
                      signal,
                      AbortSignal.timeout(record.timeoutMs),
                      ...(init?.signal ? [init.signal] : []),
                    ]),
                  };
                  const broker = managedGoogleApp(record)
                    ? this.google
                    : isManagedGitHub(record)
                      ? this.github
                      : undefined;
                  return broker
                    ? broker.fetch(record, input, bounded).catch((error) => {
                        if (
                          error instanceof Error &&
                          ["auth", "scope", "account"].includes(error.message)
                        ) {
                          const active = this.live.get(record.id);
                          if (active) {
                            this.live.delete(record.id);
                            this.controllers.get(record.id)?.abort();
                            this.controllers.delete(record.id);
                            void active.client.close().catch(() => {});
                          }
                          this.states.set(record.id, {
                            status: "needs_auth",
                            error: error.message as
                              "auth" | "scope" | "account",
                          });
                          this.retryAfter.set(record.id, Date.now() + 30_000);
                          this.changed();
                        }
                        throw error;
                      })
                    : fetch(input, bounded);
                },
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
          this.controllers.get(record.id)?.abort();
          this.controllers.delete(record.id);
          this.states.set(record.id, { status: "disconnected" });
          this.changed();
        }
      };
      this.states.set(record.id, { status: "connected" });
      this.changed();
      return active;
    } catch (error) {
      await client.close().catch(() => {});
      const auth =
        error instanceof UnauthorizedError ||
        (error instanceof Error &&
          ["auth", "scope", "account"].includes(error.message));
      const reason =
        auth &&
        error instanceof Error &&
        ["scope", "account"].includes(error.message)
          ? (error.message as "scope" | "account")
          : error instanceof Error && error.message === "vault"
            ? "vault"
            : auth
              ? "auth"
              : "connection";
      this.retryAfter.set(record.id, Date.now() + 30_000);
      this.states.set(record.id, {
        status: auth ? "needs_auth" : "error",
        error: reason,
      });
      this.changed();
      throw new Error(reason);
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
          appResourceUri:
            typeof (tool._meta?.ui as any)?.resourceUri === "string" &&
            String((tool._meta?.ui as any).resourceUri).startsWith("ui://")
              ? String((tool._meta?.ui as any).resourceUri)
              : undefined,
          appOnly:
            Array.isArray((tool._meta?.ui as any)?.visibility) &&
            !(tool._meta?.ui as any).visibility.includes("model"),
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
    maxDirectTools = DIRECT_TOOL_LIMIT,
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
        (record.builtin !== "obsidian" || !!record.vaultPath) &&
        (record.builtin !== "editor" ||
          (!!editorApp(record) &&
            !!record.editorPrepared &&
            !!workspace &&
            (() => {
              try {
                editorProject(record, workspace);
                return true;
              } catch {
                return false;
              }
            })())) &&
        (record.builtin !== "artcraft" ||
          (!!artcraftApp(record) &&
            !!record.detectedRuntime &&
            !!workspace &&
            (ARTCRAFT_APPS[artcraftApp(record)!].roots ||
              !!record.localFileAccess))) &&
        record.status !== "needs_auth" &&
        this.store.isTrusted(record) &&
        (record.auth === "none" || record.hasCredentials) &&
        (this.retryAfter.get(record.id) ?? 0) <= Date.now(),
    );
    const definitions: NativeToolDefinition[] = [];
    // Desktop chat advertises a small catalog without waiting for network/stdio
    // discovery. Search connects integrations only when the model needs them.
    if (maxDirectTools === 0) return eligible.length ? CATALOG_TOOLS : [];
    let supportsApps = false;
    await Promise.all(
      eligible.map(async (record) => {
        if (signal?.aborted) return;
        if (artcraftApp(record) || editorApp(record)) {
          for (const tool of editorApp(record)
            ? EDITOR_GATEWAYS
            : ARTCRAFT_GATEWAYS)
            definitions.push({
              type: "function",
              requiresApproval: true,
              function: {
                name: exposedToolName(record.id, tool.name),
                description: `[${record.name}] ${editorApp(record) ? EDITORS[editorApp(record)!].name : ARTCRAFT_APPS[artcraftApp(record)!].keywords}. ${tool.description}`,
                parameters: tool.inputSchema,
              },
            });
          return;
        }
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
            if (!tool.appOnly)
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
          if (active.tools.some((tool) => tool.appResourceUri))
            supportsApps = true;
        } catch {
          /* One unavailable integration must not prevent a chat from starting. */
        }
      }),
    );
    if (supportsApps)
      definitions.push({
        type: "function",
        requiresApproval: false,
        function: {
          name: "mcp_read_app_context",
          description:
            "Read the latest user edits and local file of a displayed app before modifying its diagram. Use the app id returned in constMcpApp.",
          parameters: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
          },
        },
      });
    definitions.sort((a, b) => a.function.name.localeCompare(b.function.name));
    return definitions.length > maxDirectTools ? CATALOG_TOOLS : definitions;
  }
  async execute(
    name: string,
    args: Record<string, unknown>,
    workspace?: string,
    signal?: AbortSignal,
    conversation?: string,
  ): Promise<ToolExecutionResult> {
    try {
      if (name === "mcp_read_app_context") {
        const app = this.apps.get(String(args.id));
        if (
          !workspace ||
          path.resolve(workspace) !== path.resolve(app.workspace)
        )
          throw new Error("invalid");
        this.appConnection(app);
        return {
          result: JSON.stringify({
            checkpointId: app.checkpointId,
            filePath: app.filePath,
            userEdits: app.modelContext,
            elements: app.scene?.elements,
          }),
          isError: false,
        };
      }
      if (name === SEARCH_TOOLS) {
        if (
          typeof args.query !== "string" ||
          args.query.length > 1000 ||
          (args.limit !== undefined &&
            (!Number.isInteger(args.limit) ||
              Number(args.limit) < 1 ||
              Number(args.limit) > 20))
        )
          return {
            result:
              "Provide a search query and an optional limit from 1 to 20.",
            isError: true,
          };
        const available = await this.tools(
          workspace,
          signal,
          Number.MAX_SAFE_INTEGER,
        );
        const words = args.query
          .toLowerCase()
          .split(/[^\p{L}\p{N}_-]+/u)
          .filter(Boolean);
        const matches = available
          .map((tool) => {
            const text =
              `${tool.function.name} ${tool.function.description}`.toLowerCase();
            return {
              tool,
              score: words.filter((word) => text.includes(word)).length,
            };
          })
          .filter((item) => !words.length || item.score > 0)
          .sort(
            (a, b) =>
              b.score - a.score ||
              a.tool.function.name.localeCompare(b.tool.function.name),
          );
        return {
          result: JSON.stringify({
            totalMatches: matches.length,
            tools: matches
              .slice(0, Number(args.limit ?? 8))
              .map(({ tool }) => ({
                toolName: tool.function.name,
                description: tool.function.description,
                inputSchema: tool.function.parameters,
              })),
          }),
          isError: false,
        };
      }
      if (name === CALL_TOOL) {
        if (
          typeof args.toolName !== "string" ||
          (!/^mcp_[a-f0-9]{20}_/.test(args.toolName) &&
            args.toolName !== "mcp_read_app_context") ||
          !args.arguments ||
          typeof args.arguments !== "object" ||
          Array.isArray(args.arguments)
        )
          return {
            result:
              "Use an exact toolName and arguments from mcp_search_tools.",
            isError: true,
          };
        return this.execute(
          args.toolName,
          args.arguments as Record<string, unknown>,
          workspace,
          signal,
          conversation,
        );
      }
      for (const record of this.list(workspace)) {
        if (
          !record.isEffective ||
          !record.enabled ||
          !this.store.isTrusted(record)
        )
          continue;
        if (artcraftApp(record) || editorApp(record)) {
          const gateway = (
            editorApp(record) ? EDITOR_GATEWAYS : ARTCRAFT_GATEWAYS
          ).find((tool) => exposedToolName(record.id, tool.name) === name);
          if (!gateway) continue;
          if (!workspace || (!editorApp(record) && !conversation))
            return {
              result: editorApp(record)
                ? "The editor plugin needs an open workspace containing its selected project."
                : "ArtCraft needs a workspace and a stable chat session. Open a Main Chat and try again.",
              isError: true,
            };
          const fingerprint = this.store.fingerprint(record);
          const authorize = () => {
            const current = this.get(record.id, workspace);
            if (
              !this.store.isTrusted(current) ||
              this.store.fingerprint(current) !== fingerprint
            )
              throw new Error("invalid");
          };
          const result = editorApp(record)
            ? await this.editors
                .execute(
                  record,
                  workspace,
                  gateway.name,
                  args,
                  signal,
                  authorize,
                )
                .catch((error: unknown) => {
                  const code =
                    error instanceof Error &&
                    ["editor_setup", "editor_project", "editor_wait"].includes(
                      error.message,
                    )
                      ? (error.message as
                          "editor_setup" | "editor_project" | "editor_wait")
                      : "connection";
                  this.states.set(record.id, { status: "error", error: code });
                  this.changed();
                  throw error;
                })
            : await this.artcraft.execute(
                record,
                fingerprint,
                workspace,
                conversation!,
                gateway.name,
                args,
                signal,
                authorize,
              );
          this.store.markConnected(record);
          this.states.set(record.id, { status: "connected" });
          this.changed();
          const images = result.content.flatMap((item) =>
            item.type === "image" && item.data.length < 8_000_000
              ? [{ data: item.data, mimeType: item.mimeType }]
              : [],
          );
          const payload = JSON.stringify({
            content: result.content.filter((item) => item.type !== "image"),
            structuredContent:
              "structuredContent" in result
                ? result.structuredContent
                : undefined,
          });
          return {
            result:
              payload.length <= 100_000
                ? payload
                : JSON.stringify({
                    truncated: true,
                    content: [{ type: "text", text: payload.slice(0, 90_000) }],
                  }),
            images,
            isError: "isError" in result && result.isError === true,
          };
        }
        const active = this.live.get(record.id);
        const tool = active?.tools.find(
          (item) =>
            !item.appOnly && exposedToolName(record.id, item.name) === name,
        );
        if (
          !active ||
          !tool ||
          active.fingerprint !== this.store.fingerprint(record)
        )
          continue;
        let response;
        try {
          response = await active.client.callTool(
            { name: tool.name, arguments: args },
            undefined,
            { signal, timeout: record.timeoutMs },
          );
        } catch (error) {
          const auth =
            error instanceof UnauthorizedError ||
            (error instanceof StreamableHTTPError && error.code === 401) ||
            (error instanceof Error &&
              ["auth", "scope", "account"].includes(error.message));
          const broken =
            auth ||
            error instanceof StreamableHTTPError ||
            error instanceof TypeError ||
            (error instanceof McpError &&
              [ErrorCode.ConnectionClosed, ErrorCode.RequestTimeout].includes(
                error.code,
              )) ||
            (error instanceof Error && error.message === "connection");
          if (
            !signal?.aborted &&
            broken &&
            this.live.get(record.id) === active
          ) {
            this.live.delete(record.id);
            this.controllers.get(record.id)?.abort();
            this.controllers.delete(record.id);
            void active.client.close().catch(() => {});
            this.states.set(record.id, {
              status: auth ? "needs_auth" : "error",
              error: auth ? "auth" : "connection",
            });
            // Rediscover an expired session on the next round, without replaying this tool call.
            if (error instanceof StreamableHTTPError && error.code === 404)
              this.retryAfter.delete(record.id);
            else this.retryAfter.set(record.id, Date.now() + 30_000);
            this.changed();
          }
          throw error;
        }
        const result = CallToolResultSchema.parse(response);
        let constMcpApp;
        if (!result.isError && tool.appResourceUri && workspace) {
          let scene;
          const checkpointId =
            typeof result.structuredContent?.checkpointId === "string"
              ? result.structuredContent.checkpointId
              : undefined;
          if (record.key === "plugin-excalidraw-excalidraw" && checkpointId) {
            try {
              const checkpoint = await active.client.callTool({
                name: "read_checkpoint",
                arguments: { id: checkpointId },
              });
              const block = (checkpoint.content as any[])?.find(
                (item) => item.type === "text",
              );
              const value = JSON.parse(block?.text ?? "{}");
              if (Array.isArray(value.elements)) scene = value;
            } catch {
              /* Inputs remain available if the server's checkpoint read is unavailable. */
            }
          }
          const app = this.apps.create({
            connectionId: record.id,
            fingerprint: active.fingerprint,
            workspace: path.resolve(workspace),
            title: record.name,
            resourceUri: tool.appResourceUri,
            arguments: args,
            result: {
              content: result.content,
              structuredContent: result.structuredContent,
            },
            checkpointId,
            scene,
            kind:
              record.key === "plugin-excalidraw-excalidraw" &&
              tool.appResourceUri === "ui://excalidraw/mcp-app.html"
                ? "excalidraw"
                : undefined,
          });
          constMcpApp = {
            id: app.id,
            title: app.title,
            filePath: app.filePath,
            contextTool: "mcp_read_app_context",
          };
        }
        const images = result.content.flatMap((item) =>
          item.type === "image" && item.data.length < 8_000_000
            ? [{ data: item.data, mimeType: item.mimeType }]
            : [],
        );
        const text = result.content.filter((item) => item.type !== "image");
        const payload = JSON.stringify({
          constMcpApp,
          content: text,
          structuredContent: result.structuredContent,
        });
        return {
          result:
            constMcpApp && payload.length > 100_000
              ? JSON.stringify({
                  constMcpApp,
                  content: [{ type: "text", text: payload.slice(0, 90000) }],
                })
              : payload.slice(0, 100_000),
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

  private appConnection(app: StoredApp) {
    const record = this.get(app.connectionId, app.workspace);
    if (
      !this.store.isTrusted(record) ||
      this.store.fingerprint(record) !== app.fingerprint
    )
      throw new Error("invalid");
    return record;
  }
  async appView(id: string): Promise<McpAppView> {
    const app = this.apps.get(id);
    const record = this.appConnection(app);
    const active = await this.connect(record.id, app.workspace);
    if (!active.tools.some((tool) => tool.appResourceUri === app.resourceUri))
      throw new Error("invalid");
    const resource = await active.client.readResource({ uri: app.resourceUri });
    this.appConnection(app);
    const page = resource.contents.find(
      (item) =>
        item.uri === app.resourceUri &&
        "text" in item &&
        item.mimeType?.startsWith("text/html"),
    );
    if (!page || !("text" in page) || page.text.length > 8_000_000)
      throw new Error("invalid");
    const ui = page._meta?.ui as any;
    return {
      id: app.id,
      title: app.title,
      filePath: app.filePath,
      resourceUri: app.resourceUri,
      html: page.text,
      csp: {
        resourceDomains: ui?.csp?.resourceDomains,
        connectDomains: ui?.csp?.connectDomains,
      },
      arguments: app.arguments,
      result: app.result,
      scene: app.scene,
    };
  }
  async appCall(
    id: string,
    name: string,
    args: Record<string, unknown>,
    approved = false,
  ) {
    const app = this.apps.get(id);
    const record = this.appConnection(app);
    // The initial Excalidraw app may only read its approved checkpoints or save its own edits.
    if (
      record.key !== "plugin-excalidraw-excalidraw" ||
      !["read_checkpoint", "save_checkpoint", "export_to_excalidraw"].includes(
        name,
      )
    )
      throw new Error("invalid");
    if (
      name === "export_to_excalidraw" &&
      (!approved ||
        typeof args.json !== "string" ||
        args.json.length > 5_000_000)
    )
      throw new Error("invalid");
    let restoreIds: string[] = [];
    try {
      restoreIds = JSON.parse(String(app.arguments.elements))
        .filter((element: any) => element.type === "restoreCheckpoint")
        .map((element: any) => element.id);
    } catch {}
    if (
      name !== "export_to_excalidraw" &&
      args.id !== app.checkpointId &&
      !(name === "read_checkpoint" && restoreIds.includes(String(args.id)))
    )
      throw new Error("invalid");
    if (name === "read_checkpoint" && args.id === app.checkpointId && app.scene)
      return { content: [{ type: "text", text: JSON.stringify(app.scene) }] };
    if (name === "save_checkpoint") {
      if (typeof args.data !== "string" || args.data.length > 8_000_000)
        throw new Error("invalid");
      const incoming = JSON.parse(args.data);
      this.apps.saveScene(id, {
        ...app.scene,
        ...incoming,
        files: incoming.files ?? app.scene?.files,
        appState: incoming.appState ?? app.scene?.appState,
      });
    }
    const active = await this.connect(record.id, app.workspace);
    if (!active.tools.some((tool) => tool.name === name && tool.appOnly))
      throw new Error("invalid");
    return CallToolResultSchema.parse(
      await active.client.callTool({ name, arguments: args }),
    );
  }
  appContext(id: string, text: string) {
    const app = this.apps.get(id);
    this.appConnection(app);
    if (typeof text !== "string" || text.length > 200_000)
      throw new Error("invalid");
    this.apps.save({ ...app, modelContext: text });
  }
  async saveDiagram(id: string, scene: NonNullable<McpAppView["scene"]>) {
    const filePath = this.apps.saveScene(id, scene);
    const app = this.apps.get(id);
    if (app.checkpointId) {
      try {
        await this.appCall(id, "save_checkpoint", {
          id: app.checkpointId,
          data: JSON.stringify({ elements: scene.elements }),
        });
      } catch {
        /* A local diagram remains editable when its MCP server is unavailable. */
      }
    }
    return filePath;
  }
  readDiagram(filePath: string) {
    return this.apps.byPath(filePath);
  }
}
