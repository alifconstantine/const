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
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#161616] text-[#d4d4d4] p-4 select-none">
      <div className="w-full max-w-md p-8 rounded-3xl bg-[#222222] border border-[#383838]/60 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[#2b2b2b] border border-[#383838] flex items-center justify-center text-white">
            <ConstLogoIcon size="md" className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#1b1b1b] text-[#969696] border border-[#2e2e2e]">
              Gateway System Alert
            </span>
            <h1 className="text-xl sm:text-2xl font-serif text-white pt-2">
              Something went wrong
            </h1>
            <p className="text-xs text-[#969696] font-sans leading-relaxed max-w-xs mx-auto">
              An unexpected client error occurred while loading this page.
            </p>
          </div>
        </div>

        {error?.message && (
          <div className="p-3 rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] text-left">
            <p className="text-[11px] font-mono text-[#969696] break-all line-clamp-3">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="flex-1 rounded-full h-10 gap-2 text-xs font-medium bg-white text-[#161616] hover:bg-white/90 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>

          <Link href="/dashboard" className="flex-1">
            <Button
              variant="outline"
              className="w-full rounded-full h-10 gap-2 text-xs font-medium border-[#383838] bg-[#1b1b1b] text-[#d4d4d4] hover:text-white hover:bg-[#2b2b2b] cursor-pointer"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Button>
          </Link>
        </div>

        <div className="pt-2 border-t border-[#383838]/40 flex justify-center">
          <button
            onClick={() => window.history.back()}
            className="text-[11px] text-[#969696] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Go back to previous page</span>
          </button>
        </div>
      </div>
    </div>
  );
}
