import { validateUiProgram } from "../src/components/intelligence-ui/validation";
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

export const LIVE_COMPONENTS = [
  "Stack",
  "Card",
  "TextContent",
  "Table",
  "Col",
  "BarChart",
  "Series",
  "Form",
  "Buttons",
  "Button",
];

export function validateGeneratedUi(content: string) {
  const programs = splitAssistantResponse(content).filter(
    (part) => part.kind === "ui",
  );
  const components = new Set<string>();
  const errors: string[] = [];
  if (!programs.length) errors.push("No openui-lang block was generated");
  for (const program of programs) {
    if (!program.complete) errors.push("Unclosed UI fence");
    const result = validateUiProgram(program.content);
    errors.push(...result.errors);
    result.components.forEach((name) => components.add(name));
  }
  for (const name of LIVE_COMPONENTS)
    if (!components.has(name))
      errors.push(`Missing requested ${name} component`);
  return { components: [...components], errors };
}
