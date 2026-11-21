import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import type { ProviderDialect } from "@const/agent/const";

export type SubscriptionProviderId =
  | "openai-codex"
  | "anthropic"
  | "google-gemini-cli"
  | "github-copilot"
  | "openrouter"
  | "xai-oauth"
  | "kimi-code"
  | "gitlab-duo";

export interface SubscriptionModelPreset {
  id: string;
  name: string;
  contextWindow?: string;
  maxOutput?: string;
  supportsThinking?: boolean;
  thinkingLevels?: string[];
  inputTypes?: string[];
}

export interface SubscriptionProviderMeta {
  id: SubscriptionProviderId;
  name: string;
  shortName: string;
  description: string;
  protocol: ProviderDialect;
  baseUrl: string;
  authFlow: "oauth-pkce" | "device-code";
  supportsManualCode?: boolean;
  warning?: string;
  models: SubscriptionModelPreset[];
}

export interface StoredOAuthCredential {
  provider: SubscriptionProviderId;
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when accessToken expires. */
  expiresAt: number;
  email?: string;
  accountId?: string;
  orgId?: string;
  orgName?: string;
  planType?: string;
  projectId?: string;
  /** For GitHub Copilot: long-lived GitHub OAuth token used to mint short-lived Copilot session tokens. */
  githubToken?: string;
  /** For GitHub Copilot: dynamic API endpoint returned by copilot_internal/v2/token. */
  apiBaseUrl?: string;
  /** Models fetched live from the provider after connecting. */
  discoveredModels?: SubscriptionModelPreset[];
  /** Epoch ms when discoveredModels was last fetched. */
  discoveredAt?: number;
  connectedAt: number;
  updatedAt: number;
}

export interface PublicSubscriptionStatus {
  provider: SubscriptionProviderId;
  connected: boolean;
  email?: string;
  accountId?: string;
  orgName?: string;
  planType?: string;
  projectId?: string;
  expiresAt?: number;
  discoveredAt?: number;
  connectedAt?: number;
}

export interface SubscriptionLoginProgress {
  provider: SubscriptionProviderId;
  status: "starting" | "awaiting_browser" | "awaiting_device_code" | "exchanging" | "connected" | "error" | "cancelled";
  authUrl?: string;
  userCode?: string;
  verificationUri?: string;
  message?: string;
  error?: string;
}

export const SUBSCRIPTION_PROVIDERS: Record<SubscriptionProviderId, SubscriptionProviderMeta> = {
  "openai-codex": {
    id: "openai-codex",
    name: "OpenAI",
    shortName: "OpenAI",
    description: "Sign in with your ChatGPT / OpenAI account.",
    protocol: "openai-codex",
    baseUrl: "https://chatgpt.com/backend-api/codex/responses",
    authFlow: "oauth-pkce",
    supportsManualCode: true,
    models: [],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    shortName: "Anthropic",
    description: "Sign in with your Claude / Anthropic account.",
    protocol: "anthropic-messages",
    baseUrl: "https://api.anthropic.com/v1",
    authFlow: "oauth-pkce",
    supportsManualCode: true,
    models: [],
  },
  "google-gemini-cli": {
    id: "google-gemini-cli",
    name: "Google",
    shortName: "Google",
    description: "Sign in with your Google account.",
    protocol: "google-gemini-cli",
    baseUrl: "https://cloudcode-pa.googleapis.com",
    authFlow: "oauth-pkce",
    supportsManualCode: true,
    models: [],
  },
  "github-copilot": {
    id: "github-copilot",
    name: "GitHub Copilot",
    shortName: "GitHub Copilot",
    description: "Sign in with your GitHub account.",
    protocol: "github-copilot",
    baseUrl: "https://api.githubcopilot.com",
    authFlow: "device-code",
    models: [],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    shortName: "OpenRouter",
    description: "Sign in with your OpenRouter account.",
    protocol: "openai-completions",
    baseUrl: "https://openrouter.ai/api/v1",
    authFlow: "oauth-pkce",
    supportsManualCode: true,
    models: [],
  },
  "xai-oauth": {
    id: "xai-oauth",
    name: "xAI",
    shortName: "xAI",
    description: "Sign in with your xAI account.",
    protocol: "openai-completions",
    baseUrl: "https://api.x.ai/v1",
    authFlow: "device-code",
    models: [],
  },
  "kimi-code": {
    id: "kimi-code",
    name: "Kimi",
    shortName: "Kimi",
    description: "Sign in with your Kimi account.",
    protocol: "openai-completions",
    baseUrl: "https://api.kimi.com/coding/v1",
    authFlow: "device-code",
    models: [],
  },
  "gitlab-duo": {
    id: "gitlab-duo",
    name: "GitLab",
    shortName: "GitLab",
    description: "Sign in with your GitLab account.",
    protocol: "openai-completions",
    baseUrl: "https://cloud.gitlab.com/ai/v1/proxy/openai/v1",
    authFlow: "oauth-pkce",
    supportsManualCode: true,
    models: [],
  },
};

export interface SecretCipher {
  encrypt: (plain: string) => Buffer;
  decrypt: (encrypted: Buffer) => string;
}

export interface OAuthManagerOptions {
  storePath?: string;
  cipher?: SecretCipher;
  openExternalUrl?: (url: string) => Promise<void> | void;
  fetchImpl?: typeof fetch;
}

// Public OAuth client constants (matching open-source CLI/editor clients in pi / oh-my-pi / opencode)
const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_AUTH_URL = "https://auth.openai.com/oauth/authorize";
const OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token";
const OPENAI_CALLBACK_PORT = 1455;
const OPENAI_CALLBACK_PATH = "/auth/callback";

const ANTHROPIC_CLIENT_ID = Buffer.from(
  "OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl",
  "base64",
).toString("utf8");
const ANTHROPIC_AUTH_URL = "https://claude.ai/oauth/authorize";
const ANTHROPIC_TOKEN_URL = "https://api.anthropic.com/v1/oauth/token";
const ANTHROPIC_BOOTSTRAP_URL = "https://api.anthropic.com/api/claude_cli/bootstrap";
const ANTHROPIC_CALLBACK_PORT = 54545;
const ANTHROPIC_CALLBACK_PATH = "/callback";

function getGoogleCliOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = (
    process.env.CONST_GOOGLE_GEMINI_CLI_CLIENT_ID ||
    process.env.GOOGLE_GEMINI_CLI_CLIENT_ID ||
    ""
  ).trim();
  const clientSecret = (
    process.env.CONST_GOOGLE_GEMINI_CLI_CLIENT_SECRET ||
    process.env.GOOGLE_GEMINI_CLI_CLIENT_SECRET ||
    ""
  ).trim();
  return { clientId, clientSecret };
}
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
const GOOGLE_CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com";
const GOOGLE_CALLBACK_PORT = 8085;
const GOOGLE_CALLBACK_PATH = "/oauth2callback";

const GITHUB_COPILOT_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";

const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_TOKEN_URL = "https://openrouter.ai/api/v1/auth/keys";
const OPENROUTER_CALLBACK_PORT = 54549;

const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_DEVICE_CODE_URL = "https://auth.x.ai/oauth2/device/code";
const XAI_TOKEN_URL = "https://auth.x.ai/oauth2/token";
const XAI_USERINFO_URL = "https://auth.x.ai/oauth2/userinfo";

const KIMI_OAUTH_CLIENT_ID = "17e5f671-d194-4dfb-9706-5516cb48c098";
const KIMI_AUTH_BASE = (process.env.KIMI_CODE_OAUTH_HOST || process.env.KIMI_OAUTH_HOST || "https://auth.kimi.com").replace(/\/+$/, "");

