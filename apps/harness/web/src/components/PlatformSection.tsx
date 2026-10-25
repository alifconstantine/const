"use client";
import { CalendarClock, Check, Terminal } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { WorkbenchPreview } from "./WorkbenchPreview";

export function PlatformSection() {
  const { t } = useI18n();
  return (
    <section className="ch-section" id="platforms">
      <div className="ch-shell">
        <h2 className="ch-title">{t("platform.title")}</h2>
        <div className="ch-platform-grid">
          {([0, 1, 2] as const).map((index) => (
            <article key={index} className="ch-platform-card">
              <div className="ch-platform-visual">
                {index === 0 ? (
                  <WorkbenchPreview compact />
                ) : index === 1 ? (
                  <div className="ch-terminal-illustration">
                    <Terminal size={20} />
                    <pre>
                      <code>{`$ pnpm check-types\n\n> tsc --noEmit\n\n✓ 0 errors\n\n$ pnpm build\n\n✓ Build completed\n$ ▋`}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="ch-schedule-illustration">
                    <CalendarClock size={26} />
                    <strong>{t("preview.schedule")}</strong>
                    <span>{t("preview.daily")}</span>
                    <div>
                      <Check size={15} />
                      {t("preview.complete")}
                    </div>
                  </div>
                )}
              </div>
              <h3 className="ch-platform-title">
                {t(`platform.${index}.title`)}
              </h3>
              <p className="ch-platform-description">
                {t(`platform.${index}.description`)}
              </p>
              <a
                className="ch-button ch-button-secondary"
                href={
                  index === 0 ? "#download" : index === 1 ? "#terminal" : "#faq"
                }
              >
                {t(
                  index === 0
                    ? "nav.cta"
                    : index === 1
                      ? "platform.terminalCta"
                      : "platform.scheduleCta",
                )}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
