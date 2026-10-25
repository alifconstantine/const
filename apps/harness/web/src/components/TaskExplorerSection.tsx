"use client";
import { useState, type KeyboardEvent } from "react";
import { useI18n } from "@/context/I18nContext";
const TASKS = [
  { index: 0, image: "/assets/image/landing/task-presentation.png" },
  { index: 1, image: "/assets/image/landing/task-analysis.png" },
  { index: 2, image: "/assets/image/landing/task-website.png" },
  { index: 3, image: "/assets/image/landing/task-coding.png" },
] as const;
export function TaskExplorerSection() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const current = TASKS[active] ?? TASKS[0];
  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      next = (index + 1) % TASKS.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = (index + TASKS.length - 1) % TASKS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TASKS.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    document.getElementById(`task-tab-${next}`)?.focus();
  };
  return (
    <section className="ch-section" id="capabilities">
      <div className="ch-shell">
        <h2 className="ch-title">{t("tasks.title")}</h2>
        <div className="ch-tasks">
          <div
            className="ch-task-list"
            role="tablist"
            aria-label={t("tasks.title")}
            aria-orientation="vertical"
          >
            {TASKS.map((task) => (
              <button
                key={task.index}
                id={`task-tab-${task.index}`}
                role="tab"
                type="button"
                className="ch-task-item"
                data-active={task.index === active}
                aria-selected={task.index === active}
                aria-controls="task-panel"
                tabIndex={task.index === active ? 0 : -1}
                onKeyDown={(event) => onKeyDown(event, task.index)}
                onClick={() => setActive(task.index)}
              >
                <span className="ch-task-title">
                  {t(`tasks.${task.index}.title`)}
                </span>
                {task.index === active && (
                  <span className="ch-task-description">
                    {t(`tasks.${task.index}.description`)}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div
            className="ch-task-media"
            id="task-panel"
            role="tabpanel"
            aria-labelledby={`task-tab-${active}`}
            tabIndex={0}
          >
            <img
              src={current.image}
              alt={t(`tasks.${current.index}.title`)}
              width={1400}
              height={1144}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
