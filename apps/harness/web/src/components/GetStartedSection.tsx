"use client";
import { Check } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { HeadingReveal } from "@/components/ui/text-reveal";
import { LINKS } from "@/lib/links";
import { motion } from "framer-motion";

export function GetStartedSection() {
  const { t } = useI18n();
  return (
    <section className="ch-section" id="get-started">
      <div className="ch-shell">
        <HeadingReveal>
          <h2 className="ch-title">{t("getstarted.title")}</h2>
          <p className="ch-subtitle">{t("getstarted.subtitle")}</p>
        </HeadingReveal>
        <div className="ch-plans">
          {([0, 1, 2] as const).map((index) => (
            <motion.article
              className="ch-plan"
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <h3>{t(`getstarted.${index}.title`)}</h3>
              <p className="ch-plan-highlight">
                {t(`getstarted.${index}.highlight`)}
              </p>
              <p className="ch-plan-description">
                {t(`getstarted.${index}.description`)}
              </p>
              <a
                href={
                  index === 0
                    ? "#download"
                    : index === 1
                      ? LINKS.docs
                      : LINKS.router
                }
                className={`ch-button ${index === 1 ? "ch-button-primary" : "ch-button-secondary"}`}
              >
                {t(`getstarted.${index}.cta`)}
              </a>
              <ul>
                {([0, 1, 2] as const).map((item) => (
                  <li key={item}>
                    <Check size={15} />
                    <span>{t(`getstarted.${index}.feature${item}`)}</span>
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
        <p className="ch-note">{t("getstarted.note")}</p>
      </div>
    </section>
  );
}
