/**
 * Intelligent search query decomposition for Multi Tool Call to Const Search.
 * Supports Indonesian and English multi-clause queries, entity lists, and comparative prompts.
 */

export function cleanSearchClause(clause: string): string {
  return clause
    .replace(
      /^(temukan|carikan|cari|siapa|siapakah|apa|apakah|bagaimana|jelaskan|tolong cari|search for|find|who is|what is|tell me about|explain)\s+(itu\s+|tentang\s+|mengenai\s+|siapa\s+|apa\s+)?/i,
      ""
    )
    .replace(/[?!.]+$/, "")
    .trim();
}

export function decomposeSearchQueries(rawPrompt: string, isDeepResearch = false): string[] {
  const text = rawPrompt.trim();
  if (!text) return [];

  const queries: string[] = [];

  // 1. Check for multiple distinct questions or clauses
  // e.g. "apa itu Convex? dan bagaimana auth di Convex bekerja?"
  const majorSplitPattern =
    /(?:\?+|\n+|;\s*|,\s*(?:dan|and|serta)\s+(?:temukan|carikan|cari|siapa|apa|bagaimana|find|who|what|tell)|\s+(?:dan|and|serta)\s+(?:temukan|carikan|cari|siapa|apa|bagaimana|find|who|what|tell))/i;

  const rawClauses = text.split(majorSplitPattern).map((c) => c.trim()).filter(Boolean);
  const distinctClauses = rawClauses
    .map(cleanSearchClause)
    .filter((q) => q.length >= 3);

  if (distinctClauses.length > 1) {
    const maxClauseQueries = isDeepResearch ? 4 : 3;
    for (const clause of distinctClauses) {
      if (!queries.includes(clause)) {
        queries.push(clause);
      }
      if (queries.length >= maxClauseQueries) break;
    }
    if (queries.length > 1) return queries;
  }

  const cleanedText = cleanSearchClause(text);

  // 2. Check for multi-entity comparison or enumeration
  // e.g. "latest model dari Claude, OpenAI, DeepSeek, dan Gemini"
  const separatorRegex = /\b(?:dari|tentang|antara|mengenai|between|of|for)\b/i;
  const parts = cleanedText.split(separatorRegex);
  let topic = "";
  let entityPart = "";

  if (parts.length > 1) {
    topic = parts[0]!.trim();
    entityPart = parts.slice(1).join(" ").trim();
  } else {
    // Check if there are commas separating items
    const commaIndex = cleanedText.indexOf(",");
    if (commaIndex !== -1) {
      const beforeComma = cleanedText.slice(0, commaIndex).trim();
      const words = beforeComma.split(/\s+/);
      if (words.length > 1) {
        topic = words.slice(0, -1).join(" ");
        entityPart = words.slice(-1)[0] + cleanedText.slice(commaIndex);
      } else {
        entityPart = cleanedText;
      }
    }
  }

  if (entityPart) {
    const rawEntities = entityPart
      .split(/(?:,\s*(?:dan|and|serta)\s*|,\s*|\s+(?:dan|and|serta)\s+)/i)
      .map((e) => e.trim())
      .filter((e) => e.length >= 2 && !/^(dan|and|serta|atau|or)$/i.test(e));

    if (rawEntities.length >= 2) {
      const maxEntities = Math.min(rawEntities.length, 4);
      for (const ent of rawEntities) {
        const subQ = topic ? `${ent} ${topic}`.trim() : ent;
        if (!queries.includes(subQ)) {
          queries.push(subQ);
        }
        if (queries.length >= maxEntities) break;
      }

      if (queries.length >= 2) {
        return queries;
      }
    }
  }

  // 3. Check for "vs" or "versus" comparison (e.g. "Next.js 15 vs Remix")
  const vsParts = cleanedText.split(/\s+(?:vs\.?|versus)\s+/i);
  if (vsParts.length === 2 && vsParts[0] && vsParts[1]) {
    const itemA = vsParts[0].trim();
    const itemB = vsParts[1].trim();
    return [cleanedText, itemA, itemB];
  }

  // 4. In DeepResearch mode with single query, generate an in-depth query pair
  if (isDeepResearch && cleanedText.length > 4) {
    return [cleanedText, `${cleanedText} overview update latest`];
  }

  return [cleanedText || text];
}
