"use client";

import Link from "next/link";
import { ConstLogoIcon } from "@const/ui";
import { Button } from "@const/ui/components/ui/button";
import { AuthBackground } from "@/components/auth/auth-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-background text-foreground select-none">
      {/* Shared Ambient Background */}
      <AuthBackground />

      {/* Floating Theme Toggle in top-right */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-2xl px-4 sm:px-6 py-12 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
        {/* Branding Logo */}
        <div className="flex items-center justify-center gap-3 mb-8 group">
          <ConstLogoIcon
            size="lg"
            className="w-9 h-9 sm:w-10 sm:h-10 text-foreground transition-transform duration-300 group-hover:scale-105"
          />
          <span className="font-serif font-normal tracking-tight text-foreground text-3xl sm:text-4xl">
            Const
          </span>
        </div>

        {/* 404 Tag */}
        <div className="text-[11px] sm:text-xs uppercase tracking-widest text-muted-foreground/80 font-mono mb-3">
          Error 404 · Not Found
        </div>

        {/* 1-Line Heading */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-serif font-normal tracking-tight text-foreground mb-4 leading-tight">
          Page not found.
        </h1>

        {/* Sub-heading */}
        <p className="text-sm sm:text-base text-muted-foreground font-sans leading-relaxed mb-8 max-w-lg mx-auto">
          The requested page does not exist or may have been moved.
        </p>

        {/* Action Button */}
        <Button
          asChild
          className="h-11 sm:h-12 px-6 rounded-xl sm:rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-medium text-sm transition-all shadow-sm active:scale-[0.99] flex items-center gap-2 mb-8"
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Sign In</span>
          </Link>
        </Button>

        {/* Minimal Footer Links */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground font-sans pt-6 border-t border-border/20 w-full max-w-xs">
          <a
            href="https://docs.const.ai"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Docs
          </a>
          <span className="opacity-30">|</span>
          <a
            href="https://const.ai/blog"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Blog
          </a>
          <span className="opacity-30">|</span>
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
