"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { ConstLogoIcon } from "@const/ui";
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

export function AuthSuccess({ user: _user }: AuthSuccessProps) {
  const { signOut } = useAuthActions();
  const tokenFromHook = useAuthToken();
  const [activeToken, setActiveToken] = useState<string | null>(() => getStoredToken());
  const [_targetUrl, setTargetUrl] = useState<string | null>(null);

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


  const handleSignOut = async () => {
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
      setActiveToken(null);
      await signOut();

      // Clean prompt param if present
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.delete("prompt");
        params.delete("action");
        const newQuery = params.toString() ? `?${params.toString()}` : "";
        window.history.replaceState({}, document.title, `${window.location.pathname}${newQuery}`);
      }
    } catch {}
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
      <h1 className="text-3xl sm:text-4xl md:text-[42px] font-serif font-normal tracking-tight text-foreground leading-tight">
        Authenticated successfully.
      </h1>
    </div>
  );
}
