import React, { useState, useEffect } from "react";
import { LogIn, LogOut, CheckCircle2, Globe, ChevronDown, Laptop, Sparkles, ExternalLink } from "lucide-react";
import authArt from "./assets/auth-art.jpg";

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("const_learn_auth_token");
  });
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);

  // Set Accounts Hub URL: Default to localhost:3001 for development
  const accountsBaseUrl =
    import.meta.env.VITE_ACCOUNTS_URL || "http://localhost:3001";

  // Listen for deep link callback in Electron: const-learn://callback?token=...
  useEffect(() => {
    // 1. Electron deep-link listener
    if (window.electron?.onAuthCallback) {
      const unsubscribe = window.electron.onAuthCallback((data) => {
        if (data.token) {
          localStorage.setItem("const_learn_auth_token", data.token);
          setToken(data.token);
          setIsWaitingAuth(false);
        }
      });
      return () => unsubscribe();
    }

    // 2. Storage event listener (sync across windows or tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_learn_auth_token" && e.newValue) {
        setToken(e.newValue);
        setIsWaitingAuth(false);
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Browser query param fallback (if tested in browser)
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get("token");
    if (urlToken) {
      localStorage.setItem("const_learn_auth_token", urlToken);
      setToken(urlToken);
      setIsWaitingAuth(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Poll localStorage while waiting for authentication
  useEffect(() => {
    if (!isWaitingAuth) return;
    const interval = setInterval(() => {
      const saved = localStorage.getItem("const_learn_auth_token");
      if (saved) {
        setToken(saved);
        setIsWaitingAuth(false);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [isWaitingAuth]);

  const handleSignIn = async () => {
    const continueTarget = "const-learn://callback";
    const targetUrl = `${accountsBaseUrl}?continue=${encodeURIComponent(continueTarget)}`;

    setIsWaitingAuth(true);

    if (window.electron?.openExternal) {
      // Open in user's default system browser
      await window.electron.openExternal(targetUrl);
    } else {
      window.open(targetUrl, "_blank");
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("const_learn_auth_token");
    setToken(null);
    setIsWaitingAuth(false);
  };

  // Mock sign-in helper for development testing
  const handleDevMockLogin = () => {
    const mockToken = "const_dev_" + Math.random().toString(36).substring(2, 12);
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
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Authenticated (Desktop)
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight">
              Sign In Successful
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              You are connected to Const Ecosystem via Central Accounts.
            </p>

            <div className="mt-6 w-full rounded-xl border border-neutral-100 bg-neutral-50/80 p-4 text-left text-xs font-mono dark:border-neutral-800 dark:bg-neutral-950/50">
              <div className="flex justify-between py-1 border-b border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-500">Status:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active Session</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-500">Platform:</span>
                <span>Desktop Powerhouse</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-500">AI Gateway:</span>
                <span>router.const.web.id</span>
              </div>
              <div className="flex justify-between py-1 pt-2">
                <span className="text-neutral-500">Token:</span>
                <span className="truncate max-w-[180px] text-neutral-700 dark:text-neutral-300">
                  {token.substring(0, 18)}...
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm"
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
  // 2. Unauthenticated View (Login Page with Artwork split layout)
  // -------------------------------------------------------------
  return (
    <div className="flex min-h-screen w-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Left Column: Sign-in Card */}
      <div className="flex w-full flex-col justify-between p-8 sm:p-12 lg:w-1/2">
        {/* Top spacer / Brand mark */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold text-sm">
            C
          </div>
          <span className="text-sm font-semibold tracking-tight">Const Learn</span>
        </div>

        {/* Center: Sign in content */}
        <div className="my-auto mx-auto w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
            Sign in to Const Learn
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Sign in to start researching and learning with native AI agents — no complex setup required.
          </p>

          <div className="mt-8 space-y-4">
            <button
              onClick={handleSignIn}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-neutral-800 active:scale-[0.99] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              {isWaitingAuth ? "Buka Kembali Tab Login" : "Sign in to Const Learn"}
            </button>

            {/* Dev mode instant login helper */}
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

        {/* Bottom footer */}
        <div className="flex items-center justify-between pt-6 text-xs text-neutral-500 dark:text-neutral-400">
          <button className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
            <Globe className="h-3.5 w-3.5" />
            <span>English</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          <span>© 2026 Const · All rights reserved.</span>
        </div>
      </div>

      {/* Right Column: Artwork image (Desktop only) */}
      <div className="hidden lg:block lg:w-1/2 p-4">
        <div className="relative h-full w-full overflow-hidden rounded-3xl border border-neutral-200/60 dark:border-neutral-800/60 shadow-inner">
          <img
            src={authArt}
            alt="Const Learn Art"
            className="h-full w-full object-cover select-none"
          />
        </div>
      </div>
    </div>
  );
}
