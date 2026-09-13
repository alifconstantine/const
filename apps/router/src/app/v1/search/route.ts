import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Const-SSO-Token, X-Title, HTTP-Referer, User-Agent",
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
    const constBaseUrl = (
      process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id"
    ).replace(/\/+$/, "");
    const constEngineKey = process.env.CONST_ENGINE_API_KEY?.trim() || "";

    const body = await req.json().catch(() => ({}));
    const query = body?.query || body?.q;

    if (!query || typeof query !== "string" || !query.trim()) {
      return corsJson(
        { error: { message: "The 'query' field is required." } },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (constEngineKey) {
      headers["Authorization"] = `Bearer ${constEngineKey}`;
    } else {
      const authHeader = req.headers.get("authorization")?.trim();
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }
    }

    const upstreamPayload = {
      query: query.trim(),
      ...(body.search_depth ? { search_depth: body.search_depth } : {}),
      ...(body.include_domains ? { include_domains: body.include_domains } : {}),
      ...(body.exclude_domains ? { exclude_domains: body.exclude_domains } : {}),
      ...(body.max_results ? { max_results: body.max_results } : {}),
    };

    const upstreamRes = await fetch(`${constBaseUrl}/v1/search`, {
      method: "POST",
      headers,
      body: JSON.stringify(upstreamPayload),
    });

    const data = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      const errorMsg =
        data?.error?.message ||
        data?.message ||
        `Search upstream error (HTTP ${upstreamRes.status})`;
      return corsJson({ error: { message: errorMsg } }, { status: upstreamRes.status });
    }

    return corsJson(data);
  } catch (err: any) {
    return corsJson(
      { error: { message: err?.message || "Internal server error during search." } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || searchParams.get("query");

  if (!query) {
    return corsJson(
      { error: { message: "Query parameter 'q' or 'query' is required." } },
      { status: 400 }
    );
  }

  const constBaseUrl = (
    process.env.CONST_ENGINE_BASE_URL?.trim() || "https://engine.const.web.id"
  ).replace(/\/+$/, "");
  const constEngineKey = process.env.CONST_ENGINE_API_KEY?.trim() || "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (constEngineKey) {
    headers["Authorization"] = `Bearer ${constEngineKey}`;
  }

  try {
    const upstreamRes = await fetch(`${constBaseUrl}/v1/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });

    const data = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      return corsJson(
        { error: { message: data?.error?.message || "Search failed." } },
        { status: upstreamRes.status }
      );
    }

    return corsJson(data);
  } catch (err: any) {
    return corsJson(
      { error: { message: err?.message || "Search failed." } },
      { status: 500 }
    );
  }
}
