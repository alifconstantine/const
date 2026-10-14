import React, { useState, useEffect } from "react";
import { LogIn, Globe } from "lucide-react";
import { Button } from "@const/ui";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { ConvexClientProvider } from "./components/convex-provider";
import { Navbar } from "./components/navbar";
import { LearnHome } from "./components/home/learn-home";
import { MobileLearnWorkspace } from "./components/workspace/learn-workspace";
import { MobileSettingsView } from "./components/settings/mobile-settings-view";
import { UpdateSheet } from "./components/home/sheets/update-sheet";
import { localDb } from "./lib/db";
import { useI18n } from "./lib/i18n";

function AuthenticatedContent({
  onSignOut,
  onSwitchAccount,
}: {
  onSignOut: () => void;
  onSwitchAccount: () => void;
}) {
  const { t } = useI18n();
  const user = useQuery(api.auth.queries.currentUser, {});
  const [activeLearnId, setActiveLearnId] = useState<string | null>(null);
  const [openAddSourceOnLoad, setOpenAddSourceOnLoad] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);

  const handleOpenLearn = (learnId: string, openAddSource = false) => {
    setActiveLearnId(learnId);
    setOpenAddSourceOnLoad(openAddSource);
  };

  const handleBackToHome = () => {
    setActiveLearnId(null);
    setOpenAddSourceOnLoad(false);
  };

  useEffect(() => {
    const onOpenMcpSheet = () => {
      if (activeLearnId) {
        setActiveLearnId(null);
        setOpenAddSourceOnLoad(false);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("const:open-mcp-sheet"));
        }, 50);
      }
    };

    window.addEventListener("const:open-mcp-sheet", onOpenMcpSheet);
    return () => {
      window.removeEventListener("const:open-mcp-sheet", onOpenMcpSheet);
    };
  }, [activeLearnId]);

  if (isSettingsOpen) {
    return (
      <MobileSettingsView
        onBack={() => setIsSettingsOpen(false)}
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
      />
    );
  }

  if (activeLearnId) {
    return (
      <MobileLearnWorkspace
        learnId={activeLearnId}
        initialSourceModalOpen={openAddSourceOnLoad}
        onBack={handleBackToHome}
        onSelectLearn={(id) => {
          setActiveLearnId(id);
          setOpenAddSourceOnLoad(false);
        }}
        onCreateNew={async () => {
          const id = await localDb.createLearn({
            title: t("untitledNotebook"),
            emoji: "book",
          });
          setActiveLearnId(id);
          setOpenAddSourceOnLoad(false);
        }}
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground overflow-hidden">
      <Navbar
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenUpdate={() => setIsUpdateOpen(true)}
      />
      <LearnHome
        onOpenLearn={handleOpenLearn}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenUpdate={() => setIsUpdateOpen(true)}
        user={user}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
      />
      <UpdateSheet
        open={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
      />
    </div>
  );
}

export default function App() {
  const { language, setLanguage, t } = useI18n();
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

  const handleTokenReceived = (receivedToken: string, receivedRefreshToken?: string | null) => {
    localStorage.setItem("const_learn_auth_token", receivedToken);
    localStorage.setItem("const_sso_token", receivedToken);
    if (receivedRefreshToken) {
      localStorage.setItem("const_sso_refresh_token", receivedRefreshToken);
    }
    setToken(receivedToken);
    setIsWaitingAuth(false);
  };

  useEffect(() => {
    // Helper to extract token & refresh token from any URL or deep link
    const extractToken = (rawUrl: string) => {
      try {
        const match = rawUrl.match(/[?&]token=([^&"'\s]+)/);
        const urlToken = match?.[1] ? decodeURIComponent(match[1]) : null;
        const refreshMatch = rawUrl.match(/[?&]refreshToken=([^&"'\s]+)/);
        const refreshToken = refreshMatch?.[1] ? decodeURIComponent(refreshMatch[1]) : null;
        return { token: urlToken, refreshToken };
      } catch {
        return { token: null, refreshToken: null };
      }
    };

    // 1. Check if token returned via standard URL query parameter (web/PWA flow)
    const { token: urlToken, refreshToken } = extractToken(window.location.href);
    if (urlToken) {
      handleTokenReceived(urlToken, refreshToken);
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

    // 3. Native Deep Link Listener for Capacitor Android
    let cleanupListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      // Check if cold-started directly from deep link
      CapApp.getLaunchUrl().then((launch) => {
        if (launch?.url) {
          const { token: deepToken, refreshToken: deepRefresh } = extractToken(launch.url);
          if (deepToken) {
            handleTokenReceived(deepToken, deepRefresh);
          }
        }
      });

      // Listen for runtime appUrlOpen (returning from external or in-app browser)
      CapApp.addListener("appUrlOpen", async (data) => {
        if (data?.url) {
          const { token: deepToken, refreshToken: deepRefresh } = extractToken(data.url);
          if (deepToken) {
            handleTokenReceived(deepToken, deepRefresh);
            try {
              await Browser.close();
            } catch {}
          }
        }
      }).then((handle) => {
        cleanupListener = () => handle.remove();
      });
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, []);

  const handleSignIn = async () => {
    setIsWaitingAuth(true);

    const isNative = Capacitor.isNativePlatform();
    // On native mobile app, always use custom scheme deep link const-learn://callback
    const continueTarget = isNative
      ? "const-learn://callback"
      : `${window.location.origin}${window.location.pathname}`;

    const base = accountsBaseUrl.replace(/\/+$/, "");
    const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&prompt=select_account&app=learn`;

    if (isNative) {
      try {
        await Browser.open({ url: targetUrl, presentationStyle: "popover" });
      } catch {
        window.location.href = targetUrl;
      }
    } else {
      window.location.href = targetUrl;
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("const_learn_auth_token");
    localStorage.removeItem("const_sso_token");
    localStorage.removeItem("const_sso_refresh_token");
    setToken(null);
    setIsWaitingAuth(false);
  };

  const handleSwitchAccount = async () => {
    localStorage.removeItem("const_learn_auth_token");
    localStorage.removeItem("const_sso_token");
    localStorage.removeItem("const_sso_refresh_token");
    setToken(null);
    setIsWaitingAuth(true);

    const isNative = Capacitor.isNativePlatform();
    const continueTarget = isNative
      ? "const-learn://callback"
      : `${window.location.origin}${window.location.pathname}`;

    const base = accountsBaseUrl.replace(/\/+$/, "");
    const targetUrl = `${base}/?continue=${encodeURIComponent(continueTarget)}&action=switch_account&app=learn`;

    if (isNative) {
      try {
        await Browser.open({ url: targetUrl, presentationStyle: "popover" });
      } catch {
        window.location.href = targetUrl;
      }
    } else {
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
  // 2. Unauthenticated View (Mobile: No Image on right due to width constraint)
  // -------------------------------------------------------------
  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-background p-6 sm:p-8 text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Top Header & Brand */}
      <div className="flex items-center justify-between">
        <div className="flex items-center select-none py-1">
          <span className="font-serif text-[22px] font-medium tracking-tight text-foreground">
            Const
          </span>
          <span className="font-sans text-[18px] font-normal text-muted-foreground ml-1.5 tracking-tight">
            Learn
          </span>
        </div>
      </div>

      {/* Center Card (NO Image on right for mobile as requested) */}
      <div className="my-auto mx-auto w-full max-w-sm py-8">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("signInConstLearn")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("signInSubtitle")}
        </p>

        <div className="mt-8 space-y-4">
          <Button
            onClick={handleSignIn}
            size="lg"
            className="w-full h-12 rounded-xl text-sm font-medium gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            <LogIn className="h-4 w-4" />
            {isWaitingAuth ? t("reopenLoginPage") : t("signInConstLearn")}
          </Button>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "id" : "en")}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>{language === "id" ? "Bahasa Indonesia" : "English"}</span>
        </button>
        <span>© 2026 Const</span>
      </div>
    </div>
  );
}
