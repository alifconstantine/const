'use client';

import React, { useEffect } from 'react';

const videoContent = `<section class="landing-video-section astro-lcdefpme astro-4xhi77lm" id="youtube-video-section" data-youtube-video-section="" data-youtube-url="https://youtube.com/embed/SVCBA-pBgt0"><dialog class="dialog youtube-dialog astro-mkgfivnz" id="youtube-video-section-modal" data-modal-youtube="" data-youtube-url="https://youtube.com/embed/SVCBA-pBgt0"><div class="dialog-backdrop astro-mkgfivnz" data-close-btn=""></div><div class="dialog-inner astro-mkgfivnz"><div class="dialog-content astro-mkgfivnz"><button class="dialog-close-button symbol astro-mkgfivnz" data-close-btn="" translate="no"><span class="astro-mkgfivnz">close</span></button><div class="dialog-body astro-mkgfivnz" data-body=""></div></div></div></dialog><div class="grid-container astro-4xhi77lm"><div class="grid-row astro-4xhi77lm"><div class="grid-col col-md-12 astro-4xhi77lm"><div class="video-wrapper astro-4xhi77lm" data-video-wrapper="" aria-label="Play video"><div class="custom-cursor astro-4xhi77lm" data-cursor=""><div class="cursor-content astro-4xhi77lm"><span class="symbol astro-4xhi77lm" translate="no">play_arrow</span><span class="call-to-action astro-4xhi77lm">Play intro</span></div></div><div class="video-control-button symbol astro-4xhi77lm" translate="no">play_arrow</div><video class="landing-video astro-4xhi77lm" data-video="" autoplay loop muted playsinline width="1920" height="1080"><source src="/assets/video/hero_video.mp4" type="video/mp4" class="astro-4xhi77lm"></video></div></div></div></div></section>`;

export default function VideoSection() {
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).ModalYoutubeHelper) {
      (window as any).ModalYoutubeHelper = class ModalYoutubeHelper {
        dialog: any;
        body: any;
        youtubeUrl: string;

        constructor(dialog: any) {
          this.dialog = dialog;
          this.body = dialog ? dialog.querySelector('[data-body]') : null;
          this.youtubeUrl = dialog ? dialog.getAttribute('data-youtube-url') || '' : '';

          if (this.dialog) {
            const closeButtons = this.dialog.querySelectorAll('[data-close-btn]');
            closeButtons.forEach((btn: any) => {
              btn.addEventListener('click', () => this.close());
            });

            this.dialog.addEventListener('close', () => {
              this.dialog.classList.remove('active');
              if (this.body) this.body.innerHTML = '';
            });
          }
        }

        setUrl(url: string) {
          this.youtubeUrl = url;
        }

        sanitizeUrl(url: string) {
          let urlToSanitize = url;
          if (urlToSanitize.includes('watch?v=')) {
            const parts = urlToSanitize.split('v=')[1];
            const videoId = parts ? parts.split('&')[0] : '';
            urlToSanitize = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`;
          } else if (urlToSanitize.includes('youtube.com/embed/')) {
            const separator = urlToSanitize.includes('?') ? '&' : '?';
            if (!urlToSanitize.includes('autoplay=')) {
              urlToSanitize += `${separator}autoplay=1&mute=0`;
            }
          }
          return urlToSanitize;
        }

        show(url?: string) {
          if (url) {
            this.youtubeUrl = url;
          }
          if (!this.youtubeUrl || !this.dialog) return;

          const sanitized = this.sanitizeUrl(this.youtubeUrl);
          if (this.body) {
            this.body.innerHTML = `
              <iframe width="100%" height="100%" src="${sanitized}" title="YouTube video player" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen></iframe>
            `;
          }

          if (typeof this.dialog.showModal === 'function') {
            this.dialog.showModal();
          }
          setTimeout(() => {
            if (this.dialog) this.dialog.classList.add('active');
          }, 50);
        }

        close() {
          if (this.dialog && typeof this.dialog.close === 'function') {
            this.dialog.close();
          }
        }
      };
    }

    const existing = document.querySelector('script[src*="YoutubeVideoSection"]');
    if (!existing) {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = '/_astro/YoutubeVideoSection.astro_astro_type_script_index_0_lang.bzIUlk_B.js';
      document.body.appendChild(s);
    }
  }, []);

  return <div suppressHydrationWarning={true} dangerouslySetInnerHTML={{ __html: videoContent }} />;
}
