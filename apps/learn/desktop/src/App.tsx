import React, { useState, useEffect, useRef } from "react";
import { LogIn, Globe } from "lucide-react";
import { ConstLogoIcon, Button } from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { ConvexClientProvider } from "./components/convex-provider";
import { LearnHome } from "./components/home/learn-home";
import { LearnWorkspace } from "./components/workspace/learn-workspace";
import { localDb } from "./lib/db";
import authArt from "./assets/auth-art.jpg";

function AuthenticatedContent({
  onSignOut,
  onSwitchAccount,
}: {
  onSignOut: () => void;
  onSwitchAccount: () => void;
}) {
  const user = useQuery(api.auth.queries.currentUser, {});
  const [activeLearnId, setActiveLearnId] = useState<string | null>(null);
  const [openAddSourceOnLoad, setOpenAddSourceOnLoad] = useState(false);

  const handleOpenLearn = (learnId: string, openAddSource = false) => {
    setActiveLearnId(learnId);
    setOpenAddSourceOnLoad(openAddSource);
  };

  const handleBackToHome = () => {
    setActiveLearnId(null);
    setOpenAddSourceOnLoad(false);
  };

  if (activeLearnId) {
    return (
      <LearnWorkspace
        learnId={activeLearnId}
        initialSourceModalOpen={openAddSourceOnLoad}
        onBack={handleBackToHome}
        onCreateNew={async () => {
          const id = await localDb.createLearn({
            title: "Notebook tanpa judul",
            emoji: "📘",
          });
          const initialSessionId = await localDb.createSession(id, "Sesi Awal");
          try {
            localStorage.setItem(`const_learn_active_session_${id}`, initialSessionId);
          } catch {}
          setActiveLearnId(id);
          setOpenAddSourceOnLoad(true);
        }}
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
      />
    );
  }

  return (
    <LearnHome
      onOpenLearn={handleOpenLearn}
      user={user}
      onSignOut={onSignOut}
      onSwitchAccount={onSwitchAccount}
    />
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("const_learn_auth_token");
  });
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);
  const isWaitingAuthRef = useRef(false);
  isWaitingAuthRef.current = isWaitingAuth;

  // Set Accounts Hub URL: Default to production accounts.const.web.id
  const accountsBaseUrl =
    (import.meta.env.VITE_ACCOUNTS_URL as string) || "https://accounts.const.web.id";

  // Listen for deep link callback in Electron or browser redirect
  useEffect(() => {
    // 1. Electron deep-link listener
    if (window.electron?.onAuthCallback) {
      const unsubscribe = window.electron.onAuthCallback(
        (data: { url: string; token?: string; cancelled?: boolean; error?: string }) => {
          if (data.cancelled) {
            setIsWaitingAuth(false);
            isWaitingAuthRef.current = false;
            return;
          }

          if (data.token) {
            localStorage.setItem("const_learn_auth_token", data.token);
            localStorage.setItem("const_sso_token", data.token);
            setToken(data.token);
            setIsWaitingAuth(false);
            isWaitingAuthRef.current = false;
          }
        }
      );
      return () => unsubscribe();
    }

    // 2. Storage event listener (sync across windows or tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "const_learn_auth_token" && e.newValue && isWaitingAuthRef.current) {
        setToken(e.newValue);
        setIsWaitingAuth(false);
        isWaitingAuthRef.current = false;
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Browser query param fallback (if tested in browser)
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get("token");
    if (urlToken && isWaitingAuthRef.current) {
      localStorage.setItem("const_learn_auth_token", urlToken);
      localStorage.setItem("const_sso_token", urlToken);
      setToken(urlToken);
      setIsWaitingAuth(false);
      isWaitingAuthRef.current = false;
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
        isWaitingAuthRef.current = false;
      }
    }, 800);
    return () => clearInterval(interval);
  }, [isWaitingAuth]);

  const handleSignIn = async () => {
    setIsWaitingAuth(true);
    isWaitingAuthRef.current = true;

    if (window.electron?.startAuth) {
      try {
        const res = await window.electron.startAuth({
          accountsUrl: accountsBaseUrl,
        });
        if (!res.success) {
          setIsWaitingAuth(false);
          isWaitingAuthRef.current = false;
        }
      } catch {
        setIsWaitingAuth(false);
        isWaitingAuthRef.current = false;
      }
    } else {
      const continueTarget = `${window.location.origin}${window.location.pathname}`;
      const base = accountsBaseUrl.replace(/\/+$/, "");
      const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&prompt=select_account&app=learn`;
      window.location.href = targetUrl;
    }
  };

  const handleCancelSignIn = async () => {
    setIsWaitingAuth(false);
    isWaitingAuthRef.current = false;
    if (window.electron?.cancelAuth) {
      await window.electron.cancelAuth();
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("const_learn_auth_token");
    localStorage.removeItem("const_sso_token");
    setToken(null);
    setIsWaitingAuth(false);
    isWaitingAuthRef.current = false;
  };

  const handleSwitchAccount = async () => {
    localStorage.removeItem("const_learn_auth_token");
    localStorage.removeItem("const_sso_token");
    setToken(null);
    setIsWaitingAuth(true);
    isWaitingAuthRef.current = true;

    if (window.electron?.startAuth) {
      try {
        await window.electron.startAuth({
          accountsUrl: accountsBaseUrl,
          action: "switch_account",
        });
      } catch {
        setIsWaitingAuth(false);
        isWaitingAuthRef.current = false;
      }
    } else {
      const continueTarget = `${window.location.origin}${window.location.pathname}`;
      const base = accountsBaseUrl.replace(/\/+$/, "");
      const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&action=switch_account&app=learn`;
      window.location.href = targetUrl;
    }
  };

  // -------------------------------------------------------------
  // 1. Authenticated View: Navbar at Top + Empty Main Area (Zero Dummy Data)
  // -------------------------------------------------------------
  if (token) {
    return (
      <ConvexClientProvider token={token} signOut={handleSignOut}>
        <AuthenticatedContent
          onSignOut={handleSignOut}
          onSwitchAccount={handleSwitchAccount}
        />
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
            {isWaitingAuth && (
              <Button
                variant="outline"
                onClick={handleCancelSignIn}
                size="sm"
                className="w-full rounded-xl text-xs text-muted-foreground"
              >
                Batalkan
              </Button>
            )}
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
