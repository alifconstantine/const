/**
 * Mention search, token grammar, and multi-tier fuzzy scoring for Const Harness.
 * Ported and adapted from DeepSeek Harness reference architecture.
 */

import type { ConversationItem } from "./conversation-store";
import { formatRelativeTime, getCleanConversationTitle } from "./conversation-store";

export interface WorkspaceFileEntry {
  id: string;
  name: string;
  path: string;
  parentDir?: string;
  fullPath: string;
  type?: "code" | "image" | "doc" | "generic";
  kind?: "file" | "directory";
}

export type MentionCandidateKind = "file" | "directory" | "session" | "tool";

export interface MentionCandidate {
  id: string;
  kind: MentionCandidateKind;
  title: string;
  subtitle?: string;
  insertion: string;
  score: number;
  fileType?: "code" | "image" | "doc" | "generic";
  updatedAt?: number;
  fullPath?: string;
  badge?: string;
}

export interface ActiveAtToken {
  /** Complete token replaced when the user accepts a completion. */
  prefix: string;
  /** Path/entity query after `@` or `@"`. */
  query: string;
  /** Whether the user opened a quoted mention. */
  quoted: boolean;
  /** Start index of the `@` token in the editor text. */
  startCol: number;
  /** End index (cursor column) of the token. */
  endCol: number;
}

/**
 * Extract an `@path` or `@"path with spaces` token at the cursor.
 * An `@` inside another token (like an email address) is not a trigger.
 */
export function activeAtToken(text: string, cursorPosition: number): ActiveAtToken | null {
  if (cursorPosition < 0 || cursorPosition > text.length) return null;
  const beforeCursor = text.slice(0, cursorPosition);

  // 1. Quoted mention: @"...
  const quotedMatch = /(?:^|\s)(@"([^"]*))$/u.exec(beforeCursor);
  if (quotedMatch && quotedMatch[1] !== undefined && quotedMatch[2] !== undefined) {
    const prefix = quotedMatch[1];
    const query = quotedMatch[2];
    const startCol = cursorPosition - prefix.length;
    return { prefix, query, quoted: true, startCol, endCol: cursorPosition };
  }

  // 2. Plain mention: @...
  const plainMatch = /(?:^|\s)(@([^\s]*))$/u.exec(beforeCursor);
  if (plainMatch && plainMatch[1] !== undefined && plainMatch[2] !== undefined) {
    const prefix = plainMatch[1];
    const query = plainMatch[2];
    const startCol = cursorPosition - prefix.length;
    return { prefix, query, quoted: false, startCol, endCol: cursorPosition };
  }

  return null;
}

/**
 * Format a selected file or directory path as prompt text.
 * Whitespace uses the quoted `@"path"` grammar; a quoted directory keeps that quote
 * open after its trailing slash so completion can descend another level.
 */
