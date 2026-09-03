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
      await signIn("google", { redirectTo: continueUrl });
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
      await signIn("resend", {
        email,
        redirectTo: continueUrl,
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
    <div className="relative z-10 w-full max-w-[440px] sm:max-w-[460px] rounded-[32px] bg-background/80 dark:bg-[#141413]/85 backdrop-blur-xl border border-border/40 dark:border-white/10 p-8 sm:p-10 shadow-2xl my-auto text-card-foreground transition-all animate-in fade-in duration-500">
      {/* VIEW 1: Main Auth View */}
      {viewState === "main" && (
        <div>
          {/* Transparent Logo & Serif Heading */}
          <div className="flex flex-col items-center text-center mb-8">
            {/* Logo with 100% transparent background, no box */}
            <div className="mb-5 inline-flex items-center justify-center transition-transform duration-300 hover:scale-105">
              <ConstLogoIcon size="xl" className="w-12 h-12 text-foreground" />
            </div>

            {/* Title with Serif font matching const-ai */}
            <h1 className="text-3xl sm:text-[34px] font-serif font-normal tracking-tight text-foreground">
              Welcome to Const
            </h1>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground font-sans">
              Unlock all features by logging in
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs sm:text-sm text-destructive font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Buttons Stack */}
          <div className="space-y-3.5 sm:space-y-4 font-sans">
            {/* Primary Google Button */}
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-12 sm:h-[52px] rounded-xl sm:rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-medium text-sm sm:text-base flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
            >
              {/* Official Google G Icon */}
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
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

            {/* Divider with generous spacing and airy breathing room */}
            <div className="relative my-7 sm:my-8 flex items-center justify-center">
              <div className="w-full border-t border-border/40" />
              <span className="absolute bg-background/95 dark:bg-[#141413]/95 px-4 text-[11px] font-medium tracking-widest uppercase text-muted-foreground/60 font-sans">
                or
              </span>
            </div>

            {/* Continue with Email */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError(null);
                setViewState("email");
              }}
              className="w-full h-12 sm:h-[52px] rounded-xl sm:rounded-2xl border-border/70 bg-secondary/50 hover:bg-secondary/80 text-foreground font-medium text-sm sm:text-base flex items-center justify-center gap-3 transition-all active:scale-[0.99]"
            >
              <Mail className="h-5 w-5 text-foreground/80 stroke-[1.8]" />
              <span>Continue with Email</span>
            </Button>
          </div>
        </div>
      )}

      {/* VIEW 2: Email Magic Link Input Form */}
      {viewState === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-5">
          {/* Header with Back Button */}
          <div className="flex items-center justify-between mb-1">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setViewState("main");
              }}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors font-sans cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          </div>

          <div className="text-center mb-6">
            {/* Transparent mail icon without box */}
            <div className="mb-4 inline-flex items-center justify-center">
              <Mail className="h-10 w-10 text-foreground stroke-[1.5]" />
            </div>

            <h2 className="text-3xl sm:text-[32px] font-serif font-normal tracking-tight text-foreground">
              Continue with Email
            </h2>
            <p className="mt-2 text-sm text-muted-foreground font-sans">
              Enter your email address to receive a magic sign-in link
            </p>
          </div>

          {/* Error Alert (e.g. Rate limit notification) */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs sm:text-sm text-destructive font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div className="space-y-2 text-left font-sans">
            <div className="flex items-center justify-between">
              <Label htmlFor="email" className="text-xs sm:text-sm text-foreground font-medium">
                Email Address
              </Label>
              <span className="text-[11px] text-muted-foreground/60 font-mono">
                Max 3 / 10m
              </span>
            </div>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="pl-11 h-12 sm:h-[52px] rounded-xl sm:rounded-2xl bg-background border-border text-foreground text-sm sm:text-base placeholder:text-muted-foreground/60 focus-visible:ring-primary font-sans"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !email}
            className="w-full h-12 sm:h-[52px] rounded-xl sm:rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm sm:text-base active:scale-[0.99] transition-all disabled:opacity-50 font-sans cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Send Magic Link"
            )}
          </Button>
        </form>
      )}

      {/* VIEW 3: Minimalist Post-Send Magic Link Layout with Cooldown */}
      {viewState === "emailSent" && (
        <div className="text-center py-2">
          {/* Transparent Icon without box */}
          <div className="mb-5 inline-flex items-center justify-center">
            <MailCheck className="h-12 w-12 text-foreground stroke-[1.5]" />
          </div>

          {/* Heading in Serif */}
          <h2 className="text-3xl sm:text-[34px] font-serif font-normal tracking-tight text-foreground">
            Check your inbox
          </h2>

          <div className="space-y-2 mt-3 font-sans">
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              We sent a temporary sign-in link to{" "}
              <span className="font-semibold text-foreground underline underline-offset-4 decoration-muted-foreground/30">
                {email}
              </span>
            </p>

            <p className="text-xs sm:text-sm text-muted-foreground/80 leading-normal max-w-xs mx-auto pt-1">
              Click the link in the email to log in automatically.
            </p>
          </div>

          {/* Error Alert (if resend hits rate limit) */}
          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive font-sans text-left">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Action Buttons with Cooldown Timer */}
          <div className="mt-8 space-y-3 font-sans">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleEmailSubmit()}
              disabled={isLoading || resendCooldown > 0}
              className="w-full h-12 sm:h-[50px] rounded-xl sm:rounded-2xl border-border/70 text-sm font-medium hover:bg-secondary/80 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
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
              className="w-full h-11 text-xs sm:text-sm text-muted-foreground hover:text-foreground font-normal cursor-pointer"
            >
              Back to sign in
            </Button>

            {/* Rate limit transparency note */}
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
