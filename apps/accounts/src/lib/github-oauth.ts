import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const DESKTOP_CALLBACK = "http://127.0.0.1:24139/oauth/callback";
const PREFIX = "/oauth/github";
const TTL = 10 * 60;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
const safe = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
type Config = {
  origin: string;
  clientId: string;
  appId: string;
  appSlug: string;
  clientSecret: string;
};
type Ticket = {
  purpose: "login" | "refresh";
  exp: number;
  clientId: string;
  nonce: string;
  state?: string;
  challenge?: string;
  language?: string;
  tokenHash?: string;
};
class OAuthFailure extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
  }
}
function canonicalOrigin(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname))
    )
  )
    throw new OAuthFailure("setup", 503);
  return url.origin;
}
function config(): Config {
  return {
    origin: canonicalOrigin(
      process.env.GITHUB_OAUTH_ORIGIN || "https://accounts.const.web.id",
    ),
    clientId: process.env.GITHUB_APP_CLIENT_ID || "Iv23liQNAsFijYvpvsTt",
    appId: process.env.GITHUB_APP_ID || "5490453",
    appSlug: process.env.GITHUB_APP_SLUG || "const-harness",
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET || "",
  };
}
const messages = {
  en: [
    "GitHub connection could not be completed",
    "Return to Const and try Connect account again.",
    "Finish connecting in Const",
  ],
  id: [
    "Koneksi GitHub belum berhasil",
    "Kembali ke Const dan coba Hubungkan akun lagi.",
    "Selesaikan koneksi melalui Const",
  ],
  ja: [
    "GitHubへの接続を完了できませんでした",
    "Constに戻り、アカウント接続をもう一度お試しください。",
    "Constで接続を完了してください",
  ],
  zh: [
    "无法完成 GitHub 连接",
    "请返回 Const 并重新连接账户。",
    "请在 Const 中完成连接",
  ],
  es: [
    "No se pudo completar la conexión con GitHub",
    "Vuelve a Const e intenta conectar la cuenta de nuevo.",
    "Completa la conexión en Const",
  ],
} as const satisfies Record<
  "en" | "id" | "ja" | "zh" | "es",
  readonly [string, string, string]
