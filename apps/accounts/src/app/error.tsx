"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ConstLogoIcon } from "@const/ui";
import { Button } from "@const/ui/components/ui/button";
import { AuthBackground } from "@/components/auth/auth-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Accounts application error:", error);
  }, [error]);

  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-background text-foreground select-none">
      {/* Shared Ambient Background */}
      <AuthBackground />

      {/* Floating Theme Toggle in top-right */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-lg px-6 py-12 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
        {/* Branding Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8 group">
          <ConstLogoIcon
            size="lg"
            className="w-9 h-9 sm:w-10 sm:h-10 text-foreground transition-transform duration-300 group-hover:scale-105"
          />
          <span className="font-serif font-normal tracking-tight text-foreground text-3xl sm:text-4xl">
            Const
          </span>
        </Link>

        {/* Error Heading */}
        <div className="text-xs uppercase tracking-widest text-destructive font-mono mb-2">
          Authentication Error
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-[40px] font-serif font-normal tracking-tight text-foreground mb-4">
          Something went wrong
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-muted-foreground font-sans leading-relaxed mb-8 max-w-sm">
          An unexpected error occurred while processing your request. Please try again.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => reset()}
            className="h-11 sm:h-12 px-6 rounded-xl sm:rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-medium text-sm transition-all shadow-sm active:scale-[0.99] flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Try Again</span>
          </Button>

          <Button
            variant="outline"
            asChild
            className="h-11 sm:h-12 px-5 rounded-xl sm:rounded-2xl border-border/70 text-sm font-medium hover:bg-secondary/80 active:scale-[0.99] transition-all"
          >
            <Link href="/">Back Home</Link>
          </Button>
        </div>

        {/* Minimal Footer */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground font-sans pt-10 mt-6 border-t border-border/20 w-full">
          <a
            href="https://const.web.id"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Const Home
          </a>
        </div>
      </div>
    </main>
  );
}
