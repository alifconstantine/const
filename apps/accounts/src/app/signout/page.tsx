"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConstLogoIcon } from "@const/ui";
import { getSafeRedirectUrl, getDefaultRedirectUrl } from "@/lib/safe-redirect";
import { Loader2 } from "lucide-react";

export default function SignOutPage() {
  const { signOut } = useAuthActions();
  const [status, setStatus] = useState("Signing out of Const Platform...");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const performSignOut = async () => {
      try {
        // 1. Clear cross-subdomain SSO cookies on all potential scopes
        const expireCookie = (cookieName: string) => {
          document.cookie = `${cookieName}=; Domain=.const.web.id; Path=/; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          document.cookie = `${cookieName}=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          document.cookie = `${cookieName}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        };

        expireCookie("const_sso_token");
        expireCookie("__convexAuthJWT");

        // 2. Clear LocalStorage session tokens
        try {
          localStorage.removeItem("const_sso_token");
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith("__convexAuthJWT") || key.includes("AuthJWT") || key.includes("sso"))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch {}

        // 3. Clear SessionStorage
        try {
          sessionStorage.clear();
        } catch {}

        // 4. Invalidate Convex Auth server session
        try {
          await signOut();
        } catch (err) {
          console.warn("SignOut API warning:", err);
        }

        setStatus("Session cleared. Redirecting...");

        // 5. Redirect to destination (or accounts root login)
        const params = new URLSearchParams(window.location.search);
        const rawTarget =
          params.get("continue") ||
          params.get("redirect") ||
          params.get("app");
        const safeTarget = getSafeRedirectUrl(rawTarget, { allowRelative: true });
        const destination = safeTarget || "/";

        // Brief delay for state stabilization
        setTimeout(() => {
          window.location.href = destination;
        }, 400);
      } catch (err) {
        console.error("SignOut error:", err);
        window.location.href = "/";
      }
    };

    void performSignOut();
  }, [signOut]);

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background text-foreground select-none">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
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
