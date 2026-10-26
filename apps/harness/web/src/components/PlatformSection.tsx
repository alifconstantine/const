"use client";
import { CalendarClock, Check, Terminal } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { WorkbenchPreview } from "./WorkbenchPreview";
import { HeadingReveal } from "@/components/ui/text-reveal";
import { motion } from "framer-motion";

export function PlatformSection() {
  const { t } = useI18n();
  return (
    <section className="ch-section" id="platforms">
      <div className="ch-shell">
        <HeadingReveal>
          <h2 className="ch-title">{t("platform.title")}</h2>
        </HeadingReveal>
        <div className="ch-platform-grid">
          {([0, 1, 2] as const).map((index) => (
            <motion.article
              key={index}
              className="ch-platform-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
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
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
