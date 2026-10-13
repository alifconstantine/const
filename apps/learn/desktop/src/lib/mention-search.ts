/**
 * Mention search, token grammar, and multi-tier fuzzy scoring for Const Learn.
 * Supports Sources (PDFs, URLs, YouTube, Notes), Studio Artifacts (Mind Map, Quiz, Flashcards,
 * Slides, Reports, Cheatsheets), Workspace Files, and Notebooks.
 */

import type { LocalSource, LocalArtifact, LocalLearn } from "./db";

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

export type MentionCandidateKind = "source" | "artifact" | "directory" | "file" | "media" | "session";

export interface MentionCandidate {
  id: string;
  kind: MentionCandidateKind;
  title: string;
  subtitle?: string;
  insertion: string;
  drillPath?: string;
  drill?: boolean;
  score: number;
  sourceType?: string;
  artifactType?: string;
  fileType?: "code" | "image" | "doc" | "generic";
  updatedAt?: number;
  fullPath?: string;
  sourceId?: string;
  artifactId?: string;
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
 * Format a selected candidate as insertion text.
 */
export function formatMentionInsertion(
  title: string,
  kind: MentionCandidateKind = "source"
): string {
  const clean = title.replace(/[\r\n"]/g, " ").trim();
  if (kind === "directory" && !clean.endsWith("/")) {
    return /\s/u.test(clean) ? `@"${clean}/"` : `@${clean}/`;
  }
  return /\s/u.test(clean) ? `@"${clean}"` : `@${clean}`;
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
 * Score a candidate using multi-tier ranking:
 * - Exact match: 1000
 * - Prefix match: 900
 * - Name substring: 700
 * - Description/path substring: 500
 * - Fuzzy subsequence: 300 + gapScore
 */
export function scoreCandidate(
  name: string,
  fullPathOrDesc: string,
  query: string,
  bonus = 0
): number | null {
  if (query === "") return 0;
  const nameLower = name.toLowerCase();
  const fullLower = fullPathOrDesc.toLowerCase();
  const needle = query.toLowerCase();

  if (nameLower === needle) return 1000 + bonus;
  if (nameLower.startsWith(needle)) return 900 + bonus;
  if (nameLower.includes(needle)) return 700 + bonus;
  if (fullLower.includes(needle)) return 500 + bonus;

  const subseq = subsequenceScore(fullLower, needle);
  if (subseq !== null) {
    return 300 + subseq + bonus;
  }
  return null;
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
  sources?: LocalSource[];
  artifacts?: LocalArtifact[];
  files?: WorkspaceFileEntry[];
  sessionMedia?: SessionMediaItem[];
  learns?: LocalLearn[];
  currentLearnId?: string;
  maxResults?: number;
}

/**
 * Rank and return mention candidates categorized into Sources, Artifacts, Files, and Notebooks.
 */
export function searchMentionCandidates({
  query,
  quoted = false,
  sources = [],
  artifacts = [],
  files = [],
  sessionMedia = [],
  learns = [],
  currentLearnId,
  maxResults = 25,
}: SearchMentionsOptions): MentionCandidate[] {
  const normalizedQuery = query.replace(/\\/g, "/");
  const candidates: MentionCandidate[] = [];

  // 1. Sources (Grounded research materials in the notebook)
  for (const src of sources) {
    const title = src.title || "Untitled Source";
    const typeLabel =
      src.type === "youtube"
        ? "YouTube Video"
        : src.type === "url"
        ? "Web Article"
        : src.type === "file"
        ? "File Document"
        : src.type === "text"
        ? "Note / Text"
        : `${src.type.toUpperCase()} Source`;

    const desc = `${typeLabel} ${src.url || ""} ${src.path || ""}`;
    const score = query === "" ? 800 : scoreCandidate(title, desc, normalizedQuery, 50); // slight source priority bonus
    if (score !== null) {
      candidates.push({
        id: `source_${src.id}`,
        kind: "source",
        title,
        subtitle: typeLabel + (src.size ? ` · ${formatFileSize(src.size)}` : ""),
        insertion: formatMentionInsertion(title, "source"),
        score,
        sourceType: src.type,
        sourceId: src.id,
        updatedAt: src.updatedAt,
      });
    }
  }

  // 2. Studio Artifacts (Mind maps, quizzes, flashcards, slides, etc.)
  for (const art of artifacts) {
    const title = art.title || "Untitled Artifact";
    const typeLabel =
      art.type === "mind_map" || art.type === "mindmap"
        ? "Mind Map"
        : art.type === "quiz"
        ? "Interactive Quiz"
        : art.type === "flashcard" || art.type === "flashcards"
        ? "Flashcards"
        : art.type === "slides" || art.type === "presentation"
        ? "Presentation Slide Deck"
        : art.type === "report"
        ? "Comprehensive Report"
        : art.type === "cheatsheet"
        ? "Cheat Sheet"
        : art.type === "audio_summary"
        ? "Audio Summary"
        : art.type === "video_summary"
        ? "Video Summary"
        : art.type === "infographic"
        ? "Infographic"
        : "Study Artifact";

    const desc = `${typeLabel} ${art.type}`;
    const score = query === "" ? 750 : scoreCandidate(title, desc, normalizedQuery, 30);
    if (score !== null) {
      candidates.push({
        id: `artifact_${art.id}`,
        kind: "artifact",
        title,
        subtitle: typeLabel,
        insertion: formatMentionInsertion(title, "artifact"),
        score,
        artifactType: art.type,
        artifactId: art.id,
        updatedAt: art.updatedAt,
      });
    }
  }

  // 3. Workspace Files & Directories (if any)
  for (const f of files) {
    const isDir = f.kind === "directory";
    const score = query === "" ? (isDir ? 600 : 500) : scoreCandidate(f.name, f.path, normalizedQuery, isDir ? 25 : 0);
    if (score !== null) {
      candidates.push({
        id: `file_${f.id}`,
        kind: isDir ? "directory" : "file",
        title: f.name,
        subtitle: f.path,
        insertion: formatMentionInsertion(f.name, isDir ? "directory" : "file"),
        drillPath: isDir ? f.path : undefined,
        drill: isDir,
        score,
        fileType: f.type,
        fullPath: f.fullPath,
      });
    }
  }

  // 4. Session Media attachments
  for (const media of sessionMedia) {
    const score = query === "" ? 450 : scoreCandidate(media.name, media.path || media.name, normalizedQuery, 0);
    if (score !== null) {
      candidates.push({
        id: `media_${media.id}`,
        kind: "media",
        title: media.name,
        subtitle: media.size ? formatFileSize(media.size) : "Media",
        insertion: formatMentionInsertion(media.name, "media"),
        score,
        fileType: "image",
      });
    }
  }

  // 5. Notebooks / Learns (cross-referencing other notebooks)
  for (const learn of learns) {
    if (learn.id === currentLearnId) continue;
    const title = learn.title || "Untitled Notebook";
    const desc = `${learn.description || ""} ${learn.emoji || ""}`;
    const score = query === "" ? 400 : scoreCandidate(title, desc, normalizedQuery, 0);
    if (score !== null) {
      candidates.push({
        id: `learn_${learn.id}`,
        kind: "session",
        title,
        subtitle: `Notebook · ${learn.sourcesCount || 0} sources`,
        insertion: formatMentionInsertion(title, "session"),
        score,
        updatedAt: learn.updatedAt,
      });
    }
  }

  // Sort by score descending, then by updatedAt descending
  return candidates
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    })
    .slice(0, maxResults);
}
