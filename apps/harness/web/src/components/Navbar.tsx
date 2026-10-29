"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ConstLogoIcon } from "@const/ui";
import { LINKS } from "@/lib/links";

const ITEMS = [
  { key: "nav.product", href: "/product" },
  { key: "nav.integrations", href: "/integrations" },
  { key: "nav.ecosystem", href: "/ecosystem" },
  { key: "nav.docs", href: LINKS.docs },
] as const;

export function Navbar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (document.activeElement?.closest("#mobile-nav"))
          menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <header
      className="ch-header"
      data-scrolled={scrolled || open || pathname !== "/"}
    >
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
          {ITEMS.map((item) => {
            const isExternal = item.href.startsWith("http");
            return (
              <Link
                key={item.key}
                href={item.href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="ch-nav-link"
                aria-current={
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "page"
                    : undefined
                }
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="ch-header-actions">
          <ThemeToggle />
          <Link href="/download" className="ch-button ch-header-cta">
            {t("nav.cta")}
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="ch-icon-button ch-menu-toggle"
            aria-label={t(open ? "nav.close" : "nav.menu")}
            aria-expanded={open}
            aria-controls={open ? "mobile-nav" : undefined}
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
          {ITEMS.map((item) => {
            const isExternal = item.href.startsWith("http");
            return (
              <Link
                key={item.key}
                href={item.href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                onClick={() => setOpen(false)}
                aria-current={
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "page"
                    : undefined
                }
              >
                {t(item.key)}
              </Link>
            );
          })}
          <Link href="/download" onClick={() => setOpen(false)}>
            {t("nav.cta")}
          </Link>
        </nav>
      )}
    </header>
  );
}