const GITLAB_CLIENT_ID = (process.env.GITLAB_CLIENT_ID || "da4edff2e6ebd2bc3208611e2768bc1c1dd7be791dc5ff26ca34ca9ee44f7d4b").trim();
const GITLAB_AUTH_URL = "https://gitlab.com/oauth/authorize";
const GITLAB_TOKEN_URL = "https://gitlab.com/oauth/token";
const GITLAB_CALLBACK_PORT = 8080;

function generatePkce(): { verifier: string; challenge: string; state: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");
  return { verifier, challenge, state };
}

export function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function extractOpenAiAccountProfile(accessToken: string, idToken?: string): {
  accountId?: string;
  email?: string;
  planType?: string;
} {
  const accessClaims = decodeJwtPayload(accessToken);
  const idClaims = idToken ? decodeJwtPayload(idToken) : null;
  const authA = accessClaims?.["https://api.openai.com/auth"];
  const authI = idClaims?.["https://api.openai.com/auth"];
  const profileA = accessClaims?.["https://api.openai.com/profile"];
  const profileI = idClaims?.["https://api.openai.com/profile"];
  const accountId =
    authA?.chatgpt_account_id ||
    authI?.chatgpt_account_id ||
    idClaims?.chatgpt_account_id ||
    idClaims?.organizations?.[0]?.id;
  const email = profileA?.email || profileI?.email || idClaims?.email;
  const planType = authA?.chatgpt_plan_type || authI?.chatgpt_plan_type;
  return {
    accountId: typeof accountId === "string" && accountId ? accountId : undefined,
    email: typeof email === "string" && email ? email.trim().toLowerCase() : undefined,
    planType: typeof planType === "string" && planType ? planType.trim().toLowerCase() : undefined,
  };
}

