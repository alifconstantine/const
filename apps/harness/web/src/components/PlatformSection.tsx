"use client";
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
          {([0, 1] as const).map((index) => (
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
                ) : (
                  <div className="ch-remote-illustration">
                    <img
                      src="/assets/image/landing/platform-mobile.png"
                      alt={t("platform.1.title")}
                      width={1377}
                      height={1377}
                      loading="lazy"
                    />
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
                href={index === 0 ? "#download" : "#remote"}
              >
                {t(index === 0 ? "nav.cta" : "platform.remoteCta")}
              </a>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
