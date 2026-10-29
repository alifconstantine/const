/** Keep form submissions readable; runtime field metadata stays in saved state. */
export function submissionFields(
  state: Record<string, unknown>,
  formName?: string,
) {
  const fields: Array<{
    label: string;
    value: string | number | boolean | undefined;
  }> = [];
  const visit = (value: unknown, label: string) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const object = value as Record<string, unknown>;
      if (
        "value" in object &&
        Object.keys(object).every((key) =>
          ["value", "componentType"].includes(key),
        )
      ) {
        visit(object.value, label);
        return;
      }
      for (const [key, item] of Object.entries(object)) {
        if (key !== "componentType")
          visit(item, label ? `${label}.${key}` : key);
      }
    } else
      fields.push({
        label,
        value:
          value == null
            ? undefined
            : Array.isArray(value)
              ? JSON.stringify(value)
              : (value as string | number | boolean),
      });
  };
  visit(formName && state[formName] ? state[formName] : state, "");
  return fields;
}

export function formatFormSubmission(
  title: string,
  fields: Array<{
    label: string;
    value: string | number | boolean | undefined;
  }>,
  labels: { yes: string; no: string },
): string {
  const answers = fields
    .filter(({ value }) => value !== undefined && value !== "")
    .map(
      ({ label, value }) =>
        `${label}: ${typeof value === "boolean" ? (value ? labels.yes : labels.no) : value}`,
    );
  return [title, answers.join("\n")].filter(Boolean).join("\n\n");
}

export function compareTableValues(
  left: string,
  right: string,
  collator: Intl.Collator,
): number {
  const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
  if (numeric.test(left.trim()) && numeric.test(right.trim())) {
    const a = Number(left);
    const b = Number(right);
    if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
  }
  return collator.compare(left, right);
}

/** Preserve numeric cells while escaping text that spreadsheet apps treat as formulas. */
function spreadsheetCell(value: string): string {
  const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
  if (numeric.test(value.trim()) && Number.isFinite(Number(value)))
    return value;
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function serializeTableCsv(columns: string[], rows: string[][]): string {
  return [columns, ...rows]
    .map((row) =>
      row
        .map((value) => `"${spreadsheetCell(value).replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\r\n");
}

export function serializeTableTsv(columns: string[], rows: string[][]): string {
  return [columns, ...rows]
    .map((row) =>
      row
        .map((value) => spreadsheetCell(value.replace(/[\t\r\n]/g, " ")))
        .join("\t"),
    )
    .join("\n");
}
