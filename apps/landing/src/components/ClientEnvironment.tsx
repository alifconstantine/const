'use client';

import { useEffect } from 'react';

export default function ClientEnvironment() {
  useEffect(() => {
    (window as any).__agyGtmLoaded = true;
    (window as any).dataLayer = (window as any).dataLayer || [];

    const handleWindowError = (e: ErrorEvent | Event) => {
      if (
        e &&
        (e.target instanceof HTMLScriptElement ||
          e.target instanceof HTMLLinkElement ||
          e.target instanceof HTMLImageElement ||
          e.target instanceof HTMLVideoElement ||
          !(e instanceof ErrorEvent))
      ) {
        e.preventDefault?.();
        e.stopPropagation?.();
        return true;
      }
    };

    window.addEventListener('error', handleWindowError, true);
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      if (!e.reason || e.reason instanceof Event) {
        e.preventDefault?.();
      }
    });

    return () => {
      window.removeEventListener('error', handleWindowError, true);
    };
  }, []);

  return null;
}
