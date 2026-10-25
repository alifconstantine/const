"use client";
import { useI18n } from "@/context/I18nContext";
import { WorkbenchPreview } from "./WorkbenchPreview";
import { LINKS } from "@/lib/links";
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
        <h2 className="ch-title">{t("capabilities.title")}</h2>
        <div className="ch-capabilities">
          {CAPABILITIES.map((item) => (
            <article
              key={item.index}
              className="ch-capability"
              id={item.index === 4 ? "terminal" : undefined}
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
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
