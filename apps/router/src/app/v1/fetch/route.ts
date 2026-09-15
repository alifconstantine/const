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

/**
 * Fetch a single page and convert to clean markdown using Jina Reader
 * with a fallback to direct fetch and HTML-to-text extraction.
 */
async function fetchCleanMarkdown(targetUrl: string): Promise<{ title: string; markdown: string }> {
  try {
    // 1. Try Jina Reader API (high quality, noise-free Markdown)
    const jinaUrl = `https://r.jina.ai/${targetUrl}`;
    const jinaRes = await fetch(jinaUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ConstLearn/1.0",
        Accept: "text/markdown, text/plain",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (jinaRes.ok) {
      const rawText = await jinaRes.text();
      let title = "";
      const titleMatch = rawText.match(/^Title:\s*(.+)$/m);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }

      if (!title) {
        try {
          const u = new URL(targetUrl);
          title = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
          title = title.replace(/[-_]/g, " ").replace(/\.(html?|md)$/i, "");
        } catch {
          title = targetUrl;
        }
      }

      return { title, markdown: rawText };
    }
  } catch (err) {
    console.warn(`Jina Reader fetch failed for ${targetUrl}, falling back to direct HTML parse:`, err);
  }

  // 2. Fallback: Direct HTML fetch and tag stripping
  try {
    const htmlRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ConstLearn/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!htmlRes.ok) {
      throw new Error(`HTTP ${htmlRes.status}: ${htmlRes.statusText}`);
    }

    const html = await htmlRes.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : "";
    if (!title) {
      const u = new URL(targetUrl);
      title = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
    }

    // Strip script, style, nav, footer
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

    // Convert headings and paragraphs
    cleaned = cleaned
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();

    return { title, markdown: cleaned };
  } catch (directErr: any) {
    throw new Error(`Failed to fetch page content: ${directErr?.message || String(directErr)}`);
  }
}

/**
 * Extract candidate documentation sub-page links from an HTML or Markdown page.
 */
function extractDocSubLinks(content: string, rootUrl: string): string[] {
  try {
    const rootObj = new URL(rootUrl);
    const origin = rootObj.origin;
    // Base path prefix, e.g. /docs or /learn
    const pathSegments = rootObj.pathname.split("/").filter(Boolean);
    const basePath = pathSegments.length > 0 ? `/${pathSegments[0]}` : "/";

    const links = new Set<string>();

    // Match HTML hrefs: href="..."
    const hrefRegex = /href=["']([^"'#\s]+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = hrefRegex.exec(content)) !== null) {
      const rawHref = match[1];
      if (!rawHref) continue;

      try {
        const fullUrl = new URL(rawHref, rootUrl);
        if (
          fullUrl.origin === origin &&
          fullUrl.pathname.startsWith(basePath) &&
          fullUrl.href !== rootUrl &&
          !fullUrl.pathname.match(/\.(png|jpe?g|gif|svg|webp|zip|pdf|exe|css|js|woff2?)$/i)
        ) {
          links.add(fullUrl.href.replace(/#.*$/, ""));
        }
      } catch {}
    }

    // Match Markdown links: [text](url)
    const mdLinkRegex = /\[[^\]]*\]\(([^)#\s]+)\)/g;
    while ((match = mdLinkRegex.exec(content)) !== null) {
      const rawUrl = match[1];
      if (!rawUrl) continue;
      try {
        const fullUrl = new URL(rawUrl, rootUrl);
        if (
          fullUrl.origin === origin &&
          fullUrl.pathname.startsWith(basePath) &&
          fullUrl.href !== rootUrl &&
          !fullUrl.pathname.match(/\.(png|jpe?g|gif|svg|webp|zip|pdf|exe|css|js|woff2?)$/i)
        ) {
          links.add(fullUrl.href.replace(/#.*$/, ""));
        }
      } catch {}
    }

    return Array.from(links);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = body?.url?.trim();
    const crawlSubpages = Boolean(body?.crawl_subpages || body?.crawl || body?.recursive);
    const maxPages = Math.min(Math.max(body?.max_pages || 10, 1), 25);

    if (!rawUrl) {
      return corsJson(
        { error: { message: "The 'url' field is required." } },
        { status: 400 }
      );
    }

    let targetUrl = rawUrl;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    // 1. Fetch root page
    const rootResult = await fetchCleanMarkdown(targetUrl);

    if (!crawlSubpages) {
      return corsJson({
        url: targetUrl,
        title: rootResult.title,
        content: rootResult.markdown,
        subpagesCount: 1,
        pages: [
          {
            url: targetUrl,
            title: rootResult.title,
            content: rootResult.markdown,
          },
        ],
      });
    }

    // 2. Recursive docs crawling: find sub-links
    const subLinks = extractDocSubLinks(rootResult.markdown, targetUrl).slice(0, maxPages - 1);

    const pages: Array<{ url: string; title: string; content: string }> = [
      {
        url: targetUrl,
        title: rootResult.title,
        content: rootResult.markdown,
      },
    ];

    // Concurrently fetch sub-links in batches of 3 to avoid flooding
    const batchSize = 3;
    for (let i = 0; i < subLinks.length; i += batchSize) {
      const chunk = subLinks.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        chunk.map(async (link) => {
          const sub = await fetchCleanMarkdown(link);
          return { url: link, title: sub.title, content: sub.markdown };
        })
      );

      for (const res of results) {
        if (res.status === "fulfilled") {
          pages.push(res.value);
        }
      }
    }

    // Combine all pages into a unified, structured documentation source
    const combinedContent = pages
      .map(
        (p, idx) =>
          `# [Section ${idx + 1}: ${p.title}](${p.url})\n\n${p.content}\n\n---\n`
      )
      .join("\n");

    return corsJson({
      url: targetUrl,
      title: `${rootResult.title} (Documentation Suite)`,
      content: combinedContent,
      subpagesCount: pages.length,
      pages,
    });
  } catch (err: any) {
    return corsJson(
      { error: { message: err?.message || "Failed to fetch web content." } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");
  const crawl = searchParams.get("crawl") === "true";
  const maxPages = parseInt(searchParams.get("max_pages") || "10", 10);

  if (!rawUrl) {
    return corsJson(
      { error: { message: "Query parameter 'url' is required." } },
      { status: 400 }
    );
  }

  // Delegate to POST handler
  const dummyReq = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({
      url: rawUrl,
      crawl_subpages: crawl,
      max_pages: maxPages,
    }),
  });

  return POST(dummyReq);
}
