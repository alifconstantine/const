"use client";
import { ScrollArea } from "@const/ui";
import { useI18n } from "@/context/I18nContext";
import { HeadingReveal } from "@/components/ui/text-reveal";
import { motion } from "framer-motion";

export function ComparisonSection() {
  const { t } = useI18n();
  return (
    <section className="ch-section" id="comparison">
      <div className="ch-shell">
        <HeadingReveal>
          <h2 className="ch-title">{t("comparison.title")}</h2>
        </HeadingReveal>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="ch-comparison-mobile">
            {([0, 1, 2, 3, 4] as const).map((index) => (
              <section key={index}>
                <h3>{t(`comparison.rows.${index}.label`)}</h3>
                <dl>
                  <dt>Const Harness</dt>
                  <dd>{t(`comparison.${index}.harness`)}</dd>
                  <dt>{t("comparison.other")}</dt>
                  <dd>{t(`comparison.${index}.other`)}</dd>
                </dl>
              </section>
            ))}
          </div>
          <ScrollArea
            orientation="horizontal"
            className="ch-comparison-wrap"
            tabIndex={0}
            role="region"
            aria-label={t("comparison.title")}
          >
            <table className="ch-comparison">
              <thead>
                <tr>
                  <th scope="col">{t("comparison.category")}</th>
                  <th scope="col">Const Harness</th>
                  <th scope="col">{t("comparison.other")}</th>
                </tr>
              </thead>
              <tbody>
                {([0, 1, 2, 3, 4] as const).map((index) => (
                  <tr key={index}>
                    <th scope="row">{t(`comparison.rows.${index}.label`)}</th>
                    <td data-harness="true">
                      {t(`comparison.${index}.harness`)}
                    </td>
                    <td>{t(`comparison.${index}.other`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          <p className="ch-note">{t("comparison.note")}</p>
        </motion.div>
      </div>
    </section>
  );
}
