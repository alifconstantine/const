import { NextRequest, NextResponse } from "next/server";
import { getMcpAuthLink } from "@/lib/mcp-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const toolkit = body?.toolkit || body?.toolkitSlug;
    const callbackUrl = body?.callbackUrl || body?.callback_url;

    const ssoToken = req.headers.get("x-const-sso-token")?.trim();
    const deviceId = req.headers.get("x-device-id")?.trim();
    const xUserId = req.headers.get("x-user-id")?.trim();
    const authHeader = req.headers.get("authorization")?.trim();
    const userId =
      body?.userId ||
      body?.user_id ||
      xUserId ||
      deviceId ||
      (authHeader ? authHeader.replace(/^Bearer\s+/i, "").slice(0, 32) : null) ||
      (ssoToken ? ssoToken.slice(0, 32) : null) ||
      "learn_default_user";

    if (!toolkit || typeof toolkit !== "string") {
      return corsJson(
        { success: false, error: "The 'toolkit' field is required." },
        { status: 400 }
      );
    }

    const result = await getMcpAuthLink(toolkit, userId, callbackUrl);

    if (!result.success) {
      return corsJson(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return corsJson(result);
  } catch (err: any) {
    return corsJson(
      {
        success: false,
        error: err.message || "Failed to generate MCP auth link.",
      },
      { status: 500 }
    );
  }
}
