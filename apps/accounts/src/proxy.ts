import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

// In-memory sliding window rate-limiter for /api/auth requests per IP
const authRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_AUTH_REQUESTS_PER_MINUTE = 10;
const WINDOW_MS = 60 * 1000;

function isRateLimited(
  ip: string,
  maximum = MAX_AUTH_REQUESTS_PER_MINUTE,
): boolean {
  const now = Date.now();
  const record = authRateLimitMap.get(ip);

  // Clean up periodically if map grows large
  if (authRateLimitMap.size > 10000) {
    for (const [key, val] of authRateLimitMap.entries()) {
      if (now > val.resetAt) authRateLimitMap.delete(key);
    }
  }

  if (!record || now > record.resetAt) {
    authRateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (record.count >= maximum) {
    return true;
  }

  record.count += 1;
  return false;
}

const baseMiddleware = convexAuthNextjsMiddleware(async (request) => {
  const url = request.nextUrl;
  const continueParam =
    url.searchParams.get("continue") ||
    url.searchParams.get("redirect") ||
    url.searchParams.get("app");
  const codeParam =
    url.searchParams.get("code") || url.searchParams.get("token");

  const isProduction =
    process.env.NODE_ENV === "production" ||
    url.hostname === "accounts.const.web.id";

  // If visited directly on production without an authorized app continue target or magic link code:
  // immediately redirect to the main ecosystem portal (https://const.web.id)
  if (isProduction && !continueParam && !codeParam && url.pathname === "/") {
    return NextResponse.redirect(new URL("https://const.web.id"));
  }
});

export default async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const { pathname } = request.nextUrl;

  // Connector OAuth has its own state/cookie/PKCE flow; Const sign-in must not consume its code.
  if (pathname.startsWith("/mcp/google/")) return NextResponse.next();
  if (
    pathname.startsWith("/oauth/github/") ||
    pathname.startsWith("/oauth/google/")
  ) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    // Seven incremental Google connections need fourteen start/exchange requests.
    // Keep connector traffic separate from the stricter Const sign-in limit.
    if (
      (request.method === "POST" || pathname.endsWith("/start")) &&
      isRateLimited("connector:" + ip, 60)
    ) {
      return NextResponse.json(
        { error: "connection" },
        {
          status: 429,
          headers: { "Retry-After": "60", "Cache-Control": "no-store" },
        },
      );
    }
    return NextResponse.next();
  }

  // Server-side IP rate limiting on sensitive /api/auth endpoints
  if (pathname.startsWith("/api/auth") && request.method === "POST") {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          error:
            "Too many authentication attempts. Please wait a minute before trying again.",
        },
        { status: 429 },
      );
    }
  }

  return baseMiddleware(request, event);
}

export const proxy = middleware;

export const config = {
  // The following matcher runs on all routes except static assets
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
