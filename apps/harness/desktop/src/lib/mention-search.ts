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

export interface SessionMediaItem {
  id: string;
  name: string;
  size?: number;
  type?: string;
  url?: string;
  base64?: string;
  path?: string;
}

export type MentionCandidateKind = "directory" | "file" | "media" | "session";

export interface MentionCandidate {
  id: string;
  kind: MentionCandidateKind;
  title: string;
  subtitle?: string;
  insertion: string;
  drillPath?: string;
  drill?: boolean;
  score: number;
  fileType?: "code" | "image" | "doc" | "generic";
  updatedAt?: number;
  fullPath?: string;
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

  // Exclude completed/bracketed mention tokens @[...]
  if (/@[^\]\s]*\]$/.test(beforeCursor)) {
    return null;
  }

  // 1. Quoted mention: @"...
  const quotedMatch = /(?:^|\s)(@"([^"]*))$/u.exec(beforeCursor);
  if (quotedMatch && quotedMatch[1] !== undefined && quotedMatch[2] !== undefined) {
    const prefix = quotedMatch[1];
    const query = quotedMatch[2];
    const startCol = cursorPosition - prefix.length;
    return { prefix, query, quoted: true, startCol, endCol: cursorPosition };
  }

  // 2. Plain mention: @... (excludes bracketed @[path])
  const plainMatch = /(?:^|\s)(@([^\s\[][^\s]*|))$/u.exec(beforeCursor);
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
  kind: "file" | "directory" | "media" = "file",
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

/**
 * Matches a conversation's project attribute with current active project.
 */
export function matchesProject(convoProject?: string, currentProject?: string): boolean {
  if (!currentProject || currentProject === "Outside Project") {
    return !convoProject || convoProject === "Outside Project";
  }
  if (!convoProject || convoProject === "Outside Project") {
    return false;
  }
  const normConvo = convoProject.replace(/\\/g, "/").toLowerCase().trim();
  const normCurrent = currentProject.replace(/\\/g, "/").toLowerCase().trim();
  if (normConvo === normCurrent) return true;
  const convoBase = normConvo.split("/").filter(Boolean).pop();
  const currentBase = normCurrent.split("/").filter(Boolean).pop();
  return Boolean(convoBase && currentBase && convoBase === currentBase);
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface SearchMentionsOptions {
  query: string;
  quoted?: boolean;
  files?: WorkspaceFileEntry[];
  sessionMedia?: SessionMediaItem[];
  conversations?: ConversationItem[];
  currentProject?: string;
  maxResults?: number;
}

/**
 * Rank and return mention candidates categorized into Files & Folders and Sessions.
 * Only sessions belonging to currentProject are included.
 */
export function searchMentionCandidates({
  query,
  quoted = false,
  files = [],
  sessionMedia = [],
  conversations = [],
  currentProject,
  maxResults = 25,
}: SearchMentionsOptions): MentionCandidate[] {
  const isOutsideProject = !currentProject || currentProject === "Outside Project";
  const normalizedQuery = query.replace(/\\/g, "/");
  const lastSlashIndex = normalizedQuery.lastIndexOf("/");
  const hasSlash = lastSlashIndex >= 0;

  const filesAndFolders: MentionCandidate[] = [];
  const sessionCandidates: MentionCandidate[] = [];

  // 1. Process Workspace Files & Folders
  if (!isOutsideProject && files.length > 0) {
    if (normalizedQuery === "" || hasSlash) {
      // Directory-scoped listing (e.g. root items if query="", or children of folder if query has slash)
      const targetDir = hasSlash ? normalizedQuery.slice(0, lastSlashIndex) : "";
      const fragment = hasSlash ? normalizedQuery.slice(lastSlashIndex + 1) : "";

      for (const file of files) {
        const fileParent = (file.parentDir || "").replace(/\\/g, "/");
        const isChild =
          targetDir === ""
            ? fileParent === "" || !file.path.includes("/")
            : fileParent.toLowerCase() === targetDir.toLowerCase();

        if (!isChild) continue;

        const isDir = file.kind === "directory";
        let score: number | null = 0;
        if (fragment !== "") {
          score = scoreCandidate(file.name, file.path, fragment, isDir);
        } else {
          // Directories listed first, then files
          score = isDir ? 800 : 700;
        }

        if (score !== null) {
          const displayTitle = isDir && !file.name.endsWith("/") ? `${file.name}/` : file.name;
          const drillPath = isDir ? (file.path.endsWith("/") ? file.path : `${file.path}/`) : undefined;

          filesAndFolders.push({
            id: `file:${file.fullPath || file.path}`,
            kind: isDir ? "directory" : "file",
            title: displayTitle,
            subtitle: targetDir ? undefined : file.parentDir,
            insertion: formatFileMention(file.path, isDir ? "directory" : "file", quoted),
            drillPath,
            drill: isDir,
            score,
            fileType: file.type || "generic",
            fullPath: file.fullPath,
          });
        }
      }
    } else {
      // Global fuzzy search across all files and folders
      for (const file of files) {
        const isDir = file.kind === "directory";
        const score = scoreCandidate(file.name, file.path, normalizedQuery, isDir);

        if (score !== null) {
          const displayTitle = isDir && !file.name.endsWith("/") ? `${file.name}/` : file.name;
          const drillPath = isDir ? (file.path.endsWith("/") ? file.path : `${file.path}/`) : undefined;

          filesAndFolders.push({
            id: `file:${file.fullPath || file.path}`,
            kind: isDir ? "directory" : "file",
            title: displayTitle,
            subtitle: file.parentDir || undefined,
            insertion: formatFileMention(file.path, isDir ? "directory" : "file", quoted),
            drillPath,
            drill: isDir,
            score,
            fileType: file.type || "generic",
            fullPath: file.fullPath,
          });
        }
      }
    }
  }

  // 2. Process Session Uploaded Media (only if not drilling deeper in folders)
  if (!hasSlash && sessionMedia.length > 0) {
    for (const media of sessionMedia) {
      if (!media.name) continue;
      let score: number | null = 0;
      if (normalizedQuery === "") {
        score = 850; // Pin session media right beside top files
      } else {
        score = scoreCandidate(media.name, media.name, normalizedQuery, false);
      }

      if (score !== null) {
        const sizeLabel = media.size ? formatFileSize(media.size) : "";
        filesAndFolders.push({
          id: `media:${media.id || media.name}`,
          kind: "media",
          title: media.name,
          subtitle: sizeLabel ? `Media · ${sizeLabel}` : "Uploaded media",
          insertion: formatFileMention(media.name, "media", quoted),
          score,
          fileType: "image",
          fullPath: media.path || media.url,
        });
      }
    }
  }

  // Sort files and folders: highest score first, directories before files, shorter name wins
  filesAndFolders.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.kind === "directory" && b.kind !== "directory") return -1;
    if (b.kind === "directory" && a.kind !== "directory") return 1;
    return a.title.localeCompare(b.title);
  });

  // 3. Process Past Conversations / Sessions (STRICTLY for current project only!)
  // If user is currently typing a subpath (e.g. @dir/file), do not show sessions
  if (!hasSlash && conversations.length > 0) {
    const projectSessions = conversations.filter((c) => matchesProject(c.project, currentProject));

    for (const convo of projectSessions) {
      const cleanTitle = getCleanConversationTitle(convo.title);
      let score: number | null = 0;

      if (normalizedQuery === "") {
        const timeVal = convo.updatedAt || convo.createdAt || 0;
        score = Math.max(100, 600 - Math.min(300, Math.round((Date.now() - timeVal) / (1000 * 60 * 60 * 24))));
      } else {
        score = scoreCandidate(cleanTitle, cleanTitle, normalizedQuery, false);
      }

      if (score !== null) {
        const timeAgo = formatRelativeTime(convo.updatedAt || convo.createdAt);
        const projectDisplay =
          convo.project && convo.project !== "Outside Project"
            ? convo.project
            : undefined;
        const subtitle = projectDisplay ? `${projectDisplay} · ${timeAgo}` : timeAgo;

        sessionCandidates.push({
          id: `session:${convo.id}`,
          kind: "session",
          title: cleanTitle,
          subtitle,
          insertion: formatSessionMention(cleanTitle),
          score,
          updatedAt: convo.updatedAt || convo.createdAt,
        });
      }
    }

    sessionCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  // Combine: Files & Folders first, followed by Sessions, capped at maxResults
  const combined = [...filesAndFolders.slice(0, 16), ...sessionCandidates.slice(0, 8)];
  return combined.slice(0, maxResults);
}
