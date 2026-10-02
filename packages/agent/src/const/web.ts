export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

export interface WebSearchResult {
  query: string;
  provider: "exa" | "duckduckgo";
  sources: WebSearchSource[];
  formatted: string;
}

export interface WebFetchResult {
  url: string;
  title: string;
  contentType: string;
  content: string;
  formatted: string;
  truncated: boolean;
}

/**
 * Searches the web using Exa AI if EXA_API_KEY is available, or DuckDuckGo fallback.
 */
export async function executeWebSearch(
  query: string,
  numResults: number = 5,
  signal?: AbortSignal
): Promise<WebSearchResult> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new Error("Search query cannot be empty.");
  }

  const exaKey = process.env.EXA_API_KEY || process.env.VITE_EXA_API_KEY || "";

  // 1. Try Exa Search if key is present
  if (exaKey) {
    try {
      const resp = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": exaKey,
          "Content-Type": "application/json",
          "User-Agent": "const-harness/0.1.0",
        },
        body: JSON.stringify({
          query: cleanQuery,
          type: "auto",
          numResults: Math.min(Math.max(numResults, 1), 20),
          contents: {
            highlights: {
              numSentences: 2,
              highlightsPerUrl: 1,
            },
          },
        }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as any;
        const sources: WebSearchSource[] = (data.results || []).map((r: any) => ({
          title: r.title || r.url,
          url: r.url,
          snippet: (r.highlights && r.highlights[0]) || r.text || "",
          publishedAt: r.publishedDate,
        }));

        const formatted = formatSearchResults(cleanQuery, "exa", sources);
        return {
          query: cleanQuery,
          provider: "exa",
          sources,
          formatted,
        };
      }
    } catch {
      // Fall through to public search fallback
    }
  }

  // 2. DuckDuckGo public HTML search fallback
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const resp = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      throw new Error(`Public search returned status ${resp.status}`);
    }

    const html = await resp.text();
    const sources = parseDuckDuckGoHtml(html, numResults);
    const formatted = formatSearchResults(cleanQuery, "duckduckgo", sources);

    return {
      query: cleanQuery,
      provider: "duckduckgo",
      sources,
      formatted,
    };
  } catch (err: any) {
    throw new Error(`Web search failed: ${err.message}`);
  }
}

function parseDuckDuckGoHtml(html: string, limit: number): WebSearchSource[] {
  const sources: WebSearchSource[] = [];
  const titleRegex = /<a[^>]*class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class=["']result__snippet["'][^>]*>([\s\S]*?)<\/a>/gi;

  const rawTitles: Array<{ url: string; title: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = titleRegex.exec(html)) !== null && rawTitles.length < limit) {
    let url = m[1];
    if (url.includes("uddg=")) {
      const match = url.match(/uddg=([^&]+)/);
      if (match) url = decodeURIComponent(match[1]);
    }
    const title = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, "").trim());
    rawTitles.push({ url, title });
  }

  const rawSnippets: string[] = [];
  while ((m = snippetRegex.exec(html)) !== null && rawSnippets.length < limit) {
    rawSnippets.push(decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "").trim()));
  }

  for (let i = 0; i < rawTitles.length; i++) {
    sources.push({
      title: rawTitles[i].title,
      url: rawTitles[i].url,
      snippet: rawSnippets[i] || "",
    });
  }

  return sources;
}

function formatSearchResults(
  query: string,
  provider: string,
  sources: WebSearchSource[]
): string {
  if (sources.length === 0) {
    return `[web_search (${provider})] No results found for: "${query}".`;
  }

  const items = sources.map((s, idx) => {
    return `${idx + 1}. **${s.title}**\n   URL: ${s.url}\n   ${s.snippet ? `Snippet: ${s.snippet}` : ""}`;
  });

  return `[web_search (${provider})] Found ${sources.length} results for: "${query}"\n\n${items.join("\n\n")}`;
}

/**
 * Fetches web content from a URL and converts HTML to clean readable Markdown.
 */
export async function executeWebFetch(
  rawUrl: string,
  maxChars: number = 30000,
  signal?: AbortSignal
): Promise<WebFetchResult> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      throw new Error(`HTTP error ${resp.status} (${resp.statusText})`);
    }

    const contentType = resp.headers.get("content-type") || "text/html";
    const bodyText = await resp.text();

    if (contentType.includes("application/json")) {
      const truncated = bodyText.length > maxChars;
      const content = truncated ? bodyText.slice(0, maxChars) + "\n\n[...Truncated...]" : bodyText;
      return {
        url,
        title: url,
        contentType,
        content,
        formatted: `[web_fetch: JSON Content (${url})]\n\`\`\`json\n${content}\n\`\`\``,
        truncated,
      };
    }

    if (!contentType.includes("text/html")) {
      const truncated = bodyText.length > maxChars;
      const content = truncated ? bodyText.slice(0, maxChars) + "\n\n[...Truncated...]" : bodyText;
      return {
        url,
        title: url,
        contentType,
        content,
        formatted: `[web_fetch: ${url}]\n${content}`,
        truncated,
      };
    }

    // Parse HTML to Markdown
    const titleMatch = bodyText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : url;

    const markdown = convertHtmlToMarkdown(bodyText);
    const truncated = markdown.length > maxChars;
    const finalContent = truncated ? markdown.slice(0, maxChars) + "\n\n[... Content truncated ...]" : markdown;

    return {
      url,
      title,
      contentType,
      content: finalContent,
      formatted: `[web_fetch: ${title} (${url})]\n\n${finalContent}`,
      truncated,
    };
  } catch (err: any) {
    throw new Error(`Failed to fetch URL (${url}): ${err.message}`);
  }
}

/**
 * Clean, robust HTML to Markdown converter
 */
export function convertHtmlToMarkdown(html: string): string {
  // 1. Strip comments, scripts, styles, iframes, svgs, header, footer, nav
  let clean = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<(header|footer|nav)[\s\S]*?<\/\1>/gi, "");

  // 2. Headings
  clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
  clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
  clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
  clean = clean.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n");
  clean = clean.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n");
  clean = clean.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n");

  // 3. Code blocks & inline code
  clean = clean.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n\n```\n$1\n```\n\n");
  clean = clean.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // 4. Links & Images
  clean = clean.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  clean = clean.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, "![$1]($2)");

  // 5. Text styling
  clean = clean.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  clean = clean.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

  // 6. Lists
  clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
  clean = clean.replace(/<\/(ul|ol)>/gi, "\n");

  // 7. Paragraphs, breaks, table rows
  clean = clean.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, "\n| $1 |");
  clean = clean.replace(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi, " $2 |");
  clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n");
  clean = clean.replace(/<br\s*[\/]?>/gi, "\n");
  clean = clean.replace(/<hr\s*[\/]?>/gi, "\n\n---\n\n");

  // 8. Strip remaining tags
  clean = clean.replace(/<[^>]+>/g, "");

  // 9. Decode HTML entities and clean extra whitespace
  clean = decodeHtmlEntities(clean);
  clean = clean.replace(/[ \t]+/g, " ");
  clean = clean.replace(/\n\s*\n\s*\n+/g, "\n\n");

  return clean.trim();
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
