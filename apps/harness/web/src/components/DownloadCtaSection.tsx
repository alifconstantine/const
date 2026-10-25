"use client";
import Link from "next/link";
import { Download } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { ParticleField } from "./ParticleField";
export function DownloadCtaSection() {
  const { t } = useI18n();
  return (
    <section id="download" className="ch-download">
      <div className="ch-download-container">
        <div className="ch-download-panel">
          <ParticleField />
          <div className="ch-download-content">
            <div className="ch-download-copy">
              <h2 className="ch-download-title">{t("download.title")}</h2>
              <p className="ch-download-subtitle">{t("download.subtitle")}</p>
              <div className="ch-download-actions">
                <Link
                  href="/download?arch=x64"
                  className="ch-button ch-button-primary ch-button-lg"
                >
                  <Download size={16} />
                  {t("download.primary")}
                </Link>
                <Link
                  href="/download?arch=arm64"
                  className="ch-button ch-button-secondary ch-button-lg"
                >
                  {t("download.secondary")}
                </Link>
              </div>
              <p className="ch-download-note">{t("download.note")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
