import { z } from "zod/v4";
import { UI_PROGRAM_LIMIT, validUiState } from "./schema";

export const widgetSchema = z
  .object({
    version: z.literal(1),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(2000),
    css: z.string().max(40_000),
    html: z.string().min(1).max(100_000),
    js: z.string().max(60_000),
    initialState: z.custom<Record<string, unknown>>(validUiState).default({}),
    libraries: z
      .array(z.enum(["three", "d3", "chart.js", "leaflet"]))
      .max(4)
      .default([]),
  })
  .strict();
export type WidgetDocument = z.infer<typeof widgetSchema>;

export function parseWidget(source: string): WidgetDocument | null {
  if (source.length > UI_PROGRAM_LIMIT) return null;
  try {
    const result = widgetSchema.safeParse(JSON.parse(source));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Only complete top-level JSON values enter a script-free streaming preview. */
export function widgetPreview(
  source: string,
): Pick<WidgetDocument, "title" | "css" | "html"> | null {
  if (source.length > UI_PROGRAM_LIMIT || !source.trimStart().startsWith("{"))
    return null;
  let index = source.indexOf("{") + 1;
  const fields: Record<string, unknown> = {};
  const whitespace = () => {
    while (/\s/.test(source[index] || "") && index < source.length) index++;
  };
  const stringEnd = (start: number) => {
    for (let i = start + 1; i < source.length; i++) {
      if (source[i] === "\\") i++;
      else if (source[i] === '"') return i + 1;
    }
    return -1;
  };
  try {
    while (index < source.length) {
      whitespace();
      if (source[index] !== '"') break;
      const end = stringEnd(index);
      if (end < 0) break;
      const key = JSON.parse(source.slice(index, end));
      index = end;
      whitespace();
      if (source[index++] !== ":") break;
      whitespace();
      const start = index;
      if (source[index] === '"') {
        index = stringEnd(index);
        if (index < 0) break;
      } else {
        let depth = 0;
        for (; index < source.length; index++) {
          const c = source[index];
          if (c === '"') {
            const next = stringEnd(index);
            if (next < 0) return null;
            index = next - 1;
          } else if (c === "{" || c === "[") depth++;
          else if (c === "}" || c === "]") {
            if (depth === 0) break;
            depth--;
          } else if (c === "," && depth === 0) break;
        }
      }
      const value = JSON.parse(source.slice(start, index));
      if (["title", "css", "html"].includes(key)) fields[key] = value;
      whitespace();
      if (source[index++] !== ",") break;
    }
  } catch {
    /* An unfinished JSON value is expected during generation. */
  }
  return typeof fields.html === "string" &&
    typeof fields.css === "string" &&
    fields.html.length <= 100_000 &&
    fields.css.length <= 40_000
    ? {
        title:
          typeof fields.title === "string" ? fields.title.slice(0, 200) : "",
        css: fields.css,
        html: fields.html,
      }
    : null;
}

export function safeWidgetLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4000) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export type WidgetMessage =
  | { type: "ready" }
  | { type: "resize"; height: number }
  | { type: "state"; state: Record<string, unknown> }
  | { type: "snapshot"; state: Record<string, unknown>; requestId: string }
  | { type: "followUp"; text: string }
  | { type: "openLink"; url: string }
  | { type: "error" };

export function parseWidgetMessage(
  value: unknown,
  channel: string,
): WidgetMessage | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  if (m.channel !== channel) return null;
  switch (m.type) {
    case "ready":
    case "error":
      return { type: m.type };
    case "resize":
      return typeof m.height === "number" && Number.isFinite(m.height)
        ? {
            type: "resize",
            height: Math.max(120, Math.min(2400, Math.ceil(m.height))),
          }
        : null;
    case "state":
      return validUiState(m.state) ? { type: "state", state: m.state } : null;
    case "snapshot":
      return validUiState(m.state) &&
        typeof m.requestId === "string" &&
        /^[a-f0-9-]{36}$/.test(m.requestId)
        ? { type: "snapshot", state: m.state, requestId: m.requestId }
        : null;
    case "followUp":
      return typeof m.text === "string" &&
        !!m.text.trim() &&
        m.text.length <= 4000
        ? { type: "followUp", text: m.text.trim() }
        : null;
    case "openLink": {
      const url = safeWidgetLink(m.url);
      return url ? { type: "openLink", url } : null;
    }
    default:
      return null;
  }
}
