'use client';

import React, { useEffect } from 'react';

const videoContent = `<section class="landing-video-section astro-lcdefpme astro-4xhi77lm" id="youtube-video-section" data-youtube-video-section="" data-youtube-url="/assets/video/hero_video.mp4"><dialog class="dialog youtube-dialog astro-mkgfivnz" id="youtube-video-section-modal" data-modal-youtube="" data-youtube-url="/assets/video/hero_video.mp4"><div class="dialog-backdrop astro-mkgfivnz" data-close-btn=""></div><div class="dialog-inner astro-mkgfivnz"><div class="dialog-content astro-mkgfivnz"><button class="dialog-close-button symbol astro-mkgfivnz flex items-center justify-center text-zinc-900 dark:text-white" data-close-btn="" aria-label="Close modal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button><div class="dialog-body astro-mkgfivnz" data-body=""></div></div></div></dialog><div class="grid-container astro-4xhi77lm"><div class="grid-row astro-4xhi77lm"><div class="grid-col col-md-12 astro-4xhi77lm"><div class="video-wrapper astro-4xhi77lm" data-video-wrapper="" aria-label="Play video"><div class="custom-cursor astro-4xhi77lm" data-cursor=""><div class="cursor-content astro-4xhi77lm"><span class="symbol astro-4xhi77lm flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:2px"><path d="M8 5v14l11-7z"/></svg></span><span class="call-to-action astro-4xhi77lm">Play intro</span></div></div><div class="video-control-button symbol astro-4xhi77lm flex items-center justify-center" aria-label="Play video"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></div><video class="landing-video astro-4xhi77lm" data-video="" autoplay loop muted playsinline width="1920" height="1080"><source src="/assets/video/hero_video.mp4" type="video/mp4" class="astro-4xhi77lm"></video></div></div></div></div></section>`;

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
          if (!this.dialog) return;

          if (this.body) {
            if (this.youtubeUrl && (this.youtubeUrl.includes('youtube.com') || this.youtubeUrl.includes('youtu.be')) && !this.youtubeUrl.includes('SVCBA-pBgt0')) {
              const sanitized = this.sanitizeUrl(this.youtubeUrl);
              this.body.innerHTML = `
                <iframe width="100%" height="100%" src="${sanitized}" title="Const Learn Demo Video" frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen></iframe>
              `;
            } else {
              this.body.innerHTML = `
                <video width="100%" height="100%" controls autoplay playsinline style="width: 100%; height: 100%; object-fit: contain; background: #000; border-radius: 14px;">
                  <source src="/assets/video/hero_video.mp4" type="video/mp4" />
                </video>
              `;
            }
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
          if (this.body) {
            this.body.innerHTML = '';
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
