"use client";
import { ScrollArea } from "@const/ui";
import { useI18n } from "@/context/I18nContext";
export function ComparisonSection() {
  const { t } = useI18n();
  return (
    <section className="ch-section" id="comparison">
      <div className="ch-shell">
        <h2 className="ch-title">{t("comparison.title")}</h2>
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
      </div>
    </section>
  );
}
