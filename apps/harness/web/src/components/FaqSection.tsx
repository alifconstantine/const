"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
export function FaqSection() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section className="ch-section" id="faq">
      <div className="ch-shell">
        <h2 className="ch-title">{t("faq.title")}</h2>
        <div className="ch-faq">
          {([0, 1, 2, 3, 4, 5] as const).map((index) => (
            <div key={index} className="ch-faq-item">
              <h3>
                <button
                  type="button"
                  className="ch-faq-question"
                  id={`faq-question-${index}`}
                  aria-expanded={openIndex === index}
                  aria-controls={`faq-answer-${index}`}
                  onClick={() =>
                    setOpenIndex(openIndex === index ? null : index)
                  }
                >
                  <span>{t(`faq.${index}.q`)}</span>
                  <Plus
                    size={22}
                    className="ch-faq-plus"
                    data-open={openIndex === index}
                  />
                </button>
              </h3>
              <div
                id={`faq-answer-${index}`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
                hidden={openIndex !== index}
              >
                <p className="ch-faq-answer">{t(`faq.${index}.a`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
