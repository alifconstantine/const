"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ConstLogoIcon, Button } from "@const/ui";
import { RotateCcw, Home, ArrowLeft } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Const Router client error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-4 select-none">
      <div className="w-full max-w-md p-8 rounded-3xl bg-card border border-border text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-secondary border border-border flex items-center justify-center text-foreground">
            <ConstLogoIcon size="md" className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
              Gateway System Alert
            </span>
            <h1 className="text-xl sm:text-2xl font-serif text-foreground pt-2">
              Something went wrong
            </h1>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed max-w-xs mx-auto">
              An unexpected client error occurred while loading this page.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="flex-1 rounded-full h-10 gap-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>

          <Link href="/dashboard" className="flex-1">
            <Button
              variant="outline"
              className="w-full rounded-full h-10 gap-2 text-xs font-medium border-border bg-secondary text-foreground hover:bg-muted cursor-pointer"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Button>
          </Link>
        </div>

        <div className="pt-2 border-t border-border/60 flex justify-center">
          <button
            onClick={() => window.history.back()}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Go back to previous page</span>
          </button>
        </div>
      </div>
    </div>
  );
}
