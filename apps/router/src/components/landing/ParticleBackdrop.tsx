"use client";

import { useEffect, useRef, useState } from "react";

type ParticleScene = {
  initEvents(): void;
  render(): void;
  stop(): void;
  resume(): void;
  onWindowResize(): void;
  killParticles(): void;
  kill(): void;
};
type ParticleWindow = Window & {
  MainParticlesClass?: new (options: Record<string, unknown>) => ParticleScene;
};
const scriptUrl =
  "/_astro/MainParticlesComponent.astro_astro_type_script_index_0_lang.ZV8AJEPG.js?v=4";

function loadParticles(): Promise<void> {
  if ((window as ParticleWindow).MainParticlesClass) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      "script[data-router-particles]",
    );
    const loaded = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      script?.remove();
      reject(new Error("Particle module could not load"));
    };
    const cleanup = () => {
      script?.removeEventListener("load", loaded);
      script?.removeEventListener("error", failed);
    };
    if (!script) {
      script = document.createElement("script");
      script.type = "module";
      script.dataset.routerParticles = "true";
      script.src = scriptUrl;
      script.addEventListener("load", loaded, { once: true });
      script.addEventListener("error", failed, { once: true });
      document.body.appendChild(script);
    } else {
      script.addEventListener("load", loaded, { once: true });
      script.addEventListener("error", failed, { once: true });
    }
  });
}

export function ParticleBackdrop() {
  const [enabled, setEnabled] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = window.matchMedia(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
    );
    const update = () => setEnabled(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const container = host.current;
    if (!enabled || !container) return;
    let cancelled = false;
    let frame = 0;
    let scene: ParticleScene | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let visibilityObserver: IntersectionObserver | undefined;
    let visible = true;
    // Own this scene's lifecycle. The legacy auto-initializer keeps its RAF and
    // _pInit marker after React removes a node, which breaks HMR and remounts.
    loadParticles()
      .then(() => {
        if (cancelled || !container.isConnected) return;
        const Scene = (window as ParticleWindow).MainParticlesClass;
        if (!Scene) return;
        // The legacy scene registers an anonymous global resize listener that
        // its kill() cannot remove. Our scoped observer handles resize instead.
        class ScopedScene extends Scene {
          initEvents() {}
        }
        scene = new ScopedScene({
          container,
          theme: "dark",
          color1: "#ffffff",
          color2: "#a1a1aa",
          color3: "#52525b",
          particlesScale: 0.59,
          density: 230,
          interactive: true,
          gui: false,
          verbose: false,
          ringWidth: 0.006,
          ringWidth2: 0.107,
          ringDisplacement: 0.62,
        });
        container.dataset.particleStatus = "ready";
        resizeObserver = new ResizeObserver(() => scene?.onWindowResize());
        resizeObserver.observe(container);
        visibilityObserver = new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? false;
          if (visible) scene?.resume();
          else scene?.stop();
        });
        visibilityObserver.observe(container);
        const animate = () => {
          if (cancelled) return;
          if (visible) scene?.render();
          frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      })
      .catch(() => {
        if (!cancelled) container.dataset.particleStatus = "unavailable";
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      scene?.killParticles();
      scene?.kill();
    };
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div className="hero-video-wrapper" aria-hidden="true">
      <div
        ref={host}
        className="main-particles-container"
        data-router-particle-host=""
      />
    </div>
  );
}
