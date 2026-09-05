import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  jwt: {
    durationMs: 30 * 24 * 60 * 60 * 1000, // 30 days (avoids 1-hour premature expiration on web & native clients)
  },
  session: {
    totalDurationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    inactiveDurationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    Resend({
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      if (
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//") &&
        !redirectTo.startsWith("/\\")
      ) {
        return redirectTo;
      }
      try {
        if (
          redirectTo.startsWith("const-auth://") ||
          redirectTo.startsWith("const-learn://") ||
          redirectTo.startsWith("const-harness://") ||
          redirectTo.startsWith("const://")
        ) {
          return redirectTo;
        }

        const parsed = new URL(redirectTo);
        const hostname = parsed.hostname.toLowerCase();

        const isProd = process.env.CONVEX_DEPLOYMENT?.startsWith("prod:");
        if (!isProd && (hostname === "localhost" || hostname === "127.0.0.1")) {
          return redirectTo;
        }

        if (hostname === "const.web.id" || hostname.endsWith(".const.web.id")) {
          return redirectTo;
        }
      } catch {
        // Fall through to default fallback
      }
      return process.env.SITE_URL ?? "https://accounts.const.web.id";
    },
  },
});
