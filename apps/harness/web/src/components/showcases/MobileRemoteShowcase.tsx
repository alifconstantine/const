"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, Clipboard, ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";
import { ConstLogoIcon } from "@const/ui";
import "./showcases.css";

/**
 * Authentic preview mirroring apps/harness/mobile/src/App.tsx
 * pairing & remote session screen.
 */
export function MobileRemoteShowcase() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="ch-sc-mobile-wrap" aria-label="Const Harness Mobile Remote UI preview">
      <div className="ch-sc-phone">
        <div className="ch-sc-phone-pill" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ConstLogoIcon
              size={16}
              variant={mounted && resolvedTheme === "dark" ? "dark-transparent" : "transparent"}
              className="w-4 h-4 shrink-0"
            />
            <span className="text-[12px] font-semibold tracking-tight">Const Harness</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--ch-ink-muted)]">
            <span className="px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 font-medium text-[var(--ch-ink)]">
              Pair
            </span>
            <span className="px-2 py-0.5">Sessions</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-[var(--ch-ink-muted)]">Pairing code</span>
          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium">
            <Clipboard className="w-3 h-3" />
            <span>Paste</span>
          </span>
        </div>

        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.05] py-2 text-center font-mono text-[15px] font-semibold tracking-[0.22em] mb-2.5">
          K7P-9M2
        </div>

        <div className="rounded-xl bg-[#161616] text-white dark:bg-[#f4f4f5] dark:text-[#141416] py-2 px-3 flex items-center justify-center gap-1.5 text-[11.5px] font-medium mb-2.5">
          <span>Connect</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-[var(--ch-ink-muted)]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>End-to-end encrypted relay</span>
        </div>
      </div>
    </div>
  );
}
