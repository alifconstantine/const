'use client';

import React, { useEffect } from 'react';
import { useI18n } from '../context/I18nContext';

export default function FeatureExplorerSection() {
  const { t } = useI18n();
  const items = t.features.items;

  useEffect(() => {
    const existing = document.querySelector('script[src*="FeatureExplorerNew"]');
    if (!existing) {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = '/_astro/FeatureExplorerNew.astro_astro_type_script_index_0_lang.DGYTwe-n.js';
      document.body.appendChild(s);
    }
  }, []);

  return (
    <section
      className="feature-explorer-section astro-hkzvdn3m"
      id="features"
      data-feature-explorer-section=""
    >
      <div className="grid-container astro-hkzvdn3m">
        <div className="feature-list astro-hkzvdn3m">
          {items.map((item, index) => (
            <div
              key={index}
              className="feature-item astro-hkzvdn3m"
              data-feature-item=""
            >
              <div className="grid-row astro-hkzvdn3m">
                <div className="grid-col col-xs-4 col-md-4 astro-hkzvdn3m">
                  <div className="feature-copy astro-hkzvdn3m">
                    <span
                      className="heading-4 feature-title astro-hkzvdn3m text-foreground dark:text-white text-3xl sm:text-4xl font-medium tracking-tight mb-3"
                      data-feature-title=""
                    >
                      {item.title}
                    </span>
                    <p
                      className="body feature-description astro-hkzvdn3m text-muted-foreground dark:text-[#d4d4d4] text-base sm:text-lg leading-relaxed font-normal"
                      translate="no"
                      data-nosnippet=""
                      data-feature-desc=""
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
                <div className="grid-col col-xs-4 col-md-offset-2 col-md-6 astro-hkzvdn3m">
                  <div className="feature-media astro-hkzvdn3m border border-border/80 dark:border-[#262626] bg-card dark:bg-[#141414] shadow-sm rounded-2xl overflow-hidden aspect-[16/10]">
                    {item.mediaType === 'video' ? (
                      <video
                        className="feature-media-item astro-hkzvdn3m w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                        data-autoplay=""
                      >
                        <source src={item.mediaSrc} type="video/mp4" className="astro-hkzvdn3m" />
                      </video>
                    ) : (
                      <img
                        className="feature-image astro-hkzvdn3m w-full h-full object-cover"
                        src={item.mediaSrc}
                        alt={item.title}
                        width="1282"
                        height="801"
                        loading="lazy"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
