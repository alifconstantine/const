import { createParser } from "@openuidev/lang-core";
import {
  definitions,
  intelligenceSchema,
} from "../src/components/intelligence-ui/schema";
import { splitAssistantResponse } from "../src/components/intelligence-ui/protocol";

export async function readCompletionStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  let content = "";
  let events = 0;
  let completed = false;
  let finishReason: string | null = null;
  let usage: unknown = null;

  const dispatch = () => {
    if (!data.length) return;
    const payload = data.join("\n");
    data = [];
    if (payload === "[DONE]") {
      completed = true;
      return;
    }
    const event = JSON.parse(payload);
    if (event.error) throw new Error("The provider returned a stream error.");
    const choice = event.choices?.[0];
    if (choice?.delta?.tool_calls?.length)
      throw new Error("Unexpected tool call in a presentation-only test.");
    if (typeof choice?.delta?.content === "string") {
      content += choice.delta.content;
      events++;
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    if (event.usage) usage = event.usage;
  };
  const line = (value: string) => {
    if (!value) dispatch();
    else if (value.startsWith("data:"))
      data.push(value.slice(5).replace(/^ /, ""));
  };

  try {
    while (!completed) {
      const chunk = await reader.read();
      buffer += chunk.done
        ? decoder.decode()
        : decoder.decode(chunk.value, { stream: true });
      let newline: number;
      while (!completed && (newline = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, newline).replace(/\r$/, ""));
        buffer = buffer.slice(newline + 1);
      }
      if (chunk.done) {
        if (buffer) line(buffer.replace(/\r$/, ""));
        dispatch();
        break;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
  if (!completed && !finishReason)
    throw new Error("The stream ended without a completion marker.");
  if (finishReason && finishReason !== "stop")
    throw new Error(`Generation did not finish normally (${finishReason}).`);
  if (!content.trim())
    throw new Error("The provider returned no assistant content.");
  return { content, events, usage };
}

export function validateGeneratedUi(content: string) {
  const programs = splitAssistantResponse(content).filter(
    (part) => part.kind === "ui",
  );
  const parser = createParser(
    intelligenceSchema.toJSONSchema(),
    intelligenceSchema.root,
  );
  const components = new Set<string>();
  const errors: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as {
      type?: string;
      typeName?: string;
      props?: Record<string, unknown>;
    };
    if (node.type !== "element" || !node.typeName || !node.props) return;
    components.add(node.typeName);
    const definition = definitions[node.typeName as keyof typeof definitions];
    if (!definition || !definition.props.safeParse(node.props).success)
      errors.push(`Invalid ${node.typeName} props`);
    Object.values(node.props).forEach(visit);
  };
  if (!programs.length) errors.push("No openui-lang block was generated");
  for (const program of programs) {
    if (!program.complete) errors.push("Unclosed UI fence");
    try {
      const result = parser.parse(program.content);
      errors.push(...result.meta.errors.map((error) => error.code));
      if (
        !result.root ||
        result.meta.incomplete ||
        result.meta.unresolved.length
      )
        errors.push("Incomplete UI program");
      if (result.queryStatements.length || result.mutationStatements.length)
        errors.push("Unexpected runtime tool operation");
      visit(result.root);
    } catch {
      errors.push("UI program could not be parsed");
    }
  }
  for (const name of Object.keys(definitions))
    if (!components.has(name))
      errors.push(`Missing requested ${name} component`);
  return { components: [...components], errors };
}
