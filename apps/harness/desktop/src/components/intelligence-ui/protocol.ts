import { createParser } from "@openuidev/lang-core";
import { intelligenceLibrary } from "./library";
import type { IntelligenceUiState } from "./schema";

export interface ResponsePart {
  kind: "markdown" | "ui";
  id: string;
  content: string;
  complete: boolean;
}

/** Fence-aware framing: an openui example inside another code fence stays code. */
export function splitAssistantResponse(
  content: string,
  streaming = false,
): ResponsePart[] {
  const parts: ResponsePart[] = [];
  const lines = content.match(/[^\n]*\n|[^\n]+$/g) || [];
  let fence:
    | { character: string; length: number; ui: boolean; offset: number }
    | undefined;
  let buffer = "";
  let offset = 0;
  let bufferStart = 0;
  const markdown = () => {
    if (buffer)
      parts.push({
        kind: "markdown",
        id: `md-${bufferStart}`,
        content: buffer,
        complete: true,
      });
    buffer = "";
  };

  for (const line of lines) {
    const trimmed = line.replace(/\r?\n$/, "");
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(trimmed);
    if (!fence && match) {
      const ui = match[2]!.trim() === "openui-lang";
      if (ui) markdown();
      fence = {
        character: match[1]![0]!,
        length: match[1]!.length,
        ui,
        offset,
      };
      if (!ui) buffer += line;
    } else if (
      fence &&
      match &&
      match[1]![0] === fence.character &&
      match[1]!.length >= fence.length &&
      !match[2]!.trim()
    ) {
      if (fence.ui) {
        parts.push({
          kind: "ui",
          id: `ui-${fence.offset}`,
          content: buffer,
          complete: true,
        });
        buffer = "";
        bufferStart = offset + line.length;
      } else buffer += line;
      fence = undefined;
    } else {
      buffer += line;
    }
    offset += line.length;
  }
  if (fence?.ui) {
    parts.push({
      kind: "ui",
      id: `ui-${fence.offset}`,
      content: buffer,
      complete: false,
    });
  } else {
    // Avoid flashing a partial opening language marker while tokens arrive.
    if (
      streaming &&
      fence &&
      "openui-lang".startsWith(
        buffer
          .split(/\r?\n/)
          .at(-1)
          ?.replace(/^ {0,3}(`{3,}|~{3,})\s*/, "") || "",
      )
    ) {
      buffer = buffer.slice(0, buffer.lastIndexOf("\n") + 1);
    }
    markdown();
  }
  return parts;
}

const parser = createParser(
  intelligenceLibrary.toJSONSchema(),
  intelligenceLibrary.root,
);

/** Plain-text projection for clipboard, side-to-main transfer, and accessibility. */
export function uiProgramToText(program: string): string {
  try {
    const result = parser.parse(program);
    const visit = (node: unknown): string => {
      if (node == null) return "";
      if (Array.isArray(node))
        return node.map(visit).filter(Boolean).join("\n\n");
      if (typeof node !== "object") return String(node);
      const element = node as {
        typeName?: string;
        props?: Record<string, unknown>;
      };
      const p = element.props;
      if (!p) return "";
      switch (element.typeName) {
        case "Stack":
          return visit(p.children);
        case "Card":
          return [p.title, visit(p.children)].filter(Boolean).join("\n");
        case "CardHeader":
          return [p.title, p.subtitle].filter(Boolean).join(" - ");
        case "Text":
        case "TextContent":
          return String(p.text ?? "");
        case "BoldText":
          return [p.title, p.value, p.sub].filter(Boolean).join(" ");
        case "Callout":
        case "TextCallout":
          return [p.title, p.description].filter(Boolean).join("\n");
        case "Metric":
          return [`${p.label ?? ""}: ${p.value ?? ""}`, p.detail]
            .filter(Boolean)
            .join("\n");
        case "Table": {
          if (Array.isArray(p.columns) && p.columns.length > 0 && (p.columns[0] as any)?.typeName === "Col") {
            const headers = p.columns.map((c: any) => c.props?.label ?? "");
            const colData = p.columns.map((c: any) => (Array.isArray(c.props?.data) ? c.props.data : []));
            const maxRows = Math.max(0, ...colData.map((d: any[]) => d.length));
            const rows: string[] = [];
            for (let i = 0; i < maxRows; i++) {
              rows.push(colData.map((d: any[]) => (d[i] == null ? "" : String(d[i]))).join("\t"));
            }
            return [headers.join("\t"), ...rows].join("\n");
          }
          return [
            p.title,
            ((p.columns as unknown[]) || []).join("\t"),
            ...((p.rows as unknown[][]) || []).map((row) =>
              row.map((c) => (c == null ? "" : String(c))).join("\t"),
            ),
          ].filter(Boolean).join("\n");
        }
        case "BarChart":
        case "LineChart":
        case "AreaChart":
        case "HorizontalBarChart":
        case "PieChart": {
          if (Array.isArray(p.labels) && Array.isArray(p.series)) {
            const labels = p.labels as string[];
            const seriesStrs = (p.series as any[]).map((s) => {
              const name = s.props?.name || "";
              const data = (s.props?.data || []) as number[];
              return `${name}: ` + labels.map((l, i) => `${l}: ${data[i] ?? ""}`).join(", ");
            });
            return seriesStrs.join("\n");
          }
          return [
            p.title,
            ...((p.items as Array<{ label: string; value: number }>) || []).map(
              (item) =>
                `${item.label}: ${item.value}${p.unit ? ` ${p.unit}` : ""}`,
            ),
          ].filter(Boolean).join("\n");
        }
        case "Tabs":
        case "Accordion":
        case "Steps":
        case "Carousel":
        case "SectionBlock":
          return visit(p.items || p.content || p.children);
        case "TabItem":
        case "AccordionItem":
        case "SectionItem":
          return [p.trigger || p.header, visit(p.content)].filter(Boolean).join("\n");
        case "Form":
          return [
            p.name || p.title,
            visit(p.buttons),
            visit(p.fields),
          ].filter(Boolean).join("\n");
        case "FormControl":
          return [p.label, visit(p.input)].filter(Boolean).join(": ");
        case "Buttons":
          return visit(p.buttons);
        case "Button":
          return String(p.label ?? "");
        case "FollowUpBlock":
          return visit(p.items || p.children);
        case "FollowUpItem":
          return String(p.text || p.label || "");
        default:
          return "";
      }
    };
    return visit(result.root).trim() || program;
  } catch {
    return program;
  }
}

export function assistantResponseToText(content: string): string {
  return splitAssistantResponse(content)
    .map((part) =>
      part.kind === "ui" ? uiProgramToText(part.content) : part.content.trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}

export function updateIntelligenceUiState<
  T extends { id: string; intelligenceUiState?: IntelligenceUiState },
>(
  messages: T[],
  messageId: string,
  blockId: string,
  state: Record<string, unknown>,
): T[] {
  return messages.map((message) =>
    message.id !== messageId
      ? message
      : {
          ...message,
          intelligenceUiState: {
            ...message.intelligenceUiState,
            [blockId]: state,
          },
        },
  );
}

/** Preserve block identities when raw assistant turns are joined on history load. */
export function shiftIntelligenceUiState(
  state: IntelligenceUiState | undefined,
  offset: number,
): IntelligenceUiState {
  return Object.fromEntries(
    Object.entries(state || {}).map(([key, value]) => [
      /^ui-\d+$/.test(key) ? `ui-${Number(key.slice(3)) + offset}` : key,
      value,
    ]),
  );
}
