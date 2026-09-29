'use client';
import { useEffect } from 'react';

export default function CustomCursor() {
  useEffect(() => {
    if (!document.querySelector('script[src*="CustomCursor.astro"]')) {
      const s1 = document.createElement('script');
      s1.type = 'module';
      s1.src = '/_astro/CustomCursor.astro_astro_type_script_index_0_lang.CPzCIKxN.js';
      document.body.appendChild(s1);
    }

    if (!document.querySelector('script[src*="SmoothScrollLayout.astro"]')) {
      const s2 = document.createElement('script');
      s2.type = 'module';
      s2.src = '/_astro/SmoothScrollLayout.astro_astro_type_script_index_0_lang.BWgXG9Oy.js';
      document.body.appendChild(s2);
    }
  }, []);

  return null;
}
