"use client";
import { useEffect, useRef } from "react";

interface LearnParticles {
  interactive: boolean;
  render(): void;
  stop(): void;
  resume(): void;
  setTheme(theme: "light" | "dark"): void;
  onWindowResize(): void;
  kill(): void;
}

type ParticleConstructor = new (options: {
  container: HTMLElement;
  theme: "light" | "dark";
  color1: string;
  color2: string;
  color3: string;
  ringWidth: number;
  ringWidth2: number;
  ringDisplacement: number;
  density: number;
  particlesScale: number;
  pixelRatio: number;
  interactive: boolean;
  gui: boolean;
  verbose: boolean;
}) => LearnParticles;

declare global {
  interface Window {
    ConstLearnParticles?: ParticleConstructor;
  }
}

let rendererPromise: Promise<ParticleConstructor> | undefined;
function loadRenderer() {
  if (window.ConstLearnParticles)
    return Promise.resolve(window.ConstLearnParticles);
  if (!rendererPromise) {
    rendererPromise = new Promise<ParticleConstructor>((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/assets/particles/main-particles.js";
      script.onload = () => {
        if (window.ConstLearnParticles) resolve(window.ConstLearnParticles);
        else
          reject(new Error("Const Learn particle renderer did not initialize"));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("Could not load the Const Learn particle renderer"));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      rendererPromise = undefined;
      throw error;
    });
  }
  return rendererPromise;
}

export function ParticleField() {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let instance: LearnParticles | undefined;
    let frame = 0;
    let visible = false;
    let disposed = false;
    let initializing = false;
    const theme = () =>
      document.documentElement.classList.contains("dark") ? "dark" : "light";
    const render = () => {
      instance?.render();
      frame = requestAnimationFrame(render);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      if (!instance) return;
      if (!visible || document.hidden) {
        instance.stop();
        return;
      }
      instance.resume();
      if (motion.matches) {
        instance.render();
        instance.stop();
      } else frame = requestAnimationFrame(render);
    };
    const init = async () => {
      if (initializing || instance) return;
      initializing = true;
      try {
        const Renderer = await loadRenderer();
        if (disposed) return;
        instance = new Renderer({
          container,
          theme: theme(),
          color1: "#0066ff",
          color2: "#38bdf8",
          color3: theme() === "dark" ? "#60a5fa" : "#38bdf8",
          ringWidth: 0.15,
          ringWidth2: 0.05,
          ringDisplacement: 0.23,
          density: 220,
          particlesScale: 0.65,
          pixelRatio: Math.min(devicePixelRatio || 1, 2),
          interactive: !motion.matches,
          gui: false,
          verbose: false,
        });
        instance.setTheme(theme());
        // Settle the original GPU simulation before freezing its reduced-motion frame.
        if (motion.matches) for (let i = 0; i < 24; i++) instance.render();
        sync();
      } catch (error) {
        if (!disposed)
          console.warn("Download particle backdrop unavailable", error);
      } finally {
        initializing = false;
      }
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible && !instance) void init();
      sync();
    });
    intersection.observe(container);
    const resize = new ResizeObserver(() => {
      instance?.onWindowResize();
      sync();
    });
    resize.observe(container);
    const themeObserver = new MutationObserver(() => {
      instance?.setTheme(theme());
      sync();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onMotionChange = () => {
      if (instance) instance.interactive = !motion.matches;
      sync();
    };
    motion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", sync);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      intersection.disconnect();
      resize.disconnect();
      themeObserver.disconnect();
      motion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", sync);
      instance?.kill();
    };
  }, []);
  return (
    <div
      ref={containerRef}
      className="ch-download-particles"
      aria-hidden="true"
    />
  );
}
