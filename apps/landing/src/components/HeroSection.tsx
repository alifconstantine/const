'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../context/I18nContext';

export default function HeroSection() {
  const { t, locale } = useI18n();
  const { theme, resolvedTheme } = useTheme();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Rotating main headlines list: primary headline + capabilities
  const headlines = [t.hero.headline, ...t.hero.subheadings];

  // Rotate main display heading
  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % headlines.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [headlines.length]);

  // Load MainParticlesComponent script
  useEffect(() => {
    const existing = document.querySelector('script[src*="MainParticlesComponent"]');
    if (!existing) {
      const initScript = document.createElement('script');
      initScript.type = 'module';
      initScript.src = '/_astro/MainParticlesComponent.astro_astro_type_script_index_0_lang.ZV8AJEPG.js?v=4';
      initScript.onload = () => {
        setTimeout(() => {
          if (typeof (window as any).setAllParticlesTheme === 'function') {
            const currentDark =
              document.documentElement.classList.contains('dark') ||
              document.documentElement.getAttribute('data-theme') === 'dark';
            (window as any).setAllParticlesTheme(currentDark ? 'dark' : 'light');
          }
        }, 30);
      };
      document.body.appendChild(initScript);

      const welcomeScript = document.createElement('script');
      welcomeScript.type = 'module';
      welcomeScript.src = '/_astro/index.astro_astro_type_script_index_0_lang.BxMooTve.js';
      document.body.appendChild(welcomeScript);
    }
  }, []);

  const isDark = mounted ? (resolvedTheme === 'dark' || theme === 'dark') : true;

  // Sync canvas background when theme changes
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      const win = window as any;
      if (typeof win.setAllParticlesTheme === 'function') {
        win.setAllParticlesTheme(isDark ? 'dark' : 'light');
      }
    }
  }, [isDark, mounted]);

  return (
    <section className="welcome-wrapper-outer min-h-[calc(100vh-80px)] flex items-center justify-center relative">
      <section className="welcome-wrapper astro-lcdefpme w-full py-20" data-welcome-section="">
        {/* Particle Canvas Backdrop */}
        <div className="hero-video-wrapper astro-lcdefpme">
          <div className="hero-video-container astro-lcdefpme" data-hero-particles="">
            <div
              className="main-particles-component-section astro-esuf45jn"
              data-main-particles-component=""
              data-sync-theme="true"
              data-theme={isDark ? 'dark' : 'light'}
              data-ring-width="0.006"
              data-ring-width2="0.107"
              data-ring-displacement="0.62"
              data-density="230"
              data-particles-scale="0.59"
              data-color1="#0066ff"
              data-color2="#38bdf8"
              data-color3={isDark ? '#60a5fa' : '#38bdf8'}
            >
              <div className="main-particles-container astro-esuf45jn" data-container=""></div>
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div
          className="welcome-section astro-lcdefpme flex flex-col items-center justify-center text-center px-4"
          data-welcome-content=""
        >
          {/* Main Headline Container with Dynamic Vertical Slide Rotation */}
          <div className="header-container astro-lcdefpme max-w-5xl mx-auto mb-4 min-h-[140px] sm:min-h-[180px] md:min-h-[220px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.h1
                key={`${locale}-${currentSlide}`}
                initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -24, filter: 'blur(6px)' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="landing-main-header astro-lcdefpme text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-tight text-foreground dark:text-white mb-4 leading-[1.08] max-w-4xl mx-auto"
              >
                {headlines[currentSlide]}
              </motion.h1>
            </AnimatePresence>
            <p className="text-base sm:text-xl text-muted-foreground dark:text-[#d4d4d4] max-w-2xl mx-auto leading-relaxed font-normal">
              {t.hero.lead}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-4 z-20">
            <a
              href="https://learn.const.web.id"
              className="call-to-action button button-primary astro-lcdefpme inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#161616] text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-medium text-sm transition-all shadow-md"
            >
              <span>{t.hero.ctaLearn}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href="https://accounts.const.web.id"
              className="call-to-action button button-secondary astro-lcdefpme inline-flex items-center gap-2 px-6 py-3 rounded-full border border-black/15 bg-black/5 text-[#161616] hover:bg-black/10 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 backdrop-blur-md font-medium text-sm transition-all shadow-sm"
            >
              <span>{t.hero.ctaAccounts}</span>
            </a>
          </div>
        </div>
      </section>
    </section>
  );
}
