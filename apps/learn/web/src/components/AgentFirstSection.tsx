'use client';

import React from 'react';
import { useI18n } from '../context/I18nContext';

export default function AgentFirstSection() {
  const { t } = useI18n();

  return (
    <section className="agent-first-section astro-73zxsoak py-28 relative overflow-hidden" data-agent-first-section="">
      <div className="grid-container text-container astro-73zxsoak max-w-5xl mx-auto px-6" data-text-container="">
        <h2 className="heading-3 agent-first-text astro-73zxsoak text-2xl sm:text-4xl md:text-5xl font-medium tracking-tight leading-[1.25] text-foreground dark:text-white">
          {t.brief.statement}
        </h2>
      </div>
    </section>
  );
}
