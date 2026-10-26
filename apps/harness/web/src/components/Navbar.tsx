"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ConstLogoIcon } from "@const/ui";
import { LINKS } from "@/lib/links";

const ITEMS = [
  { key: "nav.product", href: "/#capabilities" },
  { key: "nav.start", href: "/#get-started" },
  { key: "nav.features", href: "/#features" },
  { key: "nav.docs", href: LINKS.docs },
  { key: "nav.terminal", href: "/#terminal" },
  { key: "nav.changelog", href: LINKS.changelog },
] as const;

export function Navbar() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <header className="ch-header" data-scrolled={scrolled || open}>
      <a className="ch-skip-link" href="#main-content">
        {t("nav.skip")}
      </a>
      <div className="ch-header-inner">
        <Link href="/" className="ch-brand group" aria-label="Const Harness">
          <ConstLogoIcon
            size="sm"
            className="w-[26px] h-[26px] shrink-0 transition-transform group-hover:scale-105"
          />
          <span>Const Harness</span>
        </Link>
        <nav className="ch-nav" aria-label={t("nav.primary")}>
          {ITEMS.map((item) => (
            <a key={item.key} href={item.href} className="ch-nav-link">
              {t(item.key)}
            </a>
          ))}
        </nav>
        <div className="ch-header-actions">
          <ThemeToggle />
          <Link href="/download" className="ch-button ch-header-cta">
            {t("nav.cta")}
          </Link>
          <button
            type="button"
            className="ch-icon-button ch-menu-toggle"
            aria-label={t(open ? "nav.close" : "nav.menu")}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          className="ch-mobile-nav"
          id="mobile-nav"
          aria-label={t("nav.mobile")}
        >
          {ITEMS.map((item) => (
            <a key={item.key} href={item.href} onClick={() => setOpen(false)}>
              {t(item.key)}
            </a>
          ))}
          <Link href="/download" onClick={() => setOpen(false)}>
            {t("nav.cta")}
          </Link>
        </nav>
      )}
    </header>
  );
}
