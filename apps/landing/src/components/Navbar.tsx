'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ConstLogoIcon } from '@const/ui';
import { AnimatedThemeToggle } from '@/components/ui/animated-theme-toggle';
import { useI18n } from '../context/I18nContext';

export default function Navbar() {
  const { t } = useI18n();

  useEffect(() => {
    if (!document.querySelector('script[src*="Header.astro"]')) {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = '/_astro/Header.astro_astro_type_script_index_0_lang.D5zBpq-T.js';
      document.body.appendChild(s);
    }
  }, []);

  return (
    <>
      <header
        data-analytics-nav="header"
        className="header astro-nen7h5rs fixed top-0 left-0 right-0 z-50 transition-all duration-200"
        data-scroll-reactive="true"
        data-opaque="false"
        data-header=""
      >
        <div className="grid-container astro-nen7h5rs max-w-7xl mx-auto px-6 py-4">
          <div className="main-content astro-nen7h5rs flex items-center justify-between w-full">
            {/* Const Logo */}
            <div className="logo-container astro-nen7h5rs">
              <Link
                className="logo-link astro-nen7h5rs flex items-center gap-2.5 text-foreground no-underline select-none group"
                href="/"
                aria-label="Const"
                data-logo-link=""
              >
                <ConstLogoIcon size="sm" className="w-6 h-6 text-foreground shrink-0 transition-transform group-hover:scale-105" />
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-normal tracking-tight text-foreground">
                    Const
                  </span>
                </div>
              </Link>
            </div>

            {/* Middle Nav Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <a
                href="https://learn.const.web.id"
                className="hover:text-foreground transition-colors"
              >
                Learn
              </a>
              <a
                href="https://accounts.const.web.id"
                className="hover:text-foreground transition-colors"
              >
                Accounts
              </a>
              <a
                href="https://router.const.web.id"
                className="hover:text-foreground transition-colors"
              >
                Router
              </a>
            </nav>

            {/* Right Header Controls: Animated Theme Toggle & Sign In */}
            <div className="header-actions astro-nen7h5rs !w-auto !justify-end !flex ml-auto items-center gap-3">
              <AnimatedThemeToggle />

              <a
                href="https://accounts.const.web.id"
                className="download-cta-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-neutral-800 dark:!bg-white dark:!text-black dark:hover:!bg-neutral-200 transition-all duration-200 select-none shadow-none"
              >
                <span>{t.hero.ctaAccounts}</span>
              </a>
            </div>
          </div>
        </div>
      </header>
      <div className="dropdown-overlay astro-nen7h5rs" data-dropdown-overlay="" />
    </>
  );
}
