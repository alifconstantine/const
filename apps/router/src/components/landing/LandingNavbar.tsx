"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConstLogoIcon } from "@const/ui";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
const links = [
  { href: "/#models", label: "Models & pricing" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/#features", label: "Why Const" },
  { href: "/#start", label: "Integration" },
  { href: "/docs", label: "Docs" },
];
export function LandingNavbar() {
  const { isAuthenticated, isLoading, signIn } = useRouterAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="router-navbar">
      <a className="router-skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="router-container router-nav-inner">
        <Link href="/" className="router-brand" aria-label="Const Router home">
          <ConstLogoIcon size="md" />
          <span>
            Const<span className="router-brand-product">Router</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="router-desktop-nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="router-nav-actions">
          {isLoading ? (
            <span
              className="router-auth-loading"
              aria-label="Loading account"
            />
          ) : isAuthenticated ? (
            <Link href="/dashboard" className="router-nav-cta">
              Dashboard
              <ArrowUpRight size={15} />
            </Link>
          ) : (
            <button
              onClick={() => signIn("/dashboard")}
              className="router-nav-cta"
            >
              Sign in
              <ArrowUpRight size={15} />
            </button>
          )}
          <button
            className="router-menu-toggle"
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="router-mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="router-mobile-nav"
          className="router-mobile-nav"
          aria-label="Mobile navigation"
        >
          {links.map((link) => (
            <Link
              href={link.href}
              key={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
