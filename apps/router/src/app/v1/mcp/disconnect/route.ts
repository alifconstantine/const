import { NextRequest, NextResponse } from "next/server";
import { disconnectMcpAccount } from "@/lib/mcp-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
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
    const accountId = body?.accountId || body?.account_id;

    if (!accountId || typeof accountId !== "string") {
      return corsJson(
        { success: false, error: "The 'accountId' field is required." },
        { status: 400 }
      );
    }

    const result = await disconnectMcpAccount(accountId);
    return corsJson(result);
  } catch (err: any) {
    return corsJson(
      { success: false, error: err.message || "Failed to disconnect account." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  return POST(req);
}
