"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { Input } from "@const/ui/components/ui/input";
import { Label } from "@const/ui/components/ui/label";
import { Button } from "@const/ui/components/ui/button";
import { ConstLogoIcon, toast } from "@const/ui";
import {
  Mail,
  ArrowLeft,
  Loader2,
  AlertCircle,
  MailCheck,
  Clock,
} from "lucide-react";
import { getSafeRedirectUrl, getDefaultRedirectUrl } from "@/lib/safe-redirect";

export function AuthCard() {
  const { signIn } = useAuthActions();
  const consumeRateLimit = useMutation(api.shared.rateLimits.checkAndConsumeRateLimit);

  // View state: 'main' | 'email' | 'emailSent'
  const [viewState, setViewState] = useState<"main" | "email" | "emailSent">("main");

  // Form states
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continueUrl, setContinueUrl] = useState<string>(() => getDefaultRedirectUrl());

  // Rate-limiting cooldown timer for Resend button (60s)
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Read continue parameter safely from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const rawTarget =
      params.get("continue") ||
      params.get("redirect") ||
      params.get("app");
    const safeTarget = getSafeRedirectUrl(rawTarget, { allowRelative: true });
    setContinueUrl(safeTarget || getDefaultRedirectUrl());
  }, []);

  // Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const returnUrl =
        typeof window !== "undefined"
          ? (window.location.search.includes("continue=")
              ? window.location.href
              : `${window.location.origin}${window.location.pathname}?continue=${encodeURIComponent(continueUrl)}`)
          : continueUrl;
      await signIn("google", { redirectTo: returnUrl });
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "Failed to sign in with Google. Please try again.";
      setError(msg);
      toast.error("Google Sign-In failed", {
        description: msg,
      });
      setIsLoading(false);
    }
  };

  // Resend Magic Link Submit with Backend Rate Limiting & Sonner Toasts
  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      toast.error("Email required", {
        description: "Please enter your email address to receive a magic sign-in link.",
      });
      return;
    }

    if (resendCooldown > 0) {
      toast.info("Please wait", {
        description: `You can request another link in ${resendCooldown} seconds.`,
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Check & consume rate limit (Hardened server-side rule: Max 3 attempts per 10 minutes)
      const rateLimitCheck = await consumeRateLimit({
        key: `magic_link:${email.toLowerCase().trim()}`,
      });

      if (!rateLimitCheck.allowed) {
        setError(rateLimitCheck.message);
        toast.warning("Rate limit reached", {
          description: rateLimitCheck.message,
          duration: 7000,
        });
        setIsLoading(false);
        return;
      }

      // 2. Perform magic link request
      const returnUrl =
        typeof window !== "undefined"
          ? (window.location.search.includes("continue=")
              ? window.location.href
              : `${window.location.origin}${window.location.pathname}?continue=${encodeURIComponent(continueUrl)}`)
          : continueUrl;

      await signIn("resend", {
        email,
        redirectTo: returnUrl,
      });

      // 3. Trigger Sonner success notification
      toast.success("Magic link sent!", {
        description: `We've sent a sign-in link to ${email}`,
        duration: 5000,
      });

      // 4. Initiate 60-second cooldown on the resend button
      setResendCooldown(60);
      setViewState("emailSent");
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "Failed to send magic link. Please verify your email address.";
      setError(msg);
      toast.error("Failed to send link", {
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-[440px] sm:max-w-[460px] rounded-[32px] bg-card/90 dark:bg-[#141414]/90 backdrop-blur-xl border border-border/70 p-8 sm:p-10 shadow-none my-auto text-card-foreground transition-all animate-in fade-in duration-500">
      {/* VIEW 1: Main Auth View */}
      {viewState === "main" && (
        <div>
          {/* Logo & Lora Serif Heading */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-5 inline-flex items-center justify-center transition-transform duration-300 hover:scale-105">
              <ConstLogoIcon size="xl" className="w-12 h-12 text-foreground" />
            </div>

            <h1 className="text-3xl sm:text-[34px] font-serif font-normal tracking-tight text-foreground">
              Welcome to Const.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground font-sans font-light">
              One central account for the entire Const ecosystem.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs sm:text-sm text-destructive font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Stadium Pill Buttons Stack */}
          <div className="space-y-3 sm:space-y-3.5 font-sans">
            <Button
              type="button"
              variant="default"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-12 rounded-full font-medium text-sm flex items-center justify-center gap-3 transition-all cursor-pointer"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>

            <div className="relative my-6 flex items-center justify-center">
              <div className="w-full border-t border-border/50" />
              <span className="absolute bg-card px-3 text-[11px] font-medium tracking-widest uppercase text-muted-foreground/60 font-sans">
                or
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError(null);
                setViewState("email");
              }}
              className="w-full h-12 rounded-full border-border/70 font-medium text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Mail className="h-4 w-4 text-foreground/80 stroke-[1.8]" />
              <span>Continue with Email</span>
            </Button>
          </div>
        </div>
      )}

      {/* VIEW 2: Email Magic Link Input Form */}
      {viewState === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-5">
          <div className="flex items-center justify-between mb-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                setViewState("main");
              }}
              className="rounded-full gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Button>
          </div>

          <div className="text-center mb-6">
            <div className="mb-4 inline-flex items-center justify-center">
              <Mail className="h-10 w-10 text-foreground stroke-[1.5]" />
            </div>

            <h2 className="text-3xl sm:text-[32px] font-serif font-normal tracking-tight text-foreground">
              Continue with email.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground font-sans font-light">
              Enter your email to receive a passwordless magic link.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs sm:text-sm text-destructive font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="space-y-2 text-left font-sans">
            <div className="flex items-center justify-between px-1">
              <Label htmlFor="email" className="text-xs text-foreground font-medium">
                Email address
              </Label>
              <span className="text-[11px] text-muted-foreground/60 font-mono">
                Max 3 / 10m
              </span>
            </div>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="h-12 rounded-full px-5 bg-muted/60 border-transparent text-sm placeholder:text-muted-foreground/60 focus-visible:bg-background focus-visible:border-border font-sans"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || !email}
            className="w-full h-12 rounded-full font-medium text-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send Magic Link"
            )}
          </Button>
        </form>
      )}

      {/* VIEW 3: Post-Send Magic Link Layout */}
      {viewState === "emailSent" && (
        <div className="text-center py-2">
          {/* 30% Squircle Icon Frame */}
          <div className="mb-5 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-secondary/80 border border-border/50 text-foreground">
            <MailCheck className="h-6 w-6 stroke-[1.75]" />
          </div>

          <h2 className="text-3xl sm:text-[34px] font-serif font-normal tracking-tight text-foreground">
            Check your inbox.
          </h2>

          <div className="space-y-2 mt-3 font-sans">
            <p className="text-sm text-muted-foreground font-light leading-relaxed">
              We sent a temporary sign-in link to{" "}
              <span className="font-medium text-foreground underline underline-offset-4 decoration-muted-foreground/40">
                {email}
              </span>
            </p>

            <p className="text-xs text-muted-foreground/80 leading-normal max-w-xs mx-auto pt-1">
              Click the link in the email to log in automatically.
            </p>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive font-sans text-left">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="mt-8 space-y-3 font-sans">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleEmailSubmit()}
              disabled={isLoading || resendCooldown > 0}
              className="w-full h-12 rounded-full text-sm font-medium border-border/70 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : resendCooldown > 0 ? (
                <>
                  <Clock className="h-4 w-4 opacity-70" />
                  <span>Resend magic link ({resendCooldown}s)</span>
                </>
              ) : (
                "Resend magic link"
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setError(null);
                setViewState("main");
              }}
              className="w-full h-10 rounded-full text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Back to sign in
            </Button>

            <p className="text-[11px] text-muted-foreground/60 font-mono text-center pt-1">
              Rate limit: max 3 requests per 10 minutes
            </p>
          </div>
        </div>
      )}

      {/* Footer Legal inside card */}
      <div className="mt-8 pt-2 text-center text-xs text-muted-foreground leading-relaxed font-sans">
        By logging in, you agree to our{" "}
        <a href="#" className="underline hover:text-foreground">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline hover:text-foreground">
          Privacy Policy
        </a>
        .
        <div className="mt-2 text-muted-foreground/70 text-[11px]">
          copyright © 2026 Const Platform
        </div>
      </div>
    </div>
  );
}
