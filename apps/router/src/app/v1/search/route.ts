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

function decodeHtmlEntities(str: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#32;": " ",
  };
  return str.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp|#x27|#x2F|#32);/g, (match) => entities[match] || match);
}

async function searchDuckDuckGoFallback(query: string, numResults: number) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await fetch(searchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`DuckDuckGo fallback failed (HTTP ${resp.status})`);
  }

  const html = await resp.text();
  const titleRegex = /<a[^>]*class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class=["']result__snippet["'][^>]*>([\s\S]*?)<\/a>/gi;

  const rawTitles: Array<{ url: string; title: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = titleRegex.exec(html)) !== null && rawTitles.length < numResults) {
    let url = m[1] ?? "";
    if (url.includes("uddg=")) {
      const match = url.match(/uddg=([^&]+)/);
      if (match && match[1]) url = decodeURIComponent(match[1]);
    }
    const rawTitleStr = m[2] ? m[2].replace(/<[^>]+>/g, "").trim() : "";
    const title = decodeHtmlEntities(rawTitleStr);
    rawTitles.push({ url, title });
  }

  const rawSnippets: string[] = [];
  while ((m = snippetRegex.exec(html)) !== null && rawSnippets.length < numResults) {
    const rawSnipStr = m[1] ? m[1].replace(/<[^>]+>/g, "").trim() : "";
    rawSnippets.push(decodeHtmlEntities(rawSnipStr));
  }

  const results = [];
  for (let i = 0; i < rawTitles.length; i++) {
    const item = rawTitles[i];
    if (item && item.url) {
      const snippet = rawSnippets[i] || "";
      results.push({
        title: item.title || item.url,
        url: item.url,
        snippet,
        content: snippet,
        provider: "const-search",
      });
    }
  }

  return results;
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

    const authHeader = req.headers.get("authorization")?.trim() || "";
    // Only forward Authorization if it is explicitly an engine API key (sk-...)
    // End-users do not need an API key; Const Router provides search natively.
    if (authHeader.startsWith("Bearer sk-") || authHeader.startsWith("sk-")) {
      headers["Authorization"] = authHeader.startsWith("Bearer ")
        ? authHeader
        : `Bearer ${authHeader}`;
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
      contents: { text: true },
      ...(body.include_domains ? { include_domains: body.include_domains } : {}),
      ...(body.exclude_domains ? { exclude_domains: body.exclude_domains } : {}),
      ...(body.type ? { type: body.type } : {}),
      ...(body.start_published_date ? { start_published_date: body.start_published_date } : {}),
      ...(body.end_published_date ? { end_published_date: body.end_published_date } : {}),
      ...(body.category ? { category: body.category } : {}),
    };

    let data: any = null;
    let upstreamFailed = false;

    try {
      const upstreamRes = await fetch(`${constBaseUrl}/v1/search`, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamPayload),
      });

      if (upstreamRes.ok) {
        data = await upstreamRes.json().catch(() => null);
      } else {
        upstreamFailed = true;
      }
    } catch {
      upstreamFailed = true;
    }

    // If Const Engine fails (e.g. 530), fallback to DuckDuckGo (NO Exa)
    if (upstreamFailed || !data || !Array.isArray(data.results)) {
      try {
        const ddgResults = await searchDuckDuckGoFallback(query.trim(), numResults);
        if (ddgResults.length > 0) {
          return corsJson({
            provider: "const-search",
            mode: effectiveMode,
            query: query.trim(),
            results: ddgResults,
          });
        }
      } catch {
        // Fallback failed
      }

      return corsJson(
        { error: { message: "Search upstream error (HTTP 530)" } },
        { status: 530 }
      );
    }

    // Normalize Const Search results (White-labeled as const-search)
    data.results = data.results.map((r: any) => {
      const textSnippet =
        typeof r.snippet === "string" && r.snippet.trim()
          ? r.snippet.trim()
          : typeof r.content === "string"
            ? r.content.trim()
            : r.content?.text?.trim() || "";

      const fullContent =
        typeof r.content === "string" && r.content.trim()
          ? r.content.trim()
          : r.content?.text?.trim() || textSnippet;

      const normalizedItem: Record<string, any> = {
        ...r,
        title: r.title?.trim() || r.display_url || r.url,
        snippet: textSnippet,
        content: fullContent,
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

  const authHeader = req.headers.get("authorization")?.trim() || "";
  if (authHeader.startsWith("Bearer sk-") || authHeader.startsWith("sk-")) {
    headers["Authorization"] = authHeader.startsWith("Bearer ")
      ? authHeader
      : `Bearer ${authHeader}`;
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
    let data: any = null;
    let upstreamFailed = false;

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

      if (upstreamRes.ok) {
        data = await upstreamRes.json().catch(() => null);
      } else {
        upstreamFailed = true;
      }
    } catch {
      upstreamFailed = true;
    }

    if (upstreamFailed || !data || !Array.isArray(data.results)) {
      try {
        const ddgResults = await searchDuckDuckGoFallback(query.trim(), numResults);
        if (ddgResults.length > 0) {
          return corsJson({
            provider: "const-search",
            mode: isDeepResearch ? "deep-research" : "research",
            query: query.trim(),
            results: ddgResults,
          });
        }
      } catch {
        // Fallback failed
      }

      return corsJson(
        { error: { message: "Search upstream error (HTTP 530)" } },
        { status: 530 }
      );
    }

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

    return corsJson(data);
  } catch (err: any) {
    return corsJson(
      { error: { message: err?.message || "Search failed." } },
      { status: 500 }
    );
  }
}
