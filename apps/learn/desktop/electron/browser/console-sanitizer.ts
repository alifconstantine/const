/**
 * Secret redaction for browser console + network telemetry.
 *
 * Captured console output and network metadata are forwarded to the model, so
 * any credential that survives here ends up in model context and in session
 * transcripts. Redaction is deliberately conservative: a false positive costs
 * some debugging context, a false negative leaks a credential. Every helper is
 * best-effort, never throws and always returns a string.
 */

/** Keys whose value is always a credential. */
export const SENSITIVE_KEY_PATTERN =
  "authorization|cookie|set-cookie|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|password";

/** Additional keys that are secret-looking often enough to be worth redacting. */
export const SECRET_LIKE_KEY_PATTERN =
  "token|secret|passwd|pwd|pass|private[_-]?key|access[_-]?key|secret[_-]?key|session[_-]?id|session[_-]?token|credential|credentials|jwt|signature|sig|csrf[_-]?token|xsrf[_-]?token|auth|bearer";

/** Keys that carry a header-style value which runs until the end of the line. */
const HEADER_LIKE_KEY_PATTERN =
  "set-cookie|proxy-authorization|authentication|authorization|cookie|cookies|x-api-key|x-auth-token|x-access-token|x-refresh-token|x-csrf-token|x-xsrf-token";

export const MAX_CONSOLE_TEXT_CHARS = 8192;
export const MAX_HOST_CONSOLE_TEXT_CHARS = 4096;
export const MAX_CONSOLE_LOCATION_CHARS = 2048;
export const MAX_CONSOLE_STACK_CHARS = 16384;
export const MAX_NETWORK_URL_CHARS = 2048;
export const MAX_NETWORK_STATUS_CHARS = 512;
export const MAX_NETWORK_BODY_PREVIEW_CHARS = 1024;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "proxyauthorization",
  "authentication",
  "cookie",
  "cookies",
  "setcookie",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "apikey",
  "clientsecret",
  "password",
]);

const SECRET_LIKE_KEYS = new Set([
  "token",
  "secret",
  "passwd",
  "pwd",
  "pass",
  "privatekey",
  "accesskey",
  "secretkey",
  "sessionid",
  "sessiontoken",
  "credential",
  "credentials",
  "jwt",
  "signature",
  "sig",
  "csrf",
  "xsrf",
  "csrftoken",
  "xsrftoken",
  "auth",
  "authtoken",
  "bearer",
  "xapikey",
  "xauthtoken",
  "xaccesstoken",
  "xrefreshtoken",
  "xcsrftoken",
  "xxsrftoken",
  "passwordhash",
]);

/** A key may be preceded by `_` or `-` (`user_token`) but not by a letter/digit. */
const KEY_BEFORE = "(?<![A-Za-z0-9])";
/** A key may not be followed by a letter/digit (`tokenizer`). */
const KEY_AFTER = "(?![A-Za-z0-9])";

const QUOTED_FIELD_RE = new RegExp(
  `(["'\`])((${SENSITIVE_KEY_PATTERN}|${SECRET_LIKE_KEY_PATTERN}))\\1(\\s*[:=]\\s*)("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`,
  "gi"
);

const HEADER_LIKE_RE = new RegExp(
  `(?<![?&#A-Za-z0-9])(${HEADER_LIKE_KEY_PATTERN})\\s*[:=]\\s*[^\\r\\n]*?(?=\\s+(?:${SENSITIVE_KEY_PATTERN}|${SECRET_LIKE_KEY_PATTERN})\\b\\s*[:=]|[\\r\\n]|$)`,
  "gi"
);

const INLINE_SECRET_RE = new RegExp(
  `${KEY_BEFORE}(${SENSITIVE_KEY_PATTERN}|${SECRET_LIKE_KEY_PATTERN})${KEY_AFTER}(\\s*[:=]\\s*)(?:"[^"]*"|'[^']*'|[^\\s,;}&\\]]+)`,
  "gi"
);

const AUTH_SCHEME_RE = /\b(Bearer|Basic|Digest|Negotiate|Token)\s+[A-Za-z0-9\-._~+/=]{4,}/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g;
const DATA_URI_RE = /\bdata:[^\s"'<>()]+/gi;
const URL_IN_TEXT_RE = /\b(?:https?|wss?|ftp|file|blob):\/\/[^\s"'<>]+/gi;
const REDACTED_MARKER = "[REDACTED]";

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return String(value);
  } catch {
    return "";
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, "");
  return SENSITIVE_KEYS.has(normalized) || SECRET_LIKE_KEYS.has(normalized);
}

