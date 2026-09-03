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
  const { signIn } = useAuthActions();
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || params.get("token");
    if (code) {
      setIsVerifyingCode(true);
      void signIn("resend" as any, { code } as any)
        .then(() => {
          toast.success("Authentication successful!", {
            description: "Redirecting to your application...",
          });
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        })
        .catch((err) => {
          console.error("Code verification error:", err);
          toast.error("Sign-in link expired or invalid", {
            description: "Please request a new magic sign-in link.",
          });
          setIsVerifyingCode(false);
        });
    }
  }, [signIn]);

  if (isVerifyingCode) {
    return (
      <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
        <p className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
          Authenticating magic link...
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
