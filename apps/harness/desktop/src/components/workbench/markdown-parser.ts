import { Marked, type Token, type Tokens } from "marked";
import { resolveMarkdownLink, markdownLinkHref } from "./markdown-links";

interface Mention { href: string; title: string; kind: string }

/** Extensions run inside Markdown's tokenizer, never inside literal code. */
export function createResponseMarkdown(renderMention: (mention: Mention) => string) {
  return new Marked({ gfm: true, breaks: true,
    extensions: [{
      name: "workspaceMention", level: "inline",
      start(source) { const index = source.search(/@|\[(?:💬|📁|📄)/); return index < 0 ? undefined : index; },
      tokenizer(source) {
        if (this.lexer.state.inLink) return;
        const annotated = /^@\[([^\]\n]+)\]\(([^)\n]+)\)/.exec(source);
        const simple = !annotated && /^@\[([^\]\n]+)\]/.exec(source);
        const standalone = !annotated && !simple && /^@(?:"([^"\n]+)"|([\w./\\-]+\.[\w]+|[\w./\\-]+\/))(?=$|[\s),.?!])/.exec(source);
        const legacy = !annotated && !simple && !standalone && /^\[(?:💬|📁|📄)\s*([^\]]+)\]\(([^)]+)\)/.exec(source);
        const match = annotated || simple || standalone || legacy;
        if (!match) return;
        const path = (annotated || legacy ? match[2] : standalone ? match[1] || match[2] : match[1])!.trim().replace(/\\/g, "/");
        const title = annotated || legacy ? match[1]!.trim() : path.split("/").filter(Boolean).at(-1) || path;
        const session = path.includes("transcript.jsonl") || path.startsWith("brain/");
        const href = session ? `trajectory://${path.match(/brain\/([^/]+)/)?.[1] || path}` : markdownLinkHref(path);
        const target = resolveMarkdownLink(href);
        const kind = session || target.type === "trajectory" ? "session" : target.type === "folder" ? "directory" : target.type === "plugin" ? "plugin" : path.startsWith("skill://") ? "skill" : "file";
        return { type: "workspaceMention", raw: match[0], mention: { href, title, kind } };
      },
      renderer(token) { return renderMention(token.mention as Mention); },
    }],
    renderer: {
      link(token) {
        const href = markdownLinkHref(token.href).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        const title = token.title ? ` title="${token.title.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}"` : "";
        return `<a href="${href}"${title}>${this.parser.parseInline(token.tokens)}</a>`;
      },
    },
  });
}

const detailHeading = /^(?:implementation details|technical details|detail implementasi|detail teknis|detalles de implementaci[oó]n|detalles t[eé]cnicos|実装の詳細|技術的な詳細|实现细节|技术细节)$/i;
export type ResponseSection = { kind: "block"; token: Token } | { kind: "details"; heading: Tokens.Heading; tokens: Token[] };

/** Only an explicit details section collapses; the result and verification stay visible. */
export function responseSections(tokens: Token[], streaming: boolean): ResponseSection[] {
  const sections: ResponseSection[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (!streaming && token.type === "heading" && detailHeading.test(token.text.trim())) {
      const children: Token[] = [];
      while (index + 1 < tokens.length) {
        const next = tokens[index + 1]!;
        if (next.type === "heading" && next.depth <= token.depth) break;
        children.push(next); index++;
      }
      if (children.some(child => child.type !== "space")) { sections.push({ kind: "details", heading: token as Tokens.Heading, tokens: children }); continue; }
    }
    sections.push({ kind: "block", token });
  }
  return sections;
}
