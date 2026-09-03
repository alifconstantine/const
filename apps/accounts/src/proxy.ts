import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const middleware = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Next.js 16 proxy request handler
});

export const proxy = middleware;
export default middleware;

export const config = {
  // The following matcher runs on all routes except static assets
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
