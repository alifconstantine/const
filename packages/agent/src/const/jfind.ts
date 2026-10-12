import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export interface JFindHit {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  reason?: string;
}

export interface JFindResult {
  query: string;
  totalHits: number;
  hits: JFindHit[];
  formatted: string;
}

export interface JFindOptions {
  query: string;
  path?: string;
  keywords?: string[];
  limit?: number;
  maxFiles?: number;
}

const COMMON_IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".const",
  ".omp",
  "coverage",
  "out",
  ".cache",
]);

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".json",
  ".yaml",
  ".yml",
  ".md",
  ".sql",
  ".sh",
  ".bash",
]);

/**
 * Tokenize query text into meaningful lowercased identifier and word tokens.
 */
function extractQueryTokens(query: string, additionalKeywords?: string[]): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const extra = (additionalKeywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean);
  const combined = new Set([...words, ...extra]);

  // Remove generic stop words
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "which",
    "where", "how", "what", "code", "file", "find", "search", "does",
    "will", "when", "into", "over", "each", "some", "function", "class"
  ]);

  return Array.from(combined).filter((w) => !stopWords.has(w) && w.length >= 2);
}

/**
 * Recursively find code files in target directory up to a max file limit.
 */
async function collectFiles(
  dir: string,
  baseDir: string,
  maxFiles: number,
  collected: string[] = []
): Promise<string[]> {
  if (collected.length >= maxFiles) return collected;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return collected;
  }

  for (const entry of entries) {
    if (collected.length >= maxFiles) break;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!COMMON_IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        await collectFiles(fullPath, baseDir, maxFiles, collected);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTENSIONS.has(ext)) {
        collected.push(fullPath);
      }
    }
  }

  return collected;
}

/**
 * Semantic & Lexical Passage Search (jfind).
 * Inspired by oh-my-pi's jfind cascade engine.
 * Ranks code regions by keyword heat, passage relevance, and semantic cues.
 */
export async function executeJFind(
  options: JFindOptions,
  workspacePath: string
): Promise<JFindResult> {
  const { query, keywords = [], limit = 6, maxFiles = 300 } = options;
  const targetDir = options.path
    ? path.resolve(workspacePath, options.path)
    : workspacePath;

  const queryTokens = extractQueryTokens(query, keywords);
  if (queryTokens.length === 0) {
    return {
      query,
      totalHits: 0,
      hits: [],
      formatted: `No distinct search tokens found in query: "${query}".`,
    };
  }

  const files = await collectFiles(targetDir, targetDir, maxFiles);
  const hits: JFindHit[] = [];

  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      if (stat.size > 2 * 1024 * 1024) continue; // Skip files > 2MB

      const content = await fs.readFile(file, "utf-8");
      const lines = content.split(/\r?\n/);
      const relPath = path.relative(workspacePath, file);

      // Check if file name itself matches any tokens (boost)
      let fileNameBoost = 0;
      const lowerRel = relPath.toLowerCase();
      for (const token of queryTokens) {
        if (lowerRel.includes(token)) fileNameBoost += 3.0;
      }

      // Slide a window over the file (window size ~30 lines, stride 15 lines)
      const windowSize = 30;
      const stride = 15;

      for (let i = 0; i < lines.length; i += stride) {
        const windowLines = lines.slice(i, i + windowSize);
        const windowText = windowLines.join("\n").toLowerCase();

        let tokenMatches = 0;
        let totalOccurrences = 0;

        for (const token of queryTokens) {
          const regex = new RegExp(`\\b${escapeRegExp(token)}\\b`, "gi");
          const occurrences = (windowText.match(regex) || []).length;
          if (occurrences > 0) {
            tokenMatches++;
            totalOccurrences += occurrences;
          } else if (windowText.includes(token)) {
            tokenMatches += 0.5;
            totalOccurrences += 1;
          }
        }

        if (tokenMatches > 0) {
          // Score formula: diversity of tokens * frequency + file boost
          const coverageRatio = tokenMatches / queryTokens.length;
          const score = (coverageRatio * 5.0) + Math.min(totalOccurrences, 10) * 0.5 + fileNameBoost;

          if (score > 1.5) {
            const startLine = i + 1;
            const endLine = Math.min(lines.length, i + windowSize);

            // Extract formatted preview
            const preview = windowLines
              .slice(0, 15)
              .map((l, lineIdx) => `${startLine + lineIdx} | ${l}`)
              .join("\n");

            hits.push({
              path: relPath,
              startLine,
              endLine,
              score,
              snippet: preview,
            });
          }
        }
      }
    } catch {
      // ignore read failures on individual files
    }
  }

  // Sort by score descending and take top hits
  hits.sort((a, b) => b.score - a.score);
  const topHits = hits.slice(0, limit);

  if (topHits.length === 0) {
    return {
      query,
      totalHits: 0,
      hits: [],
      formatted: `No matching code passages found for query "${query}".\nTokens searched: ${queryTokens.join(", ")}\nFiles scanned: ${files.length}.`,
    };
  }

  const formattedLines: string[] = [
    `# Semantic Search (jfind) for: "${query}"`,
    `Found ${hits.length} relevant passage(s) across ${files.length} scanned files. Showing top ${topHits.length}:`,
    "",
  ];

  for (let idx = 0; idx < topHits.length; idx++) {
    const hit = topHits[idx]!;
    formattedLines.push(
      `## Hit ${idx + 1}: ${hit.path} (Lines ${hit.startLine}-${hit.endLine}) [Relevance: ${hit.score.toFixed(1)}]`,
      "```",
      hit.snippet,
      "```",
      ""
    );
  }

  return {
    query,
    totalHits: hits.length,
    hits: topHits,
    formatted: formattedLines.join("\n"),
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
