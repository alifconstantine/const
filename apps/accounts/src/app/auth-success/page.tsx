"use client";

import { useSearchParams } from "next/navigation";
import { ConstLogoIcon } from "@const/ui";
import { AuthBackground } from "@/components/auth/auth-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState, useEffect, Suspense } from "react";
import { Button } from "@const/ui";
import { Copy, Check, ExternalLink } from "lucide-react";

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const appParam = searchParams.get("app")?.toLowerCase();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isNativeApp = appParam === "harness" || appParam === "learn";

  const appName =
    appParam === "learn"
      ? "Const Learn"
      : appParam === "harness"
      ? "Const Harness"
      : appParam === "router"
      ? "Const Router"
      : "the application";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored =
      localStorage.getItem("const_sso_token") ||
      localStorage.getItem("const_harness_auth_token");
    if (stored) {
      setToken(stored);
      // Auto-notify desktop loopback server in background
      if (appParam === "harness") {
        const port = searchParams.get("port") || "24125";
        const state = searchParams.get("state");
        const stateParam = state ? `&state=${encodeURIComponent(state)}` : "";
        try {
          fetch(`http://127.0.0.1:${port}/callback?token=${encodeURIComponent(stored)}${stateParam}`, {
            mode: "no-cors",
          }).catch(() => {});
        } catch {}
      }
    }
  }, [appParam, searchParams]);

  const handleOpenApp = () => {
    if (!token) return;
    const state = searchParams.get("state");
    const stateParam = state ? `&state=${encodeURIComponent(state)}` : "";
    if (appParam === "harness") {
      window.location.href = `const-harness://callback?token=${encodeURIComponent(token)}${stateParam}`;
    } else if (appParam === "learn") {
      window.location.href = `const-learn://callback?token=${encodeURIComponent(token)}${stateParam}`;
    }
  };

  const handleCopyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

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
      <div className="mt-6 flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
        <span>Session verified</span>
      </div>

      {/* Native App Actions (Open App / Copy Token fallback) */}
      {isNativeApp && token && (
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
          <Button
            onClick={handleOpenApp}
            className="w-full h-10 rounded-xl text-xs font-medium gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open {appName}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleCopyToken}
            className="w-full h-10 rounded-xl text-xs font-medium gap-2 border-border cursor-pointer transition-all active:scale-[0.99]"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy token
              </>
            )}
          </Button>
        </div>
      )}
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
