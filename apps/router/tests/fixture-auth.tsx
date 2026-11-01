import type { ReactNode } from "react";
export const fixtureAuth = {
  token: "test-fixture-token",
  refreshToken: null,
  isLoading: false,
  isAuthenticated: true,
  isSigningOut: false,
  signIn: () => {},
  signOut: () => {
    window.dispatchEvent(new CustomEvent("fixture-signout"));
  },
  refreshSession: async () => true,
};
export const useRouterAuth = () => fixtureAuth;
export const ConvexClientProvider = ({ children }: { children: ReactNode }) =>
  children;
export const convex = { query: async () => null, mutation: async () => null };
