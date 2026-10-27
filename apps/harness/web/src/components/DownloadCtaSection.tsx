"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import { ParticleField } from "./ParticleField";

export function DownloadCtaSection() {
  const { t } = useI18n();

  return (
    <section className="download-section-container ch-download py-16" id="download">
      <div className="max-w-7xl mx-auto px-6">
        <div
          className="relative rounded-3xl overflow-hidden py-28 sm:py-36 px-8 sm:px-16 border border-zinc-200 dark:border-[#262626] bg-[#f8f9fa] dark:bg-[#0a0a0a] min-h-[460px] flex items-center transition-colors duration-300"
          style={{ isolation: "isolate" }}
        >
          {/* Cosmic Particle Backdrop */}
          <div
            className="ch-download-backdrop absolute inset-0 z-0 overflow-hidden rounded-[inherit] pointer-events-none"
            aria-hidden="true"
          >
            <ParticleField />
          </div>

          {/* Download Section Content */}
          <div className="relative z-10 flex flex-col items-start max-w-2xl">
            <div className="mb-6">
              <h2 className="text-zinc-900 dark:text-white text-3xl sm:text-5xl md:text-6xl font-medium tracking-tight leading-tight">
                {t("download.title")}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 text-base sm:text-lg mt-4 max-w-lg leading-relaxed">
                {t("download.subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/download?arch=x64"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-medium text-sm transition-all shadow-md"
                data-analytics-event="download-cta"
                data-download-type="x64"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 16L7 11L8.4 9.55L11 12.15V4H13V12.15L15.6 9.55L17 11L12 16ZM6 20C5.45 20 4.979 19.804 4.588 19.413C4.196 19.021 4.00067 18.55 4 18V15H6V18H18V15H20V18C20 18.55 19.804 19.021 19.413 19.413C19.021 19.804 18.55 20 18 20H6Z"></path>
                </svg>
                <span>{t("download.primary")}</span>
              </Link>
              <Link
                href="/download?arch=arm64"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-black/15 bg-black/5 text-[#111827] hover:bg-black/10 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 backdrop-blur-md font-medium text-sm transition-all"
                data-analytics-event="download-cta"
                data-download-type="arm64"
              >
                <span>{t("download.secondary")}</span>
              </Link>
            </div>

            <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-4 block">
              {t("download.note")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
