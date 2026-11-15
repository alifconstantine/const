"use client";
import { Presentation, BarChart3, Globe, Code2 } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { HeadingReveal } from "@/components/ui/text-reveal";
import { motion } from "framer-motion";

const TASKS = [
  {
    index: 0,
    num: "01",
    Icon: Presentation,
    tags: ["Brief", "Slides", "Skills"],
  },
  {
    index: 1,
    num: "02",
    Icon: BarChart3,
    tags: ["Python", "Shell", "Data"],
  },
  {
    index: 2,
    num: "03",
    Icon: Globe,
    tags: ["Local Dev", "Browser", "DOM"],
  },
  {
    index: 3,
    num: "04",
    Icon: Code2,
    tags: ["Search", "Diff", "Review"],
  },
] as const;

export function TaskExplorerSection() {
  const { t } = useI18n();

  return (
    <section className="ch-section ch-section-tasks" id="capabilities">
      <div className="ch-shell">
        <HeadingReveal>
          <h2 className="ch-title">{t("tasks.title")}</h2>
        </HeadingReveal>
        <div className="ch-tasks-grid">
          {TASKS.map((task, idx) => {
            const Icon = task.Icon;
            return (
              <motion.article
                key={task.index}
                className="ch-task-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.55,
                  delay: idx * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div className="ch-card-head">
                  <span className="ch-card-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span className="ch-card-index">{task.num}</span>
                </div>
                <h3 className="ch-task-title">
                  {t(`tasks.${task.index}.title`)}
                </h3>
                <p className="ch-task-description">
                  {t(`tasks.${task.index}.description`)}
                </p>
                <div className="ch-card-tags" aria-hidden="true">
                  {task.tags.map((tag) => (
                    <span className="ch-card-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
