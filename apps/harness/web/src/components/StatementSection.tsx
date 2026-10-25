"use client";
import { useI18n } from "@/context/I18nContext";
export function StatementSection() {
  const { t } = useI18n();
  return (
    <section className="ch-statement">
      <div className="ch-shell ch-shell-wide">
        <p className="ch-statement-text">{t("statement.title")}</p>
      </div>
    </section>
  );
}
