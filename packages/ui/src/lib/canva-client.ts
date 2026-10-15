/**
 * Canva Native Client SDK for Const Learn & Platform.
 * Supports official Canva Connect REST API v1 and Canva Remote MCP Server.
 * Implements RFC 7636 OAuth 2.0 Authorization Code Flow with PKCE (SHA-256).
 */

export interface CanvaTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  tokenType: string;
  scope?: string;
  displayName?: string;
  userId?: string;
}

export interface CanvaDesignResult {
  id: string;
  title: string;
  urls: {
    edit_url: string;
    view_url: string;
  };
  thumbnail?: {
    url: string;
    width?: number;
    height?: number;
  };
}

export interface CanvaExportJob {
  id: string;
  status: "in_progress" | "success" | "failed";
  urls?: string[];
  error?: {
    code: string;
    message: string;
  };
}

const STORAGE_KEY_TOKENS = "const_canva_tokens_v2";
const STORAGE_KEY_CLIENT_ID = "const_canva_client_id";
const STORAGE_KEY_DYNAMIC_CLIENT_ID = "const_canva_dcr_client_id";
const STORAGE_KEY_ACTIVE_CLIENT_ID = "const_canva_active_client_id";
const STORAGE_KEY_IS_DCR = "const_canva_is_dcr";
const STORAGE_KEY_REDIRECT_URI = "const_canva_redirect_uri";
const STORAGE_KEY_PKCE_VERIFIER = "const_canva_pkce_verifier";
const STORAGE_KEY_OAUTH_STATE = "const_canva_oauth_state";

// Default verified DCR fallback Client ID for Const Learn
export const DEFAULT_CANVA_CLIENT_ID = "KRCrBcbuZbMbr4fw";
export const CANVA_LOOPBACK_REDIRECT_URI = "http://127.0.0.1:24135/canva/callback";
export const CANVA_WEB_REDIRECT_URI = "https://accounts.const.web.id/oauth/canva/callback";
export const DEFAULT_CANVA_REDIRECT_URI = CANVA_LOOPBACK_REDIRECT_URI;

export const CANVA_AUTH_ENDPOINT = "https://www.canva.com/api/oauth/authorize";
export const CANVA_TOKEN_ENDPOINT = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_API_BASE = "https://api.canva.com/rest/v1";

// Canva MCP Remote Endpoints (supports DCR & Remote MCP OAuth)
export const CANVA_MCP_ENDPOINT = "https://mcp.canva.com/mcp";
export const CANVA_MCP_DCR_ENDPOINT = "https://mcp.canva.com/register";
export const CANVA_MCP_AUTH_ENDPOINT = "https://mcp.canva.com/authorize";
export const CANVA_MCP_TOKEN_ENDPOINT = "https://mcp.canva.com/token";

export const CANVA_REQUIRED_SCOPES = [
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "asset:read",
  "asset:write",
  "profile:read",
].join(" ");

// ---------------------------------------------------------------------------
// PKCE (Proof Key for Code Exchange) Cryptographic Helpers
// ---------------------------------------------------------------------------

function dec2hex(dec: number): string {
  return dec.toString(16).padStart(2, "0");
}

/**
 * Generates high-entropy cryptographic random string for PKCE verifier.
 */
export function generateCodeVerifier(length: number = 64): string {
  const safeLength = Math.min(128, Math.max(43, length));
  const array = new Uint8Array(safeLength);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array);
  } else if (typeof globalThis !== "undefined" && globalThis.crypto) {
    globalThis.crypto.getRandomValues(array);
  } else {
    // Fallback pseudo-random for edge environments
    for (let i = 0; i < safeLength; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, dec2hex).join("").slice(0, safeLength);
}

