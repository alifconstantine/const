import { createGitHubOAuthHandlers } from "@/lib/github-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = createGitHubOAuthHandlers();
export const GET = (request: Request) => handler.handle(request);
