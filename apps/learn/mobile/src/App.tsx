import React, { useState, useEffect } from "react";
import { LogIn, Globe } from "lucide-react";
import { ConstLogoIcon, Button } from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { ConvexClientProvider } from "./components/convex-provider";
import { Navbar } from "./components/navbar";
import { LearnHome } from "./components/home/learn-home";
import { MobileLearnWorkspace } from "./components/workspace/learn-workspace";
import { localDb } from "./lib/db";

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
      <MobileLearnWorkspace
        learnId={activeLearnId}
        initialSourceModalOpen={openAddSourceOnLoad}
        onBack={handleBackToHome}
        onCreateNew={async () => {
          const id = await localDb.createLearn({
            title: "Notebook tanpa judul",
            emoji: "📘",
          });
          setActiveLearnId(id);
          setOpenAddSourceOnLoad(true);
        }}
        user={user}
      />
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <Navbar
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
      />
      <LearnHome onOpenLearn={handleOpenLearn} />
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    return (
      localStorage.getItem("const_learn_auth_token") ||
      localStorage.getItem("const_sso_token")
    );
  });
  const [isWaitingAuth, setIsWaitingAuth] = useState(false);

  // Set Accounts Hub URL: Default to production accounts.const.web.id, can be overridden via VITE_ACCOUNTS_URL in development
  const accountsBaseUrl =
    (import.meta.env.VITE_ACCOUNTS_URL as string) || "https://accounts.const.web.id";

  useEffect(() => {
    // 1. Check if token returned via URL query parameter (standard web/PWA flow)
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get("token");
    const refreshToken = searchParams.get("refreshToken");
    if (urlToken) {
      localStorage.setItem("const_learn_auth_token", urlToken);
      localStorage.setItem("const_sso_token", urlToken);
      if (refreshToken) {
        localStorage.setItem("const_sso_refresh_token", refreshToken);
      }
      setToken(urlToken);
      setIsWaitingAuth(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Storage event listener (sync across tabs/windows)
    const handleStorage = (e: StorageEvent) => {
      if (
        (e.key === "const_learn_auth_token" || e.key === "const_sso_token") &&
        e.newValue
      ) {
        setToken(e.newValue);
        setIsWaitingAuth(false);
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleSignIn = () => {
    setIsWaitingAuth(true);

    // In web/preview mode, redirect back to current origin so accounts can return the token
    const continueTarget = window.location.protocol.startsWith("http")
      ? `${window.location.origin}${window.location.pathname}`
      : "const-learn://callback";

    const base = accountsBaseUrl.replace(/\/+$/, "");
    const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&prompt=select_account`;
    window.location.href = targetUrl;
  };

  const handleSignOut = () => {
    localStorage.removeItem("const_learn_auth_token");
    localStorage.removeItem("const_sso_token");
    localStorage.removeItem("const_sso_refresh_token");
    setToken(null);
    setIsWaitingAuth(false);
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem("const_learn_auth_token");
    localStorage.removeItem("const_sso_token");
    localStorage.removeItem("const_sso_refresh_token");
    setToken(null);
    setIsWaitingAuth(true);

    const continueTarget = window.location.protocol.startsWith("http")
      ? `${window.location.origin}${window.location.pathname}`
      : "const-learn://callback";

    const base = accountsBaseUrl.replace(/\/+$/, "");
    const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&action=switch_account`;
    window.location.href = targetUrl;
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
  // 2. Unauthenticated View (Mobile: No Image on right due to width constraint)
  // -------------------------------------------------------------
  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-background p-6 sm:p-8 text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Top Header & Brand */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
      </div>

      {/* Center Card (NO Image on right for mobile as requested) */}
      <div className="my-auto mx-auto w-full max-w-sm py-8">
        <h1 className="font-serif text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
          Sign in to Const Learn.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sign in to start learning with cloud AI right away — no complex setup required.
        </p>

        <div className="mt-8 space-y-4">
          <Button
            onClick={handleSignIn}
            size="lg"
            className="w-full h-12 rounded-xl text-sm font-medium gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            <LogIn className="h-4 w-4" />
            {isWaitingAuth ? "Buka Kembali Halaman Login" : "Sign in to Const Learn"}
          </Button>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          <span>English</span>
        </div>
        <span>© 2026 Const</span>
      </div>
    </div>
  );
}
