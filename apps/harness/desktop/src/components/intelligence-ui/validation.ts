import { createParser } from "@openuidev/lang-core";
import {
  boundedValue,
  componentPropsForValidation,
  definitions,
  intelligenceSchema,
  UI_PROGRAM_LIMIT,
} from "./schema";

const parser = createParser(
  intelligenceSchema.toJSONSchema(),
  intelligenceSchema.root,
);

/** Uses the same component contracts as the production React renderer and prompt. */
export function validateUiProgram(program: string) {
  const errors: string[] = [];
  const components = new Set<string>();
  if (program.length > UI_PROGRAM_LIMIT)
    return { errors: ["UI program too large"], components: [] as string[] };
  let count = 0;
  const visit = (value: unknown, depth = 0) => {
    if (++count > 20_000 || depth > 32)
      throw new Error("UI resource limit exceeded");
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as {
      type?: string;
      typeName?: string;
      props?: Record<string, unknown>;
    };
    if (node.type === "element" && node.typeName && node.props) {
      components.add(node.typeName);
      if (
        !boundedValue(node.props) ||
        !definitions[node.typeName]?.props.safeParse(
          componentPropsForValidation(node.props),
        ).success
      )
        errors.push(`Invalid ${node.typeName} props`);
      Object.values(node.props).forEach((item) => visit(item, depth + 1));
    }
  };
  try {
    const result = parser.parse(program);
    errors.push(
      ...result.meta.errors
        .filter((error) => error.severity !== "warning")
        .map((error) => error.code),
    );
    if (!result.root || result.meta.incomplete || result.meta.unresolved.length)
      errors.push("Incomplete UI program");
    if (result.queryStatements.length || result.mutationStatements.length)
      errors.push("Unexpected runtime tool operation");
    visit(result.root);
  } catch {
    errors.push("UI program could not be parsed");
  }
  return { errors: [...new Set(errors)], components: [...components] };
}
