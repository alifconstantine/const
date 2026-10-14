import { NextRequest, NextResponse } from "next/server";
import { checkMcpLimit, getGlobalMcpStats } from "@/lib/mcp-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Const-SSO-Token, X-Device-Id, X-User-Id, X-Title, HTTP-Referer, User-Agent",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function corsJson(data: any, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      ...CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const ssoToken = req.headers.get("x-const-sso-token")?.trim();
    const deviceId = req.headers.get("x-device-id")?.trim();
    const xUserId = req.headers.get("x-user-id")?.trim();
    const authHeader = req.headers.get("authorization")?.trim();
    const searchParams = req.nextUrl.searchParams;
    const isGlobal = searchParams.get("global") === "true";

    if (isGlobal) {
      return corsJson({
        success: true,
        stats: getGlobalMcpStats(),
      });
    }

    const userId =
      searchParams.get("userId") ||
      searchParams.get("user_id") ||
      xUserId ||
      deviceId ||
      (authHeader ? authHeader.replace(/^Bearer\s+/i, "").slice(0, 32) : null) ||
      (ssoToken ? ssoToken.slice(0, 32) : null) ||
      "learn_default_user";

    const usage = checkMcpLimit(userId);

    return corsJson({
      success: true,
      userId,
      usage,
    });
  } catch (err: any) {
    return corsJson(
      { success: false, error: err.message || "Failed to load MCP usage." },
      { status: 500 }
    );
  }
}
