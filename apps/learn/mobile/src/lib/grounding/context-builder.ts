/**
 * Grounded Context Builder for Const Learn Mobile.
 * Assembles verified active sources from the local Dexie store into
 * high-fidelity structured context for Gemini 2.5/3.8 Flash inference.
 */

import type { LocalSource } from "../db";

export interface GroundedContextResult {
  formattedContext: string;
  sourceIds: string[];
  activeSources: LocalSource[];
  totalEstimatedTokens: number;
  isTruncated: boolean;
}

const MAX_CONTEXT_TOKENS = 600000; // Generous budget well within Gemini's 1M token window

/**
 * Estimate token count roughly (average ~3.8 characters per token for mixed EN/ID text).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Formats active sources into a structured, easily parsed grounding context block.
 */
export function buildGroundedContext(
  sources: LocalSource[],
  maxTokens: number = MAX_CONTEXT_TOKENS
): GroundedContextResult {
  const activeSources = sources.filter((s) => s.includedInChat !== false);

  if (activeSources.length === 0) {
    return {
      formattedContext: "",
      sourceIds: [],
      activeSources: [],
      totalEstimatedTokens: 0,
      isTruncated: false,
    };
  }

  const sourceIds: string[] = [];
  const renderedBlocks: string[] = [];
  let currentTokenEstimate = 0;
  let isTruncated = false;

  for (const src of activeSources) {
    const rawId = src.id;
    sourceIds.push(rawId);

    const contentText = (src.content || "").trim();
    const snippetOrNotice = contentText
      ? contentText
      : `[Content is not locally cached. URL reference: ${src.url || "N/A"}]`;

    const blockHeader = `=== SOURCE RECORD: ${rawId} ===\nTitle: "${src.title}"\nType: ${src.type}${src.url ? `\nURL: ${src.url}` : ""}\nContent:\n`;
    const blockFooter = `\n=== END SOURCE RECORD: ${rawId} ===\n`;

    const fullBlock = `${blockHeader}${snippetOrNotice}${blockFooter}`;
    const blockTokens = estimateTokens(fullBlock);

    if (currentTokenEstimate + blockTokens <= maxTokens) {
      renderedBlocks.push(fullBlock);
      currentTokenEstimate += blockTokens;
    } else {
      // Truncate remaining space for this source
      const remainingTokens = Math.max(0, maxTokens - currentTokenEstimate - 100);
      if (remainingTokens > 500) {
        const allowedChars = Math.floor(remainingTokens * 3.5);
        const truncatedContent = snippetOrNotice.slice(0, allowedChars);
        const partialBlock = `${blockHeader}${truncatedContent}\n\n[...Source content truncated to fit token budget...]${blockFooter}`;
        renderedBlocks.push(partialBlock);
        currentTokenEstimate += remainingTokens;
      }
      isTruncated = true;
      break;
    }
  }

  const formattedContext = `## SOURCE CONTEXT\nBelow is the verified study material provided by the student. Use this material as your primary factual ground truth:\n\n${renderedBlocks.join(
    "\n"
  )}\n\n[MANDATORY CITATION INSTRUCTION:\nEvery time you explain, summarize, or reference information from these sources, you MUST append the exact source citation tag [source:<id>] (for example: [source:${sourceIds[0] || "source_123"}]) directly after the sentence or bullet point. Do not omit citations!]`;

  return {
    formattedContext,
    sourceIds,
    activeSources,
    totalEstimatedTokens: currentTokenEstimate,
    isTruncated,
  };
}
