import { createLibrary, defineComponent } from "@openuidev/lang-core";
import {
  openuiLibrary,
  openuiChatLibrary,
} from "@openuidev/react-ui/genui-lib";
import { z } from "zod/v4";

export type IntelligenceUiState = Record<string, Record<string, unknown>>;
export const UI_PROGRAM_LIMIT = 200_000;
export const STATE_LIMIT = 32_000;
const reserved = new Set(["__proto__", "constructor", "prototype"]);
const stateful = new Set([
  "Form",
  "Input",
  "TextArea",
  "Select",
  "DatePicker",
  "Slider",
  "CheckBoxGroup",
  "RadioGroup",
  "SwitchGroup",
  "Chips",
  "OptionCards",
  "EditableTable",
]);

/** Shared limits for parsed props and persisted JSON, including z.any fields. */
export function boundedValue(
  value: unknown,
  depth = 0,
  budget = { remaining: 20_000 },
): boolean {
  if (--budget.remaining < 0 || depth > 32) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 20_000;
  if (Array.isArray(value))
    return (
      value.length <= 500 &&
      value.every((item) => boundedValue(item, depth + 1, budget))
    );
  if (value && typeof value === "object")
    return Object.entries(value).every(
      ([key, item]) =>
        !reserved.has(key) && boundedValue(item, depth + 1, budget),
    );
  return value == null || typeof value === "boolean";
}

export function validUiState(value: unknown): value is Record<string, unknown> {
  try {
    return (
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      JSON.stringify(value).length <= STATE_LIMIT &&
      boundedValue(value)
    );
  } catch {
    return false;
  }
}

/** OpenUI refs are prop schemas; runtime children carry an element envelope. */
export function componentPropsForValidation(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(componentPropsForValidation);
  if (!value || typeof value !== "object") return value;
  const node = value as Record<string, unknown>;
  if (
    node.type === "element" &&
    typeof node.typeName === "string" &&
    node.props
  )
    return componentPropsForValidation(node.props);
  return Object.fromEntries(
    Object.entries(node).map(([key, item]) => [
      key,
      componentPropsForValidation(item),
    ]),
  );
}

const extras = [
  "FollowUpBlock",
  "FollowUpItem",
  "SectionBlock",
  "SectionItem",
].flatMap((name) => {
  const component = openuiChatLibrary.components[name];
  return component ? [component] : [];
});
const catalog = openuiLibrary.extend({ components: { add: extras } });

// Keep official positional signatures in one place. Never mutate the upstream registry.
const overrides = Object.entries(catalog.components).map(
  ([name, component]) => {
    const props = (component.props as z.ZodObject).superRefine(
      (value, context) => {
        if (!boundedValue(value))
          context.addIssue({
            code: "custom",
            message: "UI resource limit exceeded",
          });
        if (
          stateful.has(name) &&
          (typeof value.name !== "string" ||
            !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value.name) ||
            reserved.has(value.name))
        )
          context.addIssue({
            code: "custom",
            message: "Invalid state identifier",
          });
        if (name === "Input" && value.type === "password")
          context.addIssue({
            code: "custom",
            message: "Credentials must not be collected in generated UI",
          });
        if (
          ["Image", "ImageBlock"].includes(name) &&
          typeof value.src === "string" &&
          value.src
        ) {
          let allowed = false;
          try {
            const url = new URL(value.src);
            allowed =
              ["https:", "http:"].includes(url.protocol) &&
              !url.username &&
              !url.password;
          } catch {
            /* Relative/local sources are not presentation assets. */
          }
          if (!allowed)
            context.addIssue({ code: "custom", message: "Invalid image URL" });
        }
        if (
          name === "Table" &&
          Array.isArray(value.columns) &&
          value.columns.length > 20
        )
          context.addIssue({
            code: "custom",
            message: "Too many table columns",
          });
        if (
          (name === "Form" &&
            Array.isArray(value.fields) &&
            value.fields.length > 20) ||
          (name === "Stack" &&
            Array.isArray(value.children) &&
            value.children.length > 50)
        )
          context.addIssue({ code: "custom", message: "Too many UI children" });
      },
    );
    return defineComponent({ ...component, props });
  },
);
// extend rewrites every parent reference to the new schemas. Simply cloning the
// props would leave Table/Col and other nested references pointing at old objects.
export const definitions = catalog.extend({
  components: { override: overrides },
}).components;

export const intelligenceSchema = createLibrary({
  root: "Stack",
  componentGroups: openuiLibrary.componentGroups,
  components: Object.values(definitions).map((definition) =>
    defineComponent({
      name: definition.name,
      description: definition.description,
      props: definition.props,
      component: null,
    }),
  ),
});
