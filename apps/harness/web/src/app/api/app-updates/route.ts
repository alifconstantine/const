import { updateFeed, updateCors } from "@/lib/app-updates";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return updateFeed(request, { token: process.env.HARNESS_RELEASES_TOKEN });
}
export function OPTIONS() { return new Response(null, { status: 204, headers: updateCors }); }
