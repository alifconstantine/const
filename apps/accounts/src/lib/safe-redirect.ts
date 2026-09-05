/**
 * Validates and sanitizes a redirect URL to prevent Open Redirect vulnerabilities (CWE-601).
 * Only registered ecosystem domains (*.const.web.id and native app deep links) are permitted.
 * Localhost is strictly restricted to development environments.
 */

/**
 * Returns the default ecosystem fallback URL (e.g. landing or main app)
 * when no valid continue parameter is supplied.
 */
export function getDefaultRedirectUrl(): string {
  const isDev =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (isDev) {
    return "http://localhost:3000";
  }
  return "https://const.web.id";
}

/**
 * Determines whether a target URL is a native app scheme (e.g. desktop/mobile deep link)
 */
export function isNativeRedirectUrl(target: string | null | undefined): boolean {
  if (!target || typeof target !== "string") return false;
  const trimmed = target.trim();
  return (
    trimmed.startsWith("const-harness://") ||
    trimmed.startsWith("const-learn://") ||
    trimmed.startsWith("const-auth://") ||
    trimmed.startsWith("const://")
  );
}

/**
 * Dynamically resolves the human-readable application name from a target URL
 */
export function getAppNameFromUrl(target: string | null | undefined): string {
  if (!target || typeof target !== "string") return "Const";
  const trimmed = target.trim();

  if (trimmed.startsWith("const-harness://")) return "Const Harness";
  if (trimmed.startsWith("const-learn://")) return "Const Learn";
  if (trimmed.startsWith("const-auth://") || trimmed.startsWith("const://")) return "Const";

  try {
    const parsed = new URL(trimmed, "https://const.web.id");
    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port;

    if (hostname === "harness.const.web.id" || hostname.startsWith("harness.")) {
      return "Const Harness";
    }
    if (hostname === "router.const.web.id" || hostname.startsWith("router.") || hostname.includes("router") || port === "3002") {
      return "Const Router";
    }
    if (hostname === "learn.const.web.id" || hostname.startsWith("learn.") || port === "5173") {
      return "Const Learn";
    }
    if (hostname === "accounts.const.web.id" || hostname.startsWith("accounts.") || port === "3001") {
      return "Const Accounts";
    }
    if (hostname === "const.web.id" || port === "3000") {
      return "Const";
    }
    return "Const";
  } catch {
    return "Const";
  }
}

export function getSafeRedirectUrl(
  target: string | null | undefined,
  options: { allowRelative?: boolean } = { allowRelative: false }
): string | null {
  if (!target || typeof target !== "string") return null;

  const trimmed = target.trim();
  if (!trimmed) return null;

  try {
    // 1. Check for Const desktop & mobile native app deep-link schemes
    // arsitektur.md: const-auth:// (desktop), const-learn:// (mobile), const-harness:// (desktop), const:// (generic)
    const isNativeScheme =
      trimmed.startsWith("const-harness://") ||
      trimmed.startsWith("const-auth://") ||
      trimmed.startsWith("const-learn://") ||
      trimmed.startsWith("const://");

    if (isNativeScheme) {
      // Validate deep-link format: prevent newlines, null bytes, or dangerous chars
      if (/^const(-auth|-learn|-harness)?:\/\/[a-zA-Z0-9_\-\.\/]+(\?.*)?$/i.test(trimmed)) {
        return trimmed;
      }
      console.warn(`[Security] Malformed native deep-link blocked: ${trimmed}`);
      return null;
    }

    // 2. Relative path support (internal navigation on the same origin)
    // Disallow protocol-relative URLs like "//evil.com" or backslash bypasses "/\" or "\evil.com"
    if (
      (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) &&
      !trimmed.startsWith("\\")
    ) {
      if (options.allowRelative) {
        return trimmed;
      }
      return null;
    }

    // 3. Absolute URL parsing
    const parsed = new URL(trimmed);

    // Only allow http: and https: protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();

    // 4. Local development origins - STRICTLY DISABLED in production
    const isDevEnvironment =
      process.env.NODE_ENV !== "production" ||
      (typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"));

    if (
      isDevEnvironment &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".localhost"))
    ) {
      return trimmed;
    }

    // 5. Allow official production domains (*.const.web.id and *.vercel.app deployments)
    if (
      hostname === "const.web.id" ||
      hostname.endsWith(".const.web.id") ||
      hostname.endsWith(".vercel.app")
    ) {
      return trimmed;
    }

    // Untrusted external domain
    console.warn(`[Security] Untrusted redirect target blocked: ${trimmed}`);
    return null;
  } catch {
    return null;
  }
}