function callbackSuccessHtml(providerName: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Const Harness</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #121212; color: #ededed; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { background: #1d1d1d; border: 1px solid #2e2e2e; border-radius: 16px; padding: 32px 36px; text-align: center; max-width: 420px; box-shadow: 0 20px 50px rgba(0,0,0,.45); }
  h1 { font-size: 18px; margin: 0 0 8px; font-weight: 600; }
  p { font-size: 13px; color: #9a9a9a; margin: 0; line-height: 1.5; }
  .dot { width: 10px; height: 10px; border-radius: 999px; background: #22c55e; display: inline-block; margin-right: 8px; }
</style>
</head>
<body>
  <div class="card">
    <h1><span class="dot"></span>Connected to ${providerName}</h1>
    <p>Authentication succeeded. You can close this browser tab and return to Const Harness.</p>
  </div>
</body>
</html>`;
}

function parseAuthorizationCodeInput(raw: string): { code?: string; state?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      return {
        code: url.searchParams.get("code") || undefined,
        state: url.searchParams.get("state") || undefined,
      };
    } catch {
      return {};
    }
  }
  if (trimmed.includes("#")) {
    const [code, state] = trimmed.split("#", 2);
    return { code: code?.trim() || undefined, state: state?.trim() || undefined };
  }
  return { code: trimmed };
}

interface PendingLogin {
  provider: SubscriptionProviderId;
  abort: AbortController;
  submitManualCode?: (raw: string) => void;
}

/**
 * Manages OAuth subscription logins, encrypted token persistence (Electron safeStorage),
 * and automatic background token refresh for OpenAI Codex, Claude Pro/Max,
 * Google Gemini CLI (Cloud Code Assist), and GitHub Copilot.
 */
export class OAuthSubscriptionManager {
  private readonly storePath: string;
  private readonly cipher?: SecretCipher;
  private readonly openExternalUrl?: (url: string) => Promise<void> | void;
  private readonly fetchImpl: typeof fetch;
  private cache: Partial<Record<SubscriptionProviderId, StoredOAuthCredential>> = {};
  private loaded = false;
  private activeLogins = new Map<SubscriptionProviderId, PendingLogin>();
  private refreshLocks = new Map<SubscriptionProviderId, Promise<StoredOAuthCredential>>();
  private modelFetchLocks = new Map<SubscriptionProviderId, Promise<SubscriptionModelPreset[]>>();

  constructor(options: OAuthManagerOptions = {}) {
    this.storePath =
      options.storePath ??
      path.join(os.homedir(), ".const", "harness", "oauth-subscriptions.enc");
    this.cipher = options.cipher;
    this.openExternalUrl = options.openExternalUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!fs.existsSync(this.storePath)) return;
      const rawBuf = fs.readFileSync(this.storePath);
      if (!rawBuf.length) return;
      let text: string;
      if (this.cipher) {
        try {
          text = this.cipher.decrypt(rawBuf);
        } catch {
          // Allow seamless recovery if cipher unavailable on dev machines
          text = rawBuf.toString("utf8");
        }
      } else {
        text = rawBuf.toString("utf8");
      }
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        this.cache = parsed;
      }
    } catch {
      this.cache = {};
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      const json = JSON.stringify(this.cache);
      const tmp = `${this.storePath}.${process.pid}.tmp`;
      if (this.cipher) {
        try {
          fs.writeFileSync(tmp, this.cipher.encrypt(json), { mode: 0o600 });
          fs.renameSync(tmp, this.storePath);
          return;
        } catch {
          // Fallback to restricted-permission JSON if OS keychain is unavailable
        }
      }
      fs.writeFileSync(tmp, json, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmp, this.storePath);
    } catch (err) {
      console.error("[OAuthSubscriptionManager] Failed to persist credentials:", err);
    }
  }

  public listProviders(): Array<SubscriptionProviderMeta & { status: PublicSubscriptionStatus }> {
    this.ensureLoaded();
    return (Object.keys(SUBSCRIPTION_PROVIDERS) as SubscriptionProviderId[]).map((id) => ({
      ...SUBSCRIPTION_PROVIDERS[id],
      models: this.cache[id]?.discoveredModels ?? [],
      status: this.getPublicStatus(id),
    }));
  }

  public getCachedModels(provider: SubscriptionProviderId): SubscriptionModelPreset[] {
    this.ensureLoaded();
    return this.cache[provider]?.discoveredModels ?? [];
  }

  public getPublicStatus(provider: SubscriptionProviderId): PublicSubscriptionStatus {
    this.ensureLoaded();
    const cred = this.cache[provider];
    if (!cred || !cred.accessToken) {
      return { provider, connected: false };
    }
    return {
      provider,
      connected: true,
      email: cred.email,
      accountId: cred.accountId,
      orgName: cred.orgName,
      planType: cred.planType,
      projectId: cred.projectId,
      expiresAt: cred.expiresAt,
      discoveredAt: cred.discoveredAt,
      connectedAt: cred.connectedAt,
    };
  }

  public disconnect(provider: SubscriptionProviderId): void {
    this.ensureLoaded();
    this.cancelLogin(provider);
    delete this.cache[provider];
    this.persist();
  }

  public cancelLogin(provider: SubscriptionProviderId): void {
    const pending = this.activeLogins.get(provider);
    if (pending) {
      pending.abort.abort();
      this.activeLogins.delete(provider);
    }
  }

  public submitManualCode(provider: SubscriptionProviderId, rawCodeOrUrl: string): boolean {
    const pending = this.activeLogins.get(provider);
    if (!pending?.submitManualCode) return false;
    pending.submitManualCode(rawCodeOrUrl);
    return true;
  }

  /**
   * Returns a valid, auto-refreshed credential ready for inference.
   */
  public async getValidCredential(provider: SubscriptionProviderId): Promise<StoredOAuthCredential | null> {
    this.ensureLoaded();
    const cred = this.cache[provider];
    if (!cred) return null;

    // Refresh 3 minutes before expiry
    const needsRefresh = Date.now() >= cred.expiresAt - 180_000;
    if (!needsRefresh) return cred;

    if (!cred.refreshToken && !cred.githubToken) {
      return cred;
    }

    const existing = this.refreshLocks.get(provider);
    if (existing) return existing;

    const task = this.refreshCredential(provider, cred)
      .then((updated) => {
        this.cache[provider] = updated;
        this.persist();
        return updated;
      })
      .finally(() => {
        this.refreshLocks.delete(provider);
      });
    this.refreshLocks.set(provider, task);
    return task;
  }

  public async startLogin(
    provider: SubscriptionProviderId,
    onProgress?: (progress: SubscriptionLoginProgress) => void,
  ): Promise<PublicSubscriptionStatus> {
    this.ensureLoaded();
    this.cancelLogin(provider);

    const abort = new AbortController();
    const pending: PendingLogin = { provider, abort };
    this.activeLogins.set(provider, pending);
    onProgress?.({ provider, status: "starting", message: `Starting ${SUBSCRIPTION_PROVIDERS[provider].name} sign-in...` });

    try {
      let cred: StoredOAuthCredential;
      if (provider === "openai-codex") {
        cred = await this.loginOpenAiCodex(pending, onProgress);
      } else if (provider === "anthropic") {
        cred = await this.loginAnthropic(pending, onProgress);
      } else if (provider === "google-gemini-cli") {
        cred = await this.loginGoogleGeminiCli(pending, onProgress);
      } else if (provider === "github-copilot") {
        cred = await this.loginGitHubCopilot(pending, onProgress);
      } else if (provider === "openrouter") {
        cred = await this.loginOpenRouter(pending, onProgress);
      } else if (provider === "xai-oauth") {
        cred = await this.loginXaiOAuth(pending, onProgress);
      } else if (provider === "kimi-code") {
        cred = await this.loginKimiCode(pending, onProgress);
      } else if (provider === "gitlab-duo") {
        cred = await this.loginGitLabDuo(pending, onProgress);
      } else {
        throw new Error(`Unsupported subscription provider: ${provider}`);
      }

      this.cache[provider] = cred;
      this.persist();
      await this.fetchModels(provider).catch((err) => {
        console.warn(`[OAuthSubscriptionManager] Initial model discovery failed for ${provider}:`, err?.message || err);
      });
      onProgress?.({
        provider,
        status: "connected",
        message: `Connected${cred.email ? ` as ${cred.email}` : ""}.`,
      });
      return this.getPublicStatus(provider);
    } catch (err: any) {
      const cancelled = abort.signal.aborted;
      onProgress?.({
        provider,
        status: cancelled ? "cancelled" : "error",
        error: cancelled ? "Sign-in cancelled." : err?.message || String(err),
      });
      throw err;
    } finally {
      if (this.activeLogins.get(provider) === pending) {
        this.activeLogins.delete(provider);
      }
    }
  }

  private waitForLoopbackOrManualCode(opts: {
    provider: SubscriptionProviderId;
    pending: PendingLogin;
    host: string;
    port: number;
    callbackPath: string;
    expectedState: string;
    providerDisplayName: string;
    strictPort?: boolean;
    skipStateCheck?: boolean;
  }): Promise<{ code: string; redirectUri: string }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let server: http.Server | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        opts.pending.submitManualCode = undefined;
        opts.pending.abort.signal.removeEventListener("abort", onAbort);
        if (server) {
          try {
            server.close();
          } catch {}
        }
        fn();
      };

      const onAbort = () => finish(() => reject(new Error("Sign-in cancelled.")));
      opts.pending.abort.signal.addEventListener("abort", onAbort, { once: true });

      const redirectHost = opts.host === "127.0.0.1" && opts.provider === "openai-codex" ? "localhost" : opts.host;
      let activeRedirectUri = `http://${redirectHost}:${opts.port}${opts.callbackPath}`;

      opts.pending.submitManualCode = (rawInput: string) => {
        const parsed = parseAuthorizationCodeInput(rawInput);
        if (!parsed.code) return;
        if (!opts.skipStateCheck && parsed.state && parsed.state !== opts.expectedState) {
          finish(() => reject(new Error("OAuth state mismatch in pasted redirect URL.")));
          return;
        }
        finish(() => resolve({ code: parsed.code!, redirectUri: activeRedirectUri }));
      };

      timeout = setTimeout(() => {
        finish(() => reject(new Error("OAuth sign-in timed out after 5 minutes.")));
      }, 5 * 60 * 1000);

      server = http.createServer((req, res) => {
        try {
          const reqUrl = new URL(req.url || "/", `http://${opts.host}:${opts.port}`);
          if (reqUrl.pathname !== opts.callbackPath) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          const errorParam = reqUrl.searchParams.get("error");
          if (errorParam) {
            const desc = reqUrl.searchParams.get("error_description") || errorParam;
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end(`Authentication failed: ${desc}`);
            finish(() => reject(new Error(`OAuth denied: ${desc}`)));
            return;
          }
          const code = reqUrl.searchParams.get("code");
          const state = reqUrl.searchParams.get("state");
          if (!code) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Missing authorization code.");
            return;
          }
          if (!opts.skipStateCheck && state && state !== opts.expectedState) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("OAuth state mismatch.");
            finish(() => reject(new Error("OAuth state mismatch.")));
            return;
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(callbackSuccessHtml(opts.providerDisplayName));
          finish(() => resolve({ code, redirectUri: activeRedirectUri }));
        } catch (err: any) {
          res.writeHead(500);
          res.end("Internal callback error");
          finish(() => reject(err));
        }
      });

      server.on("error", (err: any) => {
        if (opts.strictPort) {
          finish(() =>
            reject(
              new Error(
                `OAuth callback port ${opts.port} is already in use (${err.code || err.message}). Close any other app using port ${opts.port} and retry.`,
              ),
            ),
          );
        }
        // Non-strict providers still allow manual code paste if loopback port is busy.
      });

      server.listen(opts.port, opts.host, () => {
        const addr = server?.address();
        if (addr && typeof addr === "object") {
          activeRedirectUri = `http://${redirectHost}:${addr.port}${opts.callbackPath}`;
        }
      });
    });
  }

  private async loginOpenAiCodex(
    pending: PendingLogin,
    onProgress?: (progress: SubscriptionLoginProgress) => void,
  ): Promise<StoredOAuthCredential> {
    const pkce = generatePkce();
    const redirectUri = `http://localhost:${OPENAI_CALLBACK_PORT}${OPENAI_CALLBACK_PATH}`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: OPENAI_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "openid profile email offline_access api.connectors.read api.connectors.invoke",
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      id_token_add_organizations: "true",
      codex_cli_simplified_flow: "true",
      state: pkce.state,
      originator: "const-harness",
    });
    const authUrl = `${OPENAI_AUTH_URL}?${params.toString()}`;

    const codePromise = this.waitForLoopbackOrManualCode({
      provider: "openai-codex",
      pending,
      host: "127.0.0.1",
      port: OPENAI_CALLBACK_PORT,
      callbackPath: OPENAI_CALLBACK_PATH,
      expectedState: pkce.state,
      providerDisplayName: "OpenAI",
      strictPort: true,
    });

    onProgress?.({
      provider: "openai-codex",
      status: "awaiting_browser",
      authUrl,
      message: "Complete ChatGPT sign-in in your browser.",
    });
    await this.openExternalUrl?.(authUrl);

    const { code } = await codePromise;
    onProgress?.({ provider: "openai-codex", status: "exchanging", message: "Exchanging authorization code..." });

    const tokenRes = await this.fetchImpl(OPENAI_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: OPENAI_CLIENT_ID,
        code_verifier: pkce.verifier,
      }).toString(),
      signal: pending.abort.signal,
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text().catch(() => "");
      throw new Error(`OpenAI token exchange failed (${tokenRes.status}): ${txt.slice(0, 300)}`);
    }
    const tokens: any = await tokenRes.json();
    const profile = extractOpenAiAccountProfile(tokens.access_token, tokens.id_token);
    const now = Date.now();
    return {
      provider: "openai-codex",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: now + (Number(tokens.expires_in) || 3600) * 1000,
      email: profile.email,
      accountId: profile.accountId,
      planType: profile.planType,
      connectedAt: now,
      updatedAt: now,
    };
  }

  private async loginAnthropic(
    pending: PendingLogin,
    onProgress?: (progress: SubscriptionLoginProgress) => void,
  ): Promise<StoredOAuthCredential> {
    const pkce = generatePkce();
    const redirectUri = `http://localhost:${ANTHROPIC_CALLBACK_PORT}${ANTHROPIC_CALLBACK_PATH}`;
    const params = new URLSearchParams({
      code: "true",
      client_id: ANTHROPIC_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload",
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      state: pkce.state,
    });
    const authUrl = `${ANTHROPIC_AUTH_URL}?${params.toString()}`;

    const codePromise = this.waitForLoopbackOrManualCode({
      provider: "anthropic",
      pending,
      host: "127.0.0.1",
      port: ANTHROPIC_CALLBACK_PORT,
      callbackPath: ANTHROPIC_CALLBACK_PATH,
      expectedState: pkce.state,
      providerDisplayName: "Anthropic Claude",
    });

    onProgress?.({
      provider: "anthropic",
      status: "awaiting_browser",
      authUrl,
      message: "Complete Claude sign-in in your browser (or paste the callback code/URL if redirected manually).",
    });
    await this.openExternalUrl?.(authUrl);

    const { code } = await codePromise;
    onProgress?.({ provider: "anthropic", status: "exchanging", message: "Exchanging Claude OAuth code..." });

    const tokenRes = await this.fetchImpl(ANTHROPIC_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: ANTHROPIC_CLIENT_ID,
        code,
        state: pkce.state,
        redirect_uri: redirectUri,
        code_verifier: pkce.verifier,
      }),
      signal: pending.abort.signal,
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text().catch(() => "");
      throw new Error(`Anthropic token exchange failed (${tokenRes.status}): ${txt.slice(0, 300)}`);
    }
    const tokens: any = await tokenRes.json();
    let accountId: string | undefined = tokens.account?.uuid;
    let email: string | undefined = tokens.account?.email_address;
    let orgId: string | undefined = tokens.organization?.uuid;
    let orgName: string | undefined = tokens.organization?.name;

    if (!email || !orgName) {
      try {
        const bootRes = await this.fetchImpl(
          `${ANTHROPIC_BOOTSTRAP_URL}?entrypoint=cli&model=claude-sonnet-4-6`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${tokens.access_token}`,
              "anthropic-beta": "oauth-2025-04-20",
              "User-Agent": "claude-code/2.1.76",
            },
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (bootRes.ok) {
          const boot: any = await bootRes.json();
          accountId = accountId ?? boot.oauth_account?.account_uuid;
          email = email ?? boot.oauth_account?.account_email;
          orgId = orgId ?? boot.oauth_account?.organization_uuid;
          orgName = orgName ?? boot.oauth_account?.organization_name;
        }
      } catch {
        // Non-fatal; token still valid for inference.
      }
    }

    const now = Date.now();
    return {
      provider: "anthropic",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: now + (Number(tokens.expires_in) || 3600) * 1000 - 300_000,
      email,
      accountId,
      orgId,
      orgName,
      connectedAt: now,
      updatedAt: now,
    };
  }

  private async discoverGoogleCodeAssistProject(
    accessToken: string,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "google-cloud-sdk vscode_cloudshelleditor/0.1",
      "X-Goog-Api-Client": "gl-node/22.17.0",
    };
    const envProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT_ID;
    const loadRes = await this.fetchImpl(`${GOOGLE_CODE_ASSIST_ENDPOINT}/v1internal:loadCodeAssist`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...(envProject ? { cloudaicompanionProject: envProject } : {}),
        metadata: {
          ideType: "IDE_UNSPECIFIED",
          platform: "PLATFORM_UNSPECIFIED",
          pluginType: "GEMINI",
          ...(envProject ? { duetProject: envProject } : {}),
        },
      }),
      signal,
    });
    if (!loadRes.ok) return envProject || undefined;
    const payload: any = await loadRes.json().catch(() => ({}));
    if (typeof payload.cloudaicompanionProject === "string" && payload.cloudaicompanionProject) {
      return payload.cloudaicompanionProject;
    }
    const defaultTier =
      (Array.isArray(payload.allowedTiers) ? payload.allowedTiers.find((t: any) => t?.isDefault)?.id : undefined) ||
      "free-tier";
    const onboardRes = await this.fetchImpl(`${GOOGLE_CODE_ASSIST_ENDPOINT}/v1internal:onboardUser`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tierId: defaultTier,
        metadata: { ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" },
      }),
      signal,
    });
    if (!onboardRes.ok) return envProject || undefined;
    let op: any = await onboardRes.json().catch(() => ({}));
    for (let attempt = 0; attempt < 10 && !op.done && op.name; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await this.fetchImpl(`${GOOGLE_CODE_ASSIST_ENDPOINT}/v1internal/${op.name}`, {
        method: "GET",
        headers,
        signal,
      });
      if (!poll.ok) break;
      op = await poll.json().catch(() => ({}));
    }
    return op?.response?.cloudaicompanionProject?.id || envProject || undefined;
  }

  private async loginGoogleGeminiCli(
    pending: PendingLogin,
    onProgress?: (progress: SubscriptionLoginProgress) => void,
  ): Promise<StoredOAuthCredential> {
    const pkce = generatePkce();
    const { clientId: googleClientId, clientSecret: googleClientSecret } = getGoogleCliOAuthCredentials();
    if (!googleClientId || !googleClientSecret) {
      throw new Error(
        "Google Gemini CLI OAuth requires CONST_GOOGLE_GEMINI_CLI_CLIENT_ID and CONST_GOOGLE_GEMINI_CLI_CLIENT_SECRET environment variables (or configure a Google AI Studio API key under Provider & Custom API Keys).",
      );
    }
    const redirectUri = `http://127.0.0.1:${GOOGLE_CALLBACK_PORT}${GOOGLE_CALLBACK_PATH}`;
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
      access_type: "offline",
      prompt: "consent",
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      state: pkce.state,
    });
    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    const codePromise = this.waitForLoopbackOrManualCode({
      provider: "google-gemini-cli",
      pending,
      host: "127.0.0.1",
      port: GOOGLE_CALLBACK_PORT,
      callbackPath: GOOGLE_CALLBACK_PATH,
      expectedState: pkce.state,
      providerDisplayName: "Google Gemini",
    });

    onProgress?.({
      provider: "google-gemini-cli",
      status: "awaiting_browser",
      authUrl,
      message: "Complete Google sign-in in your browser.",
    });
    await this.openExternalUrl?.(authUrl);

    const { code } = await codePromise;
    onProgress?.({ provider: "google-gemini-cli", status: "exchanging", message: "Exchanging Google OAuth code & provisioning Gemini project..." });

    const tokenRes = await this.fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code_verifier: pkce.verifier,
      }).toString(),
      signal: pending.abort.signal,
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text().catch(() => "");
      throw new Error(`Google token exchange failed (${tokenRes.status}): ${txt.slice(0, 300)}`);
    }
    const tokens: any = await tokenRes.json();

    let email: string | undefined;
    try {
      const userRes = await this.fetchImpl(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (userRes.ok) {
        const u: any = await userRes.json();
        email = u.email;
      }
    } catch {}

    const projectId = await this.discoverGoogleCodeAssistProject(tokens.access_token, pending.abort.signal).catch(
      () => undefined,
    );

    const now = Date.now();
    return {
      provider: "google-gemini-cli",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: now + (Number(tokens.expires_in) || 3600) * 1000 - 300_000,
      email,
      projectId,
      connectedAt: now,
      updatedAt: now,
    };
  }

  private async mintGitHubCopilotSessionToken(
    githubToken: string,
    signal?: AbortSignal,
  ): Promise<{ token: string; expiresAt: number; apiBaseUrl: string }> {
    const res = await this.fetchImpl(GITHUB_COPILOT_TOKEN_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/json",
        "Editor-Version": "vscode/1.100.0",
        "Editor-Plugin-Version": "copilot-chat/0.26.7",
        "User-Agent": "GitHubCopilotChat/0.26.7",
      },
      signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GitHub Copilot token exchange failed (${res.status}): ${txt.slice(0, 300)}`);
    }
    const data: any = await res.json();
    const expiresAt = typeof data.expires_at === "number" ? data.expires_at * 1000 : Date.now() + 25 * 60 * 1000;
    const apiBaseUrl =
      typeof data.endpoints?.api === "string" && data.endpoints.api
        ? data.endpoints.api
        : "https://api.githubcopilot.com";
    return { token: data.token, expiresAt, apiBaseUrl };
  }

  private async loginGitHubCopilot(
    pending: PendingLogin,
    onProgress?: (progress: SubscriptionLoginProgress) => void,
  ): Promise<StoredOAuthCredential> {
    const startRes = await this.fetchImpl(GITHUB_DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_COPILOT_CLIENT_ID,
        scope: "read:user",
      }),
      signal: pending.abort.signal,
    });
    if (!startRes.ok) {
      throw new Error(`GitHub device code request failed (${startRes.status})`);
    }
    const device: any = await startRes.json();
    const userCode = String(device.user_code || "");
    const verificationUri = String(device.verification_uri || "https://github.com/login/device");
    const deviceCode = String(device.device_code || "");
    let intervalMs = Math.max(5000, (Number(device.interval) || 5) * 1000);
    const deadline = Date.now() + (Number(device.expires_in) || 900) * 1000;

    onProgress?.({
      provider: "github-copilot",
      status: "awaiting_device_code",
      authUrl: verificationUri,
      verificationUri,
      userCode,
      message: `Enter code ${userCode} at ${verificationUri}`,
    });
    await this.openExternalUrl?.(verificationUri);

    let githubToken = "";
    while (Date.now() < deadline) {
      if (pending.abort.signal.aborted) throw new Error("Sign-in cancelled.");
      await new Promise((r) => setTimeout(r, intervalMs));
      if (pending.abort.signal.aborted) throw new Error("Sign-in cancelled.");

      const pollRes = await this.fetchImpl(GITHUB_ACCESS_TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_COPILOT_CLIENT_ID,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
        signal: pending.abort.signal,
      });
      const data: any = await pollRes.json().catch(() => ({}));
      if (data.access_token) {
        githubToken = data.access_token;
        break;
      }
      if (data.error === "slow_down") {
        intervalMs += 5000;
      } else if (data.error === "authorization_pending") {
        continue;
      } else {
        throw new Error(`GitHub authorization failed: ${data.error_description || data.error || "unknown"}`);
      }
    }
    if (!githubToken) throw new Error("GitHub Copilot device code timed out.");

    onProgress?.({ provider: "github-copilot", status: "exchanging", message: "Activating GitHub Copilot session..." });
    const minted = await this.mintGitHubCopilotSessionToken(githubToken, pending.abort.signal);

    let email: string | undefined;
    try {
      const userRes = await this.fetchImpl("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${githubToken}`, "User-Agent": "const-harness" },
        signal: AbortSignal.timeout(10_000),
      });
      if (userRes.ok) {
        const u: any = await userRes.json();
        email = u.login || u.email;
      }
    } catch {}

    const now = Date.now();
    return {
      provider: "github-copilot",
      accessToken: minted.token,
      githubToken,
      apiBaseUrl: minted.apiBaseUrl,
      expiresAt: minted.expiresAt,
      email,
      connectedAt: now,
      updatedAt: now,
    };
  }

  private async loginOpenRouter(
    pending: PendingLogin,
    onProgress?: (p: SubscriptionLoginProgress) => void,
  ): Promise<StoredOAuthCredential> {
    const pkce = generatePkce();
    const redirectUri = `http://127.0.0.1:${OPENROUTER_CALLBACK_PORT}/callback`;
    const params = new URLSearchParams({
      callback_url: redirectUri,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
    });
    const authUrl = `${OPENROUTER_AUTH_URL}?${params.toString()}`;

    const codePromise = this.waitForLoopbackOrManualCode({
      provider: "openrouter",
      pending,
      host: "127.0.0.1",
      port: OPENROUTER_CALLBACK_PORT,
      callbackPath: "/callback",
      expectedState: pkce.state,
      providerDisplayName: "OpenRouter",
      skipStateCheck: true,
    });

    onProgress?.({
      provider: "openrouter",
      status: "awaiting_browser",
      authUrl,
      message: "Complete OpenRouter sign-in in your browser.",
    });
    await this.openExternalUrl?.(authUrl);

    const { code } = await codePromise;
    onProgress?.({ provider: "openrouter", status: "exchanging", message: "Exchanging OpenRouter PKCE code..." });

    const tokenRes = await this.fetchImpl(OPENROUTER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: pkce.verifier,
        code_challenge_method: "S256",
      }),
      signal: pending.abort.signal,
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => "");
      throw new Error(`OpenRouter token exchange failed (${tokenRes.status}): ${errText.slice(0, 200)}`);
    }
    const tokens: any = await tokenRes.json();
    if (!tokens?.key) throw new Error("OpenRouter did not return an API key.");
    const now = Date.now();
    return {
      provider: "openrouter",
      accessToken: tokens.key,
      expiresAt: now + 10 * 365 * 24 * 60 * 60 * 1000,
      connectedAt: now,
      updatedAt: now,
    };
  }

  private async loginXaiOAuth(
    pending: PendingLogin,
    onProgress?: (p: SubscriptionLoginProgress) => void,
  ): Promise<StoredOAuthCredential> {
    const deviceRes = await this.fetchImpl(XAI_DEVICE_CODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: XAI_OAUTH_CLIENT_ID,
        scope: "openid profile email offline_access grok-cli:access api:access",
      }).toString(),
      signal: pending.abort.signal,
    });
    if (!deviceRes.ok) throw new Error(`xAI device code request failed (${deviceRes.status})`);
    const dc: any = await deviceRes.json();
    const verificationUri = dc.verification_uri_complete || dc.verification_uri || "https://auth.x.ai/activate";
    const userCode = String(dc.user_code || "");
    const deviceCode = String(dc.device_code || "");
    let intervalMs = Math.max(3, Number(dc.interval) || 5) * 1000;
    const deadline = Date.now() + (Number(dc.expires_in) || 600) * 1000;

    onProgress?.({
      provider: "xai-oauth",
      status: "awaiting_device_code",
      userCode,
      verificationUri,
      message: `Enter code ${userCode} on xAI to authorize.`,
    });
    await this.openExternalUrl?.(verificationUri);

    while (Date.now() < deadline) {
      if (pending.abort.signal.aborted) throw new Error("Sign-in cancelled.");
      await new Promise((r) => setTimeout(r, intervalMs));
      if (pending.abort.signal.aborted) throw new Error("Sign-in cancelled.");

      const pollRes = await this.fetchImpl(XAI_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: XAI_OAUTH_CLIENT_ID,
        }).toString(),
        signal: pending.abort.signal,
      });
      const pollData: any = await pollRes.json().catch(() => ({}));
      if (pollData?.access_token) {
        let email: string | undefined;
        let accountId: string | undefined;
        try {
          const uiRes = await this.fetchImpl(XAI_USERINFO_URL, {
            headers: { Authorization: `Bearer ${pollData.access_token}` },
          });
          if (uiRes.ok) {
            const ui: any = await uiRes.json();
            email = ui?.email;
            accountId = ui?.sub;
          }
        } catch {}
        const now = Date.now();
        return {
          provider: "xai-oauth",
          accessToken: pollData.access_token,
          refreshToken: pollData.refresh_token,
          expiresAt: now + (Number(pollData.expires_in) || 3600) * 1000 - 300_000,
          email,
          accountId,
          connectedAt: now,
          updatedAt: now,
        };
      }
      if (pollData?.error === "authorization_pending") continue;
      if (pollData?.error === "slow_down") {
        intervalMs += 5000;
        continue;
      }
      if (pollData?.error) throw new Error(pollData.error_description || pollData.error);
    }
    throw new Error("xAI sign-in timed out.");
  }

  private async loginKimiCode(
    pending: PendingLogin,
    onProgress?: (p: SubscriptionLoginProgress) => void,
  ): Promise<StoredOAuthCredential> {
    const deviceRes = await this.fetchImpl(`${KIMI_AUTH_BASE}/api/oauth/device_authorization`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: KIMI_OAUTH_CLIENT_ID }).toString(),
      signal: pending.abort.signal,
    });
    if (!deviceRes.ok) throw new Error(`Kimi Code device code request failed (${deviceRes.status})`);
    const dc: any = await deviceRes.json();
    const verificationUri = dc.verification_uri_complete || dc.verification_uri || KIMI_AUTH_BASE;
    const userCode = String(dc.user_code || "");
    const deviceCode = String(dc.device_code || "");
    let intervalMs = Math.max(3, Number(dc.interval) || 5) * 1000;
    const deadline = Date.now() + (Number(dc.expires_in) || 600) * 1000;

    onProgress?.({
      provider: "kimi-code",
      status: "awaiting_device_code",
      userCode,
      verificationUri,
      message: `Enter code ${userCode} on Kimi to authorize.`,
    });
    await this.openExternalUrl?.(verificationUri);

    while (Date.now() < deadline) {
      if (pending.abort.signal.aborted) throw new Error("Sign-in cancelled.");
      await new Promise((r) => setTimeout(r, intervalMs));
      if (pending.abort.signal.aborted) throw new Error("Sign-in cancelled.");

      const pollRes = await this.fetchImpl(`${KIMI_AUTH_BASE}/api/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: KIMI_OAUTH_CLIENT_ID,
        }).toString(),
        signal: pending.abort.signal,
      });
      const pollData: any = await pollRes.json().catch(() => ({}));
      if (pollData?.access_token) {
        const claims = decodeJwtPayload(pollData.access_token);
        const now = Date.now();
        return {
          provider: "kimi-code",
          accessToken: pollData.access_token,
          refreshToken: pollData.refresh_token,
          expiresAt: now + (Number(pollData.expires_in) || 3600) * 1000 - 300_000,
          accountId: claims?.user_id || claims?.sub,
          connectedAt: now,
          updatedAt: now,
        };
      }
      if (pollData?.error === "authorization_pending") continue;
      if (pollData?.error === "slow_down") {
        intervalMs += 5000;
        continue;
      }
      if (pollData?.error) throw new Error(pollData.error_description || pollData.error);
    }
    throw new Error("Kimi Code sign-in timed out.");
  }

  private async loginGitLabDuo(
    pending: PendingLogin,
    onProgress?: (p: SubscriptionLoginProgress) => void,
  ): Promise<StoredOAuthCredential> {
    const pkce = generatePkce();
    const redirectUri = (process.env.GITLAB_REDIRECT_URI || `http://localhost:${GITLAB_CALLBACK_PORT}/callback`).trim();
    const params = new URLSearchParams({
      client_id: GITLAB_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "api",
      state: pkce.state,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
    });
    const authUrl = `${GITLAB_AUTH_URL}?${params.toString()}`;

    const codePromise = this.waitForLoopbackOrManualCode({
      provider: "gitlab-duo",
      pending,
      host: "localhost",
      port: GITLAB_CALLBACK_PORT,
      callbackPath: "/callback",
      expectedState: pkce.state,
      providerDisplayName: "GitLab Duo",
    });

    onProgress?.({
      provider: "gitlab-duo",
      status: "awaiting_browser",
      authUrl,
      message: "Complete GitLab Duo sign-in in your browser.",
    });
    await this.openExternalUrl?.(authUrl);

    const { code } = await codePromise;
    onProgress?.({ provider: "gitlab-duo", status: "exchanging", message: "Exchanging GitLab authorization code..." });

    const tokenRes = await this.fetchImpl(GITLAB_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: GITLAB_CLIENT_ID,
        code,
        redirect_uri: redirectUri,
        code_verifier: pkce.verifier,
      }).toString(),
      signal: pending.abort.signal,
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => "");
      throw new Error(`GitLab Duo token exchange failed (${tokenRes.status}): ${errText.slice(0, 200)}`);
    }
    const tokens: any = await tokenRes.json();
    const now = Date.now();
    return {
      provider: "gitlab-duo",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: now + (Number(tokens.expires_in) || 7200) * 1000 - 300_000,
      connectedAt: now,
      updatedAt: now,
    };
  }

  private async refreshCredential(
    provider: SubscriptionProviderId,
    cred: StoredOAuthCredential,
  ): Promise<StoredOAuthCredential> {
    const now = Date.now();
    if (provider === "github-copilot" && cred.githubToken) {
      const minted = await this.mintGitHubCopilotSessionToken(cred.githubToken);
      return {
        ...cred,
        accessToken: minted.token,
        apiBaseUrl: minted.apiBaseUrl,
        expiresAt: minted.expiresAt,
        updatedAt: now,
      };
    }

    if (provider === "openai-codex" && cred.refreshToken) {
      const res = await this.fetchImpl(OPENAI_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: cred.refreshToken,
          client_id: OPENAI_CLIENT_ID,
        }).toString(),
      });
      if (!res.ok) throw new Error(`OpenAI token refresh failed (${res.status}). Please sign in again.`);
      const tokens: any = await res.json();
      const profile = extractOpenAiAccountProfile(tokens.access_token, tokens.id_token);
      return {
        ...cred,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || cred.refreshToken,
        expiresAt: now + (Number(tokens.expires_in) || 3600) * 1000,
        accountId: profile.accountId ?? cred.accountId,
        email: profile.email ?? cred.email,
        planType: profile.planType ?? cred.planType,
        updatedAt: now,
      };
    }

    if (provider === "anthropic" && cred.refreshToken) {
      const res = await this.fetchImpl(ANTHROPIC_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-beta": "oauth-2025-04-20",
          "User-Agent": "claude-code/2.1.76",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: cred.refreshToken,
          client_id: ANTHROPIC_CLIENT_ID,
        }),
      });
      if (!res.ok) throw new Error(`Anthropic token refresh failed (${res.status}). Please sign in again.`);
      const tokens: any = await res.json();
      return {
        ...cred,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || cred.refreshToken,
        expiresAt: now + (Number(tokens.expires_in) || 3600) * 1000 - 300_000,
        updatedAt: now,
      };
    }

    if (provider === "google-gemini-cli" && cred.refreshToken) {
      const res = await this.fetchImpl(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: cred.refreshToken,
          client_id: getGoogleCliOAuthCredentials().clientId,
          client_secret: getGoogleCliOAuthCredentials().clientSecret,
        }).toString(),
      });
      if (!res.ok) throw new Error(`Google token refresh failed (${res.status}). Please sign in again.`);
      const tokens: any = await res.json();
      return {
        ...cred,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || cred.refreshToken,
        expiresAt: now + (Number(tokens.expires_in) || 3600) * 1000 - 300_000,
        updatedAt: now,
      };
    }

    if (provider === "xai-oauth" && cred.refreshToken) {
      const res = await this.fetchImpl(XAI_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: cred.refreshToken,
          client_id: XAI_OAUTH_CLIENT_ID,
        }).toString(),
      });
      if (!res.ok) throw new Error(`xAI token refresh failed (${res.status}). Please sign in again.`);
      const tokens: any = await res.json();
      return {
        ...cred,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || cred.refreshToken,
        expiresAt: now + (Number(tokens.expires_in) || 3600) * 1000 - 300_000,
        updatedAt: now,
      };
    }

    if (provider === "kimi-code" && cred.refreshToken) {
      const res = await this.fetchImpl(`${KIMI_AUTH_BASE}/api/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: cred.refreshToken,
          client_id: KIMI_OAUTH_CLIENT_ID,
        }).toString(),
      });
      if (!res.ok) throw new Error(`Kimi Code token refresh failed (${res.status}). Please sign in again.`);
      const tokens: any = await res.json();
      return {
        ...cred,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || cred.refreshToken,
        expiresAt: now + (Number(tokens.expires_in) || 3600) * 1000 - 300_000,
        updatedAt: now,
      };
    }

    if (provider === "gitlab-duo" && cred.refreshToken) {
      const res = await this.fetchImpl(GITLAB_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: cred.refreshToken,
          client_id: GITLAB_CLIENT_ID,
        }).toString(),
      });
      if (!res.ok) throw new Error(`GitLab Duo token refresh failed (${res.status}). Please sign in again.`);
      const tokens: any = await res.json();
      return {
        ...cred,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || cred.refreshToken,
        expiresAt: now + (Number(tokens.expires_in) || 7200) * 1000 - 300_000,
        updatedAt: now,
      };
    }

    return cred;
  }

  private formatTokenCount(count?: number): string | undefined {
    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return undefined;
    if (count >= 1_000_000) {
      const m = Math.round((count / 1_000_000) * 10) / 10;
      return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    }
    if (count >= 1_000) {
      return `${Math.round(count / 1_000)}K`;
    }
    return String(Math.round(count));
  }

  private dedupeModels(models: SubscriptionModelPreset[]): SubscriptionModelPreset[] {
    const seen = new Set<string>();
    const result: SubscriptionModelPreset[] = [];
    for (const m of models) {
      const id = String(m?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      result.push({ ...m, id, name: (m.name || id).trim() });
    }
    return result;
  }

  /**
   * Returns cached live-discovered models if fresh (< 10 min), otherwise fetches live
   * from the signed-in provider's API, falling back gracefully to stale cache on network errors.
   */
  public async getModels(provider: SubscriptionProviderId): Promise<SubscriptionModelPreset[]> {
    this.ensureLoaded();
    const cred = this.cache[provider];
    if (!cred?.accessToken) return [];
    const now = Date.now();
    if (
      Array.isArray(cred.discoveredModels) &&
      cred.discoveredModels.length > 0 &&
      typeof cred.discoveredAt === "number" &&
      now - cred.discoveredAt < 10 * 60 * 1000
    ) {
      return cred.discoveredModels;
    }
    try {
      return await this.fetchModels(provider);
    } catch {
      return cred.discoveredModels ?? [];
    }
  }

  /**
   * Fetches available models directly from the signed-in provider's API and persists them encrypted.
   */
  public async fetchModels(provider: SubscriptionProviderId): Promise<SubscriptionModelPreset[]> {
    this.ensureLoaded();
    const existingLock = this.modelFetchLocks.get(provider);
    if (existingLock) return existingLock;

    const task = (async (): Promise<SubscriptionModelPreset[]> => {
      const cred = await this.getValidCredential(provider);
      if (!cred) {
        throw new Error(`${SUBSCRIPTION_PROVIDERS[provider].name} is not connected.`);
      }

      let discovered: SubscriptionModelPreset[] = [];
      if (provider === "openai-codex") {
        discovered = await this.fetchOpenAiCodexModels(cred);
      } else if (provider === "anthropic") {
        discovered = await this.fetchAnthropicModels(cred);
      } else if (provider === "google-gemini-cli") {
        discovered = await this.fetchGoogleGeminiModels(cred);
      } else if (provider === "github-copilot") {
        discovered = await this.fetchGitHubCopilotModels(cred);
      } else {
        discovered = await this.fetchOpenAiCompatibleOAuthModels(provider, cred);
      }

      const cleaned = this.dedupeModels(discovered);
      const latest = this.cache[provider];
      if (latest) {
        this.cache[provider] = {
          ...latest,
          projectId: cred.projectId || latest.projectId,
          discoveredModels: cleaned,
          discoveredAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.persist();
      }
      return cleaned;
    })().finally(() => {
      this.modelFetchLocks.delete(provider);
    });

    this.modelFetchLocks.set(provider, task);
    return task;
  }

  private async fetchOpenAiCodexModels(cred: StoredOAuthCredential): Promise<SubscriptionModelPreset[]> {
    const endpoints = [
      "https://chatgpt.com/backend-api/codex/models?client_version=0.169.0",
      "https://chatgpt.com/backend-api/models?client_version=0.169.0",
    ];
    let lastError = "Failed to fetch OpenAI Codex models.";
    for (const url of endpoints) {
      const res = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cred.accessToken}`,
          Accept: "application/json",
          originator: "omp",
          version: "0.169.0",
          ...(cred.accountId ? { "chatgpt-account-id": cred.accountId } : {}),
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        lastError = `OpenAI models fetch failed (${res.status}): ${txt.slice(0, 200)}`;
        continue;
      }
      const data: any = await res.json().catch(() => ({}));
      const rawModels: any[] = Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data?.data)
          ? data.data
          : [];
      const mapped: SubscriptionModelPreset[] = rawModels
        .filter((m) => m && (m.slug || m.id) && m.visibility !== "hidden" && m.supported_in_api !== false)
        .map((m) => {
          const id = String(m.slug || m.id).trim();
          const name = String(m.display_name || m.title || m.name || id).trim();
          const rawLevels: any[] = Array.isArray(m.supported_reasoning_levels) ? m.supported_reasoning_levels : [];
          const thinkingLevels = rawLevels
            .map((lvl) => (typeof lvl === "string" ? lvl : lvl?.effort || lvl?.level))
            .filter((s): s is string => typeof s === "string" && s.length > 0);
          const supportsThinking = thinkingLevels.length > 0 || Boolean(m.default_reasoning_level || m.supports_reasoning_summaries);
          const inputModalities: string[] = Array.isArray(m.input_modalities)
            ? m.input_modalities.filter((x: unknown): x is string => typeof x === "string")
            : ["text"];
          return {
            id,
            name,
            contextWindow: this.formatTokenCount(Number(m.context_window ?? m.max_context_tokens ?? m.limits?.context_window)),
            maxOutput: this.formatTokenCount(Number(m.max_output_tokens ?? m.limits?.max_output_tokens)),
            supportsThinking,
            ...(thinkingLevels.length > 0 ? { thinkingLevels } : {}),
            inputTypes: inputModalities.length > 0 ? inputModalities : ["text"],
          };
        });
      if (mapped.length > 0) return mapped;
    }
    throw new Error(lastError);
  }

  private async fetchAnthropicModels(cred: StoredOAuthCredential): Promise<SubscriptionModelPreset[]> {
    const res = await this.fetchImpl("https://api.anthropic.com/v1/models?limit=100", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": "claude-code/2.1.76",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Anthropic models fetch failed (${res.status}): ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json().catch(() => ({}));
    const rawList: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
    return rawList
      .filter((m) => m && m.id)
      .map((m) => {
        const id = String(m.id).trim();
        const isReasoning = /claude-(?:3-7|sonnet-4|opus-4|haiku-4)/i.test(id) || Boolean(m.supports_thinking);
        return {
          id,
          name: String(m.display_name || m.name || id).trim(),
          contextWindow: this.formatTokenCount(Number(m.max_input_tokens ?? m.context_window ?? 200_000)),
          maxOutput: this.formatTokenCount(Number(m.max_tokens ?? m.max_output_tokens ?? 64_000)),
          supportsThinking: isReasoning,
          ...(isReasoning ? { thinkingLevels: ["low", "medium", "high"] } : {}),
          inputTypes: ["text", "image"],
        };
      });
  }

  private async fetchGoogleGeminiModels(cred: StoredOAuthCredential): Promise<SubscriptionModelPreset[]> {
    if (!cred.projectId) {
      cred.projectId = await this.discoverGoogleCodeAssistProject(cred.accessToken, AbortSignal.timeout(12_000)).catch(
        () => undefined,
      );
    }
    const headers = {
      Authorization: `Bearer ${cred.accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "google-cloud-sdk vscode_cloudshelleditor/0.1",
      "X-Goog-Api-Client": "gl-node/22.17.0",
    };

    const metaMap = new Map<string, any>();
    try {
      const availRes = await this.fetchImpl(`${GOOGLE_CODE_ASSIST_ENDPOINT}/v1internal:fetchAvailableModels`, {
        method: "POST",
        headers,
        body: JSON.stringify(cred.projectId ? { project: cred.projectId } : {}),
        signal: AbortSignal.timeout(12_000),
      });
      if (availRes.ok) {
        const availData: any = await availRes.json().catch(() => ({}));
        if (availData?.models && typeof availData.models === "object" && !Array.isArray(availData.models)) {
          for (const [k, v] of Object.entries(availData.models)) {
            metaMap.set(k.replace(/^models\//, ""), v);
          }
        } else if (Array.isArray(availData?.models)) {
          for (const m of availData.models) {
            const mid = String(m?.id || m?.modelId || m?.name || "").replace(/^models\//, "");
            if (mid) metaMap.set(mid, m);
          }
        }
      }
    } catch {}

    const quotaRes = await this.fetchImpl(`${GOOGLE_CODE_ASSIST_ENDPOINT}/v1internal:retrieveUserQuota`, {
      method: "POST",
      headers,
      body: JSON.stringify(cred.projectId ? { project: cred.projectId } : {}),
      signal: AbortSignal.timeout(15_000),
    });

    const quotaIds: string[] = [];
    if (quotaRes.ok) {
      const quotaData: any = await quotaRes.json().catch(() => ({}));
      const buckets: any[] = Array.isArray(quotaData?.buckets) ? quotaData.buckets : [];
      for (const b of buckets) {
        const mid = typeof b?.modelId === "string" ? b.modelId.replace(/^models\//, "").trim() : "";
        if (mid && !/embedding/i.test(mid) && !quotaIds.includes(mid)) {
          quotaIds.push(mid);
        }
      }
    } else if (metaMap.size === 0) {
      const txt = await quotaRes.text().catch(() => "");
      throw new Error(`Google models fetch failed (${quotaRes.status}): ${txt.slice(0, 200)}`);
    }

    const ids = quotaIds.length > 0 ? quotaIds : Array.from(metaMap.keys()).filter((id) => !/embedding/i.test(id));
    return ids.map((id) => {
      const m = metaMap.get(id) || {};
      const displayName =
        (typeof m.displayName === "string" && m.displayName.trim()) ||
        id
          .split("-")
          .map((p) => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : p))
          .join(" ");
      const supportsThinking = Boolean(m.supportsThinking || /2\.5|3-/i.test(id));
      return {
        id,
        name: displayName,
        contextWindow: this.formatTokenCount(Number(m.maxTokens ?? m.inputTokenLimit ?? 1_048_576)),
        maxOutput: this.formatTokenCount(Number(m.maxOutputTokens ?? m.outputTokenLimit ?? 65_536)),
        supportsThinking,
        ...(supportsThinking ? { thinkingLevels: ["low", "medium", "high"] } : {}),
        inputTypes: ["text", "image"],
      };
    });
  }

  private async fetchGitHubCopilotModels(cred: StoredOAuthCredential): Promise<SubscriptionModelPreset[]> {
    const base = (cred.apiBaseUrl || SUBSCRIPTION_PROVIDERS["github-copilot"].baseUrl).replace(/\/+$/, "");
    const res = await this.fetchImpl(`${base}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        Accept: "application/json",
        "Copilot-Integration-Id": "vscode-chat",
        "Editor-Version": "vscode/1.100.0",
        "Editor-Plugin-Version": "copilot-chat/0.26.7",
        "User-Agent": "GitHubCopilotChat/0.26.7",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GitHub Copilot models fetch failed (${res.status}): ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json().catch(() => ({}));
    const rawList: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.models)
          ? data.models
          : [];
    return rawList
      .filter((m) => m && m.id && m.capabilities?.type !== "embeddings")
      .map((m) => {
        const id = String(m.id).trim();
        const limits = m.capabilities?.limits || {};
        const supports = m.capabilities?.supports || {};
        const supportsThinking = Boolean(supports.thinking || /o1|o3|o4|sonnet|opus|gemini-2\.5|gemini-3|gpt-5/i.test(id));
        return {
          id,
          name: String(m.name || m.display_name || id).trim(),
          contextWindow: this.formatTokenCount(Number(limits.max_context_window_tokens ?? limits.max_prompt_tokens ?? 128_000)),
          maxOutput: this.formatTokenCount(Number(limits.max_output_tokens ?? 16_384)),
          supportsThinking,
          inputTypes: supports.vision ? ["text", "image"] : ["text"],
        };
      });
  }

  private async fetchOpenAiCompatibleOAuthModels(
    provider: SubscriptionProviderId,
    cred: StoredOAuthCredential,
  ): Promise<SubscriptionModelPreset[]> {
    const meta = SUBSCRIPTION_PROVIDERS[provider];
    const base = (cred.apiBaseUrl || meta.baseUrl).replace(/\/+$/, "");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${cred.accessToken}`,
      Accept: "application/json",
    };
    if (provider === "kimi-code") {
      headers["User-Agent"] = "KimiCLI/1.3.0";
    }
    const res = await this.fetchImpl(`${base}/models`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${meta.name} models fetch failed (${res.status}): ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json().catch(() => ({}));
    const rawList: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.models)
          ? data.models
          : [];
    return rawList
      .filter((m) => m && (m.id || m.name))
      .slice(0, 200)
      .map((m) => {
        const id = String(m.id || m.name).trim();
        const inputModalities: string[] = Array.isArray(m.architecture?.input_modalities)
          ? m.architecture.input_modalities
          : ["text"];
        return {
          id,
          name: String(m.name || m.display_name || id).trim(),
          contextWindow: this.formatTokenCount(Number(m.context_length ?? m.context_window)),
          maxOutput: this.formatTokenCount(Number(m.top_provider?.max_completion_tokens ?? m.max_output_tokens)),
          supportsThinking: Boolean(m.supports_reasoning || /reasoning|think|r1|opus|sonnet-4|gpt-5|grok-4/i.test(id)),
          inputTypes: inputModalities.length > 0 ? inputModalities : ["text"],
        };
      });
  }
}
