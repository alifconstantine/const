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
    const constEngineKey =
      process.env.CONST_ENGINE_API_KEY?.trim() || "sk-f5ee326335f0dff1-c30518-93814e47";

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

    const authHeader = req.headers.get("authorization")?.trim();
    if (authHeader && !authHeader.includes("...")) {
      headers["Authorization"] = authHeader;
    } else if (constEngineKey) {
      headers["Authorization"] = `Bearer ${constEngineKey}`;
    }

    const isDeepResearch =
      body.mode === "deep-research" ||
      body.mode === "deep_research" ||
      body.search_depth === "deep" ||
      body.deep_research === true;

    const effectiveMode = isDeepResearch ? "deep-research" : "research";
    const defaultNumResults = isDeepResearch ? 10 : 5;
    const numResults = body.num_results ?? body.max_results ?? defaultNumResults;

    const upstreamPayload: Record<string, any> = {
      query: query.trim(),
      num_results: numResults,
      max_results: numResults,
      search_depth: isDeepResearch ? "deep" : (body.search_depth || "basic"),
      ...(body.include_domains ? { include_domains: body.include_domains } : {}),
      ...(body.exclude_domains ? { exclude_domains: body.exclude_domains } : {}),
      ...(body.type ? { type: body.type } : {}),
      ...(body.start_published_date ? { start_published_date: body.start_published_date } : {}),
      ...(body.end_published_date ? { end_published_date: body.end_published_date } : {}),
      ...(body.category ? { category: body.category } : {}),
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

    // Normalize Const Search results (White-labeled as const-search)
    if (data && Array.isArray(data.results)) {
      data.results = data.results.map((r: any) => {
        const textSnippet =
          typeof r.snippet === "string" && r.snippet.trim()
            ? r.snippet.trim()
            : typeof r.content === "string"
              ? r.content.trim()
              : r.content?.text?.trim() || "";

        const normalizedItem: Record<string, any> = {
          ...r,
          title: r.title?.trim() || r.display_url || r.url,
          snippet: textSnippet,
        };

        if (normalizedItem.citation && typeof normalizedItem.citation === "object") {
          normalizedItem.citation = {
            ...normalizedItem.citation,
            provider: "const-search",
          };
        }

        return normalizedItem;
      });
      data.provider = "const-search";
      data.mode = effectiveMode;
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
  const constEngineKey =
    process.env.CONST_ENGINE_API_KEY?.trim() || "sk-f5ee326335f0dff1-c30518-93814e47";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const authHeader = req.headers.get("authorization")?.trim();
  if (authHeader && !authHeader.includes("...")) {
    headers["Authorization"] = authHeader;
  } else if (constEngineKey) {
    headers["Authorization"] = `Bearer ${constEngineKey}`;
  }

  const mode =
    searchParams.get("mode") ||
    (searchParams.get("deep") === "true" ? "deep-research" : "research");
  const isDeepResearch =
    mode === "deep-research" || searchParams.get("search_depth") === "deep";
  const numResults = isDeepResearch ? 10 : 5;

  try {
    const upstreamRes = await fetch(`${constBaseUrl}/v1/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: query.trim(),
        num_results: numResults,
        max_results: numResults,
        search_depth: isDeepResearch ? "deep" : "basic",
      }),
    });

    const data = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      return corsJson(
        { error: { message: data?.error?.message || "Search failed." } },
        { status: upstreamRes.status }
      );
    }

    if (data && Array.isArray(data.results)) {
      data.results = data.results.map((r: any) => {
        const textSnippet =
          typeof r.snippet === "string" && r.snippet.trim()
            ? r.snippet.trim()
            : typeof r.content === "string"
              ? r.content.trim()
              : r.content?.text?.trim() || "";

        const normalizedItem: Record<string, any> = {
          ...r,
          title: r.title?.trim() || r.display_url || r.url,
          snippet: textSnippet,
        };

        if (normalizedItem.citation && typeof normalizedItem.citation === "object") {
          normalizedItem.citation = {
            ...normalizedItem.citation,
            provider: "const-search",
          };
        }

        return normalizedItem;
      });
      data.provider = "const-search";
      data.mode = isDeepResearch ? "deep-research" : "research";
    }

    return corsJson(data);
  } catch (err: any) {
    return corsJson(
      { error: { message: err?.message || "Search failed." } },
      { status: 500 }
    );
  }
}
