"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import {
  getSafeRedirectUrl,
  getDefaultRedirectUrl,
  isNativeRedirectUrl,
  getAppNameFromUrl,
} from "@/lib/safe-redirect";
import { Loader2 } from "lucide-react";

interface AuthSuccessProps {
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
  forceProceed?: boolean;
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

function isValidConvexRefreshToken(token: unknown): token is string {
  if (typeof token !== "string" || !token.trim()) return false;
  const parts = token.split("|");
  return parts.length === 2 && Boolean(parts[0]?.length) && Boolean(parts[1]?.length);
}

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const sso = localStorage.getItem("const_sso_refresh_token");
    if (isValidConvexRefreshToken(sso)) return sso;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("__convexAuthRefreshToken") || k.includes("RefreshToken"))) {
        const val = localStorage.getItem(k);
        if (isValidConvexRefreshToken(val)) return val;
      }
    }
  } catch {}
  return null;
}

export function AuthSuccess({ user: _user, forceProceed = false }: AuthSuccessProps) {
  const tokenFromHook = useAuthToken();
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [targetAppName, setTargetAppName] = useState<string>("Const");
  const hasTriggeredRedirect = useRef(false);

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

    // 1. Resolve destination URL & App Name
    const params = new URLSearchParams(window.location.search);
    const shouldSwitchAccount =
      !forceProceed &&
      (params.get("prompt") === "select_account" ||
        params.get("prompt") === "login" ||
        params.get("action") === "switch_account");

    if (shouldSwitchAccount) return;

    const rawTarget =
      params.get("continue") ||
      params.get("redirect") ||
      params.get("app");
    const safeTarget = getSafeRedirectUrl(rawTarget, { allowRelative: true });
    const isNative = isNativeRedirectUrl(safeTarget);
    const appName = getAppNameFromUrl(safeTarget);

    setTargetAppName(appName);

    // Wait until token is available before initiating any redirect
    if (!activeToken) return;

    // 2. Synchronize Cross-Subdomain SSO Cookie on *.const.web.id & localhost
    const refreshToken = getStoredRefreshToken();
    const hostname = window.location.hostname.toLowerCase();
    const maxAge = 30 * 24 * 60 * 60;
    if (hostname === "const.web.id" || hostname.endsWith(".const.web.id")) {
      document.cookie = `const_sso_token=${encodeURIComponent(activeToken)}; Domain=.const.web.id; Path=/; SameSite=Lax; Secure; Max-Age=${maxAge}`;
      if (refreshToken) {
        document.cookie = `const_sso_refresh_token=${encodeURIComponent(refreshToken)}; Domain=.const.web.id; Path=/; SameSite=Lax; Secure; Max-Age=${maxAge}`;
      }
    } else if (hostname === "localhost" || hostname === "127.0.0.1") {
      document.cookie = `const_sso_token=${encodeURIComponent(activeToken)}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
      if (refreshToken) {
        document.cookie = `const_sso_refresh_token=${encodeURIComponent(refreshToken)}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
      }
    }

    try {
      localStorage.setItem("const_sso_token", activeToken);
      if (refreshToken) {
        localStorage.setItem("const_sso_refresh_token", refreshToken);
      }
    } catch {}

    // 3. Construct final destination with token & optional refreshToken & state
    let destination = safeTarget || getDefaultRedirectUrl();
    if (safeTarget) {
      const separator = destination.includes("?") ? "&" : "?";
      let authParams = `token=${encodeURIComponent(activeToken)}`;
      if (refreshToken) {
        authParams += `&refreshToken=${encodeURIComponent(refreshToken)}`;
      }
      const state = params.get("state");
      if (state) {
        authParams += `&state=${encodeURIComponent(state)}`;
      }
      destination = `${destination}${separator}${authParams}`;
    }

    // 4. Perform Redirect based on Target Type
    if (hasTriggeredRedirect.current) return;
    hasTriggeredRedirect.current = true;

    if (!isNative) {
      // WEB APP FLOW (e.g. apps/router, web portals):
      // Instant redirect via replaceState/location.replace without delays or intermediate screens
      window.location.replace(destination);
    } else {
      // NATIVE APP FLOW (e.g. apps/learn desktop/mobile, apps/harness):
      // 1. Attempt background notify to local loopback server (for Linux & friction-free auth)
      const port = params.get("port") || "24125";
      const state = params.get("state") || "";
      const stateParam = state ? `&state=${encodeURIComponent(state)}` : "";

      if (destination.includes("const-harness") || appName.toLowerCase().includes("harness")) {
        try {
          fetch(`http://127.0.0.1:${port}/callback?token=${encodeURIComponent(activeToken)}${stateParam}`, {
            mode: "no-cors",
          }).catch(() => {});
        } catch {}
      }

      // 2. Invoke native deep-link protocol handler once
      window.location.href = destination;
      // 3. Transition browser tab to dedicated clean /auth-success page (Antigravity style)
      const appCode = appName.toLowerCase().includes("learn")
        ? "learn"
        : appName.toLowerCase().includes("harness")
        ? "harness"
        : "app";
      let successUrl = `/auth-success?app=${appCode}`;
      if (params.get("port")) successUrl += `&port=${encodeURIComponent(port)}`;
      if (state) successUrl += `&state=${encodeURIComponent(state)}`;

      setTimeout(() => {
        window.location.replace(successUrl);
      }, 250);
    }
  }, [activeToken]);

  return (
    <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-muted-foreground animate-in fade-in duration-200">
      <Loader2 className="h-6 w-6 animate-spin text-foreground" />
      <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
        Redirecting to {targetAppName}...
      </p>
    </div>
  );
}
