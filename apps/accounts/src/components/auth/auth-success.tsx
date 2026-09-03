"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { ConstLogoIcon, toast } from "@const/ui";
import { getSafeRedirectUrl, getDefaultRedirectUrl } from "@/lib/safe-redirect";

interface AuthSuccessProps {
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
}

export function AuthSuccess({ user }: AuthSuccessProps) {
  const { signOut } = useAuthActions();
  const token = useAuthToken();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Synchronize Cross-Subdomain SSO Cookie on *.const.web.id
    if (token) {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname === "const.web.id" || hostname.endsWith(".const.web.id")) {
        // Shared 30-day cross-subdomain SSO session cookie
        document.cookie = `const_sso_token=${encodeURIComponent(token)}; Domain=.const.web.id; Path=/; SameSite=Lax; Secure; Max-Age=${30 * 24 * 60 * 60}`;
      }
    }

    // 2. Resolve destination URL (with fallback to default ecosystem root)
    const params = new URLSearchParams(window.location.search);
    const rawTarget =
      params.get("continue") ||
      params.get("redirect") ||
      params.get("app");
    const safeTarget = getSafeRedirectUrl(rawTarget, { allowRelative: true });
    let destination = safeTarget || getDefaultRedirectUrl();

    // 3. For native desktop/mobile deep links (const-auth:// or const-learn://), attach token payload
    const isNativeScheme =
      destination.startsWith("const-auth://") ||
      destination.startsWith("const-learn://") ||
      destination.startsWith("const://");

    if (isNativeScheme && token) {
      const separator = destination.includes("?") ? "&" : "?";
      destination = `${destination}${separator}token=${encodeURIComponent(token)}`;
    }

    setTargetUrl(destination);

    // 4. Smooth auto-redirect after brief visual confirmation
    const timer = setTimeout(() => {
      window.location.href = destination;
    }, 1200);

    return () => clearTimeout(timer);
  }, [token]);

  const handleManualProceed = () => {
    const destination = targetUrl || getDefaultRedirectUrl();
    toast.info("Redirecting...", { description: "Opening your application" });
    window.location.href = destination;
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Clear cross-subdomain SSO cookie
      if (typeof document !== "undefined") {
        document.cookie = "const_sso_token=; Domain=.const.web.id; Path=/; SameSite=Lax; Secure; Max-Age=0";
      }
      await signOut();
      toast.info("Signed out", { description: "You have been safely signed out." });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-4xl px-4 sm:px-6 py-12 flex flex-col items-center justify-center text-center select-none animate-in fade-in duration-500">
      {/* Branding Logo: Transparent Icon + Brand Name */}
      <div className="flex items-center justify-center gap-3 mb-8 group">
        <ConstLogoIcon
          size="lg"
          className="w-9 h-9 sm:w-10 sm:h-10 text-foreground transition-transform duration-300 group-hover:scale-105"
        />
        <span className="font-serif font-normal tracking-tight text-foreground text-3xl sm:text-4xl">
          Const
        </span>
      </div>

      {/* Main Success Heading in a single line */}
      <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-serif font-normal tracking-tight text-foreground mb-4 leading-tight whitespace-nowrap">
        You have successfully authenticated.
      </h1>

      {/* Subtitle with redirect helper */}
      <p className="text-sm sm:text-base text-muted-foreground font-sans leading-relaxed mb-10 max-w-xl">
        You should be redirected back to the product.{" "}
        <button
          type="button"
          onClick={handleManualProceed}
          className="text-primary underline underline-offset-4 hover:text-foreground font-medium transition-colors cursor-pointer"
        >
          Click here
        </button>{" "}
        if not working.
      </p>

      {/* Minimalist Footer */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground font-sans pt-4 border-t border-border/20">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </div>

      {/* Subtle Account Indicator with role badge */}
      {user?.email && (
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60 font-mono">
          <span>Signed in as {user.email}</span>
          {user.role && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-semibold text-muted-foreground">
              {user.role}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
