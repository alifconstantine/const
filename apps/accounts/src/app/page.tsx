"use client";

import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthSuccess } from "@/components/auth/auth-success";
import { AccountChooser } from "@/components/auth/account-chooser";
import { AuthBackground } from "@/components/auth/auth-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAppNameFromUrl, isNativeRedirectUrl } from "@/lib/safe-redirect";
import { Loader2 } from "lucide-react";
import { api } from "@const/backend/_generated/api";
import { useState, useEffect, useMemo, Suspense } from "react";

function getUrlContext() {
  if (typeof window === "undefined") {
    return {
      prompt: null,
      target: null,
      appName: "Const",
      isNative: false,
      isSwitchAction: false,
      needsChooser: true, // Default to true on SSR to prevent AuthSuccess from auto-redirecting prematurely
    };
  }
  const params = new URLSearchParams(window.location.search);
  const prompt = params.get("prompt");
  const target = params.get("continue") || params.get("redirect") || params.get("app");
  const appName = getAppNameFromUrl(target);
  const isNative = isNativeRedirectUrl(target);
  const isSwitchAction = params.get("action") === "switch_account";

  // Native apps (desktop/mobile) or explicit prompt parameters ALWAYS require the Account Chooser
  const needsChooser =
    isNative ||
    prompt === "select_account" ||
    prompt === "login" ||
    isSwitchAction;

  return {
    prompt,
    target,
    appName,
    isNative,
    isSwitchAction,
    needsChooser,
  };
}

function UnauthenticatedView() {
  const [hasCodeInUrl, setHasCodeInUrl] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || params.get("token");
    const target = params.get("continue") || params.get("redirect") || params.get("app");

    // If visited directly in production on accounts.const.web.id without continue target:
    // redirect to the main ecosystem portal (https://const.web.id)
    const isProduction =
      window.location.hostname === "accounts.const.web.id" ||
      (process.env.NODE_ENV === "production" && window.location.hostname !== "localhost");

    if (isProduction && !target && !code) {
      window.location.href = "https://const.web.id";
      return;
    }

    if (code) {
      setHasCodeInUrl(true);
    }
  }, []);

  if (hasCodeInUrl) {
    return (
      <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          Authenticating credentials...
        </p>
      </div>
    );
  }

  return <AuthCard />;
}

function AuthenticatedView() {
  const user = useQuery(api.auth.queries.currentUser);
  const { signOut } = useAuthActions();
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const context = useMemo(() => getUrlContext(), []);

  const handleContinue = () => {
    setHasConfirmed(true);
  };

  const handleUseAnotherAccount = async () => {
    setIsSigningOut(true);
    try {
      // 1. Invalidate server-side HTTP-only cookies
      try {
        await fetch("/api/auth/signout", { method: "POST", cache: "no-store" });
      } catch (err) {
        console.warn("Server signout error:", err);
      }

      // 2. Clear client storage
      try {
        localStorage.removeItem("const_sso_token");
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

      // 3. Invalidate Convex Auth client session
      try {
        await signOut();
      } catch (err) {
        console.warn("Convex signOut error:", err);
      }

      // 4. Clean up prompt & action URL parameters so user lands on a clean login view
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("prompt");
        url.searchParams.delete("action");
        window.history.replaceState({}, document.title, url.toString());
      }
    } finally {
      setIsSigningOut(false);
    }
  };

  // If user explicitly confirmed in the chooser, or if this request is a web SSO without chooser
  if (!context.needsChooser || hasConfirmed) {
    return <AuthSuccess user={user} forceProceed={hasConfirmed} />;
  }

  return (
    <AccountChooser
      user={user}
      targetAppName={context.appName}
      onContinue={handleContinue}
      onUseAnotherAccount={handleUseAnotherAccount}
      isContinuing={hasConfirmed}
      isSigningOut={isSigningOut}
    />
  );
}

function AccountsPageContent() {
  const [isMounted, setIsMounted] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const { signOut } = useAuthActions();

  useEffect(() => {
    setIsMounted(true);
    const params = new URLSearchParams(window.location.search);
    const shouldSwitch = params.get("action") === "switch_account";

    if (shouldSwitch) {
      setIsSwitchingAccount(true);
      const executeSwitch = async () => {
        try {
          await fetch("/api/auth/signout", { method: "POST", cache: "no-store" });
        } catch {}
        try {
          await signOut();
        } catch {}
        try {
          localStorage.removeItem("const_sso_token");
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

        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("action");
          window.history.replaceState({}, document.title, url.toString());
        }
        setIsSwitchingAccount(false);
      };

      void executeSwitch();
    }
  }, [signOut]);

  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Shared Ambient Background */}
      <AuthBackground />

      {/* Floating Theme Toggle in top-right */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle />
      </div>

      {!isMounted || isSwitchingAccount ? (
        <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
            {isSwitchingAccount ? "Preparing account selection..." : "Checking session..."}
          </p>
        </div>
      ) : (
        <>
          <AuthLoading>
            <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-foreground" />
              <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
                Checking session...
              </p>
            </div>
          </AuthLoading>

          <Unauthenticated>
            <UnauthenticatedView />
          </Unauthenticated>

          <Authenticated>
            <AuthenticatedView />
          </Authenticated>
        </>
      )}
    </main>
  );
}

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-foreground" />
        </div>
      }
    >
      <AccountsPageContent />
    </Suspense>
  );
}
