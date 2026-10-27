'use client';

import React from 'react';
import Link from 'next/link';
import { ConstLogoIcon } from '@const/ui';
import { useI18n } from '../context/I18nContext';

export default function Footer() {
  const { t, locale, setLocale } = useI18n();

  return (
    <footer className="w-full border-t border-border/40 bg-background/80 backdrop-blur-md transition-colors py-10 z-20 relative">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
        {/* Brand & Copyright */}
        <div className="flex items-center gap-3">
          <ConstLogoIcon size="sm" className="w-5 h-5 text-foreground shrink-0" />
          <span>{t.footer.copyright}</span>
        </div>

        {/* Legal Links for Google OAuth Platform */}
        <div className="flex items-center gap-6">
          <Link
            href="/privacy-policy"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            {t.footer.privacy}
          </Link>
          <span className="text-border" aria-hidden="true">•</span>
          <Link
            href="/terms-of-service"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            {t.footer.terms}
          </Link>
          <span className="text-border" aria-hidden="true">•</span>
          {/* Language toggle */}
          <button
            type="button"
            onClick={() => setLocale(locale === 'en' ? 'id' : 'en')}
            className="font-mono text-xs uppercase hover:text-foreground transition-colors px-2 py-1 rounded border border-border/50"
            title="Toggle language"
          >
            {locale === 'en' ? 'ID' : 'EN'}
          </button>
        </div>
      </div>
    </footer>
  );
}
