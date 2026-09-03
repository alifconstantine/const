import React, { useState, useEffect } from "react";
import { LogIn, LogOut, CheckCircle2, Globe, ChevronDown, Smartphone } from "lucide-react";

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("const_learn_auth_token");
  });
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);

  // Set Accounts Hub URL: Default to localhost:3001
  const accountsBaseUrl =
    import.meta.env.VITE_ACCOUNTS_URL || "http://localhost:3001";

  useEffect(() => {
    // Check if token returned via URL query parameter (standard web/PWA flow)
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get("token");
    if (urlToken) {
      localStorage.setItem("const_learn_auth_token", urlToken);
      setToken(urlToken);
      setIsWaitingAuth(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSignIn = () => {
    setIsWaitingAuth(true);

    // In web/preview mode, redirect back to current origin so accounts can return the token
    const continueTarget =
      window.location.protocol.startsWith("http")
        ? `${window.location.origin}?callback=true`
        : "const-learn://callback";

    const targetUrl = `${accountsBaseUrl}?continue=${encodeURIComponent(continueTarget)}`;
    window.location.href = targetUrl;
  };

  const handleSignOut = () => {
    localStorage.removeItem("const_learn_auth_token");
    setToken(null);
    setIsWaitingAuth(false);
  };

  // Mock sign-in helper for development testing
  const handleDevMockLogin = () => {
    const mockToken = "const_dev_mobile_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("const_learn_auth_token", mockToken);
    setToken(mockToken);
    setIsWaitingAuth(false);
  };

  // -------------------------------------------------------------
  // 1. Authenticated View (Polosan: Status Login + Tombol Logout)
  // -------------------------------------------------------------
  if (token) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Authenticated (Mobile)
            </div>

            <h1 className="mt-4 text-xl font-bold tracking-tight">
              Sign In Successful
            </h1>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Mobile Companion terhubung ke Akun Const Anda.
            </p>

            <div className="mt-5 w-full rounded-xl border border-neutral-100 bg-neutral-50/80 p-3.5 text-left text-xs font-mono dark:border-neutral-800 dark:bg-neutral-950/50">
              <div className="flex justify-between py-1 border-b border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-500">Platform:</span>
                <span>Mobile Companion</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-500">Cloud Sandbox:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Composio MCP</span>
              </div>
              <div className="flex justify-between py-1 pt-1.5">
                <span className="text-neutral-500">Token:</span>
                <span className="truncate max-w-[140px] text-neutral-700 dark:text-neutral-300">
                  {token.substring(0, 16)}...
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. Unauthenticated View (Mobile: No Image on the Right)
  // -------------------------------------------------------------
  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-white p-6 sm:p-8 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold text-sm">
            C
          </div>
          <span className="text-sm font-semibold tracking-tight">Const Learn</span>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          <Smartphone className="h-3 w-3" />
          <span>Mobile</span>
        </div>
      </div>

      {/* Center Card (NO Image on right for mobile) */}
      <div className="my-auto mx-auto w-full max-w-sm py-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
          Sign in to Const Learn
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Sign in to start learning with cloud AI right away — no complex setup required.
        </p>

        <div className="mt-8 space-y-4">
          <button
            onClick={handleSignIn}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-neutral-800 active:scale-[0.99] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            {isWaitingAuth ? "Buka Kembali Halaman Login" : "Sign in to Const Learn"}
          </button>

          {/* Dev helper */}
          <div className="pt-2 flex flex-col items-center gap-1">
            <button
              onClick={handleDevMockLogin}
              className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 underline cursor-pointer"
            >
              ⚡ Simulate Instant Login (Dev Mode)
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="flex items-center justify-between pt-4 text-xs text-neutral-500 dark:text-neutral-400">
        <button className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
          <Globe className="h-3 w-3" />
          <span>English</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
        <span>© 2026 Const</span>
      </div>
    </div>
  );
}