>;
function failurePage(language: string, status: number, incomplete = false) {
  const lang = Object.hasOwn(messages, language)
    ? (language as keyof typeof messages)
    : "en";
  const [errorTitle, detail, finishTitle] = messages[lang];
  const title = incomplete ? finishTitle : errorTitle;
  const nonce = randomBytes(18).toString("base64");
  return new Response(
    '<!doctype html><html lang="' +
      lang +
      '"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Const</title><style nonce="' +
      nonce +
      '">body{margin:0;min-height:100vh;display:grid;place-items:center;background:#161616;color:#fff;font:15px/1.6 system-ui}main{max-width:440px;margin:24px;padding:32px;background:#222;border-radius:24px}h1{font-size:24px;font-weight:500}p{color:#969696}</style><main><small>Const</small><h1>' +
      title +
      "</h1><p>" +
      detail +
      '</p></main><script nonce="' +
      nonce +
      '">history.replaceState(null,"",location.pathname)</script></html>',
    {
      status,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`,
      },
    },
  );
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers });
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (
    request.headers.get("content-type")?.split(";")[0] !== "application/json" ||
    !request.body
  )
    throw new OAuthFailure("invalid");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 32768) {
        await reader.cancel();
        throw new OAuthFailure("invalid", 413);
      }
      chunks.push(part.value);
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new OAuthFailure("invalid");
    return value as Record<string, unknown>;
  } catch (e) {
    if (e instanceof OAuthFailure) throw e;
    throw new OAuthFailure("invalid");
  }
}
function field(value: unknown, min = 1, max = 16384): string {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    !/^[\x21-\x7e]+$/.test(value)
  )
    throw new OAuthFailure("invalid");
  return value;
}

/** Stateless broker. No provider tokens or client secrets are put in cookies or redirect URLs. */
export function createGitHubOAuthHandlers(
  options: {
    config?: () => Config;
    fetch?: typeof fetch;
    now?: () => number;
  } = {},
) {
  const getConfig = options.config ?? config;
  const requestGitHub = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const seconds = () => Math.floor(now() / 1000);
  const sign = (c: Config, data: Omit<Ticket, "nonce" | "clientId">) => {
    const payload = Buffer.from(
      JSON.stringify({
        ...data,
        clientId: c.clientId,
        nonce: randomBytes(24).toString("base64url"),
      }),
    ).toString("base64url");
    return (
      payload +
      "." +
      createHmac("sha256", c.clientSecret)
        .update("const-github-oauth-v1:" + payload)
        .digest("base64url")
    );
  };
  const verify = (
    c: Config,
    value: string,
    purpose: Ticket["purpose"],
  ): Ticket => {
    const [payload, signature, extra] = value.split(".");
    if (
      !payload ||
      !signature ||
      extra ||
      value.length > 4096 ||
      !/^[A-Za-z0-9_-]+$/.test(signature)
    )
      throw new OAuthFailure("auth", 403);
    const expected = createHmac("sha256", c.clientSecret)
      .update("const-github-oauth-v1:" + payload)
      .digest("base64url");
    if (!safe(signature, expected)) throw new OAuthFailure("auth", 403);
    let ticket: Ticket;
    try {
      ticket = JSON.parse(Buffer.from(payload, "base64url").toString());
    } catch {
      throw new OAuthFailure("auth", 403);
    }
    if (
      ticket.purpose !== purpose ||
      ticket.clientId !== c.clientId ||
      !Number.isFinite(ticket.exp) ||
      ticket.exp <= seconds() ||
      !ticket.nonce
    )
      throw new OAuthFailure("auth", 403);
    return ticket;
  };
  const cookieName = (c: Config) =>
    c.origin.startsWith("https:")
      ? "__Host-const_github_oauth"
      : "const_github_oauth";
  const cookie = (c: Config, value: string, age = TTL) =>
    cookieName(c) +
    "=" +
    value +
    "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
    age +
    (c.origin.startsWith("https:") ? "; Secure" : "");
  const redirect = (url: string, c: Config, cookieValue?: string) => {
    const response = new Response(null, {
      status: 303,
      headers: { ...headers, Location: url },
    });
    if (cookieValue !== undefined)
      response.headers.set(
        "Set-Cookie",
        cookie(c, cookieValue, cookieValue ? TTL : 0),
      );
    return response;
  };
  const configured = () => {
    const c = getConfig();
    if (
      !c.clientSecret ||
      !c.clientId ||
      !/^\d+$/.test(c.appId) ||
      !/^[a-z0-9-]+$/.test(c.appSlug)
    )
      throw new OAuthFailure("setup", 503);
    return c;
  };
  const tokens = async (c: Config, params: URLSearchParams) => {
    params.set("client_id", c.clientId);
    params.set("client_secret", c.clientSecret);
    let response: Response;
    try {
      response = await requestGitHub(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new OAuthFailure("connection", 502);
    }
    let result: Record<string, unknown>;
    try {
      result = await response.json();
    } catch {
      throw new OAuthFailure("auth", 502);
    }
    if (
      !response.ok ||
      result.error ||
      typeof result.token_type !== "string" ||
      result.token_type.toLowerCase() !== "bearer"
    )
      throw new OAuthFailure("auth", 401);
    const accessToken = field(result.access_token);
    const refreshToken =
      result.refresh_token === undefined
        ? undefined
        : field(result.refresh_token);
    const duration = (value: unknown, fallback: number) =>
      value === undefined
        ? fallback
        : typeof value === "number" &&
            Number.isInteger(value) &&
            value > 0 &&
            value <= 366 * 86400
          ? value
          : (() => {
              throw new OAuthFailure("auth", 502);
            })();
    const expiresIn = duration(result.expires_in, 0);
    const refreshExpiresIn = duration(
      result.refresh_token_expires_in,
      180 * 86400,
    );
    return json({
      access_token: accessToken,
      token_type: "Bearer",
      ...(expiresIn ? { expires_in: expiresIn } : {}),
      ...(refreshToken
        ? {
            refresh_token: refreshToken,
            grant: sign(c, {
              purpose: "refresh",
              exp: seconds() + refreshExpiresIn,
              tokenHash: hash(refreshToken),
            }),
          }
        : {}),
    });
  };
  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      let language = url.searchParams.get("language") || "en";
      try {
        const c = configured();
        const path = url.pathname;
        const origin = request.headers.get("origin");
        if (request.method === "POST" && origin && origin !== c.origin)
          throw new OAuthFailure("invalid", 403);
        if (request.method === "GET" && path === PREFIX + "/config")
          return json({
            configured: true,
            clientId: c.clientId,
            appId: c.appId,
            installationUrl:
              "https://github.com/apps/" + c.appSlug + "/installations/new",
          });
        if (request.method === "GET" && path === PREFIX + "/start") {
          const state = field(url.searchParams.get("state"), 64, 64);
          const challenge = field(
            url.searchParams.get("code_challenge"),
            43,
            43,
          );
          if (
            !/^[a-f0-9]{64}$/.test(state) ||
            !/^[A-Za-z0-9_-]{43}$/.test(challenge)
          )
            throw new OAuthFailure("invalid");
          language = Object.hasOwn(messages, language) ? language : "en";
          const ticket = sign(c, {
            purpose: "login",
            exp: seconds() + TTL,
            state,
            challenge,
            language,
          });
          const authorize = new URL("https://github.com/login/oauth/authorize");
          for (const [key, value] of Object.entries({
            client_id: c.clientId,
            redirect_uri: c.origin + PREFIX + "/callback",
            state: ticket,
            code_challenge: challenge,
            code_challenge_method: "S256",
            prompt: "select_account",
          }))
            authorize.searchParams.set(key, value);
          return redirect(authorize.toString(), c, hash(ticket));
        }
        if (request.method === "GET" && path === PREFIX + "/callback") {
          // Direct app installation may return a code without a desktop login session.
          // Do not exchange it or claim success; guide the user back to Connect account.
          if (!url.searchParams.has("state") && url.searchParams.has("code"))
            return failurePage(language, 200, true);
          const value = field(url.searchParams.get("state"), 1, 4096);
          const ticket = verify(c, value, "login");
          language = ticket.language || "en";
          const browserCookie = request.headers
            .get("cookie")
            ?.split(";")
            .map((v) => v.trim())
            .find((v) => v.startsWith(cookieName(c) + "="))
            ?.slice(cookieName(c).length + 1);
          if (!browserCookie || !safe(browserCookie, hash(value)))
            throw new OAuthFailure("auth", 403);
          const target = new URL(DESKTOP_CALLBACK);
          target.searchParams.set("state", ticket.state!);
          if (url.searchParams.has("error"))
            target.searchParams.set("error", "access_denied");
          else {
            target.searchParams.set(
              "code",
              field(url.searchParams.get("code"), 1, 2048),
            );
            target.searchParams.set("ticket", value);
          }
          return redirect(target.toString(), c, "");
        }
        if (request.method === "POST" && path === PREFIX + "/exchange") {
          const data = await body(request);
          const ticket = verify(c, field(data.ticket, 1, 4096), "login");
          const verifier = field(data.verifier, 43, 128);
          if (
            !/^[A-Za-z0-9._~-]+$/.test(verifier) ||
            !safe(hash(verifier), ticket.challenge || "")
          )
            throw new OAuthFailure("auth", 403);
          return await tokens(
            c,
            new URLSearchParams({
              code: field(data.code, 1, 2048),
              code_verifier: verifier,
              redirect_uri: c.origin + PREFIX + "/callback",
            }),
          );
        }
        if (request.method === "POST" && path === PREFIX + "/refresh") {
          const data = await body(request);
          const ticket = verify(c, field(data.grant, 1, 4096), "refresh");
          const refresh = field(data.refresh_token);
          if (!safe(hash(refresh), ticket.tokenHash || ""))
            throw new OAuthFailure("auth", 403);
          return await tokens(
            c,
            new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: refresh,
            }),
          );
        }
        return json({ error: "invalid" }, 405);
      } catch (error) {
        const code = error instanceof OAuthFailure ? error.code : "invalid";
        const status = error instanceof OAuthFailure ? error.status : 400;
        return request.method === "GET" && !url.pathname.endsWith("/config")
          ? failurePage(language, status)
          : json({ error: code }, status);
      }
    },
  };
}