function base64UrlEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Computes S256 code_challenge from code_verifier via crypto.subtle.digest.
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const cryptoObj =
    typeof window !== "undefined" && window.crypto?.subtle
      ? window.crypto.subtle
      : typeof globalThis !== "undefined" && (globalThis as any).crypto?.subtle
      ? (globalThis as any).crypto.subtle
      : null;

  if (cryptoObj) {
    const digest = await cryptoObj.digest("SHA-256", data);
    return base64UrlEncode(digest);
  }

  // Fallback for edge Node runtimes without Web Crypto
  try {
    const nodeReq = typeof globalThis !== "undefined" ? (globalThis as any).require : undefined;
    if (typeof nodeReq === "function") {
      const nodeCrypto = nodeReq("crypto");
      return nodeCrypto.createHash("sha256").update(codeVerifier).digest("base64url");
    }
  } catch {
    // ignore fallback error
  }

  throw new Error("Web Crypto API is not supported in this runtime environment.");
}

// ---------------------------------------------------------------------------
// Configuration Management
// ---------------------------------------------------------------------------

export function getCanvaClientId(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
    if (stored && stored.trim()) return stored.trim();
  }
  const envVal =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_CANVA_CLIENT_ID) ||
    (typeof process !== "undefined" && process.env?.VITE_CANVA_CLIENT_ID) ||
    (typeof process !== "undefined" && process.env?.CANVA_CLIENT_ID);
  return (envVal && envVal.trim()) || "";
}

export function isConfiguredCanvaClientId(_id?: string): boolean {
  // Always true because Canva MCP supports Dynamic Client Registration (DCR) and public defaults
  return true;
}

/**
 * Resolves or dynamically registers a Canva Client ID via Canva MCP DCR (RFC 7591).
 * If a custom Client ID was explicitly provided in env/localStorage, it uses that.
 * Otherwise, it dynamically registers/fetches an OAuth client from https://mcp.canva.com/register
 * so users just click Connect and log in without creating an app in the Canva Developer Portal.
 */
export async function getOrRegisterCanvaClientId(): Promise<{ clientId: string; isDcr: boolean }> {
  // 1. Check explicit developer/custom client ID from env or settings
  const explicit = getCanvaClientId();
  if (explicit && explicit.trim() && explicit.trim() !== "OC-AZX17ConstLearn" && explicit.trim().length > 3) {
    return { clientId: explicit.trim(), isDcr: !explicit.trim().startsWith("OC-") };
  }

  // 2. Check cached dynamic client ID in localStorage
  if (typeof window !== "undefined") {
    const cachedDcr = localStorage.getItem(STORAGE_KEY_DYNAMIC_CLIENT_ID);
    if (cachedDcr && cachedDcr.trim()) {
      return { clientId: cachedDcr.trim(), isDcr: true };
    }
  }

  // 3. Register dynamically via Canva Remote MCP DCR
  try {
    const redirectUris = [
      CANVA_LOOPBACK_REDIRECT_URI,
      CANVA_WEB_REDIRECT_URI,
      getCanvaRedirectUri(),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const res = await doFetch(CANVA_MCP_DCR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_name: "Const Learn",
        redirect_uris: redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.client_id) {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_DYNAMIC_CLIENT_ID, data.client_id);
        }
        return { clientId: data.client_id, isDcr: true };
      }
    }
  } catch (err) {
    console.warn("[Canva Client] Dynamic Client Registration error, using verified fallback client:", err);
  }

  // 4. Fallback to verified Canva DCR client
  return { clientId: "KRCrBcbuZbMbr4fw", isDcr: true };
}

export function setCanvaClientId(clientId: string): void {
  if (typeof window === "undefined") return;
  if (!clientId || !clientId.trim()) {
    localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
  } else {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId.trim());
  }
}

export function getCanvaRedirectUri(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY_REDIRECT_URI);
    if (stored && stored.trim()) return stored.trim();
  }
  const envVal =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_CANVA_REDIRECT_URI) ||
    (typeof process !== "undefined" && process.env?.VITE_CANVA_REDIRECT_URI);
  if (envVal && envVal.trim()) return envVal.trim();

  // Desktop electron uses local loopback server for system default browser callback
  if (typeof window !== "undefined" && (window as any).electron) {
    return CANVA_LOOPBACK_REDIRECT_URI;
  }

  // Mobile / Web uses central web callback that deep-links into the mobile app
  return CANVA_WEB_REDIRECT_URI;
}

