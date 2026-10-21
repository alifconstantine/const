"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import {
  ConstLogoIcon,
  Button,
  Badge,
} from "@const/ui";
import {
  ArrowRight,
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
  Radio,
  User,
  Loader2,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, signIn } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );

  useEffect(() => {
    document.title = "Const Router - Universal AI Gateway";
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <ConstLogoIcon size="md" className="w-8 h-8 text-foreground animate-pulse" />
          <p className="text-xs font-mono text-muted-foreground">
            {isAuthenticated ? "Redirecting to Dashboard..." : "Checking session..."}
          </p>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
        </div>
      </div>
    );
  }

  return (
    <>
      <title>Const Router - Universal AI Gateway</title>
      <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Floating Stadium Navigation Pill (Mobbin nav-pill pattern) */}
      <div className="fixed top-5 inset-x-4 z-50 flex justify-center pointer-events-none">
        <header className="pointer-events-auto w-full max-w-4xl h-14 rounded-full bg-card/85 border border-border/70 backdrop-blur-xl px-5 sm:px-6 flex items-center justify-between shadow-none transition-all">
          <Link href="/" className="flex items-center gap-2.5 group">
            <ConstLogoIcon
              size="md"
              className="w-7 h-7 text-foreground transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-normal tracking-tight text-foreground">
                Const
              </span>
              <span className="text-[11px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                Router
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0066ff] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0066ff]" />
              </span>
              <span>Gateway Live</span>
            </div>

            {isLoading ? (
              <div className="h-9 w-24 rounded-full bg-secondary/80 animate-pulse flex items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            ) : isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" className="rounded-full gap-2 px-4 cursor-pointer text-xs font-medium">
                  {user?.image ? (
                    <Image
                      src={user.image}
                      alt={user.name ?? "Profile"}
                      width={18}
                      height={18}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                  <span>Dashboard</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                onClick={() => signIn("/dashboard")}
                className="rounded-full gap-2 px-4 cursor-pointer text-xs font-medium"
              >
                <span>Sign In</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-36 sm:pt-48 pb-20">
        <div className="container mx-auto max-w-4xl text-center space-y-8">
          {/* Eyebrow Stadium Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-secondary/60 text-xs font-sans text-muted-foreground">
            <Radio className="h-3 w-3 text-[#0066ff] animate-pulse" />
            <span>Universal AI Gateway &amp; Smart Routing Tier</span>
          </div>

          {/* Lora Serif Heading with period cadence */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif font-normal tracking-tight text-foreground leading-[1.06]">
              One endpoint. Infinite models. <br />
              <span className="italic text-muted-foreground font-serif">Zero downtime.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground font-sans font-light leading-relaxed pt-2">
              Const Router delivers unified Pay-As-You-Go access to frontier AI models behind a single OpenAI-compatible API.
              Transparent token metering, zero-buffering SSE streaming, and custom failover combos.
            </p>
          </div>

          {/* Stadium Pill CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            {isAuthenticated ? (
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto rounded-full gap-2 text-sm font-medium px-8 cursor-pointer">
                  <span>Enter Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button
                size="lg"
                onClick={() => signIn("/dashboard")}
                className="w-full sm:w-auto rounded-full gap-2 text-sm font-medium px-8 cursor-pointer"
              >
                <span>Get Started with Const</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (isAuthenticated) {
                  window.location.href = "/dashboard";
                } else {
                  signIn("/dashboard");
                }
              }}
              className="w-full sm:w-auto rounded-full gap-2 text-sm font-medium px-7 border-border/70 text-foreground hover:bg-secondary cursor-pointer"
            >
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span>Explore Architecture</span>
            </Button>
          </div>

          {/* Architecture Cards Grid (24px Mobbin Geometry) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-16 text-left">
            {/* Pay-As-You-Go Card */}
            <div className="p-7 sm:p-8 rounded-3xl border border-border/60 bg-card space-y-4 transition-all hover:border-border">
              {/* 30% iOS Squircle Icon Frame */}
              <div className="h-12 w-12 rounded-2xl border border-border/60 bg-card flex items-center justify-center text-foreground">
                <Layers className="h-5 w-5 stroke-[1.75]" />
              </div>
              <h2 className="text-lg font-medium text-foreground tracking-tight">Pay-As-You-Go Metering</h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-light leading-relaxed">
                Metered billing with transparent token usage. One unified key across all frontier models with no external provider setup required.
              </p>
            </div>

            {/* Smart Combos Card */}
            <div className="p-7 sm:p-8 rounded-3xl border border-border/60 bg-card space-y-4 transition-all hover:border-border">
              <div className="h-12 w-12 rounded-2xl border border-border/60 bg-card flex items-center justify-center text-foreground">
                <ShieldCheck className="h-5 w-5 stroke-[1.75]" />
              </div>
              <h2 className="text-lg font-medium text-foreground tracking-tight">Custom Virtual Combos</h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-light leading-relaxed">
                Build custom multi-model failover chains with automatic cascading, priority routing, and instant anti-429 circuit breakers.
              </p>
            </div>

            {/* SSE Streaming Card */}
            <div className="p-7 sm:p-8 rounded-3xl border border-border/60 bg-card space-y-4 transition-all hover:border-border">
              <div className="h-12 w-12 rounded-2xl border border-border/60 bg-card flex items-center justify-center text-foreground">
                <Zap className="h-5 w-5 stroke-[1.75]" />
              </div>
              <h2 className="text-lg font-medium text-foreground tracking-tight">Zero-Buffering SSE</h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-light leading-relaxed">
                Direct edge stream passthrough with telemetry tracking headers: <code className="text-xs font-mono bg-muted/80 px-1.5 py-0.5 rounded-full">X-Const-Served-By</code>.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Polarity Inversion Footer (Mobbin Pattern) */}
      <footer className="w-full bg-[#141414] text-white rounded-t-[36px] border-t border-white/10 mt-16 py-12 px-6 sm:px-10">
        <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <ConstLogoIcon size="md" className="w-6 h-6 text-white" />
            <span className="font-serif text-xl font-normal tracking-tight text-white">
              Const.
            </span>
          </div>


          <p className="text-xs text-neutral-500 font-sans">
            &copy; {new Date().getFullYear()} Const Platform Ecosystem.
          </p>
        </div>
      </footer>
    </div>
  </>
);
}
