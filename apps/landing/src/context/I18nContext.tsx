'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Locale = 'en' | 'id';

export interface Translations {
  nav: {
    accounts: string;
    learn: string;
    router: string;
    toggleTheme: string;
  };
  hero: {
    headline: string;
    lead: string;
    subheadings: string[];
    ctaLearn: string;
    ctaAccounts: string;
  };
  footer: {
    copyright: string;
    privacy: string;
    terms: string;
    langLabel: string;
  };
}

const translations: Record<Locale, Translations> = {
  en: {
    nav: {
      accounts: 'Const Accounts',
      learn: 'Const Learn',
      router: 'Const Router',
      toggleTheme: 'Toggle theme',
    },
    hero: {
      headline: 'Understand Anything',
      lead: 'The active AI research and interactive learning studio for students, researchers, and developers.',
      subheadings: [
        'Turn raw text into AI video summaries',
        'Convert complex notes into presentation slides',
        'Transform documents into interactive simulations',
        'Think deeper with Socratic AI dialogue',
        'Visualize mathematical models and live code',
      ],
      ctaLearn: 'Explore Const Learn',
      ctaAccounts: 'Sign In / Accounts',
    },
    footer: {
      copyright: '© 2026 Const Platform. All rights reserved.',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      langLabel: 'Language',
    },
  },
  id: {
    nav: {
      accounts: 'Const Accounts',
      learn: 'Const Learn',
      router: 'Const Router',
      toggleTheme: 'Ganti tema',
    },
    hero: {
      headline: 'Pahami Segalanya',
      lead: 'Studio riset AI aktif dan pembelajaran interaktif untuk pelajar, peneliti, dan pengembang.',
      subheadings: [
        'Ubah teks mentah menjadi ringkasan video AI',
        'Ubah catatan rumit menjadi slide presentasi',
        'Ubah dokumen menjadi simulasi interaktif',
        'Berpikir lebih mendalam dengan dialog Sokrates AI',
        'Visualisasikan model matematika dan kode langsung',
      ],
      ctaLearn: 'Jelajahi Const Learn',
      ctaAccounts: 'Masuk / Akun',
    },
    footer: {
      copyright: '© 2026 Const Platform. Hak cipta dilindungi.',
      privacy: 'Kebijakan Privasi',
      terms: 'Syarat & Ketentuan',
      langLabel: 'Bahasa',
    },
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem('const_locale') as Locale | null;
    if (saved === 'en' || saved === 'id') {
      setLocaleState(saved);
    } else {
      const navLang = navigator.language.toLowerCase();
      if (navLang.startsWith('id')) {
        setLocaleState('id');
      }
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('const_locale', l);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
