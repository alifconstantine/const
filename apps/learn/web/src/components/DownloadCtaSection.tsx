'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useI18n } from '../context/I18nContext';

export default function DownloadCtaSection() {
  const { t } = useI18n();
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // If the particle script is already loaded, initialize particles on this section
    const initParticles = () => {
      if (typeof window !== 'undefined') {
        const win = window as any;
        try {
          if (typeof win.initAllMainParticles === 'function') {
            win.initAllMainParticles(containerRef.current || document);
          } else {
            window.dispatchEvent(new Event('init-main-particles'));
          }
        } catch (err) {
          console.warn('Particles initialization deferred:', err);
        }
      }
    };

    // If script isn't loaded yet, ensure it is added
    if (!document.querySelector('script[src*="MainParticlesComponent"]')) {
      const initScript = document.createElement('script');
      initScript.type = 'module';
      initScript.src = '/_astro/MainParticlesComponent.astro_astro_type_script_index_0_lang.ZV8AJEPG.js?v=4';
      initScript.onload = () => {
        setTimeout(initParticles, 100);
      };
      document.body.appendChild(initScript);
    } else {
      setTimeout(initParticles, 100);
    }
  }, []);

  const isDark = mounted ? (resolvedTheme === 'dark' || theme === 'dark') : true;

  return (
    <section className="download-section-container astro-vwyjoj4m py-16" id="download-section" ref={containerRef}>
      <div className="grid-container astro-vwyjoj4m max-w-7xl mx-auto px-6">
        <div className="grid-row astro-vwyjoj4m">
          <div className="grid-col col-md-12 astro-vwyjoj4m">
            <div
              className="download-section astro-vwyjoj4m relative rounded-3xl overflow-hidden py-28 sm:py-36 px-8 sm:px-16 border border-zinc-200 dark:border-[#262626] bg-[#f8f9fa] dark:bg-[#0a0a0a] min-h-[460px] flex items-center transition-colors duration-300"
              data-section-element=""
              style={{ isolation: 'isolate' }}
            >
              {/* Cosmic Particle Backdrop */}
              <div className="download-section-backdrop astro-vwyjoj4m absolute inset-0 z-0 overflow-hidden rounded-[inherit] !left-0 !right-0 !top-0 !bottom-0 !bg-transparent pointer-events-none">
                <div
                  className="main-particles-component-section astro-esuf45jn absolute inset-0 w-full h-full overflow-hidden"
                  data-main-particles-component=""
                  data-sync-theme="true"
                  data-theme={isDark ? 'dark' : 'light'}
                  data-ring-width="0.15"
                  data-ring-width2="0.05"
                  data-ring-displacement="0.23"
                  data-density="220"
                  data-particles-scale="0.65"
                  data-color1="#0066ff"
                  data-color2="#38bdf8"
                  data-color3={isDark ? '#60a5fa' : '#38bdf8'}
                >
                  <div className="main-particles-container astro-esuf45jn absolute inset-0 w-full h-full" data-container=""></div>
                </div>
              </div>

              {/* Download Section Content */}
              <div className="download-section-content astro-vwyjoj4m relative z-10 flex flex-col items-start max-w-2xl">
                <div className="header astro-vwyjoj4m !bg-transparent !border-0 !p-0 !shadow-none mb-6">
                  <h2 className="heading-3 text-zinc-900 dark:text-white text-3xl sm:text-5xl md:text-6xl font-medium tracking-tight leading-tight">
                    {t.cta.title}
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-300 text-base sm:text-lg mt-4 max-w-lg leading-relaxed">
                    {t.cta.subtitle}
                  </p>
                </div>

                <div className="download-section-cta astro-vwyjoj4m flex flex-wrap items-center gap-3">
                  <Link
                    href="/download"
                    className="call-to-action button astro-vwyjoj4m inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-medium text-sm transition-all shadow-md"
                    data-analytics-event="download-cta"
                    data-module-name="Download section"
                    data-page-position="body"
                    data-download-type="x64"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M12 16L7 11L8.4 9.55L11 12.15V4H13V12.15L15.6 9.55L17 11L12 16ZM6 20C5.45 20 4.979 19.804 4.588 19.413C4.196 19.021 4.00067 18.55 4 18V15H6V18H18V15H20V18C20 18.55 19.804 19.021 19.413 19.413C19.021 19.804 18.55 20 18 20H6Z"></path>
                    </svg>
                    <span>{t.cta.btnWin}</span>
                  </Link>
                  <Link
                    href="/download"
                    className="call-to-action button astro-vwyjoj4m inline-flex items-center gap-2 px-6 py-3 rounded-full border border-black/15 bg-black/5 text-[#111827] hover:bg-black/10 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 backdrop-blur-md font-medium text-sm transition-all"
                    data-analytics-event="download-cta"
                    data-module-name="Download section"
                    data-page-position="body"
                    data-download-type="arm64"
                  >
                    <span>{t.cta.btnArm}</span>
                  </Link>
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-4 block">
                  {t.cta.note}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
