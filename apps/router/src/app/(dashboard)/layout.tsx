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
  ScrollArea,
  cn,
  toast,
} from "@const/ui";
import { Loader2, Menu, ChevronRight, CreditCard, Plus, BookOpen } from "lucide-react";

class SafeCreditBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? <CreditBalanceLink value="Unavailable" /> : this.props.children; }
}
function CreditBalanceLink({ value }: { value: string }) {
  return <Link href="/credits" aria-label={"Credit balance: " + value} className="inline-flex h-11 sm:h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium tabular-nums transition-colors hover:bg-secondary">
    <CreditCard className="size-3.5 text-muted-foreground" /><span>{value}</span>
  </Link>;
}
function HeaderCreditBalance() {
  const { isAuthenticated } = useRouterAuth();
  const credits = useQuery(api.router.credits.getUserCredits, isAuthenticated ? {} : "skip");
  const balance = typeof credits?.balanceUsd === "number" ? credits.balanceUsd : 0;
  const value = !credits ? "…" : balance > 0 && balance < .0001 ? "<$0.0001" : "$" + balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: balance < 1 ? 4 : 2 });
  return <CreditBalanceLink value={value} />;
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
const MOBILE_ROUTE_TITLES: Record<string, string> = {
  "/credits": "Credits", "/deposit": "Credits", "/models": "Models", "/settings": "Settings",
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
          <p className="text-xs tabular-nums text-muted-foreground">
            {isSigningOut
              ? "Signing out of Const Platform..."
              : "Connecting to Const Accounts..."}
          </p>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
        </div>
      </div>
    );
  }

  return <DashboardShell currentTitle={currentTitle} isGeneration={isGeneration}>{children}</DashboardShell>;
}

export function DashboardShell({ children, currentTitle = "Overview", isGeneration = false }: {
  children: React.ReactNode; currentTitle?: string; isGeneration?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);
  return <div className="router-shell flex h-dvh w-full min-w-0 overflow-hidden bg-background text-foreground">
    <title>{currentTitle + " - Const Router"}</title>
    <a href="#router-main" className="router-skip-link">Skip to content</a>
    <div className={cn("hidden h-full shrink-0 border-r border-sidebar-border bg-sidebar md:block transition-[width] duration-200 motion-reduce:transition-none", isCollapsed ? "w-[72px]" : "w-[236px]")}>
      <Sidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(value => !value)} />
    </div>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[min(300px,calc(100vw-32px))] border-0 bg-sidebar p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Sidebar onNavigate={() => setMobileOpen(false)} onToggleCollapse={() => setMobileOpen(false)} />
      </SheetContent>
    </Sheet>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-2.5 text-sm">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="size-11 shrink-0 md:hidden" aria-label="Open navigation"><Menu className="size-4" /></Button>
          <span className="hidden text-muted-foreground lg:inline">Workspace</span><ChevronRight className="hidden size-3 text-muted-foreground lg:inline" />
          <span className="truncate font-medium"><span className="sm:hidden">{MOBILE_ROUTE_TITLES[pathname || ""] || currentTitle}</span><span className="hidden sm:inline">{currentTitle}</span></span>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/docs" className="hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground lg:flex"><BookOpen className="size-3.5" />Docs</Link>
          <div className="hidden sm:block"><ThemeToggle /></div>
          <SafeCreditBoundary><HeaderCreditBalance /></SafeCreditBoundary>
          <Button asChild size="sm" className="size-11 shrink-0 gap-1.5 rounded-lg p-0 text-xs sm:h-9 sm:w-auto sm:px-3"><Link href="/keys" aria-label="Create API key"><Plus className="size-3.5" /><span className="hidden sm:inline">Create key</span></Link></Button>
        </div>
      </header>
      <main id="router-main" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
        {isGeneration ? children : <ScrollArea className="min-h-0 flex-1"><div className="router-page-content">{children}</div></ScrollArea>}
      </main>
    </div>
  </div>;
}
