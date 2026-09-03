"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export function AuthBackground() {
  const { resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();

    type Particle = { x: number; y: number; v: number; o: number };
    let particles: Particle[] = [];
    let raf = 0;

    const makeParticle = () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      v: Math.random() * 0.25 + 0.05,
      o: Math.random() * 0.35 + 0.15,
    });

    const init = () => {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 9000);
      for (let i = 0; i < count; i++) particles.push(makeParticle());
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isDark = document.documentElement.classList.contains("dark");

      particles.forEach((p) => {
        p.y -= p.v;
        if (p.y < 0) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + Math.random() * 40;
          p.v = Math.random() * 0.25 + 0.05;
          p.o = Math.random() * 0.35 + 0.15;
        }
        ctx.fillStyle = isDark
          ? `rgba(250,250,250,${p.o})`
          : `rgba(24,24,27,${p.o * 0.35})`;
        ctx.fillRect(p.x, p.y, 1, 2.5);
      });
      raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      setSize();
      init();
    };

    window.addEventListener("resize", onResize);
    init();
    raf = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [resolvedTheme]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0">
      <style>{`
        .accent-lines { position: absolute; inset: 0; pointer-events: none; opacity: .6; }
        .hline, .vline { position: absolute; will-change: transform, opacity; }
        .hline { left: 0; right: 0; height: 1px; transform: scaleX(0); transform-origin: 50% 50%; animation: drawX .8s cubic-bezier(.22,.61,.36,1) forwards; }
        .vline { top: 0; bottom: 0; width: 1px; transform: scaleY(0); transform-origin: 50% 0%; animation: drawY .9s cubic-bezier(.22,.61,.36,1) forwards; }
        .hline:nth-child(1) { top: 18%; animation-delay: .12s; }
        .hline:nth-child(2) { top: 50%; animation-delay: .22s; }
        .hline:nth-child(3) { top: 82%; animation-delay: .32s; }
        .vline:nth-child(4) { left: 22%; animation-delay: .42s; }
        .vline:nth-child(5) { left: 50%; animation-delay: .54s; }
        .vline:nth-child(6) { left: 78%; animation-delay: .66s; }
        @keyframes drawX { 0% { transform: scaleX(0); opacity: 0; } 60% { opacity: .95; } 100% { transform: scaleX(1); opacity: .6; } }
        @keyframes drawY { 0% { transform: scaleY(0); opacity: 0; } 60% { opacity: .95; } 100% { transform: scaleY(1); opacity: .6; } }
      `}</style>

      {/* Subtle background radial vignette */}
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(80%_60%_at_50%_30%,rgba(0,0,0,0.03),transparent_60%)] dark:[background:radial-gradient(80%_60%_at_50%_30%,rgba(255,255,255,0.05),transparent_60%)]" />

      {/* Animated accent lines */}
      <div className="accent-lines">
        <div className="hline bg-zinc-200 dark:bg-zinc-800" />
        <div className="hline bg-zinc-200 dark:bg-zinc-800" />
        <div className="hline bg-zinc-200 dark:bg-zinc-800" />
        <div className="vline bg-zinc-200 dark:bg-zinc-800" />
        <div className="vline bg-zinc-200 dark:bg-zinc-800" />
        <div className="vline bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-60 mix-blend-screen pointer-events-none"
      />
    </div>
  );
}
