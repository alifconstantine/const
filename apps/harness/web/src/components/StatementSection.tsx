"use client";
import { useI18n } from "@/context/I18nContext";
import { ScrollTextReveal } from "@/components/ui/text-reveal";

export function StatementSection() {
  const { t } = useI18n();
  return (
    <section className="ch-statement">
      <div className="ch-shell ch-shell-wide">
        <h2 className="ch-statement-text">
          <ScrollTextReveal text={t("statement.title")} />
        </h2>
      </div>
    </section>
  );
}
