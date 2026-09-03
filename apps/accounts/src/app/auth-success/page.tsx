"use client";

import { useSearchParams } from "next/navigation";
import { ConstLogoIcon } from "@const/ui";
import { AuthBackground } from "@/components/auth/auth-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { Suspense } from "react";

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const appParam = searchParams.get("app")?.toLowerCase();

  const appName =
    appParam === "learn"
      ? "Const Learn"
      : appParam === "router"
      ? "Const Router"
      : "the application";

  return (
    <div className="relative z-10 w-full max-w-lg sm:max-w-xl px-6 py-12 flex flex-col items-center justify-center text-center select-none animate-in fade-in duration-500">
      {/* Const Branding */}
      <div className="flex items-center justify-center gap-3 mb-8 group">
        <ConstLogoIcon
          size="lg"
          className="w-10 h-10 text-foreground transition-transform duration-300 group-hover:scale-105"
        />
        <span className="font-serif font-normal tracking-tight text-foreground text-3xl sm:text-4xl">
          Const
        </span>
      </div>

      {/* Heading: Single line on desktop/tablet (sm:whitespace-nowrap), wraps gracefully on mobile */}
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground leading-tight whitespace-normal sm:whitespace-nowrap">
        Authenticated successfully.
      </h1>

      {/* Minimalist Subtitle without identity leakage */}
      <p className="mt-3 text-sm text-muted-foreground font-sans font-light max-w-sm sm:max-w-md leading-relaxed">
        You may now close this tab and return to {appName}.
      </p>

      {/* Verified Status Indicator */}
      <div className="mt-8 flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
        <span>Session verified</span>
      </div>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Ambient Canvas Background */}
      <AuthBackground />

      {/* Floating Theme Toggle in top-right */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle />
      </div>

      <Suspense fallback={null}>
        <AuthSuccessContent />
      </Suspense>
    </main>
  );
}
