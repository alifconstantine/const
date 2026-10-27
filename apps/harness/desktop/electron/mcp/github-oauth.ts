import { createHash } from "node:crypto";
import type { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { McpConnection } from "../../src/lib/mcp/types";
import { McpStore, validateEndpoint } from "./store";

export const GITHUB_MCP_URL = "https://api.githubcopilot.com/mcp/";
export function isManagedGitHub(record: McpConnection) {
  return (
    record.key === "plugin-github-github" &&
    record.transport === "http" &&
    record.url === GITHUB_MCP_URL &&
    record.auth === "oauth" &&
    !record.clientId
  );
}
interface Grant {
  tokens: OAuthTokens;
  grant?: string;
  expiresAt?: number;
}

/** Only Electron calls this broker. Public configuration never includes its grants/tokens. */
export class GitHubOAuthClient {
  readonly origin: string;
  private readonly request: typeof fetch;
  private refreshing = new Map<string, Promise<string>>();
  constructor(
    private readonly store: McpStore,
    options: { origin?: string; fetch?: typeof fetch } = {},
  ) {
    const url = validateEndpoint(
      options.origin ??
        process.env.CONST_GITHUB_OAUTH_ORIGIN ??
        "https://accounts.const.web.id",
    );
    if (url.pathname !== "/" || url.search) throw new Error("invalid");
    this.origin = url.origin;
    this.request = options.fetch ?? fetch;
  }
  private async post(
    path: string,
    value: object,
    signal: AbortSignal,
  ): Promise<Grant> {
    const response = await this.request(this.origin + "/oauth/github/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    });
    if ([404, 503].includes(response.status)) throw new Error("setup");
    if (response.status === 429 || response.status >= 500)
      throw new Error("connection");
    if (!response.ok) throw new Error("auth");
    const data = await response.json();
    if (
      typeof data.access_token !== "string" ||
      !data.access_token ||
      data.access_token.length > 16384 ||
      data.token_type !== "Bearer" ||
      (data.refresh_token !== undefined &&
        (typeof data.refresh_token !== "string" ||
          !data.refresh_token ||
          data.refresh_token.length > 16384 ||
          typeof data.grant !== "string" ||
          !data.grant)) ||
      (data.grant !== undefined &&
        (typeof data.grant !== "string" || data.grant.length > 4096)) ||
      (data.expires_in !== undefined &&
        (!Number.isInteger(data.expires_in) ||
          data.expires_in <= 0 ||
          data.expires_in > 366 * 86400))
    )
      throw new Error("auth");
    return {
      tokens: {
        access_token: data.access_token,
        token_type: "Bearer",
        ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
        ...(data.expires_in ? { expires_in: data.expires_in } : {}),
      },
      grant: data.grant,
      expiresAt: data.expires_in
        ? Date.now() + data.expires_in * 1000
        : undefined,
    };
  }
  async authorizationUrl(
    state: string,
    challenge: string,
    language: string,
    signal: AbortSignal,
  ) {
    const response = await this.request(this.origin + "/oauth/github/config", {
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
    if (!response.ok || !(await response.json()).configured)
      throw new Error("setup");
    const url = new URL(this.origin + "/oauth/github/start");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("language", language);
    return url.toString();
  }
  private current(record: McpConnection, signal: AbortSignal) {
    const saved = this.store.get(record.id, record.workspacePath);
    if (
      signal.aborted ||
      !saved.enabled ||
      !this.store.isTrusted(saved) ||
      this.store.fingerprint(saved) !== this.store.fingerprint(record)
    )
      throw new Error("auth");
    return this.store.secrets(record.id);
  }
  async exchange(
    record: McpConnection,
    code: string,
    ticket: string,
    verifier: string,
    signal: AbortSignal,
  ) {
    const result = await this.post(
      "exchange",
      { code, ticket, verifier },
      signal,
    );
    const current = this.current(record, signal);
    this.store.writeSecrets(record.id, {
      ...current,
      tokens: result.tokens,
      githubOAuth: { grant: result.grant, expiresAt: result.expiresAt },
    });
  }
  private async refresh(
    record: McpConnection,
    signal: AbortSignal,
    rejectedToken?: string,
  ): Promise<string> {
    const current = this.current(record, signal);
    if (
      rejectedToken &&
      current.tokens?.access_token &&
      current.tokens.access_token !== rejectedToken
    )
      return current.tokens.access_token;
    const pending = this.refreshing.get(record.id);
    if (pending) return pending;
    const operation = (async () => {
      const refreshToken = current.tokens?.refresh_token;
      if (!refreshToken || !current.githubOAuth?.grant) throw new Error("auth");
      const result = await this.post(
        "refresh",
        { refresh_token: refreshToken, grant: current.githubOAuth.grant },
        signal,
      );
      const latest = this.current(record, signal);
      // Disconnect, reauthorization, and token rotation invalidate an in-flight refresh.
      if (
        latest.tokens?.refresh_token !== refreshToken ||
        latest.githubOAuth?.grant !== current.githubOAuth?.grant
      )
        throw new Error("auth");
      this.store.writeSecrets(record.id, {
        ...latest,
        tokens: result.tokens,
        githubOAuth: { grant: result.grant, expiresAt: result.expiresAt },
      });
      return result.tokens.access_token;
    })();
    this.refreshing.set(record.id, operation);
    try {
      return await operation;
    } finally {
      if (this.refreshing.get(record.id) === operation)
        this.refreshing.delete(record.id);
    }
  }
  async fetch(
    record: McpConnection,
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1] = {},
  ) {
    const target = new URL(
      input instanceof Request ? input.url : String(input),
    );
    if (
      target.origin !== new URL(GITHUB_MCP_URL).origin ||
      !target.pathname.startsWith("/mcp/") ||
      target.username ||
      target.password
    )
      throw new Error("invalid");
    const signal = init?.signal ?? AbortSignal.timeout(record.timeoutMs);
    const current = this.current(record, signal);
    let token = current.tokens?.access_token;
    if (!token) throw new Error("auth");
    if (
      current.githubOAuth?.expiresAt &&
      current.githubOAuth.expiresAt <= Date.now() + 60_000
    )
      token = await this.refresh(record, signal);
    const send = (value: string) => {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", "Bearer " + value);
      return this.request(input, { ...init, headers, redirect: "error" });
    };
    const response = await send(token);
    if (response.status !== 401) return response;
    await response.body?.cancel();
    const renewed = await this.refresh(record, signal, token);
    return send(renewed);
  }
  static challenge(verifier: string) {
    return createHash("sha256").update(verifier).digest("base64url");
  }
}
