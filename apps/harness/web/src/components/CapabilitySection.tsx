"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Blocks,
  GitBranch,
  Globe,
  LayoutGrid,
  MonitorCog,
  Smartphone,
} from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { HeadingReveal } from "@/components/ui/text-reveal";
import { motion } from "framer-motion";

const CAPABILITIES = [
  {
    index: 0,
    Icon: Blocks,
    kicker: "MCP & Skills",
    href: "/integrations",
    ctaKey: "nav.integrations",
  },
  {
    index: 1,
    Icon: MonitorCog,
    kicker: "OS Automation",
  },
  {
    index: 2,
    Icon: Globe,
    kicker: "Chromium Pane",
  },
  {
    index: 3,
    Icon: GitBranch,
    kicker: "Parallel Trace",
  },
  {
    index: 5,
    id: "intelligence-ui",
    Icon: LayoutGrid,
    kicker: "openui-lang",
    pills: ["Metric", "Table + CSV", "BarChart", "Form"],
    featured: true,
  },
  {
    index: 4,
    id: "remote",
    Icon: Smartphone,
    kicker: "E2EE Relay",
    href: "/remote",
    ctaKey: "capabilities.4.cta",
  },
] as const;

export function CapabilitySection() {
  const { t } = useI18n();
  return (
    <section className="ch-section" id="features">
      <div className="ch-shell ch-shell-wide">
        <HeadingReveal>
          <h2 className="ch-title">{t("capabilities.title")}</h2>
        </HeadingReveal>
        <div className="ch-capabilities-grid">
          {CAPABILITIES.map((item, idx) => {
            const Icon = item.Icon;
            return (
              <motion.article
                key={item.index}
                className="ch-capability-card"
                data-featured={"featured" in item ? "true" : undefined}
                id={"id" in item ? item.id : undefined}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.55,
                  delay: (idx % 3) * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div className="ch-card-head">
                  <span className="ch-card-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span className="ch-capability-kicker">{item.kicker}</span>
                </div>
                <h3 className="ch-capability-title">
                  {t(`capabilities.${item.index}.title`)}
                </h3>
                <p className="ch-capability-description">
                  {t(`capabilities.${item.index}.description`)}
                </p>
                {"pills" in item && (
                  <div className="ch-card-tags" aria-hidden="true">
                    {item.pills.map((pill) => (
                      <span className="ch-card-tag" key={pill}>
                        {pill}
                      </span>
                    ))}
                  </div>
                )}
                {"href" in item && (
                  <Link className="ch-inline-link ch-capability-link" href={item.href}>
                    {t(item.ctaKey)} <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