/** Hard-bound a value and mark that it was cut. */
export function truncateValue(value: string, maxChars: number): string {
  const text = toText(value);
  const limit = Number.isFinite(maxChars) ? Math.floor(maxChars) : 0;
  if (limit <= 0) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function redactQuotedField(
  _match: string,
  keyQuote: string,
  key: string,
  separator: string,
  rawValue: string
): string {
  const valueQuote = rawValue.startsWith("'") ? "'" : '"';
  return `${keyQuote}${key}${keyQuote}${separator}${valueQuote}${REDACTED_MARKER}${valueQuote}`;
}

/** Text-only redaction; never touches URLs so it can be reused inside `sanitizeUrl`. */
function redactText(value: string): string {
  return value
    .replace(QUOTED_FIELD_RE, redactQuotedField)
    .replace(HEADER_LIKE_RE, `$1: ${REDACTED_MARKER}`)
    .replace(INLINE_SECRET_RE, `$1$2${REDACTED_MARKER}`)
    .replace(AUTH_SCHEME_RE, `$1 ${REDACTED_MARKER}`)
    .replace(JWT_RE, REDACTED_MARKER)
    .replace(DATA_URI_RE, `data:${REDACTED_MARKER}`);
}

function redactSearch(search: string): string {
  if (!search || search === "?") return "";
  const body = search.startsWith("?") ? search.slice(1) : search;
  if (!body) return "";
  const parts = body.split("&").map((part) => {
    if (!part) return part;
    const equals = part.indexOf("=");
    const rawKey = equals === -1 ? part : part.slice(0, equals);
    if (!isSensitiveKey(safeDecode(rawKey))) return part;
    return `${rawKey}=${REDACTED_MARKER}`;
  });
  return `?${parts.join("&")}`;
}

function redactHash(hash: string): string {
  if (!hash || hash === "#") return "";
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!body) return "";
  if (body.includes("=")) return `#${redactSearch(`?${body}`).replace(/^\?/, "")}`;
  if (/(token|secret|key|auth|password|session|credential|jwt|sig)/i.test(body)) {
    return `#${REDACTED_MARKER}`;
  }
  return hash;
}

/**
 * Redact credentials from an arbitrary string while keeping the key names and
 * the surrounding context intact.
 */
export function redactSecrets(value: string): string {
  const text = toText(value);
  if (!text) return "";
  try {
    return redactText(text).replace(URL_IN_TEXT_RE, (url) => sanitizeUrl(url));
  } catch {
    return text;
  }
}

/**
 * Redact a URL: drop userinfo, blank out sensitive query parameters, collapse
 * `data:`/`blob:` URLs and fall back to textual redaction when unparseable.
 */
export function sanitizeUrl(value: string): string {
  const raw = toText(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "data:") return `data:${REDACTED_MARKER}`;
    if (protocol === "blob:") {
      const inner = raw.slice("blob:".length);
      return truncateValue(`blob:${sanitizeUrl(inner)}`, MAX_NETWORK_URL_CHARS);
    }
    url.username = "";
    url.password = "";
    url.search = redactSearch(url.search);
    url.hash = redactHash(url.hash);
    const serialized = url.toString().replace(/%5BREDACTED%5D/gi, REDACTED_MARKER);
    return truncateValue(redactText(serialized), MAX_NETWORK_URL_CHARS);
  } catch {
    return truncateValue(redactText(raw), MAX_NETWORK_URL_CHARS);
  }
}

/** Redact a captured console message and bound its length. */
export function sanitizeConsoleText(value: string): string {
  return truncateValue(redactSecrets(value), MAX_CONSOLE_TEXT_CHARS);
}

/** Redact a captured console location (script URL or file path) and bound it. */
export function sanitizeConsoleLocation(value: string): string {
  return truncateValue(redactSecrets(value), MAX_CONSOLE_LOCATION_CHARS);
}

/** Redact a captured stack trace and bound its length. */
export function sanitizeStack(value: string): string {
  return truncateValue(redactSecrets(value), MAX_CONSOLE_STACK_CHARS);
}

/** Redact a network response body preview (including inline `data:` URIs). */
export function sanitizeBodyPreview(value: string): string {
  const redacted = redactSecrets(value).replace(DATA_URI_RE, `data:${REDACTED_MARKER}`);
  return truncateValue(redacted, MAX_NETWORK_BODY_PREVIEW_CHARS);
}

/** Redact a network status line and bound its length. */
export function sanitizeNetworkStatusText(value: string): string {
  return truncateValue(redactSecrets(value), MAX_NETWORK_STATUS_CHARS);
}
