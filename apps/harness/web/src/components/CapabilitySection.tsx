"use client";
import { useI18n } from "@/context/I18nContext";
import { HeadingReveal } from "@/components/ui/text-reveal";
import { motion } from "framer-motion";
import { CapabilityShowcase, type CapabilityKind } from "./showcases/CapabilityShowcase";

const CAPABILITIES = [
  { index: 0, kind: "plugins" },
  { index: 1, kind: "computer" },
  { index: 2, kind: "browser" },
  { index: 3, kind: "subagents" },
  { index: 5, kind: "intelligence", id: "intelligence-ui" },
  { index: 4, kind: "remote", id: "remote" },
] as const satisfies ReadonlyArray<{ index: 0 | 1 | 2 | 3 | 4 | 5; kind: CapabilityKind; id?: string }>;

export function CapabilitySection() {
  const { t } = useI18n();
  return (
    <section className="ch-section" id="features">
      <div className="ch-shell ch-shell-wide">
        <HeadingReveal>
          <h2 className="ch-title">{t("capabilities.title")}</h2>
        </HeadingReveal>
        <div className="ch-capabilities">
          {CAPABILITIES.map((item) => (
            <motion.article
              key={item.index}
              className="ch-capability"
              id={"id" in item ? item.id : undefined}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div>
                <h3 className="ch-capability-title">
                  {t(`capabilities.${item.index}.title`)}
                </h3>
                <p className="ch-capability-description">
                  {t(`capabilities.${item.index}.description`)}
                </p>
              </div>
              <div className="ch-capability-media">
                <CapabilityShowcase kind={item.kind} />
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
