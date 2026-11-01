import type { FileMutationRecord } from "../vite-env";
import type { AttachedFile } from "../components/workbench/chat-card";

export function collectSessionSources(messages: Array<{ role?: string; attachments?: AttachedFile[] }>): AttachedFile[] {
  const sources = new Map<string, AttachedFile>();
  for (const [messageIndex, message] of messages.entries()) {
    if (message.role !== "user") continue;
    for (const [sourceIndex, source] of (message.attachments || []).entries()) {
      if (!source?.name) continue;
      const key = source.path?.replace(/\\/g, "/") || source.id || source.url || `${messageIndex}:${sourceIndex}`;
      if (!sources.has(key)) sources.set(key, { ...source, id: source.id || `attachment_${messageIndex}_${sourceIndex}` });
    }
  }
  return [...sources.values()];
}

/** Present the net change to each file, retaining the original content for review. */
export function collectSessionChanges(mutations: FileMutationRecord[]): FileMutationRecord[] {
  const changes = new Map<string, FileMutationRecord>();
  for (const mutation of mutations) {
    if (mutation.rolledBack) continue;
    const filePath = mutation.filePath || mutation.targetFile;
    const previous = changes.get(filePath);
    changes.set(filePath, previous ? { ...mutation, filePath, previousContent: previous.previousContent,
      operation: previous.previousContent === null ? "create" : mutation.newContent === null ? "delete" : "modify" } : mutation);
  }
  return [...changes.values()].filter(change => change.previousContent !== change.newContent);
}

export type MediaKind = "image" | "video" | "audio" | "pdf" | "document";
export function mediaKind(name: string, type?: string): MediaKind | null {
  if (type && ["image", "video", "audio", "pdf"].includes(type)) return type as MediaKind;
  const extension = name.split(/[?#]/)[0]!.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"].includes(extension)) return "image";
  if (["mp4", "webm", "mov", "m4v", "ogv"].includes(extension)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(extension)) return "audio";
  if (extension === "pdf") return "pdf";
  if (["txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "xml", "html"].includes(extension)) return null;
  if (["doc", "docx", "odt", "ppt", "pptx", "odp", "xls", "xlsx", "ods"].includes(extension) ||
      ["document", "presentation", "spreadsheet"].includes(type || "")) return "document";
  return null;
}

export function localMediaUrl(path: string): string {
  return `const-file://${encodeURI(path.replace(/\\/g, "/")).replace(/[?#]/g, character => encodeURIComponent(character))}`;
}

export function safeMediaUrl(value: string | undefined, kind: MediaKind): string | undefined {
  if (!value) return;
  if (value.startsWith(`data:${kind === "pdf" ? "application/pdf;" : `${kind}/`}`)) return value;
  if (kind !== "pdf" && /^(https?:|blob:)/i.test(value)) return value;
}
