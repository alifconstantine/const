import React, { createContext, useContext, useCallback, ReactNode } from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

const convexUrl =
  (import.meta.env.VITE_CONVEX_URL as string) ||
  (import.meta.env.NEXT_PUBLIC_CONVEX_URL as string) ||
  "https://wooden-alpaca-210.convex.cloud";

export const convex = new ConvexReactClient(convexUrl);

interface AuthContextType {
  token: string | null;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  signOut: () => {},
});

export function useAppAuth() {
  return useContext(AuthContext);
}

function useConvexAuthAdapter() {
  const { token } = useContext(AuthContext);
  const fetchAccessToken = useCallback(async () => token, [token]);
  return {
    isLoading: false,
    isAuthenticated: !!token,
    fetchAccessToken,
  };
}

export function ConvexClientProvider({
  token,
  signOut,
  children,
}: {
  token: string | null;
  signOut: () => void;
  children: ReactNode;
}) {
  return (
    <AuthContext.Provider value={{ token, signOut }}>
      <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthAdapter}>
        {children}
      </ConvexProviderWithAuth>
    </AuthContext.Provider>
  );
}
