import { createGitHubOAuthHandlers } from "@/lib/github-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = createGitHubOAuthHandlers();
export const POST = (request: Request) => handler.handle(request);