export function formatFileMention(
  path: string,
  kind: "file" | "directory" = "file",
  preserveQuote = false
): string {
  const normalized = path.replace(/\\/g, "/");
  const cleanPath = kind === "directory" && !normalized.endsWith("/") ? `${normalized}/` : normalized;
  if (/[\u0000-\u001f\u007f-\u009f"]/u.test(cleanPath)) return `@${cleanPath}`;
  const needsQuote = preserveQuote || /\s/u.test(cleanPath);
  if (!needsQuote) {
    return `@${cleanPath}`;
  }
  if (kind === "directory") {
    return `@"${cleanPath}`;
  }
  return `@"${cleanPath}"`;
}

/**
 * Format a session reference as prompt text.
 */
export function formatSessionMention(title: string): string {
  const clean = title.replace(/[\r\n"]/g, " ").trim();
  return `@"${clean}"`;
}

/**
 * Calculate subsequence match score between target string and query needle.
 * Returns null if needle is not a subsequence.
 */
export function subsequenceScore(target: string, query: string): number | null {
  let targetIndex = 0;
  let gap = 0;
  for (const character of query) {
    const found = target.indexOf(character, targetIndex);
    if (found < 0) return null;
    gap += found - targetIndex;
    targetIndex = found + 1;
  }
  return Math.max(0, 100 - gap);
}

/**
 * Score a candidate using deepseek-harness multi-tier ranking:
 * - Exact match: 1000 (+25 directory)
 * - Prefix match: 900 (+25 directory)
 * - Name substring: 700 (+25 directory)
 * - Path / description substring: 500 (+25 directory)
 * - Fuzzy subsequence: 300 + gapScore (+25 directory)
 */
export function scoreCandidate(
  name: string,
  fullPathOrDesc: string,
  query: string,
  isDirectory = false
): number | null {
  if (query === "") return 0;
  const nameLower = name.toLowerCase();
  const fullLower = fullPathOrDesc.toLowerCase();
  const needle = query.toLowerCase();
  const directoryBonus = isDirectory ? 25 : 0;

  if (nameLower === needle) return 1000 + directoryBonus;
  if (nameLower.startsWith(needle)) return 900 + directoryBonus;
  if (nameLower.includes(needle)) return 700 + directoryBonus;
  if (fullLower.includes(needle)) return 500 + directoryBonus;

  const subseq = subsequenceScore(fullLower, needle);
  if (subseq !== null) {
    return 300 + subseq + directoryBonus;
  }
  return null;
}

export const SPECIAL_TOOLS: Array<{
  id: string;
  name: string;
  title: string;
  description: string;
  insertion: string;
}> = [
  {
    id: "tool-browser",
    name: "browser",
    title: "browser",
    description: "Browse the web, inspect web pages, search Google",
    insertion: "@browser ",
  },
  {
    id: "tool-terminal",
    name: "terminal",
    title: "terminal",
    description: "Run terminal commands and CLI workflows in workspace",
    insertion: "@terminal ",
  },
];

export interface SearchMentionsOptions {
  query: string;
  quoted?: boolean;
  files?: WorkspaceFileEntry[];
  conversations?: ConversationItem[];
  currentProject?: string;
  maxResults?: number;
}

/**
 * Rank and return top mention candidates across workspace files, sessions, and tools.
 */
export function searchMentionCandidates({
  query,
  quoted = false,
  files = [],
  conversations = [],
  currentProject,
  maxResults = 20,
}: SearchMentionsOptions): MentionCandidate[] {
  const ranked: MentionCandidate[] = [];
  const isOutsideProject = !currentProject || currentProject === "Outside Project";
  const now = Date.now();

  // 1. Process Special Tools
  for (const tool of SPECIAL_TOOLS) {
    if (quoted) continue; // tools are not quoted
    let score: number | null = null;
    if (query === "") {
      score = 1100; // Pin tools near top on empty query
    } else {
      score = scoreCandidate(tool.name, tool.description, query, false);
    }
    if (score !== null) {
      ranked.push({
        id: tool.id,
        kind: "tool",
        title: `@${tool.title}`,
        subtitle: tool.description,
        insertion: tool.insertion,
        score,
        badge: "tool",
      });
    }
  }

  // 2. Process Workspace Files & Folders (only if not outside project)
  if (!isOutsideProject && files.length > 0) {
    for (const file of files) {
      const isDir = file.kind === "directory";
      const slashIdx = file.path.lastIndexOf("/");
      const parentDir = slashIdx >= 0 ? file.path.slice(0, slashIdx) : "";

      let score: number | null = null;
      if (query === "") {
        // Bias root items and directories slightly when query is empty
        const depth = file.path.split("/").length;
        score = Math.max(10, 800 - depth * 50 + (isDir ? 30 : 0));
      } else {
        score = scoreCandidate(file.name, file.path, query, isDir);
      }

      if (score !== null) {
        ranked.push({
          id: `file:${file.fullPath || file.path}`,
          kind: isDir ? "directory" : "file",
          title: file.name + (isDir ? "/" : ""),
          subtitle: parentDir || "workspace root",
          insertion: formatFileMention(file.path, isDir ? "directory" : "file", quoted),
          score,
          fileType: file.type || "generic",
          fullPath: file.fullPath,
          badge: isDir ? "dir" : "file",
        });
      }
    }
  }

  // 3. Process Past Conversations / Sessions
  if (conversations.length > 0) {
    for (const convo of conversations) {
      const cleanTitle = getCleanConversationTitle(convo.title);
      let score: number | null = null;
      if (query === "") {
        // Show recent sessions near top on empty query
        const ageHours = Math.max(0, (now - (convo.updatedAt || convo.createdAt)) / (1000 * 60 * 60));
        score = Math.max(50, 950 - Math.min(400, Math.round(ageHours * 5)));
      } else {
        score = scoreCandidate(cleanTitle, cleanTitle, query, false);
      }

      if (score !== null) {
        const timeAgo = formatRelativeTime(convo.updatedAt || convo.createdAt);
        const projectTag =
          convo.project && convo.project !== "Outside Project"
            ? convo.project.replace(/\\/g, "/").split("/").filter(Boolean).pop()
            : undefined;
        const subtitle = projectTag ? `${projectTag} · ${timeAgo}` : timeAgo;

        ranked.push({
          id: `session:${convo.id}`,
          kind: "session",
          title: cleanTitle,
          subtitle,
          insertion: formatSessionMention(cleanTitle),
          score,
          updatedAt: convo.updatedAt || convo.createdAt,
          badge: "session",
        });
      }
    }
  }

  // Sort candidates deterministically
  ranked.sort((left, right) => {
    // 1. Higher score first
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    // 2. Tools first on tie
    if (left.kind === "tool" && right.kind !== "tool") return -1;
    if (right.kind === "tool" && left.kind !== "tool") return 1;
    // 3. Directories before files
    if (left.kind === "directory" && right.kind === "file") return -1;
    if (right.kind === "directory" && left.kind === "file") return 1;
    // 4. Shorter path / title length wins
    const leftLen = left.subtitle ? left.title.length + left.subtitle.length : left.title.length;
    const rightLen = right.subtitle ? right.title.length + right.subtitle.length : right.title.length;
    if (leftLen !== rightLen) {
      return leftLen - rightLen;
    }
    // 5. Alphabetical tie breaker
    return left.title.localeCompare(right.title);
  });

  return ranked.slice(0, maxResults);
}
