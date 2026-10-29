"use client";
import { useEffect, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

    const media = gsap.matchMedia();
    // Native scrolling on phones; recreate cleanly when the input/viewport changes.
    media.add(
      "(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      () => {
        const wrapper = document.getElementById("smooth-wrapper");
        const content = document.getElementById("smooth-content");
        if (!wrapper || !content) return;

        let smoother: ScrollSmoother | null = null;
        try {
          smoother = ScrollSmoother.create({
            wrapper: "#smooth-wrapper",
            content: "#smooth-content",
            smooth: 0.6,
            effects: true,
            smoothTouch: false,
          });
        } catch (err) {
          console.warn("ScrollSmoother initialization warning:", err);
          return;
        }

        const scrollToHash = (smooth = true) => {
          const hash = window.location.hash;
          if (!hash || hash.length <= 1) return;
          try {
            const target = document.querySelector(hash);
            if (target && smoother) {
              smoother.scrollTo(target, smooth, "top 80px");
            }
          } catch {}
        };

        const onClick = (event: MouseEvent) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;

          const anchor =
            event.target instanceof Element
              ? event.target.closest<HTMLAnchorElement>("a[href]")
              : null;
          if (!anchor || anchor.target || anchor.hasAttribute("download"))
            return;

          const href = anchor.getAttribute("href");
          if (!href) return;

          let targetHash = "";
          if (href.startsWith("#")) {
            targetHash = href;
          } else {
            try {
              const url = new URL(href, window.location.href);
              if (
                url.origin === window.location.origin &&
                url.pathname === window.location.pathname &&
                url.hash
              ) {
                targetHash = url.hash;
              }
            } catch {
              return;
            }
          }

          if (targetHash && targetHash.length > 1) {
            try {
              const target = document.querySelector(targetHash);
              if (target && smoother) {
                event.preventDefault();
                if (window.location.hash !== targetHash) {
                  history.pushState(null, "", targetHash);
                }
                smoother.scrollTo(target, true, "top 80px");
                if (anchor.classList.contains("ch-skip-link")) {
                  (target as HTMLElement).focus({ preventScroll: true });
                }
              }
            } catch {}
          }
        };

        const resize = new ResizeObserver(() => {
          ScrollTrigger.refresh();
        });
        resize.observe(content);

        // Initial and post-font refresh
        ScrollTrigger.refresh();
        if (document.fonts) {
          document.fonts.ready.then(() => ScrollTrigger.refresh());
        }

        const timer = setTimeout(() => scrollToHash(true), 200);
        document.addEventListener("click", onClick);
        const onHashChange = () => scrollToHash(true);
        window.addEventListener("hashchange", onHashChange);

        return () => {
          clearTimeout(timer);
          resize.disconnect();
          document.removeEventListener("click", onClick);
          window.removeEventListener("hashchange", onHashChange);
          if (smoother) smoother.kill();
        };
      },
    );
    return () => media.revert();
  }, []);

  return (
    <div id="smooth-wrapper">
      <div id="smooth-content">{children}</div>
    </div>
  );
}
