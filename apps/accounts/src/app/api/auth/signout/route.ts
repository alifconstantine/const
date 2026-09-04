import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAMES = [
  "__convexAuthJWT",
  "__Host-__convexAuthJWT",
  "__convexAuthRefreshToken",
  "__Host-__convexAuthRefreshToken",
  "__convexAuthOAuthVerifier",
  "__Host-__convexAuthOAuthVerifier",
  "const_sso_token",
  "const_sso_refresh_token",
];

function buildExpiredCookieHeaders(): string[] {
  const headers: string[] = [];

  for (const name of AUTH_COOKIE_NAMES) {
    const isHostPrefix = name.startsWith("__Host-");

    // Standard path=/ cookie deletion
    headers.push(
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
    );

    // Secure variant
    headers.push(
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`
    );

    // HttpOnly variant
    headers.push(
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
    );
    headers.push(
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`
    );

    // Domain-scoped variant for cross-subdomain SSO (not valid for __Host- prefix)
    if (!isHostPrefix) {
      headers.push(
        `${name}=; Domain=.const.web.id; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`
      );
      headers.push(
        `${name}=; Domain=.const.web.id; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure`
      );
    }
  }

  return headers;
}

export async function POST(_request: NextRequest) {
  const response = NextResponse.json(
    { success: true, message: "Signed out successfully" },
    { status: 200 }
  );

  const cookieHeaders = buildExpiredCookieHeaders();
  for (const header of cookieHeaders) {
    response.headers.append("Set-Cookie", header);
  }

  return response;
}

export async function GET(request: NextRequest) {
  return POST(request);
}
