import { createHash } from "node:crypto";
import type { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { McpConnection } from "../../src/lib/mcp/types";
import {
  GOOGLE_CONNECTORS,
  GOOGLE_MCP_ORIGIN,
  googleMcpUrl,
  hasGoogleScopes,
  normalizeGoogleScopes,
  type GoogleApp,
} from "../../../shared/google-connectors";
import { McpStore, validateEndpoint, type McpSecrets } from "./store";

export function managedGoogleApp(record: McpConnection): GoogleApp | undefined {
  if (record.transport !== "http" || record.auth !== "oauth" || record.clientId)
    return;
  return (Object.keys(GOOGLE_CONNECTORS) as GoogleApp[]).find(
    (app) =>
      record.key === `plugin-${GOOGLE_CONNECTORS[app].plugin}-${app}` &&
      record.url === googleMcpUrl(app),
  );
}
type Account = McpSecrets & {
  tokens: OAuthTokens;
  googleOAuth: NonNullable<McpSecrets["googleOAuth"]>;
};
/** A single encrypted Google account per scope. Plugin records contain only a local vault reference. */
export class GoogleOAuthClient {
  readonly origin: string;
  private request: typeof fetch;
  private refreshing = new Map<string, Promise<string>>();
  constructor(
    private store: McpStore,
    options: { origin?: string; fetch?: typeof fetch } = {},
  ) {
    const url = validateEndpoint(
      options.origin ??
        process.env.CONST_GOOGLE_OAUTH_ORIGIN ??
        GOOGLE_MCP_ORIGIN,
    );
    if (url.pathname !== "/" || url.search || url.hash)
      throw new Error("invalid");
    this.origin = url.origin;
    this.request = options.fetch ?? fetch;
  }
  accountId(record: McpConnection) {
    const workspace =
      process.platform === "win32"
        ? record.workspacePath?.toLowerCase()
        : record.workspacePath;
    return (
      "google-account-" +
      createHash("sha256")
        .update(record.scope === "user" ? "user" : "workspace:" + workspace)
        .digest("hex")
    );
  }
  private account(record: McpConnection): Account | undefined {
    const value = this.store.secrets(this.accountId(record));
    return value.tokens && value.googleOAuth ? (value as Account) : undefined;
  }
  credentials(record: McpConnection) {
    const app = managedGoogleApp(record);
    const account = this.account(record);
    const linked =
      this.store.secrets(record.id).googleAccountId === this.accountId(record);
    return app &&
      linked &&
      account &&
      hasGoogleScopes(app, account.googleOAuth.scopes)
      ? account
      : undefined;
  }
  reuse(record: McpConnection) {
    const app = managedGoogleApp(record);
    const account = this.account(record);
    if (!app || !account || !hasGoogleScopes(app, account.googleOAuth.scopes))
      return false;
    if (!this.store.isTrusted(record)) throw new Error("auth");
    this.store.writeSecrets(record.id, {
      ...this.store.secrets(record.id),
      googleAccountId: this.accountId(record),
    });
    return true;
  }
  unlink(record: McpConnection) {
    const key = this.accountId(record);
    const { googleAccountId: _, ...remaining } = this.store.secrets(record.id);
    if (Object.keys(remaining).length)
      this.store.writeSecrets(record.id, remaining);
    else this.store.clearSecrets(record.id);
    const shared = this.store
      .list(record.workspacePath)
      .some(
        (other) =>
          other.id !== record.id &&
          managedGoogleApp(other) &&
          this.accountId(other) === key &&
          this.store.isTrusted(other) &&
          this.store.secrets(other.id).googleAccountId === key,
      );
    if (!shared) this.store.clearSecrets(key);
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
    return this.credentials(record);
  }
  private async post(
    path: string,
    value: object,
    signal: AbortSignal,
  ): Promise<Account> {
    const response = await this.request(`${this.origin}/oauth/google/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    });
    if ([404, 503].includes(response.status)) throw new Error("setup");
    if (response.status === 429 || response.status >= 500)
      throw new Error("connection");
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        ["account", "scope"].includes(data.error) ? data.error : "auth",
      );
    }
    const data = await response.json();
    if (
      typeof data.access_token !== "string" ||
      !data.access_token ||
      data.access_token.length > 16384 ||
      data.token_type !== "Bearer" ||
      typeof data.refresh_token !== "string" ||
      !data.refresh_token ||
      data.refresh_token.length > 16384 ||
      typeof data.grant !== "string" ||
      !data.grant ||
      data.grant.length > 8192 ||
      !Number.isInteger(data.expires_in) ||
      data.expires_in < 1 ||
      data.expires_in > 86400 ||
      typeof data.subject !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(data.subject) ||
      typeof data.scope !== "string" ||
      data.scope.length > 8192 ||
      (data.email !== undefined &&
        (typeof data.email !== "string" || data.email.length > 320))
    )
      throw new Error("auth");
    return {
      tokens: {
        access_token: data.access_token,
        token_type: "Bearer",
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        scope: data.scope,
      },
      googleOAuth: {
        grant: data.grant,
        expiresAt: Date.now() + data.expires_in * 1000,
        subject: data.subject,
        email: data.email,
        scopes: normalizeGoogleScopes(data.scope),
      },
    };
  }
  async authorizationUrl(
    record: McpConnection,
    state: string,
    challenge: string,
    language: string,
    signal: AbortSignal,
  ) {
    const app = managedGoogleApp(record);
    if (!app) throw new Error("invalid");
    const response = await this.request(this.origin + "/oauth/google/config", {
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
    if (!response.ok || !(await response.json()).configured)
      throw new Error("setup");
    const url = new URL(this.origin + "/oauth/google/start");
    for (const [key, value] of Object.entries({
      app,
      state,
      code_challenge: challenge,
      language,
    }))
      url.searchParams.set(key, value);
    const account = this.account(record);
    if (account) {
      // An expired receipt must not prevent fresh consent. Exchange still pins the saved subject.
      try {
        const receipt = JSON.parse(
          Buffer.from(
            account.googleOAuth.grant.split(".")[0]!,
            "base64url",
          ).toString(),
        );
        if (receipt.exp > Date.now() / 1000 + 10)
          url.searchParams.set("grant", account.googleOAuth.grant);
      } catch {
        /* Fresh consent repairs an obsolete receipt. */
      }
    }
    return url.toString();
  }
  async exchange(
    record: McpConnection,
    code: string,
    ticket: string,
    verifier: string,
    signal: AbortSignal,
  ) {
    const previous = this.account(record);
    const result = await this.post(
      "exchange",
      { code, ticket, verifier },
      signal,
    );
    this.current(record, signal);
    const latest = this.account(record);
    if (
      latest?.googleOAuth.grant !== previous?.googleOAuth.grant ||
      (latest && latest.googleOAuth.subject !== result.googleOAuth.subject)
    )
      throw new Error("account");
    const app = managedGoogleApp(record)!;
    if (!hasGoogleScopes(app, result.googleOAuth.scopes))
      throw new Error("scope");
    this.store.writeSecrets(this.accountId(record), result);
    this.store.writeSecrets(record.id, {
      ...this.store.secrets(record.id),
      googleAccountId: this.accountId(record),
    });
  }
  private async refresh(
    record: McpConnection,
    signal: AbortSignal,
    rejected?: string,
  ): Promise<string> {
    const current = this.current(record, signal);
    if (!current) throw new Error("auth");
    if (rejected && current.tokens.access_token !== rejected)
      return current.tokens.access_token;
    const key = this.accountId(record);
    const pending = this.refreshing.get(key);
    if (pending) return pending;
    const operation = (async () => {
      const result = await this.post(
        "refresh",
        {
          refresh_token: current.tokens.refresh_token,
          grant: current.googleOAuth.grant,
        },
        signal,
      );
      const latest = this.current(record, signal);
      if (
        !latest ||
        latest.googleOAuth.grant !== current.googleOAuth.grant ||
        latest.tokens.refresh_token !== current.tokens.refresh_token ||
        result.googleOAuth.subject !== current.googleOAuth.subject
      )
        throw new Error("auth");
      this.store.writeSecrets(key, result);
      if (
        !hasGoogleScopes(managedGoogleApp(record)!, result.googleOAuth.scopes)
      )
        throw new Error("scope");
      return result.tokens.access_token;
    })();
    this.refreshing.set(key, operation);
    try {
      return await operation;
    } finally {
      if (this.refreshing.get(key) === operation) this.refreshing.delete(key);
    }
  }
  async fetch(
    record: McpConnection,
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1] = {},
  ) {
    const app = managedGoogleApp(record);
    const target = new URL(
      input instanceof Request ? input.url : String(input),
    );
    if (!app || target.toString() !== googleMcpUrl(app))
      throw new Error("invalid");
    const signal = init.signal ?? AbortSignal.timeout(record.timeoutMs);
    const current = this.current(record, signal);
    if (!current) throw new Error("auth");
    let token = current.tokens.access_token;
    if (current.googleOAuth.expiresAt <= Date.now() + 60_000)
      token = await this.refresh(record, signal);
    const send = (value: string) => {
      if (!this.current(record, signal)) throw new Error("auth");
      const headers = new Headers(init.headers);
      headers.set("Authorization", "Bearer " + value);
      return this.request(input, { ...init, headers, redirect: "error" });
    };
    const response = await send(token);
    if (response.status !== 401) return response;
    await response.body?.cancel();
    const retried = await send(await this.refresh(record, signal, token));
    if (retried.status === 401) {
      await retried.body?.cancel();
      throw new Error("auth");
    }
    return retried;
  }
}
