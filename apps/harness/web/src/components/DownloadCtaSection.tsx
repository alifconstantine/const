"use client";
import React from "react";
import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import { ParticleField } from "./ParticleField";
import { HeadingReveal } from "@/components/ui/text-reveal";

export function DownloadCtaSection() {
  const { t } = useI18n();
  return (
    <section id="download" className="ch-download">
      <div className="ch-download-container">
        <div className="ch-download-panel">
          {/* Cosmic Particle Backdrop */}
          <div className="ch-download-backdrop" aria-hidden="true">
            <ParticleField />
          </div>

          {/* Download Section Content */}
          <div className="ch-download-content">
            <HeadingReveal>
              <h2 className="ch-download-title">{t("download.title")}</h2>
              <p className="ch-download-subtitle">{t("download.subtitle")}</p>
            </HeadingReveal>

            <div className="ch-download-actions">
              <Link
                href="/download?arch=x64"
                className="ch-download-btn-primary"
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
                className="ch-download-btn-secondary"
                data-analytics-event="download-cta"
                data-download-type="arm64"
              >
                <span>{t("download.secondary")}</span>
              </Link>
            </div>

            <span className="ch-download-note">{t("download.note")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
