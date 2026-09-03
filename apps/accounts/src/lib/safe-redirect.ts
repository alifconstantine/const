/**
 * Validates and sanitizes a redirect URL to prevent Open Redirect vulnerabilities (CWE-601).
 * Only registered ecosystem domains (*.const.web.id, *.const.ai, and native app deep links) are permitted.
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

export function getSafeRedirectUrl(
  target: string | null | undefined,
  options: { allowRelative?: boolean } = { allowRelative: false }
): string | null {
  if (!target || typeof target !== "string") return null;

  const trimmed = target.trim();
  if (!trimmed) return null;

  try {
    // 1. Check for Const desktop & mobile native app deep-link schemes
    // arsitektur.md: const-auth:// (desktop), const-learn:// (mobile), const:// (generic)
    const isNativeScheme =
      trimmed.startsWith("const-auth://") ||
      trimmed.startsWith("const-learn://") ||
      trimmed.startsWith("const://");

    if (isNativeScheme) {
      // Validate deep-link format: prevent newlines, null bytes, or dangerous chars
      if (/^const(-auth|-learn)?:\/\/[a-zA-Z0-9_\-\.\/]+(\?.*)?$/i.test(trimmed)) {
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

    // 5. Allow official production and staging domains
    if (
      hostname === "const.web.id" ||
      hostname.endsWith(".const.web.id") ||
      hostname === "const.ai" ||
      hostname.endsWith(".const.ai")
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
