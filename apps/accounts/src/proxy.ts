import {
  convexAuthNextjsMiddleware,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

const middleware = convexAuthNextjsMiddleware(async (request) => {
  const url = request.nextUrl;
  const continueParam =
    url.searchParams.get("continue") ||
    url.searchParams.get("redirect") ||
    url.searchParams.get("app");
  const codeParam =
    url.searchParams.get("code") ||
    url.searchParams.get("token");

  const isProduction =
    process.env.NODE_ENV === "production" ||
    url.hostname === "accounts.const.web.id";

  // If visited directly on production without an authorized app continue target or magic link code:
  // immediately redirect to the main ecosystem portal (https://const.web.id)
  if (isProduction && !continueParam && !codeParam && url.pathname === "/") {
    return NextResponse.redirect(new URL("https://const.web.id"));
  }
});

export const proxy = middleware;
export default middleware;

export const config = {
  // The following matcher runs on all routes except static assets
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
