/**
 * Web Search Service for Const Learn Mobile.
 * Powered by Const Router AI Gateway (router.const.web.id) backed by Exa AI.
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

  try {
    let res: Response;
    try {
      res = await doFetch(endpoint);
    } catch {
      // Fallback between local proxy /v1 and direct URL
      if (baseUrl === "/v1") {
        endpoint = "https://router.const.web.id/v1/search";
        res = await doFetch(endpoint);
      } else {
        endpoint = "/v1/search";
        res = await doFetch(endpoint);
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Search failed (HTTP ${res.status}): ${errText || res.statusText}`);
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((r: any) => ({
      title: r.title || r.url || "Untitled Source",
      url: r.url,
      snippet: r.snippet || r.content?.slice(0, 280) || "",
      content: r.content || r.snippet || "",
      author: r.author,
      publishedDate: r.published_date,
      score: r.score,
    }));
  } catch (err: any) {
    if (err.name === "AbortError") throw err;
    console.error("searchWebSources error:", err);
    throw err;
  }
}