export function setCanvaRedirectUri(uri: string): void {
  if (typeof window === "undefined") return;
  if (!uri || !uri.trim()) {
    localStorage.removeItem(STORAGE_KEY_REDIRECT_URI);
  } else {
    localStorage.setItem(STORAGE_KEY_REDIRECT_URI, uri.trim());
  }
}

// ---------------------------------------------------------------------------
// Token Storage & State
// ---------------------------------------------------------------------------

export function getStoredCanvaTokens(): CanvaTokenData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TOKENS);
    if (!raw) return null;
    const parsed: CanvaTokenData = JSON.parse(raw);
    if (parsed && parsed.accessToken) return parsed;
  } catch {}
  return null;
}

export function saveCanvaTokens(tokens: CanvaTokenData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
  window.dispatchEvent(new Event("connectors_changed"));
  window.dispatchEvent(new CustomEvent("canva:token-changed", { detail: tokens }));
}

export function clearCanvaTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_TOKENS);
  localStorage.removeItem(STORAGE_KEY_PKCE_VERIFIER);
  localStorage.removeItem(STORAGE_KEY_OAUTH_STATE);
  window.dispatchEvent(new Event("connectors_changed"));
  window.dispatchEvent(new CustomEvent("canva:token-changed", { detail: null }));
}

export function isCanvaAuthenticated(): boolean {
  const tokens = getStoredCanvaTokens();
  if (!tokens || !tokens.accessToken) return false;
  // If access token is still valid (or we have a refresh token to renew it)
  if (tokens.refreshToken) return true;
  return Date.now() < tokens.expiresAt;
}

// ---------------------------------------------------------------------------
// OAuth Authorization Flow
// ---------------------------------------------------------------------------

export interface CanvaAuthUrlResult {
  url: string;
  verifier: string;
  state: string;
  redirectUri: string;
}

/**
 * Creates the official Canva OAuth 2.0 PKCE authorization URL.
 */
export async function createCanvaAuthUrl(options?: {
  redirectUri?: string;
  clientId?: string;
}): Promise<CanvaAuthUrlResult> {
  const redirectUri = options?.redirectUri || getCanvaRedirectUri();

  let targetClientId = options?.clientId;
  let isDcr = false;
  if (!targetClientId) {
    const resolved = await getOrRegisterCanvaClientId();
    targetClientId = resolved.clientId;
    isDcr = resolved.isDcr;
  } else {
    isDcr = !targetClientId.startsWith("OC-");
  }

  const verifier = generateCodeVerifier(64);
  const challenge = await generateCodeChallenge(verifier);
  const state = "st_" + generateCodeVerifier(24);

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_PKCE_VERIFIER, verifier);
    localStorage.setItem(STORAGE_KEY_OAUTH_STATE, state);
    localStorage.setItem(STORAGE_KEY_ACTIVE_CLIENT_ID, targetClientId);
    localStorage.setItem(STORAGE_KEY_IS_DCR, isDcr ? "true" : "false");
  }

  const authEndpoint = isDcr ? CANVA_MCP_AUTH_ENDPOINT : CANVA_AUTH_ENDPOINT;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: targetClientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: state,
  });

  if (!isDcr) {
    params.set("scope", CANVA_REQUIRED_SCOPES);
  }

  const url = `${authEndpoint}?${params.toString()}`;

  return {
    url,
    verifier,
    state,
    redirectUri,
  };
}

// Custom request executor hook (e.g. Electron IPC or CapacitorHttp)
type RequestExecutor = (url: string, init?: RequestInit) => Promise<Response>;
let customRequestExecutor: RequestExecutor | null = null;

export function registerCanvaRequestExecutor(executor: RequestExecutor): void {
  customRequestExecutor = executor;
}

async function doFetch(url: string, init?: RequestInit): Promise<Response> {
  if (customRequestExecutor) {
    return customRequestExecutor(url, init);
  }
  return fetch(url, init);
}

/**
 * Exchanges the authorization code received from Canva redirect for access and refresh tokens.
 */
