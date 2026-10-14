/**
 * Web Search Service for Const Learn.
 * Powered by Const Search with native DuckDuckGo public fallback.
 * Supports both standard Fast Search and Deep Research mode,
 * as well as Web vs Academic Journal category filtering.
 */

export interface SearchSourceOptions {
  mode?: "fast" | "deep";
  category?: "web" | "journal";
  numResults?: number;
  signal?: AbortSignal;
}

export interface SearchSourceResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  author?: string;
  publishedDate?: string;
  score?: number;
}

export function getRouterBaseUrl(): string {
  const envBaseUrl =
    (import.meta as any).env?.VITE_CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.CONST_ROUTER_BASE_URL ||
    (import.meta as any).env?.VITE_CONST_ENGINE_BASE_URL;

  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, "");
  }

  // When running locally in browser, use Vite's dev proxy at /v1
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "/v1";
  }

  return "https://router.const.web.id/v1";
}

function normalizeRawResults(rawResults: any[]): SearchSourceResult[] {
  return rawResults.map((r: any) => {
    let content = "";
    if (typeof r.content === "string") {
      content = r.content;
    } else if (r.content && typeof r.content === "object") {
      content =
        (typeof r.content.text === "string" && r.content.text) ||
        (typeof r.content.snippet === "string" && r.content.snippet) ||
        (typeof r.content.content === "string" && r.content.content) ||
        "";
    }

    let snippet = "";
    if (typeof r.snippet === "string") {
      snippet = r.snippet;
    } else if (typeof r.snippet === "object" && r.snippet) {
      snippet = r.snippet.text || "";
    } else if (content) {
      snippet = content.slice(0, 280);
    }

    if (!content && snippet) {
      content = snippet;
    }

    return {
      title: r.title || r.url || "Untitled Source",
      url: r.url,
      snippet,
      content,
      author: r.author,
      publishedDate: r.published_date || r.publishedDate,
      score: r.score,
    };
  });
}

export async function searchWebSources(
  query: string,
  options: SearchSourceOptions = {}
): Promise<SearchSourceResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const isDeep = options.mode === "deep";
  const numResults = options.numResults ?? (isDeep ? 10 : 5);
  const category = options.category === "journal" ? "research" : "general";

  const authToken =
    localStorage.getItem("const_learn_auth_token") ||
    localStorage.getItem("const_sso_token") ||
    "";

  const payload = {
    query: trimmed,
    mode: isDeep ? "deep-research" : "research",
    search_depth: isDeep ? "deep" : "basic",
    num_results: numResults,
    category,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(authToken.startsWith("sk-") ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(authToken ? { "X-Const-SSO-Token": authToken } : {}),
  };

  const baseUrl = getRouterBaseUrl();
  let endpoint = `${baseUrl.replace(/\/+$/, "")}/search`;

  const doFetch = async (targetEndpoint: string) => {
    return await fetch(targetEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: options.signal,
    });
  };

  let lastErrorMsg = "";

  // 1. Try Const Router search
  try {
    let res: Response | null = null;
    try {
      res = await doFetch(endpoint);
    } catch {
      // Fallback between local proxy /v1 and direct URL
      try {
        if (baseUrl === "/v1") {
          endpoint = "https://router.const.web.id/v1/search";
          res = await doFetch(endpoint);
        } else {
          endpoint = "/v1/search";
          res = await doFetch(endpoint);
        }
      } catch {
        res = null;
      }
    }

    if (res && res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        return normalizeRawResults(data.results);
      }
    } else if (res) {
      const errText = await res.text().catch(() => "");
      lastErrorMsg = `HTTP ${res.status}: ${errText || res.statusText}`;
    }
  } catch (err: any) {
    if (err.name === "AbortError") throw err;
    lastErrorMsg = err?.message || "Router search failed";
  }

  // 2. Fallback to Electron IPC agent:web-search if available (uses DuckDuckGo in Node, NO Exa)
  const electronWebSearch = (window as any).electron?.agent?.webSearch;
  if (typeof electronWebSearch === "function") {
    try {
      const agentRes = await electronWebSearch(trimmed, numResults);
      if (agentRes && Array.isArray(agentRes.sources) && agentRes.sources.length > 0) {
        return agentRes.sources.map((s: any) => ({
          title: s.title || s.url || "Untitled Source",
          url: s.url,
          snippet: s.snippet || "",
          content: s.snippet || "",
          publishedDate: s.publishedAt,
        }));
      }
    } catch (ipcErr: any) {
      if (ipcErr?.name === "AbortError") throw ipcErr;
      lastErrorMsg = ipcErr?.message || lastErrorMsg;
    }
  }

  // 3. If all failed, throw error so UI toast displays
  throw new Error(`Search failed (${lastErrorMsg || "Service temporarily unavailable"})`);
}
