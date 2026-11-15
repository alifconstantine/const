"use client";
import Link from "next/link";
import { Monitor, Smartphone, CalendarClock, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { HeadingReveal } from "@/components/ui/text-reveal";
import { motion } from "framer-motion";

const PLATFORMS = [
  {
    index: 0,
    Icon: Monitor,
    meta: "Windows x64 / ARM64 · macOS & Linux soon",
    href: "/download",
    ctaKey: "nav.cta",
  },
  {
    index: 1,
    Icon: Smartphone,
    meta: "Browser Remote · Android APK · iOS soon",
    href: "/remote",
    ctaKey: "platform.remoteCta",
  },
  {
    index: 2,
    Icon: CalendarClock,
    meta: "Local Cron · Workspace History",
    href: "/docs/scheduled-tasks",
    ctaKey: "platform.scheduleCta",
  },
] as const;

export function PlatformSection() {
  const { t } = useI18n();
  return (
    <section className="ch-section" id="platforms">
      <div className="ch-shell">
        <HeadingReveal>
          <h2 className="ch-title">{t("platform.title")}</h2>
        </HeadingReveal>
        <div className="ch-platform-grid">
          {PLATFORMS.map((item, idx) => {
            const Icon = item.Icon;
            return (
              <motion.article
                key={item.index}
                className="ch-platform-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.55,
                  delay: idx * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <span className="ch-card-icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <p className="ch-platform-meta">{item.meta}</p>
                <h3 className="ch-platform-title">
                  {t(`platform.${item.index}.title`)}
                </h3>
                <p className="ch-platform-description">
                  {t(`platform.${item.index}.description`)}
                </p>
                <Link className="ch-button ch-button-secondary" href={item.href}>
                  {t(item.ctaKey)} <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
