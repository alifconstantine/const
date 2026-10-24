"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConstLogoIcon } from "@const/ui";
import { getSafeRedirectUrl, getDefaultRedirectUrl, isNativeRedirectUrl } from "@/lib/safe-redirect";
import { AuthBackground } from "@/components/auth/auth-background";
import { Loader2 } from "lucide-react";

export default function SignOutPage() {
  const { signOut } = useAuthActions();
  const [status, setStatus] = useState("Signing out of Const Platform...");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const performSignOut = async () => {
      try {
        // 1. Call server-side API to expire HTTP-only cookies via Set-Cookie headers
        try {
          await fetch("/api/auth/signout", {
            method: "POST",
            cache: "no-store",
          });
        } catch (apiErr) {
          console.warn("Server signout API warning:", apiErr);
        }

        // 2. Clear cross-subdomain and local cookies on client scope
        const expireCookie = (cookieName: string) => {
          document.cookie = `${cookieName}=; Domain=.const.web.id; Path=/; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          document.cookie = `${cookieName}=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          document.cookie = `${cookieName}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        };

        expireCookie("const_sso_token");
        expireCookie("const_sso_refresh_token");
        expireCookie("__convexAuthJWT");
        expireCookie("__Host-__convexAuthJWT");
        expireCookie("__convexAuthRefreshToken");
        expireCookie("__Host-__convexAuthRefreshToken");

        // 3. Clear LocalStorage session tokens across all namespaces
        try {
          localStorage.removeItem("const_sso_token");
          localStorage.removeItem("const_sso_refresh_token");
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (
              key &&
              (key.includes("convex") ||
                key.includes("AuthJWT") ||
                key.includes("sso") ||
                key.includes("token"))
            ) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch {}

        // 4. Clear SessionStorage
        try {
          sessionStorage.clear();
        } catch {}

        // 5. Invalidate Convex Auth client session
        try {
          await signOut();
        } catch (err) {
          console.warn("Convex signOut warning:", err);
        }

        setStatus("Session cleared. Redirecting...");

        // 6. Redirect to destination (or accounts root login)
        const params = new URLSearchParams(window.location.search);
        const redirectParam = params.get("redirect");
        const continueParam =
          params.get("continue") ||
          params.get("app");

        let destination = "/";
        if (redirectParam) {
          const safeRedirect = getSafeRedirectUrl(redirectParam, { allowRelative: true });
          if (safeRedirect) destination = safeRedirect;
        } else if (continueParam) {
          const safeContinue = getSafeRedirectUrl(continueParam, { allowRelative: true });
          if (safeContinue) {
            if (isNativeRedirectUrl(safeContinue)) {
              destination = `/?continue=${encodeURIComponent(safeContinue)}`;
            } else {
              destination = safeContinue;
            }
          }
        }

        // Brief delay for state stabilization
        setTimeout(() => {
          window.location.href = destination;
        }, 300);
      } catch (err) {
        console.error("SignOut error:", err);
        window.location.href = "/";
      }
    };

    void performSignOut();
  }, [signOut]);

  return (
    <main className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 bg-background text-foreground select-none overflow-hidden transition-colors duration-300">
      <AuthBackground />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="relative mb-2">
          <ConstLogoIcon size="lg" className="w-12 h-12 text-foreground animate-pulse" />
        </div>

        <h1 className="text-2xl font-serif font-normal tracking-tight text-foreground">
          Signing out.
        </h1>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0066ff]" />
          <span>{status}</span>
        </div>
      </div>
    </main>
  );
}