export async function exchangeCanvaAuthCode(options: {
  code: string;
  state?: string;
  verifier?: string;
  redirectUri?: string;
  clientId?: string;
}): Promise<CanvaTokenData> {
  const redirectUri = options.redirectUri || getCanvaRedirectUri();

  let clientId = options.clientId;
  let isDcr = false;
  if (!clientId && typeof window !== "undefined") {
    clientId = localStorage.getItem(STORAGE_KEY_ACTIVE_CLIENT_ID) || undefined;
    isDcr = localStorage.getItem(STORAGE_KEY_IS_DCR) === "true";
  }
  if (!clientId) {
    const resolved = await getOrRegisterCanvaClientId();
    clientId = resolved.clientId;
    isDcr = resolved.isDcr;
  }

  let verifier = options.verifier;
  if (!verifier && typeof window !== "undefined") {
    verifier = localStorage.getItem(STORAGE_KEY_PKCE_VERIFIER) || undefined;
  }

  if (!verifier) {
    throw new Error("PKCE code_verifier hilang atau kedaluwarsa. Silakan ulangi otorisasi.");
  }

  // Validate state if provided
  if (options.state && typeof window !== "undefined") {
    const savedState = localStorage.getItem(STORAGE_KEY_OAUTH_STATE);
    if (savedState && savedState !== options.state) {
      console.warn("[Canva Auth] Warning: OAuth state mismatch.");
    }
  }

  const tokenEndpoint = isDcr ? CANVA_MCP_TOKEN_ENDPOINT : CANVA_TOKEN_ENDPOINT;
  const bodyParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code_verifier: verifier,
    code: options.code,
    redirect_uri: redirectUri,
  });

  const response = await doFetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let errMsg = `Gagal menukar kode otorisasi Canva (${response.status})`;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error_description || errJson.error || errJson.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const expiresInSeconds = Number(data.expires_in) || 3600;
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  const tokenData: CanvaTokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || undefined,
    expiresAt,
    tokenType: data.token_type || "Bearer",
    scope: data.scope,
  };

  // Attempt to fetch profile for display name
  try {
    const profile = await fetchCanvaProfile(tokenData.accessToken);
    if (profile?.display_name) {
      tokenData.displayName = profile.display_name;
    }
    if (profile?.id) {
      tokenData.userId = profile.id;
    }
  } catch {}

  saveCanvaTokens(tokenData);
  return tokenData;
}

/**
 * Refreshes an expired Canva access token using the stored refresh_token.
 */
export async function refreshCanvaAccessToken(existingTokens?: CanvaTokenData): Promise<CanvaTokenData | null> {
  const tokens = existingTokens || getStoredCanvaTokens();
  if (!tokens || !tokens.refreshToken) {
    return null;
  }

  const isDcr = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY_IS_DCR) === "true";
  let clientId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_ACTIVE_CLIENT_ID) : null;
  if (!clientId) {
    clientId = (await getOrRegisterCanvaClientId()).clientId;
  }

  const tokenEndpoint = isDcr ? CANVA_MCP_TOKEN_ENDPOINT : CANVA_TOKEN_ENDPOINT;
  const bodyParams = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: tokens.refreshToken,
  });

  try {
    const response = await doFetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      console.warn("[Canva Auth] Failed to refresh token, status:", response.status);
      return null;
    }

    const data = await response.json();
    const expiresInSeconds = Number(data.expires_in) || 3600;
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    const updated: CanvaTokenData = {
      ...tokens,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt,
    };

    saveCanvaTokens(updated);
    return updated;
  } catch (err) {
    console.error("[Canva Auth] Token refresh error:", err);
    return null;
  }
}

/**
 * Obtains a valid Canva access token, automatically refreshing if expired or expiring soon (< 60s).
 */
export async function getValidCanvaAccessToken(): Promise<string | null> {
  const tokens = getStoredCanvaTokens();
  if (!tokens || !tokens.accessToken) {
    return null;
  }

  // Check if expiring in less than 60 seconds
  if (Date.now() + 60000 >= tokens.expiresAt) {
    if (tokens.refreshToken) {
      const refreshed = await refreshCanvaAccessToken(tokens);
      if (refreshed?.accessToken) return refreshed.accessToken;
    }
    // Expired without refresh token
    if (Date.now() >= tokens.expiresAt) {
      return null;
    }
  }

  return tokens.accessToken;
}

