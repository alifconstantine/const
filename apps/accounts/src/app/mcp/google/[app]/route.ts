import { createGoogleMcpHandler } from "@/lib/google-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const handler = createGoogleMcpHandler();
type Context = { params: Promise<{ app: string }> };
export async function POST(request: Request, context: Context) {
  return handler(request, (await context.params).app);
}
export const GET = POST;
export const DELETE = POST;
