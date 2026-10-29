import { createLibrary, defineComponent } from "@openuidev/lang-core";
import { z } from "zod/v4";

const text = z.string().max(20_000);
const cell = z.union([text, z.number().finite(), z.boolean(), z.null()]);
const identifier = z
  .string()
  .regex(/^(?!(?:constructor|prototype)$)[A-Za-z][A-Za-z0-9_-]{0,63}$/);

// Shared by the Electron prompt and React renderer. Prop order is OpenUI's
// positional calling convention; change it only with a new library version.
export const definitions = {
  Stack: {
    name: "Stack",
    description:
      "Vertical layout. The root must be Stack; children are component references.",
    props: z.object({ children: z.array(z.any()).max(50) }),
  },
  Text: {
    name: "Text",
    description:
      "Plain text paragraph. Use surrounding Markdown for rich prose and links.",
    props: z.object({ text }),
  },
  Card: {
    name: "Card",
    description: "A titled section containing other components.",
    props: z.object({ title: text, children: z.array(z.any()).max(30) }),
  },
  Metric: {
    name: "Metric",
    description:
      "One meaningful value with a label and optional explanatory detail; never invent values.",
    props: z.object({ label: text, value: text, detail: text.optional() }),
  },
  Table: {
    name: "Table",
    description:
      "Searchable data or comparison table. Each row has one cell per column.",
    props: z.object({
      title: text,
      columns: z.array(text).min(1).max(20),
      rows: z.array(z.array(cell).max(20)).max(500),
    }),
  },
  BarChart: {
    name: "BarChart",
    description:
      "Horizontal bars with a zero baseline; negative values extend left. Include the real unit and source in surrounding prose.",
    props: z.object({
      title: text,
      items: z
        .array(z.object({ label: text, value: z.number().finite() }))
        .max(30),
      unit: text.optional(),
    }),
  },
  Form: {
    name: "Form",
    description:
      "Collect user input and send it to the assistant in this same conversation on submit. Use unique names. Do not collect passwords or credentials.",
    props: z.object({
      name: identifier,
      title: text,
      fields: z
        .array(
          z.object({
            name: identifier,
            label: text,
            type: z.enum(["text", "number", "select", "checkbox"]),
            options: z.array(text).max(50).optional(),
            required: z.boolean().optional(),
          }),
        )
        .min(1)
        .max(20),
      submitLabel: text,
    }),
  },
} as const;

export type IntelligenceComponentName = keyof typeof definitions;
export type IntelligenceProps<N extends IntelligenceComponentName> = z.infer<
  (typeof definitions)[N]["props"]
>;
export type IntelligenceUiState = Record<string, Record<string, unknown>>;

// No React, browser APIs, or executable tool providers in the prompt layer.
export const intelligenceSchema = createLibrary({
  root: "Stack",
  components: Object.values(definitions).map((definition) =>
    defineComponent<z.ZodObject, null>({ ...definition, component: null }),
  ),
});
