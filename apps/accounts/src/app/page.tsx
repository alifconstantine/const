"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "convex/react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthSuccess } from "@/components/auth/auth-success";
import { AuthBackground } from "@/components/auth/auth-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2 } from "lucide-react";
import { api } from "@const/backend/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "@const/ui";

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
  return <AuthSuccess user={user} />;
}

export default function AccountsPage() {
  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Shared Ambient Background */}
      <AuthBackground />

      {/* Floating Theme Toggle in top-right */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle />
      </div>

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
    </main>
  );
}
