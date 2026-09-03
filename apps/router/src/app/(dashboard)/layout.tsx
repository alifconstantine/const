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
  Card,
  Sheet,
  SheetContent,
  SheetTitle,
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
  const { isAuthenticated, isLoading, signIn, signOut } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast.info("Authentication Required", {
        description: "Redirecting to Const Accounts login...",
      });
      const timer = setTimeout(() => {
        signIn("/dashboard");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, signIn]);

  useEffect(() => {
    if (isAuthenticated && user === null) {
      toast.error("Session Expired", {
        description: "Your session has expired. Redirecting to login...",
      });
      const timer = setTimeout(() => {
        signOut();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, signOut]);

  // Loading State
  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <ConstLogoIcon size="lg" className="w-12 h-12 text-foreground animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-medium text-foreground">
              Verifying Const SSO Session
            </h2>
            <p className="text-xs font-mono text-muted-foreground">
              Connecting to Convex Cloud &amp; Accounts Hub...
            </p>
          </div>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2" />
        </div>
      </div>
    );
  }

  // Unauthenticated Fallback
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <Card className="max-w-md w-full border-border/70 bg-card text-center p-8 space-y-6 rounded-3xl shadow-none">
          <div className="flex justify-center">
            <ConstLogoIcon size="lg" className="w-12 h-12 text-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-medium text-foreground">Sign in required.</h1>
            <p className="text-xs text-muted-foreground font-light">
              You need an active Const Platform session to access the Router Dashboard.
            </p>
          </div>
          <Button
            onClick={() => signIn("/dashboard")}
            className="w-full rounded-full gap-2 cursor-pointer h-11 text-sm font-medium"
          >
            <span>Proceed to Const Accounts</span>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Top Heading Bar (Logo is monochrome text-foreground, NOT blue) */}
      <header className="h-14 w-full border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-40 px-4 flex items-center justify-between shrink-0 transition-colors">
        {/* Left: Monochrome Logo & Brand Title */}
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
              className="w-6 h-6 text-foreground transition-transform group-hover:scale-105"
            />
            <span className="font-semibold text-sm tracking-tight text-foreground">
              Const Router
            </span>
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
        {/* Desktop Left Sidebar (Underneath top heading bar) */}
        <div className="hidden md:block w-64 shrink-0">
          <div className="h-[calc(100vh-3.5rem)] sticky top-14">
            <Sidebar />
          </div>
        </div>

        {/* Mobile Slide-out Drawer */}
        <div className="md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 w-64 border-r border-border/70 bg-card">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Page Content Viewport */}
        <main className="flex-1 min-w-0 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
