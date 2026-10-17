'use client';

import React from 'react';
import { motion } from 'framer-motion';

const YOUTUBE_EMBED_URL = 'https://www.youtube.com/embed/DerQfU8nrxc?rel=0';

export default function VideoSection() {
  return (
    <section className="landing-video-section astro-lcdefpme astro-4xhi77lm w-full relative z-10" id="youtube-video-section">
      <div className="grid-container astro-4xhi77lm max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid-row astro-4xhi77lm">
          <div className="grid-col col-md-12 astro-4xhi77lm">
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="video-wrapper astro-4xhi77lm relative w-full aspect-video rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 bg-black"
              style={{
                width: '100%',
                aspectRatio: '16/9',
                borderRadius: 'var(--shape-corner-xl, 24px)',
                overflow: 'hidden',
                position: 'relative',
                lineHeight: 0,
              }}
            >
              <iframe
                src={YOUTUBE_EMBED_URL}
                title="Const Learn Demo Video"
                className="w-full h-full border-0 absolute inset-0"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 0,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