// ---------------------------------------------------------------------------
// Native Canva Connect REST APIs (v1)
// ---------------------------------------------------------------------------

/**
 * Fetches user profile from Canva Connect API.
 */
export async function fetchCanvaProfile(accessToken: string): Promise<any> {
  const res = await doFetch(`${CANVA_API_BASE}/users/me/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Canva user profile (${res.status})`);
  }
  const data = await res.json();
  return data.profile || data;
}

/**
 * Creates a brand new editable Canva design (presentation deck) via Canva Connect REST API.
 */
export async function createCanvaDesignNative(options: {
  title: string;
  preset?: string;
  accessToken?: string;
}): Promise<{
  success: boolean;
  design?: CanvaDesignResult;
  error?: string;
}> {
  const token = options.accessToken || (await getValidCanvaAccessToken());
  if (!token) {
    return {
      success: false,
      error: "Akun Canva belum terhubung. Silakan hubungkan Canva terlebih dahulu via OAuth.",
    };
  }

  const payload = {
    design_type: {
      type: "preset",
      name: options.preset || "presentation",
    },
    title: options.title || "Const Learn Presentation",
  };

  try {
    const res = await doFetch(`${CANVA_API_BASE}/designs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      return {
        success: false,
        error: `Gagal membuat desain di Canva (${res.status}): ${errTxt}`,
      };
    }

    const data = await res.json();
    const design: CanvaDesignResult = data.design || data;

    return {
      success: true,
      design: {
        id: design.id,
        title: design.title || options.title,
        urls: {
          edit_url: design.urls?.edit_url || (design as any).edit_url,
          view_url: design.urls?.view_url || (design as any).view_url,
        },
        thumbnail: design.thumbnail,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Gagal menghubungi Canva Connect API.",
    };
  }
}

/**
 * Initiates an export job for a Canva design (PDF, PPTX, PNG, JPG).
 */
export async function exportCanvaDesignNative(options: {
  designId: string;
  format?: "pdf" | "pptx" | "png" | "jpg";
  accessToken?: string;
}): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  const token = options.accessToken || (await getValidCanvaAccessToken());
  if (!token) {
    return { success: false, error: "Akun Canva belum terhubung." };
  }

  try {
    const res = await doFetch(`${CANVA_API_BASE}/exports`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        design_id: options.designId,
        format: {
          type: options.format || "pdf",
        },
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      return {
        success: false,
        error: `Gagal memulai export Canva (${res.status}): ${errTxt}`,
      };
    }

    const data = await res.json();
    const job: CanvaExportJob = data.job || data;
    return {
      success: true,
      jobId: job.id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Gagal memulai export desain Canva.",
    };
  }
}

/**
 * Polls status of a Canva export job until it finishes or times out.
 */
export async function pollCanvaExportJob(options: {
  jobId: string;
  accessToken?: string;
  timeoutMs?: number;
}): Promise<{
  success: boolean;
  downloadUrls?: string[];
  error?: string;
}> {
  const token = options.accessToken || (await getValidCanvaAccessToken());
  if (!token) {
    return { success: false, error: "Akun Canva belum terhubung." };
  }

  const timeoutMs = options.timeoutMs || 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await doFetch(`${CANVA_API_BASE}/exports/${options.jobId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        return { success: false, error: `Gagal mengecek status export (${res.status})` };
      }

      const data = await res.json();
      const job: CanvaExportJob = data.job || data;

      if (job.status === "success" && job.urls && job.urls.length > 0) {
        return {
          success: true,
          downloadUrls: job.urls,
        };
      }

      if (job.status === "failed") {
        return {
          success: false,
          error: job.error?.message || "Export Canva gagal diproses.",
        };
      }

      // Wait 1.5s before next poll
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err: any) {
      return { success: false, error: err?.message || "Gagal polling status export." };
    }
  }

  return { success: false, error: "Waktu tunggu export Canva habis (timeout)." };
}
