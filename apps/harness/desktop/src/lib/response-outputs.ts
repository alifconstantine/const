import { marked } from "marked";
import type { FileMutationRecord } from "../vite-env";
import { resolveMarkdownLink } from "../components/workbench/markdown-links";

/** Offer previews only for deliverables named in the answer and actually written. */
export function collectResponseOutputs(content: string, mutations: FileMutationRecord[] = []): string[] {
  const references: string[] = [];
  marked.walkTokens(marked.lexer(content), token => {
    if (token.type === "codespan") references.push(token.text);
    if (token.type === "link") {
      const target = resolveMarkdownLink(token.href);
      if (target.type === "file") references.push(target.path);
    }
  });
  const normalize = (value: string) => value.replace(/\\/g, "/").replace(/^\.\//, "");
  const paths = mutations.filter(record => !record.rolledBack && record.operation !== "delete")
    .map(record => record.filePath || record.targetFile)
    .filter(path => /\.(?:html?|svg|png|jpe?g|webp|gif|pdf|docx?|xlsx?|pptx?|csv|mp[34]|wav|webm)$/i.test(path))
    .filter(path => references.some(reference => normalize(path) === normalize(reference) || normalize(path).endsWith("/" + normalize(reference))));
  return [...new Set(paths)].slice(0, 3);
}
