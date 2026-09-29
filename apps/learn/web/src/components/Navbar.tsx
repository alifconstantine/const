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
            {/* Const Learn Logo matching apps/learn/desktop */}
            <div className="logo-container astro-nen7h5rs">
              <Link
                className="logo-link astro-nen7h5rs flex items-center gap-2.5 text-foreground no-underline select-none group"
                href="/"
                aria-label="Const Learn"
                data-logo-link=""
              >
                <ConstLogoIcon size="sm" className="w-6 h-6 text-foreground shrink-0 transition-transform group-hover:scale-105" />
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-normal tracking-tight text-foreground">
                    Const
                  </span>
                  <span className="text-[10px] font-sans font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                    Learn
                  </span>
                </div>
              </Link>
            </div>

            {/* Right Header Controls: Animated Theme Toggle & Download Button */}
            <div className="header-actions astro-nen7h5rs !w-auto !justify-end !flex ml-auto">
              <div className="header-cta-group astro-nen7h5rs flex items-center gap-3">
                {/* Animated Theme Toggle */}
                <AnimatedThemeToggle />

                {/* Download CTA Button */}
                <Link
                  href="/download"
                  className="download-cta-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-neutral-800 dark:!bg-white dark:!text-black dark:hover:!bg-neutral-200 transition-all duration-200 select-none shadow-none"
                  data-analytics-event="download-cta"
                >
                  <span>{t.nav.download}</span>
                  <span className="dropdown-icon" translate="no">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M12 16L7 11L8.4 9.55L11 12.15V4H13V12.15L15.6 9.55L17 11L12 16ZM6 20C5.45 20 4.979 19.804 4.588 19.413C4.196 19.021 4.00067 18.55 4 18V15H6V18H18V15H20V18C20 18.55 19.804 19.021 19.413 19.413C19.021 19.804 18.55 20 18 20H6Z"></path>
                    </svg>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="dropdown-overlay astro-nen7h5rs" data-dropdown-overlay="" />
    </>
  );
}
