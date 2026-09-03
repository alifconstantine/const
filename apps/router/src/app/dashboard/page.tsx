"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  ConstLogoIcon,
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  toast,
} from "@const/ui";
import {
  LogOut,
  User,
  Mail,
  Shield,
  Layers,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Server,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  const { isAuthenticated, isLoading, signIn, signOut } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );

  useEffect(() => {
    // If auth state resolved and definitely unauthenticated, redirect to Accounts SSO
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
    // If token is present but backend explicitly returned null user (expired/invalid session)
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
            <div className="absolute -bottom-1 -right-1">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0066ff] opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#0066ff]" />
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-serif font-normal text-foreground">
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
        <Card className="max-w-md w-full border-border/60 bg-card text-center p-8 space-y-6 rounded-3xl shadow-none">
          <div className="flex justify-center">
            <ConstLogoIcon size="lg" className="w-12 h-12 text-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-serif text-foreground">Sign in required.</h1>
            <p className="text-xs text-muted-foreground font-light">
              You need an active Const Platform session to access the Router Dashboard.
            </p>
          </div>
          <Button
            onClick={() => signIn("/dashboard")}
            className="w-full rounded-full gap-2 cursor-pointer h-12 text-sm font-medium"
          >
            <span>Proceed to Const Accounts</span>
          </Button>
        </Card>
      </div>
    );
  }

  const userInitial = user?.name ? user.name[0]?.toUpperCase() : "U";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Floating Stadium Navigation Pill */}
      <div className="sticky top-4 z-40 px-4 sm:px-6 w-full flex justify-center">
        <header className="w-full max-w-5xl h-14 rounded-full bg-card/85 dark:bg-[#161616]/90 border border-border/70 backdrop-blur-xl px-5 sm:px-6 flex items-center justify-between shadow-none transition-all">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors mr-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <ConstLogoIcon size="md" className="w-6 h-6 text-foreground" />
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-normal tracking-tight text-foreground">
                Const Router
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                Dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => signIn("/dashboard", { switchAccount: true })}
              className="rounded-full text-xs font-medium border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer px-3.5 h-9"
            >
              Switch Account
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut("/")}
              className="rounded-full gap-2 text-xs font-medium border-border/70 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors cursor-pointer px-4 h-9"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </header>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Welcome Banner (24px Mobbin Geometry) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-7 sm:p-8 rounded-3xl border border-border/60 bg-secondary/40 dark:bg-[#161616] transition-all">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-500 font-medium">
                Authenticated Session
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-normal text-foreground tracking-tight">
              Welcome back, {user?.name || user?.email?.split("@")[0] || "Developer"}.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-light leading-relaxed">
              Your account is successfully synced across the Const Platform Ecosystem.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 py-1.5 px-3.5 text-xs font-sans rounded-full bg-card border-border/70">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>SSO Active</span>
            </Badge>
          </div>
        </div>

        {/* User Profile & System Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Identity & Profile Overview (24px Container) */}
          <Card className="md:col-span-2 border-border/60 bg-card rounded-3xl p-0 overflow-hidden shadow-none">
            <CardHeader className="p-7 sm:p-8 pb-4">
              <CardTitle className="text-lg font-serif font-normal text-foreground flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center text-foreground">
                  <User className="h-4 w-4" />
                </div>
                <span>User Profile</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-light">
                Authentication and identity credentials managed by Const Accounts.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-7 sm:p-8 pt-0 space-y-6">
              <div className="flex items-center gap-4 pt-2">
                {user?.image ? (
                  <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-border/80 ring-2 ring-background">
                    <Image
                      src={user.image}
                      alt={user.name ?? "User Avatar"}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-secondary border-2 border-border/80 flex items-center justify-center font-serif text-2xl text-foreground">
                    {userInitial}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-medium text-foreground tracking-tight">
                      {user?.name || "Unnamed User"}
                    </h2>
                    {user?.role && (
                      <span className="rounded-full bg-foreground text-background px-2.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider font-mono">
                        {user.role}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-sans flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground/80" />
                    <span>{user?.email || "No email available"}</span>
                  </p>
                </div>
              </div>

              {/* Data Fields with Soft Neutral Tint Fills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                <div className="space-y-1.5 p-4 rounded-2xl bg-secondary/50 dark:bg-[#161616] border border-border/40">
                  <span className="text-muted-foreground font-light">User ID:</span>
                  <p className="font-mono text-foreground break-all text-[11px] pt-0.5">
                    {user?._id || "Loading..."}
                  </p>
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-secondary/50 dark:bg-[#161616] border border-border/40">
                  <span className="text-muted-foreground font-light">Role &amp; Permissions:</span>
                  <p className="font-sans text-foreground flex items-center gap-1.5 text-xs pt-0.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{user?.role === "admin" ? "Platform Administrator" : "Standard Developer"}</span>
                  </p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-7 sm:p-8 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-2 font-mono text-[11px]">
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Backend: Convex Cloud</span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signIn("/dashboard", { switchAccount: true })}
                  className="rounded-full text-xs text-muted-foreground hover:text-foreground cursor-pointer h-8 px-3"
                >
                  Switch Account
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut("/")}
                  className="rounded-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer h-8 px-3"
                >
                  Sign Out
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* Quick Info & Ecosystem Status (24px Container) */}
          <Card className="border-border/60 bg-secondary/40 dark:bg-[#161616] rounded-3xl p-0 flex flex-col justify-between shadow-none">
            <div>
              <CardHeader className="p-7 pb-4">
                <CardTitle className="text-lg font-serif font-normal text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#0066ff]" />
                  <span>Router Engine</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-light">
                  Status &amp; Architecture Modules
                </CardDescription>
              </CardHeader>

              <CardContent className="p-7 pt-0 space-y-4 text-xs text-muted-foreground">
                <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-2.5 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">SSO Provider</span>
                    <span className="font-mono text-emerald-500 text-[11px]">Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">Framework</span>
                    <span className="font-mono text-muted-foreground text-[11px]">Next.js 16</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">Design System</span>
                    <span className="font-mono text-muted-foreground text-[11px]">Const (Mobbin)</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1 font-sans">
                  <p className="text-foreground font-medium">Upcoming Features:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground font-light">
                    <li>API Keys Management (<code className="font-mono text-[10px]">sk-const-xxx</code>)</li>
                    <li>Tri-Rail Provider Connectors</li>
                    <li>Virtual Combos &amp; Fallbacks</li>
                    <li>Real-time SSE Playground</li>
                  </ul>
                </div>
              </CardContent>
            </div>

            <CardFooter className="p-7 pt-4 border-t border-border/40">
              <Link href="/" className="w-full">
                <Button variant="outline" size="sm" className="w-full rounded-full text-xs font-medium border-border/70 cursor-pointer h-10">
                  Back to Gateway Home
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
