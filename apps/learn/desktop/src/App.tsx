import React, { useState, useEffect } from "react";
import { LogIn, Globe } from "lucide-react";
import { ConstLogoIcon, Button } from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { ConvexClientProvider } from "./components/convex-provider";
import { Navbar } from "./components/navbar";
import authArt from "./assets/auth-art.jpg";

function AuthenticatedContent({ onSignOut }: { onSignOut: () => void }) {
  const user = useQuery(api.auth.queries.currentUser, {});

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <Navbar user={user} onSignOut={onSignOut} />
      <main className="flex-1 w-full bg-background" />
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("const_learn_auth_token");
  });
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);

  // Set Accounts Hub URL: Default to localhost:3001 for development
  const accountsBaseUrl =
    (import.meta.env.VITE_ACCOUNTS_URL as string) || "http://localhost:3001";

  // Listen for deep link callback in Electron or browser redirect
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
    const continueTarget = window.electron?.openExternal
      ? "const-learn://callback"
      : `${window.location.origin}${window.location.pathname}`;

    const targetUrl = `${accountsBaseUrl}?continue=${encodeURIComponent(continueTarget)}&prompt=select_account`;
    setIsWaitingAuth(true);

    if (window.electron?.openExternal) {
      await window.electron.openExternal(targetUrl);
    } else {
      window.location.href = targetUrl;
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("const_learn_auth_token");
    localStorage.removeItem("const_sso_token");
    setToken(null);
    setIsWaitingAuth(false);
  };

  // -------------------------------------------------------------
  // 1. Authenticated View: Navbar at Top + Empty Main Area (Zero Dummy Data)
  // -------------------------------------------------------------
  if (token) {
    return (
      <ConvexClientProvider token={token} signOut={handleSignOut}>
        <AuthenticatedContent onSignOut={handleSignOut} />
      </ConvexClientProvider>
    );
  }

  // -------------------------------------------------------------
  // 2. Unauthenticated View: Redesigned Split Login Page with @const/ui
  // -------------------------------------------------------------
  return (
    <div className="h-screen max-h-screen w-full overflow-hidden flex bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Left Column: Sign-in Card */}
      <div className="flex h-full w-full flex-col justify-between p-6 sm:p-8 lg:p-10 lg:w-1/2 overflow-hidden">
        {/* Brand Mark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ConstLogoIcon size="sm" className="w-6 h-6 text-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-normal tracking-tight text-foreground">
              Const
            </span>
            <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
              Learn
            </span>
          </div>
        </div>

        {/* Center: Sign in content */}
        <div className="my-auto mx-auto w-full max-w-sm shrink-0 py-2">
          <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            Sign in to Const Learn.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sign in to start researching and learning with native AI agents — no complex setup required.
          </p>

          <div className="mt-8 space-y-4">
            <Button
              onClick={handleSignIn}
              size="lg"
              className="w-full h-12 rounded-xl text-sm font-medium gap-2 cursor-pointer transition-all active:scale-[0.99]"
            >
              <LogIn className="h-4 w-4" />
              {isWaitingAuth ? "Buka Kembali Tab Login" : "Sign in to Const Learn"}
            </Button>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            <span>English</span>
          </div>
          <span>© 2026 Const · All rights reserved.</span>
        </div>
      </div>

      {/* Right Column: Artwork image (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 h-full p-4 overflow-hidden items-center justify-center">
        <div className="relative h-full w-full max-h-full overflow-hidden rounded-3xl border border-border shadow-inner">
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
