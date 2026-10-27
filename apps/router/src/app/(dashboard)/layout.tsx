"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ConstLogoIcon,
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  cn,
  toast,
} from "@const/ui";
import { Loader2, Menu, Bell, CreditCard } from "lucide-react";

// Safe Error Boundary to prevent any credit query failure from crashing the dashboard
class SafeCreditBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    // Gracefully handle server query errors
  }
  render() {
    if (this.state.hasError) {
      return (
        <Link href="/credits">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs font-mono font-medium px-2 sm:px-3 bg-secondary/50 border-border/60 hover:bg-secondary cursor-pointer gap-1.5 transition-colors"
          >
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Balance unavailable</span>
            <span className="sm:hidden">—</span>
          </Button>
        </Link>
      );
    }
    return this.props.children;
  }
}

function HeaderCreditBalance() {
  const { isAuthenticated } = useRouterAuth();
  const credits = useQuery(
    api.router.credits.getUserCredits,
    isAuthenticated ? {} : "skip",
  );
  const balance =
    typeof credits?.balanceUsd === "number" ? credits.balanceUsd : 0;

  return (
    <Link href="/credits">
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-lg text-xs font-mono font-medium px-2 sm:px-3 bg-secondary/50 border-border/60 hover:bg-secondary cursor-pointer gap-1.5 transition-colors"
      >
        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{credits ? `$${balance.toFixed(4)}` : "..."}</span>
      </Button>
    </Link>
  );
}

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/logs": "Usage logs",
  "/keys": "API Keys",
  "/endpoints": "Endpoints",
  "/combos": "Combos",
  "/models": "Models & Pricing",
  "/generation": "Playground",
  "/credits": "Credits & balance",
  "/deposit": "Credits & balance",
  "/settings": "Settings & data",
  "/docs": "Documentation",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, isSigningOut, signIn, refreshSession } =
    useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState(false);

  const currentTitle = useMemo(() => {
    if (!pathname || pathname === "/" || pathname === "/dashboard")
      return "Overview";
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
    for (const [route, title] of Object.entries(ROUTE_TITLES)) {
      if (pathname.startsWith(`${route}/`)) return title;
    }
    return "Dashboard";
  }, [pathname]);

  const isGeneration = useMemo(() => {
    return (
      pathname === "/generation" ||
      Boolean(pathname?.startsWith("/generation/"))
    );
  }, [pathname]);

  useEffect(() => {
    document.title = `${currentTitle} - Const Router`;
  }, [currentTitle]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isSigningOut) {
      const destination =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search || ""}`
          : pathname || "/dashboard";
      signIn(destination);
    }
  }, [isLoading, isAuthenticated, isSigningOut, signIn, pathname]);

  useEffect(() => {
    if (isAuthenticated && user === null && !isSigningOut) {
      if (!hasAttemptedRefresh) {
        setHasAttemptedRefresh(true);
        void refreshSession().then((refreshed) => {
          if (!refreshed) {
            const destination =
              typeof window !== "undefined"
                ? `${window.location.pathname}${window.location.search || ""}`
                : pathname || "/dashboard";
            toast.error("Session Reconnect Needed", {
              description: "Could not restore session. Please sign in again.",
              action: {
                label: "Sign In",
                onClick: () => signIn(destination),
              },
            });
          }
        });
      }
    }
  }, [
    isAuthenticated,
    user,
    isSigningOut,
    hasAttemptedRefresh,
    refreshSession,
    signIn,
    pathname,
  ]);

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2
          className="h-5 w-5 animate-spin"
          aria-label="Verifying session"
        />
      </div>
    );

  // Unauthenticated / Signing Out Fallback
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <ConstLogoIcon
            size="md"
            className="w-8 h-8 text-foreground animate-pulse"
          />
          <p className="text-xs font-mono text-muted-foreground">
            {isSigningOut
              ? "Signing out of Const Platform..."
              : "Connecting to Const Accounts..."}
          </p>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
        </div>
      </div>
    );
  }

  return (
    <>
      <title>{`${currentTitle} - Const Router`}</title>
      <div
        className={cn(
          "flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground",
        )}
      >
        {/* Full-height Desktop Left Sidebar */}
        <div
          className={cn(
            "hidden md:block shrink-0 transition-all duration-300 bg-sidebar border-r border-border/70 h-full",
            isCollapsed ? "w-16" : "w-64",
          )}
        >
          <Sidebar
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          />
        </div>

        {/* Mobile Slide-out Drawer */}
        <div className="md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent
              side="left"
              className="p-0 w-64 border-none bg-sidebar"
              showCloseButton={false}
            >
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <Sidebar
                onNavigate={() => setMobileOpen(false)}
                onToggleCollapse={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
          {/* Top Page Heading Bar: Mobile Menu + Brand (Left) + ThemeToggle, Notif, Credit, Create Key (Right) */}
          <header className="h-14 w-full border-b border-border/70 bg-card/60 backdrop-blur sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between shrink-0 select-none transition-colors">
            {/* Left: Mobile Menu Toggle + Mobile Brand Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(true)}
                className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </Button>

              <Link
                href="/dashboard"
                className="md:hidden flex items-center gap-2 group min-w-0"
              >
                <ConstLogoIcon
                  size="sm"
                  className="w-5 h-5 text-foreground shrink-0 transition-transform duration-300 group-hover:scale-105"
                />
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-serif text-base font-normal tracking-tight text-foreground">
                    Const
                  </span>
                  <span className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground border border-border">
                    Router
                  </span>
                </div>
              </Link>
            </div>

            {/* Right: Controls & Actions */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              <ThemeToggle />

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="View quota and notification settings"
                onClick={() => {
                  window.location.href = "/settings";
                }}
              >
                <Bell className="h-4 w-4 stroke-[1.75]" />
              </Button>

              {/* Credit Balance Pill linking to /credits (Protected by SafeCreditBoundary) */}
              <SafeCreditBoundary>
                <HeaderCreditBalance />
              </SafeCreditBoundary>

              <Link href="/keys">
                <Button
                  size="sm"
                  className="h-8 rounded-lg text-xs font-medium px-2.5 sm:px-3.5 bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-xs transition-colors shrink-0"
                >
                  <span className="hidden sm:inline">Create API key</span>
                  <span className="sm:hidden">+ Key</span>
                </Button>
              </Link>
            </div>
          </header>

          {/* Page Content Viewport */}
          <main
            className={cn(
              "flex-1 min-w-0 w-full overflow-y-auto",
              isGeneration
                ? "p-0 overflow-hidden flex flex-col h-full"
                : "p-4 sm:p-6 md:p-8",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
