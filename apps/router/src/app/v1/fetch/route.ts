import { NextRequest } from "next/server";
import {
  authenticate,
  json,
  errorResponse,
  CORS_HEADERS,
  GatewayError,
} from "@/lib/gateway";
import { publicPage } from "@/lib/public-fetch";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
const text = (html: string) =>
  html
    .replace(
      /<(script|style|nav|footer|header|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    )
    .replace(
      /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_, n, c) => "\n" + "#".repeat(Number(n)) + " " + c + "\n",
    )
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
export async function POST(req: NextRequest) {
  try {
    await authenticate(req);
    const body = await req.json();
    if (typeof body.url !== "string" || body.url.length > 3000)
      throw new GatewayError("Supply a public page URL.");
    const root = new URL(
      body.url.startsWith("http") ? body.url : "https://" + body.url,
    );
    const count = body.max_pages ?? 10;
    if (!Number.isInteger(count) || count < 1 || count > 25)
      throw new GatewayError("max_pages must be between 1 and 25.");
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(30000)]);
    const html = await publicPage(root.href, signal);
    const title =
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ||
      root.hostname;
    const pages = [{ url: root.href, title, content: text(html) }];
    if (body.crawl_subpages || body.crawl) {
      const links = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].flatMap(
        (match) => {
          try {
            const u = new URL(match[1]!, root);
            return u.origin === root.origin && u.href !== root.href
              ? [u.href]
              : [];
          } catch {
            return [];
          }
        },
      );
      for (const link of [...new Set(links)].slice(0, count - 1)) {
        try {
          const page = await publicPage(link, signal);
          pages.push({
            url: link,
            title: page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || link,
            content: text(page),
          });
        } catch {
          if (signal.aborted)
            throw new GatewayError("Page crawl timed out", 504);
        }
      }
    }
    return json({
      url: root.href,
      title,
      content: pages
        .map((p) => "# " + p.title + "\n" + p.url + "\n\n" + p.content)
        .join("\n\n---\n\n"),
      subpagesCount: pages.length,
      pages,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export function GET(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete("content-length");
  return POST(
    new NextRequest(req.url, {
      method: "POST",
      headers,
      signal: req.signal,
      body: JSON.stringify({
        url: req.nextUrl.searchParams.get("url"),
        crawl: req.nextUrl.searchParams.get("crawl") === "true",
        max_pages: Number(req.nextUrl.searchParams.get("max_pages") ?? 10),
      }),
    }),
  );
}
