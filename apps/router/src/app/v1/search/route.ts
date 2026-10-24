import { NextRequest } from "next/server";
import { authenticate, errorResponse, json, CORS_HEADERS } from "@/lib/gateway";
import { performSearch } from "@/lib/search";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    const body = await req.json();
    return json(
      await performSearch(
        req,
        auth,
        body.query ?? body.q,
        body.mode === "deep-research",
        body.num_results ?? 5,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete("content-length");
  return POST(
    new NextRequest(req.url, {
      method: "POST",
      headers,
      signal: req.signal,
      body: JSON.stringify({
        ...Object.fromEntries(req.nextUrl.searchParams),
        num_results: Number(req.nextUrl.searchParams.get("num_results") ?? 5),
      }),
    }),
  );
}
