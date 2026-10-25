"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { useQuery } from "convex/react";
import { api } from "@const/backend/_generated/api";
import { ConstLogoIcon, Button } from "@const/ui";
import { ArrowRight, User, Menu, X } from "lucide-react";

export function LandingNavbar() {
  const { isAuthenticated, isLoading, signIn } = useRouterAuth();
  const user = useQuery(
    api.auth.queries.currentUser,
    isAuthenticated ? {} : "skip"
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <ConstLogoIcon
            size="md"
            className="w-7 h-7 text-white transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex items-center gap-2">
            <span className="font-sans text-base font-semibold tracking-tight text-white">
              Const
            </span>
            <span className="text-[11px] font-sans font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-[#171717] text-[#969696] border border-[#262626]">
              Router
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6 text-sm">
          <a href="#models" className="text-[#a3a3a3] hover:text-white transition-colors">
            Models
          </a>
          <a href="#features" className="text-[#a3a3a3] hover:text-white transition-colors">
            Features
          </a>
          <a href="#start" className="text-[#a3a3a3] hover:text-white transition-colors">
            Integration
          </a>
          <a href="#pricing" className="text-[#a3a3a3] hover:text-white transition-colors">
            Pricing
          </a>
          <Link href="/docs" className="text-[#a3a3a3] hover:text-white transition-colors">
            Docs
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {isLoading ? (
            <div className="h-9 w-24 rounded-full bg-[#171717] animate-pulse" />
          ) : isAuthenticated ? (
            <Link href="/dashboard">
              <Button
                size="sm"
                className="rounded-full gap-2 px-4 bg-white text-[#0a0a0a] hover:bg-[#eaeaea] text-xs font-medium cursor-pointer shadow-none"
              >
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
              className="rounded-full gap-2 px-4 bg-white text-[#0a0a0a] hover:bg-[#eaeaea] text-xs font-medium cursor-pointer shadow-none"
            >
              <span>Sign In</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#969696] hover:text-white hover:bg-[#171717] transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#262626] bg-[#0a0a0a] px-4 py-4 space-y-3 text-sm">
          <a
            href="#models"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#a3a3a3] hover:text-white"
          >
            Models
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#a3a3a3] hover:text-white"
          >
            Features
          </a>
          <a
            href="#start"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#a3a3a3] hover:text-white"
          >
            Integration
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#a3a3a3] hover:text-white"
          >
            Pricing
          </a>
          <Link
            href="/docs"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#a3a3a3] hover:text-white"
          >
            Docs
          </Link>
          <div className="pt-2 border-t border-[#262626] flex items-center justify-end">
            {isAuthenticated ? (
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="rounded-full bg-white text-[#0a0a0a] text-xs">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signIn("/dashboard");
                }}
                className="rounded-full bg-white text-[#0a0a0a] text-xs"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
