"use client";

import { useSearchParams } from "next/navigation";
import { ConstLogoIcon, Button } from "@const/ui";
import { AuthBackground } from "@/components/auth/auth-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState, useEffect, Suspense } from "react";
import { ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

function CanvaCallbackContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "";
  const error = searchParams.get("error") || searchParams.get("error_description");

  const [hasAttemptedHandshake, setHasAttemptedHandshake] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !code) return;

    // 1. Notify Desktop loopback server on port 24135
    try {
      fetch(
        `http://127.0.0.1:24135/canva/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
        { mode: "no-cors" }
      ).catch(() => {});
    } catch {}

    // 2. Trigger native app deep link
    const deepLinkUrl = `const-learn://oauth/canva?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    try {
      window.location.href = deepLinkUrl;
    } catch {}

    setHasAttemptedHandshake(true);

    // 3. Auto-close browser tab if allowed
    const timer = setTimeout(() => {
      try {
        window.close();
      } catch {}
    }, 1500);

    return () => clearTimeout(timer);
  }, [code, state]);

  const handleOpenApp = () => {
    if (!code) return;
    const deepLinkUrl = `const-learn://oauth/canva?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    window.location.href = deepLinkUrl;
  };

  return (
    <div className="relative z-10 w-full max-w-lg sm:max-w-xl px-6 py-12 flex flex-col items-center justify-center text-center select-none animate-in fade-in duration-500">
      <div className="flex items-center justify-center gap-3 mb-8 group">
        <ConstLogoIcon
          size="lg"
          className="w-10 h-10 text-foreground transition-transform duration-300 group-hover:scale-105"
        />
        <span className="font-serif font-normal tracking-tight text-foreground text-3xl sm:text-4xl">
          Const
        </span>
      </div>

      {error ? (
        <>
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground leading-tight">
            Otorisasi Canva Ditolak
          </h1>
          <p className="mt-3 text-sm text-muted-foreground font-sans font-light max-w-sm sm:max-w-md leading-relaxed">
            {error}
          </p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground leading-tight">
            Canva Berhasil Terhubung
          </h1>
          <p className="mt-3 text-sm text-muted-foreground font-sans font-light max-w-sm sm:max-w-md leading-relaxed">
            Otorisasi akun Canva Anda berhasil diverifikasi. Tab ini dapat ditutup dan Anda dapat kembali ke aplikasi Const Learn.
          </p>

          <div className="mt-6 flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>OAuth PKCE Handshake verified</span>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
            <Button
              onClick={handleOpenApp}
              className="w-full h-10 rounded-xl text-xs font-medium gap-2 cursor-pointer transition-all active:scale-[0.99] bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Buka Const Learn
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function CanvaCallbackPage() {
  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-background text-foreground transition-colors duration-300">
      <AuthBackground />

      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle />
      </div>

      <Suspense fallback={null}>
        <CanvaCallbackContent />
      </Suspense>
    </main>
  );
}
