import { createParser } from "@openuidev/lang-core";
import { intelligenceSchema, validUiState } from "./schema";
import type { IntelligenceUiState } from "./schema";
import { parseWidget } from "./widget-contract";

export interface ResponsePart {
  kind: "markdown" | "ui" | "widget";
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
    | {
        character: string;
        length: number;
        kind: "ui" | "widget" | null;
        offset: number;
      }
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
      const language = match[2]!.trim();
      const kind =
        language === "openui-lang"
          ? "ui"
          : language === "const-widget"
            ? "widget"
            : null;
      if (kind) markdown();
      fence = {
        character: match[1]![0]!,
        length: match[1]!.length,
        kind,
        offset,
      };
      if (!kind) buffer += line;
    } else if (
      fence &&
      match &&
      match[1]![0] === fence.character &&
      match[1]!.length >= fence.length &&
      !match[2]!.trim()
    ) {
      if (fence.kind) {
        parts.push({
          kind: fence.kind,
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
  if (fence?.kind) {
    parts.push({
      kind: fence.kind,
      id: `ui-${fence.offset}`,
      content: buffer,
      complete: false,
    });
  } else {
    // Avoid flashing a partial opening language marker while tokens arrive.
    if (
      streaming &&
      fence &&
      ["openui-lang", "const-widget"].some((language) =>
        language.startsWith(
          buffer
            .split(/\r?\n/)
            .at(-1)
            ?.replace(/^ {0,3}(`{3,}|~{3,})\s*/, "") || "",
        ),
      )
    ) {
      buffer = buffer.slice(0, buffer.lastIndexOf("\n") + 1);
    }
    markdown();
  }
  return parts;
}

const parser = createParser(
  intelligenceSchema.toJSONSchema(),
  intelligenceSchema.root,
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
          return visit(p.children);
        case "CardHeader":
          return [p.title, p.subtitle].filter(Boolean).join(" - ");
        case "Text":
        case "BoldText":
          return [p.value, p.subtext]
            .filter((value) => value != null && value !== "")
            .join(" ");
        case "TextContent":
          return String(p.text ?? "");
        case "Callout":
        case "TextCallout":
          return [p.title, p.description].filter(Boolean).join("\n");
        case "Table": {
          if (Array.isArray(p.columns)) {
            const headers = p.columns.map((c: any) => c.props?.label ?? "");
            const colData = p.columns.map((c: any) =>
              Array.isArray(c.props?.data) ? c.props.data : [],
            );
            const maxRows = Math.max(0, ...colData.map((d: any[]) => d.length));
            const rows: string[] = [];
            for (let i = 0; i < maxRows; i++) {
              rows.push(
                colData
                  .map((d: any[]) => (d[i] == null ? "" : String(d[i])))
                  .join("\t"),
              );
            }
            return [headers.join("\t"), ...rows].join("\n");
          }
          return "";
        }
        case "BarChart":
        case "LineChart":
        case "AreaChart":
        case "HorizontalBarChart":
        case "RadarChart":
        case "RadialChart":
        case "SingleStackedBarChart":
        case "PieChart": {
          if (Array.isArray(p.labels) && Array.isArray(p.values))
            return p.labels
              .map(
                (label, index) =>
                  `${label}: ${(p.values as unknown[])[index] ?? ""}`,
              )
              .join("\n");
          if (Array.isArray(p.labels) && Array.isArray(p.series)) {
            const labels = p.labels as string[];
            const seriesStrs = (p.series as any[]).map((s) => {
              const name = s.props?.category || "";
              const data = (s.props?.values || []) as number[];
              return (
                `${name}: ` +
                labels.map((l, i) => `${l}: ${data[i] ?? ""}`).join(", ")
              );
            });
            return seriesStrs.join("\n");
          }
          return "";
        }
        case "Tabs":
        case "Accordion":
        case "Steps":
          return visit(p.items);
        case "Carousel":
          return visit(p.children);
        case "SectionBlock":
          return visit(p.sections);
        case "TabItem":
        case "AccordionItem":
        case "SectionItem":
          return [p.trigger, visit(p.content)]
            .filter(Boolean)
            .join("\n");
        case "Form":
          return [p.name, visit(p.buttons), visit(p.fields)]
            .filter(Boolean)
            .join("\n");
        case "FormControl":
          return [p.label, visit(p.input)].filter(Boolean).join(": ");
        case "Buttons":
          return visit(p.buttons);
        case "Button":
          return String(p.label ?? "");
        case "FollowUpBlock":
          return visit(p.items);
        case "FollowUpItem":
          return String(p.text ?? "");
        case "Input":
        case "TextArea":
        case "Select":
          return [p.placeholder, p.value, visit(p.items)]
            .filter(Boolean)
            .join("\n");
        case "SelectItem":
          return String(p.label ?? p.value ?? "");
        case "StepsItem":
          return [p.title, p.details].filter(Boolean).join("\n");
        default:
          return Object.entries(p)
            .filter(([key]) =>
              [
                "title",
                "label",
                "text",
                "value",
                "description",
                "alt",
                "children",
                "items",
                "content",
                "datasets",
                "points",
              ].includes(key),
            )
            .map(([, value]) => visit(value))
            .filter(Boolean)
            .join("\n");
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
      part.kind === "ui"
        ? uiProgramToText(part.content)
        : part.kind === "widget"
          ? (() => {
              const widget = parseWidget(part.content);
              return widget ? `${widget.title}\n${widget.description}` : "";
            })()
          : part.content.trim(),
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
  if (!validUiState(state) || !/^ui-\d+$/.test(blockId)) return messages;
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
