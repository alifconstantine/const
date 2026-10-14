'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@const/ui';
import { useI18n } from '../context/I18nContext';

export default function Footer() {
  const { locale, setLocale, t } = useI18n();
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  return (
    <footer className="sub-footer" data-section="footer">
      <div className="container sub-footer-inner max-w-7xl mx-auto px-6">
        {/* Navigation Grid (Adapted for Const Platform) */}
        <div className="sub-footer-grid">
          {/* Col 1: Product */}
          <div className="sub-footer-col">
            <h5>{t.footer.colProduct}</h5>
            <ul>
              <li>
                <Link href="/">Const Learn</Link>
              </li>
              <li>
                <a href="https://router.const.web.id" target="_blank" rel="noopener noreferrer">
                  Const Router
                </a>
              </li>
              <li>
                <a href="https://accounts.const.web.id" target="_blank" rel="noopener noreferrer">
                  Const Accounts
                </a>
              </li>
              <li>
                <Link href="/download">{t.nav.download}</Link>
              </li>
            </ul>
          </div>

          {/* Col 2: Platform */}
          <div className="sub-footer-col">
            <h5>{t.footer.colPlatform}</h5>
            <ul>
              <li>
                <Link href="#features">Desktop</Link>
              </li>
              <li>
                <Link href="#features">Mobile</Link>
              </li>
              <li>
                <Link href="#features">Hyperframe Studio</Link>
              </li>
              <li>
                <Link href="#features">Live Terminal</Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Capabilities */}
          <div className="sub-footer-col">
            <h5>{t.footer.colCapabilities}</h5>
            <ul>
              <li>
                <Link href="#features">Socratic AI Tutor</Link>
              </li>
              <li>
                <Link href="#features">HTML Slide Deck</Link>
              </li>
              <li>
                <Link href="#features">D3 Visualization</Link>
              </li>
              <li>
                <Link href="#features">PowerPoint Exporter</Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Ecosystem */}
          <div className="sub-footer-col">
            <h5>{t.footer.colEcosystem}</h5>
            <ul>
              <li>
                <a href="https://composio.dev" target="_blank" rel="noopener noreferrer">
                  Composio Cloud
                </a>
              </li>
              <li>
                <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">
                  Model Context Protocol
                </a>
              </li>
              <li>
                <Link href="#features">Google Gemini 2.5 Flash</Link>
              </li>
              <li>
                <Link href="#features">BYOK Gateway</Link>
              </li>
            </ul>
          </div>

          {/* Col 5: Resources */}
          <div className="sub-footer-col">
            <h5>{t.footer.colResources}</h5>
            <ul>
              <li>
                <a href="https://github.com/alifconstantine/const" target="_blank" rel="noopener noreferrer">
                  Documentation
                </a>
              </li>
              <li>
                <Link href="#features">Tutorials</Link>
              </li>
              <li>
                <Link href="/download">Download</Link>
              </li>
              <li>
                <Link href="#faq">FAQ</Link>
              </li>
            </ul>
          </div>

          {/* Col 6: Company & Legal */}
          <div className="sub-footer-col">
            <h5>{t.footer.colCompany}</h5>
            <ul>
              <li>
                <a href="https://github.com/alifconstantine/const" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://discord.gg" target="_blank" rel="noopener noreferrer">
                  Discord
                </a>
              </li>
              <li>
                <a href="#">{t.footer.privacy}</a>
              </li>
              <li>
                <a href="#">{t.footer.terms}</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Foot Bar: Metadata & Controls */}
        <div className="foot-bar">
          {/* Left: Copyright & Legal */}
          <div className="foot-bar-left">
            <span className="foot-copy">{t.footer.copyright}</span>
            <span className="foot-dot" aria-hidden="true">·</span>
            <a href="#">{t.footer.privacy}</a>
            <span className="foot-dot" aria-hidden="true">·</span>
            <a href="#">{t.footer.terms}</a>
          </div>

          {/* Right: Language Switcher & Socials */}
          <div className="flex items-center gap-6">
            {/* Language Switcher Dropdown matching Image 2 */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-muted/50"
                aria-label="Change language"
              >
                {/* Lucide Languages / Translate Icon (Chinese character 文 + Letter A) */}
                <svg
                  className="w-4 h-4 text-muted-foreground shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 8 6 6" />
                  <path d="m4 14 6-6 2-3" />
                  <path d="M2 5h12" />
                  <path d="M7 2h1" />
                  <path d="m22 22-5-10-5 10" />
                  <path d="M14 18h6" />
                </svg>
                <span className="font-medium text-foreground">{locale === 'en' ? 'English' : 'Bahasa Indonesia'}</span>
                <svg
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${langMenuOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>

              {langMenuOpen && (
                <div className="absolute bottom-full right-0 mb-3 w-56 rounded-2xl border border-border/80 bg-popover/95 dark:bg-[#1e1e1e]/95 backdrop-blur-md shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setLocale('en');
                      setLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      locale === 'en'
                        ? 'bg-muted/90 dark:bg-white/10 text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs font-mono font-medium text-muted-foreground w-6">EN</span>
                    <span className="text-sm">English</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocale('id');
                      setLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      locale === 'id'
                        ? 'bg-muted/90 dark:bg-white/10 text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs font-mono font-medium text-muted-foreground w-6">ID</span>
                    <span className="text-sm">Bahasa Indonesia</span>
                  </button>
                </div>
              )}
            </div>

            {/* Social Links */}
            <div className="foot-social">
              {/* X / Twitter */}
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="X">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.65l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.815l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"></path>
                </svg>
              </a>

              {/* Discord */}
              <a href="https://discord.gg" target="_blank" rel="noopener noreferrer" aria-label="Discord">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127c-.598.349-1.22.645-1.873.891a.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"></path>
                </svg>
              </a>

              {/* GitHub */}
              <a href="https://github.com/alifconstantine/const" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
                </svg>
              </a>

              {/* YouTube */}
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Masthead Giant Wordmark */}
        <div className="foot-masthead" data-section="footer-masthead">
          <p className="foot-masthead-wordmark">
            Const<span className="foot-masthead-accent">Learn</span>
            <span className="foot-masthead-period">.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
