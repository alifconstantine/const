"use client";
import { useEffect, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
    const media = gsap.matchMedia();
    // Same engine and timing as Learn; native scrolling for touch and reduced motion.
    media.add(
      "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
      () => {
        const smoother = ScrollSmoother.create({
          wrapper: "#smooth-wrapper",
          content: "#smooth-content",
          smooth: 0.6,
          effects: true,
          normalizeScroll: { allowNestedScroll: true },
        });
        const scrollToHash = () => {
          if (!window.location.hash) return;
          let target: HTMLElement | null = null;
          try {
            target = document.getElementById(
              decodeURIComponent(window.location.hash.slice(1)),
            );
          } catch {
            return;
          }
          if (target) smoother.scrollTo(target, true, "top 84px");
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
          const url = new URL(anchor.href, window.location.href);
          if (
            url.origin !== location.origin ||
            url.pathname !== location.pathname ||
            url.search !== location.search ||
            !url.hash
          )
            return;
          let target: HTMLElement | null = null;
          try {
            target = document.getElementById(
              decodeURIComponent(url.hash.slice(1)),
            );
          } catch {
            return;
          }
          if (!target) return;
          event.preventDefault();
          if (location.hash !== url.hash) history.pushState(null, "", url.hash);
          smoother.scrollTo(target, true, "top 84px");
          if (anchor.classList.contains("ch-skip-link"))
            target.focus({ preventScroll: true });
        };
        const resize = new ResizeObserver(() => ScrollTrigger.refresh());
        const content = document.getElementById("smooth-content");
        if (content) resize.observe(content);
        const frame = requestAnimationFrame(scrollToHash);
        document.addEventListener("click", onClick);
        window.addEventListener("hashchange", scrollToHash);
        window.addEventListener("popstate", scrollToHash);
        return () => {
          cancelAnimationFrame(frame);
          resize.disconnect();
          document.removeEventListener("click", onClick);
          window.removeEventListener("hashchange", scrollToHash);
          window.removeEventListener("popstate", scrollToHash);
          smoother.kill();
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
