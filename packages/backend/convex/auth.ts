import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Resend({
      from: process.env.AUTH_EMAIL_FROM ?? "Const <onboarding@resend.dev>",
    }),
  ],
});
