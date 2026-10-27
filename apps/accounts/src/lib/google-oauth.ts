import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  body,
  canonicalOrigin,
  DESKTOP_CALLBACK,
  field,
  OAuthFailure,
} from "./github-oauth";
import {
  GOOGLE_CONNECTORS,
  GOOGLE_IDENTITY_SCOPES,
  googleApp,
  hasGoogleScopes,
  normalizeGoogleScopes,
  type GoogleApp,
} from "../../../harness/shared/google-connectors";

type Config = { origin: string; clientId: string; clientSecret: string };
type Ticket = {
  purpose: "login" | "refresh";
  exp: number;
  clientId: string;
  nonce: string;
  state?: string;
  challenge?: string;
  language?: string;
  app?: GoogleApp;
  tokenHash?: string;
  subject?: string;
  scopes?: string[];
};
const PREFIX = "/oauth/google";
const TTL = 600;
const hash = (v: string) => createHash("sha256").update(v).digest("base64url");
const equal = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
const messages = {
  en: [
    "Google connection could not be completed",
    "Return to Const and try Connect account again.",
  ],
  id: [
    "Koneksi Google belum berhasil",
    "Kembali ke Const dan coba Hubungkan akun lagi.",
  ],
  ja: [
    "Googleへの接続を完了できませんでした",
    "Constに戻り、アカウント接続をもう一度お試しください。",
  ],
  zh: ["无法完成 Google 连接", "请返回 Const 并重新连接账户。"],
  es: [
    "No se pudo completar la conexión con Google",
    "Vuelve a Const e intenta conectar la cuenta de nuevo.",
  ],
};
function failure(language: string, status: number) {
  const lang = Object.hasOwn(messages, language)
    ? (language as keyof typeof messages)
    : "en";
  const nonce = randomBytes(18).toString("base64");
  return new Response(
    `<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Const</title><style nonce="${nonce}">body{margin:0;min-height:100vh;display:grid;place-items:center;background:#161616;color:white;font:15px/1.6 system-ui}main{max-width:440px;margin:24px;padding:32px;background:#222;border-radius:24px}h1{font-size:24px;font-weight:500}p{color:#969696}</style><main><small>Const</small><h1>${messages[lang][0]}</h1><p>${messages[lang][1]}</p></main><script nonce="${nonce}">history.replaceState(null,"",location.pathname)</script></html>`,
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

/** Stateless, confidential OAuth client. The desktop owns encrypted user credentials. */
export function createGoogleOAuthHandlers(
  options: {
    config?: () => Config;
    fetch?: typeof fetch;
    now?: () => number;
  } = {},
) {
  const getConfig =
    options.config ??
    (() => ({
      origin:
        process.env.GOOGLE_CONNECTOR_ORIGIN || "https://accounts.const.web.id",
      clientId: process.env.GOOGLE_CONNECTOR_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CONNECTOR_CLIENT_SECRET || "",
    }));
  const requestGoogle = options.fetch ?? fetch;
  const seconds = () => Math.floor((options.now ?? Date.now)() / 1000);
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
        .update("const-google-oauth-v1:" + payload)
        .digest("base64url")
    );
  };
  const verify = (
    c: Config,
    value: unknown,
    purpose: Ticket["purpose"],
  ): Ticket => {
    const [payload, signature, extra] = field(value, 1, 8192).split(".");
    if (
      !payload ||
      !signature ||
      extra ||
      !equal(
        signature,
        createHmac("sha256", c.clientSecret)
          .update("const-google-oauth-v1:" + payload)
          .digest("base64url"),
      )
    )
      throw new OAuthFailure("auth", 403);
    let ticket: Ticket;
    try {
      ticket = JSON.parse(Buffer.from(payload, "base64url").toString());
    } catch {
      throw new OAuthFailure("auth", 403);
    }
    if (
      ticket.purpose !== purpose ||
      ticket.clientId !== c.clientId ||
      !ticket.nonce ||
      !Number.isFinite(ticket.exp) ||
      ticket.exp <= seconds()
    )
      throw new OAuthFailure("auth", 403);
    return ticket;
  };
  const cookieName = (c: Config) =>
    c.origin.startsWith("https:")
      ? "__Host-const_google_oauth"
      : "const_google_oauth";
  const redirect = (c: Config, url: URL, value: string) =>
    new Response(null, {
      status: 303,
      headers: {
        ...headers,
        Location: url.toString(),
        "Set-Cookie": `${cookieName(c)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${value ? TTL : 0}${c.origin.startsWith("https:") ? "; Secure" : ""}`,
      },
    });
  const providerTokens = async (c: Config, params: URLSearchParams) => {
    params.set("client_id", c.clientId);
    params.set("client_secret", c.clientSecret);
    let response: Response;
    try {
      response = await requestGoogle("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new OAuthFailure("connection", 502);
    }
    if (!response.ok)
      throw new OAuthFailure(
        response.status >= 500 || response.status === 429
          ? "connection"
          : "auth",
        response.status >= 500 || response.status === 429 ? 502 : 401,
      );
    const result = await response.json();
    if (
      String(result.token_type).toLowerCase() !== "bearer" ||
      !Number.isInteger(result.expires_in) ||
      result.expires_in < 1 ||
      result.expires_in > 86400
    )
      throw new OAuthFailure("auth", 502);
    return {
      access_token: field(result.access_token),
      refresh_token:
        result.refresh_token === undefined
          ? undefined
          : field(result.refresh_token),
      expires_in: result.expires_in as number,
      scope:
        typeof result.scope === "string"
          ? normalizeGoogleScopes(result.scope)
          : undefined,
    };
  };
  const identity = async (access: string) => {
    let response: Response;
    try {
      response = await requestGoogle(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: "Bearer " + access },
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      throw new OAuthFailure("connection", 502);
    }
    if (!response.ok) throw new OAuthFailure("auth", 401);
    const user = await response.json();
    const subject = field(user.sub, 1, 255);
    // A hash pins account identity without including email addresses in signed state URLs.
    return {
      subject: hash(subject),
      email:
        typeof user.email === "string" &&
        user.email_verified === true &&
        user.email.length < 320
          ? user.email
          : undefined,
    };
  };
  const result = (
    c: Config,
    token: Awaited<ReturnType<typeof providerTokens>>,
    user: { subject: string; email?: string },
    scopes: string[],
  ) => {
    if (!token.refresh_token) throw new OAuthFailure("auth", 401);
    return json({
      ...token,
      token_type: "Bearer",
      scope: scopes.join(" "),
      subject: user.subject,
      email: user.email,
      grant: sign(c, {
        purpose: "refresh",
        exp: seconds() + 180 * 86400,
        tokenHash: hash(token.refresh_token),
        subject: user.subject,
        scopes,
      }),
    });
  };
  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      let language = url.searchParams.get("language") || "en";
      try {
        const c = { ...getConfig() };
        c.origin = canonicalOrigin(c.origin);
        if (!c.clientId || !c.clientSecret)
          throw new OAuthFailure("setup", 503);
        if (
          request.method === "POST" &&
          request.headers.has("origin") &&
          request.headers.get("origin") !== c.origin
        )
          throw new OAuthFailure("invalid", 403);
        const path = url.pathname;
        if (request.method === "GET" && path === PREFIX + "/config")
          return json({
            configured: true,
            apps: Object.keys(GOOGLE_CONNECTORS),
          });
        if (request.method === "GET" && path === PREFIX + "/start") {
          const app = googleApp(url.searchParams.get("app"));
          const state = field(url.searchParams.get("state"), 64, 64);
          const challenge = field(
            url.searchParams.get("code_challenge"),
            43,
            43,
          );
          if (
            !app ||
            !/^[a-f0-9]{64}$/.test(state) ||
            !/^[A-Za-z0-9_-]{43}$/.test(challenge)
          )
            throw new OAuthFailure("invalid");
          language = Object.hasOwn(messages, language) ? language : "en";
          // Previous scopes/account must come from our signed refresh receipt, never caller claims.
          const prior = url.searchParams.has("grant")
            ? verify(c, url.searchParams.get("grant"), "refresh")
            : undefined;
          const ticket = sign(c, {
            purpose: "login",
            exp: seconds() + TTL,
            state,
            challenge,
            language,
            app,
            subject: prior?.subject,
          });
          const scopes = [
            ...new Set([
              ...GOOGLE_IDENTITY_SCOPES,
              ...GOOGLE_CONNECTORS[app].scopes,
              ...(prior?.scopes ?? []),
            ]),
          ];
          const authorize = new URL(
            "https://accounts.google.com/o/oauth2/v2/auth",
          );
          for (const [key, value] of Object.entries({
            client_id: c.clientId,
            redirect_uri: c.origin + PREFIX + "/callback",
            response_type: "code",
            state: ticket,
            code_challenge: challenge,
            code_challenge_method: "S256",
            access_type: "offline",
            include_granted_scopes: "true",
            prompt: "consent",
            scope: scopes.join(" "),
          }))
            authorize.searchParams.set(key, value);
          return redirect(c, authorize, hash(ticket));
        }
        if (request.method === "GET" && path === PREFIX + "/callback") {
          const value = field(url.searchParams.get("state"), 1, 8192);
          const ticket = verify(c, value, "login");
          language = ticket.language || "en";
          const cookie = request.headers
            .get("cookie")
            ?.split(";")
            .map((v) => v.trim())
            .find((v) => v.startsWith(cookieName(c) + "="))
            ?.slice(cookieName(c).length + 1);
          if (!cookie || !equal(cookie, hash(value)))
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
          return redirect(c, target, "");
        }
        if (request.method === "POST" && path === PREFIX + "/exchange") {
          const data = await body(request);
          const ticket = verify(c, data.ticket, "login");
          const verifier = field(data.verifier, 43, 128);
          if (
            !ticket.app ||
            !/^[A-Za-z0-9._~-]+$/.test(verifier) ||
            !equal(hash(verifier), ticket.challenge || "")
          )
            throw new OAuthFailure("auth", 403);
          const token = await providerTokens(
            c,
            new URLSearchParams({
              grant_type: "authorization_code",
              code: field(data.code, 1, 2048),
              code_verifier: verifier,
              redirect_uri: c.origin + PREFIX + "/callback",
            }),
          );
          const user = await identity(token.access_token);
          if (ticket.subject && user.subject !== ticket.subject)
            throw new OAuthFailure("account", 409);
          if (!token.scope || !hasGoogleScopes(ticket.app, token.scope))
            throw new OAuthFailure("scope", 403);
          return result(c, token, user, token.scope);
        }
        if (request.method === "POST" && path === PREFIX + "/refresh") {
          const data = await body(request);
          const ticket = verify(c, data.grant, "refresh");
          const refresh = field(data.refresh_token);
          if (
            !ticket.subject ||
            !ticket.scopes ||
            !equal(hash(refresh), ticket.tokenHash || "")
          )
            throw new OAuthFailure("auth", 403);
          const token = await providerTokens(
            c,
            new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: refresh,
            }),
          );
          const user = await identity(token.access_token);
          if (user.subject !== ticket.subject)
            throw new OAuthFailure("auth", 401);
          return result(
            c,
            { ...token, refresh_token: token.refresh_token ?? refresh },
            user,
            token.scope ?? ticket.scopes,
          );
        }
        return json({ error: "invalid" }, 405);
      } catch (error) {
        const code = error instanceof OAuthFailure ? error.code : "connection";
        const status = error instanceof OAuthFailure ? error.status : 502;
        return request.method === "GET" && !url.pathname.endsWith("/config")
          ? failure(language, status)
          : json({ error: code }, status);
      }
    },
  };
}
