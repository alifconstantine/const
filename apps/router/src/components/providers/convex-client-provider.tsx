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

import { api } from "@const/backend/_generated/api";

interface AuthContextType {
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSigningOut: boolean;
  signIn: (destinationPath?: string, options?: { switchAccount?: boolean }) => void;
  signOut: (destinationPath?: string) => void;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,
  isSigningOut: false,
  signIn: () => {},
  signOut: () => {},
  refreshSession: async () => false,
});

export function useRouterAuth() {
  return useContext(AuthContext);
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) return urlToken;
    return localStorage.getItem("const_sso_token") || getCookie("const_sso_token");
  } catch {
    return null;
  }
}

function isValidConvexRefreshToken(token: unknown): token is string {
  if (typeof token !== "string" || !token.trim()) return false;
  const parts = token.split("|");
  return parts.length === 2 && Boolean(parts[0]?.length) && Boolean(parts[1]?.length);
}

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const urlRefresh = params.get("refreshToken");
    if (urlRefresh && isValidConvexRefreshToken(urlRefresh)) return urlRefresh;

    const cookieRefresh = getCookie("const_sso_refresh_token");
    if (cookieRefresh && isValidConvexRefreshToken(cookieRefresh)) return cookieRefresh;

    const localRefresh = localStorage.getItem("const_sso_refresh_token");
    if (localRefresh && isValidConvexRefreshToken(localRefresh)) return localRefresh;
  } catch {
    return null;
  }
  return null;
}

function useConvexAuthAdapter() {
  const { token, refreshSession, isLoading, isAuthenticated } = useContext(AuthContext);
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}) => {
      if (forceRefreshToken) {
        const refreshed = await refreshSession();
        if (refreshed) {
          return getStoredToken();
        }
      }
      return token;
    },
    [token, refreshSession]
  );
  return {
    isLoading,
    isAuthenticated,
    fetchAccessToken,
  };
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  const updateTokens = useCallback((newToken: string | null, newRefreshToken?: string | null) => {
    if (newToken) {
      setCookie("const_sso_token", newToken);
      try {
        localStorage.setItem("const_sso_token", newToken);
      } catch {}
      setToken(newToken);
    } else {
      deleteCookie("const_sso_token");
      try {
        localStorage.removeItem("const_sso_token");
      } catch {}
      setToken(null);
    }

    if (newRefreshToken !== undefined) {
      if (newRefreshToken && isValidConvexRefreshToken(newRefreshToken)) {
        setCookie("const_sso_refresh_token", newRefreshToken);
        try {
          localStorage.setItem("const_sso_refresh_token", newRefreshToken);
        } catch {}
        setRefreshToken(newRefreshToken);
      } else {
        deleteCookie("const_sso_refresh_token");
        try {
          localStorage.removeItem("const_sso_refresh_token");
        } catch {}
        setRefreshToken(null);
      }
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const currentRefresh = refreshToken || getStoredRefreshToken();
    if (!isValidConvexRefreshToken(currentRefresh)) {
      // Purge any corrupted refresh token
      deleteCookie("const_sso_refresh_token");
      try {
        localStorage.removeItem("const_sso_refresh_token");
      } catch {}
      setRefreshToken(null);
      return false;
    }

    try {
      const result = await convex.action(api.auth.signIn, {
        refreshToken: currentRefresh,
      });

      if (result?.tokens?.token) {
        updateTokens(result.tokens.token, result.tokens.refreshToken ?? currentRefresh);
        return true;
      }
    } catch (err) {
      console.warn("Silent token refresh failed, purging invalid refresh token:", err);
      updateTokens(token, null);
    }
    return false;
  }, [refreshToken, token, updateTokens]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Purge any existing invalid refresh tokens from localStorage and cookie
    try {
      const stored = localStorage.getItem("const_sso_refresh_token");
      if (stored && !isValidConvexRefreshToken(stored)) {
        localStorage.removeItem("const_sso_refresh_token");
        deleteCookie("const_sso_refresh_token");
      }
      const cookieVal = getCookie("const_sso_refresh_token");
      if (cookieVal && !isValidConvexRefreshToken(cookieVal)) {
        deleteCookie("const_sso_refresh_token");
      }
    } catch {}

    // 1. Check for token and refreshToken in URL query params
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const urlRefreshToken = params.get("refreshToken");

    if (urlToken) {
      updateTokens(urlToken, urlRefreshToken);

      params.delete("token");
      if (urlRefreshToken) params.delete("refreshToken");

      const newQuery = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${newQuery}`
      );

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

    // 2. Synchronize existing tokens
    const resolvedToken = getStoredToken();
    const resolvedRefresh = getStoredRefreshToken();

    if (resolvedToken) {
      updateTokens(resolvedToken, resolvedRefresh);
    }

    setIsLoading(false);
  }, [updateTokens]);

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
    setIsSigningOut(true);
    updateTokens(null, null);
    if (typeof window !== "undefined") {
      const accountsUrl = getAccountsUrl();
      const appUrl = getAppUrl();
      const targetPath = typeof destinationPath === "string" ? destinationPath : "/";
      const returnTarget = `${appUrl}${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`;
      // Perform federated SSO sign-out via Accounts Hub
      window.location.href = `${accountsUrl}/signout?continue=${encodeURIComponent(returnTarget)}`;
    }
  }, [updateTokens]);

  const authValue: AuthContextType = {
    token,
    refreshToken,
    isLoading,
    isAuthenticated: !!token,
    isSigningOut,
    signIn,
    signOut,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={authValue}>
      <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthAdapter}>
        {children}
      </ConvexProviderWithAuth>
    </AuthContext.Provider>
  );
}
