import * as diff from "diff";

export type LineEnding = "\r\n" | "\n";

/**
 * Detect the predominant line-ending style in content. Defaults to LF.
 */
export function detectLineEnding(content: string): LineEnding {
  const crlfIndex = content.indexOf("\r\n");
  const lfIndex = content.indexOf("\n");
  if (lfIndex === -1 || crlfIndex === -1) return "\n";
  return crlfIndex < lfIndex ? "\r\n" : "\n";
}

/**
 * Normalize every line ending to LF.
 */
export function normalizeToLF(text: string): string {
  return text.indexOf("\r") === -1 ? text : text.replace(/\r\n?/g, "\n");
}

/**
 * Re-encode LF text with the requested line ending.
 */
export function restoreLineEndings(text: string, ending: LineEnding): string {
  return ending === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

const NON_ASCII_RE = /[^\x00-\x7F]/;
const UNICODE_REPLACEMENT_RE =
  /[\u00A0\u00BD\u2002-\u200D\u2010-\u201F\u202F\u205F\u2212\u2260\u3000\uFEFF]/g;

function replaceUnicodeCharacter(character: string): string {
  const codePoint = character.charCodeAt(0);
  if ((codePoint >= 0x2010 && codePoint <= 0x2015) || codePoint === 0x2212) return "-";
  if (codePoint >= 0x2018 && codePoint <= 0x201b) return "'";
  if (codePoint >= 0x201c && codePoint <= 0x201f) return '"';
  if (
    codePoint === 0x00a0 ||
    (codePoint >= 0x2002 && codePoint <= 0x200a) ||
    codePoint === 0x202f ||
    codePoint === 0x205f ||
    codePoint === 0x3000
  ) {
    return " ";
  }
  if (codePoint === 0x2260) return "!=";
  if (codePoint === 0x00bd) return "1/2";
  return "";
}

/**
 * Normalizes typographical Unicode characters (smart quotes, em-dashes, non-breaking spaces)
 * into standard ASCII to prevent failed edits caused by model formatting glitches.
 */
export function normalizeUnicode(value: string): string {
  if (!NON_ASCII_RE.test(value)) return value;
  return value.replace(UNICODE_REPLACEMENT_RE, replaceUnicodeCharacter).normalize("NFC");
}

export interface FuzzyEditResult {
  success: boolean;
  resultText?: string;
  matchType?: "exact" | "crlf_normalized" | "unicode_normalized" | "trailing_whitespace" | "fuzzy_indentation" | "multiline_block";
  replacementsCount?: number;
  error?: string;
}

/**
 * Normalizes whitespace on each line (strips trailing whitespace and normalizes spaces/tabs).
 */
function normalizeLineWhitespace(line: string): string {
  return line.replace(/[ \t]+/g, " ").trim();
}

/**
 * Advanced multi-stage fuzzy string replacement engine.
 * Inspired by oh-my-pi's resilient edit system.
 */
export function performFuzzyEdit(
  fileContent: string,
  oldContent: string,
  newContent: string,
  options: { allowMultiple?: boolean } = {}
): FuzzyEditResult {
  if (!oldContent) {
    return { success: false, error: "Empty 'old_content' provided." };
  }

  const originalEol = detectLineEnding(fileContent);

  // -------------------------------------------------------------------------
  // Stage 1: Exact verbatim match
  // -------------------------------------------------------------------------
  const exactCount = (fileContent.match(new RegExp(escapeRegExp(oldContent), "g")) || []).length;
  if (exactCount > 0) {
    if (exactCount > 1 && !options.allowMultiple) {
      return {
        success: false,
        error: `Ambiguity detected: 'old_content' appears ${exactCount} times in this file. Please provide more surrounding context lines to make the match unique, or set 'allow_multiple: true'.`,
      };
    }
    const updated = options.allowMultiple
      ? fileContent.split(oldContent).join(newContent)
      : fileContent.replace(oldContent, newContent);
    return {
      success: true,
      resultText: updated,
      matchType: "exact",
      replacementsCount: options.allowMultiple ? exactCount : 1,
    };
  }

  // -------------------------------------------------------------------------
  // Stage 2: Line ending (CRLF <-> LF) normalized match
  // -------------------------------------------------------------------------
  const lfFileContent = normalizeToLF(fileContent);
  const lfOldContent = normalizeToLF(oldContent);
  const lfNewContent = normalizeToLF(newContent);

  const lfCount = (lfFileContent.match(new RegExp(escapeRegExp(lfOldContent), "g")) || []).length;
  if (lfCount > 0) {
    if (lfCount > 1 && !options.allowMultiple) {
      return {
        success: false,
        error: `Ambiguity detected: 'old_content' appears ${lfCount} times (line-endings normalized). Provide additional surrounding lines.`,
      };
    }
    const updated = options.allowMultiple
      ? lfFileContent.split(lfOldContent).join(lfNewContent)
      : lfFileContent.replace(lfOldContent, lfNewContent);
    return {
      success: true,
      resultText: restoreLineEndings(updated, originalEol),
      matchType: "crlf_normalized",
      replacementsCount: options.allowMultiple ? lfCount : 1,
    };
  }

  // -------------------------------------------------------------------------
  // Stage 3: Unicode normalization (smart quotes, em-dashes, zero-width spaces)
  // -------------------------------------------------------------------------
  const uniFileContent = normalizeUnicode(lfFileContent);
  const uniOldContent = normalizeUnicode(lfOldContent);
  const uniNewContent = normalizeUnicode(lfNewContent);

  if (uniFileContent.includes(uniOldContent)) {
    // Map back to original lines while replacing the segment
    const startIdx = uniFileContent.indexOf(uniOldContent);
    const endIdx = startIdx + uniOldContent.length;

    const before = lfFileContent.slice(0, startIdx);
    const after = lfFileContent.slice(endIdx);
    const updated = before + lfNewContent + after;

    return {
      success: true,
      resultText: restoreLineEndings(updated, originalEol),
      matchType: "unicode_normalized",
      replacementsCount: 1,
    };
  }

  // -------------------------------------------------------------------------
  // Stage 4: Trailing whitespace tolerance
  // -------------------------------------------------------------------------
  const trimTrailingLines = (text: string) =>
    text
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n");

  const trimmedFile = trimTrailingLines(lfFileContent);
  const trimmedOld = trimTrailingLines(lfOldContent);

  if (trimmedFile.includes(trimmedOld)) {
    const fileLines = lfFileContent.split("\n");
    const oldLines = lfOldContent.split("\n").map((l) => l.trimEnd());
    const oldLineCount = oldLines.length;

    let matchLineIdx = -1;
    let matchCount = 0;

    for (let i = 0; i <= fileLines.length - oldLineCount; i++) {
      let isMatch = true;
      for (let j = 0; j < oldLineCount; j++) {
        if (fileLines[i + j]!.trimEnd() !== oldLines[j]) {
          isMatch = false;
          break;
        }
      }
      if (isMatch) {
        matchCount++;
        matchLineIdx = i;
      }
    }

    if (matchCount === 1 && matchLineIdx !== -1) {
      const newLines = lfNewContent.split("\n");
      fileLines.splice(matchLineIdx, oldLineCount, ...newLines);
      return {
        success: true,
        resultText: restoreLineEndings(fileLines.join("\n"), originalEol),
        matchType: "trailing_whitespace",
        replacementsCount: 1,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Stage 5: Resilient Line-by-Line Indentation & Non-Empty Matching
  // -------------------------------------------------------------------------
  const fileLines = lfFileContent.split("\n");
  const oldLines = lfOldContent.split("\n");
  const oldLineCount = oldLines.length;

  if (oldLineCount >= 2) {
    const normOldLines = oldLines.map(normalizeLineWhitespace);
    let bestMatchIdx = -1;
    let bestMatchScore = 0;
    let candidateCount = 0;

    for (let i = 0; i <= fileLines.length - oldLineCount; i++) {
      let exactLineMatches = 0;
      let matches = true;

      for (let j = 0; j < oldLineCount; j++) {
        const fileNorm = normalizeLineWhitespace(fileLines[i + j]!);
        const oldNorm = normOldLines[j]!;

        if (fileNorm === oldNorm) {
          exactLineMatches++;
        } else {
          // If neither line is empty and they differ, break
          if (fileNorm.length > 0 || oldNorm.length > 0) {
            matches = false;
            break;
          }
        }
      }

      if (matches && exactLineMatches >= Math.max(1, oldLineCount - 1)) {
        candidateCount++;
        if (exactLineMatches > bestMatchScore) {
          bestMatchScore = exactLineMatches;
          bestMatchIdx = i;
        }
      }
    }

    if (candidateCount === 1 && bestMatchIdx !== -1) {
      // Determine base indentation of original block to preserve style
      const originalFirstLine = fileLines[bestMatchIdx]!;
      const oldFirstLine = oldLines[0]!;
      const originalIndentMatch = originalFirstLine.match(/^[ \t]*/);
      const oldIndentMatch = oldFirstLine.match(/^[ \t]*/);

      const originalIndent = originalIndentMatch ? originalIndentMatch[0] : "";
      const oldIndent = oldIndentMatch ? oldIndentMatch[0] : "";

      let adjustedNewLines = lfNewContent.split("\n");
      if (originalIndent !== oldIndent && originalIndent.length > 0) {
        adjustedNewLines = adjustedNewLines.map((line) => {
          if (line.startsWith(oldIndent)) {
            return originalIndent + line.slice(oldIndent.length);
          }
          return line;
        });
      }

      fileLines.splice(bestMatchIdx, oldLineCount, ...adjustedNewLines);
      return {
        success: true,
        resultText: restoreLineEndings(fileLines.join("\n"), originalEol),
        matchType: "fuzzy_indentation",
        replacementsCount: 1,
      };
    }
  }

  return {
    success: false,
    error: `Could not find target 'old_content' in file (${fileLines.length} lines total). Exact, whitespace-normalized, and indentation-tolerant matching all failed.`,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resilient unified diff patch application.
 * Uses context scoring and falls back to diff.applyPatch with fuzz factor.
 */
export function applyLooseUnifiedDiff(
  originalText: string,
  patchText: string
): { success: boolean; resultText?: string; error?: string } {
  const originalEol = detectLineEnding(originalText);
  const lfOriginal = normalizeToLF(originalText);
  const lfPatch = normalizeToLF(patchText);

  // Attempt 1: Using built-in diff.applyPatch with fuzz factor
  try {
    const diffResult = diff.applyPatch(lfOriginal, lfPatch, { fuzzFactor: 4 });
    if (typeof diffResult === "string") {
      return {
        success: true,
        resultText: restoreLineEndings(diffResult, originalEol),
      };
    }
  } catch {
    // Continue to manual loose hunk matcher
  }

  // Attempt 2: Manual loose context matching with offset tolerance
  const origLines = lfOriginal.split("\n");
  const patchLines = lfPatch.split("\n");

  let i = 0;
  while (i < patchLines.length && !patchLines[i]!.startsWith("@@")) {
    i++;
  }

  if (i >= patchLines.length) {
    return { success: false, error: "Malformed patch: No hunk header ('@@ -... +... @@') found." };
  }

  const workingLines = [...origLines];
  let lineOffset = 0;

  while (i < patchLines.length) {
    const headerLine = patchLines[i]!;
    if (!headerLine.startsWith("@@")) {
      i++;
      continue;
    }

    const match = headerLine.match(/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (!match) {
      i++;
      continue;
    }

    const oldStart = parseInt(match[1]!, 10);
    let origTargetIdx = oldStart - 1 + lineOffset;
    i++;

    const hunkOps: Array<{ type: " " | "-" | "+"; line: string }> = [];
    while (i < patchLines.length && !patchLines[i]!.startsWith("@@")) {
      const line = patchLines[i]!;
      if (line.startsWith("---") || line.startsWith("+++")) {
        i++;
        continue;
      }
      const marker = line[0];
      if (marker === " " || marker === "-" || marker === "+") {
        hunkOps.push({ type: marker, line: line.slice(1) });
      } else if (line.trim() === "") {
        hunkOps.push({ type: " ", line: "" });
      }
      i++;
    }

    const contextOps = hunkOps.filter((op) => op.type === " " || op.type === "-");
    if (contextOps.length > 0) {
      // Find best anchor position scanning ±50 lines
      let bestIdx = origTargetIdx;
      let bestScore = -1;

      const searchRadius = Math.min(50, workingLines.length);
      const minSearch = Math.max(0, origTargetIdx - searchRadius);
      const maxSearch = Math.min(workingLines.length - 1, origTargetIdx + searchRadius);

      for (let cand = minSearch; cand <= maxSearch; cand++) {
        let score = 0;
        for (let opIdx = 0; opIdx < Math.min(contextOps.length, 5); opIdx++) {
          const testIdx = cand + opIdx;
          if (testIdx < workingLines.length && workingLines[testIdx]?.trim() === contextOps[opIdx]?.line.trim()) {
            score++;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = cand;
        }
      }

      if (bestScore > 0) {
        origTargetIdx = bestIdx;
      }
    }

    const newChunk: string[] = [];
    let currentIdx = Math.max(0, origTargetIdx);
    let removeCount = 0;

    for (const op of hunkOps) {
      if (op.type === " ") {
        newChunk.push(workingLines[currentIdx] ?? op.line);
        currentIdx++;
        removeCount++;
      } else if (op.type === "-") {
        currentIdx++;
        removeCount++;
      } else if (op.type === "+") {
        newChunk.push(op.line);
      }
    }

    workingLines.splice(Math.max(0, origTargetIdx), removeCount, ...newChunk);
    lineOffset += newChunk.length - removeCount;
  }

  return {
    success: true,
    resultText: restoreLineEndings(workingLines.join("\n"), originalEol),
  };
}
