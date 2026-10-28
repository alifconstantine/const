"use client";
import { useI18n } from "@/context/I18nContext";
import { WorkbenchPreview } from "./WorkbenchPreview";
import { HeadingReveal } from "@/components/ui/text-reveal";
import { LINKS } from "@/lib/links";
import { motion } from "framer-motion";

const CAPABILITIES = [
  { index: 0, image: "/assets/image/landing/capability-plugins.png" },
  { index: 1, image: null },
  { index: 2, image: "/assets/image/landing/capability-browser.png" },
  { index: 3, image: "/assets/image/landing/capability-video.png" },
  { index: 4, image: "/assets/image/landing/capability-terminal.png" },
] as const;

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
                {item.index === 4 && (
                  <>
                    <div className="ch-command">
                      <code>pnpm --filter @const/harness-desktop dev</code>
                    </div>
                    <a className="ch-text-link" href={LINKS.docs}>
                      {t("getstarted.secondary")}
                    </a>
                  </>
                )}
              </div>
              <div className="ch-capability-media">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={t(`capabilities.${item.index}.title`)}
                    width={1400}
                    height={934}
                    loading="lazy"
                  />
                ) : (
                  <WorkbenchPreview compact />
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
