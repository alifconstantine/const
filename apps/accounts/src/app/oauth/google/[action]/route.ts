import { createGoogleOAuthHandlers } from "@/lib/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const handler = createGoogleOAuthHandlers();
export const GET = (request: Request) => handler.handle(request);
export const POST = (request: Request) => handler.handle(request);
