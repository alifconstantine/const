'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../context/I18nContext';

export default function FaqSection() {
  const { t } = useI18n();
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (index: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <section className="faq-section" id="faq" data-section="faq">
      <div className="max-w-7xl mx-auto px-6">
        <div className="faq-layout">
          {/* Left Column: Sticky Header */}
          <div className="faq-head">
            <span className="faq-tag">{t.faq.tag}</span>
            <h2 className="faq-title">{t.faq.title}</h2>
            <p className="faq-subtitle">{t.faq.subtitle}</p>

            <div className="faq-download-card">
              <Link
                href="/download"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity w-fit"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{t.nav.download}</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Numbered Accordion List */}
          <ol className="faq-list">
            {t.faq.items.map((item) => {
              const isOpen = !!openItems[item.index];
              return (
                <li
                  key={item.index}
                  className="faq-item"
                >
                  <details
                    open={isOpen}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleItem(item.index);
                    }}
                  >
                    <summary>
                      <span className="faq-index">{item.index}</span>
                      <span className="faq-q">{item.q}</span>
                      <span className="faq-toggle" aria-hidden="true">
                        <svg
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </summary>
                    {isOpen && <p className="faq-a">{item.a}</p>}
                  </details>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
