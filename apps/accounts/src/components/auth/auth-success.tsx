"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { ConstLogoIcon, Button, toast } from "@const/ui";
import { Loader2 } from "lucide-react";
import { getSafeRedirectUrl, getDefaultRedirectUrl } from "@/lib/safe-redirect";

interface AuthSuccessProps {
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const sso = localStorage.getItem("const_sso_token");
    if (sso) return sso;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("__convexAuthJWT") || k.includes("AuthJWT"))) {
        const val = localStorage.getItem(k);
        if (val) return val;
      }
    }
  } catch {}
  return null;
}

export function AuthSuccess({ user }: AuthSuccessProps) {
  const { signOut } = useAuthActions();
  const tokenFromHook = useAuthToken();
  const [activeToken, setActiveToken] = useState<string | null>(() => getStoredToken());
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  const isNativeScheme =
    targetUrl?.startsWith("const-auth://") ||
    targetUrl?.startsWith("const-learn://") ||
    targetUrl?.startsWith("const://");

  // Synchronize and discover token
  useEffect(() => {
    if (tokenFromHook) {
      setActiveToken(tokenFromHook);
      return;
    }
    const stored = getStoredToken();
    if (stored) {
      setActiveToken(stored);
      return;
    }
    const interval = setInterval(() => {
      const retryToken = getStoredToken();
      if (retryToken) {
        setActiveToken(retryToken);
        clearInterval(interval);
      }
    }, 150);
    const timeout = setTimeout(() => clearInterval(interval), 3000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [tokenFromHook]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Wait until token is available before initiating any redirect
    if (!activeToken) return;

    // 1. Synchronize Cross-Subdomain SSO Cookie on *.const.web.id & localhost
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === "const.web.id" || hostname.endsWith(".const.web.id")) {
      document.cookie = `const_sso_token=${encodeURIComponent(activeToken)}; Domain=.const.web.id; Path=/; SameSite=Lax; Secure; Max-Age=${30 * 24 * 60 * 60}`;
    } else if (hostname === "localhost" || hostname === "127.0.0.1") {
      document.cookie = `const_sso_token=${encodeURIComponent(activeToken)}; Path=/; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
    }

    try {
      localStorage.setItem("const_sso_token", activeToken);
    } catch {}

    // 2. Check if user explicitly requested account switching / fresh login prompt
    const params = new URLSearchParams(window.location.search);
    const shouldSwitchAccount =
      params.get("prompt") === "select_account" ||
      params.get("prompt") === "login" ||
      params.get("action") === "switch_account";

    if (shouldSwitchAccount) {
      void handleSignOut();
      return;
    }

    // 3. Resolve destination URL (with fallback to default ecosystem root)
    const rawTarget =
      params.get("continue") ||
      params.get("redirect") ||
      params.get("app");
    const safeTarget = getSafeRedirectUrl(rawTarget, { allowRelative: true });
    let destination = safeTarget || getDefaultRedirectUrl();

    // 4. Attach token payload for safe internal & native redirects
    if (safeTarget) {
      const separator = destination.includes("?") ? "&" : "?";
      destination = `${destination}${separator}token=${encodeURIComponent(activeToken)}`;
    }

    setTargetUrl(destination);

    // 5. Smooth auto-redirect after brief visual confirmation (only if not switching)
    const timer = setTimeout(() => {
      window.location.href = destination;
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeToken]);

  const handleManualProceed = () => {
    const destination = targetUrl || getDefaultRedirectUrl();
    toast.info("Redirecting...", { description: "Opening your application" });
    window.location.href = destination;
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
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

      // 3. Invalidate Convex Auth server session
      await signOut();

      // Clean prompt param if present
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.delete("prompt");
        params.delete("action");
        const newQuery = params.toString() ? `?${params.toString()}` : "";
        window.history.replaceState({}, document.title, `${window.location.pathname}${newQuery}`);
      }

      toast.info("Signed out", { description: "You can now sign in with a different account." });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-xl px-4 sm:px-6 py-12 flex flex-col items-center justify-center text-center select-none animate-in fade-in duration-500">
      {/* Branding Logo: Transparent Icon + Lora Brand Name */}
      <div className="flex items-center justify-center gap-3 mb-8 group">
        <ConstLogoIcon
          size="lg"
          className="w-10 h-10 text-foreground transition-transform duration-300 group-hover:scale-105"
        />
        <span className="font-serif font-normal tracking-tight text-foreground text-3xl sm:text-4xl">
          Const
        </span>
      </div>

      {/* Main Success Heading with Lora Serif & period cadence */}
      <h1 className="text-3xl sm:text-4xl md:text-[42px] font-serif font-normal tracking-tight text-foreground mb-3 leading-tight">
        Authenticated successfully.
      </h1>

      {/* Prominent Action Button for Native Desktop / Mobile Apps */}
      {isNativeScheme ? (
        <div className="my-6 flex flex-col items-center gap-3">
          <Button
            type="button"
            onClick={handleManualProceed}
            className="rounded-full px-8 py-3.5 text-sm font-semibold cursor-pointer h-12"
          >
            <span>Buka Aplikasi Const Learn</span>
          </Button>
          <p className="text-xs text-muted-foreground max-w-md font-light leading-relaxed">
            Membuka aplikasi desktop... Jika muncul jendela dialog peramban <em>&quot;Buka Const Learn?&quot;</em>, silakan pilih <strong>Buka / Open</strong>.
          </p>
        </div>
      ) : (
        <p className="text-sm sm:text-base text-muted-foreground font-sans font-light leading-relaxed mb-8 max-w-md">
          Redirecting you to your destination application.
        </p>
      )}

      {/* User Session Stadium Pill */}
      {user?.email && (
        <div className="mb-8 inline-flex items-center gap-3 rounded-full bg-secondary/70 border border-border/60 px-4 py-2 text-xs font-sans text-foreground transition-all">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">{user.email}</span>
          {user.role && (
            <span className="rounded-full bg-foreground text-background px-2.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider">
              {user.role}
            </span>
          )}
        </div>
      )}

      {/* Redirect Indicator & Manual Link */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground font-sans">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0066ff]" />
          <span>If redirection doesn't happen automatically,</span>
          <button
            type="button"
            onClick={handleManualProceed}
            className="text-foreground underline underline-offset-4 hover:text-[#0066ff] font-medium transition-colors cursor-pointer"
          >
            click here
          </button>
        </div>

        <div className="pt-6 flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="rounded-full text-xs font-medium border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer px-4 h-9"
          >
            {isSigningOut ? "Signing out..." : "Use another account"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="rounded-full text-xs text-muted-foreground hover:text-destructive cursor-pointer h-9 px-3"
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
