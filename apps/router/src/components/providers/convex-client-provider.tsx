"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import {
  getAccountsUrl,
  getAppUrl,
  getCookie,
  setCookie,
  deleteCookie,
} from "@/lib/auth-constants";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL environment variable.");
}

export const convex = new ConvexReactClient(convexUrl);

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (destinationPath?: string, options?: { switchAccount?: boolean }) => void;
  signOut: (destinationPath?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isLoading: true,
  isAuthenticated: false,
  signIn: () => {},
  signOut: () => {},
});

export function useRouterAuth() {
  return useContext(AuthContext);
}

function useConvexAuthAdapter() {
  const { token, isLoading, isAuthenticated } = useContext(AuthContext);
  const fetchAccessToken = useCallback(
    async () => token,
    [token]
  );
  return {
    isLoading,
    isAuthenticated,
    fetchAccessToken,
  };
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check for token passed in URL query param (e.g. from accounts redirect)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      setCookie("const_sso_token", urlToken);
      try {
        localStorage.setItem("const_sso_token", urlToken);
      } catch {}

      // Clean the URL without reloading
      params.delete("token");
      const newQuery = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${newQuery}`
      );

      setToken(urlToken);
      setIsLoading(false);
      return;
    }

    // If an OAuth code was received directly by router, bounce it to accounts to exchange
    const urlCode = params.get("code");
    if (urlCode) {
      params.delete("code");
      const accountsUrl = getAccountsUrl();
      const currentTarget = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.location.href = `${accountsUrl}/?code=${encodeURIComponent(urlCode)}&continue=${encodeURIComponent(currentTarget)}`;
      return;
    }

    // 2. Check localStorage
    let storedToken: string | null = null;
    try {
      storedToken = localStorage.getItem("const_sso_token");
    } catch {}

    // 3. Check Cookie
    const cookieToken = getCookie("const_sso_token");

    const resolvedToken = storedToken || cookieToken;

    if (resolvedToken) {
      // Ensure sync between cookie and localStorage
      setCookie("const_sso_token", resolvedToken);
      try {
        localStorage.setItem("const_sso_token", resolvedToken);
      } catch {}
      setToken(resolvedToken);
    }

    setIsLoading(false);
  }, []);

  const signIn = useCallback((destinationPath?: string | unknown, options?: { switchAccount?: boolean }) => {
    if (typeof window === "undefined") return;
    const accountsUrl = getAccountsUrl();
    const appUrl = getAppUrl();
    const targetPath = typeof destinationPath === "string" ? destinationPath : "/dashboard";
    const returnUrl = `${appUrl}${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`;
    const switchParam = options?.switchAccount ? "&prompt=select_account" : "";
    window.location.href = `${accountsUrl}/?continue=${encodeURIComponent(returnUrl)}${switchParam}`;
  }, []);

  const signOut = useCallback((destinationPath?: string | unknown) => {
    deleteCookie("const_sso_token");
    try {
      localStorage.removeItem("const_sso_token");
    } catch {}
    setToken(null);
    if (typeof window !== "undefined") {
      const accountsUrl = getAccountsUrl();
      const appUrl = getAppUrl();
      const targetPath = typeof destinationPath === "string" ? destinationPath : "/";
      const returnTarget = `${appUrl}${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`;
      // Perform federated SSO sign-out via Accounts Hub
      window.location.href = `${accountsUrl}/signout?continue=${encodeURIComponent(returnTarget)}`;
    }
  }, []);

  const authValue: AuthContextType = {
    token,
    isLoading,
    isAuthenticated: !!token,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={authValue}>
      <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthAdapter}>
        {children}
      </ConvexProviderWithAuth>
    </AuthContext.Provider>
  );
}
