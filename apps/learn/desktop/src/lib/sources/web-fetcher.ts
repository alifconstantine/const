/**
 * Web Fetcher & Documentation Crawler Service for Const Learn.
 * Connects to Const Router (/v1/fetch) with direct Jina Reader fallback.
 * Allows single clean web page fetching or recursive docs suite crawling.
 */

import { getRouterBaseUrl } from "./search-service";

export interface WebFetchOptions {
  crawlSubpages?: boolean;
  maxPages?: number;
  signal?: AbortSignal;
}

export interface WebFetchResult {
  url: string;
  title: string;
  content: string;
  subpagesCount: number;
  pages?: Array<{
    url: string;
    title: string;
    content: string;
  }>;
}

export async function fetchWebContent(
  url: string,
  options: WebFetchOptions = {}
): Promise<WebFetchResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("URL cannot be empty.");
  }

  let targetUrl = trimmed;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  const crawlSubpages = Boolean(options.crawlSubpages);
  const maxPages = Math.min(Math.max(options.maxPages || 10, 1), 25);

  const authToken =
    localStorage.getItem("const_learn_auth_token") ||
    localStorage.getItem("const_sso_token") ||
    "";

  const payload = {
    url: targetUrl,
    crawl_subpages: crawlSubpages,
    max_pages: maxPages,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  const baseUrl = getRouterBaseUrl();
  let endpoint = `${baseUrl.replace(/\/+$/, "")}/fetch`;

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
      if (baseUrl === "/v1") {
        endpoint = "https://router.const.web.id/v1/fetch";
        res = await doFetch(endpoint);
      } else {
        endpoint = "/v1/fetch";
        res = await doFetch(endpoint);
      }
    }

    if (res.ok) {
      const data = await res.json();
      return {
        url: data.url || targetUrl,
        title: data.title || targetUrl,
        content: data.content || "",
        subpagesCount: data.subpagesCount || 1,
        pages: data.pages || [],
      };
    }
  } catch (err) {
    console.warn("Router /v1/fetch failed, trying direct Jina Reader fallback:", err);
  }

  // Fallback: Direct Jina Reader API
  try {
    const jinaUrl = `https://r.jina.ai/${targetUrl}`;
    const jinaRes = await fetch(jinaUrl, {
      headers: {
        Accept: "text/markdown, text/plain",
      },
      signal: options.signal,
    });

    if (!jinaRes.ok) {
      throw new Error(`Failed to fetch web content (HTTP ${jinaRes.status})`);
    }

    const markdown = await jinaRes.text();
    let title = "";
    const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }
    if (!title) {
      try {
        const u = new URL(targetUrl);
        title = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
      } catch {
        title = targetUrl;
      }
    }

    return {
      url: targetUrl,
      title,
      content: markdown,
      subpagesCount: 1,
      pages: [{ url: targetUrl, title, content: markdown }],
    };
  } catch (fallbackErr: any) {
    throw new Error(`Failed to fetch website content: ${fallbackErr.message || String(fallbackErr)}`);
  }
}
