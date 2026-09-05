"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  Loader2,
  Menu,
  Bell,
  BookOpen,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, isSigningOut, signIn, signOut, refreshSession } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isSigningOut) {
      signIn("/dashboard");
    }
  }, [isLoading, isAuthenticated, isSigningOut, signIn]);

  useEffect(() => {
    if (isAuthenticated && user === null && !isSigningOut) {
      if (!hasAttemptedRefresh) {
        setHasAttemptedRefresh(true);
        void refreshSession().then((refreshed) => {
          if (!refreshed) {
            toast.error("Session Expired", {
              description: "Your session has expired. Reconnecting...",
            });
            setTimeout(() => {
              signIn("/dashboard");
            }, 800);
          }
        });
      } else {
        toast.error("Session Expired", {
          description: "Your session has expired. Reconnecting...",
        });
        const timer = setTimeout(() => {
          signIn("/dashboard");
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, user, isSigningOut, hasAttemptedRefresh, refreshSession, signIn]);

  // Unauthenticated / Signing Out Fallback
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <ConstLogoIcon size="md" className="w-8 h-8 text-foreground animate-pulse" />
          <p className="text-xs font-mono text-muted-foreground">
            {isSigningOut ? "Signing out of Const Platform..." : "Connecting to Const Accounts..."}
          </p>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Top Header Bar matching apps/learn brand UI & DESIGN.md */}
      <header className="h-14 w-full border-b border-border/70 bg-background/95 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none transition-colors">
        {/* Left: Const Logo & Product Badge (Matching apps/learn) */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Open sidebar navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <ConstLogoIcon
              size="sm"
              className="w-6 h-6 text-foreground shrink-0 transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-normal tracking-tight text-foreground">
                Const
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                Router
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 stroke-[1.75]" />
          </Button>

          <ThemeToggle />

          <Link href="/endpoints">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs font-medium px-4 border-border/70 text-foreground hover:bg-secondary cursor-pointer gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Docs</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Layout: Left Sidebar + Content Area */}
      <div className="flex-1 flex min-w-0">
        {/* Desktop Left Sidebar (Collapsible with smooth transition) */}
        <div
          className={cn(
            "hidden md:block shrink-0 transition-all duration-300",
            isCollapsed ? "w-16" : "w-64"
          )}
        >
          <div className="h-[calc(100vh-3.5rem)] sticky top-14">
            <Sidebar
              isCollapsed={isCollapsed}
              onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />
          </div>
        </div>

        {/* Mobile Slide-out Drawer */}
        <div className="md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 w-64 border-none bg-card">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <Sidebar
                onNavigate={() => setMobileOpen(false)}
                onToggleCollapse={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Page Content Viewport */}
        <main className="flex-1 min-w-0 p-6 md:p-8 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
