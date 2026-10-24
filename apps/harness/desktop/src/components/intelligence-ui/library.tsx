import React, { createContext, useContext, useId, useState } from "react";
import {
  createLibrary,
  useGetFieldValue,
  useSetFieldValue,
  useTriggerAction,
} from "@openuidev/react-lang";
import { useTranslation } from "../../lib/i18n";
import { ResponseTable } from "./response-table";
import { formatFormSubmission } from "./format";
import { definitions, type IntelligenceProps } from "./schema";
import { defineValidatedComponent } from "./validated-component";

export const InteractionContext = createContext({ disabled: true });
const panel = "min-w-0 rounded-2xl bg-black/[0.025] p-4 dark:bg-[#222222]";
const titleClass =
  "mb-3 text-[13px] font-medium text-[#262626] dark:text-white";

function BarChartView({
  title,
  items = [],
  unit = "",
}: IntelligenceProps<"BarChart">) {
  const { t } = useTranslation();
  const [showData, setShowData] = useState(false);
  const safeItems = items.filter((item) => item && Number.isFinite(item.value));
  const min = Math.min(0, ...safeItems.map((item) => item.value));
  const max = Math.max(0, ...safeItems.map((item) => item.value));
  const span = max - min || 1;
  const baseline = (-min / span) * 100;
  return (
    <section className={panel} aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h4 className={titleClass}>{title}</h4>
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#737373] hover:bg-black/5 dark:text-[#969696] dark:hover:bg-white/10"
          onClick={() => setShowData((value) => !value)}
          aria-expanded={showData}
        >
          {t(showData ? "intelligenceUi.hideData" : "intelligenceUi.showData")}
        </button>
      </div>
      <div className="space-y-3">
        {safeItems.map((item, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex justify-between gap-4 text-xs">
              <span className="min-w-0 break-words">{item.label}</span>
              <span className="shrink-0 tabular-nums">
                {item.value}
                {unit ? ` ${unit}` : ""}
              </span>
            </div>
            <div
              className="relative h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.06]"
              aria-hidden="true"
            >
              <div
                className="absolute top-0 h-full bg-[#737373] dark:bg-[#d4d4d4]"
                style={{
                  left: `${Math.min(baseline, ((item.value - min) / span) * 100)}%`,
                  width: `${(Math.abs(item.value) / span) * 100}%`,
                }}
              />
              {min < 0 && (
                <span
                  className="absolute -top-0.5 h-3 w-px bg-[#969696]"
                  style={{ left: `${baseline}%` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {showData && (
        <ResponseTable
          title={title}
          columns={[
            t("intelligenceUi.label"),
            unit || t("intelligenceUi.value"),
          ]}
          rows={safeItems.map((item) => [item.label, String(item.value)])}
        />
      )}
    </section>
  );
}

function FormView({
  name,
  title,
  fields = [],
  submitLabel,
}: IntelligenceProps<"Form">) {
  const { t } = useTranslation();
  const { disabled } = useContext(InteractionContext);
  const getValue = useGetFieldValue();
  const setValue = useSetFieldValue();
  const trigger = useTriggerAction();
  const id = useId();
  return (
    <form
      className={panel}
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled)
          void trigger(
            formatFormSubmission(
              title,
              fields.filter(Boolean).map((field) => ({
                label: field.label,
                value:
                  field.type === "checkbox"
                    ? getValue(name, field.name) === true
                    : getValue(name, field.name),
              })),
              { yes: t("common.yes"), no: t("common.no") },
            ),
            name,
          );
      }}
    >
      <h4 className={titleClass}>{title}</h4>
      <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
        {fields.filter(Boolean).map((field, index) => {
          const inputId = `${id}-${index}`;
          const value = getValue(name, field.name);
          const inputClass =
            "w-full min-w-0 rounded-xl bg-black/[0.05] px-3 py-2.5 text-[13px] text-[#262626] outline-none focus:bg-black/[0.08] dark:bg-[#2b2b2b] dark:text-white dark:focus:bg-[#383838]";
          return (
            <div key={`${field.name}-${index}`} className="space-y-1.5">
              <label
                htmlFor={inputId}
                className="block text-xs text-[#737373] dark:text-[#d4d4d4]"
              >
                {field.label}
                {field.required ? " *" : ""}
              </label>
              {field.type === "select" ? (
                <select
                  id={inputId}
                  required={field.required}
                  className={inputClass}
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) =>
                    setValue(
                      name,
                      "Select",
                      field.name,
                      event.target.value,
                      true,
                    )
                  }
                >
                  <option value="">{t("common.selectPlaceholder")}</option>
                  {(field.options || []).map((option, optionIndex) => (
                    <option key={optionIndex} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <input
                  id={inputId}
                  type="checkbox"
                  required={field.required}
                  checked={value === true}
                  onChange={(event) =>
                    setValue(
                      name,
                      "Checkbox",
                      field.name,
                      event.target.checked,
                      true,
                    )
                  }
                  className="h-4 w-4 accent-[#737373]"
                />
              ) : (
                <input
                  id={inputId}
                  type={field.type === "number" ? "number" : "text"}
                  step={field.type === "number" ? "any" : undefined}
                  maxLength={4000}
                  required={field.required}
                  value={
                    typeof value === "string" || typeof value === "number"
                      ? value
                      : ""
                  }
                  className={inputClass}
                  onChange={(event) =>
                    setValue(
                      name,
                      "Input",
                      field.name,
                      event.target.value,
                      true,
                    )
                  }
                />
              )}
            </div>
          );
        })}
        <button
          type="submit"
          className="rounded-xl bg-[#262626] px-4 py-2 text-xs font-medium text-white hover:bg-black disabled:cursor-default dark:bg-white dark:text-[#161616] dark:hover:bg-[#d4d4d4]"
        >
          {submitLabel || t("common.continue")}
        </button>
      </fieldset>
    </form>
  );
}

export const intelligenceLibrary = createLibrary({
  root: "Stack",
  components: [
    defineValidatedComponent({
      ...definitions.Stack,
      component: ({ props, renderNode }) => (
        <div className="flex min-w-0 flex-col gap-3">
          {renderNode(props.children)}
        </div>
      ),
    }),
    defineValidatedComponent({
      ...definitions.Text,
      component: ({ props }) => (
        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.68]">
          {props.text}
        </p>
      ),
    }),
    defineValidatedComponent({
      ...definitions.Card,
      component: ({ props, renderNode }) => (
        <section className={panel}>
          <h4 className={titleClass}>{props.title}</h4>
          <div className="space-y-3">{renderNode(props.children)}</div>
        </section>
      ),
    }),
    defineValidatedComponent({
      ...definitions.Metric,
      component: ({ props }) => (
        <dl className="min-w-0 py-1">
          <dt className="text-xs text-[#737373] dark:text-[#969696]">
            {props.label}
          </dt>
          <dd className="mt-1 break-words text-2xl font-medium leading-tight tracking-tight tabular-nums">
            {props.value}
          </dd>
          {props.detail && (
            <dd className="mt-1.5 text-xs leading-relaxed text-[#737373] dark:text-[#969696]">
              {props.detail}
            </dd>
          )}
        </dl>
      ),
    }),
    defineValidatedComponent({
      ...definitions.Table,
      component: ({ props }) => (
        <ResponseTable
          title={props.title}
          columns={props.columns || []}
          rows={(props.rows || [])
            .filter(Array.isArray)
            .map((row) =>
              row.map((cell) => (cell == null ? "" : String(cell))),
            )}
        />
      ),
    }),
    defineValidatedComponent({
      ...definitions.BarChart,
      component: ({ props }) => <BarChartView {...props} />,
    }),
    defineValidatedComponent({
      ...definitions.Form,
      component: ({ props }) => <FormView {...props} />,
    }),
  ],
});
